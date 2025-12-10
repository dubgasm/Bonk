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
  Rating?: string;
  Location?: string;
  Remixer?: string;
  Tonality?: string;
  Label?: string;
  Mix?: string;
  Grouping?: string;
  Key?: string;
  AlbumArt?: string;  // Base64-encoded image data
  
  // Enhanced Beatport metadata
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
  Type: string;
  KeyType: string;
  Entries: string[];
  Children?: Playlist[];
}

export interface RekordboxLibrary {
  tracks: Track[];
  playlists: Playlist[];
}

