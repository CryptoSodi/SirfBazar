# Merchant desktop API contracts — Phases 0–4

Inspected 2026-09-29 against `apps/api` controllers, DTOs, services and guards in this checkout. The owner-supplied startup log confirms route registration, but an authenticated deployed response was not available. Production uses `VITE_API_URL=https://api.sirfbazar.com/api`; local development now uses `VITE_API_URL=http://localhost:3001/api` from `apps/shop/.env.local`. Client paths below exclude `/api`.

| Operation | Verified request and authorization | Source response / behavior | UI status |
| --- | --- | --- | --- |
| Identity | `GET /auth/me`, bearer token | User with linked `merchant` or active `staffOf`; base `User.role` is **not** the selected merchant token role. Client also checks the access-token role is `MERCHANT_OWNER` or `MERCHANT_STAFF`; server remains authoritative. | Connected in shell |
| Refresh | `POST /auth/refresh-token` `{refreshToken}` | Rotated `{accessToken,refreshToken,user}`; merchant capability rechecked | Connected; GET replay once only |
| Logout | `POST /auth/logout` `{refreshToken}` | `{loggedOut:true}`; local session cleared even if request fails | Connected |
| Merchant context | `GET /merchant/profile`, owner or active staff | Merchant record plus `isOwner`, `permissions`; authoritative shop and permissions | Connected in shell/overview/orders |
| Overview | `GET /merchant/dashboard`, merchant context | Numeric `todayOrders`, `pendingOrders`, `preparingOrders` (accepted + preparing), `readyOrders`, `activeDeliveries`, `lowStockProducts`; booleans `isOnline`, `isOpen`; `approvalStatus`; money in paisa | Connected, contract-checked |
| Online orders | `GET /merchant/orders?status=...&page=1&pageSize=20`, `ORDERS` | Explicit page parameters return `{items,total,page,pageSize,totalPages}` (maximum page size 100), newest first with stable ID tie-break; `channel=ONLINE`. Without page parameters the legacy newest-100 array is preserved for existing consumers. | Connected in Orders; local typecheck and mocked contract test passed |
| Order detail | `GET /merchant/orders/:id`, `ORDERS`, shop-owned ID | Order with items, timeline, address, customer and rider | Connected, contract-checked |
| Accept | `POST /merchant/orders/:id/accept`, `ORDERS`, no body | `SENT_TO_MERCHANT → MERCHANT_ACCEPTED`, `{ok:true,status}` | Handler connected; no live mutation test |
| Reject | `POST /merchant/orders/:id/reject` `{reason: nonempty string}`, `ORDERS` | `SENT_TO_MERCHANT → MERCHANT_REJECTED`; stock restore/refund side effects | Handler connected; no live mutation test |
| Preparing | `POST /merchant/orders/:id/preparing`, `ORDERS`, no body | `MERCHANT_ACCEPTED → PREPARING` | Handler connected; no live mutation test |
| Ready | `POST /merchant/orders/:id/ready`, `ORDERS`, no body | `MERCHANT_ACCEPTED` or `PREPARING → READY_FOR_PICKUP` | Handler connected; no live mutation test |
| Own riders | `GET /merchant/riders`, `RIDERS` | Array scoped by `merchantId`, ascending creation order | Connected, contract-checked |
| Rider detail | `GET /merchant/riders/:id`, `RIDERS`, shop-owned ID | Rider record with approval, activation and online states | Connected, contract-checked |
| Rider orders | `GET /merchant/riders/:id/orders`, `RIDERS` | Array of latest 100 assigned orders with order number, status and paisa total | Connected, contract-checked |
| Assign rider | `POST /merchant/orders/:id/assign-rider` `{riderId: nonempty string}`, `ORDERS` + `RIDERS` | Only `READY_FOR_PICKUP`; rider must be same-merchant, active, approved; result `{ok:true,status:'RIDER_ASSIGNED',rider}`. Backend does **not** require online/idle. | Confirm-before-submit handler connected; re-fetches persisted order; no live mutation test |

The browser checks response shape before treating a read as empty, never loads fixture data after an error, and does not automatically replay writes after a 401. A timeout after a write is considered an uncertain outcome; the record is re-fetched before the UI permits retry. Server ownership checks remain authoritative; UI permissions only guide display.

## 2026-10-07 iPOS integration

`/ipos` uses the existing merchant session. `GET /pos/capabilities` must return
version 2, `idempotentSales: true`, `barcodeLookup: true`, and the same merchant ID
as `GET /merchant/profile`. Owners have access; staff require `POS`. Products use
`GET /pos/products`, exact scans use `GET /pos/products/lookup?code=...`, and bill
refresh uses `POST /pos/products/review`. Cash completion uses `POST /pos/sales`
with a stable request UUID and expected unit prices. Unknown outcomes retain the
same request for recovery; saved receipts use `GET /pos/sales/:id`. The matching
POS controller/service are already present in upstream `master`; the public live
capability route was confirmed registered by its 401 response on 2026-10-07.
An authenticated live capability payload and physical payment/printing were not
tested during this frontend integration.

Successful cash sales also invalidate the current merchant catalogue, listing and
dashboard memory caches and emit the existing `sb:products` refresh event.

## 2026-10-01 pagination and cache update

- `GET /merchant/products?page=...&pageSize=...&q=...` remains a paged object. It now accepts `isAvailable=true|false` and `minStock=<non-negative integer>` in addition to existing `lowStock=true`. `My shop listings` uses 24/page; the order replacement picker uses in-stock available listings at 20/page with server-side search. Both are validated by `readListingsPage`.
- The overview uses `GET /merchant/orders?page=1&pageSize=5&attention=true` and `GET /merchant/products?page=1&pageSize=3&lowStock=true` for its small previews, rather than drawing those previews from the first 100 unfiltered records. `attention=true` covers `SENT_TO_MERCHANT`, `MERCHANT_ACCEPTED`, `PREPARING`, and `READY_FOR_PICKUP`.
- Successful merchant writes invalidate the affected session-memory keys. The same invalidation runs on realtime `sb:orders`, `sb:products`, and `sb:riders` events. The frontend still re-fetches to confirm uncertain order mutations; no mutation is automatically replayed.
- The new order and listing page shapes have explicit TypeScript types and runtime readers, applied at the shared client's `getParsed` boundary. Nest Swagger now documents the new query parameters, but still omits response schemas for these operations, so full generated OpenAPI response types are not yet available; do not treat the published Swagger document as a complete typed response contract.

The role-preserving refresh behavior was inspected in the local backend checkout; the deployed build/commit has not been confirmed. If a live merchant session refresh behaves differently, compare deployment version before changing the browser contract.

Not covered by this milestone: item-unavailable, rider CRUD validation, finance, inventory, POS, rider-side delivery steps, and remaining platform routes. Existing merchant modules were left in place.
