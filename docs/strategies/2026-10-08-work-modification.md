# Work modification strategy — 8 October 2026

Run `20261008T155332Z`, strategy stage. **Proposed for human approval; implementation has not started.**

## Problem and proposal

Merchants need dependable setup, availability controls, relevant notifications and catalogue selection. Customers need readable browsing and understandable authentication without losing their basket. Operators across seven clients need consistent action feedback that preserves recovery controls.

Deliver the eight requests below in the isolated local checkout. Reuse existing components, tokens and providers. Source findings and media interpretation come from the [research report](../research/2026-10-08-work-modification.md); original numbering and requirements follow the [private backlog](../../../work-modification/2026-10-08/README.md). Six screenshots and the complete video duration were reviewed by the parent agent using a sampled sequence. These establish reference behavior, not live-system verification.

All eight items are must-have outcomes; priority controls sequencing, not removal. Authentication implementation and complete notification audience behavior have explicit dependencies.

## Prioritized requirements and acceptance

### 1. Repair merchant setup map — must-have

The no-key/map-ID configuration branch and missing help-dialog CSS are separate confirmed issues. Live Google configuration remains unverified.

Recommend the existing Leaflet `ShopMapPicker` as the local fallback when Google is unavailable. Retain provider attribution, tile-policy constraints, coordinate entry and device location; distinguish module, tile and location failures with recovery. Preserve Google configuration guards and do not change live keys. Style the existing native help dialog with a linked title, bounded scrolling and existing theme tokens.

**Accept when:** a merchant can choose and confirm a pin; provider failure or denied/inaccurate GPS leaves usable coordinate recovery; help opens, closes with Escape and restores focus without clipping on mobile or desktop. Public tiles must not be represented as a guaranteed production service.

### 2. Make availability a switch — must-have

The existing button already toggles availability; its chevron incorrectly suggests a menu. Give it switch semantics, a stable accessible name and visible Online/Offline text. Respect owner/`STORE` permissions and server-owned state. Availability must not imply approval or opening-hours eligibility.

**Accept when:** pointer and keyboard activation submit once, saving prevents rapid duplicate requests, success reflects the server response, and rejection/network failure preserves the saved state with actionable feedback. Test authorized and unauthorized staff.

### 3. Correct notification context — must-have, API dependency

The endpoint currently scopes history by user only. Rider approval is stored as `SYSTEM` without audience/reference context. A person's own rider history can therefore appear in a merchant workspace; neither a foreign-account leak nor this screenshot's exact cause is established. Existing cache scoping exists, but source inspection identified session-change races.

First add local request/socket lifecycle guards and cache partitioning by user, app role and merchant context. Clear visible state on identity changes and reject late completions. Architect must review a schema-compatible audience policy covering creation, list, socket delivery, unread counts and mark-read operations, including ambiguous historical `SYSTEM` entries. Coordinate backend implementation only after the other laptop's merge and subsequent reconciliation direction.

**Accept when:** account A-to-B switches, two users sharing a merchant, logout and role changes cannot display stale state; server-supported audience rules consistently show appropriate history. Do not hide by title, delete history or mark the full item complete from frontend guards alone.

### 4. Improve customer categories — must-have

Adapt the merchant video's parent/child hierarchy, active selection, breadcrumb and category heading to customer search. Keep native links, customer purchase controls and narrow-screen disclosure; omit merchant inventory controls and selection tray. Present the design before changing the approved visual language.

**Accept when:** nested categories, parent selection, deep links, unknown-category recovery and back/forward work; query/category/type/sort state remains coherent. Rapid navigation never pairs a new heading with old results. Selected paths, loading and result counts remain understandable in both themes.

### 5. Repair homepage themes and sliders — must-have

Replace the confirmed white-card/light-text mismatch with existing semantic surface/text pairs and inspect related homepage cards. Place a controlled category rail above Everyday essentials. Give requested horizontal rails named Previous/Next controls, touch scrolling, end states and a visible content cue. Prefer existing CSS scroll-snap behavior with small controls; avoid a new carousel dependency.

**Accept when:** rendered text and controls meet applicable contrast thresholds in both themes; zero/one/many items and resizing behave correctly; keyboard users reach all content, focus remains predictable, and reduced motion works. No autoplay or automatic API page loading.

