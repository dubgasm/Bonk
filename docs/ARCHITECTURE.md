# Bonk! Architecture

This document describes how the application is structured, what components exist, and how they connect.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                            │
│  electron.js (Node.js)                                                   │
│  - IPC handlers (file, folder, Rekordbox DB, audio, tags, AutoTag...)   │
│  - Spawns: Python (rekordbox_bridge), keyfinder-cli, FFmpeg             │
│  - Loads: native-audio (.node), sharp, axios, node-taglib-sharp         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         IPC (contextBridge)
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                                 │
│  Vite + React (src/)                                                     │
│  - App.tsx, Header, TrackTable, PlaylistSidebar, modals...              │
│  - Zustand: useLibraryStore, useSettingsStore, useAutoTagStore          │
│  - Calls window.electronAPI.* for all native/system operations          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Process Architecture

### Electron Main Process (`electron.js`)

The main process is the Node.js entry point. It:

- Creates the BrowserWindow and loads the Vite dev server (dev) or built HTML (prod)
- Registers all `ipcMain.handle` handlers
- Spawns external processes (Python, FFmpeg, keyfinder-cli)
- Loads native modules (Rust audio, Sharp)

**Key dependencies:**

| Module | Purpose |
|--------|---------|
| `axios` | HTTP client for MusicBrainz, Spotify, Discogs, Beatport APIs |
| `sharp` | Album art processing (resize, format conversion) |
| `node-taglib-sharp` | Read/write ID3, FLAC, M4A tags; POPM rating |
| `ffmetadata` | FFmpeg-based tag writing fallback for WAV/AIFF |
| `dotenv` | Load .env for API credentials |
| `native-audio` | Rust N-API module for playback, waveform, seeking |

---

### Preload Script (`preload.js`)

Sits between main and renderer. Exposes a safe API via `contextBridge`:

```js
window.electronAPI = {
  selectFile, readFile, saveFile,
  writeTags, selectFolder, scanFolder, detectKey, findTags, reloadTrack,
  rekordboxGetConfig, rekordboxImportDatabase, rekordboxExportDatabase, ...
  rustAudioInit, rustAudioLoad, rustAudioPlay, rustAudioSeek, rustAudioGetWaveform,
  autotagStart, autotagPause, autotagCancel, ...
  audioFeaturesStart, ...
}
```

The renderer never has direct Node access; all native work goes through `electronAPI`.

---

### Renderer Process (React + Vite)

**Entry:** `src/main.tsx` → `App.tsx`

**Modes:**
- `library` – main view with PlaylistSidebar, TrackTable, TrackEditor
- `quickTag` – Quick Tag screen (folder browser, track list, bottom player)

**State (Zustand):**
- `useLibraryStore` – tracks, playlists, selected track, search, filters
- `useSettingsStore` – API credentials, key format, paths
- `useAutoTagStore` – AutoTag wizard open/closed state

**Major components:**
- `Header` – import/export, Rekordbox DB, Quick Tag, Auto Tag, settings
- `PlaylistSidebar` – playlists, smart playlists, missing tracks
- `TrackTable` – sortable track grid, inline edit, context menu
- `TrackEditor` – right panel for selected track
- `QuickTagScreen` + `QuickTagPlayer` – folder-based tagging with Rust playback
- `AutoTagWizard` – multi-provider metadata lookup
- `AudioFeaturesWizard` – key/BPM/ISRC batch detection
- Modals: Export, Settings, RekordboxDB, Tags, Genres, FindTags, etc.

---

## External Integrations

### 1. Rekordbox Database (Python)

```
Electron (ipcMain)  →  exec python3 rekordbox_bridge.py <command> [args]
                     →  rekordbox_bridge.py
                         - Adds pyrekordbox-0.4.4 to sys.path
                         - Uses Rekordbox6Database, RekordboxXml, etc.
                         - Reads/writes master.db (SQLCipher)
                         - Returns JSON on stdout
```

**Commands:** `get-config`, `set-config`, `import-db`, `export-db`, `create-smart-playlist`, `get-smart-playlist-contents`, `apply-smart-fixes`, `get-anlz-data`, `update-path`, etc.

**Data flow:** Electron writes a temp JSON file with library/config, passes path to Python. Python reads, processes, writes result JSON to stdout.

---

### 2. Key Detection (KeyFinder CLI)

```
Electron  →  spawn bin/keyfinder-cli [filePath]
          →  stdout: key string (e.g. "Am", "8A")
```

Bundled binary in `bin/keyfinder-cli`. Same algorithm as Mixxx.

