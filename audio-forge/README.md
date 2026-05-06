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
