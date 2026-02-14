"""
Unit tests for core/slug.py
"""

import os
import tempfile
import shutil
from datetime import date
from pathlib import Path

import pytest

from core.slug import (
    generate_slug,
    get_next_sequential_number,
    generate_story_filename,
    generate_task_filename,
    generate_checkpoint_filename,
    generate_release_notes_filename,
    generate_initiative_filename,
    generate_epic_filename,
    generate_decision_filename,
    generate_intake_filename,
    SlugError,
)


class TestGenerateSlug:
    """Test slug generation from text."""

    def test_simple_slug(self):
        """Test basic slug generation."""
        assert generate_slug("Review API spec") == "review-api-spec"

    def test_special_characters_removed(self):
        """Test that special characters are removed."""
        assert generate_slug("Send PSR to Todd (Phoenix)") == "send-psr-to-todd-phoenix"
        assert generate_slug("Update JIRA & sync w/ team!!!") == "update-jira-sync-w-team"

    def test_consecutive_hyphens_collapsed(self):
        """Test that consecutive hyphens are collapsed."""
        assert generate_slug("foo   bar") == "foo-bar"
        assert generate_slug("foo---bar") == "foo-bar"

    def test_leading_trailing_hyphens_trimmed(self):
        """Test that leading and trailing hyphens are removed."""
        assert generate_slug("  foo bar  ") == "foo-bar"
        assert generate_slug("---foo---") == "foo"

    def test_max_length_truncation(self):
        """Test that slug is truncated to max_length."""
        long_text = "a" * 100
        slug = generate_slug(long_text, max_length=50)
        assert len(slug) == 50

    def test_max_length_truncation_no_trailing_hyphen(self):
        """Test that truncation doesn't leave trailing hyphen."""
        text = "word " * 20  # Creates many hyphens
        slug = generate_slug(text, max_length=30)
        assert not slug.endswith('-')
        assert len(slug) <= 30

    def test_custom_max_length(self):
        """Test custom max_length parameter."""
        text = "a very long title that should be truncated"
        slug = generate_slug(text, max_length=20)
        assert len(slug) <= 20

    def test_empty_text_raises_error(self):
        """Test that empty text raises SlugError."""
        with pytest.raises(SlugError, match="Cannot generate slug from empty text"):
            generate_slug("")

    def test_whitespace_only_raises_error(self):
        """Test that whitespace-only text raises SlugError."""
        with pytest.raises(SlugError, match="Cannot generate slug from empty text"):
            generate_slug("   ")

    def test_special_characters_only_raises_error(self):
        """Test that text with only special characters raises SlugError."""
        with pytest.raises(SlugError, match="Generated slug is empty"):
            generate_slug("@@@###$$$")

    def test_lowercase_conversion(self):
        """Test that uppercase is converted to lowercase."""
        assert generate_slug("UPPERCASE TITLE") == "uppercase-title"
        assert generate_slug("MiXeD CaSe") == "mixed-case"

    def test_numbers_preserved(self):
        """Test that numbers are preserved in slug."""
        assert generate_slug("Story 001 Title") == "story-001-title"
        assert generate_slug("Release v2.1.3") == "release-v213"

    def test_real_world_examples(self):
        """Test real-world title examples from Forge."""
        assert generate_slug("Build notification template builder") == "build-notification-template-builder"
        assert generate_slug("Email Notification Engine") == "email-notification-engine"
        assert generate_slug("Notification System Overhaul") == "notification-system-overhaul"


