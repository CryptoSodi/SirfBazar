import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../common/constants';

// Immutable reserved identities remain recognizable even after configuration is removed.
export const REVIEW_SHOP_ID = 'play-review-v1-shop';
export const REVIEW_CUSTOMER_ID = 'play-review-v1-customer';
export const REVIEW_RIDER_ID = 'play-review-v1-rider';
export const REVIEW_COUPON_ID = 'play-review-v1-coupon';
export const REVIEW_MEMBER_PREFIX = 'play-review-v1-member-';
export const REVIEW_ACCOUNTS = [
  { userId: 'play-review-v1-user-customer', phone: '+923000009901', context: 'customer', role: UserRole.CUSTOMER },
  { userId: 'play-review-v1-user-merchant', phone: '+923000009902', context: 'merchant', role: UserRole.MERCHANT_OWNER },
  { userId: 'play-review-v1-user-rider', phone: '+923000009903', context: 'rider', role: UserRole.RIDER },
] as const;

export const reviewAccount = (userId?: string) => REVIEW_ACCOUNTS.find((account) => account.userId === userId);
export const reviewPhone = (phone: string) => REVIEW_ACCOUNTS.find((account) => account.phone === phone);

export function reviewAccessActive(): boolean {
  return process.env.PLAY_REVIEW_ENABLED === 'true';
}

export function requireReviewSession(userId: string, role: string) {
  const account = reviewAccount(userId);
  if (userId.startsWith(REVIEW_MEMBER_PREFIX)) throw new UnauthorizedException('Demo team records are not login accounts.');
  if (account && (!reviewAccessActive() || account.role !== role)) {
    throw new UnauthorizedException('Review access is disabled or invalid for this app.');
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

export function reviewProductFilter(merchantId?: string) {
  return merchantId === REVIEW_SHOP_ID ? {} : { AND: [{ OR: [{ createdByMerchantId: null }, { createdByMerchantId: { not: REVIEW_SHOP_ID } }] }] };
}

export function requireReviewProductBoundary(createdByMerchantId: string | null | undefined, merchantId?: string) {
  if (createdByMerchantId === REVIEW_SHOP_ID && merchantId !== REVIEW_SHOP_ID) throw new ForbiddenException('Demo catalogue records are isolated from real shops.');
}

export function reviewPosEntitlement(merchantId: string) {
  if (merchantId !== REVIEW_SHOP_ID) return null;
  return { status: 'REVIEW', optedIn: true, salesEnabled: reviewAccessActive(), startedAt: null, endsAt: null, remainingMilliseconds: null };
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
  CartController: ['view', 'addItem', 'updateItem', 'removeItem', 'clear', 'applyCoupon', 'removeCoupon'],
  CouponsController: ['listActive'],
  CustomersController: ['profile', 'updateProfile', 'deleteAccount', 'addresses', 'createAddress', 'updateAddress', 'deleteAddress', 'setDefault'],
  OrdersController: ['quote', 'place', 'list', 'detail', 'track', 'cancel', 'respondReplacement', 'respondRevision', 'rate'],
  MerchantController: ['profile', 'updateProfile', 'addDocument', 'uploadDocument', 'documentFile', 'online', 'offline', 'availability', 'open', 'close', 'dashboard', 'earnings', 'settlements', 'listProducts', 'browseCatalog', 'addProduct', 'bulkPreview', 'bulkUpload', 'updateProduct', 'removeProduct', 'listRiders', 'getRider', 'riderOrders', 'createRider', 'updateRider', 'removeRider', 'activateRider', 'deactivateRider', 'approveRider', 'rejectRider', 'listStaff', 'createStaff', 'updateStaff', 'removeStaff'],
  MerchantOrdersController: ['list', 'detail', 'accept', 'reject', 'preparing', 'ready', 'assignRider', 'itemUnavailable', 'createRevision'],
  RiderController: ['profile', 'online', 'offline', 'location', 'assigned', 'history', 'orderDetail', 'arrivedShop', 'pickedUp', 'arrivedCustomer', 'delivered', 'reportIssue'],
  SupportController: ['create', 'listOwn', 'get', 'addMessage'],
  PosController: ['capabilities', 'lookup', 'products', 'reviewProducts', 'createSale', 'sales', 'sale', 'summary'],
  NotificationsController: ['list', 'markRead', 'markAllRead', 'saveToken', 'removeToken', 'webPushConfig', 'subscribeWebPush', 'unsubscribeWebPush'],
};

export function requireReviewRoute(userId: string | undefined, controller: string, handler: string) {
  if (reviewAccount(userId) && !ALLOWED[controller]?.includes(handler)) {
    throw new ForbiddenException('This action is not available to store-review accounts.');
  }
}
