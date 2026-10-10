import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { googleSignInIdToken } from '../lib/google';
import { s } from '../lib/theme';

export function GoogleAccountLink() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try { setAccount(await api.get('/auth/google-account')); }
    catch (error: any) { setMessage(error?.message || 'Could not check Google account status.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const link = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const idToken = await googleSignInIdToken();
      if (!idToken) return;
      await api.post('/auth/google-link', { idToken });
      await load();
    } catch (error: any) { setMessage(error?.message || 'Could not link Google. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View accessibilityLabel="Google account" style={{ marginTop: 16, gap: 8 }}>
    <Text style={s.h2}>Google account</Text>
    {loading ? <Text accessibilityLiveRegion="polite" style={s.muted}>Checking connection…</Text> : account?.linked ? <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      {account.avatarUrl ? <Image source={{ uri: account.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} accessibilityLabel="Google account avatar" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.body}>{account.displayName || 'Connected Google account'}</Text>
        <Text style={s.muted}>{account.email || 'Profile details unavailable; sign in with Google to refresh them.'}</Text>
        <Text style={s.faint}>Google connected</Text>
      </View>
    </View> : account ? <>
      <Text style={s.muted}>Not connected. This account uses its existing sign-in method.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy || loading} style={s.btnGhost} onPress={() => void link()}>
        {busy ? <ActivityIndicator color="#4285F4" /> : <Text style={s.btnGhostText}>Link Google to this account</Text>}
      </TouchableOpacity>
    </> : <Text style={s.muted}>Google account status is unavailable. Retry to check it.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.muted}>{message}</Text>}
    {!loading && !account && <TouchableOpacity accessibilityRole="button" onPress={() => void load()} style={s.btnGhost}><Text style={s.btnGhostText}>Retry</Text></TouchableOpacity>}
  </View>;
}
