# Offline shop availability — scoped interface review

Scope: customer discovery, product offers, direct shop pages and retained baskets on web and customer mobile. Merchant inventory/iPOS and saved opening hours are not changed.

Required states: online/open shops are shoppable; offline and closed shops remain in the directory without navigation; their offers are hidden; stale additions are rejected; existing baskets remain intact and can be reduced or removed.

Interface criteria: visible status and explanation (not colour alone), no disabled-looking live links, existing surfaces/spacing/type tokens, readable light/dark text, wrapping on narrow screens, native disabled semantics on mobile. Availability is persistent state, not an error toast. Request failures continue using the existing toast/error recovery system.

## Coverage

Stack: Nest/Prisma API, Next/React customer web with existing CSS tokens, React Native customer app with existing theme tokens. Conventions reviewed: project AGENTS, architecture, API contract, backend conventions, deployment, capabilities and remaining-work documents.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Directory static cards, no dead links/tab stops, keyboard navigation; native disabled state/label; explicit retained-basket explanation | Clear within scope |
| Layout | Rendered directory at 1280px and 320px, 640px zoom-equivalent viewport; direct shop recovery; wrapping and unchanged grouping | Clear within scope |
| Writing | Offline versus Closed versus Open; explanation of hidden offers and retained basket; refresh and alternate-shop actions | Clear within scope |
| Typography | Existing title hierarchy; 12px/1.5 unavailable status; no truncation/global fading of status/name | Clear within scope |
| Colours | Computed web text/card contrast in light and dark; theme tokens retained; minimum measured 6.15:1 | Clear within scope |
| UI | Existing cards/icons/surfaces preserved; unavailable cards remove action/chevron; online cards retain navigation | Clear within scope |

## Findings

No actionable interface findings within the inspected availability flow. Prior systemic issue (offline offers advertised but rejected at checkout) is addressed at API and customer interaction boundaries. This is not a whole-app accessibility certification.

## Verification

Passed:

- API and customer-native `node node_modules/typescript/bin/tsc --noEmit`.
- API isolated actual-service tests: availability across located/unlocated feeds, personalized recommendations, detail offers/similar, offline-only items, directory retention, direct shop inventory, guest/customer cart increases versus reductions/removal, online recovery. Registered in `test:remediation:unit`; existing category and cart-merge/checkout suites also exercised.
- Web `node --test test/*.test.cjs`: 13 tests, including link/static-card semantics.
- Native `node --test test/*.test.cjs`: all 50 passed, including the direct-shop source-component test proving cached inventory stays hidden while offline or metadata is unresolved.
- Web `node node_modules/next/dist/bin/next build`: production compilation, type checking and prerendering passed.
- `node scripts/browser-shop-availability.mjs`: mocked local browser checks pass for home/directory, 320px/1280px light/dark cards, no unavailable links/keyboard targets, direct-shop inventory suppression and online recovery, retained basket reductions/removal, blocked checkout and explicit availability refresh. Actual screenshots inspected locally. Minimum status/name text contrast 6.15:1. CI's browser fixture runner includes this check.

Not verified: physical Android/iOS execution, screen-reader output on a device, real database integration/concurrency, live rollout. Zoom was verified using a 640px CSS viewport equivalent to 1280px at 200%, not a native browser zoom command. Browser fixtures use synthetic data and intercept API calls; no live order, shop state, schema, configuration or WhatsApp integration was changed.

## Verdict

Approve for the reported local scope. Production release remains a separate action; native source changes require a new app build to reach installed devices.
