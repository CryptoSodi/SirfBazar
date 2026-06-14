import * as Location from 'expo-location';

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
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    geo = results?.[0];
  } catch {
    /* geocoder can fail (offline / unsupported) — coordinates are still useful */
  }
  return {
    fullAddress: formatAddress(geo),
    street: [geo?.streetNumber, geo?.street].filter(Boolean).join(' ').trim() || undefined,
    area: geo?.district ?? geo?.subregion ?? undefined,
    city: geo?.city ?? geo?.region ?? 'Lahore',
    province: geo?.region ?? undefined,
  };
}

/**
 * Request permission, read the current GPS fix, and reverse-geocode it.
 * Throws LocationPermissionError if the user declined.
 */
export async function detectCurrentLocation(): Promise<DetectedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationPermissionError();

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const { latitude, longitude } = pos.coords;
  return { latitude, longitude, ...(await reverseGeocode(latitude, longitude)) };
}
