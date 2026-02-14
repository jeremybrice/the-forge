---
description: Structured interview for gathering product requirements with adaptive Q&A workflow. Creates an intake card via forge-lib.
---

# /intake Command

## Overview

The `/intake` command conducts an adaptive Q&A interview covering seven topic areas. It produces a standardized intake summary and persists it via `forge card create`.

## Conversational Workflow

### Phase 1: Initial Assessment

Assess what the user has already provided:
- Screenshots, mockups, or design artifacts
- Existing documents or requirements
- Verbal summary or problem statement

**Skip questions where answers are evident.** Don't make users repeat themselves.

### Phase 2: Guided Interview (Adaptive Q&A)

Ask 3-4 related questions per batch across these topics:

**Topic 1: Problem & Driver**
What's broken/missing? Who's affected? What's the business driver?

**Topic 2: Scope Boundaries**
What's in scope? Out of scope? Which systems, markets, user roles?

**Topic 3: Solution Details**
Where does this live in the product? What's the user workflow? What confirms success?

**Topic 4: Defaults & Behaviors**
For toggles: default state, who can change it. For fields: default value, required/optional, constraints. Edge cases?

**Topic 5: Technical Considerations**
Which systems are involved? Backward compatibility requirements? Cross-team dependencies?

**Topic 6: Open Questions**
What's unclear? What should engineering decide vs. product?

**Topic 7: Card Type Manifest**
Initiative, Epic, Story, or combination? What downstream cards should we generate?

### Phase 3: Red Flag Probing

Watch for these phrases and probe deeper:

| Red Flag | Probe |
|----------|-------|
| "Works like it does today" | Which version? Which user type? Get specifics. |
| "Just a simple toggle" | Get defaults, behaviors, who can change it, what breaks if flipped. |
| "Similar to [feature]" | Confirm which aspects. Don't assume. |
| "Handle that later" | Capture as Open Question; note out of scope. |
| No mention of existing data | Ask about migration, backward compatibility. |
| "Everyone needs this" | Narrow scope. Which roles first? Which systems? |

### Phase 4: Confirmation

**Never skip this.** After gathering information, state your understanding:

```
Let me confirm what I'm hearing:

**The Problem:** [1-2 sentence summary]
**The Solution:** [1-2 sentence summary]
**In Scope:** [bullets]
**Out of Scope:** [bullets]
**Technical Notes:** [key dependencies]
**Card Types:** [manifest]

Does this match your understanding?
```

Wait for user confirmation before creating the card.

### Phase 5: Create Intake Card

Once confirmed, use forge-lib to create the intake card:

```bash
forge card create intake "INTAKE-{Product}-{FeatureName}" \
  --directory . \
  --data '{
    "product": "{inferred or asked}",
    "module": "{inferred or asked}",
    "client": "{inferred or asked}",
    "problem_statement": "{2-3 sentence description}",
    "proposed_solution": "{2-3 sentence description}",
    "in_scope": ["{item1}", "{item2}"],
    "out_of_scope": ["{exclusion1}", "{exclusion2}"],
    "affected_systems": ["{system1}", "{system2}"],
    "defaults_and_behaviors": "{key defaults and behavioral decisions}",
    "technical_considerations": "{constraints, dependencies, compatibility}",
    "open_questions": ["{question1}", "{question2}"],
    "card_types_requested": "{manifest}"
  }'
```

The forge-lib will:
- Generate filename: `intake-{product}-{feature-name}.md`
- Add frontmatter with created/updated dates
- Write to `cards/intakes/`
- Update index.json

After successful creation, display:
```
Intake saved: {filename}
Ready to generate {card_types_requested}. Use /initiative, /epic, or /story to create cards from this intake.
```

## Interview Tips

**Maintain Conversational Flow:**
- Ask 3-4 related questions per message, grouped by topic
- Mirror user's language and context
- Acknowledge what they've provided before asking for more

**Handle "I Don't Know":**
- "That's fine—let's capture that as an Open Question."
- Never force a decision; unknowns belong in the intake.

**Reference Provided Context:**
- Screenshots: "I see [element]. Should the new feature follow this pattern?"
- Documents: "I've reviewed [doc]. To clarify—..."
- Existing features: "I understand this is similar to [feature]. Specifically, should we...?"

## Taxonomy Inference

For **product**, **module**, and **client** fields:
- Query forge-lib memory taxonomy: `forge memory get-taxonomy products`
- Match user language to configured values
- If no match, accept freeform value and suggest adding to taxonomy

---

This command focuses on conversational workflow and delegates all file operations to forge-lib.
