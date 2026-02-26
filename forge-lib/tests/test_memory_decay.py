"""Tests for memory decay engine."""
import pytest
import json
from datetime import date, timedelta
from pathlib import Path
from core.memory_ops import init_memory, create_knowledge_entry


class TestDecayCalculation:
    """Tests for compute_decay function."""

    def test_no_decay_within_grace_period(self):
        """Entries within 30 days of last recall should not decay."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=15))
        assert score == 70

    def test_decay_at_31_days(self):
        """Entries at 31 days should lose 10 points."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=35))
        assert score == 60

    def test_decay_at_65_days(self):
        """Entries at 61-90 days should lose cumulative 25 points."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=65))
        assert score == 45

    def test_decay_at_120_days(self):
        """Entries at 91-180 days should lose cumulative 45 points."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=120))
        assert score == 25

    def test_decay_at_200_days(self):
        """Entries at 180+ days should lose cumulative 70 points."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=200))
        assert score == 0

    def test_decay_floor_at_zero(self):
        """Score should never go below 0."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=15, last_recalled=date.today() - timedelta(days=65))
        assert score == 0

    def test_decay_is_idempotent(self):
        """Same inputs produce same output regardless of when called."""
        from core.memory_ops import compute_decay
        last = date.today() - timedelta(days=50)
        score1 = compute_decay(importance=70, last_recalled=last)
        score2 = compute_decay(importance=70, last_recalled=last)
        assert score1 == score2


class TestLifecycleStatus:
    """Tests for lifecycle status derivation."""

    def test_trusted_status(self):
        """Score >= 40 should be trusted."""
        from core.memory_ops import derive_lifecycle_status
        assert derive_lifecycle_status(40) == "trusted"
        assert derive_lifecycle_status(100) == "trusted"

    def test_probationary_status(self):
        """Score 10-39 should be probationary."""
        from core.memory_ops import derive_lifecycle_status
        assert derive_lifecycle_status(10) == "probationary"
        assert derive_lifecycle_status(39) == "probationary"

    def test_sunset_status(self):
        """Score < 10 should be sunset."""
        from core.memory_ops import derive_lifecycle_status
        assert derive_lifecycle_status(9) == "sunset"
        assert derive_lifecycle_status(0) == "sunset"


class TestRunDecay:
    """Tests for batch decay across all entries."""

    def test_run_decay_updates_entries(self, temp_dir):
        """run_decay should update importance and lifecycle_status in frontmatter."""
        from core.memory_ops import run_decay
        from core import frontmatter as fm
        init_memory(str(temp_dir))

        # Create an entry with old last_recalled
        data = {
            "name": "Stale Person",
            "role": "Old Role",
            "importance": 50,
            "source": "frontmatter",
            "last_recalled": (date.today() - timedelta(days=95)).isoformat(),
        }
        result = create_knowledge_entry("person", data, str(temp_dir))

        # Run decay
        report = run_decay(str(temp_dir))

        # Verify frontmatter was updated
        filepath = temp_dir / result["filepath"]
        content = filepath.read_text()
        metadata, _ = fm.parse(content)
        assert metadata["importance"] == 5  # 50 - 45 (91-180 day cumulative)
        assert metadata["lifecycle_status"] == "sunset"
        assert report["entries_decayed"] >= 1

    def test_run_decay_skips_recent_entries(self, temp_dir):
        """run_decay should not modify entries within grace period."""
        from core.memory_ops import run_decay
        from core import frontmatter as fm
        init_memory(str(temp_dir))

        data = {
            "name": "Fresh Person",
            "role": "New Role",
            "importance": 70,
            "source": "manual",
            "last_recalled": date.today().isoformat(),
        }
        result = create_knowledge_entry("person", data, str(temp_dir))

        report = run_decay(str(temp_dir))

        filepath = temp_dir / result["filepath"]
        content = filepath.read_text()
        metadata, _ = fm.parse(content)
        assert metadata["importance"] == 70
        assert metadata["lifecycle_status"] == "trusted"

    def test_run_decay_returns_summary(self, temp_dir):
        """run_decay should return a summary report."""
        from core.memory_ops import run_decay
        init_memory(str(temp_dir))
        report = run_decay(str(temp_dir))
        assert "entries_scanned" in report
        assert "entries_decayed" in report
        assert "transitions" in report


