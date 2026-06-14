import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { LoginSheet } from '../components/LoginSheet';
import { api, clearAuth, isLoggedIn, pkr } from '../lib/api';
import { ThemeMode, useTheme } from '../lib/theme';
import { refreshBadges } from '../lib/badges';

const APPEARANCE_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'system', label: 'System', icon: '⚙️' },
  { key: 'light', label: 'Light', icon: '☀️' },
  { key: 'dark', label: 'Dark', icon: '🌙' },
];

export default function ProfileScreen() {
  const { colors, s, mode, setMode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const load = useCallback(() => {
    (async () => {
      const ok = await isLoggedIn();
      setLoggedIn(ok);
      if (ok) api.get('/customer/profile').then(setProfile).catch(() => undefined);
      else setProfile(null);
    })();
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>Account</Text>

        {!loggedIn ? (
          <View style={[s.card, { marginTop: 14, alignItems: 'center', padding: 24 }]}>
            <Text style={{ fontSize: 36 }}>👤</Text>
            <Text style={[s.body, { marginTop: 8, textAlign: 'center' }]}>
              Login to see your profile, wallet, and addresses.
            </Text>
            <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={() => setShowLogin(true)}>
              <Text style={s.btnText}>Login with phone</Text>
            </TouchableOpacity>
          </View>
        ) : profile ? (
          <>
            <View style={[s.card, { marginTop: 14 }]}>
              <Text style={[s.h2]}>{profile.fullName ?? 'Customer'}</Text>
              <Text style={s.muted}>{profile.phoneNumber ?? profile.email}</Text>
              <Text style={{ color: colors.primary, marginTop: 6, fontWeight: '700' }}>
                👛 Wallet: {pkr(profile.customer?.walletBalancePaisa ?? 0)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[s.muted, { marginTop: 14 }]}>Loading…</Text>
        )}

        {/* Saved addresses */}
        <TouchableOpacity style={[s.card, s.spread, { marginTop: 12 }]} onPress={() => navigation.navigate('Addresses')}>
          <View style={[s.row, { gap: 10 }]}>
            <Text style={{ fontSize: 20 }}>📍</Text>
            <Text style={[s.body, { fontWeight: '700' }]}>Saved addresses</Text>
          </View>
          <Text style={[s.faint, { fontSize: 18 }]}>›</Text>
        </TouchableOpacity>

        {/* Appearance */}
        <Text style={[s.h2, { marginTop: 24, marginBottom: 8 }]}>Appearance</Text>
        <View style={[s.row, { gap: 8 }]}>
          {APPEARANCE_OPTIONS.map((opt) => {
            const active = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setMode(opt.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.emeraldBg : colors.card,
                }}
              >
                <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    fontWeight: active ? '800' : '600',
                    color: active ? colors.primary : colors.muted,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loggedIn && profile && (
          <TouchableOpacity
            style={[s.btnGhost, { marginTop: 24 }]}
            onPress={async () => {
              await clearAuth();
              load();
              refreshBadges(); // recompute (orders → 0 for guest)
            }}
          >
            <Text style={s.btnGhostText}>Log out</Text>
          </TouchableOpacity>
        )}

        <Text style={[s.faint, { marginTop: 24, textAlign: 'center' }]}>
          SirfBazar — your nearby bazar, now online.
        </Text>
      </ScrollView>
      <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); refreshBadges(); }} />
    </SafeAreaView>
  );
}
