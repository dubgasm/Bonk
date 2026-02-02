# Native Audio Player (Rust)

Rust-based audio playback using rodio and Symphonia for reliable audio playback in Electron.

## Requirements

- Rust toolchain (install from https://rustup.rs/)
- Cargo (comes with Rust)

## Building

```bash
cd native-audio
./build.sh
```

Or use npm:
```bash
npm run build:native
```

The build script will:
1. Detect your platform (macOS/Linux/Windows)
2. Build the Rust library for your architecture
3. Copy it to the correct `.node` file for Node.js/Electron

## Supported Formats

Via Symphonia (with `all` feature):
- MP3, MP2, MP1
- FLAC
- WAV
- OGG/Vorbis
- AAC (AAC-LC)
- ALAC
- And more...

## Usage

The module is automatically loaded by Electron and exposed via `electronAPI`:

```typescript
// Initialize
await window.electronAPI.rustAudioInit();

// Load a file
const result = await window.electronAPI.rustAudioLoad(filePath);
console.log('Duration:', result.duration);

// Play
await window.electronAPI.rustAudioPlay();

// Pause
await window.electronAPI.rustAudioPause();

// Stop
await window.electronAPI.rustAudioStop();

// Set volume (0.0 to 1.0)
await window.electronAPI.rustAudioSetVolume(0.75);

// Get status
const isPlaying = await window.electronAPI.rustAudioIsPlaying();
const duration = await window.electronAPI.rustAudioGetDuration();
const position = await window.electronAPI.rustAudioGetPosition();
```

## Troubleshooting

If the module fails to load:
1. Make sure Rust is installed: `rustc --version`
2. Rebuild: `npm run build:native`
3. Check that the `.node` file exists in `native-audio/` directory
4. Check Electron console for error messages
