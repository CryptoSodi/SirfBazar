import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Bike, ClipboardList, LayoutDashboard, Package, Palette, Settings, Wallet, Monitor } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { api, clearSession, getUser, isLoggedIn, isMerchant, logout } from './lib/api';
import { can, readProfile, type MerchantProfile } from './lib/merchant-contracts';
import OrderAlerts from './components/OrderAlerts';
import { ThemeProvider, useThemeStudio } from './components/ThemeStudio';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Products = lazy(() => import('./pages/Products'));
const Riders = lazy(() => import('./pages/Riders'));
const Earnings = lazy(() => import('./pages/Earnings'));
const Profile = lazy(() => import('./pages/Profile'));
const IPos = lazy(() => import('./pages/IPos'));

const GROUPS = [
  { label: 'Workspace', links: [['/', 'Overview', LayoutDashboard], ['/orders', 'Online orders', ClipboardList]] },
  { label: 'Inventory', links: [['/products', 'Products', Package]] },
  { label: 'Sales & delivery', links: [['/ipos', 'iPOS', Monitor], ['/riders', 'My riders', Bike], ['/earnings', 'Settlements & COD', Wallet]] },
  { label: 'Business', links: [['/profile', 'Shop settings', Settings]] },
] as const;
const PAGES = { '/': Dashboard, '/orders': Orders, '/products': Products, '/riders': Riders, '/earnings': Earnings, '/profile': Profile, '/ipos': IPos };

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [shopStatus, setShopStatus] = useState<MerchantProfile | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [, setSessionTick] = useState(0);
  const user = getUser();
  const { open, theme } = useThemeStudio();
  useEffect(() => {
    const onSession = () => setSessionTick((value) => value + 1);
    window.addEventListener('sb:session', onSession);
    return () => window.removeEventListener('sb:session', onSession);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void Promise.all([api.get('/auth/me'), api.get('/merchant/profile')]).then(([identity, profile]) => {
        if (!isMerchant(identity) || identity.id !== getUser()?.id) { clearSession(); return; }
        if (active) { setShopStatus(readProfile(profile)); setStatusError(false); }
      }).catch(() => { if (active) setStatusError(true); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('sb:shop-status', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('sb:shop-status', refresh); };
  }, []);
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const current = GROUPS.flatMap((g) => g.links.map(([href, label]) => ({ href, label }))).find((item) => item.href === location.pathname);
  return (
    <div className="ops-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <aside className="ops-sidebar" data-sidebar={theme.sidebar}>
        <div className="ops-sidebar-brand"><Link to="/" aria-label="SirfBazar merchant overview"><img src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" /></Link></div>
        <div className="ops-sidebar-card"><strong>{shopStatus?.shopName ?? user?.merchant?.shopName ?? 'Your shop'}</strong><small>Merchant workspace</small></div>
        <nav className="ops-nav" aria-label="Merchant navigation">
          {GROUPS.map((group) => <div key={group.label}><div className="ops-nav-group">{group.label}</div>{group.links.map(([href, label, Icon]) => <Link key={href} to={href} className="ops-nav-link" aria-current={location.pathname === href ? 'page' : undefined}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>)}</div>)}
        </nav>
        <div className="ops-sidebar-footer"><img src="/brand/sirfbazar-slogan-urdu.svg" alt="بازار وہی۔ طریقہ نیا۔" style={{ width: 185, maxWidth: '100%' }} /><small>Your shop. Connected.</small></div>
      </aside>
      <div className="ops-frame">
        <header className="ops-topbar"><div><small>Workspace&nbsp; › &nbsp;</small><strong>{current?.label ?? 'Overview'}</strong></div><div className="ops-topbar-actions"><Link to="/profile" className="ops-live-status" aria-label={`Shop status: ${statusError ? 'unavailable' : !shopStatus ? 'loading' : shopStatus.isOnline ? 'online' : 'offline'}. Open shop settings`}><span className={`ops-live-dot ${shopStatus?.isOnline && !statusError ? 'is-online' : ''}`} /><span>{statusError ? 'Status unavailable' : !shopStatus ? 'Checking status' : shopStatus.isOnline ? 'Online' : 'Offline'}</span><small>{shopStatus && !statusError ? shopStatus.approvalStatus !== 'APPROVED' ? shopStatus.approvalStatus : shopStatus.isOpen ? 'Store open' : 'Store closed' : ''}</small></Link>{import.meta.env.MODE !== 'production' && <button type="button" className="ops-button" onClick={open}><Palette size={16} aria-hidden="true" />Theme Studio</button>}<div className="ops-identity"><strong>{user?.fullName ?? user?.phoneNumber ?? 'Store owner'}</strong><span>{shopStatus?.shopName ?? user?.merchant?.shopName ?? 'Merchant account'}</span></div><button type="button" className="ops-button" onClick={() => void logout()}>Sign out</button></div></header>
        <main id="main-content" className="ops-main">{shopStatus && can(shopStatus, 'ORDERS') && <OrderAlerts key={`${user?.id}:${shopStatus.id}`} merchantId={shopStatus.id} />}<Suspense fallback={<div className="ops-panel" role="status">Loading workspace…</div>}>{children}</Suspense></main>
      </div>
    </div>
  );
}

export default function App() {
  return <ThemeProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    {Object.entries(PAGES).map(([path, Page]) => <Route key={path} path={path} element={<Shell><Page /></Shell>} />)}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></ThemeProvider>;
}
