# Cursor and Grok Build native repo contract

**Date:** 2026-08-21
**Scope:** Host contract for `the-forge`. `AGENTS.md`, `.cursor/`, `.grok/`, Relay adapters, `install.sh`, `.relay/relay.sh` tracking, and live-doc host wording.
**Out of scope:** Rewriting plugin commands, skills, or agents so they run as Cursor or Grok workflows. Migrating `cowork-database`. Executing the unused Codex-first migration. Changing `forge-lib` or Forge Shell behavior. Bumping the product version. Adding a new test harness.
**Related:** Super-folder pairing at `/Users/jeremybrice/Documents/GitHub` (Cursor source, Grok pair). This design supersedes `cowork-database/memory/projects/codex-first-workspace-migration.md` for `the-forge` host choice. It does not implement that plan.

## Problem

`the-forge` still presents as a Claude Code marketplace. A clone has `CLAUDE.md`, `.claude/`, `.claude-plugin/marketplace.json`, per-plugin `.claude-plugin/`, `opencode.json`, `.opencode/`, and Relay adapters for Claude Code, Codex, and OpenCode. There is no `.cursor/` or `.grok/` tree. `AGENTS.md` is only an OpenCode Relay stub.

`install.sh` and `.relay/relay.sh` exist on disk but are ignored by the root `*.sh` rule, so a fresh clone cannot run Relay even though adapters are tracked.

The unused Codex-first design is not the direction. Supported hosts are Cursor and Grok Build only.

## Goal

An agent opening this repo in Cursor or Grok Build gets a contributor contract: what the repo is, how to work on plugins, `forge-lib`, and Forge Shell, and how to save and load Relay handoffs. Claude, Codex, and OpenCode are not supported hosts. Plugin workflow files stay on disk as product source. They are not ported to Cursor or Grok commands in this pass.

## Decisions

| ID | Decision |
|----|----------|
| D1 | Repo contract only. Do not port plugin commands or migrate `cowork-database`. |
| D2 | Delete Claude host packaging: `CLAUDE.md`, `.claude/`, root `.claude-plugin/`, every plugin `.claude-plugin/`. |
| D3 | Delete OpenCode and Codex host files: `opencode.json`, `.opencode/`, Relay adapters under `.relay/adapters/claude-code/`, `codex/`, and `opencode/`. |
| D4 | `AGENTS.md` is the shared contributor contract for Cursor and Grok Build. |
| D5 | Cursor is source. `.cursor/rules/` and `.cursor/skills/` are edited. `.grok/rules/` and `.grok/skills/` are labeled pairs updated in the same change. If they disagree, Cursor wins and the pair is rewritten. |
| D6 | Relay stays live with full parity on both hosts: session-start load, `session-save`, `relay-learn`. Same six-section handoff. `relay.sh` owns writes, rotation, and locking. |
| D7 | Session start reads `.session-log/latest.md` and `.session-log/index.md` when they exist. No Claude SessionStart hook. No OpenCode `relay-instructions.md` snapshot. |
| D8 | Full wording sweep of live docs. Historical specs, plans, and audit notes keep truthful Claude history. |
| D9 | Track `.relay/relay.sh` and `install.sh`. Narrow the root `*.sh` ignore so those two files are not ignored. `install.sh` wires Cursor and Grok only. |
| D10 | The committed tree is already wired. A clone works without running `install.sh`. Install is an idempotent refresh. |
| D11 | No product version bump. No new test harness. `forge-lib` tests remain the regression gate. |
| D12 | Do not invent a second plugin, card, or task system in this repo. Live 365 work stays in `cowork-database`. |

## Architecture

Two hosts, one contract. Cursor and Grok Build both start from `AGENTS.md`. Cursor owns the files you edit. Grok gets labeled pair copies so Grok Build discovery can see them.

```
the-forge/
  AGENTS.md                 shared contributor contract + Relay start/wrap
  .cursor/rules/            source rules
  .cursor/skills/           source skills, including Relay
  .grok/rules/              pair copies
  .grok/skills/             pair copies
  .relay/relay.sh           tracked core
  .relay/adapters/cursor/
  .relay/adapters/grok/
  product-forge/ …          plugin folders stay (commands, skills, agents)
  forge-lib/                unchanged behavior
  forge-shell/              unchanged behavior
  install.sh                tracked; wires Cursor and Grok only
```

