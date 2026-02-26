"""
Memory operations for forge-lib.

Manages organizational taxonomy (products, clients, teams, integrations)
stored in memory/context/ directory with YAML frontmatter.
"""

import os
import re
import json
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Any

import jinja2

from core import frontmatter
from core import validator
from core import index_ops


# Taxonomy type to file mappings
TAXONOMY_FILES = {
    'products': 'memory/context/products.md',
    'clients': 'memory/context/clients.md',
    'integrations': 'memory/context/integrations.md',
    'teams': 'memory/context/company.md'
}

# Taxonomy type to YAML key mappings
# products.md contains multiple arrays: products, modules, systems
TAXONOMY_KEYS = {
    'products': 'products',
    'modules': 'modules',
    'systems': 'systems',
    'clients': 'clients',
    'integrations': 'integrations',
    'teams': 'teams'
}


class MemoryError(Exception):
    """Custom exception for memory operation errors."""
    def __init__(self, message: str, taxonomy_type: Optional[str] = None):
        self.taxonomy_type = taxonomy_type
        super().__init__(message)


def get_taxonomy_file_path(taxonomy_type: str, directory: str = ".") -> Path:
    """
    Resolve the file path for a taxonomy type.

    Args:
        taxonomy_type: Type of taxonomy (products, modules, systems, clients, integrations, teams)
        directory: Base directory (default current directory)

    Returns:
        Path object for the taxonomy file

    Raises:
        MemoryError: If taxonomy type is not supported
    """
    # Map taxonomy type to file
    if taxonomy_type in ['products', 'modules', 'systems']:
        relative_path = TAXONOMY_FILES['products']
    elif taxonomy_type in TAXONOMY_FILES:
        relative_path = TAXONOMY_FILES[taxonomy_type]
    else:
        supported = list(TAXONOMY_KEYS.keys())
        raise MemoryError(
            f"Unsupported taxonomy type '{taxonomy_type}'. Supported types: {', '.join(supported)}",
            taxonomy_type=taxonomy_type
        )

    return Path(directory) / relative_path


def get_taxonomy(taxonomy_type: str, directory: str = ".") -> List[str]:
    """
    Get taxonomy values from memory files.

    Reads YAML frontmatter from memory/context/{type}.md and returns
    the array of values for the specified taxonomy type.

    Args:
        taxonomy_type: Type of taxonomy (products, modules, systems, clients, integrations, teams)
        directory: Base directory (default current directory)

    Returns:
        List of taxonomy values (empty list if file doesn't exist or key not found)

    Raises:
        MemoryError: If taxonomy type is not supported or file is malformed
    """
    file_path = get_taxonomy_file_path(taxonomy_type, directory)

    # If file doesn't exist, return empty list
    if not file_path.exists():
        return []

    # Read frontmatter
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        data, body = frontmatter.parse(content)
    except Exception as e:
        raise MemoryError(
            f"Failed to read taxonomy file {file_path}: {e}",
            taxonomy_type=taxonomy_type
        )

    # Get the YAML key for this taxonomy type
    yaml_key = TAXONOMY_KEYS.get(taxonomy_type)
    if not yaml_key:
        raise MemoryError(
            f"No YAML key mapping for taxonomy type '{taxonomy_type}'",
            taxonomy_type=taxonomy_type
        )

    # Return the array (or empty list if key doesn't exist)
    values = data.get(yaml_key, [])
    if not isinstance(values, list):
        raise MemoryError(
            f"Taxonomy key '{yaml_key}' in {file_path} is not a list",
            taxonomy_type=taxonomy_type
        )

    return values


