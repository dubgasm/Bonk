const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  writeTags: (tracks, settings) => ipcRenderer.invoke('write-tags', tracks, settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  detectKey: (trackPath) => ipcRenderer.invoke('detect-key', trackPath),
  findTags: (tracks, options) => ipcRenderer.invoke('find-tags', tracks, options),
  reloadTrack: (trackPath) => ipcRenderer.invoke('reload-track', trackPath),
  onFindTagsProgress: (callback) => ipcRenderer.on('find-tags-progress', (_, data) => callback(data)),
  onTrackMetadataUpdate: (callback) => ipcRenderer.on('track-metadata-update', (_, data) => callback(data)),
  removeFindTagsListener: () => {
    ipcRenderer.removeAllListeners('find-tags-progress');
    ipcRenderer.removeAllListeners('track-metadata-update');
  },
  // Rekordbox Database handlers
  rekordboxGetConfig: () => ipcRenderer.invoke('rekordbox-get-config'),
  rekordboxSetConfig: (installDir, appDir) => ipcRenderer.invoke('rekordbox-set-config', installDir, appDir),
  rekordboxImportDatabase: (dbPath) => ipcRenderer.invoke('rekordbox-import-database', dbPath),
  rekordboxExportDatabase: (library, dbPath, syncMode) => ipcRenderer.invoke('rekordbox-export-database', library, dbPath, syncMode),
  rekordboxSyncDatabase: (library, dbPath) => ipcRenderer.invoke('rekordbox-sync-database', library, dbPath),
  rekordboxSelectDatabase: () => ipcRenderer.invoke('rekordbox-select-database'),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
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
});

