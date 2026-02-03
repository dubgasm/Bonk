const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  writeTags: (tracks, settings) => ipcRenderer.invoke('write-tags', tracks, settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  detectKey: (trackPath) => ipcRenderer.invoke('detect-key', trackPath),
  reloadTrack: (trackPath) => ipcRenderer.invoke('reload-track', trackPath),
  // Rekordbox Database handlers
  rekordboxGetConfig: () => ipcRenderer.invoke('rekordbox-get-config'),
  rekordboxSetConfig: (installDir, appDir) => ipcRenderer.invoke('rekordbox-set-config', installDir, appDir),
  rekordboxImportDatabase: (dbPath) => ipcRenderer.invoke('rekordbox-import-database', dbPath),
  rekordboxBackupDatabase: (dbPath) => ipcRenderer.invoke('rekordbox-backup-database', dbPath),
  rekordboxExportDatabase: (library, dbPath, syncMode) => ipcRenderer.invoke('rekordbox-export-database', library, dbPath, syncMode),
  rekordboxSelectDatabase: () => ipcRenderer.invoke('rekordbox-select-database'),
  rekordboxCreateSmartPlaylist: (name, conditions, logicalOperator, parent) => ipcRenderer.invoke('rekordbox-create-smart-playlist', name, conditions, logicalOperator, parent),
  rekordboxGetSmartPlaylistContents: (playlistId) => ipcRenderer.invoke('rekordbox-get-smart-playlist-contents', playlistId),
  applySmartFixes: (trackIds, fixes) => ipcRenderer.invoke('apply-smart-fixes', trackIds, fixes),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  searchMissingTracksInFolder: (folderPath, requests) => ipcRenderer.invoke('search-missing-tracks-in-folder', folderPath, requests),
  // Album art extraction (lazy loading)
  extractAlbumArt: (location) => ipcRenderer.invoke('extract-album-art', location),
  // Audio playback handler
  readAudioFile: (filePath) => ipcRenderer.invoke('read-audio-file', filePath),
  transcodeForAudition: (filePath) => ipcRenderer.invoke('transcode-for-audition', filePath),
  getAnlzData: (trackPath, dbPath) => ipcRenderer.invoke('get-anlz-data', trackPath, dbPath),
  // Rust audio player handlers
  rustAudioInit: () => ipcRenderer.invoke('rust-audio-init'),
  rustAudioLoad: (filePath) => ipcRenderer.invoke('rust-audio-load', filePath),
  rustAudioPlay: () => ipcRenderer.invoke('rust-audio-play'),
  rustAudioPause: () => ipcRenderer.invoke('rust-audio-pause'),
  rustAudioStop: () => ipcRenderer.invoke('rust-audio-stop'),
  rustAudioSetVolume: (volume) => ipcRenderer.invoke('rust-audio-set-volume', volume),
  rustAudioGetDuration: () => ipcRenderer.invoke('rust-audio-get-duration'),
  rustAudioGetPosition: () => ipcRenderer.invoke('rust-audio-get-position'),
  rustAudioIsPlaying: () => ipcRenderer.invoke('rust-audio-is-playing'),
   rustAudioSeek: (seconds) => ipcRenderer.invoke('rust-audio-seek', seconds),
   rustAudioGetWaveform: (filePath, buckets) => ipcRenderer.invoke('rust-audio-get-waveform', filePath, buckets),
  // Quick Tag: Write POPM rating
  audioTagsSetRating: (filePath, stars) => ipcRenderer.invoke('audioTags:setRating', filePath, stars),
  audioTagsSetRatingByte: (filePath, ratingByte) => ipcRenderer.invoke('audioTags:setRatingByte', filePath, ratingByte),
  // Audio conversion handlers
  convertAudioFile: (inputPath, outputPath, format) => ipcRenderer.invoke('convert-audio-file', inputPath, outputPath, format),
  batchConvertTracks: (conversions, options) => ipcRenderer.invoke('batch-convert-tracks', conversions, options),
  updateRekordboxPath: (trackId, newPath, oldPath, dbPath) => ipcRenderer.invoke('update-rekordbox-path', trackId, newPath, oldPath, dbPath),
  onConversionProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (_, data) => callback(data));
  },
  removeConversionProgressListener: () => {
    ipcRenderer.removeAllListeners('conversion-progress');
  },
  locateMissingFile: (trackName) => ipcRenderer.invoke('locate-missing-file', trackName),
  
  // AutoTag handlers
  autotagStart: (config) => ipcRenderer.invoke('autotag:start', config),
  autotagPause: (runId) => ipcRenderer.invoke('autotag:pause', runId),
  autotagResume: (runId) => ipcRenderer.invoke('autotag:resume', runId),
  autotagCancel: (runId) => ipcRenderer.invoke('autotag:cancel', runId),
  autotagCheckAuth: (providerId, credentials) => ipcRenderer.invoke('autotag:check-auth', providerId, credentials),
  onAutotagEvent: (callback) => {
    ipcRenderer.on('autotag:event', (_, data) => callback(data));
  },
  onAutotagResult: (callback) => {
    ipcRenderer.on('autotag:result', (_, data) => callback(data));
  },
  removeAutotagListeners: () => {
    ipcRenderer.removeAllListeners('autotag:event');
    ipcRenderer.removeAllListeners('autotag:result');
  },
  
  // Audio Features handlers (local audio analysis)
  audioFeaturesStart: (config) => ipcRenderer.invoke('audiofeatures:start', config),
  audioFeaturesPause: (runId) => ipcRenderer.invoke('audiofeatures:pause', runId),
  audioFeaturesResume: (runId) => ipcRenderer.invoke('audiofeatures:resume', runId),
  audioFeaturesCancel: (runId) => ipcRenderer.invoke('audiofeatures:cancel', runId),
  audioFeaturesDetectKey: (filePath) => ipcRenderer.invoke('audiofeatures:detect-key', filePath),
  onAudioFeaturesEvent: (callback) => {
    ipcRenderer.on('audiofeatures:event', (_, data) => callback(data));
  },
  onAudioFeaturesResult: (callback) => {
    ipcRenderer.on('audiofeatures:result', (_, data) => callback(data));
  },
  removeAudioFeaturesListeners: () => {
    ipcRenderer.removeAllListeners('audiofeatures:event');
    ipcRenderer.removeAllListeners('audiofeatures:result');
  },
  
  // Database operation progress
  onDatabaseProgress: (callback) => {
    ipcRenderer.on('database-progress', (_, data) => callback(data));
  },
  removeDatabaseProgressListener: () => {
    ipcRenderer.removeAllListeners('database-progress');
  },
});

