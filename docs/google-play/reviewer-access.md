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

Normal roles/ownership checks remain. A closed controller allowlist additionally
denies identity changes, linking, onboarding, staff/rider creation, uploads,
public ratings, support submission, coupons, POS and online payments. Review
inventory updates affect only the demo shop. COD records demonstrate the flow;
no actual cash or delivery is involved. Review orders cannot generate settlements
or payouts. Administrators still see the explicitly named demo shop/orders;
exclude these from manual business reports.

Disclose these restrictions in Play App access instructions. This does not prove
every restricted capability is reviewable: Google may request additional access.
Never claim unrestricted access or conceal differences from ordinary accounts.

## Security and Expiry

- Three distinct random six-digit codes, bcrypt cost 12. No codes in Git, logs,
  API responses or WhatsApp messages.
- Send code creates a single-use challenge; the existing TTL, resend cooldown,
  hourly request cap and atomic per-challenge attempt counter still apply.
- A persistent 20-attempt rolling 24-hour review limit covers successful and
  failed verification attempts across resends, serialized in PostgreSQL.
- Both `PLAY_REVIEW_ENABLED=true` and future `PLAY_REVIEW_EXPIRES_AT` are required.
  Missing, malformed or expired configuration fails closed.
- Preparation defaults to 90 days. Renew before future submissions. Google needs
  working access throughout review; do not expire/disable it during active review.
- HTTP authentication, refresh rotation and realtime emissions recheck access.
  Refresh sessions cannot outlive the configured expiry.

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

Local checks passed: API typecheck, eight review-control unit tests, 69 existing
remediation unit tests and a disposable PostgreSQL lifecycle covering real auth,
replay/cooldown, normal OTP delivery, both-direction cart isolation, merge rollback,
catalogue filtering, quoted checkout, merchant fulfillment, rider delivery,
settlement rejection, provisioning retry, daily limits and session revocation.
CI includes both new test files. Native/Play-installed UI journeys are separate.

Pending: protected PR/release, production activation, private credential storage,
fixture-only live verification and saved Play App access instructions.
