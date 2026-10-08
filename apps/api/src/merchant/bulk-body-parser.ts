import { json, urlencoded } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Bulk CSV mapping and signed snapshots need more room than ordinary JSON routes. */
export const BULK_JSON_LIMIT_BYTES = 6 * 1024 * 1024;

export function registerJsonBodyParsers(app: NestExpressApplication) {
  app.use('/api/merchant/products/bulk-preview', json({ limit: BULK_JSON_LIMIT_BYTES }));
  app.use('/api/merchant/products/bulk-upload', json({ limit: BULK_JSON_LIMIT_BYTES }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));
}
