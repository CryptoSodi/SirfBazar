import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, finishOnboarding } from '../lib/api';
import { colors, s } from '../lib/theme';

const VEHICLES = ['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT'];
const vlabel = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function OnboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+9230');
  const [vehicleType, setVehicleType] = useState('MOTORBIKE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [shops, setShops] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rider/shops').then(setShops).catch(() => setShops([]));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return shops;
    return shops.filter((sh) => `${sh.shopName} ${sh.area ?? ''} ${sh.city ?? ''}`.toLowerCase().includes(t));
  }, [q, shops]);

  const submit = async () => {
    if (!fullName.trim()) return setError('Your name is required.');
    if (phone.trim().length < 10) return setError('A valid phone number is required.');
    if (!merchantId) return setError('Select the shop you want to deliver for.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/rider/apply', {
        merchantId,
        fullName: fullName.trim(),
        phoneNumber: phone.trim(),
        vehicleType,
        vehicleNumber: vehicleNumber.trim() || undefined,
      });
      await finishOnboarding(res);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      setError(e?.message ?? 'Could not submit your request.');
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
        <Text style={s.h1}>Become a rider</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>Tell us about yourself and pick the shop you'll deliver for.</Text>

        <Field label="Your name">
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={colors.faint} />
        </Field>
        <Field label="Phone number">
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+92 3xx xxxxxxx" placeholderTextColor={colors.faint} />
        </Field>

        <Text style={[s.muted, { marginTop: 14, marginBottom: 6 }]}>Vehicle</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {VEHICLES.map((v) => {
            const active = vehicleType === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setVehicleType(v)}
                style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.emeraldBg : colors.card }}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.muted }}>{vlabel(v)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Field label="Vehicle number (optional)">
          <TextInput style={s.input} value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="ABC-123" placeholderTextColor={colors.faint} />
        </Field>

        <Text style={[s.h2, { marginTop: 18, marginBottom: 8 }]}>Choose your shop</Text>
        <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Search shops…" placeholderTextColor={colors.faint} />
        <View style={{ marginTop: 8, gap: 8 }}>
          {filtered.length === 0 && (
            <Text style={s.muted}>No shops available yet. (A shop must be approved before it can take riders.)</Text>
          )}
          {filtered.map((sh) => {
            const active = merchantId === sh.id;
            return (
              <TouchableOpacity key={sh.id} onPress={() => setMerchantId(sh.id)} style={[s.card, active && { borderColor: colors.primary, backgroundColor: colors.emeraldBg }]}>
                <View style={s.spread}>
                  <Text style={[s.body, { fontWeight: '700' }]}>🏪 {sh.shopName}</Text>
                  <Text style={{ color: active ? colors.primary : colors.faint, fontWeight: '900', fontSize: 16 }}>{active ? '●' : '○'}</Text>
                </View>
                <Text style={s.faint}>{[sh.area, sh.city].filter(Boolean).join(', ')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!error && <Text style={{ color: colors.danger, marginTop: 12, fontSize: 13 }}>{error}</Text>}
        <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send request to shop</Text>}
        </TouchableOpacity>
        <Text style={[s.faint, { textAlign: 'center', marginTop: 8 }]}>The shop reviews your request before you can start delivering.</Text>
        <TouchableOpacity onPress={logout} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={s.muted}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[s.muted, { marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}
