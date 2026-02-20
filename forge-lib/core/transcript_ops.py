"""Transcript operations for forge-lib.

This module provides cleanup operations for Slack transcripts, specifically
optimized for JIRA bot channel output which contains significant noise.

The cleanup process applies 6 transformation rules to reduce transcript size
by 40-60% while preserving all ticket data and events.
"""

import re
import html
from typing import Optional
