/**
 * LazyAlbumArt - Loads album art on-demand when visible
 * 
 * Uses the album art store's LRU cache for memory efficiency.
 * Shows a placeholder while loading and handles errors gracefully.
 */

import React, { memo, useEffect } from 'react';
import { useAlbumArtStore, ALBUM_ART_PLACEHOLDER } from '../store/useAlbumArtStore';

interface LazyAlbumArtProps {
  trackId: string;
  location?: string;
  albumArt?: string | null; // Pre-loaded album art (from scan/import)
  size?: number;
  className?: string;
}

export const LazyAlbumArt = memo(function LazyAlbumArt({
  trackId,
  location,
  albumArt,
  size = 40,
  className = '',
}: LazyAlbumArtProps) {
  const getAlbumArt = useAlbumArtStore((state) => state.getAlbumArt);
  const setAlbumArt = useAlbumArtStore((state) => state.setAlbumArt);
  const cache = useAlbumArtStore((state) => state.cache);
  
  // Get or request album art
  const entry = cache.get(trackId);
  
  useEffect(() => {
    // If we have pre-loaded album art, use it directly
    if (albumArt && !entry) {
      setAlbumArt(trackId, albumArt);
      return;
    }
    
    // Otherwise, request album art extraction when component mounts (if not already cached)
    if (!entry && !albumArt && location) {
      getAlbumArt(trackId, location);
    }
  }, [trackId, location, albumArt, entry, getAlbumArt, setAlbumArt]);
  
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: size * 0.5,
    color: '#666',
  };
  
  // Show placeholder while loading or if no art
  if (!entry || entry.loading || !entry.data) {
    return (
      <div 
        className={`album-art-container ${className}`}
        style={containerStyle}
        title={entry?.loading ? 'Loading...' : 'No album art'}
      >
        <span className="album-art-placeholder">
          {entry?.loading ? '⏳' : ALBUM_ART_PLACEHOLDER}
        </span>
      </div>
    );
  }
  
  // Show album art
  return (
    <div 
      className={`album-art-container ${className}`}
      style={containerStyle}
    >
      <img
        src={entry.data}
        alt="Album art"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});

export default LazyAlbumArt;
