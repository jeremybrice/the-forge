# Audio-Forge Plugin Design

**Date:** 2026-05-06
**Status:** Approved
**Plugin:** audio-forge
**Version target:** v2.3.0 (introduces audio capture + transcription)

## Overview

New plugin for **recording system audio + microphone on macOS** and **transcribing the captured audio** with the locally installed OpenAI Whisper. Capture happens through a Swift sidecar that uses macOS-native ScreenCaptureKit (system audio) and AVAudioEngine (microphone). Transcripts are stored as markdown with frontmatter under `audio-forge/recordings/`, browsable from a new Forge Shell page.

No virtual audio drivers, no external services. Recording can be triggered from the Forge Shell UI or from the `forge recording` CLI; transcripts are produced post-recording (not live).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capture sources | System audio + microphone as **two separate tracks** | Best transcript quality; merged with `**System**:` / `**You**:` labels by timestamp. Whisper handles each track cleanly without speaker confusion. |
| Capture API | ScreenCaptureKit (system) + AVAudioEngine (mic), via Swift sidecar | macOS 13+ native, no virtual audio driver needed. macOS 26.3 fully supports per-process and content-share audio. |
| Per-app vs system-wide | **System-wide** (silent, no picker) for v1 | Avoids `SCContentSharingPicker` UI flash every recording. Per-app deferred to v2. |
| Plugin name | `audio-forge`, artifact type = `recording` | Avoids collision with existing `forge-lib/core/transcript_ops.py` (Slack/JIRA text transcripts). |
| Transcription mode | Post-recording only | Live captioning would require streaming chunks to whisper with debounced partial results — 3× the complexity for a feature rarely needed. |
| Transcription engine | Existing `/opt/homebrew/bin/whisper` (OpenAI Python whisper) | Already installed; `large-v3-turbo.pt` and `medium.pt` cached. No new dependency. |
| Default model | `large-v3-turbo` with `medium` fallback | Fastest of the high-quality models on Apple Silicon (~6× faster than `large-v3` at ~99% accuracy). Override per-recording or via plugin config. |
| Trigger surfaces | Forge Shell page **and** `forge recording start/stop` CLI | Two surfaces sharing one state file. No global hotkey in v1. |
| Audio format | 48 kHz / 16-bit / **mono** PCM WAV | ScreenCaptureKit-native rate; sum stereo→mono in tap. ~110 MB/hr per track. Whisper resamples internally. |
| Audio retention | Keep WAV by default; `forge recording prune --older-than 30d` | Preserves option to re-transcribe with future, better models. |
| Max length | 4 hours hard cap | Prevents runaway disk usage. No silence-based auto-stop (too easy to lose data). |
| Concurrent recordings | One at a time | State persisted in `audio-forge/active.json`; orphan recovery on next launch. |
| Speaker diarization | Out of scope for v1 | `pyannote` integration deferred. |
| Cross-platform | macOS only for v1 | Linux/Windows would need entirely different audio stacks. |

## Architecture

```
┌─────────────────┐  Tauri IPC                ┌──────────────────────┐
│ Forge Shell UI  │ ◄────────────────────────►│ Tauri Rust commands  │
│ (audio-forge.js)│                           │ (audio_commands.rs)  │
└─────────────────┘                           └──────────┬───────────┘
                                                         │ spawn sidecar
                                              ┌──────────▼───────────┐
                                              │ forge-recorder       │ ← Swift sidecar
                                              │ (ScreenCaptureKit +  │   binary (per-arch)
                                              │  AVAudioEngine)      │
                                              └──────────┬───────────┘
                                                         │ writes WAVs
                                              ┌──────────▼───────────┐
                                              │ audio-forge/audio/   │
                                              │  {id}-system.wav     │
                                              │  {id}-mic.wav        │
                                              └──────────┬───────────┘
                                                         │ on stop, shell-out
                                              ┌──────────▼───────────┐
                                              │ /opt/homebrew/bin/   │
                                              │ whisper              │ ← already installed
                                              └──────────┬───────────┘
                                                         │ JSON segments
                                              ┌──────────▼───────────┐
                                              │ forge recording      │ ← forge-lib CLI
                                              │ create / transcribe  │
                                              └──────────┬───────────┘
                                                         │ writes markdown
                                              ┌──────────▼───────────┐
                                              │ audio-forge/         │
                                              │  recordings/         │
                                              │   YYYY-MM-DD-…md     │
                                              │  recordings/         │
                                              │   index.json         │
                                              └──────────────────────┘
```

