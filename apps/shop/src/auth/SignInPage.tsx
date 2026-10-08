import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, merchantApi } from './lib/api'
import { saveSession } from './lib/session'
import { AuthFooter, AuthHeader } from './AuthChrome'
import './sign-in.css'

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
})
type Credentials = z.infer<typeof schema>

const REMEMBER_KEY = 'sirfbazar.merchant.remembered-identifier'
function rememberedIdentifier() {
  try { return localStorage.getItem(REMEMBER_KEY) ?? '' } catch { return '' }
}

function signInError(error: Error) {
  if (!(error instanceof ApiError)) return 'Unable to sign in. Please try again.'
  if (error.status === 401) return 'Email, mobile number, or password is incorrect. Try again.'
  if (error.status === 429) return 'Too many attempts. Please wait a little before trying again.'
  if (error.status === 0) return 'Unable to reach the merchant service. Check your connection and try again.'
  return 'Unable to sign in right now. Please try again.'
}

const googleNotice = 'Google sign-in is not connected yet. Sign in with your registered email address or mobile number and password.'
const helpNotice = 'Use the email address or mobile number registered with your merchant account. If you cannot sign in, choose Forgot password to recover access.'

export default function SignInPage() {
  const navigate = useNavigate()
  const [initialIdentifier] = useState(rememberedIdentifier)
  const [remember, setRemember] = useState(Boolean(initialIdentifier))
  const [reveal, setReveal] = useState(false)
  const [notice, setNotice] = useState<'google' | 'help'>('help')
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Credentials>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: initialIdentifier, password: '' },
  })
  const login = useMutation({
    mutationFn: ({ identifier, password }: Credentials) => merchantApi.login(identifier, password),
    onSuccess: (session, values) => {
      saveSession(session)
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, values.identifier)
        else localStorage.removeItem(REMEMBER_KEY)
      } catch { /* Remembering the identifier must not prevent sign-in. */ }
      navigate('/workspace')
    },
    onSettled: () => { submitting.current = false },
  })

  function showNotice(topic: 'google' | 'help') {
    setNotice(topic)
    dialog.current?.showModal()
  }

  function changeRemember(value: boolean) {
    setRemember(value)
    if (!value) {
      try { localStorage.removeItem(REMEMBER_KEY) }
      catch { /* Storage may be unavailable. */ }
    }
  }

  function submit(values: Credentials) {
    if (submitting.current) return
    submitting.current = true
    login.mutate(values)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submit)(event)
  }

  return <div className="auth-page signin-page">
    <AuthHeader mainId="signin-main" onHelp={() => showNotice('help')} />

    <main className="signin-main" id="signin-main">
      <div className="signin-panel">
        <aside className="signin-brand-panel" aria-label="About SirfBazar">
          <div className="signin-brand-copy">
            <p className="signin-brand-headline">Your shop.<br />Your way.</p>
            <p className="signin-brand-support">A simpler way to run your neighbourhood shop.</p>
          </div>
          <img className="signin-slogan" src="/brand/sirfbazar-slogan-urdu.svg" alt="بازار وہی۔ طریقہ نیا۔" lang="ur" dir="rtl" />
        </aside>

        <section className="signin-form-panel" aria-labelledby="signin-title">
          <div className="signin-form-content">
            <div className="signin-intro">
              <h1 id="signin-title">Sign in to your shop</h1>
              <p>Sign in to manage your shop.</p>
            </div>

            <form className="signin-form" onSubmit={onSubmit} noValidate>
              <div className="signin-field">
                <label htmlFor="merchant-identifier">Email address or mobile number</label>
                <input id="merchant-identifier" type="text" autoComplete="username" placeholder="Enter your email or mobile number" {...register('identifier')} aria-invalid={Boolean(errors.identifier)} aria-describedby={errors.identifier ? 'signin-identifier-error' : undefined} />
                {errors.identifier && <p className="signin-field-error" id="signin-identifier-error" role="alert">{errors.identifier.message}</p>}
              </div>
              <div className="signin-field">
                <label htmlFor="merchant-password">Password</label>
                <div className="signin-password-wrap">
                  <input id="merchant-password" type={reveal ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" {...register('password')} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'signin-password-error' : undefined} />
                  <button type="button" className="signin-reveal" aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} onClick={() => setReveal(value => !value)}>{reveal ? 'Hide' : 'Show'}</button>
                </div>
                {errors.password && <p className="signin-field-error" id="signin-password-error" role="alert">{errors.password.message}</p>}
              </div>

              <div className="signin-options">
                <label className="signin-remember" title="Saves only your email address or mobile number on this browser. It does not keep your session signed in.">
                  <input type="checkbox" checked={remember} onChange={event => changeRemember(event.target.checked)} />
                  <span>Remember email or mobile</span>
                </label>
                <Link to="/recover">Forgot password?</Link>
              </div>

              {login.error && <ToastMessage>{signInError(login.error)}</ToastMessage>}
              <button type="submit" className="signin-submit" disabled={login.isPending} aria-busy={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button>
            </form>

            <div className="signin-divider"><span>or</span></div>
            <button type="button" className="signin-google" onClick={() => showNotice('google')}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
            <p className="signin-create">New to SirfBazar? <Link to="/sign-up">Create an account</Link></p>
          </div>
        </section>
      </div>
    </main>

    <AuthFooter />
    <dialog ref={dialog} className="information-dialog signin-dialog" aria-labelledby="signin-notice-title" onClick={event => { if (event.target === dialog.current) dialog.current.close() }}>
      <h2 id="signin-notice-title">{notice === 'google' ? 'Google sign-in' : 'Merchant help'}</h2>
      <p>{notice === 'google' ? googleNotice : helpNotice}</p>
      <button className="primary-action" type="button" onClick={() => dialog.current?.close()}>Close</button>
    </dialog>
  </div>
}
import { ToastMessage } from '../components/Toast';
