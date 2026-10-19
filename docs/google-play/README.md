# Google Play publication readiness

Shop website map configuration: [live profile map repair, 19 October 2026](shop-website-maps-2026-10-19.md).

Merchant map repair: [Android map picker and restricted-key verification, 19 October 2026](merchant-android-maps-2026-10-19.md).

Latest Rider maintenance record: [Android release optimization, 19 October 2026](android-optimization-2026-10-19.md).
Rider build 12 replaces the unoptimized build 10; use that record for measured
R8 scores, signed-artifact verification and the replacement submission status.
Play Console showed Rider last published on 18 October; the paragraphs below
describe the earlier initial-submission state, not current availability.

Initial Console state: [production submission progress, 14 October 2026](production-submission-progress-2026-10-14.md).
Customer build 11, Merchant build 10 and Rider build 10 have been submitted for
production review. Play Console shows Changes in review; managed publishing is
off for automatic publication in Pakistan after approval. Sign in details,
target audience, Data safety and Advertising ID declarations are completed.
Nothing is yet confirmed publicly published.

The remaining sections are the historical 13 October preparation audit. For
current status and resolved gates, use the linked 14 October progress record.

Last inspected: 2026-10-13. Base: `6463f3cc05b6bca2f4da5228a58bec2461551d41`.
Release preparation: PR #21, `codex/google-play-publication`.
Local build tooling and permission cleanup: PR #22, `codex/local-android-release`.
See [build 6 evidence](build6-verification.md) for the completed local AAB/APK checks.

