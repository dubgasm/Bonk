# Bonk Quick Start Guide

Get started with Bonk in 5 minutes! ⚡

---

## 🎯 **Quick Tips - Modern UX**

Before you start, know these time-savers:

- ✏️ **Double-click any cell to edit** (Title, Artist, Album, etc.)
- ⌨️ **Cmd/Ctrl+A** selects all tracks instantly
- 🛠️ **Toolbar shows all actions** - no hidden menus!
- 📝 **Right-click for quick operations** on single tracks
- ⚡ **All keyboard shortcuts** in [Key Shortcuts.md](./Key%20Shortcuts.md)

---

## Running the Application

### Development Mode
```bash
npm run dev
```

This will:
1. Start the Vite dev server on port 5173
2. Launch the Electron app
3. Open the developer tools automatically

### Production Build
```bash
npm run build
npm run build:electron
```

The built app will be in the `release` folder.

## Testing with Example Data

An example Rekordbox XML file is included: `example-rekordbox.xml`

1. Run the app: `npm run dev`
2. Click "Import XML"
3. Select `example-rekordbox.xml`
4. You'll see 3 sample tracks with metadata

## Exporting from Rekordbox 7

### Method 1: Export Collection
1. Open Rekordbox 7
2. Go to **File > Export Collection in XML format**
3. Choose a location and save
4. Import this file into Bonk

### Method 2: Find Auto-Generated XML
Rekordbox automatically generates XML files in these locations:

**macOS:**
```
~/Library/Pioneer/rekordbox/
```

**Windows:**
```
C:\Users\[YourUsername]\AppData\Roaming\Pioneer\rekordbox\
```

Look for files like `rekordbox.xml` or dated XML files.

## Using Bonk

### Importing
1. Click **"Import XML"** in the header
2. Select your Rekordbox XML file
3. Wait for parsing (large libraries may take a moment)

### Viewing Tracks
- All tracks appear in the main table
- Click column headers to sort (future feature)
- Scroll through your entire library

### Searching
- Use the search bar at the top
- Search by: Title, Artist, Album, Genre, or Key
- Results update in real-time
- Track count shows filtered/total tracks

### Editing Metadata
1. **Click any track** in the table
2. Editor panel appears on the right
3. Edit any field:
   - Basic: Title, Artist, Album
   - Details: Genre, BPM, Key, Year
   - Advanced: Remixer, Label, Mix, Grouping, Comments, Rating
4. Click **"Save Changes"** when done
5. Changes are saved to the in-memory library

### Exporting
1. Click **"Export XML"** in the header
2. Choose save location
3. File is exported with all your changes
4. Import this file back into Rekordbox

## Features

✅ **Implemented:**
- Import Rekordbox XML
- View tracks in table
- Search/filter tracks
- Edit metadata fields
- Export modified XML
- Cue points preserved (not editable in UI)
- Dark theme UI

🚧 **Future Enhancements:**
- Sort by columns
- Batch edit multiple tracks
- Playlist management UI
- Waveform display
- Hot cue editing
- Undo/redo
- Drag & drop import

## Tips

1. **Large Libraries**: For libraries with 10,000+ tracks, initial load may take a few seconds
2. **Backup**: Always backup your original XML before making changes
3. **Testing**: Use `example-rekordbox.xml` to test features safely
4. **Rekordbox Import**: After exporting, import back into Rekordbox via File > Import > Import Collection

## Troubleshooting

### "No library loaded" error
- Make sure you selected a valid XML file
- Check that the file is a Rekordbox XML export

### Changes not appearing in Rekordbox
- Make sure you exported the XML after editing
- In Rekordbox, use File > Import > Import Collection
- Select your exported XML file

### App won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Dev server port 5173 in use
- Close other Vite/dev servers
- Or change port in `vite.config.ts`

## Keyboard Shortcuts (Future)

Currently not implemented, but planned:
- `Cmd/Ctrl + O` - Import
- `Cmd/Ctrl + S` - Export
- `Cmd/Ctrl + F` - Focus search
- `Escape` - Close editor panel
- `Arrow Keys` - Navigate tracks

## Need Help?

Check out:
- README.md for detailed documentation
- GitHub Issues for known bugs
- Rekordbox manual for XML format details

