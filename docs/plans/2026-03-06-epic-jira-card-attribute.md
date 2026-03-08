# Epic jira_card Attribute + Product Forge Status Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Add the `jira_card` attribute to Epic cards so all three Jira-linked card types (Initiative, Epic, Story) use the same field name for Jira linkage. (2) Add a slide-out filter panel to the Product Forge view with per-card-type multi-select status filters (Initiative statuses, Epic statuses, Story statuses).

**Architecture:** The `jira_card` attribute already exists on Initiative and Story schemas/templates. Epic cards are missing it entirely — the Jira commands currently reference a non-schema `jira_key` field for Epics as a "backward compatibility" workaround. This plan adds `jira_card` to the Epic schema, template, and UI, then updates all Jira command docs and the jira-sync skill to use `jira_card` consistently for all three card types. The filter panel follows the existing Roadmap filter pattern (slide-out panel from the right, multi-select dropdowns with chips) but uses per-type status groups instead of a single flat status filter.

**Tech Stack:** JSON Schema, Jinja2 templates, vanilla JavaScript (forge-shell), Python (forge-lib), Markdown (command docs), CSS

---

### Task 1: Add jira_card to Epic JSON Schema

**Files:**
- Modify: `forge-lib/schemas/epic.json:68-72` (insert before `source_intake`)

**Step 1: Add the jira_card property to the epic schema**

Insert the `jira_card` property after `team` and before `parent` (matching the position pattern from initiative.json — after metadata fields, before relationship fields):

In `forge-lib/schemas/epic.json`, add the following property between `team` and `parent`:

```json
"jira_card": {
  "type": ["string", "null"],
  "description": "Link to Jira epic",
  "default": null
},
```

**Step 2: Run schema validation to verify the schema is valid JSON**

Run: `cd forge-lib && python -c "import json; json.load(open('schemas/epic.json')); print('Schema valid')"`
Expected: `Schema valid`

**Step 3: Commit**

```bash
git add forge-lib/schemas/epic.json
git commit -m "feat(forge-lib): add jira_card attribute to epic schema"
```

---

### Task 2: Add jira_card to Epic Jinja2 Template

**Files:**
- Modify: `forge-lib/templates/epic.md.j2:8-9` (insert between `team` and `parent`)

**Step 1: Add jira_card to the epic template frontmatter**

In `forge-lib/templates/epic.md.j2`, add the following line between `team:` (line 8) and `parent:` (line 9):

```
jira_card: {{ jira_card if jira_card else 'null' }}
```

The frontmatter should now read:
```yaml
team: {{ team if team else 'null' }}
jira_card: {{ jira_card if jira_card else 'null' }}
parent: {{ parent if parent else 'null' }}
```

**Step 2: Verify template renders correctly**

Run: `cd forge-lib && python -c "
from jinja2 import Environment, FileSystemLoader
env = Environment(loader=FileSystemLoader('templates'))
t = env.get_template('epic.md.j2')
result = t.render(title='Test Epic', status='Draft', product='WebApp', module=None, client=None, team=None, jira_card=None, parent=None, children=[], description='Test', source_intake=None, source_conversation=None, created='2026-03-06', updated='2026-03-06')
assert 'jira_card: null' in result
print('Template renders correctly')
"`
Expected: `Template renders correctly`

**Step 3: Commit**

```bash
git add forge-lib/templates/epic.md.j2
git commit -m "feat(forge-lib): add jira_card to epic template frontmatter"
```

---

### Task 3: Add jira_card to forge-shell Card Data and Edit Form

**Files:**
- Modify: `forge-shell/app/js/card-data.js:11` (add `jira_card` to epic FIELD_ORDER)
- Modify: `forge-shell/app/js/product-forge.js:528-533` (add jira_card field to epic edit form)

**Step 1: Update epic FIELD_ORDER in card-data.js**

In `forge-shell/app/js/card-data.js`, line 11, change the epic field order from:

