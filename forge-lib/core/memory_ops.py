"""
Memory operations for forge-lib.

Manages organizational taxonomy (products, clients, teams, integrations)
stored in memory/context/ directory with YAML frontmatter.
"""

import os
import json
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Any

import jinja2

from core import frontmatter
from core import validator
from core import index_ops
from core.slug import generate_slug


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

# Derived from KNOWLEDGE_TYPES — the subdirectory names under memory/
KNOWLEDGE_DIRS = [cfg['directory'] for cfg in KNOWLEDGE_TYPES.values()]

# Lifecycle status constants and thresholds
STATUS_TRUSTED = "trusted"
STATUS_PROBATIONARY = "probationary"
STATUS_SUNSET = "sunset"
THRESHOLD_TRUSTED = 40
THRESHOLD_PROBATIONARY = 10


def _get_entry_name(metadata: Dict[str, Any], fallback: str = "") -> str:
    """Extract display name from a knowledge entry's metadata."""
    return metadata.get("name", metadata.get("term", fallback))


def _build_promotion_data(
    entity_type: str, entity_name: str, context_samples: List[str]
) -> tuple:
    """Build knowledge_data dict for promoting a pending entity.

    Returns (entity_type, knowledge_data) — entity_type may be normalised
    to 'person' for unknown types.
    """
    knowledge_data: Dict[str, Any] = {"importance": 15, "source": "threshold-promoted"}
    context_str = "; ".join(context_samples[:3])

    if entity_type == "person":
        knowledge_data["name"] = entity_name
        knowledge_data["role"] = "Unknown"
        knowledge_data["context"] = context_str
    elif entity_type == "project":
        knowledge_data["name"] = entity_name
        knowledge_data["description"] = context_str
    elif entity_type == "glossary":
        knowledge_data["term"] = entity_name
        knowledge_data["definition"] = context_str
    else:
        knowledge_data["name"] = entity_name
        knowledge_data["role"] = "Unknown"
        entity_type = "person"

    return entity_type, knowledge_data


def _load_json_file(directory: str, filename: str, default: Dict[str, Any]) -> Dict[str, Any]:
    """Load a JSON file from the memory directory, returning *default* if missing."""
    path = Path(directory) / "memory" / filename
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default.copy()


