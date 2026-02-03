const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
// node-id3 removed - using ffmetadata for universal tag writing
const axios = require('axios');

// Configure sharp for Electron (handle native binaries in packaged app)
// Sharp should auto-detect Electron and find binaries in app.asar.unpacked
let sharp;
try {
  // Sharp will automatically detect Electron environment
  // The native binaries are unpacked from asar via asarUnpack config
  sharp = require('sharp');
  console.log('Sharp loaded successfully');
} catch (error) {
  console.error('Failed to load sharp:', error);
  console.error('Image processing features will be disabled.');
  sharp = null;
}

// Load Rust audio player (native module)
let AudioPlayer;
let getWaveformNative = null;
let rustAudioPlayer = null;
try {
  const nativeAudioPath = path.join(__dirname, 'native-audio');
  const native = require(nativeAudioPath);
  AudioPlayer = native.AudioPlayer;
  getWaveformNative = native.getWaveform || native.getWaveformNative || null;
  console.log('✓ Rust audio player loaded successfully');
} catch (error) {
  console.error('Failed to load Rust audio player:', error);
  console.error('Audio playback will fall back to HTML5 Audio');
  AudioPlayer = null;
  getWaveformNative = null;
}

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const crypto = require('crypto');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug: Log loaded credentials (redacted)
console.log('Environment loaded:');
console.log('  SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? '✓ set' : '✗ not set');
console.log('  DISCOGS_TOKEN:', process.env.DISCOGS_TOKEN ? '✓ set' : '✗ not set');
console.log('  BEATPORT_USERNAME:', process.env.BEATPORT_USERNAME ? '✓ set' : '✗ not set');
console.log('  BEATPORT_PASSWORD:', process.env.BEATPORT_PASSWORD ? '✓ set' : '✗ not set');

const execAsync = promisify(exec);
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

// Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      secure: true
    }
  }
]);

// Helper function to read POPM rating byte from file using music-metadata
async function readBonkPopmRatingByte(filePath) {
  try {
    // Ensure music-metadata is loaded
    if (!mm) {
      mm = await import('music-metadata');
    }
    
    const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: true }); // fast
    const native = metadata.native;

    const id3 = (native['ID3v2.4'] ?? native['ID3v2.3'] ?? []);

    const popm = id3
      .filter(t => t.id === 'POPM')
      .map(t => t.value);

    // Value shape may vary by parser version, so be defensive:
    const bonk = popm.find(v => {
      const email = v?.email ?? v?.user ?? v?.owner;
      return email?.toLowerCase?.() === 'bonk@suh';
    });

    const ratingByte =
      typeof bonk?.rating === 'number' ? bonk.rating :
      typeof bonk?.ratingByte === 'number' ? bonk.ratingByte :
      undefined;

    return ratingByte;
  } catch {
    return undefined; // UI already handles undefined
  }
}

// Helper function to parse custom tags from metadata (TXXX frames)
function parseCustomTagsFromMetadata(metadata) {
  const tags = [];
  
  // Check for TXXX frames in ID3v2 tags
  if (metadata.native && metadata.native.id3v2) {
    for (const frame of metadata.native.id3v2) {
      if (frame.id === 'TXXX' && frame.value) {
        // TXXX frames have description and text
        const description = frame.description || '';
        const text = Array.isArray(frame.value.text) ? frame.value.text.join('') : frame.value.text || '';
        
        // Look for MYTAG description
        if (description.toUpperCase() === 'MYTAG' && text) {
          // Parse semicolon-separated tags: "Category: Name;Category2: Name2"
          const tagEntries = text.split(';');
          for (const entry of tagEntries) {
            const trimmedEntry = entry.trim();
            if (!trimmedEntry) continue;
            
            // Parse format "Category: Name" or just "Name"
            const colonIndex = trimmedEntry.indexOf(':');
            if (colonIndex > 0) {
              const category = trimmedEntry.substring(0, colonIndex).trim();
              const name = trimmedEntry.substring(colonIndex + 1).trim();
              if (category && name) {
                tags.push({ category, name, source: 'id3' });
              }
            } else {
              // No category, use "Custom" as default
              tags.push({ category: 'Custom', name: trimmedEntry, source: 'id3' });
            }
          }
        }
      }
    }
  }
  
  // Also check for TXXX in ffprobe tags format (from FFprobe fallback)
  if (metadata.format && metadata.format.tags) {
    for (const [key, value] of Object.entries(metadata.format.tags)) {
      if (key.startsWith('TXXX:MYTAG') || key === 'TXXX:MYTAG') {
        const tagValue = String(value);
        // Parse semicolon-separated tags: "Category: Name;Category2: Name2"
        const tagEntries = tagValue.split(';');
        for (const entry of tagEntries) {
          const trimmedEntry = entry.trim();
          if (!trimmedEntry) continue;
          
          const colonIndex = trimmedEntry.indexOf(':');
          if (colonIndex > 0) {
            const category = trimmedEntry.substring(0, colonIndex).trim();
            const name = trimmedEntry.substring(colonIndex + 1).trim();
            if (category && name) {
              tags.push({ category, name, source: 'id3' });
            }
          } else {
            tags.push({ category: 'Custom', name: trimmedEntry, source: 'id3' });
          }
        }
      }
    }
  }
  
  return tags.length > 0 ? tags : undefined;
}

// Helper function to get the path to rekordbox_bridge.py
// When packaged, it's in app.asar.unpacked, otherwise it's in __dirname
function getRekordboxBridgePath() {
  if (app.isPackaged) {
    // In packaged app, the file is unpacked from asar
    const bridgePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'rekordbox_bridge.py');
    
    // Verify file exists
    const fs = require('fs');
    if (!fs.existsSync(bridgePath)) {
      console.error('ERROR: rekordbox_bridge.py not found at:', bridgePath);
      console.error('process.resourcesPath:', process.resourcesPath);
      console.error('__dirname:', __dirname);
      
      // Try alternative locations
      const altPath1 = path.join(__dirname, '..', 'app.asar.unpacked', 'rekordbox_bridge.py');
      const altPath2 = path.join(process.resourcesPath, 'rekordbox_bridge.py');
      const altPath3 = path.join(app.getAppPath(), '..', 'app.asar.unpacked', 'rekordbox_bridge.py');
      
      console.error('Trying alternative paths:');
      console.error('  Alt 1:', altPath1, fs.existsSync(altPath1) ? '✓' : '✗');
      console.error('  Alt 2:', altPath2, fs.existsSync(altPath2) ? '✓' : '✗');
      console.error('  Alt 3:', altPath3, fs.existsSync(altPath3) ? '✓' : '✗');
      
      // Return the first path that exists, or the original if none exist
      if (fs.existsSync(altPath1)) return altPath1;
      if (fs.existsSync(altPath2)) return altPath2;
      if (fs.existsSync(altPath3)) return altPath3;
      
      throw new Error(`rekordbox_bridge.py not found. Checked: ${bridgePath}`);
    }
    
    return bridgePath;
  } else {
    // In development, it's in the project root
    return path.join(__dirname, 'rekordbox_bridge.py');
  }
}

// Spotify token cache
let spotifyToken = null;
let spotifyTokenExpiry = 0;

// Get Spotify access token
async function getSpotifyToken(clientId, clientSecret) {
  // Return cached token if still valid
  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        }
      }
    );

    spotifyToken = response.data.access_token;
    spotifyTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
    
    console.log('✅ Spotify authenticated successfully');
    return spotifyToken;
  } catch (error) {
    console.error('❌ Spotify authentication failed:', error.message);
    return null;
  }
}

// Dynamic import for ES module
let mm;
(async () => {
  mm = await import('music-metadata');
})();

let mainWindow = null;

// Try multiple renderer locations so packaged app can find index.html
function resolveRendererPath() {
  const candidates = [
    // Standard electron-builder unpacked location
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'renderer', 'index.html'),
    // Inside the asar (works when dist is packed)
    path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
    // Relative to this file when running locally
    path.join(__dirname, 'dist', 'renderer', 'index.html'),
    // Fallback to resources root (covers mispacked builds)
    path.join(process.resourcesPath, 'renderer', 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      if (require('fs').existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore and keep trying
    }
  }

  console.error('Renderer index.html not found. Checked:', candidates);
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
  });

  // Determine if we should use dev server or production build
  // Dev if not packaged and NODE_ENV !== production (even if dist exists)
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: locate renderer in any known packaging location
    const rendererPath = resolveRendererPath();

    console.log('process.resourcesPath:', process.resourcesPath);
    console.log('app.getAppPath():', app.getAppPath());
    console.log('__dirname:', __dirname);
    console.log('Resolved renderer path:', rendererPath);

    if (rendererPath) {
      mainWindow.loadFile(rendererPath);
      console.log('✓ Successfully loaded renderer');
    } else {
      mainWindow.loadURL('data:text/html,<h1>Renderer not found</h1><p>Please reinstall or run: npm run build</p>');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Stop Rust audio when window is closing or user reloads (Cmd+R) so playback doesn't continue
  function stopRustAudioIfRunning() {
    if (rustAudioPlayer) {
      try {
        rustAudioPlayer.stop();
      } catch (e) {
        console.warn('stopRustAudioIfRunning:', e?.message);
      }
    }
  }

  mainWindow.on('close', () => {
    stopRustAudioIfRunning();
  });

  mainWindow.webContents.on('will-navigate', () => {
    stopRustAudioIfRunning();
  });
}

app.on('before-quit', () => {
  if (rustAudioPlayer) {
    try {
      rustAudioPlayer.stop();
    } catch (e) {
      console.warn('before-quit stop audio:', e?.message);
    }
  }
});

app.whenReady().then(() => {
  // Register custom protocol for streaming local audio files
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    const decodedPath = decodeURIComponent(url);
    
    // Security: Ensure path exists and is a file
    try {
      callback({ path: decodedPath });
    } catch (error) {
      console.error('Protocol error:', error);
      callback({ error: -6 }); // FILE_NOT_FOUND
    }
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Rekordbox XML', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('read-file', async (_, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (_, content) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Rekordbox XML', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: 'rekordbox_export.xml',
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  try {
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// New handler for audio playback - reads audio file as buffer
ipcMain.handle('read-audio-file', async (_, filePath) => {
  try {
    console.log('Reading audio file:', filePath);
    
    // Parse file location (handle file:// prefix)
    let cleanPath = filePath;
    if (cleanPath.startsWith('file://localhost/')) {
      cleanPath = cleanPath.replace('file://localhost/', '/');
    } else if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.replace('file://', '');
    }
    cleanPath = decodeURIComponent(cleanPath);
    
    // Read file as buffer
    const buffer = await fs.readFile(cleanPath);
    
    // Get MIME type based on extension
    const ext = path.extname(cleanPath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.aiff': 'audio/aiff',
      '.aif': 'audio/aiff',
    };
    const mimeType = mimeTypes[ext] || 'audio/mpeg';
    
    console.log(`✓ Audio file read: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, type: ${mimeType}`);
    
    return {
      success: true,
      buffer: buffer.toString('base64'), // Convert to base64 for IPC transfer
      mimeType: mimeType,
    };
  } catch (error) {
    console.error('Error reading audio file:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Transcode audio to WAV for audition playback (supports any format via ffmpeg)
async function transcodeForAudition(inputPath) {
  let cleanPath = inputPath;
  if (cleanPath.startsWith('file://localhost/')) cleanPath = cleanPath.replace('file://localhost/', '/');
  else if (cleanPath.startsWith('file://')) cleanPath = cleanPath.replace('file://', '');
  cleanPath = decodeURIComponent(cleanPath).replace(/\\/g, '/');

  try {
    await fs.access(cleanPath);
  } catch {
    return { success: false, error: 'File not found' };
  }

  const stat = await fs.stat(cleanPath);
  const hash = crypto.createHash('md5').update(cleanPath + stat.mtimeMs).digest('hex').slice(0, 16);
  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `bonk_audition_${hash}.wav`);

  try {
    const outStat = await fs.stat(outPath);
    if (outStat.size > 0 && outStat.mtimeMs >= stat.mtimeMs) {
      const fileUrl = 'file://' + (process.platform === 'win32' ? '/' : '') + outPath.replace(/\\/g, '/');
      return { success: true, path: outPath, url: fileUrl };
    }
  } catch {
    /* cache miss, transcode below */
  }

  const ffmpegArgs = [
    '-y', '-i', cleanPath,
    '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
    '-f', 'wav',
    outPath
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, ffmpegArgs);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.slice(-800)))));
    proc.on('error', reject);
  });

  const fileUrl = 'file://' + (process.platform === 'win32' ? '/' : '') + outPath.replace(/\\/g, '/');
  return { success: true, path: outPath, url: fileUrl };
}

ipcMain.handle('transcode-for-audition', async (_, filePath) => {
  try {
    return await transcodeForAudition(filePath);
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

// Album art extraction handler (lazy loading for performance)
ipcMain.handle('extract-album-art', async (_, location) => {
  if (!location) return null;
  
  try {
    // Parse file path from Location
    let filePath = location;
    if (filePath.startsWith('file://localhost')) {
      filePath = filePath.replace('file://localhost', '');
    } else if (filePath.startsWith('file://')) {
      filePath = filePath.replace('file://', '');
    }
    filePath = decodeURIComponent(filePath);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return null;
    }
    
    // Use FFprobe to check for embedded artwork
    const ffprobeOutput = await new Promise((resolve, reject) => {
      let output = '';
      const ffprobe = spawn(FFPROBE_PATH || 'ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        filePath
      ]);
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0 && output) {
          try {
            resolve(JSON.parse(output));
          } catch {
            reject(new Error('Invalid JSON from ffprobe'));
          }
        } else {
          reject(new Error('ffprobe failed'));
        }
      });
      
      ffprobe.on('error', reject);
    });
    
    // Check if file has embedded artwork
    const hasArtwork = ffprobeOutput.streams?.some(s => 
      (s.codec_name === 'mjpeg' || s.codec_name === 'png') && s.codec_type === 'video'
    );
    
    if (!hasArtwork) {
      return null;
    }
    
    // Extract album art with timeout
    const tempArtPath = path.join(os.tmpdir(), `cover_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.jpg`);
    let ffmpegProcess = null;
    
    try {
      await Promise.race([
        new Promise((resolveArt, rejectArt) => {
          ffmpegProcess = spawn(FFMPEG_PATH || 'ffmpeg', [
            '-i', filePath,
            '-an',
            '-vframes', '1',
            '-vcodec', 'mjpeg',
            '-q:v', '5', // Lower quality for faster extraction
            '-y',
            tempArtPath
          ]);
          
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              resolveArt();
            } else {
              rejectArt(new Error('FFmpeg art extraction failed'));
            }
          });
          
          ffmpegProcess.on('error', rejectArt);
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            if (ffmpegProcess && !ffmpegProcess.killed) {
              ffmpegProcess.kill('SIGTERM');
            }
            reject(new Error('Album art extraction timeout'));
          }, 3000); // 3 second timeout for lazy loading
        })
      ]);
      
      // Read the extracted image
      const artBuffer = await fs.readFile(tempArtPath);
      const stats = await fs.stat(tempArtPath);
      
      // Clean up temp file
      await fs.unlink(tempArtPath).catch(() => {});
      
      // Only return if file is reasonable size
      if (stats.size > 0 && stats.size < 5 * 1024 * 1024) { // Max 5MB
        return `data:image/jpeg;base64,${artBuffer.toString('base64')}`;
      }
      
      return null;
    } catch (extractError) {
      // Cleanup on error
      if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGKILL');
      }
      await fs.unlink(tempArtPath).catch(() => {});
      return null;
    }
  } catch (error) {
    return null;
  }
});

