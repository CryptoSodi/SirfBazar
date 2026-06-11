import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { BarChart, Stat } from '../components/ui';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard').then(setStats).catch((e) => setError(e.message));
    api.get('/admin/analytics').then(setAnalytics).catch(() => undefined);
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Marketplace overview</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Customers" value={stats.totalCustomers} />
        <Stat label="Merchants" value={stats.totalMerchants} hint={`${stats.pendingMerchants} pending approval`} />
        <Stat label="Riders" value={stats.totalRiders} />
        <Stat label="Orders" value={stats.totalOrders} hint={`${stats.activeOrders} active now`} />
        <Stat label="GMV (delivered)" value={pkr(stats.gmvPaisa)} />
        <Stat label="Commission revenue" value={pkr(stats.commissionRevenuePaisa)} />
        <Stat label="Delivery fees" value={pkr(stats.deliveryFeeRevenuePaisa)} />
        <Stat label="Avg order value" value={pkr(stats.avgOrderValuePaisa)} />
        <Stat label="Completed orders" value={stats.completedOrders} />
        <Stat label="Cancelled orders" value={stats.cancelledOrders} />
        <Stat label="Open tickets" value={stats.pendingTickets} />
        <Stat label="Pending refunds" value={stats.pendingRefunds} />
      </div>

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Delivered orders by day (30 days)</h2>
            <BarChart data={(analytics.ordersByDay ?? []).map((d: any) => ({ label: d.date, value: d.orders }))} />
            <div className="mt-2 text-xs text-slate-400">
              Avg delivery time: {analytics.avgDeliveryMinutes} min · Cancellation rate: {analytics.cancellationRate}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Top products</h2>
            <ul className="space-y-1.5 text-sm">
              {(analytics.topProducts ?? []).map((p: any, i: number) => (
                <li key={p.productId} className="flex justify-between">
                  <span className="truncate">{i + 1}. {p.name}</span>
                  <span className="text-slate-400">{p.quantity}×</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Top merchants by GMV</h2>
            <ul className="space-y-1.5 text-sm">
              {(analytics.topMerchants ?? []).map((m: any, i: number) => (
                <li key={m.merchantId} className="flex justify-between">
                  <span className="truncate">{i + 1}. {m.shopName}</span>
                  <span className="text-slate-500">{pkr(m.gmvPaisa)} · {m.orders} orders</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
