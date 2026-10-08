import { storeAuth, sessionGenerationIsCurrent } from '../../lib/api'
import type { BrowserSession } from '../../lib/browserSession'

export type MerchantSession = {
  token: string
  refreshToken: string
  user: any
  role: 0 | 1
  origin?: BrowserSession
}

const KEY = 'sirfbazar.merchant.registration-session'

export function saveSession(session: MerchantSession) {
  if (session.origin && !sessionGenerationIsCurrent(session.origin)) throw new Error('Your session changed. Refresh this page.')
  if (session.role === 1) {
    storeAuth({ accessToken: session.token, refreshToken: session.refreshToken, user: session.user })
    sessionStorage.removeItem(KEY)
    return
  }
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function getSession(): MerchantSession | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') as MerchantSession | null
    if (!saved) return null
    if (!saved.origin || !sessionGenerationIsCurrent(saved.origin)) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return saved
  }
  catch { return null }
}

export function clearRegistrationSession() {
  sessionStorage.removeItem(KEY)
}
