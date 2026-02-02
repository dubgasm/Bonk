# Cursor Instructions — Make Waveform Smooth + Draggable + Bigger (OneTagger-like)

## Problems to solve
1) Waveform playhead isn’t perfectly smooth
2) Scrubbing only works on click, not drag
3) Waveform area is too small / hard to interact with

## Approach (safe + proven)
- Keep waveform as **canvas**
- Make progress smooth using **requestAnimationFrame** (UI interpolation)
- Add **pointer-based drag scrubbing**:
  - During drag: update UI playhead instantly
  - Call backend seek either:
    - (Recommended) only on pointer up, OR
    - throttled during drag (e.g., 10–12 seeks/sec)
- Increase waveform height + increase click target area

---

## UI tweaks (bigger + easier interaction)

### CSS (bigger waveform + easier to grab)
Add/adjust:

```css
.quicktag-wave-wrap{
  position: relative;
  width: 100%;
  /* Bigger than 24px like OneTagger */
  height: 40px;
  padding: 8px 0;           /* increases hit area without changing waveform height too much */
  cursor: pointer;
  user-select: none;
  touch-action: none;       /* IMPORTANT: prevents scrolling/selection during drag */
}

.quicktag-wave{
  width: 100%;
  height: 100%;
  display: block;
}

.quicktag-playhead{
  position: absolute;
  top: 6px;                 /* align with waveform */
  bottom: 6px;
  width: 2px;
  background: var(--accent);
  transform: translateX(-1px);
  pointer-events: none;
  opacity: 0.95;
}