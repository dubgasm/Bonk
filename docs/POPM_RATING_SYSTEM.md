# POPM Rating System — Architecture & Safety Guide

## Overview

Bonk uses **POPM (Popularimeter)** frames in ID3v2.3 tags to store user ratings (0-5 stars) in audio files. This ensures compatibility with Rekordbox and other DJ software.

**Key Principle:** Rating is stored as a **POPM byte (0/51/102/153/204/255)**. This is the **single source of truth** for Rekordbox.

---

## 🚨 CRITICAL SAFETY RULES

### ⛔ DO NOT DO THESE

1. **DO NOT write ratings via FFmpeg**
   - FFmpeg rating writing is disabled in `electron.js` (lines 2332-2350)
   - Use `audioTags:setRatingByte` instead

2. **DO NOT write ratings in batch operations**
   - Batch tagging, AutoTag, Audio Features do NOT write ratings
   - Only QuickTag writes ratings

3. **DO NOT use different email identifiers**
   - MUST use `'bonk@suh'` everywhere
   - Different emails create multiple POPM frames → Rekordbox confusion

4. **DO NOT use different email identifiers when reading**
   - MUST filter for `'bonk@suh'` only when reading POPM frames
   - Other emails may exist but should be ignored

---

## ✅ Current Implementation

### Writing Ratings

**IPC Handler:** `audioTags:setRatingByte(filePath, ratingByte)`
- **Location:** `electron.js` lines 5078-5160
- **Email:** `bonk@suh` (constant)
- **Process:**
  1. Clamp `ratingByte` to [0, 255]
  2. Remove ALL existing POPM frames (prevents conflicts)
  3. Create new POPM frame with `bonk@suh` email
  4. Set `rating` to `ratingByte`, `playCount` to 0
  5. Save file

**Frontend:** `QuickTagScreen.tsx`
- User clicks stars (0-5)
- Converts to byte using `starsToPopmByte()`
- Stores `ratingByte` in state
- On `Shift+S`, calls `audioTagsSetRatingByte()`

### Conversion Utilities

**File:** `src/utils/popm.ts`

```typescript
// Stars → POPM byte
starsToPopmByte(0) → 0
starsToPopmByte(1) → 51
starsToPopmByte(2) → 102
starsToPopmByte(3) → 153
starsToPopmByte(4) → 204
starsToPopmByte(5) → 255

// POPM byte → Stars
popmByteToStars(0) → 0
popmByteToStars(51) → 1
popmByteToStars(102) → 2
popmByteToStars(153) → 3
popmByteToStars(204) → 4
popmByteToStars(255) → 5
```

---

## 📊 Rating Writers Audit

### ✅ Writers (Only These Write Ratings)

1. **`audioTags:setRatingByte`** (Primary)
   - Email: `bonk@suh` ✅
   - Removes all POPM frames ✅
   - Location: `electron.js:5078`

2. **`audioTags:setRating`** (Legacy, still present)
   - Email: `bonk@suh` ✅
   - Removes only `bonk@suh` POPM frames
   - Location: `electron.js:4974`

### ❌ Non-Writers (These Do NOT Write Ratings)

1. **`write-tags` (FFmpeg handler)**
   - Rating writing DISABLED ✅
   - Comment explains why (lines 2332-2350)

2. **`autotag:start`**
   - Does NOT write ratings ✅
   - Only writes: artist, title, album, genre, year, BPM, key, etc.

3. **`audiofeatures:start`**
   - Does NOT write ratings ✅
   - Only writes: key, BPM, ISRC

4. **`batch-convert-tracks`**
   - Does NOT write ratings ✅
   - Only preserves existing metadata

5. **`apply-smart-fixes`**
   - Does NOT write ratings ✅
   - Calls Python script, doesn't write tags

6. **`BatchGenreUpdateModal`**
   - Does NOT write ratings ✅
   - Calls `writeTags` IPC (which has rating disabled)

7. **`BatchTagUpdateModal`**
   - Does NOT write ratings ✅
   - Only updates in-memory tags

---

## 🔍 Code Locations

### Electron Main Process
- **Rating Writer (Primary):** `electron.js:5078-5160` (`audioTags:setRatingByte`)
- **Rating Writer (Legacy):** `electron.js:4974-5070` (`audioTags:setRating`)
- **FFmpeg Rating (Disabled):** `electron.js:2332-2350` (commented out)

### Frontend
- **UI Component:** `src/components/QuickTagScreen.tsx`
- **Conversion Utils:** `src/utils/popm.ts`
- **Type Definition:** `src/types/track.ts` (has `ratingByte?: number`)

### IPC Bridge
- **Preload:** `preload.js` (exposes `audioTagsSetRatingByte`)
- **App Types:** `src/App.tsx` (type definitions)

---

## 🧪 Testing Checklist

When modifying rating code, verify:

- [ ] 5★ writes byte 255
- [ ] 4★ writes byte 204
- [ ] 3★ writes byte 153
- [ ] 2★ writes byte 102
- [ ] 1★ writes byte 51
- [ ] 0★ writes byte 0 (or removes POPM frame)
- [ ] Only ONE POPM frame exists after save
- [ ] POPM email is `bonk@suh`
- [ ] Rekordbox shows correct stars after Reload Tags
- [ ] Other tags (art, title, etc.) are not lost

---

## 📚 References

- **ID3v2.3 Spec:** POPM (Popularimeter) frame
- **Rekordbox:** Reads POPM ratings for star display
- **OneTagger:** Uses similar POPM system (reference implementation)
- **node-taglib-sharp:** Library used for POPM writing

---

## ✅ Reading Ratings

**Status:** IMPLEMENTED

**Implementation:**
- **Function:** `readBonkPopmRatingByte(filePath)` in `electron.js:71-102`
- Uses `music-metadata` to read POPM frames from ID3v2.3/ID3v2.4 tags
- Filters for email `bonk@suh` only
- Extracts `ratingByte` (0-255) from matching POPM frame
- Returns `undefined` if no matching frame found

**Integration:**
- **Scan Directory:** `electron.js:757` - Reads ratings when scanning folders
- **Reload Track:** `electron.js:1162` - Reads ratings when reloading track metadata
- **FFprobe Fallback:** `electron.js:1016` - Attempts to read ratings even in FFprobe fallback path

**Display:**
- Frontend uses `popmByteToStars()` to convert byte to stars (0-5)
- Displayed in QuickTag table using MUI Rating component

---

**Last Updated:** 2025-01-28
**Status:** Writing ✅ | Reading ✅ (implemented)
