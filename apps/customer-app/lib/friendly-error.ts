/**
 * Public-facing error boundary. Keep status/code/details on the error for
 * recovery logic; never render raw validation arrays or infrastructure output.
 * Mirrored across independently deployed apps; parity is tested.
 */
export function friendlyError(value: unknown, status?: number, path = '', code?: string): string {
  const raw = typeof value === 'string' ? value : value instanceof Error ? value.message : '';
  if (code === 'QUOTE_CHANGED' || code === 'QUOTE_REQUIRED') return 'Your basket or total has changed. Review your order again before placing it.';
  if (status === 429) return 'Too many attempts. Please wait a moment before trying again.';
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'This account cannot perform that action. Contact your shop owner or support.';
  if (status && status >= 500) return 'The service is temporarily unavailable. Check the saved status before trying the action again.';
  if (/failed to fetch|network request failed|load failed|NetworkError/i.test(raw)) return 'Connection lost. Check your internet connection and the saved status before trying again.';
  if (/guest session expired/i.test(raw)) return 'Your guest session expired. Open your basket to choose how to continue.';
  if (/otp|verification code/i.test(raw) && /invalid|expired|incorrect/i.test(raw)) return 'That verification code is incorrect or has expired. Request a new code and try again.';
  const technical = Array.isArray(value) || !raw || raw.length > 350 ||
    /\b(uuid|requestId|cartId|deliveryAddressId|merchantProductId|approvedQuote|prisma|SQL|TypeError|ReferenceError|SyntaxError|ECONN\w*|stack trace|VITE_\w*|EXPO_PUBLIC_\w*)\b|must be (?:a |an )?(?:string|number|integer|boolean|enum|array)|should not be empty|property .+ should not exist|Request failed \(\d+\)|[<>]html|at \S+\s*\(|\b[A-Z][A-Z_]{3,}\b/.test(raw);
  if (technical) {
    if (/^\/orders(?:\/quote)?$/.test(path)) return 'Your basket could not be verified. Open your basket, review its items, then return to checkout.';
    return 'This action could not be completed. Check your details and try again. If it keeps happening, contact support.';
  }
  return raw;
}

