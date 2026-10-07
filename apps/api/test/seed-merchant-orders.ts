/** Local-only, API-driven merchant workflow fixtures. Run after `npm run seed`. */
export {};
const BASE = process.env.API_URL || 'http://127.0.0.1:3001/api';
const baseUrl = new URL(BASE);
if (
  process.env.CONFIRM_LOCAL_TEST_DATA !== '1' ||
  !['127.0.0.1', 'localhost'].includes(baseUrl.hostname) ||
  baseUrl.port !== '3001' || baseUrl.pathname !== '/api'
) {
  throw new Error('Refusing to create orders. Set CONFIRM_LOCAL_TEST_DATA=1 and use the local API on port 3001.');
}

type Auth = { accessToken: string };
type Order = { id: string; orderNumber: string; status: string; customerNote?: string | null };
type MerchantProduct = { id: string; pricePaisa: number; discountPricePaisa?: number | null; stockQuantity: number };

async function api<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(`${method} ${path} returned ${response.status}: ${message || 'no error body'}`);
  }
  return data as T;
}

async function login(phoneNumber: string, context: 'customer' | 'merchant'): Promise<string> {
  await api('POST', '/auth/send-otp', undefined, { phoneNumber });
  const auth = await api<Auth>('POST', '/auth/verify-otp', undefined, {
    phoneNumber,
    code: '123456', // Only accepted while the local API has OTP_PROVIDER=mock.
    context,
  });
  if (!auth.accessToken) throw new Error('Local API did not return an access token.');
  return auth.accessToken;
}

async function main() {
  const merchant = await login('+923010000001', 'merchant');
  const existing = await api<Order[]>('GET', '/merchant/orders', merchant);
  if (!Array.isArray(existing)) throw new Error('Merchant order list contract changed.');

  const markers = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED'] as const;
  const missing = markers.filter((marker) => !existing.some((order) => order.customerNote === `[LOCAL QA] ${marker}`));
  if (!missing.length) {
    console.log('All five local merchant workflow orders already exist; no duplicates created.');
    const dashboard = await api<{ todayOrders: number; pendingOrders: number; readyOrders: number; activeDeliveries: number }>('GET', '/merchant/dashboard', merchant);
    console.log(`Dashboard: today=${dashboard.todayOrders}, pending=${dashboard.pendingOrders}, ready=${dashboard.readyOrders}, with riders=${dashboard.activeDeliveries}`);
    return;
  }

  const products = await api<{ items: MerchantProduct[] }>('GET', '/merchant/products?pageSize=50', merchant);
  const chosen = products.items?.find((product) => product.stockQuantity >= 10 && (product.discountPricePaisa || product.pricePaisa) >= 20_000);
  if (!chosen) throw new Error('No stocked merchant product meets the local test minimum. Run the base seed first.');
  const riders = await api<Array<{ id: string; isActive: boolean; approvalStatus: string }>>('GET', '/merchant/riders', merchant);
  const rider = riders.find((candidate) => candidate.isActive && candidate.approvalStatus === 'APPROVED');
  if (!rider) throw new Error('No active, approved local rider exists. Run the base seed first.');

  const customer = await login('+923019999901', 'customer');
  const addresses = await api<Array<{ id: string; label: string }>>('GET', '/customer/addresses', customer);
  let address = addresses.find((candidate) => candidate.label === 'Local QA');
  if (!address) {
    address = await api<{ id: string; label: string }>('POST', '/customer/addresses', customer, {
      label: 'Local QA',
      fullAddress: 'Test address, Gulberg III, Lahore',
      city: 'Lahore',
      area: 'Gulberg III',
      latitude: 31.5254,
      longitude: 74.3637,
      contactName: 'Local QA Customer',
      contactPhone: '+923019999901',
      isDefault: true,
    });
  }

  for (const marker of missing) {
    await api('DELETE', '/cart/clear', customer);
    await api('POST', '/cart/items', customer, { merchantProductId: chosen.id, quantity: 2 });
    const order = await api<Order>('POST', '/orders', customer, {
      deliveryAddressId: address.id,
      paymentMethod: 'COD',
      customerNote: `[LOCAL QA] ${marker}`,
    });
    if (order.status !== 'SENT_TO_MERCHANT') throw new Error(`Unexpected initial status for ${marker}: ${order.status}`);
    const path = `/merchant/orders/${order.id}`;
    if (marker !== 'NEW') await api('POST', `${path}/accept`, merchant);
    if (marker === 'PREPARING') await api('POST', `${path}/preparing`, merchant);
    if (marker === 'READY' || marker === 'ASSIGNED') await api('POST', `${path}/ready`, merchant);
    if (marker === 'ASSIGNED') await api('POST', `${path}/assign-rider`, merchant, { riderId: rider.id });
    const saved = await api<Order>('GET', path, merchant);
    console.log(`${marker}: ${saved.orderNumber} → ${saved.status}`);
  }
  const dashboard = await api<{ todayOrders: number; pendingOrders: number; readyOrders: number; activeDeliveries: number }>('GET', '/merchant/dashboard', merchant);
  console.log(`Dashboard: today=${dashboard.todayOrders}, pending=${dashboard.pendingOrders}, ready=${dashboard.readyOrders}, with riders=${dashboard.activeDeliveries}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
