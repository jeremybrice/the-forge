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

    def test_decay_at_exactly_30_days(self):
        """Exactly 30 days should still be in grace period (no decay)."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=30))
        assert score == 70

    def test_decay_at_exactly_31_days(self):
        """Exactly 31 days should receive -10 penalty."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=31))
        assert score == 60

    def test_decay_at_exactly_60_days(self):
        """Exactly 60 days should receive -10 penalty (still in 31-60 window)."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=60))
        assert score == 60

    def test_decay_at_exactly_61_days(self):
        """Exactly 61 days should receive -25 penalty."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=61))
        assert score == 45

    def test_decay_at_exactly_90_days(self):
        """Exactly 90 days should receive -25 penalty (still in 61-90 window)."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=90))
        assert score == 45

    def test_decay_at_exactly_91_days(self):
        """Exactly 91 days should receive -45 penalty."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=91))
        assert score == 25

    def test_decay_at_exactly_180_days(self):
        """Exactly 180 days should receive -45 penalty (still in 91-180 window)."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=180))
        assert score == 25

    def test_decay_at_exactly_181_days(self):
        """Exactly 181 days should receive -70 penalty."""
        from core.memory_ops import compute_decay
        score = compute_decay(importance=70, last_recalled=date.today() - timedelta(days=181))
        assert score == 0


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


class TestDecayEngine:
    """Tests for decay engine behavior with edge-case entry states."""

    def test_decay_processes_project_with_archived_status(self, temp_dir):
        """A project entry with status='archived' (project state) should still decay."""
        from core.memory_ops import run_decay, init_memory
        from core import frontmatter as fm
        from datetime import date, timedelta
        init_memory(str(temp_dir))

        projects_dir = temp_dir / "memory" / "projects"
        projects_dir.mkdir(parents=True, exist_ok=True)
        old_date = (date.today() - timedelta(days=60)).isoformat()
        metadata = {
            "name": "Old Project",
            "type": "project",
            "status": "archived",
            "importance": 50,
            "lifecycle_status": "trusted",
            "last_recalled": old_date,
            "created": old_date,
            "updated": old_date
        }
        (projects_dir / "old-project.md").write_text(
            fm.dumps(metadata, "\nAn archived project.\n")
        )

        result = run_decay(directory=str(temp_dir))
        assert result["entries_decayed"] >= 1, (
            "Project with status='archived' (project state) should still be decayed"
        )


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

    def test_boost_does_not_write_boosts_today_to_frontmatter(self, temp_dir):
        """_boosts_today must NOT appear in entry frontmatter after boosting."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "CleanFM", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))

        filepath = temp_dir / result["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert "_boosts_today" not in metadata, \
            "_boosts_today should not be written to frontmatter (schema conflict)"

    def test_boost_creates_tracker_file(self, temp_dir):
        """Boosting should create memory/.boost-tracker.json with correct structure."""
        from core.memory_ops import boost_entry
        init_memory(str(temp_dir))
        data = {"name": "Tracked", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))

        tracker_path = temp_dir / "memory" / ".boost-tracker.json"
        assert tracker_path.exists(), "Boost tracker file should be created"

        tracker = json.loads(tracker_path.read_text())
        today = date.today().isoformat()
        assert result["filepath"] in tracker, "Tracker should have an entry for the boosted file"
        assert tracker[result["filepath"]][today] == 1, "First boost count should be 1"

    def test_boost_tracker_increments_correctly(self, temp_dir):
        """Tracker should increment boost count per file per day."""
        from core.memory_ops import boost_entry
        init_memory(str(temp_dir))
        data = {"name": "Counter", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        boost_entry(result["filepath"], str(temp_dir))
        boost_entry(result["filepath"], str(temp_dir))

        tracker_path = temp_dir / "memory" / ".boost-tracker.json"
        tracker = json.loads(tracker_path.read_text())
        today = date.today().isoformat()
        assert tracker[result["filepath"]][today] == 2, "Second boost count should be 2"

    def test_boost_tracker_cleans_old_dates(self, temp_dir):
        """Tracker should only keep today's date entries, removing stale dates."""
        from core.memory_ops import boost_entry, _save_boost_tracker
        init_memory(str(temp_dir))
        data = {"name": "StaleTrack", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        # Pre-populate tracker with a stale date entry
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        _save_boost_tracker(str(temp_dir), {
            result["filepath"]: {yesterday: 2}
        })

        # Boost today -- the old entry should be cleaned up
        boost_entry(result["filepath"], str(temp_dir))

        tracker_path = temp_dir / "memory" / ".boost-tracker.json"
        tracker = json.loads(tracker_path.read_text())
        today = date.today().isoformat()

        file_entry = tracker[result["filepath"]]
        assert yesterday not in file_entry, "Old date entries should be cleaned up"
        assert file_entry[today] == 1, "Today's count should be 1"

    def test_boost_strips_legacy_boosts_today_from_frontmatter(self, temp_dir):
        """If an entry has _boosts_today from old code, boost should strip it."""
        from core.memory_ops import boost_entry
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {"name": "Legacy", "role": "Test", "importance": 30, "source": "frontmatter"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        # Manually inject legacy _boosts_today field
        filepath = temp_dir / result["filepath"]
        metadata, body = fm.parse(filepath.read_text())
        metadata["_boosts_today"] = 1
        filepath.write_text(fm.dumps(metadata, body))

        # Verify it was injected
        metadata2, _ = fm.parse(filepath.read_text())
        assert "_boosts_today" in metadata2

        # Boost should strip the legacy field
        boost_entry(result["filepath"], str(temp_dir))

        metadata3, _ = fm.parse(filepath.read_text())
        assert "_boosts_today" not in metadata3, \
            "Legacy _boosts_today should be stripped from frontmatter on boost"


class TestRunDecayArchived:
    """Tests that run_decay skips archived entry stubs."""

    def test_run_decay_skips_archived_stubs(self, temp_dir):
        """Archived stubs should not be scanned or mutated by decay."""
        init_memory(str(temp_dir))
        data = {"name": "Archived Person", "role": "Tester", "importance": 5, "source": "threshold-promoted"}
        result = create_knowledge_entry("person", data, str(temp_dir))

        # Manually create an archived stub (as triage_archive would)
        entry_path = temp_dir / result["filepath"]
        from core import frontmatter as fm
        stub_metadata = {
            "name": "Archived Person",
            "type": "person",
            "lifecycle_status": "archived",
            "archived_date": "2026-01-01",
            "archived_to": "memory/archived/archived-person.md"
        }
        entry_path.write_text(fm.dumps(stub_metadata, "\nArchived.\n"))

        # Run decay
        from core.memory_ops import run_decay
        summary = run_decay(str(temp_dir))

        # Verify stub was NOT mutated
        metadata, _ = fm.parse(entry_path.read_text())
        assert metadata.get("lifecycle_status") == "archived"
        assert metadata.get("archived_to") == "memory/archived/archived-person.md"
        assert "importance" not in metadata  # stub should not have importance added

        # Archived stubs must not appear in all_entries (feeds telemetry/triage)
        archived_in_results = [
            e for e in summary["all_entries"]
            if e["metadata"].get("lifecycle_status") == "archived"
        ]
        assert len(archived_in_results) == 0, \
            "Archived stubs should be excluded from all_entries"

    def test_run_decay_excludes_archived_from_scanned_count(self, temp_dir):
        """entries_scanned should not count archived stubs."""
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        create_knowledge_entry("person", {
            "name": "Active Person", "role": "Dev",
            "importance": 50, "source": "manual"
        }, str(temp_dir))
        # Create an archived stub
        stub_path = temp_dir / "memory" / "people" / "archived-person.md"
        stub_metadata = {
            "name": "Gone", "type": "person",
            "lifecycle_status": "archived",
            "archived_date": "2026-01-01",
            "archived_to": "memory/archived/archived-person.md"
        }
        stub_path.write_text(fm.dumps(stub_metadata, "\nArchived.\n"))

        from core.memory_ops import run_decay
        result = run_decay(str(temp_dir))
        assert result["entries_scanned"] == 1


class TestArchiveStubSchemaValidation:
    """Archived stubs must validate against their respective schemas."""

    def test_archived_person_stub_validates(self):
        from core import validator
        stub = {
            "name": "Archived Person", "type": "person", "role": "Former Dev",
            "lifecycle_status": "archived",
            "archived_date": "2026-03-01",
            "archived_to": "memory/archived/archived-person.md",
            "created": "2026-01-01", "updated": "2026-03-01",
        }
        validator.validate(stub, "person")

    def test_archived_glossary_stub_validates(self):
        from core import validator
        stub = {
            "term": "Old Term", "type": "glossary", "definition": "Deprecated",
            "lifecycle_status": "archived",
            "archived_date": "2026-03-01",
            "archived_to": "memory/archived/old-term.md",
            "created": "2026-01-01", "updated": "2026-03-01",
        }
        validator.validate(stub, "glossary")

    def test_archived_project_stub_validates(self):
        from core import validator
        stub = {
            "name": "Old Project", "type": "project", "description": "Archived",
            "status": "archived",
            "lifecycle_status": "archived",
            "archived_date": "2026-03-01",
            "archived_to": "memory/archived/old-project.md",
            "created": "2026-01-01", "updated": "2026-03-01",
        }
        validator.validate(stub, "project-memory")


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
        assert metadata.get("lifecycle_status") == "archived"

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


class TestTriageArchiveIndex:
    """Tests that triage_archive removes stale index entries."""

    def test_archive_removes_entry_from_index(self, temp_dir):
        """After archiving, the entry should no longer appear in index.json."""
        init_memory(str(temp_dir))
        data = {"name": "Indexed Person", "role": "Dev", "importance": 5, "source": "threshold-promoted"}
        result = create_knowledge_entry("person", data, str(temp_dir))
        filepath = result["filepath"]

        # Verify entry exists in index before archive
        from core.memory_ops import query_knowledge
        entries_before = query_knowledge(directory=str(temp_dir), filters={"type": "person"})
        names_before = [e.get("name") for e in entries_before]
        assert "Indexed Person" in names_before

        # Archive
        from core.memory_ops import triage_archive
        triage_archive(filepath, str(temp_dir))

        # Verify entry removed from index
        entries_after = query_knowledge(directory=str(temp_dir), filters={"type": "person"})
        names_after = [e.get("name") for e in entries_after]
        assert "Indexed Person" not in names_after
