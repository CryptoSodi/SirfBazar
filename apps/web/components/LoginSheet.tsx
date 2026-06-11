'use client';

import { useState } from 'react';
import { afterLogin, api } from '@/lib/api';

/**
 * Login-at-checkout bottom sheet (spec 16.3): phone OTP or Google.
 * Appears only when an action truly requires an account; after success the
 * guest cart is merged and the caller continues in place.
 */
export function LoginSheet({
  onClose,
  onSuccess,
  title = 'Login to place your order',
}: {
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+9230');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      const auth = await api.post('/auth/verify-otp', {
        phoneNumber: phone.trim(),
        code: code.trim(),
        ...(name.trim() ? { fullName: name.trim() } : {}),
      });
      await afterLogin(auth);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      // Dev flow: the mock verifier accepts "mock:<email>:<name>".
      const email = prompt('Google login (dev): enter your email', 'demo@sirfbazar.pk');
      if (!email) {
        setBusy(false);
        return;
      }
      const auth = await api.post('/auth/google-login', {
        idToken: `mock:${email}:${email.split('@')[0]}`,
      });
      await afterLogin(auth);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="card w-full max-w-md rounded-b-none p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-bold">{title}</div>
        <p className="mb-5 text-sm text-stone-500">
          Your cart is safe — you will continue right where you left off.
        </p>

        {step === 'phone' ? (
          <div className="space-y-3">
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 3xx xxxxxxx"
              inputMode="tel"
            />
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
            />
            <button className="btn-primary w-full" onClick={sendOtp} disabled={busy || phone.trim().length < 10}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <div className="text-center text-xs uppercase tracking-wide text-stone-400">or</div>
            <button className="btn-secondary w-full" onClick={google} disabled={busy}>
              <span className="mr-2">🔵</span> Continue with Google
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              Enter the 6-digit code sent to <b>{phone}</b>
              <button className="ml-2 text-emerald-700 underline" onClick={() => setStep('phone')}>
                change
              </button>
            </p>
            <input
              className="input text-center text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              autoFocus
            />
            <button className="btn-primary w-full" onClick={verify} disabled={busy || code.length < 4}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="w-full text-center text-sm text-stone-500 underline" onClick={sendOtp} disabled={busy}>
              Resend code
            </button>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <p className="mt-4 text-center text-[11px] text-stone-400">Dev tip: code 123456 always works.</p>
      </div>
    </div>
  );
}
