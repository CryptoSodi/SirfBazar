import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api } from '../lib/api';
import { detectCurrentLocation } from '../lib/location';
import { useTheme } from '../lib/theme';
import { ActionDock, Icon, Notice, usePageInset } from '../components/CustomerUI';

/** C26: the written address and confirmed map pin travel together. */
export default function AddressEditScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddressEdit'>>();
  // Returning from the map merges picked coordinates without resetting the draft.
  const entry = useRef(route.params ?? {}).current;
  const { addressId, fromCheckout, prefill } = entry;
  const [label, setLabel] = useState('Home');
  const [fullAddress, setFullAddress] = useState(prefill?.fullAddress ?? '');
  const [area, setArea] = useState(prefill?.area ?? '');
  const [city, setCity] = useState(prefill?.city ?? '');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(prefill?.latitude != null && prefill?.longitude != null ? { latitude: prefill.latitude, longitude: prefill.longitude } : null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addressReady, setAddressReady] = useState(!addressId);
  const [options, setOptions] = useState(false);
  const savingRef = useRef(false);
  const addressInput = useRef<TextInput>(null);
  const cityInput = useRef<TextInput>(null);
  useLayoutEffect(() => { navigation.setOptions({ title: addressId ? 'Edit delivery address' : 'Add delivery address' }); }, [navigation, addressId]);
  useEffect(() => {
    if (!addressId) return;
    let active = true;
    void (async () => {
      try {
        const all = await api.get('/customer/addresses');
        if (!active) return;
        const address = (all ?? []).find((item: any) => item.id === addressId);
        if (!address) throw new Error('Address no longer exists');
        setLabel(address.label || 'Home'); setFullAddress(address.fullAddress ?? ''); setArea(address.area ?? ''); setCity(address.city ?? '');
        setContactName(address.contactName ?? ''); setContactPhone(address.contactPhone ?? ''); setInstructions(address.instructions ?? ''); setIsDefault(!!address.isDefault);
        if (address.latitude != null && address.longitude != null) setCoords({ latitude: address.latitude, longitude: address.longitude });
        setAddressReady(true);
      } catch { if (active) setError('Unable to load this address. Go back to saved addresses and try again.'); }
    })();
    return () => { active = false; };
  }, [addressId]);
  const picked = route.params?.picked;
  useEffect(() => {
    if (!picked) return;
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (picked.fullAddress) setFullAddress(picked.fullAddress);
    if (picked.area) setArea(picked.area);
    if (picked.city) setCity(picked.city);
  }, [picked]);
  const openMap = () => navigation.navigate('MapPicker', coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined);
  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true); setError('');
    try {
      const location = await detectCurrentLocation();
      setCoords({ latitude: location.latitude, longitude: location.longitude });
      if (location.fullAddress) setFullAddress(location.fullAddress);
      if (location.area) setArea(location.area);
      if (location.city) setCity(location.city);
    } catch (cause: any) { setError(`${cause.message} You can also confirm your location on the map.`); }
    finally { setLocating(false); }
  };
  const save = async () => {
    if (savingRef.current || !addressReady) return;
    if (!fullAddress.trim()) { setError('Enter your full address before saving.'); addressInput.current?.focus(); return; }
    if (!city.trim()) { setError('Enter your city before saving.'); cityInput.current?.focus(); return; }
    if (!coords) { setError('Confirm the delivery location on the map before saving.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    const payload = { label: label.trim() || 'Home', fullAddress: fullAddress.trim(), area: area.trim() || undefined, city: city.trim(), contactName: contactName.trim() || undefined, contactPhone: contactPhone.trim() || undefined, instructions: instructions.trim() || undefined, latitude: coords.latitude, longitude: coords.longitude, isDefault };
    try {
      const saved = addressId ? await api.put(`/customer/addresses/${addressId}`, payload) : await api.post('/customer/addresses', payload);
      if (fromCheckout) navigation.popTo('Checkout', { selectedAddressId: saved.id }, { merge: true });
      else navigation.goBack();
    } catch (cause: any) { setError(`${cause.message} Your address is retained. Check saved addresses before retrying if the result is uncertain.`); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const fieldLabel = (text: string) => <Text style={[s.body, { fontSize: 12, fontWeight: '700', marginBottom: 7 }]}>{text}</Text>;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      <Text accessibilityRole="header" style={s.h1}>Delivery address</Text><Text style={[s.muted, { marginTop: 8 }]}>Tell your shop’s rider exactly where to go.</Text>
      {!!error && <View style={{ marginTop: 16 }}><Notice danger>{error}</Notice></View>}
      {!addressReady && !error && <View style={[s.row, { gap: 8, marginTop: 16 }]}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading saved address…</Text></View>}
      <View style={{ marginTop: 16 }}>{fieldLabel('Full address')}<TextInput ref={addressInput} accessibilityLabel="Full address" autoComplete="street-address" style={s.input} placeholder="House / apartment, street, area" placeholderTextColor={colors.faint} value={fullAddress} onChangeText={setFullAddress} editable={addressReady && !saving} /></View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{fieldLabel('City')}<TextInput ref={cityInput} accessibilityLabel="City" style={s.input} placeholder="City" placeholderTextColor={colors.faint} value={city} onChangeText={setCity} editable={addressReady && !saving} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>{fieldLabel('Contact name')}<TextInput accessibilityLabel="Contact name" autoComplete="name" style={s.input} placeholder="Your name" placeholderTextColor={colors.faint} value={contactName} onChangeText={setContactName} editable={addressReady && !saving} /></View>
      </View>
      <View style={{ marginTop: 16 }}>{fieldLabel('Delivery instructions · optional')}<TextInput accessibilityLabel="Delivery instructions, optional" style={s.input} placeholder="Landmark, building or access details" placeholderTextColor={colors.faint} value={instructions} onChangeText={setInstructions} editable={addressReady && !saving} /></View>
      <TouchableOpacity accessibilityRole="button" style={[s.row, { gap: 5, minHeight: 36, alignSelf: 'flex-start', marginTop: 12 }]} onPress={openMap}><Icon name="pin" size={22} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Confirm on map</Text>{!!coords && <Icon name="check" size={16} color={colors.primary} />}</TouchableOpacity>
      <View style={{ marginTop: 16 }}>{fieldLabel('Delivery contact number')}<TextInput accessibilityLabel="Delivery contact number" autoComplete="tel" keyboardType="phone-pad" style={s.input} placeholder="+92 mobile number" placeholderTextColor={colors.faint} value={contactPhone} onChangeText={setContactPhone} editable={addressReady && !saving} /></View>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: options }} onPress={() => setOptions(!options)} style={[s.row, { minHeight: 44, marginTop: 16, gap: 8, alignSelf: 'flex-start' }]}><Text style={[s.muted, { color: colors.primary }]}>Address options</Text><Icon name={options ? 'minus' : 'plus'} size={14} color={colors.primary} /></TouchableOpacity>
      {options && <View style={[s.card, { gap: 12 }]}>
        <View>{fieldLabel('Save as')}<TextInput accessibilityLabel="Save address as" value={label} onChangeText={setLabel} placeholder="Home, work or another place" placeholderTextColor={colors.faint} style={s.input} /></View>
        <View>{fieldLabel('Area · optional')}<TextInput accessibilityLabel="Area, optional" value={area} onChangeText={setArea} style={s.input} /></View>
        <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="Set as default delivery address" accessibilityState={{ checked: isDefault }} onPress={() => setIsDefault(!isDefault)} style={[s.row, { gap: 10, minHeight: 44 }]}><View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.control, backgroundColor: isDefault ? colors.action : colors.card, alignItems: 'center', justifyContent: 'center' }}>{isDefault && <Icon name="check" size={14} color="#fff" />}</View><Text style={[s.body, { flex: 1 }]}>Set as default delivery address</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: locating }} disabled={locating} onPress={() => void useCurrentLocation()} style={[s.btnGhost, s.row, { gap: 9, justifyContent: 'center' }]}>{locating && <ActivityIndicator color={colors.primary} size="small" />}<Text style={s.btnGhostText}>{locating ? 'Finding your location…' : 'Use current location'}</Text></TouchableOpacity>
      </View>}
    </ScrollView>
    <ActionDock><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving || !addressReady }} style={[s.btn, s.row, { gap: 9, justifyContent: 'center', opacity: saving || !addressReady ? 0.6 : 1 }]} onPress={() => void save()} disabled={saving || !addressReady}>{saving && <ActivityIndicator size="small" color="#fff" />}<Text style={s.btnText}>{saving ? 'Saving address…' : 'Save address'}</Text></TouchableOpacity></ActionDock>
  </KeyboardAvoidingView>;
}
