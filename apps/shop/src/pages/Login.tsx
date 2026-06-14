import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { api, storeAuth } from '../lib/api';
import { btnCls, inputCls } from '../components/ui';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+9230');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only merchant owners/staff may use this panel.
  const finish = (auth: any) => {
    // The backend (context: 'merchant') guarantees only merchant accounts reach here.
    storeAuth(auth);
    navigate('/');
  };

  const sendOtp = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { phoneNumber: phone.trim() });
      setStep('code');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      finish(await api.post('/auth/verify-otp', { phoneNumber: phone.trim(), code: code.trim(), context: 'merchant' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential?: string) => {
    if (!credential) return;
    setBusy(true);
    setError('');
    try {
      finish(await api.post('/auth/google-login', { idToken: credential, context: 'merchant' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">SB</span>
          <div>
            <div className="font-extrabold">SirfBazar Merchant</div>
            <div className="text-xs text-slate-400">Your shop dashboard</div>
          </div>
        </div>

        {step === 'phone' ? (
          <>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Phone number</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
            <button className={`${btnCls} mt-4 w-full py-2.5`} onClick={sendOtp} disabled={busy || phone.trim().length < 10}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-semibold text-slate-500">6-digit code sent to {phone}</label>
            <input
              className={`${inputCls} text-center text-xl tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              autoFocus
            />
            <button className={`${btnCls} mt-4 w-full py-2.5`} onClick={verify} disabled={busy || code.length < 4}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button className="mt-2 w-full text-center text-xs text-slate-500 underline" onClick={() => setStep('phone')}>
              Change number
            </button>
          </>
        )}

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

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-center text-[11px] text-slate-400">Dev: +923010000001 / 123456 · or Google (merchants only)</p>
      </div>
    </div>
  );
}
