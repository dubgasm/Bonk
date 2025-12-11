import { useState, useEffect } from 'react';
import { X, Save, Tag, Plus, XCircle } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { Track } from '../types/track';

export default function TrackEditor() {
  const { selectedTrack, setSelectedTrack, updateTrack, genres } = useLibraryStore();
  const [newTagCategory, setNewTagCategory] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editedTrack, setEditedTrack] = useState<Track | null>(null);
  const [genreInput, setGenreInput] = useState('');
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  useEffect(() => {
    setEditedTrack(selectedTrack);
    setGenreInput(selectedTrack?.Genre || '');
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

  const handleGenreChange = (value: string) => {
    setGenreInput(value);
    setShowGenreDropdown(true);
    handleChange('Genre', value);
  };

  const handleGenreSelect = (genre: string) => {
    setGenreInput(genre);
    setShowGenreDropdown(false);
    handleChange('Genre', genre);
  };

  // Filter genres based on input
  const filteredGenres = genres.filter((g) =>
    g.toLowerCase().includes(genreInput.toLowerCase())
  );

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const nextTags = [...(editedTrack.tags || []), { category: newTagCategory.trim() || 'Uncategorized', name: newTagName.trim() }];
    setEditedTrack({ ...editedTrack, tags: nextTags });
    setNewTagCategory('');
    setNewTagName('');
  };

  const handleRemoveTag = (index: number) => {
    const next = [...(editedTrack.tags || [])];
    next.splice(index, 1);
    setEditedTrack({ ...editedTrack, tags: next });
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

        <div className="form-group" style={{ position: 'relative' }}>
          <label>Genre</label>
          <input
            type="text"
            value={genreInput}
            onChange={(e) => handleGenreChange(e.target.value)}
            onFocus={() => setShowGenreDropdown(true)}
            onBlur={() => {
              // Delay hiding to allow dropdown click
              setTimeout(() => setShowGenreDropdown(false), 200);
            }}
            placeholder="Type or select a genre"
            list="genre-list"
          />
          {showGenreDropdown && filteredGenres.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {filteredGenres.slice(0, 10).map((genre) => (
                <div
                  key={genre}
                  onClick={() => handleGenreSelect(genre)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                >
                  {genre}
                </div>
              ))}
            </div>
          )}
          <datalist id="genre-list">
            {genres.map((genre) => (
              <option key={genre} value={genre} />
            ))}
          </datalist>
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

        <div className="form-group">
          <label className="tags-label">
            <Tag size={16} />
            Custom Tags
          </label>
          <div className="tags-input-row">
            <input
              type="text"
              placeholder="Category (optional)"
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
            />
            <input
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <button className="btn btn-secondary tags-add-btn" type="button" onClick={handleAddTag} disabled={!newTagName.trim()}>
              <Plus size={14} />
              Add
            </button>
          </div>
          <div className="tag-pill-list">
            {(editedTrack.tags || []).map((tag, idx) => (
              <span key={`${tag.category}-${tag.name}-${idx}`} className="tag-pill">
                <span className="tag-cat">{tag.category || 'Uncategorized'}</span>
                <span className="tag-name">{tag.name}</span>
                <button className="tag-remove" onClick={() => handleRemoveTag(idx)} type="button" title="Remove tag">
                  <XCircle size={14} />
                </button>
              </span>
            ))}
            {(editedTrack.tags || []).length === 0 && (
              <span className="tag-empty">No custom tags yet</span>
            )}
          </div>
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

