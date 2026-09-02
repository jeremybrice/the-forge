'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/product-forge.helpers.js');

function memoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function card(filename, type, title, parent, status) {
  return {
    filename: filename,
    frontmatter: {
      type: type,
      title: title || filename,
      parent: parent || null,
      status: status || 'proposed'
    }
  };
}

/* ── pinStore ── */

test('pinStore: load empty when key absent', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.deepEqual(store.list(), []);
});

test('pinStore: add up to 3 then block fourth', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.equal(store.add('a'), 'added');
  assert.equal(store.add('b'), 'added');
  assert.equal(store.add('c'), 'added');
  assert.equal(store.add('d'), 'blocked');
  assert.deepEqual(store.list(), ['a', 'b', 'c']);
});

test('pinStore: toggle removes existing', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a');
  assert.equal(store.toggle('a'), 'removed');
  assert.deepEqual(store.list(), []);
});

test('pinStore: toggle adds when under cap', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.equal(store.toggle('x'), 'added');
  assert.deepEqual(store.list(), ['x']);
});

test('pinStore: toggle blocks when at cap and filename not pinned', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a'); store.add('b'); store.add('c');
  assert.equal(store.toggle('d'), 'blocked');
  assert.deepEqual(store.list(), ['a', 'b', 'c']);
});

test('pinStore: persist round-trip via storage', () => {
  const mem = memoryStorage();
  const a = H.createPinStore({ storage: mem });
  a.load();
  a.add('one');
  a.add('two');
  a.save();
  const b = H.createPinStore({ storage: mem });
  b.load();
  assert.deepEqual(b.list(), ['one', 'two']);
});

test('pinStore: pruneMissing drops unknown filenames', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('keep');
  store.add('gone');
  store.pruneMissing(function (fn) { return fn === 'keep'; });
  assert.deepEqual(store.list(), ['keep']);
});

test('pinStore: add existing returns exists and does not duplicate', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a');
  assert.equal(store.add('a'), 'exists');
  assert.deepEqual(store.list(), ['a']);
});

test('pinStore: load ignores non-array JSON', () => {
  const mem = memoryStorage();
  mem.setItem('pfl-pinned', '{"nope":1}');
  const store = H.createPinStore({ storage: mem });
  store.load();
  assert.deepEqual(store.list(), []);
});

/* ── rankSearchResults ── */

test('rankSearchResults: empty query returns []', () => {
  assert.deepEqual(H.rankSearchResults([card('a', 'story', 'Alpha')], ''), []);
  assert.deepEqual(H.rankSearchResults([card('a', 'story', 'Alpha')], '   '), []);
});

test('rankSearchResults: starts-with title ranks before contains', () => {
  const cards = [
    card('z-mid', 'story', 'The Truck inventory'),
    card('a-start', 'story', 'Truck inventory waste'),
    card('b-file', 'story', 'Other', null)
  ];
  cards[2].filename = 'truck-notes';
  cards[2].frontmatter.title = 'Other';
  const ranked = H.rankSearchResults(cards, 'truck');
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].filename, 'a-start');
  assert.equal(ranked[1].filename, 'z-mid');
  assert.equal(ranked[2].filename, 'truck-notes');
});

test('rankSearchResults: case-insensitive; filename tie-break ASC within same rank', () => {
  const cards = [
    card('m-b', 'story', 'Alpha tool'),
    card('m-a', 'story', 'Alpha tool')
  ];
  const ranked = H.rankSearchResults(cards, 'alpha');
  assert.equal(ranked[0].filename, 'm-a');
  assert.equal(ranked[1].filename, 'm-b');
});

/* ── excludePinnedFromRecents ── */

test('excludePinnedFromRecents: drops pinned filenames', () => {
  const recents = [card('a', 'story'), card('b', 'story'), card('c', 'story')];
  const out = H.excludePinnedFromRecents(recents, ['b']);
  assert.deepEqual(out.map(function (c) { return c.filename; }), ['a', 'c']);
});

test('excludePinnedFromRecents: empty pins returns same cards', () => {
  const recents = [card('a', 'story')];
  const out = H.excludePinnedFromRecents(recents, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].filename, 'a');
});

/* ── buildBreadcrumb ── */

