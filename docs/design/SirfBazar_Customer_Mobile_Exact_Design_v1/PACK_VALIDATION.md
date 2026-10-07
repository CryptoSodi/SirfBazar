# Package validation

Prepared 6 October 2026. Validation covers this deliverable, not the native application.

- **116/116** immutable reference/native-input files matched their generated SHA256 and byte-size manifest.
- **84** expected screenshot files exist:42 light and 42 dark.
- **42** scene definitions; **48** exact interface icon fragments.
- **18/18** inherited SVG/PNG visual assets matched the source archives byte-for-byte.
- **28/28** completed browser-reference checks; final retest also passed. See QA_REPORT.md for scope.
- **28/28** selected color-pair calculations met their stated targets.
- Authored Markdown relative links were checked; no missing link targets were found.
- Python helper syntax was parsed for: capture_reference.py, compare_png.py, test_preview.py, verify_reference.py.
- compare_png.py's equality smoke test on the same reference image reported zero difference. This checks the helper only; it is not a native visual comparison.
- No font binaries are included. No native TypeScript build, device test, live API mutation or production change was performed.

Generated adapters are source helpers, not independently compiled native packages. Read CODEX_CUSTOMER_EXACT_PROMPT.md for the full implementation task.
