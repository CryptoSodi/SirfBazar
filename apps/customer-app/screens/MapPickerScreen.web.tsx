import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { detectCurrentLocation, reverseGeocode } from '../lib/location';
import { useTheme } from '../lib/theme';
import { setLocation } from '../lib/api';
import { ActionDock, Icon, Notice, usePageInset } from '../components/CustomerUI';
/** Browser-safe picker; the native screen keeps its draggable react-native-maps pin. */
export default function MapPickerScreen() {
    const { colors, s } = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'MapPicker'>>();
    const inset = usePageInset();
    const [latitude, setLatitude] = useState(String(route.params?.latitude ?? ''));
    const [longitude, setLongitude] = useState(String(route.params?.longitude ?? ''));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const coordinates = () => {
        const lat = Number(latitude.trim());
        const lng = Number(longitude.trim());
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !latitude.trim() || !longitude.trim()) {
            setError('Enter a valid latitude and longitude, or use your current location.');
            return null;
        }
        setError('');
        return { latitude: lat, longitude: lng };
    };
    const useCurrentLocation = async () => {
        setBusy(true);
        setError('');
        try {
            const found = await detectCurrentLocation();
            setLatitude(String(found.latitude));
            setLongitude(String(found.longitude));
        }
        catch {
            setError('Location access failed. Allow it in your browser, or enter coordinates below.');
        }
        finally {
            setBusy(false);
        }
    };
    const preview = () => {
        const point = coordinates();
        if (!point)
            return;
        const { latitude: lat, longitude: lng } = point;
        Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`);
    };
    const confirm = async () => {
        const point = coordinates();
        if (!point)
            return;
        setBusy(true);
        try {
            const address = await reverseGeocode(point.latitude, point.longitude);
            if (route.params?.browsing) {
                await setLocation({ ...point, label: [address.area, address.city].filter(Boolean).join(', ') || 'Selected map point' });
                navigation.popTo('Home');
            }
            else if (route.params?.returnTo === 'Checkout')
                navigation.popTo('Checkout', { picked: { ...point, ...address } }, { merge: true });
            else
                navigation.popTo('AddressEdit', { picked: { ...point, ...address } }, { merge: true });
        }
        catch {
            setError('Unable to confirm this location. Check your connection and try again.');
        }
        finally {
            setBusy(false);
        }
    };
    return (<View style={s.screen}><ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26, gap: 16 }}>
      <Text accessibilityRole="header" style={s.h1}>Pin your doorstep.</Text>
      <Text style={s.muted}>A clear address and a confirmed pin help your shop’s rider find you.</Text>
      <View style={{ minHeight: 180, borderRadius: 18, backgroundColor: colors.canvas, padding: 20, justifyContent: 'center', alignItems: 'center', gap: 12 }}><Icon name="pin" size={40} color={colors.primary}/><Text style={[s.body, { fontWeight: '700' }]}>Delivery location</Text><Text style={[s.muted, { textAlign: 'center' }]}>The native app has an interactive map. In this browser, use current location or enter coordinates and preview the pin.</Text></View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use my current location" disabled={busy} onPress={useCurrentLocation} style={[s.btn, { opacity: busy ? 0.6 : 1 }]}>
        <Text style={s.btnText}>{busy ? 'Finding location…' : 'Use my current location'}</Text>
      </TouchableOpacity>

      <View style={{ gap: 6 }}>
        <Text style={s.body}>Latitude</Text>
        <TextInput accessibilityLabel="Latitude" keyboardType="decimal-pad" value={latitude} onChangeText={setLatitude} editable={!busy} style={s.input}/>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={s.body}>Longitude</Text>
        <TextInput accessibilityLabel="Longitude" keyboardType="decimal-pad" value={longitude} onChangeText={setLongitude} editable={!busy} style={s.input}/>
      </View>

      {error ? <Notice danger>{error}</Notice> : null}

      <TouchableOpacity accessibilityRole="button" onPress={preview} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[s.body, { color: colors.primary, fontWeight: '600' }]}>Preview location on map ↗</Text>
      </TouchableOpacity>
      <View style={s.card}><Text style={[s.body, { fontSize: 16, fontWeight: '700' }]}>Delivery address</Text><Text style={[s.muted, { marginTop: 8 }]}>{[route.params?.fullAddress || 'Add your house, street and area', route.params?.city].filter(Boolean).join(', ')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Edit written address</Text></TouchableOpacity></View>
      <Text style={s.muted}>Make sure the pin matches your written address. You can edit either before continuing.</Text>
    </ScrollView><ActionDock>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={confirm} style={[s.btn, { opacity: busy ? 0.6 : 1, justifyContent: 'center' }]}>
        <Text style={s.btnText}>{route.params?.browsing ? 'Confirm location' : 'Confirm pin & return'}</Text>
      </TouchableOpacity>
    </ActionDock></View>);
}
