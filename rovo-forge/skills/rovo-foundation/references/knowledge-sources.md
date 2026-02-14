# Knowledge Sources Reference

## Connector Inventory

### Atlassian Native Sources
- **Jira projects**: All issues, specific projects, or specific board/sprint
- **Confluence spaces**: All content or specific spaces and page hierarchies
- **Jira Service Management**: Service projects and queues
- **Atlas**: Organizational knowledge and team information
- **Loom**: Recordings and video content
- **Bitbucket**: Repositories and code

### Third-Party Connectors (50+)

**Document and Collaboration**:
- Google Drive
- Microsoft SharePoint
- Dropbox
- Box

**Communication and Messaging**:
- Slack channels and messages
- Microsoft Teams

**Developer and Technical Tools**:
- GitHub repositories
- Azure DevOps
- Linear (issue tracking)

**Design and Visualization**:
- Figma designs
- Miro boards

**Knowledge Management**:
- Notion databases

**Project Management**:
- Asana projects

**IT Service Management**:
- ServiceNow
- Zendesk

**Observability and Operations**:
- CloudWatch
- Datadog
- New Relic
- Jira Service Management alerts

**Document Management**:
- DocuSign documents

### MCP Connectors (20+ partners)
- Figma, HubSpot, Lovable, and 17+ additional partners via Model Context Protocol

---

## Connector Types

| Type | Setup | Behavior | Best For |
|---|---|---|---|
| **Synced** | Admin configures once | Continuously syncs to Rovo index; all users access | Large document repos that don't change frequently |
| **Synced Lite** | User connects on first use | Syncs user's accessible content | Frequently updated content, user-specific access |
| **Direct** | No syncing | Live queries to third-party API; real-time data | Frequently changing data that must be current |
| **Smart Link** | No setup needed | Uses existing Smart Link data and rich previews | Content already referenced through Smart Links |
| **MCP** | Via MCP standard | Interoperable with Rovo Dev CLI and MCP tools | Emerging platforms and custom integrations |

---

## Scoping Strategies

### Single-Resource Scoping
Agent works with one Jira project or one Confluence space.
- **Benefits**: Very focused responses, fast query times, clear organizational context
- **Drawback**: Cannot reference cross-project or cross-space information
- **Example**: "Triage Agent scoped to SUPPORT project only"

### Multiple-Resource Scoping
Agent has access to multiple specific resources.
- **Benefits**: Broader context while remaining focused; agent understands relationships
- **Example**: "Ticket Generation Agent: access PLATFORM, APPS, SUPPORT projects plus Engineering Handbook Confluence space"

### Filtered Subset Scoping
Access specific issues/pages matching criteria.
- **Benefits**: Agent learns from best examples; consistent patterns
- **Example**: "Triage Agent references 'Recently Triaged Bugs' filter (past 90 days) as triage patterns"

### Hierarchical Scoping
Access all content under a hierarchy.
- **Benefits**: Complete coverage of related documentation; agent understands connections
- **Example**: "Documentation Agent: all pages under Engineering wiki including child spaces"

### "All Organizational Knowledge" Default
When no explicit restrictions are set, agent has access to everything the user can see. Appropriate for general-purpose agents. For specialized agents, narrowing to specific sources is recommended.

---

## Deep Research

### What It Is
Advanced capability for multi-step research workflows. Agent breaks complex queries into subtasks, executes them, and synthesizes findings into structured reports.

### How to Enable
Enabled at the **scenario level** (not the default behavior). Create or edit a scenario and enable "Deep Research mode."

### Limits
- Available only for custom scenarios (not default behavior)
- **30 requests per user per day**
- **15-minute timeout** (automation fails if Deep Research takes longer)
- Consumes more credits than standard interactions
- Only pulls from explicitly specified knowledge sources
- Respects user permissions

### When to Use
- Complex research spanning multiple knowledge sources
- Synthesis from 10+ documents or issues
- Reports requiring structured analysis (pros/cons, patterns, recommendations)
- Batch analysis of large numbers of work items

---

## Permission Model

**Core principle**: Agents never grant additional permissions. Access through agents is bounded by the requesting user's existing permissions.

- User who cannot read a Confluence page cannot have an agent read it
- Agent cannot perform actions the user couldn't perform
- Permission checks happen at agent runtime
- You can configure broad knowledge source access without security concerns because the permission filter ensures each user only sees their accessible data

---

## Knowledge Source Best Practices

1. **Match sources to agent purpose**: Ticket generation agent needs the target project plus guidelines space. Triage agent needs project(s) being triaged plus examples plus routing guidelines.

2. **Start broad, narrow over time**: Begin with broad access. If responses are noisy, narrow iteratively.

3. **Include examples where possible**: For agents that make decisions (priority, routing), include a filter or space with past good examples.

4. **Document sources in agent description**: Explain what knowledge sources the agent uses so users understand its context.

5. **Update sources when organization changes**: Outdated sources degrade agent quality. Revisit when teams reorganize or policies update.

6. **Knowledge sources enable skills automatically**: Adding a Jira project enables Jira search/field skills. Adding a Confluence space enables content retrieval skills.

---

## Teamwork Graph

Agents access information through the Teamwork Graph, which contextualizes information within the larger network of organizational relationships. A search for "payment processing issues" finds directly matching Jira issues, related issues through parent-child relationships, related Confluence docs, relevant team members, and historical patterns. This graph-aware search enables contextually rich responses beyond keyword matches.
