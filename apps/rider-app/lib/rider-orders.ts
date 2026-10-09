export type RiderOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  totalAmountPaisa?: number;
  createdAt?: string;
  deliveredAt?: string;
  merchant?: { shopName?: string; address?: string; phoneNumber?: string; latitude?: number | null; longitude?: number | null };
  customer?: { user?: { fullName?: string; phoneNumber?: string } };
  deliveryAddress?: { fullAddress?: string; street?: string; area?: string; city?: string; instructions?: string; contactName?: string; contactPhone?: string; latitude?: number | null; longitude?: number | null };
  items?: { id: string; quantity: number; productNameSnapshot?: string; unitSnapshot?: string; sizeSnapshot?: string }[];
};

export type PaymentInstruction = 'collect' | 'paid' | 'already-collected' | 'check';

export function paymentInstruction(order: RiderOrder): PaymentInstruction {
  if (order.paymentMethod === 'COD' && order.paymentStatus === 'CASH_PENDING') return 'collect';
  if (order.paymentStatus === 'PAID') return 'paid';
  if (order.paymentStatus === 'CASH_COLLECTED') return 'already-collected';
  return 'check';
}

export function withoutDeliveryCode<T extends Record<string, any>>(order: T): T {
  const { deliveryOtp: _secret, ...safe } = order;
  return safe as T;
}

export function destination(order: RiderOrder): string {
  return order.deliveryAddress?.fullAddress ?? [order.deliveryAddress?.street, order.deliveryAddress?.area, order.deliveryAddress?.city].filter(Boolean).join(', ');
}

export function customerName(order: RiderOrder): string {
  return order.deliveryAddress?.contactName ?? order.customer?.user?.fullName ?? 'Customer';
}

export function customerPhone(order: RiderOrder): string | undefined {
  return order.deliveryAddress?.contactPhone || order.customer?.user?.phoneNumber || undefined;
}

export function isActive(status: string): boolean {
  return ['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP', 'PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'].includes(status);
}

export function waitingForPacking(status: string): boolean {
  return ['MERCHANT_ACCEPTED', 'PREPARING'].includes(status);
}
