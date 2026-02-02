import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  trackCount: number;
  contextLabel?: string;
}

export default function DeleteTracksModal({
  isOpen,
  onClose,
  onConfirm,
  trackCount,
  contextLabel,
}: DeleteTracksModalProps) {
  if (!isOpen) return null;

  const isSingle = trackCount === 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content remove-from-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Trash2 size={24} />
            <span>Delete Tracks</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="confirmation-message">
            <AlertTriangle size={48} className="warning-icon" />
            <h3>
              Delete {trackCount} track{isSingle ? '' : 's'}{contextLabel ? ` from ${contextLabel}` : ''}?
            </h3>
            <p>This removes the tracks from Bonk’s library. This cannot be undone.</p>
          </div>

          <div className="warning-section">
            <AlertTriangle size={16} />
            <div>
              <strong>Tip:</strong> If you’re syncing to Rekordbox DB, use <strong>Overwrite</strong> mode to apply deletions (keep backups).
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            <Trash2 size={16} />
            Delete {trackCount} Track{trackCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

