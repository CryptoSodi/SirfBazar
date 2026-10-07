import { AppIcon } from './components/AppIcon';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getUser, isLoggedIn, logout } from './lib/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Sales from './pages/Sales';

const NAV = [
  ['/', 'Register', 'receipt'],
  ['/sales', 'Sales', 'overview'],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getUser();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <img src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" className="h-9 w-auto" />
          <div className="leading-tight">
            <div className="text-xs font-semibold">POS</div>
            <div className="text-[10px] text-slate-500">{user?.merchant?.shopName ?? 'In-store register'}</div>
          </div>
        </div>
        <nav className="flex gap-1">
          {NAV.map(([href, label, icon]) => (
            <Link
              key={href}
              to={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                location.pathname === href ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AppIcon name={icon} size={18} /> <AppIcon name={icon} size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <span className="hidden sm:inline">{user?.fullName ?? user?.phoneNumber ?? user?.email}</span>
          <button className="underline hover:text-slate-800" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Shell>
              <Register />
            </Shell>
          }
        />
        <Route
          path="/sales"
          element={
            <Shell>
              <Sales />
            </Shell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
