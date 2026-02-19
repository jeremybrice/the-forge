"""Relationship operations for forge-lib.

This module provides operations for managing parent-child relationships between cards,
validating cross-type references, and detecting orphaned cards.

Relationships are bidirectional:
- Child cards have a 'parent' field pointing to parent filename
- Parent cards have a 'children' array listing child filenames
"""

from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Any

from . import frontmatter, index_ops


class RelationshipError(Exception):
    """Raised when relationship operations fail."""
    pass


# Valid parent-child card type relationships
VALID_RELATIONSHIPS = {
    'initiative': ['epic', 'decision', 'checkpoint'],
    'epic': ['story', 'decision'],
    'story': [],  # Stories cannot have children
    'intake': ['initiative'],  # Intakes can link to initiatives
    'checkpoint': [],
    'decision': [],
    'release-note': []
}


def _sync_parent_index(parent_path: Path, parent_data: Dict[str, Any]) -> None:
    """Update or create the parent card index entry."""
    index_dir = str(parent_path.parent)
    file_path = parent_path.name
    updates = {
        'children': parent_data.get('children', []),
        'updated': parent_data.get('updated')
    }

    try:
        index_ops.update_index_entry(index_dir, file_path, updates)
        return
    except index_ops.IndexError:
        # Fallback: create a new entry if index entry doesn't exist yet.
        pass
    except Exception as e:
        raise RelationshipError(f"Failed to update parent index entry: {e}") from e

    card_type = parent_data.get('type')
    title = parent_data.get('title')
    if not card_type or not title:
        raise RelationshipError(
            "Cannot create missing index entry: parent card frontmatter "
            "must include both 'type' and 'title'"
        )

    entry = {
        'file': file_path,
        'type': card_type,
        'title': title,
        **updates
    }

    try:
        index_ops.create_index_entry(index_dir, entry)
    except Exception as e:
        raise RelationshipError(f"Failed to create parent index entry: {e}") from e


