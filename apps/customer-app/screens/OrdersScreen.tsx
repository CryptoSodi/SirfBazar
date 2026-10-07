import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { LoginSheet } from '../components/LoginSheet';
import { goTab, Icon, Notice, ProductArtwork, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, isLoggedIn, pkr } from '../lib/api';
import { refreshBadges } from '../lib/badges';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { isPastOrder, orderDeliveries, visibleOrderItems } from '../lib/order-presentation';
import { useTheme } from '../lib/theme';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { OrderStatusBadge } from './OrderSentScreen';

export default function OrdersScreen() {
  const { colors, s } = useTheme(); const inset = usePageInset(); const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<any[] | null>(null); const [needLogin, setNeedLogin] = useState(false); const [showLogin, setShowLogin] = useState(false);
  const [error, setError] = useState(''); const [filter, setFilter] = useState<'active' | 'past'>('active'); const [refreshing, setRefreshing] = useState(false);
  const revision = useRef(0);
  const load = useCallback(() => {
    const current = ++revision.current;
    void (async () => {
      const signedIn = await isLoggedIn();
      if (current !== revision.current) return;
      if (!signedIn) { setNeedLogin(true); setOrders(null); setError(''); return; }
      setNeedLogin(false);
      const result = await api.get('/orders');
      if (current !== revision.current) return;
      setOrders(result); setError('');
    })().catch((cause: any) => {
      if (current !== revision.current) return;
      if (cause.status === 401 || cause.status === 403) { setOrders(null); setNeedLogin(true); }
      setError(cause.message || 'Unable to load orders. Try again.');
    }).finally(() => { if (current === revision.current) setRefreshing(false); });
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeCustomerEvent('auth', () => { revision.current++; setOrders(null); setError(''); });
    return () => { revision.current++; unsubscribe(); };
  }, []);
  useLiveRefresh('orders', load);
  const shownOrders = (orders ?? []).filter((order) => filter === 'past' ? isPastOrder(order) : !isPastOrder(order));
  return <View style={s.screen}>
    {needLogin ? <View style={{ padding: inset }}><StatePanel icon="bag" title="Your orders, all in one place." message="Sign in to track deliveries and see your order history." action="Sign in" onPress={() => setShowLogin(true)} secondaryAction="Back to shopping" onSecondary={() => goTab(navigation, 'HomeTab')} /></View> : <FlatList
      contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }} data={shownOrders} keyExtractor={(order) => order.id} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      ListHeaderComponent={<>
        <Text accessibilityRole="header" style={s.h1}>Your orders</Text><Text style={[s.muted, { marginTop: 8 }]}>Track what’s coming. Review what arrived.</Text>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 16 }}>{(['active', 'past'] as const).map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: filter === value ? colors.action : colors.border, backgroundColor: filter === value ? colors.action : colors.card, justifyContent: 'center' }}><Text style={{ fontSize: 12, color: filter === value ? '#fff' : colors.muted }}>{value === 'active' ? 'Active' : 'Past orders'}</Text></TouchableOpacity>)}</View>
        {!!error && orders && <View style={{ marginTop: 16 }}><Notice danger>{error} Your last confirmed orders are still shown.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={load}><Text style={s.btnGhostText}>Refresh orders</Text></TouchableOpacity></View>}
      </>}
      ListEmptyComponent={<StatePanel icon="bag" loading={!orders && !error} title={!!error && !orders ? 'Couldn’t load orders' : orders ? filter === 'past' ? 'No past orders yet.' : 'No active orders.' : 'Loading your orders…'} message={!!error && !orders ? `${error} Try loading your orders again.` : orders ? filter === 'past' ? 'Completed and cancelled orders will appear here.' : 'Find your everyday essentials from nearby shops.' : undefined} action={!!error && !orders ? 'Try again' : orders && filter === 'active' ? 'Start shopping' : undefined} onPress={!!error && !orders ? load : () => goTab(navigation, 'HomeTab')} />}
      ListFooterComponent={orders && orders.length >= 50 ? <Text style={[s.faint, { marginTop: 20, lineHeight: 17 }]}>Showing your 50 most recent orders.</Text> : null}
      renderItem={({ item: order }) => {
        const deliveries = orderDeliveries(order); const multi = deliveries.length > 1; const items = deliveries.flatMap(visibleOrderItems); const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0); const past = isPastOrder(order);
        return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${past ? 'View' : 'Track'} order ${order.orderNumber}`} onPress={() => navigation.navigate('OrderDetail', { orderId: order.id, mode: past ? 'details' : 'tracking' })} style={[s.card, { marginTop: 12 }]}>
          <View style={[s.spread, { gap: 8, alignItems: 'flex-start' }]}><Text style={[s.body, { fontWeight: '700', flex: 1 }]}>{multi ? `Order from ${deliveries.length} shops` : deliveries[0]?.merchant?.shopName ?? 'Your local shop'}</Text><OrderStatusBadge status={order.status} /></View>
          <Text style={[s.muted, { marginTop: 8 }]}>{order.orderNumber} · {multi ? `${deliveries.length} separate deliveries` : `${quantity} ${quantity === 1 ? 'item' : 'items'}`}</Text>
          {!multi && <View style={[s.row, { gap: 8, marginTop: 12 }]}>{items.slice(0, 3).map((item) => <View key={item.id} style={{ width: 51 }}><ProductArtwork uri={item.productImageSnapshot} name={item.productNameSnapshot} size={48} /></View>)}<Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginStart: 'auto', fontVariant: ['tabular-nums'] }}>{pkr(order.totalAmountPaisa)}</Text></View>}
          <View style={[s.spread, { marginTop: multi ? 12 : 16 }]}><Text style={{ color: colors.primary, fontSize: 12, lineHeight: 18 }}>{past ? 'View order details' : multi ? 'View each delivery' : 'Track delivery'}</Text><Icon name="arrow" size={18} color={colors.primary} /></View>
        </TouchableOpacity>;
      }}
    />}
    <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); refreshBadges(); }} />
  </View>;
}
