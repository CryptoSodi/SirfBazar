import { ToastMessage } from '../components/Toast';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, Card, CashCard, CheckRow, Divider, Dock, H1, H2, Icon, IconBox, Label, LinkButton, Note, Page, Progress, Sheet } from '../components/RiderUI';
import { api, ApiError, getAuthVersion, isLoggedIn, pkr } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';
import { customerName, customerPhone, destination, paymentInstruction, waitingForPacking, withoutDeliveryCode } from '../lib/rider-orders';
import type { RiderOrder } from '../lib/rider-orders';
import { RiderMapArtwork } from '../components/RiderMapArtwork';

type Step = 'waiting' | 'assigned' | 'pickup' | 'on-way' | 'doorstep' | 'code' | 'complete' | 'offline' | 'unknown' | 'expired' | 'error';
const stepFor = (status: string): Step => waitingForPacking(status) ? 'waiting' : status === 'RIDER_ASSIGNED' ? 'assigned' : status === 'RIDER_ARRIVED_AT_SHOP' ? 'pickup' : status === 'RIDER_ARRIVED_AT_CUSTOMER' ? 'doorstep' : status === 'DELIVERED' ? 'complete' : status === 'ON_THE_WAY' || status === 'PICKED_UP' ? 'on-way' : 'error';
async function dial(phone?: string) {
  const number = phone?.replace(/[^+0-9]/g, '');
  if (number) await Linking.openURL(`tel:${number}`);
}
async function maps(lat?: number | null, lng?: number | null, address?: string) {
  const query = lat != null && lng != null ? `${lat},${lng}` : address?.trim();
  if (query) await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`);
}

export default function RiderDeliveryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Delivery'>>();
  const { palette } = useRiderTheme();
  const id = params.orderId;
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [step, setStep] = useState<Step>('assigned');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState(false);
  const [handed, setHanded] = useState(false);
  const [cash, setCash] = useState(false);
  const [code, setCode] = useState('');
  const [pickupSheet, setPickupSheet] = useState(false);
  const [uncertainAction, setUncertainAction] = useState<'arrived-shop' | 'picked-up' | 'arrived-customer' | 'delivered'>('delivered');
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [locationError, setLocationError] = useState('');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => listener.remove();
  }, []);

  const refresh = useCallback(async (keepStale = true): Promise<RiderOrder | null> => {
    try {
      const next = withoutDeliveryCode(await api.get(`/rider/orders/${id}`)) as RiderOrder;
      setOrder(next); setStep(stepFor(next.status)); setMessage('');
      return next;
    } catch (e: any) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401) { setOrder(null); setStep('expired'); }
      else if (keepStale && order && status === 0) setStep('offline');
      else { setOrder(null); setStep('error'); }
      setMessage(e?.message ?? 'Unable to check this delivery. Try again.');
      return null;
    } finally { setLoading(false); }
  }, [id, order]);
  useEffect(() => { setOrder(null); setLoading(true); void refresh(false); }, [id]);

  // An early assignment remains in preparation until the shop marks it packed.
  useEffect(() => {
    if (!focused || !appActive || step !== 'waiting') return;
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [focused, appActive, step, refresh]);

  // This is the foreground behavior of the former DeliveryScreen, scoped to the
  // mounted, focused route and its assigned active order. No background task runs.
  useEffect(() => {
    const active = ['RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP', 'PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'];
    if (!focused || !appActive || !order || !active.includes(order.status) || step === 'expired' || step === 'unknown') return;
    const generation = getAuthVersion();
    let stopped = false;
    let subscription: Location.LocationSubscription | null = null;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (stopped || generation !== getAuthVersion()) return;
      if (permission.status !== 'granted') { setLocationError('Location permission is off. Enable it to share your position during this delivery.'); return; }
      setLocationError('');
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 }, (position) => {
        if (stopped || generation !== getAuthVersion() || AppState.currentState !== 'active') return;
        void api.post('/rider/location', { orderId: id, latitude: position.coords.latitude, longitude: position.coords.longitude,
          speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined }).catch(() => undefined);
      });
      if (stopped) subscription.remove();
    })().catch(() => { if (!stopped) setLocationError('Location is unavailable. Check device settings and reconnect.'); });
    return () => { stopped = true; subscription?.remove(); };
  }, [focused, appActive, order?.id, order?.status, step, id]);

  const payment = order ? paymentInstruction(order) : 'check';
  const amount = pkr(order?.totalAmountPaisa);
  const shop = order?.merchant?.shopName ?? 'Your shop';
  const person = order ? customerName(order) : 'Customer';
  const address = order ? destination(order) : '';
  const goHelp = () => navigation.navigate('Report', { orderId: id });
  const back = () => step === 'code' ? setStep('doorstep') : navigation.goBack();
  const callShop = () => void dial(order?.merchant?.phoneNumber).catch(() => setMessage('Unable to open the phone dialer.'));
  const callCustomer = () => void dial(order ? customerPhone(order) : undefined).catch(() => setMessage('Unable to open the phone dialer.'));
  const navigateShop = () => void maps(order?.merchant?.latitude, order?.merchant?.longitude, order?.merchant?.address).catch(() => setMessage('Unable to open navigation. Use the address shown here.'));
  const navigateCustomer = () => void maps(order?.deliveryAddress?.latitude, order?.deliveryAddress?.longitude, address).catch(() => setMessage('Unable to open navigation. Use the address shown here.'));

  const mutate = async (action: 'arrived-shop' | 'picked-up' | 'arrived-customer') => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await api.post(`/rider/orders/${id}/${action}`, {});
      const saved = await refresh();
      if (!saved && await isLoggedIn()) { setUncertainAction(action); setStep('unknown'); }
      if (action === 'picked-up') setPickupSheet(false);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setOrder(null); setStep('expired'); setPickupSheet(false); }
      else if (!(e instanceof ApiError) || e.status >= 500) {
        setUncertainAction(action); setStep('unknown'); setPickupSheet(false);
        setMessage('The update may have reached your shop. Check its saved status before trying again.');
      } else setMessage(e?.message ?? 'The update was not confirmed. Check the saved status.');
    } finally { setBusy(false); }
  };
  const complete = async () => {
    if (busy || code.length !== 4 || !handed || (payment === 'collect' && !cash) || payment === 'check') return;
    setBusy(true); setMessage('');
    try {
      await api.post(`/rider/orders/${id}/delivered`, { otp: code });
      const saved = await refresh();
      if (saved?.status !== 'DELIVERED' && await isLoggedIn()) { setUncertainAction('delivered'); setStep('unknown'); }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setOrder(null); setStep('expired'); }
      else if (!(e instanceof ApiError) || e.status >= 500) { setUncertainAction('delivered'); setStep('unknown'); }
      else setMessage(e?.message ?? 'Check the code and try again.');
    } finally { setBusy(false); }
  };
  const reconcile = async () => {
    setBusy(true);
    try {
      const next = withoutDeliveryCode(await api.get(`/rider/orders/${id}`)) as RiderOrder;
      setOrder(next); setStep(stepFor(next.status));
      setMessage(next.status === 'DELIVERED' ? '' : 'The saved delivery is not confirmed as delivered. Check with your shop before retrying.');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setOrder(null); setStep('expired'); }
      else setMessage(e?.message ?? 'Still unable to check the saved status. Contact your shop.');
    }
    finally { setBusy(false); }
  };

  if (loading) return <Page title="Delivery details" back={back}><H1>Checking delivery…</H1><View style={{ height: 280, borderRadius: 20, backgroundColor: palette.surface2, marginTop: 20 }} /></Page>;
  if (step === 'expired') return <Page title="Session ended" back={back} dock={<Dock label="Sign in" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} />}><CenteredState icon="lock" heading={<>Sign in again{'\n'}to continue.</>} description="Your session has ended. We’ve hidden private delivery details until you sign in." /><Note icon="shield" style={{ marginTop: 22 }}>After signing in, refresh the order before taking your next delivery action.</Note></Page>;
  if (step === 'error' || !order) return <Page title="Delivery details" back={back} dock={<Dock label="Try again" onPress={() => { setLoading(true); void refresh(false); }} icon="refresh" />}><CenteredState icon="wifi" heading={<>Couldn’t load{'\n'}this delivery.</>} description={message || 'Check your connection and try again.'} tone="red" /></Page>;
  if (step === 'waiting') return <Page title="Assigned delivery" back={back} dock={<Dock label="Check pickup status" onPress={() => void refresh()} icon="refresh" />}><Badge tone="amber">Waiting for packing</Badge><H1 style={{ marginTop: 20 }}>The shop is{'\n'}preparing this order.</H1><Body muted style={{ marginTop: 12 }}>Order {order.orderNumber} is assigned to you. Pickup will become available when {shop} marks it ready.</Body><Card style={{ marginTop: 22 }}><H2>{shop}</H2><Body muted style={{ marginTop: 8 }}>{order.merchant?.address}</Body><Button variant="secondary" onPress={callShop} icon="phone" style={{ marginTop: 16 }}>Call shop</Button></Card><Note icon="box" style={{ marginTop: 22 }}>Wait for the packed order before confirming pickup. The customer still sees Preparing.</Note>{!!message && <ToastMessage>{message}</ToastMessage>}</Page>;
  if (step === 'unknown') return <Page title="Check delivery status" back={back} dock={<Dock label={busy ? 'Checking…' : 'Check saved status'} onPress={() => void reconcile()} icon="refresh" disabled={busy} />}><CenteredState icon="refresh" heading={<>Let’s check{'\n'}before retrying.</>} description={uncertainAction === 'delivered' ? 'The connection dropped after your request. The order may already be saved as delivered.' : 'The connection dropped after your update. The shop may already have saved the new delivery status.'} tone="amber" badge="Confirmation pending" /><Card style={{ marginTop: 22 }}><H2 style={{ fontSize: 16 }}>{uncertainAction === 'delivered' ? 'Do not collect payment again.' : 'Do not send the same update again yet.'}</H2><Body muted small style={{ marginTop: 8 }}>Check the saved delivery state or call your shop before retrying.</Body></Card>{!!message && <ToastMessage>{message}</ToastMessage>}<LinkButton onPress={callShop} style={{ marginTop: 22 }}>Call your shop</LinkButton></Page>;
  if (step === 'offline') return <Page title="Delivery · offline" back={back} dock={<Dock label="Reconnect & check status" onPress={() => { setLoading(true); void refresh(); }} icon="refresh" />}><Note icon="wifi" tone="amber">Connection lost. Showing the last saved delivery view. Any newer status is unconfirmed.</Note><View style={{ marginTop: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>ORDER {order.orderNumber}</Label><Badge tone="amber">Last known: {stepFor(order.status) === 'on-way' ? 'on the way' : 'saved order'}</Badge></View><H1 style={{ marginTop: 12 }}>Your address{'\n'}is still here.</H1><Card style={{ marginTop: 22 }}><Label>SAVED DROP-OFF</Label><H2 style={{ fontSize: 16, marginTop: 8 }}>{person} · {address}</H2><Body muted style={{ marginTop: 8 }}>{[order.deliveryAddress?.area, order.deliveryAddress?.city].filter(Boolean).join(', ')}</Body>{!!order.deliveryAddress?.instructions && <Body muted small style={{ marginTop: 12 }}>“{order.deliveryAddress.instructions}”</Body>}<View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}><Button variant="secondary" icon="phone" onPress={callCustomer} style={{ flex: 1 }}>Call</Button><Button variant="quiet" icon="route" onPress={navigateCustomer} style={{ flex: 1 }}>Navigate</Button></View></Card>{payment === 'collect' && <CashCard amount={amount} />}<Note style={{ marginTop: 22 }}>Do not retry a delivery confirmation until you know its saved status. Reconnect and refresh first.</Note></Page>;
  if (step === 'complete') return <Page title="Delivery receipt" back={back} dock={<Dock label="Back to deliveries" onPress={() => navigation.navigate('Home')} />}><View style={{ alignItems: 'center', paddingTop: 45 }}><View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: palette.mint, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.action, justifyContent: 'center', alignItems: 'center' }}><Icon name="check" size={42} color="#FFFFFF" /></View></View><View style={{ marginTop: 28 }}><Badge>Delivery completed</Badge></View><H1 center style={{ marginTop: 24 }}>All handed over.</H1><Body muted style={{ marginTop: 8 }}>{order.orderNumber} · {person}</Body></View><Card style={{ marginTop: 27, padding: 21 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>DELIVERY SUMMARY</Label><Icon name="file" /></View><Divider />{[['Prepared by', shop], ['Payment', order.paymentStatus === 'CASH_COLLECTED' ? 'Cash collected' : order.paymentStatus === 'PAID' ? 'Payment confirmed' : 'Check payment'], ['Order amount', amount], ['Status', 'Delivered']].map(([key, value]) => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, gap: 12 }}><Body muted>{key}</Body><Body style={{ fontWeight: '700', textAlign: 'right', flexShrink: 1 }}>{value}</Body></View>)}</Card>{order.paymentStatus === 'CASH_COLLECTED' && <Note icon="shield" tone="green" style={{ marginTop: 22 }}>Cash belongs to your shop. Follow its handover process; this screen is not a cash receipt from the merchant.</Note>}</Page>;

  const title = step === 'assigned' ? 'Delivery details' : step === 'pickup' ? 'Confirm pickup' : step === 'on-way' ? 'Active delivery' : step === 'code' ? 'Complete delivery' : 'At drop-off';
  const dock = step === 'assigned' ? <Dock label={busy ? 'Confirming…' : 'I’m at the shop'} onPress={() => void mutate('arrived-shop')} disabled={busy} hint="Confirm only when you have arrived." /> :
    step === 'pickup' ? <Dock label="Confirm pickup" onPress={() => setPickupSheet(true)} disabled={!picked || busy} hint="This moves the order to On the way." /> :
    step === 'on-way' ? <Dock label={busy ? 'Confirming…' : 'I’ve arrived'} onPress={() => void mutate('arrived-customer')} disabled={busy} hint="Stop safely before confirming arrival." /> :
    step === 'doorstep' ? <Dock label="Confirm handover" onPress={() => setStep('code')} /> :
    <Dock label={busy ? 'Verifying…' : 'Verify & complete'} onPress={() => void complete()} disabled={busy || code.length !== 4 || !handed || (payment === 'collect' && !cash) || payment === 'check'} icon="check" hint="Wait for confirmation before leaving." />;
  return <Page title={title} back={back} help={goHelp} dock={dock} keyboard={step === 'code'}>
    <Progress count={step === 'assigned' || step === 'pickup' ? 1 : step === 'on-way' ? 2 : 3} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Label>ORDER {order.orderNumber}</Label><Badge tone={step === 'assigned' || step === 'on-way' ? 'blue' : step === 'code' && payment === 'collect' ? 'amber' : 'green'}>{step === 'assigned' ? 'Assigned to you' : step === 'pickup' ? 'At the shop' : step === 'on-way' ? 'On the way' : step === 'code' && payment === 'collect' ? 'Cash on delivery' : 'At the customer'}</Badge></View>
    {!!message && <ToastMessage>{message}</ToastMessage>}
    {!!locationError && <Note tone="amber" style={{ marginTop: 14 }}>{locationError}</Note>}
    {step === 'assigned' && <Assigned order={order} shop={shop} person={person} address={address} navigateShop={navigateShop} callShop={callShop} />}
    {step === 'pickup' && <Pickup order={order} shop={shop} picked={picked} setPicked={setPicked} />}
    {step === 'on-way' && <OnWay order={order} person={person} address={address} payment={payment} amount={amount} navigateCustomer={navigateCustomer} callCustomer={callCustomer} />}
    {step === 'doorstep' && <Doorstep order={order} person={person} address={address} payment={payment} amount={amount} callCustomer={callCustomer} goHelp={goHelp} />}
    {step === 'code' && <><H1 style={{ marginTop: 13 }}>One last check.</H1><Body muted style={{ marginTop: 12 }}>Confirm the handover with the customer.</Body>{payment === 'collect' ? <CashCard amount={amount} /> : payment === 'paid' ? <Note icon="shield" tone="green" style={{ marginTop: 22 }}>Payment confirmed. Do not collect cash for this order.</Note> : payment === 'already-collected' ? <Note icon="shield" tone="green" style={{ marginTop: 22 }}>Cash was already recorded as collected. Do not collect it again.</Note> : <Note tone="amber" style={{ marginTop: 22 }}>Payment status is unclear. Contact your shop before completing.</Note>}<View style={{ marginTop: 16 }}><Text style={{ color: palette.ink, fontSize: 13, fontWeight: '700' }}>Customer’s delivery code</Text><TextInput accessibilityLabel="Customer’s four-digit delivery code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="—   —   —   —" placeholderTextColor={palette.quiet} style={{ minHeight: 66, borderWidth: 1, borderColor: palette.control, borderRadius: 12, backgroundColor: palette.surface, color: palette.ink, textAlign: 'center', fontSize: 30, fontWeight: '700', letterSpacing: 10, marginTop: 7 }} /><Body muted small style={{ marginTop: 8 }}>Ask for the 4-digit code shown on the customer’s order. This is not their sign-in code.</Body></View><View style={{ marginTop: 22 }}><CheckRow checked={handed} onPress={() => setHanded((v) => !v)}>I handed the order to the customer.</CheckRow></View>{payment === 'collect' && <View style={{ marginTop: 12 }}><CheckRow checked={cash} onPress={() => setCash((v) => !v)}>I collected {amount} in cash.</CheckRow></View>}<Note icon="shield" style={{ marginTop: 12 }}>Can’t verify the code? Contact the shop. Don’t mark the order delivered.</Note><LinkButton onPress={goHelp} style={{ marginTop: 12 }} icon="arrow">Get delivery help</LinkButton></>}
    <Sheet visible={pickupSheet} title="Start this delivery?" onClose={() => setPickupSheet(false)}><Body muted>Confirm you have order <Text style={{ fontWeight: '700' }}>{order.orderNumber}</Text>. The saved status changes to On the way.</Body><Note icon="box" style={{ marginTop: 14 }}>The order status changes only after the shop’s service confirms your pickup.</Note><Button onPress={() => void mutate('picked-up')} disabled={busy} icon="check" style={{ marginTop: 14 }}>{busy ? 'Confirming…' : 'Order picked up'}</Button><Button variant="secondary" onPress={() => setPickupSheet(false)} style={{ marginTop: 10 }}>Not yet</Button></Sheet>
  </Page>;
}

function CenteredState({ icon, heading, description, tone, badge }: { icon: any; heading: React.ReactNode; description: string; tone?: 'amber' | 'red'; badge?: string }) {
  return <View style={{ alignItems: 'center', paddingTop: 38 }}><IconBox name={icon} tone={tone} size={76} />{badge && <View style={{ marginTop: 20 }}><Badge tone={tone}>{badge}</Badge></View>}<H1 center style={{ marginTop: 24 }}>{heading}</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>{description}</Body></View>;
}
function DestinationCard({ title, address, onNavigate }: { title: string; address: string; onNavigate: () => void }) {
  const { palette } = useRiderTheme();
  return <View style={{ height: title === 'Pickup at your shop' ? 205 : 245, marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.map, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}><RiderMapArtwork /></View>
    <View style={{ position: 'absolute', top: 13, left: 13, maxWidth: '86%', backgroundColor: palette.surface, borderRadius: 13, borderWidth: 1, borderColor: palette.line, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="pin" color={palette.accent} /><View style={{ flexShrink: 1 }}><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 13 }}>{title}</Text><Body muted small>Open navigation for directions</Body></View></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open navigation to ${address}`} onPress={onNavigate} style={{ position: 'absolute', right: 8, bottom: 8, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: palette.surface }}><Icon name="route" color={palette.accent} /></Pressable>
    <View style={{ position: 'absolute', left: 10, bottom: 10, borderRadius: 6, backgroundColor: palette.surface, paddingHorizontal: 7, paddingVertical: 4 }}><Text style={{ color: palette.muted, fontSize: 10 }}>Illustrative map · not live GPS</Text></View>
  </View>;
}
function Assigned({ order, shop, person, address, navigateShop, callShop }: { order: RiderOrder; shop: string; person: string; address: string; navigateShop: () => void; callShop: () => void }) {
  return <><H1 style={{ marginTop: 13 }}>First, collect{'\n'}from your shop.</H1><Body muted style={{ marginTop: 12 }}>Match the order number before pickup.</Body><DestinationCard title="Pickup at your shop" address={order.merchant?.address ?? shop} onNavigate={navigateShop} /><Card style={{ marginTop: 18 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="shop" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>{shop}</H2><Body muted small>{order.merchant?.address ?? 'Shop address in order'}</Body></View></View><View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}><Button variant="quiet" icon="route" onPress={navigateShop} style={{ flex: 1 }}>Navigate</Button><Button variant="secondary" icon="phone" onPress={callShop} style={{ flex: 1 }}>Call shop</Button></View></Card><H2 style={{ fontSize: 16, marginTop: 24 }}>Then deliver to</H2><Card style={{ marginTop: 12 }}><H2 style={{ fontSize: 16 }}>{person}</H2><Body muted small style={{ marginTop: 6 }}>{address}</Body></Card></>;
}
function Pickup({ order, shop, picked, setPicked }: { order: RiderOrder; shop: string; picked: boolean; setPicked: (value: boolean) => void }) {
  const { palette } = useRiderTheme();
  return <><H1 style={{ marginTop: 13 }}>Check it.{'\n'}Then take it.</H1><Body muted style={{ marginTop: 12 }}>Confirm the packed order with the shop.</Body><Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="shop" /><View><H2 style={{ fontSize: 16 }}>{shop}</H2><Body muted small>Pickup order · {order.orderNumber}</Body></View></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 }}><H2 style={{ fontSize: 16 }}>Order contents</H2><Body muted small>{order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} items</Body></View><Divider />{(order.items ?? []).map((item) => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}><View style={{ padding: 6, borderRadius: 7, backgroundColor: palette.surface2 }}><Text style={{ color: palette.ink, fontSize: 12, fontWeight: '700' }}>{item.quantity} ×</Text></View><Body>{[item.productNameSnapshot, item.sizeSnapshot].filter(Boolean).join(' · ')}</Body></View>)}</Card><Note icon="box" style={{ marginTop: 12 }}>Check sealed bags with shop staff. Do not open sealed goods.</Note><View style={{ marginTop: 12 }}><CheckRow checked={picked} onPress={() => setPicked(!picked)}>I checked the order number and collected the packed items.</CheckRow></View></>;
}
function OnWay({ order, person, address, payment, amount, navigateCustomer, callCustomer }: { order: RiderOrder; person: string; address: string; payment: string; amount: string; navigateCustomer: () => void; callCustomer: () => void }) {
  return <><H1 style={{ marginTop: 13 }}>Next stop,{'\n'}{person}’s door.</H1><DestinationCard title="Customer drop-off" address={address} onNavigate={navigateCustomer} /><Card style={{ marginTop: 18 }}><Label>DROP-OFF ADDRESS</Label><H2 style={{ fontSize: 16, marginTop: 12 }}>{address}</H2><Body muted style={{ marginTop: 6 }}>{[order.deliveryAddress?.area, order.deliveryAddress?.city].filter(Boolean).join(', ')}</Body>{!!order.deliveryAddress?.instructions && <Note icon="message" style={{ marginTop: 14 }}>“{order.deliveryAddress.instructions}”</Note>}<View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}><Button variant="quiet" icon="route" onPress={navigateCustomer} style={{ flex: 1 }}>Navigate</Button><Button variant="secondary" icon="phone" onPress={callCustomer} style={{ flex: 1 }}>Call customer</Button></View></Card>{payment === 'collect' && <CashCard amount={amount} />}</>;
}
function Doorstep({ order, person, address, payment, amount, callCustomer, goHelp }: { order: RiderOrder; person: string; address: string; payment: string; amount: string; callCustomer: () => void; goHelp: () => void }) {
  const { palette } = useRiderTheme();
  return <><H1 style={{ marginTop: 13 }}>You’re at{'\n'}the right place.</H1><Body muted style={{ marginTop: 12 }}>Hand over the order and ask for the customer’s delivery code.</Body><Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="user" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>{person}</H2><Body muted small>{address}</Body></View><Pressable accessibilityRole="button" accessibilityLabel="Call customer" onPress={callCustomer} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', alignItems: 'center' }}><Icon name="phone" /></Pressable></View></Card>{payment === 'collect' ? <CashCard amount={amount} /> : payment === 'paid' ? <Note icon="shield" tone="green" style={{ marginTop: 22 }}>Payment confirmed. Do not collect cash for this order.</Note> : <Note icon="info" tone="amber" style={{ marginTop: 22 }}>Payment needs checking with your shop. Do not collect cash again until its saved status is clear.</Note>}<Card style={{ marginTop: 22 }}><H2 style={{ fontSize: 16 }}>Before you finish</H2><View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}><IconBox name="box" size={34} /><Body style={{ flex: 1 }}>Hand the packed order to the customer.</Body></View><Divider /><View style={{ flexDirection: 'row', gap: 10 }}><IconBox name="lock" size={34} /><Body style={{ flex: 1 }}>Ask for their delivery code, not their sign-in code.</Body></View></Card><LinkButton onPress={goHelp} style={{ marginTop: 16 }}>Customer unavailable? Get help</LinkButton></>;
}
