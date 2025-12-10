import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import TrackContextMenu from './TrackContextMenu';
import FindTagsModal from './FindTagsModal';
import TrackTableToolbar from './TrackTableToolbar';
import DuplicateDetectionModal from './DuplicateDetectionModal';
import BatchRenameModal from './BatchRenameModal';
import FormatConversionModal, { FormatConversion } from './FormatConversionModal';
import FindLostTracksModal from './FindLostTracksModal';
import { TagFinderOptions } from '../types/musicDatabase';
import { Track } from '../types/track';

// Memoized TrackRow component to prevent unnecessary re-renders
const TrackRow = memo(({ 
  track, 
  isSelected, 
  isMultiSelected, 
  onRowClick, 
  onContextMenu, 
  onDragStart,
  onToggleSelection,
  renderEditableCell,
  formatTime
}: {
  track: Track;
  isSelected: boolean;
  isMultiSelected: boolean;
  onRowClick: (track: Track, e: React.MouseEvent) => void;
  onContextMenu: (track: Track, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, track: Track) => void;
  onToggleSelection: (trackId: string) => void;
  renderEditableCell: (track: Track, field: string, value: string, className?: string) => JSX.Element;
  formatTime: (ms: string | undefined) => string;
}) => {
  const bpmValue = useMemo(() => 
    track.AverageBpm ? parseFloat(track.AverageBpm).toFixed(1) : '', 
    [track.AverageBpm]
  );

  return (
    <tr
      className={`${isSelected ? 'selected' : ''} ${
        isMultiSelected ? 'multi-selected' : ''
      } ${track.isMissing ? 'missing-track' : ''}`}
      onClick={(e) => onRowClick(track, e)}
      onContextMenu={(e) => onContextMenu(track, e)}
      draggable={!track.isMissing}
      onDragStart={(e) => onDragStart(e, track)}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isMultiSelected}
          onChange={() => onToggleSelection(track.TrackID)}
        />
      </td>
      <td className="album-art-cell">
        {track.AlbumArt ? (
          <img 
            src={track.AlbumArt} 
            alt="Album Art" 
            className="album-art-thumb"
            title={track.Album || 'Album Art'}
            loading="lazy"
          />
        ) : (
          <div className="album-art-placeholder">♪</div>
        )}
      </td>
      {renderEditableCell(track, 'Name', track.Name || 'Unknown', 'track-name')}
      {renderEditableCell(track, 'Artist', track.Artist || 'Unknown Artist')}
      {renderEditableCell(track, 'Album', track.Album || '')}
      {renderEditableCell(track, 'Genre', track.Genre || '')}
      {renderEditableCell(track, 'AverageBpm', bpmValue)}
      {renderEditableCell(track, 'Key', track.Key || '')}
      <td>{formatTime(track.TotalTime)}</td>
      {renderEditableCell(track, 'Year', track.Year || '')}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.track.TrackID === nextProps.track.TrackID &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isMultiSelected === nextProps.isMultiSelected &&
    prevProps.track.Name === nextProps.track.Name &&
    prevProps.track.Artist === nextProps.track.Artist &&
    prevProps.track.Album === nextProps.track.Album &&
    prevProps.track.AverageBpm === nextProps.track.AverageBpm &&
    prevProps.track.Key === nextProps.track.Key &&
    prevProps.track.AlbumArt === nextProps.track.AlbumArt &&
    prevProps.track.isMissing === nextProps.track.isMissing
  );
});

TrackRow.displayName = 'TrackRow';

