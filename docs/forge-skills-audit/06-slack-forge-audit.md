# Slack Forge Plugin Audit — Forge Skills Audit Project

**Plugin Location:** `/mnt/.local-plugins/cache/the-forge/slack-forge/2.2.0/`
**Audit Date:** 2026-03-09
**Total Component Lines:** 1,177
**Triage Verdict:** Full evaluation strongly recommended — all three behavioral components (task/knowledge/JIRA extraction) make operational claims and require rigorous validation.

---

## Plugin Overview

Slack Forge is the capture layer for the Forge system. It orchestrates the pipeline from Slack data (via MCP retrieval or local transcripts) through multi-stage harvesting (task extraction, knowledge capture, JIRA digestion) to downstream promotion into Tasks Forge and Forge Memory.

**Architecture:**
- **Init command** — configure monitored channels and JIRA feed
- **Scan command** — primary agent pulls Slack/JIRA via MCP, writes local transcripts
- **Capture command** — dispatches three local-only subagents to harvest transcripts
- **Review command** — human approves/rejects/edits pending records
- **Promote command** — push approved items to tasks-forge and forge-memory

**Three behavioral subsystems (skills + agents):**
1. **Task Harvester** — extracts actionable tasks with confidence scoring
2. **Knowledge Harvester** — identifies durable organizational knowledge
3. **JIRA Digest** — parses bot activity into executive briefings

---

## Component Inventory

| Component | Type | Lines | Purpose | Evaluation Status |
|-----------|------|-------|---------|-------------------|
| `skills/task-harvester/SKILL.md` | Skill | 62 | Task extraction guidance (signals, provenance, deduplication) | FULL EVAL CANDIDATE |
| `skills/knowledge-harvester/SKILL.md` | Skill | 65 | Knowledge capture guidance (signals, durability, significance) | FULL EVAL CANDIDATE |
| `skills/jira-digest/SKILL.md` | Skill | 74 | JIRA event parsing (types, actionability, digestion) | FULL EVAL CANDIDATE |
| `commands/init.md` | Command | 155 | Channel discovery & config setup via Slack MCP | Description optimization candidate |
| `commands/scan.md` | Command | 197 | Primary agent orchestration; MCP retrieval; transcript writing | Full eval candidate |
| `commands/capture.md` | Command | 92 | Subagent dispatcher; harvest creation orchestration | Direct improvement candidate |
| `commands/review.md` | Command | 119 | Interactive review UI; status transitions | Direct improvement candidate |
| `commands/promote.md` | Command | 152 | Downstream promotion to tasks-forge/forge-memory | Direct improvement candidate |
| `agents/forge-task-harvester.md` | Agent | 87 | Task extraction agent (reads transcripts, creates harvests) | FULL EVAL CANDIDATE |
| `agents/forge-knowledge-harvester.md` | Agent | 87 | Knowledge extraction agent (reads transcripts, creates harvests) | FULL EVAL CANDIDATE |
| `agents/forge-jira-digest.md` | Agent | 87 | JIRA digest agent (reads transcripts, creates digests) | FULL EVAL CANDIDATE |

---

## Per-Component Scores

### 1. Task Harvester Skill (`skills/task-harvester/SKILL.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear scope statement; explicitly states local transcript input; no MCP fetching. Skill name and description accurate. |
| **Core Objective Clarity** | Strong | Purpose is explicit: identify actionable tasks from Slack transcripts. Task signals, non-tasks, and confidence levels are clearly defined. |
| **Procedural Logic** | Strong | Four-tier signal detection (direct requests, commitments, deadlines, explicit markers) with high/medium/low confidence mapping. Rules for titles and provenance are prescriptive. |
| **Human-in-the-Loop Gates** | Adequate | Deduplication rule requires human judgment during review, but no explicit gates within the skill itself. Confidence scoring enables review prioritization. |
| **Output Specifications** | Strong | Four-part content requirement (What/Who/Why/When) is explicit. Provenance fields (source_channel, source_author, source_timestamp, context quote) are mandatory. Anti-patterns are named. |
| **Reference File Utilization** | Strong | Correctly references `slack-forge/transcripts/*.md` as input; no external references. Scope is self-contained. |
| **Connector/Tool Integration** | Adequate | No explicit tool calls documented; assumes agent implementation will use Read/Grep/Bash tools (agent definition confirms this). Integration with `forge harvest create` is delegated to agent. |
| **Progressive Disclosure & Size** | Strong | 62 lines is appropriately dense. Sections flow logically: scope → signals → confidence → format → provenance → output quality → deduplication. |
| **Cross-Plugin Handoff** | Strong | Output fields map directly to `forge harvest create` schema. Confidence → task priority mapping is documented in promote command. |
| **Writing Quality** | Strong | Precise, scannable, uses consistent terminology. Examples are concrete (e.g., David Madsen task). No ambiguous phrasing. |
| **SCORE** | **8.5/10** | Skill is well-articulated. Main gap: no explicit guidance on how to handle marginal cases (e.g., requests with unclear owners). |

---

