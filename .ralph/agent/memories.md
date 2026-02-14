# Memories

## Patterns

### mem-1771052676-7da3
> rovo-forge plugin: 2 commands (642 lines), 3 skills (1,319 lines), 2 sample-configs (288 lines). ZERO changes from v1 - already pure conversational workflows with no file operations. Output is copy-ready text for Rovo Studio UI. Perfect example of v2 architecture goals. 1:1 migration with only metadata (plugin.json, README.md)
<!-- tags: rovo-forge, plugin-structure, zero-change | created: 2026-02-14 -->

### mem-1771047106-e92a
> decision.md transformed (102 lines). Pattern: 4-phase workflow (extract, classify, confirm, create) with critical user confirmation before persisting. Delegates to forge card create decision with JSON data.
<!-- tags: product-forge, command-transformation | created: 2026-02-14 -->

### mem-1771046802-36cf
> Product-forge commands delegate to forge-lib CLI: forge card create/get/query/update for CRUD, forge relationship link for parent-child linking. Commands focus on conversational workflow only. Pattern: mode routing → gather context → draft with pm-methodology skill → present for approval → save via forge-lib → link via forge relationship
<!-- tags: product-forge, forge-lib, cli-delegation | created: 2026-02-14 -->

### mem-1771046561-3d1b
> v2 command pattern: mode routing (create/update/review) → gather context → draft with pm-methodology → present for approval → save via 'forge card create/update [type] --data' → link via 'forge relationship link'. Commands ~150-200 lines, down from 250-300 in v1
<!-- tags: product-forge, commands, v2-architecture | created: 2026-02-14 -->

### mem-1771046383-60d2
> Product-forge v2 command transformation pattern: Mode Routing → Conversational Workflow → forge-lib CLI Delegation. Commands reduced ~40% (261→159 lines). All file ops delegate to forge card create/update/query and forge relationship link. Frontmatter JSON includes body content fields (background, proposed_solution, etc). Templates render in forge-lib.
<!-- tags: product-forge, commands, v2 | created: 2026-02-14 -->

### mem-1771046092-7d2c
> product-forge plugin structure: skills are reasoning-only (pm-methodology, product-context), all file operations delegated to forge-lib CLI (forge card, forge memory, forge relationship). Commands directory ready for Phase 2C.
<!-- tags: forge-v2, product-forge, architecture | created: 2026-02-14 -->

### mem-1771045809-7b68
> relationship_ops.py manages bidirectional parent-child relationships. Uses link_to_parent() to add child to parent's children array and update parent's updated date. VALID_RELATIONSHIPS defines hierarchy: initiative→epic/decision, epic→story/decision. find_orphans() detects broken parent references.
<!-- tags: forge-lib, relationships | created: 2026-02-14 -->

### mem-1771045467-49cb
> card_ops.py uses create_index_entry() for new cards and update_index_entry() for updates. Query uses index_data['entries'] not 'cards'. Date normalization required before validation (date objects → strings).
<!-- tags: forge-lib, card-ops, index | created: 2026-02-14 -->

## Decisions

## Fixes

## Context

### mem-1771055182-68b3
> Forge Marketplace v2 rebuild complete. All 8 phases delivered: Foundation, Product Forge, Forge Memory, Tasks Forge, Cognitive Forge, Report+Rovo Forge, Forge Shell, Root Documentation. Success metrics met: 60% command reduction (260→100 lines), skills reasoning-only, index.json queries, forge-lib CLI documented. 20 commits, 6 validation checkpoints passed, 6 plugins + 1 desktop app + 1 Python library.
<!-- tags: forge-marketplace, rebuild, completion | created: 2026-02-14 -->

