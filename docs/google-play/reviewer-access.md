# Google Play Reviewer Access

## Scope

Three immutable `play-review-v1-user-*` identities use the existing phone-code
screens. They share one isolated `play-review-v1-shop`, customer profile and rider.
No schema migration, replacement backend, universal OTP or mock payment provider
is involved. Normal Google and WhatsApp authentication remains unchanged.

Normal discovery excludes the demo shop, including direct shop URLs. Review
discovery returns only that shop. Cart add/update/merge and quoted checkout enforce
this boundary in both directions. Existing catalogue products are reused with
separate demo inventory; normal merchant stock is not changed.

Normal roles/ownership checks remain. Review accounts can edit their profiles,
manage addresses, inventory/imports/documents and demo team records, submit
ratings/support, redeem the isolated `PLAYREVIEW` coupon, receive notifications,
and use POS without a trial expiry. New team records use synthetic, suspended
identities, never a real user's login account. New catalogue records are scoped
to the demo merchant and cannot be listed by ordinary shops. Normal promotions
cannot be used by reviewers, and normal customers cannot use the demo coupon.
Use `review@example.invalid` when testing the shared customer's email field.

COD/POS records demonstrate the real order state machine using isolated data;
no actual cash or delivery is involved. Review orders cannot generate settlements
or payouts. Online checkout is COD-only for normal customers too. Shared review
identities cannot be attached to a personal Google account or reset through
ordinary registration; reviewers use the supplied phone/code instead of Google.
Administrators can see clearly identified demo records; exclude the demo shop
from business reports. Demo support submissions do not page the real support team.

The accounts are already onboarded, like existing approved merchants/riders.
Never claim Google linking, fresh onboarding, native screens or push delivery
have passed review testing based solely on backend tests. Complete the coverage
record below before signing the Play full-access declaration.

## Security and Revocation

- Three distinct random six-digit codes, bcrypt cost 12. No codes in Git, logs,
  API responses or WhatsApp messages.
- Send code creates a single-use challenge; the existing TTL, resend cooldown,
  hourly request cap and atomic per-challenge attempt counter still apply.
- A persistent 20-attempt rolling 24-hour review limit covers successful and
  failed verification attempts across resends, serialized in PostgreSQL.
- `PLAY_REVIEW_ENABLED=true` and valid bcrypt hashes are required. Missing or
  malformed configuration fails closed. On 13 October the owner approved
  reusable credentials with manual revocation instead of automatic expiry.
  The obsolete `PLAY_REVIEW_EXPIRES_AT` variable is no longer used.
- Review codes do not expire. Individual OTP challenges and JWT/refresh sessions
  retain ordinary expiry/rotation; reviewers may sign in again with the same code.
- HTTP authentication, refresh rotation and realtime emissions recheck access.
  Do not disable accounts during an active review or leave stale Play credentials.

## Activation

Deploy through the protected master PR and release gates, initially disabled.
Verify the running commit and database/configuration backup using
`docs/API-AUTO-DEPLOYMENT.md`. No database migration is required. On Battle
(`129.153.16.84`), prepare a NEW private directory:

```bash
sudo -u sirfbazar-api node /opt/sirfbazar-api/current/dist/auth/review-accounts-admin.js prepare --approved /var/lib/sirfbazar-api/play-review-20261013
```

This generates `review.env` (hashes only) and `review-credentials.json` (private
codes). Keep credentials private; provide them only to Play Console App access
and the owner's password manager, never GitHub. Preparation refuses overwrites.

Install `review.env` as `/etc/sirfbazar-review.env`, root-owned, group
`sirfbazar-api`, mode 0640. Add only this dedicated systemd drop-in at
`/etc/systemd/system/sirfbazar-api.service.d/30-play-review.conf`:

```ini
[Service]
EnvironmentFile=/etc/sirfbazar-review.env
```

Preserve `/etc/sirfbazar-api.env`, Google/WhatsApp settings and other services.
Run application code as the API user, not root:

