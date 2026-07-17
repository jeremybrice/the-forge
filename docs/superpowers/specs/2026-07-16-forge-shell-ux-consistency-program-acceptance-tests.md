# Forge Shell UX Consistency Program — Acceptance Test Suite

Companion to the [design](2026-07-16-forge-shell-ux-consistency-program.md) and the [implementation plan](../plans/2026-07-16-forge-shell-ux-consistency-program.md). The program lands as nine stacked PRs; **each `## PRn gate` section below is the manual acceptance gate for merging that PR**, and the final `## Program-level end-to-end` section runs once after PR9. Automated coverage (`cd forge-shell && npm test`, 103 tests baseline → 255 after PR8) is a prerequisite for every gate, not a substitute for it — these scenarios verify user-facing behavior the node suites cannot reach.

## How to run

Three runtimes back `ForgeFS`; every scenario declares which apply.

| Runtime | Launch | Project selection | Freshness source |
|---|---|---|---|
| **Tauri** | `cd forge-shell && npm run tauri:dev` (needs Rust toolchain) | native folder picker | native file watcher **(only runtime with watcher events)** + 5s pollers |
| **Chrome FSA** | `cd forge-shell && node server.js`, open `http://127.0.0.1:4173` in a **real Chrome/Edge tab** | native FSA picker (`showDirectoryPicker`) | 5s pollers only |
| **Server** | same URL in an embedded browser (e.g. cmux) or any browser without FSA | typed-path dialog; writes via `/api/fs/*` | 5s pollers only |

If the Rust toolchain is unavailable, run the Chrome FSA and Server columns and record the Tauri column as `SKIPPED (no toolchain)` — watcher-dependent scenarios (marked Tauri-only) then carry over to the next machine that has it.

Shell commands in Setup blocks and steps assume a **macOS/BSD userland** (the primary dev environment per CLAUDE.md). On a GNU/Linux runner substitute the GNU forms: `stat -c %Y <file>` for `stat -f %m <file>`, and `sed -i` (no `''` argument) for `sed -i ''`. Where a Setup block already carries a dual form (e.g. `date -v-7d … || date -d '-7 days' …`), use it as-is.

## Conventions

- **IDs:** `AT-PRn.m` for per-PR scenarios, `AT-E2E.m` for the final pass. Scenario headings are `### AT-PRn.m — <title>`.
- **Format:** every scenario states **Verifies** (WP / finding / decision it proves), **Runtimes**, **Setup** (or "fixture as section setup"), numbered **Given/When/Then** steps, and a **Pass** line with one checkbox per applicable runtime.
- **Fixtures:** each section opens with a Setup block that builds a disposable fixture project under `mktemp -d`. Fixtures follow forge-lib naming: initiatives/epics/decisions `cards/…/{kebab}.md`, stories `story-NNN-{slug}.md`, tasks `tasks/task-NNN.md`, memory `memory/*.md` + `CLAUDE.md`, sessions/reports `YYYY-MM-DD-{slug}.md`, rovo `rovo-agents/{slug}/agent.md`, recordings `audio-forge/recordings/YYYY-MM-DD-{slug}.md`. Never point acceptance runs at a real project directory until the final E2E pass says to.
- **Forcing write failures:** in Tauri/Server use `chmod 000 <file>` (restore `chmod 644` afterwards); in Chrome FSA stub the write in DevTools exactly as the plan's PR4 browser verifications do. Scenarios quote the stub they need.
- **Exact strings matter:** quoted toast texts, key bindings, and timings in Then-steps are contractual — they come from the implementation plan. A different string is a failure to investigate, not a cosmetic pass.
- **Verdict discipline:** a gate passes when every scenario passes in every applicable runtime you can run. Record skips explicitly.

---

## PR1 gate — Tasks data layer: round-trip frontmatter, parent chip, honest drag

Merging PR1 must prove that every Tasks-board write (column drag, inline/modal edit) is round-trip faithful — `parent`, `source`, and unknown frontmatter keys survive byte-meaningfully, block-style lists stay block-style, no schema-forbidden keys (`creator`/`dependencies`/`external_link`/`external_id`) are added to files that never had them, and the written `updated:` date is fresh; that changing Priority to P1 in the edit modal saves instead of throwing; that tasks with a parent show a navigable chip on the card and a read-only row in the modal; and that the fake between-card insertion line is replaced by an honest whole-column highlight with no write on a same-column drop. Prerequisite before running any scenario: `cd forge-shell && npm test` passes (126 tests — 103 pre-existing + 23 in `test/tasks.helpers.test.js`, 0 fail).

**Setup** — build the disposable fixture project (files derived from the plan's own browser-verification fixture, plus one view-legacy file and one invalid-values file taken from the plan's unit-test corpus):

```bash
FIX=$(mktemp -d)
mkdir -p "$FIX/tasks" "$FIX/cards/stories"
cat > "$FIX/tasks/task-101-fixture.md" <<'EOF'
---
title: "Fixture with parent"
type: task
status: Open
priority: 2
assignee: null
due_date: null
tags:
  - auth
  - backend
parent: story-001-notification-template-builder
source: product-forge
custom_field: keep-me  # trailing comment
custom_meta:
  reviewer: alice
  notes: keep this block
created: 2026-07-01
updated: 2026-07-01
---

## Description

Round-trip fixture.
EOF
cat > "$FIX/tasks/task-102-child.md" <<'EOF'
---
title: "Child of a task"
status: Open
parent: task-101-fixture
created: 2026-07-01
updated: 2026-07-01
---

Body.
EOF
cat > "$FIX/tasks/task-103-legacy.md" <<'EOF'
---
title: Plain title
type: task
status: In Progress
priority: 4
assignee: jbrice
creator: null
created: 2026-06-01
updated: 2026-06-02
due_date: 2026-08-01
dependencies: []
tags: [ui, board]
external_link: null
external_id: null
---

Body.
EOF
cat > "$FIX/tasks/task-104-invalid.md" <<'EOF'
---
title: "Legacy invalid values"
status: WIP
priority: 3abc
created: 2026-06-01
updated: 2026-06-01
---

Body.
EOF
cat > "$FIX/cards/stories/story-001-notification-template-builder.md" <<'EOF'
---
title: "Notification Template Builder"
type: story
status: Draft
created: 2026-07-01
updated: 2026-07-01
---

Story body.
EOF
echo "$FIX"
```

The story fixture lives under `cards/stories/` — `CardData.scanCardsDir` only scans the seven expected `cards/` subdirectories (`initiatives`, `epics`, `stories`, …) and never loads root-level card files, so a root-placed story would make Product Forge unable to resolve the parent chip's target.

Launch the runtime under test per the runtime table in "How to run", select the `$FIX` folder as the project (typed-path dialog in Server mode, native pickers in Chrome FSA and Tauri), and open the **Tasks** view. UI writes land after roughly 2 seconds (500 ms debounce + write) — wait ~2s before inspecting files.

### AT-PR1.1 — Cross-column drag round-trips parent, source, unknown key, and block tags

**Verifies:** WP1 acceptance criteria "Round-trip fidelity" and "Updated-date correctness" — a board drag no longer deletes `parent`/`source`/unknown keys, no longer emits schema-forbidden keys, and writes today's date.

