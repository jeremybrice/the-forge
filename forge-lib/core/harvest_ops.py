"""Harvest operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
harvest entities for the slack-forge plugin. Harvests are items extracted from
Slack channels using a review-first workflow.

Harvest files use date-prefixed sequential naming:
  YYYY-MM-DD-{harvest_type}-NNN.md

Harvests are markdown files with YAML frontmatter stored in the slack-forge/ directory.
"""

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, validator, index_ops


class HarvestError(Exception):
    """Raised when harvest operations fail."""
    pass


# Status state machine — review-first workflow
# pending → approved or rejected
# approved → promoted
# rejected and promoted are terminal states
VALID_STATUS_TRANSITIONS = {
    'pending': ['approved', 'rejected'],
    'approved': ['promoted'],
    # rejected and promoted are terminal — no transitions out
}

VALID_STATUSES = ['pending', 'approved', 'rejected', 'promoted']

# Mapping from harvest_type to filename segment
HARVEST_TYPE_FILENAME_MAP = {
    'task': 'task-harvest',
    'knowledge': 'knowledge-harvest',
    'jira-digest': 'jira-digest',
}


def _normalize_dates(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize date objects to strings for validation.

    Args:
        data: Dictionary potentially containing date objects

    Returns:
        Dictionary with dates converted to strings
    """
    result = {}
    for key, value in data.items():
        if isinstance(value, (date, datetime)):
            result[key] = value.strftime("%Y-%m-%d")
        elif isinstance(value, list):
            result[key] = [
                item.strftime("%Y-%m-%d") if isinstance(item, (date, datetime)) else item
                for item in value
            ]
        else:
            result[key] = value
    return result


def _get_harvest_directory(directory: str = '.') -> Path:
    """Get the slack-forge directory path.

    Args:
        directory: Base directory containing slack-forge directory

    Returns:
        Path to slack-forge directory
    """
    return Path(directory) / 'slack-forge'


def _generate_harvest_filename(directory: Path, harvest_type: str) -> str:
    """Generate sequential filename for a harvest record.

    Filenames follow the pattern: YYYY-MM-DD-{type-segment}-NNN.md
    Examples:
        2026-02-17-task-harvest-001.md
        2026-02-17-knowledge-harvest-001.md
        2026-02-17-jira-digest-001.md

    Args:
        directory: Harvest directory (slack-forge/)
        harvest_type: One of 'task', 'knowledge', 'jira-digest'

    Returns:
        Filename with .md extension

    Raises:
        HarvestError: If harvest_type is invalid or filename generation fails
    """
    if harvest_type not in HARVEST_TYPE_FILENAME_MAP:
        raise HarvestError(
            f"Invalid harvest_type: {harvest_type}. "
            f"Must be one of {list(HARVEST_TYPE_FILENAME_MAP.keys())}"
        )

    type_segment = HARVEST_TYPE_FILENAME_MAP[harvest_type]
    today_str = date.today().strftime("%Y-%m-%d")

    # Build regex to match existing files for this type segment
    # Pattern: YYYY-MM-DD-{type_segment}-NNN.md
    escaped_segment = re.escape(type_segment)
    pattern = re.compile(
        r'^\d{4}-\d{2}-\d{2}-' + escaped_segment + r'-(\d{3})\.md$'
    )

    max_num = 0
    if directory.exists():
        for filename in directory.iterdir():
            match = pattern.match(filename.name)
            if match:
                num = int(match.group(1))
                max_num = max(max_num, num)

    next_num = max_num + 1
    return f"{today_str}-{type_segment}-{next_num:03d}.md"


def _load_template() -> jinja2.Template:
    """Load Jinja2 template for harvests.

    Returns:
        Jinja2 Template object

    Raises:
        HarvestError: If template loading fails
    """
    # Get templates directory (sibling to core/)
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_path = templates_dir / 'harvest.md.j2'

    if not template_path.exists():
        raise HarvestError(f"Template not found: {template_path}")

    try:
        # Load template from file
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        template = template_env.get_template('harvest.md.j2')
        return template
    except jinja2.TemplateError as e:
        raise HarvestError(f"Failed to load template: {e}")


def _validate_status_transition(from_status: str, to_status: str) -> bool:
    """Validate a status transition.

    Args:
        from_status: Current status
        to_status: Target status

    Returns:
        True if transition is valid, False otherwise
    """
    if from_status not in VALID_STATUS_TRANSITIONS:
        return False
    return to_status in VALID_STATUS_TRANSITIONS[from_status]


def harvest_init(directory: str = '.') -> Dict[str, Any]:
    """Initialize slack-forge directory structure.

    Creates the slack-forge/ directory if it doesn't exist.

    Args:
        directory: Base directory for harvest storage

    Returns:
        Dictionary with initialization status:
        {
            'success': True,
            'directory': '/path/to/slack-forge',
            'created': True/False
        }

    Raises:
        HarvestError: If directory creation fails
    """
    harvest_dir = _get_harvest_directory(directory)

    created = False
    if not harvest_dir.exists():
        try:
            harvest_dir.mkdir(parents=True, exist_ok=True)
            created = True
        except OSError as e:
            raise HarvestError(f"Failed to create slack-forge directory: {e}")

    return {
        'success': True,
        'directory': str(harvest_dir),
        'created': created
    }


def create_harvest(
    data: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Create a new harvest record file with date-prefixed sequential numbering.

    Args:
        data: Frontmatter data for the harvest record. Must include 'harvest_type'.
        directory: Base directory for harvest storage (default: current directory)
        validate: Whether to validate data against schema (default: True)

    Returns:
        Dictionary with harvest metadata:
        {
            'filename': '2026-02-17-task-harvest-001.md',
            'filepath': '/full/path/to/2026-02-17-task-harvest-001.md',
            'title': 'Harvest Title',
            'status': 'pending',
            'harvest_type': 'task',
            'created': '2026-02-17',
            'updated': '2026-02-17'
        }

    Raises:
        HarvestError: If harvest creation fails
        validator.ValidationError: If data validation fails

    Examples:
        >>> data = {
        ...     'title': 'Sprint planning tasks from #eng-team',
        ...     'harvest_type': 'task',
        ...     'source_channel': 'eng-team',
        ...     'source_channel_id': 'C01ABC123',
        ...     'scan_timeframe': '24h',
        ...     'scan_date': '2026-02-17',
        ...     'confidence': 'high'
        ... }
        >>> result = create_harvest(data)
        >>> result['filename']
        '2026-02-17-task-harvest-001.md'
    """
    # Don't mutate caller's dict
    data = data.copy()

    # Require harvest_type — needed for filename generation
    if 'harvest_type' not in data:
        raise HarvestError("harvest_type is required for harvest creation")

    harvest_type = data['harvest_type']
    if harvest_type not in HARVEST_TYPE_FILENAME_MAP:
        raise HarvestError(
            f"Invalid harvest_type: {harvest_type}. "
            f"Must be one of {list(HARVEST_TYPE_FILENAME_MAP.keys())}"
        )

    # Ensure type field is 'harvest'
    if 'type' not in data:
        data['type'] = 'harvest'
    elif data['type'] != 'harvest':
        raise HarvestError(f"Data type '{data['type']}' must be 'harvest'")

    # Set default status if not present
    if 'status' not in data:
        data['status'] = 'pending'

    # Validate status
    if data['status'] not in VALID_STATUSES:
        raise HarvestError(
            f"Invalid status: {data['status']}. Must be one of {VALID_STATUSES}"
        )

    # Set default optional fields
    if 'source_timestamp' not in data:
        data['source_timestamp'] = None
    if 'source_author' not in data:
        data['source_author'] = None
    if 'tags' not in data:
        data['tags'] = []

    # Add created/updated dates if not present
    today = date.today().strftime("%Y-%m-%d")
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Separate template-only fields before schema validation
    # These are used by the Jinja2 template but not part of the frontmatter schema
    _TEMPLATE_ONLY_FIELDS = {'content', 'source_context', 'action_items', 'jira_events'}
    template_extras = {k: data.pop(k) for k in _TEMPLATE_ONLY_FIELDS if k in data}

    # Validate data against schema
    if validate:
        try:
            validator.validate(data, 'harvest')
        except validator.ValidationError as e:
            raise HarvestError(f"Validation failed: {e}")

    # Merge template-only fields back for rendering
    data.update(template_extras)

    # Get harvest directory and ensure it exists
    harvest_dir = _get_harvest_directory(directory)
    harvest_dir.mkdir(parents=True, exist_ok=True)

    # Generate sequential filename
    filename = _generate_harvest_filename(harvest_dir, harvest_type)
    filepath = harvest_dir / filename

    # Check if file already exists (shouldn't happen with sequential numbering)
    if filepath.exists():
        raise HarvestError(f"Harvest already exists: {filepath}")

    # Load template and render
    template = _load_template()
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise HarvestError(f"Failed to render template: {e}")

    # Write harvest file
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise HarvestError(f"Failed to write harvest file: {e}")

    # Add to index
    try:
        # Normalize dates for index serialization
        normalized_data = _normalize_dates(data)

        # Build index entry
        entry = {
            'file': filename,
            'type': 'harvest',
            'title': normalized_data['title'],
            'status': normalized_data['status'],
            'harvest_type': normalized_data['harvest_type'],
            'source_channel': normalized_data['source_channel'],
            'confidence': normalized_data['confidence'],
            'created': normalized_data['created'],
            'updated': normalized_data['updated']
        }
        # Add additional schema fields (exclude template-only and already-added fields)
        for key, value in normalized_data.items():
            if key not in entry and key not in _TEMPLATE_ONLY_FIELDS:
                entry[key] = value

        index_ops.create_index_entry(str(harvest_dir), entry)
    except index_ops.IndexError:
        # Non-fatal: index is a cache; markdown file is the source of truth
        pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'title': data['title'],
        'status': data['status'],
        'harvest_type': data['harvest_type'],
        'created': data['created'],
        'updated': data['updated']
    }


