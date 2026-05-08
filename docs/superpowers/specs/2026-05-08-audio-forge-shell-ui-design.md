---
title: Audio Forge — Phase 2B (Forge Shell UI) Design
date: 2026-05-08
phase: 2B
status: approved-for-planning
supersedes: none
related:
  - docs/plans/2026-05-06-audio-forge-design.md          # Phase 0 spec (umbrella)
  - docs/plans/2026-05-06-audio-forge-implementation.md  # Phase 1 forge-lib (merged)
  - docs/plans/2026-05-07-audio-forge-recorder-implementation.md  # Phase 2A Tauri sidecar (this branch)
---

# Audio Forge — Phase 2B Design

Forge Shell UI for the audio-forge plugin. Adds a view-only Audio Forge dashboard
that captures system + microphone audio, automatically creates a recording entity
on stop, automatically transcribes via local Whisper, and lets the user browse,
play, and re-transcribe prior recordings.

## Goal

Make the recording capability that already exists at the Tauri command layer
(Phase 2A) usable end-to-end by a non-technical user from the Forge Shell
desktop app, without touching DevTools or shell commands.

## Non-Goals

- Global record button outside the Audio Forge view.
- Floating always-on-top recording widget.
- `/audio-forge:record` slash command for triggering from a Claude Code session.
- In-shell transcript editing (the markdown body is editable in any text editor).
- Multi-file batch import or external WAV ingestion.
- Pause/resume mid-recording.
- Multiple Whisper model choices in the UI (defaults to `large-v3-turbo`).
- Real-time partial transcription streaming.

Each non-goal is a clean follow-up phase.

## Architecture

The view follows the established Forge Shell pattern (`slack-forge.js`,
`outlook-forge.js`): a single self-contained IIFE view controller that owns its
DOM, scans its plugin directory via `ForgeFS`, and invokes Tauri commands /
listens to Tauri events.

```
forge-shell/
├── app/
│   ├── index.html                       (modify: nav item, view slot, css/js link)
│   ├── css/audio-forge.css              (new: scoped to .af-* prefix)
│   └── js/
│       ├── shell.js                     (modify: register audio-forge view)
│       └── audio-forge.js               (new: ~600–700 lines)
└── src-tauri/
    ├── tauri.conf.json                  (modify: assetProtocol scope)
    ├── src/lib.rs                       (unchanged from Phase 2A)
    └── src/audio_commands.rs            (unchanged from Phase 2A)
```

No new backend code. The frontend integrates against the six Tauri commands
already shipped in Phase 2A: `start_recording`, `stop_recording`,
`get_recording_status`, `recover_orphaned_recording`, `run_recording_create`,
`run_recording_transcribe`.

## UX

### Layout

List + detail (Slack Forge pattern). Toolbar holds the only recording controls.

```
┌─ Audio Forge ─────────────────────────────────────────────────┐
│ [☰] 🎙 Audio Forge   [⏺ Record  □sys ☑mic  00:00 ▮▮▯]  [↻ 🌙] │
├──────────────────────────────────────────────────────────────┤
│  Recordings (12)              │  ┌─ 2026-05-07 standup ───┐ │
│  ┌──────────────────────────┐ │  │ 12:34  •  4m 18s        │ │
│  │ 🎙 2026-05-07 standup    │ │  │ ✏ rename                │ │
│  │ 4m 18s  ✓ transcribed   │ │  │                         │ │
│  ├──────────────────────────┤ │  │ ▶ System  ▮▮▮▮▯ 02:14   │ │
│  │ 🎙 2026-05-06 brainstorm │ │  │ ▶ Mic     ▮▮▯▯▯ 02:14   │ │
│  │ 12m 04s ⏳ transcribing │ │  │                         │ │
│  ├──────────────────────────┤ │  │ ── Transcript ─────     │ │
│  │ 🎙 2026-05-06 jam        │ │  │ **System**: Hey team…   │ │
│  │ 8m 12s  ⚠ failed [↻]     │ │  │ **You**: Sounds good…   │ │
│  └──────────────────────────┘ │  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Toolbar (recording controls)

| Element | Behavior |
|---|---|
| Source checkboxes | `system` + `mic`, both default-checked. Disabled while recording. At least one must be checked to enable Record. |
| Record button | Idle → red filled circle "⏺ Record". Recording → square "⏹ Stop". Disabled in `starting`, `stopping`, `creating`, `transcribing` states (spinner shown). |
| Elapsed timer | `mm:ss` format. Driven by `audio-forge://elapsed` events (sidecar is source of truth, not a JS interval). |
| Level meter | Two thin horizontal bars, one per active source. Width animates from `audio-forge://meter` events. Hidden when not recording. |

