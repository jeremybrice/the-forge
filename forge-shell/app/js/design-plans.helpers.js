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
    var re = new RegExp('^\\*\\*' + key + ':?\\*\\*:?\\s*(.+)$', 'i');
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

  var DEFAULT_CLUSTERS = [
    'orson', 'cron', 'sf-ums', 'jira-intake', 'memory', 'docs', 'audio',
    'repo', 'pfl', 'sidebar', 'roadmap', 'report', 'agent'
  ];

  var STATUS_RULES = [
    { bucket: 'Rolled Back', test: /roll(?:ed)?\s*back/i },
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
    var s = String(slug || '').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (s.indexOf(list[i]) !== -1) return list[i];
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

  return {
    classifyType: classifyType,
    parseFilename: parseFilename,
    parseDocMeta: parseDocMeta,
    normalizeStatus: normalizeStatus,
    inferTopic: inferTopic,
    planProgress: planProgress,
    DEFAULT_CLUSTERS: DEFAULT_CLUSTERS
  };
});
