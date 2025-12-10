import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { Track, Playlist, RekordboxLibrary, CuePoint } from '../types/track';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '_text',
  parseAttributeValue: false,
  trimValues: true,
};

export class RekordboxParser {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser(parserOptions);
    this.builder = new XMLBuilder({
      ...parserOptions,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
  }

  parseXML(xmlContent: string): RekordboxLibrary {
    const parsed = this.parser.parse(xmlContent);
    
    const djPlaylists = parsed.DJ_PLAYLISTS;
    const collection = djPlaylists?.COLLECTION;
    const playlists = djPlaylists?.PLAYLISTS;

    const tracks = this.parseTracks(collection);
    const playlistsData = this.parsePlaylists(playlists);

    return {
      tracks,
      playlists: playlistsData,
    };
  }

  private parseTracks(collection: any): Track[] {
    if (!collection || !collection.TRACK) {
      return [];
    }

    const trackArray = Array.isArray(collection.TRACK)
      ? collection.TRACK
      : [collection.TRACK];

    return trackArray.map((track: any) => {
      const cuePoints = this.parseCuePoints(track.POSITION_MARK);
      
      return {
        TrackID: track.TrackID || '',
        Name: track.Name || '',
        Artist: track.Artist || '',
        Album: track.Album,
        Genre: track.Genre,
        Kind: track.Kind,
        Size: track.Size,
        TotalTime: track.TotalTime,
        Year: track.Year,
        AverageBpm: track.AverageBpm,
        DateAdded: track.DateAdded,
        BitRate: track.BitRate,
        SampleRate: track.SampleRate,
        Comments: track.Comments,
        PlayCount: track.PlayCount,
        Rating: track.Rating,
        Location: track.Location,
        Remixer: track.Remixer,
        Tonality: track.Tonality,
        Label: track.Label,
        Mix: track.Mix,
        Grouping: track.Grouping,
        Key: track.Tonality,
        CuePoints: cuePoints,
      };
    });
  }

  private parseCuePoints(positionMarks: any): CuePoint[] {
    if (!positionMarks) {
      return [];
    }

    const marksArray = Array.isArray(positionMarks)
      ? positionMarks
      : [positionMarks];

    return marksArray.map((mark: any) => ({
      Name: mark.Name || '',
      Type: mark.Type || '',
      Start: mark.Start || '',
      Num: mark.Num || '',
      Red: mark.Red,
      Green: mark.Green,
      Blue: mark.Blue,
    }));
  }

  private parsePlaylists(playlists: any): Playlist[] {
    if (!playlists || !playlists.NODE) {
      return [];
    }

    const rootNode = playlists.NODE;
    return this.parsePlaylistNode(rootNode);
  }

  private parsePlaylistNode(node: any): Playlist[] {
    if (!node) {
      return [];
    }

    const nodes = Array.isArray(node) ? node : [node];
    const result: Playlist[] = [];

    for (const n of nodes) {
      const playlist: Playlist = {
        Name: n.Name || '',
        Type: n.Type || '',
        KeyType: n.KeyType || '',
        Entries: [],
        Children: [],
      };

      // Parse tracks in playlist
      if (n.TRACK) {
        const tracks = Array.isArray(n.TRACK) ? n.TRACK : [n.TRACK];
        playlist.Entries = tracks.map((t: any) => t.Key);
      }

      // Parse child playlists
      if (n.NODE) {
        playlist.Children = this.parsePlaylistNode(n.NODE);
      }

      result.push(playlist);
    }

    return result;
  }

  exportToXML(library: RekordboxLibrary): string {
    const xmlObject = {
      '?xml': {
        version: '1.0',
        encoding: 'UTF-8',
      },
      DJ_PLAYLISTS: {
        Version: '1.0.0',
        PRODUCT: {
          Name: 'Bonk',
          Version: '1.0.0',
          Company: 'Bonk',
        },
        COLLECTION: {
          Entries: library.tracks.length.toString(),
          TRACK: library.tracks.map((track) => {
            const trackObj: any = {
              TrackID: track.TrackID,
              Name: track.Name,
              Artist: track.Artist,
            };

            // Add optional fields if they exist
            if (track.Album) trackObj.Album = track.Album;
            if (track.Genre) trackObj.Genre = track.Genre;
            if (track.Kind) trackObj.Kind = track.Kind;
            if (track.Size) trackObj.Size = track.Size;
            if (track.TotalTime) trackObj.TotalTime = track.TotalTime;
            if (track.Year) trackObj.Year = track.Year;
            if (track.AverageBpm) trackObj.AverageBpm = track.AverageBpm;
            if (track.DateAdded) trackObj.DateAdded = track.DateAdded;
            if (track.BitRate) trackObj.BitRate = track.BitRate;
            if (track.SampleRate) trackObj.SampleRate = track.SampleRate;
            if (track.Comments) trackObj.Comments = track.Comments;
            if (track.PlayCount) trackObj.PlayCount = track.PlayCount;
            if (track.Rating) trackObj.Rating = track.Rating;
            if (track.Location) trackObj.Location = track.Location;
            if (track.Remixer) trackObj.Remixer = track.Remixer;
            if (track.Tonality) trackObj.Tonality = track.Tonality;
            if (track.Label) trackObj.Label = track.Label;
            if (track.Mix) trackObj.Mix = track.Mix;
            if (track.Grouping) trackObj.Grouping = track.Grouping;

            // Add cue points if they exist
            if (track.CuePoints && track.CuePoints.length > 0) {
              trackObj.POSITION_MARK = track.CuePoints.map((cue) => ({
                Name: cue.Name,
                Type: cue.Type,
                Start: cue.Start,
                Num: cue.Num,
                Red: cue.Red,
                Green: cue.Green,
                Blue: cue.Blue,
              }));
            }

            return trackObj;
          }),
        },
      },
    };

    return this.builder.build(xmlObject);
  }
}

