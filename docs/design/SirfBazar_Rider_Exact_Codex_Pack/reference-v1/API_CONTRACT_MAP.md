# Rider API contract map

**Design target:** existing `SirfBazar/apps/rider-app` → existing `SirfBazar/apps/api`.  
**Base configured by owner:** `https://api.sirfbazar.com/api`.  
**Client paths below omit `/api` because the base already includes it.**

The upload confirms route registration. The source review supplies the stated bodies and behavior. Neither proves authenticated operations on the live deployment. See the source manifest for the exact read evidence. Do not use GroceryServer or merchant password routes.

## 1. Session and rider application

| Operation | Method/path | Inspected input / output / boundary |
|---|---|---|
| Send sign-in code | POST `/auth/send-otp` | `{ phoneNumber, purpose?: 'LOGIN' }`; follow server cooldown/result. No delivery-code resend claim. |
| Verify sign-in | POST `/auth/verify-otp` | `{ phoneNumber, code, context:'rider', fullName? }`; use actual token/user response. DTO minimum code length 4; six-digit login UI is not the delivery-code policy. |
| Google | POST `/auth/google-login` | `{ idToken, context:'rider' }`; preserve native credential flow. Distinguish cancellation, transport failure and absent rider association. |
| Session | GET `/auth/me`; POST `/auth/refresh-token`; POST `/auth/logout` | Reuse the current client/auth service. Verify actual response and logout body; do not invent a token format. |
| Search shops | GET `/rider/shops?q=` | Authenticated application path; approved shops, name search, at most 50. Rows have id, shopName, city, area, address. Not a distance search. |
| Request membership | POST `/rider/apply` | `{ merchantId, fullName, phoneNumber, vehicleType?, vehicleNumber?, profileImageUrl? }`. Returns `{ rider, accessToken, refreshToken }`; inspected creation pending + inactive; does not auto-approve. |
| Profile | GET `/rider/profile` | Rider fields plus merchant projection `{ id, shopName, address, latitude, longitude, phoneNumber }`. Default source profile has no update method for riders. |
| Online/offline | POST `/rider/online`; POST `/rider/offline` | No required DTO body; use existing convention. Response `{ ok, isOnline }`. Not a permission, assignment guarantee or cancellation action. |

## 2. Orders and progress

| Operation | Method/path | Contract and screen |
|---|---|---|
| Assigned work | GET `/rider/orders/assigned` | Array of rider-owned active order records with items, merchant, deliveryAddress and limited customer user fields. Sorted riderAssignedAt descending. No auto-assignment, accept endpoint or route priority. R01/R20. |
| Detail | GET `/rider/orders/:id` | Own order with items, timeline, merchant, address and customer. Detail explicitly excludes deliveryOtp; API adapter should still allowlist data and report other route exposure. R02–R08. |
| At shop | POST `/rider/orders/:id/arrived-shop` | `{ latitude?, longitude? }`; state RIDER_ASSIGNED → RIDER_ARRIVED_AT_SHOP; result `{ ok, status }`. |
| Pickup | POST `/rider/orders/:id/picked-up` | `{ latitude?, longitude? }`; allowed from RIDER_ASSIGNED or RIDER_ARRIVED_AT_SHOP; appends PICKED_UP timeline, main status becomes ON_THE_WAY. No bag checkbox fields. |
| At customer | POST `/rider/orders/:id/arrived-customer` | `{ latitude?, longitude? }`; ON_THE_WAY → RIDER_ARRIVED_AT_CUSTOMER. |
| Complete | POST `/rider/orders/:id/delivered` | `{ otp, photoUrl?, note? }`; allowed from ON_THE_WAY or RIDER_ARRIVED_AT_CUSTOMER; writes delivered state. COD handling updates payment state in service. Result `{ ok, status }`; refetch for facts. |
| Report issue | POST `/rider/orders/:id/report-issue` | `{ description }`; requires own assigned order; creates support ticket and notifications. Does not cancel or complete the order. |
| History | GET `/rider/orders/history` | Array, at most 50 nonactive rider orders; selected fields id, orderNumber, status, totalAmountPaisa, paymentMethod, deliveredAt, createdAt, merchant.shopName. Not all-time statistics. |
| Location | POST `/rider/location` | `{ latitude, longitude, speed?, heading?, orderId? }`; returns `{ ok, trackedOrderId }`. Device accuracy, permission and actual successful request must be handled separately. |

