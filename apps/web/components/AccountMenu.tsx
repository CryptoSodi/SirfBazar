'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Icon } from './Icons';

/** Native disclosure and real links: Tab navigates, Escape closes, no app-menu roles. */
export function AccountMenu({ signedIn, mobile = false }: { signedIn: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => { if (disclosure.current) disclosure.current.open = false; }, [pathname, signedIn]);
  useEffect(() => {
    const closeOutside = (event: Event) => {
      const current = disclosure.current;
      if (current?.open && event.target instanceof Node && !current.contains(event.target)) current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      const current = disclosure.current;
      if (event.key === 'Escape' && current?.open) {
        event.preventDefault();
        current.open = false;
        current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return <details ref={disclosure} className={`sb-account-menu ${mobile ? 'sb-account-mobile' : 'sb-account-desktop'}${pathname.startsWith('/profile') ? ' active' : ''}`}>
    <summary className={mobile ? 'sb-account-mobile-trigger' : 'sb-icon-button sb-account-trigger'} aria-label={`${mobile ? 'You' : 'Account'}: ${signedIn ? 'your profile and orders' : 'sign up or sign in'}`} title="Your account">
      <Icon name="user" size={mobile ? 21 : 20} />
      {mobile && <small>You</small>}
    </summary>
    <nav className="sb-account-panel" aria-label="Account options" onClick={(event) => {
      if ((event.target as Element).closest('a') && disclosure.current) disclosure.current.open = false;
    }}>
      <strong>Your account</strong>
      {signedIn ? <>
        <Link href="/profile">View your profile</Link>
        <Link href="/orders">View your orders</Link>
      </> : <>
        <p>One step for new and existing customers. No password needed.</p>
        <Link href="/profile">Sign up or sign in</Link>
      </>}
    </nav>
  </details>;
}
