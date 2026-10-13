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

Expo credential assignment and real-device delivery verification are pending;
creation of a key alone is not proof that push works.

## Checks

- `node --test scripts/test-firebase-native.cjs scripts/test-google-native.cjs`:
  24 passed, including package/project matching and remediation separation.
- Firebase configuration tests added to CI.
- Customer tests: 55 passed.
- Merchant tests: 7 app tests and 3 push-lifecycle tests passed.
- Rider tests: 8 app tests and 5 push-lifecycle tests passed.
- TypeScript `--noEmit`: all three mobile apps passed.
- Rebuilt native initialization, background delivery, tap navigation and
  session cleanup: pending.

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
