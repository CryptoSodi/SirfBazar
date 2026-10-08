import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useEffect, useRef, useState } from 'react'
import './google-sign-in.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

export default function GoogleSignIn({ onCredential, disabled = false, signup = false }: {
  onCredential: (idToken: string) => Promise<void>
  disabled?: boolean
  signup?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const [width, setWidth] = useState(280)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(Math.min(entry.contentRect.width, 400))))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (loaded || !clientId) return
    const timeout = setTimeout(() => setError('Google sign-in could not load. Check your connection or use your other sign-in method.'), 15000)
    return () => clearTimeout(timeout)
  }, [loaded])

  async function signIn(credential?: string) {
    if (pending.current || disabled) return
    if (!credential) { setError('Google did not return a sign-in token. Please try again.'); return }
    pending.current = true
    setBusy(true)
    setError('')
    try { await onCredential(credential) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <div ref={container} className="google-sign-in" aria-busy={busy}>
    {!clientId ? <p role="status">Google sign-in is unavailable. Use your other sign-in method.</p> :
      <GoogleOAuthProvider clientId={clientId} onScriptLoadSuccess={() => { setLoaded(true); setError('') }}
        onScriptLoadError={() => setError('Google sign-in could not load. Use your other sign-in method.')}>
        <div className="google-sign-in-control" hidden={busy || disabled}>
          <GoogleLogin width={width} theme="outline" size="large" shape="rectangular"
            text={signup ? 'signup_with' : 'signin_with'} useOneTap={false} auto_select={false}
            onSuccess={result => { void signIn(result.credential) }}
            onError={() => setError('Google sign-in did not complete. Please try again.')} />
        </div>
        {(busy || disabled) && <p className="google-sign-in-status" role="status">Signing in...</p>}
      </GoogleOAuthProvider>}
    {error && <p className="signin-request-error" role="alert">{error}</p>}
  </div>
}
