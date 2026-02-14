"""
Unit tests for core.frontmatter module.
"""

import pytest
from core.frontmatter import (
    parse, dumps, update, extract_frontmatter, extract_body, FrontmatterError
)


class TestParse:
    """Tests for parse() function."""

    def test_parse_valid_frontmatter(self):
        """Parse valid frontmatter with body."""
        content = """---
title: Test Initiative
type: initiative
status: Active
---

## Body Content

This is the body."""

        frontmatter, body = parse(content)

        assert frontmatter['title'] == 'Test Initiative'
        assert frontmatter['type'] == 'initiative'
        assert frontmatter['status'] == 'Active'
        assert '## Body Content' in body

    def test_parse_empty_frontmatter(self):
        """Parse empty frontmatter."""
        content = """---
---

Body only"""

        frontmatter, body = parse(content)

        assert frontmatter == {}
        assert 'Body only' in body

    def test_parse_no_frontmatter(self):
        """Parse content without frontmatter."""
        content = "Just body content"

        frontmatter, body = parse(content)

        assert frontmatter == {}
        assert body == "Just body content"

    def test_parse_with_lists(self):
        """Parse frontmatter with list fields."""
        content = """---
title: Test
children:
  - epic-001
  - epic-002
  - epic-003
---

Body"""

        frontmatter, body = parse(content)

        assert frontmatter['children'] == ['epic-001', 'epic-002', 'epic-003']

    def test_parse_with_null_values(self):
        """Parse frontmatter with null values."""
        content = """---
title: Test
jira_card: null
source_conversation: null
---

Body"""

        frontmatter, body = parse(content)

        assert frontmatter['jira_card'] is None
        assert frontmatter['source_conversation'] is None

    def test_parse_with_numbers(self):
        """Parse frontmatter with numeric values."""
        content = """---
estimate_hours: 320
priority: 1
confidence: 0.85
---

Body"""

        frontmatter, body = parse(content)

        assert frontmatter['estimate_hours'] == 320
        assert frontmatter['priority'] == 1
        assert frontmatter['confidence'] == 0.85

    def test_parse_invalid_yaml(self):
        """Parse invalid YAML frontmatter."""
        content = """---
title: Test
invalid: [unclosed
---

Body"""

        with pytest.raises(FrontmatterError) as exc_info:
            parse(content)
        assert 'Invalid YAML' in str(exc_info.value)

    def test_parse_non_dict_frontmatter(self):
        """Parse frontmatter that is not a dictionary."""
        content = """---
- item1
- item2
---

Body"""

        with pytest.raises(FrontmatterError) as exc_info:
            parse(content)
        assert 'must be a YAML dictionary' in str(exc_info.value)


class TestDumps:
    """Tests for dumps() function."""

    def test_dumps_basic(self):
        """Dump basic frontmatter with body."""
        frontmatter = {'title': 'Test', 'type': 'initiative'}
        body = '## Body Content'

        result = dumps(frontmatter, body)

        assert result.startswith('---\n')
        assert 'title: Test' in result
        assert 'type: initiative' in result
        assert '---\n\n## Body Content' in result

    def test_dumps_without_body(self):
        """Dump frontmatter without body."""
        frontmatter = {'title': 'Test'}

        result = dumps(frontmatter)

        assert result.startswith('---\n')
        assert 'title: Test' in result
        assert result.endswith('---\n')

    def test_dumps_with_lists(self):
        """Dump frontmatter with list fields."""
        frontmatter = {
            'title': 'Test',
            'children': ['epic-001', 'epic-002']
        }

        result = dumps(frontmatter)

        assert 'children:' in result
        assert '- epic-001' in result
        assert '- epic-002' in result

    def test_dumps_with_null(self):
        """Dump frontmatter with null values."""
        frontmatter = {
            'title': 'Test',
            'jira_card': None
        }

        result = dumps(frontmatter)

        assert 'jira_card: null' in result

    def test_dumps_empty_dict(self):
        """Dump empty frontmatter."""
        frontmatter = {}

        result = dumps(frontmatter, 'Body')

        assert result.startswith('---\n')
        assert result.endswith('---\n\nBody')


class TestUpdate:
    """Tests for update() function."""

    def test_update_existing_field(self):
        """Update an existing frontmatter field."""
        content = """---
title: Old Title
status: Draft
---

Body"""

        result = update(content, {'status': 'Active'})

        assert 'status: Active' in result
        assert 'title: Old Title' in result
        assert 'Body' in result

    def test_update_add_new_field(self):
        """Add a new field to frontmatter."""
        content = """---
title: Test
---

Body"""

        result = update(content, {'status': 'Active'})

        assert 'status: Active' in result
        assert 'title: Test' in result

    def test_update_multiple_fields(self):
        """Update multiple fields at once."""
        content = """---
title: Test
status: Draft
priority: 1
---

Body"""

        result = update(content, {
            'status': 'Active',
            'priority': 2,
            'estimate_hours': 100
        })

        assert 'status: Active' in result
        assert 'priority: 2' in result
        assert 'estimate_hours: 100' in result


class TestExtractFrontmatter:
    """Tests for extract_frontmatter() function."""

    def test_extract_frontmatter(self):
        """Extract frontmatter from content."""
        content = """---
title: Test
type: initiative
---

Body"""

        frontmatter = extract_frontmatter(content)

        assert frontmatter['title'] == 'Test'
        assert frontmatter['type'] == 'initiative'
        assert 'Body' not in str(frontmatter)


class TestExtractBody:
    """Tests for extract_body() function."""

    def test_extract_body(self):
        """Extract body from content."""
        content = """---
title: Test
---

## Body Content

This is the body."""

        body = extract_body(content)

        assert '## Body Content' in body
        assert 'This is the body.' in body
        assert 'title: Test' not in body
