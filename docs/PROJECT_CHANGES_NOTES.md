# Project Changes Notes (Warp / Recent Work)

This document summarizes UI/UX, Import Folder, QuickTags, and album art changes in the codebase for future reference.

---

## 1. UI/UX Standards

**Reference:** `UI_STANDARDS.md` (gold standard: Import Folder / Library screen)

### Layout
- **Three-column grid:** `[sidebar] minmax(0, 1fr) [detail]` — left (e.g. 220px), center flexible, right (e.g. 280px).
- **Collapsible sidebars:** Both left and right with state; grid columns adjust (e.g. `0px` when hidden).
- **Shortcuts:** `Cmd/Ctrl + [` (left), `Cmd/Ctrl + ]` (right), `Cmd/Ctrl + \` (both). Toggle buttons and 0.3s ease transitions.

### Track table
- **Columns:** Artwork (32–36px), Title, Artist, Album, Genre, Rating (100px), Key; CSS grid with `minmax()` and 12px gap.
- **Rows:** Auto height, 6px padding, 6px radius; hover `rgba(255,255,255,0.04)`, selected `rgba(0,200,255,0.12)`.
- **Artwork:** 32px square, 4px radius, lazy load + LRU cache (100), placeholder ♪, fade-in when loaded.

### Performance
- **Virtual scrolling:** `@tanstack/react-virtual` for lists > 100 items; `estimateSize` ~48px, overscan 5.
- **CSS:** `overflow-y: auto`, `will-change: transform`, `contain: layout style paint` where appropriate.
- **Memo:** Filtered lists and row components memoized; stable callbacks with `useCallback`.

### Don’ts
- No `position: fixed` for sidebars; no animating `width`/`height` (use transform); no rendering all rows when > 100; no blocking main thread > 16ms.

---

## 2. Import Folder

**Locations:** `App.tsx` (welcome + main flow), `electron.js` (`scanFolder`), `preload.js`.

### Flow
- **Entry:** Welcome screen “Import Folder” button (`handleImportFolder`) or header (when implemented).
- **Steps:** `selectFolder()` → `scanFolder(folderPath)` → merge with existing library or set new.
- **Duplicate handling:** Normalize `Location` (strip `file://localhost`, `file://`, lowercase, trim). Merge by excluding tracks that match existing by normalized path or `TrackID`.
- **Drag & drop:** Supports folders and audio files; directories use `scanFolder` per folder; files use parent directory scan then filter to dropped filenames. Same merge/duplicate logic as Import Folder.

### Welcome screen
- Two sections: “Rekordbox management” (Import from DB, Custom DB Path, DB manager) and “Tags & Music management” (Import Folder, Quick Tag, Auto Tag; Audio Features, Manage Genres).
- “Import Folder” uses class `import-btn-large import-btn-folder`; hint: “Drag & drop XML or folders anywhere to import”.

---

## 3. QuickTags (Quick Tag Screen)

**Main file:** `src/components/QuickTagScreen.tsx`. Also: `QuickTagPlayer.tsx`, `QuickTagContextMenu.tsx`, `MoodPillTags.tsx`, `mood-pills.css`.

### Structure
- **Toolbar:** Choose folder, Parent (⬆️), Auto play, Auto-save/Manual save, Settings, **Columns** dropdown.
- **Three areas:** Left = folder tree (from `buildFolderTree`), Center = track list (grid with optional search), Right = track details (rating, mood pills, comments).
- **Folder tree:** Built from `allScannedTracks` (cache); “Parent folder” goes up without re-scan (`loadFolder(parent, { skipScan: true })`). Tree selection sets `selectedFolderPath`; visible tracks filtered by path + search.

### Column visibility (Quick Tag)
- State in `visibleColumns` (artwork, title, artist, album, genre, rating, key); persisted in `localStorage` key `quicktag-visible-columns`.
- “▦ Columns” dropdown toggles each column; grid template computed from visible columns (e.g. `36px`, `minmax(140px, 2fr)`, …).
- Rating and Key hidden by default (rating in right sidebar).

### Track list
- Rows show artwork (from `track.AlbumArt` or ♪), title, artist, album, genre, optional rating (Rating component), key.
- Inline search in title column; `visibleTracks` = tracks under `selectedFolderPath` filtered by search.
- Row click selects track; context menu → “Show in Finder” via `showItemInFolder`.

### Right sidebar (selected track)
- Large title/artist.
- **Rating:** `Rating` component; `ratingByte` (POPM) as source of truth; optional auto-save or manual (Shift+S).
- **Mood:** `MoodPillTags` — categories (Energy, Genre) with expand/collapse; pills toggle mood; writes TMOO via `audioTagsSetMood` and updates local state.
- **Comments:** Textarea; save on blur via `audioTagsSetComments`.

### Settings modal
- Autosave when switching track, Auto play on select, Start playback after seek, Go to next track on end.

### Keyboard
- Space: play/pause. Left/Right: seek −10s / +10s. Up/Down: prev/next track (with optional auto-play). Shift+S: save rating.

### Data
- `tracks` = current folder scan; `allScannedTracks` = cumulative cache for tree and “go up” without re-scan. Rating updates applied to both.

---

## 4. Album Art Fixes (Lazy Loading + LRU)

**Problem addressed:** Loading all album art up front was heavy; goal: on-demand loading with bounded memory.

