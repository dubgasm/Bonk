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
  writeComposer: boolean;
  writeAlbumArtist: boolean;
  writeRemixer: boolean;
  writeLabel: boolean;
  writeReleaseDate: boolean;
  writeTrackNumber: boolean;
  writeDiscNumber: boolean;
  writeLyricist: boolean;
  writeOriginalArtist: boolean;
  writeMixName: boolean;
}

export interface ApiCredentials {
  spotifyClientId: string;
  spotifyClientSecret: string;
  discogsToken: string;
  beatportUsername: string;
  beatportPassword: string;
}

export type KeyFormat = 'standard' | 'camelot' | 'openkey';

export interface TaggingPreferences {
  keyFormat: KeyFormat;
}

export interface AppSettings {
  syncSettings: SyncSettings;
  fieldMappings: FieldMapping[];
  tagWriteSettings: TagWriteSettings;
  apiCredentials: ApiCredentials;
  taggingPreferences: TaggingPreferences;
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
    writeRating: true,
    writeComposer: false,
    writeAlbumArtist: false,
    writeRemixer: false,
    writeLabel: false,
    writeReleaseDate: false,
    writeTrackNumber: false,
    writeDiscNumber: false,
    writeLyricist: false,
    writeOriginalArtist: false,
    writeMixName: false,
  },
  apiCredentials: {
    spotifyClientId: '',
    spotifyClientSecret: '',
    discogsToken: '',
    beatportUsername: '',
    beatportPassword: '',
  },
  taggingPreferences: {
    keyFormat: 'camelot', // Default to Camelot for DJs
  },
  lastSyncDate: null,
  skipPlaylistRemovalConfirm: false,
};

