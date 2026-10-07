# Merchant desktop implementation status — 2026-09-29

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
| `rtk npm run build` | TypeScript passed, Vite/esbuild could not read the checkout from this session (`EPERM` / `Access is denied` at `vite.config.ts`); production bundle unverified |
| Public `GET https://api.sirfbazar.com/docs` connectivity | No response; local proxy connection failed, then an escalated read-only attempt timed out after 15s (`HTTP 000`). This does not prove the deployed API is down. |
| Authenticated live reads | Not run: no approved merchant test session was supplied. |
| Live order/rider mutations | Not run: no owner-approved test records or mutation permission. |
| Persistence after real page reload | Implemented via detail/list re-fetch, not verified against live records. |
| Local API `GET /docs` | HTTP 200 on `127.0.0.1:3001`; local order-seed script confirmed each saved order status via authenticated detail reads. |
| Local frontend server | Not started from this restricted session: default Vite/esbuild could not read `vite.config.ts` (`EPERM`/`Access is denied`); the runner config loader then failed resolving dependencies under the checkout. The older merchant frontend currently occupies port 5174; `apps/shop` was attempted on 5175. |

The earlier Phase 0–4 implementation made no backend edits, database migrations, seeding, production deployment or real-customer order actions. In the subsequent local-testing request, only local API fixture tooling and documentation were added, a separate local test database was initialized and seeded, and local-only test orders were created. No hosted database, production deployment or real-customer order was changed. This is **not** a claim that all platform APIs are integrated.

## Interface review

Scope: desktop and responsive overview/order/rider states in the existing application. The existing shell and UI classes remain; no redesign based on Stitch. Clear action labels, explicit selection, confirmation, scoped errors and keyboard-labelled controls were added. Browser visual/regression review remains open because a Vite server/build could not be run from this restricted session. Review verdict: behavior and types implemented; visual and live connected acceptance remain unverified.
