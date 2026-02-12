import { X, Settings as SettingsIcon } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useColumnStore } from '../store/useColumnStore';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { tagWriteSettings, updateTagWriteSetting, fieldMappings, apiCredentials, updateApiCredential, taggingPreferences, updateKeyFormat } = useSettingsStore();
  const { columns, setColumnVisibility } = useColumnStore();

  const isWaveformVisible = columns.find(c => c.id === 'waveform')?.visible ?? false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SettingsIcon size={24} />
            <h2>Settings</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="form-section">
            <h3>Interface & Performance</h3>
            <p className="section-description">
              Customize the look and feel of the application
            </p>
            <div className="checkbox-grid">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={isWaveformVisible}
                  onChange={(e) => setColumnVisibility('waveform', e.target.checked)}
                />
                <div className="checkbox-label">
                  <strong>Show Waveforms in Library</strong>
                  <span>Display audio waveforms in the track list (may affect scrolling performance)</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>🎵 API Credentials</h3>
            <p className="section-description">
              Configure API access for music metadata services
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Spotify Client ID
                </label>
                <input
                  type="text"
                  value={apiCredentials.spotifyClientId}
                  onChange={(e) => updateApiCredential('spotifyClientId', e.target.value)}
                  placeholder="Your Spotify Client ID"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Spotify Client Secret
                </label>
                <input
                  type="password"
                  value={apiCredentials.spotifyClientSecret}
                  onChange={(e) => updateApiCredential('spotifyClientSecret', e.target.value)}
                  placeholder="Your Spotify Client Secret"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Discogs Personal Access Token
                </label>
                <input
                  type="password"
                  value={apiCredentials.discogsToken || ''}
                  onChange={(e) => updateApiCredential('discogsToken', e.target.value)}
                  placeholder="Your Discogs Token"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Get your token at discogs.com/settings/developers
                </span>
              </div>

              {/* Beatport Credentials */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Beatport Username
                </label>
                <input
                  type="text"
                  value={apiCredentials.beatportUsername || ''}
                  onChange={(e) => updateApiCredential('beatportUsername', e.target.value)}
                  placeholder="Your Beatport username"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Beatport Password
                </label>
                <input
                  type="password"
                  value={apiCredentials.beatportPassword || ''}
                  onChange={(e) => updateApiCredential('beatportPassword', e.target.value)}
                  placeholder="Your Beatport password"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Your Beatport account login (for DJ store access)
                </span>
              </div>

            </div>
          </div>

          <div className="form-section">
            <h3>Tagging Preferences</h3>
            <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Key Format */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 500, fontSize: '14px' }}>
                  Key Format
                </label>
                <select
                  value={taggingPreferences?.keyFormat || 'camelot'}
                  onChange={(e) => updateKeyFormat(e.target.value as 'standard' | 'camelot' | 'openkey')}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="standard">Standard (Am, C, F#m)</option>
                  <option value="camelot">Camelot Wheel (8A, 8B, 11A)</option>
                  <option value="openkey">Open Key (1d, 1m, 4d)</option>
                </select>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Camelot and Open Key are popular with DJs for harmonic mixing
                </span>
              </div>

            </div>
          </div>

          <div className="form-section">
            <h3>Write Tags (ID3)</h3>
            <p className="section-description">
              Choose which fields to write when updating ID3 tags in your audio files
            </p>

            <div className="checkbox-grid">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeTitle}
                  onChange={(e) => updateTagWriteSetting('writeTitle', e.target.checked)}
                />
                <span>Title</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeArtist}
                  onChange={(e) => updateTagWriteSetting('writeArtist', e.target.checked)}
                />
                <span>Artist</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeAlbum}
                  onChange={(e) => updateTagWriteSetting('writeAlbum', e.target.checked)}
                />
                <span>Album</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeGenre}
                  onChange={(e) => updateTagWriteSetting('writeGenre', e.target.checked)}
                />
                <span>Genre</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeBPM}
                  onChange={(e) => updateTagWriteSetting('writeBPM', e.target.checked)}
                />
                <span>BPM</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeKey}
                  onChange={(e) => updateTagWriteSetting('writeKey', e.target.checked)}
                />
                <span>Key</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeYear}
                  onChange={(e) => updateTagWriteSetting('writeYear', e.target.checked)}
                />
                <span>Year</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeComments}
                  onChange={(e) => updateTagWriteSetting('writeComments', e.target.checked)}
                />
                <span>Comments</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeRating}
                  onChange={(e) => updateTagWriteSetting('writeRating', e.target.checked)}
                />
                <span>Rating</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeComposer}
                  onChange={(e) => updateTagWriteSetting('writeComposer', e.target.checked)}
                />
                <span>Composer</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeAlbumArtist}
                  onChange={(e) => updateTagWriteSetting('writeAlbumArtist', e.target.checked)}
                />
                <span>Album Artist</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeRemixer}
                  onChange={(e) => updateTagWriteSetting('writeRemixer', e.target.checked)}
                />
                <span>Remixer</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeLabel}
                  onChange={(e) => updateTagWriteSetting('writeLabel', e.target.checked)}
                />
                <span>Label</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeReleaseDate}
                  onChange={(e) => updateTagWriteSetting('writeReleaseDate', e.target.checked)}
                />
                <span>Release Date</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeTrackNumber}
                  onChange={(e) => updateTagWriteSetting('writeTrackNumber', e.target.checked)}
                />
                <span>Track Number</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeDiscNumber}
                  onChange={(e) => updateTagWriteSetting('writeDiscNumber', e.target.checked)}
                />
                <span>Disc Number</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeLyricist}
                  onChange={(e) => updateTagWriteSetting('writeLyricist', e.target.checked)}
                />
                <span>Lyricist</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeOriginalArtist}
                  onChange={(e) => updateTagWriteSetting('writeOriginalArtist', e.target.checked)}
                />
                <span>Original Artist</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={tagWriteSettings.writeMixName}
                  onChange={(e) => updateTagWriteSetting('writeMixName', e.target.checked)}
                />
                <span>Mix Name</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Field Mappings</h3>
            <p className="section-description">
              Map custom fields to Rekordbox fields for specialized data
            </p>

            <div className="field-mappings">
              {fieldMappings.map((mapping, index) => (
                <div key={index} className="field-mapping-row">
                  <span className="mapping-field">{mapping.lexiconField}</span>
                  <span className="mapping-arrow">→</span>
                  <span className="mapping-field">{mapping.rekordboxField}</span>
                  <span className="mapping-status">
                    {mapping.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

