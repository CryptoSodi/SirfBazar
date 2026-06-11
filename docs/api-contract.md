# SirfBazar API contract

Base URL: `http://localhost:3001/api` — Swagger UI at `http://localhost:3001/docs`.
All money values are integers in **paisa** (100 paisa = 1 PKR); display as `Rs (value/100)`.
Auth: `Authorization: Bearer <accessToken>`. Guest endpoints use header `x-guest-session: <token>`.
Realtime: Socket.IO on port 3001, handshake `auth: { token }`; rooms joined via `join:order {orderId}`, `join:merchant {merchantId}`, `join:rider {riderId}`. Events: `order:update`, `order:new`, `rider:location`, `notification`, `delivery:assigned`, `support:new`.

Dev conveniences:
- OTP: any phone, code is printed to API console; master code **123456** always works in dev. Delivery OTP also accepts 123456 in dev.
- Google login (dev): `idToken = "mock:<email>:<name>"`.
- Admin seed login: `admin@sirfbazar.pk` / `Admin@12345` (see prisma/seed.ts).

## Auth (public)
- `POST /auth/send-otp` `{phoneNumber}` → `{sent, expiresInSeconds}` (429 on resend cooldown)
- `POST /auth/verify-otp` `{phoneNumber, code, fullName?}` → `{accessToken, refreshToken, user}`
- `POST /auth/google-login` `{idToken}` → same shape
- `POST /auth/admin-login` `{email, password}` → same shape
- `POST /auth/refresh-token` `{refreshToken}` → rotated pair
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
- `POST /location/detect` `{latitude?, longitude?, ip?}` → `{city, area, latitude, longitude, serviceable}` (geo lookup from seeded service areas; falls back to nearest city)
- `GET /location/service-availability?latitude=&longitude=` → `{serviceable, merchantsInRange}`
- `GET /location/nearby-areas?city=` → `[{city, area}]` (distinct from approved merchants)

## Customer profile (role CUSTOMER)
- `GET /customer/profile` → user + customer (walletBalancePaisa, loyaltyPoints)
- `PUT /customer/profile` `{fullName?, email?, profileImageUrl?}`
- `GET /customer/addresses` · `POST /customer/addresses` `{label, fullAddress, street?, area?, city, latitude?, longitude?, contactName?, contactPhone?, instructions?, isDefault?}` · `PUT /customer/addresses/:id` · `DELETE /customer/addresses/:id` · `PUT /customer/addresses/:id/default`
- `DELETE /customer/account` — soft delete (status DELETED)

## Orders (role CUSTOMER)
- `POST /orders` `{deliveryAddressId, paymentMethod: COD|CARD|JAZZCASH|EASYPAISA|WALLET|BANK_TRANSFER, customerNote?, couponCode?}` → order detail. Multi-merchant carts produce a parent order (`isParent: true`) with `children[]` per shop.
- `GET /orders?status=` → list (parents/standalone, with items, merchant, children)
- `GET /orders/:id` → detail (items, timeline, merchant, rider, payments, refunds, children; `deliveryOtp` only revealed while rider is en route)
- `GET /orders/:id/track` → `{orderId, orderNumber, isParent, status, paymentStatus, totalAmountPaisa, deliveries:[{orderId, orderNumber, status, merchant, rider, riderLocation:{latitude,longitude,heading,createdAt}|null, estimatedDeliveryMinutes, deliveryOtp|null, timeline[]}]}`
- `POST /orders/:id/cancel` `{reason?}` (only before merchant acceptance)
- `POST /orders/:id/rate` `{merchantRating?1-5, riderRating?1-5, reviewText?}`
- `POST /orders/:id/support-ticket` `{issueCategory, title, description}`
- `POST /orders/:id/items/:itemId/replacement` `{accept: boolean}`

Order statuses: CREATED, PAYMENT_PENDING, SENT_TO_MERCHANT, MERCHANT_ACCEPTED, MERCHANT_REJECTED, PREPARING, READY_FOR_PICKUP, RIDER_ASSIGNED, RIDER_ARRIVED_AT_SHOP, PICKED_UP, ON_THE_WAY, RIDER_ARRIVED_AT_CUSTOMER, DELIVERED, CANCELLED_BY_CUSTOMER, CANCELLED_BY_MERCHANT, CANCELLED_BY_ADMIN, FAILED_DELIVERY.

