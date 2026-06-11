import { RouteProp, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';

const ACTIVE = ['RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP', 'PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'];

export default function DeliveryScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Delivery'>>();
  const [order, setOrder] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.get(`/rider/orders/${route.params.orderId}`).then(setOrder).catch((e) => alert(e.message));
  }, [route.params.orderId]);

  useEffect(load, [load]);

  // Live location pings while the delivery is active (spec 13.8).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const ping = async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await api.post('/rider/location', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
            orderId: route.params.orderId,
          });
        } catch {
          /* offline blips are fine */
        }
      };
      ping();
      pingTimer.current = setInterval(ping, 15000);
    })();
    return () => {
      cancelled = true;
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [route.params.orderId]);

  const act = async (action: string, body?: any) => {
    setBusy(true);
    try {
      await api.post(`/rider/orders/${route.params.orderId}/${action}`, body ?? {});
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const navigate = (lat?: number, lng?: number, label?: string) => {
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  };

  if (!order) return <Text style={[s.muted, s.pad]}>Loading delivery…</Text>;

  const done = !ACTIVE.includes(order.status);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <View style={s.spread}>
        <Text style={s.h1}>{order.orderNumber}</Text>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>{pkr(order.totalAmountPaisa)}</Text>
      </View>
      <Text style={{ color: done ? colors.primary : colors.amber, fontWeight: '800', textTransform: 'capitalize', marginTop: 2 }}>
        {statusLabel(order.status)}
      </Text>
      {order.paymentMethod === 'COD' && !done && (
        <View style={[s.card, { marginTop: 10, backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
          <Text style={{ color: colors.amber, fontWeight: '800' }}>💵 Collect {pkr(order.totalAmountPaisa)} in cash on delivery</Text>
        </View>
      )}

      {/* Pickup */}
      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={s.h2}>1 · Pickup</Text>
        <Text style={[s.body, { marginTop: 4, fontWeight: '700' }]}>{order.merchant?.shopName}</Text>
        <Text style={s.muted}>{order.merchant?.address}</Text>
        <TouchableOpacity
          style={[s.btnGhost, { marginTop: 8 }]}
          onPress={() => navigate(order.merchant?.latitude, order.merchant?.longitude)}
        >
          <Text style={s.btnGhostText}>🗺️ Navigate to shop</Text>
        </TouchableOpacity>
      </View>

      {/* Drop-off */}
      <View style={[s.card, { marginTop: 10 }]}>
        <Text style={s.h2}>2 · Drop-off</Text>
        <Text style={[s.body, { marginTop: 4, fontWeight: '700' }]}>{order.customer?.user?.fullName ?? 'Customer'}</Text>
        <Text style={s.muted}>{order.deliveryAddress?.fullAddress}</Text>
        {order.deliveryAddress?.instructions && (
          <Text style={[s.muted, { fontStyle: 'italic' }]}>📝 {order.deliveryAddress.instructions}</Text>
        )}
        <View style={[s.row, { gap: 8, marginTop: 8 }]}>
          <TouchableOpacity
            style={[s.btnGhost, { flex: 1 }]}
            onPress={() => navigate(order.deliveryAddress?.latitude, order.deliveryAddress?.longitude)}
          >
            <Text style={s.btnGhostText}>🗺️ Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnGhost, { flex: 1 }]}
            onPress={() => order.customer?.user?.phoneNumber && Linking.openURL(`tel:${order.customer.user.phoneNumber}`)}
          >
            <Text style={s.btnGhostText}>📞 Call customer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Items */}
      <View style={[s.card, { marginTop: 10 }]}>
        <Text style={s.h2}>Items to deliver</Text>
        {(order.items ?? []).map((it: any) => (
          <Text key={it.id} style={[s.body, { marginTop: 4 }]}>
            • {it.quantity} × {it.productNameSnapshot}
          </Text>
        ))}
      </View>

      {/* Actions */}
      <View style={{ marginTop: 14, gap: 8 }}>
        {order.status === 'RIDER_ASSIGNED' && (
          <TouchableOpacity style={s.btn} onPress={() => act('arrived-shop')} disabled={busy}>
            <Text style={s.btnText}>🏪 I have arrived at the shop</Text>
          </TouchableOpacity>
        )}
        {['RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP'].includes(order.status) && (
          <TouchableOpacity style={s.btn} onPress={() => act('picked-up')} disabled={busy}>
            <Text style={s.btnText}>📦 Order picked up — start delivery</Text>
          </TouchableOpacity>
        )}
        {order.status === 'ON_THE_WAY' && (
          <TouchableOpacity style={s.btn} onPress={() => act('arrived-customer')} disabled={busy}>
            <Text style={s.btnText}>🏠 I have arrived at the customer</Text>
          </TouchableOpacity>
        )}
        {['ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'].includes(order.status) && (
          <View style={[s.card, { borderColor: colors.primary }]}>
            <Text style={s.h2}>Complete delivery</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>Ask the customer for their 4-digit delivery code.</Text>
            <TextInput
              style={[s.input, { marginTop: 10, textAlign: 'center', fontSize: 24, letterSpacing: 12 }]}
              keyboardType="number-pad"
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
            />
            <TouchableOpacity
              style={[s.btn, { marginTop: 10 }]}
              onPress={() => act('delivered', { otp })}
              disabled={busy || otp.length < 4}
            >
              <Text style={s.btnText}>✅ Mark delivered</Text>
            </TouchableOpacity>
          </View>
        )}
        {!done && (
          <TouchableOpacity
            style={s.btnDanger}
            onPress={async () => {
              await act('report-issue', { description: 'Issue during delivery — needs support attention' });
              alert('Issue reported to the shop and support.');
            }}
          >
            <Text style={s.btnDangerText}>⚠️ Report an issue</Text>
          </TouchableOpacity>
        )}
        {order.status === 'DELIVERED' && (
          <View style={[s.card, { alignItems: 'center', backgroundColor: colors.emeraldBg, borderColor: colors.primary }]}>
            <Text style={{ fontSize: 32 }}>🎉</Text>
            <Text style={[s.h2, { color: colors.primary }]}>Delivery completed!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
