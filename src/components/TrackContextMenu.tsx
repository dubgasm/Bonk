import { useEffect, useRef } from 'react';
import { FileEdit, CheckSquare, XSquare, Music, Search, RotateCcw } from 'lucide-react';

interface TrackContextMenuProps {
  x: number;
  y: number;
  track?: any;  // The right-clicked track (if single-track operation)
  onClose: () => void;
  onWriteTags: () => void;
  onDetectKeys: () => void;
  onFindTags: () => void;
  onDiscardChanges: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedCount: number;
}

export default function TrackContextMenu({
  x,
  y,
  track,
  onClose,
  onWriteTags,
  onDetectKeys,
  onFindTags,
  onDiscardChanges,
  onSelectAll,
  onClearSelection,
  selectedCount,
}: TrackContextMenuProps) {
  // If a track is provided (right-click), it's a single-track operation
  // Otherwise, it's a batch operation on selected tracks
  const isSingleTrack = !!track;
  const operationCount = isSingleTrack ? 1 : selectedCount;
  const menuRef = useRef<HTMLDivElement>(null);

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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onWriteTags();
          onClose();
        }}
      >
        <FileEdit size={16} />
        <span>Write Tags to Files</span>
        {operationCount > 0 && <span className="badge">{operationCount}</span>}
      </button>

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

      <button
        className="context-menu-item"
        onClick={() => {
          onFindTags();
          onClose();
        }}
      >
        <Search size={16} />
        <span>Find Tags & Album Art</span>
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

