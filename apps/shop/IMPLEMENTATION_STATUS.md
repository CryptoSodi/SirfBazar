# Merchant desktop implementation status — 2026-09-29

## 2026-10-01 API and workflow improvements

- Orders now have server-side pagination (20 per page) and a total count. The backend retains its original array response when pagination is not requested, protecting existing consumers. Shop listings, low-stock and paused filters, and the in-stock replacement picker now search/page on the server instead of stopping at the first 100 records.
- Dashboard previews request only matching attention orders and low-stock listings. Session-memory caches are invalidated after successful writes and incoming order/product/rider events. Orders, listings and overview show the last successful refresh time; product filtering no longer swaps the whole page for a cold-load skeleton.
- Product listing/order pagination responses are checked by typed runtime readers. `test:merchant-pagination` is a read-only mocked service test. Full generated response types remain blocked by missing response schemas in the current Nest Swagger output; existing endpoints are not claimed fully typed.
- Backend typecheck, backend build, frontend TypeScript check, mocked pagination test and Vite production build passed. Vite required an elevated local build because the sandbox denied its Windows native-module spawn. The authenticated local merchant browser showed dashboard data, 5 shop listings, 4 low-stock listings and an empty orders state with no console warnings/errors. More-than-one-page navigation and the replacement picker still require suitable disposable test records.

## Loading-state convention

- Every asynchronous merchant route uses shared layout-preserving skeletons on a cold load.
- Successful responses remain only in session-scoped JavaScript memory. Returning to a route shows the last confirmed response immediately while a background request revalidates it.
- The cache is cleared whenever authentication is stored or removed, and is never persisted to browser storage or shared between merchants.
- Failed requests never substitute demo data, empty counts, or temporary zero values for a previously confirmed response.
- Skeletons expose one concise live-region status, hide decorative shapes from assistive technology, and stop animating when reduced motion is requested.

## Local shared catalog import

- Imported 2,566 scraped product facts and 2,563 validated local images into the local API catalog on 2026-09-29. The local catalog now contains 2,612 products including the existing 46.
- The Products page now opens on a paginated, searchable shared catalog with API-served images and Add to my shop actions. A separate My shop listings tab preserves pricing, stock, SKU, import, edit, and removal controls. Shop listings still require each merchant to set a price and stock quantity.
- Browser check on the signed-in local merchant session displayed 2,611 available catalog products across 109 pages; TypeScript and production build passed. The local database contains 2,612 total product records, including one not shown by the merchant catalog filter.
- Catalog browsing is now divided by the API's active categories. Category selection uses the merchant catalog's `categoryId` filter with search and pagination; the sidebar becomes a horizontal scroller on narrower screens. A local browser check showed 117 products under Tea, Cold Drinks & Juices and restored the 2,611-product view via All products. TypeScript and production build passed.
- Product-card images are now contained within their media frames, with text and actions on a separate surface. The workspace avatar opens an account menu (Shop settings, Help & support, explicit Sign out); the duplicate sidebar Help & support link was removed. Desktop sidebar collapse/expand is persisted locally, while narrow layouts keep the full mobile drawer. Browser checks covered dark/light product cards, mobile width, menu dismissal, collapsed-label visibility, reload persistence and a single sidebar support link; production build passed.
- Three products have no downloaded image. The importer is idempotent and guarded to the local test database.

## Scope completed in this checkout

- Phase 0: located active `apps/shop`, inspected `apps/api` controllers/DTOs/services/permissions, existing auth client, shell, orders, riders and dashboard. Existing modified files were preserved and edited in place.
- Phase 1: owner explicitly said **do not follow Stitch design** during implementation. The current SirfBazar app shell, basket assets, green palette and Urdu slogan remain the visual source; no Stitch-exported HTML/mock dashboard was used. An in-flight Stitch draft completed before that correction; it was not used in the application.
- Phase 2: initially configured `apps/shop/.env.local` for the owner-provided live API base; `.env.production` already held the same base. The shared client validates the `/api` boundary, reports config/network/timeout/permission errors, bounds requests to 15 seconds, refreshes a read once, and never auto-replays a mutation.
- Local development update (same date): `apps/shop/.env.local` was switched to `http://localhost:3001/api` at the owner's request; `.env.production` remains pointed at the live API. A separate UTF-8 PostgreSQL test cluster runs at `127.0.0.1:5433` and the local API at port 3001. The base seed loaded 4 merchants, 5 riders, 44 products and 12 categories. Five marked `[LOCAL QA]` orders were placed through the local API and advanced to NEW, ACCEPTED, PREPARING, READY and ASSIGNED states. No production API or database was written.
- Phase 3: preserved OTP/Google merchant-context login, added linked-merchant session validation, `GET /auth/me` + profile checks in the shell, and server logout. Existing signup/recovery constraints are documented in `BACKEND_GAPS.md`.
- Phase 4: contract-checked dashboard, order list/detail, supported accept/reject/preparing/ready handlers, own-rider list/detail/orders, and explicit rider assignment. Assignment requires human selection/confirmation and re-fetches the order before announcing success. Loading, empty, error, permission, no-eligible-rider and timeout/uncertain states are distinct.

