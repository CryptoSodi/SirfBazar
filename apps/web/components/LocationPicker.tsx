'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStoredLocation } from '@/lib/api';
import { useLocation } from '@/lib/location';
import type { PickedPoint } from './MapPicker';
import { LocationMap } from './LocationMap';
import { useModalFocus } from './useModalFocus';
import { ToastMessage, useToast } from './Toast';
import { AppIcon } from './AppIcon';
import { isUnnamedLocation, manualLocationLabel } from '@/lib/location-label';

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { choose } = useLocation();
  const { toast, dismiss } = useToast();
  const [initial] = useState(() => getStoredLocation());
  const [point, setPoint] = useState<PickedPoint>(initial ?? { latitude: 30.3753, longitude: 69.3451 });
  const [areaName, setAreaName] = useState(() => initial && !isUnnamedLocation(initial.label) ? initial.label : '');
  const [chosen, setChosen] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>(
    typeof navigator !== 'undefined' && navigator.geolocation ? 'unknown' : 'denied',
  );
  const requestId = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogFocus = useModalFocus<HTMLDivElement>(true, onClose);
  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let permission: PermissionStatus | null = null;
    let active = true;
    void navigator.permissions.query({ name: 'geolocation' }).then(status => {
      if (!active) return;
      permission = status;
      setGpsPermission(status.state);
      status.onchange = () => setGpsPermission(status.state);
    }).catch(() => undefined);
    return () => { active = false; if (permission) permission.onchange = null; };
  }, []);
  const invalidateRequest = () => {
    requestId.current += 1;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };
  useEffect(() => () => invalidateRequest(), []);

  const pin = (next: PickedPoint) => {
    invalidateRequest();
    if (Math.abs(next.latitude - point.latitude) > 1e-7 || Math.abs(next.longitude - point.longitude) > 1e-7) setAreaName('');
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

  const confirm = () => {
    if (!chosen || busy) return;
    invalidateRequest();
    const selected = { latitude: point.latitude, longitude: point.longitude };
    // /location/detect describes a serving shop's area, not this pin's locality.
    // Save the exact selection synchronously: map/viewport events and network
    // delays must not silently cancel a confirmation or keep the old label.
    try {
      choose({ ...selected, label: manualLocationLabel(areaName) || 'Pinned location' });
      if (error) dismiss(error, false);
      setError('');
      toast('Location updated. Nearby shops will refresh for this pin.');
      onClose();
    } catch {
      setError('Unable to save this location. Allow site storage in your browser and try again.');
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div ref={dialogFocus.ref} role="dialog" aria-modal="true" aria-labelledby="location-picker-title" tabIndex={-1} onKeyDown={dialogFocus.onKeyDown} className="card sb-area-picker" onClick={(event) => event.stopPropagation()}>
      <div className="sb-area-picker-heading"><h2 id="location-picker-title" className="text-lg font-bold">Choose your location</h2><button type="button" className="btn-secondary" onClick={onClose}>Close</button></div>
      <div className="sb-area-picker-body">
      <p className="sb-area-picker-copy">We use your delivery area to show only shops that can serve it. Your coordinates are stored in this browser after you confirm; checkout will ask for your delivery address separately.</p>
      <button type="button" className="btn-primary w-full" onClick={useGps} disabled={busy}>{busy ? 'Updating location…' : <><AppIcon name="location" size={18} /> Use my current location</>}</button>
      {gpsPermission === 'denied' && <p role="status" className="sb-area-picker-copy">Browser location access is blocked or unavailable. Allow it in site settings, or choose a point on the map below.</p>}
      <h3 className="sb-area-picker-map-title">Pick my area</h3>
      <p className="sb-area-picker-copy">Select a point or move the map until the pin is in the right place. You can also focus the map and use arrow keys.</p>
      <LocationMap point={point} initialZoom={initial ? 16 : 5} onChange={pin} onError={setError} />
      <label htmlFor="area-address-name" className="sb-area-picker-map-title block">Area or address name <span className="font-normal">(optional)</span></label>
      <input id="area-address-name" className="input w-full" value={areaName} maxLength={160} onChange={event => setAreaName(event.target.value)} placeholder="e.g. Plot 72, street, neighbourhood" aria-describedby="area-address-name-hint" autoComplete="off" style={{ fontSize: 16 }} />
      <p id="area-address-name-hint" className="sb-area-picker-copy">Add your house or plot name for the header. Otherwise, a map address is shown when available. Moving the pin clears this name.</p>
      {error && <ToastMessage>{error}</ToastMessage>}
      </div>
      <div className="sb-area-picker-footer" data-toast-clearance><p className="sb-area-picker-coordinates" role="status">{chosen ? 'Selected' : 'Map centre'}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p><button type="button" className="btn-primary w-full" disabled={!chosen || busy} onClick={confirm}>Confirm this location</button></div>
    </div>
  </div>, document.body);
}