def link_to_parent(
    child_filepath: str,
    parent_filepath: str,
    directory: str = '.',
    validate: bool = True
) -> Dict[str, Any]:
    """Link a child card to a parent card.

    Updates the parent's children array and updated date.
    The child card should already have the parent field set.

    Args:
        child_filepath: Path to child card file (relative to directory)
        parent_filepath: Path to parent card file (relative to directory)
        directory: Base directory for cards (default: current directory)
        validate: Whether to validate the relationship (default: True)

    Returns:
        Dictionary with relationship metadata:
        {
            'parent': 'initiatives/customer-portal.md',
            'child': 'epics/epic-001-auth.md',
            'parent_updated': '2026-02-14'
        }

    Raises:
        RelationshipError: If linking fails or validation fails

    Examples:
        >>> result = link_to_parent(
        ...     'epics/epic-001-auth.md',
        ...     'initiatives/customer-portal.md'
        ... )
        >>> result['parent']
        'initiatives/customer-portal.md'
    """
    base_dir = Path(directory)
    child_path = base_dir / child_filepath
    parent_path = base_dir / parent_filepath

    # Check that both files exist
    if not child_path.exists():
        raise RelationshipError(f"Child card not found: {child_filepath}")
    if not parent_path.exists():
        raise RelationshipError(f"Parent card not found: {parent_filepath}")

    # Read parent and child frontmatter
    try:
        with open(parent_path, 'r', encoding='utf-8') as f:
            parent_content = f.read()
        parent_data, _ = frontmatter.parse(parent_content)
    except Exception as e:
        raise RelationshipError(f"Failed to read parent card: {e}")

    try:
        with open(child_path, 'r', encoding='utf-8') as f:
            child_content = f.read()
        child_data, _ = frontmatter.parse(child_content)
    except Exception as e:
        raise RelationshipError(f"Failed to read child card: {e}")

    # Validate relationship if requested
    if validate:
        validation_result = validate_relationship(
            parent_data.get('type'),
            child_data.get('type')
        )
        if not validation_result['valid']:
            raise RelationshipError(
                f"Invalid relationship: {validation_result['error']}"
            )

    # Get the children array (initialize if not present)
    children = parent_data.get('children', [])
    if not isinstance(children, list):
        children = []

    # Add child to children array if not already present
    child_filename = Path(child_filepath).name
    if child_filename not in children:
        children.append(child_filename)

    # Update parent frontmatter
    parent_data['children'] = children
    parent_data['updated'] = date.today().strftime("%Y-%m-%d")

    # Write updated parent card
    try:
        updated_content = frontmatter.update(parent_content, parent_data)
        with open(parent_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
    except Exception as e:
        raise RelationshipError(f"Failed to update parent card: {e}")

    # Update parent's index entry
    _sync_parent_index(parent_path, parent_data)

    return {
        'parent': parent_filepath,
        'child': child_filepath,
        'parent_updated': parent_data['updated']
    }


def unlink_from_parent(
    child_filepath: str,
    parent_filepath: str,
    directory: str = '.'
) -> Dict[str, Any]:
    """Unlink a child card from a parent card.

    Removes the child from the parent's children array.

    Args:
        child_filepath: Path to child card file (relative to directory)
        parent_filepath: Path to parent card file (relative to directory)
        directory: Base directory for cards (default: current directory)

    Returns:
        Dictionary with relationship metadata:
        {
            'parent': 'initiatives/customer-portal.md',
            'child': 'epics/epic-001-auth.md',
            'parent_updated': '2026-02-14'
        }

    Raises:
        RelationshipError: If unlinking fails

    Examples:
        >>> result = unlink_from_parent(
        ...     'epics/epic-001-auth.md',
        ...     'initiatives/customer-portal.md'
        ... )
    """
    base_dir = Path(directory)
    parent_path = base_dir / parent_filepath

    # Check that parent file exists
    if not parent_path.exists():
        raise RelationshipError(f"Parent card not found: {parent_filepath}")

    # Read parent frontmatter
    try:
        with open(parent_path, 'r', encoding='utf-8') as f:
            parent_content = f.read()
        parent_data, _ = frontmatter.parse(parent_content)
    except Exception as e:
        raise RelationshipError(f"Failed to read parent card: {e}")

    # Get the children array
    children = parent_data.get('children', [])
    if not isinstance(children, list):
        children = []

    # Remove child from children array
    child_filename = Path(child_filepath).name
    if child_filename in children:
        children.remove(child_filename)

    # Update parent frontmatter
    parent_data['children'] = children
    parent_data['updated'] = date.today().strftime("%Y-%m-%d")

    # Write updated parent card
    try:
        updated_content = frontmatter.update(parent_content, parent_data)
        with open(parent_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
    except Exception as e:
        raise RelationshipError(f"Failed to update parent card: {e}")

    # Update parent's index entry
    _sync_parent_index(parent_path, parent_data)

    return {
        'parent': parent_filepath,
        'child': child_filepath,
        'parent_updated': parent_data['updated']
    }


def validate_relationship(
    parent_type: Optional[str],
    child_type: Optional[str]
) -> Dict[str, Any]:
    """Validate a parent-child relationship between card types.

    Args:
        parent_type: Type of parent card (initiative, epic, etc.)
        child_type: Type of child card

    Returns:
        Dictionary with validation result:
        {
            'valid': True/False,
            'error': 'Error message' (if invalid)
        }

    Examples:
        >>> result = validate_relationship('initiative', 'epic')
        >>> result['valid']
        True

        >>> result = validate_relationship('story', 'epic')
        >>> result['valid']
        False
    """
    if not parent_type:
        return {
            'valid': False,
            'error': 'Parent card has no type field'
        }

    if not child_type:
        return {
            'valid': False,
            'error': 'Child card has no type field'
        }

    if parent_type not in VALID_RELATIONSHIPS:
        return {
            'valid': False,
            'error': f'Unknown parent card type: {parent_type}'
        }

    valid_children = VALID_RELATIONSHIPS[parent_type]
    if child_type not in valid_children:
        return {
            'valid': False,
            'error': f'{parent_type} cannot have {child_type} children. Valid children: {", ".join(valid_children) if valid_children else "none"}'
        }

    return {'valid': True}


def find_orphans(directory: str, card_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Find cards with missing or invalid parent references.

    Args:
        directory: Base directory containing cards
        card_type: Optional card type to filter (default: check all types)

    Returns:
        List of orphaned cards with metadata:
        [
            {
                'filepath': 'epics/epic-001-auth.md',
                'type': 'epic',
                'title': 'Authentication',
                'parent': 'customer-portal.md',
                'reason': 'Parent file not found'
            }
        ]

    Examples:
        >>> orphans = find_orphans('.')
        >>> len(orphans)
        0
    """
    orphans = []
    base_dir = Path(directory)

    # Card type directory mapping
    type_dirs = {
        'initiative': 'initiatives',
        'epic': 'epics',
        'story': 'stories',
        'intake': 'intakes',
        'checkpoint': 'checkpoints',
        'decision': 'decisions',
        'release-note': 'release-notes'
    }

    # Determine which types to check
    types_to_check = [card_type] if card_type else type_dirs.keys()

    for ctype in types_to_check:
        if ctype not in type_dirs:
            continue

        card_dir = base_dir / type_dirs[ctype]
        if not card_dir.exists():
            continue

        # Scan all markdown files in the directory
        for card_file in card_dir.glob('*.md'):
            try:
                with open(card_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                card_data, _ = frontmatter.parse(content)

                # Check if card has a parent field
                parent = card_data.get('parent')
                if not parent:
                    continue  # No parent, not an orphan

                # Find parent file (could be in any parent-type directory)
                parent_found = False
                parent_filepath = None

                # Check all possible parent type directories
                for ptype, pdir in type_dirs.items():
                    potential_parent = base_dir / pdir / parent
                    if potential_parent.exists():
                        parent_found = True
                        parent_filepath = str(potential_parent.relative_to(base_dir))
                        break

                if not parent_found:
                    orphans.append({
                        'filepath': str(card_file.relative_to(base_dir)),
                        'type': ctype,
                        'title': card_data.get('title', 'Unknown'),
                        'parent': parent,
                        'reason': 'Parent file not found'
                    })

            except Exception as e:
                # Skip files that can't be parsed
                continue

    return orphans


def get_children(
    parent_filepath: str,
    directory: str = '.'
) -> List[Dict[str, Any]]:
    """Get all child cards for a parent card.

    Args:
        parent_filepath: Path to parent card file (relative to directory)
        directory: Base directory for cards (default: current directory)

    Returns:
        List of child card metadata:
        [
            {
                'filepath': 'epics/epic-001-auth.md',
                'filename': 'epic-001-auth.md',
                'type': 'epic',
                'title': 'Authentication',
                'status': 'In Progress'
            }
        ]

    Raises:
        RelationshipError: If parent card cannot be read

    Examples:
        >>> children = get_children('initiatives/customer-portal.md')
        >>> len(children)
        2
    """
    base_dir = Path(directory)
    parent_path = base_dir / parent_filepath

    if not parent_path.exists():
        raise RelationshipError(f"Parent card not found: {parent_filepath}")

    # Read parent frontmatter
    try:
        with open(parent_path, 'r', encoding='utf-8') as f:
            parent_content = f.read()
        parent_data, _ = frontmatter.parse(parent_content)
    except Exception as e:
        raise RelationshipError(f"Failed to read parent card: {e}")

    # Get children array
    children_filenames = parent_data.get('children', [])
    if not isinstance(children_filenames, list):
        return []

    children = []
    parent_dir = parent_path.parent

    # Card type directory mapping
    type_dirs = ['initiatives', 'epics', 'stories', 'intakes',
                  'checkpoints', 'decisions', 'release-notes']

    for child_filename in children_filenames:
        # Try to find child in sibling directory or same directory
        child_found = False

        # First check same directory as parent
        child_path = parent_dir / child_filename
        if child_path.exists():
            child_found = True
        else:
            # Check all type directories
            for type_dir in type_dirs:
                potential_path = base_dir / type_dir / child_filename
                if potential_path.exists():
                    child_path = potential_path
                    child_found = True
                    break

        if not child_found:
            # Child file not found, skip it
            continue

        # Read child metadata
        try:
            with open(child_path, 'r', encoding='utf-8') as f:
                child_content = f.read()
            child_data, _ = frontmatter.parse(child_content)

            children.append({
                'filepath': str(child_path.relative_to(base_dir)),
                'filename': child_filename,
                'type': child_data.get('type', 'unknown'),
                'title': child_data.get('title', 'Unknown'),
                'status': child_data.get('status', 'Unknown')
            })
        except Exception:
            # Skip children that can't be parsed
            continue

    return children