// Rust audio player IPC handlers
ipcMain.handle('rust-audio-init', async () => {
  if (!AudioPlayer) {
    return { success: false, error: 'Rust audio player not available' };
  }
  try {
    if (!rustAudioPlayer) {
      rustAudioPlayer = new AudioPlayer();
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-load', async (_, filePath) => {
  if (!AudioPlayer || !rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    let cleanPath = filePath;
    if (cleanPath.startsWith('file://localhost/')) {
      cleanPath = cleanPath.replace('file://localhost/', '/');
    } else if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.replace('file://', '');
    }
    cleanPath = decodeURIComponent(cleanPath).replace(/\\/g, '/');
    
    const duration = rustAudioPlayer.loadFile(cleanPath);
    return { success: true, duration };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-play', async () => {
  if (!rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    rustAudioPlayer.play();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-pause', async () => {
  if (!rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    rustAudioPlayer.pause();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-stop', async () => {
  if (!rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    rustAudioPlayer.stop();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-set-volume', async (_, volume) => {
  if (!rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    rustAudioPlayer.setVolume(volume);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-get-duration', async () => {
  if (!rustAudioPlayer) {
    return { success: false, duration: 0 };
  }
  try {
    const duration = rustAudioPlayer.getDuration();
    return { success: true, duration };
  } catch (e) {
    return { success: false, duration: 0, error: e.message };
  }
});

ipcMain.handle('rust-audio-get-position', async () => {
  if (!rustAudioPlayer) {
    return { success: false, position: 0 };
  }
  try {
    const position = rustAudioPlayer.getPosition();
    return { success: true, position };
  } catch (e) {
    return { success: false, position: 0, error: e.message };
  }
});

ipcMain.handle('rust-audio-is-playing', async () => {
  if (!rustAudioPlayer) {
    return { success: false, isPlaying: false };
  }
  try {
    const isPlaying = rustAudioPlayer.isPlaying();
    return { success: true, isPlaying };
  } catch (e) {
    return { success: false, isPlaying: false, error: e.message };
  }
});

ipcMain.handle('rust-audio-seek', async (_, seconds) => {
  if (!rustAudioPlayer) {
    return { success: false, error: 'Rust audio player not initialized' };
  }
  try {
    // Ensure seconds is a number
    const secs = Number(seconds) || 0;
    rustAudioPlayer.seek(secs);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rust-audio-get-waveform', async (_, filePath, buckets) => {
  if (!getWaveformNative) {
    return { success: false, error: 'Waveform generator not available' };
  }
  try {
    let cleanPath = filePath;
    if (cleanPath.startsWith('file://localhost/')) {
      cleanPath = cleanPath.replace('file://localhost/', '/');
    } else if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.replace('file://', '');
    }
    cleanPath = decodeURIComponent(cleanPath).replace(/\\/g, '/');

    const wf = await getWaveformNative(cleanPath, buckets || 512);
    return { success: true, waveform: wf };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (_, folderPath) => {
  try {
    // Ensure music-metadata is loaded
    if (!mm) {
      console.log('Loading music-metadata module...');
      mm = await import('music-metadata');
      console.log('music-metadata loaded:', !!mm);
    }
    
    console.log('Scanning folder:', folderPath);
    const audioExtensions = ['.mp3', '.flac', '.m4a', '.aac', '.wav', '.aiff', '.ogg', '.wma'];
    
    async function scanDirectory(dirPath, basePath = dirPath) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result = {
        tracks: [],
        playlists: []
      };
      
      const tracks = [];
      const subfolders = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden folders and system folders
          if (!entry.name.startsWith('.') && !entry.name.startsWith('__')) {
            subfolders.push({ name: entry.name, path: fullPath });
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (audioExtensions.includes(ext)) {
            tracks.push(fullPath);
          }
        }
      }
      
      // Process tracks in current folder
      for (const trackPath of tracks) {
        const ext = path.extname(trackPath).toLowerCase();
        const useFFprobe = ext === '.aiff' || ext === '.aif'; // Skip music-metadata for AIFF files
        
        if (!useFFprobe) {
          // Try music-metadata first for other formats
        try {
          const metadata = await mm.parseFile(trackPath);
          const trackId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            // Only log filename, not full metadata (to avoid huge TRAKTOR4 fields)
            if (process.env.NODE_ENV === 'development') {
          console.log('Parsed track:', path.basename(trackPath));
            }
          
          // Extract album art if available
          let albumArt = null;
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            // Convert to base64 for easy transmission to renderer
            albumArt = `data:${picture.format};base64,${picture.data.toString('base64')}`;
          }
          
          // Parse artist/title from filename if metadata is missing
          const basename = path.basename(trackPath, path.extname(trackPath));
          let trackName = metadata.common.title || basename;
          let trackArtist = metadata.common.artist || '';
          
          // If artist is missing, try to parse from filename
          if (!trackArtist) {
            const parsed = parseArtistTitleFromFilename(basename);
            if (parsed.artist) {
              trackArtist = parsed.artist;
            }
            // Also use parsed title if metadata title is missing
            if (!metadata.common.title && parsed.title) {
              trackName = parsed.title;
            }
          }
          
          // Read POPM rating byte from file
          const ratingByte = await readBonkPopmRatingByte(trackPath);
          
          const track = {
            TrackID: trackId,
            Name: trackName,
            Artist: trackArtist || 'Unknown Artist',
            Album: metadata.common.album || '',
            Genre: metadata.common.genre ? metadata.common.genre.join(', ') : '',
            Year: metadata.common.year?.toString() || '',
            AverageBpm: metadata.common.bpm?.toString() || '',
            TotalTime: metadata.format.duration ? (metadata.format.duration * 1000).toString() : '',
            BitRate: metadata.format.bitrate?.toString() || '',
            SampleRate: metadata.format.sampleRate?.toString() || '',
            Kind: metadata.format.codec || ext.substring(1).toUpperCase() + ' File',
            Size: (await fs.stat(trackPath)).size.toString(),
            Location: 'file://localhost' + trackPath,
            DateAdded: new Date().toISOString(),
            Comments: metadata.common.comment?.[0] || '',
            Tonality: metadata.common.key || '',
            AlbumArt: albumArt,
            // Additional metadata fields
            TrackNumber: metadata.common.track?.no?.toString() || metadata.common.track?.toString() || '',
            DiscNumber: metadata.common.disk?.no?.toString() || metadata.common.disk?.toString() || '',
            Composer: metadata.common.composer?.[0] || '',
            AlbumArtist: metadata.common.albumartist || '',
            Lyricist: metadata.common.lyricist?.[0] || '',
            OriginalArtist: metadata.common.originalartist?.[0] || '',
            Remixer: metadata.common.remixer?.[0] || '',
            Label: metadata.common.label?.[0] || '',
            MixName: metadata.common.subtitle?.[0] || '',
            ReleaseDate: metadata.common.date || '',
            // Parse custom tags from TXXX frames (ID3)
            tags: parseCustomTagsFromMetadata(metadata),
            // POPM rating byte (0-255) read from file
            ratingByte: ratingByte,
          };
          
          result.tracks.push(track);
            continue; // Successfully processed, move to next track
        } catch (error) {
            // music-metadata failed, fall back to FFprobe
            if (process.env.NODE_ENV === 'development') {
          console.error(`⚠️ music-metadata failed for ${path.basename(trackPath)}:`, error.message);
          console.log('🔧 Trying FFprobe as fallback...');
            }
          }
        }
          
        // Use FFprobe (either directly for AIFF or as fallback)
          try {
            const { spawn } = require('child_process');
            const ffprobeOutput = await new Promise((resolve, reject) => {
              const ffprobe = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                trackPath
              ]);
              
              let output = '';
              ffprobe.stdout.on('data', (data) => {
                output += data.toString();
              });
              
              ffprobe.on('close', (code) => {
                if (code === 0 && output) {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error('Invalid JSON from ffprobe'));
                  }
                } else {
                  reject(new Error('ffprobe failed'));
                }
              });
              
              ffprobe.on('error', reject);
            });
            
            // Extract metadata from ffprobe output
            const tags = ffprobeOutput.format?.tags || {};
            const trackId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          
          // Log metadata but skip very large fields (like TRAKTOR4 which can be huge)
          if (process.env.NODE_ENV === 'development') {
            const logTags = {};
            for (const [key, value] of Object.entries(tags)) {
              if (typeof value === 'string' && value.length > 500) {
                logTags[key] = `[${value.length} chars - truncated]`;
              } else {
                logTags[key] = value;
              }
            }
            console.log('✓ FFprobe extracted metadata:', logTags);
          }
            
          // Extract album art using FFmpeg (non-blocking, skip if it hangs)
            let albumArt = null;
            try {
            // Check if file has embedded artwork - be more specific to avoid false positives
              const hasArtwork = ffprobeOutput.streams?.some(s => 
              (s.codec_name === 'mjpeg' || s.codec_name === 'png') && s.codec_type === 'video'
              );
              
              if (hasArtwork) {
                const tempArtPath = path.join(require('os').tmpdir(), `cover_${trackId}.jpg`);
              let ffmpegProcess = null;
              
              // Add timeout to prevent hanging (5 seconds max for album art)
              try {
                await Promise.race([
                  new Promise((resolveArt, rejectArt) => {
                    ffmpegProcess = spawn(FFMPEG_PATH || 'ffmpeg', [
                    '-i', trackPath,
                    '-an',  // No audio
                        '-vframes', '1',  // Only extract first frame
                        '-vcodec', 'mjpeg',  // Convert to JPEG
                        '-q:v', '2',  // High quality
                    '-y',  // Overwrite
                    tempArtPath
                  ]);
                  
                      let stderrOutput = '';
                      
                      ffmpegProcess.stderr.on('data', (data) => {
                        stderrOutput += data.toString();
                      });
                      
                      ffmpegProcess.on('close', (code) => {
                        if (code === 0) {
                          resolveArt();
                        } else {
                          rejectArt(new Error(`FFmpeg art extraction failed`));
                        }
                  });
                  
                      ffmpegProcess.on('error', rejectArt);
                    }),
                    new Promise((_, reject) => {
                      setTimeout(() => {
                        // Kill the process if it's still running
                        if (ffmpegProcess && !ffmpegProcess.killed) {
                          ffmpegProcess.kill('SIGTERM');
                        }
                        reject(new Error('Album art extraction timeout'));
                      }, 5000); // 5 second timeout
                    })
                  ]);
                
                // Read the extracted image and convert to base64
                  try {
                const artBuffer = await fs.readFile(tempArtPath);
                    const stats = await fs.stat(tempArtPath);
                    
                    // Only use if file is reasonable size (not corrupted)
                    if (stats.size > 0 && stats.size < 10 * 1024 * 1024) { // Max 10MB
                albumArt = `data:image/jpeg;base64,${artBuffer.toString('base64')}`;
                    }
                
                // Clean up temp file
                    await fs.unlink(tempArtPath).catch(() => {});
                  } catch (readError) {
                    // Silently skip - album art is optional
                    try {
                await fs.unlink(tempArtPath);
                    } catch {}
                  }
                } catch (extractError) {
                  // Timeout or extraction failed - silently skip
                  if (ffmpegProcess && !ffmpegProcess.killed) {
                    ffmpegProcess.kill('SIGKILL');
                  }
                  try {
                    await fs.unlink(tempArtPath).catch(() => {});
                  } catch {}
                }
              }
            } catch (artError) {
            // Silently skip album art extraction failures - not critical
            // Album art is optional, don't block processing
          }
          
          // Extract additional metadata from FFprobe
          const stream = ffprobeOutput.streams?.find(s => s.codec_type === 'audio') || ffprobeOutput.streams?.[0];
          const sampleRate = stream?.sample_rate || '';
          const bitRate = ffprobeOutput.format?.bit_rate || '';
          const duration = ffprobeOutput.format?.duration ? (ffprobeOutput.format.duration * 1000).toString() : '';
            
            // Parse custom tags from TXXX frames in ffprobe tags
            const customTags = [];
            for (const [key, value] of Object.entries(tags)) {
              if (key.startsWith('TXXX:MYTAG') || key === 'TXXX:MYTAG' || key.includes('MYTAG')) {
                const tagValue = String(value);
                const colonIndex = tagValue.indexOf(':');
                if (colonIndex > 0) {
                  const category = tagValue.substring(0, colonIndex).trim();
                  const name = tagValue.substring(colonIndex + 1).trim();
                  if (category && name) {
                    customTags.push({ category, name });
                  }
                } else {
                  customTags.push({ category: 'Custom', name: tagValue.trim() });
                }
              }
            }
            
            // Parse artist/title from filename if metadata is missing
            const basename = path.basename(trackPath, ext);
            let trackName = tags.title || tags.TITLE || basename;
            let trackArtist = tags.artist || tags.ARTIST || '';
            
            // If artist is missing, try to parse from filename
            if (!trackArtist) {
              const parsed = parseArtistTitleFromFilename(basename);
              if (parsed.artist) {
                trackArtist = parsed.artist;
              }
              // Also use parsed title if metadata title is missing
              if (!tags.title && !tags.TITLE && parsed.title) {
                trackName = parsed.title;
              }
            }
            
            // Try to read POPM rating from file (may fail if music-metadata can't parse)
            let ratingByte;
            try {
              ratingByte = await readBonkPopmRatingByte(trackPath);
            } catch {
              ratingByte = undefined; // FFprobe fallback - rating reading may not work
            }
            
            result.tracks.push({
              TrackID: trackId,
              Name: trackName,
              Artist: trackArtist || 'Unknown Artist',
              Album: tags.album || tags.ALBUM || '',
              Genre: tags.genre || tags.GENRE || '',
              Year: tags.date || tags.DATE || tags.year || tags.YEAR || '',
            AverageBpm: tags.bpm || tags.BPM || '',
              Comments: tags.comment || tags.COMMENT || '',
            Tonality: tags.tkey || tags.TKEY || tags.initialkey || tags.INITIALKEY || '',
            TotalTime: duration,
            BitRate: bitRate,
            SampleRate: sampleRate,
              Kind: ext.substring(1).toUpperCase() + ' File',
              Size: (await fs.stat(trackPath)).size.toString(),
              Location: 'file://localhost' + trackPath,
              DateAdded: new Date().toISOString(),
              AlbumArt: albumArt,
              tags: customTags.length > 0 ? customTags : undefined,
              // POPM rating byte (0-255) read from file
              ratingByte: ratingByte,
            });
            
          if (process.env.NODE_ENV === 'development') {
            console.log('✓ Track imported using FFprobe', useFFprobe ? '(AIFF)' : '(fallback)');
          }
          } catch (ffprobeError) {
            console.error('❌ FFprobe also failed:', ffprobeError.message);
            // Last resort: filename only - try to parse artist/title from filename
            const trackId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const basename = path.basename(trackPath, path.extname(trackPath));
            const parsed = parseArtistTitleFromFilename(basename);
            result.tracks.push({
              TrackID: trackId,
              Name: parsed.title || basename,
              Artist: parsed.artist || 'Unknown Artist',
              Album: '',
              Genre: '',
              Location: 'file://localhost' + trackPath,
              DateAdded: new Date().toISOString(),
            });
        }
      }
      
      // Create playlist for current folder if it has tracks
      if (tracks.length > 0) {
        const playlistName = path.basename(dirPath);
        result.playlists.push({
          Name: playlistName === path.basename(basePath) ? 'Root' : playlistName,
          Type: '1',
          KeyType: 'TrackID',
          Entries: result.tracks.map(t => t.TrackID),
          Children: []
        });
      }
      
      // Recursively scan subfolders
      for (const subfolder of subfolders) {
        const subResult = await scanDirectory(subfolder.path, basePath);
        result.tracks.push(...subResult.tracks);
        
        if (subResult.playlists.length > 0 || subResult.tracks.length > 0) {
          result.playlists.push({
            Name: subfolder.name,
            Type: '0',
            KeyType: 'TrackID',
            Entries: [],
            Children: subResult.playlists
          });
        }
      }
      
      return result;
    }
    
    const scanResult = await scanDirectory(folderPath);
    
    console.log(`Scan complete: ${scanResult.tracks.length} tracks found`);
    
    return {
      success: true,
      library: {
        tracks: scanResult.tracks,
        playlists: scanResult.playlists
      }
    };
  } catch (error) {
    console.error('Folder scan error:', error);
    return { success: false, error: error.message };
  }
});

// Reload track metadata from file (discard changes)
ipcMain.handle('reload-track', async (_, trackPath) => {
  try {
    // Ensure music-metadata is loaded
    if (!mm) {
      mm = await import('music-metadata');
    }
    
    // Parse file location
    let filePath = trackPath;
    if (filePath.startsWith('file://localhost/')) {
      filePath = filePath.replace('file://localhost/', '/');
    } else if (filePath.startsWith('file://')) {
      filePath = filePath.replace('file://', '');
    }
    filePath = decodeURIComponent(filePath);
    
    console.log('📂 Reloading track from file:', path.basename(filePath));
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error('File not found');
    }
    
    // Parse metadata from file
    try {
      const metadata = await mm.parseFile(filePath);
      const ext = path.extname(filePath);
      
      // Extract album art if available
      let albumArt = null;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        albumArt = `data:${picture.format};base64,${picture.data.toString('base64')}`;
      }
      
      // Parse artist/title from filename if metadata is missing
      const basename = path.basename(filePath, ext);
      let trackName = metadata.common.title || basename;
      let trackArtist = metadata.common.artist || '';
      
      // If artist is missing, try to parse from filename
      if (!trackArtist) {
        const parsed = parseArtistTitleFromFilename(basename);
        if (parsed.artist) {
          trackArtist = parsed.artist;
        }
        // Also use parsed title if metadata title is missing
        if (!metadata.common.title && parsed.title) {
          trackName = parsed.title;
        }
      }
      
      // Read POPM rating byte from file
      const ratingByte = await readBonkPopmRatingByte(filePath);
      
      // Return fresh metadata from file
      const freshTrack = {
        Name: trackName,
        Artist: trackArtist || 'Unknown Artist',
        Album: metadata.common.album || '',
        Genre: metadata.common.genre ? metadata.common.genre.join(', ') : '',
        Year: metadata.common.year?.toString() || '',
        AverageBpm: metadata.common.bpm?.toString() || '',
        TotalTime: metadata.format.duration ? (metadata.format.duration * 1000).toString() : '',
        BitRate: metadata.format.bitrate?.toString() || '',
        SampleRate: metadata.format.sampleRate?.toString() || '',
        Kind: metadata.format.codec || ext.substring(1).toUpperCase() + ' File',
        // Additional metadata fields
        TrackNumber: metadata.common.track?.no?.toString() || metadata.common.track?.toString() || '',
        DiscNumber: metadata.common.disk?.no?.toString() || metadata.common.disk?.toString() || '',
        Composer: metadata.common.composer?.[0] || '',
        AlbumArtist: metadata.common.albumartist || '',
        Lyricist: metadata.common.lyricist?.[0] || '',
        OriginalArtist: metadata.common.originalartist?.[0] || '',
        Remixer: metadata.common.remixer?.[0] || '',
        Label: metadata.common.label?.[0] || '',
        MixName: metadata.common.subtitle?.[0] || '',
        ReleaseDate: metadata.common.date || '',
        Size: (await fs.stat(filePath)).size.toString(),
        Comments: metadata.common.comment?.[0] || '',
        Tonality: metadata.common.key || '',
        Key: metadata.common.key || '',
        AlbumArt: albumArt,
        // Parse custom tags from TXXX frames (ID3)
        tags: parseCustomTagsFromMetadata(metadata),
        // POPM rating byte (0-255) read from file
        ratingByte: ratingByte,
      };
      
      console.log('✓ Track reloaded from file');
      return freshTrack;
    } catch (parseError) {
      // If metadata parsing fails, return minimal info from filename
      console.warn('Could not parse metadata, using filename:', parseError.message);
      const ext = path.extname(filePath);
      
      return {
        Name: path.basename(filePath, ext),
        Artist: 'Unknown Artist',
        Album: '',
        Genre: '',
        Year: '',
        AverageBpm: '',
        TotalTime: '',
        Kind: ext.substring(1).toUpperCase() + ' File',
        Size: (await fs.stat(filePath)).size.toString(),
      };
    }
  } catch (error) {
    console.error('Reload track error:', error);
    throw error;
  }
});

