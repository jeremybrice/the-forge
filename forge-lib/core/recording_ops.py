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
import time
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


# ---------- Public API: get + query ----------

def get_recording(file_path: str) -> Dict[str, Any]:
    """Read a single recording's frontmatter from disk.

    Args:
        file_path: Absolute path to the .md file.

    Returns:
        Frontmatter dict with all datetime/date fields normalized to strings.

    Raises:
        RecordingError: If the file is missing or unreadable.
    """
    fp = Path(file_path)
    if not fp.exists():
        raise RecordingError(f"Recording not found: {file_path}")
    try:
        content = fp.read_text(encoding="utf-8")
        fm, _body = frontmatter.parse(content)
        return _normalize_frontmatter_types(fm)
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


# ---------- Public API: update ----------

_IMMUTABLE_FIELDS = {"id", "type", "created"}


def _normalize_frontmatter_types(fm: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce YAML-parsed datetime/date objects back to ISO-format strings.

    yaml.safe_load silently parses bare datetime strings into Python objects.
    The schema expects strings, so we normalize before validation.
    """
    for key, value in fm.items():
        if isinstance(value, datetime):
            fm[key] = value.strftime("%Y-%m-%dT%H:%M:%S")
        elif isinstance(value, date):
            fm[key] = value.strftime("%Y-%m-%d")
    return fm


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

        # Coerce YAML-parsed datetime objects back to strings before applying updates
        fm = _normalize_frontmatter_types(fm)

        for key, value in updates.items():
            if key in _IMMUTABLE_FIELDS:
                continue
            fm[key] = value

        fm["updated"] = date.today().strftime("%Y-%m-%d")

        # transcript_body is a body field, not a frontmatter field. Pop it out
        # before validation so additionalProperties:false doesn't reject it.
        new_transcript_body = fm.pop("transcript_body", None)

        try:
            validator.validate(fm, "recording")
        except validator.ValidationError as e:
            raise RecordingError(f"Validation failed: {e}")

        # Choose the transcript body to render: caller-supplied wins,
        # otherwise extract whatever was in the existing body.
        transcript_body = new_transcript_body if new_transcript_body is not None \
            else _extract_transcript_body(body)

        rendered = _render_template({
            **fm,
            "duration_human": _format_duration_human(fm["duration_seconds"]),
            "transcript_body": transcript_body,
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
    fm = _normalize_frontmatter_types(fm)
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
    fm = _normalize_frontmatter_types(fm)
    fm["transcript_status"] = "failed"
    fm["transcript_error"] = error
    fm["updated"] = date.today().strftime("%Y-%m-%d")
    fp.write_text(_render_template({
        **fm,
        "duration_human": _format_duration_human(fm["duration_seconds"]),
        "transcript_body": "",
    }), encoding="utf-8")
    return fm
