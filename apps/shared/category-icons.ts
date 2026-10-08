// Stored category artwork is left intact. New selections use a portable icon key.
export const categoryIconChoices = ['grid', 'cart', 'milk', 'carrot', 'drink', 'bakery', 'pill', 'care', 'baby', 'household', 'edit', 'plug', 'paw', 'bag'] as const;
export type CategoryIconName = typeof categoryIconChoices[number];
const categoryIcons: Record<string, CategoryIconName> = {
  groceries: 'cart', 'milk-eggs-bread': 'milk', 'fruits-vegetables': 'carrot',
  'snacks-drinks': 'drink', bakery: 'bakery', pharmacy: 'pill', 'personal-care': 'care',
  'baby-care': 'baby', household: 'household', stationery: 'edit',
  'mobile-accessories': 'plug', 'pet-food': 'paw', 'bakery-and-dairy': 'milk',
  'fruits-and-vegetables': 'carrot', 'instant-food': 'drink', 'otc-and-wellness': 'pill',
  'crockery-household': 'household', 'pet-care': 'paw', beverages: 'drink',
  'breakfast-essentials': 'bakery', 'bath-body-hair': 'care', 'skin-care': 'care',
  'home-care': 'household', 'fabric-care': 'household',
  'daalain-rice-and-flour': 'bag', 'oil-and-ghee': 'bag', 'disposable-bags': 'carrot',
  'sauces-olives-and-pickles': 'bag', 'baking-and-desserts': 'bakery',
  'dry-fruit-and-nuts': 'bag', 'frozen-and-chilled': 'bag', 'fresh-meat': 'bag',
};
export function categoryIconName(slug?: string, storedIcon?: string | null): CategoryIconName {
  const key = storedIcon?.startsWith('lucide:') ? storedIcon.slice(7) : '';
  if (categoryIconChoices.includes(key as CategoryIconName)) return key as CategoryIconName;
  return categoryIcons[(slug ?? '').split('--')[0]] ?? 'grid';
}
