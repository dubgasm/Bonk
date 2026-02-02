#!/bin/bash
# Enhanced Rekordbox Safety Check Script
# Ensures Rekordbox is closed and database is accessible

echo "🔍 Rekordbox Safety Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Rekordbox is running (use pgrep to avoid grep matching itself)
if pgrep -i rekordbox > /dev/null 2>&1; then
    echo "❌ FAIL: Rekordbox is RUNNING!"
    echo ""
    echo "Action required:"
    echo "  1. Close Rekordbox completely"
    echo "  2. Wait 5 seconds for it to fully close"
    echo "  3. Run this check again"
    echo ""
    echo "To force close: killall -9 rekordbox"
    exit 1
fi

echo "✅ PASS: Rekordbox is not running"

# Check if database file exists and is accessible
DB_PATH=~/Library/Pioneer/rekordbox/master.db
if [ -f "$DB_PATH" ]; then
    echo "✅ PASS: Database file exists"
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo "   Size: $DB_SIZE"
else
    echo "❌ FAIL: Database file not found at $DB_PATH"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL CHECKS PASSED - Safe to proceed!"
exit 0
