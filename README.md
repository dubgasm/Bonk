   # Bonk! - Music Metadata Editor

   A modern desktop application for viewing and editing music metadata with Rekordbox 7 import/export support.

   ## Features

   ### Core Features
   - ✨ **Rekordbox XML Import/Export** - Seamlessly import and export Rekordbox 7 XML files
   - 💾 **Rekordbox Database Support** - Direct import/export from Rekordbox 6/7 master.db (encrypted database)
   - 📁 **Folder Import** - Import entire folder structures as playlists automatically
   - 🎵 **Metadata Editing** - Edit track information including:
   - Title, Artist, Album
   - Genre, BPM, Key
   - Year, Rating, Comments
   - Remixer, Label, Mix, Grouping
   - 🔍 **Search & Filter** - Quickly find tracks by name, artist, album, genre, or key
   - 🎨 **Modern UI** - Clean, dark-themed interface inspired by professional DJ software
   - ⚡ **Fast Performance** - Built with React and Electron for a smooth experience

   ### Advanced Features
   - 🎹 **Professional Key Detection** - Uses KeyFinder CLI (industry-standard algorithm) for accurate musical key detection
   - 🔍 **Smart Metadata Search** - Auto-search music databases (MusicBrainz, Spotify) for missing metadata and album art
   - 💾 **Universal Tag Writing** - Safe metadata writing to ALL audio formats (MP3, FLAC, AIFF, WAV, M4A, OGG) using FFmpeg
   - 🎨 **Album Art Display** - Embedded album art extraction and display with fallback to FFmpeg
   - 🔄 **Robust Fallback System** - music-metadata → FFprobe → FFmpeg for maximum compatibility
   - 📝 **Enhanced Metadata** - Support for Writers, Producers, Featured Artists, Catalog Numbers, ISRC
   - 🔄 **Export Modes** - Merge, Update, or Overwrite when writing back to Rekordbox

   ### 🚀 **Modern UX Features**
   - ✏️ **Inline Editing** - Double-click any cell to edit instantly (no dialogs!)
   - ⌨️ **Keyboard Shortcuts** - Full keyboard control (Cmd+A, Cmd+K, Cmd+F, Cmd+W, etc.)
   - 🛠️ **Quick Action Toolbar** - All actions visible and one-click away
   - ✅ **Smart Selection** - Checkboxes for batch operations, right-click for single tracks
   - 🔄 **Discard Changes** - Reload metadata from files anytime
   - 💡 **Tooltips** - Hover hints showing keyboard shortcuts

   ## Rekordbox Database Integration (NEW! 🔥)

   Bonk now supports **direct access to Rekordbox 6 and 7 databases**! No more XML export/import - access your library directly.

   ### Features
   - ✅ Import your entire Rekordbox library (tracks, playlists, metadata)
   - ✅ Export changes back to Rekordbox database
   - ✅ Import and export with merge/update/overwrite modes
   - ✅ Works with encrypted master.db files (Rekordbox 6/7)
   - ✅ Auto-detection of Rekordbox installation

   ### Requirements
   - Python 3.8 or higher
   - pyrekordbox (bundled in `pyrekordbox-0.4.4/`)
   - SQLCipher support (`sqlcipher3`) for Rekordbox 6/7 encrypted databases

   ### Setup

   1. Install Python dependencies (see [requirements.txt](./requirements.txt)):
   ```bash
   pip3 install -r requirements.txt
   ```

   2. Test the setup:
   ```bash
   python3 rekordbox_bridge.py get-config
   ```

   For detailed setup instructions, see **[REKORDBOX_DB_SETUP.md](./docs/REKORDBOX_DB_SETUP.md)**.

   ### Usage

   1. Click the **"Rekordbox DB"** button in the header (purple gradient button)
   2. Choose an operation:
      - **Import from Database** - Load your Rekordbox library into Bonk
      - **Export to Database** - Write your changes back to Rekordbox
   ⚠️ **Important**: Always backup your Rekordbox library before importing or exporting! (Rekordbox → File → Library → Backup Library)

   ## Getting Started

   ### Prerequisites

   - Node.js (v18 or higher)
   - npm or yarn
   - Python 3.8+ (for Rekordbox DB features)

   ### Installation

   1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Bonk
   ```

   2. Install dependencies:
   ```bash
   npm install
   ```

   3. Run in development mode:
   ```bash
   npm run dev
   ```

   This will start the Vite dev server and launch the Electron app.

   ### Building

   To build the application for production:

   ```bash
   npm run build
   npm run build:electron
   ```

   The built application will be in the `release` directory.

   ## Usage

   ### Basic Workflow
   1. **Import Library**: 
      - Click "Import XML" for Rekordbox files
      - Or "Import Folder" to scan music directories
   2. **Browse Tracks**: View all tracks in the table with sortable columns
   3. **Search**: Use the search bar to filter tracks
   4. **Edit Metadata**: Click on any track to open the editor panel
   5. **Save Changes**: After editing, save your changes
   6. **Export**: Click "Export XML" to save your modified library

   ### Advanced Operations
   - **Inline Editing**: Double-click any cell (Title, Artist, Album, Genre, BPM, Key, Year) to edit
   - **Keyboard Shortcuts**: See [Key Shortcuts.md](./docs/Key%20Shortcuts.md) for full list
   - **Quick Actions**: Use the toolbar for one-click access to Detect Keys, Find Tags, Write Tags
   - **Batch Operations**: Select multiple tracks and apply operations to all
   - **Smart Context Menu**: Right-click for track-specific or batch operations
   - **Discard Changes**: Reload original metadata from files when needed

   ## Rekordbox XML Location

   ### macOS
   ```
   ~/Library/Pioneer/rekordbox/
   ```

   ### Windows
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Pioneer\rekordbox\
   ```

   To export from Rekordbox:
   1. Go to File > Export Collection in XML format
   2. Choose a location to save the XML file
   3. Import this file into Bonk

   ## Technology Stack

   ### Frontend (Renderer)
   - **React 18** - UI library
   - **TypeScript** - Type safety
   - **Vite** - Build tool and dev server
   - **Zustand** - State management
   - **MUI (Material UI)** - Dialogs, form controls
   - **Framer Motion** - Animations
   - **wavesurfer.js** - Waveform display
   - **@tonaljs/tonal** - Key/musical notation
   - **lucide-react** - Icons

   ### Main Process (Electron)
   - **Electron** - Desktop app framework
   - **axios** - HTTP client for MusicBrainz, Spotify, Discogs, Beatport
   - **sharp** - Album art processing
   - **node-taglib-sharp** - ID3/FLAC/M4A tag read/write, POPM rating
   - **ffmetadata** - FFmpeg-based tag writing (WAV, AIFF fallback)
   - **music-metadata** - Audio metadata extraction
   - **fast-xml-parser** - Rekordbox XML parse/build
   - **dotenv** - API credentials from .env

   ### Native / External
   - **native-audio** - Rust N-API module (Symphonia + rodio) for playback, waveform, seeking
   - **KeyFinder CLI** - Professional key detection (same algo as Mixxx)
   - **FFmpeg / FFprobe** - Transcode, album art, tag writing fallback

   ### Python (Rekordbox DB)
   - **pyrekordbox** - Rekordbox 6/7 database access (bundled in `pyrekordbox-0.4.4/`)
   - **SQLCipher** - Encrypted master.db support

   ## Project Structure

   ```
   Bonk/
   ├── electron.js        # Electron main process (IPC, spawns, native modules)
   ├── preload.js         # contextBridge API for renderer
   ├── index.html         # Vite entry
   ├── package.json
   ├── requirements.txt   # Python deps for rekordbox_bridge
   │
   ├── src/               # React app (Vite)
   │   ├── main.tsx, App.tsx
   │   ├── components/    # Header, TrackTable, QuickTagScreen, modals...
   │   ├── store/         # useLibraryStore, useSettingsStore, useAutoTagStore
   │   ├── types/         # track, autotag, settings
   │   └── utils/         # rekordboxParser, keyDetector, musicDatabaseClient
   │
   ├── electron/          # Electron main process TypeScript sources
   ├── native-audio/      # Rust N-API module (playback, waveform)
   ├── bin/               # keyfinder-cli binary
   ├── pyrekordbox-0.4.4/ # Bundled Python lib for Rekordbox DB
   ├── rekordbox_bridge.py # Python CLI (import/export DB)
   ├── docs/              # Guides, architecture, feature docs
   └── tools/             # Developer scripts
   ```

   For a detailed breakdown of how components connect, see **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

   ## Contributing

   Contributions are welcome! Please feel free to submit a Pull Request.

   ## License

   MIT License - feel free to use this project for personal or commercial purposes.

   ## Documentation

   ### Architecture
   - **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - How the app works: process layout, IPC, data flow, integrations

   ### Getting Started
   - **[QUICKSTART.md](./docs/QUICKSTART.md)** - Quick start guide
   - **[Key Shortcuts.md](./docs/Key%20Shortcuts.md)** - Complete keyboard shortcuts reference

   ### Features
   - **[REKORDBOX_DB_SETUP.md](./docs/REKORDBOX_DB_SETUP.md)** - Rekordbox Database import/export
   - **[FOLDER_IMPORT_KEY_DETECTION.md](./docs/FOLDER_IMPORT_KEY_DETECTION.md)** - Folder import basics
   - **[KEY_DETECTION.md](./docs/KEY_DETECTION.md)** - Professional key detection with KeyFinder
   - **[FIND_TAGS_ALBUM_ART.md](./docs/FIND_TAGS_ALBUM_ART.md)** - Automatic metadata and album art finding
   - **[UX_GUIDE.md](./docs/UX_GUIDE.md)** - Complete UX features guide (inline editing, shortcuts, toolbar)
   - **[FORMAT_CONVERSION_GUIDE.md](./docs/FORMAT_CONVERSION_GUIDE.md)** - 🆕 Convert audio formats (FLAC→AIFF, MP3→FLAC, etc.) with automatic Rekordbox relinking

   ## Acknowledgments

   - Inspired by **Lexicon DJ**
   - Built for the DJ community
   - Thanks to **Pioneer** for Rekordbox
   - Database access powered by **[pyrekordbox](https://github.com/dylanljones/pyrekordbox)** by Dylan Jones
   - Key detection powered by **KeyFinder** by Ibrahim Sha'ath (same algorithm used in Mixxx DJ)
   - Safe metadata writing with **FFmpeg** and **FFprobe**
   - Metadata enrichment via **MusicBrainz** and **Spotify** APIs
   - Album art processing with **Sharp**

   **Disclaimer**: This project is not affiliated with Pioneer Corp. or its related companies. Use at your own risk. Always backup your Rekordbox library before making changes.

