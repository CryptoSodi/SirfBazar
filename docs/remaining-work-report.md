# SirfBazar Remaining Work Report

Generated from the repository on 2026-09-21.

## How to read this report

This report distinguishes between:

- **Launch blockers:** unsafe or non-functional for real public use.
- **Correctness and security:** defects or controls that should be resolved before scale.
- **Incomplete workflows:** backend/data support exists, but the user-facing workflow is incomplete.
- **Scale and operations:** work needed for reliable production operation.
- **Product enhancements:** useful capabilities that are not required for the first controlled launch.

Items are based on repository evidence. A database field or API endpoint alone is not counted as a completed customer-facing feature.

## P0: launch blockers

### 1. Replace mock OTP with a real SMS provider

**Current state:** `OTP_PROVIDER=mock` accepts the master code `123456`. The external provider class is a generic placeholder that posts to `{baseUrl}/send` and explicitly expects adaptation to a selected vendor.

**Work required:**

- Select a Pakistan-capable SMS/OTP provider.
- Implement its exact authentication, request, error, delivery-status, and retry contract.
- Remove the production master-code path by setting and validating `OTP_PROVIDER=external`.
- Add provider timeout, retry, circuit-breaker, and observability behavior.
- Test phone normalization and delivery to Pakistani numbers.

### 2. Integrate real online payments

**Current state:** card, JazzCash, EasyPaisa, wallet, and bank transfer all use a mock confirmation flow. The customer mobile app immediately calls the confirm endpoint itself. No provider redirect, signature verification, webhook, reconciliation, or dispute handling exists.

**Work required:**

- Choose payment providers and implement provider-specific adapters.
- Create server-to-server signed callback/webhook endpoints.
- Make payment confirmation provider-controlled rather than customer-controlled.
- Add idempotency keys, duplicate-callback handling, timeout handling, and reconciliation jobs.
- Add real customer redirect/deep-link UI and failure/retry states.
- Define partial refund behavior for each provider.

### 3. Implement wallet spending or remove it as a payment method

**Current state:** refunds credit `walletBalancePaisa`, and profiles display the balance. `WALLET` is accepted as an online method, but no checkout UI selects it and no order code debits or validates the wallet balance.

**Work required:**

- Add a wallet ledger rather than relying only on a mutable balance.
- Validate and atomically debit wallet funds during order placement.
- Restore funds on payment/order failure.
- Add wallet checkout UI and transaction history.
- Alternatively, remove `WALLET` from accepted methods until the full flow exists.

### 4. Remove demo production credentials and verify auth configuration

**Current state:** seeded admin passwords and demo login instructions are documented. Google auth supports production token verification, but production configuration must be verified. Refresh tokens are stored persistently in browser local storage.

**Work required:**

- Rotate all seeded admin passwords and production JWT secrets.
- Ensure demo seed credentials are not created in production deployments.
- Set and verify the production Google client IDs for every client platform.
- Decide whether browser refresh tokens should move to secure, HTTP-only cookies.
- Store mobile refresh tokens in platform secure storage rather than general AsyncStorage.

### 5. Make the API, database, and tunnel reliably always-on

**Current state:** the API and PostgreSQL are hosted on a Windows PC through a manually managed Cloudflare Tunnel. The deployment guide itself marks process auto-start, sleep prevention, and backups as unfinished. A stale tunnel connector has already caused public API requests to hang.

**Work required:**

- Install the API and Cloudflare Tunnel as supervised startup services.
- Configure PostgreSQL service startup and recovery.
- Disable host sleep and define reboot recovery procedures.
- Add public API health checks and alerting.
- Add automated PostgreSQL backups and regularly test restoration.
- Prefer a managed production host/database when commercial traffic begins.

### 6. Introduce controlled database migrations

**Current state:** there is no `prisma/migrations` history. Development and CI use `prisma db push`, which does not provide a reviewed, repeatable production migration chain.

**Work required:**

- Baseline the current production schema.
- Adopt `prisma migrate dev` and `prisma migrate deploy`.
- Define backup, rollback, and data-migration procedures.
- Stop using `db push` for production schema changes.

## P1: correctness and security

### 7. Preserve the active login role during token refresh

**Confirmed defect:** login issues a role for the selected context (`customer`, `merchant`, `rider`, or `admin`), but refresh-token records do not store that context or role. `refreshTokens()` reissues the token using `user.role`. A multi-capability account can therefore refresh into the wrong role and lose access to the current app.

**Work required:** store the issued role/context with the refresh token, validate it on refresh, and add tests for a user who is both a customer and merchant/rider.

### 8. Add API abuse protection and standard security middleware

