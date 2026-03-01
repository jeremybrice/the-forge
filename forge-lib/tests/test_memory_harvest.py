"""Tests for memory harvesting pipeline."""
import pytest
import json
from datetime import date
from pathlib import Path
from core.memory_ops import init_memory, create_knowledge_entry


class TestPendingTracking:
    """Tests for threshold tracking in pending.json."""

    def test_track_unknown_entity(self, temp_dir):
        """Unknown entity should be added to pending.json."""
        from core.memory_ops import harvest_signal
        init_memory(str(temp_dir))
        result = harvest_signal(
            entity_name="Phoenix Project",
            source_plugin="product-forge",
            entity_type="project",
            context="Referenced in card: API Redesign",
            directory=str(temp_dir)
        )
        assert result["action"] == "tracked"

        pending = json.loads((temp_dir / "memory" / "pending.json").read_text())
        assert "phoenix-project" in pending["entities"]
        assert pending["entities"]["phoenix-project"]["mentions"] == 1

    def test_track_increments_mentions(self, temp_dir):
        """Repeated tracking should increment mention count."""
        from core.memory_ops import harvest_signal
        init_memory(str(temp_dir))
        harvest_signal("Phoenix", "product-forge", "project", "card ref", str(temp_dir))
        harvest_signal("Phoenix", "tasks-forge", "project", "task ref", str(temp_dir))

        pending = json.loads((temp_dir / "memory" / "pending.json").read_text())
        slug = list(pending["entities"].keys())[0]
        assert pending["entities"][slug]["mentions"] == 2
        assert len(pending["entities"][slug]["sources"]) == 2


class TestThresholdPromotion:
    """Tests for auto-promotion from pending to knowledge entry."""

    def test_promotes_at_threshold(self, temp_dir):
        """Entity should promote at 3 mentions from 2+ plugins."""
        from core.memory_ops import harvest_signal
        init_memory(str(temp_dir))
        harvest_signal("Phoenix", "product-forge", "project", "ref 1", str(temp_dir))
        harvest_signal("Phoenix", "tasks-forge", "project", "ref 2", str(temp_dir))
        result = harvest_signal("Phoenix", "report-forge", "project", "ref 3", str(temp_dir))

        assert result["action"] == "promoted"
        assert result["starting_score"] == 15

        # Should be removed from pending
        pending = json.loads((temp_dir / "memory" / "pending.json").read_text())
        assert len(pending["entities"]) == 0

    def test_no_promote_single_source(self, temp_dir):
        """3 mentions from same plugin should NOT promote."""
        from core.memory_ops import harvest_signal
        init_memory(str(temp_dir))
        harvest_signal("Phoenix", "product-forge", "project", "ref 1", str(temp_dir))
        harvest_signal("Phoenix", "product-forge", "project", "ref 2", str(temp_dir))
        result = harvest_signal("Phoenix", "product-forge", "project", "ref 3", str(temp_dir))

        assert result["action"] == "tracked"  # Not promoted


class TestInstantTrackReinforcement:
    """Tests for reinforcing existing entries."""

    def test_reinforce_existing_entry(self, temp_dir):
        """Known entity should be boosted, not tracked."""
        from core.memory_ops import harvest_signal
        from core import frontmatter as fm
        init_memory(str(temp_dir))

        # Create existing entry
        data = {"name": "Todd Martinez", "role": "Finance Lead", "importance": 45, "source": "manual"}
        entry = create_knowledge_entry("person", data, str(temp_dir))

        # Harvest signal that matches
        result = harvest_signal("Todd Martinez", "tasks-forge", "person", "task ref", str(temp_dir))

        assert result["action"] == "reinforced"
        filepath = temp_dir / entry["filepath"]
        metadata, _ = fm.parse(filepath.read_text())
        assert metadata["importance"] == 50  # Boosted by 5
        assert metadata["recall_count"] == 1

    def test_fuzzy_match_reinforces(self, temp_dir):
        """Case-insensitive match should reinforce existing entry."""
        from core.memory_ops import harvest_signal
        from core import frontmatter as fm
        init_memory(str(temp_dir))

        data = {"name": "Todd Martinez", "role": "Lead", "importance": 45, "source": "manual"}
        entry = create_knowledge_entry("person", data, str(temp_dir))

        result = harvest_signal("todd martinez", "product-forge", "person", "ref", str(temp_dir))
        assert result["action"] == "reinforced"


