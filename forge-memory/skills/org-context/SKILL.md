---
name: org-context
description: Organizational taxonomy (products, modules, clients, teams, integrations) provides validated vocabulary for all commands. Enables Claude to resolve shorthand like "the mobile app" or "Acme" to canonical names.
---

# Org Context

Organizational taxonomy gives every command access to your org's vocabulary, enabling validation and shorthand resolution.

## The Goal

Transform informal references into validated entities:

```
User: "write a story for the billing module in WebApp"
              ↓ Claude resolves
Product: WebApp (Core SaaS platform)
Module: Billing (Payment processing and invoicing)
```

Without org context, Claude guesses. With it, Claude validates against your actual taxonomy and uses canonical names.

## Taxonomy Categories

Six taxonomy types managed via forge-lib:

| Category | Purpose | Example Values |
|----------|---------|----------------|
| **Products** | Product lines | WebApp, MobileApp, API Platform |
| **Modules** | Functional areas | Authentication, Billing, Notifications |
| **Systems** | Infrastructure | API Gateway, Data Warehouse |
| **Clients** | Key customers | Acme Corp, Globex Industries |
| **Teams** | Organizational units | Platform Team, Finance Team |
| **Integrations** | External systems | Salesforce, Stripe, Twilio |

## Taxonomy Query Pattern

Commands query taxonomy via forge-lib:

```bash
forge memory get-taxonomy products --directory .
forge memory get-taxonomy modules --directory .
forge memory get-taxonomy clients --directory .
forge memory get-taxonomy teams --directory .
forge memory get-taxonomy integrations --directory .
forge memory get-taxonomy systems --directory .
```

Returns JSON arrays of valid values for validation and suggestion.

## Resolution Strategy

### 1. Shorthand Resolution

Map informal references to canonical names:
- "the mobile app" → MobileApp
- "Acme" → Acme Corp
- "billing stuff" → Billing (module)

Query taxonomy via forge-lib to validate and resolve.

### 2. Validation

When a command field requires a taxonomy value:
1. Query forge-lib for valid values
2. Match user input (fuzzy, case-insensitive)
3. If ambiguous, ask user to clarify
4. If unknown, offer to add via `/memory:setup-org`

### 3. Suggestion

When gathering input for a field:
```
What product is this for?

Your products:
- WebApp (Core SaaS platform)
- MobileApp (Field operations app)
- API Platform (Developer tools)
```

Query taxonomy for current values and display as suggestions.

## Missing Taxonomy Handling

### If taxonomy doesn't exist:
1. **Accept freeform values** (don't block the user)
2. **Inform**: "Run `/memory:setup-org` to configure your taxonomy"
3. **After workflow**: "I used '[value]'. Want to add it to your taxonomy?"

### If value not in taxonomy:
1. **Flag**: "I don't see '[value]' in your [category] taxonomy"
2. **Offer**: "Should I add it? (Yes / Use it anyway / Enter different value)"
3. **On confirmation**: Call `forge memory set-taxonomy --add`

## Integration with Commands

Commands that reference org entities should:

**1. Query Taxonomy:**
```bash
forge memory get-taxonomy products --directory .
```

**2. Present Options:**
```
Which product?
1. WebApp
2. MobileApp
3. API Platform
[Enter number or name]
```

**3. Validate Input:**
Match against returned taxonomy (case-insensitive, fuzzy).

**4. Handle Unknown:**
Offer to add new value or accept freeform.

## Cross-Plugin Usage

Product Forge, Tasks Forge, and Report Forge all query the same taxonomy:
- **Product Forge**: Product, module, client fields on cards
- **Tasks Forge**: Related product/module for tasks
- **Report Forge**: Scope reports to specific products/modules

Shared taxonomy ensures consistency across plugins.

## Bootstrapping

Use `/memory:setup-org` to populate taxonomy through interactive interview:
1. Products and modules
2. Systems
3. Clients
4. Integrations
5. Teams

Re-runnable—loads existing values and asks what to update.

## Update Flow

**Adding a value:**
```bash
forge memory set-taxonomy products --add "New Product" --directory .
```

**Removing a value:**
```bash
forge memory set-taxonomy products --remove "Old Product" --directory .
```

## Reasoning Principles

### 1. Fuzzy Matching
Accept "mobile", "mobile app", "the mobile app" → all resolve to "MobileApp"

### 2. Growth Over Validation
Don't reject unknown values—offer to add them. Taxonomy grows organically.

### 3. Context Enrichment
Use taxonomy to enrich card creation:
- User says "billing"
- Taxonomy provides full description: "Billing (Payment processing and invoicing)"
- Card frontmatter gets enriched value

### 4. Progressive Setup
Don't require taxonomy up-front. Accept freeform values, suggest taxonomy setup after seeing patterns.

All taxonomy operations delegated to forge-lib—this skill provides the resolution strategy only.
