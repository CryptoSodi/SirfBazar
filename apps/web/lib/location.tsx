'use client';

import { useEffect, useState } from 'react';
import { api, getStoredLocation, storeLocation, SbLocation } from './api';

/** Default browsing location when GPS is denied/unavailable: Gulberg, Lahore. */
export const FALLBACK_LOCATION: SbLocation = {
  latitude: 31.5204,
  longitude: 74.3587,
  label: 'Lahore (Gulberg)',
};

/**
 * Frictionless location strategy (spec 9.4): stored choice → browser GPS with
 * one friendly prompt → city fallback. Browsing never blocks on location.
 */
export function useLocation() {
  const [location, setLocation] = useState<SbLocation | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) {
      setLocation(stored);
      setResolved(true);
      return;
    }
    // Start with the fallback so the home screen renders instantly…
    setLocation(FALLBACK_LOCATION);
    setResolved(true);

    // …then quietly upgrade to GPS if the user allows it.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc: SbLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            label: 'Current location',
          };
          try {
            const detected = await api.post('/location/detect', {
              latitude: loc.latitude,
              longitude: loc.longitude,
            });
            if (detected?.area || detected?.city) {
              loc.label = [detected.area, detected.city].filter(Boolean).join(', ');
            }
          } catch {
            /* keep generic label */
          }
          storeLocation(loc);
          setLocation(loc);
          window.dispatchEvent(new Event('sb:location'));
        },
        () => {
          storeLocation(FALLBACK_LOCATION);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
      );
    }

    const onChange = () => {
      const updated = getStoredLocation();
      if (updated) setLocation(updated);
    };
    window.addEventListener('sb:location', onChange);
    return () => window.removeEventListener('sb:location', onChange);
  }, []);

  const choose = (loc: SbLocation) => {
    storeLocation(loc);
    setLocation(loc);
    window.dispatchEvent(new Event('sb:location'));
  };

  return { location, resolved, choose };
}

export function locationQuery(loc: SbLocation | null): string {
  if (!loc) return '';
  return `latitude=${loc.latitude}&longitude=${loc.longitude}`;
}
