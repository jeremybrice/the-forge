"""
Frontmatter parsing and writing utilities for forge-lib.

This module handles YAML frontmatter in markdown files, providing functions to:
- Parse frontmatter from markdown content
- Write frontmatter to markdown content
- Extract and combine frontmatter and body content
"""

import re
from typing import Dict, Any, Tuple, Optional
import yaml


class FrontmatterError(Exception):
    """Raised when frontmatter parsing or writing fails."""
    pass


def parse(content: str) -> Tuple[Dict[str, Any], str]:
    """
    Parse YAML frontmatter from markdown content.

    Args:
        content: Markdown content with frontmatter (delimited by --- markers)

    Returns:
        Tuple of (frontmatter_dict, body_content)

    Raises:
        FrontmatterError: If frontmatter is malformed or invalid YAML

    Examples:
        >>> content = '---\\ntitle: Test\\n---\\n\\nBody content'
        >>> fm, body = parse(content)
        >>> fm['title']
        'Test'
        >>> body
        '\\nBody content'
    """
    # Match frontmatter pattern: starts with ---, yaml content, ends with ---
    pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
    match = re.match(pattern, content, re.DOTALL)

    if not match:
        # No frontmatter found - return empty dict and full content as body
        return {}, content

    frontmatter_str = match.group(1)
    body = match.group(2)

    try:
        frontmatter = yaml.safe_load(frontmatter_str)
        if frontmatter is None:
            frontmatter = {}
        if not isinstance(frontmatter, dict):
            raise FrontmatterError("Frontmatter must be a YAML dictionary")
        return frontmatter, body
    except yaml.YAMLError as e:
        raise FrontmatterError(f"Invalid YAML in frontmatter: {e}")


def dumps(frontmatter: Dict[str, Any], body: str = "") -> str:
    """
    Serialize frontmatter and body into markdown format.

    Args:
        frontmatter: Dictionary of frontmatter data
        body: Markdown body content (optional)

    Returns:
        Complete markdown string with frontmatter and body

    Examples:
        >>> fm = {'title': 'Test', 'type': 'initiative'}
        >>> dumps(fm, 'Body content')
        '---\\ntitle: Test\\ntype: initiative\\n---\\n\\nBody content'
    """
    # Serialize frontmatter to YAML
    yaml_str = yaml.dump(
        frontmatter,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False
    )

    # Combine with delimiters and body
    if body:
        return f"---\n{yaml_str}---\n\n{body}"
    else:
        return f"---\n{yaml_str}---\n"


def update(content: str, updates: Dict[str, Any]) -> str:
    """
    Update frontmatter fields in existing markdown content.

    Args:
        content: Original markdown content with frontmatter
        updates: Dictionary of fields to update

    Returns:
        Updated markdown content

    Raises:
        FrontmatterError: If content has invalid frontmatter

    Examples:
        >>> content = '---\\ntitle: Old\\n---\\n\\nBody'
        >>> update(content, {'title': 'New', 'status': 'Active'})
        '---\\ntitle: New\\nstatus: Active\\n---\\n\\nBody'
    """
    frontmatter, body = parse(content)
    frontmatter.update(updates)
    return dumps(frontmatter, body)


def extract_frontmatter(content: str) -> Dict[str, Any]:
    """
    Extract only the frontmatter from markdown content.

    Args:
        content: Markdown content with frontmatter

    Returns:
        Frontmatter dictionary

    Raises:
        FrontmatterError: If content has invalid frontmatter
    """
    frontmatter, _ = parse(content)
    return frontmatter


def extract_body(content: str) -> str:
    """
    Extract only the body content from markdown (without frontmatter).

    Args:
        content: Markdown content with frontmatter

    Returns:
        Body content string
    """
    _, body = parse(content)
    return body
