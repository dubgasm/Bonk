import { useState, useEffect } from 'react';
import { X, Music, FileEdit } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface BatchGenreUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackIds: string[];
  trackCount: number;
}

export default function BatchGenreUpdateModal({
  isOpen,
  onClose,
  trackIds,
  trackCount,
}: BatchGenreUpdateModalProps) {
  const { genres, batchUpdateGenres, addGenre } = useLibraryStore();
  const { tagWriteSettings } = useSettingsStore();
  const getLibrary = useLibraryStore.getState;
  const [selectedGenre, setSelectedGenre] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [mode, setMode] = useState<'set' | 'clear'>('set');
  const [writeTagsAfter, setWriteTagsAfter] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGenre('');
      setNewGenre('');
      setMode('set');
      setWriteTagsAfter(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (trackIds.length === 0) {
      toast.error('No tracks selected');
      return;
    }

    if (mode === 'set') {
      if (!selectedGenre.trim() && !newGenre.trim()) {
        toast.error('Please select or enter a genre');
        return;
      }

      const genreToApply = selectedGenre || newGenre.trim();
      
      // Add new genre to list if it doesn't exist
      if (newGenre.trim() && !genres.includes(newGenre.trim())) {
        addGenre(newGenre.trim());
      }

      batchUpdateGenres(trackIds, genreToApply.trim(), 'set');
      toast.success(`Genre "${genreToApply}" applied to ${trackCount} track${trackCount !== 1 ? 's' : ''}`);
    } else {
      batchUpdateGenres(trackIds, '', 'clear');
      toast.success(`Genre cleared from ${trackCount} track${trackCount !== 1 ? 's' : ''}`);
    }

    // Get updated tracks for syncing - get fresh state from store after update
    const currentLibrary = getLibrary().library;
    const updatedTracks = currentLibrary?.tracks.filter(track => trackIds.includes(track.TrackID)) || [];

    // Write tags to files if requested
    if (writeTagsAfter && updatedTracks.length > 0) {
      if (!window.electronAPI?.writeTags) {
        toast.error('Write Tags feature not available');
      } else {
        try {
          // Filter out tracks without Location (can't write tags without file path)
          const tracksWithLocation = updatedTracks.filter(track => track.Location);
          const tracksWithoutLocation = updatedTracks.length - tracksWithLocation.length;
          
          if (tracksWithLocation.length === 0) {
            toast.error(`Cannot write tags: None of the selected tracks have file locations. ${tracksWithoutLocation > 0 ? `${tracksWithoutLocation} track(s) missing file paths.` : ''}`);
            return;
          }
          
          if (tracksWithoutLocation > 0) {
            toast.warning(`${tracksWithoutLocation} track(s) skipped (no file location). Writing tags to ${tracksWithLocation.length} track(s)...`);
          } else {
            toast.info(`Writing tags to ${tracksWithLocation.length} file(s)...`);
          }
          
          const result = await window.electronAPI.writeTags(tracksWithLocation, tagWriteSettings);
          if (result.success) {
            toast.success(`Tags written to ${result.count} file(s)`);
            if (result.errors && result.errors.length > 0) {
              console.error('Tag write errors:', result.errors);
              toast.warning(`${result.errors.length} file(s) had errors. Check console for details.`);
            }
          } else {
            toast.error(`Failed to write tags: ${result.error}`);
          }
        } catch (error: any) {
          toast.error(`Error writing tags: ${error.message}`);
        }
      }
    }

    onClose();
    setSelectedGenre('');
    setNewGenre('');
    setMode('set');
    setWriteTagsAfter(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="modal-content modal-large"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Music size={24} />
            <h2>Batch Update Genres</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}
          >
            <strong>{trackCount}</strong> track{trackCount !== 1 ? 's' : ''} selected
          </motion.div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Update Mode</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <motion.label
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: mode === 'set' ? 'var(--bg-hover)' : 'transparent',
                  border: `1px solid ${mode === 'set' ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <input
                  type="radio"
                  value="set"
                  checked={mode === 'set'}
                  onChange={() => setMode('set')}
                  style={{ cursor: 'pointer' }}
                />
                <span>Set Genre</span>
              </motion.label>
              <motion.label
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: mode === 'clear' ? 'var(--bg-hover)' : 'transparent',
                  border: `1px solid ${mode === 'clear' ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <input
                  type="radio"
                  value="clear"
                  checked={mode === 'clear'}
                  onChange={() => setMode('clear')}
                  style={{ cursor: 'pointer' }}
                />
                <span>Clear Genre</span>
              </motion.label>
            </div>
          </div>

          {mode === 'set' && (
            <>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Select Existing Genre</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => {
                    setSelectedGenre(e.target.value);
                    setNewGenre('');
                  }}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <option value="">-- Select a genre --</option>
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Or Enter New Genre</label>
                <input
                  type="text"
                  placeholder="Type new genre name"
                  value={newGenre}
                  onChange={(e) => {
                    setNewGenre(e.target.value);
                    setSelectedGenre('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply();
                    }
                  }}
                  style={{ width: '100%', marginTop: '8px' }}
                />
              </div>
            </>
          )}

          {mode === 'clear' && (
            <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              This will remove the genre from all selected tracks.
            </div>
          )}

          <div className="form-group" style={{ marginTop: '24px', marginBottom: '20px' }}>
            <label style={{ marginBottom: '12px', display: 'block', fontWeight: 500 }}>Write Tags to Files (Optional)</label>
            <motion.label
              whileHover={{ scale: 1.02 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: '6px',
                background: writeTagsAfter ? 'var(--bg-hover)' : 'transparent',
                border: `1px solid ${writeTagsAfter ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={writeTagsAfter}
                onChange={(e) => setWriteTagsAfter(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <FileEdit size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>Write Tags to Files</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Updates genre in audio file metadata (ID3 tags)
                </div>
              </div>
            </motion.label>
            {!writeTagsAfter && (
              <div style={{ 
                marginTop: '10px', 
                padding: '8px 12px', 
                background: 'var(--bg-tertiary)', 
                borderRadius: '6px', 
                color: 'var(--text-secondary)', 
                fontSize: '11px' 
              }}>
                💡 Tip: Enable this option to automatically update genre tags in audio files after applying changes
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary"
            onClick={handleApply}
          >
            Apply to {trackCount} Track{trackCount !== 1 ? 's' : ''}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
