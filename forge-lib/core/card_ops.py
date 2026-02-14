"""Card operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
card entities (initiative, epic, story, intake, checkpoint, decision, release-note).

Cards are markdown files with YAML frontmatter stored in type-specific directories.
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, slug, validator, index_ops, relationship_ops


class CardError(Exception):
    """Raised when card operations fail."""
    pass


# Card types that are supported
CARD_TYPES = [
    'initiative',
    'epic',
    'story',
    'intake',
    'checkpoint',
    'decision',
    'release-note'
]

# Card types with sequential numbering (story-NNN-slug format)
SEQUENTIAL_CARD_TYPES = ['story']

# Card types with date-based naming (checkpoint-YYYY-MM-DD-slug format)
DATE_BASED_CARD_TYPES = ['checkpoint', 'release-note']


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


def _get_card_directory(base_directory: str, card_type: str) -> Path:
    """Get the directory path for a card type.

    Args:
        base_directory: Base directory containing card directories
        card_type: Type of card (initiative, epic, story, etc.)

    Returns:
        Path to card directory

    Examples:
        initiative → {base}/initiatives/
        epic → {base}/epics/
        story → {base}/stories/
        checkpoint → {base}/checkpoints/
        decision → {base}/decisions/
        intake → {base}/intakes/
        release-note → {base}/release-notes/
    """
    if card_type not in CARD_TYPES:
        raise CardError(f"Unknown card type: {card_type}")

    # Map card type to directory name (pluralized)
    directory_map = {
        'initiative': 'initiatives',
        'epic': 'epics',
        'story': 'stories',
        'intake': 'intakes',
        'checkpoint': 'checkpoints',
        'decision': 'decisions',
        'release-note': 'release-notes'
    }

    directory_name = directory_map[card_type]
    return Path(base_directory) / directory_name


def _resolve_card_filepath(slug_or_filename: str, directory: str = '.') -> Optional[str]:
    """Resolve a card slug or filename to its full filepath.

    Searches all card type directories for a matching file.

    Args:
        slug_or_filename: Card slug (without extension) or filename (with .md)
        directory: Base directory to search in

    Returns:
        Relative filepath (e.g., 'initiatives/customer-portal.md') or None if not found

    Examples:
        >>> _resolve_card_filepath('customer-portal', '.')
        'initiatives/customer-portal.md'
    """
    # Add .md extension if not present
    if not slug_or_filename.endswith('.md'):
        slug_or_filename = f"{slug_or_filename}.md"

    base_dir = Path(directory)

    # Search in all card type directories
    for card_type in CARD_TYPES:
        card_dir = _get_card_directory(directory, card_type)
        potential_path = card_dir / slug_or_filename

        if potential_path.exists():
            # Return path relative to base directory
            return str(potential_path.relative_to(base_dir))

    return None


def _generate_card_filename(card_type: str, title: str, directory: Path) -> str:
    """Generate filename for a card based on type and title.

    Args:
        card_type: Type of card
        title: Card title
        directory: Directory where card will be created

    Returns:
        Filename (with .md extension)

    Raises:
        CardError: If filename generation fails
    """
    try:
        if card_type in SEQUENTIAL_CARD_TYPES:
            # Sequential numbering: story-NNN-slug.md
            return slug.generate_story_filename(title, str(directory))
        elif card_type == 'checkpoint':
            # Date-based: checkpoint-YYYY-MM-DD-slug.md
            return slug.generate_checkpoint_filename(title)
        elif card_type == 'release-note':
            # Date-based: release-notes-YYMMDD.md
            return slug.generate_release_notes_filename()
        elif card_type == 'intake':
            # Special format: intake-{product}-{feature}.md
            # For now, use slug-based naming
            card_slug = slug.generate_slug(title)
            return f"intake-{card_slug}.md"
        else:
            # Simple slug-based: {slug}.md
            card_slug = slug.generate_slug(title)
            return f"{card_slug}.md"
    except slug.SlugError as e:
        raise CardError(f"Failed to generate filename: {e}")


def _load_template(card_type: str) -> jinja2.Template:
    """Load Jinja2 template for a card type.

    Args:
        card_type: Type of card

    Returns:
        Jinja2 Template object

    Raises:
        CardError: If template loading fails
    """
    # Get templates directory (sibling to core/)
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_path = templates_dir / f'{card_type}.md.j2'

    if not template_path.exists():
        raise CardError(f"Template not found: {template_path}")

    try:
        # Load template from file
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        template = template_env.get_template(f'{card_type}.md.j2')
        return template
    except jinja2.TemplateError as e:
        raise CardError(f"Failed to load template: {e}")


def create_card(
    card_type: str,
    data: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Create a new card file.

    Args:
        card_type: Type of card (initiative, epic, story, etc.)
        data: Frontmatter data for the card
        directory: Base directory for card storage (default: current directory)
        validate: Whether to validate data against schema (default: True)

    Returns:
        Dictionary with card metadata:
        {
            'filename': 'initiative-slug.md',
            'filepath': '/full/path/to/file.md',
            'card_type': 'initiative',
            'title': 'Card Title',
            'created': '2026-02-13',
            'updated': '2026-02-13'
        }

    Raises:
        CardError: If card creation fails
        validator.ValidationError: If data validation fails

    Examples:
        >>> data = {
        ...     'title': 'Customer Portal',
        ...     'type': 'initiative',
        ...     'status': 'Draft',
        ...     'product': 'WebApp',
        ...     'description': 'Build self-service portal'
        ... }
        >>> result = create_card('initiative', data)
        >>> result['filename']
        'customer-portal.md'
    """
    if card_type not in CARD_TYPES:
        raise CardError(f"Unknown card type: {card_type}")

    # Ensure type field matches card_type
    if 'type' not in data:
        data['type'] = card_type
    elif data['type'] != card_type:
        raise CardError(f"Data type '{data['type']}' does not match card_type '{card_type}'")

    # Add created/updated dates if not present
    today = date.today().strftime("%Y-%m-%d")
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate data against schema
    if validate:
        try:
            validator.validate(data, card_type)
        except validator.ValidationError as e:
            raise CardError(f"Validation failed: {e}")

    # Get card directory and ensure it exists
    card_dir = _get_card_directory(directory, card_type)
    card_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename
    filename = _generate_card_filename(card_type, data['title'], card_dir)
    filepath = card_dir / filename

    # Check if file already exists
    if filepath.exists():
        raise CardError(f"Card already exists: {filepath}")

    # Load template and render
    template = _load_template(card_type)
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise CardError(f"Failed to render template: {e}")

    # Write card file
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise CardError(f"Failed to write card file: {e}")

    # Add to index
    try:
        # Build index entry
        entry = {
            'file': filename,
            'type': data['type'],
            'title': data['title']
        }
        # Add additional fields from data
        for key, value in data.items():
            if key not in entry:
                entry[key] = value

        index_ops.create_index_entry(str(card_dir), entry)
    except index_ops.IndexError as e:
        # Non-fatal: index update failed, but card was created
        pass

    # Link to parent if specified
    if 'parent' in data and data['parent']:
        try:
            # Resolve parent slug to full filepath
            parent_filepath = _resolve_card_filepath(data['parent'], directory)
            if not parent_filepath:
                # Parent not found - this is non-fatal for card creation
                pass
            else:
                # Get child filepath relative to directory
                base_dir = Path(directory)
                child_filepath = str(filepath.relative_to(base_dir))

                relationship_ops.link_to_parent(
                    child_filepath=child_filepath,
                    parent_filepath=parent_filepath,
                    directory=directory
                )
        except relationship_ops.RelationshipError as e:
            # Non-fatal: relationship update failed, but card was created
            pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'card_type': card_type,
        'title': data['title'],
        'created': data['created'],
        'updated': data['updated']
    }


