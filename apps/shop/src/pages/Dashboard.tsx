import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage, pkr } from '../lib/api';
import { can, readDashboard, readOrders, readProfile, type DashboardSummary, type MerchantOrder, type MerchantProfile } from '../lib/merchant-contracts';
import { Badge, Stat, useToast } from '../components/ui';

type Day = { date: string; orders: number; salesPaisa: number };
type Earnings = { grossSalesPaisa: number; deliveredOrders: number; byDay: Day[] };
type Measure = 'orders' | 'salesPaisa';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [recent, setRecent] = useState<MerchantOrder[]>([]);
  const [recentError, setRecentError] = useState('');
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [measure, setMeasure] = useState<Measure>('orders');
  const { toast, node } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [dashboard, shop] = await Promise.all([api.get('/merchant/dashboard'), api.get('/merchant/profile')]); setStats(readDashboard(dashboard)); setProfile(readProfile(shop)); }
    catch (e) { setStats(null); setProfile(null); setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); api.get('/merchant/orders').then((r) => setRecent(readOrders(r).slice(0, 5))).catch((e) => { setRecent([]); setRecentError(errorMessage(e)); }); }, [load]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void api.get('/merchant/dashboard').then(data => { if (active) setStats(readDashboard(data)); }).catch(() => {});
        void api.get('/merchant/orders').then(data => { if (active) { setRecent(readOrders(data).slice(0, 5)); setRecentError(''); } }).catch(() => {});
      }, 100);
    };
    window.addEventListener('sb:orders-changed', refresh);
    return () => { active = false; clearTimeout(timer); window.removeEventListener('sb:orders-changed', refresh); };
  }, []);
  useEffect(() => {
    let active = true;
    setChartError(''); setEarnings(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    api.get(`/merchant/earnings?from=${encodeURIComponent(from)}`).then((data) => { if (active) setEarnings(data); }).catch((e) => { if (active) setChartError(e.message); });
    return () => { active = false; };
  }, [days]);

  const isOnline = stats?.isOnline ?? profile?.isOnline ?? false;
  const shopName = profile?.shopName ?? 'Your shop';
  const pending = stats?.pendingOrders;
  const preparing = stats?.preparingOrders;
  const ready = stats?.readyOrders;
  const deliveries = stats?.activeDeliveries;
  const inProgress = stats ? stats.pendingOrders + stats.preparingOrders + stats.readyOrders + stats.activeDeliveries : null;
  const points = earnings?.byDay ?? [];
  const volume = useMemo(() => points.reduce((sum, day) => sum + day.orders, 0), [points]);

  async function toggleOnline() {
    setBusy(true);
    try { const result = await api.post(isOnline ? '/merchant/offline' : '/merchant/online'); if (result?.ok !== true) throw new Error('The service did not confirm the shop status.'); await load(); window.dispatchEvent(new Event('sb:shop-status')); toast(isOnline ? 'You are now offline' : 'You are now online'); }
    catch (e) { toast(`${errorMessage(e)} Refresh the overview to verify the current status.`, false); }
    finally { setBusy(false); }
  }

  if (error) return <div className="ops-panel" role="alert">Unable to load your shop overview. {error} <button className="ops-button" onClick={load}>Retry</button></div>;
  if (loading && !stats) return <div className="ops-panel" role="status">Loading your shop overview…</div>;

  return <div className="ops-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="ops-kicker">Your shop, connected</div><h1 className="ops-title mt-2">A good day starts here.</h1><p className="ops-description">{shopName} · orders, stock and your delivery team.</p><div className="mt-2 flex items-center gap-2 text-xs"><Badge value={stats?.approvalStatus ?? profile?.approvalStatus ?? ''} /><span style={{ color: isOnline ? 'var(--sb-success)' : 'var(--sb-secondary)' }}>{isOnline ? '● Online' : '○ Offline'}</span><span style={{ color: 'var(--sb-secondary)' }}>{stats?.isOpen ? 'Store open' : 'Store closed'}</span></div></div><div className="flex flex-wrap items-center gap-2">{can(profile, 'STORE') && <button type="button" className={isOnline ? 'ops-button' : 'ops-button ops-button-primary'} disabled={busy} onClick={toggleOnline}>{busy ? 'Saving…' : isOnline ? 'Go offline' : 'Go online'}</button>}<Link to="/products" className={isOnline ? 'ops-button ops-button-primary' : 'ops-button'}>Add product</Link></div></div>
    <div className="ops-metrics"><Stat label="Online orders today" value={stats?.todayOrders ?? '—'} hint="Orders placed today, excluding POS" /><Stat label={`Delivered item value · ${days}d`} value={earnings ? pkr(earnings.grossSalesPaisa) : '—'} hint="Merchandise subtotal; delivery excluded" /><Stat label="Orders in progress" value={inProgress ?? '—'} hint="Awaiting, preparing, ready and with riders" /><Stat label="Low-stock products" value={stats?.lowStockProducts ?? '—'} hint="At or below your reorder threshold" /></div>
    <div className="ops-attention"><span>Your focus today</span><Link to="/orders">{pending ?? '—'} {pending === 1 ? 'order' : 'orders'} awaiting acceptance →</Link><Link to="/products">{stats?.lowStockProducts ?? '—'} products running low →</Link><Link to="/riders">Your merchant-owned riders →</Link></div>
    <div className="ops-analytics">
      <section className="ops-panel" aria-labelledby="merchant-chart-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="merchant-chart-title" className="ops-panel-title">{measure === 'orders' ? 'Delivered orders' : 'Delivered merchandise'}</h2><p className="ops-panel-description">By delivery date · last {days} days · your shop only</p></div><div className="ops-segment" role="group" aria-label="Chart measure"><button type="button" aria-pressed={measure === 'orders'} onClick={() => setMeasure('orders')}>Orders</button><button type="button" aria-pressed={measure === 'salesPaisa'} onClick={() => setMeasure('salesPaisa')}>Item value</button></div></div><div className="ops-chart-summary"><strong>{earnings ? measure === 'orders' ? volume : pkr(earnings.grossSalesPaisa) : '—'}</strong><span>{measure === 'orders' ? 'delivered orders' : 'merchandise subtotal'}</span></div>
        {chartError ? <p className="ops-empty" role="alert">Shop finance data unavailable: {chartError}. A staff account may need finance permission.</p> : !earnings ? <p className="ops-empty" role="status">Loading chart…</p> : points.length === 0 ? <p className="ops-empty">No delivered online orders in this period.</p> : <div className="ops-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--sb-border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: 'var(--sb-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v: number) => measure === 'orders' ? String(v) : pkr(v)} tick={{ fill: 'var(--sb-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={68} /><Tooltip formatter={(value) => measure === 'orders' ? `${value} orders` : pkr(Number(value))} contentStyle={{ background: 'var(--sb-panel)', border: '1px solid var(--sb-border)', borderRadius: 9, color: 'var(--sb-text)' }} /><Area type="monotone" dataKey={measure} stroke="var(--sb-accent)" fill="var(--sb-tint)" strokeWidth={2.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
        <div className="mt-3 flex items-center justify-between gap-2"><label className="text-xs" style={{ color: 'var(--sb-secondary)' }}>Period <select className="ops-button ms-2" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label><span className="ops-panel-description">No invented date buckets</span></div>
      </section>
      <section className="ops-panel" aria-labelledby="merchant-pipeline-title"><h2 id="merchant-pipeline-title" className="ops-panel-title">Order pipeline</h2><p className="ops-panel-description">Current online orders for this shop</p><div className="ops-chart-summary"><strong>{inProgress ?? '—'}</strong><span>orders in progress</span></div><div className="mt-5"><div className="ops-pipeline-row"><span>Awaiting acceptance</span><strong>{pending ?? '—'}</strong></div><div className="ops-pipeline-row"><span>Accepted / preparing</span><strong>{preparing ?? '—'}</strong></div><div className="ops-pipeline-row"><span>Ready for pickup</span><strong>{ready ?? '—'}</strong></div><div className="ops-pipeline-row"><span>With rider / at destination</span><strong>{deliveries ?? '—'}</strong></div></div><Link to="/orders" className="ops-button mt-5">View online orders</Link></section>
    </div>
    <section className="ops-panel" aria-labelledby="merchant-recent-title"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="merchant-recent-title" className="ops-panel-title">Recent online orders</h2><p className="ops-panel-description">Only orders for {shopName}</p></div><Link to="/orders" className="ops-button">View all</Link></div>{recentError ? <p className="ops-empty" role="alert">Recent orders unavailable: {recentError}</p> : recent.length === 0 ? <p className="ops-empty">No recent orders available.</p> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead><tbody>{recent.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.customer?.user?.fullName ?? '—'}</td><td>{pkr(order.totalAmountPaisa)}</td><td>{String(order.status).replace(/_/g, ' ')}</td></tr>)}</tbody></table></div>}</section>
    {node}
  </div>;
}
