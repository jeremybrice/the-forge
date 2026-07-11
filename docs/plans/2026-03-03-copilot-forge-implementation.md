# Copilot-Forge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the copilot-forge plugin — an interactive builder for Microsoft 365 Copilot Declarative Agents that follows the rovo-forge pattern exactly.

**Architecture:** Single command (`/copilot-forge:agent`) with 11-phase guided workflow, two skills (copilot-foundation + m365-specialist), three sample configs, forge-lib CRUD module, and forge-shell dashboard view. Output is copy-ready text for the Agent Builder / Copilot Studio UI.

**Tech Stack:** Python (forge-lib), Markdown/YAML (plugin commands/skills), JavaScript (forge-shell), JSON Schema (validation), Jinja2 (templates)

**Design doc:** `docs/plans/2026-03-03-copilot-forge-design.md`

---

## Task 1: Create the JSON Schema for Copilot Agents

**Files:**
- Create: `forge-lib/schemas/copilot_agent.json`
- Reference: `forge-lib/schemas/agent.json` (rovo-forge schema)

**Step 1: Write the schema file**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://forge-lib.local/schemas/copilot_agent.json",
  "title": "Copilot Declarative Agent",
  "description": "Schema for Microsoft 365 Copilot Declarative Agent configurations created by copilot-forge",
  "type": "object",
  "required": ["name", "platform", "description", "status", "created", "updated"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Agent display name",
      "minLength": 1,
      "maxLength": 100
    },
    "platform": {
      "type": "string",
      "description": "Target platform",
      "const": "copilot"
    },
    "description": {
      "type": "string",
      "description": "Agent description",
      "minLength": 1,
      "maxLength": 1000
    },
    "status": {
      "type": "string",
      "description": "Agent lifecycle status",
      "enum": ["draft", "published", "archived"],
      "default": "draft"
    },
    "capabilities": {
      "type": "array",
      "description": "M365 knowledge source capabilities",
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name": {
            "type": "string",
            "enum": [
              "WebSearch",
              "OneDriveAndSharePoint",
              "GraphConnectors",
              "Email",
              "TeamsMessages",
              "Meetings",
              "People",
              "Dataverse"
            ]
          },
          "items": {
            "type": "array",
            "description": "URLs or identifiers for scoping",
            "items": { "type": "string" }
          },
          "sites": {
            "type": "array",
            "description": "Site URLs for WebSearch scoping",
            "items": { "type": "string" },
            "maxItems": 4
          },
          "connections": {
            "type": "array",
            "description": "Connection IDs for GraphConnectors",
            "items": { "type": "string" }
          }
        }
      },
      "default": []
    },
    "additional_capabilities": {
      "type": "array",
      "description": "Non-knowledge capabilities",
      "items": {
        "type": "string",
        "enum": ["GraphicArt", "CodeInterpreter"]
      },
      "default": []
    },
    "conversation_starters": {
      "type": "array",
      "description": "Sample prompts with title and text (3-12 items)",
      "items": {
        "type": "object",
        "required": ["title", "text"],
        "properties": {
          "title": { "type": "string" },
          "text": { "type": "string" }
        }
      },
      "minItems": 3,
      "maxItems": 12
    },
    "owner": {
      "type": ["string", "null"],
      "description": "Agent owner",
      "default": null
    },
    "collaborators": {
      "type": "array",
      "description": "List of collaborators who can edit this agent",
      "items": { "type": "string" },
      "maxItems": 40,
      "default": []
    },
    "visibility": {
      "type": "string",
      "description": "Agent visibility scope",
      "enum": ["organization", "team", "private"],
      "default": "organization"
    },
    "created": {
      "type": "string",
      "format": "date",
      "description": "Creation date in YYYY-MM-DD format"
    },
    "updated": {
      "type": "string",
      "format": "date",
      "description": "Last update date in YYYY-MM-DD format"
    }
  },
  "additionalProperties": false
}
```

**Step 2: Verify the schema is valid JSON**

Run: `cd forge-lib && python -c "import json; json.load(open('schemas/copilot_agent.json')); print('Valid JSON')"`
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add forge-lib/schemas/copilot_agent.json
git commit -m "feat(copilot-forge): add JSON schema for copilot declarative agents"
```

---

## Task 2: Create the Jinja2 Template for Copilot Agents

**Files:**
- Create: `forge-lib/templates/copilot_agent.md.j2`
- Reference: `forge-lib/templates/agent.md.j2` (rovo-forge template)

**Step 1: Write the template**

