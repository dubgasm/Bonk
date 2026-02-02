# POPM Rating System (Rekordbox + AIFF/MP3) — Implementation Guide

## ✅ Current Status (IMPLEMENTED)

**Rating writing is fully functional:**
- ✅ QuickTag mode allows rating tracks (0-5 stars)
- ✅ Ratings are written as POPM bytes (0, 51, 102, 153, 204, 255) to files
- ✅ Uses `node-taglib-sharp` with ID3v2.3 for maximum Rekordbox compatibility
- ✅ Email identifier: `bonk@suh` (consistent across all writers)
- ✅ Removes ALL existing POPM frames before writing (prevents conflicts)

**Rating reading is NOT YET IMPLEMENTED:**
- ❌ Ratings are NOT read back when scanning folders
- ❌ Ratings are NOT read when reloading tracks
- ⚠️ **This means ratings don't persist across sessions** (they're saved to files but not loaded back)

---

## 🚨 CRITICAL WARNINGS — DO NOT DO THESE

### 1. **DO NOT use FFmpeg for rating writing**
- FFmpeg rating writing is **DISABLED** in `electron.js` (lines 2332-2350)
- **Reason:** FFmpeg can create duplicate POPM frames or interfere with Rekordbox
- **If re-enabled:** MUST use `'bonk@suh'` as email identifier (currently commented out)

### 2. **DO NOT read POPM ratings from files (yet)**
- **Status:** Reading is NOT implemented
- **Why:** Need to ensure we only read `bonk@suh` ratings, handle edge cases, and test thoroughly
- **Future:** Will use `music-metadata` to read POPM frames with email `bonk@suh`

### 3. **DO NOT use different email identifiers**
- **MUST use:** `'bonk@suh'` everywhere
- **Why:** Rekordbox may read different POPM frames, causing inconsistent ratings
- **Current writers:** All use `const POPM_EMAIL = 'bonk@suh'`

### 4. **DO NOT write ratings in batch operations**
- Batch tagging (`write-tags` handler) does NOT write ratings ✅
- AutoTag does NOT write ratings ✅
- Audio Features does NOT write ratings ✅
- **Only QuickTag writes ratings** via `audioTags:setRatingByte`

---

## 📋 Implementation Details

### Rating Storage
- **In memory:** `track.ratingByte` (number, 0-255) — single source of truth
- **In file:** POPM frame with email `bonk@suh` and rating byte (0-255)
- **Display:** Stars (0-5) derived from `ratingByte` using `popmByteToStars()`

### Conversion Functions (`src/utils/popm.ts`)
```typescript
// Stars → POPM byte (for writing)
starsToPopmByte(5) → 255
starsToPopmByte(4) → 204
starsToPopmByte(3) → 153
starsToPopmByte(2) → 102
starsToPopmByte(1) → 51
starsToPopmByte(0) → 0

// POPM byte → Stars (for display)
popmByteToStars(255) → 5
popmByteToStars(204) → 4
popmByteToStars(153) → 3
popmByteToStars(102) → 2
popmByteToStars(51) → 1
popmByteToStars(0) → 0
```

### IPC Handler
- **Primary:** `audioTags:setRatingByte(filePath, ratingByte)` 
  - Accepts `ratingByte` directly (0-255)
  - Removes ALL POPM frames before writing
  - Creates new POPM frame with `bonk@suh` email
  - Location: `electron.js` lines 5078-5160

- **Legacy:** `audioTags:setRating(filePath, ratingByte)` (still present but prefer `setRatingByte`)

---

## 🔧 How It Works

### Writing Flow
1. User clicks stars in QuickTag UI (0-5 stars)
2. `starsToPopmByte()` converts to byte (0-255)
3. `updateRatingForTrack()` stores `ratingByte` in state
4. User presses `Shift+S` to save
5. `handleSave()` calls `audioTagsSetRatingByte(track.Location, ratingByte)`
6. Electron handler:
   - Removes ALL existing POPM frames
   - Creates new POPM frame with `bonk@suh` email and `ratingByte`
   - Saves file

### Reading Flow (NOT YET IMPLEMENTED)
**Future implementation will:**
1. When scanning folders, read POPM frames from files
2. Filter for email `bonk@suh` only
3. Extract `ratingByte` from POPM frame
4. Set `track.ratingByte` in state
5. UI displays stars using `popmByteToStars(ratingByte)`

---

## ✅ Acceptance Criteria (Writing)

- ✅ Selecting **5★** writes **POPM rating byte = 255**
- ✅ Selecting **4★** writes **204**, etc.
- ✅ Rekordbox shows correct stars after **Reload Tags**
- ✅ No other tags (art/title/etc.) are lost
- ✅ Only ONE POPM frame exists per file (with `bonk@suh`)

---

## 📝 Files Modified

- `src/utils/popm.ts` - Conversion utilities
- `src/components/QuickTagScreen.tsx` - UI and save logic
- `electron.js` - IPC handlers (`audioTags:setRatingByte`)
- `preload.js` - Exposes `audioTagsSetRatingByte` to renderer
- `src/types/track.ts` - Added `ratingByte?: number` field

---

## 🔮 Future Work

1. **Implement POPM reading** using `music-metadata`
   - Read POPM frames with email `bonk@suh`
   - Handle edge cases (multiple frames, missing frames, etc.)
   - Test thoroughly before enabling

2. **Consider reading other POPM frames** (optional)
   - Could read ratings from other sources (e.g., iTunes, Windows Media Player)
   - Would need user preference for which email to prioritize
   - **Not recommended** — stick to `bonk@suh` only