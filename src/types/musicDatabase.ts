export interface TrackSearchResult {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  label?: string;
  energy?: number; // 0-1
  danceability?: number; // 0-1
  popularity?: number; // 0-100
  happiness?: number; // 0-1
  source: 'spotify' | 'musicbrainz';
  confidence: number; // 0-1
}

export interface TagFinderOptions {
  enableSpotify: boolean;
  enableMusicBrainz: boolean;
  originalRelease: boolean;
  updateGenre: boolean;
  updateYear: boolean;
  updateLabel: boolean;
  updateAlbum: boolean;
  updateEnergy: boolean;
  updateDanceability: boolean;
  updatePopularity: boolean;
  updateHappiness: boolean;
  // API Credentials
  spotifyClientId?: string;
  spotifyClientSecret?: string;
}

export const defaultTagFinderOptions: TagFinderOptions = {
  enableSpotify: true,
  enableMusicBrainz: true,
  originalRelease: false,
  updateGenre: true,
  updateYear: true,
  updateLabel: true,
  updateAlbum: true,
  updateEnergy: false,
  updateDanceability: false,
  updatePopularity: false,
  updateHappiness: false,
  spotifyClientId: '',
  spotifyClientSecret: '',
};

export interface TagFinderProgress {
  current: number;
  total: number;
  currentTrack: string;
  status: 'searching' | 'downloading' | 'embedding' | 'complete' | 'error';
  message: string;
}

export interface TagFinderResult {
  success: boolean;
  tracksUpdated: number;
  tracksSkipped: number;
  errors: Array<{ track: string; error: string }>;
}

