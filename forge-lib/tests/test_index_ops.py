"""Tests for core/index_ops.py module."""

import json
import pytest
import tempfile
from pathlib import Path
from datetime import datetime
from core import index_ops


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_index_data():
    """Sample index data for testing."""
    return {
        "schema_version": "1.0",
        "plugin": "product-forge",
        "updated": "2026-02-13",
        "entries": [
            {
                "file": "initiatives/notification-system.md",
                "type": "initiative",
                "title": "Notification System Overhaul",
                "status": "Approved",
                "product": "webapp",
                "parent": None,
                "children": ["email-engine", "push-service"],
                "created": "2026-01-15",
                "updated": "2026-02-10"
            },
            {
                "file": "epics/email-engine.md",
                "type": "epic",
                "title": "Email Notification Engine",
                "status": "In Progress",
                "product": "webapp",
                "parent": "notification-system",
                "children": ["story-001", "story-002"],
                "created": "2026-01-20",
                "updated": "2026-02-12"
            }
        ]
    }


@pytest.fixture
def sample_markdown_files(temp_dir):
    """Create sample markdown files with frontmatter."""
    # Create directories
    initiatives_dir = Path(temp_dir) / "initiatives"
    epics_dir = Path(temp_dir) / "epics"
    stories_dir = Path(temp_dir) / "stories"

    initiatives_dir.mkdir()
    epics_dir.mkdir()
    stories_dir.mkdir()

    # Create initiative file
    initiative_content = """---
type: initiative
title: Test Initiative
status: Approved
product: webapp
created: 2026-01-15
updated: 2026-02-10
---

# Test Initiative

This is a test initiative.
"""
    (initiatives_dir / "test-initiative.md").write_text(initiative_content)

    # Create epic file
    epic_content = """---
type: epic
title: Test Epic
status: In Progress
product: webapp
parent: test-initiative
created: 2026-01-20
updated: 2026-02-12
---

# Test Epic

This is a test epic.
"""
    (epics_dir / "test-epic.md").write_text(epic_content)

    # Create story file
    story_content = """---
type: story
title: Test Story
status: Open
product: webapp
parent: test-epic
priority: 2
created: 2026-02-01
updated: 2026-02-13
---

# Test Story

This is a test story.
"""
    (stories_dir / "story-001-test.md").write_text(story_content)

    return temp_dir


class TestReadIndex:
    """Tests for read_index function."""

    def test_read_existing_index(self, temp_dir, sample_index_data):
        """Test reading an existing index.json file."""
        index_path = Path(temp_dir) / "index.json"
        index_path.write_text(json.dumps(sample_index_data, indent=2))

        result = index_ops.read_index(temp_dir)

        assert result["schema_version"] == "1.0"
        assert result["plugin"] == "product-forge"
        assert len(result["entries"]) == 2
        assert result["entries"][0]["title"] == "Notification System Overhaul"

    def test_read_nonexistent_index(self, temp_dir):
        """Test reading when index.json doesn't exist."""
        result = index_ops.read_index(temp_dir)

        assert result["schema_version"] == "1.0"
        assert result["entries"] == []
        assert "updated" in result

    def test_read_invalid_json(self, temp_dir):
        """Test reading index with invalid JSON."""
        index_path = Path(temp_dir) / "index.json"
        index_path.write_text("{ invalid json }")

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.read_index(temp_dir)

        assert "Invalid JSON" in str(exc_info.value)

    def test_read_non_object_json(self, temp_dir):
        """Test reading index that's not a JSON object."""
        index_path = Path(temp_dir) / "index.json"
        index_path.write_text('["array", "not", "object"]')

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.read_index(temp_dir)

        assert "not a JSON object" in str(exc_info.value)

    def test_read_missing_entries_field(self, temp_dir):
        """Test reading index without 'entries' field."""
        index_path = Path(temp_dir) / "index.json"
        index_path.write_text('{"schema_version": "1.0"}')

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.read_index(temp_dir)

        assert "missing 'entries' field" in str(exc_info.value)

    def test_read_entries_not_list(self, temp_dir):
        """Test reading index where 'entries' is not a list."""
        index_path = Path(temp_dir) / "index.json"
        index_path.write_text('{"entries": "not-a-list"}')

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.read_index(temp_dir)

        assert "'entries' field is not a list" in str(exc_info.value)


