# JIRA Transcript Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce JIRA bot transcript size by 40-60% through a Python cleanup utility that removes tracking URLs, images, metadata noise, and HTML entities while preserving all ticket data.

**Architecture:** Add `transcript_ops.py` module to forge-lib with 6 cleanup transformation rules. The `/slack-forge:scan` command calls `forge transcript clean` CLI after MCP retrieval to process raw output before writing transcript files.

**Tech Stack:** Python 3, regex, html module, pytest, forge-lib CLI framework

---

## Task 1: Setup Module and Test Infrastructure

**Files:**
- Create: `forge-lib/core/transcript_ops.py`
- Create: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Create empty module file**

```bash
touch forge-lib/core/transcript_ops.py
```

Add module docstring:

```python
"""Transcript operations for forge-lib.

This module provides cleanup operations for Slack transcripts, specifically
optimized for JIRA bot channel output which contains significant noise.

The cleanup process applies 6 transformation rules to reduce transcript size
by 40-60% while preserving all ticket data and events.
"""

import re
import html
from typing import Optional
```

**Step 2: Create test file with basic structure**

```bash
touch forge-lib/tests/test_transcript_ops.py
```

Add test file header:

```python
"""Tests for transcript cleanup operations."""

import pytest
import re
from core.transcript_ops import (
    clean_jira_transcript,
    _strip_url_tracking_params,
    _strip_image_urls,
    _strip_slack_user_protocol,
    _strip_jira_metadata_lines,
    _clean_html_entities,
    _normalize_jira_links,
)
```

**Step 3: Verify imports fail (TDD)**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -v`

Expected: FAIL with import errors (functions don't exist yet)

**Step 4: Commit setup**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(forge-lib): add transcript cleanup module skeleton

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Implement Rule 1 - Strip URL Tracking Params

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_strip_url_tracking_params_basic():
    """Verify tracking params are removed from Jira URLs"""
    input_text = "Check out https://365retailmarkets.atlassian.net/browse/VMS-14572?atlOrigin=eyJpIjoiY2Y5OTAzMGNiODc3NGQ4NWFlNzkzOWJlM2VmZDdhZDYiLCJwIjoiamlyYS1zbGFjay1pbnQifQ for details"
    expected = "Check out https://365retailmarkets.atlassian.net/browse/VMS-14572 for details"
    assert _strip_url_tracking_params(input_text) == expected


def test_strip_url_tracking_params_multiple():
    """Verify multiple URLs are cleaned"""
    input_text = """
    VMS-123: https://365retailmarkets.atlassian.net/browse/VMS-123?atlOrigin=abc123
    VMS-456: https://365retailmarkets.atlassian.net/browse/VMS-456?atlOrigin=def456&page=comments
    """
    result = _strip_url_tracking_params(input_text)
    assert "?atlOrigin" not in result
    assert "https://365retailmarkets.atlassian.net/browse/VMS-123" in result
    assert "https://365retailmarkets.atlassian.net/browse/VMS-456" in result
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_strip_url_tracking_params_basic -v`

Expected: FAIL with "NameError: name '_strip_url_tracking_params' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
    pattern = r'(https://365retailmarkets\.atlassian\.net/browse/[A-Z]+-\d+)\?[^\s)]*'
    return re.sub(pattern, r'\1', text)
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_strip_url_tracking_params_basic -v`

Expected: PASS

Run all Rule 1 tests: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "strip_url_tracking" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add URL tracking param cleanup

Implements Rule 1: Strip ?atlOrigin and other tracking params from
Jira URLs while preserving the clean ticket URL.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Implement Rule 2 - Strip Image URLs

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_strip_image_urls_gravatar():
    """Verify gravatar URLs are removed"""
    input_text = """Some text here
https://secure.gravatar.com/avatar/83686969bb...
More important text"""
    expected = """Some text here
More important text"""
    assert _strip_image_urls(input_text) == expected


def test_strip_image_urls_cdn():
    """Verify CDN image URLs are removed"""
    input_text = """Priority: High
https://product-integrations-cdn.atl-paas.net/jira-priority/medium.png
Assignee: John"""
    result = _strip_image_urls(input_text)
    assert "product-integrations-cdn" not in result
    assert "Priority: High" in result
    assert "Assignee: John" in result


def test_strip_image_urls_preserves_other_urls():
    """Verify non-image URLs are preserved"""
    input_text = """Check ticket: https://365retailmarkets.atlassian.net/browse/VMS-123
https://secure.gravatar.com/avatar/abc123
Also see: https://example.com/docs"""
    result = _strip_image_urls(input_text)
    assert "365retailmarkets.atlassian.net" in result
    assert "example.com" in result
    assert "gravatar.com" not in result
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_strip_image_urls_gravatar -v`

