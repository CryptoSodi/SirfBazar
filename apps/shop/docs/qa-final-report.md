# SirfBazar Merchant Dashboard v2 — Final QA Report

Date: 2026-09-29 (Asia/Karachi)  
Frontend: `sirfbazar-shop`  
Frontend URL: `http://127.0.0.1:5175`  
Local API: `http://127.0.0.1:3001/api`

## Overall result

**PASS WITH COVERAGE LIMITATIONS.** The application compiles, produces a production build, serves locally, reaches the local API, preserves the authentication routes, and renders all seven merchant workspace routes without observed console warnings or errors. Light, dark, and system appearance modes work, and the desktop and narrow layouts were visually smoke-tested.

The local merchant account currently has no orders, products, riders, staff, earnings history, or settlements. Consequently, order-detail actions, lifecycle mutations, rider assignment, busy-rider confirmation, populated tables/charts, and mutation persistence after reload could not be executed without creating or mutating records. No such test mutation was authorized or performed. Automated pixel-diff parity against every reference screenshot was also not run; visual parity evidence is limited to browser inspection of the live empty-state application at desktop and narrow widths.

## Build and static checks

| Check | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `rtk npx.cmd tsc --noEmit` completed with exit code 0 and no diagnostics. |
| Production build | PASS | `rtk npm.cmd run build` completed with exit code 0 outside the sandbox. The sandboxed attempt failed with the expected Windows native-module/child-process `spawn EPERM`; the approved escalated run passed. |
| Build artifact | PASS | `dist/index.html` exists, 664 bytes, last written `2026-09-29 05:52:33`; `dist/assets` was produced at the same time. |
| Reference lock | PASS | `rtk python SirfBazar_Codex_Exact_Design/tools/verify_reference.py --root SirfBazar_Codex_Exact_Design` returned `PASS: 32 original reference files match their locked bytes.` |
| Fixture fallback scan | PASS | `rtk rg -ni "fixture|mock|demo data|sample data|fallback data|example records|TEST_ONLY" src` found only the truthful dashboard error copy: “No sample data has been substituted.” No fixture/mock imports or test-only data path was found in normal application source. |
| Local API configuration | PASS | `.env.local` contains `VITE_API_URL=http://localhost:3001/api`, with `/api` included once. |

The final production build was deliberately rerun after the dark Orders empty-state CSS correction.

## Service health

Executed through PowerShell `Invoke-WebRequest` with a five-second timeout:

| URL | Result |
|---|---|
| `http://127.0.0.1:5175/` | HTTP 200 |
| `http://127.0.0.1:3001/docs` | HTTP 200 |
| `http://127.0.0.1:3001/api/products/categories` | HTTP 200 |

The Nest application has no dedicated health controller. Both `/api` and `/api/health` return 404, which is expected for unregistered routes and is not evidence that the API process is down. `/docs` and the real public categories endpoint were therefore used for health evidence.

## Route smoke checks

The existing authenticated local browser session was used. Each route was directly navigated, allowed to load, and inspected through the browser accessibility/DOM representation.

| Route | Primary heading/state | Result |
|---|---|---|
| `/` | `Your shop, in focus.`; zero/new-shop cards and empty states | PASS |
| `/orders` | `Orders`; empty list with all status filters | PASS |
| `/products` | `Products`; live empty/loading completion state | PASS |
| `/riders` | `Riders`; truthful no-riders state | PASS |
| `/team` | `Your team`; live team request/empty state | PASS |
| `/earnings` | `Finance`; truthful no-series/settlement state | PASS |
| `/profile` | `Shop settings`; details, appearance, storefront controls and approval status | PASS |

All seven routes loaded the isolated `merchant-v2` stylesheet. A final browser console scan after the route cycle returned no warnings or errors.

### Authentication preservation

| Route | Evidence | Result |
|---|---|---|
| `/sign-in` | Sign-in heading; identifier and password controls; recovery, Google, and create-account actions | PASS |
| `/sign-up` | Owner details step; mobile/email selector; CNIC and password fields; Google and sign-in actions | PASS |
| `/recover` | Reset-password heading; channel selector; registered-email input; request-code action | PASS |

The merchant dashboard stylesheet was absent on `/recover`, confirming that the connected workspace styles do not leak into the auth surfaces.

## Visual and responsive checks

### Desktop

