"""Tests for core.card_ops module."""

import pytest
import json
import tempfile
import shutil
from pathlib import Path
from datetime import date

from core import card_ops, frontmatter, validator


class TestCardOperations:
    """Test card CRUD operations."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        tmpdir = tempfile.mkdtemp()
        yield tmpdir
        shutil.rmtree(tmpdir)

    @pytest.fixture
    def initiative_data(self):
        """Sample initiative data."""
        return {
            'title': 'Customer Portal',
            'type': 'initiative',
            'status': 'Draft',
            'product': 'WebApp',
            'description': 'Build a self-service customer portal'
        }

    @pytest.fixture
    def story_data(self):
        """Sample story data."""
        return {
            'title': 'Add login form',
            'type': 'story',
            'status': 'Draft',
            'product': 'WebApp'
        }

    @pytest.fixture
    def checkpoint_data(self):
        """Sample checkpoint data."""
        return {
            'title': 'Q1 Planning Review',
            'type': 'checkpoint',
            'source': 'Sprint Planning Meeting'
        }

    def test_create_initiative(self, temp_dir, initiative_data):
        """Test creating an initiative card."""
        result = card_ops.create_card('initiative', initiative_data, temp_dir)

        assert result['filename'] == 'customer-portal.md'
        assert result['card_type'] == 'initiative'
        assert result['title'] == 'Customer Portal'
        assert 'created' in result
        assert 'updated' in result

        # Verify file exists
        filepath = Path(result['filepath'])
        assert filepath.exists()

        # Verify content
        content = filepath.read_text()
        assert 'title: "Customer Portal"' in content
        assert 'type: initiative' in content
        assert 'status: Draft' in content

    def test_create_story_with_sequential_numbering(self, temp_dir, story_data):
        """Test creating multiple stories with sequential numbering."""
        # Create first story
        result1 = card_ops.create_card('story', story_data, temp_dir)
        assert 'story-001-' in result1['filename']

        # Create second story
        story_data2 = story_data.copy()
        story_data2['title'] = 'Add signup form'
        result2 = card_ops.create_card('story', story_data2, temp_dir)
        assert 'story-002-' in result2['filename']

        # Create third story
        story_data3 = story_data.copy()
        story_data3['title'] = 'Add password reset'
        result3 = card_ops.create_card('story', story_data3, temp_dir)
        assert 'story-003-' in result3['filename']

    def test_create_checkpoint_with_date(self, temp_dir, checkpoint_data):
        """Test creating a checkpoint with date-based naming."""
        result = card_ops.create_card('checkpoint', checkpoint_data, temp_dir)

        # Should have date in filename: checkpoint-YYYY-MM-DD-slug.md
        assert 'checkpoint-' in result['filename']
        assert '-q1-planning-review.md' in result['filename']

        # Verify file exists
        filepath = Path(result['filepath'])
        assert filepath.exists()

    def test_create_card_with_validation(self, temp_dir):
        """Test that validation catches invalid data."""
        invalid_data = {
            'title': 'Test',
            'type': 'initiative',
            'status': 'InvalidStatus',  # Not in enum
            'product': 'WebApp'
        }

        with pytest.raises(card_ops.CardError, match='Validation failed'):
            card_ops.create_card('initiative', invalid_data, temp_dir)

    def test_create_card_without_validation(self, temp_dir):
        """Test creating card without validation."""
        invalid_data = {
            'title': 'Test',
            'type': 'initiative',
            'status': 'InvalidStatus',
            'product': 'WebApp',
            'description': 'Test description'
        }

        # Should succeed when validation is disabled
        result = card_ops.create_card('initiative', invalid_data, temp_dir, validate=False)
        assert result['filename'] == 'test.md'

    def test_create_card_auto_adds_dates(self, temp_dir, initiative_data):
        """Test that created/updated dates are auto-added."""
        # Don't include dates in input
        data = initiative_data.copy()
        data.pop('created', None)
        data.pop('updated', None)

        result = card_ops.create_card('initiative', data, temp_dir)

        # Dates should be added automatically
        assert 'created' in result
        assert 'updated' in result

        # Verify dates are in file
        filepath = Path(result['filepath'])
        content = filepath.read_text()
        today = date.today().strftime("%Y-%m-%d")
        assert f'created: {today}' in content
        assert f'updated: {today}' in content

    def test_create_card_type_mismatch(self, temp_dir, initiative_data):
        """Test error when data type doesn't match card_type."""
        data = initiative_data.copy()
        data['type'] = 'epic'  # Mismatch with 'initiative'

        with pytest.raises(card_ops.CardError, match='does not match card_type'):
            card_ops.create_card('initiative', data, temp_dir)

    def test_create_duplicate_card(self, temp_dir, initiative_data):
        """Test error when trying to create duplicate card."""
        # Create first card
        card_ops.create_card('initiative', initiative_data, temp_dir)

        # Try to create duplicate
        with pytest.raises(card_ops.CardError, match='Card already exists'):
            card_ops.create_card('initiative', initiative_data, temp_dir)

    def test_create_unknown_card_type(self, temp_dir):
        """Test error for unknown card type."""
        data = {
            'title': 'Test',
            'type': 'unknown',
            'product': 'WebApp'
        }

        with pytest.raises(card_ops.CardError, match='Unknown card type'):
            card_ops.create_card('unknown', data, temp_dir)

    def test_get_card(self, temp_dir, initiative_data):
        """Test reading a card."""
        # Create card
        result = card_ops.create_card('initiative', initiative_data, temp_dir)

        # Read card
        card = card_ops.get_card('initiative', result['filename'], temp_dir)

        assert card['title'] == 'Customer Portal'
        assert card['type'] == 'initiative'
        assert card['status'] == 'Draft'
        assert card['product'] == 'WebApp'

    def test_get_card_without_extension(self, temp_dir, initiative_data):
        """Test reading a card using filename without .md extension."""
        # Create card
        result = card_ops.create_card('initiative', initiative_data, temp_dir)

        # Read card using filename without extension
        filename_no_ext = result['filename'].replace('.md', '')
        card = card_ops.get_card('initiative', filename_no_ext, temp_dir)

        assert card['title'] == 'Customer Portal'

    def test_get_card_not_found(self, temp_dir):
        """Test error when card doesn't exist."""
        with pytest.raises(card_ops.CardError, match='Card not found'):
            card_ops.get_card('initiative', 'nonexistent.md', temp_dir)

    def test_update_card(self, temp_dir, initiative_data):
        """Test updating a card."""
        # Create card
        result = card_ops.create_card('initiative', initiative_data, temp_dir)

        # Update card
        updates = {
            'status': 'Approved',
            'estimate_hours': 160
        }
        update_result = card_ops.update_card('initiative', result['filename'], updates, temp_dir)

        assert 'updated' in update_result

        # Verify updates
        card = card_ops.get_card('initiative', result['filename'], temp_dir)
        assert card['status'] == 'Approved'
        assert card['estimate_hours'] == 160

        # Verify updated date changed
        today = date.today().strftime("%Y-%m-%d")
        assert card['updated'] == today

    def test_update_card_validation(self, temp_dir, initiative_data):
        """Test that update validates data."""
        # Create card
        result = card_ops.create_card('initiative', initiative_data, temp_dir)

        # Try invalid update
        updates = {
            'status': 'InvalidStatus'
        }

        with pytest.raises(card_ops.CardError, match='Validation failed'):
            card_ops.update_card('initiative', result['filename'], updates, temp_dir)

    def test_update_card_not_found(self, temp_dir):
        """Test error when updating non-existent card."""
        with pytest.raises(card_ops.CardError, match='Card not found'):
            card_ops.update_card('initiative', 'nonexistent.md', {'status': 'Draft'}, temp_dir)

    def test_query_cards_by_type(self, temp_dir, initiative_data, story_data):
        """Test querying cards by type."""
        # Create multiple cards
        card_ops.create_card('initiative', initiative_data, temp_dir)

        init_data2 = initiative_data.copy()
        init_data2['title'] = 'Mobile App'
        card_ops.create_card('initiative', init_data2, temp_dir)

        card_ops.create_card('story', story_data, temp_dir)

        # Query initiatives only
        initiatives = card_ops.query_cards('initiative', temp_dir)
        assert len(initiatives) == 2

        # Query stories only
        stories = card_ops.query_cards('story', temp_dir)
        assert len(stories) == 1

    def test_query_cards_with_filters(self, temp_dir, initiative_data):
        """Test querying cards with filters."""
        # Create multiple cards
        card_ops.create_card('initiative', initiative_data, temp_dir)

        init_data2 = initiative_data.copy()
        init_data2['title'] = 'Mobile App'
        init_data2['status'] = 'Approved'
        card_ops.create_card('initiative', init_data2, temp_dir)

        init_data3 = initiative_data.copy()
        init_data3['title'] = 'API Platform'
        init_data3['product'] = 'API'
        card_ops.create_card('initiative', init_data3, temp_dir)

        # Filter by status (should return 2: Customer Portal and API Platform)
        draft_cards = card_ops.query_cards('initiative', temp_dir, filters={'status': 'Draft'})
        assert len(draft_cards) == 2
        draft_titles = {card['title'] for card in draft_cards}
        assert draft_titles == {'Customer Portal', 'API Platform'}

        # Filter by product
        webapp_cards = card_ops.query_cards('initiative', temp_dir, filters={'product': 'WebApp'})
        assert len(webapp_cards) == 2

        # Filter by multiple fields
        specific_cards = card_ops.query_cards(
            'initiative',
            temp_dir,
            filters={'product': 'WebApp', 'status': 'Approved'}
        )
        assert len(specific_cards) == 1
        assert specific_cards[0]['title'] == 'Mobile App'

    def test_query_all_card_types(self, temp_dir, initiative_data, story_data):
        """Test querying all card types."""
        # Create cards of different types
        card_ops.create_card('initiative', initiative_data, temp_dir)
        card_ops.create_card('story', story_data, temp_dir)

        # Query all cards
        all_cards = card_ops.query_cards(directory=temp_dir)
        assert len(all_cards) == 2

    def test_query_cards_no_index(self, temp_dir):
        """Test querying when no index exists."""
        # Query should return empty list
        cards = card_ops.query_cards('initiative', temp_dir)
        assert len(cards) == 0

    def test_card_directory_mapping(self, temp_dir):
        """Test that card types map to correct directories."""
        test_cases = [
            ('initiative', 'initiatives'),
            ('epic', 'epics'),
            ('story', 'stories'),
            ('intake', 'intakes'),
            ('checkpoint', 'checkpoints'),
            ('decision', 'decisions'),
            ('release-note', 'release-notes')
        ]

        for card_type, expected_dir in test_cases:
            card_dir = card_ops._get_card_directory(temp_dir, card_type)
            assert card_dir.name == expected_dir

    def test_all_card_types_supported(self, temp_dir):
        """Test that all card types can be created."""
        test_data = {
            'initiative': {
                'title': 'Test Initiative',
                'type': 'initiative',
                'status': 'Draft',
                'product': 'WebApp',
                'description': 'Test'
            },
            'epic': {
                'title': 'Test Epic',
                'type': 'epic',
                'status': 'Draft',
                'product': 'WebApp',
                'description': 'Test'
            },
            'story': {
                'title': 'Test Story',
                'type': 'story',
                'status': 'Draft',
                'product': 'WebApp'
            },
            'intake': {
                'title': 'Test Intake',
                'type': 'intake',
                'status': 'Submitted',
                'product': 'WebApp',
                'source': 'Email',
                'requested_by': 'John Doe',
                'priority': 'Medium'
            },
            'checkpoint': {
                'title': 'Test Checkpoint',
                'type': 'checkpoint',
                'source': 'Sprint Review'
            },
            'decision': {
                'title': 'Test Decision',
                'type': 'decision',
                'status': 'Proposed',
                'product': 'WebApp',
                'decision_date': '2026-02-14'
            },
            'release-note': {
                'title': 'Test Release',
                'type': 'release-note',
                'product': 'WebApp',
                'version': '1.0.0',
                'release_date': '2026-02-14'
            }
        }

        for card_type, data in test_data.items():
            result = card_ops.create_card(card_type, data, temp_dir)
            assert result['card_type'] == card_type
            assert Path(result['filepath']).exists()

    def test_create_card_with_children_array(self, temp_dir):
        """Test creating initiative with children array."""
        data = {
            'title': 'Parent Initiative',
            'type': 'initiative',
            'status': 'Draft',
            'product': 'WebApp',
            'description': 'Test',
            'children': ['epic-1', 'epic-2']
        }

        result = card_ops.create_card('initiative', data, temp_dir)

        # Verify children in frontmatter
        card = card_ops.get_card('initiative', result['filename'], temp_dir)
        assert card['children'] == ['epic-1', 'epic-2']

    def test_create_card_with_parent_reference(self, temp_dir):
        """Test creating story with parent reference."""
        data = {
            'title': 'Child Story',
            'type': 'story',
            'status': 'Draft',
            'product': 'WebApp',
            'parent': 'epic-name'
        }

        result = card_ops.create_card('story', data, temp_dir)

        # Verify parent in frontmatter
        card = card_ops.get_card('story', result['filename'], temp_dir)
        assert card['parent'] == 'epic-name'
