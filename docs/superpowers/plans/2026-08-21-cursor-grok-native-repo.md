# Cursor and Grok Build Native Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `the-forge` a Cursor plus Grok Build only contributor repo with live Relay, and remove Claude, Codex, and OpenCode host packaging.

**Architecture:** `AGENTS.md` is the shared contract. `.cursor/rules/` and `.cursor/skills/` are source. `.grok/rules/` and `.grok/skills/` are labeled pairs. `.relay/relay.sh` is tracked from `jeremybrice/relay` at `4721e4101c1856f68045139c0ab75c761900747b`. New adapters live under `.relay/adapters/cursor/` and `.relay/adapters/grok/`. `install.sh` refreshes those skills into both host trees and never looks for Claude, Codex, or OpenCode.

**Tech Stack:** Markdown contracts (Cursor `.mdc` rules, Grok `.md` pairs, `SKILL.md`), bash (`relay.sh`, `install.sh`), gitignore exceptions.

**Spec:** `docs/superpowers/specs/2026-08-21-cursor-grok-native-repo-design.md`

## Global Constraints

- Repo contract only. Do not port plugin `commands/`, `skills/`, or `agents/` into Cursor or Grok product workflows.
- Do not modify `cowork-database`.
- Do not execute the Codex-first migration plan.
- Do not change `forge-lib` or Forge Shell behavior. Do not bump the product version.
- Do not add a new test harness. `make -C forge-lib test` is the regression gate.
- Cursor is source. Grok is pair. If they disagree, Cursor wins and the pair is rewritten in the same change.
- Relay session start reads `.session-log/latest.md` and `.session-log/index.md` if present. Do not create `relay-instructions.md`. Do not use `CLAUDE_PROJECT_DIR`, `CODEX_PROJECT_DIR`, or `OPENCODE_PROJECT_DIR`.
- Do not create `CLAUDE.md` as a pointer file.
- Do not add Claude, Codex, OpenCode, or other host adapters.
- Historical files under `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/plans/`, and `docs/forge-skills-audit/` stay as history except this plan and the 2026-08-21 spec.
- Do not invent a second plugin, card, or task system.

## File structure

| Path | Role |
|------|------|
| `.gitignore` | Keep `*.sh`; add `!.relay/relay.sh` and `!install.sh` |
| `.relay/relay.sh` | Tracked Relay core, copied from `jeremybrice/relay` @ `4721e41` |
| `install.sh` | Idempotent Cursor plus Grok wire; no Claude/Codex/OpenCode |
| `AGENTS.md` | Contributor contract plus Relay block |
| `.cursor/rules/{repo-map,host-pairing,contributor}.mdc` | Source rules |
| `.grok/rules/{repo-map,host-pairing,contributor}.md` | Pairs |
| `.relay/adapters/cursor/` | Relay skill source plus `AGENTS.relay.md` |
| `.relay/adapters/grok/` | Relay skill pairs plus `AGENTS.relay.md` |
| `.cursor/skills/{session-save,relay-learn}/SKILL.md` | Installed Cursor Relay skills |
| `.grok/skills/{session-save,relay-learn}/SKILL.md` | Installed Grok Relay skills |
| Live READMEs and `docs/{ARCHITECTURE,PATTERNS,DATA_FLOW,DECISION_LOG}.md` | Host wording |
| `CLAUDE.md`, `.claude/`, `.claude-plugin/`, `{plugin}/.claude-plugin/`, `opencode.json`, `.opencode/`, old Relay adapters | Delete |

---

### Task 1: Track `relay.sh` and un-ignore `install.sh`

**Files:**
- Modify: `.gitignore`
- Create: `.relay/relay.sh` (copy, do not rewrite)

**Interfaces:**
- Consumes: `jeremybrice/relay` commit `4721e4101c1856f68045139c0ab75c761900747b` file `relay.sh`
- Produces: tracked executable `.relay/relay.sh`; gitignore exceptions `!.relay/relay.sh` and `!install.sh`

- [ ] **Step 1: Prove `relay.sh` is ignored**

Run:

```bash
git check-ignore -v .relay/relay.sh install.sh || true
```

Expected: both lines cite `.gitignore` `*.sh` (exit may be 0). If this clone has no `install.sh` yet, `install.sh` still prints the ignore rule.

- [ ] **Step 2: Add gitignore exceptions**

In `.gitignore`, immediately under `*.sh`, insert the two exceptions. Do not delete `*.sh`.

```
# Validation artifacts
validation-*/
*.sh
!.relay/relay.sh
!install.sh
```

- [ ] **Step 3: Copy `relay.sh` at the pinned commit**

```bash
mkdir -p .relay
curl -fsSL \
  "https://raw.githubusercontent.com/jeremybrice/relay/4721e4101c1856f68045139c0ab75c761900747b/relay.sh" \
  -o .relay/relay.sh
chmod +x .relay/relay.sh
```

If `curl` cannot reach GitHub, use:

```bash
gh api repos/jeremybrice/relay/contents/relay.sh?ref=4721e4101c1856f68045139c0ab75c761900747b \
  --jq .content | base64 -d > .relay/relay.sh
chmod +x .relay/relay.sh
```

Do not edit the copied file.