def get_card(card_type: str, filename: str, directory: str = '.') -> Dict[str, Any]:
    """Read a card file and return its frontmatter data.

    Args:
        card_type: Type of card
        filename: Filename (with or without .md extension)
        directory: Base directory for card storage

    Returns:
        Dictionary with card frontmatter data

    Raises:
        CardError: If card reading fails or card not found

    Examples:
        >>> card = get_card('initiative', 'customer-portal.md')
        >>> card['title']
        'Customer Portal'
    """
    if card_type not in CARD_TYPES:
        raise CardError(f"Unknown card type: {card_type}")

    # Ensure filename has .md extension
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    # Get card directory and file path
    card_dir = _get_card_directory(directory, card_type)
    filepath = card_dir / filename

    if not filepath.exists():
        raise CardError(f"Card not found: {filepath}")

    # Read and parse file
    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
        return fm
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CardError(f"Failed to read card: {e}")


def query_cards(
    card_type: Optional[str] = None,
    directory: str = '.',
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Query cards by type and filters using index.json.

    Args:
        card_type: Type of card to query (if None, query all card types)
        directory: Base directory for card storage
        filters: Optional filters to apply:
            - status: Card status value
            - product: Product name
            - parent: Parent card filename
            - client: Client name
            - team: Team name

    Returns:
        List of card metadata dictionaries

    Examples:
        >>> # Get all initiatives
        >>> cards = query_cards('initiative')

        >>> # Get all stories for a product with status 'In Progress'
        >>> cards = query_cards('story', filters={'product': 'WebApp', 'status': 'In Progress'})

        >>> # Get all cards (all types)
        >>> cards = query_cards()
    """
    filters = filters or {}
    results = []

    # Determine which card types to query
    types_to_query = [card_type] if card_type else CARD_TYPES

    for ctype in types_to_query:
        if ctype not in CARD_TYPES:
            continue

        try:
            card_dir = _get_card_directory(directory, ctype)

            # Skip if directory doesn't exist
            if not card_dir.exists():
                continue

            # Read index
            try:
                index_data = index_ops.read_index(str(card_dir))
            except index_ops.IndexError:
                # No index file, skip this directory
                continue

            # Filter cards
            for entry in index_data.get('entries', []):
                # Apply filters
                if filters:
                    match = True
                    for key, value in filters.items():
                        if key not in entry or entry[key] != value:
                            match = False
                            break
                    if not match:
                        continue

                # Add entry to results
                results.append(entry)

        except CardError:
            # Skip directories that can't be processed
            continue

    return results


def update_card(
    card_type: str,
    filename: str,
    updates: Dict[str, Any],
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Update a card's frontmatter fields.

    Args:
        card_type: Type of card
        filename: Filename (with or without .md extension)
        updates: Dictionary of fields to update
        directory: Base directory for card storage
        validate: Whether to validate updated data against schema

    Returns:
        Dictionary with updated card metadata

    Raises:
        CardError: If update fails
        validator.ValidationError: If validation fails

    Examples:
        >>> update_card('initiative', 'customer-portal', {'status': 'Approved'})
    """
    if card_type not in CARD_TYPES:
        raise CardError(f"Unknown card type: {card_type}")

    # Ensure filename has .md extension
    if not filename.endswith('.md'):
        filename = f"{filename}.md"

    # Get card directory and file path
    card_dir = _get_card_directory(directory, card_type)
    filepath = card_dir / filename

    if not filepath.exists():
        raise CardError(f"Card not found: {filepath}")

    # Read current content
    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CardError(f"Failed to read card: {e}")

    # Update frontmatter fields
    fm.update(updates)

    # Update 'updated' date
    today = date.today().strftime("%Y-%m-%d")
    fm['updated'] = today

    # Normalize dates to strings for validation
    normalized_fm = _normalize_dates(fm)

    # Validate updated data
    if validate:
        try:
            validator.validate(normalized_fm, card_type)
        except validator.ValidationError as e:
            raise CardError(f"Validation failed: {e}")

    # Write updated content
    try:
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CardError(f"Failed to write card: {e}")

    # Update index
    try:
        index_ops.update_index_entry(str(card_dir), filename, fm)
    except index_ops.IndexError as e:
        # Non-fatal: index update failed, but card was updated
        pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'card_type': card_type,
        'updated': fm['updated']
    }
