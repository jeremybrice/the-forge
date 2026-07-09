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

  return {
    createPinStore: createPinStore,
    rankSearchResults: rankSearchResults,
    excludePinnedFromRecents: excludePinnedFromRecents,
    buildBreadcrumb: buildBreadcrumb,
    cardMatchesStatusFilters: cardMatchesStatusFilters
  };
});
