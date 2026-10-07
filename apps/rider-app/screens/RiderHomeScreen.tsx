import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, Card, H1, H2, Icon, IconBox, LinkButton, Note, Page } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { api, ApiError, clearAuth, pkr } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';
import { customerName, isActive, paymentInstruction, withoutDeliveryCode } from '../lib/rider-orders';
import type { RiderOrder } from '../lib/rider-orders';

type Profile = { fullName?: string; isOnline?: boolean; isActive?: boolean; approvalStatus?: string; merchant?: { shopName?: string; phoneNumber?: string } };

export default function RiderHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'expired' | 'inactive' | 'pending'>('loading');
  const [message, setMessage] = useState('');
  const [presenceBusy, setPresenceBusy] = useState(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setPhase('loading');
    try {
      const [nextProfile, nextOrders] = await Promise.all([api.get('/rider/profile'), api.get('/rider/orders/assigned')]);
      if (!Array.isArray(nextOrders)) throw new Error('The delivery list was not returned. Try again.');
      setProfile(nextProfile);
      setOrders(nextOrders.map(withoutDeliveryCode));
      setPhase(nextProfile?.approvalStatus === 'PENDING' ? 'pending' : nextProfile?.isActive === false ? 'inactive' : 'ready');
      setMessage('');
    } catch (e: any) {
      setOrders([]);
      setProfile(null);
      const status = e instanceof ApiError ? e.status : 0;
      setPhase(status === 401 ? 'expired' : status === 403 ? 'inactive' : 'error');
      setMessage(e?.message ?? 'Check your connection and try again.');
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]));

  const goTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  const toggleOnline = async () => {
    if (!profile || presenceBusy || profile.approvalStatus !== 'APPROVED') return;
    setPresenceBusy(true);
    try {
      await api.post(profile.isOnline ? '/rider/offline' : '/rider/online');
      await load();
    } catch (e: any) { setMessage(e?.message ?? 'Could not update online status. Try again.'); }
    finally { setPresenceBusy(false); }
  };
  const current = orders.find((order) => isActive(order.status));
  const other = orders.filter((order) => order.id !== current?.id);
  const name = profile?.fullName?.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'R';

  return <Page activeTab="Deliveries" onTab={goTab}>
    {phase === 'loading' && <><H1>Your deliveries</H1><Body muted style={{ marginTop: 8 }}>Checking with your shop…</Body>{[54, 292, 80].map((height, index) => <View key={index} style={{ height, backgroundColor: palette.surface2, borderRadius: 14, marginTop: 14 }} />)}</>}
    {phase === 'error' && <View style={{ alignItems: 'center', paddingTop: 46 }}><IconBox name="wifi" tone="red" size={76} /><H1 center style={{ marginTop: 24 }}>Couldn’t load{ '\n' }your deliveries.</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>We couldn’t reach the service. Your assignments haven’t been changed.</Body><Button onPress={() => void load(true)} icon="refresh" style={{ marginTop: 26 }}>Try again</Button><Body muted small style={{ marginTop: 22, textAlign: 'center' }}>This is a connection problem, not an empty delivery list.</Body></View>}
    {phase === 'expired' && <View style={{ alignItems: 'center', paddingTop: 46 }}><IconBox name="lock" size={76} /><H1 center style={{ marginTop: 24 }}>Sign in again{ '\n' }to continue.</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>Your session has ended. We’ve hidden private delivery details until you sign in.</Body><Note icon="shield" style={{ marginTop: 22 }}>After signing in, refresh the order before taking your next delivery action.</Note><Button onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} icon="arrow" style={{ marginTop: 26 }}>Sign in</Button></View>}
    {phase === 'inactive' && <View style={{ alignItems: 'center', paddingTop: 46 }}><IconBox name="shield" tone="amber" size={76} /><View style={{ marginTop: 20 }}><Badge tone="amber">Account inactive</Badge></View><H1 center style={{ marginTop: 24 }}>Check in with{ '\n' }your shop.</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>{profile?.merchant?.shopName ?? 'Your shop'} manages your rider access. Contact the owner to review your account.</Body><Note style={{ marginTop: 22 }}>This is different from being offline. The Online switch cannot reactivate an account.</Note><Button onPress={() => navigation.navigate('Help')} icon="phone" style={{ marginTop: 26 }}>Contact your shop</Button></View>}
    {phase === 'pending' && <View style={{ alignItems: 'center', paddingTop: 28 }}><IconBox name="clock" tone="amber" size={76} /><View style={{ marginTop: 20 }}><Badge tone="amber">Awaiting shop approval</Badge></View><H1 center style={{ marginTop: 24 }}>You’re nearly{ '\n' }on the team.</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>Your request was sent to {profile?.merchant?.shopName ?? 'your shop'}.</Body><Card style={{ alignSelf: 'stretch', marginTop: 22 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="check" /><View><H2 style={{ fontSize: 16 }}>Request submitted</H2><Body muted small>Your shop has your details.</Body></View></View><View style={{ height: 1, backgroundColor: palette.line, marginVertical: 16 }} /><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="clock" tone="amber" /><View><H2 style={{ fontSize: 16 }}>Shop review</H2><Body muted small>Waiting for the owner’s decision.</Body></View></View></Card><Note style={{ alignSelf: 'stretch', marginTop: 22 }}>No need to apply again. Check with your shop owner if you need an update.</Note><LinkButton onPress={() => void load(true)} icon="refresh" style={{ marginTop: 16 }}>Check approval status</LinkButton><Button variant="secondary" onPress={async () => { await clearAuth(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }} style={{ marginTop: 14 }}>Back to sign in</Button></View>}
    {phase === 'ready' && <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <View style={{ flex: 1 }}><Body muted small>{profile?.merchant?.shopName ?? 'Your delivery shop'}</Body><H1 style={{ marginTop: 6 }}>Your deliveries</H1></View>
        <View style={{ width: 45, height: 45, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.mint }}><Text style={{ color: palette.accent, fontSize: 16, fontWeight: '700' }}>{name}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 15, minHeight: 46 }}>
        <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name={profile?.isOnline ? "online" : "offline"} color={profile?.isOnline ? palette.action : palette.quiet} size={18} /><Text style={{ color: palette.ink, fontSize: 14, fontWeight: "700" }}>You’re {profile?.isOnline ? "online" : "offline"}</Text></View><Body muted small style={{ marginTop: 4 }}>Your shop can see your online status.</Body></View>
        <Pressable accessibilityRole="switch" accessibilityLabel="Available for deliveries" accessibilityState={{ checked: !!profile?.isOnline, disabled: presenceBusy || profile?.approvalStatus !== 'APPROVED' }} disabled={presenceBusy || profile?.approvalStatus !== 'APPROVED'} onPress={toggleOnline} style={{ width: 46, minHeight: 44, justifyContent: 'center', opacity: presenceBusy ? 0.5 : 1 }}><View style={{ width: 46, height: 28, borderRadius: 18, backgroundColor: profile?.isOnline ? palette.action : palette.control, padding: 3 }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignSelf: profile?.isOnline ? 'flex-end' : 'flex-start' }} /></View></Pressable>
      </View>
      {!!message && <Note tone="red" style={{ marginBottom: 12 }}>{message}</Note>}
      {profile?.approvalStatus === 'PENDING' && <Note icon="clock" tone="amber" style={{ marginBottom: 16 }}>Awaiting approval from {profile.merchant?.shopName ?? 'your shop'}. You can deliver after the owner approves and activates your account.</Note>}
      {current ? <>
        <View style={{ backgroundColor: palette.hero, borderRadius: 22, padding: 20, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: palette.heroQuiet, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }}>{current.status === 'RIDER_ASSIGNED' ? 'PICKUP NEXT' : 'DELIVERY IN PROGRESS'}</Text><View style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#FFFFFF22', borderWidth: 1, borderColor: '#FFFFFF22' }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{current.orderNumber}</Text></View></View>
          <Text style={{ color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700', marginTop: 13, maxWidth: 240 }}>{current.status === 'RIDER_ASSIGNED' || current.status === 'RIDER_ARRIVED_AT_SHOP' ? 'Pick up your order.' : 'Head to the customer.'}</Text>
          <View style={{ marginTop: 20, gap: 22 }}>
            <View style={{ flexDirection: 'row', gap: 13 }}><View style={{ width: 12, height: 12, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 6, marginTop: 4 }} /><View style={{ flex: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{current.merchant?.shopName ?? profile?.merchant?.shopName ?? 'Pickup shop'}</Text><Body small style={{ color: palette.heroQuiet, marginTop: 3 }}>{current.merchant?.address ?? 'Address in order details'}</Body></View></View>
            <View style={{ flexDirection: 'row', gap: 13 }}><View style={{ width: 12, height: 12, borderWidth: 2, borderColor: palette.heroQuiet, borderRadius: 3, marginTop: 4 }} /><View style={{ flex: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{customerName(current)} · {current.deliveryAddress?.area ?? current.deliveryAddress?.city ?? 'Drop-off'}</Text><Body small style={{ color: palette.heroQuiet, marginTop: 3 }}>Full address in order</Body></View></View>
          </View>
          <View style={{ height: 1, backgroundColor: palette.heroLine, marginVertical: 15 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Icon name="box" color="#FFFFFF" size={18} /><Body small style={{ color: '#FFFFFF' }}>{current.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} items</Body></View><Body small style={{ color: '#FFFFFF', fontWeight: '700' }}>{paymentInstruction(current) === 'collect' ? `Collect ${pkr(current.totalAmountPaisa)}` : paymentInstruction(current) === 'paid' ? 'Payment confirmed' : 'Check payment details'}</Body></View>
          <Button variant="hero" onPress={() => navigation.navigate('Delivery', { orderId: current.id })} icon="arrow">View delivery</Button>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}><Card style={{ flex: 1, borderRadius: 17, paddingVertical: 15, paddingHorizontal: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.ink, fontSize: 25, fontWeight: '700' }}>{orders.length}</Text><Icon name="box" size={18} color={palette.accent} /></View><Body muted small style={{ marginTop: 6 }}>Assigned deliveries</Body></Card><Card style={{ flex: 1, borderRadius: 17, paddingVertical: 15, paddingHorizontal: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.ink, fontSize: 25, fontWeight: '700' }}>1</Text><Icon name="shop" size={18} color={palette.accent} /></View><Body muted small style={{ marginTop: 6 }}>Your delivery shop</Body></Card></View>
        {other.length > 0 && <><View style={{ marginTop: 23, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' }}><H2 style={{ fontSize: 16 }}>Also assigned</H2><Body muted small>From your shop</Body></View>{other.map((order) => <Pressable key={order.id} accessibilityRole="button" accessibilityLabel={`Open delivery ${order.orderNumber}`} onPress={() => navigation.navigate('Delivery', { orderId: order.id })} style={{ backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 }}><IconBox name="box" /><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 14 }}>{order.orderNumber}</Text><Body muted small>{customerName(order)} · {order.deliveryAddress?.area ?? 'Drop-off'}</Body></View><Icon name="chevron" size={17} color={palette.quiet} /></Pressable>)}</>}
      </> : <View style={{ alignItems: 'center', paddingTop: 34 }}><IconBox name="box" size={84} /><H2 style={{ marginTop: 34, textAlign: 'center' }}>Nothing assigned yet.</H2><Body muted style={{ marginTop: 12, textAlign: 'center' }}>New deliveries appear here after your shop assigns them to you.</Body><Button variant="secondary" onPress={() => void load(true)} icon="refresh" style={{ marginTop: 22 }}>Refresh deliveries</Button><Card style={{ width: '100%', marginTop: 22 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="shop" /><View><H2 style={{ fontSize: 16 }}>Your delivery shop</H2><Body muted small>{profile?.merchant?.shopName ?? 'Your shop'}</Body></View></View><LinkButton onPress={() => navigation.navigate('Help')} icon="arrow" style={{ marginTop: 12 }}>Contact your shop</LinkButton></Card></View>}
    </>}
  </Page>;
}
