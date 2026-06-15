import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.get('/rider/profile').then(setProfile).catch(() => undefined);
    api.get('/rider/orders/assigned').then(setOrders).catch(() => undefined);
  }, []);

  useFocusEffect(load);
  useEffect(() => {
    timer.current = setInterval(load, 10000); // poll for new assignments
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    try {
      await api.post(`/rider/${value ? 'online' : 'offline'}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.pad}>
        <View style={s.spread}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>🛵 {profile?.fullName ?? 'Rider'}</Text>
            <Text style={s.muted}>Shop: {profile?.merchant?.shopName ?? '—'}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Switch
              value={profile?.isOnline ?? false}
              onValueChange={toggleOnline}
              disabled={profile?.approvalStatus !== 'APPROVED'}
              trackColor={{ true: colors.primary }}
            />
            <Text style={[s.faint, { marginTop: 2 }]}>{profile?.isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {profile?.approvalStatus === 'PENDING' && (
          <View style={{ marginTop: 14, backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: colors.amber, fontWeight: '800' }}>⏳ Waiting for shop approval</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>
              {profile?.merchant?.shopName ?? 'The shop'} hasn't approved your rider request yet. You'll be able to go online once approved.
            </Text>
          </View>
        )}

        <Text style={[s.h2, { marginTop: 18, marginBottom: 8 }]}>Assigned deliveries</Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={orders}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ fontSize: 36 }}>😴</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>
              No deliveries right now. Stay online — assignments appear here automatically.
            </Text>
          </View>
        }
        renderItem={({ item: o }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Delivery', { orderId: o.id })}>
            <View style={s.spread}>
              <Text style={[s.body, { fontWeight: '800' }]}>{o.orderNumber}</Text>
              <Text style={{ fontWeight: '800' }}>{pkr(o.totalAmountPaisa)}</Text>
            </View>
            <Text style={s.faint}>
              📍 Pickup: {o.merchant?.shopName} → 🏠 {o.deliveryAddress?.area ?? o.deliveryAddress?.city}
            </Text>
            <View style={[s.spread, { marginTop: 6 }]}>
              <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 12, textTransform: 'capitalize' }}>
                {statusLabel(o.status)}
              </Text>
              <Text style={s.faint}>{o.paymentMethod === 'COD' ? `💵 Collect ${pkr(o.totalAmountPaisa)}` : '✅ Prepaid'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={[s.pad, s.row, { gap: 8 }]}>
        <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => navigation.navigate('History')}>
          <Text style={s.btnGhostText}>📜 History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btnGhost, { flex: 1 }]}
          onPress={async () => {
            await clearAuth();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <Text style={s.btnGhostText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
