import Link from 'next/link';
import type { ReactNode } from 'react';

type ShopState = { id?: string; isOnline?: boolean; isOpen?: boolean };
export function shopAcceptingOrders(shop: ShopState) {
  return shop.isOnline === true && shop.isOpen === true;
}
export function shopStatus(shop: ShopState) {
  return shop.isOnline !== true ? 'Offline' : shop.isOpen !== true ? 'Closed' : 'Open';
}

/** Unavailable shops stay discoverable, without a clickable or focusable link. */
export function ShopAvailabilityLink({ shop, className, children }: { shop: ShopState; className: string; children: ReactNode }) {
  return shopAcceptingOrders(shop)
    ? <Link href={`/shop/${shop.id}`} className={className}>{children}</Link>
    : <div className={`${className} sb-shop-unavailable`} data-shop-unavailable>{children}</div>;
}
