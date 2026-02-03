/**
 * Filter Worker - Offloads heavy track filtering to a background thread
 * 
 * This prevents UI blocking when filtering large libraries (50k+ tracks).
 * Communicates via postMessage with the main thread.
 */

// Track interface (simplified for worker - no methods)
interface WorkerTrack {
  TrackID: string;
  Name?: string;
  Artist?: string;
  Album?: string;
  Genre?: string;
  Key?: string;
  isMissing?: boolean;
  tags?: { category: string; name: string }[];
}

interface FilterRequest {
  type: 'filter';
  requestId: string;
  tracks: WorkerTrack[];
  searchQuery: string;
  playlistTrackIds: string[] | null;
  showMissingOnly: boolean;
}

interface FilterResponse {
  type: 'filterResult';
  requestId: string;
  filteredIds: string[];
  duration: number;
}

// Listen for messages from main thread
self.onmessage = (event: MessageEvent<FilterRequest>) => {
  const { type, requestId, tracks, searchQuery, playlistTrackIds, showMissingOnly } = event.data;
  
  if (type !== 'filter') return;
  
  const startTime = performance.now();
  
  // Build playlist set for O(1) lookup
  const playlistSet = playlistTrackIds ? new Set(playlistTrackIds) : null;
  
  // Normalize search query
  const query = searchQuery.trim().toLowerCase();
  const hasQuery = query.length > 0;
  
  // Filter tracks
  const filteredIds: string[] = [];
  
  for (const track of tracks) {
    // Filter by playlist
    if (playlistSet && !playlistSet.has(track.TrackID)) {
      continue;
    }
    
    // Filter by missing
    if (showMissingOnly && track.isMissing !== true) {
      continue;
    }
    
    // Filter by search query
    if (hasQuery) {
      const name = track.Name?.toLowerCase() || '';
      const artist = track.Artist?.toLowerCase() || '';
      const album = track.Album?.toLowerCase() || '';
      const genre = track.Genre?.toLowerCase() || '';
      const key = track.Key?.toLowerCase() || '';
      const tags = track.tags?.map(t => `${t.category || ''} ${t.name || ''}`.toLowerCase()).join(' ') || '';
      
      const matches = name.includes(query) ||
                      artist.includes(query) ||
                      album.includes(query) ||
                      genre.includes(query) ||
                      key.includes(query) ||
                      tags.includes(query);
      
      if (!matches) {
        continue;
      }
    }
    
    filteredIds.push(track.TrackID);
  }
  
  const duration = performance.now() - startTime;
  
  // Send results back
  const response: FilterResponse = {
    type: 'filterResult',
    requestId,
    filteredIds,
    duration,
  };
  
  self.postMessage(response);
};

// Export empty object for TypeScript module
export {};
