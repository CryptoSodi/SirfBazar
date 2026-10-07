import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, H1, Icon, IconBox, Label, Note, Page } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { api, ApiError, pkr } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';
import type { RiderOrder } from '../lib/rider-orders';

type Filter = 'All' | 'Delivered' | 'Exceptions';
export default function RiderHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const data = await api.get('/rider/orders/history');
      if (!Array.isArray(data)) throw new Error('History was not returned. Try again.');
      setOrders(data); setPhase('ready'); setMessage('');
    } catch (e: any) {
      setOrders([]);
      if (e instanceof ApiError && e.status === 401) navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      else { setPhase('error'); setMessage(e?.message ?? 'Could not load history. Try again.'); }
    }
  }, [navigation]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const onTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  const shown = orders.filter((order) => filter === 'All' || (filter === 'Delivered' ? order.status === 'DELIVERED' : order.status !== 'DELIVERED'));
  return <Page activeTab="History" onTab={onTab}>
    <Label>YOUR RECENT WORK</Label><H1 style={{ marginTop: 8 }}>Delivery history</H1><Body muted style={{ marginTop: 8 }}>Review orders assigned to you.</Body>
    <View style={{ flexDirection: 'row', padding: 4, marginTop: 18, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.line, borderRadius: 12 }}>{(['All', 'Delivered', 'Exceptions'] as Filter[]).map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: name === filter }} onPress={() => setFilter(name)} style={{ flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: name === filter ? palette.surface : 'transparent' }}><Text style={{ color: name === filter ? palette.ink : palette.muted, fontWeight: '700', fontSize: 12 }}>{name}</Text></Pressable>)}</View>
    <Body muted small style={{ marginTop: 17 }}>Recent records · up to 50 returned by the API</Body>
    {phase === 'loading' && <Body muted style={{ marginTop: 24 }}>Loading recent deliveries…</Body>}
    {phase === 'error' && <><Note tone="red" style={{ marginTop: 22 }}>{message}</Note><Button onPress={() => void load()} icon="refresh" style={{ marginTop: 16 }}>Try again</Button></>}
    {phase === 'ready' && shown.length === 0 && <View style={{ alignItems: 'center', marginTop: 36 }}><IconBox name="history" size={76} /><H1 center style={{ marginTop: 20, fontSize: 22 }}>No {filter === 'All' ? 'recent records' : filter.toLowerCase()} yet.</H1><Body muted style={{ textAlign: 'center', marginTop: 8 }}>Assigned orders appear here after they leave active delivery.</Body></View>}
    {phase === 'ready' && shown.map((order) => <Pressable key={order.id} accessibilityRole="button" accessibilityLabel={`Open order ${order.orderNumber}`} onPress={() => navigation.navigate('Delivery', { orderId: order.id })} style={{ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: palette.line }}><IconBox name={order.status === 'DELIVERED' ? 'check' : 'warning'} tone={order.status === 'DELIVERED' ? 'green' : 'amber'} /><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 13, fontWeight: '700' }}>{order.orderNumber}</Text><Body muted small style={{ marginTop: 5 }}>{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</Body><Body muted small style={{ marginTop: 5 }}>{order.status === 'DELIVERED' ? 'Delivered' : order.status.replace(/_/g, ' ').toLowerCase()}</Body></View><View style={{ alignItems: 'flex-end' }}><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 14 }}>{pkr(order.totalAmountPaisa)}</Text><Body muted small>Order value</Body></View><Icon name="chevron" color={palette.ink} size={17} /></Pressable>)}
    {phase === 'ready' && orders.length > 0 && <Note icon="cash" style={{ marginTop: 22 }}>Order values are customer payments. This is not a rider earnings or cash-balance report.</Note>}
  </Page>;
}
