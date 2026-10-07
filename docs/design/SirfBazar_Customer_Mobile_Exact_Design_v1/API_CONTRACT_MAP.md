# Customer native app: API contract and integration map

**Prepared 6 October 2026.** Native target `apps/customer-app`; server `apps/api`. Current public base supplied by owner:

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

Paths below are relative to that base. Do not repeat `/api`, use VITE_API_URL/NEXT_PUBLIC_API_URL in native code, use GroceryServer paths or create a second backend.

## Evidence limits

[E1] The owner's 233-line startup log registers these routes; it is not a set of response schemas or successful public requests. [E2] The included customer website baseline map records earlier controller/service reads. [N1–N5, B1–B2] This turn re-read selected native sources and guest/merge code. See `SOURCE_MANIFEST.json` for paths, blob hashes and limits. No live endpoint was called for this design.

Read current DTOs, services and response envelopes before binding each operation. Do not infer every query accepted by a DTO is implemented by every service. Do not call an endpoint simply to see whether it exists: even a cart GET may create an active cart internally.

## Transport and authentication

| Operation | Method/path | Request and boundary |
|---|---|---|
| Guest session | POST `/guest/session` | Optional deviceId/latitude/longitude/city/area; returns sessionToken/expiresAt. Create lazily, deduplicate concurrent creation; validate response before storing. |
| Guest location | PUT `/guest/session/location` | `x-guest-session` header; only confirmed selected/permission-based coordinates. |
| Sign-in code | POST `/auth/send-otp` | Actual phoneNumber and supported purpose. No log/dev bypass values. |
| Verify | POST `/auth/verify-otp` | phoneNumber, code, supported optional fullName/context. Resolve customer context, not merchant/rider. |
| Google | POST `/auth/google-login` | Native Google idToken, verified customer context. Cancellation is not a reason to mock a token. |
| Session | GET `/auth/me`; POST `/auth/refresh-token`; POST `/auth/logout` | Preserve established token/refresh contract; inspect exact body/envelope. |
| Merge | POST `/guest/cart/merge-after-login` | **Both** valid customer auth and x-guest-session; no bespoke merge body in inspected controller. |

Public shopping reads must remain available when a previous private token is stale. Native `lib/api.ts` currently attaches access tokens broadly; separate public transport behavior carefully, not by deleting working private session logic. No public/private caches keyed only by a product route when the response is personalized.

Keep credentials out of public Expo variables, logs, screenshot metadata and source commits. Existing AsyncStorage use is a code fact, not a security recommendation; storage-policy migration is separately scoped. Never use a boolean member flag as production authorization.

## Discovery and locations

| UI | Method/path | Contract detail |
|---|---|---|
| Categories | GET `/products/categories` | Optional latitude/longitude; category tree. |
| Search | GET `/products/search` | Supported q/category/coordinates/radius/price/brand/sort/paging; inspect actual service. |
| Nearby | GET `/products/nearby` or `/guest/location-products` | Use returned merchant offers; location influences reachable listings. |
| Popular/recommended | GET `/products/popular`, `/products/recommended` | Recommended is not automatically personalized for anonymous visitors. |
| Global catalogue | GET `/products/catalog` | No seller price, stock or merchantProductId in baseline; use Check availability. |
| Product offers | GET `/products/:productId` | Global ID for detail; offers supply merchantProductId. |
| Shop discovery | GET `/merchants/nearby` | Optional coords/shopType/category/radius/paging. No coordinates means no confirmed proximity. |
| Shop | GET `/merchants/:merchantId` | Public identity, state, contact, opening/closing and estimates as returned. |
| Shop products/reviews | GET `/merchants/:merchantId/products`, `/merchants/:merchantId/reviews` | Listing shape differs from global product cards; inspect review envelope. |
| Locality | POST `/location/detect` | Baseline uses nearest merchant locality or a fallback city, not an external IP geocoder. |
| Service area | GET `/location/service-availability` | Required coordinates; coverage is not proof every cart group can order now. |
| Area names | GET `/location/nearby-areas` | Optional city; names are not precise coordinates. |

Merchant cards do not provide a verified delivery fee in the baseline. Show fees from the cart. Restricted/prescription attributes need an approved policy; don't bypass them through general Add actions.

## Guest and authenticated baskets

| Action | Guest path | Customer path | Semantics |
|---|---|---|---|
| Read quote | GET `/guest/cart` | GET `/cart` | Supply confirmed destination latitude/longitude. |
| Add | POST `/guest/cart/items` | POST `/cart/items` | `{merchantProductId, quantity}`; incremental quantity. |
| Set quantity | PUT `/guest/cart/items/:cartItemId` | PUT `/cart/items/:cartItemId` | `{quantity}`; replacement total; zero removes. |
| Remove | DELETE `/guest/cart/items/:cartItemId` | DELETE `/cart/items/:cartItemId` | Cart-line ID, not global product ID. |
| Coupon | POST `/guest/cart/apply-coupon` | POST `/cart/apply-coupon` | `{code}`; server validation/couponError. |
| Remove coupon | No guest route established | DELETE `/cart/remove-coupon` | Do not invent symmetric guest route. |
| Clear | No guest route established | DELETE `/cart/clear` | Guest removals are per-line unless current source adds support. |

