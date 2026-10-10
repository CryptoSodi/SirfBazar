
import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api } from '../lib/api';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function GoogleAccountLink() {
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setMessage(''); setFailed(false);
    try { setAccount(await api.get('/auth/google-account')); }
    catch (error: any) { setAccount(null); setFailed(true); setMessage(error?.message || 'Could not check Google account status.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function link(credential?: string) {
    if (pending.current) return;
    if (!credential) { setFailed(true); setMessage('Google did not return a sign-in token. Please try again.'); return; }
    pending.current = true; setBusy(true); setMessage(''); setFailed(false);
    try {
      await api.post('/auth/google-link', { idToken: credential });
      await load(); setOpen(false);
    } catch (error: any) { setFailed(true); setMessage(error?.message || 'Could not link Google. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Google account linking" style={{ marginBlock: 16, minWidth: 0 }}>
    <h2 className="text-sm font-bold">Google account</h2>
    {loading ? <p role="status" className="small muted">Checking connection…</p> : account?.linked ? <div className="row" style={{ gap: 12, marginTop: 8, minWidth: 0 }}>
      {account.avatarUrl && <img src={account.avatarUrl} alt="Google account avatar" width={40} height={40} style={{ borderRadius: '50%', flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}><p style={{ overflowWrap: 'anywhere' }}>{account.displayName || 'Connected Google account'}</p>
        <p className="small muted" style={{ overflowWrap: 'anywhere' }}>{account.email || 'Profile details unavailable; sign in with Google to refresh them.'}</p>
        <p className="small muted">Google connected</p>
      </div>
    </div> : account ? <>
      <p className="small muted" style={{ marginTop: 5 }}>Not connected. This account uses its existing sign-in method.</p>
      {clientId ? <button type="button" className="underline" disabled={busy || loading} aria-expanded={open} onClick={() => { setOpen(!open); setMessage(''); }}>
        {busy ? 'Linking Google…' : 'Link Google to this account'}
      </button> : <p className="small muted">Google linking is not configured in this environment.</p>}
    </> : <p role="status" className="small muted">Google account status is unavailable. Retry to check it.</p>}
    {failed && message && <p role="alert" className="small" style={{ marginTop: 8 }}>{message} <button type="button" className="underline" onClick={() => void load()}>Retry</button></p>}
    {open && clientId && <div style={{ marginTop: 12, maxWidth: '100%' }}>
      <GoogleOAuthProvider clientId={clientId} onScriptLoadError={() => { setFailed(true); setMessage('Google could not load. Check your connection and try again.'); }}>
        <div hidden={busy}><GoogleLogin text="continue_with" size="medium" useOneTap={false} auto_select={false}
          onSuccess={result => { void link(result.credential); }}
          onError={() => { setFailed(true); setMessage('Google sign-in did not complete. Please try again.'); }} /></div>
      </GoogleOAuthProvider>
    </div>}
    {message && !failed && <p role="status" style={{ marginTop: 8, overflowWrap: 'anywhere' }}>{message}</p>}
  </section>;
}