class TestBoostEntry:
    """Tests for boosting memory entries on recall."""

    def test_boost_increases_score(self, temp_dir):
        """Boost should increase importance by 5."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "Boostable", "role": "Test", "importance": 30, "source": "auto-matched"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_result = boost_entry(result["filepath"], str(temp_dir))

        filepath = temp_dir / result["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert metadata["importance"] == 35
        assert metadata["recall_count"] == 1
        assert metadata["last_recalled"] == date.today().isoformat()
        assert boost_result["boosted"] is True

    def test_boost_caps_at_100(self, temp_dir):
        """Boost should not exceed 100."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "HighScore", "role": "Test", "importance": 98, "source": "manual"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))

        filepath = temp_dir / result["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert metadata["importance"] == 100

    def test_boost_updates_lifecycle_status(self, temp_dir):
        """Boosting a probationary entry past 40 should make it trusted."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "Rising", "role": "Test", "importance": 38, "lifecycle_status": "probationary", "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))

        filepath = temp_dir / result["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert metadata["importance"] == 43
        assert metadata["lifecycle_status"] == "trusted"

    def test_boost_daily_cap(self, temp_dir):
        """Max 2 boosts per entry per day."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "Capped", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))
        boost_entry(result["filepath"], str(temp_dir))
        boost_result = boost_entry(result["filepath"], str(temp_dir))

        filepath = temp_dir / result["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert metadata["importance"] == 40  # Only 2 boosts applied (+10 total)
        assert boost_result["boosted"] is False
        assert boost_result["reason"] == "daily_cap"


class TestTriageReport:
    """Tests for triage report generation."""

    def test_triage_report_finds_sunset_entries(self, temp_dir):
        """Triage report should list sunset entries."""
        from core.memory_ops import triage_report
        init_memory(str(temp_dir))
        data = {
            "name": "Stale Entry",
            "role": "Old",
            "importance": 5,
            "lifecycle_status": "sunset",
            "source": "threshold-promoted",
            "last_recalled": "2025-06-01"
        }
        create_knowledge_entry("person", data, str(temp_dir))

        report = triage_report(str(temp_dir))
        assert len(report["sunset"]) == 1
        assert report["sunset"][0]["name"] == "Stale Entry"

    def test_triage_report_finds_approaching_sunset(self, temp_dir):
        """Triage report should list probationary entries with score 10-15."""
        from core.memory_ops import triage_report
        init_memory(str(temp_dir))
        data = {
            "name": "Fading Entry",
            "role": "Fading",
            "importance": 12,
            "lifecycle_status": "probationary",
            "source": "auto-matched",
            "last_recalled": date.today().isoformat()
        }
        create_knowledge_entry("person", data, str(temp_dir))

        report = triage_report(str(temp_dir))
        assert len(report["approaching_sunset"]) == 1

    def test_triage_report_excludes_healthy_entries(self, temp_dir):
        """Triage report should not list trusted or high probationary entries."""
        from core.memory_ops import triage_report
        init_memory(str(temp_dir))
        data = {
            "name": "Healthy Entry",
            "role": "Healthy",
            "importance": 70,
            "lifecycle_status": "trusted",
            "source": "manual"
        }
        create_knowledge_entry("person", data, str(temp_dir))

        report = triage_report(str(temp_dir))
        assert len(report["sunset"]) == 0
        assert len(report["approaching_sunset"]) == 0


class TestTriageActions:
    """Tests for triage keep, archive, delete actions."""

    def test_keep_boosts_by_20(self, temp_dir):
        """Keep action should boost score by 20 and reset last_recalled."""
        from core.memory_ops import triage_keep
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "Kept", "role": "Test", "importance": 5, "lifecycle_status": "sunset", "source": "auto-matched"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        triage_keep(result["filepath"], str(temp_dir))

        metadata, _ = fm.parse((temp_dir / result["filepath"]).read_text())
        assert metadata["importance"] == 25
        assert metadata["lifecycle_status"] == "probationary"
        assert metadata["last_recalled"] == date.today().isoformat()

    def test_archive_moves_to_archived_dir(self, temp_dir):
        """Archive should move file to memory/archived/ and leave stub."""
        from core.memory_ops import triage_archive
        init_memory(str(temp_dir))
        data = {"name": "Archived", "role": "Test", "importance": 3, "source": "threshold-promoted"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        triage_archive(result["filepath"], str(temp_dir))

        # Original should be a stub
        original = temp_dir / result["filepath"]
        assert original.exists()
        from core import frontmatter as fm
        metadata, _ = fm.parse(original.read_text())
        assert metadata.get("status") == "archived"

        # Archived copy should exist
        archived_path = temp_dir / "memory" / "archived" / Path(result["filepath"]).name
        assert archived_path.exists()

    def test_delete_removes_file(self, temp_dir):
        """Delete should remove the file entirely."""
        from core.memory_ops import triage_delete
        init_memory(str(temp_dir))
        data = {"name": "Deleted", "role": "Test", "importance": 0, "source": "threshold-promoted"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        triage_delete(result["filepath"], str(temp_dir))

        assert not (temp_dir / result["filepath"]).exists()