```javascript
epic: ['title','type','status','release','product','module','client','team','parent','children','description','source_intake','source_conversation','created','updated'],
```

to:

```javascript
epic: ['title','type','status','release','product','module','client','team','jira_card','parent','children','description','source_intake','source_conversation','created','updated'],
```

**Step 2: Add jira_card field to epic edit form in product-forge.js**

In `forge-shell/app/js/product-forge.js`, inside the `if (type === 'epic')` block (around line 528-533), add the jira_card field. Change:

```javascript
if (type === 'epic') {
  const initiatives = store.getByType('initiative');
  const parentOpts = initiatives.map(c => c.filename);
  html += this._buildField('parent', 'Parent Initiative', 'select', fm.parent, { options: parentOpts, labels: initiatives.map(c => c.frontmatter.title || c.filename) });
  html += this._buildField('source_intake', 'Source Intake', 'text', fm.source_intake);
}
```

to:

```javascript
if (type === 'epic') {
  const initiatives = store.getByType('initiative');
  const parentOpts = initiatives.map(c => c.filename);
  html += this._buildField('parent', 'Parent Initiative', 'select', fm.parent, { options: parentOpts, labels: initiatives.map(c => c.frontmatter.title || c.filename) });
  html += this._buildField('jira_card', 'Jira Card', 'text', fm.jira_card);
  html += this._buildField('source_intake', 'Source Intake', 'text', fm.source_intake);
}
```

Note: The detail view at line 374 already handles `jira_card` generically (`if (fm.jira_card) html += this._metaRow(...)`) so no change needed there.

**Step 3: Commit**

```bash
git add forge-shell/app/js/card-data.js forge-shell/app/js/product-forge.js
git commit -m "feat(forge-shell): add jira_card field to epic card data and edit form"
```

---

### Task 4: Update Jira Commands to Use jira_card for Epics

**Files:**
- Modify: `product-forge/commands/link-to-jira.md`
- Modify: `product-forge/commands/push-to-jira.md`
- Modify: `product-forge/commands/pull-from-jira.md`

These are LLM instruction files (markdown), not code. The changes unify the field name from the current split (`jira_key` for Epics, `jira_card` for Initiatives/Stories) to `jira_card` for all three types.

**Step 1: Update link-to-jira.md**

In `product-forge/commands/link-to-jira.md`:

1. **Line 73-74** — Replace the type-specific check:
   - Old: `- **Epic cards:** \`jira_key\``
   - New: Remove this line entirely. The check should be `jira_card` for all types.
   - Change lines 73-74 from:
     ```
     - **Epic cards:** `jira_key`
     - **Initiative and Story cards:** `jira_card`
     ```
     to:
     ```
     - **All card types:** `jira_card`
     ```

2. **Lines 172-188** — Replace the type-specific update block. Change the two separate blocks (Epic with `jira_key` and Initiative/Story with `jira_card`) to a single block:
   ```
   **For all card types (Initiative, Epic, Story):**
   ```bash
   forge card update {type} {card_identifier} --data '{
     "jira_card": "PROJ-123",
     "jira_url": "https://your-domain.atlassian.net/browse/PROJ-123",
     "jira_last_synced": "2026-02-12T14:30:00Z"
   }' --directory .
   ```
   ```

3. **Line 238** — Remove the backward compatibility note. Change:
   ```
   - Epic cards use `jira_key` for backward compatibility with the original schema. Initiative and Story cards use `jira_card`.
   ```
   to:
   ```
   - All card types (Initiative, Epic, Story) use `jira_card` for Jira linkage.
   ```

**Step 2: Update push-to-jira.md**

In `product-forge/commands/push-to-jira.md`:

1. **Lines 77-78** — Replace type-specific check. Change:
   ```
   - **Epic cards:** Check for `jira_key`
   - **Initiative and Story cards:** Check for `jira_card`
   ```
   to:
   ```
   - **All card types:** Check for `jira_card`
   ```

