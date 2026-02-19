# JIRA Transcript Cleanup Design

**Date:** 2026-02-19
**Status:** Approved
**Owner:** slack-forge plugin

## Problem Statement

Raw Slack MCP output from the JIRA bot channel (#pl-jira-feed) contains significant noise that inflates transcript size:
- **Current state:** 50K+ characters for 100 messages
- **Noise sources:** URL tracking parameters, avatar URLs, priority images, Slack protocol links, redundant metadata, HTML entities
- **Impact:** Token overflow, slow processing, bloated conversation context

**Goal:** Reduce JIRA transcript size by 40-60% through deterministic cleanup while preserving all ticket data and events.

## Solution Overview

Add a Python cleanup utility to forge-lib that applies 6 transformation rules to raw JIRA bot transcripts. The `/slack-forge:scan` command calls this utility immediately after MCP retrieval, before writing the transcript file.

**Key principle:** Cleanup happens immediately after MCP retrieval to minimize token bloat in the primary agent's conversation context.

---

## Architecture

### System Integration

**New forge-lib module:** `forge-lib/core/transcript_ops.py`
- Contains `clean_jira_transcript(raw_text: str) -> str`
- Implements 6 cleanup rules from the specification
- Pure function: deterministic string transformation, no side effects

**New CLI command:** `forge transcript clean`
- Entry point in `forge-lib/forge.py`
- Flags: `--input <file>`, `--output <file>`, `--type jira`
- Reads raw transcript, applies cleanup, writes cleaned version
- Extensible for future transcript types (tasks, knowledge)

**Scan command integration:**

```
Before:
  MCP call → raw output → write transcript

After:
  MCP call → raw output → forge transcript clean → cleaned output → write transcript
```

The scan command discards raw bloated output after passing it to the Python cleanup utility.

---

## Components

### Files to Create

**1. `forge-lib/core/transcript_ops.py`**
- New module for transcript operations
- Primary function: `clean_jira_transcript(raw_text: str) -> str`
- Helper functions for each cleanup rule:
  - `_strip_url_tracking_params(text: str) -> str`
  - `_strip_image_urls(text: str) -> str`
  - `_strip_slack_user_protocol(text: str) -> str`
  - `_strip_jira_metadata_lines(text: str) -> str`
  - `_clean_html_entities(text: str) -> str`
  - `_normalize_jira_links(text: str) -> str`

**2. `forge-lib/tests/test_transcript_ops.py`**
- Unit tests for each cleanup rule
- Integration test with sample raw JIRA bot output
- Validates 40-60% size reduction target
- Verifies no data loss (all ticket IDs preserved)

### Files to Modify

**3. `forge-lib/forge.py`**
- Register new `transcript` command group
- Add `transcript clean` subcommand with argparse configuration

**4. `slack-forge/commands/scan.md`**
- Update step 5 "Execute MCP Retrieval" to include cleanup flow
- Add instruction to call `forge transcript clean` after MCP retrieval for JIRA transcripts
- Specify that raw output should be discarded after cleanup

### Files for Reference (no changes)

**5. `/Users/jeremybrice/Documents/Cowork/slack-forge/agents/jira-transcript-cleanup.md`**
- Source of truth for the 6 cleanup rules
- Used as specification during implementation

---

## Data Flow

### Scan Command Flow (with cleanup)

```
1. User runs /slack-forge:scan
   ↓
2. Scan command calls slack_read_channel for JIRA bot channel
   ↓
3. MCP returns raw output (50K+ characters)
   ↓
4. Scan immediately writes raw output to temp file
   ↓
5. Scan calls: forge transcript clean --input temp.txt --output cleaned.txt --type jira
   ↓
6. Python applies 6 cleanup rules sequentially
   ↓
7. Returns cleaned transcript (40-60% smaller)
   ↓
8. Scan formats cleaned output with frontmatter:
   ---
   scan_date: 2026-02-19
   timeframe: 72h
   generated: 2026-02-19T14:30:00Z
   ---

   ## #pl-jira-feed (C05E2QT2QAU)

   [cleaned messages here]
   ↓
9. Write to: slack-forge/transcripts/2026-02-19-72h-jira-bot.md
   ↓
10. Delete temp files, discard raw output from context
```

### Cleanup Processing Pipeline

Inside `clean_jira_transcript()`:

```
raw_text
  → strip_url_tracking_params()
  → strip_image_urls()
  → strip_slack_user_protocol()
  → strip_jira_metadata_lines()
  → clean_html_entities()
  → normalize_jira_links()
  → cleaned_text
```

Each transformation is applied in sequence, with output from one becoming input to the next.

### Critical Performance Detail

The raw MCP output exists in the conversation context only **briefly**:
- Received from MCP call
- Written to temp file
- Passed to Python (which runs in separate process)
- Temp file deleted
- Only cleaned output retained

This minimizes token bloat in the primary agent's context.

---

## Implementation Details

### The 6 Cleanup Rules (in order)

**Rule 1: Strip URL tracking parameters**

```python
# Pattern: https://365retailmarkets.atlassian.net/browse/TICKET-123?atlOrigin=...
# Result: https://365retailmarkets.atlassian.net/browse/TICKET-123

import re

def _strip_url_tracking_params(text: str) -> str:
    pattern = r'(https://365retailmarkets\.atlassian\.net/browse/[A-Z]+-\d+)\?[^\s)]*'
    return re.sub(pattern, r'\1', text)
```

**Rule 2: Strip image URLs**

```python
# Remove entire lines containing gravatar or CDN image URLs

def _strip_image_urls(text: str) -> str:
    lines = text.split('\n')
    filtered = [
        line for line in lines
        if not re.search(r'https://secure\.gravatar\.com/avatar/', line)
        and not re.search(r'https://product-integrations-cdn\.atl-paas\.net/', line)
    ]
    return '\n'.join(filtered)
```

**Rule 3: Strip Slack user protocol links**

```python
# <slack://user?team=T07PAS6KY&id=U07G34CNTH8|@Vasilij Orlov> → @Vasilij Orlov

def _strip_slack_user_protocol(text: str) -> str:
    pattern = r'<slack://user\?[^|]+\|(@[^>]+)>'
    return re.sub(pattern, r'\1', text)
```

**Rule 4: Strip JIRA metadata lines**

```python
# Remove Status:, Type:, Assignee:, Priority:, and bare name lines from created events

def _strip_jira_metadata_lines(text: str) -> str:
    lines = text.split('\n')
    filtered = []
    for line in lines:
        stripped = line.strip()
        # Skip metadata lines
        if re.match(r'^(Status|Type|Assignee|Priority):\s+\*.*\*$', stripped):
            continue
        # Skip bare priority words (Medium, High, Low, etc.)
        if stripped in ['Low', 'Medium', 'High', 'Critical', 'Blocker']:
            continue
        # Skip lines that are just a person's name (between metadata)
        # This is heuristic - skip if line is just words with capital letters
        if re.match(r'^[A-Z][a-z]+(\s[A-Z][a-z]+)+$', stripped) and len(stripped) < 50:
            continue
        filtered.append(line)
    return '\n'.join(filtered)
```

**Rule 5: Clean HTML entities**

```python
import html

def _clean_html_entities(text: str) -> str:
    # Convert &amp; → &, &gt; → >, &lt; → <
    text = html.unescape(text)
    # Remove Slack blockquote markers
    text = text.replace('>>>', '')
    return text
```

**Rule 6: Normalize Jira link markdown**

```python
# *<https://...atlassian.net/browse/VMS-123|VMS-123 Title>*
# → *VMS-123 Title (https://...atlassian.net/browse/VMS-123)*

def _normalize_jira_links(text: str) -> str:
    pattern = r'\*<(https://365retailmarkets\.atlassian\.net/browse/[^|]+)\|([^>]+)>\*'
    return re.sub(pattern, r'*\2 (\1)*', text)
```

### Main Function

```python
def clean_jira_transcript(raw_text: str) -> str:
    """Apply all 6 cleanup rules sequentially."""
    text = raw_text
    text = _strip_url_tracking_params(text)
    text = _strip_image_urls(text)
    text = _strip_slack_user_protocol(text)
    text = _strip_jira_metadata_lines(text)
    text = _clean_html_entities(text)
    text = _normalize_jira_links(text)
    return text
```

---

## Error Handling

### Failure Scenarios & Responses

**Scenario 1: Cleanup utility fails (Python exception)**
- **Response:** Scan command falls back to writing the raw transcript
- **User notification:** "Warning: Transcript cleanup failed. Writing raw transcript to preserve data."
- **Rationale:** Data preservation is more important than cleanup. Downstream agents can still process noisy transcripts.

**Scenario 2: Cleaned transcript is unexpectedly larger**
- **Response:** Compare sizes before/after cleanup. If cleaned >= raw, use raw.
- **User notification:** "Warning: Cleanup increased size. Using raw transcript."
- **Rationale:** Cleanup should always reduce size. If it doesn't, something went wrong.

**Scenario 3: Cleanup removes all content (over-aggressive filtering)**
- **Detection:** Check if cleaned output is empty or < 10% of original size
- **Response:** Fall back to raw transcript
- **User notification:** "Warning: Cleanup removed too much content. Using raw transcript."
- **Rationale:** Better to have noise than to lose all data.

**Scenario 4: Missing temp file or I/O error**
- **Response:** Skip cleanup, use raw output directly
- **User notification:** "Warning: Could not create temp file. Writing raw transcript."

### Implementation Strategy

```python
# In transcript_ops.py
def clean_jira_transcript(raw_text: str) -> str:
    """Apply cleanup rules. Returns raw text if cleanup fails."""
    try:
        cleaned = _apply_all_rules(raw_text)

        # Sanity checks
        if len(cleaned) == 0:
            return raw_text
        if len(cleaned) > len(raw_text):
            return raw_text
        if len(cleaned) < len(raw_text) * 0.1:  # Less than 10% of original
            return raw_text

        return cleaned
    except Exception:
        # Log error but don't raise - fall back to raw text
        return raw_text
```

**Philosophy:** Cleanup is an optimization, not a requirement. If it fails, gracefully degrade to the original behavior (raw transcripts). The capture pipeline must work with both cleaned and raw transcripts.

---

## Testing Strategy

### Unit Tests (test_transcript_ops.py)

**Test each cleanup rule independently:**

```python
def test_strip_url_tracking_params():
    """Verify tracking params are removed from Jira URLs"""
    input_text = "https://365retailmarkets.atlassian.net/browse/VMS-14572?atlOrigin=eyJp..."
    expected = "https://365retailmarkets.atlassian.net/browse/VMS-14572"
    assert _strip_url_tracking_params(input_text) == expected

def test_strip_image_urls():
    """Verify gravatar and CDN image lines are removed"""
    input_text = "Some text\nhttps://secure.gravatar.com/avatar/abc123\nMore text"
    expected = "Some text\nMore text"
    assert _strip_image_urls(input_text) == expected

# ... similar tests for rules 3-6
```

**Test full cleanup pipeline:**

```python
def test_clean_jira_transcript_integration():
    """Test all 6 rules applied in sequence"""
    # Use fixture file with real JIRA bot output sample
    with open('fixtures/raw_jira_transcript.txt') as f:
        raw = f.read()

    cleaned = clean_jira_transcript(raw)

    # Verify size reduction
    assert len(cleaned) < len(raw) * 0.6  # At least 40% reduction
    assert len(cleaned) > len(raw) * 0.4  # No more than 60% reduction

    # Verify no data loss - all ticket IDs still present
    ticket_ids_raw = re.findall(r'VMS-\d+', raw)
    ticket_ids_cleaned = re.findall(r'VMS-\d+', cleaned)
    assert set(ticket_ids_raw) == set(ticket_ids_cleaned)

    # Verify noise is gone
    assert 'atlOrigin=' not in cleaned
    assert 'gravatar.com' not in cleaned
    assert 'slack://user?' not in cleaned
```

**Test error handling:**

```python
def test_cleanup_handles_empty_input():
    """Verify cleanup doesn't crash on edge cases"""
    assert clean_jira_transcript("") == ""
    assert clean_jira_transcript("   ") == "   "

def test_cleanup_preserves_non_jira_content():
    """Verify cleanup doesn't break non-JIRA messages"""
    input_text = "[2026-02-19 10:00 UTC] @alice: Regular message"
    cleaned = clean_jira_transcript(input_text)
    assert cleaned == input_text
```

### Integration Testing

**Manual verification:**
1. Run `/slack-forge:scan` on JIRA channel with real data
2. Compare file sizes: `ls -lh slack-forge/transcripts/*jira-bot.md`
3. Manually inspect cleaned transcript - verify:
   - All JIRA tickets present
   - No tracking URLs
   - No image URLs
   - Clean formatting
4. Run `/slack-forge:capture` on cleaned transcript
5. Verify digest harvest records are created successfully

**Success Criteria:**
- ✅ Cleaned transcript is 40-60% smaller than raw
- ✅ No JIRA tickets or events lost
- ✅ Downstream capture pipeline works without changes
- ✅ Unit tests pass with 100% coverage of cleanup rules

---

## Next Steps

1. Invoke `writing-plans` skill to create implementation plan
2. Implement `forge-lib/core/transcript_ops.py`
3. Add unit tests in `forge-lib/tests/test_transcript_ops.py`
4. Register CLI command in `forge-lib/forge.py`
5. Update `slack-forge/commands/scan.md` with cleanup integration
6. Test end-to-end with real JIRA bot data
7. Verify size reduction and data preservation goals
