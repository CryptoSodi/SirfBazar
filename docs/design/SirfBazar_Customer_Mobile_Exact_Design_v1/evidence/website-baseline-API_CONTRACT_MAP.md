# SirfBazar customer website — API contract map

**Version 1 · 29 September 2026**  
**Target:** existing `SirfBazar/apps/web` → existing `SirfBazar/apps/api`  
**Evidence:** source inspected through the connected GitHub tool; registered routes in the owner's startup log. **Not an authenticated deployment test.** The browser design uses local fictional data.

```dotenv
NEXT_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

Use the existing Next.js configuration. Client paths below omit the `/api` already present in the base. Do not use the merchant Vite environment-variable name here, change the backend or revive the GroceryServer mapping. The package manifest inspected is a source snapshot, not a mandate to upgrade or reinstall packages. [C16]

## 1. Identity and transport

Public catalogue discovery must not require an account, an OTP, a guest-session write or an onboarding modal. The existing web API client deliberately omits a stale bearer token on most public discovery reads. Preserve anonymous browsing even when private session renewal fails. [C11]

Guest basket calls use `x-guest-session: <sessionToken>`. Customer calls use the existing customer bearer/session contract. The merge call requires both. Credentials are never fixture values, query-string tokens, analytics properties or committed environment variables. Browser-public `NEXT_PUBLIC_*` values must not hold secrets.

| Operation | Method and relative path | Source-supported contract |
|---|---|---|
| Start guest session lazily | `POST /guest/session` | Optional `deviceId`, `latitude`, `longitude`, `city`, `area`. Returns `{sessionToken, expiresAt}`. The inspected service sets a 30-day expiry; validate deployed behavior. |
| Update guest location | `PUT /guest/session/location` | Guest header plus supported location body; result `{ok:true}`. |
| Phone verification request | `POST /auth/send-otp` | Existing customer LoginSheet sends `{phoneNumber}`. Inspect current auth DTO/provider for purpose, exact format, TTL and resend limits before implementation. |
| Verify phone | `POST /auth/verify-otp` | Existing customer LoginSheet sends `{phoneNumber, code, fullName?}`. Use the current customer context/role contract, not a merchant/admin token. |
| Google return | `POST /auth/google-login` | Existing customer client submits `{idToken}`. Use a genuine Google credential and verified customer context. No `mock:` fallback in production. |
| Restore customer | `GET /auth/me` | Registered route; confirm actual deployed identity/session envelope. |
| Refresh / logout | `POST /auth/refresh-token`, `POST /auth/logout` | Preserve the established session contract. Do not infer token/cookie policy from names. |
| Merge at checkout | `POST /guest/cart/merge-after-login` | Customer authentication **and** guest header; no custom merge body in inspected controller. Returns customer cart view. |

Guest controller [C5], LoginSheet [C10], web API client [C11]; authentication route existence [S1]. Source verification of a UI call is not independent verification of a production identity provider.

## 2. Discovery and selection

| View | Method/path | Query/response considerations |
|---|---|---|
| Categories | `GET /products/categories` | Optional latitude/longitude. Returns category tree `{id,name,slug,iconUrl,sortOrder,children}`. Location prunes to categories with nearby sellable listings; no coordinates returns active categories. |
| Global catalogue | `GET /products/catalog` | Source implements `q`, `categoryId`, page/pageSize. **No price, stock, seller or merchant listing ID** in the returned items. Show “Find a shop”/“Check availability”, not invented prices or Add. Do not assume every SearchProductsQuery field is implemented by this service. |
| Search purchasable offers | `GET /products/search` | DTO supports q, categoryId, coords, radiusKm, minPricePaisa, maxPricePaisa, brand, sort, page/pageSize. Supported sort vocabulary: relevance, price_asc, price_desc, rating, distance. Recheck the current service for actual sorting semantics. |
| Nearby products | `GET /products/nearby` | Location/category/pagination; `GET /guest/location-products` calls the same service. |
| Popular / recommended | `GET /products/popular`, `GET /products/recommended` | Optional coordinates. Recommended can use a valid customer identity; guest recommendations must not claim individualized history. |
| Product + offers | `GET /products/:productId` | Public detail and seller offers. The detail ID is the global product ID; the selected seller's `merchantProductId` is used to add. |
| Shops | `GET /merchants/nearby` | Optional location, radiusKm, shopType, categoryId, pagination. With no location, approved merchants are returned without distances; do not claim “near you.” |
| Shop detail | `GET /merchants/:merchantId` | Optional location. Includes shop flags, opening/closing times, address and public phone. An estimate is not a delivery guarantee. |
| Shop products | `GET /merchants/:merchantId/products` | q/categoryId/page/pageSize. Nested product and listing fields, not the same object shape as global search. |
| Shop reviews | `GET /merchants/:merchantId/reviews` | Registered and controller-inspected; page/pageSize. Inspect review service/envelope before implementing the review list. |

Sources [C1–C3]. Shop/product results must disclose the fulfilling merchant. Do not silently change the seller of an existing basket line because a new offer is cheaper.

### Key response shapes

`ProductCard` from the public location-aware product service:

```text
productId, merchantProductId, name, slug, brand, imageUrl,
unit, size, categoryId, pricePaisa, discountPricePaisa,
merchant { id, shopName, ratingAverage, distanceKm,
           estimatedDeliveryMinutes }, stockQuantity, isAvailable