```jinja2
---
name: "{{ name }}"
platform: {{ platform }}
description: "{{ description }}"
status: {{ status }}
capabilities:
{%- if capabilities and capabilities|length > 0 %}
{% for cap in capabilities %}
  - name: {{ cap.name }}
{%- if cap.items is defined and cap.items|length > 0 %}
    items:
{%- for item in cap.items %}
      - "{{ item }}"
{%- endfor %}
{%- endif %}
{%- if cap.sites is defined and cap.sites|length > 0 %}
    sites:
{%- for site in cap.sites %}
      - "{{ site }}"
{%- endfor %}
{%- endif %}
{%- if cap.connections is defined and cap.connections|length > 0 %}
    connections:
{%- for conn in cap.connections %}
      - "{{ conn }}"
{%- endfor %}
{%- endif %}
{%- endfor %}
{%- else %}
  []
{%- endif %}
additional_capabilities:
{%- if additional_capabilities and additional_capabilities|length > 0 %}
{% for ac in additional_capabilities %}
  - {{ ac }}
{%- endfor %}
{%- else %}
  []
{%- endif %}
conversation_starters:
{%- if conversation_starters and conversation_starters|length > 0 %}
{% for starter in conversation_starters %}
  - title: "{{ starter.title }}"
    text: "{{ starter.text }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
owner: {{ owner if owner else 'null' }}
collaborators:
{%- if collaborators and collaborators|length > 0 %}
{% for collab in collaborators %}
  - "{{ collab }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
visibility: {{ visibility }}
created: {{ created }}
updated: {{ updated }}
---

{% if instructions %}
## Instructions

{{ instructions }}
{% endif %}

{% if knowledge_source_notes %}
## Knowledge Source Notes

{{ knowledge_source_notes }}
{% endif %}
```

**Step 2: Verify template syntax**

Run: `cd forge-lib && python -c "import jinja2; jinja2.Environment(loader=jinja2.FileSystemLoader('templates')).get_template('copilot_agent.md.j2'); print('Template valid')"`
Expected: `Template valid`

**Step 3: Commit**

```bash
git add forge-lib/templates/copilot_agent.md.j2
git commit -m "feat(copilot-forge): add Jinja2 template for copilot agent markdown"
```

---

## Task 3: Write Tests for Copilot Agent Operations

**Files:**
- Create: `forge-lib/tests/test_copilot_agent_ops.py`
- Reference: `forge-lib/tests/test_agent_ops.py` (rovo-forge tests)

**Step 1: Write the test file**

