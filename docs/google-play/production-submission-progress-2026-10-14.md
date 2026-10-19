# Production submission progress - 14 October 2026

Status: all three production releases submitted; Play Console shows **Changes
in review**. Not yet approved or publicly published. Managed publishing is off;
approved releases are configured for full production rollout in Pakistan.

## Final submission

### Screenshot expansion after initial submission

At the owner's request, each default English phone gallery was expanded from two
to four real native screenshots. Existing icons, feature graphics, descriptions,
countries, declarations and bundles were preserved. Added captures:

- Customer: `review-customer-build8-order-sent.png` (confirmation) and
  `review-revision-comparison.png` (customer approval of proposed changes).
- Merchant: `merchant-build10-push-opened-order.png` (accept/reject order) and
  `review-merchant-ready-order.png` (pickup readiness and timeline).
- Rider: `review-rider-pickup-step.png` (pickup checklist) and
  `review-rider-arrival-step.png` (active delivery/navigation entry).

All six source images were visually inspected before upload. They show isolated
demo data, not real customers or live transactions; no passwords, reusable review
codes or delivery handover codes are included. Older captures are not represented
as new tests. No synthetic app screens or image edits were created.

Each gallery showed 4 / 8, was saved through the Review step and submitted as one
listing change. Google required restarting each existing review to include it.
All three returned to Changes in review with quick checks running and no remaining
unsent listing change. This can extend review time; no approval is claimed.
Local proof: `output/play-merchant-four-screenshots-20261014.png`,
`output/play-rider-four-screenshots-20261014.png`, and
`output/play-rider-screenshots-resubmitted-20261014.png`.

| App | Submitted version | Status |
| --- | --- | --- |
| SirfBazar: Local Shopping | 1.0.0 (11) | Changes in review |
| SirfBazar Merchant | 1.0.0 (10) | Changes in review |
| SirfBazar Rider | 1.0.0 (10) | Changes in review |

All three Sign in details, adult (18+) audience and Data safety forms were
completed. Advertising ID was answered No after release-manifest/configuration
checks. Final production validation had no blocking errors; each release had
one non-blocking deobfuscation-file warning. Ten changes per app were sent for
review. Initial automated checks ran after submission; submission is not approval.

Native customer/merchant revision rejection and approval were verified using
isolated demo data, with read-only authenticated role coverage recorded in
`reviewer-access.md`. Owner-approved companion customer credentials were also
saved in Rider's private review instructions for delivery handover; no credentials
were added to public listings or Git. The Rider review was restarted to include
this instruction update; Console returned to Changes in review with quick checks
running and no remaining unsent change. Customer and Merchant were unaffected.

Proof: `output/play-customer-submitted-20261014.png`,
`output/play-merchant-submitted-20261014.png` and
`output/play-rider-submitted-20261014.png` (local ignored screenshots).
Internal testing and Play-installed verification were not performed, per owner
direction. Manual deletion fulfillment and untested native edge cases remain
operational follow-ups, not claimed as passed.

The sections below preserve the earlier preparation history. Their statements
about unsent forms and remaining Console gates are superseded by this section.

## Saved in Play Console

| App | Production draft | Country | Default listing |
| --- | --- | --- | --- |
| SirfBazar: Local Shopping | `1.0.0 (11) - First production release` | Pakistan only | Ready to send for review |
| SirfBazar Merchant | `1.0.0 (10) - First production release` | Pakistan only | Ready to send for review |
| SirfBazar Rider | `1.0.0 (10) - First production release` | Pakistan only | Ready to send for review |

The existing signed bundles were selected from the Play artifact library. No
rebuild, signing-key change or replacement of the internal drafts was needed.
Each production draft has role-specific English release notes. These are saved
drafts, not approved or active releases.

All three existing English descriptions, icons and feature graphics were
preserved. Two actual phone screenshots were added per app and the listings were
saved through their Review step, not merely Save as draft. The Console then
showed Ready to send for review, and each Dashboard showed 8 of 11 initial setup
tasks complete. Icons and feature graphics were labeled as AI-created/edited;
the unmodified native screenshots were not labeled as generated images.

Uploaded screenshot sources (local ignored files):

- Customer: `output/review-customer-build7-home.png` and
  `output/review-customer-build11-map-loaded.png`.
- Merchant: `output/review-merchant-dashboard.png` and
  `output/review-merchant-inventory.png`.
- Rider: `output/review-rider-deliveries.png` and
  `output/review-rider-build8-delivered.png`.

These show the existing app UI with isolated review fixtures, not real customer
orders, credentials or transactions. Earlier-build screenshots are not evidence
of new tests on the current release. The customer home screenshot includes the
demo products' existing image-unavailable placeholders; it is not a fabricated
product image or a claim that the catalogue imagery is complete.

## Earlier blockers (subsequently resolved in Console)

1. **Sign in details:** the form requires a certification that the supplied
   credentials provide full access. Isolated accounts exist and core journeys
   passed, but remaining coverage in `reviewer-access.md` is not verified. The
   incomplete customer selection was discarded; no false certification or
   reviewer credential submission was made during this attempt.
2. **Target audience:** the merchant Console explicitly states that Sign in
   details must be completed before the questionnaire can begin. The planned
   adult audience is not a saved declaration.
3. **Data safety:** per-app handling and security answers remain incomplete.
   See `data-safety-review.md` and `otp-transport-blocker-2026-10-14.md`. No
   complete Data safety declaration was submitted.

Initial production previews for all three apps showed three errors: incomplete
Dashboard setup, full description not yet finalized, and no selected country.
Country targeting and the full store listings were subsequently saved as above.
The remaining setup gates are confirmed on the Dashboards; a final post-change
production preview has not yet been run. Do not report a zero-error release.

Internal testers were not added and no testing track was rolled out, per owner
direction. Their absence was not shown as a production validation error.
Play-installed verification remains unperformed, separate from these required
forms. Google review and approval have not occurred.

## Evidence and change boundary

Local ignored Console screenshots:

- `output/play-customer-production-draft-20261014.png`
- `output/play-merchant-production-country-20261014.png`
- `output/play-rider-production-country-20261014.png`
- `output/play-customer-listing-ready-20261014.png`
- `output/play-merchant-listing-ready-20261014.png`
- `output/play-rider-listing-ready-20261014.png`
- `output/play-audience-signin-prerequisite-20261014.png`
- `output/play-customer-remaining-setup-20261014.png`

The initial listing preparation changed no production runtime. Subsequent work
tested isolated demo order revisions and attempted the separately authorized OTP
HTTPS setup; see `reviewer-access.md` and `otp-transport-blocker-2026-10-14.md`
for the exact boundaries. The live API OTP URL and WhatsApp session remain unchanged.
