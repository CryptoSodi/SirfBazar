# SirfBazar API contract

Base URL: `http://localhost:3001/api` — Swagger UI at `http://localhost:3001/docs`.
All money values are integers in **paisa** (100 paisa = 1 PKR); display as `Rs (value/100)`.
Auth: `Authorization: Bearer <accessToken>`. Guest endpoints use header `x-guest-session: <token>`.
Realtime: Socket.IO on port 3001, handshake `auth: { token }`; rooms joined via `join:order {orderId}`, `join:merchant {merchantId}`, `join:rider {riderId}`. Events: `order:update`, `order:new`, `rider:location`, `notification`, `delivery:assigned`, `support:new`.

Dev conveniences:
- OTP: any phone, code is printed to API console; master code **123456** always works in dev. Delivery OTP also accepts 123456 in dev.
- Google login fixtures require explicit `GOOGLE_AUTH_PROVIDER=mock` and a non-production environment: `idToken = "mock:<email>:<name>"`. Real login requires `GOOGLE_AUTH_PROVIDER=google` and `GOOGLE_CLIENT_ID`; production rejects mock providers and missing audiences.
- Admin seed login: `admin@sirfbazar.pk` / `Admin@12345` (see prisma/seed.ts).

## Auth
Routes below are public unless explicitly marked as requiring a bearer session.
- `POST /auth/send-otp` `{phoneNumber}` → `{sent, expiresInSeconds}` (429 on resend cooldown)
- `POST /auth/verify-otp` `{phoneNumber, code, fullName?, context?: customer|admin|merchant|rider}` → `{accessToken, refreshToken, user}`; default context is customer
- `POST /auth/google-login` `{idToken, context?: customer|admin|merchant|rider}` → same shape; default context is customer
- `POST /auth/google-link` `{idToken}` requires an existing valid bearer session and verified Google ID token; returns `{linked: true, email}`. Links only the authenticated user, never changes their email, phone, role or memberships, and refuses another account's Google subject/email. It does not issue tokens or merge accounts.
- `GET /auth/google-account` (any authenticated role) returns only the Google identity linked to the current session: `{linked, displayName, email, avatarUrl, linkedAt}`. `linked` is determined by the authenticated user's Google subject, never by matching email. Older links without a stored verified profile snapshot return `linked: true` with null profile fields until the user signs in or links again.

Google login verifies signature, audience, issuer, expiry and verified email using Google's SDK. Existing links are resolved by Google `sub`, never overwritten by email. Automatic first-time email linking is restricted to Gmail/Google Workspace identities; other existing accounts must use their original sign-in method and explicitly link Google. New identities are created only in customer context; admin/merchant/rider privileges still require the existing role/membership checks. Invalid login proof returns 401. Invalid Google proof during authenticated linking returns 400 without invalidating the app session; missing/invalid app sessions still return 401. Certificate-service outages return 503 without exposing tokens. See [Google login setup](google-login.md).
- `POST /auth/admin-login` `{email, password}` → same shape
- `POST /auth/refresh-token` `{refreshToken}` → rotated pair retaining the app-scoped role selected at login; pre-migration tokens without a stored role use the account's base role and may require a fresh sign-in
- `POST /auth/logout` `{refreshToken}`
- `GET /auth/me` (any role) → user + linked customer/merchant/rider/staffOf

## Guest (public, x-guest-session header unless noted)
- `POST /guest/session` `{deviceId?, latitude?, longitude?, city?, area?}` → `{sessionToken, expiresAt}` (no header needed)
- `PUT /guest/session/location` `{latitude?, longitude?, city?, area?}`
- `GET /guest/cart?latitude=&longitude=` → cart view (below)
- `POST /guest/cart/items` `{merchantProductId, quantity}`
- `PUT /guest/cart/items/:id` `{quantity}` (0 removes)
- `DELETE /guest/cart/items/:id`
- `POST /guest/cart/apply-coupon` `{code}`
- `POST /guest/cart/merge-after-login` — requires BOTH guest header and customer JWT
- `GET /guest/location-products?latitude=&longitude=` → nearby products (same shape as /products/nearby)

