import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Body, Button, Card, Divider, Dock, Field, H1, H2, Icon, IconBox, Label, LinkButton, Note, Page } from '../components/RiderUI';
import { api, clearAuth, finishOnboarding, getUser } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';

type Shop = { id: string; shopName: string; area?: string; city?: string };
const vehicles = [['MOTORBIKE', 'Motorbike'], ['BICYCLE', 'Bicycle'], ['CAR', 'Car'], ['ON_FOOT', 'On foot']];
export default function RiderOnboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [step, setStep] = useState<'shops' | 'apply' | 'pending'>('shops');
  const [shops, setShops] = useState<Shop[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [query, setQuery] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('MOTORBIKE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { getUser().then((user) => { setFullName(user?.fullName ?? ''); setPhone(user?.phoneNumber ?? ''); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (step !== 'shops') return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/rider/shops?q=${encodeURIComponent(query.trim())}`);
        if (!Array.isArray(data)) throw new Error('The shop list was not returned. Try again.');
        if (active) { setShops(data); setMessage(''); }
      } catch (e: any) { if (active) { setShops([]); setMessage(e?.message ?? 'Could not load shops. Try again.'); } }
      finally { if (active) setLoading(false); }
    }, query ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, step]);
  const submit = async () => {
    if (!shop) { setMessage('Choose the shop you want to deliver for.'); return; }
    if (!fullName.trim()) { setMessage('Enter your full name.'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (!/^923\d{9}$/.test(phoneDigits)) { setMessage('Enter a valid Pakistan contact number.'); return; }
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await api.post('/rider/apply', { merchantId: shop.id, fullName: fullName.trim(), phoneNumber: `+${phoneDigits}`, vehicleType: vehicle, vehicleNumber: vehicleNumber.trim() || undefined });
      setStep('pending');
      try { await finishOnboarding(result); }
      catch { setMessage('Your request was submitted, but account refresh failed. Sign in again before checking approval. Do not apply twice.'); }
    } catch (e: any) { setMessage(e?.message ?? 'Could not send the request. Check the shop and try again.'); }
    finally { setBusy(false); }
  };
  const checkStatus = async () => {
    setBusy(true); setMessage('');
    try {
      const profile = await api.get('/rider/profile');
      if (profile?.approvalStatus === 'APPROVED' && profile?.isActive) navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      else setMessage(profile?.approvalStatus === 'REJECTED' ? 'Your shop did not approve this request. Contact the owner.' : 'Your request is still waiting for shop approval.');
    } catch (e: any) { setMessage(e?.message ?? 'Could not check approval. Try again.'); }
    finally { setBusy(false); }
  };
  const recheckAccount = async () => {
    setBusy(true); setMessage('');
    try {
      const me = await api.get('/auth/me');
      if (me?.rider?.id) navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      else setMessage('No rider account is linked to this sign-in yet. Ask your shop owner or send a join request.');
    } catch (e: any) { setMessage(e?.message ?? 'Could not recheck your account. Try again.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => { await clearAuth(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };
  if (step === 'pending') return <Page title="Your application" back={() => void signOut()} dock={<Dock label="Back to sign in" onPress={() => void signOut()} icon="back" />}><View style={{ alignItems: 'center', paddingTop: 22 }}><IconBox name="clock" tone="amber" size={76} /><View style={{ marginTop: 20 }}><Note tone="amber" icon="clock">Awaiting shop approval</Note></View><H1 center style={{ marginTop: 22 }}>You’re nearly{'\n'}on the team.</H1><Body muted style={{ textAlign: 'center', marginTop: 12 }}>Your request was sent to{'\n'}{shop?.shopName ?? 'your shop'}.</Body></View><Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="check" /><View><H2 style={{ fontSize: 16 }}>Request submitted</H2><Body muted small>Your shop has your details.</Body></View></View><Divider /><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="clock" tone="amber" /><View><H2 style={{ fontSize: 16 }}>Shop review</H2><Body muted small>Waiting for the owner’s decision.</Body></View></View></Card><Note style={{ marginTop: 22 }}>No need to apply again. Check with your shop owner if you need an update.</Note>{!!message && <Note tone={message.startsWith('Your request is still') ? 'amber' : 'red'} style={{ marginTop: 12 }}>{message}</Note>}<LinkButton onPress={() => void checkStatus()} icon="refresh" style={{ alignSelf: 'center', marginTop: 20 }}>Check approval status</LinkButton></Page>;
  if (step === 'apply') return <Page title="Your rider details" back={() => setStep('shops')} keyboard dock={<Dock label={busy ? 'Sending…' : 'Send join request'} onPress={() => void submit()} disabled={busy} hint="Your shop reviews this request before you can deliver." />}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}><Body muted small>1 · Your shop</Body><Body muted small>2 · Your details</Body></View><H1>Meet your{'\n'}new delivery team.</H1><Body muted style={{ marginTop: 12 }}>Request to join {shop?.shopName}.</Body>
    <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
    <Field label="Contact number" value={phone} onChangeText={setPhone} placeholder="+92 3XX XXXXXXX" keyboardType="phone-pad" />
    <Text style={{ color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 16 }}>Vehicle type · optional</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{vehicles.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: vehicle === value }} onPress={() => setVehicle(value)} style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: vehicle === value ? palette.accent : palette.line, backgroundColor: vehicle === value ? palette.mint : palette.surface, paddingVertical: 10, paddingHorizontal: 12 }}><Text style={{ color: vehicle === value ? palette.accent : palette.ink }}>{label}</Text></Pressable>)}</View>
    <Field label="Vehicle number · optional" value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="Number shown on your vehicle" />
    <Note icon="shield" style={{ marginTop: 22 }}>Your shop reviews this request. You can deliver once your rider account is approved and active.</Note>
    {!!message && <Note tone="red" style={{ marginTop: 12 }}>{message}</Note>}
  </Page>;
  return <Page title="Join a delivery team" back={() => void signOut()} backLabel="Sign out and return to sign in" dock={<Dock label="Continue" onPress={() => shop ? setStep('apply') : setMessage('Choose your shop to continue.')} />}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}><Body muted small>1 · Your shop</Body><Body muted small>2 · Your details</Body></View><H1>Deliver for{'\n'}a shop you know.</H1><Body muted style={{ marginTop: 12 }}>Find your shop and ask its owner to add you to the delivery team.</Body><Field label="Find your shop" value={query} onChangeText={setQuery} placeholder="Search by shop name" />
    <Body muted small style={{ marginTop: 20, marginBottom: 12 }}>Participating shops</Body>
    {loading && <Body muted>Finding shops…</Body>}
    {!loading && !message && shops.length === 0 && <Note>No participating shops found for this search. Try another name.</Note>}
    {!loading && shops.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: shop?.id === item.id }} onPress={() => setShop(item)} style={{ borderWidth: shop?.id === item.id ? 2 : 1, borderColor: shop?.id === item.id ? palette.accent : palette.line, backgroundColor: shop?.id === item.id ? palette.mint : palette.surface, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 9 }}><IconBox name="shop" /><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700' }}>{item.shopName}</Text><Body muted small>{[item.area, item.city].filter(Boolean).join(' · ')}</Body></View><View style={{ height: 18, width: 18, borderRadius: 9, borderWidth: 1, borderColor: palette.accent, backgroundColor: shop?.id === item.id ? palette.action : palette.surface }} /></Pressable>)}
    {!!message && <Note tone="red" style={{ marginTop: 12 }}>{message}</Note>}
    <Note style={{ marginTop: 22 }}>Already added by a shop? Recheck your account before applying again.</Note><LinkButton onPress={() => void recheckAccount()} style={{ marginTop: 8 }}>Recheck my account</LinkButton><LinkButton onPress={() => void signOut()} style={{ marginTop: 8 }}>Sign out and try again</LinkButton>
  </Page>;
}
