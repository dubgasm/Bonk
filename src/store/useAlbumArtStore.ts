/**
 * Album Art Store - Lazy loading with LRU cache for memory efficiency
 * 
 * Instead of storing all album art in memory, we:
 * 1. Load album art on-demand when tracks become visible
 * 2. Use an LRU cache to keep only recently viewed art in memory
 * 3. Evict old entries to maintain bounded memory usage
 */

import { create } from 'zustand';

// Maximum number of album art images to keep in memory
const MAX_CACHE_SIZE = 100;

// Placeholder for loading/missing art
export const ALBUM_ART_PLACEHOLDER = '♪';

interface AlbumArtEntry {
  data: string | null; // Base64 data or null if not found
  loading: boolean;
  error: string | null;
  lastAccessed: number;
}

interface AlbumArtState {
  cache: Map<string, AlbumArtEntry>;
  loadingQueue: Set<string>;
  
  // Get album art (returns cached or triggers load)
  getAlbumArt: (trackId: string, location?: string) => AlbumArtEntry | null;
  
  // Set album art from initial track data (on library load)
  setAlbumArt: (trackId: string, data: string | null) => void;
  
  // Request album art load for a track
  requestAlbumArt: (trackId: string, location: string) => void;
  
  // Mark album art as loaded
  markLoaded: (trackId: string, data: string | null, error?: string) => void;
  
  // Clear cache (e.g., when switching libraries)
  clearCache: () => void;
  
  // Preload album art for visible tracks
  preloadForTracks: (trackIds: string[], getLocation: (id: string) => string | undefined) => void;
}

// LRU eviction helper
function evictLRU(cache: Map<string, AlbumArtEntry>, maxSize: number): void {
  if (cache.size <= maxSize) return;
  
  // Convert to array and sort by lastAccessed (oldest first)
  const entries = Array.from(cache.entries())
    .filter(([_, entry]) => !entry.loading) // Don't evict loading entries
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  
  // Evict oldest entries until we're under the limit
  const toEvict = cache.size - maxSize;
  for (let i = 0; i < toEvict && i < entries.length; i++) {
    cache.delete(entries[i][0]);
  }
}

export const useAlbumArtStore = create<AlbumArtState>((set, get) => ({
  cache: new Map(),
  loadingQueue: new Set(),
  
  getAlbumArt: (trackId: string, location?: string) => {
    const { cache, requestAlbumArt } = get();
    const entry = cache.get(trackId);
    
    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now();
      return entry;
    }
    
    // Not in cache, request load if we have a location
    if (location) {
      requestAlbumArt(trackId, location);
    }
    
    return null;
  },
  
  setAlbumArt: (trackId: string, data: string | null) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(trackId, {
        data,
        loading: false,
        error: null,
        lastAccessed: Date.now(),
      });
      
      // Evict old entries if needed
      evictLRU(newCache, MAX_CACHE_SIZE);
      
      return { cache: newCache };
    });
  },
  
  requestAlbumArt: (trackId: string, location: string) => {
    const { cache, loadingQueue } = get();
    
    // Already loaded or loading
    if (cache.has(trackId) || loadingQueue.has(trackId)) {
      return;
    }
    
    // Mark as loading
    set((state) => {
      const newCache = new Map(state.cache);
      const newQueue = new Set(state.loadingQueue);
      
      newCache.set(trackId, {
        data: null,
        loading: true,
        error: null,
        lastAccessed: Date.now(),
      });
      newQueue.add(trackId);
      
      return { cache: newCache, loadingQueue: newQueue };
    });
    
    // Request from Electron main process
    if (window.electronAPI?.extractAlbumArt) {
      (window.electronAPI as any).extractAlbumArt(location)
        .then((data: string | null) => {
          get().markLoaded(trackId, data);
        })
        .catch((error: Error) => {
          get().markLoaded(trackId, null, error.message);
        });
    } else {
      // No API available, mark as loaded with no data
      get().markLoaded(trackId, null);
    }
  },
  
  markLoaded: (trackId: string, data: string | null, error?: string) => {
    set((state) => {
      const newCache = new Map(state.cache);
      const newQueue = new Set(state.loadingQueue);
      
      newCache.set(trackId, {
        data,
        loading: false,
        error: error || null,
        lastAccessed: Date.now(),
      });
      newQueue.delete(trackId);
      
      // Evict old entries if needed
      evictLRU(newCache, MAX_CACHE_SIZE);
      
      return { cache: newCache, loadingQueue: newQueue };
    });
  },
  
  clearCache: () => {
    set({ cache: new Map(), loadingQueue: new Set() });
  },
  
  preloadForTracks: (trackIds: string[], getLocation: (id: string) => string | undefined) => {
    const { requestAlbumArt, cache, loadingQueue } = get();
    
    // Only preload first N tracks to avoid overloading
    const MAX_PRELOAD = 20;
    let preloaded = 0;
    
    for (const trackId of trackIds) {
      if (preloaded >= MAX_PRELOAD) break;
      
      // Skip if already cached or loading
      if (cache.has(trackId) || loadingQueue.has(trackId)) {
        continue;
      }
      
      const location = getLocation(trackId);
      if (location) {
        requestAlbumArt(trackId, location);
        preloaded++;
      }
    }
  },
}));
