# Design Plans view — initiative-grouped browser for superpowers docs

**Date:** 2026-07-15  
**Status:** Draft for review  
**Scope:** A new forge-shell plugin that browses the superpowers design/planning docs (`docs/superpowers/{specs,plans,handoffs}/`) from a dedicated docs-root, grouped by initiative (the shared `YYYY-MM-DD-<slug>`), with search, faceted filtering, and a rendered reading view. Read-only in v1.  
**Files:** `forge-shell/app/js/design-plans.js`, `forge-shell/app/js/design-plans.helpers.js`, `forge-shell/app/css/design-plans.css`, `forge-shell/app/index.html`, `forge-shell/app/js/shell.js`, `forge-shell/app/css/theme.css`, `forge-shell/server.js`, `forge-shell/app/js/fs-adapter.js` (docs-root accessors), `forge-shell/test/design-plans.helpers.test.js`.  
**Related:** `docs/superpowers/specs/2026-07-09-pfl-sidebar-progressive-findability-design.md` (sidebar + search + filter-panel conventions reused); `docs/superpowers/specs/2026-07-07-collapsible-resizable-plugin-sidebars-design.md` (sidebar contract).

## Problem

The cowork-database repo is the source of truth for product work, and the forge-shell overlays it as a UI. The `docs/superpowers/` tree holds ~65 specs and ~74 plans (plus a few handoffs), but the forge-shell has **no view for them**. Today these docs are navigable only by opening files in an editor or reading the generated, metadata-poor `docs/INDEX.md`.

Two properties of this data make a plain file list the wrong fit:

1. **Docs come in pairs.** A spec `YYYY-MM-DD-<slug>-design.md` and its plan `YYYY-MM-DD-<slug>.md` share a date+slug and are meant to be read together. A flat list hides that relationship until you open a file and spot its `**Spec:**` / `**Builds on:**` pointer.
2. **Metadata is inconsistent.** Status lives only inside the doc, in two coexisting formats (bold-inline majority vs. YAML frontmatter minority), as free text. No existing view normalizes it for scanning or filtering.

## Goal

Ship a navigate-and-browse plugin — **Design Plans** (`id: design-plans`, CSS prefix `dp-`) — where the unit of browsing is the **initiative** (the date+slug cluster), so a spec sits beside its plan(s) and handoff(s). The value is fast discovery and reading, with enough structure (status normalization, plan progress, topic facet) to orient across ~140 docs.

- **Primary job:** find and read any spec/plan fast; understand the spec+plan pair for a given initiative as a unit.
- **Read-only in v1** — viewing rendered markdown only.

## Non-goals (future)

- Authoring, editing, or changing doc status from the UI.
- Surfacing the `.superpowers/sdd/` execution-state layer (task briefs/reports/review diffs).
- A pipeline/kanban view (Approach C card board) or a true spec↔plan↔builds-on **lineage graph** (Approach A/C variants).
- True side-by-side spec+plan rendering — v1 ships a single "Jump to sibling" affordance (see UI).
- Cross-repo browsing (one docs-root at a time).

## Data source & root

**Docs-root:** a dedicated path, independent of the active Forge project folder, that the user points at the repo holding the superpowers docs (typically the cowork-database repo). Stored per runtime via a small abstraction mirroring the existing project-path accessors:

- `ForgeFS.getDocsRoot()` / `ForgeFS.setDocsRoot(path)` / `ForgeFS.pickDocsRoot()` — return/accept an absolute path (Tauri, Server) or a handle (Browser).
- **Server:** extend `config.json` with `docsRoot`; `/api/config` returns it; add `POST /api/config/docs-root` (`{path}` → validate dir exists, persist, return). Bound to `127.0.0.1` like all other endpoints.
- **Tauri:** store `docsRoot` alongside `currentProject` (same store as project path).
- **Browser:** limited — only works if the user grants File System Access to that directory; treat Tauri/Server as primary targets and show a clear caveat in the empty state.

No change to how the active project folder is selected — this tab is decoupled from it.

## Data model & parsing

Loaded via `ForgeFS.listMarkdownFiles(docsRoot, 'docs/superpowers')` (recursive `.md`), then `ForgeFS.readFile` per file. Each file is classified by path and parsed into a **Doc**. **All parsing logic is pure** and lives in `design-plans.helpers.js` (UMD, Node-testable) — this is where the complexity concentrates.

### Doc

