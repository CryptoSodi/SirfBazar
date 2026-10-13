# Android build 6 verification - 13 October 2026

Status: **three locally built, signed release candidates; not submitted to Play**.
Source application commit: `46356e88c89876d70cfe289656a28ddc3b853f05`.
Later tooling-only commits do not change the application sources in these builds.
Output directory: `C:\repos\SirfBazar\output\aab6` (ignored, not committed).

EAS quota blocked cloud builds, so the owner approved local Windows builds.
Existing per-app release keystores were used; no keys were generated, uploaded
to Google or committed. Local passwords were not printed or saved in source.

| App | Package | Version / target SDK | AAB | Test APK |
| --- | --- | --- | --- | --- |
| Customer | `pk.sirfbazar.customer` | 1.0.0 (6) / 36 | 66,415,056 bytes | 103,239,276 bytes |
| Merchant | `pk.sirfbazar.merchant` | 1.0.0 (6) / 36 | 66,147,326 bytes | 102,770,215 bytes |
| Rider | `pk.sirfbazar.rider` | 1.0.0 (6) / 36 | 65,809,829 bytes | 102,421,542 bytes |

Files are named `sirfbazar-<role>-v1.0.0-build6.aab` and `.apk`. AABs are for
Play upload; APKs are sideloadable device-test candidates, not Play-delivered apps.

## Checks executed

- All three Gradle `:app:bundleRelease` builds: passed. The first customer build
  installed the required Gradle, Android build tools, NDK and CMake versions.
- Expected package, versionCode 6, target SDK 36 and non-debuggable manifest: passed.
- JAR signatures and each app's expected existing release SHA-1 certificate: passed.
- Official Google bundletool 1.18.3 validation: passed for all three bundles.
- All 38 packaged 64-bit native libraries per app have compatible ELF LOAD segment
  alignment for 16 KB pages: passed (114 libraries checked across three apps).
- Locally exported APK signatures and `zipalign -c -P 16 4`: passed for all three.
- No overlay or legacy shared-storage permissions in any candidate; merchant
  microphone permission absent. Camera/location/notifications remain as required.
- Embedded production API URL, Google web client ID, .com support mailbox and
  deletion-link strings: present in each compiled JavaScript bundle. This is an
  artifact sanity check, not proof that production login or deletion succeeds.
- Validator rejected both a mismatched signer and an incorrect versionCode.
- New policy/config tests: 14 passed. Both PowerShell scripts parsed successfully.
- Customer app.json-only refresh reused native caches and rebuilt successfully.
  Merchant lock comparison initially rejected CRLF/LF differences; parsed JSON
  was identical. The comparison was corrected and its build then passed.
- A code-review finding about localized jarsigner output was fixed by explicitly
  setting English/US for both signer-verification invocations.

Detailed public manifest and AAB verification JSON files are beside the bundles.
Merchant/rider APK checks also have separate `.apk.verification.json` records;
the customer APK signer/alignment checks were rerun directly after its export.

## SHA-256 checksums

```text
C43150E49F98AE3AD7069AEFEAF2C1F5373905C4FDF670E3269A4E0FBF9B762C  sirfbazar-customer-v1.0.0-build6.aab
1B4914584318EDBD206A66F37868F553EF48A98BA7FF1DE648DD6C6BB67841EF  sirfbazar-customer-v1.0.0-build6.apk
AFDF9E3A8D99C956409F596C49D3293AA800AE52D05F15A1B0361197FB92C3D7  sirfbazar-merchant-v1.0.0-build6.aab
EC8F523F5B51089ABD82E4E7A3194AAD9B525DF94AEF7F15858FD9C584975D84  sirfbazar-merchant-v1.0.0-build6.apk
C7C121551C5BC0975F8A65E8DD1EFDDC1FC901C0259179222FCCDD794424FE6E  sirfbazar-rider-v1.0.0-build6.aab
5A0A3846901CF841557B03B9E1F1FAA11F98F012A804E8DC74B51E1B7F005099  sirfbazar-rider-v1.0.0-build6.apk
```

## Still not verified

These candidates were not installed or exercised on a device during this build
run. Real Google login, camera/gallery denial/cancellation, onboarding states,
native visual journeys, screenshot capture and 16 KB-device execution remain
unverified. The previous black emulator captures are not store screenshots.

Play signing enrollment/certificates, reviewer access, audience/country choices,
Data safety/content-rating declarations and owner confirmation of binding terms
remain open. No SirfBazar Play entries or releases were created in this run.
Account-erasure fulfillment and actual retention enforcement remain release gates;
the public support request page does not prove those processes work.

Do not describe these files as Google-approved or ready for an unchecked production
rollout. Do not submit the older intermediate customer bundle that retained unused
permissions; the hashes above identify the final cleaned candidates.
