---
name: memory-management
description: Tiered memory lookup strategy for decoding workplace shorthand, acronyms, and internal language. Transform "ask todd about PSR" into full context using taxonomy and knowledge files.
---

# Memory Management

Memory makes Claude your workplace collaborator—someone who speaks your internal language and decodes shorthand like a colleague would.

## The Goal

Transform shorthand into understanding:

```
User: "ask todd to do the PSR for oracle"
              ↓ Claude decodes
"Ask Todd Martinez (Finance lead) to prepare the Pipeline Status Report
 for the Oracle Systems deal ($2.3M, closing Q2)"
```

Without memory, that request is meaningless. With memory, Claude knows:
- **todd** → Todd Martinez, Finance lead
- **PSR** → Pipeline Status Report (weekly sales doc)
- **oracle** → Oracle Systems deal (not the company)

## Tiered Lookup Strategy

Always decode shorthand before acting on requests using a tiered approach:

### Tier 1: Taxonomy (via forge-lib)

Query organizational taxonomy for:
- **Products/Modules/Systems** — Product and component names
- **Clients** — Customer account names
- **Teams** — Organizational units
- **Integrations** — External systems

Use `forge memory get-taxonomy` to query these.

**Coverage:** Official organizational entities (products, clients, teams, integrations).

### Tier 2: Glossary

Search `memory/glossary.md` for:
- Acronyms and abbreviations
- Internal terms and jargon
- Project codenames
- Nickname → full name mappings

**Coverage:** All workplace shorthand and decoder ring entries.

### Tier 3: Deep Memory

Search rich detail files:
- `memory/people/{name}.md` — Full person profiles
- `memory/projects/{name}.md` — Project details
- `memory/context/` — Company, tools, processes

**Coverage:** Execution-level context and detailed profiles.

### Tier 4: Ask User

If not found in any tier:
```
I don't know what X means yet. Can you tell me?
I'll remember it for next time.
```

## Decoding Flow Example

```
User: "ask todd about the PSR for phoenix"

1. Tier 1 (Taxonomy via forge-lib):
   → Products? Teams? Clients? (no match)

2. Tier 2 (Glossary):
   → "todd" → Todd Martinez, Finance lead ✓
   → "PSR" → Pipeline Status Report ✓
   → "phoenix" → (not in glossary)

3. Tier 3 (Deep Memory):
   → Search memory/projects/ for "phoenix"
   → Found: memory/projects/phoenix.md
   → Phoenix = DB migration project ✓

Now Claude can act with full context.
```

## Memory Categories

### Taxonomy (Managed via forge-lib)
- Products, modules, systems
- Clients
- Teams
- Integrations

**Source:** `forge memory get-taxonomy` queries
**Update:** `/memory:setup-org` command

### Knowledge (Markdown files)
- People profiles
- Project details
- Glossary (acronyms, terms, nicknames)
- Company context (tools, processes)

**Source:** Direct file reads from `memory/` directory
**Update:** `/memory:remember` and `/memory:recall` commands

## Reasoning Principles

### 1. Progressive Disclosure
Start with fast lookups (taxonomy), expand to detailed files only when needed.

### 2. Fuzzy Matching
- Case-insensitive matching
- Match partial words ("phoen" → "Phoenix")
- Match nicknames and full names

### 3. Cross-References
When presenting a result, note related entries:
- Person files mention projects
- Project files mention key people
- Terms appear in multiple contexts

### 4. Context Assembly
Combine information from multiple tiers to build complete understanding:
```
"todd" from glossary + memory/people/todd-martinez.md
= Todd Martinez, Finance lead, prefers Slack, handles PSRs
```

### 5. Learning Loop
When encountering unknown terms:
1. Ask user for definition
2. Determine category (person, term, project, preference)
3. Store appropriately (taxonomy via forge-lib or knowledge file)
4. Confirm storage location

## What to Remember

**Taxonomy (via forge-lib):**
- Official product names
- Client/customer account names
- Team names
- Integration names

**Glossary entries:**
- Acronyms (PSR, OKR, P0)
- Internal jargon ("ship it", "escalate")
- Nicknames ("todd" → "Todd Martinez")
- Project codenames ("Phoenix", "the migration")

**Deep memory:**
- Person profiles with communication preferences
- Project status and key people
- Company tools and processes

**Preferences:**
- Communication style preferences
- Meeting conventions
- Work patterns

## Lookup Performance

**Fast Tier (Taxonomy + Glossary):**
- Covers 90% of daily decoding needs
- Quick table/array lookups
- Under 1 second

**Detail Tier (Deep Memory):**
- Rich context for execution
- Full profiles and histories
- Use when needed for detailed work

This tiered strategy keeps common lookups fast while supporting unlimited depth.

All file operations delegated to forge-lib or direct file reads—this skill provides the reasoning strategy only.
