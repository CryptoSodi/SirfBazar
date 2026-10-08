import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, captureSession, errorMessage, pkr, sessionIsCurrent } from '../lib/api';
import { can, readDashboard, readListingsPage, readOrdersPage, readProfile, readRiders, type DashboardSummary, type MerchantOrder, type MerchantProfile, type MerchantRider } from '../lib/merchant-contracts';
import { AvailabilitySwitch } from '../components/AvailabilitySwitch';
import { useToast } from '../components/Toast';
import { ReferenceIcon, type ReferenceIconName } from '../components/ReferenceIcon';
import { DashboardSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

type Listing = { id: string; stockQuantity: number; lowStockThreshold?: number | null; product?: { name?: string; size?: string | null; unit?: string | null } };
type Day = { date: string; orders: number; salesPaisa: number };
type Earnings = { grossSalesPaisa: number; byDay: Day[] };
type DashboardCache = { stats: DashboardSummary; profile: MerchantProfile; orders: MerchantOrder[]; riders: MerchantRider[]; listings: Listing[]; earnings: Earnings | null };

const attentionStatuses = new Set(['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']);
const money = (value: number) => pkr(value).replace('.00', '');
const time = (value: string) => new Intl.DateTimeFormat('en-PK', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
const statusMeta = (status: string) => status === 'SENT_TO_MERCHANT' ? ['New order', 'amber'] : status === 'READY_FOR_PICKUP' ? ['Ready for pickup', 'green'] : [status.replaceAll('_', ' ').toLowerCase(), 'blue'];

export default function Dashboard() {
  const { toast } = useToast();
  const cached = readMemory<DashboardCache>('dashboard');
  const [stats, setStats] = useState<DashboardSummary | null>(cached?.stats ?? null);
  const [profile, setProfile] = useState<MerchantProfile | null>(cached?.profile ?? null);
  const [orders, setOrders] = useState<MerchantOrder[]>(cached?.orders ?? []);
  const [riders, setRiders] = useState<MerchantRider[]>(cached?.riders ?? []);
  const [listings, setListings] = useState<Listing[]>(cached?.listings ?? []);
  const [earnings, setEarnings] = useState<Earnings | null>(cached?.earnings ?? null);
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [partialError, setPartialError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const captured = captureSession();
    setLoading(true); setError(''); setPartialError('');
    try {
      const [nextStats, nextProfile] = await Promise.all([api.getParsed('/merchant/dashboard', readDashboard), api.getParsed('/merchant/profile', readProfile)]);
      if (!sessionIsCurrent(captured)) return;
      setStats(nextStats); setProfile(nextProfile);
      const results = await Promise.allSettled([api.getParsed('/merchant/orders?page=1&pageSize=5&attention=true', readOrdersPage), api.getParsed('/merchant/riders', readRiders), api.getParsed('/merchant/products?page=1&pageSize=3&lowStock=true', readListingsPage), api.get('/merchant/earnings')]);
      if (!sessionIsCurrent(captured)) return;
      const previous = readMemory<DashboardCache>('dashboard');
      const nextOrders = results[0].status === 'fulfilled' ? results[0].value.items : previous?.orders ?? [];
      const nextRiders = results[1].status === 'fulfilled' ? results[1].value : previous?.riders ?? [];
      const nextListings = results[2].status === 'fulfilled' ? results[2].value.items : previous?.listings ?? [];
      const nextEarnings = results[3].status === 'fulfilled' ? results[3].value as Earnings : previous?.earnings ?? null;
      setOrders(nextOrders); setRiders(nextRiders); setListings(nextListings); setEarnings(nextEarnings);
      writeMemory<DashboardCache>('dashboard', { stats: nextStats, profile: nextProfile, orders: nextOrders, riders: nextRiders, listings: nextListings, earnings: nextEarnings });
      setUpdatedAt(new Date());
      if (results.some((result) => result.status === 'rejected')) setPartialError('Some workspace sections could not be loaded. Refresh to try them again.');
    } catch (cause) {
      if (!sessionIsCurrent(captured)) return;
      if (readMemory('dashboard')) setPartialError(`Could not refresh the workspace. Showing the last loaded values. ${errorMessage(cause)}`);
      else { setStats(null); setProfile(null); setError(errorMessage(cause)); }
    }
    finally { if (sessionIsCurrent(captured)) setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => { if (!document.hidden) { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 100); } };
    window.addEventListener('sb:orders', refresh);
    window.addEventListener('sb:products', refresh);
    window.addEventListener('sb:riders', refresh);
    window.addEventListener('sb:merchant', refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener('sb:orders', refresh); window.removeEventListener('sb:products', refresh); window.removeEventListener('sb:riders', refresh); window.removeEventListener('sb:merchant', refresh); };
  }, [load]);

  const attention = useMemo(() => orders.filter((order) => attentionStatuses.has(order.status)).slice(0, 5), [orders]);
  const lowStock = useMemo(() => listings.filter((item) => item.lowStockThreshold != null && item.stockQuantity <= item.lowStockThreshold).slice(0, 3), [listings]);
  const bars = earnings?.byDay?.slice(-7) ?? [];
  const maxBar = Math.max(1, ...bars.map((item) => item.salesPaisa));
  const isOnline = stats?.isOnline ?? false;

  async function toggleOnline() {
    if (busyRef.current || !can(profile, 'STORE')) return;
    busyRef.current = true; setBusy(true);
    const captured = captureSession();
    try {
      const saved = await api.post(isOnline ? '/merchant/offline' : '/merchant/online');
      if (!sessionIsCurrent(captured)) return;
      if (typeof saved?.isOnline !== 'boolean') throw new Error('The saved shop availability could not be confirmed.');
      setStats((current) => current ? { ...current, isOnline: saved.isOnline } : current);
      toast(`Shop availability saved: ${saved.isOnline ? 'Online' : 'Offline'}.`);
      window.dispatchEvent(new Event('sb:shop-status'));
    } catch (cause) {
      if (!sessionIsCurrent(captured)) return;
      await load(); // An ambiguous response requires the server's saved value.
      toast(`Availability could not be saved. Try again. ${errorMessage(cause)}`, false);
    } finally { busyRef.current = false; if (sessionIsCurrent(captured)) setBusy(false); }
  }

  if (loading && !stats) return <DashboardSkeleton />;
  if (error || !stats || !profile) return <><div className="page-heading"><div><div className="kicker">Your workspace</div><h1>Overview</h1></div></div><section className="panel error-state" role="alert"><div><span className="empty-state-icon"><ReferenceIcon name="refresh" size="lg" /></span><h2>We couldn’t load your workspace</h2><p>{error || 'The merchant service returned an incomplete response.'} No sample data has been substituted.</p><button className="btn primary" type="button" onClick={() => void load()}>Retry</button></div></section></>;

  const stages: Array<[string, number, string, ReferenceIconName, string]> = [
    ['New', stats.pendingOrders, 'Review and accept', 'orders', 'amber'],
    ['Preparing', stats.preparingOrders, 'Accepted + in preparation', 'package', 'blue'],
    ['Ready', stats.readyOrders, 'Assign your rider', 'checkCircle', 'green'],
    ['Delivering', stats.activeDeliveries, 'Assigned and on the way', 'rider', ''],
  ];
  return <>
    <div className="page-heading"><div><div className="kicker">{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' }).format(new Date()).toUpperCase()}</div><h1>Your shop, in focus.</h1><p>Orders to prepare. Riders to assign. Everything in one place.</p></div><div className="heading-actions"><div><AvailabilitySwitch online={isOnline} disabled={!can(profile, 'STORE')} busy={busy} onToggle={() => void toggleOnline()} />{!can(profile, 'STORE') && <small className="small muted" style={{ display: 'block' }}>You need shop settings permission to change availability.</small>}</div><Link className="btn primary" to="/products"><ReferenceIcon name="plus" /> Add product</Link></div></div>
    {partialError && <div className="state-banner warn" role="alert"><ReferenceIcon name="alert" /><span>{partialError}</span><button className="btn tiny" onClick={() => void load()}>Refresh</button></div>}
    {stats.todayOrders === 0 && <div className="state-banner"><ReferenceIcon name="store" /><span><b>Your workspace is ready. Make it your own.</b><small>Add products, review your shop details and check the returned approval status.</small></span><Link className="btn tiny" to="/profile">Shop setup <ReferenceIcon name="arrow" size="sm" /></Link></div>}
    <section className="metrics" aria-label="Today’s shop summary">
      <Metric label="Orders today" value={String(stats.todayOrders)} sub="Orders placed today" icon="orders" />
      <Metric label="Delivered today" value={String(stats.completedToday)} sub="Completed online deliveries" icon="checkCircle" />
      <Metric label="Delivered order value" value={money(stats.todaySalesPaisa)} sub="Recorded totals · includes fees" icon="finance" featured />
      <Metric label="Low-stock listings" value={String(stats.lowStockProducts)} sub="At or below each product’s threshold" icon="package" />
    </section>
    <div className="pipeline">{stages.map(([label, value, sub, icon, tone]) => <Link className="stage" to="/orders" key={label}><span className={`stage-icon ${tone}`}><ReferenceIcon name={icon} /></span><span><b>{value}</b> &nbsp;<strong>{label}</strong><p>{sub}</p></span><ReferenceIcon name="right" size="sm" /></Link>)}</div>
    <div className="columns">
      <section className="panel"><div className="panel-head"><div><h2>Orders needing attention <span className="badge amber">{attention.length}</span></h2><p>Review new orders. Keep ready pickups moving.</p></div><Link className="panel-link" to="/orders">All orders <ReferenceIcon name="arrow" size="sm" /></Link></div>{attention.length === 0 ? <div className="empty"><span className="empty-state-icon"><ReferenceIcon name="orders" size="lg" /></span><h3>Your first order will appear here</h3><p>Orders and delivery updates will stay together in this workspace.</p></div> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Next step</th></tr></thead><tbody>{attention.map((order) => { const [label, tone] = statusMeta(order.status); return <tr key={order.id}><td><b>{order.orderNumber}</b><span className="subline">{time(order.createdAt)} · {order.items.length} items</span></td><td><b>{order.customer?.user?.fullName || 'Customer'}</b><span className="subline">{order.deliveryAddress?.city || '—'}</span></td><td><b>{money(order.totalAmountPaisa)}</b><span className="subline">Online order</span></td><td><span className={`badge ${tone}`}><span className="dot" />{label}</span></td><td className="table-action"><Link className={`btn tiny ${order.status === 'READY_FOR_PICKUP' ? 'primary' : ''}`} to="/orders">{order.status === 'READY_FOR_PICKUP' ? 'Assign rider' : 'Review'} <ReferenceIcon name="right" size="sm" /></Link></td></tr>; })}</tbody></table></div>}<div className="panel-foot"><span>Open an order to review items and continue its next step.</span><span><ReferenceIcon name="lock" size="sm" /> Your shop only</span></div></section>
      <section className="panel rider-panel"><div className="panel-head"><div><h2>Your delivery team</h2><p>The people behind your deliveries.</p></div><ReferenceIcon name="rider" /></div><div className="rider-list">{riders.slice(0, 4).map((rider) => <div className="rider-row" key={rider.id}><span className={`avatar ${rider.isOnline ? '' : 'blue'}`}>{rider.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0,2)}</span><span><b>{rider.fullName}</b><p>{rider.vehicleType.replaceAll('_', ' ').toLowerCase()}</p></span><span className="rider-end"><span className={`badge ${rider.isOnline ? 'green' : ''}`}><span className="dot" />{rider.isOnline ? 'Online' : 'Offline'}</span><small>{rider.currentOrderId ? 'On a delivery' : 'Idle'}</small></span></div>)}</div>{riders.length === 0 && <div className="empty"><p>No riders added yet.</p></div>}<div className="hint">Assignment is available after an order is ready for pickup.</div><div className="panel-foot"><span /><Link className="panel-link" to="/riders">Manage riders <ReferenceIcon name="arrow" size="sm" /></Link></div></section>
    </div>
    <div className="columns bottom"><section className="panel"><div className="panel-head"><div><h2>Delivered merchandise</h2><p>Delivered online orders · item value</p></div><div className="segmented"><button className="active" type="button">7 days</button><button type="button">30 days</button></div></div><div className="chart-section"><div className="chart-heading"><b>{earnings ? money(earnings.grossSalesPaisa) : '—'}</b><small>Merchandise subtotal · last 7 days</small></div>{bars.length ? <svg className="chart" viewBox="0 0 700 160" role="img" aria-label="Delivered merchandise for the last seven loaded dates">{bars.map((item, index) => { const height = Math.max(3, item.salesPaisa / maxBar * 100); const x = 65 + index * 88; return <g key={item.date}><rect className={`bar ${index === bars.length - 1 ? 'last' : ''}`} x={x} y={120-height} width="48" height={height} rx="3" /><text x={x+24} y="145" textAnchor="middle">{item.date.slice(5)}</text></g>; })}</svg> : <div className="empty"><p>No delivered merchandise in this period.</p></div>}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Stock to review</h2><p>Restock before the next order.</p></div><Link className="panel-link" to="/products">View all <ReferenceIcon name="arrow" size="sm" /></Link></div>{lowStock.map((item) => <div className="stock-row" key={item.id}><span className="product-thumb"><ReferenceIcon name="package" /></span><span><b>{item.product?.name || 'Product'}</b><p>{item.product?.size || item.product?.unit || 'Listing'}</p></span><span className="qty"><b style={{ color: item.stockQuantity === 0 ? 'var(--red)' : 'var(--amber)' }}>{item.stockQuantity === 0 ? 'Out of stock' : `${item.stockQuantity} left`}</b><small>Alert at {item.lowStockThreshold}</small></span><Link className="icon-btn" to="/products" aria-label={`Edit ${item.product?.name || 'product'}`}><ReferenceIcon name="edit" size="sm" /></Link></div>)}{lowStock.length === 0 && <div className="empty"><span className="empty-state-icon"><ReferenceIcon name="checkCircle" size="lg" /></span><h3>Stock looks clear</h3><p>No confirmed low-stock records.</p></div>}</section></div>
    <div className="footer-note"><span>Ordered on SirfBazar. Prepared by your shop.</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · ` : ''}{profile.shopName}</span></div>
  </>;
}

function Metric({ label, value, sub, icon, featured = false }: { label: string; value: string; sub: string; icon: ReferenceIconName; featured?: boolean }) {
  const hasCurrency = value.startsWith('Rs');
  return <article className={`metric ${featured ? 'featured' : ''}`}><div className="metric-top"><span className="label">{label}</span><span className="metric-icon"><ReferenceIcon name={icon} /></span></div><div className="value">{hasCurrency ? <>{value.slice(0,2)} <strong>{value.slice(3)}</strong></> : value}</div><div className="sub">{sub}</div></article>;
}
