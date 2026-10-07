import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Body, Button, Dock, Field, H1, Icon, IconBox, Label, LinkButton, Note, Page, Sheet } from '../components/RiderUI';
import { api, ApiError, storeAuth } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';
import { googleSignInIdToken } from '../lib/google';

const normalizedPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const international = /^03\d{9}$/.test(digits) ? `92${digits.slice(1)}` : digits;
  return /^923\d{9}$/.test(international) ? `+${international}` : null;
};

export default function RiderLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette, mode } = useRiderTheme();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [newGoogleToken, setNewGoogleToken] = useState<string | null>(null);
  const finish = async (auth: any) => {
    await storeAuth(auth);
    navigation.reset({ index: 0, routes: [{ name: auth.user?.rider ? 'Home' : 'Onboard' }] });
  };
  const sendCode = async () => {
    const phoneNumber = normalizedPhone(phone);
    if (!phoneNumber) { setMessage('Enter a valid Pakistan mobile number.'); return; }
    setBusy(true); setMessage('');
    try { await api.post('/auth/send-otp', { phoneNumber }); setStep('code'); }
    catch (e: any) { setMessage(e?.message ?? 'Could not send the sign-in code. Try again.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    const phoneNumber = normalizedPhone(phone);
    if (!phoneNumber) { setMessage('Check your mobile number and request a new code.'); return; }
    if (!/^\d{6}$/.test(code)) { setMessage('Enter the 6-digit sign-in code from your messages.'); return; }
    setBusy(true); setMessage('');
    try {
      const auth = await api.post('/auth/verify-otp', { phoneNumber, code, context: 'rider' });
      await finish(auth);
    } catch (e: any) { setMessage(e?.message ?? 'Could not verify the code. Try again.'); }
    finally { setBusy(false); }
  };
  const google = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const token = await googleSignInIdToken();
      try {
        const auth = await api.post('/auth/google-login', { idToken: token, context: 'rider' });
        await finish(auth);
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401 && /not a registered rider/i.test(e.message)) setNewGoogleToken(token);
        else throw e;
      }
    } catch (e: any) { setMessage(e?.message ?? 'Google sign-in did not complete. Try again.'); }
    finally { setBusy(false); }
  };
  const createGoogleIdentity = async () => {
    if (!newGoogleToken || busy) return;
    setBusy(true); setMessage('');
    try {
      const auth = await api.post('/auth/google-login', { idToken: newGoogleToken, context: 'customer' });
      setNewGoogleToken(null);
      await finish(auth);
    } catch (e: any) { setMessage(e?.message ?? 'Could not start your rider application. Try again.'); }
    finally { setBusy(false); }
  };
  if (step === 'code') return <Page title="Verify phone" back={() => setStep('phone')} keyboard dock={<Dock label={busy ? 'Verifying…' : 'Continue'} onPress={() => void verify()} disabled={busy} />}>
    <View style={{ alignItems: 'center', marginTop: 22 }}><IconBox name="lock" size={76} /></View><Label style={{ marginTop: 24 }}>VERIFY YOUR PHONE</Label><H1 style={{ marginTop: 13 }}>Check your{'\n'}messages.</H1><Body muted style={{ marginTop: 13 }}>Enter the sign-in code sent to {phone}.</Body><LinkButton onPress={() => setStep('phone')} style={{ marginTop: 8 }}>Change number</LinkButton>
    <Field label="Sign-in code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="••••••" maxLength={6} style={{ marginTop: 16 }} />
    <LinkButton onPress={() => void sendCode()} style={{ marginTop: 20 }}>Resend code</LinkButton>
    <Note icon="shield" style={{ marginTop: 22 }}>This signs you in. A customer’s delivery code is requested later, at drop-off.</Note>
    {!!message && <Note tone="red" style={{ marginTop: 12 }}>{message}</Note>}
  </Page>;
  return <Page>
    <View style={{ height: 166, borderRadius: 22, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', marginTop: 12, overflow: 'hidden' }}><View style={{ width: 88, height: 88, backgroundColor: palette.action, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}><Icon name="box" color="#FFFFFF" size={42} /></View><View style={{ position: 'absolute', bottom: 23, right: 20, backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="check" color={palette.accent} size={17} /><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 12 }}>Your shop. Your deliveries.</Text></View></View>
    <Label style={{ marginTop: 31 }}>SIRFBAZAR RIDER</Label><H1 style={{ marginTop: 13 }}>Let’s get you{'\n'}on the road.</H1><Body muted style={{ marginTop: 12 }}>Sign in with the number your shop knows.</Body>
    <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+92 3XX XXXXXXX" />
    <Button icon="arrow" onPress={() => void sendCode()} disabled={busy} style={{ marginTop: 18 }}>{busy ? 'Sending…' : 'Send sign-in code'}</Button>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /><Body muted small>or</Body><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /></View>
    <Button variant="secondary" onPress={() => void google()} disabled={busy}>Continue with Google</Button>
    <Body muted small style={{ textAlign: 'center', marginTop: 24 }}>New rider? Sign in first, then request to join your shop.</Body>
    <Image source={mode === 'dark' ? require('../assets/brand/rider-slogan-dark.png') : require('../assets/brand/rider-slogan-light.png')} resizeMode="contain" style={{ width: 158, height: 30, alignSelf: 'center', marginTop: 20 }} accessibilityLabel="بازار وہی۔ طریقہ نیا۔" />
    {!!message && <Note tone="red" style={{ marginTop: 14 }}>{message}</Note>}
    <Sheet visible={!!newGoogleToken} title="Join a delivery team?" onClose={() => setNewGoogleToken(null)}><Body muted>This Google account is not linked to a rider yet. If your shop added you by phone, choose Not now and sign in with that number. Otherwise, continue to request to join your shop.</Body><Button onPress={() => void createGoogleIdentity()} disabled={busy} style={{ marginTop: 16 }}>Continue as new rider</Button><Button variant="secondary" onPress={() => setNewGoogleToken(null)} style={{ marginTop: 10 }}>Not now</Button></Sheet>
  </Page>;
}
