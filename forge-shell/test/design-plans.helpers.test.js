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
