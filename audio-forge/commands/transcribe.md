---
name: transcribe
description: Run Whisper on an existing recording's audio tracks and merge segments into the markdown body.
---

# Audio-Forge — Transcribe Recording

You are running speech-to-text on the audio tracks of a recording that already exists in `audio-forge/recordings/`. Whisper produces per-segment timestamps; the forge-lib merger interleaves system + mic tracks into a single labelled transcript.

## Argument Parsing

```
/audio-forge:transcribe <recording-id> [--model <name>] [--language <iso-639-1>]
```

- `<recording-id>` (required): the `id` from the recording's frontmatter, format `YYYY-MM-DDTHHMMSS`.
- `--model`: override the default whisper model (default: `large-v3-turbo`).
- `--language`: skip whisper auto-detection by passing a language code (e.g., `en`, `de`).

If no id is supplied, ask the user which recording to transcribe and offer the result of `/audio-forge:list --status pending` as suggestions.

## Pre-flight

Confirm `/opt/homebrew/bin/whisper` exists. If not, tell the user:

> Whisper isn't installed at `/opt/homebrew/bin/whisper`. Install with `brew install openai-whisper` (or set `FORGE_WHISPER_BIN` to your install path).

Do not run the transcribe command if the binary is missing.

## Action

Run:

```bash
python forge-lib/forge.py recording transcribe <recording-id> --directory . [--model <name>] [--language <code>]
```

This may take **30 seconds to several minutes** depending on the recording length and model. Surface a "Running whisper on track 1 of 2..." progress note while waiting.

On success, the markdown file's `## Transcript` section contains the merged dual-track output. Confirm completion to the user with the file path and a 5-line preview of the transcript body.

## Error Handling

| Error code        | Action                                                                 |
|-------------------|------------------------------------------------------------------------|
| `WHISPER_MISSING` | Surface the install hint above; do not retry.                          |
| `WHISPER_FAILED`  | Surface the `transcript_error` field verbatim. Suggest re-running with `--model medium` if `large-v3-turbo` is the cause. |
| Anything else     | Surface the `error` field verbatim.                                    |

The recording's `transcript_status` is set to `failed` on errors; running `/audio-forge:transcribe` again will retry from scratch.
