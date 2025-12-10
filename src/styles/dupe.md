Task: Enumerate, with clear actionable detail, the functionalities that the agent ("Rekordbox Collection Tool" / RCT) must implement or verify, including the specific requirement to automate FLAC-to-AIFF conversion and perform all related Rekordbox library management tasks without using Lexicon.

1. **Audio File Conversion (FLAC→AIFF)**
   - Automatically batch-convert all `.flac` files in a target directory to `.aiff` format using FFmpeg or a system call, ensuring accurate preservation of audio data and metadata.
   - Save new `.aiff` files alongside the originals, with identical base filenames but `.aiff` extension.
   - Validate the success of each conversion and log failures for user review.

2. **Library Relinking and Updating**
   - Detect and identify each newly created `.aiff` file corresponding to an original `.flac` track in the Rekordbox 6 library database.
   - Relink/replace each Rekordbox collection entry referencing a `.flac` file to the corresponding `.aiff` file, ensuring cues, loops, grids, and playlist memberships remain intact.
   - If any track cannot be relinked (e.g., missing target file), notify the user and log the failure.
   - Provide an “auto relocate” mechanism to automatically update all references to the new file path and extension (from .flac to .aiff), especially where Rekordbox’s own relocation fails.

3. **Original File Management**
   - After confirming all `.flac`→`.aiff` relinking is successful, provide an option to safely delete the original `.flac` files or move them to a user-specified archive folder (“pre-bin”).
   - Ensure no deleted file is still referenced in the Rekordbox database.

4. **Duplicate Prevention and Integration**
   - For any new audio files added (including those produced by conversion), employ audio fingerprinting and metadata comparison to prevent creation of duplicate entries in the library.
   - When a higher-quality file (e.g., .aiff) replaces a lower-quality one (e.g., .flac), transfer all metadata and completely remove the older file from both disk and collection.
   - Update all playlist references to use the new file.

5. **Metadata Integrity and Management**
   - Guarantee that all metadata (cues, loops, beatgrids, playlists, comments, rating, etc.) is preserved and, if necessary, migrated between file entries during conversion/displacement.
   - Provide routines to merge, copy, or repair metadata between matching or nearly-identical tracks (e.g., track title misspellings or case mismatches).

6. **Standardization and Cleanup**
   - Offer utilities to:
     - Convert all file names to pure ASCII, removing non-standard or extended MacOS Finder attributes.
     - Detect orphaned tracks (not in any playlist) and offer options for review or deletion.
     - Deeply remove any track (from both the library database and file system, with safe pre-delete bin option).

7. **Playlist and Folder Management**
   - If needed during merge/metadata handling, auto-create or restore special playlists/folders.
   - For merge tasks, process tracks grouped by key metadata (artist, title, track time) and merge all cues, loops, grids, and artwork, following safety rules (e.g., do not overwrite existing cues).
   - Offer user-assisted correction when matching tracks for merging fails (e.g., minor metadata mismatches).

8. **Backup and Restore**
   - Support restoring the Rekordbox 6 library from its automatic backups using an integrated restore utility.
   - Upon failure of any operation (conversion, relink, delete, metadata transfer), provide user notification and clear recovery steps.

9. **User Interaction and Support**
   - Track and process user feedback, provide logs and error notifications, and include a mechanism for support requests or a “buy” link for commercial licensing.
   - Ensure all features are fully compatible with MacOS.

In summary, the agent should be capable of:
- Fully automating the FLAC→AIFF conversion, relinking, and safe deletion workflow for Rekordbox 6 libraries,
- Moving or converting new tracks, preventing duplicates, merging or protecting all metadata,
- Providing all necessary file and database operations without Lexicon,
- And delivering robust error-handling, user notification, and MacOS-specific support throughout the process.








This guide explains how to:
	1.	Convert audio files to a new format using FFmpeg
	2.	Delete the original files safely
	3.	Relink your Rekordbox library using Lexicon
	4.	Sync everything back into Rekordbox

This workflow keeps all cues, loops, grids, and playlists intact.

ffmpeg -i "input.wav" "input.mp3"

for f in *.wav; do ffmpeg -i "$f" "${f%.wav}.mp3"; done

for f in *.wav; do ffmpeg -i "$f" "${f%.wav}.flac"; done

Important:
Run FFmpeg in the same folder as the original files.
The new files must appear next to the old ones for Lexicon to correctly relink them later.

2. Import Your Rekordbox Library Into Lexicon
	1.	Open Lexicon
	2.	Go to Sync
	3.	Click Import tracks & playlists
	4.	Choose Rekordbox
	5.	Import your full library

Your Lexicon library should now match your Rekordbox library.

3. Delete the Original Files

After conversion, remove the old audio files so Lexicon only finds the new ones.

macOS
	1.	Go to your main music folder
	2.	Use Finder search:

kind:wav

	3.	Select all → Delete

If you converted MP3 → FLAC, then search kind:mp3 instead.

4. Relink Tracks in Lexicon
	1.	Open Lexicon
	2.	Top menu → Find Lost Tracks
	3.	Stay on the Missing Tracks tab
	4.	Click the top entry under Old location
	5.	Copy/paste that folder path into the Target location box
	6.	Choose your new extension (e.g., mp3, flac) in the File extension dropdown
	7.	Click Start relocating

Lexicon will:
	•	Scan the selected folder
	•	Identify files with the new extension
	•	Relink all tracks to their new audio format

Verify

Right-click a track → Edit → check file path.

5. Sync Everything Back Into Rekordbox

Once all tracks show as properly relocated in Lexicon:
	1.	Go to Sync
	2.	Select Rekordbox
	3.	Choose Full Sync
	4.	Click the green sync button
	5.	Open Rekordbox — all tracks should be linked and ready to use

