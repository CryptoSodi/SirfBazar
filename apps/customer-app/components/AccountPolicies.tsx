import { useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

const links = [
  { label: 'Request account deletion', url: 'https://www.sirfbazar.com/account-deletion' },
  { label: 'Privacy policy', url: 'https://www.sirfbazar.com/privacy-policy' },
  { label: 'Terms and conditions', url: 'https://www.sirfbazar.com/terms' },
];

export function AccountPolicies({ color, textColor }: { color: string; textColor: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const open = async (url: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await Linking.openURL(url); }
    catch { setError('Could not open your browser. Email support@sirfbazar.com for policies or an account and data deletion request.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ marginTop: 16 }}>
    {links.map(link => <Pressable key={link.url} accessibilityRole="link"
      accessibilityLabel={link.label} accessibilityHint="Opens the SirfBazar website"
      accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void open(link.url)}
      style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 12, opacity: busy ? 0.6 : 1 }}>
      <Text style={{ color, fontSize: 14, lineHeight: 21, textDecorationLine: 'underline', flexShrink: 1 }}>{link.label}</Text>
    </Pressable>)}
    {!!error && <Text selectable accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={{ color: textColor, fontSize: 13, lineHeight: 20 }}>{error}</Text>}
  </View>;
}
