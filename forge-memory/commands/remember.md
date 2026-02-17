---
description: Store new entries in organizational memory (people, terms, projects)
---

# Remember Command

Add new people, terms, projects, preferences, or other context to the organizational memory system.

## Overview

This command helps capture and store organizational knowledge in structured markdown files. It covers knowledge entries like people profiles, glossary terms, project details, and preferences.

**Note:** This command operates on knowledge files (people, projects, glossary) which are currently managed directly through markdown file creation rather than forge-lib operations. The taxonomy operations (products, clients, teams, integrations) use forge-lib via `/memory:setup-org`.

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

### Phase 3: Write to Memory Files

Create structured markdown files in the memory/ directory:

**Person:** `memory/people/{slug}.md`
**Term:** Add to `memory/glossary.md`
**Project:** `memory/projects/{slug}.md`
**Preference:** Document in appropriate context file

**Slug generation:** lowercase, spaces to hyphens, alphanumeric only, max 50 chars.

**Note:** Knowledge file operations (people, projects, glossary) currently use direct file creation. Once forge-lib memory CRUD operations are available, these operations should delegate to `forge memory create-person`, `forge memory create-project`, etc.

### Phase 4: Confirm to User

```
Remembered: [Entry]

Added to: memory/[file path]

Use /memory:recall to look it up later.
```

## Key Behaviors

1. **Knowledge vs Taxonomy**: This command handles knowledge entries (people, terms, projects), not taxonomy (products, clients, teams)
2. **File creation**: Creates markdown files directly (not via forge-lib in v2.0.0)
3. **Progressive capture**: Gather just enough detail to be useful
4. **Update existing**: If entry exists, offer to update rather than duplicate
5. **Slug consistency**: Use same slug generation as other commands

## Example Usage

**User:** `/memory:remember`

**Agent:**
- Asks what to remember
- Gathers details conversationally
- Creates markdown file in memory/ directory
- Confirms storage location

Knowledge file operations are direct markdown creation in v2.0.0.
