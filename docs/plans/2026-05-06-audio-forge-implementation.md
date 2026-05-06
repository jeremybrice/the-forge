# Audio-Forge Implementation Plan — Phase 1: forge-lib Recording Subcommand

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the deterministic data layer for the new `audio-forge` plugin — a `forge recording` CLI that creates, queries, updates, deletes, transcribes, and prunes recording entities, mirroring the existing `forge session` / `forge report` pattern.

**Architecture:** New `recording` entity in forge-lib with its own JSON schema, Jinja2 template, `recording_ops.py` module, and CLI subcommand. Whisper invocation lives behind a thin subprocess wrapper that emits whisper's `--output_format json` and merges dual-track segments into the markdown body with `**System**:` / `**You**:` labels.

**Tech Stack:** Python 3, `jsonschema` (Draft-07), `jinja2`, `pytest`, OpenAI Whisper (`/opt/homebrew/bin/whisper`). All new code lives under `forge-lib/`; no Tauri, Swift, or JS in this plan.

**Reference:** Design doc at `docs/plans/2026-05-06-audio-forge-design.md`.

**Scope boundary:** This plan ends with a working `forge recording transcribe <id>` workflow that consumes WAVs produced by *any* tool (e.g., QuickTime, BlackHole, manual recording). Plan 2 (`2026-05-07-audio-forge-recorder.md`, drafted after this plan ships) layers the Swift sidecar + Tauri commands + Forge Shell view on top.

---

## File Structure

**Create:**
- `forge-lib/schemas/recording.json` — JSON Schema for the recording entity.
- `forge-lib/templates/recording.md.j2` — Jinja2 template for the recording markdown.
- `forge-lib/core/recording_ops.py` — Operations module (create, get, query, update, delete, transcribe, prune, plus whisper helpers).
- `forge-lib/tests/test_recording_ops.py` — Pytest unit tests for the operations module.
- `forge-lib/tests/fixtures/whisper_system_sample.json` — Golden whisper output (system track) used by the parser test.
- `forge-lib/tests/fixtures/whisper_mic_sample.json` — Golden whisper output (mic track).
- `audio-forge/.claude-plugin/plugin.json` — Plugin manifest.
- `audio-forge/README.md` — Plugin overview, install, troubleshooting.
- `audio-forge/commands/list.md` — `/audio-forge:list` command.
- `audio-forge/commands/transcribe.md` — `/audio-forge:transcribe` command.

**Modify:**
- `forge-lib/core/validator.py:180` — Append `"recording"` to `SUPPORTED_SCHEMAS`.
- `forge-lib/forge.py:24` — Import `recording_ops` (alongside the other ops modules).
- `forge-lib/forge.py:32` — Import `RecordingError` (after the existing error imports).
- `forge-lib/forge.py:37` — Bump `__version__` from `"2.2.1"` to `"2.3.0"`.
- `forge-lib/forge.py` — Add `handle_recording_*` functions and register the `recording` subparser tree.
- `forge-lib/README.md` — Document the new `forge recording` subcommands.
- `CLAUDE.md` — Add `audio-forge` to the plugin table and bump the version footer.
- `README.md` — Add `audio-forge` to the plugin list.

**Test commands (run from `forge-lib/`):**
- `python -m pytest tests/test_recording_ops.py -v` — fast feedback per task.
- `python forge.py recording --help` — CLI sanity check.

---

## Task 1: Add `recording` to validator's supported schemas list

**Files:**
- Modify: `forge-lib/core/validator.py:180-192`
- Test: `forge-lib/tests/test_validator.py`

- [ ] **Step 1: Write the failing test**

Append to `forge-lib/tests/test_validator.py` (do not replace existing tests):

```python
def test_recording_is_supported_schema():
    """recording entity must be in the supported schemas list."""
    from core.validator import is_supported_schema, SUPPORTED_SCHEMAS

    assert is_supported_schema("recording"), \
        "recording schema should be supported"
    assert "recording" in SUPPORTED_SCHEMAS, \
        f"'recording' missing from SUPPORTED_SCHEMAS={SUPPORTED_SCHEMAS}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd forge-lib
python -m pytest tests/test_validator.py::test_recording_is_supported_schema -v
```

Expected: `FAILED` with `AssertionError: recording schema should be supported`.

- [ ] **Step 3: Add `recording` to SUPPORTED_SCHEMAS**

In `forge-lib/core/validator.py`, locate the list around line 180-192 and add `"recording"` as the final entry:

```python
SUPPORTED_SCHEMAS = [
    "initiative",
    "epic",
    "story",
    "intake",
    "checkpoint",
    "decision",
    "release-note",
    "task",
    "session",
    "report",
    "harvest",
    "recording",
]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd forge-lib
python -m pytest tests/test_validator.py::test_recording_is_supported_schema -v
```

Expected: `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/validator.py forge-lib/tests/test_validator.py
git commit -m "feat(forge-lib): register recording schema as supported

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `recording.json` schema

**Files:**
- Create: `forge-lib/schemas/recording.json`
- Test: `forge-lib/tests/test_recording_ops.py` (new file)

- [ ] **Step 1: Write the failing schema-validation tests**

Create `forge-lib/tests/test_recording_ops.py` with the following content:

```python
"""Tests for recording_ops — schema, ops, transcription, prune."""

import json
import pytest
from pathlib import Path

from core import validator


# ---------- Schema tests (Task 2) ----------

def _valid_recording():
    """Return a minimal-but-complete valid recording dict."""
    return {
        "id": "2026-05-06T143022",
        "type": "recording",
        "title": "Untitled Recording",
        "created": "2026-05-06T14:30:22",
        "updated": "2026-05-06",
        "duration_seconds": 42,
        "sources": ["system", "mic"],
        "audio_files": {
            "system": "audio-forge/audio/2026-05-06T143022-system.wav",
            "mic": "audio-forge/audio/2026-05-06T143022-mic.wav",
        },
        "transcript_status": "pending",
        "tags": [],
    }


def test_schema_accepts_complete_recording():
    """A valid recording should pass schema validation."""
    validator.clear_cache()
    validator.validate(_valid_recording(), "recording")


def test_schema_rejects_missing_required_field():
    """Removing a required field must trigger ValidationError."""
    validator.clear_cache()
    data = _valid_recording()
    del data["title"]
    with pytest.raises(validator.ValidationError) as exc:
        validator.validate(data, "recording")
    assert "title" in str(exc.value)


def test_schema_rejects_bad_transcript_status():
    """transcript_status must be one of pending|transcribing|complete|failed."""
    validator.clear_cache()
    data = _valid_recording()
    data["transcript_status"] = "in-progress"
    with pytest.raises(validator.ValidationError) as exc:
        validator.validate(data, "recording")
    assert "transcript_status" in str(exc.value) or "in-progress" in str(exc.value)


def test_schema_rejects_unknown_source():
    """sources items must be system or mic."""
    validator.clear_cache()
    data = _valid_recording()
    data["sources"] = ["system", "speaker"]
    with pytest.raises(validator.ValidationError):
        validator.validate(data, "recording")


def test_schema_rejects_id_pattern_mismatch():
    """id must match YYYY-MM-DDTHHMMSS."""
    validator.clear_cache()
    data = _valid_recording()
    data["id"] = "not-an-id"
    with pytest.raises(validator.ValidationError):
        validator.validate(data, "recording")
```

- [ ] **Step 2: Run tests to verify they fail (schema file missing)**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: All five tests `FAIL` with `ValidationError: Schema file not found: …/schemas/recording.json`.

- [ ] **Step 3: Create the schema file**

Create `forge-lib/schemas/recording.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://theforge.dev/schemas/recording.json",
  "title": "Recording Card Schema",
  "description": "JSON Schema for audio-forge recording entities (audio captures + transcripts)",
  "type": "object",
  "required": [
    "id",
    "type",
    "title",
    "created",
    "updated",
    "duration_seconds",
    "sources",
    "audio_files",
    "transcript_status"
  ],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique recording identifier in YYYY-MM-DDTHHMMSS format",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{6}$"
    },
    "type": {
      "type": "string",
      "const": "recording",
      "description": "Card type identifier"
    },
    "title": {
      "type": "string",
      "description": "Human-readable recording title",
      "minLength": 1,
      "maxLength": 200
    },
    "created": {
      "type": "string",
      "description": "Recording start time in YYYY-MM-DDTHH:MM:SS format",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$"
    },
    "updated": {
      "type": "string",
      "format": "date",
      "description": "Last metadata update date in YYYY-MM-DD format"
    },
    "duration_seconds": {
      "type": "integer",
      "minimum": 0,
      "description": "Recording duration in seconds"
    },
    "sources": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "enum": ["system", "mic"]
      },
      "description": "Audio sources captured in this recording"
    },
    "audio_files": {
      "type": "object",
      "description": "Map of source name to relative WAV path",
      "properties": {
        "system": {"type": "string"},
        "mic": {"type": "string"}
      },
      "additionalProperties": false
    },
    "transcript_status": {
      "type": "string",
      "enum": ["pending", "transcribing", "complete", "failed"]
    },
    "transcript_error": {
      "type": ["string", "null"],
      "description": "Error message when transcript_status is 'failed'"
    },
    "model": {
      "type": ["string", "null"],
      "description": "Whisper model used for transcription (e.g., large-v3-turbo)"
    },
    "language": {
      "type": ["string", "null"],
      "description": "ISO 639-1 language code or whisper auto-detect result"
    },
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "default": []
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: all five schema tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/schemas/recording.json forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): add recording.json schema with validation tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add the recording markdown template

**Files:**
- Create: `forge-lib/templates/recording.md.j2`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing template-render test**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- Template tests (Task 3) ----------