### 6. Finish action-feedback toasts — must-have across seven clients

Cover customer web, merchant web, admin, standalone POS, customer mobile, merchant mobile and rider mobile. Reuse their existing toast hosts. Migrate confirmed iPOS and Google-link action feedback; audit remaining action paths. Emit each outcome once, translate technical errors, and protect session-specific queued content.

**Accept when:** action outcomes appear above the active dialog/fullscreen layer without stealing keyboard or scanner focus; screen readers receive appropriate announcements; errors/actions remain until dismissed. Field validation, basket reconciliation, uncertain sale/order recovery and persistent Retry controls remain available. Record runtime coverage per client; source counts cannot establish mobile completion.

### 7. Add catalogue Load more — must-have

Replace only shared-catalogue Previous/Next with explicit append of one 24-product page. Deduplicate by product ID, synchronously prevent concurrent append, retain previous pages on failure and retry the failed page. Reset the visible page chain on query/category changes while preserving selected products, price/stock edits and uncertain bulk requests. Ignore stale filter responses.

**Accept when:** overlapping pages, double activation, failures, empty last pages and filter changes produce correct rows and counts; earlier selections survive. Announce added results and preserve focus. Network traces show one bounded next-page request per accepted activation, no whole-catalogue fetch. Do not promise fewer calls solely from the new control; assess long-session rendering cost.

### 8. Redesign customer authentication with ATeam — must-have design gate

Recommend **A: one “Sign in or create an account” sheet**, explaining that verification accesses an existing account or creates one. Preserve the official Google control, WhatsApp code flow and optional name without an extra required step. Entry copy reflects profile or checkout intent.

Before implementation, Designer and Architect must present comparable desktop/mobile variants: **A combined sheet** (fits existing identity semantics), **B separate tabs** (familiar but duplicates the same proof), and **C dedicated page** (more room but additional routing/recovery work). The user must see and approve the selected design; strategy approval alone does not approve auth implementation.

**Accept when:** designs and later checks cover sending, confirmed/unconfirmed submission, verification, incorrect/expired code, response-driven cooldown, change phone, Google cancellation/failure, account-link conflict and session expiry. Preserve guest shopping, one-time basket merge, persistent uncertain-merge recovery, authenticated linking and intended destination. Checkout returns to review without automatically placing an order. Keyboard focus includes links and Google interaction; no proof/token leakage.

## Coordinated execution and boundaries

1. Human strategy gate, then Architect/Designer review contracts, interaction states and variants. Resolve shared-file ownership before edits, especially merchant Products and toast/auth components.
2. Implement independent local work for items 1, 2, 5 and notification lifecycle protection; coordinate item 6's shared feedback behavior before touching overlapping callers.
3. After design review, deliver items 4 and 7 together where category/request-state behavior overlaps. Implement item 8 only after its explicit design approval.
4. After the external merge and reconciliation direction, review item 3's API audience policy and necessary backend overlap. Preserve both laptops' work, including known catalogue import consolidation.

**Nice-to-have, deferred:** animation polish, catalogue virtualization if measurement justifies it, and a dedicated auth route. **Out of scope:** brand redesign, new auth providers, account-enumeration endpoints, unrelated security work, production map/billing changes, deployment or database migrations.

Local work only: no push until explicitly requested; no remote PR, master merge, deployment, live business writes or backend build/server/schema work under this stage. Local API configuration remains `http://localhost:3001/api`.

## Success criteria and evidence

Use the repository's interface skills for accessibility, layout, writing, typography, colors and UI. Require keyboard/focus, 320px/200% zoom, long-label, light/dark and reduced-motion checks where applicable, plus local/mock regression coverage for notification races, catalogue append, checkout recovery and fullscreen toasts. Complete an interface review before declaring substantial UI changes finished.

Parent-reported baseline: **15 existing unit/source checks pass**, borrowing TypeScript through a process-local dependency path; no clean install, browser/phone, post-change or live verification is implied. The pipeline has `verify=null`, which does not waive acceptance checks. Maintain per-item evidence and unresolved dependencies; local implementation, merged code, live web/API and installed mobile completion are distinct. Release remains blocked by unresolved high-impact findings and runtime gaps documented in research.
