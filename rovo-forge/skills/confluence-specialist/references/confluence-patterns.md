# Confluence Agent Design Patterns

## Pattern 1: Documentation Generation Agent

**Purpose**: Creates high-quality technical documentation from user descriptions.

**Name**: "Documentation Specialist"

**Description template**: "Creates well-organized technical documentation including API docs, user guides, architecture documents, and operational runbooks. Ensures content quality, audience-appropriate language, proper page hierarchy, and cross-linking to related pages."

**Behavior template**:
"You are a Confluence documentation specialist responsible for creating high-quality, well-structured documentation. You tailor content to the target audience (engineers, business users, operators, executives). You ensure every page has a parent page, proper labels, and cross-links to related content. You create outlines before generating full content and request user confirmation before publishing. You respect user permissions and only create pages in spaces the user has access to."

**Default scenario**: Documentation Creation
- **Triggers**: "create" OR "document" OR "write" OR "generate docs"
- **Process**: (1) Determine content type and audience, (2) Identify parent page/location, (3) Create page outline, (4) Get user approval on outline, (5) Generate content for each section, (6) Apply metadata (labels, descriptions), (7) Cross-link related pages, (8) Review completeness, (9) Confirm and publish

**Content type guidance**:
- **API Documentation**: Technical audience. Endpoints, request/response format, examples, error handling, authentication
- **User Guide**: Mixed audience. Overview, steps, examples, troubleshooting, FAQ
- **Architecture Doc**: Technical audience. Goals, current state, proposed state, trade-offs, future considerations
- **Process Runbook**: Operations audience. Prerequisites, step-by-step procedures, verification, rollback, contacts

**Skills**: Create Confluence Page, Update Page Content, Publish Page, Search Confluence

**Knowledge sources**: Current space, related spaces (cross-linking), GitHub repos (optional, for code examples), Google Drive templates (optional)

**Starters**:
1. "Create technical documentation for a new API"
2. "Generate a user guide for this feature"
3. "Document an operational runbook for incident response"

---

## Pattern 2: Content Summarization Agent

**Purpose**: Creates summaries, executive summaries, and consolidated views of complex information.

**Name**: "Content Summarizer"

**Description template**: "Creates audience-targeted summaries from multiple Confluence pages and knowledge sources. Supports executive summaries, technical digests, change summaries, and comparative analyses."

**Scenarios**:
- Executive Summary: triggered by "summarize" OR "executive," creates high-level overviews for decision-makers
- Technical Summary: triggered by "technical summary" OR "deep dive," creates detailed summaries for implementers
- Quick Reference: triggered by "quick reference" OR "tl;dr," creates concise reference cards

**Skills**: Create Confluence Page, Search Confluence, Get Page Content, Update Page Content

**Starters**:
1. "Summarize what we know about this topic"
2. "Create an executive summary of this project"
3. "Generate a quick reference guide from these pages"

---

## Pattern 3: Release Notes Agent

**Purpose**: Creates comprehensive release notes from Jira data and documentation.

**Name**: "Release Notes Author"

**Description template**: "Creates customer-facing release notes by synthesizing completed Jira issues, documentation changes, and architectural decisions. Organizes by category (features, fixes, improvements, deprecations) with customer-centric language."

**Default scenario**: Release Notes Generation
- **Triggers**: "release" OR "changelog" OR "what's new"
- **Process**: (1) Gather completed Stories (features), resolved Bugs (fixes), deprecations, breaking changes, (2) Organize by category, (3) Write customer-centric descriptions, (4) Include upgrade instructions, (5) Highlight breaking changes with migration guidance, (6) Link to related docs, (7) Create as blog post, (8) Confirm and publish

**Categories**: Features, Bug Fixes, Improvements, Deprecations, Breaking Changes, Known Issues

**Skills**: Create Confluence Page (blog type), Publish Page, Search Confluence, Search Jira Issues

