# Android Push Configuration Audit

Historical baseline: the owner subsequently authorized a dedicated project under
the requested Google account. See [Firebase setup progress](firebase-push-setup.md)
for changes after this read-only audit.

Read-only audit: 14 October 2026. Firebase setup was stopped at the owner's
request. No Firebase resources, credentials, billing settings or production
configuration were changed during this audit.

## Conclusion

Notification implementation already exists, but Android push is not configured
end-to-end for the current SirfBazar projects and release candidates. This is not
evidence that no historical setup exists in any other account.

## Existing Implementation

- All three native `lib/push.ts` modules obtain an Expo push token using their
  EAS project ID and register it through `/notifications/push-token`.
- `apps/api/src/notifications/expo-push.service.ts` sends through Expo's push
  service, not a direct Firebase backend integration.
- Persisted in-app order updates worked during physical-device testing. Those
  updates do not demonstrate background Android push delivery.
- No `android.googleServicesFile` is configured in any of the three `app.json`
  files. No Firebase configuration file was found in the inspected native build
  candidates or the searched local Git history. These searches cannot establish
  the contents of inaccessible repositories or accounts.

## Remote EAS Inspection

Signed-in EAS account: `tassaduq`. Ran `eas credentials --platform android`,
selected `production`, read the summary, and exited without entering credential
management. No keys were downloaded, uploaded or modified.

| Project | Android package | FCM Legacy | FCM V1 service account |
| --- | --- | --- | --- |
| sirfbazar-customer | pk.sirfbazar.customer | None assigned yet | None assigned yet |
| sirfbazar-merchant | pk.sirfbazar.merchant | None assigned yet | None assigned yet |
| sirfbazar-rider | pk.sirfbazar.rider | None assigned yet | None assigned yet |

Existing Android signing keystores are distinct from push credentials.

## Firebase Console Inspection

| Signed-in account | Observed result |
| --- | --- |
| tassaduq009@gmail.com | No Firebase projects listed. Existing Google Cloud project `sirfbazar` was offered for adding Firebase; setup was closed before billing confirmation. |
| syedtassaduqhussainabidi@gmail.com | One Firebase project, `battle-cities-84acd`, with four non-SirfBazar Android packages; no SirfBazar package registered. |
| sirfbazar@gmail.com | No Firebase projects listed. |
| battlecities1975@gmail.com | No Firebase projects listed. |
| ludocities@gmail.com | Inventory inaccessible: Google requires the owner to enable MFA. No account security settings were changed. |

Project listings are limited to each account's current access. They do not prove
that a project was never created, deleted or shared differently in the past.

## Physical Device Evidence

Samsung Galaxy A52, Android 14: customer build 8, merchant build 6, rider build 8.
Android notification permission was granted for all three apps. Customer
"Enable phone alerts" failed to register. Its filtered process log reported:

```text
Default FirebaseApp failed to initialize because no default options were found.
FirebaseApp initialization unsuccessful
```

Local ignored screenshot: `output/review-customer-push-registration-failed.png`.
Actual device push delivery is not verified and must not be marked successful.

## Next Steps, Not Executed

1. If the owner believes the setup is under `ludocities@gmail.com`, have the owner
   complete Google's MFA requirement, then inspect that account before creating
   anything new.
2. Reuse a verified existing SirfBazar Firebase project if found; otherwise obtain
   approval for the necessary setup on the existing `sirfbazar` Cloud project.
3. Configure each package's Android Firebase file and appropriate FCM credentials
   for its existing Expo project. Credential creation/upload needs separate
   approval; do not commit private service-account keys.
4. Rebuild signed candidates and verify registration, foreground/background
   delivery, notification navigation and logout/account-switch cleanup.