**Historical state, superseded by the submission above.** All three Play Console app drafts now
exist, their build-6 bundles are uploaded and validated, and listing preparation
is partially saved. See the [latest Console progress record](console-progress-2026-10-13.md)
for app IDs, completed declarations, signing fingerprints and remaining gates.
The historical readiness audit below predates that Console setup and is not
evidence of Google approval.
PR #21 merged as `d65c057c19f2a17fe9ea9b51c78cdb68274c79dc`; the normal
production workflow [38396284601](https://github.com/CryptoSodi/SirfBazar/actions/runs/38396284601)
passed, including API deployment. No schema, signing key, OAuth client, scope or
audience change was made. Google consent branding URLs were updated as below.

Owner follow-up: the business name is **Sirf Bazar** and the public support/deletion
mailbox is now **support@sirfbazar.com** (replaces the earlier .pk address).
Terms, Privacy, Contact and a public `/account-deletion` email-request page have
been deployed, with footer links. All four routes returned HTTP 200 with the
approved .com mailbox and no old .pk support address on 13 October. This
is not a completed data-erasure system or legal-compliance certification.

## Account and listings

Play Console was inspected under the owner-specified Google account
`syedtassaduqhussainabidi@gmail.com`, developer account **LudoCities**
(`5606090932663776281`). No existing SirfBazar entries were present.
The public support mailbox `support@sirfbazar.com` was confirmed active by the
owner. The Google Cloud OAuth project and Play developer account are separate.

| App | Android package | Proposed category | Status |
| --- | --- | --- | --- |
| SirfBazar: Local Shopping | `pk.sirfbazar.customer` | Shopping | Local listing/assets prepared |
| SirfBazar Merchant | `pk.sirfbazar.merchant` | Business | Local listing/assets prepared |
| SirfBazar Rider | `pk.sirfbazar.rider` | Business | Local listing/assets prepared |

English listing copy, candidate tags and release notes are in `listings.json`.
Pakistan-only availability is a proposal, not a saved console setting. Tags
must be selected from the actual console options; candidate tags are not
represented as verified taxonomy. Ratings and audience declarations remain open.

## Assets and validation

Run from the repository root using the existing installed `sharp` dependency:

```powershell
rtk proxy node scripts/prepare-play-listing-assets.cjs
```

Output: `output/google-play-2026-10-13/<customer|merchant|rider>/`.
Each app has a 512x512 PNG icon, 1024x500 opaque PNG feature graphic, editable
feature-graphic SVG, and separate listing text files. Graphics use the existing
role-specific brand artwork, not replacement logos. All three graphics were
visually inspected. Metadata/character limits passed and are recorded in
`output/google-play-2026-10-13/listing-validation.json`.

These graphics are **not app screenshots**. Customer and merchant build-4 APKs
installed successfully in the local API-36.1 emulator, but captured launch
images were entirely black. This does not establish an app crash or a successful
native launch; emulator rendering and launch behavior still need diagnosis.
Those images must not be uploaded as store screenshots. Rider native testing
and authenticated feature screenshots remain unverified.

## Build preparation

All three `eas.json` files now contain a separate `play-store` profile extending
the existing production-configured `preview` profile, with store distribution,
Android App Bundle output, automatic version increment and local signing keys.
Existing APK profiles remain intact.

Validate locally without uploading anything:

```powershell
rtk proxy pwsh.exe -NoProfile -File scripts/Start-SirfBazarReleaseBuild.ps1 -Profile play-store
```

The script prompts privately for existing passwords. Its optional `-PasswordFile`
accepts the owner's designated local file; never commit that file or its contents.
Adding `-Submit` queues EAS builds using the previously authorized signing
service. **It does not submit to Google Play.** Do not queue a publication build
until the required mobile fixes below are included.

Both default APK and new AAB signing-profile validation passed for all three
existing release keys. EAS submission was attempted on 13 October with source
`3a329dd`. Customer versionCode incremented from 4 to 5 and its archive uploaded,
but EAS rejected the build because the account's free Android build quota was
exhausted (reported reset: 1 November 2026). No new bundle or queued build ID was
returned; merchant and rider submissions were not attempted after that failure.
Temporary local credentials.json was removed and no paid plan was purchased.
The GitHub release
`android-build4-2026-10-11` contains APKs, not Play-ready verified AAB releases.

Before upload, verify package/version, signing certificate, permissions, target
SDK, native library 16 KB alignment, and a Play-delivered build on a device.
APK ZIP alignment alone does not verify ELF library alignment. Establish the
Play App Signing key decision before enrollment: a different distribution
certificate requires corresponding Google login and Maps registrations and
can affect upgrades from sideloaded APKs. Do not disclose private signing keys
to a new service without specific authorization.

## Publication gates

| Gate | Evidence / current state | Required next action |
| --- | --- | --- |
| Account/data deletion | `apps/api/src/customers/customers.service.ts`, `deleteAccount`, only sets `DELETED` and revokes refresh tokens | Implement a genuine request/fulfillment process and test data handling; disabling access alone is insufficient |
| All-role deletion entry | All three profile/settings views now include `AccountPolicies`; merchant/rider login also expose links. Customer deletion screen opens an email request instead of falsely completing erasure. Public request page deployed | Verify updated native builds and remaining onboarding states |
| Privacy/retention | Updated policy describes precise location, all roles and request-based deletion. Owner requested customary retention; selected targets are in `deletion-operations.md`, not yet enforced | Test actual fulfillment, verify retention settings and deployed policy; do not claim the targets already operate |
| Data safety | Source inventory is in `data-safety-review.md`; no questionnaire submitted | Reconcile SDKs, backend recipients and deployed configuration; complete each app's answers accurately |
| Reviewer access | No approved review accounts or tested review instructions established | Provide restricted, stable access to customer, approved merchant and approved rider flows; no shared production-admin credentials or auth bypass |
| Google login readiness | Live console inspected on 13 October: project `sirfbazar` / `453311658725`, External/Testing, one test user. Homepage/privacy/terms URLs now saved; no configured scopes shown in Data access | Recheck publication readiness, obtain approval where required, register Play signing SHA and test Play-installed sign-in |
| Android permissions | Build-6 manifests verified: no unused overlay/legacy storage in any app and no merchant microphone permission. Gallery flow uses the system photo picker without broad gallery permission | Test camera/gallery cancellation and denial on real supported devices |
| Native journeys/screenshots | Installation succeeded for two APKs; launch captures black | Diagnose rendering, test all apps and capture genuine screenshots without personal information |
| AAB and prelaunch checks | All three local build-6 AABs and test APKs built and verified for expected signer, manifest and native/ZIP alignment; see `build6-verification.md` | Device journeys, Play signing enrollment, test track and Play prelaunch checks |
| Console declarations | Create App requires policy certification and export declaration; neither accepted | Complete truthful declarations and obtain action-time confirmation for binding terms when ready |

## Decisions needed from owner

1. Business/operator name supplied: **Sirf Bazar**. No further name is required.
2. Retention baseline selected following the owner's instruction: see
   `deletion-operations.md`. Applicable financial obligations and actual operations
   must still be verified before publishing fixed-period guarantees.
3. Suitable reviewer access and confirmation of intended countries and audience
   before those declarations are submitted.

Do not invent retention periods or claim regulatory compliance. An email request
path can be part of the solution, but it must lead to actual verified fulfillment,
with disclosed legitimate retention exceptions. The same login can participate
in multiple roles; deletion must address linked roles and financial obligations
without erasing another merchant's records or misleading the requester.

## Tests actually run

- Listing text length and PNG dimension/opacity assertions: passed for all apps.
- Visual inspection of three feature graphics: passed.
- Signing profile/private-key password/certificate validation: passed for all apps
  with both the default APK and `play-store` profiles; no password output.
- `git diff --check`: passed.
- Customer and merchant APK installation on emulator: passed.
- Native visual launch and authenticated journeys: **not verified**.
- All three mobile typechecks and 69 existing mobile tests: passed.
- New policy/config tests: 14 passed; Google-client tests: 22 passed after adding
  the new rider policy component to the isolated login test harness.
- Cloud AAB build: **blocked by quota**. Local AAB builds and artifact checks:
  **passed for all three apps**. Play upload, review and production publication:
  **not performed**.

The initial preparation changed no runtime code. Follow-up updates website
policies, native policy/deletion-request entry points and merchant photo permissions.
Backend runtime and database migrations remain unchanged.
See `website-policy-checks.md` for the website checks. Existing dummy product CSV is untouched.

## Official references

- [Create and set up an app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Account and associated-data deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Photo/video permission policy](https://support.google.com/googleplay/android-developer/answer/14115180)
- [Android native page-size support](https://developer.android.com/guide/practices/page-sizes)

Google review and publication are separate from preparing these files. This
document must not be used as a blanket compliance certification.