def set_taxonomy(
    taxonomy_type: str,
    value: str,
    operation: str = "add",
    directory: str = "."
) -> Dict[str, Any]:
    """
    Add or remove a value from a taxonomy array.

    Modifies YAML frontmatter in memory/context/{type}.md.
    Creates the file if it doesn't exist.

    Args:
        taxonomy_type: Type of taxonomy (products, modules, systems, clients, integrations, teams)
        value: Value to add or remove
        operation: Either "add" or "remove" (default "add")
        directory: Base directory (default current directory)

    Returns:
        Dict with success status and updated values

    Raises:
        MemoryError: If operation fails
    """
    if operation not in ['add', 'remove']:
        raise MemoryError(f"Invalid operation '{operation}'. Must be 'add' or 'remove'")

    file_path = get_taxonomy_file_path(taxonomy_type, directory)
    yaml_key = TAXONOMY_KEYS.get(taxonomy_type)

    if not yaml_key:
        raise MemoryError(
            f"No YAML key mapping for taxonomy type '{taxonomy_type}'",
            taxonomy_type=taxonomy_type
        )

    # Read existing file or create new structure
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        data, body = frontmatter.parse(content)
    else:
        # Create directory if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        data = {}
        body = _get_default_body(taxonomy_type)

    # Get current values
    values = data.get(yaml_key, [])
    if not isinstance(values, list):
        values = []

    # Perform operation
    if operation == "add":
        if value not in values:
            values.append(value)
            action = "added"
        else:
            action = "already exists"
    else:  # remove
        if value in values:
            values.remove(value)
            action = "removed"
        else:
            action = "not found"

    # Update data
    data[yaml_key] = values

    # Write back to file
    try:
        new_content = frontmatter.dumps(data, body)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    except Exception as e:
        raise MemoryError(
            f"Failed to write taxonomy file {file_path}: {e}",
            taxonomy_type=taxonomy_type
        )

    return {
        "success": True,
        "action": action,
        "taxonomy_type": taxonomy_type,
        "value": value,
        "values": values,
        "file": str(file_path)
    }


def init_memory(directory: str = ".") -> Dict[str, Any]:
    """
    Initialize memory directory structure.

    Creates:
    - memory/context/ directory
    - memory/context/products.md (stub)
    - memory/context/clients.md (stub)
    - memory/context/integrations.md (stub)
    - memory/context/company.md (stub)

    Args:
        directory: Base directory (default current directory)

    Returns:
        Dict with success status and created files

    Raises:
        MemoryError: If initialization fails
    """
    base_path = Path(directory) / "memory" / "context"

    try:
        # Create directory
        base_path.mkdir(parents=True, exist_ok=True)

        created_files = []

        # Create stub files if they don't exist
        files_to_create = {
            'products.md': _create_products_stub(),
            'clients.md': _create_clients_stub(),
            'integrations.md': _create_integrations_stub(),
            'company.md': _create_company_stub()
        }

        for filename, content in files_to_create.items():
            file_path = base_path / filename
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                created_files.append(str(file_path))

        return {
            "success": True,
            "directory": str(base_path),
            "created_files": created_files
        }

    except Exception as e:
        raise MemoryError(f"Failed to initialize memory structure: {e}")


def _get_default_body(taxonomy_type: str) -> str:
    """Get default markdown body for a taxonomy type."""
    if taxonomy_type in ['products', 'modules', 'systems']:
        return _create_products_stub().split('---\n')[-1]
    elif taxonomy_type == 'clients':
        return _create_clients_stub().split('---\n')[-1]
    elif taxonomy_type == 'integrations':
        return _create_integrations_stub().split('---\n')[-1]
    elif taxonomy_type == 'teams':
        return _create_company_stub().split('---\n')[-1]
    return "\n# Taxonomy\n\nAdd descriptions for each item below.\n"


def _create_products_stub() -> str:
    """Create stub content for products.md."""
    return """---
products: []
modules: []
systems: []
---

# Products

Add your products below. Run `/memory:setup-org` to populate this file interactively.

# Modules

Add your modules/functional areas below.

# Systems

| System | Description |
|--------|-------------|
| | |
"""


def _create_clients_stub() -> str:
    """Create stub content for clients.md."""
    return """---
clients: []
---

# Clients

Add your key clients/customers below. Run `/memory:setup-org` to populate this file interactively.

## Example Client

Description of the client and context.
"""


def _create_integrations_stub() -> str:
    """Create stub content for integrations.md."""
    return """---
integrations: []
---

# Integrations

Add your external system integrations below. Run `/memory:setup-org` to populate this file interactively.

## Example Integration

Description of what the integration does.
"""


def _create_company_stub() -> str:
    """Create stub content for company.md."""
    return """---
teams: []
---

# Company Context

Run `/memory:setup-org` to populate this file interactively.

## Identity

[Company name]. [What they do]. [Terminology notes.]

## Teams

| Team | What they do | Key people |
|------|--------------|------------|
| | | |

## Tools & Systems

| Tool | Used for | Internal name |
|------|----------|---------------|
| | | |
"""


