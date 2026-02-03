/**
 * SearchIndex - High-performance search indexing for large track libraries
 * 
 * Uses an inverted index with n-gram tokenization for instant search results.
 * Supports incremental updates and provides O(1) lookups for indexed terms.
 */

import { Track } from '../types/track';

// Minimum n-gram size for indexing (trigrams provide good balance)
const MIN_NGRAM_SIZE = 2;
const MAX_NGRAM_SIZE = 4;

// Fields to index for search
const INDEXED_FIELDS: (keyof Track)[] = ['Name', 'Artist', 'Album', 'Genre', 'Key'];

interface IndexEntry {
  trackIds: Set<string>;
}

interface SearchIndex {
  terms: Map<string, IndexEntry>;
  trackSearchableText: Map<string, string>; // Cache of searchable text per track
  lastBuildTime: number;
  trackCount: number;
}

/**
 * Creates n-grams from a string for indexing
 */
function createNgrams(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  if (normalized.length < MIN_NGRAM_SIZE) {
    return normalized.length > 0 ? [normalized] : [];
  }
  
  const ngrams: string[] = [];
  
  // Add the full normalized text for exact matching
  ngrams.push(normalized);
  
  // Add word-level tokens for better search relevance
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  words.forEach(word => {
    if (word.length >= MIN_NGRAM_SIZE) {
      ngrams.push(word);
    }
    
    // Create character n-grams for substring matching
    for (let size = MIN_NGRAM_SIZE; size <= Math.min(MAX_NGRAM_SIZE, word.length); size++) {
      for (let i = 0; i <= word.length - size; i++) {
        ngrams.push(word.slice(i, i + size));
      }
    }
  });
  
  return [...new Set(ngrams)]; // Deduplicate
}

/**
 * Extracts searchable text from a track
 */
function getSearchableText(track: Track): string {
  const parts: string[] = [];
  
  for (const field of INDEXED_FIELDS) {
    const value = track[field];
    if (value && typeof value === 'string') {
      parts.push(value);
    }
  }
  
  // Include tags in search
  if (track.tags && Array.isArray(track.tags)) {
    for (const tag of track.tags) {
      if (tag.category) parts.push(tag.category);
      if (tag.name) parts.push(tag.name);
    }
  }
  
  return parts.join(' ').toLowerCase();
}

/**
 * Builds a search index from tracks
 */
export function buildSearchIndex(tracks: Track[]): SearchIndex {
  const startTime = performance.now();
  const index: SearchIndex = {
    terms: new Map(),
    trackSearchableText: new Map(),
    lastBuildTime: 0,
    trackCount: tracks.length,
  };
  
  for (const track of tracks) {
    const searchableText = getSearchableText(track);
    index.trackSearchableText.set(track.TrackID, searchableText);
    
    const ngrams = createNgrams(searchableText);
    
    for (const ngram of ngrams) {
      let entry = index.terms.get(ngram);
      if (!entry) {
        entry = { trackIds: new Set() };
        index.terms.set(ngram, entry);
      }
      entry.trackIds.add(track.TrackID);
    }
  }
  
  index.lastBuildTime = performance.now() - startTime;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SearchIndex] Built index for ${tracks.length} tracks in ${index.lastBuildTime.toFixed(2)}ms`);
    console.log(`[SearchIndex] Index contains ${index.terms.size} unique terms`);
  }
  
  return index;
}

/**
 * Updates the search index when a track is modified
 */
export function updateTrackInIndex(index: SearchIndex, track: Track): void {
  // Remove old entries if track was previously indexed
  const oldText = index.trackSearchableText.get(track.TrackID);
  if (oldText) {
    const oldNgrams = createNgrams(oldText);
    for (const ngram of oldNgrams) {
      const entry = index.terms.get(ngram);
      if (entry) {
        entry.trackIds.delete(track.TrackID);
        if (entry.trackIds.size === 0) {
          index.terms.delete(ngram);
        }
      }
    }
  }
  
  // Add new entries
  const newText = getSearchableText(track);
  index.trackSearchableText.set(track.TrackID, newText);
  
  const newNgrams = createNgrams(newText);
  for (const ngram of newNgrams) {
    let entry = index.terms.get(ngram);
    if (!entry) {
      entry = { trackIds: new Set() };
      index.terms.set(ngram, entry);
    }
    entry.trackIds.add(track.TrackID);
  }
}

/**
 * Removes a track from the search index
 */
export function removeTrackFromIndex(index: SearchIndex, trackId: string): void {
  const text = index.trackSearchableText.get(trackId);
  if (!text) return;
  
  const ngrams = createNgrams(text);
  for (const ngram of ngrams) {
    const entry = index.terms.get(ngram);
    if (entry) {
      entry.trackIds.delete(trackId);
      if (entry.trackIds.size === 0) {
        index.terms.delete(ngram);
      }
    }
  }
  
  index.trackSearchableText.delete(trackId);
  index.trackCount--;
}

/**
 * Searches the index and returns matching track IDs
 */
export function searchIndex(index: SearchIndex, query: string): Set<string> | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return null; // Return null to indicate "show all tracks"
  }
  
  // Generate search tokens from query
  const queryNgrams = createNgrams(normalizedQuery);
  
  if (queryNgrams.length === 0) {
    return null;
  }
  
  // Find tracks that match ALL query tokens (AND search)
  let resultSet: Set<string> | null = null;
  
  for (const ngram of queryNgrams) {
    const entry = index.terms.get(ngram);
    const matchingIds = entry?.trackIds || new Set<string>();
    
    if (resultSet === null) {
      resultSet = new Set(matchingIds);
    } else {
      // Intersect with previous results
      const newSet = new Set<string>();
      for (const id of resultSet) {
        if (matchingIds.has(id)) {
          newSet.add(id);
        }
      }
      resultSet = newSet;
    }
    
    // Early exit if no matches
    if (resultSet.size === 0) {
      break;
    }
  }
  
  return resultSet || new Set();
}

/**
 * Performs a fast search with fallback to full-text search for complex queries
 */
export function fastSearch(
  index: SearchIndex | null,
  tracks: Track[],
  query: string
): Track[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return tracks;
  }
  
  // Try indexed search first
  if (index) {
    const matchingIds = searchIndex(index, normalizedQuery);
    
    if (matchingIds !== null) {
      const idSet = matchingIds;
      const results = tracks.filter(t => idSet.has(t.TrackID));
      
      // Verify results with full-text search for accuracy
      // This handles cases where n-gram matching might be too broad
      return results.filter(track => {
        const searchText = index.trackSearchableText.get(track.TrackID) || '';
        return searchText.includes(normalizedQuery);
      });
    }
  }
  
  // Fallback to linear search
  return tracks.filter(track => {
    const name = track.Name?.toLowerCase() || '';
    const artist = track.Artist?.toLowerCase() || '';
    const album = track.Album?.toLowerCase() || '';
    const genre = track.Genre?.toLowerCase() || '';
    const key = track.Key?.toLowerCase() || '';
    const tags = track.tags?.map(t => `${t.category || ''} ${t.name || ''}`.toLowerCase()).join(' ') || '';
    
    return name.includes(normalizedQuery) ||
           artist.includes(normalizedQuery) ||
           album.includes(normalizedQuery) ||
           genre.includes(normalizedQuery) ||
           key.includes(normalizedQuery) ||
           tags.includes(normalizedQuery);
  });
}

// Export types
export type { SearchIndex };