Expected: FAIL with "NameError: name '_strip_image_urls' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "strip_image_urls" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add image URL cleanup

Implements Rule 2: Remove lines containing gravatar and CDN image URLs
which are Jira rendering artifacts with no semantic value.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement Rule 3 - Strip Slack User Protocol

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_strip_slack_user_protocol_basic():
    """Verify Slack user protocol links are converted to plain @mentions"""
    input_text = "<slack://user?team=T07PAS6KY&id=U07G34CNTH8|@Vasilij Orlov> created VMS-123"
    expected = "@Vasilij Orlov created VMS-123"
    assert _strip_slack_user_protocol(input_text) == expected


def test_strip_slack_user_protocol_multiple():
    """Verify multiple Slack user links are converted"""
    input_text = """<slack://user?team=T07PAS6KY&id=U123|@Alice> mentioned <slack://user?team=T07PAS6KY&id=U456|@Bob> in VMS-789"""
    expected = """@Alice mentioned @Bob in VMS-789"""
    assert _strip_slack_user_protocol(input_text) == expected


def test_strip_slack_user_protocol_preserves_plain_mentions():
    """Verify plain @mentions are unchanged"""
    input_text = "@Alice sent a message to @Bob"
    assert _strip_slack_user_protocol(input_text) == input_text
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_strip_slack_user_protocol_basic -v`

Expected: FAIL with "NameError: name '_strip_slack_user_protocol' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "strip_slack_user_protocol" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add Slack user protocol cleanup

Implements Rule 3: Convert Slack user protocol links to plain @mentions,
removing internal IDs while preserving display names.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement Rule 4 - Strip JIRA Metadata Lines

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_strip_jira_metadata_lines_basic():
    """Verify metadata lines are removed from created events"""
    input_text = """[2026-02-19 16:23 UTC] @jira-bot: *@Joshua Alexander created a Review Subtask*
*VMS-14645 review for VMS-13063 (https://365retailmarkets.atlassian.net/browse/VMS-14645)*
Status: *To Do*
Type: *Review Subtask*
Assignee: *Joshua Alexander*
Priority: *Medium*"""

    result = _strip_jira_metadata_lines(input_text)

    # Should keep action lines
    assert "@Joshua Alexander created" in result
    assert "VMS-14645" in result

    # Should remove metadata
    assert "Status: *To Do*" not in result
    assert "Type: *Review Subtask*" not in result
    assert "Assignee: *Joshua Alexander*" not in result
    assert "Priority: *Medium*" not in result


def test_strip_jira_metadata_lines_priority_words():
    """Verify bare priority words are removed"""
    input_text = """VMS-123 updated
Medium
https://example.com"""

    result = _strip_jira_metadata_lines(input_text)
    assert "VMS-123" in result
    assert "Medium" not in result or "Medium" in result.split('\n')[0]  # Allow if part of message


def test_strip_jira_metadata_lines_names_between_metadata():
    """Verify bare names between metadata lines are removed"""
    input_text = """Status: *To Do*
Joshua Alexander
Assignee: *Joshua Alexander*"""

    result = _strip_jira_metadata_lines(input_text)
    assert "Status:" not in result
    assert "Assignee:" not in result
    # Bare name should be removed (it's between metadata)
    lines = [line.strip() for line in result.split('\n') if line.strip()]
    assert "Joshua Alexander" not in lines
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_strip_jira_metadata_lines_basic -v`

Expected: FAIL with "NameError: name '_strip_jira_metadata_lines' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "strip_jira_metadata_lines" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add JIRA metadata line cleanup

