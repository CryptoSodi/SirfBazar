# SirfBazar: full-project audit evidence

Date: 2026-10-06. Repository: `C:/Users/mazha/OneDrive/Documents/SirfBazar`.

This is an analysis of the current, already-dirty working tree, not just committed HEAD and not a production certification. Eight applications were included: API, customer web, customer mobile, merchant web, merchant mobile, rider mobile, admin, and POS. Existing changes were preserved. No application fixes, dependency upgrades, commits, pushes, database mutations, provider calls, or real customer/financial operations were performed.

ATeam Researcher, Architect, QA, and PM contributed. The root agent integrated their evidence, ran additional checks and isolated probes, and used better-interface and Playwright for a bounded customer-web UI review. ATeam auto-initialization created `.agenteam/config.yaml` and six default `.codex/agents/*.toml` files; these are audit setup, not proof that a full implementation pipeline is configured or has run. The runtime reported `no-active-run` with no pipeline stages. Technical release readiness is a separate assessment: BLOCK.

## Evidence labels

- **Reproduced, isolated:** actual application module/service exercised with fake in-memory dependencies; no live API/database. This establishes the observed logic defect, not all production consequences.
- **Browser reproduced:** actual built frontend, local loopback server, fixture API responses, no credentials submitted.
- **Source confirmed:** reachable implementation and missing safeguard identified; scenario was not exercised against a live or transactional database.
- **Conditional:** applicability depends on deployment/configuration not inspected here.
- P0: immediate release blocker involving core trust or money authority. P1: must-fix correctness, security, recovery, or accessibility defect. P2: improvement/capability gap; prioritization depends on the product promise.

## 1. Verification ledger

| Application | Fresh TypeScript check | Fresh bundle/export | Other evidence |
| --- | --- | --- | --- |
| API (`apps/api`) | Pass | Deliberately not built or started, per backend conventions | 10 existing in-memory tests passed; six additional defect probes |
| Customer web (`apps/web`) | Pass | Next production build passed | Three isolated API-helper defect probes; mocked browser entry/sign-in review |
| Customer mobile (`apps/customer-app`) | Pass | No fresh native export/device run this turn | 44 existing tests passed; source review |
| Merchant web (`apps/shop`) | Pass | Vite build passed with runner config loader | Four order-alert tests passed; source review |
| Merchant mobile (`apps/merchant-app`) | Pass | Not exported/device-tested this turn | Source review |
| Rider mobile (`apps/rider-app`) | Pass | Not exported/device-tested this turn | Source and installed/lockfile comparison |
| Admin (`apps/admin`) | Pass | Vite build passed with runner config loader | Source review; no new confirmed admin-specific defect |
| POS (`apps/pos`) | Pass | Vite build passed with runner config loader | Source review of lost-response checkout recovery |

Shared theme: two tests passed. Total existing tests: **60 passed** (44 customer + 10 API + 4 merchant-web + 2 shared). Passing tests do not cover the defects below. Nine additional isolated probes reproduced defects; these are not nine passing desired-behavior tests or committed regressions.

Representative commands, all executed with the required RTK prefix:

```text
rtk proxy npx.cmd tsc --noEmit
rtk proxy npx.cmd tsc --noEmit --incremental false
rtk proxy npm.cmd run typecheck
rtk proxy node --experimental-test-isolation=none --test test/customer-flow.test.cjs test/checkout-draft.test.cjs test/customer-reference.test.cjs test/product-purchase.test.cjs
rtk proxy node --experimental-test-isolation=none -r ts-node/register --test test/customer-checkout.test.cjs test/customer-cart-merge.test.cjs test/customer-support.test.cjs
rtk proxy node --experimental-test-isolation=none --test apps/shared/design/theme.test.mjs
rtk proxy npx.cmd vite build --configLoader runner
```

Commands ran in their corresponding app directories except the shared test. The customer-web build used `npm.cmd run build` with `NEXT_PUBLIC_API_URL=http://localhost:3001/api` and telemetry disabled. It generated 18 static pages successfully. Webpack cache snapshot warnings did not fail the build. The shared test emitted a module-type warning but passed.

