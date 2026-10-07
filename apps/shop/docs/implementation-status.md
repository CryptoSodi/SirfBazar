# Exact-v2 merchant workspace implementation status

Updated implementation review: 2026-09-29. The seven-view React workspace is now implemented and builds, but this is **not** a pixel-parity or live-mutation completion certificate. Recheck the live tree before final sign-off because implementation work may continue after this snapshot.

## Authority and scope

- Visual authority: `../../SirfBazar_Codex_Exact_Design/reference/SirfBazar_Merchant_Workspace.html`, its locked 15 screenshots, full extracted CSS and source SVG/icon geometry. Keep auth screens intact and scope workspace styles.
- Data/operation authority: the current `../../sirfbazar-api/src` NestJS/Prisma controllers, DTOs and services, verified again against the actual deployed build. The pinned design-pack contract map is historical source evidence, not live API proof. The old GroceryServer/Fastify backend is **not** this dashboard's API.
- Application: existing `sirfbazar-shop` React/Vite/TypeScript workspace. `src/lib/api.ts` accepts a `VITE_API_URL` origin or single `/api` base; relative paths begin `/merchant/...` or `/auth/...`.
- The selected scope is seven views: Overview, Orders, Products, Riders, Team, Earnings/settlements, Shop settings, plus the specified drawers, forms, support/notification states and Light/Dark/System behavior. No customer/rider/admin/POS rebuild.
- Reference integrity: `python SirfBazar_Codex_Exact_Design/tools/verify_reference.py` **PASS** on 2026-09-29: all 32 locked source files match. The source CSS is copied into `public/merchant-v2.css` with React-only aliases appended; the locked pack itself is unchanged. This says nothing about pixel parity or live API behavior.

## Current application status

| View/interaction | Current source observation | Visual evidence | Live API read | Approved test write + reload | Acceptance still required |
|---|---|---|---|---|---|
| Overview | `/` renders the v2 hierarchy and real dashboard/profile/order/rider/product/earnings requests | IAB smoke screenshot viewed; **no pixel diff** | Local synthetic empty-state smoke only; no populated-data proof | NOT RUN | Verify source geometry in matched conditions; avoid treating unavailable daily series as zero sales |
| Orders and detail | `/orders` restyled; real list/detail and lifecycle handlers retained | IAB smoke screenshot viewed; **no pixel diff** | Local synthetic empty-state smoke only | NOT RUN | Test details, rejection, state transitions, uncertain outcome and reload on approved records |
| Assign rider | Orders page retains real rider list/assignment handler | NOT CAPTURED in selected drawer state | NOT RUN | NOT RUN | Explicit selection, eligibility/permissions, no-eligible and busy states, durable assignment after reload |
| Products | `/products` restyled; real listing/catalogue/add/update routes retained | IAB smoke screenshot viewed; **no pixel diff** | Local synthetic empty-state smoke only | NOT RUN | Test editor/catalogue/bulk outcomes and listing-ID edits on approved records |
| Riders | `/riders` restyled; real list/create/detail and approval/activation handlers retained | NOT RECORDED in IAB smoke | NOT RUN | NOT RUN | Test all filters, workload distinctions and confirmation states |
| Team | `/team` and `Team.tsx` now exist; GET/POST `/merchant/staff` wired to list/create | IAB smoke screenshot viewed; **no pixel diff** | Local synthetic empty-state smoke only | NOT RUN | Owner-only restriction and edit/disable flows are not yet verified/complete in current page |
| Earnings/settlements | `/earnings` restyled; authorized earnings/settlement reads retained; chart renders local-source `byDay` or a truthful empty state | NOT RECORDED in IAB smoke | NOT RUN with a recorded payload | N/A: merchant finance is read-only | Verify daily series, definitions and settlement detail with approved populated records |
| Settings and theme | `/profile` restyled; real profile/open/online handlers retained; Light/Dark/System control present | Narrow Profile IAB smoke screenshot viewed; **no pixel diff** | Local synthetic profile smoke only | NOT RUN | Test all themes, persistence, independent flags and saved approval state with test records |
| Notifications/support | Header has notification affordance; complete production support/notification handlers not verified | NOT CAPTURED | NOT RUN | NOT RUN | Source-styled layouts with inspected contracts; no fake ticket or read confirmation |
| Auth/onboarding | `/sign-in`, `/sign-up`, `/recover` routes preserved with separate auth adapter | Auth regression NOT RUN in this review | NOT RUN in this review | NOT RUN in this review | Confirm workspace CSS has not changed the working auth screens |

“Handler exists” means only that a request call was located in source; it does not certify request shape, permission, response, persistence, error handling or hosted deployment. The local synthetic database currently has empty operational records, so these smoke views cannot prove populated order/rider/finance flows.

## Checks actually reported for this implementation

- `rtk npx.cmd tsc --noEmit` — **PASS**.
- Elevated `rtk npm.cmd run build` — **PASS**, 2,062 modules transformed.
- Frontend at `http://127.0.0.1:5175` and local API at port `3001` — listening during the reported smoke review. Listening is not authenticated contract verification.
- IAB smoke screenshots visually reviewed for Overview, Orders, Team, Products and Profile at a narrow browser width. No retained image paths, matching reference conditions or measured diff were provided; see `visual-parity-report.md`.
- Lint, automated interaction tests, 15-image pixel comparison, populated-data reads and approved live mutation/reload tests — **NOT RUN / NOT REPORTED** in this review.

## Final acceptance evidence checklist

- [x] Confirm all seven main workspace routes exist in `src/App.tsx`; secondary interactions still require verification.
- [ ] Record application path, API base actually loaded, backend source revision/deployment identity, authorized test merchant and exact permissions **without** exposing tokens or personal data.
- [x] Run and record TypeScript check and production build (results above).
- [ ] Run lint (if configured) and available automated tests; record results honestly.
- [ ] Verify authenticated reads per view with approved test data; distinguish 401, 403, empty, initial failure and stale refresh.
- [ ] Verify each approved test mutation and reload persisted state. Do not change real orders, rider approvals, stock, shop status or finance data merely to create screenshots.
- [ ] Confirm the seven views in Light and Dark, System preference behavior, 1600/1440/1366/1024/800/390px, source drawers and exceptional states against the actual React app. Link captures and measured comparisons in `visual-parity-report.md`.
- [ ] Confirm production bundle and normal routes contain no `fixture-*.TEST_ONLY.json`, scenario selector, fake mutation store, `window.__design`, request-history panel or auth-bypass parity route.
- [ ] Log each remaining contract uncertainty, controlled deviation and blocker in the other three reports. Never call the implementation pixel-perfect or fully integrated without this evidence.

## Known blockers / decisions to resolve

- Deployed API parity and populated authorized merchant test records are unverified here. The local synthetic database is empty for operational data, so write/read-after-reload and populated-state evidence remain blocked by test-fixture setup/approval.
- Current local `sirfbazar-api/src/merchant/merchant.service.ts` constructs `byDay` for earnings, and the frontend now renders that series when returned. The synthetic database has no delivered-order series, so chart data appearance remains untested; do not call an empty chart an API contract failure.
- The design-pack source review flags assignment capacity/concurrency/partial-side-effect behavior, dashboard versus finance time/window semantics and capped order lists. Do not claim backend guarantees or pagination that current source does not prove.
- The original screenshots used an unnamed fallback font after the optional font request was blocked. Compare the untouched HTML and React under the same rendering conditions and report font differences rather than changing the approved stack.
