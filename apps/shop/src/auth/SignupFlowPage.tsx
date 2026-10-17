import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, CircleHelp, CloudUpload, ContactRound, Eye, EyeOff, Info, LockKeyhole, MapPin, Navigation, ShieldCheck, Store, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, merchantApi } from './lib/api'
import { captureSession, isLoggedIn, sessionGenerationIsCurrent } from '../lib/api'
import { getSession, saveSession, type MerchantSession } from './lib/session'
import { AuthFooter, AuthHeader } from './AuthChrome'
import GooglePinMap from './GooglePinMap'
import ShopMapPicker from '../components/ShopMapPicker'
import GoogleSignIn from './GoogleSignIn'
import './signup-flow.css'

const ownerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  channel: z.literal('mobile'),
  contact: z.string().trim().min(1, 'Enter your contact details.'),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/\d/, 'Include at least one number.'),
  authorized: z.boolean().refine(value => value, 'Confirm that you are authorized to register this shop.'),
}).superRefine((values, context) => {
  const valid = /^(?:\+?92|0)?3\d{9}$/.test(values.contact.replace(/[\s-]/g, ''))
  if (!valid) context.addIssue({ code: 'custom', path: ['contact'], message: 'Enter a valid Pakistani mobile number.' })
})
type OwnerValues = z.infer<typeof ownerSchema>

const shopSchema = z.object({
  cnic: z.string().regex(/^\d{5}-?\d{7}-?\d$/, 'Enter the 13 digits on your CNIC.'),
  shopName: z.string().trim().min(1, 'Enter your shop name.'),
  shopContact: z.string().trim().min(1, 'Enter your shop contact number.').refine(value => /^(?:\+?92|0)?3\d{9}$/.test(value.replace(/[\s-]/g, '')), 'Enter a valid Pakistani mobile number.'),
  businessType: z.string().min(1, 'Choose a business type.'),
  address: z.string().trim().min(1, 'Enter the written shop address.'),
  serviceRadiusKm: z.number().min(0.5, 'Choose at least 0.5 km.').max(50, 'Choose no more than 50 km.'),
  deliveryFeeRupees: z.number().min(0, 'Enter zero or a higher amount.').max(21474836, 'Enter a smaller amount.'),
  minimumOrderRupees: z.number().min(0, 'Enter zero or a higher amount.').max(21474836, 'Enter a smaller amount.'),
})
type ShopValues = z.infer<typeof shopSchema>

type Notice = 'help' | 'map'
const notices: Record<Notice, { title: string; body: string }> = {
  help: { title: 'Merchant help', body: 'Complete both steps to create a merchant account and shop. If you already have an account, sign in and return to onboarding to finish an interrupted shop setup.' },
  map: { title: 'Choose the shop entrance', body: 'Choose the shop entrance on the map, use device location, or enter coordinates. Check the pin before saving; device position alone may not be the entrance.' },
}
const googleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()) &&
  (import.meta.env.DEV || Boolean(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim()))

function SignupProgress({ step }: { step: 1 | 2 }) {
  return <div className="signup-progress" aria-label={`Step ${step} of 2`}>
    <div className="signup-progress-title">
      <div><span className="signup-step-tag">Step {step} of 2</span><span className="signup-progress-dot">·</span><span>{step === 1 ? 'Account & Security' : 'Shop & Identity'}</span></div>
      <div className="signup-activation"><BadgeCheck size={17} />One-month trial · start immediately</div>
    </div>
    <h1>{step === 1 ? 'Owner Details & Credentials' : 'Tell Us About Your Shop'}</h1>
    <p>{step === 1 ? 'Create your account and start a one-month trial. No admin approval needed.' : 'Add your shop details and location. Your shop starts active; access continues after the trial unless admin disables it.'}</p>
    <div className="signup-progress-grid">
      <div className="signup-progress-item current"><div className="signup-progress-bar" /><div className="signup-progress-caption"><span><span className="signup-progress-number">{step === 2 ? <Check size={12} /> : '1'}</span>Owner details</span><small>{step === 2 ? 'Details entered' : 'In progress'}</small></div></div>
      <div className={'signup-progress-item' + (step === 2 ? ' current' : '')}><div className="signup-progress-bar" /><div className="signup-progress-caption"><span><span className="signup-progress-number">2</span>Shop & identity</span><small>{step === 2 ? 'In progress' : 'Upcoming'}</small></div></div>
    </div>
  </div>
}

