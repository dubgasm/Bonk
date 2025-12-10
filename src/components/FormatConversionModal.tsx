import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, FileAudio, Info, Loader } from 'lucide-react';
import { Track } from '../types/track';

// Helper to get filename from path
const getFilename = (path: string) => {
  return path.split('/').pop() || path.split('\\').pop() || path;
};

interface FormatConversionModalProps {
  tracks: Track[];
  onClose: () => void;
  onConvert: (conversions: FormatConversion[]) => void;
}

export interface FormatConversion {
  trackId: string;
  oldFormat: string;
  newFormat: string;
  oldPath: string;
  newPath: string;
  newLocation: string; // Full location with file:// prefix
  oldKind: string;
  newKind: string;
}

const FORMAT_MAP: Record<string, { kind: string; extension: string }> = {
  'FLAC': { kind: 'FLAC File', extension: '.flac' },
  'MP3': { kind: 'MP3 File', extension: '.mp3' },
  'AIFF': { kind: 'AIFF File', extension: '.aiff' },
  'WAV': { kind: 'WAV File', extension: '.wav' },
  'M4A': { kind: 'M4A File', extension: '.m4a' },
  'AAC': { kind: 'AAC File', extension: '.aac' },
  'OGG': { kind: 'OGG File', extension: '.ogg' },
};

