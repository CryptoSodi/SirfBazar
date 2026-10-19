import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { isShopPoint, ShopPoint } from '../lib/shop-location';
import { colors, s } from '../lib/theme';
import { IconLabel } from './IconLabel';
import ShopMapPicker from './ShopMapPicker';

type Profile = { latitude: number; longitude: number; isOwner?: boolean; permissions?: string[]; approvalStatus?: string };

export default function ShopLocationSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<ShopPoint | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const generation = useRef(0);
  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    setLoading(true); setError(''); setDraft(null); setMessage('');
    api.get('/merchant/profile').then(result => { if (request === generation.current) setProfile(result); })
      .catch(() => { if (request === generation.current) { setProfile(null); setError('Could not load your shop location.'); } })
      .finally(() => { if (request === generation.current) setLoading(false); });
    return () => { generation.current++; setOpen(false); };
  }, [attempt]));
  const canEdit = profile?.approvalStatus === 'APPROVED' && (profile.isOwner || profile.permissions?.includes('STORE'));
  const point = draft ?? (isShopPoint(profile) ? { latitude: profile.latitude, longitude: profile.longitude } : null);
  const save = async () => {
    if (!draft || !canEdit || busy.current) return;
    busy.current = true; setSaving(true); setError(''); setMessage('');
    const request = generation.current;
    try {
      await api.put('/merchant/profile', { latitude: draft.latitude, longitude: draft.longitude });
      if (request !== generation.current) return;
      setProfile(previous => previous ? { ...previous, ...draft } : previous);
      setDraft(null); setMessage('Shop location saved.');
    } catch {
      if (request === generation.current) setError('Could not save the shop location. Your selected pin is kept for retry.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <View style={{ marginTop: 18, gap: 10 }}>
    <Text accessibilityRole="header" style={s.h2}>Shop location</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      <Text style={s.body}>{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : 'No saved shop pin'}</Text>
      {canEdit && <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => setOpen(true)} style={[s.btnGhost, { minHeight: 48 }]}><IconLabel icon="pin" style={s.btnGhostText}>Edit shop entrance pin</IconLabel></TouchableOpacity>}
      {draft && <TouchableOpacity accessibilityRole="button" disabled={saving} accessibilityState={{ disabled: saving }} onPress={() => void save()} style={[s.btn, { minHeight: 48 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save shop location</Text>}</TouchableOpacity>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    {!loading && !profile && <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={s.btnGhost}><Text style={s.btnGhostText}>Retry shop location</Text></TouchableOpacity>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
    {open && <ShopMapPicker initial={point} onClose={() => setOpen(false)} onConfirm={next => { setDraft(next); setMessage(''); setOpen(false); }} />}
  </View>;
}