### 2. Knowledge Harvester Skill (`skills/knowledge-harvester/SKILL.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear scope; explicitly local transcripts only; no direct data fetch. Description is accurate. |
| **Core Objective Clarity** | Strong | Objective is explicit: extract durable organizational knowledge. Knowledge signals (decisions, process changes, ownership, milestones, terminology, architecture) are well-categorized. |
| **Procedural Logic** | Strong | Durability test ("useful in 2+ weeks") is a practical filter. Confidence levels (high/medium/low) are clear. Memory hints (person/project/glossary/general) guide routing. |
| **Human-in-the-Loop Gates** | Adequate | No explicit gates; durability test is heuristic and relies on agent judgment. Review gate happens downstream in review command. |
| **Output Specifications** | Strong | Two-part content requirement (summary + significance) with explicit formatting (`**Significance:** ` prefix). Tags with memory-hint routing. Provenance is mandatory. Direct quotes are required where available. |
| **Reference File Utilization** | Strong | Input scope clearly defined: `slack-forge/transcripts/*.md`. No external references. |
| **Connector/Tool Integration** | Adequate | Tool integration delegated to agent implementation. `forge harvest create` integration is implicit. Memory-hint tags are designed to feed promote command type inference. |
| **Progressive Disclosure & Size** | Strong | 65 lines; logical flow: scope → signals → filters → durability → confidence → provenance → output → memory hints. Anti-patterns are clearly named. |
| **Cross-Plugin Handoff** | Strong | Memory-hint tags (person/project/glossary/general) feed type inference in promote command. Output schema maps to knowledge entry creation. |
| **Writing Quality** | Strong | Clear, precise, consistent terminology. Example of good content is well-detailed; bad example is instructive. "Significance" requirement is well-motivated. |
| **SCORE** | **8.5/10** | Well-designed skill. Minor gap: no guidance on how to distinguish "strong contextual insight" (medium confidence) from casual analysis in edge cases. |

---

### 3. JIRA Digest Skill (`skills/jira-digest/SKILL.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Scope is explicit: local JIRA transcript snapshots only. No direct JIRA API fetch. Description is accurate. |
| **Core Objective Clarity** | Strong | Purpose is clear: parse JIRA events and produce executive digests. Eight event types (assignment, status_change, comment, mention, created, priority_change, sprint_change, resolution) are enumerated. |
| **Procedural Logic** | Strong | Extraction logic is defined: ticket, event_type, summary, needs_action. Actionability rules (direct assignment, explicit mentions, blockers = true; informational = false). Confidence scoring (high/medium/low) is clear. |
| **Human-in-the-Loop Gates** | Strong | Actionability logic is rule-based but allows nuanced judgment. "Needs action" field is a clear gate for review prioritization. |
| **Output Specifications** | Strong | Digest structure is highly prescriptive: lead with actionable items, group informational events by outcome, include 3-5 key tickets to watch, summarize high-volume noise. Title format is fixed. Provenance includes jira_events array mapping. |
| **Reference File Utilization** | Strong | Input scope: `slack-forge/transcripts/*jira*.md`. Scope is self-contained. |
| **Connector/Tool Integration** | Adequate | Tool integration delegated to agent. jira_events array is designed to pass through to harvest schema for template rendering. |
| **Progressive Disclosure & Size** | Adequate | 74 lines covers event types, actionability rules, and digest structure, but the digest structure section (lines 55-75) is dense. Anti-patterns section is valuable but could be clearer on precedent (e.g., when does a ticket move from "watch list" to "action required"). |
| **Cross-Plugin Handoff** | Strong | JIRA digests are marked "promoted" but do not create downstream tasks/knowledge entries. Schema includes jira_events array for template rendering. |
| **Writing Quality** | Strong | Precise, scannable, uses consistent terminology. Example title format is clear. Anti-patterns section is instructive. One minor issue: "unparseable noise" (line 78) is vague. |
| **SCORE** | **8/10** | Well-designed skill. Gaps: (1) no guidance on partial parses or ambiguous ticket references; (2) "Key Tickets to Watch" selection logic is heuristic and underdescribed; (3) definition of "high-volume noise" vs. signal is left to agent judgment. |

---

### 4. Init Command (`commands/init.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear description: "Discover Slack channels and configure which to monitor". Scope is explicit: channel discovery, JIRA feed identification, config save. |
| **Core Objective Clarity** | Strong | Goal is clear: set up monitored channel list and persist to config. Idempotency is explicitly noted (can update config at any time). |
| **Procedural Logic** | Strong | Seven-step process: check state → init directory → discover channels → present list → identify JIRA channel → save config → confirm setup. Flows logically. State transitions are well-defined. |
| **Human-in-the-Loop Gates** | Strong | User explicitly selects channels and JIRA feed. Update gate ("Would you like to update config?") prevents destructive re-initialization. |
| **Output Specifications** | Adequate | Channel object format is documented (id, name, type, monitor, role). Config save returns success/error. Output confirmation is clear. Minor gap: no spec for what happens if channel discovery returns 0 results. |
| **Reference File Utilization** | Strong | References `slack-forge/` directory structure, `config.json`, and forge-lib CLI. Slack MCP tools are the only external dependency (documented). |
| **Connector/Tool Integration** | Adequate | Uses forge-lib (`forge harvest config --get`, `--set-channels`, `--set-jira-channel`) and Slack MCP tools (`slack_search_channels`, `slack_search_users`). Integration points are clear. Error handling for forge-lib responses is documented. |
| **Progressive Disclosure & Size** | Strong | 155 lines; logically structured. Section numbers (1-7) make flow clear. Prompt templates are inline, making the command easy to follow. |
| **Cross-Plugin Handoff** | Strong | Config is used by scan command to determine channel scope. Scan command depends on init being run first. |
| **Writing Quality** | Strong | Clear prompts, good use of code blocks, consistent terminology. One minor issue: "DM conversations if relevant" (line 65) is vague — no guidance on when DMs are relevant. |
| **SCORE** | **8/10** | Strong foundational command. Gaps: (1) no spec for empty channel discovery; (2) no guidance on relevance heuristic for DM inclusion; (3) error recovery for failed forge-lib calls is minimal (just "report error and stop"). |

