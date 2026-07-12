'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/roadmap.helpers.js');

/* ── nameEqualsRelease ── */

test('nameEqualsRelease: case-insensitive match', () => {
  assert.equal(H.nameEqualsRelease('Q1 2026', 'q1 2026'), true);
  assert.equal(H.nameEqualsRelease('Alpha', 'ALPHA'), true);
});

test('nameEqualsRelease: different names', () => {
  assert.equal(H.nameEqualsRelease('Q1', 'Q2'), false);
});

test('nameEqualsRelease: nullish equality', () => {
  assert.equal(H.nameEqualsRelease(null, null), true);
  assert.equal(H.nameEqualsRelease(undefined, null), true);
  assert.equal(H.nameEqualsRelease(null, 'Q1'), false);
  assert.equal(H.nameEqualsRelease('Q1', undefined), false);
});

/* ── clearReleaseFm ── */

test('clearReleaseFm: sets release to null, never deletes key', () => {
  const fm = { title: 'X', release: 'Q1 2026' };
  const out = H.clearReleaseFm(fm);
  assert.equal(out, fm);
  assert.equal(fm.release, null);
  assert.equal(Object.prototype.hasOwnProperty.call(fm, 'release'), true);
});

test('clearReleaseFm: works when release already absent', () => {
  const fm = { title: 'X' };
  H.clearReleaseFm(fm);
  assert.equal(fm.release, null);
});

/* ── releasesOverlappingPeriod / releaseOverlapsPeriod ── */

const Q1 = { label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31' };
const Q2 = { label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30' };

const releases = [
  { name: 'Ship Q1', start_date: '2026-01-01', end_date: '2026-03-31' },
  { name: 'Platform 26.2', start_date: '2026-02-15', end_date: '2026-05-30' },
  { name: 'H2 Only', start_date: '2026-07-01', end_date: '2026-12-31' }
];

test('releasesOverlappingPeriod: single match', () => {
  const set = H.releasesOverlappingPeriod(releases, Q1);
  assert.equal(set.length, 2); // Ship Q1 + Platform 26.2
  assert.ok(set.some((r) => r.name === 'Ship Q1'));
  assert.ok(set.some((r) => r.name === 'Platform 26.2'));
});

test('releasesOverlappingPeriod: none', () => {
  const emptyPeriod = { start: '2025-01-01', end: '2025-03-31' };
  assert.deepEqual(H.releasesOverlappingPeriod(releases, emptyPeriod), []);
});

test('releaseOverlapsPeriod: edge inclusive', () => {
  assert.equal(
    H.releaseOverlapsPeriod(
      { start_date: '2026-03-31', end_date: '2026-04-01' },
      Q1
    ),
    true
  );
  assert.equal(
    H.releaseOverlapsPeriod(
      { start_date: '2026-04-01', end_date: '2026-04-15' },
      Q1
    ),
    false
  );
});

/* ── resolveDropToRelease truth table ── */

test('resolveDropToRelease: |set|=0 → none', () => {
  const r = H.resolveDropToRelease(Q1, [{ name: 'H2', start_date: '2026-07-01', end_date: '2026-12-31' }], null);
  assert.equal(r.kind, 'none');
});

test('resolveDropToRelease: |set|=1, prefInSet → noop', () => {
  const only = [{ name: 'Ship Q1', start_date: '2026-01-01', end_date: '2026-03-31' }];
  const r = H.resolveDropToRelease(Q1, only, 'ship q1');
  assert.equal(r.kind, 'noop');
  assert.equal(r.releaseName, 'Ship Q1');
});

test('resolveDropToRelease: |set|=1, no pref → single', () => {
  const only = [{ name: 'Ship Q1', start_date: '2026-01-01', end_date: '2026-03-31' }];
  const r = H.resolveDropToRelease(Q1, only, null);
  assert.equal(r.kind, 'single');
  assert.equal(r.releaseName, 'Ship Q1');
});

test('resolveDropToRelease: |set|=1, pref not in set → single', () => {
  const only = [{ name: 'Ship Q1', start_date: '2026-01-01', end_date: '2026-03-31' }];
  const r = H.resolveDropToRelease(Q1, only, 'Other Release');
  assert.equal(r.kind, 'single');
  assert.equal(r.releaseName, 'Ship Q1');
});

test('resolveDropToRelease: |set|>1, prefInSet → noop', () => {
  const r = H.resolveDropToRelease(Q1, releases, 'Platform 26.2');
  assert.equal(r.kind, 'noop');
  assert.ok(r.releases.length > 1);
});

test('resolveDropToRelease: |set|>1, not prefInSet → ambiguous', () => {
  const r = H.resolveDropToRelease(Q1, releases, null);
  assert.equal(r.kind, 'ambiguous');
  assert.ok(r.releases.length > 1);
});

test('resolveDropToRelease: |set|>1, pref not in set → ambiguous', () => {
  const r = H.resolveDropToRelease(Q1, releases, 'H2 Only');
  assert.equal(r.kind, 'ambiguous');
});

test('resolveDropToRelease: unscheduled period null → clear when pref set', () => {
  const r = H.resolveDropToRelease(null, releases, 'Ship Q1');
  assert.equal(r.kind, 'clear');
});

test('resolveDropToRelease: unscheduled already clear → noop', () => {
  assert.equal(H.resolveDropToRelease(null, releases, null).kind, 'noop');
  assert.equal(H.resolveDropToRelease({ unscheduled: true }, releases, '').kind, 'noop');
});

/* ── periodLabelsForRelease ── */

test('periodLabelsForRelease: multi-quarter span', () => {
  const multi = { name: 'Platform 26.2', start_date: '2026-02-15', end_date: '2026-05-30' };
  const labels = H.periodLabelsForRelease(multi, [Q1, Q2]);
  assert.deepEqual(labels, ['Q1 2026', 'Q2 2026']);
});

/* ── guardDecision ── */

test('guardDecision: no pending → apply', () => {
  assert.equal(H.guardDecision(null, 'disk', 1000, 15000), 'apply');
});

test('guardDecision: disk matches expected → apply-and-clear', () => {
  const pending = { expectedContent: 'same', writtenAt: 1000 };
  assert.equal(H.guardDecision(pending, 'same', 2000, 15000), 'apply-and-clear');
});

test('guardDecision: mismatch within TTL → skip', () => {
  const pending = { expectedContent: 'want', writtenAt: 1000 };
  assert.equal(H.guardDecision(pending, 'stale', 1000 + 5000, 15000), 'skip');
});

test('guardDecision: mismatch past TTL → force-apply-ttl', () => {
  const pending = { expectedContent: 'want', writtenAt: 1000 };
  assert.equal(H.guardDecision(pending, 'stale', 1000 + 15000, 15000), 'force-apply-ttl');
  assert.equal(H.guardDecision(pending, 'stale', 1000 + 20000, 15000), 'force-apply-ttl');
});

/* ── cardRelativePath ── */

test('cardRelativePath: dirName/filename.md', () => {
  assert.equal(
    H.cardRelativePath({ dirName: 'initiatives', filename: 'notification-system-overhaul' }),
    'initiatives/notification-system-overhaul.md'
  );
});

test('cardRelativePath: empty card', () => {
  assert.equal(H.cardRelativePath(null), '');
  assert.equal(H.cardRelativePath({}), '/.md');
});