Default Vite build/config loading for admin, merchant web, and POS hit Windows ancestor-directory access restrictions. The locally installed Vite supports `--configLoader runner`; all three bundles passed with that alternative. This does **not** establish that the default build command works in this environment or that a clean CI install passes.

All eight `npm audit --json --ignore-scripts` runs reported zero vulnerabilities, including a repeated web audit against the public registry. Official advisory ranges still match installed Next/Multer versions. The discrepancy remains unexplained; a zero CLI count is not a clean bill of health.

No fresh native installation, Android/iOS device interaction, PostgreSQL concurrency test, deployment, payment-provider integration, push delivery, or complete end-to-end purchase-to-settlement journey was executed. Earlier customer native export/fixture work is not counted as new evidence in this audit.

## 2. Highest-risk backend findings

### B01 — P0: customer-controlled payment confirmation

**Reproduced, isolated.** An authenticated customer can confirm their own pending payment without verified provider proof; the service marks it PAID and releases the order. Caller-supplied transaction IDs are optional and are not validated by a payment provider. WALLET is also accepted without a corresponding wallet debit in the inspected placement path. Hiding online/wallet choices in a client does not protect this server endpoint.

Evidence: [payments controller](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/payments/payments.controller.ts:39>), [payment service](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/payments/payments.service.ts:56>), [accepted order methods](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:92>), [constants](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/common/constants.ts:92>).

Probe: a fake pending payment with no provider confirmation became PAID and triggered order release. No real payment or order was changed.

Required outcome: provider-verified, server-authoritative transitions; until implemented, reject unsupported methods and customer confirmation paths at the API. A controlled COD pilot must enforce COD server-side.

### B02 — P1: delivery verification secrets returned to actors who should not receive them

**Reproduced, isolated.** Assigned rider orders return raw scalar fields including `deliveryOtp`; the rider detail endpoint strips it, but the list endpoint does not. Other raw order-list/detail paths also expose the field outside the intended customer delivery stage. This undermines recipient confirmation.

Evidence: [rider list](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/rider/rider.service.ts:176>), [customer list](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:416>), [merchant order views](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/merchant-orders.service.ts:39>).

Probe: a fictional OTP was returned unchanged in the rider list. Required outcome: explicit response DTOs/allowlists; only the intended customer and delivery state may receive the secret. Add list, detail, notification, and socket negative tests.

### B03 — P1: rejected replacement requests can inflate stock

**Reproduced, isolated.** Replacement proposal restores original-item inventory before validating the proposed replacement. Validation failure leaves the original item CONFIRMED; retrying restores it again.

Evidence: [replacement service](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/merchant-orders.service.ts:184>).

Probe: two invalid requests changed stock from 8 to 12 while the original remained CONFIRMED. Required outcome: validate first; transact the original/replacement inventory and state transition together; make retries harmless.

### B04 — P1: restricted/prescription products and current approval are not consistently enforced at purchase boundaries

**Partly reproduced, isolated; remaining boundaries source confirmed.** The cart sellability helper checks availability and approval, but not restricted/prescription flags. Checkout also omits current product approval in the inspected final-sale path. Replacement and POS boundaries require the same centralized eligibility policy.

Evidence: [cart sellability](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/cart/cart.service.ts:312>), [checkout validation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:98>), [replacement](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/merchant-orders.service.ts:210>), [POS](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/pos/pos.service.ts:66>), [schema flags](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/prisma/schema.prisma:269>).

Probe: restricted + prescription fixture passed the cart helper. Required outcome: one authoritative sellability policy rechecked atomically at each sale, with explicit supported exception workflows rather than UI-only hiding.

### B05 — P1: no atomic customer-accepted quote

**Source confirmed; database race not executed.** Order input has no accepted quote version/expected total. Current prices are read before the transaction; conditional stock updates protect quantity, not the customer's reviewed price, product policy, or full quote. A review screen alone cannot guarantee the charged total remains the approved total.

