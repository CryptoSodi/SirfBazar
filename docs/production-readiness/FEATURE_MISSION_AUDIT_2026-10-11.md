# SirfBazar Feature Mission - Phase 0 Audit

Audit date: 2026-10-11
Checkout: `CryptoSodi/SirfBazar`, branch `codex/publish-android-icons-build3`, commit `0fa5bdd`
Initial Phase 0 scope: source and tests in this checkout; no production mutation, database migration, deployment, load test, or security test. The later local implementation added the documented XLSX parser dependency; it did not install anything on production.

## Executive Summary

This checkout contains the customer website, customer and merchant mobile apps, merchant web portal, POS, admin app, and an API under `apps/api`. The API in this checkout is **NestJS 10 + Prisma 6 + PostgreSQL**, as shown by `apps/api/package.json`, `apps/api/prisma/schema.prisma`, and `docs/architecture.md`. The initial request described a separate Fastify + MySQL backend, which was not present in the workspace. The user subsequently clarified to continue on the stack this app currently uses; this checkout's NestJS/Prisma/PostgreSQL API is therefore the implementation target. No second backend is being fabricated or modified.

The initial audit established the baseline; implementation is progressing on the confirmed monorepo stack. The local changes below do not constitute production deployment, production migration, or end-to-end acceptance. The user selected read-only POS after the one-month trial and a 30-minute order-revision response window. Delivery-fee checkout semantics remain unresolved, so the saved merchant fee is not displayed as a customer charge or used in quotes.

The baseline checkout already contained server-verified Google ID tokens and secure account linking, real nearby-shop reads with service-radius and availability checks, a CSV import preview/commit flow, customer-native cart steppers, and explicit customer approval for replacements. The implementation pass added session-scoped Google-account visibility, removed fabricated web location defaults, moved nearby shops immediately below the hero, synchronized customer website steppers with the cart, expanded CSV/XLSX templates/import support, added weekly merchant hours and POS trial enforcement, and introduced a COD-only order-revision workflow. Remaining work includes the delivery-fee pricing decision, database migration/integration verification, native device and responsive visual review, and full end-to-end acceptance. The migration is not applied and no production service was changed.

## Implementation Update

This update supersedes the initial Phase 0 blockers below for local implementation. Statuses refer to code in this working tree; they do not imply a deployed or production-verified feature.

| # | Feature | Current status | Current evidence / remaining gate |
| --- | --- | --- | --- |
| 1 | Google account visibility | **Implemented locally; migration required** | Added authenticated `GET /auth/google-account`, based on `User.googleId`, with verified profile snapshots. Customer website/app and merchant portal/app show the session account and status. Legacy links without a snapshot remain linked with null display fields. SQL upgrade is additive and not applied to any database. |
| 2 | Merchant Google sign-in | **Partial** | Merchant app now shows an accessible branded Google sign-in control and loading/error handling while retaining native OAuth/backend verification. Native success/cancel/provider flows still need device and configured OAuth-client verification. |
| 3 | Merchant mobile UI alignment | **Unverified** | Merchant app typecheck and auth-flow tests pass; no small/large Android visual pass or screen-by-screen screenshot review has run. |
| 4 | Customer homepage nearby shops | **Partial** | Real shop records render directly below the hero with logo, shop type, weekly-hours-aware availability, distance and API-provided ETA only when present. Delivery fee is intentionally omitted because the saved merchant fee is not yet part of customer quote pricing. Browser visual journey remains unverified. |
| 5 | Current website location | **Implemented locally; visual review pending** | Removed implicit Gulberg/default coordinates and hardcoded Lahore guest/address defaults. Location is saved only after explicit confirmation, expires after 30 days, and uses geolocation or deliberate map selection. Permission and map-choice behavior has unit coverage. |
| 6 | Merchant onboarding/POS trial | **Partial; migration and fee policy remain** | Added weekly hours, coverage radius, saved delivery-fee setting, POS opt-in and server-recorded one-month trial. POS sales are disabled server-side after expiry/decline while receipts remain read-only; legacy merchants without a trial row retain existing access. SQL migration is authored but unapplied. Flat fee is not included in quotes because pricing semantics remain unconfirmed. |
| 7 | Product import | **Partial, substantially extended** | Added `.xlsx` first-sheet parsing, formula rejection, CSV/XLSX blank templates and header aliases; server continues to enforce 1,000 rows, shop ownership, preview token and idempotent rows. Client/API unit tests cover 10/100/1,000 and over-limit inputs. Disposable-database API write tests remain unrun. |
| 8 | Merchant order revision | **Partial; safe COD subset implemented** | Added persistent idempotent proposals for remove/reduce/replace, customer approval/rejection, 30-minute expiry, audit timeline, stock/price revalidation and a fulfillment gate. Original state is unchanged while pending. Digital payment and discounted/coupon orders are explicitly blocked; migration and real database concurrency verification remain. |
| 9 | Customer product quantity controls | **Implemented locally; browser visual review pending** | Product cards and detail offers use a shared server-cart store with optimistic rollback, stock limits, zero removal and server reconciliation. Web unit/browser-harness tests cover quantity transitions; interactive screenshot review remains pending. |

