import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { api, cartBase } from '../lib/api';
import { useTheme } from '../lib/theme';
import { refreshBadges, useBadges } from '../lib/badges';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { assertProductCanBeAdded, BasketItemSnapshot, pendingBasketAddKey, readConfirmedBasketItem } from '../lib/product-purchase';

const changingOffers = new Set<string>();

/**
 * The reference Add/quantity control uses confirmed server cart state. Guest and
 * authenticated shoppers keep the same cart endpoints and merge behavior.
 */
export function AddButton({
  productId,
  merchantProductId,
  outOfStock,
  onAdded,
  full = false,
  label,
}: {
  productId: string;
  merchantProductId: string;
  outOfStock?: boolean;
  onAdded?: () => void;
  full?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  const badgeItem = useBadges().cartItems[merchantProductId];
  const [confirmedItem, setConfirmedItem] = useState<BasketItemSnapshot | null | undefined>();
  const item = confirmedItem === undefined ? badgeItem : confirmedItem;
  const [state, setState] = useState<'idle' | 'adding'>('idle');
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [needsCheck, setNeedsCheck] = useState(false);
  const unresolved = useRef<{ cartId: string; key?: string } | null>(null);
  const scopeVersion = useRef(0);
  useEffect(() => { setConfirmedItem(undefined); }, [badgeItem?.id, badgeItem?.quantity]);
  useEffect(() => subscribeCustomerEvent('auth', () => {
    scopeVersion.current++;
    setConfirmedItem(undefined); setNeedsCheck(false); setError(''); unresolved.current = null;
  }), []);

  const reconcile = async (cartId?: string, key?: string) => {
    const version = scopeVersion.current;
    const snapshot = await readConfirmedBasketItem(merchantProductId, cartId);
    if (version !== scopeVersion.current) throw new Error('Your account changed. Check your basket again.');
    if (key) await AsyncStorage.removeItem(key);
    setConfirmedItem(snapshot.item);
    setNeedsCheck(false); unresolved.current = null;
    void refreshBadges();
    return snapshot.item;
  };
  const checkBasket = async () => {
    if (pending.current || changingOffers.has(merchantProductId)) return;
    pending.current = true; setState('adding');
    try {
      const snapshot = await readConfirmedBasketItem(merchantProductId, unresolved.current?.cartId);
      const key = unresolved.current?.key ?? pendingBasketAddKey(snapshot.cartId, merchantProductId);
      const current = await reconcile(snapshot.cartId, key);
      setError(`Basket checked: ${current?.quantity ?? 0} in your basket. Review this quantity before adding again.`);
    } catch {
      setNeedsCheck(true);
      setError('The basket is not confirmed yet. Check your basket before adding again.');
    } finally { pending.current = false; setState('idle'); }
  };

  const add = async () => {
    if (needsCheck) { await checkBasket(); return; }
    if (pending.current || changingOffers.has(merchantProductId) || outOfStock || !merchantProductId) return;
    pending.current = true;
    changingOffers.add(merchantProductId);
    const version = scopeVersion.current;
    setError('');
    setState('adding');
    let attempted = false;
    let cartId: string | undefined;
    let key: string | undefined;
    try {
      await assertProductCanBeAdded(productId);
      const snapshot = await readConfirmedBasketItem(merchantProductId);
      cartId = snapshot.cartId;
      key = pendingBasketAddKey(cartId, merchantProductId);
      if (await AsyncStorage.getItem(key)) {
        unresolved.current = { cartId, key }; setNeedsCheck(true);
        setError('An earlier addition needs a basket check. No new item was added.');
        return;
      }
      if (snapshot.item) {
        setConfirmedItem(snapshot.item);
        setError('This item is already in your basket. Review the current quantity before adding more.');
        void refreshBadges(); return;
      }
      const base = await cartBase();
      if (version !== scopeVersion.current) throw new Error('Your account changed. Check your basket again.');
      await AsyncStorage.setItem(key, JSON.stringify({ cartId, merchantProductId, at: Date.now() }));
      if (version !== scopeVersion.current) { await AsyncStorage.removeItem(key); throw new Error('Your account changed. Check your basket again.'); }
      attempted = true;
      await api.post(`${base}/items`, { merchantProductId, quantity: 1 });
      const current = await reconcile(cartId, key);
      if (current) onAdded?.();
      else setError('The checked basket does not show this item. Review your basket before adding again.');
    } catch (e: any) {
      if (attempted && version === scopeVersion.current) {
        unresolved.current = { cartId: cartId!, key }; setNeedsCheck(true);
        try {
          const current = await reconcile(cartId, key);
          setError(`The Add response was not confirmed. Basket checked: ${current?.quantity ?? 0} in your basket. Review before adding again.`);
        } catch {
          setError('The Add response was not confirmed. Check your basket before adding again.');
        }
      } else setError(e?.message ?? 'Could not add this item.');
    } finally {
      setState('idle');
      pending.current = false;
      changingOffers.delete(merchantProductId);
    }
  };

  const changeQuantity = async (quantity: number) => {
    if (!item || pending.current || needsCheck || changingOffers.has(merchantProductId)) return;
    pending.current = true;
    changingOffers.add(merchantProductId);
    setError('');
    setState('adding');
    let attempted = false;
    try {
      if (quantity > item.quantity) await assertProductCanBeAdded(productId);
      attempted = true;
      await api.put(`${await cartBase()}/items/${item.id}`, { quantity });
      const current = await reconcile();
      if ((current?.quantity ?? 0) === quantity) onAdded?.();
      else setError(`The current quantity is ${current?.quantity ?? 0}. Review your basket before changing it again.`);
    } catch (e: any) {
      if (attempted) {
        setNeedsCheck(true);
        try {
          const current = await reconcile();
          setError(`Check the current quantity: ${current?.quantity ?? 0} in your basket.`);
        } catch { setError('The quantity could not be confirmed. Check your basket before changing it again.'); }
      } else setError(e?.message ?? 'Could not check this product.');
    } finally {
      setState('idle');
      pending.current = false;
      changingOffers.delete(merchantProductId);
    }
  };

  if (needsCheck) return <View style={{ width: full ? '100%' : undefined }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Check basket" disabled={state !== 'idle'} onPress={() => void checkBasket()} style={{ backgroundColor: colors.emeraldBg, borderRadius: full ? 13 : 9, minHeight: full ? 52 : 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' }}>
      {state === 'adding' ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: full ? 15 : 12, fontWeight: '700' }}>Check basket</Text>}
    </TouchableOpacity>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, marginTop: 5 }}>{error}</Text>}
  </View>;

  if (item && item.quantity > 0)
    return (
      <View style={{ width: full ? '100%' : undefined }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.emeraldBg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 9,
          minHeight: full ? 52 : 44,
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          disabled={state !== 'idle'}
          onPress={() => changeQuantity(item.quantity - 1)}
          style={{ width: full ? 52 : 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.primary, fontSize: 17 }}>−</Text>
        </TouchableOpacity>
        {state === 'adding' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.text, fontWeight: '700', fontSize: 12, minWidth: 20, textAlign: 'center' }}
          >
            {item.quantity}
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          disabled={state !== 'idle' || outOfStock}
          onPress={() => changeQuantity(item.quantity + 1)}
          style={{ width: full ? 52 : 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.primary, fontSize: 17 }}>+</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, marginTop: 5 }}>{error}</Text>}
      </View>
    );

  if (outOfStock) {
    return (
      <TouchableOpacity
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={{
          borderRadius: 9,
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: colors.border,
          minWidth: 64,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.faint, fontWeight: '700', fontSize: 12 }}>Unavailable</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ width: full ? '100%' : undefined }}>
      <TouchableOpacity
        onPress={add}
        disabled={state !== 'idle'}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Add to basket"
        style={{
          borderRadius: full ? 13 : 9,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: full ? colors.action : colors.emeraldBg,
          minHeight: full ? 52 : 44,
          minWidth: 52,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state === 'adding' ? (
          <ActivityIndicator size="small" color={full ? '#fff' : colors.primary} />
        ) : (
          <Text style={{ color: full ? '#fff' : colors.primary, fontWeight: '700', fontSize: full ? 15 : 12, textAlign: 'center' }}>
            {label ?? (full ? 'Add to basket' : 'Add +')}
          </Text>
        )}
      </TouchableOpacity>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, marginTop: 5 }}>{error}</Text>}
    </View>
  );
}
