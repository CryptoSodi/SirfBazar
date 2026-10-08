# Google OAuth Configuration Evidence

Verified 2026-10-08 in Google Cloud project `sirfbazar` (`453311658725`).
This records public client IDs/certificate fingerprints, not credentials. No
client secret or private key is required in the application source.

## Identity And Configuration

| App | Android package | iOS bundle ID | iOS OAuth client ID |
| --- | --- | --- | --- |
| Customer | `pk.sirfbazar.customer` | `pk.sirfbazar.customer` | `453311658725-16h5ooes2sp3g4o27hr6vrdt1am7hsgt.apps.googleusercontent.com` |
| Merchant | `pk.sirfbazar.merchant` | `pk.sirfbazar.merchant` | `453311658725-6h8ucua4jvfopqrb6utj1ail4vaphki4.apps.googleusercontent.com` |
| Rider | `pk.sirfbazar.rider` | `pk.sirfbazar.rider` | `453311658725-vask2pqmgpb023vhs3jm0l0u8hr7h96i.apps.googleusercontent.com` |

Identifiers were confirmed from `app.json`, actual resolved Expo configuration
and every existing EAS profile. No package/bundle rename was needed. The three
iOS registrations were created with approval. All native development, preview and
production profiles now supply their correct iOS ID and the shared Web audience:

`453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com`

`app.config.js` derives each reversed callback scheme. Local ignored `.env` files
and tracked `.env.example` files match. Release API URLs and signing settings were
preserved. Remediation builds retain their explicit `.remediation` suffix; these
different identities are not covered by the registrations in this report.

## Android Signing Coverage

All entries below use the corresponding package in the table above. Existing
default EAS certificates were inspected read-only using the already-authenticated
EAS CLI's production-profile credential overview; no keys were changed/downloaded.

| App / signing candidate | SHA-1 | Google status |
| --- | --- | --- |
| Customer default EAS | `8B:55:82:A2:39:59:F9:34:E9:A3:CE:87:41:CB:F8:0E:1F:5A:F0:81` | Existing registration preserved; matches EAS default `fgAsjM62ic` |
| Merchant default EAS | `7B:BA:ED:F5:8C:90:B1:0A:04:08:9D:A1:A6:DE:46:77:34:A5:39:5F` | Existing registration preserved; matches EAS default `w-arzmQxfl` |
| Rider default EAS | `36:C8:CC:48:2E:64:51:5C:91:0F:05:77:F7:18:DD:0D:D1:A3:A2:8C` | Existing registration preserved; matches EAS default `epjvRKEb4S` |
| Customer additional EAS | `02:DC:2A:12:08:79:72:C7:37:5B:57:63:71:9E:3C:C9:0B:6C:14:A4` | Approved registration created; stored candidate `z6CeJHlfJD`, not claimed as active production |
| All three packages / machine debug | `08:92:E3:BA:8C:FA:F3:45:D2:DC:CB:AC:DC:43:60:A2:D3:B4:90:EC` | Three approved registrations created; certificate read from this machine's standard `.android/debug.keystore` |

Android client IDs are inventory only. The SDK requests the shared Web audience,
not one of these Android client IDs:

| Registration | OAuth client ID |
| --- | --- |
| Existing customer | `453311658725-h75t757s8260fnd1j99oqgthlovlui4p.apps.googleusercontent.com` |
| Existing merchant | `453311658725-bo26qvjro5vppbrgcinkgpg2s44r686e.apps.googleusercontent.com` |
| Existing rider | `453311658725-d4e2ss3k24vqvde0nrda5r94jbc4dhk6.apps.googleusercontent.com` |
| Customer machine debug | `453311658725-guir7cpqfe4n2ioqf7u4bhhhgl8osj5v.apps.googleusercontent.com` |
| Merchant machine debug | `453311658725-e9659htarjdpdvp3fboansj479jih9pg.apps.googleusercontent.com` |
| Rider machine debug | `453311658725-ugt4uovlum4618enbg18ofed1falrr7t.apps.googleusercontent.com` |
| Customer alternate EAS | `453311658725-5en9mcnban7s46hl2345jptuft7jpd32.apps.googleusercontent.com` |

### Debug And Store Limitations

The installed Expo SDK 54 prebuild implementation selects
`expo-template-bare-minimum@sdk-54`. The official registry tarball resolved to
`54.0.53`; read-only inspection of its `android/app/build.gradle` and bundled
`debug.keystore` found SHA-1:

