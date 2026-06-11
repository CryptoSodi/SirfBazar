export function formatPKR(paisa: number | null | undefined): string {
  if (paisa == null) return 'Rs 0';
  return `Rs ${Math.round(paisa / 100).toLocaleString('en-PK')}`;
}

export const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  PAYMENT_PENDING: 'Awaiting payment',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  SENT_TO_MERCHANT: 'Waiting for shop',
  MERCHANT_ACCEPTED: 'Shop accepted',
  MERCHANT_REJECTED: 'Shop rejected',
  PREPARING: 'Being prepared',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Rider assigned',
  RIDER_ARRIVED_AT_SHOP: 'Rider at shop',
  PICKED_UP: 'Picked up',
  ON_THE_WAY: 'On the way',
  RIDER_ARRIVED_AT_CUSTOMER: 'Rider at your door',
  DELIVERED: 'Delivered',
  CANCELLED_BY_CUSTOMER: 'Cancelled by you',
  CANCELLED_BY_MERCHANT: 'Cancelled by shop',
  CANCELLED_BY_ADMIN: 'Cancelled',
  FAILED_DELIVERY: 'Delivery failed',
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function statusTone(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'DELIVERED') return 'green';
  if (status.startsWith('CANCELLED') || status === 'MERCHANT_REJECTED' || status === 'FAILED_DELIVERY')
    return 'red';
  if (status === 'PAYMENT_PENDING' || status === 'SENT_TO_MERCHANT') return 'amber';
  return 'gray';
}

/** Steps shown on the tracking screen, in order. */
export const TRACKING_STEPS = [
  'SENT_TO_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'ON_THE_WAY',
  'DELIVERED',
];

export const CATEGORY_EMOJI: Record<string, string> = {
  groceries: '🛒',
  'milk-eggs-bread': '🥛',
  'fruits-vegetables': '🥕',
  'snacks-drinks': '🥤',
  bakery: '🥐',
  pharmacy: '💊',
  'personal-care': '🧴',
  'baby-care': '🍼',
  household: '🧹',
  stationery: '✏️',
  'mobile-accessories': '🔌',
  'pet-food': '🐾',
};

export function productEmoji(card: { categoryId?: string } | null, slugHint?: string): string {
  return CATEGORY_EMOJI[slugHint ?? ''] ?? '🛍️';
}
