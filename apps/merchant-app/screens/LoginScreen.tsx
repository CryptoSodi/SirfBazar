import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, storeAuth } from '../lib/api';
import { authContextFor, authDestination, normalizeMobile, validMobile, validOtp, type AuthMode } from '../lib/auth-flow';
import { googleSignInIdToken } from '../lib/google';
import { AppIcon } from '../components/AppIcon';
import { colors, s } from '../lib/theme';

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const working = useRef(false);
  const phoneInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  const signup = mode === 'signup';

  const run = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try { await operation(); }
    catch (e: any) { setError(e?.message || 'Could not continue. Check your connection and try again.'); }
    finally { working.current = false; setBusy(false); }
  };

  const finish = async (auth: any) => {
    const context = authContextFor(mode);
    const destination = authDestination(auth.user, context);
    if (destination === 'Login') {
      setStep('phone');
      setCode('');
      setMode('signin');
      throw new Error('This account already has shop access, or is not available for setup. Choose Sign in; contact support if you still cannot continue.');
    }
    await storeAuth(auth, context);
    navigation.reset({ index: 0, routes: [{ name: destination }] });
  };

  const sendOtp = () => {
    if (!validMobile(phone)) {
      setError('Enter a Pakistani mobile number, such as 0301 2345678.');
      phoneInput.current?.focus();
      return;
    }
    void run(async () => {
      const normalized = normalizeMobile(phone);
      const response = await api.post('/auth/send-otp', { phoneNumber: normalized });
      setPhone(normalized);
      setCode('');
      setNotice(response.status === 'unconfirmed'
        ? 'Code submission is unconfirmed. If a code arrives, enter it here. Wait before requesting another.'
        : 'A code was submitted to your mobile number. Enter it below; delivery may take a moment.');
      setStep('code');
    });
  };

  const verify = () => {
    if (!validOtp(code)) {
      setError('Enter the six-digit verification code.');
      codeInput.current?.focus();
      return;
    }
    void run(async () => finish(await api.post('/auth/verify-otp', {
      phoneNumber: normalizeMobile(phone), code: code.trim(), context: authContextFor(mode),
    })));
  };

  const google = () => void run(async () => {
    const idToken = await googleSignInIdToken();
    // Explicit mode determines context. Network or account errors never trigger
    // a fallback registration request.
    await finish(await api.post('/auth/google-login', { idToken, context: authContextFor(mode) }));
  });

  const switchMode = () => {
    if (busy) return;
    setMode(signup ? 'signin' : 'signup');
    setStep('phone'); setCode(''); setError(''); setNotice('');
  };

  return <SafeAreaView style={[s.screen, { backgroundColor: colors.dark }]}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Image source={require('../assets/brand/sirfbazar-reverse.png')} style={{ width: '100%', maxWidth: 240, height: 72, marginBottom: 8 }} resizeMode="contain" accessibilityLabel="SirfBazar" />
        <Text style={{ color: '#CBD5E1', marginBottom: 24, lineHeight: 22 }}>Merchant — run your shop from your pocket</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, gap: 12 }}>
          <AppIcon name={signup ? 'store' : 'lock'} color={colors.primary} size={28} />
          <Text accessibilityRole="header" style={s.h1}>{signup ? 'Create your merchant account' : 'Sign in to your shop'}</Text>
          <Text style={[s.muted, { fontSize: 14, lineHeight: 21 }]}>{signup ? 'Verify your mobile number, then add your shop details. Your shop will be submitted for approval.' : 'Use the mobile number linked to your merchant account.'}</Text>
          {step === 'phone' ? <>
            <Text nativeID="merchant-phone-label" style={s.h2}>Mobile number</Text>
            <TextInput ref={phoneInput} accessibilityLabel="Mobile number" accessibilityLabelledBy="merchant-phone-label" style={[s.input, { fontSize: 16, minHeight: 48 }]} value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="tel" placeholder="0301 2345678" placeholderTextColor={colors.muted} onSubmitEditing={sendOtp} />
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={[s.btn, { minHeight: 48, flexDirection: 'row', gap: 8 }]} onPress={sendOtp} disabled={busy}>
              {busy && <ActivityIndicator color="#fff" />}<Text style={s.btnText}>Send verification code</Text>
            </TouchableOpacity>
            <Text style={[s.muted, { textAlign: 'center' }]}>or</Text>
            <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { minHeight: 48 }]} onPress={google} disabled={busy}>
              <Text style={[s.btnGhostText, { textAlign: 'center' }]}>{signup ? 'Sign up with Google' : 'Sign in with Google'}</Text>
            </TouchableOpacity>
          </> : <>
            <Text accessibilityLiveRegion="polite" style={[s.muted, { lineHeight: 21 }]}>{notice} Number: {phone}</Text>
            <Text nativeID="merchant-code-label" style={s.h2}>Verification code</Text>
            <TextInput ref={codeInput} accessibilityLabel="Six-digit verification code" accessibilityLabelledBy="merchant-code-label" style={[s.input, { minHeight: 52, textAlign: 'center', fontSize: 22, letterSpacing: 6 }]} value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoCorrect={false} placeholder="000000" placeholderTextColor={colors.muted} autoFocus onSubmitEditing={verify} />
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={[s.btn, { minHeight: 48, flexDirection: 'row', gap: 8 }]} onPress={verify} disabled={busy}>
              {busy && <ActivityIndicator color="#fff" />}<Text style={s.btnText}>{signup ? 'Verify & set up shop' : 'Verify & sign in'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={[s.btnGhost, { minHeight: 48 }]} onPress={() => { setStep('phone'); setCode(''); setError(''); }}>
              <Text style={s.btnGhostText}>Change number or request a new code</Text>
            </TouchableOpacity>
          </>}
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: 14, lineHeight: 21 }}>{error}</Text>
          <Text style={[s.muted, { textAlign: 'center' }]}>{signup ? 'Already have a merchant account?' : 'New to SirfBazar?'}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={[s.btnGhost, { minHeight: 48 }]} onPress={switchMode}>
            <Text style={[s.btnGhostText, { fontSize: 16 }]}>{signup ? 'Sign in' : 'Sign up — create a shop'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
