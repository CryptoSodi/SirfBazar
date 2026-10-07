import Link from 'next/link';
import { CategoryNode, flattenCategories } from '@/lib/category-tree';

/** Native disclosure and links keep expansion separate from filtering. */
export function CategoryFilters({ categories, selected, href }: { categories: CategoryNode[]; selected: string; href: (slug: string) => string }) {
  return <>{categories.map(entry => {
    const active = selected === entry.slug || selected === entry.id;
    const link = <Link aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center py-2 ${active ? 'selected' : ''}`} href={href(entry.slug)}>{entry.children?.length ? `All ${entry.name}` : entry.name}</Link>;
    if (!entry.children?.length) return <div key={entry.id}>{link}</div>;
    const expanded = flattenCategories([entry]).some(node => node.slug === selected || node.id === selected);
    return <details key={`${entry.id}:${selected}`} open={expanded || undefined}>
      <summary className="cursor-pointer py-3 font-semibold">{entry.name}</summary>
      <div className="ms-3 border-s ps-3">{link}<CategoryFilters categories={entry.children} selected={selected} href={href} /></div>
    </details>;
  })}</>;
}
