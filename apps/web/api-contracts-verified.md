# Customer API contract verification

Updated 2026-10-05. `apps/web/lib/api.ts` uses the existing `/api` proxy locally and the configured public API URL in production. Source/controller checks establish route availability; only the read-only rows below were exercised in a browser.

| Flow | Existing endpoint(s) | Verification |
| --- | --- | --- |
| Nearby catalogue, categories, offers | `GET /products/nearby`, `/products/categories`, `/products/:id` | Browser rendered real priced products, categories and a product with two shop offers. |
| Shop discovery/storefront | `GET /merchants/nearby`, `/merchants/:id`, `/merchants/:id/products` | Browser rendered nearby shops and a real storefront. |
| Guest basket | `POST /guest/session`, `GET /guest/cart`, `POST/PUT/DELETE /guest/cart/items` | Controller/source checked. Existing browser guest token was expired; no write test. |
| Auth and merge | `POST /auth/send-otp`, `/auth/verify-otp`, `/auth/google-login`, `/guest/cart/merge-after-login` | Controller/source checked. No OTP/Google/merge call made. |
| Customer addresses | `GET/POST /customer/addresses` | Controller/source checked. No signed-in write test. |
| Orders and tracking | `POST/GET /orders`, `GET /orders/:id`, `/orders/:id/track`, `POST /orders/:id/items/:itemId/replacement` | Controller/source checked. No order or replacement mutation made. |

All money is passed as integer paisa and formatted for display. An absent price or total is not treated as zero. Delivery fees are shown from basket quotes, not invented on shop/product discovery screens. Guest-cart merge is attempted once; a network-uncertain merge requires basket review. A network-uncertain `POST /orders` is never automatically retried.

This file does not assert that write requests or production integrations succeed. Those require an approved disposable test scope.
