"""Integration test for full memory lifecycle."""
import pytest
import json
from datetime import date, timedelta
from pathlib import Path
from core.memory_ops import (
    init_memory, create_knowledge_entry, harvest_signal,
    run_decay, triage_report, triage_keep, triage_archive,
    triage_delete, boost_entry, _save_boost_tracker
)
from core import frontmatter as fm


class TestFullLifecycle:
    """End-to-end test of the living memory system."""

    def test_harvest_decay_triage_cycle(self, temp_dir):
        """Full cycle: harvest -> decay -> triage -> actions."""
        d = str(temp_dir)
        init_memory(d)

        # 1. Manual remember (high importance)
        manual = create_knowledge_entry("person", {
            "name": "Alice Lead", "role": "Tech Lead",
            "importance": 70, "source": "manual"
        }, d)

        # 2. Harvest signals that promote an entity
        harvest_signal("Phoenix", "product-forge", "project", "card ref", d)
        harvest_signal("Phoenix", "tasks-forge", "project", "task ref", d)
        result = harvest_signal("Phoenix", "report-forge", "project", "report ref", d)
        assert result["action"] == "promoted"

        # 3. Harvest signal that reinforces Alice
        harvest_signal("Alice Lead", "tasks-forge", "person", "task assigned", d)
        alice_meta, _ = fm.parse((temp_dir / manual["filepath"]).read_text())
        assert alice_meta["importance"] == 75  # Boosted by 5
        assert alice_meta["recall_count"] == 1

        # 4. Simulate time passing by backdating last_recalled
        phoenix_files = list((temp_dir / "memory" / "projects").glob("*.md"))
        assert len(phoenix_files) == 1
        phoenix_path = phoenix_files[0]
        content = phoenix_path.read_text()
        meta, body = fm.parse(content)
        meta["last_recalled"] = (date.today() - timedelta(days=65)).isoformat()
        phoenix_path.write_text(fm.dumps(meta, body))

        # 5. Run decay
        decay_result = run_decay(d)
        assert decay_result["entries_decayed"] >= 1

        # Phoenix (started at 15, 65 days inactive) should be at 0 (15-25=0, floored)
        meta, _ = fm.parse(phoenix_path.read_text())
        assert meta["importance"] == 0
        assert meta["lifecycle_status"] == "sunset"

        # 6. Generate triage report
        report = triage_report(d)
        assert report["total"] >= 1

        # 7. Execute triage actions
        phoenix_rel = str(phoenix_path.relative_to(temp_dir))
        triage_archive(phoenix_rel, d)

        # Verify stub left behind
        stub_meta, _ = fm.parse(phoenix_path.read_text())
        assert stub_meta["lifecycle_status"] == "archived"

        # Verify archived copy exists
        archived = temp_dir / "memory" / "archived" / phoenix_path.name
        assert archived.exists()

    def test_manual_create_boost_keep_cycle(self, temp_dir):
        """Manual create -> boost -> keep cycle for a person entry."""
        d = str(temp_dir)
        init_memory(d)

        # Create a person with low importance
        entry = create_knowledge_entry("person", {
            "name": "Bob Developer",
            "role": "Junior Dev",
            "importance": 20,
            "source": "manual"
        }, d)

        filepath = entry["filepath"]

        # Boost twice
        boost_entry(filepath, d)
        boost_entry(filepath, d)

        meta, _ = fm.parse((temp_dir / filepath).read_text())
        assert meta["importance"] == 30  # 20 + 5 + 5
        assert meta["recall_count"] == 2

        # Third boost should be capped (daily cap of 2)
        result = boost_entry(filepath, d)
        assert result["boosted"] is False

        # Backdate and decay to push into probationary/sunset
        meta["last_recalled"] = (date.today() - timedelta(days=100)).isoformat()
        meta.pop("_boosts_today", None)  # Clean up any legacy field
        full_path = temp_dir / filepath
        full_path.write_text(fm.dumps(meta, ""))
        # Clear boost tracker so daily cap resets for the "new day"
        _save_boost_tracker(d, {})

        run_decay(d)
        meta, _ = fm.parse(full_path.read_text())
        # 30 - 45 = 0 (floored), sunset
        assert meta["importance"] == 0
        assert meta["lifecycle_status"] == "sunset"

        # Triage keep should rescue
        rel_path = str(full_path.relative_to(temp_dir))
        triage_keep(rel_path, d)

        meta, _ = fm.parse(full_path.read_text())
        assert meta["importance"] == 20  # 0 + 20
        assert meta["lifecycle_status"] == "probationary"  # 20 is probationary

    def test_harvest_to_delete_cycle(self, temp_dir):
        """Harvest promotion -> decay -> triage delete."""
        d = str(temp_dir)
        init_memory(d)

        # Promote a glossary term through harvesting
        harvest_signal("TCREI", "rovo-forge", "glossary", "agent building", d)
        harvest_signal("TCREI", "tasks-forge", "glossary", "task context", d)
        result = harvest_signal("TCREI", "report-forge", "glossary", "report mention", d)
        assert result["action"] == "promoted"

        # Find the created file
        glossary_files = list((temp_dir / "memory" / "glossary").glob("*.md"))
        assert len(glossary_files) == 1
        glossary_path = glossary_files[0]

        # Backdate and decay
        content = glossary_path.read_text()
        meta, body = fm.parse(content)
        meta["last_recalled"] = (date.today() - timedelta(days=200)).isoformat()
        glossary_path.write_text(fm.dumps(meta, body))

        run_decay(d)
        meta, _ = fm.parse(glossary_path.read_text())
        assert meta["importance"] == 0  # 15 - 70 = 0, floored
        assert meta["lifecycle_status"] == "sunset"

        # Delete through triage
        rel_path = str(glossary_path.relative_to(temp_dir))
        triage_delete(rel_path, d)
        assert not glossary_path.exists()

    def test_pending_json_cleanup_after_promotion(self, temp_dir):
        """Verify pending.json is cleaned up after promotion."""
        d = str(temp_dir)
        init_memory(d)

        # Track two entities
        harvest_signal("Alpha", "product-forge", "project", "ref 1", d)
        harvest_signal("Beta", "tasks-forge", "project", "ref 1", d)

        pending_path = temp_dir / "memory" / "pending.json"
        pending = json.loads(pending_path.read_text())
        assert len(pending["entities"]) == 2

        # Promote Alpha
        harvest_signal("Alpha", "tasks-forge", "project", "ref 2", d)
        harvest_signal("Alpha", "report-forge", "project", "ref 3", d)

        pending = json.loads(pending_path.read_text())
        assert "alpha" not in pending["entities"]
        assert "beta" in pending["entities"]

    def test_telemetry_updated_after_decay(self, temp_dir):
        """Verify telemetry.json is updated after decay run."""
        d = str(temp_dir)
        init_memory(d)

        create_knowledge_entry("person", {
            "name": "Telemetry Test",
            "role": "Tester",
            "importance": 50,
            "source": "manual"
        }, d)

        run_decay(d)

        telemetry_path = temp_dir / "memory" / "telemetry.json"
        assert telemetry_path.exists()
        telemetry = json.loads(telemetry_path.read_text())
        assert telemetry["total_entries"] >= 1
        assert telemetry["last_decay_run"] == date.today().isoformat()
        assert "by_status" in telemetry
        assert "by_source" in telemetry