```bash
sudo -u sirfbazar-api node --env-file=/etc/sirfbazar-api.env --env-file=/etc/sirfbazar-review.env /opt/sirfbazar-api/current/dist/auth/review-accounts-admin.js provision --approved
sudo systemctl daemon-reload
sudo systemctl restart sirfbazar-api.service
```

Provisioning is transactional and refuses identity conflicts. Repeating it does
not reset stock or erase orders, but deliberately reactivates review accounts.
Never put it in routine auto-deployment. Verify anonymous discovery, all three
logins and role isolation before entering credentials into Play. Use only the
demo shop and saved demo address for order tests, never real customer data.

## Disable Immediately

Connect from Windows:

```powershell
rtk proxy ssh -i "D:\Oracle\battle.key" ubuntu@129.153.16.84
```

Then run on the server:

```bash
sudo -u sirfbazar-api node --env-file=/etc/sirfbazar-api.env /opt/sirfbazar-api/current/dist/auth/review-accounts-admin.js disable --approved
```

This atomically suspends only the three review accounts, revokes all their refresh
sessions, consumes pending challenges, closes/suspends the demo shop and disables
its rider. Existing JWTs fail the next authentication check; sockets are checked
before each emission. Data is retained and `PLAY_REVIEW_DISABLED` is audited.
No service restart is needed for immediate account/session revocation.

Also set `PLAY_REVIEW_ENABLED=false` in `/etc/sirfbazar-review.env` and restart
only `sirfbazar-api.service` to leave the global switch off. Check:

```bash
sudo -u sirfbazar-api node --env-file=/etc/sirfbazar-api.env /opt/sirfbazar-api/current/dist/auth/review-accounts-admin.js status --approved
```

All three must be `SUSPENDED`; login and old tokens must fail. Update/remove stale
Play Console App access credentials. Deliberately renew/reactivate and verify
access before another review.

## Rollback

Disable accounts FIRST, keeping the shop suspended/offline and all sessions
revoked, before restoring a release without review isolation. Use the existing
immutable-release rollback procedure. Do not restore a database over current
orders, delete review history or enable mock OTP.

## Verification and Deployment Evidence

Local checks passed: API typecheck, nine review-control unit tests, 69 existing
remediation unit tests, 49 Google/import/POS tests and a disposable PostgreSQL lifecycle covering real auth,
replay/cooldown, normal OTP delivery, both-direction cart isolation, merge rollback,
catalogue filtering, quoted checkout, merchant fulfillment, rider delivery,
settlement rejection, provisioning retry, daily limits and session revocation.
The expanded lifecycle also verifies customer profile updates, support ownership,
ratings, demo coupon isolation, team creation without modifying real identities,
product/import isolation and retry, and POS entitlement/stock/idempotency.
CI includes both new test files. Native/Play-installed UI journeys are separate.

Pending: protected PR/release, production activation, private credential storage,
fixture-only live verification and saved Play App access instructions.

| Coverage | Backend evidence | Remaining review evidence |
| --- | --- | --- |
| Three phone/code logins and manual disable | Real bcrypt/JWT/PostgreSQL lifecycle | Live login and native login screens |
| Customer catalogue/cart/checkout/delivery | Isolated stock, quote, fulfillment and delivery assertions | Native browse/checkout/order views |
| Profile, addresses, ratings, support | Profile and support ownership, delivered-order rating; existing address regressions | Native edit/support/rating flows |
| Merchant inventory and imports | Create/preview/apply/retry and foreign-shop rejection | Native inventory controls; import is web-only where absent from APK |
| Rider/staff management | Synthetic suspended members; real user unchanged; tenant rejection | Merchant native rider controls |
| Rider delivery and issue reporting | Existing order state machine and owned support ticket service | Native tracking, issue reporting and delivery confirmation |
| POS | Non-expiring demo entitlement, real sale transaction, replay and stock isolation | POS browser flow; not a separate Play app |
| Documents and device notifications | Existing ownership/registration implementations, now allowed | Review-owned upload and actual device push verification |
| Identity/onboarding | Pre-onboarded accounts, personal Google linking intentionally unavailable on shared identities | Disclose review login method; do not certify untested identity flows |
