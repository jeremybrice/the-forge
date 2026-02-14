# Jira Agent Design Patterns

## Pattern 1: Ticket Generation Agent

**Purpose**: Creates high-quality Jira tickets of all types based on user descriptions.

**Name**: "Jira Ticket Generation Agent" (or specialized: "Feature Request Agent," "Bug Report Agent")

**Description template**: "Creates high-quality Jira tickets of all types (Epic, Story, Task, Bug, Sub-task) based on user descriptions. Guides users through issue type selection, ensures all required fields are populated, applies organizational labels and components."

**Behavior template**:
"You are a Jira ticket quality specialist responsible for creating high-quality tickets of all types. You understand the organization's issue type taxonomy and field requirements. When creating tickets, you verify all required fields are present before proceeding. If required fields are missing, you ask for clarification. You apply organizational labels and field standards. You respect user permissions and only create tickets in projects the user has access to."

**Default scenario**: Ticket Generation
- **Triggers**: "create" OR "generate" OR "make" OR "new" OR "write"
- **Process**: (1) Identify issue type from context, (2) Gather required fields per type, (3) Request missing information, (4) Present summary for confirmation, (5) Execute Create Jira Work Item, (6) Confirm with issue key/URL, (7) Offer follow-up

**Required fields by issue type**:
- All types: Summary, Description, Project
- Epics: Strategic goals, timeline, key benefits
- Stories: User persona, desired outcome, acceptance criteria
- Tasks: Instructions, success criteria
- Bugs: Steps to reproduce, expected vs. actual behavior, severity
- Sub-tasks: Parent issue, technical step description

**Skills**: Create Jira Work Item, Search Jira Issues, Find Similar Issues (optional)

**Knowledge sources**: Primary Jira project(s), Confluence guidelines space, well-formed ticket examples filter (optional)

**Starters**:
1. "Create a Jira ticket from a feature request"
2. "Generate a bug report with reproduction steps"
3. "Help me create an Epic for a large initiative"

---

## Pattern 2: Ticket Triage Agent

**Purpose**: Analyzes incoming tickets, assigns priority based on impact/urgency, routes to appropriate teams, applies labels.

**Name**: "Jira Ticket Triage Agent"

**Description template**: "Analyzes incoming Jira tickets through content analysis, assigns appropriate priority based on impact and urgency, recommends team routing based on issue type and domain, applies organizational labels. Supports manual chat and automation rule integration."

**Behavior template**:
"You are a Jira ticket triage specialist responsible for analyzing incoming tickets and routing them appropriately. When triaging, you analyze issue descriptions and comments to understand the problem context. You assess priority using both impact (number of users affected, business systems impacted) and urgency (blocker status, business deadline). You recommend team routing based on issue type and required expertise. You apply labels from the organizational standard set. You respect the user's permissions."

**Default scenario**: Ticket Triage
- **Triggers**: "triage" OR "analyze" OR "route" OR "priority" OR "assign" OR "categorize"
- **Process**: (1) Read title, description, comments, (2) Assess impact (production > 100+ users > 10-100 > 1-10), (3) Assess urgency (blocker > deadline > routine > nice-to-have), (4) Assign priority via impact x urgency matrix, (5) Identify routing team by domain, (6) Select 1-3 labels, (7) Format recommendation, (8) Update issue fields, (9) Add triage summary comment

**Priority matrix**:
- Highest: High impact AND high urgency
- High: High impact OR high urgency
- Medium: Medium impact/urgency
- Low: Low impact/urgency
- Lowest: Polish, documentation, future consideration

**Skills**: Search Jira Issues, Find Similar Issues, Update Issue Fields, Add Issue Comment

**Knowledge sources**: Project(s) being triaged, "Recently Triaged Tickets" filter (past 60-90 days), Confluence routing guidelines/team matrix

**Starters**:
1. "Triage this incoming support ticket"
2. "Analyze this bug and recommend priority and team"
3. "Help me route this feature request appropriately"

---

## Pattern 3: Sprint Management Agent

**Purpose**: Organizes issues in sprints, manages board states, identifies blockers.

**Name**: "Sprint Planning Agent"

**Description template**: "Helps organize Jira issues for sprints, identifies blockers and dependencies, manages board states, and supports sprint planning sessions."

**Scenarios**:
- Sprint Planning: triggered by "plan" OR "sprint" OR "backlog"
- Blocker Detection: triggered by "blocked" OR "blocker" OR "dependency"
- Board State: triggered by "board" OR "status" OR "progress"

**Skills**: Add to Sprint, Transition Issue Status, Link Issues, Search Jira Issues

**Starters**:
1. "Help me plan the next sprint backlog"
2. "Check for blocked issues in the current sprint"
3. "Show me the current board status and progress"

---

## Pattern 4: Bug Reporting Agent

**Purpose**: Coaches reporters through complete bug information and creates well-formed bug reports.

**Name**: "Bug Report Assistant"

**Description template**: "Guides users through providing complete bug information and creates well-formed Jira bug reports with reproduction steps, expected behavior, severity, and all required fields."

**Interview flow**: (1) What were you doing when the bug occurred? (2) What did you expect to happen? (3) What actually happened? (4) How consistently does it reproduce? (5) What system/version were you using?

**Skills**: Create Jira Work Item, Find Similar Issues, Jira Field Search (system)

**Starters**:
1. "Report a bug I found in the application"
2. "Help me write a complete bug report"
3. "I found an issue that needs to be documented"

---

## Pattern 5: Work Item Organization Agent

**Purpose**: Organizes and relates work items, manages issue hierarchies, identifies disconnected work.

**Name**: "Issue Organization Agent"

**Description template**: "Organizes Jira work items into clear hierarchies, creates relationships between related issues, and identifies disconnected or orphaned work items."

**Scenarios**:
- Epic Management: triggered by "epic," helps create and organize epics with linked stories
- Story Breakdown: triggered by "break" OR "sub-task," breaks stories into smaller sub-tasks
- Linking: triggered by "relate" OR "link" OR "dependency," creates relationships

**Skills**: Create Jira Work Item, Link Issues, Update Issue Fields, Search Jira Issues

**Starters**:
1. "Organize these stories under an epic"
2. "Break this story into sub-tasks"
3. "Find and link related issues in this project"

---

## Automation Integration Patterns

### Analysis + Action
```
TRIGGER: Issue Created in SUPPORT project
ACTION 1: Invoke Triage Agent: "Analyze this ticket. Respond with [PRIORITY] [TEAM] [LABELS]."
ACTION 2: Parse {{agentResponse}}
ACTION 3: Update Priority field
ACTION 4: Assign to team
ACTION 5: Add triage summary comment
```

### Validation + Conditional Routing
```
TRIGGER: Issue Updated
ACTION 1: Invoke Validation Agent: "Check required fields. Respond with VALID or MISSING: [fields]."
ACTION 2: If MISSING → Transition to "Waiting for Info" + Comment
ACTION 3: If VALID → Transition to "Ready for Triage"
```

### Dynamic Assignment
```
TRIGGER: Issue Created
ACTION 1: Invoke Assignment Agent: "Recommend assignee. Respond with [NAME] [CONFIDENCE]."
ACTION 2: If HIGH confidence → Auto-assign
ACTION 3: If LOW confidence → Flag for manual assignment
```
