import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: {
    default: 'SirfBazar — Order from trusted local shops near you',
    template: '%s | SirfBazar',
  },
  description:
    'Shop groceries, pharmacy essentials, bakery items, fruits, vegetables, snacks, drinks, household items and more from shops near you. Your nearby bazar, now online.',
};

const FOOTER_LINKS = [
  ['How it works', '/how-it-works'],
  ['Become a merchant', '/become-a-merchant'],
  ['Become a rider', '/become-a-rider'],
  ['About', '/about'],
  ['FAQs', '/faqs'],
  ['Contact', '/contact'],
  ['Privacy policy', '/privacy-policy'],
  ['Terms', '/terms'],
  ['Refund policy', '/refund-policy'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-5BGD6NSRTS" />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-5BGD6NSRTS');
          `}
        </Script>
        <Header />
        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-5">{children}</main>
        <footer className="mt-10 border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 font-black text-white">SB</span>
              <span className="font-extrabold text-emerald-700">SirfBazar</span>
              <span className="text-xs text-stone-400">— your nearby bazar, now online</span>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-500">
              {FOOTER_LINKS.map(([label, href]) => (
                <Link key={href} href={href} className="hover:text-emerald-700">
                  {label}
                </Link>
              ))}
            </nav>
            <p className="mt-5 text-xs text-stone-400">
              © {new Date().getFullYear()} SirfBazar. Orders are fulfilled by independent local shops with their own riders.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
