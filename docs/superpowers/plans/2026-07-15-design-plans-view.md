# Design Plans View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Design Plans" forge-shell plugin that browses the superpowers specs/plans/handoffs (`docs/superpowers/`) grouped by initiative, with search, faceted filtering, and a rendered reading view.

**Architecture:** A new plugin (`id: design-plans`, CSS prefix `dp-`) following the existing Product Forge master-detail pattern. Pure parsing/grouping logic lives in `design-plans.helpers.js` (UMD, Node-tested); DOM lives in `design-plans.js`. The docs-root is a dedicated path stored in client `localStorage` (independent of the active project folder) and read via the existing `ForgeFS` adapter — no `server.js`, `fs-adapter.js`, or Rust changes.

**Tech Stack:** Vanilla JS (no build step), `node --test`, shared `ForgeUtils` (YAML/MD/Toast/escapeHTML) and `ForgeFS` (listMarkdownFiles/readFile/pickDirectory), shared `Sidebar.init`, Font Awesome icons.

## Global Constraints

- All commands run from the `forge-shell/` directory unless noted.
- Full test suite must stay green: `npm test` (currently 77/77).
- Single helper test file: `node --test test/design-plans.helpers.test.js`.
- CSS prefix is `dp-`; layout root class MUST be `dp-layout` (the `Sidebar` code derives the prefix via `/^([a-z]{2,4})-layout$/`).
- The `.dp-filter-panel` MUST be a direct child of `.dp-layout` (never nested in the scrollable detail panel); `.dp-layout` has `position: relative`.
- Reuse shared classes from `components.css`: `.plugin-toolbar`, `.toolbar-title`, `.folder-path`, `.spacer`, `.btn-icon`, `.sidebar-search`, `.sidebar-resizer`, `.rendered-body`, `.empty-state`, `.status-pill`, `.hidden`.
- **No mobile/responsive CSS** (the app is desktop-only; do not reintroduce `@media (max-width: ...)`).
- `listMarkdownFiles(root, 'docs/superpowers')` returns `{name, path, modified}` where `path` is relative to the subdir (e.g. `specs/foo.md`). Reads therefore use `'docs/superpowers/' + entry.path`.
- Spec reference: `docs/superpowers/specs/2026-07-15-design-plans-view-design.md`.

---

## File Structure

- **Create** `forge-shell/app/js/design-plans.helpers.js` — UMD pure logic (parseDoc, groupInitiatives, rankDocs, etc.). Node-testable.
- **Create** `forge-shell/test/design-plans.helpers.test.js` — `node --test` unit tests for all helpers.
- **Create** `forge-shell/app/js/design-plans.js` — DOM controller (`window.DesignPlansView`), registered as `design-plans`.
- **Create** `forge-shell/app/css/design-plans.css` — `dp-` layout + components.
- **Modify** `forge-shell/app/index.html` — add view container, `<link>`, and two `<script>` tags (helpers before controller).
- **Modify** `forge-shell/app/js/shell.js` — add the plugin to `PLUGINS`; add a file-change branch.
- **Modify** `forge-shell/app/css/theme.css` — add `--dp-status-*` and `--dp-type-*` tokens (light `:root`; shared across themes, matching how `--status-*` is defined).

---

## Task 1: Helpers — filename + type parsing

**Files:**
- Create: `forge-shell/app/js/design-plans.helpers.js`
- Create: `forge-shell/test/design-plans.helpers.test.js`

**Interfaces:**
- Produces: `classifyType(relPath) → 'spec'|'plan'|'handoff'|'other'`; `parseFilename(filename) → { date, slug }`.

- [ ] **Step 1: Write the failing tests**

Create `forge-shell/test/design-plans.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/design-plans.helpers.js');

/* ── classifyType ── */

test('classifyType: specs/plans/handoffs by leading segment', () => {
  assert.equal(H.classifyType('specs/2026-07-08-x-design.md'), 'spec');
  assert.equal(H.classifyType('plans/2026-07-08-x.md'), 'plan');
  assert.equal(H.classifyType('handoffs/2026-07-04-y-handoff.md'), 'handoff');
});

test('classifyType: case-insensitive, tolerates ./ and leading slash', () => {
  assert.equal(H.classifyType('./SPECS/foo.md'), 'spec');
  assert.equal(H.classifyType('/plans/foo.md'), 'plan');
});

test('classifyType: unknown segment → other', () => {
  assert.equal(H.classifyType('drafts/foo.md'), 'other');
  assert.equal(H.classifyType('foo.md'), 'other');
  assert.equal(H.classifyType(123), 'other');
});

/* ── parseFilename ── */

test('parseFilename: spec strips -design suffix so slug matches plan', () => {
  assert.deepEqual(
    H.parseFilename('2026-07-08-jira-intake-sync-cron-design.md'),
    { date: '2026-07-08', slug: 'jira-intake-sync-cron' }
  );
});

test('parseFilename: plan keeps full slug', () => {
  assert.deepEqual(
    H.parseFilename('2026-07-08-jira-intake-sync-cron.md'),
    { date: '2026-07-08', slug: 'jira-intake-sync-cron' }
  );
});

test('parseFilename: revision is a distinct slug (not merged)', () => {
  assert.deepEqual(
    H.parseFilename('2026-07-09-jira-intake-sync-cron-mcp-revision.md'),
    { date: '2026-07-09', slug: 'jira-intake-sync-cron-mcp-revision' }
  );
});

test('parseFilename: no date → date null, slug is whole stem', () => {
  assert.deepEqual(H.parseFilename('notes.md'), { date: null, slug: 'notes' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/design-plans.helpers.js'`.

- [ ] **Step 3: Create the helpers file with these two functions**

Create `forge-shell/app/js/design-plans.helpers.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Design Plans Helpers — pure logic for parsing/grouping superpowers docs.
   Importable as <script> (window.DesignPlansHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DesignPlansHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATE_RE = /^(\d{4}-\d{2}-\d{2})-/;

  function classifyType(relPath) {
    if (typeof relPath !== 'string') return 'other';
    var p = relPath.replace(/^\.\//, '').replace(/^\/+/, '');
    var seg = p.split('/')[0].toLowerCase();
    if (seg === 'specs') return 'spec';
    if (seg === 'plans') return 'plan';
    if (seg === 'handoffs') return 'handoff';
    return 'other';
  }

  function parseFilename(filename) {
    if (typeof filename !== 'string') return { date: null, slug: '' };
    var stem = filename.replace(/\.md$/i, '');
    var m = stem.match(DATE_RE);
    var date = m ? m[1] : null;
    var slug = m ? stem.slice(m[0].length) : stem;
    slug = slug.replace(/-design$/, '');
    return { date: date, slug: slug };
  }

  return {
    classifyType: classifyType,
    parseFilename: parseFilename
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/design-plans.helpers.js test/design-plans.helpers.test.js
git commit -m "feat(design-plans): filename + type parsing helpers"
```

---

## Task 2: Helpers — dual-format metadata parsing

**Files:**
- Modify: `forge-shell/app/js/design-plans.helpers.js`
- Modify: `forge-shell/test/design-plans.helpers.test.js`

**Interfaces:**
- Consumes: `parseFilename` (Task 1).
- Produces: `parseDocMeta(rawText, filename) → { title, statusRaw, body }`. Self-contained (no `ForgeUtils` — must work under Node).

- [ ] **Step 1: Add failing tests**

Append to `test/design-plans.helpers.test.js`:

