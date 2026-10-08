import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, merchantApi } from './lib/api'
import { AuthFooter, AuthHeader } from './AuthChrome'
import './recovery.css'

function Icon({ name }: { name: string }) { return <span className="recovery-symbol" aria-hidden="true">{name}</span> }
type Step = 1 | 2 | 3 | 4
const info = {
  help: ['Merchant Support', 'Use the email address or mobile number registered with your merchant account. The merchant service will tell you how to obtain the recovery code after your request. Contact support if recovery delivery is unavailable.'],
  security: ['Security Policy', 'This local preview uses HTTP; production transport security has not been verified. Never share your recovery code. Your password changes only after the merchant service accepts your code and new password.'],
} as const

function Progress({ step }: { step: Step }) {
  return <nav className="recovery-progress" aria-label="Recovery progress">{['Request code', 'Enter code', 'New password'].map((label, index) => <div className={step > index + 1 ? 'complete' : step === index + 1 ? 'current' : ''} key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{step > index + 1 && index === 0 || step === 4 ? <Icon name="check" /> : index + 1}</span><strong>{label}</strong></div>)}</nav>
}

export function RecoveryCodeForm({ email, pending, preview = false, deliveryMessage = '', error, onBack, onResend, onContinue }: { email: string; pending: boolean; preview?: boolean; deliveryMessage?: string; error: Error | null; onBack: () => void; onResend: () => void; onContinue: (code: string) => void }) {
  const isMobile = !email.includes('@')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [invalid, setInvalid] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  function enter(index: number, value: string) {
    const characters = value.replace(/\D/g, '').slice(0, 6 - index).split('')
    setDigits(previous => {
      const next = [...previous]
      if (!characters.length) next[index] = ''
      characters.forEach((character, offset) => { next[index + offset] = character })
      return next
    })
    setInvalid(false)
    if (characters.length) inputs.current[Math.min(index + characters.length, 5)]?.focus()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(digits.join(''))) { setInvalid(true); inputs.current[digits.findIndex(digit => !digit)]?.focus(); return }
    onContinue(digits.join(''))
  }
  return <>
    <div className="recovery-destination"><div className="recovery-mail-icon"><Icon name={isMobile ? 'phone_iphone' : 'mail'} /></div><div><span>Recovery {isMobile ? 'mobile' : 'email'}</span><strong>{email}</strong></div><button type="button" onClick={onBack} disabled={pending || preview}><Icon name="edit" />Change</button></div>
    {!preview && deliveryMessage && <p className="recovery-preview-notice" role="status">{deliveryMessage}</p>}
    <form className="recovery-form" onSubmit={submit} noValidate>
      <div className="recovery-code-field"><div className="recovery-code-label"><label htmlFor="recovery-code-0">6-Digit Authorization Passcode</label><span><Icon name="schedule" />Valid for 5 minutes</span></div>
        <div className="recovery-code-grid" role="group" aria-label="6-digit recovery code">{digits.map((digit, index) => <input key={index} id={'recovery-code-' + index} ref={element => { inputs.current[index] = element }} aria-label={'Code digit ' + (index + 1)} aria-invalid={invalid} aria-describedby="recovery-code-help" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} value={digit} placeholder="·" onChange={event => enter(index, event.target.value)} onFocus={event => event.target.select()} onPaste={event => { event.preventDefault(); enter(index, event.clipboardData.getData('text')) }} onKeyDown={event => {
          if (event.key === 'Backspace' && !digit && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); setDigits(previous => previous.map((item, i) => i === index - 1 ? '' : item)) }
          if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus() }
          if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); inputs.current[index + 1]?.focus() }
        }} />)}</div>
        <p id="recovery-code-help" className={invalid ? 'recovery-error' : 'recovery-helper'} role={invalid ? 'alert' : undefined}>{invalid ? 'Enter all 6 digits of your recovery code.' : <><Icon name="pin" />Your code is checked when you submit your new password.</>}</p>
      </div>
      <div className="recovery-resend"><span>Need a new code? <button type="button" disabled={pending || preview} onClick={onResend}>{pending ? 'Requesting…' : 'Request New Code'}</button></span></div>
      <RequestError error={error} />
      <aside className="recovery-safeguard"><Icon name="warning" /><div><strong>Credential Protection Safeguard</strong><p>Never share your recovery code. Only a valid, unexpired code can authorize a password change.</p></div></aside>
      <div className="recovery-actions"><button className="recovery-primary" disabled={pending || preview}>Continue to Reset<Icon name="arrow_forward" /></button><button type="button" className="recovery-back" onClick={onBack} disabled={pending || preview}><Icon name="arrow_back" />Back to Request Code (Step 1)</button></div>
      <p className="recovery-session-note"><Icon name="lock" />Your code stays in this recovery session.</p>
    </form>
  </>
}