# CLI-friendly function for JSON output
def get_taxonomy_json(taxonomy_type: str, directory: str = ".") -> str:
    """
    Get taxonomy values as JSON string.

    Args:
        taxonomy_type: Type of taxonomy
        directory: Base directory

    Returns:
        JSON string with taxonomy values
    """
    try:
        values = get_taxonomy(taxonomy_type, directory)
        return json.dumps({
            "success": True,
            "taxonomy_type": taxonomy_type,
            "values": values
        }, indent=2)
    except MemoryError as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "taxonomy_type": taxonomy_type
        }, indent=2)


# =============================================================================
# Knowledge Entry Operations (people, projects, glossary)
# =============================================================================

KNOWLEDGE_TYPES = {
    'person': {'directory': 'people', 'schema': 'person', 'template': 'person', 'name_field': 'name'},
    'project': {'directory': 'projects', 'schema': 'project-memory', 'template': 'project-memory', 'name_field': 'name'},
    'glossary': {'directory': 'glossary', 'schema': 'glossary', 'template': 'glossary', 'name_field': 'term'},
}


def _generate_slug(name: str) -> str:
    """Convert a name/term to a URL-safe slug.

    Lowercases, replaces spaces with hyphens, strips non-alphanumeric/hyphen
    characters, collapses multiple hyphens, and trims leading/trailing hyphens.

    Args:
        name: Display name or term

    Returns:
        URL-safe slug string

    Examples:
        >>> _generate_slug('Jane Smith')
        'jane-smith'
        >>> _generate_slug('API Platform')
        'api-platform'
    """
    slug = name.lower()
    slug = slug.replace(' ', '-')
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


def _load_knowledge_template(template_name: str) -> jinja2.Template:
    """Load a knowledge entry Jinja2 template.

    Args:
        template_name: Template base name (without .md.j2 extension)

    Returns:
        Jinja2 Template object

    Raises:
        MemoryError: If template loading fails
    """
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_file = f'{template_name}.md.j2'

    if not (templates_dir / template_file).exists():
        raise MemoryError(f"Template not found: {templates_dir / template_file}")

    try:
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        return template_env.get_template(template_file)
    except jinja2.TemplateError as e:
        raise MemoryError(f"Failed to load template: {e}")


def create_knowledge_entry(
    entry_type: str,
    data: Dict[str, Any],
    directory: str = '.'
) -> Dict[str, Any]:
    """Create a new knowledge entry (person, project, or glossary term).

    Creates a markdown file with YAML frontmatter in the appropriate
    memory subdirectory, validates against the schema, and updates the
    memory index.

    Args:
        entry_type: Type of entry ('person', 'project', or 'glossary')
        data: Entry data dictionary matching the schema requirements
        directory: Base directory for memory storage (default: current directory)

    Returns:
        Dictionary with entry metadata:
        {
            'filename': 'jane-smith.md',
            'filepath': '/full/path/to/memory/people/jane-smith.md',
            'type': 'person',
            'name': 'Jane Smith',
            'created': '2026-02-17',
            'updated': '2026-02-17'
        }

    Raises:
        MemoryError: If entry_type is invalid, validation fails, or write fails
    """
    # Validate entry type
    if entry_type not in KNOWLEDGE_TYPES:
        supported = ', '.join(KNOWLEDGE_TYPES.keys())
        raise MemoryError(
            f"Unsupported knowledge type '{entry_type}'. Supported types: {supported}"
        )

    type_config = KNOWLEDGE_TYPES[entry_type]

    # Set defaults
    today = date.today().strftime("%Y-%m-%d")
    data['type'] = entry_type
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate against schema
    try:
        validator.validate(data, type_config['schema'])
    except validator.ValidationError as e:
        raise MemoryError(f"Validation failed: {e}")

    # Generate slug from name/term field
    name_field = type_config['name_field']
    name_value = data[name_field]
    slug = _generate_slug(name_value)
    filename = f"{slug}.md"

    # Create directory
    memory_dir = Path(directory) / 'memory'
    entry_dir = memory_dir / type_config['directory']
    entry_dir.mkdir(parents=True, exist_ok=True)

    # Check for duplicate
    filepath = entry_dir / filename
    if filepath.exists():
        raise MemoryError(f"Knowledge entry already exists: {filepath}")

    # Load template and render
    template = _load_knowledge_template(type_config['template'])
    try:
        content = template.render(**data)
    except jinja2.TemplateError as e:
        raise MemoryError(f"Failed to render template: {e}")

    # Write file
    try:
        filepath.write_text(content, encoding='utf-8')
    except OSError as e:
        raise MemoryError(f"Failed to write knowledge entry: {e}")

    # Update index (non-fatal)
    try:
        entry = {
            'file': f"{type_config['directory']}/{filename}",
            'type': entry_type,
            'title': name_value,
            'name': name_value,
            'created': data['created'],
            'updated': data['updated'],
        }
        index_ops.create_index_entry(str(memory_dir), entry)
    except Exception:
        pass

    return {
        'filename': filename,
        'filepath': str(filepath),
        'type': entry_type,
        'name': name_value,
        'created': data['created'],
        'updated': data['updated'],
    }


