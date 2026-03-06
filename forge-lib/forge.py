#!/usr/bin/env python3
"""
Forge CLI - Deterministic data layer for The Forge Marketplace

This CLI handles all file operations for the Forge ecosystem:
- Card operations (initiative, epic, story, intake, checkpoint, decision, release-note)
- Task operations
- Memory operations (taxonomy management)
- Session operations (debates, explorations)
- Report operations
- Index operations
- Relationship operations

The LLM layer delegates to this CLI for all data operations.
"""

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

# Import core modules
from core import card_ops, index_ops, relationship_ops, memory_ops, task_ops, session_ops, report_ops, agent_ops, harvest_ops, frontmatter
from core.validator import ValidationError
from core.card_ops import CardError
from core.index_ops import IndexError
from core.relationship_ops import RelationshipError
from core.memory_ops import MemoryError
from core.task_ops import TaskError
from core.session_ops import SessionError
from core.report_ops import ReportError
from core.agent_ops import AgentError
from core.harvest_ops import HarvestError

# Version info
__version__ = "2.2.0"

# Exit codes
EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_VALIDATION_ERROR = 2
EXIT_NOT_FOUND = 3


class ForgeError(Exception):
    """Base exception for Forge CLI errors"""
    pass


def output_json(data, success=True, error=None):
    """
    Output standardized JSON response

    Args:
        data: The data to output (dict or list)
        success: Whether the operation succeeded
        error: Error message if success=False
    """
    def _json_default(obj):
        if isinstance(obj, (date, datetime)):
            return obj.strftime("%Y-%m-%d")
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

    result = {
        "success": success,
        "data": data if success else None,
        "error": error if not success else None
    }
    print(json.dumps(result, indent=2, default=_json_default))


def handle_card_create(args):
    """Create a new card (initiative, epic, story, etc.)"""
    try:
        # Parse JSON data if provided
        data = {"title": args.title}
        if args.data:
            data.update(json.loads(args.data))

        # Add parent if specified
        if args.parent:
            data['parent'] = args.parent

        # Create the card
        result = card_ops.create_card(
            card_type=args.type,
            data=data,
            directory=args.directory
        )

        output_json(result)

    except ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except CardError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_card_get(args):
    """Get a card by filename"""
    try:
        result = card_ops.get_card(args.type, args.filename, directory=args.directory)
        output_json(result)
    except CardError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_card_query(args):
    """Query cards with filters"""
    try:
        # Build filters dictionary
        filters = {}
        if args.type:
            filters['type'] = args.type
        if args.status:
            filters['status'] = args.status
        if args.parent:
            filters['parent'] = args.parent
        if args.product:
            filters['product'] = args.product

        # Query cards
        results = card_ops.query_cards(filters=filters, directory=args.directory)
        output_json(results)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_card_update(args):
    """Update a card's frontmatter"""
    try:
        # Parse JSON data
        if not args.data:
            output_json(None, success=False, error="--data is required for updates")
            sys.exit(EXIT_ERROR)

        updates = json.loads(args.data)

        # Update the card
        result = card_ops.update_card(
            card_type=args.type,
            filename=args.filename,
            updates=updates,
            directory=args.directory
        )

        output_json(result)

    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except CardError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_task_init(args):
    """Initialize tasks directory structure"""
    try:
        result = task_ops.task_init(directory=args.directory)
        output_json(result, success=True)
    except TaskError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_task_create(args):
    """Create a new task"""
    try:
        # Parse JSON data if provided and preserve CLI title unless overridden in JSON
        if args.data:
            data = json.loads(args.data)
            if 'title' not in data:
                data['title'] = args.title
        else:
            data = {"title": args.title}

        result = task_ops.create_task(data, directory=args.directory)
        output_json(result, success=True)
    except (TaskError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_task_get(args):
    """Get a task by filename"""
    try:
        result = task_ops.get_task(args.filename, directory=args.directory)
        output_json(result, success=True)
    except TaskError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)


