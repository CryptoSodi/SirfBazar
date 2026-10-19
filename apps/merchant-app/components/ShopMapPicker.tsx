import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { AppIcon } from './AppIcon';
import { colors, s } from '../lib/theme';
import { isShopPoint, parseShopPoint, ShopPoint } from '../lib/shop-location';

// Camera only: it never becomes a shop pin without an explicit selection.
const INITIAL_CAMERA = { latitude: 31.5204, longitude: 74.3587 };

export default function ShopMapPicker({ initial, onConfirm, onClose }: {
  initial: ShopPoint | null; onConfirm: (point: ShopPoint) => void; onClose: () => void;
}) {
  const map = useRef<MapView>(null);
  const generation = useRef(0);
  const [point, setPoint] = useState<ShopPoint | null>(isShopPoint(initial) ? initial : null);
  const [locating, setLocating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : '');
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : '');
  const configured = Platform.OS !== 'android' || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim());

  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!configured || loaded) return;
    const timer = setTimeout(() => setError('Map tiles did not load. Check your connection or enter coordinates.'), 20000);
    return () => clearTimeout(timer);
  }, [configured, loaded, attempt]);

  const pick = (next: ShopPoint) => {
    if (!isShopPoint(next)) return;
    generation.current++;
    setLocating(false);
    setPoint(next);
    setLatitude(String(next.latitude)); setLongitude(String(next.longitude));
    setError('');
  };
  const locate = async () => {
    if (locating) return;
    const request = ++generation.current;
    setLocating(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Location permission was denied. Select a pin manually.');
      if (request !== generation.current) return;
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on device location, or select a pin manually.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location timed out. Try again or select a pin manually.')), 15000); }),
      ]);
      if (request !== generation.current) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!isShopPoint(next)) throw new Error('The device returned an invalid location. Select a pin manually.');
      pick(next);
      map.current?.animateToRegion({ ...next, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 300);
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Could not find your location. Select a pin manually.');
    } finally {
      clearTimeout(timer);
      if (request === generation.current) setLocating(false);
    }
  };
  const selectCoordinates = () => {
    const next = parseShopPoint(latitude, longitude);
    if (!next) { setError('Enter latitude from -90 to 90 and longitude from -180 to 180.'); return; }
    pick(next);
    map.current?.animateToRegion({ ...next, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 300);
  };
  const editCoordinate = (value: string, setValue: (value: string) => void) => {
    generation.current++; setLocating(false); setPoint(null); setValue(value);
  };

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[s.h1, { flex: 1 }]}>Shop entrance</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close map without saving" onPress={onClose} style={styles.iconButton}><AppIcon name="close" /></TouchableOpacity>
      </View>
      <View style={styles.map}>
        {configured ? <MapView key={attempt} ref={map} style={StyleSheet.absoluteFill} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{ ...(point ?? INITIAL_CAMERA), latitudeDelta: point ? 0.005 : 0.1, longitudeDelta: point ? 0.005 : 0.1 }}
          onMapLoaded={() => { setLoaded(true); setError(''); }} onPress={event => pick(event.nativeEvent.coordinate)}
          accessibilityLabel="Shop location map. Tap to select the entrance pin.">
          {point && <Marker draggable coordinate={point} title="Shop entrance" onDragEnd={event => pick(event.nativeEvent.coordinate)} />}
        </MapView> : <Text style={[s.muted, { padding: 20 }]}>Maps is not configured in this build. Use current location or enter coordinates.</Text>}
        {configured && !loaded && !error && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={s.body}>Loading map...</Text></View>}
      </View>
      <ScrollView style={{ flexGrow: 0, maxHeight: '60%' }} contentContainerStyle={styles.footer} keyboardShouldPersistTaps="handled">
        <Text style={s.body}>{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : 'No shop pin selected'}</Text>
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
        {!!error && configured && !loaded && <TouchableOpacity accessibilityRole="button" onPress={() => { setError(''); setAttempt(value => value + 1); }} style={s.btnGhost}><Text style={s.btnGhostText}>Retry map</Text></TouchableOpacity>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity accessibilityRole="button" disabled={locating} accessibilityState={{ disabled: locating }} onPress={() => void locate()} style={[s.btnGhost, styles.control]}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="location" color={colors.primary} size={18} />}<Text style={s.btnGhostText}>{locating ? 'Locating...' : 'Use current location'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: manual }} onPress={() => setManual(value => !value)} style={[s.btnGhost, styles.control]}><Text style={s.btnGhostText}>Coordinates</Text></TouchableOpacity>
        </View>
        {manual && <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput accessibilityLabel="Shop latitude" placeholder="Latitude" value={latitude} onChangeText={value => editCoordinate(value, setLatitude)} keyboardType="numbers-and-punctuation" style={[s.input, { flex: 1 }]} />
            <TextInput accessibilityLabel="Shop longitude" placeholder="Longitude" value={longitude} onChangeText={value => editCoordinate(value, setLongitude)} keyboardType="numbers-and-punctuation" style={[s.input, { flex: 1 }]} />
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={selectCoordinates} style={s.btnGhost}><Text style={s.btnGhostText}>Select coordinates</Text></TouchableOpacity>
        </View>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !point || locating }} disabled={!point || locating} onPress={() => { if (point) onConfirm(point); }} style={[s.btn, { minHeight: 48, justifyContent: 'center', opacity: !point || locating ? 0.5 : 1 }]}><Text style={s.btnText}>Confirm pin</Text></TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1, minHeight: 160, backgroundColor: colors.border },
  loading: { alignSelf: 'center', marginTop: 20, backgroundColor: colors.card, padding: 12, borderRadius: 8, gap: 8 },
  footer: { padding: 16, gap: 10, backgroundColor: colors.card },
  control: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
