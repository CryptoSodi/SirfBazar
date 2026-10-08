import { ToastMessage } from '../components/Toast';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ActionDock, Icon, IconButton, type IconName, Notice, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, pkr, statusLabel } from '../lib/api';
import { refreshBadges } from '../lib/badges';
import { publishCustomerEvent } from '../lib/customer-events';
import { pendingReplacements } from '../lib/customer-flow';
import { canCancelOrder, formatOrderTime, orderAddress, orderDeliveries, paymentDescription, trackingHeading, useOrderPresentation, visibleOrderItems } from '../lib/order-presentation';
import { useTheme } from '../lib/theme';
import { OrderStatusBadge } from './OrderSentScreen';

function OrderAction({ icon, label, subtitle, onPress, last = false, danger = false }: { icon: IconName; label: string; subtitle?: string; onPress: () => void; last?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', gap: 13, alignItems: 'center', padding: 15, minHeight: 61, borderBottomWidth: last ? 0 : 1, borderColor: colors.border }}>
    <Icon name={icon} color={danger ? colors.danger : colors.primary} size={22} /><View style={{ flex: 1 }}><Text style={{ color: danger ? colors.danger : colors.text, fontSize: 14, fontWeight: '700', lineHeight: 19 }}>{label}</Text>{!!subtitle && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }}>{subtitle}</Text>}</View><Icon name="chevron" size={19} />
  </TouchableOpacity>;
}

function Charges({ order }: { order: any }) {
  const { colors, s } = useTheme();
  const lines: [string, number][] = [['Items', order.subtotalPaisa], ['Delivery', order.deliveryFeePaisa], ['Service fee', order.serviceFeePaisa]];
  if (order.smallOrderFeePaisa) lines.push(['Small order fee', order.smallOrderFeePaisa]);
  if (order.discountAmountPaisa) lines.push(['Discount', -order.discountAmountPaisa]);
  return <View style={{ gap: 9 }}>
    {lines.filter(([, value]) => Number.isFinite(value)).map(([label, value]) => <View key={label} style={[s.spread, { gap: 15, alignItems: 'flex-start' }]}><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, flexShrink: 1 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(value)}</Text></View>)}
    <View style={[s.spread, { marginTop: 3, paddingTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.control }]}><Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Total</Text><Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{pkr(order.totalAmountPaisa)}</Text></View>
  </View>;
}

/** Actual server timeline only: future stages are not represented as completed events. */
function Timeline({ delivery }: { delivery: any }) {
  const { colors } = useTheme();
  const events: any[] = delivery.timeline?.length ? delivery.timeline : [{ status: delivery.status }];
  return <View style={{ paddingStart: 5, marginTop: 15 }}>
    {events.map((event, index) => <View key={event.id ?? `${event.status}-${index}`} style={{ flexDirection: 'row', gap: 15, paddingBottom: 21, alignItems: 'flex-start' }}>
      <View style={{ width: 17, alignItems: 'center', alignSelf: 'stretch' }}>
        {index < events.length - 1 && <View style={{ position: 'absolute', top: 18, bottom: -21, width: 1, backgroundColor: colors.border }} />}
        <View style={{ marginTop: 1, width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: index === events.length - 1 ? colors.primary : colors.action, backgroundColor: index === events.length - 1 ? colors.card : colors.action }} />
      </View>
      <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{statusLabel(event.status)}</Text><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{event.createdAt ? formatOrderTime(event.createdAt) : 'Last confirmed delivery status'}</Text></View>
    </View>)}
  </View>;
}