## Payments (role CUSTOMER)
- `GET /payments/order/:orderId` · `POST /payments/order/:orderId/initiate` → `{paymentId, amountPaisa, gateway}` · `POST /payments/:id/confirm` `{providerTransactionId?}` · `POST /payments/:id/fail` `{reason?}`

## Coupons
- `GET /coupons` (public) → active coupons

## Notifications (any role)
- `GET /notifications?unread=true` · `POST /notifications/:id/read` · `POST /notifications/read-all`

## Merchant panel (roles MERCHANT_OWNER, MERCHANT_STAFF)
- `POST /merchant/onboard` (role CUSTOMER or fresh user; upgrades role) `{shopName, shopType, description?, phoneNumber, address, city, area?, latitude, longitude, serviceRadiusKm?, openingTime?, closingTime?, minimumOrderValuePaisa?, averagePreparationMinutes?}` → merchant (approvalStatus SUBMITTED) + fresh tokens `{accessToken, refreshToken}`
- `GET /merchant/profile` · `PUT /merchant/profile` (same fields + logoUrl, bannerUrl)
- `POST /merchant/online` · `POST /merchant/offline` · `POST /merchant/open` · `POST /merchant/close`
- `GET /merchant/dashboard` → `{todayOrders, pendingOrders, preparingOrders, readyOrders, activeDeliveries, completedToday, cancelledToday, todaySalesPaisa, weekSalesPaisa, monthSalesPaisa, commissionPaisa, netEarningsPaisa, lowStockProducts, ratingAverage, ratingCount, isOnline, isOpen}`
- `GET /merchant/products?q=&categoryId=&lowStock=true&page=&pageSize=` · `POST /merchant/products` `{productId?, newProduct?:{name, brand?, description?, categoryId, imageUrl?, unit, size?}, pricePaisa, discountPricePaisa?, stockQuantity, lowStockThreshold?, merchantSku?}` (newProduct creates a Product with approvalStatus PENDING) · `PUT /merchant/products/:id` `{pricePaisa?, discountPricePaisa?, stockQuantity?, isAvailable?, lowStockThreshold?}` · `DELETE /merchant/products/:id`
- `POST /merchant/products/bulk-upload` `{items: [{productId?, name?, categoryId?, unit?, pricePaisa, stockQuantity}]}` → `{created, updated, failed:[{index, error}]}`
- `GET /merchant/earnings?from=&to=` → `{grossSalesPaisa, commissionPaisa, netPayablePaisa, refundDeductionsPaisa, deliveredOrders, byDay:[{date, salesPaisa, orders}]}`
- `GET /merchant/settlements` → settlement list
- Riders: `GET /merchant/riders` · `POST /merchant/riders` `{fullName, phoneNumber, vehicleType?, vehicleNumber?}` (creates rider user; rider logs in with that phone via OTP) · `GET /merchant/riders/:id` · `PUT /merchant/riders/:id` · `DELETE /merchant/riders/:id` (deactivate) · `POST /merchant/riders/:id/activate` · `POST /merchant/riders/:id/deactivate` · `GET /merchant/riders/:id/orders`
- Staff: `GET /merchant/staff` · `POST /merchant/staff` `{fullName, phoneNumber, roleName, permissions: string[]}` · `PUT /merchant/staff/:id` · `DELETE /merchant/staff/:id`

## Merchant orders (roles MERCHANT_OWNER, MERCHANT_STAFF)
- `GET /merchant/orders?status=` · `GET /merchant/orders/:id`
- `POST /merchant/orders/:id/accept` · `/reject {reason}` · `/preparing` · `/ready` · `/assign-rider {riderId}` (rider must belong to this merchant; order must be READY_FOR_PICKUP)
- `POST /merchant/orders/:id/items/:itemId/unavailable` `{replacementMerchantProductId?}`

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
- Support: `GET /admin/support-tickets?status=&page=` · `GET /admin/support-tickets/:id` · `PUT /admin/support-tickets/:id {status?, priority?, assignedToAdminId?}` · `POST /admin/support-tickets/:id/messages {message}`
- Analytics: `GET /admin/analytics?from=&to=` → `{ordersByDay:[{date, orders, gmvPaisa}], topProducts:[…], topMerchants:[…], avgDeliveryMinutes, cancellationRate}`
- Audit: `GET /admin/audit-logs?entityType=&page=`
