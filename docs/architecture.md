# SirfBazar — architecture

## System overview

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐ ┌─────────────┐ ┌────────────┐
│ Customer Web │  │ Customer App │  │ Merchant App │ │  Rider App  │ │ Admin Dash │
│  (Next.js)   │  │    (Expo)    │  │    (Expo)    │ │   (Expo)    │ │ (Vite/React)│
└──────┬──────┘  └──────┬──────┘  └──────┬───────┘ └──────┬──────┘ └─────┬──────┘
       └────────────────┴────────┬───────┴─────────────────┴──────────────┘
                                 │  HTTPS (REST, /api) + Socket.IO (realtime)
                        ┌────────▼────────┐
                        │  SirfBazar API  │  NestJS
                        │  (apps/api)     │
                        └────────┬────────┘
                                 │ Prisma
                        ┌────────▼────────┐
                        │ SQLite (dev) /  │
                        │ PostgreSQL prod │
                        └─────────────────┘
```

One backend serves all five clients. Role-based JWT auth separates customer, merchant owner/staff, rider, and admin capabilities; multi-tenancy rules are enforced in services (never trust the client).

## Backend modules (apps/api/src)

| Module | Responsibility |
|---|---|
| `auth` | OTP login (provider-agnostic `IOtpService`: mock/external), Google login (`IGoogleAuthService`: mock/tokeninfo), admin email+password, JWT access (15 min) + rotating refresh tokens (hashed at rest) |
| `guest` | Anonymous sessions (`x-guest-session`), guest cart, merge-after-login |
| `cart` | Shared cart engine (guest + customer), live price/stock validation, fee breakdown, coupons |
| `catalog` | Categories, product search/nearby/popular/recommended, merchant discovery, location detect/fallback |
| `customers` | Profile, addresses, account deletion |
| `orders` | Placement (single + multi-merchant parent/child), status machine + timeline, replacements, cancellation, rating, merchant accept→ready→assign-rider flow, acceptance-timeout sweeper |
| `rider` | Rider presence, location pings (persisted + broadcast), pickup→deliver flow with customer OTP |
| `payments` | COD + mock online gateway (initiate/confirm/fail) shaped like JazzCash/EasyPaisa integration points |
| `coupons` | Validation engine (type/limits/eligibility) + public listing + admin CRUD |
| `refunds` | Auto-refunds to wallet on rejection/cancellation, manual refund workflow |
| `settlements` | Period settlement generation from delivered orders (earnings − refunds), payout marking |
| `merchant` | Onboarding (role upgrade + re-issued tokens), shop profile, product/inventory mgmt incl. bulk upload, rider + staff management, dashboard, earnings |
| `admin` | Marketplace operations: approvals, overrides, analytics, audit-log browsing |
| `support` | Tickets + threaded messages across customer/merchant/rider/admin |
| `notifications` | In-app persistence + websocket push (FCM/SMS/email plug in here) |
| `realtime` | Socket.IO gateway; rooms `user:*`, `order:*`, `merchant:*`, `rider:*`, `admin` with membership checks |
| `audit` | Append-only audit log for admin/financial actions |

## Key design decisions

- **Money = integer paisa.** No floats anywhere in money paths; display conversion is a client concern.
- **Status strings, not DB enums.** Keeps the schema portable between SQLite (dev) and PostgreSQL (prod); the single source of truth is `src/common/constants.ts`.
- **One write path for order status.** `OrderStatusService.apply()` updates the row, appends the timeline entry, broadcasts realtime events, and rolls terminal child states up to the parent order. Nothing else mutates `order.status`.
- **Inventory is reserved at placement** (atomic conditional decrement, rolls the transaction back on a race) and **restored** on rejection, cancellation, payment failure, or acceptance timeout.
- **Multi-merchant checkout** creates a parent order (payment anchor, customer-facing totals) plus one child order per merchant (commission, earnings, rider, timeline each). Single-merchant carts skip the parent.
- **Merchant-managed delivery**: `assignRider` verifies `rider.merchantId === order.merchantId`; rider queries are always scoped by `riderId`; the rider never sees the delivery OTP (the customer reads it to them).
- **Commission** is computed per child order at placement (percentage or fixed per merchant) and frozen on the order row, so later rate changes never rewrite history. Settlements aggregate `merchantEarningPaisa − completed refunds` over a period and stamp `settlementId` on the orders they cover.
- **Auto-timeout sweeper**: orders unaccepted after `MERCHANT_ACCEPT_TIMEOUT_MINUTES` are auto-rejected, stock restored, prepaid amounts refunded to wallet.

## Realtime events

| Event | Room(s) | Payload |
|---|---|---|
| `order:update` | order, merchant, rider, user, admin | `{orderId, parentOrderId, orderNumber, status, at}` |
| `order:new` | merchant | `{orderId, orderNumber}` |
| `rider:location` | order, merchant, admin | `{riderId, orderId, latitude, longitude, heading, at}` |
| `delivery:assigned` | rider | `{orderId, orderNumber}` |
| `notification` | user | full notification row |
| `support:new` | admin | `{ticketId, orderId}` |

## Security model

- Global `JwtAuthGuard` (with `@Public()` escape hatch for guest browsing) + `RolesGuard`.
- Tenancy enforced in `AccessService`: merchant context (owner/staff + granular staff permissions), customer/rider resolution.
- OTPs: hashed at rest, TTL + attempt caps + resend cooldown, never logged in production (mock provider logs in dev only).
- Refresh tokens: random 256-bit, SHA-256 hashed at rest, rotated on every refresh, revocable.
- Audit log on admin/financial mutations; delivery OTP redacted from rider and from customer until pickup.

## Production path

- Prisma datasource → PostgreSQL; add read indexes already declared in the schema.
- Redis for Socket.IO adapter + hot caches (categories, popular products) when scaling horizontally.
- S3-compatible storage for shop/product/document images (URLs are already first-class fields).
- FCM/SMS/email providers behind `NotificationsService`; real OTP provider behind `IOtpService` (`OTP_PROVIDER=external`).
- Payment gateways: server-to-server callbacks hit the existing `payments.confirm` path.
