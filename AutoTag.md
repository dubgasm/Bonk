AutoTag.md
---

## 3) Data contracts (Types you MUST standardize)

### 3.1 Providers you listed (IDs)
Use a strict enum-like union:
- `beatport | traxsource | juno | musicbrainz | itunes | deezer | bandcamp | spotify | beatsource | discogs | bpmsupreme | musixmatch`

### 3.2 Tag keys (checkbox list)
Use a strict union for your checklist:
- `albumArt | album | albumArtist | artist | title | version | remixers | genre | style | label | releaseId | trackId | bpm | key | mood | catalogNumber | trackNumber | discNumber | duration | trackTotal | isrc | publishDate | releaseDate | url | otherTags | oneTaggerTags | lyricsUnsynced | lyricsSynced | explicit`

### 3.3 Normalized “CommonMetadata”
Every provider must return the same shape so merging/scoring is possible.

**CommonMetadata (minimum)**
- identity: `artist`, `title`, `album`, `albumArtist`, `version`, `remixers[]`
- classification: `genre[]`, `style[]`, `label`, `mood[]`
- ids: `releaseId`, `trackId`, `catalogNumber`, `isrc`, `url`
- musical: `bpm`, `key` (store canonical, convert to Camelot at write time)
- numbering: `trackNumber`, `discNumber`, `trackTotal`
- dates: `publishDate`, `releaseDate`
- lyrics: `lyricsUnsynced`, `lyricsSynced`
- art: `{ mime, data, sourceUrl }`
- provenance: `sources[] { provider, confidence }`

---

## 4) Zustand store (single source of truth in renderer)

Create `autoTag.store.ts` with these slices:

### 4.1 Wizard state
- `step: 0..4`
- `selectedFiles: string[]` (paths picked in UI OR passed in from main window)
- `providers: { enabled: ProviderId[]; priority: ProviderId[]; auth: Record<ProviderId, AuthState> }`
- `selectedTags: TagKey[]`
- `advanced: AdvancedOptions` (your checkbox list + nested fields)
- `run: { status: idle|running|paused|done|error; progress; events[]; results[] }`

### 4.2 Actions
- `toggleProvider(id)`
- `reorderProviders(newOrder)` (dnd-kit)
- `toggleTag(tagKey)`
- `enableAllTags() / disableAllTags() / toggleAllTags()`
- `setAdvancedOption(key, value)`
- `startRun() / pauseRun() / resumeRun() / cancelRun()`
- `ingestProgressEvent(evt)` (from IPC stream)
- `setResults(results[])`

Renderer should NOT do the tagging logic. It only controls config and displays progress.

---

## 5) UI Implementation (React + Framer + dnd-kit + Sonner)

### 5.1 Main screen
- Add card/button: **Auto Tag**
- On click:
  - `window.api.autotag.openWindow()` (IPC to main to create window)
  - toast: “Auto Tag opened”

### 5.2 AutoTagWizard.tsx (layout)
- Stepper rail (left)
- Content pane (right)
- Bottom nav: Back / Next / Cancel
- Use Framer Motion for step transitions.

### 5.3 Step 1 — Services (dnd-kit)
- Render `ProviderCard` list
- Enable drag reorder (priority)
- Provider cards show badges:
  - `Requires login` (Spotify, Discogs, BPM Supreme)
  - `Rate limited` (iTunes, Discogs)
  - `Lyrics` (Musixmatch)
- If provider requires auth and not authed:
  - show “Sign in” button
  - `window.api.autotag.auth(providerId)` triggers main auth flow

**Validation**
- Must have at least 1 enabled provider that is usable.

### 5.4 Step 2 — Select Tags (checkbox grid)
- Group UI exactly as you wrote.
- Buttons:
  - ENABLE ALL / DISABLE ALL / TOGGLE
- Show subtle warning if lyrics tags selected but no lyrics provider enabled.

### 5.5 Step 3 — Advanced options (checkbox list)
- Render checkboxes in sections.
- When enabling:
  - Save album art to file → show path pattern
  - Move success/failed → show folder pickers + collision strategy
  - Parse from filename → show pattern presets

### 5.6 Step 4 — Run
- Big progress bar + counters:
  - processed / total, success, failed, skipped
- “Now processing” row (filename + provider)
- Buttons: Pause / Resume / Stop
- Expandable event log

### 5.7 Step 5 — Review
- ResultsTable with columns:
  - Status, Confidence, Provider, Matched Track, Updated Tags summary, Failure reason
- Click row → DiffPanel
  - Before vs After (only for selected tags)
- Actions:
  - Re-run failed
  - Export JSON report (save dialog via main process)

### 5.8 Sonner toasts (good UX)
- On start: “Tagging started”
- On pause/resume: “Paused / Resumed”
- On completion: “Tagging complete — X success, Y failed”
- On auth missing: “Spotify needs login”
- On rate-limit waiting: show small inline indicator (avoid spamming toasts)

---

## 6) IPC design (Renderer ↔ Main)

Use a single IPC namespace: `autotag:*`

### 6.1 Renderer → Main calls
- `autotag:openWindow`
- `autotag:pickFiles` (opens native file picker in main)
- `autotag:start` (config + file list)
- `autotag:pause`
- `autotag:resume`
- `autotag:cancel`
- `autotag:auth` (providerId)
- `autotag:exportReport` (runId)

### 6.2 Main → Renderer events (stream)
- `autotag:event` (progress/log events)
- `autotag:result` (final results batch)
- `autotag:authStateChanged` (providerId + state)

**Important:** Always include `runId` in every event so multiple runs don’t collide.

---

## 7) Main process: AutoTag Engine (the actual work)

### 7.1 Pipeline stages (always in this order)
For each file:

1) **Scan / Read**
- Use `music-metadata` to read tags + duration + embedded art.
- Build `TrackContext`:
  - path, ext, current tags, duration, file hash (optional), waveform (not needed here)

2) **Skip rules**
- If `skipAlreadyTaggedTracks`:
  - define “already tagged” as: `artist && title` (minimum) OR stricter if you want.
  - emit event: `SKIPPED_ALREADY_TAGGED`

3) **Input matching optimization**
If `trackOrReleaseId