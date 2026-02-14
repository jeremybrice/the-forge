/* ═══════════════════════════════════════════════════════════════
   ForgeUtils — Shared Utility Layer
   ═══════════════════════════════════════════════════════════════ */
window.ForgeUtils = {};

/* ═══════════════════════════════════════════════════════════════
   YAML — Lightweight frontmatter parser & stringifier
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.YAML = {
  parse(str) {
    if (!str || !str.trim()) return {};
    const result = {};
    const lines = str.split('\n');
    let currentKey = null;
    let inArray = false;
    let inObjectArray = false;
    let currentObj = null;
    let currentObjKey = null;
    let inNestedArray = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      /* ── Nested array inside an object item (6-space or deeper indent) ── */
      if (inNestedArray && currentObj && currentObjKey) {
        const nestedMatch = line.match(/^(\s{6,})- (.+)$/);
        if (nestedMatch) {
          currentObj[currentObjKey].push(this._parseValue(nestedMatch[2].trim()));
          continue;
        }
        inNestedArray = false;
      }

      /* ── Object property lines (4-space indent, not a list item) ── */
      if (inObjectArray && currentObj && /^    [a-zA-Z_]/.test(line) && !line.match(/^\s+- /)) {
        const objColonIdx = trimmed.indexOf(':');
        if (objColonIdx > 0) {
          const objKey = trimmed.substring(0, objColonIdx).trim();
          const objVal = trimmed.substring(objColonIdx + 1).trim();
          currentObjKey = objKey;
          if (objVal === '' || objVal === '~') {
            /* Check if next lines are a nested array */
            let next = i + 1;
            while (next < lines.length && lines[next].trim() === '') next++;
            if (next < lines.length && /^\s{6,}- /.test(lines[next])) {
              currentObj[objKey] = [];
              inNestedArray = true;
            } else {
              currentObj[objKey] = null;
            }
          } else if (objVal === '[]') {
            currentObj[objKey] = [];
          } else {
            currentObj[objKey] = this._parseValue(objVal);
          }
          continue;
        }
      }

      /* ── Array item line (2-space indent) ── */
      if (/^\s{2}- /.test(line) && inArray && currentKey) {
        const afterDash = trimmed.substring(2).trim();
        /* Check if this is an object item (has key: value) */
        const kvMatch = afterDash.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
        if (kvMatch) {
          /* Start a new object in the array */
          currentObj = {};
          const firstKey = kvMatch[1];
          const firstVal = kvMatch[2].trim();
          currentObj[firstKey] = firstVal === '' ? null : this._parseValue(firstVal);
          currentObjKey = firstKey;
          result[currentKey].push(currentObj);
          inObjectArray = true;
          inNestedArray = false;
          continue;
        }
        /* Simple scalar array item */
        currentObj = null;
        inObjectArray = false;
        inNestedArray = false;
        result[currentKey].push(this._parseValue(afterDash));
        continue;
      }

      /* ── Exit array on de-indented line ── */
      if (inArray && !/^\s/.test(line)) {
        inArray = false;
        inObjectArray = false;
        currentObj = null;
        inNestedArray = false;
      }

      /* ── Top-level key: value ── */
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && /^[a-zA-Z_]/.test(line)) {
        const key = line.substring(0, colonIdx).trim();
        let value = line.substring(colonIdx + 1).trim();
        currentKey = key;
        currentObj = null;
        inObjectArray = false;
        inNestedArray = false;

        if (value === '' || value === '~') {
          let next = i + 1;
          while (next < lines.length && lines[next].trim() === '') next++;
          if (next < lines.length && /^\s+- /.test(lines[next])) {
            result[key] = [];
            inArray = true;
          } else {
            result[key] = null;
            inArray = false;
          }
        } else if (value === '[]') {
          result[key] = [];
          inArray = false;
        } else {
          result[key] = this._parseValue(value);
          inArray = false;
        }
      }
    }
    return result;
  },

  _parseValue(v) {
    if (!v.startsWith('"') && !v.startsWith("'")) {
      const ci = v.indexOf(' #');
      if (ci > 0) v = v.substring(0, ci).trim();
    }
    if (v === 'null' || v === '~') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      return v.slice(1, -1);
    if (v.startsWith('[') && v.endsWith(']')) {
      const inner = v.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(x => this._parseValue(x.trim()));
    }
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return v;
  },

  _needsQuote(key, s) {
    const quotedFields = new Set(['title', 'description', 'stakeholders', 'version', 'name']);
    return quotedFields.has(key) || s.includes(': ') || s.includes(' #') || s === '';
  },

  _quoteString(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  },

  stringify(obj, fieldOrder) {
    const order = fieldOrder || Object.keys(obj);
    const lines = [];
    const written = new Set();

    const writePair = (key, value) => {
      written.add(key);
      if (value === null || value === undefined) {
        lines.push(`${key}: null`);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
        } else if (typeof value[0] === 'object' && value[0] !== null) {
          /* Array of objects */
          lines.push(`${key}:`);
          value.forEach(item => {
            const keys = Object.keys(item);
            keys.forEach((k, idx) => {
              const v = item[k];
              const prefix = idx === 0 ? '  - ' : '    ';
              if (v === null || v === undefined) {
                lines.push(`${prefix}${k}: null`);
              } else if (Array.isArray(v)) {
                if (v.length === 0) {
                  lines.push(`${prefix}${k}: []`);
                } else {
                  lines.push(`${prefix}${k}:`);
                  v.forEach(sub => lines.push(`      - ${sub}`));
                }
              } else {
                const s = String(v);
                if (this._needsQuote(k, s)) {
                  lines.push(`${prefix}${k}: ${this._quoteString(s)}`);
                } else {
                  lines.push(`${prefix}${k}: ${s}`);
                }
              }
            });
          });
        } else {
          lines.push(`${key}:`);
          value.forEach(item => lines.push(`  - ${item}`));
        }
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      } else {
        const s = String(value);
        if (this._needsQuote(key, s)) {
          lines.push(`${key}: ${this._quoteString(s)}`);
        } else {
          lines.push(`${key}: ${s}`);
        }
      }
    };

    for (const key of order) {
      if (key in obj) writePair(key, obj[key]);
    }
    for (const key of Object.keys(obj)) {
      if (!written.has(key)) writePair(key, obj[key]);
    }
    return lines.join('\n');
  }
};

