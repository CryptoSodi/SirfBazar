import { RouteProp, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';
import { toast } from '../components/Toast';
import { refreshBadges } from '../lib/badges';

export default function OrderDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const [track, setTrack] = useState<any>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.get(`/orders/${route.params.orderId}/track`).then(setTrack).catch(() => undefined);
  }, [route.params.orderId]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const cancel = async () => {
    try {
      await api.post(`/orders/${route.params.orderId}/cancel`, { reason: 'Changed my mind' });
      load();
      refreshBadges(); // one fewer active order
    } catch (e: any) {
      toast(e.message);
    }
  };

  const rate = async (stars: number) => {
    try {
      await api.post(`/orders/${route.params.orderId}/rate`, { merchantRating: stars, riderRating: stars });
      toast('Thanks for your rating!');
    } catch (e: any) {
      toast(e.message);
    }
  };

  if (!track) return <Text style={[s.muted, s.pad]}>Loading order…</Text>;

  const cancellable = ['CREATED', 'PAYMENT_PENDING', 'SENT_TO_MERCHANT'].includes(track.status);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <View style={s.spread}>
        <Text style={s.h2}>{track.orderNumber}</Text>
        <Text style={{ fontWeight: '800' }}>{pkr(track.totalAmountPaisa)}</Text>
      </View>
      <Text style={{ color: track.status === 'DELIVERED' ? colors.primary : colors.amber, fontWeight: '700', marginTop: 4 }}>
        {statusLabel(track.status)} · {track.paymentStatus?.replace(/_/g, ' ').toLowerCase()}
      </Text>

      {track.deliveries.map((d: any) => (
        <View key={d.orderId} style={[s.card, { marginTop: 12 }]}>
          <View style={s.spread}>
            <Text style={[s.body, { fontWeight: '700' }]}>🏪 {d.merchant?.shopName}</Text>
            <Text style={{ color: colors.amber, fontSize: 12, fontWeight: '700' }}>{statusLabel(d.status)}</Text>
          </View>

          {d.deliveryOtp && (
            <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 14, padding: 14, marginTop: 10, alignItems: 'center', backgroundColor: colors.emeraldBg }}>
              <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                Delivery code — share with the rider
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '900', letterSpacing: 12, color: colors.primaryDark, marginTop: 4 }}>
                {d.deliveryOtp}
              </Text>
            </View>
          )}

          {d.rider && (
            <View style={[s.row, { gap: 10, marginTop: 10 }]}>
              <Text style={{ fontSize: 24 }}>🛵</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.body, { fontWeight: '700' }]}>{d.rider.fullName}</Text>
                <Text style={s.faint}>
                  {d.rider.vehicleType?.toLowerCase()} {d.rider.vehicleNumber && `· ${d.rider.vehicleNumber}`} · {d.rider.phoneNumber}
                </Text>
                {d.riderLocation && (
                  <Text style={[s.faint, { color: colors.primary }]}>
                    📍 Live: {d.riderLocation.latitude.toFixed(4)}, {d.riderLocation.longitude.toFixed(4)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {d.estimatedDeliveryMinutes && d.status !== 'DELIVERED' && (
            <Text style={[s.faint, { marginTop: 8 }]}>Estimated ~{d.estimatedDeliveryMinutes} min from order time</Text>
          )}

          <View style={{ marginTop: 10 }}>
            {(d.timeline ?? []).slice(-5).map((t: any) => (
              <Text key={t.id} style={s.faint}>
                • {statusLabel(t.status)} — {new Date(t.createdAt).toLocaleTimeString()}
              </Text>
            ))}
          </View>
        </View>
      ))}

      {cancellable && (
        <TouchableOpacity style={[s.btnGhost, { marginTop: 14 }]} onPress={cancel}>
          <Text style={[s.btnGhostText, { color: colors.danger }]}>Cancel order</Text>
        </TouchableOpacity>
      )}

      {track.status === 'DELIVERED' && (
        <View style={[s.card, { marginTop: 14, alignItems: 'center' }]}>
          <Text style={s.body}>How was it?</Text>
          <View style={[s.row, { gap: 8, marginTop: 8 }]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => rate(n)}>
                <Text style={{ fontSize: 26 }}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
