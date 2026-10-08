# All eight apps: external signals and ecosystem audit

Evidence date: 8 October 2026. ATeam deepdive research stage; audit only. Baseline supplied by orchestrator: `f308e2e`, tree equal to `origin/master` at `66f5b53`. No installs, manifests, application source, servers, database operations, commits or deployment changed. This report owns only this file. Findings distinguish lockfile contents from installed or deployed binaries; neither deployment inventory nor a comprehensive vulnerability scan was performed.

## Findings and recommendation

Prioritize the unsupported mobile runtime line and release verification of existing workflows. Retain already-applied Multer/Vite fixes. Review the Nest core advisory as dependency debt with unconfirmed reachability. Do not automatically upgrade every framework, declare the apps secure from an empty audit result, or repeat vulnerabilities already removed from these lockfiles.

### Resolved inventory

Every row was read from that app's `package.json` and `package-lock.json`. Thus `apps/api` means the exact pair `apps/api/package.json` and `apps/api/package-lock.json`, and similarly for all rows. Values are declaration → actual lock resolution. All dependencies listed are production packages except Vite, which is marked `dev: true` in the locks.

| Exact app directory | Manifest range → resolved lock version |
| --- | --- |
| `apps/api` | Nest common/core/platform-express `^10.4.15` → `10.4.22`; Express transitive → `4.22.1`; Multer override `^2.4.0` → `2.4.0` |
| `apps/web` | Next exact `16.4.0` → `16.4.0`; React/React DOM `^18.3.1` → `18.3.1` |
| `apps/admin` | React/React DOM `^19.1.0` → `19.2.7`; Vite `^6.3.5` → `6.4.3` |
| `apps/shop` | React/React DOM `^19.1.0` → `19.2.7`; Vite `^8.3.1` → `8.3.1` |
| `apps/pos` | React/React DOM `^19.1.0` → `19.2.7`; Vite `^6.3.5` → `6.4.3` |
| `apps/customer-app` | Expo `~54.0.37` → `54.0.37`; React/React DOM exact `19.1.0`; RN exact `0.81.5`; notifications `~0.32.17` → `0.32.17` |
| `apps/merchant-app` | Expo `~54.0.0` → `54.0.35`; React exact `19.1.0`; RN exact `0.81.4`; notifications `~0.32.17` → `0.32.17` |
| `apps/rider-app` | Expo `~54.0.0` → `54.0.35`; React exact `19.1.0`; RN exact `0.81.4`; notifications `~0.32.17` → `0.32.17` |

### 1. High priority: native support debt across all three mobile apps

React Native's current release table labels `0.81.x` unsupported, while `0.86.x` and `0.87.x` are active. This is a confirmed maintenance risk, not evidence of a particular exploit. A patch within 0.81 cannot restore upstream support. [React Native release status](https://reactnative.dev/releases/).

Use an Expo-compatible target, not a standalone RN bump: Expo SDK 57 supplies RN 0.86; `expo@57.0.17` updates to RN 0.86.3 and fixes documented memory/startup regressions. That is a concrete minimum candidate for a supported-line migration from the reviewed evidence, not a claim it is the latest or universally safest patch. Follow Expo's incremental SDK upgrade process and regenerate development builds. [Expo SDK 57 release notes](https://expo.dev/changelog/sdk-57), [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

