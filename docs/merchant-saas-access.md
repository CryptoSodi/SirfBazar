# Merchant SaaS access policy

Current owner decision (2026-10-11): the free POS trial lasts one calendar month. After it expires, POS sales are disabled while existing POS records remain read-only. No automatic charge or paid subscription is configured. New shops remain customer-visible and can receive orders immediately when otherwise eligible.

## Interaction and states

- Registration uses the existing verified account/WhatsApp OTP workflow. Successful `/merchant/onboard` creates an `APPROVED` (active), online, open shop. Opening hours, location/service-radius eligibility, stock and product restrictions still apply.
- Onboarding/profile support seven-day hours (including closed days and overnight spans), a delivery radius in kilometres, a saved PKR delivery-fee setting, and POS opt-in. The saved fee is not currently included in customer quotes; checkout remains distance-priced until pricing semantics are decided.
- POS trial starts only on explicit opt-in, using the server-recorded UTC timestamp; expiry is one calendar month later with month-end clamping. Repeated onboarding/shop recreation does not restart an owner's trial. The API returns trial state, dates and remaining time. Sales are denied after expiry/decline, existing sales remain readable, and legacy merchants without a trial record retain grandfathered access. No paid-plan or automatic-charge behavior is implied.
- Admin → Merchants shows Active/Disabled rather than approval terminology. Disable opens a consequence/reason confirmation inside the existing modal; the operation is fenced against double clicks. Reactivate is reversible and makes the shop online, preserving its opening hours and open/closed flag.
- Existing legacy pending shops are not mass-activated: admin can explicitly activate them. Existing shops retain their creation dates; reactivation never resets the trial.
- Admin access changes and their audit record commit together. Notification failures cannot undo or misreport a committed change.
- Disabled (`SUSPENDED`, `REJECTED`, `INACTIVE`) shops cannot use ordinary owner/staff merchant operations, including IPOS. Profile/status remains readable for support. Their owner's customer/rider account roles are not overwritten or suspended. Existing orders are not automatically cancelled/refunded; admin must handle active fulfilment before disabling a shop.
- Customer discovery/checkout continues to require active approval. A merchant cannot reactivate an admin-disabled shop by switching online; going online additionally requires a saved active status.

## Compatibility and rollout

Legacy approve/suspend/reactivate endpoints and stored statuses are retained. Backend must be released together with the new frontend copy and order-flow changes. Previously installed native apps need a new build for inline rider assignment and waiting-for-packing screens. No production records are modified by implementing this policy.
