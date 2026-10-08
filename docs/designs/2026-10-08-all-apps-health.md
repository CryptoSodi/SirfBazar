# All-app internal health and repair design — 8 October 2026

## Decisions and constraints

ATeam deepdive audit stage, alongside existing run `20261008T155332Z`. Source baseline supplied by the coordinator: `f308e2e`, with tracked content consolidated to `origin/master` at `66f5b53`. This is a finite source review, not a claim that every line, device, database race or deployed service was tested. No implementation, API server/build, database writes, schema changes, deployment, commits or pushes were performed by this specialist. Only this design document is owned here.

Inputs: [current eight-item research](../research/2026-10-08-work-modification.md), [pending strategy](../strategies/2026-10-08-work-modification.md), [previous remediation design](2026-10-07-remediation-merchant-workflows.md), [previous research](../research/2026-10-07-remediation-merchant-workflows.md), architecture, API contract and backend conventions. The sole pre-existing document in `docs/designs/` was reviewed. Source wins where those records disagree. The existing strategy/authentication design gates remain intact; this report does not approve or initiate implementation.

| Approach | Trade-offs |
| --- | --- |
| Patch each screen independently | Fast local symptoms fixes, but request replay and API state invariants remain inconsistent across apps. |
| Repair shared API invariants and define a small session contract implemented in existing clients | Requires coordinated regression tests, but resolves multiple user-visible failures without replacing frameworks or adding schema. **Recommended.** |
| Rewrite clients around a universal SDK/state framework and introduce a ledger/job platform | Large compatibility and migration cost; YAGNI for the evidenced defects. Defer. |

Recommend three bounded repair batches: identity/session isolation; order/delivery invariants; basket consistency and exact money display. Preserve signed checkout, immutable recovery IDs, tenant checks, COD/cash-only tender and existing post-commit notification isolation. Local API remains `http://localhost:3001/api`; native checks require an explicit local/mock configuration because some current defaults point to production.

## Internal health: prioritized findings

“Confirmed” below means the relevant control flow exists in the inspected source. Concurrent schedules are reproducible test specifications, not results of executed concurrency tests. No exploit, customer order or device session was exercised against production.

### H1 — High: an old request can be replayed as the next signed-in account

**Evidence:** `apps/customer-app/lib/api.ts:204` retries after a 401. At line 207 it skips renewal if the current access token differs from the original token, then line 208 calls `request` again, which reads the current credentials. Merchant native (`apps/merchant-app/lib/api.ts:64`) and rider native (`apps/rider-app/lib/api.ts:61`) capture `authVersion` only after the old request returns 401. Browser clients likewise retry from current storage: web `apps/web/lib/api.ts:112`, admin `apps/admin/src/lib/api.ts:42`, POS `apps/pos/src/lib/api.ts:51`.

**Trigger/impact:** A starts a profile/cart/presence mutation, signs out, B signs in, and A's delayed response is 401. The original payload can be retried with B's token. Explicit record ownership still protects foreign order IDs, but identity-relative paths such as `/customer/profile`, `/cart/items` or `/rider/online` can mutate B's own data using A's action. This is client identity confusion, not evidence that server tenant checks are absent.

**Repair:** capture account, app role, session generation and credentials before the first asynchronous operation; reject a changed identity before refresh, retry, storage write and publishing results. Same-identity token rotation is distinct from account switching. Keep immutable checkout/sale recovery scoped to its original owner. Never automatically replay an action across identities.

**Verification:** mock delayed A responses; sign B in; assert no B-token retry or state publication for GET and POST. Cover same-account token rotation as a positive case across all seven client transports. Device execution remains unverified.

### H2 — High: browser refresh can restore logged-out credentials or overwrite a new account

**Evidence:** `apps/web/lib/api.ts:138-150` writes refresh results through `storeAuth` without checking whether logout or account change happened; `logoutLocal` at 162 does not invalidate in-flight refresh. Merchant web `apps/shop/src/lib/api.ts:206-217`, admin `apps/admin/src/lib/api.ts:61-70` and POS `apps/pos/src/lib/api.ts:69-78` have the same unguarded persistence pattern.

**Trigger/impact:** delay A's refresh response until after logout or B's login. A's credentials replace local session state. Web logout is local-only (`apps/web/app/profile/page.tsx:30`), while shop revokes its captured refresh token; neither makes an already completed replacement-token response safe to store.

**Repair:** session generation and compare-before-persist; invalidate pending refresh on logout; revoke the captured outgoing server session where supported. Handle storage events/account change across tabs. Keep recovery records, but expose them only to their owner.

**Verification:** refresh → logout → delayed success; refresh A → login B → delayed A success; tab logout during refresh. Assert no session resurrection and no stale session event/cache population.

### H3 — High: refresh-token rotation is not an atomic one-use operation

**Evidence:** `apps/api/src/auth/auth.service.ts:451-484` reads the refresh row, checks revocation, unconditionally updates it by ID, and separately calls `issueTokens`; token creation is at 436. Two requests can both read the unrevoked row and both mint successor sessions. Failure after revocation also leaves the old session invalid without a returned successor. Admin/POS and merchant/rider native transports do not coalesce refresh calls (locations in H1/H2), so ordinary parallel requests can trigger this.

