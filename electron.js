const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

const { exec } = require('child_process');
const { promisify } = require('util');

// Load environment variables from .env file
require('dotenv').config();

const execAsync = promisify(exec);
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';

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

// Search Spotify for track
async function searchSpotify(artist, title, token) {
  try {
    const query = encodeURIComponent(`artist:${artist} track:${title}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
    
    const searchResponse = await axios.get(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!searchResponse.data.tracks?.items?.length) {
      return null;
    }

    const track = searchResponse.data.tracks.items[0];
    const result = {
      title: track.name,
      artist: track.artists[0]?.name,
      album: track.album?.name,
      year: track.album?.release_date ? parseInt(track.album.release_date.substring(0, 4)) : null,
      albumArt: track.album?.images?.[0]?.url,
      popularity: track.popularity,
    };

    // Get audio features
    try {
      const featuresUrl = `https://api.spotify.com/v1/audio-features/${track.id}`;
      const featuresResponse = await axios.get(featuresUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (featuresResponse.data) {
        result.energy = Math.round(featuresResponse.data.energy * 100);
        result.danceability = Math.round(featuresResponse.data.danceability * 100);
        result.happiness = Math.round(featuresResponse.data.valence * 100);
        result.bpm = Math.round(featuresResponse.data.tempo);
      }
    } catch (e) {
      console.log('Could not get audio features for track');
    }

    return result;
  } catch (error) {
    console.error('Spotify search error:', error.message);
    return null;
  }
}

// Dynamic import for ES module
let mm;
(async () => {
  mm = await import('music-metadata');
})();

let mainWindow = null;

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
  const distPath = path.join(__dirname, 'dist/renderer/index.html');
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: load from dist folder
    if (require('fs').existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      console.error('Production build not found at:', distPath);
      console.error('Please run: npm run build');
      mainWindow.loadURL('data:text/html,<h1>Production build not found</h1><p>Please run: npm run build</p>');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

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
          
          const track = {
            TrackID: trackId,
            Name: metadata.common.title || path.basename(trackPath, path.extname(trackPath)),
            Artist: metadata.common.artist || 'Unknown Artist',
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
            
            result.tracks.push({
              TrackID: trackId,
              Name: tags.title || tags.TITLE || path.basename(trackPath, ext),
              Artist: tags.artist || tags.ARTIST || 'Unknown Artist',
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
            });
            
          if (process.env.NODE_ENV === 'development') {
            console.log('✓ Track imported using FFprobe', useFFprobe ? '(AIFF)' : '(fallback)');
          }
          } catch (ffprobeError) {
            console.error('❌ FFprobe also failed:', ffprobeError.message);
            // Last resort: filename only
            const trackId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            result.tracks.push({
              TrackID: trackId,
              Name: path.basename(trackPath, path.extname(trackPath)),
              Artist: 'Unknown Artist',
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
      
      // Return fresh metadata from file
      const freshTrack = {
        Name: metadata.common.title || path.basename(filePath, ext),
        Artist: metadata.common.artist || 'Unknown Artist',
        Album: metadata.common.album || '',
        Genre: metadata.common.genre ? metadata.common.genre.join(', ') : '',
        Year: metadata.common.year?.toString() || '',
        AverageBpm: metadata.common.bpm?.toString() || '',
        TotalTime: metadata.format.duration ? (metadata.format.duration * 1000).toString() : '',
        BitRate: metadata.format.bitrate?.toString() || '',
        SampleRate: metadata.format.sampleRate?.toString() || '',
        Kind: metadata.format.codec || ext.substring(1).toUpperCase() + ' File',
        Size: (await fs.stat(filePath)).size.toString(),
        Comments: metadata.common.comment?.[0] || '',
        Tonality: metadata.common.key || '',
        Key: metadata.common.key || '',
        AlbumArt: albumArt,
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

ipcMain.handle('find-tags', async (event, tracks, options) => {
  const results = {
    success: true,
    tracksUpdated: 0,
    tracksSkipped: 0,
    errors: []
  };

  // Get Spotify token if enabled
  // Use credentials from options, or fallback to environment variables
  const spotifyClientId = options.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
  const spotifyClientSecret = options.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET;
  
  let spotifyAccessToken = null;
  if (options.enableSpotify && spotifyClientId && spotifyClientSecret) {
    spotifyAccessToken = await getSpotifyToken(spotifyClientId, spotifyClientSecret);
    if (!spotifyAccessToken) {
      console.log('⚠️ Spotify authentication failed - skipping Spotify searches');
    } else {
      const source = options.spotifyClientId ? 'settings' : '.env file';
      console.log(`🔑 Using Spotify credentials from ${source}`);
    }
  }

  for (const track of tracks) {
    try {
      // Check which fields are missing and need to be fetched
      const fieldsToUpdate = {
        needsYear: options.updateYear && !track.Year,
        needsAlbum: options.updateAlbum && !track.Album,
        needsLabel: options.updateLabel && !track.Label,
        needsAlbumArt: options.updateAlbumArt && !track.AlbumArt,
        needsGenre: options.updateGenre && !track.Genre,
      };

      // Check if track already has all requested metadata
      const hasAllRequestedData = 
        (!options.updateYear || track.Year) &&
        (!options.updateAlbum || track.Album) &&
        (!options.updateLabel || track.Label) &&
        (!options.updateAlbumArt || track.AlbumArt) &&
        (!options.updateGenre || track.Genre);

      if (hasAllRequestedData) {
        console.log(`✓ Skipping ${track.Name} - already has all requested metadata`);
        event.sender.send('find-tags-progress', {
          current: results.tracksUpdated + results.tracksSkipped + 1,
          total: tracks.length,
          currentTrack: track.Name,
          status: 'skipped',
          message: `${track.Name} - already complete`
        });
        results.tracksSkipped++;
        continue;
      }

      // Build list of missing fields for logging
      const missingFields = [];
      if (fieldsToUpdate.needsYear) missingFields.push('Year');
      if (fieldsToUpdate.needsAlbum) missingFields.push('Album');
      if (fieldsToUpdate.needsLabel) missingFields.push('Label');
      if (fieldsToUpdate.needsAlbumArt) missingFields.push('Album Art');
      if (fieldsToUpdate.needsGenre) missingFields.push('Genre');

      console.log(`🔍 Searching for missing fields: ${missingFields.join(', ')}`);

      // Send progress update
      event.sender.send('find-tags-progress', {
        current: results.tracksUpdated + results.tracksSkipped + 1,
        total: tracks.length,
        currentTrack: track.Name,
        status: 'searching',
        message: `Searching for ${missingFields.join(', ')}...`
      });

      // Track what data we've found to avoid overwriting
      const foundData = {
        year: false,
        album: false,
        genre: false,
        albumArt: false,
        energy: false,
        danceability: false,
        happiness: false,
        popularity: false
      };
      
      let updatedData = {};

      // Try Spotify first (if enabled and authenticated)
      if (options.enableSpotify && spotifyAccessToken) {
        try {
          const spotifyResult = await searchSpotify(track.Artist, track.Name, spotifyAccessToken);
          
          if (spotifyResult) {
            console.log(`✅ Spotify: Found "${track.Name}"`);
            
            if (options.updateGenre && spotifyResult.genre && !foundData.genre) {
              updatedData.Genre = spotifyResult.genre;
              foundData.genre = true;
            }
            if (options.updateYear && spotifyResult.year && !foundData.year) {
              updatedData.Year = spotifyResult.year;
              foundData.year = true;
            }
            if (options.updateAlbum && spotifyResult.album && !foundData.album) {
              updatedData.Album = spotifyResult.album;
              foundData.album = true;
            }
            if (options.updateEnergy && spotifyResult.energy) {
              updatedData.Energy = spotifyResult.energy;
              foundData.energy = true;
            }
            if (options.updateDanceability && spotifyResult.danceability) {
              updatedData.Danceability = spotifyResult.danceability;
              foundData.danceability = true;
            }
            if (options.updateHappiness && spotifyResult.happiness) {
              updatedData.Happiness = spotifyResult.happiness;
              foundData.happiness = true;
            }
            if (options.updatePopularity && spotifyResult.popularity) {
              updatedData.Popularity = spotifyResult.popularity;
              foundData.popularity = true;
            }
            
            // Download album art if needed
            if (options.updateAlbumArt && spotifyResult.albumArt && !foundData.albumArt) {
              try {
                event.sender.send('find-tags-progress', {
                  current: results.tracksUpdated + results.tracksSkipped + 1,
                  total: tracks.length,
                  currentTrack: track.Name,
                  status: 'downloading',
                  message: 'Downloading album art from Spotify...'
                });

                const artResponse = await axios.get(spotifyResult.albumArt, {
                  responseType: 'arraybuffer',
                  timeout: 10000
                });

                if (artResponse.data) {
                  const buffer = Buffer.from(artResponse.data);
                  if (!sharp) {
                    console.error('Sharp is not available, skipping optimization but keeping album art');
                    updatedData.AlbumArt = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                    foundData.albumArt = true;
                  } else {
                    const optimizedImage = await sharp(buffer)
                      .resize(500, 500, { fit: 'cover' })
                      .jpeg({ quality: 90 })
                      .toBuffer();
                    updatedData.AlbumArt = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;
                    foundData.albumArt = true;
                  }
                  console.log(`  ✓ Downloaded album art from Spotify`);
                }
              } catch (artError) {
                console.error('Failed to download Spotify album art:', artError.message);
              }
            }
          }
        } catch (error) {
          console.error('Spotify search error:', error);
        }
      }

      // Search MusicBrainz (free API, no key needed)
      if (options.enableMusicBrainz) {
        try {
          const query = encodeURIComponent(`artist:${track.Artist} recording:${track.Name}`);
          const url = `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=1`;
          
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Bonk/1.0.0 ( bonk@example.com )'
            },
            timeout: 5000
          });

          if (response.data.recordings && response.data.recordings.length > 0) {
            const recording = response.data.recordings[0];
            const release = recording.releases?.[0];
            
            // Only update fields that are missing and weren't already found by Spotify
            if (fieldsToUpdate.needsYear && release?.date && !foundData.year) {
              updatedData.Year = release.date.substring(0, 4);
              foundData.year = true;
              console.log(`  ✓ Found Year: ${updatedData.Year}`);
            }
            
            if (fieldsToUpdate.needsAlbum && release?.title && !foundData.album) {
              updatedData.Album = release.title;
              foundData.album = true;
              console.log(`  ✓ Found Album: ${updatedData.Album}`);
            }
            
            if (fieldsToUpdate.needsLabel && release?.['label-info']?.[0]?.label?.name) {
              updatedData.Label = release['label-info'][0].label.name;
              console.log(`  ✓ Found Label: ${updatedData.Label}`);
            }

            // Download album art only if missing and not already found by Spotify
            if (fieldsToUpdate.needsAlbumArt && release?.id && !foundData.albumArt) {
              console.log(`  🎨 Downloading album art...`);
              event.sender.send('find-tags-progress', {
                current: results.tracksUpdated + results.tracksSkipped + 1,
                total: tracks.length,
                currentTrack: track.Name,
                status: 'downloading',
                message: 'Downloading album art...'
              });

              try {
                const artUrl = `https://coverartarchive.org/release/${release.id}/front-500`;
                const artResponse = await axios.get(artUrl, {
                  responseType: 'arraybuffer',
                  timeout: 10000
                });

                if (artResponse.data) {
                  // Parse file location
                  let filePath = track.Location;
                  if (filePath.startsWith('file://localhost/')) {
                    filePath = filePath.replace('file://localhost/', '/');
                  } else if (filePath.startsWith('file://')) {
                    filePath = filePath.replace('file://', '');
                  }
                  filePath = decodeURIComponent(filePath);

                  event.sender.send('find-tags-progress', {
                    current: results.tracksUpdated + results.tracksSkipped + 1,
                    total: tracks.length,
                    currentTrack: track.Name,
                    status: 'embedding',
                    message: 'Embedding album art...'
                  });

                  // Resize and optimize image, convert to base64 for in-memory storage
                  try {
                    const buffer = Buffer.from(artResponse.data);
                    let processed = buffer;
                    if (!sharp) {
                      console.error('Sharp is not available, skipping optimization but keeping album art');
                    } else {
                      processed = await Promise.race([
                        sharp(buffer)
                          .resize(500, 500, { fit: 'cover' })
                          .jpeg({ quality: 90 })
                          .toBuffer(),
                        new Promise((_, reject) => 
                          setTimeout(() => reject(new Error('Image processing timeout')), 10000)
                        )
                      ]);
                    }

                    // Store as base64 for display in UI (not writing to file yet)
                    updatedData.AlbumArt = `data:image/jpeg;base64,${processed.toString('base64')}`;
                    foundData.albumArt = true;
                    console.log(`  ✓ Downloaded and processed album art from MusicBrainz`);
                  } catch (imgError) {
                    console.error('Image processing failed:', imgError.message);
                    // Continue without image
                  }
                }
              } catch (artError) {
                console.error('Failed to download/embed album art:', artError);
              }
            }
          }
        } catch (error) {
          console.error('MusicBrainz search error:', error);
        }
      }

      // If we have updates from any source, send them back to UI for in-memory update
      // User can then use "Write Tags to Files" to persist changes
      if (Object.keys(updatedData).length > 0) {
        console.log(`  ✓ Found ${Object.keys(updatedData).length} metadata fields total`);
        
        // Send update to renderer to update in-memory track data
        event.sender.send('track-metadata-update', {
          trackId: track.TrackID,
          updates: updatedData
        });
        
        results.tracksUpdated++;
      } else {
        // If no results found, skip
        results.tracksSkipped++;
      }
    } catch (error) {
      results.errors.push({
        track: track.Name,
        error: error.message
      });
    }
  }

  // Send completion status
  event.sender.send('find-tags-progress', {
    current: tracks.length,
    total: tracks.length,
    currentTrack: '',
    status: 'complete',
    message: 'Complete!'
  });

  return results;
});

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

ipcMain.handle('rekordbox-import-database', async (_, dbPath) => {
  try {
    console.log('📀 Importing from Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    const command = dbPath 
      ? `${pythonPath} "${bridgePath}" import-database "${dbPath}"`
      : `${pythonPath} "${bridgePath}" import-database`;
    
    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large libraries
    });
    
    if (stderr) {
      console.warn('Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    console.log(`✓ Imported ${result.trackCount} tracks, ${result.playlistCount} playlists`);
    
    // Album art extraction will happen in background after import completes
    // This prevents blocking the import process
    if (result.success && result.library && result.library.tracks) {
      console.log('🎨 Album art will be extracted in background (non-blocking)...');
      // Note: Album art extraction moved to background to avoid blocking import
      // It will be extracted on-demand when tracks are displayed
    }
    
    return result;
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
    console.log(`✓ Export complete: ${result.added} added, ${result.updated} updated`);
    
    return result;
  } catch (error) {
    console.error('Rekordbox export error:', error);
    return { 
      success: false, 
      error: `Failed to export to Rekordbox database: ${error.message}` 
    };
  }
});

ipcMain.handle('rekordbox-sync-database', async (_, library, dbPath) => {
  try {
    console.log('🔄 Syncing with Rekordbox database...');
    const pythonPath = 'python3';
    const bridgePath = getRekordboxBridgePath();
    
    // Write library to temp file
    const tempFile = path.join(require('os').tmpdir(), `bonk_sync_${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify(library));
    
    const command = dbPath
      ? `${pythonPath} "${bridgePath}" sync-database "@${tempFile}" "${dbPath}"`
      : `${pythonPath} "${bridgePath}" sync-database "@${tempFile}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024
    });
    
    // Clean up temp file
    await fs.unlink(tempFile);
    
    if (stderr) {
      console.warn('Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    console.log(`✓ Sync complete: ${result.updated_in_db} DB updates, ${result.updated_in_bonk} Bonk updates`);
    
    return result;
  } catch (error) {
    console.error('Rekordbox sync error:', error);
    return { 
      success: false, 
      error: `Failed to sync with Rekordbox database: ${error.message}` 
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
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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
          
          if (settings.writeTitle && track.Name) {
            metadata.title = track.Name;
          }
          if (settings.writeArtist && track.Artist) {
            metadata.artist = track.Artist;
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
          if (settings.writeComments && track.Comments) {
            metadata.comment = track.Comments;
          }

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
          const ext = path.extname(filePath);
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

          // Get file format for format-specific handling
          const fileFormat = ext.toLowerCase();
          
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
  const ffmpegArgs = ['-i', inputPath];
  
  // Add format-specific encoding options
  switch (format.toUpperCase()) {
    case 'MP3':
      ffmpegArgs.push('-codec:a', 'libmp3lame', '-b:a', '320k', '-q:a', '0');
      break;
    case 'FLAC':
      ffmpegArgs.push('-codec:a', 'flac', '-compression_level', '12');
      break;
    case 'AIFF':
      ffmpegArgs.push('-codec:a', 'pcm_s24be'); // 24-bit PCM for AIFF
      break;
    case 'WAV':
      ffmpegArgs.push('-codec:a', 'pcm_s24le'); // 24-bit PCM for WAV
      break;
    case 'M4A':
    case 'AAC':
      ffmpegArgs.push('-codec:a', 'aac', '-b:a', '320k', '-q:a', '0');
      break;
    case 'OGG':
      ffmpegArgs.push('-codec:a', 'libvorbis', '-q:a', '6');
      break;
    default:
      // Default: copy audio stream (lossless)
      ffmpegArgs.push('-codec:a', 'copy');
  }

  // Preserve metadata
  ffmpegArgs.push('-map_metadata', '0');
  
  // Output file
  ffmpegArgs.push('-y', outputPath); // -y to overwrite if exists

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
            errors.push({
              track: conv.trackName || path.basename(conv.oldPath),
              error: `Database update failed: ${updateResult.error}`
            });
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

