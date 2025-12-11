# 🎹 Musical Key Detection

Bonk uses **KeyFinder CLI** by Ibrahim Sha'ath - a professional-grade key detection algorithm used by DJ software like Mixxx.

## ✨ Features

### **High Accuracy Key Detection**
- Based on the libKeyFinder library (industry-standard)
- Analyzes audio spectrum and harmonic content
- Detects keys in **Standard Notation** (e.g., `Dm`, `A`, `Bb`, `F#m`)
- 90%+ confidence in detected keys

### **Smart Detection Flow**
1. **Check Metadata First** - If key already exists in file tags (0.8 confidence)
2. **Audio Analysis** - Run KeyFinder algorithm if no metadata (0.9 confidence)
3. **Graceful Handling** - Skips corrupted/invalid files safely

### **Supported Formats**
All audio formats supported by FFmpeg:
- MP3, FLAC, AIFF, WAV, M4A/AAC, OGG, WMA, etc.

## 🎯 Usage

### **Single Track Detection**
1. Right-click on any track
2. Select **"Detect Musical Key"**
3. Key is analyzed and written to the `Tonality` field
4. Export to Rekordbox to sync

### **Batch Detection**
1. Select multiple tracks (Cmd/Ctrl + click or Shift + click)
2. Right-click on selection
3. Select **"Detect Musical Key"**
4. All tracks are analyzed in sequence

### **During Folder Import**
- Keys are automatically read from metadata if present
- Use "Detect Musical Key" after import to analyze tracks without keys

## 📊 Key Notation

Bonk uses **Standard Notation** (same as KeyFinder):

**Major Keys:**
- `C`, `Db`, `D`, `Eb`, `E`, `F`, `Gb`, `G`, `Ab`, `A`, `Bb`, `B`

**Minor Keys:**
- `Cm`, `Dm`, `Em`, `Fm`, `Gm`, `Am`, `Bm` (with flats: `Dbm`, `Ebm`, `Gbm`, `Abm`, `Bbm`)

**Note:** Sharps are not used - flats are standard (e.g., `Eb` instead of `D#`)

## 🔧 Technical Details

### **How It Works**

```
Track → FFmpeg Decode → Audio Buffer → FFT Analysis → 
Harmonic Detection → Key Correlation → Result
```

1. **Audio Decoding** - FFmpeg extracts raw audio data
2. **Spectral Analysis** - FFT (Fast Fourier Transform) creates frequency spectrum
3. **Harmonic Profile** - Identifies pitch class distribution
4. **Key Correlation** - Compares to known key profiles (Krumhansl-Kessler)
5. **Best Match** - Returns key with highest correlation

### **Binary Location**
- Development: `bin/keyfinder-cli`
- Production: Bundled with the app in the same directory

### **Dependencies**
- **libkeyfinder** - Core algorithm library
- **FFmpeg** - Audio decoding
- **FFTW3** - Fast Fourier Transform

### **Performance**
- Average analysis time: **2-5 seconds per track** (depends on file size)
- No quality loss - read-only operation
- Works offline - no API calls needed

## 🎼 Rekordbox Integration

Keys detected by Bonk are written to the `Tonality` field in Rekordbox XML:

```xml
<TRACK ... Tonality="Dm" />
```

When you import the XML into Rekordbox 7, the keys will appear in the Key column.

## 🚨 Limitations

### **Accuracy Considerations**
- Works best for tonal music (house, techno, pop, rock)
- May struggle with:
  - Atonal/experimental music
  - Heavy distortion
  - Complex polyrhythms
  - Tracks that change key mid-song

### **Silent Tracks**
- KeyFinder returns nothing for silent/ambient tracks
- Confidence set to 0, no key written

### **Corrupted Files**
- Pre-flight check with FFmpeg
- Corrupted files are skipped automatically
- Error message shown in UI

## 📝 Confidence Scores

| Source | Confidence | Notes |
|--------|-----------|-------|
| **Metadata** | 0.8 | Key already tagged in file |
| **KeyFinder** | 0.9 | Analyzed by algorithm |
| **Skipped** | 0.0 | Corrupted or silent |
| **None** | 0.0 | No key detected |

*Note: Confidence scores are informational. KeyFinder is highly accurate for tonal music.*

## 🎵 Best Practices

1. **Trust the Algorithm** - KeyFinder is used by professional DJs worldwide
2. **Verify Key Tracks** - For critical mixes, double-check detected keys by ear
3. **Batch Process** - Select all tracks without keys and run detection once
4. **Keep Metadata** - Keys are written to Tonality field, preserved in XML
5. **Use in DJ Software** - Import XML to Rekordbox/Traktor for harmonic mixing

## 🔗 References

- **KeyFinder GitHub**: https://github.com/evanpurkhiser/keyfinder-cli
- **libKeyFinder**: https://github.com/mixxxdj/libkeyfinder
- **Mixxx DJ Software**: https://mixxx.org/ (uses same algorithm)
- **Research Paper**: Sha'ath, I. (2011) - Estimation of Key in Digital Music Recordings

---

**Built with ❤️ for DJs who care about harmonic mixing!**