**Impact:** multiple active successors from a nominally rotating credential; abrupt session loss on issuance failure; concurrent clients can clear a successful renewed session after another request fails. The guard checks session revocation on every protected request, increasing the user-visible effect of rotation races.

**Repair:** use a conditional unrevoked/nonexpired claim and successor creation in one existing serializable transaction; validate membership before committing revocation. Define one winner/one rejection semantics. Coalesce client refresh per original session, distinguishing definitive rejection from temporary transport failure. Do not introduce a process-local server mutex.

**Verification:** disposable PostgreSQL barrier test for two requests using one token; exactly one successor commits. Inject creation/signing failures and assert rollback/recoverable behavior. Client tests: parallel 401s, renewal outage and successful concurrent same-session requests.

### H4 — High: pending rider onboarding cannot use its newly issued session

**Evidence:** `apps/api/src/rider/rider.service.ts:89` creates an applicant with `isActive:false` and line 113 issues a RIDER session. `apps/api/src/common/guards/jwt-auth.guard.ts:45` rejects every RIDER request unless active. `auth.service.ts:541` still selects RIDER for any existing rider, including pending applicants. `apps/rider-app/lib/api.ts:108-116` immediately calls protected `/auth/me`; active route `screens/RiderOnboardScreen.tsx:52` catches that failure and line 60 polls protected `/rider/profile`.

**Impact:** successful application is presented with an account-refresh failure, and approval polling remains unauthorized until approval; repeated sign-in does not solve the pending-state mismatch. Inactive riders also cannot read the intended inactive account status.

**Repair:** separate authenticated rider identity from permission to perform active delivery work. Permit narrowly selected self-profile, approval/status and logout routes for pending/inactive riders; require approved and active status for presence, assignment, location and delivery operations. Do not simply remove the active check from every route. Realtime membership needs the same explicit policy.

**Verification:** apply → pending profile → merchant approval → fresh state; rejection/reapplication; inactive profile access; pending/inactive operational requests denied. Native device journey remains a separate gate.

### H5 — High: editing a saved address silently changes an existing order's destination

**Evidence:** `apps/api/src/customers/customers.service.ts:90-113` updates address text and coordinates in place without active-order protection; deletion does check active orders at 125. Placement saves `deliveryAddressId` (`apps/api/src/orders/orders.service.ts:385,412`); customer detail includes the current relation at 630; rider detail includes it in `apps/api/src/rider/rider.service.ts:217`. The signed quote binds the destination only at placement (`orders.service.ts:162,338`).

**Trigger/impact:** edit the address after the merchant accepts or rider departs. Subsequent detail/navigation reads use the new coordinates without fee, range or merchant reapproval. Historical order addresses can also change.

**Repair:** immediate bounded option: reject in-place edits/deletion while referenced by active orders inside a coordinated transaction; offer creation of a separate saved address through existing flows. Prefer an immutable order-address snapshot when separately authorized; inspect whether existing audit evidence can supply a complete legacy snapshot before promising schema-free historical preservation. Do not claim the current quote token already solves post-placement mutation.

**Verification:** active address update rejected without mutation; race placement versus edit/delete; delivered-order history policy; unrelated address edits succeed. Include text, coordinates, phone and instructions.

### H6 — High: admin cancellation leaves an assigned rider permanently busy

**Evidence:** `apps/api/src/orders/orders.service.ts:742-765` cancels active orders and restores stock but never clears the rider assignment. Assignment requires `currentStatus:IDLE` (`orders/merchant-orders.service.ts:158`). The reset to IDLE/null occurs only during successful delivery (`rider/rider.service.ts:303`), which cannot run after cancellation.

**Impact:** cancelling an assigned/ongoing order strands the rider's `currentOrderId` and prevents the next assignment. Merchant deactivation also refuses a rider with `currentOrderId` (`merchant/merchant-people.service.ts:106`).

**Repair:** in the cancellation transaction, conditionally release only the rider whose `currentOrderId` still equals that order. Preserve newer assignments; broadcast the resulting availability after commit. Reconcile existing stranded records through a separately reviewed repair procedure, not ad hoc production writes.

**Verification:** assign → cancel → assign another order; cancel versus deliver/assign races; parent cancellation with several riders; stock/refund rollback also rolls back rider release.

### H7 — High: cancellation after pickup returns goods to sellable stock before return

**Evidence:** `orders.service.ts:748` targets every nonterminal child, including `ON_THE_WAY` and `RIDER_ARRIVED_AT_CUSTOMER`. Line 753 unconditionally calls `restoreStockInTransaction`; lines 780-787 increment all confirmed/reserved replacement quantities. There is no physical-return condition.

**Impact:** an operator can cancel goods already outside the shop and immediately make those units available for another purchase. This creates phantom availability even though restoration happens only once.

**Repair:** define cancellation/restocking eligibility by fulfillment stage. Under the present schema constraint, block automatic post-pickup restock and require an explicit existing inventory adjustment only after verified return; document the operator procedure. A new returns subsystem is outside this repair.

