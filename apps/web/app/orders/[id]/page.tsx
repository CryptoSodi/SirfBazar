'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatPKR, statusLabel, statusTone, TRACKING_STEPS } from '@/lib/format';

const TONE_CLASSES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-stone-100 text-stone-600',
};

function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const wantsPay = useSearchParams().get('pay') === '1';
  const [track, setTrack] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([api.get(`/orders/${id}/track`), api.get(`/orders/${id}`)]);
      setTrack(t);
      setDetail(d);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 5000); // live tracking via polling
    return () => clearInterval(timer.current);
  }, [load]);

  const payNow = async () => {
    setBusy(true);
    try {
      const init = await api.post(`/payments/order/${id}/initiate`);
      await api.post(`/payments/${init.paymentId}/confirm`, {});
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = prompt('Why are you cancelling? (optional)') ?? undefined;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const rate = async () => {
    if (!rating) return;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/rate`, { merchantRating: rating, riderRating: rating });
      alert('Thanks for your rating!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reportIssue = async () => {
    const description = prompt('Describe the issue with this order:');
    if (!description) return;
    try {
      await api.post(`/orders/${id}/support-ticket`, {
        issueCategory: 'MISSING_ITEM',
        title: `Issue with order ${track?.orderNumber}`,
        description,
      });
      alert('Support ticket created — we will get back to you.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (error) return <div className="card p-10 text-center text-stone-500">{error}</div>;
  if (!track || !detail) return <p className="text-stone-500">Loading order…</p>;

  const cancellable = ['CREATED', 'PAYMENT_PENDING', 'SENT_TO_MERCHANT'].includes(track.status);
  const allDelivered = track.status === 'DELIVERED';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{track.orderNumber}</h1>
          <span className={`chip mt-1 ${TONE_CLASSES[statusTone(track.status)]}`}>{statusLabel(track.status)}</span>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{formatPKR(track.totalAmountPaisa)}</div>
          <div className="text-xs text-stone-500">{detail.paymentMethod} · {detail.paymentStatus?.replace(/_/g, ' ').toLowerCase()}</div>
        </div>
      </div>

      {/* Payment pending */}
      {(wantsPay || track.status === 'PAYMENT_PENDING') && track.status === 'PAYMENT_PENDING' && (
        <div className="card border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-800">Complete your payment</h2>
          <p className="mt-1 text-sm text-amber-700">Your order is reserved and will be sent to the shop once paid.</p>
          <button className="btn-primary mt-3" onClick={payNow} disabled={busy}>
            {busy ? 'Processing…' : `Pay ${formatPKR(track.totalAmountPaisa)} now (demo gateway)`}
          </button>
        </div>
      )}

      {/* Per-shop deliveries */}
      {track.deliveries.map((d: any) => {
        const stepIndex = TRACKING_STEPS.indexOf(d.status === 'PICKED_UP' ? 'ON_THE_WAY' : d.status);
        return (
          <section key={d.orderId} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold">🏪 {d.merchant?.shopName}</div>
              <span className={`chip ${TONE_CLASSES[statusTone(d.status)]}`}>{statusLabel(d.status)}</span>
            </div>

            {/* Progress stepper */}
            <ol className="mb-4 flex items-center gap-1">
              {TRACKING_STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-1">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      i <= stepIndex ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i < TRACKING_STEPS.length - 1 && (
                    <span className={`h-0.5 flex-1 ${i < stepIndex ? 'bg-emerald-600' : 'bg-stone-200'}`} />
                  )}
                </li>
              ))}
            </ol>

            {/* Delivery OTP */}
            {d.deliveryOtp && (
              <div className="mb-3 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-4 text-center">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Delivery code — share with your rider</div>
                <div className="mt-1 text-3xl font-black tracking-[0.5em] text-emerald-800">{d.deliveryOtp}</div>
              </div>
            )}

            {/* Rider */}
            {d.rider && (
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-stone-50 p-3 text-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-lg">🛵</span>
                <div className="flex-1">
                  <div className="font-semibold">{d.rider.fullName}</div>
                  <div className="text-xs text-stone-500">
                    {d.rider.vehicleType?.toLowerCase()} {d.rider.vehicleNumber && `· ${d.rider.vehicleNumber}`} · {d.rider.phoneNumber}
                  </div>
                </div>
                {d.riderLocation && (
                  <a
                    className="text-xs text-emerald-700 underline"
                    target="_blank"
                    href={`https://www.google.com/maps?q=${d.riderLocation.latitude},${d.riderLocation.longitude}`}
                  >
                    📍 Live location
                  </a>
                )}
              </div>
            )}
            {d.estimatedDeliveryMinutes && !allDelivered && (
              <p className="text-xs text-stone-500">Estimated delivery ~{d.estimatedDeliveryMinutes} min from order time.</p>
            )}

            {/* Timeline */}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-stone-400">Order timeline</summary>
              <ul className="mt-2 space-y-1 text-xs text-stone-500">
                {(d.timeline ?? []).map((t: any) => (
                  <li key={t.id}>
                    <span className="font-medium text-stone-700">{statusLabel(t.status)}</span>
                    {t.notes && <span> — {t.notes}</span>}
                    <span className="text-stone-400"> · {new Date(t.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        );
      })}

      {/* Items */}
      <section className="card p-5">
        <h2 className="mb-2 font-bold">Items</h2>
        {(track.deliveries.length > 1 ? detail.children : [detail]).map((o: any) => (
          <div key={o.id} className="mb-2">
            {track.deliveries.length > 1 && <div className="text-xs font-semibold text-stone-400">{o.merchant?.shopName}</div>}
            <ul className="divide-y divide-stone-100 text-sm">
              {(o.items ?? []).map((it: any) => (
                <li key={it.id} className="flex justify-between py-1.5">
                  <span className={it.itemStatus !== 'CONFIRMED' ? 'text-stone-400 line-through' : ''}>
                    {it.quantity} × {it.productNameSnapshot}
                    {it.itemStatus === 'REPLACEMENT_SUGGESTED' && <ReplacementPrompt orderId={o.id} item={it} onDone={load} />}
                  </span>
                  <span>{formatPKR(it.totalPricePaisa)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {cancellable && (
          <button className="btn-secondary text-sm" onClick={cancel} disabled={busy}>
            Cancel order
          </button>
        )}
        {allDelivered && (
          <div className="card flex items-center gap-2 p-3">
            <span className="text-sm font-medium">Rate:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`text-xl ${n <= rating ? '' : 'grayscale opacity-40'}`} onClick={() => setRating(n)}>
                ⭐
              </button>
            ))}
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={rate} disabled={!rating || busy}>
              Submit
            </button>
          </div>
        )}
        <button className="btn-secondary text-sm" onClick={reportIssue}>
          Report an issue
        </button>
      </div>
    </div>
  );
}

function ReplacementPrompt({ orderId, item, onDone }: { orderId: string; item: any; onDone: () => void }) {
  const respond = async (accept: boolean) => {
    try {
      await api.post(`/orders/${orderId}/items/${item.replacementForItemId}/replacement`, { accept });
      onDone();
    } catch (e: any) {
      alert(e.message);
    }
  };
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
      replacement suggested:
      <button className="font-bold text-emerald-700 underline" onClick={() => respond(true)}>accept</button>/
      <button className="font-bold text-red-600 underline" onClick={() => respond(false)}>reject</button>
    </span>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <OrderTracking />
    </Suspense>
  );
}
