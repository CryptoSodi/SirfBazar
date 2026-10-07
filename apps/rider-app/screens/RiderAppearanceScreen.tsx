import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, Card, H1, H2, IconBox, Label, Note, Page } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { useRiderTheme } from '../lib/appearance';
import type { Appearance } from '../lib/appearance';

export default function RiderAppearanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { appearance, setAppearance, palette } = useRiderTheme();
  const onTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  return <Page title="Appearance" back={() => navigation.goBack()} activeTab="Profile" onTab={onTab}>
    <Label>MAKE IT COMFORTABLE</Label><H1 style={{ marginTop: 8 }}>Your app.{'\n'}Your light.</H1><Body muted style={{ marginTop: 12 }}>Choose an appearance that suits you. System follows your device.</Body>
    <View style={{ flexDirection: 'row', gap: 9, marginTop: 20 }}>{(['light', 'dark', 'system'] as Appearance[]).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected: appearance === mode }} onPress={() => setAppearance(mode)} style={{ flex: 1, alignItems: 'center', minHeight: 83, borderRadius: 15, borderWidth: appearance === mode ? 2 : 1, borderColor: appearance === mode ? palette.accent : palette.line, backgroundColor: appearance === mode ? palette.mint : palette.surface, paddingVertical: 14 }}><View style={{ width: 50, height: 30, borderRadius: 6, borderWidth: 1, borderColor: palette.control, backgroundColor: mode === 'dark' ? '#19221E' : '#F0F4F0', flexDirection: 'row', alignItems: 'center', padding: 4, gap: 3 }}><View style={{ width: 8, height: 21, borderRadius: 2, backgroundColor: '#009966' }} /><View style={{ width: 25, height: 13, borderRadius: 2, backgroundColor: '#94C5AB' }} /></View><Text style={{ marginTop: 7, color: appearance === mode ? palette.accent : palette.ink, fontSize: 12 }}>{mode[0].toUpperCase() + mode.slice(1)}</Text></Pressable>)}</View>
    <H2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>Preview</H2><Card><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="box" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>Ready for pickup</H2><Body muted small>Rehman General Store</Body></View><Badge tone="blue">Assigned</Badge></View><Button onPress={() => navigation.navigate('Home')} icon="arrow" style={{ marginTop: 20 }}>View delivery</Button></Card>
    <Note icon="shield" style={{ marginTop: 22 }}>Changing appearance won’t change your delivery, entered code or online status.</Note>
    <Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="system" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>Reduced motion</H2><Body muted small>Follows your device preference</Body></View></View><Body muted small style={{ marginTop: 14 }}>Core actions remain clear without decorative movement.</Body></Card>
  </Page>;
}
