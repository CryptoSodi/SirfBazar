# Android GitHub Release - 9 October 2026

## Source And Distribution

- User request: pull master, rebuild customer/merchant/rider APKs, and upload them to a GitHub release.
- Clean source: `31901564fa16f95f7de04f399a8e64cec46ea659`, pulled with `git pull --ff-only origin master`.
- [Source CI 37877927249](https://github.com/CryptoSodi/SirfBazar/actions/runs/37877927249) passed all release gates and API deployment. Read-only Oracle status confirmed this same commit active before APK publication.
- [GitHub testing prerelease](https://github.com/CryptoSodi/SirfBazar/releases/tag/android-2026-10-09), tag `android-2026-10-09`, targets that exact source commit. Later README/report commits are documentation, not the APK source.
- Version `1.0.0`, Android version code `2` in every binary. EAS remote Android version codes were advanced from 1 to 2; source, package names, existing release keys and OAuth registrations were not changed.
- Existing EAS account/projects and `release-keystore` profiles were used. The profiles inherit the production API URL and registered Google IDs from `preview`, with local release signing credentials.
- All three APKs connect to `https://api.sirfbazar.com/api`. This release does not publish to Google Play or build iOS applications.

## Build Identity

| App | Package | EAS build ID | APK bytes |
| --- | --- | --- | --- |
| Customer | `pk.sirfbazar.customer` | `2c5f1359-47e7-42ff-ace9-b4651400b10a` | 103092575 |
| Merchant | `pk.sirfbazar.merchant` | `81aa2122-f294-4539-90d0-1a28519cb962` | 102610829 |
| Rider | `pk.sirfbazar.rider` | `ac878265-b78a-4461-b3c1-3a9b35125514` | 102289705 |

All EAS records reported FINISHED, the exact source commit, version 1.0.0/build 2,
and profile `release-keystore`. Binary verification completed at
`2026-10-09T04:15:03.9142724Z` (09:15 Pakistan time).

## Downloads And Checksums

GitHub release assets are retained independently of the temporary Expo artifact URLs.
The release also includes `SHA256SUMS.txt` and a sanitized `build-manifest.json`.

| App | Download | APK SHA-256 |
| --- | --- | --- |
| Customer | [APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-2026-10-09/sirfbazar-customer-v1.0.0-build2.apk) | `b9d095062b2cad52987bb4eb41439a29a31c6fe6fce77cc096a4c38c796b7603` |
| Merchant | [APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-2026-10-09/sirfbazar-merchant-v1.0.0-build2.apk) | `49d01516750c3e028aae77610c17df5ff447120b6f4c60c1bbfc442da7bd9d85` |
| Rider | [APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-2026-10-09/sirfbazar-rider-v1.0.0-build2.apk) | `198064d17336ff7b45de21f29110ea8dbc97652b3acd1fb605bbcf07404aefae` |

Local retained artifacts and non-secret build records are in
`output/android-release-2026-10-09` (Git-ignored). Only the three APKs, checksums
and sanitized manifest are uploaded as release assets, not keys, credentials,
provider sessions, private logs or passwords.

## Verification

- Fresh lockfile installs and all three native typechecks passed.
- Customer tests: 50 passed. Merchant: 7 authentication tests and 3 push-lifecycle tests passed. Rider: 3 session tests and 5 push-lifecycle tests passed.
- Shared native Google suite: 18 passed. Cross-app native session transport suite: 33 passed. These tests use fake services, not live credentials or production writes.
- `scripts/Verify-SirfBazarApks.ps1` passed for all three files: valid APK v2 signature, exactly one expected release signer, matching package, and no debuggable flag. The collector additionally required binary version 1.0.0/build 2 and recorded SHA-256 hashes.
- All five GitHub release assets were checked against local SHA-256 and byte counts before publication. After publication, unauthenticated HEAD requests to all three APK download links returned HTTP 200 with the expected sizes.
- Signer SHA-1 values match the release certificates registered on 8 October: customer `9F:67:B7:7D:B1:8A:32:31:E2:33:78:A8:56:1F:48:94:93:92:A3:A0`; merchant `FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58`; rider `A1:42:B2:57:E3:C4:97:5F:21:FF:DF:24:93:6B:7A:13:E1:D8:5B:33`.
- Temporary restricted `credentials.json` files were removed after each submission and confirmed absent from all three app directories. `.easignore` excludes credentials, key files, local environments and generated exports from the source archive.

## Remaining Gates

- No Android device was connected. Google/OTP sign-in, installed-app upgrade, checkout, GPS, notification lifecycle and rider delivery have not been tested on these binaries.
- The [9 October review](../reviews/2026-10-09-work-modification-final-review.md) records 16 moderate and 23 high native dependency advisories per app, plus provider/staging and device gaps. Packaging does not resolve or certify those findings.
- Google consent was last recorded as External/Testing; consent status and test-user access were not changed or re-audited during this build.
- Testing prerelease only. A successful build/signature check is not a public production-readiness certification.

## Upgrade And Rollback

Build 2 retains the package and signer of the 8 October local-release build 1.
The higher Android version code supports an in-place update with that same
signing identity; actual device upgrade remains unverified. Older candidates
signed with other EAS/debug keys cannot update in place. Do not uninstall an
existing app to bypass a signature mismatch without addressing local data loss.

Keep previous APKs and signing material. An older version code can be rejected
as a downgrade; normal rollback is a newly built, higher-version APK using the
same signer and a reviewed earlier source commit. Never rotate keys or erase app
data automatically as a rollback. No live configuration, database migration,
provider registration or Oracle service change was performed for these builds.
