import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { api } from './api';
import { withDeadline } from './customer-flow';

/**
 * GPS + reverse-geocoding helpers. Centralises the permission + lookup dance so
 * the address editor / map picker can turn coordinates into a human-readable
 * address. Reverse geocoding uses the OS geocoder — no API key required.
 */

export interface GeocodedAddress {
  fullAddress: string;
  street?: string;
  area?: string;
  city: string;
  province?: string;
}

export type DetectedLocation = GeocodedAddress & {
  latitude: number;
  longitude: number;
};

export class LocationPermissionError extends Error {
  constructor() {
    super('Location permission is off. Enable it in Settings to use your current location.');
    this.name = 'LocationPermissionError';
  }
}

/** Build a readable one-line address from an OS geocode result. */
function formatAddress(g?: Location.LocationGeocodedAddress): string {
  if (!g) return '';
  const line = [
    [g.streetNumber, g.street].filter(Boolean).join(' ').trim(),
    g.name && g.name !== g.street ? g.name : '',
    g.district ?? g.subregion ?? '',
    g.city ?? '',
    g.region ?? '',
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  // De-duplicate repeated segments (the OS often repeats city/region).
  return Array.from(new Set(line)).join(', ');
}

/** Reverse-geocode any coordinate pair into address parts (never throws). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodedAddress> {
  let geo: Location.LocationGeocodedAddress | undefined;
  try {
    const results = Platform.OS === 'web' ? [] : await withDeadline(
      Location.reverseGeocodeAsync({ latitude, longitude }), 5000, 'Address lookup timed out.');
    geo = results?.[0];
  } catch {
    /* geocoder can fail (offline / unsupported) — coordinates are still useful */
  }
  let coverage: any;
  if (!geo) {
    try { coverage = await withDeadline(api.post('/location/detect', { latitude, longitude }), 5000, 'Address lookup timed out.'); }
    catch { /* Keep coordinates; let the customer enter address text. */ }
  }
  return {
    fullAddress: formatAddress(geo),
    street: [geo?.streetNumber, geo?.street].filter(Boolean).join(' ').trim() || undefined,
    area: geo?.district ?? geo?.subregion ?? coverage?.area ?? undefined,
    city: geo?.city ?? coverage?.city ?? '',
    province: geo?.region ?? undefined,
  };
}

/**
 * Request permission, read the current GPS fix, and reverse-geocode it.
 * Throws LocationPermissionError if the user declined.
 */
export async function detectCurrentLocation(): Promise<DetectedLocation> {
  const { status } = await withDeadline(Location.requestForegroundPermissionsAsync(), 15000,
    'Location permission did not respond. Choose a point on the map instead.');
  if (status !== 'granted') throw new LocationPermissionError();

  const pos = await withDeadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    12000, 'Unable to detect your location. Choose a point on the map or a saved address.');
  const { latitude, longitude } = pos.coords;
  return { latitude, longitude, ...(await reverseGeocode(latitude, longitude)) };
}
