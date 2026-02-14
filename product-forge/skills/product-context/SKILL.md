---
name: product-context
description: "Provides domain knowledge about the organization's product ecosystem, client relationships, integration landscape, and team structure. Reads taxonomy from memory/context/ files via forge-lib."
---

# Product Context Skill

## Purpose

This skill enables Claude to understand and navigate the organization's product ecosystem without requiring explicit explanation during workflows.

**Key capabilities:**

- **Resolve shorthand references** -- When a user mentions a product or client informally, Claude resolves to the canonical name from the configured taxonomy without asking for clarification
- **Enrich card generation** -- When creating Initiatives, Stories, or Epics, Claude automatically tags products, modules, and clients based on conversation context
- **Provide organizational context** -- Claude understands team structure, stakeholder roles, and client relationships to surface relevant information
- **Maintain updatable knowledge** -- The `memory/context/` directory is the single source of truth for product domain knowledge and can be updated via forge-lib

## How to Use This Skill

On every invocation, Claude should:

1. **Check for domain knowledge** -- Before responding, use `forge memory get-taxonomy` to read taxonomy values if context involves products, modules, integrations, clients, or team coordination
2. **Resolve references** -- Use taxonomy data to map user shorthand to canonical product/module names
3. **Understand dependencies** -- Use integration taxonomy to grasp how products depend on each other and external systems
4. **Identify stakeholders** -- Use client and company taxonomy to determine who cares about the work and who needs to be involved
5. **Tag appropriately** -- When generating cards, apply the correct product, module, and client tags from the taxonomy

## Taxonomy Access via forge-lib

All taxonomy operations are delegated to forge-lib:

**Read taxonomy:**
```bash
forge memory get-taxonomy products
forge memory get-taxonomy clients
forge memory get-taxonomy teams
forge memory get-taxonomy integrations
```

**Update taxonomy:**
```bash
forge memory set-taxonomy products --add "new-product"
forge memory set-taxonomy clients --add "Acme Corp"
```

### Graceful Degradation

If taxonomy files do not exist:
1. Accept freeform values (do not reject user input)
2. Inform user: "Run `forge memory init` to initialize your organization's taxonomy"
3. After the workflow completes, offer to add used values to memory

## Updating Domain Knowledge

Three scenarios trigger updates to taxonomy:

**1. Explicit user request**
"Add a new product to the taxonomy" or "Update the Acme Corp client profile"

**2. During card workflows**
When Claude encounters a product, module, or integration not in the memory files, flag it to the user and offer to add it via `forge memory set-taxonomy`.

**3. Dedicated maintenance**
A user explicitly requests context updates for periodic knowledge review.

**Updating process:**
- Use `forge memory set-taxonomy` commands
- Confirm the update to the user

## Integration with Product Forge

Product Forge commands automatically query taxonomy when needed:
- Card creation validates product/module/client against taxonomy
- Query operations can filter by taxonomy values
- Relationship validation uses taxonomy to ensure proper hierarchies

All file operations are handled by forge-lib, not by this skill.
