# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Bonk! is an Electron + React desktop application for editing music metadata with direct Rekordbox 6/7 database integration. It has a multi-process architecture:

- **Main Process** (`electron.js`): Node.js - handles IPC, spawns external processes (Python, FFmpeg, KeyFinder), loads native modules
- **Renderer Process** (`src/`): React + Vite - UI components, Zustand state management
- **Preload** (`preload.js`): contextBridge exposing `window.electronAPI` to renderer
- **Python Bridge** (`rekordbox_bridge.py`): Rekordbox database access via pyrekordbox
- **Rust Native Module** (`native-audio/`): Audio playback and waveform generation via Symphonia + rodio

## Build & Development Commands

```bash
# Install dependencies (also rebuilds native modules)
npm install

# Install Python dependencies (required for Rekordbox DB features)
pip3 install -r requirements.txt

# Development mode (Vite + Electron)
npm run dev

# Build renderer only
npm run build

# Build Rust native audio module
npm run build:native

# Package for distribution
npm run build:electron

# TypeScript check
npx tsc --noEmit
```

## Critical Architecture Patterns

### IPC Communication
All native/system operations go through `window.electronAPI.*` - the renderer NEVER has direct Node.js access. When adding new functionality:
1. Add IPC handler in `electron.js` using `ipcMain.handle('channel-name', ...)`
2. Expose in `preload.js` via `ipcRenderer.invoke('channel-name', ...)`
3. Add TypeScript type in the `Window.electronAPI` interface in `src/App.tsx`

### State Management (Zustand)
- `useLibraryStore` - tracks, playlists, search/filter state, CRUD operations
- `useSettingsStore` - API credentials, user preferences, paths
- `useAutoTagStore` - AutoTag wizard state
- `useAlbumArtStore` - LRU cache for lazy-loaded album art

### Python Bridge Communication
Electron calls Python via spawn: `python3 rekordbox_bridge.py <command> [args]`
- Python outputs JSON to stdout
- Large data is passed via temp files (paths prefixed with `@`)
- Commands: `import-database`, `export-database`, `get-config`, `create-smart-playlist`, etc.

### Performance Optimizations (Recently Added)
- **Virtual scrolling**: `@tanstack/react-virtual` in TrackTable - only visible rows rendered
- **Search index**: `src/utils/searchIndex.ts` - n-gram tokenization for O(1) lookups
- **Lazy album art**: `useAlbumArtStore` + `LazyAlbumArt` component with LRU cache (100 entries)
- **Code splitting**: Heavy modals use `React.lazy()` with Suspense
- **Web Worker**: `src/workers/filterWorker.ts` for background filtering (5k+ tracks)

## Key File Locations

| Purpose | Location |
|---------|----------|
| Main process / IPC handlers | `electron.js` |
| Preload API exposure | `preload.js` |
| React entry | `src/main.tsx` → `src/App.tsx` |
| Track data types | `src/types/track.ts` |
| Library state | `src/store/useLibraryStore.ts` |
| Track table (virtual scroll) | `src/components/TrackTable.tsx` |
| Quick Tag screen | `src/components/QuickTagScreen.tsx` |
| Rekordbox DB modal | `src/components/RekordboxDBModal.tsx` |
| Python bridge | `rekordbox_bridge.py` |
| Rust audio module | `native-audio/src/lib.rs` |

## Important Constraints

### Metadata Handling Rule
**AI agents must NOT change the way metadata is written to tracks.** This includes:
- Genres, Keys, BPM, Ratings, Energy/Mood, Comments, Artwork
- ID3 tags (all versions), rekordbox metadata, QuickTag-written metadata

Do not rewrite, normalize, convert, or "improve" existing metadata. QuickTag metadata is read-only and final.

### Rating System
- Use `ratingByte` (0-255 POPM format) as the single source of truth
- Legacy `Rating` field kept for migration only
- POPM email identifier must be `bonk@suh` for Rekordbox compatibility

### External Dependencies
- **KeyFinder CLI**: Binary in `bin/keyfinder-cli` - same algorithm as Mixxx
- **FFmpeg/FFprobe**: Used for tag writing fallback (WAV, AIFF), album art extraction, transcoding
- **pyrekordbox**: Bundled in `pyrekordbox-0.4.4/` - handles encrypted master.db

## Testing the Application

```bash
# Quick test that Python bridge works
python3 rekordbox_bridge.py get-config

# Test production build
npm run test:prod

# Verify TypeScript compiles
npx tsc --noEmit
```

## Environment Variables

Create `.env` file with:
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` - for metadata lookup
- `DISCOGS_TOKEN` - for Discogs API
- `FFMPEG_PATH`, `FFPROBE_PATH` - optional binary path overrides