def query_knowledge(
    directory: str = '.',
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Query knowledge entries from memory index.

    Reads the memory index and returns entries matching the optional filters.

    Args:
        directory: Base directory containing the memory folder
        filters: Optional filters to apply (e.g., {'type': 'person'})

    Returns:
        List of matching entry dictionaries
    """
    memory_dir = Path(directory) / 'memory'

    try:
        return index_ops.query_index(str(memory_dir), filters=filters)
    except Exception:
        return []


# =============================================================================
# Decay Engine
# =============================================================================

def derive_lifecycle_status(importance: int) -> str:
    """Derive lifecycle status from importance score.

    Thresholds:
        >= 40: trusted
        10-39: probationary
        < 10:  sunset

    Args:
        importance: Current importance score (0-100)

    Returns:
        Lifecycle status string: "trusted", "probationary", or "sunset"
    """
    if importance >= 40:
        return "trusted"
    elif importance >= 10:
        return "probationary"
    else:
        return "sunset"


def compute_decay(importance: int, last_recalled) -> int:
    """Compute decayed importance score based on inactivity period.

    Stepped decay thresholds (cumulative penalty):
        0-30 days:    0 (grace period)
        31-60 days:  -10
        61-90 days:  -25
        91-180 days: -45
        180+ days:   -70

    Args:
        importance: Current importance score (0-100)
        last_recalled: Date of last recall (date object or ISO format string)

    Returns:
        Integer importance score floored at 0.
    """
    if isinstance(last_recalled, str):
        last_recalled = date.fromisoformat(last_recalled)

    days_inactive = (date.today() - last_recalled).days
    decay = 0

    if days_inactive > 180:
        decay = 70
    elif days_inactive > 90:
        decay = 45
    elif days_inactive > 60:
        decay = 25
    elif days_inactive > 30:
        decay = 10

    return max(0, importance - decay)


def run_decay(directory: str = ".") -> Dict[str, Any]:
    """Run decay evaluation across all memory knowledge entries.

    Scans memory/people/, memory/projects/, memory/glossary/ for .md files.
    Computes new importance based on last_recalled date.
    Updates frontmatter in place if score changed.

    Args:
        directory: Base directory containing the memory folder

    Returns:
        Summary report dict with keys:
            entries_scanned: Total .md files examined
            entries_decayed: Number of files whose importance changed
            transitions: List of lifecycle status changes
    """
    knowledge_dirs = ["people", "projects", "glossary"]
    base_path = Path(directory)
    entries_scanned = 0
    entries_decayed = 0
    transitions = []

    for subdir in knowledge_dirs:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            entries_scanned += 1
            content = md_file.read_text()
            metadata, body = frontmatter.parse(content)

            importance = metadata.get("importance", 45)
            last_recalled_str = metadata.get(
                "last_recalled",
                metadata.get("created", date.today().isoformat())
            )
            old_status = metadata.get("lifecycle_status", "trusted")

            new_score = compute_decay(importance, last_recalled_str)
            new_status = derive_lifecycle_status(new_score)

            if new_score != importance or new_status != old_status:
                entries_decayed += 1
                metadata["importance"] = new_score
                metadata["lifecycle_status"] = new_status
                metadata["updated"] = date.today().isoformat()
                updated_content = frontmatter.dumps(metadata, body)
                md_file.write_text(updated_content)

                if old_status != new_status:
                    transitions.append({
                        "file": str(md_file.relative_to(base_path)),
                        "name": metadata.get("name", metadata.get("term", "")),
                        "from": old_status,
                        "to": new_status,
                        "score": new_score
                    })

    return {
        "entries_scanned": entries_scanned,
        "entries_decayed": entries_decayed,
        "transitions": transitions
    }