Evidence: [order DTO](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.dto.ts:5>), [price validation/read](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:98>), [quote construction](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:145>), [transaction](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:198>).

Required outcome: bind placement to the accepted quote/cart/address version, reject changed price/stock/fees for explicit review, and test a change between review and commit.

### B06 — P1: address coordinates can be omitted, bypassing delivery-radius validation

**Source confirmed.** Coordinates are optional on saved addresses. Checkout skips distance/radius validation when either coordinate is null, charges the base delivery fee, and uses a fallback distance for ETA. Customer web creates this exact kind of coordinate-free address and previews the cart using the browsing location rather than the selected delivery address.

Evidence: [address DTO](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/customers/customers.controller.ts:55>), [address persistence](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/customers/customers.service.ts:78>), [serviceability](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:120>), [delivery calculation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:145>), [pricing](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/common/pricing.service.ts:14>), [web address save](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/checkout/page.tsx:76>), [web review](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/checkout/page.tsx:91>).

Required outcome: resolve/validate the selected delivery destination before quoting or placement, fail closed if it is unusable, and use that same destination throughout checkout.

### B07 — P1: order transition races can double-restore stock or overwrite competing states

**Source confirmed; PostgreSQL concurrency not executed.** Cancellation/rejection/timeout paths read status, restore inventory, and then write status without a conditional state claim. The common writer does not enforce the documented transition table. Concurrent accept/cancel or repeated cancellation can therefore operate on stale state.

Evidence: [cancellation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:524>), [timeout](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:863>), [merchant transitions](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/merchant-orders.service.ts:68>), [status writer](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/order-status.service.ts:28>).

Required outcome: conditional legal-state transitions and associated inventory effects in one transaction; real concurrent database tests for competing transitions and retries.

### B08 — P1: concurrent settlement creation can duplicate merchant earnings

**Reproduced, isolated concurrency simulation.** Eligible orders are selected before the transaction. The later assignment neither conditionally claims only orders with no settlement nor checks the affected-row count, allowing two batches to include the same earnings.

Evidence: [settlement creation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/settlements/settlements.service.ts:45>).

Probe: 9,000 paisa of fixture earnings produced 18,000 paisa across two pending batches. This was a fake-dependency interleaving, not an actual payout or PostgreSQL transaction test. Required outcome: atomic claim, uniqueness, amount derived from claimed rows, and database concurrency regression.

### B09 — P1: refund completion can double-credit; child cancellation can refund a whole multi-shop payment

**Source confirmed.** Refund completion reads APPROVED then updates by ID and credits without an atomic approved-state claim. Separately, a merchant child-order rejection reaches the parent refund path, whose amount is the whole payment despite potentially fulfilled sibling orders.

Evidence: [refund completion](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/refunds/refunds.service.ts:40>), [merchant rejection](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/merchant-orders.service.ts:101>), [refund amount](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/orders/orders.service.ts:596>).

Required outcome: ledger-backed, exactly-once refund effect and correctly bounded refundable amount per child/payment. Test partial fulfillment and concurrent completion.

### B10 — P1: merchant/rider support tickets can reference another tenant's order

**Reproduced, isolated.** Customer ownership is checked, but equivalent merchant/rider order authorization is missing when linking a support ticket. Subsequent ticket details include order metadata.

Evidence: [support controller](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/support/support.controller.ts:36>), [ticket creation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/support/support.service.ts:38>), [ticket details](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/support/support.service.ts:70>).

Probe: merchant A's ticket accepted an order belonging to merchant B. Required outcome: role-aware order access before attaching an order, with foreign-tenant negative tests for every supported role.

### B11 — P1: deleted/revoked identity and active-session checks are incomplete

**Source confirmed.** Customer deletion marks DELETED and revokes refresh tokens, but login paths reject SUSPENDED rather than DELETED. The HTTP access guard validates the JWT signature without rechecking current account state; rider access lacks the inspected active/approval checks. Socket authentication is performed at connection time without expiry/revocation eviction.

