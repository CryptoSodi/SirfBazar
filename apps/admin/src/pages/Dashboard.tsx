import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, pkr } from '../lib/api';
import { Stat } from '../components/ui';

type Day = { date: string; orders: number; gmvPaisa: number; itemValuePaisa?: number };
type Analytics = { ordersByDay: Day[]; topProducts: Array<{ productId: string; name: string; quantity: number }> };
type Measure = 'orders' | 'itemValuePaisa';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');
  const [days, setDays] = useState(30);
  const [measure, setMeasure] = useState<Measure>('orders');

  useEffect(() => {
    api.get('/admin/dashboard').then(setStats).catch((e) => setError(e.message));
    api.get('/admin/orders?page=1&pageSize=5').then((r) => setRecent(r.items ?? [])).catch(() => undefined);
  }, []);
  useEffect(() => {
    let active = true;
    setChartError(''); setAnalytics(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    api.get(`/admin/analytics?from=${encodeURIComponent(from)}`).then((data) => { if (active) setAnalytics(data); }).catch((e) => { if (active) setChartError(e.message); });
    return () => { active = false; };
  }, [days]);

  const points = analytics?.ordersByDay ?? [];
  const itemValueAvailable = points.every((point) => typeof point.itemValuePaisa === 'number');
  const deliveredOrders = useMemo(() => points.reduce((sum, point) => sum + point.orders, 0), [points]);
  const itemValue = useMemo(() => points.reduce((sum, point) => sum + (point.itemValuePaisa ?? 0), 0), [points]);
  const attention = stats ? (stats.pendingMerchants ?? 0) + (stats.pendingTickets ?? 0) + (stats.pendingRefunds ?? 0) : 0;

  if (error) return <div className="ops-panel" role="alert">Unable to load the marketplace overview. {error} <button className="ops-button" onClick={() => location.reload()}>Retry</button></div>;
  if (!stats) return <div className="ops-panel" role="status">Loading marketplace overview…</div>;

  return <div className="ops-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="ops-kicker">SirfBazar / operations overview</div><h1 className="ops-title mt-2">Your marketplace, at a glance.</h1><p className="ops-description">Keep your shops moving. Focus on what needs you.</p></div><label className="flex items-center gap-2 text-xs" style={{ color: 'var(--sb-secondary)' }}>Chart period <select className="ops-button" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
    <div className="ops-metrics">
      <Stat label="Marketplace orders" value={stats.totalOrders ?? 0} hint="All recorded marketplace orders" />
      <Stat label={`Delivered item value · ${days}d`} value={analytics && itemValueAvailable ? pkr(itemValue) : '—'} hint="Merchandise subtotal, not platform revenue" />
      <Stat label="Merchants" value={stats.totalMerchants ?? 0} hint="All registered shops; approval varies" />
      <Stat label="Needs attention" value={attention} hint="Merchant reviews, tickets and refunds" />
    </div>
    <div className="ops-attention"><span>Your focus today</span><Link to="/merchants">{stats.pendingMerchants ?? 0} merchant reviews →</Link><Link to="/support">{stats.pendingTickets ?? 0} support cases →</Link><Link to="/refunds">{stats.pendingRefunds ?? 0} refund requests →</Link></div>
    <div className="ops-analytics">
      <section className="ops-panel" aria-labelledby="admin-chart-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="admin-chart-title" className="ops-panel-title">{measure === 'orders' ? 'Delivered orders' : 'Delivered merchandise'}</h2><p className="ops-panel-description">By order placement date · last {days} days</p></div><div className="ops-segment" role="group" aria-label="Chart measure"><button type="button" aria-pressed={measure === 'orders'} onClick={() => setMeasure('orders')}>Orders</button><button type="button" aria-pressed={measure === 'itemValuePaisa'} onClick={() => setMeasure('itemValuePaisa')}>Item value</button></div></div>
        <div className="ops-chart-summary"><strong>{analytics ? measure === 'orders' ? deliveredOrders : itemValueAvailable ? pkr(itemValue) : 'Unavailable' : '—'}</strong><span>{measure === 'orders' ? 'delivered orders' : 'merchandise subtotal'}</span></div>
        {chartError ? <p className="ops-empty" role="alert">Unable to load chart. {chartError}</p> : !analytics ? <p className="ops-empty" role="status">Loading chart…</p> : measure === 'itemValuePaisa' && !itemValueAvailable ? <p className="ops-empty">The local API has not exposed item-value analytics yet. Restart the updated API.</p> : points.length === 0 ? <p className="ops-empty">No delivered orders in this period.</p> : <div className="ops-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--sb-border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: 'var(--sb-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v: number) => measure === 'orders' ? String(v) : pkr(v)} tick={{ fill: 'var(--sb-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={68} /><Tooltip formatter={(value) => measure === 'orders' ? `${value} orders` : pkr(Number(value))} contentStyle={{ background: 'var(--sb-panel)', border: '1px solid var(--sb-border)', borderRadius: 9, color: 'var(--sb-text)' }} /><Area type="monotone" dataKey={measure} stroke="var(--sb-accent)" fill="var(--sb-tint)" strokeWidth={2.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
        <p className="ops-panel-description mt-2">{points.length} recorded date buckets. Missing days are not invented.</p>
      </section>
      <section className="ops-panel" aria-labelledby="admin-pipeline-title"><h2 id="admin-pipeline-title" className="ops-panel-title">Order status snapshot</h2><p className="ops-panel-description">All-time counts currently supplied by the API</p><div className="ops-chart-summary"><strong>{stats.activeOrders ?? 0}</strong><span>active orders</span></div><div className="mt-5"><div className="ops-pipeline-row"><span>Active</span><strong>{stats.activeOrders ?? 0}</strong></div><div className="ops-pipeline-row"><span>Completed</span><strong>{stats.completedOrders ?? 0}</strong></div><div className="ops-pipeline-row"><span>Cancelled</span><strong>{stats.cancelledOrders ?? 0}</strong></div></div><p className="ops-panel-description mt-4">A stage-by-stage pipeline needs a status-count endpoint; orders are not omitted from a fabricated breakdown.</p><Link to="/orders" className="ops-button mt-5">View all orders</Link></section>
    </div>
    <section className="ops-panel" aria-labelledby="recent-orders-title"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="recent-orders-title" className="ops-panel-title">Recent orders</h2><p className="ops-panel-description">Latest marketplace records</p></div><Link to="/orders" className="ops-button">View all</Link></div>{recent.length === 0 ? <p className="ops-empty">No recent orders available.</p> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th scope="col">Order</th><th scope="col">Shop</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead><tbody>{recent.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.merchant?.shopName ?? 'Parent order'}</td><td>{order.customer?.user?.fullName ?? '—'}</td><td>{pkr(order.totalAmountPaisa)}</td><td>{String(order.status).replace(/_/g, ' ')}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