---

### 5. Scan Command (`commands/scan.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Description is precise: "Scan Slack via MCP and write local transcript files". Explicitly states the command does NOT create harvest records. |
| **Core Objective Clarity** | Strong | Goal is explicit: pull Slack/JIRA via MCP, write local transcripts. Role as "primary-agent orchestrator" is stated. Time frame selection is clear. Execution modes (scan-only, scan-then-ask, scan-auto-capture) are documented. |
| **Procedural Logic** | Strong | Nine-step process: check prereqs → ask time frame → ask execution mode → build scope → present brief → execute MCP retrieval → resolve filenames → write transcripts → optional chaining. Logic is sound. |
| **Human-in-the-Loop Gates** | Strong | Three explicit gates: time frame selection, execution mode selection, "Proceed? (yes/no)" confirmation before MCP calls. |
| **Output Specifications** | **Weak** | Transcript YAML frontmatter format is specified (lines 115-120), but template example is minimal. Critical issue: **transcript format contract is described inline but NOT formally specified**. The "Transcript format — writer and sub-agent contract" section is narrative. Subagents must parse this format to extract provenance, but no JSON schema or formal BNF is provided. Ambiguities: (1) What if a channel has no messages? (Line 137: "explicit 'No messages' section" — format unclear.) (2) What is the exact regex for parsing `[2026-02-15 09:14 UTC]`? (3) How should subagents handle timestamps in different formats? (4) YAML frontmatter vs. markdown headers — the contract says "Do NOT use markdown headings or `**bold**` text for this metadata" but then uses `## #eng-team` headers. This is a contract ambiguity. |
| **Reference File Utilization** | Strong | References config loaded from init, forge-lib CLI (`forge transcript filename`, `forge transcript clean`), and Slack MCP tools. Clear separation of concerns (scan resolves filenames via CLI, not hard-coded). |
| **Connector/Tool Integration** | Strong | Uses Slack MCP tools to retrieve messages, forge-lib CLI for filename resolution and JIRA cleanup, and file writing. JIRA cleanup utility is described with clear input/output contract. Error handling for forge-lib responses is documented. |
| **Progressive Disclosure & Size** | Adequate | 197 lines is dense. Sections 1-4 flow well. Section 5 (MCP execution and transcript writing) is procedurally complex: filename resolution, YAML frontmatter, channel headers, message formatting, JIRA cleanup — this is a lot to fit into narrative. Cleanup logic (lines 140-159) is detailed but terse. |
| **Cross-Plugin Handoff** | Strong | Output transcripts are designed to feed capture command. Filename format (`YYYY-MM-DD-timeframe-type-NNN.md`) enables capture command to resolve "most recent scan". YAML frontmatter and provenance extraction are specified for subagent parsing. |
| **Writing Quality** | Adequate | Clear prompts and logical flow. Minor issues: (1) "primary-agent orchestrator" is terminology jargon not defined elsewhere in the spec; (2) JIRA cleanup section uses conditional language ("If cleanup succeeds") but no fallback for timeout or other failure modes; (3) Filename resolution via CLI is clever but adds a dependency (assumes forge-lib CLI is available in agent runtime). |
| **SCORE** | **6.5/10** | **CRITICAL GAP:** The transcript format is the contract between scan (writer) and three subagents (readers). The format is described narratively with an inline example, but subagents must parse this format reliably. **Ambiguities in the format spec will cause subagent failures or data loss.** Specific issues: (1) Transcript YAML frontmatter + markdown headers create a format ambiguity (YAML or markdown?). (2) Provenance extraction logic (parse channel headers and message lines) is implicit in subagent behavior, not formally specified. (3) JIRA cleanup adds complexity and failure modes. (4) "No messages" section format is not formally specified. |

---

