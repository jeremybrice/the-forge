"""Transcript operations for forge-lib.

This module provides cleanup operations for Slack transcripts, specifically
optimized for JIRA bot channel output which contains significant noise.

The cleanup process applies 6 transformation rules to reduce transcript size
by 40-60% while preserving all ticket data and events.
"""

import re
import html
from pathlib import Path
from typing import Optional


class TranscriptError(Exception):
    """Raised when transcript operations fail."""
    pass


# Mapping from transcript type to filename segment
TRANSCRIPT_TYPE_FILENAME_MAP = {
    'public-channels': 'public-channels',
    'dms': 'dms',
    'jira-bot': 'jira-bot',
    'calendar': 'calendar',
    'inbox': 'inbox',
    'sent': 'sent',
    'folder': 'folder',
}


def generate_transcript_filename(directory: Path, scan_date: str, timeframe: str, transcript_type: str) -> str:
    """Generate sequential filename for a transcript file.

    Filenames follow the pattern: {scan_date}-{timeframe}-{type}-NNN.md
    Examples:
        2026-02-20-24h-public-channels-001.md
        2026-02-20-72h-jira-bot-001.md

    Args:
        directory: Transcript directory (slack-forge/transcripts/)
        scan_date: Date string in YYYY-MM-DD format
        timeframe: Scan timeframe label (24h, 72h, 1w, custom)
        transcript_type: One of 'public-channels', 'dms', 'jira-bot'

    Returns:
        Filename with .md extension

    Raises:
        TranscriptError: If transcript_type is invalid or filename generation fails
    """
    if transcript_type not in TRANSCRIPT_TYPE_FILENAME_MAP:
        raise TranscriptError(
            f"Invalid transcript_type: {transcript_type}. "
            f"Must be one of {list(TRANSCRIPT_TYPE_FILENAME_MAP.keys())}"
        )

    type_segment = TRANSCRIPT_TYPE_FILENAME_MAP[transcript_type]

    # Build regex to match existing files for this date+timeframe+type
    # Pattern: {scan_date}-{timeframe}-{type_segment}-NNN.md
    escaped_date = re.escape(scan_date)
    escaped_timeframe = re.escape(timeframe)
    escaped_segment = re.escape(type_segment)
    pattern = re.compile(
        r'^' + escaped_date + r'-' + escaped_timeframe + r'-' + escaped_segment + r'-(\d{3})\.md$'
    )

    max_num = 0
    if directory.exists():
        for entry in directory.iterdir():
            match = pattern.match(entry.name)
            if match:
                num = int(match.group(1))
                max_num = max(max_num, num)

    next_num = max_num + 1
    return f"{scan_date}-{timeframe}-{type_segment}-{next_num:03d}.md"


def _strip_url_tracking_params(text: str) -> str:
    """Strip tracking parameters from Jira URLs.

    Removes everything after the ticket key in Jira URLs.

    Example:
        Input:  https://365retailmarkets.atlassian.net/browse/VMS-14572?atlOrigin=...
        Output: https://365retailmarkets.atlassian.net/browse/VMS-14572

    Args:
        text: Input text potentially containing Jira URLs with tracking params

    Returns:
        Text with tracking params removed from Jira URLs
    """
    pattern = r'(https://365retailmarkets\.atlassian\.net/browse/[A-Z]+-\d+)\?[^\s)|]*'
    return re.sub(pattern, r'\1', text)


def _strip_image_urls(text: str) -> str:
    """Remove lines containing gravatar or CDN image URLs.

    These are Jira card rendering artifacts with no transcript value.

    Args:
        text: Input text potentially containing image URL lines

    Returns:
        Text with image URL lines removed
    """
    lines = text.split('\n')
    filtered = [
        line for line in lines
        if not re.search(r'https://secure\.gravatar\.com/avatar/', line)
        and not re.search(r'https://product-integrations-cdn\.atl-paas\.net/', line)
    ]
    return '\n'.join(filtered)


