// AutoTag Types
// Provider and tag types for the auto-tagging feature

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderId = 
  | 'musicbrainz'
  | 'itunes'
  | 'spotify'
  | 'discogs'
  | 'beatport'
  | 'beatsource';

export type AuthState = 'none' | 'required' | 'authenticated' | 'error';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  priority: number;
  requiresAuth: boolean;
  authState: AuthState;
  rateLimit: {
    requests: number;
    perSeconds: number;
  };
  description?: string;
}

// Default provider configurations
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'musicbrainz',
    name: 'MusicBrainz',
    enabled: true,
    priority: 1,
    requiresAuth: false,
    authState: 'none',
    rateLimit: { requests: 1, perSeconds: 1 },
    description: 'Free, open music database',
  },
  {
    id: 'itunes',
    name: 'iTunes/Apple Music',
    enabled: true,
    priority: 2,
    requiresAuth: false,
    authState: 'none',
    rateLimit: { requests: 20, perSeconds: 60 },
    description: 'Apple Music catalog lookup',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    enabled: false,
    priority: 3,
    requiresAuth: true,
    authState: 'required',
    rateLimit: { requests: 100, perSeconds: 30 },
    description: 'Spotify catalog with audio features (BPM, key)',
  },
  {
    id: 'discogs',
    name: 'Discogs',
    enabled: false,
    priority: 4,
    requiresAuth: true,
    authState: 'required',
    rateLimit: { requests: 60, perSeconds: 60 },
    description: 'Vinyl and physical release database',
  },
  {
    id: 'beatport',
    name: 'Beatport',
    enabled: false,
    priority: 5,
    requiresAuth: true,
    authState: 'required',
    rateLimit: { requests: 10, perSeconds: 60 },
    description: 'Electronic/DJ music with BPM, key, genre',
  },
  {
    id: 'beatsource',
    name: 'Beatsource',
    enabled: false,
    priority: 6,
    requiresAuth: false,
    authState: 'none',
    rateLimit: { requests: 10, perSeconds: 60 },
    description: 'Open-format DJ music (coming soon)',
  },
];

// ============================================================================
// Tag Types
// ============================================================================

export type TagKey =
  // Identity
  | 'artist'
  | 'title'
  | 'album'
  | 'albumArtist'
  | 'version'
  | 'remixers'
  // Classification
  | 'genre'
  | 'style'
  | 'label'
  | 'mood'
  // IDs
  | 'releaseId'
  | 'trackId'
  | 'catalogNumber'
  | 'isrc'
  | 'url'
  // Musical
  | 'bpm'
  | 'key'
  // Numbering
  | 'trackNumber'
  | 'discNumber'
  | 'trackTotal'
  // Dates
  | 'publishDate'
  | 'releaseDate'
  | 'year'
  // Lyrics
  | 'lyricsUnsynced'
  | 'lyricsSynced'
  // Other
  | 'albumArt'
  | 'duration'
  | 'explicit'
  | 'otherTags';

export interface TagConfig {
  key: TagKey;
  label: string;
  group: 'identity' | 'classification' | 'ids' | 'musical' | 'numbering' | 'dates' | 'lyrics' | 'other';
  description?: string;
}

