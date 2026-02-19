"""Tests for relationship_ops module."""

import pytest
import json
import os
import tempfile
import shutil
from pathlib import Path
from core import relationship_ops, frontmatter


@pytest.fixture
def temp_card_dir():
    """Create a temporary directory with sample cards."""
    temp_dir = tempfile.mkdtemp()

    # Create type directories
    for type_dir in ['initiatives', 'epics', 'stories', 'decisions']:
        (Path(temp_dir) / type_dir).mkdir(parents=True, exist_ok=True)

    # Create sample initiative
    initiative_content = frontmatter.dumps({
        'type': 'initiative',
        'title': 'Customer Portal',
        'status': 'In Progress',
        'created': '2026-02-01',
        'updated': '2026-02-01',
        'children': []
    }, 'Initiative description')

    initiative_path = Path(temp_dir) / 'initiatives' / 'customer-portal.md'
    with open(initiative_path, 'w', encoding='utf-8') as f:
        f.write(initiative_content)

    # Create sample epic
    epic_content = frontmatter.dumps({
        'type': 'epic',
        'title': 'Authentication',
        'status': 'In Progress',
        'parent': 'customer-portal.md',
        'created': '2026-02-05',
        'updated': '2026-02-05',
        'children': []
    }, 'Epic description')

    epic_path = Path(temp_dir) / 'epics' / 'epic-001-auth.md'
    with open(epic_path, 'w', encoding='utf-8') as f:
        f.write(epic_content)

    # Create sample story
    story_content = frontmatter.dumps({
        'type': 'story',
        'title': 'Login Page',
        'status': 'Ready',
        'parent': 'epic-001-auth.md',
        'created': '2026-02-10',
        'updated': '2026-02-10'
    }, 'Story description')

    story_path = Path(temp_dir) / 'stories' / 'story-001-login.md'
    with open(story_path, 'w', encoding='utf-8') as f:
        f.write(story_content)

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir)


def test_link_to_parent_success(temp_card_dir):
    """Test successfully linking a child to a parent."""
    result = relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert result['parent'] == 'initiatives/customer-portal.md'
    assert result['child'] == 'epics/epic-001-auth.md'
    assert 'parent_updated' in result

    # Verify parent was updated
    parent_path = Path(temp_card_dir) / 'initiatives' / 'customer-portal.md'
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parent_data, _ = frontmatter.parse(content)

    assert 'epic-001-auth.md' in parent_data['children']
    assert parent_data['updated'] == result['parent_updated']


def test_link_to_parent_idempotent(temp_card_dir):
    """Test linking the same child twice is idempotent."""
    # Link once
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Link again
    result = relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Verify child only appears once
    parent_path = Path(temp_card_dir) / 'initiatives' / 'customer-portal.md'
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parent_data, _ = frontmatter.parse(content)

    assert parent_data['children'].count('epic-001-auth.md') == 1


def test_link_to_parent_child_not_found(temp_card_dir):
    """Test linking fails when child doesn't exist."""
    with pytest.raises(relationship_ops.RelationshipError) as exc_info:
        relationship_ops.link_to_parent(
            'epics/nonexistent.md',
            'initiatives/customer-portal.md',
            temp_card_dir
        )

    assert 'Child card not found' in str(exc_info.value)


def test_link_to_parent_parent_not_found(temp_card_dir):
    """Test linking fails when parent doesn't exist."""
    with pytest.raises(relationship_ops.RelationshipError) as exc_info:
        relationship_ops.link_to_parent(
            'epics/epic-001-auth.md',
            'initiatives/nonexistent.md',
            temp_card_dir
        )

    assert 'Parent card not found' in str(exc_info.value)


def test_link_to_parent_invalid_relationship(temp_card_dir):
    """Test linking fails for invalid parent-child relationship."""
    # Try to link initiative as child of epic (invalid)
    with pytest.raises(relationship_ops.RelationshipError) as exc_info:
        relationship_ops.link_to_parent(
            'initiatives/customer-portal.md',
            'epics/epic-001-auth.md',
            temp_card_dir,
            validate=True
        )

    assert 'Invalid relationship' in str(exc_info.value)


def test_link_to_parent_skip_validation(temp_card_dir):
    """Test linking with validation disabled."""
    # This would normally fail validation, but we skip it
    result = relationship_ops.link_to_parent(
        'initiatives/customer-portal.md',
        'epics/epic-001-auth.md',
        temp_card_dir,
        validate=False
    )

    assert result['parent'] == 'epics/epic-001-auth.md'


def test_unlink_from_parent_success(temp_card_dir):
    """Test successfully unlinking a child from a parent."""
    # First link
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Then unlink
    result = relationship_ops.unlink_from_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert result['parent'] == 'initiatives/customer-portal.md'
    assert result['child'] == 'epics/epic-001-auth.md'

    # Verify parent was updated
    parent_path = Path(temp_card_dir) / 'initiatives' / 'customer-portal.md'
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parent_data, _ = frontmatter.parse(content)

    assert 'epic-001-auth.md' not in parent_data['children']


