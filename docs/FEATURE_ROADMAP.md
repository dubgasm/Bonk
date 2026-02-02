# Feature Roadmap - pyrekordbox Integration

This document outlines potential features that can be implemented using the pyrekordbox library.

## Table of Contents
- [ANLZ File Features](#anlz-file-features)
- [Database Features](#database-features)
- [Advanced Playlist Features](#advanced-playlist-features)
- [File Management](#file-management)
- [Priority Recommendations](#priority-recommendations)

---

## ANLZ File Features

### 1. Cue Point Management
**Status:** Not Implemented  
**Priority:** High

**Features:**
- Read/display cue points from ANLZ files (`.DAT`, `.EXT`, `.2EX`)
- Hot cues (A-H) and memory cues
- Loop points (in/out times)
- Cue colors and comments
- Edit/delete cue points
- Import/export cue points between tracks
- Batch cue operations

**Implementation:**
- Use `db.read_anlz_files(content)` to read ANLZ files
- Parse `PCOB` and `PCO2` tags for cue data
- Use `DjmdCue` table for database-stored cues
- Use `ContentCue` table for cue metadata

**API Methods:**
```python
db.get_anlz_paths(content)  # Get ANLZ file paths
db.read_anlz_files(content)  # Read all ANLZ files
db.get_cue(content)           # Get cues from database
db.get_content_cue(content)  # Get content cue data
```

---

### 2. Beatgrid Management
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Read beatgrid data (PQTZ, PQT2 tags)
- Visualize beatgrid on waveform
- Manual beatgrid correction
- BPM detection from beatgrid
- Export beatgrid data

**Implementation:**
- Parse `PQTZ` tag (beat grid) from `.DAT` files
- Parse `PQT2` tag (extended beat grid) from `.EXT` files
- Display beat positions and tempo changes

**ANLZ Tags:**
- `PQTZ`: Standard beat grid (`.DAT` files)
- `PQT2`: Extended beat grid (`.EXT` files)

---

### 3. Waveform Visualization
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Read waveform data (PWAV, PWV2, PWV3, PWV4, PWV5 tags)
- Display waveforms in the UI
- Waveform preview for tracks

**Implementation:**
- Parse waveform tags from ANLZ files
- Render waveform visualization
- Note: PWV6, PWV7, PWVC are currently unsupported

**ANLZ Tags:**
- `PWAV`: Waveform data (`.DAT` files)
- `PWV2`: Waveform data v2 (`.DAT` files)
- `PWV3`, `PWV4`, `PWV5`: Extended waveforms (`.EXT` files)

---

## Database Features

### 4. Cue Point Database Access
**Status:** Not Implemented  
**Priority:** High

**Features:**
- Read/write cues directly from database
- Sync cues between ANLZ files and database
- Manage `DjmdCue` entries

**Database Tables:**
- `DjmdCue`: Memory/hot cues stored in database
  - `InMsec`, `OutMsec`: Cue times
  - `Kind`: Cue type (0=Cue, 4=Loop)
  - `Color`: Cue color
  - `Comment`: Cue comment
- `ContentCue`: Cue metadata
  - `Cues`: Cue data string
  - `rb_cue_count`: Number of cues

**API Methods:**
```python
db.get_cue(ContentID=content_id)        # Get cues for track
db.get_content_cue(ContentID=content_id) # Get cue metadata
```

---

### 5. Play History Tracking
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Track play statistics
- "Never Played" filter
- Last played date
- Play count tracking
- Play history visualization

**Database Tables:**
- `DjmdHistory`: Play history sessions
- `DjmdSongHistory`: Individual track plays
  - Links tracks to history entries
  - Tracks play dates and counts

**API Methods:**
```python
db.get_history()              # Get play history
db.get_history_songs()        # Get song history entries
```

---

### 6. Hot Cue Banklists
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- Manage hot cue banks
- Share hot cue banks between tracks
- Organize cue sets

**Database Tables:**
- `DjmdHotCueBanklist`: Hot cue bank definitions
- `DjmdSongHotCueBanklist`: Tracks in banks
- `HotCueBanklistCue`: Cues in banks

**API Methods:**
```python
db.get_hot_cue_banklist()           # Get hot cue banks
db.get_hot_cue_banklist_songs()     # Get tracks in banks
db.get_hot_cue_banklist_cue()       # Get cues in banks
```

---

### 7. Related Tracks
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Link remixes to originals
- Track version management
- Related tracks suggestions
- Display related tracks in UI

**Database Tables:**
- `DjmdRelatedTracks`: Related track groups
- `DjmdSongRelatedTracks`: Track relationships

**API Methods:**
```python
db.get_related_tracks()        # Get related track groups
db.get_related_tracks_songs()  # Get track relationships
```

---

### 8. Sampler Management
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- Manage sampler content
- View tracks in sampler

**Database Tables:**
- `DjmdSampler`: Sampler playlists
- `DjmdSongSampler`: Tracks in sampler

**API Methods:**
```python
db.get_sampler()        # Get samplers
db.get_sampler_songs()  # Get tracks in sampler
```

---

### 9. Active Censors (Skip Points)
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- Manage skip points
- Auto-detect explicit content sections
- Censor point visualization

**Database Tables:**
- `DjmdActiveCensor`: Censor points
  - `InMsec`, `OutMsec`: Skip time range
- `ContentActiveCensor`: Censor metadata

**API Methods:**
```python
db.get_active_censor()        # Get censors
db.get_content_active_censor() # Get content censors
```

---

### 10. Mixer Parameters
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- Save/load mixer presets
- EQ, filter, and effect settings per track

**Database Tables:**
- `DjmdMixerParam`: Mixer settings per track

**API Methods:**
```python
db.get_mixer_param()  # Get mixer parameters
```

---

### 11. My-Settings Management
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- Read/write `MYSETTINGS.DAT` files
- DJ equipment settings (tempo fader range, crossfader curve, etc.)
- Export settings to USB devices
- Import settings from USB

**Implementation:**
```python
from pyrekordbox.mysettings import read_mysetting_file, write_mysetting_file

mysett = read_mysetting_file("MYSETTINGS.DAT")
sync = mysett.get("sync")
quant = mysett.get("quantize")
```

**API Methods:**
```python
db.get_mysetting_paths()  # Get My-Settings file paths
```

---

## Advanced Playlist Features

### 12. Smart Playlist Evaluation
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Real-time smart playlist evaluation
- Preview smart playlist results before saving
- Test smart playlist conditions

**Implementation:**
- Use `SmartList` class from `pyrekordbox.db6.smartlist`
- Evaluate conditions against track data
- Display preview results

---

### 13. Playlist Statistics
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- BPM range analysis
- Key distribution
- Genre breakdown
- Energy curve
- Playlist compatibility scoring

**Implementation:**
- Query tracks in playlist
- Aggregate metadata (BPM, Key, Genre)
- Generate statistics and visualizations

---

## File Management

### 14. Content File Tracking
**Status:** Not Implemented  
**Priority:** Low

**Features:**
- File hash tracking
- Sync status monitoring
- File integrity checking

**Database Tables:**
- `ContentFile`: File metadata
  - `Hash`: File hash
  - `Size`: File size
  - `rb_local_path`: Local path
  - `rb_insync_hash`: Sync hash
  - `rb_file_hash_dirty`: Hash dirty flag

**API Methods:**
```python
db.get_content_file()  # Get file metadata
```

---

### 15. ANLZ File Operations
**Status:** Not Implemented  
**Priority:** Medium

**Features:**
- Batch read/write ANLZ files
- Backup/restore ANLZ files
- Repair corrupted ANLZ files
- Migrate ANLZ files when moving tracks

**Implementation:**
- Use `AnlzFile.parse_file()` and `anlz.save()`
- Batch process multiple tracks
- Backup before modifications

---

## Priority Recommendations

### Phase 1: High Priority (Core Features)
1. **Cue Point Management** - Visual editor for hot cues and loops
2. **Cue Point Database Access** - Sync cues between ANLZ and database
3. **ANLZ File Operations** - Backup/restore capabilities

### Phase 2: Medium Priority (Enhanced Features)
4. **Beatgrid Management** - Manual beatgrid correction
5. **Play History Tracking** - Track usage statistics
6. **Waveform Visualization** - Visual waveform display
7. **Related Tracks** - Link remixes/originals
8. **Smart Playlist Evaluation** - Preview smart playlist results

### Phase 3: Low Priority (Advanced Features)
9. **Hot Cue Banklists** - Organize cue sets
10. **Sampler Management** - Manage sampler content
11. **Active Censors** - Skip point management
12. **Mixer Parameters** - Save/load presets
13. **My-Settings Editor** - Manage DJ equipment settings
14. **Playlist Statistics** - Analytics and insights
15. **Content File Tracking** - File integrity monitoring

---

## Implementation Notes

### ANLZ File Structure
- `.DAT` files: PPTH, PVBR, PQTZ, PWAV, PWV2, PCOB
- `.EXT` files: PPTH, PCOB, PCO2, PQT2, PWV3, PWV4, PWV5, PSSI
- `.2EX` files: PPTH, PWV6, PWV7, PWVC (unsupported)

### Database Access Patterns
- Always use `db.get_*()` methods for querying
- Use `db.add()`, `db.delete()` for modifications
- Call `db.commit()` after changes
- Handle `SessionNotInitializedError` exceptions

### Safety Considerations
- Always backup ANLZ files before modification
- Test changes on a small subset first
- Close Rekordbox before database modifications
- Use transactions for batch operations

---

## References

- [pyrekordbox Documentation](https://pyrekordbox.readthedocs.io/)
- [ANLZ File Format](https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/anlz.html)
- [Rekordbox Database Schema](https://pyrekordbox.readthedocs.io/en/stable/formats/db6.html)

