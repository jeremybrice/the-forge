---
description: Store new entries in organizational memory (people, terms, projects)
---

# Remember Command

Add new people, terms, projects, preferences, or other context to the organizational memory system.

## Overview

This command helps capture and store organizational knowledge in structured markdown files. It covers knowledge entries like people profiles, glossary terms, project details, and preferences.

## Conversational Workflow

### Phase 1: Ask What to Remember

```
What would you like me to remember?

Examples:
- A person you work with
- An acronym or term
- A project or initiative
- A preference or convention
```

### Phase 2: Determine Type and Gather Details

Based on the user's response, classify and gather details:

**For a Person:**
```
Tell me about [Name]:
- Full name (if different from what you call them)
- Role or title
- Team
- How you work with them
```

**For a Term:**
```
Help me understand [Term]:
- What does it stand for / mean?
- Where is it used?
```

**For a Project:**
```
Tell me about [Project]:
- What is it? (one-liner)
- Current status (planning, in progress, launched)
- Key people involved
```

**For a Preference:**
```
What's the preference or convention?
- What should I do / not do?
```

### Phase 3: Save to Memory via forge-lib

**For a Person:**
```bash
forge memory create-knowledge person "{Name}" \
  --data '{"role": "{role}", "team": "{team}", "context": "{context}"}'
```

**For a Project:**
```bash
forge memory create-knowledge project "{Name}" \
  --data '{"description": "{description}", "status": "{status}", "people": ["{person1}"]}'
```

**For a Term:**
```bash
forge memory create-knowledge glossary "{Term}" \
  --data '{"definition": "{definition}", "context": "{context}"}'
```

### Parse forge-lib Response

```json
{
  "success": true,
  "data": {
    "filename": "jane-smith.md",
    "filepath": "memory/people/jane-smith.md",
    "type": "person",
    "name": "Jane Smith"
  }
}
```

### Error Handling

If forge-lib returns an error:
```
Error saving memory entry: {error message}
```

### Phase 4: Confirm to User

```
Remembered: [Entry]

Added to: memory/[file path]

Use /memory:recall to look it up later.
```

## Key Behaviors

1. **Knowledge vs Taxonomy**: This command handles knowledge entries (people, terms, projects), not taxonomy (products, clients, teams)
2. **File creation**: Delegates to forge-lib `forge memory create-knowledge` commands
3. **Progressive capture**: Gather just enough detail to be useful
4. **Update existing**: If entry exists, offer to update rather than duplicate
5. **Slug consistency**: Use same slug generation as other commands

## Example Usage

**User:** `/memory:remember`

**Agent:**
- Asks what to remember
- Gathers details conversationally
- Saves via `forge memory create-knowledge`
- Confirms storage location