ipcMain.handle('detect-key', async (_, trackPath) => {
  try {
    // Ensure music-metadata is loaded
    if (!mm) {
      mm = await import('music-metadata');
    }
    
    // Parse file location
    let filePath = trackPath;
    if (filePath.startsWith('file://localhost/')) {
      filePath = filePath.replace('file://localhost/', '/');
    } else if (filePath.startsWith('file://')) {
      filePath = filePath.replace('file://', '');
    }
    filePath = decodeURIComponent(filePath);
    
    // First try reading key from metadata
    try {
      const metadata = await mm.parseFile(filePath);
      const existingKey = metadata.common.key;
      
      if (existingKey) {
        console.log('✓ Key found in metadata:', existingKey);
        return {
          success: true,
          key: existingKey,
          confidence: 0.8,
          method: 'metadata'
        };
      }
    } catch (metaError) {
      // If metadata can't be parsed, that's okay - KeyFinder will analyze the audio directly
      console.log('⚠️ Could not read metadata, will analyze audio with KeyFinder:', metaError.message);
    }
    
    // Use real key detection with KeyFinder CLI
    try {
      const detectedKey = await realKeyDetection(filePath);
      if (detectedKey) {
        return {
          success: true,
          key: detectedKey.key,
          confidence: detectedKey.confidence,
          method: 'keyfinder'
        };
      }
    } catch (analysisError) {
      // KeyFinder analysis failed (file might be truly unanalyzable)
      console.error('KeyFinder analysis failed:', analysisError.message);
    }
    
    return {
      success: true,
      key: null,
      confidence: 0,
      method: 'none'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Real key detection using KeyFinder CLI
async function realKeyDetection(filePath) {
  try {
    console.log('🎹 Running KeyFinder analysis for:', path.basename(filePath));
    
    // Path to keyfinder-cli binary
    const keyfinderPath = path.join(__dirname, 'bin', 'keyfinder-cli');
    
    // Check if keyfinder-cli exists
    try {
      await fs.access(keyfinderPath, fs.constants.X_OK);
    } catch (error) {
      console.error('KeyFinder CLI not found at:', keyfinderPath);
      return null;
    }
    
    // Run keyfinder-cli with spawn for better handling
    const { spawn } = require('child_process');
    
    const detectedKey = await new Promise((resolve, reject) => {
      const keyfinderProcess = spawn(keyfinderPath, [filePath]);
      
      let stdout = '';
      let stderr = '';
      
      keyfinderProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      keyfinderProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      keyfinderProcess.on('close', (code) => {
        if (code === 0) {
          // KeyFinder returns the key on stdout (e.g., "Dm\n" or "A\n")
          const key = stdout.trim();
          
          if (key && key !== 'silence') {
            console.log(`✓ KeyFinder detected: ${key}`);
            resolve(key);
          } else {
            console.log('✗ KeyFinder: No key detected (silence or unanalyzable)');
            resolve(null);
          }
        } else {
          console.error('KeyFinder failed with code:', code);
          console.error('stderr:', stderr);
          resolve(null);
        }
      });
      
      keyfinderProcess.on('error', (err) => {
        console.error('KeyFinder process error:', err);
        resolve(null);
      });
    });
    
    if (detectedKey) {
      return {
        key: detectedKey,
        confidence: 0.9,  // KeyFinder is highly accurate
      };
    }
    
    return null;
  } catch (error) {
    console.error('KeyFinder detection error:', error);
    return null;
  }
}

// Rekordbox Database Bridge IPC Handlers
ipcMain.handle('rekordbox-get-config', async () => {
  try {
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    const { stdout, stderr } = await execAsync(`${pythonPath} "${bridgePath}" get-config`);
    
    if (stderr) {
      console.error('Python stderr:', stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Rekordbox config error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rekordbox-set-config', async (_, installDir, appDir) => {
  try {
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    const { stdout, stderr } = await execAsync(
      `${pythonPath} "${bridgePath}" set-config "${installDir}" "${appDir}"`
    );
    
    if (stderr) {
      console.error('Python stderr:', stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Rekordbox set config error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rekordbox-import-database', async (event, dbPath) => {
  try {
    console.log('📀 Importing from Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    const args = dbPath 
      ? [bridgePath, 'import-database', dbPath]
      : [bridgePath, 'import-database'];
    
    console.log('Running python with args:', args);
    
    // Use spawn for streaming progress updates
    return new Promise((resolve) => {
      const proc = spawn(pythonPath, args, {
        maxBuffer: 50 * 1024 * 1024
      });
      
      let stdout = '';
      let stderr = '';
      let lastProgressSent = 0;
      
      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Send progress updates (throttled to avoid flooding)
        const now = Date.now();
        if (now - lastProgressSent > 200) {
          lastProgressSent = now;
          // Try to extract progress from Python output
          const progressMatch = chunk.match(/Progress:\s*(\d+)/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1], 10);
            event.sender.send('database-progress', { 
              operation: 'import', 
              progress,
              message: `Importing tracks... ${progress}%`
            });
          }
        }
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (stderr) {
          console.warn('Python stderr:', stderr);
        }
        
        try {
          const result = JSON.parse(stdout);
          console.log(`✓ Imported ${result.trackCount} tracks, ${result.playlistCount} playlists`);
          
          // Send completion progress
          event.sender.send('database-progress', { 
            operation: 'import', 
            progress: 100,
            message: 'Import complete'
          });
          
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout.slice(0, 500));
          resolve({ 
            success: false, 
            error: `Failed to parse import result: ${parseError.message}` 
          });
        }
      });
      
      proc.on('error', (error) => {
        console.error('Rekordbox import error:', error);
        resolve({ 
          success: false, 
          error: `Failed to import from Rekordbox database: ${error.message}` 
        });
      });
    });
  } catch (error) {
    console.error('Rekordbox import error:', error);
    return { 
      success: false, 
      error: `Failed to import from Rekordbox database: ${error.message}` 
    };
  }
});

ipcMain.handle('rekordbox-backup-database', async (_, dbPath) => {
  try {
    console.log('📀 Backing up Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    const command = dbPath
      ? `${pythonPath} "${bridgePath}" backup-database "${dbPath}"`
      : `${pythonPath} "${bridgePath}" backup-database`;

    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`✓ Database backed up to: ${result.backup_path}`);
    }

    return result;
  } catch (error) {
    console.error('Rekordbox backup error:', error);
    return {
      success: false,
      error: `Failed to backup Rekordbox database: ${error.message}`
    };
  }
});

ipcMain.handle('rekordbox-check-integrity', async (_, dbPath) => {
  try {
    console.log('🔍 Checking Rekordbox database integrity...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    const command = dbPath
      ? `${pythonPath} "${bridgePath}" check-integrity "${dbPath}"`
      : `${pythonPath} "${bridgePath}" check-integrity`;

    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success && result.integrity_ok) {
      console.log('✓ Database integrity check passed');
    } else if (result.success && !result.integrity_ok) {
      console.warn('⚠ Database integrity check failed:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Rekordbox integrity check error:', error);
    return {
      success: false,
      error: `Failed to check database integrity: ${error.message}`
    };
  }
});

ipcMain.handle('rekordbox-repair-database', async (_, dbPath) => {
  try {
    console.log('🔧 Repairing Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    const command = dbPath
      ? `${pythonPath} "${bridgePath}" repair-database "${dbPath}"`
      : `${pythonPath} "${bridgePath}" repair-database`;

    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large databases
    });

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success) {
      console.log('✓ Database repair completed successfully');
    } else {
      console.error('✗ Database repair failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Rekordbox repair error:', error);
    return {
      success: false,
      error: `Failed to repair Rekordbox database: ${error.message}`
    };
  }
});

ipcMain.handle('rekordbox-export-database', async (_, library, dbPath, syncMode) => {
  try {
    console.log('📀 Exporting to Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    // Write library to temp file to avoid command line length limits
    const tempFile = path.join(require('os').tmpdir(), `bonk_export_${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify(library));
    
    const command = dbPath
      ? `${pythonPath} "${bridgePath}" export-database "@${tempFile}" "${dbPath}" "${syncMode}"`
      : `${pythonPath} "${bridgePath}" export-database "@${tempFile}" "" "${syncMode}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024
    });
    
    // Clean up temp file
    await fs.unlink(tempFile);
    
    if (stderr) {
      console.warn('Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    const added = result?.added ?? 0;
    const updated = result?.updated ?? 0;
    const deleted = result?.deleted ?? 0;
    const skipped = result?.skipped ?? 0;
    const corruptionCount = Array.isArray(result?.corruption_hits) ? result.corruption_hits.length : 0;
    console.log(`✓ Export complete: ${added} added, ${updated} updated, ${deleted} deleted, ${skipped} skipped${corruptionCount ? ` (${corruptionCount} corruption hit${corruptionCount === 1 ? '' : 's'})` : ''}`);
    
    return result;
  } catch (error) {
    console.error('Rekordbox export error:', error);
    return { 
      success: false, 
      error: `Failed to export to Rekordbox database: ${error.message}` 
    };
  }
});

ipcMain.handle('rekordbox-create-smart-playlist', async (_, name, conditions, logicalOperator, parent) => {
  try {
    console.log('🎵 Creating smart playlist...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    // Write conditions to temp file to avoid command line issues
    const tempFile = path.join(require('os').tmpdir(), `bonk_smart_playlist_${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify({
      name,
      conditions,
      logical_operator: logicalOperator || 1,
      parent
    }));

    const command = `${pythonPath} "${bridgePath}" create-smart-playlist-from-file "${tempFile}"`;

    const { stdout, stderr } = await execAsync(command);

    // Clean up temp file
    await fs.unlink(tempFile);

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`✓ Smart playlist created: ${result.playlist_name}`);
    }

    return result;
  } catch (error) {
    console.error('Rekordbox smart playlist creation error:', error);
    return {
      success: false,
      error: `Failed to create smart playlist: ${error.message}`
    };
  }
});

ipcMain.handle('rekordbox-get-smart-playlist-contents', async (_, playlistId) => {
  try {
    console.log('🎵 Getting smart playlist contents...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    const command = `${pythonPath} "${bridgePath}" get-smart-playlist-contents "${playlistId}"`;

    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`✓ Retrieved ${result.track_count} tracks from smart playlist`);
    }

    return result;
  } catch (error) {
    console.error('Rekordbox smart playlist contents error:', error);
    return {
      success: false,
      error: `Failed to get smart playlist contents: ${error.message}`
    };
  }
});

ipcMain.handle('apply-smart-fixes', async (_, trackIds, fixes) => {
  try {
    console.log('🎯 Applying smart fixes...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();

    // Write fixes config to temp file to avoid command line issues
    const tempFile = path.join(require('os').tmpdir(), `bonk_smart_fixes_${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify({
      trackIds,
      fixes
    }));

    const command = `${pythonPath} "${bridgePath}" apply-smart-fixes "${tempFile}"`;

    const { stdout, stderr } = await execAsync(command);

    // Clean up temp file
    await fs.unlink(tempFile);

    if (stderr) {
      console.warn('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`✓ Applied smart fixes to ${result.updated} tracks`);
    }

    return result;
  } catch (error) {
    console.error('Smart fixes error:', error);
    return {
      success: false,
      error: `Failed to apply smart fixes: ${error.message}`
    };
  }
});

ipcMain.handle('locate-missing-file', async (_, trackName) => {
  try {
    const result = await dialog.showOpenDialog({
      title: `Locate file for: ${trackName}`,
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aiff', 'flac', 'm4a', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('Error locating file:', error);
    return null;
  }
});

ipcMain.handle('rekordbox-select-database', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Rekordbox Database', extensions: ['db'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    message: 'Select Rekordbox master.db file',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('check-file-exists', async (_, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return false;
    let p = filePath.trim();
    if (process.platform === 'win32' && p.startsWith('/') && p.length > 2 && p[2] === ':') {
      p = p.slice(1); // /D:/path -> D:/path for Windows
    }
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
});

// Reveal file in OS file manager (Finder on macOS, Explorer on Windows)
ipcMain.handle('show-item-in-folder', async (_, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    let p = filePath.trim();
    if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', process.platform === 'win32' ? '' : '/');
    else if (p.startsWith('file://')) p = p.replace('file://', process.platform === 'win32' ? '' : '');
    if (process.platform === 'win32' && p.startsWith('/') && p.length > 2 && p[2] === ':') p = p.slice(1);
    await fs.access(p).catch(() => {});
    shell.showItemInFolder(path.resolve(p));
  } catch (e) {
    console.warn('show-item-in-folder:', e.message);
  }
});

// Recursively search folder for a file by name (case-insensitive). Returns full path or null.
async function findFileInFolder(dirPath, targetFilename, maxDepth = 15, currentDepth = 0) {
  if (currentDepth >= maxDepth) return null;
  const targetLower = targetFilename.toLowerCase();
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        const found = await findFileInFolder(fullPath, targetFilename, maxDepth, currentDepth + 1);
        if (found) return found;
      } else if (ent.isFile() && ent.name.toLowerCase() === targetLower) {
        return fullPath;
      }
    }
  } catch (_) {}
  return null;
}

// Build a map of filename (lowercase) -> fullPath for all audio files in folder, recursively.
async function indexFilesInFolder(dirPath, extensions, fileMap, maxFiles = 50000, maxDepth = 15, currentDepth = 0) {
  if (currentDepth >= maxDepth || fileMap.size >= maxFiles) return;
  const extSet = new Set(extensions.map(e => e.toLowerCase()));
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      if (fileMap.size >= maxFiles) break;
      const fullPath = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        await indexFilesInFolder(fullPath, extensions, fileMap, maxFiles, maxDepth, currentDepth + 1);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (extSet.has(ext)) {
          fileMap.set(ent.name.toLowerCase(), fullPath);
        }
      }
    }
  } catch (_) {}
}

ipcMain.handle('search-file-in-folder', async (_, folderPath, filename) => {
  try {
    return await findFileInFolder(folderPath, filename);
  } catch (e) {
    console.error('search-file-in-folder error:', e);
    return null;
  }
});

// Search for multiple files at once - returns { trackId: fullPath } for found files
ipcMain.handle('search-missing-tracks-in-folder', async (_, folderPath, requests) => {
  // requests: [{ trackId, baseName, extension }]
  const fileMap = new Map();
  const extensions = [...new Set(requests.map(r => ((r.extension || '.mp3').startsWith('.') ? r.extension : `.${r.extension}`).toLowerCase()))];
  await indexFilesInFolder(folderPath, extensions, fileMap);
  const results = {};
  for (const { trackId, baseName, extension } of requests) {
    const ext = (extension || '.mp3').startsWith('.') ? extension : `.${extension}`;
    const targetFilename = baseName + ext;
    const found = fileMap.get(targetFilename.toLowerCase());
    if (found) results[trackId] = found;
  }
  return results;
});

ipcMain.handle('get-anlz-data', async (_, trackPath, dbPath) => {
  try {
    const pythonPath = process.platform === 'darwin' ? 'python3' : 'python';
    const bridgePath = getRekordboxBridgePath();
    const tempFile = path.join(os.tmpdir(), `bonk_anlz_${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify({
      track_path: trackPath,
      db_path: dbPath || null
    }));
    const command = `${pythonPath} "${bridgePath}" get-anlz-data "@${tempFile}"`;
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 4 * 1024 * 1024 });
    await fs.unlink(tempFile).catch(() => {});
    if (stderr) console.warn('get-anlz-data stderr:', stderr);
    return JSON.parse(stdout);
  } catch (e) {
    return { success: false, error: e.message, waveform: null, cues: [], duration_ms: null };
  }
});

ipcMain.handle('write-tags', async (_, tracks, settings) => {
  console.log('=== WRITE TAGS CALLED (using FFmpeg) ===');
  console.log('Tracks:', tracks.length);
  console.log('Settings:', settings);
  
  return new Promise((resolve) => {
    let successCount = 0;
    let processedCount = 0;
    const errors = [];

    // Process tracks sequentially to avoid issues
    const processTracks = async () => {
      for (const track of tracks) {
        try {
          console.log('\n--- Processing:', track.Name);
          
          // Parse file location with improved Rekordbox path handling
          let filePath = track.Location;

          if (!filePath) {
            console.error('No location for track');
            errors.push(`No file location: ${track.Name} - This track was imported from Rekordbox but the audio file path is not available. Try re-importing from Rekordbox or manually locating the file.`);
            processedCount++;
            continue;
          }

          console.log('Original location:', filePath);

          // Handle various file path formats
          if (filePath.startsWith('file://localhost/')) {
            filePath = filePath.replace('file://localhost/', '/');
          } else if (filePath.startsWith('file://')) {
            filePath = filePath.replace('file://', '');
          }

          filePath = decodeURIComponent(filePath);

          // For Rekordbox imports, the path might be relative or need path expansion
          // Try multiple path resolution strategies
          const pathCandidates = [filePath];

          // If it's a relative path, try resolving relative to common music directories
          if (!path.isAbsolute(filePath)) {
            const homeDir = require('os').homedir();
            const musicDirs = [
              path.join(homeDir, 'Music'),
              path.join(homeDir, 'Documents', 'Rekordbox'),
              path.join(homeDir, 'Desktop'),
              path.join(homeDir, 'Downloads'),
              '/Volumes', // For external drives on macOS
              '/Users/Shared' // Common shared location
            ];

            for (const musicDir of musicDirs) {
              if (require('fs').existsSync(musicDir)) {
                pathCandidates.push(path.resolve(musicDir, filePath));
              }
            }
          }

          // Try to find a valid path
          let validPath = null;
          for (const candidatePath of pathCandidates) {
            try {
              await fs.access(candidatePath);
              validPath = candidatePath;
              console.log('✓ Found file at:', candidatePath);
              break;
            } catch {
              // Path doesn't exist, try next candidate
            }
          }

          if (!validPath) {
            console.error('File not found at any candidate path');
            console.error('Tried paths:', pathCandidates);
            errors.push(`File not found: ${track.Name} - Could not locate the audio file. The file may have been moved, renamed, or deleted. Try using the file locator to manually find this track.`);
            processedCount++;
            continue;
          }

          filePath = validPath;

          // Check if file exists
          try {
            await fs.access(filePath);
          } catch {
            console.error('File not found');
            errors.push(`File not found: ${track.Name}`);
            processedCount++;
            continue;
          }

          // First, verify file integrity by trying to read it
          console.log('Verifying file integrity with FFmpeg...');
          try {
            // Use FFmpeg to verify the file (more robust than music-metadata)
            const { spawn } = require('child_process');
            
            await new Promise((resolveVerify, rejectVerify) => {
              const verifyProcess = spawn(FFMPEG_PATH, [
                '-v', 'error',           // Only show errors
                '-i', filePath,          // Input file
                '-f', 'null',            // No output
                '-'                      // Output to nowhere
              ]);
              
              let errorOutput = '';
              
              verifyProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
              });
              
              verifyProcess.on('close', (code) => {
                if (code === 0) {
                  console.log('✓ File is valid and readable by FFmpeg');
                  resolveVerify();
                } else {
                  console.error('⚠️ FFmpeg detected issues:', errorOutput);
                  rejectVerify(new Error(errorOutput || 'File verification failed'));
                }
              });
            });
          } catch (verifyError) {
            console.error('⚠️ FILE VERIFICATION FAILED - SKIPPING to prevent damage');
            console.error('Error details:', verifyError.message);
            errors.push(`CORRUPTED FILE (skipped for safety): ${track.Name} - ${verifyError.message.substring(0, 100)}`);
            processedCount++;
            continue;
          }

          // Prepare metadata for FFmpeg
          const metadata = {};
          const ext = path.extname(filePath);
          const fileFormat = ext.toLowerCase();
          const filenameBase = path.basename(filePath, ext);
          const parsedFromFilename = parseArtistTitleFromFilename(filenameBase);
          const parsedFromTitle = track?.Name ? parseArtistTitleFromFilename(track.Name) : { artist: '', title: '' };
          const derivedArtist =
            (track?.Artist && track.Artist !== 'Unknown Artist' ? track.Artist : '') ||
            parsedFromFilename.artist ||
            parsedFromTitle.artist ||
            '';
          
          if (settings.writeTitle && track.Name) {
            metadata.title = track.Name;
          }
          // IMPORTANT: Many AIFFs have no embedded artist. If UI artist is empty,
          // fall back to parsing "Artist - Title" from filename/title.
          if (settings.writeArtist && derivedArtist) {
            metadata.artist = derivedArtist;
          }
          if (settings.writeAlbum && track.Album) {
            metadata.album = track.Album;
          }
          if (settings.writeGenre && track.Genre) {
            metadata.genre = track.Genre;
          }
          if (settings.writeYear && track.Year) {
            metadata.date = track.Year;
          }
          if (settings.writeReleaseDate && track.ReleaseDate) {
            // Write release date - FFmpeg uses 'date' for year, 'release_date' for full date
            metadata.release_date = track.ReleaseDate;
          }
          if (settings.writeComments && track.Comments) {
            metadata.comment = track.Comments;
          }
          if (settings.writeComposer && track.Composer) {
            metadata.composer = track.Composer;
          }
          if (settings.writeAlbumArtist && track.AlbumArtist) {
            metadata.album_artist = track.AlbumArtist;
          }
          if (settings.writeRemixer && track.Remixer) {
            metadata.remixer = track.Remixer;
          }
          if (settings.writeLabel && track.Label) {
            metadata.label = track.Label;
          }
          if (settings.writeTrackNumber && track.TrackNumber) {
            metadata.track = track.TrackNumber;
          }
          if (settings.writeDiscNumber && track.DiscNumber) {
            metadata.disc = track.DiscNumber;
          }
          if (settings.writeLyricist && track.Lyricist) {
            // FFmpeg uses 'lyricist' for ID3 TEXT frame
            metadata.lyricist = track.Lyricist;
          }
          if (settings.writeOriginalArtist && track.OriginalArtist) {
            // FFmpeg uses 'original_artist' for ID3 TOPE frame
            metadata.original_artist = track.OriginalArtist;
          }
          if (settings.writeMixName && track.MixName) {
            // FFmpeg uses 'title-3' or 'TIT3' for mix name/subtitle
            metadata['title-3'] = track.MixName;
          }
          // Rating -> POPM (Popularimeter) for ID3v2.3
          // NOTE: Rating writing is DISABLED here to prevent conflicts with QuickTag's POPM handler.
          // QuickTag uses audioTags:setRatingByte which properly removes ALL POPM frames before writing.
          // FFmpeg's popularimeter handling can create duplicate POPM frames or interfere with Rekordbox.
          // If rating needs to be written, use the QuickTag system (audioTags:setRatingByte) instead.
          // 
          // IMPORTANT: If FFmpeg rating writing is ever re-enabled, it MUST use 'bonk@suh' as the email
          // identifier to match QuickTag's POPM handler. Using a different email (like 'bonk@rating') would
          // create multiple POPM frames, causing Rekordbox to potentially read the wrong rating source.
          // 
          // Legacy code (disabled - DO NOT RE-ENABLE without using 'bonk@suh'):
          // if (settings.writeRating && track.Rating != null && track.Rating !== '') {
          //   const raw = Number(track.Rating);
          //   if (!Number.isNaN(raw) && raw >= 0 && raw <= 255) {
          //     const email = 'bonk@suh';  // MUST match QuickTag's email identifier
          //     const counter = 0;
          //     metadata.popularimeter = `${email}|${raw}|${counter}`;
          //   }
          // }

          // Log metadata but truncate very large fields
          const logMetadata = {};
          for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'string' && value.length > 200) {
              logMetadata[key] = `[${value.length} chars - truncated]`;
            } else if (typeof value === 'object' && value !== null) {
              logMetadata[key] = '[object - skipped]';
            } else {
              logMetadata[key] = value;
            }
          }
          console.log('Metadata to write:', logMetadata);

          // Handle album art if present
          let tempCoverPath = null;
          let hasAlbumArt = false;
          
          if (track.AlbumArt) {
            try {
              console.log('🎨 Processing album art for embedding...');
              
              // Decode base64 album art
              const base64Data = track.AlbumArt.replace(/^data:image\/\w+;base64,/, '');
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              // Create temp file for cover art
              const tempDir = require('os').tmpdir();
              tempCoverPath = path.join(tempDir, `cover_${Date.now()}.jpg`);
              
              // Save cover to temp file
              await fs.writeFile(tempCoverPath, imageBuffer);
              hasAlbumArt = true;
              console.log('✓ Album art saved to temp file');
            } catch (artError) {
              console.error('Failed to prepare album art:', artError.message);
              tempCoverPath = null;
            }
          }

          // Create temporary output file with proper extension
          const baseName = filePath.slice(0, -ext.length);
          const tempFile = `${baseName}_TEMP${ext}`;
          
          // Build FFmpeg arguments array (not string) for safer execution
          const ffmpegArgs = [
            '-i', filePath,
          ];

          // Add album art as second input if available
          if (hasAlbumArt && tempCoverPath) {
            ffmpegArgs.push('-i', tempCoverPath);
          }

          // Map audio streams
          if (hasAlbumArt) {
            ffmpegArgs.push(
              '-map', '0:a',           // Map audio from first input
              '-map', '1:0',           // Map image from second input
            );
          } else {
            ffmpegArgs.push(
              '-map', '0',             // Map all streams from input
            );
          }

          ffmpegArgs.push(
            '-map_metadata', '0',      // Copy all metadata from input
            '-c:a', 'copy',            // Copy audio without re-encoding
          );

          // If we have album art, set it as attached picture
          if (hasAlbumArt) {
            ffmpegArgs.push(
              '-c:v', 'copy',          // Copy image without re-encoding
              '-disposition:v:0', 'attached_pic',  // Mark as album art
            );
          }

          // Add metadata arguments
          for (const [key, value] of Object.entries(metadata)) {
            ffmpegArgs.push('-metadata', `${key}=${value}`);
          }

          // Add custom tags (MyTags) as TXXX frames for ID3 embedding
          // Combine all tags into a single TXXX frame (semicolon-separated)
          if (track.tags && Array.isArray(track.tags) && track.tags.length > 0) {
            console.log(`📌 Writing ${track.tags.length} custom tag(s) to file...`);
            const tagValues = [];
            for (const tag of track.tags) {
              if (tag && tag.name) {
                // Format: Category: Name (e.g., "Genre: Afro House")
                const tagValue = tag.category ? `${tag.category}: ${tag.name}` : tag.name;
                tagValues.push(tagValue);
                console.log(`  ✓ Tag: ${tagValue}`);
              }
            }
            if (tagValues.length > 0) {
              // Combine all tags into a single TXXX frame with semicolon separation
              const combinedTags = tagValues.join(';');
              // FFmpeg format: TXXX:description=value
              ffmpegArgs.push('-metadata', `TXXX:MYTAG=${combinedTags}`);
              console.log(`  📝 Combined tags: ${combinedTags}`);
            }
          } else {
            // Debug: log if tags are missing (this is normal - not all tracks have custom tags)
            if (process.env.NODE_ENV === 'development') {
              console.log(`  ℹ️ No custom tags to write for: ${track.Name}`);
            }
          }

          // Add format-specific flags
          if (fileFormat === '.mp3') {
            ffmpegArgs.push(
              '-write_id3v2', '1',      // Write ID3v2 tags
              '-id3v2_version', '3',    // Use ID3v2.3 (most compatible)
            );
          } else if (fileFormat === '.aiff' || fileFormat === '.aif') {
            // AIFF supports ID3v2 tags for compatibility with DJ software
            ffmpegArgs.push(
              '-write_id3v2', '1',      // Write ID3v2 tags to AIFF
              '-id3v2_version', '3',    // Use ID3v2.3
            );
          } else if (fileFormat === '.flac') {
            // FLAC uses vorbis comments natively, but also supports ID3
            ffmpegArgs.push(
              '-write_id3v2', '1',      // Write ID3v2 for compatibility
            );
          } else if (fileFormat === '.m4a' || fileFormat === '.m4p' || fileFormat === '.mp4') {
            // M4A uses iTunes-style metadata (already handled by -metadata)
            // No special flags needed
          } else if (fileFormat === '.ogg') {
            // OGG uses vorbis comments (already handled by -metadata)
            // No special flags needed
          } else if (fileFormat === '.wav') {
            // WAV can use ID3v2 or INFO chunks
            ffmpegArgs.push(
              '-write_id3v2', '1',      // Write ID3v2 for compatibility
            );
          }
          
          // Add final flag
          ffmpegArgs.push(
            '-y',                       // Overwrite output file
            tempFile
          );

          console.log('FFmpeg args:', ffmpegArgs);

          try {
            // Execute FFmpeg with spawn for better argument handling
            const { spawn } = require('child_process');
            
            await new Promise((resolveFFmpeg, rejectFFmpeg) => {
              console.log('Executing FFmpeg:', FFMPEG_PATH);
              console.log('With args:', JSON.stringify(ffmpegArgs, null, 2));
              
              const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);
              
              let stderrOutput = '';
              let stdoutOutput = '';
              
              ffmpegProcess.stdout.on('data', (data) => {
                stdoutOutput += data.toString();
              });
              
              ffmpegProcess.stderr.on('data', (data) => {
                stderrOutput += data.toString();
              });
              
              ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                  console.log('✓ FFmpeg completed successfully');
                  if (stderrOutput) {
                    console.log('FFmpeg output:', stderrOutput.substring(0, 500));
                  }
                  resolveFFmpeg();
                } else {
                  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.error('FFmpeg FAILED with exit code:', code);
                  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.error('STDOUT:', stdoutOutput);
                  console.error('STDERR:', stderrOutput);
                  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  rejectFFmpeg(new Error(`FFmpeg exited with code ${code}\n\nSTDERR:\n${stderrOutput}`));
                }
              });
              
              ffmpegProcess.on('error', (err) => {
                console.error('FFmpeg process error:', err);
                rejectFFmpeg(err);
              });
            });
            
            // Verify temp file was created and is valid
            try {
              const tempStats = await fs.stat(tempFile);
              const origStats = await fs.stat(filePath);
              
              // Sanity check - temp file should be similar size
              if (tempStats.size < origStats.size * 0.5) {
                throw new Error('Output file is suspiciously small');
              }
              
              // Replace original with temp file
              await fs.unlink(filePath);
              await fs.rename(tempFile, filePath);
              
              successCount++;
              console.log('✓ Successfully wrote tags with FFmpeg');
            } catch (verifyError) {
              console.error('Verification failed:', verifyError);
              // Clean up temp files
              try { await fs.unlink(tempFile); } catch {}
              if (tempCoverPath) {
                try { await fs.unlink(tempCoverPath); } catch {}
              }
              errors.push(`${track.Name}: Output verification failed`);
            }
            
            // Clean up temp cover file if it exists
            if (tempCoverPath) {
              try { 
                await fs.unlink(tempCoverPath);
                console.log('✓ Cleaned up temp cover file');
              } catch {}
            }
          } catch (ffmpegError) {
            console.error('FFmpeg command failed:', ffmpegError);
            // Extract the most relevant error line from stderr
            const errorLines = ffmpegError.message.split('\n');
            const relevantError = errorLines.find(line => 
              line.includes('Error') || 
              line.includes('Invalid') || 
              line.includes('Unable')
            ) || errorLines[0];
            errors.push(`${track.Name}: ${relevantError}`);
            // Clean up temp files
            try { await fs.unlink(tempFile); } catch {}
            if (tempCoverPath) {
              try { await fs.unlink(tempCoverPath); } catch {}
            }
          }

          processedCount++;
        } catch (error) {
          console.error('Error processing track:', error);
          errors.push(`${track.Name}: ${error.message}`);
          processedCount++;
        }
      }

      console.log('\n=== WRITE TAGS COMPLETE ===');
      console.log('Success:', successCount, '/', tracks.length);
      console.log('Errors:', errors.length);
      if (errors.length > 0) {
        console.log('\nError details:');
        errors.forEach((error, idx) => {
          console.log(`  ${idx + 1}. ${error}`);
        });
      }

      resolve({
        success: true,
        count: successCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    };

    processTracks().catch((error) => {
      console.error('=== WRITE TAGS ERROR ===', error);
      resolve({ success: false, error: error.message });
    });
  });
});

// Helper function to convert audio file
async function convertAudioFile(inputPath, outputPath, format) {
  console.log(`🔄 Converting ${inputPath} to ${outputPath} (${format})`);
  
  // Check if input file exists
  try {
    await fs.access(inputPath);
  } catch {
    return { success: false, error: 'Input file not found' };
  }

  // Check if output file already exists
  let fileExists = false;
  try {
    await fs.access(outputPath);
    fileExists = true;
    
    // Check if the existing file is valid (not empty)
    const stats = await fs.stat(outputPath);
    if (stats.size > 0) {
      // File exists and is valid - skip conversion but treat as success
      console.log(`⚠️ Output file already exists: ${path.basename(outputPath)} - skipping conversion`);
      return { 
        success: true, 
        skipped: true,
        message: 'Output file already exists',
        outputPath: outputPath,
        inputSize: (await fs.stat(inputPath)).size,
        outputSize: stats.size
      };
    } else {
      // File exists but is empty - delete it and proceed
      console.log(`⚠️ Output file exists but is empty - removing and re-converting`);
      await fs.unlink(outputPath);
      fileExists = false;
    }
  } catch {
    // File doesn't exist, proceed with conversion
    fileExists = false;
  }

  // Build FFmpeg arguments based on format
  const ffmpegArgs = ['-y', '-i', inputPath];
  
  // Map all streams (audio, video if present, etc.)
  ffmpegArgs.push('-map', '0');
  
  // Preserve all metadata from input
  ffmpegArgs.push('-map_metadata', '0');
  
  // Add format-specific encoding options
  switch (format.toUpperCase()) {
    case 'MP3':
      ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '320k', '-q:a', '0');
      // MP3 supports ID3v2 tags
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    case 'FLAC':
      ffmpegArgs.push('-c:a', 'flac', '-compression_level', '12');
      // FLAC uses vorbis comments natively, but also supports ID3v2 for compatibility
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    case 'AIFF':
      ffmpegArgs.push('-c:a', 'pcm_s24be'); // 24-bit PCM big-endian for AIFF
      // AIFF supports ID3v2 tags for compatibility with DJ software
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    case 'WAV':
      ffmpegArgs.push('-c:a', 'pcm_s24le'); // 24-bit PCM little-endian for WAV
      // WAV can use ID3v2 tags for compatibility
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    case 'M4A':
    case 'AAC':
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '320k', '-q:a', '0');
      // M4A uses iTunes-style metadata, but ID3v2 can be added for compatibility
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    case 'OGG':
      ffmpegArgs.push('-c:a', 'libvorbis', '-q:a', '6');
      // OGG uses vorbis comments natively, but ID3v2 can be added for compatibility
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
      break;
    default:
      // Default: copy audio stream (lossless)
      ffmpegArgs.push('-c:a', 'copy');
      // Add ID3v2 for unknown formats that might support it
      ffmpegArgs.push('-write_id3v2', '1', '-id3v2_version', '3');
  }
  
  // Copy video streams if present (for files with embedded artwork/video)
  ffmpegArgs.push('-c:v', 'copy');
  
  // Output file
  ffmpegArgs.push(outputPath);

  // Execute FFmpeg
  const { spawn } = require('child_process');
  
  await new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);
    
    let stderrOutput = '';
    
    ffmpegProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Conversion successful: ${path.basename(outputPath)}`);
        resolve();
      } else {
        console.error(`✗ FFmpeg failed with code ${code}`);
        reject(new Error(`FFmpeg conversion failed: ${stderrOutput.substring(0, 500)}`));
      }
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      reject(err);
    });
  });

  // Verify output file was created
  try {
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      return { success: false, error: 'Output file is empty' };
    }
  } catch {
    return { success: false, error: 'Output file was not created' };
  }

  return { 
    success: true, 
    outputPath: outputPath,
    inputSize: (await fs.stat(inputPath)).size,
    outputSize: (await fs.stat(outputPath)).size
  };
}

