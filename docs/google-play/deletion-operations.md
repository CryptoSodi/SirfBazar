# Account deletion operations and retention baseline

Prepared 13 October 2026 following the owner's direction to use customary
retention practices. **Implementation target, not evidence of enforcement.**
There is no single cross-app standard and these periods do not establish legal
compliance. Confirm the applicable tax/recordkeeping rules with the operator's
adviser before purging financial evidence.

## Selected operational targets

| Record/action | Baseline | Release condition |
| --- | --- | --- |
| Verified account/data deletion request | Complete within 30 calendar days of verification; explain a necessary legal/transaction hold and give a revised date | Named support operator, verified identity and tested fulfillment checklist |
| Ordinary security/request logs | Rolling 90 days; minimise/redact personal fields; documented incident holds are exceptions | Verify actual app, proxy and provider log settings |
| Routine backups containing erased personal data | Expire within 90 days after live erasure; no routine access; reapply deletion records before a restore can serve traffic | Inventory backups and implement scoped retention without removing held recovery evidence |
| Financial/tax evidence | Retain the minimum required evidence for six years after the relevant tax period where the Pakistan sales-tax rule applies; longer only for a documented legal obligation or proceeding | Determine applicability and separate retained evidence from ordinary profile and location data |
| Live profile, saved addresses, Google profile, push registrations, personal uploads | Erase/anonymize within the request processing target unless a specific documented exception applies | End-to-end disposable-account test across every related store |

The 30/90-day values are chosen service targets, not claims about competitors or
statutory deadlines. FBR describes six-year retention for registered persons'
sales-tax records: [FBR sales-tax records](https://www.fbr.gov.pk/categ/sales-tax-records/51148/50854/%20121153).
Do not use this as a reason to retain every user's profile for six years.

## Support workflow

1. Receive requests at `support@sirfbazar.com`, assign a private case reference,
   acknowledge receipt and track requested roles, verification and due date.
   Public descriptions and case logs must never contain passwords or OTPs.
2. Verify account control through an existing verified channel. A matching email
   claim alone is insufficient. Do not ask for a sign-in code or identity-document
   copy by ordinary email. Escalate lost-channel requests for careful review.
3. Resolve the single User identity and all linked customer, owner, staff and
   rider relationships. Explain whether a request covers the whole identity or
   one role. Do not disable every role when only a shop membership was requested.
4. Check active orders, delivery assignments, unpaid settlements, wallet balances,
   open refunds/disputes and merchant ownership. Resolve obligations or record a
   scoped hold; do not silently cancel orders or erase another party's records.
5. Produce a record-by-record erasure/retention plan. A qualified operator must
   review it before any write. Ordinary support staff must not receive database
   credentials or run ad-hoc broad DELETE statements.
6. Perform approved erasure in a transaction where possible, revoke sessions and
   remove device registrations, remove owned uploads safely, and request provider
   erasure where required. Retained financial evidence needs restricted access,
   a purpose, expiry and a legal-hold flag, not unrestricted profile visibility.
7. Independently verify the result, record counts/outcomes without copying erased
   personal details into the audit log, and confirm completion or explain retained
   categories and their end dates to the requester.
8. Track backup expiry and downstream erasure. Before restoring a backup, replay
   completed erasure cases so deleted personal data is not reintroduced.

## Source-specific inventory for the fulfillment implementation

- Prisma `User`, `Customer`, `CustomerAddress`, `Rider`, `Merchant`, `MerchantStaff`:
  shared identity and ownership require explicit handling, not cascading deletion.
- SQL-managed `GoogleAccountProfile`: not present as a Prisma model; removing
  `User.googleId` alone leaves a verified profile snapshot behind.
- `RefreshToken`, `PushToken`, `WebPushSubscription`, `OtpCode`, notifications and
  session-registration rows: enumerate tokens without printing their values.
- Carts, guest sessions, reviews, rider location history, support tickets/messages,
  order notes, timeline text and audit payloads: can contain personal information.
- Payment/provider references, orders, refunds, settlements and POS-trial identity:
  distinguish minimum retained evidence from data that can be anonymized.
- Public images, private merchant documents, provider messages, proxy logs,
  monitoring stores, database dumps and off-server backups need separate verification.

## Current enforcement gap

The existing `/customer/account` implementation only sets `User.status=DELETED`
and revokes refresh tokens. It is not a data-erasure operation. Updated customer
mobile UI therefore uses the support-request path instead of invoking that action.
The API remains backward-compatible for older clients; no live accounts were deleted.

The deployment runbook explicitly says old database backups are not automatically
removed. A 90-day promise must not be published as already operating until backup
inventory, exclusions and the retention job are verified. No destructive retention
job or production data mutation was performed for this release preparation.

Before declaring deletion ready, execute this procedure on disposable identities
for all three roles, including an identity with multiple roles, record the evidence,
and reconcile public policy wording. A support link alone does not pass this gate.
