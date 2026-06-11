import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function DashboardScreen() {
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.get('/merchant/dashboard').then(setStats).catch(() => undefined);
    api.get('/merchant/profile').then(setProfile).catch(() => undefined);
  }, []);

  useFocusEffect(load);

  const toggleOnline = async (value: boolean) => {
    try {
      await api.post(`/merchant/${value ? 'online' : 'offline'}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!stats) return <Text style={[s.muted, s.pad]}>Loading dashboard…</Text>;

  const tiles: Array<[string, string | number]> = [
    ['Today orders', stats.todayOrders],
    ['Pending', stats.pendingOrders],
    ['Preparing', stats.preparingOrders],
    ['Ready', stats.readyOrders],
    ['Out for delivery', stats.activeDeliveries],
    ['Delivered today', stats.completedToday],
    ['Today sales', pkr(stats.todaySalesPaisa)],
    ['7-day sales', pkr(stats.weekSalesPaisa)],
    ['30-day sales', pkr(stats.monthSalesPaisa)],
    ['30-day net earnings', pkr(stats.netEarningsPaisa)],
    ['Commission (30d)', pkr(stats.commissionPaisa)],
    ['Low stock items', stats.lowStockProducts],
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={s.spread}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{profile?.shopName ?? 'Your shop'}</Text>
            <Text style={s.muted}>
              ⭐ {stats.ratingAverage?.toFixed?.(1) ?? '–'} ({stats.ratingCount}) · {stats.approvalStatus}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Switch
              value={stats.isOnline}
              onValueChange={toggleOnline}
              trackColor={{ true: colors.primary }}
            />
            <Text style={[s.faint, { marginTop: 2 }]}>{stats.isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {stats.pendingOrders > 0 && (
          <View style={[s.card, { marginTop: 12, backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
            <Text style={{ color: colors.amber, fontWeight: '800' }}>
              🔔 {stats.pendingOrders} new order{stats.pendingOrders > 1 ? 's' : ''} waiting for your response!
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {tiles.map(([label, value]) => (
            <View key={label} style={[s.card, { width: '48%' as any, flexGrow: 1 }]}>
              <Text style={s.faint}>{label}</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 }}>{value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
