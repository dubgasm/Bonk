import { useState, useEffect, useRef } from 'react';
import { useLibraryStore } from './store/useLibraryStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useAutoTagStore } from './store/useAutoTagStore';
import { RekordboxParser } from './utils/rekordboxParser';
import Header from './components/Header';
import TrackTable from './components/TrackTable';
import TrackEditor from './components/TrackEditor';
import SearchBar from './components/SearchBar';
import ExportModal from './components/ExportModal';
import SettingsModal from './components/SettingsModal';
import RekordboxDBModal from './components/RekordboxDBModal';
import TagsManagementSuite from './components/TagsManagementSuite';
import GenreManagementSuite from './components/GenreManagementSuite';
import PlaylistSidebar from './components/PlaylistSidebar';
import AutoTagWizard from './components/AutoTagWizard';
import AudioFeaturesWizard from './components/AudioFeaturesWizard';
import QuickTagScreen from './components/QuickTagScreen';
import { FolderOpen, Tag, Music, Database, Archive, FileText, Sparkles, Activity } from 'lucide-react';
import { Track } from './types/track';
import { Toaster } from 'sonner';
import './styles/App.css';

declare global {
  interface Window {
    electronAPI: {
      selectFile: () => Promise<string | null>;
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      saveFile: (content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      writeTags: (tracks: any[], settings: any) => Promise<{ success: boolean; count?: number; errors?: string[]; error?: string }>;
      selectFolder: () => Promise<string | null>;
      scanFolder: (folderPath: string) => Promise<{ success: boolean; library?: any; error?: string }>;
      detectKey: (trackPath: string) => Promise<{ success: boolean; key?: string; confidence?: number; method?: string; error?: string }>;
      findTags: (tracks: any[], options: any) => Promise<{ success: boolean; tracksUpdated: number; tracksSkipped: number; errors: any[] }>;
      reloadTrack: (trackPath: string) => Promise<any>;
      onFindTagsProgress?: (callback: (data: any) => void) => void;
      onTrackMetadataUpdate?: (callback: (data: { trackId: string; updates: any }) => void) => void;
      removeFindTagsListener?: () => void;
      rekordboxGetConfig?: () => Promise<{ success: boolean; config?: any; error?: string }>;
      rekordboxSetConfig?: (installDir: string, appDir: string) => Promise<{ success: boolean; error?: string }>;
      rekordboxImportDatabase?: (dbPath?: string) => Promise<{ success: boolean; library?: any; trackCount?: number; playlistCount?: number; error?: string }>;
      rekordboxExportDatabase?: (library: any, dbPath?: string, syncMode?: string) => Promise<{ success: boolean; added?: number; updated?: number; skipped?: number; errors?: string[]; error?: string }>;
      rekordboxSyncDatabase?: (library: any, dbPath?: string) => Promise<{ success: boolean; updated_in_db?: number; updated_in_bonk?: number; conflicts?: any[]; tracks?: any[]; error?: string }>;
      rekordboxSelectDatabase?: () => Promise<string | null>;
      rekordboxCreateSmartPlaylist?: (name: string, conditions: any[], logicalOperator?: number, parent?: any) => Promise<{ success: boolean; error?: string }>;
      rekordboxGetSmartPlaylistContents?: (playlistId: string) => Promise<any>;
      checkFileExists?: (filePath: string) => Promise<boolean>;
      searchMissingTracksInFolder?: (folderPath: string, requests: { trackId: string; baseName: string; extension: string }[]) => Promise<Record<string, string>>;
      convertAudioFile?: (inputPath: string, outputPath: string, format: string) => Promise<{ success: boolean; outputPath?: string; inputSize?: number; outputSize?: number; error?: string; skipped?: boolean }>;
      batchConvertTracks?: (conversions: any[], options: any) => Promise<{ success: boolean; converted?: number; skipped?: number; failed?: number; results?: any[]; errors?: any[]; error?: string }>;
      updateRekordboxPath?: (trackId: string, newPath: string, oldPath: string, dbPath: string) => Promise<{ success: boolean; error?: string }>;
      onConversionProgress?: (callback: (data: any) => void) => void;
      removeConversionProgressListener?: () => void;
      readAudioFile?: (filePath: string) => Promise<{ success: boolean; buffer?: string; mimeType?: string; error?: string }>;
      // Rust native audio player (Quick Tag + audition)
      rustAudioInit?: () => Promise<{ success: boolean; error?: string }>;
      rustAudioLoad?: (filePath: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
      rustAudioPlay?: () => Promise<{ success: boolean; error?: string }>;
      rustAudioPause?: () => Promise<{ success: boolean; error?: string }>;
      rustAudioStop?: () => Promise<{ success: boolean; error?: string }>;
      rustAudioSetVolume?: (volume: number) => Promise<{ success: boolean; error?: string }>;
      rustAudioGetDuration?: () => Promise<{ success: boolean; duration: number; error?: string }>;
      rustAudioGetPosition?: () => Promise<{ success: boolean; position: number; error?: string }>;
      rustAudioIsPlaying?: () => Promise<{ success: boolean; isPlaying: boolean; error?: string }>;
      rustAudioSeek?: (seconds: number) => Promise<{ success: boolean; error?: string }>;
      rustAudioGetWaveform?: (filePath: string, buckets: number) => Promise<{ success: boolean; waveform?: { duration_ms: number; peaks: number[] }; error?: string }>;
      // Quick Tag: Write POPM rating (accepts ratingByte 0-255 directly)
      audioTagsSetRating?: (filePath: string, ratingByte: number) => Promise<{ success: boolean; ratingByte?: number; stars?: number; error?: string }>;
      audioTagsSetRatingByte?: (filePath: string, ratingByte: number) => Promise<{ success: boolean; ratingByte?: number; stars?: number; error?: string }>;
      // AutoTag handlers
      autotagStart?: (config: any) => Promise<{ success: boolean; results?: any[]; cancelled?: boolean; error?: string }>;
      autotagPause?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      autotagResume?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      autotagCancel?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      autotagCheckAuth?: (providerId: string) => Promise<{ authenticated: boolean; requiresAuth: boolean }>;
      onAutotagEvent?: (callback: (data: any) => void) => void;
      onAutotagResult?: (callback: (data: any) => void) => void;
      removeAutotagListeners?: () => void;
      // Audio Features handlers
      audioFeaturesStart?: (config: any) => Promise<{ success: boolean; results?: any[]; cancelled?: boolean; error?: string }>;
      audioFeaturesPause?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      audioFeaturesResume?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      audioFeaturesCancel?: (runId: string) => Promise<{ success: boolean; error?: string }>;
      audioFeaturesDetectKey?: (filePath: string) => Promise<{ success: boolean; key?: string; error?: string }>;
      onAudioFeaturesEvent?: (callback: (data: any) => void) => void;
      onAudioFeaturesResult?: (callback: (data: any) => void) => void;
      removeAudioFeaturesListeners?: () => void;
    };
  }
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRekordboxDBModal, setShowRekordboxDBModal] = useState(false);
  const [showTagsManagementSuite, setShowTagsManagementSuite] = useState(false);
  const [showGenreManagementSuite, setShowGenreManagementSuite] = useState(false);
  const [showAudioFeaturesWizard, setShowAudioFeaturesWizard] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mode, setMode] = useState<'library' | 'quickTag'>('library');
  const dragEnterDepth = useRef(0);
  const { 
    library, 
    setLibrary, 
    selectedTrack, 
    selectedPlaylist, 
    setSelectedPlaylist,
    addTracksToPlaylist,
    createPlaylist,
    createFolder,
    renamePlaylist,
    deletePlaylist,
    duplicatePlaylist,
    createSmartPlaylist,
    showMissingOnly,
    setShowMissingOnly,
    deleteTracks
  } = useLibraryStore();
  const { setLastSyncDate } = useSettingsStore();
  const { isOpen: showAutoTagWizard, openModal: openAutoTagWizard } = useAutoTagStore();

  const parser = new RekordboxParser();

  // Handle global drag end to reset drag state
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      dragEnterDepth.current = 0;
      setIsDragOver(false);
    };

    // Listen to dragend on document to catch drags that end outside the app
    document.addEventListener('dragend', handleGlobalDragEnd);
    
    // Also listen for when mouse leaves the window entirely
    const handleMouseLeave = () => {
      if (isDragOver) {
        dragEnterDepth.current = 0;
        setIsDragOver(false);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragOver]);

  const handleRekordboxDBImport = (importedLibrary: any) => {
    // Merge with existing library or set new library
    if (library) {
      // Normalize location for comparison
      const normalizeLocation = (loc: string | undefined): string => {
        if (!loc) return '';
        return loc
          .replace(/^file:\/\/localhost/i, '')
          .replace(/^file:\/\//i, '')
          .replace(/\\/g, '/')
          .toLowerCase()
          .trim();
      };
      
      // Create maps for efficient lookup
      const existingLocations = new Set(
        library.tracks.map((t: Track) => normalizeLocation(t.Location))
      );
      const existingTrackIDs = new Set(
        library.tracks.map((t: Track) => t.TrackID)
      );
      
      // Filter out duplicates by both Location and TrackID
      const newTracks = importedLibrary.tracks.filter((t: Track) => {
        const normalizedLoc = normalizeLocation(t.Location);
        return !existingLocations.has(normalizedLoc) && !existingTrackIDs.has(t.TrackID);
      });
      
      console.log(`Import: ${importedLibrary.tracks.length} tracks from DB, ${newTracks.length} new, ${importedLibrary.tracks.length - newTracks.length} duplicates skipped`);
      
      const mergedLibrary = {
        tracks: [...library.tracks, ...newTracks],
        playlists: [...library.playlists, ...importedLibrary.playlists],
      };
      setLibrary(mergedLibrary);
    } else {
      setLibrary(importedLibrary);
    }
  };

  const handleRekordboxDBSync = (syncedLibrary: any) => {
    setLibrary(syncedLibrary);
    setLastSyncDate(new Date().toISOString());
  };

  // Quick import from Rekordbox using configured/auto-detected master.db
  const handleQuickRekordboxImport = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI?.rekordboxImportDatabase) {
        throw new Error('Rekordbox import is not available. Please run the app with: npm run dev');
      }

      const result = await (window.electronAPI as any).rekordboxImportDatabase(null);

      if (!result?.success || !result.library) {
        throw new Error(result?.error || 'Failed to import from Rekordbox database');
      }

      handleRekordboxDBImport(result.library);
    } catch (err: any) {
      setError(err.message || 'Failed to import from Rekordbox database');
    } finally {
      setLoading(false);
    }
  };

  // Import from a user-selected Rekordbox master.db path
  const handleCustomRekordboxImport = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI?.rekordboxSelectDatabase || !window.electronAPI?.rekordboxImportDatabase) {
        throw new Error('Rekordbox database tools are not available. Please run the app with: npm run dev');
      }

      const dbPath = await (window.electronAPI as any).rekordboxSelectDatabase();
      if (!dbPath) {
        setLoading(false);
        return;
      }

      const result = await (window.electronAPI as any).rekordboxImportDatabase(dbPath);

      if (!result?.success || !result.library) {
        throw new Error(result?.error || 'Failed to import from selected Rekordbox database');
      }

      handleRekordboxDBImport(result.library);
    } catch (err: any) {
      setError(err.message || 'Failed to import from selected Rekordbox database');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI) {
        throw new Error('Electron API not available. Please run the app with: npm run dev');
      }

      const filePath = await window.electronAPI.selectFile();
      if (!filePath) {
        setLoading(false);
        return;
      }

      const result = await window.electronAPI.readFile(filePath);
      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to read file');
      }

      const parsedLibrary = parser.parseXML(result.content);
      setLibrary(parsedLibrary);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleImportFolder = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI) {
        throw new Error('Electron API not available. Please run the app with: npm run dev');
      }

      const folderPath = await window.electronAPI.selectFolder();
      if (!folderPath) {
        setLoading(false);
        return;
      }

      const result = await window.electronAPI.scanFolder(folderPath);
      if (!result.success || !result.library) {
        throw new Error(result.error || 'Failed to scan folder');
      }

      console.log('Scan result:', result.library.tracks.length, 'tracks found');

      if (result.library.tracks.length === 0) {
        setError('No audio files found in selected folder. Supported formats: MP3, FLAC, M4A, WAV, AIFF, OGG, WMA');
        setLoading(false);
        return;
      }

      // Merge with existing library if any, or set new library
      if (library) {
        // Normalize location for comparison
        const normalizeLocation = (loc: string | undefined): string => {
          if (!loc) return '';
          return loc
            .replace(/^file:\/\/localhost/i, '')
            .replace(/^file:\/\//i, '')
            .replace(/\\/g, '/')
            .toLowerCase()
            .trim();
        };
        
        // Create maps for efficient lookup
        const existingLocations = new Set(
          library.tracks.map((t: Track) => normalizeLocation(t.Location))
        );
        const existingTrackIDs = new Set(
          library.tracks.map((t: Track) => t.TrackID)
        );
        
        // Filter out duplicates by both Location and TrackID
        const newTracks = result.library.tracks.filter((t: Track) => {
          const normalizedLoc = normalizeLocation(t.Location);
          return !existingLocations.has(normalizedLoc) && !existingTrackIDs.has(t.TrackID);
        });
        
        console.log(`Folder scan: ${result.library.tracks.length} tracks found, ${newTracks.length} new, ${result.library.tracks.length - newTracks.length} duplicates skipped`);
        
        const mergedLibrary = {
          tracks: [...library.tracks, ...newTracks],
          playlists: [...library.playlists, ...result.library.playlists],
        };
        setLibrary(mergedLibrary);
      } else {
        setLibrary(result.library);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!library) {
      setError('No library loaded');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!window.electronAPI) {
        throw new Error('Electron API not available. Please run the app with: npm run dev');
      }

      const xmlContent = parser.exportToXML(library);
      const result = await window.electronAPI.saveFile(xmlContent);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save file');
      }

      setLastSyncDate(new Date().toISOString());
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleOpenExportModal = () => {
    if (!library) {
      setError('No library loaded');
      return;
    }
    setShowExportModal(true);
  };

  // Drag and Drop handlers for files/folders
  const handleDragEnter = (e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
      dragEnterDepth.current++;
      if (!isDragOver) setIsDragOver(true);
    } catch (_) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  };

  const handleDragLeave = (e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
      dragEnterDepth.current = Math.max(0, dragEnterDepth.current - 1);
      if (dragEnterDepth.current === 0) setIsDragOver(false);
    } catch (_) {}
  };

  const handleDragEnd = (_e: React.DragEvent) => {
    try {
      dragEnterDepth.current = 0;
      setIsDragOver(false);
    } catch (_) {}
  };

  const handleDrop = async (e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
    setIsDragOver(false);

    if (!window.electronAPI) {
      setError('Electron API not available. Please run the app with: npm run dev');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Check if any files are directories or audio files
    const audioExtensions = ['.mp3', '.flac', '.m4a', '.aac', '.wav', '.aiff', '.ogg', '.wma'];
    const hasAudioFiles = files.some(file => audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext)));
    const hasDirectories = files.some(file => file.type === '' || file.type === 'inode/directory');

    if (!hasAudioFiles && !hasDirectories) {
      setError('No audio files or folders found. Supported formats: MP3, FLAC, M4A, WAV, AIFF, OGG, WMA');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (hasDirectories) {
        // Handle directory drops - scan all directories
        for (const file of files) {
          if (file.type === '' || file.type === 'inode/directory') {
            // This is likely a directory in Electron
            // Use webkitRelativePath or construct path from file
            let folderPath = '';
            if ('path' in file && typeof (file as any).path === 'string') {
              // Electron provides the path property
              folderPath = (file as any).path;
            } else if (file.webkitRelativePath) {
              // Web fallback (though we shouldn't reach here in Electron)
              folderPath = file.webkitRelativePath.split('/')[0];
            }

            if (folderPath) {
              const result = await window.electronAPI.scanFolder(folderPath);
              if (result.success && result.library) {
                handleImportResult(result.library);
              }
            }
          }
        }
      } else {
        // Handle individual audio file drops
        const audioFiles = files.filter(file =>
          audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );

        if (audioFiles.length > 0) {
          // Get the parent directory of the first file
          let tempFolderPath = '';
          const firstFile = audioFiles[0];

          if ('path' in firstFile && typeof (firstFile as any).path === 'string') {
            // Electron provides the path property
            const filePath = (firstFile as any).path;
            tempFolderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          }

          if (tempFolderPath) {
            const result = await window.electronAPI.scanFolder(tempFolderPath);
            if (result.success && result.library) {
              // Filter to only include the dropped files
              const droppedFileNames = audioFiles.map(f => f.name);
              const filteredTracks = result.library.tracks.filter((track: Track) =>
                droppedFileNames.includes(track.Name + getFileExtension(track.Location || ''))
              );

              const filteredLibrary = {
                tracks: filteredTracks,
                playlists: result.library.playlists
              };

              handleImportResult(filteredLibrary);
            }
          }
        }
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getFileExtension = (location: string): string => {
    const parts = location.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
  };

  const handleImportResult = (importedLibrary: any) => {
    // Merge with existing library if any, or set new library
    if (library) {
      // Normalize location for comparison
      const normalizeLocation = (loc: string | undefined): string => {
        if (!loc) return '';
        return loc
          .replace(/^file:\/\/localhost/i, '')
          .replace(/^file:\/\//i, '')
          .replace(/\\/g, '/')
          .toLowerCase()
          .trim();
      };

      // Create maps for efficient lookup
      const existingLocations = new Set(
        library.tracks.map((t: Track) => normalizeLocation(t.Location))
      );
      const existingTrackIDs = new Set(
        library.tracks.map((t: Track) => t.TrackID)
      );

      // Filter out duplicates by both Location and TrackID
      const newTracks = importedLibrary.tracks.filter((t: Track) => {
        const normalizedLoc = normalizeLocation(t.Location);
        return !existingLocations.has(normalizedLoc) && !existingTrackIDs.has(t.TrackID);
      });

      console.log(`Drag & drop: ${importedLibrary.tracks.length} tracks found, ${newTracks.length} new, ${importedLibrary.tracks.length - newTracks.length} duplicates skipped`);

      const mergedLibrary = {
        tracks: [...library.tracks, ...newTracks],
        playlists: [...library.playlists, ...importedLibrary.playlists],
      };
      setLibrary(mergedLibrary);
    } else {
      setLibrary(importedLibrary);
    }
  };

  return (
    <div
      className={`app ${isDragOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
    >
      <Header
        onImport={handleImport}
        onImportFolder={handleImportFolder}
        onExport={handleOpenExportModal}
        onSettings={() => setShowSettingsModal(true)}
        onDatabase={() => setShowRekordboxDBModal(true)}
        loading={loading}
        hasLibrary={!!library}
        onQuickTag={() => setMode('quickTag')}
        isQuickTagMode={mode === 'quickTag'}
      />
      
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {mode === 'library' && !library && !loading && (
        <div className="welcome">
          <div className="welcome-content">
            <div className="welcome-hero">
              <h1>Bonk!</h1>
              <p className="welcome-tagline">Music metadata editor for Rekordbox</p>
            </div>

            <div className="welcome-actions">
              <div className="welcome-card welcome-card-primary">
                <h2>Rekordbox Database</h2>
                <p>Quickly import from your Rekordbox master.db, or choose a custom database path.</p>
                <div className="welcome-card-buttons">
                  <button className="import-btn-large" onClick={handleQuickRekordboxImport} disabled={loading}>
                    <Database size={22} />
                    <span>Import from Rekordbox DB</span>
                  </button>
                  <button
                    className="import-btn-large import-btn-secondary"
                    onClick={handleCustomRekordboxImport}
                    disabled={loading}
                  >
                    <Archive size={22} />
                    <span>Import from Custom DB Path</span>
                  </button>
                </div>
              </div>

              <div className="welcome-card">
                <h2>Other import options</h2>
                <div className="welcome-card-buttons welcome-card-buttons-row">
                  <button className="welcome-btn-secondary" onClick={handleImport}>
                    <FileText size={20} />
                    <span>Import XML</span>
                  </button>
                  <button className="welcome-btn-secondary" onClick={handleImportFolder}>
                    <FolderOpen size={20} />
                    <span>Import Folder</span>
                  </button>
                </div>
              </div>

              <div className="welcome-utilities">
                <button className="welcome-link" onClick={() => openAutoTagWizard()}>
                  <Sparkles size={16} />
                  Auto Tag
                </button>
                <span className="welcome-util-sep">·</span>
                <button className="welcome-link" onClick={() => setShowAudioFeaturesWizard(true)}>
                  <Activity size={16} />
                  Audio Features
                </button>
                <span className="welcome-util-sep">·</span>
                <button className="welcome-link" onClick={() => setShowTagsManagementSuite(true)}>
                  <Tag size={16} />
                  Manage Tags
                </button>
                <span className="welcome-util-sep">·</span>
                <button className="welcome-link" onClick={() => setShowGenreManagementSuite(true)}>
                  <Music size={16} />
                  Manage Genres
                </button>
              </div>
            </div>

            <p className="welcome-hint">
              Drag & drop XML or folders anywhere to import
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {mode === 'library' && library && !loading && (
        <div className="main-content with-sidebar">
          <PlaylistSidebar
            playlists={library.playlists}
            onPlaylistSelect={setSelectedPlaylist}
            selectedPlaylist={selectedPlaylist}
            trackCount={library.tracks.length}
            onAddTracksToPlaylist={addTracksToPlaylist}
            onCreatePlaylist={createPlaylist}
            onCreateFolder={createFolder}
            onRenamePlaylist={renamePlaylist}
            onDeletePlaylist={deletePlaylist}
            onDuplicatePlaylist={duplicatePlaylist}
            onCreateSmartPlaylist={createSmartPlaylist}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            showMissingOnly={showMissingOnly}
            onToggleMissingOnly={() => setShowMissingOnly(!showMissingOnly)}
            missingCount={library.tracks.filter(t => t.isMissing).length}
            onDeleteMissingTracks={() => {
              const missingTrackIds = library.tracks
                .filter(t => t.isMissing)
                .map(t => t.TrackID);
              deleteTracks(missingTrackIds);
              setShowMissingOnly(false);
            }}
          />
          <div className="content-wrapper">
            <div className="left-panel">
              <SearchBar />
              <TrackTable />
            </div>
            {selectedTrack && (
              <div className="right-panel">
                <TrackEditor />
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'quickTag' && !loading && (
        <QuickTagScreen />
      )}

      {showExportModal && library && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          trackCount={library.tracks.length}
        />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showRekordboxDBModal && (
        <RekordboxDBModal
          onClose={() => setShowRekordboxDBModal(false)}
          onImport={handleRekordboxDBImport}
          onSync={handleRekordboxDBSync}
          currentLibrary={library}
        />
      )}

      {showTagsManagementSuite && (
        <TagsManagementSuite
          isOpen={showTagsManagementSuite}
          onClose={() => setShowTagsManagementSuite(false)}
        />
      )}

      {showGenreManagementSuite && (
        <GenreManagementSuite
          isOpen={showGenreManagementSuite}
          onClose={() => setShowGenreManagementSuite(false)}
        />
      )}

      {showAutoTagWizard && <AutoTagWizard />}
      
      <AudioFeaturesWizard
        isOpen={showAudioFeaturesWizard}
        onClose={() => setShowAudioFeaturesWizard(false)}
        selectedFiles={library?.Tracks?.map((t: Track) => t.Location?.replace('file://localhost', '')) || []}
      />

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </div>
  );
}

export default App;