class TestGetNextSequentialNumber:
    """Test sequential number generation."""

    def setup_method(self):
        """Create temporary directory for tests."""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_empty_directory_returns_001(self):
        """Test that empty directory returns '001'."""
        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "001"

    def test_increments_from_existing_files(self):
        """Test that number increments from existing files."""
        # Create some story files
        Path(self.temp_dir, "story-001-first.md").touch()
        Path(self.temp_dir, "story-002-second.md").touch()
        Path(self.temp_dir, "story-003-third.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "004"

    def test_finds_highest_number(self):
        """Test that it finds the highest existing number."""
        Path(self.temp_dir, "story-001-first.md").touch()
        Path(self.temp_dir, "story-005-middle.md").touch()
        Path(self.temp_dir, "story-003-earlier.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "006"

    def test_ignores_different_prefix(self):
        """Test that it ignores files with different prefix."""
        Path(self.temp_dir, "task-001-first.md").touch()
        Path(self.temp_dir, "task-002-second.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "001"

    def test_ignores_non_matching_files(self):
        """Test that it ignores files that don't match the pattern."""
        Path(self.temp_dir, "story-001-first.md").touch()
        Path(self.temp_dir, "story-not-a-number.md").touch()
        Path(self.temp_dir, "random-file.txt").touch()
        Path(self.temp_dir, "story-002-second.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "003"

    def test_zero_padding(self):
        """Test that number is zero-padded to 3 digits."""
        Path(self.temp_dir, "story-001-first.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "002"
        assert len(number) == 3

    def test_handles_large_numbers(self):
        """Test that it handles large numbers correctly."""
        Path(self.temp_dir, "story-099-before-hundred.md").touch()

        number = get_next_sequential_number(self.temp_dir, "story")
        assert number == "100"

    def test_nonexistent_directory_raises_error(self):
        """Test that nonexistent directory raises SlugError."""
        with pytest.raises(SlugError, match="Directory does not exist"):
            get_next_sequential_number("/nonexistent/path", "story")

    def test_file_path_raises_error(self):
        """Test that passing a file path raises SlugError."""
        file_path = Path(self.temp_dir, "file.txt")
        file_path.touch()

        with pytest.raises(SlugError, match="Path is not a directory"):
            get_next_sequential_number(str(file_path), "story")


class TestStoryFilename:
    """Test story filename generation."""

    def setup_method(self):
        """Create temporary directory for tests."""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_generates_story_filename(self):
        """Test story filename generation."""
        filename = generate_story_filename("Build notification template", self.temp_dir)
        assert filename == "story-001-build-notification-template.md"

    def test_increments_story_number(self):
        """Test that story number increments."""
        Path(self.temp_dir, "story-001-first.md").touch()
        Path(self.temp_dir, "story-002-second.md").touch()

        filename = generate_story_filename("Third Story", self.temp_dir)
        assert filename == "story-003-third-story.md"

    def test_empty_title_raises_error(self):
        """Test that empty title raises SlugError."""
        with pytest.raises(SlugError):
            generate_story_filename("", self.temp_dir)


class TestTaskFilename:
    """Test task filename generation."""

    def setup_method(self):
        """Create temporary directory for tests."""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_generates_task_filename(self):
        """Test task filename generation."""
        filename = generate_task_filename("Review API spec", self.temp_dir)
        assert filename == "task-001-review-api-spec.md"

    def test_increments_task_number(self):
        """Test that task number increments."""
        Path(self.temp_dir, "task-001-first.md").touch()

        filename = generate_task_filename("Second Task", self.temp_dir)
        assert filename == "task-002-second-task.md"


class TestCheckpointFilename:
    """Test checkpoint filename generation."""

    def test_generates_checkpoint_filename_with_default_date(self):
        """Test checkpoint filename with today's date."""
        filename = generate_checkpoint_filename("Architecture Decisions")
        today = date.today().strftime('%Y-%m-%d')
        assert filename == f"checkpoint-{today}-architecture-decisions.md"

    def test_generates_checkpoint_filename_with_custom_date(self):
        """Test checkpoint filename with custom date."""
        custom_date = date(2026, 2, 8)
        filename = generate_checkpoint_filename("Notification Architecture", custom_date)
        assert filename == "checkpoint-2026-02-08-notification-architecture.md"

    def test_real_world_example(self):
        """Test real-world checkpoint filename."""
        custom_date = date(2026, 2, 8)
        filename = generate_checkpoint_filename(
            "Notification Architecture Decisions",
            custom_date
        )
        expected = "checkpoint-2026-02-08-notification-architecture-decisions.md"
        assert filename == expected


class TestReleaseNotesFilename:
    """Test release notes filename generation."""

    def test_generates_release_notes_with_default_date(self):
        """Test release notes with today's date."""
        filename = generate_release_notes_filename()
        today = date.today().strftime('%y%m%d')
        assert filename == f"release-notes-{today}.md"

    def test_generates_release_notes_with_custom_date(self):
        """Test release notes with custom date."""
        custom_date = date(2026, 2, 8)
        filename = generate_release_notes_filename(custom_date)
        assert filename == "release-notes-260208.md"

    def test_date_format_correct(self):
        """Test that date format is YYMMDD."""
        custom_date = date(2025, 12, 31)
        filename = generate_release_notes_filename(custom_date)
        assert filename == "release-notes-251231.md"


class TestInitiativeFilename:
    """Test initiative filename generation."""

    def test_generates_initiative_filename(self):
        """Test initiative filename generation."""
        filename = generate_initiative_filename("Notification System Overhaul")
        assert filename == "notification-system-overhaul.md"

    def test_empty_title_raises_error(self):
        """Test that empty title raises SlugError."""
        with pytest.raises(SlugError):
            generate_initiative_filename("")


class TestEpicFilename:
    """Test epic filename generation."""

    def test_generates_epic_filename(self):
        """Test epic filename generation."""
        filename = generate_epic_filename("Email Notification Engine")
        assert filename == "email-notification-engine.md"


class TestDecisionFilename:
    """Test decision filename generation."""

    def test_generates_decision_filename(self):
        """Test decision filename generation."""
        filename = generate_decision_filename("Use Event-Driven Notification Pipeline")
        assert filename == "use-event-driven-notification-pipeline.md"


class TestIntakeFilename:
    """Test intake filename generation."""

    def test_generates_intake_filename(self):
        """Test intake filename generation."""
        filename = generate_intake_filename("WebApp", "Notification System")
        assert filename == "intake-webapp-notification-system.md"

    def test_empty_product_raises_error(self):
        """Test that empty product raises SlugError."""
        with pytest.raises(SlugError):
            generate_intake_filename("", "Feature")

    def test_empty_feature_raises_error(self):
        """Test that empty feature raises SlugError."""
        with pytest.raises(SlugError):
            generate_intake_filename("Product", "")
