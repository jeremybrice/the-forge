"""Index operations for forge-lib.

This module provides functions for creating, reading, updating, and rebuilding
index.json files. Index files provide fast metadata lookups without parsing
all markdown files.

Index files are caches - the markdown files are the source of truth.
Indexes can always be rebuilt from the markdown files on disk.
"""

import json
import os
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any
from . import frontmatter


class IndexError(Exception):
    """Raised when index operations fail."""
    pass


def _serialize_value(value: Any) -> Any:
    """Convert values to JSON-serializable types.

    Args:
        value: Value to serialize

    Returns:
        JSON-serializable value
    """
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    elif isinstance(value, list):
        return [_serialize_value(item) for item in value]
    elif isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    else:
        return value


def read_index(directory: str) -> Dict[str, Any]:
    """Read and parse an index.json file.

    Args:
        directory: Directory containing index.json

    Returns:
        Dictionary with index data

    Raises:
        IndexError: If index file doesn't exist or is invalid JSON
    """
    index_path = Path(directory) / "index.json"

    if not index_path.exists():
        # Return empty index structure if file doesn't exist
        return {
            "schema_version": "1.0",
            "plugin": "",
            "updated": datetime.now().strftime("%Y-%m-%d"),
            "entries": []
        }

    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Validate required fields
        if not isinstance(data, dict):
            raise IndexError(f"Index file is not a JSON object: {index_path}")

        if "entries" not in data:
            raise IndexError(f"Index file missing 'entries' field: {index_path}")

        if not isinstance(data["entries"], list):
            raise IndexError(f"Index 'entries' field is not a list: {index_path}")

        return data

    except json.JSONDecodeError as e:
        raise IndexError(f"Invalid JSON in index file {index_path}: {e}")
    except Exception as e:
        raise IndexError(f"Failed to read index file {index_path}: {e}")


def write_index(directory: str, index_data: Dict[str, Any]) -> None:
    """Write index data to index.json file.

    Uses atomic write (write to temp file, then rename) to prevent corruption.

    Args:
        directory: Directory to write index.json to
        index_data: Index data dictionary

    Raises:
        IndexError: If write fails
    """
    index_path = Path(directory) / "index.json"
    temp_path = index_path.with_suffix(".json.tmp")

    try:
        # Ensure directory exists
        os.makedirs(directory, exist_ok=True)

        # Validate index structure
        if not isinstance(index_data, dict):
            raise IndexError("Index data must be a dictionary")

        if "entries" not in index_data:
            raise IndexError("Index data missing 'entries' field")

        if not isinstance(index_data["entries"], list):
            raise IndexError("Index 'entries' field must be a list")

        # Update timestamp
        index_data["updated"] = datetime.now().strftime("%Y-%m-%d")

        # Write to temp file first
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)

        # Atomic rename
        temp_path.replace(index_path)

    except Exception as e:
        # Clean up temp file if it exists
        if temp_path.exists():
            temp_path.unlink()
        raise IndexError(f"Failed to write index file {index_path}: {e}")


def create_index_entry(
    directory: str,
    entry: Dict[str, Any],
    plugin: str = ""
) -> None:
    """Add a new entry to the index.json file.

    Args:
        directory: Directory containing index.json
        entry: Entry metadata dictionary with fields like:
            - file: Relative path to markdown file
            - type: Entity type (initiative, epic, story, etc.)
            - title: Entity title
            - status: Entity status
            - created: Creation date (YYYY-MM-DD)
            - updated: Last update date (YYYY-MM-DD)
            Plus type-specific fields
        plugin: Plugin name (e.g., "product-forge")

    Raises:
        IndexError: If entry is invalid or write fails
    """
    # Validate required fields
    required_fields = ["file", "type", "title"]
    for field in required_fields:
        if field not in entry:
            raise IndexError(f"Entry missing required field: {field}")

    # Read existing index
    index_data = read_index(directory)

    # Set plugin if provided
    if plugin:
        index_data["plugin"] = plugin

    # Check for duplicate file path
    existing_files = {e.get("file") for e in index_data["entries"]}
    if entry["file"] in existing_files:
        raise IndexError(f"Entry already exists for file: {entry['file']}")

    # Add entry
    index_data["entries"].append(entry)

    # Write updated index
    write_index(directory, index_data)


def update_index_entry(
    directory: str,
    file_path: str,
    updates: Dict[str, Any]
) -> None:
    """Update an existing entry in the index.json file.

    Args:
        directory: Directory containing index.json
        file_path: Relative path to markdown file (used as entry identifier)
        updates: Dictionary of fields to update

    Raises:
        IndexError: If entry not found or write fails
    """
    # Read existing index
    index_data = read_index(directory)

    # Find entry
    entry_index = None
    for i, entry in enumerate(index_data["entries"]):
        if entry.get("file") == file_path:
            entry_index = i
            break

    if entry_index is None:
        raise IndexError(f"Entry not found for file: {file_path}")

    # Update entry fields
    index_data["entries"][entry_index].update(updates)

    # Update timestamp
    index_data["entries"][entry_index]["updated"] = datetime.now().strftime("%Y-%m-%d")

    # Write updated index
    write_index(directory, index_data)


