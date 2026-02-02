#!/usr/bin/env python3
"""Fix the corrupted duplicate playlist entries"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database
from pyrekordbox.utils import get_rekordbox_pid

# The corrupted duplicate IDs (all are the same track in the same playlist)
corrupted_ids = [
    '429fb816-f40b-4e08-b33f-8100bb0f6c9e',
    '9520eaab-6ad4-463d-bf1e-afe368915c2d',
    '95411043-4554-4374-8436-8782d157ee23',
    'c17580c3-612b-468e-843e-be46c87b48f2',
    'e06ecc1e-07f1-478b-a649-2c698ac8948a'
]

try:
    # Check if Rekordbox is running
    pid = get_rekordbox_pid()
    if pid:
        print("❌ ERROR: Rekordbox is running! Close it first.")
        print(f"   Run: killall -9 rekordbox")
        sys.exit(1)
    
    print("Opening Rekordbox database...")
    db = Rekordbox6Database()
    
    print(f"\n🔧 Fixing corrupted duplicate entries...\n")
    print("=" * 80)
    
    from pyrekordbox.db6.tables import DjmdSongPlaylist
    
    # Create backup first
    import shutil
    from datetime import datetime
    backup_path = os.path.expanduser(f"~/Library/Pioneer/rekordbox/master.db.before_fix_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    db_path = os.path.expanduser("~/Library/Pioneer/rekordbox/master.db")
    print(f"📦 Creating backup: {backup_path}")
    shutil.copy2(db_path, backup_path)
    print(f"   ✓ Backup created\n")
    
    deleted_count = 0
    kept_first = False
    
    for idx, entry_id in enumerate(corrupted_ids):
        try:
            entry = db.query(DjmdSongPlaylist).filter(DjmdSongPlaylist.ID == entry_id).first()
            
            if entry:
                if not kept_first:
                    # Keep the first entry, delete the rest
                    print(f"✓ Keeping first entry: {entry_id}")
                    print(f"   Track: Tell Me (masterplan Remix)")
                    print(f"   Playlist: New Music (Bruk)\n")
                    kept_first = True
                else:
                    # Delete duplicate
                    print(f"🗑️  Deleting duplicate #{idx}: {entry_id}")
                    db.session.delete(entry)
                    deleted_count += 1
            else:
                print(f"⚠️  Entry not found: {entry_id}")
                
        except Exception as e:
            print(f"❌ Error processing {entry_id}: {e}")
    
    if deleted_count > 0:
        print(f"\n{'=' * 80}")
        print(f"Committing changes ({deleted_count} duplicates removed)...")
        try:
            db.commit()
            print("✅ SUCCESS! Corruption fixed!")
            print(f"\n   Removed {deleted_count} duplicate entries")
            print(f"   Kept 1 valid entry")
            print(f"\n   Your database should now work properly!")
            print(f"\n   Backup saved at: {backup_path}")
        except Exception as commit_error:
            print(f"❌ Commit failed: {commit_error}")
            print(f"\n   Attempting rollback...")
            try:
                db.rollback()
                print("   ✓ Rolled back")
            except:
                pass
    else:
        print("\nNo changes needed.")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
