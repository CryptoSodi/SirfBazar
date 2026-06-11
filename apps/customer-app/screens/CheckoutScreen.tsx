import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, fetchCart, getLocation, isLoggedIn, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

const METHODS = [
  ['COD', '💵 Cash on delivery'],
  ['JAZZCASH', '📱 JazzCash'],
  ['EASYPAISA', '📲 EasyPaisa'],
  ['CARD', '💳 Card'],
] as const;

export default function CheckoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cart, setCart] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('COD');
  const [showLogin, setShowLogin] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoggedIn(await isLoggedIn());
    fetchCart().then(setCart).catch(() => undefined);
    if (await isLoggedIn()) {
      try {
        const addrs = await api.get('/customer/addresses');
        setAddresses(addrs);
        const def = addrs.find((a: any) => a.isDefault) ?? addrs[0];
        if (def) setAddressId(def.id);
      } catch {
        /* fresh customer */
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveAddress = async () => {
    if (!newAddress.trim()) return;
    const loc = await getLocation();
    const created = await api.post('/customer/addresses', {
      label: 'Home',
      fullAddress: newAddress.trim(),
      city: 'Lahore',
      latitude: loc.latitude,
      longitude: loc.longitude,
      isDefault: true,
    });
    setAddresses((prev) => [...prev, created]);
    setAddressId(created.id);
    setNewAddress('');
  };

  const placeOrder = async () => {
    if (!loggedIn) {
      setShowLogin(true);
      return;
    }
    if (!addressId) {
      alert('Add a delivery address first.');
      return;
    }
    setBusy(true);
    try {
      const order = await api.post('/orders', { deliveryAddressId: addressId, paymentMethod: method });
      if (order.status === 'PAYMENT_PENDING') {
        const init = await api.post(`/payments/order/${order.id}/initiate`);
        await api.post(`/payments/${init.paymentId}/confirm`, {});
      }
      navigation.replace('OrderDetail', { orderId: order.id });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cart) return <Text style={[s.muted, s.pad]}>Loading…</Text>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <Text style={s.h2}>Delivery address</Text>
      {!loggedIn ? (
        <Text style={[s.muted, { marginTop: 6 }]}>You will add your address after a quick login below.</Text>
      ) : (
        <View style={{ marginTop: 8, gap: 8 }}>
          {addresses.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[s.card, addressId === a.id && { borderColor: colors.primary, backgroundColor: colors.emeraldBg }]}
              onPress={() => setAddressId(a.id)}
            >
              <Text style={[s.body, { fontWeight: '700' }]}>{a.label}</Text>
              <Text style={s.muted}>{a.fullAddress}</Text>
            </TouchableOpacity>
          ))}
          <View style={[s.row, { gap: 8 }]}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="New address (house, street, area)"
              value={newAddress}
              onChangeText={setNewAddress}
            />
            <TouchableOpacity style={s.btnGhost} onPress={saveAddress}>
              <Text style={s.btnGhostText}>Save</Text>
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