```python
"""Tests for copilot agent operations (copilot-forge integration)."""
import json
import os
import pytest
from pathlib import Path
from datetime import date


@pytest.fixture
def temp_dir(tmp_path):
    """Create a temporary directory for tests."""
    return tmp_path


@pytest.fixture
def copilot_agent_dir(temp_dir):
    """Create and return the copilot-agents directory."""
    d = temp_dir / 'copilot-agents'
    d.mkdir()
    return d


def _make_copilot_agent_data(**overrides):
    """Helper to build valid copilot agent data with sensible defaults."""
    data = {
        'name': 'HR Policy Assistant',
        'platform': 'copilot',
        'description': 'Answers employee questions about HR policies using SharePoint knowledge base.',
        'capabilities': [
            {'name': 'OneDriveAndSharePoint', 'items': ['https://contoso.sharepoint.com/sites/HR']},
        ],
        'additional_capabilities': [],
        'conversation_starters': [
            {'title': 'PTO Policy', 'text': 'What is our PTO policy?'},
            {'title': 'Benefits', 'text': 'Summarize health insurance benefits'},
            {'title': 'Onboarding', 'text': 'What does onboarding look like?'},
        ],
        'owner': 'Jeremy Brice',
        'collaborators': [],
        'visibility': 'organization',
    }
    data.update(overrides)
    return data


class TestCreateCopilotAgent:
    """Tests for create_copilot_agent function."""

    def test_create_copilot_agent(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data()
        result = create_copilot_agent(data, directory=str(temp_dir))
        assert result['filename'] == 'agent.md'
        assert result['slug'] == 'hr-policy-assistant'
        assert result['dirpath'] == str(temp_dir / 'copilot-agents' / 'hr-policy-assistant')
        assert (temp_dir / 'copilot-agents' / 'hr-policy-assistant' / 'agent.md').exists()

    def test_create_copilot_agent_with_instructions(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data(
            instructions='You are an HR policy expert. Answer questions accurately.',
        )
        result = create_copilot_agent(data, directory=str(temp_dir))
        content = (temp_dir / 'copilot-agents' / 'hr-policy-assistant' / 'agent.md').read_text()
        assert '## Instructions' in content
        assert 'HR policy expert' in content

    def test_create_copilot_agent_validates_platform(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, CopilotAgentError
        data = _make_copilot_agent_data(platform='jira')
        with pytest.raises((CopilotAgentError, Exception)):
            create_copilot_agent(data, directory=str(temp_dir))

    def test_create_copilot_agent_generates_slug(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data(name='Sales Email Summarization Agent')
        result = create_copilot_agent(data, directory=str(temp_dir))
        assert result['slug'] == 'sales-email-summarization-agent'

    def test_create_copilot_agent_updates_index(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data()
        create_copilot_agent(data, directory=str(temp_dir))
        index_path = temp_dir / 'copilot-agents' / 'index.json'
        assert index_path.exists()
        index_data = json.loads(index_path.read_text())
        assert len(index_data['entries']) == 1
        assert index_data['entries'][0]['name'] == 'HR Policy Assistant'

    def test_create_duplicate_copilot_agent_raises(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, CopilotAgentError
        data = _make_copilot_agent_data()
        create_copilot_agent(data, directory=str(temp_dir))
        with pytest.raises(CopilotAgentError):
            create_copilot_agent(data, directory=str(temp_dir))

    def test_create_copilot_agent_with_multiple_capabilities(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data(
            name='Enterprise Knowledge Hub',
            capabilities=[
                {'name': 'OneDriveAndSharePoint', 'items': ['https://contoso.sharepoint.com/sites/HR']},
                {'name': 'WebSearch', 'sites': ['https://hr.contoso.com']},
                {'name': 'TeamsMessages', 'items': ['https://teams.microsoft.com/l/channel/123']},
            ],
        )
        result = create_copilot_agent(data, directory=str(temp_dir))
        content = (temp_dir / 'copilot-agents' / 'enterprise-knowledge-hub' / 'agent.md').read_text()
        assert 'OneDriveAndSharePoint' in content
        assert 'WebSearch' in content
        assert 'TeamsMessages' in content

    def test_create_copilot_agent_sets_defaults(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent
        data = _make_copilot_agent_data()
        result = create_copilot_agent(data, directory=str(temp_dir))
        today = date.today().strftime("%Y-%m-%d")
        assert result['created'] == today
        assert result['updated'] == today

    def test_create_copilot_agent_with_empty_name_raises(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, CopilotAgentError
        data = _make_copilot_agent_data(name='!!!')
        with pytest.raises(CopilotAgentError, match="slug"):
            create_copilot_agent(data, directory=str(temp_dir))


class TestGetCopilotAgent:
    """Tests for get_copilot_agent function."""

    def test_get_existing_copilot_agent(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, get_copilot_agent
        data = _make_copilot_agent_data()
        create_copilot_agent(data, directory=str(temp_dir))
        result = get_copilot_agent('hr-policy-assistant', directory=str(temp_dir))
        assert result['name'] == 'HR Policy Assistant'
        assert result['platform'] == 'copilot'

    def test_get_nonexistent_copilot_agent_raises(self, temp_dir):
        from core.copilot_agent_ops import get_copilot_agent, CopilotAgentError
        with pytest.raises(CopilotAgentError):
            get_copilot_agent('nonexistent-agent', directory=str(temp_dir))


class TestQueryCopilotAgents:
    """Tests for query_copilot_agents function."""

    def test_query_all_copilot_agents(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, query_copilot_agents
        for name in ['Agent A', 'Agent B', 'Agent C']:
            create_copilot_agent(
                _make_copilot_agent_data(name=name),
                directory=str(temp_dir),
            )
        results = query_copilot_agents(directory=str(temp_dir))
        assert len(results) == 3

    def test_query_by_status(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, update_copilot_agent, query_copilot_agents
        create_copilot_agent(_make_copilot_agent_data(name='Draft Agent'), directory=str(temp_dir))
        create_copilot_agent(_make_copilot_agent_data(name='Published Agent'), directory=str(temp_dir))
        update_copilot_agent('published-agent', {'status': 'published'}, directory=str(temp_dir))
        results = query_copilot_agents(directory=str(temp_dir), filters={'status': 'published'})
        assert len(results) == 1
        assert results[0]['name'] == 'Published Agent'


class TestUpdateCopilotAgent:
    """Tests for update_copilot_agent function."""

    def test_update_copilot_agent_status(self, temp_dir):
        from core.copilot_agent_ops import create_copilot_agent, update_copilot_agent
        create_copilot_agent(_make_copilot_agent_data(), directory=str(temp_dir))
        result = update_copilot_agent('hr-policy-assistant', {'status': 'published'}, directory=str(temp_dir))
        assert result['status'] == 'published'

    def test_update_nonexistent_copilot_agent_raises(self, temp_dir):
        from core.copilot_agent_ops import update_copilot_agent, CopilotAgentError
        with pytest.raises(CopilotAgentError):
            update_copilot_agent('nonexistent', {'status': 'published'}, directory=str(temp_dir))
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python -m pytest tests/test_copilot_agent_ops.py -v 2>&1 | head -20`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.copilot_agent_ops'`

**Step 3: Commit**

```bash
git add forge-lib/tests/test_copilot_agent_ops.py
git commit -m "test(copilot-forge): add tests for copilot agent CRUD operations"
```

---

## Task 4: Implement Copilot Agent Operations Module

**Files:**
- Create: `forge-lib/core/copilot_agent_ops.py`
- Reference: `forge-lib/core/agent_ops.py` (rovo-forge ops — mirror structure exactly)

**Step 1: Write the operations module**

