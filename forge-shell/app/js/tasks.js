/* ═══════════════════════════════════════════════════════════════
   Tasks View Controller
   Folder-based task management with Board + Analytics views inside #view-tasks.
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
  let saveTimeout = null;
  let taskWatchInterval = null;
  let isSaving = false;
  let taskRefreshRunning = false;
  let taskSignature = '';
  let suppressExternalToasts = false;

  /* ══════════════════════════════════════════════════════════
     Task Schema (canonical — see forge-lib/schemas/task.json)
     ══════════════════════════════════════════════════════════ */
  const STATUS_VALUES = ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
  const TERMINAL_STATUSES = ['Completed', 'Cancelled'];
  const PRIORITY_VALUES = [1, 2, 3, 4, 5];
  const DEFAULT_STATUS = 'Open';
  const DEFAULT_PRIORITY = 3;

  const STATUS_LABELS = {
    'Open': 'Open',
    'In Progress': 'In Progress',
    'Blocked': 'Blocked',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled',
  };
  const STATUS_ICONS = {
    'Open': 'fa-regular fa-circle',
    'In Progress': 'fa-regular fa-square-caret-right',
    'Blocked': 'fa-regular fa-circle-pause',
    'Completed': 'fa-regular fa-square-check',
    'Cancelled': 'fa-regular fa-circle-xmark',
  };
  const PRIORITY_LABELS = {
    1: 'P1 – Critical',
    2: 'P2 – High',
    3: 'P3 – Medium',
    4: 'P4 – Low',
    5: 'P5 – Someday',
  };
  // Reuse existing 3-class chip palette — no new CSS.
  const PRIORITY_CHIP_CLASS = {
    1: 'prod-chip-high',
    2: 'prod-chip-high',
    3: 'prod-chip-medium',
    4: 'prod-chip-low',
    5: 'prod-chip-low',
  };

  /* Active view tab */
  let activeView = 'board';

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

  /* View visibility settings */
  let viewVisibility = {
    board: true, timeline: true, summary: true, workload: true, matrix: true
  };
  let viewEditMode = false;

  /* Hide-done toggle */
  let hideDone = false;

  /* Search/filter state */
  let searchOpen = false;
  let searchQuery = '';
  let filterPriority = [];
  let filterStatus = [];
  let filterAssignee = '';
  let matchedFilenames = null;
  let searchDebounceTimer = null;
  var _keydownHandler = null;

  var VIEW_TABS = [
    { key: 'board', icon: 'fa-table-columns', label: 'Board' },
    { key: 'timeline', icon: 'fa-chart-gantt', label: 'Timeline' },
    { key: 'summary', icon: 'fa-chart-pie', label: 'Summary' },
    { key: 'workload', icon: 'fa-users', label: 'Workload' },
    { key: 'matrix', icon: 'fa-table-cells', label: 'Matrix' }
  ];

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
     Tooltip System
     ══════════════════════════════════════════════════════════ */
  var tooltip = {
    _el: null,
    _visible: false,

    show: function (e, html) {
      if (!this._el) this._el = document.querySelector('#view-tasks [data-ref="tooltip"]');
      if (!this._el) return;
      this._el.innerHTML = html;
      this._el.classList.add('prod-tooltip-visible');
      this._visible = true;
      this._position(e);
    },

    hide: function () {
      if (!this._el) return;
      this._el.classList.remove('prod-tooltip-visible');
      this._visible = false;
    },

    _position: function (e) {
      if (!this._el) return;
      var x = e.clientX + 12;
      var y = e.clientY + 12;
      var rect = this._el.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      if (x + rect.width + 8 > vw) x = e.clientX - rect.width - 12;
      if (y + rect.height + 8 > vh) y = e.clientY - rect.height - 12;
      this._el.style.left = x + 'px';
      this._el.style.top = y + 'px';
    }
  };

  function buildTooltipHtml(task) {
    var prioColors = { high: '#e74c3c', medium: '#f39c12', low: '#3498db' };
    var prio = (task.priority || 'medium').toLowerCase();
    var statusLabel = (task.status || 'active').charAt(0).toUpperCase() + (task.status || 'active').slice(1);
    var html = '<div class="prod-tooltip-title">' + esc(task.title) + '</div>';

    if (fieldVisibility.priority) {
      html += '<div class="prod-tooltip-row"><span class="prod-tooltip-dot" style="background:' + (prioColors[prio] || prioColors.medium) + '"></span>' + esc(prio.charAt(0).toUpperCase() + prio.slice(1)) + ' &middot; ' + esc(statusLabel) + '</div>';
    }
    if (fieldVisibility.assignee && task.assignee && task.assignee !== 'null') {
      html += '<div class="prod-tooltip-row"><i class="fa-regular fa-user" style="width:14px;text-align:center;"></i> ' + esc(task.assignee) + '</div>';
    }
    if (fieldVisibility.due_date && task.due_date && task.due_date !== 'null') {
      var today = new Date().toISOString().split('T')[0];
      var isOverdue = task.due_date < today && task.status !== 'done';
      html += '<div class="prod-tooltip-row' + (isOverdue ? ' prod-tooltip-overdue' : '') + '"><i class="fa-regular fa-calendar" style="width:14px;text-align:center;"></i> ' + esc(task.due_date) + (isOverdue ? ' (overdue)' : '') + '</div>';
    }
    if (fieldVisibility.tags && task.tags && task.tags.length > 0) {
      html += '<div class="prod-tooltip-row"><i class="fa-solid fa-tag" style="width:14px;text-align:center;"></i> ' + esc(task.tags.join(', ')) + '</div>';
    }
    if (fieldVisibility.type && task.type && task.type !== 'task' && task.type !== 'null') {
      html += '<div class="prod-tooltip-row"><i class="fa-solid fa-shapes" style="width:14px;text-align:center;"></i> ' + esc(task.type) + '</div>';
    }
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     Color Hashing Helper
     ══════════════════════════════════════════════════════════ */
  function hashColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var hue = Math.abs(hash % 360);
    return 'hsl(' + hue + ', 55%, 50%)';
  }

  function getInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  /* ══════════════════════════════════════════════════════════
     Search/Filter Helpers
     ══════════════════════════════════════════════════════════ */
  function isTaskMatched(task) {
    if (matchedFilenames === null) return true;
    return matchedFilenames.has(task.filename);
  }

  function getFilteredTasks() {
    if (matchedFilenames === null) return tasks;
    return tasks.filter(function (t) { return matchedFilenames.has(t.filename); });
  }

  function computeFilteredSet() {
    var noFilters = !searchQuery && filterPriority.length === 0 &&
                    filterStatus.length === 0 && !filterAssignee;
    if (noFilters) {
      matchedFilenames = null;
      return;
    }

    matchedFilenames = new Set();
    var q = searchQuery.toLowerCase();

    tasks.forEach(function (task) {
      if (filterPriority.length > 0) {
        if (filterPriority.indexOf((task.priority || 'medium').toLowerCase()) === -1) return;
      }
      if (filterStatus.length > 0) {
        if (filterStatus.indexOf((task.status || 'active').toLowerCase()) === -1) return;
      }
      if (filterAssignee) {
        if ((task.assignee || '').toLowerCase() !== filterAssignee.toLowerCase()) return;
      }
      if (q) {
        var haystack = [
          task.title || '',
          (task.tags || []).join(' '),
          task.assignee || '',
          task.creator || '',
          task.external_id || ''
        ].join(' ').toLowerCase();
        if (haystack.indexOf(q) === -1) return;
      }

      matchedFilenames.add(task.filename);
    });
  }

  function updateFilterCount() {
    var el = $('[data-ref="filter-count"]');
    if (!el) return;
    if (matchedFilenames === null) {
      el.textContent = tasks.length + ' tasks';
    } else {
      el.textContent = matchedFilenames.size + ' of ' + tasks.length + ' tasks';
    }
  }

  function populateAssigneeDropdown() {
    var select = $('[data-ref="assignee-filter"]');
    if (!select) return;
    var assignees = [];
    tasks.forEach(function (t) {
      if (t.assignee && t.assignee !== 'null' && assignees.indexOf(t.assignee) === -1) {
        assignees.push(t.assignee);
      }
    });
    assignees.sort();
    select.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    select.appendChild(allOpt);
    assignees.forEach(function (a) {
      var opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      if (filterAssignee === a) opt.selected = true;
      select.appendChild(opt);
    });
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
          '<div class="view-toggle" data-ref="view-tabs">' +
            '<button data-tasks-view="board" class="active"><i class="fa-solid fa-table-columns"></i> Board</button>' +
            '<button data-tasks-view="timeline"><i class="fa-solid fa-chart-gantt"></i> Timeline</button>' +
            '<button data-tasks-view="summary"><i class="fa-solid fa-chart-pie"></i> Summary</button>' +
            '<button data-tasks-view="workload"><i class="fa-solid fa-users"></i> Workload</button>' +
            '<button data-tasks-view="matrix"><i class="fa-solid fa-table-cells"></i> Matrix</button>' +
          '</div>' +
          '<span class="spacer"></span>' +
          '<span class="refresh-indicator" data-ref="refresh-indicator"></span>' +
          '<button class="btn-icon" data-action="toggle-search" title="Search (Cmd+F)"><i class="fa-solid fa-magnifying-glass"></i></button>' +
          '<button class="btn-icon" data-action="view-edit-mode" title="Customize Views"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon" data-action="field-settings" title="Filter Fields"><i class="fa-solid fa-filter"></i></button>' +
          '<button class="btn-icon" data-action="hide-done" title="Hide Done Tasks"><i class="fa-solid fa-circle-check"></i></button>' +
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Filter Strip */
        '<div class="prod-filter-strip" data-ref="filter-strip">' +
          '<div class="prod-filter-strip-inner">' +
            '<div class="prod-filter-search">' +
              '<i class="fa-solid fa-magnifying-glass"></i>' +
              '<input type="text" placeholder="Search tasks\u2026" data-ref="search-input" aria-label="Search tasks">' +
            '</div>' +
            '<div class="prod-filter-group">' +
              '<span class="prod-filter-label">Priority</span>' +
              '<button class="prod-filter-chip prod-chip-high" data-filter="priority" data-value="high" aria-pressed="false">High</button>' +
              '<button class="prod-filter-chip prod-chip-medium" data-filter="priority" data-value="medium" aria-pressed="false">Medium</button>' +
              '<button class="prod-filter-chip prod-chip-low" data-filter="priority" data-value="low" aria-pressed="false">Low</button>' +
            '</div>' +
            '<div class="prod-filter-group">' +
              '<span class="prod-filter-label">Status</span>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="active" aria-pressed="false">Active</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="waiting" aria-pressed="false">Waiting</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="someday" aria-pressed="false">Someday</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="done" data-ref="chip-done" aria-pressed="false">Done</button>' +
            '</div>' +
            '<div class="prod-filter-group">' +
              '<span class="prod-filter-label">Assignee</span>' +
              '<select data-ref="assignee-filter" aria-label="Filter by assignee"><option value="">All</option></select>' +
            '</div>' +
            '<div class="prod-filter-meta">' +
              '<span class="prod-filter-count" data-ref="filter-count" role="status"></span>' +
              '<button class="btn-icon prod-filter-clear" data-action="clear-filters" title="Clear all filters"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* View Panels */
        '<div class="prod-tab-panel prod-active" data-view-panel="board">' +
          '<div class="prod-board" data-ref="board"></div>' +
        '</div>' +
        '<div class="prod-tab-panel" data-view-panel="timeline">' +
          '<div class="prod-view-body" data-view-body="timeline"></div>' +
        '</div>' +
        '<div class="prod-tab-panel" data-view-panel="summary">' +
          '<div class="prod-view-body" data-view-body="summary"></div>' +
        '</div>' +
        '<div class="prod-tab-panel" data-view-panel="workload">' +
          '<div class="prod-view-body" data-view-body="workload"></div>' +
        '</div>' +
        '<div class="prod-tab-panel" data-view-panel="matrix">' +
          '<div class="prod-view-body" data-view-body="matrix"></div>' +
        '</div>' +

        /* Settings Modal */
        '<div class="task-settings-overlay" data-ref="settings-overlay" style="display:none;">' +
          '<div class="task-settings-modal">' +
            '<div class="task-settings-header">' +
              '<h3>Field Visibility Settings</h3>' +
              '<button class="btn-icon" data-action="close-settings"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="task-settings-body" data-ref="settings-body">' +
              '<p style="margin-bottom:16px;color:var(--text-muted);font-size:13px;">Customize which metadata fields appear on task cards and hover tooltips.</p>' +
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

        /* Tooltip */
        '<div class="prod-tooltip" data-ref="tooltip"></div>' +

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
      else if (action === 'view-edit-mode') toggleViewEditMode();
      else if (action === 'hide-done') toggleHideDone();
      else if (action === 'toggle-search') toggleSearchStrip();
      else if (action === 'clear-filters') clearAllFilters();
    });

    /* Search input (debounced) */
    view.addEventListener('input', function (e) {
      if (!e.target.matches('[data-ref="search-input"]')) return;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function () {
        searchQuery = e.target.value.trim();
        applyFilters();
      }, 150);
    });

    /* Filter chips */
    view.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      var filterType = chip.dataset.filter;
      var value = chip.dataset.value;

      if (filterType === 'priority') {
        var idx = filterPriority.indexOf(value);
        if (idx === -1) filterPriority.push(value);
        else filterPriority.splice(idx, 1);
        chip.classList.toggle('active');
        chip.setAttribute('aria-pressed', chip.classList.contains('active'));
      } else if (filterType === 'status') {
        var idx = filterStatus.indexOf(value);
        if (idx === -1) filterStatus.push(value);
        else filterStatus.splice(idx, 1);
        chip.classList.toggle('active');
        chip.setAttribute('aria-pressed', chip.classList.contains('active'));
      }
      applyFilters();
    });

    /* Assignee dropdown */
    view.addEventListener('change', function (e) {
      if (!e.target.matches('[data-ref="assignee-filter"]')) return;
      filterAssignee = e.target.value;
      applyFilters();
    });

    /* Keyboard shortcut: Cmd/Ctrl+F */
    _keydownHandler = function (e) {
      var tasksView = document.getElementById('view-tasks');
      if (!tasksView || !tasksView.classList.contains('active')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchStrip();
      }
      if (e.key === 'Escape' && searchOpen) {
        clearAllFilters();
        toggleSearchStrip();
      }
    };
    document.addEventListener('keydown', _keydownHandler);

    /* View tab switching (with eye toggle interception) */
    view.addEventListener('click', function (e) {
      var eye = e.target.closest('.prod-view-eye-toggle');
      if (eye) {
        toggleViewVisibility(eye.dataset.viewName);
        return;
      }
      var btn = e.target.closest('[data-tasks-view]');
      if (btn) { switchView(btn.dataset.tasksView); }
    });

    /* Delegated click on [data-task-id] elements (analytics views) */
    view.addEventListener('click', function (e) {
      var el = e.target.closest('[data-task-id]');
      if (!el) return;
      /* Don't intercept board card clicks (they have their own handler) */
      if (e.target.closest('.prod-task-card')) return;
      var filename = el.dataset.taskId;
      var task = tasks.find(function (t) { return t.filename === filename; });
      if (task) editModal.open(task);
    });

    /* Delegated hover on [data-task-id] for tooltip */
    view.addEventListener('mouseover', function (e) {
      var el = e.target.closest('[data-task-id]');
      if (!el || e.target.closest('.prod-task-card')) return;
      var filename = el.dataset.taskId;
      var task = tasks.find(function (t) { return t.filename === filename; });
      if (task) tooltip.show(e, buildTooltipHtml(task));
    });

    view.addEventListener('mousemove', function (e) {
      var el = e.target.closest('[data-task-id]');
      if (!el || e.target.closest('.prod-task-card')) return;
      if (tooltip._visible) tooltip._position(e);
    });

    view.addEventListener('mouseout', function (e) {
      var el = e.target.closest('[data-task-id]');
      if (!el) return;
      if (!el.contains(e.relatedTarget)) tooltip.hide();
    });

    /* Workload lane expand/collapse */
    view.addEventListener('click', function (e) {
      var header = e.target.closest('.prod-wl-lane-header');
      if (!header) return;
      var lane = header.closest('.prod-workload-lane');
      if (lane) lane.classList.toggle('prod-wl-expanded');
    });

    /* Matrix cell expand */
    view.addEventListener('click', function (e) {
      var expandBtn = e.target.closest('.prod-matrix-expand');
      if (!expandBtn) return;
      var cell = expandBtn.closest('.prod-matrix-cell');
      if (cell) cell.classList.toggle('prod-matrix-cell-expanded');
    });
  }

  /* ══════════════════════════════════════════════════════════
     Active View State
     ══════════════════════════════════════════════════════════ */
  function loadActiveView() {
    try {
      var stored = localStorage.getItem('forge-shell-tasks-active-view');
      if (stored && ['board','timeline','summary','workload','matrix'].indexOf(stored) !== -1) {
        activeView = stored;
      }
      /* Fall back to first visible tab if active view is hidden */
      if (!viewVisibility[activeView]) {
        var first = VIEW_TABS.find(function (t) { return viewVisibility[t.key]; });
        if (first) activeView = first.key;
      }
      localStorage.removeItem('forge-shell-tasks-analytics-panels');
      localStorage.removeItem('forge-shell-tasks-analytics-collapsed');
    } catch (e) { /* ignore */ }
  }

  function saveActiveView() {
    try { localStorage.setItem('forge-shell-tasks-active-view', activeView); }
    catch (e) { /* ignore */ }
  }

  function switchView(viewName) {
    if (viewName === activeView) return;
    if (!viewEditMode && !viewVisibility[viewName]) return;
    activeView = viewName;
    saveActiveView();
    syncActiveView();
    renderActiveView();
  }

  function syncActiveView() {
    $$('[data-tasks-view]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tasksView === activeView);
    });
    $$('[data-view-panel]').forEach(function (panel) {
      panel.classList.toggle('prod-active', panel.dataset.viewPanel === activeView);
    });
  }

  function renderActiveView() {
    if (activeView === 'board') renderBoard();
    else if (activeView === 'timeline') renderTimeline();
    else if (activeView === 'summary') renderSummary();
    else if (activeView === 'workload') renderWorkload();
    else if (activeView === 'matrix') renderMatrix();
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
  // matching the task-NNN.md pattern (with optional slug suffix), replacing the old index.json lookup.
  async function parseTaskFiles() {
    if (!tasksDirHandle) return [];

    var resultTasks = [];

    try {
      var entries = await ForgeFS.readDir(tasksDirHandle, '.');

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];

        if (entry.kind === 'file' && /^task-\d{3}(-.*)?\.md$/.test(entry.name)) {
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
        if (file.kind === 'file' && /^task-\d{3}(-.*)?\.md$/.test(file.name)) {
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
        if (matchedFilenames !== null) {
          computeFilteredSet();
          updateFilterCount();
        }
        populateAssigneeDropdown();
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
     Search Strip Toggle / Clear / Apply
     ══════════════════════════════════════════════════════════ */
  function toggleSearchStrip() {
    searchOpen = !searchOpen;
    var strip = $('[data-ref="filter-strip"]');
    if (!strip) return;
    strip.classList.toggle('prod-strip-open', searchOpen);
    if (searchOpen) {
      populateAssigneeDropdown();
      updateFilterCount();
      syncHideDoneChip();
      var input = $('[data-ref="search-input"]');
      if (input) setTimeout(function () { input.focus(); }, 50);
    }
    try { localStorage.setItem('forge-shell-tasks-search-open', searchOpen ? '1' : '0'); }
    catch (e) { /* ignore */ }
  }

  function clearAllFilters() {
    searchQuery = '';
    filterPriority = [];
    filterStatus = [];
    filterAssignee = '';
    matchedFilenames = null;

    var input = $('[data-ref="search-input"]');
    if (input) input.value = '';

    $$('[data-filter]').forEach(function (chip) {
      chip.classList.remove('active');
      chip.setAttribute('aria-pressed', 'false');
    });

    var select = $('[data-ref="assignee-filter"]');
    if (select) select.value = '';

    updateFilterCount();
    renderTasks();
  }

  function applyFilters() {
    computeFilteredSet();
    updateFilterCount();
    renderTasks();
  }

  function syncHideDoneChip() {
    var doneChip = $('[data-ref="chip-done"]');
    if (doneChip) {
      doneChip.style.display = hideDone ? 'none' : '';
      if (hideDone) {
        var idx = filterStatus.indexOf('done');
        if (idx !== -1) {
          filterStatus.splice(idx, 1);
          doneChip.classList.remove('active');
          doneChip.setAttribute('aria-pressed', 'false');
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     Render Tasks — board + active analytics panels
     ══════════════════════════════════════════════════════════ */
  function renderTasks() {
    renderActiveView();
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
    var statuses = hideDone
      ? STATUS_VALUES.filter(function (s) { return !TERMINAL_STATUSES.includes(s); })
      : STATUS_VALUES.slice();
    var tasksByStatus = {};
    statuses.forEach(function (status) { tasksByStatus[status] = []; });

    tasks.forEach(function (task) {
      var status = task.status || 'active';
      if (!tasksByStatus[status]) tasksByStatus[status] = [];
      tasksByStatus[status].push(task);
    });

    statuses.forEach(function (status) {
      var statusTasks = tasksByStatus[status] || [];
      board.appendChild(createColumn(status, STATUS_LABELS[status], STATUS_ICONS[status], statusTasks));
    });
  }

  function createColumn(colId, label, icon, items) {
    var col = document.createElement('div');
    col.className = 'prod-column';

    var matchedCount = matchedFilenames !== null
      ? items.filter(function (t) { return isTaskMatched(t); }).length
      : items.length;
    var countLabel = matchedFilenames !== null
      ? matchedCount + ' / ' + items.length
      : '' + items.length;

    col.innerHTML =
      '<div class="prod-column-header">' +
        '<span class="prod-column-title" data-status="' + esc(colId) + '"><i class="' + icon + '"></i> ' + esc(label) + '</span>' +
        '<span class="prod-count">' + esc(countLabel) + '</span>' +
      '</div>' +
      '<div class="prod-cards" data-column="' + esc(colId) + '"></div>' +
      '<div class="prod-add-card"><button data-add="' + esc(colId) + '">+ Add task</button></div>';

    /* Populate cards */
    var cardsContainer = col.querySelector('.prod-cards');
    items.forEach(function (task) { cardsContainer.appendChild(createCard(task)); });

    /* Show empty state when all cards in column are filtered out */
    if (matchedFilenames !== null && matchedCount === 0 && items.length > 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'padding:16px;text-align:center;color:var(--text-muted);font-size:12px;';
      emptyMsg.textContent = 'No matching tasks';
      cardsContainer.appendChild(emptyMsg);
    }

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

    /* Apply filter dimming/highlighting */
    if (matchedFilenames !== null) {
      if (isTaskMatched(task)) {
        card.classList.add('prod-card-matched');
      } else {
        card.classList.add('prod-card-dimmed');
        card.draggable = false;
      }
    }

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
      var match = t.filename.match(/^task-(\d{3})/);
      if (match) {
        var num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    var newNum = maxNum + 1;
    var newFilename = 'task-' + String(newNum).padStart(3, '0') + '.md';
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

  /* ══════════════════════════════════════════════════════════
     View Visibility Settings
     ══════════════════════════════════════════════════════════ */
  function loadViewVisibility() {
    try {
      var stored = localStorage.getItem('forge-shell-tasks-view-visibility');
      if (stored) {
        var parsed = JSON.parse(stored);
        viewVisibility = Object.assign({}, viewVisibility, parsed);
      }
    } catch (e) { /* ignore */ }
  }

  function saveViewVisibility() {
    try {
      localStorage.setItem('forge-shell-tasks-view-visibility', JSON.stringify(viewVisibility));
    } catch (e) { /* ignore */ }
  }

  function loadHideDone() {
    try {
      hideDone = localStorage.getItem('forge-shell-tasks-hide-done') === 'true';
    } catch (e) { /* ignore */ }
  }

  function saveHideDone() {
    try {
      localStorage.setItem('forge-shell-tasks-hide-done', String(hideDone));
    } catch (e) { /* ignore */ }
  }

  function toggleViewEditMode() {
    viewEditMode = !viewEditMode;

    /* Update pencil/check icon */
    var btn = $('[data-action="view-edit-mode"]');
    if (btn) {
      var icon = btn.querySelector('i');
      if (viewEditMode) {
        icon.className = 'fa-solid fa-check';
        btn.title = 'Done editing';
      } else {
        icon.className = 'fa-solid fa-pen';
        btn.title = 'Customize Views';
      }
    }

    /* If exiting edit mode and active view is now hidden, switch to first visible */
    if (!viewEditMode && !viewVisibility[activeView]) {
      var first = VIEW_TABS.find(function (t) { return viewVisibility[t.key]; });
      if (first) {
        activeView = first.key;
        saveActiveView();
        syncActiveView();
        renderActiveView();
      }
    }

    syncViewTabs();
  }

  function toggleHideDone() {
    hideDone = !hideDone;
    saveHideDone();

    var btn = $('[data-action="hide-done"]');
    if (btn) {
      btn.classList.toggle('rm-active', hideDone);
      btn.title = hideDone ? 'Show Done Tasks' : 'Hide Done Tasks';
    }

    syncHideDoneChip();
    if (matchedFilenames !== null) applyFilters();

    renderActiveView();
  }

  function toggleViewVisibility(viewName) {
    /* Guard: don't hide the last visible tab */
    if (viewVisibility[viewName]) {
      var visibleCount = VIEW_TABS.filter(function (t) { return viewVisibility[t.key]; }).length;
      if (visibleCount <= 1) {
        ForgeUtils.Toast.show('At least one view must remain visible', 'warning');
        return;
      }
    }

    viewVisibility[viewName] = !viewVisibility[viewName];
    saveViewVisibility();
    syncViewTabs();
  }

  function syncViewTabs() {
    var container = $('[data-ref="view-tabs"]');
    if (!container) return;

    var html = '';
    VIEW_TABS.forEach(function (tab) {
      var isVisible = viewVisibility[tab.key];

      /* In normal mode, skip hidden tabs */
      if (!viewEditMode && !isVisible) return;

      var cls = [];
      if (tab.key === activeView) cls.push('active');
      if (!isVisible) cls.push('prod-view-hidden');

      html += '<button data-tasks-view="' + tab.key + '"';
      if (cls.length) html += ' class="' + cls.join(' ') + '"';
      html += '><i class="fa-solid ' + tab.icon + '"></i> ' + tab.label;

      if (viewEditMode) {
        var eyeIcon = isVisible ? 'fa-eye' : 'fa-eye-slash';
        html += ' <span class="prod-view-eye-toggle" data-view-name="' + tab.key + '"><i class="fa-solid ' + eyeIcon + '"></i></span>';
      }

      html += '</button>';
    });

    container.innerHTML = html;

    /* Toggle layout class for CSS targeting */
    var layout = $('.prod-layout');
    if (layout) layout.classList.toggle('prod-view-edit-mode', viewEditMode);
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
     Analytics Panel Renderers
     ══════════════════════════════════════════════════════════ */
  function renderEmptyPanel(bodyEl, icon, message) {
    bodyEl.innerHTML =
      '<div class="prod-analytics-empty">' +
        '<i class="' + icon + '"></i>' +
        '<p>' + message + '</p>' +
      '</div>';
  }

  /* ── Timeline View ── */
  function renderTimeline() {
    var body = $('[data-view-body="timeline"]');
    if (!body) return;

    if (tasks.length === 0) {
      renderEmptyPanel(body, 'fa-solid fa-chart-gantt', 'No tasks to display on timeline');
      return;
    }

    var today = new Date().toISOString().split('T')[0];
    var prioColors = { high: '#e74c3c', medium: '#f39c12', low: '#3498db' };
    var withDates = [];
    var noDates = [];

    var timelineTasks = hideDone ? tasks.filter(function (t) { return t.status !== 'done'; }) : tasks;
    timelineTasks.forEach(function (t) {
      if (t.created && t.due_date && t.due_date !== 'null') withDates.push(t);
      else noDates.push(t);
    });

    if (withDates.length === 0 && noDates.length === 0) {
      renderEmptyPanel(body, 'fa-solid fa-chart-gantt', 'No tasks to display on timeline');
      return;
    }

    // Compute date range
    var allDates = [];
    withDates.forEach(function (t) {
      allDates.push(t.created);
      allDates.push(t.due_date);
    });
    allDates.push(today);
    allDates.sort();

    var rangeStart = new Date(allDates[0]);
    var rangeEnd = new Date(allDates[allDates.length - 1]);
    rangeStart.setDate(rangeStart.getDate() - 7);
    rangeEnd.setDate(rangeEnd.getDate() + 14);
    var rangeDays = Math.max(1, Math.ceil((rangeEnd - rangeStart) / 86400000));

    function dayOffset(dateStr) {
      return Math.max(0, Math.ceil((new Date(dateStr) - rangeStart) / 86400000));
    }

    // Month labels
    var months = generateMonthLabels(rangeStart, rangeEnd, rangeDays);

    // Week grid lines (Mondays)
    var weeks = generateWeekLines(rangeStart, rangeEnd, rangeDays);

    var todayPct = (dayOffset(today) / rangeDays) * 100;

    var html = '<div class="prod-timeline">';

    // Sticky header
    html += '<div class="prod-tl-header">';
    html += '<div class="prod-tl-label-col"></div>';
    html += '<div class="prod-tl-track-col">';
    months.forEach(function (m) {
      html += '<span class="prod-tl-month" style="left:' + m.pct + '%">' + esc(m.label) + '</span>';
    });
    html += '<div class="prod-tl-today-label" style="left:' + todayPct + '%">Today</div>';
    html += '</div></div>';

    // Scrollable body
    html += '<div class="prod-tl-body">';

    withDates.forEach(function (t) {
      var startPct = (dayOffset(t.created) / rangeDays) * 100;
      var endPct = (dayOffset(t.due_date) / rangeDays) * 100;
      var width = Math.max(1, endPct - startPct);
      var prio = (t.priority || 'medium').toLowerCase();
      var isOverdue = t.due_date < today && t.status !== 'done';

      var tlDimmed = (matchedFilenames !== null && !isTaskMatched(t)) ? ' prod-tl-dimmed' : '';
      html += '<div class="prod-tl-row' + tlDimmed + '" data-task-id="' + esc(t.filename) + '">';

      // Label column: priority dot + title + assignee initial
      html += '<div class="prod-tl-label-col">';
      html += '<span class="prod-tl-prio-dot" style="background:' + (prioColors[prio] || prioColors.medium) + '"></span>';
      html += '<span class="prod-tl-title" title="' + esc(t.title) + '">' + esc(t.title) + '</span>';
      if (t.assignee && t.assignee !== 'null') {
        html += '<span class="prod-tl-avatar" style="background:' + hashColor(t.assignee) + '">' + getInitial(t.assignee) + '</span>';
      }
      html += '</div>';

      // Track column with week grid + today line + bar
      html += '<div class="prod-tl-track-col">';
      weeks.forEach(function (w) {
        html += '<div class="prod-tl-week-line" style="left:' + w.pct + '%"></div>';
      });
      html += '<div class="prod-tl-today" style="left:' + todayPct + '%"></div>';
      html += '<div class="prod-tl-bar prod-tl-' + prio + (isOverdue ? ' prod-tl-overdue' : '') + '" style="left:' + startPct + '%;width:' + width + '%"></div>';
      html += '</div></div>';
    });

    html += '</div></div>';

    // No-date chips
    if (noDates.length > 0) {
      html += '<div class="prod-tl-no-dates"><span class="prod-tl-no-dates-label"><i class="fa-regular fa-calendar-xmark"></i> No due date</span>';
      noDates.forEach(function (t) {
        var prio = (t.priority || 'medium').toLowerCase();
        var chipDimmed = (matchedFilenames !== null && !isTaskMatched(t)) ? ' prod-tl-dimmed' : '';
        html += '<span class="prod-tl-chip prod-tl-' + prio + chipDimmed + '" data-task-id="' + esc(t.filename) + '">' + esc(t.title) + '</span>';
      });
      html += '</div>';
    }

    body.innerHTML = html;
  }

  function generateMonthLabels(rangeStart, rangeEnd, rangeDays) {
    var labels = [];
    var d = new Date(rangeStart);
    d.setDate(1);
    if (d < rangeStart) d.setMonth(d.getMonth() + 1);

    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    while (d <= rangeEnd) {
      var dayOff = Math.ceil((d - rangeStart) / 86400000);
      var pct = (dayOff / rangeDays) * 100;
      labels.push({ label: monthNames[d.getMonth()] + ' ' + d.getFullYear(), pct: pct });
      d.setMonth(d.getMonth() + 1);
    }
    return labels;
  }

  function generateWeekLines(rangeStart, rangeEnd, rangeDays) {
    var lines = [];
    var d = new Date(rangeStart);
    // Find first Monday
    var dow = d.getDay();
    var daysToMonday = dow === 0 ? 1 : (8 - dow) % 7;
    d.setDate(d.getDate() + daysToMonday);

    while (d <= rangeEnd) {
      var dayOff = Math.ceil((d - rangeStart) / 86400000);
      var pct = (dayOff / rangeDays) * 100;
      lines.push({ pct: pct });
      d.setDate(d.getDate() + 7);
    }
    return lines;
  }

  /* ── Summary Dashboard ── */
  function renderSummary() {
    var body = $('[data-view-body="summary"]');
    if (!body) return;

    if (tasks.length === 0) {
      renderEmptyPanel(body, 'fa-solid fa-chart-pie', 'No tasks to summarize');
      return;
    }

    var sourceTasks = getFilteredTasks();
    var isFiltered = matchedFilenames !== null;
    var today = new Date().toISOString().split('T')[0];
    var total = sourceTasks.length;
    var overdue = 0;
    var done = 0;
    var nonDone = [];
    var statusCounts = { active: 0, waiting: 0, someday: 0, done: 0 };
    var priorityCounts = { high: 0, medium: 0, low: 0 };
    var tagCounts = {};

    sourceTasks.forEach(function (t) {
      var s = t.status || 'active';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
      if (s === 'done') done++;
      else nonDone.push(t);

      var p = (t.priority || 'medium').toLowerCase();
      if (priorityCounts[p] !== undefined) priorityCounts[p]++;

      if (t.due_date && t.due_date !== 'null' && t.due_date < today && s !== 'done') overdue++;

      if (t.tags && t.tags.length) {
        t.tags.forEach(function (tag) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    var avgAge = 0;
    if (nonDone.length > 0) {
      var todayMs = new Date(today).getTime();
      var totalDays = 0;
      nonDone.forEach(function (t) {
        if (t.created) totalDays += Math.max(0, Math.floor((todayMs - new Date(t.created).getTime()) / 86400000));
      });
      avgAge = Math.round(totalDays / nonDone.length);
    }

    var completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Velocity: last 30 days
    var thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    var thirtyAgoStr = thirtyAgo.toISOString().split('T')[0];
    var createdLast30 = 0;
    var completedLast30 = 0;
    var dailyCompletions = {};
    sourceTasks.forEach(function (t) {
      if (t.created && t.created >= thirtyAgoStr) createdLast30++;
      if (t.status === 'done' && t.updated && t.updated >= thirtyAgoStr) {
        completedLast30++;
        dailyCompletions[t.updated] = (dailyCompletions[t.updated] || 0) + 1;
      }
    });

    // Build sparkline data (last 30 days)
    var sparkDays = [];
    var sparkMax = 0;
    for (var i = 29; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var ds = d.toISOString().split('T')[0];
      var count = dailyCompletions[ds] || 0;
      if (count > sparkMax) sparkMax = count;
      sparkDays.push({ date: ds, count: count });
    }

    // Status donut gradient
    var statusColors = {
      'Open': 'var(--text-muted)',
      'In Progress': 'var(--accent)',
      'Blocked': '#f39c12',
      'Completed': '#27ae60',
      'Cancelled': '#6c757d',
    };
    var statusLabels = STATUS_LABELS;
    var statusColorRaw = {
      'Open': '#868e96',
      'In Progress': document.documentElement.getAttribute('data-theme') === 'dark' ? '#c76140' : '#4a6cf7',
      'Blocked': '#f39c12',
      'Completed': '#27ae60',
      'Cancelled': '#6c757d',
    };
    var conicParts = [];
    var cumPct = 0;
    STATUS_VALUES.slice().forEach(function (s) {
      var pct = total > 0 ? (statusCounts[s] / total) * 100 : 0;
      if (pct > 0) {
        conicParts.push(statusColorRaw[s] + ' ' + cumPct.toFixed(1) + '% ' + (cumPct + pct).toFixed(1) + '%');
        cumPct += pct;
      }
    });
    var conicGrad = conicParts.length > 0 ? conicParts.join(', ') : 'var(--border-light) 0% 100%';

    var html = '<div class="prod-summary-grid">';
    if (isFiltered) {
      html += '<div style="grid-column:1/-1;margin-bottom:-8px;"><span class="prod-filtered-badge">Filtered (' + sourceTasks.length + ' of ' + tasks.length + ')</span></div>';
    }

    // Stat cards with icons and top border accent
    var statCards = [
      { value: total, label: 'Total Tasks', icon: 'fa-solid fa-list-check', color: 'var(--accent)', alert: false },
      { value: overdue, label: 'Overdue', icon: 'fa-solid fa-clock', color: '#e74c3c', alert: overdue > 0 },
      { value: avgAge + 'd', label: 'Avg Age', icon: 'fa-solid fa-hourglass-half', color: '#f39c12', alert: false },
      { value: completionRate + '%', label: 'Completion', icon: 'fa-solid fa-chart-line', color: '#27ae60', alert: false }
    ];
    statCards.forEach(function (card) {
      html += '<div class="prod-stat-card' + (card.alert ? ' prod-stat-alert' : '') + '" style="border-top:3px solid ' + card.color + '">';
      html += '<div class="prod-stat-icon"><i class="' + card.icon + '" style="color:' + card.color + '"></i></div>';
      html += '<div class="prod-stat-value">' + card.value + '</div>';
      html += '<div class="prod-stat-label">' + card.label + '</div>';
      html += '</div>';
    });

    // Status donut + legend
    html += '<div class="prod-summary-section prod-summary-half">';
    html += '<div class="prod-summary-section-title">Status Breakdown</div>';
    html += '<div class="prod-summary-donut-row">';
    html += '<div class="prod-donut" style="background:conic-gradient(' + conicGrad + ')"><div class="prod-donut-hole">' + total + '</div></div>';
    html += '<div class="prod-donut-legend">';
    STATUS_VALUES.slice().forEach(function (s) {
      var count = statusCounts[s];
      html += '<div class="prod-donut-legend-item">';
      html += '<span class="prod-donut-swatch" style="background:' + statusColorRaw[s] + '"></span>';
      html += '<span class="prod-donut-legend-label">' + statusLabels[s] + '</span>';
      html += '<span class="prod-donut-legend-count">' + count + '</span>';
      html += '</div>';
    });
    html += '</div></div></div>';

    // Priority distribution with larger bars
    html += '<div class="prod-summary-section prod-summary-half">';
    html += '<div class="prod-summary-section-title">Priority Distribution</div>';
    var prioColors = { high: '#e74c3c', medium: '#f39c12', low: '#3498db' };
    var prioLabels = { high: 'High', medium: 'Medium', low: 'Low' };
    ['high', 'medium', 'low'].forEach(function (p) {
      var count = priorityCounts[p];
      var pct = total > 0 ? (count / total) * 100 : 0;
      html += '<div class="prod-summary-bar-row">';
      html += '<span class="prod-summary-bar-label">' + prioLabels[p] + '</span>';
      html += '<div class="prod-summary-bar-track"><div class="prod-summary-bar-fill" style="width:' + pct + '%;background:' + prioColors[p] + '"></div></div>';
      html += '<span class="prod-summary-bar-count">' + count + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // Velocity with sparkline
    html += '<div class="prod-summary-section prod-summary-full">';
    html += '<div class="prod-summary-section-title">Velocity (Last 30 Days)</div>';
    html += '<div class="prod-summary-velocity">';
    html += '<div class="prod-velocity-stat"><span class="prod-velocity-value">' + createdLast30 + '</span><span class="prod-velocity-label">Created</span></div>';
    html += '<div class="prod-velocity-stat"><span class="prod-velocity-value">' + completedLast30 + '</span><span class="prod-velocity-label">Completed</span></div>';
    var netFlow = createdLast30 - completedLast30;
    var netClass = netFlow > 0 ? 'prod-velocity-negative' : netFlow < 0 ? 'prod-velocity-positive' : '';
    html += '<div class="prod-velocity-stat ' + netClass + '"><span class="prod-velocity-value">' + (netFlow > 0 ? '+' : '') + netFlow + '</span><span class="prod-velocity-label">Net Flow</span></div>';
    html += '</div>';

    // Sparkline
    html += '<div class="prod-sparkline">';
    sparkDays.forEach(function (day) {
      var h = sparkMax > 0 ? Math.max(2, (day.count / sparkMax) * 100) : 2;
      var cls = day.count > 0 ? 'prod-spark-bar prod-spark-active' : 'prod-spark-bar';
      html += '<div class="' + cls + '" style="height:' + h + '%" title="' + day.date + ': ' + day.count + '"></div>';
    });
    html += '</div></div>';

    // Upcoming due tasks
    var upcoming = sourceTasks.filter(function (t) {
      return t.due_date && t.due_date !== 'null' && t.status !== 'done';
    }).sort(function (a, b) {
      return a.due_date.localeCompare(b.due_date);
    }).slice(0, 8);

    if (upcoming.length > 0) {
      html += '<div class="prod-summary-section prod-summary-full">';
      html += '<div class="prod-summary-section-title">Upcoming Due</div>';
      html += '<table class="prod-due-table"><tbody>';
      upcoming.forEach(function (t) {
        var prio = (t.priority || 'medium').toLowerCase();
        var isOverdue = t.due_date < today;
        html += '<tr class="prod-due-row' + (isOverdue ? ' prod-due-overdue' : '') + '" data-task-id="' + esc(t.filename) + '">';
        html += '<td><span class="prod-tl-prio-dot" style="background:' + (prioColors[prio] || prioColors.medium) + '"></span></td>';
        html += '<td class="prod-due-title">' + esc(t.title) + '</td>';
        html += '<td class="prod-due-assignee">' + (t.assignee && t.assignee !== 'null' ? esc(t.assignee) : '<span style="color:var(--text-muted)">—</span>') + '</td>';
        html += '<td class="prod-due-date">' + esc(t.due_date) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    // Tag breakdown
    var tagEntries = Object.keys(tagCounts).map(function (k) { return { tag: k, count: tagCounts[k] }; });
    tagEntries.sort(function (a, b) { return b.count - a.count; });
    tagEntries = tagEntries.slice(0, 10);
    if (tagEntries.length > 0) {
      html += '<div class="prod-summary-section prod-summary-full">';
      html += '<div class="prod-summary-section-title">Top Tags</div>';
      html += '<div class="prod-summary-tags-row">';
      tagEntries.forEach(function (entry) {
        html += '<div class="prod-summary-tag-row"><span class="prod-tag">' + esc(entry.tag) + '</span><span class="prod-summary-bar-count">' + entry.count + '</span></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    body.innerHTML = html;
  }

  /* ── Workload View ── */
  function renderWorkload() {
    var body = $('[data-view-body="workload"]');
    if (!body) return;

    if (tasks.length === 0) {
      renderEmptyPanel(body, 'fa-solid fa-users', 'No tasks to show workload');
      return;
    }

    var lanes = {};
    var unassigned = [];

    var workloadTasks = hideDone ? tasks.filter(function (t) { return t.status !== 'done'; }) : tasks;
    workloadTasks.forEach(function (t) {
      if (t.assignee && t.assignee !== 'null') {
        if (!lanes[t.assignee]) lanes[t.assignee] = [];
        lanes[t.assignee].push(t);
      } else {
        unassigned.push(t);
      }
    });

    var names = Object.keys(lanes).sort();
    var totalAssignees = names.length;
    var totalAssigned = workloadTasks.length - unassigned.length;

    // Imbalance check (based on filtered set when filters active)
    var imbalanceSource = matchedFilenames !== null
      ? function (laneTasks) { return laneTasks.filter(function (t) { return isTaskMatched(t); }).length; }
      : function (laneTasks) { return laneTasks.length; };
    var totalForImbalance = 0;
    names.forEach(function (n) { totalForImbalance += imbalanceSource(lanes[n]); });
    var avgLoad = totalAssignees > 0 ? totalForImbalance / totalAssignees : 0;
    var imbalanced = false;
    names.forEach(function (n) {
      if (imbalanceSource(lanes[n]) > avgLoad * 1.5) imbalanced = true;
    });

    var html = '';

    // Summary bar
    html += '<div class="prod-wl-summary-bar">';
    html += '<span class="prod-wl-summary-stat"><i class="fa-solid fa-users"></i> ' + totalAssignees + ' assignee' + (totalAssignees !== 1 ? 's' : '') + '</span>';
    html += '<span class="prod-wl-summary-stat"><i class="fa-solid fa-list-check"></i> ' + workloadTasks.length + ' task' + (workloadTasks.length !== 1 ? 's' : '') + '</span>';
    if (imbalanced) {
      html += '<span class="prod-wl-summary-warn"><i class="fa-solid fa-triangle-exclamation"></i> Workload imbalance detected</span>';
    }
    html += '</div>';

    // Lanes container
    html += '<div class="prod-wl-lanes">';
    names.forEach(function (name) {
      html += buildWorkloadLane(name, lanes[name], false);
    });
    if (unassigned.length > 0) {
      html += buildWorkloadLane('Unassigned', unassigned, true);
    }
    html += '</div>';

    body.innerHTML = html;
  }

  function buildWorkloadLane(name, laneTasks, isUnassigned) {
    var total = laneTasks.length;

    // Compute filtered lane tasks for status bar and counts
    var filteredLaneTasks = matchedFilenames !== null
      ? laneTasks.filter(function (t) { return isTaskMatched(t); })
      : laneTasks;
    var statusSource = matchedFilenames !== null ? filteredLaneTasks : laneTasks;
    var statusCounts = { active: 0, waiting: 0, someday: 0, done: 0 };
    statusSource.forEach(function (t) {
      var s = t.status || 'active';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    });
    var statusTotal = statusSource.length;

    // Status bar segments
    var statusColors = {
      'Open': '#868e96',
      'In Progress': document.documentElement.getAttribute('data-theme') === 'dark' ? '#c76140' : '#4a6cf7',
      'Blocked': '#f39c12',
      'Completed': '#27ae60',
      'Cancelled': '#6c757d',
    };

    var html = '<div class="prod-workload-lane prod-wl-expanded">';

    // Lane header
    html += '<div class="prod-wl-lane-header">';
    if (isUnassigned) {
      html += '<span class="prod-wl-avatar" style="background:var(--text-muted)"><i class="fa-solid fa-user-slash" style="font-size:12px;"></i></span>';
    } else {
      html += '<span class="prod-wl-avatar" style="background:' + hashColor(name) + '">' + getInitial(name) + '</span>';
    }
    html += '<div class="prod-wl-header-info">';
    html += '<span class="prod-wl-name">' + esc(name) + '</span>';
    html += '<div class="prod-wl-status-bar">';
    STATUS_VALUES.slice().forEach(function (s) {
      if (statusCounts[s] > 0) {
        var pct = statusTotal > 0 ? (statusCounts[s] / statusTotal) * 100 : 0;
        html += '<div class="prod-wl-status-seg" style="width:' + pct + '%;background:' + statusColors[s] + '" title="' + s + ': ' + statusCounts[s] + '"></div>';
      }
    });
    html += '</div></div>';
    var laneCountLabel = matchedFilenames !== null
      ? filteredLaneTasks.length + ' / ' + total
      : '' + total;
    html += '<span class="prod-wl-count">' + laneCountLabel + '</span>';
    html += '<span class="prod-wl-chevron"><i class="fa-solid fa-chevron-down"></i></span>';
    html += '</div>';

    // Expanded task grid
    html += '<div class="prod-wl-task-grid">';
    if (laneTasks.length === 0) {
      html += '<div class="prod-wl-empty">No tasks</div>';
    } else {
      var prioColors = { high: '#e74c3c', medium: '#f39c12', low: '#3498db' };
      var statusLabels = STATUS_LABELS;
      laneTasks.forEach(function (t) {
        var prio = (t.priority || 'medium').toLowerCase();
        var status = t.status || 'active';
        var wlDimmed = (matchedFilenames !== null && !isTaskMatched(t)) ? ' prod-wl-dimmed' : '';
        html += '<div class="prod-wl-mini-card' + wlDimmed + '" data-task-id="' + esc(t.filename) + '">';
        html += '<div class="prod-wl-mini-top">';
        html += '<span class="prod-tl-prio-dot" style="background:' + (prioColors[prio] || prioColors.medium) + '"></span>';
        html += '<span class="prod-wl-mini-title">' + esc(t.title) + '</span>';
        html += '</div>';
        html += '<div class="prod-wl-mini-bottom">';
        html += '<span class="prod-wl-mini-status prod-wl-status-' + status + '">' + (statusLabels[status] || status) + '</span>';
        if (t.due_date && t.due_date !== 'null') {
          var isOverdue = t.due_date < new Date().toISOString().split('T')[0] && status !== 'done';
          html += '<span class="prod-wl-mini-due' + (isOverdue ? ' prod-wl-mini-overdue' : '') + '"><i class="fa-regular fa-calendar"></i> ' + esc(t.due_date) + '</span>';
        }
        html += '</div></div>';
      });
    }
    html += '</div></div>';

    return html;
  }

  /* ── Matrix View ── */
  function renderMatrix() {
    var body = $('[data-view-body="matrix"]');
    if (!body) return;

    if (tasks.length === 0) {
      renderEmptyPanel(body, 'fa-solid fa-table-cells', 'No tasks to display in matrix');
      return;
    }

    var priorities = ['high', 'medium', 'low'];
    var statuses = hideDone
      ? STATUS_VALUES.filter(function (s) { return !TERMINAL_STATUSES.includes(s); })
      : STATUS_VALUES.slice();
    var statusLabels = STATUS_LABELS;
    var prioLabels = { high: 'High', medium: 'Medium', low: 'Low' };
    var prioColors = { high: '#e74c3c', medium: '#f39c12', low: '#3498db' };

    // Build matrix data
    var matrix = {};
    var maxCount = 0;
    var colTotals = {};
    var rowTotals = {};
    priorities.forEach(function (p) {
      matrix[p] = {};
      rowTotals[p] = 0;
      statuses.forEach(function (s) { matrix[p][s] = []; });
    });
    statuses.forEach(function (s) { colTotals[s] = 0; });

    var matrixTasks = hideDone ? tasks.filter(function (t) { return t.status !== 'done'; }) : tasks;
    matrixTasks.forEach(function (t) {
      var p = (t.priority || 'medium').toLowerCase();
      var s = t.status || 'active';
      if (!matrix[p]) matrix[p] = {};
      if (!matrix[p][s]) matrix[p][s] = [];
      matrix[p][s].push(t);
    });

    // Compute filtered counts for heat coloring and badges
    var filteredColTotals = {};
    var filteredRowTotals = {};
    priorities.forEach(function (p) { filteredRowTotals[p] = 0; });
    statuses.forEach(function (s) { filteredColTotals[s] = 0; });

    priorities.forEach(function (p) {
      statuses.forEach(function (s) {
        var cellTasks = matrix[p][s];
        var filteredCount = matchedFilenames !== null
          ? cellTasks.filter(function (t) { return isTaskMatched(t); }).length
          : cellTasks.length;
        if (filteredCount > maxCount) maxCount = filteredCount;
        colTotals[s] += cellTasks.length;
        rowTotals[p] += cellTasks.length;
        filteredColTotals[s] += filteredCount;
        filteredRowTotals[p] += filteredCount;
      });
    });

    // Use filtered counts for heat coloring
    var heatMax = 0;
    priorities.forEach(function (p) {
      statuses.forEach(function (s) {
        var fc = matchedFilenames !== null
          ? matrix[p][s].filter(function (t) { return isTaskMatched(t); }).length
          : matrix[p][s].length;
        if (fc > heatMax) heatMax = fc;
      });
    });

    // Detect dark theme for heat color
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var heatRGB = isDark ? '199, 97, 64' : '74, 108, 247';

    var displayColTotals = matchedFilenames !== null ? filteredColTotals : colTotals;
    var displayRowTotals = matchedFilenames !== null ? filteredRowTotals : rowTotals;

    var html = '<div class="prod-matrix-wrap"><table class="prod-matrix-table">';
    html += '<thead><tr><th></th>';
    statuses.forEach(function (s) {
      html += '<th>' + statusLabels[s] + ' <span class="prod-matrix-col-badge">' + displayColTotals[s] + '</span></th>';
    });
    html += '</tr></thead><tbody>';

    priorities.forEach(function (p) {
      html += '<tr>';
      html += '<td class="prod-matrix-row-label">' + prioLabels[p] + ' <span class="prod-matrix-row-badge">' + displayRowTotals[p] + '</span></td>';
      statuses.forEach(function (s) {
        var cellTasks = matrix[p][s];
        var filteredCellCount = matchedFilenames !== null
          ? cellTasks.filter(function (t) { return isTaskMatched(t); }).length
          : cellTasks.length;
        var intensity = heatMax > 0 ? (filteredCellCount / heatMax) * 0.35 : 0;
        var bg = 'rgba(' + heatRGB + ', ' + intensity.toFixed(2) + ')';

        html += '<td class="prod-matrix-cell" style="background:' + bg + '">';
        html += '<div class="prod-matrix-count">' + filteredCellCount + '</div>';
        if (cellTasks.length > 0) {
          html += '<div class="prod-matrix-cards">';
          var showCount = Math.min(cellTasks.length, 4);
          cellTasks.slice(0, showCount).forEach(function (t) {
            var tPrio = (t.priority || 'medium').toLowerCase();
            var mxDimmed = (matchedFilenames !== null && !isTaskMatched(t)) ? ' prod-matrix-dimmed' : '';
            html += '<div class="prod-matrix-mini' + mxDimmed + '" data-task-id="' + esc(t.filename) + '">';
            html += '<span class="prod-tl-prio-dot" style="background:' + (prioColors[tPrio] || prioColors.medium) + '"></span>';
            html += '<span class="prod-matrix-mini-title">' + esc(t.title) + '</span>';
            if (t.due_date && t.due_date !== 'null') {
              html += '<span class="prod-matrix-mini-due">' + esc(t.due_date) + '</span>';
            }
            html += '</div>';
          });
          // "+X more" counts only matching tasks
          var matchedOverflow = matchedFilenames !== null
            ? cellTasks.slice(4).filter(function (t) { return isTaskMatched(t); }).length
            : Math.max(0, cellTasks.length - 4);
          if (matchedOverflow > 0) {
            html += '<div class="prod-matrix-expand">+' + matchedOverflow + ' more</div>';
          }
          // Hidden overflow cards
          if (cellTasks.length > 4) {
            html += '<div class="prod-matrix-overflow">';
            cellTasks.slice(4).forEach(function (t) {
              var tPrio = (t.priority || 'medium').toLowerCase();
              var mxDimmed2 = (matchedFilenames !== null && !isTaskMatched(t)) ? ' prod-matrix-dimmed' : '';
              html += '<div class="prod-matrix-mini' + mxDimmed2 + '" data-task-id="' + esc(t.filename) + '">';
              html += '<span class="prod-tl-prio-dot" style="background:' + (prioColors[tPrio] || prioColors.medium) + '"></span>';
              html += '<span class="prod-matrix-mini-title">' + esc(t.title) + '</span>';
              html += '</div>';
            });
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    body.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════
     Public API — init / destroy / refresh
     ══════════════════════════════════════════════════════════ */
  async function init(handle) {
    rootHandle = handle;

    if (!initialized) {
      scaffold();
      loadFieldVisibility();
      loadViewVisibility();
      loadActiveView();
      loadHideDone();
      initialized = true;
    }

    /* Reset state */
    tasksDirHandle = null;
    tasks = [];
    hasChanges = false;

    /* Sync active view UI */
    syncActiveView();
    syncViewTabs();

    /* Sync hide-done button state */
    var hideDoneBtn = document.querySelector('#view-tasks [data-action="hide-done"]');
    if (hideDoneBtn) {
      hideDoneBtn.classList.toggle('rm-active', hideDone);
      hideDoneBtn.title = hideDone ? 'Show Done Tasks' : 'Hide Done Tasks';
    }

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
      populateAssigneeDropdown();
      renderTasks();
      startTaskWatching();

      /* Restore search strip open/closed state */
      try {
        var storedSearch = localStorage.getItem('forge-shell-tasks-search-open');
        if (storedSearch === '1') toggleSearchStrip();
      } catch (ignore) { /* ignore */ }
    } catch (e) {
      /* tasks/ directory does not exist — that's OK */
      renderTasks();
    }
  }

  function destroy() {
    stopTaskWatching();
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    if (_keydownHandler) {
      document.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
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
