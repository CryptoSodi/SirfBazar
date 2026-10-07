# Local merchant API test data

## Shared product catalog

The local Grocerapp export lives at `../grocerapp-scraper/output/catalog.json` with downloaded images in `../grocerapp-scraper/output/images`. From `sirfbazar-api`, run `npm run import:catalog -- --dry-run` to check the source and target, then `npm run import:catalog` to upsert products into the shared `Product` catalog. The importer accepts only the local test database on port 5433 and local image URLs. It derives stable slugs from each product name and source ID, skips malformed descriptions, validates image signatures, and serves copied images from `/static/catalog/`. Re-running it updates the same catalog records. Merchants choose products from this catalog and enter their own price and stock; the import does not create shop listings.

On 2026-09-29, 2,566 products and 2,563 images were imported with zero failures. A second run reported `created=0 updated=2566`, confirming idempotence. Three products lacked downloaded images. The local catalog total was 2,612 products including 46 pre-existing records. `National Apple Jam (200g)` and `(440g)` were visible with loaded thumbnails in the merchant Add from catalog dialog.

This setup is **local only**. `apps/api/.env` targets `127.0.0.1:5433/sirfbazar`, not the hosted API. `apps/shop/.env.local` targets `http://localhost:3001/api`; `.env.production` remains hosted.

The current test database is a separate UTF-8 PostgreSQL 18 cluster at `%LOCALAPPDATA%\Temp\SirfBazar-pg-5433`, listening only on `127.0.0.1:5433`. It is not Docker and does not affect the pre-existing PostgreSQL service on port 5432. After a laptop restart, start this cluster from PowerShell with the PostgreSQL 18 `postgres.exe` binary, `-D` set to that folder, `-p 5433`, and `-h 127.0.0.1`. Use `Start-Process -WindowStyle Hidden` if running it in the background.

The database was initialized from `prisma/schema.prisma` and populated with `npm run seed`. For order-workflow fixtures, start the API on port 3001, then run `npm run seed:merchant-orders` with `CONFIRM_LOCAL_TEST_DATA=1`. That script refuses non-local API URLs and skips already-marked orders. It creates orders only through the existing API and verifies their saved states. The local merchant owner is `+923010000001`; with `OTP_PROVIDER=mock`, request a code and use `123456` for testing. Never use the mock code or these fixtures against a hosted environment.

At the time of setup, the API was started from `apps/api` with `node dist/main.js`; `http://127.0.0.1:3001/docs` returned HTTP 200. The current backend bootstrap binds port 3001 on all interfaces even when accessed through localhost. With mock OTP enabled, keep this machine off untrusted networks or stop the API when finished. A loopback-only backend binding would require a separately approved `src/main.ts` change.

The active `apps/shop` Vite app could not be started from this restricted Codex session because esbuild was denied access to `vite.config.ts`. Port 5174 is occupied by the older `sirfbazar-merchant-web`; use another port such as 5175 when starting `apps/shop` locally.
