# Immediate merchant desktop order alerts

Implemented and verified locally on 6 October 2026. Scope: `apps/shop` merchant portal, plus the asynchronous Socket.IO authentication race in the shared API gateway.

## Research and decisions

- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/): delivery defaults to at-most-once; a disconnected client does not automatically receive missed server events. The portal therefore reconciles pending orders from the tenant-scoped REST endpoint on startup, successful room join, reconnect, return to the tab, and periodically as a safety check.
- [Socket.IO client API](https://socket.io/docs/v4/client-api/#socketactive): a server-rejected connection does not automatically reconnect. The portal explicitly retries inactive connections while the network is available.
- [Socket.IO connection behavior](https://socket.io/docs/v4/how-it-works/): use the existing Socket.IO client/server protocol with reconnection and transport fallback; do not attach a plain WebSocket client to this server.
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): create/resume the audio context through a user gesture. The portal provides Enable sound, Mute sound, and Test sound. Reloading requires enabling sound again; it never displays a false enabled state based only on a saved preference.

The primary notification path is a server event, not a polling timer. REST checks run every five seconds while the live connection is unavailable; a healthy live connection gets a pending-order reconciliation roughly every minute. These are best-effort intervals, not delivery guarantees during network outages, computer sleep, or browser suspension.

## Interaction states

The chosen interface is a persistent alert section above the page content. It avoids taking focus away from a merchant who is editing inventory or working on another order.

| State | Visible behavior | Action |
| --- | --- | --- |
| Connecting | Connecting order alerts | Pending orders are also fetched through REST |
| Connected, no pending orders | Live order alerts | Enable sound; optionally enable desktop pop-ups |
| New order | Order number, pending count, persistent Review order(s) link | Open the single order or filter to new orders |
| Sound enabled | Mute sound and Test sound | Three-note chime immediately and every 10 seconds while orders await a decision |
| Accepted, rejected or cancelled | Remove that pending alert immediately | Stop repeating when no pending orders remain |
| Disconnected | Reconnecting, with explicit five-second check message | Retry live connection and recover pending orders |
| Network offline | Offline message | Reconnect when network returns |
| Failed pending-order check | Keep known orders; show connection/retry guidance | Retry order check |
| Sound blocked or paused | Recovery guidance and Enable sound | Resume through a click |
| Desktop pop-ups denied | Browser site-settings guidance | In-app alerts and sound remain available |

The alert section is mounted in the merchant shell for owners and staff with ORDERS permission. It persists across page navigation. Order events update the Orders table and Overview data immediately. Personal NEW_ORDER notifications only trigger a scoped REST reconciliation; they are not trusted to insert a foreign staff shop's order into the queue.

Events are deduplicated by order ID. Snapshots that overlap a live event are discarded and refetched so a late REST response cannot restore an accepted/cancelled order. New event announcements are also checked against the current pending-order state. A per-shop expiring browser-storage lease suppresses repeating tones from other tabs where storage is available. The REST endpoint returns at most the latest 100 orders per status.

The API gateway waits for its authentication promise before deciding room membership. Owner/active-staff checks and foreign-shop denial remain in place. No schema change or production configuration change was made.

## Verification

- `apps/shop`: `npm run test:alerts` — four tests passed: duplicate/terminal-state behavior, malformed events, correct socket origin, cross-tab sound lease and takeover.
- `apps/api`: `npx ts-node test/realtime-auth.ts` — delayed JWT authentication, owner and active-staff access, foreign-shop denial, invalid-token denial passed.
- `apps/api`: `npm run typecheck` — passed.
- `apps/shop`: `npm run build` — TypeScript and production build passed from a fresh temporary copy outside OneDrive. Building directly under OneDrive still encounters the pre-existing esbuild access denial.
- Read-only `apps/shop/test/live-gateway-check.cjs` — authenticated Mazhar Kirana's actual local API profile and Socket.IO room; another shop room was denied. No marketplace orders or records were changed by this check.
- Isolated browser fixture on 3199; portal test instance on 5194. Test orders existed only in memory, separate from the marketplace DB.
- `output/playwright/merchant-alerts-check.js` — new-order banner appeared in **60 ms** in the local fixture. Actual Web Audio oscillator starts observed; duplicate event did not ring again; 10-second repetition, navigation persistence, direct order opening and sound stopping after acceptance passed. This measurement is a local test result, not a production latency promise.
- `output/playwright/merchant-alerts-recovery.js` — fallback detected a silent test order in **3,448 ms**; failed snapshot preserved known orders; missed order recovered on reconnect; delayed snapshot did not restore a cancelled order; live table refresh and multi-order navigation passed.
- `output/playwright/merchant-alerts-background.js` — event and actual audio playback scheduling passed with `document.hidden` simulated. The automation browser kept native pages visible; true minimized/background-tab behavior is **not verified**.
- Optional OS pop-up permission prompt and Windows notification delivery are **not verified**; audible chime and in-app alerts do not depend on OS notification permission. Physical speaker output/Windows volume is not measurable by the browser check.
- Portal login and API docs returned HTTP 200 on 5174 and 3001 after local services were restored. Local API runs current source via ts-node; portal runs the fresh temporary copy, using `http://localhost:3001/api`.

## Interface review

Scope: the Order alerts section, its sound controls and pending-order navigation, with React 19, existing operations CSS/theme tokens and Lucide icons. Conventions reviewed: repository AGENTS.md, shared operations.css/theme.ts, API contract, architecture and backend conventions. Existing unrelated pages were not comprehensively reviewed.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Native controls, accessible names, stable polite status region, no focus theft, keyboard enable/mute, 2.4 CSS-pixel rendered focus ring, 40px desktop/44px narrow targets | Clear for inspected controls; full screen-reader and automated WCAG audit not verified |
| Layout | Browser at 1440, 800, 390 and 320px, 640px effective viewport for 200% reflow, RTL mirror, pending/empty/error source states | Clear; no document overflow or clipped alert controls |
| Writing | All labels, reconnect/offline guidance, sound and desktop-permission recovery messages | Clear |
| Typography | Actual screenshots, wrapping and 14px pending text, selectable/wrapping order IDs and tabular numerals | Clear |
| Colors | Rendered light/dark text, pending panel and button contrasts | Clear: all measured pairs at least 4.5:1; dark note 8.03:1, pending 10.88:1, primary button 5.38:1 |
| UI | Existing token surfaces, Lucide icon weights, persistent non-blocking alert, no new animation; reduced-motion state | Clear |

No actionable interface findings remain in the inspected alert flow. The initial two-pixel CSS focus outline rendered as 1.6px at the laptop's display scale; a scoped three-pixel outline now renders as 2.4px. Screenshots: `output/playwright/merchant-alerts-mobile.png` and `merchant-alerts-dark.png`.

Verdict: **Approve** for the inspected scope, subject to the explicitly unverified OS/background/screen-reader checks above.

## Using the portal

Open `http://localhost:5174`, sign in, and select **Enable sound**. Keep the portal open, the browser unmuted, and the laptop awake. The first click plays a test chime when no orders are waiting. Optional **Enable desktop alerts** requests browser notification permission. Chimes repeat while orders await acceptance/rejection; Mute sound stops them without hiding orders.

The running portal mirror is `C:/Users/mazha/AppData/Local/Temp/sb-merchant-alerts-20261006/apps/shop`. Authoritative code remains in the repository. The mirror is required by this machine's current OneDrive/esbuild issue and should be refreshed from the repository after later edits.