**Verification:** pre-pickup cancel restores once; post-pickup cancel does not create sellable units; delivered orders remain protected; race pickup versus cancel has one consistent inventory outcome.

### H8 — Medium: customer web can split the first guest basket across sessions

**Evidence:** `apps/web/lib/api.ts:66-85` reads an absent guest token then independently creates/stores a session for each caller; there is no shared creation promise. Every guest request calls this helper at 104. Customer mobile already has a shared `creatingGuest` promise (`apps/customer-app/lib/api.ts:168`).

**Trigger/impact:** two first-time add-to-cart requests overlap. Each can add to a different guest basket; only the last stored token remains reachable, so a successful add appears lost.

**Repair:** one in-flight guest initialization per browser session, validated persistence before use, and identity/reset guards so a late result cannot overwrite a deliberately restarted basket. Multiple-tab coordination should be verified rather than assumed from a single module promise.

**Verification:** two simultaneous first adds produce one session and a single basket; failed creation can retry; restart/sign-in during initialization cannot revive stale guest context.

### H9 — Medium: API cart creation and quantity updates lose concurrent changes

**Evidence:** `apps/api/src/cart/cart.service.ts:40-50` performs find-then-create without a transaction; `prisma/schema.prisma:324-339` has indexes, no unique active-cart owner constraint. `cart.service.ts:57-72` reads the quantity and writes an absolute `newQty`.

**Trigger/impact:** concurrent initial requests can create two active carts for one owner, with later reads selecting only the newest; two adds to an existing item can both write the same incremented value, losing one addition. Fixing web session creation alone does not fix customer/native/multitab API races.

**Repair:** serialize owner-scoped cart creation and mutations using existing PostgreSQL transaction conventions, with quantity validation and conditional/atomic increments in that boundary. Coordinate merge and checkout readers/writers. Avoid a schema migration or global in-process lock in this stage.

**Verification:** disposable DB tests: one active cart after concurrent creation; two increments retained; concurrent merge/add/checkout cannot lose items, modify a consumed cart silently or exceed stock policy.

### H10 — High: admin nonterminal status override can create undeliverable orders

**Evidence:** `apps/api/src/admin/admin-marketplace.service.ts:240-259` disallows terminal changes but permits any other `OrderStatus` value without checking rider/payment/fulfillment preconditions. `OrderStatusService.applyInTransaction` (`orders/order-status.service.ts:29-38`) checks terminal/expected prior status, not a legal transition graph.

**Trigger/impact:** override `READY_FOR_PICKUP` to `ON_THE_WAY` without a rider. Merchant assignment then rejects the state, while rider completion cannot find an assigned order. Moving an assigned order backwards can leave its rider busy and permit inconsistent subsequent assignment. This is an authorized operator footgun, not an unauthorized endpoint finding.

**Repair:** whitelist repair transitions with explicit prerequisites and transactional companion updates, or restrict this endpoint to a small safe subset and route assignment/pickup through their domain operations. Audit must commit with the status mutation; the present audit call follows the status commit.

**Verification:** reject unassigned → en-route; reject unsafe backwards transitions; valid repair preserves rider/payment state; audit failure rolls back mutation; concurrent override and fulfillment resolve consistently.

### H11 — Medium: cash totals and change are rounded to whole rupees in the register/rider display

**Evidence:** `apps/pos/src/lib/api.ts:93-94` and `apps/rider-app/lib/api.ts:119-120` use `Math.round(paisa / 100)`. POS accepts two-decimal tender (`pages/Register.tsx:99`) and renders charge/change/receipt with that formatter at 258, 298, 318 and 321. Rider delivery uses its formatter at `screens/RiderDeliveryScreen.tsx:92` for the amount due.

**Trigger/impact:** a 100.50-rupee sale displays Rs 101, and 0.50 change displays Rs 1 although the API retains paisa. This is a money-display correctness issue, not a typography preference. Source confirms the mismatch; actual catalog incidence is unverified.

**Repair:** preserve two decimal digits where nonzero for payable totals, tender and change using a tested paisa formatter. Keep API values as integer paisa. Audit parallel merchant/admin formatters before selecting any shared helper; no currency framework required.

**Verification:** 1, 49, 50, 99, 100 and 10050 paisa render without changing value; charge, receipt and rider amount agree with the exact server amount.

## Explicit coverage and limits

