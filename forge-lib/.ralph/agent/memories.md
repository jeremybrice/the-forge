# Memories

## Patterns

### mem-1771044723-0d22
> forge-lib index_ops.py manages index.json files as caches (markdown is source of truth). Uses atomic writes (temp file + rename). Serializes Python date objects to YYYY-MM-DD strings for JSON. rebuild_index() scans directories recursively and parses frontmatter from .md files.
<!-- tags: forge-lib, index, json | created: 2026-02-14 -->

### mem-1771044410-e40b
> forge-lib templates use Jinja2 with conditional sections, array handling, and null safety. Templates match JSON schemas exactly. Use {%- for whitespace control, |length for array checks, 'if field else null' for optional fields.
<!-- tags: forge-lib, jinja2, templates | created: 2026-02-14 -->

### mem-1771044130-1b38
> forge-lib JSON schemas use Draft 7 with const for type enforcement, enums for status/priority, arrays for relationships (children, participants, agents, tags), date format validation (YYYY-MM-DD), and additionalProperties:false for strict validation. All schemas meta-validate and integrate with core/validator.py
<!-- tags: forge-lib, schemas, validation | created: 2026-02-14 -->

### mem-1771043838-75a6
> forge-lib test infrastructure complete: pytest.ini (config), Makefile (automation), conftest.py (fixtures), .gitignore, README.md (docs). All 84 tests pass. Stream A done.
<!-- tags: forge-lib, testing, infrastructure | created: 2026-02-14 -->

## Decisions

## Fixes

## Context

### mem-1771044921-e860
> Phase 1 validation checkpoint complete: 124/124 tests passing. All 10 schemas validated, slug generation verified, index rebuild works, cross-validation successful. forge-lib foundation ready for Phase 2.
<!-- tags: forge-lib, phase-1, validation | created: 2026-02-14 -->
