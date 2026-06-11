import { useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { afterLogin, api } from '../lib/api';
import { colors, s } from '../lib/theme';

/** Login-at-checkout bottom sheet: phone OTP (dev master code 123456) or mock Google. */
export function LoginSheet({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+9230');
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
      await afterLogin(auth);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <Text style={s.h2}>Login to continue</Text>
          <Text style={[s.muted, { marginTop: 4, marginBottom: 16 }]}>
            Your cart is safe — you will continue right where you left off.
          </Text>

          {step === 'phone' ? (
            <>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+92 3xx xxxxxxx"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={sendOtp} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[s.muted, { marginBottom: 8 }]}>Code sent to {phone}</Text>
              <TextInput
                style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                keyboardType="number-pad"
                autoFocus
              />
              <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={verify} disabled={busy || code.length < 4}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & continue</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: 10, alignItems: 'center' }}>
                <Text style={[s.muted, { textDecorationLine: 'underline' }]}>Change number</Text>
              </TouchableOpacity>
            </>
          )}

          {!!error && (
            <Text style={{ color: colors.danger, marginTop: 10, fontSize: 13 }}>{error}</Text>
          )}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={s.muted}>Not now</Text>
          </TouchableOpacity>
          <Text style={[s.faint, { textAlign: 'center', marginTop: 8 }]}>Dev tip: code 123456 always works</Text>
        </View>
      </View>
    </Modal>
  );
}