class TestWriteIndex:
    """Tests for write_index function."""

    def test_write_new_index(self, temp_dir, sample_index_data):
        """Test writing a new index.json file."""
        index_ops.write_index(temp_dir, sample_index_data)

        # Verify file was created
        index_path = Path(temp_dir) / "index.json"
        assert index_path.exists()

        # Verify content
        with open(index_path) as f:
            data = json.load(f)

        assert data["plugin"] == "product-forge"
        assert len(data["entries"]) == 2

    def test_write_creates_directory(self, temp_dir):
        """Test that write_index creates directory if it doesn't exist."""
        new_dir = Path(temp_dir) / "subdir"
        index_data = {
            "schema_version": "1.0",
            "entries": []
        }

        index_ops.write_index(str(new_dir), index_data)

        assert new_dir.exists()
        assert (new_dir / "index.json").exists()

    def test_write_updates_timestamp(self, temp_dir, sample_index_data):
        """Test that write_index updates the 'updated' timestamp."""
        today = datetime.now().strftime("%Y-%m-%d")
        index_ops.write_index(temp_dir, sample_index_data)

        index_path = Path(temp_dir) / "index.json"
        with open(index_path) as f:
            data = json.load(f)

        assert data["updated"] == today

    def test_write_invalid_data_not_dict(self, temp_dir):
        """Test writing invalid data (not a dictionary)."""
        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.write_index(temp_dir, ["not", "a", "dict"])

        assert "must be a dictionary" in str(exc_info.value)

    def test_write_missing_entries(self, temp_dir):
        """Test writing data without 'entries' field."""
        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.write_index(temp_dir, {"schema_version": "1.0"})

        assert "missing 'entries' field" in str(exc_info.value)

    def test_write_entries_not_list(self, temp_dir):
        """Test writing data where 'entries' is not a list."""
        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.write_index(temp_dir, {"entries": "not-a-list"})

        assert "'entries' field must be a list" in str(exc_info.value)

    def test_atomic_write(self, temp_dir, sample_index_data):
        """Test that write is atomic (no temp file left behind)."""
        index_ops.write_index(temp_dir, sample_index_data)

        # Check no temp file exists
        temp_path = Path(temp_dir) / "index.json.tmp"
        assert not temp_path.exists()


class TestCreateIndexEntry:
    """Tests for create_index_entry function."""

    def test_create_first_entry(self, temp_dir):
        """Test creating the first entry in a new index."""
        entry = {
            "file": "initiatives/test.md",
            "type": "initiative",
            "title": "Test Initiative",
            "status": "Approved"
        }

        index_ops.create_index_entry(temp_dir, entry, plugin="product-forge")

        result = index_ops.read_index(temp_dir)
        assert len(result["entries"]) == 1
        assert result["entries"][0]["title"] == "Test Initiative"
        assert result["plugin"] == "product-forge"

    def test_create_additional_entry(self, temp_dir, sample_index_data):
        """Test adding an entry to existing index."""
        # Write initial index
        index_ops.write_index(temp_dir, sample_index_data)

        # Add new entry
        new_entry = {
            "file": "stories/story-001.md",
            "type": "story",
            "title": "Test Story"
        }

        index_ops.create_index_entry(temp_dir, new_entry)

        result = index_ops.read_index(temp_dir)
        assert len(result["entries"]) == 3
        assert result["entries"][2]["title"] == "Test Story"

    def test_create_duplicate_file(self, temp_dir, sample_index_data):
        """Test creating entry for file that already exists."""
        index_ops.write_index(temp_dir, sample_index_data)

        duplicate_entry = {
            "file": "initiatives/notification-system.md",
            "type": "initiative",
            "title": "Duplicate"
        }

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.create_index_entry(temp_dir, duplicate_entry)

        assert "already exists" in str(exc_info.value)

    def test_create_missing_required_field(self, temp_dir):
        """Test creating entry missing required fields."""
        entry = {
            "type": "initiative",
            "title": "Test"
            # Missing "file" field
        }

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.create_index_entry(temp_dir, entry)

        assert "missing required field" in str(exc_info.value)


