import { ReferenceIcon as UiIcon } from './ReferenceIcon';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { googleMapsApiKey as apiKey, googleMapsMapId as mapId, loadGoogleMaps } from '../auth/googleMaps';
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
  const map = useRef<google.maps.Map | null>(null);
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
    if (!apiKey) {
      setError('Google Maps is not configured for this site. Enter the shop coordinates in the setup form instead.');
      return () => { active = false; };
    }
    loadGoogleMaps().then(({ Map }) => {
      if (!active || !host.current) return;
      const instance = new Map(host.current, {
        center: { lat: start.latitude, lng: start.longitude },
        zoom: initial ? 18 : 13,
        mapId: mapId || undefined,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        keyboardShortcuts: true,
      });
      instance.addListener('idle', () => {
        if (!active) return;
        const center = instance.getCenter();
        if (center) setPoint({ latitude: center.lat(), longitude: center.lng() });
      });
      instance.addListener('dragend', () => { if (active) setChosen(true); });
      instance.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (!event.latLng || !active) return;
        instance.setCenter(event.latLng);
        setPoint({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        setChosen(true);
        setError('');
      });
      map.current = instance;
      setMapReady(true);
      resizeTimer = window.setTimeout(() => { if (active) google.maps.event.trigger(instance, 'resize'); }, 0);
    }).catch(() => { if (active) setError('Google Maps could not load. Check the map key and try again.'); });
    return () => { active = false; window.clearTimeout(resizeTimer); map.current = null; };
  }, [mapAttempt]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser. Move the map and select its center instead.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        setPoint(next); setChosen(true); map.current?.panTo({ lat: next.latitude, lng: next.longitude }); map.current?.setZoom(17); setLocating(false);
      },
      () => { setError('Could not access your location. Move the map and select its center instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const selectCenter = () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    if (!center) return;
    setPoint({ latitude: center.lat(), longitude: center.lng() });
    setChosen(true);
    setError('');
  };

  return createPortal(
    <dialog ref={dialog} className="shop-map-dialog" aria-labelledby="shop-map-title" onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}>
      <div className="shop-map-panel">
        <div className="shop-map-heading"><h2 id="shop-map-title">Pin your shop entrance</h2><button type="button" data-map-close className="ops-button" onClick={() => closeRef.current()}>Close</button></div>
        <div className="shop-map-viewport"><div ref={host} className="shop-map-canvas" role="application" aria-label="Google map for choosing the shop entrance" />{mapReady && <span aria-hidden="true" className="shop-map-pin"><UiIcon name="pin" style={{ width: 36, height: 36 }} /></span>}{!mapReady && !error && <p className="shop-map-loading" role="status">Loading Google Maps…</p>}{mapReady && <button type="button" onClick={locate} disabled={locating} className="ops-button shop-map-locate">{locating ? 'Locating…' : 'Use current location'}</button>}</div>
        <div className="shop-map-actions"><p>Move the Google map until the pin is on your shop entrance. You can also select a point on the map or use your current location.</p><button type="button" className="ops-button" onClick={selectCenter} disabled={!mapReady}>Select map center</button><p className="shop-map-coordinates">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>{error && <p role="alert">{error} <button type="button" className="ops-button" onClick={() => { setError(''); setMapAttempt(value => value + 1) }}>Retry Google Maps</button></p>}<button type="button" className="ops-button ops-button-primary" disabled={!chosen || !mapReady} onClick={() => onConfirm(point)}>Use this location</button></div>
      </div>
    </dialog>, document.body,
  );
}
