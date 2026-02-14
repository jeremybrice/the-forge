"""Task operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
task entities with sequential numbering (task-001, task-002, etc.).

Tasks are markdown files with YAML frontmatter stored in the tasks/ directory.
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, slug, validator, index_ops


class TaskError(Exception):
    """Raised when task operations fail."""
    pass


# Status state machine
VALID_STATUS_TRANSITIONS = {
    'Open': ['In Progress', 'Cancelled'],
    'In Progress': ['Blocked', 'Completed', 'Cancelled', 'Open'],
    'Blocked': ['In Progress', 'Open', 'Cancelled'],
    'Completed': ['Open'],  # Allow reopening completed tasks
    'Cancelled': ['Open']   # Allow reopening cancelled tasks
}

VALID_STATUSES = ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled']


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


def _get_task_directory(directory: str = '.') -> Path:
    """Get the tasks directory path.

    Args:
        directory: Base directory containing tasks directory

    Returns:
        Path to tasks directory
    """
    return Path(directory) / 'tasks'


def _generate_task_filename(directory: Path) -> str:
    """Generate sequential filename for a task (task-001.md, task-002.md, etc.).

    Args:
        directory: Tasks directory

    Returns:
        Filename with .md extension

    Raises:
        TaskError: If filename generation fails
    """
    import re

    # Scan directory for existing task files (task-NNN.md pattern)
    max_num = 0
    if directory.exists():
        pattern = re.compile(r'^task-(\d{3})\.md$')
        for filename in directory.iterdir():
            match = pattern.match(filename.name)
            if match:
                num = int(match.group(1))
                max_num = max(max_num, num)

    # Next number
    next_num = max_num + 1
    return f"task-{next_num:03d}.md"


def _load_template() -> jinja2.Template:
    """Load Jinja2 template for tasks.

    Returns:
        Jinja2 Template object

    Raises:
        TaskError: If template loading fails
    """
    # Get templates directory (sibling to core/)
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_path = templates_dir / 'task.md.j2'

    if not template_path.exists():
        raise TaskError(f"Template not found: {template_path}")

    try:
        # Load template from file
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        template = template_env.get_template('task.md.j2')
        return template
    except jinja2.TemplateError as e:
        raise TaskError(f"Failed to load template: {e}")


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


def task_init(directory: str = '.') -> Dict[str, Any]:
    """Initialize tasks directory structure.

    Creates the tasks/ directory if it doesn't exist.

    Args:
        directory: Base directory for task storage

    Returns:
        Dictionary with initialization status:
        {
            'success': True,
            'directory': '/path/to/tasks',
            'created': True/False
        }

    Raises:
        TaskError: If directory creation fails
    """
    task_dir = _get_task_directory(directory)

    created = False
    if not task_dir.exists():
        try:
            task_dir.mkdir(parents=True, exist_ok=True)
            created = True
        except OSError as e:
            raise TaskError(f"Failed to create tasks directory: {e}")

    return {
        'success': True,
        'directory': str(task_dir),
        'created': created
    }


def create_task(
    data: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Create a new task file with sequential numbering.

    Args:
        data: Frontmatter data for the task
        directory: Base directory for task storage (default: current directory)
        validate: Whether to validate data against schema (default: True)

    Returns:
        Dictionary with task metadata:
        {
            'filename': 'task-001.md',
            'filepath': '/full/path/to/task-001.md',
            'task_number': '001',
            'title': 'Task Title',
            'status': 'Open',
            'created': '2026-02-14',
            'updated': '2026-02-14'
        }

    Raises:
        TaskError: If task creation fails
        validator.ValidationError: If data validation fails

    Examples:
        >>> data = {
        ...     'title': 'Implement authentication',
        ...     'status': 'Open',
        ...     'priority': 1,
        ...     'description': 'Add JWT-based auth'
        ... }
        >>> result = create_task(data)
        >>> result['filename']
        'task-001.md'
    """
    # Ensure type field is 'task'
    if 'type' not in data:
        data['type'] = 'task'
    elif data['type'] != 'task':
        raise TaskError(f"Data type '{data['type']}' must be 'task'")

    # Set default status if not present
    if 'status' not in data:
        data['status'] = 'Open'

    # Validate status
    if data['status'] not in VALID_STATUSES:
        raise TaskError(f"Invalid status: {data['status']}. Must be one of {VALID_STATUSES}")

    # Add created/updated dates if not present
    today = date.today().strftime("%Y-%m-%d")
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate data against schema
    if validate:
        try:
            validator.validate(data, 'task')
        except validator.ValidationError as e:
            raise TaskError(f"Validation failed: {e}")

    # Get task directory and ensure it exists
    task_dir = _get_task_directory(directory)
    task_dir.mkdir(parents=True, exist_ok=True)

    # Generate sequential filename
    filename = _generate_task_filename(task_dir)
    filepath = task_dir / filename

    # Check if file already exists (shouldn't happen with sequential numbering)
    if filepath.exists():
        raise TaskError(f"Task already exists: {filepath}")

    # Extract task number from filename (task-001.md → 001)
    task_number = filename.replace('task-', '').replace('.md', '')

    # Load template and render
    template = _load_template()
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise TaskError(f"Failed to render template: {e}")

    # Write task file
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise TaskError(f"Failed to write task file: {e}")

    # Add to index
    try:
        # Build index entry
        entry = {
            'file': filename,
            'type': 'task',
            'title': data['title'],
            'status': data['status'],
            'priority': data.get('priority', 3),
            'created': data['created'],
            'updated': data['updated']
        }
        # Add additional fields from data
        for key, value in data.items():
            if key not in entry:
                entry[key] = value

        index_ops.create_index_entry(str(task_dir), entry)
    except index_ops.IndexError as e:
        # Non-fatal: index update failed, but task was created
        pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'task_number': task_number,
        'title': data['title'],
        'status': data['status'],
        'created': data['created'],
        'updated': data['updated']
    }