```
Doc = {
  filename,            // basename
  relPath,             // repo-root-relative, e.g. docs/superpowers/specs/2026-07-08-x-design.md
  type,                // 'spec' | 'plan' | 'handoff' | 'other'
  date,                // ISO date from filename (authoritative)
  slug,                // kebab slug from filename, '-design' stripped on specs
  title,               // from YAML title or H1, fallback to slug
  statusRaw,           // raw status string (may be undefined)
  statusBucket,        // normalized bucket (see below)
  topic,               // inferred cluster or null
  body,                // full markdown text
}
```

### Filename parsing

`parseFilename(filename)` extracts `date` (leading `YYYY-MM-DD`) and `slug`. The spec suffix `-design` is stripped so the spec and its plan share the same `slug`. `classifyType(relPath)` returns `spec`/`plan`/`handoff`/`other` from the parent directory.

### Initiative grouping

`initiativeKey(doc) = date + slug`. `groupInitiatives(docs)` clusters Docs into:

```
Initiative = {
  key, date, slug, title,
  spec,                 // Doc | null
  plan,                 // Doc | null (revisions are separate initiatives, so at most one plan shares this key)
  handoffs: [Doc, ...], // 0..n (multiple handoff files are possible)
  statusBucket,         // rolled up (see below)
  progress,             // plan progress (null if no plan / no checkboxes)
}
```

**Revisions are separate initiatives.** `…-mcp-revision`, `…-agent-fix`, etc. have distinct slugs (and often dates), so they do not merge into the original initiative. They are discoverable via the **topic** facet, not by collapsing into one saga. This keeps grouping deterministic and simple.

### Metadata parsing (dual-format)

`parseDocMeta(rawText, filename)` must extract from **both** formats and never throw:

- **YAML frontmatter** (minority, newer): `title`, `status`, `created`, `updated`, `xref`. Parse via the shared `ForgeUtils.YAML.parse`.
- **Bold-inline** (majority): `**Date:**`, `**Status:**`, `**Builds on:**`, `**Spec:**` lines near the top.
- **Fallbacks:** `title` from the first `# H1`; if absent, from the slug. `date` always from the filename (authoritative over in-body date).

`buildsOn` / `specRef` pointers may be captured on the Doc for later use (graph view) but are **not rendered** in v1 beyond the Jump-to-sibling button.

### Status normalization

`normalizeStatus(statusRaw)` maps free text to a fixed bucket set used for pills and the status facet:

| Bucket | Matches (case-insensitive, substring) |
|--------|---------------------------------------|
| `Draft` | `draft` |
| `In Review` | `proposed`, `awaiting`, `for review`, `brainstorm` |
| `Approved` | `approved` |
| `Done` | `done`, `implemented`, `shipped`, `complete` |
| `Rolled Back` | `rolled back`, `rollback` |
| `Unknown` | (no match / no status) |

Initiative roll-up: prefer the spec's bucket; else the plan's; else `Unknown`.

### Plan progress

`planProgress(body)` counts all task-list markdown checkboxes in the body: `done` = `- [x]`, `total` = `- [ ]` + `- [x]`. Returns `{ done, total, percent }`. Plans with zero checkboxes report `percent: null` (shown as no bar). Counting all task-list items (rather than scoping to `## Task` sections) keeps the parser simple and robust.

### Topic inference

`inferTopic(slug, knownClusters)` matches the slug against a configurable cluster list (orson, cron, sf-ums, jira-intake, memory, docs, audio, repo, …). Heuristic, single-best-match, else `null`. The list is data-driven so new clusters are added without code changes.

## UI layout & components

Standard plugin layout (matches the established contract):

```
┌─ toolbar ──────────────────────────────────────────────────────┐
│ [☰] Design Plans    {docsRoot}/docs/superpowers      [▣][↻]    │
├────────────────┬───────────────────────────────────────────────┤
│ 🔍 search…     │  # <Title>                                    │
│ ─────────────  │  ● <StatusBucket>   <date>   topic: <topic>   │
│ ▾ 2026-07-08   │  ─────────────────────────────────────────────│
│   jira-intake  │  (rendered markdown via .rendered-body)        │
│   📄 spec  ●   │                                                │
│   ✅ plan ▣60% │   ⤴ Jump to plan                              │
│ ▾ 2026-07-04   │                                                │
│   cron-mech    │                                                │
│   📄 spec  ●   │                                                │
│   ✅ plan ▣100%│                                                │
│   ✋ handoff   │                                                │
│ ▸ 2026-06-30   │                          ← filter slide-out:  │
│   repo-cleanup │                            status/type/topic/  │
└────────────────┴───────────────────────────────────────────────┘
```

