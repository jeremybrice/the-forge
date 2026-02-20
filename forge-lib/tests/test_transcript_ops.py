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
