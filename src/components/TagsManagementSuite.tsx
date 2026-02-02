import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Save, Tag as TagIcon, GripVertical, Search } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface TagsManagementSuiteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SortableCategoryProps {
  category: string;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableCategory({
  category,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
  onDelete,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        cursor: !isEditing ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: isSelected ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
        marginBottom: '8px',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
      className={`tag-pill ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={!isEditing ? onSelect : undefined}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
        }}
      >
        <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
      </div>
      {isEditing ? (
        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '13px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onSaveEdit();
            }}
            style={{ padding: '6px 10px' }}
          >
            <Save size={12} />
          </button>
        </div>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>
            {category}
          </span>
          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              title="Rename"
            >
              <Edit2 size={12} />
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
            {canMoveUp && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                title="Move up"
              >
                ↑
              </button>
            )}
            {canMoveDown && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                title="Move down"
              >
                ↓
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function TagsManagementSuite({ isOpen, onClose }: TagsManagementSuiteProps) {
  const {
    tagCategories,
    addTagCategory,
    deleteTagCategory,
    renameTagCategory,
    reorderTagCategories,
    getAllTags,
    deleteTagFromAllTracks,
  } = useLibraryStore();

  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<{ category: string; name: string } | null>(null);
  const [editTagValue, setEditTagValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return tagCategories;
    const query = searchQuery.toLowerCase();
    return tagCategories.filter((cat) => cat.toLowerCase().includes(query));
  }, [tagCategories, searchQuery]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!selectedCategory) return [];
    const tags = tagsByCategory[selectedCategory] || [];
    if (!tagSearchQuery.trim()) return tags;
    const query = tagSearchQuery.toLowerCase();
    return tags.filter((tag) => tag.toLowerCase().includes(query));
  }, [tagsByCategory, selectedCategory, tagSearchQuery]);

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (tagCategories.includes(newCategory.trim())) {
      toast.error('Category already exists');
      return;
    }
    addTagCategory(newCategory.trim());
    setNewCategory('');
    toast.success(`Category "${newCategory.trim()}" added`);
  };

  const handleStartEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditCategoryValue(category);
  };

  const handleSaveCategory = () => {
    if (editingCategory && editCategoryValue.trim()) {
      if (editCategoryValue.trim() !== editingCategory && tagCategories.includes(editCategoryValue.trim())) {
        toast.error('Category name already exists');
        return;
      }
      renameTagCategory(editingCategory, editCategoryValue.trim());
      if (selectedCategory === editingCategory) {
        setSelectedCategory(editCategoryValue.trim());
      }
      toast.success(`Category renamed to "${editCategoryValue.trim()}"`);
    }
    setEditingCategory(null);
    setEditCategoryValue('');
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryValue('');
  };

  const handleDeleteCategory = (category: string) => {
    if (confirm(`Delete category "${category}" and remove all its tags from tracks?`)) {
      deleteTagCategory(category);
      if (selectedCategory === category) {
        setSelectedCategory(null);
      }
      toast.success(`Category "${category}" deleted`);
    }
  };

  const handleAddTag = () => {
    if (!selectedCategory || !newTagName.trim()) return;
    toast.info('To add tags, select tracks and use "Batch Update Tags" or click "Add tags" in the Tags column.\n\nTags will appear here once they\'re added to tracks.');
    setNewTagName('');
  };

  const handleDeleteTag = (category: string, name: string) => {
    if (confirm(`Delete tag "${category}: ${name}" from all tracks?`)) {
      deleteTagFromAllTracks(category, name);
      toast.success(`Tag "${name}" deleted from all tracks`);
    }
  };

  const handleStartEditTag = (category: string, name: string) => {
    setEditingTag({ category, name });
    setEditTagValue(name);
  };

  const handleSaveTag = () => {
    if (editingTag && editTagValue.trim() && editingTag.name !== editTagValue.trim()) {
      deleteTagFromAllTracks(editingTag.category, editingTag.name);
      toast.success(`Tag renamed. Note: You'll need to re-add it to tracks with the new name.`);
    }
    setEditingTag(null);
    setEditTagValue('');
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditTagValue('');
  };

  const moveCategory = (index: number, direction: number) => {
    const toIndex = index + direction;
    reorderTagCategories(index, toIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tagCategories.indexOf(active.id as string);
      const newIndex = tagCategories.indexOf(over.id as string);
      reorderTagCategories(oldIndex, newIndex);
      toast.success('Categories reordered');
    }
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
        style={{ maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TagIcon size={24} />
            <h2>Tags Management Suite</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden' }}>
          {/* Left panel: Categories */}
          <div style={{ width: '300px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Categories</h3>
              
              {/* Search */}
              <div style={{ marginBottom: '12px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search categories..."
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

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="New category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleAddCategory}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCategories.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                  {searchQuery ? 'No categories match your search' : 'No categories yet'}
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredCategories} strategy={verticalListSortingStrategy}>
                    <AnimatePresence mode="popLayout">
                      {filteredCategories.map((cat, idx) => (
                        <SortableCategory
                          key={cat}
                          category={cat}
                          index={idx}
                          isSelected={selectedCategory === cat}
                          isEditing={editingCategory === cat}
                          editValue={editCategoryValue}
                          onSelect={() => setSelectedCategory(cat)}
                          onStartEdit={() => handleStartEditCategory(cat)}
                          onSaveEdit={handleSaveCategory}
                          onCancelEdit={handleCancelEditCategory}
                          onEditValueChange={setEditCategoryValue}
                          onDelete={() => handleDeleteCategory(cat)}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < filteredCategories.length - 1}
                          onMoveUp={() => moveCategory(idx, -1)}
                          onMoveDown={() => moveCategory(idx, 1)}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Right panel: Tags in selected category */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedCategory ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                    Tags in "{selectedCategory}"
                  </h3>
                  
                  {/* Search tags */}
                  <div style={{ marginBottom: '12px', position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search tags..."
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
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

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="New tag name"
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
                      <button className="btn btn-primary" onClick={handleAddTag}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredTags.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                      {tagSearchQuery ? 'No tags match your search' : tagsByCategory[selectedCategory]?.length === 0 ? (
                        <>
                          No tags in this category yet
                          <br />
                          <span style={{ fontSize: '11px', marginTop: '8px', display: 'block' }}>
                            Tags appear here when you add them to tracks
                          </span>
                        </>
                      ) : 'No tags found'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <AnimatePresence>
                        {filteredTags.map((tagName) => {
                          const isEditing = editingTag?.category === selectedCategory && editingTag?.name === tagName;
                          return (
                            <motion.div
                              key={tagName}
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
                              {isEditing ? (
                                <>
                                  <input
                                    type="text"
                                    value={editTagValue}
                                    onChange={(e) => setEditTagValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveTag();
                                      if (e.key === 'Escape') handleCancelEditTag();
                                    }}
                                    autoFocus
                                    style={{ width: '120px', padding: '4px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: '4px' }}
                                  />
                                  <button className="btn btn-sm btn-primary" onClick={handleSaveTag} style={{ padding: '4px 8px' }}>
                                    <Save size={10} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '12px' }}>{tagName}</span>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleStartEditTag(selectedCategory, tagName)}
                                    title="Rename"
                                    style={{ padding: '4px 6px' }}
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleDeleteTag(selectedCategory, tagName)}
                                    title="Delete from all tracks"
                                    style={{ padding: '4px 6px' }}
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Select a category to view its tags
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
