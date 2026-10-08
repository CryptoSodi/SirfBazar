import { redirect } from 'next/navigation';

// Saved category links use the same hierarchy and filters as search.
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const supplied = await searchParams;
  const query = new URLSearchParams({ category: id });
  for (const key of ['q', 'type', 'sort']) {
    const value = supplied[key];
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`/search?${query.toString()}`);
}