Guest calls use `x-guest-session`. Authenticated basket calls use customer authority. The response groups merchants with line IDs, merchantProductId, productId, unit/size, quantity, current unit/line price, priceChanged, inStock and stockQuantity. Top-level itemCount, subtotalPaisa, deliveryFeePaisa, serviceFeePaisa, smallOrderFeePaisa, discountPaisa and totalPaisa must retain their actual meaning.

Add/update/merge may return an **unlocated** quote. Refetch GET cart with the selected delivery address coordinates before the final location-dependent total. Do not use the app's saved browse location when checkout has selected another saved address.

Backend merge sums existing plus guest quantities, copies a guest coupon and marks the guest cart MERGED. Current inspected loop is not one shared transaction. Concurrent/ambiguous retries can duplicate quantities. UI recovery must retain evidence, reconcile confirmed state and report a required backend guarantee rather than claim idempotency from a disabled button. Current native afterLogin ignores merge failures; correct its result handling. [N3, B2]

## Customer address and order operations

| Action | Method/path | Contract |
|---|---|---|
| Profile | GET/PUT `/customer/profile` | Supported fullName/email/profileImageUrl; verify current DTO. |
| Addresses | GET/POST `/customer/addresses` | Write requires auth; fullAddress/city required in baseline, supported optional coordinates/contact/label/street/area/province/instructions/default. |
| Edit/remove | PUT/DELETE `/customer/addresses/:id` | Customer-owned ID; verify effects on referenced order addresses. |
| Set default | PUT `/customer/addresses/:id/default` | Existing selected checkout address must not be silently replaced. |
| Place | POST `/orders` | `{deliveryAddressId, paymentMethod, customerNote?, couponCode?}`. Server uses active customer cart. |
| List | GET `/orders?status=` | Baseline top50 parent/standalone records; do not invent paging/lifetime totals. |
| Detail | GET `/orders/:id` | Owned record, returned children/items/snapshots/timeline/payment/contacts. |
| Track | GET `/orders/:id/track` | Parent-aware deliveries, each child status/rider/last-known location/timeline/code when authorized. |
| Cancel | POST `/orders/:id/cancel` | `{reason?}`; baseline only before acceptance and all parent targets must qualify. |
| Rate | POST `/orders/:id/rate` | Verify eligible state/DTO; do not treat local stars as saved review. |
| Replacement decision | POST `/orders/:id/items/:itemId/replacement` | `{accept:boolean}`; use actual child/order/item identities. |
| Order help | POST `/orders/:id/support-ticket` | Verify DTO/role; distinguish from a normal order action. |
| Delete account | DELETE `/customer/account` | Destructive; actual policy/retention and active-order restrictions must be verified. |

The customer address can be drafted locally before auth, but saved only afterwards. The prototype `address.name` maps to contactName, not an invented API property. Draft storage is not a second customer database.

Placement uses the current backend prices, stock and merchant open/online/approval conditions. A design total is not price-lock evidence. No order idempotency or quote-version contract was established by the baseline. A timed-out placement must not be blindly replayed; find the real saved order where possible and escalate ambiguity. A parent total is not necessarily the sum of child rider-collection amounts because shared fees/discounts may be held at parent level.

COD returns SENT_TO_MERCHANT / CASH_PENDING in baseline, not accepted or paid. Online returns PAYMENT_PENDING before real provider confirmation. One shopping checkout may produce multiple distinct shop deliveries.

## Payments: production gate

| Existing route | Safe use boundary |
|---|---|
| GET `/payments/order/:orderId` | Read owned payment state for the proper parent or standalone anchor. |
| POST `/payments/order/:orderId/initiate` | Baseline gateway is mock; inspect current response/provider before offering it. |
| POST `/payments/:id/confirm` | Do **not** invoke automatically from normal native checkout to simulate money received. |
| POST `/payments/:id/fail` | Has state/stock effects; not a diagnostic toggle. |

The inspected `apps/customer-app/screens/CheckoutScreen.tsx` calls initiate and then confirm when PAYMENT_PENDING. The complete Codex task must remove this development shortcut from normal operation and preserve or implement only verified provider return/status handling. This is a native change, not authorization to modify production payments. If no real provider is configured, the design keeps online payment unavailable and documents the gap. [N4, E2]

## Support, notifications and device integration

Read/write own `/support/tickets`, `/support/tickets/:id` and `/support/tickets/:id/messages` using current role and DTO. Previous controller fields include orderId optional, issueCategory, title, description; messages use `{message}`. No new merchant/rider chat API is inferred.

Registered notifications endpoints cover own list, read/read-all and push-token registration/removal. Opening a real notifications sheet or marking read may mutate state; use actual handler permissions and test authorization. Optional `/uploads/image` needs its actual field/size/format and returned URL verified. A browser local preview URL is not a persisted native image.

The customer map uses genuine native permissions/current coordinates or confirmed manual pins. No background customer-location tracking is part of this task. Customer tracking of an assigned rider is an authorized read, not permission to call rider-location writes. Use current gateway transport and auth only after inspection; the log's join messages alone do not define socket payloads or outgoing events.

## Integration status per operation

Record: **registered → source/DTO inspected → native handler wired → actual authenticated read tested → approved test mutation and relaunch verified → device behavior tested**. Do not call every endpoint to check health. Live tests need designated accounts/records and explicit scope; this design performed none.

## Source references

Read [SOURCES.md](SOURCES.md) and `SOURCE_MANIFEST.json` for N/B/E/W identifiers, actual file hashes, inspected ranges and evidence boundaries. Design decisions are identified as such; no runtime deployment test is implied.
