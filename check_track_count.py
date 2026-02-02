#!/usr/bin/env python3
"""Check actual track count in database"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database

try:
    print("Opening Rekordbox database...")
    db = Rekordbox6Database()
    
    # Count tracks
    track_count = db.get_content().count()
    
    print(f"\n📊 Database Track Count: {track_count}")
    print(f"\n   Expected: ~2110 (after deleting 513 tracks from 2623)")
    print(f"   Rekordbox shows: 2618")
    
    if track_count < 2618:
        print(f"\n✅ SUCCESS! Tracks were deleted from database!")
        print(f"   Database has: {track_count} tracks")
        print(f"   Rekordbox needs to refresh its cache")
        print(f"\n💡 Solution: Restart Rekordbox to see the updated count")
    else:
        print(f"\n❌ PROBLEM: Database still has {track_count} tracks")
        print(f"   The deletions didn't commit to the database")
        print(f"   Need to check what went wrong")
    
    db.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
