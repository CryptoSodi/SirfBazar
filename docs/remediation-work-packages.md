# SirfBazar remediation work packages

Saved on 7 October 2026. Proposed work order for project reliability, security and recovery improvements. Saving this plan does not start implementation.

| Order | Work package | Priority / effort | Owner |
| ----- | ------------ | ----------------- | ----- |
| 1 | Enforce payment authority; prevent duplicate refunds and settlements | P0 / Large | Architect + Dev; QA + Reviewer |
| 2 | Remove OTP leaks; enforce account state and tenant ownership | P0 package / Large | Architect + Dev + Reviewer |
| 3 | Make inventory changes atomic; enforce eligibility, destination and approved quote | P0 package / Large | Architect + Dev + QA |
| 4 | Repair web/POS recovery and both keyboard-access defects | P1 / Large | Dev + QA |
| 5 | Patch Next/Multer and verify clean lockfile-based builds | P1 / Medium | Dev + Reviewer + QA |
| 6 | Extend CI to all eight apps; add database, native and staging journey checks | P1 / Large | QA + Architect |
| 7 | Fix search/push lifecycle; decide GPS scope and update capability documentation | P1 if promised, otherwise P2 / Medium | PM + Dev + QA |
