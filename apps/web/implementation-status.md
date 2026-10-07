# Customer website implementation status

Updated 2026-10-05. Scope: `apps/web` only, connected to the existing `apps/api`. This is an implementation and verification record, not a production-readiness claim.

## Implemented

- Responsive customer shell, home, browse/search, product-offer and shop pages using live API responses; Light, Dark and System appearance.
- Explicit location choice with a labelled example browsing area. GPS is requested only after the customer chooses it.
- Guest basket grouped by shop, quantities, coupons, per-shop delivery charges, changed-price acknowledgement and explicit expired-session recovery.
- Checkout draft before sign-in, OTP or configured Google sign-in, guest-cart merge uncertainty handling, saved addresses, COD-only payment, explicit quote review and separate order-placement action.
- Order placement uncertainty directs customers to history instead of retrying. Tracking, history, profile appearance, support links and replacement review are connected to existing routes.
- Prices come from priced offers or basket quotes. Missing catalogue images use a neutral unavailable state instead of fictional SKU imagery.

## Verified

- `npm run build` completed with compilation, lint and TypeScript checks on 2026-10-05.
- Local API-backed, read-only browser checks rendered home products and nearby shops, browse results, a shop storefront and a product with two real offers.
- The loaded home page had no document-level horizontal overflow at 320, 390, 768, 1024, 1366 or 1440 CSS pixels. Light and Dark mobile states and a tablet layout were visually inspected.

## Not yet verified end to end

- Add/update/remove basket items, coupon redemption, OTP/Google sign-in, guest merge, saved address write, order placement, replacement decision and tracking changes. Browser sessions contained an expired guest token; the recovery UI was inspected but the token was not discarded without approval.
- Exact 200% zoom, screen-reader announcements, reduced-motion behavior, all error responses and all breakpoint/page combinations.
- Production API/CORS configuration, Google OAuth credentials, SMS delivery and payment provider availability.

Use a named disposable non-production account, basket and order for write-path E2E testing. Do not use a real customer or place a live order for this check. See `api-contracts-verified.md`, `visual-parity-report.md` and `design-deviations.md`.
