"""Tests for memory telemetry collection."""
import pytest
import json
from datetime import date
from pathlib import Path
from core.memory_ops import init_memory, create_knowledge_entry


class TestTelemetryUpdate:
    """Tests for telemetry.json updates."""

    def test_decay_updates_telemetry(self, temp_dir):
        """run_decay should update telemetry.json."""
        from core.memory_ops import run_decay
        init_memory(str(temp_dir))
        data = {"name": "Test", "role": "Test", "importance": 50, "source": "manual"}
        create_knowledge_entry("person", data, str(temp_dir))

        run_decay(str(temp_dir))

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists()
        telemetry = json.loads(telemetry_path.read_text())
        assert telemetry["last_decay_run"] == date.today().isoformat()
        assert telemetry["total_entries"] >= 1
        assert "by_status" in telemetry
        assert "by_source" in telemetry

    def test_triage_records_history(self, temp_dir):
        """Triage actions should record to telemetry.json."""
        from core.memory_ops import triage_keep, record_triage_action
        init_memory(str(temp_dir))
        data = {"name": "Triaged", "role": "Test", "importance": 5, "lifecycle_status": "sunset", "source": "auto-matched"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        record_triage_action("kept", str(temp_dir))

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists()
        telemetry = json.loads(telemetry_path.read_text())
        assert len(telemetry.get("triage_history", [])) >= 1

    def test_triage_history_has_no_merged_field(self, temp_dir):
        """Triage history should not contain dead 'merged' field."""
        from core.memory_ops import record_triage_action
        init_memory(str(temp_dir))
        record_triage_action("kept", str(temp_dir))

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        telemetry = json.loads(telemetry_path.read_text())
        today_entry = telemetry["triage_history"][-1]
        assert "merged" not in today_entry


def _create_sunset_entry(temp_dir, name="Sunset Person"):
    """Helper: create a person entry with sunset-level importance."""
    init_memory(str(temp_dir))
    data = {
        "name": name,
        "role": "Test",
        "importance": 5,
        "lifecycle_status": "sunset",
        "source": "auto-matched",
    }
    result = create_knowledge_entry("person", data, str(temp_dir))
    # Return the relative filepath from directory root (e.g. memory/people/sunset-person.md)
    rel = str(Path(result["filepath"]).relative_to(temp_dir))
    return rel


class TestTriageHandlerRecordsTelemetry:
    """Regression tests: triage CLI handlers must call record_triage_action."""

    def test_triage_keep_records_action(self, temp_dir, forge_cli):
        """forge memory triage-keep should record 'kept' in telemetry.json."""
        filepath = _create_sunset_entry(temp_dir, "Keep Me")
        result = forge_cli(
            "memory", "triage-keep",
            filepath,
            "--directory", str(temp_dir),
        )
        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists(), "telemetry.json was not created"
        telemetry = json.loads(telemetry_path.read_text())

        history = telemetry.get("triage_history", [])
        assert len(history) >= 1, "triage_history is empty after triage-keep"

        today_entry = next(
            (e for e in history if e["date"] == date.today().isoformat()), None
        )
        assert today_entry is not None, "No triage_history entry for today"
        assert today_entry["kept"] >= 1, f"kept count is {today_entry['kept']}, expected >= 1"
        assert today_entry["reviewed"] >= 1

    def test_triage_archive_records_action(self, temp_dir, forge_cli):
        """forge memory triage-archive should record 'archived' in telemetry.json."""
        filepath = _create_sunset_entry(temp_dir, "Archive Me")
        result = forge_cli(
            "memory", "triage-archive",
            filepath,
            "--directory", str(temp_dir),
        )
        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists(), "telemetry.json was not created"
        telemetry = json.loads(telemetry_path.read_text())

        history = telemetry.get("triage_history", [])
        assert len(history) >= 1, "triage_history is empty after triage-archive"

        today_entry = next(
            (e for e in history if e["date"] == date.today().isoformat()), None
        )
        assert today_entry is not None, "No triage_history entry for today"
        assert today_entry["archived"] >= 1, f"archived count is {today_entry['archived']}, expected >= 1"
        assert today_entry["reviewed"] >= 1

    def test_triage_delete_records_action(self, temp_dir, forge_cli):
        """forge memory triage-delete should record 'deleted' in telemetry.json."""
        filepath = _create_sunset_entry(temp_dir, "Delete Me")
        result = forge_cli(
            "memory", "triage-delete",
            filepath,
            "--directory", str(temp_dir),
        )
        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists(), "telemetry.json was not created"
        telemetry = json.loads(telemetry_path.read_text())

        history = telemetry.get("triage_history", [])
        assert len(history) >= 1, "triage_history is empty after triage-delete"

        today_entry = next(
            (e for e in history if e["date"] == date.today().isoformat()), None
        )
        assert today_entry is not None, "No triage_history entry for today"
        assert today_entry["deleted"] >= 1, f"deleted count is {today_entry['deleted']}, expected >= 1"
        assert today_entry["reviewed"] >= 1
