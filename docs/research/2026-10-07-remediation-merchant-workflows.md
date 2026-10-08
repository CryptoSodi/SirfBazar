# Remediation and merchant workflow research

Date: 7 October 2026. ATeam run `20261007T122811Z`, research stage. Baseline `c603943`; branch `codex/remediation-merchant-workflows`.

## Scope and limits

Read the seven-package plan and required architecture, API contract, backend conventions, deployment, remaining-work and capability records. Current source overrides stale September plans. This is a finite source gap map, not an executed security assessment. No live exploit, OTP send, sale, database mutation or production change was performed. File lines identify the inspected baseline and may move during implementation.

Preserve WhatsApp OTP, existing working workflows and public browsing. No Prisma schema or `app.module.ts` edits; no API restart; use disposable databases for integration tests. Main reports correcting obsolete pipeline `pytest` verification and `src/lib` write scopes to application scopes and `node scripts/verify-remediation.mjs`. Dev/QA must actually create and execute that runner.

## Immediate merchant findings

| Finding | Source evidence | Recommendation |
| --- | --- | --- |
| Signup OTP input misses visible input styling | `apps/shop/src/auth/SignupFlowPage.tsx:280` renders input directly in `.signup-verification`; `signup-flow.css:35` supplies white background, border, minimum height and padding only to other wrappers; `:114` supplies only width/alignment/font/spacing | Reuse base input styling for verification. Preserve six-digit validation, paste and autocomplete. No WhatsApp service change is needed. Screenshot supports the symptom; browser computed style and empty/focused/filled/error states still need verification. |
| Routine iPOS messages render in document flow | `apps/shop/src/pages/IPos.tsx:60,187,224,273` uses notice state for add/hold/saved feedback; rendering near `:333`. Existing `components/ui.tsx:36` exposes useToast | Routine success should be an anchored polite toast without scanner-focus movement. Uncertain sale, storage failure, capability restrictions and actionable errors stay persistent. Test native/fallback fullscreen and dialogs: body portals outside native fullscreen can disappear. |
| Catalogue lacks reference multi-select | `apps/shop/src/pages/Products.tsx:86` flat category list; `:90` product cards; `:570` individual price/stock prompt | Category/subcategory disclosures, selectable grid, selected-items editor. Persist selection across filtering/pagination. Scope Select all explicitly to visible eligible products; exclude already-listed rows. Review price and stock before adding. |
| CSV import is paste-only and parser is fragile | `apps/shop/src/pages/Products.tsx:323,326` split lines/commas; `:339` immediately posts; `:347` textarea only | Add file selection, quoted CSV parser, mapping, preview and row-level errors. Existing quoted commas/newlines cannot be safely parsed with split. No silently overwritten stock. |

Reference interaction states before coding: category collapsed/expanded; grid loading/error/retry/empty; selected/unselected/already-listed; empty selected panel; invalid price/stock; submitting; partial failure retaining failed rows; full success; narrow stacked layout. Native checkboxes for selection and buttons for disclosures avoid click-only cards. Existing React/Vite components/tokens should be reused.

Interface skills informed source analysis (accessibility, layout, writing, typography, colors, UI). Rendered contrast, 320px reflow, 200% zoom, focus traversal and screen-reader output were not tested here; this is not interface approval.

## Official iPOS export evidence

