'use client';

import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import type { PickedPoint } from './MapPicker';
import { AppIcon } from './AppIcon';

/** The centre pin, displayed coordinates and submitted coordinates are one value. */
export function LocationMap({ point, onChange, onError }: {
  point: PickedPoint;
  onChange: (point: PickedPoint) => void;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const syncing = useRef(false);
  const latest = useRef({ point, onChange, onError });
  latest.current = { point, onChange, onError };
  useEffect(() => {
    let active = true;
    let resize: ReturnType<typeof setTimeout> | undefined;
    import('leaflet').then((L) => {
      if (!active || !host.current) return;
      const current = latest.current.point;
      const instance = L.map(host.current, { zoomControl: true, keyboard: true }).setView([current.latitude, current.longitude], 16);
      map.current = instance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(instance);
      instance.on('moveend', () => {
        if (!active || syncing.current) return;
        const center = instance.getCenter();
        latest.current.onChange({ latitude: center.lat, longitude: center.lng });
      });
      instance.on('click', (event: Leaflet.LeafletMouseEvent) => {
        instance.setView(event.latlng, instance.getZoom(), { animate: false });
        const center = instance.getCenter();
        latest.current.onChange({ latitude: center.lat, longitude: center.lng });
      });
      resize = setTimeout(() => {
        if (!active) return;
        syncing.current = true;
        try { instance.invalidateSize(); } finally { syncing.current = false; }
      }, 0);
    }).catch(() => { if (active) latest.current.onError('Unable to load the map. Check your connection and reopen the location picker.'); });
    return () => { active = false; clearTimeout(resize); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    const center = instance?.getCenter();
    if (instance && center && (Math.abs(center.lat - point.latitude) > 1e-9 || Math.abs(center.lng - point.longitude) > 1e-9)) {
      // Leaflet rounds the displayed centre to pixels. Rendering a GPS/saved
      // point must not feed that rounded centre back as a new user selection.
      syncing.current = true;
      try { instance.setView([point.latitude, point.longitude], instance.getZoom(), { animate: false }); }
      finally { syncing.current = false; }
    }
  }, [point.latitude, point.longitude]);
  return <div className="sb-location-map">
    <div ref={host} aria-label="Interactive location map. Use arrow keys to move the pin." className="sb-location-map-canvas" />
    <span aria-hidden="true" className="sb-location-map-pin"><AppIcon name="pin" size={36} /></span>
  </div>;
}