```python
"""Copilot agent operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
Microsoft 365 Copilot Declarative Agent configurations for copilot-forge.

Agents are markdown files with YAML frontmatter stored in copilot-agents/{slug}/agent.md.
"""

from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, validator, index_ops
from .slug import generate_slug, SlugError


class CopilotAgentError(Exception):
    """Raised when copilot agent operations fail."""
    pass


def _get_agents_directory(directory: str) -> Path:
    """Get the path to the copilot-agents directory."""
    return Path(directory) / 'copilot-agents'


def _load_template() -> jinja2.Template:
    """Load the copilot_agent.md.j2 Jinja2 template."""
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_name = 'copilot_agent.md.j2'

    if not (templates_dir / template_name).exists():
        raise CopilotAgentError(f"Template not found: {templates_dir / template_name}")

    try:
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        template = template_env.get_template(template_name)
        return template
    except jinja2.TemplateError as e:
        raise CopilotAgentError(f"Failed to load template: {e}")


def create_copilot_agent(
    data: Dict[str, Any],
    directory: str = '.'
) -> Dict[str, Any]:
    """Create a new Copilot Declarative Agent configuration.

    Creates agent in copilot-agents/{slug}/agent.md, validates against schema,
    and updates the index.

    Args:
        data: Agent configuration data including name, platform, description, etc.
        directory: Base directory for agent storage (default: current directory)

    Returns:
        Dictionary with agent metadata

    Raises:
        CopilotAgentError: If agent creation fails
    """
    today = date.today().strftime("%Y-%m-%d")
    if 'status' not in data:
        data['status'] = 'draft'
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    try:
        validator.validate(data, 'copilot_agent')
    except validator.ValidationError as e:
        raise CopilotAgentError(f"Validation failed: {e}")

    try:
        slug = generate_slug(data['name'])
    except SlugError as e:
        raise CopilotAgentError(f"Failed to generate slug: {e}")

    agents_dir = _get_agents_directory(directory)
    agent_dir = agents_dir / slug

    if agent_dir.exists():
        raise CopilotAgentError(f"Agent already exists: {agent_dir}")

    agent_dir.mkdir(parents=True, exist_ok=True)

    template = _load_template()
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise CopilotAgentError(f"Failed to render template: {e}")

    filepath = agent_dir / 'agent.md'
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise CopilotAgentError(f"Failed to write agent file: {e}")

    try:
        entry = {
            'file': f"{slug}/agent.md",
            'type': 'copilot-agent',
            'title': data['name'],
            'name': data['name'],
            'platform': data['platform'],
            'status': data['status'],
            'description': data['description'],
            'created': data['created'],
            'updated': data['updated'],
        }
        index_ops.create_index_entry(str(agents_dir), entry)
    except Exception:
        pass

    return {
        'filename': 'agent.md',
        'slug': slug,
        'dirpath': str(agent_dir),
        'name': data['name'],
        'created': data['created'],
        'updated': data['updated'],
    }


def get_copilot_agent(
    slug: str,
    directory: str = '.'
) -> Dict[str, Any]:
    """Get copilot agent frontmatter by slug."""
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise CopilotAgentError(f"Agent not found: {filepath}")

    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
        return fm
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CopilotAgentError(f"Failed to read agent: {e}")


def query_copilot_agents(
    directory: str = '.',
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Query copilot agents from index."""
    agents_dir = _get_agents_directory(directory)

    try:
        return index_ops.query_index(str(agents_dir), filters=filters)
    except Exception:
        return []


def update_copilot_agent(
    slug: str,
    updates: Dict[str, Any],
    directory: str = '.'
) -> Dict[str, Any]:
    """Update copilot agent frontmatter and index."""
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise CopilotAgentError(f"Agent not found: {filepath}")

    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CopilotAgentError(f"Failed to read agent: {e}")

    fm.update(updates)
    today = date.today().strftime("%Y-%m-%d")
    fm['updated'] = today

    try:
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')
    except (OSError, frontmatter.FrontmatterError) as e:
        raise CopilotAgentError(f"Failed to write agent: {e}")

    try:
        index_ops.update_index_entry(str(agents_dir), f"{slug}/agent.md", fm)
    except Exception:
        pass

    return {
        'filename': 'agent.md',
        'slug': slug,
        'dirpath': str(agents_dir / slug),
        'status': fm.get('status'),
        'updated': fm['updated'],
    }
```

**Step 2: Run tests to verify they pass**

Run: `cd forge-lib && python -m pytest tests/test_copilot_agent_ops.py -v`
Expected: All tests PASS

**Step 3: Run existing rovo-forge agent tests to ensure no regression**

Run: `cd forge-lib && python -m pytest tests/test_agent_ops.py -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add forge-lib/core/copilot_agent_ops.py
git commit -m "feat(copilot-forge): implement copilot agent CRUD operations"
```

---

## Task 5: Add CLI Integration for Copilot Agent Commands

**Files:**
- Modify: `forge-lib/forge.py` (add `copilot-agent` subcommand block, parallel to `agent` block)

**Step 1: Add import**

At the top of `forge.py`, find the existing `from core.agent_ops import AgentError` import line. Add the copilot import nearby:

```python
from core.copilot_agent_ops import CopilotAgentError
```

Also add `copilot_agent_ops` to the `from core import ...` line if it uses that pattern, or add `from core import copilot_agent_ops` near the existing `from core import agent_ops`.

**Step 2: Add handler functions**

Add these handler functions near the existing `handle_agent_*` functions (around line 967):