### 6. Capture Command (`commands/capture.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear description: "Harvest tasks, knowledge, and JIRA digests from local transcript files". Scope is explicit: does NOT call Slack MCP tools. |
| **Core Objective Clarity** | Strong | Goal is explicit: dispatch three subagents to harvest transcripts and create records. Command is orchestrator, not executor. |
| **Procedural Logic** | Adequate | Five-step process: check prereqs → ask capture scope → dispatch subagents → present summary → done. Logic is sound but underdescribed. Critical gap: "dispatch subagents sequentially using the Task tool" is vague. What does the "brief" contain? How does the task tool know which agent to invoke? Line 49 says "In each brief, include: agent name and markdown path" — but does the task tool parameter structure support this? This is left to implementation interpretation. |
| **Human-in-the-Loop Gates** | Adequate | User selects capture scope (most recent scan or custom), but no confirmation gate before subagent dispatch. Subagents create records autonomously. |
| **Output Specifications** | Adequate | Summary format is clear. Provenance fields required from subagents are listed (line 73). But no spec for what each subagent must return to the capture orchestrator. Do subagents report back with counts? Errors? Success/failure per harvest? This is underspecified. |
| **Reference File Utilization** | Adequate | References config, transcript files, agent markdown paths (lines 56, 61, 66). Assumes agent files exist at `slack-forge/agents/forge-*.md`. |
| **Connector/Tool Integration** | Weak | **Critical issue:** "Dispatch using the Task tool (`subagent_type: general-purpose`)" — the Task tool is not defined in this spec. How does it work? What parameters does it accept? What does it return? Line 49 says "include agent name and its markdown path" — but the Task tool spec is not provided. This makes the command unimplementable without external documentation. Subagents are expected to call `forge harvest create` (lines 58, 62, 68), but the command itself does not show this — it assumes subagents will handle it. |
| **Progressive Disclosure & Size** | Adequate | 92 lines is concise. Sections 1-4 are clear, but section 3 (subagent dispatch) is the critical section and is underspecified. |
| **Cross-Plugin Handoff** | Strong | Subagent output (harvest records) feed review command. Provenance preservation is emphasized. |
| **Writing Quality** | Adequate | Clear structure and logical flow. Minor issues: (1) "Task tool" terminology is jargon; (2) "most recent scan" resolution logic is described briefly (line 38-39) but should be formalized; (3) "sequentially" vs. "in parallel" — why sequential? No justification. |
| **SCORE** | **6/10** | **CRITICAL GAP:** The command relies on a "Task tool" that is not defined in this spec. Subagent dispatch is underspecified. No spec for what subagents return to the orchestrator. The command reads well but is **not actionable without external documentation of the Task tool.**  |

---

### 7. Review Command (`commands/review.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear description: "Review pending harvest records — approve, reject, edit, or skip each item". Scope is explicit: interactive review of pending records. |
| **Core Objective Clarity** | Strong | Goal is explicit: present each pending harvest to the user for disposition. Four outcomes (approve/reject/edit/skip) are clear. |
| **Procedural Logic** | Strong | Four-step process: query pending harvests → group by type → review each item → present summary. Logic is sound. State transitions (pending → approved/rejected) are documented. |
| **Human-in-the-Loop Gates** | Strong | Full interactive review. User must take action on each item (A/R/E/S). Edit path allows title and content modification. |
| **Output Specifications** | Strong | Review UI format is prescriptive (lines 49-59). Edit prompt is clear. Summary format lists counts and outcomes. CLI commands for status updates are specified. |
| **Reference File Utilization** | Strong | References harvest records by filename, forge-lib CLI (`forge harvest update`), and provenance fields. |
| **Connector/Tool Integration** | Adequate | Uses forge-lib CLI (`forge harvest query`, `forge harvest update`) for record management. Error handling is documented. Feedback loop shows "promoted" path on success. |
| **Progressive Disclosure & Size** | Strong | 119 lines; well-structured sections. Prompts and CLI commands are inline, making the flow clear. |
| **Cross-Plugin Handoff** | Strong | Approved records feed promote command. Review command is explicitly the gate between capture and promote. |
| **Writing Quality** | Strong | Clear, scannable, consistent terminology. Example prompts are concrete. Status transitions are explicit. |
| **SCORE** | **8.5/10** | Strong command. Minor gaps: (1) no spec for handling very large pending lists (e.g., 100+ items — should review be paginated?); (2) Edit prompt is open-ended ("Updated content") — no guidance on format or length constraints; (3) Confidence levels are mentioned (line 118 note) but not used in the UI to sort items. |

---

### 8. Promote Command (`commands/promote.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Clear description: "Promote approved harvest records to tasks-forge and forge-memory". Scope is explicit: downstream promotion only. |
| **Core Objective Clarity** | Strong | Goal is explicit: push approved items to destination plugins. Three paths (task → tasks-forge, knowledge → forge-memory, JIRA → archive). |
| **Procedural Logic** | Strong | Six-step process: query approved → present plan → promote tasks → promote knowledge → promote JIRA → summarize. Logic is sound. State transitions are documented. |
| **Human-in-the-Loop Gates** | Strong | User confirms "Proceed with promotion? (yes/no)" before any changes (line 38). |
| **Output Specifications** | Strong | CLI commands for task/knowledge creation are detailed (lines 56-61, 92-96). Field mappings are explicit (confidence → priority, tags → task tags, source info → description). JIRA digests are marked promoted but create no downstream entities. |
| **Reference File Utilization** | Strong | References approved harvest records, tasks-forge and forge-memory plugins, forge-lib CLI. Infers memory type from content and tags. |
| **Connector/Tool Integration** | Strong | Uses forge-lib CLI (`forge task create`, `forge memory create-knowledge`, `forge harvest update`) to manage records. Error handling is documented: task creation failures do not trigger promote mark; knowledge failures skip the item. |
| **Progressive Disclosure & Size** | Adequate | 152 lines; well-structured but dense. Sections 3-5 (task/knowledge/JIRA promotion) are detailed and prescriptive, but the field mapping logic (lines 47-52, 80-84) is heuristic and could be clearer. Example task creation (lines 56-61) is instructive. |
| **Cross-Plugin Handoff** | Strong | Tasks flow to tasks-forge; knowledge flows to forge-memory; JIRA digests are archived but not propagated. Cross-plugin references are explicit. |
| **Writing Quality** | Strong | Clear, well-organized, concrete examples. CLI commands are formatted as code blocks. One minor issue: "Infers memory type from content" (line 80) is heuristic — the spec says "the LLM determines the best category" but no guidance is provided on how to make this inference deterministic. |
| **SCORE** | **8/10** | Strong command. Gaps: (1) Field mapping for knowledge type is heuristic and may produce incorrect categorizations; (2) Error recovery for failed promotions is minimal (items stay approved, user must retry); (3) No spec for handling circular dependencies (e.g., if a task creation fails but harvest is marked promoted, user cannot easily retry). |

