# Android release optimization - 19 October 2026

## Finding

Play reported Rider 1.0.0 (10) at 1% obfuscation, with a February 2027 deadline.
The three standalone Expo apps did not enable release minification. Their
generated SDK-54 Gradle template defaults both minification and resource shrinking
to false, and uses `proguard-android.txt` rather than the optimized defaults.
The old Rider bundle has no embedded R8 mapping; the new optimized-bundle check
correctly rejects it. These are compilation findings, not evidence of a measured
runtime memory leak or a reason to change the application identity.

## Change

Each app registers `plugins/withAndroidReleaseOptimization.js`, using Expo's
installed config-plugin APIs to set `android.enableMinifyInReleaseBuilds=true`,
`android.enableShrinkResourcesInReleaseBuilds=true` and the optimized ProGuard
defaults. The copies are app-local because local/EAS source archives contain
standalone app directories. No new dependencies or broad keep/dontwarn rules were
added. Existing SDK consumer rules remain responsible for JNI and reflection.
The plugin is repeatable and fails visibly on an unrecognized native template.

The local builder exports and hashes mapping files, records working-source
fingerprints for uncommitted candidates, and refuses candidates without mapping.
The bundle validator can require embedded mapping and reports DEX/R8 metadata.
Signing keys, package identifiers, Google/FCM configuration, API contracts and
server configuration are unchanged.

## Verification

- Release-plugin and existing Maps configuration tests: 16 passed.
- Customer, Merchant and Rider typechecks: passed.
- Existing mobile tests: Customer 58; Merchant 10; Rider 13 passed.
- Modified PowerShell scripts: syntax parse passed.
- Old Rider build 10: correctly rejected with `-RequireOptimization`.
- Actual Rider prebuild: optimized defaults and both release properties present.
- Signed Rider build 12: successful, using the existing release key.
- Bundle manifest, signature, production configuration, embedded mapping and
  native symbols, 16 KB native-library and APK alignment checks: passed.
- Final AAB R8 metadata: obfuscation 82.79%, optimization 82.32%, shrinking
  82.57%; all three R8 controls enabled. Uncompressed DEX: 6,735,364 bytes.
- Signed APK installed on the API 36.1 Android emulator. Verified login with
  the isolated reviewer account, assigned deliveries, history, profile and
  session restoration after force-stop/relaunch. No Rider fatal exceptions
  were found in the current-process log. ANGLE rendering produced nonblank
  screenshots; the emulator's initial SwiftShader rendering issue was not an
  application crash.
- Real Google sign-in, a physical-device test, new push delivery and a full
  delivery transaction were not rerun for this candidate.
- Play accepted build 12 with mapping and native symbols, showed Ready to
  release and no supported-device loss. Estimated new-install size is 13.4 MB,
  11.4 MB smaller than the previous release. Production release saved as
  `1.0.0 (12) - Android optimization`; submission status is recorded below.

## Artifact provenance

Artifacts and private test output are ignored under `output/aab12/`; no signing
passwords, keystores or reviewer credentials are included in source or bundles.
Only Rider was rebuilt and uploaded in this task; the persistent optimization
configuration applies to all three apps for their subsequent builds.

- Source HEAD: `7dab11f4687e8c503059dbb0200ac8952ea53616`, plus the working-tree
  source inventory recorded by the builder.
- Working-tree SHA-256: `F0BE553BB7F867209A445EB4240DF3845FD0562F3D5084915EF7BA11F468693D`.
- AAB: `sirfbazar-rider-v1.0.0-build12.aab`.
- AAB SHA-256: `C6E7A0AC8F961044C5D11B58C7AB5618A0FF7CE59F945239A9C33BBB43F31136`.
- APK SHA-256: `ABF04AFAEAE2FFC1291EAC9414D79C6CB9A2675B88227EB5D18736EAE91839E6`.
- Mapping SHA-256: `F6C94B94F001B8CDDBE76145C473D95D446AA7F82999377344265F5603AA9F4F`.
- Package/version: `pk.sirfbazar.rider`, `1.0.0 (12)`; min SDK 24, target SDK 36.

## Play submission

Google's initial quick checks completed with the message that the changes could
be sent for review. Submission was then confirmed: Publishing overview showed
**Changes in review** for `1.0.0 (12) - Android optimization`, Start full rollout,
on 19 October 2026. Managed publishing remains off, so approval will trigger
publication automatically. Screenshot: `output/rider-build12-play-in-review.png`.
No country targeting, listing content, credentials or API deployment was changed.

Do not treat the local R8 metadata as an already-updated Play vitals measurement
or a published update. The existing build-10 alert may remain until the
replacement is approved and Google refreshes its analysis.

No Google approval or warning removal is claimed by these source changes. The
existing published bundle cannot be modified; clearing its alert requires an
optimized replacement version and Google's subsequent analysis. Preserve the old
release artifacts and matching mapping files. To roll back source configuration,
remove the plugin registration and rebuild with a new version code; do not remove
consumer keep rules or alter signing identity.

## References

- [Android DEX optimization metrics](https://developer.android.com/google/play/vitals/code-optimization)
- [Enable R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Expo prebuild plugins](https://docs.expo.dev/config-plugins/introduction/)
