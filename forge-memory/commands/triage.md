---
description: Interactive triage session to curate aging memory entries
---

# Triage Command

Review memory entries that are approaching sunset or already in sunset status. Decide what to keep, archive, or delete through a guided batch workflow.

## Overview

This command runs the decay engine to refresh importance scores, then presents entries needing attention. The user reviews entries and takes batch actions (keep, archive, delete) in a single session.

All scoring, file operations, and telemetry are delegated to `forge-lib` via `forge memory` subcommands.

## Conversational Workflow

### Phase 1: Run Decay and Generate Report

First, update all scores and generate the triage report:

```bash
forge memory triage-report --directory .
```

The triage-report command runs decay internally before collecting results.

Parse the JSON response. If `success` is `false`, inform the user of the error. If `total` is `0`, report that all entries are healthy and end the session.

### Phase 2: Present Entries Needing Attention

Display entries as a numbered list, grouped by urgency:

```
Memory Triage — {total} entries need attention

Sunset (action required):
  1. {name} — {type}, score {importance}, last recalled {last_recalled}
  2. {name} — {type}, score {importance}, last recalled {last_recalled}

Approaching sunset (review recommended):
  3. {name} — {type}, score {importance}, last recalled {last_recalled}
  4. {name} — {type}, score {importance}, last recalled {last_recalled}

Actions: keep (boost +20), archive (move to archived/), delete (remove)

Tell me what to do — for example:
  "keep 1, archive 2, delete 3"
  "keep all"
  "archive 1 2, delete 3 4"
```

### Phase 3: Accept Batch Actions

Parse the user's response for batch actions. Accepted formats:
- `keep 1, archive 2, delete 3` — mixed actions by number
- `keep all` — keep every listed entry
- `archive 1 2, delete 3 4` — multiple entries per action
- `skip` — end session without changes

If the user's intent is unclear, ask for clarification:
```
I wasn't sure what to do with entry 2. Could you clarify — keep, archive, or delete?
```

### Phase 4: Execute Actions

For each action, call the corresponding forge-lib command using the `filepath` from the triage report data:

**Keep:**
```bash
forge memory triage-keep "memory/people/jane-smith.md" --directory .
```

**Archive:**
```bash
forge memory triage-archive "memory/projects/old-initiative.md" --directory .
```

**Delete:**
```bash
forge memory triage-delete "memory/glossary/deprecated-term.md" --directory .
```

Parse the JSON response for each action. If `success` is `false`, report the error and continue with remaining actions.

### Phase 5: Report Summary

After all actions complete, summarize the session:

```
Triage complete:
- Kept: {count} entries (boosted +20 each)
- Archived: {count} entries (moved to memory/archived/)
- Deleted: {count} entries (removed)
- Skipped: {count} entries (no action taken)

{count} entries remain healthy in the memory system.
```

## Key Behaviors

1. **Decay first**: Always run triage-report (which runs decay) before presenting entries
2. **Batch workflow**: Collect all actions in one response, execute together
3. **Numbered references**: Use stable numbers so the user can refer to entries easily
4. **Graceful errors**: If one action fails, continue with the rest and report failures
5. **No silent deletes**: Always confirm which entries will be deleted before executing
6. **Filepath mapping**: Map numbered entries back to their `filepath` field from the report
