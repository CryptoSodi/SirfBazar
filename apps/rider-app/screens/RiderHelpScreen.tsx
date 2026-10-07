import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Body, Button, Card, Field, H1, H2, Icon, IconBox, Label, Note, Page, Sheet } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { api, ApiError } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';
import { withoutDeliveryCode } from '../lib/rider-orders';
import type { RiderOrder } from '../lib/rider-orders';

type Ticket = { id: string; title?: string; status?: string; createdAt?: string };
type TicketDetail = Ticket & { description?: string; messages?: { id: string; senderRole?: string; message: string; createdAt?: string }[] };
export default function RiderHelpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [profile, setProfile] = useState<any>(null);
  const [current, setCurrent] = useState<RiderOrder | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [sheet, setSheet] = useState<'contact' | 'requests' | 'detail' | null>(null);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, assigned] = await Promise.all([api.get('/rider/profile'), api.get('/rider/orders/assigned')]);
      setProfile(p); setCurrent(Array.isArray(assigned) && assigned[0] ? withoutDeliveryCode(assigned[0]) : null);
    } catch (e: any) {
      setProfile(null); setCurrent(null);
      if (e instanceof ApiError && e.status === 401) navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      else setMessage(e?.message ?? 'Could not load shop details. Try again.');
    }
  }, [navigation]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const onTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  const callShop = async () => {
    const phone = profile?.merchant?.phoneNumber?.replace(/[^+0-9]/g, '');
    if (!phone) { setMessage('Your shop phone number is unavailable. Contact support instead.'); return; }
    try { await Linking.openURL(`tel:${phone}`); }
    catch { setMessage('Unable to open the phone dialer. Contact support instead.'); }
  };
  const loadTickets = async () => {
    setSheet('requests');
    try {
      const data = await api.get('/support/tickets');
      if (!Array.isArray(data)) throw new Error('Requests could not be loaded.');
      setTickets(data); setMessage('');
    } catch (e: any) {
      setTickets([]);
      if (e instanceof ApiError && e.status === 401) { setSheet(null); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }
      else setMessage(e?.message ?? 'Could not load requests. Try again.');
    }
  };
  const openTicket = async (id: string) => {
    setMessage('');
    try {
      const detail = await api.get(`/support/tickets/${id}`);
      setSelectedTicket(detail);
      setSheet('detail');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setSheet(null); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }
      else setMessage(e?.message ?? 'Could not load this support request. Try again.');
    }
  };
  const sendTicket = async () => {
    if (busy) return;
    if (!description.trim()) { setMessage('Describe what help you need.'); return; }
    setBusy(true); setMessage('');
    try {
      await api.post('/support/tickets', { issueCategory: 'APP_OR_ACCOUNT', title: 'Rider app or account help', description: description.trim() });
      setDescription(''); setSheet(null); setMessage('Support request sent.');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { setSheet(null); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }
      else setMessage(e?.message ?? 'Could not send the request. Try again.');
    }
    finally { setBusy(false); }
  };
  return <Page activeTab="Help" onTab={onTab}>
    <Label>YOU’RE NOT ON YOUR OWN</Label><H1 style={{ marginTop: 8 }}>How can we help?</H1><Body muted style={{ marginTop: 8 }}>For pickup or delivery changes, start with your shop.</Body>
    <Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="shop" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>{profile?.merchant?.shopName ?? 'Your delivery shop'}</H2><Body muted small>Your delivery team</Body></View></View><Button variant="quiet" icon="phone" onPress={() => void callShop()} style={{ marginTop: 16 }}>Call your shop</Button></Card>
    <H2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>Current delivery</H2>
    {current ? <HelpCell icon="warning" title="Report a delivery issue" description={`${current.orderNumber} · Describe what happened`} onPress={() => navigation.navigate('Report', { orderId: current.id })} /> : <Note>No current assigned delivery. New assignments appear in Deliveries.</Note>}
    <H2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>App and account</H2>
    <HelpCell icon="message" title="Contact support" description="Create a ticket for app or account help" onPress={() => { setMessage(''); setSheet('contact'); }} />
    <HelpCell icon="file" title="Your support requests" description="View requests and replies" onPress={() => void loadTickets()} />
    <HelpCell icon="pin" title="Location & alerts" description="Device permissions and tracking" onPress={() => navigation.navigate('Permissions')} />
    {!!message && <Note tone={message === 'Support request sent.' ? 'green' : 'red'} style={{ marginTop: 14 }}>{message}</Note>}
    <Sheet visible={sheet === 'contact'} title="Contact support" onClose={() => setSheet(null)}><Body muted>Describe an app or account problem. For an active delivery, contact your shop first.</Body><Field label="What happened?" value={description} onChangeText={setDescription} placeholder="Describe the problem" multiline />{!!message && <Note tone="red" style={{ marginTop: 12 }}>{message}</Note>}<Button onPress={() => void sendTicket()} disabled={busy} icon="arrow" style={{ marginTop: 16 }}>{busy ? 'Sending…' : 'Send request'}</Button></Sheet>
    <Sheet visible={sheet === 'requests'} title="Your support requests" onClose={() => setSheet(null)}>{!!message && <Note tone="red">{message}</Note>}{tickets.length === 0 ? <Body muted>No requests returned yet.</Body> : tickets.map((ticket) => <Pressable key={ticket.id} accessibilityRole="button" accessibilityLabel={`Open support request ${ticket.title ?? ''}`} onPress={() => void openTicket(ticket.id)} style={{ borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 12, minHeight: 52 }}><Text style={{ color: palette.ink, fontWeight: '700' }}>{ticket.title ?? 'Support request'}</Text><Body muted small>{ticket.status ?? 'Open'} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</Body></Pressable>)}</Sheet>
    <Sheet visible={sheet === 'detail'} title={selectedTicket?.title ?? 'Support request'} onClose={() => setSheet('requests')}>{selectedTicket && <><Body muted small>{selectedTicket.status ?? 'Open'}</Body><Body style={{ marginTop: 12 }}>{selectedTicket.description ?? ''}</Body><H2 style={{ fontSize: 16, marginTop: 20 }}>Replies</H2>{selectedTicket.messages?.length ? selectedTicket.messages.map((reply) => <View key={reply.id} style={{ borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 12 }}><Body muted small>{reply.senderRole === 'RIDER' ? 'You' : 'Support'}{reply.createdAt ? ` · ${new Date(reply.createdAt).toLocaleDateString()}` : ''}</Body><Body style={{ marginTop: 4 }}>{reply.message}</Body></View>) : <Body muted small style={{ marginTop: 8 }}>No replies yet.</Body>}</>}</Sheet>
  </Page>;
}
function HelpCell({ icon, title, description, onPress }: { icon: 'warning' | 'message' | 'file' | 'pin'; title: string; description: string; onPress: () => void }) {
  const { palette } = useRiderTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 9 }}><IconBox name={icon} /><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700' }}>{title}</Text><Body muted small style={{ marginTop: 3 }}>{description}</Body></View><Icon name="chevron" color={palette.quiet} size={17} /></Pressable>;
}
