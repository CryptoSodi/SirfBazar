'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { FALLBACK_LOCATION, useLocation } from '@/lib/location';

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { choose } = useLocation();
  const [areas, setAreas] = useState<Array<{ city: string; area: string; latitude?: number; longitude?: number }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/location/nearby-areas?city=Lahore').then(setAreas).catch(() => setAreas([]));
  }, []);

  const useGps = () => {
    setBusy(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        let label = 'Current location';
        try {
          const d = await api.post('/location/detect', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (d?.area || d?.city) label = [d.area, d.city].filter(Boolean).join(', ');
        } catch {
          /* ignore */
        }
        choose({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label });
        setBusy(false);
        onClose();
      },
      () => {
        setBusy(false);
        alert('Location permission denied — pick an area below instead.');
      },
    );
  };

  const ui = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="card max-h-[80vh] w-full max-w-md overflow-y-auto p-5 sm:rounded-2xl rounded-b-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-bold">Choose your location</div>
        <p className="mb-4 text-sm text-stone-500">
          SirfBazar uses your location to show nearby stores and faster delivery options.
        </p>
        <button className="btn-primary w-full" onClick={useGps} disabled={busy}>
          {busy ? 'Detecting…' : '📍 Use my current location'}
        </button>
        <div className="my-4 text-center text-xs uppercase tracking-wide text-stone-400">or pick an area</div>
        <div className="space-y-2">
          {areas.map((a, i) => (
            <button
              key={i}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => {
                choose({
                  latitude: a.latitude ?? FALLBACK_LOCATION.latitude,
                  longitude: a.longitude ?? FALLBACK_LOCATION.longitude,
                  label: [a.area, a.city].filter(Boolean).join(', '),
                });
                onClose();
              }}
            >
              {[a.area, a.city].filter(Boolean).join(', ')}
            </button>
          ))}
          {areas.length === 0 && (
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