---

### 9. Forge Task Harvester Agent (`agents/forge-task-harvester.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Description is precise: "Local transcript scanner that identifies actionable tasks and creates harvest records". Assignment is clear. |
| **Core Objective Clarity** | Strong | Goal is explicit: read transcripts, identify tasks, create harvests. Tools and skills are declared. |
| **Procedural Logic** | Adequate | Three-step assignment: read transcripts → identify tasks using skill rules → create harvests. This is high-level and delegates detail to the agent implementation. The agent has Read/Grep/Glob/Bash tools available, but no explicit guidance on how to use them to parse transcripts. |
| **Human-in-the-Loop Gates** | Adequate | No gates within agent. Agent output is reviewed by the review command. |
| **Output Specifications** | Strong | Harvest creation command is specified with all required fields (lines 33-46). Content quality requirements are detailed (lines 50-72): What/Who/Why/When narrative, action_items array, source_context with quotes. Anti-patterns are named. |
| **Reference File Utilization** | Strong | Reads `slack-forge/transcripts/` files provided in capture brief. Scope is local-only. |
| **Connector/Tool Integration** | Adequate | Declares tools (Read, Grep, Glob, Bash) and skill (task-harvester). Uses `forge harvest create` CLI. But no explicit guidance on tool use (e.g., which tool to use for parsing YAML frontmatter? Which tool to extract task signals from transcript text?). |
| **Progressive Disclosure & Size** | Adequate | 87 lines; concise. Assignment and requirements are clear, but procedural details are minimal. Example content (lines 58-62) is helpful. |
| **Cross-Plugin Handoff** | Strong | Harvest records feed review command. Provenance preservation is emphasized. |
| **Writing Quality** | Adequate | Clear structure. Example good content is well-detailed; bad example is instructive. One issue: "synopsis table" (line 87) is mentioned but format is not specified. |
| **SCORE** | **7/10** | Agent is well-scoped. Gaps: (1) **No explicit guidance on parsing transcript YAML frontmatter and provenance fields.** The agent must extract `source_channel`, `source_channel_id`, `source_author`, `source_timestamp` from the transcript, but the parsing logic is implicit. (2) No guidance on handling transcript files that don't match the expected format. (3) Tool use guidance is minimal — the agent must infer which tools to use for which parsing tasks. (4) Output summary format is not specified. |

---

### 10. Forge Knowledge Harvester Agent (`agents/forge-knowledge-harvester.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Description is precise: "Local transcript scanner that identifies durable organizational knowledge and creates harvest records". Assignment is clear. |
| **Core Objective Clarity** | Strong | Goal is explicit: read transcripts, identify knowledge, create harvests. Tools and skills are declared. |
| **Procedural Logic** | Adequate | Three-step assignment: read transcripts → identify knowledge using skill rules → create harvests. High-level; detail is delegated. |
| **Human-in-the-Loop Gates** | Adequate | No gates within agent. Output reviewed by review command. |
| **Output Specifications** | Strong | Harvest creation command is fully specified (lines 32-45). Content quality is detailed (lines 48-73): two-part structure (summary + significance), tags with memory-hint routing, direct quotes required. Anti-patterns are named. |
| **Reference File Utilization** | Strong | Reads `slack-forge/transcripts/` files provided in capture brief. Local-only. |
| **Connector/Tool Integration** | Adequate | Declares tools (Read, Grep, Glob, Bash) and skill (knowledge-harvester). Uses `forge harvest create` CLI. No explicit guidance on tool use for parsing transcripts. |
| **Progressive Disclosure & Size** | Adequate | 87 lines; concise and well-organized. Output spec is clear. Example content (lines 55-58) is instructive. |
| **Cross-Plugin Handoff** | Strong | Harvest records feed review command, then promote command (which infers memory type from tags). Tags are designed to route items correctly. |
| **Writing Quality** | Adequate | Clear, scannable. Example good/bad content is instructive. One issue: "filtered/noise counts" (line 86) in output summary — format not specified. |
| **SCORE** | **7/10** | Well-scoped agent. Gaps: same as Task Harvester — (1) **no explicit guidance on parsing transcript format and extracting provenance fields;** (2) no guidance on handling malformed input; (3) tool use guidance is implicit; (4) output format not specified. |

---

### 11. Forge JIRA Digest Agent (`agents/forge-jira-digest.md`)