2. **Lines 147-163** — Replace type-specific update blocks with a single block for all types using `jira_card`.

3. **Line 281** — Remove backward compat note. Change:
   ```
   - Epic cards use `jira_key` for backward compatibility. Initiative and Story cards use `jira_card`.
   ```
   to:
   ```
   - All card types (Initiative, Epic, Story) use `jira_card` for Jira linkage.
   ```

**Step 3: Update pull-from-jira.md**

In `product-forge/commands/pull-from-jira.md`:

1. **Lines 68-69** — Replace type-specific extraction. Change:
   ```
   2. Extract `jira_key` (for Epic) or `jira_card` (for Initiative/Story) from frontmatter
   ```
   to:
   ```
   2. Extract `jira_card` from frontmatter
   ```

2. **Lines 76-77** — Update the Jira key search. Change:
   ```
   1. Query cards via `forge card query --directory . --format json` and search for matching `jira_key` or `jira_card` field
   ```
   to:
   ```
   1. Query cards via `forge card query --directory . --format json` and search for matching `jira_card` field
   ```

3. **Line 276** — Remove backward compat note. Change:
   ```
   - Epic cards use `jira_key` for backward compatibility. Initiative and Story cards use `jira_card`.
   ```
   to:
   ```
   - All card types (Initiative, Epic, Story) use `jira_card` for Jira linkage.
   ```

**Step 4: Commit**

```bash
git add product-forge/commands/link-to-jira.md product-forge/commands/push-to-jira.md product-forge/commands/pull-from-jira.md
git commit -m "docs(product-forge): unify jira_card field name across all card types in Jira commands"
```

---

### Task 5: Update jira-sync Skill to Use jira_card for All Types

**Files:**
- Modify: `product-forge/skills/jira-sync/SKILL.md`

**Step 1: Update field mapping table and references**

1. **Line 20** — Change `jira_key` reference in Push mapping:
   - Old: `Resolve parent's \`jira_key\` before creating child`
   - New: `Resolve parent's \`jira_card\` before creating child`

2. **Line 30** — Change Pull mapping:
   - Old: `| \`key\` | \`jira_key\` | Store for bidirectional reference |`
   - New: `| \`key\` | \`jira_card\` | Store for bidirectional reference |`

3. **Line 91-92** — Update parent validation:
   - Old: `Check if parent has \`jira_key\` or \`jira_card\` field`
   - New: `Check if parent has \`jira_card\` field`

4. **Line 129** — Update required fields validation:
   - Old: `Card must NOT already have \`jira_key\` or \`jira_card\``
   - New: `Card must NOT already have \`jira_card\``

5. **Line 168** — Update forge-lib usage example:
   - Old: `forge card update story story-001-user-auth --data '{"jira_key":"PROJ-123",...}'`
   - New: `forge card update story story-001-user-auth --data '{"jira_card":"PROJ-123",...}'`

**Step 2: Commit**

```bash
git add product-forge/skills/jira-sync/SKILL.md
git commit -m "docs(product-forge): unify jira_card references in jira-sync skill"
```

---

### Task 6: Add Test for Epic with jira_card

**Files:**
- Modify: `forge-lib/tests/test_card_ops.py` (add test at end of file)

**Step 1: Write the test**

Add the following test to the `TestCardOperations` class in `forge-lib/tests/test_card_ops.py`:

```python
def test_create_epic_with_jira_card(self, temp_dir):
    """Test creating an epic with jira_card attribute."""
    data = {
        'title': 'Email Notification Engine',
        'type': 'epic',
        'status': 'Draft',
        'product': 'WebApp',
        'description': 'Build email notification engine',
        'jira_card': 'PROJ-456'
    }

    result = card_ops.create_card('epic', data, temp_dir)

    # Verify jira_card in frontmatter
    card = card_ops.get_card('epic', result['filename'], temp_dir)
    assert card['jira_card'] == 'PROJ-456'

    # Verify jira_card in file content
    filepath = Path(result['filepath'])
    content = filepath.read_text()
    assert 'jira_card: PROJ-456' in content
```

