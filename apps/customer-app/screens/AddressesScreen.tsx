import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, isLoggedIn } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Icon, Notice, StatePanel, usePageInset } from '../components/CustomerUI';

/** C25: saved addresses are customer-owned; never collapse an API error to empty. */
export default function AddressesScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [addresses, setAddresses] = useState<any[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(() => {
    const current = ++generation.current;
    void (async () => {
      const ok = await isLoggedIn();
      if (current !== generation.current) return;
      setNeedLogin(!ok);
      if (!ok) { setAddresses(null); return; }
      const result = await api.get('/customer/addresses');
      if (current === generation.current) { setAddresses(result); setError(''); }
    })().catch((cause) => { if (current === generation.current) setError(`${cause.message} Reload addresses to retry.`); });
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { generation.current++; }; }, [load]));
  const mutate = async (action: () => Promise<any>, failure: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true);
    try { await action(); setDeleteId(''); load(); }
    catch (cause: any) { setError(`${cause.message} ${failure}`); }
    finally { mutationLock.current = false; setBusy(false); }
  };
  return <View style={s.screen}>
    {needLogin ? <StatePanel title="Keep your places together" message="Sign in to save home, work and other delivery addresses." action="Sign in" onPress={() => setShowLogin(true)} /> :
      <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
        <Text accessibilityRole="header" style={s.h1}>Your places</Text><Text style={[s.muted, { marginTop: 8 }]}>Keep the written address and map pin accurate.</Text>
        {!!error && <View style={{ gap: 12, marginTop: 20 }}><Notice danger>{error}</Notice><TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={load}><Text style={s.btnGhostText}>Reload addresses</Text></TouchableOpacity></View>}
        {!addresses && !error && <StatePanel loading title="Loading addresses…" />}
        {addresses?.length === 0 && <StatePanel title="No saved places yet" message="Add a delivery address and its map pin below." />}
        {addresses?.map((item) => <View key={item.id} style={[s.card, { marginTop: 20 }]}>
          <View style={[s.row, { gap: 8 }]}><Icon name={item.label === 'Home' ? 'home' : 'pin'} color={colors.text} size={22} /><Text style={[s.body, { fontSize: 15, fontWeight: '700', flex: 1 }]}>{item.label || 'Delivery address'}</Text>{item.isDefault && <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: colors.emeraldBg, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 7 }}>Default</Text>}</View>
          <Text style={[s.body, { fontSize: 12, lineHeight: 18, marginTop: 12 }]}>{item.fullAddress}{item.city ? `\n${item.city}` : ''}</Text>
          <View style={[s.spread, { marginTop: 12, gap: 12, flexWrap: 'wrap' }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${item.label || 'delivery'} address`} style={{ minHeight: 36, justifyContent: 'center' }} onPress={() => navigation.navigate('AddressEdit', { addressId: item.id })}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Edit address</Text></TouchableOpacity>
            {!item.isDefault && <TouchableOpacity accessibilityRole="button" disabled={busy} style={{ minHeight: 36, justifyContent: 'center' }} onPress={() => void mutate(() => api.put(`/customer/addresses/${item.id}/default`, {}), 'Reload to check the default address before retrying.')}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Set default</Text></TouchableOpacity>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.label || 'delivery'} address`} disabled={busy} style={{ minHeight: 36, justifyContent: 'center' }} onPress={() => setDeleteId(item.id)}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Remove</Text></TouchableOpacity>
          </View>
          {deleteId === item.id && <View style={{ marginTop: 12, gap: 12 }}><Notice danger>Remove this saved address? This cannot be undone.</Notice><TouchableOpacity accessibilityRole="button" disabled={busy} style={s.btnGhost} onPress={() => setDeleteId('')}><Text style={s.btnGhostText}>Keep address</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={busy} style={[s.btn, { backgroundColor: colors.dangerSolid }]} onPress={() => void mutate(() => api.del(`/customer/addresses/${item.id}`), 'Reload addresses to check whether removal succeeded.')}><Text style={s.btnText}>{busy ? 'Removing…' : 'Remove address'}</Text></TouchableOpacity></View>}
        </View>)}
        <TouchableOpacity accessibilityRole="button" style={[s.btnGhost, s.row, { justifyContent: 'center', gap: 9, marginTop: 16 }]} onPress={() => navigation.navigate('AddressEdit', {})}><Icon name="plus" color={colors.primary} size={18} /><Text style={s.btnGhostText}>Add a new address</Text></TouchableOpacity>
      </ScrollView>}
    <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); }} />
  </View>;
}
