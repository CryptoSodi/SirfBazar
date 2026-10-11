'use client';

import { useEffect, useState } from 'react';
import { getStoredLocation, storeLocation, SbLocation } from './api';

/**
 * Nearby discovery stays unfiltered until the customer explicitly confirms a
 * delivery location. GPS is requested only from the location picker action.
 */
export function useLocation() {
  const [location, setLocation] = useState<SbLocation | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = getStoredLocation();
    setLocation(stored);
    setResolved(true);

    const onChange = () => {
      const updated = getStoredLocation();
      setLocation(updated);
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