| Component | Examined paths | Result and limit |
| --- | --- | --- |
| API | JWT/access/session resolution; realtime authorization; notification controllers; cart/quote/place/cancel; merchant/rider transitions; payment/refund/settlement services; admin overrides; address mutation | H1-H10 affected boundaries. Existing transaction/ownership protections observed. No database runtime or security exploitation performed. |
| Customer web | API auth/guest transport, profile logout, checkout recovery helper, prior eight-item source references | H1/H2/H8; API cart/address effects. Signed recovery is present. No rendered UI approval. |
| Merchant web/iPOS | Session transport, logout/refresh, cache invalidation; earlier iPOS design/current research | H2 plus shared API delivery failures. Existing no-auto-mutation-replay and recovery work should be retained. Full iPOS runtime not retested. |
| Admin | Transport; Orders screen/calls; corresponding override/cancel/finance services | H1-H3/H6/H7/H10. Role-specific operator UI and runtime behavior remain unverified. |
| Standalone POS | Transport; Login; Register tender/receipt; sale recovery helper | H1-H3/H11. Durable pending sale exists; do not report absent recovery from obsolete audits. No printer/scanner run. |
| Customer Expo | Credential serialization/refresh/request/guest initialization; checkout draft | H1; API cart/address effects. Secure credential abstraction and shared refresh/guest promises already exist. No device test. |
| Merchant Expo | Auth context/onboarding/refresh/logout/request | H1/H3 plus shared order paths. No native push delivery or hardware test. |
| Rider Expo | Active RiderOnboard/Home/Delivery paths, transport, foreground GPS effect, API ownership/mutations | H1/H3/H4/H6/H11. Foreground watch is implemented and focus/app-state scoped; no background tracking expansion needed. No device execution. |

Notification audience filtering and stale notification completion remain existing request **#3**, not a newly numbered duplicate. Source still lists by user alone (`notifications.service.ts:71`), while SYSTEM messages have no app audience. The original eight requests **#1–#8** remain in their research/strategy documents unchanged. Map/live configuration and screenshot-specific identity remain unverified; this internal audit does not turn source findings into live claims or replace the required ATeam authentication variant review for **#8**.

## Design drift

- `docs/architecture.md` says five clients; there are seven clients plus the API in scope. It still describes SQLite dev, although `apps/api/prisma/schema.prisma:11` uses PostgreSQL. `backend-conventions.md` also retains SQLite wording.
- Architecture describes customer mock online payment handling, but `payments/payments.service.ts:26-37` rejects initiate/confirm/fail. API contract's COD-only statement is closer to current source.
- Previous design correctly required unified transitions and recovery. New code has serializable wrappers, conditional claims, signed quote/idempotent recovery and terminal protections; do not repeat the old absence findings. H6/H7/H10 identify remaining domain invariants those primitives do not enforce.
- Previous design requires account-state enforcement. The global rider-active check implements it too broadly for pending self-profile/status flows (H4).
- “Inventory restored on cancellation” needs a fulfillment-stage qualification (H7). An immutable approved destination must extend beyond quote validation if live order details read an editable address (H5).
- Foreground GPS and durable web/POS checkout recovery exist; documentation and capability claims should retain these achievements and explicitly distinguish untested device/staging behavior.

## Technical debt and unconfirmed hypotheses

1. Session transports are duplicated with different refresh, generation, persistence and retry policies. First specify/test the small behavior contract above; extracting a shared SDK is optional, not a prerequisite.
2. Broad `any` and inline body types in admin routes bypass DTO validation benefits. Prioritize concrete transition/finance input boundaries rather than a repository-wide typing rewrite.
3. **Needs targeted investigation:** web-push endpoint input is stored directly (`notifications/web-push.service.ts:40`) and passed to `webpush.sendNotification` at 72. Assess accepted schemes/destinations and egress restrictions before claiming SSRF. No external request was attempted. Also examine logout/account-switch subscription ownership; Expo's session-aware save policy is not automatically inherited by web push.
4. **Operational gap, not a new confirmed financial exploit:** refunds hold affected pending settlements, and mark-paid rejects ON_HOLD; existing design explicitly requires reconciliation. Confirm there is a documented, authorized way to recalculate/release the hold before adding any operator capability. Do not invent a ledger migration in this audit.
5. **Device-unverified lifecycle:** rider GPS guards suppress stale callbacks, but account changes during subscription creation deserve a device/mocked lifecycle test proving subscription removal, not just ignored pings. Search and notification request ordering remain under existing backlog coverage.

## Dependencies

Dependency/advisory assessment belongs to the parallel ATeam Researcher report. This document makes no new version/CVE claim and does not reuse the previous report's Multer/Next statements as current evidence. The coordinator should attach the Researcher's current inventory/advisories and QA baseline when consolidating this design. Any upgrade should be justified by an actually resolved affected dependency and appropriate compatibility checks.

## Repair priorities, files and verification handoff

| Batch | Implementation files to plan | Tests and risk |
| --- | --- | --- |
| Identity isolation, H1-H4 | API `auth/auth.service.ts`, `common/guards/jwt-auth.guard.ts`, rider controllers/service and realtime policy; all seven client `lib/api.ts` locations named above; customer credential writer if needed | New session-race unit tests in each existing test harness; PostgreSQL refresh race tests; pending/active/inactive role matrix. **High risk:** never widen operational rider access while repairing self-status. |
| Fulfillment invariants, H5-H7/H10 | API `customers/customers.service.ts`, `orders/orders.service.ts`, `orders/order-status.service.ts`, `orders/merchant-orders.service.ts`, `rider/rider.service.ts`, `admin/admin-marketplace.service.ts`; corresponding customer address/admin order action callers only as needed | Disposable PostgreSQL concurrency tests; fixture-based address/assignment/cancel/override journeys; historical-record policy. **High risk:** inventory and rider consistency; no unapproved schema or data migration. |
| Basket and exact amounts, H8/H9/H11 | Web `lib/api.ts`; API `cart/cart.service.ts` with existing transaction helper and merge/checkout coordination; POS/rider formatter files and Register/Delivery consumers; equivalent money formatters only when verified affected | Mock guest-start races; PostgreSQL cart races; exact paisa display unit cases and fixture-based cash flow. **Medium risk:** preserve existing durable order/sale recovery IDs and cart merge behavior. |

