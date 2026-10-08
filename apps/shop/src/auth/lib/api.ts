import { API_URL, ApiError as CoreApiError, resolveApiUrl, storeAuth } from '../../lib/api'
import type { MerchantSession } from './session'

export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = 'ApiError' }
}

async function readError(response: Response) {
  try {
    const data = await response.json()
    return Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${response.status})`
  } catch { return `Request failed (${response.status})` }
}

async function json(path: string, body: unknown, token?: string) {
  let response: Response
  try {
    response = await fetch(resolveApiUrl(API_URL, path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (error instanceof CoreApiError) throw new ApiError(error.message)
    throw new ApiError('Unable to reach the merchant service. Check your connection and try again.')
  }
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json()
}

function session(data: any): MerchantSession {
  const merchant = data.user?.merchant?.id || data.user?.staffOf?.some((staff: { status: string }) => staff.status === 'ACTIVE')
  return { token: data.accessToken, refreshToken: data.refreshToken, user: data.user, role: merchant ? 1 : 0 }
}

function dataUrlFile(value: string) {
  const [header, encoded] = value.split(',')
  const type = header.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
  return new File([bytes], `shop.${type.split('/')[1] || 'jpg'}`, { type })
}

async function uploadImage(dataUrl: string, token: string) {
  const form = new FormData()
  form.append('file', dataUrlFile(dataUrl))
  let response: Response
  try {
    response = await fetch(resolveApiUrl(API_URL, '/uploads/image'), { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form })
  } catch { throw new ApiError('The shop image could not be uploaded because the merchant service is unavailable.') }
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return (await response.json()).url as string
}

const shopTypes: Record<string, string> = {
  kiryana: 'GROCERY', grocery: 'GROCERY', general: 'GENERAL', pharmacy: 'PHARMACY',
  bakery: 'BAKERY', stationery: 'STATIONERY', electronics: 'ELECTRONICS',
  cosmetics: 'COSMETICS', organic: 'ORGANIC', other: 'OTHER',
}

function addressParts(address: string) {
  const parts = address.split(',').map(value => value.trim()).filter(Boolean)
  return { city: parts.at(-1) || 'Lahore', area: parts.length > 1 ? parts.at(-2) : undefined }
}

export const merchantApi = {
  linkGoogle(idToken: string, token: string) {
    return json('/auth/google-link', { idToken }, token)
  },
  async googleLogin(idToken: string) {
    const result = session(await json('/auth/google-login', { idToken, context: 'merchant' }))
    if (result.role !== 1) throw new ApiError('This account does not have merchant access.', 403)
    return result
  },
  async login(identifier: string, password: string) {
    return session(await json('/auth/merchant-login', { identifier, password }))
  },
  startRegistration(values: { firstName: string; lastName: string; channel: 'mobile' | 'email'; contact: string; cnic: string; password: string }) {
    return json('/auth/merchant-register/start', values) as Promise<{ attemptId: string; message: string }>
  },
  async verifyRegistration(attemptId: string, code: string) {
    return session(await json('/auth/merchant-register/verify', { attemptId, code }))
  },
  requestPasswordReset(identifier: string) {
    return json('/auth/merchant-password/request', { identifier }) as Promise<{ message: string }>
  },
  resetPassword(identifier: string, code: string, password: string) {
    return json('/auth/merchant-password/reset', { identifier, code, password })
  },
  async createShop(values: { shopName: string; shopContactNumber: string; businessType: string; shopAddress: string; latitude: number; longitude: number; imageDataUrl?: string }, token: string) {
    const bannerUrl = values.imageDataUrl ? await uploadImage(values.imageDataUrl, token) : undefined
    const location = addressParts(values.shopAddress)
    const result = await json('/merchant/onboard', {
      shopName: values.shopName,
      phoneNumber: values.shopContactNumber.replace(/\D/g, '').replace(/^0/, '+92'),
      shopType: shopTypes[values.businessType.toLowerCase()] || 'OTHER',
      address: values.shopAddress,
      city: location.city,
      area: location.area,
      latitude: values.latitude,
      longitude: values.longitude,
      bannerUrl,
    }, token)
    storeAuth(result)
    sessionStorage.removeItem('sirfbazar.merchant.registration-session')
    return result
  },
}