def test_template_renders_pending_recording():
    """Pending status should render the 'not run yet' placeholder."""
    import jinja2
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(Path(__file__).parent.parent / "templates")),
        keep_trailing_newline=True,
    )
    tmpl = env.get_template("recording.md.j2")
    rendered = tmpl.render(
        id="2026-05-06T143022",
        title="Sprint Standup",
        created="2026-05-06T14:30:22",
        updated="2026-05-06",
        duration_seconds=125,
        duration_human="2m 5s",
        sources=["system", "mic"],
        audio_files={
            "system": "audio-forge/audio/2026-05-06T143022-system.wav",
            "mic": "audio-forge/audio/2026-05-06T143022-mic.wav",
        },
        transcript_status="pending",
        transcript_body="",
        transcript_error=None,
        model=None,
        language=None,
        tags=[],
    )
    assert "title: \"Sprint Standup\"" in rendered
    assert "type: recording" in rendered
    assert "transcript_status: pending" in rendered
    assert "## Transcript" in rendered
    assert "Transcription has not been run yet" in rendered


def test_template_renders_complete_recording_with_body():
    """Complete status should embed the transcript_body verbatim."""
    import jinja2
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(Path(__file__).parent.parent / "templates")),
        keep_trailing_newline=True,
    )
    tmpl = env.get_template("recording.md.j2")
    body = "**System** (00:00:01): Hello.\n**You**    (00:00:03): Hi back."
    rendered = tmpl.render(
        id="2026-05-06T143022",
        title="Test",
        created="2026-05-06T14:30:22",
        updated="2026-05-06",
        duration_seconds=10,
        duration_human="10s",
        sources=["system", "mic"],
        audio_files={
            "system": "audio-forge/audio/x-system.wav",
            "mic": "audio-forge/audio/x-mic.wav",
        },
        transcript_status="complete",
        transcript_body=body,
        transcript_error=None,
        model="large-v3-turbo",
        language="en",
        tags=["meeting"],
    )
    assert body in rendered
    assert "model: large-v3-turbo" in rendered
    assert "language: en" in rendered


def test_template_renders_failed_recording_with_error():
    """Failed status should surface the transcript_error string."""
    import jinja2
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(Path(__file__).parent.parent / "templates")),
        keep_trailing_newline=True,
    )
    tmpl = env.get_template("recording.md.j2")
    rendered = tmpl.render(
        id="2026-05-06T143022",
        title="Borked",
        created="2026-05-06T14:30:22",
        updated="2026-05-06",
        duration_seconds=10,
        duration_human="10s",
        sources=["mic"],
        audio_files={"mic": "audio-forge/audio/x-mic.wav"},
        transcript_status="failed",
        transcript_body="",
        transcript_error="whisper: out of memory",
        model="large-v3-turbo",
        language=None,
        tags=[],
    )
    assert "Transcription failed: whisper: out of memory" in rendered
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py::test_template_renders_pending_recording tests/test_recording_ops.py::test_template_renders_complete_recording_with_body tests/test_recording_ops.py::test_template_renders_failed_recording_with_error -v
```

Expected: all three `FAIL` with `jinja2.exceptions.TemplateNotFound: recording.md.j2`.

- [ ] **Step 3: Create the template**

Create `forge-lib/templates/recording.md.j2`:

```
---
id: {{ id }}
type: recording
title: "{{ title }}"
created: {{ created }}
updated: {{ updated }}
duration_seconds: {{ duration_seconds }}
sources:
{%- for src in sources %}
  - {{ src }}
{%- endfor %}
audio_files:
{%- for key, path in audio_files.items() %}
  {{ key }}: {{ path }}
{%- endfor %}
transcript_status: {{ transcript_status }}
{%- if transcript_error %}
transcript_error: "{{ transcript_error }}"
{%- endif %}
{%- if model %}
model: {{ model }}
{%- endif %}
{%- if language %}
language: {{ language }}
{%- endif %}
tags:
{%- if tags and tags|length > 0 %}
{%- for tag in tags %}
  - {{ tag }}
{%- endfor %}
{%- else %}
  []
{%- endif %}
---

# {{ title }}

**Duration:** {{ duration_human }}
**Recorded:** {{ created }}
**Sources:** {{ sources | join(', ') }}
{%- if model %}
**Model:** {{ model }}
{%- endif %}

## Transcript

{% if transcript_status == 'pending' -%}
_Transcription has not been run yet. Run `forge recording transcribe {{ id }}` to generate._
{%- elif transcript_status == 'transcribing' -%}
_Transcription in progress…_
{%- elif transcript_status == 'failed' -%}
_Transcription failed: {{ transcript_error }}_
{%- else -%}
{{ transcript_body }}
{%- endif %}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: all schema (5) + template (3) tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/templates/recording.md.j2 forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): add recording.md.j2 template with status-aware body

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `recording_ops.py` module skeleton — RecordingError + filename generator

**Files:**
- Create: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- recording_ops module tests (Task 4) ----------

def test_recording_error_is_exception():
    """RecordingError is the public error class for the module."""
    from core.recording_ops import RecordingError
    assert issubclass(RecordingError, Exception)


def test_generate_recording_filename_basic(tmp_path):
    """Filename is YYYY-MM-DD-{slug}.md based on title and created date."""
    from datetime import date
    from core.recording_ops import _generate_recording_filename
    name = _generate_recording_filename(
        title="Sprint Standup",
        created_date=date(2026, 5, 6),
        directory=tmp_path,
    )
    assert name == "2026-05-06-sprint-standup.md"


def test_generate_recording_filename_uniqueness_counter(tmp_path):
    """If a file already exists, append -2, -3, … until unique."""
    from datetime import date
    from core.recording_ops import _generate_recording_filename
    (tmp_path / "2026-05-06-sprint-standup.md").write_text("x")
    (tmp_path / "2026-05-06-sprint-standup-2.md").write_text("x")
    name = _generate_recording_filename(
        title="Sprint Standup",
        created_date=date(2026, 5, 6),
        directory=tmp_path,
    )
    assert name == "2026-05-06-sprint-standup-3.md"


def test_format_duration_human():
    """Duration helper produces compact strings."""
    from core.recording_ops import _format_duration_human
    assert _format_duration_human(0) == "0s"
    assert _format_duration_human(45) == "45s"
    assert _format_duration_human(125) == "2m 5s"
    assert _format_duration_human(3725) == "1h 2m 5s"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py::test_recording_error_is_exception tests/test_recording_ops.py::test_generate_recording_filename_basic tests/test_recording_ops.py::test_generate_recording_filename_uniqueness_counter tests/test_recording_ops.py::test_format_duration_human -v
```

Expected: all four `FAIL` with `ModuleNotFoundError: No module named 'core.recording_ops'`.

- [ ] **Step 3: Create the module skeleton**

Create `forge-lib/core/recording_ops.py`:

```python
"""Recording operations for forge-lib.

This module provides operations for the audio-forge plugin: creating,
querying, updating, deleting, transcribing, and pruning recording entities.

Recordings are markdown files with YAML frontmatter stored in
{project}/audio-forge/recordings/. Audio WAV files live in
{project}/audio-forge/audio/. The id is the recording start time in
YYYY-MM-DDTHHMMSS format.
"""

import json
import os
import shutil
import subprocess
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jinja2

from . import frontmatter, index_ops, slug, validator


class RecordingError(Exception):
    """Raised when recording operations fail."""
    pass


# ---------- Constants ----------

VALID_SOURCES = {"system", "mic"}
VALID_TRANSCRIPT_STATUSES = {"pending", "transcribing", "complete", "failed"}

# Path to the whisper binary; overridable via env var for tests / non-Homebrew installs.
DEFAULT_WHISPER_BIN = os.environ.get("FORGE_WHISPER_BIN", "/opt/homebrew/bin/whisper")
DEFAULT_WHISPER_MODEL = os.environ.get("FORGE_WHISPER_MODEL", "large-v3-turbo")


# ---------- Filename + duration helpers ----------

def _generate_recording_filename(
    title: str,
    created_date: date,
    directory: Path,
) -> str:
    """Generate a date-prefixed slug filename, applying a counter if needed.

    Pattern: YYYY-MM-DD-{slug}.md
    On collision: append -2, -3, … until unique.
    """
    base_slug = slug.generate_slug(title)
    date_prefix = created_date.strftime("%Y-%m-%d")
    candidate = f"{date_prefix}-{base_slug}.md"
    counter = 2
    while (directory / candidate).exists():
        candidate = f"{date_prefix}-{base_slug}-{counter}.md"
        counter += 1
    return candidate


def _format_duration_human(seconds: int) -> str:
    """Format seconds as a compact human string: 45s, 2m 5s, 1h 2m 5s."""
    if seconds < 60:
        return f"{seconds}s"
    minutes, secs = divmod(seconds, 60)
    if minutes < 60:
        return f"{minutes}m {secs}s"
    hours, mins = divmod(minutes, 60)
    return f"{hours}h {mins}m {secs}s"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: schema (5) + template (3) + module-skeleton (4) = 12 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): scaffold recording_ops with filename + duration helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `create_recording()` — happy path + validation

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- create_recording tests (Task 5) ----------

def _create_minimal_payload():
    return {
        "id": "2026-05-06T143022",
        "title": "Sprint Standup",
        "created": "2026-05-06T14:30:22",
        "duration_seconds": 125,
        "sources": ["system", "mic"],
        "audio_files": {
            "system": "audio-forge/audio/2026-05-06T143022-system.wav",
            "mic": "audio-forge/audio/2026-05-06T143022-mic.wav",
        },
    }


