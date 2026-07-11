# Patterns — The Forge Marketplace v2

## Orchestrator Pattern

Commands orchestrate conversation flow and delegate all persistence to forge-lib CLI. The command never does file I/O directly.

**Flow:** Gather user input → call `forge.py` subcommand → parse JSON output → guide next step.

**Used by:** product-forge (6 agents), cognitive-forge (5 agents), report-forge (3 agents)

**Anti-pattern:** Commands that read/write files directly instead of through forge-lib.

## Agent-Less Pattern

Single command handles the full workflow without agent delegation. Appropriate when the workflow is linear and does not require specialized reasoning.

**Used by:** tasks-forge, forge-memory, rovo-forge

These plugins contain `commands/` and `skills/` but no `agents/` directory.

## Skill Design Pattern

Skills provide pure reasoning guidance. They contain no file operations, schemas, or templates.

| Aspect | Command | Skill |
|--------|---------|-------|
| Purpose | Conversational workflow + forge-lib delegation | Pure reasoning guidance |
| User-invocable | Yes | No (loaded by commands/agents) |
| File operations | Via forge-lib subprocess | None |
| Frontmatter | Command metadata | `name`, `description`, `user_invocable: false` |

**When to create a skill:** Reusable reasoning needed across multiple commands or agents.
**When to embed in command:** One-time guidance specific to that workflow.

**Structure:** `{plugin}/skills/{skill-name}/SKILL.md` with YAML frontmatter.

## Agent Recruitment Pattern

Agents are read-only reasoning specialists — they return structured content and never write files. The orchestrating command selects agents based on task type or workflow stage.

### product-forge — Type-Based Selection

6 agents recruited based on card type detection:
`forge-initiative`, `forge-epic`, `forge-story`, `forge-decision`, `forge-intake`, `forge-release-notes`

The `create.md` command detects card type via the `pm-methodology` skill, then recruits the matching agent.

### cognitive-forge — Conditional Recruitment

- **Debate mode:** Always recruits Challenger + Explorer + Synthesizer. Conditionally adds Decomposer (4+ components) and Evaluator (factual claims).
- **Explore mode:** Only recruits Decomposer and Evaluator conditionally. Never recruits Challenger/Explorer/Synthesizer (the Guide embodies these through dialogue).

### report-forge — Sequential Pipeline

Investigator → Analyst → Synthesizer (sequential).
For `executive-summary` and `quarterly-review`: skips Analyst (Investigator → Synthesizer only).

## forge-lib CLI Integration

Commands delegate to forge-lib via subprocess calls.

**Call pattern:**

```
forge <entity> <action> [positional-args] [--flags]
```

**Examples:**

```bash
# Task workflow
forge task init                    # Initialize task directory
forge task create                  # Create a new task
forge task query                   # Query tasks from index

# Session creation
forge session create debate "Title" "Topic" \
  --agents challenger,explorer,synthesizer \
  --status Completed --data '{"category": "Business"}'

# Report creation
forge report create {type} "{title}" "{topic}" \
  [--directory DIR] [--status STATUS]
```

**Output format:**

- Success: `{"success": true, "data": {...}}` on stdout
- Error: `{"success": false, "error": "..."}` on stdout

**Exit codes** (from `forge-lib/forge.py`):

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | EXIT_SUCCESS | Success |
| 1 | EXIT_ERROR | General error |
| 2 | EXIT_VALIDATION_ERROR | Validation error |
| 3 | EXIT_NOT_FOUND | Not found |

See `forge-lib/README.md` for full CLI reference.

## Index Management

Each entity type has an `index.json` for fast queries, maintained automatically by forge-lib on create/update/delete.

| Aspect | Plugin CLI | forge-shell |
|--------|-----------|-------------|
| Data source | `index.json` via `forge <entity> query` | Direct FS scan via ForgeFS |
| Why | Fast structured queries | Avoids index drift |
| Implication | Index changes affect CLI queries | Frontmatter changes affect dashboards |

**Directories with indexes:** cards/, tasks/, sessions/, reports/, rovo-agents/, audio-forge/recordings/

**Note:** Index files are runtime artifacts maintained by forge-lib, not checked into the repo.

## File Naming Conventions

See the file naming patterns table in `CLAUDE.md` (lines 49-60) — not duplicated here.

**Key rules:**
- Frontmatter: YAML block at top of every `.md` entity file
- Relationships: `forge relationship link <parent-path> <child-path>` (positional args, bidirectional update)
