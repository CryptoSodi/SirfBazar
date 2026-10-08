# Android APK Candidates - 2026-10-08

Owner authorized downloadable, release-signed **testing APKs for all three apps**.
This is not a Google Play submission or a public production rollout.

## Build Configuration

- Existing EAS account/projects: `tassaduq/sirfbazar-customer`,
  `tassaduq/sirfbazar-merchant`, `tassaduq/sirfbazar-rider`.
- Existing `preview` profiles: internal distribution, Android APK, bundled JS,
  no development client/Metro requirement; version `1.0.0`, version code `1`.
- API target: `https://api.sirfbazar.com/api`, explicitly provided by each profile.
  Local development `.env` files remain pointed at localhost and were not uploaded.
- Command: `eas build --platform android --profile preview --non-interactive
  --freeze-credentials --no-wait --message "...private testing only" --json`.
- Existing remote signing credentials reused: customer `fgAsjM62ic`, merchant
  `w-arzmQxfl`, rider `epjvRKEb4S`. No private keys generated, replaced or downloaded.
  These are saved EAS keystores, not evidence of a prior public APK release.
- Native package names and Google Web/iOS identifiers were preserved. Existing
  default EAS SHA-1 values already have matching Google Android registrations.
  See [provider inventory](GOOGLE_OAUTH_CONFIGURATION.md).

## Source Provenance

The build includes the current **uncommitted** Google-login changes on
`codex/google-login-completion`. EAS reports Git base
`6c316b065a5cda72b0fad509d1b76a5d70a4bf9b`; that commit alone does NOT reproduce
these APKs. No Git commit or push was performed.

Added root `.easignore` to restrict EAS uploads to the three standalone native
apps and exclude local envs, private keys, node_modules and generated artifacts.
The archive was inspected before upload: 160 files, about 2.55 MiB uncompressed
and 1.1 MB uploaded. API/server source, scraped data and local credentials were
not included. Native manifests, lockfiles, assets and new Google components were
confirmed present. No packages were installed for this build request.

Local inspected source tree:
`output/apk-release-2026-10-08/mobile-archive-verified` (Git-ignored).

Source-manifest SHA-256:
`cd7b21ffa4404f2eeb9863e0410791f363c741b4f2e8c95a5bde1255ef766425`.
Computed over JSON of path/SHA-256 pairs sorted by relative path, with forward
slashes. This is a source snapshot checksum, not an Android signing certificate.

## Builds

