/* ═══════════════════════════════════════════════════════════════
   Shell Core — Plugin definitions, nav, routing, edit mode,
   welcome screen, boot sequence, Forge Shell home view
   ═══════════════════════════════════════════════════════════════ */

// Plugin IDs match the view controller export names (e.g. 'product-forge-local',
// 'tasks', 'roadmap'). requiredDir gates plugin visibility to projects that
// contain the corresponding data directory.
const PLUGINS = [
  { id: 'forge-shell',         label: 'Forge Shell',      icon: 'fa-solid fa-terminal',       requiredDir: null },
  { id: 'cognitive-forge',     label: 'Cognitive Forge',  icon: 'fa-solid fa-scale-balanced', requiredDir: 'sessions' },
  { id: 'product-forge-local', label: 'Product Forge',    icon: 'fa-solid fa-clipboard-list', requiredDir: 'cards' },
  { id: 'roadmap',             label: 'Roadmap',          icon: 'fa-solid fa-road',           requiredDir: 'cards' },
  { id: 'tasks',               label: 'Tasks',            icon: 'fa-solid fa-list-check',     requiredDir: 'tasks' },
  { id: 'memory',              label: 'Memory',           icon: 'fa-solid fa-brain',          requiredDir: 'memory' },
  { id: 'rovo-agent-forge',    label: 'Rovo Agent Forge', icon: 'fa-solid fa-robot',          requiredDir: 'rovo-agents' },
  { id: 'report-forge',        label: 'Report Forge',     icon: 'fa-solid fa-file-lines',     requiredDir: 'reports' },
  { id: 'slack-forge',         label: 'Slack Forge',      icon: 'fa-brands fa-slack',         requiredDir: 'slack-forge' },
];

/* ═══════════════════════════════════════════════════════════════
   Shell State
   ═══════════════════════════════════════════════════════════════ */
