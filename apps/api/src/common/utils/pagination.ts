export interface PageQuery {
  page?: number | string;
  pageSize?: number | string;
}

export function parsePage(query: PageQuery, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