| Rubric Dimension | Rating | Evidence |
|------------------|--------|----------|
| **Trigger & Description Quality** | Strong | Description is precise: "Local transcript scanner that parses JIRA bot transcript activity into digest harvest records". Assignment is clear. |
| **Core Objective Clarity** | Strong | Goal is explicit: read JIRA transcripts, parse events, create digests. Tools and skills are declared. |
| **Procedural Logic** | Adequate | Four-step assignment: read transcripts → parse JIRA events using skill rules → create digests. High-level; delegates to implementation. |
| **Human-in-the-Loop Gates** | Adequate | No gates within agent. Output reviewed by review command. |
| **Output Specifications** | Adequate | Harvest creation command is specified (lines 32-45). Digest content structure is detailed (lines 48-63): actionable items first, summary stats, status grouping, key tickets. Anti-patterns are named (lines 65-72). **Gap: Digest structure is prescriptive but narrative, not formally specified.** How does the agent produce a "single bolded stats line"? What if there are 0 unique tickets? The anti-pattern section helps but leaves room for interpretation. |
| **Reference File Utilization** | Strong | Reads `slack-forge/transcripts/*jira*.md` files. Scope is local-only and JIRA-specific. |
| **Connector/Tool Integration** | Adequate | Declares tools (Read, Grep, Glob, Bash) and skill (jira-digest). Uses `forge harvest create` CLI. No explicit tool guidance. One issue: jira_events array must be passed in `--data` JSON and rendered in template (line 69) — the agent must structure this array correctly, but no schema is provided. |
| **Progressive Disclosure & Size** | Adequate | 87 lines; concise. Digest structure is detailed but dense. Example title (line 63) is helpful. |
| **Cross-Plugin Handoff** | Strong | JIRA digests are informational only; marked promoted but do not create downstream tasks/knowledge. Schema includes jira_events array for template rendering. |
| **Writing Quality** | Adequate | Clear. Anti-patterns section is helpful. One issue: Output summary (line 85-87) mentions "digests created" but the agent creates ONE digest per scan run, not multiple digests. This is confusing. |
| **SCORE** | **6.5/10** | Agent is well-scoped. Gaps: (1) **No explicit guidance on parsing transcript format and extracting provenance;** (2) **Digest content structure is prescriptive but leaves edge cases unspecified** (what if there are 0 actionable items? 0 key tickets? How many events before "high-volume noise" summarization?); (3) jira_events array schema is not formally specified; (4) output summary format is unclear (single digest or multiple?). |

---

## Strengths

1. **Clear Plugin Purpose** — The plugin's role as the Slack-to-Forge capture layer is well-articulated. Integration with tasks-forge and forge-memory is explicit.

2. **Strong Skill Design** — The three skills (task-harvester, knowledge-harvester, jira-digest) are well-crafted. Each has clear signals, filters, confidence levels, and output quality rules. The examples of "good" and "bad" outputs are instructive.

3. **Explicit Provenance Requirements** — All extraction components emphasize provenance preservation (source_channel, source_author, source_timestamp, context quotes). This is critical for audit trails and review quality.

4. **Human-in-the-Loop Architecture** — The review command is a strong gate: users explicitly approve/reject/edit each harvest before promotion. This prevents low-confidence items from flowing downstream.

5. **Multi-Step Commands** — Init, scan, capture, review, and promote are well-orchestrated. Each command has clear prerequisites and success criteria.

6. **Cross-Plugin Handoff Documentation** — The promote command explicitly shows how task confidence maps to priority, how knowledge tags route to memory types, and how JIRA digests are archived. These mappings are well-thought-out.

---

## Critical Gaps

### **Gap 1: Transcript Format Contract is Ambiguous** (High Priority)

**Location:** `commands/scan.md` lines 115-130, implied in all three subagent files.

**Issue:** The transcript format is the critical contract between scan (writer) and three subagents (readers). The format is specified narratively with an inline example, but **critical ambiguities exist:**

1. **YAML frontmatter vs. Markdown headers conflict** — Line 108 states: "Do NOT use markdown headings or `**bold**` text for this metadata" but then lines 122-130 use `## #eng-team` markdown headers. Is the format YAML + markdown, or pure YAML? Subagents must parse this unambiguously.

2. **"No messages" section format undefined** — Line 137 says "include an explicit 'No messages' section" but does not specify format. Is it `## #channel-name\n\nNo messages in this window.`? This ambiguity will cause parsing failures.

3. **Timestamp parsing undefined** — Subagents must extract `source_timestamp` from `[2026-02-15 09:14 UTC]` but no regex or formal specification is provided. What if timestamps vary in format?

4. **Provenance extraction logic is implicit** — Subagents must parse channel IDs from headers (`## #eng-team (C01ABC123)`) and author names from messages (`@alice`), but no explicit parsing rules are documented.

**Impact:** Subagents will likely produce incorrect or inconsistent provenance. Scan runs may fail silently if transcript format is not recognized.

**Recommendation:** Formalize the transcript format as JSON Schema or BNF with explicit rules for edge cases (empty channels, missing fields, timestamp variations).

---

### **Gap 2: Subagent Dispatch Mechanism is Undefined** (High Priority)

**Location:** `commands/capture.md` lines 47-73.

**Issue:** The capture command says "Dispatch subagents sequentially using the Task tool (`subagent_type: general-purpose`)" — but **the Task tool is not documented in this spec.**

1. **What is the Task tool?** — Is it a built-in Forge capability? An external tool? How does it invoke agents?