---

### 3. FFmpeg / FFprobe

- **Tag writing:** `ffmetadata` uses FFmpeg to write tags for formats taglib doesn’t handle well (WAV, AIFF, OGG).
- **Album art:** FFmpeg extracts embedded art when music-metadata fails.
- **Transcode for audition:** Converts unsupported formats to WAV for HTML5 fallback (when Rust player isn’t used).

---

### 4. Rust Native Audio (`native-audio/`)

N-API module built from Rust (Symphonia + rodio):

- **Playback:** load, play, pause, stop, seek, volume
- **Waveform:** `getWaveform(filePath, buckets)` → `{ duration_ms, peaks[] }`
- **POPM rating:** write rating byte to file via Rust tag writer

Used by Quick Tag player and audition.

---

### 5. Metadata APIs (Find Tags / AutoTag)

| Provider | Auth | Used for |
|----------|------|----------|
| MusicBrainz | None | Recording/release lookup, album art |
| Spotify | Client ID + Secret | Search, audio features (BPM, key, energy) |
| iTunes | None | Catalog lookup |
| Discogs | Token | Vinyl/release metadata |
| Beatport | Username/password | Electronic music, BPM, key, genre |

**Find Tags** (toolbar): One-off lookup for selected tracks (MusicBrainz + Spotify).

**AutoTag Wizard**: Batch run over file list, multi-provider priority, ISRC matching, field overwrite rules.

---

## Data Flow Examples

### Import from Rekordbox DB

1. User clicks “Import from Rekordbox DB” in Header.
2. `App` calls `window.electronAPI.rekordboxImportDatabase(null)`.
3. Main invokes `python3 rekordbox_bridge.py import-db`.
4. Python opens master.db, exports tracks + playlists to JSON, prints to stdout.
5. Electron parses JSON, returns `{ success, library }`.
6. `App.handleRekordboxDBImport(library)` merges into `useLibraryStore`.

### Quick Tag: Load and Play Track

1. User picks folder in Quick Tag, selects track from list.
2. `QuickTagPlayer` calls `rustAudioInit()` then `rustAudioLoad(filePath)`.
3. Main loads `native-audio` `.node` module, calls Rust `load(path)`.
4. User clicks play → `rustAudioPlay()`.
5. For waveform: `rustAudioGetWaveform(path, 256)` → Rust decodes via Symphonia, returns peaks.

### AutoTag: Look Up Metadata

1. User opens AutoTag wizard, selects providers (MusicBrainz, Spotify) and tags.
2. User starts run with a list of file paths.
3. Main receives `autotag:start` with config, spawns async loop.
4. For each track: build search query → call MusicBrainz/Spotify/Discogs APIs (axios).
5. Merge results by priority, apply overwrite rules.
6. If `writeTagsToFile`: use node-taglib-sharp to write tags.
7. Main emits `autotag:event` and `autotag:result` to renderer via IPC.

---

## Project Structure (Simplified)

```
Bonk/
├── electron.js          # Main process (all IPC, spawns, native loads)
├── preload.js           # contextBridge API for renderer
├── index.html           # Vite entry
├── package.json
├── requirements.txt     # Python deps for rekordbox_bridge
│
├── src/                 # React app (Vite bundle)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/      # UI components
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   └── utils/           # rekordboxParser, keyDetector, etc.
│
├── electron/            # TypeScript sources for main (if used; electron.js may be hand-maintained)
├── native-audio/        # Rust N-API module (playback, waveform)
├── bin/                 # keyfinder-cli binary
├── pyrekordbox-0.4.4/   # Bundled Python lib for Rekordbox DB
├── rekordbox_bridge.py  # Python CLI called by Electron
└── docs/                # Documentation
```

---

## Build and Run

| Step | Command | Result |
|------|---------|--------|
| Node deps | `npm install` | Installs deps, runs `rebuild-native` (builds Rust, electron-rebuild for sharp) |
| Python deps | `pip3 install -r requirements.txt` | Needed for Rekordbox DB features |
| Dev | `npm run dev` | Vite on :5173 + Electron loads it |
| Build | `npm run build` | TypeScript + Vite → dist/renderer |
| Package | `npm run build:electron` | electron-builder → release/ |

---

## Environment Variables

- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` – Find Tags / AutoTag Spotify
- `DISCOGS_TOKEN` – Discogs API
- `FFMPEG_PATH`, `FFPROBE_PATH` – Override FFmpeg binary paths (optional)

Defined in `.env` (see `.env.example`).
