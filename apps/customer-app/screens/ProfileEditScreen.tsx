import { ToastMessage } from '../components/Toast';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { ActionDock, Notice, StatePanel, usePageInset } from '../components/CustomerUI';
import { AccountPolicies } from '../components/AccountPolicies';

/** Deletion requests use support; the legacy API only disabled sign-in. */
export default function ProfileEditScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const deleteAccount = !!route.params?.deleteAccount;
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const lock = useRef(false);
  useLayoutEffect(() => { navigation.setOptions({ title: deleteAccount ? 'Request account deletion' : 'Your details' }); }, [navigation, deleteAccount]);
  const load = useCallback(() => {
    if (deleteAccount) { setLoaded(true); return; }
    let active = true;
    void api.get('/customer/profile').then((profile) => {
      if (!active) return;
      setName(profile.fullName ?? ''); setEmail(profile.email ?? ''); setLoaded(true); setError('');
    }).catch((cause) => { if (active) setError(`${cause.message} Try loading your profile again.`); });
    return () => { active = false; };
  }, [deleteAccount]);
  useFocusEffect(load);
  const save = async () => {
    if (lock.current) return;
    if (!name.trim()) { setError('Enter your full name.'); nameInput.current?.focus(); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address or leave it empty.'); emailInput.current?.focus(); return; }
    lock.current = true; setBusy(true);
    try { await api.put('/customer/profile', { fullName: name.trim(), email: email.trim() || undefined }); navigation.goBack(); }
    catch (cause: any) { setError(`${cause.message} Your changes are retained. Try saving again.`); }
    finally { lock.current = false; setBusy(false); }
  };
  const requestDeletion = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await Linking.openURL('mailto:support@sirfbazar.com?subject=SirfBazar%20account%20and%20data%20deletion%20request'); }
    catch { setError('Could not open your email app. Send your account and data deletion request to support@sirfbazar.com. Do not send passwords or sign-in codes.'); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!loaded) return <View style={s.screen}><StatePanel loading={!error} title={error ? 'Unable to load profile' : 'Loading profile…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /></View>;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      <Text accessibilityRole="header" style={s.h1}>{deleteAccount ? 'Request account deletion' : 'Your details'}</Text>
      {deleteAccount ? <View style={{ marginTop: 20, gap: 16 }}>
        <Text selectable style={s.body}>Email support@sirfbazar.com with your registered email or phone number to request deletion of your account and associated data. Do not include passwords or sign-in codes.</Text>
        <Notice>Support verifies ownership and explains processing and any retained transaction records. Opening your email app does not send a request, delete your data or cancel existing orders.</Notice>
        <AccountPolicies color={colors.primary} textColor={colors.muted} />
        <TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy} onPress={() => navigation.goBack()}><Text style={s.btnGhostText}>Keep my account</Text></TouchableOpacity>
      </View> : <>
        <View style={{ marginTop: 20 }}><Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>Name</Text><TextInput ref={nameInput} accessibilityLabel="Name" autoComplete="name" style={s.input} value={name} onChangeText={setName} editable={!busy} returnKeyType="next" onSubmitEditing={() => emailInput.current?.focus()} /></View>
        <View style={{ marginTop: 16 }}><Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>Email · optional</Text><TextInput ref={emailInput} accessibilityLabel="Email, optional" autoComplete="email" keyboardType="email-address" autoCapitalize="none" style={s.input} value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={colors.faint} editable={!busy} /></View>
        <Text style={[s.faint, { marginTop: 12, lineHeight: 16 }]}>Leave email blank to keep your existing email.</Text>
      </>}
      {!!error && <View style={{ marginTop: 16 }}><ToastMessage>{error}</ToastMessage></View>}
    </ScrollView>
    <ActionDock><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy }} style={[s.btn, s.row, { justifyContent: 'center', gap: 9, backgroundColor: colors.action, opacity: busy ? 0.6 : 1 }]} disabled={busy} onPress={() => void (deleteAccount ? requestDeletion() : save())}>{busy && <ActivityIndicator color="#fff" size="small" />}<Text style={s.btnText}>{deleteAccount ? (busy ? 'Opening email...' : 'Email deletion request') : (busy ? 'Saving details…' : 'Save details')}</Text></TouchableOpacity></ActionDock>
  </KeyboardAvoidingView>;
}
