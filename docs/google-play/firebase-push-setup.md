# Firebase Android Push Setup

## Project and Scope

On 14 October 2026, the owner requested setup under
`syedtassaduqhussainabidi@gmail.com`. That account could not select the existing
Google-login Cloud project, so a dedicated push-only Firebase project was created:

- Name: SirfBazar Notifications
- Project ID: `sirfbazar-notifications`
- Project number / FCM sender ID: `209308494306`
- Plan verified in console: Spark, no-cost ($0/month)
- Analytics and Gemini toggles disabled during creation; no billing account linked
- Android packages: `pk.sirfbazar.customer`, `pk.sirfbazar.merchant`, `pk.sirfbazar.rider`

Existing OAuth clients in project `453311658725`, API auth configuration,
WhatsApp OTP, databases and production services were not changed. Firebase
Authentication is not replacing SirfBazar authentication.

## Client Configuration

Each mobile app includes the Firebase-generated `google-services.json` and sets
`expo.android.googleServicesFile`. These files contain public application
identifiers, not service-account private keys. Expo prebuild applies the native
Google Services configuration; `expo-notifications` already provides the messaging
integration. No replacement notification SDK or package was installed.

Remediation builds change the package to `.remediation` and deliberately omit
production Firebase configuration. Configure a separate test Firebase app before
testing push on those isolated packages.

The existing Google login helpers explicitly retain the original web OAuth client
ID. Do not add replacement Google sign-in clients through this push-only project.

## Server Credential

With explicit owner approval, created
`sirfbazar-expo-push@sirfbazar-notifications.iam.gserviceaccount.com`
and assigned only the Firebase Cloud Messaging API Admin role. No delegates were
added. Its private JSON key is held in the owner's ACL-restricted directory outside
Git and APKs. The download was moved out of Downloads. Do not use the broader
Firebase Admin SDK service-agent credential.

Verified in Expo's Android credentials manager that all three existing projects
(`sirfbazar-customer`, `sirfbazar-merchant`, `sirfbazar-rider`) have this service
account assigned for FCM V1, with project ID `sirfbazar-notifications` and client
ID `109202422341205863434`. Signing keystores and Play submission credentials
were not changed. Real-device delivery and order-opening checks subsequently
passed for all three build-10 apps, as recorded below.

## Checks

- `node --test scripts/test-firebase-native.cjs scripts/test-google-native.cjs`:
  24 passed, including package/project matching and remediation separation.
- Firebase configuration tests added to CI.
- Customer tests: 58 passed (full `npm test`, including tab-root regressions).
- Merchant tests: 7 app tests and 3 push-lifecycle tests passed.
- Rider tests: 8 app tests and 5 push-lifecycle tests passed.
- TypeScript `--noEmit`: all three mobile apps passed.
- Merchant/rider notification-navigation regressions: 16 passed.
- CI run `38466454320` on source `f95110a`: all required checks passed,
  including `release-checks`; API deployment skipped for the pull request.

## Device Verification

Build 9 from `cba3b438d4277396e8bf9615b8d3e165a1599751` compiled for all three
apps. Each AAB and generated APK passed expected-package/version, release signer,
target SDK 36, bundle validation, 16-KB ELF and APK ZIP alignment checks. Customer
and merchant installed as updates on Samsung Galaxy A52 / Android 14, preserving
the demo sessions. Rider build 9 was verified but not installed.

Customer native logs reported `FirebaseApp initialization successful`. Its phone
alerts control confirmed registration; a read-only, demo-scoped backend query
confirmed one Android registration each for customer and merchant, without
printing tokens. Customer native checkout created isolated COD fixture
`SB20261013-E7FBAC` for Rs 190. Android displayed both the customer "Order placed"
and merchant "New order received" remote notifications. Merchant acceptance then
produced a customer background "Order accepted" notification; tapping it opened
the correct customer tracking screen. Screenshot:
`output/customer-build9-push-opened-order.png` (local, ignored).

The merchant tap opened its dashboard instead of the order. Source inspection
found no merchant/rider notification-response handlers. Commit `47d5434` adds
role/scope/session-checked navigation, API ownership/assignment verification,
navigation-ready handling, duplicate suppression and unmount cancellation.
All 16 new navigation tests and both apps' existing tests/typechecks passed.