def test_unlink_from_parent_not_linked(temp_card_dir):
    """Test unlinking a child that isn't linked doesn't error."""
    result = relationship_ops.unlink_from_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Should succeed even if child wasn't linked
    assert result['parent'] == 'initiatives/customer-portal.md'


def test_unlink_from_parent_not_found(temp_card_dir):
    """Test unlinking fails when parent doesn't exist."""
    with pytest.raises(relationship_ops.RelationshipError) as exc_info:
        relationship_ops.unlink_from_parent(
            'epics/epic-001-auth.md',
            'initiatives/nonexistent.md',
            temp_card_dir
        )

    assert 'Parent card not found' in str(exc_info.value)


def test_validate_relationship_valid_initiative_epic():
    """Test validating initiative → epic relationship."""
    result = relationship_ops.validate_relationship('initiative', 'epic')
    assert result['valid'] is True


def test_validate_relationship_valid_epic_story():
    """Test validating epic → story relationship."""
    result = relationship_ops.validate_relationship('epic', 'story')
    assert result['valid'] is True


def test_validate_relationship_invalid_story_epic():
    """Test validating story → epic relationship (invalid)."""
    result = relationship_ops.validate_relationship('story', 'epic')
    assert result['valid'] is False
    assert 'cannot have' in result['error']


def test_validate_relationship_invalid_story_story():
    """Test validating story → story relationship (invalid)."""
    result = relationship_ops.validate_relationship('story', 'story')
    assert result['valid'] is False


def test_validate_relationship_missing_parent_type():
    """Test validation fails when parent type is missing."""
    result = relationship_ops.validate_relationship(None, 'epic')
    assert result['valid'] is False
    assert 'no type field' in result['error']


def test_validate_relationship_missing_child_type():
    """Test validation fails when child type is missing."""
    result = relationship_ops.validate_relationship('initiative', None)
    assert result['valid'] is False
    assert 'no type field' in result['error']


def test_validate_relationship_unknown_parent_type():
    """Test validation fails for unknown parent type."""
    result = relationship_ops.validate_relationship('unknown', 'epic')
    assert result['valid'] is False
    assert 'Unknown parent card type' in result['error']


def test_find_orphans_no_orphans(temp_card_dir):
    """Test finding orphans when there are none."""
    # Link epic to initiative
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    orphans = relationship_ops.find_orphans(temp_card_dir)
    # Story is orphaned (parent epic not linked), but epic is not
    # Actually, we need to check - the epic has parent field set but not linked in parent's children
    # find_orphans checks if parent FILE exists, not if it's properly linked
    assert len(orphans) == 0  # All parent files exist


def test_find_orphans_with_orphans(temp_card_dir):
    """Test finding orphans with missing parents."""
    # Create an epic with non-existent parent
    epic_content = frontmatter.dumps({
        'type': 'epic',
        'title': 'Orphaned Epic',
        'status': 'Draft',
        'parent': 'nonexistent.md',
        'created': '2026-02-10',
        'updated': '2026-02-10'
    }, 'Orphaned epic')

    epic_path = Path(temp_card_dir) / 'epics' / 'orphaned.md'
    with open(epic_path, 'w', encoding='utf-8') as f:
        f.write(epic_content)

    orphans = relationship_ops.find_orphans(temp_card_dir)
    assert len(orphans) >= 1

    orphan = next(o for o in orphans if 'orphaned.md' in o['filepath'])
    assert orphan['type'] == 'epic'
    assert orphan['title'] == 'Orphaned Epic'
    assert orphan['parent'] == 'nonexistent.md'
    assert orphan['reason'] == 'Parent file not found'


def test_find_orphans_by_type(temp_card_dir):
    """Test finding orphans filtered by card type."""
    # Create orphaned epic
    epic_content = frontmatter.dumps({
        'type': 'epic',
        'title': 'Orphaned Epic',
        'parent': 'nonexistent.md',
        'created': '2026-02-10',
        'updated': '2026-02-10'
    }, 'Orphaned epic')

    epic_path = Path(temp_card_dir) / 'epics' / 'orphaned-epic.md'
    with open(epic_path, 'w', encoding='utf-8') as f:
        f.write(epic_content)

    # Create orphaned story
    story_content = frontmatter.dumps({
        'type': 'story',
        'title': 'Orphaned Story',
        'parent': 'nonexistent.md',
        'created': '2026-02-10',
        'updated': '2026-02-10'
    }, 'Orphaned story')

    story_path = Path(temp_card_dir) / 'stories' / 'orphaned-story.md'
    with open(story_path, 'w', encoding='utf-8') as f:
        f.write(story_content)

    # Find only epic orphans
    orphans = relationship_ops.find_orphans(temp_card_dir, card_type='epic')
    assert all(o['type'] == 'epic' for o in orphans)
    assert any('orphaned-epic.md' in o['filepath'] for o in orphans)


