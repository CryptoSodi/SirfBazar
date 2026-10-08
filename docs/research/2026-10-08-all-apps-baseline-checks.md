# All-apps baseline checks — 8 October 2026

Audit baseline: `f308e2e`; tracked tree equals `origin/master` at `66f5b53`. These are pre-change checks, not release approval. No application implementation, live business requests, database operations or deployment were performed.

## Results

| Check | Result | Scope / limitation |
| --- | --- | --- |
| Customer web, selected customer-mobile, merchant-mobile, standalone POS and release-gate unit/source/mock tests | 76 passed | Existing tests only; includes cross-client friendly-error policy parity. Not rendered/browser or device evidence. |
| API cart merge | 3 passed | Real service with in-memory transactional fake; not PostgreSQL concurrency proof. |
| API POS counter | 7 passed | Mock service dependencies; replay, tenant/cashier/payload checks, stock rollback and barcode policy. |
| API realtime authorization | 1 passed | Mock sockets; session, assignment, membership and database-failure rejection. No server started. |
| API bind configuration | 2 passed | Main bootstrap transpiled in an isolated VM with a fake app; no server started. |
| API legacy customer checkout tests | 5 failed | Fixtures omit the current approved quote/cart contract, producing `QUOTE_REQUIRED` at `orders.service.ts:190` before intended concurrency/rollback assertions. Not evidence of a live checkout outage. |

Total this audit: **94 tests attempted, 89 passed, 5 failed**. No tests were altered to obtain these results.

## Reproduction

From repository root:

```powershell
node --test apps/web/test/*.test.cjs apps/customer-app/test/checkout-draft.test.cjs apps/customer-app/test/customer-flow.test.cjs apps/customer-app/test/customer-reference.test.cjs apps/customer-app/test/product-purchase.test.cjs apps/customer-app/test/feedback.test.cjs apps/merchant-app/test/*.test.cjs apps/pos/test/*.test.cjs scripts/release-checks.test.cjs
```

From `apps/api`:

```powershell
node -r ts-node/register/transpile-only --test test/customer-cart-merge.test.cjs test/customer-checkout.test.cjs test/pos-counter.test.cjs test/remediation-realtime.test.cjs test/api-bind.test.cjs
```

Both commands were invoked through RTK. This fresh worktree has no app-local `node_modules`. A process-local `NODE_PATH` borrowed the existing sibling checkout's web TypeScript and API dependencies for diagnostic execution. Therefore this is **not a clean lockfile installation, typecheck, build or certification of dependency parity**. Follow-up release checks must install the current locks independently.

## Checkout test gap

`apps/api/test/customer-checkout.test.cjs` still supplies only requestId, deliveryAddressId and paymentMethod. The current service additionally requires an approved quote tied to the cart. Five tests fail before exercising their named invariant; the injected transaction failure test receives the quote error, and the legacy-client test observes zero successes instead of one.

These tests are not named in the current API package test scripts or CI steps. Existing disposable-database remediation checks may provide other checkout coverage; this audit did not execute them. Repair the fixtures to obtain/approve the real quote and retain negative assertions for absent, changed and expired intent, then add the repaired tests to the release gate. Do not relax the service's approved-quote requirement to make old tests pass.

## Not verified

- Clean `npm ci`, app builds, TypeScript checks and exhaustive dependency audit for this worktree.
- Browser journeys, rendered contrast, keyboard/screen-reader behavior, map provider configuration, and POS scanner/fullscreen behavior.
- Native Android/iOS builds, installed-phone tests, push delivery/taps, GPS and Android back navigation.
- Real PostgreSQL transactions, production configuration, deployed commit identity or production OTP/Google/payment/order workflows.

Do not start the API or run migrations, seed scripts or production mutation scripts as a shortcut to these checks. Follow repository constraints and isolated CI/staging procedures.