class TestUpdateIndexEntry:
    """Tests for update_index_entry function."""

    def test_update_existing_entry(self, temp_dir, sample_index_data):
        """Test updating an existing entry."""
        index_ops.write_index(temp_dir, sample_index_data)

        updates = {
            "status": "Completed",
            "title": "Updated Title"
        }

        index_ops.update_index_entry(
            temp_dir,
            "initiatives/notification-system.md",
            updates
        )

        result = index_ops.read_index(temp_dir)
        entry = result["entries"][0]
        assert entry["status"] == "Completed"
        assert entry["title"] == "Updated Title"
        assert entry["updated"] == datetime.now().strftime("%Y-%m-%d")

    def test_update_nonexistent_entry(self, temp_dir, sample_index_data):
        """Test updating entry that doesn't exist."""
        index_ops.write_index(temp_dir, sample_index_data)

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.update_index_entry(
                temp_dir,
                "nonexistent/file.md",
                {"status": "Done"}
            )

        assert "Entry not found" in str(exc_info.value)

    def test_update_preserves_other_fields(self, temp_dir, sample_index_data):
        """Test that update preserves fields not being updated."""
        index_ops.write_index(temp_dir, sample_index_data)

        index_ops.update_index_entry(
            temp_dir,
            "initiatives/notification-system.md",
            {"status": "Completed"}
        )

        result = index_ops.read_index(temp_dir)
        entry = result["entries"][0]
        assert entry["product"] == "webapp"
        assert entry["created"] == "2026-01-15"


class TestDeleteIndexEntry:
    """Tests for delete_index_entry function."""

    def test_delete_existing_entry(self, temp_dir, sample_index_data):
        """Test deleting an existing entry."""
        index_ops.write_index(temp_dir, sample_index_data)

        index_ops.delete_index_entry(temp_dir, "initiatives/notification-system.md")

        result = index_ops.read_index(temp_dir)
        assert len(result["entries"]) == 1
        assert result["entries"][0]["file"] == "epics/email-engine.md"

    def test_delete_nonexistent_entry(self, temp_dir, sample_index_data):
        """Test deleting entry that doesn't exist."""
        index_ops.write_index(temp_dir, sample_index_data)

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.delete_index_entry(temp_dir, "nonexistent/file.md")

        assert "Entry not found" in str(exc_info.value)


