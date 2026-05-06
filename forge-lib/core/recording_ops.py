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