Tests should extend meaningful existing API recovery/checkout/DB harnesses where appropriate, rather than adding assertions that merely search source strings. The developer plan must enumerate exact new test filenames and every changed controller/decorator before coding; the above is a boundary/file map, not permission to edit unnamed modules. UI changes require the repository's interface skill workflow and rendered review; this report makes behavioral/source judgments only.

QA owns runnable baseline evidence. Required future evidence distinguishes unit/mocked checks, disposable PostgreSQL races, browser fixtures and installed native/device journeys. None can be replaced by a source audit or a passing typecheck. Do not start API servers/builds or write external test data under the present audit authority.

Coordinator-reported additional baseline: 18 API mock tests executed using a borrowed ts-node/Prisma dependency tree, with 13 passing (cart merge 3, POS 7, realtime 1, API bind 2) and five customer-checkout cases failing `QUOTE_REQUIRED` at `orders.service.ts:190`. Their fixtures omit the current quote/cart contract, so those failures establish stale tests, not broken live checkout; they fail before their intended concurrency assertions. Coordinator also reports those tests are absent from package/CI named test commands, and 76 other checks passed. Update the checkout fixtures and include them in the appropriate safe test entrypoint before treating those concurrency behaviors as protected. These are attributed coordinator results, not executions performed by this specialist.

**Next steps:** incorporate Researcher/QA evidence; present these repairs alongside the preserved eight numbered requests; reconcile strategy approval and authentication design selection; then let Dev produce an exact scoped implementation plan. Existing historical data repair, production configuration, deployment and new returns/ledger features require separate explicit scope.

## Execution Contracts — approved repair scope, design-stage refinement

Run `20261008T155332Z`. The coordinator reports the user has approved **“fix all of these issues”**. This section supersedes the audit-only/pending-strategy wording above for implementation planning. It consumes [expanded improvement strategy](../strategies/2026-10-08-all-apps-improvements.md), [ecosystem research](../research/2026-10-08-all-apps-ecosystem.md) and [baseline checks](../research/2026-10-08-all-apps-baseline-checks.md). Preserve all eight numbered modifications, all H1-H11 repairs, and the separate user-visible authentication variant approval. A null automated design verification stage does not waive the tests below. Architect owns this document only; Dev receives the source implementation ownership after design handoff.

### E1. Pending rider identity and operational permissions

Three options were considered: let every RIDER route accept inactive riders (unsafe operational widening); mint CUSTOMER tokens for applicants (breaks existing rider context/status flow); use narrow route metadata while keeping RIDER identity (**choose**).

Add `ALLOW_INACTIVE_RIDER_KEY` and `AllowInactiveRider()` in `apps/api/src/common/decorators.ts`. Apply it **only** to `AuthController.me` in `auth/auth.controller.ts` and `RiderController.profile` in `rider/rider.controller.ts`. In `common/guards/jwt-auth.guard.ts`, require ACTIVE user, valid session role and existing rider on these methods; all other RIDER protected methods require both `isActive` and `approvalStatus === APPROVED`. Metadata cannot bypass account suspension/deletion, token expiry, role membership or `RolesGuard`. `google-link`, notifications, upload, shops/apply and delivery mutations do not inherit this exception. Logout/refresh already have explicit public proof-bearing routes and do not need the decorator.

`auth.service.ts` may issue/renew RIDER identity for existing pending/inactive profiles so the two permitted reads work. `getMe` must include rider `approvalStatus` in its safe projection. Rejected/deleted rider membership requires renewed rider-context login to obtain the existing CUSTOMER onboarding identity; no inactive RIDER access to another person's records. `RiderHomeScreen` must read profile before operational order requests; pending/inactive screens must not use a rejecting `Promise.all(profile, assignedOrders)` call. Active operations also recheck rider eligibility in their transaction; a guard check alone cannot authorize a mutation racing deactivation. `realtime.gateway.ts` keeps operational rider rooms restricted to approved/active riders. Pending status polling uses HTTP; a new realtime pending channel is unnecessary.

Files: those above, `rider/rider.service.ts`, `merchant/merchant-people.service.ts` for coordinated activation/deactivation, `apps/rider-app/screens/{RiderHomeScreen,RiderOnboardScreen,RiderProfileScreen}.tsx` and `lib/api.ts`. Tests: new `apps/api/test/rider-account-state.test.cjs`, new `apps/rider-app/test/rider-account-state.test.cjs`; extend `apps/api/test/remediation-realtime.test.cjs`. Required negatives: pending/inactive operational reads and all writes denied; suspended/deleted identity denied even on decorated methods; unrelated role cannot use rider profile. Include apply → pending → approve, rejection → sign-in → reapply.

### E2. Atomic refresh and seven-client session contract

