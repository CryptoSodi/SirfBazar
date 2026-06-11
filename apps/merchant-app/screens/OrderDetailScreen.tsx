import { RouteProp, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function OrderDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const [order, setOrder] = useState<any>(null);
  const [riderPicker, setRiderPicker] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/merchant/orders/${route.params.orderId}`).then(setOrder).catch(() => undefined);
  }, [route.params.orderId]);

  useEffect(load, [load]);

  const act = async (action: string, body?: any) => {
    setBusy(true);
    try {
      await api.post(`/merchant/orders/${route.params.orderId}/${action}`, body ?? {});
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openRiderPicker = async () => {
    try {
      const list = await api.get('/merchant/riders');
      setRiders((Array.isArray(list) ? list : list.items ?? []).filter((r: any) => r.isActive));
      setRiderPicker(true);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!order) return <Text style={[s.muted, s.pad]}>Loading order…</Text>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
      <View style={s.spread}>
        <Text style={s.h1}>{order.orderNumber}</Text>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>{pkr(order.totalAmountPaisa)}</Text>
      </View>
      <Text style={{ color: colors.amber, fontWeight: '800', textTransform: 'capitalize', marginTop: 2 }}>
        {statusLabel(order.status)} · {order.paymentMethod}
      </Text>

      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={s.h2}>Items</Text>
        {(order.items ?? []).map((it: any) => (
          <View key={it.id} style={[s.spread, { marginTop: 8 }]}>
            <Text style={[s.body, { flex: 1 }, it.itemStatus !== 'CONFIRMED' && { textDecorationLine: 'line-through', color: colors.faint }]}>
              {it.quantity} × {it.productNameSnapshot}
            </Text>
            <Text style={{ fontWeight: '700' }}>{pkr(it.totalPricePaisa)}</Text>
          </View>
        ))}
        {order.customerNote && (
          <Text style={[s.muted, { marginTop: 10 }]}>📝 Customer note: {order.customerNote}</Text>
        )}
      </View>

      <View style={[s.card, { marginTop: 10 }]}>
        <Text style={s.h2}>Deliver to</Text>
        <Text style={[s.body, { marginTop: 4 }]}>{order.customer?.user?.fullName ?? 'Customer'}</Text>
        <Text style={s.muted}>{order.deliveryAddress?.fullAddress}</Text>
        <Text style={s.muted}>{order.customer?.user?.phoneNumber}</Text>
        {order.rider && <Text style={[s.body, { marginTop: 6 }]}>🛵 Rider: {order.rider.fullName}</Text>}
      </View>

      {/* Lifecycle actions */}
      <View style={{ marginTop: 14, gap: 8 }}>
        {order.status === 'SENT_TO_MERCHANT' && (
          <>
            <TouchableOpacity style={s.btn} onPress={() => act('accept')} disabled={busy}>
              <Text style={s.btnText}>✓ Accept order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnDanger}
              onPress={() => act('reject', { reason: 'Unable to fulfil right now' })}
              disabled={busy}
            >
              <Text style={s.btnDangerText}>✗ Reject order</Text>
            </TouchableOpacity>
          </>
        )}
        {order.status === 'MERCHANT_ACCEPTED' && (
          <TouchableOpacity style={s.btn} onPress={() => act('preparing')} disabled={busy}>
            <Text style={s.btnText}>👨‍🍳 Start preparing</Text>
          </TouchableOpacity>
        )}
        {['MERCHANT_ACCEPTED', 'PREPARING'].includes(order.status) && (
          <TouchableOpacity style={s.btn} onPress={() => act('ready')} disabled={busy}>
            <Text style={s.btnText}>📦 Mark ready for pickup</Text>
          </TouchableOpacity>
        )}
        {order.status === 'READY_FOR_PICKUP' && (
          <TouchableOpacity style={s.btn} onPress={openRiderPicker} disabled={busy}>
            <Text style={s.btnText}>🛵 Assign rider</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Timeline */}
      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={s.h2}>Timeline</Text>
        {(order.timeline ?? []).map((t: any) => (
          <Text key={t.id} style={[s.faint, { marginTop: 4 }]}>
            • {statusLabel(t.status)} — {new Date(t.createdAt).toLocaleTimeString()} {t.notes ? `(${t.notes})` : ''}
          </Text>
        ))}
      </View>

      {/* Rider picker */}
      <Modal visible={riderPicker} transparent animationType="slide" onRequestClose={() => setRiderPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' }}>
            <Text style={s.h2}>Choose a rider</Text>
            <Text style={[s.muted, { marginBottom: 12 }]}>Only your own riders can deliver your orders.</Text>
            <ScrollView>
              {riders.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.card, { marginBottom: 8 }]}
                  onPress={async () => {
                    setRiderPicker(false);
                    await act('assign-rider', { riderId: r.id });
                  }}
                >
                  <Text style={[s.body, { fontWeight: '700' }]}>🛵 {r.fullName}</Text>
                  <Text style={s.faint}>
                    {r.phoneNumber} · {r.isOnline ? '🟢 online' : '⚪ offline'} · {r.currentStatus.toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              {riders.length === 0 && <Text style={s.muted}>No active riders — add one in the Riders tab.</Text>}
            </ScrollView>
            <TouchableOpacity style={[s.btnGhost, { marginTop: 8 }]} onPress={() => setRiderPicker(false)}>
              <Text style={s.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
