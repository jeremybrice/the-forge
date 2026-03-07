# Mission Brief

**Playbook:** doc-sprint
**Design Doc:** docs/plans/2026-03-07-documentation-sprint-design.md
**Created:** 2026-03-07

## Requirements Summary

1. Create `docs/ARCHITECTURE.md` (~100 lines) — system layers, plugin anatomy, forge-shell architecture
2. Create `docs/PATTERNS.md` (~130 lines) — orchestrator, skill, agent recruitment, CLI integration patterns
3. Create `docs/DATA_FLOW.md` (~140 lines) — data ownership map, shared contracts, forge-shell loading
4. Create `docs/DECISION_LOG.md` (~70 lines) — indexed reference to 33+ design docs
5. Update `CLAUDE.md` Documentation section — add 4 pointer lines to reference new docs

## Key Files

| File | Role |
|------|------|
| `CLAUDE.md` | Primary reference — architecture, plugins table, file naming patterns |
| `README.md` | Mermaid architecture diagram, plugin overview |
| `forge-lib/README.md` | CLI reference, integration patterns, exit codes |
| `forge-shell/README.md` | View controller pattern, PLUGINS array, directory structure |
| `forge-shell/STYLE_GUIDE.md` | UI standardization conventions |
| `forge-shell/app/js/utils.js` | ForgeFS implementation (data loading ground truth) |
| `forge-shell/app/js/card-data.js` | How forge-shell reads card data |
| `product-forge/README.md` | Orchestrator + agent pattern example |
| `cognitive-forge/README.md` | Agent recruitment logic example |
| `tasks-forge/README.md` | Agent-less pattern contrast |
| `report-forge/README.md` | Multi-agent orchestration example |
| `forge-lib/schemas/` | JSON Schema files for all entity types |
| `forge-lib/templates/` | Jinja2 templates |
| `docs/plans/` | All 33+ design docs for DECISION_LOG |
| `docs/plans/2026-03-07-documentation-sprint-implementation.md` | Implementation plan with task details |

## Test Command

`cd forge-lib && python -m pytest tests/ -v`

Note: Test command validates no code was broken. This sprint produces documentation only — never modify source code.

## Developer Callouts

1. **Documentation only** — Never modify source code, schemas, templates, or JavaScript. Only create/modify `.md` files.
2. **AI agent audience** — Dense reference, not narrative prose. Each doc should be fully loadable without context pressure (70-160 lines).
3. **Don't duplicate** — Reference existing docs (CLAUDE.md file naming table, forge-lib/README.md CLI reference) rather than repeating their content.
4. **CLAUDE.md stays lean** — Only add 4 pointer lines to the Documentation section. Don't restructure or expand other sections.
5. **Implementation plan exists** — `docs/plans/2026-03-07-documentation-sprint-implementation.md` has detailed task steps, source materials, and verification commands for each deliverable.

## Success Criteria

1. An agent can determine which plugins consume `cards/index.json` without reading plugin source code
2. An agent can identify the orchestrator pattern and apply it when modifying a command
3. An agent can find the design doc that explains why forge-memory uses a decay algorithm
4. All claims in the new docs are verified against the actual codebase by the accuracy checker
