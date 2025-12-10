import { useState } from 'react';
import { X, Zap, Play, AlertTriangle } from 'lucide-react';

interface SmartFixesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTracks: string[];
  totalTracks: number;
  onApplyFixes: (fixes: SmartFixConfig) => Promise<void>;
}

export interface SmartFixConfig {
  // Extract Artist From Title
  extractArtistEnabled: boolean;
  extractArtistSeparator: string;
  extractArtistResultNumber: number;

  // Replace Characters With Space
  replaceCharsEnabled: boolean;
  replaceCharsList: string;

  // Remove Garbage Characters
  removeGarbageEnabled: boolean;
  removeGarbageFields: string[]; // title, artist, album, etc.

  // Add (Re)mix Parenthesis
  addRemixParenthesisEnabled: boolean;
  addRemixParenthesisFields: string[]; // title, artist, album, etc.

  // Extract Remixer
  extractRemixerEnabled: boolean;

  // Remove URLs
  removeUrlsEnabled: boolean;
  removeUrlsDeleteAll: boolean;
  removeUrlsFields: string[]; // title, artist, album, comments, etc.

  // Fix Casing
  fixCasingEnabled: boolean;
  fixCasingFields: string[]; // title, artist, album, etc.

  // Remove Number Prefix
  removeNumberPrefixEnabled: boolean;
  removeNumberPrefixFields: string[]; // title, artist, album, etc.
}

const FIELD_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'genre', label: 'Genre' },
  { value: 'comments', label: 'Comments' },
  { value: 'label', label: 'Label' },
  { value: 'remixer', label: 'Remixer' },
];