def test_create_recording_writes_markdown_and_index(tmp_path):
    """Happy path: markdown file is written under audio-forge/recordings/, index entry added."""
    from core.recording_ops import create_recording
    result = create_recording(_create_minimal_payload(), directory=str(tmp_path))

    assert result["success"] is True
    fp = Path(result["file_path"])
    assert fp.exists()
    contents = fp.read_text(encoding="utf-8")
    assert "title: \"Sprint Standup\"" in contents
    assert "type: recording" in contents
    assert "transcript_status: pending" in contents

    index_path = tmp_path / "audio-forge" / "recordings" / "index.json"
    assert index_path.exists()
    index_data = json.loads(index_path.read_text(encoding="utf-8"))
    assert index_data["entries"][0]["title"] == "Sprint Standup"
    assert index_data["entries"][0]["transcript_status"] == "pending"


def test_create_recording_defaults_status_to_pending(tmp_path):
    """transcript_status defaults to 'pending' when not provided."""
    from core.recording_ops import create_recording
    result = create_recording(_create_minimal_payload(), directory=str(tmp_path))
    assert result["recording"]["transcript_status"] == "pending"


def test_create_recording_rejects_invalid_id_format(tmp_path):
    """An id that doesn't match YYYY-MM-DDTHHMMSS must raise RecordingError."""
    from core.recording_ops import create_recording, RecordingError
    payload = _create_minimal_payload()
    payload["id"] = "bad-id"
    with pytest.raises(RecordingError) as exc:
        create_recording(payload, directory=str(tmp_path))
    assert "id" in str(exc.value).lower() or "validation" in str(exc.value).lower()


def test_create_recording_rejects_unknown_source(tmp_path):
    from core.recording_ops import create_recording, RecordingError
    payload = _create_minimal_payload()
    payload["sources"] = ["system", "speaker"]
    with pytest.raises(RecordingError):
        create_recording(payload, directory=str(tmp_path))


def test_create_recording_filename_is_date_slugged(tmp_path):
    """File name follows YYYY-MM-DD-{slug}.md."""
    from core.recording_ops import create_recording
    result = create_recording(_create_minimal_payload(), directory=str(tmp_path))
    assert result["file_path"].endswith("/audio-forge/recordings/2026-05-06-sprint-standup.md")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k create_recording
```

Expected: all five `FAIL` with `ImportError: cannot import name 'create_recording' from 'core.recording_ops'`.

- [ ] **Step 3: Implement `create_recording`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Directory + path helpers ----------

def _recordings_dir(project_root: str) -> Path:
    return Path(project_root) / "audio-forge" / "recordings"


def _audio_dir(project_root: str) -> Path:
    return Path(project_root) / "audio-forge" / "audio"


def _ensure_layout(project_root: str) -> None:
    """Make sure the audio-forge directory tree exists."""
    _recordings_dir(project_root).mkdir(parents=True, exist_ok=True)
    _audio_dir(project_root).mkdir(parents=True, exist_ok=True)


def _render_template(context: Dict[str, Any]) -> str:
    """Render recording.md.j2 with the supplied context."""
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(Path(__file__).parent.parent / "templates")),
        keep_trailing_newline=True,
    )
    tmpl = env.get_template("recording.md.j2")
    return tmpl.render(**context)


# ---------- Public API: create ----------

def create_recording(
    data: Dict[str, Any],
    directory: str,
) -> Dict[str, Any]:
    """Create a new recording markdown file + index entry.

    Args:
        data: Recording fields. Must include id, title, created, duration_seconds,
              sources, audio_files. transcript_status defaults to 'pending'.
        directory: Project root.

    Returns:
        {"success": True, "recording": <frontmatter>, "file_path": <abs path>}
    """
    try:
        _ensure_layout(directory)

        # Build full frontmatter dict with defaults applied
        fm: Dict[str, Any] = {
            "id": data.get("id"),
            "type": "recording",
            "title": data.get("title"),
            "created": data.get("created"),
            "updated": date.today().strftime("%Y-%m-%d"),
            "duration_seconds": data.get("duration_seconds"),
            "sources": data.get("sources", []),
            "audio_files": data.get("audio_files", {}),
            "transcript_status": data.get("transcript_status", "pending"),
            "transcript_error": data.get("transcript_error"),
            "model": data.get("model"),
            "language": data.get("language"),
            "tags": data.get("tags", []),
        }

        # Validate
        try:
            validator.validate(fm, "recording")
        except validator.ValidationError as e:
            raise RecordingError(f"Validation failed: {e}")

        # Filename
        rec_dir = _recordings_dir(directory)
        # Parse the date portion of `created` for the filename prefix
        try:
            created_dt = datetime.strptime(fm["created"], "%Y-%m-%dT%H:%M:%S")
        except (ValueError, TypeError) as e:
            raise RecordingError(f"created must be YYYY-MM-DDTHH:MM:SS: {e}")
        filename = _generate_recording_filename(
            title=fm["title"],
            created_date=created_dt.date(),
            directory=rec_dir,
        )
        filepath = rec_dir / filename

        # Render + write
        body_context = {
            **fm,
            "duration_human": _format_duration_human(fm["duration_seconds"]),
            "transcript_body": "",
        }
        filepath.write_text(_render_template(body_context), encoding="utf-8")

        # Index entry
        entry = {
            "file": filename,
            "type": "recording",
            "title": fm["title"],
            "id": fm["id"],
            "created": fm["created"],
            "updated": fm["updated"],
            "duration_seconds": fm["duration_seconds"],
            "transcript_status": fm["transcript_status"],
        }
        try:
            index_ops.create_index_entry(str(rec_dir), entry, plugin="audio-forge")
        except index_ops.IndexError:
            # Index update is non-fatal: the markdown is the source of truth.
            pass

        return {
            "success": True,
            "recording": fm,
            "file_path": str(filepath),
        }

    except RecordingError:
        raise
    except Exception as e:
        raise RecordingError(f"Failed to create recording: {e}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 17 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): create_recording writes markdown + index entry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `get_recording()` and `query_recordings()`

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- get + query tests (Task 6) ----------

def _seed_recording(tmp_path, title="Untitled", id_="2026-05-06T143022", status="pending"):
    """Helper: create a recording and return its file_path."""
    from core.recording_ops import create_recording
    payload = _create_minimal_payload()
    payload["id"] = id_
    payload["title"] = title
    payload["transcript_status"] = status
    result = create_recording(payload, directory=str(tmp_path))
    return result["file_path"]


def test_get_recording_returns_frontmatter(tmp_path):
    from core.recording_ops import get_recording
    fp = _seed_recording(tmp_path, title="Standup")
    fm = get_recording(fp)
    assert fm["title"] == "Standup"
    assert fm["type"] == "recording"
    assert fm["transcript_status"] == "pending"


def test_get_recording_raises_when_missing(tmp_path):
    from core.recording_ops import get_recording, RecordingError
    with pytest.raises(RecordingError) as exc:
        get_recording(str(tmp_path / "does-not-exist.md"))
    assert "not found" in str(exc.value).lower()


def test_query_recordings_no_filters_returns_all(tmp_path):
    from core.recording_ops import query_recordings
    _seed_recording(tmp_path, title="A", id_="2026-05-06T100000")
    _seed_recording(tmp_path, title="B", id_="2026-05-06T110000")
    _seed_recording(tmp_path, title="C", id_="2026-05-06T120000")
    results = query_recordings(filters=None, directory=str(tmp_path))
    assert len(results) == 3
    titles = {r["title"] for r in results}
    assert titles == {"A", "B", "C"}


def test_query_recordings_filters_by_status(tmp_path):
    from core.recording_ops import query_recordings
    _seed_recording(tmp_path, title="Pending", id_="2026-05-06T100000", status="pending")
    _seed_recording(tmp_path, title="Done", id_="2026-05-06T110000", status="complete")
    _seed_recording(tmp_path, title="Failed", id_="2026-05-06T120000", status="failed")
    results = query_recordings(
        filters={"transcript_status": "complete"},
        directory=str(tmp_path),
    )
    assert len(results) == 1
    assert results[0]["title"] == "Done"


def test_query_recordings_empty_when_no_index(tmp_path):
    from core.recording_ops import query_recordings
    results = query_recordings(filters=None, directory=str(tmp_path))
    assert results == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k "get_recording or query_recordings"
```

Expected: 5 `FAIL` (`cannot import name 'get_recording'`).

- [ ] **Step 3: Implement `get_recording` and `query_recordings`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Public API: get + query ----------

def get_recording(file_path: str) -> Dict[str, Any]:
    """Read a single recording's frontmatter from disk.

    Args:
        file_path: Absolute path to the .md file.

    Returns:
        Frontmatter dict.

    Raises:
        RecordingError: If the file is missing or unreadable.
    """
    fp = Path(file_path)
    if not fp.exists():
        raise RecordingError(f"Recording not found: {file_path}")
    try:
        content = fp.read_text(encoding="utf-8")
        fm, _body = frontmatter.parse(content)
        return fm
    except Exception as e:
        raise RecordingError(f"Failed to read recording: {e}")


def query_recordings(
    filters: Optional[Dict[str, Any]],
    directory: str,
) -> List[Dict[str, Any]]:
    """Query the recordings index with optional filters.

    Supported filters:
        transcript_status: pending|transcribing|complete|failed

    Args:
        filters: Optional dict of field→value.
        directory: Project root.

    Returns:
        List of index entries (possibly empty).
    """
    rec_dir = _recordings_dir(directory)
    try:
        index = index_ops.read_index(str(rec_dir))
    except index_ops.IndexError:
        return []

    entries = index.get("entries", [])
    if not filters:
        return entries

    out = []
    for entry in entries:
        if "transcript_status" in filters and \
                entry.get("transcript_status") != filters["transcript_status"]:
            continue
        out.append(entry)
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 22 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): get_recording + query_recordings with status filter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `update_recording()`

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- update tests (Task 7) ----------