## Verification levels

| Check | Result |
| --- | --- |
| `rtk npx tsc --noEmit` in `apps/shop` | Passed |
| Node 24 runtime checks of `resolveApiUrl` | Passed for trailing-slash live base and rejection of duplicated `/api` client paths. |
| Isolated Node merchant-session check | Passed for a locally constructed merchant-role JWT, linked merchant identity and local session clearing; this is not a live login test. |
| `rtk git diff --check` | Passed |
| `rtk npm run build` | Passed after the workspace-local dependency repair. |
| Public `GET https://api.sirfbazar.com/docs` connectivity | No response; local proxy connection failed, then an escalated read-only attempt timed out after 15s (`HTTP 000`). This does not prove the deployed API is down. |
| Authenticated live reads | Not run: no approved merchant test session was supplied. |
| Live order/rider mutations | Not run: no owner-approved test records or mutation permission. |
| Persistence after real page reload | Implemented via detail/list re-fetch, not verified against live records. |
| Local API `GET /docs` | HTTP 200 on `127.0.0.1:3001`; local order-seed script confirmed each saved order status via authenticated detail reads. |
| Local frontend server | Running and browser-verified at `http://127.0.0.1:5175`; Vite production build also passed after the workspace-local dependency repair. |

## Workspace-local authentication update

- The approved sign-in, two-step signup, Google pin map, optional shop-image upload and three-step recovery pages are now part of the active `sirfbazar-shop` application.
- The copied `sirfbazar-api` now owns the merchant password login, registration verification, recovery and CNIC persistence contracts listed in `BACKEND_GAPS.md`.
- Local browser verification passed from sign-in through an authenticated dashboard at `http://127.0.0.1:5175`.
- Local API smoke verification passed for registration, fixed test OTP `123456`, onboarding, login, recovery, token revocation and login with the new password.
- Current verification: backend production build passed; frontend TypeScript and Vite production build passed; API documentation returned HTTP 200.
- OTP provider work: the active Nest API now contains a WAHA WhatsApp adapter and safe launcher for mobile registration, login OTP and recovery. Automated fake-provider contract checks pass. Live delivery remains blocked until Docker/WAHA is running, its WhatsApp session is paired, and an allowlisted controlled test number is configured; email OTP still needs a separate provider.
- Remaining release blockers: complete a controlled live WAHA delivery check (or select a supported production messaging provider), configure/restrict production Google Maps credentials, and connect Google sign-in if it is later required.

The earlier Phase 0–4 implementation made no backend edits, database migrations, seeding, production deployment or real-customer order actions. In the subsequent local-testing request, only local API fixture tooling and documentation were added, a separate local test database was initialized and seeded, and local-only test orders were created. No hosted database, production deployment or real-customer order was changed. This is **not** a claim that all platform APIs are integrated.

## Interface review

Scope: desktop and responsive overview/order/rider states in the existing application. The existing shell and UI classes remain; no redesign based on Stitch. Clear action labels, explicit selection, confirmation, scoped errors and keyboard-labelled controls were added. Browser regression passed against the local API for overview, orders, products, riders, team, earnings, shop settings, support and the secure document dialog. At a 390 x 844 viewport, the workspace had no document-level horizontal overflow; the persistent new-order alert remained actionable and the browser console reported no warnings or errors.

## Merchant API completion pass

