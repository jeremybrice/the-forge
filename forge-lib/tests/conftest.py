"""
Shared pytest fixtures and configuration for forge-lib tests.
"""

import pytest
import tempfile
import shutil
from pathlib import Path


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    temp_path = tempfile.mkdtemp()
    yield Path(temp_path)
    shutil.rmtree(temp_path)


@pytest.fixture
def sample_frontmatter():
    """Sample frontmatter data for testing."""
    return {
        "title": "Test Card",
        "type": "initiative",
        "status": "active",
        "created": "2026-02-13",
        "tags": ["test", "sample"],
    }


@pytest.fixture
def sample_markdown_content():
    """Sample markdown content with frontmatter for testing."""
    return """---
title: Test Card
type: initiative
status: active
created: 2026-02-13
tags:
  - test
  - sample
---

# Test Card

This is a sample card for testing purposes.

## Details

- Item 1
- Item 2
- Item 3
"""


@pytest.fixture
def mock_schema_dir(tmp_path, monkeypatch):
    """Create a mock schema directory with test schemas."""
    schema_dir = tmp_path / "schemas"
    schema_dir.mkdir()

    # Create a simple test schema
    test_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "status": {"type": "string", "enum": ["active", "inactive"]},
            "priority": {"type": "integer", "minimum": 1, "maximum": 5, "default": 3},
        },
        "required": ["title", "status"],
    }

    import json
    schema_file = schema_dir / "test-schema.json"
    schema_file.write_text(json.dumps(test_schema, indent=2))

    # Mock the schema directory path in validator module
    def mock_get_schema_path(schema_name):
        return str(schema_dir / f"{schema_name}.json")

    from core import validator
    monkeypatch.setattr(validator, "get_schema_path", mock_get_schema_path)

    return schema_dir