// Convert audio file format using FFmpeg
ipcMain.handle('convert-audio-file', async (_, inputPath, outputPath, format) => {
  try {
    return await convertAudioFile(inputPath, outputPath, format);
  } catch (error) {
    console.error('Conversion error:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to update Rekordbox database path
async function updateRekordboxPath(trackId, newPath, oldPath, dbPath) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const bridgePath = getRekordboxBridgePath();
    const pythonPath = process.platform === 'darwin' ? 'python3' : 'python';
    
    // Escape paths for shell - handle special characters
    const escapePath = (p) => {
      if (!p) return '';
      return p.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    };
    
    const escapedNewPath = escapePath(newPath);
    const escapedOldPath = escapePath(oldPath || '');
    const escapedDbPath = escapePath(dbPath || '');
    
    // Use pyrekordbox to update the path
    // Pass old_path so we can find track by path if ID is invalid
    // Always pass old_path, even if empty (Python will handle None)
    const command = `${pythonPath} "${bridgePath}" update-path "${trackId}" "${escapedNewPath}" "${escapedOldPath}" ${escapedDbPath ? `"${escapedDbPath}"` : ''}`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });
    
    const result = JSON.parse(stdout);
    return result;
  } catch (error) {
    console.error('Update path error:', error);
    return { success: false, error: error.message };
  }
}

// Update Rekordbox database path for a track
ipcMain.handle('update-rekordbox-path', async (_, trackId, newPath, oldPath, dbPath) => {
  return await updateRekordboxPath(trackId, newPath, oldPath, dbPath);
});

