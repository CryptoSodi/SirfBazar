import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, clearSession, getUser, isLoggedIn, isMerchant, logout } from './lib/api';
import { readProfile, type MerchantProfile } from './lib/merchant-contracts';
import { ReferenceIcon, type ReferenceIconName } from './components/ReferenceIcon';
import { NotificationBell } from './components/NotificationBell';
import { NewOrderAlert } from './components/NewOrderAlert';
import { ThemeControl, ThemeProvider } from './components/ThemeStudio';
import { PageSkeleton } from './components/Skeleton';
import { readMemory, writeMemory } from './lib/memoryCache';
import SignInPage from './auth/SignInPage';
import SignupFlowPage from './auth/SignupFlowPage';
import RecoveryPage from './auth/RecoveryPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Products = lazy(() => import('./pages/Products'));
const Riders = lazy(() => import('./pages/Riders'));
const Team = lazy(() => import('./pages/Team'));
const Earnings = lazy(() => import('./pages/Earnings'));
const Profile = lazy(() => import('./pages/Profile'));
const Support = lazy(() => import('./pages/Support'));
const IPos = lazy(() => import('./pages/IPos'));

const NAV: Array<{ href: string; label: string; icon: ReferenceIconName }> = [
  { href: '/', label: 'Overview', icon: 'overview' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/products', label: 'Products', icon: 'package' },
  { href: '/ipos', label: 'iPOS', icon: 'monitor' },
  { href: '/riders', label: 'Riders', icon: 'rider' },
  { href: '/team', label: 'Team', icon: 'team' },
  { href: '/earnings', label: 'Earnings & settlements', icon: 'finance' },
  { href: '/profile', label: 'Shop settings', icon: 'settings' },
  { href: '/support', label: 'Help & support', icon: 'support' },
];

function initials(name?: string | null) {
  return (name || 'Merchant').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [profile, setProfile] = useState<MerchantProfile | null>(() => readMemory<MerchantProfile>('merchant:profile') ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('sb:sidebar-collapsed') === 'true'; } catch { return false; } });
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const user = getUser();
  const current = NAV.find((item) => item.href === location.pathname) ?? NAV[0];
  const date = useMemo(() => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Karachi' }).format(new Date()), []);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/merchant-v2.css'; link.id = 'merchant-v2-reference-css';
    document.head.appendChild(link);
    document.body.classList.add('merchant-v2-active');
    return () => { link.remove(); document.body.classList.remove('merchant-v2-active'); };
  }, []);
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [location.pathname]);
  useEffect(() => { try { localStorage.setItem('sb:sidebar-collapsed', String(sidebarCollapsed)); } catch { /* Storage is optional. */ } }, [sidebarCollapsed]);
  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [accountOpen]);
  useEffect(() => {
    let active = true;
    const refresh = () => void Promise.all([api.get('/auth/me'), api.get('/merchant/profile')]).then(([identity, shop]) => {
      if (!isMerchant(identity) || identity.id !== getUser()?.id) { clearSession(); return; }
      if (active) { const nextProfile = readProfile(shop); setProfile(nextProfile); writeMemory('merchant:profile', nextProfile); }
    }).catch(() => undefined);
    refresh();
    window.addEventListener('sb:shop-status', refresh);
    return () => { active = false; window.removeEventListener('sb:shop-status', refresh); };
  }, []);
  if (!isLoggedIn()) return <Navigate to="/sign-in" replace />;

  const shopName = profile?.shopName ?? user?.merchant?.shopName ?? 'Your shop';
  const owner = user?.fullName ?? user?.phoneNumber ?? 'Shop owner';
  return <div className={`merchant-workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <NewOrderAlert />
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Merchant workspace navigation">
      <div className="sidebar-brand"><Link className="logo-wrap" to="/" aria-label="SirfBazar overview"><img className="brand-svg" src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" /><img className="compact-brand-svg" src="/brand/sirfbazar-basket.svg" alt="" /><img className="compact-brand-svg dark" src="/brand/sirfbazar-basket-white.svg" alt="" /></Link><button type="button" className="sidebar-toggle icon-btn" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}><ReferenceIcon name={sidebarCollapsed ? 'right' : 'back'} size="sm" /></button></div>
      <div className="store-card" title={shopName}><span className="store-monogram">{initials(shopName)}</span><span className="store-copy"><b>{shopName}</b><small>{profile?.approvalStatus === 'APPROVED' ? 'Your merchant workspace' : profile?.approvalStatus ?? 'Merchant workspace'}</small></span></div>
      <div className="kicker">Your workspace</div>
      <nav className="nav">
        {NAV.map((item) => <Link key={item.href} to={item.href} className={location.pathname === item.href ? 'active' : ''} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} aria-current={location.pathname === item.href ? 'page' : undefined}><ReferenceIcon name={item.icon} /><span className="nav-label">{item.label}</span></Link>)}
      </nav>
      <div className="sidebar-lower">
        <div className="user"><div className="user-row"><span className="avatar">{initials(owner)}</span><span className="user-copy"><b>{owner}</b><small>Shop owner · Merchant</small></span></div><img className="slogan-svg" src="/brand/sirfbazar-slogan-urdu.svg" alt="بازار وہی، طریقہ نیا" /></div>
      </div>
    </aside>
    {menuOpen && <button type="button" className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <section className="workspace">
      <header className="topbar">
        <button className="icon-btn mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><ReferenceIcon name="menu" /></button>
        <div className="breadcrumbs"><span className="base">Merchant workspace</span><span>/</span><strong>{current.label}</strong></div>
        <div className="top-controls"><span className="top-text">{date}</span><span className="subtle-divider" /><ThemeControl /><NotificationBell /><div className="account-control" ref={accountRef}><button type="button" className="avatar account-trigger" aria-label="Open account menu" aria-expanded={accountOpen} aria-controls="merchant-account-menu" onClick={() => setAccountOpen((value) => !value)}>{initials(owner)}</button>{accountOpen && <div className="account-menu" id="merchant-account-menu"><div className="account-menu-identity"><strong>{owner}</strong><small>{shopName}</small></div><Link to="/profile" onClick={() => setAccountOpen(false)}><ReferenceIcon name="settings" size="sm" /> Shop settings</Link><Link to="/support" onClick={() => setAccountOpen(false)}><ReferenceIcon name="support" size="sm" /> Help & support</Link><button type="button" onClick={() => void logout()}><ReferenceIcon name="back" size="sm" /> Sign out</button></div>}</div></div>
      </header>
      <main id="main-content"><Suspense fallback={<PageSkeleton label="Loading workspace" />}>{children}</Suspense></main>
    </section>
  </div>;
}

const PAGES = [
  ['/', Dashboard], ['/orders', Orders], ['/products', Products], ['/ipos', IPos], ['/riders', Riders], ['/team', Team], ['/earnings', Earnings], ['/profile', Profile], ['/support', Support],
] as const;

export default function App() {
  return <ThemeProvider><BrowserRouter><Routes>
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path="/sign-up" element={<SignupFlowPage />} />
    <Route path="/recover" element={<RecoveryPage />} />
    <Route path="/recover/preview-code" element={<RecoveryPage previewCode />} />
    <Route path="/login" element={<Navigate to="/sign-in" replace />} />
    <Route path="/register" element={<Navigate to="/sign-up" replace />} />
    <Route path="/workspace" element={<Navigate to="/" replace />} />
    {PAGES.map(([path, Page]) => <Route key={path} path={path} element={<Shell><Page /></Shell>} />)}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></ThemeProvider>;
}