def test_update_recording_modifies_title_and_bumps_updated(tmp_path):
    from core.recording_ops import update_recording, get_recording
    fp = _seed_recording(tmp_path, title="Old Title")
    result = update_recording(fp, {"title": "New Title", "tags": ["meeting", "design"]})
    assert result["recording"]["title"] == "New Title"
    assert result["recording"]["tags"] == ["meeting", "design"]

    on_disk = get_recording(fp)
    assert on_disk["title"] == "New Title"
    assert on_disk["updated"] == date.today().strftime("%Y-%m-%d")


def test_update_recording_blocks_immutable_fields(tmp_path):
    """id, type, created cannot be changed via update."""
    from core.recording_ops import update_recording, get_recording
    from datetime import date
    fp = _seed_recording(tmp_path)
    update_recording(fp, {"id": "2099-01-01T000000", "type": "session", "created": "2099-01-01T00:00:00"})
    on_disk = get_recording(fp)
    assert on_disk["id"] == "2026-05-06T143022"
    assert on_disk["type"] == "recording"
    assert on_disk["created"] == "2026-05-06T14:30:22"


def test_update_recording_updates_index_entry(tmp_path):
    from core.recording_ops import update_recording, query_recordings
    fp = _seed_recording(tmp_path, title="Before")
    update_recording(fp, {"title": "After"})
    entries = query_recordings(filters=None, directory=str(tmp_path))
    assert len(entries) == 1
    assert entries[0]["title"] == "After"


def test_update_recording_raises_when_missing(tmp_path):
    from core.recording_ops import update_recording, RecordingError
    with pytest.raises(RecordingError):
        update_recording(str(tmp_path / "missing.md"), {"title": "x"})
```

Add at the top of the file (only if not present already):

```python
from datetime import date
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k update_recording
```

Expected: 4 `FAIL` (`cannot import name 'update_recording'`).

- [ ] **Step 3: Implement `update_recording`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Public API: update ----------

_IMMUTABLE_FIELDS = {"id", "type", "created"}


def update_recording(
    file_path: str,
    updates: Dict[str, Any],
) -> Dict[str, Any]:
    """Update a recording's frontmatter (in place) and refresh the index.

    Args:
        file_path: Absolute path to the .md file.
        updates: Field→value dict. id/type/created are silently ignored.

    Returns:
        {"success": True, "recording": <updated frontmatter>}
    """
    fp = Path(file_path)
    if not fp.exists():
        raise RecordingError(f"Recording not found: {file_path}")

    try:
        content = fp.read_text(encoding="utf-8")
        fm, body = frontmatter.parse(content)

        for key, value in updates.items():
            if key in _IMMUTABLE_FIELDS:
                continue
            fm[key] = value

        fm["updated"] = date.today().strftime("%Y-%m-%d")

        try:
            validator.validate(fm, "recording")
        except validator.ValidationError as e:
            raise RecordingError(f"Validation failed: {e}")

        # Re-render body so transcript-status-driven sections stay in sync
        rendered = _render_template({
            **fm,
            "duration_human": _format_duration_human(fm["duration_seconds"]),
            "transcript_body": fm.get("transcript_body", "") or _extract_transcript_body(body),
        })
        fp.write_text(rendered, encoding="utf-8")

        # Update index
        rec_dir = fp.parent
        index_updates = {
            "title": fm["title"],
            "updated": fm["updated"],
            "transcript_status": fm["transcript_status"],
            "duration_seconds": fm["duration_seconds"],
        }
        try:
            index_ops.update_index_entry(str(rec_dir), fp.name, index_updates)
        except index_ops.IndexError:
            pass  # Non-fatal: markdown is source of truth

        return {"success": True, "recording": fm}

    except RecordingError:
        raise
    except Exception as e:
        raise RecordingError(f"Failed to update recording: {e}")


def _extract_transcript_body(body: str) -> str:
    """Extract the prose under '## Transcript' from a rendered body, if any.

    Used during update_recording so we don't lose existing transcript text
    when re-rendering the template.
    """
    if not body:
        return ""
    marker = "## Transcript"
    idx = body.find(marker)
    if idx == -1:
        return ""
    after = body[idx + len(marker):].lstrip("\n")
    # Stop at the next H2 if present
    next_h2 = after.find("\n## ")
    if next_h2 != -1:
        after = after[:next_h2]
    return after.rstrip()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 26 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): update_recording with immutable-field guard + index sync

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `delete_recording()` with retention flags

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- delete tests (Task 8) ----------

def _touch_audio_files(tmp_path, fm):
    """Helper: create empty WAV files at the paths referenced in fm.audio_files."""
    paths = []
    for rel in fm["audio_files"].values():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"RIFF")
        paths.append(p)
    return paths


def test_delete_recording_removes_markdown_and_audio_by_default(tmp_path):
    from core.recording_ops import delete_recording, get_recording
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    audios = _touch_audio_files(tmp_path, fm)

    delete_recording(fp, directory=str(tmp_path))

    assert not Path(fp).exists()
    for p in audios:
        assert not p.exists()


def test_delete_recording_keep_audio(tmp_path):
    from core.recording_ops import delete_recording, get_recording
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    audios = _touch_audio_files(tmp_path, fm)

    delete_recording(fp, directory=str(tmp_path), keep_audio=True)

    assert not Path(fp).exists()
    for p in audios:
        assert p.exists()


def test_delete_recording_keep_markdown(tmp_path):
    from core.recording_ops import delete_recording, get_recording
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    audios = _touch_audio_files(tmp_path, fm)

    delete_recording(fp, directory=str(tmp_path), keep_markdown=True)

    assert Path(fp).exists()
    for p in audios:
        assert not p.exists()


def test_delete_recording_removes_index_entry(tmp_path):
    from core.recording_ops import delete_recording, query_recordings
    fp = _seed_recording(tmp_path)
    delete_recording(fp, directory=str(tmp_path))
    entries = query_recordings(filters=None, directory=str(tmp_path))
    assert entries == []


def test_delete_recording_raises_when_missing(tmp_path):
    from core.recording_ops import delete_recording, RecordingError
    with pytest.raises(RecordingError):
        delete_recording(str(tmp_path / "missing.md"), directory=str(tmp_path))
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k delete_recording
```

Expected: 5 `FAIL` (`cannot import name 'delete_recording'`).

- [ ] **Step 3: Implement `delete_recording`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Public API: delete ----------