def get_harvest(filename: str, directory: str = '.') -> Dict[str, Any]:
    """Read a harvest file and return its frontmatter data.

    Args:
        filename: Filename (with or without .md extension)
        directory: Base directory for harvest storage

    Returns:
        Dictionary with harvest frontmatter data

    Raises:
        HarvestError: If harvest file doesn't exist or can't be read
    """
    harvest_dir = _get_harvest_directory(directory)

    # Add .md extension if not present
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    filepath = harvest_dir / filename

    if not filepath.exists():
        raise HarvestError(f"Harvest not found: {filename}")

    try:
        content = filepath.read_text(encoding='utf-8')
        fm, _ = frontmatter.parse(content)
        # Normalize dates for JSON serialization
        return _normalize_dates(fm)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise HarvestError(f"Failed to read harvest: {e}")


def query_harvests(
    filters: Optional[Dict[str, Any]] = None,
    directory: str = '.'
) -> List[Dict[str, Any]]:
    """Query harvests with optional filters.

    Args:
        filters: Optional filters (status, harvest_type, source_channel,
                 confidence, tags, etc.)
        directory: Base directory for harvest storage

    Returns:
        List of harvest dictionaries matching filters

    Examples:
        >>> # Get all pending harvests
        >>> harvests = query_harvests({'status': 'pending'})
        >>> # Get task harvests
        >>> harvests = query_harvests({'harvest_type': 'task'})
        >>> # Get high-confidence harvests from a channel
        >>> harvests = query_harvests({'confidence': 'high', 'source_channel': 'eng-team'})
    """
    harvest_dir = _get_harvest_directory(directory)

    if not harvest_dir.exists():
        return []

    # Read index if available
    index_file = harvest_dir / 'index.json'
    if index_file.exists():
        try:
            index_data = index_ops.read_index(str(harvest_dir))
            harvests = index_data.get('entries', [])
        except index_ops.IndexError:
            # Fall back to file scanning
            harvests = _scan_harvest_files(harvest_dir)
    else:
        harvests = _scan_harvest_files(harvest_dir)

    # Apply filters if provided
    if filters:
        filtered_harvests = []
        for harvest in harvests:
            match = True
            for key, value in filters.items():
                if key == 'tags':
                    # Tag filtering: check if any requested tag is in harvest tags
                    harvest_tags = harvest.get('tags', [])
                    if not any(tag in harvest_tags for tag in value):
                        match = False
                        break
                elif key not in harvest or harvest[key] != value:
                    match = False
                    break
            if match:
                filtered_harvests.append(harvest)
        return filtered_harvests

    return harvests