export default function OrderDetailScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>(); const mode = route.params.mode ?? 'tracking';
  const { colors, s } = useTheme(); const inset = usePageInset();
  const { order, track, error, updatedAt, load } = useOrderPresentation(route.params.orderId, true);
  const [selectedId, setSelectedId] = useState('');
  const [actionError, setActionError] = useState(''); const [confirmCancel, setConfirmCancel] = useState(false); const [busy, setBusy] = useState(false);
  const cancelling = useRef(false);
  useEffect(() => { setSelectedId(''); setConfirmCancel(false); setActionError(''); }, [route.params.orderId]);
  useEffect(() => { navigation.setOptions({ title: mode === 'details' ? 'Order details' : order?.isParent ? 'Track deliveries' : 'Track order' }); }, [navigation, mode, order?.isParent]);
  const cancel = async () => {
    if (cancelling.current) return;
    cancelling.current = true; setBusy(true); setActionError('');
    try { await api.post(`/orders/${order.id}/cancel`, { reason: 'Changed my mind' }); setConfirmCancel(false); load(); refreshBadges(); publishCustomerEvent('orders'); }
    catch (cause: any) { setActionError(`${cause.message} Refresh the order before retrying.`); }
    finally { cancelling.current = false; setBusy(false); }
  };
  if (!order || !track) return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset }}><StatePanel icon="bag" loading={!error} title={error ? 'Couldn’t load your order' : 'Loading your order…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /></ScrollView>;
  const deliveries: any[] = track.deliveries ?? [];
  const selected = deliveries.find((delivery) => delivery.orderId === selectedId) ?? deliveries[0];
  const details = orderDeliveries(order);
  const multi = deliveries.length > 1;
  const replacements = pendingReplacements(order);
  const moveTo = (nextMode: 'details' | 'tracking') => navigation.push('OrderDetail', { orderId: order.id, mode: nextMode });
  const routeRows = <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, marginTop: 16 }}>
    <OrderAction icon="route" label="Track this order" onPress={() => moveTo('tracking')} />
    <OrderAction icon="help" label="Get help with this order" onPress={() => navigation.navigate('Help', { orderId: order.id })} last={!canCancelOrder(order)} />
    {canCancelOrder(order) && <OrderAction icon="close" label="Cancel order" subtitle="Available before the shop accepts" danger onPress={() => setConfirmCancel(true)} last />}
  </View>;
  return <View style={s.screen}>
    <ScrollView contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
      {!!error && <View style={{ marginBottom: 16 }}><Notice danger>Updates are temporarily unavailable. Your last confirmed order is shown. Try refreshing; updates will also retry automatically.</Notice><TouchableOpacity accessibilityRole="button" onPress={load} style={[s.btnGhost, { marginTop: 12 }]}><Text style={s.btnGhostText}>Refresh order</Text></TouchableOpacity></View>}
      {!!actionError && <View style={{ marginBottom: 16 }}><ToastMessage>{actionError}</ToastMessage></View>}
      {mode === 'details' ? <>
        <Text accessibilityRole="header" style={s.h1}>Order {order.orderNumber}</Text>
        <View style={{ marginTop: 12 }}><OrderStatusBadge status={order.status} /></View>
        {details.map((delivery) => <View key={delivery.id} style={[s.card, { marginTop: 16 }]}>
          <Text accessibilityRole="header" style={s.h2}>{delivery.merchant?.shopName ?? 'Your local shop'}</Text>
          <Text style={[s.muted, { marginTop: 8 }]}>{formatOrderTime(delivery.createdAt ?? order.createdAt)}</Text>
          {multi && <View style={{ marginTop: 8 }}><OrderStatusBadge status={delivery.status} /></View>}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
          {visibleOrderItems(delivery).map((item) => <View key={item.id} style={[s.spread, { alignItems: 'flex-start', gap: 15, marginBottom: 12 }]}><View style={{ flex: 1 }}><Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>{item.quantity} × {item.productNameSnapshot}</Text>{!!item.unitSnapshot && <Text style={s.faint}>{item.unitSnapshot}</Text>}{item.itemStatus === 'UNAVAILABLE' && <Text style={[s.faint, { color: colors.amber }]}>Unavailable — check the confirmed total</Text>}</View><Text style={{ color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(item.totalPricePaisa)}</Text></View>)}
          <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.control, marginTop: 9, marginBottom: 14 }} />
          <Charges order={delivery} />
          {delivery.status === 'DELIVERED' && <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 16 }]} onPress={() => navigation.navigate('Rating', { orderId: delivery.id })}><Text style={s.btnGhostText}>Rate this delivery</Text></TouchableOpacity>}
        </View>)}
        {multi && <View style={[s.card, { marginTop: 16 }]}><Text style={[s.h2, { marginBottom: 16 }]}>Overall order total</Text><Charges order={order} /><Text style={[s.muted, { marginTop: 12 }]}>Each shop delivers separately. Shared fees and discounts are shown in this overall total.</Text></View>}
        <View style={[s.card, { marginTop: 16 }]}><Text accessibilityRole="header" style={s.h2}>Delivery & payment</Text><Text style={[s.muted, { marginTop: 8 }]}>{orderAddress(order)}</Text><Text style={[s.muted, { color: colors.text, marginTop: 8 }]}>{paymentDescription(order)}</Text>{!!order.customerNote && <Text style={[s.muted, { marginTop: 8 }]}>{order.customerNote}</Text>}{order.status === 'PAYMENT_PENDING' && <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => navigation.navigate('PaymentPending', { orderId: order.id })}><Text style={s.btnGhostText}>Check payment status</Text></TouchableOpacity>}</View>
        {routeRows}
      </> : <>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: colors.muted }}>ORDER · {order.orderNumber}</Text>
        <Text accessibilityRole="header" style={[s.h1, { marginTop: 8 }]}>{multi ? `${deliveries.length} shops.\nSeparate deliveries.` : trackingHeading(selected?.status ?? order.status)}</Text>
        {multi && <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 16, paddingBottom: 4 }}>{deliveries.map((delivery) => <TouchableOpacity key={delivery.orderId} accessibilityRole="button" accessibilityState={{ selected: selected?.orderId === delivery.orderId }} onPress={() => setSelectedId(delivery.orderId)} style={{ minHeight: 44, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: selected?.orderId === delivery.orderId ? colors.action : colors.border, backgroundColor: selected?.orderId === delivery.orderId ? colors.action : colors.card, justifyContent: 'center' }}><Text style={{ fontSize: 12, color: selected?.orderId === delivery.orderId ? '#fff' : colors.muted }}>{delivery.merchant?.shopName ?? delivery.orderNumber}</Text></TouchableOpacity>)}</ScrollView>
          {deliveries.filter((delivery) => delivery.orderId !== selected?.orderId).map((delivery) => <View key={delivery.orderId} style={[s.card, { marginTop: 12 }]}><View style={[s.row, { gap: 8 }]}><Icon name="shop" size={18} color={colors.primary} /><Text style={[s.body, { fontWeight: '700', flex: 1 }]}>{delivery.merchant?.shopName}</Text></View><View style={{ marginTop: 12 }}><OrderStatusBadge status={delivery.status} /></View><Text style={[s.muted, { marginTop: 8 }]}>Tracked separately from the selected delivery.</Text></View>)}
        </>}
        {selected && <>
          <View style={[s.card, { marginTop: 20, padding: 18, borderRadius: 19 }]}>
            <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}><Icon name="shop" size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{selected.merchant?.shopName ?? 'Your local shop'}</Text><Text style={s.muted}>{selected.rider ? 'Your shop’s rider is assigned to this order.' : 'The shop manages this delivery.'}</Text></View></View>
            <View style={{ height: 25, width: 1, borderStartWidth: 1, borderStyle: 'dashed', borderColor: colors.control, marginVertical: 5, marginStart: 9 }} />
            <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}><Icon name="pin" size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{order.deliveryAddress?.fullAddress ?? 'Delivery address unavailable'}</Text><Text style={s.muted}>Your delivery address</Text></View></View>
            <Text style={[s.faint, { lineHeight: 17, marginTop: 16 }]}>{selected.riderLocation?.createdAt ? `Rider location last reported ${formatOrderTime(selected.riderLocation.createdAt)}. Map unavailable here; no live position is shown.` : 'No rider location has been reported. The confirmed delivery status is shown below.'}</Text>
          </View>
          <View style={[s.card, { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}>{selected.rider?.fullName ? <Text style={{ fontWeight: '700', fontSize: 16, color: colors.primary }}>{selected.rider.fullName.split(' ').map((word: string) => word[0]).slice(0, 2).join('')}</Text> : <Icon name="user" color={colors.primary} />}</View>
            <View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{selected.rider?.fullName ?? 'Rider not assigned yet'}</Text><Text style={s.muted}>{selected.rider ? `Assigned by ${selected.merchant?.shopName ?? 'your shop'}` : 'Your shop will arrange delivery.'}</Text>{!!selected.rider?.vehicleNumber && <Text style={s.faint}>{selected.rider.vehicleNumber}</Text>}</View>
            {!!selected.rider?.phoneNumber && <IconButton name="phone" label="Contact rider" onPress={() => { void Linking.openURL(`tel:${selected.rider.phoneNumber}`).catch(() => setActionError('Couldn’t open the phone app. Try again or contact support.')); }} />}
          </View>
          <Timeline delivery={selected} />
          {!!selected.deliveryOtp && <View style={{ backgroundColor: colors.emeraldBg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 15, padding: 15, alignItems: 'center' }}><Text style={[s.muted, { color: colors.text, fontWeight: '700' }]}>Your delivery code</Text><Text selectable accessibilityLabel={`Delivery code ${String(selected.deliveryOtp).split('').join(' ')}`} style={{ fontSize: 25, letterSpacing: 10, fontWeight: '700', color: colors.primary, marginVertical: 12 }}>{selected.deliveryOtp}</Text><Text style={[s.faint, { textAlign: 'center', lineHeight: 17 }]}>Share with this rider only when your parcel arrives.</Text></View>}
          <Text style={[s.faint, { textAlign: 'center', marginTop: 12, lineHeight: 17 }]}>Status checked {formatOrderTime(updatedAt)}</Text>
          {selected.status === 'DELIVERED' && <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 16 }]} onPress={() => navigation.navigate('Rating', { orderId: selected.orderId })}><Text style={s.btnGhostText}>Rate this delivery</Text></TouchableOpacity>}
        </>}
        {order.status === 'PAYMENT_PENDING' && <View style={{ marginTop: 16 }}><Notice tone="warning">Payment is not confirmed. This order has not been sent to the shops. Don’t place it again.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => navigation.navigate('PaymentPending', { orderId: order.id })}><Text style={s.btnGhostText}>Check payment status</Text></TouchableOpacity></View>}
      </>}
      {replacements.map(({ orderId, item, shopName }: any) => <View key={item.id} style={[s.card, { marginTop: 16 }]}><Text style={s.h2}>Replacement needs a decision</Text><Text style={[s.muted, { marginTop: 8 }]}>{shopName} · {item.productNameSnapshot}</Text><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => navigation.navigate('Replacement', { orderId, originalItemId: item.replacementForItemId })}><Text style={s.btnGhostText}>Review replacement</Text></TouchableOpacity></View>)}
      {confirmCancel && <View style={[s.card, { marginTop: 16, gap: 12 }]}><Text accessibilityRole="header" style={s.h2}>Cancel this order?</Text><Text style={s.muted}>This can only be cancelled before every shop accepts. The saved status will be checked by the server.</Text><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void cancel()} style={[s.btn, { backgroundColor: colors.dangerSolid, justifyContent: 'center' }]}><Text style={s.btnText}>{busy ? 'Cancelling…' : 'Cancel order'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setConfirmCancel(false)} style={[s.btnGhost, { justifyContent: 'center' }]}><Text style={s.btnGhostText}>Keep my order</Text></TouchableOpacity></View>}
    </ScrollView>
    {mode === 'tracking' && <ActionDock><TouchableOpacity accessibilityRole="button" onPress={() => moveTo('details')} style={[s.btn, { justifyContent: 'center' }]}><Text style={s.btnText}>View order details</Text></TouchableOpacity></ActionDock>}
  </View>;
}