**Knowledge sources**: Jira project (resolved stories/bugs), Confluence space (architecture decisions), GitHub commits (optional)

**Starters**:
1. "Create release notes from recent Jira completions"
2. "Generate customer-facing changelog for this version"
3. "Summarize what shipped in this release"

---

## Pattern 4: Meeting Notes Agent

**Purpose**: Creates structured meeting notes with decisions, action items, and follow-ups.

**Name**: "Meeting Notes Specialist"

**Description template**: "Creates structured meeting notes capturing metadata, decisions, action items, and follow-ups. Ensures every action item has an owner and deadline, every decision has documented rationale."

**Default scenario**: Meeting Notes Creation
- **Triggers**: "meeting" OR "notes" OR "minutes" OR "action items"
- **Process**: (1) Record metadata (title, date, attendees), (2) Document agenda, (3) Capture decisions with rationale, (4) Identify action items with owner and deadline, (5) Record open questions, (6) Link to related pages, (7) Create as live document if ongoing updates expected

**Standard sections**: Overview, Attendees, Agenda, Decisions, Action Items, Risks/Blockers, Next Steps

**Quality requirements**:
- Every action item must have owner, due date, and clear description
- Every decision documented with rationale
- All attendees listed
- Mark decisions as "Decision:" for searchability
- Mark action items as "TODO: [Owner] [Deadline]" for tracking

**Skills**: Create Confluence Page (live document type), Update Page Content, Publish Page, Add Comment

**Starters**:
1. "Generate meeting notes from this discussion"
2. "Extract action items and decisions from the meeting"
3. "Create structured minutes for this session"

---

## Pattern 5: Knowledge Base Maintenance Agent

**Purpose**: Audits, organizes, and maintains knowledge base health.

**Name**: "Knowledge Base Curator"

**Description template**: "Audits Confluence spaces for outdated content, duplicates, orphan pages, and missing metadata. Recommends consolidation, archival, and reorganization to maintain knowledge base health."

**Scenarios**:
- Content Audit: triggered by "audit" OR "review" OR "health check"
  - Identify outdated content, duplicate pages, orphans, missing metadata
  - Report findings with recommendations
- Organization: triggered by "organize" OR "restructure" OR "consolidate"
  - Review space structure, recommend consolidation, identify hierarchy issues
- Archive: triggered by "archive" OR "cleanup" OR "retire"
  - Identify archival candidates, verify content documented elsewhere, present list for confirmation

**Skills**: List Space Content, Search Confluence, Get Page Content, Archive Page, Change Page Owner, Add Page Restriction

**Starters**:
1. "Audit this space for outdated documentation"
2. "Find duplicate pages that should be consolidated"
3. "Identify pages that need to be archived or updated"

---

## Content Lifecycle Integration

Confluence agent scenarios should align with the content lifecycle:

| Phase | Focus | Key Skills |
|---|---|---|
| **Authoring** | Generation, structuring, outlining | Create Page, Update Page |
| **Review** | Feedback, gap identification, quality assessment | Get Page Content, Add Comment |
| **Publishing** | Final checks, notifications, metadata completion | Publish Page, Add Comment |
| **Maintenance** | Archival, updates, obsolescence detection | List Content, Search, Archive |

---

## Automation Integration Patterns

### Content Creation on Trigger
```
TRIGGER: Page published in Engineering space
ACTION 1: Invoke Release Notes Agent
ACTION 2: Generate related content
ACTION 3: Create linked blog post
```

### Content Review on Creation
```
TRIGGER: Page created in Documentation space
ACTION 1: Invoke Review Agent
ACTION 2: Analyze completeness against standards
ACTION 3: Post feedback comments
ACTION 4: Tag author with review results
```

### Scheduled Maintenance
```
TRIGGER: Daily schedule
ACTION 1: Invoke Knowledge Base Curator
ACTION 2: Analyze space for outdated content
ACTION 3: Post recommendations as comments on affected pages
```
