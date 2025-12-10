# Folder Import & Key Detection

This document covers the new folder import and musical key detection features in Bonk.

## Table of Contents

1. [Folder Import](#folder-import)
2. [Key Detection](#key-detection)
3. [Workflow Examples](#workflow-examples)
4. [Technical Details](#technical-details)

---

## Folder Import

Import entire folder structures as playlists, automatically creating a library from your music collection.

### How It Works

1. **Click "Import Folder"** in the header (or on welcome screen)
2. **Select a folder** containing your music files
3. Bonk will:
   - Recursively scan all subfolders
   - Extract metadata from audio files
   - Create playlists matching your folder structure
   - Import all tracks into your library

### Folder Structure → Playlists

Your folder organization becomes your playlist organization:

```
Music/
├── House/
│   ├── Deep House/
│   │   ├── track1.mp3
│   │   └── track2.mp3
│   └── Tech House/
│       ├── track3.mp3
│       └── track4.mp3
└── Techno/
    ├── track5.mp3
    └── track6.mp3
```

Creates playlists:
- **House** (folder)
  - **Deep House** (2 tracks)
  - **Tech House** (2 tracks)
- **Techno** (2 tracks)

### Supported Audio Formats

- **MP3** (.mp3) - Full metadata support
- **FLAC** (.flac) - Lossless with metadata
- **M4A/AAC** (.m4a, .aac) - Apple format
- **WAV** (.wav) - With RIFF tags
- **AIFF** (.aiff) - Apple lossless
- **OGG** (.ogg) - Vorbis format
- **WMA** (.wma) - Windows Media

### Metadata Extraction

Bonk automatically extracts from ID3 tags:
- ✓ Title (or uses filename if missing)
- ✓ Artist
- ✓ Album
- ✓ Genre
- ✓ Year
- ✓ BPM
- ✓ Musical Key
- ✓ Duration
- ✓ Bitrate & Sample Rate
- ✓ Comments

### Merging Libraries

**Import Multiple Times:**
- First import creates library
- Subsequent imports **add** to existing library
- No duplicates are removed automatically

**Use Cases:**
1. Import different music folders separately
2. Add new folders to existing library
3. Combine XML import with folder import

---

## Key Detection

Automatically detect the musical key of tracks for harmonic mixing.

### How to Use

1. **Select tracks** (checkbox or Cmd/Ctrl+Click)
2. **Right-click** → "Detect Musical Key"
3. Bonk analyzes each track and updates the key field

### Key Detection Methods

**1. Metadata Extraction (Primary)**
- Reads existing key from ID3 tags
- Fastest method
- 80% confidence when present

**2. Future: Audio Analysis**
- Krumhansl-Schmuckler algorithm
- Analyzes pitch class distribution
- Will be implemented for tracks without key metadata

### Key Formats

Bonk supports multiple key notations:

**Standard Notation:**
- Major: C, D, E, F, G, A, B
- Minor: Am, Dm, Em, Fm, Gm, Cm
- Accidentals: C#, Db, F#, Gb, etc.

**Camelot Notation:**
- Wheel of Fifths (1A-12A, 1B-12B)
- Used by DJs for harmonic mixing
- Example: C Major = 8B, A Minor = 8A

### Key Detection Confidence

Results include confidence score:
- **High (0.8-1.0)**: Reliable key detection
- **Medium (0.5-0.8)**: Reasonable accuracy
- **Low (0.0-0.5)**: Uncertain, manual verification recommended

### Batch Key Detection

Process multiple tracks simultaneously:
1. Select 10, 100, or all tracks
2. Right-click → Detect Musical Key
3. Progress shown in alert dialog
4. Keys updated in real-time

**Performance:**
- Metadata reading: ~100 tracks/sec
- Full analysis: ~5-10 tracks/sec (future feature)

---

## Workflow Examples

### Example 1: Import DJ Collection

```
1. Organize music by genre on disk:
   DJ Music/
   ├── House/
   ├── Techno/
   └── Drum & Bass/

2. Click "Import Folder"
3. Select "DJ Music" folder
4. Wait for scan (shows loading spinner)
5. Result: 3 playlists with all tracks
```

### Example 2: Detect Keys for Mixing

```
1. Import folder or XML
2. Select all tracks (checkbox in header)
3. Right-click → "Detect Musical Key"
4. Keys populated in Key column
5. Export to Rekordbox with keys
```

### Example 3: Add New Music

```
1. Already have library imported
2. Download new tracks to folder
3. Click "Import Folder"
4. Select new music folder
5. New tracks + playlists added to library
```

### Example 4: Fix Missing Keys

```
1. Import Rekordbox XML
2. Filter tracks with no key (search: empty)
3. Select those tracks
4. Right-click → "Detect Musical Key"
5. Export XML with updated keys
```

---

## Technical Details

### Folder Scanning Algorithm

**Recursive Directory Traversal:**
```javascript
1. Read folder contents
2. For each item:
   - If file with audio extension → Parse metadata
   - If subfolder → Recurse into it
3. Create playlist for each folder with tracks
4. Nest playlists matching folder structure
```

**File Location Storage:**
- Stored as `file://localhost/absolute/path/to/file.mp3`
- Compatible with Rekordbox XML format
- Supports spaces and special characters (URI encoded)

### Metadata Library

Uses `music-metadata` npm package:
- Industry-standard audio parser
- Supports 15+ audio formats
- Extracts ID3v2, Vorbis, iTunes tags
- Fast and reliable

### Key Detection Algorithm

**Krumhansl-Schmuckler Key-Finding:**

1. **Pitch Class Distribution:**
   - Analyze frequency content
   - Build 12-note chromagram
   - Weight by energy

2. **Template Matching:**
   - Major key profile: [6.35, 2.23, 3.48, ...]
   - Minor key profile: [6.33, 2.68, 3.52, ...]
   - Correlate with input

3. **Best Match:**
   - Test all 24 keys (12 major + 12 minor)
   - Return highest correlation
   - Normalize to confidence score

**Camelot Conversion:**
```
Circle of Fifths mapping:
C → 8B,  Am → 8A
G → 9B,  Em → 9A
D → 10B, Bm → 10A
etc.
```

### Performance Optimizations

**Folder Scanning:**
- Parallel file stat operations
- Stream-based file reading
- Skip hidden/system folders
- Limit recursion depth to 10 levels

**Key Detection:**
- Metadata-first approach (fast)
- Cache results in memory
- Batch processing for multiple tracks
- Skip already-analyzed tracks

### Error Handling

**File Access Errors:**
- Corrupt files are skipped with warning
- Permission errors logged
- Invalid metadata uses filename fallback

**Key Detection Errors:**
- Unknown format → confidence 0
- Ambiguous result → return best guess
- File not found → error message

---

## Future Enhancements

### Folder Import
- [ ] Import options (skip duplicates, merge metadata)
- [ ] Progress bar for large collections
- [ ] Watched folders (auto-import new files)
- [ ] Custom playlist naming rules
- [ ] Filter by genre during import

### Key Detection
- [ ] Full audio analysis (FFT + chromagram)
- [ ] GPU acceleration for batch processing
- [ ] Visual key wheel display
- [ ] Harmonic mixing suggestions
- [ ] Key conflict warnings
- [ ] Re-analyze with different algorithms

---

## Troubleshooting

### "No tracks found" after folder import

**Possible causes:**
- Folder contains no supported audio files
- Files are in nested subfolders beyond depth limit
- Files are corrupted or unreadable

**Solutions:**
1. Check folder contains .mp3, .flac, .m4a, etc.
2. Try importing a specific subfolder
3. Verify file permissions

### Key detection returns "Unknown"

**Possible causes:**
- No key in ID3 tags
- File format doesn't support key field
- Audio analysis not yet implemented

**Solutions:**
1. Check if file has key metadata (use other DJ software)
2. Manually set key in track editor
3. Wait for audio analysis feature (coming soon)

### Slow folder scanning

**For large collections (10,000+ files):**
- Normal to take 1-2 minutes
- Metadata parsing is CPU-intensive
- Consider importing subfolders separately

**Speed estimates:**
- 1,000 tracks: ~10-30 seconds
- 10,000 tracks: ~1-3 minutes
- 50,000 tracks: ~5-10 minutes

### Playlists not matching folders

**Issue:** Flat playlist structure instead of nested

**Cause:** Rekordbox XML format limitations

**Workaround:**
1. Folder import creates nested playlists correctly
2. Export maintains structure
3. Rekordbox import should preserve nesting

---

## Comparison with Other Software

| Feature | Bonk | Rekordbox | Lexicon DJ |
|---------|------|-----------|------------|
| Folder Import | ✓ | ✗ | ✓ |
| Auto Playlists | ✓ | ✗ | ✓ |
| Key Detection | ✓* | ✓ | ✓ |
| Batch Processing | ✓ | Limited | ✓ |
| Format Support | 7 formats | 6 formats | 10+ formats |

*Metadata-based currently, audio analysis coming soon

---

## Advanced Usage

### Custom Import Workflow

**Organize First, Then Import:**
```bash
# On disk:
Music/
├── New/          # Tracks to review
├── Favorites/    # Tested bangers
└── Archive/      # Older sets

# Import each as separate operation
# Creates 3 playlists in Bonk
```

### Key Detection Pipeline

**Full metadata update workflow:**
```
1. Import folder → Library created
2. Detect keys → Keys populated
3. Edit metadata → Manual adjustments
4. Write tags → Update files
5. Export XML → Send to Rekordbox
```

### Combining Import Methods

**Best of both worlds:**
```
1. Import Rekordbox XML (existing library + metadata)
2. Import folder (new tracks not yet in Rekordbox)
3. Merge results in Bonk
4. Export unified library
```

---

For more information, see:
- [SYNC_FEATURES.md](./SYNC_FEATURES.md) - Sync and tag writing
- [README.md](./README.md) - General documentation
- [QUICKSTART.md](./QUICKSTART.md) - Getting started guide

