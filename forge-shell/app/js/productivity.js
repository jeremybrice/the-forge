/* ═══════════════════════════════════════════════════════════════
   Productivity View Controller
   Tasks (Board/List) + Memory browser inside #view-productivity.
   Uses ForgeUtils.FS for file access, ForgeUtils.Toast for
   notifications, and a local modal for memory editing.
   ═══════════════════════════════════════════════════════════════ */

window.ProductivityView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ══════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════ */
  let rootHandle = null;
  let initialized = false;

  /* Tasks state */
  let taskFileHandle = null;
  let taskFileName = '';
  let sections = [];
  let tasks = {};
  let hasChanges = false;
  let currentView = 'board';      // 'board' | 'list'
  let activeMainTab = 'tasks';    // 'tasks' | 'memory'
  let quickAddSection = null;
  let saveTimeout = null;
  let lastModified = 0;
  let taskWatchInterval = null;
  let isSaving = false;
  let taskRefreshRunning = false;
  let taskSignature = '';

  /* Memory state */
  let memoryDirHandle = null;     // same as rootHandle
  let memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
  let memoryWatchInterval = null;
  let memorySignature = '';
  let isMemoryRefreshing = false;
  let activeMemoryTab = null;

  /* ══════════════════════════════════════════════════════════
     DOM helpers — all queries scoped to #view-productivity
     ══════════════════════════════════════════════════════════ */
  function $(sel) {
    return document.querySelector('#view-productivity ' + sel);
  }

  function $$(sel) {
    return document.querySelectorAll('#view-productivity ' + sel);
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
     Scaffold — build initial DOM inside #view-productivity
     ══════════════════════════════════════════════════════════ */
  function scaffold() {
    var view = document.getElementById('view-productivity');
    view.innerHTML =
      '<div class="prod-layout">' +
        /* Toolbar */
        '<div class="plugin-toolbar">' +
          '<span class="toolbar-title"><i class="fa-solid fa-list-check"></i> Productivity</span>' +
          '<div class="folder-path hidden" data-ref="folder-path">' +
            '<i class="fa-solid fa-folder-open"></i>' +
            '<span data-ref="folder-name"></span>' +
          '</div>' +
          '<div class="view-toggle" data-ref="main-tab-toggle">' +
            '<button class="active" data-main-tab="tasks">Tasks</button>' +
            '<button data-main-tab="memory">Memory</button>' +
          '</div>' +
          '<div class="view-toggle" data-ref="task-view-toggle">' +
            '<button class="active" data-task-view="board">Board</button>' +
            '<button data-task-view="list">List</button>' +
          '</div>' +
          '<span class="spacer"></span>' +
          '<span class="refresh-indicator" data-ref="refresh-indicator"></span>' +
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '<button class="btn-icon" data-action="save" title="Save" disabled data-ref="save-btn"><i class="fa-solid fa-floppy-disk"></i></button>' +
          '<button class="btn-icon" data-action="pick-tasks-file" title="Select TASKS.md" data-ref="pick-tasks-btn"><i class="fa-solid fa-file-lines"></i></button>' +
        '</div>' +

        /* Tasks Tab Panel */
        '<div class="prod-tab-panel prod-active" data-ref="tasks-panel">' +
          '<div class="prod-board" data-ref="board"></div>' +
          '<div class="prod-list-view" data-ref="list-view" style="display:none;"></div>' +
        '</div>' +

        /* Memory Tab Panel */
        '<div class="prod-tab-panel" data-ref="memory-panel">' +
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
    var view = document.getElementById('view-productivity');

    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      if (action === 'refresh') handleRefresh();
      else if (action === 'save') handleManualSave();
      else if (action === 'pick-tasks-file') pickTasksFile();
      else if (action === 'modal-close' || action === 'modal-cancel') closeModal();
      else if (action === 'modal-save') saveModal();
    });

    /* Main tab toggle */
    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-main-tab]');
      if (!btn) return;
      switchMainTab(btn.dataset.mainTab);
    });

    /* Task view toggle */
    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-task-view]');
      if (!btn) return;
      switchTaskView(btn.dataset.taskView);
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

  /* ══════════════════════════════════════════════════════════
     Tab / View Switching
     ══════════════════════════════════════════════════════════ */
  function switchMainTab(tab) {
    activeMainTab = tab;
    var tasksPanel = $('[data-ref="tasks-panel"]');
    var memoryPanel = $('[data-ref="memory-panel"]');
    var taskToggle = $('[data-ref="task-view-toggle"]');
    var saveBtn = $('[data-ref="save-btn"]');
    var pickBtn = $('[data-ref="pick-tasks-btn"]');

    tasksPanel.classList.toggle('prod-active', tab === 'tasks');
    memoryPanel.classList.toggle('prod-active', tab === 'memory');
    taskToggle.style.display = tab === 'tasks' ? 'flex' : 'none';
    saveBtn.style.display = tab === 'tasks' ? 'inline-flex' : 'none';
    pickBtn.style.display = tab === 'tasks' ? 'inline-flex' : 'none';

    $$('[data-main-tab]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mainTab === tab);
    });

    updateFolderBadge();
  }

  function switchTaskView(view) {
    currentView = view;
    var boardEl = $('[data-ref="board"]');
    var listEl = $('[data-ref="list-view"]');
    if (view === 'list') {
      listEl.style.display = 'block';
      boardEl.style.display = 'none';
    } else {
      listEl.style.display = 'none';
      boardEl.style.display = 'flex';
    }
    $$('[data-task-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.taskView === view);
    });
    renderTasks();
  }

  function updateFolderBadge() {
    var pathEl = $('[data-ref="folder-path"]');
    var nameEl = $('[data-ref="folder-name"]');
    if (activeMainTab === 'tasks' && taskFileHandle) {
      nameEl.textContent = taskFileName;
      pathEl.classList.remove('hidden');
    } else if (activeMainTab === 'memory' && memoryDirHandle) {
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
     TASKS.md Parser & Serializer
     ══════════════════════════════════════════════════════════ */
  function sectionId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function parseTaskMarkdown(content) {
    var resultSections = [];
    var resultTasks = {};
    var currentSectionId = null;
    var currentTask = null;
    var lines = content.split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var headerMatch = line.match(/^## \*{0,2}(.+?)\*{0,2}$/);

      if (headerMatch) {
        if (currentTask && currentSectionId) {
          resultTasks[currentSectionId].push(currentTask);
          currentTask = null;
        }
        var sectionName = headerMatch[1].trim();
        currentSectionId = sectionId(sectionName);
        if (!resultTasks[currentSectionId]) {
          resultSections.push({ id: currentSectionId, name: sectionName });
          resultTasks[currentSectionId] = [];
        }
      } else if (currentSectionId && /^- \[[ xX]\]/.test(line)) {
        if (currentTask) {
          resultTasks[currentSectionId].push(currentTask);
        }
        var checked = /\[[xX]\]/.test(line);
        var text = line.replace(/^- \[[ xX]\]\s*/, '');
        var title = text;
        var note = '';
        var boldMatch = text.match(/^\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
          title = boldMatch[1];
          note = boldMatch[2].replace(/^\s*-\s*/, '').trim();
        }
        currentTask = {
          id: Date.now() + Math.random(),
          title: title,
          note: note,
          checked: checked,
          subtasks: [],
          section: currentSectionId
        };
      } else if (currentTask && /^\s+- \[[ xX]\]/.test(line)) {
        var stChecked = /\[[xX]\]/.test(line);
        var stText = line.replace(/^\s+- \[[ xX]\]\s*/, '');
        currentTask.subtasks.push({ text: stText, checked: stChecked });
      }
    }

    if (currentTask && currentSectionId) {
      resultTasks[currentSectionId].push(currentTask);
    }

    return { sections: resultSections, tasks: resultTasks };
  }

  function toMarkdown() {
    var md = '# Tasks\n';
    sections.forEach(function (section) {
      md += '\n## ' + section.name + '\n';
      var sectionTasks = tasks[section.id] || [];
      sectionTasks.forEach(function (t) {
        var checkbox = t.checked ? '[x]' : '[ ]';
        var note = t.note ? ' - ' + t.note : '';
        md += '- ' + checkbox + ' **' + t.title + '**' + note + '\n';
        t.subtasks.forEach(function (st) {
          var stCheckbox = st.checked ? '[x]' : '[ ]';
          md += '  - ' + stCheckbox + ' ' + st.text + '\n';
        });
      });
    });
    return md.trimEnd() + '\n';
  }

  /* ══════════════════════════════════════════════════════════
     Auto-Save & File Watching (Tasks)
     ══════════════════════════════════════════════════════════ */
  function markChanged() {
    hasChanges = true;
    var btn = $('[data-ref="save-btn"]');
    if (btn) btn.disabled = false;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(autoSave, 500);
  }

  async function autoSave() {
    if (!taskFileHandle || !hasChanges || isSaving) return;
    isSaving = true;
    try {
      var content = toMarkdown();
      await ForgeUtils.FS.writeFile(taskFileHandle, content);
      var file = await taskFileHandle.getFile();
      lastModified = file.lastModified;
      hasChanges = false;
      var btn = $('[data-ref="save-btn"]');
      if (btn) btn.disabled = true;
      showStatus('Saved');
    } catch (e) {
      showStatus('Save failed: ' + e.message);
    }
    isSaving = false;
  }

  async function handleManualSave() {
    if (!taskFileHandle) return;
    await autoSave();
  }

  async function checkForExternalChanges() {
    if (!taskFileHandle || hasChanges || isSaving || taskRefreshRunning) return;
    taskRefreshRunning = true;
    try {
      var file = await taskFileHandle.getFile();
      var newSignature = 'TASKS.md:' + file.lastModified;
      if (newSignature !== taskSignature) {
        lastModified = file.lastModified;
        taskSignature = newSignature;
        var content = await file.text();
        var result = parseTaskMarkdown(content);
        sections = result.sections;
        tasks = result.tasks;
        renderTasks();
        // Toast removed - only manual refresh shows toast
      }
    } catch (e) {
      /* ignore */
    } finally {
      taskRefreshRunning = false;
    }
  }

  function startTaskWatching() {
    stopTaskWatching();
    taskWatchInterval = setInterval(checkForExternalChanges, 5000);
  }

  function stopTaskWatching() {
    if (taskWatchInterval) { clearInterval(taskWatchInterval); taskWatchInterval = null; }
  }

  /* ══════════════════════════════════════════════════════════
     Refresh Handler
     ══════════════════════════════════════════════════════════ */
  async function handleRefresh() {
    if (activeMainTab === 'tasks') {
      await checkForExternalChanges();
      showStatus('Tasks refreshed');
    } else {
      await checkForMemoryChanges();
      showStatus('Memory refreshed');
    }
    var indicator = $('[data-ref="refresh-indicator"]');
    if (indicator) {
      var now = new Date();
      indicator.textContent = 'Refreshed \u00B7 ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  /* ══════════════════════════════════════════════════════════
     Render Tasks — dispatches to board or list
     ══════════════════════════════════════════════════════════ */
  function renderTasks() {
    if (currentView === 'board') renderBoard();
    else renderList();
  }

  /* ══════════════════════════════════════════════════════════
     Board View Renderer
     ══════════════════════════════════════════════════════════ */
  function renderBoard() {
    var board = $('[data-ref="board"]');
    if (!board) return;
    board.innerHTML = '';

    if (sections.length === 0 && !taskFileHandle) {
      board.innerHTML =
        '<div class="prod-not-active" style="width:100%;">' +
          '<div class="prod-state-icon"><i class="fa-solid fa-list-check"></i></div>' +
          '<h2>Select your TASKS.md file</h2>' +
          '<p>Pick a <code>TASKS.md</code> file from the toolbar or use the file picker button.</p>' +
        '</div>';
      return;
    }

    sections.forEach(function (section) {
      var sectionTasks = tasks[section.id] || [];
      board.appendChild(createColumn(section.id, section.name, sectionTasks));
    });

    var addBtn = document.createElement('div');
    addBtn.className = 'prod-add-section-col';
    addBtn.innerHTML = '<span>+ Add Section</span>';
    addBtn.addEventListener('click', function () { startAddingBoardSection(addBtn); });
    board.appendChild(addBtn);
  }

  function createColumn(colId, title, items) {
    var col = document.createElement('div');
    col.className = 'prod-column';
    col.innerHTML =
      '<div class="prod-column-header">' +
        '<span class="prod-column-title" data-section-id="' + esc(colId) + '">' + esc(title) + '</span>' +
        '<span class="prod-count">' + items.length + '</span>' +
      '</div>' +
      '<div class="prod-cards" data-column="' + esc(colId) + '"></div>' +
      '<div class="prod-add-card"><button data-add="' + esc(colId) + '">+ Add task</button></div>';

    /* Column title click -> edit */
    col.querySelector('.prod-column-title').addEventListener('click', function (e) {
      startEditingColumnTitle(e.target, colId);
    });

    /* Column header drag (reorder columns) */
    var header = col.querySelector('.prod-column-header');
    header.draggable = true;

    header.addEventListener('dragstart', function (e) {
      e.stopPropagation();
      col.classList.add('prod-dragging-column');
      e.dataTransfer.setData('text/column', colId);
      e.dataTransfer.effectAllowed = 'move';
    });

    header.addEventListener('dragend', function () {
      col.classList.remove('prod-dragging-column');
      $$('.prod-column-drop-indicator').forEach(function (el) { el.remove(); });
    });

    col.addEventListener('dragover', function (e) {
      if (e.dataTransfer.types.includes('text/column')) {
        e.preventDefault();
        e.stopPropagation();
        var board = $('[data-ref="board"]');
        board.querySelectorAll('.prod-column-drop-indicator').forEach(function (el) { el.remove(); });
        var indicator = document.createElement('div');
        indicator.className = 'prod-column-drop-indicator';
        var rect = col.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) col.before(indicator);
        else col.after(indicator);
      }
    });

    col.addEventListener('drop', function (e) {
      if (e.dataTransfer.types.includes('text/column')) {
        e.preventDefault();
        e.stopPropagation();
        var fromId = e.dataTransfer.getData('text/column');
        if (fromId !== colId) {
          var rect = col.getBoundingClientRect();
          var insertBefore = e.clientX < rect.left + rect.width / 2;
          moveSection(fromId, colId, insertBefore);
        }
        var board = $('[data-ref="board"]');
        board.querySelectorAll('.prod-column-drop-indicator').forEach(function (el) { el.remove(); });
      }
    });

    /* Populate cards */
    var cardsContainer = col.querySelector('.prod-cards');
    items.forEach(function (task) { cardsContainer.appendChild(createCard(task)); });

    /* Card drag-and-drop into column */
    var getDropPosition = function (e) {
      var allCards = Array.from(cardsContainer.querySelectorAll('.prod-task-card'));
      var visibleCards = allCards.filter(function (c) { return !c.classList.contains('prod-dragging'); });
      var insertBeforeCard = null;
      var dropIndex = visibleCards.length;
      for (var i = 0; i < visibleCards.length; i++) {
        var rect = visibleCards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          insertBeforeCard = visibleCards[i];
          dropIndex = i;
          break;
        }
      }
      return { insertBeforeCard: insertBeforeCard, dropIndex: dropIndex };
    };

    var showDropIndicator = function (e) {
      col.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      var pos = getDropPosition(e);
      var indicator = document.createElement('div');
      indicator.className = 'prod-drop-indicator';
      if (pos.insertBeforeCard) cardsContainer.insertBefore(indicator, pos.insertBeforeCard);
      else cardsContainer.appendChild(indicator);
    };

    col.addEventListener('dragover', function (e) {
      if (!e.dataTransfer.types.includes('text/column')) {
        e.preventDefault();
        cardsContainer.classList.add('prod-drag-over');
        showDropIndicator(e);
      }
    });

    col.addEventListener('dragleave', function (e) {
      if (!col.contains(e.relatedTarget)) {
        cardsContainer.classList.remove('prod-drag-over');
        col.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      }
    });

    col.addEventListener('drop', function (e) {
      if (!e.dataTransfer.types.includes('text/column')) {
        e.preventDefault();
        cardsContainer.classList.remove('prod-drag-over');
        col.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
        var taskId = parseFloat(e.dataTransfer.getData('text/plain'));
        if (!taskId) return;
        var pos = getDropPosition(e);
        moveTask(taskId, colId, pos.dropIndex);
      }
    });

    /* Add task button */
    col.querySelector('[data-add="' + colId + '"]').addEventListener('click', function () {
      addNewTask(colId, cardsContainer);
    });

    return col;
  }

  /* ══════════════════════════════════════════════════════════
     Task Card (Board)
     ══════════════════════════════════════════════════════════ */
  function createCard(task) {
    var card = document.createElement('div');
    card.className = 'prod-task-card';
    card.draggable = true;
    card.dataset.id = task.id;

    var html =
      '<button class="prod-delete-btn" data-action="delete" title="Delete">&times;</button>' +
      '<div style="display:flex;align-items:flex-start;gap:12px;">' +
        '<span class="prod-checkbox' + (task.checked ? ' prod-checked' : '') + '" data-action="toggle"></span>' +
        '<div class="prod-card-title" data-action="edit-title">' + esc(task.title) + '</div>' +
      '</div>';

    if (task.note) {
      html += '<div class="prod-card-note" data-action="edit-note" style="cursor:pointer;margin-left:30px;">' + esc(task.note) + '</div>';
    } else {
      html += '<div class="prod-card-note prod-show-on-hover" data-action="edit-note" style="cursor:pointer;margin-left:30px;font-style:italic;">+ Add note</div>';
    }

    if (task.subtasks.length > 0) {
      html += '<div class="prod-card-subtasks" style="margin-left:30px;">';
      task.subtasks.forEach(function (st, idx) {
        html +=
          '<div class="prod-subtask">' +
            '<span class="prod-checkbox' + (st.checked ? ' prod-checked' : '') + '" data-action="toggle-sub" data-idx="' + idx + '" style="width:16px;height:16px;min-width:16px;min-height:16px;"></span>' +
            '<span data-action="edit-subtask" data-idx="' + idx + '" style="cursor:pointer;">' + esc(st.text) + '</span>' +
          '</div>';
      });
      html += '<div class="prod-subtask prod-show-on-hover" data-action="add-subtask" style="color:var(--text-muted);cursor:pointer;font-style:italic;padding-left:24px;">+ Add subtask</div>';
      html += '</div>';
    } else {
      html += '<div class="prod-card-subtasks prod-show-on-hover" style="margin-left:30px;">' +
        '<div class="prod-subtask" data-action="add-subtask" style="color:var(--text-muted);cursor:pointer;font-style:italic;">+ Add subtask</div>' +
      '</div>';
    }

    card.innerHTML = html;

    card.addEventListener('dragstart', function (e) {
      card.classList.add('prod-dragging');
      e.dataTransfer.setData('text/plain', String(task.id));
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('prod-dragging');
    });

    card.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.dataset.action;
      if (action === 'toggle') {
        task.checked = !task.checked;
        markChanged();
        renderTasks();
      } else if (action === 'toggle-sub') {
        var idx = parseInt(target.dataset.idx);
        task.subtasks[idx].checked = !task.subtasks[idx].checked;
        markChanged();
        renderTasks();
      } else if (action === 'edit-title') {
        startInlineEdit(target, task.title, function (val) {
          if (val && val !== task.title) { task.title = val; markChanged(); }
          renderTasks();
        });
      } else if (action === 'edit-note') {
        startInlineEdit(target, task.note || '', function (val) {
          task.note = val;
          markChanged();
          renderTasks();
        }, 'Add a note...');
      } else if (action === 'edit-subtask') {
        var idx2 = parseInt(target.dataset.idx);
        startInlineEdit(target, task.subtasks[idx2].text, function (val) {
          if (val) task.subtasks[idx2].text = val;
          else task.subtasks.splice(idx2, 1);
          markChanged();
          renderTasks();
        });
      } else if (action === 'add-subtask') {
        startInlineEdit(target, '', function (val) {
          if (val) { task.subtasks.push({ text: val, checked: false }); markChanged(); }
          renderTasks();
        }, 'New subtask...');
      } else if (action === 'delete') {
        deleteTask(task);
      }
    });

    return card;
  }

  /* ══════════════════════════════════════════════════════════
     Inline Editing Helper
     ══════════════════════════════════════════════════════════ */
  function startInlineEdit(el, value, callback, placeholder) {
    var input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.style.cssText = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:6px;padding:4px 8px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;';

    el.replaceWith(input);
    input.focus();
    if (value) input.select();

    var saved = false;
    var finish = function () {
      if (saved) return;
      saved = true;
      callback(input.value.trim());
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(); }
      else if (e.key === 'Escape') { saved = true; renderTasks(); }
    });
    input.addEventListener('blur', finish);
  }

  /* ══════════════════════════════════════════════════════════
     Column Title Editing
     ══════════════════════════════════════════════════════════ */
  function startEditingColumnTitle(titleEl, colId) {
    var section = sections.find(function (s) { return s.id === colId; });
    if (!section) return;
    startInlineEdit(titleEl, section.name, function (val) {
      if (val && val !== section.name) {
        var oldId = section.id;
        section.name = val;
        var newId = sectionId(val);
        if (newId !== oldId) {
          tasks[newId] = tasks[oldId] || [];
          delete tasks[oldId];
          (tasks[newId] || []).forEach(function (t) { t.section = newId; });
          section.id = newId;
        }
        markChanged();
      }
      renderTasks();
    });
  }

  /* ══════════════════════════════════════════════════════════
     Add Task / Section / Move / Delete (Shared)
     ══════════════════════════════════════════════════════════ */
  function addNewTask(secId, container) {
    if (container.querySelector('.prod-new-task-input')) return;
    var input = document.createElement('textarea');
    input.className = 'prod-new-task-input';
    input.placeholder = 'What needs to be done?';
    input.rows = 2;
    container.appendChild(input);
    input.focus();

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var title = input.value.trim();
        if (title) {
          if (!tasks[secId]) tasks[secId] = [];
          tasks[secId].push({
            id: Date.now() + Math.random(),
            title: title,
            note: '',
            checked: false,
            subtasks: [],
            section: secId
          });
          markChanged();
          renderTasks();
        } else { input.remove(); }
      } else if (e.key === 'Escape') { input.remove(); }
    });

    input.addEventListener('blur', function () { setTimeout(function () { input.remove(); }, 100); });
  }

  function moveSection(fromId, toId, insertBefore) {
    var fromIdx = sections.findIndex(function (s) { return s.id === fromId; });
    var toIdx = sections.findIndex(function (s) { return s.id === toId; });
    if (fromIdx === -1 || toIdx === -1) return;
    var section = sections.splice(fromIdx, 1)[0];
    var newIdx = sections.findIndex(function (s) { return s.id === toId; });
    if (!insertBefore) newIdx++;
    sections.splice(newIdx, 0, section);
    markChanged();
    renderTasks();
  }

  function moveTask(taskId, toSecId, dropIndex) {
    var task = null;
    for (var i = 0; i < sections.length; i++) {
      var arr = tasks[sections[i].id] || [];
      var idx = arr.findIndex(function (t) { return t.id === taskId; });
      if (idx !== -1) { task = arr.splice(idx, 1)[0]; break; }
    }
    if (!task) return;
    task.section = toSecId;
    if (!tasks[toSecId]) tasks[toSecId] = [];
    if (dropIndex >= 0 && dropIndex <= tasks[toSecId].length) tasks[toSecId].splice(dropIndex, 0, task);
    else tasks[toSecId].push(task);
    markChanged();
    renderTasks();
  }

  function deleteTask(task) {
    if (!confirm('Delete "' + task.title + '"?')) return;
    for (var i = 0; i < sections.length; i++) {
      var arr = tasks[sections[i].id] || [];
      var idx = arr.findIndex(function (t) { return t.id === task.id; });
      if (idx !== -1) { arr.splice(idx, 1); break; }
    }
    markChanged();
    renderTasks();
  }

  function startAddingBoardSection(btn) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Section name...';
    input.style.cssText = 'width:220px;background:var(--bg-card);border:2px solid var(--accent);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;';

    btn.innerHTML = '';
    btn.style.cssText = 'background:var(--bg-secondary);border:2px dashed var(--accent);display:flex;align-items:center;justify-content:center;cursor:default;min-height:120px;min-width:340px;max-width:340px;border-radius:12px;';
    btn.appendChild(input);
    input.focus();

    var saved = false;
    var finish = function () {
      if (saved) return;
      saved = true;
      var name = input.value.trim();
      if (name) {
        var id = sectionId(name);
        if (!tasks[id]) {
          sections.push({ id: id, name: name });
          tasks[id] = [];
          markChanged();
        }
      }
      renderTasks();
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(); }
      else if (e.key === 'Escape') { saved = true; renderTasks(); }
    });
    input.addEventListener('blur', finish);
  }

  /* ══════════════════════════════════════════════════════════
     List View Renderer
     ══════════════════════════════════════════════════════════ */
  function renderList() {
    var listEl = $('[data-ref="list-view"]');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (sections.length === 0 && !taskFileHandle) {
      listEl.innerHTML =
        '<div class="prod-not-active">' +
          '<div class="prod-state-icon"><i class="fa-solid fa-list-check"></i></div>' +
          '<h2>Select your TASKS.md file</h2>' +
          '<p>Pick a <code>TASKS.md</code> file from the toolbar.</p>' +
        '</div>';
      return;
    }

    if (!quickAddSection && sections.length > 0) {
      quickAddSection = sections[0].id;
    }

    /* Quick add */
    var quickAdd = document.createElement('div');
    quickAdd.className = 'prod-quick-add';
    var qaSectionName = (sections.find(function (s) { return s.id === quickAddSection; }) || {}).name || 'Select section';
    quickAdd.innerHTML =
      '<span class="prod-checkbox" style="opacity:0.3;"></span>' +
      '<input type="text" class="prod-quick-add-input" placeholder="Add a task..." data-ref="quick-add-input">' +
      '<span class="prod-quick-add-section" data-ref="quick-add-section">' + esc(qaSectionName) + '</span>';
    listEl.appendChild(quickAdd);

    var qaInput = quickAdd.querySelector('[data-ref="quick-add-input"]');
    var qaBtn = quickAdd.querySelector('[data-ref="quick-add-section"]');

    qaInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && qaInput.value.trim()) {
        var title = qaInput.value.trim();
        if (!tasks[quickAddSection]) tasks[quickAddSection] = [];
        tasks[quickAddSection].unshift({
          id: Date.now() + Math.random(),
          title: title,
          note: '',
          checked: false,
          subtasks: [],
          section: quickAddSection
        });
        qaInput.value = '';
        markChanged();
        renderTasks();
        setTimeout(function () {
          var inp = $('[data-ref="quick-add-input"]');
          if (inp) inp.focus();
        }, 10);
      }
    });

    qaBtn.addEventListener('click', function () { showSectionPicker(qaBtn); });

    /* Sections */
    sections.forEach(function (section) {
      var sectionTasks = tasks[section.id] || [];
      var sectionEl = document.createElement('div');
      sectionEl.className = 'prod-list-section';
      sectionEl.dataset.sectionId = section.id;

      var header = document.createElement('div');
      header.className = 'prod-list-section-header';
      header.innerHTML =
        '<span class="prod-section-title" data-section-id="' + esc(section.id) + '">' + esc(section.name) + '</span>' +
        '<span class="prod-count">' + sectionTasks.length + '</span>';

      header.querySelector('.prod-section-title').addEventListener('click', function (e) {
        startEditingListSectionTitle(e.target, section);
      });

      sectionEl.appendChild(header);

      var tasksContainer = document.createElement('div');
      tasksContainer.className = 'prod-list-tasks-container';
      tasksContainer.dataset.sectionId = section.id;

      sectionTasks.forEach(function (task) {
        tasksContainer.appendChild(createListItem(task));
      });

      sectionEl.appendChild(tasksContainer);

      /* Drag target for list items */
      var getDropPos = function (e) {
        var items = Array.from(tasksContainer.querySelectorAll('.prod-list-item:not(.prod-dragging)'));
        var insertBefore = null;
        var dropIndex = items.length;
        for (var i = 0; i < items.length; i++) {
          var rect = items[i].getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            insertBefore = items[i];
            dropIndex = i;
            break;
          }
        }
        return { insertBefore: insertBefore, dropIndex: dropIndex };
      };

      sectionEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        sectionEl.classList.add('prod-drag-over');
        tasksContainer.querySelectorAll('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
        var pos = getDropPos(e);
        var indicator = document.createElement('div');
        indicator.className = 'prod-list-drop-indicator';
        if (pos.insertBefore) tasksContainer.insertBefore(indicator, pos.insertBefore);
        else tasksContainer.appendChild(indicator);
      });

      sectionEl.addEventListener('dragleave', function (e) {
        if (!sectionEl.contains(e.relatedTarget)) {
          sectionEl.classList.remove('prod-drag-over');
          tasksContainer.querySelectorAll('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
        }
      });

      sectionEl.addEventListener('drop', function (e) {
        e.preventDefault();
        sectionEl.classList.remove('prod-drag-over');
        tasksContainer.querySelectorAll('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
        var taskId = parseFloat(e.dataTransfer.getData('text/plain'));
        if (!taskId) return;
        var pos = getDropPos(e);
        moveTask(taskId, section.id, pos.dropIndex);
      });

      listEl.appendChild(sectionEl);
    });

    /* Add section button */
    var addSec = document.createElement('div');
    addSec.className = 'prod-list-add-section';
    addSec.textContent = '+ Add Section';
    addSec.addEventListener('click', function () { startAddingListSection(addSec); });
    listEl.appendChild(addSec);
  }

  function createListItem(task) {
    var item = document.createElement('div');
    item.className = 'prod-list-item';
    item.draggable = true;
    item.dataset.taskId = task.id;

    item.addEventListener('dragstart', function (e) {
      item.classList.add('prod-dragging');
      e.dataTransfer.setData('text/plain', String(task.id));
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function () {
      item.classList.remove('prod-dragging');
      $$('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
      $$('.prod-list-section.prod-drag-over').forEach(function (el) { el.classList.remove('prod-drag-over'); });
    });

    var checkbox = document.createElement('span');
    checkbox.className = 'prod-checkbox' + (task.checked ? ' prod-checked' : '');
    checkbox.addEventListener('click', function (e) {
      e.stopPropagation();
      task.checked = !task.checked;
      markChanged();
      renderTasks();
    });

    var content = document.createElement('div');
    content.className = 'prod-list-item-content';

    var titleEl = document.createElement('div');
    titleEl.className = 'prod-list-item-title' + (task.checked ? ' prod-checked' : '');
    titleEl.textContent = task.title;
    titleEl.addEventListener('click', function (e) {
      e.stopPropagation();
      startInlineEdit(titleEl, task.title, function (val) {
        if (val && val !== task.title) { task.title = val; markChanged(); }
        renderTasks();
      });
    });
    content.appendChild(titleEl);

    if (task.note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'prod-list-item-note';
      noteEl.textContent = task.note;
      noteEl.addEventListener('click', function (e) {
        e.stopPropagation();
        startInlineEdit(noteEl, task.note, function (val) {
          task.note = val;
          markChanged();
          renderTasks();
        }, 'Add a note...');
      });
      content.appendChild(noteEl);
    } else {
      var addNote = document.createElement('div');
      addNote.className = 'prod-list-item-note prod-add-note';
      addNote.textContent = '+ Add note';
      addNote.addEventListener('click', function (e) {
        e.stopPropagation();
        startInlineEdit(addNote, '', function (val) {
          task.note = val;
          markChanged();
          renderTasks();
        }, 'Add a note...');
      });
      content.appendChild(addNote);
    }

    if (task.subtasks && task.subtasks.length > 0) {
      var stContainer = document.createElement('div');
      stContainer.className = 'prod-list-item-subtasks';
      task.subtasks.forEach(function (st, idx) {
        var stEl = document.createElement('div');
        stEl.className = 'prod-list-item-subtask';

        var stCheckbox = document.createElement('span');
        stCheckbox.className = 'prod-checkbox' + (st.checked ? ' prod-checked' : '');
        stCheckbox.addEventListener('click', function (e) {
          e.stopPropagation();
          st.checked = !st.checked;
          markChanged();
          renderTasks();
        });

        var stText = document.createElement('span');
        stText.textContent = st.text;
        if (st.checked) {
          stText.style.textDecoration = 'line-through';
          stText.style.color = 'var(--text-muted)';
        }
        stText.addEventListener('click', function (e) {
          e.stopPropagation();
          startInlineEdit(stText, st.text, function (val) {
            if (val) st.text = val;
            else task.subtasks.splice(idx, 1);
            markChanged();
            renderTasks();
          });
        });

        stEl.appendChild(stCheckbox);
        stEl.appendChild(stText);
        stContainer.appendChild(stEl);
      });
      content.appendChild(stContainer);
    }

    var addSubtask = document.createElement('div');
    addSubtask.className = 'prod-list-item-add-subtask';
    addSubtask.textContent = '+ Add subtask';
    addSubtask.addEventListener('click', function (e) {
      e.stopPropagation();
      startInlineEdit(addSubtask, '', function (val) {
        if (val) {
          if (!task.subtasks) task.subtasks = [];
          task.subtasks.push({ text: val, checked: false });
          markChanged();
        }
        renderTasks();
      }, 'New subtask...');
    });
    content.appendChild(addSubtask);

    var actions = document.createElement('div');
    actions.className = 'prod-list-item-actions';
    actions.innerHTML = '<button title="Delete task">&times;</button>';
    actions.querySelector('button').addEventListener('click', function (e) {
      e.stopPropagation();
      deleteTask(task);
    });

    item.appendChild(checkbox);
    item.appendChild(content);
    item.appendChild(actions);
    return item;
  }

  function startEditingListSectionTitle(titleEl, section) {
    startInlineEdit(titleEl, section.name, function (val) {
      if (val && val !== section.name) {
        var oldId = section.id;
        section.name = val;
        var newId = sectionId(val);
        if (newId !== oldId) {
          tasks[newId] = tasks[oldId] || [];
          delete tasks[oldId];
          (tasks[newId] || []).forEach(function (t) { t.section = newId; });
          section.id = newId;
        }
        markChanged();
      }
      renderTasks();
    });
  }

  function startAddingListSection(btn) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Section name...';
    input.style.cssText = 'width:100%;background:var(--bg-card);border:2px solid var(--accent);border-radius:8px;padding:12px 16px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;text-align:left;';

    btn.innerHTML = '';
    btn.style.border = '2px solid var(--accent)';
    btn.style.cursor = 'default';
    btn.appendChild(input);
    input.focus();

    var saved = false;
    var finish = function () {
      if (saved) return;
      saved = true;
      var name = input.value.trim();
      if (name) {
        var id = sectionId(name);
        if (!tasks[id]) {
          sections.push({ id: id, name: name });
          tasks[id] = [];
          markChanged();
        }
      }
      renderTasks();
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(); }
      else if (e.key === 'Escape') { saved = true; renderTasks(); }
    });
    input.addEventListener('blur', finish);
  }

  function showSectionPicker(anchor) {
    $$('.prod-section-picker').forEach(function (el) { el.remove(); });
    var picker = document.createElement('div');
    picker.className = 'prod-section-picker';
    var rect = anchor.getBoundingClientRect();
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.right = (window.innerWidth - rect.right) + 'px';

    sections.forEach(function (section) {
      var btn = document.createElement('button');
      btn.textContent = section.name;
      btn.addEventListener('click', function () {
        quickAddSection = section.id;
        picker.remove();
        renderTasks();
        setTimeout(function () {
          var inp = $('[data-ref="quick-add-input"]');
          if (inp) inp.focus();
        }, 10);
      });
      picker.appendChild(btn);
    });

    document.body.appendChild(picker);
    setTimeout(function () {
      document.addEventListener('click', function closeHandler(e) {
        if (!picker.contains(e.target)) {
          picker.remove();
          document.removeEventListener('click', closeHandler);
        }
      });
    }, 10);
  }

  /* ══════════════════════════════════════════════════════════
     File Picker for TASKS.md
     ══════════════════════════════════════════════════════════ */
  async function pickTasksFile() {
    try {
      var handles = await window.showOpenFilePicker({
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
      });
      taskFileHandle = handles[0];
      var file = await taskFileHandle.getFile();
      var content = await file.text();
      lastModified = file.lastModified;
      var result = parseTaskMarkdown(content);
      sections = result.sections;
      tasks = result.tasks;
      taskFileName = file.name;
      updateFolderBadge();
      switchTaskView(currentView);
      startTaskWatching();
      showStatus('Loaded ' + file.name);
    } catch (e) {
      if (e.name !== 'AbortError') showStatus('Error: ' + e.message);
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

  async function countMemoryFiles() {
    var count = 0;

    /* Count files in memory/ */
    try {
      var entries = await ForgeFS.readDir(memoryDirHandle, 'memory');
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          count++;
        } else if (entry.kind === 'directory') {
          try {
            var subEntries = await ForgeFS.readDir(memoryDirHandle, 'memory/' + entry.name);
            for (var j = 0; j < subEntries.length; j++) {
              if (subEntries[j].kind === 'file' && subEntries[j].name.endsWith('.md')) {
                count++;
              }
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) { /* no memory/ directory */ }

    /* Check for CLAUDE.md */
    try {
      await ForgeFS.readFile(memoryDirHandle, 'CLAUDE.md');
      count++;
    } catch (e) { /* no CLAUDE.md */ }

    return count;
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
     MEMORY — Modal (local within #view-productivity)
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
    taskFileHandle = null;
    taskFileName = '';
    sections = [];
    tasks = {};
    hasChanges = false;
    lastModified = 0;
    memoryDirHandle = null;
    memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
    activeMemoryTab = null;
    quickAddSection = null;

    /* Reset UI */
    activeMainTab = 'tasks';
    currentView = 'board';
    switchMainTab('tasks');
    switchTaskView('board');

    if (!rootHandle) {
      renderTasks();
      return;
    }

    /* Try loading TASKS.md from root */
    try {
      var content = await ForgeFS.readFile(rootHandle, 'TASKS.md');
      var meta = await ForgeFS.getFileMeta(rootHandle, 'TASKS.md');

      taskFileHandle = typeof rootHandle === 'string'
        ? rootHandle + '/TASKS.md'
        : 'TASKS.md';
      lastModified = meta.modified;

      var result = parseTaskMarkdown(content);
      sections = result.sections;
      tasks = result.tasks;
      taskSignature = 'TASKS.md:' + lastModified;
      taskFileName = 'TASKS.md';
      updateFolderBadge();
      renderTasks();
      startTaskWatching();
    } catch (e) {
      /* TASKS.md does not exist — that's OK */
      renderTasks();
    }

    /* Load memory (rootHandle is the project root) */
    memoryDirHandle = rootHandle;
    await loadMemory();
  }

  function destroy() {
    stopTaskWatching();
    stopMemoryWatching();
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
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

Shell.registerController('productivity', window.ProductivityView);