class TestQueryIndex:
    """Tests for query_index function."""

    def test_query_no_filters(self, temp_dir, sample_index_data):
        """Test query with no filters returns all entries."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir)

        assert len(results) == 2

    def test_query_by_type(self, temp_dir, sample_index_data):
        """Test query filtering by type."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir, {"type": "epic"})

        assert len(results) == 1
        assert results[0]["title"] == "Email Notification Engine"

    def test_query_by_status(self, temp_dir, sample_index_data):
        """Test query filtering by status."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir, {"status": "Approved"})

        assert len(results) == 1
        assert results[0]["type"] == "initiative"

    def test_query_by_parent(self, temp_dir, sample_index_data):
        """Test query filtering by parent."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir, {"parent": "notification-system"})

        assert len(results) == 1
        assert results[0]["type"] == "epic"

    def test_query_multiple_filters(self, temp_dir, sample_index_data):
        """Test query with multiple filters."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir, {
            "type": "epic",
            "status": "In Progress"
        })

        assert len(results) == 1
        assert results[0]["title"] == "Email Notification Engine"

    def test_query_no_matches(self, temp_dir, sample_index_data):
        """Test query that returns no matches."""
        index_ops.write_index(temp_dir, sample_index_data)

        results = index_ops.query_index(temp_dir, {"status": "Nonexistent"})

        assert len(results) == 0

    def test_query_empty_index(self, temp_dir):
        """Test query on empty index."""
        results = index_ops.query_index(temp_dir)

        assert len(results) == 0


class TestRebuildIndex:
    """Tests for rebuild_index function."""

    def test_rebuild_from_markdown_files(self, sample_markdown_files):
        """Test rebuilding index from markdown files."""
        count = index_ops.rebuild_index(
            sample_markdown_files,
            plugin="product-forge"
        )

        assert count == 3

        result = index_ops.read_index(sample_markdown_files)
        assert len(result["entries"]) == 3
        assert result["plugin"] == "product-forge"

        # Check entries were parsed correctly
        titles = [e["title"] for e in result["entries"]]
        assert "Test Initiative" in titles
        assert "Test Epic" in titles
        assert "Test Story" in titles

    def test_rebuild_specific_entity_types(self, sample_markdown_files):
        """Test rebuilding only specific entity types."""
        count = index_ops.rebuild_index(
            sample_markdown_files,
            plugin="product-forge",
            entity_types=["initiatives", "epics"]
        )

        assert count == 2

        result = index_ops.read_index(sample_markdown_files)
        types = [e["type"] for e in result["entries"]]
        assert "initiative" in types
        assert "epic" in types
        assert "story" not in types

    def test_rebuild_empty_directory(self, temp_dir):
        """Test rebuilding from empty directory."""
        count = index_ops.rebuild_index(temp_dir)

        assert count == 0

        result = index_ops.read_index(temp_dir)
        assert len(result["entries"]) == 0

    def test_rebuild_nonexistent_directory(self):
        """Test rebuilding from nonexistent directory."""
        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.rebuild_index("/nonexistent/directory")

        assert "does not exist" in str(exc_info.value)

    def test_rebuild_file_not_directory(self, temp_dir):
        """Test rebuilding from a file instead of directory."""
        file_path = Path(temp_dir) / "test.txt"
        file_path.write_text("test")

        with pytest.raises(index_ops.IndexError) as exc_info:
            index_ops.rebuild_index(str(file_path))

        assert "not a directory" in str(exc_info.value)

    def test_rebuild_skips_files_without_frontmatter(self, temp_dir):
        """Test that rebuild skips markdown files without frontmatter."""
        # Create file without frontmatter
        subdir = Path(temp_dir) / "test"
        subdir.mkdir()
        (subdir / "no-frontmatter.md").write_text("# Just content\n\nNo frontmatter here.")

        count = index_ops.rebuild_index(temp_dir)

        assert count == 0


class TestGetEntryByFile:
    """Tests for get_entry_by_file function."""

    def test_get_existing_entry(self, temp_dir, sample_index_data):
        """Test getting an existing entry."""
        index_ops.write_index(temp_dir, sample_index_data)

        entry = index_ops.get_entry_by_file(temp_dir, "epics/email-engine.md")

        assert entry is not None
        assert entry["title"] == "Email Notification Engine"
        assert entry["type"] == "epic"

    def test_get_nonexistent_entry(self, temp_dir, sample_index_data):
        """Test getting entry that doesn't exist."""
        index_ops.write_index(temp_dir, sample_index_data)

        entry = index_ops.get_entry_by_file(temp_dir, "nonexistent/file.md")

        assert entry is None


class TestEntryExists:
    """Tests for entry_exists function."""

    def test_entry_exists_true(self, temp_dir, sample_index_data):
        """Test entry_exists returns True for existing entry."""
        index_ops.write_index(temp_dir, sample_index_data)

        assert index_ops.entry_exists(temp_dir, "epics/email-engine.md") is True

    def test_entry_exists_false(self, temp_dir, sample_index_data):
        """Test entry_exists returns False for nonexistent entry."""
        index_ops.write_index(temp_dir, sample_index_data)

        assert index_ops.entry_exists(temp_dir, "nonexistent/file.md") is False

    def test_entry_exists_empty_index(self, temp_dir):
        """Test entry_exists on empty index."""
        assert index_ops.entry_exists(temp_dir, "any/file.md") is False