Evidence: [deletion](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/customers/customers.service.ts:179>), [auth checks](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/auth/auth.service.ts:139>), [JWT guard](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/common/guards/jwt-auth.guard.ts:20>), [access service](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/common/access.service.ts:63>), [socket auth](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/realtime/realtime.gateway.ts:44>).

Required outcome: explicit allowed identity states and current authorization across login, HTTP, and socket lifetime, with deleted/suspended/revoked-session tests. Reconfirm source paths if reorganizing the auth/shared modules.

### B12 — P1 conditional: mock authentication can be enabled without a production startup guard

**Source confirmed; production configuration not inspected.** Auth defaults to mock mode without a fail-closed production guard. Mock Google login trusts the supplied email; real verification can skip the audience check if the client ID is absent. Account linking uses the email.

Evidence: [auth module](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/auth/auth.module.ts:17>), [Google auth service](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/auth/google/google-auth.service.ts:16>), [email linking](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/auth/auth.service.ts:149>).

Required outcome: production startup must reject mock auth and incomplete verifier configuration. This report does not assert that deployed production currently runs in mock mode.

### B13 — P1: upload content is accepted based on client-controlled MIME/extension

**Source confirmed.** The authenticated upload endpoint trusts the submitted MIME, retains an arbitrary filename extension, and serves stored bytes publicly. It needs content decoding/type detection, a strict safe extension mapping, and a safe serving policy in addition to parser fixes.

Evidence: [upload controller](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/uploads/uploads.controller.ts:18>), [static serving](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/main.ts:12>).

No malformed/exploit upload was sent. See dependency section for separate Multer parser advisories.

### Existing backend controls worth retaining

Many routes already have scoped identity/ownership checks and staff permissions. Same-shop rider assignment, conditional initial stock decrements, customer-bound checkout request-ID replay, and atomic guest-cart merge are useful foundations. The previously documented refresh-token role-selection bug is already fixed. The new backend tests cover meaningful flows, but serialized fake dependencies do not demonstrate database concurrency safety.

## 3. Cross-client and recovery findings

### W01 — P1: simultaneous first guest additions can split the visible basket

**Reproduced, isolated actual web module.** [Guest-token initialization](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/lib/api.ts:65>) lacks a shared in-flight promise. Two first additions can independently create guest sessions and write different items into different baskets; local storage retains just one token.

Probe: parallel milk/bread adds created two sessions with two cart tokens; only the second token remained stored. Required outcome: single-flight guest initialization and a regression test for parallel first additions.

### W02 — P1: unconfirmed guest merge switches web reads to the account without durable recovery

**Reproduced, isolated actual web module.** Authentication is stored before merge confirmation. A failed merge retains the guest token, but `cartBase()` immediately chooses the account cart; the error sheet's Check basket action navigates there without reconciling or persistently blocking checkout.

Evidence: [auth before merge](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/lib/api.ts:203>), [cart routing](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/lib/api.ts:172>), [error CTA](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/components/LoginSheet.tsx:115>).

Probe: a fixture 503 produced `CartMergeUncertainError`, retained the guest token, switched the base path to `/cart`, and returned an empty fixture account basket on the next fetch. Required outcome: durable unresolved-merge state, reconciliation/retry using the retained guest identity, explicit user review, and a checkout guard until resolved. Do not simply clear the token.

### W03 — P1: temporary refresh-network failure signs the web customer out

**Reproduced, isolated actual web module.** Refresh treats a network exception as false; the caller removes credentials as though refresh had been definitively rejected.

Evidence: [request recovery](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/lib/api.ts:107>), [refresh handling](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/lib/api.ts:133>).

Probe: initial 401 followed by a thrown refresh network error removed both access and refresh values. Required outcome: distinguish transient unavailability from explicit invalid-session response; preserve credentials and delivery/cart drafts on transient errors. The customer-native implementation already contains useful recovery safeguards to align with.

### W04 — P1: web uncertain-order recovery is not durable