export default function TrackTable() {
  const {
    filteredTracks,
    selectedTrack,
    selectedTracks,
    setSelectedTrack,
    toggleTrackSelection,
    selectAll,
    clearSelection,
    library,
    checkMissingTracks,
    deleteTracks,
    renameTracks,
    convertTrackFormats,
  } = useLibraryStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track?: typeof filteredTracks[0] } | null>(null);
  const [showFindTagsModal, setShowFindTagsModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showBatchRenameModal, setShowBatchRenameModal] = useState(false);
  const [showFormatConversionModal, setShowFormatConversionModal] = useState(false);
  const [showFindLostTracksModal, setShowFindLostTracksModal] = useState(false);
  const [modalTrack, setModalTrack] = useState<typeof filteredTracks[0] | null>(null);
  const [editingCell, setEditingCell] = useState<{ trackId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isCheckingMissing, setIsCheckingMissing] = useState(false);

  // Memoize formatTime to avoid recalculating on every render
  const formatTime = useCallback((ms: string | undefined) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(parseInt(ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleRowClick = (track: typeof filteredTracks[0], e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select with Cmd/Ctrl
      toggleTrackSelection(track.TrackID);
    } else if (e.shiftKey) {
      // Could implement range selection here
      toggleTrackSelection(track.TrackID);
    } else {
      // Single select
      setSelectedTrack(track);
    }
  };

  const handleContextMenu = (track: typeof filteredTracks[0], e: React.MouseEvent) => {
    e.preventDefault();
    // Set the right-clicked track along with position
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY,
      track: track
    });
  };

  const handleCellDoubleClick = (track: typeof filteredTracks[0], field: string) => {
    setEditingCell({ trackId: track.TrackID, field });
    setEditValue((track as any)[field] || '');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      // Save the edited value
      updateTrack(editingCell.trackId, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleDragStart = (e: React.DragEvent, track: typeof filteredTracks[0]) => {
    // Get all selected track IDs, or just the dragged track if not selected
    const trackIds = selectedTracks.has(track.TrackID)
      ? Array.from(selectedTracks)
      : [track.TrackID];
    
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({ trackIds }));
  };

  // Memoize renderEditableCell to prevent unnecessary re-renders
  const renderEditableCell = useCallback((track: typeof filteredTracks[0], field: string, value: string, className?: string) => {
    const isEditing = editingCell?.trackId === track.TrackID && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <td className={className} onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleCellKeyDown}
            autoFocus
            className="cell-editor"
          />
        </td>
      );
    }
    
    return (
      <td
        className={className}
        onDoubleClick={() => handleCellDoubleClick(track, field)}
        title="Double-click to edit"
      >
        {value || '-'}
      </td>
    );
  }, [editingCell, editValue, handleCellBlur, handleCellKeyDown, handleCellDoubleClick]);

  const { tagWriteSettings } = useSettingsStore();
  const { updateTrack } = useLibraryStore();

  const handleWriteTags = async (track?: typeof filteredTracks[0]) => {
    // If a specific track is provided (right-click), use it; otherwise use selected tracks
    const tracksToWrite = track 
      ? [track] 
      : Array.from(selectedTracks).map((id) => filteredTracks.find((t) => t.TrackID === id)).filter(Boolean);

    if (tracksToWrite.length === 0) {
      alert('No tracks to write');
      return;
    }

    // Safety warning
    const confirmed = window.confirm(
      `⚠️ BACKUP WARNING\n\n` +
      `You are about to write tags to ${tracksToWrite.length} audio file(s).\n\n` +
      `This will permanently modify the files.\n` +
      `Make sure you have BACKUPS before proceeding!\n\n` +
      `Corrupted files will be automatically skipped.\n\n` +
      `Continue?`
    );
    
    if (!confirmed) {
      return;
    }

    if (!window.electronAPI?.writeTags) {
      alert('Write Tags feature not available');
      return;
    }

    try {
      const result = await window.electronAPI.writeTags(tracksToWrite, tagWriteSettings);
      if (result.success) {
        const message = `Successfully wrote tags to ${result.count} file(s)`;
        const errorInfo = result.errors ? `\n\nErrors:\n${result.errors.join('\n')}` : '';
        alert(message + errorInfo);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error writing tags: ${error.message}`);
    }
  };

  const handleDetectKeys = async (track?: typeof filteredTracks[0]) => {
    // If a specific track is provided (right-click), use it; otherwise use selected tracks
    const tracksToAnalyze = track 
      ? [track] 
      : Array.from(selectedTracks).map((id) => filteredTracks.find((t) => t.TrackID === id)).filter(Boolean);

    if (tracksToAnalyze.length === 0) {
      alert('No tracks to analyze');
      return;
    }

    if (!window.electronAPI?.detectKey) {
      alert('Key detection feature not available');
      return;
    }

    try {
      let successCount = 0;
      let metadataCount = 0;
      let guessCount = 0;
      let skippedCount = 0;
      const errors = [];
      const noKeys = [];

      for (const track of tracksToAnalyze) {
        if (!track || !track.Location) {
          continue;
        }
        try {
          console.log('Detecting key for:', track.Name);
          const result = await window.electronAPI.detectKey(track.Location);
          console.log('Key detection result:', result);
          
          if (result.success && result.key) {
            // Update track with detected key
            updateTrack(track.TrackID, { Tonality: result.key, Key: result.key });
            successCount++;
            
            if (result.method === 'metadata') {
              metadataCount++;
            } else if (result.method === 'analysis') {
              guessCount++;
            }
          } else if (result.method === 'skipped') {
            skippedCount++;
          } else {
            noKeys.push(track.Name);
          }
        } catch (error: any) {
          console.error('Key detection error:', error);
          errors.push(`${track.Name}: ${error.message}`);
        }
      }

      let message = `Key Detection Results:\n`;
      message += `✓ ${successCount} of ${tracksToAnalyze.length} tracks updated\n`;
      if (metadataCount > 0) message += `  - ${metadataCount} from file metadata (high confidence)\n`;
      if (guessCount > 0) message += `  - ${guessCount} from KeyFinder analysis (high confidence)\n`;
      if (skippedCount > 0) message += `\n⚠ ${skippedCount} tracks skipped (corrupted/invalid file format)`;
      if (noKeys.length > 0) message += `\n✗ ${noKeys.length} tracks: No key detected`;
      
      const errorInfo = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
      alert(message + errorInfo);
    } catch (error: any) {
      alert(`Error detecting keys: ${error.message}`);
    }
  };

  const handleFindTags = async (options: TagFinderOptions, track?: typeof filteredTracks[0]) => {
    // If a specific track is provided (right-click), use it; otherwise use selected tracks
    const tracksToSearch = track 
      ? [track] 
      : Array.from(selectedTracks).map((id) => filteredTracks.find((t) => t.TrackID === id)).filter(Boolean);

    if (tracksToSearch.length === 0) {
      alert('No tracks to search');
      return;
    }

    if (!window.electronAPI?.findTags) {
      alert('Find Tags feature not available');
      return;
    }

    try {
      // Get credentials from settings store
      const { apiCredentials } = useSettingsStore.getState();
      
      // Merge credentials into options
      const optionsWithCredentials = {
        ...options,
        spotifyClientId: apiCredentials.spotifyClientId,
        spotifyClientSecret: apiCredentials.spotifyClientSecret,
        discogsToken: apiCredentials.discogsToken,
      };
      
      const result = await window.electronAPI.findTags(tracksToSearch, optionsWithCredentials);
      
      if (result.success) {
        const message = `Successfully updated ${result.tracksUpdated} of ${tracksToSearch.length} track(s)\nSkipped: ${result.tracksSkipped}`;
        const errorInfo = result.errors && result.errors.length > 0 
          ? `\n\nErrors:\n${result.errors.map((e: any) => `${e.track}: ${e.error}`).join('\n')}`
          : '';
        alert(message + errorInfo);
        
        // Refresh the library to show updated metadata
        // In a real app, you'd reload the tracks from disk
      } else {
        alert('Failed to find tags');
      }
    } catch (error: any) {
      alert(`Error finding tags: ${error.message}`);
    }
  };

  const handleDiscardChanges = async (track?: typeof filteredTracks[0]) => {
    // If a specific track is provided (right-click), use it; otherwise use selected tracks
    const tracksToReload = track 
      ? [track] 
      : Array.from(selectedTracks).map((id) => filteredTracks.find((t) => t.TrackID === id)).filter(Boolean);

    if (tracksToReload.length === 0) {
      alert('No tracks to reload');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Discard Changes?\n\n` +
      `This will reload ${tracksToReload.length} track(s) from the audio file(s).\n` +
      `Any unsaved changes will be lost.\n\n` +
      `Continue?`
    );

    if (!confirmed) {
      return;
    }

    if (!window.electronAPI?.reloadTrack) {
      alert('Reload feature not available');
      return;
    }

    try {
      let successCount = 0;
      const errors = [];

      for (const track of tracksToReload) {
        if (!track || !track.Location) {
          continue;
        }
        try {
          const reloadedTrack = await window.electronAPI.reloadTrack(track.Location);
          
          if (reloadedTrack) {
            // Keep the original TrackID but update all other fields
            updateTrack(track.TrackID, reloadedTrack);
            successCount++;
          } else {
            errors.push(`${track.Name || 'Unknown'}: Failed to reload`);
          }
        } catch (error: any) {
          console.error('Reload error:', error);
          errors.push(`${track.Name || 'Unknown'}: ${error.message}`);
        }
      }

      let message = `Reload Results:\n`;
      message += `✓ ${successCount} of ${tracksToReload.length} tracks reloaded from files\n`;
      
      const errorInfo = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
      alert(message + errorInfo);
    } catch (error: any) {
      alert(`Error reloading tracks: ${error.message}`);
    }
  };

  // Keyboard shortcuts (moved here to avoid hoisting issues)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+A - Select All
      if (cmdOrCtrl && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Escape - Clear Selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        setContextMenu(null);
        setShowFindTagsModal(false);
      }

      // Only allow shortcuts if tracks are selected
      if (selectedTracks.size === 0) return;

      // Cmd/Ctrl+K - Detect Keys
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        handleDetectKeys();
      }

      // Cmd/Ctrl+F - Find Tags
      if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        setShowFindTagsModal(true);
      }

      // Cmd/Ctrl+W - Write Tags
      if (cmdOrCtrl && e.key === 'w') {
        e.preventDefault();
        handleWriteTags();
      }

      // Cmd/Ctrl+Z - Discard Changes
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleDiscardChanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTracks, selectAll, clearSelection, handleDetectKeys, handleWriteTags, handleDiscardChanges]);

  // Removed debug logs for better performance

  return (
    <div className="track-table-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <TrackTableToolbar
        selectedCount={selectedTracks.size}
        totalCount={filteredTracks.length}
        missingCount={filteredTracks.filter(t => t.isMissing).length}
        isCheckingMissing={isCheckingMissing}
        onDetectKeys={() => handleDetectKeys()}
        onFindTags={() => setShowFindTagsModal(true)}
        onWriteTags={() => handleWriteTags()}
        onDiscardChanges={() => handleDiscardChanges()}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onCheckMissing={async () => {
          setIsCheckingMissing(true);
          try {
            await checkMissingTracks();
          } finally {
            setIsCheckingMissing(false);
          }
        }}
        onFindDuplicates={() => setShowDuplicateModal(true)}
        onBatchRename={() => setShowBatchRenameModal(true)}
        onConvertFormat={() => setShowFormatConversionModal(true)}
        onFindLostTracks={() => setShowFindLostTracksModal(true)}
      />
      
      <div className="track-table-container">
        {filteredTracks.length > 0 ? (
          <table className="track-table">
          <thead>
          <tr>
            <th style={{ width: '40px' }}>
              <input
                type="checkbox"
                checked={selectedTracks.size === filteredTracks.length && filteredTracks.length > 0}
                onChange={() => {
                  if (selectedTracks.size === filteredTracks.length) {
                    clearSelection();
                  } else {
                    selectAll();
                  }
                }}
              />
            </th>
            <th style={{ width: '60px' }}>Art</th>
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Genre</th>
            <th>BPM</th>
            <th>Key</th>
            <th>Time</th>
            <th>Year</th>
          </tr>
        </thead>
        <tbody>
          {filteredTracks.map((track) => {
            const isSelected = selectedTrack?.TrackID === track.TrackID;
            const isMultiSelected = selectedTracks.has(track.TrackID);
            
            return (
              <TrackRow
                key={track.TrackID}
                track={track}
                isSelected={isSelected}
                isMultiSelected={isMultiSelected}
                onRowClick={handleRowClick}
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
                onToggleSelection={toggleTrackSelection}
                renderEditableCell={renderEditableCell}
                formatTime={formatTime}
              />
            );
          })}
        </tbody>
        </table>
        ) : (
          <div className="empty-state">
            <p>No tracks found</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <TrackContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={contextMenu.track}
          onClose={() => setContextMenu(null)}
          onWriteTags={() => handleWriteTags(contextMenu.track)}
          onDetectKeys={() => handleDetectKeys(contextMenu.track)}
          onFindTags={() => {
            // Store the track before closing context menu
            setModalTrack(contextMenu.track || null);
            setShowFindTagsModal(true);
          }}
          onDiscardChanges={() => handleDiscardChanges(contextMenu.track)}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          selectedCount={selectedTracks.size}
        />
      )}

      {showFindTagsModal && (
        <FindTagsModal
          onClose={() => {
            setShowFindTagsModal(false);
            setModalTrack(null);
          }}
          onStart={(options) => handleFindTags(options, modalTrack || undefined)}
          trackCount={modalTrack ? 1 : selectedTracks.size}
        />
      )}

      {showDuplicateModal && (
        <DuplicateDetectionModal
          tracks={library?.tracks || []}
          onClose={() => setShowDuplicateModal(false)}
          onDeleteTracks={deleteTracks}
        />
      )}

      {showBatchRenameModal && (
        <BatchRenameModal
          tracks={library?.tracks || []}
          onClose={() => setShowBatchRenameModal(false)}
          onRenameTracks={renameTracks}
        />
      )}

      {showFormatConversionModal && (
        <FormatConversionModal
          tracks={
            selectedTracks.size > 0
              ? Array.from(selectedTracks)
                  .map((id) => filteredTracks.find((t) => t.TrackID === id))
                  .filter(Boolean) as typeof filteredTracks
              : filteredTracks
          }
          onClose={() => setShowFormatConversionModal(false)}
          onConvert={(conversions: FormatConversion[]) => {
            convertTrackFormats(
              conversions.map((c) => ({
                trackId: c.trackId,
                newKind: c.newKind,
                newLocation: c.newLocation,
              }))
            );
          }}
        />
      )}

      {showFindLostTracksModal && (
        <FindLostTracksModal
          onClose={() => setShowFindLostTracksModal(false)}
        />
      )}
    </div>
  );
}

