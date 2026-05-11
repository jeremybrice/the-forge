# Audio-Forge

Record system audio and microphone on macOS, then transcribe locally with [OpenAI Whisper](https://github.com/openai/whisper).

> **Phase 1 (current):** CLI-only. You can transcribe WAV files produced by any tool. The Forge Shell record button arrives in Phase 2.

## Requirements

- macOS 13+ (ScreenCaptureKit; the recorder UI in Phase 2 requires this).
- [Whisper](https://github.com/openai/whisper) at `/opt/homebrew/bin/whisper`. Install: `brew install openai-whisper`.
  - At least one model cached. Run `whisper --model large-v3-turbo /path/to/any.wav` once to download.
  - Override the binary path via `FORGE_WHISPER_BIN`.
  - Override the default model via `FORGE_WHISPER_MODEL` (default: `large-v3-turbo`).
- forge-lib installed: `cd forge-lib && pip install -r requirements.txt`.

## Commands

| Command | Description |
|---------|-------------|
| `/audio-forge:list [--status <s>]` | List recordings, optionally filtered. |
| `/audio-forge:transcribe <id> [--model X] [--language en]` | Run whisper on a recording's audio. |

CLI equivalent (use directly when scripting):

```bash
python forge-lib/forge.py recording create --data '{"id":"...", "title":"...", ...}'
python forge-lib/forge.py recording list
python forge-lib/forge.py recording transcribe <id>
python forge-lib/forge.py recording prune --older-than-days 30
```

## Choosing a Microphone

By default Forge Shell records from the system default input device (System Settings → Sound → Input). The Audio Forge toolbar includes a **Mic** dropdown that lets you override this per project.

- Pick **(System default)** to follow whatever macOS considers the default input.
- Pick a specific device (e.g. "Logitech HD Webcam C615 (default)") to record from it regardless of the system default. This is useful when the MacBook is closed in clamshell mode (the built-in mic is disabled by hardware) or when a virtual device like BlackHole is the default but you want a physical mic.

Your selection is remembered across launches via `localStorage`. If the device disappears (e.g. you unplug the USB mic), Forge Shell silently falls back to the system default and shows a one-time warning.

### Silent-source warning

Within ~1 second of pressing Record, Forge Shell checks whether the chosen mic is actually producing audio. If the input is bit-perfect silence (peak amplitude < 0.0001), a toast appears:

> Microphone is producing silence (peak=0.0). Device=…. Likely causes: MacBook lid closed disabling built-in mic, mic muted in System Settings, a HAL plugin (Wispr/Krisp/etc.) intercepting the input, or wrong device selected.

The recording continues — you may still want the system-audio track even when the mic is dead. Stop early if the warning surprises you.

### Diagnosing a silent mic

| Cause | Fix |
|---|---|
| Lid closed on MacBook Pro | Open the lid, or pick a different device in the dropdown |
| Input muted at OS level | System Settings → Sound → Input → raise volume slider |
| HAL plugin (Wispr Flow, Krisp, NVIDIA Broadcast) intercepting | Quit the interceptor app, retry |
| Wrong default device selected | Pick the intended device explicitly in the toolbar |

## File Layout

```
audio-forge/
├── recordings/
│   ├── index.json                       # auto-maintained
│   └── 2026-05-06-sprint-standup.md     # one markdown per recording
└── audio/
    ├── 2026-05-06T143022-system.wav
    └── 2026-05-06T143022-mic.wav
```

## Markdown Frontmatter

Each recording markdown carries frontmatter like:

```yaml
id: 2026-05-06T143022
type: recording
title: "Sprint Standup"
created: 2026-05-06T14:30:22
updated: 2026-05-06
duration_seconds: 125
sources:
  - system
  - mic
audio_files:
  system: audio-forge/audio/2026-05-06T143022-system.wav
  mic:    audio-forge/audio/2026-05-06T143022-mic.wav
transcript_status: complete
model: large-v3-turbo
language: en
tags: []
```

The body's `## Transcript` section contains lines like:

```
**System** (00:00:00): Hello everyone, welcome to the call.
**You**    (00:00:03): Hi, can you hear me okay?
**System** (00:00:05): Loud and clear.
```

## Troubleshooting

**`WHISPER_MISSING`** — install whisper or set `FORGE_WHISPER_BIN`.

**Transcription is hanging on long inputs** — Apple Silicon's MPS backend occasionally stalls on 1h+ recordings. Re-run with `--model medium`. To force CPU inference, point `FORGE_WHISPER_BIN` at a wrapper script that adds `--device cpu` to the whisper invocation, or run whisper directly: `whisper <path-to.wav> --device cpu`.

**Disk usage** — WAVs are ~110 MB/hr/track. Use `forge recording prune --older-than-days 30` to clean up.

## Roadmap

- **Phase 2 (next plan):** Swift sidecar + Tauri integration + Forge Shell view with record button, live VU meter, transcript browser. See `docs/plans/2026-05-07-audio-forge-recorder.md` (drafted after Phase 1 ships).
- **Phase 3+:** Per-app capture via `SCContentSharingPicker`, speaker diarization, LLM auto-titling.
