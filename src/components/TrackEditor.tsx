import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { Track } from '../types/track';

export default function TrackEditor() {
  const { selectedTrack, setSelectedTrack, updateTrack } = useLibraryStore();
  const [editedTrack, setEditedTrack] = useState<Track | null>(null);

  useEffect(() => {
    setEditedTrack(selectedTrack);
  }, [selectedTrack]);

  if (!editedTrack) return null;

  const handleSave = () => {
    if (editedTrack) {
      updateTrack(editedTrack.TrackID, editedTrack);
      setSelectedTrack(editedTrack);
    }
  };

  const handleChange = (field: keyof Track, value: string) => {
    setEditedTrack({ ...editedTrack, [field]: value });
  };

  return (
    <div className="track-editor">
      <div className="editor-header">
        <h2>Edit Track</h2>
        <button className="close-btn" onClick={() => setSelectedTrack(null)}>
          <X size={20} />
        </button>
      </div>

      <div className="editor-content">
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={editedTrack.Name || ''}
            onChange={(e) => handleChange('Name', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Artist</label>
          <input
            type="text"
            value={editedTrack.Artist || ''}
            onChange={(e) => handleChange('Artist', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Album</label>
          <input
            type="text"
            value={editedTrack.Album || ''}
            onChange={(e) => handleChange('Album', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Genre</label>
          <input
            type="text"
            value={editedTrack.Genre || ''}
            onChange={(e) => handleChange('Genre', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>BPM</label>
            <input
              type="text"
              value={editedTrack.AverageBpm || ''}
              onChange={(e) => handleChange('AverageBpm', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Key</label>
            <input
              type="text"
              value={editedTrack.Tonality || ''}
              onChange={(e) => handleChange('Tonality', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Year</label>
            <input
              type="text"
              value={editedTrack.Year || ''}
              onChange={(e) => handleChange('Year', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Rating</label>
            <input
              type="text"
              value={editedTrack.Rating || ''}
              onChange={(e) => handleChange('Rating', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Remixer</label>
          <input
            type="text"
            value={editedTrack.Remixer || ''}
            onChange={(e) => handleChange('Remixer', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Label</label>
          <input
            type="text"
            value={editedTrack.Label || ''}
            onChange={(e) => handleChange('Label', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Mix</label>
          <input
            type="text"
            value={editedTrack.Mix || ''}
            onChange={(e) => handleChange('Mix', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Grouping</label>
          <input
            type="text"
            value={editedTrack.Grouping || ''}
            onChange={(e) => handleChange('Grouping', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Comments</label>
          <textarea
            value={editedTrack.Comments || ''}
            onChange={(e) => handleChange('Comments', e.target.value)}
            rows={3}
          />
        </div>

        <div className="editor-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

