import { useState } from 'react';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import { SmartListProperty, SmartListOperator, SmartListCondition } from '../types/track';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, conditions: SmartListCondition[], logicalOperator: number) => Promise<void>;
}

const PROPERTY_OPTIONS = [
  { value: SmartListProperty.ARTIST, label: 'Artist' },
  { value: SmartListProperty.ALBUM, label: 'Album' },
  { value: SmartListProperty.ALBUM_ARTIST, label: 'Album Artist' },
  { value: SmartListProperty.ORIGINAL_ARTIST, label: 'Original Artist' },
  { value: SmartListProperty.BPM, label: 'BPM' },
  { value: SmartListProperty.GROUPING, label: 'Grouping' },
  { value: SmartListProperty.COMMENTS, label: 'Comments' },
  { value: SmartListProperty.PRODUCER, label: 'Producer' },
  { value: SmartListProperty.STOCK_DATE, label: 'Stock Date' },
  { value: SmartListProperty.DATE_CREATED, label: 'Date Created' },
  { value: SmartListProperty.COUNTER, label: 'Counter' },
  { value: SmartListProperty.FILENAME, label: 'Filename' },
  { value: SmartListProperty.GENRE, label: 'Genre' },
  { value: SmartListProperty.KEY, label: 'Key' },
  { value: SmartListProperty.LABEL, label: 'Label' },
  { value: SmartListProperty.MIX_NAME, label: 'Mix Name' },
  { value: SmartListProperty.MYTAG, label: 'My Tag' },
  { value: SmartListProperty.RATING, label: 'Rating' },
  { value: SmartListProperty.DATE_RELEASED, label: 'Date Released' },
  { value: SmartListProperty.REMIXED_BY, label: 'Remixed By' },
  { value: SmartListProperty.DURATION, label: 'Duration' },
  { value: SmartListProperty.YEAR, label: 'Year' },
];

const OPERATOR_OPTIONS = [
  { value: SmartListOperator.EQUAL, label: 'is' },
  { value: SmartListOperator.NOT_EQUAL, label: 'is not' },
  { value: SmartListOperator.CONTAINS, label: 'contains' },
  { value: SmartListOperator.NOT_CONTAINS, label: 'does not contain' },
  { value: SmartListOperator.STARTS_WITH, label: 'starts with' },
  { value: SmartListOperator.ENDS_WITH, label: 'ends with' },
  { value: SmartListOperator.GREATER, label: 'is greater than' },
  { value: SmartListOperator.LESS, label: 'is less than' },
  { value: SmartListOperator.IN_RANGE, label: 'is between' },
  { value: SmartListOperator.IN_LAST, label: 'in the last' },
  { value: SmartListOperator.NOT_IN_LAST, label: 'not in the last' },
];

export default function SmartPlaylistModal({ isOpen, onClose, onCreate }: SmartPlaylistModalProps) {
  const [playlistName, setPlaylistName] = useState('');
  const [logicalOperator, setLogicalOperator] = useState(1); // 1 = ALL, 0 = ANY
  const [conditions, setConditions] = useState<SmartListCondition[]>([
    { property: SmartListProperty.GENRE, operator: SmartListOperator.EQUAL, value_left: '' }
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const addCondition = () => {
    setConditions([...conditions, {
      property: SmartListProperty.GENRE,
      operator: SmartListOperator.EQUAL,
      value_left: ''
    }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, field: keyof SmartListCondition, value: string) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    setConditions(updatedConditions);
  };

  const handleCreate = async () => {
    if (!playlistName.trim()) {
      alert('Please enter a playlist name');
      return;
    }

    if (conditions.some(c => !c.value_left.trim())) {
      alert('Please fill in all condition values');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(playlistName.trim(), conditions, logicalOperator);
      // Reset form
      setPlaylistName('');
      setConditions([{ property: SmartListProperty.GENRE, operator: SmartListOperator.EQUAL, value_left: '' }]);
      onClose();
    } catch (error) {
      alert(`Failed to create smart playlist: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setPlaylistName('');
      setConditions([{ property: SmartListProperty.GENRE, operator: SmartListOperator.EQUAL, value_left: '' }]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content smart-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={24} />
            <span>Create Smart Playlist</span>
          </div>
          <button className="modal-close" onClick={handleClose} disabled={isCreating}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Playlist Name</label>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Enter playlist name..."
              disabled={isCreating}
            />
          </div>

          <div className="form-group">
            <label>Match</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  value={1}
                  checked={logicalOperator === 1}
                  onChange={(e) => setLogicalOperator(parseInt(e.target.value))}
                  disabled={isCreating}
                />
                <span>All of the following conditions</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  value={2}
                  checked={logicalOperator === 2}
                  onChange={(e) => setLogicalOperator(parseInt(e.target.value))}
                  disabled={isCreating}
                />
                <span>Any of the following conditions</span>
              </label>
            </div>
          </div>

          <div className="conditions-section">
            {conditions.map((condition, index) => (
              <div key={index} className="condition-row">
                <select
                  value={condition.property}
                  onChange={(e) => updateCondition(index, 'property', e.target.value)}
                  disabled={isCreating}
                >
                  {PROPERTY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  disabled={isCreating}
                >
                  {OPERATOR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={condition.value_left}
                  onChange={(e) => updateCondition(index, 'value_left', e.target.value)}
                  placeholder="Value..."
                  disabled={isCreating}
                />

                {condition.operator === SmartListOperator.IN_RANGE && (
                  <input
                    type="text"
                    value={condition.value_right || ''}
                    onChange={(e) => updateCondition(index, 'value_right', e.target.value)}
                    placeholder="And..."
                    disabled={isCreating}
                  />
                )}

                {conditions.length > 1 && (
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => removeCondition(index)}
                    disabled={isCreating}
                    title="Remove condition"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            <button
              className="btn-secondary"
              onClick={addCondition}
              disabled={isCreating}
              style={{ marginTop: '10px' }}
            >
              <Plus size={16} />
              Add Condition
            </button>
          </div>

          <div className="smart-playlist-info">
            <p><strong>Smart Playlists</strong> automatically include tracks that match your criteria. They update dynamically as you add or modify tracks in your library.</p>
            <p><em>Note: Smart playlists are created in your Rekordbox database and will be visible when you import from Rekordbox.</em></p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={isCreating || !playlistName.trim()}
          >
            <Sparkles size={16} />
            {isCreating ? 'Creating...' : 'Create Smart Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}