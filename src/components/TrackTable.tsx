import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAutoTagStore } from '../store/useAutoTagStore';
import { useColumnStore } from '../store/useColumnStore';
import TrackContextMenu from './TrackContextMenu';
import TrackTableToolbar from './TrackTableToolbar';
import TrackTableHeader from './TrackTableHeader';
import { TrackTableRow } from './TrackTableRow';
import TagsModal from './TagsModal';
import TagSelectorModal from './TagSelectorModal';
import BatchTagUpdateModal from './BatchTagUpdateModal';
import BatchGenreUpdateModal from './BatchGenreUpdateModal';
import DuplicateDetectionModal from './DuplicateDetectionModal';
import BatchRenameModal from './BatchRenameModal';
import FormatConversionModal, { FormatConversion } from './FormatConversionModal';
import FindLostTracksModal from './FindLostTracksModal';
import RemoveFromPlaylistModal from './RemoveFromPlaylistModal';
import SmartFixesModal, { SmartFixConfig } from './SmartFixesModal';
import DeleteTracksModal from './DeleteTracksModal';
const AudioFeaturesWizard = lazy(() => import('./AudioFeaturesWizard'));
import { Track } from '../types/track';

// Constants for virtual scrolling
const OVERSCAN_COUNT = 10; // Render extra rows above/below viewport for smoother scrolling