export default function SignupFlowPage() {
  const navigate = useNavigate()
  useEffect(() => { if (isLoggedIn()) navigate('/workspace', { replace: true }) }, [navigate])
  const [step, setStep] = useState<1 | 2>(() => getSession() ? 2 : 1)
  const [googleToken, setGoogleToken] = useState<string | null>(null)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [notice, setNotice] = useState<Notice>('help')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [latitudeError, setLatitudeError] = useState('')
  const [longitudeError, setLongitudeError] = useState('')
  const [locationPending, setLocationPending] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [locationError, setLocationError] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [verificationDeliveryMessage, setVerificationDeliveryMessage] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [identityPhoto, setIdentityPhoto] = useState<File | null>(null)
  const [identityPhotoError, setIdentityPhotoError] = useState('')
  const [pendingIdentityToken, setPendingIdentityToken] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const noticeTrigger = useRef<HTMLElement | null>(null)
  const mapTrigger = useRef<HTMLButtonElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const latitudeInput = useRef<HTMLInputElement>(null)
  const longitudeInput = useRef<HTMLInputElement>(null)
  const ownerForm = useForm<OwnerValues>({ resolver: zodResolver(ownerSchema), defaultValues: { firstName: '', lastName: '', channel: 'mobile', contact: '', email: '', password: '', authorized: false } })
  const shopForm = useForm<ShopValues>({ resolver: zodResolver(shopSchema), defaultValues: { cnic: '', shopName: '', shopContact: '', businessType: 'kiryana', address: '', serviceRadiusKm: 5, deliveryFeeRupees: 0, minimumOrderRupees: 0 } })

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])
  useLayoutEffect(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [step])

  function showNotice(value: Notice) { noticeTrigger.current = document.activeElement as HTMLElement; setNotice(value); dialog.current?.showModal() }
  function selectPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setPhotoError('Choose a JPG, PNG, or WEBP image up to 5 MB.'); return }
    setPhotoError('')
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }
  function selectIdentityPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setIdentityPhotoError('Choose a JPG, PNG, or WebP image up to 10 MB.')
      return
    }
    setIdentityPhoto(file)
    setIdentityPhotoError('')
  }

  function useDeviceLocation() {
    const origin = captureSession()
    setLocationError('')
    setLocationMessage('')
    if (window.isSecureContext === false) {
      setLocationError('Device location requires HTTPS or localhost. Open the app at http://localhost:5174 or select the entrance on the map.')
      return
    }
    if (!navigator.geolocation) {
      setLocationError('This browser does not provide device location. Select the entrance on the map or enter coordinates below.')
      return
    }
    setLocationPending(true)
    setLocationMessage('Finding your device location…')
    const acceptPosition = (position: GeolocationPosition) => {
      if (!sessionGenerationIsCurrent(origin)) return
      setLatitude(position.coords.latitude.toFixed(6))
      setLongitude(position.coords.longitude.toFixed(6))
      setLatitudeError('')
      setLongitudeError('')
      setRequestError('')
      setLocationPending(false)
      setLocationMessage(Number.isFinite(position.coords.accuracy)
        ? `Device location selected (about ${Math.round(position.coords.accuracy)} m accuracy). Check the pin and drag it to your shop entrance if needed.`
        : 'Device location selected. Check the pin and drag it to your shop entrance if needed.')
    }
    const fail = (error: GeolocationPositionError) => {
      if (!sessionGenerationIsCurrent(origin)) return
      setLocationPending(false)
      setLocationMessage('')
      setLocationError(error.code === 1
        ? 'Location access is blocked. Check this site’s location permission and Windows Location services, then retry—or select the entrance on the map.'
        : 'Your browser could not determine a device location. Check Windows Location services and your network, then retry—or select the entrance on the map.')
    }
    const requestApproximate = () => {
      if (!sessionGenerationIsCurrent(origin)) return
      setLocationMessage('Precise GPS is unavailable; trying your approximate device location…')
      try { navigator.geolocation.getCurrentPosition(acceptPosition, fail, { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }) }
      catch { setLocationPending(false); setLocationMessage(''); setLocationError('Device location is unavailable. Select the entrance on the map or enter coordinates below.') }
    }
    try {
      navigator.geolocation.getCurrentPosition(
        acceptPosition,
        error => { if (error.code === 1) fail(error); else requestApproximate() },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    } catch { requestApproximate() }
  }
  async function imageDataUrl() {
    if (!photo) return undefined
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read the selected image.'))
      reader.readAsDataURL(photo)
    })
  }
  async function createShop(session: MerchantSession) {
    if (!session.origin) throw new Error('Your session changed. Refresh this page.')
    const token = session.token
    if (googleToken) {
      await merchantApi.linkGoogle(googleToken, token, session.origin)
      if (!sessionGenerationIsCurrent(session.origin)) return
      setGoogleToken(null)
      setGoogleLinked(true)
    }
    const values = shopForm.getValues()
    const created = await merchantApi.createShop({
      shopName: values.shopName,
      shopContactNumber: values.shopContact,
      businessType: values.businessType,
      shopAddress: values.address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      serviceRadiusKm: values.serviceRadiusKm,
      deliveryFeePaisa: Math.round(values.deliveryFeeRupees * 100),
      minimumOrderValuePaisa: Math.round(values.minimumOrderRupees * 100),
      imageDataUrl: await imageDataUrl(),
    }, token, session.origin)
    setPendingIdentityToken(created.accessToken)
    if (!identityPhoto) throw new Error('Select an image of the shop owner’s ID card.')
    await merchantApi.uploadIdentity(identityPhoto, created.accessToken, captureSession())
    setPendingIdentityToken(null)
    if (captureSession().access === created.accessToken) navigate('/workspace')
  }
  async function submitShop() {
    const origin = captureSession()
    if (!identityPhoto) { setIdentityPhotoError('Select an image of the shop owner’s ID card.'); document.getElementById('shop-identity-photo')?.focus(); return }
    if (pendingIdentityToken) {
      setBusy(true)
      setRequestError('')
      try {
        await merchantApi.uploadIdentity(identityPhoto, pendingIdentityToken, origin)
        setPendingIdentityToken(null)
        if (captureSession().access === pendingIdentityToken) navigate('/workspace')
      } catch (error) { setRequestError(error instanceof ApiError ? error.message : 'ID-card upload failed. Check your connection and retry.') }
      finally { setBusy(false) }
      return
    }
    const invalidLatitude = !latitude.trim() || !Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90
    const invalidLongitude = !longitude.trim() || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180
    setLatitudeError(invalidLatitude ? 'Select a location or enter a latitude from −90 to 90.' : '')
    setLongitudeError(invalidLongitude ? 'Select a location or enter a longitude from −180 to 180.' : '')
    if (invalidLatitude || invalidLongitude) { (invalidLatitude ? latitudeInput : longitudeInput).current?.focus(); return }
    setRequestError('')
    setBusy(true)
    try {
      const session = getSession()
      if (session) { await createShop(session); return }
      const { firstName, lastName, channel, contact, email, password } = ownerForm.getValues()
      const attempt = await merchantApi.startRegistration({ firstName, lastName, channel, contact, email: email || undefined, cnic: shopForm.getValues('cnic'), password })
      if (!sessionGenerationIsCurrent(origin)) return
      setAttemptId(attempt.attemptId)
      setVerificationDeliveryMessage(attempt.message === 'Local test verification ready.'
        ? 'Local test code: 123456. No message was sent.'
        : attempt.message === 'Verification code submitted to WhatsApp.'
          ? 'A code was submitted to WhatsApp. Check the mobile number you entered.'
          : 'Enter the six-digit code sent to your registered contact.')
    } catch (error) {
      if (sessionGenerationIsCurrent(origin)) setRequestError(error instanceof ApiError ? error.message : 'Could not start merchant registration. Please try again.')
    } finally { if (sessionGenerationIsCurrent(origin)) setBusy(false) }
  }
  async function verifyAndCreate() {
    const origin = captureSession()
    if (!attemptId || !/^\d{6}$/.test(code)) { setCodeError('Enter the six-digit verification code.'); document.getElementById('registration-code')?.focus(); return }
    setCodeError('')
    setRequestError('')
    setBusy(true)
    let verified = false
    try {
      const session = await merchantApi.verifyRegistration(attemptId, code)
      if (!sessionGenerationIsCurrent(origin)) return
      verified = true
      saveSession(session)
      setAttemptId(null)
      await createShop(session)
    } catch (error) {
      if (!sessionGenerationIsCurrent(origin)) return
      const message = error instanceof ApiError ? error.message : 'Could not verify or create your shop. Please try again.'
      if (verified) setRequestError(message)
      else { setCodeError(message); document.getElementById('registration-code')?.focus() }
    } finally { if (sessionGenerationIsCurrent(origin)) setBusy(false) }
  }

  return <div className="auth-page signup-page">
    <AuthHeader mainId="signup-main" onHelp={() => showNotice('help')} />
    <main className="signup-main" id="signup-main"><div className="signup-shell">
      <SignupProgress step={step} />
      <div className="signup-card">
        {step === 1 ? <form className="signup-section-stack" onSubmit={ownerForm.handleSubmit(() => { setStep(2); setRequestError('') })} noValidate>
          <section className="signup-block">
            <div className="signup-label-row"><strong>Account holder name <em>*</em></strong><span>Use your legal name</span></div>
            <div className="signup-two-col">
              <div className="signup-field"><label htmlFor="owner-first">First Name</label><input id="owner-first" autoComplete="given-name" placeholder="e.g. Adeel" aria-invalid={Boolean(ownerForm.formState.errors.firstName)} aria-describedby={ownerForm.formState.errors.firstName ? 'owner-first-error' : undefined} {...ownerForm.register('firstName')} />{ownerForm.formState.errors.firstName && <small className="signup-field-error" id="owner-first-error">{ownerForm.formState.errors.firstName.message}</small>}</div>
              <div className="signup-field"><label htmlFor="owner-last">Last Name</label><input id="owner-last" autoComplete="family-name" placeholder="e.g. Akram" aria-invalid={Boolean(ownerForm.formState.errors.lastName)} aria-describedby={ownerForm.formState.errors.lastName ? 'owner-last-error' : undefined} {...ownerForm.register('lastName')} />{ownerForm.formState.errors.lastName && <small className="signup-field-error" id="owner-last-error">{ownerForm.formState.errors.lastName.message}</small>}</div>
            </div>
          </section>

          <section className="signup-block signup-soft-panel">
            <div className="signup-label-row"><strong>Contact details</strong><span>We verify your mobile number with WhatsApp</span></div>
            <div className="signup-field">
              <label htmlFor="owner-contact">Mobile number <em>*</em></label>
              <div className="signup-contact-row"><span className="signup-prefix"><b>PK</b></span><input id="owner-contact" type="tel" autoComplete="tel-national" placeholder="0300 1234567" aria-invalid={Boolean(ownerForm.formState.errors.contact)} aria-describedby="owner-contact-help" {...ownerForm.register('contact')} /></div>
              {ownerForm.formState.errors.contact ? <small className="signup-field-error" id="owner-contact-help">{ownerForm.formState.errors.contact.message}</small> : <small className="signup-help" id="owner-contact-help"><ShieldCheck size={15} />Use a number that can receive your verification code.</small>}
            </div>
            <div className="signup-field signup-secondary-contact"><label htmlFor="owner-email">Email address <span className="signup-optional">(optional)</span></label><input id="owner-email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(ownerForm.formState.errors.email)} aria-describedby={ownerForm.formState.errors.email ? 'owner-email-error' : 'owner-email-help'} {...ownerForm.register('email')} />{ownerForm.formState.errors.email ? <small className="signup-field-error" id="owner-email-error">{ownerForm.formState.errors.email.message}</small> : <small className="signup-help" id="owner-email-help">We won’t use email for verification until email delivery is available.</small>}</div>
          </section>

          <section className="signup-block">
            <div className="signup-label-row"><label htmlFor="owner-password">Password <em>*</em></label><span>For merchant sign-in</span></div>
            <div className="signup-input-icon"><LockKeyhole size={20} /><input id="owner-password" type={reveal ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter a secure password" aria-invalid={Boolean(ownerForm.formState.errors.password)} aria-describedby="owner-password-help" {...ownerForm.register('password')} /><button type="button" aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            {ownerForm.formState.errors.password ? <small className="signup-field-error" id="owner-password-help">{ownerForm.formState.errors.password.message}</small> : <small className="signup-help" id="owner-password-help"><BadgeCheck size={15} />At least 8 characters with letters and numbers.</small>}
          </section>

          <div className="signup-terms"><label><input type="checkbox" aria-invalid={Boolean(ownerForm.formState.errors.authorized)} aria-describedby={ownerForm.formState.errors.authorized ? 'owner-authorization-error' : undefined} {...ownerForm.register('authorized')} /><span>I confirm that I am authorized to register this shop.</span></label>{ownerForm.formState.errors.authorized && <small className="signup-field-error" id="owner-authorization-error">{ownerForm.formState.errors.authorized.message}</small>}{import.meta.env.DEV && <p className="signup-terms-note">Merchant terms and privacy policy are not yet published. Use test details only.</p>}</div>
          <div className="signup-actions"><Link to="/sign-in"><ArrowLeft size={18} />Already have an account? Sign In</Link><button className="signup-primary" type="submit">Continue to Shop Details (Step 2)<ArrowRight size={20} /></button></div>
          <div className="signup-google-divider"><span>or continue with</span></div>
          <GoogleSignIn signup disabled={busy} onCredential={async token => { setGoogleToken(token); setGoogleLinked(false); setRequestError('') }} />
          {googleToken && <p className="signup-google-note" role="status">Google selected. Complete your owner details and mobile verification to link it.</p>}
          {googleToken && <button type="button" className="signup-back" onClick={() => setGoogleToken(null)}>Remove selected Google account</button>}
        </form> : <form className="signup-section-stack" onSubmit={event => { void shopForm.handleSubmit(submitShop)(event) }} noValidate>
          <section className="signup-block">
            <div className="signup-label-row"><label htmlFor="shop-name">Shop Name (Storefront Display) <em>*</em></label><span>Public identity for customer orders</span></div>
            <div className="signup-input-icon"><Store size={20} /><input id="shop-name" placeholder="e.g. Adeel Kiryana & General Store" aria-invalid={Boolean(shopForm.formState.errors.shopName)} aria-describedby={shopForm.formState.errors.shopName ? 'shop-name-error' : undefined} {...shopForm.register('shopName')} /></div>
            {shopForm.formState.errors.shopName && <small className="signup-field-error" id="shop-name-error">{shopForm.formState.errors.shopName.message}</small>}
            <div className="signup-two-col signup-shop-pair">
              <div className="signup-field"><div className="signup-label-row"><label htmlFor="shop-contact">Shop Contact Number <em>*</em></label><button type="button" className="signup-use-mobile" onClick={() => shopForm.setValue('shopContact', ownerForm.getValues('contact'), { shouldValidate: true })}>Use my mobile number</button></div><div className="signup-contact-row"><span className="signup-prefix"><b>PK</b></span><input id="shop-contact" type="tel" placeholder="0300 1234567" aria-invalid={Boolean(shopForm.formState.errors.shopContact)} aria-describedby={shopForm.formState.errors.shopContact ? 'shop-contact-help' : 'shop-contact-format'} {...shopForm.register('shopContact')} /></div>{shopForm.formState.errors.shopContact ? <small className="signup-field-error" id="shop-contact-help">{shopForm.formState.errors.shopContact.message}</small> : <small className="signup-help" id="shop-contact-format">Enter 03… or +92…</small>}</div>
              <div className="signup-field"><label htmlFor="shop-type">Primary Business Type <em>*</em></label><div className="signup-select"><select id="shop-type" {...shopForm.register('businessType')}><option value="kiryana">Grocery / General Store (Kiryana)</option><option value="vegetables">Fruit & Vegetables (Sabzi/Phal)</option><option value="dairy">Fresh Dairy & Milk (Doodh/Dahi)</option><option value="bakery">Bakery & Confectionery</option><option value="meat">Meat & Poultry (Gosht)</option><option value="cleaning">Household Essentials & Cleaning</option><option value="other">Other Neighbourhood Retail</option></select><ChevronDown size={19} /></div></div>
            </div>
          </section>

          <section className="signup-block signup-soft-panel signup-address">
            <div className="signup-label-row"><label htmlFor="shop-address">Physical Address & Precise Map Location <em>*</em></label><span className="signup-mini-badge">GPS & Entrance Pin</span></div>
            <textarea id="shop-address" rows={2} placeholder="Unit/Shop #, Market/Plaza, Street Number, Area/Sector, City" aria-invalid={Boolean(shopForm.formState.errors.address)} aria-describedby="shop-address-help" {...shopForm.register('address')} />
            {shopForm.formState.errors.address ? <small className="signup-field-error" id="shop-address-help">{shopForm.formState.errors.address.message}</small> : <small className="signup-help" id="shop-address-help">Include the shop number, market, street, area, city, and useful landmarks.</small>}
            <div className="signup-map-heading"><span>Entrance GPS Pin</span><span>{latitude && longitude ? `${latitude}, ${longitude}` : 'Location not selected'}</span></div>
            <p className="signup-help">Choose the shop entrance on the map, use device location, or enter coordinates.</p>
            <div className="signup-map">
              {googleMapsConfigured && !mapFailed ? <GooglePinMap key={mapAttempt} latitude={latitude} longitude={longitude} onError={() => setMapFailed(true)} onSelect={point => { setLatitude(point.lat.toFixed(6)); setLongitude(point.lng.toFixed(6)); setLatitudeError(''); setLongitudeError(''); setRequestError(''); setLocationError(''); setLocationMessage('') }} /> :
                <div className="signup-map-empty"><MapPin size={28} aria-hidden="true" /><strong>{mapFailed ? 'Google Maps could not load' : 'Google map preview unavailable'}</strong><p>{mapFailed ? 'Check that the Maps key allows this site, then retry. You can also enter coordinates below.' : 'Open the Google map picker, use device location, or enter coordinates below.'}</p></div>}
              <div className="signup-map-actions">
                <button ref={mapTrigger} type="button" onClick={() => setMapOpen(true)}><MapPin size={16} />Open map picker</button>
                {mapFailed && googleMapsConfigured && <button type="button" onClick={() => { setMapFailed(false); setMapAttempt(value => value + 1) }}>Retry map</button>}
                <button type="button" onClick={() => showNotice('map')}><CircleHelp size={16} />Map help</button>
                <button type="button" onClick={useDeviceLocation} disabled={locationPending}><Navigation size={16} />{locationPending ? 'Finding location…' : 'Use device location'}</button>
              </div>
            </div>
            {mapOpen && <ShopMapPicker initial={latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) ? { latitude: Number(latitude), longitude: Number(longitude) } : null} returnFocusTo={mapTrigger.current} onClose={() => setMapOpen(false)} onConfirm={point => { setLatitude(point.latitude.toFixed(6)); setLongitude(point.longitude.toFixed(6)); setLatitudeError(''); setLongitudeError(''); setLocationError(''); setLocationMessage('Shop entrance pin selected. Check the written address before saving.'); setMapOpen(false) }} />}
            {locationMessage && <small className="signup-location-status" role="status">{locationMessage}</small>}
            {locationError && <small className="signup-location-error" role="alert">{locationError}</small>}
            <div className="signup-two-col signup-coordinate-fields"><div className="signup-field"><label htmlFor="shop-latitude">Latitude</label><input ref={latitudeInput} id="shop-latitude" inputMode="decimal" placeholder="31.520370" value={latitude} onChange={event => { setLatitude(event.target.value); setLatitudeError(''); setLocationError(''); setLocationMessage('') }} aria-invalid={Boolean(latitudeError)} aria-describedby={latitudeError ? 'shop-latitude-error' : undefined} />{latitudeError && <small className="signup-field-error" id="shop-latitude-error">{latitudeError}</small>}</div><div className="signup-field"><label htmlFor="shop-longitude">Longitude</label><input ref={longitudeInput} id="shop-longitude" inputMode="decimal" placeholder="74.358749" value={longitude} onChange={event => { setLongitude(event.target.value); setLongitudeError(''); setLocationError(''); setLocationMessage('') }} aria-invalid={Boolean(longitudeError)} aria-describedby={longitudeError ? 'shop-longitude-error' : undefined} />{longitudeError && <small className="signup-field-error" id="shop-longitude-error">{longitudeError}</small>}</div></div>
            <small className="signup-help"><Info size={15} />Select a point on the Google map or drag its pin. You can also use device location or enter coordinates.</small>
          </section>

          <section className="signup-block signup-settings">
            <div className="signup-label-row"><strong>Shop settings</strong><span>You can change these later</span></div>
            <div className="signup-three-col">
              <div className="signup-field"><label htmlFor="shop-radius">Delivery radius (km)</label><input id="shop-radius" type="number" inputMode="decimal" min="0.5" max="50" step="0.5" aria-invalid={Boolean(shopForm.formState.errors.serviceRadiusKm)} aria-describedby={shopForm.formState.errors.serviceRadiusKm ? 'shop-radius-error' : 'shop-radius-help'} {...shopForm.register('serviceRadiusKm', { valueAsNumber: true })} />{shopForm.formState.errors.serviceRadiusKm ? <small className="signup-field-error" id="shop-radius-error">{shopForm.formState.errors.serviceRadiusKm.message}</small> : <small className="signup-help" id="shop-radius-help">0.5 to 50 km from your shop</small>}</div>
              <div className="signup-field"><label htmlFor="shop-delivery-fee">Delivery charge (Rs)</label><input id="shop-delivery-fee" type="number" inputMode="decimal" min="0" step="0.01" aria-invalid={Boolean(shopForm.formState.errors.deliveryFeeRupees)} aria-describedby={shopForm.formState.errors.deliveryFeeRupees ? 'shop-delivery-fee-error' : 'shop-delivery-fee-help'} {...shopForm.register('deliveryFeeRupees', { valueAsNumber: true })} />{shopForm.formState.errors.deliveryFeeRupees ? <small className="signup-field-error" id="shop-delivery-fee-error">{shopForm.formState.errors.deliveryFeeRupees.message}</small> : <small className="signup-help" id="shop-delivery-fee-help">Saved for your shop; checkout currently calculates delivery by distance.</small>}</div>
              <div className="signup-field"><label htmlFor="shop-minimum-order">Minimum order (Rs)</label><input id="shop-minimum-order" type="number" inputMode="decimal" min="0" step="0.01" aria-invalid={Boolean(shopForm.formState.errors.minimumOrderRupees)} aria-describedby={shopForm.formState.errors.minimumOrderRupees ? 'shop-minimum-order-error' : 'shop-minimum-order-help'} {...shopForm.register('minimumOrderRupees', { valueAsNumber: true })} />{shopForm.formState.errors.minimumOrderRupees ? <small className="signup-field-error" id="shop-minimum-order-error">{shopForm.formState.errors.minimumOrderRupees.message}</small> : <small className="signup-help" id="shop-minimum-order-help">Set 0 for no minimum.</small>}</div>
            </div>
          </section>

          <section className="signup-block signup-identity">
            <div className="signup-label-row"><strong>Owner identity</strong><span>Private verification details</span></div>
            <div className="signup-field signup-identity-number">
              <div className="signup-label-row"><label htmlFor="shop-cnic">National Identity Card (CNIC) <em>*</em></label><span className="signup-mini-badge">13 digits</span></div>
              <div className="signup-input-icon"><ContactRound size={20} /><input id="shop-cnic" inputMode="numeric" maxLength={15} placeholder="35201-XXXXXXX-X" aria-invalid={Boolean(shopForm.formState.errors.cnic)} aria-describedby={shopForm.formState.errors.cnic ? 'shop-cnic-error' : undefined} {...shopForm.register('cnic')} /></div>
              {shopForm.formState.errors.cnic && <small className="signup-field-error" id="shop-cnic-error">{shopForm.formState.errors.cnic.message}</small>}
            </div>
            <div className="signup-label-row"><label htmlFor="shop-identity-photo">CNIC image <em>*</em></label><span>JPG, PNG or WebP</span></div>
            <input id="shop-identity-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={Boolean(identityPhotoError)} aria-describedby={identityPhotoError ? 'shop-identity-error' : 'shop-identity-help'} onChange={event => selectIdentityPhoto(event.target.files?.[0])} />
            {identityPhotoError ? <small className="signup-field-error" id="shop-identity-error">{identityPhotoError}</small> : <small className="signup-help" id="shop-identity-help">JPG, PNG or WebP, up to 10 MB. Stored privately; never shown on your storefront.</small>}
            {identityPhoto && <p className="signup-selected-file">Selected: {identityPhoto.name}</p>}
            <div className="signup-privacy"><span><ShieldCheck size={21} /></span><div><strong>Your identity details</strong><p>Your CNIC number and image are not displayed on the public shop profile.</p></div></div>
          </section>

          <section className="signup-block">
            <div className="signup-label-row"><strong>Shop Storefront Photo <span className="signup-optional">(Optional)</span></strong><span className="signup-mini-badge">Optional · Not Required</span></div>
            <div className="signup-photo-grid"><div className="signup-photo-preview">{photoUrl ? <img src={photoUrl} alt="Selected shop storefront preview" /> : <><img src="/images/merchant-market.jpg" alt="Example neighbourhood grocery interior" /><span>Storefront Sample Preview</span></>}</div><div className="signup-photo-controls"><div className="signup-photo-title"><span><CloudUpload size={22} /></span><div><strong>Upload storefront board or shelf view</strong><small>Supports JPG, PNG, WEBP up to 5 MB</small></div></div><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="signup-file-input" tabIndex={-1} aria-label="Shop storefront photo" onChange={event => selectPhoto(event.target.files?.[0])} /><div className="signup-photo-buttons"><button type="button" onClick={() => photoInput.current?.click()}><CloudUpload size={16} />Upload Store Photo</button>{photo && <button type="button" onClick={() => { setPhoto(null); setPhotoUrl(null); if (photoInput.current) photoInput.current.value = '' }}>Remove Photo</button>}</div><p>{photo ? `Selected: ${photo.name}` : 'Add a photo of your shop banner or counter, or skip this step.'}</p>{photoError && <small className="signup-field-error">{photoError}</small>}</div></div>
          </section>

          <div className="signup-actions signup-shop-actions">{getSession()?.role !== 1 && !pendingIdentityToken && <button type="button" className="signup-back" onClick={() => setStep(1)}><ArrowLeft size={18} />Back to Owner Details (Step 1)</button>}<div><button type="submit" className="signup-primary" disabled={busy || Boolean(attemptId)}>{busy ? 'Working…' : pendingIdentityToken ? 'Retry ID-card upload' : 'Create Shop & Open Workspace'}<ArrowRight size={20} /></button></div></div>
          {!attemptId && <p className="signup-end-note"><CircleHelp size={16} />{getSession() ? 'Your account is verified. Continue to save your shop.' : 'After you submit, verify your registered mobile number to finish setting up your shop.'}</p>}
          {getSession() && <GoogleSignIn signup disabled={busy} onCredential={async token => { setGoogleToken(token); setGoogleLinked(false); setRequestError('') }} />}
          {googleLinked && <p role="status">Google is linked to your account.</p>}
          {googleToken && <button type="button" className="signup-back" disabled={busy} onClick={() => { setGoogleToken(null); setRequestError('') }}>Continue without linking Google</button>}
          {attemptId && <div className="signup-verification" role="group" aria-label="Verify merchant contact"><strong>Verify your mobile number</strong><p>{verificationDeliveryMessage} Enter the code to create your owner account, then we will save your shop.</p><label htmlFor="registration-code">Verification code</label><input id="registration-code" className="field-control" type="text" name="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" disabled={busy} aria-invalid={!!codeError} aria-describedby={codeError ? 'registration-code-error' : undefined} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setCodeError('') }} />{codeError && <small className="signup-field-error" id="registration-code-error">{codeError}</small>}<button type="button" className="signup-primary" disabled={busy} onClick={verifyAndCreate}>{busy ? 'Verifying…' : 'Verify & Create Shop'}</button></div>}
          {requestError && <ToastMessage>{requestError}</ToastMessage>}
        </form>}
      </div>
    </div></main>
    <AuthFooter />
    <dialog ref={dialog} className="information-dialog" aria-labelledby="signup-information-title" aria-describedby="signup-information-description" onClose={() => noticeTrigger.current?.focus()} onClick={event => { if (event.target === dialog.current) dialog.current.close() }}><div className="dialog-heading"><h2 id="signup-information-title">{notices[notice].title}</h2><button type="button" className="icon-button" aria-label="Close information" onClick={() => dialog.current?.close()}><X size={20} /></button></div><p id="signup-information-description">{notices[notice].body}</p><button type="button" className="primary-action" onClick={() => dialog.current?.close()}>Close</button></dialog>
  </div>
}
import { ToastMessage } from '../components/Toast';
