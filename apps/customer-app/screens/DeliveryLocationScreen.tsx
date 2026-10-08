import { ToastMessage } from '../components/Toast';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, clearLocation, getConfirmedLocation, isLoggedIn, setLocation, type SbLocation } from '../lib/api';
import { detectCurrentLocation } from '../lib/location';
import { useTheme } from '../lib/theme';
import { Icon, Notice, goTab, usePageInset } from '../components/CustomerUI';
import { LoginSheet } from '../components/LoginSheet';

/** C12: unknown area remains unknown until the customer chooses a real point. */
export default function DeliveryLocationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const [selected, setSelected] = useState<SbLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<any[] | null>(null);
  const [addressError, setAddressError] = useState('');
  const [showAddresses, setShowAddresses] = useState(false);
  const [login, setLogin] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  useLayoutEffect(() => { navigation.setOptions({ title: 'Delivery area' }); }, [navigation]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    void getConfirmedLocation().then((location) => { if (active.current) setSelected(location); });
    return () => { active.current = false; };
  }, []));
  const returnHome = () => navigation.popTo('Home');
  const choose = async (location: SbLocation) => {
    await setLocation({ ...location, confirmed: true });
    setSelected(location); returnHome();
  };
  const useCurrent = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const found = await detectCurrentLocation();
      // A pending permission result cannot change location after leaving this screen.
      if (!active.current) return;
      await choose({ latitude: found.latitude, longitude: found.longitude, label: [found.area, found.city].filter(Boolean).join(', ') || 'Current location' });
    } catch (cause: any) { if (active.current) setError(`${cause.message} You can choose a map point manually or keep browsing without an area.`); }
    finally { lock.current = false; setBusy(false); }
  };
  const loadAddresses = async () => {
    setAddressError(''); setShowAddresses(true); setAddresses(null);
    try {
      if (!(await isLoggedIn())) { setShowAddresses(false); setLogin(true); return; }
      const saved = await api.get('/customer/addresses');
      if (active.current) setAddresses(saved ?? []);
    } catch (cause: any) { if (active.current) setAddressError(`${cause.message} Retry saved addresses or choose a map point.`); }
  };
  const chooseSaved = async (address: any) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await choose({ latitude: address.latitude, longitude: address.longitude, label: [address.area, address.city].filter(Boolean).join(', ') || address.fullAddress }); }
    catch { setError('Unable to save your selected area. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const browseWithoutArea = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await clearLocation(); setSelected(null); returnHome(); }
    catch { setError('Unable to clear your browsing area. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const hasPoint = (address: any) => Number.isFinite(address.latitude) && Number.isFinite(address.longitude) && Math.abs(address.latitude) <= 90 && Math.abs(address.longitude) <= 180;
  return <View style={s.screen}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      <Text accessibilityRole="header" style={s.h1}>A little closer{'\n'}to home.</Text>
      <Text style={[s.body, { color: colors.muted, marginTop: 12 }]}>Choose a delivery area to find relevant shops. You can keep browsing without sharing your location.</Text>
      {selected && <View style={[s.card, { marginTop: 16 }]}><Text style={[s.muted, { fontSize: 11 }]}>CURRENT AREA</Text><Text style={[s.body, { fontWeight: '700', marginTop: 4 }]}>{selected.label}</Text></View>}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void useCurrent()} style={[s.btn, s.row, { marginTop: 24, justifyContent: 'center', gap: 9, opacity: busy ? 0.6 : 1 }]}>{busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="pin" color="#fff" size={18} />}<Text style={s.btnText}>{busy ? 'Updating area…' : 'Use current location'}</Text></TouchableOpacity>
      <View style={[s.row, { gap: 12, marginVertical: 15 }]}><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Text style={[s.muted, { fontSize: 11 }]}>or choose manually</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /></View>
      <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => navigation.navigate('MapPicker', { latitude: selected?.latitude, longitude: selected?.longitude, browsing: true })} style={[s.row, { minHeight: 61, gap: 12, paddingVertical: 15, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: colors.border }]}><Icon name="pin" size={21} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>Choose on map</Text><Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>Set a delivery pin manually, without GPS</Text></View><Icon name="chevron" size={21} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showAddresses }} disabled={busy} onPress={() => showAddresses ? setShowAddresses(false) : void loadAddresses()} style={[s.row, { minHeight: 61, gap: 12, paddingVertical: 15, paddingHorizontal: 14 }]}><Icon name="search" size={21} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>Use a saved address</Text><Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>Choose a written address and its confirmed pin</Text></View><Icon name="chevron" size={21} /></TouchableOpacity>
      </View>
      {showAddresses && <View style={{ gap: 12, marginTop: 16 }}>
        {!addresses && !addressError && <View style={[s.row, { gap: 8 }]}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading saved addresses…</Text></View>}
        {!!addressError && <><ToastMessage>{addressError}</ToastMessage><TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => void loadAddresses()}><Text style={s.btnGhostText}>Retry saved addresses</Text></TouchableOpacity></>}
        {addresses?.map((address) => <TouchableOpacity key={address.id} accessibilityRole="button" disabled={busy} onPress={() => hasPoint(address) ? void chooseSaved(address) : goTab(navigation, 'ProfileTab', { screen: 'AddressEdit', params: { addressId: address.id } })} style={[s.card, { gap: 5 }]}><Text style={[s.body, { fontWeight: '700' }]}>{address.label || 'Delivery address'}</Text><Text style={s.muted}>{address.fullAddress}</Text>{!hasPoint(address) && <Text style={{ color: colors.primary, fontSize: 12 }}>Confirm this address’s map pin first</Text>}</TouchableOpacity>)}
        {addresses?.length === 0 && <Notice>No saved addresses yet. Choose a point on the map, or add a saved address.</Notice>}
        {addresses && <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => goTab(navigation, 'ProfileTab', { screen: 'Addresses' })}><Text style={s.btnGhostText}>Manage saved addresses</Text></TouchableOpacity>}
      </View>}
      <View style={{ marginTop: 20 }}><Notice tone="blue">Current location needs your permission. It is requested only when you choose it. Manual map selection does not need GPS access.</Notice></View>
      {!!error && <View style={{ marginTop: 12 }}><ToastMessage>{error}</ToastMessage></View>}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void browseWithoutArea()} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Keep browsing without location</Text></TouchableOpacity>
    </ScrollView>
    <LoginSheet visible={login} onClose={() => setLogin(false)} onSuccess={() => { setLogin(false); void loadAddresses(); }} />
  </View>;
}
