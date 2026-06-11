import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, storeAuth } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+92302000000');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { phoneNumber: phone.trim() });
      setStep('code');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const auth = await api.post('/auth/verify-otp', { phoneNumber: phone.trim(), code: code.trim() });
      if (auth.user?.role !== 'RIDER') {
        setError('This number is not a rider account. Ask your shop owner to add you as a rider.');
        return;
      }
      await storeAuth(auth);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.primary }]}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>SirfBazar Rider</Text>
        <Text style={{ color: '#d1fae5', marginBottom: 28 }}>Deliver for your shop, track every drop</Text>

        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
          {step === 'phone' ? (
            <>
              <Text style={s.h2}>Login with your phone</Text>
              <TextInput
                style={[s.input, { marginTop: 12 }]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+92 3xx xxxxxxx"
              />
              <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={sendOtp} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.h2}>Enter the code sent to {phone}</Text>
              <TextInput
                style={[s.input, { marginTop: 12, textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="••••••"
                autoFocus
              />
              <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={verify} disabled={busy || code.length < 4}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: 10, alignItems: 'center' }}>
                <Text style={s.muted}>Change number</Text>
              </TouchableOpacity>
            </>
          )}
          {!!error && <Text style={{ color: colors.danger, marginTop: 10, fontSize: 13 }}>{error}</Text>}
          <Text style={[s.faint, { textAlign: 'center', marginTop: 10 }]}>
            Demo rider: +923020000001 · code 123456
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
