import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, isLoggedIn } from '../lib/api';
import { useTheme } from '../lib/theme';
import { toast } from '../components/Toast';

const LABEL_ICONS: Record<string, string> = { Home: '🏠', Work: '💼', Family: '❤️' };
const iconFor = (label?: string) => (label && LABEL_ICONS[label]) || '📍';

/** Foodpanda-style saved-address book: add, edit, set default, delete. */
export default function AddressesScreen() {
  const { colors, s } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [addresses, setAddresses] = useState<any[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const load = useCallback(() => {
    (async () => {
      if (!(await isLoggedIn())) {
        setNeedLogin(true);
        setAddresses(null);
        return;
      }
      setNeedLogin(false);
      api.get('/customer/addresses').then(setAddresses).catch(() => setAddresses([]));
    })();
  }, []);

  useFocusEffect(load);

  const setDefault = async (id: string) => {
    try {
      await api.put(`/customer/addresses/${id}/default`, {});
      load();
    } catch (e: any) {
      toast(e?.message ?? 'Could not update.');
    }
  };

  const remove = (item: any) => {
    Alert.alert('Delete address', `Remove "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/customer/addresses/${item.id}`);
            load();
          } catch (e: any) {
            toast(e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  };

  if (needLogin) {
    return (
      <SafeAreaView style={s.screen} edges={['bottom']}>
        <View style={[s.pad, { alignItems: 'center', marginTop: 60 }]}>
          <Text style={{ fontSize: 40 }}>📍</Text>
          <Text style={[s.h2, { marginTop: 8 }]}>Login to manage addresses</Text>
          <Text style={[s.muted, { marginTop: 4, textAlign: 'center' }]}>Save home, work and more to check out faster.</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 14 }]} onPress={() => setShowLogin(true)}>
            <Text style={s.btnText}>Login</Text>
          </TouchableOpacity>
        </View>
        <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      <FlatList
        contentContainerStyle={[s.pad, { gap: 10, paddingBottom: 96 }]}
        data={addresses ?? []}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={
          addresses ? (
            <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No saved addresses yet. Add one below.</Text>
          ) : (
            <Text style={[s.muted, { marginTop: 12 }]}>Loading…</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={[s.row, { gap: 10 }]}>
              <Text style={{ fontSize: 22 }}>{iconFor(item.label)}</Text>
              <View style={{ flex: 1 }}>
                <View style={[s.row, { gap: 8 }]}>
                  <Text style={[s.body, { fontWeight: '800' }]}>{item.label}</Text>
                  {item.isDefault && (
                    <Text style={[s.chip, { backgroundColor: colors.emeraldBg, color: colors.primary, fontWeight: '700' }]}>Default</Text>
                  )}
                </View>
                <Text style={s.muted} numberOfLines={2}>{item.fullAddress}</Text>
                {!!item.instructions && <Text style={[s.faint, { marginTop: 2 }]} numberOfLines={1}>📝 {item.instructions}</Text>}
              </View>
            </View>
            <View style={[s.row, { gap: 8, marginTop: 12 }]}>
              <TouchableOpacity style={[s.btnGhost, { flex: 1, paddingVertical: 8 }]} onPress={() => navigation.navigate('AddressEdit', { addressId: item.id })}>
                <Text style={s.btnGhostText}>Edit</Text>
              </TouchableOpacity>
              {!item.isDefault && (
                <TouchableOpacity style={[s.btnGhost, { flex: 1, paddingVertical: 8 }]} onPress={() => setDefault(item.id)}>
                  <Text style={s.btnGhostText}>Set default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.btnGhost, { paddingVertical: 8, paddingHorizontal: 14, borderColor: colors.danger }]} onPress={() => remove(item)}>
                <Text style={[s.btnGhostText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={[s.pad, { position: 'absolute', left: 0, right: 0, bottom: 0 }]}>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('AddressEdit', {})}>
          <Text style={s.btnText}>➕ Add new address</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
