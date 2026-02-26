# Living Memory System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add passive harvesting, decay lifecycle, and triage curation to forge-memory so knowledge grows organically and self-curates through time-based decay.

**Architecture:** Extend forge-lib `memory_ops.py` with decay, harvest, promote, and triage-report functions. Add new CLI subcommands to `forge.py`. Update schemas with optional lifecycle fields. Add `/memory:triage` command to forge-memory plugin. Update forge-shell memory view with lifecycle visualization.

**Tech Stack:** Python 3 (argparse CLI, frontmatter, Jinja2, JSON schema), JavaScript (forge-shell Tauri app)

**Design doc:** `docs/plans/2026-02-26-living-memory-system-design.md`

---

### Task 1: Update JSON Schemas with Lifecycle Fields

**Files:**
- Modify: `forge-lib/schemas/person.json`
- Modify: `forge-lib/schemas/project-memory.json`
- Modify: `forge-lib/schemas/glossary.json`
- Test: `forge-lib/tests/test_memory_knowledge.py`

**Step 1: Write failing test for lifecycle fields in person schema**

In `forge-lib/tests/test_memory_knowledge.py`, add:

```python
class TestLifecycleFields:
    """Tests for lifecycle fields in knowledge entry schemas."""

    def test_person_accepts_lifecycle_fields(self, temp_dir):
        """Person schema accepts optional lifecycle fields."""
        from core.memory_ops import create_knowledge_entry, init_memory
        init_memory(str(temp_dir))
        data = {
            "name": "Jane Smith",
            "role": "Engineer",
            "team": "Platform",
            "importance": 70,
            "lifecycle_status": "trusted",
            "source": "manual",
            "last_recalled": "2026-02-26",
            "recall_count": 0
        }
        result = create_knowledge_entry("person", data, str(temp_dir))
        assert result["name"] == "Jane Smith"

    def test_person_defaults_lifecycle_fields(self, temp_dir):
        """Person schema provides defaults for lifecycle fields."""
        from core.memory_ops import create_knowledge_entry, init_memory
        init_memory(str(temp_dir))
        data = {"name": "Bob Jones", "role": "Manager"}
        result = create_knowledge_entry("person", data, str(temp_dir))
        # Should succeed without lifecycle fields (they have defaults)
        assert result["name"] == "Bob Jones"

    def test_lifecycle_status_enum_validation(self, temp_dir):
        """lifecycle_status must be trusted, probationary, or sunset."""
        from core.memory_ops import create_knowledge_entry, init_memory, MemoryError
        init_memory(str(temp_dir))
        data = {
            "name": "Invalid Status",
            "role": "Test",
            "lifecycle_status": "invalid"
        }
        with pytest.raises(MemoryError):
            create_knowledge_entry("person", data, str(temp_dir))

    def test_source_enum_validation(self, temp_dir):
        """source must be manual, frontmatter, auto-matched, or threshold-promoted."""
        from core.memory_ops import create_knowledge_entry, init_memory, MemoryError
        init_memory(str(temp_dir))
        data = {
            "name": "Invalid Source",
            "role": "Test",
            "source": "invalid"
        }
        with pytest.raises(MemoryError):
            create_knowledge_entry("person", data, str(temp_dir))
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_knowledge.py::TestLifecycleFields -v`
Expected: FAIL — `additionalProperties: false` rejects the new fields

**Step 3: Update person.json schema**

In `forge-lib/schemas/person.json`, add to `properties`:

```json
"importance": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 45
},
"lifecycle_status": {
  "type": "string",
  "enum": ["trusted", "probationary", "sunset"],
  "default": "trusted"
},
"source": {
  "type": "string",
  "enum": ["manual", "frontmatter", "auto-matched", "threshold-promoted"],
  "default": "frontmatter"
},
"last_recalled": {
  "type": ["string", "null"],
  "format": "date",
  "default": null
},
"recall_count": {
  "type": "integer",
  "minimum": 0,
  "default": 0
}
```

**Step 4: Update project-memory.json schema**

Same 5 fields added to `properties` in `forge-lib/schemas/project-memory.json`.

**Step 5: Update glossary.json schema**

Same 5 fields added to `properties` in `forge-lib/schemas/glossary.json`.

**Step 6: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_knowledge.py::TestLifecycleFields -v`
Expected: PASS

**Step 7: Run full memory test suite to verify no regressions**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_knowledge.py tests/test_memory_ops.py -v`
Expected: All existing tests PASS

**Step 8: Commit**

```bash
git add forge-lib/schemas/person.json forge-lib/schemas/project-memory.json forge-lib/schemas/glossary.json forge-lib/tests/test_memory_knowledge.py
git commit -m "feat(memory): add lifecycle fields to knowledge entry schemas"
```

---

### Task 2: Update Templates to Render Lifecycle Fields

**Files:**
- Modify: `forge-lib/templates/person.md.j2`
- Modify: `forge-lib/templates/project-memory.md.j2`
- Modify: `forge-lib/templates/glossary.md.j2`
- Test: `forge-lib/tests/test_memory_knowledge.py`