- [ ] **Step 4: Verify it is tracked and runnable**

```bash
git check-ignore -v .relay/relay.sh; echo "ignore_exit:$?"
git check-ignore -v install.sh; echo "install_ignore_exit:$?"
head -2 .relay/relay.sh
.relay/relay.sh; echo "relay_exit:$?"
```

Expected:

- `git check-ignore` prints nothing and exits `1` for both paths
- First lines are `#!/usr/bin/env bash` and `# relay.sh — deterministic session-handoff helper`
- `relay.sh` with no args prints `usage: relay.sh {load|save} [--dir DIR] [--format text|codex] [--digest STR]` and exits `2`

- [ ] **Step 5: Commit**

```bash
git add .gitignore .relay/relay.sh
git commit -m "chore: track relay.sh and allow install.sh"
```

---

### Task 2: Contributor rules and Grok pairs

**Files:**
- Create: `.cursor/rules/repo-map.mdc`
- Create: `.cursor/rules/host-pairing.mdc`
- Create: `.cursor/rules/contributor.mdc`
- Create: `.grok/rules/repo-map.md`
- Create: `.grok/rules/host-pairing.md`
- Create: `.grok/rules/contributor.md`

**Interfaces:**
- Consumes: spec D4, D5, D12 and the folder map in the spec Architecture section
- Produces: three always-apply Cursor rules and three Grok `.md` pairs with `Source pair:` headers

- [ ] **Step 1: Prove the files are missing**

```bash
test ! -f .cursor/rules/repo-map.mdc && test ! -f .grok/rules/repo-map.md && echo MISSING
```

Expected: `MISSING`

- [ ] **Step 2: Write the six rule files**

Create `.cursor/rules/repo-map.mdc`:

```markdown
---
description: Folder map for The Forge product repo
alwaysApply: true
---

# Repo map

This repo is The Forge product: seven plugin folders, `forge-lib`, and Forge Shell.

| Path | What it is |
|------|------------|
| `product-forge/` | Card workflow files (`commands/`, `skills/`, `agents/`) |
| `tasks-forge/` | Task workflow files |
| `forge-memory/` | Memory workflow files |
| `cognitive-forge/` | Debate and explore workflow files |
| `report-forge/` | Report workflow files |
| `rovo-forge/` | Rovo agent builder workflow files |
| `audio-forge/` | Recording and transcription workflow files |
| `forge-lib/` | Python CLI, schemas, templates |
| `forge-shell/` | Tauri desktop dashboards |
| `docs/` | Architecture, patterns, specs, plans |
| `.relay/` | Session handoff core and Cursor/Grok adapters |
| `.cursor/` | Source host contract |
| `.grok/` | Grok Build discovery pairs |

Plugin `commands/`, `skills/`, and `agents/` are product source. They are not Cursor commands and not Grok commands.

Live 365 cards, memory, and Kai live in `cowork-database`. Do not write those here.

Leave `.superpowers/`, `.guardian/`, and `.forge/` alone unless a task names them.
```

Create `.cursor/rules/host-pairing.mdc`:

```markdown
---
description: Cursor is source; Grok files are pairs
alwaysApply: true
---

# Host pairing

Supported hosts: Cursor and Grok Build only.

- Edit `.cursor/rules/` and `.cursor/skills/`.
- Update the matching `.grok/rules/` or `.grok/skills/` file in the same change.
- Grok rules use `.md` with the same stem. Skills stay `SKILL.md`.
- Every Grok file starts with `Source pair: \`.cursor/...\``.
- Never treat `.grok/` as source. If a pair disagrees, Cursor wins; rewrite the pair.
- Do not add Claude, Codex, OpenCode, or other host trees.
```

Create `.cursor/rules/contributor.mdc`:

```markdown
---
description: How to work on The Forge product
alwaysApply: true
---

# Contributor contract

Layers:

- Plugin `commands/` converse and call `forge-lib`.
- `forge-lib` writes files, validates schemas, and maintains indexes.
- Forge Shell reads the filesystem. It does not use `index.json`.

Do not invent a second plugin, card, or task system. Do not add marketplace or Claude host files.

Tests: `make -C forge-lib test`. Docs: `docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/DATA_FLOW.md`.

Relay wrap-up uses `.relay/relay.sh` via the `session-save` and `relay-learn` skills.
```

Create `.grok/rules/repo-map.md`:

```markdown
Source pair: `.cursor/rules/repo-map.mdc`

# Repo map

This repo is The Forge product: seven plugin folders, `forge-lib`, and Forge Shell.

| Path | What it is |
|------|------------|
| `product-forge/` | Card workflow files (`commands/`, `skills/`, `agents/`) |
| `tasks-forge/` | Task workflow files |
| `forge-memory/` | Memory workflow files |
| `cognitive-forge/` | Debate and explore workflow files |
| `report-forge/` | Report workflow files |
| `rovo-forge/` | Rovo agent builder workflow files |
| `audio-forge/` | Recording and transcription workflow files |
| `forge-lib/` | Python CLI, schemas, templates |
| `forge-shell/` | Tauri desktop dashboards |
| `docs/` | Architecture, patterns, specs, plans |
| `.relay/` | Session handoff core and Cursor/Grok adapters |
| `.cursor/` | Source host contract |
| `.grok/` | Grok Build discovery pairs |

