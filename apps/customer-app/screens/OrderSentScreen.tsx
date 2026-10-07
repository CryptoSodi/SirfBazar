import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ActionDock, goTab, Icon, type IconName, Notice, StatePanel, usePageInset } from '../components/CustomerUI';
import { pkr } from '../lib/api';
import { orderAddress, orderDeliveries, orderStatusTitle, paymentDescription, trackingHeading, useOrderPresentation } from '../lib/order-presentation';
import { useTheme } from '../lib/theme';

export function OrderArt({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  return <View style={{ marginTop: 28, marginBottom: 24, alignSelf: 'center', width: 90, height: 90, borderRadius: 28, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={40} color={colors.primary} /></View>;
}

export function OrderStatusBadge({ status, label }: { status: string; label?: string }) {
  const { colors } = useTheme();
  const bad = /CANCELLED|REJECTED|FAILED/.test(status ?? '');
  const underway = ['ON_THE_WAY', 'PICKED_UP', 'RIDER_ARRIVED_AT_CUSTOMER'].includes(status);
  const done = status === 'DELIVERED';
  return <Text style={{ alignSelf: 'flex-start', flexShrink: 1, overflow: 'hidden', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, lineHeight: 14, fontWeight: '700', color: bad ? colors.danger : underway ? colors.blue : done ? colors.primary : colors.amber, backgroundColor: bad ? colors.dangerBg : underway ? colors.blueBg : done ? colors.emeraldBg : colors.warningBg }}>{label ?? orderStatusTitle(status)}</Text>;
}

export default function OrderSentScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>();
  const { colors, s } = useTheme(); const inset = usePageInset();
  const { order, error, load } = useOrderPresentation(route.params.orderId);
  if (!order) return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset }}><StatePanel icon="bag" loading={!error} title={error ? 'Couldn’t load your order' : 'Loading your order…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /></ScrollView>;
  const deliveries = orderDeliveries(order);
  const sent = order.status === 'SENT_TO_MERCHANT';
  const title = sent ? (deliveries.length > 1 ? 'Your order is\nwith the shops.' : 'Your order is\nwith the shop.') : trackingHeading(order.status);
  return <View style={s.screen}>
    <ScrollView contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
      <OrderArt icon={order.status === 'PAYMENT_PENDING' ? 'card' : 'check'} />
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, textAlign: 'center' }}>ORDER · {order.orderNumber}</Text>
      <Text accessibilityRole="header" style={[s.h1, { textAlign: 'center', marginTop: 12 }]}>{title}</Text>
      <Text style={[s.body, { color: colors.muted, textAlign: 'center', marginTop: 12 }]}>{sent ? 'We’ll show the shop’s response here.\n' : ''}{order.paymentMethod === 'COD' && order.paymentStatus === 'CASH_PENDING' ? 'Payment is due on delivery.' : paymentDescription(order)}</Text>
      <View style={[s.card, { marginTop: 24 }]}>
        {deliveries.map((delivery, index) => <View key={delivery.id} style={{ marginTop: index ? 16 : 0 }}><View style={[s.row, { gap: 9 }]}><Icon name="shop" size={18} color={colors.primary} /><Text style={[s.body, { fontWeight: '700', flex: 1 }]}>{delivery.merchant?.shopName ?? 'Your local shop'}</Text></View><View style={{ marginTop: 12 }}><OrderStatusBadge status={delivery.status} label={delivery.status === 'SENT_TO_MERCHANT' ? 'Awaiting confirmation' : undefined} /></View></View>)}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
        <View style={s.spread}><Text style={s.muted}>Order value</Text><Text style={[s.muted, { fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }]}>{pkr(order.totalAmountPaisa)}</Text></View>
        <Text style={[s.muted, { marginTop: 12 }]}>{orderAddress(order)}</Text>
      </View>
      <View style={{ marginTop: 16 }}><Notice tone="blue">Sent does not mean accepted. Track the confirmed status in your order.</Notice></View>
      {!!error && <View style={{ marginTop: 16 }}><Notice danger>{error} Your saved order has not been placed again. Refresh to check the latest status.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={load}><Text style={s.btnGhostText}>Refresh order</Text></TouchableOpacity></View>}
    </ScrollView>
    <ActionDock><TouchableOpacity accessibilityRole="button" onPress={() => navigation.replace('OrderDetail', { orderId: order.id, mode: 'tracking' })} style={[s.btn, { justifyContent: 'center' }]}><Text style={s.btnText}>Track your order</Text></TouchableOpacity></ActionDock>
  </View>;
}

export function PaymentPendingScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>();
  const { s } = useTheme(); const inset = usePageInset();
  const { order, error, load } = useOrderPresentation(route.params.orderId);
  const pending = !order || order.status === 'PAYMENT_PENDING' || order.paymentStatus === 'PENDING';
  return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset, paddingTop: 12 }}>
    <StatePanel icon="card" title={pending ? 'Payment is\nnot confirmed.' : 'Your payment status\nhas updated.'} message={pending ? 'Don’t retry payment or place another order until the saved status is checked.' : paymentDescription(order)} action="View order status" onPress={() => navigation.navigate('OrderDetail', { orderId: route.params.orderId, mode: 'details' })} secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')} />
    {!!error && <><Notice danger>{error} Refresh to check the saved status.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={load}><Text style={s.btnGhostText}>Refresh status</Text></TouchableOpacity></>}
  </ScrollView>;
}
