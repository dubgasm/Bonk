# POPM Rating System — Current Status & Warnings

**Last Updated:** 2025-01-28  
**Status:** ✅ Writing Implemented | ✅ Reading Implemented

---

## ✅ What Works

### Rating Writing (Fully Functional)
- **QuickTag Mode:** Users can rate tracks (0-5 stars)
- **Save:** Press `Shift+S` to write rating to file
- **Format:** POPM byte (0, 51, 102, 153, 204, 255) written to ID3v2.3 tag
- **Email Identifier:** `bonk@suh` (consistent across all writers)
- **Safety:** Removes ALL existing POPM frames before writing (prevents conflicts)

### Files Involved
- `src/components/QuickTagScreen.tsx` - UI and save logic
- `src/utils/popm.ts` - Star ↔ byte conversion utilities
- `electron.js:5078-5160` - `audioTags:setRatingByte` IPC handler
- `preload.js` - Exposes API to renderer
- `src/types/track.ts` - `ratingByte?: number` field

---

## ✅ Rating Reading (IMPLEMENTED)

### Reading Functionality
- **Scanning folders:** Ratings ARE read back from files ✅
- **Reloading tracks:** Ratings ARE read back from files ✅
- **Function:** `readBonkPopmRatingByte(filePath)` in `electron.js:71-102`
- **Method:** Uses `music-metadata` to read POPM frames with email `bonk@suh`
- **Display:** Converts byte to stars (0-5) using `popmByteToStars()` for UI display

**Integration Points:**
- `scanDirectory` function (`electron.js:757`) - Reads ratings during folder scan
- `reload-track` handler (`electron.js:1162`) - Reads ratings when reloading track
- FFprobe fallback path (`electron.js:1016`) - Attempts to read ratings even when using FFprobe

---

## 🚨 CRITICAL WARNINGS

### ⛔ DO NOT DO THESE

1. **DO NOT use FFmpeg for rating writing**
   - FFmpeg rating writing is **DISABLED** (`electron.js:2332-2350`)
   - Use `audioTags:setRatingByte` instead
   - If re-enabled, MUST use `'bonk@suh'` email

2. **DO NOT read POPM ratings with different email identifiers**
   - MUST filter for `'bonk@suh'` only when reading
   - Other POPM frames may exist but should be ignored

3. **DO NOT use different email identifiers**
   - MUST use `'bonk@suh'` everywhere
   - Different emails create multiple POPM frames → Rekordbox confusion

4. **DO NOT write ratings in batch operations**
   - Batch tagging, AutoTag, Audio Features do NOT write ratings ✅
   - Only QuickTag writes ratings

---

## 📋 Code Audit Results

### ✅ Rating Writers (Only These Write Ratings)
1. `audioTags:setRatingByte` - Primary writer (`electron.js:5078`)
2. `audioTags:setRating` - Legacy writer (`electron.js:4974`)

### ❌ Non-Writers (These Do NOT Write Ratings)
1. `write-tags` (FFmpeg) - Rating writing DISABLED ✅
2. `autotag:start` - Does NOT write ratings ✅
3. `audiofeatures:start` - Does NOT write ratings ✅
4. `batch-convert-tracks` - Does NOT write ratings ✅
5. `apply-smart-fixes` - Does NOT write ratings ✅
6. `BatchGenreUpdateModal` - Does NOT write ratings ✅
7. `BatchTagUpdateModal` - Does NOT write ratings ✅

---

## 🔍 Key Code Locations

### Electron Main Process
- **Primary Writer:** `electron.js:5078-5160` (`audioTags:setRatingByte`)
- **Legacy Writer:** `electron.js:4974-5070` (`audioTags:setRating`)
- **Rating Reader:** `electron.js:71-102` (`readBonkPopmRatingByte`)
- **FFmpeg Rating (Disabled):** `electron.js:2332-2350` (commented out with warnings)
- **Scan Function:** `electron.js:757` (reads ratings via `readBonkPopmRatingByte`)
- **Reload Function:** `electron.js:1162` (reads ratings via `readBonkPopmRatingByte`)

### Frontend
- **UI:** `src/components/QuickTagScreen.tsx`
- **Utils:** `src/utils/popm.ts`
- **Types:** `src/types/track.ts`

---

## 📚 Documentation Files

- `docs/POPM_RATING_SYSTEM.md` - Complete architecture guide
- `src/styles/Rating.md` - Implementation details and warnings
- `docs/POPM_RATING_STATUS.md` - This file (status summary)

---

## ✅ Completed Work

**POPM Rating Reading:** ✅ Implemented
- Uses `music-metadata` to read POPM frames
- Filters for email `bonk@suh` only
- Handles edge cases (missing frames, multiple frames)
- Integrated into scan and reload functions

---

**Remember:** Rating is stored as a POPM byte (0/51/102/153/204/255). This is the single source of truth for Rekordbox.
