import Link from 'next/link';

export function LegalLinks() {
  return <nav aria-label="Policies and support" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--sb-border)] pb-4">
    <Link href="/terms">Terms</Link>
    <Link href="/privacy-policy">Privacy policy</Link>
    <Link href="/account-deletion">Account deletion</Link>
    <Link href="/contact">Contact</Link>
  </nav>;
}