## Components

### 1. Swift sidecar — `forge-recorder`

**Location:** `forge-shell/src-tauri/binaries/forge-recorder/` (Swift Package Manager project)
**Outputs:** `forge-recorder-aarch64-apple-darwin`, `forge-recorder-x86_64-apple-darwin` (built via `swift build -c release` per arch and copied into `forge-shell/src-tauri/binaries/`).

**IPC protocol — line-delimited JSON over stdin/stdout:**

Inbound commands (from Tauri):
```
{"cmd":"start","outDir":"/abs/path","id":"2026-05-06T143022","sources":["system","mic"]}
{"cmd":"stop"}
{"cmd":"status"}
```

Outbound events:
```
{"event":"started","id":"…","files":{"system":"/abs/path/{id}-system.wav","mic":"/abs/path/{id}-mic.wav"}}
{"event":"meter","sources":{"system":0.12,"mic":0.04}}    // every 200 ms
{"event":"stopped","id":"…","duration_seconds":3600,"files":{...}}
{"event":"error","code":"PERMISSION_SCREEN_RECORDING|PERMISSION_MIC|DISK_FULL|…","message":"…"}
```

**Internals:**
- Uses `SCStream` configured with `capturesAudio = true`, `audioOnly` content filter (no video) for system audio.
- Uses `AVAudioEngine.inputNode.installTap(...)` for mic.
- Writes each stream to its own `AVAudioFile` (`Int16`, 48 kHz, mono). Sums stereo→mono inside the tap callback by averaging channels.
- Background task monitors free disk; auto-stops gracefully if free space drops below 1 GB.
- Hard cap: 4 h elapsed → emit `stopped` automatically.

### 2. Tauri Rust layer

**New file:** `forge-shell/src-tauri/src/audio_commands.rs`
**Modified:** `forge-shell/src-tauri/src/lib.rs` (register handlers, manage state)
**Modified:** `forge-shell/src-tauri/tauri.conf.json` (declare `bundle.externalBin`)
**Modified:** `forge-shell/src-tauri/capabilities/default.json` (allow shell sidecar exec)

State: `RecorderState(Mutex<Option<RecorderHandle>>)` where `RecorderHandle` holds the spawned child, the recording id, and the start time.

Commands:
- `start_recording(project_root: String, sources: Vec<String>) -> Result<RecordingHandle, String>`
- `stop_recording() -> Result<RecordingResult, String>`
- `get_recording_status() -> Option<RecordingStatus>`
- `recover_orphaned_recording(project_root: String) -> Option<OrphanInfo>` — checks `audio-forge/active.json` on app start.
- `run_recording_create(project_root: String, id: String, title: String, duration: u32, sources: Vec<String>, files: AudioFiles) -> Result<String, String>` — shells `forge recording create` with the supplied args; returns the markdown filepath.
- `run_recording_transcribe(project_root: String, id: String, model: Option<String>) -> Result<String, String>` — shells `forge recording transcribe`; returns the markdown filepath after the transcript body is merged in.

Events to frontend (via `app.emit`):
- `audio-forge://meter` (system + mic RMS, every 200 ms)
- `audio-forge://elapsed` (seconds, every 1 s)
- `audio-forge://error` (string code + message)

State file `audio-forge/active.json` schema:
```json
{
  "id": "2026-05-06T143022",
  "started_at": "2026-05-06T14:30:22Z",
  "sources": ["system", "mic"],
  "files": {"system": "...", "mic": "..."},
  "pid": 12345
}
```

On clean stop the file is deleted. On crash it persists; the next launch sees the orphan, checks if PID is still alive, and either offers "transcribe what was captured" or "discard."

### 3. forge-lib `recording` subcommand

**New files:**
- `forge-lib/core/recording_ops.py` — operations
- `forge-lib/schemas/recording.json` — JSON schema
- `forge-lib/templates/recording.md.j2` — Jinja2 template
- `forge-lib/tests/test_recording_ops.py` — unit tests

**Modified:** `forge-lib/forge.py` — register the `recording` subcommand group.

