'use client';

import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { GOOGLE_MAPS_API_KEY } from '@/lib/maps';

const FALLBACK = { lat: 31.5204, lng: 74.3587 }; // Gulberg, Lahore

export interface PickedPoint {
  latitude: number;
  longitude: number;
}

/** Modal map picker: drag the pin (or click the map) to set the exact drop-off,
 *  then Confirm. Returns the chosen coordinates. */
export function MapPicker({
  initial,
  onConfirm,
  onClose,
}: {
  initial?: PickedPoint | null;
  onConfirm: (p: PickedPoint) => void;
  onClose: () => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'sb-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const [pos, setPos] = useState(
    initial ? { lat: initial.latitude, lng: initial.longitude } : FALLBACK,
  );

  const recenterToGps = () => {
    navigator.geolocation?.getCurrentPosition((p) =>
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
    );
  };

  const ui = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="card w-full max-w-lg overflow-hidden rounded-b-none p-0 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <h3 className="font-bold">Pin your location</h3>
          <button className="text-sm text-stone-500" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="relative">
          {loadError ? (
            <div className="grid h-[360px] place-items-center p-6 text-center text-sm text-red-600">
              Couldn’t load the map. Check that the Google Maps key allows this site.
            </div>
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: 360 }}
              center={pos}
              zoom={16}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
              onClick={(e) => {
                if (e.latLng) setPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              <Marker
                position={pos}
                draggable
                onDragEnd={(e) => {
                  if (e.latLng) setPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                }}
              />
            </GoogleMap>
          ) : (
            <div className="grid h-[360px] place-items-center text-sm text-stone-500">Loading map…</div>
          )}

          <button
            type="button"
            onClick={recenterToGps}
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-lg shadow"
            title="Use my current location"
          >
            🎯
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-500">Drag the pin or tap the map for the exact spot.</p>
          <button
            className="btn-primary w-full"
            onClick={() => onConfirm({ latitude: pos.lat, longitude: pos.lng })}
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}