No production database, API, OAuth configuration, deployment or live checkout was changed.

## Repository And Dependency Check

| Check | Finding |
| --- | --- |
| Git root and remote | `C:\repos\SirfBazar`; `origin` is `https://github.com/CryptoSodi/SirfBazar.git`. |
| API implementation in checkout | `apps/api`, NestJS/Prisma; PostgreSQL datasource in `apps/api/prisma/schema.prisma`. |
| Requested Fastify/MySQL API | Not present in this checkout. No second SirfBazar backend repository was identified in the local `C:\repos` inventory or the available GitHub search. |
| Separate frontends | Not the topology of this checkout: the web, mobile, merchant, POS, admin and API code are all in the same Git repository. |
| Schema change path | This API has a Prisma schema and a small `apps/api/prisma/upgrades` SQL directory, but no Prisma migration history was found. Its backend conventions explicitly say not to change the schema or run `prisma db push`; that instruction also conflicts with the requested additive migrations. |
| Existing user work | `dummy-products.csv` was already untracked before this audit and was left untouched. |

### Remaining Verification Dependencies

- Local implementation is authorized against this repository's NestJS/Prisma/PostgreSQL API and bundled client apps. The original Fastify/MySQL description is not used for this checkout.
- Before production release, confirm the deployment target and migration procedure for this branch. Do not send secrets in chat.
- For a real visual audit of the merchant app, an available Android device/emulator or approved screenshots and target small/large screen dimensions are still needed. No physical-device render was performed here.
- Business decisions still needed for delivery-fee charging, POS access after the free trial, and order-revision expiry/payment adjustments are recorded in the relevant feature rows.

## Feature Checklist

Status meanings: **Partial** means source implements some of the requested behavior; **Missing** means the traced workflow/data contract does not implement it; **Unverified** means source evidence cannot prove the runtime or visual result; **Blocked** means implementation depends on resolving the backend/source-of-truth conflict.