def test_get_children_success(temp_card_dir):
    """Test getting children of a parent card."""
    # Link epic to initiative
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    children = relationship_ops.get_children(
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert len(children) == 1
    assert children[0]['filename'] == 'epic-001-auth.md'
    assert children[0]['type'] == 'epic'
    assert children[0]['title'] == 'Authentication'
    assert children[0]['status'] == 'In Progress'


def test_get_children_multiple_children(temp_card_dir):
    """Test getting multiple children."""
    # Link epic to initiative
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Create and link a decision
    decision_content = frontmatter.dumps({
        'type': 'decision',
        'title': 'Use OAuth',
        'status': 'Accepted',
        'parent': 'customer-portal.md',
        'created': '2026-02-12',
        'updated': '2026-02-12'
    }, 'Decision description')

    decision_path = Path(temp_card_dir) / 'decisions' / 'use-oauth.md'
    with open(decision_path, 'w', encoding='utf-8') as f:
        f.write(decision_content)

    relationship_ops.link_to_parent(
        'decisions/use-oauth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    children = relationship_ops.get_children(
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert len(children) == 2
    assert any(c['filename'] == 'epic-001-auth.md' for c in children)
    assert any(c['filename'] == 'use-oauth.md' for c in children)


def test_get_children_no_children(temp_card_dir):
    """Test getting children when parent has none."""
    children = relationship_ops.get_children(
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert len(children) == 0


def test_get_children_parent_not_found(temp_card_dir):
    """Test getting children fails when parent doesn't exist."""
    with pytest.raises(relationship_ops.RelationshipError) as exc_info:
        relationship_ops.get_children(
            'initiatives/nonexistent.md',
            temp_card_dir
        )

    assert 'Parent card not found' in str(exc_info.value)


def test_get_children_missing_child_files(temp_card_dir):
    """Test getting children handles missing child files gracefully."""
    # Manually add non-existent child to parent's children array
    parent_path = Path(temp_card_dir) / 'initiatives' / 'customer-portal.md'
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parent_data, _ = frontmatter.parse(content)
    parent_data['children'] = ['nonexistent-1.md', 'nonexistent-2.md']

    updated_content = frontmatter.update(content, parent_data)
    with open(parent_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)

    # Should return empty list (child files don't exist)
    children = relationship_ops.get_children(
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    assert len(children) == 0


def test_valid_relationships_hierarchy():
    """Test that VALID_RELATIONSHIPS follows correct hierarchy."""
    # Initiative can have epics and decisions
    assert 'epic' in relationship_ops.VALID_RELATIONSHIPS['initiative']
    assert 'decision' in relationship_ops.VALID_RELATIONSHIPS['initiative']

    # Epic can have stories and decisions
    assert 'story' in relationship_ops.VALID_RELATIONSHIPS['epic']
    assert 'decision' in relationship_ops.VALID_RELATIONSHIPS['epic']

    # Stories cannot have children
    assert relationship_ops.VALID_RELATIONSHIPS['story'] == []


def test_link_updates_parent_date(temp_card_dir):
    """Test that linking updates the parent's updated date."""
    # Get original parent updated date
    parent_path = Path(temp_card_dir) / 'initiatives' / 'customer-portal.md'
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    original_data, _ = frontmatter.parse(content)
    original_updated = original_data['updated']

    # Link child
    result = relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    # Verify updated date changed
    with open(parent_path, 'r', encoding='utf-8') as f:
        content = f.read()
    updated_data, _ = frontmatter.parse(content)

    # The updated date should be today's date (different from original if it was older)
    assert updated_data['updated'] == result['parent_updated']


def test_link_to_parent_updates_index_entry(temp_card_dir):
    """Linking a child should create/update the parent index entry."""
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    index_path = Path(temp_card_dir) / 'initiatives' / 'index.json'
    assert index_path.exists()

    index_data = json.loads(index_path.read_text(encoding='utf-8'))
    entries = index_data.get('entries', [])
    parent_entry = next((e for e in entries if e.get('file') == 'customer-portal.md'), None)

    assert parent_entry is not None
    assert 'epic-001-auth.md' in parent_entry.get('children', [])


def test_unlink_from_parent_updates_index_entry(temp_card_dir):
    """Unlinking a child should remove it from parent index children."""
    relationship_ops.link_to_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )
    relationship_ops.unlink_from_parent(
        'epics/epic-001-auth.md',
        'initiatives/customer-portal.md',
        temp_card_dir
    )

    index_path = Path(temp_card_dir) / 'initiatives' / 'index.json'
    assert index_path.exists()

    index_data = json.loads(index_path.read_text(encoding='utf-8'))
    entries = index_data.get('entries', [])
    parent_entry = next((e for e in entries if e.get('file') == 'customer-portal.md'), None)

    assert parent_entry is not None
    assert 'epic-001-auth.md' not in parent_entry.get('children', [])
