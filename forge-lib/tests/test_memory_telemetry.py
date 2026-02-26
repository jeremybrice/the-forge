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