Keep existing refresh schema and public endpoint shapes. Refactor `issueTokens` into a transaction-aware internal issuer accepting `Prisma.TransactionClient`, with its public wrapper opening a transaction when needed. Inside `serializable`: load and validate old token/user/membership; conditionally claim `{id, revokedAt:null, expiresAt:{gt:now}}` with `updateMany`; require exactly one claim; create successor refresh row, sign JWT carrying successor `sid`, update login timestamp and read safe profile through the same transaction. A signing/database failure rolls back old revocation and successor creation. No notification/provider network call inside the transaction. Use a fresh random refresh secret per attempt; never return an aborted attempt's secret. Competing refresh calls produce exactly one committed successor and a 401 loser; do not issue two sessions or pretend the loser is a successful refresh. If the successful HTTP response is lost after commit, reauthentication is the bounded recovery policy; do not add a new rotation-history schema or log plaintext tokens.

Every client captures `{userId, appRole, merchantId?, generation, accessToken, refreshToken}` before its first await. One refresh promise belongs to that captured generation. Before persisting tokens, retrying, clearing auth or publishing data, validate that generation/identity remains current. Changed access token within the same generation permits using the already renewed session; changed identity never permits retry. Serialize native credential writes; web cross-tab storage changes bump generation. Logout immediately invalidates local generation and captures outgoing tokens before asynchronous unregister/revoke; delayed cleanup must never read or revoke B's credentials. Temporary refresh outage retains local session and immutable recovery; only definitive credential rejection clears the matching old generation. Mutations may retry only a definitive guard 401 under the same captured identity, with existing checkout/POS immutable request IDs; network timeout/5xx remains uncertain. Retain merchant web's stricter no-auto-mutation-replay policy.

Files: `apps/api/src/auth/auth.service.ts`; all seven inspected API clients; native credentials/push helpers only where logout ownership requires changes; web/shop auth/session callers where they directly write storage. New tests: `apps/api/test/auth-session-rotation.test.cjs`, and `test/session-lifecycle.test.cjs` in each of `apps/web`, `shop`, `admin`, `pos`, `customer-app`, `merchant-app`, `rider-app`. Extend `apps/api/test/remediation-database.test.cjs` for real concurrent rotation and rollback injection. Unit mocks alone cannot establish the one-use database invariant.

### E3. One owner transaction boundary for carts, merge, checkout and addresses

Choose PostgreSQL row serialization through existing owner records; reject process-local mutexes and a new active-cart unique-index migration for this task. Add `apps/api/src/common/owner-lock.ts` with parameterized Prisma tagged `$queryRaw` SELECT FOR UPDATE on existing `Customer`/`GuestSession` rows. Never interpolate identifiers or user input into raw SQL. For operations involving both owners, acquire locks in the fixed table order **Customer, then GuestSession**, IDs sorted within each type. Lock order downstream is owner → address → cart → existing order/inventory helpers. Do not acquire owner locks after inventory/order writes.

All cart get/create/mutate/coupon/clear/view-initialization paths run inside the existing serializable helper and acquire the owner lock **before** selecting/creating the active cart. Internal helpers accept `tx` and never start nested transactions. Use atomic quantity increment or a conditional quantity update after validating final quantity under that lock. Guest merge locks customer then guest, rereads guest items inside the transaction, conditionally marks MERGED and copies once. All participating writers must follow the protocol, including checkout: in `orders.service.ts` acquire the customer owner lock at the start of the placement transaction, before committed quote/cart/address reads, and preserve exact existing-order recovery before cart validation. Reject consumed cart changes with a conflict. Build final responses from committed state without a hidden unguarded get-or-create writer. No automatic consolidation/deletion of historical duplicate active carts; report that separate reconciliation limitation.

Customer address create/update/delete/default operations also lock the same customer row. Under the lock, update/delete verifies ownership and checks `ACTIVE_ORDER_STATUSES`; reject any in-place delivery field change or deletion while used by an active order with a 409 and a stable code `ADDRESS_IN_USE`. Setting a default without changing delivery fields remains permitted. Placement holds the same lock through insertion, so either edit commits before quote revalidation or placement commits before the edit's active-reference check. This solves the race without a schema change. Existing terminal-order history continues referencing the saved address; explicitly document that immutable historical snapshots are not retroactively created. Preserve text/contact/instructions validation even if the current quote projection omits some optional fields.

Files: new owner-lock helper; `cart/cart.service.ts`, `orders/orders.service.ts`, `customers/customers.service.ts`; customer address callers only for the actionable error; no new controller route or schema. Tests: new `apps/api/test/cart-owner-concurrency.test.cjs`, new `apps/api/test/address-order-concurrency.test.cjs`, extend `customer-cart-merge.test.cjs` and `customer-checkout.test.cjs`. Update the five stale checkout fixtures with actual quote/cart fields, then explicitly wire them into `apps/api/package.json` and the existing safe verification runner/CI. Test barriers must overlap real PostgreSQL transactions: initial carts, increments, merge/add, checkout/add, placement/edit/delete. Local/mock web test `apps/web/test/guest-session.test.cjs` covers single-flight initialization and account/reset generations.

### E4. Cancellation, inventory and legal admin transitions

