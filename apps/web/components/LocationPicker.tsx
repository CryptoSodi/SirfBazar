'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getStoredLocation } from '@/lib/api';
import { FALLBACK_LOCATION, useLocation } from '@/lib/location';
import type { PickedPoint } from './MapPicker';
import { LocationMap } from './LocationMap';
import { useModalFocus } from './useModalFocus';
import { ToastMessage } from './Toast';
import { AppIcon } from './AppIcon';

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { choose } = useLocation();
  const [initial] = useState(() => getStoredLocation() ?? FALLBACK_LOCATION);
  const [point, setPoint] = useState<PickedPoint>(initial);
  const [chosen, setChosen] = useState(initial.label !== FALLBACK_LOCATION.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogFocus = useModalFocus<HTMLDivElement>(true, onClose);
  const invalidateRequest = () => {
    requestId.current += 1;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };
  useEffect(() => () => invalidateRequest(), []);

  const pin = (next: PickedPoint) => {
    invalidateRequest();
    setBusy(false); setError(''); setPoint(next); setChosen(true);
  };

  const useGps = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Select a point on the map.'); return; }
    invalidateRequest();
    const current = requestId.current;
    setBusy(true); setError('');
    const fail = (message: string) => {
      if (current !== requestId.current) return;
      invalidateRequest(); setBusy(false); setError(message);
    };
    watchdog.current = setTimeout(() => fail('Location lookup timed out. Try again or select a point on the map.'), 20000);
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => { if (current === requestId.current) pin({ latitude: coords.latitude, longitude: coords.longitude }); },
        (cause) => fail(cause.code === 1 ? 'Location access was blocked. Allow it in your browser or select a point on the map.' : 'Unable to find your location. Try again or select a point on the map.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    } catch { fail('Unable to start location lookup. Select a point on the map.'); }
  };

  const confirm = async () => {
    if (!chosen || busy) return;
    invalidateRequest();
    const current = requestId.current;
    const selected = { latitude: point.latitude, longitude: point.longitude };
    setBusy(true); setError('');
    let label = `Pinned location (${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)})`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const detected = await Promise.race([
        api.post('/location/detect', selected),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2000); }),
      ]);
      if (detected?.serviceable && (detected.area || detected.city)) label = [detected.area, detected.city].filter(Boolean).join(', ');
    } catch { /* Exact coordinates remain usable when the area-name lookup fails. */ }
    finally { clearTimeout(timer); }
    if (current !== requestId.current) return;
    choose({ ...selected, label });
    setBusy(false); onClose();
  };

  if (typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div ref={dialogFocus.ref} role="dialog" aria-modal="true" aria-labelledby="location-picker-title" tabIndex={-1} onKeyDown={dialogFocus.onKeyDown} className="card sb-area-picker" onClick={(event) => event.stopPropagation()}>
      <div className="sb-area-picker-heading"><h2 id="location-picker-title" className="text-lg font-bold">Choose your location</h2><button type="button" className="btn-secondary" onClick={onClose}>Close</button></div>
      <p className="sb-area-picker-copy">Choose where to browse nearby shops. You’ll confirm your delivery address at checkout.</p>
      <button type="button" className="btn-primary w-full" onClick={useGps} disabled={busy}>{busy ? 'Updating location…' : <><AppIcon name="location" size={18} /> Use my current location</>}</button>
      <h3 className="sb-area-picker-map-title">Pick my area</h3>
      <p className="sb-area-picker-copy">Select a point or move the map until the pin is in the right place. You can also focus the map and use arrow keys.</p>
      <LocationMap point={point} onChange={pin} onError={setError} />
      <p className="sb-area-picker-coordinates" role="status">{chosen ? 'Selected' : 'Map centre'}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>
      {error && <ToastMessage>{error}</ToastMessage>}
      <button type="button" className="btn-primary w-full" disabled={!chosen || busy} onClick={() => void confirm()}>Confirm this location</button>
    </div>
  </div>, document.body);
}