The customer test also found that opening Notifications before Account could
replace the tab's initial screen. Commit `f95110a` preserves the normal tab root
for cross-tab and native notification navigation. Three new regressions and the
customer typecheck passed, in addition to its 55 existing tests.
Replacement build-10 installed-device checks passed on Samsung Galaxy A52,
Android 14. ADB confirmed versionCode 10, versionName 1.0.0 and target SDK 36
for all three packages. They installed as updates without clearing app data.

| Check | Observed result |
| --- | --- |
| Customer registration/logout/login | Demo token count changed from 1 to 0 on explicit logout, then back to 1 after reviewer sign-in; merchant registration remained 1 |
| Rider registration | Existing Profile > Location & alerts > Review notification access control registered the demo rider; backend count became 1 |
| Rider background push and tap | Assigning demo order `SB20261013-E7FBAC` sent a real Android alert; tapping opened that assigned delivery, with pickup blocked while packing |
| Merchant background push and tap | One-shot, empty-cart, demo-only COD fixture `SB20261013-9E3DA3` (Rs 190) produced a real alert; tapping opened that exact order instead of the dashboard |
| Customer background push and cold open | Accepting `SB20261013-9E3DA3` produced a real alert; tapping opened the matching tracking screen after the app update |
| Customer navigation roots | Back from tracking returned to My orders; Home > Order updates > Back returned to the Account profile |

Only isolated review data was mutated. No real delivery, cash collection,
payment processing, API deployment or database migration was performed.
`E7FBAC` is preparing and assigned to the review rider; `9E3DA3` is preparing
and unassigned. The one-shot fixture helper refuses repeat execution and logs
no credentials. These are test fixtures, not commercial sales.

Local ignored evidence: `output/customer-build10-push-opened-order.png`,
`output/merchant-build10-push-opened-order.png`, and
`output/rider-build10-push-opened-order.png`.

## Build 10 and Play Drafts

All three AABs and their generated APKs passed expected package/version, local
release signer, target SDK 36, bundle validation, 38 native ELF library 16-KB
alignment and APK ZIP alignment/signature checks. No signing password or private
FCM key was included in Git or the app artifacts.

| App | Source | AAB SHA-256 |
| --- | --- | --- |
| Customer | `f95110a` | `91446CEF96FFA03AA949EB4D64943E81C52F680E193880B7592B77627F8C1A82` |
| Merchant | `47d5434` | `036D106E4BF399B061928428FC0C4ED1E899B5DABA76CD3F2B615FB35CD5D2A2` |
| Rider | `f95110a` | `28C15C8B4A30D8DED74155F7406155000809C206A806E9D38097C2756D7071DF` |

Artifacts and verification JSON are under `output/aab10/`. The later customer
navigation commit does not change merchant source. Play Console processed and
saved build 10 as the sole artifact in each existing internal-testing draft,
named `1.0.0 (10) - Push-enabled review candidate`. Older artifacts were removed
only from the drafts and remain recoverable in Play's artifact library.

Screenshots: `output/play-customer-build10-draft.png`,
`output/play-merchant-build10-draft.png`, `output/play-rider-build10-draft.png`.
These are saved drafts, not rollouts, review submissions or public publication.

## Remaining Release Gates

The Firebase blocker is resolved. This does not certify every app feature or
Google Play-delivered signing: register/verify Play App Signing certificates in
the existing OAuth/Maps project, complete the remaining native review journeys,
finalize accurate Data safety, target audience, reviewer access and store listing
information, configure testers, and run the Play-delivered candidates before
production rollout. See `reviewer-access.md` and `data-safety-review.md`.

Rider registration was exercised through its explicit permissions control, not
automatic re-registration after reinstall/token rotation. Merchant/rider logout,
OS permission revocation, provider token rotation, offline recovery, account
deletion cleanup and additional device sizes were not physically retested here.
Automated lifecycle tests do not substitute for those installed-device checks.

## Revocation and Recovery

To stop this sender in an incident, disable only the dedicated
`sirfbazar-expo-push` service account in this project's Google Cloud IAM settings.
This affects Android push for all three apps, not Google login, WhatsApp OTP or
persisted in-app updates. Do not delete the project, unrelated service agents or
OAuth clients. Disable/remove the associated FCM credential in each Expo project
as appropriate. For normal rotation, provision a replacement with the same limited
role, update all three Expo assignments, verify delivery, then revoke the old key.

Reverting the mobile Firebase config requires rebuilding apps. Already-installed
APKs keep their bundled configuration. No database migration or API deployment is
required for this configuration-only integration.

References: [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/),
[Firebase Android setup](https://firebase.google.com/docs/android/setup).
