import { useState, useRef, useEffect } from 'react';
import { Music, RotateCcw, CheckSquare, XSquare, AlertTriangle, Copy, FileText, FileAudio, MapPin, Zap, Tag, Disc, Trash2, ChevronDown, Sparkles, Activity } from 'lucide-react';

interface TrackTableToolbarProps {
  selectedCount: number;
  totalCount: number;
  missingCount: number;
  isCheckingMissing?: boolean;
  onDetectKeys: () => void;
  onDiscardChanges: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCheckMissing: () => void;
  onFindDuplicates: () => void;
  onBatchRename: () => void;
  onConvertFormat: () => void;
  onFindLostTracks: () => void;
  onSmartFixes: () => void;
  onManageTags: () => void;
  onBatchUpdateTags: () => void;
  onBatchUpdateGenres: () => void;
  onDeleteSelected: () => void;
  onAutoTag: () => void;
  onAudioFeatures: () => void;
}

export default function TrackTableToolbar({
  selectedCount,
  totalCount,
  missingCount,
  onDetectKeys,
  onDiscardChanges,
  onSelectAll,
  onClearSelection,
  onCheckMissing,
  isCheckingMissing = false,
  onFindDuplicates,
  onBatchRename,
  onConvertFormat,
  onFindLostTracks,
  onSmartFixes,
  onManageTags,
  onBatchUpdateTags,
  onBatchUpdateGenres,
  onDeleteSelected,
  onAutoTag,
  onAudioFeatures,
}: TrackTableToolbarProps) {
  const hasSelection = selectedCount > 0;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [moreOpen]);

  return (
    <div className="track-toolbar">
      <div className="track-toolbar-left">
        <span className="track-count">
          {selectedCount > 0 ? `${selectedCount} selected` : `${totalCount} tracks`}
          {missingCount > 0 && (
            <span className="missing-count"> • {missingCount} missing</span>
          )}
        </span>
      </div>

      <div className="track-toolbar-actions">
        <button className="btn btn-sm btn-primary" onClick={onDetectKeys} disabled={!hasSelection} title="Detect Key (⌘K)">
          <Music size={16} />
          <span>Keys</span>
        </button>
        <button className="btn btn-sm" onClick={onAutoTag} disabled={!hasSelection} title="Auto Tag">
          <Sparkles size={16} />
          <span>Auto Tag</span>
        </button>
        <button className="btn btn-sm" onClick={onDiscardChanges} disabled={!hasSelection} title="Discard (⌘Z)">
          <RotateCcw size={16} />
          <span>Discard</span>
        </button>

        <div className="toolbar-separator" />

        <button className="btn btn-sm" onClick={onCheckMissing} disabled={isCheckingMissing} title="Check Missing">
          <AlertTriangle size={16} />
          <span>{isCheckingMissing ? '...' : 'Missing'}</span>
        </button>

        <div className="toolbar-more-wrapper" ref={moreRef}>
          <button className="btn btn-sm btn-secondary" onClick={() => setMoreOpen(!moreOpen)} title="More actions">
            <ChevronDown size={14} style={{ opacity: moreOpen ? 1 : 0.7 }} />
            <span>More</span>
          </button>
          {moreOpen && (
            <div className="toolbar-more-menu">
              <button onClick={() => { onFindDuplicates(); setMoreOpen(false); }}>
                <Copy size={14} /> Find Duplicates
              </button>
              <button onClick={() => { onBatchRename(); setMoreOpen(false); }}>
                <FileText size={14} /> Batch Rename
              </button>
              <button onClick={() => { onConvertFormat(); setMoreOpen(false); }} disabled={!hasSelection}>
                <FileAudio size={14} /> Convert Format
              </button>
              <button onClick={() => { onFindLostTracks(); setMoreOpen(false); }} disabled={missingCount === 0}>
                <MapPin size={14} /> Find Lost Tracks
              </button>
              <button onClick={() => { onSmartFixes(); setMoreOpen(false); }}>
                <Zap size={14} /> Smart Fixes
              </button>
              <button onClick={() => { onManageTags(); setMoreOpen(false); }}>
                <FileText size={14} /> Manage Tags
              </button>
              <button onClick={() => { onBatchUpdateTags(); setMoreOpen(false); }} disabled={!hasSelection}>
                <Tag size={14} /> Batch Tags
              </button>
              <button onClick={() => { onBatchUpdateGenres(); setMoreOpen(false); }} disabled={!hasSelection}>
                <Disc size={14} /> Batch Genres
              </button>
              <button onClick={() => { onAudioFeatures(); setMoreOpen(false); }} disabled={!hasSelection}>
                <Activity size={14} /> Audio Features
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-separator" />

        <button className="btn btn-sm btn-danger" onClick={onDeleteSelected} disabled={!hasSelection} title="Delete">
          <Trash2 size={16} />
          <span>Delete</span>
        </button>

        <button
          className="btn btn-sm btn-secondary"
          onClick={hasSelection ? onClearSelection : onSelectAll}
          title={hasSelection ? 'Clear (Esc)' : 'Select All (⌘A)'}
        >
          {hasSelection ? <XSquare size={16} /> : <CheckSquare size={16} />}
          <span>{hasSelection ? 'Clear' : 'All'}</span>
        </button>
      </div>
    </div>
  );
}