// All available tags with their configuration
export const ALL_TAGS: TagConfig[] = [
  // Identity
  { key: 'artist', label: 'Artist', group: 'identity' },
  { key: 'title', label: 'Title', group: 'identity' },
  { key: 'album', label: 'Album', group: 'identity' },
  { key: 'albumArtist', label: 'Album Artist', group: 'identity' },
  { key: 'version', label: 'Version/Mix', group: 'identity' },
  { key: 'remixers', label: 'Remixers', group: 'identity' },
  // Classification
  { key: 'genre', label: 'Genre', group: 'classification' },
  { key: 'style', label: 'Style', group: 'classification' },
  { key: 'label', label: 'Label', group: 'classification' },
  { key: 'mood', label: 'Mood', group: 'classification' },
  // IDs
  { key: 'releaseId', label: 'Release ID', group: 'ids' },
  { key: 'trackId', label: 'Track ID', group: 'ids' },
  { key: 'catalogNumber', label: 'Catalog Number', group: 'ids' },
  { key: 'isrc', label: 'ISRC', group: 'ids' },
  { key: 'url', label: 'URL', group: 'ids' },
  // Musical
  { key: 'bpm', label: 'BPM', group: 'musical' },
  { key: 'key', label: 'Key', group: 'musical' },
  // Numbering
  { key: 'trackNumber', label: 'Track Number', group: 'numbering' },
  { key: 'discNumber', label: 'Disc Number', group: 'numbering' },
  { key: 'trackTotal', label: 'Track Total', group: 'numbering' },
  // Dates
  { key: 'publishDate', label: 'Publish Date', group: 'dates' },
  { key: 'releaseDate', label: 'Release Date', group: 'dates' },
  { key: 'year', label: 'Year', group: 'dates' },
  // Lyrics
  { key: 'lyricsUnsynced', label: 'Lyrics (Unsynced)', group: 'lyrics' },
  { key: 'lyricsSynced', label: 'Lyrics (Synced)', group: 'lyrics' },
  // Other
  { key: 'albumArt', label: 'Album Art', group: 'other' },
  { key: 'duration', label: 'Duration', group: 'other' },
  { key: 'explicit', label: 'Explicit', group: 'other' },
  { key: 'otherTags', label: 'Other Tags', group: 'other' },
];

// Default tags to enable
export const DEFAULT_TAGS: TagKey[] = [
  'artist',
  'title',
  'album',
  'genre',
  'bpm',
  'key',
  'year',
  'albumArt',
  'label',
  'isrc',
  'trackNumber',
  'discNumber',
  'releaseDate',
  'catalogNumber',
  'url',
  'releaseId',
  'trackId',
];

// ============================================================================
// Common Metadata (normalized shape from all providers)
// ============================================================================

export interface ArtworkData {
  mime: string;
  data: string; // Base64
  sourceUrl?: string;
  width?: number;
  height?: number;
}

export interface CommonMetadata {
  // Identity
  artist?: string;
  title?: string;
  album?: string;
  albumArtist?: string;
  version?: string;
  remixers?: string[];
  
  // Classification
  genre?: string[];
  style?: string[];
  label?: string;
  mood?: string[];
  
  // IDs
  releaseId?: string;
  trackId?: string;
  catalogNumber?: string;
  isrc?: string;
  url?: string;
  
  // Musical
  bpm?: number;
  key?: string;
  
  // Numbering
  trackNumber?: number;
  discNumber?: number;
  trackTotal?: number;
  
  // Dates
  publishDate?: string;
  releaseDate?: string;
  year?: number;
  
  // Duration (ms)
  duration?: number;
  
  // Lyrics
  lyricsUnsynced?: string;
  lyricsSynced?: string;
  
  // Art
  albumArt?: ArtworkData;
  
  // Other
  explicit?: boolean;
  
  // Provenance
  sources?: Array<{
    provider: ProviderId;
    confidence: number; // 0-100
    matchedId?: string;
  }>;
}

// ============================================================================
// Search Query
// ============================================================================

export interface SearchQuery {
  artist?: string;
  title?: string;
  album?: string;
  duration?: number; // ms
  isrc?: string;
  
  // For re-matching
  releaseId?: string;
  trackId?: string;
}

// ============================================================================
// Advanced Options
// ============================================================================

export type OverwriteMode = 'never' | 'always' | 'ifEmpty';
export type MatchStrictness = 'loose' | 'normal' | 'strict';

export interface AdvancedOptions {
  // Skip rules
  skipAlreadyTagged: boolean;
  skipIfHasArtistAndTitle: boolean;
  