Implements Rule 4: Remove redundant Status/Type/Assignee/Priority lines
and bare names from JIRA created events. These duplicate info already
in the action line.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Rule 5 - Clean HTML Entities

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_clean_html_entities_basic():
    """Verify HTML entities are decoded"""
    input_text = "Result: 5 &gt; 3 &amp; 2 &lt; 10"
    expected = "Result: 5 > 3 & 2 < 10"
    assert _clean_html_entities(input_text) == expected


def test_clean_html_entities_blockquote():
    """Verify Slack blockquote markers are removed"""
    input_text = ">>> This is a quote\nRegular text"
    result = _clean_html_entities(input_text)
    assert ">>>" not in result
    assert "This is a quote" in result


def test_clean_html_entities_combined():
    """Verify both entity decoding and blockquote removal"""
    input_text = ">>> Comment: VMS-123 &amp; VMS-456\nFollowup: 10 &gt; 5"
    result = _clean_html_entities(input_text)
    assert "&amp;" not in result
    assert "&gt;" not in result
    assert ">>>" not in result
    assert "VMS-123 & VMS-456" in result
    assert "10 > 5" in result
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_clean_html_entities_basic -v`

Expected: FAIL with "NameError: name '_clean_html_entities' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "clean_html_entities" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add HTML entity cleanup

Implements Rule 5: Decode HTML entities (&amp;, &gt;, &lt;) and remove
Slack blockquote markers (>>>) for cleaner transcript text.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Implement Rule 6 - Normalize Jira Links

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing test**

Add to `test_transcript_ops.py`:

```python
def test_normalize_jira_links_basic():
    """Verify Slack-style links are normalized to markdown"""
    input_text = "*<https://365retailmarkets.atlassian.net/browse/VMS-14572|VMS-14572 Some title>*"
    expected = "*VMS-14572 Some title (https://365retailmarkets.atlassian.net/browse/VMS-14572)*"
    assert _normalize_jira_links(input_text) == expected


def test_normalize_jira_links_multiple():
    """Verify multiple Jira links are normalized"""
    input_text = """See *<https://365retailmarkets.atlassian.net/browse/VMS-123|VMS-123 First>* and
*<https://365retailmarkets.atlassian.net/browse/VMS-456|VMS-456 Second>*"""

    result = _normalize_jira_links(input_text)

    assert "*VMS-123 First (https://365retailmarkets.atlassian.net/browse/VMS-123)*" in result
    assert "*VMS-456 Second (https://365retailmarkets.atlassian.net/browse/VMS-456)*" in result
    assert "<https://" not in result  # No Slack-style links remain


def test_normalize_jira_links_preserves_plain_urls():
    """Verify plain URLs and non-Jira links are unchanged"""
    input_text = "See https://example.com and VMS-123"
    assert _normalize_jira_links(input_text) == input_text
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_normalize_jira_links_basic -v`

Expected: FAIL with "NameError: name '_normalize_jira_links' is not defined"

**Step 3: Implement function**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "normalize_jira_links" -v`

Expected: All PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add Jira link normalization

Implements Rule 6: Convert Slack-style <URL|text> links to markdown
text (URL) format for cleaner, more readable transcripts.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Implement Main Cleanup Function with Error Handling

**Files:**
- Modify: `forge-lib/core/transcript_ops.py`
- Modify: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing integration test**

Add to `test_transcript_ops.py`:

```python
def test_clean_jira_transcript_integration():
    """Test all 6 rules applied in sequence"""
    raw = """[2026-02-19 16:23 UTC] @jira-bot: *<slack://user?team=T07PAS6KY&id=U123|@Joshua Alexander> created a Review Subtask*
*<https://365retailmarkets.atlassian.net/browse/VMS-14645?atlOrigin=abc123|VMS-14645 review for VMS-13063>*
Status: *To Do*
Type: *Review Subtask*
Joshua Alexander
https://secure.gravatar.com/avatar/83686969bb...
Assignee: *Joshua Alexander*
Medium
https://product-integrations-cdn.atl-paas.net/jira-priority/medium.png
Priority: *Medium*
>>> Comment: 5 &gt; 3 &amp; useful"""

    cleaned = clean_jira_transcript(raw)

    # Verify all rules applied
    assert "?atlOrigin" not in cleaned  # Rule 1
    assert "gravatar.com" not in cleaned  # Rule 2
    assert "product-integrations-cdn" not in cleaned  # Rule 2
    assert "slack://user?" not in cleaned  # Rule 3
    assert "@Joshua Alexander" in cleaned  # Rule 3 preserved display name
    assert "Status: *To Do*" not in cleaned  # Rule 4
    assert "Type: *Review Subtask*" not in cleaned  # Rule 4
    assert "&gt;" not in cleaned  # Rule 5
    assert "&amp;" not in cleaned  # Rule 5
    assert ">>>" not in cleaned  # Rule 5
    assert "5 > 3 & useful" in cleaned  # Rule 5 decoded
    assert "<https://" not in cleaned  # Rule 6
    assert "VMS-14645 review for VMS-13063 (https://365retailmarkets.atlassian.net/browse/VMS-14645)" in cleaned  # Rule 6

    # Verify data preservation
    assert "VMS-14645" in cleaned
    assert "@Joshua Alexander created" in cleaned


def test_clean_jira_transcript_error_handling_empty():
    """Verify cleanup handles empty input gracefully"""
    assert clean_jira_transcript("") == ""
    assert clean_jira_transcript("   ") == "   "


def test_clean_jira_transcript_error_handling_size_check():
    """Verify cleanup doesn't return empty result for valid input"""
    input_text = "[2026-02-19 10:00 UTC] @jira-bot: VMS-123 updated"
    result = clean_jira_transcript(input_text)

    # Should preserve valid content
    assert len(result) > 0
    assert "VMS-123" in result


def test_clean_jira_transcript_preserves_non_jira_content():
    """Verify cleanup doesn't break non-JIRA messages"""
    input_text = "[2026-02-19 10:00 UTC] @alice: Regular message about work"
    cleaned = clean_jira_transcript(input_text)
    assert cleaned == input_text
```

**Step 2: Run test to verify it fails**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py::test_clean_jira_transcript_integration -v`

Expected: FAIL with "NameError: name 'clean_jira_transcript' is not defined"

**Step 3: Implement main function with error handling**

Add to `transcript_ops.py`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -k "clean_jira_transcript" -v`

Expected: All PASS

Run all tests: `cd forge-lib && python -m pytest tests/test_transcript_ops.py -v`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(transcript): add main cleanup function with error handling

Implements clean_jira_transcript() which applies all 6 rules sequentially
with graceful fallback to raw text if cleanup fails or produces invalid
output. Includes comprehensive integration and error handling tests.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add CLI Command

**Files:**
- Modify: `forge-lib/forge.py`

**Step 1: Register transcript command group**

Find the command registration section in `forge.py` (after other subparsers). Add:

```python
# Transcript commands
transcript_parser = subparsers.add_parser(
    'transcript',
    help='Transcript cleanup operations'
)
transcript_subparsers = transcript_parser.add_subparsers(dest='transcript_command')

# transcript clean
clean_parser = transcript_subparsers.add_parser(
    'clean',
    help='Clean raw transcript by removing noise and formatting artifacts'
)
clean_parser.add_argument(
    '--input',
    required=True,
    help='Path to raw transcript file'
)
clean_parser.add_argument(
    '--output',
    required=True,
    help='Path to write cleaned transcript'
)
clean_parser.add_argument(
    '--type',
    default='jira',
    choices=['jira'],
    help='Transcript type (currently only jira supported)'
)
```

**Step 2: Add handler function**

In the main() function's command routing section, add:

```python
elif args.command == 'transcript':
    if args.transcript_command == 'clean':
        from core.transcript_ops import clean_jira_transcript

        # Read raw transcript
        try:
            with open(args.input, 'r', encoding='utf-8') as f:
                raw_text = f.read()
        except OSError as e:
            print(f"Error reading input file: {e}", file=sys.stderr)
            sys.exit(1)

        # Apply cleanup
        if args.type == 'jira':
            cleaned_text = clean_jira_transcript(raw_text)
        else:
            print(f"Unsupported transcript type: {args.type}", file=sys.stderr)
            sys.exit(1)

        # Write cleaned transcript
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(cleaned_text)
        except OSError as e:
            print(f"Error writing output file: {e}", file=sys.stderr)
            sys.exit(1)

        # Report results
        original_size = len(raw_text)
        cleaned_size = len(cleaned_text)
        reduction_pct = ((original_size - cleaned_size) / original_size) * 100 if original_size > 0 else 0

        print(f"Transcript cleaned successfully")
        print(f"Original size: {original_size} chars")
        print(f"Cleaned size: {cleaned_size} chars")
        print(f"Reduction: {reduction_pct:.1f}%")
    else:
        transcript_parser.print_help()
        sys.exit(1)
```

