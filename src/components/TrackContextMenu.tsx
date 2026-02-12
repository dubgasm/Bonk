import { useEffect, useRef, useState } from 'react';
import { CheckSquare, XSquare, Music, RotateCcw, Trash2, FolderOpen, Copy, Clipboard } from 'lucide-react';

interface TrackContextMenuProps {
  x: number;
  y: number;
  track?: any;  // The right-clicked track (if single-track operation)
  onClose: () => void;
  onDetectKeys: () => void;
  onDiscardChanges: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedCount: number;
  selectedPlaylist?: any;
  onRemoveFromPlaylist?: () => void;
  onDeleteTracks?: () => void;
}

export default function TrackContextMenu({
  x,
  y,
  track,
  onClose,
  onDetectKeys,
  onDiscardChanges,
  onSelectAll,
  onClearSelection,
  selectedCount,
  selectedPlaylist,
  onRemoveFromPlaylist,
  onDeleteTracks,
}: TrackContextMenuProps) {
  // If a track is provided (right-click), it's a single-track operation
  // Otherwise, it's a batch operation on selected tracks
  const isSingleTrack = !!track;
  const operationCount = isSingleTrack ? 1 : selectedCount;
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    // Adjust position if menu goes off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${viewportWidth - rect.width - 10}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${viewportHeight - rect.height - 10}px`;
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        onClose();
      }, 200);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      <div className="context-menu-header">
        <span className="context-menu-title">{isSingleTrack ? 'Track actions' : 'Selection actions'}</span>
        <span className="context-menu-subtitle">{operationCount} {operationCount === 1 ? 'track' : 'tracks'}</span>
      </div>
      <div className="context-menu-separator" />

      {track && (
        <>
          <button
            className="context-menu-item"
            onClick={() => handleCopy(`${track.Artist || ''} - ${track.Name || ''}`)}
          >
            <Copy size={16} />
            <span>Copy "{track.Artist} - {track.Name}"</span>
            {copied && <span className="badge">Copied!</span>}
          </button>
          
           <button
            className="context-menu-item"
            onClick={() => handleCopy(track.Location || '')}
          >
            <Clipboard size={16} />
            <span>Copy File Path</span>
          </button>

          <div className="context-menu-separator" />
        </>
      )}

      {isSingleTrack && track?.Location && window.electronAPI?.showItemInFolder && (
        <button
          className="context-menu-item"
          onClick={() => {
            window.electronAPI?.showItemInFolder?.(track.Location);
            onClose();
          }}
        >
          <FolderOpen size={16} />
          <span>Show in Finder</span>
        </button>
      )}

      <button
        className="context-menu-item"
        onClick={() => {
          onDetectKeys();
          onClose();
        }}
      >
        <Music size={16} />
        <span>Detect Musical Key</span>
        {operationCount > 0 && <span className="badge">{operationCount}</span>}
      </button>

      <div className="context-menu-separator" />

      <button
        className="context-menu-item"
        onClick={() => {
          onDiscardChanges();
          onClose();
        }}
      >
        <RotateCcw size={16} />
        <span>Discard Changes (Reload from File)</span>
        {operationCount > 0 && <span className="badge">{operationCount}</span>}
      </button>

      {selectedPlaylist && onRemoveFromPlaylist && (
        <>
          <div className="context-menu-separator" />

          <button
            className="context-menu-item danger"
            onClick={() => {
              onRemoveFromPlaylist();
              onClose();
            }}
          >
            <Trash2 size={16} />
            <span>Remove from Playlist</span>
            {operationCount > 0 && <span className="badge">{operationCount}</span>}
          </button>
        </>
      )}

      {onDeleteTracks && (
        <>
          <div className="context-menu-separator" />

          <button
            className="context-menu-item danger"
            onClick={() => {
              onDeleteTracks();
              onClose();
            }}
            disabled={!isSingleTrack && selectedCount === 0}
          >
            <Trash2 size={16} />
            <span>{isSingleTrack ? 'Delete Track' : 'Delete Selected Tracks'}</span>
            {operationCount > 0 && <span className="badge danger-badge">{operationCount}</span>}
          </button>
        </>
      )}

      <div className="context-menu-separator" />

      <button
        className="context-menu-item"
        onClick={() => {
          onSelectAll();
          onClose();
        }}
      >
        <CheckSquare size={16} />
        <span>Select All</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onClearSelection();
          onClose();
        }}
        disabled={selectedCount === 0}
      >
        <XSquare size={16} />
        <span>Clear Selection</span>
      </button>
    </div>
  );
}

