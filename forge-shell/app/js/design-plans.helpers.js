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