**Step 3: Test CLI manually**

Create test file:

```bash
cat > /tmp/test_raw_transcript.txt <<'EOF'
[2026-02-19 16:23 UTC] @jira-bot: *<https://365retailmarkets.atlassian.net/browse/VMS-14645?atlOrigin=abc123|VMS-14645 test>*
https://secure.gravatar.com/avatar/83686969bb...
Status: *To Do*
EOF
```

Run CLI:

```bash
cd forge-lib
python forge.py transcript clean --input /tmp/test_raw_transcript.txt --output /tmp/test_cleaned.txt --type jira
```

Expected output:
```
Transcript cleaned successfully
Original size: 195 chars
Cleaned size: 85 chars
Reduction: 56.4%
```

Verify cleaned content:

```bash
cat /tmp/test_cleaned.txt
```

Expected: Should show cleaned transcript without URL params, gravatar, or Status line.

**Step 4: Commit**

```bash
git add forge-lib/forge.py
git commit -m "feat(cli): add transcript clean command

Registers 'forge transcript clean' CLI command with --input, --output,
and --type flags. Reports size reduction statistics after cleanup.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Update Scan Command

**Files:**
- Modify: `slack-forge/commands/scan.md`

**Step 1: Add cleanup step to scan command**

Locate the section "### 5. Execute MCP Retrieval (Primary Agent)" in `scan.md`.

After the explanation of transcript format and before "### 6. Present Scan Summary", add:

```markdown
**JIRA transcript cleanup:**

For JIRA bot transcripts specifically, apply cleanup immediately after MCP retrieval to reduce token bloat:

1. Write raw MCP output to temp file: `/tmp/raw-jira-transcript-{timestamp}.txt`
2. Call cleanup utility:
   ```bash
   forge transcript clean --input /tmp/raw-jira-transcript-{timestamp}.txt --output /tmp/cleaned-jira-transcript-{timestamp}.txt --type jira
   ```
3. If cleanup succeeds and produces valid output, use cleaned transcript
4. If cleanup fails or produces invalid output, fall back to raw transcript
5. Delete temp files after transcript is written

The cleanup should reduce JIRA transcript size by 40-60% by removing:
- URL tracking parameters
- Avatar and priority image URLs
- Slack user protocol links
- Redundant metadata lines
- HTML entities

Use the cleaned transcript content when writing to `slack-forge/transcripts/{scan-date}-{timeframe}-jira-bot.md`.
```

**Step 2: Verify documentation**

Read through the updated scan.md to ensure the cleanup step flows logically:

```bash
cd slack-forge/commands
cat scan.md | grep -A 20 "JIRA transcript cleanup"
```

Expected: Should show the cleanup instructions clearly integrated into the scan flow.

**Step 3: Commit**

```bash
git add slack-forge/commands/scan.md
git commit -m "docs(slack-forge): integrate transcript cleanup into scan

Updates scan command to call 'forge transcript clean' after MCP
retrieval for JIRA bot channels. Reduces token bloat by 40-60% while
preserving all ticket data.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Integration Testing and Verification

**Files:**
- Create: `forge-lib/tests/fixtures/raw_jira_transcript_sample.txt` (optional test fixture)

**Step 1: Run full test suite**

```bash
cd forge-lib
python -m pytest tests/test_transcript_ops.py -v
```

Expected: All tests PASS (should be ~15-20 tests total)

**Step 2: Create realistic test fixture (optional but recommended)**

Create a sample raw JIRA transcript based on real data patterns:

