import { TrackSearchResult } from '../types/musicDatabase';

// Simplified music database client
// In production, you'd need actual API keys and proper implementations

export class MusicDatabaseClient {
  
  // Search MusicBrainz (free, no API key needed)
  async searchMusicBrainz(artist: string, title: string): Promise<TrackSearchResult | null> {
    try {
      const query = encodeURIComponent(`artist:${artist} recording:${title}`);
      const url = `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Bonk/1.0.0 ( bonk@example.com )'
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.recordings || data.recordings.length === 0) return null;
      
      const recording = data.recordings[0];
      const release = recording.releases?.[0];
      
      return {
        title: recording.title || title,
        artist: recording['artist-credit']?.[0]?.name || artist,
        album: release?.title,
        year: release?.date ? parseInt(release.date.substring(0, 4)) : undefined,
        label: release?.['label-info']?.[0]?.label?.name,
        source: 'musicbrainz',
        confidence: recording.score ? recording.score / 100 : 0.5,
      };
    } catch (error) {
      console.error('MusicBrainz search error:', error);
      return null;
    }
  }

  // Search Spotify (requires API key in production)
  async searchSpotify(artist: string, title: string, accessToken?: string): Promise<TrackSearchResult | null> {
    if (!accessToken) {
      // Return null if no access token
      // In production, you'd implement OAuth flow
      return null;
    }
    
    try {
      const query = encodeURIComponent(`artist:${artist} track:${title}`);
      const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.tracks?.items || data.tracks.items.length === 0) return null;
      
      const track = data.tracks.items[0];
      
      // Get audio features for energy, danceability, etc.
      let audioFeatures = null;
      try {
        const featuresUrl = `https://api.spotify.com/v1/audio-features/${track.id}`;
        const featuresResponse = await fetch(featuresUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (featuresResponse.ok) {
          audioFeatures = await featuresResponse.json();
        }
      } catch (e) {
        // Features not available
      }
      
      return {
        title: track.name,
        artist: track.artists[0]?.name || artist,
        album: track.album?.name,
        year: track.album?.release_date ? parseInt(track.album.release_date.substring(0, 4)) : undefined,
        genre: undefined, // Spotify doesn't provide genre at track level
        energy: audioFeatures?.energy,
        danceability: audioFeatures?.danceability,
        popularity: track.popularity,
        happiness: audioFeatures?.valence,
        source: 'spotify',
        confidence: 0.8,
      };
    } catch (error) {
      console.error('Spotify search error:', error);
      return null;
    }
  }


  // Main search function that tries Spotify and MusicBrainz
  async searchAllSources(
    artist: string,
    title: string,
    options: {
      enableSpotify?: boolean;
      enableMusicBrainz?: boolean;
      spotifyToken?: string;
    }
  ): Promise<TrackSearchResult | null> {
    const sources = [];
    
    if (options.enableSpotify) sources.push('spotify');
    if (options.enableMusicBrainz) sources.push('musicbrainz');
    
    for (const source of sources) {
      let result: TrackSearchResult | null = null;
      
      switch (source) {
        case 'spotify':
          result = await this.searchSpotify(artist, title, options.spotifyToken);
          break;
        case 'musicbrainz':
          result = await this.searchMusicBrainz(artist, title);
          break;
      }
      
      if (result && result.confidence > 0.5) {
        return result;
      }
    }
    
    return null;
  }

}

export const musicDatabaseClient = new MusicDatabaseClient();