**Runtimes:** Tauri, Chrome FSA, Server (required in all three per the PR's smoke checklist).

**Setup:** fixture as section setup.

1. **Given** the Tasks board shows "Fixture with parent" in the **Open** column,
2. **When** you drag that card into the **In Progress** column and wait ~2s (watch for the status pill "Moved to In Progress", then "Saved"),
3. **Then** run `cat "$FIX/tasks/task-101-fixture.md"` and verify all of:
   - `status: In Progress`
   - `updated:` equals today's date
   - `parent: story-001-notification-template-builder`, `source: product-forge`, the unknown line `custom_field: keep-me  # trailing comment` (comment included), and the multiline unknown block `custom_meta:` with its two indented lines are intact, byte-identical, and in their original positions
   - `tags:` is still block style (`  - auth` / `  - backend` on indented dash lines)
   - the title line is still exactly `title: "Fixture with parent"` (not double-quoted, quotes not stripped)
   - **no** `creator:`, `dependencies:`, `external_link:`, or `external_id:` lines appeared anywhere in the file.
4. *(Server runtime, once — forge-lib interop, per WP1's "forge-lib schema validation still passes" criterion.)* **When** you run, from the repo root (forge-lib deps installed per CLAUDE.md — the same prerequisite as the `forge index rebuild` steps later in this suite):

   ```bash
   python3 - "$FIX/tasks/task-101-fixture.md" <<'PY'
   import sys
   sys.path.insert(0, 'forge-lib')
   from core import frontmatter, validator
   fm, _ = frontmatter.parse(open(sys.argv[1]).read())
   known = {k: v for k, v in fm.items()
            if k in ('title','type','status','priority','assignee','due_date',
                     'tags','parent','source','created','updated')}
   validator.validate(known, 'task')
   print('schema OK')
   PY
   ```

   **Then** it prints `schema OK` and exits 0 — the Shell-written frontmatter still satisfies `forge-lib/schemas/task.json` for every schema-known field. (The unknown keys are filtered before validating because the task schema sets `additionalProperties: false`; preserving them verbatim is the Shell's round-trip contract, verified in step 3 and AT-PR1.10, not the schema's. forge-lib has no standalone `task validate` subcommand, so the schema is exercised via its `core.validator` entry point directly.)

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR1.2 — Modal P1 priority save works and round-trips the file

**Verifies:** WP1 acceptance criterion "Modal priority save" — the legacy modal-save throw on priority is fixed, and a modal save is as round-trip-safe as a drag.

**Runtimes:** Tauri, Chrome FSA, Server (Server required; Chrome FSA and Tauri spot-check per the smoke checklist).

**Setup:** fixture as section setup; AT-PR1.1 may have run first (status may be In Progress — irrelevant here).

1. **Given** the card "Fixture with parent" is visible on the board,
2. **When** you open its edit modal (pencil icon), set Priority to "P1 – Critical", and click Save,
3. **Then** a "Task saved successfully" toast appears — and **no** error toast starting "Cannot save task: invalid priority" appears,
4. **Then** after ~2s, `grep '^priority:' "$FIX/tasks/task-101-fixture.md"` prints exactly `priority: 1` (integer, unquoted),
5. **Then** `grep -E '^(parent|source|custom_field):' "$FIX/tasks/task-101-fixture.md"` still prints all three lines unchanged, and `grep -E '^(creator|dependencies|external_link|external_id):' "$FIX/tasks/task-101-fixture.md"` prints nothing.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR1.3 — Quote-normalization churn happens exactly once; second save is byte-stable

**Verifies:** the serializer's "titles are always double-quoted" rule plus the round-trip property that serialize∘parse is idempotent byte-for-byte on its own output — a legacy file is normalized on its first UI save, and never churns again.

**Runtimes:** Server (the parse/serialize path is runtime-independent; cross-runtime write plumbing is already covered by AT-PR1.1).

**Setup:** fixture as section setup — uses `task-103-legacy.md`, whose title is unquoted (`title: Plain title`).

1. **Given** the card "Plain title" is visible in the **In Progress** column,
2. **When** you open its edit modal (pencil icon), change nothing, and click Save, then wait ~2s,
3. **Then** the file is normalized once: `grep '^title:' "$FIX/tasks/task-103-legacy.md"` prints `title: "Plain title"` (now double-quoted), `updated:` is today, `tags: [ui, board]` is still inline style, and `creator: null` / `dependencies: []` / `external_link: null` / `external_id: null` are still present in place (they were in the original file, so they legitimately remain),
4. **When** you record the checksum: `shasum "$FIX/tasks/task-103-legacy.md"`,
5. **When** you open the same modal again, change nothing, click Save, and wait ~2s,
6. **Then** `shasum "$FIX/tasks/task-103-legacy.md"` prints the identical checksum — the second save is byte-for-byte stable (no repeated churn).

**Pass:** [ ] Server

### AT-PR1.4 — Parent chip on cards: story parent deep-links, task parent opens local modal, no chip without parent

**Verifies:** WP1 acceptance criterion "Parent chip (card)" — the chip renders only when a parent exists, navigates by parent type, and never opens the task's own modal.

**Runtimes:** Tauri, Chrome FSA, Server (Server required; Chrome FSA and Tauri spot-check per the smoke checklist).

**Setup:** fixture as section setup.

1. **Given** the Tasks board is rendered,
2. **Then** "Fixture with parent" shows a chip (sitemap icon) reading `story-001-notification-template-builder` — extensionless, no `.md`; "Child of a task" shows a chip reading `task-101-fixture`; "Plain title" (no `parent:` key) shows **no** chip,
3. **When** you click the `story-001-notification-template-builder` chip,
4. **Then** the shell switches to Product Forge and reveals/flashes the "Notification Template Builder" card — and the task's own edit modal does **not** open. (If Product Forge cannot resolve the card, its own "Card not found in Product Forge" toast is acceptable wiring proof — but with this fixture the card should resolve.)
5. **When** you return to the Tasks view and click the `task-101-fixture` chip on "Child of a task",
6. **Then** the local edit modal opens showing "Fixture with parent" — no plugin switch.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR1.5 — Modal Parent row is read-only, navigates, and can never be dropped by a save

**Verifies:** WP1 acceptance criterion "Parent chip (modal)" — the modal shows parent as display-only, Preview Changes never lists it, and saving preserves it.

**Runtimes:** Server (modal markup and save path are runtime-independent; card-level chip behavior is covered cross-runtime by AT-PR1.4).

**Setup:** fixture as section setup.

1. **Given** you open the edit modal for "Fixture with parent" (pencil icon),
2. **Then** a read-only row labeled "Parent" sits above the Body textarea, containing a chip reading `story-001-notification-template-builder`; it is a display-only button, not an editable form field,
3. **When** you click that Parent chip,
4. **Then** the modal closes and the shell switches to Product Forge (same destination as AT-PR1.4 step 4),
5. **When** you return to Tasks, reopen the modal, and click "Preview Changes" without editing anything,
6. **Then** no `parent` row appears in the diff,
7. **When** you click Save and wait ~2s,
8. **Then** `grep '^parent:' "$FIX/tasks/task-101-fixture.md"` still prints `parent: story-001-notification-template-builder`,
9. **Given** you open the edit modal for "Plain title" (which has no parent), **then** no "Parent" row appears at all.

**Pass:** [ ] Server

### AT-PR1.6 — Honest drag: whole-column highlight in both themes, no insertion line, same-column drop writes nothing

**Verifies:** WP1 acceptance criteria "Drag honesty" and the `DRAG-DROP`/ghost-CSS static checks — the fake insertion line is gone, the new `.prod-col-drag-over` highlight behaves, Escape clears it, and a same-column drop is a no-op.

**Runtimes:** Tauri, Chrome FSA, Server (Server required; Chrome FSA and Tauri spot-check per the smoke checklist). The static grep steps (8–9) run once against the checked-out branch, not per runtime.

**Setup:** fixture as section setup.

1. **Given** the Tasks board is rendered in the light theme,
2. **When** you pick up any card and drag it slowly across each column without dropping,
3. **Then** the **whole column** under the pointer gets an accent ring and light background tint (class `prod-col-drag-over` on the `.prod-column` element — verify in DevTools if unsure); exactly **one** column is highlighted at a time; **no** thin horizontal insertion line ever appears between cards,
4. **When** you toggle dark mode (theme switch in the shell) and repeat the drag,
5. **Then** the highlight tint is clearly visible in dark mode too,
6. **When** you start a drag and press Escape (cancelling it), **then** the highlight clears; when you drag out of a column without dropping (dragleave), **then** that column's highlight clears,
7. **When** you record `stat -f %m "$FIX/tasks/task-102-child.md"`, drag "Child of a task" and drop it back into its **own** column, wait 2s, and re-run the `stat` command, **then** the mtime is unchanged — no file write, and no "Moved to" pill appears,
8. **When** you drop the same card into a **different** column, **then** the pill "Moved to …" appears followed by "Saved", and the file's `status:` changes on disk,
9. **Then** from `forge-shell/` on the PR branch: `grep -c 'DRAG-DROP' app/js/tasks.js` prints `0`; `grep -n 'getDropPosition\|showDropIndicator\|prod-drop-indicator' app/js/tasks.js` prints nothing; and `grep -n 'prod-drop-indicator\|prod-cards.prod-drag-over' app/css/productivity.css` shows both ghost rule groups still present (untouched — their deletion belongs to a later PR).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR1.7 — Legacy invalid status/priority values surface console warnings with the filename

**Verifies:** WP1 design: `parseTaskFile` keeps invalid values raw and records warnings, and the board load logs each warning via `console.warn` with the `[forge-shell]` prefix and the source filename.

**Runtimes:** Server (console output is runtime-independent; DevTools is readily available here).

**Setup:** fixture as section setup — uses `task-104-invalid.md` (`status: WIP`, `priority: 3abc`).

1. **Given** DevTools console is open (filter on `forge-shell`),
2. **When** you select the fixture project (or reload the Tasks view so task files re-parse),
3. **Then** the console shows both warnings, each ending with the filename:
   - `[forge-shell] Invalid status "WIP". Valid: Open, In Progress, Blocked, Completed, Cancelled. File: task-104-invalid.md`
   - `[forge-shell] Invalid priority "3abc". Valid: 1-5 or null. File: task-104-invalid.md`
4. **Then** the board itself still loads normally (the other four fixture cards render; no uncaught errors in the console).

**Pass:** [ ] Server

### AT-PR1.8 — Write failure surfaces the save-failed pill and leaves the file untouched (negative path)

**Verifies:** the drag save path's error surface is unchanged by the rewiring — a failed write shows the legacy `Save failed:` status pill and the file on disk keeps its old content.

**Runtimes:** Tauri, Server (write failure forced via `chmod`, per the suite conventions; the Chrome FSA DevTools write-stub belongs to a later PR's gate and is not used here).

**Setup:** fixture as section setup, then make the target file unwritable:

```bash
chmod 000 "$FIX/tasks/task-102-child.md"
```

1. **Given** "Child of a task" is visible on the board and its file is `chmod 000`,
2. **When** you drag the card to a different column and wait ~2s,
3. **Then** the status pill "Moved to …" appears first, then a pill beginning `Save failed: ` (the message tail is the runtime's write error — any text is acceptable after the prefix); no "Saved" pill appears,
4. **Then** `sudo cat "$FIX/tasks/task-102-child.md"` (or `chmod 644` first, then `cat`) shows the file's `status:` is unchanged on disk. The card may still sit in the target column in the UI — in-memory rollback ships in a later PR and is not part of this gate,
5. **When** you restore permissions with `chmod 644 "$FIX/tasks/task-102-child.md"` and drag the card again,
6. **Then** the save succeeds ("Saved" pill) and the file's `status:` updates.

**Pass:** [ ] Tauri [ ] Server

### AT-PR1.9 — Regression: analytics tabs render unchanged and external-change detection still works after UI saves

**Verifies:** pre-existing behavior that PR1 must not break — the Timeline/Summary/Workload/Matrix views, and the 5-second external-change detection cycle (a UI save must not blind it to later out-of-band edits).

**Runtimes:** Tauri, Chrome FSA, Server for steps 1–2 (Server required, others optional per the smoke checklist); steps 3–5 required on Tauri per the smoke checklist and worth running everywhere the 5 s poll cycle exists (all three runtimes).

**Setup:** fixture as section setup; run after at least one successful UI save (e.g. AT-PR1.1).

1. **When** you click each board-toolbar view button in turn — Timeline, Summary, Workload, Matrix,
2. **Then** each view renders populated with the fixture tasks, exactly as on `main` before this PR (no blank panes, no uncaught console errors),
3. **Given** you return to the board view and have just completed a successful UI save (drag or modal),
4. **When** you edit a task file out-of-band from a terminal, e.g. `sed -i '' 's/^title: "Child of a task"/title: "Child renamed"/' "$FIX/tasks/task-102-child.md"`, and wait up to ~6s (one 5-second detection cycle),
5. **Then** the board re-renders on its own and the card now reads "Child renamed" — external-change detection still works after UI saves.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR1.10 — Unknown-key fidelity: trailing comment and multiline unknown block survive an inline title edit byte-identical

**Verifies:** WP1 acceptance criterion "Unknown-key fidelity" — a made-up scalar key with a trailing comment (`custom_field: keep-me  # trailing comment`) and a multiline unknown block (`custom_meta:` + two indented lines) survive an inline title edit byte-identical and in original position.

**Runtimes:** Server (required); Chrome FSA and Tauri optional spot-checks. Run last within the PR1 gate (it renames the fixture task other scenarios reference by title, then restores it).

**Setup:** fixture as section setup; `task-101-fixture.md` untouched apart from prior scenarios' `status`/`priority`/`updated` writes.

1. **Given** you record the fixture's title-and-updated-independent content hash:

   ```bash
   grep -v '^title:' "$FIX/tasks/task-101-fixture.md" | grep -v '^updated:' | shasum
   ```

2. **When** you inline-edit the card's title on the board (double-click the title, type `Fixture with parent (renamed)`, press Enter) and wait ~2s for the debounced save,
3. **Then** the file's title line is `title: "Fixture with parent (renamed)"`, and re-running the step-1 command prints the **identical hash** — every other byte of the file survived, including:
   - `custom_field: keep-me  # trailing comment` — comment preserved verbatim, still on the line after `source:`
   - the `custom_meta:` block with its two indented lines (`  reviewer: alice` / `  notes: keep this block`), byte-identical and still between `custom_field:` and `created:`.
4. **When** you inline-edit the title back to `Fixture with parent` and wait ~2s,
5. **Then** the step-1 command still prints the identical hash — unknown-key preservation is stable across repeated edits, not a one-shot.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

---

## PR2 gate — Unified markdown renderer: MDHelpers (tables + safe links), memory on shared renderer

Merging PR2 must prove that the shell has exactly one markdown renderer and that it is safe: the new `MDHelpers` module (behind the unchanged `ForgeUtils.MD` API) renders pipe tables as real tables and neutralizes hostile input (raw HTML entity-escaped, link hrefs whitelisted to `http(s)://`, `mailto:`, `#`, and relative paths — `javascript:`/`data:` links degrade to plain text) in every consumer view; memory's three unstructured-markdown surfaces (Overview fallback, per-file fallback, directory-file modal) now render through it inside `.rendered-body` containers; the roadmap drawer excerpt is markdown-stripped plain text with no HTML injection; and nothing else changed — the four pre-existing `.rendered-body` views (Product Forge detail, Cognitive session, Report, Rovo agent) render as before except that pipe tables in their bodies now render as tables, memory's structured-content path is untouched, and the tasks edit-modal diff preview still shows raw source. Prerequisite before running this gate: `cd forge-shell && npm test` is green, including the 36 new `test/md.helpers.test.js` renderer tests.

**Setup**

````bash
PROJ="$(mktemp -d)/pr2-fixture" && mkdir -p "$PROJ"
mkdir -p "$PROJ/memory/fixtures" "$PROJ/cards/initiatives" "$PROJ/sessions/debates" \
         "$PROJ/reports" "$PROJ/rovo-agents/render-check-agent" "$PROJ/tasks"
# Card fixtures MUST live under cards/initiatives/ — CardData.scanCardsDir only
# scans the seven expected cards/ subdirectories and never loads root-level files,
# so a root-placed card would be invisible to Product Forge and Roadmap.

# Memory fallback fixture — copied from the implementation plan's own browser
# verification, extended with the WP7 fence + attribute-injection payloads.
# Deliberately avoids "**Key:**" field lines, "## " sections, and
# plain |---| separators (uses ### and |:-----|) so memory's structured-content
# detector routes it to the fallback renderer instead of the flat-tables path
# (fenced code and links do not trigger the structured-content detector).
cat > "$PROJ/memory/render-fixture.md" <<'EOF'
Team working agreements captured during onboarding. PRs stay **small**.

### Conventions

| Area | Rule |
|:-----|:-----|
| Commits | Conventional messages |
| Reviews |  |

- Keep PRs focused
- [Style guide](https://example.com/style)
- [hostile](javascript:alert(1))
- [inject](https://a" onmouseover="alert(2))

```
**not bold inside a fence**
```
EOF
cp "$PROJ/memory/render-fixture.md" "$PROJ/memory/fixtures/render-fixture.md"

# Paragraph-join semantics fixture (also unstructured on purpose).
cat > "$PROJ/memory/paragraph-fixture.md" <<'EOF'
First line of the intro.
Second line continues the same thought.

A second paragraph after the blank line.
EOF

# Hostile-input fixture (unstructured on purpose — same marker rules as above).
cat > "$PROJ/memory/hostile-fixture.md" <<'EOF'
Raw markup below must render as visible text, never execute.

<script>alert('memory-script')</script>

<img src=x onerror=alert('memory-img')>

- List item with <div onclick="alert('memory-div')">hi</div>
- [hostile link](javascript:alert('memory-link'))
- [data link](data:text/html;base64,PHNjcmlwdD4)
EOF

# Structured memory fixture — MUST route to memory's untouched flat-tables path
# ("**Key:**" field line, "## " section, plain |---| separator all present).
cat > "$PROJ/memory/structured-fixture.md" <<'EOF'
**Owner:** Jeremy

## Conventions

| Area | Rule |
|---|---|
| Commits | Conventional |
EOF

# Unstructured root CLAUDE.md so the memory Overview tab takes the fallback path.
cat > "$PROJ/CLAUDE.md" <<'EOF'
Project working notes for the PR2 acceptance fixture. Everything here stays deliberately loose.

### Fixture notes

| Check | State |
|:-----|:-----|
| Overview fallback | rendered |
| Empty cell |  |

- [Docs](https://example.com/docs)
EOF

# Product Forge card with hostile table cells + a lone pipe row (no separator).
cat > "$PROJ/cards/initiatives/hostile-table-initiative.md" <<'EOF'
---
type: initiative
title: Hostile Table Initiative
status: active
created: 2026-07-16
---
Cells below carry hostile payloads and must render inert.

| Payload | Link |
|---|---|
| <script>alert('pf-cell')</script> | [click](javascript:alert('pf-link')) |

<img src=x onerror=alert('pf-img')>

| not | a table |
plain text right after the lone pipe row.
EOF

# Markdown-heavy initiative for the roadmap drawer excerpt.
cat > "$PROJ/cards/initiatives/markdown-heavy-initiative.md" <<'EOF'
---
type: initiative
title: Markdown Heavy Initiative
status: active
created: 2026-07-16
---
## Goal
**Key:** value pairs should not leak markdown tokens.

See the [style guide](https://example.com/style) and run `npm test`.

```js
const hidden = 'code contents must not appear in the excerpt';
```

<script>alert('drawer')</script>
EOF

# Shared regression body for the four pre-existing .rendered-body views.
# Includes the WP7 fidelity + XSS payloads: emphasis markers inside a fence,
# and a quote-in-URL link attempting attribute injection.
cat > "$PROJ/.render-check-body" <<'EOF'
### Sections

**bold** text, *emphasis*, `code`, and a [docs link](https://example.com/docs).

| Col A | Col B |
|---|---|
| one |  |

- bullet one
- bullet two
- [inject](https://a" onmouseover="alert(2))

> quoted line

```
**not bold inside a fence**
```
EOF

{ printf -- '---\ntype: initiative\ntitle: Render Check Initiative\nstatus: active\ncreated: 2026-07-16\n---\n'; cat "$PROJ/.render-check-body"; } > "$PROJ/cards/initiatives/render-check-initiative.md"
{ printf -- '---\ntitle: Render Check Debate\ntype: debate\ncreated: 2026-07-16\n---\n'; cat "$PROJ/.render-check-body"; } > "$PROJ/sessions/debates/2026-07-16-render-check.md"
{ printf -- '---\ntitle: Render Check Report\nstatus: Final\ncreated: 2026-07-16\n---\n'; cat "$PROJ/.render-check-body"; } > "$PROJ/reports/2026-07-16-render-check.md"
{ printf -- '---\nname: Render Check Agent\nplatform: jira\n---\n'; cat "$PROJ/.render-check-body"; } > "$PROJ/rovo-agents/render-check-agent/agent.md"
rm "$PROJ/.render-check-body"

# Task fixture for the raw-diff regression.
cat > "$PROJ/tasks/task-001.md" <<'EOF'
---
id: task-001
title: Render check task
status: todo
created: 2026-07-16
---
Original body line with **markers** kept raw in the diff.
EOF

echo "Fixture project: $PROJ"
````

Point each runtime at `$PROJ` (native picker in Tauri, FSA picker in real Chrome, typed path in Server mode). Delete the fixture directory after the gate.

### AT-PR2.1 — Memory per-file tab renders table, heading, bold, and safe link through the shared renderer

**Verifies:** WP7 — memory's per-file fallback surface uses the shared hardened renderer inside `.rendered-body`; pipe tables, `###` headings, and real anchors (memory previously showed links as literal text); paragraph semantics now join consecutive lines.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the app is open on the fixture project and the **Memory** view is selected.
2. **When** you click the **Render Fixture** file tab.
3. **Then** the "Conventions" table renders as a real styled table — no literal `|` pipes — and the "Reviews" row's empty second cell keeps the two-column alignment (the empty cell is present, columns do not shift).
4. **Then** "Conventions" displays as a real heading, and "small" in the intro sentence is bold.
5. **Then** "Style guide" is a clickable link; inspect it in DevTools and confirm the anchor has `target="_blank" rel="noopener"`.
6. **Then** in DevTools, the container wrapping the rendered content carries the class `rendered-body`, and no element in the view carries `prod-markdown-content`.
7. **When** you click the **Paragraph Fixture** file tab.
8. **Then** "First line of the intro." and "Second line continues the same thought." display as one paragraph (DevTools: a single `<p>` containing both lines joined by a space), and "A second paragraph after the blank line." is a separate paragraph.
9. *Note (non-blocking, per plan):* in Tauri, optionally click the "Style guide" link and record whether it opens externally — this exercises pre-existing `target="_blank"` handling and is note-only, not a blocker.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.2 — Memory directory-file modal and Overview fallback render identically

**Verifies:** WP7 — the remaining two memory fallback surfaces (directory-file modal, Overview CLAUDE.md fallback) render through the same shared pipeline.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the **Memory** view is open on the fixture project.
2. **When** you open the **fixtures** directory and click its `render-fixture.md` file.
3. **Then** the modal shows the same rendered result as AT-PR2.1 steps 3–5 (styled table with empty-cell alignment, real heading, bold, real "Style guide" anchor) **above** the raw-markdown edit box, and the rendered block's container carries `rendered-body`.
4. **When** you close the modal and click the **Overview** tab.
5. **Then** the fixture CLAUDE.md content renders through the same pipeline: "Fixture notes" as a real heading, the "Check / State" table as a styled table whose empty "Empty cell" value keeps column alignment, and "Docs" as a real anchor with `target="_blank" rel="noopener"`.
6. **Then** the console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.3 — Hostile markdown renders inert in memory (negative)

**Verifies:** WP7 XSS hardening — raw HTML entity-escaped in every block type; `javascript:` and `data:` links degrade to plain text with the URL dropped.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the **Memory** view is open on the fixture project, DevTools console open.
2. **When** you click the **Hostile Fixture** file tab.
3. **Then** no alert dialog appears at any point during this scenario.
4. **Then** the text `<script>alert('memory-script')</script>` is visible on screen as literal text; DevTools Elements search finds no live `<script>` element containing `memory-script`.
5. **Then** the `<img src=x onerror=...>` line shows as literal text — no broken-image icon, and no `<img>` element in the rendered container.
6. **Then** the list item shows the `<div onclick=...>` markup as literal text; no element in the container has an `onclick` attribute.
7. **Then** "hostile link" and "data link" render as plain text — no `<a>` element for either; searching the rendered container's HTML in DevTools finds no occurrence of `javascript:` and no `data:text/html`.
8. **Then** back in AT-PR2.1's **Render Fixture** tab, the "hostile" list item likewise renders as plain text with no anchor.
9. **Then** the console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.4 — Product Forge detail: tables render, hostile cells inert, lone pipe row stays a paragraph (negative)

**Verifies:** WP7 — pipe-table support and XSS hardening reach the pre-existing `ForgeUtils.MD.render` consumers with zero call-site changes; a `|…|` row **not** followed by a separator row must not become a table (false-positive guard for existing content).
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the **Product Forge** view is open on the fixture project, DevTools console open.
2. **When** you click the card titled **Hostile Table Initiative** to open its detail panel.
3. **Then** the "Payload / Link" table renders as a real styled table inside the detail body.
4. **Then** the first body cell shows `<script>alert('pf-cell')</script>` as literal text (entity-escaped — no live script element), and no alert dialog appears.
5. **Then** the second body cell shows "click" as plain text — no `<a>` element, no `javascript:` anywhere in the rendered container's HTML.
6. **Then** the `<img src=x onerror=...>` paragraph shows as literal text with no `<img>` element.
7. **Then** the line `| not | a table |` and "plain text right after the lone pipe row." render together as an ordinary paragraph — exactly one `<table>` element exists in the detail body.
8. **Then** the console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.5 — Regression: four pre-existing `.rendered-body` views unchanged, except pipe tables now render

**Verifies:** WP7 — the `ForgeUtils.MD` → `MDHelpers` delegate preserves output for the four existing consumer views; the only visible change is that pipe-table bodies now render as tables.
**Runtimes:** Tauri (check all four views), Chrome FSA (spot-check at least one), Server (spot-check at least one).
**Setup:** fixture as section setup — the same body is planted in all four data dirs.

1. **Given** the app is open on the fixture project.
2. **When** you open, in turn: **Product Forge** → card "Render Check Initiative"; **Cognitive Forge** → session "Render Check Debate"; **Report Forge** → report "Render Check Report"; **Rovo Agent Forge** → agent "Render Check Agent". (In Chrome FSA and Server, at least one of the four suffices.)
3. **Then** in each detail body: "Sections" renders as a heading; bold / emphasis / inline code render; "docs link" is a real anchor with `target="_blank" rel="noopener"`; the two bullets render as a list; "quoted line" renders as a blockquote — all identical to the same fixture rendered on `main` before this PR.
4. **Then** the "Col A / Col B" block — which rendered as literal pipe-text paragraphs before this PR — now renders as a styled table, with the empty "Col B" body cell keeping the two-column alignment.
5. **Then** no console errors in any of the views visited.

**Pass:** [ ] Tauri (all four) [ ] Chrome FSA (≥1 view) [ ] Server (≥1 view)

### AT-PR2.6 — Regression: structured memory file still routes to the untouched flat-tables path

**Verifies:** WP7 — only memory's *fallback* surfaces moved to the shared renderer; files with structured content (field lines, `##` sections, plain `|---|` tables) keep the pre-existing structured rendering.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the **Memory** view is open on the fixture project.
2. **When** you click the **Structured Fixture** file tab.
3. **Then** the file renders through memory's structured presentation exactly as it does on `main` — the "Owner: Jeremy" field and the "Conventions" section content appear in memory's flat-table layout, not as free-flowing markdown prose.
4. **Then** in DevTools, this file's rendered content is **not** wrapped in a `rendered-body` container (the shared-renderer container class from AT-PR2.1 step 6).
5. **Then** the console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.7 — Roadmap drawer excerpt is clean, escaped prose and stays excerpt-only

**Verifies:** WP7 — `_descriptionExcerpt` runs the body through the plain-text stripper before truncation; markdown tokens no longer leak; output is escaped downstream so no HTML injection; the drawer does not gain full markdown rendering.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup — "Markdown Heavy Initiative" has no `description` frontmatter, so the excerpt is derived from the body.

1. **Given** the **Roadmap** view is open on the fixture project, DevTools console open.
2. **When** you locate the card **Markdown Heavy Initiative** (having no schedule fields, it sits in the unscheduled area) and click it to open the detail drawer.
3. **Then** the Description excerpt reads as clean prose beginning "Goal Key: value pairs should not leak markdown tokens." — it contains no `#`, no `*`, no backtick, and no `[]()` tokens; the link appears only as its text "style guide".
4. **Then** the fenced code block's contents ("code contents must not appear in the excerpt") are absent from the excerpt.
5. **Then** the text `<script>alert('drawer')</script>` appears in the excerpt as visible literal text, and no alert dialog appears (excerpt output is escaped, not injected as HTML).
6. **Then** the drawer still shows only the excerpt plus the "Open in Product Forge" button — no rendered headings, tables, or lists from the full body.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR2.8 — Regression: tasks edit-modal diff preview still shows raw markdown source

**Verifies:** WP7 decision — tasks.js is deliberately untouched (its body is only ever edited in a textarea, never displayed read-only); the body diff preview must keep showing raw source, not rendered markdown.
**Runtimes:** any one of Tauri / Chrome FSA / Server (identical pure-JS path; per the plan's smoke checklist, one runtime suffices).
**Setup:** fixture as section setup.

1. **Given** the **Tasks** view is open on the fixture project and the task "Render check task" is visible.
2. **When** you open that task's edit modal, and in the body textarea confirm the existing line shows its literal `**markers**`.
3. **When** you add a new line `**new bold** line` to the body and proceed to the change/diff preview.
4. **Then** the body-changes diff shows the added line as raw source — `**new bold** line` with literal asterisks and an added-line marker — and no `<strong>`/bold rendering appears anywhere in the diff.
5. **When** you cancel without saving.
6. **Then** the task is unchanged.

**Pass:** [ ] any one runtime

### AT-PR2.9 — Tauri watcher: editing a memory fixture on disk live-refreshes the rendered view

**Verifies:** WP7 — the shared renderer sits correctly inside memory's existing refresh path; the native file watcher (Tauri-only freshness source) re-renders fallback content on disk change.
**Runtimes:** Tauri only (the file watcher exists only in the desktop runtime).
**Setup:** fixture as section setup; keep a terminal open with `$PROJ` set.

1. **Given** the Tauri app is open on the fixture project with the **Memory** view showing the **Render Fixture** file tab (rendered as in AT-PR2.1).
2. **When** you append to the file from the terminal without touching the app:

   ```bash
   printf '\nNew paragraph added while watching.\n' >> "$PROJ/memory/render-fixture.md"
   ```

3. **Then** within a few seconds, and without clicking any refresh control, the memory view updates and "New paragraph added while watching." appears as a rendered paragraph below the existing content.
4. **Then** the previously verified rendering is intact after the refresh: styled table with empty-cell alignment, real "Style guide" anchor, "hostile" still plain text with no anchor.
5. **Then** the console shows no errors.

**Pass:** [ ] Tauri

---

## PR3 gate — Overlay dismissal contract: keyboard-complete Confirm, Escape/backdrop for tasks, memory, rovo

Merging PR3 must prove three things. First, the shared `ForgeUtils.Confirm` dialog is now keyboard-complete and truly modal: Escape cancels, Enter confirms except when focus sits on a button or textarea, Tab is trapped inside `#confirm-dialog`, initial focus lands on the Cancel button (or an `[autofocus]` field in the details HTML), prior focus is restored on close, no key reaches any view handler while the dialog is up, and the dialog stacks at z-index 1300 above every view overlay — all inherited by the existing consumers (server-mode folder picker, product-forge reparent/unparent, tasks delete) with zero call-site changes. Second, the tasks, rovo, and memory overlays gain contract-conformant dismissal: a per-view document-level Escape handler that survives view switches (fixing the bug that permanently killed Cmd+F/Escape in Tasks after navigating away and back, and the memory bug where Escape never fired when focus was on `body`), an explicit Tasks Escape hierarchy (edit modal > settings > search, one surface per press), and pointerdown-guarded backdrop click on all four overlays. Third, scoped-out behavior is unchanged: memory's delete prompt is still the native `window.confirm`, and `product-forge.js`, `roadmap.js`, `roadmap.css`, `product-forge.css` have zero diff. Prerequisites before running scenarios: `cd forge-shell && npm test` green (including the 11 tests this PR adds: 10 ModalHelpers + 1 Confirm source guard), and `git diff ux-program/pr-2-markdown-renderer...HEAD --stat -- app/js/product-forge.js app/js/roadmap.js app/css/roadmap.css app/css/product-forge.css app/css/productivity.css` prints nothing.

**Setup**

```bash
# Disposable fixture project — never point this gate at a real project.
FIXTURE="$(mktemp -d)"
mkdir -p "$FIXTURE/tasks" "$FIXTURE/memory" "$FIXTURE/rovo-agents/ticket-triage-agent"

cat > "$FIXTURE/tasks/task-001.md" <<'EOF'
---
title: "Disposable delete target"
type: task
status: Open
priority: medium
assignee: null
due_date: null
tags:
  - accept
parent: null
created: 2026-07-16
updated: 2026-07-16
---

## Description

Delete me during the Confirm keyboard scenario. Nothing references this task.
EOF

cat > "$FIXTURE/tasks/task-002.md" <<'EOF'
---
title: "Edit modal host - keep me"
type: task
status: In Progress
priority: high
assignee: null
due_date: null
tags:
  - accept
parent: null
created: 2026-07-16
updated: 2026-07-16
---

## Description

Open my edit modal for the Escape-hierarchy and backdrop scenarios. This
paragraph exists so a text selection can be started inside the edit
textarea and dragged out over the backdrop.
EOF

cat > "$FIXTURE/CLAUDE.md" <<'EOF'
# Fixture project memory root
EOF

cat > "$FIXTURE/memory/project-alpha.md" <<'EOF'
---
name: "Project Alpha"
type: project
description: "Fixture memory file for the overlay dismissal gate."
status: active
people:
  []
importance: 45
lifecycle_status: trusted
source: frontmatter
last_recalled: 2026-07-16
recall_count: 0
created: 2026-07-16
updated: 2026-07-16
---

Fixture body. Long enough to start a text selection inside the file
modal's edit textarea and release it over the backdrop.
EOF

cat > "$FIXTURE/rovo-agents/ticket-triage-agent/agent.md" <<'EOF'
---
name: "Ticket Triage Agent"
platform: rovo
description: "Fixture agent for the overlay dismissal gate."
status: draft
skills:
  []
knowledge_sources:
  []
conversation_starters:
  []
owner: null
created: 2026-07-16
updated: 2026-07-16
---

## Instructions

Fixture instructions body. Long enough to select text inside the edit
modal and drag the selection out over the backdrop.
EOF

echo "Fixture project: $FIXTURE"
```

Launch the runtime per the How-to-run table, select `$FIXTURE` as the project folder, and keep DevTools open in Chrome scenarios — several steps drive the shared dialog from the console exactly as the implementation plan's browser verifications do.

### AT-PR3.1 — Confirm keyboard contract: Escape cancels, Tab is trapped, Enter in an input confirms, details survive resolve

**Verifies:** WP6 — rebuilt `ForgeUtils.Confirm` keyboard semantics and the `ModalHelpers.confirmKeyAction` carve-outs, plus the load-bearing rule that `resolve()` never clears `#confirm-details`.
**Runtimes:** Chrome FSA, Server, Tauri (spot-check)
**Setup:** fixture as section setup; app open on the fixture project, DevTools console available.

1. **Given** the app is idle on any view, **when** you run this snippet in the console (copied from the plan's browser verification):

   ```js
   ForgeUtils.Confirm.show(
     'Keyboard check', 'Escape=false, Tab wraps, Enter in input=true',
     '<input id="kb-check" autofocus style="width:100%" />'
   ).then(v => console.log('resolved:', v, '| details readable after resolve:', document.getElementById('kb-check') !== null));
   ```

   **then** the shared dialog opens and the injected text input already has focus (the `autofocus` element is focused programmatically — no click needed).
2. **Given** the dialog is open with the input focused, **when** you press Escape, **then** the console prints `resolved: false | details readable after resolve: true` and the dialog closes.
3. **Given** you re-run the snippet, **when** you press Tab repeatedly, **then** focus cycles input → Cancel → Confirm → input and never leaves the dialog; **when** you press Shift+Tab repeatedly, **then** focus wraps the same ring in reverse.
4. **Given** the dialog is still open, **when** you press Enter while the text input is focused, **then** the console prints `resolved: true` (Enter in a non-button, non-textarea element confirms).
5. **Given** the dialog has closed, **when** you re-run the snippet a third time and click the Cancel button with the mouse, **then** exactly one new `resolved: false` line appears — every run of this scenario logs `details readable after resolve: true`.

**Pass:** [ ] Tauri (spot-check) · [ ] Chrome FSA · [ ] Server

### AT-PR3.2 — Destructive-safe default: bare Enter on the pre-focused Cancel cancels; focus ring visible; focus returns to the invoker

**Verifies:** WP6 — initial focus on Cancel for destructive confirms, the BUTTON carve-out (native Enter=click on the focused Cancel), the `:focus-visible` accent ring, and focus restoration to the previously focused element.
**Runtimes:** Chrome FSA
**Setup:** fixture as section setup; app open on the fixture project, DevTools console available.

1. **Given** the app is idle, **when** you run `ForgeUtils.Confirm.show('Destructive check', 'Bare Enter must cancel', '').then(v => console.log('resolved:', v))` in the console, **then** the dialog opens with the **Cancel** button focused and a visible accent-colored focus ring around it.
2. **Given** Cancel is focused, **when** you press Enter without touching anything else, **then** the console prints `resolved: false` — bare Enter activated the focused Cancel button, it did not confirm.
3. **Given** the dialog has closed, **when** you click a toolbar button in the current view (to give it keyboard focus), re-run the snippet, and close the dialog with Escape, **then** focus returns to that same toolbar button (verify with `document.activeElement` in the console or by pressing Enter and seeing the toolbar button activate).

**Pass:** [ ] Chrome FSA

### AT-PR3.3 — Task delete driven entirely by keyboard through the shared Confirm

**Verifies:** WP6 — the tasks `deleteTask` consumer inherits the new keyboard contract with zero call-site changes: Escape and Enter-on-Cancel both abandon the delete; Tab-to-Confirm + Enter performs it.
**Runtimes:** Chrome FSA, Server, Tauri (spot-check)
**Setup:** fixture as section setup; Tasks view open on the fixture project showing task-001 ("Disposable delete target") and task-002.

1. **Given** the Tasks view shows both fixture tasks, **when** you click the delete icon on the task-001 card, **then** the shared styled confirmation dialog opens (not a native browser popup) with the Cancel button focused.
2. **Given** the dialog is open, **when** you press Escape, **then** the dialog closes and task-001 is still on the board; `ls "$FIXTURE/tasks"` still lists `task-001.md`.
3. **Given** you trigger the same delete again, **when** you press Enter with the pre-focused Cancel button (no Tab first), **then** the dialog closes and the task is still NOT deleted.
4. **Given** you trigger the delete a third time, **when** you press Tab until the Confirm button is focused and then press Enter, **then** the dialog closes, the task-001 card disappears from the board, and `ls "$FIXTURE/tasks"` no longer lists `task-001.md`.
5. **Given** the delete completed, **when** you look at task-002, **then** it is untouched.

**Pass:** [ ] Tauri (spot-check) · [ ] Chrome FSA · [ ] Server

### AT-PR3.4 — Confirm is truly modal and stacks at z-1300 above the tasks overlays

**Verifies:** WP6 — capture-phase key interception (no view handler fires under an open Confirm) and the documented stacking ceiling: `#confirm-dialog` at z-index 1300 renders above the z-150 tasks overlays.
**Runtimes:** Chrome FSA
**Setup:** fixture as section setup; Tasks view open on the fixture project, DevTools console available.

1. **Given** the Tasks view is active, **when** you press Cmd/Ctrl+F, **then** the search strip opens; type a few characters into it so a filter is visibly applied.
2. **Given** the search strip is open with a filter, **when** you open a Confirm from the console (`ForgeUtils.Confirm.show('Keyboard check', 'Escape=false, Tab wraps, Enter in input=true', '')`) and press Cmd/Ctrl+F while the dialog is up, **then** nothing happens to the search strip — the shortcut is dead while a Confirm is visible.
3. **Given** the dialog is still open, **when** you press Escape, **then** only the dialog closes: the search strip is still open and the typed filter text is intact (Escape did not leak to the tasks view handler).
4. **Given** the dialog has closed, **when** you open task-002's edit modal (click the card's edit/pen icon) and then open a Confirm from the console again, **then** the Confirm renders visually **above** the edit overlay and is fully interactable; close it with Escape and the edit modal is still open underneath.
5. **Given** any state, **when** you run `getComputedStyle(document.getElementById('confirm-dialog')).zIndex` in the console, **then** it returns `"1300"`.

**Pass:** [ ] Chrome FSA

### AT-PR3.5 — Tasks Escape hierarchy: edit modal > settings > search, exactly one surface per press

**Verifies:** WP6 — the canonical `bindKeyboard()` Escape hierarchy via `ModalHelpers.tasksEscapeTarget`, and Cmd/Ctrl+F toggling.
**Runtimes:** Chrome FSA, Server, Tauri (spot-check)
**Setup:** fixture as section setup; Tasks view open on the fixture project.

1. **Given** the Tasks view is active with nothing open, **when** you press Cmd/Ctrl+F, **then** the search strip opens; **when** you press it again, **then** it toggles closed. Re-open it and type a filter.
2. **Given** the search strip is open with a filter applied, **when** you press Escape, **then** the filters are cleared and the strip closes — both in one press.
3. **Given** you re-open the search strip and apply a filter, **when** you open task-002's edit modal (click the card's edit/pen icon) and press Escape once, **then** ONLY the edit modal closes — the search strip is still open and the filter text untouched.
4. **Given** the search strip is still open, **when** you press Escape a second time, **then** the filters clear and the strip closes.
5. **Given** nothing is open, **when** you open the "Field Visibility Settings" panel via the toolbar gear and press Escape, **then** the settings panel closes.
6. **Given** the settings panel is open AND the search strip is open, **when** you press Escape once, **then** only the settings panel closes (settings beats search); a second Escape then clears and closes search.

**Pass:** [ ] Tauri (spot-check) · [ ] Chrome FSA · [ ] Server

### AT-PR3.6 — Tasks keyboard survives view round-trips (lifecycle bug fixed) with no handler leaks

**Verifies:** WP6 — the fix for the latent lifecycle bug where `destroy()` permanently removed the tasks keydown handler: `bindKeyboard()` now rebinds on every activation, idempotently.
**Runtimes:** Chrome FSA, Server (step 4 is Chrome-only — it needs the DevTools `getEventListeners` console API)
**Setup:** fixture as section setup; app open on the fixture project.

1. **Given** the Tasks view is active and Cmd/Ctrl+F works, **when** you navigate to the Memory view and then back to Tasks via the sidebar, **then** Cmd/Ctrl+F still toggles the search strip (before this PR it was permanently dead after this round trip).
2. **Given** you are back on Tasks after the round trip, **when** you open the search strip, apply a filter, and press Escape, **then** filters clear and the strip closes — Escape also survived the round trip.
3. **Given** you are on Tasks, **when** you open task-002's edit modal and press Escape once, **then** it closes exactly once — no double-close, no console errors.
4. **Given** DevTools console is open (Chrome only), **when** you record `getEventListeners(document).keydown.length`, switch Tasks ↔ Memory five times, and read it again, **then** the count is identical — no leaked handlers accumulate.

**Pass:** [ ] Chrome FSA · [ ] Server (steps 1–3)

### AT-PR3.7 — Backdrop click closes all four overlays; text-selection drag-out never does

**Verifies:** WP6 — pointerdown-guarded backdrop dismissal on the tasks edit overlay, tasks settings overlay, rovo edit modal, and memory file modal; clicks inside content never close.
**Runtimes:** Chrome FSA, Server
**Setup:** fixture as section setup; app open on the fixture project.

1. **Given** task-002's edit modal is open (Tasks view, card edit/pen icon), **when** you click the dark backdrop outside the modal content, **then** the modal closes; **when** you re-open it and click inside the modal content (e.g. a label or field), **then** it stays open.
2. **Given** the edit modal is open again, **when** you press the mouse down inside the body textarea, drag to select some text, keep the button held, move the pointer out over the backdrop, and release there, **then** the modal stays open (the drag started inside content, so the guarded backdrop does not fire).
3. **Given** the "Field Visibility Settings" panel is open (toolbar gear), **when** you click its backdrop, **then** it closes; a click inside the panel does not close it.
4. **Given** the Rovo Agent Forge view is open with "Ticket Triage Agent" selected, **when** you open its edit modal, click the backdrop, **then** it closes; re-open, click inside the modal content, **then** it stays; re-open, drag a text selection from a modal field out over the backdrop and release, **then** it stays open.
5. **Given** the Memory view is open, **when** you click the "Project Alpha" file card to open its modal, click the backdrop, **then** it closes; re-open, drag a text selection from the modal's edit textarea out over the backdrop and release, **then** it stays open (before this PR, memory's unguarded backdrop closed on exactly this drag-out).

**Pass:** [ ] Chrome FSA · [ ] Server

### AT-PR3.8 — Rovo and Memory Escape: closes when open, no-ops when closed, survives round trips; Memory closes even with focus on `body`

**Verifies:** WP6 — new document-level `bindKeyboard()` in `rovo-agent-forge.js` and `memory.js`, including the fix for memory's view-scoped Escape that never fired on mouse-only opens, and the no-op negative path.
**Runtimes:** Chrome FSA
**Setup:** fixture as section setup; app open on the fixture project.

1. **Given** the Rovo Agent Forge view is open, **when** you select "Ticket Triage Agent", open its edit modal, and press Escape, **then** the modal closes — exactly once, no errors.
2. **Given** no rovo modal is open, **when** you press Escape, **then** nothing happens: no console errors, no view change (negative path).
3. **Given** you switch to another view and back to Rovo Agent Forge, **when** you open the edit modal again and press Escape, **then** it still closes exactly once per press — repeated open/close cycles never require two presses and never close twice (no duplicate handlers).
4. **Given** the Memory view is open and you have NOT touched the keyboard, **when** you click the "Project Alpha" file card with the mouse only and immediately press Escape, **then** the modal closes even though focus sat on `body` (before this PR this Escape was silently swallowed).
5. **Given** no memory modal is open, **when** you press Escape on the Memory view, **then** nothing happens.
6. **Given** you switch away from Memory and back, **when** you repeat step 4, **then** the modal still closes on a single Escape.

**Pass:** [ ] Chrome FSA

### AT-PR3.9 — Server-mode folder picker still works end-to-end through the rebuilt Confirm

**Verifies:** WP6 — the fs-adapter constraint: `resolve()` must not clear `#confirm-details`, because the picker reads the path input's value after the promise resolves; plus autofocus on the injected input, Enter-to-confirm from the input, and Escape behaving exactly like Cancel (AbortError path).
**Runtimes:** Server (required — this dialog only exists where `showDirectoryPicker` is unavailable: an embedded browser such as cmux, or any browser without the File System Access API)
**Setup:** fixture as section setup; launch `node server.js` from `forge-shell/` and open `http://127.0.0.1:4173` in a server-mode browser. Have the `$FIXTURE` path from the Setup block's `echo` on your clipboard.

1. **Given** the app shows no project (or any project), **when** you click "Select Project Folder", **then** the shared styled dialog opens titled "Select Project Folder" with a text path input that is already focused — you can type immediately without clicking.
2. **Given** the path input is focused, **when** you type the `$FIXTURE` absolute path and press Enter, **then** the dialog confirms (Enter in an input confirms — the input is not a button or textarea) and the fixture project loads: the Tasks view shows the fixture tasks. This proves the input's value was still readable after the promise resolved.
3. **Given** the project is loaded, **when** you open "Select Project Folder" again and press Escape, **then** the dialog closes and the app behaves exactly as if you had clicked Cancel: the previously loaded fixture project stays loaded and no error state appears (internally both paths raise the same AbortError).
4. **Given** the picker was just cancelled, **when** you open it a third time, **then** the path input renders and focuses again — repeated open/cancel/confirm cycles keep working (the details area was never wiped).

**Pass:** [ ] Server

### AT-PR3.10 — Regressions: memory delete is still the native `window.confirm`; each Confirm resolves exactly once

**Verifies:** WP6 scope-outs and the double-resolve guard — `memory.js`'s delete prompt is explicitly NOT migrated in this PR (that happens in PR5), and a resolved Confirm ignores further Escape presses.
**Runtimes:** Chrome FSA
**Setup:** fixture as section setup; app open on the fixture project, DevTools console available.

1. **Given** the Memory view is open, **when** you trigger delete on the "Project Alpha" file card, **then** the prompt is the **native browser confirm** popup (OS/browser-styled, not the app's styled dialog); **when** you dismiss it with its Cancel, **then** `memory/project-alpha.md` still exists in `$FIXTURE`. If this prompt appears as the styled in-app dialog, the PR has over-reached its scope — fail the gate.
2. **Given** the app is idle, **when** you run `ForgeUtils.Confirm.show('Keyboard check', 'Escape=false, Tab wraps, Enter in input=true', '').then(v => console.log('resolved:', v))` in the console and click the Cancel button, **then** exactly one `resolved: false` line prints.
3. **Given** the dialog has just closed via that Cancel click, **when** you press Escape, **then** no second `resolved:` line ever appears and no console error is thrown — the settled promise cannot resolve twice.
4. **Given** the same idle state, **when** you repeat steps 2–3 but settle the dialog with Escape first and then click where the buttons were, **then** still exactly one `resolved:` line per `show()` call.

**Pass:** [ ] Chrome FSA

---

## PR4 gate — Unified failure feedback: error-toast convention, rollback (writeTaskNow), scan-error banner

Merging PR4 must prove the severity-channel convention holds in the live views: every failed user-initiated write surfaces as a red error toast (6000 ms) — never the status pill — and every optimistic write either rolls back to its pre-edit snapshot (tasks board moves, inline edits, modal edits) or commits the in-memory cache only after the write succeeds (memory). Directory scans must surface unreadable files in a dismissible per-view banner instead of silently dropping them, and Product Forge must never treat a failed read as a deleted card. Success feedback must stay ambient: healthy saves show the pill, discrete creates/deletes show success toasts, and the old premature "Task saved successfully" toast must be gone. Prerequisite: `cd forge-shell && npm test` green, including `test/feedback.helpers.test.js`.

**Setup**

```bash
FIXTURE="$(mktemp -d)"
mkdir -p "$FIXTURE"/tasks "$FIXTURE"/memory/notes "$FIXTURE"/cards/initiatives "$FIXTURE"/cards/stories

cat > "$FIXTURE"/tasks/task-001.md <<'EOF'
---
title: "Original"
type: task
status: Open
priority: 2
assignee: jb
due_date: null
tags:
  - ui
dependencies:
  - task-002.md
parent: story-001-notification-template-builder.md
source: jira
created: 2026-07-01
updated: 2026-07-10
---

## Description

Fixture task for rollback checks.
EOF

cat > "$FIXTURE"/tasks/task-002.md <<'EOF'
---
title: "Second task"
type: task
status: In Progress
priority: 3
tags:
  []
created: 2026-07-01
updated: 2026-07-10
---

## Description

Second fixture task.
EOF

cat > "$FIXTURE"/tasks/task-003.md <<'EOF'
---
title: "Third task"
type: task
status: Open
priority: 4
tags:
  []
created: 2026-07-02
updated: 2026-07-10
---

## Description

Third fixture task (chmod target).
EOF

printf '# Available Tags\n\nui\nbackend\n' > "$FIXTURE"/tasks/tags.md

cat > "$FIXTURE"/CLAUDE.md <<'EOF'
# Project instructions

Fixture CLAUDE.md original content.
EOF

printf '# Overview\n\nTop-level memory file.\n' > "$FIXTURE"/memory/overview.md
printf '# Decisions\n\nOriginal decisions content.\n' > "$FIXTURE"/memory/notes/decisions.md
printf '# Glossary\n\nOriginal glossary content.\n' > "$FIXTURE"/memory/notes/glossary.md

cat > "$FIXTURE"/cards/initiatives/notification-system-overhaul.md <<'EOF'
---
title: "Notification System Overhaul"
type: initiative
status: In Progress
---

## Summary

Fixture initiative (chmod target).
EOF

cat > "$FIXTURE"/cards/stories/story-001-notification-template-builder.md <<'EOF'
---
title: "Notification Template Builder"
type: story
status: Open
---

## Summary

Fixture story.
EOF

echo "Fixture project: $FIXTURE"
```

Point each runtime at `$FIXTURE`: Tauri — native folder picker; Chrome FSA — native FSA picker (`showDirectoryPicker`); Server — typed-path dialog (paste the echoed path). Restore any `chmod 000` files with `chmod 644` before moving on, and re-run the app's Refresh after every chmod.

For write-failure scenarios the DevTools stub is (from the plan's browser verifications — run in the DevTools console after the view has loaded):

```js
const _w = ForgeFS.writeFile.bind(ForgeFS);
ForgeFS.writeFile = () => Promise.reject(new Error('EACCES injected'));
```

Restore with `ForgeFS.writeFile = _w;`. Memory-file saves go through a different legacy path; those scenarios quote their own stub.

### AT-PR4.1 — Board-move failure rolls the card back with an error toast

**Verifies:** WP3 rollback contract for board moves — optimistic paint, then restore + re-render + error toast; the pill never carries a failure; disk unchanged.
**Runtimes:** Chrome FSA, Server (DevTools console required).
**Setup:** fixture as section setup; Tasks view, Board mode; apply the `ForgeFS.writeFile` stub above.

1. **Given** the board shows "Original" in the Open column and DevTools shows the stub applied.
2. **When** you drag the "Original" card from the Open column into the In Progress column and drop it.
3. **Then** the card first paints in In Progress (optimistic), then snaps back to the Open column with a full re-render.
4. **Then** a red toast reading exactly `Move failed — reverted: EACCES injected` appears and stays about 6 seconds.
5. **Then** no `Moved to In Progress` status pill appears at any point, and no other pill shows an error.
6. **Then** on disk `tasks/task-001.md` still has `status: Open` and `updated: 2026-07-10` (check with `cat "$FIXTURE"/tasks/task-001.md`).

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.2 — Inline title edit failure reverts after the debounce

**Verifies:** WP3 rollback for debounced inline edits — the field reverts to the pre-first-edit snapshot; error channel is a toast, not the pill.
**Runtimes:** Chrome FSA, Server.
**Setup:** fixture as section setup; Tasks view; apply the `ForgeFS.writeFile` stub.

1. **Given** the card "Original" is visible on the board.
2. **When** you double-click the card title, type a new title (e.g. `Changed`), and press Enter.
3. **Then** after the 500 ms save debounce the title reverts to `Original` and the board re-renders.
4. **Then** a red toast reading exactly `Save failed — changes reverted: EACCES injected` shows for about 6 seconds.
5. **Then** no `Save failed` status pill appears (the pill area stays empty or shows nothing error-related).
6. **Then** `cat "$FIXTURE"/tasks/task-001.md` still shows `title: "Original"`.

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.3 — Modal save failure reverts every edited field; no premature success toast

**Verifies:** WP3 rollback for modal edits — snapshot taken before mutation covers all changed fields; the old premature "Task saved successfully" toast is deleted.
**Runtimes:** Chrome FSA, Server.
**Setup:** fixture as section setup; Tasks view; apply the `ForgeFS.writeFile` stub.

1. **Given** the edit modal is open for the "Original" task (open it from the card).
2. **When** you change both the title and the priority, then click Save.
3. **Then** the modal closes immediately, and no toast reading `Task saved successfully` appears at any point.
4. **Then** after the 500 ms debounce all edited fields revert on the board (title back to `Original`; reopening the modal shows priority back at its original value).
5. **Then** a red toast reading exactly `Save failed — changes reverted: EACCES injected` shows for about 6 seconds; no error pill.
6. **Then** the file on disk is unchanged (title, priority, `updated: 2026-07-10`).

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.4 — Success stays ambient: healthy edit shows the pill, not a toast; round-trip preserved

**Verifies:** WP3 severity channels on the success side — high-frequency saves use the `Saved` pill; also a regression: PR1's frontmatter round-trip (`parent:`, `source:`, unknown keys) survives the new rollback plumbing.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; Tasks view; NO stub active (restore with `ForgeFS.writeFile = _w` if a previous scenario left one).

1. **Given** the board shows "Original" (or your reverted fixture state) with writes healthy.
2. **When** you double-click the card title, change it to `Renamed`, and press Enter.
3. **Then** after the debounce a `Saved` status pill appears briefly; no toast of any kind appears.
4. **When** you drag the "Renamed" card from Open to In Progress.
5. **Then** a `Moved to In Progress` status pill appears; no toast.
6. **Then** `cat "$FIXTURE"/tasks/task-001.md` shows `title: "Renamed"`, `status: In Progress`, `updated:` equal to today's date, and the `parent:` and `source: jira` lines are still present in the frontmatter.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR4.5 — New-task failure is an error toast with no ghost card; healthy create is a success toast

**Verifies:** WP3 channel for discrete lifecycle ops — create failure never leaves a phantom card in memory; create success is a toast (consistent with delete), not a pill.
**Runtimes:** Chrome FSA, Server.
**Setup:** fixture as section setup; Tasks view, Board mode; apply the `ForgeFS.writeFile` stub.

1. **Given** the board shows exactly the fixture tasks.
2. **When** you click "+ Add Task" in a column (complete whatever title entry the flow asks for).
3. **Then** a red toast reading exactly `Error creating task: EACCES injected` appears for about 6 seconds.
4. **Then** no new card appears in the column, and after clicking the toolbar Refresh the board still shows only the original task set (no ghost card).
5. **When** you restore writes (`ForgeFS.writeFile = _w`) and add a task again.
6. **Then** a success toast reading `Task created` appears (not a pill), the card shows on the board, and a new `task-NNN.md` file exists under `"$FIXTURE"/tasks/`.

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.6 — tags.md dirty-retry: one toast on entering dirty, silent retry rewrites all tags

**Verifies:** WP3 saveTags dirty-retry — the tag is kept in memory on write failure, the toast fires once per dirty transition, and the next successful write includes previously failed tags.
**Runtimes:** Chrome FSA, Server.
**Setup:** fixture as section setup; Tasks view; apply the `ForgeFS.writeFile` stub.

1. **Given** the edit modal is open for any fixture task.
2. **When** you add a new tag (e.g. `alpha`) to the task.
3. **Then** exactly one red toast reading `Failed to save tags.md — will retry: EACCES injected` appears (about 6 seconds), and the tag chip still shows on the task.
4. **When** you add a second new tag (e.g. `beta`).
5. **Then** no additional tags.md failure toast appears (still dirty — silent retry only).
6. **When** you restore writes (`ForgeFS.writeFile = _w`) and add a third tag (e.g. `gamma`).
7. **Then** no toast appears, and `cat "$FIXTURE"/tasks/tags.md` now contains `alpha`, `beta`, and `gamma` (the previously failed tags were included in the retried full-list write).

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.7 — Memory modal save failure: modal stays open, edits preserved, cache uncommitted

**Verifies:** WP3 write-then-commit in memory — a failed save leaves no phantom "saved" cache; the user's edited text survives in the modal for retry; validation is a warning toast.
**Runtimes:** Chrome FSA, Server.
**Setup:** fixture as section setup; Memory view. Memory-file saves use the legacy write path — stub it in DevTools:

```js
const _wl = ForgeUtils.FS.writeFile.bind(ForgeUtils.FS);
ForgeUtils.FS.writeFile = () => Promise.reject(new Error('EACCES injected'));
```

1. **Given** CLAUDE.md (or any existing memory file) is open in the edit modal with the stub applied.
2. **When** you change the text and click Save.
3. **Then** a red toast reading exactly `Save failed: EACCES injected` appears (about 6 seconds); the modal STAYS OPEN with your edited text still in the textarea; no error pill.
4. **When** you press Escape to close, then reopen the same file.
5. **Then** the ORIGINAL content renders — the in-memory cache was never mutated (no phantom save).
6. **When** you restore (`ForgeUtils.FS.writeFile = _wl`), reopen, re-edit, and Save.
7. **Then** a `Saved ...` status pill appears, the modal closes, and the change is on disk (`cat "$FIXTURE"/CLAUDE.md`).
8. **When** in a memory directory tab you start a new file, leave the filename empty, and click Save.
9. **Then** an orange warning toast reading exactly `Please enter a filename` appears and the modal stays open.

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.8 — Tasks scan banner: count, tooltip, dismissal memory, changed-set re-show, clean-scan clear

**Verifies:** WP3 scan-error banner semantics in Tasks — unreadable files are reported, not silently dropped; dismissal is remembered per error-set signature.
**Runtimes:** Tauri, Server (chmod technique; restore permissions afterwards).
**Setup:** fixture as section setup; Tasks view loaded, then:

```bash
chmod 000 "$FIXTURE"/tasks/task-003.md
```

1. **Given** the board initially showed three tasks.
2. **When** you click the toolbar Refresh button.
3. **Then** a red banner appears directly under the toolbar reading exactly `1 task file could not be read`; hovering it shows a tooltip of the form `tasks/task-003.md — <error message>`.
4. **When** you click the banner's × (Dismiss) button, then click Refresh again.
5. **Then** the banner stays hidden — the identical failing set remains dismissed across re-scans.
6. **When** you run `chmod 000 "$FIXTURE"/tasks/task-002.md` and click Refresh.
7. **Then** the banner reappears reading exactly `2 task files could not be read` (changed set re-shows despite the earlier dismissal).
8. **When** you run `chmod 644 "$FIXTURE"/tasks/task-002.md "$FIXTURE"/tasks/task-003.md` and click Refresh.
9. **Then** the banner clears and both tasks are back on the board.

**Pass:** [ ] Tauri [ ] Server

### AT-PR4.9 — Memory scan banner + delete keeps the native confirm (regression)

**Verifies:** WP3 banner in Memory (real-failure catches feed it; expected-missing stays silent) — plus a regression: `deleteMemoryFile` still uses the browser's native confirm dialog in this PR (the styled dialog migration is a later PR).
**Runtimes:** Tauri, Server.
**Setup:** fixture as section setup; Memory view loaded, then:

```bash
chmod 000 "$FIXTURE"/memory/notes/decisions.md
```

1. **Given** the Memory view previously listed `overview.md` and the `notes` directory with two files.
2. **When** you click the toolbar Refresh button.
3. **Then** a red banner under the toolbar reads exactly `1 memory file could not be read`, with a tooltip of the form `memory/notes/decisions.md — <error message>`; the readable `glossary.md` still renders in the directory tab.
4. **When** you click the banner's × and Refresh again.
5. **Then** the banner stays dismissed (same failing set).
6. **When** you run `chmod 644 "$FIXTURE"/memory/notes/decisions.md` and Refresh.
7. **Then** the banner clears and `decisions.md` renders with its original content.
8. **When** you click the delete control on `glossary.md`.
9. **Then** the browser's NATIVE confirm dialog appears (not an in-app styled dialog); click Cancel — the file remains listed and on disk.

**Pass:** [ ] Tauri [ ] Server

### AT-PR4.10 — Product Forge: an unreadable card is never treated as deleted

**Verifies:** WP3 `_doRefresh` resilience — a failed read keeps the card's store entry, recents entry, and selection; the banner reports it; the filter-chips layout row is unaffected; roadmap view stays untouched (regression).
**Runtimes:** Tauri, Server.
**Setup:** fixture as section setup; Product Forge view loaded; select the "Notification System Overhaul" card in the tree so its detail panel shows. Then:

```bash
chmod 000 "$FIXTURE"/cards/initiatives/notification-system-overhaul.md
```

1. **Given** the card is selected and the tree shows both fixture cards.
2. **When** you click the toolbar Refresh button (or let the periodic auto-refresh fire).
3. **Then** a red banner under the toolbar reads exactly `1 card file could not be read`, with a tooltip of the form `initiatives/notification-system-overhaul.md — <error message>`.
4. **Then** the unreadable card is STILL in the tree (no deleted flash), and the selection and detail panel are unchanged — a failed read is not a delete.
5. **When** you enable a status filter so the active-filter chips row shows.
6. **Then** the chips row, sidebar, and detail panel do not shift while the banner is visible (the banner overlays; it takes no layout row).
7. **When** you dismiss the banner and Refresh again.
8. **Then** it stays dismissed (same failing set).
9. **When** you run `chmod 644 "$FIXTURE"/cards/initiatives/notification-system-overhaul.md` and Refresh.
10. **Then** the banner clears, the card's content is readable again, and it still appears anywhere recents are surfaced (nothing was forgotten).
11. **When** you switch to the Roadmap view.
12. **Then** it loads all fixture cards normally with no scan banner and no new toasts — its scan call sites are unchanged by this PR.

**Pass:** [ ] Tauri [ ] Server

### AT-PR4.11 — Toast hardening: ARIA roles, click-to-dismiss, durations

**Verifies:** WP3 toast hardening — `role="alert"` for error/warning, `role="status"` otherwise, whole-toast click dismisses; plus a regression: the default (non-error) duration is unchanged at 3.5 s.
**Runtimes:** Chrome FSA, Server (DevTools console + element inspector required).
**Setup:** fixture as section setup; any view loaded. In DevTools run the plan's injection:

```js
ForgeUtils.Toast.show('Injected failure', 'error', 6000)
```

1. **Given** the injected error toast is visible.
2. **Then** it renders red, stays about 6 seconds, and inspecting the element shows `role="alert"` and a `title` of `Click to dismiss`.
3. **When** you inject it again and click anywhere on the toast body.
4. **Then** it dismisses immediately.
5. **When** you run `ForgeUtils.Toast.show('Ambient note')` (no type, no duration).
6. **Then** the toast carries `role="status"` and auto-dismisses after roughly 3.5 seconds — existing non-error call sites behave as before.

**Pass:** [ ] Chrome FSA [ ] Server

### AT-PR4.12 — Regression: Tauri file watcher still refreshes views after external edits

**Verifies:** pre-existing freshness behavior unchanged — the native watcher path (Tauri-only) still picks up external file edits after the scan-error and rollback plumbing landed.
**Runtimes:** Tauri only.
**Setup:** fixture as section setup; Tauri desktop app pointed at `$FIXTURE`; Tasks view open.

1. **Given** the board shows the fixture tasks with no banner and no stubs.
2. **When** in a terminal you edit a task externally, e.g. change `title: "Second task"` to `title: "Second task edited"` in `"$FIXTURE"/tasks/task-002.md` and save.
3. **Then** without clicking Refresh, the board updates to show the new title (watcher-driven refresh), with no error toast and no scan banner.
4. **When** you edit `"$FIXTURE"/memory/overview.md` externally and switch to the Memory view.
5. **Then** the updated content renders, again with no error feedback — background refresh paths never toast.

**Pass:** [ ] Tauri


---

## PR5 gate — Shared card write service + status menu; Product Forge inline status, create, delete

Merging PR5 must prove four things: (1) the extraction of roadmap's optimistic guard, card write service, and status menu into shared modules (`card-write.js`, `status-menu.js`) is behaviorally invisible in Roadmap — menu mechanics, quick-assign, toast copy, rollback, the 15s guard, and the Escape ladder are all identical to before; (2) Product Forge gains a working inline status pill (including the "Set status" affordance on status-less cards), a New Card flow whose files match forge-lib naming and template scaffolds exactly, and a Confirm-guarded parent-first delete — all writing through the portable `ForgeFS` path API in all three runtimes; (3) writes are guard-protected so the 5s poller never flashes stale content, and failures roll back cleanly with the contractual error toasts; (4) the riders landed: `memory.js` deletion prompts with the styled `ForgeUtils.Confirm`, and no `rm-status-menu` classes survive anywhere. Prerequisite: `cd forge-shell && npm test` passes with the 30 new node tests this PR adds.

**Setup**

```bash
FIX=$(mktemp -d)
mkdir -p "$FIX/cards/initiatives" "$FIX/cards/epics" "$FIX/cards/stories" "$FIX/memory/decisions"

cat > "$FIX/cards/initiatives/mobile-platform.md" <<'EOF'
---
title: Mobile Platform
type: initiative
status: Draft
children:
  - login-epic
created: 2026-07-01
updated: 2026-07-01
---

## Background

Fixture initiative for the PR5 gate.
EOF

cat > "$FIX/cards/epics/login-epic.md" <<'EOF'
---
title: Login Epic
type: epic
status: Planning
parent: mobile-platform
children:
  - story-001-login-form
created: 2026-07-01
updated: 2026-07-01
---

## Background/Context

Fixture epic for the PR5 gate.
EOF

cat > "$FIX/cards/stories/story-001-login-form.md" <<'EOF'
---
title: Login Form
type: story
status: Draft
parent: login-epic
created: 2026-07-01
updated: 2026-07-01
---

## Background / Context

Fixture story for the PR5 gate.
EOF

cat > "$FIX/cards/epics/legacy-epic.md" <<'EOF'
---
title: Legacy Epic
type: epic
status: Bogus
created: 2026-07-01
updated: 2026-07-01
---

Epic whose status is outside the configured epic options (foreign-row fixture).
EOF

cat > "$FIX/cards/epics/no-status-epic.md" <<'EOF'
---
title: No Status Epic
type: epic
status:
created: 2026-07-01
updated: 2026-07-01
---

Epic with an empty status (Set-status affordance fixture).
EOF

cat > "$FIX/CLAUDE.md" <<'EOF'
# Fixture project memory
EOF

cat > "$FIX/memory/decisions/team-conventions.md" <<'EOF'
# Team Conventions

Fixture memory file for the PR5 memory-delete rider.
EOF

echo "Fixture project: $FIX"
```

Point each runtime at `$FIX` (Tauri: native picker; Chrome FSA: `showDirectoryPicker`; Server: typed-path dialog). Scenarios are written to run in order against one fixture; where a scenario consumes state a prior one created, its Setup line says so. Valid statuses in this build: initiative `Draft/Submitted/Approved/Superseded`, epic `Planning/In Progress/Complete/Cancelled`, story `Draft/Ready/In Progress/Done`.

### AT-PR5.1 — Roadmap status menu mechanics and Escape ladder unchanged (regression)

**Verifies:** WP5 verbatim-port criterion — menu open/keyboard/dismissal behavior identical pre/post extraction; no `rm-status-menu` classes remain.
**Runtimes:** any one (pure front-end; record which was used)
**Setup:** fixture as section setup.

1. **Given** the app is open on the fixture, **When** you open the Roadmap view and select the **Card** view mode in the toolbar, **Then** the fixture cards render.
2. **When** you click the status indicator on the "Login Epic" card, **Then** a popover menu opens anchored below the trigger; in DevTools its element has class `forge-status-menu` (no element with an `rm-status-menu` class exists anywhere), items are `role="menuitemradio"`, and the current option "Planning" is bold, shows a check mark, and holds focus.
3. **When** you press ArrowDown, ArrowUp, Home, and End, **Then** focus cycles through the enabled items (wrapping at the ends).
4. **When** you press Escape, **Then** the menu closes and focus returns to the trigger.
5. **When** you click the same trigger twice, **Then** the second click toggles the menu closed. **When** you reopen it and (a) click elsewhere on the page, (b) reopen and scroll the board, (c) reopen and resize the window, **Then** each of those closes the menu.
6. **When** you open the status menu on "Legacy Epic" (fixture `status: Bogus`), **Then** the top row is a disabled, italic entry reading "Bogus (current)", followed by the four epic options with none marked current.
7. **When** you click a card to open the detail drawer, open the status menu from the drawer's status control, and press Escape, **Then** only the menu closes (drawer stays open); a second Escape closes the drawer — the documented order is "menu closes first, then quick-assign, picker, modal, drawer, filter".
8. **When** you run `grep -rn "rm-status-menu" app/` from `forge-shell/`, **Then** it prints nothing (exit code 1); `rm-status-dot` and `rm-status-hit` still have hits — that is correct.

**Pass:** [ ] runtime used: ____________

### AT-PR5.2 — Roadmap status write and quick-assign behave exactly as before (regression)

**Verifies:** WP5 acceptance — roadmap status change via status-hit and quick-assign: optimistic update, identical toast copy, drawer sync, 15s guard vs the 5s poller.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup.

1. **Given** the Roadmap Card view, **When** you click the "Login Epic" status hit and choose "In Progress", **Then** the card's status dot and label update instantly and a success toast reads exactly `Status updated to In Progress` (~2.5s).
2. **When** you open `$FIX/cards/epics/login-epic.md`, **Then** only the `status:` and `updated:` lines changed (`updated` = today); every other line, including key order, is byte-identical.
3. **Given** the detail drawer open on that card, **When** you change status again from the drawer's status control, **Then** the drawer's status row re-renders to the new value.
4. **When** you keep watching for 5+ seconds after a status change, **Then** the auto-refresh never flashes the old value back (15s optimistic guard).
5. **When** you right-click the card (or click its ⋯ button) to open the quick-assign context menu and set a status through it, **Then** the toast reads exactly `Status set to <chosen status>` and the board re-renders.
6. **Regression — drag-reschedule and buckets survive the CardWrite/StatusMenu extraction:** **When** you switch the Roadmap to a period/timeline view, drag a card into a different release bucket, and wait ~2s, **Then** the card persists in the new bucket with no error toast and the move is reflected on disk (the card's release field, or its entry in `cards/roadmap.md`'s bucket lists); **When** you collapse and re-expand a bucket, **Then** it toggles as before. (If this fixture defines no timeline buckets, run this step against a project that does and note which was used.)

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.3 — Roadmap write failure rolls back; busy lock still toasts (regression, negative)

**Verifies:** WP5 acceptance — rollback on failure and the `_busy` lock survive the port with identical copy.
**Runtimes:** Tauri, Chrome FSA, Server (steps 4–5 in any one runtime, via DevTools)
**Setup:** fixture as section setup.

1. **Given** a forced write failure — Chrome FSA: in DevTools run `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))`; Tauri/Server: `chmod 000 "$FIX/cards/epics/login-epic.md"`.
2. **When** you choose a new status for "Login Epic" from its status menu, **Then** the dot and label revert to the previous value and an error toast appears. This ported roadmap status write passes no explicit duration, so the toast shows for the ~3.5s `ForgeUtils.Toast` default — unlike PR4's task/memory error toasts, which pass `6000`. (The spec's D4 says "6s error toasts", but this verbatim roadmap port does not; treat the timing as ~3.5s here and flag the divergence upstream — the error *channel* and copy are what this step gates, not the duration.) In Chrome FSA it reads exactly `Failed to update status: boom`; in Tauri/Server it starts `Failed to update status: ` followed by the backend's permission error. (While the file is unreadable the freshness indicator may report a scan error for it — expected; restore promptly.)
3. **When** you restore (`chmod 644 "$FIX/cards/epics/login-epic.md"` / reload the page), **Then** status changes succeed again.
4. **Given** a slowed write in DevTools: `const _w = ForgeFS.writeFile.bind(ForgeFS); ForgeFS.writeFile = (...a) => new Promise(res => setTimeout(() => res(_w(...a)), 3000));`
5. **When** you choose a status and immediately click the status hit again while the write is in flight, **Then** the menu does not open and an info toast reads exactly `Status update in progress` (~2s). Reload the page to restore.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.4 — Product Forge inline status: pill button, menu states, disk delta, guard vs poller

**Verifies:** WP5 acceptance — detail-header pill is a focusable button opening the shared menu; on-disk delta limited to `status` + `updated`; "Set status" affordance on status-less cards (O7); no stale flash within 5s.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup.

1. **Given** the Product Forge view with "Login Epic" selected, **Then** the detail-header status pill is a real `<button>` with classes `status-pill pfl-status-pill`, `aria-haspopup="menu"`, and `aria-expanded="false"`; it is reachable with Tab.
2. **When** you activate the pill (click or Enter), **Then** `aria-expanded` flips to `true` and the same shared menu as Roadmap's opens (class `forge-status-menu`, identical look).
3. **When** you choose "Complete", **Then** the pill text/color and the card's tree-row status dot update, and a success toast reads exactly `Status updated to Complete`.
4. **When** you open the file on disk, **Then** only `status:` and `updated:` changed and the frontmatter key order is preserved.
5. **When** you watch the next auto-refresh tick (within 5 seconds of the write), **Then** the pill does not flash back to the old value.
6. **When** you select "No Status Epic" (empty `status:`), **Then** the pill reads exactly `Set status`; choosing "Planning" from its menu writes `status: Planning` to disk and the pill shows Planning.
7. **When** you select "Legacy Epic" and open its pill menu, **Then** the top row is the disabled italic "Bogus (current)" entry, as in Roadmap.
8. **When** you press Escape with the menu open, **Then** the menu closes and focus returns to the pill; a second Escape follows the view's existing ladder (clears search / closes modals).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.5 — Product Forge status write failure reverts pill and tree dot (negative)

**Verifies:** WP5 acceptance — simulated write failure reverts pill and tree dot, error toast shown, store matches disk afterwards.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup; "Login Epic" selected in Product Forge.

1. **Given** a forced write failure — Chrome FSA: DevTools `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))`; Tauri/Server: `chmod 000 "$FIX/cards/epics/login-epic.md"`.
2. **When** you choose a different status from the pill menu, **Then** the pill and the tree-row dot revert to the previous value and an error toast appears — Chrome FSA exact: `Failed to update status: boom`; Tauri/Server: prefix `Failed to update status: `.
3. **When** you restore the stub/permissions and click the toolbar Refresh (or wait one 5s tick), **Then** the pill still shows the value that is on disk (no divergence) and the console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.6 — Edit modal save routes through the shared write service

**Verifies:** WP5 design point 5 — `editModal.save` migrated off the legacy 2-arg handle write; guard now covers modal saves; failure keeps the modal open.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup.

1. **Given** "Login Epic" selected, **When** you press `e` (or click Edit), change the Title and the body text, use Preview Changes (still diffs), and Save, **Then** a toast reads exactly `Card saved successfully` and the tree and detail panel re-render with the new title.
2. **When** you open the file on disk, **Then** the frontmatter is re-serialized in field order with the body change present and `updated:` = today.
3. **When** you watch one 5s refresh tick after saving, **Then** the old content never flashes back.
4. **Given** a forced failure (Chrome FSA stub / Tauri+Server `chmod 000` on the file), **When** you edit and Save, **Then** the toast reads `Save failed: boom` (Chrome FSA exact; otherwise prefix `Save failed: `), the modal stays open for retry, and after restoring + one refresh the in-app card matches disk (service rollback).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.7 — New Card modal: open paths, per-type fields, validation, Escape rung

**Verifies:** WP5 acceptance — `+` button and `n` open the modal; Title required; Status defaults per type; Parent shown only for epic/story; create modal sits in the Escape ladder after the status menu.
**Runtimes:** any one (pure front-end until Create; record which was used)
**Setup:** fixture as section setup; Product Forge view.

1. **Given** the toolbar, **Then** a `+` button titled `New card (N)` sits beside the Refresh button.
2. **When** you click it, **Then** a modal headed "New Card" opens with focus in the Title input (placeholder `Card title`) and footer buttons Cancel and Create.
3. **When** you Cancel, then press `n` (with focus not in an input), **Then** the modal reopens.
4. **Then** the Type select offers exactly Initiative, Epic, Story. With Initiative selected: Status defaults to "Draft" and there is no Parent field. Switching to Epic: Status defaults to "Planning" and a "Parent Initiative" select appears with "— None —" plus "Mobile Platform". Switching to Story: Status defaults to "Draft" and a "Parent Epic" select lists the fixture epics.
5. **When** you leave Title empty and click Create, **Then** an error toast reads exactly `Title is required`, focus returns to the Title input, the modal stays open, and no file is created.
6. **When** you press Escape, **Then** the create modal closes (this rung sits after the status menu and before the edit modal in the ladder); pressing `n` reopens it cleanly with fresh fields.
7. **When** you evaluate `CardData.TYPE_DIR_MAP` in DevTools, **Then** it maps all 7 card types to their directories (`initiative`→`initiatives` … `release-note`→`release-notes`).

**Pass:** [ ] runtime used: ____________

### AT-PR5.8 — Epic create: forge-lib file parity, duplicate suffix, immediate status write in the null-handle window

**Verifies:** WP5 acceptance — created frontmatter has every field-order key with explicit nulls, `children: []`, `description: ""`; body headings exactly match the forge-lib epic template (all six sections); duplicate title gets `-2`; a status write within 5s of create (fileHandle still null) succeeds via the path-based service.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup; Product Forge view.

1. **When** you create a card with Type Epic, Title "My Login Epic", Status Planning, Parent "— None —", **Then** the modal closes, a toast reads exactly `Card created`, and the new card is revealed and flashed in the tree.
2. **Then** `$FIX/cards/epics/my-login-epic.md` exists on disk, and its frontmatter contains **every** epic field-order key, in order: `title` (quoted), `type: epic`, `status: Planning`, then `release`, `product`, `module`, `client`, `team`, `jira_card`, `parent` each explicitly `null`, `children: []`, `description: ""`, `source_intake: null`, `source_conversation: null`, and `created`/`updated` = today.
3. **Then** the body contains exactly these six headings, in order, each followed by a TODO placeholder line: `## Background/Context`, `## Epic Scope`, `## Affected Systems`, `## Functional Capabilities`, `## Suggested Story Breakdown`, `## Success Criteria`.
4. **When**, within 5 seconds of creation (before the next scan populates its file handle), you click the new card's status pill and choose "In Progress", **Then** the toast reads exactly `Status updated to In Progress` and the file's `status:` updates on disk — the path-based write must not depend on a per-file handle.
5. **When** you create a second epic with the same Title "My Login Epic", **Then** the file lands as `my-login-epic-2.md` and both cards show in the tree.
6. **When** you watch the next 5s scan, **Then** neither new card flashes or reverts (create marks the guard before writing).
7. **Initiative create (top-level, no parent — the untested create branch):** **When** you create a card with Type Initiative, Title "Growth Bets", Status Draft, **Then** `$FIX/cards/initiatives/growth-bets.md` exists and its frontmatter carries every initiative field-order key with explicit nulls, `children: []`, `description: ""`, `status: Draft`, and `created`/`updated` = today; the body matches the forge-lib initiative template headings.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.9 — Story create: NNN numbering, parent linking, missing `stories/` auto-created, roadmap pickup, CLI round-trip

**Verifies:** WP5 acceptance — `story-NNN-{slug}` with NNN = max + 1 zero-padded (forge-lib parity); Parent updates the parent's `children` on disk; story creation works when `cards/stories/` does not exist; roadmap converges within one 5s scan; `forge index rebuild` succeeds after Shell writes.
**Runtimes:** Tauri, Chrome FSA, Server (step 6 in any one runtime)
**Setup:** fixture as section setup (contains `story-001-login-form`).

1. **When** you create a card with Type Story, Title "Password Reset", Status Ready, Parent Epic "Login Epic", **Then** the toast reads `Card created` and the file lands at `$FIX/cards/stories/story-002-password-reset.md` (max existing story number 001 + 1, zero-padded).
2. **Then** on disk `login-epic.md`'s `children:` now lists `story-002-password-reset` alongside `story-001-login-form`, and in the tree the new story nests under Login Epic, revealed/selected.
3. **When** you run `rm -rf "$FIX/cards/stories"` and wait one 5s scan (the stories drop from the tree), then create a Story "Fresh Start" with no Parent, **Then** `cards/stories/` is recreated automatically and `story-001-fresh-start.md` is written with no error toast (numbering restarts because no story files remain).
4. **When** you switch to the Roadmap view, **Then** within one 5s scan the cards created in AT-PR5.8/5.9 appear with no console errors.
5. **Then** the created story round-trips: its frontmatter contains every story field-order key (`title`, `type`, `status`, `product`, `module`, `client`, `team`, `parent`, `story_points`, `jira_card`, `source_conversation`, `created`, `updated`) with explicit nulls and **no** `children` key; body headings are `## Background / Context`, `## Feature Requirements / Functional Behavior`, `## Acceptance Tests`.
6. **When** you run, from the repo root, `python forge-lib/forge.py index rebuild --directory "$FIX/cards" --plugin product-forge`, **Then** it exits successfully and the rebuilt index lists the Shell-created cards (`cards/index.json` was untouched by the Shell itself).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.10 — Delete a leaf story: Confirm details, keyboard cancel paths, parent-first update

**Verifies:** WP5 acceptance — Confirm lists file and parent update; Cancel/Escape/bare-Enter are full no-ops; confirming removes the file, updates the parent on disk, clears the detail panel, re-renders.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup; `story-001-login-form` present under "Login Epic". Self-contained regardless of run order: if AT-PR5.9 step 3 (`rm -rf cards/stories`) has already run, first recreate the leaf via the UI — in Product Forge create a Story titled "Login Form" with Parent Epic "Login Epic" (this re-creates `cards/stories/` and relinks the child) — then proceed.

1. **Given** "Login Form" selected in Product Forge, **When** you open the detail-header overflow menu (⋯), **Then** a red "Delete Card…" item (class `pfl-overflow-danger`) appears directly below "Copy Filename".
2. **When** you click it, **Then** a styled Confirm dialog (not the native browser confirm) opens above everything, titled "Delete Card" with the message exactly `Permanently delete "Login Form"? This cannot be undone.`; its details list `stories/story-001-login-form.md` as the file to be permanently deleted and `login-epic.md` as the parent whose children list will lose `story-001-login-form`; no orphan warning is shown (leaf card).
3. **Then** focus starts on Cancel. **When** you press bare Enter, **Then** the dialog cancels and nothing changed on disk. Reopen and press Escape — cancels. Reopen and click Cancel — again a full no-op (story file and parent `children:` unchanged).
4. **When** you reopen and confirm, **Then** the file is removed from disk, the parent epic's `children:` on disk no longer lists it, the detail panel shows the empty state (the card was selected), the tree re-renders without the story (and any pin on it is cleared), and a success toast reads exactly `Card deleted`.
5. **When** you re-run the `forge index rebuild` command from AT-PR5.9 step 6, **Then** it succeeds and the deleted story is absent from the index.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.11 — Delete an epic with children: orphan warning, parent-failure abort, roadmap drawer convergence

**Verifies:** WP5 acceptance — orphan count in the Confirm details; parent-update failure aborts with no deletion; children's files never modified; roadmap converges within one 5s scan and its drawer auto-closes on the deleted card.
**Runtimes:** Tauri, Chrome FSA, Server (step 5 needs a second tab: Server, or Chrome FSA with the folder re-picked)
**Setup:** fixture as section setup; "Login Epic" has parent `mobile-platform` and at least one child story on disk. Self-contained regardless of run order: if no child story remains (AT-PR5.9 step 3 removed the stories dir, or AT-PR5.10 deleted the leaf), first create one via the UI — in Product Forge create a Story titled "Reset Flow" with Parent Epic "Login Epic" — then proceed.

1. **When** you select "Login Epic" and choose Delete Card… from the overflow menu, **Then** the Confirm details list all three items: its own file path (`epics/login-epic.md`), the parent line for `mobile-platform.md` (removal from its children list), and an orphan warning stating the child count and that the children "move to the Orphan sections; their files are NOT modified". Cancel — no-op.
2. **Given** a forced parent-write failure — Chrome FSA: DevTools `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))` (leave `ForgeFS.deleteFile` intact); Tauri/Server: `chmod 000 "$FIX/cards/initiatives/mobile-platform.md"` — **When** you Delete Card… and confirm, **Then** an error toast appears (Chrome FSA exact: `Delete aborted: could not update parent: boom`) and **nothing** is deleted: the epic file and the parent file are both unchanged on disk. Restore the stub/permissions.
3. **When** you delete the epic for real and confirm, **Then** the epic file is gone from disk, the initiative's `children:` is updated on disk, the child stories move to the tree's Orphan section, and each child's file is untouched (its `parent:` still reads `login-epic`).
4. **When** you switch to the Roadmap view, **Then** within one 5s scan the deleted epic is gone with no console errors.
5. Drawer convergence (two tabs, Server — or Chrome FSA re-picking the folder in the second tab): **Given** tab B on Roadmap with the detail drawer open on a fixture card, **When** you delete that card in Product Forge in tab A, **Then** within one 5s scan tab B's drawer auto-closes and its console shows no errors.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR5.12 — Memory delete uses the styled Confirm (C5 rider)

**Verifies:** C5 — `memory.js` `deleteMemoryFile` migrated from raw `window.confirm` to `ForgeUtils.Confirm.show`; no raw `confirm(` remains in any view controller.
**Runtimes:** Tauri, Chrome FSA, Server
**Setup:** fixture as section setup (`memory/decisions/team-conventions.md` + `CLAUDE.md`).

1. **Given** the Memory view, **When** you open the "decisions" tab, **Then** the "Team Conventions" file card shows a "×" Delete control.
2. **When** you click it, **Then** the app's styled Confirm dialog appears — not the native browser confirm — titled "Delete Memory File" with the message `Delete "Team Conventions"?`.
3. **When** you press Escape, **Then** it cancels and the file remains. Reopen; **When** you press bare Enter on the default-focused Cancel, **Then** it cancels again — full no-ops both times.
4. **When** you reopen and confirm, **Then** the file is deleted from disk and the status pill shows `Deleted Team Conventions`, as before the migration.
5. **When** you run `grep -rn "window.confirm" app/js/` from `forge-shell/`, **Then** it prints nothing; no view controller calls a bare `confirm(`.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

---

## PR6 gate — Freshness: watcher batching + multi-plugin cards/ mapping, memory change detection, audio poller, own-write suppression

Merging PR6 must prove that views stay fresh quietly: the Tauri watcher batches event bursts into ONE summarized toast per data directory (fixed 1.5s window from the first event), `cards/` changes refresh whichever of Product Forge / Roadmap is active (replacing the dead `/roadmap-data/` mapping and the legacy root `TASKS.md` token), the app's own writes never toast (receipt-time suppression through PR5's CardWrite guard/service plus `markOwnWrite` windows in memory and audio), Memory finally detects files created/deleted outside the app (re-listing signature, honest force-Refresh, unconditional watch start), and Audio Forge gains the standard 5s poller with a `destroy()` that clears only its interval. `tasks.js` is untouched — its 1000ms suppress window must still work. Prerequisite before any scenario: `cd forge-shell && npm test` green, including the 17 tests this PR adds (13 in `test/shell.helpers.test.js`, 4 new `fileListSignature` tests in `test/audio-forge.helpers.test.js`). Accepted caveat from the design risks: a genuinely external `cards/` change that lands while a controller is inside an own-write window may have its toast swallowed — scenarios below wait out the windows before asserting an external toast, and a swallowed toast under those conditions is NOT a failure.

**Setup**

```bash
FIX="$(mktemp -d)/pr6-fixture" && mkdir -p "$FIX" && cd "$FIX"
mkdir -p cards/initiatives cards/epics memory/people memory/glossary tasks audio-forge/recordings docs

cat > CLAUDE.md <<'EOF'
# Fixture Project

Overview content for the Memory view.
EOF

cat > README.md <<'EOF'
# PR6 fixture
EOF

cat > TASKS.md <<'EOF'
# Legacy root TASKS.md — must map to the plugin-less project fallback
EOF

cat > cards/roadmap.md <<'EOF'
---
type: roadmap-config
title: Fixture Roadmap
default_view: card
time_granularity: quarterly
current_year: 2026
show_stories: false
releases:
  - name: Alpha
    start_date: 2026-07-01
    end_date: 2026-09-30
  - name: Beta
    start_date: 2026-10-01
    end_date: 2026-12-31
buckets: []
swim_lanes: []
---
EOF

cat > cards/initiatives/notification-system-overhaul.md <<'EOF'
---
type: initiative
title: Notification System Overhaul
status: in-progress
release: Alpha
children:
  - epic-alerts
  - epic-digests
  - epic-webhooks
---
Scheduled initiative (Q3 2026 via release Alpha).
EOF

cat > cards/initiatives/search-revamp.md <<'EOF'
---
type: initiative
title: Search Revamp
status: proposed
---
Unscheduled initiative (no release).
EOF

for n in alerts digests webhooks; do
cat > "cards/epics/epic-$n.md" <<EOF
---
type: epic
title: Epic $n
status: in-progress
parent: notification-system-overhaul
---
Epic fixture for burst-touch tests.
EOF
done

cat > memory/people/alice.md <<'EOF'
# Alice
Fixture person entry.
EOF

cat > memory/glossary/forge.md <<'EOF'
# Forge
Fixture glossary entry.
EOF

cat > tasks/task-001.md <<'EOF'
---
title: Fixture task
type: task
status: Open
priority: 3
---
Task used for the tasks.js no-toast regression.
EOF

cat > audio-forge/recordings/2026-07-01-sprint-standup.md <<'EOF'
---
id: rec-fixture-001
title: Sprint Standup
recorded_at: 2026-07-01T10:00:00Z
duration_seconds: 90
transcript_status: complete
---
Transcript body fixture.
EOF

cat > docs/notes.md <<'EOF'
# Notes
Unmatched-directory fixture.
EOF

cat > docs/spec.md <<'EOF'
# Spec
Second unmatched file for the summarized-toast check.
EOF

echo "Fixture: $FIX"
```

Launch the runtime under test (see the runtime table in "How to run") and select `$FIX` as the project folder — native picker in Tauri, `showDirectoryPicker` in Chrome FSA, typed path in the Server dialog. Keep the DevTools console open throughout: several Then-steps assert on `[Shell] …` console lines. All watcher toasts under test are 3-second info toasts.

### AT-PR6.1 — External card edit refreshes the active view through the multi-plugin cards/ mapping

**Verifies:** WP2 — `cards/` maps to BOTH `product-forge-local` and `roadmap` (the dead `/roadmap-data/` mapping is gone); single-file toast format preserved; only the active plugin refreshes.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Roadmap view active; DevTools console open.

1. **Given** the Roadmap shows "Search Revamp" under the Unscheduled column.
2. **When** from a terminal you overwrite the card with a new title:
   ```bash
   cat > "$FIX/cards/initiatives/search-revamp.md" <<'EOF'
   ---
   type: initiative
   title: Search Revamp v2
   status: proposed
   ---
   Unscheduled initiative (no release).
   EOF
   ```
3. **Then** within ~2s (500ms Rust watcher debounce + 1.5s flush) exactly one toast appears reading `File updated: search-revamp.md`, and the Roadmap card now reads "Search Revamp v2" — this refresh was dead before this PR.
4. **And** the console shows `[Shell] File changed: <path>` followed by exactly one `[Shell] Refreshing roadmap view` line for this flush, and NO `[Shell] Refreshing product-forge-local view` line (inactive sibling not refreshed).
5. **When** you switch to the Product Forge view and repeat step 2 with the title set back to `Search Revamp`.
6. **Then** one toast `File updated: search-revamp.md` appears, the Product Forge tree shows "Search Revamp", the console shows exactly one `[Shell] Refreshing product-forge-local view` line and NO `[Shell] Refreshing roadmap view` line.

**Pass:** [ ] Tauri

### AT-PR6.2 — A burst of edits produces one summarized toast, not N

**Verifies:** WP2 — batch-and-flush with `FILE_CHANGE_FLUSH_MS = 1500` fixed from the FIRST event (not a resetting debounce); `summarizeChanges` plural format.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Product Forge view active.

1. **Given** the app is idle with no writes in the last 15 seconds.
2. **When** from a terminal you run:
   ```bash
   for f in "$FIX"/cards/epics/*.md; do touch "$f"; done
   ```
   (three files touched within ~1s).
3. **Then** exactly ONE toast appears reading `3 files updated in cards/` — not three separate `File updated:` toasts.
4. **And** the toast lands roughly 1.5s after the first change event even though later events keep arriving inside the window.
5. **And** the console shows exactly one `[Shell] Refreshing product-forge-local view` line for the flush (the active view refreshes at most once per window, even for a multi-plugin group).

**Pass:** [ ] Tauri

### AT-PR6.3 — Own writes are silent; external writes still toast; tasks regression

**Verifies:** WP2 own-write suppression at event-receipt time — Roadmap via `OptimisticGuard.hasPending() || isPrefsWritePending()` (C3), Product Forge via the CardWriteService `onBeforeWrite` hook (C4); zero-change regression for tasks.js's 1000ms window.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Roadmap view active; console open.

1. **Given** "Notification System Overhaul" sits in the Q3 2026 period column (release Alpha).
2. **When** you drag that card into the Unscheduled column.
3. **Then** the card moves, the reschedule persists, and NO `File updated` toast appears within the next ~5s; the console instead shows a line matching `[Shell] N internal change(s) in cards/ — toast suppressed` (N ≥ 1).
4. **When** you switch to Product Forge, open "Epic alerts" in its edit modal, make a small edit, and save.
5. **Then** the save shows its normal success feedback and NO `File updated` toast appears; the console shows another `internal change(s) in cards/ — toast suppressed` line.
6. **When** you switch to Tasks and change task-001's status inline on the board (e.g. Open → In Progress).
7. **Then** still NO `File updated` toast (tasks.js was not modified by this PR — its existing suppression must keep working).
8. **When** you wait at least 15 seconds with no in-app writes (lets the optimistic-guard entries clear — next confirming scan or 15s TTL — and the 2500ms `markOwnWrite` windows lapse), then run `touch "$FIX/cards/epics/epic-digests.md"` from a terminal.
9. **Then** one toast `File updated: epic-digests.md` DOES appear — external changes are not over-suppressed.

Note: if you skip the wait in step 8 and the external toast is swallowed, that is the accepted own-write-window caveat, not a gate failure — redo the step with the wait.

**Pass:** [ ] Tauri

### AT-PR6.4 — Parentless card create and delete via the app do not toast

**Verifies:** the C4 boundary cases — New Card's direct (non-service) write is covered by `pflGuard.hasPending()`, and `_deleteCard`'s direct `ForgeFS.deleteFile` is covered by an inline `markOwnWrite()`.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Product Forge view active; console open.

1. **Given** the Product Forge tree renders the fixture cards.
2. **When** you create a new card via the New Card control, give it a title (e.g. "Throwaway Card"), assign NO parent, and save.
3. **Then** the card appears in the tree with its normal success feedback, and NO `File updated` toast appears within the next ~5s (console may log an `internal change(s) in cards/ — toast suppressed` line instead).
4. **When** you delete that same parentless card from the app and confirm in the dialog.
5. **Then** the card disappears from the tree, and again NO `File updated` toast appears within ~5s.
6. **And** `ls -R "$FIX/cards"` from a terminal confirms the card's `.md` file is gone from disk.

**Pass:** [ ] Tauri

### AT-PR6.5 — Root CLAUDE.md maps to Memory; a nested CLAUDE.md does not

**Verifies:** finding O9 / WP2 mapping order — exact root `CLAUDE.md` resolves to the memory group (the Memory view renders it as its Overview tab); nested `CLAUDE.md` falls to the plugin-less directory fallback.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Memory view active, Overview tab selected; console open.

1. **Given** the Overview tab shows "Overview content for the Memory view."
2. **When** from a terminal you run `printf '\nExternal watcher line.\n' >> "$FIX/CLAUDE.md"`.
3. **Then** within ~2s one toast `File updated: CLAUDE.md` appears, the console shows `[Shell] Refreshing memory view`, and the Overview tab now renders "External watcher line."
4. **When** you run `cp "$FIX/CLAUDE.md" "$FIX/docs/CLAUDE.md"` and wait ~3s.
5. **Then** a toast `File updated: CLAUDE.md` may appear (the file changed under `docs/`), but the console shows NO new `[Shell] Refreshing memory view` line for that flush and the Memory view content is unchanged — a nested CLAUDE.md is NOT the memory overview.

**Pass:** [ ] Tauri

### AT-PR6.6 — Unmatched changes toast under their directory label but refresh nothing (negative; legacy TASKS.md token removed)

**Verifies:** WP2 fallback mapping (`{label: '<first-segment>/', plugins: []}`, `project` for root files); decision C2 — the legacy root `TASKS.md` token no longer routes to the tasks view.
**Runtimes:** Tauri only (watcher).
**Setup:** fixture as section setup; Tasks view active; console open.

1. **Given** the Tasks board renders task-001 and the app has been idle ≥15s.
2. **When** from a terminal you run `touch "$FIX/docs/notes.md" "$FIX/docs/spec.md"` (both within ~1s).
3. **Then** exactly one toast appears reading `2 files updated in docs/`, and the console shows NO `[Shell] Refreshing … view` line for this flush — no view reloads.
4. **When** you run `touch "$FIX/README.md" "$FIX/TASKS.md"` (both within ~1s).
5. **Then** exactly one toast appears reading `2 files updated in project` (root-level files fall to the `project` label).
6. **And** the console shows NO `[Shell] Refreshing tasks view` line and the Tasks board does not reload — before this PR the `TASKS.md` token would have routed this to the tasks view.

**Pass:** [ ] Tauri

### AT-PR6.7 — Memory poller detects external add and delete within 5s

**Verifies:** WP2 memory change detection — `buildMemorySignature` re-lists from disk each call, so externally created/deleted files change the signature (previously invisible); the poll path itself is silent.
**Runtimes:** Tauri, Chrome FSA, Server (5s poller exists in all three).
**Setup:** fixture as section setup; Memory view active; note the People tab's entry count.

1. **Given** the People tab shows only "Alice".
2. **When** from a terminal you run `echo '# New Person' > "$FIX/memory/people/new-person.md"`.
3. **Then** within 5s the "New Person" entry appears and the People tab count increments — with no manual Refresh click.
4. **And** in Chrome FSA and Server, NO toast appears (the poll path never toasts). In Tauri, a single watcher toast `File updated: new-person.md` is expected on top of the poller and is not a failure.
5. **When** you run `rm "$FIX/memory/people/new-person.md"`.
6. **Then** within 5s the entry disappears and the count decrements.
7. **And** the console shows no exceptions from the recursive signature listing (check especially in Chrome FSA).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR6.8 — Empty-state project starts watching unconditionally

**Verifies:** WP2 — signature build + `startMemoryWatching()` run at `loadMemory`'s tail even when no memory content exists, so a `memory/` directory created after init is detected within 5s.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** a second fixture with NO `memory/` directory and NO `CLAUDE.md`:

```bash
FIX2="$(mktemp -d)/pr6-empty" && mkdir -p "$FIX2/cards" && echo "Fixture: $FIX2"
```

1. **Given** you select `$FIX2` as the project and open the Memory view — it shows its empty state.
2. **When** from a terminal you run `mkdir -p "$FIX2/memory/glossary" && echo '# Term' > "$FIX2/memory/glossary/term.md"`.
3. **Then** within 5s the view leaves the empty state and renders a glossary tab containing the "Term" entry, with no manual Refresh and no console errors.
4. **And** afterwards, re-select `$FIX` as the project before continuing with other scenarios.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR6.9 — Memory Refresh honesty, own-save hygiene, and the modal-open guard

**Verifies:** WP2 — `handleRefresh` forces a reload and reports honestly (`Memory refreshed` only when the reload ran); own saves re-sync the signature (no reload churn on the next poll) and mark an own-write window; the pre-existing modal-open overlay guard still blocks reloads (regression).
**Runtimes:** Tauri, Chrome FSA, Server (the no-toast check in step 5 is observable in Tauri only).
**Setup:** fixture as section setup; Memory view active.

1. **Given** you click the glossary tab (a non-default tab) and type `forge` into the memory search box so filtering is active.
2. **When** you click the toolbar Refresh button.
3. **Then** the view reloads and the status pill shows `Memory refreshed`; after the reload the glossary tab is still the active tab and the search box still contains `forge` with filtering still applied.
4. **When** you open the edit modal for a memory entry (e.g. Alice under People), make a small edit, save, and then watch the view for at least 10 seconds.
5. **Then** the edited content persists, the next 5s poll does NOT trigger a full view reload (no flicker or re-render churn in the UI or console), and — Tauri only — NO `File updated` toast appears for your own save (2500ms `markOwnWrite` window).
6. **When** you reopen the edit modal for any entry and leave it OPEN, then from a terminal run `printf '\nexternal edit\n' >> "$FIX/memory/people/alice.md"` and wait ≥6s.
7. **Then** the view behind the modal does NOT reload while the modal is open (overlay guard). In Tauri a watcher toast `File updated: alice.md` may appear — the guard blocks the reload, not the toast; that is not a failure.
8. **When** you close the modal without saving.
9. **Then** within 5s the external edit is picked up and rendered.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR6.10 — Audio Forge poller, destroy() on view switch, and the 8-view sweep

**Verifies:** WP2 — audio-forge 5s external-change poller (`fileListSignature` mtime signature); `destroy()` clears ONLY the poll interval and `Shell.selectPlugin` invokes it on view switch; regression: all views still init/destroy cleanly.
**Runtimes:** Tauri, Chrome FSA, Server (step 7's poll-stop observation is Server/Tauri only; step 10 is Tauri only).
**Setup:** fixture as section setup; Audio Forge view active.

1. **Given** the list shows the "Sprint Standup" recording.
2. **When** from a terminal you run `cp "$FIX/audio-forge/recordings/2026-07-01-sprint-standup.md" "$FIX/audio-forge/recordings/2026-07-02-retro.md"`.
3. **Then** within 5s the new recording appears in the list, with no manual refresh.
4. **When** you run `rm "$FIX/audio-forge/recordings/2026-07-02-retro.md"`.
5. **Then** within 5s the entry disappears.
6. **When** you switch to the Tasks view and observe for ~15 seconds.
7. **Then** audio polling has stopped: in Server mode the terminal running `server.js` shows no further `/api/fs/*` list requests for `audio-forge/recordings`; in Tauri the logs show no further `list_md_files` invocations. (Chrome FSA: not directly observable — rely on step 9's absence of errors.)
8. **When** you click through all 8 views in the sidebar once and return to Audio Forge.
9. **Then** no controller init/destroy errors appear in the console and the recording list still renders (regression — the new `destroy()` must not break the view lifecycle).
10. **(Tauri only; needs a microphone — record `SKIPPED (no mic)` otherwise)** **When** you start a recording, switch to Tasks, and return to Audio Forge, **then** the recording is still live and the toolbar reflects it (`destroy()` cleared only the poller; state re-syncs on return). Stop the recording; during the subsequent transcription NO poll-driven list refresh occurs and NO `File updated` toast appears for the transcript write (poll skips and suppression hold while the pipeline is busy).

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

---

## PR7 gate — In-view discovery: Tasks filter-icon rebind + Roadmap text search

Merging PR7 must prove two things. First, the Tasks toolbar is honest: the magnifier button is gone, the `fa-filter` button now toggles the filter strip (with a synced active state), the field-visibility button wears `fa-table-columns` / "Card Fields" and still opens the unchanged Field Visibility Settings modal, and returning to the Tasks view or reloading no longer inverts the strip's restored open/closed state. Second, Roadmap gains an ephemeral text search: a magnifier toggle between the toolbar spacer and the year nav expands a 200px input; typing filters card, timeline, AND table modes through the one shared hierarchy pipeline (case-insensitive substring over title/filename/client/module/product/status/release, ancestor-preserving, ANDed with FilterPanel selections) with a live "N matches" count; Cmd/Ctrl+F opens and focuses it while the view is active (shadowing native browser find — expected); Escape inside the input is two-stage (clear, then collapse) and the global Escape ladder gains exactly one lowest-priority search rung; nothing about the search is ever written to `cards/roadmap.md`. Nothing palette-related (Cmd+K) is in scope — that is the next PR.

**Setup**

```bash
FIX="$(mktemp -d)" && echo "PR7 fixture: $FIX"
mkdir -p "$FIX"/cards/{initiatives,epics,stories,intakes,checkpoints,decisions,release-notes} "$FIX"/tasks

# mk <relative-path> <frontmatter lines...>
mk() { f="$FIX/$1"; shift; { echo '---'; printf '%s\n' "$@"; echo '---'; echo; echo 'PR7 acceptance fixture.'; } > "$f"; }

# Hierarchy mirrors the search fixture the implementation verified against:
# 1 initiative -> 2 epics -> 3 stories, plus one orphan epic w/ story, one orphan story,
# and one card in each flat collection. parent: values are filenames without .md.
mk cards/initiatives/platform-hardening.md 'title: Platform Hardening' 'type: initiative' 'status: Approved' 'release: Q3 2026'
mk cards/epics/epic-auth.md 'title: Auth Epic' 'type: epic' 'status: In Progress' 'parent: platform-hardening' 'release: Q3 2026'
mk cards/epics/epic-reports.md 'title: Reports Epic' 'type: epic' 'status: Planning' 'parent: platform-hardening' 'release: Q4 2026'
mk cards/stories/story-001-login.md 'title: Login flow' 'type: story' 'status: In Progress' 'parent: epic-auth' 'release: Q3 2026'
mk cards/stories/story-002-billing.md 'title: Billing export' 'type: story' 'status: Idea' 'client: Acme Corp' 'parent: epic-auth' 'release: Q3 2026'
mk cards/stories/story-003-audit.md 'title: Audit trail' 'type: story' 'status: Idea' 'parent: epic-reports' 'release: Q4 2026'
mk cards/epics/epic-orphan.md 'title: Orphan Epic' 'type: epic' 'status: Planning'
mk cards/stories/story-010-stray.md 'title: Stray child story' 'type: story' 'status: Idea' 'parent: epic-orphan'
mk cards/stories/story-020-standalone.md 'title: Standalone story' 'type: story' 'status: Idea'
mk cards/intakes/intake-idea.md 'title: Raw intake idea' 'type: intake' 'status: New'
mk cards/checkpoints/checkpoint-2026-07-01-review.md 'title: July review' 'type: checkpoint'
mk cards/decisions/use-tauri.md 'title: Use Tauri' 'type: decision'
mk cards/release-notes/v2-notes.md 'title: v2 release notes' 'type: release-note'

# Tasks for the strip-rebind scenarios
mk tasks/task-001.md 'title: Wire login form' 'status: Open' 'assignee: alice'
mk tasks/task-002.md 'title: Billing invoice export' 'status: In Progress' 'assignee: bob'
mk tasks/task-003.md 'title: Audit log retention' 'status: Completed' 'assignee: alice'

# Baseline the fixture in git so the no-persistence scenario can use `git diff`
git -C "$FIX" init -q && git -C "$FIX" add -A && git -C "$FIX" commit -qm 'pr7 fixture baseline'
```

Point each runtime at `$FIX` (native picker in Tauri, FSA picker in real Chrome, typed path in server mode). Where a scenario says "baseline commit", run `git -C "$FIX" add -A && git -C "$FIX" commit -qm baseline` at that step to absorb any writes the app made while loading, so later diffs isolate the behavior under test.

### AT-PR7.1 — Tasks toolbar: magnifier deleted, fa-filter toggles the strip with a synced active state

**Verifies:** WP4 part (a) — toolbar rebind: the filter icon actually toggles the filter strip; magnifier removed; active state synced.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; open the Tasks view.

1. **Given** the Tasks view is loaded with the filter strip closed,
2. **When** you inspect the toolbar's right cluster,
3. **Then** there is NO magnifying-glass button anywhere in it, and the buttons appear in this order: refresh-indicator, a `fa-filter` button, a `fa-pen` button (tooltip "Customize Views"), a `fa-table-columns` button, the hide-done button, and refresh.
4. **When** you hover the `fa-filter` button,
5. **Then** its tooltip reads exactly "Filter (Cmd+F)".
6. **When** you click the `fa-filter` button,
7. **Then** the filter strip (search input, status chips, assignee select) opens below the toolbar AND the `fa-filter` button lights up with the accent active style (class `rm-active` — same look the hide-done button gets when engaged).
8. **When** you click the `fa-filter` button again,
9. **Then** the strip closes and the button's active style clears.
10. **When** you type "billing" into the strip's search input (reopen the strip first),
11. **Then** the task list narrows to "Billing invoice export" — the strip's filtering behavior itself is unchanged by the rebind.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.2 — Regression: "Card Fields" button still opens the unchanged Field Visibility Settings modal

**Verifies:** WP4 part (a) — the field-visibility control gets an honest icon with zero dispatch changes; pre-existing modal behavior must not change.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; open the Tasks view.

1. **Given** the Tasks toolbar is visible,
2. **When** you hover the `fa-table-columns` button in the right cluster,
3. **Then** its tooltip reads exactly "Card Fields" (the old "Filter Fields" title is gone).
4. **When** you click it,
5. **Then** the "Field Visibility Settings" modal opens, exactly as it did before this PR.
6. **When** you toggle any field's visibility off, save, and reopen the modal,
7. **Then** the change persisted — saving works unchanged.
8. **Note (do not fail):** a `fa-table-columns` icon also appears on the Board view tab in the toolbar's left cluster. This duplication is accepted; the two sit in different clusters.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.3 — Tasks: Cmd+F / Escape unchanged; strip restore survives round-trips and reloads without inverting

**Verifies:** WP4 part (a) — restore-inversion fix (idempotent restore against the persisted flag) plus regression on the pre-existing Cmd+F / Escape strip semantics.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; open the Tasks view with the strip closed.

1. **Given** the Tasks view is active,
2. **When** you press Cmd/Ctrl+F,
3. **Then** the strip opens (and the `fa-filter` button shows its active state); pressing Cmd/Ctrl+F again closes it — unchanged pre-existing behavior.
4. **When** you open the strip, apply a status chip filter, and press Escape,
5. **Then** the strip clears its filters and closes, exactly as before this PR.
6. **When** you open the strip again, switch to the Roadmap view in the sidebar, then switch back to Tasks,
7. **Then** the strip is STILL OPEN — not inverted closed (this was the pre-fix bug) — and the `fa-filter` button still shows its active state.
8. **When** you press Cmd/Ctrl+F after that round-trip,
9. **Then** it still toggles the strip (the keyboard binding survived the view switch).
10. **When** you reload the page (or relaunch the Tauri app) with the strip open and re-select the fixture project,
11. **Then** the strip restores open with the button active. (The persisted flag lives in localStorage under `forge-shell-tasks-search-open` — inspectable in DevTools, value `1` when open.)
12. **When** you close the strip and reload again,
13. **Then** it restores closed — restore is idempotent in both directions.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.4 — Roadmap: search affordance expands, typing filters the card view live with a match count

**Verifies:** WP4 part (b) — toolbar affordance, 150ms-debounced live filtering, ancestor-preserving semantics, "N matches" counter, clean clear.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; open the Roadmap view in card mode; no FilterPanel filters active.

1. **Given** the Roadmap toolbar is visible,
2. **Then** a magnifying-glass toggle button sits between the toolbar's spacer and the year navigation; its tooltip reads exactly "Search (Cmd+F)". No text input is visible yet.
3. **When** you click the toggle,
4. **Then** a text input expands beside it to roughly 200px, receives keyboard focus, shows the placeholder "Search roadmap…", and the toggle button takes the accent active style (`rm-active`).
5. **When** you type `billing`,
6. **Then** within ~150ms (one debounce interval) the card view prunes: the "Billing export" story remains WITH its ancestors "Auth Epic" and "Platform Hardening" still visible; the sibling story "Login flow", the "Reports Epic" branch, "Orphan Epic", and "Standalone story" all disappear; the count beside the input reads exactly "3 matches" (initiative + epic + story).
7. **When** you replace the query with `hardening`,
8. **Then** the initiative match keeps its whole subtree — both epics and all three tree stories render — and the count reads "6 matches".
9. **When** you replace the query with `stray`,
10. **Then** only "Orphan Epic" with its "Stray child story" remains and the count reads "2 matches" (flat collections such as decisions and checkpoints are not counted).
11. **When** you replace the query with `ACME` (uppercase),
12. **Then** the "Billing export" story (client "Acme Corp") matches — search is case-insensitive — count "3 matches".
13. **When** you select-all and delete the query,
14. **Then** the full roadmap returns and the count text clears (empty, not "0 matches").
15. **When** you click the toggle again,
16. **Then** the input collapses, its text is cleared, and the toggle's active style clears.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.5 — Roadmap: search covers timeline and table modes, ANDs with FilterPanel, and filtered renders stay interactive

**Verifies:** WP4 part (b) — one hierarchy-pipeline insertion point covers all three view modes; search intersects FilterPanel selections; DnD and inline status work on filtered renders.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; Roadmap view, card mode, search open with query `billing` active (from AT-PR7.4 state or re-typed).

1. **Given** the query `billing` is active in card mode ("3 matches"),
2. **When** you switch to Timeline mode, then Table mode,
3. **Then** the same pruned subset (Platform Hardening → Auth Epic → Billing export) renders in both modes; the count still reads "3 matches".
4. **When** back in card mode, you open the FilterPanel from the toolbar and select client "Acme Corp",
5. **Then** the results are the intersection of search and filter — "Billing export" with its ancestors remains — and BOTH the filter badge and the match count update.
6. **When** you change the search query to `login` with the "Acme Corp" client filter still active,
7. **Then** the view empties (no card matches both) and the count drops accordingly; clearing the client filter brings the "Login flow" branch back.
8. **When** you clear all FilterPanel selections, set the query back to `billing`, and drag the "Billing export" card from its period column to a different period column,
9. **Then** the drop completes and the card's schedule updates — drag-and-drop works on a filtered render (drop targets are period columns and are unaffected by filtering).
10. **Note (accepted behavior, do not fail):** a card whose status or schedule changes while search is active may filter out of view — e.g. changing a card's status via its inline status control while the query matched on that status. Record it if seen; it is intentional.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.6 — Roadmap keyboard: Cmd/Ctrl+F opens + focuses; two-stage Escape inside the input; per-view guards

**Verifies:** WP4 part (b) — Cmd/Ctrl+F branch with view-active guard; input-level two-stage Escape that never double-fires the global ladder; search is ephemeral across view switches.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; Roadmap view active, search collapsed.

1. **Given** the Roadmap view is active,
2. **When** you press Cmd/Ctrl+F,
3. **Then** the search input expands and receives focus. The native browser find bar does NOT open — Cmd+F is shadowed while the roadmap view is active (expected; this matches the pre-existing Tasks behavior — do not fail on the shadowing).
4. **When** you press Cmd/Ctrl+F again while the input is already open,
5. **Then** the input simply stays open and re-focuses (no toggle-closed).
6. **When** you type `billing` (results prune) and press Escape once with focus in the input,
7. **Then** the query clears, the full roadmap restores, the count clears — but the input STAYS OPEN and keeps focus. Nothing else on the page reacts (the keypress does not reach the global Escape ladder).
8. **When** you press Escape a second time (input now empty),
9. **Then** the input collapses and the toggle's active style clears. Two presses total to fully dismiss a search containing text — intentional.
10. **When** you switch to the Tasks view and press Cmd/Ctrl+F,
11. **Then** only the Tasks filter strip toggles — the roadmap handler is inert while its view is inactive (each view has its own view-active guard).
12. **When** you switch back to Roadmap after having left a query active there,
13. **Then** the search arrives collapsed and empty — search state is ephemeral and resets when the view is torn down — and Cmd/Ctrl+F works again immediately.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.7 — Regression: the Roadmap Escape ladder order is unchanged; search dismisses last

**Verifies:** WP4 part (b) — exactly one new lowest-priority Escape rung appended; the pre-existing dismissal order (status menu → quick-assign → release picker → config modal → drawer → filter panel) must not change.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; Roadmap view, card mode; open search, type `hardening` ("6 matches"), then click somewhere neutral so focus leaves the search input.

1. **Given** the search is open with an active query and focus is NOT in the search input,
2. **When** you open a card's status menu (click the status control on any visible card) and press Escape,
3. **Then** only the status menu closes — the search stays open with its query and results intact.
4. **When** you click a card to open the detail drawer and press Escape,
5. **Then** only the drawer closes — search still intact.
6. **When** you open the FilterPanel from the toolbar and press Escape,
7. **Then** only the panel closes — search still intact.
8. **When** nothing else is open and you press Escape (focus still outside the input),
9. **Then** the search dismisses via the global ladder's new last rung: the input collapses, the query clears, and the full roadmap restores. (Outside the input this is a single press; the two-stage behavior of AT-PR7.6 applies only while the input has focus.)

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.8 — Negative path: zero-match query; search never persists and never writes cards/roadmap.md

**Verifies:** WP4 part (b) — graceful empty state, and the ephemerality guarantee: `searchQuery` is never written to `roadmap.md` and does not survive a reload.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; open the Roadmap view once and let it settle for ~10 seconds, then make the baseline commit (`git -C "$FIX" add -A && git -C "$FIX" commit -qm baseline`) so any load-time config writes are absorbed.

1. **Given** the Roadmap view is active with the baseline committed,
2. **When** you open search and type `zzz-nothing`,
3. **Then** every collection empties — no initiative, epic, story, intake, checkpoint, decision, or release-note cards render — the count reads "0 matches", and the console shows no errors.
4. **When** you clear the query,
5. **Then** the full roadmap returns.
6. **When** you run several searches (`billing`, `hardening`, `zzz-nothing`), toggle the box open/closed, and then run `git -C "$FIX" diff --stat` in a terminal,
7. **Then** the output is empty — in particular `cards/roadmap.md` is unchanged. Searching only reads.
8. **When** you leave a query active and reload the page (re-selecting the project if prompted),
9. **Then** the roadmap loads with search collapsed and no query — search state was not persisted anywhere.
10. **When** you run `git -C "$FIX" diff --stat` again after the reload,
11. **Then** it is still empty.

**Pass:** [ ] Tauri [ ] Chrome FSA [ ] Server

### AT-PR7.9 — Watcher refresh re-applies an active search filter (Tauri only)

**Verifies:** WP4 part (b) — an external file change arriving through the native watcher re-renders through the same pipeline, so the active query is re-applied to fresh data.
**Runtimes:** Tauri only (the file watcher exists only there; in Chrome FSA / Server modes freshness comes from pollers or manual refresh — record those columns as n/a).
**Setup:** fixture as section setup; Tauri app pointed at `$FIX`; Roadmap view, card mode; search open with query `billing` active ("3 matches" — the Reports Epic branch is filtered out).

1. **Given** the query `billing` is active and "Audit trail" is not visible,
2. **When** in a terminal you edit the hidden story's title to match the query:
   ```bash
   sed -i '' 's/^title: Audit trail$/title: Billing audit trail/' "$FIX/cards/stories/story-003-audit.md"
   ```
3. **Then** within a few seconds the watcher-driven refresh re-renders the view WITH the query still applied: "Billing audit trail" appears under "Reports Epic", and the count updates to "5 matches" (initiative + 2 epics + 2 stories). The search input keeps its text; no manual refresh was needed.
4. **When** you revert the edit (`git -C "$FIX" checkout -- cards/stories/story-003-audit.md`),
5. **Then** the view settles back to the original "3 matches" subset on the next refresh.

**Pass:** [ ] Tauri [ ] Chrome FSA: n/a [ ] Server: n/a

---

## PR8 gate — Global Cmd+K palette: fuzzy search across all plugin entities

Merging PR8 must prove that a shell-chrome Cmd/Ctrl+K palette (`window.ShellPalette`) opens from any view once a project is loaded (and no-ops on the welcome screen), fuzzy-searches `*.md` entities across all seven plugin data dirs into at most 20 ranked rows with icon / title / "type · Plugin" subtitle, deep-links card entries into Product Forge via `selectCard` while every other entry plain-switches views, stacks at z-index 1250 (above all view surfaces ≤ 1200, below the shared Confirm at 1300) and never leaks a consumed keystroke to view handlers, and keeps its entity index fresh via a 60s cache TTL plus receipt-time watcher invalidation (Tauri) and project-switch invalidation — all without disturbing any pre-existing view keyboard behavior. Prerequisite before running this gate: `cd forge-shell && npm test` fully green on the PR branch, including the 12 new `shell-palette.helpers` tests (suite total 255).

**Setup**

```bash
# Disposable fixture project — never point this gate at a real project dir.
FIX="$(mktemp -d)"
FIX2="$(mktemp -d)"   # second, EMPTY project for AT-PR8.8

mkdir -p "$FIX/cards/initiatives" "$FIX/cards/epics" "$FIX/cards/stories" \
         "$FIX/tasks" "$FIX/sessions/debates" "$FIX/reports" \
         "$FIX/memory/architecture" "$FIX/rovo-agents/ticket-triage-agent" \
         "$FIX/audio-forge/recordings"

cat > "$FIX/cards/initiatives/palette-nav-initiative.md" <<'EOF'
---
title: Palette Nav Initiative
type: initiative
status: Planning
---
# Palette Nav Initiative
EOF

cat > "$FIX/cards/epics/notification-overhaul.md" <<'EOF'
---
title: Notification Overhaul
type: epic
status: In Progress
parent: palette-nav-initiative
---
# Notification Overhaul
EOF

cat > "$FIX/cards/stories/story-001-fuzzy-finder.md" <<'EOF'
---
title: Fuzzy Finder Story
type: story
status: Draft
parent: notification-overhaul
---
# Fuzzy Finder Story
EOF

cat > "$FIX/tasks/task-001.md" <<'EOF'
---
title: Wire palette shortcut
status: In Progress
---
# Wire palette shortcut
EOF

# 24 bulk tasks so a "match" query overflows the 20-row cap
for i in $(seq -w 2 25); do
cat > "$FIX/tasks/task-0$i.md" <<EOF
---
title: Bulk match task $i
status: Todo
---
# Bulk match task $i
EOF
done

cat > "$FIX/sessions/debates/2026-07-01-api-architecture-debate.md" <<'EOF'
---
title: API Architecture Debate
---
# API Architecture Debate
EOF

cat > "$FIX/reports/2026-07-02-q3-performance-review.md" <<'EOF'
---
title: Q3 Performance Review
---
# Q3 Performance Review
EOF

# memory: one top-level note and one one-level-subdir note; no frontmatter,
# so the title must come from the first '# ' heading (fallback chain)
printf '# Decisions Log\n'   > "$FIX/memory/decisions-log.md"
printf '# Event Bus Notes\n' > "$FIX/memory/architecture/event-bus-notes.md"

cat > "$FIX/rovo-agents/ticket-triage-agent/agent.md" <<'EOF'
---
title: Ticket Triage Agent
---
# Ticket Triage Agent
EOF

cat > "$FIX/audio-forge/recordings/2026-07-03-sprint-standup.md" <<'EOF'
---
title: Sprint Standup Recording
---
# Sprint Standup Recording
EOF

# 200 bulk notes so the first-open index build is non-trivial (soft latency check)
for i in $(seq -w 1 200); do
  printf '# Bulk note %s\n' "$i" > "$FIX/memory/architecture/bulk-note-$i.md"
done

echo "Fixture project: $FIX"
echo "Empty project:   $FIX2"
```

Load `$FIX` as the project in each runtime under test (Tauri: native picker; Chrome FSA: `showDirectoryPicker` — in the picker press Cmd+Shift+G and paste the `$FIX` path; Server: typed-path dialog, paste the `$FIX` path). "Cmd+K" below means Cmd+K on macOS and Ctrl+K on Windows/Linux; same for Cmd+F. Keep DevTools open with the console visible for the no-console-errors checks.

### AT-PR8.1 — Cmd/Ctrl+K opens from any view, no-ops on welcome, shows the empty-query hint, and toggles closed

**Verifies:** WP4 part (c) shortcut lifecycle — palette opens only with a project loaded, empty query shows the hint, same shortcut toggles closed.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the app is on the welcome screen with no project loaded (clear the saved project via "Change directory" → Escape, or use a fresh browser profile), **when** you press Cmd+K, **then** nothing happens — no overlay appears and no console error is logged.
2. **Given** you then load `$FIX` and the default view is showing, **when** you press Cmd+K, **then** a centered overlay opens above the active view: a dialog with a magnifier icon, a focused text input with placeholder "Search across Forge…", a results area, and a footer reading "↑↓ navigate · ↵ open · esc close".
3. **Then** the results area shows the hint "Type to search" (on the very first open it may show "Indexing…" for a moment first, then settle on "Type to search").
4. **Given** the palette is open with an empty query, **when** you press Cmd+K again, **then** the palette closes (the shortcut toggles).
5. **Given** the palette is closed, **when** you switch to a different view (e.g. Roadmap, then Memory) and press Cmd+K in each, **then** the palette opens identically from every view — it is shell chrome, not tied to any one plugin.
6. **Then** no console errors were logged at any point in this scenario.

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.2 — Fuzzy query matches entities from all seven data dirs, capped at 20 rows

**Verifies:** WP4 part (c) index coverage — `cards/`, `tasks/`, `sessions/`, `reports/`, `audio-forge/recordings/`, `memory/` (top level + one-level subdirs), `rovo-agents/*/agent.md`; row anatomy and the 20-row cap.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** `$FIX` is loaded, **when** you press Cmd+K and type `notification`, **then** a row titled "Notification Overhaul" appears with the Product Forge icon and the subtitle "epic · Product Forge".
2. **When** you clear the input and type each query below in turn, **then** each expected row appears with the expected subtitle:
   - `wire` → "Wire palette shortcut" — "task · Tasks"
   - `debate` → "API Architecture Debate" — "session · Cognitive Forge" (a `sessions/debates/` file — where real Cognitive Forge sessions live; reached via the one-level-subdir scan, same as the memory subdir entry below)
   - `q3` → "Q3 Performance Review" — "report · Report Forge"
   - `standup` → "Sprint Standup Recording" — "recording · Audio Forge"
   - `decisions log` → "Decisions Log" — "memory · Memory" (top-level memory file, title taken from its `# ` heading — it has no frontmatter)
   - `event bus` → "Event Bus Notes" — "memory · Memory" (one-level subdir file)
   - `triage` → "Ticket Triage Agent" — "agent · Rovo Agent Forge"
3. **When** you type `match`, **then** exactly 20 rows are shown even though the fixture contains 24 "Bulk match task NN" tasks (results are capped at 20).
4. **When** you type a garbage query such as `zzzz`, **then** the results area shows "No matches".
5. **Soft check (non-blocking — record the observation, do not fail the gate on it):** on the very first palette open after loading this fixture (200+ indexable files), "Indexing…" appears briefly and the palette becomes responsive within a few seconds; typing during the build is ranked once the build finishes.
6. **Then** no console errors were logged.

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.3 — Arrow keys wrap, hover moves the active row, Enter deep-links a card into Product Forge

**Verifies:** WP4 part (c) keyboard navigation + the one supported deep link (`product-forge-local` `selectCard`).
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the palette is open with query `match` (20 rows), **when** you press ArrowDown repeatedly, **then** the highlighted (active) row moves down one row per press and, after the last row, wraps back to the first; the active row is scrolled into view as it moves.
2. **When** you press ArrowUp on the first row, **then** the highlight wraps to the last row.
3. **When** you move the mouse over a different row, **then** that row becomes the active (highlighted) row.
4. **Given** you clear the input and type `notification`, **when** you press Enter with the "Notification Overhaul" row active, **then** the palette closes, the app switches to the Product Forge view, and the "Notification Overhaul" card is revealed/selected there.
5. **Given** the palette is open again with the `notification` result showing, **when** you click the "Notification Overhaul" row with the mouse, **then** the same thing happens (click selects like Enter).
6. **Then** no console errors were logged.

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.4 — Non-card entries plain-switch views; hidden-plugin entries toast and do not navigate

**Verifies:** WP4 part (c) selection routing — deep-linking is limited to Product Forge cards; other entries switch views only; hidden plugins produce an info toast. Includes the hidden-plugin negative path.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the palette is open, **when** you type `wire` and press Enter on "Wire palette shortcut", **then** the palette closes and the Tasks view becomes active. The Tasks view opens with no particular task selected or highlighted — deep links beyond Product Forge's `selectCard` are an explicit non-goal of this PR, so the absence of a task-level deep link is expected, NOT a failure.
2. **When** you press Cmd+K, type `debate`, and press Enter on "API Architecture Debate", **then** the Cognitive Forge view becomes active (again, no session-level selection expected).
3. **Given** you now hide the Report Forge plugin via the sidebar (pen icon → eye toggle on Report Forge → done), **when** you press Cmd+K, type `q3`, and press Enter on "Q3 Performance Review", **then** the palette closes, an info toast appears reading "Report Forge is hidden — enable it in the sidebar", and the app does NOT navigate — the current view stays active.
4. **Cleanup:** re-enable Report Forge via the same sidebar toggle.
5. **Then** no console errors were logged.

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.5 — Layer ladder and key containment: drawer < palette (z 1250) < Confirm (z 1300)

**Verifies:** C10 / D5 layering — palette renders above every view surface and below the shared Confirm; palette keys never leak to view handlers; Confirm's capture-phase keydown beats the palette both ways.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the Roadmap view is active and you have clicked a card (e.g. "Notification Overhaul") so its detail drawer is open, **when** you press Cmd+K, **then** the palette overlay opens ON TOP of the drawer — the dimmed backdrop covers the drawer and the palette dialog is fully visible above it. In DevTools, `getComputedStyle(document.querySelector('.shell-palette-overlay')).zIndex` returns `"1250"`.
2. **When** you press Escape, **then** ONLY the palette closes — the roadmap drawer underneath is still open (no Escape leak to the view's handler).
3. **When** you press Escape again (palette now closed), **then** the drawer closes as it always has (the view's own Escape handling is intact).
4. **Given** the palette is open again (Cmd+K, any query), **when** you run the shared-Confirm stub in the DevTools console — `ForgeUtils.Confirm.show('Destructive check', 'Bare Enter must cancel', '').then(v => console.log('resolved:', v))` — **then** the Confirm dialog renders ABOVE the palette (Confirm is at z 1300, palette at 1250).
5. **When** you press ArrowDown and then Escape while the Confirm is visible, **then** the Confirm swallows both keys: the palette's active row does not move, the Confirm dismisses on Escape, and the console logs `resolved: false`; the palette is still open behind it. Press Escape once more to close the palette.
6. **Given** the same Confirm stub is showing with the palette CLOSED, **when** you press Cmd+K, **then** the palette does NOT open (Confirm's capture-phase handler stops the shortcut — intended). Dismiss the Confirm with Escape.
7. **When** you reopen the palette and click on the dimmed backdrop outside the dialog, **then** the palette closes; **when** you reopen it and click inside the dialog (e.g. on the input row), **then** it stays open.
8. **Then** no console errors were logged (the `resolved: false` log is expected output, not an error).

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.6 — Watcher receipt invalidation: external edit is searchable immediately (no 60s wait)

**Verifies:** C9 — `shell.js` invalidates the palette index at watcher-receipt time in `_onFileChanged`, so the index is never fresher than the change. Watcher events exist only in Tauri.
**Runtimes:** Tauri only.
**Setup:** fixture as section setup.

1. **Given** `$FIX` is loaded in the Tauri app, **when** you press Cmd+K and type `notification`, **then** "Notification Overhaul" is listed (this builds and caches the index). Press Escape to close.
2. **When** you edit the epic's title from a terminal:
   ```bash
   perl -pi -e 's/^title: Notification Overhaul$/title: Renamed Overhaul/' \
     "$FIX/cards/epics/notification-overhaul.md"
   ```
   **then** wait for the watcher's file-change toast to fire in the app.
3. **When** you press Cmd+K and type `renamed` immediately after the toast (well within 60s of the index build), **then** a row titled "Renamed Overhaul" appears — the index was invalidated at event receipt, not after the 60s cache TTL.
4. **When** you type `notification overhaul`, **then** the old title no longer produces a "Notification Overhaul" row.
5. **Cleanup:** revert the title with the inverse `perl -pi -e 's/^title: Renamed Overhaul$/title: Notification Overhaul/' …` command.
6. **Then** no console errors were logged.

**Pass:** [ ] Tauri

### AT-PR8.7 — Stale index within the 60s TTL: miss on a deleted card shows the not-found toast; TTL rebuild clears it

**Verifies:** WP4 part (c) freshness backstop in watcherless runtimes — 60s cache means a just-deleted entity can still be listed; selecting it lands in Product Forge which shows its pre-existing miss toast; after 60s the rebuilt index drops it. Negative/failure path.
**Runtimes:** Chrome FSA, Server. (Not meaningful in Tauri: the delete fires the watcher, which invalidates the index immediately, so the stale window does not normally exist there.)
**Setup:** fixture as section setup.

1. **Given** `$FIX` is loaded, **when** you press Cmd+K and type `fuzzy finder`, **then** "Fuzzy Finder Story" is listed (index built and cached). Press Escape.
2. **When** you delete the story from a terminal — `rm "$FIX/cards/stories/story-001-fuzzy-finder.md"` — and, WITHIN 60 seconds of step 1, press Cmd+K and type `fuzzy finder` again, **then** the "Fuzzy Finder Story" row is STILL listed: the cached index has not expired and there is no watcher in this runtime. This staleness is accepted behavior, not a failure.
3. **When** you press Enter on that stale row, **then** the palette closes, the app switches to the Product Forge view, and an info toast appears reading "Card not found in Product Forge" (Product Forge reloaded from disk, found no such card, and fired its pre-existing miss toast). No card is selected.
4. **Given** you wait until more than 60 seconds have passed since the index was built, **when** you press Cmd+K and type `fuzzy finder` again, **then** the results area shows "No matches" — the TTL expired and the rebuilt index no longer contains the deleted card.
5. **Then** no console errors were logged.

**Pass:** [ ] Chrome FSA · [ ] Server

### AT-PR8.8 — Project switch drops the old index; an empty project opens cleanly with no errors

**Verifies:** C9 project-switch invalidation in `_onDirectoryReady`, plus silent per-source skip of missing data dirs (empty project). Negative path for missing dirs.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup (`$FIX` loaded, plus the empty `$FIX2`).

1. **Given** `$FIX` is loaded, **when** you press Cmd+K and type `notification`, **then** "Notification Overhaul" is listed (index cached). Press Escape.
2. **When** you use the sidebar folder button to switch the project to `$FIX2` (Tauri: native picker; Chrome FSA: FSA picker — Cmd+Shift+G to paste the path; Server: typed-path dialog), **then** the app loads the empty project without console errors (all seven data dirs are missing; each scanner skips silently).
3. **When** you press Cmd+K immediately after the switch (no 60s wait) and type `notification`, **then** the results area shows "No matches" — the old project's index was dropped at switch time, and the palette opened over an empty index without errors.
4. **When** you clear the query, **then** the hint "Type to search" shows as normal.
5. **Cleanup:** switch the project back to `$FIX`; **then** a `notification` query finds "Notification Overhaul" again (fresh index from the reselected project).
6. **Then** no console errors were logged at any point.

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

### AT-PR8.9 — Regression: pre-existing view keyboard behavior and boot are unchanged

**Verifies:** the palette's global listener and key containment do not alter any behavior that existed before this PR — plain typing never opens the palette, view shortcuts and Escape handling still work with the palette closed, and the app still boots clean.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** `$FIX` is loaded and the Tasks view is active, **when** you open the filter strip (Cmd+F or the filter toolbar button) and type `k` into the strip's search input, **then** the letter "k" is inserted into the input and the palette does NOT open (only the Cmd/Ctrl modifier combination opens it).
2. **When** you press Escape with the strip open, **then** the strip clears and closes exactly as it did before this PR.
3. **When** you press Cmd+F again, **then** the strip toggles open with the filter button showing its active state — the pre-existing Tasks shortcut still works.
4. **Given** the Roadmap view is active with a card's detail drawer open and the palette CLOSED, **when** you press Escape, **then** the drawer closes as before (the view's Escape ladder is untouched while the palette is closed).
5. **Given** you open and close the palette once (Cmd+K, Escape), **when** you repeat steps 3 and 4, **then** both still behave identically — using the palette does not break or re-order any view-level key handling.
6. **When** you reload the app with `$FIX` as the project, **then** it boots with no console errors and no visual change to any view's chrome (the palette contributes no visible DOM until first opened).

**Pass:** [ ] Tauri · [ ] Chrome FSA · [ ] Server

---

## PR9 gate — Productivity ghost cleanup: delete dead controller, rename CSS, docs sync

This PR deletes code and renames a file; it adds no behavior. Merging it must prove a pure negative: after removing `productivity.js`, renaming `productivity.css` → `tasks-memory.css`, purging the CSS rules only the dead view used, dropping the unread `TASKS.md` probe from `Shell._onDirectoryReady`, and syncing the docs, **nothing user-visible changed**. Concretely: the app boots in all three runtimes with `tasks-memory.css` loading (status 200) and zero requests for the old asset names; the home view still shows its 8 plugin status cards with no Productivity tile; the Tasks board still drags with the whole-column highlight, parent chips, and the bottom status pill (the keep-list rules survived the purge, including the dynamically-constructed `prod-tl-*` / `prod-wl-status-*` families in both themes); the Memory view is still fully styled; and README/STYLE_GUIDE describe the tree as it now exists. Any visual regression in Tasks or Memory here means the purge deleted a live rule — fail the gate.

**Setup**

Fixture contents are derived from the plan's own PR1 (tasks/parent) and PR2 (memory renderer) browser-verification fixtures. Due dates are computed relative to today so timeline bars land in the visible range on any run date. The root `TASKS.md` is a deliberate decoy: the deleted shell probe would have found and read it, so its silence is meaningful.

```bash
FIX=$(mktemp -d)
mkdir -p "$FIX/tasks" "$FIX/cards" "$FIX/memory/fixtures"
CREATED=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '-7 days' +%Y-%m-%d)
DUE_SOON=$(date -v+4d +%Y-%m-%d 2>/dev/null || date -d '+4 days' +%Y-%m-%d)
DUE_LATER=$(date -v+10d +%Y-%m-%d 2>/dev/null || date -d '+10 days' +%Y-%m-%d)

# Board/drag + parent-chip task (plan PR1 fixture; priority 2 = high band, red timeline bar)
cat > "$FIX/tasks/task-101-fixture.md" <<EOF
---
title: "Fixture with parent"
type: task
status: Open
priority: 2
assignee: alice
due_date: $DUE_SOON
tags:
  - auth
  - backend
parent: story-001-notification-template-builder
source: product-forge
created: $CREATED
updated: $CREATED
---

## Description

Round-trip fixture.
EOF

# Task-parent chip target (plan PR1 fixture)
cat > "$FIX/tasks/task-102-child.md" <<EOF
---
title: "Child of a task"
status: Open
parent: task-101-fixture
created: $CREATED
updated: $CREATED
---

Body.
EOF

# Priority 3 = medium band (orange bar); In Progress pill
cat > "$FIX/tasks/task-103-medium.md" <<EOF
---
title: "Timeline medium"
type: task
status: In Progress
priority: 3
assignee: bob
due_date: $DUE_SOON
tags: []
parent: null
created: $CREATED
updated: $CREATED
---

Body.
EOF

# Priority 4 = low band (blue bar); Blocked pill
cat > "$FIX/tasks/task-104-low.md" <<EOF
---
title: "Timeline low"
type: task
status: Blocked
priority: 4
assignee: bob
due_date: $DUE_LATER
tags: []
parent: null
created: $CREATED
updated: $CREATED
---

Body.
EOF

# Completed pill for the workload view
cat > "$FIX/tasks/task-105-done.md" <<EOF
---
title: "Workload done"
type: task
status: Completed
priority: 1
assignee: alice
due_date: $CREATED
tags: []
parent: null
created: $CREATED
updated: $CREATED
---

Body.
EOF

# Parent-chip cross-plugin target (plan PR1 fixture)
cat > "$FIX/cards/story-001-notification-template-builder.md" <<EOF
---
title: "Notification Template Builder"
type: story
status: Draft
created: $CREATED
updated: $CREATED
---

Story body.
EOF

# Memory render fixture (plan PR2 fixture, verbatim — the hostile link is deliberate)
cat > "$FIX/memory/render-fixture.md" <<'EOF'
Team working agreements captured during onboarding. PRs stay **small**.

### Conventions

| Area | Rule |
|:-----|:-----|
| Commits | Conventional messages |
| Reviews |  |

- Keep PRs focused
- [Style guide](https://example.com/style)
- [hostile](javascript:alert(1))
EOF
cp "$FIX/memory/render-fixture.md" "$FIX/memory/fixtures/render-fixture.md"

cat > "$FIX/CLAUDE.md" <<'EOF'
# Fixture project memory

Plain overview content for the Memory view.
EOF

# Decoy: the removed _onDirectoryReady probe would have read this file
cat > "$FIX/TASKS.md" <<'EOF'
# Decoy legacy tasks file — nothing in forge-shell should read this anymore
EOF

echo "$FIX"
```

Teardown: `rm -rf "$FIX"` after the gate.

### AT-PR9.1 — Clean boot: renamed stylesheet loads, no ghost asset requests, no TASKS.md read

**Verifies:** WP8 rename + probe removal — `tasks-memory.css` loads 200 with no `productivity.css` 404 and no `productivity.js` request; `_onDirectoryReady` no longer reads `TASKS.md`; Tauri watcher regression (as landed by PR6) still intact.
**Runtimes:** Tauri, Chrome FSA, Server (step 7 is Tauri-only).
**Setup:** fixture as section setup.

1. **Given** the app is freshly launched in the runtime under test with DevTools open (Network + Console tabs), and no project selected yet.
2. **When** you select the fixture project (`$FIX`) via the runtime's picker (Tauri: native folder picker; Chrome FSA: `showDirectoryPicker`; Server: typed-path dialog — paste the `$FIX` path).
3. **Then** in the Network tab (Chrome FSA / Server), the request for `css/tasks-memory.css` completed with status **200**, and there is **no** request for `productivity.css` (no 404) and **no** request for `productivity.js`. In Tauri, confirm via the webview DevTools Network/Console: no failed asset load, no 404, no error mentioning either old filename.
4. **Then** the Console shows no errors — in particular none from `_onDirectoryReady` — and the sidebar shows Tasks and Memory nav entries.
5. **Then** despite the decoy `TASKS.md` sitting at the fixture root, no `TASKS.md` read occurs on directory open: in Server runtime, the Network tab shows no `/api/fs/*` request whose path names `TASKS.md`; in Chrome FSA and Tauri (where FS ops don't appear in the Network tab), the Console contains no mention of `TASKS.md` and no error.
6. **Then** the Tasks board renders the fixture's five tasks distributed across their status columns, fully styled (cards have borders/backgrounds — nothing rendered as bare unstyled text).
7. **(Tauri only) Then** with the Tasks view open, run `touch "$FIX/tasks/task-103-medium.md"` in a terminal: within a few seconds the Tasks view auto-refreshes and shows a summary toast (watcher behavior as landed by PR6 — unchanged by this PR's `shell.js` edit).

**Pass:** [ ] Tauri  [ ] Chrome FSA  [ ] Server

### AT-PR9.2 — Home view shows exactly 8 plugin status cards, no Productivity tile; Cmd+K palette still works

**Verifies:** WP8 probe removal is invisible — home-view status cards iterate `PLUGINS`, which never contained productivity; palette regression guard for the `shell.js` hunk (as landed by PR8).
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup; project already selected (continue from AT-PR9.1).

1. **Given** the fixture project is open.
2. **When** you navigate to the Forge Shell home view (first sidebar entry).
3. **Then** exactly **8** plugin status cards render — one per `PLUGINS` entry except forge-shell itself: **Cognitive Forge, Product Forge, Roadmap, Tasks, Memory, Rovo Agent Forge, Report Forge, Audio Forge**. No card is labeled "Productivity". (Cards for directories the fixture lacks — e.g. sessions, reports — may show their not-found state; the count and labels are what this scenario checks.)
4. **Then** the Tasks and Memory cards reflect that `tasks/` and `memory/` exist in the fixture.
5. **When** you press **Cmd+K** (the command-palette binding as landed by PR8).
6. **Then** the palette opens; typing `render` and selecting the "render-fixture" row (subtitle "memory · Memory") navigates to the Memory view. (A `mem` query would match nothing here — this gate's memory files are titled "render-fixture", which has no "mem" substring; `render` matches the title/filename.) Navigate back to home afterwards.

**Pass:** [ ] Tauri  [ ] Chrome FSA  [ ] Server

### AT-PR9.3 — Regression: board drag styling and keep-list rules survive the purge (DevTools spot check)

**Verifies:** WP8 keep-list — `.prod-parent-chip`, `.prod-col-drag-over`, `.prod-status-bar` (+ `.prod-visible`), and `.prod-layout` with `position: relative` all survive in `tasks-memory.css`; the purged `.prod-drop-indicator` / `.prod-markdown-content` are gone; board drag behaves exactly as landed by PR1.
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the Tasks view is open on the **Board** sub-view.
2. **Then** the card "Fixture with parent" shows a parent chip naming its parent story, and "Child of a task" shows a chip naming `task-101-fixture` — both rendered as styled chips, not bare text.
3. **When** you select a parent chip in DevTools Elements (a `button.prod-parent-chip`).
4. **Then** the Styles pane shows a matched `.prod-parent-chip` rule sourced from **`tasks-memory.css`** (not only user-agent defaults).
5. **When** you drag "Fixture with parent" from the **Open** column and hover it over the **In Progress** column without releasing.
6. **Then** the entire target column highlights (accent ring plus background tint — the `.prod-col-drag-over` affordance); no thin line indicator appears between cards.
7. **When** you drop the card on **In Progress**.
8. **Then** the card moves to the In Progress column and the bottom status pill flashes (the `.prod-status-bar` element briefly gains its visible state).
9. **When** you run this in the DevTools Console (computed-style spot check on a dragged-over column, without holding a drag):
   ```js
   var c = document.querySelector('#view-tasks .prod-column');
   c.classList.add('prod-col-drag-over');
   [getComputedStyle(c).boxShadow, getComputedStyle(c).backgroundColor];
   ```
10. **Then** `boxShadow` is not `"none"` and `backgroundColor` is not fully transparent (the keep-list rule fired). Run `c.classList.remove('prod-col-drag-over')` to clean up.
11. **When** you open the loaded `tasks-memory.css` in DevTools (Sources or the Styles pane's stylesheet link) and search it.
12. **Then** it contains rules for `.prod-status-bar`, `.prod-col-drag-over`, `.prod-parent-chip`, and a `.prod-layout` block containing `position: relative` — and contains **no** `.prod-drop-indicator` and **no** `.prod-markdown-content` rule.

**Pass:** [ ] Tauri  [ ] Chrome FSA  [ ] Server

### AT-PR9.4 — Regression: timeline bars and workload pills keep their colors in light and dark themes

**Verifies:** WP8 keep-list for the dynamically-built class families — `.prod-tl-high/.prod-tl-medium/.prod-tl-low` incl. `[data-theme="dark"]` variants and all `.prod-wl-status-*` rules survive the purge (they are constructed by string concatenation in tasks.js and are invisible to naive grep).
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the Tasks view is open, light theme active.
2. **When** you switch to the **Timeline** sub-view.
3. **Then** priority bars render colored, not gray/unstyled: "Fixture with parent" (priority 2) **red**, "Timeline medium" (priority 3) **orange**, "Timeline low" (priority 4) **blue**.
4. **When** you switch to the **Workload** sub-view.
5. **Then** each mini-card's status pill is tinted and distinct per status — Open (muted), In Progress (accent blue), Blocked (orange), Completed (green) — none render as untinted plain text.
6. **When** you click through **List**, **Summary**, and **Matrix**.
7. **Then** all three render with normal styling and no console errors (all six sub-views healthy).
8. **When** you toggle dark theme (moon icon in the shell chrome) and revisit Timeline and Workload.
9. **Then** timeline bars keep colored dark-theme variants (still red/orange/blue hues, not invisible or default-colored) and workload pills stay tinted. Toggle back to light theme.

**Pass:** [ ] Tauri  [ ] Chrome FSA  [ ] Server

### AT-PR9.5 — Regression: Memory view fully styled; markdown renders via rendered-body; modal edit/save works

**Verifies:** WP8 — deleting the ghost and purging `.prod-markdown-content` does not disturb the Memory view, which renders through `rendered-body` containers (as landed by PR2).
**Runtimes:** Tauri, Chrome FSA, Server.
**Setup:** fixture as section setup.

1. **Given** the Memory view is open on the fixture project.
2. **Then** the directory tabs render (root memory plus the **fixtures** directory) and memory cards are styled (bordered cards, not raw text).
3. **When** you open the **Render Fixture** file.
4. **Then** the content renders styled: a real `<table>` with the empty Reviews cell keeping column alignment, "Conventions" as a real heading, **small** in bold, "Style guide" as a real link, and "hostile" as plain text — no `javascript:` anchor in the DOM, no console errors.
5. **When** you inspect the rendered container in DevTools Elements and run `document.querySelector('.prod-markdown-content')` in the Console.
6. **Then** the rendered container carries the `rendered-body` class, and the Console query returns `null` (no element anywhere uses the purged class).
7. **When** you open the fixture file inside the **fixtures** directory tab so its modal appears, append a line in the raw-markdown edit box, and save. (Chrome FSA: grant the write permission prompt if shown.)
8. **Then** the save succeeds with the view's normal save feedback and the rendered content shows the appended line; `cat "$FIX/memory/fixtures/render-fixture.md"` confirms the edit reached disk.

**Pass:** [ ] Tauri  [ ] Chrome FSA  [ ] Server

### AT-PR9.6 — Negative: ghost assets truly gone from the served app; docs match reality

**Verifies:** WP8 deletion/rename actually happened (old URLs 404) and docs sync — README `## Plugin Registration` snippet matches `shell.js` byte-for-byte, STYLE_GUIDE tables list Tasks/Memory instead of Productivity, only the sanctioned provenance sentences mention "productivity".
**Runtimes:** Chrome FSA, Server (both are served by `node server.js`; direct-URL probes don't apply to Tauri's bundled assets). Docs steps 4–7 are runtime-independent — run once from a repo checkout of the merged branch.
**Setup:** `cd forge-shell && node server.js` running; repo checkout at the PR9 merge commit.

1. **Given** the server is up at `http://127.0.0.1:4173`.
2. **When** you probe the old and new asset URLs:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/css/productivity.css
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/js/productivity.js
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/css/tasks-memory.css
   ```
3. **Then** the first two print **404** and the third prints **200**.
4. **When** you compare the README plugin snippet with the source of truth (from `forge-shell/`):
   ```bash
   sed -n '/^const PLUGINS = \[/,/^\];/p' app/js/shell.js
   ```
5. **Then** the code block under `## Plugin Registration` in `forge-shell/README.md` is byte-identical to that output: 9 entries, no `productivity` row; and the `## Directory Structure` tree lists `tasks-memory.css` with the annotation "(formerly productivity.css)" and does **not** list `productivity.js` or `productivity.css`.
6. **When** you grep the docs and app (from repo root):
   ```bash
   grep -ni productivity forge-shell/README.md forge-shell/STYLE_GUIDE.md
   grep -rni productivity forge-shell/app forge-shell/test forge-shell/server.js forge-shell/src-tauri
   ```
7. **Then** the first grep hits only the sanctioned sentences — the STYLE_GUIDE exception paragraph ("Exception: the Tasks and Memory views share `tasks-memory.css` (formerly `productivity.css`) and use the legacy `prod-` prefix throughout; keep using `prod-` for rules in that file rather than introducing a second prefix."), the STYLE_GUIDE icon-table notes ("Shares `tasks-memory.css`, prefix `prod-` (legacy)"), and the README tree annotation — and the second grep hits only the header comment of `forge-shell/app/css/tasks-memory.css`. The STYLE_GUIDE `### Implemented Plugins` table has **Tasks** and **Memory** rows (no Productivity row), and the `### Font Awesome Icons by Plugin` table shows Tasks `fa-list-check` and Memory `fa-brain`.
8. **When** you confirm PR9 left the historical docs untouched — from the repo root run `git diff --name-only <PR8-tip>..HEAD -- docs/plans docs/reports docs/superpowers/plans` (substitute the PR8 merge commit for `<PR8-tip>`) — **Then** it prints nothing: the cleanup edited only `README.md` and `STYLE_GUIDE.md`, never the dated historical docs (WP8's "dated historical docs … untouched by the diff").

**Pass:** [ ] Chrome FSA  [ ] Server


---

## Program-level end-to-end (post-PR9)

Run **once**, after PR9 has merged to `main`, every per-PR gate above is recorded as passed, and `cd forge-shell && npm test` is green on the merged tree (full suite — 255 tests after PR8; PR9 adds none). This is the only section that runs against a **real project directory** — it is the "full-suite acceptance pass (status change, create/delete card, drag task, external-edit toast, Cmd+K, Escape everywhere) against a real project directory" that Rollout Plan step 4 calls for. These scenarios are cross-feature journeys and convention audits; they do not re-run per-gate checks.

**Real-project prerequisites (all scenarios):**
- Pick a real project with all seven data dirs populated (`cards/`, `tasks/`, `memory/`, `sessions/`, `reports/`, `rovo-agents/`, `audio-forge/recordings/`).
- The project must be under git with a **clean `git status`**; record the starting commit. Every write this section makes must be diffable (AT-E2E.4) and revertible (AT-E2E.7).
- Any `chmod 000` used to force a failure must be restored to `644` before moving on — AT-E2E.4 assumes a fully readable tree.
- Run scenarios in order: .1 → .7 (the soak and residue checks depend on the residue the earlier scenarios leave).
- Runtime honesty: if the Rust toolchain is unavailable, run what you can in Chrome FSA / Server, record the Tauri column as `SKIPPED (no toolchain)`, and treat the E2E pass as **incomplete** until AT-E2E.1's watcher steps run on a machine with Tauri.

### AT-E2E.1 — Full-workflow journey: create → status → drag → external-edit toast → Cmd+K → Escape → delete

**Verifies:** Rollout Plan step 4 journey end-to-end; D4 feedback channel at every step; D6 batching + own-write suppression; D7 palette deep-link.
**Runtimes:** Tauri (steps 6–7 are watcher-dependent, Tauri-only). If no toolchain: run steps 1–5 and 8–11 in Chrome FSA, mark steps 6–7 and the Tauri box `SKIPPED (no toolchain)`.
**Setup:** real project per section prerequisites; a terminal open at the project root for the external edits.

1. **Given** Tauri is launched (`cd forge-shell && npm run tauri:dev`) and the real project is selected, **Then** all views load with zero console errors and zero error toasts.
2. **When** in Product Forge I create a card inline (New Card flow: Type = epic, a unique title such as `E2E Journey <today>`, a valid status, a real parent), **Then** the card appears in the grid and a new file exists on disk under `cards/` with forge-lib naming; no error toast fires (per D4, an error toast on a success is a failure; a success signal here may be toast-channel — discrete lifecycle op, per the O5 rationale — but must not be an error-styled toast).
3. **Given** the spec's WP5 risk (a newly created card carries a null fileHandle until the next 5s scan — "window is ≤5s"), **When** I wait one poll cycle, **Then** the next step's write targets a scan-confirmed handle.
4. **When** I change the new card's status from the detail-header pill menu, **Then** the UI updates optimistically, success is signaled by the **ambient pill only** (no toast of any kind), and on disk only `status` and `updated` changed.
5. **When** I switch to Tasks and drag a real task across columns, **Then** success is pill-only, no error toast fires, and the file write is silent in the toast channel (frontmatter integrity is asserted in AT-E2E.4, not here).
6. **When** from the terminal I `touch` 3+ files under `cards/` within ~1 second, **Then** exactly ONE summarized toast for the `cards/` directory appears after the fixed **1.5s flush window** (D6) — not one toast per file — and both Product Forge and Roadmap reflect the change (D6 maps `cards/` to both).
7. **Then** none of my own UI writes from steps 2–5 produced a `File updated` style toast — "suppression evaluated at receipt time" (D6) keeps the external-change channel clean.
8. **When** I press Cmd+K and type the journey card's title, **Then** the palette opens above the active view, the card ranks in the results, and Enter lands in Product Forge with the card revealed (D7 `selectCard` deep-link).
9. **When** I "Escape everywhere": reopen the palette → Escape closes it; open the Roadmap drawer and its text search → each Escape unwinds exactly one layer; open the Tasks edit modal → Escape closes it; open any Confirm and Escape → resolves as cancel. **Then** every layer in the app dismisses from the keyboard alone; no layer required a mouse click to leave.
10. **When** I delete the journey card from Product Forge, **Then** the Confirm dialog shows the deletion details, confirming removes the card from the view and the file from disk, and no error toast fires.
11. **Then** across the whole journey: zero error toasts on successes, zero success pills on failures (none were forced here), zero console errors.

**Pass:** [ ] Tauri  ·  [ ] Chrome FSA (fallback run: steps 1–5 + 8–11, when no Tauri toolchain)

### AT-E2E.2 — Z-ladder and key-capture audit (D5 / C10)

**Verifies:** D5 ("views ≤1200 < palette 1250 < Confirm 1300"; Confirm's capture-phase document keydown "swallows all keys while visible"); C10 (palette at 1250, deliberately below Confirm).
**Runtimes:** Chrome FSA (DevTools computed-style checks) required; Tauri spot-check of the behavioral steps.
**Setup:** real project loaded; DevTools open in the Chrome FSA tab.

1. **Given** Roadmap is active with the drawer open and text search active (view surfaces, ≤1200), **When** I press Cmd+K, **Then** the palette renders visually above both; DevTools shows the palette overlay's computed z-index is **1250**.
2. **When** I press Escape, **Then** only the palette closes; the drawer and search underneath are still present and unchanged.
3. **When** I start a card delete so a Confirm is up, **Then** DevTools shows `#confirm-dialog` computed z-index **1300**, above everything.
4. **While the Confirm is visible**, **When** I press Cmd+K and Cmd+F, **Then** both are dead — the capture-phase keydown swallows them; no palette, no search toggle, no keystroke leaks to the view underneath.
5. **When** I press Escape, **Then** only the Confirm closes (resolving as cancel — no deletion); subsequent Escapes unwind the remaining layers one per press, in overlay order.
6. **Then** at no point does any view surface render above the palette, or the palette above the Confirm.

**Pass:** Chrome FSA [ ] · Tauri (spot-check) [ ]

### AT-E2E.3 — Feedback-convention audit (D4 sweep)

**Verifies:** D4 across every write-capable view: "errors are always 6s error toasts; the pill is ambient success only; unreadable files get a banner and are never treated as deleted". Any success in the error channel, or any error in the pill, fails the audit. Carve-out: discrete lifecycle successes (create/delete) may be success toasts per O5's rationale ("discrete lifecycle ops are toast-worthy; edits are pills") — but never error-styled.
**Runtimes:** Server required (`chmod` failure forcing is easiest there); Chrome FSA optional via the DevTools write-stub from the PR4 gate. Restore `chmod 644` after every forced failure.
**Setup:** real project; terminal at project root.

1. **Tasks:** **When** I save an edit-modal change on a real task, **Then** success is a pill. **When** I `chmod 000` that task file and save again, **Then** a 6s error toast fires and the edit rolls back; no success pill. Restore `644`.
2. **Memory:** **When** I save a memory file via its modal, **Then** success is a pill and the next 5s poll does not reload the view. **When** I force the write to fail, **Then** a 6s error toast fires and the modal stays open with my text intact. Restore.
3. **Product Forge:** **When** I change a status from the pill menu, **Then** success is a pill. **When** I force the write to fail and retry, **Then** an error toast fires (error channel, never a pill) and the pill/card revert to the pre-change status. Restore. *(Duration: this is the ported roadmap status write with no explicit duration, so ~3.5s — the `ForgeUtils.Toast` default — not 6s.)*
4. **Roadmap:** **When** I drag-reschedule a card, **Then** success stays in the sanctioned channel. **When** I force the write to fail and drag again, **Then** an error toast fires (error channel, never a pill) and the card snaps back. Restore. *(Duration: the reschedule write passes no explicit duration, so ~3.5s — the `ForgeUtils.Toast` default — not 6s.)*
5. **Unreadable ≠ deleted:** **When** I `chmod 000` one card file and let a refresh cycle run, **Then** a scan banner reports the unreadable file and the card is **not** dropped from the view or treated as deleted. **When** I restore `644`, **Then** the next clean scan clears the banner.
6. **Then** across the sweep: every failure surfaced in the **error-toast channel** (the tasks and memory paths at 6s; the ported roadmap status and reschedule writes at the ~3.5s `ForgeUtils.Toast` default — both error-styled, never a pill); every edit success was a pill; no success ever appeared error-styled; no error ever appeared as a pill.

**Pass:** Server [ ] · Chrome FSA (stub variant) [ ]

### AT-E2E.4 — Data-integrity soak + index reconciliation (D8)

**Verifies:** shape-preserving writes across the whole run; D8: "Shell writes bypass `cards/index.json` / `tasks/index.json` by design; `forge index rebuild` remains the reconciliation contract".
**Runtimes:** any one (disk-level; run after AT-E2E.1–.3 with all chmods restored).
**Setup:** terminal at the real project root; forge-lib installed per repo CLAUDE.md.

1. **Given** the journey and audit are complete, **When** I run `git status` and `git diff` in the project, **Then** only intentional changes appear: the moved/edited task file(s), the edited memory file, the status-changed card(s), the deleted journey card, and (if the journey card was bucketed) `roadmap.md` — nothing else.
2. **For every touched task file:** `parent`, `source`, and any unknown/custom frontmatter keys are still present verbatim; no schema-forbidden keys were added; `status` is a valid value; `updated` is today's date.
3. **For every touched card file:** frontmatter field order is preserved; status writes changed only `status` + `updated`; the created-then-deleted journey card is fully gone from disk.
4. **Given** D8, **Then** `cards/index.json` and `tasks/index.json` are expected to be stale right now — that is by design, not a defect.
5. **When** I run forge-lib's index rebuild as the reconciliation step — `python forge-lib/forge.py index rebuild` with the appropriate `--directory`/`--plugin` arguments for the project's `cards/` dir (as PR5's gate ran it) and again for `tasks/`, **Then** both commands exit cleanly and report/repair the indexes to match disk without touching any `.md` file.
6. **When** I relaunch the shell against the same project, **Then** every view renders identically to before the rebuild (the shell scans the filesystem, not the indexes) and `git diff` shows only the index files changed by the rebuild.

**Pass:** runtime used: ______ [ ]

### AT-E2E.5 — Three-runtime parity spot-check (no-watcher freshness)

**Verifies:** the same core journey behaves identically where no watcher exists — Chrome FSA and Server run on 5s pollers only.
**Runtimes:** Chrome FSA (real Chrome/Edge tab, native `showDirectoryPicker`) and Server (`node server.js` → `http://127.0.0.1:4173` in an embedded/no-FSA browser, typed-path dialog).
**Setup:** real project (same one); short journey only — no external-edit toast step (watcher-dependent, Tauri-only, already covered by AT-E2E.1).

1. **Given** the runtime boots and the project is selected (native picker in Chrome FSA; typed-path dialog in Server), **Then** no watcher errors appear on boot and no console errors during project load.
2. **When** I run the short journey — create a card, change its status from the pill menu, drag a task across columns, Cmd+K to the card, Escape out of every layer, delete the card — **Then** every step behaves exactly as in AT-E2E.1 steps 2–5 and 8–10, including identical feedback channels (D4).
3. **When** after each write I watch the sibling view (Roadmap for card writes), **Then** it converges within one ~5s poll cycle — no manual refresh needed, and no staleness beyond the polling interval.
4. **When** I make one external edit to a card file from the terminal, **Then** there is no watcher toast in these runtimes (expected — pollers only), but the views still pick up the change within ~5s.
5. **Then** both runtimes complete the journey with zero errors and no behavioral divergence from Tauri beyond the documented watcher/toast difference.

**Pass:** Chrome FSA [ ] · Server [ ]

### AT-E2E.6 — Docs-truth check (PR9 docs sync vs shipped app)

**Verifies:** D9, O11, and Rollout step 4's "PR9 lands the docs sync (STYLE_GUIDE/README describe final state)" — the docs match the merged app, not an intended state.
**Runtimes:** any one running instance for the boot checks; the rest is static reading of the merged tree.
**Setup:** merged `main` checked out; one runtime running against the real project.

1. **When** I compare the forge-shell README's plugin/view list against `shell.js`'s actual registrations and the Home view's plugin status cards, **Then** they match one-for-one — no listed plugin missing from the app, none shipped but undocumented (O11: full sync).
2. **When** I search the merged tree, **Then** `productivity.js` and `productivity.css` do not exist; `tasks-memory.css` exists and is the stylesheet `index.html` links; the running app loads it with no 404.
3. **When** I read STYLE_GUIDE.md, **Then** it contains: the D4 severity-channel table (and its rows match the behavior observed in AT-E2E.3), the overlay layering ladder matching D5's "views ≤1200 < palette 1250 < Confirm 1300" (and AT-E2E.2's measured values), and the sanctioned exception that "`prod-*` class strings" remain (D9) with the CSS file rename noted, the Markdown Rendering section (WP7's single-renderer rule), the Overlay Dismissal Contract section (WP6's Escape/backdrop/z-ladder contract), and the shared card-write-service section (WP5, including the `forge index rebuild` reconciliation note that shell writes bypass `cards/index.json`/`tasks/index.json`, per D8).
4. **When** I grep the app for `prod-` class usage, **Then** live usages still exist (they were sanctioned, not renamed) — a docs claim of full removal would be a failure.
5. **Then** no doc statement about the shell's final state contradicts anything observed in AT-E2E.1–.5.

**Pass:** [ ] (record runtime used for boot rows)

### AT-E2E.7 — Real-project residue, O6 tolerance, and restore

**Verifies:** the E2E pass leaves the real project safe; O6 ("leave the stale entry" — deleted cards are not scrubbed from `roadmap.md` bucket lists; "verify the bucket render path tolerates a missing store entry").
**Runtimes:** any one.
**Setup:** run last, after AT-E2E.4's rebuild.

1. **O6 tolerance (conditional):** only if the real project has a `roadmap.md` with bucket lists — during AT-E2E.1, the journey card should have been dragged into a release bucket before deletion. **Given** that happened, **When** I open Roadmap now, **Then** the stale bucket entry for the deleted card is still in `roadmap.md` (by design, O6) and the Roadmap view renders without errors, silently tolerating the missing store entry. If the project has no bucketed `roadmap.md`, record this step `n/a`.
2. **When** I review the project's full `git diff` one last time, **Then** every hunk is attributable to a specific scenario step above; anything unattributable is a program defect — investigate before restoring.
3. **When** I either commit the intentional changes deliberately or `git restore` the project to its starting commit (team's choice — record which), **Then** the working tree is clean.
4. **When** I relaunch the shell against the restored/committed project, **Then** all views load cleanly — the pass left no state the app cannot re-read.
5. **Then** as final housekeeping per Rollout step 4, the local `ux-program/pr-*` stack branches are deleted.

**Pass:** [ ]

**Verdict:** the program-level pass is complete when AT-E2E.1–.7 all pass, with the Tauri column genuinely run (not skipped) for AT-E2E.1, and every skip recorded explicitly.
