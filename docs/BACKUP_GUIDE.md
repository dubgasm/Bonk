# Backup Guide for Bonk

This guide explains how to backup your Bonk application, including your code, settings, and Rekordbox database.

## What to Backup

### 1. **Application Code** (Your Project)
The entire Bonk application codebase should be backed up, especially if you've made customizations.

### 2. **Rekordbox Database**
Your Rekordbox library database (`master.db` or `datafile.edb`) - this is critical!

### 3. **Application Settings**
Bonk stores some settings in browser localStorage (genres, tag categories).

### 4. **Rekordbox Database Backups**
Bonk automatically creates backups in a `bonk_backups` folder.

---

## Backup Methods

### Method 1: Using Git (Recommended for Code)

If you're using version control:

```bash
# Commit your current changes
git add .
git commit -m "Backup before changes"

# Push to remote repository
git push origin main
```

This backs up your entire codebase to a remote repository.

---

### Method 2: Manual Code Backup

Create a compressed archive of your project:

**macOS/Linux:**
```bash
cd /Users/suhaas/Documents/Developer/Claude\ Code/
tar -czf "Bonk_backup_$(date +%Y%m%d_%H%M%S).tar.gz" "Bonk v1"
```

**Windows (PowerShell):**
```powershell
Compress-Archive -Path "C:\path\to\Bonk v1" -DestinationPath "Bonk_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
```

---

### Method 3: Rekordbox Database Backup (Built-in)

Bonk has a built-in backup feature for your Rekordbox database:

#### Using the UI:
1. Open Bonk
2. Click the **"Rekordbox DB"** button in the header (purple gradient button)
3. Click **"Backup Database"** button
4. The backup will be created in: `~/Library/Pioneer/rekordbox/bonk_backups/` (macOS) or `%APPDATA%\Pioneer\rekordbox\bonk_backups\` (Windows)

#### Using Command Line:
```bash
python3 rekordbox_bridge.py backup-database
```

Or with a specific database path:
```bash
python3 rekordbox_bridge.py backup-database "/path/to/master.db"
```

**Note:** Bonk automatically keeps the last 3 backups and deletes older ones.

---

### Method 4: Manual Rekordbox Database Backup

**macOS:**
```bash
# Find your database
DB_PATH="$HOME/Library/Pioneer/rekordbox/master.db"
# Or for Rekordbox 6:
# DB_PATH="$HOME/Library/Pioneer/rekordbox/datafile.edb"

# Create backup directory
mkdir -p "$HOME/Desktop/Bonk_Backups/$(date +%Y%m%d)"

# Copy database
cp "$DB_PATH" "$HOME/Desktop/Bonk_Backups/$(date +%Y%m%d)/master.db.backup"
```

**Windows (PowerShell):**
```powershell
$dbPath = "$env:APPDATA\Pioneer\rekordbox\master.db"
$backupDir = "$env:USERPROFILE\Desktop\Bonk_Backups\$(Get-Date -Format 'yyyyMMdd')"
New-Item -ItemType Directory -Force -Path $backupDir
Copy-Item $dbPath "$backupDir\master.db.backup"
```

---

### Method 5: Using Rekordbox's Built-in Backup

**Always recommended before making changes:**

1. Open Rekordbox
2. Go to **File → Library → Backup Library**
3. Choose a location to save the backup
4. This creates a complete backup of your Rekordbox library

---

### Method 6: Application Settings Backup

Bonk stores genres and tag categories in browser localStorage. To backup:

1. Open Bonk
2. Open Developer Tools (Cmd+Option+I on macOS, Ctrl+Shift+I on Windows/Linux)
3. Go to **Application** tab → **Local Storage**
4. Look for entries starting with `bonk_`:
   - `bonk_genres`
   - `bonk_tagCategories`
5. Copy the values (they're JSON strings)

Or use this in the browser console:
```javascript
// Export settings
const settings = {
  genres: localStorage.getItem('bonk_genres'),
  tagCategories: localStorage.getItem('bonk_tagCategories')
};
console.log(JSON.stringify(settings, null, 2));
// Copy the output and save to a file
```

To restore:
```javascript
// Restore settings
localStorage.setItem('bonk_genres', '...'); // paste your saved value
localStorage.setItem('bonk_tagCategories', '...'); // paste your saved value
// Then reload the app
```

---

## Complete Backup Checklist

Before making major changes, backup:

- [ ] **Application code** (git commit/push or manual archive)
- [ ] **Rekordbox database** (use Bonk's backup feature or manual copy)
- [ ] **Rekordbox library** (File → Library → Backup Library in Rekordbox)
- [ ] **Application settings** (localStorage export)
- [ ] **Any custom XML exports** you've created

---

## Backup Locations

### macOS
- **Rekordbox Database**: `~/Library/Pioneer/rekordbox/master.db` or `datafile.edb`
- **Bonk Backups**: `~/Library/Pioneer/rekordbox/bonk_backups/`
- **Application Code**: `/Users/suhaas/Documents/Developer/Claude Code/Bonk v1/`

### Windows
- **Rekordbox Database**: `%APPDATA%\Pioneer\rekordbox\master.db` or `datafile.edb`
- **Bonk Backups**: `%APPDATA%\Pioneer\rekordbox\bonk_backups\`
- **Application Code**: Your project directory

---

## Quick Backup Script

Here's a quick script to backup everything at once:

**macOS/Linux (`backup_bonk.sh`):**
```bash
#!/bin/bash
BACKUP_DIR="$HOME/Desktop/Bonk_Complete_Backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup code
echo "Backing up application code..."
cp -r "/Users/suhaas/Documents/Developer/Claude Code/Bonk v1" "$BACKUP_DIR/code"