test('buildBreadcrumb: initiative only', () => {
  const init = card('init-1', 'initiative', 'Big Init');
  const get = function (fn) { return fn === 'init-1' ? init : null; };
  const bc = H.buildBreadcrumb(init, get);
  assert.equal(bc.segments.length, 1);
  assert.equal(bc.segments[0].label, 'Big Init');
  assert.equal(bc.segments[0].filename, 'init-1');
});

test('buildBreadcrumb: story with epic and initiative parents', () => {
  const init = card('init-1', 'initiative', 'Init');
  const epic = card('epic-1', 'epic', 'Epic', 'init-1');
  const story = card('story-1', 'story', 'Story', 'epic-1');
  const map = { 'init-1': init, 'epic-1': epic, 'story-1': story };
  const get = function (fn) { return map[fn] || null; };
  const bc = H.buildBreadcrumb(story, get);
  assert.deepEqual(bc.segments.map(function (s) { return s.label; }), ['Init', 'Epic', 'Story']);
  assert.deepEqual(bc.segments.map(function (s) { return s.filename; }), ['init-1', 'epic-1', 'story-1']);
});

test('buildBreadcrumb: orphan epic uses section prefix', () => {
  const epic = card('epic-o', 'epic', 'Lonely Epic', null);
  const get = function () { return null; };
  const bc = H.buildBreadcrumb(epic, get);
  assert.equal(bc.segments.length, 2);
  assert.equal(bc.segments[0].label, 'Orphan Epics');
  assert.equal(bc.segments[0].filename, null);
  assert.equal(bc.segments[1].label, 'Lonely Epic');
  assert.equal(bc.segments[1].filename, 'epic-o');
});

test('buildBreadcrumb: decision uses section label', () => {
  const d = card('dec-1', 'decision', 'Ship it');
  const bc = H.buildBreadcrumb(d, function () { return null; });
  assert.equal(bc.segments[0].label, 'Decisions');
  assert.equal(bc.segments[0].filename, null);
  assert.equal(bc.segments[1].label, 'Ship it');
  assert.equal(bc.segments[1].filename, 'dec-1');
});

/* ── cardMatchesStatusFilters ── */

test('cardMatchesStatusFilters: empty filters match all', () => {
  const c = card('s1', 'story', 'S', null, 'done');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: []
  }), true);
});

test('cardMatchesStatusFilters: story filtered by story_status', () => {
  const c = card('s1', 'story', 'S', null, 'done');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: ['proposed']
  }), false);
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: ['done']
  }), true);
});

test('cardMatchesStatusFilters: intake always matches (no status filter key)', () => {
  const c = card('i1', 'intake', 'In', null, 'new');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: ['active'], epic_status: [], story_status: []
  }), true);
});

/* ── shared lifecycle ── */

test('SHARED_LIFECYCLE is the five canonical statuses', () => {
  assert.deepEqual(H.SHARED_LIFECYCLE, [
    'Draft', 'In Progress', 'Complete', 'Cancelled', 'Superseded'
  ]);
});

test('isClosedStatus: canonical terminals and aliases, case-insensitive', () => {
  ['Completed', 'complete', 'DONE', 'Cancelled', 'canceled', 'Superseded', 'archived'].forEach((s) => {
    assert.equal(H.isClosedStatus(s), true, s);
  });
  ['Draft', 'In Progress', 'Ready', 'Approved', 'Planning', '', null, undefined].forEach((s) => {
    assert.equal(H.isClosedStatus(s), false, String(s));
  });
});

test('isTerminalStatus: Complete/Done cascade; Archived does not', () => {
  assert.equal(H.isTerminalStatus('Completed'), true);
  assert.equal(H.isTerminalStatus('Done'), true);
  assert.equal(H.isTerminalStatus('Complete'), true);
  assert.equal(H.isTerminalStatus('Cancelled'), true);
  assert.equal(H.isTerminalStatus('Superseded'), true);
  assert.equal(H.isTerminalStatus('Archived'), false);
  assert.equal(H.isTerminalStatus('In Progress'), false);
});

test('isRelatedChild: parent field or children array', () => {
  const init = card('ship', 'initiative', 'Ship');
  const viaParent = card('e1', 'epic', 'E', 'ship');
  const viaChildren = card('e2', 'epic', 'E2');
  init.frontmatter.children = ['e2'];
  assert.equal(H.isRelatedChild(init, viaParent), true);
  assert.equal(H.isRelatedChild(init, viaChildren), true);
  assert.equal(H.isRelatedChild(init, card('e3', 'epic', 'E3', 'other')), false);
});