**Schema (`recording.json`):**
```json
{
  "type": "object",
  "required": ["id", "title", "created", "duration_seconds", "sources", "audio_files", "transcript_status"],
  "properties": {
    "id":               {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{6}$"},
    "title":            {"type": "string", "minLength": 1, "maxLength": 200},
    "created":          {"type": "string", "format": "date-time"},
    "duration_seconds": {"type": "integer", "minimum": 0},
    "sources":          {"type": "array", "items": {"enum": ["system", "mic"]}},
    "audio_files":      {"type": "object",
                         "properties": {"system": {"type": "string"}, "mic": {"type": "string"}}},
    "transcript_status":{"enum": ["pending", "transcribing", "complete", "failed"]},
    "transcript_error": {"type": ["string", "null"]},
    "model":            {"type": ["string", "null"]},
    "language":         {"type": ["string", "null"]},
    "tags":             {"type": "array", "items": {"type": "string"}}
  }
}
```

**Template (`recording.md.j2`):**
```
---
id: {{ id }}
title: {{ title }}
created: {{ created }}
duration_seconds: {{ duration_seconds }}
sources: {{ sources | tojson }}
audio_files: {{ audio_files | tojson }}
transcript_status: {{ transcript_status }}
{% if model %}model: {{ model }}{% endif %}
{% if language %}language: {{ language }}{% endif %}
tags: {{ tags | tojson }}
---

# {{ title }}

**Duration:** {{ duration_human }}
**Recorded:** {{ created }}
**Sources:** {{ sources | join(', ') }}

## Transcript

{% if transcript_status == 'pending' %}
_Transcription has not been run yet. Run `/audio-forge:transcribe {{ id }}` to generate._
{% elif transcript_status == 'transcribing' %}
_Transcription in progress…_
{% elif transcript_status == 'failed' %}
_Transcription failed: {{ transcript_error }}_
{% else %}
{{ transcript_body }}
{% endif %}
```

`transcript_body` is the merged dual-track output, e.g.:
```
**System** (00:00:01): Hello everyone, welcome.
**You**    (00:00:04): Hi, can you hear me okay?
**System** (00:00:06): Loud and clear.
```

**CLI subcommands:**
- `forge recording create --id ID --title TITLE --duration N --sources system,mic --audio-system PATH --audio-mic PATH` — creates the markdown skeleton with `transcript_status=pending`.
- `forge recording transcribe ID [--model NAME] [--language CODE]` — invokes whisper on each track, merges segments, writes `transcript_body` into the markdown, updates frontmatter.
- `forge recording list [--status STATUS]`
- `forge recording get ID`
- `forge recording update ID [--title …] [--tags …]`
- `forge recording delete ID [--keep-audio] [--keep-markdown]`
- `forge recording prune --older-than 30d [--keep-transcripts]` — deletes WAV files; with `--keep-transcripts` (default), markdown stays.

All commands return the standard `{success, data, error}` JSON envelope.

### 4. `audio-forge` plugin

**Location:** `audio-forge/`

```
audio-forge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   ├── record.md       # /audio-forge:record [--no-mic|--no-system]
│   ├── transcribe.md   # /audio-forge:transcribe <id-or-path> [--model …]
│   └── list.md         # /audio-forge:list [--status …]
└── skills/
    └── recording-workflow/
        └── SKILL.md
```

`record.md` is a thin wrapper: it instructs the LLM to call the Forge Shell's recording state via the CLI flow (`forge recording create` after a sidecar run) — but the *primary* trigger is the Forge Shell UI. The command exists so users can also kick off recordings from a chat session.

### 5. Forge Shell view

**New files:**
- `forge-shell/app/js/audio-forge.js` — view controller
- `forge-shell/app/css/audio-forge.css`

**Modified:**
- `forge-shell/app/index.html` — pre-rendered `<div id="view-audio-forge"></div>` container
- `forge-shell/app/js/shell.js` — register in PLUGINS array (`requiredDir: 'audio-forge/recordings'`)

**Layout (single column, ~1100 px):**

