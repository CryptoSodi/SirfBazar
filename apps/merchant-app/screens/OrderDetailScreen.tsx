import { useToast } from '../components/Toast';
import { IconLabel } from '../components/IconLabel';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s as sharedStyles } from '../lib/theme';

const s = { ...sharedStyles, btn: { ...sharedStyles.btn, minHeight: 44 }, btnGhost: { ...sharedStyles.btnGhost, minHeight: 44 }, btnDanger: { ...sharedStyles.btnDanger, minHeight: 44 } };

const PREPARATION = ['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'];

export default function OrderDetailScreen() {
  const toast = useToast();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const id = route.params.orderId;
  const [order, setOrder] = useState<any>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [riderId, setRiderId] = useState('');
  const [ridersLoading, setRidersLoading] = useState(false);
  const [ridersFailed, setRidersFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    const [fresh, profile] = await Promise.all([api.get(`/merchant/orders/${id}`), api.get('/merchant/profile')]);
    if (request !== generation.current) throw new Error('Refresh this order to check its latest status.');
    setOrder(fresh); setCanAssign(profile.isOwner || (profile.permissions ?? []).includes('RIDERS')); setFailed(false);
    return fresh;
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load().catch(() => setFailed(true));
    return () => { generation.current++; };
  }, [load]));

  const loadRiders = useCallback(async () => {
    setRidersLoading(true); setRidersFailed(false);
    try {
      const list = await api.get('/merchant/riders');
      const available = (Array.isArray(list) ? list : list.items ?? []).filter((r: any) => r.isActive && r.approvalStatus === 'APPROVED' && r.currentStatus === 'IDLE' && !r.currentOrderId);
      setRiders(available); setRiderId(current => available.some((r: any) => r.id === current) ? current : '');
    } catch (e: any) { setRiders([]); setRidersFailed(true); toast(e.message, false); }
    finally { setRidersLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (canAssign && PREPARATION.includes(order?.status) && !order?.rider) void loadRiders();
  }, [order?.status, order?.rider?.id, canAssign, loadRiders]);

  const act = async (action: string, expected: string[], body?: any) => {
    if (lock.current || uncertain) return;
    lock.current = true; setBusy(true);
    const confirmed = (fresh: any) => expected.includes(fresh.status) && (action !== 'assign-rider' || fresh.rider?.id === body?.riderId);
    try {
      const result = await api.post(`/merchant/orders/${id}/${action}`, body ?? {});
      if (!result?.ok || !expected.includes(result.status)) throw new Error('Check the saved order before retrying.');
      const fresh = await load();
      if (!confirmed(fresh)) throw new Error('The order changed. Review its latest status.');
      toast(action === 'assign-rider' ? 'Rider assigned' : action === 'accept' ? 'Order accepted. Preparation started.' : 'Order updated');
    } catch (e: any) {
      try {
        const fresh = await load();
        if (confirmed(fresh)) toast('Saved order update confirmed');
        else toast(`${e.message} Review the latest order before retrying.`, false);
      } catch { setUncertain(true); toast('The update could not be checked. Refresh the saved order before retrying.', false); }
    } finally { lock.current = false; setBusy(false); }
  };

  if (!order || order.id !== id) return <View style={s.pad}><Text style={s.muted}>{failed ? 'Unable to load this order. Check your connection and retry.' : 'Loading order…'}</Text>{failed && <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => void load().catch(() => setFailed(true))}><Text style={s.btnGhostText}>Retry order</Text></TouchableOpacity>}</View>;

  return <ScrollView style={s.screen} contentContainerStyle={[s.pad, { paddingBottom: 32 }]}>
    <View style={s.spread}><Text style={[s.h1, { flex: 1 }]}>{order.orderNumber}</Text><Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{pkr(order.totalAmountPaisa)}</Text></View>
    <Text style={[s.body, { fontWeight: '700', marginTop: 4 }]}>{statusLabel(order.status)} · {order.paymentMethod}</Text>
    <View style={[s.card, { marginTop: 14, gap: 12 }]}>
      <Text style={s.h2}>Next step</Text>
      {order.status === 'SENT_TO_MERCHANT' && <>
        <Text style={s.body}>Accept to start preparing. The buyer will see Preparing after it is saved.</Text>
        <TouchableOpacity accessibilityRole="button" style={s.btn} disabled={busy || uncertain} onPress={() => void act('accept', ['PREPARING'])}><IconLabel icon="check" style={s.btnText}>{busy ? 'Accepting…' : 'Accept order'}</IconLabel></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={s.btnDanger} disabled={busy || uncertain} onPress={() => Alert.alert('Reject this order?', 'The buyer will be told that your shop cannot fulfil this order.', [{ text: 'Keep order', style: 'cancel' }, { text: 'Reject order', style: 'destructive', onPress: () => void act('reject', ['MERCHANT_REJECTED'], { reason: 'Unable to fulfil right now' }) }])}><IconLabel icon="close" style={s.btnDangerText}>Reject order</IconLabel></TouchableOpacity>
      </>}
      {PREPARATION.includes(order.status) && <>
        <Text style={s.body}>{order.status === 'READY_FOR_PICKUP' ? 'The order is packed. Assign a rider for pickup.' : 'Assign a rider while packing. Mark ready only when all items are packed.'}</Text>
        {order.rider ? <IconLabel icon="bike" style={s.body}>Assigned rider: {order.rider.fullName}</IconLabel> : !canAssign ? <Text style={s.body}>Ask the shop owner to assign a rider. Rider-management permission is required.</Text> : <>
          <Text style={s.h2}>Delivery rider</Text>
          {ridersLoading ? <Text style={s.muted}>Loading available riders…</Text> : ridersFailed ? <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => void loadRiders()}><Text style={s.btnGhostText}>Retry riders</Text></TouchableOpacity> : riders.length === 0 ? <><Text style={s.body}>No riders available. Add or approve a rider in Riders, or wait for a delivery to finish.</Text><TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => void loadRiders()}><Text style={s.btnGhostText}>Refresh riders</Text></TouchableOpacity></> : <>
            {riders.map(r => <TouchableOpacity key={r.id} accessibilityRole="radio" accessibilityState={{ checked: riderId === r.id, disabled: busy || uncertain }} disabled={busy || uncertain} onPress={() => setRiderId(r.id)} style={[s.btnGhost, riderId === r.id && { borderColor: colors.primary, backgroundColor: colors.emeraldBg }]}><IconLabel icon={riderId === r.id ? 'check' : 'bike'} style={s.btnGhostText}>{r.fullName} · {r.phoneNumber}</IconLabel></TouchableOpacity>)}
            <TouchableOpacity accessibilityRole="button" style={s.btn} disabled={busy || uncertain || !riderId} onPress={() => void act('assign-rider', ['MERCHANT_ACCEPTED', 'PREPARING', 'RIDER_ASSIGNED'], { riderId })}><IconLabel icon="bike" style={s.btnText}>{busy ? 'Assigning…' : 'Assign rider'}</IconLabel></TouchableOpacity>
          </>}
        </>}
        {order.status === 'MERCHANT_ACCEPTED' && <TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy || uncertain} onPress={() => void act('preparing', ['PREPARING'])}><Text style={s.btnGhostText}>Start preparing</Text></TouchableOpacity>}
        {['MERCHANT_ACCEPTED', 'PREPARING'].includes(order.status) && <TouchableOpacity accessibilityRole="button" style={order.rider ? s.btn : s.btnGhost} disabled={busy || uncertain} onPress={() => void act('ready', ['READY_FOR_PICKUP', 'RIDER_ASSIGNED'])}><IconLabel icon="box" style={order.rider ? s.btnText : s.btnGhostText}>Mark ready for pickup</IconLabel></TouchableOpacity>}
      </>}
      {order.status === 'RIDER_ASSIGNED' && <Text style={s.body}>The order is ready. The assigned rider can confirm pickup in the rider app.</Text>}
      {uncertain && <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => void load().then(() => setUncertain(false)).catch(() => toast('Unable to check the saved order. Retry when connected.', false))}><Text style={s.btnGhostText}>Check saved order</Text></TouchableOpacity>}
    </View>
    <View style={[s.card, { marginTop: 14 }]}>
      <Text style={s.h2}>Items</Text>
      {(order.items ?? []).map((it: any) => <View key={it.id} style={[s.spread, { marginTop: 8 }]}><Text style={[s.body, { flex: 1 }, it.itemStatus !== 'CONFIRMED' && { textDecorationLine: 'line-through', color: colors.muted }]}>{it.quantity} × {it.productNameSnapshot}</Text><Text style={[s.body, { fontWeight: '700' }]}>{pkr(it.totalPricePaisa)}</Text></View>)}
      {order.customerNote && <IconLabel icon="file" style={[s.body, { marginTop: 10 }]}>Customer note: {order.customerNote}</IconLabel>}
    </View>
    <View style={[s.card, { marginTop: 14 }]}>
      <Text style={s.h2}>Deliver to</Text>
      <Text style={[s.body, { marginTop: 4 }]}>{order.deliveryAddress?.contactName ?? order.customer?.user?.fullName ?? 'Customer'}</Text>
      <Text style={s.body}>{order.deliveryAddress?.fullAddress}</Text>
      <Text style={s.body}>{order.deliveryAddress?.contactPhone ?? order.customer?.user?.phoneNumber}</Text>
      {order.deliveryAddress?.instructions && <Text style={s.body}>{order.deliveryAddress.instructions}</Text>}
    </View>
    <View style={[s.card, { marginTop: 14 }]}>
      <Text style={s.h2}>Timeline</Text>
      {(order.timeline ?? []).map((t: any) => <Text key={t.id} style={[s.muted, { marginTop: 4 }]}>• {statusLabel(t.status)} — {new Date(t.createdAt).toLocaleTimeString()} {t.notes ? `(${t.notes})` : ''}</Text>)}
    </View>
  </ScrollView>;
}