| # | Feature | Status | Evidence and Phase 0 conclusion |
| --- | --- | --- | --- |
| 1 | Google account visibility | **Partial** | `User.googleId` exists. `POST /auth/google-link` verifies the current authenticated user and returns a linked email; customer and merchant profile UI includes a link action. `GET /customer/profile` returns the session user's name/email/profile image but not an authoritative Google-linked flag or Google identity profile. Merchant profile returns merchant data, not the account provider identity. The link components do not show connection status, Google display name, avatar, or connected email after reload. Do not infer linkage from matching email. No secure unlink endpoint was found. Relevant files: `apps/api/src/auth/auth.service.ts`, `apps/api/src/customers/customers.service.ts`, `apps/api/src/merchant/merchant.service.ts`, `apps/web/components/GoogleAccountLink.tsx`, `apps/shop/src/components/GoogleAccountLink.tsx`, `apps/customer-app/components/GoogleAccountLink.tsx`, `apps/merchant-app/components/GoogleAccountLink.tsx`. |
| 2 | Merchant mobile Google sign-in | **Partial** | `apps/merchant-app/lib/google.ts` invokes native Google Sign-In and requests an ID token; `LoginScreen.tsx` posts it to `/auth/google-login` with merchant context. The backend verifies Google ID tokens and rejects unauthorized new merchant self-registration. The current control is a generic text-only `TouchableOpacity`, not an official-looking branded button/icon; the Google action has no visible spinner/working label. Auth-flow tests cover context and routing, not native provider success/cancel/device redirects. API tests cover token and identity rules. Real device/build credentials remain unverified. |
| 3 | Merchant mobile UI alignment | **Unverified** | Ten merchant screens are present (`LoginScreen`, `OnboardScreen`, `DashboardScreen`, `OrdersScreen`, `OrderDetailScreen`, `ProductsScreen`, `RidersScreen`, `MoreScreen`, `CatalogScreen`, plus shared components). The available merchant-app test is auth-flow logic/static behavior; it does not render or compare every screen at compact and large Android sizes, themes, text scaling, RTL, keyboard and safe-area states. No visual defect is asserted without render evidence. |
| 4 | Customer homepage nearby shops | **Partial** | `apps/web/app/page.tsx` fetches real `/merchants/nearby` and `/products/nearby`; API `CatalogService.merchantsInRange` checks approved shops and both requested radius and merchant `serviceRadiusKm`, and returns availability plus distance/ETA. API merchant cards include `logoUrl`, `shopType`, `distanceKm`, and `estimatedDeliveryMinutes`. The homepage places the shop section after category and product sections, not immediately under the hero. It renders a generic shop icon instead of `logoUrl`, uses a `category` field the API card does not return (then falls back to city), and does not show distance or delivery fee. It shows online/open state and ETA when available. Existing web shop-availability tests pass, but no homepage visual/browser journey was run. |
| 5 | Current website location | **Partial / does not meet requested default** | `apps/web/lib/location.tsx` defines `FALLBACK_LOCATION` as Gulberg, Lahore and uses it whenever no stored location exists. Browser geolocation is requested only after the user opens the picker and presses “Use my current location”; manual map pin and address name are supported. `apps/web/lib/api.ts` stores the choice in localStorage without a timestamp/expiry. The API filters nearby merchants by service radius, but `LocationService.detect` without coordinates selects the busiest city; it is not a human-readable reverse geocode. The web header can request Google geocoding for unnamed saved pins when the Maps key is configured. There is no permission-change watcher or stale-location expiry. Tests cover map pin/address display behavior, not removal of the default. |
| 6 | Merchant onboarding, operating settings, POS trial | **Partial; POS entitlement missing** | Onboarding/profile currently capture one `openingTime`, `closingTime`, and `serviceRadiusKm`. There are no per-day hours/closed-day/overnight schedule, merchant delivery fee, or POS opt-in fields in `Merchant`/DTO/onboarding UI. `merchantTrial(createdAt)` computes an informational calendar-month interval; UI says access continues after trial. `AccessService` gives owners all `StaffPermission` values; POS service checks only the POS permission and does not enforce trial/opt-in/entitlement. Existing `merchant-saas-access.test.cjs` explicitly verifies expired trial does not block operations. No POS data deletion is performed. Relevant files: `apps/api/prisma/schema.prisma`, `apps/api/src/merchant/merchant.dto.ts`, `apps/api/src/merchant/merchant.service.ts`, `apps/api/src/common/merchant-access-policy.ts`, `apps/api/src/common/access.service.ts`, `apps/api/src/pos/pos.service.ts`, `apps/shop/src/pages/Profile.tsx`, `apps/merchant-app/screens/OnboardScreen.tsx`. |
| 7 | Product import | **Partial; CSV path exists** | Merchant web supports CSV file/paste, manual column mapping, duplicate identity detection, `ADD_MISSING`/`UPDATE_EXISTING`, preview, signed preview token, row-level outcomes/errors, same-request retry, SKU/barcode/name matching, and server-side validation. API contract/source bounds it to 1,000 rows and the UI accepts CSV only; Excel must be saved as CSV. No downloadable sample template was found. Existing tests cover CSV quoting/BOM, exact paisa conversion, duplicate/malformed rows and over-limit errors, but not actual API import writes, 10/100/1,000-row end-to-end batches or >1,000 rows. Do not call the import broken without a reproduced failure. Relevant files: `apps/shop/src/components/BulkImport.tsx`, `apps/shop/src/lib/bulk-import.ts`, `apps/api/src/merchant/merchant-products.service.ts`, `apps/api/src/merchant/merchant.dto.ts`. |
| 8 | Merchant-initiated order revision | **Missing; current unavailable flow violates the requested approval boundary** | Schema has item statuses for unavailable/replacement/removal but no order-revision record, proposed quantities, revision timestamps/statuses, expiry or audit object. `markItemUnavailable` changes the original item to `UNAVAILABLE`, restores its stock, and recomputes order totals in the merchant request; if a replacement is supplied it reserves replacement stock and creates a suggestion before the customer responds. The customer can approve/reject a replacement, but cannot approve/reject a reduced-quantity/removal revision while preserving the original order. The customer approval endpoint is transactional for replacement response only. New marketplace checkout is COD-only in the checked contract; no digital payment adjustment/refund integration may be assumed. Files: `apps/api/prisma/schema.prisma`, `apps/api/src/orders/merchant-orders.service.ts`, `apps/api/src/orders/orders.service.ts`, `apps/web/app/orders/[id]/page.tsx`, `apps/customer-app/screens/ReplacementScreen.tsx`. |
| 9 | Customer product quantity controls | **Partial across clients** | Customer mobile `AddButton` reads/reconciles actual basket state and renders a minus/quantity/plus stepper; stock/availability checks and uncertainty recovery have tests. Website `ProductCard` and product detail use a local, short-lived “Added” state after `addToCart`; they do not render the server basket quantity/stepper. Website cart quantity controls exist, and API cart rows are unique by cart and merchant product, with server-side availability/ownership checks. Cross-view quantity state is therefore not synchronized on the web listing/detail surfaces. Existing mobile product-purchase tests pass; no web listing/detail quantity-sync test was found. |