def delete_recording(
    file_path: str,
    directory: str,
    keep_audio: bool = False,
    keep_markdown: bool = False,
) -> Dict[str, Any]:
    """Remove a recording from disk.

    Args:
        file_path: Absolute path to the .md file.
        directory: Project root (needed to resolve relative audio paths).
        keep_audio: If True, leave the WAV files on disk.
        keep_markdown: If True, leave the .md file on disk.

    Returns:
        {"success": True, "removed": [<paths>]}
    """
    fp = Path(file_path)
    if not fp.exists():
        raise RecordingError(f"Recording not found: {file_path}")

    try:
        content = fp.read_text(encoding="utf-8")
        fm, _body = frontmatter.parse(content)

        removed: List[str] = []

        if not keep_audio:
            for rel_path in fm.get("audio_files", {}).values():
                if not rel_path:
                    continue
                audio_path = Path(directory) / rel_path
                if audio_path.exists():
                    audio_path.unlink()
                    removed.append(str(audio_path))

        if not keep_markdown:
            fp.unlink()
            removed.append(str(fp))

            try:
                index_ops.delete_index_entry(str(fp.parent), fp.name)
            except index_ops.IndexError:
                pass

        return {"success": True, "removed": removed}

    except RecordingError:
        raise
    except Exception as e:
        raise RecordingError(f"Failed to delete recording: {e}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 31 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): delete_recording with keep-audio + keep-markdown flags

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Whisper segment parser

**Files:**
- Create: `forge-lib/tests/fixtures/whisper_system_sample.json`
- Create: `forge-lib/tests/fixtures/whisper_mic_sample.json`
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Create golden whisper-output fixtures**

Create `forge-lib/tests/fixtures/whisper_system_sample.json`:

```json
{
  "text": " Hello everyone welcome to the call. Loud and clear.",
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 2.5,
      "text": " Hello everyone welcome to the call.",
      "tokens": [50364, 2425, 1543, 5126, 281, 264, 818, 13, 50489],
      "temperature": 0.0,
      "avg_logprob": -0.21,
      "compression_ratio": 1.05,
      "no_speech_prob": 0.01
    },
    {
      "id": 1,
      "seek": 0,
      "start": 5.2,
      "end": 6.8,
      "text": " Loud and clear.",
      "tokens": [50489, 24705, 293, 1850, 13, 50569],
      "temperature": 0.0,
      "avg_logprob": -0.18,
      "compression_ratio": 0.92,
      "no_speech_prob": 0.02
    }
  ],
  "language": "en"
}
```

Create `forge-lib/tests/fixtures/whisper_mic_sample.json`:

```json
{
  "text": " Hi can you hear me okay?",
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 3.1,
      "end": 4.9,
      "text": " Hi, can you hear me okay?",
      "tokens": [50364, 2421, 11, 393, 291, 1568, 385, 1392, 30, 50450],
      "temperature": 0.0,
      "avg_logprob": -0.22,
      "compression_ratio": 0.81,
      "no_speech_prob": 0.03
    }
  ],
  "language": "en"
}
```

- [ ] **Step 2: Write the failing parser tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- Whisper parser tests (Task 9) ----------

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_parse_whisper_json_extracts_segments():
    from core.recording_ops import parse_whisper_json
    segments = parse_whisper_json(str(FIXTURE_DIR / "whisper_system_sample.json"))
    assert len(segments) == 2
    assert segments[0] == {"start": 0.0, "end": 2.5, "text": "Hello everyone welcome to the call."}
    assert segments[1] == {"start": 5.2, "end": 6.8, "text": "Loud and clear."}


def test_parse_whisper_json_handles_empty_segments(tmp_path):
    from core.recording_ops import parse_whisper_json
    empty = tmp_path / "empty.json"
    empty.write_text(json.dumps({"text": "", "segments": [], "language": "en"}))
    assert parse_whisper_json(str(empty)) == []


def test_parse_whisper_json_skips_segments_missing_fields(tmp_path):
    from core.recording_ops import parse_whisper_json
    odd = tmp_path / "odd.json"
    odd.write_text(json.dumps({
        "segments": [
            {"start": 0.0, "end": 1.0, "text": " Good."},
            {"start": 1.0, "text": " Missing end — skip me."},
            {"end": 3.0, "text": " Missing start — skip me."},
            {"start": 3.0, "end": 4.0},
            {"start": 4.0, "end": 5.0, "text": " Keeper."},
        ],
        "language": "en",
    }))
    segments = parse_whisper_json(str(odd))
    assert [s["text"] for s in segments] == ["Good.", "Keeper."]


def test_parse_whisper_json_raises_on_missing_file(tmp_path):
    from core.recording_ops import parse_whisper_json, RecordingError
    with pytest.raises(RecordingError):
        parse_whisper_json(str(tmp_path / "nope.json"))
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k parse_whisper
```

Expected: 4 `FAIL` (`cannot import name 'parse_whisper_json'`).

- [ ] **Step 4: Implement `parse_whisper_json`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Whisper segment parsing ----------

def parse_whisper_json(json_path: str) -> List[Dict[str, Any]]:
    """Parse whisper's --output_format json output into a list of segments.

    Each segment dict contains: {start: float, end: float, text: str}.
    Whitespace around text is stripped. Segments missing start, end, or text
    are skipped silently (they would corrupt the merged transcript).
    """
    fp = Path(json_path)
    if not fp.exists():
        raise RecordingError(f"Whisper output file not found: {json_path}")
    try:
        data = json.loads(fp.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise RecordingError(f"Whisper output is not valid JSON: {e}")

    out: List[Dict[str, Any]] = []
    for seg in data.get("segments", []):
        if "start" not in seg or "end" not in seg or "text" not in seg:
            continue
        text = (seg["text"] or "").strip()
        if not text:
            continue
        out.append({
            "start": float(seg["start"]),
            "end": float(seg["end"]),
            "text": text,
        })
    return out
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 35 `PASS`.

- [ ] **Step 6: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py forge-lib/tests/fixtures/whisper_system_sample.json forge-lib/tests/fixtures/whisper_mic_sample.json
git commit -m "feat(forge-lib): parse whisper JSON output into segment list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Dual-track merger

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing merger tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- Track merger tests (Task 10) ----------

def test_format_timestamp():
    from core.recording_ops import _format_timestamp
    assert _format_timestamp(0) == "00:00:00"
    assert _format_timestamp(7) == "00:00:07"
    assert _format_timestamp(67) == "00:01:07"
    assert _format_timestamp(3725) == "01:02:05"
    # Sub-second floats round down
    assert _format_timestamp(7.9) == "00:00:07"


def test_merge_tracks_interleaves_by_start():
    from core.recording_ops import merge_tracks
    system_segs = [
        {"start": 0.0, "end": 2.5, "text": "Hello everyone welcome to the call."},
        {"start": 5.2, "end": 6.8, "text": "Loud and clear."},
    ]
    mic_segs = [
        {"start": 3.1, "end": 4.9, "text": "Hi, can you hear me okay?"},
    ]
    merged = merge_tracks(system_segs, mic_segs)
    expected = (
        "**System** (00:00:00): Hello everyone welcome to the call.\n"
        "**You**    (00:00:03): Hi, can you hear me okay?\n"
        "**System** (00:00:05): Loud and clear."
    )
    assert merged == expected


def test_merge_tracks_only_system():
    from core.recording_ops import merge_tracks
    system_segs = [{"start": 0.0, "end": 2.0, "text": "Solo."}]
    merged = merge_tracks(system_segs, [])
    assert merged == "**System** (00:00:00): Solo."


def test_merge_tracks_only_mic():
    from core.recording_ops import merge_tracks
    mic_segs = [{"start": 0.0, "end": 2.0, "text": "Solo mic."}]
    merged = merge_tracks([], mic_segs)
    assert merged == "**You**    (00:00:00): Solo mic."


def test_merge_tracks_empty():
    from core.recording_ops import merge_tracks
    assert merge_tracks([], []) == ""


def test_merge_tracks_stable_for_same_start():
    """When two segments share a start time, system wins (deterministic order)."""
    from core.recording_ops import merge_tracks
    system_segs = [{"start": 1.0, "end": 2.0, "text": "S"}]
    mic_segs = [{"start": 1.0, "end": 2.0, "text": "M"}]
    merged = merge_tracks(system_segs, mic_segs)
    lines = merged.split("\n")
    assert lines[0].startswith("**System**")
    assert lines[1].startswith("**You**")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k "merge_tracks or format_timestamp"
```

Expected: 6 `FAIL` (`cannot import name 'merge_tracks'`).

- [ ] **Step 3: Implement `merge_tracks` + `_format_timestamp`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Track merging ----------

def _format_timestamp(seconds: float) -> str:
    """Render a float-second offset as HH:MM:SS (rounded down to whole seconds)."""
    total = int(seconds)
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def merge_tracks(
    system_segments: List[Dict[str, Any]],
    mic_segments: List[Dict[str, Any]],
) -> str:
    """Interleave two segment lists by start time and emit a labelled transcript.

    Format per line:
        **System** (HH:MM:SS): <text>
        **You**    (HH:MM:SS): <text>

    System wins ties (stable, deterministic ordering).
    """
    tagged: List[Tuple[float, int, str, str]] = []
    # priority: 0 = system (wins ties), 1 = mic
    for seg in system_segments:
        tagged.append((seg["start"], 0, "**System**", seg["text"]))
    for seg in mic_segments:
        tagged.append((seg["start"], 1, "**You**   ", seg["text"]))

    # Stable sort on (start, priority)
    tagged.sort(key=lambda t: (t[0], t[1]))

    lines = []
    for start, _prio, label, text in tagged:
        ts = _format_timestamp(start)
        lines.append(f"{label} ({ts}): {text}")
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 41 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): merge system+mic segments into labelled transcript

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `transcribe_recording()` orchestrator (mocked subprocess)

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- transcribe tests (Task 11) ----------

from unittest.mock import patch, MagicMock


def _seed_full_recording(tmp_path):
    """Helper: seed a recording AND create stub WAV files at expected paths."""
    from core.recording_ops import create_recording
    payload = _create_minimal_payload()
    create_recording(payload, directory=str(tmp_path))
    # Touch stub WAVs so file existence checks pass
    for rel in payload["audio_files"].values():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"RIFF")
    return payload["id"]


def _fake_whisper_run(json_payload):
    """Build a fake subprocess.run that writes whisper's JSON next to its WAV input."""
    def runner(cmd, *args, **kwargs):
        # cmd = [whisper_bin, audio_path, --model, ..., --output_dir, dir, --output_format, json]
        audio_path = Path(cmd[1])
        out_dir_idx = cmd.index("--output_dir") + 1
        out_dir = Path(cmd[out_dir_idx])
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / (audio_path.stem + ".json")
        out_file.write_text(json.dumps(json_payload))
        return MagicMock(returncode=0, stdout="", stderr="")
    return runner


def test_transcribe_recording_writes_merged_body(tmp_path):
    from core.recording_ops import transcribe_recording, get_recording

    rec_id = _seed_full_recording(tmp_path)

    sys_json = json.loads(
        (FIXTURE_DIR / "whisper_system_sample.json").read_text()
    )
    mic_json = json.loads(
        (FIXTURE_DIR / "whisper_mic_sample.json").read_text()
    )

    call_count = {"n": 0}

    def fake_run(cmd, *args, **kwargs):
        call_count["n"] += 1
        # First call → system track; second → mic
        payload = sys_json if call_count["n"] == 1 else mic_json
        return _fake_whisper_run(payload)(cmd, *args, **kwargs)

    with patch("core.recording_ops.subprocess.run", side_effect=fake_run):
        result = transcribe_recording(rec_id, directory=str(tmp_path))

    assert result["success"] is True
    assert result["recording"]["transcript_status"] == "complete"
    assert result["recording"]["model"] == "large-v3-turbo"

    on_disk = Path(result["file_path"]).read_text(encoding="utf-8")
    assert "**System** (00:00:00): Hello everyone welcome to the call." in on_disk
    assert "**You**    (00:00:03): Hi, can you hear me okay?" in on_disk
    assert "**System** (00:00:05): Loud and clear." in on_disk


def test_transcribe_recording_marks_failed_on_subprocess_error(tmp_path):
    from core.recording_ops import transcribe_recording, get_recording

    rec_id = _seed_full_recording(tmp_path)

    def fail_run(cmd, *args, **kwargs):
        return MagicMock(returncode=1, stdout="", stderr="model load failed")

    with patch("core.recording_ops.subprocess.run", side_effect=fail_run):
        result = transcribe_recording(rec_id, directory=str(tmp_path))

    assert result["success"] is False
    assert result["recording"]["transcript_status"] == "failed"
    assert "model load failed" in (result["recording"]["transcript_error"] or "")


