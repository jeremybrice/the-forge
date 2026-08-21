# Decision Log — The Forge Marketplace v2

Index of design decisions. Each entry links to the full design doc in `docs/plans/`.

**Maintenance:** When creating a new design doc, add an entry here.

## August 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-08-21 | Cursor and Grok Build only host contract; delete Claude, Codex, and OpenCode packaging; Relay stays with Cursor-source Grok pairs | repo-wide | [design](superpowers/specs/2026-08-21-cursor-grok-native-repo-design.md) |
| 2026-08-13 | Shared initiative/epic/story lifecycle; hide closed work by default; downward cascade on close | product-forge, forge-lib, forge-shell | [design](superpowers/specs/2026-08-13-pfl-shared-lifecycle-hide-closed-design.md) |

## July 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-07-11 | Hard-delete channel/email harvest plugins and related forge-lib + Forge Shell surfaces | repo-wide, forge-lib, forge-shell | (this removal) |

## March 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-03-07 | Documentation sprint — 4 cross-cutting reference docs | repo-wide | [design](plans/2026-03-07-documentation-sprint-design.md) |
| 2026-03-06 | Add jira_card to Epic schema; add status filter to Product Forge view | product-forge, forge-lib, forge-shell | [design](plans/2026-03-06-epic-jira-card-attribute.md) |
| 2026-03-05 | Fix assignee HTML escaping and keyboard shortcut scope in tasks search | forge-shell | [design](plans/2026-03-05-tasks-search-bugfixes.md) |
| 2026-03-04 | Add search and filtering to Tasks page with dimming non-matches | forge-shell | [design](plans/2026-03-04-tasks-search-design.md), [frontend](plans/2026-03-04-tasks-search-frontend-design.md), [impl](plans/2026-03-04-tasks-search-implementation.md) |
| 2026-03-03 | Builder for Microsoft 365 Copilot Declarative Agents (rovo-forge pattern) | copilot-forge | [design](plans/2026-03-03-copilot-forge-design.md), [impl](plans/2026-03-03-copilot-forge-implementation.md) |
| 2026-03-01 | Fix 6 issues (score >= 80) from PR #14 code review | forge-lib, forge-memory, forge-shell | [fix](plans/2026-03-01-pr14-cr-fixes.md) |

## February 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-02-28 | Fix 6 code review issues from PR #14 (Living Memory System) | forge-lib, forge-memory | [fix](plans/2026-02-28-pr14-cr-fixes.md) |
| 2026-02-27 | Layered user guide and AI migration runbook for living memory | forge-memory | [design](plans/2026-02-27-living-memory-documentation-design.md), [impl](plans/2026-02-27-living-memory-documentation.md) |
| 2026-02-26 | Add passive harvesting, decay lifecycle, and triage curation to forge-memory | forge-memory, forge-lib, forge-shell | [design](plans/2026-02-26-living-memory-system-design.md), [impl](plans/2026-02-26-living-memory-system-implementation.md) |
| 2026-02-26 | Smooth exponential decay alternative — **deferred** pending telemetry data | forge-memory | [reference](plans/2026-02-26-option-d-hybrid-decay-reference.md) |
| 2026-02-22 | Rebrand README as polished product landing page for portfolio | repo-wide | [design](plans/2026-02-22-readme-rebrand-design.md) |
| 2026-02-22 | Fix toolbar icon confusion and visual issues on tasks page | forge-shell | [design](plans/2026-02-22-tasks-page-toolbar-refinements-design.md) |
| 2026-02-17 | Validate all plugins follow forge-lib compliance rules | repo-wide | [audit](plans/2026-02-17-marketplace-standardization-audit.md), [fixes](plans/2026-02-17-marketplace-standardization-fixes.md) |
| 2026-02-17 | Restructure product-forge from 11 commands to 8 commands + 6 agents | product-forge | [design](plans/2026-02-17-product-forge-restructuring-design.md), [impl](plans/2026-02-17-product-forge-restructuring.md) |
