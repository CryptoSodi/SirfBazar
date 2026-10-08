import { ToastHost, ToastMessage } from './Toast';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { afterLogin, api, hasPendingBasketMerge, retryBasketMerge } from '../lib/api';
import { googleSignInIdToken } from '../lib/google';
import { useTheme } from '../lib/theme';
import { Icon, Notice } from './CustomerUI';
export function LoginSheet({ visible, onClose, onSuccess, reason = 'account', onMergePending, }: {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    reason?: 'checkout' | 'account';
    onMergePending?: () => void;
}) {
    const { colors, s } = useTheme();
    const [step, setStep] = useState<'phone' | 'code' | 'merge'>('phone');
    const [phone, setPhone] = useState('');
    const [sentPhone, setSentPhone] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const lock = useRef(false);
    const phoneInput = useRef<TextInput>(null);
    const codeInput = useRef<TextInput>(null);
    const normalizedPhone = () => {
        const cleaned = phone.replace(/[\s()-]/g, '');
        return /^3\d{9}$/.test(cleaned) ? `+92${cleaned}` : cleaned;
    };
    useEffect(() => {
        if (!visible) { setCode(''); return; }
        let active = true;
        setError('');
        setCode('');
        setStep(sentPhone && sentPhone === normalizedPhone() && cooldown > 0 ? 'code' : 'phone');
        void hasPendingBasketMerge().then((pending) => {
            if (active && pending)
                setStep('merge');
        }).catch(() => { if (active) setError('Unable to check your saved basket. Close sign-in and try again.'); });
        return () => { active = false; };
    }, [visible]);
    useEffect(() => {
        if (!cooldown)
            return;
        const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);
    const run = async (task: () => Promise<void>) => {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await task();
        }
        catch (cause: any) {
            setError(`${cause.message} Try again or continue shopping instead.`);
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const finish = async (auth: any) => {
        try {
            await afterLogin(auth);
            onSuccess();
        }
        catch (cause) {
            if (await hasPendingBasketMerge()) {
                if (onMergePending) {
                    onMergePending();
                    return;
                }
                setStep('merge');
                setError('Your account is ready, but the basket transfer is not confirmed. Check it before placing an order.');
            }
            else
                throw cause;
        }
    };
    const sendOtp = () => {
        if (!/^(?:\+92|92|0)3\d{9}$/.test(normalizedPhone())) {
            setError('Enter your 10-digit mobile number after +92, starting with 3.');
            phoneInput.current?.focus();
            return;
        }
        const recipient = normalizedPhone();
        if (recipient === sentPhone && cooldown > 0) { setError(`Wait ${cooldown} seconds before requesting another code.`); return; }
        void run(async () => {
            await api.post('/auth/send-otp', { phoneNumber: recipient });
            setSentPhone(recipient);
            setStep('code');
            setCooldown(60);
        });
    };
    const verify = () => {
        if (!/^\d{6}$/.test(code.trim())) {
            setError('Enter the six-digit code from your message.');
            codeInput.current?.focus();
            return;
        }
        void run(async () => finish(await api.post('/auth/verify-otp', {
            phoneNumber: sentPhone,
            code: code.trim(),
            context: 'customer',
        })));
    };
    const google = () => void run(async () => {
        const idToken = await googleSignInIdToken();
        if (!idToken) return;
        await finish(await api.post('/auth/google-login', { idToken, context: 'customer' }));
    });
    return (<Modal visible={visible} animationType="none" transparent onShow={() => { if (step === 'phone') phoneInput.current?.focus(); }} onRequestClose={() => {
            if (!busy)
                onClose();
        }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <SafeAreaView accessibilityViewIsModal edges={['bottom']} style={{
            backgroundColor: colors.card,
            maxHeight: '93%',
            borderTopLeftRadius: 27,
            borderTopRightRadius: 27,
        }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 9, paddingHorizontal: 22, paddingBottom: 25 }}>
            <View style={{ height: 4, width: 34, borderRadius: 4, backgroundColor: colors.control, opacity: 0.7, alignSelf: 'center', marginBottom: 17 }}/>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close sign in" disabled={busy} onPress={onClose} style={{ position: 'absolute', right: 14, top: 11, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><Icon name="close" color={colors.text} size={20}/></TouchableOpacity>
            <Text accessibilityRole="header" style={[s.h2, { fontSize: 23, lineHeight: 29, letterSpacing: -0.6, paddingRight: 32 }]}>
              {step === 'merge'
            ? 'Check your basket transfer'
            : step === 'code'
                ? 'Check your phone.'
                : reason === 'checkout' ? 'You’re almost there.' : 'Your account, simply.'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 10 }}>{step === 'code' ? 'Enter the verification code for your mobile number.' : `Sign in or create an account to ${reason === 'checkout' ? 'continue checkout' : 'view your private information'}. Your basket stays with you.`}</Text>
            {step === 'phone' && (<>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 7 }}>Mobile number</Text>
                <View style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 0 }]}>
                  <Text style={[s.body, { fontWeight: '700' }]}>+92</Text>
                <TextInput ref={phoneInput} accessibilityLabel="Mobile number" style={{ flex: 1, minWidth: 0, minHeight: 49, fontSize: 16, color: colors.text }} value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="tel-national" placeholder="3xx xxxxxxx" placeholderTextColor={colors.muted} onSubmitEditing={sendOtp}/>
                </View>
                <TouchableOpacity accessibilityRole="button" style={[s.btn, { marginTop: 16, justifyContent: 'center' }]} onPress={sendOtp} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Sending code…' : 'Send verification code'}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 16 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.border }}/><Text style={s.muted}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.border }}/></View>
                <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { justifyContent: 'center', flexDirection: 'row', gap: 9 }]} onPress={google} disabled={busy}>
                  <Svg width={19} height={19} viewBox="0 0 24 24" aria-hidden>
                    <Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/>
                    <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.82-1.77-5.62-4.15H3.04v2.59A10 10 0 0 0 12 22Z"/>
                    <Path fill="#FBBC05" d="M6.38 13.9a6 6 0 0 1 0-3.8V7.51H3.04a10 10 0 0 0 0 8.98l3.34-2.59Z"/>
                    <Path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.34 2.59A5.99 5.99 0 0 1 12 5.95Z"/>
                  </Svg><Text style={s.btnGhostText}>Continue with Google</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 15 }}>New here? Verification creates your account when needed.</Text>
              </>)}
            {step === 'code' && (<>
                <View style={[s.spread, { marginTop: 12 }]}><Text style={[s.muted, { fontWeight: '700' }]}>{sentPhone.replace(/\d(?=\d{4})/g, '•')}</Text><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setStep('phone'); setCode(''); setError(''); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Change number</Text></TouchableOpacity></View>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 7 }}>Verification code</Text>
                <TextInput ref={codeInput} accessibilityLabel="Verification code" style={[s.input, { textAlign: 'center', letterSpacing: 11, fontSize: 25, paddingLeft: 23, minHeight: 60 }]} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" placeholder="••••••" placeholderTextColor={colors.muted} autoFocus onSubmitEditing={verify}/>
                <TouchableOpacity accessibilityRole="button" style={[s.btn, { marginTop: 16, justifyContent: 'center' }]} onPress={verify} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Verifying…' : 'Verify & continue'}</Text>
                </TouchableOpacity>
                <View style={[s.spread, { marginTop: 12, gap: 10 }]}><Text style={[s.muted, { flexShrink: 1 }]}>Didn’t receive a code?</Text><TouchableOpacity accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={sendOtp} disabled={busy || cooldown > 0}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {cooldown ? `Resend in ${cooldown}s` : 'Resend'}
                  </Text>
                </TouchableOpacity></View>
                <View style={{ marginTop: 16 }}><Notice icon="shield">After verification, review your basket and total. No order is placed automatically.</Notice></View>
              </>)}
            {step === 'merge' && (<>
                <View style={{ marginTop: 16 }}><Notice>
                  Your guest items are retained. Checkout stays blocked until both baskets are checked.
                </Notice></View>
                <TouchableOpacity accessibilityRole="button" style={[s.btn, { marginTop: 16, justifyContent: 'center' }]} disabled={busy} onPress={() => void run(async () => {
                await retryBasketMerge();
                onSuccess();
            })}>
                  <Text style={s.btnText}>{busy ? 'Checking basket…' : 'Check basket again'}</Text>
                </TouchableOpacity>
              </>)}
            {!!error && <View style={{ marginTop: 16 }}><ToastMessage>{error}</ToastMessage></View>}
            <TouchableOpacity accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 13 }} disabled={busy} onPress={onClose}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Continue shopping instead</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    <ToastHost active={visible} /></Modal>);
}