`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

That is a shared, publicly distributed development key, different from this
machine's key. It was NOT registered or copied into the repository. Do not claim
that default Expo-generated debug builds use the approved machine key. Before
device testing, inspect the actual Gradle signing report/APK certificate, use a
controlled registered key, or obtain explicit approval for any additional
package/certificate registration. Never ship a shared debug key as release signing.

At initial provider setup no current release APK/AAB was available locally. In
the subsequently approved [APK candidate build](ANDROID_APK_CANDIDATES.md), all
three release-signed Android APKs were built, downloaded and verified using
`apksigner`: their actual certificate SHA-1 values match the default EAS/Google
registrations above. No additional release registration was needed. These are
direct-download testing candidates, not proof of a prior public release.

Google Play may re-sign artifacts with its app-signing certificate; those
certificates remain unverified. No Play Console change or public store submission
was performed. iOS does not use Android SHA-1 registration. Firebase/App Check
configuration was not changed.

## Owner-Managed Release Keys (2026-10-08)

After the original APK candidates, the owner created three separate JKS files
under `D:\keys\SirfBazar` and approved registering all three new signers. Each
alias is `sirfbazar-<app>-release`. Password/private-key validation and public
fingerprints were checked locally without printing the supplied password.

| Package | New SHA-1 | New Android OAuth client ID |
| --- | --- | --- |
| `pk.sirfbazar.customer` | `9F:67:B7:7D:B1:8A:32:31:E2:33:78:A8:56:1F:48:94:93:92:A3:A0` | `453311658725-c30koas27eucep83kljov7ptfg624ach.apps.googleusercontent.com` |
| `pk.sirfbazar.merchant` | `FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58` | `453311658725-a22rasv820dbhvh151kh3fnsjn4pdm3d.apps.googleusercontent.com` |
| `pk.sirfbazar.rider` | `A1:42:B2:57:E3:C4:97:5F:21:FF:DF:24:93:6B:7A:13:E1:D8:5B:33` | `453311658725-tfjdbqbt6r40mg7udtrhnuqpclj4qnch.apps.googleusercontent.com` |

The console confirmed creation and lists 14 clients (previously 11). Names are
`SirfBazar <App> Android Release - Local 2026`. Existing Android/iOS/Web clients,
debug coverage, scopes, audience/test users, IAM and secrets were not modified.
These Android client IDs remain inventory only; the SDK Web audience is unchanged.
Screenshot evidence: `output/google-release-oauth-clients.jpg` (Git-ignored).

The new `release-keystore` EAS profile uses local credentials and inherits the
internal APK preview profile. Old remote credentials/default profiles remain
available; using `preview` or `production` does NOT select the new keys. See
[local release candidates](ANDROID_LOCAL_RELEASE_CANDIDATES.md) for actual binary
verification and the unchanged device/production release gates.

## Web And Consent

The existing Web client now has 11 JavaScript origins. Four original origins were
preserved: `https://sirfbazar.com`, `https://www.sirfbazar.com`,
`https://admin.sirfbazar.com`, `https://shop.sirfbazar.com`.

Seven approved additions were saved: `https://pos.sirfbazar.com`,
`http://localhost`, `http://localhost:3000`, `http://localhost:5173`,
`http://localhost:5174`, `http://localhost:5175`, `http://127.0.0.1:5194`.
No redirect URI, scope, IAM permission or secret was changed. The local merchant
preview now reaches Google's SirfBazar account chooser, resolving its observed
`origin_mismatch`. The popup was closed without obtaining a token/API session.

The approved owner account was added as the sole OAuth test user. The console
confirmed `1 user (1 test, 0 other)`. Audience remains **External / Testing**;
the app was not published. Branding has app name `SirfBazar`, an existing support
email, developer contact and authorized domain `sirfbazar.com`. Homepage,
privacy-policy and terms links are blank; Audience disables Publish until
Branding is completed. No policy text, legal acceptance or publishing was invented.

## Verification And Next Steps

- PASS: 35 API Google tests and 38 native/client tests (73 total), using synthetic
  signatures and fake SDK/transport/database fixtures, not live authentication.
- PASS: all three native typechecks and actual Expo config resolution in separate
  processes, confirming distinct per-app iOS callback schemes and unchanged IDs.
- PASS: local env files ignored by Git; `git diff --check`.
- The subsequent APK candidates have verified package names/signatures; see their
  release note for downloads, checksums and Expo compatibility warnings.
- Remaining: approved consent completion/public publishing, Play certificates
  where applicable, and real login/linking in an isolated API/DB and on devices.
  The later approved API deployment now exposes the Google-link endpoint and
  uses real Google verification. The owner confirmed successful customer-web
  Google login; other client/role/linking journeys remain unverified. See
  [activation evidence](API_DEPLOYMENT_ACTIVATION.md).
- The separate P0 registration finding F01 remains a release gate. See the
  [implementation report](GOOGLE_LOGIN_IMPLEMENTATION.md) for other limitations.

Provider changes are additive. Any rollback should target only the newly added
origins/registrations with separate approval; preserve original Web/release
clients, signing keys and user links. Client rollback guidance remains in the
[setup guide](../google-login.md). The code and API deployment were subsequently
pushed under separate owner approval; provider publishing remains incomplete.
