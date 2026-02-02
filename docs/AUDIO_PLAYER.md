# Audio Player with Waveform & Cue Points

Professional audio player with waveform visualization and cue point management - bringing DJ software features to Bonk!

---

## 🎯 Overview

The built-in audio player lets you:
- **Preview tracks** before playing them out
- **Visualize waveforms** to see track structure
- **Scrub through audio** by clicking the waveform
- **Add cue points** for quick navigation
- **Edit cue points** with custom names and colors
- **Jump to cues** instantly during playback

---

## 🚀 How to Use

### Opening the Player

1. **Select a track** in the track table (double-click or click once)
2. **Track Editor opens** on the right side
3. **Click "Show Player"** button at the top
4. Player loads below the button with waveform

### Basic Playback

**Transport Controls:**
- ⏮ **Skip Back** - Jump backward 10 seconds
- ⏯ **Play/Pause** - Toggle playback
- ⏭ **Skip Forward** - Jump forward 10 seconds
- 🔊 **Volume** - Adjust volume or mute

**Time Display:**
- Shows current time and total duration
- Format: `00:32 / 05:45`

**Waveform Navigation:**
- Click anywhere on waveform to jump to that position
- Visual feedback with cursor line
- Colored regions show cue points

---

## 🎨 Waveform Visualization

### What You See

The waveform shows:
- **Audio amplitude** over time (louder = taller bars)
- **Progress** (blue) vs remaining audio (gray)
- **Playhead** (red cursor line)
- **Cue markers** (colored regions)

### Interaction

- **Click** → Jump to position
- **Drag cursor** → Scrub through audio
- **Scroll** → Zoom in/out (future feature)

### Technical Details

Powered by **WaveSurfer.js v7**:
- Web Audio API backend
- Normalized waveform display
- Real-time rendering
- Low latency scrubbing

---

## 📍 Cue Point Management

### What are Cue Points?

Cue points are **markers** in your track that let you:
- Mark intro/outro sections
- Flag drop points
- Remember key moments
- Quick-jump during playback

**Rekordbox Compatible:** Cue points sync with Rekordbox database!

---

### Adding Cue Points

**Method 1: During Playback**
1. Play the track
2. When you reach the desired moment, click **"Add Cue"**
3. Cue is added at current playhead position

**Method 2: Scrub First**
1. Click on waveform to jump to position
2. Click **"Add Cue"**
3. Cue is added at that position

**Result:**
- New cue appears in the list below
- Visual marker appears on waveform
- Default name: "Cue 1", "Cue 2", etc.
- Default color: Blue

---

### Editing Cue Points

1. **Click Edit button** (pencil icon) on any cue
2. **Edit inline:**
   - Change name (e.g., "Intro", "Drop", "Build")
   - Change color (8 Rekordbox-compatible colors)
3. **Click Save** to apply changes
4. Waveform marker updates automatically

**Available Colors:**
- 🔴 Red
- 🟠 Orange
- 🟡 Yellow
- 🟢 Green
- 🔵 Blue
- 🟣 Purple
- 🩷 Pink
- ⚪ White

---

### Jumping to Cue Points

**Quick Navigation:**
1. Click the **Play button** (▶️) next to any cue
2. Playhead jumps instantly to that position
3. Perfect for checking sections repeatedly!

---

### Deleting Cue Points

1. Click the **Trash button** (🗑️) next to any cue
2. Cue is removed immediately
3. Visual marker disappears from waveform

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Skip back 10s |
| `→` | Skip forward 10s |
| `M` | Mute/Unmute |
| `C` | Add cue at current position |
| `Esc` | Close player |

*(Future implementation)*

---

## 🎯 Use Cases

### 1. DJ Preparation

**Scenario:** Preparing tracks for a gig

**Workflow:**
1. Open track in player
2. Listen to full track
3. Add cues at key moments:
   - "Intro" (start mixing point)
   - "Build" (energy ramp-up)
   - "Drop" (main section)
   - "Outro" (mix out point)
4. Color-code by importance
5. Export to Rekordbox with cues intact

**Result:** Tracks are pre-analyzed and ready for live performance!

---

### 2. Track Quality Check

**Scenario:** Checking newly imported tracks

**Workflow:**
1. Import folder of new tracks
2. For each track:
   - Open player
   - Scrub through waveform (visual inspection)
   - Listen to key sections
   - Check for:
     - Clipping (waveform too tall)
     - Silence (flat waveform)
     - Poor encoding (irregular waveform)
