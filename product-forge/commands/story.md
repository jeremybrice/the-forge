---
description: Generate, update, or review Story cards (engineer-level work items under an Epic).
---

# Story Command

## Mode Routing

Determine the mode from the user's input:
- "create", "generate", "new", or no mode specified with new context → **Create Mode**
- "update", "revise", "modify", or references an existing card → **Update Mode**
- "review", "assess", "evaluate", or asks for feedback → **Review Mode**

If the user says "update" or "review" without specifying a card, ask which card to work with (by title or filename).

---

## Create Mode

### Process

**1. Gather Context**

Accept input from:
- An existing Epic card (Story must align with Epic goals)
- An approved intake output (if invoked after `/intake`)
- Conversation context from the current session
- Direct user prompt describing the Story or Stories

Stories can be generated in batches if multiple related stories are needed to cover an Epic's Suggested Story Breakdown.

Determine the parent Epic if available.

**2. Draft the Story Card(s)**

Use the **pm-methodology** skill to generate structured Story cards with these sections:

**Story Title**: Choose the most appropriate format:
- User Story Format: "As a [role], I want [goal], so that [benefit]" (feature work)
- Simple Directive Format: Brief, action-oriented (5-10 words) (backend, infrastructure, focused work)

- **Background/Context** (prose): 1-2 paragraphs on why this Story exists, current behavior, problem being addressed, business impact
- **UI Behavior** (bullets): Screen appearance, user interactions, visual feedback, modals/tooltips
- **Business Rules** (bullets): Business-level rules governing behavior (NOT database fields or APIs)
- **Acceptance Tests** (named format): 4-6 tests with Test N: Name / Steps / Expected Result
- **Implementation Context** (bullets): Constraints, related systems, questions to consider, scale considerations
- **Implementation Flexibility** (optional): Statement when engineering has latitude on technical approach

**3. Present for Approval**

Show the complete card(s) to the user. For batch stories, show all stories and ask for approval of the set.

**4. Save via forge-lib**

On approval, construct the frontmatter data for each story:

```python
{
  "title": "[Story Title]",
  "type": "story",
  "status": "Draft",
  "product": "[From taxonomy]",
  "module": "[From taxonomy]",
  "client": "[From taxonomy]",
  "team": "[Team name]",
  "parent": "[parent Epic filename without .md]",
  "story_points": null,
  "jira_card": null,
  "source_conversation": "[Conversation title or context]",
  "background_context": "[Full Background/Context prose]",
  "ui_behavior": ["Behavior1", "Behavior2"],
  "business_rules": ["Rule1", "Rule2"],
  "acceptance_tests": [
    {
      "name": "Test 1: Descriptive Name",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "expected_result": "Clear outcome description"
    }
  ],
  "implementation_context": ["Context1", "Context2"],
  "implementation_flexibility": "[Optional statement]",
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD"
}
```

Then call for each story:
```bash
forge card create story "{title}" --data '[JSON frontmatter]' --directory .
```

The forge-lib template (templates/story.md.j2) renders the card body from the frontmatter fields. The command returns the created filename.

**5. Link to Parent**

Link each Story to its parent Epic:
```bash
forge relationship link epic-filename.md story-filename.md
```

For single story: Report `Story saved to cards/stories/{filename}.md`
For batch stories: Report `Stories saved to cards/stories/:` with list of filenames

---

## Update Mode

**1. Identify the card**

Use forge-lib to find the card:
```bash
forge card query --type story --directory .
```

Or accept a direct filename from the user.

**2. Accept new context**

User provides freeform input (meeting notes, feedback, changed requirements, revised scope, etc.)

**3. Read existing card**

```bash
forge card get story [filename]
```

**4. Semantic comparison and diff**

Compare new context against existing sections. Identify:
- Which sections need changes (modifications, additions)
- Which sections remain untouched

Present a clear diff showing:
- Modified fields and sections
- Added content
- Removed content
- Unchanged sections (mention but don't show)

Example:
```
**Changes to [Story Title]:**

**Story Points:** null → 5
**Business Rules:**
- Added: "Setting changes take effect immediately"
- Modified: Permission rule updated

**Acceptance Tests:**
- Added: Test 5 covering new permission scenario

All other sections unchanged.
```

**5. Get approval**

Ask the user to confirm or adjust the proposed changes. CRITICAL: Never silently overwrite. This is especially important for Stories engineering may be working from.

**6. Save updates**

```bash
forge card update story [filename] --data '[JSON frontmatter updates]'
```

Updated fields are merged into the existing card. The template re-renders the body with updated data.

Report: `Story updated: {filename}`

---

## Review Mode

**1. Read the card**

```bash
forge card get story [filename]
```

**2. Assess quality**

Use **pm-methodology** skill guidance to evaluate:

**Engineer Self-Sufficiency**
- Could an engineer start working without asking clarifying questions?
- Is the "why" clear for good judgment calls?
- Is there enough context about parent Epic/Initiative?

**Acceptance Test Quality**
- Are tests specific and testable?
- Do they use named format (Test N: Name / Steps / Expected Result)?
- Do they cover happy path, edge cases, error states?
- Could QA write automated tests from these?

**Business Rules Quality**
- Written from business perspective?
- Avoid implementation-specific language (DB fields, API specs)?
- Conditions, constraints, edge cases clearly described?
- Could an engineer use different technical approach and still satisfy?

**Implementation Context Sufficiency**
- Affected systems identified?
- Enough context without being prescriptive?
- Known constraints documented?
- Backward compatibility addressed?

**Scope Appropriateness**
- Atomic (one sprint or less)?
- Could/should it be broken down further?
- Scope that belongs in separate story?

**Formatting Compliance**
- No tables used
- No dashes separating thoughts
- Bullets for UI Behavior and Business Rules
- Named test format for Acceptance Tests
- No implementation prescriptions

Provide structured assessment with ratings (Strong, Adequate, Needs Attention), specific observations, and improvement suggestions.

**3. Cross-card comparison (only if user-requested)**

Only when the user explicitly requests comparison with another card.

---

## Validation Rules

Before saving, ensure:

1. **Atomic scope**: Completable in 1-3 days by one engineer or pair
2. **Business rules, not system logic**: "What" and "why" from business perspective, not "how"
3. **Testable acceptance criteria**: Named test format with Steps and Expected Result
4. **Parent Epic identified**: Clear parent Epic; if not, consider regrouping

---

## Key Rules

- **Delegation:** All file operations go through forge-lib CLI
- **Approval Required:** Always get user confirmation before saving
- **Mode Clarity:** Detect mode from user intent, clarify if ambiguous
- **Formatting:** Never use tables, dashes only in compound words, named test format
- **Skills:** Reference **pm-methodology** for tone and structure guidance
- **Sequential Numbering:** forge-lib handles story-NNN-slug.md numbering automatically
- **Parent Linking:** Stories should have a clear parent Epic