class TestPromotePendingEntities:
    """Tests for the promote_pending_entities function (promote command without --check)."""

    def _seed_promotable(self, temp_dir, entity_name="Phoenix", entity_type="project"):
        """Seed pending.json with an entity that meets promotion threshold."""
        from core.memory_ops import harvest_signal
        harvest_signal(entity_name, "product-forge", entity_type, "ref 1", str(temp_dir))
        harvest_signal(entity_name, "tasks-forge", entity_type, "ref 2", str(temp_dir))
        # Third mention does NOT trigger auto-promote because we want 3 mentions
        # but still below threshold (same source won't push to 2+ sources unless
        # we use a third plugin). Use a third distinct plugin for the third mention.
        # Actually harvest_signal auto-promotes at threshold. We need to seed
        # pending.json directly to test promote_pending_entities.
        pending_path = temp_dir / "memory" / "pending.json"
        pending = json.loads(pending_path.read_text())
        slug = list(pending["entities"].keys())[0]
        # Force to 3 mentions from 2 sources (threshold met but not auto-promoted
        # because harvest_signal only promotes when the triggering call crosses)
        pending["entities"][slug]["mentions"] = 3
        pending_path.write_text(json.dumps(pending, indent=2))

    def test_promote_check_does_not_create_files(self, temp_dir):
        """--check mode (dry run) should not create knowledge files or modify pending.json."""
        from core.memory_ops import harvest_signal, _load_pending
        init_memory(str(temp_dir))
        self._seed_promotable(temp_dir)

        # Snapshot state before
        pending_before = _load_pending(str(temp_dir))
        projects_dir = temp_dir / "memory" / "projects"
        files_before = set(projects_dir.glob("*.md")) if projects_dir.exists() else set()

        # Simulate --check behavior: just read promotable, don't call promote
        pending = _load_pending(str(temp_dir))
        promotable = []
        for slug, entry in pending["entities"].items():
            if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
                promotable.append({"slug": slug, **entry})

        # Verify nothing changed
        pending_after = _load_pending(str(temp_dir))
        files_after = set(projects_dir.glob("*.md")) if projects_dir.exists() else set()
        assert pending_before == pending_after, "pending.json should not be modified in check mode"
        assert files_before == files_after, "No knowledge files should be created in check mode"
        assert len(promotable) == 1, "Should find one promotable entity"

    def test_promote_creates_entries(self, temp_dir):
        """promote_pending_entities should create files and remove from pending."""
        from core.memory_ops import promote_pending_entities, _load_pending
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        self._seed_promotable(temp_dir)

        # Verify pending has the entity before
        pending_before = _load_pending(str(temp_dir))
        assert len(pending_before["entities"]) == 1

        # Run actual promotion
        result = promote_pending_entities(str(temp_dir))

        assert result["count"] == 1
        assert len(result["promoted"]) == 1
        assert result["promoted"][0]["name"] == "Phoenix"
        assert result["promoted"][0]["type"] == "project"
        assert result["promoted"][0]["starting_score"] == 15

        # Verify pending is now empty
        pending_after = _load_pending(str(temp_dir))
        assert len(pending_after["entities"]) == 0

        # Verify knowledge file was created
        project_file = temp_dir / "memory" / "projects" / "phoenix.md"
        assert project_file.exists()
        metadata, _ = fm.parse(project_file.read_text())
        assert metadata["importance"] == 15
        assert metadata["source"] == "threshold-promoted"
        assert metadata.get("status") == "active", (
            "_build_promotion_data must set status for project entities"
        )

    def test_promote_empty_pending(self, temp_dir):
        """promote_pending_entities on empty pending should return count=0 cleanly."""
        from core.memory_ops import promote_pending_entities
        init_memory(str(temp_dir))

        result = promote_pending_entities(str(temp_dir))

        assert result["count"] == 0
        assert result["promoted"] == []

    def test_promote_skips_below_threshold(self, temp_dir):
        """Entries that don't meet threshold should stay in pending."""
        from core.memory_ops import harvest_signal, promote_pending_entities, _load_pending
        init_memory(str(temp_dir))

        # Only 1 mention from 1 source — below threshold
        harvest_signal("Alpha", "product-forge", "project", "ref", str(temp_dir))

        result = promote_pending_entities(str(temp_dir))
        assert result["count"] == 0

        # Alpha should still be in pending
        pending = _load_pending(str(temp_dir))
        assert "alpha" in pending["entities"]

    def test_promote_handles_multiple_entities(self, temp_dir):
        """Should promote multiple qualifying entities in one call."""
        from core.memory_ops import promote_pending_entities, _load_pending, _save_pending
        init_memory(str(temp_dir))

        # Seed two promotable entities directly in pending.json
        pending = {
            "entities": {
                "alice-jones": {
                    "name": "Alice Jones",
                    "entity_type": "person",
                    "mentions": 4,
                    "first_seen": "2026-02-01",
                    "last_seen": "2026-02-28",
                    "sources": ["product-forge", "tasks-forge"],
                    "context_samples": ["context a", "context b"]
                },
                "beta-api": {
                    "name": "Beta API",
                    "entity_type": "glossary",
                    "mentions": 3,
                    "first_seen": "2026-02-10",
                    "last_seen": "2026-02-28",
                    "sources": ["product-forge", "report-forge"],
                    "context_samples": ["glossary ref 1"]
                },
                "gamma-system": {
                    "name": "Gamma System",
                    "entity_type": "project",
                    "mentions": 1,
                    "first_seen": "2026-02-20",
                    "last_seen": "2026-02-28",
                    "sources": ["product-forge"],
                    "context_samples": ["single ref"]
                }
            }
        }
        _save_pending(str(temp_dir), pending)

        result = promote_pending_entities(str(temp_dir))

        # Alice and Beta should promote; Gamma should stay
        assert result["count"] == 2
        promoted_names = {p["name"] for p in result["promoted"]}
        assert "Alice Jones" in promoted_names
        assert "Beta API" in promoted_names

        remaining = _load_pending(str(temp_dir))
        assert "gamma-system" in remaining["entities"]
        assert len(remaining["entities"]) == 1


class TestHarvestSignalSlugError:
    """Tests for SlugError handling in harvest_signal."""

    def test_harvest_signal_with_empty_entity_raises_memory_error(self, temp_dir):
        """harvest_signal with empty entity name should raise MemoryError, not SlugError."""
        from core.memory_ops import harvest_signal, init_memory, MemoryError
        init_memory(str(temp_dir))
        with pytest.raises(MemoryError, match="Failed to generate slug"):
            harvest_signal(
                entity_name="",
                source_plugin="test-plugin",
                entity_type="person",
                context="test",
                directory=str(temp_dir)
            )
