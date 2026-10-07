'use client';

import { useEffect, useState } from 'react';
import { getStoredLocation, storeLocation, SbLocation } from './api';

/** Default browsing location when GPS is denied/unavailable: Gulberg, Lahore. */
export const FALLBACK_LOCATION: SbLocation = {
  latitude: 31.5204,
  longitude: 74.3587,
  label: 'Gulberg, Lahore (example)',
};

/**
 * Browse with a stored choice or a labelled example area. GPS is requested
 * only when the person explicitly chooses it in the location picker.
 */
export function useLocation() {
  const [location, setLocation] = useState<SbLocation | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = getStoredLocation();
    setLocation(stored || FALLBACK_LOCATION);
    setResolved(true);

    const onChange = () => {
      const updated = getStoredLocation();
      setLocation(updated || FALLBACK_LOCATION);
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