**Source confirmed.** Web placement does not send a stable checkout request ID/cart ID, and its uncertain-order state exists only in component memory. Reload can lose the instruction to reconcile before retrying. The server's active-cart claim reduces some duplicate risk, so this report does not claim that every immediate retry necessarily duplicates an order.

Evidence: [web placement](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/checkout/page.tsx:111>), [uncertainty state](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/checkout/page.tsx:33>).

Required outcome: persist stable request identity before submission and reconcile it after network loss/reload, adopting the customer-native recovery pattern with web regression tests.

### P01 — P1: POS can record a second cash sale after a lost committed response

**Source confirmed; real sale not executed.** Register keeps the ticket/charge action available after a failed fetch. If the server committed but its response was lost, clicking Complete again sends a new sale. The API input has no idempotency key and creates a fresh order on each call, subject to remaining stock.

Evidence: [register](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/pos/src/pages/Register.tsx:94>), [POS controller](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/pos/pos.controller.ts:47>), [sale creation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/api/src/pos/pos.service.ts:91>).

This is a lost-success-response scenario, not a claim that every 401 refresh retry duplicates sales. Required outcome: durable sale request identity, server uniqueness/replay, and result lookup before retrying an uncertain sale.

### M01 — P2: merchant-mobile search can remain on stale results

**Source confirmed.** Catalog `load(true)` exits when an earlier request is loading, while the triggering effect depends on query/filter. Changing a query during an in-flight load can therefore fail to load the new query after the earlier request completes.

Evidence: [catalog screen](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/merchant-app/screens/CatalogScreen.tsx:28>).

Required outcome: latest-request semantics using request generations/cancellation or a queued latest query; deterministic overlap test.

### R01 — P2/capability decision: active rider flow does not send live GPS

**Source confirmed, explicitly disclosed in UI.** App mounts `RiderDeliveryScreen`, not the legacy `DeliveryScreen` that had a location watch/ping flow. The permissions screen says this build does not send live GPS updates. This is a capability gap if live tracking is promised, **not evidence of an accidental regression**.

Evidence: [active navigation](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/rider-app/App.tsx:57>), [legacy delivery screen](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/rider-app/screens/DeliveryScreen.tsx:16>), [disclosure](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/rider-app/screens/RiderPermissionsScreen.tsx:33>).

Choose and document the pilot promise: implement/verify consented live tracking or retain honest status-only tracking. Do not advertise live GPS until verified.

### R02 — P2: rider push registration depends on revisiting permissions

**Source confirmed; native delivery not exercised.** Registration is called from the permissions screen but not from the inspected authenticated-start/session-restoration paths. A previously authorized device may not refresh its changed Expo token until that screen is visited.

Evidence: [permissions registration](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/rider-app/screens/RiderPermissionsScreen.tsx:40>), [app startup](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/rider-app/App.tsx:13>).

Required outcome: refresh registration for an authenticated user with existing permission on startup/token changes, without prompting unexpectedly; remove/rebind tokens correctly on logout/account changes.

## 4. Bounded better-interface review

### Scope and method

The inspected flow was **customer-web guest entry -> account sign-in dialog**. The built frontend ran at `http://127.0.0.1:3105`, with frontend assets allowed locally and API requests intercepted into fixtures. Other external traffic was blocked; the sole observed console error was the intentionally blocked Google Fonts request. No credentials or OTP requests were submitted. Screenshots therefore show fallback fonts and cannot establish production typography fidelity.

Widths inspected: 390px and 320px. Keyboard search focus and the sign-in Tab loop were exercised. Light-theme screenshots were reviewed. Desktop, dark theme, assistive-technology output, all remaining screens, and the other apps were not visually certified. The temporary server and browser were stopped afterward.

### Ranked UI findings

| Rank | Severity / domain | Evidence | User impact | Recommended correction |
| --- | --- | --- | --- | --- |
| 1 | HIGH / Accessibility | Browser: search input matched `:focus-visible`, but computed outline was `none 0px`, box-shadow `none`; `.sb-site-search input` overrides the general ring | Keyboard users cannot see when the search field is focused | Restore a clear input or search-container focus indicator; test keyboard light/dark states |
| 2 | HIGH / Accessibility | Browser: Tab repeated phone -> optional name -> Close -> phone; terms/privacy anchors were never reached. The custom trap selects only buttons and inputs | Keyboard users cannot access legal links inside the dialog | Use a complete, tested dialog focus-management primitive or include every visible tabbable element, including links and embedded sign-in controls |

