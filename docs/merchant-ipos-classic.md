# Classic counter and shortcut compatibility

## Reference and interaction plan — 7 October 2026

Scope: merchant web iPOS, preserving the current authenticated cash-sale API and
browser/account/shop-scoped bill storage. No schema, payment, refund or tax changes.

Sources inspected:
- https://www.ipos.net.pk/content/welcome-ipos.html
- https://www.ipos.net.pk/sites/all/themes/responsive/images/slide-image-3.jpg
  (directly inspected in browser; local review capture in output/playwright).
- https://www.ipos.net.pk/sites/ipos.localhost/files/iPOSNewsimple.pdf
- https://www.youtube.com/watch?v=TW8Bg62dkE8
  (previous automated scene/audio analysis, not a hands-on operator manual).

The website screenshot has a blue compact grid, an adjacent command bank, large
subtotal/payment/change fields and a status strip. Page 2 of the brochure shows
two registers: the left has F2 description / F4 code search; the right reverses
these (F2 code / F4 description), also seen in the website banner. Both have F5
void, F6 refund, F7 multi-quantity and F11 change quantity. The PDF was rendered
at 220 dpi to verify these labels rather than guessing from the small banner.
The video's automated analysis instead identifies F11 Reset and
F12 Exit. These references are not one universal key map. Single-letter button
mnemonics do not establish whether Alt is required; do not globally intercept
letters that a barcode scanner or text input may type.

Variants compared: recoloring the current cards alone would not reproduce the
counter structure; a separate register implementation would duplicate sale logic.
Use one sale engine with a Classic grid/command-bank presentation and the existing
Modern presentation. Both reflow to readable labeled rows on narrow screens.

Planned interactions:
- Classic/Modern switch saves only appearance, retaining bill identity, quantities,
  held bills and any unresolved sale. No remount, checkout or permission change.
- Separate shortcut profiles: SirfBazar, video reference (partial), legacy
  description-first and code-first (partial), plus validated custom bindings.
  Every reference/extension is labeled.
- F5 void mode affects only the current unpaid bill: scan/select an existing item,
  preview removal of one unit, explicitly confirm; it never refunds a paid sale.
- Change quantity selects a bill line and validates whole units and stock.
- Multi-quantity sets the next successful addition's quantity, then resets to one.
- Reset confirms discarding an unpaid bill; cancel leaves it intact.
- Exit confirms leaving for the dashboard, retains drafts, and never signs out or
  closes an arbitrary browser window. Pending/active requests block these commands.
- Keyboard handlers ignore modifiers not in the binding, IME, repeated events and
  all modal/payment states. Letters are never bound without Alt. Browser/OS keys
  remain best-effort; visible controls are always available.
- Commands/help expose supported actions and explicitly list unavailable financial
  or hardware features. F6 refund is reserved in reference profiles, not repurposed.

Not full parity: refunds, discounts/price overrides, shift/cash ledger, fiscal and
digital tender, offline completion, scales and native peripheral adapters remain
unimplemented. Full vendor shortcut coverage still needs the intended edition's
operator manual. Do not call a capability notice an implemented business action.

## Using the implemented counter

Open `http://localhost:5174/ipos` after merchant sign-in. The root URL is still the
merchant overview. Use **Classic appearance On/Off** in the register header, or
**POS settings > Counter & billing > Counter appearance**. The latter requires
Save preferences. This changes presentation, not stock, bills or permissions.

Under **POS settings > Keyboard commands**, choose and save a profile:

| Profile | F2 | F4 | F5 | F6 | F7 | F11 | F12 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Legacy description-first (brochure left register) | Description | Item code | Void mode | Unassigned: refund unavailable | Next-addition quantity | Change quantity | Unassigned |
| Legacy code-first (website / brochure right register) | Item code | Description | Void mode | Unassigned: refund unavailable | Next-addition quantity | Change quantity | Unassigned |
| Video reference (automated analysis, partial) | Unassigned | Unassigned | Void mode | Unassigned: refund unavailable | Unassigned | Reset confirmation | Exit confirmation |
| SirfBazar | Item code | Unassigned | Unassigned | Hold | Held bills | Unassigned | Unassigned |

SirfBazar also retains F8 history, F9 settings and F10 cash payment. Custom bindings
cover 14 supported commands, reject duplicate assignments, and permit unassigned,
F1-F12 or Alt-letter keys. Alt letters are ignored in editable controls. These are
browser bindings, not a promise to override native Windows/Android/browser keys.
The visible command bank remains usable by touch. A laptop may need its Fn key.

Cash received and change stay in the explicit payment dialog; the Classic bill's
large display is the unpaid total, not a claim that money has been collected.
Void confirms removal of one unpaid unit. Paid-sale refunds are not substituted
with bill deletion. No vendor branding or proprietary binary has been copied.

## Verification - 7 October 2026

Passed on the final source/build:

