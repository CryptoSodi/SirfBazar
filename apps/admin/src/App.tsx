import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Bike, ClipboardList, Grid2X2, Headphones, LayoutDashboard, Package, Palette, RotateCcw, ScrollText, Store, Tag, Users, Wallet } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { getUser, isLoggedIn, logout } from './lib/api';
import { ThemeProvider, useThemeStudio } from './components/ThemeStudio';
import Login from './pages/Login';
import AdminHeaderTools from './components/AdminHeaderTools';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Merchants = lazy(() => import('./pages/Merchants'));
const Riders = lazy(() => import('./pages/Riders'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Coupons = lazy(() => import('./pages/Coupons'));
const Refunds = lazy(() => import('./pages/Refunds'));
const Settlements = lazy(() => import('./pages/Settlements'));
const Support = lazy(() => import('./pages/Support'));
const Audit = lazy(() => import('./pages/Audit'));

const GROUPS = [
  { label: 'Workspace', links: [['/', 'Overview', LayoutDashboard], ['/orders', 'All orders', ClipboardList]] },
  { label: 'Marketplace', links: [['/merchants', 'Merchants', Store], ['/products', 'Catalogue moderation', Package], ['/categories', 'Categories & units', Grid2X2], ['/customers', 'Customers', Users], ['/riders', 'Merchant riders', Bike]] },
  { label: 'Operations', links: [['/refunds', 'Returns & refunds', RotateCcw], ['/support', 'Support inbox', Headphones], ['/settlements', 'Settlements & COD', Wallet], ['/coupons', 'Promotions', Tag], ['/audit', 'Audit activity', ScrollText]] },
] as const;
const PAGES = {
  '/': Dashboard, '/orders': Orders, '/merchants': Merchants, '/products': Products,
  '/categories': Categories, '/customers': Customers, '/riders': Riders,
  '/refunds': Refunds, '/support': Support, '/settlements': Settlements,
  '/coupons': Coupons, '/audit': Audit,
};

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getUser();
  const { open, theme } = useThemeStudio();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const current = GROUPS.flatMap((g) => g.links.map(([href, label]) => ({ href, label }))).find((item) => item.href === location.pathname);
  return (
    <div className="ops-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <aside className="ops-sidebar" data-sidebar={theme.sidebar}>
        <div className="ops-sidebar-brand"><Link to="/" aria-label="SirfBazar admin overview"><img src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" /></Link></div>
        <div className="ops-sidebar-card"><strong>SirfBazar marketplace</strong><small>Platform administration</small></div>
        <nav className="ops-nav" aria-label="Admin navigation">
          {GROUPS.map((group) => <div key={group.label}><div className="ops-nav-group">{group.label}</div>{group.links.map(([href, label, Icon]) => <Link key={href} to={href} className="ops-nav-link" aria-current={location.pathname === href ? 'page' : undefined}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>)}</div>)}
        </nav>
        <div className="ops-sidebar-footer"><img src="/brand/sirfbazar-slogan-urdu.svg" alt="بازار وہی۔ طریقہ نیا۔" style={{ width: 185, maxWidth: '100%' }} /><small>One bazar. A complete overview.</small></div>
      </aside>
      <div className="ops-frame">
        <header className="ops-topbar"><div><small>Marketplace&nbsp; › &nbsp;</small><strong>{current?.label ?? 'Overview'}</strong></div><div className="ops-topbar-actions"><AdminHeaderTools openTheme={open} />{import.meta.env.MODE !== 'production' && <button type="button" className="ops-button" onClick={open}><Palette size={16} aria-hidden="true" />Theme Studio</button>}<div className="ops-identity"><strong>{user?.fullName ?? user?.email ?? 'Admin'}</strong><span>{user?.role?.replace(/_/g, ' ').toLowerCase()}</span></div><button type="button" className="ops-button" onClick={logout}>Sign out</button></div></header>
        <main id="main-content" className="ops-main"><Suspense fallback={<div className="ops-panel" role="status">Loading workspace…</div>}>{children}</Suspense></main>
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
