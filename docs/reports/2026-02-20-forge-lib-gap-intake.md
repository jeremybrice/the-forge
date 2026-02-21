---
type: intake
title: "forge-lib CLI Not Accessible at Runtime"
status: draft
created: 2026-02-20
author: Jeremy Brice
priority: high
affects: all Forge Marketplace plugins
---

# forge-lib CLI Not Accessible at Runtime

## Problem Statement

The Forge Marketplace ecosystem depends on a shared Python CLI (`forge-lib`) for all file operations across 7 plugins. The CLI exists, is fully implemented, and passes 124 unit tests. However, no installation or linking mechanism makes it callable as `forge` from the shell. Every plugin command that references `forge <subcommand>` silently fails, forcing LLM agents to improvise file writes without validation, schema enforcement, or index management.

## Discovery Context

This was discovered during a `/slack-forge:scan` followed by `/slack-forge:capture` on 2026-02-20. The scan command references `forge harvest config --get` to load channel configuration, and the capture command instructs subagents to use `forge harvest create` for writing harvest records. When `which forge` returned nothing, the orchestrating agent fell back to reading `config.json` directly, and subagents wrote raw YAML files to a self-chosen directory path (`slack-forge/harvests/`).

The harvest records were structurally reasonable but bypassed all forge-lib guarantees: no schema validation, no sequential filename generation, no index.json updates, and no standardized JSON response handling.

## Findings

### What Exists

forge-lib is located at:

```
/mnt/.local-plugins/marketplaces/the-forge-marketplace-v2/forge-lib/
```

It contains:

- `forge.py` — Main CLI entry point (argparse-based, 52,000+ lines)
- `core/` — 13 implementation modules (card_ops, task_ops, memory_ops, session_ops, report_ops, harvest_ops, index_ops, relationship_ops, agent_ops, transcript_ops, frontmatter, validator, slug)
- `schemas/` — JSON Schema definitions for all entity types
- `templates/` — Jinja2 markdown templates
- `tests/` — 124 passing unit tests
- `requirements.txt` — pyyaml, jinja2, jsonschema (all already installed in the environment)
- `Makefile` — Development targets (test, lint, format) but no install-to-PATH target

The CLI returns structured JSON for all operations:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Exit codes: 0 (success), 1 (error), 2 (validation), 3 (not found).

### What Works When Called Directly

Running the CLI with its full path succeeds:

```bash
python3 /path/to/forge-lib/forge.py harvest config --get --directory /path/to/Cowork
# Returns valid JSON with all configured channels
```

```bash
python3 /path/to/forge-lib/forge.py --version
# Returns: forge 2.0.0-alpha
```

### What Is Missing

**1. No PATH registration or shell alias.** The `forge` command is not on the system PATH. No symlink, wrapper script, or alias exists. `which forge` returns nothing.

**2. No marketplace-level dependency declaration.** The `marketplace.json` lists 7 plugins but does not declare forge-lib as a shared dependency. Individual `plugin.json` files mention forge-lib in their description text only; there is no formal `dependencies` field or install hook.

**3. No session bootstrap mechanism.** Cowork VMs reset between sessions. Even if a symlink were created manually, it would not persist. There is no `.bashrc` entry, no post-init hook, and no plugin lifecycle event that sets up the CLI.

**4. No Makefile install target for PATH.** The Makefile has `make install` but it only runs `pip3 install -r requirements.txt`. There is no target to create a wrapper script or add forge to PATH.

### Downstream Impact

Every plugin in the ecosystem is affected. The command documentation across all plugins references bare `forge` invocations:

| Plugin | Example Commands That Fail |
|--------|---------------------------|
| slack-forge | `forge harvest init`, `forge harvest create`, `forge harvest config --get`, `forge harvest query`, `forge harvest update`, `forge transcript clean` |
| product-forge | `forge card create`, `forge card get`, `forge card query`, `forge card update`, `forge relationship link`, `forge memory get-taxonomy` |
| tasks-forge | `forge task init`, `forge task create`, `forge task query`, `forge task update` |
| forge-memory | `forge memory init`, `forge memory get-taxonomy`, `forge memory set-taxonomy`, `forge memory create-knowledge` |
| cognitive-forge | `forge session create`, `forge session query`, `forge session update` |
| report-forge | `forge report create`, `forge report query`, `forge report update` |
| rovo-forge | `forge agent create`, `forge agent get`, `forge agent query`, `forge agent update` |

When these commands fail, LLM agents either improvise (writing files without validation) or silently skip the operation. Neither outcome is acceptable.

## Requirements

### REQ-1: Create a forge wrapper script

Create an executable wrapper script that resolves `forge` to the correct `forge.py` invocation. The wrapper must:

- Accept all arguments and pass them through to `forge.py`
- Set `PYTHONPATH` correctly so `core/` imports resolve
- Be placed in a location already on PATH (e.g., `/usr/local/bin/forge`) or in a discoverable bin directory
- Return the same exit codes as `forge.py`

### REQ-2: Add a Makefile install target

Add a `make link` or `make install-cli` target to the forge-lib Makefile that:

- Creates the wrapper script from REQ-1
- Verifies `forge --version` returns successfully after linking
- Is idempotent (safe to run multiple times)

### REQ-3: Add session bootstrap automation

Since Cowork VMs reset between sessions, the forge CLI must be linked automatically at session start. Options to evaluate:

- A `.claude/hooks` post-init script that runs `make link` from the forge-lib directory
- A marketplace-level `setup` field in `marketplace.json` that Cowork executes on plugin load
- A lightweight check at command invocation time (each command checks for `forge` and runs setup if missing)

The chosen mechanism must not require user intervention and must complete in under 2 seconds.

### REQ-4: Add formal dependency declaration to marketplace.json

Add a `shared_dependencies` or `requires` field to `marketplace.json` that declares forge-lib as a shared dependency with its path:

```json
{
  "shared_dependencies": [
    {
      "name": "forge-lib",
      "source": "./forge-lib",
      "type": "cli",
      "entry_point": "forge.py"
    }
  ]
}
```

This enables future tooling to discover and validate the dependency automatically.

### REQ-5: Add dependency verification to plugin commands

Each plugin's init command (e.g., `/slack-forge:init`, `/product-forge:init`) should verify that `forge` is callable before proceeding. If not found, the command should:

- Report the specific error ("forge CLI not found on PATH")
- Attempt auto-setup if the forge-lib source directory exists
- Fail gracefully with actionable instructions if auto-setup is not possible

## Verification Criteria

An agent reviewing this intake should confirm:

1. **forge-lib location** — Verify `forge.py` exists at the documented path and runs with `--version`
2. **Import chain** — Verify all `core/` module imports succeed (run `python3 -c "from core import harvest_ops; print('OK')"` from the forge-lib directory)
3. **Command coverage** — Spot-check at least 3 plugin command files to confirm they reference bare `forge` invocations
4. **No existing PATH entry** — Confirm `which forge` returns nothing
5. **Environment dependencies** — Confirm pyyaml, jinja2, jsonschema are installed (`pip3 list | grep -i yaml`)
6. **Harvest gap validation** — Review the harvest files written during the 2026-02-20 capture at `slack-forge/harvests/` and confirm they lack sequential slug naming and index.json entries, validating the bypass behavior described above
