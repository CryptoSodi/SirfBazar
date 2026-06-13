import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginSheet } from '../components/LoginSheet';
import { api, clearAuth, isLoggedIn, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';
import { refreshBadges } from '../lib/badges';

export default function ProfileScreen() {
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

            <TouchableOpacity
              style={[s.btnGhost, { marginTop: 14 }]}
              onPress={async () => {
                await clearAuth();
                load();
                refreshBadges(); // recompute (orders → 0 for guest)
              }}
            >
              <Text style={s.btnGhostText}>Log out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[s.muted, { marginTop: 14 }]}>Loading…</Text>
        )}

        <Text style={[s.faint, { marginTop: 24, textAlign: 'center' }]}>
          SirfBazar — your nearby bazar, now online.
        </Text>
      </ScrollView>
      <LoginSheet visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); load(); refreshBadges(); }} />
    </SafeAreaView>
  );
}