**Current state:** OTP resend cooldown and attempt limits exist, but there is no general request throttling visible in the API, no per-IP/login rate limiting, and no Helmet-style security-header setup.

**Work required:**

- Add route-sensitive throttling for OTP, login, search, uploads, and support messages.
- Add secure HTTP headers and explicit payload-size limits.
- Add structured request IDs and security-event logging.
- Review CORS configuration per environment.
- Add dependency and secret scanning to CI.

### 9. Harden file uploads

**Current state:** authenticated users can upload an image based on client-provided MIME type and filename extension. Files are written to local disk and publicly served by the API. There is no image decoding, content validation, malware scan, resizing, quota, or lifecycle management.

**Work required:**

- Decode and re-encode supported image formats.
- Reject SVG/HTML-active content unless safely sanitized.
- Add dimensions, quotas, ownership metadata, and deletion behavior.
- Move production files to private S3-compatible object storage with controlled public delivery.
- Add document-specific access controls for merchant verification files.

### 10. Enforce restricted-product and prescription rules

**Current state:** products contain `isRestricted` and `requiresPrescription`, and the catalog returns those flags. No ordering, prescription upload, pharmacist review, age verification, or fulfillment restriction uses them.

**Work required:** either block restricted products from checkout or implement the complete compliance workflow before pharmacy products are sold publicly.

### 11. Strengthen automated testing

**Current state:** the repository has one API smoke-test script. There are no unit tests, client component tests, browser end-to-end tests, mobile tests, or dedicated security/permission regression suites.

**Work required:**

- Add unit tests for pricing, coupons, status transitions, refunds, settlement math, and access control.
- Add integration tests for concurrent stock updates and payment idempotency.
- Add Playwright tests for guest browse, login-at-checkout, order tracking, merchant fulfillment, admin operations, and POS.
- Add role/tenant isolation tests for every sensitive endpoint.
- Add mobile navigation and API-contract tests.

### 12. Expand CI to every application

**Current state:** GitHub Actions builds the API, customer website, and admin dashboard. It does not build or type-check the merchant web portal, POS, customer mobile app, merchant mobile app, or rider mobile app.

**Work required:** add all five omitted clients to CI, cache dependencies, and fail pull requests on type or build errors.

## P1: incomplete user workflows

### 13. Connect clients to Socket.IO realtime updates

**Current state:** the backend implements authorized Socket.IO rooms and emits order, rider, merchant, and notification events. No client imports or connects to Socket.IO. Customer tracking polls every five seconds, and merchant order screens poll every ten seconds.

**Work required:**

- Add authenticated socket clients.
- Join and leave authorized order/merchant/rider rooms.
- Update order status and rider location from events.
- Retain slower polling as a recovery fallback.
- Handle reconnects, token refresh, background/foreground transitions, and duplicate events.

### 14. Build notification-center interfaces

**Current state:** notification persistence, unread filtering, mark-read endpoints, websocket events, and Expo push delivery exist. None of the clients provides a notification list or unread-management interface.

**Work required:** add notification center screens, unread badges, deep links to referenced orders/tickets, mark-read behavior, and notification preferences.

### 15. Complete customer support interfaces

**Current state:** the API supports ticket creation, lists, details, and threaded messages for customers, merchants, and riders. The admin dashboard has ticket handling. The customer website can only create an order-linked ticket; customer/mobile/merchant/rider clients do not expose complete ticket lists and conversations.

**Work required:** add ticket history, detail, replies, attachments, status display, and push/deep-link handling across relevant clients.

### 16. Complete merchant staff administration

**Current state:** the backend supports merchant staff records and granular permissions. The merchant web and mobile apps do not expose staff creation, editing, disabling, or permission assignment.

**Work required:** add staff administration UI, invitation/onboarding rules, permission presets, and permission-aware navigation.

### 17. Expose merchant documents and bulk catalog operations

**Current state:** merchant-document and bulk-product endpoints exist, but the merchant clients do not provide complete document management or bulk-upload workflows.

**Work required:** add document upload/status UI, admin verification actions, CSV/template import, validation preview, row-level errors, and retry behavior.

### 18. Finish replacement handling in mobile clients

**Current state:** the website can respond to replacement proposals. The customer mobile order-detail screen does not expose the equivalent response flow.

**Work required:** show proposed replacement details, price differences, accept/reject controls, expiry behavior, and notifications on mobile.

### 19. Build loyalty behavior

**Current state:** `loyaltyPoints` exists in the customer model and is displayed through profile data, but no earning, redemption, expiration, ledger, or admin policy is implemented.