def test_transcribe_recording_missing_whisper_binary(tmp_path, monkeypatch):
    from core.recording_ops import transcribe_recording

    rec_id = _seed_full_recording(tmp_path)
    monkeypatch.setenv("FORGE_WHISPER_BIN", "/nope/does/not/exist")
    # The function reads DEFAULT_WHISPER_BIN at call time, so reload the module
    import importlib
    import core.recording_ops as ro
    importlib.reload(ro)

    result = ro.transcribe_recording(rec_id, directory=str(tmp_path))
    assert result["success"] is False
    assert result["error_code"] == "WHISPER_MISSING"
    assert result["recording"]["transcript_status"] == "failed"


def test_transcribe_recording_records_model_override(tmp_path):
    from core.recording_ops import transcribe_recording

    rec_id = _seed_full_recording(tmp_path)

    sys_json = json.loads(
        (FIXTURE_DIR / "whisper_system_sample.json").read_text()
    )
    mic_json = json.loads(
        (FIXTURE_DIR / "whisper_mic_sample.json").read_text()
    )

    seen_models: List[str] = []
    call_count = {"n": 0}

    def capture_run(cmd, *args, **kwargs):
        call_count["n"] += 1
        # Inspect --model flag
        m_idx = cmd.index("--model") + 1
        seen_models.append(cmd[m_idx])
        payload = sys_json if call_count["n"] == 1 else mic_json
        return _fake_whisper_run(payload)(cmd, *args, **kwargs)

    with patch("core.recording_ops.subprocess.run", side_effect=capture_run):
        transcribe_recording(rec_id, directory=str(tmp_path), model="medium")

    assert seen_models == ["medium", "medium"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k transcribe_recording
```

Expected: 4 `FAIL` (`cannot import name 'transcribe_recording'`).

- [ ] **Step 3: Implement `transcribe_recording`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Public API: transcribe ----------

def transcribe_recording(
    recording_id: str,
    directory: str,
    model: Optional[str] = None,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """Run whisper on each audio track of a recording, merge segments, update markdown.

    On success: transcript_status='complete', body contains merged transcript.
    On failure: transcript_status='failed', transcript_error captures stderr.

    Args:
        recording_id: id field of the recording (YYYY-MM-DDTHHMMSS).
        directory: Project root.
        model: Whisper model override; defaults to FORGE_WHISPER_MODEL env or large-v3-turbo.
        language: ISO 639-1 code; if None whisper auto-detects.

    Returns:
        {
            "success": bool,
            "recording": <updated frontmatter>,
            "file_path": str,
            "error_code": Optional[str],   # "WHISPER_MISSING", "WHISPER_FAILED", etc.
        }
    """
    used_model = model or DEFAULT_WHISPER_MODEL
    fp = _find_recording_by_id(recording_id, directory)

    if not Path(DEFAULT_WHISPER_BIN).exists():
        fm = _set_status_failed(fp, error=f"Whisper binary not found at {DEFAULT_WHISPER_BIN}")
        return {
            "success": False,
            "recording": fm,
            "file_path": str(fp),
            "error_code": "WHISPER_MISSING",
        }

    # Read frontmatter to discover audio files
    fm, _body = frontmatter.parse(fp.read_text(encoding="utf-8"))
    audio_files = fm.get("audio_files", {})

    # Mark transcribing
    fm["transcript_status"] = "transcribing"
    fm["model"] = used_model
    if language:
        fm["language"] = language
    fp.write_text(_render_template({
        **fm,
        "duration_human": _format_duration_human(fm["duration_seconds"]),
        "transcript_body": "",
    }), encoding="utf-8")

    project_root = Path(directory)
    work_dir = project_root / "audio-forge" / ".whisper-work"
    work_dir.mkdir(parents=True, exist_ok=True)

    track_segments: Dict[str, List[Dict[str, Any]]] = {"system": [], "mic": []}
    track_errors: List[str] = []

    try:
        for source_name, rel_path in audio_files.items():
            audio_abs = project_root / rel_path
            if not audio_abs.exists():
                track_errors.append(f"{source_name}: audio file missing at {rel_path}")
                continue

            cmd = [
                DEFAULT_WHISPER_BIN,
                str(audio_abs),
                "--model", used_model,
                "--output_dir", str(work_dir),
                "--output_format", "json",
                "--verbose", "False",
            ]
            if language:
                cmd += ["--language", language]

            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                track_errors.append(f"{source_name}: {proc.stderr.strip() or 'whisper exited non-zero'}")
                continue

            json_out = work_dir / (audio_abs.stem + ".json")
            try:
                track_segments[source_name] = parse_whisper_json(str(json_out))
            except RecordingError as e:
                track_errors.append(f"{source_name}: {e}")
    finally:
        # Cleanup intermediate whisper outputs
        for f in work_dir.glob("*"):
            try:
                f.unlink()
            except OSError:
                pass

    if track_errors and not any(track_segments.values()):
        # Both tracks failed — mark recording as failed
        fm = _set_status_failed(fp, error="; ".join(track_errors))
        return {
            "success": False,
            "recording": fm,
            "file_path": str(fp),
            "error_code": "WHISPER_FAILED",
        }

    body = merge_tracks(track_segments.get("system", []), track_segments.get("mic", []))

    fm["transcript_status"] = "complete"
    fm["transcript_error"] = "; ".join(track_errors) if track_errors else None
    fm["updated"] = date.today().strftime("%Y-%m-%d")
    if not fm.get("language"):
        # Best-effort: pick up language from system track JSON if present
        sys_rel = audio_files.get("system")
        if sys_rel:
            sys_json = work_dir / (Path(sys_rel).stem + ".json")
            if sys_json.exists():
                try:
                    fm["language"] = json.loads(sys_json.read_text())["language"]
                except (json.JSONDecodeError, KeyError, OSError):
                    pass

    rendered = _render_template({
        **fm,
        "duration_human": _format_duration_human(fm["duration_seconds"]),
        "transcript_body": body,
    })
    fp.write_text(rendered, encoding="utf-8")

    # Update index
    try:
        index_ops.update_index_entry(str(fp.parent), fp.name, {
            "transcript_status": fm["transcript_status"],
            "updated": fm["updated"],
        })
    except index_ops.IndexError:
        pass

    return {
        "success": True,
        "recording": fm,
        "file_path": str(fp),
        "error_code": None,
    }


def _find_recording_by_id(recording_id: str, directory: str) -> Path:
    """Look up the .md file path for a given recording id via the index."""
    rec_dir = _recordings_dir(directory)
    try:
        index = index_ops.read_index(str(rec_dir))
    except index_ops.IndexError:
        index = {"entries": []}

    for entry in index.get("entries", []):
        if entry.get("id") == recording_id:
            return rec_dir / entry["file"]
    raise RecordingError(f"Recording id not found: {recording_id}")


def _set_status_failed(fp: Path, error: str) -> Dict[str, Any]:
    """Mark a recording as failed and persist the error message."""
    fm, _body = frontmatter.parse(fp.read_text(encoding="utf-8"))
    fm["transcript_status"] = "failed"
    fm["transcript_error"] = error
    fm["updated"] = date.today().strftime("%Y-%m-%d")
    fp.write_text(_render_template({
        **fm,
        "duration_human": _format_duration_human(fm["duration_seconds"]),
        "transcript_body": "",
    }), encoding="utf-8")
    return fm
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 45 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): transcribe_recording orchestrates whisper + merge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `prune_recordings()`

**Files:**
- Modify: `forge-lib/core/recording_ops.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- prune tests (Task 12) ----------

import os
import time


def _age_audio_files(tmp_path, fm, days_old: int):
    """Helper: backdate the WAVs referenced by a recording."""
    cutoff = time.time() - (days_old * 86400)
    for rel in fm["audio_files"].values():
        p = tmp_path / rel
        if not p.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"RIFF")
        os.utime(p, (cutoff, cutoff))


def test_prune_recordings_removes_old_audio_default(tmp_path):
    from core.recording_ops import prune_recordings, get_recording, _create_minimal_payload  # noqa: F401
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    _age_audio_files(tmp_path, fm, days_old=31)

    result = prune_recordings(directory=str(tmp_path), older_than_days=30)

    assert result["success"] is True
    assert len(result["audio_removed"]) == 2
    # Markdown should still be present
    assert Path(fp).exists()


def test_prune_recordings_keeps_fresh_audio(tmp_path):
    from core.recording_ops import prune_recordings, get_recording
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    _age_audio_files(tmp_path, fm, days_old=10)

    result = prune_recordings(directory=str(tmp_path), older_than_days=30)

    assert result["audio_removed"] == []
    for rel in fm["audio_files"].values():
        assert (tmp_path / rel).exists()


def test_prune_recordings_remove_all_drops_markdown(tmp_path):
    from core.recording_ops import prune_recordings, get_recording
    fp = _seed_recording(tmp_path)
    fm = get_recording(fp)
    _age_audio_files(tmp_path, fm, days_old=31)

    result = prune_recordings(
        directory=str(tmp_path),
        older_than_days=30,
        remove_markdown=True,
    )

    assert not Path(fp).exists()
    assert len(result["markdown_removed"]) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k prune_recordings
```

Expected: 3 `FAIL` (`cannot import name 'prune_recordings'`).

- [ ] **Step 3: Implement `prune_recordings`**

Append to `forge-lib/core/recording_ops.py`:

```python
# ---------- Public API: prune ----------

