"""Tests for transcript cleanup and filename operations."""

import pytest
import re
from pathlib import Path
from core.transcript_ops import (
    clean_jira_transcript,
    generate_transcript_filename,
    TranscriptError,
    _strip_url_tracking_params,
    _strip_image_urls,
    _strip_slack_user_protocol,
    _strip_jira_metadata_lines,
    _clean_html_entities,
    _normalize_jira_links,
)


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


# ======================================================================
# Transcript Filename Generation
# ======================================================================

def test_generate_transcript_filename_first_file(tmp_path):
    """First transcript for a date+timeframe+type gets -001"""
    result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'public-channels')
    assert result == '2026-02-20-24h-public-channels-001.md'


def test_generate_transcript_filename_sequential(tmp_path):
    """Second transcript increments to -002"""
    (tmp_path / '2026-02-20-24h-public-channels-001.md').touch()
    result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'public-channels')
    assert result == '2026-02-20-24h-public-channels-002.md'


def test_generate_transcript_filename_gap_fills_max(tmp_path):
    """Sequence number uses max existing, not count"""
    (tmp_path / '2026-02-20-24h-public-channels-001.md').touch()
    (tmp_path / '2026-02-20-24h-public-channels-003.md').touch()
    result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'public-channels')
    assert result == '2026-02-20-24h-public-channels-004.md'


def test_generate_transcript_filename_different_types_independent(tmp_path):
    """Different transcript types have independent sequences"""
    (tmp_path / '2026-02-20-24h-public-channels-001.md').touch()
    result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'jira-bot')
    assert result == '2026-02-20-24h-jira-bot-001.md'


def test_generate_transcript_filename_different_dates_independent(tmp_path):
    """Different dates have independent sequences"""
    (tmp_path / '2026-02-19-24h-public-channels-001.md').touch()
    result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'public-channels')
    assert result == '2026-02-20-24h-public-channels-001.md'


def test_generate_transcript_filename_different_timeframes_independent(tmp_path):
    """Different timeframes have independent sequences"""
    (tmp_path / '2026-02-20-24h-public-channels-001.md').touch()
    result = generate_transcript_filename(tmp_path, '2026-02-20', '72h', 'public-channels')
    assert result == '2026-02-20-72h-public-channels-001.md'


def test_generate_transcript_filename_all_types(tmp_path):
    """All three transcript types produce valid filenames"""
    for ttype in ['public-channels', 'dms', 'jira-bot']:
        result = generate_transcript_filename(tmp_path, '2026-02-20', '24h', ttype)
        assert result == f'2026-02-20-24h-{ttype}-001.md'


def test_generate_transcript_filename_invalid_type(tmp_path):
    """Invalid transcript type raises TranscriptError"""
    with pytest.raises(TranscriptError, match="Invalid transcript_type"):
        generate_transcript_filename(tmp_path, '2026-02-20', '24h', 'invalid')


def test_generate_transcript_filename_nonexistent_directory():
    """Non-existent directory returns -001 (no existing files)"""
    result = generate_transcript_filename(Path('/tmp/nonexistent-dir-abc123'), '2026-02-20', '24h', 'dms')
    assert result == '2026-02-20-24h-dms-001.md'
