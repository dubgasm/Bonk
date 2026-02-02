# Quick Tag Bottom Player — Layout Measurements

Living notes for the Quick Tag bottom player so we can keep the UX consistent and reproduce it later.

---

## Overall bar (`.quicktag-player`)

- **Height**: `64px`
- **Padding**: `8px 16px`
- **Position**: `fixed` at the bottom, full width  
  - `left: 0; right: 0; bottom: 0;`
- **Layout**: `display: grid`
  - `grid-template-columns: 260px minmax(0, 1fr) 260px`
  - This gives:
    - Left: fixed 260px (play + title/artist)
    - Center: flexible area for waveform + time
    - Right: fixed 260px (folder + volume)

---

## Left section (`.quicktag-player-left`)

- **Gap between play button and text**: `10px`
- **Play button (`.quicktag-player-btn`)**
  - Size: `32px × 32px`
  - Shape: `border-radius: 999px` (circle)
  - Background: `var(--accent)`
  - Color: `#000`

### Text (`.quicktag-player-meta`)

- **Title (`.quicktag-player-title`)**
  - `font-size: 14px`
  - `font-weight: 500`
  - `white-space: nowrap`
  - `text-overflow: ellipsis`
  - `overflow: hidden`

- **Artist (`.quicktag-player-artist`)**
  - `font-size: 12px`
  - `color: var(--text-secondary)`

---

## Center section (`.quicktag-player-center`)

- **Flex behavior**
  - `flex: 1`
  - `max-width: 560px`
- **Padding**: `0 24px`
- **Offset**: `margin-left: 190px`  
  - Manual nudge to visually center waveform/time between the fixed left/right blocks.

### Progress “waveform” (`.quicktag-player-progress-bar`)

- **Height**: `4px`
- **Border radius**: `999px`
- **Background**:

```css
background:
  repeating-linear-gradient(
    to right,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.12) 2px,
    transparent 2px,
    transparent 4px
  );
```

- **Fill (`.quicktag-player-progress-fill`)**
  - Full width, scaled in X:
  - `transform-origin: left center;`
  - `background: var(--accent);`

### Time display (`.quicktag-player-time`)

- **Margin-top**: `4px`
- **Layout**:
  - `display: flex`
  - `justify-content: center`
  - `gap: 4px`
- **Font size**: `11px`
- **Color**: `var(--text-secondary)`

---

## Right section (`.quicktag-player-right`)

- **Layout**:
  - `display: flex`
  - `align-items: center`
  - `gap: 8px`

### Folder button (`.quicktag-player-btn.quicktag-player-btn-secondary`)

- Base button same as play/pause (`32px × 32px`, circular)
- Secondary styling:
  - `background: var(--bg-tertiary);`
  - `color: var(--text-primary);`
  - `:hover -> background: var(--bg-secondary);`

### Volume slider (`.quicktag-player-volume`)

- **Width**: `120px`

---

## Quick Tag track list (top panel)

- **Tracklist container (`.quicktag-tracklist`)**
  - `padding: 4px`
  - `border-radius: 8px`
  - `border: 1px solid var(--border)`
  - `background: var(--bg-secondary)`
  - `overflow-y: auto`

- **Empty state (`.quicktag-empty`)**
  - `padding: 24px`
  - `text-align: center`

- **Track row (`.quicktag-track-row`)**
  - Width: full, `display: flex`, `justify-content: space-between`
  - `padding: 8px 10px`
  - `border-radius: 6px`
  - `background: transparent` (hover + active styles applied)

- **Track meta (`.quicktag-track-meta`)**
  - `gap: 8px`
  - `font-size: 11px`

- **Key/BPM pills**

```css
.quicktag-track-key,
.quicktag-track-bpm {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
```

---

## Timing behavior (QuickTagPlayer)

- Local timer in the renderer:
  - Ticks every **80 ms** via `setInterval`.
  - Uses:
    - `lastKnownPosRef` (seconds at last pause/seek)
    - `playStartRef` (`performance.now()` when playback starts)
  - Position computed as:
    - `pos = min(duration, lastKnownPos + elapsedSeconds)`

