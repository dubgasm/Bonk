# Format Conversion Guide

This guide explains how to convert audio files between formats (e.g., FLAC → AIFF, MP3 → FLAC) while preserving all Rekordbox metadata including cues, loops, beatgrids, and playlist memberships.

## Overview

The Format Conversion feature:
1. **Converts audio files** using FFmpeg (preserves audio quality)
2. **Updates Rekordbox database** paths automatically
3. **Preserves all metadata** (cues, loops, grids, playlists)
4. **Handles file cleanup** (optional deletion or archiving of originals)

## Prerequisites

- **FFmpeg installed** and accessible at `/opt/homebrew/bin/ffmpeg` (or update the path in `electron.js`)
- **Rekordbox database access** (optional - for automatic path updates)
- **Backup your Rekordbox library** before converting (File → Library → Backup Library in Rekordbox)

## Step-by-Step Usage

### 1. Select Tracks to Convert

You have two options:

**Option A: Select specific tracks**
- Click the checkbox next to tracks you want to convert
- Or use Cmd/Ctrl + Click to select multiple tracks
- Or use Cmd/Ctrl + A to select all tracks

**Option B: Convert all tracks**
- Don't select any tracks (leave all checkboxes unchecked)
- The conversion will apply to all visible tracks

### 2. Open Format Conversion Modal

- Click the **"Convert Format"** button in the toolbar
- The button is only enabled when you have tracks selected (or all tracks will be converted)

### 3. Choose Target Format

In the modal:
- Select your target format from the dropdown:
  - **MP3** - 320kbps CBR (good for performance)
  - **FLAC** - Lossless compression
  - **AIFF** - 24-bit PCM (Apple lossless)
  - **WAV** - 24-bit PCM
  - **M4A/AAC** - 320kbps
  - **OGG** - Vorbis format

### 4. Configure Options

**Delete Original Files:**
- ☑ Check this box if you want to remove original files after conversion
- If unchecked, original files will be kept alongside new files

**Archive Path (optional):**
- If "Delete Original Files" is checked, you can specify an archive folder
- Original files will be moved to this folder instead of being deleted
- Leave empty to delete originals permanently
- Example: `/Users/YourName/Music/Archive`

### 5. Review Preview

The modal shows a preview of:
- How many tracks will be converted
- Format changes (e.g., FLAC → MP3)
- File path changes

Tracks already in the target format will be skipped automatically.

### 6. Start Conversion

- Click **"Convert X Tracks"** button
- Confirm the conversion when prompted
- **Wait for completion** - you'll see progress updates:
  - Current track being converted
  - Progress bar
  - Status updates

### 7. Review Results

After conversion completes, you'll see:
- ✓ Number of tracks successfully converted
- ✗ Number of tracks that failed (if any)
- Error details for any failures

## What Happens During Conversion

1. **File Conversion**
   - FFmpeg converts each audio file to the new format
   - Metadata is preserved during conversion
   - New files are created in the same directory as originals

2. **Database Update** (if track IDs are available)
   - Rekordbox database paths are updated automatically
   - ANLZ files (cues, loops, grids) are updated
   - All playlist references are preserved

3. **File Cleanup** (if enabled)
   - Original files are either:
     - Moved to archive folder (if specified)
     - Deleted permanently (if no archive specified)

## Important Notes

### ⚠️ Backup First!
Always backup your Rekordbox library before converting:
- In Rekordbox: **File → Library → Backup Library**
- Or manually backup your `master.db` file

### File Matching
- New files must be in the same directory as originals
- Filenames must match (only extension changes)
- Example: `track.flac` → `track.aiff` ✅
- Example: `track.flac` → `new_track.aiff` ❌

### Metadata Preservation
- All cues, loops, and beatgrids are preserved
- Playlist memberships are maintained
- Track metadata (title, artist, etc.) is preserved
- **Note:** For cues/loops to transfer correctly, the new files must be exact digital matches (same length, no timing differences)

### Quality Settings
- **MP3**: 320kbps CBR (high quality)
- **FLAC**: Compression level 12 (maximum)
- **AIFF/WAV**: 24-bit PCM (lossless)
- **M4A/AAC**: 320kbps
- **OGG**: Quality level 6

## Troubleshooting

### "No handler registered" Error
- **Solution:** Restart the Electron app (`npm run dev`)

### FFmpeg Not Found
- **Solution:** Install FFmpeg: `brew install ffmpeg`
- Or update the FFmpeg path in `electron.js` (line 14)

### Conversion Fails
- Check that source files exist and are readable
- Ensure you have write permissions in the target directory
- Check disk space (conversions may temporarily use 2x the space)

### Database Update Fails
- This is non-critical - files are still converted
- You can manually update paths in Rekordbox using "Relocate Missing Files"
- Or re-import the converted files

### Files Not Found After Conversion
- Check the original file location
- New files are created in the same directory
- Verify file permissions

## Example Workflows

### FLAC → AIFF Conversion
1. Select all FLAC tracks (or use filter)
2. Click "Convert Format"
3. Choose "AIFF" from dropdown
4. Check "Delete Original Files" (optional)
5. Click "Convert"
6. Wait for completion
7. Open Rekordbox - all tracks should be linked to new AIFF files

### MP3 → FLAC Upgrade
1. Select MP3 tracks you want to upgrade
2. Click "Convert Format"
3. Choose "FLAC"
4. **Don't** check "Delete Original Files" (keep MP3s as backup)
5. Click "Convert"
6. After verification, manually delete MP3s if desired

### Batch Archive Old Files
1. Select tracks to convert
2. Choose target format
3. Check "Delete Original Files"
4. Enter archive path: `/Users/YourName/Music/Archive`
5. Convert - originals will be moved to archive folder

## Tips

- **Test with a few tracks first** before converting your entire library
- **Keep originals** until you verify everything works in Rekordbox
- **Use archive folder** instead of deleting - safer option
- **Check disk space** - conversions can use significant space temporarily
- **Convert during off-hours** - large batches can take time

## Keyboard Shortcuts

- **Cmd/Ctrl + A**: Select all tracks
- **Cmd/Ctrl + Click**: Multi-select tracks
- **Escape**: Close modal

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify FFmpeg is installed and accessible
3. Ensure Rekordbox database is accessible
4. Check file permissions
5. Review the error messages in the conversion results

