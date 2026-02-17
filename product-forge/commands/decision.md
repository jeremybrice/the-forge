---
description: Log a decision to the Decision Log with structured extraction workflow. Creates a decision card via forge-lib.
---

# /decision Command

## Overview

The `/decision` command extracts decision details from conversation context or direct input, classifies the decision, and persists it via `forge card create decision`.

## Conversational Workflow

### Phase 1: Extract Decision Details

From the conversation or user's direct input, identify:
- **The decision** (what was decided)
- **Rationale** (why this decision was made, trade-offs considered)
- **Impact** (what changes as a result)
- **Stakeholders** (who was involved or affected)

If the user provides the decision directly (e.g., `/decision Use cabinet-level slot management`), extract the rest from conversation context.

### Phase 2: Classify the Decision

**Decision Type** (select one):
- **Architecture**: Technical design decisions, system structure, integration patterns
- **Scope**: What's in or out, feature boundaries, MVP definitions
- **Priority**: Sequencing decisions, what to build first, trade-offs
- **Technical**: Implementation approach, technology choices, performance targets
- **Stakeholder Commitment**: Agreements with clients, leadership sign-offs, timeline commitments

**Taxonomy Fields** (product, module, client):
- Query forge-lib: `forge memory get-taxonomy products`
- Infer from conversation context
- If no match, accept freeform value and suggest adding to taxonomy

### Phase 3: Confirm with User

**Always confirm before saving.** Decisions carry authority and need explicit approval.

Present:
```
Decision to log:

**Title:** [Concise, action-oriented statement]
**Type:** [Decision type]
**Product/Module/Client:** [Classifications]
**Rationale:** [Why this was decided]
**Impact:** [What changes]
**Stakeholders:** [Who's involved]

Should I log this decision?
```

Wait for user confirmation before proceeding.

### Phase 4: Create Decision Card

Once confirmed, use forge-lib to create the decision card:

```bash
forge card create decision "{Decision Title}" \
  --directory . \
  --data '{
    "product": "{inferred or asked}",
    "module": "{inferred or asked}",
    "client": "{inferred or asked}",
    "decision_type": "{Architecture|Scope|Priority|Technical|Stakeholder Commitment}",
    "status": "Active",
    "stakeholders": "{Names of people involved}",
    "source_conversation": "{Conversation context or reference}",
    "rationale": "{Why this decision was made. Context, trade-offs, reasoning.}",
    "impact": "{What changes as a result. Affected systems, teams, timelines.}"
  }'
```

The forge-lib will:
- Generate filename: `{kebab-case-title}.md`
- Add frontmatter with decision_date, created, updated
- Write to `cards/decisions/`
- Update index.json

### Parse forge-lib Response

The forge-lib command returns JSON:

```json
{
  "success": true,
  "data": {
    "filename": "{slug}.md",
    "filepath": "cards/decisions/{slug}.md",
    "card_type": "decision",
    "title": "{title}",
    "created": "YYYY-MM-DD",
    "updated": "YYYY-MM-DD"
  }
}
```

Extract `data.filename` and `data.filepath` for the confirmation message.

### Error Handling

If forge-lib returns an error response:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report the error to the user:
```
Error creating decision: {error message from JSON response}
```

Common errors:
- **Validation error**: A required field is missing or has an invalid value. Review the field values and retry.
- **Duplicate filename**: A card with the same title already exists. Suggest a different title or use the update command.

After successful creation, display:
```
Decision logged: {filename}
```

## Key Behaviors

**Title Format:** Concise and action-oriented
- ✓ "Use cabinet-level slot management instead of device-level"
- ✗ "We decided about where data lives"

**Stakeholders Field:** Include names of people mentioned in conversation. If none mentioned, ask who should be listed.

**Context Extraction:** The Rationale section serves as the condensed context. Pull trade-offs, reasoning, and background into this field.

**Direct Input:** When user provides decision with command, extract additional details from conversation history.

---

This command focuses on conversational extraction and confirmation workflow, delegating all file operations to forge-lib.