### mem-1771054778-3f65
> Forge Marketplace v2 rebuild COMPLETE. All 8 phases delivered: foundation, 6 plugins (product-forge, forge-memory, tasks-forge, cognitive-forge, report-forge, rovo-forge), forge-shell updates, root documentation. Total: 26,997 lines (4,717 Python + 11,309 plugin markdown + 10,971 JavaScript). Commands reduced 60%, all file ops via forge-lib, skills reasoning-only, queries via index.json. Validated via 7 checkpoints (1-6 functional, 8 structural).
<!-- tags: forge-marketplace-v2, completion, milestone | created: 2026-02-14 -->

### mem-1771054504-b0ee
> Phase 8B complete: All 6 plugin READMEs exist (1,819 lines total). Each README documents command workflows, forge-lib integration patterns, and usage examples. product-forge (247), forge-memory (281), tasks-forge (309), cognitive-forge (290), report-forge (367), rovo-forge (325).
<!-- tags: phase-8, documentation | created: 2026-02-14 -->

### mem-1771054302-882a
> Phase 8A complete: Root documentation (CLAUDE.md 93 lines, README 515 lines, marketplace.json 6 plugins, forge-lib/README 178 lines). CLAUDE.md is thin routing layer vs 270 lines in v1. README provides architecture overview, installation, quick starts. Commit f9f9341.
<!-- tags: phase-8, documentation | created: 2026-02-14 -->

### mem-1771053962-8c65
> Phase 7 complete: Core shell updates (shell.js PLUGINS array, ForgeUtils.readIndex() in utils.js) + 6 view controllers updated for index.json (product-forge, tasks, cognitive-forge, report-forge, rovo-agent-forge, roadmap). memory.js deferred (custom structure). Commits: 0e8fd93, 2d5cded.
<!-- tags: forge-shell, phase-7 | created: 2026-02-14 -->

### mem-1771053805-785c
> Phase 7B complete: Updated 6 view controllers to use ForgeUtils.readIndex() instead of directory scanning (product-forge.js, tasks.js, cognitive-forge.js, report-forge.js, rovo-agent-forge.js, roadmap.js). memory.js deferred (custom structure). Commit 2d5cded.
<!-- tags: forge-shell, phase-7, index-json | created: 2026-02-14 -->

### mem-1771052977-7322
> Validation Checkpoint 6 complete: Found and fixed duplicate handle_report_update() bug in forge.py. All 10 validation tests passed: report init, create (date-based naming), query, update, index.json, rovo sample configs, rovo skills. Phase 6 fully validated.
<!-- tags: validation, phase-6, bug-fix | created: 2026-02-14 -->

### mem-1771049397-3bc8
> Validation Checkpoint 3 complete: All 11 tests pass. Memory init creates 4 files. Taxonomy CRUD returns valid JSON (get-taxonomy, set-taxonomy). Cross-plugin integration works (Product Forge can create/query cards with product from taxonomy). Fixed missing --product arg in card query parser.
<!-- tags: validation, phase-3, cross-plugin | created: 2026-02-14 -->

### mem-1771049131-9271
> Validation Checkpoint 3 passed: memory_ops.py taxonomy CRUD verified (init, get, set/add/remove), cross-plugin integration confirmed (Product Forge queries taxonomy via forge memory get-taxonomy). All 6 taxonomy types functional.
<!-- tags: forge-lib, validation, memory, phase-3 | created: 2026-02-14 -->

### mem-1771047798-1a4a
> Phase 2 (Product Forge) complete: 11 commands transformed (avg 100 lines, down from 260), 3 skills created (reasoning-only), plugin.json and README.md finalized. All file operations delegated to forge-lib.
<!-- tags: product-forge, phase-2, milestone | created: 2026-02-14 -->

### mem-1771047537-ebd9
> Phase 2C complete: All 11 product-forge commands transformed (init, initiative, epic, story, intake, decision, checkpoint, release-notes, link-to-jira, pull-from-jira, push-to-jira). Average reduction 35% from original. Pattern: delegate to forge-lib CLI, keep conversational workflow, preserve domain logic.
<!-- tags: product-forge, phase-2, milestone | created: 2026-02-14 -->