// Batch convert tracks with progress
ipcMain.handle('batch-convert-tracks', async (_, conversions, options) => {
  console.log('🔄 batch-convert-tracks handler called with', conversions.length, 'conversions');
  const { deleteOriginals = false, archivePath = null } = options || {};
  const results = [];
  const errors = [];
  
  // Emit progress events
  const mainWindow = BrowserWindow.getAllWindows()[0];
  const emitProgress = (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('conversion-progress', data);
    }
  };

  try {
    for (let i = 0; i < conversions.length; i++) {
      const conv = conversions[i];
      
      emitProgress({
        current: i + 1,
        total: conversions.length,
        track: conv.trackName || path.basename(conv.oldPath),
        status: 'converting'
      });

      // Convert the file
      const convertResult = await convertAudioFile(conv.oldPath, conv.newPath, conv.newFormat);
      
      if (!convertResult.success) {
        // Only treat as error if it wasn't skipped (file already exists is OK)
        if (!convertResult.skipped) {
          errors.push({
            track: conv.trackName || path.basename(conv.oldPath),
            error: convertResult.error,
            skipped: false
          });
        } else {
          // File already exists - treat as success but note it was skipped
          results.push({
            trackId: conv.trackId,
            oldPath: conv.oldPath,
            newPath: conv.newPath,
            success: true,
            skipped: true
          });
        }
        continue;
      }

      // Update Rekordbox database if trackId is provided
      if (conv.trackId) {
        emitProgress({
          current: i + 1,
          total: conversions.length,
          track: conv.trackName || path.basename(conv.oldPath),
          status: 'updating_database'
        });

        // Use the old path from the conversion - this is the original file path before conversion
        const oldPath = conv.oldPath || '';
        console.log(`Updating path for track ${conv.trackId}: ${oldPath} -> ${conv.newPath}`);
        const updateResult = await updateRekordboxPath(conv.trackId, conv.newPath, oldPath, conv.dbPath);
        
        if (!updateResult.success) {
          // If track was not found (skipped), don't treat as error
          if (updateResult.skipped) {
            console.log(`⚠️ Track not in Rekordbox database, skipping database update: ${conv.trackName || path.basename(conv.oldPath)}`);
            // Continue - file is converted, just not in database
          } else {
            // Check for database errors
            const isCorruptionError = updateResult.error && (
              updateResult.error.includes('database disk image is malformed') ||
              updateResult.error.includes('malformed')
            );
            const isLockError = updateResult.error && (
              updateResult.error.includes('locked') ||
              updateResult.error.includes('busy') ||
              updateResult.error.includes('close Rekordbox')
            );
            
            if (isLockError) {
              errors.push({
                track: conv.trackName || path.basename(conv.oldPath),
                error: `File converted successfully, but database is locked. Please close Rekordbox and try again. The converted file is ready to use.`
              });
            } else if (isCorruptionError) {
              errors.push({
                track: conv.trackName || path.basename(conv.oldPath),
                error: `File converted successfully, but database update failed (may be locked by Rekordbox or corrupted). Close Rekordbox and try again. The converted file is ready to use.`
              });
            } else {
              errors.push({
                track: conv.trackName || path.basename(conv.oldPath),
                error: `File converted successfully, but database update failed: ${updateResult.error}`
              });
            }
            // Continue anyway - file is converted
          }
        }
      }

      // Handle original file
      if (deleteOriginals) {
        if (archivePath) {
          // Move to archive
          const archiveFile = path.join(archivePath, path.basename(conv.oldPath));
          try {
            await fs.mkdir(archivePath, { recursive: true });
            await fs.rename(conv.oldPath, archiveFile);
          } catch (err) {
            console.error(`Failed to archive ${conv.oldPath}:`, err);
          }
        } else {
          // Delete original
          try {
            await fs.unlink(conv.oldPath);
          } catch (err) {
            console.error(`Failed to delete ${conv.oldPath}:`, err);
          }
        }
      }

      results.push({
        trackId: conv.trackId,
        oldPath: conv.oldPath,
        newPath: conv.newPath,
        success: true
      });
    }

    emitProgress({
      current: conversions.length,
      total: conversions.length,
      status: 'complete'
    });

    const skippedCount = results.filter(r => r.skipped).length;
    const actuallyConverted = results.filter(r => !r.skipped).length;

    return {
      success: true,
      converted: actuallyConverted,
      skipped: skippedCount,
      failed: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// AutoTag IPC Handlers
// ============================================================================

// Store active autotag runs
const autotagRuns = new Map();

// Helper: Send autotag event to renderer
function sendAutotagEvent(event, eventData) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('autotag:event', eventData);
  }
}

// Helper: Fuzzy string similarity (Dice coefficient)
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  
  const getBigrams = (str) => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);
  
  let intersection = 0;
  for (const [bigram, count] of bigrams1) {
    intersection += Math.min(count, bigrams2.get(bigram) || 0);
  }
  
  return (2 * intersection) / (s1.length + s2.length - 2);
}

// Helper: Score a match between track and result
function scoreMatch(track, result) {
  let score = 0;
  let maxPossible = 0;
  
  // Artist match (40 points)
  if (track.artist && result.artist) {
    const artistSim = stringSimilarity(track.artist, result.artist);
    score += artistSim * 40;
    maxPossible += 40;
    
    // Penalty for artist mismatch - prevents wrong tracks with same title
    if (artistSim < 0.5) score -= 20;
  }
  
  // Title match (40 points)
  if (track.title && result.title) {
    const titleSim = stringSimilarity(track.title, result.title);
    score += titleSim * 40;
    maxPossible += 40;
    
    // Small bonus if no artist to compare
    if (!track.artist && titleSim > 0.7) score += 10;
  }
  
  // Album match (15 points)
  if (track.album && result.album) {
    score += stringSimilarity(track.album, result.album) * 15;
    maxPossible += 15;
  }
  
  // Duration match (5 points)
  if (track.duration && result.duration) {
    const diff = Math.abs(track.duration - result.duration);
    if (diff < 1000) score += 5;
    else if (diff < 3000) score += 3;
    else if (diff < 5000) score += 1;
    maxPossible += 5;
  }
  
  // Normalize if limited data (no artist)
  if (maxPossible > 0 && maxPossible < 60 && !track.artist) {
    score = (score / maxPossible) * 70;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Helper: Parse artist and title from filename
// Supports multiple formats:
// - "14. Artist - Title"
// - "14 - Artist - Title"
// - "Artist - Title"
// - "01 Artist - Title"
function parseArtistTitleFromFilename(basename) {
  let artist = '';
  let title = '';
  
  // Remove common suffixes like (Explicit), [Remix], etc. for cleaner parsing
  const cleanBasename = basename.replace(/\s*[\(\[].*?[\)\]]\s*$/, '').trim();
  
  // Helper to clean up artist/title (remove trailing commas, periods, etc.)
  const cleanValue = (str) => {
    return str.trim().replace(/[,;\.]+$/, '').trim();
  };
  
  // Pattern 1: "14. Artist - Title" (track number with period)
  const dotPattern = /^\d+\.\s*(.+?)\s*-\s*(.+)$/;
  const dotMatch = cleanBasename.match(dotPattern);
  if (dotMatch) {
    artist = cleanValue(dotMatch[1]);
    title = cleanValue(dotMatch[2]);
    return { artist, title };
  }
  
  // Pattern 2: "01 - Artist - Title" (track number with dash separator)
  const dashPattern = /^\d+\s*-\s*(.+?)\s*-\s*(.+)$/;
  const dashMatch = cleanBasename.match(dashPattern);
  if (dashMatch) {
    artist = cleanValue(dashMatch[1]);
    title = cleanValue(dashMatch[2]);
    return { artist, title };
  }
  
  // Pattern 3: "01 Artist - Title" (track number with space)
  const spaceNumPattern = /^\d+\s+(.+?)\s*-\s*(.+)$/;
  const spaceNumMatch = cleanBasename.match(spaceNumPattern);
  if (spaceNumMatch) {
    artist = cleanValue(spaceNumMatch[1]);
    title = cleanValue(spaceNumMatch[2]);
    return { artist, title };
  }
  
  // Pattern 4: "Artist - Title" (simple)
  const simplePattern = /^(.+?)\s*-\s*(.+)$/;
  const simpleMatch = cleanBasename.match(simplePattern);
  if (simpleMatch) {
    // Check if first part looks like a track number
    if (/^\d+$/.test(simpleMatch[1].trim())) {
      // "01 - Title" - no artist
      title = cleanValue(simpleMatch[2]);
    } else {
      artist = cleanValue(simpleMatch[1]);
      title = cleanValue(simpleMatch[2]);
    }
    return { artist, title };
  }
  
  // No pattern matched, use whole basename as title
  return { artist: '', title: cleanBasename };
}

// Provider: MusicBrainz (with Cover Art Archive for album art)
async function searchMusicBrainz(query) {
  try {
    const searchTerms = [];
    if (query.artist) searchTerms.push(`artist:"${query.artist}"`);
    if (query.title) searchTerms.push(`recording:"${query.title}"`);
    if (searchTerms.length === 0) return [];
    
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(searchTerms.join(' AND '))}&fmt=json&limit=5`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Bonk/1.0.0 (https://github.com/bonk)',
        'Accept': 'application/json',
      },
    });
    
    if (!response.data || !response.data.recordings) return [];
    
    return response.data.recordings.map((rec) => {
      const releaseId = rec.releases?.[0]?.id;
      return {
        provider: 'musicbrainz',
        artist: rec['artist-credit']?.[0]?.artist?.name || rec['artist-credit']?.[0]?.name,
        title: rec.title,
        album: rec.releases?.[0]?.title,
        releaseDate: rec.releases?.[0]?.date,
        year: rec.releases?.[0]?.date ? parseInt(rec.releases?.[0]?.date.substring(0, 4)) : undefined,
        isrc: rec.isrcs?.[0],
        duration: rec.length,
        trackId: rec.id,
        releaseId,
        label: rec.releases?.[0]?.['label-info']?.[0]?.label?.name,
        catalogNumber: rec.releases?.[0]?.['label-info']?.[0]?.['catalog-number'],
        // Cover Art Archive URL for album art
        albumArt: releaseId ? {
          sourceUrl: `https://coverartarchive.org/release/${releaseId}/front-500`,
          fallbackUrl: `https://coverartarchive.org/release/${releaseId}/front`,
        } : undefined,
      };
    });
  } catch (error) {
    console.error('MusicBrainz search error:', error.message);
    return [];
  }
}

// Provider: iTunes
async function searchiTunes(query) {
  try {
    const term = [query.artist, query.title].filter(Boolean).join(' ');
    if (!term) return [];
    
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`;
    
    const response = await axios.get(url);
    
    if (!response.data || !response.data.results) return [];
    
    return response.data.results.map((track) => ({
      provider: 'itunes',
      artist: track.artistName,
      title: track.trackName,
      album: track.collectionName,
      albumArtist: track.artistName,
      genre: track.primaryGenreName ? [track.primaryGenreName] : undefined,
      releaseDate: track.releaseDate,
      year: track.releaseDate ? parseInt(track.releaseDate.substring(0, 4)) : undefined,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      trackTotal: track.trackCount,
      duration: track.trackTimeMillis,
      trackId: String(track.trackId),
      releaseId: String(track.collectionId),
      albumArt: track.artworkUrl100 ? {
        sourceUrl: track.artworkUrl100.replace('100x100', '600x600'),
      } : undefined,
      explicit: track.trackExplicitness === 'explicit',
    }));
  } catch (error) {
    console.error('iTunes search error:', error.message);
    return [];
  }
}

// Helper: Process a Spotify track into our common format
async function processSpotifyTrack(track, token) {
  const result = {
    provider: 'spotify',
    artist: track.artists?.[0]?.name,
    title: track.name,
    album: track.album?.name,
    albumArtist: track.album?.artists?.[0]?.name,
    releaseDate: track.album?.release_date,
    year: track.album?.release_date ? parseInt(track.album.release_date.substring(0, 4)) : undefined,
    trackNumber: track.track_number,
    discNumber: track.disc_number,
    trackTotal: track.album?.total_tracks,
    duration: track.duration_ms,
    trackId: track.id,
    releaseId: track.album?.id,
    isrc: track.external_ids?.isrc,
    explicit: track.explicit,
    albumArt: track.album?.images?.[0] ? {
      sourceUrl: track.album.images[0].url,
      width: track.album.images[0].width,
      height: track.album.images[0].height,
    } : undefined,
    url: track.external_urls?.spotify,
  };
  
  // Try to get audio features for BPM and key (may be deprecated)
  try {
    const featuresUrl = `https://api.spotify.com/v1/audio-features/${track.id}`;
    const featuresResponse = await axios.get(featuresUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (featuresResponse.data) {
      result.bpm = Math.round(featuresResponse.data.tempo);
      // Convert Spotify key (0-11) to musical key
      const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const mode = featuresResponse.data.mode === 1 ? '' : 'm';
      if (featuresResponse.data.key >= 0 && featuresResponse.data.key < 12) {
        result.key = keys[featuresResponse.data.key] + mode;
      }
      // Additional audio features for Audio Features mode
      result.audioFeatures = {
        danceability: Math.round(featuresResponse.data.danceability * 100),
        energy: Math.round(featuresResponse.data.energy * 100),
        acousticness: Math.round(featuresResponse.data.acousticness * 100),
        instrumentalness: Math.round(featuresResponse.data.instrumentalness * 100),
        liveness: Math.round(featuresResponse.data.liveness * 100),
        speechiness: Math.round(featuresResponse.data.speechiness * 100),
        valence: Math.round(featuresResponse.data.valence * 100),
      };
    }
  } catch (e) {
    // Audio features API may be deprecated - continue without
  }
  
  return result;
}

// Provider: Spotify (with ISRC-first matching like OneTagger)
async function searchSpotify(query, clientId, clientSecret) {
  try {
    // Get token using existing logic
    const token = await getSpotifyToken(clientId, clientSecret);
    if (!token) return [];
    
    let searchUrl;
    
    // ISRC-first matching (most reliable, like OneTagger)
    if (query.isrc) {
      console.log(`🔍 Spotify: Trying ISRC match first: ${query.isrc}`);
      searchUrl = `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(query.isrc)}&type=track&limit=1`;
      
      try {
        const isrcResponse = await axios.get(searchUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (isrcResponse.data?.tracks?.items?.length > 0) {
          console.log(`✓ Spotify: Found by ISRC!`);
          // Process the ISRC match with high confidence
          const track = isrcResponse.data.tracks.items[0];
          const result = await processSpotifyTrack(track, token);
          result.matchedByIsrc = true;
          return [result];
        }
      } catch (e) {
        console.log(`⚠️ Spotify: ISRC search failed, falling back to text search`);
      }
    }
    
    // Fallback to artist + title search
    const searchQuery = [query.artist, query.title].filter(Boolean).join(' ');
    if (!searchQuery) return [];
    
    searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`;
    
    const searchResponse = await axios.get(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!searchResponse.data?.tracks?.items) return [];
    
    const results = [];
    
    for (const track of searchResponse.data.tracks.items) {
      const result = await processSpotifyTrack(track, token);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Spotify search error:', error.message);
    return [];
  }
}

// ============================================================================
// Provider: Beatport (v4 API - like beets-beatport4 plugin)
// ============================================================================

// Beatport token cache
let beatportTokenCache = null;
let beatportTokenExpiry = 0;

// Fetch Beatport API client ID from their docs page
async function fetchBeatportClientId() {
  try {
    const docsResponse = await axios.get('https://api.beatport.com/v4/docs/');
    const html = docsResponse.data;
    const scriptMatches = html.match(/src="([^"]*\.js)"/g) || [];
    
    for (const scriptTag of scriptMatches) {
      const scriptUrl = scriptTag.match(/src="([^"]*)"/)?.[1];
      if (!scriptUrl) continue;
      
      const fullUrl = scriptUrl.startsWith('http') ? scriptUrl : `https://api.beatport.com${scriptUrl}`;
      try {
        const jsResponse = await axios.get(fullUrl);
        const clientIdMatch = jsResponse.data.match(/API_CLIENT_ID:\s*['"]([^'"]+)['"]/);
        if (clientIdMatch) {
          return clientIdMatch[1];
        }
      } catch (e) {
        // Try next script
      }
    }
    throw new Error('Could not find API_CLIENT_ID');
  } catch (e) {
    console.error('Failed to fetch Beatport client ID:', e.message);
    throw e;
  }
}

// Authenticate with Beatport using username/password (OAuth2 authorization_code flow)
async function getBeatportToken(username, password) {
  // Check cache
  if (beatportTokenCache && Date.now() < beatportTokenExpiry - 30000) {
    return beatportTokenCache;
  }
  
  if (!username || !password) {
    throw new Error('Beatport credentials not provided');
  }
  
  try {
    console.log('🎵 Beatport: Authenticating...');
    
    // Get client ID from docs
    const clientId = await fetchBeatportClientId();
    console.log('✓ Beatport: Got client ID');
    
    const redirectUri = 'https://api.beatport.com/v4/auth/o/post-message/';
    
    // Manual cookie handling since axios-cookiejar-support is ESM only
    let cookies = [];
    
    // Step 1: Login with username/password
    const loginResponse = await axios.post('https://api.beatport.com/v4/auth/login/', {
      username,
      password,
    }, {
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Bonk/1.0.0',
      },
      withCredentials: true,
    });
    
    if (!loginResponse.data?.username) {
      console.error('Beatport login failed:', loginResponse.data);
      throw new Error('Beatport login failed - check credentials');
    }
    
    // Extract cookies from login response
    const setCookies = loginResponse.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    
    console.log(`✓ Beatport: Logged in as ${loginResponse.data.username}`);
    
    // Step 2: Get authorization code
    const authUrl = `https://api.beatport.com/v4/auth/o/authorize/?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    const authResponse = await axios.get(authUrl, { 
      maxRedirects: 0, 
      validateStatus: (s) => s < 400 || s === 302,
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Bonk/1.0.0',
      },
    });
    
    // Extract code from Location header
    const location = authResponse.headers.location;
    if (!location) {
      throw new Error('No redirect location in auth response');
    }
    const codeMatch = location.match(/code=([^&]+)/);
    if (!codeMatch) {
      throw new Error('No authorization code in redirect');
    }
    const authCode = codeMatch[1];
    console.log('✓ Beatport: Got authorization code');
    
    // Update cookies from auth response
    const authCookies = authResponse.headers['set-cookie'] || [];
    if (authCookies.length > 0) {
      cookies = [...cookies.split('; '), ...authCookies.map(c => c.split(';')[0])].join('; ');
    }
    
    // Step 3: Exchange code for token
    const tokenResponse = await axios.post(
      `https://api.beatport.com/v4/auth/o/token/`,
      null,
      {
        params: {
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          client_id: clientId,
        },
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Bonk/1.0.0',
        },
      }
    );
    
    if (!tokenResponse.data?.access_token) {
      throw new Error('Failed to get access token');
    }
    
    console.log('✓ Beatport: Got access token');
    
    // Cache token
    beatportTokenCache = tokenResponse.data.access_token;
    beatportTokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
    
    return beatportTokenCache;
  } catch (e) {
    console.error('Beatport auth error:', e.message);
    throw e;
  }
}

// Normalize Beatport key format (e.g., "Eb Major" → "Ebmaj")
function normalizeBeatportKey(keyStr) {
  if (!keyStr) return null;
  const parts = keyStr.split(' ');
  if (parts.length !== 2) return keyStr;
  const [note, mode] = parts;
  if (mode.toLowerCase() === 'major') {
    return note;
  } else if (mode.toLowerCase() === 'minor') {
    return note + 'm';
  }
  return keyStr;
}

// ============================================================================
// Key Format Conversion (Standard ↔ Camelot/Open Key)
// ============================================================================

// Camelot Wheel mapping
const CAMELOT_MAP = {
  // Major keys → Camelot
  'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B', 'B': '1B',
  'F#': '2B', 'Gb': '2B', 'C#': '3B', 'Db': '3B', 'G#': '4B', 'Ab': '4B',
  'D#': '5B', 'Eb': '5B', 'A#': '6B', 'Bb': '6B', 'F': '7B',
  // Minor keys → Camelot
  'Am': '8A', 'Em': '9A', 'Bm': '10A', 'F#m': '11A', 'Gbm': '11A',
  'C#m': '12A', 'Dbm': '12A', 'G#m': '1A', 'Abm': '1A', 'D#m': '2A',
  'Ebm': '2A', 'A#m': '3A', 'Bbm': '3A', 'Fm': '4A', 'Cm': '5A',
  'Gm': '6A', 'Dm': '7A',
};

