"""
JSON Schema validation utilities for Forge entities.

This module provides validation functions for all Forge entity types using JSON Schema.
Schemas are loaded from the schemas/ directory and cached for performance.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from jsonschema import validate as jsonschema_validate, ValidationError as JsonSchemaValidationError, Draft7Validator, SchemaError


class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass


# Cache for loaded schemas
_schema_cache: Dict[str, Dict[str, Any]] = {}


def get_schema_path(schema_name: str) -> Path:
    """
    Get the full path to a schema file.

    Args:
        schema_name: Name of the schema (without .json extension)

    Returns:
        Path object pointing to the schema file

    Raises:
        ValidationError: If schema file doesn't exist
    """
    # Get the schemas directory relative to this file
    current_dir = Path(__file__).parent
    schemas_dir = current_dir.parent / "schemas"

    schema_path = schemas_dir / f"{schema_name}.json"

    if not schema_path.exists():
        raise ValidationError(f"Schema file not found: {schema_path}")

    return schema_path


def load_schema(schema_name: str, use_cache: bool = True) -> Dict[str, Any]:
    """
    Load a JSON Schema from the schemas/ directory.

    Args:
        schema_name: Name of the schema (without .json extension)
                    e.g., 'initiative', 'epic', 'story'
        use_cache: Whether to use cached schema (default: True)

    Returns:
        Dictionary containing the JSON Schema

    Raises:
        ValidationError: If schema file doesn't exist or contains invalid JSON
    """
    # Check cache first
    if use_cache and schema_name in _schema_cache:
        return _schema_cache[schema_name]

    schema_path = get_schema_path(schema_name)

    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON in schema file {schema_path}: {e}")
    except IOError as e:
        raise ValidationError(f"Error reading schema file {schema_path}: {e}")

    # Cache the loaded schema
    if use_cache:
        _schema_cache[schema_name] = schema

    return schema


def validate(data: Dict[str, Any], schema_name: str) -> None:
    """
    Validate data against a JSON Schema.

    Args:
        data: Dictionary of data to validate (typically frontmatter)
        schema_name: Name of the schema to validate against

    Raises:
        ValidationError: If validation fails with detailed error message
    """
    schema = load_schema(schema_name)

    try:
        jsonschema_validate(instance=data, schema=schema)
    except JsonSchemaValidationError as e:
        # Build a more helpful error message
        error_path = " -> ".join(str(p) for p in e.path) if e.path else "root"
        raise ValidationError(
            f"Validation failed for {schema_name} at {error_path}: {e.message}"
        )


def validate_schema(schema: Dict[str, Any]) -> bool:
    """
    Validate that a schema itself is a valid JSON Schema.

    Args:
        schema: Dictionary containing a JSON Schema

    Returns:
        True if valid

    Raises:
        ValidationError: If the schema is invalid
    """
    try:
        Draft7Validator.check_schema(schema)
        return True
    except (JsonSchemaValidationError, SchemaError) as e:
        raise ValidationError(f"Invalid JSON Schema: {e.message}")


def clear_cache() -> None:
    """
    Clear the schema cache.

    Useful for testing or when schemas are updated at runtime.
    """
    global _schema_cache
    _schema_cache = {}


def get_cached_schemas() -> list[str]:
    """
    Get list of currently cached schema names.

    Returns:
        List of schema names that are currently cached
    """
    return list(_schema_cache.keys())


def validate_with_defaults(data: Dict[str, Any], schema_name: str) -> Dict[str, Any]:
    """
    Validate data and fill in default values from schema.

    Args:
        data: Dictionary of data to validate
        schema_name: Name of the schema to validate against

    Returns:
        Dictionary with defaults filled in

    Raises:
        ValidationError: If validation fails
    """
    schema = load_schema(schema_name)

    # First validate the data
    validate(data, schema_name)

    # Create a copy to avoid modifying the original
    result = data.copy()

    # Fill in defaults if specified in schema
    if "properties" in schema:
        for prop_name, prop_schema in schema["properties"].items():
            if prop_name not in result and "default" in prop_schema:
                result[prop_name] = prop_schema["default"]

    return result


# List of supported entity types
SUPPORTED_SCHEMAS = [
    "initiative",
    "epic",
    "story",
    "intake",
    "checkpoint",
    "decision",
    "release-note",
    "task",
    "session",
    "report",
    "harvest",
    "recording",
]


def is_supported_schema(schema_name: str) -> bool:
    """
    Check if a schema name is supported.

    Args:
        schema_name: Name of the schema

    Returns:
        True if the schema is in the supported list
    """
    return schema_name in SUPPORTED_SCHEMAS
