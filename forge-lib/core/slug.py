"""
Slug generation and filename utilities for Forge entities.

Provides functions for:
- Generating URL-safe slugs from titles
- Sequential numbering for stories and tasks
- Date-based filename generation for checkpoints and release notes
"""

import re
import os
from datetime import date
from pathlib import Path
from typing import Optional


class SlugError(Exception):
    """Raised when slug generation fails."""
    pass


def generate_slug(text: str, max_length: int = 50) -> str:
    """
    Generate a URL-safe slug from text.

    Process:
    1. Convert to lowercase
    2. Replace spaces with hyphens
    3. Strip all non-alphanumeric characters except hyphens
    4. Collapse consecutive hyphens to single hyphen
    5. Trim leading/trailing hyphens
    6. Truncate to max_length

    Args:
        text: Input text to slugify
        max_length: Maximum slug length (default: 50)

    Returns:
        Slug string

    Raises:
        SlugError: If text is empty or results in empty slug

    Examples:
        >>> generate_slug("Review API spec")
        'review-api-spec'
        >>> generate_slug("Send PSR to Todd (Phoenix)")
        'send-psr-to-todd-phoenix'
        >>> generate_slug("Update JIRA & sync w/ team!!!")
        'update-jira-sync-w-team'
    """
    if not text or not text.strip():
        raise SlugError("Cannot generate slug from empty text")

    # Convert to lowercase
    slug = text.lower()

    # Replace spaces with hyphens
    slug = slug.replace(' ', '-')

    # Strip all non-alphanumeric characters except hyphens
    slug = re.sub(r'[^a-z0-9-]', '', slug)

    # Collapse consecutive hyphens to single hyphen
    slug = re.sub(r'-+', '-', slug)

    # Trim leading/trailing hyphens
    slug = slug.strip('-')

    # Truncate to max_length
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip('-')

    if not slug:
        raise SlugError(f"Generated slug is empty after processing: {text}")

    return slug


def get_next_sequential_number(directory: str, prefix: str, digits: int = 3) -> str:
    """
    Get the next sequential number for files in a directory.

    Scans the directory for files matching the pattern `{prefix}-NNN-*`
    and returns the next available number, zero-padded.

    Args:
        directory: Directory path to scan
        prefix: Filename prefix (e.g., 'story', 'task')
        digits: Number of digits for zero-padding (default: 3)

    Returns:
        Zero-padded number string (e.g., "001", "042")

    Raises:
        SlugError: If directory doesn't exist

    Examples:
        >>> get_next_sequential_number("cards/stories", "story")
        '010'  # If highest existing is story-009-...
        >>> get_next_sequential_number("tasks", "task")
        '001'  # If directory is empty
    """
    dir_path = Path(directory)

    if not dir_path.exists():
        raise SlugError(f"Directory does not exist: {directory}")

    if not dir_path.is_dir():
        raise SlugError(f"Path is not a directory: {directory}")

    # Pattern: {prefix}-NNN-*.md
    pattern = re.compile(rf'^{re.escape(prefix)}-(\d{{{digits}}})-.*\.md$')

    max_num = 0
    for filename in os.listdir(directory):
        match = pattern.match(filename)
        if match:
            num = int(match.group(1))
            max_num = max(max_num, num)

    next_num = max_num + 1
    return str(next_num).zfill(digits)


def generate_story_filename(title: str, stories_dir: str) -> str:
    """
    Generate a filename for a story card.

    Format: story-NNN-{slug}.md

    Args:
        title: Story title
        stories_dir: Path to stories directory

    Returns:
        Complete filename (e.g., "story-001-notification-template-builder.md")

    Raises:
        SlugError: If title is empty or directory doesn't exist
    """
    slug = generate_slug(title)
    number = get_next_sequential_number(stories_dir, "story")
    return f"story-{number}-{slug}.md"


def generate_task_filename(title: str, tasks_dir: str) -> str:
    """
    Generate a filename for a task.

    Format: task-NNN-{slug}.md

    Args:
        title: Task title
        tasks_dir: Path to tasks directory

    Returns:
        Complete filename (e.g., "task-042-review-api-spec.md")

    Raises:
        SlugError: If title is empty or directory doesn't exist
    """
    slug = generate_slug(title)
    number = get_next_sequential_number(tasks_dir, "task")
    return f"task-{number}-{slug}.md"


def generate_checkpoint_filename(title: str, checkpoint_date: Optional[date] = None) -> str:
    """
    Generate a filename for a checkpoint card.

    Format: checkpoint-YYYY-MM-DD-{slug}.md

    Args:
        title: Checkpoint title
        checkpoint_date: Date for checkpoint (defaults to today)

    Returns:
        Complete filename (e.g., "checkpoint-2026-02-08-notification-architecture-decisions.md")

    Raises:
        SlugError: If title is empty
    """
    slug = generate_slug(title)
    if checkpoint_date is None:
        checkpoint_date = date.today()

    date_str = checkpoint_date.strftime('%Y-%m-%d')
    return f"checkpoint-{date_str}-{slug}.md"


def generate_release_notes_filename(release_date: Optional[date] = None) -> str:
    """
    Generate a filename for release notes.

    Format: release-notes-YYMMDD.md

    Args:
        release_date: Date for release (defaults to today)

    Returns:
        Complete filename (e.g., "release-notes-260208.md")
    """
    if release_date is None:
        release_date = date.today()

    date_str = release_date.strftime('%y%m%d')
    return f"release-notes-{date_str}.md"


def generate_initiative_filename(title: str) -> str:
    """
    Generate a filename for an initiative card.

    Format: {slug}.md

    Args:
        title: Initiative title

    Returns:
        Complete filename (e.g., "notification-system-overhaul.md")

    Raises:
        SlugError: If title is empty
    """
    slug = generate_slug(title)
    return f"{slug}.md"


def generate_epic_filename(title: str) -> str:
    """
    Generate a filename for an epic card.

    Format: {slug}.md

    Args:
        title: Epic title

    Returns:
        Complete filename (e.g., "email-notification-engine.md")

    Raises:
        SlugError: If title is empty
    """
    slug = generate_slug(title)
    return f"{slug}.md"


def generate_decision_filename(title: str) -> str:
    """
    Generate a filename for a decision card.

    Format: {slug}.md

    Args:
        title: Decision title

    Returns:
        Complete filename (e.g., "use-event-driven-notification-pipeline.md")

    Raises:
        SlugError: If title is empty
    """
    slug = generate_slug(title)
    return f"{slug}.md"


def generate_intake_filename(product: str, feature: str) -> str:
    """
    Generate a filename for an intake card.

    Format: intake-{product}-{feature}.md

    Args:
        product: Product name
        feature: Feature name

    Returns:
        Complete filename (e.g., "intake-webapp-notification-system.md")

    Raises:
        SlugError: If product or feature is empty
    """
    product_slug = generate_slug(product)
    feature_slug = generate_slug(feature)
    return f"intake-{product_slug}-{feature_slug}.md"