def get_task(filename: str, directory: str = '.') -> Dict[str, Any]:
    """Read a task file and return its frontmatter data.

    Args:
        filename: Filename (with or without .md extension)
        directory: Base directory for task storage

    Returns:
        Dictionary with task frontmatter data

    Raises:
        TaskError: If task file doesn't exist or can't be read
    """
    task_dir = _get_task_directory(directory)

    # Add .md extension if not present
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    filepath = task_dir / filename

    if not filepath.exists():
        raise TaskError(f"Task not found: {filename}")

    try:
        content = filepath.read_text(encoding='utf-8')
        fm, _ = frontmatter.parse(content)
        # Normalize dates for JSON serialization
        return _normalize_dates(fm)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise TaskError(f"Failed to read task: {e}")


def query_tasks(
    filters: Optional[Dict[str, Any]] = None,
    directory: str = '.'
) -> List[Dict[str, Any]]:
    """Query tasks with optional filters.

    Args:
        filters: Optional filters (status, priority, due_date, assignee, tags)
        directory: Base directory for task storage

    Returns:
        List of task dictionaries matching filters

    Examples:
        >>> # Get all open tasks
        >>> tasks = query_tasks({'status': 'Open'})
        >>> # Get high-priority tasks
        >>> tasks = query_tasks({'priority': 1})
        >>> # Get tasks by assignee
        >>> tasks = query_tasks({'assignee': 'alice'})
    """
    task_dir = _get_task_directory(directory)

    if not task_dir.exists():
        return []

    # Read index if available
    index_file = task_dir / 'index.json'
    if index_file.exists():
        try:
            index_data = index_ops.read_index(str(task_dir))
            tasks = index_data.get('entries', [])
        except index_ops.IndexError:
            # Fall back to file scanning
            tasks = _scan_task_files(task_dir)
    else:
        tasks = _scan_task_files(task_dir)

    # Apply filters if provided
    if filters:
        filtered_tasks = []
        for task in tasks:
            match = True
            for key, value in filters.items():
                if key == 'tags':
                    # Tag filtering: check if any requested tag is in task tags
                    task_tags = task.get('tags', [])
                    if not any(tag in task_tags for tag in value):
                        match = False
                        break
                elif key not in task or task[key] != value:
                    match = False
                    break
            if match:
                filtered_tasks.append(task)
        return filtered_tasks

    return tasks


def _scan_task_files(task_dir: Path) -> List[Dict[str, Any]]:
    """Scan task directory and read all task files.

    Args:
        task_dir: Path to tasks directory

    Returns:
        List of task dictionaries
    """
    tasks = []
    for filepath in sorted(task_dir.glob('task-*.md')):
        try:
            fm, _ = frontmatter.parse(str(filepath))
            fm['file'] = filepath.name
            tasks.append(fm)
        except frontmatter.FrontmatterError:
            # Skip files that can't be parsed
            continue
    return tasks


def update_task(
    filename: str,
    updates: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Update a task file.

    Args:
        filename: Filename (with or without .md extension)
        updates: Dictionary of fields to update
        directory: Base directory for task storage
        validate: Whether to validate status transitions (default: True)

    Returns:
        Dictionary with updated task metadata

    Raises:
        TaskError: If update fails or status transition is invalid
        validator.ValidationError: If updated data fails validation

    Examples:
        >>> # Update status
        >>> update_task('task-001', {'status': 'In Progress'})
        >>> # Update priority and due date
        >>> update_task('task-001', {'priority': 1, 'due_date': '2026-03-01'})
    """
    task_dir = _get_task_directory(directory)

    # Add .md extension if not present
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    filepath = task_dir / filename

    if not filepath.exists():
        raise TaskError(f"Task not found: {filename}")

    # Read current frontmatter
    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise TaskError(f"Failed to read task: {e}")

    # Validate status transition if status is being updated
    if validate and 'status' in updates:
        current_status = fm.get('status', 'Open')
        new_status = updates['status']
        if new_status not in VALID_STATUSES:
            raise TaskError(f"Invalid status: {new_status}. Must be one of {VALID_STATUSES}")
        if not _validate_status_transition(current_status, new_status):
            raise TaskError(
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
            validator.validate(normalized_fm, 'task')
        except validator.ValidationError as e:
            raise TaskError(f"Validation failed: {e}")

    # Write updated frontmatter
    try:
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')
    except (OSError, frontmatter.FrontmatterError) as e:
        raise TaskError(f"Failed to write task: {e}")

    # Update index
    try:
        # Normalize the frontmatter data for index (convert dates to strings)
        normalized_fm = _normalize_dates(fm)

        # Build index entry
        entry = {
            'file': filename,
            'type': 'task',
            'title': normalized_fm['title'],
            'status': normalized_fm['status'],
            'priority': normalized_fm.get('priority', 3),
            'created': normalized_fm['created'],
            'updated': normalized_fm['updated']
        }
        # Add additional fields from normalized_fm
        for key, value in normalized_fm.items():
            if key not in entry:
                entry[key] = value

        index_ops.update_index_entry(str(task_dir), filename, entry)
    except index_ops.IndexError as e:
        # Re-raise to see the actual error
        raise TaskError(f"Index update failed: {e}")

    return {
        'filename': filename,
        'filepath': str(filepath),
        'title': fm['title'],
        'status': fm['status'],
        'updated': fm['updated']
    }
