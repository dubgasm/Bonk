# Quick Tag — Implementation & Roadmap

## Current features (implemented)

- **Layout:** Left folder tree, center track table, bottom player, right panel (reserved).
- **Folder:** Choose folder, go up, recursive tree, double-click into folders, search.
- **Track table:** Album art, Title, Artist, Album, Genre, **Rating** (editable ★), Key.
- **Player:** Play/pause, waveform, click/drag seek, time, volume, change path.
- **Keyboard:** Space play/pause, Left/Right seek ±10s/+30s, Up/Down change track, Shift+S save.
- **Save:** Only **POPM rating** is written to file via `audioTagsSetRatingByte` (TagLib, ID3v2.3, `bonk@suh`).
- **Rating:** Read from file on scan/reload via `readBonkPopmRatingByte` (music-metadata).

---

## Possible next features (not yet implemented)

Pick what to prioritize; implementation can be phased.

### 1. Use the right panel

- **Selected track details:** Show full metadata for the selected row (title, artist, album, genre, key, BPM, comments, etc.).
- **Editable fields:** Let user edit a few key fields in the right panel (e.g. Genre, Key, Comments) and save to file.

### 2. Editable tags beyond rating

- **Inline or right-panel edit** for: Genre, Key, Comments (COMM).
- **Save to file:** Either reuse existing `write-tags` (FFmpeg) for a single track for these fields, or add a small TagLib-based “quick tag write” that only updates title/artist/album/genre/key/comment and does **not** touch rating or album art (rating stays `audioTagsSetRatingByte` only).

### 3. Key detection in Quick Tag

- **Button:** “Detect key” for selected track.
- **Flow:** Call existing `detect-key` IPC, show result, optionally “Write key to file” (via write-tags or quick-tag write).

### 4. Comments / notes (COMM)

- **Display:** Show Comments in table or right panel (already in `Track.Comments` from scan).
- **Edit:** Text field in right panel, save as ID3 COMM (or equivalent) so Rekordbox/Traktor can read it.

### 5. Reload from file

- **Button:** “Reload metadata” for selected track.
- **Flow:** Call existing `reload-track` IPC, replace current track in list with fresh metadata (including rating and comments).

### 6. Batch rating (optional)

- **Multi-select** tracks in table, set one rating, save all (multiple `audioTagsSetRatingByte` calls).
- Lower priority; single-track rating is the main use case.

### 7. Tag mapping / DJ compatibility (later)

- As in “Notes for later”: Traktor/Rekordbox-friendly COMM, TCON (genre), POPM (already done).
- Keep writing rating only via QuickTag’s POPM path; other tag writes via write-tags or a dedicated quick-tag writer.

---

## Technical notes

- **Rating:** Must stay **only** via `audioTagsSetRatingByte` (TagLib, POPM, `bonk@suh`). Do not use FFmpeg for rating.
- **Other tags:** Can use existing `write-tags` (FFmpeg) for one track, or a new TagLib-based “quick tag” writer for title/artist/album/genre/key/comment so we don’t touch rating or art.
- **Album art:** Quick Tag does not remove album art; it only modifies POPM frames.

---

## Suggested first phase

1. **Right panel:** Selected track details + editable **Genre**, **Key**, **Comments**.
2. **Save:** One “Save” (or Shift+S) that:
   - Writes rating via `audioTagsSetRatingByte` if rating was changed.
   - Writes genre/key/comments (and optionally title/artist/album) via a single-track write (e.g. `write-tags` for one track, or new IPC).
3. **Reload:** “Reload from file” button for selected track.

If you say which of these you want first (e.g. “right panel + genre/key/comments + save”), we can implement that next.
