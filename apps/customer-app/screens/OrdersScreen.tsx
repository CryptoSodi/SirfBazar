import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, isLoggedIn, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';
import { refreshBadges } from '../lib/badges';

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const load = useCallback(() => {
    (async () => {
      if (!(await isLoggedIn())) {
        setNeedLogin(true);
        setOrders(null);
        return;
      }
      setNeedLogin(false);
      api.get('/orders').then(setOrders).catch(() => setOrders([]));
    })();
  }, []);

  useFocusEffect(load);

  if (needLogin) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <View style={[s.pad, { alignItems: 'center', marginTop: 60 }]}>
          <Text style={{ fontSize: 40 }}>📦</Text>
          <Text style={[s.h2, { marginTop: 8 }]}>Login to see your orders</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 14 }]} onPress={() => setShowLogin(true)}>
            <Text style={s.btnText}>Login</Text>
          </TouchableOpacity>
        </View>
        <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); refreshBadges(); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        contentContainerStyle={[s.pad, { gap: 8 }]}
        data={orders ?? []}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={<Text style={[s.h1, { marginBottom: 8 }]}>Your orders</Text>}
        ListEmptyComponent={
          orders ? <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No orders yet.</Text> : <Text style={s.muted}>Loading…</Text>
        }
        renderItem={({ item: o }) => {
          const shops = o.isParent
            ? (o.children ?? []).map((c: any) => c.merchant?.shopName).filter(Boolean).join(', ')
            : o.merchant?.shopName;
          return (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}>
              <View style={s.spread}>
                <Text style={[s.body, { fontWeight: '700' }]}>{o.orderNumber}</Text>
                <Text style={{ fontWeight: '800' }}>{pkr(o.totalAmountPaisa)}</Text>
              </View>
              <Text style={s.faint} numberOfLines={1}>🏪 {shops}</Text>
              <View style={[s.spread, { marginTop: 6 }]}>
                <Text style={{ color: o.status === 'DELIVERED' ? colors.primary : colors.amber, fontSize: 12, fontWeight: '700' }}>
                  {statusLabel(o.status)}
                </Text>
                <Text style={s.faint}>{new Date(o.createdAt).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
