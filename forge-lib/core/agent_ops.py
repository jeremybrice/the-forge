"""Agent operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
Rovo agent configurations for rovo-forge.

Agents are markdown files with YAML frontmatter stored in rovo-agents/{slug}/agent.md.
"""

from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, validator, index_ops
from .slug import generate_slug


class AgentError(Exception):
    """Raised when agent operations fail."""
    pass


def _get_agents_directory(directory: str) -> Path:
    """Get the path to the rovo-agents directory.

    Args:
        directory: Base directory containing the rovo-agents folder

    Returns:
        Path to rovo-agents/ directory
    """
    return Path(directory) / 'rovo-agents'


def _load_template() -> jinja2.Template:
    """Load the agent.md.j2 Jinja2 template.

    Returns:
        Jinja2 Template object

    Raises:
        AgentError: If template loading fails
    """
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_name = 'agent.md.j2'

    if not (templates_dir / template_name).exists():
        raise AgentError(f"Template not found: {templates_dir / template_name}")

    try:
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        template = template_env.get_template(template_name)
        return template
    except jinja2.TemplateError as e:
        raise AgentError(f"Failed to load template: {e}")


def create_agent(
    data: Dict[str, Any],
    directory: str = '.'
) -> Dict[str, Any]:
    """Create a new Rovo agent configuration.

    Creates agent in rovo-agents/{slug}/agent.md, validates against schema,
    and updates the index.

    Args:
        data: Agent configuration data including name, platform, description, etc.
        directory: Base directory for agent storage (default: current directory)

    Returns:
        Dictionary with agent metadata:
        {
            'filename': 'agent.md',
            'slug': 'ticket-triage-agent',
            'dirpath': '/full/path/to/rovo-agents/ticket-triage-agent',
            'name': 'Ticket Triage Agent',
            'created': '2026-02-17',
            'updated': '2026-02-17'
        }

    Raises:
        AgentError: If agent creation fails (including validation failures)
    """
    # Add defaults for status, created, updated
    today = date.today().strftime("%Y-%m-%d")
    if 'status' not in data:
        data['status'] = 'draft'
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate against schema
    try:
        validator.validate(data, 'agent')
    except validator.ValidationError as e:
        raise AgentError(f"Validation failed: {e}")

    # Generate slug from name
    slug = generate_slug(data['name'])

    # Get agents directory and agent subdirectory
    agents_dir = _get_agents_directory(directory)
    agent_dir = agents_dir / slug

    # Check for duplicate
    if agent_dir.exists():
        raise AgentError(f"Agent already exists: {agent_dir}")

    # Create directory structure
    agent_dir.mkdir(parents=True, exist_ok=True)

    # Load template and render
    template = _load_template()
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise AgentError(f"Failed to render template: {e}")

    # Write agent file
    filepath = agent_dir / 'agent.md'
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise AgentError(f"Failed to write agent file: {e}")

    # Update index (non-fatal)
    try:
        entry = {
            'file': f"{slug}/agent.md",
            'type': 'agent',
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


def get_agent(
    slug: str,
    directory: str = '.'
) -> Dict[str, Any]:
    """Get agent frontmatter by slug.

    Args:
        slug: Agent slug (directory name)
        directory: Base directory for agent storage

    Returns:
        Dictionary with agent frontmatter data

    Raises:
        AgentError: If agent not found or reading fails
    """
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise AgentError(f"Agent not found: {filepath}")

    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
        return fm
    except (OSError, frontmatter.FrontmatterError) as e:
        raise AgentError(f"Failed to read agent: {e}")


def query_agents(
    directory: str = '.',
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Query agents from index.

    Args:
        directory: Base directory for agent storage
        filters: Optional filters to apply (e.g., {'platform': 'jira'})

    Returns:
        List of agent metadata dictionaries
    """
    agents_dir = _get_agents_directory(directory)

    try:
        return index_ops.query_index(str(agents_dir), filters=filters)
    except Exception:
        return []


def update_agent(
    slug: str,
    updates: Dict[str, Any],
    directory: str = '.'
) -> Dict[str, Any]:
    """Update agent frontmatter and index.

    Args:
        slug: Agent slug (directory name)
        updates: Dictionary of fields to update
        directory: Base directory for agent storage

    Returns:
        Dictionary with updated agent metadata

    Raises:
        AgentError: If update fails
    """
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise AgentError(f"Agent not found: {filepath}")

    # Read current content
    try:
        content = filepath.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)
    except (OSError, frontmatter.FrontmatterError) as e:
        raise AgentError(f"Failed to read agent: {e}")

    # Apply updates
    fm.update(updates)

    # Update the 'updated' timestamp
    today = date.today().strftime("%Y-%m-%d")
    fm['updated'] = today

    # Write updated content
    try:
        updated_content = frontmatter.dumps(fm, body)
        filepath.write_text(updated_content, encoding='utf-8')
    except (OSError, frontmatter.FrontmatterError) as e:
        raise AgentError(f"Failed to write agent: {e}")

    # Update index (non-fatal)
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
