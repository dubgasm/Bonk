import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { Track } from '../types/track';

interface TagSelectorModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TagSelectorModal({ track, isOpen, onClose }: TagSelectorModalProps) {
  const { tagCategories, addTagCategory, setTrackTags } = useLibraryStore();
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');

  if (!isOpen || !track) return null;

  const tags = track.tags || [];

  const handleAdd = () => {
    if (!name.trim()) return;
    if (category.trim()) {
      addTagCategory(category.trim());
    }
    const nextTags = [...tags, { category: category.trim() || 'Uncategorized', name: name.trim() }];
    setTrackTags(track.TrackID, nextTags);
    setCategory('');
    setName('');
  };

  const handleRemove = (idx: number) => {
    const next = [...tags];
    next.splice(idx, 1);
    setTrackTags(track.TrackID, next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Tags</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          <div className="form-group">
            <label>Add Tag</label>
            <div className="tags-input-row">
              <input
                type="text"
                placeholder="Category"
                list="tag-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="tag-categories">
                {tagCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <input
                type="text"
                placeholder="Tag name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <button className="btn btn-primary tags-add-btn" type="button" onClick={handleAdd} disabled={!name.trim()}>
                <Plus size={14} />
                Add tag
              </button>
            </div>
          </div>

          <div className="tag-pill-list">
            {tags.length === 0 && <span className="tag-empty">No tags yet</span>}
            {tags.map((t, idx) => (
              <span key={`${t.category}-${t.name}-${idx}`} className="tag-pill">
                <span className="tag-cat">{t.category || 'Uncategorized'}</span>
                <span className="tag-name">{t.name}</span>
                <button className="tag-remove" onClick={() => handleRemove(idx)} title="Remove tag">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