2. **What parameters does it accept?** — Line 49 says "include agent name and its markdown path" — but the exact parameter structure is not specified. Does it accept a JSON brief? Markdown text?

3. **What does it return?** — Subagents must report harvest counts, errors, and success/failure to the orchestrator. But no schema is provided for subagent responses.

4. **Error handling** — What if a subagent fails partway through? Should the orchestrator continue to the next subagent? Retry? No guidance is provided.

**Impact:** The capture command is not actionable without external documentation or implementation details.

**Recommendation:** Document the Task tool interface in the capture command (or reference external docs). Provide exact JSON schema for subagent briefs and responses.

---

### **Gap 3: Subagent Parsing Logic is Implicit, Not Specified** (High Priority)

**Location:** All three agent files (`agents/forge-*.md`).

**Issue:** Each agent must parse local transcripts to extract provenance and content. But **no explicit parsing rules are documented:**

1. **YAML frontmatter parsing** — Agents must extract `scan_date`, `timeframe`, `scan_run`, `generated` from YAML. But no schema or parsing rules are provided. Will agents use YAML libraries or regex?

2. **Channel header parsing** — Agents must extract channel name and ID from `## #eng-team (C01ABC123)`. No regex or formal spec.

3. **Message line parsing** — Agents must extract timestamp, author, and text from `[2026-02-15 09:14 UTC] @alice: message`. No regex provided.

4. **Handling malformed input** — What if a transcript is incomplete or doesn't match the expected format? No error handling guidance.

**Impact:** Each subagent must reverse-engineer the parsing logic from the narrative description and example. This is error-prone and may produce inconsistent results.

**Recommendation:** Provide formal parsing specifications (regex patterns, JSON schemas, or pseudocode) for transcript format parsing.

---

### **Gap 4: Digest Content Structure Leaves Edge Cases Unspecified** (Medium Priority)

**Location:** `skills/jira-digest/SKILL.md` lines 55-64 and `agents/forge-jira-digest.md` lines 48-63.

**Issue:** The digest structure is prescriptive but vague on edge cases:

1. **"Key Tickets to Watch" selection** — How many tickets? The spec says "3-5" but no guidance on selection criteria beyond "strategically important". Vague.

2. **"High-volume noise" summarization** — The skill says "12 QA Subtasks created for sprint validation is better than listing all 12" but no rule is given for when to switch from enumeration to summarization. Is it a threshold (5+, 10+)? A heuristic?

3. **Items with 0 actionable items** — What if a JIRA transcript has no items needing action? Does the digest skip the "Items Needing Action" section? The spec implies it's mandatory.

4. **Summary stats line** — The spec says "single bolded stats line" but doesn't specify exact format. Is it `**3 unique tickets** across **12 events**`? Or something else?

**Impact:** Agents may produce digests with inconsistent structure or missing sections.

**Recommendation:** Formalize the digest structure with fixed field requirements and explicit edge case handling.

---

### **Gap 5: Knowledge Type Inference is Heuristic** (Medium Priority)

**Location:** `commands/promote.md` lines 80-84.

**Issue:** The promote command infers memory type (person/project/glossary/general) from content and tags. But the inference logic is vague:

- "Person expertise signals → person" — What signals qualify? Mentions of roles? Team leads? No specific rules.
- "Default to project" — This is a fallback for ambiguous items. How common are these defaults? What causes ambiguity?

**Impact:** Knowledge items may be miscategorized in forge-memory, making them harder to discover.

**Recommendation:** Provide explicit rules for type inference (e.g., tagged "person" → person; tagged "glossary" → glossary; else if tags include project name → project; else → general).

---

### **Gap 6: No Error Recovery for Failed Promotions** (Medium Priority)

**Location:** `commands/promote.md` lines 63-70.

**Issue:** If a task creation fails, the harvest remains "approved" but does not get marked "promoted". The user must manually retry with `/slack-forge:promote`. But:

1. **No guidance on what to do if failures are systematic** — If all task creations fail (e.g., tasks-forge is down), the user must retry with no context on why failures occurred.

2. **No batch retry mechanism** — Users must run promote again to retry failed items, which will re-process all items and create duplicates if some succeeds on retry.

**Impact:** Large-scale failures are not gracefully handled.

**Recommendation:** Add a `--retry-failures` flag or a separate "retry" mode to promote command.

---

### **Gap 7: Init Command Has No Fallback for Empty Channel Discovery** (Low Priority)

**Location:** `commands/init.md` lines 57-74.

**Issue:** If `slack_search_channels()` returns 0 results, the command has no guidance on what to do. Silently proceed? Error out?

**Impact:** Confusing UX if no channels are discovered.

**Recommendation:** Add explicit handling: "If no channels are discovered, prompt the user to check MCP configuration or manually specify channel IDs."

---

## Triage Recommendation

**Verdict: FULL EVALUATION REQUIRED**

**Candidates for Full Evaluation (behavioral components with operational claims):**

1. **Forge Task Harvester** (`agents/forge-task-harvester.md`)
   - Makes behavioral claim: "identifies actionable tasks"
   - Requires validation: Can the agent reliably distinguish tasks from casual chat? Does confidence scoring work as intended? Are action_items formatted correctly?

