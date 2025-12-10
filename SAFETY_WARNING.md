# ⚠️ IMPORTANT SAFETY NOTICE

## Audio File Safety

### BACKUP YOUR FILES FIRST!

Before using any tag writing features:

1. **ALWAYS backup your audio files**
2. Test on 1-2 files first
3. Verify files still play after editing
4. Never use on your only copy of files

### Known Issues

**Your AIFF and FLAC files show corruption:**
- Error: "Invalid Chunk-ID, expected 'FORM'" (AIFF)
- Error: "Invalid FLAC preamble" (FLAC)

These errors appear during READING, which means **the files were already corrupted before using Bonk**.

### Current Status

**Tag Writing:**
- ✅ **MP3** - Supported (NodeID3)
- ⚠️ **FLAC** - Being upgraded to safer method
- ⚠️ **AIFF** - Being upgraded to safer method  
- ⚠️ **WAV** - Being upgraded to safer method

### What We're Doing

1. Adding `ffmetadata` - uses FFmpeg (industry standard)
2. Adding file verification before/after writing
3. Creating backup option
4. Adding file integrity checks

### Recommendation

**For now, DO NOT use tag writing on your AIFF/FLAC files.**

Wait for the safer implementation using FFmpeg, which properly handles all formats without corruption.

Your files are precious - safety first! 🛡️