## Dependency Map

| Workstream | Client surfaces | API/data contract needed | External or operational dependency |
| --- | --- | --- | --- |
| Google visibility + merchant login | Customer web/app; merchant web/app | Session-scoped provider projection based on the authenticated user's linked subject; secure Google link endpoint; merchant-context ID-token verification | Correct web/Android/iOS OAuth client IDs and signed builds; backend repo mismatch must be resolved first. No email-match inference or client-supplied user identity. |
| Merchant mobile visual alignment | All `apps/merchant-app/screens` and shared theme/components | No new API contract expected unless a screen's data state is wrong | Device/emulator, compact/large Android viewports, accessibility/text scaling and approved designs. |
| Homepage + delivery location | `apps/web` homepage/header/location picker | Nearby shop response must expose real serviceability, logo/category, distance/ETA and an agreed delivery-fee quote; location selection/reverse-geocode semantics | HTTPS browser geolocation, Maps/geocoding configuration and restrictions. Cloud project credentials exist, but the actual production frontend environment value was not verified; current Maps key app restriction was observed as `None`, so do not expose/reuse it publicly until restricted. |
| Merchant operating settings + POS trial | Merchant web/app and POS | Per-day schedule, units/boundaries, fee policy, POS opt-in/trial activation, server-side entitlement checks at every POS route | Backend schema/migration and owner-approved entitlement policy. No automatic charge or paid plan can be invented. |
| Product import | Merchant web portal, API | Existing JSON preview/commit contract; add agreed XLSX/template contract only after confirming required formats | Spreadsheet parser/package choice, import limits and real API test database. Existing cap is 1,000 rows; larger files require explicit batch/transaction semantics. |
| Order revisions | Merchant web/app; customer web/app; rider/fulfillment gates | Persistent revision proposal/state/timestamps, approval/rejection/expiry endpoint, recalculated quote and reservation semantics, fulfillment block | Reversible migration and integration tests; COD-only safe path or real payment provider adjustment/refund support. Must not mutate confirmed order money before approval. |
| Customer quantity sync | Customer web listing/detail/cart; mobile as regression surface | Authoritative cart read/mutation payload and stock limit; existing cart API likely sufficient in this checkout but must be checked against the correct backend | Web state/event/cache design and failure reconciliation tests; avoid cross-shop selection changes. |

