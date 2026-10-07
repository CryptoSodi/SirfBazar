import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RootStackParamList } from '../App';
import { Badge, Body, Button, Card, H1, H2, IconBox, Label, Note, Page } from '../components/RiderUI';
import type { TabName } from '../components/RiderUI';
import { useRiderTheme } from '../lib/appearance';
import { registerForPush } from '../lib/push';

export default function RiderPermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useRiderTheme();
  const [location, setLocation] = useState<'granted' | 'not-enabled' | 'unknown'>('unknown');
  const [alerts, setAlerts] = useState<'granted' | 'not-enabled' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');
  const onTab = (tab: TabName) => navigation.navigate(tab === 'Deliveries' ? 'Home' : tab);
  const check = async () => {
    try {
      const [l, n] = await Promise.all([Location.getForegroundPermissionsAsync(), Notifications.getPermissionsAsync()]);
      setLocation(l.granted ? 'granted' : 'not-enabled');
      setAlerts(n.granted ? 'granted' : 'not-enabled');
    } catch { setMessage('Unable to read device permissions. Check system settings.'); }
  };
  useEffect(() => { void check(); }, []);
  const locationAccess = async () => {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setLocation(result.granted ? 'granted' : 'not-enabled');
      setMessage(result.granted ? 'Device location permission is enabled. This build does not send live GPS updates.' : 'Location is not enabled. Addresses and external navigation remain available.');
    } catch { setMessage('Unable to request location access. Check device settings.'); }
  };
  const notificationAccess = async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      setAlerts(result.granted ? 'granted' : 'not-enabled');
      if (result.granted) {
        await registerForPush();
        setMessage('Notification access granted. Check device settings if alerts do not arrive.');
      } else setMessage('Notifications are not enabled. Check device settings to allow alerts.');
    } catch { setMessage('Unable to request notification access. Check device settings.'); }
  };
  return <Page title="Location & alerts" back={() => navigation.goBack()} activeTab="Profile" onTab={onTab}>
    <Label>DEVICE ACCESS</Label><H1 style={{ marginTop: 8 }}>Stay connected{'\n'}to your delivery.</H1><Body muted style={{ marginTop: 12 }}>Review what the app uses and when.</Body>
    <Card style={{ marginTop: 22 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><IconBox name="pin" /><Badge tone={location === 'granted' ? 'green' : 'amber'}>{location === 'granted' ? 'Enabled' : 'Not enabled'}</Badge></View><H2 style={{ fontSize: 16, marginTop: 16 }}>Location during delivery</H2><Body muted small style={{ marginTop: 8 }}>Live GPS sharing is not active in this build. You can still read addresses and open external navigation.</Body><Button variant="quiet" onPress={() => void locationAccess()} style={{ marginTop: 16 }}>Review location access</Button></Card>
    <Card style={{ marginTop: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconBox name="bell" /><View style={{ flex: 1 }}><H2 style={{ fontSize: 16 }}>Delivery alerts</H2><Body muted small>New assignments and important updates</Body></View></View><Button variant="secondary" onPress={() => void notificationAccess()} style={{ marginTop: 16 }}>Review notification access</Button></Card>
    <Note style={{ marginTop: 22 }}>Online status and GPS access are different. Without location, addresses remain readable; location updates may be unavailable.</Note>
    {!!message && <Note tone={message.startsWith('Location access enabled') ? 'green' : 'neutral'} style={{ marginTop: 12 }}>{message}</Note>}
  </Page>;
}