**Step 2: Run the test to verify it passes**

Run: `cd forge-lib && python -m pytest tests/test_card_ops.py::TestCardOperations::test_create_epic_with_jira_card -v`
Expected: PASS (the schema change from Task 1 allows `jira_card`, and the template change from Task 2 renders it)

**Step 3: Run the full test suite to verify nothing is broken**

Run: `cd forge-lib && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add forge-lib/tests/test_card_ops.py
git commit -m "test(forge-lib): add test for epic card with jira_card attribute"
```

---

### Task 7: Add Status Filter Panel to Product Forge View

This task adds a slide-out filter panel to the Product Forge page, following the same UX pattern as the Roadmap filter panel (`forge-shell/app/js/roadmap.js:389-498`, `forge-shell/app/css/roadmap.css:486-565`). The panel provides **per-card-type status filters** — three separate multi-select groups for Initiative statuses, Epic statuses, and Story statuses.

**Reference implementation:** The Roadmap `FilterPanel` module at `roadmap.js:389-498` — reuse the same pattern (open/close toggle, `filters` state object, `render()` with `_renderFilterGroup()`, chip-based multi-select, `clearAll()`, `getActiveCount()`, `filterHierarchy()`).

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (add FilterPanel module, toolbar button, panel HTML, bind events, apply filters)
- Modify: `forge-shell/app/css/product-forge.css` (add filter panel styles with pfl- prefix)

**Step 1: Add the FilterPanel module to product-forge.js**

Add a new `FilterPanel` module after the `detailPanel` object (after line ~470) and before `editModal`. This module manages per-type status filter state.