| App | EAS build | Status |
| --- | --- | --- |
| Customer | [adcdd614-6733-44b8-9cb5-dd6c6cd40785](https://expo.dev/accounts/tassaduq/projects/sirfbazar-customer/builds/adcdd614-6733-44b8-9cb5-dd6c6cd40785) | FINISHED; APK downloaded and verified |
| Merchant | [cfe5231b-553c-4e32-bd95-aa0edc965101](https://expo.dev/accounts/tassaduq/projects/sirfbazar-merchant/builds/cfe5231b-553c-4e32-bd95-aa0edc965101) | FINISHED; APK downloaded and verified |
| Rider | [12ae7dd4-b4e6-43c1-8c6a-4973e86a903a](https://expo.dev/accounts/tassaduq/projects/sirfbazar-rider/builds/12ae7dd4-b4e6-43c1-8c6a-4973e86a903a) | FINISHED; APK downloaded and verified |

EAS reports artifact expiration on 2026-10-22. Local copies are retained in the
Git-ignored `output/apk-release-2026-10-08/` directory:

| App | Download | Local filename | Bytes |
| --- | --- | --- | --- |
| Customer | [APK](https://expo.dev/artifacts/eas/nqhFdzHz2x7ql7gh6W5MFUl2GRuvh_xZPsrmgF5H9Aw.apk) | `sirfbazar-customer-1.0.0-1.apk` | 103077943 |
| Merchant | [APK](https://expo.dev/artifacts/eas/ec7yWGSR2VkkuZDux5XTizNjqMRdkz4qGoErplVSM8A.apk) | `sirfbazar-merchant-1.0.0-1.apk` | 102592941 |
| Rider | [APK](https://expo.dev/artifacts/eas/eK2AHDAcMWjniylqUIeo-JpLF6qsIkaxYs4sGQAGJnU.apk) | `sirfbazar-rider-1.0.0-1.apk` | 102256593 |

The machine's default DNS could not resolve Expo's `wf-artifacts.eascdn.net`.
Google public DNS returned `104.18.0.204`; downloads used a request-local curl
resolution override with normal HTTPS validation. No DNS/hosts settings or
certificate checks were changed. All downloads completed successfully.

### Binary Verification

Android SDK `apksigner verify --verbose --print-certs` passed for all three:
one signer, APK signature scheme v2 verified, certificate SHA-1 exactly matching
the corresponding default EAS/Google registration in the provider inventory.
`aapt dump badging` confirmed `pk.sirfbazar.customer`, `pk.sirfbazar.merchant` and
`pk.sirfbazar.rider`, each version `1.0.0` / code `1`, non-debuggable. No new OAuth
registration or signing key was necessary for these actual APK certificates.

APK file SHA-256 values (not signing-certificate fingerprints):

| App | APK SHA-256 |
| --- | --- |
| Customer | `b82d75842b0477020b7ce5a5eb86b29f50285faef4abc74140ebfb6fd7b07417` |
| Merchant | `fa76b7341cd4739af8500139dd1b02ce173bb658fc0a47a17be266cfe307a4f9` |
| Rider | `0b7b76e3b1bdc71bf8528c39a50437fdae0e3e72cf248b37835c13900870f477` |

Machine-readable verification results are saved beside the APKs in
`verification.json`. Signature verification does not establish runtime/device
login success; no app was installed on a user's device during this task.

## Verification And Limits

- Existing native suites rerun: customer 45, merchant 7 plus 3 push lifecycle,
  rider 3 push lifecycle tests, all PASS. The preceding Google batch passed 73
  focused tests and all three native typechecks.
- EAS Expo Doctor: 16/18 checks passed in each app; compilation continued.
  All three report the static/dynamic config check. The source explicitly clones
  `app.json` and tests verify preservation of IDs and settings; this warning was
  not silenced. Customer also reports duplicate `expo-constants` versions
  `18.0.13`/`18.0.14`. Merchant/rider report Expo `54.0.35` versus recommended
  `~54.0.37`, and React Native `0.81.4` versus `0.81.5`. Dependencies were not
  upgraded mid-build; these compatibility warnings remain release follow-up.
- Public API schema read with GET only: `/api/auth/google-login` and
  `/api/orders/quote` present; `/api/auth/google-link` absent. The new linking
  control requires the matching backend release, which was NOT deployed here.
- No production login, OTP, checkout, order, payment or database mutation ran.
  A schema entry alone does not verify the live Google provider configuration.
- Consent remains External/Testing with one approved test user. Branding and
  public publishing are incomplete. Do not distribute these as fully verified
  Google-login production apps.
- Device login/linking, guest checkout and rider journeys remain unverified on
  these actual binaries. The separate audit P0 finding F01 remains a public
  release gate. Use controlled accounts; these APKs point at the live API.
- No Play Console publishing, app-signing-key change, backend deployment, DNS
  change or auto-deployment activation was performed. Play-re-signed APKs would
  require checking Google's separate app-signing certificate.

## Installation And Rollback

Install the relevant APK directly on an Android device for controlled testing.
Do not uninstall an existing app merely to bypass an incompatible signature or
version warning; that can delete local data. Investigate the existing signer and
version first. These builds keep the real package names, not a side-by-side test
suffix. Preserve the previous tested binary and avoid distributing candidates
until device checks and the compatible API release are complete.

For build-profile mechanics, see [Expo's APK documentation](https://docs.expo.dev/build-reference/apk/).