def _scan_harvest_files(harvest_dir: Path) -> List[Dict[str, Any]]:
    """Scan harvest directory and read all harvest files.

    Looks for files matching *-harvest-*.md and *-digest-*.md patterns.

    Args:
        harvest_dir: Path to slack-forge directory

    Returns:
        List of harvest dictionaries
    """
    harvests = []
    seen_files = set()

    # Scan for harvest and digest patterns
    for pattern in ['*-harvest-*.md', '*-digest-*.md']:
        for filepath in sorted(harvest_dir.glob(pattern)):
            if filepath.name in seen_files:
                continue
            seen_files.add(filepath.name)
            try:
                content = filepath.read_text(encoding='utf-8')
                fm, _ = frontmatter.parse(content)
                fm['file'] = filepath.name
                harvests.append(fm)
            except (OSError, frontmatter.FrontmatterError):
                # Skip files that can't be parsed
                continue

    return harvests


def update_harvest(
    filename: str,
    updates: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Update a harvest file.

    Args:
        filename: Filename (with or without .md extension)
        updates: Dictionary of fields to update
        directory: Base directory for harvest storage
        validate: Whether to validate status transitions (default: True)

    Returns:
        Dictionary with updated harvest metadata

    Raises:
        HarvestError: If update fails or status transition is invalid
        validator.ValidationError: If updated data fails validation

    Examples:
        >>> # Approve a harvest
        >>> update_harvest('2026-02-17-task-harvest-001', {'status': 'approved'})
        >>> # Promote an approved harvest
        >>> update_harvest('2026-02-17-task-harvest-001', {'status': 'promoted'})
    """
    harvest_dir = _get_harvest_directory(directory)

    # Add .md extension if not present
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    filepath = harvest_dir / filename

    if not filepath.exists():
        raise HarvestError(f"Harvest not found: {filename}")

    # Read current frontmatter
    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise HarvestError(f"Failed to read harvest: {e}")

    # Validate status transition if status is being updated
    if validate and 'status' in updates:
        current_status = fm.get('status', 'pending')
        new_status = updates['status']
        if new_status not in VALID_STATUSES:
            raise HarvestError(
                f"Invalid status: {new_status}. Must be one of {VALID_STATUSES}"
            )
        if not _validate_status_transition(current_status, new_status):
            raise HarvestError(
                f"Invalid status transition from '{current_status}' to '{new_status}'. "
                f"Valid transitions: {VALID_STATUS_TRANSITIONS.get(current_status, [])}"
            )

    # Apply updates
    for key, value in updates.items():
        fm[key] = value

    # Update 'updated' date
    fm['updated'] = date.today().strftime("%Y-%m-%d")

    # Normalize dates for validation
    normalized_fm = _normalize_dates(fm)

    # Validate updated data
    if validate:
        try:
            validator.validate(normalized_fm, 'harvest')
        except validator.ValidationError as e:
            raise HarvestError(f"Validation failed: {e}")

    # Write updated frontmatter
    try:
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')
    except (OSError, frontmatter.FrontmatterError) as e:
        raise HarvestError(f"Failed to write harvest: {e}")

    # Update index
    try:
        # Normalize the frontmatter data for index (convert dates to strings)
        normalized_fm = _normalize_dates(fm)

        # Build index entry
        entry = {
            'file': filename,
            'type': 'harvest',
            'title': normalized_fm['title'],
            'status': normalized_fm['status'],
            'harvest_type': normalized_fm['harvest_type'],
            'source_channel': normalized_fm['source_channel'],
            'confidence': normalized_fm['confidence'],
            'created': normalized_fm['created'],
            'updated': normalized_fm['updated']
        }
        # Add additional schema fields (exclude template-only fields)
        _TEMPLATE_ONLY_FIELDS = {'content', 'source_context', 'action_items', 'jira_events'}
        for key, value in normalized_fm.items():
            if key not in entry and key not in _TEMPLATE_ONLY_FIELDS:
                entry[key] = value

        index_ops.update_index_entry(str(harvest_dir), filename, entry)
    except index_ops.IndexError:
        # Non-fatal: index is a cache; markdown file is the source of truth
        pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'title': fm['title'],
        'status': fm['status'],
        'harvest_type': fm['harvest_type'],
        'updated': fm['updated']
    }


def get_config(directory: str = '.') -> Dict[str, Any]:
    """Read the slack-forge configuration file.

    Returns a default empty config if config.json doesn't exist.

    Args:
        directory: Base directory containing slack-forge/

    Returns:
        Configuration dictionary with structure:
        {
            'channels': [...],
            'jira_channel': '...' or null,
            'updated': 'YYYY-MM-DD' or null
        }

    Raises:
        HarvestError: If config file exists but can't be read or parsed
    """
    harvest_dir = _get_harvest_directory(directory)
    config_path = harvest_dir / 'config.json'

    # Return default config if file doesn't exist
    if not config_path.exists():
        return {
            'channels': [],
            'jira_channel': None,
            'updated': None
        }

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return config
    except json.JSONDecodeError as e:
        raise HarvestError(f"Invalid JSON in config file {config_path}: {e}")
    except OSError as e:
        raise HarvestError(f"Failed to read config file {config_path}: {e}")


def set_config(directory: str = '.', config_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Write the slack-forge configuration file.

    Automatically sets the 'updated' field to today's date.

    Args:
        directory: Base directory containing slack-forge/
        config_data: Configuration data to write. Expected structure:
            {
                'channels': [...],
                'jira_channel': '...' or null
            }

    Returns:
        The written configuration dictionary (with updated timestamp)

    Raises:
        HarvestError: If write fails or directory doesn't exist
    """
    if config_data is None:
        config_data = {}

    harvest_dir = _get_harvest_directory(directory)

    # Ensure directory exists
    if not harvest_dir.exists():
        raise HarvestError(
            f"slack-forge directory does not exist: {harvest_dir}. "
            "Run harvest_init first."
        )

    # Auto-set updated timestamp
    config_data['updated'] = date.today().strftime("%Y-%m-%d")

    config_path = harvest_dir / 'config.json'

    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
    except OSError as e:
        raise HarvestError(f"Failed to write config file {config_path}: {e}")

    return config_data