Plugin `commands/`, `skills/`, and `agents/` are product source. They are not Cursor commands and not Grok commands.

Live 365 cards, memory, and Kai live in `cowork-database`. Do not write those here.

Leave `.superpowers/`, `.guardian/`, and `.forge/` alone unless a task names them.
```

Create `.grok/rules/host-pairing.md`:

```markdown
Source pair: `.cursor/rules/host-pairing.mdc`

# Host pairing

Supported hosts: Cursor and Grok Build only.

- Edit `.cursor/rules/` and `.cursor/skills/`.
- Update the matching `.grok/rules/` or `.grok/skills/` file in the same change.
- Grok rules use `.md` with the same stem. Skills stay `SKILL.md`.
- Every Grok file starts with `Source pair: \`.cursor/...\``.
- Never treat `.grok/` as source. If a pair disagrees, Cursor wins; rewrite the pair.
- Do not add Claude, Codex, OpenCode, or other host trees.
```

Create `.grok/rules/contributor.md`:

```markdown
Source pair: `.cursor/rules/contributor.mdc`

# Contributor contract

Layers:

- Plugin `commands/` converse and call `forge-lib`.
- `forge-lib` writes files, validates schemas, and maintains indexes.
- Forge Shell reads the filesystem. It does not use `index.json`.

Do not invent a second plugin, card, or task system. Do not add marketplace or Claude host files.

Tests: `make -C forge-lib test`. Docs: `docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/DATA_FLOW.md`.