3. Delete low-quality tracks

**Result:** Clean library with only quality tracks!

---

### 3. Remix/Edit Analysis

**Scenario:** Comparing different versions

**Workflow:**
1. Open "Original Mix" in player
2. Add cues at section changes
3. Note timestamps
4. Open "Extended Mix" in player
5. Compare structure visually
6. Use cues to jump between versions

**Result:** Understand differences and pick best version!

---

### 4. Podcast/Mix Editing

**Scenario:** Creating a DJ mix or podcast

**Workflow:**
1. Open each track in sequence
2. Add cues at:
   - "Mix In" (where to start)
   - "Mix Out" (where to end)
3. Note BPM and key for harmonic mixing
4. Plan transitions using cue times
5. Execute mix in your DJ software

**Result:** Precise mix planning with exact timestamps!

---

## 🔧 Technical Details

### Supported Formats

The player uses **HTML5 Audio** with **Web Audio API** (Chromium engine):

✅ **Fully Supported:**
- **MP3** - All bitrates (128-320kbps)
- **WAV** - Uncompressed PCM
- **M4A/AAC** - Apple/iTunes format
- **OGG Vorbis** - Open source format
- **FLAC** - Lossless compression (should work, but see note below)

⚠️ **Limited Support:**
- **AIFF** - Mac format, inconsistent in Chromium
  - May work, may not (depends on codec variant)
  - **Recommendation:** Convert to WAV for guaranteed compatibility
- **FLAC** - Generally works, but some variants may fail
  - 16-bit/44.1kHz FLAC: ✅ Works reliably
  - 24-bit/96kHz+ FLAC: ⚠️ May have issues
  - **Recommendation:** Test first, convert to WAV if issues

❌ **Not Supported:**
- **WMA** - Windows Media Audio (no browser support)
- **DRM-protected files** - Copy protection prevents playback
- **Exotic formats** - DSD, APE, etc.

**Testing Recommendation:**
If a file doesn't load, try:
1. Convert to 16-bit/44.1kHz WAV (most compatible)
2. Convert to 320kbps MP3 (smaller, widely compatible)
3. Use FFmpeg: `ffmpeg -i input.aiff -acodec pcm_s16le output.wav`

---

### Waveform Generation

**How it works:**
1. File is loaded into memory
2. Web Audio API decodes audio data
3. WaveSurfer.js analyzes amplitude
4. Waveform is rendered to Canvas
5. Normalized for consistent visualization

**Performance:**
- Small files (<50MB): Instant
- Large files (>100MB): 2-5 seconds
- Lossless files: Longer load time

**Optimization:**
- Waveform cached in memory
- Only regenerated on track change
- Canvas hardware acceleration

---

### Cue Point Storage

**Data Format:**
```typescript
interface CuePoint {
  Name: string;        // "Intro", "Drop", etc.
  Type: string;        // "0" = Cue, "4" = Loop
  Start: string;       // Time in milliseconds
  Num: string;         // Cue number/ID
  Red?: string;        // Color R (0-255)
  Green?: string;      // Color G (0-255)
  Blue?: string;       // Color B (0-255)
}
```

**Storage Locations:**
1. **In-memory:** Track object in Zustand store
2. **On disk:** ID3 tags (when "Write Tags" is clicked)
3. **Rekordbox DB:** When exported/synced

---

### Rekordbox Compatibility

**What syncs:**
- ✅ Cue point times
- ✅ Cue point names
- ✅ Cue point colors
- ❌ Loops (future feature)
- ❌ Beat grid (future feature)

**Note:** Rekordbox may recalculate cue positions slightly due to different audio analysis.

---

## 🚨 Troubleshooting

### Player won't load

**Symptoms:**
- "Loading waveform..." spinner forever
- "Failed to load audio file" error

**Solutions:**

1. **Check file format compatibility:**
   
   **AIFF files:**
   ```bash
   # Convert AIFF to WAV (most compatible):
   ffmpeg -i input.aiff -acodec pcm_s16le output.wav
   
   # Or convert to FLAC (smaller, lossless):
   ffmpeg -i input.aiff output.flac
   ```
   
   **FLAC files (if having issues):**
   ```bash
   # Re-encode to standard FLAC:
   ffmpeg -i input.flac -sample_fmt s16 -ar 44100 output.flac
   
   # Or convert to WAV:
   ffmpeg -i input.flac -acodec pcm_s16le output.wav
   ```

2. **Check file exists:**
   - File may have been moved/deleted
   - Use "Find Lost Tracks" feature
   - Check Location field in track editor

