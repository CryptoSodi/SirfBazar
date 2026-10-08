import { ReferenceIcon as UiIcon } from './ReferenceIcon';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as Leaflet from 'leaflet';
import './ShopMapPicker.css';

type Point = { latitude: number; longitude: number };
const DEFAULT: Point = { latitude: 31.5204, longitude: 74.3587 };

export default function ShopMapPicker({ initial, onConfirm, onClose, returnFocusTo }: {
  initial: Point | null;
  onConfirm: (point: Point) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const start = initial ?? DEFAULT;
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [point, setPoint] = useState<Point>(start);
  const [chosen, setChosen] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-map-close]')?.focus();
    return () => {
      if (element?.open) element.close();
      const target = returnFocusTo?.isConnected ? returnFocusTo : previous;
      if (target?.isConnected) target.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let resizeTimer: number | undefined;
    setMapReady(false);
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
      setMapReady(true);
      resizeTimer = window.setTimeout(() => { if (active) instance.invalidateSize(); }, 0);
    }).catch(() => { if (active) setError('Map could not load. Retry the map or enter coordinates in the setup form.'); });
    return () => { active = false; window.clearTimeout(resizeTimer); map.current?.remove(); map.current = null; };
  }, [mapAttempt]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser. Move the map and select its center instead.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        setPoint(next); setChosen(true); map.current?.setView([next.latitude, next.longitude], 17); setLocating(false);
      },
      () => { setError('Could not access your location. Move the map and select its center instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const selectCenter = () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    setPoint({ latitude: center.lat, longitude: center.lng });
    setChosen(true);
    setError('');
  };

  return createPortal(
    <dialog ref={dialog} className="shop-map-dialog" aria-labelledby="shop-map-title" onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}>
      <div className="shop-map-panel">
        <div className="shop-map-heading"><h2 id="shop-map-title">Pin your shop entrance</h2><button type="button" data-map-close className="ops-button" onClick={() => closeRef.current()}>Close</button></div>
        <div className="shop-map-viewport"><div ref={host} className="shop-map-canvas" tabIndex={0} aria-label="Interactive map of shop location" /><span aria-hidden="true" className="shop-map-pin"><UiIcon name="pin" style={{ width: 36, height: 36 }} /></span>{!mapReady && !error && <p className="shop-map-loading" role="status">Loading map…</p>}<button type="button" onClick={locate} disabled={locating} className="ops-button shop-map-locate">{locating ? 'Locating…' : 'Use current location'}</button></div>
        <div className="shop-map-actions"><p>Move the map until the pin is on your shop entrance. Keyboard users can pan the focused map with arrow keys, then select its center.</p><button type="button" className="ops-button" onClick={selectCenter} disabled={!mapReady}>Select map center</button><p className="shop-map-coordinates">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>{error && <p role="alert">{error} <button type="button" className="ops-button" onClick={() => { setError(''); setMapAttempt(value => value + 1) }}>Retry map</button></p>}<button type="button" className="ops-button ops-button-primary" disabled={!chosen} onClick={() => onConfirm(point)}>Use this location</button></div>
      </div>
    </dialog>, document.body,
  );
}
