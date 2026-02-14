"""Report operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
report entities (executive-summary, technical-deep-dive, etc.).

Reports are markdown files with YAML frontmatter stored in reports/ directory.
Reports use date-based filenames: YYYY-MM-DD-slug.md
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import jinja2

from . import frontmatter, slug, validator, index_ops


class ReportError(Exception):
    """Raised when report operations fail."""
    pass


# Report types that are supported
REPORT_TYPES = [
    'executive-summary',
    'technical-deep-dive',
    'competitive-analysis',
    'architecture-review',
    'performance-analysis',
    'incident-postmortem',
    'quarterly-review',
    'feasibility-study'
]

# Status values
REPORT_STATUSES = ['Draft', 'In Review', 'Published', 'Archived']


def _normalize_dates(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize date objects to strings for validation.

    Args:
        data: Dictionary potentially containing date objects

    Returns:
        Dictionary with dates converted to strings
    """
    result = {}
    for key, value in data.items():
        if isinstance(value, (date, datetime)):
            result[key] = value.strftime("%Y-%m-%d")
        elif isinstance(value, list):
            result[key] = [
                item.strftime("%Y-%m-%d") if isinstance(item, (date, datetime)) else item
                for item in value
            ]
        else:
            result[key] = value
    return result


def _generate_report_filename(report_type: str, title: str, created_date: date, directory: Path) -> str:
    """Generate report filename with date-based pattern: YYYY-MM-DD-slug.md

    Args:
        report_type: Type of report
        title: Report title for slug generation
        created_date: Date for filename prefix
        directory: Directory where report will be created (for uniqueness check)

    Returns:
        Filename string in format: YYYY-MM-DD-slug.md

    Examples:
        "Q1 Performance Review" + 2024-03-15 → "2024-03-15-q1-performance-review.md"
        "API Architecture Analysis" + 2024-03-15 → "2024-03-15-api-architecture-analysis.md"
    """
    # Generate base slug from title
    base_slug = slug.generate_slug(title)

    # Format date as YYYY-MM-DD
    date_prefix = created_date.strftime("%Y-%m-%d")

    # Combine date prefix and slug
    filename = f"{date_prefix}-{base_slug}.md"

    # Check for duplicates and add numeric suffix if needed
    final_filename = filename
    counter = 1
    while (directory / final_filename).exists():
        final_filename = f"{date_prefix}-{base_slug}-{counter}.md"
        counter += 1

    return final_filename


def report_init(directory: str = ".") -> Dict[str, Any]:
    """Initialize report directory structure.

    Creates:
    - reports/ directory
    - reports/index.json file

    Args:
        directory: Base directory where reports/ should be created

    Returns:
        dict: Result with success status and created paths

    Raises:
        ReportError: If initialization fails
    """
    try:
        base_path = Path(directory)
        reports_dir = base_path / 'reports'

        # Create reports directory
        reports_dir.mkdir(parents=True, exist_ok=True)

        # Index will be created automatically when first report is added
        index_path = reports_dir / 'index.json'

        return {
            'success': True,
            'reports_directory': str(reports_dir),
            'index_path': str(index_path)
        }
    except Exception as e:
        raise ReportError(f"Failed to initialize report directories: {e}")


