# 🎨 Bonk UX Guide - Modern Workflow

Bonk is designed for **speed and efficiency**. This guide covers all the modern UX features that make editing metadata fast and intuitive.

---

## ✏️ **Inline Editing**

### **Edit Any Field Instantly**

No more opening dialogs or panels! Edit track metadata directly in the table.

### **How to Use:**
1. **Double-click** any editable cell
2. Type your changes
3. Press **Enter** to save OR click away to auto-save
4. Press **Escape** to cancel

### **Editable Fields:**
- ✅ Title
- ✅ Artist
- ✅ Album
- ✅ Genre
- ✅ BPM
- ✅ Key
- ✅ Year

### **Example Workflow:**
```
1. Double-click "Unknown Artist"
2. Type "Babe Roots"
3. Press Enter
4. Done! (2 seconds total)
```

### **Visual Feedback:**
- **Green border** appears when editing
- **Cursor** changes to text cursor on hover
- **Auto-focus** when you start editing

---

## ⌨️ **Keyboard Shortcuts**

Control everything without touching your mouse!

### **Selection**
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + A` | Select all tracks |
| `Escape` | Clear selection |
| `Cmd/Ctrl + Click` | Multi-select individual tracks |
| `Shift + Click` | Range select (future) |

### **Actions**
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Detect musical keys |
| `Cmd/Ctrl + F` | Find tags & album art |
| `Cmd/Ctrl + W` | Write tags to files |
| `Cmd/Ctrl + Z` | Discard changes (reload from file) |

### **Editing**
| Shortcut | Action |
|----------|--------|
| `Double-Click` | Start inline edit |
| `Enter` | Save inline edit |
| `Escape` | Cancel inline edit / Close modals |

### **Pro Tips:**
- **Cmd+A** → Select everything
- **Cmd+K** → Detect all keys
- **Cmd+W** → Save to files
- All in 3 keystrokes! ⚡

---

## 🛠️ **Quick Action Toolbar**

All common actions are **always visible** at the top of the track table.

### **Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  5 selected  │  [Detect Keys] [Find Tags] [Write Tags]      │
│              │  [Discard] │ [Select All / Clear]             │
└──────────────────────────────────────────────────────────────┘
```

### **Features:**

#### **1. Selection Counter**
Shows how many tracks are selected:
- `"5 selected"` - Active selection
- `"1,234 tracks"` - Total tracks when nothing selected

#### **2. Action Buttons**
- **Detect Keys** - Run KeyFinder on selected tracks
- **Find Tags** - Search MusicBrainz/Spotify for metadata
- **Write Tags** - Save metadata to audio files
- **Discard** - Reload original metadata from files

#### **3. Smart Toggle**
- **Select All** - When nothing selected
- **Clear** - When tracks are selected

#### **4. Button States**
- **Enabled** - Green, clickable
- **Disabled** - Gray, when no selection
- **Hover** - Shows keyboard shortcut tooltip

### **Why It's Better:**
- ❌ **Before**: Had to right-click to find actions
- ✅ **After**: Everything visible and one-click away

---

## 🎯 **Smart Selection System**

Two ways to select tracks, depending on your workflow:

### **Single Track Operations**
**Just right-click!** No checkbox needed.

```
Right-click track → Select action → Done!
```

Perfect for:
- Quick edits
- Single key detection
- Testing features

### **Batch Operations**
**Use checkboxes** for multiple tracks.

```
☑ Track 1
☑ Track 2
☑ Track 3
Right-click → Detect Keys → All processed!
```

Perfect for:
- Bulk key detection
- Mass tag updates
- Large library operations

### **Visual Indicators:**
- **Light green** - Track selected (checkbox)
- **Dark gray** - Track clicked (single selection)
- **Checkbox** - Shows batch selection state

---

## 🔄 **Discard Changes (Undo)**

Made a mistake? Reload original metadata from files.

### **How It Works:**
1. Select tracks you want to restore
2. Click **"Discard"** or press `Cmd+Z`
3. Confirm the action
4. Original metadata reloaded from audio files

### **What Gets Restored:**
- ✅ All metadata tags
- ✅ Album art
- ✅ Technical info (BPM, duration, etc.)

### **Use Cases:**
- Undo bad "Find Tags" results
- Fix manual editing mistakes
- Refresh after external file edits
- Bulk reset multiple tracks

### **Safety:**
- Shows confirmation dialog
- Only affects in-memory data
- Original files untouched

---

## 💡 **Workflow Examples**

### **Fast Single Track Edit:**
```
1. Double-click artist name
2. Type "New Artist"
3. Press Enter
Total: 3 seconds ⚡
```

### **Batch Key Detection:**
```
1. Cmd+A (select all)
2. Cmd+K (detect keys)
3. Wait for analysis
Total: 2 keystrokes + wait time
```

### **Quick Tag Finding:**
```
1. Select 10 tracks with checkboxes
2. Cmd+F (find tags modal)
3. Click "Start"
4. Review results
```

### **Efficient Editing Session:**
```
1. Import folder
2. Cmd+A (select all)
3. Cmd+K (detect keys) - while brewing coffee ☕
4. Double-click to fix any errors
5. Cmd+F (find missing tags)
6. Cmd+W (write to files)
7. Export to Rekordbox XML
Done! Professional workflow in minutes.
```

---

## 🎨 **Visual Design**

### **Color Coding:**
- **Green** (#1db954) - Primary actions, active states
- **Gray** (#b3b3b3) - Secondary text, disabled states
- **Dark** (#1a1a1a) - Background, professional look
- **Accent hover** (#1ed760) - Interactive elements

### **Typography:**
- **System fonts** - Native look and feel
- **13px** - Toolbar and buttons
- **14px** - Table data
- **12px** - Headers and labels

### **Spacing:**
- **Toolbar**: 12px padding
- **Table cells**: 12px × 16px padding
- **Buttons**: 8px gap between items
- **Consistent** spacing throughout

---

## ⚡ **Performance Tips**

### **For Large Libraries (10,000+ tracks):**

1. **Use Search** - Filter before selecting all
2. **Batch Wisely** - Process 1000 tracks at a time
3. **Key Detection** - Runs sequentially (be patient)
4. **Inline Edit** - Instant, no performance hit

### **For Slow Computers:**

1. **Disable Spotify** - If you don't need it
2. **Close Other Apps** - Give Bonk more memory
3. **One Operation at a Time** - Don't stack operations

---

## 🐛 **Troubleshooting**

### **Keyboard Shortcuts Not Working?**
- Make sure the Bonk window has focus
- Check if another app is capturing the shortcut
- Restart the app

### **Inline Editing Not Saving?**
- Press Enter or click away to save
- Check if track is locked (future feature)
- Try right-clicking and using "Discard Changes"

### **Toolbar Buttons Disabled?**
- Select at least one track
- Check if library is loaded
- Verify tracks have file paths

---

## 📚 **Related Documentation**

- **[Key Shortcuts.md](./Key%20Shortcuts.md)** - Complete shortcuts list
- **[KEY_DETECTION.md](./KEY_DETECTION.md)** - KeyFinder details
- **[FIND_TAGS_ALBUM_ART.md](./FIND_TAGS_ALBUM_ART.md)** - Metadata search
- **[SYNC_FEATURES.md](./SYNC_FEATURES.md)** - Tag writing guide

---

**Built for speed. Designed for DJs. Made with ❤️**

