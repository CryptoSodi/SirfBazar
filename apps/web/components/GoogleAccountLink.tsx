'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api } from '../lib/api';
import { useToast } from './Toast';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export function GoogleAccountLink() {
  const { toast } = useToast();
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { setAccount(await api.get('/auth/google-account')); }
    catch (error: any) { setAccount(null); setLoadError(error?.message || 'Could not check Google account status.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function link(credential?: string) {
    if (pending.current) return;
    if (!credential) { toast('Google did not return a sign-in token. Please try again.', false); return; }
    pending.current = true; setBusy(true);
    try {
      await api.post('/auth/google-link', { idToken: credential });
      await load(); setOpen(false);
    } catch (error: any) { toast(error?.message || 'Could not link Google. Please try again.', false); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Google account linking" style={{ marginBlock: 16, minWidth: 0 }}>
    <h2 className="font-semibold">Google account</h2>
    {loading ? <p role="status" className="mt-2 text-sm text-stone-500">Checking connection…</p> : account?.linked ? <div className="mt-2 flex min-w-0 items-center gap-3">
      {account.avatarUrl && <img src={account.avatarUrl} alt="Google account avatar" className="h-10 w-10 shrink-0 rounded-full" />}
      <div className="min-w-0"><p className="truncate font-medium">{account.displayName || 'Connected Google account'}</p>
        <p className="break-all text-sm text-stone-600">{account.email || 'Profile details unavailable; sign in with Google to refresh them.'}</p>
        <p className="text-xs text-stone-500">Google connected</p>
      </div>
    </div> : account ? <>
      <p className="mt-1 text-sm text-stone-600">Not connected. This account uses its existing sign-in method.</p>
      {clientId ? <button type="button" className="mt-2 min-h-10 underline focus-visible:outline focus-visible:outline-2" disabled={busy || loading} aria-expanded={open} onClick={() => setOpen(!open)}>
        {busy ? 'Linking Google…' : 'Link Google to this account'}
      </button> : <p role="status" className="mt-2 text-sm text-stone-500">Google linking is not configured in this environment.</p>}
    </> : <p role="status" className="mt-2 text-sm text-stone-600">Google account status is unavailable. Retry to check it.</p>}
    {loadError && <p role="alert" className="mt-2 text-sm text-red-700">{loadError} <button type="button" className="underline" onClick={() => void load()}>Retry</button></p>}
    {open && clientId && <div style={{ marginTop: 12, maxWidth: '100%' }}>
      <GoogleOAuthProvider clientId={clientId} onScriptLoadError={() => toast('Google could not load. Check your connection and try again.', false)}>
        <div hidden={busy}><GoogleLogin text="continue_with" size="medium" useOneTap={false} auto_select={false}
          onSuccess={result => { void link(result.credential); }}
          onError={() => toast('Google sign-in did not complete. Please try again.', false)} /></div>
      </GoogleOAuthProvider>
    </div>}
  </section>;
}