function RequestError({ error }: { error: Error | null }) {
  if (!error) return null
  return <ToastMessage>{error instanceof ApiError ? error.message : 'Unable to complete the request. Please try again.'}</ToastMessage>
}

export default function RecoveryPage({ previewCode = false }: { previewCode?: boolean }) {
  const preview = import.meta.env.DEV && previewCode
  const [step, setStep] = useState<Step>(preview ? 2 : 1)
  const [channel, setChannel] = useState<'email' | 'mobile'>('email')
  const [email, setEmail] = useState('')
  const [requestedEmail, setRequestedEmail] = useState(preview ? 'merchant@example.pk' : '')
  const [code, setCode] = useState('')
  const [codeVersion, setCodeVersion] = useState(0)
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validation, setValidation] = useState('')
  const [passwordErrorField, setPasswordErrorField] = useState<'password' | 'confirm'>('password')
  const [notice, setNotice] = useState<keyof typeof info>('help')
  const dialog = useRef<HTMLDialogElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmPasswordInput = useRef<HTMLInputElement>(null)
  const request = useMutation({ mutationFn: (value: string) => merchantApi.requestPasswordReset(value), onSuccess: (result, value) => {
    setRequestedEmail(value)
    setDeliveryMessage(result?.message === 'Local test recovery code ready.'
      ? 'Local test code: 123456. No message was sent.'
      : result?.message === 'If this mobile number is registered, a code will arrive on WhatsApp.'
        ? 'If this mobile number is registered, check WhatsApp for its recovery code.'
        : result?.message || 'If this contact is registered, check it for a recovery code.')
    setCode(''); setCodeVersion(version => version + 1); setStep(2)
  } })
  const reset = useMutation({ mutationFn: () => merchantApi.resetPassword(requestedEmail, code, password), onSuccess: () => { setPassword(''); setConfirmPassword(''); setCode(''); setStep(4) } })
  function showNotice(topic: keyof typeof info) { setNotice(topic); dialog.current?.showModal() }
  function backToRequest() { setStep(1); setCode(''); setDeliveryMessage(''); setPassword(''); setConfirmPassword(''); setValidation(''); request.reset(); reset.reset() }
  function submitRequest(event: FormEvent) {
    event.preventDefault()
    if (preview || request.isPending) return
    const value = email.trim()
    const valid = channel === 'email' ? z.email().safeParse(value).success : /^(?:\+?92|0)?3\d{9}$/.test(value.replace(/[\s-]/g, ''))
    if (!valid) { setValidation(channel === 'email' ? 'Enter the email address on your account.' : 'Enter the Pakistani mobile number on your account.'); emailInput.current?.focus(); return }
    setValidation(''); request.mutate(value)
  }
  function submitPassword(event: FormEvent) {
    event.preventDefault()
    if (preview || reset.isPending) return
    if (password.length < 8 || !/\d/.test(password)) { setPasswordErrorField('password'); setValidation('Use at least 8 characters including a number.'); passwordInput.current?.focus(); return }
    if (password !== confirmPassword) { setPasswordErrorField('confirm'); setValidation('Passwords must match.'); confirmPasswordInput.current?.focus(); return }
    setValidation(''); reset.mutate()
  }
  const title = step === 1 ? 'Reset your merchant password' : step === 2 ? 'Enter verification code' : step === 3 ? 'Set your new password' : 'Password reset successful!'
  return <div className="auth-page recovery-page">
    <AuthHeader mainId="recovery-main" onHelp={() => showNotice('help')} />
    <main className="recovery-main" id="recovery-main"><section className="recovery-card" aria-labelledby="recovery-title">
      <div className="recovery-overline"><span><Icon name="shield" />Password recovery</span><strong>{step === 4 ? 'Complete' : `Step ${step} of 3`}</strong></div>
      <div className="recovery-body"><div className="recovery-title"><h1 id="recovery-title">{title}</h1><p>{step === 1 ? 'Enter your registered email address or mobile number to request a single-use recovery code.' : step === 2 ? 'Enter your 6-digit recovery code:' : step === 3 ? 'Choose a new password. Your recovery code will be verified when you submit.' : 'Your password has been updated. You can now sign in with your new password.'}</p></div>
        {preview && <p className="recovery-preview-notice" role="status">Design preview only — no email was sent. Submission and resend are disabled. <Link to="/recover">Open recovery</Link></p>}
        <Progress step={step} />
        {step === 1 && <>
          <div className="recovery-channel"><span>Select Recovery Channel</span><div role="group" aria-label="Recovery channel"><button type="button" aria-pressed={channel === 'email'} onClick={() => { setChannel('email'); setEmail(''); setValidation(''); request.reset() }} disabled={request.isPending}><Icon name="mail" />Email Address{channel === 'email' && <i />}</button><button type="button" aria-pressed={channel === 'mobile'} onClick={() => { setChannel('mobile'); setEmail(''); setValidation(''); request.reset() }} disabled={request.isPending}><Icon name="sms" />Mobile OTP{channel === 'mobile' && <i />}</button></div></div>
          <form className="recovery-form" onSubmit={submitRequest} noValidate>
            <div className="recovery-field"><label htmlFor="recovery-identifier"><span>{channel === 'email' ? 'Registered Merchant Email' : 'Registered Merchant Mobile (PK)'}</span><small>{channel === 'email' ? 'Email Recovery' : 'Mobile Recovery'}</small></label><div className="recovery-input"><Icon name={channel === 'email' ? 'mail' : 'phone_iphone'} /><input ref={emailInput} id="recovery-identifier" type={channel === 'email' ? 'email' : 'tel'} autoComplete={channel === 'email' ? 'email' : 'tel'} value={email} onChange={event => { setEmail(event.target.value); setValidation('') }} placeholder={channel === 'email' ? 'merchant@example.pk' : '+92 300 1234567'} disabled={request.isPending} aria-invalid={Boolean(validation)} aria-describedby="recovery-input-helper" /></div><p className={validation ? 'recovery-error' : 'recovery-helper'} id="recovery-input-helper">{validation || <><Icon name="schedule" />A six-digit recovery code expires five minutes after it is requested.</>}</p></div>
            <RequestError error={request.error} />
            <aside className="recovery-protection"><Icon name="verified_user" /><div><strong>Protect your merchant account</strong><p>Use the email or mobile number registered with your shop. Keep your recovery code private and never share it with anyone.</p></div></aside>
            <div className="recovery-actions"><button className="recovery-primary" disabled={request.isPending} aria-busy={request.isPending}>{request.isPending ? 'Requesting Recovery Code…' : 'Request Recovery Code'}<Icon name="arrow_forward" /></button><Link className="recovery-back" to="/sign-in"><Icon name="arrow_back" />Back to Merchant Sign In</Link></div>
          </form>
        </>}
        {step === 2 && <RecoveryCodeForm key={codeVersion} email={requestedEmail} pending={request.isPending} preview={preview} deliveryMessage={deliveryMessage} error={request.error} onBack={backToRequest} onResend={() => { if (!preview) request.mutate(requestedEmail) }} onContinue={value => { if (preview) return; setCode(value); setValidation(''); setStep(3) }} />}
        {step === 3 && <form className="recovery-form" onSubmit={submitPassword} noValidate><div className="recovery-field"><label htmlFor="recovery-password">New password</label><input ref={passwordInput} id="recovery-password" type="password" autoComplete="new-password" value={password} onChange={event => { setPassword(event.target.value); setValidation('') }} aria-invalid={Boolean(validation) && passwordErrorField === 'password'} aria-describedby={validation && passwordErrorField === 'password' ? 'recovery-password-error' : undefined} /></div><div className="recovery-field"><label htmlFor="recovery-confirm-password">Confirm new password</label><input ref={confirmPasswordInput} id="recovery-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setValidation('') }} aria-invalid={Boolean(validation) && passwordErrorField === 'confirm'} aria-describedby={validation && passwordErrorField === 'confirm' ? 'recovery-password-error' : undefined} /></div>{validation && <p id="recovery-password-error" className="recovery-error" role="alert">{validation}</p>}<RequestError error={reset.error} /><button className="recovery-primary" disabled={reset.isPending}>{reset.isPending ? 'Updating password…' : 'Set new password'}<Icon name="arrow_forward" /></button><button type="button" className="recovery-back" disabled={reset.isPending} onClick={() => { setStep(2); setPassword(''); setConfirmPassword(''); setCode(''); setValidation(''); reset.reset() }}><Icon name="arrow_back" />Back to code entry</button></form>}
        {step === 4 && <Link className="recovery-primary" to="/sign-in">Sign In to Merchant Portal<Icon name="arrow_forward" /></Link>}
      </div>
    </section></main>
    <AuthFooter />
    <dialog className="information-dialog" ref={dialog} aria-labelledby="recovery-notice-title" onClick={event => { if (event.target === dialog.current) dialog.current.close() }}><h2 id="recovery-notice-title">{info[notice][0]}</h2><p>{info[notice][1]}</p><button className="primary-action" onClick={() => dialog.current?.close()}>Close</button></dialog>
  </div>
}
import { ToastMessage } from '../components/Toast';
