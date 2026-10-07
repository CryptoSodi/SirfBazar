import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api, isLoggedIn } from '../lib/api';
import { notificationDestination } from '../lib/customer-flow';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { useTheme } from '../lib/theme';
import { LoginSheet } from '../components/LoginSheet';
import { Icon, IconName, Notice, StatePanel, goTab, usePageInset } from '../components/CustomerUI';

/** C41: real notifications only, scoped by the authenticated customer API. */
export default function NotificationsScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[] | null>(null);
  const [guest, setGuest] = useState(false);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const [options, setOptions] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(() => {
    const current = ++generation.current;
    void (async () => {
      const ok = await isLoggedIn();
      if (current !== generation.current) return;
      setGuest(!ok);
      if (!ok) { setItems(null); return; }
      const result = await api.get('/notifications');
      if (current === generation.current) { setItems(result); setError(''); }
    })().catch((cause) => { if (current === generation.current) setError(`${cause.message} Refresh your updates to retry.`); });
  }, []);
  useLiveRefresh('notifications', load);
  const open = async (item: any) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.post(`/notifications/${item.id}/read`);
      load();
      const destination = notificationDestination(item);
      if (destination?.screen === 'OrderDetail') goTab(navigation, 'OrdersTab', { screen: 'OrderDetail', params: { orderId: destination.orderId } });
      else if (destination?.screen === 'SupportDetail') goTab(navigation, 'ProfileTab', { screen: 'SupportDetail', params: { ticketId: destination.ticketId } });
    } catch (cause: any) { setError(`${cause.message} Try opening the update again.`); }
    finally { lock.current = false; setBusy(false); }
  };
  const visible = unread ? items?.filter((item) => !item.isRead) : items;
  const iconFor = (item: any): IconName => /REPLACEMENT/.test(item.type) ? 'box' : /OUT_FOR_DELIVERY|ON_THE_WAY/.test(`${item.type} ${item.title}`.toUpperCase().replace(/ /g, '_')) ? 'route' : /SUPPORT/.test(item.type) ? 'help' : /ACCEPT/.test(`${item.type} ${item.title}`.toUpperCase()) ? 'shop' : 'bell';
  return <View style={s.screen}>
    {guest ? <StatePanel title="Your updates, in one place" message="Sign in to view order and support updates." icon="bell" action="Sign in" onPress={() => setLogin(true)} /> :
      <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
        <Text accessibilityRole="header" style={s.h1}>Your updates</Text><Text style={[s.muted, { marginTop: 8 }]}>Only updates for your customer account.</Text>
        {!!error && <View style={{ marginTop: 16 }}><Notice danger>{error}</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={load}><Text style={s.btnGhostText}>Refresh updates</Text></TouchableOpacity></View>}
        {!items && !error && <StatePanel loading title="Loading updates…" />}
        {items && !visible?.length && <StatePanel icon="bell" title={unread ? 'No unread updates' : 'No updates yet'} message="Order and support updates appear here. Your orders always show their latest saved status." action="View orders" onPress={() => goTab(navigation, 'OrdersTab')} />}
        {!!visible?.length && <View style={[s.card, { marginTop: 20, padding: 0, overflow: 'hidden' }]}>{visible.map((item, index) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.isRead ? 'Read' : 'Unread'}. ${item.body || ''}`} disabled={busy} onPress={() => void open(item)} style={[s.row, { minHeight: 61, gap: 12, paddingHorizontal: 14, paddingVertical: 15, borderBottomWidth: index < visible.length - 1 ? 1 : 0, borderColor: colors.border }]}>
          <Icon name={iconFor(item)} size={21} color={colors.primary} />
          <View style={{ flex: 1, minWidth: 0 }}><Text style={[s.body, { fontWeight: '700', lineHeight: 20 }]}>{item.title}</Text><Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>{item.body || 'Open to view this update'}</Text>{!item.isRead && <Text style={{ color: colors.primary, fontSize: 10, lineHeight: 15, marginTop: 3 }}>Unread</Text>}</View><Icon name="chevron" size={21} />
        </TouchableOpacity>)}</View>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: options }} onPress={() => setOptions(!options)} style={[s.row, { gap: 8, minHeight: 44, marginTop: 16, alignSelf: 'flex-start' }]}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Manage updates</Text><Icon name={options ? 'minus' : 'plus'} color={colors.primary} size={14} /></TouchableOpacity>
        {options && <View style={{ gap: 12 }}>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: unread }} style={s.btnGhost} onPress={() => setUnread(!unread)}><Text style={s.btnGhostText}>{unread ? 'Show all updates' : 'Show unread only'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={s.btnGhost} disabled={busy} onPress={async () => {
            if (lock.current) return; lock.current = true; setBusy(true);
            try { await api.post('/notifications/read-all'); load(); }
            catch (cause: any) { setError(`${cause.message} Try marking your updates as read again.`); }
            finally { lock.current = false; setBusy(false); }
          }}><Text style={s.btnGhostText}>Mark all as read</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={load}><Text style={s.btnGhostText}>Refresh updates</Text></TouchableOpacity>
          {Platform.OS !== 'web' && <View style={[s.card, { gap: 12 }]}><Text style={s.h2}>Phone alerts</Text><Text style={s.muted}>Choose whether this device receives order alerts. You can change notification permission in device settings.</Text>
            <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={async () => {
              try { const { registerForPush } = await import('../lib/push'); setPushMessage((await registerForPush()) ? 'This device is registered for alerts.' : 'Alerts were not registered. Check notification permission or your app build, then retry.'); }
              catch { setPushMessage('Unable to register alerts. Check notification permission and try again.'); }
            }}><Text style={s.btnGhostText}>Enable phone alerts</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => { void Linking.openSettings().catch(() => setPushMessage('Open notification settings in your device Settings app.')); }}><Text style={s.btnGhostText}>Open device settings</Text></TouchableOpacity>{!!pushMessage && <Notice>{pushMessage}</Notice>}
          </View>}
        </View>}
      </ScrollView>}
    <LoginSheet visible={login} onClose={() => setLogin(false)} onSuccess={() => { setLogin(false); load(); }} />
  </View>;
}
