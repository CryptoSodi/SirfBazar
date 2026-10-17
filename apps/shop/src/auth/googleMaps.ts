import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
export const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || (import.meta.env.DEV ? 'DEMO_MAP_ID' : '');

let configured = false;
const authenticationListeners = new Set<() => void>();

declare global {
  interface Window { gm_authFailure?: () => void }
}

export function onGoogleMapsAuthenticationFailure(listener: () => void) {
  authenticationListeners.add(listener);
  return () => { authenticationListeners.delete(listener); };
}

function configureGoogleMaps() {
  if (configured || !googleMapsApiKey) return;
  const previousFailureHandler = window.gm_authFailure;
  window.gm_authFailure = () => {
    previousFailureHandler?.();
    authenticationListeners.forEach(listener => listener());
  };
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
