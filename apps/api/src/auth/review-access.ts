import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../common/constants';

// Immutable reserved identities remain recognizable even after configuration is removed.
export const REVIEW_SHOP_ID = 'play-review-v1-shop';
export const REVIEW_CUSTOMER_ID = 'play-review-v1-customer';
export const REVIEW_RIDER_ID = 'play-review-v1-rider';
export const REVIEW_ACCOUNTS = [
  { userId: 'play-review-v1-user-customer', phone: '+923000009901', context: 'customer', role: UserRole.CUSTOMER },
  { userId: 'play-review-v1-user-merchant', phone: '+923000009902', context: 'merchant', role: UserRole.MERCHANT_OWNER },
  { userId: 'play-review-v1-user-rider', phone: '+923000009903', context: 'rider', role: UserRole.RIDER },
] as const;

export const reviewAccount = (userId?: string) => REVIEW_ACCOUNTS.find((account) => account.userId === userId);
export const reviewPhone = (phone: string) => REVIEW_ACCOUNTS.find((account) => account.phone === phone);

export function reviewAccessActive(now = Date.now()): boolean {
  const expiry = Date.parse(process.env.PLAY_REVIEW_EXPIRES_AT ?? '');
  return process.env.PLAY_REVIEW_ENABLED === 'true' && Number.isFinite(expiry) && now < expiry;
}

export function requireReviewSession(userId: string, role: string) {
  const account = reviewAccount(userId);
  if (account && (!reviewAccessActive() || account.role !== role)) {
    throw new UnauthorizedException('Review access is disabled, expired, or invalid for this app.');
  }
}

export function reviewCodeHash(phone: string, purpose: string): string | undefined {
  const account = reviewPhone(phone);
  if (!account) return undefined;
  requireReviewSession(account.userId, account.role);
  if (purpose !== 'LOGIN') throw new ForbiddenException('Review identities cannot reset or change credentials.');
  const hash = process.env[`PLAY_REVIEW_${account.context.toUpperCase()}_CODE_HASH`];
  if (!hash || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash)) {
    throw new UnauthorizedException('Review access is not configured.');
  }
  return hash;
}

export function requireReviewCartBoundary(customerId: string | undefined, merchantId: string) {
  if ((customerId === REVIEW_CUSTOMER_ID) !== (merchantId === REVIEW_SHOP_ID)) {
    throw new ForbiddenException('Review shopping is restricted to the isolated demo shop.');
  }
}

export function reviewMerchantFilter(userId?: string) {
  return { id: reviewAccount(userId) && reviewAccessActive() ? REVIEW_SHOP_ID : { not: REVIEW_SHOP_ID } };
}

export function reviewMembershipValid(userId: string, user: {
  customer?: { id: string } | null; merchant?: { id: string } | null;
  rider?: { id: string; merchantId?: string } | null;
}) {
  const review = reviewAccount(userId);
  if (!review) return true;
  if (review.context === 'customer') return user.customer?.id === REVIEW_CUSTOMER_ID;
  if (review.context === 'merchant') return user.merchant?.id === REVIEW_SHOP_ID;
  return user.rider?.id === REVIEW_RIDER_ID && user.rider.merchantId === REVIEW_SHOP_ID;
}

// A closed allowlist prevents newly added controllers from expanding review privileges.
// Use Nest's resolved controller/handler, not user-controlled URLs or query strings.
const ALLOWED: Record<string, readonly string[]> = {
  AuthController: ['me', 'googleAccount', 'logout', 'refresh'],
  ProductsController: ['categories', 'search', 'catalogBrowse', 'nearby', 'popular', 'recommended', 'detail'],
  MerchantsDiscoveryController: ['nearby', 'detail', 'products', 'merchantReviews'],
  LocationController: ['detect', 'serviceAvailability', 'nearbyAreas'],
  GuestCatalogController: ['locationProducts'],
  GuestController: ['merge'],
  CartController: ['view', 'addItem', 'updateItem', 'removeItem', 'clear', 'removeCoupon'],
  CustomersController: ['profile', 'addresses', 'createAddress', 'updateAddress', 'deleteAddress', 'setDefault'],
  OrdersController: ['quote', 'place', 'list', 'detail', 'track', 'cancel', 'respondReplacement', 'respondRevision'],
  MerchantController: ['profile', 'online', 'offline', 'open', 'close', 'dashboard', 'earnings', 'settlements', 'listProducts', 'browseCatalog', 'updateProduct', 'listRiders', 'getRider', 'riderOrders', 'listStaff'],
  MerchantOrdersController: ['list', 'detail', 'accept', 'reject', 'preparing', 'ready', 'assignRider', 'itemUnavailable', 'createRevision'],
  RiderController: ['profile', 'online', 'offline', 'location', 'assigned', 'history', 'orderDetail', 'arrivedShop', 'pickedUp', 'arrivedCustomer', 'delivered'],
  NotificationsController: ['list', 'markRead', 'markAllRead'],
};

export function requireReviewRoute(userId: string | undefined, controller: string, handler: string) {
  if (reviewAccount(userId) && !ALLOWED[controller]?.includes(handler)) {
    throw new ForbiddenException('This action is not available to store-review accounts.');
  }
}
