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
