export function shopAcceptingOrders(shop: { isOnline?: boolean; isOpen?: boolean } | null | undefined) {
  return shop?.isOnline === true && shop?.isOpen === true;
}
export function shopStatus(shop: { isOnline?: boolean; isOpen?: boolean }) {
  return shop.isOnline !== true ? 'Offline' : shop.isOpen !== true ? 'Closed' : 'Open';
}
