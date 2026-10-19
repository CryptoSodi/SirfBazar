import type { MerchantListing, Paged } from './merchant-contracts';

/** Keep a confirmed creation visible while the listings request catches up. */
export function withRecentListings(page: Paged<MerchantListing>, recent: MerchantListing[]): Paged<MerchantListing> {
  const existingIds = new Set(page.items.map((item) => item.id));
  const missing = recent.filter((item) => !existingIds.has(item.id));
  if (!missing.length) return page;
  return {
    ...page,
    items: [...missing, ...page.items].slice(0, page.pageSize),
    total: page.total + missing.length,
    totalPages: Math.max(1, Math.ceil((page.total + missing.length) / page.pageSize)),
  };
}
