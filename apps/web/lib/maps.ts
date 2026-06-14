/**
 * Google Maps (web) configuration. Unlike the mobile app (which can fall back to
 * Apple Maps / Expo Go's bundled key), the web map will not render without a
 * browser key, so callers should gate the map UI on `hasMapsKey`.
 *
 * Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a key restricted to HTTP referrers +
 * "Maps JavaScript API") in .env.local for dev and in Vercel for production.
 */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const hasMapsKey = GOOGLE_MAPS_API_KEY.length > 0;