**Step 1: Write failing test for lifecycle fields in rendered output**

```python
class TestLifecycleRendering:
    """Tests for lifecycle fields in rendered markdown."""

    def test_person_renders_lifecycle_in_frontmatter(self, temp_dir):
        """Person entry includes lifecycle fields in YAML frontmatter."""
        from core.memory_ops import create_knowledge_entry, init_memory
        from core import frontmatter as fm
        init_memory(str(temp_dir))
        data = {
            "name": "Jane Smith",
            "role": "Engineer",
            "importance": 70,
            "source": "manual",
        }
        result = create_knowledge_entry("person", data, str(temp_dir))
        filepath = temp_dir / result["filepath"]
        content = filepath.read_text()
        metadata, _ = fm.parse(content)
        assert metadata["importance"] == 70
        assert metadata["source"] == "manual"
        assert metadata["lifecycle_status"] == "trusted"
        assert metadata["recall_count"] == 0
        assert "last_recalled" in metadata
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_knowledge.py::TestLifecycleRendering -v`
Expected: FAIL — templates don't render lifecycle fields yet

**Step 3: Update person.md.j2**

Add lifecycle fields to the frontmatter section of `forge-lib/templates/person.md.j2`:

```jinja2
importance: {{ importance | default(45) }}
lifecycle_status: {{ lifecycle_status | default('trusted') }}
source: {{ source | default('frontmatter') }}
last_recalled: {{ last_recalled | default(created) }}
recall_count: {{ recall_count | default(0) }}
```

**Step 4: Update project-memory.md.j2**

Same lifecycle fields added to frontmatter in `forge-lib/templates/project-memory.md.j2`.

**Step 5: Update glossary.md.j2**

Same lifecycle fields added to frontmatter in `forge-lib/templates/glossary.md.j2`.

**Step 6: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_knowledge.py::TestLifecycleRendering tests/test_memory_knowledge.py::TestLifecycleFields -v`
Expected: PASS

**Step 7: Commit**

```bash
git add forge-lib/templates/person.md.j2 forge-lib/templates/project-memory.md.j2 forge-lib/templates/glossary.md.j2 forge-lib/tests/test_memory_knowledge.py
git commit -m "feat(memory): render lifecycle fields in knowledge entry templates"
```

---

### Task 3: Implement Decay Engine

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Create: `forge-lib/tests/test_memory_decay.py`

**Step 1: Write failing tests for decay calculation**

Create `forge-lib/tests/test_memory_decay.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py -v`
Expected: FAIL — `compute_decay`, `derive_lifecycle_status`, `run_decay` not defined

**Step 3: Implement compute_decay and derive_lifecycle_status**

Add to `forge-lib/core/memory_ops.py`:

```python
def derive_lifecycle_status(importance: int) -> str:
    """Derive lifecycle status from importance score."""
    if importance >= 40:
        return "trusted"
    elif importance >= 10:
        return "probationary"
    else:
        return "sunset"


def compute_decay(importance: int, last_recalled: date) -> int:
    """Compute decayed importance score based on inactivity period.

    Stepped decay:
      0-30 days:   0 (grace period)
      31-60 days:  -10
      61-90 days:  -15 (cumulative -25)
      91-180 days: -20 (cumulative -45)
      180+ days:   -25 (cumulative -70)

    Returns integer score floored at 0.
    """
    if isinstance(last_recalled, str):
        last_recalled = date.fromisoformat(last_recalled)

    days_inactive = (date.today() - last_recalled).days
    decay = 0

    if days_inactive > 180:
        decay = 70
    elif days_inactive > 90:
        decay = 45
    elif days_inactive > 60:
        decay = 25
    elif days_inactive > 30:
        decay = 10

    return max(0, importance - decay)
```

**Step 4: Run unit tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestDecayCalculation tests/test_memory_decay.py::TestLifecycleStatus -v`
Expected: PASS

**Step 5: Implement run_decay batch function**

Add to `forge-lib/core/memory_ops.py`:

```python
def run_decay(directory: str = ".") -> Dict[str, Any]:
    """Run decay evaluation across all memory knowledge entries.

    Scans memory/people/, memory/projects/, memory/glossary/ for .md files.
    Computes new importance based on last_recalled date.
    Updates frontmatter in place if score changed.
    Returns summary report.
    """
    knowledge_dirs = ["people", "projects", "glossary"]
    base_path = Path(directory)
    entries_scanned = 0
    entries_decayed = 0
    transitions = []

    for subdir in knowledge_dirs:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            entries_scanned += 1
            content = md_file.read_text()
            metadata, body = frontmatter.parse(content)

            importance = metadata.get("importance", 45)
            last_recalled_str = metadata.get("last_recalled", metadata.get("created", date.today().isoformat()))
            old_status = metadata.get("lifecycle_status", "trusted")

            new_score = compute_decay(importance, last_recalled_str)
            new_status = derive_lifecycle_status(new_score)

            if new_score != importance or new_status != old_status:
                entries_decayed += 1
                metadata["importance"] = new_score
                metadata["lifecycle_status"] = new_status
                metadata["updated"] = date.today().isoformat()
                updated_content = frontmatter.dumps(metadata, body)
                md_file.write_text(updated_content)

                if old_status != new_status:
                    transitions.append({
                        "file": str(md_file.relative_to(base_path)),
                        "name": metadata.get("name", metadata.get("term", "")),
                        "from": old_status,
                        "to": new_status,
                        "score": new_score
                    })

    return {
        "entries_scanned": entries_scanned,
        "entries_decayed": entries_decayed,
        "transitions": transitions
    }
```

