import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { GeocodedAddress, reverseGeocode } from '../lib/location';
import { useTheme } from '../lib/theme';

const FALLBACK = { latitude: 31.5204, longitude: 74.3587 }; // Lahore (Gulberg)

/** Foodpanda-style map picker: drag the pin (or tap the map) to set the exact
 *  drop-off point; the address resolves as you move it. Returns the chosen
 *  coordinates + address to the address editor. */
export default function MapPickerScreen() {
  const { colors, s } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MapPicker'>>();
  const params = route.params ?? {};
  const mapRef = useRef<MapView>(null);

  const initial = {
    latitude: params.latitude ?? FALLBACK.latitude,
    longitude: params.longitude ?? FALLBACK.longitude,
  };
  const [marker, setMarker] = useState(initial);
  const [resolved, setResolved] = useState<GeocodedAddress | null>(null);
  const [resolving, setResolving] = useState(false);

  const resolve = async (latitude: number, longitude: number) => {
    setResolving(true);
    try {
      setResolved(await reverseGeocode(latitude, longitude));
    } finally {
      setResolving(false);
    }
  };

  // On mount: if no starting point was passed, try to centre on the GPS fix.
  useEffect(() => {
    (async () => {
      if (params.latitude == null) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setMarker(c);
            mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
            resolve(c.latitude, c.longitude);
            return;
          }
        } catch {
          /* fall back to the default centre */
        }
      }
      resolve(initial.latitude, initial.longitude);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = (c: { latitude: number; longitude: number }) => {
    setMarker(c);
    resolve(c.latitude, c.longitude);
  };

  const recenterToGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMarker(c);
      mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
      resolve(c.latitude, c.longitude);
    } catch {
      /* ignore */
    }
  };

  const confirm = () => {
    navigation.navigate('AddressEdit', {
      picked: {
        latitude: marker.latitude,
        longitude: marker.longitude,
        fullAddress: resolved?.fullAddress,
        area: resolved?.area,
        city: resolved?.city,
        province: resolved?.province,
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initial, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onPress={(e) => onPick(e.nativeEvent.coordinate)}
        showsUserLocation
      >
        <Marker draggable coordinate={marker} onDragEnd={(e) => onPick(e.nativeEvent.coordinate)} />
      </MapView>

      {/* Recenter on my GPS */}
      <TouchableOpacity
        onPress={recenterToGps}
        style={[styles.fab, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={{ fontSize: 18 }}>🎯</Text>
      </TouchableOpacity>

      {/* Confirm sheet */}
      <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} edges={['bottom']}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.muted, { marginBottom: 2 }]}>Drag the pin or tap the map for the exact spot</Text>
          <Text style={[s.body, { fontWeight: '700' }]} numberOfLines={2}>
            {resolving
              ? 'Finding address…'
              : resolved?.fullAddress || `${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}`}
          </Text>
          <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={confirm}>
            <Text style={s.btnText}>Confirm location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sheet: {
    margin: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