3. **Check file permissions:**
   - Ensure Bonk can read the file
   - Try copying file to a different location
   - Check macOS security permissions

4. **Check file size:**
   - Very large files (>500MB) may timeout
   - DSD files or ultra-high-res audio may fail
   - Consider converting to smaller format

5. **Test file integrity:**
   ```bash
   # Verify file can be read:
   ffmpeg -v error -i yourfile.flac -f null -
   
   # If errors appear, file is corrupted
   ```

---

### No sound during playback

**Symptoms:**
- Waveform plays but no audio

**Solutions:**
1. **Check volume:**
   - Player volume may be at 0
   - System volume may be muted
   - Check audio output device

2. **Check file:**
   - File may have silent audio track
   - Visual waveform flat = silent file

3. **Browser issues:**
   - Restart Bonk
   - Try different track
   - Update browser (Electron uses Chromium)

---

### Waveform looks wrong

**Symptoms:**
- Flat waveform for non-silent track
- Clipped/cut-off waveform

**Solutions:**
1. **Normalization:**
   - Waveform is normalized by default
   - Quiet tracks will be scaled up
   - This is expected behavior

2. **File corruption:**
   - Re-import the file
   - Check file in other player
   - May need to re-download/re-rip

---

### Cue points not saving

**Symptoms:**
- Cue points disappear when reopening track

**Solutions:**
1. **Save track edits:**
   - Click "Save Changes" in Track Editor
   - Cues are stored in memory until saved

2. **Write to files:**
   - Use "Write Tags to Files" feature
   - Cues will persist in ID3 tags

3. **Export to Rekordbox:**
   - Use "Export to Rekordbox DB"
   - Cues will sync to Rekordbox

---

### Performance issues

**Symptoms:**
- Player is laggy
- Scrubbing is slow
- High CPU usage

**Solutions:**
1. **Close other apps:**
   - Free up system resources
   - Bonk needs CPU for waveform

2. **Reduce waveform quality:**
   - Future setting to lower resolution

3. **Use smaller files:**
   - Convert lossless to lossy for testing
   - Use lower bitrate files

---

## 🎓 Advanced Tips

### Cue Naming Conventions

**Recommended structure:**
```
Intro - Start mixing here
Build - Energy increases
Drop - Main section / breakdown
Break - Quieter section
Build 2 - Second energy build
Drop 2 - Second main section
Outro - Start mix out here
End - Hard cut point
```

**Benefits:**
- Consistent across library
- Easy to understand at a glance
- Works well in Rekordbox

---

### Color Coding System

**Suggested scheme:**
- 🔴 **Red:** Important (drops, key moments)
- 🟠 **Orange:** Energy up (builds)
- 🟡 **Yellow:** Caution (tricky sections)
- 🟢 **Green:** Safe mix point (intro/outro)
- 🔵 **Blue:** General marker
- 🟣 **Purple:** Vocals
- 🩷 **Pink:** Special effects
- ⚪ **White:** Notes/reference

**Benefits:**
- Quick visual scanning
- Works in low-light environments
- Matches Rekordbox conventions

---

### Workflow Optimization

**For large libraries:**
1. Process one genre at a time
2. Use playlist to organize
3. Mark tracks as "Analyzed" (custom tag)
4. Skip tracks you never play

**Time estimates:**
- 100 tracks: 2-3 hours
- 1000 tracks: 20-30 hours
- 5000 tracks: 100+ hours

**Tip:** Do it gradually over time!

---

## 🔮 Future Features

Planned enhancements:

- [ ] **Loop points** - In/out markers for loops
- [ ] **Beat grid** - Visual beat markers
- [ ] **Waveform zoom** - See more detail
- [ ] **Keyboard shortcuts** - Faster workflow
- [ ] **Batch cue import** - Copy cues between tracks
- [ ] **Auto-cue detection** - AI-powered cue suggestions
- [ ] **Waveform export** - Save as image
- [ ] **Multi-track view** - Compare waveforms side-by-side
- [ ] **Spectral view** - Frequency analysis
- [ ] **Playback speed** - Tempo adjustment for practice

---

## 📚 Related Features

- **[Key Detection](./KEY_DETECTION.md)** - Detect musical key
- **[Cue Point Management](./FEATURE_ROADMAP.md#cue-point-management)** - Database sync
- **[Write Tags](./QUICKSTART.md#write-tags)** - Persist cue points to files

---

**Happy mixing! 🎧🎵**

