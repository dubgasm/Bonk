#!/usr/bin/env python3
"""Rebuild the corrupted djmdSongPlaylist table"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

from pyrekordbox import Rekordbox6Database
from pyrekordbox.utils import get_rekordbox_pid
from pyrekordbox.db6.tables import DjmdSongPlaylist
import shutil
from datetime import datetime

print("🔧 djmdSongPlaylist Table Rebuilder")
print("=" * 80)

try:
    # Check if Rekordbox is running
    pid = get_rekordbox_pid()
    if pid:
        print("❌ ERROR: Rekordbox is running! Close it first.")
        print(f"   Run: killall -9 rekordbox")
        sys.exit(1)
    
    # Create backup
    db_path = os.path.expanduser("~/Library/Pioneer/rekordbox/master.db")
    backup_path = os.path.expanduser(f"~/Library/Pioneer/rekordbox/master.db.before_rebuild_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    
    print(f"\n📦 Step 1: Creating backup...")
    shutil.copy2(db_path, backup_path)
    print(f"   ✓ Backup: {backup_path}\n")
    
    print("📖 Step 2: Reading existing playlist entries...")
    db = Rekordbox6Database()
    
    # Read all playlist entries we CAN read (skipping corrupted ones)
    good_entries = []
    corrupted_count = 0
    
    try:
        all_entries = db.query(DjmdSongPlaylist).all()
        print(f"   Found {len(all_entries)} playlist entries")
        
        for entry in all_entries:
            try:
                # Try to access the entry's data
                entry_data = {
                    'ID': entry.ID,
                    'PlaylistID': entry.PlaylistID,
                    'ContentID': entry.ContentID,
                    'TrackNo': entry.TrackNo if hasattr(entry, 'TrackNo') else None,
                }
                good_entries.append(entry_data)
            except Exception as e:
                corrupted_count += 1
                print(f"   ⚠️  Skipping corrupted entry: {e}")
        
        print(f"   ✓ Read {len(good_entries)} good entries")
        if corrupted_count > 0:
            print(f"   ⚠️  Skipped {corrupted_count} corrupted entries")
        
    except Exception as e:
        print(f"   ❌ Error reading entries: {e}")
        print(f"\n   The table is too corrupted to read. Trying nuclear option...")
        good_entries = []
    
    print(f"\n🗑️  Step 3: Dropping corrupted table...")
    
    # Use raw SQL to drop and recreate the table
    from sqlalchemy import text
    
    try:
        # Get a connection
        with db.engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                print("   Dropping djmdSongPlaylist table...")
                conn.execute(text("DROP TABLE IF EXISTS djmdSongPlaylist;"))
                
                print("   Creating fresh djmdSongPlaylist table...")
                # Recreate table with proper schema
                create_table_sql = """
                CREATE TABLE djmdSongPlaylist (
                    ID TEXT PRIMARY KEY NOT NULL,
                    PlaylistID TEXT NOT NULL,
                    ContentID TEXT NOT NULL,
                    TrackNo INTEGER,
                    rb_data_status INTEGER DEFAULT 0,
                    rb_local_data_status INTEGER DEFAULT 0,
                    rb_local_deleted INTEGER DEFAULT 0,
                    rb_local_synced INTEGER DEFAULT 0,
                    usn TEXT,
                    rb_local_usn TEXT,
                    created_at TEXT,
                    updated_at TEXT
                );
                """
                conn.execute(text(create_table_sql))
                
                print("   Creating indexes...")
                conn.execute(text("CREATE INDEX idx_songplaylist_playlist ON djmdSongPlaylist(PlaylistID);"))
                conn.execute(text("CREATE INDEX idx_songplaylist_content ON djmdSongPlaylist(ContentID);"))
                
                trans.commit()
                print("   ✓ Table rebuilt successfully!")
                
            except Exception as e:
                trans.rollback()
                raise e
                
    except Exception as e:
        print(f"   ❌ Failed to rebuild table: {e}")
        print(f"\n   This might be due to SQLCipher encryption.")
        print(f"   Trying pyrekordbox method instead...")
        
        # Alternative: use pyrekordbox's internal methods
        try:
            # This might work better with SQLCipher
            DjmdSongPlaylist.__table__.drop(db.engine, checkfirst=True)
            print("   ✓ Dropped old table")
            DjmdSongPlaylist.__table__.create(db.engine, checkfirst=True)
            print("   ✓ Created new table")
        except Exception as e2:
            print(f"   ❌ Also failed: {e2}")
            print(f"\n❌ Cannot rebuild table automatically.")
            print(f"\n💡 RECOMMENDATION: Use XML export method instead.")
            sys.exit(1)
    
    if len(good_entries) > 0:
        print(f"\n📝 Step 4: Restoring {len(good_entries)} good entries...")
        
        restored = 0
        for entry_data in good_entries:
            try:
                new_entry = DjmdSongPlaylist(
                    ID=entry_data['ID'],
                    PlaylistID=entry_data['PlaylistID'],
                    ContentID=entry_data['ContentID'],
                    TrackNo=entry_data.get('TrackNo')
                )
                db.session.add(new_entry)
                restored += 1
                
                if restored % 100 == 0:
                    print(f"   Restored {restored}/{len(good_entries)}...")
                    
            except Exception as e:
                print(f"   ⚠️  Could not restore entry {entry_data['ID']}: {e}")
        
        print(f"\n💾 Step 5: Committing changes...")
        try:
            db.commit()
            print(f"   ✓ Committed {restored} entries")
        except Exception as e:
            print(f"   ❌ Commit failed: {e}")
            db.rollback()
            sys.exit(1)
    
    print("\n" + "=" * 80)
    print("✅ SUCCESS! djmdSongPlaylist table has been rebuilt!")
    print(f"\n   Backup saved at: {backup_path}")
    print(f"\n   Try exporting from Bonk again now.")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
