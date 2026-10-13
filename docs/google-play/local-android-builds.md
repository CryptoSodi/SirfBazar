# Local Windows Android release builds

Cloud EAS builds were blocked by the account's free Android quota on 13 October
2026. The owner authorised local builds with the existing release keys. This
path uses Expo native generation plus Gradle, not unsupported Windows EAS-local.

## Prerequisites and boundaries

- Existing Android Studio JDK, Android SDK, accepted SDK licences and installed
  app dependencies matching each app's committed package-lock.json.
- PowerShell 7, Node, Git, tar and robocopy on PATH.
- The existing three release keys in `D:\keys\SirfBazar`; no new key generation.
- Sufficient free disk and memory for native compilation. Builds are sequential.
- Standard Expo/Gradle/Google build dependencies may download on the first build.
- No production database writes, package upgrades, Play upload or store submission.

The script extracts only the selected app from an exact Git commit into ignored
`output/aab<VERSION>/<role>`. It copies local dependencies and generates native
projects there. Working app sources and local `.env` files are not modified or
copied. Public release environment comes from each app's existing EAS preview
profile. Do not change local development API settings for this build.

## Build

```powershell
rtk proxy pwsh -NoProfile -File scripts/Build-SirfBazarLocalAndroid.ps1 `
  -App all -VersionCode 6 -SourceCommit <reviewed-commit>
```

The script prompts for the existing shared key password. Where the owner has
provided a private local password file, pass `-PasswordFile <absolute-path>`.
Never put its contents in the command line, source, build metadata or GitHub.
Different per-key passwords can be supplied by running each app separately.

Use `-App customer`, `merchant` or `rider` for separate runs. `-Resume` reuses an
existing build only when its recorded source commit and version match. It does
not delete native output, migrate data, change EAS credentials or sign with the
default Android debug key. The release-signing overlay requires all three
environment settings and cannot silently fall back to a debug signer.

For an unsubmitted candidate, `-Resume -RefreshConfig` may advance a snapshot to
a reviewed commit only when the app's sole changed tracked file is `app.json`.
It reapplies native generation, preserving compiler caches. Other source or lock
changes are rejected and require a fresh version directory. Never run two builds
against the same app snapshot simultaneously.

Passwords are passed only in the Gradle child environment and redacted from
captured output. Gradle uses a single-use daemon. Run builds on a trusted machine:
same-user processes and build dependencies can access process secrets.

Version codes are explicit. EAS auto-increment is not consulted or updated by
this script. The failed cloud attempt already reserved customer code 5; local
candidates use code 6 for each package. Before any later build or upload, check
Play and EAS state and choose a higher unused code. Never overwrite a published
version or assume the APK release's code is the latest store code.

## Artifact verification

The official Google bundletool JAR is kept in ignored output, not committed.
Version 1.18.3 SHA-256:
`a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.
Source: <https://github.com/google/bundletool/releases/tag/1.18.3>.

```powershell
rtk proxy pwsh -NoProfile -File scripts/Test-SirfBazarAndroidBundle.ps1 `
  -App customer -VersionCode 6 `
  -Bundle output/aab6/sirfbazar-customer-v1.0.0-build6.aab
```

Repeat for merchant and rider. The validator checks the signed JAR, expected
release certificate, bundletool structure, package, versionCode, target SDK,
non-debug manifest and every packaged arm64/x86_64 ELF LOAD segment's 16 KB
alignment. Merchant must not request microphone permission. It writes public
manifest and JSON verification records beside the AAB.

Add `-ApkPasswordFile <existing-private-file>` to also export a locally signed
universal APK for device testing. Bundletool reads the private file directly;
the password itself is never a command-line value. The validator checks the APK's
expected signer and 16 KB ZIP alignment. It refuses to overwrite existing APKs
or APK sets. These sideloadable test APKs do not prove Play-delivered signing.

Passing these checks does not prove generated APK ZIP alignment, 16 KB device
execution, correct UI or Google sign-in with Play's distribution certificate.
Perform those checks on the appropriate Play testing track before production.
Keep native screenshots genuine; do not substitute listing graphics or black
emulator captures. No Play publication should be inferred from an artifact file.

Reference: [Expo local production builds](https://docs.expo.dev/guides/local-app-production/).