**Cart view shape**: `{id, couponCode, couponError, itemCount, groups: [{merchant:{id,shopName,logoUrl,city,minimumOrderValuePaisa,isOnline,isOpen}, distanceKm, deliveryFeePaisa, subtotalPaisa, items:[{id, merchantProductId, productId, name, imageUrl, unit, size, quantity, unitPricePaisa, totalPaisa, priceChanged, inStock, stockQuantity}]}], subtotalPaisa, deliveryFeePaisa, serviceFeePaisa, smallOrderFeePaisa, discountPaisa, totalPaisa}`

## Customer cart (role CUSTOMER) — same shapes as guest cart
- `GET /cart?latitude=&longitude=` · `POST /cart/items` · `PUT /cart/items/:id` · `DELETE /cart/items/:id` · `DELETE /cart/clear` · `POST /cart/apply-coupon` · `DELETE /cart/remove-coupon`

## Catalog & discovery (public)
- `GET /products/categories` → tree `[{id,name,slug,iconUrl,sortOrder,children:[…]}]`
- `GET /products/search?q=&categoryId=&latitude=&longitude=&radiusKm=&minPricePaisa=&maxPricePaisa=&brand=&sort=(relevance|price_asc|price_desc|rating|distance)&page=&pageSize=` → paged `{items:[ProductCard], total, page, pageSize, totalPages}`
- `GET /products/nearby?latitude=&longitude=&radiusKm=&categoryId=&page=&pageSize=` → paged ProductCard
- `GET /products/popular?latitude=&longitude=` → ProductCard[]
- `GET /products/recommended?latitude=&longitude=` (personalized when JWT present) → ProductCard[]
- `GET /products/:id?latitude=&longitude=` → product detail + `offers: [{merchantProductId, merchant:{id,shopName,ratingAverage,distanceKm,estimatedDeliveryMinutes}, pricePaisa, discountPricePaisa, stockQuantity, isAvailable}]` + `similar: ProductCard[]`
- `GET /merchants/nearby?latitude=&longitude=&radiusKm=&shopType=&categoryId=&page=&pageSize=` → paged `[{id,shopName,shopType,logoUrl,bannerUrl,ratingAverage,ratingCount,distanceKm,estimatedDeliveryMinutes,minimumOrderValuePaisa,isOnline,isOpen,city,area}]`
- `GET /merchants/:id` → shop detail (above + description, openingTime, closingTime, address)
- `GET /merchants/:id/products?categoryId=&q=&page=&pageSize=` → paged `[{merchantProductId, product:{id,name,imageUrl,unit,size,brand,categoryId}, pricePaisa, discountPricePaisa, stockQuantity, isAvailable}]`
- `GET /merchants/:id/reviews?page=&pageSize=` → paged reviews

**ProductCard**: `{productId, merchantProductId, name, slug, brand, imageUrl, unit, size, categoryId, pricePaisa, discountPricePaisa, merchant:{id, shopName, ratingAverage, distanceKm, estimatedDeliveryMinutes}, stockQuantity, isAvailable}` — one card per (product, cheapest/nearest merchant offer).