**Step 6: Run all decay tests**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py -v`
Expected: PASS

**Step 7: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_decay.py
git commit -m "feat(memory): implement decay engine with stepped thresholds"
```

---

### Task 4: Implement Boost Mechanics

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Modify: `forge-lib/tests/test_memory_decay.py`

**Step 1: Write failing tests for boost**

Add to `forge-lib/tests/test_memory_decay.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestBoostEntry -v`
Expected: FAIL — `boost_entry` not defined

**Step 3: Implement boost_entry**

Add to `forge-lib/core/memory_ops.py`:

```python
def boost_entry(filepath: str, directory: str = ".", boost_amount: int = 5) -> Dict[str, Any]:
    """Boost a memory entry's importance score on recall.

    Args:
        filepath: Relative path to the memory entry (e.g., 'memory/people/jane.md')
        directory: Base directory
        boost_amount: Points to add (default 5)

    Returns:
        Dict with boosted (bool), reason (str if not boosted), new_score, new_status
    """
    base_path = Path(directory)
    full_path = base_path / filepath

    if not full_path.exists():
        raise MemoryError(f"Entry not found: {filepath}")

    content = full_path.read_text()
    metadata, body = frontmatter.parse(content)

    today = date.today().isoformat()

    # Check daily cap: max 2 boosts per day
    last_recalled = metadata.get("last_recalled")
    recall_count_today = metadata.get("_boosts_today", 0)

    if last_recalled == today and recall_count_today >= 2:
        return {
            "boosted": False,
            "reason": "daily_cap",
            "score": metadata.get("importance", 45),
            "status": metadata.get("lifecycle_status", "trusted")
        }

    # Reset daily counter if new day
    if last_recalled != today:
        recall_count_today = 0

    importance = metadata.get("importance", 45)
    new_score = min(100, importance + boost_amount)
    new_status = derive_lifecycle_status(new_score)

    metadata["importance"] = new_score
    metadata["lifecycle_status"] = new_status
    metadata["last_recalled"] = today
    metadata["recall_count"] = metadata.get("recall_count", 0) + 1
    metadata["_boosts_today"] = recall_count_today + 1
    metadata["updated"] = today

    updated_content = frontmatter.dumps(metadata, body)
    full_path.write_text(updated_content)

    return {
        "boosted": True,
        "score": new_score,
        "status": new_status
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestBoostEntry -v`
Expected: PASS

**Step 5: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_decay.py
git commit -m "feat(memory): implement boost mechanics with daily cap"
```

---

### Task 5: Implement Harvesting Pipeline

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Create: `forge-lib/tests/test_memory_harvest.py`

**Step 1: Write failing tests for pending.json management**

Create `forge-lib/tests/test_memory_harvest.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py -v`
Expected: FAIL — `harvest_signal` not defined

**Step 3: Implement harvest_signal**

Add to `forge-lib/core/memory_ops.py`:

```python
def _load_pending(directory: str) -> Dict[str, Any]:
    """Load pending.json, creating if needed."""
    pending_path = Path(directory) / "memory" / "pending.json"
    if pending_path.exists():
        return json.loads(pending_path.read_text())
    return {"entities": {}}


def _save_pending(directory: str, pending: Dict[str, Any]) -> None:
    """Save pending.json."""
    pending_path = Path(directory) / "memory" / "pending.json"
    pending_path.parent.mkdir(parents=True, exist_ok=True)
    pending_path.write_text(json.dumps(pending, indent=2))


def _fuzzy_match_entry(entity_name: str, directory: str) -> Optional[Dict[str, Any]]:
    """Fuzzy match entity_name against existing knowledge entries.

    Returns dict with 'filepath' and 'metadata' if match found, None otherwise.
    Case-insensitive exact match on name/term fields.
    """
    base_path = Path(directory)
    name_lower = entity_name.lower().strip()

    for subdir in ["people", "projects", "glossary"]:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            content = md_file.read_text()
            metadata, body = frontmatter.parse(content)
            entry_name = metadata.get("name", metadata.get("term", "")).lower().strip()
            if entry_name == name_lower:
                rel_path = str(md_file.relative_to(base_path))
                return {"filepath": rel_path, "metadata": metadata}

    return None


