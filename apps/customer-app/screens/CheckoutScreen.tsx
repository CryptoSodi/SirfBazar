import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, fetchCart, isLoggedIn, pkr } from '../lib/api';
import { detectCurrentLocation, LocationPermissionError } from '../lib/location';
import { useTheme } from '../lib/theme';
import { toast } from '../components/Toast';
import { refreshBadges } from '../lib/badges';

const METHODS = [
  ['COD', '💵 Cash on delivery'],
  ['JAZZCASH', '📱 JazzCash'],
  ['EASYPAISA', '📲 EasyPaisa'],
  ['CARD', '💳 Card'],
] as const;

const ADDR_ICONS: Record<string, string> = { Home: '🏠', Work: '💼', Family: '❤️' };
const addrIcon = (label?: string) => (label && ADDR_ICONS[label]) || '📍';

export default function CheckoutScreen() {
  const { colors, s } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
  const [cart, setCart] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('COD');
  const [showLogin, setShowLogin] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoggedIn(await isLoggedIn());
    fetchCart().then(setCart).catch(() => undefined);
    refreshBadges(); // cart may have merged on login
    if (await isLoggedIn()) {
      try {
        const addrs = await api.get('/customer/addresses');
        setAddresses(addrs);
        // Default to the default address, but never clobber an existing choice
        // (e.g. one the user just picked or returned from the editor with).
        setAddressId((cur) => cur || (addrs.find((a: any) => a.isDefault) ?? addrs[0])?.id || '');
      } catch {
        /* fresh customer */
      }
    }
  }, []);

  // Reload on focus so a newly added address shows up when returning here.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // When the address editor sends us back, select the address just saved.
  useEffect(() => {
    const sel = route.params?.selectedAddressId;
    if (sel) setAddressId(sel);
  }, [route.params?.selectedAddressId]);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const loc = await detectCurrentLocation();
      navigation.navigate('AddressEdit', {
        fromCheckout: true,
        prefill: {
          fullAddress: loc.fullAddress,
          area: loc.area,
          city: loc.city,
          province: loc.province,
          latitude: loc.latitude,
          longitude: loc.longitude,
        },
      });
    } catch (e: any) {
      toast(e instanceof LocationPermissionError ? e.message : 'Could not get your location. Try again outdoors.');
    } finally {
      setLocating(false);
    }
  };

  const placeOrder = async () => {
    if (!loggedIn) {
      setShowLogin(true);
      return;
    }
    if (!addressId) {
      toast('Add a delivery address first.');
      return;
    }
    setBusy(true);
    try {
      const order = await api.post('/orders', { deliveryAddressId: addressId, paymentMethod: method });
      if (order.status === 'PAYMENT_PENDING') {
        const init = await api.post(`/payments/order/${order.id}/initiate`);
        await api.post(`/payments/${init.paymentId}/confirm`, {});
      }
      refreshBadges(); // cart emptied, an order is now active
      navigation.replace('OrderDetail', { orderId: order.id });
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cart) return <Text style={[s.muted, s.pad]}>Loading…</Text>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <Text style={s.h2}>Delivery address</Text>
      {!loggedIn ? (
        <Text style={[s.muted, { marginTop: 6 }]}>You will choose your address after a quick login below.</Text>
      ) : (
        <View style={{ marginTop: 8, gap: 8 }}>
          {addresses.length === 0 && (
            <Text style={s.muted}>No saved addresses yet — use your current location or add one.</Text>
          )}
          {addresses.map((a) => {
            const active = addressId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.card, s.row, { gap: 10 }, active && { borderColor: colors.primary, backgroundColor: colors.emeraldBg }]}
                onPress={() => setAddressId(a.id)}
              >
                <Text style={{ fontSize: 20 }}>{addrIcon(a.label)}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[s.row, { gap: 8 }]}>
                    <Text style={[s.body, { fontWeight: '700' }]}>{a.label}</Text>
                    {a.isDefault && (
                      <Text style={[s.chip, { backgroundColor: colors.emeraldBg, color: colors.primary, fontWeight: '700' }]}>Default</Text>
                    )}
                  </View>
                  <Text style={s.muted} numberOfLines={2}>{a.fullAddress}</Text>
                </View>
                <Text style={{ color: active ? colors.primary : colors.faint, fontWeight: '900', fontSize: 16 }}>{active ? '●' : '○'}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[s.row, { gap: 8 }]}>
            <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={useCurrentLocation} disabled={locating}>
              {locating ? <ActivityIndicator color={colors.primary} /> : <Text style={s.btnGhostText}>📍 Use current location</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => navigation.navigate('AddressEdit', { fromCheckout: true })}>
              <Text style={s.btnGhostText}>➕ Add new</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={[s.h2, { marginTop: 18 }]}>Payment method</Text>
      <View style={{ marginTop: 8, gap: 8 }}>
        {METHODS.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[s.card, method === id && { borderColor: colors.primary, backgroundColor: colors.emeraldBg }]}
            onPress={() => setMethod(id)}
          >
            <Text style={s.body}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.card, { marginTop: 18 }]}>
        <View style={s.spread}>
          <Text style={s.muted}>Items ({cart.itemCount})</Text>
          <Text style={s.body}>{pkr(cart.subtotalPaisa)}</Text>
        </View>
        <View style={s.spread}>
          <Text style={s.muted}>Delivery + fees</Text>
          <Text style={s.body}>{pkr(cart.deliveryFeePaisa + cart.serviceFeePaisa + cart.smallOrderFeePaisa)}</Text>
        </View>
        {cart.discountPaisa > 0 && (
          <View style={s.spread}>
            <Text style={{ color: colors.primary, fontSize: 12 }}>Discount</Text>
            <Text style={{ color: colors.primary }}>−{pkr(cart.discountPaisa)}</Text>
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderColor: colors.border, marginVertical: 8 }} />
        <View style={s.spread}>
          <Text style={[s.body, { fontWeight: '800' }]}>To pay</Text>
          <Text style={[s.body, { fontWeight: '800' }]}>{pkr(cart.totalPaisa)}</Text>
        </View>
      </View>

      <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={placeOrder} disabled={busy}>
        <Text style={s.btnText}>{busy ? 'Placing order…' : loggedIn ? 'Place order' : 'Login & place order'}</Text>
      </TouchableOpacity>

      <LoginSheet
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => {
          setShowLogin(false);
          refresh();
        }}
      />
    </ScrollView>
  );
}