Potential breaking areas: SDK54→55→56→57 compatibility, React 19.1→19.2, native maps/Google sign-in/screens modules, config plugins and native build tooling. Verify notification registration and taps, foreground GPS, safe areas, Android back, auth persistence, and checkout/delivery recovery on installed Android/iOS builds. RN0.81 already targets Android16 edge-to-edge, so safe-area checks are relevant even before migration. [RN0.81 platform changes](https://reactnative.dev/blog/2025/08/12/react-native-0.81).

### 2. Medium priority: Nest core advisory matches version, SSE reachability not established

`apps/api/package-lock.json` resolves core10.4.22. GHSA-36xv-jgw5-4q75 lists versions through11.1.17 and patch11.1.18. It requires attacker-influenced SSE `type` or `id` fields, allowing event injection; searches for `@Sse` and `Sse(` in `apps/api/src` found no matches. Existing Socket.IO is not evidence of SSE usage. Track this as a dependency advisory match with no demonstrated application path. [Nest SSE advisory](https://github.com/nestjs/nest/security/advisories/GHSA-36xv-jgw5-4q75).

The minimum published fix for this advisory is11.1.18; no10.x backport was established. Upgrade coordinated Nest packages after compatibility review, not core alone. Major-version route/parser/adapter changes require auth, upload and routing regression checks. Recent Fastify middleware-bypass headlines concern `@nestjs/platform-fastify`; this API uses platform-express, so do not label them an established auth bypass here. [Nest Fastify advisory](https://github.com/nestjs/nest/security/advisories/GHSA-9c5c-9qcx-q35q).

### 3. Preserve Multer fix; upload validation remains independent

The October7 research observed2.0.2; this baseline resolves2.4.0 under the explicit override in `apps/api/package.json:59`. Official aborted-disk-upload GHSA-3pph-fpjx-jg34 affects2.2.0–before2.4.0 and fixes2.4.0. The current resolution meets that floor. Do not downgrade to2.2 merely because an older advisory first fixed there. [Multer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34).

`apps/api/src/uploads/uploads.controller.ts:19` uses a6MiB limit and accepts the client MIME prefix `image/`, then writes `file.buffer` using an extension derived from the original filename. This is not Multer diskStorage, and the dependency patch does not establish safe image contents. Main security review should validate actual bytes/allowed formats, downstream serving policy, rejected/aborted uploads and resource limits. No malformed upload was sent. Any upgrade must retain the override until the framework's dependency resolution supplies a tested fixed version.

### 4. Next/React: verify advisory applicability without inventing patch versions

Next16.4.0 is above the explicit16.3.6 patch for the Node `next/og` ImageResponse RCE advisory; source search also found no `next/og`/`ImageResponse` usage. [Official ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).

Two September30 primary advisories still render literal `16.3.?` patch placeholders. The SSG/ISR advisory also gives an open-ended affected range. These records do not support a precise minimum-safe-version assertion. Source has no root catch-all page, no `use cache` or `draftMode` matches, and `apps/web/next.config.mjs` defines no remotePatterns. The image SSRF advisory explicitly excludes apps without remotePatterns. These observations narrow the described paths; they do not prove the entire deployment safe. Resolve ambiguous vendor metadata before prescribing a security upgrade. [SSG/ISR cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p), [Image SSRF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4).

Do not infer React Server Components RCE from native React19.1.0 or Vite React19 alone. React's advisory concerns server-component packages/framework paths and explicitly distinguishes client-only applications. Conversely, the web app's top-level React18 version does not certify Next's bundled server implementation. Keep RN's supported React pairing; verify Next as a framework unit. [React official advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components).

### 5. Vite6 is still security-supported; current locks already meet reviewed fix

Admin/POS resolve6.4.3, the published fix for the Windows alternate-path `server.fs.deny` bypass; shop8.3.1 is above the8.0.16 fix. Exploitation described by the advisory concerns a network-exposed development server and accessible sensitive files, not a compiled static asset bundle. [Vite Windows advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

Vite's current policy still backports security fixes to6.4. Standardizing three apps on8 is optional maintenance work, not a demonstrated release security blocker from this evidence. A major upgrade changes build tooling and plugins; schedule it separately if useful. Minimum remediation for the reviewed issue is already achieved; continue monitoring6.4 until migration. [Vite support policy](https://vite.dev/releases), [Vite8 release changes](https://vite.dev/blog/announcing-vite8.html).

### 6. Platform workflow gate: push, scanner, modal and auth recovery

ExternalSignals: Expo push is designed for at-least-once handoff to APNs/FCM, so duplicate delivery and delayed delivery are normal design inputs. Receipts and `DeviceNotRegistered` cleanup matter; a successful send is not proof of user receipt. Validate all three `apps/*-app/lib/push.ts` implementations and `apps/api/src/notifications/notifications.service.ts` for account switching, duplicate taps, stale tokens and foreground/background/cold-start behavior. Android remote push on SDK53+ requires a development build, so Expo Go is inadequate proof. [Expo push FAQ](https://docs.expo.dev/push-notifications/faq/), [SDK54 notification reference](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

Trends: favor explicit recoverable operations over extra animation or new dependencies. `apps/shop/src/pages/IPos.tsx:347` already implements a keyboard-wedge barcode/SKU field and Enter/Tab suffix handling. Test real scan bursts, leading zeros, duplicate matches, modal transitions and focus return. No expo-camera dependency was present in the inspected manifests; a camera scanner is a different product addition, not a missing dependency patch.

Ecosystem: modal dialogs should contain keyboard focus, expose a title, close appropriately with Escape and restore focus. Test these against scanner focus and Google iframe/popup behavior in `apps/web/components/LoginSheet.tsx` and shop dialogs. Keep the official Google-rendered button and current WhatsApp/guest-basket recovery contract. The earlier auth design comparison remains a review input, not permission to replace providers or auto-submit an order. [WAI modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Google button guidance](https://developers.google.com/identity/gsi/web/guides/display-button).

Community: upstream maintainer advisories and Expo release notes provide actionable evidence; generic popularity and competitor feature lists do not establish this product's defects. No competitor parity claim is made, and no branded assets are recommended. Existing iPOS workflow research remains useful for explicit mapping/preview and honest partial compatibility; it is not an official CSV schema.

## Comparison and decision

| Alternative | Concrete trade-off | Recommendation |
| --- | --- | --- |
| Freeze all current dependencies | Preserves existing build behavior but leaves RN0.81 unsupported and Nest advisory debt. [RN support](https://reactnative.dev/releases/) | Short audit baseline only; not a long-term support strategy |
| Selective migration with current workflow tests | Move native apps along Expo's supported sequence, retain already-fixed Multer/Vite, resolve Nest/Next applicability; native build/device effort remains. [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) | Recommended; separate native migration from UI repairs and API behavior changes |
| Upgrade all apps to latest majors together | More simultaneous parser/build/native changes, harder fault attribution; Vite6 security support shows this is not required solely by age. [Vite policy](https://vite.dev/releases) | Defer broad modernization unless a concrete requirement justifies it |

## Existing research and verification limits

Read both existing `docs/research/2026-10-07-remediation-merchant-workflows.md` and `docs/research/2026-10-08-work-modification.md`. The former's Multer2.0.2 observation is superseded by current2.4.0; its money/auth/recovery gap map is historical and must be rechecked by the current code audit. The latter preserves eight request numbers and auth variants; it predates current consolidation, so duplicate imports, source lines and claims of missing dependencies are not automatically current defects. Do not renumber the saved requests.

September architecture/capability/remaining-work records contain stale app counts, SQLite references and launch gaps. `docs/deployment.md` now explicitly labels Windows/tunnel steps legacy and points to the current API deployment record. Never execute historical seed/db-push/tunnel instructions as release remediation.

The required better-interface and six domain skills were read to inform verification scope. This specialist pass did not perform a rendered interface review. Accessibility/layout/writing guidance informs item6; typography/colors/UI polish have no newly verified visual finding here. Keyboard traversal, screen-reader output, 320px/200% reflow, dark-mode rendered contrast and native safe-area behavior are **Not verified**. No interface approval is issued. Parent/QA own builds and regression execution. Locks were inspected via read-only Node JSON parsing; source reachability via ripgrep; all shell commands used RTK. Package absence and no search matches are bounded observations, not comprehensive security proof.

Recommended handoff: incorporate these six evidence groups into the strategy gate; keep security/support work distinct from the eight requested presentation changes. Release remains contingent on the current cross-app correctness audit and real build/device verification, not this research report alone.
