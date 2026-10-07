import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, CircleHelp, CloudUpload, ContactRound, Eye, EyeOff, Info, LockKeyhole, Mail, MapPin, Navigation, ShieldCheck, Smartphone, Store, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, merchantApi } from './lib/api'
import { getSession, saveSession } from './lib/session'
import { AuthFooter, AuthHeader } from './AuthChrome'
import GooglePinMap from './GooglePinMap'
import './signup-flow.css'

const ownerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  channel: z.enum(['mobile', 'email']),
  contact: z.string().trim().min(1, 'Enter your contact details.'),
  cnic: z.string().regex(/^\d{5}-?\d{7}-?\d$/, 'Enter the 13 digits on your CNIC.'),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/\d/, 'Include at least one number.'),
  authorized: z.boolean().refine(value => value, 'Confirm that you are authorized to register this shop.'),
}).superRefine((values, context) => {
  const valid = values.channel === 'email'
    ? z.email().safeParse(values.contact).success
    : /^(?:\+?92|0)?3\d{9}$/.test(values.contact.replace(/[\s-]/g, ''))
  if (!valid) context.addIssue({ code: 'custom', path: ['contact'], message: values.channel === 'email' ? 'Enter a valid email address.' : 'Enter a valid Pakistani mobile number.' })
})
type OwnerValues = z.infer<typeof ownerSchema>

const shopSchema = z.object({
  shopName: z.string().trim().min(1, 'Enter your shop name.'),
  shopContact: z.string().trim().min(1, 'Enter your shop contact number.').refine(value => /^(?:\+?92|0)?3\d{9}$/.test(value.replace(/[\s-]/g, '')), 'Enter a valid Pakistani mobile number.'),
  businessType: z.string().min(1, 'Choose a business type.'),
  address: z.string().trim().min(1, 'Enter the written shop address.'),
})
type ShopValues = z.infer<typeof shopSchema>

type Notice = 'google' | 'help' | 'map'
const notices: Record<Notice, { title: string; body: string }> = {
  google: { title: 'Google sign-up is not available yet', body: 'Use your mobile number or email address to create a merchant account. Google registration will be added later.' },
  help: { title: 'Merchant help', body: 'Complete both steps to create a merchant account and shop. If you already have an account, sign in and return to onboarding to finish an interrupted shop setup.' },
  map: { title: 'Set your shop entrance pin', body: 'When Google Maps is configured, click the map or drag its marker. You can also enter coordinates below or use your device location while standing at the entrance.' },
}
const googleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()) &&
  (import.meta.env.DEV || Boolean(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim()))

function SignupProgress({ step }: { step: 1 | 2 }) {
  return <div className="signup-progress" aria-label={`Step ${step} of 2`}>
    <div className="signup-progress-title">
      <div><span className="signup-step-tag">Step {step} of 2</span><span className="signup-progress-dot">·</span><span>{step === 1 ? 'Account & Security' : 'Shop Profile & Location'}</span></div>
      <div className="signup-activation"><BadgeCheck size={17} />Merchant onboarding</div>
    </div>
    <h1>{step === 1 ? 'Owner Details & Credentials' : 'Tell Us About Your Shop'}</h1>
    <p>{step === 1 ? 'Enter the owner details that will be needed for merchant registration.' : 'Add your shop details, written address, and location information.'}</p>
    <div className="signup-progress-grid">
      <div className="signup-progress-item current"><div className="signup-progress-bar" /><div className="signup-progress-caption"><span><span className="signup-progress-number">{step === 2 ? <Check size={12} /> : '1'}</span>Owner details</span><small>{step === 2 ? 'Details entered' : 'In progress'}</small></div></div>
      <div className={'signup-progress-item' + (step === 2 ? ' current' : '')}><div className="signup-progress-bar" /><div className="signup-progress-caption"><span><span className="signup-progress-number">2</span>Shop details & location</span><small>{step === 2 ? 'In progress' : 'Upcoming'}</small></div></div>
    </div>
  </div>
}