def _save_json_file(directory: str, filename: str, data: Dict[str, Any]) -> None:
    """Write a JSON file into the memory directory."""
    path = Path(directory) / "memory" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


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
    slug = generate_slug(name_value)
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
        >= THRESHOLD_TRUSTED (40): trusted
        >= THRESHOLD_PROBATIONARY (10): probationary
        < THRESHOLD_PROBATIONARY: sunset

    Args:
        importance: Current importance score (0-100)

    Returns:
        Lifecycle status string
    """
    if importance >= THRESHOLD_TRUSTED:
        return STATUS_TRUSTED
    elif importance >= THRESHOLD_PROBATIONARY:
        return STATUS_PROBATIONARY
    else:
        return STATUS_SUNSET


def compute_decay(importance: int, last_recalled) -> int:
    """Compute decayed importance score based on inactivity period.

    Stepped decay thresholds (cumulative penalty):
        0-30 days:    0 (grace period)
        31-60 days:  -10
        61-90 days:  -25
        91-180 days: -45
        181+ days:   -70
    """
    if isinstance(last_recalled, str):
        last_recalled = date.fromisoformat(last_recalled)

    days_inactive = (date.today() - last_recalled).days
    decay = 0

    if days_inactive >= 181:
        decay = 70
    elif days_inactive >= 91:
        decay = 45
    elif days_inactive >= 61:
        decay = 25
    elif days_inactive >= 31:
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
    base_path = Path(directory)
    entries_scanned = 0
    entries_decayed = 0
    transitions = []
    all_entries = []

    for subdir in KNOWLEDGE_DIRS:
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
            old_status = metadata.get("lifecycle_status", STATUS_TRUSTED)

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
                        "name": _get_entry_name(metadata),
                        "from": old_status,
                        "to": new_status,
                        "score": new_score
                    })

            all_entries.append({
                "filepath": str(md_file.relative_to(base_path)),
                "metadata": metadata,
            })

    # Periodic cleanup: remove stale boost tracker entries
    today = date.today().isoformat()
    tracker = _load_boost_tracker(directory)
    if tracker:
        cleaned = {}
        for fk, entry in tracker.items():
            if isinstance(entry, dict):
                kept = {k: v for k, v in entry.items() if k == today}
                if kept:
                    cleaned[fk] = kept
        if len(cleaned) != len(tracker):
            _save_boost_tracker(directory, cleaned)

    update_telemetry_snapshot(directory, entries=all_entries)

    return {
        "entries_scanned": entries_scanned,
        "entries_decayed": entries_decayed,
        "transitions": transitions,
        "all_entries": all_entries
    }


# =============================================================================
# Harvesting Pipeline
# =============================================================================

def _load_pending(directory: str) -> Dict[str, Any]:
    """Load pending.json, creating if needed."""
    return _load_json_file(directory, "pending.json", {"entities": {}})


def _save_pending(directory: str, pending: Dict[str, Any]) -> None:
    """Save pending.json."""
    _save_json_file(directory, "pending.json", pending)


def _fuzzy_match_entry(entity_name: str, directory: str) -> Optional[Dict[str, Any]]:
    """Fuzzy match entity_name against existing knowledge entries.

    Returns dict with 'filepath' and 'metadata' if match found, None otherwise.
    Case-insensitive exact match on name/term fields.
    """
    base_path = Path(directory)
    name_lower = entity_name.lower().strip()

    for subdir in KNOWLEDGE_DIRS:
        dir_path = base_path / "memory" / subdir
        if not dir_path.exists():
            continue
        for md_file in dir_path.glob("*.md"):
            content = md_file.read_text()
            metadata, body = frontmatter.parse(content)
            entry_name = _get_entry_name(metadata).lower().strip()
            if entry_name == name_lower:
                rel_path = str(md_file.relative_to(base_path))
                return {"filepath": rel_path, "metadata": metadata}

    return None


def harvest_signal(
    entity_name: str,
    source_plugin: str,
    entity_type: str,
    context: str,
    directory: str = "."
) -> Dict[str, Any]:
    """Process a memory signal from a plugin.

    1. Fuzzy-match against existing entries -> reinforce (boost)
    2. No match -> track in pending.json
    3. If pending threshold crossed (3 mentions, 2+ plugins) -> auto-promote

    Returns dict with action: 'reinforced', 'tracked', or 'promoted'
    """
    # Try instant track: reinforce existing entry
    match = _fuzzy_match_entry(entity_name, directory)
    if match:
        boost_result = boost_entry(match["filepath"], directory)
        return {
            "action": "reinforced",
            "filepath": match["filepath"],
            "boosted": boost_result.get("boosted", False),
            "score": boost_result.get("score")
        }

    # Threshold track: add to pending
    pending = _load_pending(directory)
    slug = generate_slug(entity_name)

    if slug not in pending["entities"]:
        pending["entities"][slug] = {
            "name": entity_name,
            "entity_type": entity_type,
            "mentions": 0,
            "first_seen": date.today().isoformat(),
            "last_seen": date.today().isoformat(),
            "sources": [],
            "context_samples": []
        }

    entry = pending["entities"][slug]
    entry["mentions"] += 1
    entry["last_seen"] = date.today().isoformat()
    if source_plugin not in entry["sources"]:
        entry["sources"].append(source_plugin)
    if len(entry["context_samples"]) < 5:
        entry["context_samples"].append(context)

    # Check promotion threshold: 3+ mentions from 2+ plugins
    if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
        entity_type, knowledge_data = _build_promotion_data(
            entity_type, entity_name, entry["context_samples"]
        )
        create_knowledge_entry(entity_type, knowledge_data, directory)
        del pending["entities"][slug]
        _save_pending(directory, pending)

        return {
            "action": "promoted",
            "entity": entity_name,
            "starting_score": 15,
            "type": entity_type
        }

    _save_pending(directory, pending)
    return {
        "action": "tracked",
        "entity": entity_name,
        "mentions": entry["mentions"],
        "sources": entry["sources"]
    }


def check_promotable(directory: str = ".") -> List[Dict[str, Any]]:
    """List pending entities that qualify for promotion (dry run).

    Returns a list of promotable entity dicts without side effects.
    """
    pending = _load_pending(directory)
    promotable = []
    for slug, entry in pending["entities"].items():
        if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
            promotable.append({"slug": slug, **entry})
    return promotable


def promote_pending_entities(directory: str = ".") -> Dict[str, Any]:
    """Promote all qualifying pending entities to knowledge entries.

    Scans pending.json for entities that meet the promotion threshold
    (3+ mentions from 2+ plugins) and creates knowledge entries for each.

    Args:
        directory: Base directory containing the memory folder

    Returns:
        Dict with:
            promoted: List of promoted entity dicts (name, type, slug)
            count: Number of entities promoted
    """
    pending = _load_pending(directory)
    promoted = []

    # Collect slugs to promote first, then mutate
    slugs_to_promote = []
    for slug, entry in pending["entities"].items():
        if entry["mentions"] >= 3 and len(entry["sources"]) >= 2:
            slugs_to_promote.append(slug)

    for slug in slugs_to_promote:
        entry = pending["entities"][slug]
        entity_type = entry.get("entity_type", "person")
        entity_name = entry["name"]

        entity_type, knowledge_data = _build_promotion_data(
            entity_type, entity_name, entry.get("context_samples", [])
        )
        create_knowledge_entry(entity_type, knowledge_data, directory)
        del pending["entities"][slug]

        promoted.append({
            "slug": slug,
            "name": entity_name,
            "type": entity_type,
            "starting_score": 15,
        })

    _save_pending(directory, pending)

    return {
        "promoted": promoted,
        "count": len(promoted),
    }


def _load_boost_tracker(directory: str) -> Dict[str, Any]:
    """Load the boost tracker from memory/.boost-tracker.json."""
    return _load_json_file(directory, ".boost-tracker.json", {})


def _save_boost_tracker(directory: str, data: Dict[str, Any]) -> None:
    """Write the boost tracker to memory/.boost-tracker.json."""
    _save_json_file(directory, ".boost-tracker.json", data)


def boost_entry(filepath: str, directory: str = ".", boost_amount: int = 5) -> Dict[str, Any]:
    """Boost a memory entry's importance score on recall.

    Args:
        filepath: Path to the memory entry (absolute or relative to directory)
        directory: Base directory
        boost_amount: Points to add (default 5)

    Returns:
        Dict with boosted (bool), reason (str if not boosted), score, status
    """
    base_path = Path(directory)
    full_path = base_path / filepath

    try:
        content = full_path.read_text()
    except FileNotFoundError:
        raise MemoryError(f"Entry not found: {filepath}")

    metadata, body = frontmatter.parse(content)

    today = date.today().isoformat()

    # Load boost tracker (tracks daily boost counts per file)
    tracker = _load_boost_tracker(directory)
    file_key = filepath
    file_tracker = tracker.get(file_key, {})
    recall_count_today = file_tracker.get(today, 0)

    # Check daily cap: max 2 boosts per day
    if recall_count_today >= 2:
        return {
            "boosted": False,
            "reason": "daily_cap",
            "score": metadata.get("importance", 45),
            "status": metadata.get("lifecycle_status", STATUS_TRUSTED)
        }

    importance = metadata.get("importance", 45)
    new_score = min(100, importance + boost_amount)
    new_status = derive_lifecycle_status(new_score)

    metadata["importance"] = new_score
    metadata["lifecycle_status"] = new_status
    metadata["last_recalled"] = today
    metadata["recall_count"] = metadata.get("recall_count", 0) + 1
    metadata["updated"] = today
    # Do NOT write _boosts_today to frontmatter — tracked externally

    # Strip _boosts_today from frontmatter if it was left over from old code
    metadata.pop("_boosts_today", None)

    updated_content = frontmatter.dumps(metadata, body)
    full_path.write_text(updated_content)

    # Update boost tracker for this file only (cleanup happens in run_decay)
    tracker[file_key] = {today: recall_count_today + 1}
    _save_boost_tracker(directory, tracker)

    return {
        "boosted": True,
        "score": new_score,
        "status": new_status
    }


# =============================================================================
# Triage System
# =============================================================================

def triage_report(directory: str = ".") -> Dict[str, Any]:
    """Generate triage report of entries needing attention.

    First runs decay to ensure scores are current.
    Then collects sunset entries and approaching-sunset entries (score 10-15)
    from the already-scanned entries (no redundant filesystem scan).

    Returns dict with 'sunset', 'approaching_sunset' lists and 'total' count.
    """
    # Run decay first — reuse its scanned entries
    decay_result = run_decay(directory)
    all_entries = decay_result["all_entries"]

    sunset = []
    approaching_sunset = []

    for entry in all_entries:
        metadata = entry["metadata"]
        filepath = entry["filepath"]

        importance = metadata.get("importance", 45)
        status = metadata.get("lifecycle_status", STATUS_TRUSTED)
        name = _get_entry_name(metadata, Path(filepath).stem)

        entry_info = {
            "name": name,
            "type": metadata.get("type", "unknown"),
            "importance": importance,
            "source": metadata.get("source", "frontmatter"),
            "last_recalled": metadata.get("last_recalled", "unknown"),
            "created": metadata.get("created", "unknown"),
            "filepath": filepath,
            "days_since_recall": None
        }

        last_recalled = metadata.get("last_recalled")
        if last_recalled:
            try:
                days = (date.today() - date.fromisoformat(last_recalled)).days
                entry_info["days_since_recall"] = days
            except (ValueError, TypeError):
                pass

        if status == STATUS_SUNSET or importance < THRESHOLD_PROBATIONARY:
            sunset.append(entry_info)
        elif importance <= 15 and status == STATUS_PROBATIONARY:
            approaching_sunset.append(entry_info)

    # Sort by importance ascending (most urgent first)
    sunset.sort(key=lambda x: x["importance"])
    approaching_sunset.sort(key=lambda x: x["importance"])

    return {
        "sunset": sunset,
        "approaching_sunset": approaching_sunset,
        "total": len(sunset) + len(approaching_sunset)
    }


def triage_keep(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Keep action: boost by 20 and reset last_recalled."""
    base_path = Path(directory)
    full_path = base_path / filepath

    try:
        content = full_path.read_text()
    except FileNotFoundError:
        raise MemoryError(f"Entry not found: {filepath}")
    metadata, body = frontmatter.parse(content)

    old_score = metadata.get("importance", 0)
    new_score = min(100, old_score + 20)
    new_status = derive_lifecycle_status(new_score)

    metadata["importance"] = new_score
    metadata["lifecycle_status"] = new_status
    metadata["last_recalled"] = date.today().isoformat()
    metadata["updated"] = date.today().isoformat()

    full_path.write_text(frontmatter.dumps(metadata, body))

    return {"action": "kept", "score": new_score, "status": new_status}


