import { useState } from 'react';
import { X, GripVertical, Plus } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

interface TagsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TagsModal({ isOpen, onClose }: TagsModalProps) {
  const { tagCategories, addTagCategory, reorderTagCategories } = useLibraryStore();
  const [newCategory, setNewCategory] = useState('');

  if (!isOpen) return null;

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    addTagCategory(newCategory.trim());
    setNewCategory('');
  };

  const moveCategory = (index: number, direction: number) => {
    const toIndex = index + direction;
    reorderTagCategories(index, toIndex);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tag Categories</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          <div className="form-group">
            <label>Add Category</label>
            <div className="tags-input-row">
              <input
                type="text"
                placeholder="e.g., Mood, Genre, Energy"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <button className="btn btn-primary tags-add-btn" type="button" onClick={handleAddCategory}>
                <Plus size={14} />
                Add category
              </button>
            </div>
          </div>

          <div className="tag-pill-list">
            {tagCategories.length === 0 && <span className="tag-empty">No categories yet</span>}
            {tagCategories.map((cat, idx) => (
              <div key={cat} className="tag-pill" style={{ display: 'inline-flex', gap: 8 }}>
                <GripVertical size={14} />
                <span className="tag-name">{cat}</span>
                <div className="tag-reorder-controls">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => moveCategory(idx, -1)}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => moveCategory(idx, 1)}
                    disabled={idx === tagCategories.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
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