## Prioritized Findings

The items below were ranked from the initial audit; completed local items are superseded by the implementation update above.

1. **Resolved - Backend/source of truth.** The user clarified to implement on the stack currently in this repository. `apps/api` (NestJS/Prisma/PostgreSQL) is now the local implementation target; no separate backend is being changed.
2. **P1 - Existing item-unavailable behavior is not an approval-based revision.** The current merchant endpoint immediately changes item state and order totals; replacement approval is a narrower workflow. Implementing the requested invariant requires a persistent proposal/approval model and fulfillment/payment integration.
3. **P1 - POS trial is informational, not an entitlement.** The server intentionally leaves owner operations enabled after trial, and there is no opt-in. Turning on expiry gating needs the authoritative entitlement service and explicit commercial/renewal policy.
4. **Addressed locally - Website fabricated location.** The silent default and hardcoded Lahore guest-session/address defaults were removed. Browser visual verification remains pending.
5. **Addressed locally - Google account visibility.** Session-scoped identity contract and profile views were added; the SQL upgrade and native provider flows still require migration/device verification.
6. **Addressed locally - Website product quantity.** Listing/detail controls now synchronize through the shared server-cart store; browser visual review remains pending.
7. **Partially addressed - Import formats/templates.** CSV/XLSX, blank templates and row-bound tests are now present. Disposable-database write/concurrency coverage remains.
8. **Needs Review - Merchant mobile visual alignment.** No per-screen device/viewport evidence is available, so this remains unverified rather than a claim of visual defects.

## Proposed Implementation Batches After Source Resolution

This was the initial batch plan. The current local implementation state and test results are recorded in the later implementation update and verification sections.

1. **Auth and identity visibility:** expose the current authenticated account's authoritative Google-link projection; render name/email/avatar/status in customer/merchant settings; style the merchant native Google action using the platform's supported branded component. Test session isolation, linked vs OTP-only, duplicate email, existing/new merchant, cancellation and failure. Compatibility impact: additive profile response; preserve existing sign-in contexts. Rollback: hide the new display/CTA while leaving existing OAuth flows and stored links intact.
2. **Location and discovery:** remove silent Gulberg default, keep explicit manual/demo selection, add permission-denied/unavailable/stale states, place real nearby shops after hero and render real image/category/availability/fee/distance/ETA only when API supports them. Test serviceability boundaries and mobile/desktop layouts. Rollback: revert presentation and selector changes without changing saved addresses or API data.
3. **Merchant settings and POS entitlement:** add schedule/delivery settings and optional POS activation with UTC server timestamp, calendar-month semantics and server checks on every POS endpoint. Requires migration, server policy, and owner confirmation of expired-trial behavior. Preserve all POS orders/inventory on expiry. Rollback: disable the new opt-in UI and restore the previous entitlement policy; never delete POS data.
4. **Import completion:** preserve the existing preview/commit implementation; add deterministic sample downloads and XLSX only if confirmed as intended, define >1,000-row batching, and add 10/100/1,000+ API/database tests. Rollback: retain CSV path and remove only the added parser/template affordances.
5. **Order revision:** define proposal lifecycle and expiry (safe default: no automatic approval), persist immutable original and proposed snapshots, reserve/release inventory safely, require explicit customer approval, block fulfillment while pending, and reject unsupported non-COD adjustment paths. Add concurrency, duplicate request, ownership, timeout and audit tests. Migration rollback must preserve proposals already created; use forward-compatible migration before code removal.
6. **Web quantity parity:** source the selected offer quantity from the authoritative cart, render inline steppers on list/detail, update shared state across surfaces, enforce stock and shop identity, and reconcile uncertain writes. Preserve the current mobile confirmation behavior as a regression baseline. Rollback to the existing Add controls without touching saved cart rows.
7. **Acceptance:** full API/client regression, responsive merchant/customer web review, Android small/large device review, and a feature-by-feature acceptance matrix. No deployment or production data changes without a separate explicit approval.

