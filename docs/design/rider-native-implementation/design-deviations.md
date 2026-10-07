# Explicit design and platform differences — 2026-10-01

| State/region | Original reference | Native implementation difference | Reason / evidence | Owner approval or check |
|---|---|---|---|---|
| All / OS chrome | Drawn 9:41, signal, battery and preview phone frame | Actual OS status/safe areas; no fake phone frame | Required native adaptation in supplied pack | Native capture pending |
| R02/R04 / map | Fictional street map with route and endpoints | Native SVG recreates decorative blocks/route; label says “Illustrative map · not live GPS”; actual navigation opens encoded destination externally | No verified routing/ETA/GPS geometry from existing API | Compare artwork on device; no live-route claim |
| R14 / location | Explains live location during delivery | Permission state is visible, but no automatic GPS upload; copy explicitly says live sharing is inactive in this build | Sensitive location transmission was rejected by safety review; existing backend route alone is insufficient | Explicit authorization, privacy review and device test needed before enabling |
| R06/R08 / payment | COD and paid examples use fictional amount/state | Exact instruction derives from `paymentMethod` and `paymentStatus`; already-collected COD gets a separate warning; unknown state blocks completion | Prevent duplicate collection and mislabeling | Test with controlled orders |
| R15–R19 / identity | Fictional sign-in and shop fixtures | Real OTP/Google flow and authenticated shop search/application; no demo credentials or sample fallback | Normal screens must use real API | Approved test identities needed |
| All / typography | CSS weight 750 in selected headings | Native `700` weight with matching size/line-height/letter-spacing intent | Font availability/rasterization has not been measured | Native comparison required |
| R21 / offline | Saved address while disconnected | Last fetched order is retained only in mounted screen memory; no durable offline cache | Avoid presenting an unverified persisted state | If offline across relaunch is required, approve secure cache design |
| Main shell / environment | Pack requests live API URL | `.env` still points to localhost; client default is the requested live URL only without the override | Safety review blocked changing config to enable production writes | Explicit approval needed for live configuration/test scope |
| R19 / pending | Dedicated standalone pending composition | Onboarding pending is dedicated; signed-in pending is shown inside Home shell | Existing route structure, no new app | Compare native capture |
| All / reference data | Fixed SB-1048, Rehman, Ayesha and amounts | Normal routes show only returned authorized data; no fixture fallback on failure | Required real-data boundary | Use controlled fixtures only in tests |

Source reference files were not modified. The new native screens use the supplied brand assets and icon geometry; no new visual direction was introduced. This document records deliberate or unverified differences, not approval of visual drift.
