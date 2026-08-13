/* ═══════════════════════════════════════════════════════════════
   Product Forge Helpers — pure logic for sidebar findability.
   Importable as <script> (window.ProductForgeHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProductForgeHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_KEY = 'pfl-pinned';
  var DEFAULT_MAX = 3;

  function createPinStore(options) {
    options = options || {};
    var storage = options.storage;
    var key = options.key || DEFAULT_KEY;
    var max = typeof options.max === 'number' ? options.max : DEFAULT_MAX;
    var filenames = [];

    function list() {
      return filenames.slice();
    }

    function load() {
      filenames = [];
      if (!storage || typeof storage.getItem !== 'function') return;
      try {
        var raw = storage.getItem(key);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        filenames = parsed.filter(function (x) {
          return typeof x === 'string' && x.length > 0;
        }).slice(0, max);
      } catch (e) {
        filenames = [];
      }
    }

    function save() {
      if (!storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(key, JSON.stringify(filenames));
      } catch (e) {
        /* ignore quota / private mode */
      }
    }

    function add(filename) {
      if (!filename) return 'blocked';
      if (filenames.indexOf(filename) !== -1) return 'exists';
      if (filenames.length >= max) return 'blocked';
      filenames.push(filename);
      save();
      return 'added';
    }

    function remove(filename) {
      var i = filenames.indexOf(filename);
      if (i === -1) return;
      filenames.splice(i, 1);
      save();
    }

    function toggle(filename) {
      if (!filename) return 'blocked';
      if (filenames.indexOf(filename) !== -1) {
        remove(filename);
        return 'removed';
      }
      var r = add(filename);
      if (r === 'added') return 'added';
      return 'blocked';
    }

    function pruneMissing(existsFn) {
      if (typeof existsFn !== 'function') return;
      filenames = filenames.filter(function (fn) {
        return existsFn(fn);
      });
      save();
    }

    return {
      get filenames() { return filenames; },
      load: load,
      save: save,
      add: add,
      remove: remove,
      toggle: toggle,
      pruneMissing: pruneMissing,
      list: list
    };
  }

  function rankSearchResults(cards, query) {
    if (!Array.isArray(cards)) return [];
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];

    var ranked = [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var title = ((card.frontmatter && card.frontmatter.title) || '').toLowerCase();
      var fname = (card.filename || '').toLowerCase();
      var rank;
      if (title.indexOf(q) === 0) rank = 0;
      else if (title.indexOf(q) !== -1) rank = 1;
      else if (fname.indexOf(q) !== -1) rank = 2;
      else continue;
      ranked.push({ card: card, rank: rank, filename: card.filename || '' });
    }
    ranked.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.filename < b.filename) return -1;
      if (a.filename > b.filename) return 1;
      return 0;
    });
    return ranked.map(function (e) { return e.card; });
  }

  function excludePinnedFromRecents(recents, pinnedFilenames) {
    if (!Array.isArray(recents)) return [];
    var pinSet = {};
    if (Array.isArray(pinnedFilenames)) {
      for (var i = 0; i < pinnedFilenames.length; i++) {
        pinSet[pinnedFilenames[i]] = true;
      }
    }
    return recents.filter(function (card) {
      return !pinSet[card.filename];
    });
  }

  var SECTION_LABELS = {
    intake: 'Intakes',
    checkpoint: 'Checkpoints',
    decision: 'Decisions',
    'release-note': 'Release Notes'
  };

  function buildBreadcrumb(card, storeGet) {
    var segments = [];
    if (!card || !card.frontmatter) {
      return { segments: segments };
    }
    var type = card.frontmatter.type;
    var title = card.frontmatter.title || card.filename;

    if (type === 'initiative' || type === 'epic' || type === 'story') {
      var chain = [];
      var cursor = card;
      var safety = 16;
      while (cursor && safety-- > 0) {
        chain.unshift({
          label: (cursor.frontmatter && cursor.frontmatter.title) || cursor.filename,
          filename: cursor.filename
        });
        var parentFn = cursor.frontmatter && cursor.frontmatter.parent;
        if (!parentFn || typeof storeGet !== 'function') break;
        cursor = storeGet(parentFn);
      }
      if (type === 'epic' && !(card.frontmatter.parent) && chain.length === 1) {
        segments.push({ label: 'Orphan Epics', filename: null });
      }
      if (type === 'story' && !(card.frontmatter.parent) && chain.length === 1) {
        segments.push({ label: 'Orphan Stories', filename: null });
      }
      for (var i = 0; i < chain.length; i++) segments.push(chain[i]);
      return { segments: segments };
    }

    var section = SECTION_LABELS[type];
    if (section) {
      segments.push({ label: section, filename: null });
    }
    segments.push({ label: title, filename: card.filename });
    return { segments: segments };
  }

  function cardMatchesStatusFilters(card, filters) {
    filters = filters || {};
    var fm = (card && card.frontmatter) || {};
    var type = fm.type;
    var key = type === 'initiative' ? 'initiative_status'
            : type === 'epic' ? 'epic_status'
            : type === 'story' ? 'story_status'
            : null;
    if (!key) return true;
    var arr = filters[key] || [];
    if (arr.length === 0) return true;
    return arr.indexOf(fm.status) !== -1;
  }

  var SHARED_LIFECYCLE = ['Draft', 'In Progress', 'Completed', 'Cancelled', 'Superseded'];
  var CLOSED = {
    completed: 1, complete: 1, done: 1,
    cancelled: 1, canceled: 1, superseded: 1, archived: 1
  };
  var TERMINAL = {
    completed: 1, complete: 1, done: 1,
    cancelled: 1, canceled: 1, superseded: 1
  };

  function normStatus(status) {
    return status == null ? '' : String(status).toLowerCase();
  }

  function isClosedStatus(status) {
    return !!CLOSED[normStatus(status)];
  }

  function isTerminalStatus(status) {
    return !!TERMINAL[normStatus(status)];
  }

  function isRelatedChild(parentCard, childCard) {
    if (!parentCard || !childCard) return false;
    var childFm = childCard.frontmatter || {};
    var parentFm = parentCard.frontmatter || {};
    if (childFm.parent === parentCard.filename) return true;
    return Array.isArray(parentFm.children) && parentFm.children.indexOf(childCard.filename) !== -1;
  }

  function collectDescendants(rootCard, allCards) {
    if (!rootCard || !Array.isArray(allCards)) return [];
    var type = (rootCard.frontmatter || {}).type;
    var result = [];
    if (type === 'initiative') {
      var epics = allCards.filter(function (c) {
        return (c.frontmatter || {}).type === 'epic' && isRelatedChild(rootCard, c);
      });
      result = result.concat(epics);
      epics.forEach(function (epic) {
        allCards.forEach(function (c) {
          if ((c.frontmatter || {}).type === 'story' && isRelatedChild(epic, c)) result.push(c);
        });
      });
    } else if (type === 'epic') {
      allCards.forEach(function (c) {
        if ((c.frontmatter || {}).type === 'story' && isRelatedChild(rootCard, c)) result.push(c);
      });
    }
    return result;
  }

  function hasClosedAncestor(card, storeGet) {
    if (!card || typeof storeGet !== 'function') return false;
    var seen = {};
    var cursor = card;
    var safety = 16;
    while (cursor && safety-- > 0) {
      var parentFn = cursor.frontmatter && cursor.frontmatter.parent;
      if (!parentFn || seen[parentFn]) break;
      seen[parentFn] = true;
      var parent = storeGet(parentFn);
      if (!parent) break;
      if (isClosedStatus(parent.frontmatter && parent.frontmatter.status)) return true;
      cursor = parent;
    }
    return false;
  }

  function cardHiddenByClosed(card, storeGet) {
    if (!card) return false;
    if (isClosedStatus(card.frontmatter && card.frontmatter.status)) return true;
    return hasClosedAncestor(card, storeGet);
  }

  function pruneClosedHierarchy(hierarchy) {
    hierarchy = hierarchy || {};
    function keepEpic(en) {
      if (isClosedStatus(en.card && en.card.frontmatter && en.card.frontmatter.status)) return null;
      return {
        card: en.card,
        children: (en.children || []).filter(function (s) {
          return !isClosedStatus((s.frontmatter || s).status);
        })
      };
    }
    return {
      tree: (hierarchy.tree || []).filter(function (n) {
        return !isClosedStatus(n.card && n.card.frontmatter && n.card.frontmatter.status);
      }).map(function (n) {
        return {
          card: n.card,
          children: (n.children || []).map(keepEpic).filter(Boolean)
        };
      }),
      orphanEpics: (hierarchy.orphanEpics || []).map(keepEpic).filter(Boolean),
      orphanStories: (hierarchy.orphanStories || []).filter(function (s) {
        return !isClosedStatus((s.frontmatter || s).status);
      }),
      intakes: hierarchy.intakes,
      checkpoints: hierarchy.checkpoints,
      decisions: hierarchy.decisions,
      releaseNotes: hierarchy.releaseNotes,
      pinned: hierarchy.pinned,
      recents: hierarchy.recents
    };
  }

  function summarizeDescendants(descendants) {
    var epics = 0;
    var stories = 0;
    (descendants || []).forEach(function (c) {
      var t = (c.frontmatter || {}).type;
      if (t === 'epic') epics++;
      else if (t === 'story') stories++;
    });
    return { epics: epics, stories: stories };
  }

  return {
    createPinStore: createPinStore,
    rankSearchResults: rankSearchResults,
    excludePinnedFromRecents: excludePinnedFromRecents,
    buildBreadcrumb: buildBreadcrumb,
    cardMatchesStatusFilters: cardMatchesStatusFilters,
    SHARED_LIFECYCLE: SHARED_LIFECYCLE,
    isClosedStatus: isClosedStatus,
    isTerminalStatus: isTerminalStatus,
    isRelatedChild: isRelatedChild,
    collectDescendants: collectDescendants,
    hasClosedAncestor: hasClosedAncestor,
    cardHiddenByClosed: cardHiddenByClosed,
    pruneClosedHierarchy: pruneClosedHierarchy,
    summarizeDescendants: summarizeDescendants
  };
});
