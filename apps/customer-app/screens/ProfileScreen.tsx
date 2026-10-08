import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LoginSheet } from '../components/LoginSheet';
import { GoogleAccountLink } from '../components/GoogleAccountLink';
import { api, clearAuth, isLoggedIn } from '../lib/api';
import { useTheme } from '../lib/theme';
import { refreshBadges } from '../lib/badges';
import { Icon, IconName, Notice, goTab, usePageInset } from '../components/CustomerUI';

/** C23/C24: public account entry, with authentication only for private destinations. */
export default function ProfileScreen() {
  const { colors, s, isDark } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const pendingDestination = useRef<null | (() => void)>(null);
  const generation = useRef(0);
  const load = useCallback(() => {
    const current = ++generation.current;
    void (async () => {
      const ok = await isLoggedIn();
      if (current !== generation.current) return;
      setLoggedIn(ok);
      setProfile(null);
      setError('');
      if (ok) {
        const result = await api.get('/customer/profile');
        if (current === generation.current) setProfile(result);
      }
    })().catch((cause) => { if (current === generation.current) setError(`${cause.message} Retry loading your profile.`); });
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { generation.current++; }; }, [load]));
  const privateAction = (action: () => void) => {
    if (loggedIn) action();
    else { pendingDestination.current = action; setShowLogin(true); }
  };
  const rows: { icon: IconName; title: string; description?: string; onPress: () => void }[] = [
    { icon: 'bag', title: 'Your orders', description: 'Track deliveries and view past orders', onPress: () => privateAction(() => goTab(navigation, 'OrdersTab')) },
    { icon: 'pin', title: 'Saved addresses', description: 'Home, work and other delivery places', onPress: () => privateAction(() => navigation.navigate('Addresses')) },
    { icon: 'sun', title: 'Appearance', description: 'Light, Dark or System', onPress: () => navigation.navigate('Appearance') },
    { icon: 'bell', title: 'Order updates', description: 'Notifications and delivery information', onPress: () => privateAction(() => navigation.navigate('Notifications')) },
    { icon: 'help', title: 'Help & support', onPress: () => navigation.navigate('Help') },
  ];
  const row = (item: typeof rows[number], index: number, total: number) => (
    <TouchableOpacity key={item.title} accessibilityRole="button" onPress={item.onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 14, minHeight: 61, borderBottomWidth: index < total - 1 ? 1 : 0, borderColor: colors.border }}>
      <Icon name={item.icon} color={colors.primary} size={21} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.body, { fontWeight: '700', lineHeight: 20 }]}>{item.title}</Text>
        {!!item.description && <Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>{item.description}</Text>}
      </View>
      <Icon name="chevron" size={21} />
    </TouchableOpacity>
  );
  const memberRows: typeof rows = [
    { icon: 'logout', title: 'Sign out', onPress: () => setConfirmSignOut(true) },
    { icon: 'trash', title: 'Delete account', description: 'Review before confirming', onPress: () => navigation.navigate('ProfileEdit', { deleteAccount: true }) },
  ];
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
        <Text accessibilityRole="header" style={s.h1}>Your account</Text>
        <View style={[s.card, { marginTop: 20 }]}>
          {loggedIn ? <View style={[s.row, { gap: 12 }]}>
            <View style={{ width: 51, height: 51, borderRadius: 17, backgroundColor: colors.emeraldBg, justifyContent: 'center', alignItems: 'center' }}>
              {profile?.fullName ? <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{profile.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((name: string) => name[0]).join('').toUpperCase()}</Text> : <Icon name="user" color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.h2, { fontSize: 17, lineHeight: 23 }]}>{profile?.fullName || 'Your account'}</Text>
              <Text style={s.muted}>{profile ? 'Your private shopping space' : 'Loading profile…'}</Text>
              <TouchableOpacity accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }} onPress={() => navigation.navigate('ProfileEdit')}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          </View> : <>
            <View style={{ width: 51, height: 51, borderRadius: 17, backgroundColor: colors.emeraldBg, justifyContent: 'center', alignItems: 'center' }}><Icon name="user" size={22} color={colors.primary} /></View>
            <Text accessibilityRole="header" style={[s.h2, { marginTop: 16 }]}>Shop first.{'\n'}Sign in when you’re ready.</Text>
            <Text style={[s.muted, { marginTop: 12 }]}>An account keeps your orders and addresses together. Browsing never needs one.</Text>
            <TouchableOpacity accessibilityRole="button" style={[s.btn, { marginTop: 16, justifyContent: 'center' }]} onPress={() => { pendingDestination.current = null; setShowLogin(true); }}><Text style={s.btnText}>Sign in or create account</Text></TouchableOpacity>
          </>}
        </View>
        {!!error && <View style={{ gap: 8, marginTop: 16 }}><Notice danger>{error}</Notice><TouchableOpacity accessibilityRole="button" onPress={load} style={s.btnGhost}><Text style={s.btnGhostText}>Retry profile</Text></TouchableOpacity></View>}
        <View style={[s.card, { padding: 0, overflow: 'hidden', marginTop: 20 }]}>{rows.map((item, index) => row(item, index, rows.length))}</View>
        {loggedIn && <View style={[s.card, { padding: 0, overflow: 'hidden', marginTop: 20 }]}>{memberRows.map((item, index) => row(item, index, memberRows.length))}</View>}
        {loggedIn && <GoogleAccountLink />}
        {confirmSignOut && <View style={[s.card, { gap: 12, marginTop: 16 }]}>
          <Text style={s.h2}>Sign out of your account?</Text><Text style={s.muted}>You can keep browsing. Your saved orders and addresses remain in your account.</Text>
          <TouchableOpacity accessibilityRole="button" disabled={signingOut} style={s.btnGhost} onPress={() => setConfirmSignOut(false)}><Text style={s.btnGhostText}>Stay signed in</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={signingOut} style={s.btn} onPress={async () => {
            if (signingOut) return;
            setSigningOut(true);
            try { await clearAuth(); setConfirmSignOut(false); load(); refreshBadges(); }
            catch (cause: any) { setError(`${cause.message} Try signing out again.`); }
            finally { setSigningOut(false); }
          }}><Text style={s.btnText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></TouchableOpacity>
        </View>}
        <Image source={isDark ? require('../assets/design/sirfbazar-slogan-urdu-dark.png') : require('../assets/design/sirfbazar-slogan-urdu-light.png')} accessibilityLabel="بازار وہی۔ طریقہ نیا۔" resizeMode="contain" style={{ width: 150, height: 26, alignSelf: 'center', marginTop: 22, marginBottom: 8 }} />
      </ScrollView>
      <LoginSheet visible={showLogin} onClose={() => { setShowLogin(false); pendingDestination.current = null; }} onSuccess={() => {
        setShowLogin(false); load(); refreshBadges(); const next = pendingDestination.current; pendingDestination.current = null; next?.();
      }} />
    </View>
  );
}
