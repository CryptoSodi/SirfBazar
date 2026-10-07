# Computed reference observations

These JSON files were measured from the unchanged HTML at 390×844 logical units, 2× pixel scale in local Chromium. They contain computed styles/bounds and fictional rendered text, not native measurements or live records.

Included: Home/light, delivery code/dark, pickup confirmation/light. The top-level render tool can generate other states into a fresh directory. No network requests were observed in these three runs.

The source phone status bar is 28 logical units. Do not reproduce its fake clock in the native app. Compare app-controlled content after accounting for genuine device insets.

The declared font stack in the JSON is not proof of a loaded Plus Jakarta Sans font. These reference renders used the available browser fallback, as did the original PNGs.
