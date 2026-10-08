import { toast } from '../components/Toast';
import { IconLabel } from '../components/IconLabel';
import { AppIcon } from '../components/AppIcon';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, pkr, statusLabel } from '../lib/api';
import { colors } from '../lib/theme';

const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  masthead: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 153, height: 38, resizeMode: 'contain' },
  shopRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  shop: { fontSize: 12, fontWeight: '700', color: colors.muted, flexShrink: 1 },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presenceText: { fontSize: 11, color: colors.muted },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 16 },
  title: { color: '#172321', fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -1.2, marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 6 },
  pending: { marginTop: 16, backgroundColor: '#FFF6E3', borderColor: '#E9D8A6', borderWidth: 1, borderRadius: 12, padding: 12 },
  pendingTitle: { color: '#986316', fontWeight: '800', fontSize: 12 },
  pendingText: { color: colors.muted, marginTop: 4, fontSize: 11, lineHeight: 17 },
  metrics: { marginTop: 20, flexDirection: 'row', backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  metric: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 5 },
  metricBorder: { borderLeftColor: '#E4E8E7', borderLeftWidth: 1 },
  metricValue: { color: '#172321', fontSize: 18, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  leadCard: { marginTop: 20, backgroundColor: '#103C2C', borderRadius: 19, padding: 21 },
  leadEyebrow: { color: '#C5EAD8', fontSize: 10, fontWeight: '800', letterSpacing: .8, textTransform: 'uppercase' },
  leadTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', lineHeight: 26, marginTop: 10 },
  leadDescription: { color: '#D9F0E6', fontSize: 12, marginTop: 9 },
  leadSteps: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 21 },
  leadStep: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 11 },
  sectionTitle: { color: '#172321', fontSize: 17, fontWeight: '800' },
  linkText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  empty: { backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderWidth: 1, borderRadius: 14, padding: 20 },
  emptyTitle: { color: '#172321', fontWeight: '700', fontSize: 13 },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  order: { backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderWidth: 1, borderRadius: 14, padding: 16 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  orderNumber: { color: '#172321', fontWeight: '800', fontSize: 13 },
  orderValue: { color: '#172321', fontWeight: '800', fontSize: 13 },
  orderDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  status: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  slogan: { color: colors.primary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 28 },
  logout: { alignSelf: 'center', marginTop: 18, padding: 8 },
});

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [completed, setCompleted] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.get('/rider/profile').then(setProfile).catch(() => undefined);
    api.get('/rider/orders/assigned').then(setOrders).catch(() => undefined);
    api.get('/rider/orders/history').then((history) => setCompleted(Array.isArray(history) ? history.filter((order) => order.status === 'DELIVERED').length : null)).catch(() => setCompleted(null));
  }, []);

  useFocusEffect(load);
  useEffect(() => {
    timer.current = setInterval(load, 10000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    try { await api.post(`/rider/${value ? 'online' : 'offline'}`); load(); }
    catch (e: any) { toast(e.message, false); }
  };
  const codToCollect = orders.filter((order) => order.paymentMethod === 'COD').reduce((sum, order) => sum + (order.totalAmountPaisa ?? 0), 0);
  const current = orders[0];

  return <SafeAreaView style={ui.screen} edges={['top']}>
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={orders}
      keyExtractor={(order) => order.id}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListHeaderComponent={<>
        <View style={ui.masthead}><Image source={require('../assets/brand/sirfbazar-horizontal-no-slogan.png')} style={ui.logo} accessibilityLabel="SirfBazar" /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Delivery history" onPress={() => navigation.navigate('History')}><IconLabel icon="arrow" style={ui.linkText}>History</IconLabel></TouchableOpacity></View>
        <View style={ui.shopRow}><IconLabel icon="shop" style={ui.shop} numberOfLines={1}>{profile?.merchant?.shopName ?? 'Your assigned shop'}</IconLabel><View style={ui.presence}><Text style={ui.presenceText}>{profile?.isOnline ? 'Online' : 'Offline'}</Text><Switch value={profile?.isOnline ?? false} onValueChange={toggleOnline} disabled={profile?.approvalStatus !== 'APPROVED'} trackColor={{ true: colors.primary }} accessibilityLabel="Available for deliveries" /></View></View>
        <Text style={ui.eyebrow}>Merchant-owned delivery</Text><Text style={ui.title}>Let’s get moving{profile?.fullName ? `,\n${profile.fullName.split(' ')[0]}` : ''}.</Text><Text style={ui.subtitle}>{current ? 'Your assigned delivery is ready to review.' : 'Your next delivery is waiting for you.'}</Text>
        {profile?.approvalStatus === 'PENDING' && <View style={ui.pending}><Text style={ui.pendingTitle}>Waiting for shop approval</Text><Text style={ui.pendingText}>{profile?.merchant?.shopName ?? 'The shop'} has not approved your rider request yet. You can go online after approval.</Text></View>}
        <View style={ui.metrics}><View style={ui.metric}><Text style={ui.metricValue}>{orders.length}</Text><Text style={ui.metricLabel}>Assigned</Text></View><View style={[ui.metric, ui.metricBorder]}><Text style={ui.metricValue}>{completed ?? '—'}</Text><Text style={ui.metricLabel}>Completed</Text></View><View style={[ui.metric, ui.metricBorder]}><Text style={ui.metricValue}>{pkr(codToCollect)}</Text><Text style={ui.metricLabel}>COD to collect</Text></View></View>
        {current && <TouchableOpacity style={ui.leadCard} accessibilityRole="button" accessibilityLabel={`Open delivery ${current.orderNumber}`} onPress={() => navigation.navigate('Delivery', { orderId: current.id })}><Text style={ui.leadEyebrow}>Current assignment · {current.orderNumber}</Text><Text style={ui.leadTitle}>A doorstep to get to.</Text><Text style={ui.leadDescription}>{current.deliveryAddress?.area ?? current.deliveryAddress?.city ?? 'Delivery address in order details'}</Text><View style={ui.leadSteps}><IconLabel icon="shop" style={ui.leadStep}>Shop pickup</IconLabel><AppIcon name="arrow" size={16} color={colors.primary} /><IconLabel icon="home" style={ui.leadStep}>Customer</IconLabel></View></TouchableOpacity>}
        <View style={ui.sectionHead}><Text style={ui.sectionTitle}>Assigned deliveries</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('History')}><IconLabel icon="arrow" style={ui.linkText}>View history</IconLabel></TouchableOpacity></View>
      </>}
      ListEmptyComponent={<View style={ui.empty}><Text style={ui.emptyTitle}>No deliveries right now</Text><Text style={ui.emptyText}>Stay online. Assignments from your shop appear here automatically.</Text></View>}
      renderItem={({ item: order }) => <TouchableOpacity style={ui.order} accessibilityRole="button" accessibilityLabel={`Open delivery ${order.orderNumber}`} onPress={() => navigation.navigate('Delivery', { orderId: order.id })}><View style={ui.orderTop}><Text style={ui.orderNumber}>{order.orderNumber}</Text><Text style={ui.orderValue}>{pkr(order.totalAmountPaisa)}</Text></View><Text style={ui.orderDetail}>Shop pickup: {order.merchant?.shopName ?? profile?.merchant?.shopName ?? 'Your shop'}{order.deliveryAddress?.area ? ` → ${order.deliveryAddress.area}` : ''}</Text><View style={ui.orderBottom}><Text style={ui.status}>{statusLabel(order.status)}</Text><Text style={ui.orderDetail}>{order.paymentMethod === 'COD' ? `Collect ${pkr(order.totalAmountPaisa)}` : 'Prepaid'}</Text></View></TouchableOpacity>}
      ListFooterComponent={<><Text style={ui.slogan} numberOfLines={1}>بازار وہی۔ طریقہ نیا۔</Text><TouchableOpacity style={ui.logout} accessibilityRole="button" onPress={async () => { await clearAuth(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}><Text style={ui.linkText}>Log out</Text></TouchableOpacity></>}
    />
  </SafeAreaView>;
}
