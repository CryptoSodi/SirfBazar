import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { RootStackParamList } from '../App';
import { detectCurrentLocation, GeocodedAddress, reverseGeocode } from '../lib/location';
import { setLocation } from '../lib/api';
import { ActionDock, Icon, Notice, usePageInset } from '../components/CustomerUI';
import { DeliveryPoint, isDeliveryPoint } from '../lib/checkout-draft';
import { useTheme } from '../lib/theme';
// A map camera needs a centre. This is never a selected or confirmed delivery point.
const INITIAL_CAMERA = { latitude: 31.5204, longitude: 74.3587 };
export default function MapPickerScreen() {
    const { colors, s } = useTheme();
    const inset = usePageInset();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'MapPicker'>>();
    const params = route.params ?? {};
    const mapRef = useRef<MapView>(null);
    const initial = isDeliveryPoint(params) ? { latitude: params.latitude, longitude: params.longitude } : null;
    const [marker, setMarker] = useState<DeliveryPoint | null>(initial);
    const [resolved, setResolved] = useState<GeocodedAddress | null>(null);
    const [resolving, setResolving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const lookup = useRef(0);
    const resolve = async (point: DeliveryPoint) => {
        const version = ++lookup.current;
        setResolving(true);
        try {
            const address = await reverseGeocode(point.latitude, point.longitude);
            if (lookup.current === version)
                setResolved(address);
        }
        catch {
            if (lookup.current === version) {
                setResolved(null);
                setError('The map pin is selected, but its written address could not be found. Keep your written delivery address.');
            }
        }
        finally {
            if (lookup.current === version)
                setResolving(false);
        }
    };
    useEffect(() => { if (initial)
        void resolve(initial); return () => { lookup.current++; }; }, []);
    const onPick = (point: DeliveryPoint) => { setMarker(point); setError(''); setLocating(false); void resolve(point); };
    const locate = async () => {
        if (locating)
            return;
        setLocating(true);
        setError('');
        setResolving(false);
        const version = ++lookup.current;
        try {
            const found = await detectCurrentLocation();
            if (version !== lookup.current) return;
            const point = { latitude: found.latitude, longitude: found.longitude };
            setMarker(point);
            setResolved(found);
            mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 0);
        }
        catch (cause: any) {
            if (version === lookup.current) setError(`${cause.message} You can tap the map to select a pin manually.`);
        }
        finally {
            if (version === lookup.current) setLocating(false);
        }
    };
    const confirm = async () => {
        if (!marker || saving)
            return;
        setSaving(true);
        try {
            if (params.browsing) {
                await setLocation({ ...marker, label: [resolved?.area, resolved?.city].filter(Boolean).join(', ') || 'Selected map point' });
                navigation.popTo('Home');
            }
            else {
                const picked = { ...marker, fullAddress: resolved?.fullAddress, area: resolved?.area, city: resolved?.city, province: resolved?.province };
                if (params.returnTo === 'Checkout')
                    navigation.popTo('Checkout', { picked }, { merge: true });
                else
                    navigation.popTo('AddressEdit', { picked }, { merge: true });
            }
        }
        catch {
            setError('Unable to save this location. Try again.');
        }
        finally {
            setSaving(false);
        }
    };
    return <View style={s.screen}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
      <Text accessibilityRole="header" style={s.h1}>Pin your doorstep.</Text>
      <Text style={[s.muted, { marginTop: 8, marginBottom: 16 }]}>A clear address and a confirmed pin help your shop’s rider find you.</Text>
      <View style={{ height: 270, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
        <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ ...(initial ?? INITIAL_CAMERA), latitudeDelta: 0.01, longitudeDelta: 0.01 }} onPress={(event) => onPick(event.nativeEvent.coordinate)} accessibilityLabel="Delivery map. Tap or drag the pin to select your doorstep.">
          {marker && <Marker draggable coordinate={marker} onDragEnd={(event) => onPick(event.nativeEvent.coordinate)}/>}
        </MapView>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use my current location" disabled={locating} onPress={locate} style={{ position: 'absolute', right: 12, top: 12, width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" color={colors.primary}/></TouchableOpacity>
      </View>
      <Text style={[s.muted, { marginTop: 12 }]}>{locating ? 'Finding your location…' : resolving ? 'Finding the pin’s address…' : marker ? 'Drag the pin or tap the map for the exact spot.' : 'No delivery pin selected. Tap the map or use your current location.'}</Text>
      <View style={[s.card, { marginTop: 16 }]}><Text style={[s.body, { fontSize: 16, fontWeight: '700' }]}>Delivery address</Text><Text style={[s.muted, { marginTop: 8 }]}>{[params.fullAddress || resolved?.fullAddress || 'Add your house, street and area', params.city || resolved?.city].filter(Boolean).join(', ')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Edit written address</Text></TouchableOpacity></View>
      <Text style={[s.muted, { marginTop: 16 }]}>Make sure the pin matches your written address. You can edit either before continuing.</Text>
      {!!error && <View style={{ marginTop: 16 }}><Notice danger>{error}</Notice></View>}
    </ScrollView>
    <ActionDock><TouchableOpacity accessibilityRole="button" disabled={!marker || locating || resolving || saving} accessibilityState={{ disabled: !marker || locating || resolving || saving }} style={[s.btn, { justifyContent: 'center', opacity: !marker || locating || resolving || saving ? 0.5 : 1 }]} onPress={confirm}><Text style={s.btnText}>{saving ? 'Saving location…' : params.browsing ? 'Confirm location' : 'Confirm pin & return'}</Text></TouchableOpacity></ActionDock>
  </View>;
}
