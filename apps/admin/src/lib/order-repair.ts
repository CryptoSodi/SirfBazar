type PaymentEvidence = { status?: string; providerTransactionId?: string | null };
type RepairOrder = {
  channel?: string;
  isParent?: boolean;
  riderId?: string | null;
  pickedUpAt?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  status: string;
  parentOrderId?: string | null;
  payments?: PaymentEvidence[];
  parent?: { payments?: PaymentEvidence[] } | null;
  items?: { itemStatus?: string }[];
  timeline?: { status?: string }[];
};

// A display hint only: the API rechecks payment, rider and pickup evidence
// transactionally before applying and auditing a status change.
export function orderRepairOptions(order: RepairOrder): string[] {
  if (order.channel !== 'ONLINE' || order.isParent || order.riderId || order.pickedUpAt) return [];
  if (order.timeline?.some(entry => ['PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'].includes(entry.status ?? ''))) return [];
  const payments = order.parentOrderId ? order.parent?.payments : order.payments;
  const paymentReady = order.paymentMethod === 'COD'
    ? order.paymentStatus === 'CASH_PENDING'
    : !!order.paymentMethod && order.paymentStatus === 'PAID' && !!payments?.some(payment =>
      payment.status === 'PAID' && payment.providerTransactionId != null);
  if (!paymentReady) return [];
  const forward: Record<string, string[]> = {
    SENT_TO_MERCHANT: ['MERCHANT_ACCEPTED'],
    MERCHANT_ACCEPTED: ['PREPARING', 'READY_FOR_PICKUP'],
    PREPARING: ['READY_FOR_PICKUP'],
  };
  return (forward[order.status] ?? []).filter(status => status !== 'READY_FOR_PICKUP' ||
    !order.items?.some(item => item.itemStatus === 'REPLACEMENT_SUGGESTED'));
}