def triage_archive(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Archive action: move to archived dir, leave stub at original path."""
    base_path = Path(directory)
    full_path = base_path / filepath

    try:
        content = full_path.read_text()
    except FileNotFoundError:
        raise MemoryError(f"Entry not found: {filepath}")

    # Create archived directory
    archived_dir = base_path / "memory" / "archived"
    archived_dir.mkdir(parents=True, exist_ok=True)

    # Copy to archived
    archived_path = archived_dir / full_path.name
    archived_path.write_text(content)

    # Replace original with stub
    metadata, _ = frontmatter.parse(content)
    stub_metadata = {
        "name": _get_entry_name(metadata),
        "type": metadata.get("type", "unknown"),
        "status": "archived",
        "archived_date": date.today().isoformat(),
        "archived_to": str(archived_path.relative_to(base_path))
    }
    stub_body = f"\nThis entry was archived on {date.today().isoformat()}.\n"
    full_path.write_text(frontmatter.dumps(stub_metadata, stub_body))

    return {"action": "archived", "archived_to": str(archived_path.relative_to(base_path))}


def triage_delete(filepath: str, directory: str = ".") -> Dict[str, Any]:
    """Delete action: remove file entirely."""
    base_path = Path(directory)
    full_path = base_path / filepath

    name = full_path.stem
    try:
        full_path.unlink()
    except FileNotFoundError:
        raise MemoryError(f"Entry not found: {filepath}")

    return {"action": "deleted", "entry": name}


# =============================================================================
# Telemetry Collection
# =============================================================================

_TELEMETRY_DEFAULT: Dict[str, Any] = {
    "last_decay_run": None,
    "total_entries": 0,
    "by_status": {STATUS_TRUSTED: 0, STATUS_PROBATIONARY: 0, STATUS_SUNSET: 0},
    "by_source": {"manual": 0, "frontmatter": 0, "auto-matched": 0, "threshold-promoted": 0},
    "pending_count": 0,
    "triage_history": [],
    "promotions": {"total": 0, "avg_days_to_promote": 0},
    "archives": {"total": 0, "avg_lifespan_days": 0, "by_source": {}}
}


def _load_telemetry(directory: str) -> Dict[str, Any]:
    """Load telemetry.json, creating if needed."""
    return _load_json_file(directory, "telemetry.json", _TELEMETRY_DEFAULT)


def _save_telemetry(directory: str, telemetry: Dict[str, Any]) -> None:
    """Save telemetry.json."""
    _save_json_file(directory, "telemetry.json", telemetry)


def update_telemetry_snapshot(
    directory: str,
    entries: Optional[List[Dict[str, Any]]] = None
) -> None:
    """Update telemetry with current state of all entries.

    Args:
        directory: Base directory containing the memory folder
        entries: Pre-scanned entry list (each with 'metadata' dict).
                 When provided, avoids a redundant filesystem scan.
    """
    base_path = Path(directory)
    telemetry = _load_telemetry(directory)

    by_status = {STATUS_TRUSTED: 0, STATUS_PROBATIONARY: 0, STATUS_SUNSET: 0}
    by_source = {"manual": 0, "frontmatter": 0, "auto-matched": 0, "threshold-promoted": 0}
    total = 0

    if entries is not None:
        for entry in entries:
            metadata = entry["metadata"]
            if metadata.get("status") == "archived":
                continue
            total += 1
            status = metadata.get("lifecycle_status", STATUS_TRUSTED)
            source = metadata.get("source", "frontmatter")
            by_status[status] = by_status.get(status, 0) + 1
            by_source[source] = by_source.get(source, 0) + 1
    else:
        for subdir in KNOWLEDGE_DIRS:
            dir_path = base_path / "memory" / subdir
            if not dir_path.exists():
                continue
            for md_file in dir_path.glob("*.md"):
                content = md_file.read_text()
                metadata, _ = frontmatter.parse(content)
                if metadata.get("status") == "archived":
                    continue
                total += 1
                status = metadata.get("lifecycle_status", STATUS_TRUSTED)
                source = metadata.get("source", "frontmatter")
                by_status[status] = by_status.get(status, 0) + 1
                by_source[source] = by_source.get(source, 0) + 1

    telemetry["total_entries"] = total
    telemetry["by_status"] = by_status
    telemetry["by_source"] = by_source
    telemetry["last_decay_run"] = date.today().isoformat()

    pending = _load_pending(directory)
    telemetry["pending_count"] = len(pending.get("entities", {}))

    _save_telemetry(directory, telemetry)


def record_triage_action(action: str, directory: str) -> None:
    """Record a triage action to telemetry history."""
    telemetry = _load_telemetry(directory)

    today = date.today().isoformat()
    history = telemetry.get("triage_history", [])

    # Find or create today's entry
    today_entry = None
    for entry in history:
        if entry.get("date") == today:
            today_entry = entry
            break

    if not today_entry:
        today_entry = {"date": today, "reviewed": 0, "kept": 0, "merged": 0, "archived": 0, "deleted": 0}
        history.append(today_entry)

    today_entry["reviewed"] += 1
    if action in today_entry:
        today_entry[action] += 1

    telemetry["triage_history"] = history[-30:]  # Keep last 30 days
    _save_telemetry(directory, telemetry)