```python
def handle_copilot_agent_create(args):
    """Create a new Copilot Declarative Agent configuration."""
    try:
        data = {'name': args.name, 'platform': 'copilot'}
        if args.data:
            data.update(json.loads(args.data))
        result = copilot_agent_ops.create_copilot_agent(data, directory=args.directory)
        output_json(result)
    except ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except CopilotAgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_copilot_agent_get(args):
    """Get a Copilot agent configuration by slug."""
    try:
        result = copilot_agent_ops.get_copilot_agent(args.slug, directory=args.directory)
        output_json(result)
    except CopilotAgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_copilot_agent_query(args):
    """Query Copilot agent configurations."""
    try:
        filters = {}
        if args.status:
            filters['status'] = args.status
        results = copilot_agent_ops.query_copilot_agents(directory=args.directory, filters=filters)
        output_json(results)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_copilot_agent_update(args):
    """Update a Copilot agent configuration."""
    try:
        updates = json.loads(args.data) if args.data else {}
        result = copilot_agent_ops.update_copilot_agent(args.slug, updates, directory=args.directory)
        output_json(result)
    except CopilotAgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)
```

**Step 3: Add CLI parser setup**

Add this block near the existing `agent_parser` setup (around line 1434):

```python
# copilot-agent subcommand
copilot_agent_parser = subparsers.add_parser("copilot-agent", help="Copilot Declarative Agent operations")
copilot_agent_subparsers = copilot_agent_parser.add_subparsers(dest="copilot_agent_command", required=True)

# copilot-agent create
copilot_agent_create = copilot_agent_subparsers.add_parser("create", help="Create a new Copilot agent")
copilot_agent_create.add_argument("name", help="Agent display name")
copilot_agent_create.add_argument("--data", help="Additional agent data as JSON")
copilot_agent_create.add_argument("--directory", default=".", help="Base directory")
copilot_agent_create.set_defaults(func=handle_copilot_agent_create)

# copilot-agent get
copilot_agent_get = copilot_agent_subparsers.add_parser("get", help="Get Copilot agent by slug")
copilot_agent_get.add_argument("slug", help="Agent directory slug")
copilot_agent_get.add_argument("--directory", default=".", help="Base directory")
copilot_agent_get.set_defaults(func=handle_copilot_agent_get)

# copilot-agent query
copilot_agent_query = copilot_agent_subparsers.add_parser("query", help="Query Copilot agents")
copilot_agent_query.add_argument("--status", choices=["draft", "published", "archived"], help="Filter by status")
copilot_agent_query.add_argument("--directory", default=".", help="Base directory")
copilot_agent_query.set_defaults(func=handle_copilot_agent_query)

# copilot-agent update
copilot_agent_update = copilot_agent_subparsers.add_parser("update", help="Update a Copilot agent")
copilot_agent_update.add_argument("slug", help="Agent directory slug")
copilot_agent_update.add_argument("--data", help="Update data as JSON")
copilot_agent_update.add_argument("--directory", default=".", help="Base directory")
copilot_agent_update.set_defaults(func=handle_copilot_agent_update)
```

**Step 4: Verify CLI works**

Run: `cd forge-lib && python forge.py copilot-agent create "Test Agent" --data '{"description": "Test copilot agent for CLI verification.", "capabilities": [], "conversation_starters": [{"title": "Test", "text": "Test prompt"}, {"title": "Test 2", "text": "Another prompt"}, {"title": "Test 3", "text": "Third prompt"}], "collaborators": [], "visibility": "organization"}' --directory /tmp/copilot-test`
Expected: JSON output with `"success": true`

Run: `cd forge-lib && python forge.py copilot-agent get "test-agent" --directory /tmp/copilot-test`
Expected: JSON output with agent frontmatter

**Step 5: Re-run all tests**

Run: `cd forge-lib && python -m pytest tests/ -v`
Expected: All tests PASS (both agent and copilot agent tests)

**Step 6: Commit**

```bash
git add forge-lib/forge.py
git commit -m "feat(copilot-forge): add copilot-agent CLI subcommand to forge.py"
```

---

## Task 6: Create Plugin Directory Structure and Metadata

**Files:**
- Create: `copilot-forge/.claude-plugin/plugin.json`
- Create: `copilot-forge/commands/` (directory)
- Create: `copilot-forge/skills/` (directory)
- Create: `copilot-forge/sample-configs/` (directory)

**Step 1: Create directory structure**

```bash
mkdir -p copilot-forge/.claude-plugin
mkdir -p copilot-forge/commands
mkdir -p copilot-forge/skills/copilot-foundation/references
mkdir -p copilot-forge/skills/m365-specialist/references
mkdir -p copilot-forge/sample-configs
```

**Step 2: Write plugin.json**

```json
{
  "name": "copilot-forge",
  "version": "2.1.0-alpha",
  "description": "Interactive builder for Microsoft 365 Copilot Declarative Agents. Guides through agent creation with pattern detection, knowledge source configuration, and copy-ready output for Agent Builder and Copilot Studio.",
  "author": { "name": "Jeremy Brice" }
}
```

**Step 3: Commit**

```bash
git add copilot-forge/.claude-plugin/plugin.json
git commit -m "feat(copilot-forge): scaffold plugin directory structure and metadata"
```

---

## Task 7: Write the copilot-foundation Skill

**Files:**
- Create: `copilot-forge/skills/copilot-foundation/SKILL.md`
- Create: `copilot-forge/skills/copilot-foundation/references/instruction-framework.md`
- Create: `copilot-forge/skills/copilot-foundation/references/validation-rules.md`
- Create: `copilot-forge/skills/copilot-foundation/references/knowledge-sources.md`
- Reference: `rovo-forge/skills/rovo-foundation/SKILL.md` (mirror structure)

