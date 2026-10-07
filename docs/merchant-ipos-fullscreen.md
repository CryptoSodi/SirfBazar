# iPOS full-screen toggle - 7 October 2026

## Interaction plan

Scope: merchant web `/ipos`, both Classic and Modern appearances. Add a labeled
header button beside the existing appearance/Commands controls. No new function
key: F11 already has profile-specific quantity/reset meanings.

Use the native Fullscreen API on the document root so the existing body-portaled
payment, confirmation and receipt dialogs remain inside the full-screen tree.
Hide only dashboard sidebar/topbar; retain the counter navigation and order alerts.
Keep the same mounted counter, settings form and transaction state.

States: normal; native full screen (Exit full screen button and browser Escape);
expanded-window fallback when native fullscreen is unavailable/denied (explicit
status, Exit expanded view button and Escape); asynchronous transition (disable
repeat toggles). A modal owns Escape first in the window fallback. Native browser
exits synchronize the label and restore dashboard chrome. Leaving iPOS cleans up
the layout and exits only fullscreen initiated by this control. No persistence or
automatic full screen on load. Pending sales and held bills are untouched.

Alternative considered: fullscreen only the register wrapper. Rejected because
existing modal portals target document.body, outside that subtree. Fullscreening
the document plus scoped layout rules avoids moving/remounting dialogs or changing
the shared modal used by other screens.

API reference: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide

## Verification

Passed on the merchant preview at `http://localhost:5174/ipos`:

- `rtk proxy npx tsc --noEmit --incremental false` in `apps/shop`.
- `rtk proxy node --test --test-isolation=none test/ipos.test.mjs test/order-alerts.test.mjs`: 15 passing tests.
- Vite development preview build with `VITE_API_URL=http://localhost:3001/api`,
  `--configLoader native --mode development --outDir dist-local`.
- `playwright-cli -s=ipos-fullscreen run-code --filename apps/shop/test/ipos-fullscreen-browser-check.js`
  after loading the all-API-mocked fixture, pointing it at port 5174: 18 checks passed.
  These cover keyboard entry/focus, actual native document fullscreen, hidden
  dashboard chrome, unchanged draft, accessible payment portal, appearance
  switching, exit/focus restoration, browser-initiated exit, denied/unsupported
  API fallbacks, Classic/Modern reflow at 320px, modal-first fallback Escape,
  unchanged unresolved-sale state, and cleanup when navigating away.
- `playwright-cli -s=ipos-fullscreen run-code --filename output/playwright/ipos-fullscreen-visual-check.js`:
  both appearances under light/dark themes at 1440px; no horizontal overflow.
  Full-screen button text contrast: at least 12.30:1; status text: at least 4.75:1.
- `rtk git diff --check`: passed for tracked changes. The new feature files are
  currently untracked and were covered by compilation and browser checks instead.

Only isolated mock cashier data was used. No real sale, stock change, account
login, or user browser tab was touched. The expected console errors were the
deliberately dropped mock sale response and an unmocked products request after
navigation (404); neither contacted the real API.

Not verified: physical Windows/Android hardware, OS-level Escape in native
fullscreen, and fullscreen policy inside the user's embedded browser. Browser
exit synchronization was exercised through `document.exitFullscreen()`, while
fallback Escape was exercised as a keyboard event. Native support is not assumed:
the expanded-window fallback is explicitly labeled and tested.

## Change-scoped interface review

Scope: new iPOS header full-screen control and layout overrides only. React,
TypeScript, native HTML dialogs and existing operations/iPOS design tokens.
Conventions: repository `AGENTS.md`, existing iPOS and shared dialog styles.
The interface skills influenced the labeled control, visible focus, live status,
responsive wrapping and preserving dialog access inside full screen. This is not
a review of the remaining merchant screens or native merchant app.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Button name, hidden decorative icon, live status, keyboard entry, focus restoration, dialog Escape priority, no new F11 binding | Clear |
| Layout | Header grouping; scoped sidebar/topbar removal; desktop and 320px checks in both appearances; body-portaled payment | Clear |
| Writing | Full screen / Exit full screen / Exit expanded view; explicit unsupported/error messages; no claim that fallback hides browser chrome | Clear |
| Typography | Existing 12px control scale; 1.5 line-height status; wrapping without truncation at 320px | Clear |
| Colors | Computed text contrast in Classic/Modern with light/dark themes; no new hard-coded palette | Clear |
| UI | Existing 40px button, icon sizing, spacing and surfaces; desktop Classic, dark Modern and mobile screenshots | Clear |

Fixed during verification: natively disabling the toggle during the asynchronous
exit lost keyboard focus. It now uses `aria-disabled` with an activation guard,
preserving the focus target throughout the transition.

No actionable interface findings remain in this scope. Verdict: Approve.

Screenshots: `output/playwright/ipos-fullscreen-classic.png`,
`output/playwright/ipos-fullscreen-mobile.png`, and
`output/playwright/ipos-fullscreen-{light,dark}-{classic,modern}.png`.