def prune_recordings(
    directory: str,
    older_than_days: int = 30,
    remove_markdown: bool = False,
) -> Dict[str, Any]:
    """Delete WAV files (and optionally markdown) older than a threshold.

    A WAV is considered prunable when its mtime is older than `older_than_days`.
    Markdown files are only removed when `remove_markdown=True`.
    """
    cutoff = time.time() - (older_than_days * 86400)
    audio_dir = _audio_dir(directory)
    rec_dir = _recordings_dir(directory)

    audio_removed: List[str] = []
    markdown_removed: List[str] = []

    if audio_dir.exists():
        for wav in audio_dir.iterdir():
            if not wav.is_file():
                continue
            if wav.stat().st_mtime <= cutoff:
                wav.unlink()
                audio_removed.append(str(wav))

    if remove_markdown and rec_dir.exists():
        # A recording's markdown is prunable when ALL of its referenced audio files
        # are either absent on disk or older than cutoff. (The markdown's own mtime
        # is misleading because user metadata edits would falsely keep stale recordings.)
        for md in rec_dir.glob("*.md"):
            try:
                fm, _body = frontmatter.parse(md.read_text(encoding="utf-8"))
            except Exception:
                continue
            audio_files = fm.get("audio_files", {}) or {}
            all_old = True
            for rel_path in audio_files.values():
                if not rel_path:
                    continue
                audio_abs = Path(directory) / rel_path
                if audio_abs.exists() and audio_abs.stat().st_mtime > cutoff:
                    all_old = False
                    break
            if not all_old:
                continue
            md.unlink()
            markdown_removed.append(str(md))
            try:
                index_ops.delete_index_entry(str(rec_dir), md.name)
            except index_ops.IndexError:
                pass

    return {
        "success": True,
        "audio_removed": audio_removed,
        "markdown_removed": markdown_removed,
    }
```

Add `import time` at the top of `recording_ops.py` if not already imported (Task 4 included it).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 48 `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-lib/core/recording_ops.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): prune_recordings deletes old WAVs (and optionally md)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Wire CLI subcommands into `forge.py`

**Files:**
- Modify: `forge-lib/forge.py`
- Test: `forge-lib/tests/test_recording_ops.py`

- [ ] **Step 1: Write the failing CLI integration tests**

Append to `forge-lib/tests/test_recording_ops.py`:

```python
# ---------- CLI integration tests (Task 13) ----------

import subprocess as sp


CLI = [
    "python",
    str(Path(__file__).parent.parent / "forge.py"),
]


def _run_cli(*args, cwd=None):
    proc = sp.run(CLI + list(args), capture_output=True, text=True, cwd=cwd)
    return proc


def test_cli_recording_help():
    proc = _run_cli("recording", "--help")
    assert proc.returncode == 0
    out = proc.stdout
    assert "create" in out
    assert "list" in out
    assert "transcribe" in out
    assert "prune" in out


def test_cli_recording_list_empty(tmp_path):
    proc = _run_cli("recording", "list", "--directory", str(tmp_path))
    assert proc.returncode == 0
    payload = json.loads(proc.stdout)
    assert payload["success"] is True
    assert payload["data"]["recordings"] == []


def test_cli_recording_create_writes_file(tmp_path):
    payload_arg = json.dumps({
        "id": "2026-05-06T143022",
        "title": "CLI Test",
        "created": "2026-05-06T14:30:22",
        "duration_seconds": 10,
        "sources": ["mic"],
        "audio_files": {"mic": "audio-forge/audio/2026-05-06T143022-mic.wav"},
    })
    proc = _run_cli(
        "recording", "create",
        "--directory", str(tmp_path),
        "--data", payload_arg,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["success"] is True
    assert Path(payload["data"]["file_path"]).exists()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v -k cli_recording
```

