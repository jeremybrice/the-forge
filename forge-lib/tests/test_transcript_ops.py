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
