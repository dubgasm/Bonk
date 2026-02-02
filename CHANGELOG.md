# Changelog

All notable changes to Bonk Metadata Editor.

## [1.1.0] - 2025-01-28

### AutoTag
- **Multi-provider search**: MusicBrainz, iTunes, Spotify, Discogs, Beatport
- **ISRC-first matching** for Spotify and other providers
- **Field-by-field tag writing** via node-taglib-sharp (preserves existing metadata)
- **Album art embedding** from provider results
- **Overwrite modes**: ifEmpty, always, never
- **Provider priorities** with configurable order
- **Filename parsing** fallback when metadata is missing

### Beatport Integration
- **Beatport API v4** support (based on beets-beatport4 approach)
- **Username/password auth** - no API key required (uses public client ID from docs)
- **Manual cookie handling** for OAuth flow (no ESM dependencies)
- BPM, Key, Genre, Label, Catalog number for electronic music

### Audio Features
- **Separate wizard** for key detection, BPM, ISRC embedding
- **Embed ISRC from Spotify** - helps AutoTag find exact matches later
- **Local key detection** via keyfinder-cli
- **BPM from metadata** or Spotify fallback
- **Write to file** with proper taglib-sharp integration

### Key Format Conversion
- **Camelot Wheel** (8A, 11B) - default for DJs
- **Open Key** (1d, 4m) - alternative DJ notation
- **Standard** (Am, C, F#m) - traditional
- **Settings preference** for key format when writing tags

### Discogs
- Improved search and result parsing
- Better error handling and auth check
- Label, catalog number, genre from release data

### Settings & Credentials
- **API Credentials** section: Spotify, Discogs, Beatport
- **Tagging Preferences**: Key format (Standard/Camelot/Open Key)
- **Environment variables** support via .env file
- Dotenv loaded from project root

### Bug Fixes
- Genre written as numeric ID (52) → fixed with Id3v2Settings.useNumericGenres = false
- Album art embedding (data.toByteVector) → Picture.fromFullData with ByteVector
- Beatport auth ES Module error → manual cookie handling
- Discogs auth check → added to provider switch

### Documentation
- AUDIO_PLAYER.md, BACKUP_GUIDE.md, FEATURE_ROADMAP.md
- AutoTag.md for tagging workflow

---

## [1.0.0] - Initial Release

- Rekordbox 7 import/export
- Music library management
- Track metadata editing
- Playlist management