```javascript
/* ═══════════════════════════════════════════════════════════════
   FilterPanel — Per-type status filtering
   ═══════════════════════════════════════════════════════════════ */
const FilterPanel = {
  open: false,
  filters: { initiative_status: [], epic_status: [], story_status: [] },

  getActiveCount() {
    let count = 0;
    for (const k in this.filters) {
      count += this.filters[k].length;
    }
    return count;
  },

  clearAll() {
    this.filters = { initiative_status: [], epic_status: [], story_status: [] };
  },

  _cardMatchesTypeStatus(card, typeKey, statusArr) {
    if (statusArr.length === 0) return true;
    const fm = card.frontmatter || card;
    return statusArr.indexOf(fm.status) !== -1;
  },

  filterHierarchy(hierarchy) {
    if (this.getActiveCount() === 0) return hierarchy;
    const self = this;

    // Filter initiative tree: init must match initiative_status,
    // child epics must match epic_status, child stories must match story_status
    const filteredTree = hierarchy.tree.filter(function (n) {
      return self._cardMatchesTypeStatus(n.card, 'initiative_status', self.filters.initiative_status);
    }).map(function (n) {
      return {
        card: n.card,
        children: n.children.filter(function (en) {
          return self._cardMatchesTypeStatus(en.card, 'epic_status', self.filters.epic_status);
        }).map(function (en) {
          return {
            card: en.card,
            children: en.children.filter(function (s) {
              return self._cardMatchesTypeStatus(s, 'story_status', self.filters.story_status);
            })
          };
        })
      };
    });

    // Filter orphan epics by epic_status, their child stories by story_status
    const filteredOrphanEpics = hierarchy.orphanEpics.filter(function (en) {
      return self._cardMatchesTypeStatus(en.card, 'epic_status', self.filters.epic_status);
    }).map(function (en) {
      return {
        card: en.card,
        children: en.children.filter(function (s) {
          return self._cardMatchesTypeStatus(s, 'story_status', self.filters.story_status);
        })
      };
    });

    // Filter orphan stories by story_status
    const filteredOrphanStories = hierarchy.orphanStories.filter(function (s) {
      return self._cardMatchesTypeStatus(s, 'story_status', self.filters.story_status);
    });

    return {
      tree: filteredTree,
      orphanEpics: filteredOrphanEpics,
      orphanStories: filteredOrphanStories,
      intakes: hierarchy.intakes,
      checkpoints: hierarchy.checkpoints,
      decisions: hierarchy.decisions,
      releaseNotes: hierarchy.releaseNotes
    };
  },

  render(container) {
    let html = '<div class="pfl-filter-header">';
    html += '<span>Status Filters</span>';
    html += '<button class="btn-icon pfl-filter-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>';
    html += '</div>';
    html += '<div class="pfl-filter-body">';

    html += this._renderFilterGroup('initiative_status', 'Initiative Status', STATUS_OPTIONS.initiative || []);
    html += this._renderFilterGroup('epic_status', 'Epic Status', STATUS_OPTIONS.epic || []);
    html += this._renderFilterGroup('story_status', 'Story Status', STATUS_OPTIONS.story || []);

    html += '</div>';
    html += '<div class="pfl-filter-footer">';
    html += '<button data-pfl-filter-clear>Clear All Filters</button>';
    html += '</div>';

    container.innerHTML = html;
  },

  _renderFilterGroup(key, label, options) {
    const self = this;
    let html = '<div class="pfl-filter-group">';
    html += '<label>' + ESC(label) + '</label>';
    html += '<select data-pfl-filter-select="' + key + '">';
    html += '<option value="">Add ' + ESC(label) + '...</option>';
    options.forEach(function (o) {
      html += '<option value="' + ESC(o) + '">' + ESC(o) + '</option>';
    });
    html += '</select>';

    if (this.filters[key].length > 0) {
      html += '<div class="pfl-filter-chips">';
      this.filters[key].forEach(function (v) {
        html += '<span class="pfl-filter-chip" data-pfl-filter-remove="' + key + '" data-pfl-filter-value="' + ESC(v) + '">' +
          ESC(v) + ' <i class="fa-solid fa-xmark"></i></span>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }
};
```

**Step 2: Add the filter button to the toolbar**

In the toolbar HTML (around line 815-818), add a filter badge button before the refresh indicator. Change:

```javascript
'<div class="spacer"></div>' +
'<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
'<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
```

to:

```javascript
'<div class="spacer"></div>' +
'<div class="pfl-filter-badge">' +
  '<button class="btn-icon" data-pfl-filter-toggle title="Filter"><i class="fa-solid fa-filter"></i></button>' +
'</div>' +
'<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
'<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
```

**Step 3: Add the filter panel container to the detail panel area**

In the detail panel `<main>` element (around line 830-836), add the filter panel div. Change:

```javascript
'<main class="pfl-detail-panel">' +
  '<div class="pfl-empty-state empty-state">' +
    '<div class="icon"><i class="fa-solid fa-file-lines"></i></div>' +
    '<div>Select a card from the tree to view details</div>' +
  '</div>' +
  '<div class="pfl-card-detail hidden"></div>' +
'</main>' +
```

to:

```javascript
'<main class="pfl-detail-panel">' +
  '<div class="pfl-empty-state empty-state">' +
    '<div class="icon"><i class="fa-solid fa-file-lines"></i></div>' +
    '<div>Select a card from the tree to view details</div>' +
  '</div>' +
  '<div class="pfl-card-detail hidden"></div>' +
  '<div class="pfl-filter-panel" data-pfl-filter-panel></div>' +
'</main>' +
```

**Step 4: Bind filter toggle button event**

After the toolbar refresh button binding (around line 856-860), add the filter toggle binding:

