---
description: Capture a knowledge checkpoint from the current conversation. Uses forge-lib to create checkpoint cards with date-based filenames.
---

# /checkpoint Command

## Overview

This command captures knowledge checkpoints during conversations—key decisions, context, and understanding that should persist beyond the session. Checkpoints help teams track what was discussed, concluded, and left open for future work.

The command extracts checkpoint content from conversation context, classifies by domain/product/module/client, then delegates to forge-lib for file creation.

## Conversational Workflow

### Phase 1: Extract from Conversation

Summarize key information from the conversation. Focus on:
- What was discussed and concluded
- Key decisions made (even if not formally logged)
- Current state of understanding on the topic
- Important context that should persist beyond this session

**Topic focus:** If user provides topic (e.g., `/checkpoint notification service architecture`), focus the checkpoint on that topic. Otherwise, capture overall conversation state.

### Phase 2: Classify

Infer classifications from conversation context. Only prompt for values that cannot be inferred.

**Domain** (select one):
- Integration
- Operations
- Configuration
- Reporting
- Mobile
- Feature Scope
- Architecture
- Requirements
- Technical Spec
- Stakeholder Context

**Product/Module/Client:** Read from taxonomy files via `forge memory get-taxonomy` if available. If no config exists, accept freeform value and suggest `/memory:setup-org`.

### Phase 3: Structure Content

Create checkpoint content with sections:

```markdown
## Summary

[Concise overview of what this checkpoint captures]

## Key Points

- [Point 1]
- [Point 2]
- [Point 3]

## Decisions & Conclusions

[Any decisions or conclusions reached during the conversation]

## Open Items

- [Any unresolved items or next steps]

## Context

[Additional context that would help someone picking this up later understand the full picture]
```

### Phase 4: Create via forge-lib

Delegate to forge-lib CLI:

```bash
forge card create checkpoint "Checkpoint Title" \
  --directory . \
  --data '{
    "checkpoint_date": "YYYY-MM-DD",
    "product": "[select]",
    "module": "[select]",
    "client": "[select]",
    "domain": "[select]",
    "status": "Current",
    "source_conversation": "[Conversation context identifier]"
  }' \
  --body "[Generated checkpoint content from Phase 3]"
```

forge-lib will:
- Validate frontmatter against checkpoint schema
- Generate filename: `checkpoint-YYYY-MM-DD-{slug}.md`
- Save to `cards/checkpoints/` directory
- Update index.json
- Return filepath

### Parse forge-lib Response

The forge-lib command returns JSON:

```json
{
  "success": true,
  "data": {
    "filename": "checkpoint-YYYY-MM-DD-{slug}.md",
    "filepath": "cards/checkpoints/checkpoint-YYYY-MM-DD-{slug}.md",
    "card_type": "checkpoint",
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
Error creating checkpoint: {error message from JSON response}
```

Common errors:
- **Validation error**: A required field is missing or has an invalid value. Review the field values and retry.
- **Duplicate filename**: A card with the same title already exists. Suggest a different title or use the update command.

Display to user: `Checkpoint saved to {filepath}`

## Key Behaviors

- **Automatic save:** Save automatically after generating content (user explicitly invoked /checkpoint)
- **Topic focus:** Honor user-provided topic focus over general conversation capture
- **Source tracking:** Always include source_conversation in frontmatter
- **Formatting:** Use blank lines between sections; use `##` headings (no h1)
- **Taxonomy integration:** Query taxonomy from forge-memory if available

## Notes

All file operations, validation, and index updates handled by forge-lib. This command focuses on extracting meaningful checkpoint content from conversation context and presenting classifications to the user.
