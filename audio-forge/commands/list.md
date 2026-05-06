---
name: list
description: List audio-forge recordings, optionally filtered by transcription status.
---

# Audio-Forge — List Recordings

You are listing recordings stored under `audio-forge/recordings/`.

## Argument Parsing

```
/audio-forge:list [--status <pending|transcribing|complete|failed>]
```

If a status filter is provided, pass it through to forge-lib.

## Action

Run:

```bash
python forge-lib/forge.py recording list --directory . [--status <status>]
```

Parse the JSON envelope. On success, present the recordings as a table:

```
| ID                  | Title                | Duration | Status     |
|---------------------|----------------------|----------|------------|
| 2026-05-06T143022   | Sprint Standup       | 2m 5s    | complete   |
| ...                 |                      |          |            |
```

If the list is empty, tell the user "No recordings yet — run `/audio-forge:transcribe <id>` after capturing audio, or use the Forge Shell record button (Phase 2)."

## Error Handling

If the CLI returns `success: false`, surface the `error` field verbatim and stop. Do not retry.