```js
/* ── parseDocMeta ── */

test('parseDocMeta: bold-inline Status + H1 title', () => {
  const raw = '# Jira Intake Sync Cron — Design\n\n**Date:** 2026-07-08\n**Status:** Approved (revised)\n\n## Problem\nbody';
  const m = H.parseDocMeta(raw, '2026-07-08-jira-intake-sync-cron-design.md');
  assert.equal(m.title, 'Jira Intake Sync Cron — Design');
  assert.equal(m.statusRaw, 'Approved (revised)');
  assert.ok(m.body.indexOf('## Problem') !== -1);
});

test('parseDocMeta: YAML frontmatter status + title', () => {
  const raw = '---\ntitle: "Docs Xref"\nstatus: Approved\ncreated: 2026-06-09\n---\n\n# Docs Xref\nbody';
  const m = H.parseDocMeta(raw, '2026-06-09-docs-xref-design.md');
  assert.equal(m.title, 'Docs Xref');
  assert.equal(m.statusRaw, 'Approved');
});

test('parseDocMeta: frontmatter title wins over H1', () => {
  const raw = '---\ntitle: "From FM"\n---\n\n# Different H1';
  const m = H.parseDocMeta(raw, 'x.md');
  assert.equal(m.title, 'From FM');
});

test('parseDocMeta: no metadata → slug fallback title, null status', () => {
  const m = H.parseDocMeta('just prose, no headings or metadata', '2026-01-01-thing.md');
  assert.equal(m.title, 'thing');
  assert.equal(m.statusRaw, null);
});

test('parseDocMeta: bold Status missing → statusRaw null (no crash)', () => {
  const raw = '# Title\n\n**Date:** 2026-01-01\nbody';
  const m = H.parseDocMeta(raw, '2026-01-01-x.md');
  assert.equal(m.statusRaw, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js`
Expected: FAIL — `H.parseDocMeta is not a function`.

- [ ] **Step 3: Implement parseDocMeta + private helpers**

In `design-plans.helpers.js`, add these functions BEFORE the `return { ... }`, and export `parseDocMeta`:

```js
  function parseSimpleFrontmatter(fmText) {
    var obj = {};
    (fmText || '').split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (!m) return;
      var v = m[2].trim();
      if (v === '') return;
      if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) {
        v = v.slice(1, -1);
      }
      obj[m[1].toLowerCase()] = v;
    });
    return obj;
  }

  function extractH1(body) {
    var lines = (body || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^#\s+(.+?)\s*$/);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractBold(body, key) {
    var re = new RegExp('^\\*\\*' + key + '\\*\\*:\\s*(.+)$', 'i');
    var lines = (body || '').split(/\r?\n/);
    var max = Math.min(lines.length, 60);
    for (var i = 0; i < max; i++) {
      var m = lines[i].match(re);
      if (m) return m[1].trim();
    }
    return null;
  }

  function parseDocMeta(rawText, filename) {
    var text = rawText || '';
    var body = text;
    var fm = {};
    var fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (fmMatch) {
      fm = parseSimpleFrontmatter(fmMatch[1]);
      body = fmMatch[2] || '';
    }
    var title = fm.title || extractH1(body) || parseFilename(filename).slug;
    var statusRaw = (fm.status != null && fm.status !== '') ? fm.status : extractBold(body, 'Status');
    return { title: title, statusRaw: statusRaw, body: body };
  }
```

Update the exports object to include `parseDocMeta: parseDocMeta`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add app/js/design-plans.helpers.js test/design-plans.helpers.test.js
git commit -m "feat(design-plans): dual-format metadata parsing"
```

---

## Task 3: Helpers — status / topic / progress derivation

**Files:**
- Modify: `forge-shell/app/js/design-plans.helpers.js`
- Modify: `forge-shell/test/design-plans.helpers.test.js`

**Interfaces:**
- Produces: `normalizeStatus(statusRaw) → bucket`; `inferTopic(slug, clusters) → string|null`; `planProgress(body) → { done, total, percent }`; `DEFAULT_CLUSTERS` (array).

- [ ] **Step 1: Add failing tests**

Append:

```js
/* ── normalizeStatus ── */

test('normalizeStatus: each bucket + Unknown', () => {
  assert.equal(H.normalizeStatus('Draft'), 'Draft');
  assert.equal(H.normalizeStatus('Draft for review'), 'In Review');   // 'for review' wins
  assert.equal(H.normalizeStatus('Proposed (awaiting approval)'), 'In Review');
  assert.equal(H.normalizeStatus('Approved (revised 2026-07-09)'), 'Approved');
  assert.equal(H.normalizeStatus('APPROVED'), 'Approved');
  assert.equal(H.normalizeStatus('Implemented and shipped'), 'Done');
  assert.equal(H.normalizeStatus('ROLLED BACK'), 'Rolled Back');
  assert.equal(H.normalizeStatus(''), 'Unknown');
  assert.equal(H.normalizeStatus(null), 'Unknown');
  assert.equal(H.normalizeStatus('something novel'), 'Unknown');
});

/* ── inferTopic ── */

test('inferTopic: known cluster match + null fallback', () => {
  assert.equal(H.inferTopic('jira-intake-sync-cron', ['jira-intake', 'cron']), 'jira-intake');
  assert.equal(H.inferTopic('orson-board-redesign', ['orson']), 'orson');
  assert.equal(H.inferTopic('mystery-slug', ['orson']), null);
  assert.equal(H.inferTopic('x', []), null);
});

test('inferTopic: defaults to DEFAULT_CLUSTERS when none passed', () => {
  assert.equal(H.inferTopic('orson-thing'), 'orson');
  assert.equal(H.inferTopic('totally-unknown'), null);
});

/* ── planProgress ── */

test('planProgress: counts done/todo and percent', () => {
  const body = '## Task 1\n- [x] one\n- [ ] two\n- [x] three\n';
  assert.deepEqual(H.planProgress(body), { done: 2, total: 3, percent: 67 });
});

test('planProgress: zero checkboxes → percent null', () => {
  assert.deepEqual(H.planProgress('# just a spec\nno boxes'), { done: 0, total: 0, percent: null });
});

