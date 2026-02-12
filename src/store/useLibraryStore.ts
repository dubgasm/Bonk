import { create } from 'zustand';
import { Track, RekordboxLibrary, Playlist } from '../types/track';
import { evaluateTagSmartlist, TagSmartlistRule, TagSmartlistMatchMode } from '../utils/customSmartlist';
import { SearchIndex, buildSearchIndex, updateTrackInIndex, fastSearch } from '../utils/searchIndex';

// Load genres from localStorage
const loadGenresFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem('bonk_genres');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load genres from storage:', e);
  }
  return [];
};

// Save genres to localStorage
const saveGenresToStorage = (genres: string[]): void => {
  try {
    localStorage.setItem('bonk_genres', JSON.stringify(genres));
  } catch (e) {
    console.error('Failed to save genres to storage:', e);
  }
};

// Load tag categories from localStorage
const loadTagCategoriesFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem('bonk_tagCategories');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load tag categories from storage:', e);
  }
  return [];
};

// Save tag categories to localStorage
const saveTagCategoriesToStorage = (categories: string[]): void => {
  try {
    localStorage.setItem('bonk_tagCategories', JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save tag categories to storage:', e);
  }
};

interface LibraryState {
  library: RekordboxLibrary | null;
  searchIndex: SearchIndex | null;
  sortState: { column: string; direction: 'asc' | 'desc' };
  setSort: (column: string, direction: 'asc' | 'desc') => void;
  filteredTracks: Track[];
  selectedTrack: Track | null;
  selectedTracks: Set<string>;
  selectedPlaylist: Playlist | null;
  auditionTrackId: string | null;
  setAuditionTrackId: (id: string | null) => void;
  searchQuery: string;
  setLibrary: (library: RekordboxLibrary) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  setSelectedTrack: (track: Track | null) => void;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  toggleTrackSelection: (trackId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setSearchQuery: (query: string) => void;
  filterTracks: () => void;
  getSelectedTracksData: () => Track[];
  addTracksToPlaylist: (playlistName: string, trackIds: string[]) => void;
  removeTracksFromPlaylist: (playlistName: string, trackIds: string[]) => void;
  createPlaylist: (name: string, parentPlaylist?: Playlist) => void;
  createFolder: (name: string, parentPlaylist?: Playlist) => void;
  renamePlaylist: (playlist: Playlist, newName: string) => void;
  deletePlaylist: (playlist: Playlist) => void;
  duplicatePlaylist: (playlist: Playlist) => void;
  createSmartPlaylist: (name: string, conditions: any[], logicalOperator?: number, parent?: Playlist) => Promise<void>;
  getSmartPlaylistContents: (playlistId: string) => Promise<any>;
  checkMissingTracks: () => Promise<void>;
  missingTracks: Set<string>;
  showMissingOnly: boolean;
  setShowMissingOnly: (show: boolean) => void;
  deleteTracks: (trackIds: string[]) => void;
  renameTracks: (renames: { trackId: string; newName: string }[]) => void;
  convertTrackFormats: (conversions: { trackId: string; newKind: string; newLocation: string }[]) => void;
  applySmartFixes: (trackIds: string[], fixes: any) => Promise<{ updated: number; errors: string[] }>;
  // Custom tag smartlist evaluation
  evaluateCustomTagSmartlist: (rules: TagSmartlistRule[], matchMode: TagSmartlistMatchMode) => Track[];
  // Tag management
  tagCategories: string[];
  addTagCategory: (name: string) => void;
  deleteTagCategory: (name: string) => void;
  renameTagCategory: (oldName: string, newName: string) => void;
  reorderTagCategories: (fromIndex: number, toIndex: number) => void;
  setTrackTags: (trackId: string, tags: any[]) => void;
  batchUpdateTags: (trackIds: string[], tagsToAdd: any[], tagsToRemove: any[], mode: 'add' | 'replace' | 'remove') => void;
  getAllTags: () => { category: string; name: string }[];
  deleteTagFromAllTracks: (category: string, name: string) => void;
  // Genre management
  genres: string[];
  getAllGenres: () => string[];
  addGenre: (name: string) => void;
  deleteGenre: (name: string) => void;
  renameGenre: (oldName: string, newName: string) => void;
  batchUpdateGenres: (trackIds: string[], genre: string, mode: 'set' | 'clear') => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: null,
  searchIndex: null,
  sortState: { column: 'DateAdded', direction: 'desc' },
  filteredTracks: [],
  selectedTrack: null,
  selectedTracks: new Set(),
  selectedPlaylist: null,
  auditionTrackId: null,
  searchQuery: '',
  missingTracks: new Set(),
  showMissingOnly: false,
  tagCategories: loadTagCategoriesFromStorage(),
  genres: loadGenresFromStorage(),

  setLibrary: (library: RekordboxLibrary) => {
    // Extract unique genres from tracks and merge with saved genres
    const savedGenres = new Set(get().genres);
    library.tracks.forEach((track) => {
      if (track.Genre && track.Genre.trim()) {
        savedGenres.add(track.Genre.trim());
      }
    });
    const genresList = Array.from(savedGenres).sort();
    saveGenresToStorage(genresList);
    
    // Build search index for fast filtering
    const searchIndex = buildSearchIndex(library.tracks);
    
    set({ library, searchIndex, selectedPlaylist: null, genres: genresList });
    // Filter tracks immediately after setting library
    const state = get();
    state.filterTracks();
  },

  setSelectedPlaylist: (playlist: Playlist | null) => {
    set({ selectedPlaylist: playlist, showMissingOnly: false });
    get().filterTracks();
  },

  updateTrack: (trackId: string, updates: Partial<Track>) => {
    const { library, genres, searchIndex } = get();
    if (!library) return;

    const updatedTracks = library.tracks.map((track) =>
      track.TrackID === trackId ? { ...track, ...updates } : track
    );

    // Update search index for the modified track
    if (searchIndex) {
      const updatedTrack = updatedTracks.find(t => t.TrackID === trackId);
      if (updatedTrack) {
        updateTrackInIndex(searchIndex, updatedTrack);
      }
    }

    // Update genres list if genre was added/updated
    if (updates.Genre !== undefined) {
      const newGenres = new Set(genres);
      if (updates.Genre && updates.Genre.trim()) {
        newGenres.add(updates.Genre.trim());
      }
      // Also scan all tracks for genres in case we missed any
      updatedTracks.forEach((track) => {
        if (track.Genre && track.Genre.trim()) {
          newGenres.add(track.Genre.trim());
        }
      });
      const updatedGenres = Array.from(newGenres).sort();
      saveGenresToStorage(updatedGenres);
      set({ library: { ...library, tracks: updatedTracks }, genres: updatedGenres });
    } else {
      set({ library: { ...library, tracks: updatedTracks } });
    }

    get().filterTracks();
  },

  setSelectedTrack: (track: Track | null) => {
    set({ selectedTrack: track });
  },

  setAuditionTrackId: (id: string | null) => {
    set({ auditionTrackId: id });
  },

  toggleTrackSelection: (trackId: string) => {
    set((state) => {
      const newSelection = new Set(state.selectedTracks);
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId);
      } else {
        newSelection.add(trackId);
      }
      return { selectedTracks: newSelection };
    });
  },

  clearSelection: () => {
    set({ selectedTracks: new Set() });
  },

  selectAll: () => {
    const { filteredTracks } = get();
    const allIds = new Set(filteredTracks.map((t) => t.TrackID));
    set({ selectedTracks: allIds });
  },

  setSort: (column: string, direction: 'asc' | 'desc') => {
    set({ sortState: { column, direction } });
    get().filterTracks();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().filterTracks();
  },

  filterTracks: () => {
    const { library, searchIndex, searchQuery, selectedPlaylist, showMissingOnly, sortState } = get();
    if (!library) {
      set({ filteredTracks: [] });
      return;
    }

    const query = searchQuery.trim();
    const hasQuery = query.length > 0;
    const playlistTrackIds = selectedPlaylist && selectedPlaylist.Type !== '0' 
      ? new Set(selectedPlaylist.Entries || [])
      : null;
    const hasPlaylistFilter = playlistTrackIds !== null;

    // Start with base track set
    let baseSet = library.tracks;

    // Apply playlist filter first (reduces search space)
    if (hasPlaylistFilter) {
      baseSet = baseSet.filter(track => playlistTrackIds!.has(track.TrackID));
    }

    // Apply missing filter
    if (showMissingOnly) {
      baseSet = baseSet.filter(track => track.isMissing === true);
    }

    // Apply search filter using fast indexed search
    let filtered: Track[];
    if (hasQuery) {
      // Use the high-performance search index
      filtered = fastSearch(searchIndex, baseSet, query);
    } else {
      filtered = baseSet;
    }

    // Apply Sorting
    if (sortState) {
      const { column, direction } = sortState;
      filtered.sort((a, b) => {
        let valA: any = (a as any)[column];
        let valB: any = (b as any)[column];

        // Handle specific columns mapping
        switch (column) {
          case 'title': valA = a.Name; valB = b.Name; break;
          case 'artist': valA = a.Artist; valB = b.Artist; break;
          case 'album': valA = a.Album; valB = b.Album; break;
          case 'genre': valA = a.Genre; valB = b.Genre; break;
          case 'bpm': valA = parseFloat(a.AverageBpm || '0'); valB = parseFloat(b.AverageBpm || '0'); break;
          case 'key': valA = a.Key || a.Tonality; valB = b.Key || b.Tonality; break;
          case 'rating': 
            valA = a.ratingByte || (a.Rating ? Number(a.Rating) : 0); 
            valB = b.ratingByte || (b.Rating ? Number(b.Rating) : 0); 
            break;
          case 'time': valA = parseInt(a.TotalTime || '0'); valB = parseInt(b.TotalTime || '0'); break;
          case 'year': valA = parseInt(a.Year || '0'); valB = parseInt(b.Year || '0'); break;
          case 'DateAdded': valA = a.DateAdded; valB = b.DateAdded; break;
          // Add other columns as needed
        }

        if (valA === valB) return 0;
        
        // Handle undefined/null
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    set({ filteredTracks: filtered });
  },

  setShowMissingOnly: (show: boolean) => {
    set({ showMissingOnly: show });
    get().filterTracks();
  },

  getSelectedTracksData: () => {
    const { library, selectedTracks } = get();
    if (!library) return [];
    return library.tracks.filter((track) => selectedTracks.has(track.TrackID));
  },

  addTracksToPlaylist: (playlistName: string, trackIds: string[]) => {
    const { library } = get();
    if (!library) return;

    const findAndUpdatePlaylist = (playlists: Playlist[]): Playlist[] => {
      return playlists.map((playlist) => {
        if (playlist.Name === playlistName && playlist.Type !== '0') {
          // Add tracks to playlist, avoiding duplicates
          const existingIds = new Set(playlist.Entries || []);
          const newIds = trackIds.filter((id) => !existingIds.has(id));
          return {
            ...playlist,
            Entries: [...(playlist.Entries || []), ...newIds],
          };
        }
        if (playlist.Children) {
          return {
            ...playlist,
            Children: findAndUpdatePlaylist(playlist.Children),
          };
        }
        return playlist;
      });
    };

    const updatedPlaylists = findAndUpdatePlaylist(library.playlists);
    set({ library: { ...library, playlists: updatedPlaylists } });
  },

  removeTracksFromPlaylist: (playlistName: string, trackIds: string[]) => {
    const { library } = get();
    if (!library) return;

    const trackIdsSet = new Set(trackIds);

    const findAndUpdatePlaylist = (playlists: Playlist[]): Playlist[] => {
      return playlists.map((playlist) => {
        if (playlist.Name === playlistName && playlist.Type !== '0') {
          // Remove tracks from playlist
          return {
            ...playlist,
            Entries: (playlist.Entries || []).filter((id) => !trackIdsSet.has(id)),
          };
        }
        if (playlist.Children) {
          return {
            ...playlist,
            Children: findAndUpdatePlaylist(playlist.Children),
          };
        }
        return playlist;
      });
    };

    const updatedPlaylists = findAndUpdatePlaylist(library.playlists);
    set({ library: { ...library, playlists: updatedPlaylists } });
  },

  createPlaylist: (name: string, parentPlaylist?: Playlist) => {
    let { library } = get();
    if (!library) {
      library = { tracks: [], playlists: [] };
      set({ library, selectedPlaylist: null });
    }

    const newPlaylist: Playlist = {
      Name: name,
      Type: '1', // Regular playlist
      KeyType: 'TrackID',
      Entries: [],
      Children: [],
    };

    if (parentPlaylist) {
      // Add to parent folder
      const addToParent = (playlists: Playlist[]): Playlist[] => {
        return playlists.map((playlist) => {
          if (playlist.Name === parentPlaylist.Name && playlist.Type === '0') {
            return {
              ...playlist,
              Children: [...(playlist.Children || []), newPlaylist],
            };
          }
          if (playlist.Children) {
            return {
              ...playlist,
              Children: addToParent(playlist.Children),
            };
          }
          return playlist;
        });
      };
      const updatedPlaylists = addToParent(library.playlists);
      set({ library: { ...library, playlists: updatedPlaylists } });
    } else {
      // Add to root
      set({ library: { ...library, playlists: [...library.playlists, newPlaylist] } });
    }
  },

  createFolder: (name: string, parentPlaylist?: Playlist) => {
    let { library } = get();
    if (!library) {
      library = { tracks: [], playlists: [] };
      set({ library, selectedPlaylist: null });
    }

    const newFolder: Playlist = {
      Name: name,
      Type: '0', // Folder
      KeyType: 'TrackID',
      Entries: [],
      Children: [],
    };

    if (parentPlaylist) {
      const addToParent = (playlists: Playlist[]): Playlist[] => {
        return playlists.map((playlist) => {
          if (playlist.Name === parentPlaylist.Name && playlist.Type === '0') {
            return {
              ...playlist,
              Children: [...(playlist.Children || []), newFolder],
            };
          }
          if (playlist.Children) {
            return {
              ...playlist,
              Children: addToParent(playlist.Children),
            };
          }
          return playlist;
        });
      };
      const updatedPlaylists = addToParent(library.playlists);
      set({ library: { ...library, playlists: updatedPlaylists } });
    } else {
      set({ library: { ...library, playlists: [...library.playlists, newFolder] } });
    }
  },

  renamePlaylist: (playlist: Playlist, newName: string) => {
    const { library } = get();
    if (!library) return;

    const renameInTree = (playlists: Playlist[]): Playlist[] => {
      return playlists.map((p) => {
        if (p.Name === playlist.Name && p.Type === playlist.Type) {
          return { ...p, Name: newName };
        }
        if (p.Children) {
          return { ...p, Children: renameInTree(p.Children) };
        }
        return p;
      });
    };

    const updatedPlaylists = renameInTree(library.playlists);
    set({ library: { ...library, playlists: updatedPlaylists } });
  },

  deletePlaylist: (playlist: Playlist) => {
    const { library, selectedPlaylist } = get();
    if (!library) return;

    const deleteFromTree = (playlists: Playlist[]): Playlist[] => {
      return playlists
        .filter((p) => !(p.Name === playlist.Name && p.Type === playlist.Type))
        .map((p) => {
          if (p.Children) {
            return { ...p, Children: deleteFromTree(p.Children) };
          }
          return p;
        });
    };

    const updatedPlaylists = deleteFromTree(library.playlists);
    
    // Clear selection if deleted playlist was selected
    const newSelectedPlaylist = selectedPlaylist?.Name === playlist.Name ? null : selectedPlaylist;
    
    set({ 
      library: { ...library, playlists: updatedPlaylists },
      selectedPlaylist: newSelectedPlaylist 
    });
    get().filterTracks();
  },

  duplicatePlaylist: (playlist: Playlist) => {
    const { library } = get();
    if (!library) return;

    const duplicate: Playlist = {
      ...playlist,
      Name: `${playlist.Name} Copy`,
      Children: playlist.Children ? [...playlist.Children] : [],
      Entries: playlist.Entries ? [...playlist.Entries] : [],
    };

    set({ library: { ...library, playlists: [...library.playlists, duplicate] } });
  },

  createSmartPlaylist: async (name: string, conditions: any[], logicalOperator: number = 1, parent?: Playlist) => {
    const filterTracksByConditions = (tracks: Track[], conds: any[], logicalOp: number) => {
      // Numeric comparison function
      const matchNumeric = (value: any, needle: string, op: string, needleRight?: string) => {
        const numVal = parseFloat(value?.toString() || '0');
        const numNeedle = parseFloat(needle || '0');
        const numNeedleRight = needleRight ? parseFloat(needleRight) : null;
        
        if (isNaN(numVal) || isNaN(numNeedle)) return false;
        
        switch (op) {
          case 'EQUAL': return Math.abs(numVal - numNeedle) < 0.01; // Allow small floating point differences
          case 'NOT_EQUAL': return Math.abs(numVal - numNeedle) >= 0.01;
          case 'GREATER': return numVal > numNeedle;
          case 'LESS': return numVal < numNeedle;
          case 'IN_RANGE':
            if (numNeedleRight === null) return false;
            return numVal >= numNeedle && numVal <= numNeedleRight;
          default: return false;
        }
      };

      // String comparison function
      const matchString = (value: any, needle: string, op: string) => {
        const hay = (value ?? '').toString().toLowerCase();
        const ndl = (needle ?? '').toString().toLowerCase();
        if (op === 'EQUAL') return hay === ndl;
        if (op === 'NOT_EQUAL') return hay !== ndl;
        if (op === 'CONTAINS') return hay.includes(ndl);
        if (op === 'NOT_CONTAINS') return !hay.includes(ndl);
        if (op === 'STARTS_WITH') return hay.startsWith(ndl);
        if (op === 'ENDS_WITH') return hay.endsWith(ndl);
        return false;
      };

      const matchesCondition = (track: Track, cond: any) => {
        const val = (() => {
          switch (cond.property) {
            case 'ARTIST': return track.Artist;
            case 'ALBUM': return track.Album;
            case 'ALBUM_ARTIST': return (track as any).AlbumArtist;
            case 'ORIGINAL_ARTIST': return (track as any).OriginalArtist;
            case 'GENRE': return track.Genre;
            case 'KEY': return track.Key;
            case 'LABEL': return track.Label;
            case 'MIX_NAME': return (track as any).MixName || track.Mix;
            case 'COMMENTS': return track.Comments;
            case 'NAME': return track.Name;
            case 'FILENAME': return track.Location ? track.Location.split('/').pop() : '';
            case 'MYTAG': return track.Grouping;
            case 'GROUPING': return track.Grouping;
            case 'CUSTOM_TAG':
              return (track as any).tags?.map((t: any) => t.name)?.join(' ') || '';
            // Numeric fields
            case 'BPM': return track.AverageBpm;
            case 'YEAR': return track.Year;
            case 'DURATION': return track.TotalTime ? (parseFloat(track.TotalTime) / 1000).toString() : ''; // Convert ms to seconds
            case 'RATING': return track.Rating;
            case 'COUNTER': return track.PlayCount;
            case 'PRODUCER': return (track as any).Producers;
            case 'REMIXED_BY': return track.Remixer;
            case 'DATE_RELEASED': return track.ReleaseDate || track.Year;
            case 'STOCK_DATE': return track.DateAdded;
            case 'DATE_CREATED': return track.DateAdded;
            default: return track.Name;
          }
        })();
        
        // Determine if this is a numeric comparison
        const numericOperators = ['GREATER', 'LESS', 'IN_RANGE'];
        const isNumericField = ['BPM', 'YEAR', 'DURATION', 'RATING', 'COUNTER'].includes(cond.property);
        const isNumericOperator = numericOperators.includes(cond.operator);
        
        // Use numeric comparison for numeric fields or numeric operators
        if (isNumericField || isNumericOperator) {
          return matchNumeric(val, cond.value_left || '', cond.operator, cond.value_right);
        }
        
        // Otherwise use string comparison
        return matchString(val, cond.value_left || '', cond.operator);
      };

      const filtered = tracks.filter((t) => {
        if (!conds.length) return true;
        
        if (logicalOp === 1) {
          // ALL conditions must match
          return conds.every((c: any) => matchesCondition(t, c));
        } else {
          // ANY condition must match
          return conds.some((c: any) => matchesCondition(t, c));
        }
      });
      
      console.log(`Filtered ${filtered.length} tracks from ${tracks.length} total (${conds.length} conditions, ${logicalOp === 1 ? 'ALL' : 'ANY'})`);
      return filtered;
    };

    // Normalize conditions before sending to backend:
    // - Map CUSTOM_TAG to MYTAG so pyrekordbox uses MyTag property
    // NOTE: Rekordbox MYTAG expects numeric tag IDs (bitmasks), not tag names.
    // This means CUSTOM_TAG conditions may not work correctly in Rekordbox smart playlists.
    // We rely on local filtering for CUSTOM_TAG conditions to work properly.
    const normalizedConditions = (conditions || []).map((c) => ({
      ...c,
      property: c.property === 'CUSTOM_TAG' ? 'MYTAG' : c.property,
    }));
    
    // Check if we have any CUSTOM_TAG conditions - if so, we'll rely more on local filtering
    const hasCustomTagConditions = conditions.some(c => c.property === 'CUSTOM_TAG');

    // If Rekordbox DB API is available, delegate to bridge
    if (window.electronAPI?.rekordboxCreateSmartPlaylist) {
      try {
        const result = await (window.electronAPI as any).rekordboxCreateSmartPlaylist(
          name,
          normalizedConditions,
          logicalOperator,
          parent?.Name
        );

        if (result?.success) {
          console.log('Smart playlist created via Rekordbox:', result);
          console.log('Conditions:', JSON.stringify(conditions, null, 2));
          console.log('Normalized conditions:', JSON.stringify(normalizedConditions, null, 2));
          console.log('Logical operator:', logicalOperator === 1 ? 'ALL' : 'ANY');
          
          // Reflect it locally so the user sees it immediately
          // Use ORIGINAL conditions (not normalized) for local filtering since CUSTOM_TAG needs special handling
          let { library } = get();
          if (!library) {
            library = { tracks: [], playlists: [] };
          }
          const tracks = library.tracks || [];
          const entries = filterTracksByConditions(tracks, conditions, logicalOperator).map((t) => t.TrackID);
          console.log(`Local filtering found ${entries.length} matching tracks`);
          
          const newSmart: Playlist = {
            Name: name,
            Type: '2', // Smart
            KeyType: 'TrackID',
            Entries: entries,
            Children: [],
            conditions: conditions, // Store conditions for export
            logicalOperator: logicalOperator, // Store logical operator
          };
          
          // If backend returned playlist_id, fetch contents to stay in sync with Rekordbox DB
          if (result.playlist_id && window.electronAPI?.rekordboxGetSmartPlaylistContents) {
            try {
              console.log(`Fetching contents from Rekordbox for playlist ID: ${result.playlist_id}`);
              const contents = await (window.electronAPI as any).rekordboxGetSmartPlaylistContents(result.playlist_id);
              console.log('Rekordbox returned:', contents);
              
              if (contents?.success) {
                const entryIds = contents.tracks ? contents.tracks.map((t: any) => t.TrackID) : [];
                console.log(`Rekordbox found ${entryIds.length} matching tracks`);
                
                // If we have CUSTOM_TAG conditions, prefer local filtering since Rekordbox
                // MYTAG expects numeric IDs, not tag names, so it won't match correctly
                // Otherwise, use Rekordbox results if available, fall back to local filtering
                const finalEntries = hasCustomTagConditions 
                  ? entries  // Always use local filtering for CUSTOM_TAG
                  : (entryIds.length > 0 ? entryIds : entries);  // Prefer Rekordbox, fallback to local
                const finalSmart = { ...newSmart, Entries: finalEntries };
                
                // Update tracks if Rekordbox returned any
                const updatedTracks = contents.tracks && contents.tracks.length > 0 
                  ? contents.tracks 
                  : library.tracks;
                
                // Replace the playlist in the list (don't add twice)
                const existingPlaylists = library.playlists || [];
                const playlistIndex = existingPlaylists.findIndex(p => p.Name === name);
                const updatedPlaylists = playlistIndex >= 0
                  ? existingPlaylists.map((p, i) => i === playlistIndex ? finalSmart : p)
                  : [...existingPlaylists, finalSmart];
                
                set({
                  library: {
                    ...library,
                    tracks: updatedTracks,
                    playlists: updatedPlaylists,
                  },
                });
              } else {
                // Rekordbox fetch failed, use local filtering results
                console.warn('Rekordbox fetch failed, using local filtering results:', contents?.error);
                const updatedPlaylists = [...(library.playlists || []), newSmart];
                set({ library: { ...library, playlists: updatedPlaylists } });
              }
            } catch (err) {
              console.warn('Failed to fetch smart playlist contents from Rekordbox:', err);
              // Fall back to local filtering results
              const updatedPlaylists = [...(library.playlists || []), newSmart];
              set({ library: { ...library, playlists: updatedPlaylists } });
            }
          } else {
            // No playlist_id, just use local filtering
            const updatedPlaylists = [...(library.playlists || []), newSmart];
            set({ library: { ...library, playlists: updatedPlaylists } });
          }

          return;
        } else {
          throw new Error(result?.error || 'Failed to create smart playlist');
        }
      } catch (error) {
        console.error('Error creating smart playlist via Rekordbox:', error);
        // Fall through to local creation
      }
    }

    // Local fallback: build a smart-like playlist in memory by filtering tracks
    // Use ORIGINAL conditions (not normalized) for local filtering since CUSTOM_TAG needs special handling
    const { library } = get();
    if (!library) {
      // initialize empty library if needed
      const emptyLibrary = { tracks: [], playlists: [] };
      set({ library: emptyLibrary, selectedPlaylist: null });
      return;
    }

    const tracks = library.tracks || [];
    const filtered = filterTracksByConditions(tracks, conditions, logicalOperator);

    const newPlaylist: Playlist = {
      Name: name,
      Type: '2', // Smart (local)
      KeyType: 'TrackID',
      Entries: filtered.map((t) => t.TrackID),
      Children: [],
      conditions: conditions, // Store conditions for export
      logicalOperator: logicalOperator, // Store logical operator
    };

    const updatedPlaylists = [...library.playlists, newPlaylist];
    set({ library: { ...library, playlists: updatedPlaylists } });
  },

  getSmartPlaylistContents: async (playlistId: string) => {
    if (!window.electronAPI) return null;

    try {
      const result = await (window.electronAPI as any).rekordboxGetSmartPlaylistContents?.(playlistId);

      if (result?.success) {
        return result;
      } else {
        throw new Error(result?.error || 'Failed to get smart playlist contents');
      }
    } catch (error) {
      console.error('Error getting smart playlist contents:', error);
      throw error;
    }
  },

  checkMissingTracks: async () => {
    const { library } = get();
    if (!library || !window.electronAPI) return;

    const missing = new Set<string>();
    
    // Check each track's file existence
    for (const track of library.tracks) {
      if (!track.Location) {
        missing.add(track.TrackID);
        continue;
      }

      try {
        // Parse file path from Location
        let filePath = track.Location;
        if (filePath.startsWith('file://localhost')) {
          filePath = filePath.replace('file://localhost', '');
        } else if (filePath.startsWith('file://')) {
          filePath = filePath.replace('file://', '');
        }
        filePath = decodeURIComponent(filePath);

        // Check if file exists via IPC
        const exists = await (window.electronAPI as any).checkFileExists?.(filePath);
        if (!exists) {
          missing.add(track.TrackID);
        }
      } catch (error) {
        console.error(`Error checking track ${track.TrackID}:`, error);
        missing.add(track.TrackID);
      }
    }

    set({ missingTracks: missing });
    
    // Update tracks with isMissing flag
    const updatedTracks = library.tracks.map(track => ({
      ...track,
      isMissing: missing.has(track.TrackID)
    }));

    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  deleteTracks: (trackIds: string[]) => {
    const { library } = get();
    if (!library) return;

    const trackIdsSet = new Set(trackIds);
    
    // Remove tracks from library
    const updatedTracks = library.tracks.filter((track) => !trackIdsSet.has(track.TrackID));
    
    // Remove tracks from all playlists
    const removeFromPlaylist = (playlist: Playlist): Playlist => {
      return {
        ...playlist,
        Entries: (playlist.Entries || []).filter((id) => !trackIdsSet.has(id)),
        Children: playlist.Children ? playlist.Children.map(removeFromPlaylist) : [],
      };
    };

    const updatedPlaylists = library.playlists.map(removeFromPlaylist);
    
    // Clear selection if deleted tracks were selected
    const { selectedTracks } = get();
    const newSelectedTracks = new Set(
      Array.from(selectedTracks).filter((id) => !trackIdsSet.has(id))
    );
    
    // Clear selected track if it was deleted
    const { selectedTrack } = get();
    const newSelectedTrack = selectedTrack && trackIdsSet.has(selectedTrack.TrackID) 
      ? null 
      : selectedTrack;

    set({ 
      library: { ...library, tracks: updatedTracks, playlists: updatedPlaylists },
      selectedTracks: newSelectedTracks,
      selectedTrack: newSelectedTrack,
    });
    get().filterTracks();
  },

  renameTracks: (renames: { trackId: string; newName: string }[]) => {
    const { library } = get();
    if (!library) return;

    const renameMap = new Map(renames.map(r => [r.trackId, r.newName]));

    const updatedTracks = library.tracks.map(track => {
      if (renameMap.has(track.TrackID)) {
        return { ...track, Name: renameMap.get(track.TrackID)! };
      }
      return track;
    });

    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  convertTrackFormats: (conversions: { trackId: string; newKind: string; newLocation: string }[]) => {
    const { library } = get();
    if (!library) return;

    const conversionMap = new Map(
      conversions.map(c => [c.trackId, { kind: c.newKind, location: c.newLocation }])
    );

    const updatedTracks = library.tracks.map(track => {
      const conversion = conversionMap.get(track.TrackID);
      if (conversion) {
        return {
          ...track,
          Kind: conversion.kind,
          Location: conversion.location,
        };
      }
      return track;
    });

    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  applySmartFixes: async (trackIds: string[], fixes: any) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const result = await (window.electronAPI as any).applySmartFixes(trackIds, fixes);

      if (result?.success) {
        // Update the tracks in the library with the new data
        const { library } = get();
        if (library) {
          const updatedTracks = library.tracks.map(track => {
            const updatedTrack = result.updates.find((u: any) => u.TrackID === track.TrackID);
            return updatedTrack || track;
          });

          set({ library: { ...library, tracks: updatedTracks } });
          get().filterTracks();
        }

        return { updated: result.updated, errors: result.errors || [] };
      } else {
        throw new Error(result?.error || 'Failed to apply smart fixes');
      }
    } catch (error) {
      console.error('Error applying smart fixes:', error);
      throw error;
    }
  },

  evaluateCustomTagSmartlist: (rules: TagSmartlistRule[], matchMode: TagSmartlistMatchMode) => {
    const { library } = get();
    if (!library) return [];
    return evaluateTagSmartlist(library.tracks, rules, matchMode);
  },

  addTagCategory: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.tagCategories.includes(trimmed)) return state;
      const updated = [...state.tagCategories, trimmed];
      saveTagCategoriesToStorage(updated);
      return { tagCategories: updated };
    });
  },

  reorderTagCategories: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const categories = [...state.tagCategories];
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= categories.length || toIndex >= categories.length) {
        return state;
      }
      const [moved] = categories.splice(fromIndex, 1);
      categories.splice(toIndex, 0, moved);
      saveTagCategoriesToStorage(categories);
      return { tagCategories: categories };
    });
  },

  setTrackTags: (trackId: string, tags: any[]) => {
    const { library } = get();
    if (!library) return;
    const updatedTracks = library.tracks.map((t) => (t.TrackID === trackId ? { ...t, tags } : t));
    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  deleteTagCategory: (name: string) => {
    const { library } = get();
    set((state) => {
      const updatedCategories = state.tagCategories.filter((cat) => cat !== name);
      saveTagCategoriesToStorage(updatedCategories);
      // Remove tags with this category from all tracks
      let updatedTracks = library?.tracks || [];
      if (library) {
        updatedTracks = library.tracks.map((track) => ({
          ...track,
          tags: (track.tags || []).filter((tag) => tag.category !== name),
        }));
      }
      return {
        tagCategories: updatedCategories,
        library: library ? { ...library, tracks: updatedTracks } : library,
      };
    });
    get().filterTracks();
  },

  renameTagCategory: (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const { library } = get();
    set((state) => {
      if (state.tagCategories.includes(trimmed) && trimmed !== oldName) return state;
      const updatedCategories = state.tagCategories.map((cat) => (cat === oldName ? trimmed : cat));
      saveTagCategoriesToStorage(updatedCategories);
      // Update all tags with this category
      let updatedTracks = library?.tracks || [];
      if (library) {
        updatedTracks = library.tracks.map((track) => ({
          ...track,
          tags: (track.tags || []).map((tag) =>
            tag.category === oldName ? { ...tag, category: trimmed } : tag
          ),
        }));
      }
      return {
        tagCategories: updatedCategories,
        library: library ? { ...library, tracks: updatedTracks } : library,
      };
    });
    get().filterTracks();
  },

  batchUpdateTags: (trackIds: string[], tagsToAdd: any[], tagsToRemove: any[], mode: 'add' | 'replace' | 'remove') => {
    const { library } = get();
    if (!library) return;

    const updatedTracks = library.tracks.map((track) => {
      if (!trackIds.includes(track.TrackID)) return track;

      const currentTags = track.tags || [];

      if (mode === 'replace') {
        // Replace all tags with tagsToAdd
        return { ...track, tags: [...tagsToAdd] };
      } else if (mode === 'remove') {
        // Remove specified tags
        const updatedTags = currentTags.filter(
          (tag) =>
            !tagsToRemove.some((rt) => rt.category === tag.category && rt.name === tag.name)
        );
        return { ...track, tags: updatedTags };
      } else {
        // Add mode: add new tags, avoiding duplicates
        const existingTags = new Set(
          currentTags.map((t) => `${t.category}:${t.name}`)
        );
        const newTags = tagsToAdd.filter(
          (tag) => !existingTags.has(`${tag.category}:${tag.name}`)
        );
        return { ...track, tags: [...currentTags, ...newTags] };
      }
    });

    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  getAllTags: () => {
    const { library } = get();
    if (!library) return [];

    const tagSet = new Set<string>();
    library.tracks.forEach((track) => {
      (track.tags || []).forEach((tag) => {
        tagSet.add(`${tag.category}:${tag.name}`);
      });
    });

    return Array.from(tagSet).map((tagStr) => {
      const [category, ...nameParts] = tagStr.split(':');
      return {
        category,
        name: nameParts.join(':'), // In case name contains ':'
      };
    });
  },

  deleteTagFromAllTracks: (category: string, name: string) => {
    const { library } = get();
    if (!library) return;

    const updatedTracks = library.tracks.map((track) => ({
      ...track,
      tags: (track.tags || []).filter(
        (tag) => !(tag.category === category && tag.name === name)
      ),
    }));

    set({ library: { ...library, tracks: updatedTracks } });
    get().filterTracks();
  },

  getAllGenres: () => {
    const { genres } = get();
    return genres;
  },

  addGenre: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.genres.includes(trimmed)) return state;
      const updatedGenres = [...state.genres, trimmed].sort();
      saveGenresToStorage(updatedGenres);
      return { genres: updatedGenres };
    });
  },

  deleteGenre: (name: string) => {
    const { library } = get();
    set((state) => {
      const updatedGenres = state.genres.filter((g) => g !== name);
      saveGenresToStorage(updatedGenres);
      // Optionally clear genre from tracks that have it
      let updatedTracks = library?.tracks || [];
      if (library) {
        updatedTracks = library.tracks.map((track) => ({
          ...track,
          Genre: track.Genre === name ? undefined : track.Genre,
        }));
      }
      return {
        genres: updatedGenres,
        library: library ? { ...library, tracks: updatedTracks } : library,
      };
    });
    get().filterTracks();
  },

  renameGenre: (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const { library } = get();
    set((state) => {
      if (state.genres.includes(trimmed) && trimmed !== oldName) return state;
      const updatedGenres = state.genres
        .map((g) => (g === oldName ? trimmed : g))
        .sort();
      saveGenresToStorage(updatedGenres);
      // Update all tracks with this genre
      let updatedTracks = library?.tracks || [];
      if (library) {
        updatedTracks = library.tracks.map((track) => ({
          ...track,
          Genre: track.Genre === oldName ? trimmed : track.Genre,
        }));
      }
      return {
        genres: updatedGenres,
        library: library ? { ...library, tracks: updatedTracks } : library,
      };
    });
    get().filterTracks();
  },

  batchUpdateGenres: (trackIds: string[], genre: string, mode: 'set' | 'clear') => {
    const { library, genres } = get();
    if (!library) return;

    const updatedTracks = library.tracks.map((track) => {
      if (!trackIds.includes(track.TrackID)) return track;

      if (mode === 'clear') {
        return { ...track, Genre: undefined };
      } else {
        return { ...track, Genre: genre || undefined };
      }
    });

    // Update genres list
    const newGenres = new Set(genres);
    if (mode === 'set' && genre && genre.trim()) {
      newGenres.add(genre.trim());
    }
    // Scan all tracks for genres
    updatedTracks.forEach((track) => {
      if (track.Genre && track.Genre.trim()) {
        newGenres.add(track.Genre.trim());
      }
    });
    const updatedGenresList = Array.from(newGenres).sort();
    saveGenresToStorage(updatedGenresList);

    set({ library: { ...library, tracks: updatedTracks }, genres: updatedGenresList });
    get().filterTracks();
  },
}));

