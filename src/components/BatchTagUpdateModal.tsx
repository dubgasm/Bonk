import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Tag as TagIcon, Search } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { CustomTag } from '../types/track';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface BatchTagUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackIds: string[];
  trackCount: number;
}

type UpdateMode = 'add' | 'replace' | 'remove';

export default function BatchTagUpdateModal({
  isOpen,
  onClose,
  trackIds,
  trackCount,
}: BatchTagUpdateModalProps) {
  const { tagCategories, batchUpdateTags, getAllTags } = useLibraryStore();
  const [mode, setMode] = useState<UpdateMode>('add');
  const [selectedTags, setSelectedTags] = useState<CustomTag[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(tagCategories[0] || 'Uncategorized');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const allTags = getAllTags();
  const tagsByCategory = useMemo(() => {
    return allTags.reduce((acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      if (!acc[tag.category].includes(tag.name)) {
        acc[tag.category].push(tag.name);
      }
      return acc;
    }, {} as Record<string, string[]>);
  }, [allTags]);

  // Filter tags by search query
  const filteredTagsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return tagsByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, string[]> = {};
    
    Object.entries(tagsByCategory).forEach(([category, tags]) => {
      const matchingTags = tags.filter(
        (tag) => tag.toLowerCase().includes(query) || category.toLowerCase().includes(query)
      );
      if (matchingTags.length > 0) {
        filtered[category] = matchingTags;
      }
    });
    
    return filtered;
  }, [tagsByCategory, searchQuery]);

  const handleAddTag = () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }
    const tag: CustomTag = {
      category: selectedCategory || 'Uncategorized',
      name: newTagName.trim(),
    };
    // Check if tag already selected
    if (!selectedTags.some((t) => t.category === tag.category && t.name === tag.name)) {
      setSelectedTags([...selectedTags, tag]);
      toast.success(`Tag "${tag.name}" added to selection`);
    } else {
      toast.info('Tag already selected');
    }
    setNewTagName('');
  };

  const handleRemoveTag = (index: number) => {
    const removed = selectedTags[index];
    setSelectedTags(selectedTags.filter((_, i) => i !== index));
    toast.success(`Tag "${removed.name}" removed from selection`);
  };

  const handleSelectExistingTag = (category: string, name: string) => {
    const tag: CustomTag = { category, name };
    if (!selectedTags.some((t) => t.category === category && t.name === name)) {
      setSelectedTags([...selectedTags, tag]);
      toast.success(`Tag "${name}" added`);
    } else {
      toast.info('Tag already selected');
    }
  };

  const handleApply = () => {
    if (trackIds.length === 0) {
      toast.error('No tracks selected');
      return;
    }

    if (mode === 'replace' || mode === 'add') {
      if (selectedTags.length === 0) {
        toast.error('Please select at least one tag to add');
        return;
      }
    }

    if (mode === 'remove') {
      if (selectedTags.length === 0) {
        toast.error('Please select at least one tag to remove');
        return;
      }
    }

    batchUpdateTags(trackIds, selectedTags, selectedTags, mode);
    
    const modeText = mode === 'add' ? 'added to' : mode === 'replace' ? 'replaced on' : 'removed from';
    toast.success(`Tags ${modeText} ${trackCount} track${trackCount !== 1 ? 's' : ''}`);
    
    onClose();
    setSelectedTags([]);
    setNewTagName('');
    setMode('add');
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
        style={{ maxWidth: '800px' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TagIcon size={24} />
            <h2>Batch Update Tags</h2>
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
              {(['add', 'replace', 'remove'] as UpdateMode[]).map((m) => (
                <motion.label
                  key={m}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', background: mode === m ? 'var(--bg-hover)' : 'transparent', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}` }}
                >
                  <input
                    type="radio"
                    value={m}
                    checked={mode === m}
                    onChange={(e) => setMode(e.target.value as UpdateMode)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>
                    {m === 'add' ? 'Add Tags' : m === 'replace' ? 'Replace All Tags' : 'Remove Tags'}
                  </span>
                </motion.label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Selected Tags</label>
            {selectedTags.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', marginTop: '8px' }}>
                No tags selected
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}
              >
                <AnimatePresence>
                  {selectedTags.map((tag, index) => (
                    <motion.div
                      key={`${tag.category}-${tag.name}-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="tag-pill"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tag.category}:</span>
                      <span style={{ fontSize: '12px' }}>{tag.name}</span>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleRemoveTag(index)}
                        title="Remove"
                        style={{ padding: '4px 6px', marginLeft: '4px' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Add New Tag</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '180px' }}
              >
                {tagCategories.length === 0 ? (
                  <option value="Uncategorized">Uncategorized</option>
                ) : (
                  tagCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                )}
              </select>
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
                style={{ flex: 1 }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn btn-primary"
                onClick={handleAddTag}
              >
                <Plus size={14} />
                Add
              </motion.button>
            </div>
          </div>

          {Object.keys(tagsByCategory).length > 0 && (
            <div className="form-group">
              <label>Or Select Existing Tag</label>
              
              {/* Search */}
              <div style={{ marginTop: '8px', marginBottom: '12px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                {Object.keys(filteredTagsByCategory).length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    {searchQuery ? 'No tags match your search' : 'No tags available'}
                  </div>
                ) : (
                  Object.entries(filteredTagsByCategory).map(([category, tags]) => (
                    <div key={category} style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {category}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <AnimatePresence>
                          {tags.map((tagName) => {
                            const isSelected = selectedTags.some((t) => t.category === category && t.name === tagName);
                            return (
                              <motion.button
                                key={tagName}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`tag-pill ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectExistingTag(category, tagName)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: isSelected ? 'white' : 'var(--text-primary)',
                                  transition: 'all 0.2s',
                                }}
                              >
                                {tagName}
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
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
