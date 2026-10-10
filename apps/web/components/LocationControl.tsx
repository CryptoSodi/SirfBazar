'use client';

import { useEffect, useRef, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import type { SbLocation } from '@/lib/api';
import { FALLBACK_LOCATION } from '@/lib/location';
import { GOOGLE_MAPS_API_KEY, hasMapsKey } from '@/lib/maps';
import { isUnnamedLocation, readableGeocodeResult } from '@/lib/location-label';
import { Icon } from './Icons';
import styles from './LocationControl.module.css';

type NamedPin = { latitude: number; longitude: number; label: string };

/** Display only. A geocoder response must never move the selected pin or delay saving it. */
function GoogleLocationName({ location, onResult }: {
  location: SbLocation;
  onResult: (pin: NamedPin | null) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'sb-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const result = useRef(onResult);
  result.current = onResult;
  useEffect(() => {
    if (!isLoaded || loadError) return;
    let active = true;
    const timeout = setTimeout(() => { active = false; result.current(null); }, 8000);
    const debounce = setTimeout(() => {
      try {
        new google.maps.Geocoder().geocode({ location: { lat: location.latitude, lng: location.longitude } })
          .then(({ results }) => {
            if (!active) return;
            clearTimeout(timeout);
            const label = readableGeocodeResult(results);
            result.current(label ? { latitude: location.latitude, longitude: location.longitude, label } : null);
          }).catch(() => { if (active) { clearTimeout(timeout); result.current(null); } });
      } catch { if (active) { clearTimeout(timeout); result.current(null); } }
    }, 500);
    return () => { active = false; clearTimeout(timeout); clearTimeout(debounce); };
  }, [isLoaded, loadError, location.latitude, location.longitude]);
  return null;
}

export function LocationControl({ location, onClick }: { location: SbLocation | null; onClick: () => void }) {
  const [namedPin, setNamedPin] = useState<NamedPin | null>(null);
  const unnamed = !!location && isUnnamedLocation(location.label);
  const resolved = unnamed && namedPin?.latitude === location?.latitude && namedPin?.longitude === location?.longitude ? namedPin : null;
  const label = resolved?.label || (unnamed ? 'Pinned location' : location?.label) || 'Choose your area';
  return <>
    {unnamed && hasMapsKey && <GoogleLocationName location={location!} onResult={setNamedPin} />}
    <button type="button" onClick={onClick} className="sb-site-location" title={label} aria-label={`${location?.label === FALLBACK_LOCATION.label ? 'Example area' : 'Shops near'} ${label}. Change location`}>
      <span className="sb-pin"><Icon name="pin" size={20} /></span>
      <span>
        {resolved ? <small className={styles.attribution} translate="no">Google Maps</small> : <small>{location?.label === FALLBACK_LOCATION.label ? 'Example area' : 'Shops near'}</small>}
        <strong>{label} <Icon name="down" size={16} /></strong>
      </span>
    </button>
  </>;
}
