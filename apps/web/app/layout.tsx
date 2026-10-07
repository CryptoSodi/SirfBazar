import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  icons: { icon: '/brand/sirfbazar-basket.svg' },
  title: { default: 'SirfBazar — Everyday essentials from local shops', template: '%s | SirfBazar' },
  description: 'Shop groceries and everyday essentials from nearby independent stores on SirfBazar.',
};

const footerLinks = [
  ['Explore shops', '/search?type=shops'], ['Help centre', '/faqs'],
  ['Your account', '/profile'], ['Privacy & terms', '/privacy-policy'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>
    <Header />
    <main className="sb-app-main">{children}</main>
    <footer className="sb-footer"><div className="sb-site-container">
      <Image src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" width={154} height={39} className="sb-footer-brand" />
      <nav aria-label="Footer navigation">{footerLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="sb-footer-bottom"><small>SirfBazar · Your local shops, a little closer.</small><strong lang="ur" dir="rtl">بازار وہی، طریقہ نیا.</strong></div>
    </div></footer>
  </body></html>;
}