```
┌──────────────────────────────────────────────────────────────┐
│  [▣ System] [🎤 Mic]    ●  REC   00:42   ▌▌▌▌▌▌·····  ▆▆··  │  ← recorder bar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Recordings                                                  │
│  ─────────────────────────────  Detail (selected recording)  │
│  ▸ 2026-05-06  Untitled (1m22s)                             │
│  ▸ 2026-05-04  API design call (12m04s)   ← list             │
│  ▸ 2026-05-03  Standup (4m13s)                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The detail pane shows: editable title, metadata (date, duration, sources, model), a transcript with timestamps that act as `<a>` links seeking a hidden `<audio>` element to that timestamp (uses the system track for system+mic recordings; mic for mic-only).

### Data flow — record → transcript

1. User clicks **Record** in Forge Shell. `audio-forge.js` calls Tauri `start_recording(projectRoot, ['system','mic'])`.
2. Tauri spawns the sidecar with `cmd:start`. Sidecar opens both streams, writes `audio-forge/active.json`, emits `started` event with output paths. Tauri returns the recording id; UI shows timer + meter.
3. User clicks **Stop**. Tauri sends `cmd:stop` → sidecar finalizes WAVs → emits `stopped` with duration. Tauri removes `active.json` and returns paths.
4. UI calls Tauri `run_recording_create(id, title='Untitled', duration, sources, files)` which shells `forge recording create …` → markdown skeleton is written, recording shows in the list immediately with `transcript_status=pending`.
5. UI calls Tauri `run_transcribe(id)` which shells `forge recording transcribe id`. forge-lib runs whisper on each track *in sequence* (parallel runs would oversubscribe Apple Silicon GPU), parses `--output_format json`, merges segments, sets `transcript_status=complete`. The Forge Shell file watcher already in `forge-shell/src-tauri/src/watcher.rs` notifies the UI of the markdown change; the detail pane re-renders.

## Error Handling

| Failure | Behavior |
|---------|----------|
| Screen Recording permission denied | Sidecar emits `error` with `code=PERMISSION_SCREEN_RECORDING`. UI shows "Open System Settings → Privacy → Screen Recording" with a deeplink (`x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`). |
| Mic permission denied | Sidecar degrades to system-only and emits `warning` event. UI shows a one-time toast; recording proceeds. |
| Both system + mic denied | Sidecar emits `error` with `PERMISSION_ALL`. Recording aborted; `active.json` not written. |
| Whisper not found at `/opt/homebrew/bin/whisper` | `forge recording transcribe` returns `error.code=WHISPER_MISSING` with install instructions. `transcript_status=failed`, `transcript_error` captured in frontmatter. |
| Whisper crashes on a track | One track may complete; the other's status is `failed`. Transcript still produced from successful track only. |
| Sidecar crashes mid-recording | Partial WAV is on disk (header may be malformed). On next launch the orphan recovery offers "transcribe what was captured" or "discard." |
| Disk free <5 GB at start | UI warns, requires confirmation. |
| Disk free <1 GB during recording | Sidecar emits `error` `DISK_LOW` and stops gracefully. |
| Forge Shell killed mid-recording | Sidecar receives SIGTERM, flushes WAV file headers, exits. `active.json` persists for orphan recovery. |
| Recording exceeds 4 h cap | Sidecar emits `stopped` event with `reason=MAX_DURATION`. |

## Testing

### Automated (forge-lib only)

`forge-lib/tests/test_recording_ops.py`:
- Filename pattern (`YYYY-MM-DD-{slug}.md`) and id pattern (`YYYY-MM-DDTHHMMSS`).
- Schema validation accepts a complete record; rejects records with bad enums, missing required fields.
- `create()` writes markdown, updates `index.json`, returns expected JSON envelope.
- `list()` filters by `transcript_status`.
- `update()` modifies title/tags, preserves other frontmatter.
- `delete()` honours `--keep-audio` and `--keep-markdown` independently.
- Whisper segment parser: golden-file test of `whisper --output_format json` output → list of `{start, end, text}` segments.
- Track merger: given two segment lists with overlapping timestamps, produces a single chronologically interleaved transcript with `**System**:` / `**You**:` labels.
- Whisper subprocess: mocked via `unittest.mock.patch('subprocess.run')`. Asserts model, language flags propagate.
- `prune --older-than 30d`: creates fixture WAVs with mtimes set 31 days back, asserts they're removed; markdown remains.

### Manual smoke tests (documented in `audio-forge/README.md`)

- **Permissions setup:** First launch flow — grant Screen Recording, grant Mic, verify both prompts surface and the app proceeds correctly after granting.
- **Sidecar 10 s recording:** Trigger from Forge Shell, verify two WAVs of expected size (~1.2 MB each), expected sample rate via `afinfo`.
- **End-to-end:** 30 s meeting clip with both tracks → click Stop → wait for transcript → verify markdown contains correctly interleaved `**System**:` and `**You**:` lines.
- **Orphan recovery:** Start a recording, force-quit Forge Shell, relaunch, verify orphan dialog appears with correct timestamp and offers transcribe/discard.
- **Permission denied:** Revoke Screen Recording, attempt record, verify the deeplink dialog appears.

### Out of CI

- Sidecar audio capture cannot run on standard CI runners (no audio device).
- Tauri command tests are thin shell wrappers over `tauri-plugin-shell`; testing them mostly tests Tauri itself.
- The forge-lib portion of the test suite runs in CI as part of the existing pytest invocation.

## File Naming

| Artifact | Pattern | Example |
|----------|---------|---------|
| Recording id | `YYYY-MM-DDTHHMMSS` | `2026-05-06T143022` |
| System audio | `audio-forge/audio/{id}-system.wav` | `audio-forge/audio/2026-05-06T143022-system.wav` |
| Mic audio | `audio-forge/audio/{id}-mic.wav` | `audio-forge/audio/2026-05-06T143022-mic.wav` |
| Markdown | `audio-forge/recordings/{YYYY-MM-DD}-{slug}.md` | `audio-forge/recordings/2026-05-06-untitled-1.md` |
| Index | `audio-forge/recordings/index.json` | (one per project) |
| Active state | `audio-forge/active.json` | (one per project; deleted on clean stop) |

## Out of Scope (deferred to v2+)

- Live streaming transcription / live captions in the Forge Shell.
- Per-app capture via `SCContentSharingPicker`.
- Speaker diarization within a track (`pyannote`).
- LLM-based auto-titling from the first transcript paragraph.
- Global hotkey to start/stop recording without opening Forge Shell.
- Linux and Windows support — would need CoreAudio/WASAPI replacements.
- iOS / iPadOS — different APIs entirely.
- Cloud transcription fallback (e.g., Anthropic Speech if/when available, OpenAI).
- Encryption-at-rest for audio files.

## Dependencies on Existing Components

- `forge-lib` plugin pattern (`_ops.py` + `schemas/*.json` + `templates/*.j2` + `forge.py` subcommand registration). Mirrors the existing `card`, `task`, `session`, `report` modules.
- `forge-shell` view-controller pattern (`init(rootHandle)` / `destroy()`, scoped queries, `Shell.registerController`). Mirrors `cognitive-forge.js`, `product-forge.js` etc.
- `forge-shell/src-tauri/src/watcher.rs` filesystem watcher (already shipped) drives live UI updates of the recording list and detail pane.
- `tauri-plugin-shell` (already declared in `Cargo.toml` and capabilities) is reused to spawn the sidecar.

## Versioning

Bump `forge-lib/forge.py:__version__` and root `CLAUDE.md` from `2.2.1` → `2.3.0`. Add `audio-forge` to the plugin table in `CLAUDE.md` and `README.md`.

## Open Risks

| Risk | Mitigation |
|------|------------|
| ScreenCaptureKit per-process audio API surface changed in macOS 14.4 / 15 / 26; user is on 26.3 — Apple deprecates older APIs | Use `SCStreamConfiguration.capturesAudio` + `SCContentFilter.init(display:excludingApplications:exceptingWindows:)` which is still the macOS 26.x supported path. Watch for warnings on `swift build`. |
| Whisper updates change `--output_format json` schema | Test against the currently installed version; pin behaviour to documented fields (`segments[].{start,end,text}`). On version upgrade, re-run the parser golden test. |
| User has Whisper installed at a non-Homebrew path | Make whisper binary path configurable in `audio-forge/config.json`; fall back to `which whisper`. |
| Tauri sidecar bundling differs across the Tauri 2.x minor versions | Use the bundled-binary docs for the exact 2.10 release; verify dev mode + production bundle both work in the smoke test. |
| Apple Silicon MPS backend in OpenAI Whisper occasionally hangs on long inputs | Add a watchdog: if `whisper` doesn't print to stdout for >10 minutes, kill and retry with `--device cpu`. |
