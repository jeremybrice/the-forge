# Mission Brief

**Playbook:** feature-build
**Design Doc:** /Users/jeremybrice/Documents/GitHub/the-forge-feature/docs/plans/2026-03-06-epic-jira-card-attribute.md
**Created:** 2026-03-06

## Requirements Summary

1. Add `jira_card` attribute to Epic JSON Schema, matching the existing pattern from Initiative and Story schemas
2. Add `jira_card` to the Epic Jinja2 template frontmatter so new epics render the field
3. Add `jira_card` to the forge-shell Epic card data (field order) and edit form UI
4. Update all three Jira command docs (`link-to-jira`, `push-to-jira`, `pull-from-jira`) to use unified `jira_card` field name for all card types, removing `jira_key` backward compatibility references
5. Update the `jira-sync` skill to reference `jira_card` consistently for all card types
6. Add test coverage for epic card creation with `jira_card` attribute
7. Add a slide-out per-type status filter panel to the Product Forge view (Initiative/Epic/Story status multi-select filters), following the Roadmap filter pattern

## Key Files

- `forge-lib/schemas/epic.json` — Epic JSON Schema to extend with `jira_card` property
- `forge-lib/templates/epic.md.j2` — Epic Jinja2 template to extend with `jira_card` frontmatter
- `forge-shell/app/js/card-data.js` — Card field ordering config (add `jira_card` to epic order)
- `forge-shell/app/js/product-forge.js` — Product Forge view controller (edit form + tree rendering + filter panel)
- `forge-shell/app/css/product-forge.css` — Product Forge styles (filter panel CSS)
- `product-forge/commands/link-to-jira.md` — Jira link command docs
- `product-forge/commands/push-to-jira.md` — Jira push command docs
- `product-forge/commands/pull-from-jira.md` — Jira pull command docs
- `product-forge/skills/jira-sync/SKILL.md` — Jira sync skill docs
- `forge-lib/tests/test_card_ops.py` — Card operations test file

## Test Command

```bash
cd forge-lib && python -m pytest tests/ -v
```

## Developer Callouts

None specified.

## Success Criteria

- All three card types (Initiative, Epic, Story) use `jira_card` as the unified Jira linkage field
- Epic schema validates with `jira_card` attribute, epic template renders it in frontmatter
- forge-shell epic edit form includes a "Jira Card" text field
- All Jira command docs and jira-sync skill reference only `jira_card` (no more `jira_key` backward compatibility)
- New test passes: creating an epic with `jira_card` stores and retrieves the value correctly
- Product Forge view has a slide-out filter panel with per-type status filters (Initiative, Epic, Story)
- Full test suite passes with no regressions