# Backup Rekordbox database
echo "Backing up Rekordbox database..."
DB_PATH="$HOME/Library/Pioneer/rekordbox/master.db"
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/master.db"
fi

# Backup bonk_backups folder
echo "Backing up Bonk backups..."
if [ -d "$HOME/Library/Pioneer/rekordbox/bonk_backups" ]; then
    cp -r "$HOME/Library/Pioneer/rekordbox/bonk_backups" "$BACKUP_DIR/bonk_backups"
fi

echo "Backup complete: $BACKUP_DIR"
```

**Windows (`backup_bonk.ps1`):**
```powershell
$backupDir = "$env:USERPROFILE\Desktop\Bonk_Complete_Backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $backupDir

# Backup code
Write-Host "Backing up application code..."
Copy-Item -Path "C:\path\to\Bonk v1" -Destination "$backupDir\code" -Recurse

# Backup Rekordbox database
Write-Host "Backing up Rekordbox database..."
$dbPath = "$env:APPDATA\Pioneer\rekordbox\master.db"
if (Test-Path $dbPath) {
    Copy-Item $dbPath "$backupDir\master.db"
}

# Backup bonk_backups folder
Write-Host "Backing up Bonk backups..."
$bonkBackups = "$env:APPDATA\Pioneer\rekordbox\bonk_backups"
if (Test-Path $bonkBackups) {
    Copy-Item -Path $bonkBackups -Destination "$backupDir\bonk_backups" -Recurse
}

Write-Host "Backup complete: $backupDir"
```

---

## Restoring from Backup

### Restore Rekordbox Database:
1. Close Rekordbox
2. Copy your backup file over the current database:
   ```bash
   # macOS
   cp ~/Desktop/backup/master.db ~/Library/Pioneer/rekordbox/master.db
   
   # Windows
   Copy-Item "C:\path\to\backup\master.db" "$env:APPDATA\Pioneer\rekordbox\master.db"
   ```
3. Open Rekordbox

### Restore Application Code:
Simply restore from your git repository or extract your backup archive.

---

## Best Practices

1. **Always backup before syncing** with Rekordbox database
2. **Use version control** (git) for your code
3. **Keep multiple backup points** - don't rely on a single backup
4. **Test your backups** - make sure you can restore from them
5. **Automate backups** - set up regular automated backups
6. **Store backups off-site** - use cloud storage or external drives

---

## Troubleshooting

### Can't find Rekordbox database?
- Check the paths listed in the "Backup Locations" section above
- Use Bonk's auto-detection: Open Rekordbox DB Manager and it will show the detected path

### Backup failed?
- Make sure Rekordbox is closed
- Check file permissions
- Ensure you have enough disk space

### Need to restore from Bonk's automatic backups?
Bonk keeps backups in: `~/Library/Pioneer/rekordbox/bonk_backups/` (macOS) or `%APPDATA%\Pioneer\rekordbox\bonk_backups\` (Windows)

The most recent backup will have the latest timestamp in its filename.

