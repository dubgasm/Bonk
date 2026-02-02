### Option A (recommended): request fewer peaks from backend
If `audio.getWaveform(path, points)` currently returns very large arrays (e.g. 3000–6000), try smaller values:
- Footer waveform: **900–1400 points**
- Taller waveform: **1200–1800 points**

This naturally produces thicker bars and a cleaner look.

#### Practical default (do this first)
Pick a single default `points` value and use it everywhere you call `audio.getWaveform(path, points)`:
- Start with **1200 points** (works well for a footer waveform and still looks detailed)

If you want it to scale with UI size:
- Footer waveform (height ~24–40px): **400**
- Larger waveform (height > 40px): **1600**

Implementation hint (renderer):
- Define a constant like `DEFAULT_WAVEFORM_POINTS = 1200`
- When a track is selected, call `audio.getWaveform(selectedPath, DEFAULT_WAVEFORM_POINTS)`
- Keep caching keyed by `(path + mtime + points)` so changing points regenerates once.

Acceptance:
- Bars become visibly thicker / less busy immediately
- No other rendering logic needs to change

Note: don’t go too low (e.g. <400) or the waveform starts to look blocky and loses detail.