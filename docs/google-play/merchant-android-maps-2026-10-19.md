# Merchant Android map repair - 19 October 2026

## Source update and finding

Pulled `origin/master` through `d09448e` into the current work branch before
implementation (local merge `68eb026`). Existing uncommitted release work was
stashed including untracked files, then restored without conflicts. Nothing was
pushed or deployed by this pull.

Both the released Merchant build-10 source and the pulled master lacked
`react-native-maps`, a native Maps key, and a rendered map. Onboarding only used
GPS to show a coordinate label. The previous Maps repair covered Customer only.

The requested better-interface/better-* skills were not installed; used the
available frontend-design-guidelines workflow, existing merchant theme, Lucide
icons, accessible controls and a native interface review instead. Compared an
inline onboarding map with a full-screen modal: the modal preserves the long
CNIC/hours form and is reusable for an existing shop.

## Implementation and states

- SDK-54/customer-compatible `react-native-maps` 1.20.1; no framework replacement.
- Setup opens a full-screen native map; tap or drag chooses a draft. Confirm
  returns the pin without resetting the remaining form; Cancel changes nothing.
- More / Shop location loads the current merchant profile. Owner or STORE staff
  on an approved shop can edit. Confirming a draft is local; Save explicitly sends
  only latitude/longitude to existing `PUT /merchant/profile`. Backend ownership
  and STORE authorization remain authoritative. No API/schema changes.
- Camera fallback is not a selected location. GPS is requested only on tap,
  handles denial, disabled services and a 15-second fix timeout. Stale results
  cannot replace a later selection or update an unmounted picker.
- Tile loading has a 20-second notice, Retry and manual coordinate fallback.
  Blank/out-of-range/nonfinite coordinates are rejected; zero is valid.
- Existing written address, CNIC upload, operating hours, POS choice, auth,
  package/signing identity and Firebase configuration remain unchanged.
- Production Android config rejects absent/malformed Maps keys. Local builds
  accept the merchant-specific private key file. Do not supply the customer key
  when building Merchant, or use one role's file with `-App all`.

## Cloud configuration

Owner approved a new key in existing project `sirfbazar` (453311658725).
Created `SirfBazar Merchant Android Maps`, resource
`bd9d6c55-d48f-4c18-b1f3-47f7873ede99`, restricted to Maps SDK for Android only
and `pk.sirfbazar.merchant` with these SHA-1 certificates:

| Signer | SHA-1 |
| --- | --- |
| Machine debug | `08:92:E3:BA:8C:FA:F3:45:D2:DC:CB:AC:DC:43:60:A2:D3:B4:90:EC` |
| Existing local release | `FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58` |
| Recorded Google Play | `9D:71:12:A1:75:24:D5:E9:7B:EC:76:8E:FD:7B:65:02:6F:8E:71:41` |

Reopened the saved key and verified the one API and all three Android entries.
The value is outside Git in the existing owner/SYSTEM-only private Maps folder.
Evidence: ignored `output/merchant-maps-key-restrictions.png`. Other keys, billing,
IAM and enabled APIs were not changed. EAS environment values were not changed.

## Verification

- Merchant TypeScript: passed.
- Merchant tests including coordinate/onboarding checks: 13 passed.
- Customer/Merchant Maps configuration tests: 7 passed.
- Merchant map/settings interaction tests: 10 passed, using mocked native/network
  adapters (draft/explicit save, cancel, owner/staff gating, failed save retry,
  duplicate-submit guard, camera-not-selection, permission denial, GPS timeout,
  stale/unmounted GPS responses and key-free manual fallback).
- Native Google sign-in, Firebase configuration and policy regressions: 38 passed.
- Signed Merchant build 12: Gradle succeeded, 697 tasks; existing release signer.
  Bundle validation, native Maps metadata, embedded R8 mapping, native-library
  16 KB ELF checks and APK signature/16 KB ZIP alignment passed. R8 metadata:
  obfuscation 83.14%, optimization 82.72%, shrinking 82.95%.