- Settlement history remains connected through `GET /merchant/settlements`.
- Products now expose bulk JSON/CSV import, listing edit, availability control and backend-defined removal (soft removal via `isAvailable=false`).
- Riders now expose create, detail/history, edit, activate/deactivate, approve/reject and backend-defined removal.
- Staff now expose create, role/permission edit, enable/disable and removal, with all current permission keys represented.
- Merchant documents can be uploaded directly as PDF, JPG, PNG or WebP (10 MB maximum), listed and opened through authenticated merchant endpoints. Files are stored outside the public static directory; anonymous reads return 401 and cross-merchant ownership is checked.
- Eligible order items can be marked unavailable with an optional in-stock replacement suggestion; order data is refetched after success.
- The notification bell consumes persisted notifications and authenticated Socket.IO `notification`, `order:new` and `order:update` events, with a 15-second polling/focus recovery path. Socket.IO now uses its reliable polling-first connection and upgrades to WebSocket when available.
- Browser Web Push is connected end to end through a root-scoped service worker plus authenticated subscribe/unsubscribe endpoints. Local development can generate temporary in-memory VAPID keys; production must use stable `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` values and apply the `WebPushSubscription` Prisma schema before deployment.
- New orders in `SENT_TO_MERCHANT` open a persistent Foodpanda-style action alert with customer, total, item summary, waiting time, repeating chime, Review, Reject, Accept and explicit Close. Accept/Reject use the existing merchant mutations and refetch the order before the alert clears. Close only dismisses that order alert for 24 hours in that browser and does not mutate the order.
- Part 3 realtime verification: the guarded `test/send-live-merchant-order.ts` helper prepares local-only cart data but places the order through the real customer OTP and `POST /orders` checkout contracts. Order `SB20260929-F46962` appeared immediately in the already-open Local QA Shop workspace through `order:new`, and the unread count increased from 1 to 2 without refresh or waiting for the polling interval. The helper refuses non-local API/database targets.
- Merchant support tickets now have list, create, detail and message UI.
- Customer-only payments/orders/reviews, rider-only delivery operations and admin-only refunds/coupons/platform administration were intentionally not attached to the merchant session. Their backend role guards prohibit this and must remain separate applications/surfaces.

Verification: frontend TypeScript and elevated production build passed; backend typecheck/build passed; localhost authenticated GET smoke checks passed for profile, settlements, products, riders, staff, support tickets and notifications; Socket.IO polling handshake returned HTTP 200; the Web Push configuration endpoint and service worker returned HTTP 200. Browser QA confirmed the pending local test order displayed in the persistent alert, Review opened the exact order, and Close survived reload while leaving the order pending in the table. Headless Chromium granted notification permission and activated the worker, but its PushManager rejected remote push-service registration; an interactive Chrome subscription and a production push delivery still require controlled-device verification. No accept/reject mutation was executed during this alert QA.

## Local completion evidence — Parts 3–10

- **Part 3 — realtime order delivery:** guarded checkout created `SB20260929-F46962`; the already-open merchant workspace received `order:new` immediately and incremented the unread count without reload.
- **Part 4 — merchant documents:** upload returned 201; authenticated protected read returned 200; anonymous read returned 401; invalid MIME type returned 400. Browser QA showed the pending document and secure file control.
- **Part 5 — merchant mutations:** bulk product create/update/soft-delete, rider create/edit/deactivate and staff role/permission edit/disable all persisted after refetch. Browser QA showed the SKU, hidden listing, inactive rider and disabled staff state.
- **Part 6 — finance:** a guarded delivered order increased gross by 20,000 paisa, commission by 1,600 and net payable by 18,400; the paid settlement persisted and no merchant payout mutation route was exposed. Browser QA rendered Rs 200 / Rs 16 / Rs 184 and the paid reference.
- **Part 7 — unavailable/replacement:** the original stock was restored, replacement stock reserved, merchant suggestion accepted by the local test customer, item states persisted and the order total recalculated. Browser QA showed the original item as replaced and the confirmed replacement.
- **Part 8 — support:** ticket create/list/detail/message persisted and a different local user received 403 for the ticket.
- **Part 9 — browser regression:** profile/documents, finance, products, riders, team, support, order replacement state and 390 px responsive rendering passed; no console warnings/errors were captured.
- **Part 10 — permission boundaries and document hardening:** a guarded ORDERS-only staff session could list merchant orders but received denial for inventory, finance, riders, owner-only staff management, admin, customer-order and payment APIs. The audit found and fixed missing INVENTORY checks on product-list and catalogue reads. Legacy URL-based document submissions/opening now accept only HTTP(S); the document suite proved unsafe schemes and invalid MIME types return 400. Both suites passed after API rebuild/restart.

All test helpers refuse non-local API targets and require `CONFIRM_LOCAL_TEST_DATA=1`. Test fixtures remain intentionally marked/local. No production API, hosted database, real customer order or deployment was changed.