Sources: [search CSS](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/globals.css:156>), [general focus ring](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/app/globals.css:124>), [dialog focus trap](<C:/Users/mazha/OneDrive/Documents/SirfBazar/apps/web/components/LoginSheet.tsx:43>).

### Six-domain coverage

- **Accessibility:** two HIGH issues above confirmed. The phone field does show a ring; the dialog has an accessible heading and labelled fields. No screen-reader certification.
- **Layout:** inspected pages had `documentElement.scrollWidth === innerWidth` at 320px. No horizontal overflow observed there; this does not prove all states or soft-keyboard behavior.
- **Writing:** no-coverage text explicitly distinguishes an example browsing location from a delivery address; sign-in discloses no preselected marketing signup. Recovery copy must be backed by the durable safeguards in W02/W04 before it is trustworthy.
- **Typography:** source/computed search text is 13px. Evaluate touch text-entry sizing on real iOS, but iOS zoom was not tested and is not listed as a reproduced defect. Fonts were blocked, so exact wrapping/font fidelity is unverified.
- **Colors:** light tokens and visible focus contrast were inspected only in the narrow flow. Dark theme and a complete contrast matrix were not verified.
- **UI polish:** entry/sign-in screenshots were inspected; no speculative aesthetic issues were added. Full reference-image parity is outside this bounded pass.

**UI verdict: BLOCK for the inspected flow until the two HIGH keyboard issues are fixed; remaining surfaces unverified, not approved.**

Artifacts:

- [390px entry](<C:/Users/mazha/OneDrive/Documents/SirfBazar/output/playwright/ateam-entry-390.png>)
- [320px entry](<C:/Users/mazha/OneDrive/Documents/SirfBazar/output/playwright/ateam-entry-320.png>)
- [320px sign-in](<C:/Users/mazha/OneDrive/Documents/SirfBazar/output/playwright/ateam-login-320.png>)

## 5. Researcher: external signals and dependency health

### Actionable official advisories

