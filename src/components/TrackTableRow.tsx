import { memo, useCallback } from 'react';
import LazyAlbumArt from './LazyAlbumArt';
import LazyWaveform from './LazyWaveform';
import { Track } from '../types/track';
import { ColumnConfig } from '../store/useColumnStore';

interface TrackTableRowProps {
  track: Track;
  index: number;
  style: React.CSSProperties;
  isSelected: boolean;
  isMultiSelected: boolean;
  visibleColumns: ColumnConfig[];
  fontSize: string;
  editingCell: { trackId: string; field: string } | null;
  editValue: string;
  onRowClick: (track: Track, index: number, e: React.MouseEvent) => void;
  onContextMenu: (track: Track, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, track: Track) => void;
  onToggleSelection: (trackId: string) => void;
  onCellDoubleClick: (track: Track, field: string) => void;
  onCellBlur: () => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onEditValueChange: (value: string) => void;
  onTagClick: (track: Track, e: React.MouseEvent) => void;
  formatTime: (ms: string | undefined) => string;
}

export const TrackTableRow = memo(({
  track,
  index,
  style,
  isSelected,
  isMultiSelected,
  visibleColumns,
  fontSize,
  editingCell,
  editValue,
  onRowClick,
  onContextMenu,
  onDragStart,
  onToggleSelection,
  onCellDoubleClick,
  onCellBlur,
  onCellKeyDown,
  onEditValueChange,
  onTagClick,
  formatTime,
}: TrackTableRowProps) => {

  const renderEditableCell = useCallback((field: string, value: string, className?: string) => {
    const isEditing = editingCell?.trackId === track.TrackID && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <div className={className} onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onCellBlur}
            onKeyDown={onCellKeyDown}
            autoFocus
            className="cell-editor"
          />
        </div>
      );
    }
    
    return (
      <div
        className={className}
        onDoubleClick={() => onCellDoubleClick(track, field)}
        title="Double-click to edit"
      >
        {value || '-'}
      </div>
    );
  }, [track, editingCell, editValue, onEditValueChange, onCellBlur, onCellKeyDown, onCellDoubleClick]);

  const renderCell = (columnId: string) => {
    switch (columnId) {
      case 'checkbox':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isMultiSelected}
              onChange={() => onToggleSelection(track.TrackID)}
            />
          </div>
        );
      case 'art':
        return (
          <div className="album-art-cell">
            <LazyAlbumArt
              trackId={track.TrackID}
              location={track.Location}
              albumArt={(track as any).AlbumArt}
              size={fontSize === 'small' ? 32 : fontSize === 'large' ? 40 : 36}
            />
          </div>
        );
      case 'title': return renderEditableCell('Name', track.Name || 'Unknown', 'track-name');
      case 'artist': return renderEditableCell('Artist', track.Artist || 'Unknown Artist');
      case 'album': return renderEditableCell('Album', track.Album || '');
      case 'genre': return renderEditableCell('Genre', track.Genre || '');
      case 'bpm': return renderEditableCell('AverageBpm', track.AverageBpm ? parseFloat(track.AverageBpm).toFixed(1) : '');
      case 'key': return renderEditableCell('Key', track.Key || '');
      case 'rating': return <div>{track.Rating ? `${track.Rating}★` : '-'}</div>;
      case 'time': return <div>{formatTime(track.TotalTime)}</div>;
      case 'year': return renderEditableCell('Year', track.Year || '');
      case 'tags':
        return (
          <div
            className="tags-cell"
            title="Click to edit tags"
            onClick={(e) => onTagClick(track, e)}
          >
            {(track.tags || []).length
              ? track.tags!.map((t) => t.name).join(', ')
              : 'Add tags'}
          </div>
        );
      case 'waveform':
        return (
          <div style={{ width: '100%', padding: '0 4px' }}>
            <LazyWaveform
              trackId={track.TrackID}
              location={track.Location}
              height={24}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        alignItems: 'center',
        padding: '0 8px',
        boxSizing: 'border-box',
        fontSize: fontSize === 'small' ? '12px' : fontSize === 'large' ? '14px' : '13px',
      }}
      className={`track-row ${isSelected ? 'selected' : ''} ${
        isMultiSelected ? 'multi-selected' : ''
      } ${track.isMissing ? 'missing-track' : ''}`}
      onClick={(e) => onRowClick(track, index, e)}
      onContextMenu={(e) => onContextMenu(track, e)}
      draggable={!track.isMissing}
      onDragStart={(e) => onDragStart(e, track)}
      onDragEnd={(e) => { try { e.stopPropagation(); } catch (_) {} }}
    >
      {visibleColumns.map(col => (
        <div key={col.id} style={{ overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}>
          {renderCell(col.id)}
        </div>
      ))}
    </div>
  );
});