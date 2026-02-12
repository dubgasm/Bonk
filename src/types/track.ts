export interface Track {
  TrackID: string;
  Name: string;
  Artist: string;
  Album?: string;
  Genre?: string;
  Kind?: string;
  Size?: string;
  TotalTime?: string;
  Year?: string;
  AverageBpm?: string;
  DateAdded?: string;
  BitRate?: string;
  SampleRate?: string;
  Comments?: string;
  PlayCount?: string;
  Rating?: string;  // Legacy: kept for migration, prefer ratingByte
  ratingByte?: number; // 0..255 POPM rating byte (single source of truth)
  Mood?: string;
  Location?: string;
  Remixer?: string;
  Tonality?: string;
  Label?: string;
  Mix?: string;
  Grouping?: string;
  Key?: string;
  Composer?: string;
  AlbumArtist?: string;
  AlbumArt?: string;  // Base64-encoded image data
  TrackNumber?: string;  // Track number on album
  DiscNumber?: string;   // Disc number for multi-disc albums
  Lyricist?: string;     // Song lyricist
  OriginalArtist?: string; // Original artist (for covers/remixes)
  
  // Enhanced metadata
  CatalogNumber?: string;  // e.g., "LM005"
  Publisher?: string;       // Record label/publisher
  Writers?: string;         // Comma-separated writers
  Producers?: string;       // Comma-separated producers
  FeaturedArtists?: string; // Featured/guest artists
  ISRC?: string;           // International Standard Recording Code
  ReleaseDate?: string;    // Full release date
  MixName?: string;        // Mix/version name (e.g., "Sweet Version", "Stenny Remix")
  
  CuePoints?: CuePoint[];
  isMissing?: boolean; // Track if file is missing
  // Custom tags for smartlists (category + name)
  tags?: CustomTag[];
}

export interface CuePoint {
  Name: string;
  Type: string;
  Start: string;
  Num: string;
  Red?: string;
  Green?: string;
  Blue?: string;
}

export interface Playlist {
  Name: string;
  Type: string; // "0" = folder, "1" = regular playlist, "2" = smart playlist
  KeyType: string;
  Entries: string[];
  Children?: Playlist[];
  // Smart playlist properties (only present for Type === "2")
  conditions?: SmartListCondition[];
  logicalOperator?: number; // 1 = ALL, 2 = ANY
}

export enum SmartListProperty {
  ARTIST = 'ARTIST',
  ALBUM = 'ALBUM',
  ALBUM_ARTIST = 'ALBUM_ARTIST',
  ORIGINAL_ARTIST = 'ORIGINAL_ARTIST',
  BPM = 'BPM',
  GROUPING = 'GROUPING',
  COMMENTS = 'COMMENTS',
  PRODUCER = 'PRODUCER',
  STOCK_DATE = 'STOCK_DATE',
  DATE_CREATED = 'DATE_CREATED',
  COUNTER = 'COUNTER',
  FILENAME = 'FILENAME',
  GENRE = 'GENRE',
  KEY = 'KEY',
  LABEL = 'LABEL',
  MIX_NAME = 'MIX_NAME',
  MYTAG = 'MYTAG',
  RATING = 'RATING',
  DATE_RELEASED = 'DATE_RELEASED',
  REMIXED_BY = 'REMIXED_BY',
  DURATION = 'DURATION',
  NAME = 'NAME',
  YEAR = 'YEAR',
  CUSTOM_TAG = 'CUSTOM_TAG'
}

export enum SmartListOperator {
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
  GREATER = 'GREATER',
  LESS = 'LESS',
  IN_RANGE = 'IN_RANGE',
  IN_LAST = 'IN_LAST',
  NOT_IN_LAST = 'NOT_IN_LAST',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH'
}

export interface SmartListCondition {
  property: SmartListProperty;
  operator: SmartListOperator;
  value_left: string;
  value_right?: string; // For BETWEEN operator
}

export enum SmartListLogicalOperator {
  ALL = 1,
  ANY = 2
}

export interface SmartList {
  logical_operator: SmartListLogicalOperator;
  conditions: SmartListCondition[];
}

export interface CustomTag {
  category: string;
  name: string;
  source?: string; // optional, e.g., 'rekordbox'
}

export interface RekordboxLibrary {
  tracks: Track[];
  playlists: Playlist[];
}