  // Overwrite behavior
  overwriteMode: OverwriteMode;
  
  // Match strictness
  matchStrictness: MatchStrictness;
  minimumConfidence: number; // 0-100
  
  // File operations
  saveAlbumArtToFile: boolean;
  albumArtFilename: string; // e.g., "cover.jpg"
  
  // Post-processing
  moveSuccessfulTo?: string;
  moveFailedTo?: string;
  
  // Parse from filename
  parseFromFilename: boolean;
  filenamePattern: string; // e.g., "%artist% - %title%"
  
  // Write to file
  writeTagsToFile: boolean;
}

export const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  skipAlreadyTagged: false,
  skipIfHasArtistAndTitle: false,
  overwriteMode: 'ifEmpty',
  matchStrictness: 'normal',
  minimumConfidence: 50,
  saveAlbumArtToFile: false,
  albumArtFilename: 'cover.jpg',
  parseFromFilename: false,
  filenamePattern: '%artist% - %title%',
  writeTagsToFile: true,
};

// ============================================================================
// Run Configuration
// ============================================================================

export interface AutoTagConfig {
  runId: string;
  files: string[]; // File paths
  providers: ProviderId[];
  tags: TagKey[];
  advanced: AdvancedOptions;
}

// ============================================================================
// Events and Results
// ============================================================================

export type AutoTagEventType =
  | 'started'
  | 'progress'
  | 'track_start'
  | 'track_searching'
  | 'track_matched'
  | 'track_writing'
  | 'track_complete'
  | 'track_skipped'
  | 'track_failed'
  | 'paused'
  | 'resumed'
  | 'cancelled'
  | 'completed'
  | 'error';

export interface AutoTagEvent {
  runId: string;
  type: AutoTagEventType;
  timestamp: number;
  
  // Progress info
  current?: number;
  total?: number;
  
  // Track info
  track?: {
    path: string;
    name?: string;
    artist?: string;
  };
  
  // Provider info
  provider?: ProviderId;
  
  // Match info
  confidence?: number;
  
  // Error info
  error?: string;
  
  // Message
  message?: string;
}

export type AutoTagResultStatus = 'success' | 'skipped' | 'failed' | 'partial';

export interface AutoTagResult {
  runId: string;
  trackPath: string;
  status: AutoTagResultStatus;
  
  // Match info
  matchedProvider?: ProviderId;
  confidence?: number;
  
  // Before/after for diff
  before: Partial<CommonMetadata>;
  after: Partial<CommonMetadata>;
  
  // Updated tags
  updatedTags: TagKey[];
  
  // Error
  error?: string;
  
  // Timing
  duration: number; // ms
}

// ============================================================================
// Run State
// ============================================================================

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

export interface RunProgress {
  current: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

export interface RunState {
  status: RunStatus;
  runId: string | null;
  progress: RunProgress;
  events: AutoTagEvent[];
  results: AutoTagResult[];
  currentTrack?: {
    path: string;
    name?: string;
    artist?: string;
  };
  currentProvider?: ProviderId;
}

export const INITIAL_RUN_STATE: RunState = {
  status: 'idle',
  runId: null,
  progress: { current: 0, total: 0, success: 0, failed: 0, skipped: 0 },
  events: [],
  results: [],
};

// ============================================================================
// Wizard State
// ============================================================================

export type WizardStep = 0 | 1 | 2 | 3 | 4;

export const WIZARD_STEPS = [
  { step: 0 as WizardStep, label: 'Providers', description: 'Choose data sources' },
  { step: 1 as WizardStep, label: 'Tags', description: 'Select tags to update' },
  { step: 2 as WizardStep, label: 'Options', description: 'Advanced settings' },
  { step: 3 as WizardStep, label: 'Run', description: 'Process tracks' },
  { step: 4 as WizardStep, label: 'Review', description: 'View results' },
];