def harvest_signal(
    entity_name: str,
    source_plugin: str,
    entity_type: str,
    context: str,
    directory: str = "."
) -> Dict[str, Any]:
    """Process a memory signal from a plugin.

    1. Fuzzy-match against existing entries → reinforce (boost)
    2. No match → track in pending.json
    3. If pending threshold crossed (3 mentions, 2+ plugins) → auto-promote

    Returns dict with action: 'reinforced', 'tracked', or 'promoted'
    """
    # Try instant track: reinforce existing entry
    match = _fuzzy_match_entry(entity_name, directory)
    if match:
        boost_result = boost_entry(match["filepath"], directory)
        return {
            "action": "reinforced",
            "filepath": match["filepath"],
            "boosted": boost_result.get("boosted", False),
            "score": boost_result.get("score")
        }

    # Threshold track: add to pending
    pending = _load_pending(directory)
    slug = _generate_slug(entity_name)

    if slug not in pending["entities"]:
        pending["entities"][slug] = {
            "name": entity_name,
            "entity_type": entity_type,
            "mentions": 0,
            "first_seen": date.today().isoformat(),
            "last_seen": date.today().isoformat(),
            "sources": [],
            "context_samples": []
        }

    entry = pending["entities"][slug]
    entry["mentions"] += 1
    entry["last_seen"] = date.today().isoformat()
    if source_plugin not in entry["sources"]:
        entry["sources"].append(source_plugin)
    if len(entry["context_samples"]) < 5:
        entry["context_samples"].append(context)

    # Check promotion threshold: 3+ mentions from 2+ plugins
    if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
        # Promote to real entry
        knowledge_data = {"importance": 15, "source": "threshold-promoted"}

        if entity_type == "person":
            knowledge_data["name"] = entity_name
            knowledge_data["role"] = "Unknown"
            knowledge_data["context"] = "; ".join(entry["context_samples"][:3])
        elif entity_type == "project":
            knowledge_data["name"] = entity_name
            knowledge_data["description"] = "; ".join(entry["context_samples"][:3])
        elif entity_type == "glossary":
            knowledge_data["term"] = entity_name
            knowledge_data["definition"] = "; ".join(entry["context_samples"][:3])
        else:
            knowledge_data["name"] = entity_name
            knowledge_data["role"] = "Unknown"
            entity_type = "person"

        create_knowledge_entry(entity_type, knowledge_data, directory)
        del pending["entities"][slug]
        _save_pending(directory, pending)

        return {
            "action": "promoted",
            "entity": entity_name,
            "starting_score": 15,
            "type": entity_type
        }

    _save_pending(directory, pending)
    return {
        "action": "tracked",
        "entity": entity_name,
        "mentions": entry["mentions"],
        "sources": entry["sources"]
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_harvest.py
git commit -m "feat(memory): implement harvesting pipeline with instant/threshold tracks"
```

---

### Task 6: Implement Triage Report

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Modify: `forge-lib/tests/test_memory_decay.py`

**Step 1: Write failing tests for triage report**

Add to `forge-lib/tests/test_memory_decay.py`:

```python
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
            "last_recalled": "2026-01-15"
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestTriageReport -v`
Expected: FAIL — `triage_report` not defined

**Step 3: Implement triage_report**

Add to `forge-lib/core/memory_ops.py`:

```python
def triage_report(directory: str = ".") -> Dict[str, Any]:
    """Generate triage report of entries needing attention.

    First runs decay to ensure scores are current.
    Then collects sunset entries and approaching-sunset entries (score 10-15).

    Returns dict with 'sunset', 'approaching_sunset' lists and 'total' count.
    """
    # Run decay first
    run_decay(directory)

    base_path = Path(directory)
    sunset = []
    approaching_sunset = []

    for subdir in ["people", "projects", "glossary"]:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            content = md_file.read_text()
            metadata, _ = frontmatter.parse(content)

            importance = metadata.get("importance", 45)
            status = metadata.get("lifecycle_status", "trusted")
            name = metadata.get("name", metadata.get("term", md_file.stem))

            entry_info = {
                "name": name,
                "type": metadata.get("type", "unknown"),
                "importance": importance,
                "source": metadata.get("source", "frontmatter"),
                "last_recalled": metadata.get("last_recalled", "unknown"),
                "created": metadata.get("created", "unknown"),
                "filepath": str(md_file.relative_to(base_path)),
                "days_since_recall": None
            }

            last_recalled = metadata.get("last_recalled")
            if last_recalled:
                try:
                    days = (date.today() - date.fromisoformat(last_recalled)).days
                    entry_info["days_since_recall"] = days
                except (ValueError, TypeError):
                    pass

            if status == "sunset" or importance < 10:
                sunset.append(entry_info)
            elif importance <= 15 and status == "probationary":
                approaching_sunset.append(entry_info)

    # Sort by importance ascending (most urgent first)
    sunset.sort(key=lambda x: x["importance"])
    approaching_sunset.sort(key=lambda x: x["importance"])

    return {
        "sunset": sunset,
        "approaching_sunset": approaching_sunset,
        "total": len(sunset) + len(approaching_sunset)
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestTriageReport -v`
Expected: PASS

**Step 5: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_decay.py
git commit -m "feat(memory): implement triage report generation"
```

---

### Task 7: Implement Triage Actions (Keep, Archive, Delete)

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Modify: `forge-lib/tests/test_memory_decay.py`

**Step 1: Write failing tests for triage actions**

Add to `forge-lib/tests/test_memory_decay.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestTriageActions -v`
Expected: FAIL — functions not defined

**Step 3: Implement triage actions**

Add to `forge-lib/core/memory_ops.py`:

```python
def triage_keep(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Keep action: boost by 20 and reset last_recalled."""
    base_path = Path(directory)
    full_path = base_path / filepath

    if not full_path.exists():
        raise MemoryError(f"Entry not found: {filepath}")

    content = full_path.read_text()
    metadata, body = frontmatter.parse(content)

    old_score = metadata.get("importance", 0)
    new_score = min(100, old_score + 20)
    new_status = derive_lifecycle_status(new_score)

    metadata["importance"] = new_score
    metadata["lifecycle_status"] = new_status
    metadata["last_recalled"] = date.today().isoformat()
    metadata["updated"] = date.today().isoformat()

    full_path.write_text(frontmatter.dumps(metadata, body))

    return {"action": "kept", "score": new_score, "status": new_status}


def triage_archive(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Archive action: move to archived dir, leave stub at original path."""
    base_path = Path(directory)
    full_path = base_path / filepath

    if not full_path.exists():
        raise MemoryError(f"Entry not found: {filepath}")

    # Create archived directory
    archived_dir = base_path / "memory" / "archived"
    archived_dir.mkdir(parents=True, exist_ok=True)

    # Copy to archived
    archived_path = archived_dir / full_path.name
    content = full_path.read_text()
    archived_path.write_text(content)

    # Replace original with stub
    metadata, _ = frontmatter.parse(content)
    stub_metadata = {
        "name": metadata.get("name", metadata.get("term", "")),
        "type": metadata.get("type", "unknown"),
        "status": "archived",
        "archived_date": date.today().isoformat(),
        "archived_to": str(archived_path.relative_to(base_path))
    }
    stub_body = f"\nThis entry was archived on {date.today().isoformat()}.\n"
    full_path.write_text(frontmatter.dumps(stub_metadata, stub_body))

    return {"action": "archived", "archived_to": str(archived_path.relative_to(base_path))}


def triage_delete(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Delete action: remove file entirely."""
    base_path = Path(directory)
    full_path = base_path / filepath

    if not full_path.exists():
        raise MemoryError(f"Entry not found: {filepath}")

    name = full_path.stem
    full_path.unlink()

    return {"action": "deleted", "entry": name}
```

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_decay.py::TestTriageActions -v`
Expected: PASS

**Step 5: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_decay.py
git commit -m "feat(memory): implement triage actions (keep, archive, delete)"
```

---

### Task 8: Register New CLI Subcommands

**Files:**
- Modify: `forge-lib/forge.py`
- Test: `forge-lib/tests/test_forge_cli.py`

**Step 1: Write failing tests for new CLI commands**

Add to `forge-lib/tests/test_forge_cli.py`:

```python
class TestMemoryDecayCLI:
    """Tests for memory decay CLI commands."""

    def test_decay_command_exists(self):
        """forge memory decay should be a valid command."""
        import subprocess
        result = subprocess.run(
            ["python3", "forge.py", "memory", "decay", "--help"],
            capture_output=True, text=True, cwd="."
        )
        assert result.returncode == 0

    def test_harvest_command_exists(self):
        """forge memory harvest should be a valid command."""
        import subprocess
        result = subprocess.run(
            ["python3", "forge.py", "memory", "harvest", "--help"],
            capture_output=True, text=True, cwd="."
        )
        assert result.returncode == 0

    def test_triage_report_command_exists(self):
        """forge memory triage-report should be a valid command."""
        import subprocess
        result = subprocess.run(
            ["python3", "forge.py", "memory", "triage-report", "--help"],
            capture_output=True, text=True, cwd="."
        )
        assert result.returncode == 0

    def test_promote_command_exists(self):
        """forge memory promote should be a valid command."""
        import subprocess
        result = subprocess.run(
            ["python3", "forge.py", "memory", "promote", "--help"],
            capture_output=True, text=True, cwd="."
        )
        assert result.returncode == 0
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_forge_cli.py::TestMemoryDecayCLI -v`
Expected: FAIL — commands not registered

**Step 3: Add CLI handlers and register subcommands**

In `forge-lib/forge.py`, add handler functions:

```python
def handle_memory_decay(args):
    """Handle memory decay command."""
    from core.memory_ops import run_decay
    result = run_decay(directory=args.directory)
    output_json(result)

def handle_memory_harvest(args):
    """Handle memory harvest command."""
    from core.memory_ops import harvest_signal
    result = harvest_signal(
        entity_name=args.entity,
        source_plugin=args.source,
        entity_type=args.type,
        context=args.context or "",
        directory=args.directory
    )
    output_json(result)

def handle_memory_triage_report(args):
    """Handle memory triage-report command."""
    from core.memory_ops import triage_report
    result = triage_report(directory=args.directory)
    output_json(result)

def handle_memory_promote(args):
    """Handle memory promote command."""
    from core.memory_ops import _load_pending, _generate_slug
    pending = _load_pending(args.directory)
    promotable = []
    for slug, entry in pending["entities"].items():
        if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
            promotable.append({"slug": slug, **entry})
    output_json({"promotable": promotable, "count": len(promotable)})

def handle_memory_triage_keep(args):
    """Handle memory triage-keep command."""
    from core.memory_ops import triage_keep
    result = triage_keep(filepath=args.filepath, directory=args.directory)
    output_json(result)

def handle_memory_triage_archive(args):
    """Handle memory triage-archive command."""
    from core.memory_ops import triage_archive
    result = triage_archive(filepath=args.filepath, directory=args.directory)
    output_json(result)

def handle_memory_triage_delete(args):
    """Handle memory triage-delete command."""
    from core.memory_ops import triage_delete
    result = triage_delete(filepath=args.filepath, directory=args.directory)
    output_json(result)
```

Then in the memory subparser registration section, add:

```python
# memory decay
decay_parser = memory_subparsers.add_parser("decay", help="Run decay evaluation across all memory entries")
decay_parser.add_argument("--directory", default=".", help="Base directory")
decay_parser.set_defaults(func=handle_memory_decay)

# memory harvest
harvest_parser = memory_subparsers.add_parser("harvest", help="Process a memory signal from a plugin")
harvest_parser.add_argument("--entity", required=True, help="Entity name")
harvest_parser.add_argument("--source", required=True, help="Source plugin name")
harvest_parser.add_argument("--type", required=True, choices=["person", "project", "glossary"], help="Entity type")
harvest_parser.add_argument("--context", default="", help="Context description")
harvest_parser.add_argument("--directory", default=".", help="Base directory")
harvest_parser.set_defaults(func=handle_memory_harvest)

# memory triage-report
triage_report_parser = memory_subparsers.add_parser("triage-report", help="Generate triage summary")
triage_report_parser.add_argument("--directory", default=".", help="Base directory")
triage_report_parser.set_defaults(func=handle_memory_triage_report)

# memory promote
promote_parser = memory_subparsers.add_parser("promote", help="Check and promote pending entities")
promote_parser.add_argument("--check", action="store_true", help="List promotable entities without promoting")
promote_parser.add_argument("--directory", default=".", help="Base directory")
promote_parser.set_defaults(func=handle_memory_promote)

# memory triage-keep
triage_keep_parser = memory_subparsers.add_parser("triage-keep", help="Keep a triaged entry (boost +20)")
triage_keep_parser.add_argument("filepath", help="Relative path to the entry file")
triage_keep_parser.add_argument("--directory", default=".", help="Base directory")
triage_keep_parser.set_defaults(func=handle_memory_triage_keep)

# memory triage-archive
triage_archive_parser = memory_subparsers.add_parser("triage-archive", help="Archive a triaged entry")
triage_archive_parser.add_argument("filepath", help="Relative path to the entry file")
triage_archive_parser.add_argument("--directory", default=".", help="Base directory")
triage_archive_parser.set_defaults(func=handle_memory_triage_archive)

# memory triage-delete
triage_delete_parser = memory_subparsers.add_parser("triage-delete", help="Delete a triaged entry")
triage_delete_parser.add_argument("filepath", help="Relative path to the entry file")
triage_delete_parser.add_argument("--directory", default=".", help="Base directory")
triage_delete_parser.set_defaults(func=handle_memory_triage_delete)
```

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_forge_cli.py::TestMemoryDecayCLI -v`
Expected: PASS

**Step 5: Run full test suite for regressions**

Run: `cd forge-lib && python3 -m pytest tests/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add forge-lib/forge.py forge-lib/tests/test_forge_cli.py
git commit -m "feat(memory): register decay, harvest, triage CLI subcommands"
```

---

### Task 9: Implement Telemetry Collection

**Files:**
- Modify: `forge-lib/core/memory_ops.py`
- Create: `forge-lib/tests/test_memory_telemetry.py`

**Step 1: Write failing tests for telemetry**

Create `forge-lib/tests/test_memory_telemetry.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_telemetry.py -v`
Expected: FAIL — telemetry functions not defined

**Step 3: Implement telemetry functions**

Add to `forge-lib/core/memory_ops.py`:

```python
def _load_telemetry(directory: str) -> Dict[str, Any]:
    """Load telemetry.json, creating if needed."""
    path = Path(directory) / "memory" / "telemetry.json"
    if path.exists():
        return json.loads(path.read_text())
    return {
        "last_decay_run": None,
        "total_entries": 0,
        "by_status": {"trusted": 0, "probationary": 0, "sunset": 0},
        "by_source": {"manual": 0, "frontmatter": 0, "auto-matched": 0, "threshold-promoted": 0},
        "pending_count": 0,
        "triage_history": [],
        "promotions": {"total": 0, "avg_days_to_promote": 0},
        "archives": {"total": 0, "avg_lifespan_days": 0, "by_source": {}}
    }


def _save_telemetry(directory: str, telemetry: Dict[str, Any]) -> None:
    """Save telemetry.json."""
    path = Path(directory) / "memory" / "telemetry.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(telemetry, indent=2))


def update_telemetry_snapshot(directory: str) -> None:
    """Update telemetry with current state of all entries."""
    base_path = Path(directory)
    telemetry = _load_telemetry(directory)

    by_status = {"trusted": 0, "probationary": 0, "sunset": 0}
    by_source = {"manual": 0, "frontmatter": 0, "auto-matched": 0, "threshold-promoted": 0}
    total = 0

    for subdir in ["people", "projects", "glossary"]:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            content = md_file.read_text()
            metadata, _ = frontmatter.parse(content)
            if metadata.get("status") == "archived":
                continue
            total += 1
            status = metadata.get("lifecycle_status", "trusted")
            source = metadata.get("source", "frontmatter")
            by_status[status] = by_status.get(status, 0) + 1
            by_source[source] = by_source.get(source, 0) + 1

    telemetry["total_entries"] = total
    telemetry["by_status"] = by_status
    telemetry["by_source"] = by_source
    telemetry["last_decay_run"] = date.today().isoformat()

    pending = _load_pending(directory)
    telemetry["pending_count"] = len(pending.get("entities", {}))

    _save_telemetry(directory, telemetry)


def record_triage_action(action: str, directory: str) -> None:
    """Record a triage action to telemetry history."""
    telemetry = _load_telemetry(directory)

    today = date.today().isoformat()
    history = telemetry.get("triage_history", [])

    # Find or create today's entry
    today_entry = None
    for entry in history:
        if entry.get("date") == today:
            today_entry = entry
            break

    if not today_entry:
        today_entry = {"date": today, "reviewed": 0, "kept": 0, "merged": 0, "archived": 0, "deleted": 0}
        history.append(today_entry)

    today_entry["reviewed"] += 1
    if action in today_entry:
        today_entry[action] += 1

    telemetry["triage_history"] = history[-30:]  # Keep last 30 days
    _save_telemetry(directory, telemetry)
```

Then update `run_decay` to call `update_telemetry_snapshot(directory)` at the end before returning.

**Step 4: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_telemetry.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add forge-lib/core/memory_ops.py forge-lib/tests/test_memory_telemetry.py
git commit -m "feat(memory): implement telemetry collection for decay and triage"
```

---

### Task 10: Create /memory:triage Plugin Command

**Files:**
- Create: `forge-memory/commands/triage.md`

**Step 1: Write the triage command**

Create `forge-memory/commands/triage.md` — this is a conversational workflow command (markdown, not code). It should:

1. Run `forge memory decay --directory .` to update scores
2. Run `forge memory triage-report --directory .` to get entries needing attention
3. Present sunset and approaching-sunset entries with numbered list
4. Accept batch user actions ("keep 1, archive 2, delete 3")
5. Execute actions via `forge memory triage-keep`, `forge memory triage-archive`, `forge memory triage-delete`
6. Record each action via `forge memory` telemetry
7. Report summary of actions taken

Follow the pattern of existing commands (80-100 lines, conversational, delegates to forge-lib).

**Step 2: Verify command file exists and is well-formed**

Run: `ls -la forge-memory/commands/triage.md`
Expected: File exists

**Step 3: Commit**

```bash
git add forge-memory/commands/triage.md
git commit -m "feat(memory): add /memory:triage interactive curation command"
```

---

### Task 11: Update Memory Management Skill

**Files:**
- Modify: `forge-memory/skills/memory-management/SKILL.md`

**Step 1: Update the skill to respect lifecycle_status**

Update the 4-tier lookup flow in `forge-memory/skills/memory-management/SKILL.md` to:

- Filter out sunset entries from Tier 2 (knowledge) queries
- Flag probationary entries with a visual indicator in recall results
- Add a note about the lifecycle system when unknown terms are encountered (suggest they may be in pending.json)
- Document the boost behavior: successful recalls strengthen entries

**Step 2: Commit**

```bash
git add forge-memory/skills/memory-management/SKILL.md
git commit -m "feat(memory): update memory-management skill for lifecycle awareness"
```

---

### Task 12: Update Forge-Shell Memory View

**Files:**
- Modify: `forge-shell/app/js/memory.js`

**Step 1: Add lifecycle status coloring to entry cards**

In `renderMemoryDirectory()` (~line 595 of `forge-shell/app/js/memory.js`), update the card rendering to:

- Read `lifecycle_status` and `importance` from parsed frontmatter
- Apply CSS classes: `memory-trusted`, `memory-probationary`, `memory-sunset`
- Show importance score badge on each card
- Dim sunset entries with reduced opacity

**Step 2: Add triage badge to memory tab**

In `renderMemoryTabs()` (~line 450), count entries with `lifecycle_status: sunset` across all directories and show a badge number on the Memory tab if > 0.

**Step 3: Add sort-by-importance option**

Add a sort dropdown to the toolbar that allows sorting memory directory cards by:
- Name (default, alphabetical)
- Importance (descending)
- Last recalled (most recent first)

**Step 4: Add CSS for lifecycle states**

Add to the stylesheet:

```css
.memory-trusted { border-left: 3px solid #22c55e; }
.memory-probationary { border-left: 3px solid #f59e0b; opacity: 0.85; }
.memory-sunset { border-left: 3px solid #ef4444; opacity: 0.6; }
.importance-badge {
    position: absolute; top: 8px; right: 8px;
    font-size: 11px; font-weight: 600;
    padding: 2px 6px; border-radius: 4px;
    background: var(--bg-tertiary);
}
```

**Step 5: Test in forge-shell**

Run: `cd forge-shell && npm run tauri dev`
Expected: Memory view shows lifecycle colors, score badges, triage badge count

**Step 6: Commit**

```bash
git add forge-shell/app/js/memory.js forge-shell/app/css/styles.css
git commit -m "feat(forge-shell): add lifecycle visualization to memory view"
```

---

### Task 13: Add Default Triage Routine

**Files:**
- Create: `.forge/routines/weekly-memory-triage.md`

**Step 1: Create the routine file**

Create `.forge/routines/weekly-memory-triage.md`:

```yaml
---
name: weekly-memory-triage
schedule: monday 9:00
action: forge memory decay && forge memory triage-report
description: Run decay and generate triage summary for review
enabled: true
created: 2026-02-26
---

# Weekly Memory Triage

Runs every Monday at 9:00 AM. Applies decay to all memory entries and generates
a triage report of entries needing attention.

Review the report output and run `/memory:triage` to curate entries.
```

**Step 2: Commit**

```bash
git add .forge/routines/weekly-memory-triage.md
git commit -m "feat(memory): add weekly triage routine for routines-forge"
```

---

### Task 14: Update CLAUDE.md and Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `forge-memory/README.md`

**Step 1: Update CLAUDE.md**

Add `/memory:triage` to the forge-memory row in the plugin table.

**Step 2: Update forge-memory README**

Add documentation for:
- The lifecycle system (importance scores, tiers, decay)
- Passive harvesting (how it works, signal sources)
- Triage workflow (command usage, actions)
- New CLI commands (decay, harvest, triage-report, promote)
- Telemetry (what's tracked, where it's stored)

**Step 3: Commit**

```bash
git add CLAUDE.md forge-memory/README.md
git commit -m "docs(memory): update documentation for living memory system"
```

---

### Task 15: Integration Test — Full Lifecycle

**Files:**
- Create: `forge-lib/tests/test_memory_integration.py`

**Step 1: Write end-to-end integration test**

Create `forge-lib/tests/test_memory_integration.py`:

```python
"""Integration test for full memory lifecycle."""
import pytest
import json
from datetime import date, timedelta
from pathlib import Path
from core.memory_ops import (
    init_memory, create_knowledge_entry, harvest_signal,
    run_decay, triage_report, triage_keep, triage_archive,
    triage_delete, boost_entry
)
from core import frontmatter as fm


class TestFullLifecycle:
    """End-to-end test of the living memory system."""

    def test_harvest_decay_triage_cycle(self, temp_dir):
        """Full cycle: harvest → decay → triage → actions."""
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

        # Phoenix (started at 15, 65 days inactive) should be at 0 (15-25)
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
        assert stub_meta["status"] == "archived"

        # Verify archived copy exists
        archived = temp_dir / "memory" / "archived" / phoenix_path.name
        assert archived.exists()
```

**Step 2: Run integration test**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_integration.py -v`
Expected: PASS

**Step 3: Run full test suite**

Run: `cd forge-lib && python3 -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add forge-lib/tests/test_memory_integration.py
git commit -m "test(memory): add end-to-end integration test for full lifecycle"
```

---

## Summary

| Task | Component | Estimated Steps |
|------|-----------|----------------|
| 1 | Schema lifecycle fields | 8 steps |
| 2 | Template rendering | 7 steps |
| 3 | Decay engine | 7 steps |
| 4 | Boost mechanics | 5 steps |
| 5 | Harvesting pipeline | 5 steps |
| 6 | Triage report | 5 steps |
| 7 | Triage actions | 5 steps |
| 8 | CLI registration | 6 steps |
| 9 | Telemetry | 5 steps |
| 10 | /memory:triage command | 3 steps |
| 11 | Memory skill update | 2 steps |
| 12 | Forge-shell visualization | 6 steps |
| 13 | Triage routine | 2 steps |
| 14 | Documentation | 3 steps |
| 15 | Integration test | 4 steps |

**Total: 15 tasks, 73 steps, 15 commits**

Dependencies: Tasks 1-2 must complete first (schema foundation). Tasks 3-7 are the core engine (sequential). Task 8 wires CLI. Tasks 9-15 are largely independent after the core engine is done.