def create_report(
    report_type: str,
    title: str,
    topic: str,
    directory: str = ".",
    status: str = "Draft",
    product: Optional[str] = None,
    module: Optional[str] = None,
    authors: Optional[List[str]] = None,
    agents: Optional[List[str]] = None,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a new report file.

    Args:
        report_type: Type of report (must be in REPORT_TYPES)
        title: Report title
        topic: Main topic or focus area
        directory: Base directory containing reports/
        status: Report status (default: Draft)
        product: Product from taxonomy (optional)
        module: Module from taxonomy (optional)
        authors: List of report authors (optional)
        agents: List of agents used to generate the report (optional)
        data: Optional additional frontmatter data

    Returns:
        dict: Created report data and file path

    Raises:
        ReportError: If report creation fails
    """
    try:
        # Validate report type
        if report_type not in REPORT_TYPES:
            raise ReportError(f"Invalid report_type: {report_type}. Must be one of {REPORT_TYPES}")

        # Validate status
        if status not in REPORT_STATUSES:
            raise ReportError(f"Invalid status: {status}. Must be one of {REPORT_STATUSES}")

        reports_dir = Path(directory) / 'reports'
        if not reports_dir.exists():
            raise ReportError(f"Reports directory not found: {reports_dir}. Run report_init first.")

        # Prepare frontmatter
        today = date.today()
        fm_data = {
            'title': title,
            'type': 'report',
            'report_type': report_type,
            'topic': topic,
            'status': status,
            'product': product,
            'module': module,
            'authors': authors or [],
            'agents': agents or [],
            'created': today,
            'updated': today
        }

        # Merge additional data if provided
        if data:
            fm_data.update(data)

        # Normalize dates before validation
        normalized_fm = _normalize_dates(fm_data)

        # Validate frontmatter
        try:
            validator.validate(normalized_fm, 'report')
        except validator.ValidationError as e:
            raise ReportError(f"Validation failed: {e}")

        # Generate filename with date-based naming
        filename = _generate_report_filename(report_type, title, today, reports_dir)
        file_path = reports_dir / filename

        # Load template
        templates_dir = Path(__file__).parent.parent / 'templates'
        env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(templates_dir)))
        template = env.get_template('report.md.j2')

        # Render template with normalized data
        content = template.render(**normalized_fm)

        # Write file
        file_path.write_text(content, encoding='utf-8')

        # Update index
        try:
            index_ops.create_index_entry(
                str(reports_dir),
                {
                    'file': filename,
                    **normalized_fm
                }
            )
        except index_ops.IndexError as e:
            raise ReportError(f"Failed to update index: {e}")

        return {
            'success': True,
            'report': normalized_fm,
            'file_path': f"reports/{filename}"
        }

    except ReportError:
        raise
    except Exception as e:
        raise ReportError(f"Failed to create report: {e}")


def get_report(file_path: str, directory: str = ".") -> Dict[str, Any]:
    """Get report data from a file.

    Args:
        file_path: Path to report file (relative to directory or absolute)
        directory: Base directory (default: current directory)

    Returns:
        dict: Report frontmatter data

    Raises:
        ReportError: If file not found or parsing fails
    """
    try:
        # Resolve path
        path = Path(directory) / file_path if not Path(file_path).is_absolute() else Path(file_path)

        if not path.exists():
            raise ReportError(f"Report not found: {file_path}")

        # Parse frontmatter
        content = path.read_text(encoding='utf-8')
        fm, _ = frontmatter.parse(content)

        if not fm:
            raise ReportError(f"No frontmatter found in {file_path}")

        return fm

    except ReportError:
        raise
    except Exception as e:
        raise ReportError(f"Failed to read report {file_path}: {e}")


def query_reports(
    directory: str = ".",
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    product: Optional[str] = None,
    created_after: Optional[str] = None,
    created_before: Optional[str] = None
) -> Dict[str, Any]:
    """Query reports using index.

    Args:
        directory: Base directory containing reports/
        report_type: Filter by report type (optional)
        status: Filter by status (optional)
        product: Filter by product (optional)
        created_after: Filter by created date >= YYYY-MM-DD (optional)
        created_before: Filter by created date <= YYYY-MM-DD (optional)

    Returns:
        dict: List of matching reports and count

    Raises:
        ReportError: If query fails
    """
    try:
        reports_dir = Path(directory) / 'reports'

        if not reports_dir.exists():
            raise ReportError(f"Reports directory not found: {reports_dir}")

        # Read index
        try:
            index_data = index_ops.read_index(str(reports_dir))
        except index_ops.IndexError as e:
            raise ReportError(f"Failed to read index: {e}")

        entries = index_data.get('entries', [])

        # Apply filters
        filtered = entries

        if report_type:
            filtered = [e for e in filtered if e.get('report_type') == report_type]

        if status:
            filtered = [e for e in filtered if e.get('status') == status]

        if product:
            filtered = [e for e in filtered if e.get('product') == product]

        if created_after:
            filtered = [e for e in filtered if e.get('created', '') >= created_after]

        if created_before:
            filtered = [e for e in filtered if e.get('created', '') <= created_before]

        return {
            'success': True,
            'reports': filtered,
            'count': len(filtered)
        }

    except ReportError:
        raise
    except Exception as e:
        raise ReportError(f"Failed to query reports: {e}")


def update_report(
    file_path: str,
    directory: str = ".",
    status: Optional[str] = None,
    product: Optional[str] = None,
    module: Optional[str] = None,
    authors: Optional[List[str]] = None,
    agents: Optional[List[str]] = None,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Update an existing report.

    Args:
        file_path: Path to report file (relative to directory)
        directory: Base directory
        status: New status (optional)
        product: New product (optional)
        module: New module (optional)
        authors: New authors list (optional)
        agents: New agents list (optional)
        data: Optional additional data to update

    Returns:
        dict: Updated report data

    Raises:
        ReportError: If update fails
    """
    try:
        # Resolve path
        path = Path(directory) / file_path if not Path(file_path).is_absolute() else Path(file_path)

        if not path.exists():
            raise ReportError(f"Report not found: {file_path}")

        # Read current frontmatter
        content = path.read_text(encoding='utf-8')
        fm, body = frontmatter.parse(content)

        if not fm:
            raise ReportError(f"No frontmatter found in {file_path}")

        # Update fields
        if status is not None:
            if status not in REPORT_STATUSES:
                raise ReportError(f"Invalid status: {status}. Must be one of {REPORT_STATUSES}")
            fm['status'] = status

        if product is not None:
            fm['product'] = product

        if module is not None:
            fm['module'] = module

        if authors is not None:
            fm['authors'] = authors

        if agents is not None:
            fm['agents'] = agents

        # Merge additional data
        if data:
            fm.update(data)

        # Update 'updated' date
        fm['updated'] = date.today()

        # Normalize dates before validation
        normalized_fm = _normalize_dates(fm)

        # Validate
        try:
            validator.validate(normalized_fm, 'report')
        except validator.ValidationError as e:
            raise ReportError(f"Validation failed: {e}")

        # Write updated file
        updated_content = frontmatter.dumps(normalized_fm, body)
        path.write_text(updated_content, encoding='utf-8')

        # Update index
        reports_dir = path.parent
        filename = path.name

        try:
            index_ops.update_index_entry(
                str(reports_dir),
                filename,
                {
                    'file': filename,
                    **normalized_fm
                }
            )
        except index_ops.IndexError as e:
            raise ReportError(f"Failed to update index: {e}")

        return {
            'success': True,
            'report': normalized_fm
        }

    except ReportError:
        raise
    except Exception as e:
        raise ReportError(f"Failed to update report: {e}")
