import { useState, useEffect, useMemo } from 'react';
import { Copy, Trash2, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Track } from '../types/track';

interface DuplicateGroup {
  tracks: Track[];
  keepTrack: Track;
  deleteTracks: Track[];
}

interface DuplicateDetectionModalProps {
  tracks: Track[];
  onClose: () => void;
  onDeleteTracks: (trackIds: string[]) => void;
}

export default function DuplicateDetectionModal({
  tracks,
  onClose,
  onDeleteTracks,
}: DuplicateDetectionModalProps) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  // Memoize duplicate detection to avoid re-scanning unnecessarily
  const duplicateGroupsMemo = useMemo(() => {
    setIsScanning(true);
    
    // Pre-compute format priorities and metadata counts for better performance
    const formatPriorityCache = new Map<string, number>();
    const getFormatPriority = (ext: string): number => {
      const normalized = ext.toLowerCase();
      if (formatPriorityCache.has(normalized)) {
        return formatPriorityCache.get(normalized)!;
      }
      let priority = 0;
      if (normalized === 'aiff' || normalized === 'aif') priority = 3;
      else if (normalized === 'flac') priority = 2;
      else if (normalized === 'mp3') priority = 1;
      formatPriorityCache.set(normalized, priority);
      return priority;
    };
    
    // Group tracks by normalized name (case-insensitive, ignoring leading numbers)
    const nameMap = new Map<string, Track[]>();
    
    // Single pass: normalize and group
    for (const track of tracks) {
      const normalized = normalizeTrackName(track.Name || '');
      const existing = nameMap.get(normalized);
      if (existing) {
        existing.push(track);
      } else {
        nameMap.set(normalized, [track]);
      }
    }

    // Find duplicates (groups with more than 1 track)
    const groups: DuplicateGroup[] = [];
    
    // Pre-compute metadata counts and sizes once
    const metadataCache = new Map<Track, number>();
    const sizeCache = new Map<Track, number>();
    
    for (const groupTracks of nameMap.values()) {
      if (groupTracks.length > 1) {
        // Pre-compute expensive values
        for (const track of groupTracks) {
          if (!metadataCache.has(track)) {
            metadataCache.set(track, countMetadataFields(track));
          }
          if (!sizeCache.has(track)) {
            sizeCache.set(track, parseInt(track.Size || '0'));
          }
        }
        
        // Sort tracks: prefer AIFF > FLAC > MP3, then by file size (larger = better quality)
        const sorted = [...groupTracks].sort((a, b) => {
          const aExt = getFileExtension(a.Location || '');
          const bExt = getFileExtension(b.Location || '');
          
          const aPriority = getFormatPriority(aExt);
          const bPriority = getFormatPriority(bExt);
          
          // Compare by format priority first
          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
          }
          
          // Same format: prioritize tracks with more complete metadata
          const aMetadataCount = metadataCache.get(a)!;
          const bMetadataCount = metadataCache.get(b)!;
          
          if (aMetadataCount !== bMetadataCount) {
            return bMetadataCount - aMetadataCount; // More metadata = better
          }
          
          // Same format and metadata: sort by file size (larger = better)
          const aSize = sizeCache.get(a)!;
          const bSize = sizeCache.get(b)!;
          return bSize - aSize;
        });

        const keepTrack = sorted[0];
        const deleteTracks = sorted.slice(1);

        groups.push({
          tracks: groupTracks,
          keepTrack,
          deleteTracks,
        });
      }
    }

    return groups;
  }, [tracks]);

  useEffect(() => {
    setIsScanning(true);
    setDuplicateGroups(duplicateGroupsMemo);
    setIsScanning(false);
  }, [duplicateGroupsMemo]);

  const normalizeTrackName = (name: string): string => {
    // Remove leading numbers and dashes/spaces
    // Handles: "01 - Title", "1 - Title", "01.Title", "01 Title", etc.
    return name
      .toLowerCase()
      .trim()
      .replace(/^\d+\s*[-.\s]+\s*/, '') // Remove leading number and separator
      .trim();
  };

  const getFileExtension = (location: string): string => {
    const match = location.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  };

  const countMetadataFields = (track: Track): number => {
    // Count non-empty metadata fields
    let count = 0;
    
    // Basic fields
    if (track.Name && track.Name.trim()) count++;
    if (track.Artist && track.Artist.trim()) count++;
    if (track.Album && track.Album.trim()) count++;
    if (track.Genre && track.Genre.trim()) count++;
    if (track.Year && track.Year.trim()) count++;
    if (track.AverageBpm && track.AverageBpm.trim()) count++;
    if (track.Key && track.Key.trim()) count++;
    if (track.Comments && track.Comments.trim()) count++;
    if (track.Rating && track.Rating.trim()) count++;
    if (track.Label && track.Label.trim()) count++;
    if (track.Remixer && track.Remixer.trim()) count++;
    if (track.Mix && track.Mix.trim()) count++;
    if (track.Grouping && track.Grouping.trim()) count++;
    if (track.Tonality && track.Tonality.trim()) count++;
    
    // Technical fields
    if (track.BitRate && track.BitRate.trim()) count++;
    if (track.SampleRate && track.SampleRate.trim()) count++;
    if (track.TotalTime && track.TotalTime.trim()) count++;
    
    // Enhanced metadata
    if (track.CatalogNumber && track.CatalogNumber.trim()) count++;
    if (track.Publisher && track.Publisher.trim()) count++;
    if (track.Writers && track.Writers.trim()) count++;
    if (track.Producers && track.Producers.trim()) count++;
    if (track.FeaturedArtists && track.FeaturedArtists.trim()) count++;
    if (track.ISRC && track.ISRC.trim()) count++;
    if (track.ReleaseDate && track.ReleaseDate.trim()) count++;
    if (track.MixName && track.MixName.trim()) count++;
    
    // Album art counts as metadata
    if (track.AlbumArt) count += 2; // Album art is valuable
    
    return count;
  };

  const handleDeleteDuplicates = () => {
    const allDeleteIds = duplicateGroups.flatMap(group => 
      group.deleteTracks.map(t => t.TrackID)
    );
    
    const count = allDeleteIds.length;
    if (confirm(`Delete ${count} duplicate track${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      onDeleteTracks(allDeleteIds);
      onClose();
    }
  };

  const handleDeleteGroup = (group: DuplicateGroup) => {
    const count = group.deleteTracks.length;
    if (confirm(`Delete ${count} duplicate${count > 1 ? 's' : ''} of "${group.keepTrack.Name}"?`)) {
      onDeleteTracks(group.deleteTracks.map(t => t.TrackID));
      // Duplicate detection will automatically re-run via useMemo when tracks change
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content duplicate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Copy size={24} />
            <span>Duplicate Detection</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isScanning ? (
            <div className="scanning-state">
              <div className="spinner"></div>
              <p>Scanning for duplicates...</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="no-duplicates">
              <CheckCircle size={48} className="success-icon" />
              <h3>No Duplicates Found</h3>
              <p>All tracks have unique names.</p>
            </div>
          ) : (
            <>
              <div className="duplicate-summary">
                <AlertTriangle size={20} className="warning-icon" />
                <div>
                  <strong>{duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''} found</strong>
                  <p>
                    {duplicateGroups.reduce((sum, g) => sum + g.deleteTracks.length, 0)} track{duplicateGroups.reduce((sum, g) => sum + g.deleteTracks.length, 0) > 1 ? 's' : ''} can be deleted
                  </p>
                </div>
              </div>

              <div className="duplicate-list">
                {duplicateGroups.map((group, index) => (
                  <div key={index} className="duplicate-group">
                    <div className="duplicate-group-header">
                      <div className="duplicate-group-info">
                        <strong>{group.keepTrack.Name}</strong>
                        <span className="duplicate-count">
                          {group.tracks.length} version{group.tracks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        className="btn-danger-small"
                        onClick={() => handleDeleteGroup(group)}
                      >
                        <Trash2 size={14} />
                        Delete {group.deleteTracks.length}
                      </button>
                    </div>

                    <div className="duplicate-tracks">
                      {/* Keep track */}
                      <div className="duplicate-track keep-track">
                        <CheckCircle size={16} className="keep-icon" />
                        <div className="track-info">
                          <span className="track-name">{group.keepTrack.Name}</span>
                          <span className="track-details">
                            {getFileExtension(group.keepTrack.Location || '').toUpperCase()} • 
                            {group.keepTrack.Size ? ` ${(parseInt(group.keepTrack.Size) / 1024 / 1024).toFixed(2)} MB` : ''} •
                            {countMetadataFields(group.keepTrack)} metadata fields
                          </span>
                        </div>
                        <span className="keep-badge">KEEP</span>
                      </div>

                      {/* Delete tracks */}
                      {group.deleteTracks.map((track) => (
                        <div key={track.TrackID} className="duplicate-track delete-track">
                          <Trash2 size={16} className="delete-icon" />
                          <div className="track-info">
                            <span className="track-name">{track.Name}</span>
                            <span className="track-details">
                              {getFileExtension(track.Location || '').toUpperCase()} • 
                              {track.Size ? ` ${(parseInt(track.Size) / 1024 / 1024).toFixed(2)} MB` : ''} •
                              {countMetadataFields(track)} metadata fields
                            </span>
                          </div>
                          <span className="delete-badge">DELETE</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  onClick={handleDeleteDuplicates}
                >
                  <Trash2 size={18} />
                  Delete All Duplicates ({duplicateGroups.reduce((sum, g) => sum + g.deleteTracks.length, 0)})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

