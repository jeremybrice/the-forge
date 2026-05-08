/* ═══════════════════════════════════════════════════════════════
   Audio Forge — Pure helpers (UMD-style)
   Importable as a <script> (window.AudioForgeHelpers) or via Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AudioForgeHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function formatDuration(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${m}:${ss}`;
  }

  function formatTimestamp(rfc3339) {
    if (!rfc3339 || typeof rfc3339 !== 'string') return '';
    const d = new Date(rfc3339);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mn = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mn}`;
  }

  function deriveTitle(rfc3339) {
    const ts = formatTimestamp(rfc3339) || formatTimestamp(new Date().toISOString());
    return `Recording ${ts}`;
  }

  /**
   * Minimal YAML frontmatter parser. Handles:
   *   - simple scalars (string, integer, boolean)
   *   - quoted strings (preserved as strings)
   *   - flat lists (- item)
   *   - nested single-level maps (audio_files: { system: ..., mic: ... } via indented keys)
   * Does NOT handle: anchors, aliases, multi-line strings, deeply nested structures.
   * That's intentional — recording frontmatter is shallow and known-shaped.
   */
  function parseFrontmatter(text) {
    if (typeof text !== 'string') return { frontmatter: {}, body: '' };
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { frontmatter: {}, body: text };
    const yaml = m[1];
    const body = m[2] || '';
    const fm = {};
    const lines = yaml.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      const topLevel = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!topLevel) { i++; continue; }
      const key = topLevel[1];
      const rest = topLevel[2];
      if (rest === '') {
        // Could be a list or a nested map — peek at next line.
        const nextLines = [];
        i++;
        while (i < lines.length && /^( {2,}|\t)/.test(lines[i])) {
          nextLines.push(lines[i]);
          i++;
        }
        if (nextLines.length === 0) { fm[key] = null; continue; }
        const isList = nextLines.every(l => /^\s+-\s+/.test(l));
        if (isList) {
          fm[key] = nextLines.map(l => l.replace(/^\s+-\s+/, '').trim()).map(unquote);
        } else {
          const obj = {};
          for (const sub of nextLines) {
            const sm = sub.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
            if (sm) obj[sm[1]] = coerce(sm[2]);
          }
          fm[key] = obj;
        }
      } else {
        fm[key] = coerce(rest);
        i++;
      }
    }
    return { frontmatter: fm, body };
  }

  function coerce(raw) {
    const v = raw.trim();
    if (v === '') return '';
    // Quoted string: keep as string, strip quotes.
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
    return v;
  }

  function unquote(v) {
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function statusBadge(status) {
    // forge-lib writes 'complete' on success; 'transcribed' is treated as a
    // synonym for backwards compatibility.
    switch (status) {
      case 'complete':
      case 'transcribed':
        return { label: 'transcribed', icon: 'fa-circle-check', cls: 'af-status-ok' };
      case 'failed':
        return { label: 'failed', icon: 'fa-triangle-exclamation', cls: 'af-status-failed' };
      case 'transcribing':
        return { label: 'transcribing', icon: 'fa-hourglass-half', cls: 'af-status-progress' };
      case 'pending':
      default:
        return { label: 'pending', icon: 'fa-circle-pause', cls: 'af-status-pending' };
    }
  }

  return {
    formatDuration,
    formatTimestamp,
    deriveTitle,
    parseFrontmatter,
    statusBadge,
  };
});