```

Global catalogue item:

```text
productId, name, slug, brand, imageUrl, unit, size,
categoryId, category { id, name }
```

Shop product item:

```text
merchantProductId,
product { id, name, imageUrl, unit, size, brand, categoryId },
pricePaisa, discountPricePaisa, stockQuantity, isAvailable
```

Product detail:

```text
id, name, slug, brand, description, categoryId, category, imageUrl,
unit, size, barcode, isRestricted, requiresPrescription,
offers [ { merchantProductId, merchant, pricePaisa,
           discountPricePaisa, stockQuantity, isAvailable } ], similar
```

Merchant cards **do not return a delivery fee** in the inspected implementation. Use “Fee in basket”, not an invented number. Real delivery fees are returned by the priced basket. Availability of a product offer is not by itself proof that every shop flag and destination passes order-placement rules. Restricted/prescription product fields need their own approved handling; this grocery design does not implement that compliance workflow. [C2]

## 3. Location

| Operation | Contract |
|---|---|
| `POST /location/detect` | Optional latitude/longitude/ip DTO. Current service uses nearest approved shop's city/area as locality; without coordinates it returns the city with most approved shops, null coordinates and `serviceable:false`. **Not an IP geocoder or proof of the visitor's location.** |
| `GET /location/service-availability` | Required latitude/longitude; result `{serviceable, merchantsInRange}` counts approved shops within each radius. Does not establish that every shop is currently open/online or every basket item is deliverable. |
| `GET /location/nearby-areas` | Optional city; returns city/area names, not exact coordinates or saved customer addresses. |

Sources [C1, C3, C15]. Use existing browser/map integrations for actual permission-based positioning and confirmed coordinates. Keep manual browsing available. Schematic maps in the preview are explicitly non-live. Do not treat an area name or a clicked mock pin as a geocoded delivery address.

## 4. Guest/customer basket operations

| Action | Guest | Signed-in customer | Body/semantics |
|---|---|---|---|
| Read quote | `GET /guest/cart` | `GET /cart` | Pass confirmed latitude/longitude for priced location-aware review. |
| Add | `POST /guest/cart/items` | `POST /cart/items` | `{merchantProductId, quantity}`; quantity is an **increment**; integer ≥1. |
| Set quantity | `PUT /guest/cart/items/:cartItemId` | `PUT /cart/items/:cartItemId` | `{quantity}`; **replacement** total, integer ≥0; zero deletes in this service. |
| Remove line | `DELETE /guest/cart/items/:cartItemId` | `DELETE /cart/items/:cartItemId` | No guessed productId in place of a cart item ID. |
| Apply coupon | `POST /guest/cart/apply-coupon` | `POST /cart/apply-coupon` | `{code}`; actual validation result and couponError must be displayed. |
| Remove coupon | **No guest route registered** | `DELETE /cart/remove-coupon` | Do not invent a guest remove endpoint or use customer authority anonymously. |
| Clear basket | **No guest clear route registered** | `DELETE /cart/clear` | Guest line removal is separate; do not assume route symmetry. |

Sources [C4, C5, C13, C14]. `GET cart` calls get-or-create internally, so it can create an active cart: it is not a harmless route to sweep against random production identities.

### Priced cart response

```text
{
  id, couponCode, couponError, itemCount,
  subtotalPaisa, deliveryFeePaisa, serviceFeePaisa,
  smallOrderFeePaisa, discountPaisa, totalPaisa,
  groups: [{
    merchant: {id, shopName, logoUrl, city, minimumOrderValuePaisa,
               isOnline, isOpen},
    distanceKm, subtotalPaisa, deliveryFeePaisa,
    items: [{id, merchantProductId, productId, name, imageUrl, unit,
             size, quantity, unitPricePaisa, totalPaisa,
             priceChanged, inStock, stockQuantity}]
  }]
}
```

Use current integer paisa values. Do not sum every child's eventual order total and call it the parent total. Show separate shop delivery charges and global service/small-order/discount rows. Unknown/null money is not automatically zero. `itemCount` sums quantities, not the number of different lines. The illustration's rupee amounts/fees are fixtures, not approved commercial terms.

Mutation responses in the inspected service call `view(owner)` without the location argument. Merge also returns a view without location. Refetch the cart with the actual delivery coordinates before presenting final location-dependent fees. A locally cached estimate must not become a promised price.

## 5. Late authentication and safe merge

```text
Anonymous catalogue → selected merchant listing → guest basket
→ guest checkout address draft → Continue to sign in
→ phone OTP OR Google → authenticated customer identity
→ merge guest cart → refetch priced customer cart with address coordinates
→ show changes or saved-account items → explicit Place order
```

The address draft is a proposed frontend improvement. Customer-address endpoints require authentication, so keep the draft locally in the current UI session, then save through the existing contract after successful identity resolution. Do not issue unauthorized address writes before login.

**Never auto-place an order immediately after OTP/Google.** This gives the customer a chance to inspect merged quantities, an existing account basket, current fees and stock changes. When already signed in, skip identity entry but still revalidate/review.

The source merge adds guest quantities to existing quantities, copies guest coupon when present and marks the guest cart MERGED. It does not visibly wrap the full loop in one transaction, and merged totals can exceed current stock. A partial failure can leave some lines already added. [C4]

The current web `afterLogin()` catches and ignores all merge errors. That is not an acceptable production signal that the basket is safely merged. [C11]

Required integration behavior:

- Preserve checkout draft and the guest-basket snapshot while establishing real customer state.
- Prevent concurrent merge calls, including duplicate effect execution or multiple tabs where possible.
- Read/compare confirmed server state after uncertain errors; do not blindly retry an additive merge.
- Do not discard the guest token or snapshot before a confirmed result/reconciliation.
- Display meaningful stock/price/quantity changes and require review rather than silent clamping.
- A UI cannot guarantee exactly-once reconciliation when the backend merge is not transactionally/idempotently defined. Record any necessary backend change for separate authorization.
- Failed Google/OTP returns to the same basket; dismissing the sheet does not remove items.

The reference's “Check basket again” is a visual recovery example—not proof that current APIs already expose a complete merge-reconciliation operation.

## 6. Addresses and final placement

| Operation | Path/body |
|---|---|
| Customer profile | `GET /customer/profile`; `PUT /customer/profile` accepts supported fullName/email/profileImageUrl fields. |
| Saved addresses | `GET /customer/addresses` |
| Save draft | `POST /customer/addresses` with `fullAddress`, `city` required; optional `label, street, area, province, latitude, longitude, contactName, contactPhone, instructions, isDefault`. |
| Edit address | `PUT /customer/addresses/:id` with supported fields. |
| Default / remove | `PUT /customer/addresses/:id/default`, `DELETE /customer/addresses/:id`; verify deletion effects in service before exposing destructive behavior. |
| Place order | `POST /orders` with `{deliveryAddressId, paymentMethod, customerNote?, couponCode?}`. |

Sources [C6, C7, C9, C12]. Placement reads the backend's active cart; it does not accept browser-supplied product lines, merchant IDs, commission or a total. Revalidates stock, merchant approval/open/online, delivery radius where coordinates exist, minimum per merchant and current prices. It uses a transaction for conditional stock decrement and order creation in the inspected source.

### Result and payment split

COD creates the order(s) in `SENT_TO_MERCHANT` with `CASH_PENDING`. It does **not** mean accepted, dispatched, delivered, cash received or paid. Online payment creates `PAYMENT_PENDING` and must complete a genuine provider flow before the order is released to shops.

For multiple merchants the API creates a parent plus child shop orders; otherwise a standalone order. The response is customer order detail, not simply `{id}`. Preserve parent/child IDs and show separate delivery statuses.

Two backend questions need resolution before release, not visual workarounds:

1. **Multi-shop COD totals:** parent stores shared service/small-order/discount values, whereas child totals are item subtotal + shop delivery. The rider code previously reviewed collects child totals. Verify/reconcile who collects shared fees and applies discounts before promising an exact per-rider cash breakdown.
2. **Quote and uncertain placement:** no quote/version or idempotency-key contract was established by this review. Placement can reprice, and post-commit notifications can fail. Do not automatically replay a timed-out request or promise the final displayed quote is locked by the current API. Check existing orders and record the needed server guarantee separately.

## 7. Payment capability gate

| Route | Use and limit |
|---|---|
| `GET /payments/order/:orderId` | Customer's payment records for the correct parent/standalone anchor. |
| `POST /payments/order/:orderId/initiate` | Source returns paymentId, amountPaisa, method, provider and **gateway.type = mock**. |
| `POST /payments/:id/confirm` | Present in source/log as a mock/development confirmation. Do not turn it into a browser button that declares genuine money received. |
| `POST /payments/:id/fail` | Has order/stock side effects; not a harmless UI-preview action. |

The inspected PaymentsService is explicitly a development gateway. Do not infer live Card, JazzCash or Easypaisa support from enum values, endpoint registration or buttons in the old customer page. Show available methods only after deployment/provider verification; the design's ordinary checkout uses COD and marks online methods unavailable pending integration. Payment pending/failed layouts are included without any card-data form or false successful payment. [C8]

## 8. Orders, tracking and support

| View/action | Contract |
|---|---|
| History | `GET /orders?status=`. Top 50 parent/standalone records in inspected service; do not invent pagination or lifetime totals. |
| Detail | `GET /orders/:id`. Owned order, item snapshots, amounts, address, merchant/rider, payments/refunds, children and timeline as returned. |
| Track | `GET /orders/:id/track`. Parent-aware deliveries array; see below. |
| Cancel | `POST /orders/:id/cancel` `{reason?}`. Service permits CREATED/PAYMENT_PENDING/PAYMENT_CONFIRMED/SENT_TO_MERCHANT; for a parent every target must qualify. Recheck server result. After acceptance use support. |
| Rate | `POST /orders/:id/rate`. Route registered; verify exact DTO/eligibility before real use. Preview form never sends a review. |
| Order support | `POST /orders/:id/support-ticket`. Route registered; verify DTO and actual authorization. |
| Replacement | `POST /orders/:id/items/:itemId/replacement` `{accept:boolean}` through inspected controller. Revalidate downstream amount/refund semantics in service. |
| General support | `/support/tickets` and messages as registered in S1; inspect relevant customer service access and DTO before connecting. |

Tracking response [C7]:

```text
orderId, orderNumber, isParent, status, paymentStatus, totalAmountPaisa,
deliveries: [{ orderId, orderNumber, status, merchant, rider,
              riderLocation: {latitude, longitude, heading, createdAt} | null,
              estimatedDeliveryMinutes, deliveryOtp, timeline }]