/* ═══════════════════════════════════════════════════════════════
   MD — Markdown-to-HTML Renderer
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.MD = {
  render(src) {
    if (!src) return '';
    const lines = src.split('\n');
    const blocks = this._parseBlocks(lines);
    return blocks.map(b => this._renderBlock(b)).join('\n');
  },

  _parseBlocks(lines) {
    const blocks = [];
    let cur = null;
    const push = () => { if (cur) { blocks.push(cur); cur = null; } };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (cur && cur.type === 'code') {
        if (line.trim().startsWith('```')) { push(); }
        else cur.lines.push(line);
        continue;
      }

      if (line.trim().startsWith('```')) {
        push();
        cur = { type: 'code', lang: line.trim().slice(3).trim(), lines: [] };
        continue;
      }

      const hm = line.match(/^(#{1,6})\s+(.+)$/);
      if (hm) { push(); blocks.push({ type: 'heading', level: hm[1].length, text: hm[2] }); continue; }

      if (/^(\s*[-*_]){3,}\s*$/.test(line)) { push(); blocks.push({ type: 'hr' }); continue; }

      const bq = line.match(/^>\s?(.*)$/);
      if (bq) {
        if (!cur || cur.type !== 'blockquote') { push(); cur = { type: 'blockquote', lines: [] }; }
        cur.lines.push(bq[1]);
        continue;
      }

      const ul = line.match(/^(\s*)([-*+])\s+(.+)$/);
      if (ul) {
        if (!cur || cur.type !== 'ul') { push(); cur = { type: 'ul', items: [] }; }
        cur.items.push(ul[3]);
        continue;
      }

      const ol = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (ol) {
        if (!cur || cur.type !== 'ol') { push(); cur = { type: 'ol', items: [] }; }
        cur.items.push(ol[3]);
        continue;
      }

      if (!line.trim()) { push(); continue; }

      if (!cur || cur.type !== 'paragraph') { push(); cur = { type: 'paragraph', lines: [] }; }
      cur.lines.push(line);
    }
    push();
    return blocks;
  },

  _renderBlock(b) {
    switch (b.type) {
      case 'heading': return `<h${b.level}>${this._inline(b.text)}</h${b.level}>`;
      case 'paragraph': return `<p>${b.lines.map(l => this._inline(l)).join(' ')}</p>`;
      case 'ul': return `<ul>${b.items.map(i => `<li>${this._inline(i)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${b.items.map(i => `<li>${this._inline(i)}</li>`).join('')}</ol>`;
      case 'hr': return '<hr>';
      case 'blockquote': return `<blockquote>${b.lines.map(l => `<p>${this._inline(l)}</p>`).join('')}</blockquote>`;
      case 'code': {
        const esc = b.lines.join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<pre><code>${esc}</code></pre>`;
      }
      default: return '';
    }
  },

  _inline(t) {
    t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
    t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    t = t.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
    t = t.replace(/`(.+?)`/g, '<code>$1</code>');
    t = t.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return t;
  }
};

/* ═══════════════════════════════════════════════════════════════
   Diff — Line-diff for edit previews
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Diff = {
  compute(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');
    const m = oldLines.length, n = newLines.length;

    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);

    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) {
        result.unshift({ type: 'same', text: oldLines[i-1] }); i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        result.unshift({ type: 'added', text: newLines[j-1] }); j--;
      } else {
        result.unshift({ type: 'removed', text: oldLines[i-1] }); i--;
      }
    }
    return result;
  }
};

/* ═══════════════════════════════════════════════════════════════
   DB — Single IndexedDB for the unified shell
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.DB = {
  _db: null,
  _dbName: 'ForgeShellUnified',
  _storeName: 'handles',

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this._storeName);
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  async save(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      tx.objectStore(this._storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readonly');
      const req = tx.objectStore(this._storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      tx.objectStore(this._storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   FS — File System Access API Helpers (Dual-Mode with ForgeFS)
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.FS = {
  /**
   * Prompt user to select a directory
   * Delegates to ForgeFS adapter for dual-mode support
   */
  async pickDirectory(mode) {
    return await ForgeFS.pickDirectory();
  },

  /**
   * Request permission for a handle (browser mode only)
   * In Tauri mode, permissions are handled at OS level
   */
  async requestPermission(handle, mode) {
    if (ForgeFS.isTauri()) {
      return true; // Tauri handles permissions via OS
    }

    const opts = { mode: mode || 'readwrite' };
    if (await handle.queryPermission(opts) === 'granted') return true;
    if (await handle.requestPermission(opts) === 'granted') return true;
    return false;
  },

  /**
   * Get a subdirectory
   * Works with both FileSystemDirectoryHandle (browser) and path strings (Tauri)
   */
  async getSubDir(parentHandle, name) {
    try {
      if (ForgeFS.isTauri()) {
        // In Tauri mode, parentHandle is a path string
        const subPath = typeof parentHandle === 'string'
          ? `${parentHandle}/${name}`
          : name;

        // Check if directory exists by trying to read it
        const entries = await ForgeFS.readDir(parentHandle, name);
        return subPath; // Return path string
      } else {
        // Browser mode: use File System Access API
        return await parentHandle.getDirectoryHandle(name, { create: false });
      }
    } catch {
      return null;
    }
  },

  /**
   * Get a file from a directory
   * Returns {handle/path, file, text, lastModified}
   */
  async getFile(dirHandle, name) {
    try {
      if (ForgeFS.isTauri()) {
        // In Tauri mode, dirHandle is a path string
        const text = await ForgeFS.readFile(dirHandle, name);
        const meta = await ForgeFS.getFileMeta(dirHandle, name);

        return {
          handle: `${dirHandle}/${name}`, // Return path for Tauri
          file: null,
          text: text,
          lastModified: meta.modified
        };
      } else {
        // Browser mode
        const fh = await dirHandle.getFileHandle(name);
        const file = await fh.getFile();
        return {
          handle: fh,
          file,
          text: await file.text(),
          lastModified: file.lastModified
        };
      }
    } catch {
      return null;
    }
  },

  /**
   * Read all markdown files in a directory
   * Returns array of {name, handle/path, text, lastModified}
   */
  async readAllMd(dirHandle, relativePath = '') {
    const files = [];

    try {
      if (ForgeFS.isTauri()) {
        // Tauri mode: use listMarkdownFiles
        const mdFiles = await ForgeFS.listMarkdownFiles(dirHandle, relativePath);

        // Read content for each file
        for (const fileInfo of mdFiles) {
          try {
            const text = await ForgeFS.readFile(dirHandle, fileInfo.path);
            files.push({
              name: fileInfo.name,
              handle: fileInfo.path, // Path string in Tauri mode
              text: text,
              lastModified: fileInfo.modified
            });
          } catch (e) {
            console.warn(`Failed to read ${fileInfo.name}:`, e);
          }
        }
      } else {
        // Browser mode: iterate through directory
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
              const file = await entry.getFile();
              files.push({
                name: entry.name,
                handle: entry,
                text: await file.text(),
                lastModified: file.lastModified
              });
            } catch (e) {
              console.warn(`Failed to read ${entry.name}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to enumerate directory:', e);
    }

    return files;
  },

  /**
   * Write content to a file
   * Works with both FileSystemFileHandle (browser) and path strings (Tauri)
   */
  async writeFile(fileHandle, content) {
    if (ForgeFS.isTauri()) {
      // In Tauri mode, fileHandle is a path string
      // We need to extract the root and relative path
      // This is a bit tricky, so we'll use a helper
      await ForgeFS.writeFile(null, fileHandle, content);
    } else {
      // Browser mode
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    }
  },

  /**
   * Check if a directory exists
   */
  async dirExists(parentHandle, name) {
    try {
      if (ForgeFS.isTauri()) {
        // Try to read the directory
        await ForgeFS.readDir(parentHandle, name);
        return true;
      } else {
        // Browser mode
        await parentHandle.getDirectoryHandle(name, { create: false });
        return true;
      }
    } catch {
      return false;
    }
  }
};

/* ═══════════════════════════════════════════════════════════════
   Theme — Apply, toggle, get
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Theme = {
  _key: 'forge-shell-theme',

  get() {
    return localStorage.getItem(this._key) || 'light';
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this._key, theme);
  },

  toggle() {
    const current = this.get();
    const next = current === 'light' ? 'dark' : 'light';
    this.apply(next);
    return next;
  },

  init() {
    this.apply(this.get());
  }
};

/* ═══════════════════════════════════════════════════════════════
   Toast — Toast notification manager
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Toast = {
  show(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};

/* ═══════════════════════════════════════════════════════════════
   Confirm — Promise-based confirm dialog
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Confirm = {
  _resolve: null,

  show(title, message, details) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-details').innerHTML = details || '';
    document.getElementById('confirm-dialog').classList.add('visible');
    return new Promise(r => { this._resolve = r; });
  },

  resolve(val) {
    document.getElementById('confirm-dialog').classList.remove('visible');
    if (this._resolve) { this._resolve(val); this._resolve = null; }
  }
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.escapeHTML = function(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

ForgeUtils.todayISO = function() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};

ForgeUtils.parseFrontmatter = function(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  try {
    return { frontmatter: ForgeUtils.YAML.parse(match[1]), body: (match[2] || '').trim() };
  } catch {
    return null;
  }
};

/**
 * Read and parse index.json file from a directory
 * @param {FileSystemDirectoryHandle|string} dirHandle - Directory handle (browser) or path (Tauri)
 * @param {string} subPath - Optional subdirectory path (e.g., 'cards', 'tasks')
 * @returns {Promise<Array>} Array of index entries, or empty array if not found
 */
ForgeUtils.readIndex = async function(dirHandle, subPath = '') {
  try {
    const indexPath = subPath ? `${subPath}/index.json` : 'index.json';

    if (ForgeFS.isTauri()) {
      // Tauri mode: read file directly
      const content = await ForgeFS.readFile(dirHandle, indexPath);
      return JSON.parse(content);
    } else {
      // Browser mode: get subdirectory first if needed, then read file
      let targetDir = dirHandle;
      if (subPath) {
        targetDir = await dirHandle.getDirectoryHandle(subPath, { create: false });
      }
      const fileHandle = await targetDir.getFileHandle('index.json', { create: false });
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`index.json not found in ${subPath || 'root'}:`, e);
    return [];
  }
};
