export type ShopPoint = { latitude: number; longitude: number };

export function isShopPoint(value: unknown): value is ShopPoint {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as ShopPoint;
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function parseShopPoint(latitude: string, longitude: string): ShopPoint | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return isShopPoint(point) ? point : null;
}
