'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { api } from '@/lib/api';
import { hasMapsKey } from '@/lib/maps';
import type { PickedPoint } from './MapPicker';

// Google Maps is browser-only — load the picker lazily, never during SSR.
const MapPicker = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), { ssr: false });

const LABELS: { key: string; icon: string }[] = [
  { key: 'Home', icon: '🏠' },
  { key: 'Work', icon: '💼' },
  { key: 'Family', icon: '❤️' },
  { key: 'Other', icon: '📍' },
];

/** Add or edit a saved delivery address — parity with the mobile app:
 *  label chips, "use current location" (browser GPS), map pin, rider note. */
export function AddressForm({
  initial,
  defaultCoords,
  onSaved,
  onCancel,
}: {
  initial?: any;
  defaultCoords?: PickedPoint | null;
  onSaved: (a: any) => void;
  onCancel: () => void;
}) {
  const preset = initial ? LABELS.find((l) => l.key === initial.label) : LABELS[0];
  const [labelChip, setLabelChip] = useState(preset ? preset.key : initial ? 'Other' : 'Home');
  const [customLabel, setCustomLabel] = useState(preset || !initial ? '' : initial.label ?? '');
  const [fullAddress, setFullAddress] = useState(initial?.fullAddress ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [city, setCity] = useState(initial?.city ?? 'Lahore');
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);
  const [coords, setCoords] = useState<PickedPoint | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : defaultCoords ?? null,
  );
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Fill area/city from coordinates via the backend (no Google Geocoding needed).
  const fillFromCoords = async (latitude: number, longitude: number) => {
    try {
      const d = await api.post('/location/detect', { latitude, longitude });
      if (d?.area) setArea(d.area);
      if (d?.city) setCity(d.city);
    } catch {
      /* keep whatever the user typed */
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return setError('This browser can’t access location.');
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        await fillFromCoords(p.coords.latitude, p.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Couldn’t get an accurate fix — pin it on the map instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const onPinned = async (p: PickedPoint) => {
    setCoords(p);
    setShowMap(false);
    await fillFromCoords(p.latitude, p.longitude);
  };

  const save = async () => {
    const label = labelChip === 'Other' ? customLabel.trim() || 'Other' : labelChip;
    if (!fullAddress.trim()) return setError('Address is required.');
    if (!city.trim()) return setError('City is required.');
    setBusy(true);
    setError('');
    const payload = {
      label,
      fullAddress: fullAddress.trim(),
      area: area.trim() || undefined,
      city: city.trim(),
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      instructions: instructions.trim() || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      isDefault,
    };
    try {
      const saved = initial?.id
        ? await api.put(`/customer/addresses/${initial.id}`, payload)
        : await api.post('/customer/addresses', payload);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-stone-200 p-3">
      {/* Location pinning */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={useCurrentLocation} disabled={locating}>
          {locating ? 'Locating…' : '📍 Use current location'}
        </button>
        {hasMapsKey && (
          <button type="button" className="btn-secondary text-sm" onClick={() => setShowMap(true)}>
            🗺️ Pin on map
          </button>
        )}
        {coords && (
          <span className="self-center text-xs text-emerald-700">
            Pinned: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </span>
        )}
      </div>

      {/* Label chips */}
      <div className="flex gap-2">
        {LABELS.map((l) => {
          const active = labelChip === l.key;
          return (
            <button
              type="button"
              key={l.key}
              onClick={() => setLabelChip(l.key)}
              className={`flex-1 rounded-xl border px-2 py-2 text-center text-xs ${
                active ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-700' : 'border-stone-200 text-stone-600'
              }`}
            >
              <div className="text-base">{l.icon}</div>
              {l.key}
            </button>
          );
        })}
      </div>
      {labelChip === 'Other' && (
        <input className="input" placeholder="Label (e.g. Cousin's place)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
      )}

      <input className="input" placeholder="Full address (house, street, block, landmark)" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Area (e.g. Gulberg III)" value={area} onChange={(e) => setArea(e.target.value)} />
        <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <input className="input" placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      <input className="input" placeholder="Note for rider (e.g. ring bell, 2nd floor)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Set as default delivery address
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : initial?.id ? 'Save changes' : 'Save address'}
        </button>
        <button className="btn-secondary text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {showMap && <MapPicker initial={coords} onConfirm={onPinned} onClose={() => setShowMap(false)} />}
    </div>
  );
}
