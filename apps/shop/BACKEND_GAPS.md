# Authentication and onboarding contract status

Source inspected and implemented in the workspace-local `sirfbazar-api` on 2026-09-29.

1. `POST /auth/merchant-register/start` stores the owner name, email/mobile, CNIC and password hash, and opens a verification attempt.
2. `POST /auth/merchant-register/verify` verifies the attempt and returns the short-lived authenticated session used by `POST /merchant/onboard`.
3. `POST /auth/merchant-login` signs in merchant owners or active merchant staff with email/mobile and password. Admin login is not used.
4. `POST /auth/merchant-password/request` and `/reset` implement recovery without revealing whether an account exists.
5. The local mock OTP is `123456`. A text-only WAHA WhatsApp adapter is implemented for Pakistani mobile signup, login OTP and password recovery, including random codes, expiry, request/attempt limits, allowlisting, bounded requests and invalidation after ambiguous delivery. It is not live until the WAHA session is paired and a controlled recipient is configured. Email OTP delivery remains unimplemented; WAHA is a local pilot rather than a production support/SLA provider.
6. Google sign-in remains intentionally unconnected.

## Remaining operational blockers

- WAHA OTP delivery still requires a running/paird session and an allowlisted controlled recipient; the fixed local OTP remains test-only.
- Production Web Push requires stable VAPID credentials, the deployed subscription schema and an interactive controlled-device delivery check.
- The Google Maps browser key must be restricted to the approved production origins and enabled APIs before release.
- Customer payment/order/review operations, rider delivery operations and admin refund/coupon/platform operations are deliberately outside the merchant session. Their role guards were locally rechecked; they require their own applications and test accounts rather than being attached to this dashboard.
- A deployed production smoke run still needs an owner-approved merchant test account and disposable records. No production mutation was performed in this implementation pass.

The earlier Fastify/MySQL GroceryServer mapping is superseded and is not used by the active frontend.