**Step 1: Write SKILL.md**

This file provides core platform knowledge for Copilot Declarative Agents. It covers:
- Agent component taxonomy (name, description, instructions, capabilities, starters, governance)
- Instruction framework (Microsoft's best practices for writing effective instructions)
- Validation rules (character limits, capability limits, starter count)
- Knowledge source configuration (10 capability types, scoping, licensing)
- Agent Builder / Copilot Studio UI mapping
- Output format guidance for copy-ready sections

The SKILL.md should be structured identically to `rovo-forge/skills/rovo-foundation/SKILL.md` but with Copilot-specific content replacing Rovo-specific content. Key differences:
- Replace TCREI framework with Microsoft's instruction best practices
- Replace Rovo skills catalog with Copilot capabilities catalog
- Replace two-tier behavior/scenario with flat instructions block
- Replace conversation starters (exactly 3) with starters (3-12 with title+text)
- Replace collaborators max 40 with collaborators max 40 (same)
- Add capabilities-specific validation (WebSearch max 4 sites, Teams max 5 channels)

**Step 2: Write references/instruction-framework.md**

Microsoft's guidance for writing effective agent instructions:
- Structure: Purpose → General Guidelines → Workflows → Output Format
- Language: Positive framing ("do X" not "don't Y"), precise verbs, atomic steps
- Formatting: Markdown headers, bullets for parallel tasks, numbered steps for sequential
- Advanced: Self-evaluation gates, reasoning control, output contracts, few-shot examples
- Anti-patterns: Vague instructions, missing tone guidance, no output format

**Step 3: Write references/validation-rules.md**

Complete constraint reference:
- Name: max 100 chars
- Description: max 1,000 chars
- Instructions: max 8,000 chars
- Conversation starters: min 3, max 12 (each with title + text)
- WebSearch sites: max 4, max 2 path segments
- TeamsMessages: max 5 URLs
- Collaborators: max 40
- Instruction performance tiers (concise = faster, 8,000 char limit = maximum)

**Step 4: Write references/knowledge-sources.md**

Complete capability catalog:
- WebSearch (Bing index, optional URL scoping)
- OneDriveAndSharePoint (sites, folders, files by URL or SharePoint IDs)
- GraphConnectors (external indexed data by connection ID)
- Email (personal/shared mailboxes, folder scoping)
- TeamsMessages (channels, group chats, 1:1 chats, meeting chats)
- Meetings (metadata, transcripts, chats)
- People (profiles, org hierarchy, collaborator insights)
- Dataverse (CRM/business data from tables)
- GraphicArt (DALL-E image generation)
- CodeInterpreter (Python code execution)
- Licensing requirements per capability
- Scoping strategies (narrow vs broad)

**Step 5: Commit**

```bash
git add copilot-forge/skills/copilot-foundation/
git commit -m "feat(copilot-forge): add copilot-foundation skill with reference materials"
```

---

## Task 8: Write the m365-specialist Skill

**Files:**
- Create: `copilot-forge/skills/m365-specialist/SKILL.md`
- Create: `copilot-forge/skills/m365-specialist/references/m365-patterns.md`
- Create: `copilot-forge/skills/m365-specialist/references/capabilities-catalog.md`
- Reference: `rovo-forge/skills/jira-specialist/SKILL.md` (mirror structure)

**Step 1: Write SKILL.md**

M365-specific domain knowledge:
- Naming convention: purpose-based (e.g., "HR Policy Assistant", "Sales Email Summarizer")
- Capabilities catalog overview (10 types with selection guidance)
- Pre-built patterns overview (5 patterns with trigger keywords)
- Instruction patterns (reusable building blocks)
- Agent Builder / Copilot Studio UI field mapping
- Known limitations and workarounds

**Step 2: Write references/m365-patterns.md**

Five complete pattern templates (parallel to `rovo-forge/skills/jira-specialist/references/jira-patterns.md`):

1. **SharePoint Knowledge Agent** — Full template with:
   - Identity (name suggestion, description template)
   - Capabilities config (OneDriveAndSharePoint with scoping examples)
   - Instructions skeleton (purpose, guidelines, workflows for document retrieval + summarization)
   - Starters (3 examples with title + text)
   - Trigger keywords

2. **Email Insights Agent** — Full template with Email capability, privacy-aware instruction patterns

3. **Teams Channel Expert** — Full template with TeamsMessages capability, attribution patterns

4. **Meeting Assistant** — Full template with Meetings capability, structured output patterns

5. **Enterprise Knowledge Hub** — Full template with multi-source capabilities, cross-reference patterns

Each pattern should be 150-250 lines with complete, copy-ready instruction templates.

**Step 3: Write references/capabilities-catalog.md**

Detailed reference for all 10 capability types:
- Configuration syntax for each (what goes in the capabilities array)
- Scoping options and limits
- Licensing requirements
- Use case examples
- Selection strategy per pattern type

**Step 4: Commit**

```bash
git add copilot-forge/skills/m365-specialist/
git commit -m "feat(copilot-forge): add m365-specialist skill with patterns and capabilities catalog"
```

---

## Task 9: Write the Main Command — agent.md

**Files:**
- Create: `copilot-forge/commands/agent.md`
- Reference: `rovo-forge/commands/jira-agent.md` (mirror structure exactly — 11 phases)

**Step 1: Write agent.md**

The command file follows the exact structure of `rovo-forge/commands/jira-agent.md` with 11 phases adapted for Copilot:

```markdown
---
name: agent
description: "Interactive Copilot Declarative Agent builder for Microsoft 365. Guides through knowledge source configuration and instruction authoring to produce a complete Agent Builder / Copilot Studio configuration with validated output."
---

# /copilot-forge:agent: Copilot Agent Builder

You are an interactive Copilot Declarative Agent builder for Microsoft 365...
```

Phase mapping from rovo-forge:

| Rovo Phase | Copilot Phase | Key Changes |
|---|---|---|
| 1: Pattern Detection | 1: Pattern Detection | 5 M365 patterns instead of 5 Jira patterns |
| 2: Identity Configuration | 2: Identity Configuration | Purpose-based naming, max 1000 char description |
| 3: Behavior Definition | 5: Instruction Authoring | Single block (up to 8,000 chars) instead of behavior+scenarios |
| 4: Scenario Design | (merged into Phase 5) | Copilot uses workflows within instructions, not separate scenarios |
| 5: Knowledge Source Selection | 3: Knowledge Source Selection | 10 M365 capabilities instead of Jira/Confluence sources |
| 6: Skill Selection | 4: Knowledge Source Scoping | Configure URLs/IDs/mailboxes per capability |
| 7: Conversation Starters | 7: Conversation Starters | 3-12 with title+text instead of exactly 3 strings |
| 8: Governance | 8: Governance | Same (owner, collaborators, visibility) |
| 9: Automation Integration | 6: Additional Capabilities | GraphicArt, CodeInterpreter instead of automation mode |
| 10: Assembly and Output | 9-10: Validation + Copy-Ready Output | Map to Agent Builder UI fields |
| 11: File Persistence | 11: File Persistence | `forge copilot-agent create` instead of `forge agent create` |

The command should be 250-320 lines (matching rovo-forge command length). Include:
- Adaptive interview behavior section at the end
- Validation checks table in Phase 9
- Copy-ready output format in Phase 10 with Agent Builder UI field labels
- Error handling guidance in Phase 11

**Step 2: Commit**

```bash
git add copilot-forge/commands/agent.md
git commit -m "feat(copilot-forge): add /copilot-forge:agent command with 11-phase workflow"
```

---

## Task 10: Write Sample Configs

**Files:**
- Create: `copilot-forge/sample-configs/sharepoint-knowledge-agent.md`
- Create: `copilot-forge/sample-configs/email-insights-agent.md`
- Create: `copilot-forge/sample-configs/teams-channel-expert.md`
- Reference: `rovo-forge/sample-configs/ticket-triage-agent.md` (mirror format)

**Step 1: Write sharepoint-knowledge-agent.md**

"IT Support Knowledge Base" — demonstrates:
- OneDriveAndSharePoint capability with scoped URL
- Instructions with structured troubleshooting workflows
- Citation patterns in output format
- 4 conversation starters
- Validation summary table

**Step 2: Write email-insights-agent.md**

"Sales Email Summarizer" — demonstrates:
- Email capability with shared mailbox
- Privacy-aware summarization instructions
- Action item extraction workflows
- 3 conversation starters
- Validation summary table

**Step 3: Write teams-channel-expert.md**

"Engineering Decisions Tracker" — demonstrates:
- TeamsMessages capability with channel scoping
- Decision attribution and consensus surfacing
- Speaker attribution in output format
- 3 conversation starters
- Validation summary table

Each sample config should follow the exact output format from Phase 10 of the command (Agent Builder UI field mapping), including the validation summary table.

**Step 4: Commit**

```bash
git add copilot-forge/sample-configs/
git commit -m "feat(copilot-forge): add 3 sample agent configurations"
```

---

## Task 11: Write the Plugin README

**Files:**
- Create: `copilot-forge/README.md`
- Reference: `rovo-forge/README.md` (mirror structure)

**Step 1: Write README.md**

Follow `rovo-forge/README.md` structure exactly:
- Overview (pattern detection, guided workflows, knowledge integration, copy-ready output, validation)
- Commands section (`/copilot-forge:agent` with use cases, workflow steps, skills used, output format, example patterns)
- Skills section (copilot-foundation + m365-specialist with topics and references)
- Sample Configs section (3 sample agents)
- Architecture section (v2 notes — pure conversational workflows)
- Usage Examples (2 examples showing the guided workflow)
- Integration section (output-to-UI field mapping table for Agent Builder / Copilot Studio)
- Key Features list
- Related Plugins list
- Version History

**Step 2: Commit**

```bash
git add copilot-forge/README.md
git commit -m "docs(copilot-forge): add comprehensive README documentation"
```

---

## Task 12: Add Forge-Shell View Controller and CSS

**Files:**
- Create: `forge-shell/app/js/copilot-forge.js`
- Create: `forge-shell/app/css/copilot-forge.css`
- Reference: `forge-shell/app/js/rovo-agent-forge.js` (mirror structure)
- Reference: `forge-shell/app/css/rovo-agent-forge.css` (mirror structure)

**Step 1: Write copilot-forge.js**

Mirror `rovo-agent-forge.js` structure with these changes:
- `scanAgents()` scans `copilot-agents/` instead of `rovo-agents/`
- Sidebar filter: by capability type (OneDriveAndSharePoint, Email, TeamsMessages, etc.) instead of platform (jira/confluence)
- Detail panel: show capabilities as badges, instructions preview, conversation starters with title+text
- Edit modal: sections for Identity, Capabilities, Instructions, Additional Capabilities, Conversation Starters, Governance
- Register as `Shell.registerController('copilot-forge', CopilotForgeView)`

**Step 2: Write copilot-forge.css**

Mirror `rovo-agent-forge.css` with:
- Capability badges (color-coded by capability type)
- Instructions preview styling
- Conversation starters with title+text layout

**Step 3: Commit**

```bash
git add forge-shell/app/js/copilot-forge.js forge-shell/app/css/copilot-forge.css
git commit -m "feat(copilot-forge): add forge-shell view controller and CSS"
```

---

## Task 13: Integrate Copilot-Forge into Forge-Shell

**Files:**
- Modify: `forge-shell/app/index.html`
- Modify: `forge-shell/app/js/shell.js`

**Step 1: Add CSS link to index.html**

In `index.html`, add after the rovo-agent-forge CSS link (line 19):

```html
  <link rel="stylesheet" href="css/copilot-forge.css">
```

**Step 2: Add view container to index.html**

After the rovo-agent-forge view div (line 87), add:

```html
      <!-- Copilot Forge View -->
      <div id="view-copilot-forge" class="shell-view">
        <!-- Rendered by CopilotForgeView controller -->
      </div>
```

**Step 3: Add script tag to index.html**

After the rovo-agent-forge script tag (line 128), add:

```html
  <script src="js/copilot-forge.js"></script>
```

**Step 4: Add plugin entry to shell.js PLUGINS array**

In `shell.js`, add after the rovo-agent-forge entry (line 16):

```javascript
  { id: 'copilot-forge',       label: 'Copilot Forge',    icon: 'fa-solid fa-microchip',  requiredDir: 'copilot-agents' },
```

**Step 5: Verify forge-shell loads without errors**

Run: `cd forge-shell && npm run tauri dev` (or verify HTML loads in browser)
Expected: Copilot Forge appears in the sidebar nav when `copilot-agents/` directory exists

**Step 6: Commit**

```bash
git add forge-shell/app/index.html forge-shell/app/js/shell.js
git commit -m "feat(copilot-forge): integrate copilot-forge view into forge-shell"
```

---

## Task 14: Update CLAUDE.md with Copilot-Forge Plugin

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add copilot-forge to the Plugins table**


```markdown
| **copilot-forge** | `/copilot-forge:agent` | `copilot-agents/` + `copilot-agents/index.json` |
```

**Step 2: Add copilot-agents to the File Naming Patterns table**

In the `## File Naming Patterns` table, add:

```markdown
| Copilot Agent | `{slug}/agent.md` | `hr-policy-assistant/agent.md` |
```

**Step 3: Add view controller to Forge Shell section**

In the `## Forge Shell Desktop App` section's **View Controllers** list, add:

```markdown
- `copilot-forge.js` — Copilot agent dashboard with capability badges
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add copilot-forge plugin to CLAUDE.md project documentation"
```

---

## Task Summary

| Task | Component | Files | Depends On |
|------|-----------|-------|------------|
| 1 | JSON Schema | `forge-lib/schemas/copilot_agent.json` | — |
| 2 | Jinja2 Template | `forge-lib/templates/copilot_agent.md.j2` | — |
| 3 | Tests | `forge-lib/tests/test_copilot_agent_ops.py` | 1, 2 |
| 4 | Operations Module | `forge-lib/core/copilot_agent_ops.py` | 1, 2 |
| 5 | CLI Integration | `forge-lib/forge.py` | 4 |
| 6 | Plugin Structure | `copilot-forge/.claude-plugin/plugin.json` | — |
| 7 | Foundation Skill | `copilot-forge/skills/copilot-foundation/` | — |
| 8 | M365 Specialist Skill | `copilot-forge/skills/m365-specialist/` | — |
| 9 | Command | `copilot-forge/commands/agent.md` | 7, 8 |
| 10 | Sample Configs | `copilot-forge/sample-configs/` | 9 |
| 11 | README | `copilot-forge/README.md` | 9 |
| 12 | Shell View Controller | `forge-shell/app/js/copilot-forge.js` + CSS | — |
| 13 | Shell Integration | `forge-shell/app/index.html` + `shell.js` | 12 |
| 14 | CLAUDE.md Update | `CLAUDE.md` | — |

**Parallelizable groups:**
- Tasks 1-2 + 6-8 can all run in parallel (no dependencies)
- Tasks 3-5 must be sequential (TDD)
- Tasks 9-11 sequential (command → samples → README)
- Tasks 12-13 sequential (controller → integration)
- Task 14 independent
