import { create } from 'zustand';
import { Track, RekordboxLibrary, Playlist } from '../types/track';

interface LibraryState {
  library: RekordboxLibrary | null;
  filteredTracks: Track[];
  selectedTrack: Track | null;
  selectedTracks: Set<string>;
  selectedPlaylist: Playlist | null;
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
  createPlaylist: (name: string, parentPlaylist?: Playlist) => void;
  createFolder: (name: string, parentPlaylist?: Playlist) => void;
  renamePlaylist: (playlist: Playlist, newName: string) => void;
  deletePlaylist: (playlist: Playlist) => void;
  duplicatePlaylist: (playlist: Playlist) => void;
  checkMissingTracks: () => Promise<void>;
  missingTracks: Set<string>;
  showMissingOnly: boolean;
  setShowMissingOnly: (show: boolean) => void;
  deleteTracks: (trackIds: string[]) => void;
  renameTracks: (renames: { trackId: string; newName: string }[]) => void;
  convertTrackFormats: (conversions: { trackId: string; newKind: string; newLocation: string }[]) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: null,
  filteredTracks: [],
  selectedTrack: null,
  selectedTracks: new Set(),
  selectedPlaylist: null,
  searchQuery: '',
  missingTracks: new Set(),
  showMissingOnly: false,

  setLibrary: (library: RekordboxLibrary) => {
    set({ library, selectedPlaylist: null });
    // Filter tracks immediately after setting library
    const state = get();
    state.filterTracks();
  },

  setSelectedPlaylist: (playlist: Playlist | null) => {
    set({ selectedPlaylist: playlist, showMissingOnly: false });
    get().filterTracks();
  },

  updateTrack: (trackId: string, updates: Partial<Track>) => {
    const { library } = get();
    if (!library) return;

    const updatedTracks = library.tracks.map((track) =>
      track.TrackID === trackId ? { ...track, ...updates } : track
    );

    const updatedLibrary = {
      ...library,
      tracks: updatedTracks,
    };

    set({ library: updatedLibrary });
    get().filterTracks();
  },

  setSelectedTrack: (track: Track | null) => {
    set({ selectedTrack: track });
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

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().filterTracks();
  },

  filterTracks: () => {
    const { library, searchQuery, selectedPlaylist, showMissingOnly } = get();
    if (!library) {
      set({ filteredTracks: [] });
      return;
    }

    // Optimize: Single pass filtering instead of multiple passes
    const query = searchQuery.trim().toLowerCase();
    const hasQuery = query.length > 0;
    const playlistTrackIds = selectedPlaylist && selectedPlaylist.Type !== '0' 
      ? new Set(selectedPlaylist.Entries || [])
      : null;
    const hasPlaylistFilter = playlistTrackIds !== null;

    // Single pass filtering for better performance

    const filtered = library.tracks.filter((track) => {
      // Filter by playlist (if applicable)
      if (hasPlaylistFilter && !playlistTrackIds!.has(track.TrackID)) {
        return false;
      }

      // Filter by missing tracks (if enabled)
      if (showMissingOnly && track.isMissing !== true) {
        return false;
      }

      // Apply search filter (single pass with early exit)
      if (hasQuery) {
        const name = track.Name?.toLowerCase() || '';
        const artist = track.Artist?.toLowerCase() || '';
        const album = track.Album?.toLowerCase() || '';
        const genre = track.Genre?.toLowerCase() || '';
        const key = track.Key?.toLowerCase() || '';
        
        // Early exit if any field matches
        if (!(name.includes(query) || artist.includes(query) || 
              album.includes(query) || genre.includes(query) || key.includes(query))) {
          return false;
        }
      }

      return true;
    });

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

  createPlaylist: (name: string, parentPlaylist?: Playlist) => {
    const { library } = get();
    if (!library) return;

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
    const { library } = get();
    if (!library) return;

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
}));