// Reverse mapping: Camelot → Standard
const CAMELOT_REVERSE = {
  '1A': 'Abm', '1B': 'B',
  '2A': 'Ebm', '2B': 'Gb',
  '3A': 'Bbm', '3B': 'Db',
  '4A': 'Fm', '4B': 'Ab',
  '5A': 'Cm', '5B': 'Eb',
  '6A': 'Gm', '6B': 'Bb',
  '7A': 'Dm', '7B': 'F',
  '8A': 'Am', '8B': 'C',
  '9A': 'Em', '9B': 'G',
  '10A': 'Bm', '10B': 'D',
  '11A': 'F#m', '11B': 'A',
  '12A': 'C#m', '12B': 'E',
};

// Open Key notation (similar to Camelot but with 'd' for minor, 'm' for major)
const OPENKEY_MAP = {
  // Major keys → Open Key
  'C': '1m', 'G': '2m', 'D': '3m', 'A': '4m', 'E': '5m', 'B': '6m',
  'F#': '7m', 'Gb': '7m', 'C#': '8m', 'Db': '8m', 'G#': '9m', 'Ab': '9m',
  'D#': '10m', 'Eb': '10m', 'A#': '11m', 'Bb': '11m', 'F': '12m',
  // Minor keys → Open Key
  'Am': '1d', 'Em': '2d', 'Bm': '3d', 'F#m': '4d', 'Gbm': '4d',
  'C#m': '5d', 'Dbm': '5d', 'G#m': '6d', 'Abm': '6d', 'D#m': '7d',
  'Ebm': '7d', 'A#m': '8d', 'Bbm': '8d', 'Fm': '9d', 'Cm': '10d',
  'Gm': '11d', 'Dm': '12d',
};

// Normalize key to standard format (e.g., "Ebmin" → "Ebm", "C major" → "C")
function normalizeKeyToStandard(key) {
  if (!key) return null;
  
  let normalized = key.trim();
  
  // Handle various minor notations
  normalized = normalized.replace(/\s*(minor|min)$/i, 'm');
  // Handle various major notations
  normalized = normalized.replace(/\s*(major|maj)$/i, '');
  // Handle lowercase 'm' at end (ensure it's lowercase)
  normalized = normalized.replace(/M$/, 'm');
  
  // Handle Camelot notation (e.g., "8A", "11B")
  if (/^\d{1,2}[AB]$/i.test(normalized)) {
    const camelotKey = normalized.toUpperCase();
    return CAMELOT_REVERSE[camelotKey] || normalized;
  }
  
  // Handle Open Key notation (e.g., "1d", "5m")
  if (/^\d{1,2}[dm]$/i.test(normalized)) {
    // Convert Open Key to Camelot first, then to standard
    const num = parseInt(normalized);
    const isMinor = normalized.toLowerCase().endsWith('d');
    // Open Key 1d = Am = 8A, Open Key 1m = C = 8B
    // The mapping is offset by 7 from Camelot
    const camelotNum = ((num + 6) % 12) + 1;
    const camelotKey = `${camelotNum}${isMinor ? 'A' : 'B'}`;
    return CAMELOT_REVERSE[camelotKey] || normalized;
  }
  
  return normalized;
}

// Convert key to specified format
// format: 'standard', 'camelot', 'openkey'
function convertKeyFormat(key, format = 'standard') {
  if (!key) return null;
  
  // First normalize to standard format
  const standardKey = normalizeKeyToStandard(key);
  if (!standardKey) return null;
  
  switch (format.toLowerCase()) {
    case 'camelot':
      return CAMELOT_MAP[standardKey] || standardKey;
    case 'openkey':
      return OPENKEY_MAP[standardKey] || standardKey;
    case 'standard':
    default:
      return standardKey;
  }
}

// Search Beatport for tracks
async function searchBeatport(query, username, password) {
  try {
    const token = await getBeatportToken(username, password);
    
    const searchQuery = [query.artist, query.title].filter(Boolean).join(' ');
    if (!searchQuery) return [];
    
    console.log(`🔍 Beatport: Searching for "${searchQuery}"...`);
    
    const url = `https://api.beatport.com/v4/catalog/search?q=${encodeURIComponent(searchQuery)}&type=tracks&per_page=5`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Bonk/1.0.0',
      },
    });
    
    if (!response.data?.tracks) return [];
    
    const results = [];
    
    for (const track of response.data.tracks) {
      // Get full track details for more info
      let fullTrack = track;
      try {
        const detailResponse = await axios.get(`https://api.beatport.com/v4/catalog/tracks/${track.id}/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Bonk/1.0.0',
          },
        });
        fullTrack = detailResponse.data || track;
      } catch (e) {
        // Use basic track data
      }
      
      const artists = (fullTrack.artists || []).map((a) => a.name).join(', ');
      const title = fullTrack.mix_name && fullTrack.mix_name !== 'Original Mix'
        ? `${fullTrack.name} (${fullTrack.mix_name})`
        : fullTrack.name;
      
      results.push({
        provider: 'beatport',
        artist: artists,
        title: title,
        album: fullTrack.release?.name,
        label: fullTrack.release?.label?.name,
        catalogNumber: fullTrack.release?.catalog_number,
        genre: fullTrack.sub_genre?.name || fullTrack.genre?.name,
        bpm: fullTrack.bpm ? Math.round(fullTrack.bpm) : undefined,
        key: fullTrack.key?.name ? normalizeBeatportKey(fullTrack.key.name) : undefined,
        year: fullTrack.release?.publish_date ? parseInt(fullTrack.release.publish_date.substring(0, 4)) : undefined,
        releaseDate: fullTrack.release?.publish_date,
        trackNumber: fullTrack.number,
        duration: fullTrack.length_ms,
        trackId: String(fullTrack.id),
        releaseId: fullTrack.release?.id ? String(fullTrack.release.id) : undefined,
        url: fullTrack.slug ? `https://beatport.com/track/${fullTrack.slug}/${fullTrack.id}` : undefined,
        albumArt: fullTrack.release?.image?.uri ? {
          sourceUrl: fullTrack.release.image.uri,
        } : undefined,
        remixers: (fullTrack.remixers || []).map((r) => r.name),
      });
    }
    
    console.log(`✓ Beatport: Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Beatport search error:', error.message);
    return [];
  }
}

// Provider: Discogs
async function searchDiscogs(query, token) {
  try {
    if (!token) {
      console.log('⚠️ Discogs: No token provided');
      return [];
    }
    
    const searchQuery = [query.artist, query.title].filter(Boolean).join(' ');
    if (!searchQuery) return [];
    
    console.log(`🔍 Discogs: Searching for "${searchQuery}"...`);
    
    // Search for releases (Discogs doesn't have a track-level search)
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(searchQuery)}&per_page=5`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Bonk/1.0.0 +https://github.com/bonk',
        'Authorization': `Discogs token=${token}`,
      },
    });
    
    if (!response.data?.results || response.data.results.length === 0) {
      console.log('⚠️ Discogs: No results found');
      return [];
    }
    
    console.log(`✓ Discogs: Found ${response.data.results.length} results`);
    
    const results = [];
    
    for (const release of response.data.results) {
      // Discogs title format is usually "Artist - Release Title"
      const titleParts = (release.title || '').split(' - ');
      const artistName = titleParts[0]?.trim() || query.artist;
      const albumName = titleParts.slice(1).join(' - ')?.trim() || release.title;
      
      // For track title, use the query title since Discogs returns releases not tracks
      const trackTitle = query.title;
      
      // Get genres - Discogs uses both genre and style
      const genres = [...(release.genre || []), ...(release.style || [])];
      
      results.push({
        provider: 'discogs',
        artist: artistName,
        title: trackTitle, // Keep original track title
        album: albumName,
        genre: genres.length > 0 ? genres[0] : undefined, // Primary genre
        style: release.style,
        label: release.label?.[0],
        year: release.year ? parseInt(release.year) : undefined,
        catalogNumber: release.catno,
        releaseId: String(release.id),
        url: `https://discogs.com/release/${release.id}`,
        albumArt: release.cover_image ? {
          sourceUrl: release.cover_image,
        } : undefined,
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Discogs search error:', error.response?.status, error.message);
    if (error.response?.status === 401) {
      console.error('   Token may be invalid - check your Discogs personal access token');
    }
    return [];
  }
}

// Start autotag run
ipcMain.handle('autotag:start', async (event, config) => {
  const { runId, files, providers, tags, advanced, credentials, preferences } = config;
  
  // Extract credentials (passed from renderer's settings store)
  const spotifyClientId = credentials?.spotifyClientId || process.env.SPOTIFY_CLIENT_ID || '';
  const spotifyClientSecret = credentials?.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET || '';
  const discogsToken = credentials?.discogsToken || process.env.DISCOGS_TOKEN || '';
  
  // Extract preferences
  const keyFormat = preferences?.keyFormat || 'camelot'; // Default to Camelot for DJs
  const beatportUsername = credentials?.beatportUsername || process.env.BEATPORT_USERNAME || '';
  const beatportPassword = credentials?.beatportPassword || process.env.BEATPORT_PASSWORD || '';
  
  // Store run state
  const runState = {
    id: runId,
    isPaused: false,
    isCancelled: false,
    currentIndex: 0,
  };
  autotagRuns.set(runId, runState);
  
  // Emit start event
  sendAutotagEvent(event, {
    runId,
    type: 'started',
    timestamp: Date.now(),
    total: files.length,
  });
  
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    runState.currentIndex = i;
    
    // Check for pause/cancel
    while (runState.isPaused && !runState.isCancelled) {
      await new Promise((r) => setTimeout(r, 100));
    }
    
    if (runState.isCancelled) {
      sendAutotagEvent(event, {
        runId,
        type: 'cancelled',
        timestamp: Date.now(),
      });
      autotagRuns.delete(runId);
      return { success: true, cancelled: true, results };
    }
    
    // Helper: treat placeholder/garbage artist strings as "empty"
    const isPlaceholderArtist = (value) =>
      typeof value === 'string' && value.trim().toLowerCase() === 'unknown artist';

    // Read current metadata
    let currentMetadata = {};
    let trackName = path.basename(filePath);
    let trackArtist = '';
    let metadataReadSuccess = false;
    
    try {
      const mm = await import('music-metadata');
      const metadata = await mm.parseFile(filePath);
      currentMetadata = {
        artist: metadata.common.artist,
        title: metadata.common.title,
        album: metadata.common.album,
        genre: metadata.common.genre,
        year: metadata.common.year,
        bpm: metadata.common.bpm,
        key: metadata.common.key,
        trackNumber: metadata.common.track?.no,
        discNumber: metadata.common.disk?.no,
        duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : undefined,
        isrc: metadata.common.isrc?.[0], // ISRC for better matching
        label: metadata.common.label?.[0],
      };
      trackName = metadata.common.title || trackName;
      trackArtist = metadata.common.artist || '';
      metadataReadSuccess = true;
    } catch (e) {
      console.log(`⚠️ AutoTag: music-metadata failed for ${path.basename(filePath)}, trying FFprobe...`);
    }
    
    // FFprobe fallback if music-metadata failed
    if (!metadataReadSuccess) {
      try {
        const { spawn } = require('child_process');
        const ffprobeOutput = await new Promise((resolve, reject) => {
          const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            filePath
          ]);
          
          let output = '';
          ffprobe.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          ffprobe.on('close', (code) => {
            if (code === 0 && output) {
              try {
                resolve(JSON.parse(output));
              } catch {
                reject(new Error('Invalid JSON from ffprobe'));
              }
            } else {
              reject(new Error('ffprobe failed'));
            }
          });
          
          ffprobe.on('error', reject);
        });
        
        const tags = ffprobeOutput.format?.tags || {};
        // Normalize tag names (some are uppercase, some lowercase)
        const getTag = (key) => tags[key] || tags[key.toUpperCase()] || tags[key.toLowerCase()] || '';
        
        currentMetadata = {
          artist: getTag('artist') || getTag('ARTIST'),
          title: getTag('title') || getTag('TITLE'),
          album: getTag('album') || getTag('ALBUM'),
          genre: getTag('genre') || getTag('GENRE'),
          year: parseInt(getTag('date') || getTag('DATE') || getTag('year') || '0') || undefined,
          bpm: parseFloat(getTag('bpm') || getTag('BPM') || '0') || undefined,
          key: getTag('initialkey') || getTag('INITIALKEY') || getTag('key') || getTag('KEY'),
          duration: ffprobeOutput.format?.duration ? Math.round(ffprobeOutput.format.duration * 1000) : undefined,
          isrc: getTag('isrc') || getTag('ISRC') || getTag('TSRC'), // ISRC for better matching
          label: getTag('publisher') || getTag('PUBLISHER') || getTag('label') || getTag('LABEL'),
        };
        
        trackName = currentMetadata.title || trackName;
        trackArtist = currentMetadata.artist || '';
        console.log(`✓ AutoTag: FFprobe extracted: "${trackArtist}" - "${trackName}"`);
      } catch (ffprobeError) {
        console.error(`❌ AutoTag: FFprobe also failed for ${path.basename(filePath)}:`, ffprobeError.message);
      }
    }
    
    // Normalize placeholder artist values so they don't block real matches/overwrites
    if (isPlaceholderArtist(currentMetadata.artist)) {
      console.log('🔧 AutoTag: Treating placeholder artist "Unknown Artist" as empty');
      currentMetadata.artist = '';
    }
    if (isPlaceholderArtist(trackArtist)) {
      trackArtist = '';
    }
    
    // If artist is still empty, try to parse from filename as fallback
    if (!trackArtist || !currentMetadata.artist) {
      const basename = path.basename(filePath, path.extname(filePath));
      const parsed = parseArtistTitleFromFilename(basename);
      if (parsed.artist) {
        trackArtist = parsed.artist;
        currentMetadata.artist = parsed.artist;
        console.log(`🔧 AutoTag: Artist from filename: "${trackArtist}"`);
      }
      if (parsed.title && !trackName) {
        trackName = parsed.title;
        currentMetadata.title = parsed.title;
      }
    }
    
    // Emit track start
    sendAutotagEvent(event, {
      runId,
      type: 'track_start',
      timestamp: Date.now(),
      current: i + 1,
      total: files.length,
      track: { path: filePath, name: trackName, artist: trackArtist },
    });
    
    // Check skip rules
    if (advanced.skipAlreadyTagged && currentMetadata.artist && currentMetadata.title) {
      sendAutotagEvent(event, {
        runId,
        type: 'track_skipped',
        timestamp: Date.now(),
        track: { path: filePath, name: trackName, artist: trackArtist },
        message: 'Already tagged',
      });
      results.push({
        runId,
        trackPath: filePath,
        status: 'skipped',
        before: currentMetadata,
        after: currentMetadata,
        updatedTags: [],
        duration: 0,
      });
      continue;
    }
    
    // Build search query (including ISRC for better matching like OneTagger)
    const query = {
      artist: currentMetadata.artist || '',
      title: currentMetadata.title || path.basename(filePath, path.extname(filePath)),
      album: currentMetadata.album || '',
      duration: currentMetadata.duration,
      isrc: currentMetadata.isrc || '', // ISRC for Spotify ISRC-first matching
    };
    
    console.log(`🔍 AutoTag: Searching for: "${query.artist}" - "${query.title}"`);
    
    if (query.isrc) {
      console.log(`📋 AutoTag: Track has ISRC: ${query.isrc}`);
    }
    
    // Search providers in priority order
    let bestMatch = null;
    let bestScore = 0;
    let matchedProvider = null;
    
    for (const providerId of providers) {
      sendAutotagEvent(event, {
        runId,
        type: 'track_searching',
        timestamp: Date.now(),
        track: { path: filePath, name: trackName, artist: trackArtist },
        provider: providerId,
      });
      
      let searchResults = [];
      
      try {
        // Add rate limiting delay
        await new Promise((r) => setTimeout(r, 1000));
        
        console.log(`🔍 AutoTag: Searching ${providerId} for: "${query.artist}" - "${query.title}"`);
        
        switch (providerId) {
          case 'musicbrainz':
            searchResults = await searchMusicBrainz(query);
            break;
          case 'itunes':
            searchResults = await searchiTunes(query);
            break;
          case 'spotify':
            // Use credentials passed from config
            if (spotifyClientId && spotifyClientSecret) {
              searchResults = await searchSpotify(query, spotifyClientId, spotifyClientSecret);
            } else {
              console.log('⚠️ AutoTag: Spotify skipped - no credentials');
            }
            break;
          case 'discogs':
            // Use credentials passed from config
            if (discogsToken) {
              searchResults = await searchDiscogs(query, discogsToken);
            } else {
              console.log('⚠️ AutoTag: Discogs skipped - no token');
            }
            break;
          case 'beatport':
            // Use credentials passed from config
            if (beatportUsername && beatportPassword) {
              searchResults = await searchBeatport(query, beatportUsername, beatportPassword);
            } else {
              console.log('⚠️ AutoTag: Beatport skipped - no credentials');
            }
            break;
        }
        
        console.log(`   ${providerId}: ${searchResults.length} results found`);
      } catch (e) {
        console.error(`Provider ${providerId} error:`, e.message);
      }
      
      // Score results
      for (const result of searchResults) {
        const score = scoreMatch(query, result);
        console.log(`   Score for "${result.artist}" - "${result.title}": ${score} (min: ${advanced.minimumConfidence})`);
        if (score > bestScore && score >= advanced.minimumConfidence) {
          bestScore = score;
          bestMatch = result;
          matchedProvider = providerId;
        }
      }
      
      // If we have an excellent match (95%+), stop searching
      // Otherwise continue to other providers for potentially better results
      if (bestScore >= 95) break;
    }
    
    // Process result
    if (bestMatch && bestScore >= advanced.minimumConfidence) {
      console.log(`✓ AutoTag: Best match from ${matchedProvider} (${bestScore}%):`);
      console.log(`   Artist: "${bestMatch.artist}" | Title: "${bestMatch.title}"`);
      console.log(`   Album: "${bestMatch.album}" | Year: ${bestMatch.year}`);
      
      sendAutotagEvent(event, {
        runId,
        type: 'track_matched',
        timestamp: Date.now(),
        track: { path: filePath, name: trackName, artist: trackArtist },
        provider: matchedProvider,
        confidence: bestScore,
      });
      
      // Build updated metadata based on selected tags and overwrite mode
      const updatedMetadata = { ...currentMetadata };
      const updatedTags = [];
      
      const shouldUpdate = (tag, currentValue, newValue) => {
        if (!tags.includes(tag)) return false;
        if (newValue === undefined || newValue === null || newValue === '') return false;
        
        switch (advanced.overwriteMode) {
          case 'never':
            return !currentValue;
          case 'always':
            return true;
          case 'ifEmpty':
          default:
            return !currentValue || currentValue === '';
        }
      };
      
      // Artist: Only update if we don't have one already (from file OR filename)
      if (shouldUpdate('artist', currentMetadata.artist, bestMatch.artist)) {
        updatedMetadata.artist = bestMatch.artist;
        updatedTags.push('artist');
      }
      // Title: Only update if we don't have one already
      if (shouldUpdate('title', currentMetadata.title, bestMatch.title)) {
        updatedMetadata.title = bestMatch.title;
        updatedTags.push('title');
      }
      if (shouldUpdate('album', currentMetadata.album, bestMatch.album)) {
        // Write album - self-titled albums (album = artist) are valid
        updatedMetadata.album = bestMatch.album;
        updatedTags.push('album');
      }
      if (shouldUpdate('genre', currentMetadata.genre, bestMatch.genre)) {
        updatedMetadata.genre = Array.isArray(bestMatch.genre) ? bestMatch.genre : [bestMatch.genre];
        updatedTags.push('genre');
      }
      if (shouldUpdate('year', currentMetadata.year, bestMatch.year)) {
        updatedMetadata.year = bestMatch.year;
        updatedTags.push('year');
      }
      if (shouldUpdate('bpm', currentMetadata.bpm, bestMatch.bpm)) {
        updatedMetadata.bpm = bestMatch.bpm;
        updatedTags.push('bpm');
      }
      if (shouldUpdate('key', currentMetadata.key, bestMatch.key)) {
        updatedMetadata.key = bestMatch.key;
        updatedTags.push('key');
      }
      if (shouldUpdate('trackNumber', currentMetadata.trackNumber, bestMatch.trackNumber)) {
        updatedMetadata.trackNumber = bestMatch.trackNumber;
        updatedTags.push('trackNumber');
      }
      if (shouldUpdate('discNumber', currentMetadata.discNumber, bestMatch.discNumber)) {
        updatedMetadata.discNumber = bestMatch.discNumber;
        updatedTags.push('discNumber');
      }
      if (shouldUpdate('label', currentMetadata.label, bestMatch.label)) {
        updatedMetadata.label = bestMatch.label;
        updatedTags.push('label');
      }
      if (shouldUpdate('isrc', currentMetadata.isrc, bestMatch.isrc)) {
        updatedMetadata.isrc = bestMatch.isrc;
        updatedTags.push('isrc');
      }
      if (shouldUpdate('catalogNumber', currentMetadata.catalogNumber, bestMatch.catalogNumber)) {
        updatedMetadata.catalogNumber = bestMatch.catalogNumber;
        updatedTags.push('catalogNumber');
      }
      if (shouldUpdate('releaseDate', currentMetadata.releaseDate, bestMatch.releaseDate)) {
        updatedMetadata.releaseDate = bestMatch.releaseDate;
        updatedTags.push('releaseDate');
      }
      // URL
      if (tags.includes('url') && bestMatch.url) {
        updatedMetadata.url = bestMatch.url;
        updatedTags.push('url');
      }
      // Provider track/release IDs
      if (tags.includes('trackId') && bestMatch.trackId) {
        updatedMetadata.trackId = bestMatch.trackId;
        updatedTags.push('trackId');
      }
      if (tags.includes('releaseId') && bestMatch.releaseId) {
        updatedMetadata.releaseId = bestMatch.releaseId;
        updatedTags.push('releaseId');
      }
      
      // Write tags to file if enabled - using node-taglib-sharp for proper field-by-field updates
      // This preserves ALL existing metadata and album art, only updating specified fields
      if (advanced.writeTagsToFile && updatedTags.length > 0) {
        sendAutotagEvent(event, {
          runId,
          type: 'track_writing',
          timestamp: Date.now(),
          track: { path: filePath, name: trackName, artist: trackArtist },
        });
        
        try {
          // Use node-taglib-sharp for proper tagging (like OneTagger uses lofty in Rust)
          const { File: TagFile, Id3v2Settings } = require('node-taglib-sharp');
          
          // Disable numeric genre conversion (don't convert "Electronic" to "52")
          Id3v2Settings.useNumericGenres = false;
          
          console.log(`📝 AutoTag: Writing to ${path.basename(filePath)} using TagLib:`, updatedTags);
          
          // Open file - this reads ALL existing metadata including album art
          const tagFile = TagFile.createFromPath(filePath);
          
          // Derive a final artist value to write, even if it only came from filename
          const filenameBaseForWrite = path.basename(filePath, path.extname(filePath));
          const parsedFromFilenameForWrite = parseArtistTitleFromFilename(filenameBaseForWrite);
          const finalArtist =
            (updatedMetadata.artist && String(updatedMetadata.artist).trim()) ||
            (currentMetadata.artist && String(currentMetadata.artist).trim()) ||
            (parsedFromFilenameForWrite.artist && String(parsedFromFilenameForWrite.artist).trim()) ||
            (trackArtist && String(trackArtist).trim()) ||
            '';
          
          // Update ONLY the specified fields - existing metadata is preserved.
          // For artist, as long as the user enabled the 'artist' tag in AutoTag,
          // make sure we actually write whatever artist we ended up with.
          if ((updatedTags.includes('artist') || tags.includes('artist')) && finalArtist) {
            tagFile.tag.performers = [finalArtist];
          }
          if (updatedTags.includes('title') && updatedMetadata.title) {
            tagFile.tag.title = updatedMetadata.title;
          }
          if (updatedTags.includes('album') && updatedMetadata.album) {
            tagFile.tag.album = updatedMetadata.album;
          }
          if (updatedTags.includes('albumArtist') && updatedMetadata.albumArtist) {
            tagFile.tag.albumArtists = [updatedMetadata.albumArtist];
          }
          if (updatedTags.includes('genre') && updatedMetadata.genre) {
            const genres = Array.isArray(updatedMetadata.genre) ? updatedMetadata.genre : [updatedMetadata.genre];
            // Ensure genres are strings, not numbers
            const genreStrings = genres.map(g => String(g));
            console.log(`   Genre values: ${JSON.stringify(genreStrings)}`);
            tagFile.tag.genres = genreStrings;
          }
          if (updatedTags.includes('year') && updatedMetadata.year) {
            tagFile.tag.year = parseInt(updatedMetadata.year) || 0;
          }
          if (updatedTags.includes('bpm') && updatedMetadata.bpm) {
            tagFile.tag.beatsPerMinute = parseInt(updatedMetadata.bpm) || 0;
          }
          if (updatedTags.includes('trackNumber') && updatedMetadata.trackNumber) {
            tagFile.tag.track = parseInt(updatedMetadata.trackNumber) || 0;
          }
          if (updatedTags.includes('discNumber') && updatedMetadata.discNumber) {
            tagFile.tag.disc = parseInt(updatedMetadata.discNumber) || 0;
          }
          if (updatedTags.includes('label') && updatedMetadata.label) {
            tagFile.tag.publisher = updatedMetadata.label;
          }
          
          // Track/Disc totals
          if (updatedTags.includes('trackTotal') && updatedMetadata.trackTotal) {
            tagFile.tag.trackCount = parseInt(updatedMetadata.trackTotal) || 0;
          }
          if (updatedMetadata.discTotal) {
            tagFile.tag.discCount = parseInt(updatedMetadata.discTotal) || 0;
          }
          
          // Key (INITIALKEY/TKEY) - convert to preferred format
          if (updatedTags.includes('key') && updatedMetadata.key) {
            const formattedKey = convertKeyFormat(updatedMetadata.key, keyFormat);
            tagFile.tag.initialKey = formattedKey;
            console.log(`   Key: ${updatedMetadata.key} → ${formattedKey} (${keyFormat})`);
          }
          
          // Copyright
          if (updatedMetadata.copyright) {
            tagFile.tag.copyright = updatedMetadata.copyright;
          }
          
          // For custom frames (ISRC, provider IDs, URLs), we need to access the underlying ID3 tag
          // Check if this is an ID3-based format (MP3, AIFF, WAV)
          try {
            const { Id3v2UserTextInformationFrame, Id3v2Tag, StringType } = require('node-taglib-sharp');
            
            // Helper to add TXXX frame
            const addTxxxFrame = (id3Tag, description, value) => {
              if (!value) return;
              try {
                // Remove existing frame with same description
                const existing = Id3v2UserTextInformationFrame.findUserTextInformationFrame(id3Tag.frames, description, StringType.UTF8);
                if (existing) {
                  id3Tag.removeFrame(existing);
                }
                // Add new frame
                const frame = Id3v2UserTextInformationFrame.fromDescription(description, StringType.UTF8);
                frame.text = [String(value)];
                id3Tag.frames.push(frame);
              } catch (e) {
                // Frame operation failed, skip
              }
            };
            
            // Get ID3 tag if available - try multiple approaches
            let id3Tag = null;
            if (tagFile.tag instanceof Id3v2Tag) {
              id3Tag = tagFile.tag;
            } else if (tagFile.tag.tags) {
              id3Tag = tagFile.tag.tags.find(t => t instanceof Id3v2Tag);
            } else if (tagFile.getTag) {
              // Try to get ID3v2 tag directly
              try {
                id3Tag = tagFile.getTag(1, true); // TagTypes.Id3v2 = 1
              } catch (e) {}
            }
            
            if (id3Tag && id3Tag.frames) {
              // ISRC
              if (updatedTags.includes('isrc') && updatedMetadata.isrc) {
                addTxxxFrame(id3Tag, 'ISRC', updatedMetadata.isrc);
              }
              
              // Provider IDs (like OneTagger: ITUNES_TRACK_ID, SPOTIFY_TRACK_ID)
              if (updatedTags.includes('trackId') && bestMatch.trackId && matchedProvider) {
                addTxxxFrame(id3Tag, `${matchedProvider.toUpperCase()}_TRACK_ID`, bestMatch.trackId);
              }
              if (updatedTags.includes('releaseId') && bestMatch.releaseId && matchedProvider) {
                addTxxxFrame(id3Tag, `${matchedProvider.toUpperCase()}_RELEASE_ID`, bestMatch.releaseId);
              }
              
              // URL
              if (updatedTags.includes('url') && bestMatch.url) {
                addTxxxFrame(id3Tag, 'WWWAUDIOFILE', bestMatch.url);
              }
              
              // Tagged date marker (like OneTagger's 1T_TAGGEDDATE)
              const taggedDate = new Date().toISOString().split('T')[0] + '_AT';
              addTxxxFrame(id3Tag, '1T_TAGGEDDATE', taggedDate);
            }
          } catch (customTagError) {
            console.log(`⚠️ AutoTag: Could not write custom tags: ${customTagError.message}`);
          }
          
          // Save changes - only modified fields are written, everything else is preserved
          tagFile.save();
          tagFile.dispose();
          
          console.log(`✓ AutoTag: Tags written successfully to ${path.basename(filePath)} (metadata preserved)`);
        } catch (e) {
          console.error(`❌ AutoTag: Failed to write tags to ${path.basename(filePath)}:`, e.message);
          // Don't fail the whole track, just log the error
        }
      }
      
      // Download and embed album art if enabled
      if (tags.includes('albumArt') && bestMatch.albumArt?.sourceUrl) {
        try {
          const artUrl = bestMatch.albumArt.sourceUrl;
          console.log(`🎨 AutoTag: Downloading album art from ${artUrl}...`);
          
          let artResponse;
          try {
            artResponse = await axios.get(artUrl, { responseType: 'arraybuffer', timeout: 10000 });
          } catch (e) {
            // Try fallback URL if available
            if (bestMatch.albumArt.fallbackUrl) {
              console.log(`🔄 AutoTag: Trying fallback URL...`);
              artResponse = await axios.get(bestMatch.albumArt.fallbackUrl, { responseType: 'arraybuffer', timeout: 10000 });
            } else {
              throw e;
            }
          }
          
          if (artResponse?.data) {
            // Embed album art into the file using node-taglib-sharp
            const { File: TagFile, Picture, PictureType, ByteVector } = require('node-taglib-sharp');
            const tagFile = TagFile.createFromPath(filePath);
            
            // Create picture from buffer - need to use ByteVector
            const artBuffer = Buffer.from(artResponse.data);
            const byteVector = ByteVector.fromByteArray(artBuffer);
            
            // Determine mime type from URL or default to jpeg
            let mimeType = 'image/jpeg';
            if (artUrl.includes('.png')) mimeType = 'image/png';
            else if (artUrl.includes('.gif')) mimeType = 'image/gif';
            else if (artUrl.includes('.webp')) mimeType = 'image/webp';
            
            // Create picture with proper constructor
            const picture = Picture.fromFullData(byteVector, PictureType.FrontCover, mimeType, 'Cover');
            
            // Set as the album art (replaces existing)
            tagFile.tag.pictures = [picture];
            tagFile.save();
            tagFile.dispose();
            
            updatedTags.push('albumArt');
            console.log(`✓ AutoTag: Album art embedded successfully`);
            
            // Also save to file if requested
            if (advanced.saveAlbumArtToFile) {
              const artPath = path.join(path.dirname(filePath), advanced.albumArtFilename || 'cover.jpg');
              await fs.writeFile(artPath, artResponse.data);
              console.log(`✓ AutoTag: Album art also saved to ${path.basename(artPath)}`);
            }
          }
        } catch (e) {
          console.error('Failed to embed album art:', e.message);
        }
      }
      
      sendAutotagEvent(event, {
        runId,
        type: 'track_complete',
        timestamp: Date.now(),
        current: i + 1,
        total: files.length,
        track: { path: filePath, name: trackName, artist: trackArtist },
        provider: matchedProvider,
        confidence: bestScore,
      });
      
      results.push({
        runId,
        trackPath: filePath,
        status: updatedTags.length > 0 ? 'success' : 'partial',
        matchedProvider,
        confidence: bestScore,
        before: currentMetadata,
        after: updatedMetadata,
        updatedTags,
        duration: Date.now(),
      });
    } else {
      // No match found
      sendAutotagEvent(event, {
        runId,
        type: 'track_failed',
        timestamp: Date.now(),
        track: { path: filePath, name: trackName, artist: trackArtist },
        error: 'No match found',
      });
      
      results.push({
        runId,
        trackPath: filePath,
        status: 'failed',
        before: currentMetadata,
        after: currentMetadata,
        updatedTags: [],
        error: 'No match found',
        duration: 0,
      });
    }
    
    // Emit progress
    sendAutotagEvent(event, {
      runId,
      type: 'progress',
      timestamp: Date.now(),
      current: i + 1,
      total: files.length,
    });
  }
  
  // Emit completion
  sendAutotagEvent(event, {
    runId,
    type: 'completed',
    timestamp: Date.now(),
    current: files.length,
    total: files.length,
  });
  
  // Send results
  mainWindow?.webContents.send('autotag:result', { runId, results });
  
  autotagRuns.delete(runId);
  
  return { success: true, results };
});