Keep dedicated cancellation endpoint. In `orders.service.ts`, calculate `pickedUp` from persisted `pickedUpAt` **or** pickup/en-route/arrived-customer timeline evidence, not merely the current status, because legacy admin overrides can move statuses backwards. In the same cancellation transaction, pre-pickup orders release confirmed and suggested reserved items exactly once. After pickup, do **not** restock CONFIRMED goods; release only still-unaccepted `REPLACEMENT_SUGGESTED` reservations, which were not customer-approved fulfilled goods. Record `stockDisposition:RETURN_REVIEW_REQUIRED` with affected item quantities in the existing cancellation audit JSON. Verified physical returns use the existing permission-checked inventory adjustment workflow, with an explicit operator note; no automatic return processing or new returns model. Alert the operator in the existing cancellation response/UI when return review is required.

Conditionally release rider `{id:riderId,currentOrderId:cancelledOrderId}` to IDLE/null within the cancellation transaction. Preserve `order.riderId` as history. Never clear a newer assignment. Delivery/pickup must reread the rider assignment, approval/activity and expected order state in the transaction. Retry serialization conflicts through the common helper; cancellation/delivery losers return refresh-required conflicts. Emit statuses/presence only after commit.

For admin override, choose a minimal forward-only whitelist: `SENT_TO_MERCHANT → MERCHANT_ACCEPTED`; `MERCHANT_ACCEPTED → PREPARING`; `MERCHANT_ACCEPTED|PREPARING → READY_FOR_PICKUP`. Require ONLINE nonparent orders, no existing rider/current assignment, no pickup evidence, correct COD `CASH_PENDING` or genuinely collected supported legacy payment, and no unresolved REPLACEMENT_SUGGESTED lines before READY. Set `acceptedAt`/`readyForPickupAt` accordingly. Reject all other override edges, including equal-state requests, parent changes and arbitrary CREATED/PAYMENT_PENDING/RIDER_* changes. Assignment, pickup, delivery and cancellation remain dedicated domain commands. Use a real DTO for `{status,reason}` in `admin/admin.dto.ts`; require bounded nonempty reason. Status, timeline and administrative audit commit together through `applyInTransaction`. The admin UI offers only permitted overrides and does not imply a denied transition can succeed.

Files: `orders/orders.service.ts`, `orders/order-status.service.ts`, `orders/merchant-orders.service.ts`, `rider/rider.service.ts`, `admin/admin-marketplace.service.ts`, `admin/admin.controller.ts`, new `admin/admin.dto.ts`, `apps/admin/src/pages/Orders.tsx`. Tests: new `apps/api/test/delivery-cancellation.test.cjs`, new `apps/api/test/admin-order-transitions.test.cjs`, PostgreSQL race cases in `remediation-database.test.cjs`, and new `apps/admin/test/order-actions.test.cjs`. Verify pre/post-pickup stock, unresolved replacement reservation, rider release, rollback of audit failure and parent fanout. Real data repair remains outside execution.

### E5. Schema-compatible notification audiences and historical policy

Options: title-based client filtering (unreliable); new audience columns (requires prohibited migration); versioned audience encoding in existing type strings with preserved references (**choose**). Add pure `apps/api/src/notifications/notification-audience.ts`. New persisted type format is `v1:<CUSTOMER|MERCHANT|RIDER|ADMIN|ACCOUNT>:<scopeId-or-dash>:<baseType>`, with strict parser/encoder; IDs must not contain the delimiter. MERCHANT scope is merchant ID; RIDER scope is rider ID; CUSTOMER/ACCOUNT scope is recipient user ID; ADMIN scope is the specific operator role. `referenceId` stays the original order/ticket/product/merchant identifier. `NotifyInput` requires audience and scope for all new producers. Wire responses retain base `type` for existing navigation plus `audience` and `scopeId`; encoded storage values never appear as product copy.

Controller list/read/read-all passes full `AuthUser`, not only userId. Resolve role and tenant server-side; ignore caller-supplied audience/merchant overrides. MERCHANT audience accepts owner or active staff of that merchant with permission appropriate to baseType/reference: ORDERS for order messages, INVENTORY for products, RIDERS for rider applicants, EARNINGS for settlements; owner passes. CUSTOMER and RIDER scopes require the matching current identity; ADMIN notifications require the encoded exact role. ACCOUNT is reserved for explicitly account-wide messages and may appear in each app for the owning active user. Creation call sites distinguish recipient intent: customer order events CUSTOMER; merchant owner/staff events MERCHANT; rider assignment/status RIDER; applicant requests MERCHANT with RIDERS permission; shop approval MERCHANT; platform account status ACCOUNT. Support messages derive audience from the ticket participant role at creation, never its title.

Use the same predicate before websocket delivery in `RealtimeGateway.emitAuthorized` for `notification`, after current session validation. User-room membership alone is insufficient. Project encoded type to base type **after** authorization. HTTP history and unread/read/read-all apply identical rules; list limit is applied after eligibility, with bounded internal DB paging and explicit truncation/continuation metadata if a scan bound is reached. Do not silently scan 100 raw rows and call a partially filtered result the complete inbox. Keep default history response compatible with current arrays unless all consumers are updated together; prefer a separate optional cursor-aware response only if required by the chosen scan implementation. Batch-mark only IDs selected under the current audience and ownership transaction.