## Location (public)
- `POST /location/detect` `{latitude?, longitude?, ip?}` → `{city, area, latitude, longitude, serviceable}` (returns a merchant area only when the supplied point is within an approved merchant's service radius; `city` and `area` are null outside coverage; without coordinates, falls back to the busiest city)
- `GET /location/service-availability?latitude=&longitude=` → `{serviceable, merchantsInRange}`
- `GET /location/nearby-areas?city=` → `[{city, area}]` (distinct from approved merchants)

## Customer profile (role CUSTOMER)
- `GET /customer/profile` → user + customer (walletBalancePaisa, loyaltyPoints)
- `PUT /customer/profile` `{fullName?, email?, profileImageUrl?}`
- `GET /customer/addresses` · `POST /customer/addresses` `{label, fullAddress, street?, area?, city, latitude?, longitude?, contactName?, contactPhone?, instructions?, isDefault?}` · `PUT /customer/addresses/:id` · `DELETE /customer/addresses/:id` · `PUT /customer/addresses/:id/default`
- `DELETE /customer/account` — soft delete (status DELETED)

## Orders (role CUSTOMER)
- `POST /orders/quote` `{cartId,deliveryAddressId,paymentMethod:'COD',couponCode?}` → `{version:1,approvedQuote,expiresAt,quote}`. The five-minute signed quote binds the authenticated customer, cart items and quantities, merchant identities, saved destination snapshot, current prices, fees, coupon and total. `quote` includes `items`, `merchants`, `deliveryAddress`, `subtotalPaisa`, `deliveryFeePaisa`, `serviceFeePaisa`, `smallOrderFeePaisa`, `discountPaisa` and `totalAmountPaisa`. Customers review this total before submission.
- `POST /orders` `{requestId:UUIDv4,cartId,approvedQuote,deliveryAddressId,paymentMethod:'COD',customerNote?,couponCode?}` → order detail. Multi-merchant carts produce a parent order (`isParent:true`) with `children[]` per shop. Missing approval returns `409 QUOTE_REQUIRED`; stale or changed approval returns `409 QUOTE_CHANGED`, with a replacement `quote`, `approvedQuote` and `expiresAt` only while still eligible. Neither response creates an order. New marketplace orders support COD only.
- The first submission must persist the exact immutable payload and request ID before POST. The ID becomes the standalone or parent order ID. An existing owned `Order.id=requestId` with matching fingerprint recovers before token expiry, consumed-cart or address checks. Cross-owner/channel or changed-payload reuse conflicts. After an uncertain response, `GET /orders/:requestId` first, then retry the identical POST and ID. A 404 alone does not permit a new ID. Older clients can browse and recover existing orders, but an unquoted new order requires an update and explicit review.
- `GET /orders?status=` → list (parents/standalone, with items, merchant, children)
- `GET /orders/:id` → detail (items, timeline, merchant, rider, payments, refunds, children; `deliveryOtp` only revealed while rider is en route)
- `GET /orders/:id/track` → `{orderId, orderNumber, isParent, status, paymentStatus, totalAmountPaisa, deliveries:[{orderId, orderNumber, status, merchant, rider, riderLocation:{latitude,longitude,heading,createdAt}|null, estimatedDeliveryMinutes, deliveryOtp|null, timeline[]}]}`
- `POST /orders/:id/cancel` `{reason?}` (only before merchant acceptance)
- `POST /orders/:id/rate` `{merchantRating?1-5, riderRating?1-5, reviewText?}`
- `POST /orders/:id/support-ticket` `{issueCategory, title, description}`
- `POST /orders/:id/items/:itemId/replacement` `{accept: boolean}` (legacy replacement workflow)
- `POST /orders/:id/revisions/:revisionId/respond` `{accept:boolean}` — only the owning customer may approve/reject. Proposals expire after 30 minutes by default (`ORDER_REVISION_APPROVAL_MINUTES`); expiry and rejection preserve the original order and inventory.

Order statuses: CREATED, PAYMENT_PENDING, SENT_TO_MERCHANT, MERCHANT_ACCEPTED, MERCHANT_REJECTED, PREPARING, READY_FOR_PICKUP, RIDER_ASSIGNED, RIDER_ARRIVED_AT_SHOP, PICKED_UP, ON_THE_WAY, RIDER_ARRIVED_AT_CUSTOMER, DELIVERED, CANCELLED_BY_CUSTOMER, CANCELLED_BY_MERCHANT, CANCELLED_BY_ADMIN, FAILED_DELIVERY.

## Payments (role CUSTOMER)
- `GET /payments/order/:orderId` remains available for status. Customer mock initiate/confirm/fail routes cannot establish paid state; no digital tender is enabled in production.

## Coupons
- `GET /coupons` (public) → active coupons

## Notifications (any role)
- `GET /notifications?unread=true` · `POST /notifications/:id/read` · `POST /notifications/read-all`

## Merchant panel (roles MERCHANT_OWNER, MERCHANT_STAFF)
- `POST /merchant/onboard` (role CUSTOMER or fresh user; upgrades merchant context) `{shopName, shopType, description?, phoneNumber, address, city, area?, latitude, longitude, serviceRadiusKm?, openingTime?, closingTime?, operatingHours?:[{dayOfWeek:0..6,isClosed,opensAt?,closesAt?,closesNextDay?}], deliveryFeePaisa?, posOptIn?, minimumOrderValuePaisa?, averagePreparationMinutes?}` → approved merchant + POS trial view + fresh tokens. `operatingHours`, when supplied, contains exactly seven unique day entries. POS trial is one calendar month from server UTC activation; declining POS leaves core marketplace access enabled.
- `GET /merchant/profile` · `PUT /merchant/profile` (same editable schedule/location/fee fields + logoUrl, bannerUrl; POS opt-in is onboarding-only)
- Profile responses include the saved weekly schedule, `deliveryFeePaisa`, and `posTrial: {status:'ACTIVE'|'EXPIRED'|'DECLINED'|'LEGACY',optedIn,salesEnabled,startedAt,endsAt,remainingMilliseconds}`. `PUT` returns the refreshed schedule so clients retain the saved weekly values.
- `POST /merchant/online` · `POST /merchant/offline` · `POST /merchant/open` · `POST /merchant/close`
- `GET /merchant/dashboard` → `{todayOrders, pendingOrders, preparingOrders, readyOrders, activeDeliveries, completedToday, cancelledToday, todaySalesPaisa, weekSalesPaisa, monthSalesPaisa, commissionPaisa, netEarningsPaisa, lowStockProducts, ratingAverage, ratingCount, isOnline, isOpen}`
- `GET /merchant/products?q=&categoryId=&lowStock=true&page=&pageSize=` · `POST /merchant/products` `{productId?, newProduct?:{name, brand?, description?, categoryId, imageUrl?, unit, size?}, pricePaisa, discountPricePaisa?, stockQuantity, lowStockThreshold?, merchantSku?}` (newProduct creates a Product with approvalStatus PENDING) · `PUT /merchant/products/:id` `{pricePaisa?, discountPricePaisa?, stockQuantity?, isAvailable?, lowStockThreshold?}` · `DELETE /merchant/products/:id`
- `POST /merchant/products/bulk-preview` `{requestId:UUIDv4,mode?:'ADD_MISSING'|'UPDATE_EXISTING',items:[{rowId,productId?,name?,categoryId?,unit?,merchantSku?,pricePaisa,stockQuantity}]}` → `{rows,previewToken,expiresAt}`. Up to 1,000 rows; integer paisa and whole stock units are required. Preview rows have `NEW`, `MATCH`, `SKIP` or `CONFLICT` status and show the proposed values and any current listing snapshot. Unmatched new products need a name, active unrestricted category and unit, and enter moderation.
- `POST /merchant/products/bulk-upload` uses the same immutable request and `previewToken` → `{created,updated,skipped,failed:[{index,error}],rows:[{rowId,status,merchantProductId?,error?}]}`. Row status is `CREATED`, `UPDATED`, `SKIPPED` or `FAILED`. Default `ADD_MISSING` never overwrites existing listings; explicit `UPDATE_EXISTING` requires the signed preview and rejects changed stock, regular price or discount. The confirmed CSV sale price replaces the effective selling price and clears the old discount; preview includes both regular and effective current prices. Catalogue-only additions may omit the preview, but still require request and row IDs. Retry the same payload and IDs to reconcile an uncertain response; successful row writes are recorded atomically and are not applied twice. After preview expiry, exact retries return saved row results and mark uncommitted rows `FAILED` for a new preview; they never apply fresh writes. Changed rows require a new preview. CSV headers are mapped by the merchant, not assumed to be an official iPOS export schema.

Both bulk routes accept JSON bodies up to 6 MiB to accommodate mapped CSV rows and their signed preview. Other JSON and URL-encoded routes retain the 100 KiB limit. The merchant interface accepts CSV files up to 2 MiB and 1,000 products; preview tokens are bounded to 4 MiB.

The merchant portal also accepts `.xlsx` files up to 2 MiB and reads the first worksheet in the browser. Formula cells are rejected; formatted values are mapped into the existing JSON preview/upload contract. Downloadable blank CSV and XLSX templates use the same field labels. No spreadsheet file is uploaded to the API, and the API's existing 1,000-row limit and preview/commit rules remain authoritative.
- `GET /merchant/earnings?from=&to=` → `{grossSalesPaisa, commissionPaisa, netPayablePaisa, refundDeductionsPaisa, deliveredOrders, byDay:[{date, salesPaisa, orders}]}`
- `GET /merchant/settlements` → settlement list
- Riders: `GET /merchant/riders` · `POST /merchant/riders` `{fullName, phoneNumber, vehicleType?, vehicleNumber?}` (creates rider user; rider logs in with that phone via OTP) · `GET /merchant/riders/:id` · `PUT /merchant/riders/:id` · `DELETE /merchant/riders/:id` (deactivate) · `POST /merchant/riders/:id/activate` · `POST /merchant/riders/:id/deactivate` · `GET /merchant/riders/:id/orders`
- Staff: `GET /merchant/staff` · `POST /merchant/staff` `{fullName, phoneNumber, roleName, permissions: string[]}` · `PUT /merchant/staff/:id` · `DELETE /merchant/staff/:id`

## Merchant orders (roles MERCHANT_OWNER, MERCHANT_STAFF)

### iPOS counter (POS permission required)

- `GET /pos/capabilities` → `{version:3, merchantId, idempotentSales:true, barcodeLookup:true, paymentMethods:['CASH'], offlineSales:false, trial, salesEnabled, readOnly}`. An opted-in trial permits sales until its UTC calendar-month expiry. Expired/declined shops retain read-only POS history; new sales are denied server-side. Merchants without a trial row retain legacy access. The one-month POS policy was selected by the owner; no automatic charge or paid plan exists.
- `GET /pos/products?q=` → up to 300 merchant-scoped `{merchantProductId,productId,name,imageUrl,unit,barcode,merchantSku,pricePaisa,stockQuantity,isAvailable}` rows. Name search is case-insensitive; barcode/SKU search is exact. Unapproved, restricted and prescription products are not sellable here.
- `GET /pos/products/lookup?code=` → one exact barcode/shop-SKU match, independent of the 300-row catalogue limit. Codes remain strings, preserving leading zeros. Missing = 404; ambiguous duplicate = 409.
- `POST /pos/products/review` `{merchantProductIds:string[1..200]}` → current merchant-scoped rows for a bill's explicit IDs; read-only price/stock review, not a reservation.
- `POST /pos/sales` `{requestId?:UUIDv4,counterName?:string[60],items:[{merchantProductId,quantity:integer[1..100000],expectedUnitPricePaisa?:integer}],amountTenderedPaisa?:integer,note?:string[500]}` → saved cash POS order with `items`, `amountTenderedPaisa`, `changePaisa`, `counterName`, `cashierId`. All money is integer paisa; maximum bill/tender is 2,147,483,647. At most 200 distinct product lines. Stock, availability, approval, tenant and expected price are checked; a confirmed business validation rejection is 400.
- New clients persist `requestId` and the immutable payload before sending. The ID is the existing Order primary key. Repeat requests return the original receipt only for the same merchant, cashier and fingerprint (items/prices/tender/note/counter); mismatches = 409. Order, stock decrement and `POS_SALE_COMPLETED` audit metadata commit atomically. No new schema fields are required. Legacy requests without IDs remain supported but are not repeat-safe.
- After an uncertain response: `GET /pos/sales/:requestId` to check, or retry the identical POST. A not-found check is not permission to invent a new sale reference. The dashboard retains the pending request across reloads and does not permit a replacement bill until resolved.
- `GET /pos/sales?from=&to=` → `{count,totalPaisa,sales}` (latest 200); `GET /pos/sales/:id` → same-shop POS receipt with merchant header and saved tender metadata. Older receipts without audit metadata return null tender/change. `GET /pos/summary?from=&to=` → `{count,totalPaisa}` across the date range.
- The browser counter supports cash, whole packaged units, local drafts/held bills and browser receipt printing. It does not enable digital tender, fractional scale sales, refunds, fiscal integration, offline sale synchronization or drawer reconciliation. Deploy the matching API before enabling the frontend; no database migration was performed for this addition.

### Online-order workflow

- `GET /merchant/orders?status=` · `GET /merchant/orders/:id`
- `POST /merchant/orders/:id/accept` atomically records acceptance and starts preparation; returns `{ok:true,status:'PREPARING'}`. Buyers see Preparing without a second shop action.
- `/reject {reason}` · `/preparing` (retained for older Accepted orders) · `/ready` (packed order only).
- `/assign-rider {riderId}` accepts MERCHANT_ACCEPTED, PREPARING or READY_FOR_PICKUP. The rider must belong to the shop, be active/approved and idle without another order. Assignment during preparation preserves preparation status and reserves the rider; the response includes the actual saved status and rider. Duplicate or competing assignments return a conflict rather than replacing a rider.
- `/ready` returns READY_FOR_PICKUP without a rider, or RIDER_ASSIGNED when a rider was already reserved. The acceptance and readiness timeline entries remain. Rider pickup is still permitted only after readiness; assignment never implies packing is complete. See [merchant order flow](merchant-order-flow.md).
- `POST /merchant/orders/:id/items/:itemId/unavailable` `{replacementMerchantProductId?}`
- `POST /merchant/orders/:id/revisions` `{requestId:UUIDv4,changes:[{originalItemId,action:'REMOVE'|'REDUCE'|'REPLACE',quantity?,replacementMerchantProductId?}]}` — merchant-scoped idempotent proposal; one pending revision per order. Current supported path is COD, no coupons/discounts, and an order must retain at least one product. Original items, totals and stock are untouched while pending. Replacement inventory/price and the submitted order snapshots are rechecked on customer approval. Fulfillment transitions are blocked while approval is pending. Digital payment adjustment remains unsupported, so those orders are rejected from this flow.
- Revision states are PENDING, APPROVED, REJECTED or EXPIRED, with an audit timeline and timestamps. Default approval window is 30 minutes; `ORDER_REVISION_APPROVAL_MINUTES` may override it. Timeout never approves or changes the original order.

### Merchant hours and delivery price

`operatingHours` uses Pakistan local wall time (`Asia/Karachi`); `dayOfWeek` is Sunday=0 through Saturday=6. Closed days have no times. `closesNextDay` represents overnight hours. New schedules are enforced by customer availability, quote and checkout. The `deliveryFeePaisa` setting is persisted but is not included in customer quotes or charged: current checkout keeps its distance-based fee until the owner confirms how this setting should affect pricing.

## Rider (role RIDER)
- `GET /rider/profile` · `POST /rider/online` · `POST /rider/offline`
- `POST /rider/location` `{latitude, longitude, speed?, heading?, orderId?}`
- `GET /rider/orders/assigned` · `GET /rider/orders/history` · `GET /rider/orders/:id`
- `POST /rider/orders/:id/arrived-shop` · `/picked-up` · `/arrived-customer` (each accepts `{latitude?, longitude?}`)
- `POST /rider/orders/:id/delivered` `{otp, photoUrl?, note?}` — customer's 4-digit code (123456 in dev)
- `POST /rider/orders/:id/report-issue` `{description}`

## Support (customer creates via /orders/:id/support-ticket or here)
- `POST /support/tickets` `{orderId?, issueCategory, title, description}` (CUSTOMER/MERCHANT_OWNER/RIDER)
- `GET /support/tickets` (own tickets) · `GET /support/tickets/:id` (incl. messages)
- `POST /support/tickets/:id/messages` `{message}`

## Admin (roles ADMIN/SUPER_ADMIN; finance endpoints also FINANCE_ADMIN; tickets also SUPPORT_AGENT)
- `GET /admin/dashboard` → totals (customers, merchants, riders, orders, activeOrders, completedOrders, cancelledOrders, gmvPaisa, commissionRevenuePaisa, deliveryFeeRevenuePaisa, avgOrderValuePaisa, pendingTickets, pendingMerchants, pendingRefunds)
- Customers: `GET /admin/customers?q=&page=` · `GET /admin/customers/:id` · `POST /admin/customers/:id/suspend` · `/activate`
- Merchants: `GET /admin/merchants?status=&q=&page=` · `GET /admin/merchants/:id` · `POST /admin/merchants/:id/approve` · `/reject {reason}` · `/suspend {reason}` · `/reactivate` · `PUT /admin/merchants/:id` `{commissionType?, commissionValue?, serviceRadiusKm?}` · `GET /admin/merchants/:id/riders`
- Riders: `GET /admin/riders?page=` · `POST /admin/riders/:id/suspend` · `/activate`
- Orders: `GET /admin/orders?status=&merchantId=&customerId=&q=&page=` · `GET /admin/orders/:id` · `POST /admin/orders/:id/cancel {reason}` · `POST /admin/orders/:id/refund {amountPaisa?, reason}` · `POST /admin/orders/:id/status {status, reason}` (manual override w/ audit)
- Products: `GET /admin/products?approvalStatus=&q=&page=` · `POST /admin/products` · `PUT /admin/products/:id` · `POST /admin/products/:id/approve` · `/reject {reason}` · `/disable`
- Categories: `GET /admin/categories` · `POST /admin/categories` `{name, parentCategoryId?, iconUrl?, sortOrder?}` · `PUT /admin/categories/:id` · `DELETE /admin/categories/:id`
- Coupons: `GET /admin/coupons` · `POST /admin/coupons` `{code, title, discountType: PERCENTAGE|FIXED|FREE_DELIVERY, discountValue, maxDiscountAmountPaisa?, minimumOrderAmountPaisa?, startDate, endDate, usageLimitTotal?, usageLimitPerCustomer?, newUsersOnly?, applicableMerchantId?, applicableCity?}` · `PUT /admin/coupons/:id` · `DELETE /admin/coupons/:id` (deactivate)
- Refunds: `GET /admin/refunds?status=&page=` · `POST /admin/refunds/:id/approve` · `/reject {notes}` · `/process`
- Settlements: `GET /admin/settlements?merchantId=&status=` · `POST /admin/settlements/generate {merchantId?, startDate, endDate}` (computes from DELIVERED orders: earnings − refunds) · `POST /admin/settlements/:id/mark-paid {paymentReference}` · `/hold {notes}`

Refund approval and processing reserve against collected payment and affected shop allocations in a transaction; repeated processing cannot credit a wallet twice. Uncollected COD orders cannot create refund credit. Split COD allocations exclude uncollected children. Historical parent refunds without allocation evidence, and legacy COD records whose collected amount cannot be reconciled after older mock-payment flows, require reconciliation rather than inferred collection. Existing `PAID` labels alone do not establish the provenance of those historical records.

Settlement generation atomically claims unsettled, delivered, collected ONLINE orders and computes from the claimed rows. Only a valid PENDING batch can become PAID. A refund affecting a pending batch recomputes and holds it; a refund affecting an already paid batch returns a reconciliation conflict before wallet credit. These endpoints do not implement an external payment provider or an adjustment ledger.
- Support: `GET /admin/support-tickets?status=&page=` · `GET /admin/support-tickets/:id` · `PUT /admin/support-tickets/:id {status?, priority?, assignedToAdminId?}` · `POST /admin/support-tickets/:id/messages {message}`
- Analytics: `GET /admin/analytics?from=&to=` → `{ordersByDay:[{date, orders, gmvPaisa, itemValuePaisa}], topProducts:[…], topMerchants:[…], avgDeliveryMinutes, cancellationRate}`. `itemValuePaisa` is delivered merchandise subtotal; `gmvPaisa` remains the existing collected order total.
- Audit: `GET /admin/audit-logs?entityType=&page=`

## Customer shop availability

Customer offers require an APPROVED merchant with both `isOnline=true` and `isOpen=true`. Search, nearby, popular, personalized/recommended and similar product feeds, product-detail offers and public shop inventory enforce this rule with or without customer coordinates. An offline/closed shop's public inventory returns an empty paginated result. The merchant-independent global catalogue and authenticated merchant inventory/iPOS are unchanged.

Approved shops remain in `/merchants/nearby` and `/merchants/:id`, with their real availability flags, so customers can distinguish an offline/closed shop from an area without shops. Customer clients display unavailable directory cards without shopping/navigation actions. `isOnline=false` is labelled Offline; an online shop with `isOpen=false` is labelled Closed. Saved opening/closing hours alone do not switch either flag.

Customer and guest cart additions and quantity increases recheck shop availability in their existing transaction. Offline/closed shops cannot receive new additions. Existing basket contents are retained; reductions/removals and guest-to-customer merge retain existing behaviour. Customer basket interfaces block checkout while a shop is unavailable and offer an explicit availability refresh. Order quote/placement retain their existing final eligibility checks. Availability is evaluated on refresh/request, not a new real-time scheduling or push system.
# Merchant onboarding and availability

`POST /merchant/onboard` creates an active (`APPROVED`), online, open shop without admin approval. Existing account verification remains required. Customer visibility and order acceptance still obey saved weekly hours, approved inventory, stock and delivery eligibility. Existing pending shops require explicit admin activation; there is no bulk status migration.

Onboarding/profile accept seven unique day entries in `operatingHours`, `serviceRadiusKm`, `deliveryFeePaisa` and `posOptIn`. Weekly hours control availability checks in catalogue/quote flows; legacy scalar hours remain a fallback. The saved flat fee is not currently charged or included in quotes; checkout remains distance-priced pending a pricing decision.

POS opt-in creates one owner-scoped trial at the server-recorded UTC activation time. It ends one calendar month later with month-end clamping. Expired/declined trials block new POS sales while preserving read-only history; legacy merchants without a trial record retain existing access. No automatic billing is configured. Admin disable/reactivate uses existing suspend/reactivate endpoints. Disabled shops retain profile/status access but owner/staff merchant operations are blocked; customer/rider capabilities on the same account are preserved.
