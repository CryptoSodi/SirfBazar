import { ToastMessage } from '../components/Toast';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api, storeAuth } from '../lib/api';
import { btnCls, inputCls } from '../components/ui';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
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
    <main className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="sb-admin-login w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <img src="/brand/sirfbazar-primary.svg" alt="SirfBazar — بازار وہی۔ طریقہ نیا۔" className="h-auto w-56" />
          <div className="mt-2 text-sm font-semibold text-slate-600">Admin console</div>
        </div>
        <label htmlFor="admin-email" className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
        <input id="admin-email" name="email" type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label htmlFor="admin-password" className="mb-1 mt-3 block text-xs font-semibold text-slate-500">Password</label>
        <input
          id="admin-password"
          name="password"
          required
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <ToastMessage>{error}</ToastMessage>}
        <button className={`${btnCls} mt-5 w-full py-2.5`} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {GOOGLE_CLIENT_ID && (
          <>
            <div className="my-4 text-center text-[11px] uppercase tracking-wide text-slate-500">or</div>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={(cr) => onGoogle(cr.credential)} onError={() => setError('Google sign-in failed. Try again or use your email and password.')} />
              </div>
            </GoogleOAuthProvider>
          </>
        )}
        <p className="mt-3 text-center text-[11px] text-slate-500">Authorized administrators only.</p>
      </form>
    </main>
  );
}