## Baseline Verification Executed (Phase 0)

These were local test suites only; they do not prove deployed API behavior, Android provider login, visual parity, database production state, or full end-to-end operation.

| Command/suite | Result |
| --- | --- |
| `apps/api`: `npm run test:google` | Passed: 35 tests. Covers token verification, audience/issuer/time/email claims, safe linking, role/context, duplicate/inactive identities and provider failures. |
| `apps/api`: merchant SaaS, merchant order flow, customer checkout and shop availability unit suites | Passed: 30 tests. The trial test explicitly asserts expired trials do not block owner operations. |
| `apps/web`: shop availability, location label and map-picker selection tests | Passed: 9 tests. Does not verify homepage order/content or remove the Gulberg default. |
| `apps/shop`: `test/bulk-import.test.mjs` | Passed: 4 CSV parser/mapping/validation tests. Does not exercise the API/database import endpoint. |
| `apps/customer-app`: product-purchase and customer-flow tests | Passed: 24 tests. Covers native actual-quantity reconciliation, stepper restrictions, uncertain add and replacement IDs. |
| `apps/merchant-app`: `test/auth-flow.test.cjs` | Passed: 7 logic/static tests. Does not execute native Google sign-in or visual screen review. |

No typecheck/build, browser journey, native build/device test, production API probe, migration, or deployment was run for this Phase 0 audit.

## Phase Gate

Phase 0 is complete and local implementation is underway on the user-confirmed current stack. Continue independent work in phase order. Pause only the policy-dependent POS/delivery-fee and order-revision/payment changes until the user's pending decisions are available. This is not approval to apply migrations to production, change OAuth/Maps credentials, deploy, or perform live API mutations.

## Verification Since Implementation

| App/suite | Result |
| --- | --- |
| `apps/api` | `npm run build`, `npm run typecheck`, Google auth tests (36) and product-import API tests (4) passed. No database-backed import test ran because `DATABASE_URL` is unset; the integration harness requires a dedicated local disposable database and refuses other targets. |
| `apps/web` | Unit tests (27) and `npx tsc --noEmit` passed. Full Next build did not complete: Next 16 returned `EPERM` while creating generated route folders under `apps/web/.next`; a one-worker retry failed the same way. No browser screenshot/journey completed because the dev server could not be reached from the browser surface. |
| `apps/shop` | Bulk-import tests (8) and `npm run build` passed. Vite reports existing large entry chunks; the XLSX parser is in a lazy-loaded chunk. |
| `apps/merchant-app` | Typecheck passed; app tests (7) and push-lifecycle tests (3) passed. Device/OAuth visual verification remains outstanding. |
| `apps/customer-app` | Typecheck passed; app tests (50) passed. |

No production API calls, data writes, SQL upgrades, device builds, or deployments were performed.

## Implementation Progress Addendum - 2026-10-11

This section supersedes earlier status rows where they conflict. Implementation targets the repository's NestJS + Prisma + PostgreSQL API and its existing Next.js, React Native/Expo, and Vite applications. Status is local source status only.

