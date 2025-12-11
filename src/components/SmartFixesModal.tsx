import { useMemo, useState } from 'react';
import { X, Zap, Play, AlertTriangle, Info, Wand2, Scissors } from 'lucide-react';

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
  const trackLabel = useMemo(
    () => (isAllTracks ? 'all tracks in your library' : `${trackCount} selected track${trackCount !== 1 ? 's' : ''}`),
    [isAllTracks, trackCount]
  );

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
              <strong>About Smart Fixes</strong>
              <p className="muted">These tools clean and standardize metadata. This run will process {trackLabel}.</p>
            </div>
            <div className="pill subtle">
              <Info size={14} />
              Non-destructive: only modifies metadata fields you enable.
            </div>
          </div>

          <div className="smart-fixes-grid">
            {/* Extract Artist From Title */}
            <div className={`fix-card ${config.extractArtistEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Extract Artist From Title</h3>
                    <p className="fix-description">Split title on a separator and promote artist.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.extractArtistEnabled}
                    onChange={(e) => updateConfig('extractArtistEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.extractArtistEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Separator</label>
                    <input
                      type="text"
                      value={config.extractArtistSeparator}
                      onChange={(e) => updateConfig('extractArtistSeparator', e.target.value)}
                      placeholder=" - "
                      disabled={isApplying}
                    />
                  </div>
                  <div className="option-group inline">
                    <label>Result part</label>
                    <input
                      type="number"
                      min="1"
                      value={config.extractArtistResultNumber}
                      onChange={(e) => updateConfig('extractArtistResultNumber', parseInt(e.target.value) || 1)}
                      disabled={isApplying}
                    />
                    <span className="option-help">1 = first, 2 = second, etc.</span>
                  </div>
                  <div className="pill example">Example: “Daft Punk - Touch” → Artist: Daft Punk; Title: Touch</div>
                </div>
              )}
            </div>

            {/* Replace Characters With Space */}
            <div className={`fix-card ${config.replaceCharsEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Scissors size={18} />
                  <div>
                    <h3>Replace Characters With Space</h3>
                    <p className="fix-description">Swap bad separators with spaces.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.replaceCharsEnabled}
                    onChange={(e) => updateConfig('replaceCharsEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.replaceCharsEnabled && (
                <div className="fix-options">
                  <div className="option-group">
                    <label>Characters</label>
                    <input
                      type="text"
                      value={config.replaceCharsList}
                      onChange={(e) => updateConfig('replaceCharsList', e.target.value)}
                      placeholder="_"
                      disabled={isApplying}
                    />
                  </div>
                  <div className="pill example">Example: “Dark_Side_of_my_Room” → “Dark Side of my Room”</div>
                </div>
              )}
            </div>

            {/* Remove Garbage Characters */}
            <div className={`fix-card ${config.removeGarbageEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Remove Garbage Characters</h3>
                    <p className="fix-description">Strip stray symbols, extra spaces, brackets, pipes.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.removeGarbageEnabled}
                    onChange={(e) => updateConfig('removeGarbageEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.removeGarbageEnabled && (
                <div className="fix-options">
                  <label className="sub-label">Apply to fields</label>
                  <div className="field-chips">
                    {FIELD_OPTIONS.map(field => (
                      <label key={field.value} className={`chip ${config.removeGarbageFields.includes(field.value) ? 'selected' : ''}`}>
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
              )}
            </div>

            {/* Add (Re)mix Parenthesis */}
            <div className={`fix-card ${config.addRemixParenthesisEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Add (Re)mix Parenthesis</h3>
                    <p className="fix-description">Wrap mix info in parentheses.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.addRemixParenthesisEnabled}
                    onChange={(e) => updateConfig('addRemixParenthesisEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.addRemixParenthesisEnabled && (
                <div className="fix-options">
                  <label className="sub-label">Apply to fields</label>
                  <div className="field-chips">
                    {FIELD_OPTIONS.map(field => (
                      <label key={field.value} className={`chip ${config.addRemixParenthesisFields.includes(field.value) ? 'selected' : ''}`}>
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
                  <div className="pill example">“Green Bottle - Original Mix” → “Green Bottle (Original Mix)”</div>
                </div>
              )}
            </div>

            {/* Extract Remixer */}
            <div className={`fix-card ${config.extractRemixerEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Extract Remixer</h3>
                    <p className="fix-description">Pull remixer from title into Remixer field.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.extractRemixerEnabled}
                    onChange={(e) => updateConfig('extractRemixerEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              <div className="pill example">Example: “At Night (Purple Disco Machine Extended Remix)” → Remixer: Purple Disco Machine</div>
            </div>

            {/* Remove URLs */}
            <div className={`fix-card ${config.removeUrlsEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Remove URLs</h3>
                    <p className="fix-description">Strip URLs while keeping the rest of the text.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.removeUrlsEnabled}
                    onChange={(e) => updateConfig('removeUrlsEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.removeUrlsEnabled && (
                <div className="fix-options">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={config.removeUrlsDeleteAll}
                      onChange={(e) => updateConfig('removeUrlsDeleteAll', e.target.checked)}
                      disabled={isApplying}
                    />
                    <span>Delete entire field if a URL is found</span>
                  </label>
                  <label className="sub-label">Apply to fields</label>
                  <div className="field-chips">
                    {FIELD_OPTIONS.map(field => (
                      <label key={field.value} className={`chip ${config.removeUrlsFields.includes(field.value) ? 'selected' : ''}`}>
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
              )}
            </div>

            {/* Fix Casing */}
            <div className={`fix-card ${config.fixCasingEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Fix Casing</h3>
                    <p className="fix-description">Convert ALL CAPS/lowecase to title case.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.fixCasingEnabled}
                    onChange={(e) => updateConfig('fixCasingEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.fixCasingEnabled && (
                <div className="fix-options">
                  <label className="sub-label">Apply to fields</label>
                  <div className="field-chips">
                    {FIELD_OPTIONS.map(field => (
                      <label key={field.value} className={`chip ${config.fixCasingFields.includes(field.value) ? 'selected' : ''}`}>
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
              )}
            </div>

            {/* Remove Number Prefix */}
            <div className={`fix-card ${config.removeNumberPrefixEnabled ? 'active' : ''}`}>
              <div className="fix-header">
                <div className="fix-title">
                  <Wand2 size={18} />
                  <div>
                    <h3>Remove Number Prefix</h3>
                    <p className="fix-description">Drop leading numbers like “01. ”.</p>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.removeNumberPrefixEnabled}
                    onChange={(e) => updateConfig('removeNumberPrefixEnabled', e.target.checked)}
                    disabled={isApplying}
                  />
                  <span />
                </label>
              </div>
              {config.removeNumberPrefixEnabled && (
                <div className="fix-options">
                  <label className="sub-label">Apply to fields</label>
                  <div className="field-chips">
                    {FIELD_OPTIONS.map(field => (
                      <label key={field.value} className={`chip ${config.removeNumberPrefixFields.includes(field.value) ? 'selected' : ''}`}>
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
                  <div className="pill example">Example: “01. Get Lucky” → “Get Lucky”</div>
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