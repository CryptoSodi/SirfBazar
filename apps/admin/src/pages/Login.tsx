import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api, storeAuth } from '../lib/api';
import { btnCls, inputCls } from '../components/ui';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@sirfbazar.pk');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const auth = await api.post('/auth/admin-login', { email, password });
      storeAuth(auth);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential?: string) => {
    if (!credential) return;
    setBusy(true);
    setError('');
    try {
      const auth = await api.post('/auth/google-login', { idToken: credential, context: 'admin' });
      storeAuth(auth);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">SB</span>
          <div>
            <div className="font-extrabold">SirfBazar Admin</div>
            <div className="text-xs text-slate-400">Marketplace operations console</div>
          </div>
        </div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
        <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label className="mb-1 mt-3 block text-xs font-semibold text-slate-500">Password</label>
        <input
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className={`${btnCls} mt-5 w-full py-2.5`} disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {GOOGLE_CLIENT_ID && (
          <>
            <div className="my-4 text-center text-[11px] uppercase tracking-wide text-slate-400">or</div>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={(cr) => onGoogle(cr.credential)} onError={() => setError('Google sign-in failed')} />
              </div>
            </GoogleOAuthProvider>
          </>
        )}
        <p className="mt-3 text-center text-[11px] text-slate-400">Dev: admin@sirfbazar.pk / Admin@12345 · or Google (admins only)</p>
      </form>
    </div>
  );
}
