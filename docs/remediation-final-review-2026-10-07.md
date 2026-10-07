# Merchant and platform remediation final review

7 October 2026

Independent review verdict: **PASS WITH WARNINGS**. No unresolved blocking findings remain in the reviewed changes. The merchant map and notification issue is fixed in the working branch and has passed isolated browser checks. These changes are not deployed to the live site.

The user reviewed this checkpoint and subsequently approved final verification, live release preparation, and all three Android APKs. Work is on `codex/remediation-merchant-workflows`. Live promotion is held until the matching API is installed on the other laptop that hosts it; this is not a production-readiness certification.

## Scope implemented

| Work package | Reviewed outcome |
| --- | --- |
| Payment authority and duplicate financial actions | Server-controlled payment transitions, conditional refund and settlement claims, collected-payment caps, and concurrency regressions. |
| OTP and account ownership | Restricted OTP projections, active account checks, tenant boundaries, and realtime owner and staff permission revalidation. WhatsApp OTP transport remains intact. |
| Inventory and checkout eligibility | Transactional stock changes and restoration, destination and merchant eligibility checks, approved quotes, and stable request identities. |
| Web and POS recovery and keyboard access | Durable uncertain-result recovery, release of definitively rejected attempts, first-address coordinates, and keyboard/focus repairs. |
| Dependencies and reproducible builds | Multer update, dependency review, clean lockfile installs for all eight apps, and isolated build evidence. Remaining build-chain advisories are recorded below. |
| Continuous integration | All eight apps included; disposable database and intercepted browser regressions added, with separately configured native and staging gates. Mock WAHA and WhatsApp tests included. |
| Search, push and location lifecycle | Latest-query handling, session-bound push registration, active-delivery foreground GPS, and capability documentation. Background GPS is not promised. |

Merchant additions include category/subcategory browsing with multiselect and selected-item price/stock editing; visible signup OTP input; CSV file/paste importing with column mapping, preview, explicit add-only/update selection, and row-level results/retry; and iPOS notifications that remain visible in dialogs and fullscreen.

The Profile map now opens as a native modal above the Edit shop drawer. Escape closes only the map and returns focus to its opener. Confirming a pin changes the draft, not the saved shop; publishing still requires Save changes. Success and save-error notifications remain visible inside the drawer. Desktop and 320px browser checks cover this behavior.

## Independent findings resolved

All seven review blockers were repaired: unpaid COD children entering refund allocation; missing first-address coordinates; definitive failures trapping saved checkout/POS attempts; stale realtime staff authority; outdated collected amounts after replacements/removals; CSV prices preserving an old discount; and the default HTTP body limit rejecting ordinary 1,000-row imports.

Bulk preview/upload now have a scoped 6 MiB JSON limit while ordinary routes retain 100 KiB. An expired exact partial-import retry returns saved audit results and marks unapplied rows as failed without fresh writes. Changed saved payloads are rejected. The HTTP boundary regression proves a representative 1,000-row body reaches authentication rather than a size error; it is not a 1,000-row database load test.

## Verification evidence

- After the final API repairs: isolated API typecheck and all 13 database, realtime and HTTP regression groups passed.
- After the map repair: isolated merchant TypeScript/Vite build and all 12 browser journey groups passed. Assertions cover desktop and 320px stacking, focus, no profile update before Save, and visible notifications. API calls were intercepted; map tiles were intentionally blocked in these fixture tests.
- Mock WAHA and WhatsApp suites passed without sending real messages. Protected Prisma schema, API app-module and WhatsApp provider files remain unchanged.
- Earlier in this run: clean `npm ci` succeeded for all eight apps; the then-current 18-check default suite and 53-check seeded HTTP smoke passed. These results precede the last review repairs and do not substitute for the pending final sweep.
- After approval, the current 20-check default verifier passed in the isolated Node 22 copy. The disposable database suite passed all 13 groups, and the refreshed browser suite passed all 12 journey groups.
- The three Android preview profiles explicitly produce APKs and pin the live API base. Independent review of that configuration-only delta passed; it does not establish successful APK builds or real-device behavior.

Interface and browser review guided the responsive layout, focus restoration, modal stacking, and screenshot checks. Detailed gate setup is in [Remediation verification gates](remediation-verification.md).

## Remaining warnings and release limits

Legacy COD records with ambiguous collection evidence can require manual reconciliation. Refund logic fails closed rather than inferring payment; see [API financial contract](api-contract.md).

Google-key Maps, screen-reader speech, 200% zoom, native devices, real scanner/printer hardware, and staging journeys remain unverified. Native and staging gates are configured, not passed. Seven previously identified Tailwind 3 build-chain audit advisories remain; a major Tailwind migration was not included.

An authentic iPOS export sample and complete version-specific shortcut reference were not available. The adaptable CSV mapper is not represented as a verified proprietary export schema, and complete shortcut parity is not claimed.

Mandatory approved quotes require coordinated compatible API and client releases. No production database was used, the existing local API was not restarted, and no live deployment occurred.

## Release checkpoint

The human review gate is approved and final automated verification passed. On 7 October, read-only inspection of the public API route catalogue confirmed that `/api/orders/quote` and `/api/merchant/products/bulk-preview` are not deployed. The user confirmed the API is hosted on another laptop. Publishing the matching website before that backend update would leave checkout and import incompatible, so live promotion remains pending coordination with that host. Production data, environment secrets, WhatsApp configuration and uploaded files must be preserved during the update; no schema migration or seed is required for this release.
