# Jira Skills Catalog

## Create Jira Work Item

**What it does**: Creates Jira issues of any type (Epic, Story, Task, Bug, Sub-task, custom types) with specified fields.

**Parameters**: Issue type, summary, description, assignee, priority, labels, components, custom fields, project, parent issue (for sub-tasks/stories under epics).

**Limitations**:
- Custom fields and labels often write to description instead of the actual field
- Workaround: use post-creation Jira automation rules to move data from description to proper fields
- Requires user confirmation in chat contexts; automatic in automation
- Must request user input for any missing required fields
- Recent improvements support parent/epic relationship setting during creation

**Recommended for**: Ticket Generation, Bug Reporting patterns.

---

## Search Jira Issues (JQL)

**What it does**: Queries issues using natural language or Jira Query Language. Translates natural language into JQL, executes search, returns matching issues.

**Parameters**: Natural language query or JQL syntax.

**Limitations**:
- Large result sets may require batching via JQLExecutionTool
- Automatically enabled if Jira is configured as knowledge source

**Recommended for**: All patterns (duplicate detection, context research, triage analysis).

---

## Update Issue Fields

**What it does**: Modifies existing issue field values including priority, assignee, status, description, and custom fields.

**Parameters**: Issue key, field name, new value.

**Limitations**:
- Same custom field limitations as creation (may write to description)
- Requires confirmation before execution

**Recommended for**: Ticket Triage, Sprint Management patterns.

---

## Add Issue Comment

**What it does**: Posts comments on existing issues. Comments attributed to agent by default (attribution can be reassigned in automation contexts).

**Parameters**: Issue key, comment text.

**Limitations**: None documented.

**Recommended for**: Triage summaries, follow-up guidance, requesting clarification.

---

## Find Similar Issues

**What it does**: Locates existing issues semantically similar to a reference issue or description. Analyzes issue content (title, description, labels) to find related issues.

**Parameters**: Reference issue key or issue description text.

**Limitations**: None documented. Uses Jira Field Search as supporting system skill.

**Recommended for**: Deduplication during creation, finding related issues during triage.

---

## Link Issues

**What it does**: Creates relationships between issues: parent-child links (Epic links, Sub-task parents), blocks relationships, relates-to relationships, and custom link types.

**Parameters**: Source issue key, link type, destination issue key.

**Limitations**: None documented.

**Recommended for**: Work Item Organization, Sprint Management patterns.

---

## Transition Issue Status

**What it does**: Moves issues through valid workflow states (e.g., Open > In Progress > Done).

**Parameters**: Issue key, target status.

**Limitations**:
- Cannot force invalid transitions; must follow workflow rules
- Must follow project's configured workflow

**Recommended for**: Sprint Management, blocker detection workflows.

---

## Suggest Assignee

**What it does**: Recommends team members or teams for assignment based on historical patterns, past work patterns, and team responsibilities.

**Parameters**: Issue context (description, issue type, project).

**Limitations**: Relies on organizational data and historical patterns. Quality depends on data availability.

**Recommended for**: Ticket Triage, Ticket Generation patterns.

---

## Add to Sprint

**What it does**: Adds issues to active sprints for sprint planning and tracking.

**Parameters**: Issue key, sprint ID.

**Limitations**: Requires Scrum board project.

**Recommended for**: Sprint Management pattern.

---

## Jira Field Search (System Skill)

**What it does**: Retrieves metadata about Jira fields, custom fields, field values, and field constraints. Looks up available fields, valid values, and constraints.

**Configuration**: Automatically enabled when Jira is a knowledge source. Not manually configurable.

**Recommended for**: Supporting all patterns that need field validation or metadata lookup.

---

## Delete Issues

**What it does**: Removes issues from Jira.

**Parameters**: Issue key(s).

**Limitations**:
- Rare use case requiring high-level permissions
- Multiple confirmation dialogs (safety feature, cannot be disabled in chat)

**Recommended for**: Rarely recommended. Include only when cleanup is an explicit agent purpose.

---

## Additional Analysis Capabilities

These capabilities emerge from the combination of knowledge sources and instructions:

- **Analyze Ticket Content**: Semantic analysis of descriptions/comments to extract intent and priority signals
- **Generate Issue Summaries**: Executive summaries of complex tickets
- **Extract Data**: Structured data extraction from unstructured ticket content
- **Identify Blocking Issues**: Determines if an issue is blocked, updates status
- **Create Epic**: Creates Epics with goals, timeline, benefits

---

## Skill Interaction with Automation

When agents run from automation rules:
- **Cannot use any skills listed above**
- Can only provide text responses
- Response captured via `{{agentResponse}}` smart value
- Subsequent automation actions parse and act on the response
- For automation, instruct agents to use structured output format: `[PRIORITY: X] [TEAM: Y] [LABELS: Z] [REASONING: explanation]`
