/* ═══════════════════════════════════════════════════════════════
   Product Forge — View Controller (V2)
   All DOM scoped to #view-product-forge, classes pfl-*
   V2: Uses index.json instead of directory scanning
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const ESC = ForgeUtils.escapeHTML;
  const VIEW_ID = 'view-product-forge';

  /* ─── Aliases from shared CardData layer ─── */
  const FIELD_ORDER = CardData.FIELD_ORDER;
  const STATUS_OPTIONS = CardData.STATUS_OPTIONS;
  const CONFIDENCE_OPTIONS = CardData.CONFIDENCE_OPTIONS;
  const DOMAIN_OPTIONS = CardData.DOMAIN_OPTIONS;
  const DECISION_TYPE_OPTIONS = CardData.DECISION_TYPE_OPTIONS;
  const EXPECTED_DIRS = CardData.EXPECTED_DIRS;
  const DIR_TYPE_MAP = CardData.DIR_TYPE_MAP;
  const CardStore = CardData.CardStore;
  const CardParser = CardData.CardParser;
  const getStatusColor = CardData.getStatusColor;
  const getTypeColor = CardData.getTypeColor;
  const buildHierarchy = CardData.buildHierarchy;
  const scanCardsDir = CardData.scanCardsDir;
  const discoverTaxonomy = CardData.discoverTaxonomy;

  function $view() { return document.getElementById(VIEW_ID); }
  function $q(sel) { const v = $view(); return v ? v.querySelector(sel) : null; }
  function $qa(sel) { const v = $view(); return v ? v.querySelectorAll(sel) : []; }

  /* ═══════════════════════════════════════════════════════════════
     TreeView
     ═══════════════════════════════════════════════════════════════ */
  const treeView = {
    collapsedSections: new Set(),
    collapsedNodes: new Set(),

    render(hierarchy) {
      const container = $q('.pfl-tree-view');
      if (!container) return;
      let html = '';

      html += this._renderSection('Initiatives', 'initiatives', hierarchy.tree.length, () => {
        let inner = '';
        for (const initNode of hierarchy.tree) inner += this._renderInitiativeNode(initNode);
        return inner;
      });

      html += this._renderSection('Orphan Epics', 'orphan-epics', hierarchy.orphanEpics.length, () =>
        hierarchy.orphanEpics.map(en => this._renderEpicNode(en)).join(''), 'unparent-epic');

      html += this._renderSection('Orphan Stories', 'orphan-stories', hierarchy.orphanStories.length, () =>
        hierarchy.orphanStories.map(c => this._renderStoryNode(c, 1)).join(''), 'unparent-story');

      html += this._renderSection('Intakes', 'intakes', hierarchy.intakes.length, () =>
        hierarchy.intakes.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Checkpoints', 'checkpoints', hierarchy.checkpoints.length, () =>
        hierarchy.checkpoints.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Decisions', 'decisions', hierarchy.decisions.length, () =>
        hierarchy.decisions.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Release Notes', 'release-notes', hierarchy.releaseNotes.length, () =>
        hierarchy.releaseNotes.map(c => this._renderLeafNode(c, 1)).join(''));

      container.innerHTML = html;
      this._bindEvents(container);
      this._setupDragDrop(container);
    },

    _renderSection(label, id, count, contentFn, dropTarget) {
      const collapsed = this.collapsedSections.has(id);
      const dropAttr = dropTarget ? ' data-pfl-drop-target="' + dropTarget + '"' : '';
      return '<div class="pfl-tree-section" data-pfl-section="' + id + '">' +
        '<div class="pfl-tree-section-header" data-pfl-toggle-section="' + id + '"' + dropAttr + '>' +
          '<span class="pfl-toggle ' + (collapsed ? '' : 'open') + '">&#9654;</span>' +
          '<span>' + ESC(label) + '</span>' +
          '<span class="pfl-count">' + count + '</span>' +
        '</div>' +
        '<div class="pfl-tree-children' + (collapsed ? ' pfl-collapsed' : '') + '" data-pfl-section-body="' + id + '">' + contentFn() + '</div>' +
      '</div>';
    },

    _renderInitiativeNode(initNode) {
      const card = initNode.card;
      const fm = card.frontmatter;
      const collapsed = this.collapsedNodes.has(card.filename);
      const hasChildren = initNode.children.length > 0;

      let html = '<div class="pfl-tree-node pfl-indent-0" data-pfl-filename="' + ESC(card.filename) + '" data-pfl-type="initiative">' +
        '<div class="pfl-tree-node-header" data-pfl-select="' + ESC(card.filename) + '" data-pfl-node-toggle="' + ESC(card.filename) + '">' +
          (hasChildren ? '<span class="pfl-toggle ' + (collapsed ? '' : 'open') + '">&#9654;</span>' : '<span class="pfl-toggle"></span>') +
          '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
          (card.error ? '<span class="pfl-error-icon">&#9888;</span>' : '') +
          '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
          (hasChildren ? '<span class="pfl-node-count">' + initNode.children.length + '</span>' : '') +
        '</div>';

      if (hasChildren) {
        html += '<div class="pfl-tree-children' + (collapsed ? ' pfl-collapsed' : '') + '" data-pfl-children="' + ESC(card.filename) + '">';
        for (const epicNode of initNode.children) html += this._renderEpicNode(epicNode);
        html += '</div>';
      }
      html += '</div>';
      return html;
    },

    _renderEpicNode(epicNode) {
      const card = epicNode.card;
      const fm = card.frontmatter;
      const collapsed = this.collapsedNodes.has(card.filename);
      const hasChildren = epicNode.children.length > 0;

      let html = '<div class="pfl-tree-node pfl-indent-1" data-pfl-filename="' + ESC(card.filename) + '" data-pfl-type="epic">' +
        '<div class="pfl-tree-node-header" draggable="true" data-pfl-drag-type="epic" data-pfl-drag-filename="' + ESC(card.filename) + '" data-pfl-select="' + ESC(card.filename) + '" data-pfl-node-toggle="' + ESC(card.filename) + '" data-pfl-drop-accepts="initiative">' +
          (hasChildren ? '<span class="pfl-toggle ' + (collapsed ? '' : 'open') + '">&#9654;</span>' : '<span class="pfl-toggle"></span>') +
          '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
          (card.error ? '<span class="pfl-error-icon">&#9888;</span>' : '') +
          '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
          (hasChildren ? '<span class="pfl-node-count">' + epicNode.children.length + '</span>' : '') +
        '</div>';

      if (hasChildren) {
        html += '<div class="pfl-tree-children' + (collapsed ? ' pfl-collapsed' : '') + '" data-pfl-children="' + ESC(card.filename) + '">';
        for (const storyCard of epicNode.children) html += this._renderStoryNode(storyCard);
        html += '</div>';
      }
      html += '</div>';
      return html;
    },

    _renderStoryNode(card, indent) {
      indent = indent || 2;
      const fm = card.frontmatter;
      return '<div class="pfl-tree-node pfl-indent-' + indent + '" data-pfl-filename="' + ESC(card.filename) + '" data-pfl-type="story">' +
        '<div class="pfl-tree-node-header" draggable="true" data-pfl-drag-type="story" data-pfl-drag-filename="' + ESC(card.filename) + '" data-pfl-select="' + ESC(card.filename) + '" data-pfl-drop-accepts="epic">' +
          '<span class="pfl-toggle"></span>' +
          '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
          (card.error ? '<span class="pfl-error-icon">&#9888;</span>' : '') +
          '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
        '</div>' +
      '</div>';
    },

    _renderLeafNode(card, indent) {
      const fm = card.frontmatter;
      return '<div class="pfl-tree-node pfl-indent-' + indent + '" data-pfl-filename="' + ESC(card.filename) + '" data-pfl-type="' + ESC(fm.type || 'unknown') + '">' +
        '<div class="pfl-tree-node-header" data-pfl-select="' + ESC(card.filename) + '">' +
          '<span class="pfl-toggle"></span>' +
          '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
          (card.error ? '<span class="pfl-error-icon">&#9888;</span>' : '') +
          '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
        '</div>' +
      '</div>';
    },

    _bindEvents(container) {
      /* Section toggle */
      container.querySelectorAll('[data-pfl-toggle-section]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.pflToggleSection;
          const body = container.querySelector('[data-pfl-section-body="' + id + '"]');
          const toggle = el.querySelector('.pfl-toggle');
          if (this.collapsedSections.has(id)) {
            this.collapsedSections.delete(id);
            if (body) body.classList.remove('pfl-collapsed');
            if (toggle) toggle.classList.add('open');
          } else {
            this.collapsedSections.add(id);
            if (body) body.classList.add('pfl-collapsed');
            if (toggle) toggle.classList.remove('open');
          }
        });
      });

      /* Node select & toggle */
      container.querySelectorAll('[data-pfl-select]').forEach(el => {
        el.addEventListener('click', (e) => {
          const filename = el.dataset.pflSelect;
          const toggleKey = el.dataset.pflNodeToggle;

          if (e.target.classList.contains('pfl-toggle') && toggleKey) {
            const children = container.querySelector('[data-pfl-children="' + toggleKey + '"]');
            const arrow = el.querySelector('.pfl-toggle');
            if (children) {
              if (this.collapsedNodes.has(toggleKey)) {
                this.collapsedNodes.delete(toggleKey);
                children.classList.remove('pfl-collapsed');
                if (arrow) arrow.classList.add('open');
              } else {
                this.collapsedNodes.add(toggleKey);
                children.classList.add('pfl-collapsed');
                if (arrow) arrow.classList.remove('open');
              }
            }
            return;
          }

          ctrl.selectCard(filename);
        });
      });
    },

    highlightSelected(filename) {
      $qa('.pfl-tree-node-header.pfl-selected').forEach(el => el.classList.remove('pfl-selected'));
      if (filename) {
        const el = $q('[data-pfl-select="' + filename + '"]');
        if (el) el.classList.add('pfl-selected');
      }
    },

    _setupDragDrop(container) {
      let draggedType = null;
      let draggedFilename = null;

      container.addEventListener('dragstart', (e) => {
        const header = e.target.closest('[data-pfl-drag-type]');
        if (!header) return;
        draggedType = header.dataset.pflDragType;
        draggedFilename = header.dataset.pflDragFilename;
        header.classList.add('pfl-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedFilename);
      });

      container.addEventListener('dragend', (e) => {
        const header = e.target.closest('[data-pfl-drag-type]');
        if (header) header.classList.remove('pfl-dragging');
        container.querySelectorAll('.pfl-drag-over-valid,.pfl-drag-over-invalid').forEach(el => {
          el.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');
        });
        draggedType = null;
        draggedFilename = null;
      });

      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      container.addEventListener('dragenter', (e) => {
        if (!draggedType || !draggedFilename) return;
        container.querySelectorAll('.pfl-drag-over-valid,.pfl-drag-over-invalid').forEach(el => {
          el.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');
        });

        const sectionHeader = e.target.closest('.pfl-tree-section-header[data-pfl-drop-target]');
        if (sectionHeader) {
          if (this._isValidDrop(draggedType, sectionHeader.dataset.pflDropTarget, draggedFilename, null)) {
            sectionHeader.classList.add('pfl-drag-over-valid');
          } else {
            sectionHeader.classList.add('pfl-drag-over-invalid');
          }
          return;
        }

        const target = e.target.closest('.pfl-tree-node-header');
        if (!target) return;
        const targetNode = target.closest('.pfl-tree-node');
        if (!targetNode) return;
        const targetType = targetNode.dataset.pflType;
        const targetFilename = targetNode.dataset.pflFilename;

        if (this._isValidDrop(draggedType, targetType, draggedFilename, targetFilename)) {
          target.classList.add('pfl-drag-over-valid');
        } else {
          target.classList.add('pfl-drag-over-invalid');
        }
      });

      container.addEventListener('dragleave', (e) => {
        const sectionHeader = e.target.closest('.pfl-tree-section-header[data-pfl-drop-target]');
        if (sectionHeader) {
          sectionHeader.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');
          return;
        }
        const target = e.target.closest('.pfl-tree-node-header');
        if (target) target.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');
      });

      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        const sectionHeader = e.target.closest('.pfl-tree-section-header[data-pfl-drop-target]');
        if (sectionHeader) {
          sectionHeader.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');
          if (!this._isValidDrop(draggedType, sectionHeader.dataset.pflDropTarget, draggedFilename, null)) {
            ForgeUtils.Toast.show('Invalid drop target', 'error');
            return;
          }
          await ctrl._unparentCard(draggedFilename);
          return;
        }

        const target = e.target.closest('.pfl-tree-node-header');
        if (!target) return;
        const targetNode = target.closest('.pfl-tree-node');
        if (!targetNode) return;
        target.classList.remove('pfl-drag-over-valid', 'pfl-drag-over-invalid');

        const targetType = targetNode.dataset.pflType;
        const targetFilename = targetNode.dataset.pflFilename;

        if (!this._isValidDrop(draggedType, targetType, draggedFilename, targetFilename)) {
          ForgeUtils.Toast.show('Invalid drop target', 'error');
          return;
        }
        await ctrl._reparentCard(draggedFilename, targetFilename);
      });
    },

    _isValidDrop(dragType, targetType, dragFilename, targetFilename) {
      if (dragFilename === targetFilename) return false;
      if (dragType === 'story' && targetType === 'epic') {
        const card = store.get(dragFilename);
        return card && card.frontmatter.parent !== targetFilename;
      }
      if (dragType === 'epic' && targetType === 'initiative') {
        const card = store.get(dragFilename);
        return card && card.frontmatter.parent !== targetFilename;
      }
      if (dragType === 'epic' && targetType === 'unparent-epic') {
        const card = store.get(dragFilename);
        return card && !!card.frontmatter.parent;
      }
      if (dragType === 'story' && targetType === 'unparent-story') {
        const card = store.get(dragFilename);
        return card && !!card.frontmatter.parent;
      }
      return false;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Detail Panel
     ═══════════════════════════════════════════════════════════════ */
  const detailPanel = {
    showingRaw: false,

    renderCard(card) {
      const emptyState = $q('.pfl-empty-state');
      const detailEl = $q('.pfl-card-detail');
      if (!card) {
        if (detailEl) detailEl.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }
      if (emptyState) emptyState.classList.add('hidden');
      if (!detailEl) return;
      detailEl.classList.remove('hidden');
      this.showingRaw = false;

      const fm = card.frontmatter;
      const type = fm.type || 'unknown';
      let html = '';

      html += '<span class="type-badge" style="background:' + getTypeColor(type) + '">' + ESC(type) + '</span>';
      if (card.error) {
        html += '<div style="color:#e67e22;margin-bottom:12px;font-size:13px">&#9888; ' + ESC(card.error) + '</div>';
      }
      html += '<div class="pfl-card-title-header">' + ESC(fm.title || card.filename) + '</div>';

      html += '<div class="metadata-grid">';
      html += this._metaRow('Status', fm.status ? '<span class="status-pill" style="background:' + getStatusColor(fm.status) + '">' + ESC(fm.status) + '</span>' : '&mdash;');
      html += this._metaRow('Filename', '<code>' + ESC(card.filename) + '.md</code>');

      if (fm.release) html += this._metaRow('Release', ESC(fm.release));
      if (fm.product) html += this._metaRow('Product', ESC(fm.product));
      if (fm.module) html += this._metaRow('Module', ESC(fm.module));
      if (fm.client) html += this._metaRow('Client', ESC(fm.client));
      if (fm.team) html += this._metaRow('Team', ESC(fm.team));

      if (fm.confidence) html += this._metaRow('Confidence', ESC(fm.confidence));
      if (fm.estimate_hours !== null && fm.estimate_hours !== undefined) html += this._metaRow('Est. Hours', fm.estimate_hours);
      if (fm.story_points !== null && fm.story_points !== undefined) html += this._metaRow('Story Points', fm.story_points);
      if (fm.jira_card) html += this._metaRow('Jira Card', ESC(fm.jira_card));
      if (fm.domain) html += this._metaRow('Domain', ESC(fm.domain));
      if (fm.decision_type) html += this._metaRow('Decision Type', ESC(fm.decision_type));
      if (fm.stakeholders) html += this._metaRow('Stakeholders', ESC(fm.stakeholders));
      if (fm.version) html += this._metaRow('Version', ESC(fm.version));
      if (fm.checkpoint_date) html += this._metaRow('Checkpoint Date', ESC(fm.checkpoint_date));
      if (fm.decision_date) html += this._metaRow('Decision Date', ESC(fm.decision_date));
      if (fm.release_date) html += this._metaRow('Release Date', ESC(fm.release_date));

      if (fm.parent) {
        const parentCard = store.get(fm.parent);
        const parentLabel = parentCard ? (parentCard.frontmatter.title || fm.parent) : fm.parent;
        html += this._metaRow('Parent', '<span class="meta-link" data-pfl-nav="' + ESC(fm.parent) + '">' + ESC(parentLabel) + '</span>');
      }

      if (Array.isArray(fm.children) && fm.children.length > 0) {
        const chips = fm.children.map(c => {
          const child = store.get(c);
          const label = child ? (child.frontmatter.title || c) : c;
          return '<span class="child-chip" data-pfl-nav="' + ESC(c) + '">' + ESC(label) + '</span>';
        }).join('');
        html += this._metaRow('Children', '<div class="children-list">' + chips + '</div>');
      }

      if (fm.source_intake) {
        html += this._metaRow('Source Intake', '<span class="meta-link" data-pfl-nav="' + ESC(fm.source_intake) + '">' + ESC(fm.source_intake) + '</span>');
      }
      if (Array.isArray(fm.generated_initiatives) && fm.generated_initiatives.length > 0) {
        const chips = fm.generated_initiatives.map(c => '<span class="child-chip" data-pfl-nav="' + ESC(c) + '">' + ESC(c) + '</span>').join('');
        html += this._metaRow('Gen. Initiatives', '<div class="children-list">' + chips + '</div>');
      }
      if (Array.isArray(fm.generated_epics) && fm.generated_epics.length > 0) {
        const chips = fm.generated_epics.map(c => '<span class="child-chip" data-pfl-nav="' + ESC(c) + '">' + ESC(c) + '</span>').join('');
        html += this._metaRow('Gen. Epics', '<div class="children-list">' + chips + '</div>');
      }
      if (Array.isArray(fm.related_stories) && fm.related_stories.length > 0) {
        const chips = fm.related_stories.map(c => '<span class="child-chip" data-pfl-nav="' + ESC(c) + '">' + ESC(c) + '</span>').join('');
        html += this._metaRow('Related Stories', '<div class="children-list">' + chips + '</div>');
      }

      if (fm.description) html += this._metaRow('Description', '<em>' + ESC(fm.description) + '</em>');
      if (fm.created) html += this._metaRow('Created', ESC(fm.created));
      if (fm.updated) html += this._metaRow('Updated', ESC(fm.updated));
      html += '</div>';

      if (card.body) {
        html += '<div class="rendered-body">' + ForgeUtils.MD.render(card.body) + '</div>';
      }

      html += '<div class="pfl-card-actions">' +
        '<button class="primary" data-pfl-action="edit">Edit Card</button>' +
        '<button data-pfl-action="raw">View Raw</button>' +
        '<button data-pfl-action="copy-filename">Copy Filename</button>' +
      '</div>';

      html += '<div class="pfl-card-raw-content hidden">' + ESC(card.raw) + '</div>';

      detailEl.innerHTML = html;
      detailEl.scrollTop = 0;

      /* Bind navigation links */
      detailEl.querySelectorAll('[data-pfl-nav]').forEach(el => {
        el.addEventListener('click', () => ctrl.selectCard(el.dataset.pflNav));
      });

      /* Bind action buttons */
      detailEl.querySelectorAll('[data-pfl-action]').forEach(el => {
        el.addEventListener('click', () => {
          const action = el.dataset.pflAction;
          if (action === 'edit') editModal.open(card.filename);
          else if (action === 'raw') this.toggleRaw();
          else if (action === 'copy-filename') this.copyFilename(card.filename);
        });
      });
    },

    _metaRow(label, value) {
      return '<div class="meta-label">' + ESC(label) + '</div><div class="meta-value">' + value + '</div>';
    },

    toggleRaw() {
      const raw = $q('.pfl-card-raw-content');
      if (raw) {
        this.showingRaw = !this.showingRaw;
        raw.classList.toggle('hidden', !this.showingRaw);
      }
    },

    copyFilename(filename) {
      navigator.clipboard.writeText(filename + '.md').then(
        () => ForgeUtils.Toast.show('Filename copied to clipboard', 'success'),
        () => ForgeUtils.Toast.show('Failed to copy filename', 'error')
      );
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Edit Modal
     ═══════════════════════════════════════════════════════════════ */
  const editModal = {
    currentFilename: null,
    originalCard: null,
    showingDiff: false,

    open(filename) {
      const card = store.get(filename);
      if (!card) return;
      this.currentFilename = filename;
      this.originalCard = card;
      this.showingDiff = false;

      const overlay = $q('.pfl-modal-overlay');
      const titleEl = $q('.pfl-modal-overlay .pfl-modal-header h3');
      const bodyEl = $q('.pfl-modal-overlay .pfl-modal-body');
      const diffBtn = $q('[data-pfl-modal-action="toggle-diff"]');
      if (!overlay || !bodyEl) return;

      if (titleEl) titleEl.textContent = 'Edit: ' + (card.frontmatter.title || filename);
      if (diffBtn) diffBtn.textContent = 'Preview Changes';

      const fm = card.frontmatter;
      const type = fm.type || 'unknown';

      let html = '<div class="form-grid">';
      html += this._buildField('title', 'Title', 'text', fm.title, { required: true, fullWidth: true });

      const statuses = STATUS_OPTIONS[type] || [];
      if (statuses.length > 0) html += this._buildField('status', 'Status', 'select', fm.status, { options: statuses });

      /* Release field for initiative and epic types */
      if (type === 'initiative' || type === 'epic') {
        var releaseNames = [];
        var rmConfig = CardData.roadmapConfig;
        if (rmConfig && Array.isArray(rmConfig.releases)) {
          releaseNames = rmConfig.releases.map(function (r) { return r.name; });
        }
        html += this._buildField('release', 'Release', 'datalist', fm.release, { options: releaseNames, datalistId: 'pfl-release-options' });
      }

      html += this._buildField('product', 'Product', 'select', fm.product, { options: taxonomy.products });
      html += this._buildField('module', 'Module', 'select', fm.module, { options: taxonomy.modules });
      html += this._buildField('client', 'Client', 'select', fm.client, { options: taxonomy.clients });

      if (type === 'initiative' || type === 'epic' || type === 'story') {
        html += this._buildField('team', 'Team', 'text', fm.team);
      }

      if (type === 'initiative') {
        html += this._buildField('confidence', 'Confidence', 'select', fm.confidence, { options: CONFIDENCE_OPTIONS });
        html += this._buildField('estimate_hours', 'Est. Hours', 'number', fm.estimate_hours);
        html += this._buildField('jira_card', 'Jira Card', 'text', fm.jira_card);
        html += this._buildField('source_intake', 'Source Intake', 'text', fm.source_intake);
      }

      if (type === 'epic') {
        const initiatives = store.getByType('initiative');
        const parentOpts = initiatives.map(c => c.filename);
        html += this._buildField('parent', 'Parent Initiative', 'select', fm.parent, { options: parentOpts, labels: initiatives.map(c => c.frontmatter.title || c.filename) });
        html += this._buildField('source_intake', 'Source Intake', 'text', fm.source_intake);
      }

      if (type === 'story') {
        const epics = store.getByType('epic');
        const parentOpts = epics.map(c => c.filename);
        html += this._buildField('parent', 'Parent Epic', 'select', fm.parent, { options: parentOpts, labels: epics.map(c => c.frontmatter.title || c.filename) });
        html += this._buildField('story_points', 'Story Points', 'number', fm.story_points);
        html += this._buildField('jira_card', 'Jira Card', 'text', fm.jira_card);
      }

      if (type === 'checkpoint') {
        html += this._buildField('checkpoint_date', 'Date', 'date', fm.checkpoint_date);
        html += this._buildField('domain', 'Domain', 'select', fm.domain, { options: DOMAIN_OPTIONS });
      }

      if (type === 'decision') {
        html += this._buildField('decision_date', 'Date', 'date', fm.decision_date);
        html += this._buildField('decision_type', 'Decision Type', 'select', fm.decision_type, { options: DECISION_TYPE_OPTIONS });
        html += this._buildField('stakeholders', 'Stakeholders', 'text', fm.stakeholders);
      }

      if (type === 'release-note') {
        html += this._buildField('release_date', 'Release Date', 'date', fm.release_date);
        html += this._buildField('version', 'Version', 'text', fm.version);
      }

      if ('description' in fm || ['initiative','epic'].includes(type)) {
        html += this._buildField('description', 'Description', 'text', fm.description, { fullWidth: true });
      }

      html += '</div>';

      html += '<div class="form-group full-width">' +
        '<label>Body (Markdown)</label>' +
        '<textarea data-pfl-edit-body style="min-height:300px;font-family:monospace;font-size:13px">' + ESC(card.body) + '</textarea>' +
      '</div>';

      html += '<div data-pfl-diff-container class="hidden"></div>';

      bodyEl.innerHTML = html;
      overlay.classList.add('pfl-visible');
    },

    _buildField(key, label, type, value, opts) {
      opts = opts || {};
      const fullWidth = opts.fullWidth ? ' full-width' : '';
      let input = '';

      if (type === 'select') {
        const options = opts.options || [];
        const labels = opts.labels || options;
        input = '<select data-pfl-field="' + key + '">' +
          '<option value="">&mdash; None &mdash;</option>' +
          options.map(function (o, i) {
            return '<option value="' + ESC(o) + '"' + (o === value ? ' selected' : '') + '>' + ESC(labels[i] || o) + '</option>';
          }).join('') +
        '</select>';
      } else if (type === 'datalist') {
        const options = opts.options || [];
        const dlId = opts.datalistId || 'pfl-dl-' + key;
        input = '<input type="text" data-pfl-field="' + key + '" list="' + dlId + '" value="' + ESC(value || '') + '">' +
          '<datalist id="' + dlId + '">' +
          options.map(function (o) {
            return '<option value="' + ESC(o) + '">';
          }).join('') +
          '</datalist>';
      } else if (type === 'number') {
        input = '<input type="number" data-pfl-field="' + key + '" value="' + (value !== null && value !== undefined ? value : '') + '">';
      } else if (type === 'date') {
        input = '<input type="date" data-pfl-field="' + key + '" value="' + (value || '') + '">';
      } else {
        input = '<input type="text" data-pfl-field="' + key + '" value="' + ESC(value || '') + '">';
      }

      return '<div class="form-group' + fullWidth + '"><label>' + ESC(label) + '</label>' + input + '</div>';
    },

    _getFormData() {
      const fm = Object.assign({}, this.originalCard.frontmatter);
      $qa('.pfl-modal-overlay [data-pfl-field]').forEach(el => {
        const key = el.dataset.pflField;
        let val = el.value.trim();
        if (el.type === 'number') {
          fm[key] = val === '' ? null : Number(val);
        } else {
          fm[key] = val === '' ? null : val;
        }
      });
      fm.updated = ForgeUtils.todayISO();
      const bodyEl = $q('[data-pfl-edit-body]');
      const body = bodyEl ? bodyEl.value : '';
      return { frontmatter: fm, body: body };
    },

    toggleDiff() {
      const container = $q('[data-pfl-diff-container]');
      if (!container) return;
      this.showingDiff = !this.showingDiff;
      const diffBtn = $q('[data-pfl-modal-action="toggle-diff"]');
      if (diffBtn) diffBtn.textContent = this.showingDiff ? 'Hide Preview' : 'Preview Changes';

      if (!this.showingDiff) {
        container.classList.add('hidden');
        return;
      }

      const data = this._getFormData();
      const newFm = data.frontmatter;
      const newBody = data.body;
      const oldFm = this.originalCard.frontmatter;
      const oldBody = this.originalCard.body;
      let html = '';

      const fieldChanges = [];
      const allKeys = new Set([...Object.keys(oldFm), ...Object.keys(newFm)]);
      for (const key of allKeys) {
        if (key === 'updated') continue;
        const oldVal = JSON.stringify(oldFm[key] !== undefined ? oldFm[key] : null);
        const newVal = JSON.stringify(newFm[key] !== undefined ? newFm[key] : null);
        if (oldVal !== newVal) {
          fieldChanges.push({ key: key, old: oldFm[key], 'new': newFm[key] });
        }
      }

      if (fieldChanges.length > 0) {
        html += '<div class="diff-container"><div class="diff-header">Frontmatter Changes</div><div class="diff-body">';
        for (var ci = 0; ci < fieldChanges.length; ci++) {
          var ch = fieldChanges[ci];
          var oldStr = ch.old === null || ch.old === undefined ? 'null' : Array.isArray(ch.old) ? ch.old.join(', ') : String(ch.old);
          var newStr = ch['new'] === null || ch['new'] === undefined ? 'null' : Array.isArray(ch['new']) ? ch['new'].join(', ') : String(ch['new']);
          html += '<div class="diff-field">' +
            '<span class="field-name">' + ESC(ch.key) + '</span>' +
            '<span class="old-val">' + ESC(oldStr) + '</span>' +
            '<span>&rarr;</span>' +
            '<span class="new-val">' + ESC(newStr) + '</span>' +
          '</div>';
        }
        html += '</div></div>';
      }

      if (oldBody !== newBody) {
        var diff = ForgeUtils.Diff.compute(oldBody, newBody);
        var hasRealChanges = diff.some(function (d) { return d.type !== 'same'; });
        if (hasRealChanges) {
          html += '<div class="diff-container" style="margin-top:12px"><div class="diff-header">Body Changes</div><div class="diff-body">';
          for (var di = 0; di < diff.length; di++) {
            var line = diff[di];
            var prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
            html += '<div class="diff-line ' + line.type + '">' + prefix + ' ' + ESC(line.text) + '</div>';
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

    async save() {
      if (!this.currentFilename || !this.originalCard) return;
      var data = this._getFormData();
      var content = CardParser.serialize(data.frontmatter, data.body);
      var handle = store.fileHandles.get(this.currentFilename);

      if (!handle) {
        ForgeUtils.Toast.show('Cannot find file handle for writing', 'error');
        return;
      }

      try {
        await ForgeUtils.FS.writeFile(handle, content);
        var card = CardParser.parse(this.currentFilename, content, this.originalCard.dirName);
        store.set(this.currentFilename, card, Date.now(), handle);
        ctrl._renderTree();
        if (selectedCard === this.currentFilename) {
          detailPanel.renderCard(card);
        }
        this.close();
        ForgeUtils.Toast.show('Card saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    },

    close() {
      var overlay = $q('.pfl-modal-overlay');
      if (overlay) overlay.classList.remove('pfl-visible');
      this.currentFilename = null;
      this.originalCard = null;
      this.showingDiff = false;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Module State
     ═══════════════════════════════════════════════════════════════ */
  var store = new CardStore();
  var cardsHandle = null;
  var refreshInterval = null;
  var refreshRunning = false;
  var selectedCard = null;
  var taxonomy = { products: [], modules: [], clients: [] };
  var keydownHandler = null;

  /* ═══════════════════════════════════════════════════════════════
     Controller (public interface)
     ═══════════════════════════════════════════════════════════════ */
  var ctrl = {

    async init(rootHandle) {
      this.destroy();
      var view = $view();
      if (!view) return;

      /* Try to find cards/ subdir */
      cardsHandle = await ForgeUtils.FS.getSubDir(rootHandle, 'cards');

      if (!cardsHandle) {
        this._renderNotActive(view);
        return;
      }

      this._renderLayout(view, rootHandle);
      await this._loadCards();
      this._startAutoRefresh();
      this._bindKeyboard();
    },

    destroy() {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      selectedCard = null;
      store.clear();
      cardsHandle = null;
    },

    async refresh() {
      if (!cardsHandle) return;
      await this._doRefresh();
    },

    selectCard(filename) {
      selectedCard = filename;
      var card = store.get(filename);
      detailPanel.renderCard(card);
      treeView.highlightSelected(filename);
    },

    /* ─── Internal ─── */

    _renderNotActive(view) {
      view.innerHTML =
        '<div class="pfl-not-active">' +
          '<div class="pfl-state-icon"><i class="fa-solid fa-puzzle-piece"></i></div>' +
          '<h2>Product Forge Local</h2>' +
          '<p>No <code>cards/</code> directory found in this project. Create one using Claude with the Product Forge Local plugin to get started.</p>' +
          '<p>Expected structure:<br><code>cards/initiatives/</code>, <code>cards/epics/</code>, <code>cards/stories/</code>, etc.</p>' +
        '</div>';
    },

    _renderLayout(view, rootHandle) {
      // Handle both FileSystemDirectoryHandle (browser) and path string (Tauri)
      var dirName = '';
      if (rootHandle) {
        dirName = typeof rootHandle === 'string'
          ? rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle
          : rootHandle.name;
      }

      view.innerHTML =
        /* Toolbar */
        '<div class="pfl-layout">' +
          '<div class="plugin-toolbar">' +
            '<span class="toolbar-title"><i class="fa-solid fa-clipboard-list"></i> Product Forge</span>' +
            '<div class="folder-path">' +
              '<span><i class="fa-solid fa-folder-open"></i></span>' +
              '<span>' + ESC(dirName) + '/cards</span>' +
            '</div>' +
            '<div class="spacer"></div>' +
            '<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
            '<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +

          /* Sidebar */
          '<aside class="pfl-sidebar">' +
            '<div class="pfl-tree-view"></div>' +
          '</aside>' +

          /* Detail panel */
          '<main class="pfl-detail-panel">' +
            '<div class="pfl-empty-state empty-state">' +
              '<div class="icon"><i class="fa-solid fa-file-lines"></i></div>' +
              '<div>Select a card from the tree to view details</div>' +
            '</div>' +
            '<div class="pfl-card-detail hidden"></div>' +
          '</main>' +

        '</div>' +

        /* Edit Modal (local to this view) */
        '<div class="pfl-modal-overlay">' +
          '<div class="pfl-modal-content">' +
            '<div class="pfl-modal-header">' +
              '<h3>Edit Card</h3>' +
              '<button class="pfl-modal-close" data-pfl-modal-action="close">&times;</button>' +
            '</div>' +
            '<div class="pfl-modal-body"></div>' +
            '<div class="pfl-modal-footer">' +
              '<button data-pfl-modal-action="close">Cancel</button>' +
              '<button data-pfl-modal-action="toggle-diff">Preview Changes</button>' +
              '<button class="primary" data-pfl-modal-action="save">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      /* Bind toolbar refresh button */
      var refreshBtn = $q('[data-pfl-action="refresh"]');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () { ctrl.refresh(); });
      }

      /* Bind modal actions */
      $qa('[data-pfl-modal-action]').forEach(function (el) {
        el.addEventListener('click', function () {
          var action = el.dataset.pflModalAction;
          if (action === 'close') editModal.close();
          else if (action === 'toggle-diff') editModal.toggleDiff();
          else if (action === 'save') editModal.save();
        });
      });
    },

    async _loadCards() {
      store.clear();

      // V2: Load from index.json instead of scanning directories
      var indexData = await ForgeUtils.readIndex(rootHandle, 'cards');
      if (!indexData || !indexData.entries) {
        indexData = { entries: [] };
      }

      for (var entry of indexData.entries) {
        var card = {
          filename: entry.filename,
          frontmatter: entry.frontmatter || {},
          body: entry.body || '',
          error: entry.error || null,
          dirName: entry.dirName
        };
        store.set(entry.filename, card, Date.now(), null);
      }

      taxonomy = discoverTaxonomy(store.all());
      this._renderTree();
      this._updateRefreshIndicator();
    },

    _renderTree() {
      var hierarchy = buildHierarchy(store);
      treeView.render(hierarchy);
      if (selectedCard) treeView.highlightSelected(selectedCard);
    },

    _updateRefreshIndicator() {
      var el = $q('[data-pfl-refresh-ind]');
      if (!el) return;
      var count = store.cards.size;
      var now = new Date();
      var time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.textContent = count + ' cards \u00B7 ' + time;
    },

    /* ─── Auto Refresh ─── */
    _startAutoRefresh() {
      this._stopAutoRefresh();
      refreshInterval = setInterval(function () { ctrl._doRefresh(); }, 5000);
    },

    _stopAutoRefresh() {
      if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
    },

    async _doRefresh() {
      if (refreshRunning || !cardsHandle) return;
      refreshRunning = true;
      try {
        // V2: Load from index.json instead of scanning directories
        var indexData = await ForgeUtils.readIndex(rootHandle, 'cards');
        if (!indexData || !indexData.entries) {
          indexData = { entries: [] };
        }

        var changes = { added: [], modified: [], deleted: [] };
        var currentFilenames = new Set();

        for (var entry of indexData.entries) {
          var filename = entry.filename;
          currentFilenames.add(filename);

          var oldTs = store.timestamps.get(filename);
          if (oldTs === undefined) {
            changes.added.push(filename);
          } else {
            // Check if modified (using current timestamp since index doesn't track lastModified the same way)
            // In V2, we can compare against index metadata if available
            var newTs = Date.now();
            if (newTs !== oldTs) {
              changes.modified.push(filename);
            }
          }

          var card = {
            filename: entry.filename,
            frontmatter: entry.frontmatter || {},
            body: entry.body || '',
            error: entry.error || null,
            dirName: entry.dirName
          };
          store.set(entry.filename, card, Date.now(), null);
        }

        for (var fn of store.cards.keys()) {
          if (!currentFilenames.has(fn)) {
            changes.deleted.push(fn);
            store.delete(fn);
          }
        }

        var hasChanges = changes.added.length + changes.modified.length + changes.deleted.length > 0;
        if (hasChanges) {
          taxonomy = discoverTaxonomy(store.all());
          this._renderTree();
          if (selectedCard) {
            var sc = store.get(selectedCard);
            if (sc) {
              if (changes.modified.includes(selectedCard)) detailPanel.renderCard(sc);
            } else {
              selectedCard = null;
              detailPanel.renderCard(null);
            }
          }
        }
        this._updateRefreshIndicator();
      } catch (e) {
        console.warn('Product Forge refresh error:', e);
      } finally {
        refreshRunning = false;
      }
    },

    /* ─── Reparent / Unparent ─── */
    async _reparentCard(cardFilename, newParentFilename) {
      var card = store.get(cardFilename);
      var newParent = store.get(newParentFilename);
      if (!card || !newParent) return;

      var oldParentFilename = card.frontmatter.parent;
      var oldParent = oldParentFilename ? store.get(oldParentFilename) : null;

      var details = '<strong>Moving:</strong> ' + ESC(card.frontmatter.title || cardFilename) + '<br>';
      if (oldParent) details += '<strong>From:</strong> ' + ESC(oldParent.frontmatter.title || oldParentFilename) + '<br>';
      details += '<strong>To:</strong> ' + ESC(newParent.frontmatter.title || newParentFilename) + '<br><br>';
      details += '<strong>Files to update:</strong><br>';
      details += '- ' + cardFilename + '.md (parent field)<br>';
      if (oldParent) details += '- ' + oldParentFilename + '.md (remove from children)<br>';
      details += '- ' + newParentFilename + '.md (add to children)';

      var confirmed = await ForgeUtils.Confirm.show('Reparent Card', 'This will update the following files:', details);
      if (!confirmed) return;

      try {
        var today = ForgeUtils.todayISO();

        card.frontmatter.parent = newParentFilename;
        card.frontmatter.updated = today;
        var cardContent = CardParser.serialize(card.frontmatter, card.body);
        var cardHandle = store.fileHandles.get(cardFilename);
        if (cardHandle) await ForgeUtils.FS.writeFile(cardHandle, cardContent);

        if (oldParent) {
          if (Array.isArray(oldParent.frontmatter.children)) {
            oldParent.frontmatter.children = oldParent.frontmatter.children.filter(function (c) { return c !== cardFilename; });
          }
          oldParent.frontmatter.updated = today;
          var oldContent = CardParser.serialize(oldParent.frontmatter, oldParent.body);
          var oldHandle = store.fileHandles.get(oldParentFilename);
          if (oldHandle) await ForgeUtils.FS.writeFile(oldHandle, oldContent);
        }

        if (!Array.isArray(newParent.frontmatter.children)) {
          newParent.frontmatter.children = [];
        }
        if (!newParent.frontmatter.children.includes(cardFilename)) {
          newParent.frontmatter.children.push(cardFilename);
        }
        newParent.frontmatter.updated = today;
        var newContent = CardParser.serialize(newParent.frontmatter, newParent.body);
        var newHandle = store.fileHandles.get(newParentFilename);
        if (newHandle) await ForgeUtils.FS.writeFile(newHandle, newContent);

        [cardFilename, oldParentFilename, newParentFilename].forEach(function (fn) {
          if (!fn) return;
          var c = store.get(fn);
          if (c) {
            var reparsed = CardParser.parse(fn, CardParser.serialize(c.frontmatter, c.body), c.dirName);
            store.set(fn, reparsed, Date.now(), store.fileHandles.get(fn));
          }
        });

        this._renderTree();
        if (selectedCard) {
          var sel = store.get(selectedCard);
          if (sel) detailPanel.renderCard(sel);
        }
        ForgeUtils.Toast.show('Card reparented successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Reparent failed: ' + e.message, 'error');
      }
    },

    async _unparentCard(cardFilename) {
      var card = store.get(cardFilename);
      if (!card) return;
      var oldParentFilename = card.frontmatter.parent;
      if (!oldParentFilename) return;
      var oldParent = store.get(oldParentFilename);

      var details = '<strong>Unparenting:</strong> ' + ESC(card.frontmatter.title || cardFilename) + '<br>';
      if (oldParent) details += '<strong>From:</strong> ' + ESC(oldParent.frontmatter.title || oldParentFilename) + '<br>';
      details += '<br><strong>Files to update:</strong><br>';
      details += '- ' + cardFilename + '.md (remove parent field)<br>';
      if (oldParent) details += '- ' + oldParentFilename + '.md (remove from children)';

      var confirmed = await ForgeUtils.Confirm.show('Unparent Card', 'This will update the following files:', details);
      if (!confirmed) return;

      try {
        var today = ForgeUtils.todayISO();

        card.frontmatter.parent = null;
        card.frontmatter.updated = today;
        var cardContent = CardParser.serialize(card.frontmatter, card.body);
        var cardHandle = store.fileHandles.get(cardFilename);
        if (cardHandle) await ForgeUtils.FS.writeFile(cardHandle, cardContent);

        if (oldParent) {
          if (Array.isArray(oldParent.frontmatter.children)) {
            oldParent.frontmatter.children = oldParent.frontmatter.children.filter(function (c) { return c !== cardFilename; });
          }
          oldParent.frontmatter.updated = today;
          var oldContent = CardParser.serialize(oldParent.frontmatter, oldParent.body);
          var oldHandle = store.fileHandles.get(oldParentFilename);
          if (oldHandle) await ForgeUtils.FS.writeFile(oldHandle, oldContent);
        }

        [cardFilename, oldParentFilename].forEach(function (fn) {
          if (!fn) return;
          var c = store.get(fn);
          if (c) {
            var reparsed = CardParser.parse(fn, CardParser.serialize(c.frontmatter, c.body), c.dirName);
            store.set(fn, reparsed, Date.now(), store.fileHandles.get(fn));
          }
        });

        this._renderTree();
        if (selectedCard) {
          var sel = store.get(selectedCard);
          if (sel) detailPanel.renderCard(sel);
        }
        ForgeUtils.Toast.show('Card unparented successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Unparent failed: ' + e.message, 'error');
      }
    },

    /* ─── Keyboard ─── */
    _bindKeyboard() {
      this._unbindKeyboard();
      keydownHandler = function (e) {
        /* Escape closes edit modal */
        if (e.key === 'Escape') {
          var overlay = $q('.pfl-modal-overlay');
          if (overlay && overlay.classList.contains('pfl-visible')) {
            editModal.close();
            return;
          }
        }

        if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement && document.activeElement.tagName)) return;

        if (e.key === 'e' && selectedCard) {
          editModal.open(selectedCard);
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var headers = Array.from($qa('.pfl-tree-node-header[data-pfl-select]'));
          if (headers.length === 0) return;
          var currentIdx = headers.findIndex(function (h) { return h.dataset.pflSelect === selectedCard; });
          var nextIdx;
          if (e.key === 'ArrowDown') {
            nextIdx = currentIdx < headers.length - 1 ? currentIdx + 1 : 0;
          } else {
            nextIdx = currentIdx > 0 ? currentIdx - 1 : headers.length - 1;
          }
          var nextFilename = headers[nextIdx].dataset.pflSelect;
          ctrl.selectCard(nextFilename);
          headers[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      };
      document.addEventListener('keydown', keydownHandler);
    },

    _unbindKeyboard() {
      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Expose & Register
     ═══════════════════════════════════════════════════════════════ */
  window.ProductForgeView = ctrl;
  Shell.registerController('product-forge', window.ProductForgeView);

})();
