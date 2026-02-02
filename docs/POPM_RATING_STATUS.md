# POPM Rating System — Current Status & Warnings

**Last Updated:** 2025-01-28  
**Status:** ✅ Writing Implemented | ❌ Reading Not Implemented

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

## ❌ What Doesn't Work (Yet)

### Rating Reading (NOT IMPLEMENTED)
- **Scanning folders:** Ratings are NOT read back from files
- **Reloading tracks:** Ratings are NOT read back from files
- **Impact:** Ratings persist in files but don't show in UI until reading is implemented

**Why not yet:**
- Need to handle edge cases (multiple POPM frames, missing frames, etc.)
- Need thorough testing
- Current system works for writing (ratings are saved to files)

---

## 🚨 CRITICAL WARNINGS

### ⛔ DO NOT DO THESE

1. **DO NOT use FFmpeg for rating writing**
   - FFmpeg rating writing is **DISABLED** (`electron.js:2332-2350`)
   - Use `audioTags:setRatingByte` instead
   - If re-enabled, MUST use `'bonk@suh'` email

2. **DO NOT read POPM ratings yet**
   - Reading is NOT implemented
   - Code comments warn about this in scan/reload functions
   - Will use `music-metadata` when ready

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
- **FFmpeg Rating (Disabled):** `electron.js:2332-2350` (commented out with warnings)
- **Scan Function:** `electron.js:757` (warning comment: ratings NOT read)
- **Reload Function:** `electron.js:1122` (warning comment: ratings NOT read)

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

## 🔮 Future Work

**Priority:** Implement POPM rating reading
- Use `music-metadata` to read POPM frames
- Filter for email `bonk@suh` only
- Handle edge cases (multiple frames, missing frames, etc.)
- Test thoroughly before enabling

---

**Remember:** Rating is stored as a POPM byte (0/51/102/153/204/255). This is the single source of truth for Rekordbox.
