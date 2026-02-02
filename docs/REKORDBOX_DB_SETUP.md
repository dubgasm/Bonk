# Rekordbox Database Integration Setup

This guide will help you set up Bonk's Rekordbox 6/7 database import/export features.

## Prerequisites

### 1. Python 3.8 or higher

Check your Python version:
```bash
python3 --version
```

### 2. Install Python Dependencies

Bonk uses `pyrekordbox` to interact with Rekordbox databases. Install the required dependencies:

```bash
pip3 install -r requirements.txt
```

Or install pyrekordbox directly:
```bash
pip3 install pyrekordbox
```

### 3. SQLCipher (Required for Rekordbox 6/7)

**About Database Encryption:**
Rekordbox 6 and 7 use SQLite databases encrypted with SQLCipher. Pioneer implemented this to discourage third-party modifications. However, since the encryption key must be stored locally for Rekordbox to function, pyrekordbox can automatically locate and use it. The key is the same across all installations (not machine or license dependent), which is how pyrekordbox provides universal database access.

The `pyrekordbox` package will attempt to install `sqlcipher3` automatically, but if it fails:

**On macOS (with Homebrew):**
```bash
brew install sqlcipher
pip3 install sqlcipher3
```

**On Windows:**
Download prebuilt wheels from: https://github.com/coleifer/sqlcipher3

**On Linux:**
```bash
sudo apt-get install libsqlcipher-dev
pip3 install sqlcipher3
```

## Testing the Setup

Test if pyrekordbox is correctly installed:

```bash
python3 rekordbox_bridge.py get-config
```

You should see JSON output with your Rekordbox configuration, or an error message if Rekordbox isn't detected.

## Usage

### 1. Import from Rekordbox Database

1. Click the **"Rekordbox DB"** button in the header
2. The app will auto-detect your Rekordbox installation
3. Click **"Import from Database"** to load your entire library
4. Your tracks and playlists will be imported into Bonk

### 2. Export to Rekordbox Database

1. Make changes to your tracks in Bonk
2. Open the Rekordbox DB Manager
3. Select a sync mode:
   - **Merge**: Add new tracks and update existing ones
   - **Update Only**: Only update existing tracks, skip new ones
   - **Overwrite**: Replace all data (use with caution!)
4. Click **"Export to Database"**

## Configuration

### Auto-Detection

Bonk automatically detects Rekordbox installations in standard locations:
- **macOS**: `~/Library/Pioneer/rekordbox/`, `/Applications/Pioneer/rekordbox 6/`
- **Windows**: `%APPDATA%\Pioneer\rekordbox`, `C:\Program Files\Pioneer\rekordbox 6`

### Manual Configuration

If auto-detection fails:

1. Open Rekordbox DB Manager
2. Click **"Show"** in the Configuration section
3. Enter paths manually:
   - **Pioneer Install Directory**: Where Rekordbox is installed
   - **Pioneer App Directory**: Where Rekordbox stores data
4. Click **"Update Configuration"**

### Custom Database Path

To use a specific database file:
1. Click **"Browse..."** in the Database Location section
2. Navigate to your `master.db` file
3. Or enter the path manually

## File Locations

### macOS
- Database: `~/Library/Pioneer/rekordbox/datafile.edb` or `~/Library/Pioneer/rekordbox/master.db`
- App Data: `~/Library/Pioneer/`

### Windows
- Database: `%APPDATA%\Pioneer\rekordbox\datafile.edb` or `%APPDATA%\Pioneer\rekordbox\master.db`
- App Data: `%APPDATA%\Pioneer\`

## Important Notes

### ⚠️ Safety First

**ALWAYS backup your Rekordbox library before importing or exporting!**

In Rekordbox: `File → Library → Backup Library`

### Supported Operations

- ✅ Import tracks and metadata
- ✅ Import playlists and playlist folders
- ✅ Update existing tracks
- ✅ Merge new tracks and update existing ones on export
- ⚠️ Adding new tracks (limited - use with caution)
- ❌ Deleting tracks (not supported for safety)

### Limitations

1. **Analysis Data**: Waveforms, beatgrids, and cue points are read-only
2. **Complex Relationships**: Some fields (artists, albums, genres) may not update properly if they reference other database tables
3. **Rekordbox Must Be Closed**: Close Rekordbox before exporting to avoid database locks

### Tested Rekordbox Versions

- Rekordbox 5.8.6
- Rekordbox 6.7.7
- Rekordbox 7.0.9

## Troubleshooting

### "Failed to import pyrekordbox"

1. Ensure Python 3.8+ is installed
2. Install dependencies: `pip3 install -r requirements.txt`
3. Check that `pyrekordbox-0.4.4/` folder exists

### "Failed to open database"

1. Make sure Rekordbox is closed
2. Check that the database path is correct
3. Verify you have read/write permissions
4. Ensure SQLCipher is installed for Rekordbox 6/7

### "No Rekordbox installation detected"

1. Use the "Manual Configuration" section
2. Or specify a custom database path

### Database is locked

- Close Rekordbox completely
- Check for any background Rekordbox processes
- Restart your computer if the issue persists

## Advanced Usage

### Command-Line Interface

The Python bridge can be used directly from the command line:

```bash
# Get configuration
python3 rekordbox_bridge.py get-config

# Import database
python3 rekordbox_bridge.py import-database

# Import from specific database
python3 rekordbox_bridge.py import-database "/path/to/master.db"
```

## Support

For issues with:
- **Bonk**: Check the main README or open an issue
- **pyrekordbox**: Visit https://github.com/dylanljones/pyrekordbox
- **Rekordbox**: Contact Pioneer support

## Legal Disclaimer

This feature is not affiliated with Pioneer Corp. Use at your own risk. Always backup your data before making changes.