**Unchanged product source:** plugin `commands/`, `skills/`, and `agents/`; `forge-lib`; Forge Shell. Those command files stay Claude-shaped on disk. Docs must say that honestly: supported hosts are Cursor and Grok Build; plugin folders are product source, not a live Claude marketplace, and not Cursor or Grok commands yet.

**Unchanged local tooling that is not a host:** `.superpowers/`, `.guardian/`, `.forge/`. Leave them.

## Components

### `AGENTS.md`

Replace the OpenCode Relay stub with a real contract:

1. This repo is The Forge product: seven plugin folders, `forge-lib`, Forge Shell.
2. Supported hosts: Cursor and Grok Build only.
3. Startup: read `.session-log/latest.md` and `.session-log/index.md` if they exist. If missing, continue.
4. Contributor rules: commands converse, `forge-lib` writes, Shell reads. Do not invent a second plugin or card system. Do not add Claude, Codex, or OpenCode host files.
5. Routing: plugin work in that plugin folder plus its README; Python data layer in `forge-lib/`; desktop UI in `forge-shell/`; live 365 cards and memory in `cowork-database` (do not write those here).
6. Pointers to `docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/DATA_FLOW.md`.
7. Injected Relay wrap-up block (see adapters).

### Cursor source rules

| File | `alwaysApply` | Job |
|------|---------------|-----|
| `.cursor/rules/repo-map.mdc` | yes | Folder map: plugins, `forge-lib`, Forge Shell, docs, Relay, what not to touch |
| `.cursor/rules/host-pairing.mdc` | yes | Cursor is source. Grok is pair. Edit `.cursor/`, update `.grok/` in the same change. Never treat `.grok/` as source. |
| `.cursor/rules/contributor.mdc` | yes | Layer split, no new host, no marketplace files, tests and docs pointers |

Each `.mdc` file has YAML frontmatter (`description`, `alwaysApply: true`) and a short body. Do not duplicate the entire `AGENTS.md` into the rules.

### Cursor source skills (Relay)

| Path | Job |
|------|-----|
| `.cursor/skills/session-save/SKILL.md` | Six-section handoff via `.relay/relay.sh save --dir .session-log` |
| `.cursor/skills/relay-learn/SKILL.md` | Facts and lessons via `.relay/relay.sh knowledge`, then offer graduation only with user okay |

Skill bodies follow the current Codex adapter flow, with these host-specific changes:

- Use the repo root (`$PWD` or the workspace root), not `CLAUDE_PROJECT_DIR`, `CODEX_PROJECT_DIR`, or `OPENCODE_PROJECT_DIR`.
- Do not refresh `.session-log/relay-instructions.md`. That snapshot was an OpenCode load path (D7).
- After `session-save`, reply that the handoff is saved, then capture durable knowledge if any.

### Grok pairs

Match the super-folder pairing layout: Cursor rules are `.mdc`, Grok rules are `.md` with the same stem. Skills stay `SKILL.md` in both trees.

| Cursor (source) | Grok (pair) |
|-----------------|-------------|
| `.cursor/rules/repo-map.mdc` | `.grok/rules/repo-map.md` |
| `.cursor/rules/host-pairing.mdc` | `.grok/rules/host-pairing.md` |
| `.cursor/rules/contributor.mdc` | `.grok/rules/contributor.md` |
| `.cursor/skills/session-save/SKILL.md` | `.grok/skills/session-save/SKILL.md` |
| `.cursor/skills/relay-learn/SKILL.md` | `.grok/skills/relay-learn/SKILL.md` |

Each Grok file starts with `Source pair: \`.cursor/...\``. The body matches the Cursor file. Cursor-only YAML (`alwaysApply`, `.mdc`) is omitted on the Grok side when Grok does not use it. Do not add a third layout.

### Relay adapters

Replace the three old adapter trees with two:

```
.relay/adapters/cursor/AGENTS.relay.md
.relay/adapters/cursor/skills/session-save/SKILL.md
.relay/adapters/cursor/skills/relay-learn/SKILL.md
.relay/adapters/grok/AGENTS.relay.md
.relay/adapters/grok/skills/session-save/SKILL.md
.relay/adapters/grok/skills/relay-learn/SKILL.md
```

