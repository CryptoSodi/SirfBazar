'use client';

import { ToastMessage } from '@/components/Toast';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { afterLogin, api, captureSession, CartMergeUncertainError, sessionGenerationIsCurrent } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

/**
 * Login-at-checkout bottom sheet (spec 16.3): phone OTP or Google.
 * Appears only when an action truly requires an account; after success the
 * guest cart is merged and the caller continues in place.
 */
export function LoginSheet({
  onClose,
  onSuccess,
  title = 'Sign in or create an account',
  description = 'Verify your phone or use Google. Your basket stays here while you continue.',
}: {
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code' | 'merge-error'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    alive.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    phoneRef.current?.focus();
    return () => { alive.current = false; previousFocus?.focus(); };
  }, []);

  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (step !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const handleDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], iframe, [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => element.getClientRects().length > 0);
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  };

  const sendOtp = async (resend = false) => {
    if (pending.current) return;
    if (resend && resendAvailableAt && Date.now() < resendAvailableAt) return;
    pending.current = true;
    const origin = captureSession();
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/auth/send-otp', { phoneNumber: phone.trim() });
      if (!alive.current || !sessionGenerationIsCurrent(origin)) return;
      setDeliveryStatus(response?.status === 'unconfirmed' ? 'Code request submitted, but delivery is unconfirmed. If a code arrives, enter it here.' : 'Code requested. Check WhatsApp for a message; delivery can take a moment.');
      const sentAt = Date.now();
      setNow(sentAt);
      setCodeExpiry(typeof response?.expiresInSeconds === 'number' && Number.isFinite(response.expiresInSeconds) && response.expiresInSeconds > 0 ? sentAt + response.expiresInSeconds * 1000 : null);
      // Older API deployments omit this field; their default is 60 seconds.
      const resendSeconds = typeof response?.resendAfterSeconds === 'number' && Number.isFinite(response.resendAfterSeconds) && response.resendAfterSeconds > 0
        ? response.resendAfterSeconds : 60;
      setResendAvailableAt(sentAt + resendSeconds * 1000);
      setStep('code');
    } catch (e: any) {
      if (alive.current && sessionGenerationIsCurrent(origin)) setError(e.message);
    } finally {
      pending.current = false;
      if (alive.current && sessionGenerationIsCurrent(origin)) setBusy(false);
    }
  };

  const verify = async () => {
    if (pending.current) return;
    if (codeExpiry !== null && Date.now() >= codeExpiry) { setError('This code has expired. Request a new code.'); return; }
    pending.current = true;
    const origin = captureSession();
    let feedback = origin;
    setBusy(true);
    setError('');
    try {
      const auth = await api.post('/auth/verify-otp', {
        phoneNumber: phone.trim(),
        code: code.trim(),
        context: 'customer',
        ...(name.trim() ? { fullName: name.trim() } : {}),
      });
      if (!alive.current || !sessionGenerationIsCurrent(origin)) return;
      const merge = afterLogin(auth);
      feedback = captureSession();
      await merge;
      if (alive.current && sessionGenerationIsCurrent(feedback)) onSuccess();
    } catch (e: any) {
      if (!alive.current || !sessionGenerationIsCurrent(feedback)) return;
      if (e instanceof CartMergeUncertainError) setStep('merge-error');
      else setError(e.message);
    } finally {
      pending.current = false;
      if (alive.current && sessionGenerationIsCurrent(feedback)) setBusy(false);
    }
  };

  const loginWithIdToken = async (idToken: string) => {
    if (!idToken || pending.current) return;
    pending.current = true;
    const origin = captureSession();
    let feedback = origin;
    setBusy(true);
    setError('');
    try {
      const auth = await api.post('/auth/google-login', { idToken, context: 'customer' });
      if (!alive.current || !sessionGenerationIsCurrent(origin)) return;
      const merge = afterLogin(auth);
      feedback = captureSession();
      await merge;
      if (alive.current && sessionGenerationIsCurrent(feedback)) onSuccess();
    } catch (e: any) {
      if (!alive.current || !sessionGenerationIsCurrent(feedback)) return;
      if (e instanceof CartMergeUncertainError) setStep('merge-error');
      else setError(e.message);
    } finally {
      pending.current = false;
      if (alive.current && sessionGenerationIsCurrent(feedback)) setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        aria-describedby="login-sheet-description"
        className="card max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-b-none p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="mb-1 flex items-start justify-between gap-3"><h2 id="login-sheet-title" className="text-lg font-bold">{title}</h2><button type="button" className="btn-secondary" onClick={onClose}>Close</button></div>
        <p id="login-sheet-description" className="mb-5 text-sm text-stone-500">{description}</p>

        {step === 'merge-error' ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your account is ready, but we could not confirm your guest basket was saved. Do not place the order yet. Check for missing or duplicate items.</p>
            <button className="btn-primary w-full" onClick={() => { onClose(); router.push('/cart'); }}>Check basket</button>
          </div>
        ) : step === 'phone' ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">The same step opens your existing account or creates a new one. No password needed.</p>
            <label className="block text-sm font-medium" htmlFor="login-phone">Phone number</label>
            <input
              ref={phoneRef}
              id="login-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 3xx xxxxxxx"
              inputMode="tel"
              autoComplete="tel"
            />
            <label className="block text-sm font-medium" htmlFor="login-name">Your name (optional)</label>
            <input
              id="login-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
            />
            <button className="btn-primary w-full" onClick={() => void sendOtp()} disabled={busy || phone.trim().length < 10}>
              {busy ? 'Requesting code…' : 'Continue with phone'}
            </button>
            <div className="text-center text-xs uppercase tracking-wide text-stone-400">or</div>
            {GOOGLE_CLIENT_ID ? (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} onScriptLoadError={() => setError('Google could not load. Use your mobile number or try again.')}>
                <div className={busy ? 'hidden' : 'flex justify-center'}>
                  <GoogleLogin
                    onSuccess={(cr) => cr.credential && loginWithIdToken(cr.credential)}
                    onError={() => setError('Google sign-in failed — please try again.')}
                    width="260"
                    auto_select={false}
                    useOneTap={false}
                  />
                </div>
              </GoogleOAuthProvider>
            ) : <p className="text-center text-xs text-stone-500">Google sign-in is not configured. Use your mobile number.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-600" role="status">{deliveryStatus}</p>
            <p className="text-sm text-stone-600">
              Enter the 6-digit code sent to <b>{phone}</b>
              <button className="ml-2 text-emerald-700 underline" onClick={() => { setCode(''); setStep('phone'); }}>
                Change phone number
              </button>
            </p>
            <label className="block text-sm font-medium" htmlFor="login-code">6-digit code</label>
            <input
              id="login-code"
              ref={codeRef}
              className="input text-center text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <button className="btn-primary w-full" onClick={verify} disabled={busy || code.length !== 6 || (codeExpiry !== null && now >= codeExpiry)}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="w-full text-center text-sm text-stone-500 underline" onClick={() => void sendOtp(true)} disabled={busy || (resendAvailableAt !== null && now < resendAvailableAt)}>
              {resendAvailableAt !== null && now < resendAvailableAt ? `Resend in ${Math.ceil((resendAvailableAt - now) / 1000)}s` : 'Resend code'}
            </button>
            {codeExpiry !== null && <p className="text-center text-xs text-stone-500">{now >= codeExpiry ? 'This code has expired. Request another.' : `This code expires in ${Math.ceil((codeExpiry - now) / 1000)}s.`}</p>}
          </div>
        )}

        {error && <ToastMessage>{error}</ToastMessage>}
        <p className="mt-4 text-center text-xs text-stone-500">Review our <Link href="/terms" target="_blank" className="underline">terms</Link> and <Link href="/privacy-policy" target="_blank" className="underline">privacy notice</Link> before continuing. No marketing signup is preselected.</p>
        <p className="mt-2 text-center text-xs text-stone-500">Use only a code sent to your phone. Your basket remains here while you sign in.</p>
      </div>
    </div>
  );
}
