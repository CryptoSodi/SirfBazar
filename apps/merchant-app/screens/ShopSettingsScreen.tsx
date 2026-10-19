import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';
import type { RootStackParamList } from '../App';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Hours = { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string; closesNextDay: boolean };
const validMoney = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(Math.round(Number(value) * 100));

export default function ShopSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState('5');
  const [fee, setFee] = useState('0');
  const [minimum, setMinimum] = useState('0');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [hours, setHours] = useState<Hours[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await api.get('/merchant/profile');
      setLoadError(false);
      setShopName(profile.shopName ?? ''); setDescription(profile.description ?? '');
      setAddress(profile.address ?? ''); setArea(profile.area ?? ''); setCity(profile.city ?? '');
      setRadius(String(profile.serviceRadiusKm ?? 5));
      setFee(String((profile.deliveryFeePaisa ?? 0) / 100));
      setMinimum(String((profile.minimumOrderValuePaisa ?? 0) / 100));
      setLatitude(profile.latitude ?? null); setLongitude(profile.longitude ?? null);
      setHours(DAYS.map((_, dayOfWeek) => {
        const saved = profile.operatingHours?.find((row: any) => row.dayOfWeek === dayOfWeek);
        return { dayOfWeek, isClosed: !!saved?.isClosed, opensAt: saved?.opensAt ?? profile.openingTime ?? '09:00', closesAt: saved?.closesAt ?? profile.closingTime ?? '21:00', closesNextDay: !!saved?.closesNextDay };
      }));
    } catch (error: any) { setLoadError(true); toast(error.message || 'Unable to load shop settings. Try again.', false); }
    finally { setLoading(false); }
  }, [toast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const updateDay = (dayOfWeek: number, patch: Partial<Hours>) => setHours((current) => current.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  const useLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return toast('Allow location access to pin your shop entrance.', false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(position.coords.latitude); setLongitude(position.coords.longitude);
      toast('Current location selected. Save changes to update your shop.');
    } catch { toast('Unable to get your current location. Try again outdoors.', false); }
  };
  const save = async () => {
    if (busy) return;
    if (!shopName.trim() || !address.trim() || !city.trim()) return toast('Enter a shop name, address and city.', false);
    if (!validMoney(fee) || !validMoney(minimum)) return toast('Enter valid delivery fee and minimum order amounts.', false);
    if (!Number.isFinite(Number(radius)) || Number(radius) < 0.5 || Number(radius) > 50) return toast('Coverage radius must be between 0.5 and 50 km.', false);
    if (hours.length !== 7 || hours.some((day) => !day.isClosed && (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(day.opensAt) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(day.closesAt)))) return toast('Enter valid opening and closing times as HH:MM for each open day.', false);
    setBusy(true);
    try {
      await api.put('/merchant/profile', {
        shopName: shopName.trim(), description: description.trim(), address: address.trim(), area: area.trim(), city: city.trim(),
        serviceRadiusKm: Number(radius), deliveryFeePaisa: Math.round(Number(fee) * 100), minimumOrderValuePaisa: Math.round(Number(minimum) * 100),
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
        operatingHours: hours,
      });
      toast('Shop settings saved.');
      await load();
    } catch (error: any) { toast(error.message || 'Unable to save shop settings. Try again.', false); }
    finally { setBusy(false); }
  };
  const input = (label: string, value: string, setter: (value: string) => void, options: any = {}) => <View style={{ marginTop: 14 }}>
    <Text style={[s.body, { fontWeight: '700', marginBottom: 6 }]}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, { minHeight: 48 }, options.multiline && { minHeight: 84, textAlignVertical: 'top' }]} value={value} onChangeText={setter} {...options} />
  </View>;

  return <SafeAreaView style={s.screen} edges={['bottom']}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <Text style={s.h1}>Shop settings</Text>
    {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} /> : loadError ? <View style={[s.card, { marginTop: 18, gap: 10 }]}><Text style={s.body}>Shop settings could not be loaded. Check your connection and try again.</Text><TouchableOpacity style={s.btnGhost} onPress={() => void load()}><Text style={s.btnGhostText}>Retry</Text></TouchableOpacity></View> : <>
      {input('Shop name', shopName, setShopName)}
      {input('Description', description, setDescription, { multiline: true })}
      {input('Address', address, setAddress, { multiline: true })}
      {input('Area', area, setArea)}
      {input('City', city, setCity)}
      <Text style={[s.h2, { marginTop: 22 }]}>Shop entrance</Text>
      <Text style={[s.muted, { marginTop: 6 }]}>Pinned: {latitude?.toFixed(5) ?? '—'}, {longitude?.toFixed(5) ?? '—'}</Text>
      <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 8 }]} onPress={() => void useLocation()}><Text style={s.btnGhostText}>Use current location</Text></TouchableOpacity>
      <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 8 }]} onPress={() => void Linking.openURL('https://shop.sirfbazar.com/profile')}><Text style={s.btnGhostText}>Pin on map in browser</Text></TouchableOpacity>
      <Text style={[s.h2, { marginTop: 22 }]}>Delivery & orders</Text>
      {input('Coverage radius (km)', radius, setRadius, { keyboardType: 'decimal-pad' })}
      {input('Delivery fee (Rs)', fee, setFee, { keyboardType: 'decimal-pad' })}
      {input('Minimum order (Rs)', minimum, setMinimum, { keyboardType: 'decimal-pad' })}
      <Text style={[s.h2, { marginTop: 22 }]}>Weekly opening hours</Text>
      <Text style={[s.muted, { marginTop: 4 }]}>Times use Pakistan local time. A closed day is not shown as open to customers.</Text>
      {hours.map((day) => <View key={day.dayOfWeek} style={[s.card, { marginTop: 10 }]}>
        <View style={s.spread}><Text style={[s.body, { fontWeight: '700' }]}>{DAYS[day.dayOfWeek]}</Text><TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: day.isClosed }} onPress={() => updateDay(day.dayOfWeek, { isClosed: !day.isClosed })} style={s.btnGhost}><Text style={s.btnGhostText}>{day.isClosed ? 'Closed' : 'Open'}</Text></TouchableOpacity></View>
        {!day.isClosed && <><View style={[s.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>{input(`${DAYS[day.dayOfWeek]} opens`, day.opensAt, (value) => updateDay(day.dayOfWeek, { opensAt: value }), { placeholder: '09:00' })}</View>
          <View style={{ flex: 1 }}>{input(`${DAYS[day.dayOfWeek]} closes`, day.closesAt, (value) => updateDay(day.dayOfWeek, { closesAt: value }), { placeholder: '21:00' })}</View>
        </View><TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: day.closesNextDay }} onPress={() => updateDay(day.dayOfWeek, { closesNextDay: !day.closesNextDay })} style={{ marginTop: 10 }}><Text style={s.muted}>{day.closesNextDay ? '☑' : '☐'} Closes next day</Text></TouchableOpacity></>}
      </View>)}
      <TouchableOpacity style={[s.btn, { minHeight: 48, marginTop: 24 }]} disabled={busy} onPress={() => void save()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save changes</Text>}</TouchableOpacity>
      <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 10 }]} onPress={() => navigation.navigate('Tour')}><Text style={s.btnGhostText}>Replay app tour</Text></TouchableOpacity>
    </>}
  </ScrollView></SafeAreaView>;
}
