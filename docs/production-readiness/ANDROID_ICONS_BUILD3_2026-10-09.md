# Android Icon Build 3 - 9 October 2026

## Scope And Source

The owner requested integration of the approved Customer basket, Merchant
storefront and Rider scooter icons and new Android builds. Only Android icon
configuration and its assets changed in the applications. Package names,
version 1.0.0, release signing keys, Google settings, API settings, permissions,
in-app design, splash screens and iOS configuration were preserved.

Base commit: `848da0e09ae5d9049ec44625dedcfdecd3aaa7c5`, plus the uncommitted
icon changes in this workspace. The EAS commit field alone does not describe
these builds. `output/android-icons-2026-10-09-build3/source-inputs.json` records
SHA-256 hashes for the 39 app configuration, dependency-lock and icon input
files. All were rechecked unchanged after submission. See
[icon integration](../design/ANDROID_APP_ICONS.md) for design provenance.

Existing remote version codes were explicitly advanced from 2 to 3. All builds
used the existing `release-keystore` profile on the `tassaduq` EAS account and
target `https://api.sirfbazar.com/api`. No API deployment, source push, GitHub
release publication, Google Play submission or phone installation occurred.

## APKs

| App | EAS build | Download | Bytes |
| --- | --- | --- | --- |
| Customer | `7264d6f2-1aff-4b50-837e-5108f3c9f4b9` | [APK](https://expo.dev/artifacts/eas/OnJonbuERVmv1WYOSHUrIXnS4525Uk99CQeUB3thRCU.apk) | 103132370 |
| Merchant | `db2122a6-e34b-4dbc-8ac4-fc6836f8ed12` | [APK](https://expo.dev/artifacts/eas/w6JZ4eoT4fMvYfgu2H2kdzJ5X7KtpC3h8MtTKZJhD2U.apk) | 102654448 |
| Rider | `0cb86f3e-eebd-4bef-88e0-477efab4ee22` | [APK](https://expo.dev/artifacts/eas/ycXb_0R-BAsbKfChQ_pTm-opegEWcBhVYMMzzkXqqnA.apk) | 102337284 |

Local copies: `output/android-icons-2026-10-09-build3/sirfbazar-<role>-v1.0.0-build3.apk`.
That Git-ignored folder also contains checksums, sanitized build records,
signature verification, extracted icon resources and pixel-comparison evidence.
Expo artifact URLs are not a permanent GitHub release.

| App | APK SHA-256 |
| --- | --- |
| Customer | `1bbb4d5daaf83ea7927fee828205a714a1bea33adaddd3f04b45136d02b8480a` |
| Merchant | `83808888fb4fbbcca425514d477addf91a98f3fe6cb316da1cdf5d4761f6af3d` |
| Rider | `61172b16d66186877c686596a16b46678078a927db94a8dc60659037b7347dc8` |

## Executed Verification

- All three native typechecks passed. Seven launcher-icon regression tests passed.
- All three EAS builds finished successfully with version 1.0.0 / code 3.
- Each APK has the expected `pk.sirfbazar.<role>` package, one valid v2 signer,
  no debuggable flag and the same dedicated release certificate as build 2.
- APK ZIP alignment passed `zipalign -c -P 16 4`. This is not an ELF-library
  16KiB compatibility certification.
- Compiled manifests select the launcher and round launcher resources. Both
  adaptive XML resources reference the correct foreground, background and
  monochrome layers in each APK, including high-density raster resources.
- Extracted foreground and monochrome silhouettes overlap their source artwork
  by over 99.95%; average alpha error is below 0.14/255 after resizing. Backgrounds
  are exactly opaque #009966. The extracted-image family was visually inspected.
- Source previews were reviewed at 64/48/32px, in circle/squircle masks and light/
  dark monochrome treatments. All roles remain distinguishable.
- Temporary `credentials.json` files were removed after submission. No keys,
  passwords or credentials are included in Git or release outputs.

## Limits And Upgrade Notes

No device installation or Google/OTP/checkout/delivery smoke test was performed
for build 3. These are testing APKs, not a new production-readiness certification.
Existing audit gates and dependency findings remain unaffected.

Build 2 uses the same package/signing identity and is eligible for an in-place
update; this specific upgrade has not been tested on a device. Earlier APKs
signed with other keys cannot update in place. Do not remove their local data
without owner approval. For icon rollback, restore only the icon configuration
and issue a higher-version build using the same release keys.
