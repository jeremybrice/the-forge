"""
Unit tests for core/validator.py
"""

import pytest
import json
import tempfile
from pathlib import Path
from core import validator


# Sample schemas for testing
SAMPLE_STORY_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "status": {"type": "string", "enum": ["backlog", "ready", "in-progress", "done"]},
        "priority": {"type": "integer", "minimum": 1, "maximum": 5},
        "tags": {"type": "array", "items": {"type": "string"}},
        "estimate": {"type": "number", "default": 0}
    },
    "required": ["title", "status"]
}

SAMPLE_INITIATIVE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "product": {"type": "string"},
        "status": {"type": "string"},
        "created": {"type": "string", "format": "date"},
        "children": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "product"]
}


@pytest.fixture
def temp_schemas_dir(tmp_path, monkeypatch):
    """Create temporary schemas directory with test schemas."""
    schemas_dir = tmp_path / "schemas"
    schemas_dir.mkdir()

    # Create sample schema files
    story_schema_path = schemas_dir / "story.json"
    with open(story_schema_path, 'w') as f:
        json.dump(SAMPLE_STORY_SCHEMA, f)

    initiative_schema_path = schemas_dir / "initiative.json"
    with open(initiative_schema_path, 'w') as f:
        json.dump(SAMPLE_INITIATIVE_SCHEMA, f)

    # Monkeypatch the schemas directory
    def mock_get_schema_path(schema_name):
        path = schemas_dir / f"{schema_name}.json"
        if not path.exists():
            raise validator.ValidationError(f"Schema file not found: {path}")
        return path

    monkeypatch.setattr(validator, "get_schema_path", mock_get_schema_path)

    # Clear cache before each test
    validator.clear_cache()

    return schemas_dir


class TestGetSchemaPath:
    """Tests for get_schema_path function."""

    def test_nonexistent_schema_raises_error(self, temp_schemas_dir):
        """Should raise ValidationError for nonexistent schema."""
        with pytest.raises(validator.ValidationError, match="Schema file not found"):
            validator.load_schema("nonexistent")


class TestLoadSchema:
    """Tests for load_schema function."""

    def test_load_valid_schema(self, temp_schemas_dir):
        """Should load a valid schema file."""
        schema = validator.load_schema("story")
        assert schema == SAMPLE_STORY_SCHEMA

    def test_schema_caching(self, temp_schemas_dir):
        """Should cache loaded schemas."""
        # Load schema first time
        schema1 = validator.load_schema("story")

        # Load again (should come from cache)
        schema2 = validator.load_schema("story")

        assert schema1 is schema2  # Same object reference
        assert "story" in validator.get_cached_schemas()

    def test_cache_bypass(self, temp_schemas_dir):
        """Should bypass cache when use_cache=False."""
        schema1 = validator.load_schema("story", use_cache=False)
        schema2 = validator.load_schema("story", use_cache=False)

        # Different objects (loaded separately)
        assert schema1 is not schema2
        assert schema1 == schema2  # But same content

    def test_load_invalid_json_raises_error(self, temp_schemas_dir):
        """Should raise ValidationError for invalid JSON."""
        invalid_path = temp_schemas_dir / "invalid.json"
        with open(invalid_path, 'w') as f:
            f.write("{ invalid json }")

        with pytest.raises(validator.ValidationError, match="Invalid JSON"):
            validator.load_schema("invalid")


class TestValidate:
    """Tests for validate function."""

    def test_validate_valid_data(self, temp_schemas_dir):
        """Should pass validation for valid data."""
        data = {
            "title": "Implement user authentication",
            "status": "in-progress",
            "priority": 1
        }
        # Should not raise
        validator.validate(data, "story")

    def test_validate_missing_required_field(self, temp_schemas_dir):
        """Should raise ValidationError for missing required field."""
        data = {
            "status": "backlog",
            "priority": 2
        }
        with pytest.raises(validator.ValidationError, match="'title' is a required property"):
            validator.validate(data, "story")

    def test_validate_wrong_type(self, temp_schemas_dir):
        """Should raise ValidationError for wrong data type."""
        data = {
            "title": "Test story",
            "status": "done",
            "priority": "high"  # Should be integer
        }
        with pytest.raises(validator.ValidationError, match="'high' is not of type 'integer'"):
            validator.validate(data, "story")

    def test_validate_enum_violation(self, temp_schemas_dir):
        """Should raise ValidationError for enum violation."""
        data = {
            "title": "Test story",
            "status": "invalid-status"  # Not in enum
        }
        with pytest.raises(validator.ValidationError, match="is not one of"):
            validator.validate(data, "story")

    def test_validate_minimum_violation(self, temp_schemas_dir):
        """Should raise ValidationError for minimum value violation."""
        data = {
            "title": "Test story",
            "status": "done",
            "priority": 0  # Below minimum of 1
        }
        with pytest.raises(validator.ValidationError, match="0 is less than the minimum of 1"):
            validator.validate(data, "story")

    def test_validate_maximum_violation(self, temp_schemas_dir):
        """Should raise ValidationError for maximum value violation."""
        data = {
            "title": "Test story",
            "status": "done",
            "priority": 10  # Above maximum of 5
        }
        with pytest.raises(validator.ValidationError, match="10 is greater than the maximum of 5"):
            validator.validate(data, "story")

    def test_validate_array_type(self, temp_schemas_dir):
        """Should validate array fields."""
        data = {
            "title": "Test story",
            "status": "done",
            "tags": ["frontend", "ui", "urgent"]
        }
        # Should not raise
        validator.validate(data, "story")

    def test_validate_invalid_array_item_type(self, temp_schemas_dir):
        """Should raise ValidationError for invalid array item type."""
        data = {
            "title": "Test story",
            "status": "done",
            "tags": ["frontend", 123, "urgent"]  # 123 is not a string
        }
        with pytest.raises(validator.ValidationError, match="is not of type 'string'"):
            validator.validate(data, "story")

    def test_validate_nested_schema(self, temp_schemas_dir):
        """Should validate nested properties."""
        data = {
            "title": "Test Initiative",
            "product": "webapp",
            "status": "active",
            "children": ["epic-001", "epic-002"]
        }
        # Should not raise
        validator.validate(data, "initiative")