test('planProgress: counts all task-list checkboxes regardless of section', () => {
  const body = '## Global\n- [x] a\n\n## Task 1\n- [ ] b\n- [X] c\n';
  assert.deepEqual(H.planProgress(body), { done: 2, total: 3, percent: 67 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js`
Expected: FAIL — `H.normalizeStatus is not a function`.

- [ ] **Step 3: Implement the three functions**

Add before the `return`:

```js
  var DEFAULT_CLUSTERS = [
    'orson', 'cron', 'sf-ums', 'jira-intake', 'memory', 'docs', 'audio',
    'repo', 'pfl', 'sidebar', 'roadmap', 'report', 'agent'
  ];

  var STATUS_RULES = [
    { bucket: 'Rolled Back', test: /roll\s*back/i },
    { bucket: 'Done', test: /\b(done|implemented|shipped|complete|completed)\b/i },
    { bucket: 'Approved', test: /approved/i },
    { bucket: 'In Review', test: /(proposed|awaiting|for review|brainstorm)/i },
    { bucket: 'Draft', test: /draft/i }
  ];

  function normalizeStatus(statusRaw) {
    if (statusRaw == null || statusRaw === '') return 'Unknown';
    for (var i = 0; i < STATUS_RULES.length; i++) {
      if (STATUS_RULES[i].test.test(String(statusRaw))) return STATUS_RULES[i].bucket;
    }
    return 'Unknown';
  }

  function inferTopic(slug, clusters) {
    var list = Array.isArray(clusters) ? clusters : DEFAULT_CLUSTERS;
    var tokens = String(slug || '').toLowerCase().split(/[-_]/);
    for (var i = 0; i < list.length; i++) {
      if (tokens.indexOf(list[i]) !== -1) return list[i];
    }
    return null;
  }

  function planProgress(body) {
    var text = String(body || '');
    var done = (text.match(/^\s*-\s*\[x\]/gmi) || []).length;
    var todo = (text.match(/^\s*-\s*\[ \]/gmi) || []).length;
    var total = done + todo;
    if (total === 0) return { done: 0, total: 0, percent: null };
    return { done: done, total: total, percent: Math.round((done / total) * 100) };
  }
```

Export `normalizeStatus`, `inferTopic`, `planProgress`, and `DEFAULT_CLUSTERS`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add app/js/design-plans.helpers.js test/design-plans.helpers.test.js
git commit -m "feat(design-plans): status normalization, topic inference, plan progress"
```

---

## Task 4: Helpers — parseDoc composition + initiative grouping

**Files:**
- Modify: `forge-shell/app/js/design-plans.helpers.js`
- Modify: `forge-shell/test/design-plans.helpers.test.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `parseDoc(relPath, rawText, clusters) → Doc`; `initiativeKey(doc) → string`; `groupInitiatives(docs) → Initiative[]` (newest-date-first, each with rolled-up `statusBucket` and `progress`).

- [ ] **Step 1: Add failing tests**

Append:

```js
/* ── parseDoc ── */

test('parseDoc: spec end-to-end', () => {
  const raw = '# Cron Design\n**Status:** Approved\n\nbody';
  const d = H.parseDoc('specs/2026-07-04-cron-design.md', raw, ['cron']);
  assert.equal(d.type, 'spec');
  assert.equal(d.date, '2026-07-04');
  assert.equal(d.slug, 'cron');
  assert.equal(d.title, 'Cron Design');
  assert.equal(d.statusBucket, 'Approved');
  assert.equal(d.topic, 'cron');
  assert.equal(d.progress, null);   // specs have no progress
});

test('parseDoc: plan computes progress', () => {
  const raw = '# Cron Plan\n**Status:** Done\n- [x] a\n- [ ] b\n';
  const d = H.parseDoc('plans/2026-07-04-cron.md', raw, ['cron']);
  assert.equal(d.type, 'plan');
  assert.equal(d.statusBucket, 'Done');
  assert.deepEqual(d.progress, { done: 1, total: 2, percent: 50 });
});

/* ── groupInitiatives ── */

test('groupInitiatives: pairs spec+plan by date+slug', () => {
  const spec = H.parseDoc('specs/2026-07-08-x-design.md', '# X\n**Status:** Approved\nb', ['x']);
  const plan = H.parseDoc('plans/2026-07-08-x.md', '# X Plan\n**Status:** Approved\n- [ ] t\n', ['x']);
  const list = H.groupInitiatives([spec, plan]);
  assert.equal(list.length, 1);
  assert.strictEqual(list[0].spec, spec);
  assert.strictEqual(list[0].plan, plan);
  assert.equal(list[0].statusBucket, 'Approved');
  assert.equal(list[0].progress, 0);
});

test('groupInitiatives: spec-without-plan and plan-without-spec', () => {
  const specOnly = H.parseDoc('specs/2026-07-01-a-design.md', '# A\n**Status:** Draft\n', ['a']);
  const planOnly = H.parseDoc('plans/2026-07-02-b.md', '# B Plan\n**Status:** Approved\n- [x] t\n', ['b']);
  const list = H.groupInitiatives([specOnly, planOnly]);
  assert.equal(list.length, 2);
  // newest first: 2026-07-02 (b) before 2026-07-01 (a)
  assert.equal(list[0].slug, 'b');
  assert.equal(list[0].spec, null);
  assert.equal(list[0].statusBucket, 'Approved');   // rolled up from plan
  assert.equal(list[0].progress, 100);
  assert.equal(list[1].slug, 'a');
  assert.equal(list[1].plan, null);
  assert.equal(list[1].statusBucket, 'Draft');
  assert.equal(list[1].progress, null);
});

test('groupInitiatives: revisions are separate initiatives', () => {
  const orig = H.parseDoc('plans/2026-07-08-c.md', '# C\n**Status:** Approved\n', ['c']);
  const rev = H.parseDoc('plans/2026-07-09-c-mcp-revision.md', '# C rev\n**Status:** Done\n', ['c']);
  const list = H.groupInitiatives([orig, rev]);
  assert.equal(list.length, 2);
});

test('groupInitiatives: handoff attached', () => {
  const spec = H.parseDoc('specs/2026-07-04-d-design.md', '# D\n**Status:** Approved\n', ['d']);
  const ho = H.parseDoc('handoffs/2026-07-04-d-handoff.md', '# D handoff\n', ['d']);
  const list = H.groupInitiatives([spec, ho]);
  assert.equal(list.length, 1);
  assert.equal(list[0].handoffs.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js`
Expected: FAIL — `H.parseDoc is not a function`.

- [ ] **Step 3: Implement parseDoc, initiativeKey, groupInitiatives, rollUpStatus**

Add before the `return`:

```js
  function basename(relPath) {
    var parts = String(relPath || '').split('/');
    return parts[parts.length - 1];
  }

  function parseDoc(relPath, rawText, clusters) {
    var filename = basename(relPath);
    var meta = parseDocMeta(rawText, filename);
    var fn = parseFilename(filename);
    var type = classifyType(relPath);
    return {
      filename: filename,
      relPath: relPath,
      type: type,
      date: fn.date,
      slug: fn.slug,
      title: meta.title,
      statusRaw: meta.statusRaw,
      statusBucket: normalizeStatus(meta.statusRaw),
      topic: inferTopic(fn.slug, clusters),
      body: meta.body,
      progress: type === 'plan' ? planProgress(meta.body) : null
    };
  }

  function initiativeKey(doc) {
    return (doc.date || '0000-00-00') + '|' + (doc.slug || '');
  }

  function rollUpStatus(init) {
    if (init.spec) return init.spec.statusBucket;
    if (init.plan) return init.plan.statusBucket;
    if (init.handoffs.length) return init.handoffs[0].statusBucket;
    return 'Unknown';
  }

  function groupInitiatives(docs) {
    var map = {};
    var order = [];
    (docs || []).forEach(function (doc) {
      var key = initiativeKey(doc);
      if (!map[key]) {
        map[key] = {
          key: key, date: doc.date, slug: doc.slug, title: doc.title,
          spec: null, plan: null, handoffs: []
        };
        order.push(key);
      }
      var init = map[key];
      if (doc.type === 'spec') init.spec = doc;
      else if (doc.type === 'plan') init.plan = doc;
      else if (doc.type === 'handoff') init.handoffs.push(doc);
      if (!init.title && doc.title) init.title = doc.title;
    });
    var list = order.map(function (k) {
      var init = map[k];
      init.statusBucket = rollUpStatus(init);
      init.progress = (init.plan && init.plan.progress) ? init.plan.progress.percent : null;
      return init;
    });
    list.sort(function (a, b) {
      var da = a.date || '', db = b.date || '';
      if (db < da) return -1;   // newest first
      if (db > da) return 1;
      return 0;
    });
    return list;
  }
```

Export `parseDoc`, `initiativeKey`, `groupInitiatives`, `rollUpStatus`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add app/js/design-plans.helpers.js test/design-plans.helpers.test.js
git commit -m "feat(design-plans): parseDoc + initiative grouping"
```

---

## Task 5: Helpers — search ranking

**Files:**
- Modify: `forge-shell/app/js/design-plans.helpers.js`
- Modify: `forge-shell/test/design-plans.helpers.test.js`

**Interfaces:**
- Produces: `rankDocs(docs, query) → Doc[]` (title-startswith < title-contains < slug-contains < body-contains; filename ASC tie-break; empty/whitespace query → `[]`).

- [ ] **Step 1: Add failing tests**

Append:

```js
/* ── rankDocs ── */

test('rankDocs: empty query returns []', () => {
  const d = H.parseDoc('specs/2026-07-08-cron-design.md', '# Cron\n', ['cron']);
  assert.deepEqual(H.rankDocs([d], ''));
  assert.deepEqual(H.rankDocs([d], '   '));
});

test('rankDocs: title-startswith ranks first, then body', () => {
  const a = H.parseDoc('specs/2026-07-08-cron-design.md', '# Cron fast\nbody cron', ['cron']);
  const b = H.parseDoc('specs/2026-07-09-cron-2-design.md', '# Other\nmentions cron', ['cron']);
  const ranked = H.rankDocs([b, a], 'cron');
  assert.equal(ranked[0].filename, '2026-07-08-cron-design.md');
  assert.equal(ranked.length, 2);
});

test('rankDocs: case-insensitive; filename tie-break ASC within rank', () => {
  const a = H.parseDoc('specs/2026-07-09-zed-design.md', '# Alpha tool\n', []);
  const b = H.parseDoc('specs/2026-07-08-aaa-design.md', '# Alpha tool\n', []);
  const ranked = H.rankDocs([a, b], 'alpha');
  assert.equal(ranked[0].filename, '2026-07-08-aaa-design.md');
  assert.equal(ranked[1].filename, '2026-07-09-zed-design.md');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js`
Expected: FAIL — `H.rankDocs is not a function`.

- [ ] **Step 3: Implement rankDocs**

Add before the `return`:

```js
  function rankDocs(docs, query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var ranked = [];
    (docs || []).forEach(function (doc) {
      var title = String(doc.title || '').toLowerCase();
      var slug = String(doc.slug || '').toLowerCase();
      var body = String(doc.body || '').toLowerCase();
      var rank;
      if (title.indexOf(q) === 0) rank = 0;
      else if (title.indexOf(q) !== -1) rank = 1;
      else if (slug.indexOf(q) !== -1) rank = 2;
      else if (body.indexOf(q) !== -1) rank = 3;
      else return;
      ranked.push({ doc: doc, rank: rank, filename: doc.filename || '' });
    });
    ranked.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.filename < b.filename) return -1;
      if (a.filename > b.filename) return 1;
      return 0;
    });
    return ranked.map(function (e) { return e.doc; });
  }
```

Export `rankDocs`.

- [ ] **Step 4: Run full helper test suite**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (all helper tests).

Then run the whole suite to confirm no regressions: `npm test`
Expected: PASS (previous 77 + new design-plans tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/design-plans.helpers.js test/design-plans.helpers.test.js
git commit -m "feat(design-plans): search ranking helper"
```

---

## Task 6: Plugin scaffolding + registration

**Goal:** The "Design Plans" tab appears in the nav and renders an empty toolbar+layout shell. No data yet.

**Files:**
- Create: `forge-shell/app/css/design-plans.css`
- Create: `forge-shell/app/js/design-plans.js`
- Modify: `forge-shell/app/index.html`
- Modify: `forge-shell/app/js/shell.js`

**Interfaces:**
- Produces: `window.DesignPlansView` with `init/destroy/refresh`, registered as `design-plans`.

- [ ] **Step 1: Register the plugin + add the view container + assets**

In `forge-shell/app/js/shell.js`, add this entry to the `PLUGINS` array (after the `audio-forge` entry, before the closing `];`):

```js
  { id: 'design-plans', label: 'Design Plans', icon: 'fa-solid fa-diagram-project', requiredDir: null },
```

In `forge-shell/app/index.html`:
- After line 21 (`<link rel="stylesheet" href="css/audio-forge.css">`) add:
```html
  <link rel="stylesheet" href="css/design-plans.css">
```
- After the Audio Forge view block (after line 97, the `</div>` closing `view-audio-forge`), add inside `#shell-content`:
```html
      <!-- Design Plans View -->
      <div id="view-design-plans" class="shell-view">
        <!-- Rendered by DesignPlansView controller -->
      </div>
```
- After line 136 (`<script src="js/audio-forge.js"></script>`), add (helpers before controller):
```html
  <script src="js/design-plans.helpers.js"></script>
  <script src="js/design-plans.js"></script>
```

- [ ] **Step 2: Create the stylesheet**

Create `forge-shell/app/css/design-plans.css`:

```css
/* ═══════════════════════════════════════════════════════════
   Design Plans — View Styles (dp- prefix)
   ═══════════════════════════════════════════════════════════ */

.dp-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  height: 100%;
  overflow: hidden;
  position: relative;
  transition: grid-template-columns 0.18s ease;
}

.dp-layout > .plugin-toolbar { grid-column: 1 / -1; }

.dp-layout.has-filter-chips { grid-template-rows: var(--toolbar-height) auto 1fr; }
.dp-layout.has-filter-chips .dp-active-filters { grid-row: 2; grid-column: 1 / -1; }
.dp-layout.has-filter-chips .dp-sidebar,
.dp-layout.has-filter-chips .sidebar-resizer,
.dp-layout.has-filter-chips .dp-detail-panel { grid-row: 3; }

.dp-sidebar {
  grid-row: 2; grid-column: 1;
  overflow-y: auto; overflow-x: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex; flex-direction: column;
}

.dp-detail-panel {
  grid-row: 2; grid-column: 2;
  display: flex; flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  min-width: 0;
}

.dp-empty-state {
  grid-row: 2; grid-column: 1 / -1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 40px; text-align: center; color: var(--text-secondary);
}
```

- [ ] **Step 3: Create the controller skeleton**

Create `forge-shell/app/js/design-plans.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Design Plans View — browse superpowers specs/plans by initiative.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ESC = ForgeUtils.escapeHTML;
  var VIEW_ID = 'view-design-plans';
  var H = window.DesignPlansHelpers;
  var DOCS_KEY = 'forge-shell-docs-root';
  var DOCS_SUBDIR = 'docs/superpowers';

  function $view() { return document.getElementById(VIEW_ID); }
  function $q(sel) { var v = $view(); return v ? v.querySelector(sel) : null; }
  function $qa(sel) { var v = $view(); return v ? v.querySelectorAll(sel) : []; }

  var state = {
    docsRoot: null, docs: [], initiatives: [],
    selectedKey: null, selectedType: null,
    query: '', skipped: 0,
    filters: { status: [], type: [], topic: [] },
    collapsed: {}   // initiativeKey -> true
  };

  function readDocsRoot() {
    try { return localStorage.getItem(DOCS_KEY) || null; } catch (e) { return null; }
  }
  function writeDocsRoot(p) {
    try { localStorage.setItem(DOCS_KEY, p); } catch (e) { /* ignore */ }
  }

  var ctrl = {
    async init(rootHandle, options) {
      this.destroy();
      var view = $view();
      if (!view) return;
      state.docsRoot = readDocsRoot();
      this._renderLayout(view);
      if (window.Sidebar) {
        window.Sidebar.init({
          pluginId: 'design-plans',
          rootSelector: '#' + VIEW_ID,
          sidebarSelector: '.dp-sidebar',
          toggleSelector: '[data-dp-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
      if (state.docsRoot) {
        await this._loadDocs();
      } else {
        this._renderEmptyState();
      }
    },

    destroy() {
      state.selectedKey = null;
      state.selectedType = null;
    },

    async refresh() {
      if (state.docsRoot) await this._loadDocs();
    },

    _renderLayout(view) {
      view.innerHTML =
        '<div class="dp-layout">' +
          '<div class="plugin-toolbar">' +
            '<button class="btn-icon" data-dp-action="toggle-sidebar" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>' +
            '<span class="toolbar-title"><i class="fa-solid fa-diagram-project"></i> Design Plans</span>' +
            '<div class="folder-path"><span><i class="fa-solid fa-folder-open"></i></span><span class="dp-docs-path">—</span></div>' +
            '<div class="spacer"></div>' +
            '<button class="btn-icon" data-dp-action="toggle-filter" title="Filter"><i class="fa-solid fa-filter"></i></button>' +
            '<button class="btn-icon" data-dp-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +
          '<div class="dp-active-filters hidden" data-dp-active-filters></div>' +
          '<aside class="dp-sidebar">' +
            '<div class="sidebar-search"><input type="text" data-dp-search placeholder="Search specs & plans…" /></div>' +
            '<div class="dp-tree-view" data-dp-tree></div>' +
            '<div class="dp-search-results hidden" data-dp-search-results></div>' +
          '</aside>' +
          '<div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>' +
          '<main class="dp-detail-panel" data-dp-detail></main>' +
          '<div class="dp-filter-panel" data-dp-filter-panel></div>' +
        '</div>';
      this._updateDocsPath();
      this._bindChrome();
    },

    _updateDocsPath() {
      var el = $q('.dp-docs-path');
      if (el) el.textContent = state.docsRoot ? (state.docsRoot + '/' + DOCS_SUBDIR) : 'no docs root set';
    },

    _bindChrome() {
      var refreshBtn = $q('[data-dp-action="refresh"]');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { ctrl.refresh(); });
      var filterBtn = $q('[data-dp-action="toggle-filter"]');
      if (filterBtn) filterBtn.addEventListener('click', function () {
        var panel = $q('[data-dp-filter-panel]');
        if (panel) panel.classList.toggle('open');
      });
      var search = $q('[data-dp-search]');
      if (search) search.addEventListener('input', function () {
        state.query = search.value;
        ctrl._renderTree();
      });
    },

    _renderEmptyState() {
      var tree = $q('[data-dp-tree]');
      var detail = $q('[data-dp-detail]');
      if (tree) tree.innerHTML = '';
      var msg = '<div class="dp-empty-state">' +
        '<div class="state-icon"><i class="fa-solid fa-diagram-project" style="font-size:40px;color:var(--text-muted);"></i></div>' +
        '<h2>Design Plans</h2>' +
        '<p>Point this tab at a repo containing <code>docs/superpowers/</code> (specs, plans, handoffs).</p>' +
        '<button class="primary" data-dp-action="pick-root">Choose docs root…</button>' +
        '<p class="note" style="color:var(--text-muted);">The path is stored separately from your Forge project folder.</p>' +
      '</div>';
      if (detail) detail.innerHTML = msg;
      var pick = $q('[data-dp-action="pick-root"]');
      if (pick) pick.addEventListener('click', function () { ctrl._pickRoot(); });
    },

    async _pickRoot() {
      try {
        var picked = await ForgeFS.pickDirectory();
        if (!picked) return;
        if (ForgeFS.usesPathStrings()) {
          writeDocsRoot(picked);
          state.docsRoot = picked;
        } else {
          // Browser mode: store the handle in IndexedDB like the project dir.
          await ForgeUtils.DB.save('dp-docs-root', picked);
          state.docsRoot = picked;
        }
        this._updateDocsPath();
        await this._loadDocs();
      } catch (e) {
        if (e && e.name !== 'AbortError') {
          ForgeUtils.Toast.show('Could not set docs root: ' + (e.message || e), 'error', 5000);
        }
      }
    }
  };

  // _loadDocs / _renderTree / _renderDetail are added in later tasks.
  ctrl._loadDocs = async function () { state.docs = []; state.initiatives = []; };
  ctrl._renderTree = function () {};

  window.DesignPlansView = ctrl;
  Shell.registerController('design-plans', window.DesignPlansView);
})();
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, select a project folder (any), and click the new "Design Plans" icon in the nav.
Expected: the tab opens showing the toolbar + empty detail panel with "Choose docs root…" (no console errors). The helper test suite is unaffected.

- [ ] **Step 5: Commit**

```bash
git add app/css/design-plans.css app/js/design-plans.js app/index.html app/js/shell.js
git commit -m "feat(design-plans): scaffold plugin tab + empty state"
```

---

## Task 7: Data pipeline + docs-root loading

**Goal:** Choosing a docs root loads, parses, and groups the docs; the tree shows initiative group headers (member rows come next task).

**Files:**
- Modify: `forge-shell/app/js/design-plans.js`

**Interfaces:**
- Consumes: `ForgeFS.listMarkdownFiles`, `ForgeFS.readFile`, `H.parseDoc`, `H.groupInitiatives`, `H.DEFAULT_CLUSTERS`.
- Replaces the stub `ctrl._loadDocs` with the real loader.

- [ ] **Step 1: Replace the stub `_loadDocs`**

In `forge-shell/app/js/design-plans.js`, delete the two stub lines:
```js
  ctrl._loadDocs = async function () { state.docs = []; state.initiatives = []; };
  ctrl._renderTree = function () {};
```
and add this real implementation inside the `ctrl` object (before the closing `}` of `ctrl`), plus a root-restore branch in `init`:

Add to `init` (after `state.docsRoot = readDocsRoot();`), a browser-mode restore so a picked IndexedDB handle survives reloads:
```js
      if (!state.docsRoot && !ForgeFS.usesPathStrings()) {
        try { state.docsRoot = await ForgeUtils.DB.get('dp-docs-root'); } catch (e) { /* ignore */ }
      }
```

Add the loader method to `ctrl`:
```js
    async _loadDocs() {
      var entries = [];
      try {
        entries = await ForgeFS.listMarkdownFiles(state.docsRoot, DOCS_SUBDIR);
      } catch (e) { entries = []; }

      var docs = [];
      var skipped = 0;
      for (var i = 0; i < entries.length; i++) {
        var ent = entries[i];
        if (!/\.md$/i.test(ent.name)) continue;
        var rel = DOCS_SUBDIR + '/' + ent.path;
        var raw;
        try { raw = await ForgeFS.readFile(state.docsRoot, rel); }
        catch (err) { skipped++; continue; }
        try { docs.push(H.parseDoc(ent.path, raw, H.DEFAULT_CLUSTERS)); }
        catch (perr) { skipped++; }
      }
      state.docs = docs;
      state.skipped = skipped;
      state.initiatives = H.groupInitiatives(docs);
      this._renderTree();
      if (skipped > 0) {
        ForgeUtils.Toast.show('Skipped ' + skipped + ' unreadable doc(s)', 'warning', 4000);
      }
    },
```

- [ ] **Step 2: Verify in the browser**

`npm run serve`, open Design Plans, click "Choose docs root…", select the `cowork-database` repo (or any repo with `docs/superpowers/`).
Expected: no toast about skipped docs (assuming clean read); open the devtools console and confirm `state.initiatives.length > 0` by temporarily adding `console.log(state.initiatives)` at the end of `_loadDocs` (remove it before committing). The tree area is still empty (rendered next task).

- [ ] **Step 3: Commit**

```bash
git add app/js/design-plans.js
git commit -m "feat(design-plans): load + parse + group docs from docs-root"
```

---

## Task 8: Sidebar initiative tree

**Goal:** The sidebar lists initiatives (newest-first) as collapsible groups with member rows (type icon, status dot, plan progress). Clicking a row selects it.

**Files:**
- Modify: `forge-shell/app/css/design-plans.css`
- Modify: `forge-shell/app/js/design-plans.js`

**Interfaces:**
- Produces: `ctrl._renderTree()` rendering into `[data-dp-tree]`; selection recorded in `state.selectedKey` / `state.selectedType`.

- [ ] **Step 1: Add the tree CSS**

Append to `forge-shell/app/css/design-plans.css`:

```css
/* ── Initiative tree ── */
.dp-tree-view { padding: 6px 0; flex: 1; overflow-y: auto; }

.dp-initiative { margin-bottom: 2px; }
.dp-initiative-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; cursor: pointer; user-select: none;
  font-size: 12px; color: var(--text-secondary);
}
.dp-initiative-header:hover { background: var(--bg-hover); }
.dp-initiative-header .dp-toggle { width: 10px; color: var(--text-muted); }
.dp-initiative-header .dp-init-date { font-variant-numeric: tabular-nums; color: var(--text-muted); }
.dp-initiative-header .dp-init-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.dp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.dp-members { padding-left: 20px; }
.dp-members.hidden { display: none; }
.dp-member {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; cursor: pointer; font-size: 13px;
  color: var(--text-primary);
}
.dp-member:hover { background: var(--bg-hover); }
.dp-member.selected { background: var(--accent-light); }
.dp-member .dp-member-type { width: 16px; text-align: center; color: var(--text-muted); }
.dp-member .dp-member-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-progress { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }
.dp-progress-bar { width: 36px; height: 5px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; }
.dp-progress-bar > span { display: block; height: 100%; background: var(--accent); }

.dp-search-results .dp-member { padding-left: 14px; }
.dp-search-results .dp-member .dp-member-meta { font-size: 11px; color: var(--text-muted); }
```

- [ ] **Step 2: Implement `_renderTree`, status color, and member-row rendering**

Add to `ctrl` in `forge-shell/app/js/design-plans.js`:

```js
    _statusColor(bucket) {
      return 'var(--dp-status-' + (bucket || 'unknown').toLowerCase().replace(/\s+/g, '') + ', var(--text-muted))';
    },

    _typeIcon(type) {
      if (type === 'spec') return '<i class="fa-regular fa-file-lines" title="spec"></i>';
      if (type === 'plan') return '<i class="fa-solid fa-list-check" title="plan"></i>';
      if (type === 'handoff') return '<i class="fa-solid fa-hand" title="handoff"></i>';
      return '<i class="fa-regular fa-file"></i>';
    },

    _renderTree() {
      var treeEl = $q('[data-dp-tree]');
      if (!treeEl) return;
      var query = (state.query || '').trim();
      if (query) { this._renderSearchResults(); return; }
      treeEl.classList.remove('hidden');
      var resEl = $q('[data-dp-search-results]');
      if (resEl) resEl.classList.add('hidden');

      if (!state.initiatives.length) {
        treeEl.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No docs found.</div>';
        return;
      }
      var html = '';
      state.initiatives.forEach(function (init) {
        var open = !state.collapsed[init.key];
        var members = [];
        if (init.spec) members.push(init.spec);
        if (init.plan) members.push(init.plan);
        init.handoffs.forEach(function (h) { members.push(h); });
        html +=
          '<div class="dp-initiative">' +
            '<div class="dp-initiative-header" data-dp-toggle="' + ESC(init.key) + '">' +
              '<span class="dp-toggle"><i class="fa-solid fa-chevron-' + (open ? 'down' : 'right') + '"></i></span>' +
              '<span class="dp-status-dot" style="background:' + ctrl._statusColor(init.statusBucket) + '"></span>' +
              '<span class="dp-init-date">' + ESC(init.date || '') + '</span>' +
              '<span class="dp-init-title">' + ESC(init.title || init.slug) + '</span>' +
            '</div>' +
            '<div class="dp-members' + (open ? '' : ' hidden') + '">' +
              members.map(function (d) { return ctrl._memberRow(init.key, d); }).join('') +
            '</div>' +
          '</div>';
      });
      treeEl.innerHTML = html;
      this._bindTreeEvents();
    },

    _memberRow(initKey, doc) {
      var selected = (state.selectedKey === initKey && state.selectedType === doc.type);
      var prog = '';
      if (doc.type === 'plan' && doc.progress && doc.progress.percent != null) {
        prog = '<span class="dp-progress" title="' + doc.progress.done + '/' + doc.progress.total + ' done">' +
                 '<span class="dp-progress-bar"><span style="width:' + doc.progress.percent + '%"></span></span>' +
                 doc.progress.percent + '%' +
               '</span>';
      }
      return '<div class="dp-member' + (selected ? ' selected' : '') + '" ' +
        'data-dp-select="' + ESC(initKey) + '" data-dp-type="' + doc.type + '">' +
        '<span class="dp-member-type">' + this._typeIcon(doc.type) + '</span>' +
        '<span class="dp-status-dot" style="background:' + this._statusColor(doc.statusBucket) + '"></span>' +
        '<span class="dp-member-title">' + ESC(doc.title || doc.slug) + '</span>' +
        prog +
        '</div>';
    },

    _bindTreeEvents() {
      $qa('[data-dp-toggle]').forEach(function (el) {
        el.addEventListener('click', function () {
          var key = el.getAttribute('data-dp-toggle');
          if (state.collapsed[key]) delete state.collapsed[key];
          else state.collapsed[key] = true;
          ctrl._renderTree();
        });
      });
      $qa('[data-dp-select]').forEach(function (el) {
        el.addEventListener('click', function () {
          state.selectedKey = el.getAttribute('data-dp-select');
          state.selectedType = el.getAttribute('data-dp-type');
          ctrl._renderTree();
          ctrl._renderDetail();
        });
      });
    },
```

- [ ] **Step 3: Verify in the browser**

`npm run serve` → Design Plans → pick the docs root. Expand/collapse initiatives; confirm status dots and plan progress bars render. Clicking a row updates `selected` highlight (detail still empty — next task).

- [ ] **Step 4: Commit**

```bash
git add app/css/design-plans.css app/js/design-plans.js
git commit -m "feat(design-plans): initiative-grouped sidebar tree"
```

---

## Task 9: Detail panel + Jump to sibling

**Goal:** Selecting a member renders its markdown in the detail panel with a status/date/topic header and a "Jump to sibling" button (spec↔plan within the same initiative).

**Files:**
- Modify: `forge-shell/app/css/design-plans.css`
- Modify: `forge-shell/app/js/design-plans.js`

**Interfaces:**
- Produces: `ctrl._renderDetail()` rendering into `[data-dp-detail]`.

- [ ] **Step 1: Add detail CSS**

Append to `forge-shell/app/css/design-plans.css`:

```css
/* ── Detail panel ── */
.dp-detail-header {
  flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 14px 24px; border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
}
.dp-detail-header .dp-title { font-size: 17px; font-weight: 700; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-detail-header .dp-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
.dp-detail-body { flex: 1; overflow-y: auto; padding: 20px 24px; max-width: 900px; }
.dp-detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 10px; }
```

- [ ] **Step 2: Implement `_renderDetail` + Jump to sibling**

Add to `ctrl`:

```js
    _selectedDoc() {
      var init = state.initiatives.filter(function (i) { return i.key === state.selectedKey; })[0];
      if (!init) return null;
      if (state.selectedType === 'spec') return init.spec;
      if (state.selectedType === 'plan') return init.plan;
      if (state.selectedType === 'handoff') return init.handoffs[0];
      return null;
    },

    _renderDetail() {
      var el = $q('[data-dp-detail]');
      if (!el) return;
      var doc = this._selectedDoc();
      if (!doc) {
        el.innerHTML = '<div class="dp-detail-empty"><i class="fa-solid fa-diagram-project" style="font-size:32px;"></i>' +
          '<span>Select a spec or plan to read.</span></div>';
        return;
      }
      var init = state.initiatives.filter(function (i) { return i.key === state.selectedKey; })[0];
      // sibling: spec<->plan within the same initiative
      var siblingType = null;
      if (init) {
        if (doc.type === 'spec' && init.plan) siblingType = 'plan';
        else if (doc.type === 'plan' && init.spec) siblingType = 'spec';
      }
      var progStr = '';
      if (doc.type === 'plan' && doc.progress && doc.progress.percent != null) {
        progStr = '<span>· ' + doc.progress.done + '/' + doc.progress.total + ' steps (' + doc.progress.percent + '%)</span>';
      }
      var jumpBtn = siblingType
        ? '<button class="btn-icon" data-dp-jump="' + siblingType + '" title="Jump to ' + siblingType + '"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>'
        : '';
      el.innerHTML =
        '<div class="dp-detail-header">' +
          '<h2 class="dp-title">' + ESC(doc.title || doc.slug) + '</h2>' +
          '<div class="dp-meta">' +
            '<span class="status-pill" style="background:color-mix(in srgb,' + this._statusColor(doc.statusBucket) + ' 15%, transparent);color:' + this._statusColor(doc.statusBucket) + ';">' + ESC(doc.statusBucket) + '</span>' +
            '<span>' + ESC(doc.date || '') + '</span>' +
            (doc.topic ? '<span>· ' + ESC(doc.topic) + '</span>' : '') +
            progStr +
          '</div>' +
          '<div style="margin-left:auto;">' + jumpBtn + '</div>' +
        '</div>' +
        '<div class="dp-detail-body rendered-body">' + ForgeUtils.MD.render(doc.body || '') + '</div>';
      var jump = $q('[data-dp-jump]');
      if (jump) jump.addEventListener('click', function () {
        state.selectedType = jump.getAttribute('data-dp-jump');
        ctrl._renderTree();
        ctrl._renderDetail();
      });
    },
```

Also call `this._renderDetail()` at the end of `init` (after `_loadDocs`/`_renderEmptyState`) so the empty-state prompt shows on first open:
```js
      this._renderDetail();
```

- [ ] **Step 3: Verify in the browser**

`npm run serve` → pick docs root → click a spec, then a plan. Confirm the rendered markdown, status pill, and the Jump button switching spec↔plan. (Tables/task-lists render via the shared basic renderer — lossy rendering of tables is an accepted v1 limitation.)

- [ ] **Step 4: Commit**

```bash
git add app/css/design-plans.css app/js/design-plans.js
git commit -m "feat(design-plans): rendered detail panel + jump-to-sibling"
```

---

## Task 10: Search mode

**Goal:** Typing in the search box shows a ranked flat results list (uses `H.rankDocs`); clearing it restores the initiative tree. Filters still apply to the candidate set.

**Files:**
- Modify: `forge-shell/app/js/design-plans.js`

**Interfaces:**
- Consumes: `H.rankDocs`; `state.filters` (Task 11 sets them; until then filters are empty and `docMatchesFilters` returns true).

- [ ] **Step 1: Add `docMatchesFilters` + `_renderSearchResults`**

Add to `ctrl`:

```js
    docMatchesFilters(doc) {
      var f = state.filters;
      if (f.type.length && f.type.indexOf(doc.type) === -1) return false;
      if (f.status.length && f.status.indexOf(doc.statusBucket) === -1) return false;
      if (f.topic.length && f.topic.indexOf(doc.topic || null) === -1) return false;
      return true;
    },

    _renderSearchResults() {
      var treeEl = $q('[data-dp-tree]');
      if (treeEl) treeEl.classList.add('hidden');
      var resEl = $q('[data-dp-search-results]');
      if (!resEl) return;
      resEl.classList.remove('hidden');
      var candidates = state.docs.filter(function (d) { return ctrl.docMatchesFilters(d); });
      var ranked = H.rankDocs(candidates, state.query);
      if (!ranked.length) {
        resEl.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No matches.</div>';
        return;
      }
      var html = ranked.map(function (d) {
        return '<div class="dp-member" data-dp-select="' + ESC(d.date + '|' + d.slug) + '" data-dp-type="' + d.type + '">' +
          '<span class="dp-member-type">' + ctrl._typeIcon(d.type) + '</span>' +
          '<span class="dp-member-title">' + ESC(d.title || d.slug) + '</span>' +
          '<span class="dp-member-meta">' + ESC(d.date || '') + ' · ' + ESC(d.type) + '</span>' +
          '</div>';
      }).join('');
      resEl.innerHTML = html;
      resEl.querySelectorAll('[data-dp-select]').forEach(function (el) {
        el.addEventListener('click', function () {
          state.selectedKey = el.getAttribute('data-dp-select');
          state.selectedType = el.getAttribute('data-dp-type');
          ctrl._renderTree();   // re-highlights
          ctrl._renderDetail();
        });
      });
    },
```

The existing `_bindChrome` search handler already calls `ctrl._renderTree()` on input, and `_renderTree` now delegates to `_renderSearchResults` when `state.query` is non-empty — so no further wiring is needed.

- [ ] **Step 2: Verify in the browser**

`npm run serve` → pick docs root → type a known slug (e.g. `cron`) in the search box. Confirm a ranked flat list replaces the tree; clearing the box restores the tree.

- [ ] **Step 3: Commit**

```bash
git add app/js/design-plans.js
git commit -m "feat(design-plans): ranked search results mode"
```

---

## Task 11: Filter panel + active-filter chips

**Goal:** The filter slide-out offers status / type / topic facets (derived from loaded docs) and applies them; active facets show as a chips row.

**Files:**
- Modify: `forge-shell/app/css/design-plans.css`
- Modify: `forge-shell/app/js/design-plans.js`

- [ ] **Step 1: Add filter-panel + chips CSS**

Append to `forge-shell/app/css/design-plans.css`:

```css
/* ── Filter panel ── */
.dp-filter-panel {
  position: absolute; top: var(--toolbar-height); right: 0; bottom: 0; width: 280px;
  background: var(--bg-secondary); border-left: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg); z-index: 20;
  display: flex; flex-direction: column; overflow-y: auto;
  transform: translateX(100%); transition: transform 0.2s ease;
}
.dp-filter-panel.open { transform: translateX(0); }
.dp-filter-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; font-size: 13px; }
.dp-filter-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
.dp-filter-group { margin-bottom: 16px; }
.dp-filter-group h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin: 0 0 6px; }
.dp-filter-group label { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 13px; cursor: pointer; }
.dp-filter-clear { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; padding: 0; }

/* ── Active filter chips ── */
.dp-active-filters { grid-row: 2; display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-light); }
.dp-active-filters.hidden { display: none; }
.dp-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--bg-tertiary); border-radius: 12px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
.dp-chip:hover { background: var(--bg-hover); }
```

- [ ] **Step 2: Render the filter panel content + toggle open on first show**

Add to `ctrl`:

```js
    _facetValues() {
      var status = {}, type = {}, topic = {};
      state.docs.forEach(function (d) {
        status[d.statusBucket] = 1; type[d.type] = 1;
        if (d.topic) topic[d.topic] = 1;
      });
      return {
        status: Object.keys(status).sort(),
        type: Object.keys(type).sort(),
        topic: Object.keys(topic).sort()
      };
    },

    _renderFilterPanel() {
      var panel = $q('[data-dp-filter-panel]');
      if (!panel) return;
      var f = this._facetValues();
      var self = this;
      function group(title, key, vals) {
        var rows = vals.map(function (v) {
          var checked = state.filters[key].indexOf(v) !== -1 ? 'checked' : '';
          return '<label><input type="checkbox" data-dp-facet="' + key + '" value="' + ESC(v) + '" ' + checked + '> ' + ESC(v) + '</label>';
        }).join('');
        return '<div class="dp-filter-group"><h4>' + title + '</h4>' + rows + '</div>';
      }
      panel.innerHTML =
        '<div class="dp-filter-header"><span>Filter</span><button class="dp-filter-clear" data-dp-action="clear-filters">Clear all</button></div>' +
        '<div class="dp-filter-body">' +
          group('Status', 'status', f.status) +
          group('Type', 'type', f.type) +
          group('Topic', 'topic', f.topic) +
        '</div>';
      panel.querySelectorAll('[data-dp-facet]').forEach(function (box) {
        box.addEventListener('change', function () {
          var key = box.getAttribute('data-dp-facet');
          var val = box.value;
          var arr = state.filters[key];
          var idx = arr.indexOf(val);
          if (box.checked && idx === -1) arr.push(val);
          if (!box.checked && idx !== -1) arr.splice(idx, 1);
          self._renderTree();
          self._renderActiveChips();
        });
      });
      var clear = panel.querySelector('[data-dp-action="clear-filters"]');
      if (clear) clear.addEventListener('click', function () {
        state.filters = { status: [], type: [], topic: [] };
        self._renderFilterPanel();
        self._renderTree();
        self._renderActiveChips();
      });
    },

    _renderActiveChips() {
      var bar = $q('[data-dp-active-filters]');
      var layout = $q('.dp-layout');
      if (!bar || !layout) return;
      var all = state.filters.status.concat(state.filters.type).concat(state.filters.topic);
      if (!all.length) {
        bar.classList.add('hidden');
        layout.classList.remove('has-filter-chips');
        bar.innerHTML = '';
        return;
      }
      bar.classList.remove('hidden');
      layout.classList.add('has-filter-chips');
      var chips = all.map(function (v) {
        return '<span class="dp-chip" data-dp-chip="' + ESC(v) + '">' + ESC(v) + ' <i class="fa-solid fa-xmark"></i></span>';
      }).join('');
      bar.innerHTML = chips;
      bar.querySelectorAll('[data-dp-chip]').forEach(function (c) {
        c.addEventListener('click', function () {
          var v = c.getAttribute('data-dp-chip');
          ['status', 'type', 'topic'].forEach(function (k) {
            var i = state.filters[k].indexOf(v);
            if (i !== -1) state.filters[k].splice(i, 1);
          });
          ctrl._renderFilterPanel();
          ctrl._renderTree();
          ctrl._renderActiveChips();
        });
      });
    },