export default function SmartFixesModal({ isOpen, onClose, selectedTracks, totalTracks, onApplyFixes }: SmartFixesModalProps) {
  const [config, setConfig] = useState<SmartFixConfig>({
    // Extract Artist From Title
    extractArtistEnabled: false,
    extractArtistSeparator: ' - ',
    extractArtistResultNumber: 1,

    // Replace Characters With Space
    replaceCharsEnabled: false,
    replaceCharsList: '_',

    // Remove Garbage Characters
    removeGarbageEnabled: false,
    removeGarbageFields: ['title', 'artist', 'album'],

    // Add (Re)mix Parenthesis
    addRemixParenthesisEnabled: false,
    addRemixParenthesisFields: ['title'],

    // Extract Remixer
    extractRemixerEnabled: false,

    // Remove URLs
    removeUrlsEnabled: false,
    removeUrlsDeleteAll: false,
    removeUrlsFields: ['title', 'comments'],

    // Fix Casing
    fixCasingEnabled: false,
    fixCasingFields: ['title', 'artist', 'album'],

    // Remove Number Prefix
    removeNumberPrefixEnabled: false,
    removeNumberPrefixFields: ['title'],
  });

  const [isApplying, setIsApplying] = useState(false);

  const updateConfig = (field: keyof SmartFixConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const toggleField = (field: keyof SmartFixConfig, value: string) => {
    const currentFields = config[field] as string[];
    const newFields = currentFields.includes(value)
      ? currentFields.filter(f => f !== value)
      : [...currentFields, value];
    updateConfig(field, newFields);
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyFixes(config);
    } catch (error) {
      alert(`Error applying smart fixes: ${error}`);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    if (!isApplying) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const trackCount = selectedTracks.length || totalTracks;
  const isAllTracks = selectedTracks.length === 0;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content smart-fixes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Zap size={24} />
            <span>Smart Fixes</span>
          </div>
          <button className="modal-close" onClick={handleClose} disabled={isApplying}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="smart-fixes-info">
            <AlertTriangle size={16} />
            <div>
              <strong>About Smart Fixes:</strong> These intelligent text processing tools help clean up and standardize your track metadata.
              {isAllTracks ? ' This will process all tracks in your library.' : ` This will process ${trackCount} selected track${trackCount !== 1 ? 's' : ''}.`}
            </div>
          </div>

          <div className="smart-fixes-sections">
            {/* Extract Artist From Title */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.extractArtistEnabled}
                  onChange={(e) => updateConfig('extractArtistEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Extract Artist From Title</h3>
              </div>
              <p className="fix-description">
                Split track titles on a separator and extract artist information. Example: "Daft Punk - Touch" → Artist: "Daft Punk", Title: "Touch"
              </p>
              {config.extractArtistEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Separator:</label>
                    <input
                      type="text"
                      value={config.extractArtistSeparator}
                      onChange={(e) => updateConfig('extractArtistSeparator', e.target.value)}
                      placeholder=" - "
                      disabled={isApplying}
                    />
                  </div>
                  <div className="option-group">
                    <label>Result Number:</label>
                    <input
                      type="number"
                      min="1"
                      value={config.extractArtistResultNumber}
                      onChange={(e) => updateConfig('extractArtistResultNumber', parseInt(e.target.value) || 1)}
                      disabled={isApplying}
                    />
                    <span className="option-help">
                      Which part to use as artist (1 = first part, 2 = second part, etc.)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Replace Characters With Space */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.replaceCharsEnabled}
                  onChange={(e) => updateConfig('replaceCharsEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Replace Characters With Space</h3>
              </div>
              <p className="fix-description">
                Replace specified characters with spaces. Example: "Dark_Side_of_my_Room" → "Dark Side of my Room"
              </p>
              {config.replaceCharsEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Characters to replace:</label>
                    <input
                      type="text"
                      value={config.replaceCharsList}
                      onChange={(e) => updateConfig('replaceCharsList', e.target.value)}
                      placeholder="_"
                      disabled={isApplying}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Remove Garbage Characters */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.removeGarbageEnabled}
                  onChange={(e) => updateConfig('removeGarbageEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Remove Garbage Characters</h3>
              </div>
              <p className="fix-description">
                Clean up unwanted characters including multiple spaces, leading/trailing spaces, and special characters like [, ], |, -
              </p>
              {config.removeGarbageEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Apply to fields:</label>
                    <div className="field-checkboxes">
                      {FIELD_OPTIONS.map(field => (
                        <label key={field.value} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={config.removeGarbageFields.includes(field.value)}
                            onChange={() => toggleField('removeGarbageFields', field.value)}
                            disabled={isApplying}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Add (Re)mix Parenthesis */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.addRemixParenthesisEnabled}
                  onChange={(e) => updateConfig('addRemixParenthesisEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Add (Re)mix Parenthesis</h3>
              </div>
              <p className="fix-description">
                Add parentheses around remix information. Example: "Green Bottle - Original Mix" → "Green Bottle (Original Mix)"
              </p>
              {config.addRemixParenthesisEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Apply to fields:</label>
                    <div className="field-checkboxes">
                      {FIELD_OPTIONS.map(field => (
                        <label key={field.value} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={config.addRemixParenthesisFields.includes(field.value)}
                            onChange={() => toggleField('addRemixParenthesisFields', field.value)}
                            disabled={isApplying}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Extract Remixer */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.extractRemixerEnabled}
                  onChange={(e) => updateConfig('extractRemixerEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Extract Remixer</h3>
              </div>
              <p className="fix-description">
                Extract remixer information from titles and populate the Remixer field. Example: "At Night (Purple Disco Machine Extended Remix)" → Remixer: "Purple Disco Machine"
              </p>
            </div>

            {/* Remove URLs */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.removeUrlsEnabled}
                  onChange={(e) => updateConfig('removeUrlsEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Remove URLs</h3>
              </div>
              <p className="fix-description">
                Detect and remove URLs from fields, keeping the rest of the content intact.
              </p>
              {config.removeUrlsEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={config.removeUrlsDeleteAll}
                        onChange={(e) => updateConfig('removeUrlsDeleteAll', e.target.checked)}
                        disabled={isApplying}
                      />
                      <span>Delete all text if URL is found</span>
                    </label>
                  </div>
                  <div className="option-group">
                    <label>Apply to fields:</label>
                    <div className="field-checkboxes">
                      {FIELD_OPTIONS.map(field => (
                        <label key={field.value} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={config.removeUrlsFields.includes(field.value)}
                            onChange={() => toggleField('removeUrlsFields', field.value)}
                            disabled={isApplying}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fix Casing */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.fixCasingEnabled}
                  onChange={(e) => updateConfig('fixCasingEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Fix Casing</h3>
              </div>
              <p className="fix-description">
                Convert ALL UPPERCASE or all lowercase text to proper Title Case.
              </p>
              {config.fixCasingEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Apply to fields:</label>
                    <div className="field-checkboxes">
                      {FIELD_OPTIONS.map(field => (
                        <label key={field.value} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={config.fixCasingFields.includes(field.value)}
                            onChange={() => toggleField('fixCasingFields', field.value)}
                            disabled={isApplying}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Remove Number Prefix */}
            <div className="fix-section">
              <div className="fix-header">
                <input
                  type="checkbox"
                  checked={config.removeNumberPrefixEnabled}
                  onChange={(e) => updateConfig('removeNumberPrefixEnabled', e.target.checked)}
                  disabled={isApplying}
                />
                <h3>Remove Number Prefix</h3>
              </div>
              <p className="fix-description">
                Remove numbering prefixes from titles. Example: "01. Get Lucky" → "Get Lucky"
              </p>
              {config.removeNumberPrefixEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Apply to fields:</label>
                    <div className="field-checkboxes">
                      {FIELD_OPTIONS.map(field => (
                        <label key={field.value} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={config.removeNumberPrefixFields.includes(field.value)}
                            onChange={() => toggleField('removeNumberPrefixFields', field.value)}
                            disabled={isApplying}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleClose} disabled={isApplying}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={isApplying || !Object.values(config).some(v => typeof v === 'boolean' && v)}
          >
            <Play size={16} />
            {isApplying ? 'Applying...' : `Apply to ${trackCount} Track${trackCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}