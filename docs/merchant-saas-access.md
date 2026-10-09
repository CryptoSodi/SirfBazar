# Merchant SaaS access policy

Confirmed by the owner: new shops are customer-visible and can receive orders immediately; the one-month trial never automatically expires access. No paid subscription integration is implied.

## Interaction and states

- Registration uses the existing verified account/WhatsApp OTP workflow. Successful `/merchant/onboard` creates an `APPROVED` (active), online, open shop. Opening hours, location/service-radius eligibility, stock and product restrictions still apply.
- Trial starts at shop creation and ends one calendar month later, with month-end dates clamped (January 31 → February 28/29). The additive `trial` response describes dates and `accessContinuesAfterTrial: true`. No schema, billing, expiry job or configuration changes are required.
- Admin → Merchants shows Active/Disabled rather than approval terminology. Disable opens a consequence/reason confirmation inside the existing modal; the operation is fenced against double clicks. Reactivate is reversible and makes the shop online, preserving its opening hours and open/closed flag.
- Existing legacy pending shops are not mass-activated: admin can explicitly activate them. Existing shops retain their creation dates; reactivation never resets the trial.
- Admin access changes and their audit record commit together. Notification failures cannot undo or misreport a committed change.
- Disabled (`SUSPENDED`, `REJECTED`, `INACTIVE`) shops cannot use ordinary owner/staff merchant operations, including IPOS. Profile/status remains readable for support. Their owner's customer/rider account roles are not overwritten or suspended. Existing orders are not automatically cancelled/refunded; admin must handle active fulfilment before disabling a shop.
- Customer discovery/checkout continues to require active approval. A merchant cannot reactivate an admin-disabled shop by switching online; going online additionally requires a saved active status.

## Compatibility and rollout

Legacy approve/suspend/reactivate endpoints and stored statuses are retained. Backend must be released together with the new frontend copy and order-flow changes. Previously installed native apps need a new build for inline rider assignment and waiting-for-packing screens. No production records are modified by implementing this policy.
