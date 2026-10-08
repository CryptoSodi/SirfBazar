import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { googleSignInIdToken } from '../lib/google';
import { useTheme } from '../lib/theme';

export function GoogleAccountLink() {
  const { s } = useTheme();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const link = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const idToken = await googleSignInIdToken();
      if (!idToken) return;
      await api.post('/auth/google-link', { idToken });
      setMessage('Google is linked to this account.');
    } catch (error: any) { setMessage(error?.message || 'Could not link Google. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View style={{ marginTop: 16, gap: 8 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
      disabled={busy} style={s.btnGhost} onPress={() => void link()}>
      <Text style={s.btnGhostText}>{busy ? 'Linking Google...' : 'Link Google to this account'}</Text>
    </TouchableOpacity>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.muted}>{message}</Text>}
  </View>;
}
