# Mission Brief

**Playbook:** feature-build
**Design Doc:** docs/plans/2026-03-03-outlook-forge-design.md
**Implementation Plan:** docs/plans/2026-03-03-outlook-forge-implementation.md
**Created:** 2026-03-03

## Requirements Summary

1. **New plugin `outlook-forge`** with 5 commands (init, scan, capture, review, promote) mirroring the slack-forge pipeline pattern exactly
2. **3 harvester agents** (email, calendar, meeting) each with corresponding skills, processing local transcript files only — no Chrome navigation from agents
3. **Chrome-only scan strategy** — no API/OAuth, navigates `outlook.office.com` using the user's existing browser session. Only the scan command uses Chrome.
4. **Zero forge-lib changes** — reuses existing harvest infrastructure (`forge harvest create/query/update`, `forge transcript filename`, harvest.json schema, harvest.md.j2 template)
5. **Forge-shell view** — new `outlook-forge.js` view controller with Harvests + Transcripts tabs, CSS variables for harvest type colors, and navigation sidebar integration
6. **4 harvest types:** task, knowledge, meeting-prep, meeting-notes
7. **Field mapping:** `source_channel` = Outlook folder name (inbox, sent, calendar), `source_channel_id` = same value, `source_author` = email address or meeting organizer

## Key Files

Reference the slack-forge plugin as the primary pattern for all conventions:

- `slack-forge/commands/*.md` — command structure and conversational patterns
- `slack-forge/agents/*.md` — agent structure (tools, skills, assignment, rules)
- `slack-forge/skills/*/SKILL.md` — skill structure (signals, confidence, quality rules)
- `forge-shell/app/js/slack-forge.js` — view controller pattern (ForgeFS, tabs, detail panels)
- `forge-shell/app/css/slack-forge.css` — CSS variable and styling pattern
- `forge-shell/app/js/app.js` — navigation sidebar registration
- `forge-shell/app/js/utils.js` — ForgeFS utility for filesystem scanning
- `forge-lib/forge.py` — CLI commands used by the plugin

## Test Command

```bash
python forge-lib/forge.py --help
```

## Developer Callouts

None specified. Follow the design doc and implementation plan as written.

## Success Criteria

1. All 5 commands created and matching the design doc specifications
2. All 3 agents created with proper tool restrictions and skill references
3. All 3 skills created with signal patterns, confidence rules, and quality requirements
4. Forge-shell view controller loads harvests and transcripts from filesystem
5. Plugin structure matches `outlook-forge/` directory layout from design doc
6. All harvest creation commands use the correct forge-lib CLI syntax
7. Review and promote commands mirror slack-forge behavior exactly
8. CSS follows existing forge-shell variable naming conventions
9. Navigation sidebar includes outlook-forge entry
