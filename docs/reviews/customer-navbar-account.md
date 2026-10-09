# Customer navbar account entry — interface review

## Scope and coverage

Customer website desktop navbar profile icon and mobile navigation's You disclosure, including guest, signed-in, auth-change and dismissed states. Existing checkout-only header, OTP internals, other web dashboards and native apps are excluded. Stack: Next/React, existing CSS theme/spacing tokens and Lucide-backed icons. Project AGENTS conventions and adjacent Header/LoginSheet/profile flows inspected.

Interaction: native summary opens account options; real links preserve ordinary navigation. Guest entry says “Sign up or sign in” and opens the existing profile authentication flow. Signed-in options lead to profile and orders. Escape closes and restores focus; outside pointer/focus, navigation and authentication changes close stale options. Cached profile data without a session does not imply a signed-in state.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Native disclosure and links, accessible labels, Enter/Tab navigation, visible focus, Escape restoration and outside dismissal | Clear within scope |
| Layout | Browser at 1280, 900, 761, 640 and 320px, plus 320px RTL; popup bounds and document overflow checked | Clear within scope |
| Writing | Combined signup/sign-in wording, same-step explanation, signed-in destinations and existing authentication copy | Clear within scope |
| Typography | Existing typeface, 13–15px labels with 1.5 line height; rendered wrap inspected at 320 and 1280px | Clear within scope |
| Colours | Actual popup foreground/background pairs measured in light and dark; minimum text contrast 6.15:1 | Clear within scope |
| UI | Existing user icon, themed surfaces and focus treatment; no added animation or dependency | Clear within scope |

## Findings

No actionable interface findings within the inspected account-entry flow. Interface skills influenced the use of native disclosure/link behavior and reuse of existing theme tokens; no whole-site redesign was performed.

## Verification

Passed:

- Customer web `node node_modules/next/dist/bin/next build`: compilation, TypeScript and prerendering.
- Customer web `npm test`: 13/13 existing unit tests.
- `node scripts/browser-account-menu.mjs`: guest entry reaches the existing phone authentication dialog, signed-in options on desktop/mobile, stale cached-user fallback, auth-change closure, keyboard/Escape/outside behavior, five widths, RTL and light/dark states. Browser fixture registered in `scripts/browser-remediation.mjs` for CI.
- Rendered 1280px light and 320px dark screenshots inspected locally.
- `git diff --check` passed.

Not verified: physical mobile/screen-reader execution, true browser 200% zoom (640px CSS viewport used as the 1280px zoom equivalent), forced-colors rendering or production rollout. API calls are intercepted with synthetic fixture data; no OTP, cart or order writes are sent. No authentication/provider configuration changed.

## Verdict

Approve for the reported local scope. Not deployed.
## Session-state follow-up

The automated PR review identified that session expiry and cross-tab authentication emit `sb:session`, not only `sb:auth`. The header now subscribes to both, with matching cleanup. The browser regression also covers canonical session expiry and real same-origin storage events from a second tab for login and logout; stale open account options must close.
