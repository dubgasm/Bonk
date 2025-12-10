import { useState } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { SyncMode } from '../types/settings';

interface ExportModalProps {
  onClose: () => void;
  onExport: () => void;
  trackCount: number;
}

export default function ExportModal({ onClose, onExport, trackCount }: ExportModalProps) {
  const {
    syncSettings,
    updateSyncMode,
    toggleDontTouchMyGrids,
    toggleConvertColors,
    lastSyncDate,
  } = useSettingsStore();

  const [selectedMode, setSelectedMode] = useState<SyncMode>(syncSettings.mode);

  const handleExport = () => {
    updateSyncMode(selectedMode);
    onExport();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export to Rekordbox</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="info-box">
            <AlertCircle size={18} />
            <span>Exporting {trackCount} tracks to Rekordbox XML format</span>
          </div>

          <div className="form-section">
            <h3>Sync Mode</h3>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="syncMode"
                  value="full"
                  checked={selectedMode === 'full'}
                  onChange={(e) => setSelectedMode(e.target.value as SyncMode)}
                />
                <div className="radio-label">
                  <strong>Full Sync</strong>
                  <span>Makes your DJ app match Lexicon exactly</span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="syncMode"
                  value="playlist"
                  checked={selectedMode === 'playlist'}
                  onChange={(e) => setSelectedMode(e.target.value as SyncMode)}
                />
                <div className="radio-label">
                  <strong>Playlist Sync</strong>
                  <span>Only add or update tracks, nothing is removed</span>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="syncMode"
                  value="modified"
                  checked={selectedMode === 'modified'}
                  onChange={(e) => setSelectedMode(e.target.value as SyncMode)}
                  disabled={!lastSyncDate}
                />
                <div className="radio-label">
                  <strong>Modified Sync</strong>
                  <span>
                    {lastSyncDate
                      ? 'Only sync tracks changed since last sync'
                      : 'Available after first sync'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Options</h3>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={syncSettings.dontTouchMyGrids}
                onChange={toggleDontTouchMyGrids}
              />
              <div className="checkbox-label">
                <strong>Don't Touch My Grids</strong>
                <span>Preserve existing beatgrids in your DJ app</span>
              </div>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={syncSettings.convertColors}
                onChange={toggleConvertColors}
              />
              <div className="checkbox-label">
                <strong>Convert Colors</strong>
                <span>Convert to nearest matching color if exact color not available</span>
              </div>
            </label>
          </div>

          {lastSyncDate && (
            <div className="sync-info">
              <small>Last sync: {new Date(lastSyncDate).toLocaleString()}</small>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} />
            Export XML
          </button>
        </div>
      </div>
    </div>
  );
}

