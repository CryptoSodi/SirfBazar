import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function RidersScreen() {
  const [riders, setRiders] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+9230');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/merchant/riders').then((r) => setRiders(Array.isArray(r) ? r : r.items ?? [])).catch(() => undefined);
  }, []);

  useFocusEffect(load);

  const addRider = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/merchant/riders', { fullName: name.trim(), phoneNumber: phone.trim() });
      setAdding(false);
      setName('');
      setPhone('+9230');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rider: any) => {
    try {
      await api.post(`/merchant/riders/${rider.id}/${rider.isActive ? 'deactivate' : 'activate'}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const decide = async (rider: any, action: 'approve' | 'reject') => {
    try {
      await api.post(`/merchant/riders/${rider.id}/${action}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={[s.pad, s.spread]}>
        <Text style={s.h1}>Your riders</Text>
        <TouchableOpacity style={s.btn} onPress={() => setAdding(true)}>
          <Text style={s.btnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={riders}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
            No riders yet — add your delivery staff so you can assign orders.
          </Text>
        }
        renderItem={({ item: r }) => (
          <View style={[s.card, s.spread]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '700' }]}>🛵 {r.fullName}</Text>
              <Text style={s.faint}>
                {r.phoneNumber} · {r.vehicleType?.toLowerCase()} {r.vehicleNumber && `· ${r.vehicleNumber}`}
              </Text>
              <Text style={[s.faint, { color: r.isOnline ? colors.primary : colors.faint }]}>
                {r.isOnline ? '🟢 online' : '⚪ offline'} · {r.currentStatus?.toLowerCase()}
              </Text>
              {r.approvalStatus === 'PENDING' && (
                <Text style={{ color: colors.amber, fontWeight: '700', fontSize: 11, marginTop: 2 }}>⏳ Requested to join your shop</Text>
              )}
            </View>
            {r.approvalStatus === 'PENDING' ? (
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={s.btn} onPress={() => decide(r, 'approve')}>
                  <Text style={s.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnDanger} onPress={() => decide(r, 'reject')}>
                  <Text style={s.btnDangerText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={r.isActive ? s.btnDanger : s.btnGhost} onPress={() => toggle(r)}>
                <Text style={r.isActive ? s.btnDangerText : s.btnGhostText}>
                  {r.isActive ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={s.h2}>Add a rider</Text>
            <Text style={[s.muted, { marginBottom: 12 }]}>
              The rider logs into the SirfBazar Rider app with this phone number (OTP login).
            </Text>
            <TextInput style={s.input} placeholder="Full name" value={name} onChangeText={setName} />
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="+92 3xx xxxxxxx"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {!!error && <Text style={{ color: colors.danger, marginTop: 8, fontSize: 13 }}>{error}</Text>}
            <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={addRider} disabled={busy || !name.trim()}>
              <Text style={s.btnText}>{busy ? 'Adding…' : 'Add rider'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setAdding(false)}>
              <Text style={s.muted}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