- Inspected the Overview at a `1600 × 1200` viewport in light mode.
- Confirmed the reference-style fixed sidebar, top bar, heading/actions, new-shop banner, four metric cards, four-stage pipeline, attention/delivery columns, merchandise and stock panels.
- Inspected Orders in dark mode after the empty-state correction. The previously observed white legacy empty panel is fixed and now uses the dark reference surface/tokens.
- Live local data is intentionally shown instead of example reference records; merchant/shop names and approval/status text therefore differ from the screenshots.

### Narrow browser

- Inspected the Overview at `390 × 844`.
- Metric cards form a two-column grid, pipeline cards form a two-column grid, heading actions fit the width, and the page remains scrollable.
- Opened the mobile navigation and confirmed all seven workspace links are available. The close action was clicked; a post-close DOM assertion was inconclusive because the snapshot remained stale, although subsequent navigation and viewport restoration succeeded without a visible overlay or console error.
- The temporary viewport override was reset after testing.

### Theme behavior

Browser-observed state after selecting each mode:

| Selection | `data-theme` | Body background | Pressed-state result |
|---|---|---|---|
| Light | `light` | `rgb(247, 248, 245)` | Light true; Dark/System false |
| Dark | `dark` | `rgb(16, 22, 20)` | Dark true; Light/System false |
| System | `dark` on the current device | `rgb(16, 22, 20)` | System true; Light/Dark false |

System mode was restored after testing.

## Accessibility smoke checks

- The application exposes a skip link and a labelled `main` destination.
- Sidebar navigation is a labelled complementary region; all seven destinations have accessible link names.
- Theme buttons expose descriptive labels and `aria-pressed` state.
- Icon-only notification, menu, modal close, and sign-out controls have labels.
- Status filters use pressed states and labelled groups.
- A live DOM audit of visible `button`, `a`, `input`, `select`, `textarea`, and `img` elements found **zero controls/images without an accessible name** across the seven workspace routes and the three auth routes.
- Dialog implementations observed in source expose dialog semantics and labels; no destructive or external action was submitted during QA.

This is a basic accessibility smoke check, not a complete WCAG audit with a dedicated automated scanner and keyboard traversal matrix.

## API and data-integrity observations

- The normal application uses the shared API client and authenticated local merchant session; populated merchant/profile values visible in the shell came from the local account.
- No runtime fallback to demo/fixture data was observed or found in normal route source.
- Empty states remain truthful when the live local account has no records.
- The dashboard error copy explicitly states that sample data is not substituted.
- No live mutation was executed. This avoids creating products, staff, riders, or changing order/shop state merely for QA.

## Remaining blockers and unverified paths

1. **No owner-approved populated test records:** order review, accept/reject/preparing/ready, rider assignment, busy-rider confirmation, and assignment persistence after refetch/reload are unverified in this pass.
2. **No populated finance/catalog/team/rider data:** populated table row alignment, chart value rendering, settlement detail, staff cards, product editing, and rider detail drawers were not exercised with the live API.
3. **No automated visual-diff run against the 15 PNG targets:** reference integrity passed, and desktop/narrow live pages were visually inspected, but this report does not claim pixel-identical parity across every supplied state.
4. **No dedicated backend health endpoint:** `/api/health` is not registered. API availability was verified through `/docs` and `/api/products/categories` instead.
5. **Mobile navigation close assertion:** the close control was exercised, but the immediate DOM assertion was stale/inconclusive. No visible overlay or runtime error remained after the following navigation.

## Commands actually run

```text
rtk npx.cmd tsc --noEmit
rtk npm.cmd run build
rtk python SirfBazar_Codex_Exact_Design/tools/verify_reference.py --root SirfBazar_Codex_Exact_Design
rtk rg -ni "fixture|mock|demo data|sample data|fallback data|example records|TEST_ONLY" src
rtk rg -n "from ['\"].*\.json|fetch\(['\"]/|localStorage.*fixture|import\.meta\.env.*FIXTURE" src
rtk rg -n "^VITE_API_URL=" sirfbazar-shop/.env.local sirfbazar-shop/.env.development sirfbazar-shop/.env
rtk proxy powershell.exe -Command <Invoke-WebRequest service-health checks>
```

Browser checks used the connected Chrome session and read-only DOM/accessibility/console inspection, plus local theme and viewport controls. No external messages, uploads, account changes, production requests, or live merchant/order mutations were performed.
