# Customer website — registered route reference

Extracted from the owner-supplied startup log. Registered methods/paths only; not proof of payloads, merchant permissions, payment-provider readiness or integration. Includes shared auth/support services relevant to a customer site. Admin login is deliberately excluded. No authorization to execute every route.

**67 selected method/path pairs.** Source locator: line in `reference/API_STARTUP_LOG.txt`.

| Method | Full registered path | Source line |
|---|---|---|
| POST | `/api/notifications/push-token` | 37 |
| POST | `/api/notifications/push-token/remove` | 38 |
| GET | `/api/notifications` | 39 |
| POST | `/api/notifications/:id/read` | 40 |
| POST | `/api/notifications/read-all` | 41 |
| POST | `/api/auth/send-otp` | 43 |
| POST | `/api/auth/verify-otp` | 44 |
| POST | `/api/auth/google-login` | 45 |
| POST | `/api/auth/refresh-token` | 47 |
| POST | `/api/auth/logout` | 48 |
| GET | `/api/auth/me` | 49 |
| POST | `/api/guest/session` | 51 |
| PUT | `/api/guest/session/location` | 52 |
| GET | `/api/guest/cart` | 53 |
| POST | `/api/guest/cart/items` | 54 |
| PUT | `/api/guest/cart/items/:id` | 55 |
| DELETE | `/api/guest/cart/items/:id` | 56 |
| POST | `/api/guest/cart/apply-coupon` | 57 |
| POST | `/api/guest/cart/merge-after-login` | 58 |
| GET | `/api/cart` | 60 |
| POST | `/api/cart/items` | 61 |
| PUT | `/api/cart/items/:id` | 62 |
| DELETE | `/api/cart/items/:id` | 63 |
| DELETE | `/api/cart/clear` | 64 |
| POST | `/api/cart/apply-coupon` | 65 |
| DELETE | `/api/cart/remove-coupon` | 66 |
| GET | `/api/coupons` | 68 |
| POST | `/api/orders` | 70 |
| GET | `/api/orders` | 71 |
| GET | `/api/orders/:id` | 72 |
| GET | `/api/orders/:id/track` | 73 |
| POST | `/api/orders/:id/cancel` | 74 |
| POST | `/api/orders/:id/rate` | 75 |
| POST | `/api/orders/:id/support-ticket` | 76 |
| POST | `/api/orders/:id/items/:itemId/replacement` | 77 |
| GET | `/api/payments/order/:orderId` | 88 |
| POST | `/api/payments/order/:orderId/initiate` | 89 |
| POST | `/api/payments/:id/confirm` | 90 |
| POST | `/api/payments/:id/fail` | 91 |
| GET | `/api/products/categories` | 109 |
| GET | `/api/products/search` | 110 |
| GET | `/api/products/catalog` | 111 |
| GET | `/api/products/nearby` | 112 |
| GET | `/api/products/popular` | 113 |
| GET | `/api/products/recommended` | 114 |
| GET | `/api/products/:id` | 115 |
| GET | `/api/merchants/nearby` | 117 |
| GET | `/api/merchants/:id` | 118 |
| GET | `/api/merchants/:id/products` | 119 |
| GET | `/api/merchants/:id/reviews` | 120 |
| POST | `/api/location/detect` | 122 |
| GET | `/api/location/service-availability` | 123 |
| GET | `/api/location/nearby-areas` | 124 |
| GET | `/api/guest/location-products` | 126 |
| GET | `/api/customer/profile` | 128 |
| PUT | `/api/customer/profile` | 129 |
| GET | `/api/customer/addresses` | 130 |
| POST | `/api/customer/addresses` | 131 |
| PUT | `/api/customer/addresses/:id` | 132 |
| DELETE | `/api/customer/addresses/:id` | 133 |
| PUT | `/api/customer/addresses/:id/default` | 134 |
| DELETE | `/api/customer/account` | 135 |
| POST | `/api/support/tickets` | 220 |
| GET | `/api/support/tickets` | 221 |
| GET | `/api/support/tickets/:id` | 222 |
| POST | `/api/support/tickets/:id/messages` | 223 |
| POST | `/api/uploads/image` | 225 |
