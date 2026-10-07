import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, isLoggedIn } from '../lib/api';
import { publishCustomerEvent } from '../lib/customer-events';
import { useTheme } from '../lib/theme';
import { Icon, Notice, goTab, usePageInset } from '../components/CustomerUI';
import { LoginSheet } from '../components/LoginSheet';

const issues = [
  { label: 'Missing item', category: 'ORDER' },
  { label: 'Wrong item', category: 'ORDER' },
  { label: 'Late delivery', category: 'ORDER' },
  { label: 'Payment question', category: 'PAYMENT' },
  { label: 'App issue', category: 'GENERAL' },
];

/** C29: real customer-owned support request, never an order cancellation. */
export default function SupportRequestScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId: string | undefined = route.params?.orderId;
  const [issue, setIssue] = useState(route.params?.category === 'GENERAL' ? issues[4] : route.params?.category === 'PAYMENT' ? issues[3] : issues[0]);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const titleInput = useRef<TextInput>(null);
  const descriptionInput = useRef<TextInput>(null);
  const lock = useRef(false);
  useLayoutEffect(() => { navigation.setOptions({ title: orderId ? 'Report an order issue' : 'Account & app help' }); }, [navigation, orderId]);
  const submit = async () => {
    if (lock.current || uncertain) return;
    if (!title.trim()) { setError('Add a short title for your request.'); titleInput.current?.focus(); return; }
    if (!description.trim()) { setError('Add details so support can help.'); descriptionInput.current?.focus(); return; }
    lock.current = true;
    setBusy(true);
    try {
      if (!(await isLoggedIn())) { setLogin(true); return; }
      setError(''); setStatus('');
      const ticket = await api.post('/support/tickets', { orderId, issueCategory: issue.category, title: title.trim(), description: `${issue.label}\n\n${description.trim()}` });
      if (!ticket?.id) throw new Error('The response did not confirm a saved request.');
      publishCustomerEvent('support');
      goTab(navigation, 'ProfileTab', { screen: 'SupportDetail', params: { ticketId: ticket.id } });
    } catch (cause: any) {
      const unknown = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.status === 408 || cause.status === 409;
      setUncertain(unknown);
      setError(unknown ? 'The request result could not be confirmed. Check your support requests before sending again. Your text is retained.' : `${cause.message} Your text is retained. Check it and try again.`);
    } finally { lock.current = false; setBusy(false); }
  };
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      <Text accessibilityRole="header" style={s.h1}>Tell us what{'\n'}happened.</Text>
      <Text style={[s.muted, { marginTop: 8 }]}>{orderId ? `Order ${route.params?.orderLabel || orderId}` : 'Account, address or app assistance'}</Text>
      <View style={{ marginTop: 16 }}>
        <Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>Issue</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Issue: ${issue.label}`} accessibilityState={{ expanded }} disabled={busy} onPress={() => setExpanded(!expanded)} style={[s.input, s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ fontSize: 16, color: colors.text }}>{issue.label}</Text><View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={16} color={colors.text} /></View>
        </TouchableOpacity>
        {expanded && <View accessibilityRole="radiogroup" accessibilityLabel="Issue" style={[s.card, { marginTop: 8, padding: 0, overflow: 'hidden' }]}>{issues.map((option, index) => <TouchableOpacity key={option.label} accessibilityRole="radio" accessibilityState={{ checked: option.label === issue.label }} aria-checked={option.label === issue.label} onPress={() => { setIssue(option); setExpanded(false); }} style={[s.row, { padding: 13, minHeight: 44, gap: 12, borderBottomWidth: index < issues.length - 1 ? 1 : 0, borderColor: colors.border }]}><Text style={[s.body, { flex: 1 }]}>{option.label}</Text>{option.label === issue.label && <Icon name="check" color={colors.primary} />}</TouchableOpacity>)}</View>}
      </View>
      <View style={{ marginTop: 16 }}><Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>Title</Text><TextInput ref={titleInput} accessibilityLabel="Title" value={title} onChangeText={setTitle} editable={!busy} placeholder="A short summary" placeholderTextColor={colors.faint} style={s.input} returnKeyType="next" onSubmitEditing={() => descriptionInput.current?.focus()} /></View>
      <View style={{ marginTop: 16 }}><Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>Details</Text><TextInput ref={descriptionInput} accessibilityLabel="Details" value={description} onChangeText={setDescription} editable={!busy} multiline placeholder="Tell us which item or delivery needs attention." placeholderTextColor={colors.faint} style={[s.input, { minHeight: 86, textAlignVertical: 'top', lineHeight: 22 }]} /></View>
      <View style={{ flexDirection: 'row', gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.blueBg, marginTop: 16 }}><Icon name="info" color={colors.blue} size={18} /><Text style={[s.muted, { color: colors.blue, flex: 1 }]}>Your request is sent only after you submit. It does not cancel an order.</Text></View>
      {!!error && <View style={{ marginTop: 12 }}><Notice danger>{error}</Notice></View>}
      {!!status && <View style={{ marginTop: 12 }}><Notice tone="blue">{status}</Notice></View>}
      {uncertain && <View style={{ gap: 12, marginTop: 12 }}><TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => goTab(navigation, 'ProfileTab', { screen: 'SupportTickets' })}><Text style={s.btnGhostText}>Check support requests</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => { setUncertain(false); setError('Check that no matching request was saved before submitting again.'); }}><Text style={s.btnGhostText}>I checked — no matching request</Text></TouchableOpacity></View>}
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}><View style={{ paddingTop: 12, paddingHorizontal: inset, paddingBottom: 16 }}><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || uncertain }} disabled={busy || uncertain} style={[s.btn, s.row, { justifyContent: 'center', gap: 9, opacity: busy || uncertain ? 0.6 : 1 }]} onPress={() => void submit()}>{busy && <ActivityIndicator size="small" color="#fff" />}<Text style={s.btnText}>{busy ? 'Sending request…' : 'Send support request'}</Text></TouchableOpacity></View></SafeAreaView>
    <LoginSheet visible={login} onClose={() => setLogin(false)} onSuccess={() => { setLogin(false); setError(''); setStatus('You’re signed in. Review your message, then send your support request.'); }} />
  </KeyboardAvoidingView>;
}
