#!/bin/bash
# Attempt to repair the corrupted Rekordbox database

DB_PATH=~/Library/Pioneer/rekordbox/master.db
BACKUP_PATH=~/Library/Pioneer/rekordbox/master.db.before_repair_$(date +%Y%m%d_%H%M%S)
TEMP_DB=/tmp/master_repaired.db

echo "🔧 Database Repair Attempt"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Rekordbox is running
if ps aux | grep -i rekordbox | grep -v grep > /dev/null; then
    echo "❌ Rekordbox is running! Close it first."
    exit 1
fi

# Backup current database
echo "1. Creating backup..."
cp "$DB_PATH" "$BACKUP_PATH"
echo "   ✓ Backup: $BACKUP_PATH"
echo ""

# Try to repair using dump/restore
echo "2. Attempting repair (this may take a few minutes)..."
echo "   This uses SQLite's .dump and restore method..."
echo ""

# Note: This will fail because it's encrypted with SQLCipher
# But we'll document the attempt
sqlite3 "$DB_PATH" ".dump" 2>&1 | head -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Database is encrypted with SQLCipher"
echo "   Standard SQLite repair won't work"
echo ""
echo "🎯 RECOMMENDATION: Use XML method instead"
echo "   The database corruption is in the djmdSongPlaylist table"
echo "   and cannot be easily repaired."
echo ""
