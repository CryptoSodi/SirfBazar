import { useCallback, useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { Badge, Stat, btnCls, btnGhost, useToast } from '../components/ui';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, p] = await Promise.all([api.get('/merchant/dashboard'), api.get('/merchant/profile')]);
      setStats(d);
      setProfile(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Prefer the live dashboard value, fall back to profile.
  const isOnline = stats?.isOnline ?? profile?.isOnline ?? false;
  const approvalStatus: string = stats?.approvalStatus ?? profile?.approvalStatus ?? '';
  const shopName: string = profile?.shopName ?? 'My shop';
  const ratingAverage: number = stats?.ratingAverage ?? profile?.ratingAverage ?? 0;
  const ratingCount: number = stats?.ratingCount ?? profile?.ratingCount ?? 0;
  const isOpen = stats?.isOpen ?? profile?.isOpen ?? false;
  const pendingOrders: number = stats?.pendingOrders ?? 0;

  async function toggleOnline() {
    setBusy(true);
    try {
      await api.post(isOnline ? '/merchant/offline' : '/merchant/online');
      toast(isOnline ? 'You are now offline' : 'You are now online');
      await load();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (loading && !stats) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{shopName}</span>
            {approvalStatus && <Badge value={approvalStatus} />}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="text-slate-400">·</span>
            <span>{isOpen ? 'Store open' : 'Store closed'}</span>
            <span className="text-slate-400">·</span>
            <span>
              ★ {Number(ratingAverage).toFixed(1)}
              <span className="text-slate-400"> ({ratingCount})</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
          <button
            className={isOnline ? 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50' : btnCls}
            onClick={toggleOnline}
            disabled={busy}
          >
            {busy ? 'Saving…' : isOnline ? 'Go offline' : 'Go online'}
          </button>
        </div>
      </div>

      {pendingOrders > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">
              {pendingOrders}
            </span>
            {pendingOrders === 1 ? 'New order' : 'New orders'} waiting for your response.
          </div>
          <a href="/orders" className="text-sm font-semibold text-amber-800 underline-offset-2 hover:underline">
            Go to orders →
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders today" value={stats.todayOrders ?? 0} hint={`${stats.completedToday ?? 0} completed today`} />
        <Stat label="New orders" value={stats.pendingOrders ?? 0} hint="Awaiting acceptance" />
        <Stat label="Preparing" value={stats.preparingOrders ?? 0} hint="Accepted / in kitchen" />
        <Stat label="Ready for pickup" value={stats.readyOrders ?? 0} />
        <Stat label="Active deliveries" value={stats.activeDeliveries ?? 0} hint="Rider assigned / on the way" />
        <Stat label="Cancelled today" value={stats.cancelledToday ?? 0} />
        <Stat label="Low stock items" value={stats.lowStockProducts ?? 0} hint="At or below threshold" />
        <Stat label="Rating" value={`★ ${Number(ratingAverage).toFixed(1)}`} hint={`${ratingCount} reviews`} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-600">Sales (delivered orders)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Today" value={pkr(stats.todaySalesPaisa)} />
          <Stat label="Last 7 days" value={pkr(stats.weekSalesPaisa)} />
          <Stat label="Last 30 days" value={pkr(stats.monthSalesPaisa)} />
          <Stat
            label="Net earnings (30d)"
            value={pkr(stats.netEarningsPaisa)}
            hint={`${pkr(stats.commissionPaisa)} commission`}
          />
        </div>
      </div>

      {node}
    </div>
  );
}
