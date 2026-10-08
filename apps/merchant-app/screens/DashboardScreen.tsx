import { useToast } from '../components/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, pkr } from '../lib/api';
import { colors } from '../lib/theme';

const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  content: { padding: 18, paddingBottom: 42 },
  logo: { width: 153, height: 38, resizeMode: 'contain' },
  shopRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  shopName: { color: '#172321', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presenceText: { color: colors.muted, fontSize: 11 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 25 },
  title: { color: '#172321', fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -1.1, marginTop: 7 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  status: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  metric: { width: '48%', flexGrow: 1, minHeight: 122, justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderWidth: 1, borderRadius: 14, padding: 15 },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { color: '#172321', fontSize: 23, fontWeight: '800' },
  metricHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  focus: { marginTop: 19, backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderLeftColor: colors.brand, borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, padding: 16 },
  focusTitle: { color: '#172321', fontSize: 12, fontWeight: '800' },
  focusText: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 9 },
  sectionTitle: { color: '#172321', fontSize: 17, fontWeight: '800', marginTop: 25, marginBottom: 10 },
  panel: { backgroundColor: '#FFFFFF', borderColor: '#E4E8E7', borderWidth: 1, borderRadius: 14, padding: 18 },
  panelDescription: { color: colors.muted, fontSize: 11, marginTop: 4 },
  pipelineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomColor: '#E4E8E7', borderBottomWidth: 1 },
  pipelineLabel: { color: colors.muted, fontSize: 12 },
  pipelineCount: { color: '#172321', fontSize: 12, fontWeight: '800' },
  other: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  slogan: { color: colors.primary, textAlign: 'center', fontSize: 18, fontWeight: '700', marginTop: 26 },
});

export default function DashboardScreen() {
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.get('/merchant/dashboard').then(setStats).catch(() => undefined);
    api.get('/merchant/profile').then(setProfile).catch(() => undefined);
  }, []);
  useFocusEffect(load);

  const toggleOnline = async (value: boolean) => {
    try { await api.post(`/merchant/${value ? 'online' : 'offline'}`); load(); }
    catch (e: any) { toast(e.message, false); }
  };

  if (!stats) return <SafeAreaView style={ui.screen}><Text style={[ui.description, { padding: 18 }]}>Loading your shop overview…</Text></SafeAreaView>;

  const metrics: Array<[string, string | number, string]> = [
    ['Online orders today', stats.todayOrders ?? 0, 'Excludes in-store POS sales'],
    ['Today sales', pkr(stats.todaySalesPaisa ?? 0), 'Shop sales recorded today'],
    ['Orders in progress', (stats.pendingOrders ?? 0) + (stats.preparingOrders ?? 0) + (stats.readyOrders ?? 0) + (stats.activeDeliveries ?? 0), 'From acceptance to delivery'],
    ['Low-stock products', stats.lowStockProducts ?? 0, 'At or below reorder level'],
  ];
  const pipeline: Array<[string, number]> = [
    ['Awaiting acceptance', stats.pendingOrders ?? 0], ['Preparing', stats.preparingOrders ?? 0],
    ['Ready for pickup', stats.readyOrders ?? 0], ['With your riders', stats.activeDeliveries ?? 0],
  ];
  const performance: Array<[string, string | number]> = [
    ['Delivered today', stats.completedToday ?? 0], ['7-day sales', pkr(stats.weekSalesPaisa ?? 0)],
    ['30-day sales', pkr(stats.monthSalesPaisa ?? 0)], ['30-day net earnings', pkr(stats.netEarningsPaisa ?? 0)],
    ['Commission (30d)', pkr(stats.commissionPaisa ?? 0)],
  ];

  return <SafeAreaView style={ui.screen} edges={['top']}><ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); load(); setRefreshing(false); }} />}>
    <Image source={require('../assets/brand/sirfbazar-horizontal-no-slogan.png')} style={ui.logo} accessibilityLabel="SirfBazar" />
    <View style={ui.shopRow}><Text style={ui.shopName} numberOfLines={1}>{profile?.shopName ?? 'Your shop'}</Text><View style={ui.presence}><Text style={ui.presenceText}>{stats.isOnline ? 'Online' : 'Offline'}</Text><Switch value={stats.isOnline} onValueChange={toggleOnline} trackColor={{ true: colors.primary }} accessibilityLabel="Shop available for orders" /></View></View>
    <Text style={ui.eyebrow}>Your shop, connected</Text><Text style={ui.title}>A good day starts here.</Text><Text style={ui.description}>Orders, stock and your own delivery team in one place.</Text><Text style={ui.status}>{stats.approvalStatus} · {stats.isOpen ? 'Store open' : 'Store closed'}</Text>
    <View style={ui.grid}>{metrics.map(([label, value, hint]) => <View key={label} style={ui.metric}><Text style={ui.metricLabel}>{label}</Text><Text style={ui.metricValue} numberOfLines={1}>{value}</Text><Text style={ui.metricHint}>{hint}</Text></View>)}</View>
    <View style={ui.focus}><Text style={ui.focusTitle}>Your focus today</Text><Text style={ui.focusText}>{stats.pendingOrders ?? 0} online orders awaiting acceptance</Text><Text style={ui.focusText}>{stats.lowStockProducts ?? 0} products running low</Text></View>
    <Text style={ui.sectionTitle}>Order pipeline</Text><View style={ui.panel}><Text style={ui.panelDescription}>Current online orders for your shop</Text>{pipeline.map(([label, count]) => <View key={label} style={ui.pipelineRow}><Text style={ui.pipelineLabel}>{label}</Text><Text style={ui.pipelineCount}>{count}</Text></View>)}</View>
    <Text style={ui.sectionTitle}>More performance</Text><View style={ui.panel}>{performance.map(([label, value]) => <View key={label} style={ui.other}><Text style={ui.pipelineLabel}>{label}</Text><Text style={ui.pipelineCount}>{value}</Text></View>)}</View>
    <Text style={ui.slogan} numberOfLines={1}>بازار وہی۔ طریقہ نیا۔</Text>
  </ScrollView></SafeAreaView>;
}