- `apps/shop`: `rtk proxy npx tsc --noEmit --incremental false`.
- `apps/shop`: `rtk proxy node --test --test-isolation=none test/ipos.test.mjs test/order-alerts.test.mjs`:
  **15 tests passed** (11 POS and 4 alert regressions).
- Vite native-loader build, development mode, `--outDir dist-local`, with
  `VITE_API_URL=http://localhost:3001/api`: passed. The existing localhost:5174
  preview serves that updated build; this is not a production deployment.
- Playwright isolated browser with every `/api/**` request intercepted by the
  fixture. Ran `ipos-classic-browser-check.js`, `ipos-classic-review-check.js` and
  `ipos-theme-keyboard-check.js` from `apps/shop/test/`. The existing fixture's
  localhost:5174 copy is `output/playwright/ipos-running-route-check.js`; the
  repository fixture targets a separate preview on 127.0.0.1:5178. Start a fresh
  isolated context, load the fixture, then run the three scripts in that order.
- All five profile choices tested; F2/F4 focus for both legacy variants, F5 void
  cancellation/confirmation, F7 one-shot quantity, legacy F11 stock validation,
  video F11/F12 confirmations, hold/recall and cash receipt/change passed.
- Appearance and profile persist across reload without changing draft identity.
  Existing v1 storage migration preserves held bills and pending payloads.
- Duplicate custom bindings cannot save. Alt-letter bindings work outside inputs
  but do not interrupt typing. Mapped keys cannot operate through payment/dialogs.
- Injected loss of a sale POST response: both appearance changes preserved the
  pending request byte-for-byte; shortcuts left the bill frozen; checking status
  recovered the original receipt. Mock sale count increased exactly once.
- Failed barcode lookup followed by two queued scans: failed lookup retained the
  multiplier, the first successful scan consumed it, the next added one unit.
- Classic and Modern registers and keyboard settings: no document horizontal
  overflow at 320, 720 and 1440 CSS px. At 320px the corrected Classic caption is
  248px wide rather than a narrow column. Table headers remain in the accessibility
  tree. Quantity dialog fits, keyboard focus is visible, repeated Tab does not
  focus background controls, and Escape closes without applying changes.
- Existing review-mode Theme Studio: Classic stays fixed blue inside a dark
  dashboard; Modern follows the dark palette. Sampled text contrast minimums:
  Classic 6.83:1, Modern light 4.66:1, Modern dark 4.65:1.

The fresh-context browser script initially assumed counter storage existed before
the first mutation; that test assumption was corrected. A modal test initially
used the wrong accessible title; corrected to `Change bill quantity`. Both final
runs passed. The final browser's two console errors are the intentionally aborted
sale response and unknown-barcode 404; no application exception was observed.

Not verified: physical USB/Bluetooth scanners, receipt printers/cutters/drawers,
real Android hardware, native 200% browser zoom, screen-reader operation, actual
database concurrency or production deployment. No real sale, stock change,
migration or business account write was performed during these browser tests.

## Consolidated interface review

Scope: this change's Classic table, appearance controls, command bank, shortcut
editor, quantity/multi-quantity/void/reset/exit states, and regression of the
existing cash/recovery flow. React, native controls/shared Modal, existing
operations tokens plus a locally scoped Classic palette. Conventions inspected:
root AGENTS and architecture, API contract, backend, deployment and capability
records. Other apps/screens are outside this change-scoped review.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Accessible names/pressed state, modal keyboard flow, scanner focus, retained table headers, confirmations | Clear in tested Chromium states; assistive technology/hardware not certified |
| Layout | Table/command-bank variant comparison; both register layouts and settings at 320/720/1440px | Clear after mobile caption fix |
| Writing | Partial-profile/version wording, unsupported refunds, void versus paid refund, safe pending recovery | Clear; no claim of complete iPOS compatibility |
| Typography | Labeled mobile rows, wrapping descriptions/help, tabular monetary display, narrow-input sizing | Clear in inspected screenshots |
| Colors | Computed actual text/background pairs, fixed Classic palette and Modern light/dark | Clear for sampled pairs; state includes text/pressed cues |
| UI polish | Rectangular Classic controls, scoped hover tokens, compact key badges, one transaction engine | Clear after compact key-badge sizing fix |

No actionable interface findings remain in the inspected scope. Interface skills
influenced modal safety, reflow, contrast and the explicit unsupported-feature
wording. **Verdict: Approve for this interface coverage, not full vendor parity or
production/hardware certification.**

Evidence under `output/playwright`: `ipos-classic-final.png`,
`ipos-classic-mobile-reviewed.png`, `ipos-modern-mobile-reviewed.png`,
`ipos-modern-dark-reviewed.png`, `ipos-classic-dark-surround.png`, the official
website captures and `ipos-official-pdf-register.png`. Keep the official PDF as
research evidence; it is vendor material, not an app asset.
