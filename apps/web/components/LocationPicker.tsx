'use client';

import { ToastMessage } from '@/components/Toast';
import { AppIcon } from './AppIcon';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { FALLBACK_LOCATION, useLocation } from '@/lib/location';
import { useModalFocus } from './useModalFocus';

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { choose } = useLocation();
  const [areas, setAreas] = useState<Array<{ city: string; area: string; latitude?: number; longitude?: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogFocus = useModalFocus<HTMLDivElement>(true, onClose);

  useEffect(() => {
    api.get('/location/nearby-areas?city=Lahore').then(setAreas).catch(() => setAreas([]));
  }, []);

  useEffect(() => () => {
    requestId.current += 1;
    if (watchdog.current) clearTimeout(watchdog.current);
  }, []);

  const useGps = () => {
    if (!navigator.geolocation) {
      setError('Location is unavailable in this browser. Choose an area below.');
      return;
    }
    setError('');
    setBusy(true);
    const currentRequest = ++requestId.current;
    const clearWatchdog = () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
    };
    const fail = (message: string) => {
      if (currentRequest !== requestId.current) return;
      requestId.current += 1;
      clearWatchdog();
      setBusy(false);
      setError(message);
    };

    // Browser timeouts can exclude time spent waiting for permission or a provider.
    watchdog.current = setTimeout(() => {
      fail('Location lookup timed out. Check Wi-Fi and try again.');
    }, 20000);

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (currentRequest !== requestId.current) return;
          let label = 'Current location';
          let lookupTimeout: ReturnType<typeof setTimeout> | null = null;
          try {
            const d = await Promise.race([
              api.post('/location/detect', {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
              new Promise<null>((resolve) => {
                lookupTimeout = setTimeout(() => resolve(null), 2000);
              }),
            ]);
            if (d?.serviceable && (d.area || d.city)) label = [d.area, d.city].filter(Boolean).join(', ');
          } catch {
            // Coordinates remain useful even when an area name is unavailable.
          } finally {
            if (lookupTimeout) clearTimeout(lookupTimeout);
          }
          if (currentRequest !== requestId.current) return;
          requestId.current += 1;
          clearWatchdog();
          choose({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label });
          setBusy(false);
          onClose();
        },
        (geoError) => {
          if (geoError.code === 1) {
            fail('Location access was blocked. Allow it in your browser and try again.');
          } else if (geoError.code === 3) {
            fail('Location lookup timed out. Check Wi-Fi and try again.');
          } else {
            fail('Unable to find your location. Check Wi-Fi and try again.');
          }
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
      );
    } catch {
      fail('Unable to start location lookup. Try again.');
    }
  };

  const ui = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={dialogFocus.ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        tabIndex={-1}
        onKeyDown={dialogFocus.onKeyDown}
        className="card max-h-[80vh] w-full max-w-md overflow-y-auto p-5 sm:rounded-2xl rounded-b-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="location-picker-title" className="mb-1 text-lg font-bold">Choose your location</h2>
        <p className="mb-4 text-sm text-stone-500">
          SirfBazar uses your location to show nearby stores and faster delivery options.
        </p>
        <button className="btn-primary w-full" onClick={useGps} disabled={busy}>
          {busy ? 'Detecting…' : <><AppIcon name="location" size={18} /> Use my current location</>}
        </button>
        {error && <ToastMessage>{error}</ToastMessage>}
        <div className="my-4 text-center text-xs uppercase tracking-wide text-stone-400">or pick an area</div>
        <div className="space-y-2">
          {areas.filter((a) => a.latitude != null && a.longitude != null).map((a, i) => (
            <button
              key={i}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => {
                choose({
                  latitude: a.latitude!,
                  longitude: a.longitude!,
                  label: [a.area, a.city].filter(Boolean).join(', '),
                });
                onClose();
              }}
            >
              {[a.area, a.city].filter(Boolean).join(', ')}
            </button>
          ))}
          {!areas.some((a) => a.latitude != null && a.longitude != null) && (
            <button
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-left text-sm hover:border-emerald-400"
              onClick={() => {
                choose(FALLBACK_LOCATION);
                onClose();
              }}
            >
              {FALLBACK_LOCATION.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render outside the (backdrop-blurred) header so `fixed` is viewport-relative.
  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}
