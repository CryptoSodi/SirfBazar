import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';

type Notice = { id: string; title: string; body: string; type: string; referenceId?: string | null; isRead: boolean; createdAt: string };
export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const toast = useToast();
  const [items, setItems] = useState<Notice[]>([]);
  const [scope, setScope] = useState<'current' | 'legacy'>('current');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = scope === 'legacy' ? '?scope=legacy' : '';
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/notifications${query}`);
      if (!Array.isArray(response)) throw new Error('Unable to read notifications. Try again.');
      setItems(response);
      setLoadError(false);
    } catch (error: any) { setLoadError(true); toast(error.message || 'Unable to load notifications. Try again.', false); }
    finally { setLoading(false); }
  }, [query, toast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const markAll = async () => {
    if (busy) return;
    setBusy(true);
    try { await api.post(`/notifications/read-all${query}`); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); }
    catch (error: any) { toast(error.message || 'Unable to mark notifications as read.', false); }
    finally { setBusy(false); }
  };
  const open = async (item: Notice) => {
    try {
      if (!item.isRead) {
        await api.post(`/notifications/${encodeURIComponent(item.id)}/read${query}`);
        setItems((current) => current.map((row) => row.id === item.id ? { ...row, isRead: true } : row));
      }
      if (item.referenceId && item.type.toUpperCase().includes('ORDER')) navigation.navigate('OrderDetail', { orderId: item.referenceId });
      else if (item.type.toUpperCase().includes('PRODUCT')) (navigation as any).navigate('Tabs', { screen: 'Products' });
    } catch (error: any) { toast(error.message || 'Unable to open this notification. Try again.', false); }
  };
  const unread = items.filter((item) => !item.isRead).length;
  return <SafeAreaView style={s.screen} edges={['bottom']}>
    <View style={[s.pad, { gap: 10 }]}><View style={s.spread}><View><Text style={s.h1}>Notifications</Text><Text style={s.muted}>{unread ? `${unread} unread` : 'You are all caught up'}</Text></View>{unread > 0 && <TouchableOpacity style={s.btnGhost} disabled={busy} onPress={() => void markAll()}><Text style={s.btnGhostText}>Mark all read</Text></TouchableOpacity>}</View>
      <View style={[s.row, { gap: 8 }]}><TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: scope === 'current' }} style={[s.btnGhost, { flex: 1, backgroundColor: scope === 'current' ? colors.emeraldBg : colors.card }]} onPress={() => setScope('current')}><Text style={s.btnGhostText}>Current shop</Text></TouchableOpacity><TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: scope === 'legacy' }} style={[s.btnGhost, { flex: 1, backgroundColor: scope === 'legacy' ? colors.emeraldBg : colors.card }]} onPress={() => setScope('legacy')}><Text style={s.btnGhostText}>Earlier history</Text></TouchableOpacity></View>
    </View>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 16, gap: 8 }} refreshing={loading} onRefresh={() => void load()} ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : loadError ? <View style={[s.card, { gap: 8 }]}><Text style={s.body}>Notifications could not be loaded. Check your connection and try again.</Text><TouchableOpacity style={s.btnGhost} onPress={() => void load()}><Text style={s.btnGhostText}>Retry</Text></TouchableOpacity></View> : <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No notifications yet.</Text>} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" onPress={() => void open(item)} style={[s.card, { borderColor: item.isRead ? colors.border : colors.primary, gap: 5 }]}><Text style={[s.body, { fontWeight: '700' }]}>{item.title}</Text><Text style={s.muted}>{item.body}</Text><Text style={s.faint}>{new Date(item.createdAt).toLocaleString('en-PK')}</Text></TouchableOpacity>} />
  </SafeAreaView>;
}
