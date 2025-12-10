import { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface RemoveFromPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (alsoDeleteFromLibrary: boolean) => void;
  trackCount: number;
  playlistName: string;
  skipConfirm: boolean;
  onSetSkipConfirm: (skip: boolean) => void;
}

export default function RemoveFromPlaylistModal({
  isOpen,
  onClose,
  onConfirm,
  trackCount,
  playlistName,
  skipConfirm,
  onSetSkipConfirm,
}: RemoveFromPlaylistModalProps) {
  const [alsoDeleteFromLibrary, setAlsoDeleteFromLibrary] = useState(false);

  const handleConfirm = () => {
    onConfirm(alsoDeleteFromLibrary);
    onClose();
  };

  const handleCancel = () => {
    setAlsoDeleteFromLibrary(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content remove-from-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Trash2 size={24} />
            <span>Remove from Playlist</span>
          </div>
          <button className="modal-close" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="confirmation-message">
            <AlertTriangle size={48} className="warning-icon" />
            <h3>Are you sure you want to remove {trackCount} track{trackCount !== 1 ? 's' : ''} from "{playlistName}"?</h3>
            <p>This action will remove the selected tracks from this playlist only.</p>
          </div>

          <div className="checkbox-section">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={alsoDeleteFromLibrary}
                onChange={(e) => setAlsoDeleteFromLibrary(e.target.checked)}
              />
              <div className="checkbox-content">
                <strong>Also delete from Bonk library</strong>
                <span>This will permanently remove the tracks from your entire Bonk library, not just this playlist.</span>
              </div>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={skipConfirm}
                onChange={(e) => onSetSkipConfirm(e.target.checked)}
              />
              <div className="checkbox-content">
                <strong>Don't show this again</strong>
                <span>Skip this confirmation dialog for future playlist removals.</span>
              </div>
            </label>
          </div>

          {alsoDeleteFromLibrary && (
            <div className="warning-section">
              <AlertTriangle size={16} />
              <div>
                <strong>Warning:</strong> Deleting tracks from the library cannot be undone.
                Make sure you have backups if needed.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleConfirm}
          >
            <Trash2 size={16} />
            Remove {trackCount} Track{trackCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}