test('collectDescendants: initiative gathers epics and their stories', () => {
  const init = card('ship', 'initiative', 'Ship');
  const epic = card('e1', 'epic', 'E', 'ship');
  const story = card('s1', 'story', 'S', 'e1');
  const other = card('s2', 'story', 'Other', 'other-epic');
  const desc = H.collectDescendants(init, [init, epic, story, other]);
  assert.deepEqual(desc.map((c) => c.filename).sort(), ['e1', 's1']);
});

test('collectDescendants: epic gathers stories; story gathers none', () => {
  const epic = card('e1', 'epic', 'E');
  epic.frontmatter.children = ['s1'];
  const story = card('s1', 'story', 'S');
  assert.deepEqual(H.collectDescendants(epic, [epic, story]).map((c) => c.filename), ['s1']);
  assert.deepEqual(H.collectDescendants(story, [epic, story]), []);
});

test('hasClosedAncestor / cardHiddenByClosed walk parent chain', () => {
  const init = card('ship', 'initiative', 'Ship', null, 'Completed');
  const epic = card('e1', 'epic', 'E', 'ship', 'In Progress');
  const story = card('s1', 'story', 'S', 'e1', 'Draft');
  const map = { ship: init, e1: epic, s1: story };
  const get = (fn) => map[fn] || null;
  assert.equal(H.hasClosedAncestor(story, get), true);
  assert.equal(H.cardHiddenByClosed(story, get), true);
  assert.equal(H.cardHiddenByClosed(init, get), true);
  init.frontmatter.status = 'In Progress';
  assert.equal(H.cardHiddenByClosed(story, get), false);
  assert.equal(H.cardHiddenByClosed(init, get), false);
});

test('pruneClosedHierarchy drops a closed initiative and its subtree', () => {
  const init = card('ship', 'initiative', 'Ship', null, 'Completed');
  const live = card('live', 'initiative', 'Live', null, 'Draft');
  const epic = card('e1', 'epic', 'E', 'ship', 'In Progress');
  const hierarchy = {
    tree: [
      { card: init, children: [{ card: epic, children: [] }] },
      { card: live, children: [] }
    ],
    orphanEpics: [],
    orphanStories: [],
    intakes: [],
    checkpoints: [],
    decisions: [],
    releaseNotes: []
  };
  const pruned = H.pruneClosedHierarchy(hierarchy);
  assert.equal(pruned.tree.length, 1);
  assert.equal(pruned.tree[0].card.filename, 'live');
});

test('pruneClosedHierarchy drops closed epics and stories under a live initiative', () => {
  const live = card('live', 'initiative', 'Live', null, 'In Progress');
  const doneEpic = card('e-done', 'epic', 'Done E', 'live', 'Completed');
  const openEpic = card('e-open', 'epic', 'Open E', 'live', 'Draft');
  const doneStory = card('s-done', 'story', 'Done S', 'e-open', 'Done');
  const openStory = card('s-open', 'story', 'Open S', 'e-open', 'Draft');
  const hierarchy = {
    tree: [{
      card: live,
      children: [
        { card: doneEpic, children: [] },
        { card: openEpic, children: [doneStory, openStory] }
      ]
    }],
    orphanEpics: [],
    orphanStories: [card('orphan-done', 'story', 'OD', null, 'Cancelled')],
    intakes: [],
    checkpoints: [],
    decisions: [],
    releaseNotes: []
  };
  const pruned = H.pruneClosedHierarchy(hierarchy);
  assert.equal(pruned.tree[0].children.length, 1);
  assert.equal(pruned.tree[0].children[0].card.filename, 'e-open');
  assert.equal(pruned.tree[0].children[0].children.length, 1);
  assert.equal(pruned.tree[0].children[0].children[0].filename, 's-open');
  assert.equal(pruned.orphanStories.length, 0);
});

test('summarizeDescendants counts epics and stories', () => {
  const s = H.summarizeDescendants([
    card('e1', 'epic'), card('e2', 'epic'), card('s1', 'story')
  ]);
  assert.deepEqual(s, { epics: 2, stories: 1 });
});