class TestValidateSchema:
    """Tests for validate_schema function."""

    def test_validate_valid_schema(self):
        """Should validate a correct JSON Schema."""
        assert validator.validate_schema(SAMPLE_STORY_SCHEMA) is True

    def test_validate_invalid_schema(self):
        """Should raise ValidationError for invalid schema."""
        invalid_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "invalid-type"  # Invalid type
        }
        with pytest.raises(validator.ValidationError, match="Invalid JSON Schema"):
            validator.validate_schema(invalid_schema)


class TestClearCache:
    """Tests for clear_cache function."""

    def test_clear_cache(self, temp_schemas_dir):
        """Should clear the schema cache."""
        # Load a schema to populate cache
        validator.load_schema("story")
        assert "story" in validator.get_cached_schemas()

        # Clear cache
        validator.clear_cache()
        assert len(validator.get_cached_schemas()) == 0


class TestGetCachedSchemas:
    """Tests for get_cached_schemas function."""

    def test_get_cached_schemas(self, temp_schemas_dir):
        """Should return list of cached schema names."""
        assert len(validator.get_cached_schemas()) == 0

        validator.load_schema("story")
        validator.load_schema("initiative")

        cached = validator.get_cached_schemas()
        assert "story" in cached
        assert "initiative" in cached
        assert len(cached) == 2


class TestValidateWithDefaults:
    """Tests for validate_with_defaults function."""

    def test_fill_in_defaults(self, temp_schemas_dir):
        """Should fill in default values from schema."""
        data = {
            "title": "Test story",
            "status": "backlog"
        }
        result = validator.validate_with_defaults(data, "story")

        assert result["title"] == "Test story"
        assert result["status"] == "backlog"
        assert result["estimate"] == 0  # Default value

    def test_dont_override_existing_values(self, temp_schemas_dir):
        """Should not override existing values with defaults."""
        data = {
            "title": "Test story",
            "status": "backlog",
            "estimate": 5
        }
        result = validator.validate_with_defaults(data, "story")

        assert result["estimate"] == 5  # Original value preserved

    def test_validate_with_defaults_validates_first(self, temp_schemas_dir):
        """Should validate data before filling defaults."""
        data = {
            "status": "backlog"  # Missing required 'title'
        }
        with pytest.raises(validator.ValidationError):
            validator.validate_with_defaults(data, "story")


class TestIsSupportedSchema:
    """Tests for is_supported_schema function."""

    def test_supported_schemas(self):
        """Should return True for supported schemas."""
        assert validator.is_supported_schema("initiative") is True
        assert validator.is_supported_schema("epic") is True
        assert validator.is_supported_schema("story") is True
        assert validator.is_supported_schema("task") is True
        assert validator.is_supported_schema("session") is True
        assert validator.is_supported_schema("report") is True

    def test_unsupported_schema(self):
        """Should return False for unsupported schemas."""
        assert validator.is_supported_schema("unknown") is False
        assert validator.is_supported_schema("custom") is False


class TestSupportedSchemasList:
    """Tests for SUPPORTED_SCHEMAS constant."""

    def test_all_entity_types_included(self):
        """Should include all 10 entity types."""
        expected = [
            "initiative",
            "epic",
            "story",
            "intake",
            "checkpoint",
            "decision",
            "release-note",
            "task",
            "session",
            "report"
        ]
        assert set(validator.SUPPORTED_SCHEMAS) == set(expected)
        assert len(validator.SUPPORTED_SCHEMAS) == 10


class TestErrorMessages:
    """Tests for error message formatting."""

    def test_validation_error_includes_schema_name(self, temp_schemas_dir):
        """Validation errors should include schema name."""
        data = {"status": "done"}  # Missing 'title'
        with pytest.raises(validator.ValidationError, match="story"):
            validator.validate(data, "story")

    def test_validation_error_includes_path(self, temp_schemas_dir):
        """Validation errors should include field path."""
        data = {
            "title": "Test",
            "status": "done",
            "tags": [1, 2, 3]  # Should be strings
        }
        with pytest.raises(validator.ValidationError, match="tags"):
            validator.validate(data, "story")
