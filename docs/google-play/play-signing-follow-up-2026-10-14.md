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
- Saved-address list and editor loaded the isolated Lahore fixture. No real
  phone location was requested and no address was deleted.
- Confirm on map produced a blank Google map: failed reviewer journey.
- Android diagnostics at 02:45 on 14 October reported an API-token error with
  `StatusCode=INVALID_ARGUMENT` and Maps SDK `Authorization failure`.
  Key values were redacted from the filtered diagnostic output.

Local proof: ignored `output/review-customer-profile-save-check.png` and
`output/review-customer-demo-map.png`.

## Maps repair

The native Maps key in `apps/customer-app/app.json` differs from the available
Maps Platform API Key in project `sirfbazar`. `app.config.js` has no Maps key
environment override. The inspected cloud key allows 33 APIs, including Maps SDK
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
the production key. Rebuild and device verification remain in progress.

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

1. Finish approved Maps repair and device verification.
2. Complete native reviewer support, inventory/upload and revision coverage;
   retain qualifications in `reviewer-access.md`.
3. Complete evidence-backed Data safety for each app and verify manual deletion
   fulfillment separately from the existence of the request link.
4. Save accurate reviewer instructions, target audience and genuine screenshots.
5. Verify Play-installed Google login, Maps and signing coverage before release.

All three build-10 releases remain drafts. Customer build 10 cannot be certified
while Maps authorization fails. No new automated tests were run for the
initial console-only changes. After the Maps configuration repair, all 28 focused
tests passed (`test-customer-maps-config.cjs`, `test-google-native.cjs`,
`test-firebase-native.cjs`). The new Maps tests are included in CI. The device
checks above are not full acceptance coverage.
