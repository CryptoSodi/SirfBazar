'use client';

import { ToastMessage } from '@/components/Toast';
import { AppIcon } from './AppIcon';
import { AppIcon as UiIcon } from './AppIcon';


import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GOOGLE_MAPS_API_KEY } from '@/lib/maps';
import { useModalFocus } from './useModalFocus';

const FALLBACK = { lat: 31.5204, lng: 74.3587 }; // Gulberg, Lahore
const GPS_OPTS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

export interface PickedPoint {
  latitude: number;
  longitude: number;
}

/** Map picker with a fixed centre pin: pan/zoom the map under the pin (Uber /
 *  Foodpanda style) — the selected point is always the map centre, so placing it
 *  precisely is easy on both touch and desktop. */
export function MapPicker({
  initial,
  onConfirm,
  onClose,
  returnFocusTo,
}: {
  initial?: PickedPoint | null;
  onConfirm: (p: PickedPoint) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'sb-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [center, setCenter] = useState(
    initial ? { lat: initial.latitude, lng: initial.longitude } : FALLBACK,
  );
  const [locating, setLocating] = useState(false);
  const [chosen, setChosen] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const focus = useModalFocus<HTMLDivElement>(true, onClose, returnFocusTo);

  // Keep `center` in sync with wherever the user panned the map to.
  const syncCenter = () => {
    const c = mapRef.current?.getCenter();
    if (c) setCenter((current) => current.lat === c.lat() && current.lng === c.lng() ? current : { lat: c.lat(), lng: c.lng() });
  };

  const recenterToGps = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCenter(c);
        setChosen(true);
        mapRef.current?.panTo(c);
        mapRef.current?.setZoom(17);
        setLocating(false);
      },
      () => { setError('Location access failed. Move the map or use the map center controls.'); setLocating(false); },
      GPS_OPTS,
    );
  };

  const ui = (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50" onClick={onClose}>
      <div
        ref={focus.ref}
        role="dialog" aria-modal="true" aria-labelledby="google-map-title" tabIndex={-1} onKeyDown={focus.onKeyDown}
        className="mt-auto flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:m-auto sm:h-[80vh] sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <h3 id="google-map-title" className="font-bold">Pin your exact location</h3>
          <button type="button" className="text-sm text-stone-500" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="relative flex-1">
          {!GOOGLE_MAPS_API_KEY ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-stone-600" role="alert">
              Google Maps is not configured for this site. Use your current location or enter the address details manually.
            </div>
          ) : loadError ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-red-600">
              Couldn’t load the map. Check that the Google Maps key allows this site.
            </div>
          ) : isLoaded ? (
            <>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={center}
                zoom={17}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  clickableIcons: false,
                  gestureHandling: 'greedy',
                }}
                onLoad={(map) => {
                  mapRef.current = map;
                  map.addListener('idle', syncCenter);
                }}
                onDragEnd={() => { syncCenter(); setChosen(true); }}
                onClick={(event) => { if (event.latLng) { const next = { lat: event.latLng.lat(), lng: event.latLng.lng() }; mapRef.current?.setCenter(next); setCenter(next); setChosen(true); } }}
              />
              {/* Fixed centre pin — its tip points at the map centre. */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md">
                <UiIcon name="pin" size={36} />
              </div>
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" />

            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-stone-500">Loading map…</div>
          )}
          <button
            type="button"
            aria-label="Use my current location"
            onClick={recenterToGps}
            disabled={locating}
            className="absolute bottom-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white text-lg shadow-lg disabled:opacity-60"
            title="Use my current location"
          >
            {locating ? '…' : <AppIcon name="location" size={20} />}
          </button>
        </div>

        <div className="border-t border-stone-200 p-4">
          <p className="mb-2 text-xs text-stone-500">Move the map so the pin sits on your doorstep. Use the map keyboard controls, then select its center.</p>
          {error && <ToastMessage>{error}</ToastMessage>}
          <button type="button" className="btn-secondary mb-2 w-full" onClick={() => { syncCenter(); setChosen(true); }}>Select map center</button>
          <button
            className="btn-primary w-full"
            disabled={!chosen || locating}
            onClick={() => { const current = mapRef.current?.getCenter(); onConfirm({ latitude: current?.lat() ?? center.lat, longitude: current?.lng() ?? center.lng }); }}
          >
            Confirm this location
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}
