---
description: Generate, update, or review Epic cards (team-level feature container under an Initiative).
---

# Epic Command

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
- An existing Initiative card (Epic must align with Initiative goals)
- An approved intake output (if invoked after `/intake`)
- Conversation context from the current session
- Direct user prompt describing the Epic

Determine the parent Initiative if available.

**2. Draft the Epic Card**

Use the **pm-methodology** skill to generate a structured Epic with these sections:

- **Background/Context** (prose): 1-2 paragraphs on why this Epic exists, link to Initiative, business value
- **Epic Scope** (prose): 1-2 paragraphs defining exact capability boundaries
- **Affected Systems** (bullets): System names from product taxonomy
- **Functional Capabilities** (bullets): Observable, testable capabilities (1-2 sentences each)
- **Suggested Story Breakdown** (bullets): Candidate Stories to decompose this Epic
- **Success Criteria** (bullets): High-level observable outcomes
- **Related Epics/Dependencies** (bullets): Sequencing constraints, dependencies
- **Technical Constraints** (bullets): Known limitations or requirements
- **Open Questions** (bullets): Unresolved decisions affecting Story creation
- **Out of Scope** (bullets, optional): Explicitly excluded items

**3. Present for Approval**

Show the complete card to the user. Ask for confirmation or revisions.

**4. Save via forge-lib**

On approval, construct the frontmatter data including all card sections:

```python
{
  "title": "[Epic Title]",
  "type": "epic",
  "status": "Planning",
  "product": "[From taxonomy]",
  "module": "[From taxonomy]",
  "client": "[From taxonomy]",
  "team": "[Team name]",
  "parent": "[parent Initiative filename without .md]",
  "children": [],
  "description": "[Epic Scope condensed to 2-3 sentences]",
  "source_intake": "[intake filename without .md, if applicable]",
  "source_conversation": "[Conversation title]",
  "background_context": "[Full Background/Context prose]",
  "epic_scope": "[Full Epic Scope prose]",
  "affected_systems": ["System1", "System2"],
  "functional_capabilities": ["Capability1", "Capability2"],
  "story_breakdown": ["Story1", "Story2", "Story3"],
  "success_criteria": ["Criterion1", "Criterion2"],
  "related_epics": ["Epic1", "Epic2"],
  "technical_constraints": ["Constraint1", "Constraint2"],
  "open_questions": ["Question1", "Question2"],
  "out_of_scope": ["Item1", "Item2"],
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD"
}
```

Then call:
```bash
forge card create epic --data '[JSON frontmatter]' --directory .
```

The forge-lib template (templates/epic.md.j2) renders the card body from the frontmatter fields. The command returns the created filename.

**5. Link to Parent**

Link the Epic to its parent Initiative:
```bash
forge relationship link initiative-filename.md epic-filename.md
```

If created from an intake, also link to the intake:
```bash
forge relationship link intake-filename.md epic-filename.md
```

Report: `Epic saved to cards/epics/{filename}.md`

---

## Update Mode

**1. Identify the card**

Use forge-lib to find the card:
```bash
forge card query epic --title "[search term]"
```

Or accept a direct filename from the user.

**2. Accept new context**

User provides freeform input with updates (meeting notes, feedback, changed requirements, etc.)

**3. Read existing card**

```bash
forge card get epic [filename]
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

**5. Get approval**

Ask the user to confirm or adjust the proposed changes. CRITICAL: Never silently overwrite.

**6. Save updates**

```bash
forge card update epic [filename] --data '[JSON frontmatter updates]'
```

Updated fields are merged into the existing card. The template re-renders the body with updated data.

Report: `Epic updated: {filename}`

---

## Review Mode

**1. Read the card**

```bash
forge card get epic [filename]
```

**2. Assess quality**

Use **pm-methodology** skill guidance to review:

**Story Coverage**
- Does the suggested story breakdown cover the full Epic scope?
- Are there gaps where stories are missing?
- Is story granularity appropriate?

**Scope Consistency**
- Is Epic scope consistent with parent Initiative?
- Does scope stay within stated boundaries?

**Acceptance Criteria Clarity**
- Are success criteria specific and observable?
- Can a PM determine "done" from the criteria?

**Completeness**
- Are all required sections present and substantive?
- Are affected systems, constraints, and dependencies documented?

**Actionability**
- Could an engineering team use this to plan a sprint?
- Are there blocking questions that must be resolved first?

Provide structured assessment with ratings (Strong, Adequate, Needs Attention), specific observations, and improvement suggestions.

**3. Cross-card comparison (only if user-requested)**

Only when the user explicitly requests comparison with another card.

---

## Key Rules

- **Delegation:** All file operations go through forge-lib CLI
- **Approval Required:** Always get user confirmation before saving
- **Mode Clarity:** Detect mode from user intent, clarify if ambiguous
- **Formatting:** Use prose for Background/Scope, bullets for lists
- **Skills:** Reference **pm-methodology** for tone and structure guidance
- **Parent Linking:** Epics should have a clear parent Initiative