- Installed signed APK on API 36.1 emulator and signed in with the isolated
  merchant reviewer account. Real Google tiles loaded at the saved demo pin;
  no Maps authorization/fatal error appeared in the inspected app process log.
- Native interface review: map tiles, tap-to-select, Confirm returning a local
  draft, and Cancel preserving the prior draft passed. Leaving/reopening settings
  reloaded the unchanged server pin: no shop-location PUT was performed during
  this live smoke test. The Save contract/retry behavior was tested with mocks.
- Native screenshots reviewed at default 1080x2400 and 720x1280 / density 320
  (360x640 logical): map attribution, heading, coordinates and controls fit.
  Manual coordinate controls also fit at the small size. Physical-keyboard
  emulator input was used; an actual soft-keyboard layout was not verified.
- Session survived force-stop/relaunch. Emulator display overrides were reset
  and the test emulator stopped. A transient black frame during display-density
  change was resolved by relaunch, not a Maps authorization failure.
- Real device and Google Play-delivered map: not verified.

Evidence (ignored): `output/merchant-build12-map-loaded.png`,
`output/merchant-build12-map-selected.png`,
`output/merchant-build12-map-confirmed-draft.png`,
`output/merchant-build12-map-cancelled.png`,
`output/merchant-build12-map-small.png`, and
`output/merchant-build12-map-small-coordinates.png`.

Artifacts under `output/aab12/`:

- `sirfbazar-merchant-v1.0.0-build12.aab` SHA-256:
  `656917D5AB681767A9E0622D151A2DAF89B565521BD90B74FB98B38EAD2CA4A8`.
- Matching APK SHA-256:
  `3F441024B32DB1AED60D9FD265CAE9B395EA6CD6E707E28A847C1117F65B2F49`.
- Working-source fingerprint:
  `ACF25830230AC72910471A98DA47FC6422FE09C72228455E2B2666F7FE03136C`.
- Adjacent verification JSON and mapping files are retained. The source commit
  alone does not include the uncommitted fix; use its recorded working fingerprint.

No Git push, production API restart or database migration was performed. EAS
builds still require their own merchant-specific key variable.

## Play release follow-up

On the owner's subsequent request to publish, verified that the current Merchant
source inventory and AAB hash still match build 12. Reused this already-built,
signed, tested candidate instead of rebuilding identical source. Re-ran Merchant
typecheck and the 13 Maps configuration/interaction tests: passed.

Uploaded the AAB to Merchant Production and saved
`1.0.0 (12) - Merchant maps and optimization`, with 100% rollout to all existing
targeted countries. Google attached the mapping and native symbols. Preview
estimates 13.8 MB for a new install (11.4 MB smaller), and a 4.07 MB update.
One nonblocking compatibility warning: Google's OpenGL ES 2.0 requirement removes
CHAINWAY C66 support; Play reports zero affected installs. Other form factors
show no lost devices. Package/version, min SDK 24, target SDK 36 and four ABIs
were accepted. No listing, country, secret, billing or policy changes were made.

Google's quick checks completed successfully. The Console has repeatedly closed
the Send changes for review confirmation without retaining a submitted state,
including after refresh and both semantic/keyboard confirmation. No visible
error was returned. The latest authoritative state remains **Changes not yet
submitted for review**; do not claim publication or a review submission until
the Console shows it. The saved build 12 remains intact. This is separate from
the subsequently deployed website Maps configuration repair.

## Build and rollback

Build separately using `Build-SirfBazarLocalAndroid.ps1 -App merchant
-VersionCode 12 -WorkingTree -AndroidMapsKeyFile <private-merchant-key-file>`
with the existing release password input/file. Validate with
`Test-SirfBazarAndroidBundle.ps1 -App merchant -VersionCode 12 -RequireMaps
-RequireOptimization` and supply its AAB and release-password file.

Native Maps cannot be added to an already-installed APK by an API deployment.
Install/publish the rebuilt binary. Keep matching signed bundles, mapping and
verification records. Rollback is a new higher-version build from the previous
reviewed source; do not rotate signing keys or overwrite customer/website keys.
No production API or database mutation is required for this fix.
