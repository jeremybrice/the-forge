# Confluence Skills Catalog

## Create Confluence Page

**What it does**: Creates new pages within specified Confluence spaces. Supports standard pages, blog posts, live documents, and whiteboards.

**Parameters**: Target space (required), page title (required), page type (optional, defaults to standard page), parent page (optional), initial content (optional), labels (optional).

**Limitations**:
- No bulk operations; pages created one at a time
- No automatic template application; must reference templates manually
- Cannot apply custom fields directly during creation

**Best practice workflow**: Generate preview > ask user confirmation > publish with confirmed content. Gather requirements (purpose, audience, scope) before creating. Create outline first and request approval before generating full content.

**Recommended for**: Documentation Generation, Release Notes, Meeting Notes patterns.

---

## Update Confluence Page Content

**What it does**: Modifies content of existing pages. Can replace specific sections, append content, or replace entire page.

**Parameters**: Target page (by ID, title, or path), content modification strategy, new content.

**Limitations**:
- No merge capability for conflicting updates
- No compare-and-merge understanding semantic differences
- Page-by-page operations only (no bulk updates)
- Full page replacement not recommended (risks losing structure)

**Best practice**: Retrieve current content first > identify what needs to change > suggest specific edits > generate preview > request confirmation > apply changes. Section replacement preferred over full replacement.

**Recommended for**: Documentation Generation, Knowledge Base Maintenance patterns.

---

## Publish Confluence Page

**What it does**: Makes draft pages visible to all users with space access. Pages can be created in draft state then published separately.

**Parameters**: Target page (required), publication timing (optional), notification (optional).

**Limitations**:
- Publication timing features may not be universally available
- Cannot control notification recipients granularly

**Recommended for**: All patterns that produce public-facing content.

---

## Archive Confluence Page

**What it does**: Soft-deletes pages by archiving them. Removes from active view while preserving for historical reference.

**Parameters**: Target page (required), explicit user confirmation (required).

**Limitations**:
- Cannot perform bulk archival
- Must receive user confirmation per page
- Archived pages remain in history but hidden from normal search/browsing

**Recommended for**: Knowledge Base Maintenance pattern.

---

## Search Confluence Content

**What it does**: Queries Confluence spaces and pages for existing content. Operates against configured knowledge sources.

**Parameters**: Search scope (required), search terms (required), result filtering (optional).

**Limitations**:
- Search algorithm details not documented (full-text, semantic, or hybrid unclear)
- No documented guidance on performance limits for very large knowledge source sets

**Notes**: Automatically enabled when Confluence is configured as knowledge source. Different behaviors available with Deep Research mode.

**Recommended for**: All patterns (finding related content, context, cross-linking).

---

## Get Page Content

**What it does**: Retrieves full content of a specific page for analysis, editing, or reference.

**Parameters**: Target page (by ID, title, or path), content scope (optional: page only or include child pages).

**Limitations**:
- If page is updated after retrieval, agent doesn't auto-refresh
- Limited context when invoked inline

**Recommended for**: Content Review, Content Summarization, Knowledge Base Maintenance patterns.

---

## List Space Content

**What it does**: Lists pages within a specific Confluence space with hierarchical structure showing parent-child relationships.

**Parameters**: Target space (required), depth (optional), filtering by type/labels/date (optional).

**Limitations**:
- Hierarchy navigation not fully specified; unclear if agent auto-understands parent context for child pages

**Recommended for**: Knowledge Base Maintenance (auditing, organization assessment).

---

## Add Comment to Confluence Page

**What it does**: Posts comments on pages for feedback, questions, or follow-up without modifying the page itself.

**Parameters**: Target page (required), comment content (required), thread (optional: reply to existing or start new).

**Limitations**:
- Comment attribution reassignment timing unclear in automation
- Cannot control notification recipients granularly

**Best practice**: Preferred approach when feedback is the goal (vs. modifying the page directly). Can mention other users, participate in threads, and post structured review feedback.

**Recommended for**: Content Review, Knowledge Base Maintenance patterns.

---

## Change Page Owner

**What it does**: Reassigns page ownership/responsibility to a different user or team.

**Parameters**: Target page (required), new owner (required).

**Limitations**:
- Requires admin permissions
- Cannot granularly control access to specific user groups

**Recommended for**: Knowledge Base Maintenance (organizational changes, team transitions).

---

## Add Page Restriction

**What it does**: Modifies page-level access restrictions controlling who can view or edit.

**Parameters**: Target page (required), restriction rules (required: specific users or groups for view/edit).

**Limitations**:
- Sensitive operation requiring careful governance
- Cannot override organizational permission models
- Page-level restrictions operate independently from space-level permissions

**Recommended for**: Knowledge Base Maintenance (protecting sensitive documentation).

---

## System Skills (Auto-Configured)

### Confluence Content Retrieval
Automatically enabled when Confluence is a knowledge source. Optimizes page retrieval for configured spaces.

### Space Search Optimization
When agent's knowledge includes specific spaces, system optimizes Search Confluence to prioritize those spaces before searching broader instance.

---

## Skill Interaction with Automation

When agents run from Confluence automation rules:
- Cannot use any skills listed above
- Can only provide text responses
- Comment attribution defaults to agent (can be reassigned to rule creator)
- Can mention users in automation contexts

**Common automation patterns**:
- Page published > invoke agent > generate related content
- Page created > invoke review agent > post feedback comments
- Scheduled > invoke curator > identify outdated content
