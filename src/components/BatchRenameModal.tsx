import { useState, useEffect } from 'react';
import { FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Track } from '../types/track';

interface BatchRenameModalProps {
  tracks: Track[];
  onClose: () => void;
  onRenameTracks: (renames: { trackId: string; newName: string }[]) => void;
}

interface RenamePreview {
  track: Track;
  oldName: string;
  newName: string;
  pattern: string;
}

export default function BatchRenameModal({
  tracks,
  onClose,
  onRenameTracks,
}: BatchRenameModalProps) {
  const [previews, setPreviews] = useState<RenamePreview[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<string>('all');

  useEffect(() => {
    scanForRenames();
  }, [tracks]);

  const scanForRenames = () => {
    setIsScanning(true);
    
    const previewsList: RenamePreview[] = [];
    
    tracks.forEach(track => {
      const oldName = track.Name || '';
      
      // Pattern 1: "01 - Title" or "1 - Title" -> "Title"
      const pattern1 = /^\d+\s*[-.\s]+\s*(.+)$/i;
      const match1 = oldName.match(pattern1);
      if (match1) {
        previewsList.push({
          track,
          oldName,
          newName: match1[1].trim(),
          pattern: 'leading-number',
        });
        return;
      }
      
      // Pattern 2: "01.Title" -> "Title"
      const pattern2 = /^\d+\.\s*(.+)$/i;
      const match2 = oldName.match(pattern2);
      if (match2) {
        previewsList.push({
          track,
          oldName,
          newName: match2[1].trim(),
          pattern: 'leading-number-dot',
        });
        return;
      }
      
      // Pattern 3: "01 Title" (space only) -> "Title"
      const pattern3 = /^\d+\s+(.+)$/i;
      const match3 = oldName.match(pattern3);
      if (match3) {
        previewsList.push({
          track,
          oldName,
          newName: match3[1].trim(),
          pattern: 'leading-number-space',
        });
      }
    });

    setPreviews(previewsList);
    setIsScanning(false);
  };

  const filteredPreviews = selectedPattern === 'all' 
    ? previews 
    : previews.filter(p => p.pattern === selectedPattern);

  const handleApplyRename = () => {
    const renames = filteredPreviews.map(preview => ({
      trackId: preview.track.TrackID,
      newName: preview.newName,
    }));

    const count = renames.length;
    if (confirm(`Rename ${count} track${count > 1 ? 's' : ''}?`)) {
      onRenameTracks(renames);
      onClose();
    }
  };

  const getPatternLabel = (pattern: string): string => {
    switch (pattern) {
      case 'leading-number':
        return 'Number - Title';
      case 'leading-number-dot':
        return 'Number.Title';
      case 'leading-number-space':
        return 'Number Title';
      default:
        return 'Unknown';
    }
  };

  const patternCounts = {
    all: previews.length,
    'leading-number': previews.filter(p => p.pattern === 'leading-number').length,
    'leading-number-dot': previews.filter(p => p.pattern === 'leading-number-dot').length,
    'leading-number-space': previews.filter(p => p.pattern === 'leading-number-space').length,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content batch-rename-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileText size={24} />
            <span>Batch Rename Tracks</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isScanning ? (
            <div className="scanning-state">
              <div className="spinner"></div>
              <p>Scanning for tracks to rename...</p>
            </div>
          ) : previews.length === 0 ? (
            <div className="no-renames">
              <CheckCircle size={48} className="success-icon" />
              <h3>No Tracks to Rename</h3>
              <p>All tracks are already properly named.</p>
            </div>
          ) : (
            <>
              <div className="rename-summary">
                <AlertCircle size={20} className="info-icon" />
                <div>
                  <strong>{previews.length} track{previews.length > 1 ? 's' : ''} found with number prefixes</strong>
                  <p>Select a pattern to preview changes</p>
                </div>
              </div>

              {/* Pattern Filter */}
              <div className="pattern-filter">
                <label>Filter by Pattern:</label>
                <div className="pattern-buttons">
                  <button
                    className={`pattern-btn ${selectedPattern === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedPattern('all')}
                  >
                    All ({patternCounts.all})
                  </button>
                  {patternCounts['leading-number'] > 0 && (
                    <button
                      className={`pattern-btn ${selectedPattern === 'leading-number' ? 'active' : ''}`}
                      onClick={() => setSelectedPattern('leading-number')}
                    >
                      Number - Title ({patternCounts['leading-number']})
                    </button>
                  )}
                  {patternCounts['leading-number-dot'] > 0 && (
                    <button
                      className={`pattern-btn ${selectedPattern === 'leading-number-dot' ? 'active' : ''}`}
                      onClick={() => setSelectedPattern('leading-number-dot')}
                    >
                      Number.Title ({patternCounts['leading-number-dot']})
                    </button>
                  )}
                  {patternCounts['leading-number-space'] > 0 && (
                    <button
                      className={`pattern-btn ${selectedPattern === 'leading-number-space' ? 'active' : ''}`}
                      onClick={() => setSelectedPattern('leading-number-space')}
                    >
                      Number Title ({patternCounts['leading-number-space']})
                    </button>
                  )}
                </div>
              </div>

              {/* Preview List */}
              <div className="rename-preview-list">
                {filteredPreviews.map((preview) => (
                  <div key={preview.track.TrackID} className="rename-preview-item">
                    <div className="rename-preview-old">
                      <span className="rename-label">Old:</span>
                      <span className="rename-value old-value">{preview.oldName}</span>
                    </div>
                    <div className="rename-arrow">→</div>
                    <div className="rename-preview-new">
                      <span className="rename-label">New:</span>
                      <span className="rename-value new-value">{preview.newName}</span>
                    </div>
                    <span className="pattern-badge">{getPatternLabel(preview.pattern)}</span>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleApplyRename}
                  disabled={filteredPreviews.length === 0}
                >
                  Rename {filteredPreviews.length} Track{filteredPreviews.length > 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

