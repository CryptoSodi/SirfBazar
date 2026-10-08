# SirfBazar Android Release Keystores

## Current Activation

The owner created all three named keystores on 2026-10-08. Their package/SHA-1
combinations are now registered in Google Cloud, preserving existing clients.
The `release-keystore` profile in each app uses these local keys for internal
testing APKs. Other profiles and remote EAS signing credentials are unchanged.
See [the candidate report](production-readiness/ANDROID_LOCAL_RELEASE_CANDIDATES.md).

Validate the existing keys with private interactive prompts:

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\Start-SirfBazarReleaseBuild.ps1
```

Add `-Submit` to queue all three EAS APK builds, or `-App customer` (merchant/rider)
to select one. An optional `-PasswordFile` accepts an explicitly selected local
file containing a shared password; its value is not printed. Prefer prompts or a
password manager for routine use. Do not commit, share or casually retain
plaintext password files. The existing owner-supplied file is not modified/deleted.

The build helper verifies aliases, private-key passwords and the three exact
approved fingerprints before submission. It temporarily creates an ACL-restricted,
Git/EAS-source-ignored `credentials.json`, reads the JKS directly from `D:\keys`,
then removes its own credential file in `finally`. It never overwrites an
existing credential file. A forcibly killed process can leave that temporary
file; check before restarting. EAS still receives signing material to sign the
cloud build; "local credentials" does not mean keys never leave this computer.
No store submission, backend deployment or remote-default replacement occurs.
This follows [Expo's local-credential mechanism](https://docs.expo.dev/app-signing/local-credentials/).

After downloading all three APKs with the filenames recorded in the candidate
report, verify them against the local public certificates:

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\Verify-SirfBazarApks.ps1 -Directory C:\repos\SirfBazar\output\apk-local-release-20261008-145721
```

The verifier checks APK signatures, signer fingerprints, packages and release
flags; it does not authenticate a Google account or alter a connected device.

## Create Dedicated Keys

Run with the installed PowerShell 7 on this Windows machine:

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\New-SirfBazarKeystores.ps1
```

Default destination: `D:\keys\SirfBazar`. Each app gets a distinct private key:

| App | Keystore | Key alias |
| --- | --- | --- |
| Customer | `sirfbazar-customer-release.jks` | `sirfbazar-customer-release` |
| Merchant | `sirfbazar-merchant-release.jks` | `sirfbazar-merchant-release` |
| Rider | `sirfbazar-rider-release.jks` | `sirfbazar-rider-release` |

The script prompts for a new password and confirmation for each app. Use a unique
password/passphrase of at least 12 characters. The key and store use the same
password for Android-tool compatibility. Manually chosen passwords are NOT saved;
put them in a password manager. Never send passwords/private keystores in chat.

To select one app, append `-App customer`, `-App merchant` or `-App rider`.
To preview paths without generating keys or asking for passwords, append `-WhatIf`.
Existing output files cause an error before generation; there is no overwrite
flag. Do not delete existing keys merely to rerun this script.

The script uses the installed JDK/Android Studio `keytool`: JKS, RSA 2048,
SHA256withRSA and 10,000-day validity. It exports a **public** `.certificate.pem`
and `.fingerprints.txt` for every private `.jks`. The fingerprints file contains
SHA-1/SHA-256; it does not contain a private key or password.

The newly created files have explicit Windows permissions for the current user
and SYSTEM. Existing keys and other projects under `D:\keys` are left alone.
Partial failures retain protected temporary output for recovery, never delete it
silently. Passwords are passed to keytool via its child-process environment, not
command arguments or source files. Privileged/local process inspection can still
access in-use credentials; this is not protection against a compromised machine.

## Optional Generated Passwords

Instead of choosing passwords interactively:

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\New-SirfBazarKeystores.ps1 -GeneratePasswords
```

Each password is independently generated from 32 cryptographically random bytes.
The script saves it as `sirfbazar-<app>-release.password.clixml`, encrypted with
Windows DPAPI for this Windows user on this computer. No plaintext password file
is created and passwords are not printed. That encrypted file alone is **not a
portable backup**. Before using these keys, back up the keystores securely and
store each password separately in a password manager accessible after machine loss.

To reveal a generated password locally (never run this in a recorded/shared
terminal), run the following and type `SHOW` when prompted:

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\Show-SirfBazarKeystorePassword.ps1 -App customer
```

Repeat with merchant/rider. The read script is not run automatically. Keep
`.jks`, `.password.clixml` and any future `credentials.json` out of Git and chats.

## Activation Is Separate

Creating these files does NOT upload keys to EAS, change EAS profiles, register
Google fingerprints, rebuild APKs or change any deployed service. The previously
built APKs remain signed with their existing EAS keys. Those distinct EAS keys
are not the standard machine/template debug keystore; the earlier APKs were
verified as non-debuggable release builds.

Before deliberately switching signing identities:

1. Back up the new keystores/passwords and inspect their exported fingerprints.
2. Add the new package/SHA-1 combinations to Google OAuth while preserving old
   registrations. Confirm any other certificate-restricted services, including
   Maps, for the new signers. iOS OAuth does not use Android SHA fingerprints.
3. Explicitly select/upload these credentials for the intended EAS build profile,
   or configure ignored local credentials. Do not silently replace remote defaults.
4. Rebuild and verify actual APK signatures, then test Google login on a device.
5. APKs signed with a different key cannot directly update the old candidates
   without a supported signing-key transition. Do not uninstall to work around
   that without accounting for local data loss. Play App Signing has distinct
   upload/app-signing keys and its own upgrade procedures.

No public release is implied. Consent publishing, backend Google-link deployment,
device verification and the audit release gates still apply.

References: [Android signing](https://developer.android.com/studio/publish/app-signing),
[keytool password input](https://docs.oracle.com/en/java/javase/21/docs/specs/man/keytool.html),
[EAS local credentials](https://docs.expo.dev/app-signing/local-credentials/).

## Script Verification

```powershell
rtk proxy pwsh.exe -NoProfile -File C:\repos\SirfBazar\scripts\test-android-keystores.ps1
```

Creates isolated disposable keys only under the ignored `output/keystore-script-tests`
directory, checking creation, public fingerprints, password encryption/recovery,
ACLs, no-overwrite protection and dry-run behavior. These test keys must never be
registered, used for release signing or uploaded to EAS.

Verified with PowerShell 7 on this machine. Its older Windows PowerShell has a
local security-module loading conflict; no execution policy or security settings
were changed to work around it. Interactive password entry still requires a
human terminal; automated checks exercise the generated-password path.