Cursor adapter skills are the Relay skill source. Grok adapter skills are pairs of those. `install.sh` copies:

- cursor adapter skills → `.cursor/skills/`
- grok adapter skills → `.grok/skills/`
- `.relay/adapters/cursor/AGENTS.relay.md` appended into `AGENTS.md` between `# >>> relay >>>` and `# <<< relay <<<`. The Grok adapter file is a pair of that same text.

`AGENTS.relay.md` content for both hosts:

- At start: read `.session-log/latest.md` and `.session-log/index.md` if present.
- On wrap-up (“done for today”, “continue tomorrow”, or a natural wind-down): run `session-save`. If unsure the session is ending, offer it in one line.
- Also capture durable facts or lessons with `relay-learn` (or inline `knowledge add`). Surface graduation-ready lessons for user approval.

Delete, do not keep as history in-tree:

- `.relay/adapters/claude-code/`
- `.relay/adapters/codex/`
- `.relay/adapters/opencode/`

### `install.sh`

Rewrite the host switchboard:

- Remove `wire_cc`, `wire_codex`, `wire_opencode`, and any detection of `.claude/`, `.codex/`, or `.opencode/`.
- Add `wire_cursor` and `wire_grok`.
- If `.cursor/` or `.grok/` is missing, create the needed directories and install into them. Do not exit with “nothing to wire.”
- Keep `copy_tool` (install or refresh `.relay/relay.sh`), `append_block` for `AGENTS.md`, and `gitignore_data` for `.session-log/`.
- Help and log lines mention Cursor and Grok Build only.

### Track `relay.sh` and `install.sh` (D9)

Root `.gitignore` currently has `*.sh` under “Validation artifacts”, which ignores both files. Change that rule so validation-only scripts stay ignored and these two are tracked.

Required result after the change:

- `git check-ignore -v .relay/relay.sh` is empty
- `git check-ignore -v install.sh` is empty
- Other stray `.sh` files under the repo root stay ignored unless they are already tracked exceptions (`forge-shell/src-tauri/binaries/forge-recorder/*.sh`)

Preferred form: keep `*.sh` and add:

```
!.relay/relay.sh
!install.sh
```

Do not delete the `*.sh` rule. It still hides validation scripts.

`.session-log/` stays gitignored.

### Deletes

| Path | Why |
|------|-----|
| `CLAUDE.md` | Claude contract |
| `.claude/` | Claude settings and Relay command copies |
| `.claude-plugin/marketplace.json` and the directory | Marketplace install |
| `{plugin}/.claude-plugin/plugin.json` and the directory, for all seven plugins | Per-plugin Claude packaging |
| `opencode.json` | OpenCode host config |
| `.opencode/` | OpenCode commands (and any untracked `node_modules` on disk) |
| `.relay/adapters/claude-code/` | Old adapter |
| `.relay/adapters/codex/` | Old adapter |
| `.relay/adapters/opencode/` | Old adapter |

If untracked leftovers exist (`.claude/settings.local.json`, `.opencode/node_modules`), delete them from the working tree. Do not commit them.

### Wording sweep (live docs only)

Rewrite host language in:

- `README.md` (title line, architecture diagram host node, marketplace symlink quick start, footer)
- `install.sh` messages
- `docs/ARCHITECTURE.md`
- `docs/PATTERNS.md`
- `docs/DATA_FLOW.md`
- `docs/DECISION_LOG.md` title and any “Claude as supported host” claims (the 2026-08-21 row for this spec is already present)
- All seven plugin READMEs
- `forge-shell/README.md` (the “not a Claude Code plugin” note becomes “not a host skill package; it is the desktop app”)

Replacement language:

- Supported hosts: Cursor and Grok Build.
- The suite is a plugin-folder product plus `forge-lib` plus Forge Shell, not a Claude Code marketplace.
- Slash-style names like `/product-forge:create` may stay as the filenames’ historical command names. Call them plugin workflow files, not Cursor commands and not Grok commands.
- Do not tell a contributor to `ln -s` this repo into `~/.claude/marketplaces/`.

Leave unchanged as history:

- `docs/superpowers/specs/*` other than this file
- `docs/superpowers/plans/*`
- `docs/plans/*`
- `docs/forge-skills-audit/*`

