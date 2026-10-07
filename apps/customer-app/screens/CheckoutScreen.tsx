import { NavigationAction, RouteProp, useFocusEffect, useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { ApiError, api, fetchCart, getUser, hasPendingBasketMerge, isLoggedIn, pkr, retryBasketMerge } from '../lib/api';
import { cartIssues } from '../lib/customer-flow';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { useTheme } from '../lib/theme';
import { refreshBadges } from '../lib/badges';
import { ActionDock, Choice, Field, Icon, Notice, OrderSummary, ProductArtwork, StatePanel, goTab, usePageInset } from '../components/CustomerUI';
import { addressFingerprint, addressPayload, CheckoutDraft, checkoutRecoveryProblem, draftForAccount, draftFromAddress, emptyCheckoutDraft, hasUsableCheckoutQuote, isDefinitiveCheckoutRejection, quoteFingerprint, readCheckoutDraft, validateCheckoutDraft, writeCheckoutDraft } from '../lib/checkout-draft';
type Stage = 'delivery' | 'merge' | 'review' | 'changes' | 'expired';
const uncertaintyKey = (accountId: string) => `sb.uncertainOrder.${accountId}`;
const addressAttemptKey = (accountId: string) => `sb.checkoutAddressAttempt.${accountId}`;
const message = (cause: any) => cause?.message || 'Check your connection and try again.';
/** Delivery is a local draft. Only an explicit final-review action can POST an order. */
export default function CheckoutScreen() {
    const { colors, s } = useTheme();
    const inset = usePageInset();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
    const [cart, setCart] = useState<any>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [draft, setDraft] = useState<CheckoutDraft>(emptyCheckoutDraft);
    const draftRef = useRef(draft);
    const [ready, setReady] = useState(false);
    const [stage, setStage] = useState<Stage>('delivery');
    const stageRef = useRef(stage);
    const [errors, setErrors] = useState<Partial<Record<keyof CheckoutDraft, string>>>({});
    const [showLogin, setShowLogin] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [orderError, setOrderError] = useState('');
    const [storageError, setStorageError] = useState('');
    const [mergePending, setMergePending] = useState(false);
    const [mergeQuoteError, setMergeQuoteError] = useState('');
    const guestQuote = useRef<{ token: string; cart: any } | null>(null);
    const [uncertain, setUncertain] = useState(false);
    const [canRecover, setCanRecover] = useState(false);
    const [recovery, setRecovery] = useState<{ owner: string; payload: Record<string, any> } | null>(null);
    const [reviewedQuote, setReviewedQuote] = useState('');
    const [previousQuote, setPreviousQuote] = useState<any>(null);
    const [showSaved, setShowSaved] = useState(false);
    const [showContactPhone, setShowContactPhone] = useState(false);
    const [allowNavigation, setAllowNavigation] = useState(false);
    const pendingNavigation = useRef<NavigationAction | null>(null);
    const placing = useRef(false);
    const working = useRef(false);
    const refreshVersion = useRef(0);
    const currentAccount = useRef<string | null>(null);
    const hydrated = useRef(false);
    const scroll = useRef<ScrollView>(null);
    stageRef.current = stage;
    const move = (next: Stage) => { setStage(next); stageRef.current = next; scroll.current?.scrollTo({ y: 0, animated: false }); };
    const remember = (next: CheckoutDraft) => {
        draftRef.current = next;
        setDraft(next);
        return writeCheckoutDraft(next).then(() => setStorageError('')).catch(() => {
            setStorageError('Your delivery draft could not be saved on this device. Try continuing again before signing in.');
        });
    };
    const update = (key: keyof CheckoutDraft, value: any) => {
        void remember({ ...draftRef.current, [key]: value });
        setErrors((old) => ({ ...old, [key]: undefined }));
        setReviewedQuote('');
    };
    const refresh = useCallback(async () => {
        const version = ++refreshVersion.current;
        setLoadError('');
        try {
            if (!hydrated.current) {
                const saved = await readCheckoutDraft();
                if (version !== refreshVersion.current)
                    return;
                draftRef.current = saved;
                setDraft(saved);
                hydrated.current = true;
                setReady(true);
            }
            const authenticated = await isLoggedIn();
            const user = authenticated ? await getUser() : null;
            if (version !== refreshVersion.current)
                return;
            const owner = user?.id ?? null;
            if (currentAccount.current && !owner)
                move('expired');
            if (currentAccount.current !== owner) {
                setAddresses([]);
                setReviewedQuote('');
                if (currentAccount.current && owner)
                    move('delivery');
            }
            currentAccount.current = owner;
            setAccountId(owner);
            const bound = draftForAccount(draftRef.current, owner);
            if (bound !== draftRef.current)
                await remember(bound);
            const pending = owner ? await hasPendingBasketMerge() : false;
            if (version !== refreshVersion.current)
                return;
            setMergePending(pending);
            setRecovery(null);
            setCanRecover(false);
            setUncertain(owner ? !!(await AsyncStorage.getItem(uncertaintyKey(owner))) : false);
            if (pending) {
                // The guest token is retained until merge confirmation. An empty account basket
                // is not evidence that these pending guest items were lost or transferred.
                const token = await AsyncStorage.getItem('sb.guestToken');
                try {
                    if (!token) throw new Error('The retained guest basket reference is not available.');
                    const point = draftRef.current.point;
                    const quote = await api.get(`/guest/cart${point ? `?latitude=${point.latitude}&longitude=${point.longitude}` : ''}`);
                    if (!quote || !Array.isArray(quote.groups) || !Number.isSafeInteger(quote.itemCount)) throw new Error('The pending guest basket could not be read.');
                    if (version !== refreshVersion.current) return;
                    guestQuote.current = { token, cart: quote };
                    setCart(quote); setMergeQuoteError('');
                } catch {
                    if (version !== refreshVersion.current) return;
                    const retained = token && guestQuote.current?.token === token ? guestQuote.current.cart : null;
                    setCart(retained);
                    setMergeQuoteError(retained ? 'The latest pending guest basket could not be checked. The last checked guest items and charges are shown; their current status is not confirmed.' : 'The pending guest basket could not be checked. Its current items and charges are unknown; this does not mean your basket is empty.');
                }
            } else {
                const quote = await fetchCart(draftRef.current.point ?? undefined);
                if (version !== refreshVersion.current) return;
                setCart(quote); setMergeQuoteError('');
                if (!owner) {
                    const token = await AsyncStorage.getItem('sb.guestToken');
                    if (version !== refreshVersion.current) return;
                    if (token) guestQuote.current = { token, cart: quote };
                }
            }
            void refreshBadges();
            if (owner) {
                try {
                    const savedAddresses = await api.get('/customer/addresses');
                    if (version !== refreshVersion.current)
                        return;
                    setAddresses(savedAddresses);
                    const selectedId = route.params?.selectedAddressId;
                    const selected = selectedId && savedAddresses.find((entry: any) => entry.id === selectedId);
                    if (selected) {
                        await remember(draftFromAddress(selected, owner, draftRef.current));
                        navigation.setParams({ selectedAddressId: undefined });
                        setReviewedQuote('');
                        move('delivery');
                    }
                }
                catch (cause) {
                    if (version === refreshVersion.current)
                        setOrderError(`Saved addresses could not be loaded. ${message(cause)} You can keep editing your delivery draft.`);
                }
            }
            else
                setAddresses([]);
        }
        catch (cause) {
            if (version === refreshVersion.current)
                setLoadError(message(cause));
        }
    }, [route.params?.selectedAddressId]);
    useFocusEffect(useCallback(() => { setAllowNavigation(false); void refresh(); return () => { refreshVersion.current++; }; }, [refresh]));
    useEffect(() => subscribeCustomerEvent('auth', () => { void refresh(); }), [refresh]);
    useEffect(() => {
        const picked = route.params?.picked;
        if (!picked || !ready)
            return;
        void remember({ ...draftRef.current, point: { latitude: picked.latitude, longitude: picked.longitude },
            fullAddress: draftRef.current.fullAddress || picked.fullAddress || '', city: draftRef.current.city || picked.city || '' });
        setErrors((old) => ({ ...old, point: undefined }));
        setReviewedQuote('');
        move('delivery');
        navigation.setParams({ picked: undefined });
    }, [route.params?.picked, ready]);
    useLayoutEffect(() => {
        navigation.setOptions({ title: uncertain && !recovery ? 'Order result uncertain' : mergePending ? 'Merge not confirmed' :
                stage === 'review' ? 'Final review' : stage === 'merge' ? 'Review your basket' : stage === 'expired' ? 'Session expired' :
                    stage === 'changes' ? 'Price / stock changed' : 'Checkout' });
    }, [navigation, stage, uncertain, recovery, mergePending]);
    // Native-stack gestures/hardware back use the supported removal guard, not only a JS back listener.
    usePreventRemove(stage !== 'delivery' && !uncertain && !mergePending && !allowNavigation, ({ data }) => {
        if (['GO_BACK', 'POP'].includes(data.action.type) && !placing.current) move('delivery');
        else { pendingNavigation.current = data.action; setAllowNavigation(true); }
    });
    useEffect(() => {
        if (!allowNavigation || !pendingNavigation.current) return;
        const action = pendingNavigation.current; pendingNavigation.current = null;
        navigation.dispatch(action);
    }, [allowNavigation, navigation]);
    const run = async (task: () => Promise<void>) => {
        if (working.current || placing.current)
            return;
        working.current = true;
        setBusy(true);
        setOrderError('');
        try {
            await task();
        }
        catch (cause) {
            setOrderError(message(cause));
            if (cause instanceof ApiError && cause.status === 401)
                move('expired');
        }
        finally {
            working.current = false;
            setBusy(false);
        }
    };
    const assertAccount = async (owner: string) => {
        if (!(await isLoggedIn()) || (await getUser())?.id !== owner) {
            move('expired');
            throw new Error('Sign in again to continue. Your delivery draft is retained.');
        }
    };
    const ensureAddress = async (owner: string): Promise<string> => {
        await assertAccount(owner);
        const payload = addressPayload(draftRef.current);
        const fingerprint = addressFingerprint(payload);
        const all = await api.get('/customer/addresses');
        await assertAccount(owner);
        setAddresses(all);
        // An ambiguous create cannot be blindly retried: first find the exact saved address.
        const attemptKey = addressAttemptKey(owner);
        const attemptRaw = await AsyncStorage.getItem(attemptKey);
        if (attemptRaw) {
            const attempt = JSON.parse(attemptRaw);
            if (!all.some((address: any) => addressFingerprint(address) === attempt.fingerprint)) {
                throw new Error('The previous address save is not confirmed. Check saved addresses or contact support before trying again. No new address or order was sent.');
            }
            await AsyncStorage.removeItem(attemptKey);
        }
        const bound = draftRef.current.ownedAddress;
        const existing = all.find((address: any) => (bound?.accountId === owner && address.id === bound.addressId && addressFingerprint(address) === fingerprint))
            ?? all.find((address: any) => addressFingerprint(address) === fingerprint);
        if (existing) {
            await remember({ ...draftRef.current, ownedAddress: { accountId: owner, addressId: existing.id, fingerprint } });
            return existing.id;
        }
        await assertAccount(owner);
        await AsyncStorage.setItem(attemptKey, JSON.stringify({ at: Date.now(), fingerprint, payload }));
        let saved: any;
        try {
            saved = await api.post('/customer/addresses', payload);
        }
        catch (cause) {
            if (cause instanceof ApiError && isDefinitiveCheckoutRejection(cause.status)) {
                await AsyncStorage.removeItem(attemptKey).catch(() => undefined);
                throw cause;
            }
            // A lost response may still have committed. Read, never add a second copy.
            await assertAccount(owner);
            const reconciled = await api.get('/customer/addresses').catch(() => []);
            await assertAccount(owner);
            saved = reconciled.find((address: any) => addressFingerprint(address) === fingerprint);
            if (!saved)
                throw new Error('The address save response was not confirmed. Your draft is retained. Check saved addresses before continuing; no order was sent.');
        }
        if (!saved?.id)
            throw new Error('The address save returned no reference. Check saved addresses before continuing.');
        await AsyncStorage.removeItem(attemptKey);
        await assertAccount(owner);
        await remember({ ...draftRef.current, ownedAddress: { accountId: owner, addressId: saved.id, fingerprint } });
        return saved.id;
    };
    const prepareReview = async () => {
        const invalid = validateCheckoutDraft(draftRef.current);
        if (Object.keys(invalid).length) { setErrors(invalid); move('delivery'); return; }
        const owner = (await getUser())?.id;
        if (!owner) {
            move('expired');
            return;
        }
        await assertAccount(owner);
        if (await hasPendingBasketMerge()) {
            setMergePending(true);
            return;
        }
        await ensureAddress(owner);
        const quote = await fetchCart(draftRef.current.point!);
        await assertAccount(owner);
        setCart(quote);
        if (quote?.couponError) throw new Error('Your promo code is no longer eligible. Remove it or apply an eligible code in your basket before continuing.');
        if (!hasUsableCheckoutQuote(quote)) throw new Error('The latest basket charges are incomplete. Check your basket and retry before placing an order.');
        const fingerprint = quoteFingerprint(quote, draftRef.current.point);
        if (cartIssues(quote).unavailable || (cartIssues(quote).priceChanged && reviewedQuote !== fingerprint)) {
            setPreviousQuote(cart);
            move('changes');
            return;
        }
        setReviewedQuote(fingerprint);
        move('review');
    };
    const continueDelivery = () => void run(async () => {
        const invalid = validateCheckoutDraft(draftRef.current);
        setErrors(invalid);
        if (Object.keys(invalid).length) {
            scroll.current?.scrollTo({ y: 0, animated: false });
            return;
        }
        // Await durable storage before leaving the form; a background failure is not silently ignored.
        await writeCheckoutDraft(draftRef.current);
        setStorageError('');
        if (!(await isLoggedIn())) {
            setShowLogin(true);
            return;
        }
        await prepareReview();
    });
    const submitCheckout = async (payload: Record<string, any>, owner: string, quote: any) => {
        if (placing.current)
            return;
        placing.current = true;
        setBusy(true);
        setOrderError('');
        let sent = false;
        const key = uncertaintyKey(owner);
        try {
            await assertAccount(owner);
            const existing = await AsyncStorage.getItem(key);
            if (existing && JSON.parse(existing)?.payload?.requestId !== payload.requestId) {
                setUncertain(true);
                throw new Error('A previous checkout still needs a status check. Its recovery reference was retained.');
            }
            // Write before the request: process death must not unlock a new checkout.
            await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), payload,
                quoteFingerprint: quoteFingerprint(quote, draftRef.current.point),
                addressFingerprint: addressFingerprint(addressPayload(draftRef.current)) }));
            sent = true;
            const order = await api.post('/orders', payload);
            if (!order?.id)
                throw new Error('Order reference was not returned.');
            await assertAccount(owner);
            await AsyncStorage.removeItem(key);
            void refreshBadges();
            navigation.replace('OrderSent', { orderId: order.id });
        }
        catch (cause) {
            if (!sent)
                setOrderError(`${message(cause)} No order was sent.`);
            else if (cause instanceof ApiError && isDefinitiveCheckoutRejection(cause.status)) {
                await AsyncStorage.removeItem(key).catch(() => undefined);
                setUncertain(false);
                setCanRecover(false);
                setRecovery(null);
                if (cause.status === 401)
                    move('expired');
                setOrderError(`${message(cause)} Review your details before continuing.`);
            }
            else {
                setUncertain(true);
                setCanRecover(false);
                setRecovery(null);
                setOrderError('The order response was not confirmed. Check its saved status before trying again.');
            }
        }
        finally {
            placing.current = false;
            setBusy(false);
        }
    };
    const placeOrder = () => void run(async () => {
        if ((uncertain && !recovery) || stageRef.current !== 'review')
            return;
        const owner = (await getUser())?.id;
        if (!owner) {
            move('expired');
            return;
        }
        await assertAccount(owner);
        const storedRaw = await AsyncStorage.getItem(uncertaintyKey(owner));
        const stored = storedRaw ? JSON.parse(storedRaw) : null;
        if (stored && (!recovery || recovery.owner !== owner || JSON.stringify(recovery.payload) !== JSON.stringify(stored.payload))) {
            setRecovery(null); setUncertain(true); return;
        }
        if (recovery && !stored) { setRecovery(null); throw new Error('Check the saved checkout status again before continuing.'); }
        if (recovery) {
            // A delayed first request may have committed since the earlier 404. Never POST until rechecked.
            try {
                const found = await api.get(`/orders/${stored.payload.requestId}`);
                await assertAccount(owner);
                if (!found?.id) throw new Error('The saved order status could not be confirmed.');
                await AsyncStorage.removeItem(uncertaintyKey(owner));
                navigation.replace('OrderDetail', { orderId: found.id });
                return;
            } catch (cause) {
                if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
            }
        }
        if (await hasPendingBasketMerge()) {
            setMergePending(true);
            return;
        }
        const bound = draftRef.current.ownedAddress;
        if (!bound || bound.accountId !== owner || bound.fingerprint !== addressFingerprint(addressPayload(draftRef.current))) {
            move('delivery');
            throw new Error('Review your delivery details again before placing the order.');
        }
        const savedAddresses = await api.get('/customer/addresses');
        await assertAccount(owner);
        const savedAddress = savedAddresses.find((address: any) => address.id === bound.addressId);
        if (!savedAddress || addressFingerprint(savedAddress) !== bound.fingerprint) {
            if (recovery) { setRecovery(null); setUncertain(true); }
            else move('delivery');
            throw new Error('The saved delivery address changed. Check its details before continuing. No order was sent.');
        }
        const quote = await fetchCart(draftRef.current.point!);
        await assertAccount(owner);
        setCart(quote);
        if (recovery) {
            const problem = checkoutRecoveryProblem(stored, quote, savedAddress);
            if (problem) throw new Error(problem);
        }
        if (quote?.couponError) throw new Error('Your promo code is no longer eligible. Remove it or apply an eligible code in your basket before continuing.');
        if (!hasUsableCheckoutQuote(quote)) throw new Error('The latest basket charges are incomplete. Check your basket and retry before placing an order.');
        if (cartIssues(quote).unavailable || reviewedQuote !== quoteFingerprint(quote, draftRef.current.point)) {
            setPreviousQuote(cart);
            move('changes');
            return;
        }
        if (!quote.itemCount || !quote.id)
            throw new Error('Your basket is empty. Add items before checking out.');
        await submitCheckout(recovery ? stored.payload : { requestId: randomUUID(), cartId: quote.id, deliveryAddressId: bound.addressId,
            paymentMethod: 'COD', customerNote: draftRef.current.customerNote.trim() || undefined }, owner, quote);
    });
    const checkOrderStatus = () => void run(async () => {
        const owner = (await getUser())?.id;
        if (!owner) {
            move('expired');
            return;
        }
        await assertAccount(owner);
        setCanRecover(false);
        const stored = JSON.parse((await AsyncStorage.getItem(uncertaintyKey(owner))) || '{}');
        if (!stored.payload?.requestId)
            throw new Error('This older checkout has no recovery reference. Check order history or contact support before trying again.');
        try {
            const order = await api.get(`/orders/${stored.payload.requestId}`);
            await assertAccount(owner);
            if (!order?.id) throw new Error('The saved order status could not be confirmed.');
            await AsyncStorage.removeItem(uncertaintyKey(owner));
            navigation.replace('OrderDetail', { orderId: order.id });
        }
        catch (cause) {
            if (cause instanceof ApiError && cause.status === 404) {
                setCanRecover(true);
                setOrderError('No confirmed order was found for this reference. Review the current basket and original delivery details before retrying with the same reference.');
            }
            else
                throw cause;
        }
    });
    const recoverCheckout = () => void run(async () => {
        if (!canRecover)
            return;
        const owner = (await getUser())?.id;
        if (!owner) {
            move('expired');
            return;
        }
        await assertAccount(owner);
        const stored = JSON.parse((await AsyncStorage.getItem(uncertaintyKey(owner))) || '{}');
        if (!stored.payload?.requestId) {
            setCanRecover(false);
            return;
        }
        const savedAddresses = await api.get('/customer/addresses');
        await assertAccount(owner);
        const address = savedAddresses.find((entry: any) => entry.id === stored.payload.deliveryAddressId);
        if (!address) throw new Error('The original delivery address is not available. Contact support before retrying this saved checkout.');
        const quote = await fetchCart({ latitude: address.latitude, longitude: address.longitude });
        await assertAccount(owner);
        setCart(quote);
        const problem = checkoutRecoveryProblem(stored, quote, address);
        if (problem) throw new Error(problem);
        const retained = draftFromAddress(address, owner, { ...draftRef.current, customerNote: stored.payload.customerNote ?? '' });
        await remember(retained);
        setRecovery({ owner, payload: stored.payload });
        setCanRecover(false);
        const fingerprint = quoteFingerprint(quote, retained.point);
        if (cartIssues(quote).unavailable || stored.quoteFingerprint !== fingerprint) {
            setPreviousQuote(null); move('changes');
        } else {
            setReviewedQuote(fingerprint); move('review');
        }
    });
    const confirmAuth = async () => {
        setShowLogin(false);
        setOrderError('');
        move('merge');
        await refresh();
    };
    const checkMerge = () => void run(async () => {
        // The current API claims and copies the guest basket atomically; retry is idempotent.
        await retryBasketMerge();
        await refresh();
        if (!(await hasPendingBasketMerge())) {
            setMergePending(false);
            move('merge');
        }
    });
    const button = (label: string, onPress: () => void, secondary = false, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={onPress} style={[secondary ? s.btnGhost : s.btn, { justifyContent: 'center', opacity: busy || disabled ? 0.55 : 1 }]}><Text style={secondary ? s.btnGhostText : s.btnText}>{busy ? 'Checking…' : label}</Text></TouchableOpacity>;
    const link = (label: string, onPress: () => void) => <TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={busy} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{label}</Text></TouchableOpacity>;
    const iconArt = (name: 'check' | 'info') => <View style={{ alignSelf: 'center', width: 90, height: 90, backgroundColor: colors.emeraldBg, borderRadius: 28, marginTop: 28, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={40} color={colors.primary}/></View>;
    const errorNotices = <>{orderError ? <Notice danger>{orderError}</Notice> : null}{storageError ? <Notice danger>{storageError}</Notice> : null}{loadError && cart ? <Notice danger>{loadError} Your previous basket is shown; retry before continuing.</Notice> : null}
      {recovery ? <Notice tone="info">This review keeps the original checkout reference and delivery details. Nothing is retried until you choose Place order.</Notice> : null}
      {cart?.couponError ? <View style={{ gap: 8 }}><Notice danger>{cart.couponError} Remove this promo code or apply an eligible code before placing an order.</Notice>{link('Review promo code in basket', () => goTab(navigation, 'CartTab'))}</View> : null}</>;
    let content: React.ReactNode;
    let dock: React.ReactNode = null;
    if (stage === 'expired' && !accountId) {
        content = <><StatePanel icon="lock" title={'Sign in to\ncontinue checkout.'} message="Your delivery draft stays here. We’ll check your saved basket before you place anything." action="Continue securely" onPress={() => setShowLogin(true)} secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')}/>{errorNotices}</>;
    }
    else if (uncertain && !recovery) {
        content = <><StatePanel icon="clock" title={'Let’s check before\ntrying again.'} message="We haven’t confirmed whether your order was saved. Don’t place it a second time yet." action={busy ? 'Checking…' : 'Check order status'} onPress={checkOrderStatus} secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')}/>{errorNotices}{canRecover && button('Review saved checkout', recoverCheckout, true)}{link('Check order history', () => goTab(navigation, 'OrdersTab', { screen: 'Orders' }))}{link('Contact support', () => navigation.navigate('Help'))}</>;
    }
    else if ((!ready || !cart) && !loadError && !mergePending) {
        content = <StatePanel loading title="Loading checkout…"/>;
    }
    else if (loadError && !cart && !mergePending) {
        content = <StatePanel icon="wifi" title="Couldn’t load checkout." message={loadError} action="Try again" onPress={refresh}/>;
    }
    else if (mergePending || stage === 'merge') {
        content = <>{iconArt(mergePending ? 'info' : 'check')}<Text accessibilityRole="header" style={s.h1}>{mergePending ? 'Your basket needs\na quick check.' : 'You’re signed in.\nReview your basket.'}</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 12 }}>{mergePending ? 'We could not confirm whether every guest item was added to your account basket. Do not place the order yet.' : 'Your guest basket and any existing account items are reviewed together before ordering.'}</Text><View style={[s.card, { marginTop: 20, gap: 12 }]}><View style={[s.row, { gap: 10 }]}><Icon name="basket"/><Text style={s.h2}>{cart?.itemCount ?? '—'} {mergePending ? 'pending guest items' : 'items in your basket'}</Text></View><Text style={s.muted}>{mergePending ? 'Your delivery draft is retained. This shows only the pending guest basket, not a confirmed combined account total.' : 'Review quantities, stock and prices before continuing.'}</Text>{cart ? <View style={{ marginTop: 4 }}><OrderSummary cart={cart} title={mergePending && mergeQuoteError ? 'Last checked guest charges' : ''} bare /></View> : null}</View><View style={{ marginTop: 16, gap: 16 }}>{mergeQuoteError ? <Notice tone="warning">{mergeQuoteError}</Notice> : null}<Notice tone={mergePending ? 'warning' : 'info'} icon="shield">{mergePending ? 'Your delivery details are retained. Check your saved basket before continuing.' : 'No order has been placed. You stay in control of the final total.'}</Notice>{errorNotices}</View></>;
        dock = button(mergePending ? 'Check saved basket' : 'Continue to final review', mergePending ? checkMerge : () => void run(prepareReview));
    }
    else if (!cart?.itemCount) {
        content = <StatePanel title="Your basket is empty" message="Browse products and add what you need. No account required." action="Start shopping" onPress={() => goTab(navigation, 'HomeTab')}/>;
    }
    else if (stage === 'changes') {
        const unavailable = cartIssues(cart).unavailable || !hasUsableCheckoutQuote(cart);
        content = <><Text accessibilityRole="header" style={s.h1}>{'A quick basket\nupdate.'}</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 12 }}>A price, delivery charge or stock level changed while you were shopping.</Text><View style={[s.card, { marginTop: 20 }]}>{cart.groups?.flatMap((group: any) => group.items?.map((item: any, index: number) => <View key={item.id} style={[s.row, { paddingVertical: 13, gap: 11, borderTopWidth: index ? 1 : 0, borderColor: colors.border }]}><View style={{ width: 58 }}><ProductArtwork name={item.product?.name ?? item.name} uri={item.product?.imageUrl ?? item.imageUrl} size={61}/></View><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{item.product?.name ?? item.name ?? 'Basket item'}</Text><Text style={s.muted}>{item.inStock === false ? `Requested ${item.quantity} · available ${item.stockQuantity ?? 'not confirmed'}` : `${item.quantity} × ${pkr(item.currentPricePaisa ?? item.unitPricePaisa)}`}</Text>{item.priceChanged && <Text style={{ color: colors.amber, fontSize: 11 }}>Price changed</Text>}</View></View>))}</View><View style={{ marginTop: 16, gap: 16 }}>{previousQuote && <Text style={s.muted}>Previous total {pkr(previousQuote.totalPaisa)} · Latest total {pkr(cart.totalPaisa)}</Text>}<OrderSummary cart={cart} title="Latest charges"/><Notice tone="warning">Review these changes before placing the order. Quantities are not silently reduced.</Notice>{errorNotices}</View></>;
        dock = button(unavailable ? 'Review basket changes' : 'Review updated total', () => { if (unavailable)
            goTab(navigation, 'CartTab');
        else {
            setReviewedQuote(quoteFingerprint(cart, draftRef.current.point));
            move('review');
        } });
    }
    else {
        const review = stage === 'review';
        content = <><View style={[s.row, { gap: 7, marginBottom: 20 }]}>{['1 · Delivery', '2 · Verify', '3 · Review'].map((label, index) => <View key={label} style={[s.row, { gap: 7, flex: index === 2 ? undefined : 1 }]}><Text style={{ color: (review ? index === 2 : index === 0) ? colors.primary : colors.muted, fontSize: 10, fontWeight: (review ? index === 2 : index === 0) ? '700' : '400' }}>{label}</Text>{index < 2 && <View style={{ height: 1, flex: 1, backgroundColor: colors.border }}/>}</View>)}</View><Text accessibilityRole="header" style={s.h1}>{review ? 'One last check.' : 'Where should\nwe deliver?'}</Text><Text style={[s.muted, { marginTop: 8 }]}>{review ? 'Review the latest items, delivery details and total.' : 'Add your delivery details. Sign in at the final step.'}</Text>
      <View style={[s.card, { marginTop: 20 }]}><View style={[s.spread, { gap: 10 }]}><View style={[s.row, { gap: 10 }]}>{!review && <Icon name="pin"/>}<Text style={[s.body, { fontSize: 16, fontWeight: '700' }]}>Delivery address</Text></View>{review && !recovery && link('Edit', () => move('delivery'))}</View>
        {review ? <><Text style={[s.muted, { color: colors.text, marginTop: 8 }]}><Text style={{ fontWeight: '700' }}>{draft.contactName || 'Delivery contact'}</Text>{'\n'}{draft.fullAddress}{'\n'}{draft.city}</Text>{!!draft.contactPhone && <Text style={s.muted}>{draft.contactPhone}</Text>}{!!draft.instructions && <Text style={[s.muted, { marginTop: 8 }]}>{draft.instructions}</Text>}</> : <>
          <Field label="Full address" value={draft.fullAddress} onChangeText={(value) => update('fullAddress', value)} placeholder="House / apartment, street, area" autoComplete="street-address" error={errors.fullAddress} editable={!busy}/>
          <View style={[s.row, { gap: 12, alignItems: 'flex-start' }]}><View style={{ flex: 1 }}><Field label="City" value={draft.city} onChangeText={(value) => update('city', value)} placeholder="City" error={errors.city} editable={!busy}/></View><View style={{ flex: 1 }}><Field label="Contact name" value={draft.contactName} onChangeText={(value) => update('contactName', value)} placeholder="Your name" autoComplete="name" editable={!busy}/></View></View>
          <Field label="Delivery instructions · optional" value={draft.instructions} onChangeText={(value) => update('instructions', value)} placeholder="Landmark, building or access details" editable={!busy}/>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={draft.point ? 'Confirm on map. Delivery pin already selected.' : 'Confirm on map'} onPress={() => navigation.navigate('MapPicker', { ...draft.point, returnTo: 'Checkout', fullAddress: draft.fullAddress, city: draft.city })} disabled={busy} style={[s.row, { minHeight: 44, gap: 6, marginTop: 12 }]}><Icon name="pin" color={colors.primary}/><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Confirm on map</Text></TouchableOpacity>
          {!!errors.point && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{errors.point}</Text>}
          <Text style={s.faint}>Your guest draft stays here during sign-in.</Text>
          {!!accountId && addresses.length > 0 && <>{link(showSaved ? 'Hide saved addresses' : 'Choose a saved address', () => setShowSaved((shown) => !shown))}{showSaved && <View style={{ gap: 8 }}>{addresses.map((address) => <Choice key={address.id} icon="pin" title={address.label || 'Delivery address'} subtitle={`${address.fullAddress}, ${address.city}`} selected={draft.ownedAddress?.addressId === address.id && draft.ownedAddress?.fingerprint === addressFingerprint(addressPayload(draft))} onPress={() => { void remember(draftFromAddress(address, accountId, draftRef.current)); setShowSaved(false); setReviewedQuote(''); setErrors({}); }}/>)}</View>}</>}
        </>}
      </View>
      <View style={{ marginTop: 20, gap: 8 }}><Text style={[s.body, { fontSize: 16, fontWeight: '700', marginBottom: 4 }]}>Payment</Text><Choice title="Cash on delivery" subtitle="Pay when your order arrives." icon="cash" selected onPress={() => { }}/><View style={{ minHeight: 62, borderRadius: 14, padding: 14, gap: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }} accessibilityLabel="Online payment is not available"><Icon name="card" color={colors.primary}/><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Online payment</Text><Text style={[s.muted, { marginTop: 3 }]}>Choose cash on delivery for now.</Text></View><Text style={{ color: colors.muted, backgroundColor: colors.canvas, borderRadius: 7, padding: 5, fontSize: 10 }}>Not available</Text></View></View>
      {review ? <><View style={[s.card, { marginTop: 20, gap: 12 }]}><View style={s.spread}><Text style={[s.body, { fontSize: 16, fontWeight: '700' }]}>Items & charges</Text>{link('Edit basket', () => goTab(navigation, 'CartTab'))}</View>{cart.groups?.length > 1 && cart.groups.map((group: any) => <View key={group.merchantId ?? group.merchant?.id} style={{ gap: 3 }}><Text style={[s.body, { fontWeight: '700' }]}>{group.merchant?.shopName ?? group.shopName ?? 'Local shop'}</Text><Text style={s.muted}>{group.items?.map((item: any) => `${item.quantity} × ${item.product?.name ?? item.name ?? 'item'}`).join(' · ')}</Text><Text style={s.muted}>Shop delivery {pkr(group.deliveryFeePaisa)}</Text></View>)}<OrderSummary cart={cart} title="" bare /></View><Text style={[s.faint, { lineHeight: 16, marginTop: 16 }]}>Placing the order sends it to the shop. Acceptance is confirmed separately.</Text></> : <><View style={{ backgroundColor: colors.canvas, borderRadius: 13, padding: 13, marginTop: 20 }}><View style={s.spread}><Text style={s.muted}>{cart.itemCount} items · {cart.groups?.length ?? 0} shop(s)</Text><Text style={[s.body, { fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{pkr(cart.totalPaisa)}</Text></View><Text style={[s.faint, { marginTop: 8, lineHeight: 16 }]}>Final fees are rechecked for this delivery address after sign-in.</Text></View>{link(showContactPhone || !!draft.contactPhone ? 'Edit delivery contact number' : 'Add a delivery contact number · optional', () => setShowContactPhone((shown) => !shown))}{(showContactPhone || !!errors.contactPhone) && <Field label="Delivery contact number · optional" value={draft.contactPhone} onChangeText={(value) => update('contactPhone', value)} placeholder="+92 mobile number" keyboardType="phone-pad" autoComplete="tel" error={errors.contactPhone} editable={!busy}/>}</>}
      <View style={{ marginTop: 16, gap: 12 }}>{errorNotices}{!!loadError && link('Retry checkout', () => { void refresh(); })}</View>
    </>;
        dock = button(review ? `Place order · ${pkr(cart.totalPaisa)}` : accountId ? 'Review order' : 'Continue to sign in', review ? placeOrder : continueDelivery, false, !ready || !!loadError || (review && !hasUsableCheckoutQuote(cart)));
    }
    return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>{content}</ScrollView>{dock && <ActionDock>{dock}</ActionDock>}<LoginSheet visible={showLogin} reason="checkout" onClose={() => { setShowLogin(false); void refresh(); }} onSuccess={() => { void confirmAuth(); }} onMergePending={() => { setShowLogin(false); setMergePending(true); void refresh(); }}/></KeyboardAvoidingView>;
}
