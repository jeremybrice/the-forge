---
description: Interactive interview to collect organizational taxonomy using forge-lib
---

# Setup Org Command

Configure your organizational taxonomy (products, modules, systems, clients, teams, integrations) through an interactive interview. All taxonomy data is managed via forge-lib.

## Overview

This command guides the user through a conversational interview to establish organizational taxonomy. The taxonomy enables other plugins to validate values and resolve internal shorthand.

File operations and taxonomy management are delegated to `forge-lib` via `forge memory set-taxonomy` and `forge memory get-taxonomy`.

## Conversational Workflow

### Phase 1: Load Current State

Query existing taxonomy from forge-lib:
```bash
forge memory get-taxonomy products --directory .
forge memory get-taxonomy clients --directory .
forge memory get-taxonomy teams --directory .
forge memory get-taxonomy integrations --directory .
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
Report which taxonomy type failed to load and continue with available data.

Display current state to user:
```
I found existing taxonomy. I'll show you what's there and you can
tell me what to add, update, or remove.

Current products: [list]
Current clients: [list]
Current teams: [list]
Current integrations: [list]
```

If nothing exists, explain the setup:
```
I'm going to walk through your org's taxonomy so I can use the right
names for products, modules, clients, and systems in your workflows.

This takes about 5 minutes. I'll ask a few questions per section,
and you can skip anything that doesn't apply.
```

### Phase 2: Products & Modules

Ask conversationally:
```
What are your main products or product lines?

For each one, give me:
- The name (how your team refers to it)
- A one-liner describing what it is

Example:
- WebApp — Core SaaS platform for enterprise customers
- MobileApp — Field operations app for iOS and Android
```

Confirm before saving:
```
Here's what I have for products:

| Product | Description |
|---------|-------------|
| WebApp | Core SaaS platform for enterprise customers |
| MobileApp | Field operations app for iOS and Android |

Look right?
```

Then ask about modules:
```
What are the main functional areas or modules?

These are building blocks like Authentication, Billing, Notifications.
They might span multiple products or be specific to one.
```

Save each entry:
```bash
forge memory set-taxonomy products --add "WebApp" --directory .
forge memory set-taxonomy modules --add "Authentication" --directory .
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
Report which entry failed to save and continue with remaining entries.

### Phase 3: Systems

Ask:
```
When you document what parts of your infrastructure are affected,
what system names do you use?

Things like: API Gateway, Data Warehouse, Mobile Backend.
List the standard set your team would recognize.
```

Save entries:
```bash
forge memory set-taxonomy systems --add "API Gateway" --directory .
```

#### Parse Response

Each `set-taxonomy` call returns a JSON response. If `success` is `false`, report which entry failed and continue with remaining entries.

### Phase 4: Clients (Optional)

Ask:
```
Do you have key clients or customer accounts that come up regularly?

For each, give me the name and a quick note on what drives their requests.

If this doesn't apply (B2C or internal-only), just say "skip".
```

Save entries:
```bash
forge memory set-taxonomy clients --add "Acme Corp" --directory .
```

#### Parse Response

Each `set-taxonomy` call returns a JSON response. If `success` is `false`, report which entry failed and continue with remaining entries.

### Phase 5: Integrations (Optional)

Ask:
```
Do you integrate with external systems? Things like:
- CRMs (Salesforce, HubSpot)
- Payment processors (Stripe, Adyen)
- Communication (Twilio, SendGrid)

For each, a one-liner on what the integration does is helpful.

If not applicable, say "skip".
```

Save entries:
```bash
forge memory set-taxonomy integrations --add "Salesforce" --directory .
```

#### Parse Response

Each `set-taxonomy` call returns a JSON response. If `success` is `false`, report which entry failed and continue with remaining entries.

### Phase 6: Teams (Optional)

Ask:
```
What teams do you work with regularly?

For each:
- Team name
- What they own or do

If you'd rather skip this, we can always add it later.
```

Save entries:
```bash
forge memory set-taxonomy teams --add "Platform Team" --directory .
```

#### Parse Response

Each `set-taxonomy` call returns a JSON response. If `success` is `false`, report which entry failed and continue with remaining entries.

### Phase 7: Report Results

Query final state and report:
```bash
forge memory get-taxonomy products --directory .
forge memory get-taxonomy clients --directory .
forge memory get-taxonomy teams --directory .
forge memory get-taxonomy integrations --directory .
```

#### Parse Response

Each `get-taxonomy` call returns a JSON response:
```json
{
  "success": true,
  "data": { ... }
}
```

If `success` is `false`, note which taxonomy type failed to load in the report.

```
Org context configured:
- Products: X defined
- Modules: X defined
- Systems: X defined
- Clients: X defined
- Integrations: X defined
- Teams: X defined

Your taxonomy is now available to all commands. Values will be
validated and shorthand resolved automatically.

To update later, run /memory:setup-org again.
```

## Key Behaviors

1. **Delegate to forge-lib**: All taxonomy operations via `forge memory set-taxonomy` and `forge memory get-taxonomy`
2. **Re-runnable**: Load existing values, show current state, ask what to update
3. **Conversational batching**: Ask 2-3 questions per message for natural flow
4. **Confirm before saving**: Show collected data, get approval, then write
5. **Skippable sections**: Clients, integrations, and teams are optional
6. **No validation rejection**: Accept freeform values, taxonomy grows organically

## Example Usage

**User:** `/memory:setup-org`

**Agent:**
- Queries existing taxonomy via `forge memory get-taxonomy`
- Conducts interview, confirms each section
- Saves entries via `forge memory set-taxonomy`
- Reports final taxonomy counts

All file operations delegated to forge-lib.
