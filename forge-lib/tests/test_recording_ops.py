"""Tests for recording_ops — schema, ops, transcription, prune."""

import json
import pytest
from datetime import date
from pathlib import Path
from typing import List

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


def test_update_recording_accepts_transcript_body_without_validation_error(tmp_path):
    """transcript_body is a body field, not frontmatter — passing it must not break validation."""
    from core.recording_ops import update_recording, get_recording
    fp = _seed_recording(tmp_path, title="Standup")
    result = update_recording(fp, {
        "transcript_status": "complete",
        "transcript_body": "**System** (00:00:01): hello.\n**You**    (00:00:02): hi.",
    })
    assert result["success"] is True
    # frontmatter should NOT contain transcript_body
    assert "transcript_body" not in result["recording"]
    # but the body on disk should
    on_disk = Path(fp).read_text(encoding="utf-8")
    assert "**System** (00:00:01): hello." in on_disk
    assert "**You**    (00:00:02): hi." in on_disk
    # status was bumped
    fm = get_recording(fp)
    assert fm["transcript_status"] == "complete"


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

    # Reload with the original env restored so subsequent tests see the real binary path.
    monkeypatch.delenv("FORGE_WHISPER_BIN", raising=False)
    importlib.reload(ro)


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
