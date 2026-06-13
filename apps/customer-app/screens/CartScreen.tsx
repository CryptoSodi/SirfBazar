import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, cartBase, fetchCart, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';
import { toast } from '../components/Toast';

export default function CartScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cart, setCart] = useState<any>(null);
  const [coupon, setCoupon] = useState('');

  const load = useCallback(() => {
    fetchCart().then(setCart).catch(() => undefined);
  }, []);

  useFocusEffect(load);

  const setQty = async (itemId: string, quantity: number) => {
    try {
      setCart(await api.put(`${await cartBase()}/items/${itemId}`, { quantity }));
    } catch (e: any) {
      toast(e.message);
    }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      setCart(await api.post(`${await cartBase()}/apply-coupon`, { code: coupon.trim() }));
    } catch (e: any) {
      toast(e.message);
    }
  };

  if (!cart) return <Text style={[s.muted, s.pad]}>Loading cart…</Text>;

  if ((cart.groups ?? []).length === 0) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <View style={[s.pad, { alignItems: 'center', marginTop: 60 }]}>
          <Text style={{ fontSize: 40 }}>🛒</Text>
          <Text style={[s.h2, { marginTop: 8 }]}>Your cart is empty</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>Browse nearby shops and add something.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
        <Text style={s.h1}>Your cart</Text>

        {cart.groups.map((g: any) => (
          <View key={g.merchant.id} style={[s.card, { marginTop: 12 }]}>
            <View style={s.spread}>
              <Text style={[s.body, { fontWeight: '700' }]}>🏪 {g.merchant.shopName}</Text>
              <Text style={s.faint}>Delivery {pkr(g.deliveryFeePaisa)}</Text>
            </View>
            {g.items.map((item: any) => (
              <View key={item.id} style={[s.spread, { marginTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.body} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.faint}>{pkr(item.unitPricePaisa)} each</Text>
                </View>
                <View style={[s.row, { gap: 10 }]}>
                  <TouchableOpacity onPress={() => setQty(item.id, item.quantity - 1)} style={qtyBtn}>
                    <Text style={{ fontWeight: '800' }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '700' }}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => setQty(item.id, item.quantity + 1)} style={qtyBtn}>
                    <Text style={{ fontWeight: '800' }}>+</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '800', width: 70, textAlign: 'right' }}>{pkr(item.totalPaisa)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Coupon */}
        <View style={[s.row, { gap: 8, marginTop: 12 }]}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Coupon code"
            autoCapitalize="characters"
            value={coupon}
            onChangeText={(v) => setCoupon(v.toUpperCase())}
          />
          <TouchableOpacity style={s.btnGhost} onPress={applyCoupon}>
            <Text style={s.btnGhostText}>Apply</Text>
          </TouchableOpacity>
        </View>
        {cart.couponCode && (
          <Text style={{ color: cart.couponError ? colors.danger : colors.primary, fontSize: 12, marginTop: 6 }}>
            🎟️ {cart.couponCode} {cart.couponError ? `— ${cart.couponError}` : 'applied'}
          </Text>
        )}

        {/* Bill */}
        <View style={[s.card, { marginTop: 12 }]}>
          <Bill label="Subtotal" value={cart.subtotalPaisa} />
          <Bill label="Delivery fee" value={cart.deliveryFeePaisa} />
          <Bill label="Service fee" value={cart.serviceFeePaisa} />
          {cart.smallOrderFeePaisa > 0 && <Bill label="Small order fee" value={cart.smallOrderFeePaisa} />}
          {cart.discountPaisa > 0 && <Bill label="Discount" value={-cart.discountPaisa} accent />}
          <View style={{ borderTopWidth: 1, borderColor: colors.border, marginVertical: 8 }} />
          <View style={s.spread}>
            <Text style={[s.body, { fontWeight: '800' }]}>To pay</Text>
            <Text style={[s.body, { fontWeight: '800' }]}>{pkr(cart.totalPaisa)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[s.btn, { marginTop: 14 }]} onPress={() => navigation.navigate('Checkout')}>
          <Text style={s.btnText}>Proceed to checkout →</Text>
        </TouchableOpacity>
        <Text style={[s.faint, { textAlign: 'center', marginTop: 8 }]}>Login is only needed at the final step.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const qtyBtn = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  width: 28,
  height: 28,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function Bill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[s.spread, { marginTop: 4 }]}>
      <Text style={s.muted}>{label}</Text>
      <Text style={[s.body, accent && { color: colors.primary, fontWeight: '700' }]}>{pkr(value)}</Text>
    </View>
  );
}
