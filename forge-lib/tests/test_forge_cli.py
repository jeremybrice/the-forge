"""Integration tests for forge.py CLI behaviors."""

import json
import subprocess
import sys
from pathlib import Path


def _run_forge_cmd(args):
    """Run forge.py with the provided args and return subprocess result."""
    repo_root = Path(__file__).resolve().parents[1]
    cmd = [sys.executable, "forge.py", *args]
    return subprocess.run(
        cmd,
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_task_create_uses_positional_title_when_data_missing_title(temp_dir):
    """task create should preserve positional title when --data omits title."""
    result = _run_forge_cmd([
        "task",
        "create",
        "Positional Title",
        "--directory",
        str(temp_dir),
        "--data",
        '{"priority": 3, "status": "Open"}',
    ])

    assert result.returncode == 0, result.stderr or result.stdout
    payload = json.loads(result.stdout)
    assert payload["success"] is True
    assert payload["data"]["title"] == "Positional Title"
    assert payload["data"]["filename"] == "task-001.md"


def test_task_create_prefers_data_title_when_provided(temp_dir):
    """task create should respect explicit title in --data."""
    result = _run_forge_cmd([
        "task",
        "create",
        "Positional Title",
        "--directory",
        str(temp_dir),
        "--data",
        '{"title": "JSON Title", "priority": 2, "status": "Open"}',
    ])

    assert result.returncode == 0, result.stderr or result.stdout
    payload = json.loads(result.stdout)
    assert payload["success"] is True
    assert payload["data"]["title"] == "JSON Title"
    assert payload["data"]["filename"] == "task-001.md"


class TestMemoryDecayCLI:
    """Tests for memory decay CLI commands."""

    def test_decay_command_exists(self):
        """forge memory decay should be a valid command."""
        result = _run_forge_cmd(["memory", "decay", "--help"])
        assert result.returncode == 0

    def test_harvest_command_exists(self):
        """forge memory harvest should be a valid command."""
        result = _run_forge_cmd(["memory", "harvest", "--help"])
        assert result.returncode == 0

    def test_triage_report_command_exists(self):
        """forge memory triage-report should be a valid command."""
        result = _run_forge_cmd(["memory", "triage-report", "--help"])
        assert result.returncode == 0

    def test_promote_command_exists(self):
        """forge memory promote should be a valid command."""
        result = _run_forge_cmd(["memory", "promote", "--help"])
        assert result.returncode == 0

    def test_triage_keep_command_exists(self):
        """forge memory triage-keep should be a valid command."""
        result = _run_forge_cmd(["memory", "triage-keep", "--help"])
        assert result.returncode == 0

    def test_triage_archive_command_exists(self):
        """forge memory triage-archive should be a valid command."""
        result = _run_forge_cmd(["memory", "triage-archive", "--help"])
        assert result.returncode == 0

    def test_triage_delete_command_exists(self):
        """forge memory triage-delete should be a valid command."""
        result = _run_forge_cmd(["memory", "triage-delete", "--help"])
        assert result.returncode == 0
