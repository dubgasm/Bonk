import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Save, Music, Search } from 'lucide-react';
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

interface GenreManagementSuiteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SortableGenreProps {
  genre: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onDelete: () => void;
}

function SortableGenre({
  genre,
  isEditing,
  editValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
  onDelete,
}: SortableGenreProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: genre });

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
        cursor: 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        marginBottom: '8px',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
      className={`tag-pill ${isDragging ? 'dragging' : ''}`}
    >
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
            <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>⋮⋮</span>
          </div>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 400 }}>{genre}</span>
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
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function GenreManagementSuite({ isOpen, onClose }: GenreManagementSuiteProps) {
  const { genres, addGenre, deleteGenre, renameGenre } = useLibraryStore();

  const [newGenre, setNewGenre] = useState('');
  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editGenreValue, setEditGenreValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!isOpen) return null;

  // Filter genres by search
  const filteredGenres = useMemo(() => {
    if (!searchQuery.trim()) return genres;
    const query = searchQuery.toLowerCase();
    return genres.filter((genre) => genre.toLowerCase().includes(query));
  }, [genres, searchQuery]);

  const handleAddGenre = () => {
    if (!newGenre.trim()) return;
    if (genres.includes(newGenre.trim())) {
      toast.error('Genre already exists');
      return;
    }
    addGenre(newGenre.trim());
    setNewGenre('');
    toast.success(`Genre "${newGenre.trim()}" added`);
  };

  const handleStartEditGenre = (genre: string) => {
    setEditingGenre(genre);
    setEditGenreValue(genre);
  };

  const handleSaveGenre = () => {
    if (editingGenre && editGenreValue.trim()) {
      if (editGenreValue.trim() !== editingGenre && genres.includes(editGenreValue.trim())) {
        toast.error('Genre name already exists');
        return;
      }
      renameGenre(editingGenre, editGenreValue.trim());
      toast.success(`Genre renamed to "${editGenreValue.trim()}"`);
    }
    setEditingGenre(null);
    setEditGenreValue('');
  };

  const handleCancelEditGenre = () => {
    setEditingGenre(null);
    setEditGenreValue('');
  };

  const handleDeleteGenre = (genre: string) => {
    if (confirm(`Delete genre "${genre}" and remove it from all tracks?`)) {
      deleteGenre(genre);
      toast.success(`Genre "${genre}" deleted`);
    }
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    // Genres don't need ordering, but we can keep this for future if needed
    toast.info('Genre reordering not implemented');
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
        style={{ maxWidth: '700px', height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Music size={24} />
            <h2>Genre Management Suite</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>All Genres</h3>

            {/* Search */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search genres..."
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
                  placeholder="New genre name"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGenre();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAddGenre}>
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
            {filteredGenres.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                {searchQuery ? 'No genres match your search' : 'No genres yet'}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredGenres} strategy={verticalListSortingStrategy}>
                  <AnimatePresence mode="popLayout">
                    {filteredGenres.map((genre) => (
                      <SortableGenre
                        key={genre}
                        genre={genre}
                        isEditing={editingGenre === genre}
                        editValue={editGenreValue}
                        onStartEdit={() => handleStartEditGenre(genre)}
                        onSaveEdit={handleSaveGenre}
                        onCancelEdit={handleCancelEditGenre}
                        onEditValueChange={setEditGenreValue}
                        onDelete={() => handleDeleteGenre(genre)}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </DndContext>
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
