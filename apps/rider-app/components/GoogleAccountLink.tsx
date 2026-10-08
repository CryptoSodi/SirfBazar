import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { googleSignInIdToken } from '../lib/google';
import { useRiderTheme } from '../lib/appearance';

export function GoogleAccountLink() {
  const { palette } = useRiderTheme();
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
      disabled={busy} style={{ borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: 12, padding: 14, alignItems: 'center' }} onPress={() => void link()}>
      <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '600' }}>{busy ? 'Linking Google...' : 'Link Google to this account'}</Text>
    </TouchableOpacity>
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: palette.quiet, fontSize: 13 }}>{message}</Text>}
  </View>;
}
