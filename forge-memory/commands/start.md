---
description: Initialize the organizational memory system using forge-lib
---

# Start Command

Initialize the organizational memory system with directory structure and taxonomy files via forge-lib.

## Overview

This command initializes the memory system in the current directory. It creates the `memory/` directory structure with taxonomy files (products, clients, teams, integrations) and helps bootstrap organizational context.

The command delegates directory creation and file initialization to `forge-lib`, focusing on conversational workflow to gather organizational context.

## Conversational Workflow

### Phase 1: Check Initialization Status

Call forge-lib to check if memory is already initialized:
```bash
forge memory init --directory .
```

#### Parse Response

The CLI returns a JSON response:
```json
{
  "success": true,
  "data": { ... }
}
```

If `success` is `false`:
```
Error: {error message from JSON response}
```
Stop and inform the user of the initialization failure before proceeding.

If already initialized, skip to Phase 4 (reporting).

### Phase 2: Gather Organizational Context

Ask the user about their organization to bootstrap taxonomy:

```
I'm setting up your organizational memory. Let's start with some basics:

1. **Products/Projects**: What are the main products, systems, or projects you work on?
2. **Clients**: Who are your primary clients or customers?
3. **Teams**: What teams exist in your organization?
4. **Integrations**: What tools or systems do you integrate with? (Jira, Slack, etc.)
```

Collect responses conversationally.

### Phase 3: Bootstrap Taxonomy

For each taxonomy type the user provided, call forge-lib to add entries:

```bash
# Add products
forge memory set-taxonomy products --add "Product Name" --directory .

# Add clients
forge memory set-taxonomy clients --add "Client Name" --directory .

# Add teams
forge memory set-taxonomy teams --add "Team Name" --directory .

# Add integrations
forge memory set-taxonomy integrations --add "Integration Name" --directory .
```

#### Parse Response

Each `set-taxonomy` call returns a JSON response:
```json
{
  "success": true,
  "data": { ... }
}
```

If `success` is `false`:
```
Error: {error message from JSON response}
```
Report the specific taxonomy entry that failed and continue with remaining entries.

### Phase 4: Report Success

Inform the user:
```
Memory system initialized:
- memory/context/products.md: X products/modules
- memory/context/clients.md: X clients
- memory/context/company.md: X teams
- memory/context/integrations.md: X integrations

Use /memory:setup-org to manage taxonomy entries.
Use /memory:remember to add knowledge entries.
Use /memory:recall to query the memory system.
```

## Key Behaviors

1. **Delegate to forge-lib**: All directory creation and file operations handled by `forge memory init` and `forge memory set-taxonomy`
2. **Conversational bootstrap**: Gather context through natural dialogue
3. **Optional depth**: Allow minimal setup (just create structure) or full bootstrap (gather all taxonomy)
4. **Idempotent**: If already initialized, just report current state
5. **Taxonomy focus**: Initialize the four taxonomy types that other plugins will query

## Example Usage

**User:** `/memory:start`

**Agent:**
- Calls `forge memory init --directory .`
- If not initialized, gathers organizational context
- Adds taxonomy entries via `forge memory set-taxonomy`
- Reports initialization success

All file operations delegated to forge-lib.
