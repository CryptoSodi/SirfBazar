# Play signing and reviewer follow-up - 14 October 2026

Status: partial release readiness. No Play rollout or review submission.

## Completed OAuth registrations

The owner approved all three Android registrations in `sirfbazar`
(`453311658725`). Console access used `tassaduq009@gmail.com`. Each creation
returned a success dialog; the client list showed all three entries. Existing
clients, scopes, keys, IAM, Firebase and production API services were preserved.

| Package | Google Play signing SHA-1 | New OAuth client ID |
| --- | --- | --- |
| `pk.sirfbazar.customer` | `36:24:71:D3:51:82:F5:B7:C2:CC:CE:B8:51:BE:15:24:6F:68:B7:02` | `453311658725-k66d05hlc55cnk8v2lapjgq8ljfpnelo.apps.googleusercontent.com` |
| `pk.sirfbazar.merchant` | `9D:71:12:A1:75:24:D5:E9:7B:EC:76:8E:FD:7B:65:02:6F:8E:71:41` | `453311658725-thqi7dntck7vrea82e4kb59k6okbs0ou.apps.googleusercontent.com` |
| `pk.sirfbazar.rider` | `81:8B:7E:53:6D:E9:43:CF:A1:F1:FA:29:04:CF:3F:93:60:53:5A:59` | `453311658725-tkbm7k72u0bq1hccogn2l6tk5c7fkq9i.apps.googleusercontent.com` |

Local proof: ignored `output/play-signing-oauth-created.png`. These Android
client IDs do not replace the Web/server client ID used for ID-token verification.
Successful Play-installed login and any additional Play certificates remain
unverified.

The creation dialog reports OAuth Testing; Data access showed no scope rows.
Do not infer that basic Google sign-in necessarily requires a test-user allowlist:
[Google documents an exception for basic identity-only scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
Verify the actual requested scopes and Play-installed behavior. No audience or
publishing changes were made.

## Additional device checks

Samsung SM-A525F / Android 14, customer build 10, isolated review account:

- Profile editor loaded the existing demo name and `review@example.invalid`.
  Saving unchanged details returned to Account without a visible error.
- Saved-address list and editor loaded the isolated Lahore fixture. Saving
  unchanged fields returned to the list on build 10. No real phone location was
  requested and no address was deleted.
- The customer submitted one clearly marked demo support request. The native
  app opened its persisted conversation with status OPEN and the submitted
  text. No real delivery or support assistance was requested. Evidence:
  `output/review-customer-support-created.png`.
- Confirm on map produced a blank Google map: failed reviewer journey.
- Android diagnostics at 02:45 on 14 October reported an API-token error with
  `StatusCode=INVALID_ARGUMENT` and Maps SDK `Authorization failure`.
  Key values were redacted from the filtered diagnostic output.

Local proof: ignored `output/review-customer-profile-save-check.png` and
`output/review-customer-demo-map.png`.

## Maps repair

Before the repair, the native Maps key in `apps/customer-app/app.json` differed
from the available Maps Platform API Key in project `sirfbazar`, and
`app.config.js` had no Maps key environment override. The inspected shared cloud
key allows 33 APIs, including Maps SDK
for Android, and has no application restriction. Its value is not recorded here;
the shared key was not changed or reused. The embedded key's owner and original
reason for rejection remain unknown.

Owner approval received and key created: a separate Maps SDK for Android-only key,
restricted to `pk.sirfbazar.customer` and verified debug, local-release and Play
certificates, then rebuild and retest customer. Preserve the website key and
billing account; no additional APIs or paid terms were enabled. Key resource
`37fc74ef-e610-46b6-a431-3d17ea7951f1`, named `SirfBazar Customer Android Maps`,
was verified after creation with exactly one API and three customer certificate
restrictions. Its value is held outside Git in the owner/SYSTEM-only directory
`C:\Users\tassa\.codex\private\SirfBazar-maps`. Screenshot:
`output/customer-maps-key-restrictions.png` (ignored).

The hardcoded key was removed; `app.config.js` reads
`EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`, validates its format and refuses a
production Android build without it. Local release tooling accepts
`-AndroidMapsKeyFile` and redacts the value from command output. EAS environment
configuration was not changed. The isolated remediation package does not receive
the production key.

Customer build 11 from `e9da68ddd31da03703f1a36c3d083517ec30e1da` compiled
successfully and passed bundle/package/version/target-SDK validation, the expected
release certificate, 38 native-library 16-KB alignment checks and APK ZIP checks.
It installed as a data-preserving update on the Samsung SM-A525F / Android 14.
The existing review session and isolated catalogue remained available.

- AAB SHA-256: `31A8132BDEF2D74894F9A7AB4CD67BD49946107C0EF63ADF98DAABD8EDDA7F1D`.
- APK SHA-256: `2FAA6A0BE1E7893C459B5BF5F09B76784A2B64E8842CA4F0654B5A6999E7C0D2`.
- Files: ignored `output/aab11/sirfbazar-customer-v1.0.0-build11.{aab,apk}`;
  adjacent verification JSON files record automated artifact checks.
- The map loaded real tiles around the saved Lahore demo coordinates. Filtered
  logs for the new process contained no Maps authorization/token errors.
  Evidence: `output/review-customer-build11-map-loaded.png`.
- Confirm pin returned to the editor and preserved the written address. A
  subsequent save was rejected because the address belongs to an active order;
  the explicit error said the address was retained. This is not a successful
  post-confirmation save test. No replacement address or live delivery was made.
- Local-release rendering is verified, not Play-delivered Maps/Google login or
  every map interaction, permission state and network-failure path.

## Play declarations

Customer Dashboard showed 7/11 initial tasks complete. Sign in details requires
a full-feature-access checkbox before adding credentials. It was not checked;
the temporary unsaved selection was discarded. No reviewer credentials or false
full-access certification were submitted during this follow-up.

Customer Data safety was saved as an incomplete draft; Console confirmed saved:
collection Yes, account creation Username and other authentication plus OAuth,
and deletion-request URL `https://www.sirfbazar.com/account-deletion`.
Encryption, partial-data deletion and per-type collection/sharing/handling remain
unanswered. No audit badge was claimed. Merchant/rider forms were not changed.
Proof: ignored `output/play-customer-data-safety-partial-draft.png`.

## Remaining gates

1. Verify Maps and Google login on a Play-delivered build; local-release Maps
   rendering passed and customer build 11 is saved in the internal draft.
2. Complete remaining native reviewer rating, inventory/upload and revision coverage;
   retain qualifications in `reviewer-access.md`.
3. Complete evidence-backed Data safety for each app and verify manual deletion
   fulfillment separately from the existence of the request link.
4. Save accurate reviewer instructions, target audience and genuine screenshots.
5. Verify Play-installed Google login, Maps and signing coverage before release.

Customer build 11 is the sole bundle in its saved internal-testing draft, named
`1.0.0 (11) - Maps and push review candidate`; Console confirmed Changes saved.
Build 10 was removed only from this draft and remains in the artifact library.
Merchant/rider build 10 drafts were not replaced. Proof:
`output/play-customer-build11-saved.png`. No rollout or review submission occurred.
No new automated tests were run for the
initial console-only changes. After the Maps configuration repair, all 28 focused
tests passed (`test-customer-maps-config.cjs`, `test-google-native.cjs`,
`test-firebase-native.cjs`). The new Maps tests are included in CI. The device
checks above are not full acceptance coverage.
