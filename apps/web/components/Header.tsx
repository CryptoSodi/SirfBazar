'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchCart, getStoredUser, isLoggedIn } from '@/lib/api';
import { useLocation } from '@/lib/location';
import { LocationPicker } from './LocationPicker';

export function Header() {
  const router = useRouter();
  const { location } = useLocation();
  const [q, setQ] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const onAuth = () => setUser(getStoredUser());
    const onCart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemCount != null) setCartCount(detail.itemCount);
      else refreshCart();
    };
    const refreshCart = () =>
      fetchCart()
        .then((c) => setCartCount(c.itemCount ?? 0))
        .catch(() => undefined);
    refreshCart();
    window.addEventListener('sb:auth', onAuth);
    window.addEventListener('sb:cart', onCart);
    return () => {
      window.removeEventListener('sb:auth', onAuth);
      window.removeEventListener('sb:cart', onCart);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">
            SB
          </span>
          <div className="hidden sm:block">
            <div className="text-lg font-extrabold leading-tight text-emerald-700">SirfBazar</div>
            <div className="-mt-0.5 text-[10px] text-stone-500">Your nearby bazar, now online</div>
          </div>
        </Link>

        <button
          onClick={() => setPickerOpen(true)}
          className="hidden min-w-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-left text-xs hover:bg-stone-50 md:flex"
        >
          <span>📍</span>
          <span className="max-w-[160px] truncate font-medium">{location?.label ?? 'Set location'}</span>
        </button>

        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search milk, bread, medicine…"
            className="input"
          />
        </form>

        <Link
          href="/cart"
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-200 hover:bg-stone-50"
          aria-label="Cart"
        >
          🛒
          {cartCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </Link>

        <Link
          href={user ? '/profile' : '/orders'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-200 text-sm font-bold text-stone-600 hover:bg-stone-50"
          aria-label="Account"
        >
          {user?.fullName ? user.fullName.slice(0, 1).toUpperCase() : '👤'}
        </Link>
      </div>
      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}
