'use client';
import { useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api } from '../lib/api';
import { useToast } from './Toast';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export function GoogleAccountLink() {
  const { toast } = useToast();
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function link(credential?: string) {
    if (pending.current) return;
    if (!credential) { toast('Google did not return a sign-in token. Please try again.', false); return; }
    pending.current = true; setBusy(true);
    try {
      await api.post('/auth/google-link', { idToken: credential });
      toast('Google is linked to this account.'); setOpen(false);
    } catch (error: any) { toast(error?.message || 'Could not link Google. Please try again.', false); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!clientId) return null;
  return <section aria-label="Google account linking" style={{ marginBlock: 16, minWidth: 0 }}>
    <button type="button" className="underline" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)}>
      {busy ? 'Linking Google...' : 'Link Google to this account'}
    </button>
    {open && <div style={{ marginTop: 12, maxWidth: '100%' }}>
      <GoogleOAuthProvider clientId={clientId} onScriptLoadError={() => toast('Google could not load. Check your connection and try again.', false)}>
        <div hidden={busy}><GoogleLogin text="continue_with" size="medium" useOneTap={false} auto_select={false}
          onSuccess={result => { void link(result.credential); }}
          onError={() => toast('Google sign-in did not complete. Please try again.', false)} /></div>
      </GoogleOAuthProvider>
    </div>}
  </section>;
}