Relay wrap-up uses `.relay/relay.sh` via the `session-save` and `relay-learn` skills.
```

- [ ] **Step 3: Verify pairs**

```bash
test -f .cursor/rules/repo-map.mdc
test -f .cursor/rules/host-pairing.mdc
test -f .cursor/rules/contributor.mdc
test -f .grok/rules/repo-map.md
test -f .grok/rules/host-pairing.md
test -f .grok/rules/contributor.md
grep -F 'alwaysApply: true' .cursor/rules/*.mdc
grep -F 'Source pair:' .grok/rules/*.md
```

Expected: all `test` commands succeed. Each of the three Cursor files contains `alwaysApply: true`. Each of the three Grok files contains `Source pair:`.

- [ ] **Step 4: Commit**

```bash
git add .cursor/rules .grok/rules
git commit -m "docs: add Cursor contributor rules and Grok pairs"
```

---

### Task 3: Relay adapters and installed skills

**Files:**
- Create: `.relay/adapters/cursor/AGENTS.relay.md`
- Create: `.relay/adapters/cursor/skills/session-save/SKILL.md`
- Create: `.relay/adapters/cursor/skills/relay-learn/SKILL.md`
- Create: `.relay/adapters/grok/AGENTS.relay.md`
- Create: `.relay/adapters/grok/skills/session-save/SKILL.md`
- Create: `.relay/adapters/grok/skills/relay-learn/SKILL.md`
- Create: `.cursor/skills/session-save/SKILL.md`
- Create: `.cursor/skills/relay-learn/SKILL.md`
- Create: `.grok/skills/session-save/SKILL.md`
- Create: `.grok/skills/relay-learn/SKILL.md`

**Interfaces:**
- Consumes: `.relay/relay.sh` `save` and `knowledge` from Task 1; spec D6, D7
- Produces: Cursor adapter skills as Relay skill source; Grok adapter and installed copies; `AGENTS.relay.md` text used by Task 4 and Task 5

- [ ] **Step 1: Prove skills are missing**

```bash
test ! -f .cursor/skills/session-save/SKILL.md && test ! -d .relay/adapters/cursor && echo MISSING
```

Expected: `MISSING`

- [ ] **Step 2: Write adapter and installed skill files**

Create `.relay/adapters/cursor/AGENTS.relay.md` with exactly this body (no HTML comment wrapper):

```markdown
## Relay — session handoff (L2)
At the START of a session, read `.session-log/latest.md` and `.session-log/index.md`
if they exist. If missing, continue.
When the user signals the session is wrapping up ("done for today", "let's
continue tomorrow", or a task completes and we're winding down), run
`session-save` to persist a Relay handoff. If unsure the session is ending,
offer it in one line.
At wrap-up, also capture durable facts/lessons with `relay-learn` (or inline
`knowledge add`), and surface any graduation-ready lesson for the user to approve.
```

Create `.relay/adapters/grok/AGENTS.relay.md` with this first line, then the same Relay section as the Cursor adapter:

```markdown
Source pair: `.relay/adapters/cursor/AGENTS.relay.md`
```

Create `.relay/adapters/cursor/skills/session-save/SKILL.md` and write the same bytes to `.cursor/skills/session-save/SKILL.md`:

```markdown
---
name: session-save
description: Save a Relay handoff so the next session can pick up where you left off
---

Persist a Relay handoff for the next agent.

1. Author the six sections as concise markdown — `## Summary`, `## Changed`,
   `## Decisions`, `## Next`, `## Watch out`, `## Open questions` — naming real
   files/paths and dated facts. Compose a one-line digest.
2. Persist it. The script owns all file writes, rotation, and locking:

   ```bash
   printf '%s\n' '<<the six sections as markdown>>' \
     | "$PWD/.relay/relay.sh" save \
         --dir "$PWD/.session-log" \
         --digest '<<one-line digest>>'
   ```

3. Reply: "Handoff saved for the next session."
4. Then capture durable knowledge from this session (skip if none) using the
   `relay-learn` skill, or call `"$PWD/.relay/relay.sh"` `knowledge add` with
   `--dir "$PWD/.session-log"`. If the tool says a lesson is graduation-ready,
   offer graduation in one line. Never graduate without the user's okay.
```

Create `.relay/adapters/cursor/skills/relay-learn/SKILL.md` and write the same bytes to `.cursor/skills/relay-learn/SKILL.md`:

```markdown
---
name: relay-learn
description: Record a durable fact or lesson about this repo into Relay knowledge
---

Capture a single durable piece of knowledge about THIS repo for future sessions.

1. Decide the kind:
   - **Fact** — a durable truth about the repo (a command, a path, a gotcha).
   - **Lesson** — a behavioral pattern ("when X, prefer Y, because Z").
2. For a fact, first check for an existing match so you reuse its id instead of
   duplicating:

   ```bash
   "$PWD/.relay/relay.sh" knowledge add --fact --near '<the fact text>' \
     --dir "$PWD/.session-log"
   ```

3. Write it (reuse a surfaced id, or coin a short stable kebab-case slug). Add
   `--ttl <days>` to a fact that is only true for a while; omit it for durable
   truths:

   ```bash
   "$PWD/.relay/relay.sh" knowledge add --fact --id <slug> '<fact text>' \
     --dir "$PWD/.session-log"
   "$PWD/.relay/relay.sh" knowledge add --lesson --id <slug> '<lesson text>' \
     --dir "$PWD/.session-log"
   ```

4. If the tool reports a lesson is graduation-ready, offer (one line) to run
   `knowledge graduate <slug>` — never graduate without the user's okay.

Do not write `.session-log/relay-instructions.md`. Session start reads
`.session-log/latest.md` and `.session-log/index.md` only.
```

Create `.relay/adapters/grok/skills/session-save/SKILL.md` and `.grok/skills/session-save/SKILL.md` as the Cursor session-save skill plus this first line after the closing `---` of the frontmatter (before the heading/body):

```markdown
Source pair: `.cursor/skills/session-save/SKILL.md`
```

Create `.relay/adapters/grok/skills/relay-learn/SKILL.md` and `.grok/skills/relay-learn/SKILL.md` the same way, with:

```markdown
Source pair: `.cursor/skills/relay-learn/SKILL.md`
```

The rest of each Grok skill body must match the Cursor skill body. Do not mention `CLAUDE_PROJECT_DIR`, `CODEX_PROJECT_DIR`, `OPENCODE_PROJECT_DIR`, or `relay-instructions.md` as a load path to refresh.

- [ ] **Step 3: Verify**

```bash
test -f .relay/adapters/cursor/skills/session-save/SKILL.md
test -f .relay/adapters/grok/skills/session-save/SKILL.md
test -f .cursor/skills/session-save/SKILL.md
test -f .grok/skills/session-save/SKILL.md
test -f .cursor/skills/relay-learn/SKILL.md
test -f .grok/skills/relay-learn/SKILL.md
! grep -E 'CLAUDE_PROJECT_DIR|CODEX_PROJECT_DIR|OPENCODE_PROJECT_DIR' \
  .relay/adapters/cursor/skills/*/SKILL.md \
  .relay/adapters/grok/skills/*/SKILL.md \
  .cursor/skills/*/SKILL.md \
  .grok/skills/*/SKILL.md
grep -F 'Source pair:' .grok/skills/*/SKILL.md .relay/adapters/grok/skills/*/SKILL.md
grep -F 'session-log/latest.md' .relay/adapters/cursor/AGENTS.relay.md
```

Expected: all `test` commands succeed. The `grep -E` inverted check exits 0 (no forbidden env vars). Both Grok skill trees print `Source pair:`. Cursor `AGENTS.relay.md` mentions `session-log/latest.md`.

- [ ] **Step 4: Commit**

```bash
git add .relay/adapters/cursor .relay/adapters/grok .cursor/skills .grok/skills
git commit -m "feat: add Cursor and Grok Relay adapters"
```

---

### Task 4: Replace `AGENTS.md` with the contributor contract

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Task 2 routing rules; Task 3 `.relay/adapters/cursor/AGENTS.relay.md`
- Produces: `AGENTS.md` that is a contributor contract with a `# >>> relay >>>` block

- [ ] **Step 1: Prove the current file is the OpenCode stub**

```bash
grep -n 'opencode.json' AGENTS.md
```

Expected: at least one match (current stub).

- [ ] **Step 2: Overwrite `AGENTS.md`**

Write this entire file:

```markdown
# The Forge — Contributor Contract

This repo is The Forge product: seven plugin folders, `forge-lib`, and Forge Shell.
Supported hosts: Cursor and Grok Build only.

## Startup

1. Read this file.
2. If `.session-log/latest.md` or `.session-log/index.md` exists, read them.
   If they are missing, continue. Do not create a fake handoff.

## Hard contracts

- Commands converse. `forge-lib` writes. Forge Shell reads the filesystem.
- Plugin `commands/`, `skills/`, and `agents/` are product source. They are
  not Cursor commands and not Grok commands. Do not port them in a drive-by.
- Do not invent a second plugin, card, or task system.
- Do not add Claude, Codex, or OpenCode host files (`CLAUDE.md`, `.claude/`,
  `.claude-plugin/`, `opencode.json`, `.opencode/`, `.codex/`).
- Live 365 cards, memory, and Kai live in `cowork-database`. Do not write
  those here.
- Cursor is source (`.cursor/`). Grok files under `.grok/` are pairs.
- Tests: `make -C forge-lib test`.

## Routing

| Intent | Start here |
|--------|------------|
| Card workflows | `product-forge/` and `product-forge/README.md` |
| Task workflows | `tasks-forge/` |
| Memory workflows | `forge-memory/` |
| Debate / explore | `cognitive-forge/` |
| Reports | `report-forge/` |
| Rovo builders | `rovo-forge/` |
| Audio / Whisper | `audio-forge/` |
| Python data layer | `forge-lib/` and `forge-lib/README.md` |
| Desktop UI | `forge-shell/` |
| Host contract | `.cursor/rules/` (source) and `.grok/rules/` (pairs) |

## File naming (entities created by forge-lib)

| Entity Type | Pattern | Example |
|------------|---------|---------|
| Initiative/Epic/Decision | `{kebab-case-title}.md` | `notification-system-overhaul.md` |
| Story | `story-NNN-{slug}.md` | `story-001-notification-template-builder.md` |
| Task | `task-NNN.md` | `task-001.md` |
| Session | `YYYY-MM-DD-{slug}.md` | `2026-02-14-api-architecture-debate.md` |
| Report | `YYYY-MM-DD-{slug}.md` | `2026-02-14-q1-performance-review.md` |
| Checkpoint | `checkpoint-YYYY-MM-DD-{slug}.md` | `checkpoint-2026-02-14-architecture-decisions.md` |
| Rovo Agent | `{slug}/agent.md` | `ticket-triage-agent/agent.md` |
| Recording | `YYYY-MM-DD-{slug}.md` | `2026-05-06-sprint-standup.md` |

## Docs

- `docs/ARCHITECTURE.md` — layers and plugin anatomy
- `docs/PATTERNS.md` — orchestrator vs agent-less
- `docs/DATA_FLOW.md` — who writes which directory

# >>> relay >>>
## Relay — session handoff (L2)
At the START of a session, read `.session-log/latest.md` and `.session-log/index.md`
if they exist. If missing, continue.
When the user signals the session is wrapping up ("done for today", "let's
continue tomorrow", or a task completes and we're winding down), run
`session-save` to persist a Relay handoff. If unsure the session is ending,
offer it in one line.
At wrap-up, also capture durable facts/lessons with `relay-learn` (or inline
`knowledge add`), and surface any graduation-ready lesson for the user to approve.
# <<< relay <<<
```

The Relay section between the markers must match `.relay/adapters/cursor/AGENTS.relay.md`.

- [ ] **Step 3: Verify**

```bash
! grep -F 'opencode.json' AGENTS.md
grep -F 'Cursor and Grok Build only' AGENTS.md
grep -F '# >>> relay >>>' AGENTS.md
grep -F 'session-save' AGENTS.md
```

Expected: inverted `opencode.json` grep exits 0. The other three greps match.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: replace AGENTS.md with Cursor and Grok contract"
```

---

### Task 5: Write `install.sh` for Cursor and Grok only

**Files:**
- Create: `install.sh`

**Interfaces:**
- Consumes: Task 1 `.relay/relay.sh`; Task 3 adapter paths; Task 4 `AGENTS.md` markers
- Produces: executable `install.sh` with `wire_cursor` and `wire_grok` only

- [ ] **Step 1: Prove `install.sh` is absent or still the old host switchboard**

```bash
if [ -f install.sh ]; then grep -n 'wire_cc\|wire_opencode\|wire_codex' install.sh || echo 'NO_OLD_WIRES'; else echo ABSENT; fi
```

Expected: `ABSENT` on this clone (file was never tracked). If a local leftover exists, it must still contain the old `wire_*` names so the rewrite is justified.

- [ ] **Step 2: Write `install.sh`**

Create `install.sh` with exactly this content, then `chmod +x install.sh`:

```bash
#!/usr/bin/env bash
# install.sh — refresh Relay wiring for Cursor and Grok Build.
set -euo pipefail
MARK="# >>> relay >>>"

copy_tool() {
  mkdir -p .relay
  if [ ! -f .relay/relay.sh ]; then
    echo "relay: missing .relay/relay.sh (must be tracked in this repo)" >&2
    return 1
  fi
  chmod +x .relay/relay.sh
}

gitignore_data() {
  touch .gitignore
  grep -qF ".session-log/" .gitignore || printf '\n%s\n.session-log/\n' "$MARK" >> .gitignore
}

append_block() { # file, source-block
  local file="$1" src="$2"
  [ -f "$src" ] || return 0
  touch "$file"
  grep -qF "$MARK" "$file" 2>/dev/null && return 0
  { printf '\n%s\n' "$MARK"; cat "$src"; printf '%s\n' "# <<< relay <<<"; } >> "$file"
}

wire_cursor() {
  mkdir -p .cursor/skills
  [ -d .relay/adapters/cursor/skills ] && cp -R .relay/adapters/cursor/skills/. .cursor/skills/ 2>/dev/null || true
  append_block AGENTS.md .relay/adapters/cursor/AGENTS.relay.md
}

wire_grok() {
  mkdir -p .grok/skills
  [ -d .relay/adapters/grok/skills ] && cp -R .relay/adapters/grok/skills/. .grok/skills/ 2>/dev/null || true
}

usage() {
  echo "usage: ./install.sh" >&2
  echo "Wires Relay for Cursor and Grok Build. Creates .cursor/ and .grok/ if missing." >&2
}

main() {
  if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
  fi
  copy_tool
  mkdir -p .cursor .grok
  wire_cursor
  wire_grok
  gitignore_data
  echo "relay: installed for Cursor and Grok Build. Handoffs accumulate in .session-log/ (gitignored)."
}

main "$@"
```

- [ ] **Step 3: Verify syntax, hosts, and idempotence**

```bash
bash -n install.sh
./install.sh --help
./install.sh
./install.sh
! grep -E 'wire_cc|wire_codex|wire_opencode|\.claude|\.codex|opencode' install.sh
test -x install.sh
git check-ignore -v install.sh; echo "ignore_exit:$?"
```

Expected:

- `bash -n` exits 0
- `--help` prints the usage lines and exits 0
- first `./install.sh` prints the installed message
- second `./install.sh` prints the same message and does not duplicate the Relay block (`grep -c '# >>> relay >>>' AGENTS.md` is `1`)
- inverted grep exits 0
- `git check-ignore` on `install.sh` exits `1`

Confirm the marker count:

```bash
grep -c '# >>> relay >>>' AGENTS.md
```

Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: install Relay for Cursor and Grok Build only"
```

---

### Task 6: Delete Claude, Codex, and OpenCode host files

**Files:**
- Delete: `CLAUDE.md`
- Delete: `.claude/commands/relay-learn.md`
- Delete: `.claude/commands/session-save.md`
- Delete: `.claude/settings.json`
- Delete: `.claude-plugin/marketplace.json`
- Delete: `audio-forge/.claude-plugin/plugin.json`
- Delete: `cognitive-forge/.claude-plugin/plugin.json`
- Delete: `forge-memory/.claude-plugin/plugin.json`
- Delete: `product-forge/.claude-plugin/plugin.json`
- Delete: `report-forge/.claude-plugin/plugin.json`
- Delete: `rovo-forge/.claude-plugin/plugin.json`
- Delete: `tasks-forge/.claude-plugin/plugin.json`
- Delete: `opencode.json`
- Delete: `.opencode/commands/relay-learn.md`
- Delete: `.opencode/commands/session-save.md`
- Delete: `.relay/adapters/claude-code/` (entire tree)
- Delete: `.relay/adapters/codex/` (entire tree)
- Delete: `.relay/adapters/opencode/` (entire tree)

**Interfaces:**
- Consumes: Task 4 `AGENTS.md` (replacement for `CLAUDE.md`)
- Produces: those paths gone from `git ls-files`

- [ ] **Step 1: List tracked host files**

```bash
git ls-files CLAUDE.md .claude .claude-plugin '*/.claude-plugin/*' opencode.json .opencode \
  .relay/adapters/claude-code .relay/adapters/codex .relay/adapters/opencode
```

Expected: the delete list above (plus any extra files under those directories).

- [ ] **Step 2: Remove them from git and the working tree**

```bash
git rm -r --ignore-unmatch \
  CLAUDE.md \
  .claude \
  .claude-plugin \
  audio-forge/.claude-plugin \
  cognitive-forge/.claude-plugin \
  forge-memory/.claude-plugin \
  product-forge/.claude-plugin \
  report-forge/.claude-plugin \
  rovo-forge/.claude-plugin \
  tasks-forge/.claude-plugin \
  opencode.json \
  .opencode \
  .relay/adapters/claude-code \
  .relay/adapters/codex \
  .relay/adapters/opencode

rm -rf .claude .claude-plugin .opencode \
  audio-forge/.claude-plugin cognitive-forge/.claude-plugin \
  forge-memory/.claude-plugin product-forge/.claude-plugin \
  report-forge/.claude-plugin rovo-forge/.claude-plugin \
  tasks-forge/.claude-plugin
```

Do not recreate `CLAUDE.md`.

- [ ] **Step 3: Verify they are gone**

```bash
git ls-files CLAUDE.md .claude .claude-plugin '*/.claude-plugin/*' opencode.json .opencode \
  .relay/adapters/claude-code .relay/adapters/codex .relay/adapters/opencode
test ! -e CLAUDE.md
test ! -e opencode.json
test -d .relay/adapters/cursor
test -d .relay/adapters/grok
```

Expected: `git ls-files` prints nothing. `CLAUDE.md` and `opencode.json` are absent. Cursor and Grok adapter dirs remain.

- [ ] **Step 4: Commit**

```bash
git add \
  CLAUDE.md \
  .claude \
  .claude-plugin \
  audio-forge/.claude-plugin \
  cognitive-forge/.claude-plugin \
  forge-memory/.claude-plugin \
  product-forge/.claude-plugin \
  report-forge/.claude-plugin \
  rovo-forge/.claude-plugin \
  tasks-forge/.claude-plugin \
  opencode.json \
  .opencode \
  .relay/adapters/claude-code \
  .relay/adapters/codex \
  .relay/adapters/opencode
git commit -m "chore: remove Claude, Codex, and OpenCode host packaging"
```

Do not `git add -A`. Stage only the deletions.

---

### Task 7: Wording sweep for README and architecture docs

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PATTERNS.md`
- Modify: `docs/DATA_FLOW.md`
- Modify: `docs/DECISION_LOG.md`

**Interfaces:**
- Consumes: spec D8 replacement language; Task 4 file-naming table location
- Produces: live architecture docs that do not tell a contributor to install Claude Code

- [ ] **Step 1: Prove the host claims exist**

```bash
rg -n 'Claude Code|~/.claude/marketplaces|The Forge Marketplace v2' \
  README.md docs/ARCHITECTURE.md docs/PATTERNS.md docs/DATA_FLOW.md docs/DECISION_LOG.md
```

Expected: matches including `README.md` title line, marketplace symlink, `ARCHITECTURE.md` title, `PATTERNS.md` title and `CLAUDE.md` pointer, `DATA_FLOW.md` title, `DECISION_LOG.md` title.

- [ ] **Step 2: Apply the replacements**

`README.md`:

- Line 7: `**AI-native product management for Cursor and Grok Build**`
- Line 23: `The Forge is a suite of **7 plugins** backed by a shared **Python data layer** and a **Tauri desktop app** for visual dashboards. It brings structured product management into your AI coding workflow — no context switching, no separate tools.`
- Mermaid subgraph: `subgraph CC ["Cursor / Grok Build"]`
- Quick start step 3: replace the marketplace symlink block with:

```bash
# 3. Open this repo in Cursor, or start Grok Build here.
#    Both hosts read AGENTS.md. Cursor source is .cursor/; Grok pairs are .grok/.
#    Optional Relay refresh: ./install.sh
```

- Footer: `<sub>Built with Python · Rust · Vanilla JS · Cursor · Grok Build</sub>`

`docs/ARCHITECTURE.md`:

- Title: `# Architecture — The Forge v2`
- After the title, add this paragraph:

```markdown
Supported hosts: Cursor and Grok Build. Plugin `commands/` are workflow files, not host slash-commands.
```

`docs/PATTERNS.md`:

- Title: `# Patterns — The Forge v2`
- Replace `See the file naming patterns table in \`CLAUDE.md\` (lines 49-60) — not duplicated here.` with:

```markdown
See the file naming patterns table in `AGENTS.md` — not duplicated here.
```

`docs/DATA_FLOW.md`:

- Title: `# Data Flow — The Forge v2`
- In the ownership table, change the memory index cell from `None (uses CLAUDE.md)` to `None (workspace hot cache; historically CLAUDE.md in live workspaces)`

`docs/DECISION_LOG.md`:

- Title: `# Decision Log — The Forge v2`
- Leave the 2026-08-21 row as it is. Leave historical links whose filenames contain `marketplace`.

- [ ] **Step 3: Verify live docs**

```bash
rg -n 'Claude Code|~/.claude/marketplaces|Add marketplace to Claude' \
  README.md docs/ARCHITECTURE.md docs/PATTERNS.md docs/DATA_FLOW.md docs/DECISION_LOG.md \
  || true
grep -F 'AGENTS.md' docs/PATTERNS.md
grep -F 'Cursor and Grok Build' docs/ARCHITECTURE.md
grep -c 'Claude Code' README.md || true
```

Expected: no `Claude Code` and no `~/.claude/marketplaces` in those five files. `PATTERNS.md` points at `AGENTS.md`. `ARCHITECTURE.md` states Cursor and Grok Build.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/ARCHITECTURE.md docs/PATTERNS.md docs/DATA_FLOW.md docs/DECISION_LOG.md
git commit -m "docs: reword live architecture for Cursor and Grok"
```

---

### Task 8: Wording sweep for plugin READMEs and Forge Shell

**Files:**
- Modify: `product-forge/README.md`
- Modify: `forge-memory/README.md`
- Modify: `report-forge/README.md`
- Modify: `rovo-forge/README.md`
- Modify: `forge-shell/README.md`
- Read (no change unless a host claim appears): `tasks-forge/README.md`, `cognitive-forge/README.md`, `audio-forge/README.md`

**Interfaces:**
- Consumes: spec D8 replacement language
- Produces: plugin and Shell READMEs that do not present Claude as the host

- [ ] **Step 1: Inventory host claims**

```bash
rg -n -i 'claude code|claude |marketplace' \
  product-forge/README.md tasks-forge/README.md forge-memory/README.md \
  cognitive-forge/README.md report-forge/README.md rovo-forge/README.md \
  audio-forge/README.md forge-shell/README.md
```

Expected matches to change:

- `product-forge/README.md:3` — `plugin for Claude Code`
- `forge-memory/README.md` — Marketplace plus `Claude` as the actor
- `report-forge/README.md` — `Claude Agent SDK`
- `rovo-forge/README.md` — `The Forge Marketplace v2 ecosystem`
- `forge-shell/README.md` — Marketplace plus `not a Claude Code plugin`

`tasks-forge`, `cognitive-forge`, and `audio-forge` READMEs should have no host claim. If a new one appears, fix it in this task.

Do not edit plugin `skills/` or `commands/` bodies in this task.

- [ ] **Step 2: Apply replacements**

`product-forge/README.md` line 3:

```markdown
Product management plugin with orchestrator-agent architecture. Orchestrator workflow files detect card types, recruit specialized agents, and handle persistence via forge-lib.
```

`forge-memory/README.md`:

- Line 3: `Organizational memory and taxonomy management for The Forge. Enables an agent to decode workplace shorthand, resolve internal language, and maintain validated taxonomy across all plugins.`
- Line 7: `Forge Memory turns the agent into a workplace collaborator who speaks your internal language:`
- In the ASCII diagram, replace `↓ Claude decodes` with `↓ Agent decodes`

`report-forge/README.md` dependencies bullet:

```markdown
- **Host Task / subagent tool**: For agent spawning from report workflow files
```

`rovo-forge/README.md` license line:

```markdown
Part of The Forge plugin suite v2.
```

`forge-shell/README.md`:

- Line 3: `**Desktop visualization app** for browsing project data created by Forge plugins. Provides a unified single-page application (SPA) with built-in view controllers for all plugin views. No iframes.`
- Note block:

```markdown
> **Note:** Forge Shell is a standalone desktop application, not a host skill package. Other plugins (Product Forge, Cognitive Forge, etc.) create the content; Forge Shell provides a visual interface for browsing it.
```

- [ ] **Step 3: Verify**

```bash
rg -n -i 'claude code|~/.claude/marketplaces' \
  product-forge/README.md tasks-forge/README.md forge-memory/README.md \
  cognitive-forge/README.md report-forge/README.md rovo-forge/README.md \
  audio-forge/README.md forge-shell/README.md \
  || true
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add product-forge/README.md forge-memory/README.md report-forge/README.md \
  rovo-forge/README.md forge-shell/README.md \
  tasks-forge/README.md cognitive-forge/README.md audio-forge/README.md
git commit -m "docs: reword plugin and Shell READMEs for Cursor and Grok"
```

If the last three files were unchanged, `git add` is a no-op for them. The commit should still include the files that changed.

---

### Task 9: Final verification

**Files:**
- None expected. Fix only if a prior task missed a spec checklist item.

**Interfaces:**
- Consumes: spec Verification list items 1–11
- Produces: a green `make -C forge-lib test` and an empty host-file listing

- [ ] **Step 1: Contract files**

```bash
grep -F 'Cursor and Grok Build only' AGENTS.md
test -f .cursor/rules/repo-map.mdc
test -f .cursor/rules/host-pairing.mdc
test -f .cursor/rules/contributor.mdc
test -f .cursor/skills/session-save/SKILL.md
test -f .cursor/skills/relay-learn/SKILL.md
test -f .grok/rules/repo-map.md
test -f .grok/rules/host-pairing.md
test -f .grok/rules/contributor.md
test -f .grok/skills/session-save/SKILL.md
test -f .grok/skills/relay-learn/SKILL.md
test -d .relay/adapters/cursor
test -d .relay/adapters/grok
test -x .relay/relay.sh
test -x install.sh
```

Expected: every command succeeds.

- [ ] **Step 2: Deleted hosts**

```bash
git ls-files CLAUDE.md .claude .claude-plugin '*/.claude-plugin/*' opencode.json .opencode \
  .relay/adapters/claude-code .relay/adapters/codex .relay/adapters/opencode
```

Expected: empty.

- [ ] **Step 3: Live-doc host language**

```bash
rg -n 'Claude Code|~/.claude/marketplaces|Add marketplace to Claude' \
  README.md install.sh docs/ARCHITECTURE.md docs/PATTERNS.md docs/DATA_FLOW.md \
  docs/DECISION_LOG.md \
  product-forge/README.md tasks-forge/README.md forge-memory/README.md \
  cognitive-forge/README.md report-forge/README.md rovo-forge/README.md \
  audio-forge/README.md forge-shell/README.md \
  || true
```

Expected: no matches. Historical specs and plans may still mention Claude.

- [ ] **Step 4: `install.sh` hosts only**

```bash
! grep -E 'wire_cc|wire_codex|wire_opencode' install.sh
grep -F 'Cursor and Grok Build' install.sh
```

Expected: inverted grep exits 0. Positive grep matches.

- [ ] **Step 5: forge-lib regression**

```bash
make -C forge-lib test
```

Expected: pytest passes (this repo advertises 371 tests; the count may differ slightly, but the run must be green). No `forge-lib` source changes should have been required.

- [ ] **Step 6: Commit only if something was fixed**

If Steps 1–5 passed with no edits, do not create an empty commit.

If a miss required a fix, commit that fix with a message that names the file, then re-run the failing step.
