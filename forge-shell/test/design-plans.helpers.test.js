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

test('parseFilename: handoff strips -handoff suffix so slug groups with spec', () => {
  assert.deepEqual(
    H.parseFilename('2026-07-04-d-handoff.md'),
    { date: '2026-07-04', slug: 'd' }
  );
});

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

/* ── rankDocs ── */

test('rankDocs: empty query returns []', () => {
  const d = H.parseDoc('specs/2026-07-08-cron-design.md', '# Cron\n', ['cron']);
  assert.deepEqual(H.rankDocs([d], ''), []);
  assert.deepEqual(H.rankDocs([d], '   '), []);
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
