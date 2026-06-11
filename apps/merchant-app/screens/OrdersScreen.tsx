import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';

const FILTERS = [
  ['', 'All'],
  ['SENT_TO_MERCHANT', 'New'],
  ['MERCHANT_ACCEPTED', 'Accepted'],
  ['PREPARING', 'Preparing'],
  ['READY_FOR_PICKUP', 'Ready'],
  ['ON_THE_WAY', 'On the way'],
  ['DELIVERED', 'Delivered'],
] as const;

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.get(`/merchant/orders${filter ? `?status=${filter}` : ''}`).then(setOrders).catch(() => undefined);
  }, [filter]);

  useFocusEffect(load);
  useEffect(() => {
    timer.current = setInterval(load, 10000); // poll for new orders
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <Text style={s.h1}>Orders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {FILTERS.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => setFilter(value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                marginRight: 6,
                backgroundColor: filter === value ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: filter === value ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: filter === value ? '#fff' : colors.muted, fontSize: 12, fontWeight: '700' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={orders}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No orders here.</Text>}
        renderItem={({ item: o }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}>
            <View style={s.spread}>
              <Text style={[s.body, { fontWeight: '800' }]}>{o.orderNumber}</Text>
              <Text style={{ fontWeight: '800' }}>{pkr(o.totalAmountPaisa)}</Text>
            </View>
            <Text style={s.faint}>
              {o.customer?.user?.fullName ?? 'Customer'} · {o.items?.length ?? 0} items · {o.paymentMethod}
            </Text>
            <View style={[s.spread, { marginTop: 6 }]}>
              <Text
                style={{
                  color: o.status === 'SENT_TO_MERCHANT' ? colors.amber : o.status === 'DELIVERED' ? colors.primary : colors.muted,
                  fontWeight: '800',
                  fontSize: 12,
                  textTransform: 'capitalize',
                }}
              >
                {o.status === 'SENT_TO_MERCHANT' ? '🔔 NEW — respond now' : statusLabel(o.status)}
              </Text>
              <Text style={s.faint}>{new Date(o.createdAt).toLocaleTimeString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