export default function SignupFlowPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(() => getSession()?.role === 1 ? 2 : 1)
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
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [verificationDeliveryMessage, setVerificationDeliveryMessage] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const latitudeInput = useRef<HTMLInputElement>(null)
  const longitudeInput = useRef<HTMLInputElement>(null)
  const ownerForm = useForm<OwnerValues>({ resolver: zodResolver(ownerSchema), defaultValues: { firstName: '', lastName: '', channel: 'mobile', contact: '', cnic: '', password: '', authorized: false } })
  const shopForm = useForm<ShopValues>({ resolver: zodResolver(shopSchema), defaultValues: { shopName: '', shopContact: '', businessType: 'kiryana', address: '' } })
  const channel = useWatch({ control: ownerForm.control, name: 'channel' })

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])
  useLayoutEffect(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [step])

  function showNotice(value: Notice) { setNotice(value); dialog.current?.showModal() }
  function changeChannel(value: 'mobile' | 'email') { ownerForm.setValue('channel', value); ownerForm.setValue('contact', ''); ownerForm.clearErrors('contact') }
  function selectPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setPhotoError('Choose a JPG, PNG, or WEBP image up to 5 MB.'); return }
    setPhotoError('')
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  function useDeviceLocation() {
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
      setLocationPending(false)
      setLocationMessage('')
      setLocationError(error.code === 1
        ? 'Location access is blocked. Check this site’s location permission and Windows Location services, then retry—or select the entrance on the map.'
        : 'Your browser could not determine a device location. Check Windows Location services and your network, then retry—or select the entrance on the map.')
    }
    const requestApproximate = () => {
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
  async function createShop(token: string) {
    const values = shopForm.getValues()
    await merchantApi.createShop({
      shopName: values.shopName,
      shopContactNumber: values.shopContact,
      businessType: values.businessType,
      shopAddress: values.address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      imageDataUrl: await imageDataUrl(),
    }, token)
    navigate('/workspace')
  }
  async function submitShop() {
    const invalidLatitude = !latitude.trim() || !Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90
    const invalidLongitude = !longitude.trim() || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180
    setLatitudeError(invalidLatitude ? 'Select a location or enter a latitude from −90 to 90.' : '')
    setLongitudeError(invalidLongitude ? 'Select a location or enter a longitude from −180 to 180.' : '')
    if (invalidLatitude || invalidLongitude) { (invalidLatitude ? latitudeInput : longitudeInput).current?.focus(); return }
    setRequestError('')
    setBusy(true)
    try {
      const session = getSession()
      if (session?.role === 1) { await createShop(session.token); return }
      const { firstName, lastName, channel, contact, cnic, password } = ownerForm.getValues()
      const attempt = await merchantApi.startRegistration({ firstName, lastName, channel, contact, cnic, password })
      setAttemptId(attempt.attemptId)
      setVerificationDeliveryMessage(attempt.message === 'Local test verification ready.'
        ? 'Local test code: 123456. No message was sent.'
        : attempt.message === 'Verification code submitted to WhatsApp.'
          ? 'A code was submitted to WhatsApp. Check the mobile number you entered.'
          : 'Enter the six-digit code sent to your registered contact.')
    } catch (error) {
      setRequestError(error instanceof ApiError ? error.message : 'Could not start merchant registration. Please try again.')
    } finally { setBusy(false) }
  }
  async function verifyAndCreate() {
    if (!attemptId || !/^\d{6}$/.test(code)) { setCodeError('Enter the six-digit verification code.'); document.getElementById('registration-code')?.focus(); return }
    setCodeError('')
    setRequestError('')
    setBusy(true)
    let verified = false
    try {
      const session = await merchantApi.verifyRegistration(attemptId, code)
      verified = true
      saveSession(session)
      setAttemptId(null)
      await createShop(session.token)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not verify or create your shop. Please try again.'
      if (verified) setRequestError(message)
      else { setCodeError(message); document.getElementById('registration-code')?.focus() }
    } finally { setBusy(false) }
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
            <div className="signup-label-row"><strong>Primary Contact Channel <em>*</em></strong><span>Used for account verification</span></div>
            <div className="signup-channel-switch" role="group" aria-label="Primary Contact Channel"><button type="button" aria-pressed={channel === 'mobile'} onClick={() => changeChannel('mobile')}><Smartphone size={18} />Mobile Number (Recommended)</button><button type="button" aria-pressed={channel === 'email'} onClick={() => changeChannel('email')}><Mail size={18} />Email Address</button></div>
            <div className="signup-field">
              <label htmlFor="owner-contact">{channel === 'mobile' ? 'Mobile Number' : 'Email Address'}</label>
              <div className="signup-contact-row">{channel === 'mobile' && <span className="signup-prefix"><b>PK</b></span>}<input id="owner-contact" type={channel === 'mobile' ? 'tel' : 'email'} autoComplete={channel === 'mobile' ? 'tel-national' : 'email'} placeholder={channel === 'mobile' ? '0300 1234567' : 'merchant@dukaan.pk'} aria-invalid={Boolean(ownerForm.formState.errors.contact)} aria-describedby="owner-contact-help" {...ownerForm.register('contact')} /></div>
              {ownerForm.formState.errors.contact ? <small className="signup-field-error" id="owner-contact-help">{ownerForm.formState.errors.contact.message}</small> : <small className="signup-help" id="owner-contact-help"><ShieldCheck size={15} />{channel === 'mobile' ? 'Enter 03… or +92…; use a number you can access for verification.' : 'Use a mailbox you can access for verification.'}</small>}
            </div>
          </section>

          <section className="signup-block">
            <div className="signup-label-row"><label htmlFor="owner-cnic">National Identity Card (CNIC) <em>*</em></label><span className="signup-mini-badge">13 Digits (Numbers only)</span></div>
            <div className="signup-input-icon"><ContactRound size={20} /><input id="owner-cnic" inputMode="numeric" maxLength={15} placeholder="35201-XXXXXXX-X" aria-invalid={Boolean(ownerForm.formState.errors.cnic)} aria-describedby={ownerForm.formState.errors.cnic ? 'owner-cnic-error' : undefined} {...ownerForm.register('cnic')} /></div>
            {ownerForm.formState.errors.cnic && <small className="signup-field-error" id="owner-cnic-error">{ownerForm.formState.errors.cnic.message}</small>}
            <div className="signup-privacy"><span><ShieldCheck size={21} /></span><div><strong>Your identity details</strong><p>Your CNIC is used for the owner account record, not displayed on the public shop profile.</p></div></div>
          </section>

          <section className="signup-block">
            <div className="signup-label-row"><label htmlFor="owner-password">Account Security Password <em>*</em></label><span>For merchant sign-in</span></div>
            <div className="signup-input-icon"><LockKeyhole size={20} /><input id="owner-password" type={reveal ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter a secure password" aria-invalid={Boolean(ownerForm.formState.errors.password)} aria-describedby="owner-password-help" {...ownerForm.register('password')} /><button type="button" aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            {ownerForm.formState.errors.password ? <small className="signup-field-error" id="owner-password-help">{ownerForm.formState.errors.password.message}</small> : <small className="signup-help" id="owner-password-help"><BadgeCheck size={15} />At least 8 characters with letters and numbers.</small>}
          </section>

          <div className="signup-terms"><label><input type="checkbox" aria-invalid={Boolean(ownerForm.formState.errors.authorized)} aria-describedby={ownerForm.formState.errors.authorized ? 'owner-authorization-error' : undefined} {...ownerForm.register('authorized')} /><span>I confirm that I am authorized to register this shop.</span></label>{ownerForm.formState.errors.authorized && <small className="signup-field-error" id="owner-authorization-error">{ownerForm.formState.errors.authorized.message}</small>}{import.meta.env.DEV && <p className="signup-terms-note">Merchant terms and privacy policy are not yet published. Use test details only.</p>}</div>
          <div className="signup-actions"><Link to="/sign-in"><ArrowLeft size={18} />Already have an account? Sign In</Link><button className="signup-primary" type="submit">Continue to Shop Details (Step 2)<ArrowRight size={20} /></button></div>
          <div className="signup-google-divider"><span>or continue with</span></div>
          <button className="signup-google" type="button" onClick={() => showNotice('google')}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" /></svg>Sign up with Google</button>
          <p className="signup-google-note">Google sign-up is not connected yet. Mobile and CNIC details will still be needed for merchant registration.</p>
        </form> : <form className="signup-section-stack" onSubmit={event => { void shopForm.handleSubmit(submitShop)(event) }} noValidate>
          <section className="signup-block">
            <div className="signup-label-row"><label htmlFor="shop-name">Shop Name (Storefront Display) <em>*</em></label><span>Public identity for customer orders</span></div>
            <div className="signup-input-icon"><Store size={20} /><input id="shop-name" placeholder="e.g. Adeel Kiryana & General Store" aria-invalid={Boolean(shopForm.formState.errors.shopName)} aria-describedby={shopForm.formState.errors.shopName ? 'shop-name-error' : undefined} {...shopForm.register('shopName')} /></div>
            {shopForm.formState.errors.shopName && <small className="signup-field-error" id="shop-name-error">{shopForm.formState.errors.shopName.message}</small>}
            <div className="signup-two-col signup-shop-pair">
              <div className="signup-field"><div className="signup-label-row"><label htmlFor="shop-contact">Shop Contact Number <em>*</em></label><button type="button" className="signup-use-mobile" disabled={channel !== 'mobile'} title={channel !== 'mobile' ? 'Choose a mobile number in Step 1 to copy it here.' : undefined} onClick={() => shopForm.setValue('shopContact', ownerForm.getValues('contact'), { shouldValidate: true })}>Use my mobile number</button></div><div className="signup-contact-row"><span className="signup-prefix"><b>PK</b></span><input id="shop-contact" type="tel" placeholder="0300 1234567" aria-invalid={Boolean(shopForm.formState.errors.shopContact)} aria-describedby={shopForm.formState.errors.shopContact ? 'shop-contact-help' : 'shop-contact-format'} {...shopForm.register('shopContact')} /></div>{shopForm.formState.errors.shopContact ? <small className="signup-field-error" id="shop-contact-help">{shopForm.formState.errors.shopContact.message}</small> : <small className="signup-help" id="shop-contact-format">Enter 03… or +92…</small>}</div>
              <div className="signup-field"><label htmlFor="shop-type">Primary Business Type <em>*</em></label><div className="signup-select"><select id="shop-type" {...shopForm.register('businessType')}><option value="kiryana">Grocery / General Store (Kiryana)</option><option value="vegetables">Fruit & Vegetables (Sabzi/Phal)</option><option value="dairy">Fresh Dairy & Milk (Doodh/Dahi)</option><option value="bakery">Bakery & Confectionery</option><option value="meat">Meat & Poultry (Gosht)</option><option value="cleaning">Household Essentials & Cleaning</option><option value="other">Other Neighbourhood Retail</option></select><ChevronDown size={19} /></div></div>
            </div>
          </section>

          <section className="signup-block signup-soft-panel signup-address">
            <div className="signup-label-row"><label htmlFor="shop-address">Physical Address & Precise Map Location <em>*</em></label><span className="signup-mini-badge">GPS & Entrance Pin</span></div>
            <textarea id="shop-address" rows={2} placeholder="Unit/Shop #, Market/Plaza, Street Number, Area/Sector, City" aria-invalid={Boolean(shopForm.formState.errors.address)} aria-describedby="shop-address-help" {...shopForm.register('address')} />
            {shopForm.formState.errors.address ? <small className="signup-field-error" id="shop-address-help">{shopForm.formState.errors.address.message}</small> : <small className="signup-help" id="shop-address-help">Include the shop number, market, street, area, city, and useful landmarks.</small>}
            <div className="signup-map-heading"><span>Entrance GPS Pin</span><span>{latitude && longitude ? `${latitude}, ${longitude}` : 'Location not selected'}</span></div>
            <div className="signup-map">{googleMapsConfigured ? <GooglePinMap latitude={latitude} longitude={longitude} onSelect={point => { setLatitude(point.lat.toFixed(6)); setLongitude(point.lng.toFixed(6)); setLatitudeError(''); setLongitudeError(''); setRequestError(''); setLocationError(''); setLocationMessage('') }} /> : <div className="signup-map-empty"><MapPin size={28} aria-hidden="true" /><strong>Map preview unavailable</strong><p>Enter coordinates below or use your device location to set your shop entrance.</p></div>}<div className="signup-map-actions">{!googleMapsConfigured && <button type="button" onClick={() => showNotice('map')}><MapPin size={16} />Map setup help</button>}<button type="button" onClick={useDeviceLocation} disabled={locationPending}><Navigation size={16} />{locationPending ? 'Finding Location…' : 'Use Current Device Location'}</button></div></div>
            {locationMessage && <small className="signup-location-status" role="status">{locationMessage}</small>}
            {locationError && <small className="signup-location-error" role="alert">{locationError}</small>}
            <div className="signup-two-col signup-coordinate-fields"><div className="signup-field"><label htmlFor="shop-latitude">Latitude</label><input ref={latitudeInput} id="shop-latitude" inputMode="decimal" placeholder="31.520370" value={latitude} onChange={event => { setLatitude(event.target.value); setLatitudeError(''); setLocationError(''); setLocationMessage('') }} aria-invalid={Boolean(latitudeError)} aria-describedby={latitudeError ? 'shop-latitude-error' : undefined} />{latitudeError && <small className="signup-field-error" id="shop-latitude-error">{latitudeError}</small>}</div><div className="signup-field"><label htmlFor="shop-longitude">Longitude</label><input ref={longitudeInput} id="shop-longitude" inputMode="decimal" placeholder="74.358749" value={longitude} onChange={event => { setLongitude(event.target.value); setLongitudeError(''); setLocationError(''); setLocationMessage('') }} aria-invalid={Boolean(longitudeError)} aria-describedby={longitudeError ? 'shop-longitude-error' : undefined} />{longitudeError && <small className="signup-field-error" id="shop-longitude-error">{longitudeError}</small>}</div></div>
            <small className="signup-help"><Info size={15} />{googleMapsConfigured ? 'Click the Google map or drag the pin to the shop entrance. Device location and manual coordinates also work.' : 'Google Maps will appear after you configure its browser key. For now, use device location or enter exact coordinates manually.'}</small>
          </section>

          <section className="signup-block">
            <div className="signup-label-row"><strong>Shop Storefront Photo <span className="signup-optional">(Optional)</span></strong><span className="signup-mini-badge">Optional · Not Required</span></div>
            <div className="signup-photo-grid"><div className="signup-photo-preview">{photoUrl ? <img src={photoUrl} alt="Selected shop storefront preview" /> : <><img src="/images/merchant-market.jpg" alt="Example neighbourhood grocery interior" /><span>Storefront Sample Preview</span></>}</div><div className="signup-photo-controls"><div className="signup-photo-title"><span><CloudUpload size={22} /></span><div><strong>Upload storefront board or shelf view</strong><small>Supports JPG, PNG, WEBP up to 5 MB</small></div></div><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="signup-file-input" tabIndex={-1} aria-label="Shop storefront photo" onChange={event => selectPhoto(event.target.files?.[0])} /><div className="signup-photo-buttons"><button type="button" onClick={() => photoInput.current?.click()}><CloudUpload size={16} />Upload Store Photo</button>{photo && <button type="button" onClick={() => { setPhoto(null); setPhotoUrl(null); if (photoInput.current) photoInput.current.value = '' }}>Remove Photo</button>}</div><p>{photo ? `Selected: ${photo.name}` : 'Add a photo of your shop banner or counter, or skip this step.'}</p>{photoError && <small className="signup-field-error">{photoError}</small>}</div></div>
          </section>

          <div className="signup-actions signup-shop-actions">{getSession()?.role !== 1 && <button type="button" className="signup-back" onClick={() => setStep(1)}><ArrowLeft size={18} />Back to Owner Details (Step 1)</button>}<div><button type="submit" className="signup-primary" disabled={busy || Boolean(attemptId)}>{busy ? 'Working…' : 'Create Shop & Open Workspace'}<ArrowRight size={20} /></button></div></div>
          {!attemptId && <p className="signup-end-note"><CircleHelp size={16} />After you submit, enter the verification code provided by the merchant service. Google sign-up remains unavailable.</p>}
          {attemptId && <div className="signup-verification" role="group" aria-label="Verify merchant contact"><strong>Verify your {ownerForm.getValues('channel') === 'email' ? 'email' : 'mobile number'}</strong><p>{verificationDeliveryMessage} Enter the code to create your owner account, then we will save your shop.</p><label htmlFor="registration-code">Verification code</label><input id="registration-code" className="field-control" type="text" name="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" disabled={busy} aria-invalid={!!codeError} aria-describedby={codeError ? 'registration-code-error' : undefined} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setCodeError('') }} />{codeError && <small className="signup-field-error" id="registration-code-error">{codeError}</small>}<button type="button" className="signup-primary" disabled={busy} onClick={verifyAndCreate}>{busy ? 'Verifying…' : 'Verify & Create Shop'}</button></div>}
          {requestError && <div className="signup-unavailable" role="alert"><Info size={18} /><span>{requestError}</span></div>}
        </form>}
      </div>
    </div></main>
    <AuthFooter />
    <dialog ref={dialog} className="information-dialog" onClick={event => { if (event.target === dialog.current) dialog.current.close() }}><div className="dialog-heading"><h2>{notices[notice].title}</h2><button type="button" className="icon-button" aria-label="Close information" onClick={() => dialog.current?.close()}><X size={20} /></button></div><p>{notices[notice].body}</p><button type="button" className="primary-action" onClick={() => dialog.current?.close()}>Close</button></dialog>
  </div>
}