The [official welcome page](https://www.ipos.net.pk/content/welcome-ipos.html) describes counter/back-office inventory operation, but no export schema. The [official brochure, final page](https://www.ipos.net.pk/sites/ipos.localhost/files/iPOSNewsimple.pdf) lists CSV/text/HTML report export, categories/subcategories, numeric/alphanumeric product codes and barcodes, item-file lists and stock-position reports. This establishes export capability, **not particular CSV headers, Excel sheets, delimiters, encoding or stock units**. No verified export sample or Excel workbook contract was found in inspected official material and targeted site searches. The actual PDF text was used; search-generated screenshot text was unreliable.

| Import alternative | Trade-off | Recommendation |
| --- | --- | --- |
| Hard-coded purported iPOS headers | Fast but unsupported by official evidence; report/version differences break it | Reject as default; never call invented headers official compatibility. |
| CSV upload with editable mapping and preview | Fits documented CSV export; merchant confirms meaning and units | Implement first, retaining paste fallback. |
| Native XLS/XLSX ingestion | Convenient for actual spreadsheet exports, but needs safe parser, sheet/header selection; vendor format unverified | Optional generic support or follow-up, not verified iPOS compatibility. Saving Excel as CSV is an explicit fallback. |

Suggested SirfBazar mapping destinations (not observed iPOS headers): catalogue identity/name, category/unit, merchant SKU/barcode where supported, sale price in rupees, stock units. Preserve identifiers as strings and leading zeros. Distinguish sale price from cost and stock units from stock value. Validate bounded size/row count, finite nonnegative numbers, safe integer paisa and whole packaged units. Detect duplicate/ambiguous identity. Show matched/new/skipped/conflicting rows and planned mutations. Default add-missing mode; existing price/stock updates require explicit mode/confirmation. New products follow moderation. Item-file reports may lack stock: request a stock report or explicit value, not silent zero/default.

## Seven-package gap map

| Package | Current evidence | Implementation/test direction |
| --- | --- | --- |
| 1. Payment authority and money races | `apps/api/src/payments/payments.controller.ts:36` exposes customer confirm; `payments.service.ts:50` advertises mock confirmation. `refunds/refunds.service.ts:41,50` checks status before unconditional transaction update/wallet credit. `settlements/settlements.service.ts:46,80` reads unsettled orders outside transaction and later stamps IDs without unsettled predicate | Production customers cannot confirm/fail money. Keep cash/COD; reject unsupported tenders. Conditional transactional claims, credit/status/audit; settlement amount only from actually claimed orders. Concurrent refund/process/generate/mark-paid/cancel tests. A process-local mutex is insufficient. |
| 2. OTP/account state/tenancy | `common/guards/jwt-auth.guard.ts:21` verifies token but does not recheck account status. `rider/rider.service.ts:178` returns order rows with include/all scalars; detail `:224` removes OTP but list does not. `support/support.service.ts:39,41` checks linked order ownership only for customer role | Active/deleted/suspended account enforcement; safe projections for list/detail/children/mutations; OTP reveal only to authorized customer at correct state. Support ownership across merchant/rider roles; active staff membership/permission. Preserve WAHA provider. |
| 3. Inventory/eligibility/destination/quote | Checkout conditional decrement already exists at `orders/orders.service.ts:201–212`; do not claim absent. Replacement at `orders/merchant-orders.service.ts:230` decrements outside unified transaction. `orders/order-status.service.ts:36` writes without expected prior status. Web POST `apps/web/app/checkout/page.tsx:115` has no approved quote binding | Atomic competing transitions/restoration/replacements; current merchant/product eligibility and destination checks at commit. Bind submitted order to approved items/address/prices/fees/coupon total. Reject changed quote for review. Test last-unit races and stock restoration exactly once. Architect must specify backwards compatibility. |
| 4. Recovery/keyboard | Web `checkout/page.tsx:115` omits stable requestId/cartId; `:123` uncertainty is component state only. Standalone POS `apps/pos/src/pages/Register.tsx:95` submits without stable request reference; `:22` cart is component state. Merchant iPOS already has durable pending workflow | Persist immutable payload and identity before send; exact-ID recovery across reload/auth failures; never invent fresh ID after uncertain response. Storage failure handled explicitly. Original two keyboard defects were not reproduced in this finite pass: revalidate them in current UI rather than assume stale findings. Add OTP, bulk selection and overlay focus tests. |
| 5. Dependency/build | `apps/web/package.json:14` already Next16.4.0. `apps/api/package-lock.json:646,3948` resolves Multer2.0.2 | Recheck present advisory ranges and every transitive resolution; compatible patch/override with fresh lockfile install under Node22. Do not downgrade Next to follow old findings. Test malformed/aborted uploads. |
| 6. CI eight apps | `.github/workflows/ci.yml:9` onward has API/web/admin only; API already runs disposable Postgres and smoke | Add shop/POS build, three native typecheck/tests, database concurrency/security regressions and browser journeys. Real native/emulator and staging jobs must not be replaced by labels on web tests. Isolate/gate secrets and report unavailable infrastructure. |
| 7. Search/push/GPS/docs | `customer-app/components/CatalogScreen.tsx:42–55` owns async debounced search. All native `lib/push.ts` use module token/inflight state (customer `:11,36,58,67`). Legacy `rider-app/screens/DeliveryScreen.tsx:28–33` sends foreground location; new `RiderDeliveryScreen.tsx:74` status action omits coordinates | Latest-request-wins search including location-await race. Session-generation-bound push registration and server token ownership cleanup; test logout during registration/account switch. Check navigation uses which rider screen. Foreground-only active-delivery GPS is safe scope; do not silently add background tracking. Update stale capability claims. Lifecycle defects require tests before claiming confirmed runtime behavior. |

### Dependency sources

[Multer official changelog](https://github.com/expressjs/multer/blob/main/CHANGELOG.md) lists security fixes through2.4.0; [orphaned upload advisory](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34) specifies affected2.2.0–before2.4.0 and patched2.4.0. That particular range alone does not prove2.0.2 affected; check earlier advisories too. Upgrading only to2.2.0 leaves later documented risk. Check [Next's official advisory index](https://github.com/vercel/next.js/security/advisories) against current16.4.0, including cache/image advisories; presence of a version is not security attestation.

## Recommendation and verification gates

| Strategy | Benefit | Limitation |
| --- | --- | --- |
| UI-only fixes/documentation | Fast merchant improvements | Leaves confirmed money races and recovery gaps; insufficient for requested table. |
| Schema-less conditional/serializable transactions and durable recovery | Fits repo constraints, preserves live data model, addresses current races | Needs precise state predicates, bounded serialization retry and disposable DB concurrency tests. Notification failure must not misrepresent committed writes as failed. |
| New ledger/provider/background GPS expansion | Broader long-term functionality | Requires migration/provider/privacy decisions beyond current safe scope. |

Recommend the middle approach with independently owned merchant UI changes. Require all-eight-app checks plus money/stock concurrent regressions, negative role/tenant tests, lost-response recovery, keyboard/fullscreen/OTP and CSV edge cases. Clearly separate implemented/tested code from unrun native hardware and staging checks. This research did not execute builds or mutation tests.
