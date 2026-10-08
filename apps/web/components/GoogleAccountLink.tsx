'use client';
import { useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api } from '../lib/api';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export function GoogleAccountLink() {
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function link(credential?: string) {
    if (pending.current) return;
    if (!credential) { setFailed(true); setMessage('Google did not return a sign-in token. Please try again.'); return; }
    pending.current = true; setBusy(true); setMessage(''); setFailed(false);
    try {
      await api.post('/auth/google-link', { idToken: credential });
      setMessage('Google is linked to this account.'); setOpen(false);
    } catch (error: any) { setFailed(true); setMessage(error?.message || 'Could not link Google. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!clientId) return null;
  return <section aria-label="Google account linking" style={{ marginBlock: 16, minWidth: 0 }}>
    <button type="button" className="underline" disabled={busy} aria-expanded={open} onClick={() => { setOpen(!open); setMessage(''); }}>
      {busy ? 'Linking Google...' : 'Link Google to this account'}
    </button>
    {open && <div style={{ marginTop: 12, maxWidth: '100%' }}>
      <GoogleOAuthProvider clientId={clientId} onScriptLoadError={() => { setFailed(true); setMessage('Google could not load. Check your connection and try again.'); }}>
        <div hidden={busy}><GoogleLogin text="continue_with" size="medium" useOneTap={false} auto_select={false}
          onSuccess={result => { void link(result.credential); }}
          onError={() => { setFailed(true); setMessage('Google sign-in did not complete. Please try again.'); }} /></div>
      </GoogleOAuthProvider>
    </div>}
    {message && <p role={failed ? 'alert' : 'status'} style={{ marginTop: 8, overflowWrap: 'anywhere' }}>{message}</p>}
  </section>;
}
