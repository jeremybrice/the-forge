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