```

Update `_bindChrome`'s filter-toggle handler so opening the panel (re)renders it:
```js
      if (filterBtn) filterBtn.addEventListener('click', function () {
        var panel = $q('[data-dp-filter-panel]');
        if (!panel) return;
        var willOpen = !panel.classList.contains('open');
        panel.classList.toggle('open', willOpen);
        if (willOpen) ctrl._renderFilterPanel();
      });
```

Also call `this._renderActiveChips()` at the end of `_loadDocs` (after `this._renderTree()`).

- [ ] **Step 3: Verify in the browser**

`npm run serve` → pick docs root → open the filter panel → tick e.g. "Approved" + "plan". Confirm the tree filters to matching initiatives/docs, a chips row appears, and clicking a chip removes that filter. Typing in search while filtered narrows further.

- [ ] **Step 4: Commit**

```bash
git add app/css/design-plans.css app/js/design-plans.js
git commit -m "feat(design-plans): faceted filter panel + active chips"
```

---

## Task 12: Theme tokens + polish + file-watcher branch

**Goal:** Status/type color tokens are defined (so status dots/pills aren't muted), the empty/detail states look finished, and editing a watched doc in Tauri refreshes the view when the docs-root is under the project root.

**Files:**
- Modify: `forge-shell/app/css/theme.css`
- Modify: `forge-shell/app/js/shell.js`
- Modify: `forge-shell/app/css/design-plans.css` (minor polish only if needed)

- [ ] **Step 1: Add color tokens**

In `forge-shell/app/css/theme.css`, inside the `:root { ... }` block (after the existing `--status-*` tokens, around line 76), add:

```css
  /* Design Plans — status buckets + doc types (shared across themes) */
  --dp-status-draft: #e67e22;
  --dp-status-inreview: #3498db;
  --dp-status-approved: #27ae60;
  --dp-status-done: #1abc9c;
  --dp-status-rolledback: #e74c3c;
  --dp-status-unknown: #95a5a6;
  --dp-type-spec: #6366f1;
  --dp-type-plan: #10b981;
  --dp-type-handoff: #f59e0b;
