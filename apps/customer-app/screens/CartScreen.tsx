import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, cartBase, fetchCart, getUser, hasPendingBasketMerge, isLoggedIn, pkr } from '../lib/api';
import { useTheme } from '../lib/theme';
import { refreshBadges } from '../lib/badges';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { assertProductCanBeAdded } from '../lib/product-purchase';
import { ActionDock, Icon, Notice, OrderSummary, ProductArtwork, StatePanel, goTab, usePageInset } from '../components/CustomerUI';

const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const readBasket = async () => {
  const basket = await fetchCart();
  if (!basket || !Array.isArray(basket.groups) || !Number.isInteger(basket.itemCount) || basket.itemCount < 0 || basket.groups.some((group: any) => !group || !Array.isArray(group.items))) throw new Error('The basket response could not be confirmed.');
  return basket;
};

/** C09/C10/C32. Shopping is public; every write is followed by a fresh location-aware quote. */
export default function CartScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const [cart, setCart] = useState<any>(null);
  const [coupon, setCoupon] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [canRemoveCoupon, setCanRemoveCoupon] = useState(false);
  const [recovery, setRecovery] = useState<'merge' | 'order' | null>(null);
  const focused = useRef(false);
  const generation = useRef(0);
  const mutationLock = useRef(false);
  const couponInput = useRef<TextInput>(null);
  const load = useCallback(async () => {
    if (mutationLock.current || !focused.current) return;
    const current = ++generation.current;
    setRefreshing(true); setQuoteReady(false); setError('');
    try {
      const member = await isLoggedIn();
      const owner = member ? (await getUser())?.id : null;
      const pendingOrder = owner ? !!(await AsyncStorage.getItem(`sb.uncertainOrder.${owner}`)) : false;
      const pendingMerge = owner ? await hasPendingBasketMerge() : false;
      if (focused.current && current === generation.current) setRecovery(pendingOrder ? 'order' : pendingMerge ? 'merge' : null);
      const result = await readBasket();
      if (focused.current && current === generation.current) { setCart(result); setQuoteReady(true); setCanRemoveCoupon(member); }
      void refreshBadges();
    } catch (cause: any) {
      if (focused.current && current === generation.current) setError(`${cause.message} Refresh your basket to check the latest items and charges.`);
    } finally { if (focused.current && current === generation.current) setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true; void load();
    const auth = subscribeCustomerEvent('auth', () => { setCart(null); setRecovery(null); setQuoteReady(false); generation.current++; void load(); });
    const location = subscribeCustomerEvent('location', () => { generation.current++; setQuoteReady(false); void load(); });
    return () => { focused.current = false; generation.current++; auth(); location(); };
  }, [load]));
  useLayoutEffect(() => { navigation.setOptions({ title: recovery === 'order' ? 'Order result uncertain' : recovery === 'merge' ? 'Merge not confirmed' : cart?.itemCount === 0 ? 'Empty basket' : 'Basket' }); }, [navigation, cart?.itemCount, recovery]);
  const mutate = async (operation: () => Promise<unknown>, recovery: string) => {
    if (mutationLock.current || refreshing) return;
    mutationLock.current = true;
    const current = ++generation.current;
    setBusy(true); setQuoteReady(false); setMutationError(''); setError('');
    let failure = '';
    try {
      try { await operation(); }
      catch (cause: any) { failure = `${cause.message} ${recovery}`; }
      // Mutation responses omit address-aware delivery charges. Never display them as a quote.
      const result = await readBasket();
      if (focused.current && current === generation.current) { setCart(result); setQuoteReady(true); setMutationError(failure); }
      void refreshBadges();
    } catch (cause: any) {
      if (focused.current && current === generation.current) {
        setMutationError(failure || 'The change may have been saved. Check the refreshed basket before trying again.');
        setError(`${cause.message} Refresh your basket before continuing.`);
      }
    } finally {
      mutationLock.current = false; setBusy(false);
      if (focused.current && current !== generation.current) void load();
    }
  };
  const setQty = (id: string, quantity: number) => mutate(async () => {
    const item = cart?.groups?.flatMap((group: any) => group.items ?? []).find((entry: any) => entry.id === id);
    if (!item || !Number.isSafeInteger(item.quantity)) throw new Error('Check the current basket quantity before changing it.');
    if (quantity > item.quantity) await assertProductCanBeAdded(item.productId);
    return api.put(`${await cartBase()}/items/${id}`, { quantity });
  }, 'The current basket is shown below. Check the quantity before retrying.');
  const remove = (id: string) => mutate(async () => api.del(`${await cartBase()}/items/${id}`), 'Check whether the item remains before removing it again.');
  const applyCoupon = () => {
    if (!coupon.trim()) { setMutationError('Enter a promo code before applying it.'); couponInput.current?.focus(); return; }
    return mutate(async () => api.post(`${await cartBase()}/apply-coupon`, { code: coupon.trim() }), 'Check the code and the current basket before trying again.');
  };
  // Recovery belongs to the signed-in account and remains reachable even when its
  // current basket is empty (a saved order or pending guest merge can explain that).
  if (recovery && (!cart || (cart.itemCount === 0 && cart.groups.length === 0))) return <View style={s.screen}><ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
    <StatePanel icon={recovery === 'order' ? 'clock' : 'info'} title={recovery === 'order' ? 'Let’s check before\ntrying again.' : 'Your basket needs\na quick check.'}
      message={recovery === 'order' ? 'An earlier checkout still needs a saved-status check. An empty basket does not confirm whether that order was placed.' : 'Your guest basket merge is not confirmed. Check the retained guest items before continuing; an empty account basket does not mean they were lost.'}
      action={recovery === 'order' ? 'Check order status' : 'Check saved basket'} onPress={() => navigation.navigate('Checkout')}
      secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')} />
    {!!error && <Notice tone="warning">{error} Your recovery reference is retained.</Notice>}
  </ScrollView></View>;
  if (!cart) return <View style={s.screen}><ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}><StatePanel loading={!error} icon="wifi" title={error ? 'Couldn’t load\nyour basket.' : 'Loading basket…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={() => void load()} secondaryAction={error ? 'Back to shopping' : undefined} onSecondary={() => goTab(navigation, 'HomeTab')} /></ScrollView></View>;
  if (cart.itemCount === 0 && cart.groups.length === 0) return <View style={s.screen}><ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
    {!!error && <View style={{ marginBottom: 12 }}><Notice danger>{error}</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => void load()}><Text style={s.btnGhostText}>Refresh basket</Text></TouchableOpacity></View>}
    <StatePanel icon="basket" title="Your basket is empty" message="Browse products and add what you need. No account required." action="Start shopping" onPress={() => goTab(navigation, 'HomeTab')} secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')} />
  </ScrollView></View>;
  const groups = cart.groups;
  const missingItems = groups.length === 0 || groups.some((group: any) => !Array.isArray(group.items) || !group.merchant?.id);
  const hasStockIssue = groups.some((group: any) => group.items?.some((item: any) => item.inStock === false));
  const hasPriceChange = groups.some((group: any) => group.items?.some((item: any) => item.priceChanged));
  const belowMinimum = (group: any) => isAmount(group.merchant?.minimumOrderValuePaisa) && isAmount(group.subtotalPaisa) && group.subtotalPaisa < group.merchant.minimumOrderValuePaisa;
  const closed = (group: any) => group.merchant?.isOpen === false || group.merchant?.isOnline === false;
  const checkoutBlocked = busy || refreshing || !quoteReady || missingItems || !isAmount(cart.totalPaisa) || hasStockIssue || groups.some((group: any) => belowMinimum(group) || closed(group));
  const baseDeliveries = groups.every((group: any) => isAmount(group.deliveryFeePaisa)) ? groups.reduce((sum: number, group: any) => sum + group.deliveryFeePaisa, 0) : undefined;
  const deliveryDiscount = isAmount(baseDeliveries) && isAmount(cart.deliveryFeePaisa) && baseDeliveries > cart.deliveryFeePaisa;
  return <View style={s.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      {recovery && <View style={{ gap: 8, marginBottom: 16 }}><Notice tone="warning">{recovery === 'order' ? 'An earlier checkout still needs a saved-status check. Do not place a new order until it is resolved.' : 'Your guest basket merge is not confirmed. These account items are not a confirmed combined basket.'}</Notice><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Checkout')} style={s.btnGhost}><Text style={s.btnGhostText}>{recovery === 'order' ? 'Check order status' : 'Check saved basket'}</Text></TouchableOpacity></View>}
      <Text accessibilityRole="header" style={s.h1}>Your basket</Text>
      <Text style={[s.muted, { marginTop: 8 }]}>{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · {groups.length} {groups.length === 1 ? 'shop' : 'shops · separate deliveries'}</Text>
      {groups.length > 1 && <View style={{ marginTop: 16 }}><Notice tone="blue" icon="shop">Each shop prepares and delivers its own items. Review the delivery charges for {groups.length === 2 ? 'both shops' : 'each shop'}.</Notice></View>}
      {!!error && <View style={{ marginTop: 16, gap: 12 }}><Notice danger>{error}</Notice><TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy || refreshing} onPress={() => void load()}><Text style={s.btnGhostText}>{refreshing ? 'Refreshing basket…' : 'Refresh basket'}</Text></TouchableOpacity></View>}
      {missingItems && <View style={{ marginTop: 16 }}><Notice danger>Some basket items could not be displayed. Refresh your basket before continuing.</Notice></View>}
      {hasPriceChange && <View style={{ marginTop: 16 }}><Notice tone="warning">A shop updated its prices. Review the current prices below before continuing.</Notice></View>}
      {groups.map((group: any, groupIndex: number) => <View key={group.merchant?.id || groupIndex} style={[s.card, { marginTop: 12 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${group.merchant?.shopName || 'shop'}`} onPress={() => group.merchant?.id && navigation.navigate('Shop', { merchantId: group.merchant.id })} style={[s.row, { gap: 8, minHeight: 22 }]}><Icon name="shop" color={colors.primary} size={17} /><Text style={[s.body, { fontSize: 13, fontWeight: '700', flex: 1 }]}>{group.merchant?.shopName || 'Shop unavailable'}</Text></TouchableOpacity>
        <Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 8 }]}>Prepared & delivered by this shop</Text>
        {(group.items ?? []).map((item: any) => <View key={item.id} style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.border }}>
          <View style={[s.row, { gap: 11 }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.name}`} onPress={() => navigation.navigate('Product', { productId: item.productId, merchantProductId: item.merchantProductId })} style={{ width: 58, height: 61, borderRadius: 12, overflow: 'hidden' }}><ProductArtwork uri={item.imageUrl} name={item.name} size={61} /></TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.name} details`} onPress={() => navigation.navigate('Product', { productId: item.productId, merchantProductId: item.merchantProductId })}><Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: 3 }}>{item.name}</Text></TouchableOpacity>
              <Text style={s.muted}>{[item.size, item.unit].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' · ') || 'View pack details'}</Text>
              <View style={[s.row, { alignSelf: 'flex-start', marginTop: 7, borderRadius: 9, backgroundColor: colors.emeraldBg }]}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Decrease ${item.name} quantity`} disabled={busy || refreshing} onPress={() => void setQty(item.id, item.quantity - 1)} style={{ width: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Icon name="minus" size={15} color={colors.primary} /></TouchableOpacity>
                <Text accessibilityLabel={`${item.quantity} in basket`} style={{ minWidth: 15, textAlign: 'center', color: colors.primary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{item.quantity}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Increase ${item.name} quantity`} accessibilityState={{ disabled: busy || refreshing || (isAmount(item.stockQuantity) && item.quantity >= item.stockQuantity) }} disabled={busy || refreshing || (isAmount(item.stockQuantity) && item.quantity >= item.stockQuantity)} onPress={() => void setQty(item.id, item.quantity + 1)} style={{ width: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: isAmount(item.stockQuantity) && item.quantity >= item.stockQuantity ? 0.4 : 1 }}><Icon name="plus" size={15} color={colors.primary} /></TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', lineHeight: 20, color: colors.text, fontVariant: ['tabular-nums'] }}>{pkr(item.totalPaisa)}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} disabled={busy || refreshing} onPress={() => void remove(item.id)} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Remove</Text></TouchableOpacity></View>
          </View>
          {item.inStock === false && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{isAmount(item.stockQuantity) ? `Requested ${item.quantity} · available ${item.stockQuantity}. ` : ''}Reduce the quantity or remove this item.</Text>}
          {item.priceChanged && <Text style={{ color: colors.amber, fontSize: 11, lineHeight: 16, marginTop: 8 }}>Price changed · {pkr(item.unitPricePaisa)} each</Text>}
        </View>)}
        <View style={[s.spread, { gap: 12, marginTop: 12 }]}><Text style={[s.muted, { flex: 1 }]}>Shop delivery{deliveryDiscount ? ' before offers' : ''}</Text><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(group.deliveryFeePaisa)}</Text></View>
        {belowMinimum(group) && <View style={{ marginTop: 12 }}><Notice tone="warning">This shop’s minimum is {pkr(group.merchant.minimumOrderValuePaisa)}. Add {pkr(group.merchant.minimumOrderValuePaisa - group.subtotalPaisa)} more from this shop to continue.</Notice></View>}
        {closed(group) && <View style={{ marginTop: 12 }}><Notice tone="warning">This shop is not accepting orders now. Its items stay in your basket; remove them or check again when the shop opens.</Notice></View>}
        {(belowMinimum(group) || closed(group)) && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Shop', { merchantId: group.merchant.id })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>View shop</Text></TouchableOpacity>}
      </View>)}
      <View style={[s.card, { marginTop: 16, padding: 0, overflow: 'hidden' }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: couponOpen }} onPress={() => setCouponOpen(!couponOpen)} style={[s.row, { minHeight: 61, paddingVertical: 15, paddingHorizontal: 14, gap: 12 }]}><Icon name="ticket" color={colors.primary} size={21} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>Have a promo code?</Text><Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>{cart.couponCode ? `${cart.couponCode} · ${cart.couponError || 'applied'}` : 'Apply a code to check eligibility'}</Text></View><Icon name="chevron" size={21} /></TouchableOpacity>
        {couponOpen && <View style={{ padding: 14, paddingTop: 0, gap: 12 }}><TextInput ref={couponInput} accessibilityLabel="Promo code" style={s.input} placeholder="Promo code" placeholderTextColor={colors.faint} autoCapitalize="characters" value={coupon} onChangeText={(value) => setCoupon(value.toUpperCase())} editable={!busy} /><TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy || refreshing} onPress={() => void applyCoupon()}><Text style={s.btnGhostText}>Apply code</Text></TouchableOpacity>{!!cart.couponCode && canRemoveCoupon && <TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy || refreshing} onPress={() => void mutate(() => api.del('/cart/remove-coupon'), 'Check whether the code is still applied before retrying.')}><Text style={s.btnGhostText}>Remove promo code</Text></TouchableOpacity>}</View>}
      </View>
      {!!cart.couponError && <View style={{ marginTop: 12 }}><Notice danger>{cart.couponError} {canRemoveCoupon ? 'Apply another eligible code or remove this code before placing an order.' : 'Apply another eligible code. After signing in, you can also remove it from your basket.'}</Notice></View>}
      {!!mutationError && <View style={{ marginTop: 12 }}><Notice danger>{mutationError}</Notice></View>}
      <View style={{ marginTop: 16 }}><OrderSummary cart={cart} title="" /></View>
      {deliveryDiscount && <Text style={[s.muted, { marginTop: 12 }]}>Delivery offers are included in the total. Individual shop fees above are before these offers.</Text>}
      <Text style={[s.muted, { marginTop: 16, textAlign: 'center' }]}>No account needed to build your basket.</Text>
    </ScrollView>
    <ActionDock>
      <View style={[s.spread, { gap: 12, marginBottom: 10 }]}><Text style={s.muted}>{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · total</Text><Text style={{ color: colors.text, fontSize: 20, letterSpacing: -0.6, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(cart.totalPaisa)}</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: checkoutBlocked }} disabled={checkoutBlocked} onPress={() => navigation.navigate('Checkout')} style={[s.btn, s.row, { justifyContent: 'center', gap: 9, opacity: checkoutBlocked ? 0.6 : 1 }]}>{(busy || refreshing) && <ActivityIndicator color="#fff" size="small" />}<Text style={s.btnText}>{busy || refreshing ? 'Updating basket…' : 'Continue to checkout'}</Text>{!busy && !refreshing && <Icon name="arrow" size={18} color="#fff" />}</TouchableOpacity>
    </ActionDock>
  </View>;
}