### List item

| Field | Source |
|---|---|
| Title | `frontmatter.title` |
| Created date | `frontmatter.created` (formatted `MMM D, YYYY`) |
| Duration | `_format_duration_human(frontmatter.duration_seconds)` (mm:ss or h:mm:ss) |
| Status badge | `frontmatter.transcript_status` → ✓ transcribed / ⚠ failed / ⏸ pending. **Override:** if `entity.id === activeId` and `activeState === 'transcribing'`, badge is ⏳ regardless of disk status. (The on-disk status is `pending` between create and transcribe completion; the UI knows it's actively transcribing.) |

Sorted by `created` descending. Search input filters by title substring (case-insensitive).

### Detail panel

| Section | Content |
|---|---|
| Header | Title (with inline rename ✏), created timestamp, duration, status badge |
| Audio players | One HTML5 `<audio controls>` per source listed in `frontmatter.audio_files` |
| Transcript | Rendered markdown body (everything below frontmatter), or empty-state if not yet transcribed |
| Failed-state action | Retry button visible only when `transcript_status === 'failed'` |

## State machine

```
idle ──[Record]──► starting ──[started event]──► recording
                       │                              │
                       └──[error event / timeout]─► idle (toast)
                                                      │
                                              [Stop click]
                                                      ▼
   transcribing ◄──[create OK]── creating ◄── stopping ──[stopped event]──► creating
        │                            │
        ├──[transcribe OK]──► (refresh entity) ──► idle, list shows ✓
        │
        ├──[transcribe err]─► (entity exists) ──► idle, list shows ⚠
        │
        └──[create err]────► toast, WAVs still on disk, idle
```

State held in module-level vars in the view controller:

- `activeState: 'idle' | 'starting' | 'recording' | 'stopping' | 'creating' | 'transcribing'`
- `activeId: string | null`
- `activeStartedAt: string | null` (RFC3339)
- `activeFiles: { system?: string, mic?: string } | null`
- `activeSources: string[]`

There is no localStorage persistence of state. The disk is the source of truth:
`active.json` for in-flight recordings, recording markdown frontmatter for
completed recordings.

## Data flow

### View activation

```
1. (once) Subscribe to audio-forge://meter | elapsed | stopped | error | terminated
2. invoke('get_recording_status')
   └─ if is_recording: hydrate UI to 'recording' state with returned id + elapsed
3. invoke('recover_orphaned_recording', { projectRoot })
   └─ if Some(active): show recovery banner (see Orphan Recovery)
4. ForgeFS.listMarkdownFiles('audio-forge/recordings/')
   └─ parse frontmatter from each → render list
```

### Record click

```
1. Validate ≥1 source checkbox checked
2. invoke('start_recording', { projectRoot, sources })
3. UI → 'recording'; meter / elapsed events animate the toolbar
```

### Stop click (the auto-transcribe pipeline)

```
1. UI → 'stopping'; invoke('stop_recording')
   └─ returns { id, duration_seconds, files }
2. UI → 'creating'; derive title = "Recording YYYY-MM-DD HH:MM"  (from activeStartedAt)
   invoke('run_recording_create', {
     projectRoot, id, title,
     durationSeconds: stopped.duration_seconds,
     sources: activeSources,
     files: stopped.files,
   })
   └─ returns markdown file path
3. (background) refresh list now so the new entity appears with status='pending'/'transcribing'
4. UI → 'transcribing'; invoke('run_recording_transcribe', {
     projectRoot, id, model: 'large-v3-turbo',
   })
   └─ returns final markdown path on success
5. On resolve: re-read the entity, update detail + list (✓)
6. On reject: keep entity, mark UI as failed, expose Retry, show toast
```

### Retry transcribe

```
detail.retry click → invoke('run_recording_transcribe', {projectRoot, id, model})
                   → reload entity → update UI
```

## Audio playback

HTML5 `<audio controls>` elements. The `src` is the project-relative path from
`frontmatter.audio_files.{system,mic}` (e.g.
`audio-forge/audio/2026-05-08T143200.system.wav`) joined with `projectRoot`,
resolved through `convertFileSrc()` from `@tauri-apps/api/core`.

This requires `tauri.conf.json` to enable the asset protocol with a scoped
allow-list:

```json
"app": {
  "security": {
    "assetProtocol": {
      "enable": true,
      "scope": ["**/audio-forge/audio/*.wav"]
    }
  }
}
```

The scope is intentionally narrow: only WAV files inside any `audio-forge/audio`
directory under the user's project tree are reachable from the webview.

## Orphan recovery

On view activation, after `get_recording_status` reports no active in-process
recording, call `invoke('recover_orphaned_recording', { projectRoot })`.

If the call returns `Some(active)` (active.json exists, PID is dead), the view
shows a non-modal banner above the list:

> ⚠ A previous recording (`<id>`, started `<started_at>`) was interrupted.
> The captured audio files are on disk. Save it as a recording? [Save] [Discard]

- **Save** → `run_recording_create` with `title = "Recovered recording <id>"`,
  `durationSeconds = 0` (we have no reliable duration), `transcript_status` ends
  up as `pending` from the schema default, and the user can click Transcribe
  manually if desired. Then delete `active.json`.
- **Discard** → delete `active.json` and the orphaned WAVs.

`durationSeconds = 0` is a deliberate choice: the schema requires
`duration_seconds`, but we don't trust the file mtime delta enough to render it
as a real duration. `0` is honest and the user can correct it by editing the
markdown.

## Error handling

| Failure | UX |
|---|---|
| No source checkbox checked | Record button disabled (visual state); no toast. |
| `start_recording` rejects (timeout / sidecar spawn fail / permission) | Toast with the error message; state → idle. If permission-related, message explicitly mentions System Settings → Privacy → Microphone / Screen Recording. |
| `audio-forge://error` arrives during recording | Toast; state → idle; subsequent `terminated` event silently ignored. |
| `audio-forge://terminated` without prior error | Toast "Recorder exited unexpectedly"; state → idle; next view activation will show recovery banner. |
| `run_recording_create` rejects | Toast with stderr excerpt; state → idle; WAVs remain on disk; recovery flow will pick them up on next activation. |
| `run_recording_transcribe` rejects | Entity stays in list; transcript_status flipped to `failed` by forge-lib; UI shows ⚠ with Retry; toast. |
| Whisper times out / takes >5 min | We do not enforce a frontend timeout. The user can navigate away — Tauri's `Command::output` is awaited; if the user quits the app, Whisper subprocess is killed by Tauri shutdown. |
| User clicks Record while transcribing | Record button disabled in `transcribing` state; cannot reach this case via UI. |
| Disk full when writing WAVs | Sidecar emits `error`; same path as permission-denied. |
| Two Forge Shell instances on the same project | `recover_orphaned_recording` only returns `Some` when the previous PID is dead, so a live second window is correctly skipped. The user-facing constraint: only one recording at a time per project tree. |

## Component decomposition

`audio-forge.js` is a single IIFE module exposing `window.AudioForgeView`. Internal
structure:

```
AudioForgeView (IIFE)
├── State: activeState, activeId, activeStartedAt, activeFiles, activeSources,
│           recordings[], selectedId, rootHandle, listenersAttached
├── Tauri bridge:
│   ├── ensureListeners()                  // idempotent, first activation only
│   ├── handleMeter(payload)
│   ├── handleElapsed(payload)
│   ├── handleStopped(payload)
│   ├── handleError(payload)
│   └── handleTerminated(payload)
├── Commands wrappers (thin invoke()s with toast on rejection):
│   ├── startRecording()
│   ├── stopRecording()
│   ├── recoverOrphan()
│   ├── createRecordingEntity(stopped)
│   └── transcribeRecording(id)
├── Pipeline:
│   └── runStopPipeline(stopped)           // create → transcribe → refresh
├── Disk:
│   ├── scanRecordings()                   // ForgeFS.listMarkdownFiles + frontmatter
│   ├── parseFrontmatter(text)
│   └── readEntity(filename)               // re-read one entity (post-transcribe)
├── Render:
│   ├── scaffold()
│   ├── renderToolbar()
│   ├── renderList()
│   ├── renderDetail()
│   ├── renderRecoveryBanner(active)
│   └── renderEmptyState()
├── Helpers:
│   ├── formatDuration(seconds)
│   ├── formatTimestamp(rfc3339)
│   ├── deriveTitle(rfc3339)
│   ├── statusBadge(status)
│   └── audioSrc(projectRoot, relPath)     // → convertFileSrc(absPath)
└── Public:
    ├── init(rootHandle, projectRoot)
    ├── show()                             // called by shell.js when nav clicked
    └── refresh()
```

Each helper / render function is < 60 lines, individually testable.

## Testing strategy

The implementation will follow subagent-driven-development with TDD per task.

| Layer | Approach |
|---|---|
| Pure helpers (formatDuration, formatTimestamp, deriveTitle, parseFrontmatter, statusBadge) | Node `node:test` unit tests in `forge-shell/test/audio-forge.helpers.test.js`. No DOM, no Tauri. |
| State-machine reducer | Extracted as a pure function `reduce(state, event) → state`. Unit tested. |
| DOM scaffolding | JSDOM smoke test that calls `scaffold()` and asserts presence of key `data-af-*` attributes / button counts. |
| Tauri integration (the parts that invoke or listen) | The Phase 2A DevTools harness, parameterized and re-run after any task that touches the bridge code paths. |
| End-to-end UAT | Manual: record 30 s of system + mic with audio playing, verify auto-transcribe completes, verify orphan recovery (force-kill app mid-recording → relaunch → recover prompt). |

The plan will require unit tests to be written before the implementation for
each task that has a pure-logic surface.

## Implementation phasing (preview)

The writing-plans skill will turn this into a detailed plan; expected
breakdown is roughly 10 sequential tasks:

1. `tauri.conf.json` assetProtocol scope.
2. `audio-forge.css` + view scaffold + nav registration.
3. Frontmatter scan + list rendering (read-only).
4. Detail panel scaffold + audio playback wiring (`convertFileSrc`).
5. Toolbar + Record button + state-machine skeleton.
6. Live event subscriptions + meter / elapsed animations.
7. Stop → create → transcribe pipeline (auto-transcribe).
8. Failed-state Retry + error toasts.
9. Orphan recovery banner + flow.
10. Manual UAT pass + polish + merge.

## Files touched

| File | Action |
|---|---|
| `forge-shell/app/js/audio-forge.js` | NEW |
| `forge-shell/app/css/audio-forge.css` | NEW |
| `forge-shell/app/index.html` | MODIFY (nav item, view div, css link, script tag) |
| `forge-shell/app/js/shell.js` | MODIFY (register nav + view dispatch) |
| `forge-shell/src-tauri/tauri.conf.json` | MODIFY (assetProtocol scope) |
| `forge-shell/test/audio-forge.helpers.test.js` | NEW |
| `docs/superpowers/specs/2026-05-08-audio-forge-shell-ui-design.md` | NEW (this doc) |

## Acceptance criteria

The phase is complete when, on a fresh `feat/audio-forge-phase-2b` branch
checkout:

1. `npm run tauri:dev` from `forge-shell/` builds and launches with no new errors.
2. The Audio Forge nav item appears in the sidebar and routes to the view.
3. With no prior recordings, the view shows an empty state with the toolbar.
4. Clicking Record with `system` + `mic` checked starts a recording; the
   toolbar shows live elapsed and dual-track level meters; clicking Stop
   produces a new entity in the list within a few seconds.
5. The new entity transitions ⏳ → ✓ when Whisper finishes (1–2 min for a
   30-second clip with `large-v3-turbo`).
6. Clicking the entity in the list shows the detail panel with two playable
   audio elements and the rendered transcript.
7. Force-killing the app during a recording, relaunching, and clicking Audio
   Forge surfaces the recovery banner with the correct id.
8. Whisper-failure simulation (point `WHISPER_BIN` to a failing stub) marks
   the entity ⚠; the Retry button re-invokes transcription successfully when
   the stub is reverted.
9. All unit tests pass (`node --test forge-shell/test/`).
10. Manual UAT script (10 steps, lives in the implementation plan) passes.