No rider routes here allow changing status arbitrarily, selecting another rider, accepting/rejecting merchant jobs, reassigning deliveries or making refunds. Do not call merchant or admin actions to fill gaps.

## 3. Display allowlist

| Display | Source field | Rule |
|---|---|---|
| Task identity | id, orderNumber | IDs stay strings; do not use numeric GroceryServer IDs. |
| State | status | Use supported action mapping; unknown states are read-only, not guessed. |
| Shop | merchant.shopName, address, phoneNumber, latitude, longitude | Keep this merchant association visible. Missing coordinates do not erase address. |
| Drop-off | deliveryAddress.fullAddress, city, area, instructions, contactName, contactPhone | Prefer delivery-specific contact, then authorized customer fields. Do not expose broad user objects. |
| Customer | customer.user.fullName / phoneNumber where returned | No masked-calling claim; no public sharing or design fixture from live data. |
| Items | quantity, productNameSnapshot, unitSnapshot and itemStatus where present | Verify packed/replacement interpretation; never use today's price to overwrite order snapshots. |
| Payment instruction | paymentMethod AND paymentStatus plus totalAmountPaisa | COD pending: collection instruction. Confirmed PAID: no cash. Do not call any non-COD record paid. |
| Amount | totalAmountPaisa | Integer minor units to display PKR. Label order value or cash to collect, not rider earnings. |
| Timeline | returned events | Arrival/pickup/delivery are separate; timestamps are source values. |
| Never display/retain | deliveryOtp, passwords, tokens, internal finance/admin fields | Backend serialization must exclude secrets; UI filtering alone is not a fix. |

A already-collected COD or other unusual payment state needs an accurate returned payment-state display and help; never instruct a second collection. Partial payments and COD handover need separately verified policies.

## 4. Native hand-offs and shared routes

- Navigation: external map URL using the actual authorized destination. An address string fallback must be encoded. No calculated map route or live ETA is supplied by these endpoints. Google Maps URLs support cross-platform app/web hand-off; use current official URL semantics. [W2 in design specification]
- Calling: native dialer with an authorized number and user action. `tel:` does not supply masked calling or a customer chat service.
- General support: registered `/support/tickets` POST/GET, `/support/tickets/:id` GET and `/support/tickets/:id/messages` POST. The previously inspected support controller uses `{ orderId?, issueCategory, title, description }` and `{ message }`. Reverify current service roles/response. Do not submit fields not accepted by that controller.
- Notifications: registered GET `/notifications`, POST `/notifications/:id/read`, POST `/notifications/read-all` and push-token register/remove. Verify envelopes, token platform and current provider before binding. A sheet in the preview is not a delivered notification.
- Upload: POST `/uploads/image` is registered. Verify multipart field, size/type restrictions and returned URL before adding optional photo proof/profile images. The primary flow does not require a photo or camera permission.

## 5. Known source questions to retain

Assigned-orders serialization may expose full order fields while detail removes the delivery code. Check this server-side before a live rollout. The completion function contains a configuration-dependent mock bypass; production must not default to demo verification. Account approval/activation and capacity policies need actual guard/service verification. Completion uses multiple side effects, so a failed HTTP request need not mean no state was changed.

The existing native Delivery screen can show issue-report success after its helper caught an error. It also uses mounted-screen foreground pings, not proven background tracking. These are implementation/release issues, not reasons to omit helpful visual states.

## 6. Integration evidence ladder

For each mapped feature record: registered → contract read → native handler implemented → authenticated read verified → authorized test mutation/refetch verified → native-device conditions tested.

The design pack reaches source-supported design and local browser preview only. Ordinary app operation must use the live client with proper auth, never fallback to fixture records. This request authorizes no live mutations, migrations, seeding, deployments or use of test bypasses.