**Work required:** define the loyalty rules and build the ledger, order integration, customer history, and admin controls, or remove the field from visible product messaging until implemented.

## P2: operations and scale

### 20. Add observability

- Structured application logs with request and order correlation IDs.
- Central error tracking for API, web, and mobile apps.
- Metrics for latency, error rate, database connections, queue depth, OTP delivery, payment callbacks, push failures, and order-state duration.
- Alerts for API/tunnel failure, stale orders, payment mismatch, low disk, failed backups, and database capacity.

### 21. Move periodic work to durable jobs

**Current state:** merchant-acceptance timeout processing uses an in-process interval. It is not a durable queue and may run more than once if the API is horizontally scaled.

**Work required:** use a durable job/queue or database-backed scheduler with locking, retries, dead-letter handling, and monitoring.

### 22. Add data retention and privacy operations

- Define retention for OTPs, refresh tokens, rider locations, audit records, support attachments, and deleted accounts.
- Add privacy export and verified deletion procedures.
- Clarify financial-record retention when a customer requests account deletion.
- Add staff access policies for customer addresses and rider locations.

### 23. Establish production release management

- Separate development, staging, and production environments.
- Add deployment approval and rollback procedures.
- Add mobile build/signing/store-release checklists.
- Version the API contract and coordinate backward compatibility with installed mobile apps.
- Add feature flags for payment, OTP, and operational rollouts.

## P2: product enhancements

### 24. Mature the POS

The current POS is a useful cash-sale MVP. Common retail requirements still absent include barcode scanning, returns/voids, line and basket discounts, suspended carts, cashier shifts, cash drawer reconciliation, customer receipts by SMS/email, tax handling, offline operation, hardware integration, and manager approvals.

### 25. Merchant promotions

The permission vocabulary contains `PROMOTIONS`, but there is no merchant promotion-management workflow. Decide whether promotions remain admin-only coupons or whether merchants can fund and target their own campaigns.

### 26. Reporting and exports

Add CSV/PDF exports, tax/commission statements, settlement reconciliation, product performance, stock movement history, rider performance, cohort retention, and finance-grade reporting.

### 27. Inventory operations

Add stock adjustment history, purchase/restock records, damaged/expired stock, low-stock alerts, barcode/SKU workflows, and audit attribution for every inventory change.

### 28. Delivery operations

Potential next steps include route optimization, delivery batching, failed-delivery reason workflows, proof-of-delivery photo handling, rider capacity, zones, service-level reporting, and dispatch override tools.

## Documentation corrections needed

- `README.md` and `docs/users-and-apps.md` omit the merchant web portal and POS application.
- `docs/users-and-apps.md` says there are six applications, while the repository contains eight components when the API and seven clients are counted.
- `docs/architecture.md` still mentions SQLite development in its diagram, while the Prisma schema and README specify PostgreSQL everywhere.
- Realtime documentation implies clients receive pushed order tracking, while current clients poll and do not connect to Socket.IO.
- Deployment claims should be reconciled with the actual production process supervision and tunnel startup configuration.

## Recommended delivery sequence

### Phase 1: controlled COD launch

1. Real OTP, credential rotation, rate limiting, and upload hardening.
2. Always-on API/database/tunnel, health monitoring, and tested backups.
3. Database migration baseline.
4. Refresh-token role fix and access-control regression tests.
5. Restricted-product blocking until compliance is ready.
6. Expand CI and add critical Playwright/order-state tests.

### Phase 2: operational completeness

1. Realtime client integration with polling fallback.
2. Notification centers and complete support conversations.
3. Merchant staff, document verification, and bulk catalog workflows.
4. Inventory history and stronger merchant/admin reporting.
5. Mobile replacement handling and release validation.

### Phase 3: digital payments and scale

1. Provider-backed JazzCash/EasyPaisa/card payments and webhooks.
2. Wallet ledger and wallet checkout.
3. Durable background jobs, reconciliation, and observability.
4. Managed infrastructure/object storage as traffic grows.
5. Advanced POS, loyalty, promotions, and delivery optimization.

## Suggested definition of production-ready

SirfBazar should be considered ready for a public paid launch when:

- No production authentication path accepts demo credentials or master OTPs.
- COD works reliably under monitored, backed-up infrastructure.
- Every role and tenant boundary has automated negative tests.
- Restricted pharmacy products cannot bypass required controls.
- The API, database, and tunnel recover automatically after reboot or failure.
- All shipped applications build in CI.
- Critical customer, merchant, rider, admin, and POS journeys have end-to-end tests.
- Payment methods shown to users are genuinely integrated or clearly disabled.
- Support, refund, settlement, and incident-response procedures are documented and exercised.
