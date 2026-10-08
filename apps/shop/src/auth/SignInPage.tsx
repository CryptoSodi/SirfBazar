import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, merchantApi } from './lib/api'
import { saveSession } from './lib/session'
import { AuthFooter, AuthHeader } from './AuthChrome'
import GoogleSignIn from './GoogleSignIn'
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

const helpNotice = 'Use the email address or mobile number registered with your merchant account. If you cannot sign in, choose Forgot password to recover access.'

export default function SignInPage() {
  const navigate = useNavigate()
  const [initialIdentifier] = useState(rememberedIdentifier)
  const [remember, setRemember] = useState(Boolean(initialIdentifier))
  const [reveal, setReveal] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
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

  function showNotice() {
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

  async function googleSignIn(idToken: string) {
    if (submitting.current) return
    submitting.current = true
    setGoogleBusy(true)
    login.reset()
    try {
      saveSession(await merchantApi.googleLogin(idToken))
      navigate('/workspace')
    } finally { submitting.current = false; setGoogleBusy(false) }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submit)(event)
  }

  return <div className="auth-page signin-page">
    <AuthHeader mainId="signin-main" onHelp={showNotice} />

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
              <button type="submit" className="signin-submit" disabled={login.isPending || googleBusy} aria-busy={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button>
            </form>

            <div className="signin-divider"><span>or</span></div>
            <GoogleSignIn onCredential={googleSignIn} disabled={login.isPending} />
            <p className="signin-create">New to SirfBazar? <Link to="/sign-up">Create an account</Link></p>
          </div>
        </section>
      </div>
    </main>

    <AuthFooter />
    <dialog ref={dialog} className="information-dialog signin-dialog" aria-labelledby="signin-notice-title" onClick={event => { if (event.target === dialog.current) dialog.current.close() }}>
      <h2 id="signin-notice-title">Merchant help</h2>
      <p>{helpNotice}</p>
      <button className="primary-action" type="button" onClick={() => dialog.current?.close()}>Close</button>
    </dialog>
  </div>
}
import { ToastMessage } from '../components/Toast';
