# Validation Rules Reference

## Agent Component Constraints

| Component | Constraint | Value | Severity |
|---|---|---|---|
| **Name** | Character count | 10-100 characters | Required |
| **Description** | Character count | 50-500 characters | Required |
| **Behavior Instructions** | Word count | 100-500 words | Recommended |
| **Scenario Instructions** | Word count per scenario | 300-1000 words | Recommended |
| **Scenarios** | Count per agent | 1 (minimum, default required) to 5 (recommended max) | Recommended |
| **Skills** | Count per agent | 4-5 maximum | Recommended |
| **Conversation Starters** | Count | Exactly 3 | Required |
| **Conversation Starters** | Word count each | 5-10 words | Recommended |
| **Collaborators + Admins** | Total per agent | Maximum 40 | Hard limit |
| **Creation Permission Groups** | Groups with create access | Maximum 10 user groups | Hard limit |
| **Deep Research** | Requests per user per day | 30 | Hard limit |
| **Deep Research** | Timeout | 15 minutes | Hard limit |
| **Context Window** | Token limit | 128,000 tokens (~96,000 words) | Hard limit |

---

## Instruction Length Performance Impact

| Range | Behavior |
|---|---|
| **100-200 words** | Fastest performance, most consistent behavior, easiest to debug |
| **200-400 words** | Good balance between specificity and performance (recommended) |
| **400+ words** | Performance degrades, behavior becomes less consistent, harder to troubleshoot |

**Optimization strategy**: Keep behavior instructions concise (role + universal constraints). Use scenarios to split complex jobs into focused responsibilities. Supplement with knowledge sources rather than embedding context in instructions.

---

## Validation Checks

### Name Validation
- Must be 10-100 characters
- Jira agents: use action-verb convention ("Ticket Triage Agent," "Issue Quality Checker")
- Confluence agents: use role-based convention ("Documentation Specialist," "Content Reviewer")
- Must be descriptive of the agent's purpose

### Description Validation
- Must be 50-500 characters
- Should cover: what the agent does, who it's for, what scope it operates in
- Should be comprehensive enough for discoverability but not overwhelming

### Behavior Instructions Validation
- Recommended 100-500 words
- Must include: role definition, scope, communication style, permission awareness
- Should NOT include: scenario-specific process steps (those go in scenarios)
- Anti-pattern check: reject if all instructions are in behavior with empty scenarios

### Scenario Instructions Validation
- Recommended 300-1000 words per scenario
- Each scenario must have: name, trigger keywords, detailed instructions
- Default scenario required (fallback for unmatched prompts)
- Warn if >5 scenarios (diminishes trigger matching accuracy)
- Each scenario should follow TCREI framework

### Skills Validation
- Maximum 4-5 skills per agent
- More than 5 leads to: slower response times, less focused behavior, reduced accuracy
- Skills should align with agent's purpose (don't enable unrelated skills)
- Warn about known limitations (custom fields write to description, labels inconsistency)

### Conversation Starters Validation
- Must be exactly 3
- Each should be 5-10 words
- Should reflect the agent's primary scenarios
- All users see the same 3 starters regardless of permissions

### Governance Validation
- Collaborators + Admins cannot exceed 40
- Agent must have an owner
- Creation permission groups cannot exceed 10

---

## Known Limitations to Flag

### Jira-Specific
- Custom fields and labels often write to description instead of actual fields
- Workaround: post-creation Jira automation rules to move data to proper fields
- No skills available when agent runs in automation mode (text response only)
- Agents cannot force invalid workflow transitions
- Bulk operations limited to 20 items

### Confluence-Specific
- No bulk operations through skills (page-by-page only)
- No compare-and-merge capability for conflicting updates
- Hierarchy operations require multiple individual actions
- No template application skill (must reference templates manually)
- No workflow state management beyond publish/archive

### Cross-Platform
- Agents never grant more permissions than the user has
- Confirmation required before executing actions in chat contexts
- System skills are auto-configured and not manually controllable
- Deep Research unavailable in default scenario (custom scenarios only)

---

## Automation Mode Constraints

When agents are invoked from Jira/Confluence automation rules:
- **Cannot use their own skills**: text response only
- Response captured via `{{agentResponse}}` smart value
- Subsequent automation actions must parse and act on the response
- Deep Research has a 15-minute timeout (automation fails if exceeded)
- Comment attribution defaults to agent (can be reassigned to rule creator)
- For parseable responses, instruct the agent to use structured format: `[PRIORITY: X] [TEAM: Y] [LABELS: Z]`
