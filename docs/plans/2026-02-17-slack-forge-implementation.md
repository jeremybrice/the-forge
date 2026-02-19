# slack-forge Implementation Plan

**Goal:** Align slack-forge with split workflow:
- `scan` = MCP transcript capture
- `capture` = local transcript harvesting

## Implementation Tasks

1. Update `slack-forge/commands/scan.md`
- Remove harvest creation responsibilities.
- Add transcript generation responsibilities.
- Add execution mode prompt (scan only / ask capture / auto capture).

2. Add `slack-forge/commands/capture.md`
- Define transcript validation.
- Define local-only extraction pipeline.
- Define harvest creation workflow and output summary.

3. Update `slack-forge/README.md`
- Document two-stage architecture.
- Add capture command and chained scan behavior.

4. Update agent specs
- `slack-forge/agents/forge-task-harvester.md`
- `slack-forge/agents/forge-knowledge-harvester.md`
- `slack-forge/agents/forge-jira-digest.md`
- Enforce local transcript input only.

5. Update skills
- `slack-forge/skills/task-harvester/SKILL.md`
- `slack-forge/skills/knowledge-harvester/SKILL.md`
- `slack-forge/skills/jira-digest/SKILL.md`
- Remove direct Slack-pull assumptions.

6. Validate consistency
- Ensure no stale `slack_read_channel` references remain in capture-oriented docs.
- Ensure `/slack-forge:capture` is documented in README and plans.

## Acceptance Criteria

- Scan command docs no longer direct subagents to harvest.
- Capture command exists and is transcript-local-only.
- Agent and skill docs are MCP-independent for harvesting.
- README and design docs match implemented command split.
