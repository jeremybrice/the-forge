"""Session operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
session entities (debates, explorations).

Sessions are markdown files with YAML frontmatter stored in type-specific directories.
Sessions use date-based filenames: YYYY-MM-DD-slug.md
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, slug, validator, index_ops


class SessionError(Exception):
    """Raised when session operations fail."""
    pass


# Session types that are supported
SESSION_TYPES = ['debate', 'exploration']

# Status values
SESSION_STATUSES = ['Active', 'Paused', 'Completed']


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


def _get_session_directory(base_directory: str, session_type: str) -> Path:
    """Get the directory path for a session type.

    Args:
        base_directory: Base directory containing session directories
        session_type: Type of session (debate, exploration)

    Returns:
        Path to session directory

    Examples:
        debate → {base}/sessions/debates/
        exploration → {base}/sessions/explorations/
    """
    if session_type not in SESSION_TYPES:
        raise SessionError(f"Unknown session type: {session_type}")

    # Map session type to directory name (pluralized)
    directory_map = {
        'debate': 'debates',
        'exploration': 'explorations'
    }

    directory_name = directory_map[session_type]
    return Path(base_directory) / 'sessions' / directory_name


def _generate_session_filename(session_type: str, title: str, created_date: date, directory: Path) -> str:
    """Generate session filename with date-based pattern: YYYY-MM-DD-slug.md

    Args:
        session_type: Type of session (debate, exploration)
        title: Session title for slug generation
        created_date: Date for filename prefix
        directory: Directory where session will be created (for uniqueness check)

    Returns:
        Filename string in format: YYYY-MM-DD-slug.md

    Examples:
        "AI Safety Alignment" + 2024-03-15 → "2024-03-15-ai-safety-alignment.md"
        "Emergent Complexity" + 2024-03-15 → "2024-03-15-emergent-complexity.md"
    """
    # Generate base slug from title
    base_slug = slug.generate_slug(title)

    # Format date as YYYY-MM-DD
    date_prefix = created_date.strftime("%Y-%m-%d")

    # Combine date and slug
    filename = f"{date_prefix}-{base_slug}.md"

    # Check for uniqueness - if file exists, append -2, -3, etc
    counter = 2
    while (directory / filename).exists():
        filename = f"{date_prefix}-{base_slug}-{counter}.md"
        counter += 1

    return filename


def session_init(directory: str) -> Dict[str, Any]:
    """Initialize sessions directory structure.

    Creates:
    - sessions/ directory
    - sessions/debates/ directory
    - sessions/explorations/ directory
    - sessions/index.json file

    Args:
        directory: Base directory for sessions

    Returns:
        Dictionary with success status and created paths

    Raises:
        SessionError: If directory creation fails
    """
    try:
        base_path = Path(directory)
        sessions_path = base_path / 'sessions'

        # Create main sessions directory
        sessions_path.mkdir(parents=True, exist_ok=True)

        # Create subdirectories for each session type
        debates_path = sessions_path / 'debates'
        explorations_path = sessions_path / 'explorations'

        debates_path.mkdir(exist_ok=True)
        explorations_path.mkdir(exist_ok=True)

        # Index will be created automatically when first session is added
        index_path = sessions_path / 'index.json'

        return {
            'success': True,
            'sessions_directory': str(sessions_path),
            'debates_directory': str(debates_path),
            'explorations_directory': str(explorations_path),
            'index_path': str(index_path)
        }

    except Exception as e:
        raise SessionError(f"Failed to initialize sessions directory: {str(e)}")


def create_session(session_type: str, data: Dict[str, Any], directory: str) -> Dict[str, Any]:
    """Create a new session file.

    Args:
        session_type: Type of session (debate, exploration)
        data: Session data dictionary (must include 'title', 'topic')
        directory: Base directory for sessions

    Returns:
        Dictionary with session frontmatter and file path

    Raises:
        SessionError: If validation fails or file creation fails

    Examples:
        create_session('debate', {
            'title': 'AI Safety Alignment',
            'topic': 'How should we approach AI safety?',
            'agents': ['challenger', 'explorer', 'synthesizer']
        }, '/path/to/project')
    """
    try:
        # Ensure session type is valid
        if session_type not in SESSION_TYPES:
            raise SessionError(f"Invalid session type: {session_type}. Must be one of {SESSION_TYPES}")

        # Add required fields if not present
        data['type'] = 'session'
        data['session_type'] = session_type

        # Add dates
        today = date.today()
        if 'created' not in data:
            data['created'] = today
        if 'updated' not in data:
            data['updated'] = today

        # Set defaults
        if 'agents' not in data:
            data['agents'] = []
        if 'status' not in data:
            data['status'] = 'Active'
        if 'rounds' not in data:
            data['rounds'] = None

        # Normalize dates for validation
        normalized_data = _normalize_dates(data)

        # Validate against schema
        try:
            validator.validate(normalized_data, 'session')
        except validator.ValidationError as e:
            raise SessionError(f"Validation failed: {e}")

        # Get session directory
        session_dir = _get_session_directory(directory, session_type)
        session_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename with date-based pattern
        filename = _generate_session_filename(
            session_type,
            data['title'],
            data['created'] if isinstance(data['created'], date) else datetime.strptime(data['created'], '%Y-%m-%d').date(),
            session_dir
        )
        filepath = session_dir / filename

        # Load template
        template_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(Path(__file__).parent.parent / 'templates'))
        )
        template = template_env.get_template('session.md.j2')

        # Render template with normalized dates
        content = template.render(**_normalize_dates(data))

        # Write file
        filepath.write_text(content, encoding='utf-8')

        # Update index
        sessions_path = Path(directory) / 'sessions'

        # Build index entry
        normalized_fm = _normalize_dates(data)
        entry = {
            'file': str(filepath.relative_to(sessions_path)),
            'title': normalized_fm['title'],
            'type': 'session',
            'session_type': session_type,
            'topic': normalized_fm['topic'],
            'agents': normalized_fm.get('agents', []),
            'status': normalized_fm.get('status', 'Active'),
            'rounds': normalized_fm.get('rounds'),
            'created': normalized_fm['created'],
            'updated': normalized_fm['updated']
        }

        try:
            index_ops.create_index_entry(str(sessions_path), entry)
        except index_ops.IndexError as e:
            # Non-fatal: index update failed, but session was created
            pass

        return {
            'success': True,
            'session': _normalize_dates(data),
            'file_path': str(filepath)
        }

    except SessionError:
        raise
    except Exception as e:
        raise SessionError(f"Failed to create session: {str(e)}")


def get_session(file_path: str) -> Dict[str, Any]:
    """Get a single session by file path.

    Args:
        file_path: Path to session file

    Returns:
        Dictionary with session frontmatter

    Raises:
        SessionError: If file not found or parse fails
    """
    try:
        filepath = Path(file_path)

        if not filepath.exists():
            raise SessionError(f"Session not found: {file_path}")

        # Read and parse file
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)

        # Normalize dates for JSON output
        return _normalize_dates(fm)

    except SessionError:
        raise
    except Exception as e:
        raise SessionError(f"Failed to read session: {str(e)}")


def query_sessions(filters: Optional[Dict[str, Any]], directory: str) -> List[Dict[str, Any]]:
    """Query sessions with optional filters.

    Args:
        filters: Optional dictionary of filters
            - session_type: Filter by session type (debate, exploration)
            - status: Filter by status (Active, Paused, Completed)
            - agent: Filter by agent presence in agents array
            - created_after: Filter by creation date (YYYY-MM-DD)
            - created_before: Filter by creation date (YYYY-MM-DD)
        directory: Base directory for sessions

    Returns:
        List of session dictionaries matching filters

    Raises:
        SessionError: If query fails

    Examples:
        query_sessions({'session_type': 'debate', 'status': 'Completed'}, '/path/to/project')
        query_sessions({'agent': 'challenger'}, '/path/to/project')
    """
    try:
        sessions_path = Path(directory) / 'sessions'

        # Read index
        try:
            index = index_ops.read_index(str(sessions_path))
            entries = index.get('entries', [])
        except index_ops.IndexError:
            # No index exists yet
            return []

        results = []

        for entry in entries:
            # Apply filters
            if filters:
                # Filter by session_type
                if 'session_type' in filters and entry.get('session_type') != filters['session_type']:
                    continue

                # Filter by status
                if 'status' in filters and entry.get('status') != filters['status']:
                    continue

                # Filter by agent presence
                if 'agent' in filters:
                    agents = entry.get('agents', [])
                    if filters['agent'] not in agents:
                        continue

                # Filter by created_after
                if 'created_after' in filters:
                    if entry.get('created', '') < filters['created_after']:
                        continue

                # Filter by created_before
                if 'created_before' in filters:
                    if entry.get('created', '') > filters['created_before']:
                        continue

            results.append(entry)

        return results

    except SessionError:
        raise
    except Exception as e:
        raise SessionError(f"Failed to query sessions: {str(e)}")


def update_session(file_path: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update an existing session file.

    Args:
        file_path: Path to session file
        updates: Dictionary of fields to update

    Returns:
        Dictionary with updated session frontmatter

    Raises:
        SessionError: If file not found, validation fails, or update fails

    Examples:
        update_session('/path/to/session.md', {'status': 'Completed', 'rounds': 3})
    """
    try:
        filepath = Path(file_path)

        if not filepath.exists():
            raise SessionError(f"Session not found: {file_path}")

        # Read existing file
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)

        # Apply updates
        for key, value in updates.items():
            if key in ['type', 'session_type', 'created']:
                # Don't allow updating immutable fields
                continue
            fm[key] = value

        # Update 'updated' date
        fm['updated'] = date.today()

        # Normalize dates for validation
        normalized_fm = _normalize_dates(fm)

        # Validate
        try:
            validator.validate(normalized_fm, 'session')
        except validator.ValidationError as e:
            raise SessionError(f"Validation failed: {e}")

        # Write updated file
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')

        # Update index
        sessions_path = filepath.parent.parent  # Go up from debates/explorations to sessions

        # Build file path for index update
        file_rel_path = str(filepath.relative_to(sessions_path))

        # Build updates dictionary for index
        index_updates = {
            'title': normalized_fm['title'],
            'topic': normalized_fm['topic'],
            'agents': normalized_fm.get('agents', []),
            'status': normalized_fm.get('status', 'Active'),
            'rounds': normalized_fm.get('rounds'),
            'updated': normalized_fm['updated']
        }

        try:
            index_ops.update_index_entry(str(sessions_path), file_rel_path, index_updates)
        except Exception as e:
            raise SessionError(f"Failed to update index: {str(e)}")

        return _normalize_dates(fm)

    except SessionError:
        raise
    except Exception as e:
        raise SessionError(f"Failed to update session: {str(e)}")
