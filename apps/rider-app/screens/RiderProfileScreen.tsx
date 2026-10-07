import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, Card, Divider, H2, Icon, IconBox, Label, Note, Page, Sheet } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { api, ApiError, clearAuth, getUser } from '../lib/api';
import { useRiderTheme } from '../lib/appearance';

export default function RiderProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [signOutSheet, setSignOutSheet] = useState(false);
  const load = useCallback(async () => {
    try { setProfile(await api.get('/rider/profile')); setUser(await getUser()); setMessage(''); }
    catch (e: any) {
      setProfile(null); setUser(null);
      if (e instanceof ApiError && e.status === 401) navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      else setMessage(e?.message ?? 'Could not load your profile. Try again.');
    }
  }, [navigation]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const onTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  const phone = profile?.phoneNumber ?? user?.phoneNumber ?? '';
  const masked = phone ? `${phone.slice(0, 7)} ••• ••${phone.slice(-2)}` : 'Number unavailable';
  const initials = profile?.fullName?.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() ?? 'R';
  const signOut = async () => {
    await clearAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  return <Page activeTab="Profile" onTab={onTab}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}><View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: palette.mint, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: palette.accent, fontSize: 22, fontWeight: '700' }}>{initials}</Text></View><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 23, fontWeight: '700' }}>{profile?.fullName ?? 'Rider profile'}</Text><Body muted small>{masked}</Body></View><Badge>{profile?.isActive ? 'Active' : profile?.approvalStatus === 'PENDING' ? 'Pending' : 'Inactive'}</Badge></View>
    {!!message && <Note tone="red" style={{ marginTop: 16 }}>{message}</Note>}
    <Card style={{ marginTop: 22 }}><Label>YOUR SHOP</Label><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}><IconBox name="shop" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>{profile?.merchant?.shopName ?? 'Shop unavailable'}</H2><Body muted small>{profile?.merchant?.address ?? ''}</Body></View></View><Divider /><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}><Body muted>Vehicle</Body><Body style={{ fontWeight: '700' }}>{profile?.vehicleType?.replace(/_/g, ' ').toLowerCase() ?? 'Not provided'}</Body></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Body muted>Account approval</Body><Badge>{profile?.approvalStatus ?? 'Unknown'}</Badge></View></Card>
    <H2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>Preferences</H2>
    <ProfileCell icon="sun" title="Appearance" description="Light, Dark or follow your device" onPress={() => navigation.navigate('Appearance')} />
    <ProfileCell icon="pin" title="Location & alerts" description="Device permissions and tracking" onPress={() => navigation.navigate('Permissions')} />
    <ProfileCell icon="help" title="Help & support" description="Contact your shop or support" onPress={() => navigation.navigate('Help')} />
    <Note icon="lock" style={{ marginTop: 12 }}>Your shop manages rider details. Contact the owner for changes.</Note>
    <Button variant="secondary" onPress={() => setSignOutSheet(true)} style={{ marginTop: 22 }}>Sign out</Button>
    <Sheet visible={signOutSheet} title="Sign out?" onClose={() => setSignOutSheet(false)}><Body muted>You’ll need to sign in again to view private deliveries.</Body><Button onPress={() => void signOut()} style={{ marginTop: 16 }}>Sign out</Button><Button variant="secondary" onPress={() => setSignOutSheet(false)} style={{ marginTop: 10 }}>Stay signed in</Button></Sheet>
  </Page>;
}
function ProfileCell({ icon, title, description, onPress }: { icon: 'sun' | 'pin' | 'help'; title: string; description: string; onPress: () => void }) {
  const { palette } = useRiderTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 9 }}><IconBox name={icon} /><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700' }}>{title}</Text><Body muted small style={{ marginTop: 3 }}>{description}</Body></View><Icon name="chevron" color={palette.quiet} size={17} /></Pressable>;
}