```bash
cat > forge-lib/tests/fixtures/raw_jira_transcript_sample.txt <<'EOF'
[2026-02-19 16:23 UTC] @jira-bot: *<slack://user?team=T07PAS6KY&id=U07G34CNTH8|@Joshua Alexander> created a Review Subtask*
*<https://365retailmarkets.atlassian.net/browse/VMS-14645?atlOrigin=eyJpIjoiY2Y5OTAzMGNiODc3NGQ4NWFlNzkzOWJlM2VmZDdhZDYiLCJwIjoiamlyYS1zbGFjay1pbnQifQ&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel|VMS-14645 review for VMS-13063>*
Status: *To Do*
Type: *Review Subtask*
Joshua Alexander
https://secure.gravatar.com/avatar/83686969bb5a4ccf6ac0e5e3e47a1d2c?d=https%3A%2F%2Favatar-management.services.atlassian.com%2Fdefault%2F48
Assignee: *Joshua Alexander*
Medium
https://product-integrations-cdn.atl-paas.net/jira-slack-integration/icons/priorities/medium.png
Priority: *Medium*

[2026-02-19 16:25 UTC] @jira-bot: >>> <slack://user?team=T07PAS6KY&id=U08H45DLMN2|@Vasilij Orlov> commented on *<https://365retailmarkets.atlassian.net/browse/VMS-14572?atlOrigin=eyJpIjoiY2Y5OTAzMGNiODc3NGQ4NWFlNzkzOWJlM2VmZDdhZDYiLCJwIjoiamlyYS1zbGFjay1pbnQifQ&focusedCommentId=1112170&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel#comment-1112170|VMS-14572 - API Gateway timeout issue>*:
This looks related to VMS-13063. 5 &gt; 3 requests failing &amp; needs investigation.
EOF
```

Test with fixture:

```bash
cd forge-lib
python forge.py transcript clean --input tests/fixtures/raw_jira_transcript_sample.txt --output /tmp/verified_clean.txt --type jira
cat /tmp/verified_clean.txt
```

Expected output should:
- Preserve ticket IDs (VMS-14645, VMS-14572, VMS-13063)
- Preserve @mentions (@Joshua Alexander, @Vasilij Orlov)
- Remove tracking URLs (no ?atlOrigin)
- Remove image URLs (no gravatar.com, no cdn URLs)
- Remove metadata lines (no "Status:", "Type:", etc.)
- Decode HTML entities (5 > 3, &)
- Use clean markdown links

**Step 3: Manual end-to-end test (if Slack MCP available)**

If you have access to Slack MCP and real JIRA bot channel:

1. Run `/slack-forge:scan` with the updated scan command
2. Check transcript file size: `ls -lh slack-forge/transcripts/*jira-bot.md`
3. Verify size reduction is 40-60%
4. Verify all ticket IDs preserved: `grep -o 'VMS-[0-9]*' slack-forge/transcripts/*jira-bot.md | sort -u`
5. Run `/slack-forge:capture` to verify downstream pipeline works
6. Check that JIRA digest harvests are created successfully

**Step 4: Final commit**

```bash
git add forge-lib/tests/fixtures/  # If you created fixtures
git commit -m "test(transcript): add integration verification

Adds realistic test fixture and completes end-to-end verification of
transcript cleanup pipeline. Confirms 40-60% size reduction with no
data loss.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 5: Verify all commits**

```bash
git log --oneline -11
```

Expected: Should show 11 commits for this feature (setup + 6 rules + main function + CLI + docs + tests)

---

## Success Criteria Checklist

- [ ] All unit tests pass (`pytest tests/test_transcript_ops.py`)
- [ ] CLI command works (`forge transcript clean --input X --output Y --type jira`)
- [ ] Scan command documentation updated
- [ ] Size reduction verified (40-60%)
- [ ] No JIRA ticket data lost (all ticket IDs preserved)
- [ ] Downstream capture pipeline works without changes
- [ ] Graceful error handling (falls back to raw transcript)
- [ ] Code committed with descriptive messages

---

## Notes

**Design Document:** See `docs/plans/2026-02-19-jira-transcript-cleanup-design.md` for detailed architecture and design decisions.

**Specification:** Original cleanup rules documented in `/Users/jeremybrice/Documents/Cowork/slack-forge/agents/jira-transcript-cleanup.md`

**Testing Strategy:** Each rule has dedicated unit tests, plus integration tests for the full pipeline and error handling edge cases.