// Pause autotag run
ipcMain.handle('autotag:pause', async (event, runId) => {
  const runState = autotagRuns.get(runId);
  if (runState) {
    runState.isPaused = true;
    sendAutotagEvent(event, {
      runId,
      type: 'paused',
      timestamp: Date.now(),
    });
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Resume autotag run
ipcMain.handle('autotag:resume', async (event, runId) => {
  const runState = autotagRuns.get(runId);
  if (runState) {
    runState.isPaused = false;
    sendAutotagEvent(event, {
      runId,
      type: 'resumed',
      timestamp: Date.now(),
    });
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Cancel autotag run
ipcMain.handle('autotag:cancel', async (event, runId) => {
  const runState = autotagRuns.get(runId);
  if (runState) {
    runState.isCancelled = true;
    runState.isPaused = false; // Unpause so it can exit
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Check provider auth status
ipcMain.handle('autotag:check-auth', async (event, providerId, credentials) => {
  switch (providerId) {
    case 'spotify':
      const spotifyId = credentials?.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
      const spotifySecret = credentials?.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET;
      return {
        authenticated: !!(spotifyId && spotifySecret),
        requiresAuth: true,
      };
    case 'discogs':
      const discogsToken = credentials?.discogsToken || process.env.DISCOGS_TOKEN;
      console.log('Discogs auth check - token exists:', !!discogsToken, 'length:', discogsToken?.length);
      return {
        authenticated: !!discogsToken,
        requiresAuth: true,
      };
    case 'beatport':
      const beatportUser = credentials?.beatportUsername || process.env.BEATPORT_USERNAME;
      const beatportPass = credentials?.beatportPassword || process.env.BEATPORT_PASSWORD;
      return {
        authenticated: !!(beatportUser && beatportPass),
        requiresAuth: true,
      };
    case 'musicbrainz':
    case 'itunes':
      return {
        authenticated: true,
        requiresAuth: false,
      };
    default:
      return {
        authenticated: false,
        requiresAuth: false,
      };
  }
});

// ============================================================================
// AUDIO FEATURES (Local Audio Analysis - like OneTagger)
// ============================================================================

// Store for audio features runs
const audioFeaturesRuns = new Map();

// Helper: Detect key using keyfinder-cli
async function detectKey(filePath) {
  const keyfinderPath = path.join(__dirname, 'bin', 'keyfinder-cli');
  
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const keyfinder = spawn(keyfinderPath, ['-n', 'camelot', filePath]);
    
    let output = '';
    let error = '';
    
    keyfinder.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    keyfinder.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    keyfinder.on('close', (code) => {
      if (code === 0 && output.trim()) {
        // Parse keyfinder output: "filename\tkey" or just "key"
        const parts = output.trim().split('\t');
        const key = parts[parts.length - 1].trim();
        resolve(key);
      } else {
        reject(new Error(error || 'Key detection failed'));
      }
    });
    
    keyfinder.on('error', reject);
  });
}

// Helper: Detect BPM using FFprobe (from existing metadata) or Essentia/aubio if available
async function detectBPM(filePath) {
  // First try to read BPM from existing file metadata
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ]);
    
    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0 && output) {
        try {
          const data = JSON.parse(output);
          const tags = data.format?.tags || {};
          const bpm = tags.BPM || tags.bpm || tags.TBPM || tags.tbpm;
          if (bpm) {
            resolve(parseFloat(bpm));
          } else {
            resolve(null); // No BPM in metadata
          }
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
    
    ffprobe.on('error', () => resolve(null));
  });
}

// Helper: Send audio features event to renderer
function sendAudioFeaturesEvent(event, data) {
  try {
    event.sender.send('audiofeatures:event', data);
  } catch (e) {
    console.error('Failed to send audio features event:', e);
  }
}

// Start audio features analysis
ipcMain.handle('audiofeatures:start', async (event, config) => {
  const { runId, files, options, credentials } = config;
  
  // Options: { detectKey, detectBPM, fetchFromSpotify, embedISRC, writeToFile }
  const spotifyClientId = credentials?.spotifyClientId || process.env.SPOTIFY_CLIENT_ID || '';
  const spotifyClientSecret = credentials?.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET || '';
  
  // Check if we need Spotify API
  const needsSpotify = options.fetchFromSpotify || options.embedISRC;
  if (needsSpotify && (!spotifyClientId || !spotifyClientSecret)) {
    console.warn('⚠️ AudioFeatures: Spotify options enabled but no credentials provided');
  }
  
  // Store run state
  const runState = {
    id: runId,
    isPaused: false,
    isCancelled: false,
    currentIndex: 0,
  };
  audioFeaturesRuns.set(runId, runState);
  
  // Emit start event
  sendAudioFeaturesEvent(event, {
    runId,
    type: 'started',
    timestamp: Date.now(),
    total: files.length,
  });
  
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    runState.currentIndex = i;
    
    // Check for pause/cancel
    while (runState.isPaused && !runState.isCancelled) {
      await new Promise((r) => setTimeout(r, 100));
    }
    
    if (runState.isCancelled) {
      sendAudioFeaturesEvent(event, {
        runId,
        type: 'cancelled',
        timestamp: Date.now(),
      });
      audioFeaturesRuns.delete(runId);
      return { success: true, cancelled: true, results };
    }
    
    const trackName = path.basename(filePath);
    let detectedKey = null;
    let detectedBPM = null;
    let spotifyFeatures = null;
    let foundISRC = null;
    let spotifyTrackId = null;
    
    sendAudioFeaturesEvent(event, {
      runId,
      type: 'track_start',
      timestamp: Date.now(),
      current: i + 1,
      total: files.length,
      track: { path: filePath, name: trackName },
    });
    
    try {
      // Step 1: Detect key locally using keyfinder-cli
      if (options.detectKey) {
        try {
          console.log(`🎵 AudioFeatures: Detecting key for ${trackName}...`);
          detectedKey = await detectKey(filePath);
          console.log(`✓ AudioFeatures: Key detected: ${detectedKey}`);
        } catch (e) {
          console.error(`❌ AudioFeatures: Key detection failed for ${trackName}:`, e.message);
        }
      }
      
      // Step 2: Get BPM from metadata or detect
      if (options.detectBPM) {
        try {
          console.log(`🥁 AudioFeatures: Getting BPM for ${trackName}...`);
          detectedBPM = await detectBPM(filePath);
          if (detectedBPM) {
            console.log(`✓ AudioFeatures: BPM from metadata: ${detectedBPM}`);
          }
        } catch (e) {
          console.error(`⚠️ AudioFeatures: BPM detection failed for ${trackName}`);
        }
      }
      
      // Step 3: Spotify lookup - for ISRC embedding and/or audio features
      const needsSpotifyLookup = (options.embedISRC || options.fetchFromSpotify) && spotifyClientId && spotifyClientSecret;
      
      if (needsSpotifyLookup) {
        try {
          // Read existing metadata from file
          const mm = await import('music-metadata');
          let existingISRC = null;
          let artist = null;
          let title = null;
          
          try {
            const metadata = await mm.parseFile(filePath);
            existingISRC = metadata.common.isrc?.[0];
            artist = metadata.common.artist;
            title = metadata.common.title;
          } catch {
            // Use FFprobe as fallback
            const ffprobeResult = await new Promise((resolve) => {
              const { spawn } = require('child_process');
              const ffprobe = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]);
              let output = '';
              ffprobe.stdout.on('data', (d) => output += d.toString());
              ffprobe.on('close', () => {
                try { resolve(JSON.parse(output)); } catch { resolve(null); }
              });
            });
            if (ffprobeResult?.format?.tags) {
              const tags = ffprobeResult.format.tags;
              existingISRC = tags.isrc || tags.ISRC || tags.TSRC;
              artist = tags.artist || tags.ARTIST;
              title = tags.title || tags.TITLE;
            }
          }
          
          // Parse artist/title from filename if not in metadata
          if (!artist || !title) {
            const baseName = path.basename(filePath, path.extname(filePath));
            const parsed = parseArtistTitleFromFilename(baseName);
            if (!artist && parsed.artist) artist = parsed.artist;
            if (!title && parsed.title) title = parsed.title;
          }
          
          // If file already has ISRC and we only want to embed ISRC, skip the Spotify search
          if (existingISRC && options.embedISRC && !options.fetchFromSpotify) {
            foundISRC = existingISRC;
            console.log(`✓ AudioFeatures: File already has ISRC: ${existingISRC}`);
          } else if (artist && title) {
            console.log(`🌐 AudioFeatures: Searching Spotify for "${artist} - ${title}"...`);
            const spotifyResults = await searchSpotify({ isrc: existingISRC, artist, title }, spotifyClientId, spotifyClientSecret);
            
            if (spotifyResults.length > 0) {
              const bestMatch = spotifyResults[0];
              
              // Get ISRC from Spotify result
              if (options.embedISRC && bestMatch.isrc) {
                foundISRC = bestMatch.isrc;
                spotifyTrackId = bestMatch.trackId;
                console.log(`✓ AudioFeatures: Found ISRC from Spotify: ${foundISRC}`);
              }
              
              // Get audio features if requested
              if (options.fetchFromSpotify && bestMatch.audioFeatures) {
                spotifyFeatures = bestMatch.audioFeatures;
                console.log(`✓ AudioFeatures: Got Spotify audio features`);
              }
              
              // Use Spotify BPM if not detected locally
              if (!detectedBPM && bestMatch.bpm) {
                detectedBPM = bestMatch.bpm;
                console.log(`✓ AudioFeatures: Using Spotify BPM: ${detectedBPM}`);
              }
              
              // Use Spotify key if not detected locally
              if (!detectedKey && bestMatch.key) {
                detectedKey = bestMatch.key;
                console.log(`✓ AudioFeatures: Using Spotify key: ${detectedKey}`);
              }
            } else {
              console.log(`⚠️ AudioFeatures: No Spotify match found for "${artist} - ${title}"`);
            }
          } else {
            console.log(`⚠️ AudioFeatures: Cannot search Spotify - no artist/title available`);
          }
        } catch (e) {
          console.error(`⚠️ AudioFeatures: Spotify lookup failed:`, e.message);
        }
      }
      
      // Step 4: Write results to file if enabled
      if (options.writeToFile && (detectedKey || detectedBPM || foundISRC || spotifyFeatures)) {
        try {
          const { File: TagFile, Id3v2Tag, Id3v2UserTextInformationFrame, StringType } = require('node-taglib-sharp');
          const tagFile = TagFile.createFromPath(filePath);
          
          const updatedTags = [];
          
          // Write key (INITIALKEY/TKEY) - convert to Camelot by default for DJs
          if (detectedKey) {
            const formattedKey = convertKeyFormat(detectedKey, 'camelot');
            tagFile.tag.initialKey = formattedKey;
            updatedTags.push(`key:${formattedKey}`);
          }
          
          // Write BPM
          if (detectedBPM) {
            tagFile.tag.beatsPerMinute = Math.round(detectedBPM);
            updatedTags.push(`bpm:${Math.round(detectedBPM)}`);
          }
          
          // Write ISRC to custom TXXX frame (like OneTagger does)
          if (foundISRC) {
            // Get ID3 tag if available
            let id3Tag = null;
            if (tagFile.tag instanceof Id3v2Tag) {
              id3Tag = tagFile.tag;
            } else if (tagFile.tag.tags) {
              id3Tag = tagFile.tag.tags.find(t => t instanceof Id3v2Tag);
            }
            
            if (id3Tag && id3Tag.frames) {
              try {
                // Remove existing ISRC frame
                const existing = Id3v2UserTextInformationFrame.findUserTextInformationFrame(id3Tag.frames, 'ISRC', StringType.UTF8);
                if (existing) {
                  id3Tag.removeFrame(existing);
                }
                // Add new ISRC frame
                const frame = Id3v2UserTextInformationFrame.fromDescription('ISRC', StringType.UTF8);
                frame.text = [foundISRC];
                id3Tag.frames.push(frame);
                updatedTags.push(`isrc:${foundISRC}`);
              } catch (e) {
                console.error(`⚠️ AudioFeatures: Failed to write ISRC frame:`, e.message);
              }
              
              // Also write Spotify track ID for reference
              if (spotifyTrackId) {
                try {
                  const existingSpotify = Id3v2UserTextInformationFrame.findUserTextInformationFrame(id3Tag.frames, 'SPOTIFY_TRACK_ID', StringType.UTF8);
                  if (existingSpotify) {
                    id3Tag.removeFrame(existingSpotify);
                  }
                  const spotifyFrame = Id3v2UserTextInformationFrame.fromDescription('SPOTIFY_TRACK_ID', StringType.UTF8);
                  spotifyFrame.text = [spotifyTrackId];
                  id3Tag.frames.push(spotifyFrame);
                  updatedTags.push(`spotify:${spotifyTrackId}`);
                } catch (e) {
                  // Ignore
                }
              }
            }
          }
          
          tagFile.save();
          tagFile.dispose();
          
          console.log(`📝 AudioFeatures: Wrote tags to ${trackName}:`, updatedTags);
        } catch (e) {
          console.error(`❌ AudioFeatures: Failed to write tags to ${trackName}:`, e.message);
        }
      }
      
      // Build result
      const hasData = detectedKey || detectedBPM || foundISRC || spotifyFeatures;
      const result = {
        runId,
        trackPath: filePath,
        status: hasData ? 'success' : 'partial',
        key: detectedKey,
        bpm: detectedBPM,
        isrc: foundISRC,
        spotifyTrackId: spotifyTrackId,
        audioFeatures: spotifyFeatures,
      };
      
      results.push(result);
      
      sendAudioFeaturesEvent(event, {
        runId,
        type: 'track_complete',
        timestamp: Date.now(),
        current: i + 1,
        total: files.length,
        track: { path: filePath, name: trackName },
        result,
      });
      
    } catch (e) {
      console.error(`❌ AudioFeatures: Error processing ${trackName}:`, e.message);
      
      results.push({
        runId,
        trackPath: filePath,
        status: 'failed',
        error: e.message,
      });
      
      sendAudioFeaturesEvent(event, {
        runId,
        type: 'track_failed',
        timestamp: Date.now(),
        track: { path: filePath, name: trackName },
        error: e.message,
      });
    }
    
    // Emit progress
    sendAudioFeaturesEvent(event, {
      runId,
      type: 'progress',
      timestamp: Date.now(),
      current: i + 1,
      total: files.length,
    });
  }
  
  // Emit completion
  sendAudioFeaturesEvent(event, {
    runId,
    type: 'completed',
    timestamp: Date.now(),
    current: files.length,
    total: files.length,
  });
  
  // Send results
  mainWindow?.webContents.send('audiofeatures:result', { runId, results });
  
  audioFeaturesRuns.delete(runId);
  
  return { success: true, results };
});

// Pause audio features run
ipcMain.handle('audiofeatures:pause', async (event, runId) => {
  const runState = audioFeaturesRuns.get(runId);
  if (runState) {
    runState.isPaused = true;
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Resume audio features run
ipcMain.handle('audiofeatures:resume', async (event, runId) => {
  const runState = audioFeaturesRuns.get(runId);
  if (runState) {
    runState.isPaused = false;
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Cancel audio features run
ipcMain.handle('audiofeatures:cancel', async (event, runId) => {
  const runState = audioFeaturesRuns.get(runId);
  if (runState) {
    runState.isCancelled = true;
    runState.isPaused = false;
    return { success: true };
  }
  return { success: false, error: 'Run not found' };
});

// Analyze single file for key
ipcMain.handle('audiofeatures:detect-key', async (event, filePath) => {
  try {
    const key = await detectKey(filePath);
    return { success: true, key };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============================================================================
// QUICK TAG: Write POPM Rating (Popularimeter)
// ============================================================================

/**
 * Writes Rekordbox-friendly rating to AIFF/MP3 via POPM using TagLib.
 * Uses ID3v2.3 for maximum compatibility.
 * Accepts ratingByte (0-255) directly - no conversion needed.
 */
ipcMain.handle('audioTags:setRating', async (event, filePath, ratingByte) => {
  try {
    // Normalize file path
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('file://localhost/')) {
      normalizedPath = normalizedPath.replace('file://localhost/', '/');
    } else if (normalizedPath.startsWith('file://')) {
      normalizedPath = normalizedPath.replace('file://', '');
    }
    normalizedPath = decodeURIComponent(normalizedPath);

    // Check file exists
    try {
      await fs.access(normalizedPath);
    } catch {
      return { success: false, error: 'File not found' };
    }

    // Validate ratingByte (0-255)
    const byte = typeof ratingByte === 'number' ? ratingByte : Number(ratingByte);
    if (!Number.isFinite(byte) || byte < 0 || byte > 255) {
      return { success: false, error: `Invalid ratingByte: ${ratingByte} (must be 0-255)` };
    }
    const POPM_EMAIL = 'bonk@suh';

    // Use node-taglib-sharp to write POPM
    const { File: TagFile, Id3v2Tag, Id3v2PopularimeterFrame, Id3v2Settings } = require('node-taglib-sharp');
    
    // Force ID3v2.3 for maximum compatibility (especially with Rekordbox)
    Id3v2Settings.defaultVersion = 3;
    Id3v2Settings.forceDefaultVersion = true;

    const tagFile = TagFile.createFromPath(normalizedPath);
    
    // Get or create ID3v2 tag
    let id3Tag = null;
    if (tagFile.tag instanceof Id3v2Tag) {
      id3Tag = tagFile.tag;
    } else if (tagFile.tag.tags) {
      id3Tag = tagFile.tag.tags.find(t => t instanceof Id3v2Tag);
    } else {
      // Create new ID3v2 tag if none exists
      id3Tag = new Id3v2Tag();
      if (tagFile.tag.tags) {
        tagFile.tag.tags.push(id3Tag);
      }
    }

    if (!id3Tag) {
      tagFile.dispose();
      return { success: false, error: 'Could not access or create ID3v2 tag' };
    }

    // Remove existing POPM frames with our email (to avoid duplicates)
    const framesToRemove = [];
    for (let i = 0; i < id3Tag.frames.length; i++) {
      const frame = id3Tag.frames[i];
      if (frame instanceof Id3v2PopularimeterFrame) {
        try {
          if (frame.user === POPM_EMAIL) {
            framesToRemove.push(frame);
          }
        } catch (e) {
          // Skip if we can't access user property
        }
      }
    }
    framesToRemove.forEach(frame => id3Tag.removeFrame(frame));

    // Create new POPM frame with rating (only if rating > 0)
    if (byte > 0) {
      try {
        const popmFrame = Id3v2PopularimeterFrame.fromUser(POPM_EMAIL);
        popmFrame.rating = byte;
        popmFrame.playCount = 0;
        id3Tag.frames.push(popmFrame);
      } catch (popmError) {
        console.error('Failed to create POPM frame:', popmError.message);
        tagFile.dispose();
        return { success: false, error: `Failed to write POPM: ${popmError.message}` };
      }
    }

    // Save changes
    tagFile.save();
    tagFile.dispose();

    // Convert to stars for logging only
    const stars = byte >= 255 ? 5 : (byte > 0 ? Math.round(byte / 51) : 0);
    console.log(`✓ QuickTag: Wrote POPM rating (${stars} stars = ${byte} byte) to ${path.basename(normalizedPath)}`);

    return { success: true, ratingByte: byte, stars };
  } catch (e) {
    console.error('❌ QuickTag: Failed to write POPM rating:', e.message);
    return { success: false, error: e.message };
  }
});

/**
 * Writes Rekordbox-friendly rating to AIFF/MP3 via POPM using TagLib.
 * Uses ID3v2.3 for maximum compatibility.
 * Accepts ratingByte (0-255) directly - no stars conversion.
 * Removes ALL POPM frames to prevent Rekordbox reading another rating source.
 */
ipcMain.handle('audioTags:setRatingByte', async (_, fileUrlOrPath, ratingByteRaw) => {
  try {
    // Clamp ratingByte to [0, 255]
    const ratingByte = Math.max(0, Math.min(255, Number(ratingByteRaw) || 0));
    console.log(`[QuickTag Electron] Received: ratingByteRaw=${ratingByteRaw}, clamped ratingByte=${ratingByte}`);

    // Normalize file path (file://... or absolute)
    let normalizedPath = fileUrlOrPath;
    if (normalizedPath.startsWith('file://localhost/')) {
      normalizedPath = normalizedPath.replace('file://localhost/', '/');
    } else if (normalizedPath.startsWith('file://')) {
      normalizedPath = normalizedPath.replace('file://', '');
    }
    normalizedPath = decodeURIComponent(normalizedPath);
    console.log(`[QuickTag Electron] Normalized path: ${normalizedPath}`);

    // Check file exists
    try {
      await fs.access(normalizedPath);
    } catch {
      return { success: false, error: 'File not found' };
    }

    // POPM email identifier - MUST be consistent across all rating writers
    const POPM_EMAIL = 'bonk@suh';

    // Use node-taglib-sharp to write POPM
    const { File: TagFile, Id3v2PopularimeterFrame, Id3v2Settings, TagTypes } = require('node-taglib-sharp');
    
    // Force ID3v2.3 for maximum compatibility (especially with Rekordbox)
    Id3v2Settings.defaultVersion = 3;
    Id3v2Settings.forceDefaultVersion = true;

    const tagFile = TagFile.createFromPath(normalizedPath);
    
    // Get or create ID3v2 tag (create=true means create if it doesn't exist)
    const id3Tag = tagFile.getTag(TagTypes.Id3v2, true);

    // Remove ALL POPM frames (including ones with empty emails) to prevent Rekordbox reading another rating source
    // Use both frameId check AND instanceof check for maximum compatibility
    const popmFramesBefore = id3Tag.frames.filter(f => 
      f.frameId === 'POPM' || f instanceof Id3v2PopularimeterFrame
    );
    if (popmFramesBefore.length > 0) {
      console.log(`[QuickTag Electron] Found ${popmFramesBefore.length} existing POPM frame(s) - removing all`);
      popmFramesBefore.forEach(frame => {
        try {
          const email = frame.user || '(empty)';
          const rating = frame.rating || 0;
          console.log(`  - Removing POPM: email="${email}", rating=${rating}`);
        } catch (e) {
          console.log(`  - Removing POPM: (could not read properties)`);
        }
      });
    }
    // Remove frames that match EITHER condition (frameId is POPM OR it's a PopularimeterFrame instance)
    id3Tag.frames = id3Tag.frames.filter(f => 
      f.frameId !== 'POPM' && !(f instanceof Id3v2PopularimeterFrame)
    );

    // Create new POPM frame with rating (only if ratingByte > 0)
    if (ratingByte > 0) {
      const popm = Id3v2PopularimeterFrame.fromUser(POPM_EMAIL);
      popm.rating = ratingByte;
      popm.playCount = 0;
      id3Tag.frames.push(popm);
      console.log(`[QuickTag Electron] Writing POPM: rating=${popm.rating}, playCount=${popm.playCount}`);
    } else {
      console.log(`[QuickTag Electron] ratingByte is 0, skipping POPM frame creation`);
    }

    // Save changes
    tagFile.save();
    tagFile.dispose();

    console.log(`✓ QuickTag: Wrote POPM rating (${ratingByte} byte) to ${path.basename(normalizedPath)}`);

    return { success: true, ratingByte };
  } catch (e) {
    console.error('❌ QuickTag: Failed to write POPM rating:', e.message);
    return { success: false, error: e.message };
  }
});