Legacy rows: infer only when baseType/reference plus recipient relationships unambiguously identify one audience. Ambiguous SYSTEM or multi-role matches stay stored and unread; exclude them from default app inbox/badge/socket push. Expose them through explicit `GET /notifications?scope=legacy` and correspondingly scoped read/read-all, authenticated to the same owning user, labeled **Earlier account notifications**. This is deliberate history access, not inferred app eligibility; invalid scope values are rejected. Do not backfill/delete/mark-read historical data automatically. Each affected client can reach the legacy section without mixing its count into the current app badge. Existing screenshots alone do not identify which legacy row caused the reported problem.

External pushes must not bypass this policy. Existing PushToken/WebPushSubscription have no audience field: record registration scope as an **append-only** existing `AuditLog` event with `entityType:NotificationRegistration`, `entityId` a deterministic hashed registration identity (`<channel>:<digest>`), and JSON containing subscription ID/token digest, owner, audience/scope, registering session ID and action REGISTER/TRANSFER/REVOKE. Never store raw credentials or push key material. Resolve the latest committed event by registration identity; the existing subscription row is locked for concurrent register/transfer/revoke operations, and its current owner must match the event. Registration retains session-current and newer-owner protection; web subscribe gains `AuthUser.sessionId` equivalent to Expo. Sender selects only matching registrations and revalidates ownership/membership/session before sending. Atomic refresh appends TRANSFER events for its registrations to the committed successor ID in E2 so normal rotation does not stop alerts. Logout removes only captured owner/session subscriptions and appends REVOKE; expired/unclassified legacy registrations receive no contextual push until normal client registration renews them. Never update/delete prior audit events. Use a distinct internal event category in audit displays. No role guessing from platform/origin or token text. Test this cross-contract dependency before deploying audience encoding; measure owner-scoped metadata lookup and bound its queries rather than adding a new generic event platform.

Files: new audience helper; `notifications/{notifications.controller,notifications.service,expo-push.service,web-push.service}.ts`; `realtime/{realtime.gateway,realtime.service}.ts`; `auth/auth.service.ts` registration transfer/logout; existing producers in `orders/{orders.service,merchant-orders.service}.ts`, `rider/rider.service.ts`, `merchant/merchant-people.service.ts`, `admin/{admin.service,admin-marketplace.service}.ts`, `refunds/refunds.service.ts`, `settlements/settlements.service.ts`, `support/support.service.ts`; seven-client notification/push adapters and existing inbox views. Dev enumerates exact client files via producer/consumer search before distributing ownership. No `app.module.ts` or schema edits; reuse existing injected services or pure helpers to avoid module cycles.

Tests: new `apps/api/test/notification-audience.test.cjs`, new `apps/api/test/notification-registration.test.cjs`, extend `remediation-realtime.test.cjs`; new `test/notification-lifecycle.test.cjs` in affected client packages. Matrix: dual merchant/rider identity; two merchants; staff permission removal; account switch; ambiguous legacy SYSTEM; role-specific read-all; delayed socket/push registration; refresh transfer; stale logout cleanup. Network provider sends are mocked. Native foreground/background/cold-start proof remains a distinct device gate.

### E6. Execution order, verification and bounded scope

Dev freezes E1/E2/E5 shared session contracts first, then assigns nonoverlapping API, merchant-web, and other-client work. API owner owns all transaction/notification files and tests; other workers consume the contracts. Keep existing A/B/C repair batches plus strategy D/E/F original modifications. Shared `lib/api.ts`, notification and auth components cannot have concurrent owners. No source mutation was performed during this refinement.

Run targeted mocked tests and API/client typechecks using explicit working directories and `rtk proxy`; preserve local API configuration. Existing `scripts/verify-remediation.mjs` and CI must actually execute the repaired checkout fixtures and new targeted tests, report missing disposable-DB/browser/device prerequisites honestly, and propagate failures. Do not run API build/server, migrations or external business writes in this checkout. Database tests require the existing explicit disposable-PostgreSQL guard; absent infrastructure is unverified, not a pass. Test module design must not import/bootstrap the real API or send OTP/push/payment requests.

Native framework migration is a separate compatibility track from these bounded repairs. Research determines a supported version path, Dev enumerates app configs/lockfiles/plugins, and QA requires rebuilt installed binaries; this contract does not prescribe an unverified SDK jump. Dependency upgrades follow current advisory reachability, not stale version prose. Original #8 remains at the comparable-variants preview/approval boundary; authorized independent fixes proceed while Designer prepares it.

YAGNI exclusions: universal SDK rewrite, new notification table, event bus, returns ledger, background GPS, automatic historical cart/order reconciliation, provider replacement and payment expansion. A scoped audit-metadata mapping is permitted only where needed to preserve notification audience under the no-schema constraint; do not turn it into a general-purpose data platform. Dev must document the chosen metadata format and cleanup behavior in `docs/api-contract.md`/`docs/architecture.md` alongside the new rider, cancellation and address error contracts.
