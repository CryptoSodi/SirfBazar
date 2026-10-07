import { useCallback, useEffect, useRef, useState } from 'react';
import { api, statusLabel } from './api';
import { terminalStatuses } from './customer-flow';
import { subscribeCustomerEvent } from './customer-events';
import { watchOrders } from './realtime';
import { useLiveRefresh } from './useLiveRefresh';

/** Owned order reads only. Retains last-known data on outages, clears it on account changes. */
export function useOrderPresentation(orderId: string, tracking = false) {
  const [order, setOrder] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const revision = useRef(0);
  const load = useCallback(() => {
    const current = ++revision.current;
    void Promise.all([api.get(`/orders/${orderId}`), tracking ? api.get(`/orders/${orderId}/track`) : Promise.resolve(null)])
      .then(([nextOrder, nextTrack]) => {
        if (current !== revision.current) return;
        setOrder(nextOrder); setTrack(nextTrack); setError(''); setUpdatedAt(new Date());
      }).catch((cause: any) => {
        if (current !== revision.current) return;
        if (cause.status === 401 || cause.status === 403 || cause.status === 404) { setOrder(null); setTrack(null); }
        setError(cause.message || 'Unable to load the order. Try again.');
      });
  }, [orderId, tracking]);
  useEffect(() => {
    setOrder(null); setTrack(null); setError(''); setUpdatedAt(undefined);
    const unsubscribe = subscribeCustomerEvent('auth', () => {
      revision.current++; setOrder(null); setTrack(null); setUpdatedAt(undefined);
    });
    return () => { revision.current++; unsubscribe(); };
  }, [orderId, tracking]);
  useLiveRefresh('orders', load);
  const watchKey = JSON.stringify([orderId, ...(order?.children ?? []).map((child: any) => child.id)]);
  useEffect(() => watchOrders(JSON.parse(watchKey)), [watchKey]);
  return { order, track, error, updatedAt, load };
}

export function orderDeliveries(order: any): any[] { return order?.isParent ? order.children ?? [] : order ? [order] : []; }
export function visibleOrderItems(order: any): any[] { return (order?.items ?? []).filter((item: any) => !['REMOVED', 'REPLACED', 'REPLACEMENT_SUGGESTED'].includes(item.itemStatus)); }
export function orderAddress(order: any) { return [order?.deliveryAddress?.fullAddress, order?.deliveryAddress?.city].filter(Boolean).join(', ') || 'Delivery address unavailable'; }
export function isPastOrder(order: any) {
  const deliveries = orderDeliveries(order);
  return deliveries.length > 0 && deliveries.every((delivery) => terminalStatuses.includes(delivery.status));
}
export function canCancelOrder(order: any) {
  const deliveries = orderDeliveries(order);
  return deliveries.length > 0 && deliveries.every((delivery) => ['CREATED', 'PAYMENT_PENDING', 'SENT_TO_MERCHANT'].includes(delivery.status));
}
export function orderStatusTitle(status: string) {
  if (status === 'SENT_TO_MERCHANT' || status === 'CREATED') return 'Waiting for shop';
  return statusLabel(status ?? '');
}
export function trackingHeading(status: string) {
  if (status === 'ON_THE_WAY') return 'Your order is\non the way.';
  if (status === 'DELIVERED') return 'Your order\nhas arrived.';
  if (status === 'RIDER_ARRIVED_AT_CUSTOMER') return 'Your rider is\nat your door.';
  if (status === 'SENT_TO_MERCHANT') return 'Your order is\nwith the shop.';
  if (['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP', 'PICKED_UP'].includes(status)) return 'Your order is\ngetting ready.';
  if (status === 'PAYMENT_PENDING') return 'Payment is\nnot confirmed.';
  return orderStatusTitle(status);
}
export function paymentDescription(order: any) {
  const status = order?.paymentStatus;
  if (order?.paymentMethod === 'COD') return status === 'CASH_COLLECTED' || status === 'PAID' ? 'Cash on delivery · collected' : `Cash on delivery · ${status === 'CASH_PENDING' ? 'not yet collected' : String(status ?? 'status unavailable').replace(/_/g, ' ').toLowerCase()}`;
  return `${String(order?.paymentMethod ?? 'Payment').replace(/_/g, ' ')} · ${String(status ?? 'status unavailable').replace(/_/g, ' ').toLowerCase()}`;
}
export function formatOrderTime(value?: string | Date) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Time unavailable';
  return new Date(value).toLocaleString();
}