```

(These are defined only in `:root`, matching how the existing `--status-*` tokens are shared across light/dark.)

- [ ] **Step 2: Add the file-change branch**

In `forge-shell/app/js/shell.js`, inside `_onFileChanged(path)` (the `if/else if` chain mapping paths to plugins), add a branch alongside the others:

```js
    } else if (path.includes('/docs/superpowers/')) {
      pluginToRefresh = 'design-plans';
```

Note: the Tauri watcher only observes the project root. This branch therefore fires when the docs-root lives under the selected project folder; otherwise the Refresh button is the reliable path (already wired in Task 6).

- [ ] **Step 3: Verify everything together**

Run: `npm test`
Expected: PASS (all tests; the 77 prior + new design-plans helper tests).

Then `npm run serve` and exercise the full flow: empty state → pick docs root → browse initiatives → read a spec + jump to its plan → search → filter → toggle theme (status colors must read well in both themes).

- [ ] **Step 4: Commit**

```bash
git add app/css/theme.css app/js/shell.js app/css/design-plans.css
git commit -m "feat(design-plans): status/type color tokens + file-watcher branch"
```

---

## Self-Review

**Spec coverage** (vs `2026-07-15-design-plans-view-design.md`):
- Browse by initiative — Tasks 7–8.
- Search — Task 10.
- Faceted filter (status/type/topic) — Task 11. (Date-range facet mentioned in the spec is deferred: the current UI exposes date as the tree's natural newest-first ordering and as a header field; a discrete date-range control added no clear value for v1 and was cut to keep scope tight. Flag to user if wanted.)
- Rendered reading view — Task 9.
- Plan progress % — Tasks 3 (helper) + 8 (bar).
- Dedicated docs-root picker — Tasks 6–7 (localStorage, not server config — see deviation note below).
- Status normalization — Task 3.
- Jump-to-sibling pairing — Task 9.
- Empty state + error handling (skip + toast, malformed-meta fallback) — Tasks 6–7 (fallback is inherent in `parseDocMeta`/`parseFilename`, tested in Tasks 1–2).
- Theme tokens (no mobile CSS) — Task 12.

**Deviation from spec (call out to user):** the spec proposed extending `server.js` `/api/config` + `fs-adapter.js` accessors for the docs-root. This plan stores the docs-root in client `localStorage` (`forge-shell-docs-root`; IndexedDB handle in browser mode) instead, which delivers the same "decoupled from the project folder" UX with **zero** `server.js`/`fs-adapter`/Rust changes — matching how the app already persists preferences (sidebar widths, plugin visibility). Server-side persistence is therefore a non-goal.

**Type/name consistency:** `_statusColor` uses buckets lowercased with whitespace stripped → `--dp-status-<bucket>` (e.g. `In Review` → `--dp-status-inreview`), matching the tokens added in Task 12. `initiativeKey` format `date|slug` is produced by `groupInitiatives` and consumed identically by the tree's `data-dp-toggle`/`data-dp-select` (Task 8) and search results (Task 10). `parseDoc` field names (`statusBucket`, `progress`) match `groupInitiatives` and the renderers.

**Placeholder scan:** none — every step has runnable test code or concrete implementation/verification.
