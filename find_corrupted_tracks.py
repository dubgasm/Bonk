#!/usr/bin/env python3
"""Find tracks with corrupted playlist entries"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database
from pyrekordbox.db6.tables import DjmdSongPlaylist

# Known corrupted playlist entry IDs
corrupted_entry_ids = [
    '429fb816-f40b-4e08-b33f-8100bb0f6c9e',
    '9520eaab-6ad4-463d-bf1e-afe368915c2d',
    '95411043-4554-4374-8436-8782d157ee23',
    'c17580c3-612b-468e-843e-be46c87b48f2',
    'e06ecc1e-07f1-478b-a649-2c698ac8948a',
    # New ones from recent error
    '3ffd2fa1-59e4-485c-a43d-89eff75bd2a3',
    '6b0ff365-ebf3-4ece-9a66-016541ab7db2',
    '735aeb3b-9eeb-42f9-a4ad-11b95b7fc61d',
    '7b9551ef-1d64-45f2-b164-064c821be2eb',
    '7bb88310-afc5-4698-b868-a8b4ea7dd572',
    '86b93121-e014-4c3a-9573-e5ea73b58a11',
    '9bc496f9-e8f3-4573-a736-a5f71620ac23',
    'a8b381a8-3654-449b-bfc4-370bdb43ee6f',
    'da901c27-1644-4dfd-8ee9-67b27fce417b',
    'dc12bae1-9da1-4294-8bc4-2731e41f67f0',
]

try:
    print("Opening Rekordbox database...")
    db = Rekordbox6Database()
    
    print("\n" + "=" * 80)
    print("TRACKS WITH CORRUPTED PLAYLIST ENTRIES")
    print("=" * 80 + "\n")
    
    # Get unique track IDs from corrupted entries
    corrupted_tracks = {}
    
    for entry_id in corrupted_entry_ids:
        try:
            entry = db.query(DjmdSongPlaylist).filter(DjmdSongPlaylist.ID == entry_id).first()
            if entry and entry.ContentID:
                if entry.ContentID not in corrupted_tracks:
                    # Get track details
                    track = db.get_content().filter_by(ID=entry.ContentID).first()
                    if track:
                        corrupted_tracks[entry.ContentID] = {
                            'track': track,
                            'entries': []
                        }
                if entry.ContentID in corrupted_tracks:
                    corrupted_tracks[entry.ContentID]['entries'].append(entry_id)
        except Exception as e:
            print(f"Error checking entry {entry_id}: {e}")
    
    if not corrupted_tracks:
        print("✅ No tracks found with the known corrupted entries!")
        print("   The corruption might be in different records.")
    else:
        print(f"Found {len(corrupted_tracks)} tracks with corrupted playlist entries:\n")
        
        for idx, (track_id, data) in enumerate(corrupted_tracks.items(), 1):
            track = data['track']
            entries = data['entries']
            
            print(f"{idx}. 🎵 {track.Title or 'Unknown Title'}")
            print(f"   Artist: {track.ArtistName or 'Unknown'}")
            print(f"   Path: {track.FolderPath}")
            print(f"   Corrupted entries: {len(entries)}")
            print()
        
        print("=" * 80)
        print("\n📋 TO FIX:")
        print("1. Open Rekordbox")
        print("2. Search for each track above by title/artist")
        print("3. Delete these specific tracks in Rekordbox")
        print("4. Or remove them from all playlists")
        print("5. Try Bonk export again")
        print()
        print("⚠️  Note: These tracks might be missing files anyway.")
        print("   Check if they show '!' icon in Rekordbox (missing file)")
    
    db.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
