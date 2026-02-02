import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { FolderOpen, ArrowUp, Settings } from 'lucide-react';
import QuickTagContextMenu from './QuickTagContextMenu';
import { Track } from '../types/track';
import QuickTagPlayer from './QuickTagPlayer';
import ReactiveButton from 'reactive-button';
import Rating from './ui/Rating';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/useSettingsStore';
import { starsToPopmByte, popmByteToStars } from '../utils/popm';

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

function normalizeLocation(location?: string): string {
  if (!location) return '';
  let p = String(location);
  if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', '/');
  else if (p.startsWith('file://')) p = p.replace('file://', '');
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

function buildFolderTree(tracks: Track[], rootPath: string): FolderNode {
  const root: FolderNode = { name: rootPath.split(/[\\/]/).pop() || rootPath, path: rootPath, children: [] };
  const childMap = new Map<string, FolderNode>();

  const ensureNode = (fullPath: string): FolderNode => {
    if (fullPath === rootPath) return root;
    if (childMap.has(fullPath)) return childMap.get(fullPath)!;

    const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/')) || rootPath;
    const name = fullPath.substring(fullPath.lastIndexOf('/') + 1) || fullPath;
    const node: FolderNode = { name, path: fullPath, children: [] };
    childMap.set(fullPath, node);

    const parent = ensureNode(parentPath);
    if (!parent.children.find((c) => c.path === fullPath)) {
      parent.children.push(node);
    }
    return node;
  };

  for (const track of tracks) {
    const loc = normalizeLocation(track.Location);
    if (!loc.startsWith(rootPath)) continue;
    const folder = loc.substring(0, loc.lastIndexOf('/')) || rootPath;
    ensureNode(folder);
  }

  return root;
}

function FolderTreeItem({
  node,
  level,
  selectedPath,
  onSelect,
}: {
  node: FolderNode;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPath === node.path;

  return (
    <div className="quicktag-folder-node">
      <button
        className={
          'quicktag-folder-row' +
          (isSelected ? ' quicktag-folder-row-active' : '') +
          (hasChildren ? '' : ' quicktag-folder-row-leaf')
        }
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => onSelect(node.path)}
      >
        {hasChildren && (
          <span
            className="quicktag-folder-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        )}
        {!hasChildren && <span className="quicktag-folder-toggle-spacer" />}
        <span className="quicktag-folder-name">{node.name}</span>
      </button>
      {hasChildren && expanded && (
        <div className="quicktag-folder-children">
          {node.children
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <FolderTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function QuickTagScreen() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allScannedTracks, setAllScannedTracks] = useState<Track[]>([]); // Cache all tracks we've ever scanned
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSave, setPendingSave] = useState(false);
  const [autoPlayOnSelect, setAutoPlayOnSelect] = useState(false);
  const [autoSaveRating, setAutoSaveRating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autosaveOnTrackSwitch, setAutosaveOnTrackSwitch] = useState(false);
  const [startPlaybackAfterSeek, setStartPlaybackAfterSeek] = useState(false);
  const [goToNextTrackOnEnd, setGoToNextTrackOnEnd] = useState(false);
  const saveToastIdRef = useRef<string | number | null>(null);
  const [activeEditTrackId, setActiveEditTrackId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const [externalSeekTargetSeconds, setExternalSeekTargetSeconds] = useState<number | null>(null);
  const { tagWriteSettings } = useSettingsStore();

  // Clear seek target when track changes (e.g. after loading a folder) so we don't apply old position to new track
  useEffect(() => {
    setExternalSeekTargetSeconds(null);
  }, [selectedTrack?.TrackID]);

  // Save rating to file — must be defined before any callback that uses it (handleSelectTrack, useEffect, Rating onChange)
  const saveRatingToFile = useCallback(async (track: Track, ratingByte: number) => {
    if (!track?.Location) return;
    if (pendingSave) return;
    if (!window.electronAPI?.audioTagsSetRatingByte) {
      toast.error('Save failed', { description: 'Rating writer not available', duration: 3000 });
      return;
    }
    if (!ratingByte || ratingByte <= 0) {
      toast.error('No rating to save', { description: 'Rating is 0 or not set', duration: 3000 });
      return;
    }
    setPendingSave(true);
    if (saveToastIdRef.current !== null) toast.dismiss(saveToastIdRef.current);
    const toastId = toast.loading('Saving...', { description: 'Writing rating to file', duration: Infinity });
    saveToastIdRef.current = toastId;
    try {
      const result = await window.electronAPI.audioTagsSetRatingByte(track.Location, ratingByte);
      setPendingSave(false);
      saveToastIdRef.current = null;
      if (result.success) {
        const stars = popmByteToStars(ratingByte);
        toast.success('Saved', { id: toastId, description: `Rating (${stars}★) written to file`, duration: 3000 });
        setActiveEditTrackId(null);
      } else {
        toast.error('Save failed', { id: toastId, description: result.error || 'Failed to write rating', duration: 5000 });
      }
    } catch (error: any) {
      setPendingSave(false);
      saveToastIdRef.current = null;
      toast.error('Save failed', { id: toastId, description: error.message || 'Error writing rating', duration: 5000 });
    }
  }, [pendingSave]);

  const loadFolder = async (folder: string, options: { autoSelectFolder?: boolean; skipScan?: boolean } = {}) => {
    const { autoSelectFolder = true, skipScan = false } = options;
    
    // Fast path: if skipScan is true, just change the root and rebuild tree from cached tracks
    if (skipScan) {
      setFolderPath(folder);
      setSelectedFolderPath(autoSelectFolder ? folder : null);
      setSelectedTrack(autoSelectFolder && tracks.length > 0 ? tracks[0] : null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const api = window.electronAPI;
      if (!api?.selectFolder || !api?.scanFolder) {
        throw new Error('Folder selection is not available in this build.');
      }
      const result = await api.scanFolder(folder);
      if (!result.success || !result.library) {
        throw new Error(result.error || 'Failed to scan folder');
      }

      const folderTracks: Track[] = result.library.tracks || [];
      setFolderPath(folder);
      setTracks(folderTracks);
      // Merge into cache (avoid duplicates by TrackID)
      setAllScannedTracks((prev) => {
        const existingIds = new Set(prev.map((t) => t.TrackID));
        const newTracks = folderTracks.filter((t) => !existingIds.has(t.TrackID));
        return [...prev, ...newTracks];
      });

      // When autoSelectFolder is true (initial choose folder), we also select that folder
      // When false (clicking Parent folder), we only change the tree root and wait for user to pick a child
      if (autoSelectFolder) {
        setSelectedFolderPath(folder);
        setSelectedTrack(folderTracks[0] || null);
      } else {
        setSelectedFolderPath(null);
        setSelectedTrack(null);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to select folder');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseFolder = async () => {
    const api = window.electronAPI;
    try {
      setLoading(true);
      setError(null);
      if (!api?.selectFolder) {
        throw new Error('Folder selection is not available in this build.');
      }
      const folder = await api.selectFolder();
      if (!folder) {
        setLoading(false);
        return;
      }
      await loadFolder(folder, { autoSelectFolder: true });
    } catch (e: any) {
      setError(e.message || 'Failed to select folder');
    } finally {
      setLoading(false);
    }
  };

  const handleGoUpFolder = () => {
    if (!folderPath) return;
    const trimmed = folderPath.replace(/\/+$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash <= 0) return;
    const parent = trimmed.substring(0, lastSlash);
    // Fast: just change root, rebuild tree from cached tracks (no IPC call)
    loadFolder(parent, { autoSelectFolder: false, skipScan: true });
  };

  // Build tree from all cached tracks (includes tracks from current + parent folders)
  // This way going up is instant - no re-scanning needed
  const folderTree = useMemo(
    () => (folderPath ? buildFolderTree(allScannedTracks.length > 0 ? allScannedTracks : tracks, folderPath) : null),
    [allScannedTracks, tracks, folderPath]
  );

  const visibleTracks = useMemo(() => {
    if (!selectedFolderPath) return [];
    const q = searchQuery.trim().toLowerCase();
    // Use allScannedTracks if available, fallback to tracks
    const sourceTracks = allScannedTracks.length > 0 ? allScannedTracks : tracks;
    return sourceTracks.filter((t) => {
      const loc = normalizeLocation(t.Location);
      if (!loc.startsWith(selectedFolderPath)) return false;
      if (!q) return true;
      const haystack = `${t.Name || ''} ${t.Artist || ''} ${t.Album || ''} ${t.Genre || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allScannedTracks, tracks, selectedFolderPath, searchQuery]);

  // When switching track: optionally autosave the previous track's rating
  const handleSelectTrack = useCallback(
    (newTrack: Track) => {
      if (autosaveOnTrackSwitch && selectedTrack && activeEditTrackId === selectedTrack.TrackID) {
        const ratingByte = selectedTrack.ratingByte ?? 0;
        if (ratingByte > 0 && selectedTrack.Location) {
          saveRatingToFile(selectedTrack, ratingByte);
        }
      }
      setSelectedTrack(newTrack);
    },
    [autosaveOnTrackSwitch, selectedTrack, activeEditTrackId, saveRatingToFile]
  );

  const updateRatingForTrack = (trackId: string, ratingByte: number) => {
    // Store ratingByte as number (0-255), not string
    const byte = ratingByte > 0 ? ratingByte : undefined;

    setTracks((prev) =>
      prev.map((t) => (t.TrackID === trackId ? { ...t, ratingByte: byte } : t)),
    );
    setAllScannedTracks((prev) =>
      prev.map((t) => (t.TrackID === trackId ? { ...t, ratingByte: byte } : t)),
    );
    setActiveEditTrackId(trackId);
  };

  // Helper: select next/previous track in the visible list (respects autosave on switch)
  const selectTrackByOffset = (offset: number) => {
    if (!visibleTracks.length) return;
    let currentIndex = selectedTrack
      ? visibleTracks.findIndex((t) => t.TrackID === selectedTrack.TrackID)
      : -1;
    if (currentIndex === -1) {
      currentIndex = offset > 0 ? -1 : visibleTracks.length;
    }
    const nextIndex = Math.min(
      visibleTracks.length - 1,
      Math.max(0, currentIndex + offset),
    );
    const nextTrack = visibleTracks[nextIndex];
    if (nextTrack) {
      handleSelectTrack(nextTrack);
    }
  };

  // Keyboard shortcuts (Quick Tag only)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || (target as any)?.isContentEditable;

      // Allow typing in inputs/textareas without stealing keys, except arrows for track nav
      if (isTyping && !['ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      const api = window.electronAPI;

      // Space: play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        try {
          const res = await api.rustAudioIsPlaying?.();
          const isPlaying = !!res?.success && !!res.isPlaying;
          if (isPlaying) {
            await api.rustAudioPause?.();
          } else {
            await api.rustAudioPlay?.();
          }
        } catch (err) {
          console.error('QuickTagScreen space play/pause error:', err);
        }
        return;
      }

      // Seek -10s / +30s
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        try {
          const posRes = await api.rustAudioGetPosition?.();
          const durRes = await api.rustAudioGetDuration?.();
          const pos =
            posRes && typeof posRes === 'object'
              ? Number((posRes as any).position ?? 0)
              : Number(posRes ?? 0);
          const dur =
            durRes && typeof durRes === 'object'
              ? Number((durRes as any).duration ?? 0)
              : Number(durRes ?? 0);
          const delta = e.key === 'ArrowLeft' ? -10 : 10;
          const target = Math.max(0, Math.min(dur || 0, pos + delta));
          await api.rustAudioSeek?.(target);
          setExternalSeekTargetSeconds(target);
        } catch (err) {
          console.error('QuickTagScreen arrow seek error:', err);
        }
        return;
      }

      // Change tracks: up/down arrows
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectTrackByOffset(-1);
        if (autoPlayOnSelect) {
          try {
            await api.rustAudioPlay?.();
          } catch (err) {
            console.error('QuickTagScreen auto-play prev track error:', err);
          }
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectTrackByOffset(1);
        if (autoPlayOnSelect) {
          try {
            await api.rustAudioPlay?.();
          } catch (err) {
            console.error('QuickTagScreen auto-play next track error:', err);
          }
        }
        return;
      }

      // Save: Shift+S => save directly (when auto-save is off)
      if (e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        if (pendingSave) return;

        const trackToSave = activeEditTrackId
          ? visibleTracks.find((t) => t.TrackID === activeEditTrackId && t.Location)
          : null;

        if (!trackToSave) {
          toast.error('No track to save', {
            description: activeEditTrackId
              ? 'Edited track not found or missing file location'
              : 'Change a rating first, then press Shift+S',
            duration: 3000,
          });
          return;
        }

        const ratingByte = trackToSave.ratingByte ?? 0;
        saveRatingToFile(trackToSave, ratingByte);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleTracks, selectedTrack, pendingSave, autoPlayOnSelect, activeEditTrackId, tagWriteSettings, saveRatingToFile]);

  return (
    <div className="quicktag-layout">
      <div className="quicktag-main">
        <div className="quicktag-toolbar">
          <button className="btn btn-secondary" onClick={handleChooseFolder} disabled={loading}>
            <FolderOpen size={18} />
            Choose folder…
          </button>
          <button
            className="quicktag-up-btn"
            onClick={handleGoUpFolder}
            disabled={!folderPath || loading}
            title="Go up one folder"
          >
            <ArrowUp size={14} />
          </button>
          <div style={{ marginLeft: '8px' }}>
            <ReactiveButton
              buttonState="idle"
              color={autoPlayOnSelect ? 'green' : 'red'}
              idleText={autoPlayOnSelect ? 'Auto play ON' : 'Auto play OFF'}
              onClick={() => setAutoPlayOnSelect((v) => !v)}
              rounded
              size="small"
            />
          </div>
          <div style={{ marginLeft: '8px' }} title="When on, changing the star rating saves to file immediately (no Shift+S needed)">
            <ReactiveButton
              buttonState="idle"
              color={autoSaveRating ? 'green' : 'red'}
              idleText={autoSaveRating ? 'Auto-save rating ON' : 'Auto-save rating OFF'}
              onClick={() => setAutoSaveRating((v) => !v)}
              rounded
              size="small"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary quicktag-settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Quick Tag settings"
          >
            <Settings size={18} />
            Settings
          </button>

          {folderPath && (
            <div className="quicktag-path-search">
              <span className="quicktag-path">{selectedFolderPath || folderPath}</span>
              <input
                className="quicktag-search-input"
                type="text"
                placeholder="Search in folder…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && <div className="quicktag-error">{error}</div>}

        <div className="quicktag-content-row">
          {/* Left: folder browser */}
          <div className="quicktag-folder-sidebar">
            {!folderPath && !loading && (
              <div className="quicktag-empty">Choose a root folder to browse tracks.</div>
            )}
            {folderPath && (
              <button
                className="quicktag-folder-row quicktag-folder-parent"
                onClick={handleGoUpFolder}
                disabled={loading}
              >
                <span className="quicktag-folder-toggle-spacer">
                  <ArrowUp size={12} />
                </span>
                <span className="quicktag-folder-name">Parent folder</span>
              </button>
            )}
            {folderTree && (
              <div className="quicktag-folder-tree">
                <FolderTreeItem
                  node={folderTree}
                  level={0}
                  selectedPath={selectedFolderPath}
                  onSelect={(p) => setSelectedFolderPath(p)}
                />
              </div>
            )}
          </div>

          {/* Center: folder contents / track table */}
          <div className="quicktag-center-panel">
            <div className="quicktag-tracklist">
              {visibleTracks.length === 0 && !loading && (
                <div className="quicktag-empty">No tracks match this folder/search.</div>
              )}
              {visibleTracks.length > 0 && (
                <div className="quicktag-track-table">
                  <div className="quicktag-track-table-header">
                    <span className="qt-col-artwork" />
                    <span className="qt-col-title">Title</span>
                    <span className="qt-col-artist">Artist</span>
                    <span className="qt-col-album">Album</span>
                    <span className="qt-col-genre">Genre</span>
                    <span className="qt-col-rating">Rating</span>
                    <span className="qt-col-key">Key</span>
                  </div>
                  <div className="quicktag-track-table-body">
                    {visibleTracks.map((track) => (
                      <div
                        key={track.TrackID}
                        className={
                          'quicktag-track-row' +
                          (selectedTrack?.TrackID === track.TrackID ? ' quicktag-track-row-active' : '')
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectTrack(track)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectTrack(track);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (track?.Location && window.electronAPI?.showItemInFolder) {
                            setContextMenu({ x: e.clientX, y: e.clientY, track });
                          }
                        }}
                      >
                        <div className="qt-col-artwork">
                          <div className="qt-artwork">
                            {track.AlbumArt ? (
                              <img src={track.AlbumArt} alt="" />
                            ) : (
                              <span>♪</span>
                            )}
                          </div>
                        </div>
                        <div className="qt-col-title">
                          <span className="quicktag-track-title">{track.Name || '(untitled)'}</span>
                        </div>
                        <div className="qt-col-artist">
                          <span className="quicktag-track-artist">{track.Artist || ''}</span>
                        </div>
                        <div className="qt-col-album">
                          <span className="quicktag-track-album">{track.Album || ''}</span>
                        </div>
                        <div className="qt-col-genre">
                          <span className="quicktag-track-genre">{track.Genre || ''}</span>
                        </div>
                        <div className="qt-col-rating">
                          <Rating
                            size="small"
                            max={5}
                            value={popmByteToStars(track.ratingByte ?? (track.Rating ? Number(track.Rating) : 0))}
                            onChange={(newStars) => {
                              const ratingByte = starsToPopmByte(newStars);
                              console.log(`[QuickTag Renderer] User clicked stars: newStars=${newStars}, ratingByte=${ratingByte}`);
                              updateRatingForTrack(track.TrackID, ratingByte);
                              if (autoSaveRating && ratingByte > 0) {
                                saveRatingToFile(track, ratingByte);
                              }
                            }}
                            precision={1}
                          />
                        </div>
                        <div className="qt-col-key">
                          <span className="quicktag-track-key">{track.Key || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {contextMenu && (
            <QuickTagContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              track={contextMenu.track}
              onClose={() => setContextMenu(null)}
              onShowInFinder={() => {
                if (contextMenu.track?.Location) window.electronAPI?.showItemInFolder?.(contextMenu.track.Location);
                setContextMenu(null);
              }}
            />
          )}

          {/* Right: reserved space for later */}
          <div className="quicktag-right-panel" />
        </div>
      </div>

      {/* Quick Tag settings modal */}
      {settingsOpen && (
        <div
          className="quicktag-settings-overlay"
          onClick={() => setSettingsOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSettingsOpen(false)}
          role="dialog"
          aria-label="Quick Tag settings"
        >
          <div className="quicktag-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="quicktag-settings-header">
              <h3>Quick Tag settings</h3>
              <button type="button" className="quicktag-settings-close" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>
            <div className="quicktag-settings-body">
              <label className="quicktag-settings-row">
                <input
                  type="checkbox"
                  checked={autosaveOnTrackSwitch}
                  onChange={(e) => setAutosaveOnTrackSwitch(e.target.checked)}
                />
                <span>Autosave changes when switching to a different track</span>
              </label>
              <label className="quicktag-settings-row">
                <input
                  type="checkbox"
                  checked={autoPlayOnSelect}
                  onChange={(e) => setAutoPlayOnSelect(e.target.checked)}
                />
                <span>Continue playback when switching to a different track</span>
              </label>
              <label className="quicktag-settings-row">
                <input
                  type="checkbox"
                  checked={startPlaybackAfterSeek}
                  onChange={(e) => setStartPlaybackAfterSeek(e.target.checked)}
                />
                <span>Start/continue playback after seeking</span>
              </label>
              <label className="quicktag-settings-row">
                <input
                  type="checkbox"
                  checked={goToNextTrackOnEnd}
                  onChange={(e) => setGoToNextTrackOnEnd(e.target.checked)}
                />
                <span>Go to next track when playback ends</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {selectedTrack && (
        <QuickTagPlayer
          track={selectedTrack}
          onChooseFolder={handleChooseFolder}
          autoPlay={autoPlayOnSelect}
          startPlaybackAfterSeek={startPlaybackAfterSeek}
          onPlaybackEnded={goToNextTrackOnEnd ? () => selectTrackByOffset(1) : undefined}
          externalSeekTargetSeconds={externalSeekTargetSeconds}
          onExternalSeekConsumed={() => setExternalSeekTargetSeconds(null)}
        />
      )}
    </div>
  );
}

