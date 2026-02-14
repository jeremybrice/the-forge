/* ═══════════════════════════════════════════════════════════════
   Memory View Controller
   Memory browser inside #view-memory.
   Uses ForgeUtils.FS for file access, ForgeUtils.Toast for
   notifications, and a local modal for memory editing.
   ═══════════════════════════════════════════════════════════════ */

window.MemoryView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ══════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════ */
  let rootHandle = null;
  let initialized = false;

  /* Memory state */
  let memoryDirHandle = null;     // same as rootHandle
  let memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
  let memoryWatchInterval = null;
  let memorySignature = '';
  let isMemoryRefreshing = false;
  let activeMemoryTab = null;

  /* ══════════════════════════════════════════════════════════
     DOM helpers — all queries scoped to #view-memory
     ══════════════════════════════════════════════════════════ */
  function $(sel) {
    return document.querySelector('#view-memory ' + sel);
  }

  function $$(sel) {
    return document.querySelectorAll('#view-memory ' + sel);
  }

  /* ══════════════════════════════════════════════════════════
     Status Bar (local toast-style within view)
     ══════════════════════════════════════════════════════════ */
  function showStatus(msg) {
    var el = $('[data-ref="status-bar"]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('prod-visible');
    setTimeout(function () { el.classList.remove('prod-visible'); }, 2000);
  }

  /* ══════════════════════════════════════════════════════════
     Scaffold — build initial DOM inside #view-memory
     ══════════════════════════════════════════════════════════ */
  function scaffold() {
    var view = document.getElementById('view-memory');
    view.innerHTML =
      '<div class="prod-layout">' +
        /* Toolbar */
        '<div class="plugin-toolbar">' +
          '<span class="toolbar-title"><i class="fa-solid fa-brain"></i> Memory</span>' +
          '<div class="folder-path hidden" data-ref="folder-path">' +
            '<i class="fa-solid fa-folder-open"></i>' +
            '<span data-ref="folder-name"></span>' +
          '</div>' +
          '<span class="spacer"></span>' +
          '<span class="refresh-indicator" data-ref="refresh-indicator"></span>' +
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Memory Panel */
        '<div class="prod-tab-panel prod-active" data-ref="memory-panel">' +
          '<div data-ref="memory-empty" class="prod-not-active">' +
            '<div class="prod-state-icon"><i class="fa-solid fa-brain"></i></div>' +
            '<h2>No Memory Found</h2>' +
            '<p>No <code>memory/</code> directory or <code>CLAUDE.md</code> found in the current project. ' +
            'Run <code>/productivity:setup-org</code> to initialize.</p>' +
          '</div>' +
          '<div data-ref="memory-main" style="display:none;flex-direction:column;min-height:0;flex:1;">' +
            '<div class="prod-memory-tabs" data-ref="memory-tabs"></div>' +
            '<div class="prod-memory-content-area">' +
              '<div data-ref="memory-content"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Local Modal */
        '<div class="prod-modal-overlay" data-ref="modal-overlay">' +
          '<div class="prod-modal-content">' +
            '<div class="prod-modal-header">' +
              '<h3 data-ref="modal-title">Edit</h3>' +
              '<button class="prod-modal-close" data-action="modal-close">&times;</button>' +
            '</div>' +
            '<div class="prod-modal-body" data-ref="modal-body"></div>' +
            '<div class="prod-modal-footer">' +
              '<button data-action="modal-cancel">Cancel</button>' +
              '<button class="primary" data-action="modal-save">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Status bar */
        '<div class="prod-status-bar" data-ref="status-bar"></div>' +
      '</div>';

    bindToolbarEvents();
  }

  /* ══════════════════════════════════════════════════════════
     Event Binding
     ══════════════════════════════════════════════════════════ */
  function bindToolbarEvents() {
    var view = document.getElementById('view-memory');

    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      if (action === 'refresh') handleRefresh();
      else if (action === 'modal-close' || action === 'modal-cancel') closeModal();
      else if (action === 'modal-save') saveModal();
    });

    /* Modal overlay click-outside */
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    /* Escape to close modal */
    view.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function updateFolderBadge() {
    var pathEl = $('[data-ref="folder-path"]');
    var nameEl = $('[data-ref="folder-name"]');
    if (memoryDirHandle) {
      // Handle both FileSystemDirectoryHandle (browser) and path string (Tauri)
      nameEl.textContent = rootHandle
        ? (typeof rootHandle === 'string'
            ? rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle
            : rootHandle.name)
        : '';
      pathEl.classList.remove('hidden');
    } else {
      pathEl.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════════════════════
     Refresh Handler
     ══════════════════════════════════════════════════════════ */
  async function handleRefresh() {
    await checkForMemoryChanges();
    showStatus('Memory refreshed');
    var indicator = $('[data-ref="refresh-indicator"]');
    if (indicator) {
      var now = new Date();
      indicator.textContent = 'Refreshed · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Markdown parsing helpers
     ══════════════════════════════════════════════════════════ */
  function parseMemoryMarkdown(content) {
    var parsed = {
      title: '',
      fields: {},
      sections: {},
      tables: [],
      rawContent: content
    };
    var lines = content.split('\n');
    var currentSection = '_intro';
    parsed.sections[currentSection] = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^# /.test(line)) { parsed.title = line.replace(/^# /, '').trim(); continue; }
      if (/^## /.test(line)) { currentSection = line.replace(/^## /, '').trim(); parsed.sections[currentSection] = []; continue; }
      var kvMatch = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
      if (kvMatch) { parsed.fields[kvMatch[1]] = kvMatch[2]; continue; }
      parsed.sections[currentSection].push(line);
    }

    for (var key in parsed.sections) {
      parsed.sections[key] = parsed.sections[key].join('\n').trim();
    }

    var tableRegex = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g;
    var match;
    while ((match = tableRegex.exec(content)) !== null) {
      var headers = match[1].split('|').map(function (h) { return h.trim(); }).filter(Boolean);
      var rowLines = match[2].trim().split('\n');
      var rows = rowLines.map(function (row) { return row.split('|').map(function (c) { return c.trim(); }).filter(Boolean); });
      parsed.tables.push({ headers: headers, rows: rows });
    }

    return parsed;
  }

  function getPreview(content, maxLen) {
    maxLen = maxLen || 150;
    var preview = content
      .replace(/^#+ .+$/gm, '')
      .replace(/\*\*(.+?):\*\*.*/g, '')
      .replace(/\|.+\|/g, '')
      .replace(/[-=]{3,}/g, '')
      .trim()
      .substring(0, maxLen);
    if (content.length > maxLen) preview += '...';
    return preview;
  }

  function getDisplayName(filename) {
    return filename.replace('.md', '').split(/[-_]/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function hasStructuredContent(parsed) {
    return Object.keys(parsed.fields).length > 0
      || parsed.tables.length > 0
      || Object.entries(parsed.sections).some(function (pair) {
          return pair[0] !== '_intro' && pair[1] && pair[1].trim();
        });
  }

  function renderMarkdownToHtml(md) {
    var html = esc(md);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/```[\s\S]*?```/g, function (m) {
      var code = m.replace(/```\w*\n?/g, '');
      return '<pre><code>' + code + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/(\|.+\|\n\|[-| ]+\|\n(?:\|.+\|\n?)+)/g, function (m) {
      var lines = m.trim().split('\n');
      var headers = lines[0].split('|').filter(function (c) { return c.trim(); });
      var rows = lines.slice(2).map(function (row) { return row.split('|').filter(function (c) { return c.trim(); }); });
      var table = '<table><thead><tr>';
      headers.forEach(function (h) { table += '<th>' + h.trim() + '</th>'; });
      table += '</tr></thead><tbody>';
      rows.forEach(function (row) {
        table += '<tr>';
        row.forEach(function (cell) { table += '<td>' + cell.trim() + '</td>'; });
        table += '</tr>';
      });
      table += '</tbody></table>';
      return table;
    });
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^(?!<[hupol]|<li|<table|<pre)(.+)$/gm, '<p>$1</p>');
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Loading
     Uses ForgeFS abstraction for dual-mode (browser/Tauri) support
     ══════════════════════════════════════════════════════════ */
  async function loadMemory() {
    memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };

    /* Try loading CLAUDE.md */
    try {
      var claudeContent = await ForgeFS.readFile(memoryDirHandle, 'CLAUDE.md');
      var claudeHandle = typeof memoryDirHandle === 'string'
        ? memoryDirHandle + '/CLAUDE.md'
        : 'CLAUDE.md';
      memoryData.claudeMd = { content: claudeContent, fileHandle: claudeHandle };
    } catch (e) { /* no CLAUDE.md */ }

    /* Try loading memory/ directory */
    try {
      var entries = await ForgeFS.readDir(memoryDirHandle, 'memory');

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];

        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          try {
            var content = await ForgeFS.readFile(memoryDirHandle, 'memory/' + entry.name);
            var fileHandle = typeof memoryDirHandle === 'string'
              ? memoryDirHandle + '/memory/' + entry.name
              : 'memory/' + entry.name;

            memoryData.memoryFiles.push({
              name: entry.name,
              content: content,
              fileHandle: fileHandle
            });
          } catch (e) { /* skip */ }

        } else if (entry.kind === 'directory') {
          memoryData.memoryDirs[entry.name] = [];

          try {
            var subEntries = await ForgeFS.readDir(memoryDirHandle, 'memory/' + entry.name);

            for (var j = 0; j < subEntries.length; j++) {
              var subEntry = subEntries[j];

              if (subEntry.kind === 'file' && subEntry.name.endsWith('.md')) {
                try {
                  var subContent = await ForgeFS.readFile(memoryDirHandle, 'memory/' + entry.name + '/' + subEntry.name);
                  var subFileHandle = typeof memoryDirHandle === 'string'
                    ? memoryDirHandle + '/memory/' + entry.name + '/' + subEntry.name
                    : 'memory/' + entry.name + '/' + subEntry.name;
                  var subDirHandle = typeof memoryDirHandle === 'string'
                    ? memoryDirHandle + '/memory/' + entry.name
                    : 'memory/' + entry.name;

                  memoryData.memoryDirs[entry.name].push({
                    name: subEntry.name,
                    content: subContent,
                    fileHandle: subFileHandle,
                    dirHandle: subDirHandle,
                    parsed: parseMemoryMarkdown(subContent)
                  });
                } catch (e) { /* skip */ }
              }
            }
          } catch (e) { /* skip subdirectory */ }
        }
      }
    } catch (e) { /* no memory/ directory */ }

    var hasAny = memoryData.claudeMd || memoryData.memoryFiles.length > 0 || Object.keys(memoryData.memoryDirs).length > 0;

    var emptyEl = $('[data-ref="memory-empty"]');
    var mainEl = $('[data-ref="memory-main"]');
    if (hasAny) {
      if (emptyEl) emptyEl.style.display = 'none';
      if (mainEl) mainEl.style.display = 'flex';
      renderMemoryTabs();
      renderMemoryContent();
      memorySignature = await buildMemorySignature();
      startMemoryWatching();
    } else {
      if (emptyEl) emptyEl.style.display = '';
      if (mainEl) mainEl.style.display = 'none';
    }
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Watching
     Uses ForgeFS abstraction for dual-mode (browser/Tauri) support
     ══════════════════════════════════════════════════════════ */
  async function buildMemorySignature() {
    var entries = [];

    if (memoryData.claudeMd) {
      try {
        var meta = await ForgeFS.getFileMeta(memoryDirHandle, 'CLAUDE.md');
        entries.push('CLAUDE.md:' + meta.modified);
      } catch (e) { /* skip */ }
    }

    for (var i = 0; i < memoryData.memoryFiles.length; i++) {
      var mf = memoryData.memoryFiles[i];
      try {
        var meta2 = await ForgeFS.getFileMeta(memoryDirHandle, 'memory/' + mf.name);
        entries.push('memory/' + mf.name + ':' + meta2.modified);
      } catch (e) { /* skip */ }
    }

    var dirNames = Object.keys(memoryData.memoryDirs).sort();
    for (var di = 0; di < dirNames.length; di++) {
      var dirName = dirNames[di];
      var files = memoryData.memoryDirs[dirName];
      for (var j = 0; j < files.length; j++) {
        try {
          var meta3 = await ForgeFS.getFileMeta(memoryDirHandle, 'memory/' + dirName + '/' + files[j].name);
          entries.push('memory/' + dirName + '/' + files[j].name + ':' + meta3.modified);
        } catch (e) { /* skip */ }
      }
    }

    entries.sort();
    return entries.join('|');
  }

  async function checkForMemoryChanges() {
    if (!memoryDirHandle || isMemoryRefreshing) return;
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay && overlay.classList.contains('prod-visible')) return;

    isMemoryRefreshing = true;
    try {
      var newSignature = await buildMemorySignature();

      if (newSignature !== memorySignature) {
        memorySignature = newSignature;
        var savedTabId = activeMemoryTab;
        var searchInput = $('[data-ref="memory-search"]');
        var savedSearch = searchInput ? searchInput.value : '';

        await loadMemory();

        /* Restore active tab */
        if (savedTabId) {
          var tabs = $$('.prod-memory-tab');
          tabs.forEach(function (t) { t.classList.remove('prod-active'); });
          var tabToRestore = $('[data-mem-tab="' + savedTabId + '"]');
          if (tabToRestore) {
            tabToRestore.classList.add('prod-active');
            activeMemoryTab = savedTabId;
            renderMemoryContent();
          }
        }

        /* Restore search */
        var newSearchInput = $('[data-ref="memory-search"]');
        if (newSearchInput && savedSearch) {
          newSearchInput.value = savedSearch;
          filterMemoryContent(savedSearch);
        }

        // Toast removed - only manual refresh shows toast
      }
    } catch (e) {
      console.warn('Memory refresh error:', e);
    } finally {
      isMemoryRefreshing = false;
    }
  }

  function startMemoryWatching() {
    stopMemoryWatching();
    memoryWatchInterval = setInterval(checkForMemoryChanges, 5000);
  }

  function stopMemoryWatching() {
    if (memoryWatchInterval) { clearInterval(memoryWatchInterval); memoryWatchInterval = null; }
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Render Tabs
     ══════════════════════════════════════════════════════════ */
  function renderMemoryTabs() {
    var tabsEl = $('[data-ref="memory-tabs"]');
    if (!tabsEl) return;
    var html = '';

    if (memoryData.claudeMd) {
      var isActive = !activeMemoryTab || activeMemoryTab === 'overview';
      html += '<button class="prod-memory-tab' + (isActive ? ' prod-active' : '') + '" data-mem-tab="overview">Overview</button>';
      if (isActive) activeMemoryTab = 'overview';
    }

    for (var i = 0; i < memoryData.memoryFiles.length; i++) {
      var name = memoryData.memoryFiles[i].name.replace('.md', '');
      var isFirst = !memoryData.claudeMd && i === 0 && !activeMemoryTab;
      var isAct = activeMemoryTab === 'file-' + name || isFirst;
      html += '<button class="prod-memory-tab' + (isAct ? ' prod-active' : '') + '" data-mem-tab="file-' + esc(name) + '">' + esc(name) + '</button>';
      if (isAct && !activeMemoryTab) activeMemoryTab = 'file-' + name;
    }

    var dirNames = Object.keys(memoryData.memoryDirs).sort();
    for (var j = 0; j < dirNames.length; j++) {
      var dn = dirNames[j];
      var count = memoryData.memoryDirs[dn].length;
      var isAct2 = activeMemoryTab === 'dir-' + dn;
      html += '<button class="prod-memory-tab' + (isAct2 ? ' prod-active' : '') + '" data-mem-tab="dir-' + esc(dn) + '">' + esc(dn) + ' <span class="prod-tab-count">' + count + '</span></button>';
    }

    tabsEl.innerHTML = html;

    tabsEl.querySelectorAll('.prod-memory-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabsEl.querySelectorAll('.prod-memory-tab').forEach(function (t) { t.classList.remove('prod-active'); });
        tab.classList.add('prod-active');
        activeMemoryTab = tab.dataset.memTab;
        renderMemoryContent();
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Render Content
     ══════════════════════════════════════════════════════════ */
  function renderMemoryContent() {
    var contentEl = $('[data-ref="memory-content"]');
    if (!contentEl || !activeMemoryTab) return;

    if (activeMemoryTab === 'overview') renderMemoryOverview(contentEl);
    else if (activeMemoryTab.startsWith('file-')) renderMemoryFile(contentEl, activeMemoryTab.replace('file-', '') + '.md');
    else if (activeMemoryTab.startsWith('dir-')) renderMemoryDirectory(contentEl, activeMemoryTab.replace('dir-', ''));
  }

  function renderSearchBox(placeholder) {
    return '<div class="prod-search-box">' +
      '<span style="color:var(--text-muted);"><i class="fa-solid fa-magnifying-glass"></i></span>' +
      '<input type="text" placeholder="' + esc(placeholder) + '" data-ref="memory-search">' +
    '</div>';
  }

  function renderParsedFlatTables(parsed) {
    var html = '';
    var fieldEntries = Object.entries(parsed.fields);
    if (fieldEntries.length > 0) {
      html += '<div class="prod-file-card" style="margin-bottom:16px;"><table class="prod-memory-flat-table"><tbody>';
      fieldEntries.forEach(function (pair) {
        html += '<tr data-search="' + esc((pair[0] + ' ' + pair[1]).toLowerCase()) + '"><td>' + esc(pair[0]) + '</td><td>' + esc(pair[1]) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    parsed.tables.forEach(function (table) {
      html += '<div class="prod-file-card" style="margin-bottom:16px;"><table class="prod-memory-flat-table"><thead><tr>';
      table.headers.forEach(function (h) { html += '<th>' + esc(h) + '</th>'; });
      html += '</tr></thead><tbody>';
      table.rows.forEach(function (row) {
        var searchData = row.join(' ').toLowerCase();
        html += '<tr data-search="' + esc(searchData) + '">';
        row.forEach(function (cell) { html += '<td>' + esc(cell) + '</td>'; });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    });

    Object.entries(parsed.sections).forEach(function (pair) {
      var sectionName = pair[0];
      var sectionContent = pair[1];
      if (!sectionContent || sectionName === '_intro') return;
      var lines = sectionContent.split('\n').filter(function (l) { return l.trim() && !l.trim().startsWith('|'); });
      if (lines.length === 0) return;
      html += '<div class="prod-file-card" style="margin-bottom:16px;"><table class="prod-memory-flat-table"><thead><tr><th colspan="2">' + esc(sectionName) + '</th></tr></thead><tbody>';
      lines.forEach(function (line) {
        var cleanLine = line.replace(/^[-*]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
        if (!cleanLine) return;
        html += '<tr data-search="' + esc((sectionName + ' ' + cleanLine).toLowerCase()) + '"><td colspan="2">' + esc(cleanLine) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });

    return html;
  }

  function renderMemoryOverview(el) {
    if (!memoryData.claudeMd) return;
    var parsed = parseMemoryMarkdown(memoryData.claudeMd.content);
    var contentHtml;

    if (hasStructuredContent(parsed)) {
      contentHtml = renderParsedFlatTables(parsed);
    } else {
      var rendered = renderMarkdownToHtml(memoryData.claudeMd.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(memoryData.claudeMd.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded prod-markdown-content">' + rendered + '</div>' +
      '</div>';
    }

    el.innerHTML =
      renderSearchBox('Search overview...') +
      '<div data-ref="memory-grid">' + contentHtml + '</div>' +
      '<button data-mem-action="edit-overview" style="margin-top:10px;">Edit CLAUDE.md</button>';

    bindSearchAndActions(el);
  }

  function renderMemoryFile(el, fileName) {
    var file = memoryData.memoryFiles.find(function (f) { return f.name === fileName; });
    if (!file) return;
    var parsed = parseMemoryMarkdown(file.content);
    var contentHtml;

    if (hasStructuredContent(parsed)) {
      contentHtml = renderParsedFlatTables(parsed);
    } else {
      var rendered = renderMarkdownToHtml(file.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(file.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded prod-markdown-content">' + rendered + '</div>' +
      '</div>';
    }

    el.innerHTML =
      renderSearchBox('Search ' + fileName.replace('.md', '') + '...') +
      '<div data-ref="memory-grid">' + contentHtml + '</div>' +
      '<button data-mem-action="edit-file" data-mem-filename="' + esc(fileName) + '" style="margin-top:10px;">Edit ' + esc(fileName) + '</button>';

    bindSearchAndActions(el);
  }

  function renderMemoryDirectory(el, dirName) {
    var files = memoryData.memoryDirs[dirName] || [];
    var html = renderSearchBox('Search ' + dirName + '...');
    html += '<div class="prod-memory-grid" data-ref="memory-grid">';

    files.forEach(function (file) {
      var p = file.parsed;
      var title = p.title || getDisplayName(file.name);

      var fieldsHtml = '';
      var fieldEntries = Object.entries(p.fields).slice(0, 3);
      if (fieldEntries.length > 0) {
        fieldsHtml = '<div class="prod-memory-card-fields">';
        fieldEntries.forEach(function (pair) {
          fieldsHtml += '<div class="prod-memory-card-field">' +
            '<span class="prod-memory-card-field-label">' + esc(pair[0]) + '</span>' +
            '<span class="prod-memory-card-field-value">' + esc(pair[1]) + '</span>' +
          '</div>';
        });
        fieldsHtml += '</div>';
      }

      var preview = '';
      var sectionEntries = Object.entries(p.sections);
      for (var i = 0; i < sectionEntries.length; i++) {
        if (sectionEntries[i][1] && sectionEntries[i][0] !== '_intro') {
          preview = getPreview(sectionEntries[i][1], 100);
          break;
        }
      }
      if (!preview) preview = getPreview(p.rawContent, 100);

      html +=
        '<div class="prod-memory-card" data-mem-action="open-dir-file" data-mem-dir="' + esc(dirName) + '" data-mem-filename="' + esc(file.name) + '" data-search="' + esc((title + ' ' + JSON.stringify(p.fields) + ' ' + p.rawContent).toLowerCase()) + '">' +
          '<button class="prod-memory-card-delete" data-mem-action="delete-file" data-mem-dir="' + esc(dirName) + '" data-mem-filename="' + esc(file.name) + '" title="Delete">&times;</button>' +
          '<div class="prod-memory-card-title">' + esc(title) + '</div>' +
          fieldsHtml +
          '<div class="prod-memory-card-preview">' + esc(preview) + '</div>' +
        '</div>';
    });

    html += '<div class="prod-add-btn" data-mem-action="new-file" data-mem-dir="' + esc(dirName) + '">+ Add to ' + esc(dirName) + '</div>';
    html += '</div>';

    el.innerHTML = html;
    bindSearchAndActions(el);
  }

  function bindSearchAndActions(el) {
    /* Search */
    var searchInput = el.querySelector('[data-ref="memory-search"]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        filterMemoryContent(searchInput.value);
      });
    }

    /* Action buttons */
    el.querySelectorAll('[data-mem-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var action = btn.dataset.memAction;
        if (action === 'edit-overview') openEditModal('CLAUDE.md', 'claudeMd');
        else if (action === 'edit-file') openEditModal(btn.dataset.memFilename, 'memoryFile');
        else if (action === 'open-dir-file') {
          e.stopPropagation();
          openFileModal(btn.dataset.memDir, btn.dataset.memFilename);
        }
        else if (action === 'delete-file') {
          e.stopPropagation();
          deleteMemoryFile(btn.dataset.memDir, btn.dataset.memFilename);
        }
        else if (action === 'new-file') openNewFileModal(btn.dataset.memDir);
      });
    });
  }

  function filterMemoryContent(searchTerm) {
    var grid = $('[data-ref="memory-grid"]');
    if (!grid) return;
    var search = (searchTerm || '').toLowerCase();
    var items = grid.querySelectorAll('.prod-memory-card, tr[data-search], .prod-file-card[data-search]');
    items.forEach(function (item) {
      var sd = item.dataset.search || '';
      item.style.display = (!search || sd.includes(search)) ? '' : 'none';
    });
    grid.querySelectorAll('.prod-file-card:not([data-search])').forEach(function (card) {
      var rows = card.querySelectorAll('tr[data-search]');
      if (rows.length === 0) return;
      var allHidden = Array.from(rows).every(function (r) { return r.style.display === 'none'; });
      card.style.display = allHidden ? 'none' : '';
    });
  }

  /* ══════════════════════════════════════════════════════════
     MEMORY — Modal (local within #view-memory)
     ══════════════════════════════════════════════════════════ */
  var modalState = {};

  function openModal(title, bodyHtml, type, data) {
    var titleEl = $('[data-ref="modal-title"]');
    var bodyEl = $('[data-ref="modal-body"]');
    var overlay = $('[data-ref="modal-overlay"]');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    modalState = { type: type, data: data || {} };
    if (overlay) overlay.classList.add('prod-visible');
  }

  function closeModal() {
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay) overlay.classList.remove('prod-visible');
    modalState = {};
  }

  function openFileModal(dirName, fileName) {
    var files = memoryData.memoryDirs[dirName];
    var file = files ? files.find(function (f) { return f.name === fileName; }) : null;
    if (!file) return;

    var bodyHtml =
      '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
        '<button data-mem-action="delete-from-modal" data-mem-dir="' + esc(dirName) + '" data-mem-filename="' + esc(fileName) + '" style="color:#e74c3c;border-color:#e74c3c;font-size:13px;padding:6px 14px;">Delete</button>' +
      '</div>' +
      '<div class="prod-markdown-content" style="margin-bottom:20px;">' +
        renderMarkdownToHtml(file.content) +
      '</div>' +
      '<div class="form-group">' +
        '<label>Edit Raw Markdown</label>' +
        '<textarea data-ref="modal-edit-content">' + esc(file.content) + '</textarea>' +
      '</div>';

    openModal(getDisplayName(fileName), bodyHtml, 'dirFile', { dirName: dirName, fileName: fileName });

    /* Bind delete-from-modal */
    var delBtn = $('[data-mem-action="delete-from-modal"]');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        deleteMemoryFile(dirName, fileName, true);
      });
    }
  }

  function openNewFileModal(dirName) {
    var template = '# New Entry\n\n';
    var existing = memoryData.memoryDirs[dirName];
    if (existing && existing.length > 0) {
      var sample = existing[0].parsed;
      Object.keys(sample.fields).forEach(function (key) { template += '**' + key + ':** \n'; });
      template += '\n';
      Object.keys(sample.sections).forEach(function (section) {
        if (section !== '_intro') template += '## ' + section + '\n\n';
      });
    }

    var bodyHtml =
      '<div class="form-group">' +
        '<label>Filename (without .md)</label>' +
        '<input type="text" data-ref="modal-new-filename" placeholder="my-new-entry">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Content</label>' +
        '<textarea data-ref="modal-edit-content">' + esc(template) + '</textarea>' +
      '</div>';

    openModal('Add to ' + dirName, bodyHtml, 'newDirFile', { dirName: dirName });
  }

  function openEditModal(fileName, type) {
    var content = '';
    if (type === 'claudeMd') {
      content = memoryData.claudeMd ? memoryData.claudeMd.content : '';
    } else if (type === 'memoryFile') {
      var file = memoryData.memoryFiles.find(function (f) { return f.name === fileName; });
      if (file) content = file.content;
    }

    var bodyHtml =
      '<div class="form-group">' +
        '<label>Content</label>' +
        '<textarea data-ref="modal-edit-content" style="min-height:400px;">' + esc(content) + '</textarea>' +
      '</div>';

    openModal('Edit ' + fileName, bodyHtml, type, { fileName: fileName });
  }

  async function saveModal() {
    var contentEl = $('[data-ref="modal-edit-content"]');
    var content = contentEl ? contentEl.value : '';

    try {
      if (modalState.type === 'claudeMd') {
        memoryData.claudeMd.content = content;
        await ForgeUtils.FS.writeFile(memoryData.claudeMd.fileHandle, content);
        showStatus('Saved CLAUDE.md');

      } else if (modalState.type === 'memoryFile') {
        var fileName = modalState.data.fileName;
        var file = memoryData.memoryFiles.find(function (f) { return f.name === fileName; });
        if (file) {
          file.content = content;
          await ForgeUtils.FS.writeFile(file.fileHandle, content);
          showStatus('Saved ' + fileName);
        }

      } else if (modalState.type === 'dirFile') {
        var dirName = modalState.data.dirName;
        var fn = modalState.data.fileName;
        var dirFiles = memoryData.memoryDirs[dirName];
        var df = dirFiles ? dirFiles.find(function (f) { return f.name === fn; }) : null;
        if (df) {
          df.content = content;
          df.parsed = parseMemoryMarkdown(content);
          await ForgeUtils.FS.writeFile(df.fileHandle, content);
          showStatus('Saved ' + fn);
        }

      } else if (modalState.type === 'newDirFile') {
        var dName = modalState.data.dirName;
        var nameInput = $('[data-ref="modal-new-filename"]');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) { showStatus('Please enter a filename'); return; }
        if (!newName.endsWith('.md')) newName += '.md';

        // Ensure directory exists
        await ForgeFS.createDirectory(memoryDirHandle, 'memory/' + dName);

        // Write the file
        var filePath = 'memory/' + dName + '/' + newName;
        await ForgeFS.writeFile(memoryDirHandle, filePath, content);

        var fileHandle = typeof memoryDirHandle === 'string'
          ? memoryDirHandle + '/' + filePath
          : filePath;
        var dirHandle = typeof memoryDirHandle === 'string'
          ? memoryDirHandle + '/memory/' + dName
          : 'memory/' + dName;

        memoryData.memoryDirs[dName].push({
          name: newName,
          content: content,
          fileHandle: fileHandle,
          dirHandle: dirHandle,
          parsed: parseMemoryMarkdown(content)
        });
        showStatus('Created ' + newName);
      }

      closeModal();
      renderMemoryTabs();
      renderMemoryContent();

    } catch (e) {
      showStatus('Error saving: ' + e.message);
    }
  }

  async function deleteMemoryFile(dirName, fileName, fromModal) {
    if (!confirm('Delete "' + getDisplayName(fileName) + '"?')) return;
    try {
      // Delete the file using ForgeFS
      await ForgeFS.deleteFile(memoryDirHandle, 'memory/' + dirName + '/' + fileName);

      var files = memoryData.memoryDirs[dirName];
      var idx = files ? files.findIndex(function (f) { return f.name === fileName; }) : -1;
      if (idx !== -1) files.splice(idx, 1);

      if (fromModal) closeModal();
      renderMemoryTabs();
      renderMemoryContent();
      showStatus('Deleted ' + getDisplayName(fileName));
    } catch (e) {
      showStatus('Error deleting: ' + e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════
     Public API — init / destroy / refresh
     ══════════════════════════════════════════════════════════ */
  async function init(handle) {
    rootHandle = handle;

    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Reset state */
    memoryDirHandle = null;
    memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
    activeMemoryTab = null;

    if (!rootHandle) {
      return;
    }

    /* Load memory (rootHandle is the project root) */
    memoryDirHandle = rootHandle;
    await loadMemory();
    updateFolderBadge();
  }

  function destroy() {
    stopMemoryWatching();
  }

  async function refresh() {
    await handleRefresh();
  }

  return {
    init: init,
    destroy: destroy,
    refresh: refresh
  };
})();

Shell.registerController('memory', window.MemoryView);
