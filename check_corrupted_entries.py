#!/usr/bin/env python3
"""Check what the corrupted playlist entries are"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database

# The corrupted IDs
corrupted_ids = [
    '429fb816-f40b-4e08-b33f-8100bb0f6c9e',
    '9520eaab-6ad4-463d-bf1e-afe368915c2d',
    '95411043-4554-4374-8436-8782d157ee23',
    'c17580c3-612b-468e-843e-be46c87b48f2',
    'e06ecc1e-07f1-478b-a649-2c698ac8948a'
]

try:
    print("Opening Rekordbox database...")
    db = Rekordbox6Database()
    
    print(f"\nLooking up {len(corrupted_ids)} corrupted playlist entries:\n")
    print("=" * 80)
    
    from pyrekordbox.db6.tables import DjmdSongPlaylist
    
    for entry_id in corrupted_ids:
        try:
            # Try to get the playlist entry
            entry = db.query(DjmdSongPlaylist).filter(DjmdSongPlaylist.ID == entry_id).first()
            
            if entry:
                print(f"\n📀 Playlist Entry: {entry_id}")
                print(f"   Playlist ID: {entry.PlaylistID}")
                print(f"   Track ID: {entry.ContentID}")
                
                # Try to get the track name
                try:
                    track = db.get_content().filter_by(ID=entry.ContentID).first()
                    if track:
                        print(f"   Track: {track.Title} - {track.ArtistName or 'Unknown Artist'}")
                        print(f"   Path: {track.FolderPath}")
                except Exception as e:
                    print(f"   ⚠ Could not get track details: {e}")
                
                # Try to get the playlist name
                try:
                    playlist = db.get_playlist().filter_by(ID=entry.PlaylistID).first()
                    if playlist:
                        print(f"   Playlist: {playlist.Name}")
                except Exception as e:
                    print(f"   ⚠ Could not get playlist details: {e}")
            else:
                print(f"\n❓ Entry {entry_id}: NOT FOUND (might be already deleted or corrupted)")
                
        except Exception as e:
            print(f"\n❌ Entry {entry_id}: ERROR - {e}")
    
    print("\n" + "=" * 80)
    print("\n💡 These are the specific playlist-song links that are corrupted.")
    print("   When trying to delete tracks, Bonk needs to remove these links first.")
    print("   The corruption prevents this deletion operation.")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