def delete_index_entry(
    directory: str,
    file_path: str
) -> None:
    """Remove an entry from the index.json file.

    Args:
        directory: Directory containing index.json
        file_path: Relative path to markdown file (used as entry identifier)

    Raises:
        IndexError: If entry not found or write fails
    """
    # Read existing index
    index_data = read_index(directory)

    # Find and remove entry
    original_count = len(index_data["entries"])
    index_data["entries"] = [
        e for e in index_data["entries"]
        if e.get("file") != file_path
    ]

    if len(index_data["entries"]) == original_count:
        raise IndexError(f"Entry not found for file: {file_path}")

    # Write updated index
    write_index(directory, index_data)


def query_index(
    directory: str,
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Query index.json for entries matching filters.

    Args:
        directory: Directory containing index.json
        filters: Optional dictionary of field filters, e.g.:
            {"type": "story", "status": "Open"}
            {"parent": "notification-system-overhaul"}

    Returns:
        List of matching entries
    """
    index_data = read_index(directory)
    entries = index_data["entries"]

    if not filters:
        return entries

    # Filter entries
    results = []
    for entry in entries:
        match = True
        for key, value in filters.items():
            # Handle special cases
            if key == "type" and entry.get("type") != value:
                match = False
                break
            elif key in entry:
                # Exact match for other fields
                if entry[key] != value:
                    match = False
                    break
            else:
                # Field doesn't exist in entry
                match = False
                break

        if match:
            results.append(entry)

    return results


def rebuild_index(
    directory: str,
    plugin: str = "",
    entity_types: Optional[List[str]] = None
) -> int:
    """Rebuild index.json from all markdown files in directory tree.

    Scans directory recursively for .md files, parses YAML frontmatter,
    and regenerates index.json from scratch.

    Args:
        directory: Root directory to scan
        plugin: Plugin name (e.g., "product-forge")
        entity_types: Optional list of entity type folders to scan
                     (e.g., ["initiatives", "epics", "stories"])
                     If None, scans all subdirectories

    Returns:
        Number of entries indexed

    Raises:
        IndexError: If directory doesn't exist or rebuild fails
    """
    dir_path = Path(directory)

    if not dir_path.exists():
        raise IndexError(f"Directory does not exist: {directory}")

    if not dir_path.is_dir():
        raise IndexError(f"Path is not a directory: {directory}")

    # Initialize new index
    index_data = {
        "schema_version": "1.0",
        "plugin": plugin,
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "entries": []
    }

    # Determine directories to scan
    if entity_types:
        scan_dirs = [dir_path / entity_type for entity_type in entity_types]
    else:
        # Scan all subdirectories
        scan_dirs = [d for d in dir_path.iterdir() if d.is_dir()]

    # Scan each directory
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue

        # Find all .md files (excluding index.json)
        for md_file in scan_dir.rglob("*.md"):
            try:
                # Parse frontmatter
                fm, body = frontmatter.parse(md_file.read_text(encoding='utf-8'))

                if not fm:
                    continue  # Skip files without frontmatter

                # Build index entry
                entry = {
                    "file": str(md_file.relative_to(dir_path)),
                    "type": fm.get("type", ""),
                    "title": fm.get("title", ""),
                }

                # Add common optional fields
                optional_fields = [
                    "status", "product", "module", "client",
                    "parent", "children", "created", "updated",
                    "priority", "due_date", "assigned_to",
                    "session_type", "report_type", "agents"
                ]

                for field in optional_fields:
                    if field in fm:
                        entry[field] = _serialize_value(fm[field])

                index_data["entries"].append(entry)

            except Exception as e:
                # Skip files that can't be parsed
                # (could log this in a real implementation)
                continue

    # Write rebuilt index
    write_index(directory, index_data)

    return len(index_data["entries"])


def get_entry_by_file(
    directory: str,
    file_path: str
) -> Optional[Dict[str, Any]]:
    """Get a single index entry by file path.

    Args:
        directory: Directory containing index.json
        file_path: Relative path to markdown file

    Returns:
        Entry dictionary or None if not found
    """
    index_data = read_index(directory)

    for entry in index_data["entries"]:
        if entry.get("file") == file_path:
            return entry

    return None


def entry_exists(
    directory: str,
    file_path: str
) -> bool:
    """Check if an entry exists in the index.

    Args:
        directory: Directory containing index.json
        file_path: Relative path to markdown file

    Returns:
        True if entry exists, False otherwise
    """
    return get_entry_by_file(directory, file_path) is not None
