import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

type Point = { latitude: number; longitude: number };
const DEFAULT: Point = { latitude: 31.5204, longitude: 74.3587 };

export default function ShopMapPicker({ initial, onConfirm, onClose }: {
  initial: Point | null;
  onConfirm: (point: Point) => void;
  onClose: () => void;
}) {
  const start = initial ?? DEFAULT;
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [point, setPoint] = useState<Point>(start);
  const [chosen, setChosen] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let active = true;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    import('leaflet').then((L) => {
      if (!active || !host.current) return;
      const instance = L.map(host.current).setView([start.latitude, start.longitude], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(instance);
      instance.on('moveend', () => {
        const center = instance.getCenter();
        setPoint({ latitude: center.lat, longitude: center.lng });
      });
      instance.on('dragend', () => setChosen(true));
      map.current = instance;
      window.setTimeout(() => instance.invalidateSize(), 0);
    }).catch(() => setError('The map could not load. Check your connection and try again.'));
    return () => { active = false; document.removeEventListener('keydown', onKeyDown); map.current?.remove(); map.current = null; };
  }, []);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser. Move the map instead.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        setPoint(next); setChosen(true); map.current?.setView([next.latitude, next.longitude], 17); setLocating(false);
      },
      () => { setError('Could not access your location. Move the map instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shop-map-title" className="flex h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[78vh] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4"><h2 id="shop-map-title" className="font-bold">Pin your shop entrance</h2><button type="button" className="ops-button" autoFocus onClick={onClose}>Close</button></div>
        <div className="relative min-h-0 flex-1"><div ref={host} className="h-full w-full" aria-label="Interactive map of shop location" /><span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 -translate-y-full text-3xl drop-shadow-md">📍</span><button type="button" onClick={locate} disabled={locating} className="ops-button absolute bottom-4 right-4 z-[1000] bg-white">{locating ? 'Locating…' : 'Use current location'}</button></div>
        <div className="space-y-3 border-t p-4"><p className="text-sm text-slate-600">Drag the map until the pin is on your shop entrance.</p><p className="text-xs text-slate-500">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="button" className="ops-button ops-button-primary w-full" disabled={!chosen} onClick={() => onConfirm(point)}>Use this location</button></div>
      </div>
    </div>
  );
}
