# Rider API integration evidence — 2026-10-01

Checkout at `ca4188c` plus working-tree changes. Controller/service source was inspected in `apps/api/src/auth`, `apps/api/src/rider`, `apps/api/src/support`, and `apps/api/src/notifications`. This is source-contract evidence, **not** evidence that the deployed API has the same version. No authenticated live read or mutation was run. No test rider, order, payment or scope was supplied. The local rider-app `.env` still overrides the client default with `http://localhost:3001/api`; changing it to the live host was blocked by safety review and was not worked around. The client default in `lib/api.ts` is `https://api.sirfbazar.com/api` (one `/api`) only when that override is absent.

| Method/path | Source contract | Native handler | Authenticated read | Authorized mutation/refetch | Blocker |
|---|---|---|---|---|---|
| POST `/auth/send-otp`, `/auth/verify-otp` | Checked | Login phone/code | N/A | Not run | Real account/SMS and approved endpoint |
| POST `/auth/google-login` | Checked | Native Google login, explicit new-account fallback | N/A | Not run | Native credential/device test |
| GET `/auth/me`, POST `/auth/refresh-token` | Checked | Onboarding check and existing refresh client | Not run | N/A | Authenticated device/session |
| POST `/auth/logout` | Checked | Best-effort refresh-token revocation before local token removal | N/A | Not run | Server revocation unverified; local removal is unconditional |
| GET `/rider/shops?q=` | Checked | Onboarding search | Not run | N/A | Base URL/account |
| POST `/rider/apply` | Checked | Onboarding application | N/A | Not run | Approved shop/test identity and explicit scope |
| GET `/rider/profile` | Checked | Home, profile, help, onboarding | Not run | N/A | Rider account |
| POST `/rider/online`, `/rider/offline` | Checked | Home availability switch | N/A | Not run | Approved rider/test scope |
| GET `/rider/orders/assigned` | Checked | Home/help | Not run | N/A | Assigned test record; response must be audited for secret serialization |
| GET `/rider/orders/:id` | Checked | Delivery/receipt and reconciliation | Not run | N/A | Own test order |
| POST `/rider/orders/:id/arrived-shop` | Checked | Delivery action | N/A | Not run | Test order/state and explicit scope |
| POST `/rider/orders/:id/picked-up` | Checked | Confirmed pickup sheet | N/A | Not run | Test order/state and explicit scope |
| POST `/rider/orders/:id/arrived-customer` | Checked | Delivery action | N/A | Not run | Test order/state and explicit scope |
| POST `/rider/orders/:id/delivered` | Checked | Four-digit handover and saved-state reconciliation | N/A | Not run | No real delivery completion authorized |
| POST `/rider/orders/:id/report-issue` | Checked | Delivery report form | N/A | Not run | Test order/scope |
| GET `/rider/orders/history` | Checked | History filters | Not run | N/A | Rider account/history |
| POST `/rider/location` | Checked | **Not wired** | N/A | Not run | Sensitive location transmission needs separate approval and native validation |
| POST/GET `/support/tickets`, GET `/support/tickets/:id` | Checked | Help contact/list/replies | Not run | Not run | Test ticket/scope |
| GET `/notifications` | Checked | Header sheet | Not run | N/A | Rider account/response envelope |
| Push-token registration | Existing client inspected | Explicit action in Permissions only | N/A | Not run | Device token/provider validation |

Release checks: `assignedOrders` currently returns broad order records that appear to include `deliveryOtp`, while detail explicitly removes it. The new UI strips the top-level field before state/rendering, but server serialization must be fixed/audited before a live rollout. `RiderService.delivered` also contains a mock-OTP bypass when `OTP_PROVIDER` is unset or `mock`; production configuration must be independently verified. Neither backend issue was changed, per task scope. Payment and GPS policies require verified test records and device behavior before release.
