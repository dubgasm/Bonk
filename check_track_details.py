#!/usr/bin/env python3
"""Compare track counts and find differences"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database

try:
    print("Opening Rekordbox database...")
    db = Rekordbox6Database()
    
    print("\n" + "=" * 80)
    print("TRACK COUNT ANALYSIS")
    print("=" * 80 + "\n")
    
    # Get all tracks
    all_tracks = db.get_content().all()
    total_tracks = len(all_tracks)
    
    print(f"Total tracks in database: {total_tracks}")
    print()
    
    # Categorize tracks
    missing_tracks = []
    sampler_tracks = []
    regular_tracks = []
    
    for track in all_tracks:
        path = track.FolderPath or ""
        
        # Check if missing (file doesn't exist)
        if path:
            if not os.path.exists(path):
                missing_tracks.append(track)
            # Check if it's a sampler file
            elif "/rekordbox/Sampler/" in path or "/Sampler/" in path:
                sampler_tracks.append(track)
            else:
                regular_tracks.append(track)
        else:
            missing_tracks.append(track)
    
    print("Breakdown:")
    print(f"  Regular tracks: {len(regular_tracks)}")
    print(f"  Sampler files: {len(sampler_tracks)}")
    print(f"  Missing files: {len(missing_tracks)}")
    print(f"  Total: {len(regular_tracks) + len(sampler_tracks) + len(missing_tracks)}")
    print()
    
    print("=" * 80)
    print("Rekordbox shows: 2614 tracks")
    print(f"Bonk imports: {total_tracks} tracks")
    print(f"Difference: {total_tracks - 2614} tracks")
    print()
    
    if len(sampler_tracks) > 0:
        print("💡 Likely explanation:")
        print(f"   Rekordbox might be hiding {len(sampler_tracks)} sampler files from the track count")
        print(f"   Bonk imports ALL tracks including samplers")
        print()
        print(f"   Regular tracks ({len(regular_tracks)}) + Missing ({len(missing_tracks)}) = {len(regular_tracks) + len(missing_tracks)}")
        print(f"   This might match Rekordbox's count of 2614")
    
    db.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
