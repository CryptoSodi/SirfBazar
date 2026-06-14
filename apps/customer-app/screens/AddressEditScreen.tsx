import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api } from '../lib/api';
import { detectCurrentLocation, LocationPermissionError } from '../lib/location';
import { useTheme } from '../lib/theme';
import { toast } from '../components/Toast';

const LABELS = [
  { key: 'Home', icon: '🏠' },
  { key: 'Work', icon: '💼' },
  { key: 'Family', icon: '❤️' },
  { key: 'Other', icon: '📍' },
] as const;

/** Add or edit a saved delivery address. "Use current location" pins precise
 *  GPS coordinates (so the rider can navigate) and pre-fills the address text. */
export default function AddressEditScreen() {
  const { colors, s } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddressEdit'>>();
  // Capture entry params once: returning from the map updates route.params with
  // `picked`, which must not wipe out addressId/fromCheckout/prefill.
  const entry = useRef(route.params ?? {}).current;
  const { addressId, fromCheckout, prefill } = entry;

  const [labelChip, setLabelChip] = useState<string>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [fullAddress, setFullAddress] = useState(prefill?.fullAddress ?? '');
  const [area, setArea] = useState(prefill?.area ?? '');
  const [city, setCity] = useState(prefill?.city ?? '');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    prefill?.latitude != null && prefill?.longitude != null
      ? { latitude: prefill.latitude, longitude: prefill.longitude }
      : null,
  );

  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: addressId ? 'Edit address' : 'Add address' });
  }, [navigation, addressId]);

  // Load the existing address when editing.
  useEffect(() => {
    if (!addressId) return;
    (async () => {
      try {
        const all = await api.get('/customer/addresses');
        const a = (all ?? []).find((x: any) => x.id === addressId);
        if (!a) return;
        const preset = LABELS.find((l) => l.key === a.label);
        setLabelChip(preset ? preset.key : 'Other');
        if (!preset) setCustomLabel(a.label ?? '');
        setFullAddress(a.fullAddress ?? '');
        setArea(a.area ?? '');
        setCity(a.city ?? '');
        setContactName(a.contactName ?? '');
        setContactPhone(a.contactPhone ?? '');
        setInstructions(a.instructions ?? '');
        setIsDefault(!!a.isDefault);
        if (a.latitude != null && a.longitude != null) setCoords({ latitude: a.latitude, longitude: a.longitude });
      } catch {
        toast('Could not load this address.');
      }
    })();
  }, [addressId]);

  // Apply a point chosen on the map picker.
  const picked = route.params?.picked;
  useEffect(() => {
    if (!picked) return;
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (picked.fullAddress) setFullAddress(picked.fullAddress);
    if (picked.area) setArea(picked.area);
    if (picked.city) setCity(picked.city);
  }, [picked]);

  const openMap = () => {
    navigation.navigate(
      'MapPicker',
      coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined,
    );
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const loc = await detectCurrentLocation();
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      if (loc.fullAddress) setFullAddress(loc.fullAddress);
      if (loc.area) setArea(loc.area);
      if (loc.city) setCity(loc.city);
      toast('📍 Pinned your current location');
    } catch (e: any) {
      toast(e instanceof LocationPermissionError ? e.message : 'Could not get your location. Try again outdoors.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const label = labelChip === 'Other' ? customLabel.trim() || 'Other' : labelChip;
    if (!fullAddress.trim()) return toast('Please enter the address.');
    if (!city.trim()) return toast('Please enter the city.');

    setSaving(true);
    const payload = {
      label,
      fullAddress: fullAddress.trim(),
      area: area.trim() || undefined,
      city: city.trim(),
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      instructions: instructions.trim() || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      isDefault,
    };
    try {
      const saved = addressId
        ? await api.put(`/customer/addresses/${addressId}`, payload)
        : await api.post('/customer/addresses', payload);
      if (fromCheckout) navigation.navigate('Checkout', { selectedAddressId: saved.id });
      else navigation.goBack();
    } catch (e: any) {
      toast(e?.message ?? 'Could not save the address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 32, gap: 14 }]} keyboardShouldPersistTaps="handled">
        {/* Use current location */}
        <TouchableOpacity
          style={[s.card, s.row, { gap: 12, borderColor: colors.primary, borderStyle: 'dashed' }]}
          onPress={useCurrentLocation}
          disabled={locating}
        >
          {locating ? <ActivityIndicator color={colors.primary} /> : <Text style={{ fontSize: 22 }}>📍</Text>}
          <View style={{ flex: 1 }}>
            <Text style={[s.body, { fontWeight: '800', color: colors.primary }]}>Use my current location</Text>
            <Text style={s.faint}>
              {coords ? `Pinned: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'Pins exact GPS so your rider can find you'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnGhost} onPress={openMap}>
          <Text style={s.btnGhostText}>🗺️ Pin on map</Text>
        </TouchableOpacity>

        {/* Label */}
        <View>
          <Text style={[s.muted, { marginBottom: 6 }]}>Save as</Text>
          <View style={[s.row, { gap: 8 }]}>
            {LABELS.map((l) => {
              const active = labelChip === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => setLabelChip(l.key)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.emeraldBg : colors.card,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{l.icon}</Text>
                  <Text style={{ marginTop: 2, fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.muted }}>
                    {l.key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {labelChip === 'Other' && (
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Label (e.g. Cousin's place, Office 2)"
              placeholderTextColor={colors.faint}
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          )}
        </View>

        {/* Address */}
        <Field label="Full address">
          <TextInput
            style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]}
            placeholder="House / flat, street, area, nearby landmark"
            placeholderTextColor={colors.faint}
            value={fullAddress}
            onChangeText={setFullAddress}
            multiline
          />
        </Field>

        <View style={[s.row, { gap: 8 }]}>
          <Field label="Area" style={{ flex: 1 }}>
            <TextInput style={s.input} placeholder="Gulberg" placeholderTextColor={colors.faint} value={area} onChangeText={setArea} />
          </Field>
          <Field label="City" style={{ flex: 1 }}>
            <TextInput style={s.input} placeholder="Lahore" placeholderTextColor={colors.faint} value={city} onChangeText={setCity} />
          </Field>
        </View>

        {/* Contact (optional — defaults to the account holder) */}
        <View style={[s.row, { gap: 8 }]}>
          <Field label="Contact name" style={{ flex: 1 }}>
            <TextInput style={s.input} placeholder="Who receives it" placeholderTextColor={colors.faint} value={contactName} onChangeText={setContactName} />
          </Field>
          <Field label="Contact phone" style={{ flex: 1 }}>
            <TextInput style={s.input} placeholder="+92…" placeholderTextColor={colors.faint} keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
          </Field>
        </View>

        <Field label="Note for rider (optional)">
          <TextInput
            style={s.input}
            placeholder="e.g. Ring the bell, 2nd floor, gate is green"
            placeholderTextColor={colors.faint}
            value={instructions}
            onChangeText={setInstructions}
          />
        </Field>

        {/* Default toggle */}
        <TouchableOpacity style={[s.row, { gap: 10 }]} onPress={() => setIsDefault((v) => !v)} activeOpacity={0.7}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: isDefault ? colors.primary : colors.border,
              backgroundColor: isDefault ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDefault && <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>✓</Text>}
          </View>
          <Text style={s.body}>Set as default delivery address</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btn, { marginTop: 4 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{addressId ? 'Save changes' : 'Save address'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  const { s } = useTheme();
  return (
    <View style={style}>
      <Text style={[s.muted, { marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}
