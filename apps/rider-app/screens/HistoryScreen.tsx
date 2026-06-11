import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { api, pkr, statusLabel } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function HistoryScreen() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    api.get('/rider/orders/history').then(setOrders).catch(() => undefined);
  }, []);

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={orders}
      keyExtractor={(o) => o.id}
      ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No completed deliveries yet.</Text>}
      renderItem={({ item: o }) => (
        <View style={[s.card, s.spread]}>
          <View>
            <Text style={[s.body, { fontWeight: '700' }]}>{o.orderNumber}</Text>
            <Text style={s.faint}>
              {o.merchant?.shopName} · {o.deliveredAt ? new Date(o.deliveredAt).toLocaleString() : new Date(o.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontWeight: '800' }}>{pkr(o.totalAmountPaisa)}</Text>
            <Text style={{ color: o.status === 'DELIVERED' ? colors.primary : colors.danger, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
              {statusLabel(o.status)}
            </Text>
          </View>
        </View>
      )}
    />
  );
}
