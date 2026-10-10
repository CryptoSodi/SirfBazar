'use client';

import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useEffect, useRef, useState } from 'react';
import type { PickedPoint } from './MapPicker';
import { AppIcon } from './AppIcon';
import { GOOGLE_MAPS_API_KEY, hasMapsKey } from '@/lib/maps';

function GoogleLocationMap({ point, onChange }: {
  point: PickedPoint;
  onChange: (point: PickedPoint) => void;
}) {
  const map = useRef<google.maps.Map | null>(null);
  const syncing = useRef(false);
  const [center, setCenter] = useState({ lat: point.latitude, lng: point.longitude });
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'sb-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const latest = useRef({ point, onChange });
  latest.current = { point, onChange };

  const syncCenter = () => {
    const current = map.current?.getCenter();
    if (!current || syncing.current) return;
    const next = { lat: current.lat(), lng: current.lng() };
    setCenter(previous => previous.lat === next.lat && previous.lng === next.lng ? previous : next);
    latest.current.onChange({ latitude: next.lat, longitude: next.lng });
  };

  useEffect(() => {
    const next = { lat: point.latitude, lng: point.longitude };
    // Keep the controlled centre current even before Google Maps has finished
    // loading. Otherwise a GPS result can arrive first and the map's initial
    // idle event will report the stale centre back to the picker.
    setCenter(previous => previous.lat === next.lat && previous.lng === next.lng ? previous : next);
    const instance = map.current;
    const current = instance?.getCenter();
    if (instance && current && (Math.abs(current.lat() - next.lat) > 1e-9 || Math.abs(current.lng() - next.lng) > 1e-9)) {
      syncing.current = true;
      try {
        instance.setCenter(next);
      } finally { syncing.current = false; }
    }
  }, [point.latitude, point.longitude]);

  return <>
    {loadError ? <div className="sb-location-map-unavailable" role="alert">Google Maps could not load. Check your connection and try again.</div> : isLoaded ? <GoogleMap
      mapContainerClassName="sb-location-map-canvas"
      center={center}
      zoom={16}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy', keyboardShortcuts: true }}
      onLoad={instance => { map.current = instance; instance.addListener('idle', syncCenter); }}
      onClick={event => {
        if (!event.latLng) return;
        const next = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        map.current?.setCenter(next);
        setCenter(next);
        latest.current.onChange({ latitude: next.lat, longitude: next.lng });
      }}
    /> : <div className="sb-location-map-unavailable" role="status">Loading Google Maps…</div>}
    {!loadError && isLoaded && <span aria-hidden="true" className="sb-location-map-pin"><AppIcon name="pin" size={36} /></span>}
  </>;
}

/** The selected point stays at Google's map centre below the fixed pin. */
export function LocationMap({ point, onChange }: {
  point: PickedPoint;
  onChange: (point: PickedPoint) => void;
}) {
  return <div className="sb-location-map">
    {!hasMapsKey ? <div className="sb-location-map-unavailable" role="status">Google Maps is not configured. You can still use your current location or enter an area name.</div> : <GoogleLocationMap point={point} onChange={onChange} />}
  </div>;
}
