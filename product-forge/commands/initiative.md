---
description: Generate, update, or review Initiative cards (top-level scope definition for leadership).
---

# Initiative Command

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
- An approved intake output (if invoked after `/intake`)
- Conversation context from the current session
- Direct user prompt describing the Initiative

**2. Draft the Initiative Card**

Use the **pm-methodology** skill to generate a structured Initiative with these sections:

- **Background** (prose): 2-3 paragraphs on current state, problem, market context, user pain points
- **Proposed Solution** (prose): 2-3 paragraphs on high-level solution, business-focused
- **Affected Systems** (bullets): System names from product taxonomy
- **Potential Requirements** (bullets): 4-6 high-level capabilities
- **Additional Considerations** (bullets): Cross-cutting concerns, migration needs, constraints
- **Open Questions** (bullets): Unknowns or decisions pending
- **Out of Scope** (bullets, optional): Explicitly excluded items

**3. Present for Approval**

Show the complete card to the user. Ask for confirmation or revisions.

**4. Save via forge-lib**

On approval, construct the frontmatter data including all card sections:

```python
{
  "title": "[Initiative Title]",
  "type": "initiative",
  "status": "Draft",
  "product": "[From taxonomy]",
  "module": "[From taxonomy]",
  "client": "[From taxonomy]",
  "team": "[Team name]",
  "confidence": "[Low | Medium | High]",
  "estimate_hours": null,
  "jira_card": null,
  "source_intake": "[intake filename without .md, if applicable]",
  "children": [],
  "description": "[Condensed Background + Proposed Solution]",
  "source_conversation": "[Conversation title]",
  "background": "[Full Background prose]",
  "proposed_solution": "[Full Proposed Solution prose]",
  "affected_systems": ["System1", "System2"],
  "potential_requirements": ["Req1", "Req2", "Req3"],
  "additional_considerations": ["Consideration1", "Consideration2"],
  "open_questions": ["Question1", "Question2"],
  "out_of_scope": ["Item1", "Item2"],
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD"
}
```

Then call:
```bash
forge card create initiative "{title}" --data '[JSON frontmatter]' --directory .
```

The forge-lib template (templates/initiative.md.j2) renders the card body from the frontmatter fields. The command returns the created filename.

**5. Link to Intake (if applicable)**

If created from an intake, link the relationship:
```bash
forge relationship link intake-filename.md initiative-filename.md
```

Report: `Initiative saved to cards/initiatives/{filename}.md`

---

## Update Mode

**1. Identify the card**

Use forge-lib to find the card:
```bash
forge card query --type initiative --directory .
```

Or accept a direct filename from the user.

**2. Accept new context**

User provides freeform input with updates.

**3. Read existing card**

```bash
forge card get initiative [filename]
```

**4. Merge changes**

Apply user-requested changes to the card content. Present the updated card for approval.

**5. Save updates**

```bash
forge card update initiative [filename] --data '[JSON frontmatter updates]'
```

Updated fields are merged into the existing card. The template re-renders the body with updated data.

Report: `Initiative updated: {filename}`

---

## Review Mode

**1. Read the card**

```bash
forge card get initiative [filename]
```

**2. Assess quality**

Use **pm-methodology** skill guidance to review:
- Is the Background clear and well-motivated?
- Does the Proposed Solution align with the problem?
- Are Affected Systems accurate?
- Are Potential Requirements substantive and estimable?
- Are Open Questions specific enough for engineering to answer?

Provide constructive feedback to the user. No file writes in review mode.

---

## Key Rules

- **Delegation:** All file operations go through forge-lib CLI
- **Approval Required:** Always get user confirmation before saving
- **Mode Clarity:** Detect mode from user intent, clarify if ambiguous
- **Formatting:** Use prose for Background/Solution, bullets for lists
- **Skills:** Reference **pm-methodology** for tone and structure guidance
