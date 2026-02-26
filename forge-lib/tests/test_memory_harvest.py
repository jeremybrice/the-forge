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