Expected: 3 `FAIL` (CLI doesn't yet have a `recording` subparser; `--help` lists no such command).

- [ ] **Step 3: Wire `recording_ops` into `forge.py`**

In `forge-lib/forge.py`, locate the import block at the top of the file (line 24) and add `recording_ops` to the existing import:

```python
from core import (
    card_ops,
    index_ops,
    relationship_ops,
    memory_ops,
    task_ops,
    session_ops,
    report_ops,
    agent_ops,
    harvest_ops,
    recording_ops,
    frontmatter,
)
```

Below the existing error imports (around line 32), add:

```python
from core.recording_ops import RecordingError
```

Bump the version on line 37:

```python
__version__ = "2.3.0"
```

- [ ] **Step 4: Add `handle_recording_*` functions**

Find the location just before the bottom-of-file argparse section in `forge.py` (after the last existing `handle_*` function). Add the following block:

```python
# ---------- Recording handlers ----------

def handle_recording_create(args):
    """Create a new recording entity from a JSON payload."""
    try:
        if not args.data:
            output_json(None, success=False, error="--data is required for recording create")
            sys.exit(EXIT_ERROR)
        data = json.loads(args.data)
        result = recording_ops.create_recording(data, directory=args.directory)
        output_json(result)
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_recording_list(args):
    """List recordings, optionally filtered by transcript_status."""
    try:
        filters = {}
        if getattr(args, "status", None):
            filters["transcript_status"] = args.status
        results = recording_ops.query_recordings(filters or None, directory=args.directory)
        output_json({"recordings": results, "count": len(results)})
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_recording_get(args):
    """Get a single recording by file path."""
    try:
        result = recording_ops.get_recording(args.file_path)
        output_json({"recording": result})
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)


def handle_recording_update(args):
    """Update a recording's metadata."""
    try:
        if not args.data:
            output_json(None, success=False, error="--data is required for recording update")
            sys.exit(EXIT_ERROR)
        updates = json.loads(args.data)
        result = recording_ops.update_recording(args.file_path, updates)
        output_json(result)
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)


def handle_recording_delete(args):
    """Delete a recording (markdown + audio by default)."""
    try:
        result = recording_ops.delete_recording(
            args.file_path,
            directory=args.directory,
            keep_audio=args.keep_audio,
            keep_markdown=args.keep_markdown,
        )
        output_json(result)
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_recording_transcribe(args):
    """Run whisper on a recording's audio tracks."""
    try:
        result = recording_ops.transcribe_recording(
            args.recording_id,
            directory=args.directory,
            model=args.model,
            language=args.language,
        )
        if result["success"]:
            output_json(result)
        else:
            output_json(result, success=False, error=result["recording"].get("transcript_error"))
            sys.exit(EXIT_ERROR)
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_recording_prune(args):
    """Prune old WAV files (and optionally markdown)."""
    try:
        result = recording_ops.prune_recordings(
            directory=args.directory,
            older_than_days=args.older_than_days,
            remove_markdown=args.remove_markdown,
        )
        output_json(result)
    except RecordingError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
```

- [ ] **Step 5: Register the `recording` subparser tree**

Locate the bottom of `forge-lib/forge.py` where the existing subparsers are defined (search for `session_parser = subparsers.add_parser("session"`). Immediately after the session parser block, insert:

```python
    # ---------- recording ----------
    rec_parser = subparsers.add_parser("recording", help="Recording operations (audio-forge)")
    rec_subparsers = rec_parser.add_subparsers(dest="recording_command", required=True)

    # recording create
    rc_create = rec_subparsers.add_parser("create", help="Create a recording entity")
    rc_create.add_argument("--directory", default=".", help="Project root")
    rc_create.add_argument("--data", required=True, help="JSON payload")
    rc_create.set_defaults(func=handle_recording_create)

    # recording list
    rc_list = rec_subparsers.add_parser("list", help="List recordings")
    rc_list.add_argument("--directory", default=".", help="Project root")
    rc_list.add_argument("--status", choices=["pending", "transcribing", "complete", "failed"])
    rc_list.set_defaults(func=handle_recording_list)

    # recording get
    rc_get = rec_subparsers.add_parser("get", help="Get a recording by file path")
    rc_get.add_argument("file_path")
    rc_get.set_defaults(func=handle_recording_get)

    # recording update
    rc_update = rec_subparsers.add_parser("update", help="Update a recording's metadata")
    rc_update.add_argument("file_path")
    rc_update.add_argument("--data", required=True, help="JSON of fields to update")
    rc_update.set_defaults(func=handle_recording_update)

    # recording delete
    rc_delete = rec_subparsers.add_parser("delete", help="Delete a recording")
    rc_delete.add_argument("file_path")
    rc_delete.add_argument("--directory", default=".", help="Project root")
    rc_delete.add_argument("--keep-audio", action="store_true", help="Keep WAV files")
    rc_delete.add_argument("--keep-markdown", action="store_true", help="Keep markdown file")
    rc_delete.set_defaults(func=handle_recording_delete)

    # recording transcribe
    rc_trans = rec_subparsers.add_parser("transcribe", help="Run whisper on a recording")
    rc_trans.add_argument("recording_id", help="Recording id (YYYY-MM-DDTHHMMSS)")
    rc_trans.add_argument("--directory", default=".", help="Project root")
    rc_trans.add_argument("--model", help="Whisper model name (default: large-v3-turbo)")
    rc_trans.add_argument("--language", help="ISO 639-1 language code (default: auto-detect)")
    rc_trans.set_defaults(func=handle_recording_transcribe)

    # recording prune
    rc_prune = rec_subparsers.add_parser("prune", help="Delete old WAV files (and optionally markdown)")
    rc_prune.add_argument("--directory", default=".", help="Project root")
    rc_prune.add_argument("--older-than-days", type=int, default=30)
    rc_prune.add_argument("--remove-markdown", action="store_true", help="Also delete markdown files")
    rc_prune.set_defaults(func=handle_recording_prune)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd forge-lib
python -m pytest tests/test_recording_ops.py -v
```

Expected: 51 `PASS`.

Also run the full test suite to make sure nothing else broke:

```bash
cd forge-lib
python -m pytest -v
```

Expected: every existing test plus the new ones `PASS`.

- [ ] **Step 7: Commit**

```bash
git add forge-lib/forge.py forge-lib/tests/test_recording_ops.py
git commit -m "feat(forge-lib): wire recording subcommand into forge CLI

Adds 'forge recording {create,list,get,update,delete,transcribe,prune}'
subcommands plus version bump to 2.3.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Audio-Forge plugin scaffolding

**Files:**
- Create: `audio-forge/.claude-plugin/plugin.json`
- Create: `audio-forge/README.md`
- Create: `audio-forge/commands/list.md`
- Create: `audio-forge/commands/transcribe.md`

This task is markdown/JSON only — no automated tests. Manual verification at the end.

- [ ] **Step 1: Plugin manifest**

Create `audio-forge/.claude-plugin/plugin.json`:

```json
{
  "name": "audio-forge",
  "version": "2.3.0",
  "description": "Record system audio + microphone on macOS and transcribe with local Whisper. Phase 1 (this version): CLI commands. Phase 2 will add Forge Shell integration.",
  "author": "The Forge Marketplace",
  "commands": ["list", "transcribe"],
  "skills": [],
  "agents": [],
  "data_directory": "audio-forge/recordings"
}
```

- [ ] **Step 2: `/audio-forge:list` command**

Create `audio-forge/commands/list.md`:

```markdown
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
```

- [ ] **Step 3: `/audio-forge:transcribe` command**

Create `audio-forge/commands/transcribe.md`:

```markdown
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
```

- [ ] **Step 4: Plugin README**

Create `audio-forge/README.md`:

```markdown
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

**Transcription is hanging on long inputs** — Apple Silicon's MPS backend occasionally stalls on 1h+ recordings. Re-run with `--model medium` or `--device cpu`.

**Disk usage** — WAVs are ~110 MB/hr/track. Use `forge recording prune --older-than-days 30` to clean up.

## Roadmap

- **Phase 2 (next plan):** Swift sidecar + Tauri integration + Forge Shell view with record button, live VU meter, transcript browser. See `docs/plans/2026-05-07-audio-forge-recorder.md` (drafted after Phase 1 ships).
- **Phase 3+:** Per-app capture via `SCContentSharingPicker`, speaker diarization, LLM auto-titling.
```

- [ ] **Step 5: Manual verification**

```bash
ls audio-forge/
ls audio-forge/.claude-plugin/
ls audio-forge/commands/
cat audio-forge/.claude-plugin/plugin.json
```

Expected: all four files exist; plugin.json is valid JSON.

- [ ] **Step 6: Smoke-test the CLI end-to-end**

```bash
mkdir -p /tmp/audio-forge-smoke
cd /tmp/audio-forge-smoke
python /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-lib/forge.py recording list --directory .
```

Expected output:

```json
{
  "success": true,
  "data": {
    "recordings": [],
    "count": 0
  },
  "error": null
}
```

- [ ] **Step 7: Commit**

```bash
git add audio-forge/
git commit -m "feat(audio-forge): scaffold plugin with list + transcribe commands

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Update root README, CLAUDE.md, and forge-lib README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `forge-lib/README.md`

- [ ] **Step 1: Read the current state of the docs**

```bash
sed -n '1,80p' CLAUDE.md
sed -n '1,40p' README.md
sed -n '1,40p' forge-lib/README.md
```

- [ ] **Step 2: Add `audio-forge` to `CLAUDE.md` plugin table**

In `CLAUDE.md`, locate the table that begins `| Plugin | Primary Commands | Data Location |`. Add the following row at the bottom of that table (just above the `outlook-forge` row already there is fine — alphabetical order is loose in this file):

```markdown
| **audio-forge** | `/audio-forge:list`, `/audio-forge:transcribe` | `audio-forge/recordings/` + `audio-forge/recordings/index.json` |
```

Then update the version footer at the bottom of `CLAUDE.md`. Replace:

```markdown
**v2.2.1** — Cross-cutting documentation, epic jira_card attribute, and status filter panel.
```

with:

```markdown
**v2.3.0** — Audio-forge plugin (Phase 1: CLI for transcribing system+mic WAVs via local Whisper). Phase 2 adds Forge Shell recording UI.
```

- [ ] **Step 3: Add `audio-forge` to `README.md` plugin list**

In `README.md`, find the plugin enumeration / list. Add an `audio-forge` entry that mirrors the others' style. Example (adapt to the existing markdown — read the surrounding lines first):

```markdown
- **audio-forge** — Record system audio + microphone on macOS and transcribe with local Whisper. Phase 1 ships the CLI; the Forge Shell record button arrives in Phase 2.
```

- [ ] **Step 4: Document `recording` subcommand in `forge-lib/README.md`**

In `forge-lib/README.md`, find the section that documents the existing subcommands (`session`, `report`, etc.). Add the following block, matching the existing formatting:

````markdown
### `recording` — Audio recordings (audio-forge plugin)

```bash
forge recording create --directory . --data '<JSON>'
forge recording list --directory . [--status pending|transcribing|complete|failed]
forge recording get <file_path>
forge recording update <file_path> --data '<JSON updates>'
forge recording delete <file_path> --directory . [--keep-audio] [--keep-markdown]
forge recording transcribe <recording_id> --directory . [--model X] [--language en]
forge recording prune --directory . [--older-than-days N] [--remove-markdown]
```

Whisper invocation honours these env vars:

- `FORGE_WHISPER_BIN` — path to the whisper binary (default: `/opt/homebrew/bin/whisper`)
- `FORGE_WHISPER_MODEL` — default model name (default: `large-v3-turbo`)
````

- [ ] **Step 5: Verify**

```bash
grep -n "audio-forge" CLAUDE.md README.md forge-lib/README.md
grep -n "v2.3.0" CLAUDE.md
```

Expected: each grep returns at least one line.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md forge-lib/README.md
git commit -m "docs: register audio-forge plugin and bump version to v2.3.0

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Final integration smoke test

**Files:** None (manual verification only)

- [ ] **Step 1: Run the full forge-lib test suite**

```bash
cd forge-lib
python -m pytest -v
```

Expected: every test passes (existing + 51 new).

- [ ] **Step 2: Manually create + transcribe a recording end-to-end (no UI)**

This requires a small WAV file. Use any existing WAV from your machine, or generate a 5-second silent one:

```bash
mkdir -p /tmp/audio-forge-e2e
cd /tmp/audio-forge-e2e

# Generate a silent stereo 16-bit 48kHz 5s WAV using sox (brew install sox if needed),
# or copy any short WAV you have on hand.
mkdir -p audio-forge/audio
sox -n -r 48000 -c 1 -b 16 audio-forge/audio/2026-05-06T143022-system.wav trim 0.0 5.0
sox -n -r 48000 -c 1 -b 16 audio-forge/audio/2026-05-06T143022-mic.wav trim 0.0 5.0
```

If you don't have `sox`, download or copy any existing 5-second mono 16-bit WAV into those two paths.

Create the recording entity:

```bash
python /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-lib/forge.py recording create \
  --directory . \
  --data '{
    "id": "2026-05-06T143022",
    "title": "End-to-End Smoke Test",
    "created": "2026-05-06T14:30:22",
    "duration_seconds": 5,
    "sources": ["system", "mic"],
    "audio_files": {
      "system": "audio-forge/audio/2026-05-06T143022-system.wav",
      "mic": "audio-forge/audio/2026-05-06T143022-mic.wav"
    }
  }'
```

Expected: JSON envelope with `success: true` and `data.file_path` pointing at the new markdown.

List recordings:

```bash
python /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-lib/forge.py recording list --directory .
```

Expected: one entry returned.

Transcribe (this calls real whisper — may take ~30s on `large-v3-turbo`):

```bash
python /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-lib/forge.py recording transcribe 2026-05-06T143022 --directory .
```

Expected: `success: true`. The markdown body's `## Transcript` section has either an empty merged transcript (silent audio) or a few segments. `transcript_status` is `complete`.

- [ ] **Step 3: Verify the markdown looks correct**

```bash
cat audio-forge/recordings/2026-05-06-end-to-end-smoke-test.md
```

Expected: complete YAML frontmatter, `transcript_status: complete`, model and language fields populated, `## Transcript` section present.

- [ ] **Step 4: Cleanup**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature
rm -rf /tmp/audio-forge-e2e
rm -rf /tmp/audio-forge-smoke
```

- [ ] **Step 5: Final commit (if any docs adjustments came out of the smoke test)**

If the smoke test surfaced documentation gaps or needed tweaks to commands, commit them:

```bash
git status
git add <files>
git commit -m "docs(audio-forge): smoke-test follow-ups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If nothing changed, skip this step.

---

## Self-Review Notes

This plan was self-reviewed against the design spec at `docs/plans/2026-05-06-audio-forge-design.md`. Coverage map:

| Spec section                          | Implementing task(s) |
|---------------------------------------|----------------------|
| Recording schema                      | Task 2               |
| Markdown template                     | Task 3               |
| `recording_ops.py` create/get/query/update/delete | Tasks 5, 6, 7, 8 |
| Whisper segment parsing               | Task 9               |
| Dual-track merger with labels         | Task 10              |
| `transcribe_recording` orchestration  | Task 11              |
| `prune_recordings`                    | Task 12              |
| `forge recording` CLI subcommands     | Task 13              |
| `audio-forge` plugin commands         | Task 14              |
| Documentation + version bump          | Task 15              |
| End-to-end smoke test                 | Task 16              |

Spec sections **not** covered here (intentional — they belong to Plan 2):
- Swift `forge-recorder` sidecar (`SCStream`, `AVAudioEngine`).
- Tauri Rust commands (`audio_commands.rs`, `RecorderState`, `active.json` recovery).
- Forge Shell view (`audio-forge.js`, `audio-forge.css`, PLUGINS array, view container).
- The `/audio-forge:record` command (deferred — requires sidecar).

These are tracked in the design's component list and will be picked up in `2026-05-07-audio-forge-recorder.md` once Phase 1 lands.
