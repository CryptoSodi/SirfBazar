'use client';
import { AppIcon as UiIcon } from './AppIcon';


import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchCart, hasCartSession, isLoggedIn } from '@/lib/api';
import { useLocation } from '@/lib/location';
import { LocationControl } from './LocationControl';
import { LocationPicker } from './LocationPicker';
import { Icon } from './Icons';
import { AccountMenu } from './AccountMenu';

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'sb.theme';

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { location } = useLocation();
  const [q, setQ] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const checkout = pathname === '/checkout';

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'system';
    setTheme(initial);
    applyTheme(initial);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => { if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system'); };
    const onThemeChange = () => {
      const current = localStorage.getItem(THEME_KEY);
      const selected: Theme = current === 'light' || current === 'dark' ? current : 'system';
      setTheme(selected); applyTheme(selected);
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('sb:theme', onThemeChange);
    return () => { media.removeEventListener('change', onSystemChange); window.removeEventListener('sb:theme', onThemeChange); };
  }, []);

  useEffect(() => {
    setSignedIn(isLoggedIn());
    const refreshCart = () => {
      if (!hasCartSession()) { setCartCount(0); return; }
      fetchCart().then((cart) => setCartCount(cart.itemCount ?? 0)).catch(() => undefined);
    };
    const onAuth = () => { setSignedIn(isLoggedIn()); refreshCart(); };
    const onSession = () => setSignedIn(isLoggedIn());
    const onCart = (event: Event) => {
      const view = (event as CustomEvent).detail;
      if (view?.itemCount != null) setCartCount(view.itemCount);
      else refreshCart();
    };
    refreshCart();
    window.addEventListener('sb:auth', onAuth);
    window.addEventListener('sb:session', onSession);
    window.addEventListener('sb:cart', onCart);
    return () => { window.removeEventListener('sb:auth', onAuth); window.removeEventListener('sb:session', onSession); window.removeEventListener('sb:cart', onCart); };
  }, []);

  const cycleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(freeze);
    localStorage.setItem(THEME_KEY, next);
    setTheme(next); applyTheme(next);
    void document.body.offsetHeight;
    requestAnimationFrame(() => freeze.remove());
  };

  const appearance = <button type="button" className="sb-icon-button" onClick={cycleTheme} aria-label={`Appearance: ${theme}. Change appearance`} title={`Appearance: ${theme}`}><Icon name={theme === 'dark' ? 'moon' : theme === 'system' ? 'system' : 'sun'} size={20} /></button>;
  const brand = <Link href="/" aria-label="SirfBazar home" className="sb-header-brand"><Image src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" width={154} height={39} priority /></Link>;

  if (checkout) return <header className="sb-checkout-header"><div className="sb-site-container">{brand}<span className="sb-checkout-header-title">Checkout</span><Link href="/cart" className="sb-checkout-back"><UiIcon name="back" size={18} /> <span>Back to basket</span></Link>{appearance}<Link href="/contact" className="sb-icon-button" aria-label="Help centre"><Icon name="help" /></Link></div></header>;

  return <>
    <header className="sb-site-header">
      <div className="sb-site-promise"><div className="sb-site-container"><span>Everyday essentials. From your neighbourhood.</span><Link href="/contact">Need a hand? We’re here to help&nbsp; <UiIcon name="chevron" size={18} /></Link></div></div>
      <div className="sb-site-container sb-site-mainbar">
        {brand}
        <LocationControl location={location} onClick={() => setPickerOpen(true)} />
        <form className="sb-site-search" role="search" onSubmit={(event) => { event.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}><label htmlFor="site-search" className="sr-only">Search products and shops</label><Icon name="search" size={19} /><input id="site-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search milk, eggs, bread and more" /><button type="submit" aria-label="Search"><UiIcon name="arrow" size={18} /></button></form>
        {appearance}
        <AccountMenu signedIn={signedIn} />
        <Link href="/orders" className="sb-header-orders"><Icon name="history" size={19} /> <span>Orders</span></Link>
        <Link href="/cart" className="sb-site-basket" aria-label={`Basket with ${cartCount} items`}><Image src="/brand/sirfbazar-basket-white.svg" alt="" width={20} height={20} /><span>Basket</span><b>{cartCount}</b></Link>
      </div>
      <nav className="sb-site-subnav" aria-label="Shop navigation"><div className="sb-site-container"><Link href="/search"><Icon name="grid" size={17} /> All categories</Link><Link href="/search?category=milk-eggs-bread">Dairy &amp; eggs</Link><Link href="/search?category=fruits-vegetables">Fruit &amp; vegetables</Link><Link href="/search?category=bakery">Bakery</Link><Link href="/search?q=rice">Rice &amp; staples</Link><Link href="/search?q=cooking%20oil">Cooking essentials</Link><Link href="/search?type=shops" className="sb-subnav-shops"><Icon name="shop" size={18} /> Local shops</Link></div></nav>
    </header>
    <nav className="sb-mobile-nav" aria-label="Primary navigation"><Link className={pathname === '/' ? 'active' : ''} href="/"><Icon name="home" size={21} /><small>Home</small></Link><Link className={pathname.startsWith('/search') || pathname.startsWith('/shop') ? 'active' : ''} href="/search"><Icon name="grid" size={21} /><small>Browse</small></Link><Link className={pathname === '/cart' ? 'active' : ''} href="/cart"><Icon name="basket" size={21} /><small>Basket</small>{cartCount > 0 && <b>{cartCount}</b>}</Link><Link className={pathname.startsWith('/orders') ? 'active' : ''} href="/orders"><Icon name="history" size={21} /><small>Orders</small></Link><AccountMenu signedIn={signedIn} mobile /></nav>
    {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
  </>;
}