## Data flow

### Session start

The agent reads `AGENTS.md` (already loaded by both hosts), then `.session-log/latest.md` and `.session-log/index.md` if they exist. Missing files are not an error.

### Session wrap

On wrap-up the agent runs `session-save`: author `## Summary`, `## Changed`, `## Decisions`, `## Next`, `## Watch out`, `## Open questions`, compose a one-line digest, pipe the body through `.relay/relay.sh save --dir .session-log --digest '...'`. Reply that the handoff is saved. Then run `relay-learn` for durable facts or lessons. Graduation still needs the user’s okay.

`relay.sh` is the only writer of `.session-log/`.

### Pairing

A contract change is one change: edit the Cursor file, write or update the Grok pair in the same commit. `install.sh` may refresh Relay skills from `.relay/adapters/` into both trees. It is not a second source of truth. If Cursor and Grok disagree, Cursor wins and the pair is rewritten.

Relay adapter pairing follows the same rule: edit `.relay/adapters/cursor/`, update `.relay/adapters/grok/` in the same change, then refresh installed copies if they are already present.

### Contributor work

Plugin, `forge-lib`, and Forge Shell edits stay in those folders. This pass does not route `/product-forge:create` through Cursor or Grok.

`cowork-database` is not modified.

## Error handling

| Case | Behavior |
|------|----------|
| `.session-log/` missing at start | Continue. Do not create a fake handoff. |
| `relay.sh save` or `knowledge` fails | Show the error and stop. Do not write a parallel handoff file by hand. |
| Relay skills missing from `.cursor/skills/` or `.grok/skills/` | Follow `AGENTS.md` and call `.relay/relay.sh` directly. |
| Cursor file and Grok pair disagree | Cursor wins. Rewrite the pair in the same change. Do not merge by guess. |
| `install.sh` and host trees missing | Create `.cursor/` and `.grok/` and wire them. Never look for `.claude/`, `.codex/`, or `.opencode/`. |
| Missing Cursor or Grok contract file | Defect. Do not restore a Claude, Codex, or OpenCode path. |

No silent host fallback.

## Verification

No new test harness. `forge-lib` tests stay the regression gate and should remain green without Python or Shell behavior changes.

Done when all of the following are true:

1. `AGENTS.md` is a contributor contract, not an OpenCode stub.
2. `.cursor/rules/` has `repo-map`, `host-pairing`, and `contributor`.
3. `.cursor/skills/` has `session-save` and `relay-learn`.
4. `.grok/` has a pair for every Cursor rule and skill.
5. `.relay/adapters/cursor/` and `.relay/adapters/grok/` exist.
6. `.relay/relay.sh` and `install.sh` are tracked and not ignored.
7. These paths are gone from git: `CLAUDE.md`, `.claude/`, `.claude-plugin/`, every `{plugin}/.claude-plugin/`, `opencode.json`, `.opencode/`, `.relay/adapters/claude-code/`, `.relay/adapters/codex/`, `.relay/adapters/opencode/`.
8. Live docs listed in the wording sweep do not tell a contributor to install Claude Code or add a marketplace.
9. Old specs, plans, and audit notes may still mention Claude as history.
10. `install.sh` help and wiring mention Cursor and Grok only.
11. `make -C forge-lib test` still passes.

## PR plan

### PR 1: Cursor and Grok Build native contract

Single implementation PR after the plan is written and approved.

- **Description:** Replace Claude, Codex, and OpenCode host packaging with a Cursor-source plus Grok-pair contributor contract and live Relay adapters.
- **Files:** listed in Components, Deletes, and Wording sweep. Plus this spec and the later implementation plan.
- **Dependencies:** none. Does not depend on the Codex-first plan.

## Non-goals (explicit)

- Do not convert `product-forge/commands/*.md` (or other plugin commands) into `.cursor/skills/` product workflows.
- Do not change `cowork-database` `.claude/` commands, Airtable task backend, or Kai.
- Do not implement `docs/superpowers/plans` from the Codex-first migration (that plan lives on another branch and is not this work).
- Do not add Codex, OpenCode, Claude, or other host adapters “for compatibility.”
- Do not create `CLAUDE.md` as a pointer file.