2. **Forge Knowledge Harvester** (`agents/forge-knowledge-harvester.md`)
   - Makes behavioral claim: "identifies durable organizational knowledge"
   - Requires validation: Does the durability filter (2+ weeks) work? Are "significance" paragraphs actually strategic or just rephrased summaries?

3. **Forge JIRA Digest** (`agents/forge-jira-digest.md`)
   - Makes behavioral claim: "parses JIRA events and produces actionable digests"
   - Requires validation: Can the agent parse JIRA bot output reliably? Does "needs_action" scoring match user expectations? Are digests actually concise or verbose?

4. **Scan Command** (`commands/scan.md`)
   - Makes behavioral claim: "scan Slack via MCP and write local transcripts"
   - Requires validation: Does MCP retrieval work correctly across all channel types? Are transcripts formatted correctly for subagent parsing? Does JIRA cleanup reduce size effectively?

**Description Optimization Candidates:**

- **Init Command** — Well-written but could benefit from explicit guidance on empty discovery fallback.

**Direct Improvement Candidates:**

- **Capture Command** — Requires clarification of the Task tool interface and subagent dispatch mechanism.
- **Review Command** — Minor improvements: pagination for large harvest sets, confidence-based sorting.
- **Promote Command** — Minor improvements: type inference rules, error recovery for failed promotions.

---

## Detailed Improvement Recommendations

### Immediate Priorities (Block Further Use)

1. **Formalize the Transcript Format Contract**
   - Current: Narrative description with inline example
   - Needed: JSON Schema or BNF formal specification
   - Include: Regex patterns for parsing YAML, channel headers, message lines, timestamps
   - Include: Edge cases (empty channels, missing fields, malformed timestamps)

2. **Document the Task Tool Interface**
   - Current: Vague reference to "Task tool (`subagent_type: general-purpose`)"
   - Needed: Full specification of Task tool parameters and return schema
   - Needed: JSON schema for subagent briefs and responses

3. **Add Explicit Parsing Guidance to All Agents**
   - Current: Implicit parsing logic in agent implementation
   - Needed: Explicit regex patterns and parsing pseudocode in each agent file
   - Needed: Error handling guidance (what to do if transcript format doesn't match)

### High-Priority Improvements (Within 1 Sprint)

4. **Formalize Digest Content Structure**
   - Current: Prescriptive but vague on edge cases
   - Needed: Fixed field requirements, explicit section ordering, edge case handling
   - Needed: Clarification of "high-volume noise" threshold and selection criteria

5. **Provide Knowledge Type Inference Rules**
   - Current: Heuristic ("LLM determines category")
   - Needed: Explicit rules mapping tags/content signals to memory types
   - Needed: Default handling for ambiguous items

### Medium-Priority Improvements (Polish & UX)

6. **Add Error Recovery Mechanisms**
   - Promote command: Add `--retry-failures` flag
   - Promote command: Better error messages for systematic failures

7. **Enhance Review Command UX**
   - Add pagination for large pending sets
   - Sort by confidence level by default
   - Show counts of items per type in summary

---

## Writing Quality Summary

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Clarity** | Strong | Prompts are clear, code blocks are well-formatted, examples are concrete. |
| **Consistency** | Adequate | Terminology is mostly consistent (skill/agent/command), but "Task tool" and "primary agent" are jargon not defined elsewhere. |
| **Organization** | Strong | Logical flow in all components. Section numbering makes navigation easy. |
| **Examples** | Strong | Good/bad examples are instructive. Task content examples, knowledge content examples, and digest structure examples are helpful. |
| **Formal Specs** | Weak | Critical procedural details are narrative, not formally specified (transcript format, parsing logic, Task tool interface). |
| **Error Handling** | Adequate | Error recovery is documented for most CLI calls, but not for subagent failures or malformed input. |

---

## Plugin Statistics

- **Total Lines:** 1,177
- **Skills:** 3 (task-harvester, knowledge-harvester, jira-digest)
- **Commands:** 5 (init, scan, capture, review, promote)
- **Agents:** 3 (forge-task-harvester, forge-knowledge-harvester, forge-jira-digest)
- **Lines per Skill:** 62-74 (well-sized)
- **Lines per Command:** 92-197 (capture is minimal, scan is dense)
- **Lines per Agent:** 87 each (consistent, minimal)

---

## Conclusion

The Slack Forge plugin is **well-conceived and strategically sound**, but **requires significant clarification before operational deployment**. The three behavioral components (task, knowledge, JIRA extraction) are the heart of the system and carry high risk if the parsing logic or provenance handling is flawed.

**Primary blocking issues:**

1. Transcript format must be formally specified — current narrative + example is insufficient for reliable parsing.
2. Task tool interface must be documented — capture command is unimplementable without it.
3. Subagent parsing logic must be explicit — implicit reverse-engineering is error-prone.

**Secondary issues:**

4. Digest structure edge cases must be clarified.
5. Knowledge type inference rules must be explicit.
6. Error recovery mechanisms are weak.

**Recommendation:** Prioritize formalizing the transcript format and Task tool interface before running live scans. Then conduct full evaluation of the three harvester agents (task, knowledge, JIRA) with test data to validate parsing reliability and output quality.

---

**Audit completed:** 2026-03-09
**Auditor:** Forge Skills Audit Project
**Status:** Ready for stakeholder review and triage prioritization
