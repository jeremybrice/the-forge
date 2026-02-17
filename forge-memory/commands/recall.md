---
description: Query organizational memory using tiered lookup
---

# Recall Command

Search organizational memory to recall people, terms, projects, taxonomy, or other context using a multi-tier progressive disclosure strategy.

## Overview

This command searches through organizational memory using a tiered approach:
1. Taxonomy via forge-lib (products, clients, teams, integrations)
2. Knowledge files (people, projects, glossary)
3. Context files (company, preferences)

The tiered search strategy starts with the most frequently accessed data and expands as needed.

## Conversational Workflow

### Phase 1: Ask What to Recall

```
What would you like to recall?

Examples:
- "What products do we have?"
- "Who are our clients?"
- "What teams exist?"
- "What does [term] mean?"
- "Tell me about the [project]"
```

### Phase 2: Tiered Search Strategy

#### Tier 1: Taxonomy (via forge-lib)

For queries about products, clients, teams, or integrations, query forge-lib:

```bash
forge memory get-taxonomy products --directory .
forge memory get-taxonomy clients --directory .
forge memory get-taxonomy teams --directory .
forge memory get-taxonomy integrations --directory .
```

Also query modules and systems (stored in products.md):
```bash
forge memory get-taxonomy modules --directory .
forge memory get-taxonomy systems --directory .
```

#### Parse Response

Each `get-taxonomy` call returns a JSON response:
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
Report which taxonomy type failed to load and fall through to the next search tier.

If the query matches a taxonomy type, return the results.

#### Tier 2: Knowledge Entries (via forge-lib)

### Query Knowledge via forge-lib

```bash
# Query all knowledge entries
forge memory query-knowledge

# Query by type
forge memory query-knowledge --type person
forge memory query-knowledge --type project
forge memory query-knowledge --type glossary
```

For term definitions, query glossary entries. For people or project queries, query by the appropriate type. Parse the JSON response and return matching entries.

#### Tier 3: Context Files

Search context files:
- `memory/context/company.md` — teams, tools, org info
- `memory/context/products.md` — product descriptions
- `memory/context/clients.md` — client details
- `memory/context/integrations.md` — integration info

Return relevant section if found.

### Phase 3: Present Results

**If found in taxonomy:**
```
[Type]: [list from forge-lib]

Managed via: forge-lib (use /memory:setup-org to update)
```

**If found in knowledge files:**
```
[Full content of the memory file]

Source: memory/[path]
```

**If found in context files:**
```
[Relevant section]

Source: memory/context/[file]
```

### Phase 4: Handle Not Found

If not found:
```
I don't have that in memory yet.

Would you like me to remember it? I can add it to the memory system.
```

Offer to transition to `/memory:remember` workflow.

### Phase 5: Suggest Related Entries (Optional)

If partial matches found:
```
I found these related entries:
- [Entry 1]
- [Entry 2]

Did you mean one of these?
```

## Key Behaviors

1. **Tiered search**: Start with taxonomy (fast, via forge-lib), expand to knowledge files as needed
2. **Progressive disclosure**: Only search deeper tiers if not found in earlier tiers
3. **Fuzzy matching**: Case-insensitive, partial word matching
4. **Multi-source results**: Present data from both forge-lib and markdown files when relevant
5. **Seamless transition**: Offer `/memory:remember` if not found
6. **Cross-references**: Note related entries when presenting results

## Search Keyword Extraction

Extract key terms from natural language:
- "Who is Todd?" → search for "Todd" in people
- "What does PSR mean?" → search for "PSR" in glossary
- "What products do we have?" → query taxonomy via forge-lib
- "Tell me about Phoenix" → search for "Phoenix" in projects

## Example Usage

**User:** `/memory:recall` → "What products do we have?"

**Agent:**
- Calls `forge memory get-taxonomy products`
- Returns product list from forge-lib
- Notes source as forge-lib managed

**User:** `/memory:recall` → "Who is Maya?"

**Agent:**
- Calls `forge memory query-knowledge --type person`
- Finds Maya in results
- Returns full profile

All queries (taxonomy and knowledge) use forge-lib.
