# Find Tags & Album Art

Automatically search for missing tags and high-resolution album art using multiple online music databases.

## Table of Contents

1. [Overview](#overview)
2. [How to Use](#how-to-use)
3. [Data Sources](#data-sources)
4. [Fields That Can Be Updated](#fields-that-can-be-updated)
5. [Configuration Options](#configuration-options)
6. [Best Practices](#best-practices)
7. [Technical Details](#technical-details)

---

## Overview

The "Find Tags & Album Art" feature automatically searches major online music databases to:
- Fill in missing metadata (genre, year, label, album)
- Download and embed high-resolution album artwork
- Add audio analysis data (energy, danceability, popularity, happiness)

### Key Benefits

✓ **Automatic Tag Discovery** - No manual searching  
✓ **Multiple Sources** - Beatport, Spotify, MusicBrainz, Discogs  
✓ **Album Art Embedding** - High-res artwork embedded directly in files  
✓ **Batch Processing** - Update hundreds of tracks at once  
✓ **Confidence Scoring** - Know how accurate the matches are  

---

## How to Use

### Basic Workflow

1. **Select Tracks**
   - Use checkboxes to select tracks
   - Or Cmd/Ctrl+Click for multi-select
   - Select tracks with missing or incomplete metadata

2. **Open Tag Finder**
   - Right-click selected tracks
   - Choose **"Find Tags & Album Art"**

3. **Configure Options**
   - Enable/disable data sources
   - Choose which fields to update
   - Toggle "Original Release" option

4. **Start Search**
   - Click "Start Search"
   - Watch real-time progress
   - Wait for completion

5. **Review Results**
   - See how many tracks were updated
   - Check any errors or skipped tracks
   - Metadata and artwork are now embedded!

### Quick Example

```
1. Import folder with 100 tracks
2. Notice many tracks missing Genre and Year
3. Select all tracks (header checkbox)
4. Right-click → "Find Tags & Album Art"
5. Enable MusicBrainz only (free, no API key)
6. Select: Genre, Year, Label, Album, Album Art
7. Click "Start Search"
8. Wait 2-3 minutes
9. Done! 85 tracks updated with metadata + artwork
```

---

## Data Sources

The tag finder searches databases in **priority order**:

### 1. Beatport
- **Best for:** EDM, House, Techno, Trance
- **Provides:** Genre, Year, Label, Album, Album Art
- **Requires:** API access (not implemented in current version)
- **Accuracy:** Very high for electronic music

### 2. Spotify
- **Best for:** All genres, mainstream music
- **Provides:** Genre, Year, Label, Album, Album Art, Energy, Danceability, Popularity, Happiness
- **Requires:** API token (OAuth)
- **Accuracy:** High, but may match wrong version

### 3. MusicBrainz ✓ **FREE**
- **Best for:** All genres, comprehensive database
- **Provides:** Year, Label, Album, Album Art
- **Requires:** Nothing! Free API
- **Accuracy:** Good, open-source database

### 4. Discogs
- **Best for:** Vinyl releases, rare records
- **Provides:** Genre, Year, Label, Album, Album Art
- **Requires:** API token (free registration)
- **Accuracy:** Good for physical releases

### Source Comparison

| Feature | Beatport | Spotify | MusicBrainz | Discogs |
|---------|----------|---------|-------------|---------|
| **API Key Required** | Yes | Yes | No ✓ | Yes |
| **Genre** | ✓ | Limited | ✗ | ✓ |
| **Year** | ✓ | ✓ | ✓ | ✓ |
| **Label** | ✓ | ✓ | ✓ | ✓ |
| **Album** | ✓ | ✓ | ✓ | ✓ |
| **Album Art** | ✓ | ✓ | ✓ | ✓ |
| **Energy** | ✗ | ✓ | ✗ | ✗ |
| **Danceability** | ✗ | ✓ | ✗ | ✗ |
| **Popularity** | ✗ | ✓ | ✗ | ✗ |
| **Happiness** | ✗ | ✓ | ✗ | ✗ |

---

## Fields That Can Be Updated

### Basic Metadata

✓ **Genre** - Music genre classification  
✓ **Year** - Release year  
✓ **Label** - Record label  
✓ **Album** - Album or EP name  
✓ **Album Art** - Cover artwork (embedded in file)  

### Advanced Audio Analysis (Spotify only)

✓ **Energy** - 0.0-1.0 scale (low to high energy)  
✓ **Danceability** - 0.0-1.0 scale (how danceable)  
✓ **Popularity** - 0-100 score (how popular on Spotify)  
✓ **Happiness** - 0.0-1.0 scale (musical positivity/valence)  

---

## Configuration Options

### Data Source Selection

**Enable Beatport**  
Best for EDM tracks with detailed genre information. Disable for rock, pop, etc. to avoid incorrect matches.

**Enable Spotify**  
Good for all genres, provides energy/danceability data. Requires OAuth token.

**Enable MusicBrainz** ✓ **Recommended**  
Free, no API key needed. Good coverage for all genres. Always enable this!

**Enable Discogs**  
Excellent for older releases and vinyl. Requires free API key.

### Field Selection

Choose which metadata fields to update:
- Check fields you want to update
- Uncheck fields you want to preserve
- Album Art is separate from other fields

### Additional Options

**Original Release**  
When enabled:
- Ignores remix/version info in title
- Searches for the first/original release
- Returns the earliest release year
- Useful for tracks with many versions

**Example:**
- Without: "Track Name (Club Remix)" → finds 2023 remix
- With: "Track Name (Club Remix)" → finds 2020 original

---

## Best Practices

### For Best Results

1. **Clean Artist & Title First**
   - Accuracy depends on existing Artist and Title tags
   - Remove extra text, typos, or unnecessary info
   - Use "Smart Fixes" tool first if available

2. **Choose Right Sources**
   - **EDM/Electronic:** Enable Beatport + MusicBrainz
   - **Pop/Rock/Indie:** Enable Spotify + MusicBrainz
   - **Classical/Jazz:** Enable MusicBrainz + Discogs
   - **Rare/Vinyl:** Enable Discogs only

3. **Start Small**
   - Test with 5-10 tracks first
   - Check accuracy of results
   - Adjust source settings
   - Then process full library

4. **Enable Original Release For:**
   - Tracks with many remix versions
   - When you want the earliest release year
   - Avoiding modern reissue dates

5. **Backup First**
   - Always backup audio files before batch operations
   - Metadata changes are written directly to files
   - Can't be undone easily

### Genre-Specific Tips

**Electronic/EDM:**
```
✓ Enable: Beatport, MusicBrainz
✓ Fields: Genre, Year, Label, Album Art
✗ Original Release: Usually off
```

**Rock/Pop:**
```
✓ Enable: Spotify, MusicBrainz, Discogs
✓ Fields: All except Energy/Danceability
✓ Original Release: On for classics
```

**Hip-Hop/R&B:**
```
✓ Enable: Spotify, MusicBrainz
✓ Fields: Genre, Year, Album, Album Art
✓ Energy, Popularity, Happiness
```

**Classical:**
```
✓ Enable: MusicBrainz, Discogs only
✓ Fields: Year, Label, Album
✗ Disable: Beatport, Spotify (poor matches)
```

---

## Technical Details

### Searching Algorithm

1. **Pre-Process Query**
   - Clean artist and title strings
   - Remove special characters
   - Handle featuring artists
   - Strip version info if "Original Release" enabled

2. **Priority Search**
   - Try first enabled source
   - If confident match found (>50%), use it
   - If not, try next source
   - Continue until match or sources exhausted

3. **Result Validation**
   - Check confidence score
   - Verify artist name similarity
   - Match release date reasonability
   - Flag potential mismatches

4. **Data Retrieval**
   - Download album artwork
   - Resize to optimal size (500x500px)
   - Optimize JPEG quality (90%)
   - Prepare for embedding

5. **File Writing**
   - Read existing ID3 tags
   - Merge new data with existing
   - Embed album art as JPEG
   - Write to audio file
   - Preserve other metadata

### Album Art Handling

**Download:**
- Fetches highest available resolution
- Supports JPEG, PNG formats
- Timeout: 10 seconds per image

**Optimization:**
- Resize to 500x500px (optimal for DJ software)
- Convert to JPEG (smaller file size)
- 90% quality (visually lossless)
- Typical size: 50-150KB

**Embedding:**
- Embedded as ID3v2 APIC frame
- Type: Front Cover (ID 3)
- MIME: image/jpeg
- Compatible with all DJ software

### Rate Limiting

To avoid API throttling:
- 1 request per second to MusicBrainz
- Spotify: 100 requests per batch
- Discogs: Respects API limits
- Shows progress to user

### Error Handling

**Common Errors:**
- File not found → Skip track
- Network timeout → Retry once
- No match found → Skip track
- Invalid API token → Warn user
- Write permission denied → Report error

**Progress Updates:**
- Real-time track-by-track progress
- Current operation displayed
- Estimated time remaining (future)
- Final summary with stats

---

## Workflow Examples

### Example 1: New DJ Collection

```
Scenario: Just imported 500 EDM tracks from folders
Problem: No genre, inconsistent years, no artwork

Solution:
1. Select all 500 tracks
2. Right-click → Find Tags & Album Art
3. Enable: MusicBrainz (free!)
4. Fields: Genre, Year, Label, Album, Album Art
5. Start search
6. Wait ~10 minutes
7. Result: 420 tracks updated with full metadata + art
```

### Example 2: Spotify Integration

```
Scenario: Want energy/danceability for harmonic mixing
Problem: Have basic metadata, need audio analysis

Solution:
1. Get Spotify API token (one-time setup)
2. Select tracks needing analysis
3. Enable: Spotify only
4. Fields: Energy, Danceability, Popularity, Happiness
5. Start search
6. Result: Audio analysis added to all tracks
```

### Example 3: Vinyl Collection

```
Scenario: Digitized vinyl collection, minimal metadata
Problem: Need accurate release info and art

Solution:
1. Clean up Artist/Title first
2. Select all tracks
3. Enable: Discogs + MusicBrainz
4. Fields: All
5. Original Release: ON (want first pressing year)
6. Start search
7. Result: Accurate vintage metadata
```

---

## API Setup (Optional)

### MusicBrainz
**No setup needed!** Free API, works immediately.

### Spotify
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create app
3. Get Client ID and Secret
4. Implement OAuth flow
5. Get access token
6. Configure in Bonk settings

### Discogs
1. Register at [Discogs](https://www.discogs.com)
2. Go to Settings → Developers
3. Generate Personal Access Token
4. Add token to Bonk settings

### Beatport
Beatport doesn't have a public API. Third-party solutions or web scraping required (not currently implemented).

---

## Troubleshooting

### No Results Found

**Cause:** Artist/Title don't match database  
**Solution:** Clean up tags, fix typos, check spelling

### Wrong Track Matched

**Cause:** Similar name, wrong version  
**Solution:** Enable "Original Release" or manually edit

### Album Art Not Showing in DJ App

**Cause:** DJ app cached old metadata  
**Solution:**
- Rekordbox: Re-import track info
- Serato: Re-analyze
- Engine DJ: Use "Re-import track information"

### API Rate Limit Errors

**Cause:** Too many requests too fast  
**Solution:** Process in smaller batches (50-100 tracks)

### Low Success Rate

**Cause:** Obscure releases, poor metadata quality  
**Solution:**
- Enable multiple sources
- Fix Artist/Title tags first
- Try different source combinations

---

## Future Enhancements

- [ ] Beatport API integration
- [ ] Automatic Artist/Title cleaning
- [ ] Smart duplicate detection
- [ ] Lyrics fetching
- [ ] BPM detection integration
- [ ] Custom data source priority
- [ ] Match confidence threshold
- [ ] Preview before applying
- [ ] Undo/rollback changes
- [ ] Batch retry failed tracks

---

## Privacy & Data

### What's Sent to APIs

- Artist name
- Track title
- (Optionally) Album name

### What's NOT Sent

- Audio file contents
- Personal information
- File paths
- Other metadata

### Data Storage

- No data stored on external servers by Bonk
- All processing done locally
- API responses discarded after use
- Album art downloaded then deleted from cache

---

For more information, see:
- [SYNC_FEATURES.md](./SYNC_FEATURES.md) - Sync and tag writing
- [FOLDER_IMPORT_KEY_DETECTION.md](./FOLDER_IMPORT_KEY_DETECTION.md) - Folder import and key detection
- [README.md](./README.md) - General documentation

