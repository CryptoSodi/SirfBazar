'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as Leaflet from 'leaflet';
import type { PickedPoint } from './MapPicker';
import { useModalFocus } from './useModalFocus';

const DEFAULT = { latitude: 31.5204, longitude: 74.3587 };
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Key-free local map picker. The visible centre pin is the confirmed point. */
export function OpenMapPicker({ initial, onConfirm, onClose, returnFocusTo }: {
  initial?: PickedPoint | null;
  onConfirm: (point: PickedPoint) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const initialPoint = initial ?? DEFAULT;
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [point, setPoint] = useState<PickedPoint>(initialPoint);
  const [chosen, setChosen] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const focus = useModalFocus<HTMLDivElement>(true, onClose, returnFocusTo);

  useEffect(() => {
    let active = true;
    import('leaflet').then((L) => {
      if (!active || !host.current) return;
      const instance = L.map(host.current, { zoomControl: true }).setView([initialPoint.latitude, initialPoint.longitude], 16);
      L.tileLayer(TILES, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(instance);
      instance.on('moveend', () => {
        const center = instance.getCenter();
        setPoint({ latitude: center.lat, longitude: center.lng });
      });
      instance.on('dragend', () => setChosen(true));
      map.current = instance;
      window.setTimeout(() => instance.invalidateSize(), 0);
    }).catch(() => setError('Unable to load the map. Check your connection and try again.'));
    return () => { active = false; map.current?.remove(); map.current = null; };
  }, []);

  const useGps = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Move the map to choose a point.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        setPoint(next); setChosen(true); map.current?.setView([next.latitude, next.longitude], 17); setLocating(false);
      },
      () => { setError('Location access failed. Move the map to choose a point.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div ref={focus.ref} onKeyDown={focus.onKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="open-map-title" className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[80vh] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 p-4"><h2 id="open-map-title" className="font-bold">Choose a delivery location</h2><button type="button" className="btn-secondary" autoFocus onClick={onClose}>Close</button></div>
        <div className="relative min-h-0 flex-1"><div ref={host} aria-label="Interactive location map" className="h-full w-full" /><div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md">📍</div><button type="button" className="absolute bottom-4 right-4 z-[1000] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow" onClick={useGps} disabled={locating}>{locating ? 'Locating…' : 'Use current location'}</button></div>
        <div className="space-y-3 border-t border-stone-200 p-4"><p className="text-sm text-stone-600">Move the map until the pin is on your doorstep. Keyboard users can pan the focused map with arrow keys, then select its center.</p><p className="text-xs text-stone-500">Selected: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="button" className="btn-secondary w-full" onClick={() => { const center = map.current?.getCenter(); if (center) { setPoint({ latitude: center.lat, longitude: center.lng }); setChosen(true); } else setError('Map is still loading. Try again when it appears.'); }}>Select map center</button><button type="button" className="btn-primary w-full" disabled={!chosen} onClick={() => onConfirm(point)}>Confirm location</button></div>
      </div>
    </div>, document.body,
  );
}