```javascript
/* Bind filter toggle */
var filterBtn = $q('[data-pfl-filter-toggle]');
if (filterBtn) {
  filterBtn.addEventListener('click', function () {
    FilterPanel.open = !FilterPanel.open;
    var panel = $q('[data-pfl-filter-panel]');
    if (panel) panel.classList.toggle('pfl-open', FilterPanel.open);
    if (FilterPanel.open) ctrl._renderFilterPanel();
  });
}
```

**Step 5: Add filter panel render and bind methods to the controller**

Add these three methods to the `ctrl` object (after `_updateRefreshIndicator` around line 988):

```javascript
_renderFilterPanel() {
  var panel = $q('[data-pfl-filter-panel]');
  if (!panel) return;
  FilterPanel.render(panel);
  this._bindFilterEvents();
},

_bindFilterEvents() {
  var self = this;

  /* Filter selects */
  $qa('[data-pfl-filter-select]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      var key = sel.dataset.pflFilterSelect;
      if (FilterPanel.filters[key].indexOf(sel.value) === -1) {
        FilterPanel.filters[key].push(sel.value);
      }
      sel.value = '';
      self._renderFilterPanel();
      self._renderTree();
    });
  });

  /* Remove filter chips */
  $qa('[data-pfl-filter-remove]').forEach(function (el) {
    el.addEventListener('click', function () {
      var key = el.dataset.pflFilterRemove;
      var val = el.dataset.pflFilterValue;
      FilterPanel.filters[key] = FilterPanel.filters[key].filter(function (v) { return v !== val; });
      self._renderFilterPanel();
      self._renderTree();
    });
  });

  /* Clear all */
  var clearBtn = $q('[data-pfl-filter-clear]');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      FilterPanel.clearAll();
      self._renderFilterPanel();
      self._renderTree();
    });
  }

  /* Close button */
  var closeBtn = $q('.pfl-filter-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      FilterPanel.open = false;
      var panel = $q('[data-pfl-filter-panel]');
      if (panel) panel.classList.remove('pfl-open');
    });
  }
},

_updateFilterBadge() {
  var count = FilterPanel.getActiveCount();
  var badge = $q('.pfl-filter-badge');
  if (!badge) return;
  var existing = badge.querySelector('.pfl-filter-count');
  if (existing) existing.remove();
  if (count > 0) {
    var span = document.createElement('span');
    span.className = 'pfl-filter-count';
    span.textContent = count;
    badge.appendChild(span);
  }
},
```

**Step 6: Apply filters in _renderTree**

In the `_renderTree` method, apply the FilterPanel filters to the hierarchy. Add this line right before `treeView.render(hierarchy)` (around line 971), after search filtering but before rendering:

```javascript
// Apply status filters
hierarchy = FilterPanel.filterHierarchy(hierarchy);
```

Also call `_updateFilterBadge` at the end of `_renderTree` (after `if (selectedCard) treeView.highlightSelected(selectedCard);`):

```javascript
this._updateFilterBadge();
```

**Step 7: Add filter panel CSS to product-forge.css**

Add the following styles to the end of `forge-shell/app/css/product-forge.css` (before the responsive media query at line 321):

```css
/* ── Filter Panel ── */
.pfl-detail-panel {
  position: relative;
}

.pfl-filter-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}
.pfl-filter-panel.pfl-open {
  transform: translateX(0);
}

.pfl-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 13px;
}

.pfl-filter-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.pfl-filter-group {
  margin-bottom: 16px;
}
.pfl-filter-group label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.pfl-filter-group select {
  width: 100%;
  font-size: 12px;
}

.pfl-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.pfl-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--accent);
  cursor: pointer;
}
.pfl-filter-chip:hover {
  background: var(--accent);
  color: #fff;
}

.pfl-filter-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.plugin-toolbar .pfl-filter-badge {
  position: relative;
}
.plugin-toolbar .pfl-filter-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
```

**Step 8: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "feat(forge-shell): add per-type status filter panel to Product Forge view"
```
