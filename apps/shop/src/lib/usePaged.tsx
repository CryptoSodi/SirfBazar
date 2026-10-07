import { ReferenceIcon as UiIcon } from '../components/ReferenceIcon';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { readMemory, writeMemory } from './memoryCache';

type PagedCache = { items: any[]; total: number; totalPages: number };

/** Fetches a paged endpoint ({items,total,...} or a plain array) with filters. */
export function usePaged(path: string, filters: Record<string, string | undefined>) {
  const initialKey = `paged:${path}:1:${JSON.stringify(filters)}`;
  const initial = readMemory<PagedCache>(initialKey);
  const [items, setItems] = useState<any[]>(initial?.items ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initial?.totalPages ?? 1);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');

  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    const cacheKey = `paged:${path}:${page}:${filterKey}`;
    const cached = readMemory<PagedCache>(cacheKey);
    if (cached) { setItems(cached.items); setTotal(cached.total); setTotalPages(cached.totalPages); }
    setLoading(!cached);
    setError('');
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
      const res = await api.get(`${path}?${qs.toString()}`);
      if (Array.isArray(res)) {
        setItems(res);
        setTotal(res.length);
        setTotalPages(1);
        writeMemory<PagedCache>(cacheKey, { items: res, total: res.length, totalPages: 1 });
      } else {
        const next = { items: res.items ?? [], total: res.total ?? 0, totalPages: res.totalPages ?? 1 };
        setItems(next.items);
        setTotal(next.total);
        setTotalPages(next.totalPages);
        writeMemory<PagedCache>(cacheKey, next);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, filterKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  return { items, total, page, setPage, totalPages, loading, error, reload: load };
}

export function Pager({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button
        className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        <UiIcon name="back" />
      </button>
      <span className="text-slate-500">
        {page} / {totalPages}
      </span>
      <button
        className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
      >
        <UiIcon name="arrow" />
      </button>
    </div>
  );
}
