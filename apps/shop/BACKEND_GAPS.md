# Authentication and onboarding gaps (not backend changes)

Source inspected: `apps/api/src/auth/auth.controller.ts`, `auth.dto.ts`, `auth.service.ts`, `apps/api/src/merchant/merchant.dto.ts` and `merchant.service.ts` on 2026-09-29. No backend files, schema or database were changed for this milestone.

1. Merchant-context OTP and Google sign-in require an **existing** merchant or active staff record. They do not self-register a new shop. The existing `POST /merchant/onboard` requires an authenticated user and shop fields (`shopName`, `shopType`, phone, address, city, latitude, longitude), so a separate supported first-account path is needed for the requested public signup journey.
2. The owner's requested signup fields include email/password and CNIC. Current `VerifyOtpDto`/`GoogleLoginDto` are not an email/password merchant signup, and `OnboardMerchantDto` has no CNIC field. Do not drop these fields or store identity data only in the browser.
3. No merchant password sign-in or password-recovery endpoints were found in the inspected auth controller. `POST /auth/admin-login` is admin-only and must not be used as a merchant workaround.
4. Before promising end-to-end signup/recovery, agree on verification/delivery, CNIC handling, account linking, and the exact backend contract. This is separate backend work requiring owner authorization.

The earlier Fastify/MySQL GroceryServer mapping is superseded by the current `apps/api` source and was not used.