| # | Feature | Status | Evidence and remaining gate |
| --- | --- | --- | --- |
| 1 | Google account visibility | **Implemented locally; migration required** | Session-owned Google snapshot endpoint and account panels exist on the web/customer/merchant surfaces; API Google tests pass (36). Apply the additive snapshot migration before deploying; browser/native account switching still needs visual/device review. |
| 2 | Merchant Google sign-in | **Partial** | Accessible branded native sign-in and loading/error handling use the existing token verification. Typecheck and existing auth-flow tests pass; real OAuth success/cancel/build-signature verification was not run on a device. |
| 3 | Merchant mobile UI alignment | **Needs Review** | Onboarding has the weekly schedule, fee, radius and POS controls; mobile typecheck passes. No compact/large Android screenshots, screen-by-screen alignment audit, or accessibility/text-scale run was available. |
| 4 | Customer homepage nearby shops | **Partial** | Homepage order and real API shop data are covered by web tests; API schedule/service-radius checks and merchant logo/type/availability/distance are present. Flat fee is withheld from customer display/pricing pending the pricing decision; interactive browser review remains. |
| 5 | Current website location | **Implemented locally; browser review pending** | Silent Gulberg/Lahore defaults are removed; saved/manual/geolocation selection is explicit and covered by unit tests. Browser permission, map and responsive journeys were not visually exercised. |
| 6 | Merchant onboarding, weekly hours and POS trial | **Partial; migration and delivery-fee decision remain** | Seven-day hours and overnight validation, radius, saved fee, explicit POS opt-in and server-recorded calendar-month trial are implemented. Expired/declined POS sales are denied server-side; portal and merchant dashboard show trial state/timing and preserve read-only history. Legacy merchants without trial rows remain grandfathered. Migration is authored, not applied. Fee remains informational/configured; checkout is distance-priced. |
| 7 | Product import | **Partial; database integration unverified** | CSV/XLSX parsing, templates, preview, row errors, duplicate/SKU matching and 1,000-row cap are implemented. Shop tests pass (8), API preview tests pass (4); no disposable-database commit/concurrency test was run. |
| 8 | Merchant order revision | **Partial; safe COD subset** | Persistent remove/reduce/replace proposals, customer approve/reject, 30-minute expiry, no auto-approval, audit timeline, tenant/idempotency checks, stock/price revalidation and fulfillment/rider-assignment gates are implemented. API revision tests pass (9). Coupon/discount and digital-payment orders are blocked; production database migration/concurrency verification and real client journey remain. |
| 9 | Customer product quantity controls | **Implemented locally; visual review pending** | Website listing/detail steppers share server-cart state, optimistic rollback and stock limits; web test suite passes (27). Existing native app cart tests pass (50). No browser/device screenshot review ran. |

### Current Verification

| Surface | Result |
| --- | --- |
| API | Nest build and TypeScript checks pass. Targeted API suites pass: Google 36, POS 9, revisions 9, import 4, plus 69 remediation unit tests. These use mocks/in-memory transactions; they do not replace PostgreSQL migration or concurrency integration tests. |
| Customer website | 27 unit tests and `npx tsc --noEmit` pass. Full Next production build previously failed with sandbox `EPERM` while Next created `.next` route output; no browser journey was completed. |
| Merchant portal | TypeScript check, Vite production build and 8 import tests pass. Build reports existing large application/XLSX chunks. |
| Customer app | TypeScript check and 50 tests pass. |
| Merchant app | TypeScript check and 7 app tests plus 3 push-lifecycle tests pass. |
| Production/database/device | Not run: no migration, database integration, Android build/device session, visual screenshot review, deployment or production API mutation was performed. |

### Remaining Work Before Acceptance

- Decide whether the stored flat merchant fee should replace or supplement distance pricing; until then it is not charged or shown to customers.
- Back up and apply both authored SQL upgrades through the approved database-change process, then run migration-aware API smoke/integration tests against a disposable database. Do not deploy the API first.
- Verify revision concurrency and database constraints on PostgreSQL, including competing approvals/fulfillment and replacement stock contention.
- Run Google OAuth on supported Android devices and review all merchant screens plus customer web pages at mobile/desktop sizes with accessibility states.
- Complete browser and device end-to-end journeys. The existing unit/type/build checks alone do not satisfy the mission's full acceptance criteria.

No production data, configuration, API, database, OAuth project or deployment was changed during these implementation passes.
