# Android Local-Key Candidates - 2026-10-08

The owner authorized new local release keys for all three applications, approved
the three corresponding Google Android registrations, and requested EAS rebuilds.
This is private APK testing, not a public/store release or backend deployment.

## Signing And Source

- Keys: `D:\keys\SirfBazar\sirfbazar-<app>-release.jks`; matching aliases.
- Google project `sirfbazar` / `453311658725`: all three new signers registered,
  existing 11 clients preserved (14 total). Public IDs/fingerprints are recorded
  in [the provider inventory](GOOGLE_OAUTH_CONFIGURATION.md).
- Added `release-keystore` to each `eas.json`, extending `preview` and setting
  Android `credentialsSource=local`. Internal APK, API
  `https://api.sirfbazar.com/api`, unchanged Web/iOS IDs, version 1.0.0/code 1.
- `preview`/`production` and old remote EAS signing credentials remain unchanged.
  Future builds must explicitly choose `release-keystore` to select these keys.
- `scripts/Start-SirfBazarReleaseBuild.ps1` validates all selected keys before
  queuing builds; default mode is validation only. Password read only from the
  owner-designated local file or secure prompts, never printed/passed as an arg.
  Temporary restricted `credentials.json` files are removed after submission.
  Keys/passwords go to the authorized EAS build service, not the source archive.
- EAS `tassaduq` projects are unchanged. Existing CLI 20.1.0 used, not upgraded.
- Current uncommitted working tree on `codex/google-login-completion`, Git base
  `6c316b065a5cda72b0fad509d1b76a5d70a4bf9b`; the commit alone does not reproduce
  the binaries. Nothing committed or pushed.
- Archive inspected at `output/apk-local-release-archive`: 160 native-app files;
  no local envs, keystores or credential/password files. Local development API
  configuration remains localhost.

## Builds

| App | Build ID | Status |
| --- | --- | --- |
| Customer | `0a65c321-3034-4f70-8db0-5cc840a91daf` | FINISHED; APK downloaded and verified |
| Merchant | `ea0d9ea7-19fa-42b9-8b89-c3883d541623` | FINISHED; APK downloaded and verified |
| Rider | `30cfde4c-d45b-4e73-a8ca-34942a75e483` | FINISHED; APK downloaded and verified |

All three submissions reported `Using local Android credentials (credentials.json)`.
Build records: `output/apk-local-release-20261008-145721` (Git-ignored).

### Downloads And Binary Verification

Verified 2026-10-08 at 10:11 UTC. All three artifacts are retained in the build
records directory above. EAS artifact links expire 2026-10-22; local copies remain.

| App | Download | Local filename | Bytes |
| --- | --- | --- | --- |
| Customer | [APK](https://expo.dev/artifacts/eas/23-oJtE8MVYwfXaGyV2JzrTV8pEW5tKBxaeXeasrs2Q.apk) | `sirfbazar-customer-local-release.apk` | 103077943 |
| Merchant | [APK](https://expo.dev/artifacts/eas/LNk5RrAQQLC_Udql-OASxzP3DVZRMbyUuWMnPIb34mo.apk) | `sirfbazar-merchant-local-release.apk` | 102592941 |
| Rider | [APK](https://expo.dev/artifacts/eas/KQTRfta8lHsQTf0_tpKvsyxJkkoLOYtOQjERCw7H9Xg.apk) | `sirfbazar-rider-local-release.apk` | 102256593 |

`scripts/Verify-SirfBazarApks.ps1` ran the installed Android SDK `apksigner` and
`aapt`. All three have one verified APK v2 signer matching the corresponding
new local public certificate, correct `pk.sirfbazar.<app>` package, version
1.0.0/code 1, and no debuggable flag. Results are saved as `verification.json`.
The verifier also correctly rejected an original EAS-key candidate as the wrong
signer (negative check); the original binary was not modified.

APK file SHA-256 values (not certificate fingerprints):

| App | APK SHA-256 |
| --- | --- |
| Customer | `47dfb27795e92b51d5010fd0b472acd7fbb7e837570071266f79853a9c535d24` |
| Merchant | `7c33e8879d8fff222195b9e3ae287e5f95fb4a5a1a3f94112f5f5660263ef87d` |
| Rider | `d90ed05386e9b81239c3d795a2200f829ba947eabe3237dbce0328e843f22309` |

All temporary local `credentials.json` files were confirmed absent after the
three submissions. The original password file remains where the owner placed it;
move that secret to a password manager rather than relying on plaintext storage.

## Checks And Remaining Gates

- PASS: each JKS private key can sign a CSR, expected alias and SHA-1 match.
- PASS: 35 API Google tests plus 38 client/native tests (73 total), and all three
  native typechecks. Tests use synthetic tokens/fake services, not live accounts.
- PASS: Google console creation confirmation for all three and final 14-client list.
- Device check: `adb devices -l` shows no connected Android device. No apps were
  installed, accounts logged in, or existing app data removed.
- Google remains External/Testing with the approved test user only. Consent
  publishing/branding is not completed by adding Android client registrations.
- Live Google-link API deployment, real login/linking, guest checkout/rider
  journeys, Maps certificate restrictions and separate audit F01 remain gates.
  No production API authentication/data mutations, migrations or deployments ran
  during APK creation. The API was subsequently deployed under separate approval;
  see [the activation record](API_DEPLOYMENT_ACTIVATION.md). Device journeys remain unverified.
- Prior Expo Doctor dependency/config warnings were not repaired by this signing
  change. Refer to [the original candidates](ANDROID_APK_CANDIDATES.md).

## Compatibility And Rollback

These signers differ from the original EAS candidates. They cannot normally
update those installed APKs in place. Do not uninstall a user's app to bypass
the mismatch without addressing local data loss. Packages have not been renamed.

Retain the old APKs and remote credentials. Rebuild the old signer using the
unchanged preview profile when appropriate; do not overwrite/delete either key
set or remove Google registrations as an automatic rollback. Migrating between
installed signers requires an explicit device/release plan. No Play signing-key
upgrade or store distribution was performed.
