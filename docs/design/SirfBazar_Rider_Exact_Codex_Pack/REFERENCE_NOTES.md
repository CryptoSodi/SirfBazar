# Reference completeness notes

All 69 non-directory files of the supplied Rider v1 ZIP are copied unchanged under `reference-v1/`. This includes all 36 screenshots and 26 screen-state definitions.

The original `SCREENSHOTS.json` enumerates 34 primary captures. The two additional PNGs, `35-pickup-confirmation-sheet.png` and `36-design-studio.png`, are described separately by the original `SCREEN_INDEX.md` and `QA_REPORT.md`. This metadata limitation is retained rather than silently rewriting the original.

The new `SCREEN_PARITY_MATRIX.md` covers the 26 app compositions in both themes; the pickup sheet is an additional app overlay. The desktop design studio is review tooling, not a native app screen.

Original build/capture/finalize scripts are preserved for provenance only. Use the new top-level read-only verifier and output-separated render tools. Never regenerate original expected screenshots to hide application differences.
