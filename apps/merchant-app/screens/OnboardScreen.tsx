import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, finishOnboarding, uploadImage } from '../lib/api';
import { colors, s } from '../lib/theme';

const SHOP_TYPES = [
  'GROCERY', 'PHARMACY', 'BAKERY', 'FRUITS_VEGETABLES', 'GENERAL', 'MOBILE_ACCESSORIES',
  'ELECTRONICS', 'COSMETICS', 'STATIONERY', 'PET', 'HOUSEHOLD', 'ORGANIC', 'OTHER',
];
const label = (t: string) => t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function OnboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [photo, setPhoto] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopType, setShopType] = useState('GROCERY');
  const [phone, setPhone] = useState('+9230');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lahore');
  const [area, setArea] = useState('');
  const [opening, setOpening] = useState('09:00');
  const [closing, setClosing] = useState('21:00');
  const [minOrder, setMinOrder] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickPhoto = async (fromCamera: boolean) => {
    setError('');
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Permission needed to add a photo.');
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [16, 9] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [16, 9] });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission needed to pin your shop.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setError('Could not get your location — try again outdoors.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!shopName.trim()) return setError('Shop name is required.');
    if (!phone.trim()) return setError('Phone number is required.');
    if (!address.trim()) return setError('Address is required.');
    if (!city.trim()) return setError('City is required.');
    if (!coords) return setError('Tap “Use my current location” to pin your shop.');

    setBusy(true);
    setError('');
    try {
      let bannerUrl: string | undefined;
      if (photo) bannerUrl = await uploadImage(photo);

      const res = await api.post('/merchant/onboard', {
        shopName: shopName.trim(),
        shopType,
        phoneNumber: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        area: area.trim() || undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        openingTime: opening.trim() || undefined,
        closingTime: closing.trim() || undefined,
        minimumOrderValuePaisa: minOrder.trim() ? Math.round(Number(minOrder) * 100) : undefined,
        bannerUrl,
        logoUrl: bannerUrl,
      });

      await finishOnboarding(res); // store the fresh merchant tokens + profile
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your shop.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await clearAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Set up your shop</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>A few details so customers can find and order from you.</Text>

        {/* Shop front photo */}
        <Text style={[s.h2, { marginTop: 18, marginBottom: 8 }]}>Shop front photo</Text>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: '100%', height: 160, borderRadius: 14, marginBottom: 8 }} />
        ) : (
          <View style={{ height: 160, borderRadius: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 34 }}>🏪</Text>
            <Text style={s.faint}>Add a photo of your shop</Text>
          </View>
        )}
        <View style={[s.row, { gap: 8 }]}>
          <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => pickPhoto(true)}>
            <Text style={s.btnGhostText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => pickPhoto(false)}>
            <Text style={s.btnGhostText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Basics */}
        <Field label="Shop name">
          <TextInput style={s.input} value={shopName} onChangeText={setShopName} placeholder="e.g. Ali Kiryana Store" placeholderTextColor={colors.faint} />
        </Field>

        <Text style={[s.muted, { marginTop: 14, marginBottom: 6 }]}>Shop type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SHOP_TYPES.map((t) => {
            const active = shopType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setShopType(t)}
                style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.emeraldBg : colors.card }}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.muted }}>{label(t)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field label="Shop phone number">
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+92 3xx xxxxxxx" placeholderTextColor={colors.faint} />
        </Field>
        <Field label="Address">
          <TextInput style={[s.input, { minHeight: 56, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} multiline placeholder="Shop address, street, landmark" placeholderTextColor={colors.faint} />
        </Field>
        <View style={[s.row, { gap: 8 }]}>
          <Field label="Area" style={{ flex: 1 }}>
            <TextInput style={s.input} value={area} onChangeText={setArea} placeholder="Gulberg III" placeholderTextColor={colors.faint} />
          </Field>
          <Field label="City" style={{ flex: 1 }}>
            <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Lahore" placeholderTextColor={colors.faint} />
          </Field>
        </View>

        {/* Location */}
        <TouchableOpacity style={[s.btnGhost, { marginTop: 14, borderColor: colors.primary }]} onPress={useCurrentLocation} disabled={locating}>
          {locating ? <ActivityIndicator color={colors.primary} /> : (
            <Text style={[s.btnGhostText, { color: colors.primary }]}>
              {coords ? `📍 Pinned: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : '📍 Use my current location'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Hours + min order */}
        <View style={[s.row, { gap: 8 }]}>
          <Field label="Opens" style={{ flex: 1 }}>
            <TextInput style={s.input} value={opening} onChangeText={setOpening} placeholder="09:00" placeholderTextColor={colors.faint} />
          </Field>
          <Field label="Closes" style={{ flex: 1 }}>
            <TextInput style={s.input} value={closing} onChangeText={setClosing} placeholder="21:00" placeholderTextColor={colors.faint} />
          </Field>
          <Field label="Min order (Rs)" style={{ flex: 1 }}>
            <TextInput style={s.input} value={minOrder} onChangeText={(v) => setMinOrder(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.faint} />
          </Field>
        </View>

        {!!error && <Text style={{ color: colors.danger, marginTop: 12, fontSize: 13 }}>{error}</Text>}

        <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create my shop</Text>}
        </TouchableOpacity>
        <Text style={[s.faint, { textAlign: 'center', marginTop: 8 }]}>Your shop is reviewed before it goes live.</Text>
        <TouchableOpacity onPress={logout} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={s.muted}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label: lbl, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      <Text style={[s.muted, { marginBottom: 6 }]}>{lbl}</Text>
      {children}
    </View>
  );
}
