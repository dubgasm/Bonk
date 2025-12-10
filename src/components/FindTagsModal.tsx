import { useState, useEffect } from 'react';
import { X, Search, Download, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { TagFinderOptions, defaultTagFinderOptions, TagFinderProgress } from '../types/musicDatabase';
import { useLibraryStore } from '../store/useLibraryStore';

interface FindTagsModalProps {
  onClose: () => void;
  onStart: (options: TagFinderOptions) => void;
  trackCount: number;
}

export default function FindTagsModal({ onClose, onStart, trackCount }: FindTagsModalProps) {
  const [options, setOptions] = useState<TagFinderOptions>(defaultTagFinderOptions);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TagFinderProgress | null>(null);
  const { updateTrack } = useLibraryStore();

  useEffect(() => {
    if (!window.electronAPI?.onFindTagsProgress) return;

    // Listen for progress updates
    window.electronAPI.onFindTagsProgress((data: TagFinderProgress) => {
      console.log('Progress update:', data);
      setProgress(data);
      if (data.status === 'complete') {
        console.log('Find tags complete!');
        setIsRunning(false);
      }
    });

    // Listen for metadata updates
    if (window.electronAPI?.onTrackMetadataUpdate) {
      window.electronAPI.onTrackMetadataUpdate((data: { trackId: string; updates: any }) => {
        console.log('Updating track metadata:', data.trackId, data.updates);
        updateTrack(data.trackId, data.updates);
      });
    }

    return () => {
      window.electronAPI.removeFindTagsListener?.();
    };
  }, [updateTrack]);

  const handleStart = () => {
    setIsRunning(true);
    setProgress({
      current: 0,
      total: trackCount,
      currentTrack: '',
      status: 'searching',
      message: 'Starting...'
    });
    onStart(options);
  };

  const toggleOption = (key: keyof TagFinderOptions) => {
    setOptions({ ...options, [key]: !options[key] });
  };

  return (
    <div className="modal-overlay" onClick={isRunning ? undefined : onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search size={24} />
            <h2>Find Tags & Album Art</h2>
          </div>
          {!isRunning && (
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-content">
          {!isRunning ? (
            <>
              <div className="info-box">
                <AlertCircle size={18} />
                <span>
                  Searching {trackCount} track{trackCount !== 1 ? 's' : ''} for missing tags and album art
                </span>
              </div>

              <div className="form-section">
                <h3>Data Sources</h3>
                <p className="section-description">
                  Sources are checked in priority order. Beatport is best for EDM genres.
                </p>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.enableBeatport}
                    onChange={() => toggleOption('enableBeatport')}
                  />
                  <div className="checkbox-label">
                    <strong>Beatport</strong>
                    <span>Best for EDM - detailed genre information</span>
                  </div>
                </label>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.enableSpotify}
                    onChange={() => toggleOption('enableSpotify')}
                  />
                  <div className="checkbox-label">
                    <strong>Spotify</strong>
                    <span>Energy, danceability, popularity, and happiness</span>
                  </div>
                </label>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.enableMusicBrainz}
                    onChange={() => toggleOption('enableMusicBrainz')}
                  />
                  <div className="checkbox-label">
                    <strong>MusicBrainz</strong>
                    <span>Free database with broad coverage</span>
                  </div>
                </label>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.enableDiscogs}
                    onChange={() => toggleOption('enableDiscogs')}
                  />
                  <div className="checkbox-label">
                    <strong>Discogs</strong>
                    <span>Extensive vinyl and release database</span>
                  </div>
                </label>
              </div>

              <div className="form-section">
                <h3>Fields to Update</h3>
                <div className="checkbox-grid">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateGenre}
                      onChange={() => toggleOption('updateGenre')}
                    />
                    <span>Genre</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateYear}
                      onChange={() => toggleOption('updateYear')}
                    />
                    <span>Year</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateLabel}
                      onChange={() => toggleOption('updateLabel')}
                    />
                    <span>Label</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateAlbum}
                      onChange={() => toggleOption('updateAlbum')}
                    />
                    <span>Album</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateAlbumArt}
                      onChange={() => toggleOption('updateAlbumArt')}
                    />
                    <span>Album Art</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateEnergy}
                      onChange={() => toggleOption('updateEnergy')}
                    />
                    <span>Energy</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateDanceability}
                      onChange={() => toggleOption('updateDanceability')}
                    />
                    <span>Danceability</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updatePopularity}
                      onChange={() => toggleOption('updatePopularity')}
                    />
                    <span>Popularity</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.updateHappiness}
                      onChange={() => toggleOption('updateHappiness')}
                    />
                    <span>Happiness</span>
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Additional Options</h3>
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={options.originalRelease}
                    onChange={() => toggleOption('originalRelease')}
                  />
                  <div className="checkbox-label">
                    <strong>Original Release</strong>
                    <span>Find the first/original release (ignores remix info)</span>
                  </div>
                </label>
              </div>
            </>
          ) : (
            <div className="progress-container">
              <div className="progress-status">
                {progress?.status === 'searching' && <Search className="spinning" size={48} />}
                {progress?.status === 'downloading' && <Download className="pulsing" size={48} />}
                {progress?.status === 'embedding' && <Loader className="spinning" size={48} />}
                {progress?.status === 'complete' && <CheckCircle size={48} style={{ color: 'var(--accent)' }} />}
                {progress?.status === 'error' && <AlertCircle size={48} style={{ color: 'var(--error)' }} />}
              </div>

              <h3>{progress?.message || 'Processing...'}</h3>
              <p className="progress-track">{progress?.currentTrack}</p>

              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${((progress?.current || 0) / (progress?.total || 1)) * 100}%`
                  }}
                />
              </div>

              <p className="progress-text">
                {progress?.current || 0} of {progress?.total || 0} tracks
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!isRunning ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStart}>
                <Search size={18} />
                Start Search
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onClose}
              disabled={progress?.status !== 'complete'}
            >
              {progress?.status === 'complete' ? 'Done' : 'Please wait...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

