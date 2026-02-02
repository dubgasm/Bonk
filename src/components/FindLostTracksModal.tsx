import { useState } from 'react';
import { X, Search, AlertTriangle, CheckCircle, FolderOpen, FileAudio, Info } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

interface FindLostTracksModalProps {
  onClose: () => void;
}

export default function FindLostTracksModal({ onClose }: FindLostTracksModalProps) {
  const { library, missingTracks, updateTrack } = useLibraryStore();
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [newExtension, setNewExtension] = useState<string>('.mp3');
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<Array<{
    trackId: string;
    trackName: string;
    oldPath: string;
    newPath: string;
    found: boolean;
  }>>([]);

  const missingTracksList = library?.tracks.filter(t => missingTracks.has(t.TrackID)) || [];

  const handleSelectFolder = async () => {
    if (!window.electronAPI?.selectFolder) return;
    
    const result = await window.electronAPI.selectFolder();
    if (result) {
      setTargetFolder(result);
    }
  };

  const handleSearch = async () => {
    if (!targetFolder || !newExtension) {
      alert('Please select a folder and specify the new file extension');
      return;
    }

    const api = (window.electronAPI as any)?.searchMissingTracksInFolder;
    if (!api) {
      alert('Search not available');
      return;
    }

    setIsSearching(true);
    setMatches([]);

    try {
      const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
      const requests: { trackId: string; baseName: string; extension: string }[] = [];

      for (const track of missingTracksList) {
        let baseName = '';
        let oldPath = '';
        if (track.Location) {
          oldPath = track.Location
            .replace(/^file:\/\/localhost/i, '')
            .replace(/^file:\/\//i, '');
          oldPath = decodeURIComponent(oldPath);
          const pathParts = oldPath.replace(/\\/g, '/').split('/');
          const filename = pathParts.pop() || '';
          baseName = filename.replace(/\.[^.]+$/, '') || filename;
        }
        if (!baseName) baseName = track.Name || 'unknown';
        requests.push({ trackId: track.TrackID, baseName, extension: ext });
      }

      const foundPaths = await api(targetFolder, requests);

      const foundMatches = missingTracksList.map((track) => {
        let oldPath = track.Location || '';
        if (oldPath.startsWith('file://localhost')) oldPath = oldPath.replace('file://localhost', '');
        else if (oldPath.startsWith('file://')) oldPath = oldPath.replace('file://', '');
        oldPath = decodeURIComponent(oldPath);
        const pathParts = oldPath.replace(/\\/g, '/').split('/');
        const filename = pathParts.pop() || '';
        const baseName = filename.replace(/\.[^.]+$/, '') || track.Name || 'unknown';
        const newPath = foundPaths[track.TrackID] || '';

        return {
          trackId: track.TrackID,
          trackName: track.Name || filename,
          oldPath,
          newPath: newPath || `${baseName}${ext}`,
          found: !!foundPaths[track.TrackID]
        };
      });

      setMatches(foundMatches);
    } catch (error: any) {
      alert(`Error searching: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRelocate = async () => {
    const foundMatches = matches.filter(m => m.found);
    
    if (foundMatches.length === 0) {
      alert('No tracks found to relocate');
      return;
    }

    const confirmed = confirm(
      `Relocate ${foundMatches.length} track${foundMatches.length > 1 ? 's' : ''}?\n\n` +
      `This will update the file paths in your library to point to the new files.`
    );

    if (!confirmed) return;

    // Update tracks
    for (const match of foundMatches) {
      const pathForUrl = match.newPath.replace(/\\/g, '/');
      const newLocation = pathForUrl.startsWith('/')
        ? `file://${pathForUrl}`  // Unix: file:///Volumes/...
        : `file:///${pathForUrl}`; // Windows: file:///C:/...

      // Update track location
      updateTrack(match.trackId, {
        Location: newLocation,
        Kind: getKindFromExtension(newExtension)
      });
    }

    alert(`✓ ${foundMatches.length} track${foundMatches.length > 1 ? 's' : ''} relocated successfully!`);
    onClose();
  };

  const getKindFromExtension = (ext: string): string => {
    const extLower = ext.toLowerCase().replace('.', '');
    const kindMap: Record<string, string> = {
      'mp3': 'MP3 File',
      'flac': 'FLAC File',
      'aiff': 'AIFF File',
      'aif': 'AIFF File',
      'wav': 'WAV File',
      'm4a': 'M4A File',
      'aac': 'AAC File',
      'ogg': 'OGG File',
    };
    return kindMap[extLower] || `${ext.toUpperCase().replace('.', '')} File`;
  };

  const foundCount = matches.filter(m => m.found).length;
  const notFoundCount = matches.filter(m => !m.found).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content find-lost-tracks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Search size={24} />
            <span>Find Lost Tracks</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="info-box">
            <Info size={18} />
            <div>
              <strong>How it works:</strong>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                Select the folder where your missing tracks now live (e.g. OneDrive, external drive). The tool searches recursively
                for files matching each track&apos;s filename with the chosen extension. Works even if files moved to a different drive.
              </p>
            </div>
          </div>

          <div className="form-section">
            <label>
              <strong>Target Folder:</strong>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  placeholder="/path/to/music/folder"
                  disabled={isSearching}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={handleSelectFolder}
                  disabled={isSearching}
                >
                  <FolderOpen size={16} />
                  Browse
                </button>
              </div>
            </label>
          </div>

          <div className="form-section">
            <label>
              <strong>New File Extension:</strong>
              <select
                value={newExtension}
                onChange={(e) => setNewExtension(e.target.value)}
                className="format-select"
                disabled={isSearching}
              >
                <option value=".mp3">.mp3 (MP3)</option>
                <option value=".flac">.flac (FLAC)</option>
                <option value=".aiff">.aiff (AIFF)</option>
                <option value=".aif">.aif (AIFF)</option>
                <option value=".wav">.wav (WAV)</option>
                <option value=".m4a">.m4a (M4A)</option>
                <option value=".aac">.aac (AAC)</option>
                <option value=".ogg">.ogg (OGG)</option>
              </select>
            </label>
          </div>

          <div className="form-section">
            <div className="info-box" style={{ background: 'rgba(255, 152, 0, 0.1)', borderColor: 'rgba(255, 152, 0, 0.3)' }}>
              <AlertTriangle size={18} />
              <div>
                <strong>{missingTracksList.length} missing track{missingTracksList.length !== 1 ? 's' : ''} found</strong>
                <p style={{ marginTop: '4px', fontSize: '12px' }}>
                  Click "Search" to find files with the new extension in the target folder.
                </p>
              </div>
            </div>
          </div>

          {matches.length > 0 && (
            <div className="matches-section">
              <div className="matches-summary">
                <CheckCircle size={16} className="success-icon" />
                <span>
                  Found {foundCount} of {matches.length} track{matches.length !== 1 ? 's' : ''}
                  {notFoundCount > 0 && ` (${notFoundCount} not found)`}
                </span>
              </div>

              <div className="matches-list">
                {matches.slice(0, 20).map((match, idx) => (
                  <div key={idx} className={`match-item ${match.found ? 'found' : 'not-found'}`}>
                    <div className="match-track-info">
                      <strong>{match.trackName}</strong>
                      <span className="match-path">{match.newPath.split('/').pop()}</span>
                    </div>
                    {match.found ? (
                      <CheckCircle size={16} className="success-icon" />
                    ) : (
                      <AlertTriangle size={16} className="warning-icon" />
                    )}
                  </div>
                ))}
                {matches.length > 20 && (
                  <div className="matches-more">
                    ... and {matches.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {matches.length === 0 ? (
            <button
              className="btn-primary"
              onClick={handleSearch}
              disabled={!targetFolder || isSearching || missingTracksList.length === 0}
            >
              <Search size={18} />
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleRelocate}
              disabled={foundCount === 0}
            >
              <FileAudio size={18} />
              Relocate {foundCount} Track{foundCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

