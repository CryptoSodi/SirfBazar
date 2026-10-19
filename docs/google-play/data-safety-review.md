# Data safety evidence and submission record

## Submitted 14 October 2026

Separate questionnaires were imported, reviewed, saved and submitted with all
three production releases. Collection: Yes. Authentication: phone/other
authentication and OAuth. Account deletion URL:
`https://www.sirfbazar.com/account-deletion`. No independent audit, automatic
90-day erasure or partial deletion without account deletion was claimed.

Customer declares 16 types: name, email, photos, user IDs, phone, address,
approximate and precise location, purchase history, other messages, interactions,
search history, user-generated content, crash logs, diagnostics and device IDs.
Merchant declares 12: name, email, photos, device IDs, user IDs, phone, address,
precise location, other financial information, interactions, search history and
user-generated content. Rider declares 11: name, email, photos, device IDs,
user IDs, phone, other personal information (vehicle), precise location, other
financial information, messages and interactions.

Customer Maps SDK approximate location, interactions, crash/diagnostic data and
device identifiers were included as shared, with functionality/analytics purposes.
Other handling distinguished user-directed fulfillment/public shop information
and service-provider processing using Google's sharing definitions. No native
advertising or Firebase Analytics collection was inferred from website analytics.
Per-type answers are retained in local ignored `output/play-data-safety-*.csv`.

Encryption in transit was answered Yes for Google's device-to-server disclosure:
final bundle configuration uses the production HTTPS API, target-36 release
manifests have no cleartext override, and relevant SDK guidance was reviewed.
This is configuration/documentation evidence, not packet-capture verification or
a claim that the separate API-to-WhatsApp HTTP connection has been repaired.
That unresolved security finding remains recorded in the transport report.
No completed manual erasure test or Play-installed verification is claimed.

## Historical inspection (superseded submission status)

Inspected 2026-10-13 against source commit
`6463f3cc05b6bca2f4da5228a58bec2461551d41`.
This is a starting inventory for three separate Play questionnaires, not a
completed policy or a claim that every possible SDK data flow was verified.

| Data / purpose | Apps / evidence | Outstanding verification |
| --- | --- | --- |
| Name, phone, email, Google subject, profile image; authentication/account | All; `apps/api/prisma/schema.prisma` User model and `apps/api/src/auth` | Reconcile optional/required fields by login route, provider processing, retention and deletion |
| Delivery addresses and precise coordinates; serviceability and fulfillment | Customer; CustomerAddress/GuestSession schema, `apps/customer-app/lib/location.ts` | Verify guest persistence, recipients, permission-denied path and deletion |
| Shop address/contact, coordinates and photo; merchant setup | Merchant; `screens/OnboardScreen.tsx`, API merchant module | Review public shop information separately from private owner information and image metadata |
| Vehicle and shop affiliation; rider onboarding/profile | Rider; `screens/RiderProfileScreen.tsx`, API rider module and schema | Confirm exact fields collected by active onboarding; a schema field alone does not prove collection |
| Precise location, speed, heading during assigned delivery | Rider; `screens/RiderDeliveryScreen.tsx` sends `/rider/location` only for focused foreground active assignments | Test pause/resume/logout, permission changes, recipients and stored history; do not claim background tracking |
| Orders, payment/COD records, refunds, settlement information | Relevant roles; Customer/Order/Payment/Refund models and API orders/payments/settlements modules | Separate purchase history from financial details; verify real providers and legally required retention |
| Support messages and related order references | All role-specific support flows and API support module | Confirm attachments, recipients, retention and deletion handling |
| Expo push token and platform; notification delivery | All; each app's `lib/push.ts`, API `notifications/expo-push.service.ts`, PushToken schema | Dedicated Firebase project and all three Expo FCM V1 assignments verified on 14 October; real background delivery and order-opening observed in all three build-10 apps. Customer logout removed its token and re-login restored registration without changing merchant registration. Expo and Google FCM carry delivery tokens and notification payloads; no Firebase Analytics enabled. Merchant/rider logout, deletion cleanup and token rotation still need device verification; classify identifiers accurately before submission. See `firebase-push-setup.md` |
| Diagnostics, logs and SDK/network metadata | Not exhaustively verified | Inspect bundled SDK behavior and deployment logging before asserting no collection |

## Declaration rules for this release

### Transport finding - 14 October 2026

The live API uses HTTP for its remote WhatsApp OTP connection. A credential-free
HTTPS check from the API host timed out. The owner declined production changes;
configuration, services and WhatsApp state were left untouched. See the
[transport blocker and declaration qualification](otp-transport-blocker-2026-10-14.md)
for evidence, risk and the approval-gated remediation plan. Do not infer a Play
encryption checkbox answer solely from this backend hop; the draft answer remains
unanswered and app/SDK/provider transport coverage is not complete.

### SDK follow-up - 14 October 2026

The new push/Maps candidates require SDK collection in addition to first-party
API storage. Firebase Analytics being disabled does not mean no SDK metadata is
collected. The [Firebase Android disclosure guide](https://firebase.google.com/docs/android/play-data-disclosure)
documents FCM app-version/user-agent metadata and its Installations dependency,
which generates a per-installation identifier. It states listed data uses HTTPS;
that does not establish encryption for every other app/provider path.

The [Maps Android disclosure guide](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure)
documents request/device metadata, SDK identifiers, IP addresses, SDK diagnostics
and map interaction data as applicable. Include those flows when classifying the
customer app. Verify the actual bundled versions/configuration and their handling
before answering the collection, purpose, sharing and deletion questions.

Customer Data safety has only a partial saved Console draft: collection Yes,
phone/other authentication plus OAuth, and the account-deletion URL. Per-type
handling and security answers remain incomplete. Merchant/rider submissions were
not completed. No independent security audit or completed erasure test is claimed.

### Release rules

- Assess each app independently. Website analytics are not automatically evidence
  that the native apps collect the same analytics.
- API storage and third-party processing matter, not only device permissions.
- Distinguish collection from sharing using Google's definitions and exemptions;
  do not automatically mark every service provider as either shared or exempt.
- Do not claim data is deleted while the backend merely sets account status.
- Do not promise a retention duration until the operator has confirmed it and
  the fulfillment mechanism implements it.
- Do not claim no precise-location collection: coordinates are used in the
  customer/merchant location flows and active rider delivery.
- Validate encryption in transit against the final bundle and all providers,
  rather than assuming the main HTTPS API proves every network path.
- Google OAuth public availability and Play signing certificates need separate
  verification; successful local release-key login does not verify a Play build.

## Minimum deletion test plan before submission

1. Customer, merchant owner/staff and rider can discover and initiate a verified
   request; unauthenticated web users have a documented identity-verification path.
2. Cross-user requests cannot read, alter or erase another account's data.
3. Duplicate/retried requests are safe and yield an accurate status.
4. Sessions, device registrations and provider links are revoked/removed as defined.
5. Personal fields and associated data are erased or anonymized according to the
   approved policy, including uploaded assets and service-provider obligations.
6. Active orders, refunds, balances, merchant ownership and staff membership are
   handled explicitly without corrupting shared records or silently abandoning work.
7. Retained transaction/security records have a disclosed purpose, bounded retention
   and restricted access; backups have a defined expiry and restoration procedure.
8. UI and public policy accurately describe pending fulfillment versus completed
   deletion. Test only dedicated disposable fixtures, not real production accounts.
