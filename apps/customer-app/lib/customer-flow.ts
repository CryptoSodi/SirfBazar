export function withDeadline<T>(operation: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
export const terminalStatuses = [
  'DELIVERED',
  'MERCHANT_REJECTED',
  'FAILED_DELIVERY',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_MERCHANT',
  'CANCELLED_BY_ADMIN',
];
export function notificationDestination(data: { type?: unknown; referenceId?: unknown }) {
  if (typeof data.referenceId !== 'string' || !data.referenceId) return null;
  if (data.type === 'SUPPORT_REPLY') return { screen: 'SupportDetail' as const, ticketId: data.referenceId };
  if (
    typeof data.type === 'string' &&
    /^(ORDER_|REPLACEMENT_|PAYMENT_|REFUND_|DELIVERY_|RIDER_)/.test(data.type)
  ) {
    return { screen: 'OrderDetail' as const, orderId: data.referenceId };
  }
  return null;
}
export function pendingReplacements(order: any) {
  const orders = order?.isParent ? (order.children ?? []) : order ? [order] : [];
  return orders.flatMap((shop: any) =>
    terminalStatuses.includes(shop.status)
      ? []
      : (shop.items ?? [])
          .filter((item: any) => item.itemStatus === 'REPLACEMENT_SUGGESTED')
          .map((item: any) => ({
            orderId: shop.id,
            shopName: shop.merchant?.shopName,
            item,
            original: shop.items.find((entry: any) => entry.id === item.replacementForItemId),
          })),
  );
}
export function cartIssues(cart: any) {
  const items = (cart?.groups ?? []).flatMap((group: any) => group.items ?? []);
  return {
    unavailable: items.some((item: any) => item.inStock === false),
    priceChanged: items.some((item: any) => item.priceChanged),
  };
}
export function resolveApiUrl(configured: string | undefined, platform: string, metroHost?: string | null) {
  const base = configured || 'https://api.sirfbazar.com/api';
  if (platform === 'web' || !metroHost || !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(base)) return base;
  const host = metroHost.split(':')[0];
  return base.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${host}`);
}
