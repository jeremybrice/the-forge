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
