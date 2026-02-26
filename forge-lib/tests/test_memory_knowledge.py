"""Tests for memory knowledge operations (people, projects, glossary)."""
import json
import pytest
from pathlib import Path
from datetime import date


@pytest.fixture
def temp_dir(tmp_path):
    return tmp_path


@pytest.fixture
def initialized_memory(temp_dir):
    """Initialize memory directory structure."""
    from core.memory_ops import init_memory
    init_memory(str(temp_dir))
    return temp_dir


class TestCreatePerson:

    def test_create_person(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'Jane Smith',
            'role': 'Engineering Manager',
            'team': 'Backend',
            'context': 'Reports to VP of Engineering. Owns API platform.',
        }
        result = create_knowledge_entry('person', data, directory=str(initialized_memory))
        assert result['filename'] == 'jane-smith.md'
        assert (initialized_memory / 'memory' / 'people' / 'jane-smith.md').exists()

    def test_create_person_updates_index(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'John Doe',
            'role': 'Developer',
            'team': 'Frontend',
            'context': 'Joined recently.',
        }
        create_knowledge_entry('person', data, directory=str(initialized_memory))
        index_path = initialized_memory / 'memory' / 'index.json'
        assert index_path.exists()
        index_data = json.loads(index_path.read_text())
        assert any(e['name'] == 'John Doe' for e in index_data['entries'])


class TestCreateProject:

    def test_create_project(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'API Platform',
            'description': 'Core API infrastructure serving all products.',
            'status': 'in-progress',
            'people': ['Jane Smith'],
        }
        result = create_knowledge_entry('project', data, directory=str(initialized_memory))
        assert result['filename'] == 'api-platform.md'
        assert (initialized_memory / 'memory' / 'projects' / 'api-platform.md').exists()


class TestCreateGlossaryTerm:

    def test_create_glossary_term(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'term': 'TCREI',
            'definition': 'Task, Context, Rules, Examples, Identity — Rovo agent instruction framework.',
            'context': 'Used in rovo-forge agent building.',
        }
        result = create_knowledge_entry('glossary', data, directory=str(initialized_memory))
        assert result['filename'] == 'tcrei.md'


class TestQueryKnowledge:

    def test_query_all_knowledge(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry, query_knowledge
        create_knowledge_entry('person', {
            'name': 'Alice', 'role': 'Dev', 'team': 'A', 'context': 'Test.'
        }, directory=str(initialized_memory))
        create_knowledge_entry('project', {
            'name': 'Project X', 'description': 'Test project.', 'status': 'active', 'people': []
        }, directory=str(initialized_memory))
        results = query_knowledge(directory=str(initialized_memory))
        assert len(results) >= 2

    def test_query_by_type(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry, query_knowledge
        create_knowledge_entry('person', {
            'name': 'Bob', 'role': 'Dev', 'team': 'B', 'context': 'Test.'
        }, directory=str(initialized_memory))
        results = query_knowledge(directory=str(initialized_memory), filters={'type': 'person'})
        assert all(r.get('type') == 'person' for r in results)


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