1. **Multer 2.0.2 is in published DoS-affected ranges.** The API's authenticated `FileInterceptor` upload route is present. The 6MB application limit is not a fix for parser recursion/field-index handling. See [recursion advisory, fixed in 2.1.1](https://github.com/expressjs/multer/security/advisories/GHSA-5528-5vmv-3xc2) and [oversized field-index advisory, fixed in 2.3.0](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4). Select a currently patched compatible release, checking later advisories as well; the [later disk-storage advisory](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34) is not evidence that this project's memory-upload path uses disk storage. No exploit was attempted.
2. **Next 14.2.18 is unsupported and falls in a Windows-server RCE advisory range.** Actual production OS/hosting was not inspected; deployment docs describe Vercel. The Windows-specific exploit prerequisite must not be presented as confirmed production exposure. A supported patched release is still required. Sources: [support policy](https://nextjs.org/support-policy), [Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36). Other advisories must be matched to actual features: [AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4); [middleware bypass advisory](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw), with no relevant middleware found here and hosting-dependent mitigation. Do not combine these into an unsupported claim of exploitation.

### Avoid indiscriminate upgrades

Vite 6.4.3 is a supported security-patched line per [Vite releases](https://vite.dev/releases) and the [relevant Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff). Prisma 6.19.3 already incorporates a security fix ([release](https://github.com/prisma/orm/releases/tag/6.19.3)); a Prisma 7 move has a separate [migration guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) and should not be slipped into an emergency patch.

Expo 54 / React Native 0.81 / React 19.1 is a coherent SDK family, but native builds still need validation ([SDK reference](https://docs.expo.dev/versions/v54.0.0/), [SDK 54 release](https://expo.dev/changelog/sdk-54)). React 19 usage alone does not prove React Server Components exposure in native/Vite apps ([React advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)).

Local Node 24.14.0 versus CI Node 22 is a reproducibility difference, not by itself unsupported software ([Node release schedule](https://nodejs.org/en/about/previous-releases)). PostgreSQL 16 is supported through 2028-11-09; deployed minor version was not inspected ([PostgreSQL policy](https://www.postgresql.org/support/versioning/)).

### Reproducibility and release coverage

Rider installed dependencies differ from the committed lockfile resolution: Expo 54.0.37 installed versus 54.0.35 locked; Google auth 16.1.5 versus 16.1.2; navigation native 7.5.0 versus 7.3.1; native stack 7.20.0 versus 7.17.3. Fresh typecheck success therefore does not prove `npm ci` reproducibility. No clean reinstall was performed in the user's dirty tree.

The inspected [CI workflow](<C:/Users/mazha/OneDrive/Documents/SirfBazar/.github/workflows/ci.yml:1>) has API, customer-web, and admin jobs only. It does not cover the other five applications or run all newly added regression suites. CI's existing database setup/smoke scripts were read, not executed against any database during this audit.

## 6. Design drift, maintainability, and roadmap

- September status reports describing zero tests or absent customer mobile support/realtime are stale relative to this working tree. Update documentation from a current eight-app inventory, not from old status prose.
- The stronger customer-native checkout/recovery implementation and weaker customer-web helper flow have diverged. Share contracts/state-machine tests and centralize server policy; do not force identical platform UI code merely to remove duplication.
- The documented order transition discipline is not enforced by the common status writer. Make the policy executable and test all callers.
- No checked-in Prisma migration history was found. Treat schema evolution, backup/restore, and rollback as explicit deployment work; do not improvise a live `db push` as an audit or release fix.
- Prioritize correctness and controlled fulfillment over loyalty, routing optimization, advanced POS, or additional payment methods. The rider live-GPS promise needs a deliberate product decision.

## 7. PM priorities and acceptance gates

| Order | Package / priority | Effort | Owner | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Money authority, refunds, settlements / P0 | Large | Architect + Dev; Reviewer + QA gates | Unsupported payment paths rejected; provider authority when enabled; one refund credit and settlement claim under actual DB concurrency; correct partial-shop refund |
| 2 | Identity, secrets, tenant isolation / P0 package | Large | Architect + Dev; security review | No rider/merchant OTP disclosure; foreign-order ticket negatives; deleted/suspended/revoked HTTP and socket tests; production mock-auth startup failure |
| 3 | Inventory, eligibility, accepted quote and destination / P0 package | Large | Architect + Dev + QA | Invalid replacement is non-mutating; legal atomic transitions; restricted items blocked at all sale boundaries; valid selected-address coverage and quote; race tests |
| 4 | Web/POS durable recovery and keyboard access / P1 | Large | Dev + QA; interface review | Single guest session for concurrent adds; merge gate survives reload; transient refresh retains credentials; uncertain checkout/POS reconciles stable IDs; both UI HIGH findings fixed |
| 5 | Targeted dependencies and lock reproducibility / P1 | Medium | Dev + Reviewer + QA | Patched supported Next/Multer, upload regressions, clean lock-based install/typecheck/build evidence in isolation |
| 6 | Eight-app release gate and operational evidence / P1 | Large | QA + Architect | CI covers eight apps and all suites; DB concurrency regressions; native exports/device journeys; isolated staging customer -> merchant -> rider -> admin reconciliation; migration/restore evidence |
| 7 | Fulfillment scope and truthful documentation / P1 if promised, otherwise P2 | Medium | PM + Dev + QA | Merchant latest-query behavior; push refresh on existing permission/session; explicit GPS capability decision; current capability matrix |

These effort labels are relative, not delivery-date promises. Fixes require a separate implementation request. A customer-facing pilot should not proceed merely because all bundles compile. If a COD-only pilot is chosen, the restriction must be enforced by the API and the remaining identity/inventory/recovery/release gates still apply.