def _strip_slack_user_protocol(text: str) -> str:
    """Convert Slack user protocol links to plain @mentions.

    Example:
        Input:  <slack://user?team=T07PAS6KY&id=U07G34CNTH8|@Vasilij Orlov>
        Output: @Vasilij Orlov

    Args:
        text: Input text potentially containing Slack user protocol links

    Returns:
        Text with user protocol links converted to plain @mentions
    """
    pattern = r'<slack://user\?[^|]+\|(@[^>]+)>'
    return re.sub(pattern, r'\1', text)


def _strip_jira_metadata_lines(text: str) -> str:
    """Remove redundant JIRA metadata lines from created events.

    Removes lines matching:
    - Status: *...*
    - Type: *...*
    - Assignee: *...*
    - Priority: *...*
    - Bare priority words (Low, Medium, High, Critical, Blocker)
    - Bare names appearing between metadata lines

    These are redundant because the action line already contains the key information.

    Args:
        text: Input text potentially containing JIRA metadata lines

    Returns:
        Text with metadata lines removed
    """
    lines = text.split('\n')
    filtered = []

    for line in lines:
        stripped = line.strip()

        # Skip metadata field lines
        if re.match(r'^(Status|Type|Assignee|Priority):\s+\*.*\*$', stripped):
            continue

        # Skip bare priority words
        if stripped in ['Low', 'Medium', 'High', 'Critical', 'Blocker']:
            continue

        # Skip lines that are just a person's name (between metadata)
        # Heuristic: capitalized words, less than 50 chars
        if re.match(r'^[A-Z][a-z]+(\s[A-Z][a-z]+)+$', stripped) and len(stripped) < 50:
            continue

        filtered.append(line)

    return '\n'.join(filtered)


def _clean_html_entities(text: str) -> str:
    """Decode HTML entities and remove Slack formatting markers.

    Converts:
    - &amp; → &
    - &gt; → >
    - &lt; → <
    - Removes >>> (Slack blockquote marker)

    Args:
        text: Input text potentially containing HTML entities

    Returns:
        Text with HTML entities decoded and blockquotes removed
    """
    # Decode HTML entities
    text = html.unescape(text)

    # Remove Slack blockquote markers
    text = text.replace('>>>', '')

    return text


def _normalize_jira_links(text: str) -> str:
    """Convert Slack-style Jira links to markdown format.

    Example:
        Input:  *<https://...atlassian.net/browse/VMS-123|VMS-123 Title>*
        Output: *VMS-123 Title (https://...atlassian.net/browse/VMS-123)*

    Args:
        text: Input text potentially containing Slack-style Jira links

    Returns:
        Text with Jira links normalized to markdown format
    """
    pattern = r'\*<(https://365retailmarkets\.atlassian\.net/browse/[^|]+)\|([^>]+)>\*'
    return re.sub(pattern, r'*\2 (\1)*', text)


def clean_jira_transcript(raw_text: str) -> str:
    """Apply all 6 cleanup rules sequentially to JIRA transcript.

    This is the main entry point for transcript cleanup. It applies the following
    transformations in order:
    1. Strip URL tracking parameters
    2. Strip image URLs (gravatar, CDN)
    3. Strip Slack user protocol links
    4. Strip JIRA metadata lines
    5. Clean HTML entities
    6. Normalize Jira link markdown

    If cleanup fails or produces invalid output (empty, larger than input, or
    removes >90% of content), returns the original raw text to preserve data.

    Args:
        raw_text: Raw JIRA bot transcript text from Slack MCP

    Returns:
        Cleaned transcript text (40-60% smaller) or original text if cleanup fails
    """
    try:
        # Apply all 6 rules in sequence
        text = raw_text
        text = _strip_url_tracking_params(text)
        text = _strip_image_urls(text)
        text = _strip_slack_user_protocol(text)
        text = _strip_jira_metadata_lines(text)
        text = _clean_html_entities(text)
        text = _normalize_jira_links(text)

        # Sanity checks - fall back to raw if cleanup failed
        if len(text) == 0:
            return raw_text

        if len(text) > len(raw_text):
            # Cleanup should reduce size, not increase it
            return raw_text

        if len(text) < len(raw_text) * 0.1:
            # Cleanup removed >90% of content - too aggressive
            return raw_text

        return text

    except Exception:
        # If anything goes wrong, preserve original data
        return raw_text
