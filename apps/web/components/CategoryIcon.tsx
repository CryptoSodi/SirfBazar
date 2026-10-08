import { AppIcon } from './AppIcon';
import { categoryIconName } from '../lib/category-icons';

export function CategoryIcon({ slug, storedIcon }: { slug?: string; storedIcon?: string | null }) {
  return <AppIcon name={categoryIconName(slug, storedIcon)} size={28} />;
}