def handle_task_query(args):
    """Query tasks with filters"""
    try:
        # Build filters dict from command-line arguments
        filters = {}
        if args.status:
            filters['status'] = args.status
        if args.priority:
            filters['priority'] = args.priority

        result = task_ops.query_tasks(filters if filters else None, directory=args.directory)
        output_json({"tasks": result}, success=True)
    except TaskError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_task_update(args):
    """Update a task"""
    try:
        # Parse JSON updates
        updates = json.loads(args.data)

        result = task_ops.update_task(args.filename, updates, directory=args.directory)
        output_json(result, success=True)
    except (TaskError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_init(args):
    """Initialize memory directory structure"""
    try:
        result = memory_ops.init_memory(directory=args.directory)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_get_taxonomy(args):
    """Get taxonomy entries"""
    try:
        values = memory_ops.get_taxonomy(
            taxonomy_type=args.taxonomy_type,
            directory=args.directory
        )
        output_json({
            "taxonomy_type": args.taxonomy_type,
            "values": values
        }, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_set_taxonomy(args):
    """Set/update taxonomy entries"""
    try:
        # Determine operation based on flags
        if args.add:
            operation = "add"
            value = args.add
        elif args.remove:
            operation = "remove"
            value = args.remove
        else:
            output_json({
                "error": "Must specify either --add or --remove"
            }, success=False, error="Missing operation flag")
            sys.exit(EXIT_ERROR)

        result = memory_ops.set_taxonomy(
            taxonomy_type=args.taxonomy_type,
            value=value,
            operation=operation,
            directory=args.directory
        )
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_create_knowledge(args):
    """Create a new knowledge entry."""
    try:
        data = json.loads(args.data) if args.data else {}
        if args.name:
            name_field = 'term' if args.type == 'glossary' else 'name'
            data[name_field] = args.name
        result = memory_ops.create_knowledge_entry(args.type, data, directory=args.directory)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON in --data: {e}"}, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json({"error": f"Unexpected error: {e}"}, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_memory_query_knowledge(args):
    """Query knowledge entries."""
    try:
        filters = {}
        if args.type:
            filters['type'] = args.type
        results = memory_ops.query_knowledge(directory=args.directory, filters=filters)
        output_json(results, success=True)
    except Exception as e:
        output_json({"error": f"Unexpected error: {e}"}, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_memory_decay(args):
    """Handle memory decay command."""
    try:
        result = memory_ops.run_decay(directory=args.directory)
        result.pop("all_entries", None)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_harvest(args):
    """Handle memory harvest command."""
    try:
        result = memory_ops.harvest_signal(
            entity_name=args.entity,
            source_plugin=args.source,
            entity_type=args.type,
            context=args.context or "",
            directory=args.directory
        )
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_triage_report(args):
    """Handle memory triage-report command."""
    try:
        result = memory_ops.triage_report(directory=args.directory)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_promote(args):
    """Handle memory promote command.

    --check flag: list promotable entities without promoting (dry run).
    Without --check: actually promote qualifying entries.
    """
    try:
        if args.check:
            promotable = memory_ops.check_promotable(args.directory)
            output_json({"promotable": promotable, "count": len(promotable)}, success=True)
        else:
            result = memory_ops.promote_pending_entities(args.directory)
            output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def _handle_triage_action(action_fn, telemetry_label, args):
    """Generic handler for triage keep/archive/delete commands."""
    try:
        result = action_fn(filepath=args.filepath, directory=args.directory)
        memory_ops.record_triage_action(telemetry_label, args.directory)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_memory_triage_keep(args):
    """Handle memory triage-keep command."""
    _handle_triage_action(memory_ops.triage_keep, "kept", args)


def handle_memory_triage_archive(args):
    """Handle memory triage-archive command."""
    _handle_triage_action(memory_ops.triage_archive, "archived", args)


def handle_memory_triage_delete(args):
    """Handle memory triage-delete command."""
    _handle_triage_action(memory_ops.triage_delete, "deleted", args)


def handle_memory_boost(args):
    """Handle memory boost command."""
    try:
        result = memory_ops.boost_entry(filepath=args.filepath, directory=args.directory)
        output_json(result, success=True)
    except MemoryError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_session_init(args):
    """Initialize sessions directory structure"""
    try:
        result = session_ops.session_init(args.directory)
        output_json(result)
    except session_ops.SessionError as e:
        raise ForgeError(str(e))


def handle_session_create(args):
    """Create a new session (debate, exploration)"""
    try:
        # Build data dictionary
        data = {
            'title': args.title,
            'topic': args.topic,
        }

        # Parse optional JSON data
        if hasattr(args, 'data') and args.data:
            import json
            extra_data = json.loads(args.data)
            data.update(extra_data)

        # Add optional fields
        if hasattr(args, 'agents') and args.agents:
            data['agents'] = args.agents.split(',')
        if hasattr(args, 'status') and args.status:
            data['status'] = args.status

        result = session_ops.create_session(args.session_type, data, args.directory)
        output_json(result)
    except session_ops.SessionError as e:
        raise ForgeError(str(e))


def handle_session_get(args):
    """Get a single session by file path"""
    try:
        result = session_ops.get_session(args.file_path)
        output_json({'success': True, 'session': result})
    except session_ops.SessionError as e:
        raise ForgeError(str(e))


def handle_session_query(args):
    """Query sessions"""
    try:
        filters = {}
        if hasattr(args, 'session_type') and args.session_type:
            filters['session_type'] = args.session_type
        if hasattr(args, 'status') and args.status:
            filters['status'] = args.status
        if hasattr(args, 'agent') and args.agent:
            filters['agent'] = args.agent
        if hasattr(args, 'created_after') and args.created_after:
            filters['created_after'] = args.created_after
        if hasattr(args, 'created_before') and args.created_before:
            filters['created_before'] = args.created_before

        results = session_ops.query_sessions(filters if filters else None, args.directory)
        output_json({'success': True, 'sessions': results, 'count': len(results)})
    except session_ops.SessionError as e:
        raise ForgeError(str(e))


def handle_session_update(args):
    """Update an existing session"""
    try:
        updates = {}
        if hasattr(args, 'status') and args.status:
            updates['status'] = args.status
        if hasattr(args, 'rounds') and args.rounds is not None:
            updates['rounds'] = args.rounds
        if hasattr(args, 'agents') and args.agents:
            updates['agents'] = args.agents.split(',')

        # Parse optional JSON updates
        if hasattr(args, 'data') and args.data:
            import json
            extra_updates = json.loads(args.data)
            updates.update(extra_updates)

        result = session_ops.update_session(args.file_path, updates)
        output_json({'success': True, 'session': result})
    except session_ops.SessionError as e:
        raise ForgeError(str(e))


def handle_report_init(args):
    """Initialize reports directory structure"""
    try:
        result = report_ops.report_init(args.directory)
        output_json(result)
    except report_ops.ReportError as e:
        raise ForgeError(str(e))


def handle_report_create(args):
    """Create a new report"""
    try:
        data = {
            'report_type': args.report_type,
            'title': args.title,
            'topic': args.topic,
            'status': args.status if hasattr(args, 'status') and args.status else 'Draft'
        }

        if hasattr(args, 'product') and args.product:
            data['product'] = args.product
        if hasattr(args, 'module') and args.module:
            data['module'] = args.module
        if hasattr(args, 'authors') and args.authors:
            data['authors'] = args.authors.split(',')
        if hasattr(args, 'agents') and args.agents:
            data['agents'] = args.agents.split(',')

        # Parse optional JSON data
        if hasattr(args, 'data') and args.data:
            import json
            extra_data = json.loads(args.data)
            data.update(extra_data)

        result = report_ops.create_report(
            report_type=args.report_type,
            title=args.title,
            topic=args.topic,
            directory=args.directory,
            status=data.get('status', 'Draft'),
            product=data.get('product'),
            module=data.get('module'),
            authors=data.get('authors'),
            agents=data.get('agents'),
            data=data
        )
        output_json(result)
    except report_ops.ReportError as e:
        raise ForgeError(str(e))


def handle_report_get(args):
    """Get a single report by file path"""
    try:
        result = report_ops.get_report(args.file_path)
        output_json({'success': True, 'report': result})
    except report_ops.ReportError as e:
        raise ForgeError(str(e))


def handle_report_query(args):
    """Query reports"""
    try:
        result = report_ops.query_reports(
            directory=args.directory,
            report_type=args.report_type if hasattr(args, 'report_type') and args.report_type else None,
            status=args.status if hasattr(args, 'status') and args.status else None,
            product=args.product if hasattr(args, 'product') and args.product else None,
            created_after=args.created_after if hasattr(args, 'created_after') and args.created_after else None,
            created_before=args.created_before if hasattr(args, 'created_before') and args.created_before else None
        )
        output_json(result)
    except report_ops.ReportError as e:
        raise ForgeError(str(e))


def handle_report_update(args):
    """Update an existing report"""
    try:
        updates = {}
        if hasattr(args, 'status') and args.status:
            updates['status'] = args.status
        if hasattr(args, 'product') and args.product:
            updates['product'] = args.product
        if hasattr(args, 'module') and args.module:
            updates['module'] = args.module
        if hasattr(args, 'authors') and args.authors:
            updates['authors'] = args.authors.split(',')
        if hasattr(args, 'agents') and args.agents:
            updates['agents'] = args.agents.split(',')

        # Parse optional JSON updates
        if hasattr(args, 'data') and args.data:
            import json
            extra_updates = json.loads(args.data)
            updates.update(extra_updates)

        result = report_ops.update_report(
            file_path=args.file_path,
            directory=args.directory if hasattr(args, 'directory') else '.',
            status=updates.get('status'),
            product=updates.get('product'),
            module=updates.get('module'),
            authors=updates.get('authors'),
            agents=updates.get('agents'),
            data=updates
        )
        output_json(result)
    except report_ops.ReportError as e:
        raise ForgeError(str(e))


def handle_harvest_init(args):
    """Initialize plugin harvest directory structure"""
    try:
        result = harvest_ops.harvest_init(directory=args.directory, plugin=args.plugin)
        output_json(result, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_create(args):
    """Create a new harvest record"""
    try:
        data = json.loads(args.data) if args.data else {}
        data['title'] = args.title
        if args.harvest_type:
            data['harvest_type'] = args.harvest_type
        result = harvest_ops.create_harvest(data, directory=args.directory, plugin=args.plugin)
        output_json(result, success=True)
    except (HarvestError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_get(args):
    """Get a harvest record by filename"""
    try:
        result = harvest_ops.get_harvest(args.filename, directory=args.directory, plugin=args.plugin)
        output_json(result, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)


def handle_harvest_query(args):
    """Query harvest records with filters"""
    try:
        filters = {}
        if args.status:
            filters['status'] = args.status
        if args.harvest_type:
            filters['harvest_type'] = args.harvest_type
        result = harvest_ops.query_harvests(filters if filters else None, directory=args.directory, plugin=args.plugin)
        output_json({"harvests": result}, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_update(args):
    """Update a harvest record"""
    try:
        updates = json.loads(args.data)
        result = harvest_ops.update_harvest(args.filename, updates, directory=args.directory, plugin=args.plugin)
        output_json(result, success=True)
    except (HarvestError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_config(args):
    """Get or set plugin harvest channel config"""
    try:
        if args.get:
            result = harvest_ops.get_config(directory=args.directory, plugin=args.plugin)
            output_json(result, success=True)
        elif args.set_channels:
            channels = json.loads(args.set_channels)
            config = harvest_ops.get_config(directory=args.directory, plugin=args.plugin)
            config['channels'] = channels
            harvest_ops.set_config(args.directory, config, plugin=args.plugin)
            output_json({"message": "Channels updated", "count": len(channels)}, success=True)
        elif args.set_jira_channel:
            config = harvest_ops.get_config(directory=args.directory, plugin=args.plugin)
            config['jira_channel'] = args.set_jira_channel
            harvest_ops.set_config(args.directory, config, plugin=args.plugin)
            output_json({"message": "JIRA channel set", "channel": args.set_jira_channel}, success=True)
        else:
            output_json(None, success=False, error="Must specify --get, --set-channels, or --set-jira-channel")
            sys.exit(EXIT_ERROR)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_transcript_clean(args):
    """Clean a raw transcript by removing noise and formatting artifacts"""
    from core.transcript_ops import clean_jira_transcript

    # Read raw transcript
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            raw_text = f.read()
    except OSError as e:
        print(f"Error reading input file: {e}", file=sys.stderr)
        sys.exit(EXIT_ERROR)

    # Apply cleanup
    if args.type == 'jira':
        cleaned_text = clean_jira_transcript(raw_text)
    else:
        print(f"Unsupported transcript type: {args.type}", file=sys.stderr)
        sys.exit(EXIT_ERROR)

    # Write cleaned transcript
    try:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(cleaned_text)
    except OSError as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(EXIT_ERROR)

    # Report results
    original_size = len(raw_text)
    cleaned_size = len(cleaned_text)
    reduction_pct = ((original_size - cleaned_size) / original_size) * 100 if original_size > 0 else 0

    print(f"Transcript cleaned successfully")
    print(f"Original size: {original_size} chars")
    print(f"Cleaned size: {cleaned_size} chars")
    print(f"Reduction: {reduction_pct:.1f}%")


def handle_transcript_filename(args):
    """Generate a sequential transcript filename that avoids collisions"""
    from pathlib import Path
    from core.transcript_ops import generate_transcript_filename, TranscriptError

    directory = Path(args.dir)

    try:
        filename = generate_transcript_filename(
            directory=directory,
            scan_date=args.scan_date,
            timeframe=args.timeframe,
            transcript_type=args.type,
        )
        print(filename)
    except TranscriptError as e:
        print(str(e), file=sys.stderr)
        sys.exit(EXIT_ERROR)


def handle_index_rebuild(args):
    """Rebuild index.json from markdown files"""
    try:
        count = index_ops.rebuild_index(
            directory=args.directory,
            plugin=args.plugin if args.plugin else ""
        )
        output_json({
            "message": "Index rebuilt successfully",
            "directory": args.directory,
            "entries_indexed": count
        })
    except IndexError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_index_update(args):
    """Update index.json for a specific file"""
    try:
        filepath = Path(args.directory) / args.filename
        if not filepath.exists():
            output_json(None, success=False, error=f"File not found: {args.filename}")
            sys.exit(EXIT_NOT_FOUND)

        content = filepath.read_text(encoding='utf-8')
        fm, _ = frontmatter.parse(content)
        if not fm:
            output_json(None, success=False, error=f"No frontmatter found in: {args.filename}")
            sys.exit(EXIT_ERROR)

        def _serialize(value):
            if isinstance(value, (date, datetime)):
                return value.strftime("%Y-%m-%d")
            elif isinstance(value, list):
                return [_serialize(item) for item in value]
            elif isinstance(value, dict):
                return {k: _serialize(v) for k, v in value.items()}
            return value

        updates = {
            "file": args.filename,
            "type": _serialize(fm.get("type", "")),
            "title": _serialize(fm.get("title", "")),
        }
        for field in ["status", "product", "module", "client", "parent",
                       "children", "created", "updated", "priority",
                       "due_date", "assigned_to"]:
            if field in fm:
                updates[field] = _serialize(fm[field])

        try:
            index_ops.update_index_entry(args.directory, args.filename, updates)
            output_json({"message": "Index entry updated", "filename": args.filename})
        except IndexError:
            index_ops.create_index_entry(args.directory, updates)
            output_json({"message": "Index entry created", "filename": args.filename})

    except IndexError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_relationship_link(args):
    """Link two cards (parent-child relationship)"""
    try:
        result = relationship_ops.link_to_parent(
            child_filepath=args.child,
            parent_filepath=args.parent,
            directory=args.directory
        )
        output_json(result)
    except RelationshipError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_relationship_unlink(args):
    """Unlink two cards"""
    try:
        result = relationship_ops.unlink_from_parent(
            child_filepath=args.child,
            parent_filepath=args.parent,
            directory=args.directory
        )
        output_json(result)
    except RelationshipError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_relationship_validate(args):
    """Validate all relationships in a directory"""
    try:
        orphans = relationship_ops.find_orphans(directory=args.directory)
        output_json({
            "directory": args.directory,
            "orphans_found": len(orphans),
            "orphans": orphans,
            "valid": len(orphans) == 0
        })
    except RelationshipError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_create(args):
    """Create a new Rovo agent configuration."""
    try:
        data = {'name': args.name, 'platform': args.platform}
        if args.data:
            data.update(json.loads(args.data))
        result = agent_ops.create_agent(data, directory=args.directory)
        output_json(result)
    except ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_get(args):
    """Get a Rovo agent configuration by slug."""
    try:
        result = agent_ops.get_agent(args.slug, directory=args.directory)
        output_json(result)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_query(args):
    """Query Rovo agent configurations."""
    try:
        filters = {}
        if args.platform:
            filters['platform'] = args.platform
        if args.status:
            filters['status'] = args.status
        results = agent_ops.query_agents(directory=args.directory, filters=filters)
        output_json(results)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_update(args):
    """Update a Rovo agent configuration."""
    try:
        updates = json.loads(args.data) if args.data else {}
        result = agent_ops.update_agent(args.slug, updates, directory=args.directory)
        output_json(result)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def create_parser():
    """Create the argument parser with all subcommands"""
    parser = argparse.ArgumentParser(
        prog="forge",
        description="Forge CLI - Deterministic data layer for The Forge Marketplace",
        epilog="For more information, see the forge-lib README.md"
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"forge {__version__}"
    )

    subparsers = parser.add_subparsers(
        title="commands",
        description="Available commands",
        dest="command",
        required=True
    )

    # ==================== CARD COMMANDS ====================
    card_parser = subparsers.add_parser("card", help="Card operations")
    card_subparsers = card_parser.add_subparsers(dest="card_command", required=True)

    # card create
    card_create = card_subparsers.add_parser("create", help="Create a new card")
    card_create.add_argument("type", choices=[
        "initiative", "epic", "story", "intake",
        "checkpoint", "decision", "release-note"
    ])
    card_create.add_argument("title", help="Card title")
    card_create.add_argument("--directory", default=".", help="Target directory")
    card_create.add_argument("--parent", help="Parent card filename")
    card_create.add_argument("--data", help="JSON frontmatter data")
    card_create.set_defaults(func=handle_card_create)

    # card get
    card_get = card_subparsers.add_parser("get", help="Get a card by filename")
    card_get.add_argument("type", choices=[
        "initiative", "epic", "story", "intake",
        "checkpoint", "decision", "release-note"
    ], help="Card type")
    card_get.add_argument("filename", help="Card filename")
    card_get.add_argument("--directory", default=".", help="Target directory")
    card_get.set_defaults(func=handle_card_get)

    # card query
    card_query = card_subparsers.add_parser("query", help="Query cards")
    card_query.add_argument("--directory", default=".", help="Target directory")
    card_query.add_argument("--type", help="Filter by card type")
    card_query.add_argument("--status", help="Filter by status")
    card_query.add_argument("--parent", help="Filter by parent")
    card_query.add_argument("--product", help="Filter by product")
    card_query.set_defaults(func=handle_card_query)

    # card update
    card_update = card_subparsers.add_parser("update", help="Update a card")
    card_update.add_argument("type", choices=[
        "initiative", "epic", "story", "intake",
        "checkpoint", "decision", "release-note"
    ], help="Card type")
    card_update.add_argument("filename", help="Card filename")
    card_update.add_argument("--directory", default=".", help="Target directory")
    card_update.add_argument("--data", required=True, help="JSON frontmatter data to update")
    card_update.set_defaults(func=handle_card_update)

    # ==================== TASK COMMANDS ====================
    task_parser = subparsers.add_parser("task", help="Task operations")
    task_subparsers = task_parser.add_subparsers(dest="task_command", required=True)

    # task init
    task_init = task_subparsers.add_parser("init", help="Initialize tasks directory")
    task_init.add_argument("--directory", default=".", help="Target directory")
    task_init.set_defaults(func=handle_task_init)

    # task create
    task_create = task_subparsers.add_parser("create", help="Create a new task")
    task_create.add_argument("title", help="Task title")
    task_create.add_argument("--directory", default=".", help="Target directory")
    task_create.add_argument("--data", help="JSON frontmatter data")
    task_create.set_defaults(func=handle_task_create)

    # task get
    task_get = task_subparsers.add_parser("get", help="Get a task by filename")
    task_get.add_argument("filename", help="Task filename")
    task_get.add_argument("--directory", default=".", help="Target directory")
    task_get.set_defaults(func=handle_task_get)

    # task query
    task_query = task_subparsers.add_parser("query", help="Query tasks")
    task_query.add_argument("--directory", default=".", help="Target directory")
    task_query.add_argument("--status", help="Filter by status")
    task_query.add_argument("--priority", type=int, help="Filter by priority")
    task_query.set_defaults(func=handle_task_query)

    # task update
    task_update = task_subparsers.add_parser("update", help="Update a task")
    task_update.add_argument("filename", help="Task filename")
    task_update.add_argument("--directory", default=".", help="Target directory")
    task_update.add_argument("--data", required=True, help="JSON frontmatter data to update")
    task_update.set_defaults(func=handle_task_update)

    # ==================== MEMORY COMMANDS ====================
    memory_parser = subparsers.add_parser("memory", help="Memory operations")
    memory_subparsers = memory_parser.add_subparsers(dest="memory_command", required=True)

    # memory init
    memory_init = memory_subparsers.add_parser("init", help="Initialize memory structure")
    memory_init.add_argument("--directory", default=".", help="Target directory")
    memory_init.set_defaults(func=handle_memory_init)

    # memory get-taxonomy
    memory_get = memory_subparsers.add_parser("get-taxonomy", help="Get taxonomy")
    memory_get.add_argument("taxonomy_type", choices=["products", "modules", "systems", "clients", "teams", "integrations"])
    memory_get.add_argument("--directory", default=".", help="Target directory")
    memory_get.set_defaults(func=handle_memory_get_taxonomy)

    # memory set-taxonomy
    memory_set = memory_subparsers.add_parser("set-taxonomy", help="Set/update taxonomy")
    memory_set.add_argument("taxonomy_type", choices=["products", "modules", "systems", "clients", "teams", "integrations"])
    memory_set_group = memory_set.add_mutually_exclusive_group(required=True)
    memory_set_group.add_argument("--add", help="Add taxonomy entry")
    memory_set_group.add_argument("--remove", help="Remove taxonomy entry")
    memory_set.add_argument("--directory", default=".", help="Target directory")
    memory_set.set_defaults(func=handle_memory_set_taxonomy)

    # memory create-knowledge
    mem_create_knowledge = memory_subparsers.add_parser('create-knowledge', help='Create a knowledge entry')
    mem_create_knowledge.add_argument('type', choices=['person', 'project', 'glossary'], help='Knowledge type')
    mem_create_knowledge.add_argument('name', nargs='?', help='Entry name (or term for glossary)')
    mem_create_knowledge.add_argument('--data', help='Additional data as JSON')
    mem_create_knowledge.add_argument('--directory', default='.', help='Base directory')
    mem_create_knowledge.set_defaults(func=handle_memory_create_knowledge)

    # memory query-knowledge
    mem_query_knowledge = memory_subparsers.add_parser('query-knowledge', help='Query knowledge entries')
    mem_query_knowledge.add_argument('--type', choices=['person', 'project', 'glossary'], help='Filter by type')
    mem_query_knowledge.add_argument('--directory', default='.', help='Base directory')
    mem_query_knowledge.set_defaults(func=handle_memory_query_knowledge)

    # memory decay
    decay_parser = memory_subparsers.add_parser("decay", help="Run decay evaluation across all memory entries")
    decay_parser.add_argument("--directory", default=".", help="Base directory")
    decay_parser.set_defaults(func=handle_memory_decay)

    # memory harvest
    harvest_parser = memory_subparsers.add_parser("harvest", help="Process a memory signal from a plugin")
    harvest_parser.add_argument("--entity", required=True, help="Entity name")
    harvest_parser.add_argument("--source", required=True, help="Source plugin name")
    harvest_parser.add_argument("--type", required=True, choices=["person", "project", "glossary"], help="Entity type")
    harvest_parser.add_argument("--context", default="", help="Context description")
    harvest_parser.add_argument("--directory", default=".", help="Base directory")
    harvest_parser.set_defaults(func=handle_memory_harvest)

    # memory triage-report
    triage_report_parser = memory_subparsers.add_parser("triage-report", help="Generate triage summary")
    triage_report_parser.add_argument("--directory", default=".", help="Base directory")
    triage_report_parser.set_defaults(func=handle_memory_triage_report)

    # memory promote
    promote_parser = memory_subparsers.add_parser("promote", help="Check and promote pending entities")
    promote_parser.add_argument("--check", action="store_true", help="List promotable entities without promoting")
    promote_parser.add_argument("--directory", default=".", help="Base directory")
    promote_parser.set_defaults(func=handle_memory_promote)

    # memory triage-keep
    triage_keep_parser = memory_subparsers.add_parser("triage-keep", help="Keep a triaged entry (boost +20)")
    triage_keep_parser.add_argument("filepath", help="Relative path to the entry file")
    triage_keep_parser.add_argument("--directory", default=".", help="Base directory")
    triage_keep_parser.set_defaults(func=handle_memory_triage_keep)

    # memory triage-archive
    triage_archive_parser = memory_subparsers.add_parser("triage-archive", help="Archive a triaged entry")
    triage_archive_parser.add_argument("filepath", help="Relative path to the entry file")
    triage_archive_parser.add_argument("--directory", default=".", help="Base directory")
    triage_archive_parser.set_defaults(func=handle_memory_triage_archive)

    # memory triage-delete
    triage_delete_parser = memory_subparsers.add_parser("triage-delete", help="Delete a triaged entry")
    triage_delete_parser.add_argument("filepath", help="Relative path to the entry file")
    triage_delete_parser.add_argument("--directory", default=".", help="Base directory")
    triage_delete_parser.set_defaults(func=handle_memory_triage_delete)

    # memory boost
    boost_parser = memory_subparsers.add_parser("boost", help="Boost importance of a memory entry (+5)")
    boost_parser.add_argument("filepath", help="Relative path to the entry file")
    boost_parser.add_argument("--directory", default=".", help="Base directory")
    boost_parser.set_defaults(func=handle_memory_boost)

    # ==================== SESSION COMMANDS ====================
    session_parser = subparsers.add_parser("session", help="Session operations")
    session_subparsers = session_parser.add_subparsers(dest="session_command", required=True)

    # session init
    session_init = session_subparsers.add_parser("init", help="Initialize sessions directory")
    session_init.add_argument("--directory", default=".", help="Target directory")
    session_init.set_defaults(func=handle_session_init)

    # session create
    session_create = session_subparsers.add_parser("create", help="Create a session")
    session_create.add_argument("session_type", choices=["debate", "exploration"])
    session_create.add_argument("title", help="Session title")
    session_create.add_argument("topic", help="Main topic or question being explored")
    session_create.add_argument("--directory", default=".", help="Target directory")
    session_create.add_argument("--agents", help="Comma-separated list of agents")
    session_create.add_argument("--status", choices=["Active", "Paused", "Completed"], help="Session status")
    session_create.add_argument("--data", help="JSON frontmatter data")
    session_create.set_defaults(func=handle_session_create)

    # session get
    session_get = session_subparsers.add_parser("get", help="Get a session by file path")
    session_get.add_argument("file_path", help="Path to session file")
    session_get.set_defaults(func=handle_session_get)

    # session query
    session_query = session_subparsers.add_parser("query", help="Query sessions")
    session_query.add_argument("--directory", default=".", help="Target directory")
    session_query.add_argument("--session-type", dest="session_type", help="Filter by session type")
    session_query.add_argument("--status", help="Filter by status")
    session_query.add_argument("--agent", help="Filter by agent presence")
    session_query.add_argument("--created-after", dest="created_after", help="Filter by created date (YYYY-MM-DD)")
    session_query.add_argument("--created-before", dest="created_before", help="Filter by created date (YYYY-MM-DD)")
    session_query.set_defaults(func=handle_session_query)

    # session update
    session_update = session_subparsers.add_parser("update", help="Update a session")
    session_update.add_argument("file_path", help="Path to session file")
    session_update.add_argument("--status", choices=["Active", "Paused", "Completed"], help="Update status")
    session_update.add_argument("--rounds", type=int, help="Update rounds count")
    session_update.add_argument("--agents", help="Comma-separated list of agents")
    session_update.add_argument("--data", help="JSON update data")
    session_update.set_defaults(func=handle_session_update)

    # ==================== REPORT COMMANDS ====================
    report_parser = subparsers.add_parser("report", help="Report operations")
    report_subparsers = report_parser.add_subparsers(dest="report_command", required=True)

    # report init
    report_init = report_subparsers.add_parser("init", help="Initialize reports directory")
    report_init.add_argument("--directory", default=".", help="Target directory")
    report_init.set_defaults(func=handle_report_init)

    # report create
    report_create = report_subparsers.add_parser("create", help="Create a report")
    report_create.add_argument("report_type", choices=[
        "executive-summary", "technical-deep-dive", "competitive-analysis",
        "architecture-review", "performance-analysis", "incident-postmortem",
        "quarterly-review", "feasibility-study"
    ])
    report_create.add_argument("title", help="Report title")
    report_create.add_argument("topic", help="Main topic or focus area")
    report_create.add_argument("--directory", default=".", help="Target directory")
    report_create.add_argument("--status", choices=["Draft", "In Review", "Published", "Archived"], help="Report status")
    report_create.add_argument("--product", help="Product from taxonomy")
    report_create.add_argument("--module", help="Module from taxonomy")
    report_create.add_argument("--authors", help="Comma-separated list of authors")
    report_create.add_argument("--agents", help="Comma-separated list of agents")
    report_create.add_argument("--data", help="JSON frontmatter data")
    report_create.set_defaults(func=handle_report_create)

    # report get
    report_get = report_subparsers.add_parser("get", help="Get a report by file path")
    report_get.add_argument("file_path", help="Path to report file")
    report_get.set_defaults(func=handle_report_get)

    # report query
    report_query = report_subparsers.add_parser("query", help="Query reports")
    report_query.add_argument("--directory", default=".", help="Target directory")
    report_query.add_argument("--report-type", dest="report_type", help="Filter by report type")
    report_query.add_argument("--status", help="Filter by status")
    report_query.add_argument("--product", help="Filter by product")
    report_query.add_argument("--created-after", dest="created_after", help="Filter by created date (YYYY-MM-DD)")
    report_query.add_argument("--created-before", dest="created_before", help="Filter by created date (YYYY-MM-DD)")
    report_query.set_defaults(func=handle_report_query)

    # report update
    report_update = report_subparsers.add_parser("update", help="Update a report")
    report_update.add_argument("file_path", help="Path to report file")
    report_update.add_argument("--directory", default=".", help="Target directory")
    report_update.add_argument("--status", choices=["Draft", "In Review", "Published", "Archived"], help="Update status")
    report_update.add_argument("--product", help="Update product")
    report_update.add_argument("--module", help="Update module")
    report_update.add_argument("--authors", help="Comma-separated list of authors")
    report_update.add_argument("--agents", help="Comma-separated list of agents")
    report_update.add_argument("--data", help="JSON update data")
    report_update.set_defaults(func=handle_report_update)

    # ==================== HARVEST COMMANDS ====================
    harvest_parser = subparsers.add_parser("harvest", help="Harvest operations")
    harvest_subparsers = harvest_parser.add_subparsers(dest="harvest_command", required=True)

    # harvest init
    harvest_init = harvest_subparsers.add_parser("init", help="Initialize plugin harvest directory")
    harvest_init.add_argument("--directory", default=".", help="Target directory")
    harvest_init.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_init.set_defaults(func=handle_harvest_init)

    # harvest create
    harvest_create = harvest_subparsers.add_parser("create", help="Create a harvest record")
    harvest_create.add_argument("title", help="Harvest item title")
    harvest_create.add_argument("--harvest-type", dest="harvest_type", required=True,
                                choices=["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"], help="Type of harvest")
    harvest_create.add_argument("--directory", default=".", help="Target directory")
    harvest_create.add_argument("--data", help="JSON harvest data")
    harvest_create.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_create.set_defaults(func=handle_harvest_create)

    # harvest get
    harvest_get = harvest_subparsers.add_parser("get", help="Get a harvest record by filename")
    harvest_get.add_argument("filename", help="Harvest filename")
    harvest_get.add_argument("--directory", default=".", help="Target directory")
    harvest_get.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_get.set_defaults(func=handle_harvest_get)

    # harvest query
    harvest_query = harvest_subparsers.add_parser("query", help="Query harvest records")
    harvest_query.add_argument("--directory", default=".", help="Target directory")
    harvest_query.add_argument("--status", choices=["pending", "approved", "rejected", "promoted"],
                               help="Filter by status")
    harvest_query.add_argument("--harvest-type", dest="harvest_type",
                               choices=["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"], help="Filter by harvest type")
    harvest_query.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_query.set_defaults(func=handle_harvest_query)

    # harvest update
    harvest_update = harvest_subparsers.add_parser("update", help="Update a harvest record")
    harvest_update.add_argument("filename", help="Harvest filename")
    harvest_update.add_argument("--directory", default=".", help="Target directory")
    harvest_update.add_argument("--data", required=True, help="JSON update data")
    harvest_update.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_update.set_defaults(func=handle_harvest_update)

    # harvest config
    harvest_config = harvest_subparsers.add_parser("config", help="Manage channel config")
    harvest_config.add_argument("--directory", default=".", help="Target directory")
    harvest_config.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
    harvest_config_group = harvest_config.add_mutually_exclusive_group(required=True)
    harvest_config_group.add_argument("--get", action="store_true", help="Get current config")
    harvest_config_group.add_argument("--set-channels", dest="set_channels", help="Set channels JSON array")
    harvest_config_group.add_argument("--set-jira-channel", dest="set_jira_channel", help="Set JIRA bot channel ID")
    harvest_config.set_defaults(func=handle_harvest_config)

    # ==================== TRANSCRIPT COMMANDS ====================
    transcript_parser = subparsers.add_parser(
        'transcript',
        help='Transcript cleanup operations'
    )
    transcript_subparsers = transcript_parser.add_subparsers(dest='transcript_command', required=True)

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
    clean_parser.set_defaults(func=handle_transcript_clean)

    # transcript filename
    filename_parser = transcript_subparsers.add_parser(
        'filename',
        help='Generate a sequential transcript filename that avoids collisions'
    )
    filename_parser.add_argument(
        '--scan-date',
        required=True,
        help='Scan date in YYYY-MM-DD format'
    )
    filename_parser.add_argument(
        '--timeframe',
        required=True,
        help='Scan timeframe label (24h, 72h, 1w, custom)'
    )
    filename_parser.add_argument(
        '--type',
        required=True,
        choices=['public-channels', 'dms', 'jira-bot', 'calendar', 'inbox', 'sent', 'folder'],
        help='Transcript type'
    )
    filename_parser.add_argument(
        '--dir',
        default='slack-forge/transcripts',
        help='Transcript directory (default: slack-forge/transcripts)'
    )
    filename_parser.set_defaults(func=handle_transcript_filename)

    # ==================== INDEX COMMANDS ====================
    index_parser = subparsers.add_parser("index", help="Index operations")
    index_subparsers = index_parser.add_subparsers(dest="index_command", required=True)

    # index rebuild
    index_rebuild = index_subparsers.add_parser("rebuild", help="Rebuild index.json")
    index_rebuild.add_argument("--directory", default=".", help="Target directory")
    index_rebuild.add_argument("--plugin", default="", help="Plugin name (e.g., product-forge)")
    index_rebuild.set_defaults(func=handle_index_rebuild)

    # index update
    index_update = index_subparsers.add_parser("update", help="Update index for a file")
    index_update.add_argument("filename", help="File to update in index")
    index_update.add_argument("--directory", default=".", help="Target directory")
    index_update.set_defaults(func=handle_index_update)

    # ==================== RELATIONSHIP COMMANDS ====================
    relationship_parser = subparsers.add_parser("relationship", help="Relationship operations")
    relationship_subparsers = relationship_parser.add_subparsers(dest="relationship_command", required=True)

    # relationship link
    relationship_link = relationship_subparsers.add_parser("link", help="Link parent and child")
    relationship_link.add_argument("parent", help="Parent card filename")
    relationship_link.add_argument("child", help="Child card filename")
    relationship_link.add_argument("--directory", default=".", help="Target directory")
    relationship_link.set_defaults(func=handle_relationship_link)

    # relationship unlink
    relationship_unlink = relationship_subparsers.add_parser("unlink", help="Unlink parent and child")
    relationship_unlink.add_argument("parent", help="Parent card filename")
    relationship_unlink.add_argument("child", help="Child card filename")
    relationship_unlink.add_argument("--directory", default=".", help="Target directory")
    relationship_unlink.set_defaults(func=handle_relationship_unlink)

    # relationship validate
    relationship_validate = relationship_subparsers.add_parser("validate", help="Validate relationships")
    relationship_validate.add_argument("--directory", default=".", help="Target directory")
    relationship_validate.set_defaults(func=handle_relationship_validate)

    # ==================== AGENT COMMANDS ====================
    agent_parser = subparsers.add_parser("agent", help="Rovo agent operations")
    agent_subparsers = agent_parser.add_subparsers(dest="agent_command", required=True)

    # agent create
    agent_create = agent_subparsers.add_parser("create", help="Create a new Rovo agent")
    agent_create.add_argument("name", help="Agent display name")
    agent_create.add_argument("platform", choices=["jira", "confluence"], help="Target platform")
    agent_create.add_argument("--data", help="Additional agent data as JSON")
    agent_create.add_argument("--directory", default=".", help="Base directory")
    agent_create.set_defaults(func=handle_agent_create)

    # agent get
    agent_get = agent_subparsers.add_parser("get", help="Get agent by slug")
    agent_get.add_argument("slug", help="Agent directory slug")
    agent_get.add_argument("--directory", default=".", help="Base directory")
    agent_get.set_defaults(func=handle_agent_get)

    # agent query
    agent_query = agent_subparsers.add_parser("query", help="Query agents")
    agent_query.add_argument("--platform", choices=["jira", "confluence"], help="Filter by platform")
    agent_query.add_argument("--status", choices=["draft", "published", "archived"], help="Filter by status")
    agent_query.add_argument("--directory", default=".", help="Base directory")
    agent_query.set_defaults(func=handle_agent_query)

    # agent update
    agent_update = agent_subparsers.add_parser("update", help="Update an agent")
    agent_update.add_argument("slug", help="Agent directory slug")
    agent_update.add_argument("--data", help="Update data as JSON")
    agent_update.add_argument("--directory", default=".", help="Base directory")
    agent_update.set_defaults(func=handle_agent_update)

    return parser


def main():
    """Main entry point"""
    parser = create_parser()
    args = parser.parse_args()

    try:
        # Call the appropriate handler function
        args.func(args)
        sys.exit(EXIT_SUCCESS)
    except ForgeError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {str(e)}")
        sys.exit(EXIT_ERROR)


if __name__ == "__main__":
    main()
