/* ═══════════════════════════════════════════════════════════════
   Tasks View Controller
   Folder-based task management with Board/List views inside #view-tasks.
   Uses ForgeUtils.FS for file access, ForgeUtils.Toast for
   notifications.
   ═══════════════════════════════════════════════════════════════ */

window.TasksView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ══════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════ */
  let rootHandle = null;
  let initialized = false;

  /* Tasks state */
  let tasksDirHandle = null;
  let tasks = [];
  let hasChanges = false;
  let currentView = 'board';      // 'board' | 'list'
  let saveTimeout = null;
  let taskWatchInterval = null;
  let isSaving = false;
  let taskRefreshRunning = false;
  let taskSignature = '';
  let suppressExternalToasts = false;

  /* Field visibility settings */
  let fieldVisibility = {
    priority: true,
    assignee: true,
    tags: true,
    due_date: true,
    dependencies: false,
    external_id: false,
    creator: false,
    type: false
  };

  /* ══════════════════════════════════════════════════════════
     DOM helpers — all queries scoped to #view-tasks
     ══════════════════════════════════════════════════════════ */
  function $(sel) {
    return document.querySelector('#view-tasks ' + sel);
  }

  function $$(sel) {
    return document.querySelectorAll('#view-tasks ' + sel);
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
     Scaffold — build initial DOM inside #view-tasks
     ══════════════════════════════════════════════════════════ */
  function scaffold() {
    var view = document.getElementById('view-tasks');
    view.innerHTML =
      '<div class="prod-layout">' +
        /* Toolbar */
        '<div class="plugin-toolbar">' +
          '<span class="toolbar-title"><i class="fa-solid fa-list-check"></i> Tasks</span>' +
          '<div class="folder-path hidden" data-ref="folder-path">' +
            '<i class="fa-solid fa-folder-open"></i>' +
            '<span data-ref="folder-name"></span>' +
          '</div>' +
          '<div class="view-toggle" data-ref="task-view-toggle">' +
            '<button class="active" data-task-view="board">Board</button>' +
            '<button data-task-view="list">List</button>' +
          '</div>' +
          '<span class="spacer"></span>' +
          '<span class="refresh-indicator" data-ref="refresh-indicator"></span>' +
          '<button class="btn-icon" data-action="field-settings" title="Customize Fields"><i class="fa-solid fa-sliders"></i></button>' +
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Tasks Panel */
        '<div class="prod-tab-panel prod-active" data-ref="tasks-panel">' +
          '<div class="prod-board" data-ref="board"></div>' +
          '<div class="prod-list-view" data-ref="list-view" style="display:none;"></div>' +
        '</div>' +

        /* Settings Modal */
        '<div class="task-settings-overlay" data-ref="settings-overlay" style="display:none;">' +
          '<div class="task-settings-modal">' +
            '<div class="task-settings-header">' +
              '<h3>Field Visibility Settings</h3>' +
              '<button class="btn-icon" data-action="close-settings"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="task-settings-body" data-ref="settings-body">' +
              '<p style="margin-bottom:16px;color:var(--text-muted);font-size:13px;">Customize which metadata fields appear on task cards.</p>' +
              '<div class="task-settings-fields" data-ref="settings-fields"></div>' +
            '</div>' +
            '<div class="task-settings-footer">' +
              '<button class="btn-secondary" data-action="reset-settings">Reset to Defaults</button>' +
              '<button class="btn-primary" data-action="save-settings">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Edit Modal */
        '<div class="task-edit-overlay" data-ref="edit-overlay" style="display:none;">' +
          '<div class="task-edit-modal">' +
            '<div class="task-edit-header">' +
              '<h3 data-ref="edit-title">Edit Task</h3>' +
              '<button class="btn-icon" data-action="close-edit"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="task-edit-body" data-ref="edit-body"></div>' +
            '<div class="task-edit-footer">' +
              '<button class="btn-secondary" data-action="toggle-diff">Preview Changes</button>' +
              '<span style="flex:1;"></span>' +
              '<button class="btn-secondary" data-action="cancel-edit">Cancel</button>' +
              '<button class="btn-primary" data-action="save-edit">Save</button>' +
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
    var view = document.getElementById('view-tasks');

    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      if (action === 'refresh') handleRefresh();
      else if (action === 'field-settings') openSettingsPanel();
      else if (action === 'close-settings') closeSettingsPanel();
      else if (action === 'save-settings') saveSettings();
      else if (action === 'reset-settings') resetSettings();
      else if (action === 'close-edit') editModal.close();
      else if (action === 'cancel-edit') editModal.close();
      else if (action === 'save-edit') editModal.save();
      else if (action === 'toggle-diff') editModal.toggleDiff();
    });

    /* Task view toggle */
    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-task-view]');
      if (!btn) return;
      switchTaskView(btn.dataset.taskView);
    });
  }

  /* ══════════════════════════════════════════════════════════
     View Switching
     ══════════════════════════════════════════════════════════ */
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
    if (tasksDirHandle) {
      nameEl.textContent = typeof tasksDirHandle === 'string'
        ? tasksDirHandle.split('/').pop() || tasksDirHandle.split('\\').pop() || tasksDirHandle
        : 'tasks';
      pathEl.classList.remove('hidden');
    } else {
      pathEl.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════════════════════
     YAML Parser (simple key-value parser)
     ══════════════════════════════════════════════════════════ */
  function parseYAML(yamlStr) {
    var result = {};
    var lines = yamlStr.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      var colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      var key = line.substring(0, colonIdx).trim();
      var value = line.substring(colonIdx + 1).trim();

      // Handle null
      if (value === 'null' || value === '~' || value === '') {
        result[key] = null;
      }
      // Handle arrays (simple bracket notation)
      else if (value.startsWith('[') && value.endsWith(']')) {
        var inner = value.substring(1, value.length - 1).trim();
        if (inner === '') {
          result[key] = [];
        } else {
          result[key] = inner.split(',').map(function (v) { return v.trim(); });
        }
      }
      // Handle strings
      else {
        result[key] = value;
      }
    }
    return result;
  }

  /* ══════════════════════════════════════════════════════════
     Task File Parser & Serializer
     ══════════════════════════════════════════════════════════ */
  // Scans the tasks/ directory directly via ForgeFS and filters for files
  // matching the task-NNN-*.md pattern, replacing the old index.json lookup.
  async function parseTaskFiles() {
    if (!tasksDirHandle) return [];

    var resultTasks = [];

    try {
      var entries = await ForgeFS.readDir(tasksDirHandle, '.');

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];

        if (entry.kind === 'file' && /^task-\d{3}-.*\.md$/.test(entry.name)) {
          try {
            var content = await ForgeFS.readFile(tasksDirHandle, entry.name);
            var task = parseTaskFile(entry.name, content);
            if (task) resultTasks.push(task);
          } catch (e) {
            console.warn('Failed to parse task file:', entry.name, e);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read tasks directory:', e);
    }

    // Sort by filename (task number)
    resultTasks.sort(function (a, b) {
      return a.filename.localeCompare(b.filename);
    });

    return resultTasks;
  }

  function parseTaskFile(filename, content) {
    var parts = content.split('---\n');
    if (parts.length < 3) return null;

    var yamlStr = parts[1];
    var body = parts.slice(2).join('---\n').trim();

    var frontmatter = parseYAML(yamlStr);

    return {
      filename: filename,
      title: frontmatter.title || '',
      type: frontmatter.type || 'task',
      status: frontmatter.status || 'active',
      priority: frontmatter.priority || 'medium',
      assignee: frontmatter.assignee || null,
      creator: frontmatter.creator || null,
      created: frontmatter.created || '',
      updated: frontmatter.updated || '',
      due_date: frontmatter.due_date || null,
      dependencies: frontmatter.dependencies || [],
      tags: frontmatter.tags || [],
      external_link: frontmatter.external_link || null,
      external_id: frontmatter.external_id || null,
      body: body
    };
  }

  function serializeTaskFile(task) {
    var yaml = '---\n';
    yaml += 'title: ' + task.title + '\n';
    yaml += 'type: ' + (task.type || 'task') + '\n';
    yaml += 'status: ' + task.status + '\n';
    yaml += 'priority: ' + task.priority + '\n';
    yaml += 'assignee: ' + (task.assignee || 'null') + '\n';
    yaml += 'creator: ' + (task.creator || 'null') + '\n';
    yaml += 'created: ' + task.created + '\n';
    yaml += 'updated: ' + task.updated + '\n';
    yaml += 'due_date: ' + (task.due_date || 'null') + '\n';

    if (task.dependencies && task.dependencies.length > 0) {
      yaml += 'dependencies: [' + task.dependencies.join(', ') + ']\n';
    } else {
      yaml += 'dependencies: []\n';
    }

    if (task.tags && task.tags.length > 0) {
      yaml += 'tags: [' + task.tags.join(', ') + ']\n';
    } else {
      yaml += 'tags: []\n';
    }

    yaml += 'external_link: ' + (task.external_link || 'null') + '\n';
    yaml += 'external_id: ' + (task.external_id || 'null') + '\n';
    yaml += '---\n\n';

    return yaml + (task.body || '');
  }

  /* ══════════════════════════════════════════════════════════
     Auto-Save & File Watching (Tasks)
     ══════════════════════════════════════════════════════════ */
  function markChanged(task) {
    hasChanges = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function () { autoSave(task); }, 500);
  }

  async function autoSave(task) {
    if (!tasksDirHandle || !hasChanges || isSaving) return;
    isSaving = true;
    suppressExternalToasts = true;

    try {
      // Update the updated date
      task.updated = new Date().toISOString().split('T')[0];

      var content = serializeTaskFile(task);
      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);

      // Update signature to prevent external change detection
      taskSignature = await buildTaskSignature();

      hasChanges = false;
      showStatus('Saved');
    } catch (e) {
      showStatus('Save failed: ' + e.message);
    }

    isSaving = false;
    setTimeout(function () { suppressExternalToasts = false; }, 1000);
  }

  // Builds a signature string from file names + last-modified timestamps
  // so the auto-refresh loop can detect on-disk changes cheaply.
  async function buildTaskSignature() {
    if (!tasksDirHandle) return '';

    var entries = [];
    try {
      var files = await ForgeFS.readDir(tasksDirHandle, '.');

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.kind === 'file' && /^task-\d{3}-.*\.md$/.test(file.name)) {
          try {
            var meta = await ForgeFS.getFileMeta(tasksDirHandle, file.name);
            entries.push(file.name + ':' + meta.modified);
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) { /* skip */ }

    entries.sort();
    return entries.join('|');
  }

  async function checkForExternalChanges() {
    if (!tasksDirHandle || hasChanges || isSaving || taskRefreshRunning) return;
    taskRefreshRunning = true;
    try {
      var newSignature = await buildTaskSignature();
      if (newSignature !== taskSignature) {
        taskSignature = newSignature;
        tasks = await parseTaskFiles();
        renderTasks();
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
     Tag Management System
     ══════════════════════════════════════════════════════════ */
  var allTags = [];

  async function loadTags() {
    allTags = [];
    try {
      var content = await ForgeFS.readFile(tasksDirHandle, 'tags.md');
      var lines = content.split('\n');
      lines.forEach(function (line) {
        var tag = line.trim();
        if (tag && tag !== '---' && !tag.startsWith('#')) {
          allTags.push(tag);
        }
      });
    } catch (e) {
      console.log('No tags.md file found, will create on first tag save');
    }

    // Also collect from existing tasks
    tasks.forEach(function (task) {
      if (task.tags && task.tags.length > 0) {
        task.tags.forEach(function (tag) {
          if (tag && !allTags.includes(tag)) {
            allTags.push(tag);
          }
        });
      }
    });
    allTags.sort();
  }

  async function saveTags() {
    try {
      var content = '# Available Tags\n\n' + allTags.join('\n') + '\n';
      await ForgeFS.writeFile(tasksDirHandle, 'tags.md', content);
    } catch (e) {
      console.warn('Failed to save tags.md:', e);
    }
  }

  function addNewTag(tag) {
    tag = tag.trim();
    if (!tag || allTags.includes(tag)) return;
    allTags.push(tag);
    allTags.sort();
    saveTags();
  }

  /* ══════════════════════════════════════════════════════════
     Refresh Handler
     ══════════════════════════════════════════════════════════ */
  async function handleRefresh() {
    await checkForExternalChanges();
    showStatus('Tasks refreshed');
    var indicator = $('[data-ref="refresh-indicator"]');
    if (indicator) {
      var now = new Date();
      indicator.textContent = 'Refreshed · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

    if (!tasksDirHandle) {
      board.innerHTML =
        '<div class="prod-not-active" style="width:100%;">' +
          '<div class="prod-state-icon"><i class="fa-solid fa-list-check"></i></div>' +
          '<h2>No tasks directory found</h2>' +
          '<p>The <code>tasks/</code> directory was not found in your project root.</p>' +
        '</div>';
      return;
    }

    // Group tasks by status
    var statuses = ['active', 'waiting', 'someday', 'done'];
    var statusLabels = {
      'active': 'Active',
      'waiting': 'Waiting On',
      'someday': 'Someday',
      'done': 'Done'
    };
    var statusIcons = {
      'active': 'fa-regular fa-square-caret-right',
      'waiting': 'fa-regular fa-circle-pause',
      'someday': 'fa-regular fa-calendar',
      'done': 'fa-regular fa-square-check'
    };
    var tasksByStatus = {};
    statuses.forEach(function (status) { tasksByStatus[status] = []; });

    tasks.forEach(function (task) {
      var status = task.status || 'active';
      if (!tasksByStatus[status]) tasksByStatus[status] = [];
      tasksByStatus[status].push(task);
    });

    statuses.forEach(function (status) {
      var statusTasks = tasksByStatus[status] || [];
      board.appendChild(createColumn(status, statusLabels[status], statusIcons[status], statusTasks));
    });
  }

  function createColumn(colId, label, icon, items) {
    var col = document.createElement('div');
    col.className = 'prod-column';
    col.innerHTML =
      '<div class="prod-column-header">' +
        '<span class="prod-column-title" data-status="' + esc(colId) + '"><i class="' + icon + '"></i> ' + esc(label) + '</span>' +
        '<span class="prod-count">' + items.length + '</span>' +
      '</div>' +
      '<div class="prod-cards" data-column="' + esc(colId) + '"></div>' +
      '<div class="prod-add-card"><button data-add="' + esc(colId) + '">+ Add task</button></div>';

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
      e.preventDefault();
      cardsContainer.classList.add('prod-drag-over');
      showDropIndicator(e);
    });

    col.addEventListener('dragleave', function (e) {
      if (!col.contains(e.relatedTarget)) {
        cardsContainer.classList.remove('prod-drag-over');
        col.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      }
    });

    col.addEventListener('drop', function (e) {
      e.preventDefault();
      console.log('[DRAG-DROP] Drop event fired');
      cardsContainer.classList.remove('prod-drag-over');
      col.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      var taskFilename = e.dataTransfer.getData('text/plain');
      console.log('[DRAG-DROP] Task filename:', taskFilename);
      if (!taskFilename) {
        console.warn('[DRAG-DROP] No filename in dataTransfer');
        return;
      }
      moveTaskToStatus(taskFilename, colId);
    });

    /* Add task button */
    col.querySelector('[data-add="' + colId + '"]').addEventListener('click', function () {
      addNewTask(colId);
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
    card.dataset.filename = task.filename;

    var priorityClass = (task.priority || 'medium').toLowerCase();
    var priorityLabel = priorityClass.charAt(0).toUpperCase() + priorityClass.slice(1);

    var html =
      '<div class="prod-card-actions">' +
        '<button class="prod-edit-btn" data-action="edit" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>' +
        '<button class="prod-delete-btn" data-action="delete" title="Delete"><i class="fa-regular fa-rectangle-xmark"></i></button>' +
      '</div>' +
      '<div class="prod-card-title" data-action="edit-title">' + esc(task.title) + '</div>';

    if (fieldVisibility.priority) {
      html += '<div class="prod-priority-pill ' + priorityClass + '" style="margin-top:8px;">' + priorityLabel + '</div>';
    }

    if (fieldVisibility.assignee && task.assignee) {
      html += '<div class="prod-card-note" style="margin-top:8px;"><i class="fa-regular fa-user-clock"></i> ' + esc(task.assignee) + '</div>';
    }

    if (fieldVisibility.due_date && task.due_date) {
      var today = new Date().toISOString().split('T')[0];
      var isOverdue = task.due_date < today && task.status !== 'done';
      var dueDateColor = isOverdue ? '#e74c3c' : 'var(--text-muted)';
      html += '<div class="prod-card-note" style="margin-top:8px;color:' + dueDateColor + ';"><i class="fa-regular fa-calendar-day"></i> ' + task.due_date + '</div>';
    }

    if (fieldVisibility.dependencies && task.dependencies && task.dependencies.length > 0) {
      html += '<div class="prod-card-note" style="margin-top:8px;"><i class="fa-regular fa-link"></i> ' + task.dependencies.length + ' dependencies</div>';
    }

    if (fieldVisibility.external_id && task.external_id && task.external_id !== 'null') {
      html += '<div class="prod-card-note" style="margin-top:8px;"><i class="fa-solid fa-link-simple"></i> ' + esc(task.external_id) + '</div>';
    }

    if (fieldVisibility.creator && task.creator && task.creator !== 'null') {
      html += '<div class="prod-card-note" style="margin-top:8px;"><i class="fa-regular fa-user-pen"></i> ' + esc(task.creator) + '</div>';
    }

    if (fieldVisibility.type && task.type && task.type !== 'task') {
      html += '<div class="prod-card-note" style="margin-top:8px;"><i class="fa-solid fa-list-check"></i> ' + esc(task.type) + '</div>';
    }

    if (fieldVisibility.tags && task.tags && task.tags.length > 0) {
      html += '<div class="prod-card-tags" style="margin-top:8px;"><i class="fa-regular fa-tag"></i> ';
      task.tags.forEach(function (tag) {
        html += '<span class="prod-tag">' + esc(tag) + '</span>';
      });
      html += '</div>';
    }

    card.innerHTML = html;

    card.addEventListener('dragstart', function (e) {
      card.classList.add('prod-dragging');
      e.dataTransfer.setData('text/plain', task.filename);
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('prod-dragging');
      // Global cleanup: remove ALL drop indicators and drag-over classes
      document.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      document.querySelectorAll('.prod-drag-over').forEach(function (el) { el.classList.remove('prod-drag-over'); });
    });

    card.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.dataset.action;
      if (action === 'edit-title') {
        startInlineEdit(target, task.title, function (val) {
          if (val && val !== task.title) { task.title = val; markChanged(task); }
          renderTasks();
        });
      } else if (action === 'edit') {
        editModal.open(task);
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
     Add Task / Move / Delete
     ══════════════════════════════════════════════════════════ */
  async function addNewTask(status) {
    if (!tasksDirHandle) return;

    // Find next task number
    var maxNum = 0;
    tasks.forEach(function (t) {
      var match = t.filename.match(/^task-(\d{3})-/);
      if (match) {
        var num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    var newNum = maxNum + 1;
    var newFilename = 'task-' + String(newNum).padStart(3, '0') + '-new-task.md';
    var today = new Date().toISOString().split('T')[0];

    var newTask = {
      filename: newFilename,
      title: 'New Task',
      type: 'task',
      status: status,
      priority: 'medium',
      assignee: null,
      creator: null,
      created: today,
      updated: today,
      due_date: null,
      dependencies: [],
      tags: [],
      external_link: null,
      external_id: null,
      body: ''
    };

    try {
      suppressExternalToasts = true;
      var content = serializeTaskFile(newTask);
      await ForgeFS.writeFile(tasksDirHandle, newFilename, content);
      tasks.push(newTask);
      taskSignature = await buildTaskSignature();
      renderTasks();
      showStatus('Task created');
      setTimeout(function () { suppressExternalToasts = false; }, 1000);
    } catch (e) {
      showStatus('Error creating task: ' + e.message);
      suppressExternalToasts = false;
    }
  }

  async function moveTaskToStatus(filename, newStatus) {
    var task = tasks.find(function (t) { return t.filename === filename; });
    if (!task) return;

    task.status = newStatus;
    renderTasks();
    showStatus('Moved to ' + newStatus);
    markChanged(task);
  }

  async function deleteTask(task) {
    var confirmed = await ForgeUtils.Confirm.show(
      'Delete Task',
      'Are you sure you want to delete "' + esc(task.title) + '"?',
      '<div style="color:var(--text-muted);font-size:13px;margin-top:8px;">This action cannot be undone.</div>'
    );
    if (!confirmed) return;

    try {
      suppressExternalToasts = true;
      await ForgeFS.deleteFile(tasksDirHandle, task.filename);
      var idx = tasks.findIndex(function (t) { return t.filename === task.filename; });
      if (idx !== -1) tasks.splice(idx, 1);
      taskSignature = await buildTaskSignature();
      renderTasks();
      ForgeUtils.Toast.show('Task deleted', 'success');
      setTimeout(function () { suppressExternalToasts = false; }, 1000);
    } catch (e) {
      ForgeUtils.Toast.show('Error deleting task: ' + e.message, 'error');
      suppressExternalToasts = false;
    }
  }

  /* ══════════════════════════════════════════════════════════
     Field Visibility Settings
     ══════════════════════════════════════════════════════════ */
  function loadFieldVisibility() {
    try {
      var stored = localStorage.getItem('forge-shell-tasks-field-visibility');
      if (stored) {
        var parsed = JSON.parse(stored);
        fieldVisibility = Object.assign({}, fieldVisibility, parsed);
      }
    } catch (e) {
      console.warn('Failed to load field visibility settings:', e);
    }
  }

  function saveFieldVisibility() {
    try {
      localStorage.setItem('forge-shell-tasks-field-visibility', JSON.stringify(fieldVisibility));
    } catch (e) {
      console.warn('Failed to save field visibility settings:', e);
    }
  }

  function openSettingsPanel() {
    var overlay = $('[data-ref="settings-overlay"]');
    var fieldsContainer = $('[data-ref="settings-fields"]');
    if (!overlay || !fieldsContainer) return;

    var fields = [
      { key: 'priority', label: 'Priority' },
      { key: 'assignee', label: 'Assignee' },
      { key: 'tags', label: 'Tags' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'dependencies', label: 'Dependencies' },
      { key: 'external_id', label: 'External ID' },
      { key: 'creator', label: 'Creator' },
      { key: 'type', label: 'Type' }
    ];

    var html = '';
    fields.forEach(function (field) {
      var checked = fieldVisibility[field.key] ? 'checked' : '';
      html +=
        '<label class="task-settings-field">' +
          '<input type="checkbox" data-field="' + field.key + '" ' + checked + '>' +
          '<span>' + field.label + '</span>' +
        '</label>';
    });

    fieldsContainer.innerHTML = html;
    overlay.style.display = 'flex';
  }

  function closeSettingsPanel() {
    var overlay = $('[data-ref="settings-overlay"]');
    if (overlay) overlay.style.display = 'none';
  }

  function saveSettings() {
    var checkboxes = $$('[data-ref="settings-fields"] input[type="checkbox"]');
    checkboxes.forEach(function (cb) {
      fieldVisibility[cb.dataset.field] = cb.checked;
    });
    saveFieldVisibility();
    closeSettingsPanel();
    renderTasks();
    ForgeUtils.Toast.show('Field visibility updated', 'success');
  }

  function resetSettings() {
    fieldVisibility = {
      priority: true,
      assignee: true,
      tags: true,
      due_date: true,
      dependencies: false,
      external_id: false,
      creator: false,
      type: false
    };
    saveFieldVisibility();
    openSettingsPanel();  // Refresh the checkboxes
    ForgeUtils.Toast.show('Settings reset to defaults', 'success');
  }

  /* ══════════════════════════════════════════════════════════
     Edit Modal
     ══════════════════════════════════════════════════════════ */
  var editModal = {
    currentTask: null,
    showingDiff: false,

    open: function (task) {
      this.currentTask = Object.assign({}, task);
      this.showingDiff = false;

      var overlay = $('[data-ref="edit-overlay"]');
      var titleEl = $('[data-ref="edit-title"]');
      var bodyEl = $('[data-ref="edit-body"]');
      var diffBtn = $('[data-action="toggle-diff"]');

      if (!overlay || !bodyEl) return;

      if (titleEl) titleEl.textContent = 'Edit: ' + task.title;
      if (diffBtn) diffBtn.textContent = 'Preview Changes';

      var html = '<div class="form-grid">';
      html += this._buildField('title', 'Title', 'text', task.title, { required: true, fullWidth: true });
      html += this._buildField('status', 'Status', 'select', task.status, { options: ['active', 'waiting', 'someday', 'done'] });
      html += this._buildField('priority', 'Priority', 'select', task.priority, { options: ['high', 'medium', 'low'] });
      html += this._buildField('assignee', 'Assignee', 'text', task.assignee);
      html += this._buildField('creator', 'Creator', 'text', task.creator);
      html += this._buildField('due_date', 'Due Date', 'date', task.due_date);
      html += this._buildTagsField(task.tags || []);
      html += this._buildDependenciesField(task.dependencies || []);
      html += this._buildField('external_link', 'External Link', 'text', task.external_link);
      html += this._buildField('external_id', 'External ID', 'text', task.external_id);
      html += this._buildField('type', 'Type', 'text', task.type);
      html += '</div>';

      html += '<div class="form-group full-width">' +
        '<label>Body (Markdown)</label>' +
        '<textarea data-task-edit-body style="min-height:200px;font-family:monospace;font-size:13px">' + esc(task.body || '') + '</textarea>' +
      '</div>';

      html += '<div data-task-diff-container class="hidden"></div>';

      bodyEl.innerHTML = html;
      overlay.style.display = 'flex';
      this._bindTagInputEvents();
      this._bindDependencyInputEvents();
    },

    close: function () {
      var overlay = $('[data-ref="edit-overlay"]');
      if (overlay) overlay.style.display = 'none';
      this.currentTask = null;
      this.showingDiff = false;
    },

    _buildField: function (key, label, type, value, opts) {
      opts = opts || {};
      var fullWidth = opts.fullWidth ? ' full-width' : '';
      var placeholder = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '';
      var input = '';

      if (type === 'select') {
        var options = opts.options || [];
        input = '<select data-task-field="' + key + '">' +
          '<option value="">&mdash; None &mdash;</option>' +
          options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') +
        '</select>';
      } else if (type === 'date') {
        input = '<input type="date" data-task-field="' + key + '" value="' + (value && value !== 'null' ? value : '') + '">';
      } else {
        input = '<input type="text" data-task-field="' + key + '" value="' + esc(value && value !== 'null' ? value : '') + '"' + placeholder + '>';
      }

      return '<div class="form-group' + fullWidth + '"><label>' + esc(label) + '</label>' + input + '</div>';
    },

    _buildTagsField: function (tags) {
      var html = '<div class="form-group full-width">';
      html += '<label>Tags</label>';
      html += '<div class="prod-tag-input-container" data-tag-container>';
      tags.forEach(function (tag) {
        html += '<div class="prod-tag-pill">';
        html += '<span>' + esc(tag) + '</span>';
        html += '<button type="button" class="prod-tag-pill-remove" data-remove-tag="' + esc(tag) + '">×</button>';
        html += '</div>';
      });
      html += '<input type="text" data-tag-input placeholder="Add tag..." autocomplete="off">';
      html += '</div>';
      html += '<div class="prod-tag-autocomplete hidden" data-tag-autocomplete></div>';
      html += '</div>';
      return html;
    },

    _bindTagInputEvents: function () {
      var container = $('[data-tag-container]');
      var input = $('[data-tag-input]');
      var autocomplete = $('[data-tag-autocomplete]');
      if (!container || !input || !autocomplete) return;

      var currentTags = [];
      container.querySelectorAll('.prod-tag-pill span').forEach(function (span) {
        currentTags.push(span.textContent);
      });

      // Collect all unique tags from all tasks
      var allTags = [];
      var tagSet = new Set();
      tasks.forEach(function (task) {
        if (task.tags && Array.isArray(task.tags)) {
          task.tags.forEach(function (tag) { tagSet.add(tag); });
        }
      });
      allTags = Array.from(tagSet);

      var self = this;

      // Remove tag
      container.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-remove-tag]');
        if (!removeBtn) return;
        var tag = removeBtn.dataset.removeTag;
        currentTags = currentTags.filter(function (t) { return t !== tag; });
        removeBtn.closest('.prod-tag-pill').remove();
      });

      // Autocomplete
      input.addEventListener('input', function () {
        var query = input.value.trim().toLowerCase();
        if (!query) {
          autocomplete.classList.add('hidden');
          return;
        }
        var matches = allTags.filter(function (tag) {
          return tag.toLowerCase().includes(query) && !currentTags.includes(tag);
        });
        if (matches.length === 0) {
          autocomplete.classList.add('hidden');
          return;
        }
        var html = '';
        matches.forEach(function (tag, idx) {
          html += '<div class="prod-tag-autocomplete-item' + (idx === 0 ? ' selected' : '') + '" data-tag="' + esc(tag) + '">' + esc(tag) + '</div>';
        });
        autocomplete.innerHTML = html;
        autocomplete.classList.remove('hidden');
      });

      // Keyboard nav + enter to add
      input.addEventListener('keydown', function (e) {
        var items = autocomplete.querySelectorAll('.prod-tag-autocomplete-item');
        if (e.key === 'Enter') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected) {
            addTagPill(selected.dataset.tag);
          } else {
            var newTag = input.value.trim();
            if (newTag) addTagPill(newTag);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected && selected.nextElementSibling) {
            selected.classList.remove('selected');
            selected.nextElementSibling.classList.add('selected');
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected && selected.previousElementSibling) {
            selected.classList.remove('selected');
            selected.previousElementSibling.classList.add('selected');
          }
        }
      });

      // Click to add
      autocomplete.addEventListener('click', function (e) {
        var item = e.target.closest('.prod-tag-autocomplete-item');
        if (!item) return;
        addTagPill(item.dataset.tag);
      });

      function addTagPill(tag) {
        tag = tag.trim();
        if (!tag || currentTags.includes(tag)) {
          input.value = '';
          autocomplete.classList.add('hidden');
          return;
        }
        currentTags.push(tag);
        addNewTag(tag);
        var pill = document.createElement('div');
        pill.className = 'prod-tag-pill';
        pill.innerHTML = '<span>' + esc(tag) + '</span><button type="button" class="prod-tag-pill-remove" data-remove-tag="' + esc(tag) + '">×</button>';
        container.insertBefore(pill, input);
        input.value = '';
        autocomplete.classList.add('hidden');
      }
    },

    _buildDependenciesField: function (dependencies) {
      var html = '<div class="form-group full-width">';
      html += '<label>Dependencies</label>';
      html += '<div class="prod-dep-input-container" data-dep-container>';

      // Render existing dependencies as pills with task titles
      dependencies.forEach(function (depFilename) {
        // Find the task to get its title
        var depTask = tasks.find(function (t) { return t.filename === depFilename; });
        var displayTitle = depTask ? depTask.title : depFilename;
        html += '<div class="prod-dep-pill">';
        html += '<span>' + esc(displayTitle) + '</span>';
        html += '<button type="button" class="prod-dep-pill-remove" data-remove-dep="' + esc(depFilename) + '">×</button>';
        html += '</div>';
      });

      html += '<input type="text" data-dep-input placeholder="Search tasks..." autocomplete="off">';
      html += '</div>';
      html += '<div class="prod-dep-autocomplete hidden" data-dep-autocomplete></div>';
      html += '</div>';
      return html;
    },

    _bindDependencyInputEvents: function () {
      var container = $('[data-dep-container]');
      var input = $('[data-dep-input]');
      var autocomplete = $('[data-dep-autocomplete]');
      if (!container || !input || !autocomplete) return;

      var currentDeps = [];
      container.querySelectorAll('.prod-dep-pill').forEach(function (pill) {
        var removeBtn = pill.querySelector('[data-remove-dep]');
        if (removeBtn) {
          currentDeps.push(removeBtn.dataset.removeDep);
        }
      });

      var self = this;
      var currentTaskFilename = this.currentTask ? this.currentTask.filename : null;

      // Remove dependency
      container.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-remove-dep]');
        if (!removeBtn) return;
        var depFilename = removeBtn.dataset.removeDep;
        currentDeps = currentDeps.filter(function (d) { return d !== depFilename; });
        removeBtn.closest('.prod-dep-pill').remove();
      });

      // Autocomplete - search by title or filename
      input.addEventListener('input', function () {
        var query = input.value.trim().toLowerCase();
        if (!query) {
          autocomplete.classList.add('hidden');
          return;
        }

        // Filter tasks: exclude current task and already-selected dependencies
        var matches = tasks.filter(function (task) {
          if (task.filename === currentTaskFilename) return false;
          if (currentDeps.indexOf(task.filename) !== -1) return false;
          return task.title.toLowerCase().includes(query) ||
                 task.filename.toLowerCase().includes(query);
        }).slice(0, 10); // Limit to 10 results

        if (matches.length === 0) {
          autocomplete.classList.add('hidden');
          return;
        }

        var html = '';
        matches.forEach(function (task, idx) {
          html += '<div class="prod-dep-autocomplete-item' + (idx === 0 ? ' selected' : '') + '" data-task-filename="' + esc(task.filename) + '">';
          html += '<div class="prod-dep-autocomplete-item-title">' + esc(task.title) + '</div>';
          html += '<div class="prod-dep-autocomplete-item-meta">' + esc(task.filename) + ' • ' + esc(task.status) + '</div>';
          html += '</div>';
        });
        autocomplete.innerHTML = html;
        autocomplete.classList.remove('hidden');
      });

      // Keyboard nav + enter to add
      input.addEventListener('keydown', function (e) {
        var items = autocomplete.querySelectorAll('.prod-dep-autocomplete-item');
        if (e.key === 'Enter') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected) {
            addDepPill(selected.dataset.taskFilename);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected && selected.nextElementSibling) {
            selected.classList.remove('selected');
            selected.nextElementSibling.classList.add('selected');
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          var selected = autocomplete.querySelector('.selected');
          if (selected && selected.previousElementSibling) {
            selected.classList.remove('selected');
            selected.previousElementSibling.classList.add('selected');
          }
        }
      });

      // Click to add
      autocomplete.addEventListener('click', function (e) {
        var item = e.target.closest('.prod-dep-autocomplete-item');
        if (!item) return;
        addDepPill(item.dataset.taskFilename);
      });

      function addDepPill(taskFilename) {
        if (!taskFilename || currentDeps.indexOf(taskFilename) !== -1) {
          input.value = '';
          autocomplete.classList.add('hidden');
          return;
        }

        currentDeps.push(taskFilename);

        // Find task to get title
        var task = tasks.find(function (t) { return t.filename === taskFilename; });
        var displayTitle = task ? task.title : taskFilename;

        var pill = document.createElement('div');
        pill.className = 'prod-dep-pill';
        pill.innerHTML = '<span>' + esc(displayTitle) + '</span><button type="button" class="prod-dep-pill-remove" data-remove-dep="' + esc(taskFilename) + '">×</button>';
        container.insertBefore(pill, input);
        input.value = '';
        autocomplete.classList.add('hidden');
      }
    },

    _getFormData: function () {
      var task = Object.assign({}, this.currentTask);
      $$('[data-ref="edit-body"] [data-task-field]').forEach(function (el) {
        var key = el.dataset.taskField;
        var val = el.value.trim();
        task[key] = val === '' ? null : val;
      });

      // Read tags from pills
      var tagContainer = $('[data-tag-container]');
      if (tagContainer) {
        var tagPills = [];
        tagContainer.querySelectorAll('.prod-tag-pill span').forEach(function (span) {
          tagPills.push(span.textContent);
        });
        task.tags = tagPills;
      }

      // Read dependencies from pills
      var depContainer = $('[data-dep-container]');
      if (depContainer) {
        var depFilenames = [];
        depContainer.querySelectorAll('[data-remove-dep]').forEach(function (btn) {
          depFilenames.push(btn.dataset.removeDep);
        });
        task.dependencies = depFilenames;
      }

      task.updated = new Date().toISOString().split('T')[0];
      var bodyEl = $('[data-task-edit-body]');
      task.body = bodyEl ? bodyEl.value : '';
      return task;
    },

    toggleDiff: function () {
      var container = $('[data-task-diff-container]');
      if (!container) return;
      this.showingDiff = !this.showingDiff;
      var diffBtn = $('[data-action="toggle-diff"]');
      if (diffBtn) diffBtn.textContent = this.showingDiff ? 'Hide Preview' : 'Preview Changes';

      if (!this.showingDiff) {
        container.classList.add('hidden');
        return;
      }

      var newTask = this._getFormData();
      var oldTask = this.currentTask;
      var html = '';

      var fieldChanges = [];
      var allKeys = ['title', 'type', 'status', 'priority', 'assignee', 'creator', 'due_date', 'tags', 'dependencies', 'external_link', 'external_id'];
      allKeys.forEach(function (key) {
        var oldVal = JSON.stringify(oldTask[key] !== undefined ? oldTask[key] : null);
        var newVal = JSON.stringify(newTask[key] !== undefined ? newTask[key] : null);
        if (oldVal !== newVal) {
          fieldChanges.push({ key: key, old: oldTask[key], 'new': newTask[key] });
        }
      });

      if (fieldChanges.length > 0) {
        html += '<div class="diff-section"><h4>Field Changes</h4>';
        fieldChanges.forEach(function (change) {
          html += '<div class="diff-field">';
          html += '<strong>' + esc(change.key) + ':</strong> ';
          html += '<span class="diff-old">' + esc(JSON.stringify(change.old)) + '</span> → ';
          html += '<span class="diff-new">' + esc(JSON.stringify(change['new'])) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (oldTask.body !== newTask.body) {
        var diff = ForgeUtils.Diff.compute(oldTask.body || '', newTask.body || '');
        if (diff && diff.length > 0) {
          html += '<div class="diff-section"><h4>Body Changes</h4><div class="diff-body">';
          for (var i = 0; i < diff.length; i++) {
            var line = diff[i];
            var prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
            html += '<div class="diff-line ' + line.type + '">' + prefix + ' ' + esc(line.text) + '</div>';
          }
          html += '</div></div>';
        }
      }

      if (!html) {
        html = '<div style="padding:16px;color:var(--text-muted);text-align:center">No changes detected</div>';
      }

      container.innerHTML = html;
      container.classList.remove('hidden');
    },

    save: async function () {
      if (!this.currentTask) return;
      var newTask = this._getFormData();

      try {
        // Find task in array and update it
        var task = tasks.find(function (t) { return t.filename === newTask.filename; });
        if (!task) {
          ForgeUtils.Toast.show('Task not found', 'error');
          return;
        }

        // Update all fields
        Object.keys(newTask).forEach(function (key) {
          task[key] = newTask[key];
        });

        // Trigger auto-save
        markChanged(task);
        renderTasks();
        this.close();
        ForgeUtils.Toast.show('Task saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     List View Renderer
     ══════════════════════════════════════════════════════════ */
  function renderList() {
    var listEl = $('[data-ref="list-view"]');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!tasksDirHandle) {
      listEl.innerHTML =
        '<div class="prod-not-active">' +
          '<div class="prod-state-icon"><i class="fa-solid fa-list-check"></i></div>' +
          '<h2>No tasks directory found</h2>' +
          '<p>The <code>tasks/</code> directory was not found in your project root.</p>' +
        '</div>';
      return;
    }

    // Group tasks by status
    var statuses = ['active', 'waiting', 'someday', 'done'];
    var statusLabels = {
      'active': 'Active',
      'waiting': 'Waiting On',
      'someday': 'Someday',
      'done': 'Done'
    };
    var statusIcons = {
      'active': 'fa-regular fa-square-caret-right',
      'waiting': 'fa-regular fa-circle-pause',
      'someday': 'fa-regular fa-calendar',
      'done': 'fa-regular fa-square-check'
    };
    var tasksByStatus = {};
    statuses.forEach(function (status) { tasksByStatus[status] = []; });

    tasks.forEach(function (task) {
      var status = task.status || 'active';
      if (!tasksByStatus[status]) tasksByStatus[status] = [];
      tasksByStatus[status].push(task);
    });

    /* Sections */
    statuses.forEach(function (status) {
      var statusTasks = tasksByStatus[status] || [];
      var sectionEl = document.createElement('div');
      sectionEl.className = 'prod-list-section';
      sectionEl.dataset.status = status;

      var header = document.createElement('div');
      header.className = 'prod-list-section-header';
      header.innerHTML =
        '<span class="prod-section-title"><i class="' + statusIcons[status] + '"></i> ' + esc(statusLabels[status]) + '</span>' +
        '<span class="prod-count">' + statusTasks.length + '</span>';

      sectionEl.appendChild(header);

      var tasksContainer = document.createElement('div');
      tasksContainer.className = 'prod-list-tasks-container';
      tasksContainer.dataset.status = status;

      statusTasks.forEach(function (task) {
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
        console.log('[DRAG-DROP-LIST] Drop event fired');
        sectionEl.classList.remove('prod-drag-over');
        tasksContainer.querySelectorAll('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
        var taskFilename = e.dataTransfer.getData('text/plain');
        console.log('[DRAG-DROP-LIST] Task filename:', taskFilename);
        if (!taskFilename) {
          console.warn('[DRAG-DROP-LIST] No filename in dataTransfer');
          return;
        }
        moveTaskToStatus(taskFilename, status);
      });

      listEl.appendChild(sectionEl);
    });
  }

  function createListItem(task) {
    var item = document.createElement('div');
    item.className = 'prod-list-item';
    item.draggable = true;
    item.dataset.filename = task.filename;

    item.addEventListener('dragstart', function (e) {
      item.classList.add('prod-dragging');
      e.dataTransfer.setData('text/plain', task.filename);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function () {
      item.classList.remove('prod-dragging');
      // Global cleanup for list view
      document.querySelectorAll('.prod-list-drop-indicator').forEach(function (el) { el.remove(); });
      document.querySelectorAll('.prod-list-section.prod-drag-over').forEach(function (el) { el.classList.remove('prod-drag-over'); });
      // Also clean board view indicators in case of cross-view drags
      document.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      document.querySelectorAll('.prod-drag-over').forEach(function (el) { el.classList.remove('prod-drag-over'); });
    });

    var content = document.createElement('div');
    content.className = 'prod-list-item-content';

    var titleEl = document.createElement('div');
    titleEl.className = 'prod-list-item-title';
    titleEl.textContent = task.title;
    titleEl.addEventListener('click', function (e) {
      e.stopPropagation();
      startInlineEdit(titleEl, task.title, function (val) {
        if (val && val !== task.title) { task.title = val; markChanged(task); }
        renderTasks();
      });
    });
    content.appendChild(titleEl);

    if (fieldVisibility.priority) {
      var priorityClass = (task.priority || 'medium').toLowerCase();
      var priorityLabel = priorityClass.charAt(0).toUpperCase() + priorityClass.slice(1);
      var priorityPill = document.createElement('span');
      priorityPill.className = 'prod-priority-pill ' + priorityClass;
      priorityPill.textContent = priorityLabel;
      priorityPill.style.marginTop = '8px';
      content.appendChild(priorityPill);
    }

    if (fieldVisibility.assignee && task.assignee) {
      var assigneeEl = document.createElement('div');
      assigneeEl.className = 'prod-list-item-note';
      assigneeEl.innerHTML = '<i class="fa-regular fa-user-clock"></i> ' + esc(task.assignee);
      content.appendChild(assigneeEl);
    }

    if (fieldVisibility.due_date && task.due_date) {
      var today = new Date().toISOString().split('T')[0];
      var isOverdue = task.due_date < today && task.status !== 'done';
      var dueDateEl = document.createElement('div');
      dueDateEl.className = 'prod-list-item-note';
      dueDateEl.style.color = isOverdue ? '#e74c3c' : 'var(--text-muted)';
      dueDateEl.innerHTML = '<i class="fa-regular fa-calendar-day"></i> ' + esc(task.due_date);
      content.appendChild(dueDateEl);
    }

    if (fieldVisibility.dependencies && task.dependencies && task.dependencies.length > 0) {
      var depEl = document.createElement('div');
      depEl.className = 'prod-list-item-note';
      depEl.innerHTML = '<i class="fa-regular fa-link"></i> ' + task.dependencies.length + ' dependencies';
      content.appendChild(depEl);
    }

    if (fieldVisibility.external_id && task.external_id && task.external_id !== 'null') {
      var extIdEl = document.createElement('div');
      extIdEl.className = 'prod-list-item-note';
      extIdEl.innerHTML = '<i class="fa-solid fa-link-simple"></i> ' + esc(task.external_id);
      content.appendChild(extIdEl);
    }

    if (fieldVisibility.creator && task.creator && task.creator !== 'null') {
      var creatorEl = document.createElement('div');
      creatorEl.className = 'prod-list-item-note';
      creatorEl.innerHTML = '<i class="fa-regular fa-user-pen"></i> ' + esc(task.creator);
      content.appendChild(creatorEl);
    }

    if (fieldVisibility.type && task.type && task.type !== 'task') {
      var typeEl = document.createElement('div');
      typeEl.className = 'prod-list-item-note';
      typeEl.innerHTML = '<i class="fa-solid fa-list-check"></i> ' + esc(task.type);
      content.appendChild(typeEl);
    }

    if (fieldVisibility.tags && task.tags && task.tags.length > 0) {
      var tagsEl = document.createElement('div');
      tagsEl.className = 'prod-card-tags';
      task.tags.forEach(function (tag) {
        var tagSpan = document.createElement('span');
        tagSpan.className = 'prod-tag';
        tagSpan.textContent = tag;
        tagsEl.appendChild(tagSpan);
      });
      content.appendChild(tagsEl);
    }

    var actions = document.createElement('div');
    actions.className = 'prod-list-item-actions';
    actions.innerHTML = '<button title="Delete task"><i class="fa-regular fa-rectangle-xmark"></i></button>';
    actions.querySelector('button').addEventListener('click', function (e) {
      e.stopPropagation();
      deleteTask(task);
    });

    item.appendChild(content);
    item.appendChild(actions);
    return item;
  }

  /* ══════════════════════════════════════════════════════════
     Public API — init / destroy / refresh
     ══════════════════════════════════════════════════════════ */
  async function init(handle) {
    rootHandle = handle;

    if (!initialized) {
      scaffold();
      loadFieldVisibility();
      initialized = true;
    }

    /* Reset state */
    tasksDirHandle = null;
    tasks = [];
    hasChanges = false;

    /* Reset UI */
    currentView = 'board';
    switchTaskView('board');

    if (!rootHandle) {
      renderTasks();
      return;
    }

    /* Try loading tasks/ directory */
    try {
      var tasksPath = typeof rootHandle === 'string'
        ? rootHandle + '/tasks'
        : 'tasks';

      // Check if tasks directory exists
      var entries = await ForgeFS.readDir(rootHandle, 'tasks');

      tasksDirHandle = tasksPath;
      tasks = await parseTaskFiles();
      await loadTags();
      taskSignature = await buildTaskSignature();
      updateFolderBadge();
      renderTasks();
      startTaskWatching();
    } catch (e) {
      /* tasks/ directory does not exist — that's OK */
      renderTasks();
    }
  }

  function destroy() {
    stopTaskWatching();
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
  }

  async function refresh() {
    await handleRefresh();
  }

  return {
    init: init,
    destroy: destroy,
    refresh: refresh,
    isSuppressingToasts: function () { return suppressExternalToasts; }
  };
})();

Shell.registerController('tasks', window.TasksView);