const Shell = {
  rootHandle: null,
  activePlugin: null,
  editMode: false,
  visibility: {},
  pluginDirStatus: {},
  _controllers: {},
  _watcherCleanup: null,

  /* ── Register a view controller ── */
  registerController(pluginId, controller) {
    this._controllers[pluginId] = controller;
  },

  /* ── Get visibility from localStorage ── */
  _loadVisibility() {
    try {
      const saved = localStorage.getItem('forge-shell-plugin-visibility');
      if (saved) this.visibility = JSON.parse(saved);
    } catch { /* ignore */ }
    // Default all visible
    PLUGINS.forEach(p => {
      if (!(p.id in this.visibility)) this.visibility[p.id] = true;
    });
  },

  _saveVisibility() {
    localStorage.setItem('forge-shell-plugin-visibility', JSON.stringify(this.visibility));
  },

  /* ── Render sidebar nav ── */
  renderNav() {
    const list = document.getElementById('shell-nav');
    list.innerHTML = '';

    PLUGINS.forEach(p => {
      if (!this.visibility[p.id] && !this.editMode) return;

      const li = document.createElement('li');
      li.className = 'shell-nav-item' + (this.activePlugin === p.id ? ' active' : '');
      li.dataset.pluginId = p.id;
      li.setAttribute('title', p.label);

      const isVisible = this.visibility[p.id];
      const eyeIcon = isVisible ? 'fa-eye' : 'fa-eye-slash';

      li.innerHTML = `
        <span class="nav-icon"><i class="${p.icon}"></i></span>
        <span class="nav-label">${ForgeUtils.escapeHTML(p.label)}</span>
        <span class="visibility-toggle" data-vis-plugin="${p.id}"><i class="fa-solid ${eyeIcon}"></i></span>
      `;

      if (!isVisible && this.editMode) {
        li.style.opacity = '0.4';
      }

      li.addEventListener('click', (e) => {
        if (e.target.closest('.visibility-toggle')) return;
        if (!this.editMode) {
          this.selectPlugin(p.id);
        }
      });

      list.appendChild(li);
    });

    // Bind visibility toggles
    list.querySelectorAll('.visibility-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = el.dataset.visPlugin;
        this.visibility[pid] = !this.visibility[pid];
        this._saveVisibility();
        this.renderNav();
      });
    });
  },

  /* ── Select a plugin view ── */
  selectPlugin(pluginId) {
    // If the plugin is hidden, ignore
    if (!this.visibility[pluginId]) return;

    const prev = this.activePlugin;
    this.activePlugin = pluginId;
    location.hash = pluginId;

    // Deactivate previous view
    if (prev && prev !== pluginId && this._controllers[prev] && this._controllers[prev].destroy) {
      this._controllers[prev].destroy();
    }

    // Toggle view containers
    document.querySelectorAll('.shell-view').forEach(el => {
      el.classList.toggle('active', el.id === 'view-' + pluginId);
    });

    // Update nav highlight
    document.querySelectorAll('.shell-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.pluginId === pluginId);
    });

    // Initialize the controller
    const ctrl = this._controllers[pluginId];
    if (ctrl && ctrl.init) {
      ctrl.init(this.rootHandle);
    }

    // Close sidebar on mobile
    document.getElementById('shell-sidebar').classList.remove('open');
  },

  /* ── Edit mode toggle ── */
  toggleEditMode() {
    this.editMode = !this.editMode;
    document.getElementById('shell').classList.toggle('edit-mode', this.editMode);

    const btn = document.getElementById('btn-edit-mode');
    btn.innerHTML = this.editMode
      ? '<i class="fa-solid fa-check"></i>'
      : '<i class="fa-solid fa-pen"></i>';
    btn.title = this.editMode ? 'Done editing' : 'Edit plugins';

    this.renderNav();

    // If current plugin was hidden, switch to first visible
    if (!this.editMode && this.activePlugin && !this.visibility[this.activePlugin]) {
      const first = PLUGINS.find(p => this.visibility[p.id]);
      if (first) this.selectPlugin(first.id);
    }
  },

  /* ── Theme toggle ── */
  toggleTheme() {
    const next = ForgeUtils.Theme.toggle();
    const btn = document.getElementById('btn-theme');
    btn.innerHTML = next === 'dark'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  },

  _updateThemeIcon() {
    const theme = ForgeUtils.Theme.get();
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
    }
  },

  /* ── Welcome screen ── */
  showWelcome() {
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('shell').style.display = 'none';
  },

  hideWelcome() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('shell').style.display = 'flex';
  },

  /* ── Directory selection ── */
  async selectDirectory() {
    try {
      this.rootHandle = await ForgeUtils.FS.pickDirectory('readwrite');

      // Save based on mode
      if (ForgeFS.isTauri()) {
        // In Tauri mode, rootHandle is a path string - save to config
        await ForgeFS.setProjectPath(this.rootHandle);
      } else {
        // In browser mode, rootHandle is a FileSystemDirectoryHandle - save to IndexedDB
        await ForgeUtils.DB.save('rootDir', this.rootHandle);
      }

      await this._onDirectoryReady();
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Directory selection failed:', e);
    }
  },

  async _tryRestore() {
    try {
      if (ForgeFS.isTauri()) {
        // Tauri mode: try to restore from config
        const savedPath = await ForgeFS.getProjectPath();
        if (!savedPath) return false;

        // Verify the path still exists by trying to read it
        try {
          await ForgeFS.readDir(savedPath, '');
          this.rootHandle = savedPath;
          return true;
        } catch {
          console.log('Saved project path no longer accessible:', savedPath);
          return false;
        }
      } else {
        // Browser mode: try to restore from IndexedDB
        const saved = await ForgeUtils.DB.get('rootDir');
        if (!saved) return false;

        const granted = await ForgeUtils.FS.requestPermission(saved, 'readwrite');
        if (!granted) {
          await ForgeUtils.DB.remove('rootDir');
          return false;
        }

        this.rootHandle = saved;
        return true;
      }
    } catch (e) {
      console.log('Could not restore directory:', e);
      if (!ForgeFS.isTauri()) {
        await ForgeUtils.DB.remove('rootDir').catch(() => {});
      }
      return false;
    }
  },

  async _onDirectoryReady() {
    // Check which plugin directories exist
    for (const p of PLUGINS) {
      if (p.requiredDir) {
        this.pluginDirStatus[p.id] = await ForgeUtils.FS.dirExists(this.rootHandle, p.requiredDir);
      } else {
        this.pluginDirStatus[p.id] = true;
      }
    }

    // For productivity, check TASKS.md and memory/ directory
    const tasksFile = await ForgeUtils.FS.getFile(this.rootHandle, 'TASKS.md');
    const memoryDir = await ForgeUtils.FS.getSubDir(this.rootHandle, 'memory');
    this.pluginDirStatus['productivity'] = !!(tasksFile || memoryDir);

    // Set up file watcher (Tauri mode only)
    if (ForgeFS.isTauri() && typeof this.rootHandle === 'string') {
      await this._setupFileWatcher();
    }

    this.hideWelcome();
    this.renderNav();

    // Select from hash or first visible
    const hash = location.hash.replace('#', '');
    const match = PLUGINS.find(p => p.id === hash && this.visibility[p.id]);
    if (match) {
      this.selectPlugin(match.id);
    } else {
      const first = PLUGINS.find(p => this.visibility[p.id]);
      if (first) this.selectPlugin(first.id);
    }
  },

  /* ── File watcher setup (Tauri only) ── */
  async _setupFileWatcher() {
    // Clean up previous watcher if any
    if (this._watcherCleanup) {
      this._watcherCleanup();
      this._watcherCleanup = null;
    }

    try {
      this._watcherCleanup = await ForgeFS.watchDirectory(this.rootHandle, (changedPath) => {
        this._onFileChanged(changedPath);
      });
      console.log('[Shell] File watcher active for:', this.rootHandle);
    } catch (error) {
      console.error('[Shell] Failed to set up file watcher:', error);
    }
  },

  /* ── Handle file change events ── */
  // Maps changed file paths to the owning plugin by matching known data
  // directories (e.g. /cards/ → product-forge-local). This lets each
  // controller refresh only when its own data changes.
  _onFileChanged(path) {
    console.log('[Shell] File changed:', path);

    // Determine which plugin should refresh based on the changed path
    let pluginToRefresh = null;

    if (path.includes('/cards/')) {
      pluginToRefresh = 'product-forge-local';
    } else if (path.includes('/sessions/')) {
      pluginToRefresh = 'cognitive-forge';
    } else if (path.includes('/rovo-agents/')) {
      pluginToRefresh = 'rovo-agent-forge';
    } else if (path.includes('/tasks/') || path.includes('TASKS.md')) {
      pluginToRefresh = 'tasks';
    } else if (path.includes('/memory/')) {
      pluginToRefresh = 'memory';
    } else if (path.includes('/roadmap-data/')) {
      pluginToRefresh = 'roadmap';
    } else if (path.includes('/reports/')) {
      pluginToRefresh = 'report-forge';
    } else if (path.includes('/slack-forge/')) {
      pluginToRefresh = 'slack-forge';
    }

    // If a relevant plugin is active, refresh it
    if (pluginToRefresh && pluginToRefresh === this.activePlugin) {
      const ctrl = this._controllers[pluginToRefresh];
      if (ctrl && ctrl.refresh) {
        console.log(`[Shell] Refreshing ${pluginToRefresh} view`);
        ctrl.refresh();
      }
    }

    // Check if plugin is suppressing toasts (internal change)
    let shouldShowToast = true;
    if (pluginToRefresh) {
      const ctrl = this._controllers[pluginToRefresh];
      if (ctrl && typeof ctrl.isSuppressingToasts === 'function') {
        shouldShowToast = !ctrl.isSuppressingToasts();
      }
    }

    // Show toast notification only if not suppressed
    if (shouldShowToast) {
      ForgeUtils.Toast.show(`File updated: ${path.split('/').pop()}`, 'info', 3000);
    } else {
      console.log('[Shell] Toast suppressed for internal change');
    }
  },

  /* ── Boot ── */
  async boot() {
    ForgeUtils.Theme.init();
    this._updateThemeIcon();
    this._loadVisibility();

    // Wire up buttons
    document.getElementById('btn-theme').addEventListener('click', () => this.toggleTheme());
    document.getElementById('btn-edit-mode').addEventListener('click', () => this.toggleEditMode());
    document.getElementById('btn-change-dir').addEventListener('click', () => this.selectDirectory());
    document.getElementById('btn-welcome-select').addEventListener('click', () => this.selectDirectory());

    window.addEventListener('hashchange', () => {
      const id = location.hash.replace('#', '');
      if (id && id !== this.activePlugin && this.visibility[id]) {
        this.selectPlugin(id);
      }
    });

    // Try restore
    const restored = await this._tryRestore();
    if (restored) {
      await this._onDirectoryReady();
    } else {
      this.showWelcome();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════
   Forge Shell Home View Controller
   ═══════════════════════════════════════════════════════════════ */
window.ForgeShellView = {
  _initialized: false,

  init(rootHandle) {
    const container = document.getElementById('view-forge-shell');
    if (!container) return;

    // Get directory name (handle.name in browser, path basename in Tauri)
    let dirName = 'No directory selected';
    if (rootHandle) {
      if (typeof rootHandle === 'string') {
        // Tauri mode: extract basename from path
        dirName = rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle;
      } else {
        // Browser mode: use handle.name
        dirName = rootHandle.name;
      }
    }

    // Build plugin status cards
    let statusCards = '';
    PLUGINS.forEach(p => {
      if (p.id === 'forge-shell') return;
      const active = Shell.pluginDirStatus[p.id];
      const badgeClass = active ? 'active' : 'inactive';
      const badgeLabel = active ? 'Active' : 'Not Found';
      statusCards += `
        <div class="plugin-status-card" data-goto="${p.id}">
          <span class="status-icon"><i class="${p.icon}"></i></span>
          <span class="status-label">${ForgeUtils.escapeHTML(p.label)}</span>
          <span class="status-badge ${badgeClass}">${badgeLabel}</span>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="shell-home">
        <h2><i class="fa-solid fa-terminal"></i> Forge Shell</h2>
        <div class="dir-info">
          <i class="fa-solid fa-folder-open"></i>
          <span>${ForgeUtils.escapeHTML(dirName)}</span>
        </div>
        <div class="plugin-status-grid">${statusCards}</div>
        <button class="primary" onclick="Shell.selectDirectory()">Change Directory</button>
      </div>
    `;

    // Wire up plugin card clicks
    container.querySelectorAll('[data-goto]').forEach(el => {
      el.addEventListener('click', () => {
        Shell.selectPlugin(el.dataset.goto);
      });
    });

    this._initialized = true;
  },

  destroy() {
    this._initialized = false;
  },

  refresh() {
    if (Shell.rootHandle) this.init(Shell.rootHandle);
  }
};

Shell.registerController('forge-shell', window.ForgeShellView);

/* ═══════════════════════════════════════════════════════════════
   Boot on DOMContentLoaded
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => Shell.boot());
