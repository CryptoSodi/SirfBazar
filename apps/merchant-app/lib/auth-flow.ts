export type AuthMode = 'signin' | 'signup';
export type AuthContext = 'merchant' | 'customer';
export const authContextFor = (mode: AuthMode): AuthContext => mode === 'signup' ? 'customer' : 'merchant';
export function hasMerchantAccess(user: any): boolean {
  return !!user?.merchant || !!user?.staffOf?.some((entry: any) => entry.status === 'ACTIVE');
}
export function authDestination(user: any, context: AuthContext): 'Tabs' | 'Onboard' | 'Login' {
  if (!user || (user.status && user.status !== 'ACTIVE')) return 'Login';
  if (context === 'merchant') return hasMerchantAccess(user) ? 'Tabs' : 'Login';
  // A customer-context token cannot be used for merchant API calls, even if the
  // same identity already owns a shop. Ask them to sign in in merchant context.
  return hasMerchantAccess(user) ? 'Login' : 'Onboard';
}
export function normalizeMobile(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (/^03\d{9}$/.test(compact)) return '+92' + compact.slice(1);
  if (/^923\d{9}$/.test(compact)) return '+' + compact;
  return compact;
}
export const validMobile = (value: string) => /^\+923\d{9}$/.test(normalizeMobile(value));
export const validOtp = (value: string) => /^\d{6}$/.test(value.trim());
