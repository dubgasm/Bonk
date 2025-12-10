export type SyncMode = 'full' | 'playlist' | 'modified';

export interface SyncSettings {
  mode: SyncMode;
  dontTouchMyGrids: boolean;
  convertColors: boolean;
  selectedPlaylists: string[];
}

export interface FieldMapping {
  lexiconField: string;
  rekordboxField: string;
  enabled: boolean;
}

export interface TagWriteSettings {
  writeTitle: boolean;
  writeArtist: boolean;
  writeAlbum: boolean;
  writeGenre: boolean;
  writeBPM: boolean;
  writeKey: boolean;
  writeYear: boolean;
  writeComments: boolean;
  writeRating: boolean;
}

export interface ApiCredentials {
  spotifyClientId: string;
  spotifyClientSecret: string;
}

export interface AppSettings {
  syncSettings: SyncSettings;
  fieldMappings: FieldMapping[];
  tagWriteSettings: TagWriteSettings;
  apiCredentials: ApiCredentials;
  lastSyncDate: string | null;
  skipPlaylistRemovalConfirm: boolean;
}

export const defaultSettings: AppSettings = {
  syncSettings: {
    mode: 'playlist',
    dontTouchMyGrids: false,
    convertColors: false,
    selectedPlaylists: [],
  },
  fieldMappings: [
    { lexiconField: 'Energy', rekordboxField: 'Comments', enabled: false },
    { lexiconField: 'Tags', rekordboxField: 'Grouping', enabled: false },
    { lexiconField: 'Rating', rekordboxField: 'Rating', enabled: true },
  ],
  tagWriteSettings: {
    writeTitle: true,
    writeArtist: true,
    writeAlbum: true,
    writeGenre: true,
    writeBPM: true,
    writeKey: true,
    writeYear: true,
    writeComments: false,
    writeRating: false,
  },
  apiCredentials: {
    spotifyClientId: '',
    spotifyClientSecret: '',
  },
  lastSyncDate: null,
  skipPlaylistRemovalConfirm: false,
};

