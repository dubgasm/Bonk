import { Music, Search, FileEdit, RotateCcw, CheckSquare, XSquare, AlertTriangle, Copy, FileText, FileAudio, MapPin, Zap } from 'lucide-react';

interface TrackTableToolbarProps {
  selectedCount: number;
  totalCount: number;
  missingCount: number;
  isCheckingMissing?: boolean;
  onDetectKeys: () => void;
  onFindTags: () => void;
  onWriteTags: () => void;
  onDiscardChanges: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCheckMissing: () => void;
  onFindDuplicates: () => void;
  onBatchRename: () => void;
  onConvertFormat: () => void;
  onFindLostTracks: () => void;
  onSmartFixes: () => void;
}

export default function TrackTableToolbar({
  selectedCount,
  totalCount,
  missingCount,
  onDetectKeys,
  onFindTags,
  onWriteTags,
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
}: TrackTableToolbarProps) {
  const hasSelection = selectedCount > 0;

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
        <button
          className="btn btn-sm"
          onClick={onDetectKeys}
          disabled={!hasSelection}
          title="Detect Musical Key (Cmd+K)"
        >
          <Music size={16} />
          <span>Detect Keys</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onFindTags}
          disabled={!hasSelection}
          title="Find Tags & Album Art (Cmd+F)"
        >
          <Search size={16} />
          <span>Find Tags</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onWriteTags}
          disabled={!hasSelection}
          title="Write Tags to Files (Cmd+W)"
        >
          <FileEdit size={16} />
          <span>Write Tags</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onDiscardChanges}
          disabled={!hasSelection}
          title="Discard Changes (Cmd+Z)"
        >
          <RotateCcw size={16} />
          <span>Discard</span>
        </button>

        <div className="toolbar-separator" />

        <button
          className="btn btn-sm"
          onClick={onCheckMissing}
          disabled={isCheckingMissing}
          title="Check for Missing Files"
        >
          <AlertTriangle size={16} />
          <span>{isCheckingMissing ? 'Checking...' : 'Check Missing'}</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onFindDuplicates}
          title="Find Duplicate Tracks"
        >
          <Copy size={16} />
          <span>Find Duplicates</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onBatchRename}
          title="Batch Rename Tracks"
        >
          <FileText size={16} />
          <span>Batch Rename</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onConvertFormat}
          disabled={!hasSelection}
          title="Convert Track Format (FLAC to MP3, etc.)"
        >
          <FileAudio size={16} />
          <span>Convert Format</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onFindLostTracks}
          disabled={missingCount === 0}
          title="Find Lost Tracks (relocate by extension)"
        >
          <MapPin size={16} />
          <span>Find Lost Tracks</span>
        </button>

        <button
          className="btn btn-sm"
          onClick={onSmartFixes}
          title="Apply Smart Fixes to track metadata"
        >
          <Zap size={16} />
          <span>Smart Fixes</span>
        </button>

        <div className="toolbar-separator" />

        <button
          className="btn btn-sm btn-secondary"
          onClick={hasSelection ? onClearSelection : onSelectAll}
          title={hasSelection ? "Clear Selection (Escape)" : "Select All (Cmd+A)"}
        >
          {hasSelection ? <XSquare size={16} /> : <CheckSquare size={16} />}
          <span>{hasSelection ? 'Clear' : 'Select All'}</span>
        </button>
      </div>
    </div>
  );
}

