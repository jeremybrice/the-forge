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