```

Use each child delivery's real state, not a possibly coarser parent status. Location is last-known with timestamp, not proof of a continuously moving marker. Estimated delivery minutes are not a countdown unless timing semantics are actually supported. Customer-only delivery code is displayed only when returned for the eligible state; never place real codes in screenshots/logs/Stitch prompts. All code examples in the design are masked.

Order actions must never call merchant acceptance or rider pickup/delivery endpoints with customer credentials.

## 9. Integration and release evidence

Track each operation separately: **registered → source contract inspected → frontend connected → authenticated read verified → authorized test mutation verified after reload**. Every visual fixture here is below those last three levels.

Public docs/service reads were not reachable from this design environment; no conclusion about production uptime follows. The live origin is owner-provided. No live OTP, guest-session creation, cart write, order, cancellation, payment or other mutation was executed while creating this pack.

Source/deployment parity, customer-scoped cache isolation, genuine provider callbacks, merge idempotency, exact quote consent, partial side effects, source query caps, server money/date conventions, keyboard/assistive-technology behavior and end-to-end merchant/rider round trip need independent verification. UI design does not certify those properties.

## Source register

Every C source was fetched from `CryptoSodi/SirfBazar` default branch during this design pass. Blob hashes in SOURCE_MANIFEST.json identify the actual file versions; a blob hash is not a deployed commit.

| ID | Repository path |
|---|---|
| C1 | `apps/api/src/catalog/catalog.controller.ts` |
| C2 | `apps/api/src/catalog/catalog.service.ts` (selected sections) |
| C3 | `apps/api/src/catalog/catalog.dto.ts` |
| C4 | `apps/api/src/cart/cart.service.ts` |
| C5 | `apps/api/src/guest/guest.controller.ts` |
| C6 | `apps/api/src/orders/orders.controller.ts` |
| C7 | `apps/api/src/orders/orders.service.ts` (through customer cancellation entry) |
| C8 | `apps/api/src/payments/payments.service.ts` |
| C9 | `apps/api/src/customers/customers.controller.ts` |
| C10 | `apps/web/components/LoginSheet.tsx` |
| C11 | `apps/web/lib/api.ts` |
| C12 | `apps/web/app/checkout/page.tsx` (selected section) |
| C13 | `apps/api/src/cart/cart.controller.ts` |
| C14 | `apps/api/src/cart/cart.dto.ts` |
| C15 | `apps/api/src/catalog/location.service.ts` |
| C16 | `apps/web/package.json` |
| S1 | Owner's `Pasted text.txt`, included as `reference/API_STARTUP_LOG.txt` |
