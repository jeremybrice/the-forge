# Mission Brief

**Playbook:** hardening
**Design Doc:** .guardian/completion-report.md (Code-Level Observations section)
**Created:** 2026-02-28

## Requirements Summary

1. **Fix `promote --check` dead code** — `handle_memory_promote` in `forge.py` ignores the `--check` flag. When `--check` is NOT passed, the handler should actually execute promotions (call `harvest_signal` or create entries directly). When `--check` IS passed, keep current list-only behavior.
2. **Wire `record_triage_action()` into handlers** — `triage_keep`, `triage_archive`, and `triage_delete` handlers in `forge.py` must call `record_triage_action()` from `memory_ops.py` so that `triage_history` in `telemetry.json` is populated.
3. **Fix `_boosts_today` schema conflict** — `boost_entry()` in `memory_ops.py` writes `_boosts_today` to frontmatter, but schemas have `additionalProperties: false`. **Constraint: minimize schema changes.** Prefer removing `_boosts_today` from frontmatter and using a separate tracking file (e.g., `memory/.boost-tracker.json`) or in-memory-only tracking.
4. **Fix `/memory:triage` naming** — User guide (`docs/living-memory-user-guide.md` line 63) references `/memory:triage` but the canonical plugin command in CLAUDE.md is `/forge-memory:triage`. Update to match.

## Key Files

| File | Role |
|------|------|
| `forge-lib/forge.py` | CLI handlers — promote, triage-keep/archive/delete |
| `forge-lib/core/memory_ops.py` | boost_entry(), record_triage_action(), promote logic |
| `forge-lib/schemas/person.json` | Schema with additionalProperties: false |
| `forge-lib/schemas/project-memory.json` | Schema with additionalProperties: false |
| `forge-lib/schemas/glossary.json` | Schema with additionalProperties: false |
| `docs/living-memory-user-guide.md` | Documentation naming fix |
| `forge-lib/tests/test_memory_decay.py` | Existing boost and triage tests |
| `forge-lib/tests/test_memory_harvest.py` | Existing harvest/boost tests |
| `forge-lib/tests/test_memory_telemetry.py` | Existing telemetry tests |
| `forge-lib/tests/test_forge_cli.py` | CLI command tests |

## Test Command

```bash
cd forge-lib && python3 -m pytest
```

## Developer Callouts

- **Minimize schema changes.** Prefer removing `_boosts_today` from frontmatter over adding it to schemas. Keep schemas clean.
- All 304 existing tests must continue to pass.
- The `promote` command's actual promotion logic already exists in `harvest_signal()` — reuse it rather than duplicating.

## Success Criteria

1. `forge memory promote` (without `--check`) actually promotes qualifying entries
2. `forge memory promote --check` lists without promoting (dry run)
3. `triage_history` in `telemetry.json` is populated after triage-keep/archive/delete
4. `boost_entry()` no longer writes `_boosts_today` to frontmatter (or uses a separate tracking mechanism)
5. Schema validation passes for boosted entries
6. User guide uses `/forge-memory:triage` consistently
7. All 304+ tests pass (existing + new regression tests)
