'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, isLoggedIn } from '@/lib/api';
import { formatPKR, statusLabel, statusTone } from '@/lib/format';
import { LoginSheet } from '@/components/LoginSheet';

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-stone-100 text-stone-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const load = () => {
    if (!isLoggedIn()) {
      setNeedLogin(true);
      return;
    }
    setNeedLogin(false);
    api.get('/orders').then(setOrders).catch(() => setOrders([]));
  };

  useEffect(load, []);

  if (needLogin) {
    return (
      <>
        <div className="card mx-auto max-w-md p-10 text-center">
          <div className="text-4xl">📦</div>
          <h1 className="mt-2 text-lg font-bold">Login to see your orders</h1>
          <button className="btn-primary mt-4" onClick={() => setNeedLogin(true)}>Login</button>
        </div>
        <LoginSheet title="Login to view your orders" onClose={() => history.back()} onSuccess={load} />
      </>
    );
  }
  if (!orders) return <p className="text-stone-500">Loading orders…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">Your orders</h1>
      {orders.length === 0 && (
        <div className="card p-10 text-center text-stone-500">
          No orders yet. <Link className="text-emerald-700 underline" href="/">Start shopping</Link>
        </div>
      )}
      <div className="space-y-3">
        {orders.map((o) => {
          const shops = o.isParent
            ? (o.children ?? []).map((c: any) => c.merchant?.shopName).filter(Boolean).join(', ')
            : o.merchant?.shopName;
          const itemCount = o.isParent
            ? (o.children ?? []).reduce((s: number, c: any) => s + (c.items?.length ?? 0), 0)
            : o.items?.length ?? 0;
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="card block p-4 hover:border-emerald-300">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{o.orderNumber}</div>
                  <div className="truncate text-sm text-stone-500">🏪 {shops} · {itemCount} item{itemCount === 1 ? '' : 's'}</div>
                  <div className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <span className={`chip ${TONE_CLASSES[statusTone(o.status)]}`}>{statusLabel(o.status)}</span>
                  <div className="mt-1 font-bold">{formatPKR(o.totalAmountPaisa)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
