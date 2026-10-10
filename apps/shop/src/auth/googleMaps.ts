import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
export const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || (import.meta.env.DEV ? 'DEMO_MAP_ID' : '');

let configured = false;

function configureGoogleMaps() {
  if (configured || !googleMapsApiKey) return;
  setOptions({ key: googleMapsApiKey, v: 'weekly', language: 'en', region: 'PK' });
  configured = true;
}

export function loadGoogleMaps() {
  configureGoogleMaps();
  return importLibrary('maps');
}

export function loadGoogleMapsMarkers() {
  configureGoogleMaps();
  return importLibrary('marker');
}