- **`dp-layout`** grid (`grid-template-rows: var(--toolbar-height) 1fr`; `grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr`; `position: relative`) + `.plugin-toolbar` + `dp-sidebar` + `.sidebar-resizer` + `dp-detail-panel` + direct-child `dp-filter-panel` (panel anchored to layout right edge per the filter-panel rule).
- **Toolbar:** sidebar toggle, title, docs-root path, spacer, filter toggle, refresh. No folder-path ambiguity — shows the docs-root.
- **Sidebar:** search input, then initiatives **newest-date-first** as collapsible groups. Each group header shows date + slug/title + rolled-up status dot. Expanding lists member rows: type icon (`📄` spec / `✅` plan / `✋` handoff), status dot, and for plans a thin progress bar (`▣ NN%`). Selecting a doc renders it in the detail panel. Wired through `Sidebar.init({...})` for collapse/resize (persisted to `forge-shell-sidebar-design-plans-{width|collapsed}`).
- **Search:** non-empty query → ranked flat results list (substring on title + slug + body, reuse the PFL ranking approach); empty query restores the initiative tree. Filters still apply to the candidate set.
- **Detail panel:** renders selected doc's markdown in shared `.rendered-body`. Header = title + status pill + date + topic tag + (plans) progress. A **"Jump to sibling"** button switches spec↔plan within the same initiative (the v1 pairing affordance; full side-by-side is a non-goal).
- **Filter panel** (`data-dp-action="toggle-filter"`): status bucket, type, topic, date-range. Active filters render in a `dp-active-filters` strip under the toolbar.
- **Empty state:** when no docs-root is set (or the dir has no superpowers docs), show an `.empty-state` prompting the user to pick the docs-root via `ForgeFS.pickDocsRoot()`.

## Integration & conventions

- **Plugin registration:** add `{ id:'design-plans', label:'Design Plans', icon:'fa-solid fa-diagram-project', requiredDir:null }` to `PLUGINS` in `app/js/shell.js`. Add `<div id="view-design-plans" class="shell-view">` and `<link>`/`<script>` tags (helpers before controller) to `app/index.html`.
- **Controller:** IIFE exporting `window.DesignPlansView`, registered via `Shell.registerController('design-plans', …)` implementing `init(rootHandle, options)` / `destroy()` / `refresh()`. All DOM queries scoped to `#view-design-plans` (local `$q`/`$qa` helpers, matching other plugins).
- **fs-adapter:** no change to the read API (`listMarkdownFiles` + `readFile` already cover this). Add the `getDocsRoot`/`setDocsRoot`/`pickDocsRoot` accessors above. Add a file-watcher branch in `shell.js` `_onFileChanged` (`path.includes('/docs/superpowers/')` → call `DesignPlansView.refresh()` when active) for live refresh in Tauri.
- **CSS:** new `app/css/design-plans.css`; reuse `components.css` classes (`.plugin-toolbar`, `.sidebar-card`, `.sidebar-search`, `.status-pill`, `.metadata-grid`, `.rendered-body`, `.modal-*`, `.empty-state`). Add topic and status-bucket color tokens to `theme.css` (`:root` + `[data-theme="dark"]`). **No mobile/responsive CSS** (the app is desktop-only).

## Testing & error handling

**Unit tests (`node --test`)** in `test/design-plans.helpers.test.js` cover the pure helpers, which hold the real complexity:

- `parseFilename` / `classifyType` (spec suffix stripping; path-based type).
- `parseDocMeta` across both metadata formats + mixed + malformed (YAML parse failure → bold-inline fallback; no metadata → filename/H1 fallback).
- `initiativeKey` / `groupInitiatives`: spec+plan pair; spec-without-plan; plan-without-spec; revisions as **separate** initiatives; handoff attached.
- `normalizeStatus`: each bucket + `Unknown` fallback.
- `planProgress`: counts, zero-checkbox (`percent: null`), all task-list checkboxes counted regardless of section.
- `inferTopic`: known cluster match + no-match (`null`).

**Error handling:**

- Missing/unset docs-root → empty state with the picker (never an error toast on first run).
- Unreadable file → skip it, toast a count of skipped files, continue rendering the rest.
- Malformed metadata → fall back to filename-derived date/slug/title; never crash a render.
- `normalizeStatus` always returns a bucket (`Unknown`).

## Verification

- `npm test` green (existing suite + new `design-plans.helpers.test.js`).
- Manual QA in `npm run serve`: browse a real spec, a large plan (up to ~119 KB), and a handoff; confirm status pills, plan progress bars, search ranking, filter combinations, and the Jump-to-sibling button.
- Confirm the empty state appears before a docs-root is chosen and resolves after picking one.
- Cross-runtime note: Tauri/Server are the supported targets; browser mode shows the access caveat.
