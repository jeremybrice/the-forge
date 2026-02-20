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
