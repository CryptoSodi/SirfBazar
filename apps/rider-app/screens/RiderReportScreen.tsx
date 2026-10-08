import { ToastMessage } from '../components/Toast';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Icon, Body, Dock, Field, H1, Label, LinkButton, Note, Page } from '../components/RiderUI';
import { api, ApiError } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';

const issueTypes = ['Customer unavailable', 'Wrong or unclear address', 'Order not ready', 'Damaged or missing item', 'Payment or delivery code', 'Other'];
export default function RiderReportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Report'>>();
  const { palette } = useRiderTheme();
  const [type, setType] = useState(issueTypes[0]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (busy) return;
    if (!notes.trim()) { setMessage('Describe what happened and where you are.'); return; }
    setBusy(true); setMessage('');
    try {
      await api.post(`/rider/orders/${route.params.orderId}/report-issue`, { description: `${type}: ${notes.trim()}` });
      setMessage('Issue sent to the shop and support. The delivery status has not changed.');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setNotes(''); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }
      else setMessage(e?.message ?? 'Unable to send the issue. Check your connection and try again.');
    }
    finally { setBusy(false); }
  };
  return <Page title="Delivery help" back={() => navigation.goBack()} keyboard dock={<Dock label={busy ? 'Sending…' : 'Send issue to the shop'} onPress={() => void submit()} disabled={busy} hint="Reporting does not change the order’s status." />}>
    <Label>ORDER ISSUE</Label><H1 style={{ marginTop: 13 }}>Tell us{'\n'}what happened.</H1><Body muted style={{ marginTop: 12 }}>Your shop and support receive the issue. The delivery stays in its current state.</Body>
    <Text style={{ color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 18 }}>Issue type</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Issue type: ${type}`} onPress={() => setOpen(!open)} style={{ minHeight: 54, marginTop: 7, padding: 14, borderWidth: 1, borderColor: palette.control, borderRadius: 12, backgroundColor: palette.surface, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.ink, fontSize: 16 }}>{type}</Text><Icon name="down" color={palette.ink} size={20} /></Pressable>
    {open && <View style={{ backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 12, marginTop: 4 }}>{issueTypes.map((item) => <Pressable key={item} onPress={() => { setType(item); setOpen(false); }} style={{ padding: 12 }}><Text style={{ color: palette.ink, fontSize: 14 }}>{item}</Text></Pressable>)}</View>}
    <Field label="What should the shop know?" value={notes} onChangeText={setNotes} placeholder="Describe what happened and where you are." multiline />
    <Body muted small style={{ marginTop: 8 }}>Do not include passwords or delivery codes.</Body><Note style={{ marginTop: 22 }}>Do not leave the order or change its delivery status until you have clear instructions.</Note>
    {!!message && <ToastMessage ok={(message.startsWith('Issue sent') ? 'green' : 'red') === 'green'}>{message}</ToastMessage>}
    <LinkButton onPress={() => navigation.navigate('Help')} icon="phone" style={{ marginTop: 12 }}>Call the shop instead</LinkButton>
  </Page>;
}