export default function TrackTable() {
  const {
    filteredTracks,
    selectedTrack,
    selectedTracks,
    selectedPlaylist,
    setSelectedTrack,
    setAuditionTrackId,
    toggleTrackSelection,
    selectAll,
    clearSelection,
    library,
    checkMissingTracks,
    deleteTracks,
    renameTracks,
    convertTrackFormats,
    removeTracksFromPlaylist,
    applySmartFixes,
    updateTrack,
  } = useLibraryStore();

  const { skipPlaylistRemovalConfirm, setSkipPlaylistRemovalConfirm } = useSettingsStore();
  const { openModal: openAutoTagWizard } = useAutoTagStore();
  const { columns, columnOrder, fontSize, density } = useColumnStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track?: typeof filteredTracks[0] } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showBatchRenameModal, setShowBatchRenameModal] = useState(false);
  const [showFormatConversionModal, setShowFormatConversionModal] = useState(false);
  const [showFindLostTracksModal, setShowFindLostTracksModal] = useState(false);
  const [showRemoveFromPlaylistModal, setShowRemoveFromPlaylistModal] = useState(false);
  const [showSmartFixesModal, setShowSmartFixesModal] = useState(false);
  const [showAudioFeaturesWizard, setShowAudioFeaturesWizard] = useState(false);
  const [audioFeaturesFiles, setAudioFeaturesFiles] = useState<string[]>([]);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showBatchTagUpdateModal, setShowBatchTagUpdateModal] = useState(false);
  const [showBatchGenreUpdateModal, setShowBatchGenreUpdateModal] = useState(false);
  const [showDeleteTracksModal, setShowDeleteTracksModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [tagSelectorTrack, setTagSelectorTrack] = useState<Track | null>(null);
  const [editingCell, setEditingCell] = useState<{ trackId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isCheckingMissing, setIsCheckingMissing] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Derived state for layout
  const visibleColumns = useMemo(() => {
    return columnOrder
      .map(id => columns.find(c => c.id === id))
      .filter((c): c is typeof columns[0] => !!c && c.visible);
  }, [columns, columnOrder]);

  const gridTemplate = useMemo(() => {
    return visibleColumns.map(c => c.width).join(' ');
  }, [visibleColumns]);

  const rowHeight = useMemo(() => {
    switch (fontSize) {
      case 'small': return 44;
      case 'large': return 56;
      default: return 50;
    }
  }, [fontSize]);

  // Virtual scrolling setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_COUNT,
  });

  const requestDeleteTracks = (trackIds: string[]) => {
    if (!trackIds.length) return;
    setPendingDeleteIds(trackIds);
    setShowDeleteTracksModal(true);
  };

  // Memoize formatTime to avoid recalculating on every render
  const formatTime = useCallback((ms: string | undefined) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(parseInt(ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleRowClick = (track: Track, index: number, e: React.MouseEvent) => {
    const idx = index;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedTrack(track);
      setAuditionTrackId(track.TrackID);
      setLastClickedIndex(idx);
      return;
    }
    if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
      if (lastClickedIndex === null) {
        toggleTrackSelection(track.TrackID);
        setLastClickedIndex(idx);
        return;
      }
      const start = Math.min(lastClickedIndex, idx);
      const end = Math.max(lastClickedIndex, idx);
      const idsInRange = filteredTracks.slice(start, end + 1).map((t) => t.TrackID);
      idsInRange.forEach((id) => {
        if (!selectedTracks.has(id)) toggleTrackSelection(id);
      });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      toggleTrackSelection(track.TrackID);
      setLastClickedIndex(idx);
      return;
    }
    setSelectedTrack(track);
    setAuditionTrackId(null);
    setLastClickedIndex(idx);
  };

  const handleContextMenu = (track: Track, e: React.MouseEvent) => {
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

  const handleDragStart = (e: React.DragEvent, track: Track) => {
    // Get all selected track IDs, or just the dragged track if not selected
    const trackIds = selectedTracks.has(track.TrackID)
      ? Array.from(selectedTracks)
      : [track.TrackID];
    
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({ trackIds }));
  };

  // Memoize renderEditableCell to prevent unnecessary re-renders
  // Note: renderEditableCell has been moved to TrackTableRow component logic

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

  const handleRemoveFromPlaylist = (track?: typeof filteredTracks[0]) => {
    if (!selectedPlaylist) return;

    // Get track IDs to remove
    const trackIds = track
      ? [track.TrackID]
      : Array.from(selectedTracks);

    if (trackIds.length === 0) return;

    // Check if we should skip confirmation
    if (skipPlaylistRemovalConfirm) {
      // Remove tracks from playlist without confirmation
      removeTracksFromPlaylist(selectedPlaylist.Name, trackIds);
      return;
    }

    // Show confirmation modal
    setShowRemoveFromPlaylistModal(true);
  };

  const handleConfirmRemoveFromPlaylist = (alsoDeleteFromLibrary: boolean) => {
    if (!selectedPlaylist) return;

    const trackIds = selectedTracks.size > 0
      ? Array.from(selectedTracks)
      : []; // This shouldn't happen, but safety check

    if (trackIds.length === 0) return;

    // Remove from playlist
    removeTracksFromPlaylist(selectedPlaylist.Name, trackIds);

    // If also deleting from library, do that too
    if (alsoDeleteFromLibrary) {
      deleteTracks(trackIds);
    }

    // Clear selection after removal
    clearSelection();
  };

  const handleSmartFixes = async (config: SmartFixConfig) => {
    try {
      const trackIds = selectedTracks.size > 0 ? Array.from(selectedTracks) : filteredTracks.map(t => t.TrackID);
      const result = await applySmartFixes(trackIds, config);

      if (result.updated > 0) {
        alert(`Successfully applied smart fixes to ${result.updated} track${result.updated !== 1 ? 's' : ''}!`);
      } else {
        alert('No tracks were modified by the selected fixes.');
      }
    } catch (error) {
      alert(`Error applying smart fixes: ${error}`);
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
      // Ignore key events from inputs to avoid conflicting with typing/editing
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

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
      }

      // Only allow shortcuts if tracks are selected
      if (selectedTracks.size === 0) return;

      // Cmd/Ctrl+K - Detect Keys
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        handleDetectKeys();
      }

      // Cmd/Ctrl+Z - Discard Changes
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleDiscardChanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTracks, selectAll, clearSelection, handleDetectKeys, handleDiscardChanges]);

  const handleTagClick = useCallback((track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setTagSelectorTrack(track);
  }, []);

  // Removed debug logs for better performance

  return (
    <div className="track-table-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <TrackTableToolbar
        selectedCount={selectedTracks.size}
        totalCount={filteredTracks.length}
        missingCount={filteredTracks.filter(t => t.isMissing).length}
        isCheckingMissing={isCheckingMissing}
        onDetectKeys={() => handleDetectKeys()}
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
        onSmartFixes={() => setShowSmartFixesModal(true)}
        onManageTags={() => setShowTagsModal(true)}
        onBatchUpdateTags={() => setShowBatchTagUpdateModal(true)}
        onBatchUpdateGenres={() => setShowBatchGenreUpdateModal(true)}
        onDeleteSelected={() => requestDeleteTracks(Array.from(selectedTracks))}
        onAutoTag={() => {
          // Get file paths for selected tracks
          const selectedTrackPaths = filteredTracks
            .filter(t => selectedTracks.has(t.TrackID))
            .map(t => {
              if (!t.Location) return null;
              let p = t.Location;
              if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', '/');
              else if (p.startsWith('file://')) p = p.replace('file://', '');
              try { return decodeURIComponent(p); } catch { return p; }
            })
            .filter((p): p is string => p !== null);
          openAutoTagWizard(selectedTrackPaths);
        }}
        onAudioFeatures={() => {
          // Get file paths for selected tracks
          const selectedTrackPaths = filteredTracks
            .filter(t => selectedTracks.has(t.TrackID))
            .map(t => {
              if (!t.Location) return null;
              let p = t.Location;
              if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', '/');
              else if (p.startsWith('file://')) p = p.replace('file://', '');
              try { return decodeURIComponent(p); } catch { return p; }
            })
            .filter((p): p is string => p !== null);
          setAudioFeaturesFiles(selectedTrackPaths);
          setShowAudioFeaturesWizard(true);
        }}
      />
      
      <div className="track-table-container">
        {filteredTracks.length > 0 && (
          <div style={{ width: '100%' }}>
            <TrackTableHeader />

            {/* Virtualized track list for optimal performance with large libraries */}
            <div 
              ref={parentRef}
              className={`track-table-rows density-${density}`}
              style={{ 
                height: 'calc(100vh - 280px)', // Dynamic height based on viewport
                minHeight: 400,
                maxHeight: 'calc(100vh - 280px)',
                overflowY: 'auto',
                contain: 'strict', // Performance optimization for scrolling
              }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const track = filteredTracks[virtualRow.index];
                  if (!track) return null;
                  
                  const isSelected = selectedTrack?.TrackID === track.TrackID;
                  const isMultiSelected = selectedTracks.has(track.TrackID);

                  return (
                    <TrackTableRow
                      key={track.TrackID || virtualRow.index}
                      track={track}
                      index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        gridTemplateColumns: gridTemplate,
                      }}
                      isSelected={isSelected}
                      isMultiSelected={isMultiSelected}
                      visibleColumns={visibleColumns}
                      fontSize={fontSize}
                      editingCell={editingCell}
                      editValue={editValue}
                      onRowClick={handleRowClick}
                      onContextMenu={handleContextMenu}
                      onDragStart={handleDragStart}
                      onToggleSelection={toggleTrackSelection}
                      onCellDoubleClick={handleCellDoubleClick}
                      onCellBlur={handleCellBlur}
                      onCellKeyDown={handleCellKeyDown}
                      onEditValueChange={setEditValue}
                      onTagClick={handleTagClick}
                      formatTime={formatTime}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {!filteredTracks.length && (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', color: 'var(--text-secondary)' }}>
            {searchQuery ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Search size={48} style={{ opacity: 0.2 }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>No results found</h3>
                <p>No tracks match "{searchQuery}"</p>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setSearchQuery('')}
                  style={{ marginTop: 16 }}
                >
                  Clear Search
                </button>
              </>
            ) : showMissingOnly ? (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>No missing tracks</h3>
                <p>All tracks in your library can be located.</p>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowMissingOnly(false)}
                  style={{ marginTop: 16 }}
                >
                  Show All Tracks
                </button>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>No tracks found</h3>
                <p>Drag and drop files or folders to get started.</p>
              </>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <TrackContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={contextMenu.track}
          onClose={() => setContextMenu(null)}
          onDetectKeys={() => handleDetectKeys(contextMenu.track)}
          onDiscardChanges={() => handleDiscardChanges(contextMenu.track)}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          selectedCount={selectedTracks.size}
          selectedPlaylist={selectedPlaylist}
          onRemoveFromPlaylist={() => handleRemoveFromPlaylist(contextMenu.track)}
          onDeleteTracks={() => {
            const tracksToDelete = selectedTracks.size > 0 
              ? Array.from(selectedTracks) 
              : contextMenu.track ? [contextMenu.track.TrackID] : [];
            
            requestDeleteTracks(tracksToDelete);
          }}
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

      {showRemoveFromPlaylistModal && selectedPlaylist && (
        <RemoveFromPlaylistModal
          isOpen={showRemoveFromPlaylistModal}
          onClose={() => setShowRemoveFromPlaylistModal(false)}
          onConfirm={handleConfirmRemoveFromPlaylist}
          trackCount={selectedTracks.size}
          playlistName={selectedPlaylist.Name}
          skipConfirm={skipPlaylistRemovalConfirm}
          onSetSkipConfirm={setSkipPlaylistRemovalConfirm}
        />
      )}

      {showSmartFixesModal && (
        <SmartFixesModal
          isOpen={showSmartFixesModal}
          onClose={() => setShowSmartFixesModal(false)}
          selectedTracks={Array.from(selectedTracks)}
          totalTracks={filteredTracks.length}
          onApplyFixes={handleSmartFixes}
        />
      )}

      {showTagsModal && (
        <TagsModal
          isOpen={showTagsModal}
          onClose={() => setShowTagsModal(false)}
        />
      )}

      {tagSelectorTrack && (
        <TagSelectorModal
          isOpen={!!tagSelectorTrack}
          track={tagSelectorTrack}
          onClose={() => setTagSelectorTrack(null)}
        />
      )}

      {showBatchTagUpdateModal && (
        <BatchTagUpdateModal
          isOpen={showBatchTagUpdateModal}
          onClose={() => setShowBatchTagUpdateModal(false)}
          trackIds={
            selectedTracks.size > 0
              ? Array.from(selectedTracks)
              : filteredTracks.map((t) => t.TrackID)
          }
          trackCount={selectedTracks.size > 0 ? selectedTracks.size : filteredTracks.length}
        />
      )}

      {showBatchGenreUpdateModal && (
        <BatchGenreUpdateModal
          isOpen={showBatchGenreUpdateModal}
          onClose={() => setShowBatchGenreUpdateModal(false)}
          trackIds={
            selectedTracks.size > 0
              ? Array.from(selectedTracks)
              : filteredTracks.map((t) => t.TrackID)
          }
          trackCount={selectedTracks.size > 0 ? selectedTracks.size : filteredTracks.length}
        />
      )}

      <DeleteTracksModal
        isOpen={showDeleteTracksModal}
        onClose={() => {
          setShowDeleteTracksModal(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={() => {
          deleteTracks(pendingDeleteIds);
          clearSelection();
          setShowDeleteTracksModal(false);
          setPendingDeleteIds([]);
        }}
        trackCount={pendingDeleteIds.length}
        contextLabel={selectedPlaylist ? `"${selectedPlaylist.Name}"` : undefined}
      />

      <Suspense fallback={null}>
        <AudioFeaturesWizard
          isOpen={showAudioFeaturesWizard}
          onClose={() => {
            setShowAudioFeaturesWizard(false);
            setAudioFeaturesFiles([]);
          }}
          selectedFiles={audioFeaturesFiles}
        />
      </Suspense>
    </div>
  );
}

