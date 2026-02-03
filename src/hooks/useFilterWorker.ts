/**
 * useFilterWorker - Hook for offloading track filtering to a Web Worker
 * 
 * For large libraries (5k+ tracks), this prevents UI jank during filtering.
 * Falls back to main-thread filtering for smaller libraries or if workers unavailable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from '../types/track';

// Threshold for using worker (below this, main thread is fast enough)
const WORKER_THRESHOLD = 5000;

interface FilterResult {
  filteredIds: string[];
  duration: number;
}

interface PendingRequest {
  resolve: (result: FilterResult) => void;
  reject: (error: Error) => void;
}

export function useFilterWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const requestIdRef = useRef(0);
  const [isReady, setIsReady] = useState(false);

  // Initialize worker
  useEffect(() => {
    // Check if workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('[FilterWorker] Web Workers not supported, using main thread');
      return;
    }

    try {
      // Create worker using Vite's worker import syntax
      workerRef.current = new Worker(
        new URL('../workers/filterWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event) => {
        const { type, requestId, filteredIds, duration } = event.data;
        
        if (type === 'filterResult') {
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pending.resolve({ filteredIds, duration });
            pendingRef.current.delete(requestId);
          }
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('[FilterWorker] Error:', error);
        // Reject all pending requests
        pendingRef.current.forEach((pending) => {
          pending.reject(new Error('Worker error'));
        });
        pendingRef.current.clear();
      };

      setIsReady(true);
      console.log('[FilterWorker] Initialized successfully');
    } catch (error) {
      console.warn('[FilterWorker] Failed to initialize:', error);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Filter function that uses worker for large datasets
  const filterTracks = useCallback(async (
    tracks: Track[],
    searchQuery: string,
    playlistTrackIds: string[] | null,
    showMissingOnly: boolean
  ): Promise<FilterResult> => {
    // For small libraries, use main thread (faster due to no serialization overhead)
    if (tracks.length < WORKER_THRESHOLD || !workerRef.current || !isReady) {
      const startTime = performance.now();
      
      const query = searchQuery.trim().toLowerCase();
      const hasQuery = query.length > 0;
      const playlistSet = playlistTrackIds ? new Set(playlistTrackIds) : null;
      
      const filteredIds = tracks
        .filter((track) => {
          if (playlistSet && !playlistSet.has(track.TrackID)) return false;
          if (showMissingOnly && track.isMissing !== true) return false;
          
          if (hasQuery) {
            const name = track.Name?.toLowerCase() || '';
            const artist = track.Artist?.toLowerCase() || '';
            const album = track.Album?.toLowerCase() || '';
            const genre = track.Genre?.toLowerCase() || '';
            const key = track.Key?.toLowerCase() || '';
            const tags = track.tags?.map(t => `${t.category || ''} ${t.name || ''}`.toLowerCase()).join(' ') || '';
            
            if (!(name.includes(query) || artist.includes(query) || 
                  album.includes(query) || genre.includes(query) || 
                  key.includes(query) || tags.includes(query))) {
              return false;
            }
          }
          
          return true;
        })
        .map(t => t.TrackID);
      
      return {
        filteredIds,
        duration: performance.now() - startTime,
      };
    }

    // Use worker for large datasets
    return new Promise((resolve, reject) => {
      const requestId = `filter-${++requestIdRef.current}`;
      
      pendingRef.current.set(requestId, { resolve, reject });
      
      // Serialize only necessary fields to reduce transfer overhead
      const minimalTracks = tracks.map(t => ({
        TrackID: t.TrackID,
        Name: t.Name,
        Artist: t.Artist,
        Album: t.Album,
        Genre: t.Genre,
        Key: t.Key,
        isMissing: t.isMissing,
        tags: t.tags,
      }));
      
      workerRef.current!.postMessage({
        type: 'filter',
        requestId,
        tracks: minimalTracks,
        searchQuery,
        playlistTrackIds,
        showMissingOnly,
      });
    });
  }, [isReady]);

  return {
    filterTracks,
    isReady,
  };
}
