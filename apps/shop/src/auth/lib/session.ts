import { storeAuth } from '../../lib/api'

export type MerchantSession = {
  token: string
  refreshToken: string
  user: any
  role: 0 | 1
}

const KEY = 'sirfbazar.merchant.registration-session'

export function saveSession(session: MerchantSession) {
  if (session.role === 1) {
    storeAuth({ accessToken: session.token, refreshToken: session.refreshToken, user: session.user })
    sessionStorage.removeItem(KEY)
    return
  }
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function getSession(): MerchantSession | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') }
  catch { return null }
}

export function clearRegistrationSession() {
  sessionStorage.removeItem(KEY)
}
