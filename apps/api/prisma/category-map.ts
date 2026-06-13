/**
 * Canonical SirfBazar categories — the single source of truth for category
 * identity, display name, emoji icon, and order. Used by BOTH the catalog
 * importer (so scraped products land in the right category) and the one-off
 * merge script (to dedupe + icon existing data).
 *
 * `aliases` are other slugs (e.g. grocerapp's category slugs) that mean the
 * same thing and should be merged into this canonical category.
 */
export interface CanonicalCategory {
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  aliases?: string[];
}

export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  { slug: 'groceries', name: 'Groceries', icon: '🛒', sortOrder: 0 },
  { slug: 'milk-eggs-bread', name: 'Milk, Eggs & Bread', icon: '🥛', sortOrder: 1, aliases: ['bakery-and-dairy'] },
  { slug: 'fruits-vegetables', name: 'Fruits & Vegetables', icon: '🥕', sortOrder: 2, aliases: ['fruits-and-vegetables'] },
  { slug: 'snacks-drinks', name: 'Snacks & Drinks', icon: '🥤', sortOrder: 3, aliases: ['instant-food'] },
  { slug: 'bakery', name: 'Bakery Items', icon: '🥐', sortOrder: 4 },
  { slug: 'pharmacy', name: 'Pharmacy Essentials', icon: '💊', sortOrder: 5, aliases: ['otc-and-wellness'] },
  { slug: 'personal-care', name: 'Personal Care', icon: '🧴', sortOrder: 6 },
  { slug: 'baby-care', name: 'Baby Care', icon: '🍼', sortOrder: 7 },
  { slug: 'household', name: 'Household Items', icon: '🧹', sortOrder: 8, aliases: ['crockery-household'] },
  { slug: 'stationery', name: 'Stationery', icon: '✏️', sortOrder: 9, aliases: ['stationary-shop'] },
  { slug: 'mobile-accessories', name: 'Mobile Accessories', icon: '🔌', sortOrder: 10 },
  { slug: 'pet-food', name: 'Pet Food', icon: '🐾', sortOrder: 11, aliases: ['pet-care'] },

  // Genuinely distinct grocerapp categories — kept, with an emoji icon added.
  { slug: 'breakfast-essentials', name: 'Breakfast Essentials', icon: '🍳', sortOrder: 12 },
  { slug: 'daalain-rice-and-flour', name: 'Daal, Rice, Atta & Cheeni', icon: '🌾', sortOrder: 13 },
  { slug: 'oil-and-ghee', name: 'Edible Oils & Ghee', icon: '🫒', sortOrder: 14 },
  { slug: 'disposable-bags', name: 'Spices & Herbs', icon: '🌶️', sortOrder: 15 },
  { slug: 'sauces-olives-and-pickles', name: 'Sauces & Pastes', icon: '🥫', sortOrder: 16 },
  { slug: 'baking-and-desserts', name: 'Baking & Pantry', icon: '🧁', sortOrder: 17 },
  { slug: 'dry-fruit-and-nuts', name: 'Dry Fruit & Nuts', icon: '🥜', sortOrder: 18 },
  { slug: 'frozen-and-chilled', name: 'Frozen & Chilled', icon: '🧊', sortOrder: 19 },
  { slug: 'beverages', name: 'Tea, Cold Drinks & Juices', icon: '🧃', sortOrder: 20 },
  { slug: 'fresh-meat', name: 'Meat & Seafood', icon: '🍗', sortOrder: 21 },
  { slug: 'bath-body-hair', name: 'Body & Hair Care', icon: '💇', sortOrder: 22 },
  { slug: 'skin-care', name: 'Skin Care', icon: '🧖', sortOrder: 23 },
  { slug: 'home-care', name: 'Cleaning Products & Repellents', icon: '🧽', sortOrder: 24 },
  { slug: 'fabric-care', name: 'Laundry Essentials', icon: '🧺', sortOrder: 25 },
];

/** Map any slug (canonical or alias) → its canonical category. */
export const CATEGORY_BY_ANY_SLUG = new Map<string, CanonicalCategory>();
for (const c of CANONICAL_CATEGORIES) {
  CATEGORY_BY_ANY_SLUG.set(c.slug, c);
  for (const a of c.aliases ?? []) CATEGORY_BY_ANY_SLUG.set(a, c);
}