export default function FormatConversionModal({
  tracks,
  onClose,
  onConvert,
}: FormatConversionModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('MP3');
  const [conversions, setConversions] = useState<FormatConversion[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; track: string; status: string } | null>(null);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [archivePath, setArchivePath] = useState<string>('');

  useEffect(() => {
    generateConversions();
  }, [selectedFormat, tracks]);

  const getFileExtension = (path: string): string => {
    const match = path.match(/\.([^.]+)$/i);
    return match ? match[1].toUpperCase() : '';
  };

  const getKindFromExtension = (ext: string): string => {
    for (const [, info] of Object.entries(FORMAT_MAP)) {
      if (info.extension.toLowerCase() === `.${ext.toLowerCase()}`) {
        return info.kind;
      }
    }
    return `${ext.toUpperCase()} File`;
  };

  const generateConversions = () => {
    const newConversions: FormatConversion[] = [];

    tracks.forEach((track) => {
      if (!track.Location) return;

      // Parse current location
      let location = track.Location;
      if (location.startsWith('file://localhost')) {
        location = location.replace('file://localhost', '');
      } else if (location.startsWith('file://')) {
        location = location.replace('file://', '');
      }
      location = decodeURIComponent(location);

      // Get current extension and format
      const currentExt = getFileExtension(location);
      const currentKind = track.Kind || getKindFromExtension(currentExt);

      // Skip if already in target format
      if (currentExt === selectedFormat) return;

      // Generate new path
      const basePath = location.replace(/\.([^.]+)$/i, '');
      const newExt = FORMAT_MAP[selectedFormat]?.extension || `.${selectedFormat.toLowerCase()}`;
      const newPath = basePath + newExt;

      // Generate new location (preserve file:// format)
      let newLocation = newPath;
      if (track.Location.startsWith('file://localhost')) {
        newLocation = `file://localhost${newPath}`;
      } else if (track.Location.startsWith('file://')) {
        newLocation = `file://${newPath}`;
      }

      newConversions.push({
        trackId: track.TrackID,
        oldFormat: currentExt || 'Unknown',
        newFormat: selectedFormat,
        oldPath: location,
        newPath: newPath,
        newLocation: newLocation,
        oldKind: currentKind,
        newKind: FORMAT_MAP[selectedFormat]?.kind || `${selectedFormat} File`,
      });
    });

    setConversions(newConversions);
  };

  useEffect(() => {
    if (!window.electronAPI?.onConversionProgress) return;
    
    window.electronAPI.onConversionProgress((data: any) => {
      setProgress(data);
      if (data.status === 'complete') {
        setIsConverting(false);
      }
    });

    return () => {
      if (window.electronAPI?.removeConversionProgressListener) {
        window.electronAPI.removeConversionProgressListener();
      }
    };
  }, []);

  const handleConvert = async () => {
    if (conversions.length === 0) {
      alert('No tracks to convert');
      return;
    }

    const confirmed = confirm(
      `Convert ${conversions.length} track${conversions.length > 1 ? 's' : ''} from their current format to ${selectedFormat}?\n\n` +
      `This will:\n` +
      `1. Convert audio files using FFmpeg\n` +
      `2. Update Rekordbox database paths\n` +
      `3. ${deleteOriginals ? (archivePath ? `Move originals to: ${archivePath}` : 'Delete original files') : 'Keep original files'}\n\n` +
      `⚠️ Always backup your Rekordbox library before proceeding!`
    );

    if (!confirmed) return;

    setIsConverting(true);
    setProgress({ current: 0, total: conversions.length, track: '', status: 'starting' });

    try {
      // Prepare conversion data
      const conversionData = conversions.map(conv => {
        const track = tracks.find(t => t.TrackID === conv.trackId);
        return {
          trackId: conv.trackId,
          trackName: track?.Name || getFilename(conv.oldPath),
          oldPath: conv.oldPath,
          newPath: conv.newPath,
          newFormat: conv.newFormat,
          dbPath: undefined // Will be set if using Rekordbox DB
        };
      });

      // Call batch conversion
      if (!window.electronAPI?.batchConvertTracks) {
        throw new Error('Batch conversion not available');
      }

      const result = await window.electronAPI.batchConvertTracks(conversionData, {
        deleteOriginals,
        archivePath: archivePath || undefined
      });

      if (!result.success) {
        throw new Error(result.error || 'Conversion failed');
      }

      // Update library with new paths
      onConvert(conversions);

      // Show results
      let message = `Conversion Complete!\n\n`;
      message += `✓ ${result.converted || 0} track${(result.converted || 0) !== 1 ? 's' : ''} converted\n`;
      if ((result.skipped || 0) > 0) {
        message += `⏭ ${result.skipped} track${result.skipped !== 1 ? 's' : ''} skipped (already exist)\n`;
      }
      if ((result.failed || 0) > 0) {
        message += `✗ ${result.failed} track${result.failed !== 1 ? 's' : ''} failed\n`;
      }
      if (result.errors && result.errors.length > 0) {
        message += `\nErrors:\n${result.errors.slice(0, 5).map((e: any) => `- ${e.track}: ${e.error}`).join('\n')}`;
        if (result.errors.length > 5) {
          message += `\n... and ${result.errors.length - 5} more`;
        }
      }

      alert(message);
      onClose();
    } catch (error: any) {
      alert(`Conversion failed: ${error.message}`);
      setIsConverting(false);
      setProgress(null);
    }
  };

  const formatPreview = conversions.length > 0 ? (
    <div className="conversion-preview">
      <div className="preview-header">
        <Info size={16} />
        <span>Preview: {conversions.length} track{conversions.length > 1 ? 's' : ''} will be converted</span>
      </div>
      <div className="conversion-list">
        {conversions.slice(0, 10).map((conv, idx) => {
          const track = tracks.find(t => t.TrackID === conv.trackId);
          return (
            <div key={idx} className="conversion-item">
              <div className="conversion-track-info">
                <strong>{track?.Name || 'Unknown'}</strong>
                <span className="conversion-artist">{track?.Artist || ''}</span>
              </div>
              <div className="conversion-path-change">
                <span className="old-format">{conv.oldFormat}</span>
                <span className="arrow">→</span>
                <span className="new-format">{conv.newFormat}</span>
              </div>
              <div className="conversion-file-path">
                <span className="file-path-old">{conv.oldPath.split('/').pop()}</span>
                <span className="arrow">→</span>
                <span className="file-path-new">{conv.newPath.split('/').pop()}</span>
              </div>
            </div>
          );
        })}
        {conversions.length > 10 && (
          <div className="conversion-more">
            ... and {conversions.length - 10} more track{conversions.length - 10 > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="no-conversions">
      <CheckCircle size={48} className="success-icon" />
      <h3>No Conversions Needed</h3>
      <p>All selected tracks are already in {selectedFormat} format.</p>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content format-conversion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileAudio size={24} />
            <span>Convert Track Formats</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="warning-box">
            <AlertTriangle size={20} className="warning-icon" />
            <div>
              <strong>Important Notes:</strong>
              <ul>
                <li>This updates the Rekordbox library metadata only (Kind field and file paths)</li>
                <li>The actual audio files must already exist at the new paths</li>
                <li>For cues/loops to transfer correctly, new files must be exact digital matches (same length, no timing differences)</li>
                <li>Always backup your Rekordbox library before making changes</li>
              </ul>
            </div>
          </div>

          <div className="form-section">
            <label>
              <strong>Convert to Format:</strong>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="format-select"
                disabled={isConverting}
              >
                {Object.keys(FORMAT_MAP).map((format) => (
                  <option key={format} value={format}>
                    {format} ({FORMAT_MAP[format].kind})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-section">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={deleteOriginals}
                onChange={(e) => setDeleteOriginals(e.target.checked)}
                disabled={isConverting}
              />
              <div className="checkbox-label">
                <strong>Delete Original Files</strong>
                <span>Remove original files after successful conversion</span>
              </div>
            </label>
            {deleteOriginals && (
              <div style={{ marginTop: '8px', marginLeft: '24px' }}>
                <label>
                  <small>Archive Path (optional - leave empty to delete):</small>
                  <input
                    type="text"
                    value={archivePath}
                    onChange={(e) => setArchivePath(e.target.value)}
                    placeholder="/path/to/archive"
                    disabled={isConverting}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      marginTop: '4px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {isConverting && progress && (
            <div className="conversion-progress">
              <div className="progress-header">
                <Loader size={16} className="spinning" />
                <span>
                  Converting {progress.current} of {progress.total}: {progress.track}
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="progress-status">{progress.status}</div>
            </div>
          )}

          {!isConverting && formatPreview}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConvert}
            disabled={conversions.length === 0 || isConverting}
          >
            {isConverting ? (
              <>
                <Loader size={18} className="spinning" />
                Converting...
              </>
            ) : (
              <>
                <FileAudio size={18} />
                Convert {conversions.length > 0 ? `${conversions.length} ` : ''}Track{conversions.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

