import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getUser, isLoggedIn, logout } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Merchants from './pages/Merchants';
import Riders from './pages/Riders';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Coupons from './pages/Coupons';
import Refunds from './pages/Refunds';
import Settlements from './pages/Settlements';
import Support from './pages/Support';
import Audit from './pages/Audit';

const NAV = [
  ['/', '📊 Dashboard'],
  ['/orders', '📦 Orders'],
  ['/merchants', '🏪 Merchants'],
  ['/riders', '🛵 Riders'],
  ['/customers', '👥 Customers'],
  ['/products', '🏷️ Products'],
  ['/categories', '🗂️ Categories'],
  ['/coupons', '🎟️ Coupons'],
  ['/refunds', '↩️ Refunds'],
  ['/settlements', '💰 Settlements'],
  ['/support', '🎧 Support'],
  ['/audit', '🧾 Audit log'],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getUser();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-slate-900 text-slate-200">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 font-black text-white">SB</span>
          <div>
            <div className="text-sm font-extrabold text-white">SirfBazar</div>
            <div className="text-[10px] text-slate-400">Admin console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              to={href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                location.pathname === href ? 'bg-emerald-600 font-semibold text-white' : 'hover:bg-slate-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-xs">
          <div className="truncate font-medium text-white">{user?.fullName ?? user?.email}</div>
          <div className="text-slate-400">{user?.role?.replace(/_/g, ' ').toLowerCase()}</div>
          <button className="mt-2 text-slate-400 underline hover:text-white" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {NAV.map(([href]) => {
          const Page = {
            '/': Dashboard,
            '/orders': Orders,
            '/merchants': Merchants,
            '/riders': Riders,
            '/customers': Customers,
            '/products': Products,
            '/categories': Categories,
            '/coupons': Coupons,
            '/refunds': Refunds,
            '/settlements': Settlements,
            '/support': Support,
            '/audit': Audit,
          }[href]!;
          return (
            <Route
              key={href}
              path={href}
              element={
                <Shell>
                  <Page />
                </Shell>
              }
            />
          );
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
