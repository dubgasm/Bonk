#!/bin/bash
# Safe Database Export Script

echo "🔍 Checking if Rekordbox is running..."
if ps aux | grep -i rekordbox | grep -v grep > /dev/null; then
    echo "❌ ERROR: Rekordbox is RUNNING!"
    echo "   Close Rekordbox first, then run this script again."
    exit 1
fi

echo "✅ Safe to export - Rekordbox is not running"
echo ""
echo "Now in Bonk:"
echo "1. Click Database icon"
echo "2. Click 'Export to Database'"
echo "3. Choose 'Merge' mode (NOT overwrite)"
echo "4. Click Export"
echo ""
echo "If you see ANY errors, STOP and tell me!"