### Architecture
- **Store:** `src/store/useAlbumArtStore.ts` — Zustand store with `cache` (Map), `loadingQueue` (Set).
- **Component:** `src/components/LazyAlbumArt.tsx` — used in library TrackTable; loads when visible.
- **IPC:** `extract-album-art` in `electron.js`, exposed as `extractAlbumArt(location)` in preload / `window.electronAPI`.

### useAlbumArtStore
- **LRU cache:** Max 100 entries; evict by `lastAccessed` (never evict loading entries).
- **Actions:** `getAlbumArt(trackId, location)` — return cached or trigger load; `setAlbumArt(trackId, data)` for pre-loaded data; `requestAlbumArt(trackId, location)`; `markLoaded(trackId, data, error)`; `clearCache()`; `preloadForTracks(ids, getLocation)` (e.g. first 20).
- **Entry:** `{ data: string | null, loading: boolean, error: string | null, lastAccessed: number }`.

### LazyAlbumArt component
- **Props:** `trackId`, `location`, `albumArt` (pre-loaded from scan), `size`, `className`.
- If `albumArt` provided and not in cache → `setAlbumArt(trackId, albumArt)`.
- Else if no cache and `location` → `getAlbumArt(trackId, location)` (triggers request).
- Renders: placeholder (♪ or ⏳) when loading/missing; otherwise `<img>` with `entry.data`, `object-fit: cover`, `loading="lazy"`, `decoding="async"`.

### Main process (`extract-album-art`)
- Normalize path (strip `file://localhost`, `file://`, decode).
- Check file exists.
- **FFprobe** to see if file has embedded artwork (video stream mjpeg/png).
- If no artwork → return `null`.
- **FFmpeg** extract one frame to temp jpg (`-an -vframes 1 -vcodec mjpeg -q:v 5`), 3s timeout; read file, return base64 data URL; delete temp file.
- Ensures album art extraction doesn’t hang the UI and doesn’t run for files without art.

### Library TrackTable
- Uses `LazyAlbumArt` with `trackId`, `location` from track, and `albumArt` from `(track as any).AlbumArt` so scan-loaded art is used when available and lazy extraction is fallback.

### Scan path (folder import)
- In `electron.js`, folder scan can still populate `AlbumArt` (base64) when reading metadata (e.g. music-metadata); that data is then used by LazyAlbumArt via `setAlbumArt` so we don’t re-extract for those tracks.

---

## 5. Library Screen (Import Folder View) Enhancements

### Column store
- **File:** `src/store/useColumnStore.ts` (persisted in localStorage as `bonk-column-config`).
- **Columns:** checkbox, art, title, artist, album, genre, bpm, key, time, tags, year — each with `id`, `label`, `width`, `visible`, `resizable`, optional `minWidth`/`maxWidth`.
- **Order:** `columnOrder` array. Actions: `setColumnWidth`, `setColumnOrder`, `setColumnVisibility`, `setFontSize` / `cycleFontSize`, `resetColumns`.
- **Font sizes:** `small` | `medium` | `large` (row height 44 / 50 / 56).

### TrackTable
- Uses `useColumnStore`: `columns`, `columnOrder`, `fontSize`. Visible columns and `gridTemplate` derived from store.
- **Virtual scrolling:** `useVirtualizer` with `parentRef`, `estimateSize: rowHeight`, `overscan: 10`.
- **Sortable column headers** (drag to reorder) and optional resize handles; artwork column uses `LazyAlbumArt`.

### TrackTableToolbar
- Uses `useColumnStore` for **Columns** menu (show/hide per column, Reset) and **font size** cycle button (Type icon).

---

## 6. New / Notable Components

- **MoodPillTags** (`MoodPillTags.tsx` + `mood-pills.css`): Categories (Energy, Genre), expandable; pill toggles; used in Quick Tag right sidebar for Mood (TMOO).
- **VibeFilterSidebar** (`VibeFilterSidebar.tsx`): Filter by “vibes” (World, Style, Mood); checkboxes; “Add Custom Note” placeholder. Styled with `mood-pills.css`; can be used for library filtering when wired.
- **useColumnStore:** Central column visibility, order, width, and font size for the main track table.

---

## 7. Types

- **Track** (`src/types/track.ts`): `AlbumArt?: string`, `Mood?: string`, `ratingByte?: number`, `Comments?: string`, plus existing fields. Used by both library and Quick Tag.
- **Window.electronAPI** (`App.tsx`): Includes `extractAlbumArt`, `audioTagsSetRatingByte`, `audioTagsSetMood`, `audioTagsSetComments`, `showItemInFolder`, and Rust audio + scan/import APIs.

---

## Quick reference

| Area | Key files / APIs |
|---|---|
| UI standards | `UI_STANDARDS.md` |
| Import Folder | `App.tsx` (`handleImportFolder`, `handleDrop`), `electron.js` `scanFolder` |
| Quick Tag | `QuickTagScreen.tsx`, `QuickTagPlayer.tsx`, `MoodPillTags.tsx` |
| Album art | `useAlbumArtStore.ts`, `LazyAlbumArt.tsx`, `electron.js` `extract-album-art` |
| Library table | `TrackTable.tsx`, `TrackTableToolbar.tsx`, `useColumnStore.ts` |
