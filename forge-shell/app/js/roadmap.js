/* ═══════════════════════════════════════════════════════════════
   Roadmap — View Controller
   All DOM scoped to #view-roadmap, classes rm-*
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var ESC = ForgeUtils.escapeHTML;
  var VIEW_ID = 'view-roadmap';
  var RH = typeof RoadmapHelpers !== 'undefined' ? RoadmapHelpers : {};
  var OPTIMISTIC_TTL_MS = 15000;

  function $view() { return document.getElementById(VIEW_ID); }
  function $q(sel) { var v = $view(); return v ? v.querySelector(sel) : null; }
  function $qa(sel) { var v = $view(); return v ? v.querySelectorAll(sel) : []; }

  /** data-rm-filename / type / status for event delegation (identity only). */
  function cardIdentityAttrs(card) {
    var fm = (card && card.frontmatter) || {};
    return ' data-rm-filename="' + ESC(card.filename || '') + '"' +
      ' data-rm-type="' + ESC(fm.type || '') + '"' +
      ' data-rm-status="' + ESC(fm.status || '') + '"';
  }

  /* ═══════════════════════════════════════════════════════════════
     TimeUtils — Period / release mapping
     ═══════════════════════════════════════════════════════════════ */
  var TimeUtils = {
    getQuarters: function (year) {
      return [
        { label: 'Q1 ' + year, start: year + '-01-01', end: year + '-03-31' },
        { label: 'Q2 ' + year, start: year + '-04-01', end: year + '-06-30' },
        { label: 'Q3 ' + year, start: year + '-07-01', end: year + '-09-30' },
        { label: 'Q4 ' + year, start: year + '-10-01', end: year + '-12-31' }
      ];
    },

    getMonths: function (year) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months.map(function (m, i) {
        var mm = String(i + 1).padStart(2, '0');
        var lastDay = new Date(year, i + 1, 0).getDate();
        return {
          label: m + ' ' + year,
          start: year + '-' + mm + '-01',
          end: year + '-' + mm + '-' + String(lastDay).padStart(2, '0')
        };
      });
    },

    getCurrentPeriodIndex: function (periods) {
      var today = ForgeUtils.todayISO();
      for (var i = 0; i < periods.length; i++) {
        if (today >= periods[i].start && today <= periods[i].end) return i;
      }
      return -1;
    },

    releaseOverlapsPeriod: function (release, period) {
      // Prefer pure helper so placement stays in lockstep with resolveDropToRelease
      if (typeof RH.releaseOverlapsPeriod === 'function') {
        return RH.releaseOverlapsPeriod(release, period);
      }
      if (!release || !release.start_date || !release.end_date) return false;
      if (!period || !period.start || !period.end) return false;
      return release.start_date <= period.end && release.end_date >= period.start;
    },

    getReleaseForCard: function (card, releases) {
      if (!card.frontmatter.release || !releases) return null;
      var relName = String(card.frontmatter.release).toLowerCase();
      for (var i = 0; i < releases.length; i++) {
        if (String(releases[i].name).toLowerCase() === relName) return releases[i];
      }
      return null;
    },

    cardInPeriod: function (card, period, releases) {
      var rel = this.getReleaseForCard(card, releases);
      if (!rel) return false;
      return this.releaseOverlapsPeriod(rel, period);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     OptimisticGuard — pending writes vs auto-refresh (TTL 15s)
     ═══════════════════════════════════════════════════════════════ */
  var OptimisticGuard = {
    _pending: new Map(),

    mark: function (filename, entry) {
      this._pending.set(filename, entry);
    },

    clear: function (filename) {
      this._pending.delete(filename);
    },

    get: function (filename) {
      return this._pending.has(filename) ? this._pending.get(filename) : null;
    },

    clearAll: function () {
      this._pending.clear();
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     CardWriteService — portable card frontmatter writes
     Uses ForgeFS.writeFile(cardsHandle, relPath, content) only.
     ═══════════════════════════════════════════════════════════════ */
  var CardWriteService = {
    /**
     * Mutate card frontmatter, serialize, write via portable FS path.
     * Marks OptimisticGuard BEFORE await write so concurrent refresh cannot clobber.
     * @param {string} filename
     * @param {function(object): void} mutatorFn — receives live frontmatter
     * @returns {Promise<object>} reparsed card
     */
    patchCardFrontmatter: async function (filename, mutatorFn) {
      var card = store.get(filename);
      if (!card || !cardsHandle) throw new Error('Card not writable: ' + filename);

      var prevFm = JSON.parse(JSON.stringify(card.frontmatter));
      try {
        mutatorFn(card.frontmatter);
        card.frontmatter.updated = ForgeUtils.todayISO();

        var content = CardData.CardParser.serialize(card.frontmatter, card.body);
        var relPath = RH.cardRelativePath
          ? RH.cardRelativePath(card)
          : (card.dirName + '/' + card.filename + '.md');

        // mark BEFORE await write so concurrent refresh cannot win the race
        OptimisticGuard.mark(filename, { expectedContent: content, writtenAt: Date.now() });

        await ForgeFS.writeFile(cardsHandle, relPath, content);
        var reparsed = CardData.CardParser.parse(filename, content, card.dirName);
        // Keep existing handle map entry if any; not used for Roadmap writes
        store.set(filename, reparsed, Date.now(), store.fileHandles.get(filename));
        // Keep pending until a scan sees matching content (or TTL force-apply)
        return reparsed;
      } catch (e) {
        // Restore on mutator/serialize/write failure (any error after mutation)
        card.frontmatter = prevFm;
        OptimisticGuard.clear(filename);
        throw e;
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RoadmapConfigManager — Load/save cards/roadmap.md
     ═══════════════════════════════════════════════════════════════ */
  var RoadmapConfigManager = {
    _default: function () {
      var year = new Date().getFullYear();
      return {
        type: 'roadmap-config',
        title: 'Project Roadmap',
        default_view: 'card',
        time_granularity: 'quarterly',
        current_year: year,
        show_stories: false,
        releases: [],
        buckets: [],
        swim_lanes: []
      };
    },

    load: async function (cardsHandle) {
      if (!cardsHandle) return this._default();
      var fileData = await ForgeUtils.FS.getFile(cardsHandle, 'roadmap.md');
      if (!fileData) return this._default();
      var parsed = ForgeUtils.parseFrontmatter(fileData.text);
      if (!parsed || !parsed.frontmatter) return this._default();
      var cfg = parsed.frontmatter;
      /* Normalize defaults */
      if (!cfg.type) cfg.type = 'roadmap-config';
      if (!cfg.default_view) cfg.default_view = 'card';
      if (!cfg.time_granularity) cfg.time_granularity = 'quarterly';
      if (!cfg.current_year) cfg.current_year = new Date().getFullYear();
      if (!Array.isArray(cfg.releases)) cfg.releases = [];
      if (!Array.isArray(cfg.buckets)) cfg.buckets = [];
      if (!Array.isArray(cfg.swim_lanes)) cfg.swim_lanes = [];
      if (cfg.show_stories === undefined || cfg.show_stories === null) cfg.show_stories = false;
      return cfg;
    },

    save: async function (cardsHandle, config) {
      if (!cardsHandle) return;
      var yaml = ForgeUtils.YAML.stringify(config, [
        'type','title','default_view','time_granularity','current_year','show_stories',
        'releases','buckets','swim_lanes'
      ]);
      var content = '---\n' + yaml + '\n---\n';
      try {
        // Use ForgeFS to write the file (works in both browser and Tauri modes)
        await ForgeFS.writeFile(cardsHandle, 'roadmap.md', content);
      } catch (e) {
        console.error('Failed to save roadmap.md:', e);
        ForgeUtils.Toast.show('Failed to save roadmap config: ' + e.message, 'error');
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     CardView — Quarterly/monthly column renderer
     ═══════════════════════════════════════════════════════════════ */
  var CardView = {
    render: function (container, periods, hierarchy, config) {
      var releases = config.releases || [];
      var buckets = config.buckets || [];
      var showStories = config.show_stories;
      var currentIdx = TimeUtils.getCurrentPeriodIndex(periods);

      var html = '<div class="rm-card-columns">';

      for (var pi = 0; pi < periods.length; pi++) {
        var period = periods[pi];
        var isCurrent = pi === currentIdx;
        html += '<div class="rm-column' + (isCurrent ? ' rm-current-period' : '') + '"' +
          ' data-rm-period-index="' + pi + '"' +
          ' data-rm-period-start="' + ESC(period.start || '') + '"' +
          ' data-rm-period-end="' + ESC(period.end || '') + '">';
        html += '<div class="rm-column-header"><span>' + ESC(period.label) + '</span>';
        if (isCurrent) html += '<span class="rm-current-badge">Current</span>';
        html += '</div>';
        html += '<div class="rm-column-body">';
        html += this._renderPeriodCards(period, hierarchy, releases, buckets, showStories);
        html += '</div></div>';
      }

      /* Unscheduled column */
      html += '<div class="rm-column rm-unscheduled" data-rm-period-index="unscheduled">';
      html += '<div class="rm-column-header"><span>Unscheduled</span></div>';
      html += '<div class="rm-column-body">';
      html += this._renderUnscheduledCards(hierarchy, releases, buckets, showStories);
      html += '</div></div>';

      html += '</div>';
      container.innerHTML = html;
    },

    _renderPeriodCards: function (period, hierarchy, releases, buckets, showStories) {
      var initCards = this._getInitiativesForPeriod(hierarchy, period, releases);
      if (initCards.length === 0) return '<div class="rm-column-empty">No cards in this period</div>';

      var html = '';
      var bucketed = new Set();

      /* Render bucketed cards */
      for (var bi = 0; bi < buckets.length; bi++) {
        var bucket = buckets[bi];
        var bucketInits = initCards.filter(function (node) {
          if (!bucket.initiatives) return false;
          return bucket.initiatives.includes(node.card.filename);
        });
        if (bucketInits.length === 0) continue;
        bucketInits.forEach(function (n) { bucketed.add(n.card.filename); });

        html += '<div class="rm-bucket-group">';
        html += '<div class="rm-bucket-header" data-rm-bucket-toggle="' + bi + '">';
        html += '<span class="rm-chevron"><i class="fa-solid fa-chevron-down"></i></span>';
        html += '<span class="rm-bucket-dot" style="background:' + ESC(bucket.color || 'var(--text-muted)') + '"></span>';
        html += '<span>' + ESC(bucket.name || 'Bucket') + '</span>';
        html += '</div>';
        html += '<div class="rm-bucket-cards" data-rm-bucket-body="' + bi + '">';
        for (var k = 0; k < bucketInits.length; k++) {
          html += this._renderInitiativeInColumn(bucketInits[k], bucket.color, showStories);
        }
        html += '</div></div>';
      }

      /* Ungrouped */
      var ungrouped = initCards.filter(function (n) { return !bucketed.has(n.card.filename); });
      if (ungrouped.length > 0) {
        if (bucketed.size > 0) html += '<div class="rm-ungrouped-label">Ungrouped</div>';
        for (var u = 0; u < ungrouped.length; u++) {
          html += this._renderInitiativeInColumn(ungrouped[u], null, showStories);
        }
      }

      return html;
    },

    _renderUnscheduledCards: function (hierarchy, releases, buckets, showStories) {
      var unscheduled = hierarchy.tree.filter(function (node) {
        return !TimeUtils.getReleaseForCard(node.card, releases);
      });
      if (unscheduled.length === 0) return '<div class="rm-column-empty">All cards are scheduled</div>';

      var html = '';
      for (var i = 0; i < unscheduled.length; i++) {
        html += this._renderInitiativeInColumn(unscheduled[i], null, showStories);
      }
      return html;
    },

    _getInitiativesForPeriod: function (hierarchy, period, releases) {
      return hierarchy.tree.filter(function (node) {
        return TimeUtils.cardInPeriod(node.card, period, releases);
      });
    },

    _renderInitiativeInColumn: function (initNode, bucketColor, showStories) {
      var card = initNode.card;
      var fm = card.frontmatter;
      var borderColor = bucketColor || 'var(--type-initiative)';
      var html = '<div class="rm-initiative-card" style="border-left-color:' + ESC(borderColor) + '"' +
        cardIdentityAttrs(card) + '>';
      html += '<div class="rm-card-title">' + ESC(fm.title || card.filename) + '</div>';
      html += '<div class="rm-card-meta">';
      html += '<span class="rm-status-dot" style="background:' + CardData.getStatusColor(fm.status) + '"></span>';
      html += '<span class="rm-status-label">' + ESC(fm.status || '') + '</span>';
      if (fm.client) html += '<span class="rm-tag-pill rm-client">' + ESC(fm.client) + '</span>';
      if (fm.module) html += '<span class="rm-tag-pill rm-module">' + ESC(fm.module) + '</span>';
      html += '</div></div>';

      /* Render child epics */
      for (var ei = 0; ei < initNode.children.length; ei++) {
        var epicNode = initNode.children[ei];
        var efm = epicNode.card.frontmatter;
        html += '<div class="rm-epic-card"' + cardIdentityAttrs(epicNode.card) + '>';
        html += '<div class="rm-card-title">' + ESC(efm.title || epicNode.card.filename) + '</div>';
        html += '<div class="rm-card-meta">';
        html += '<span class="rm-status-dot" style="background:' + CardData.getStatusColor(efm.status) + '"></span>';
        html += '<span class="rm-status-label">' + ESC(efm.status || '') + '</span>';
        if (efm.client) html += '<span class="rm-tag-pill rm-client">' + ESC(efm.client) + '</span>';
        if (efm.module) html += '<span class="rm-tag-pill rm-module">' + ESC(efm.module) + '</span>';
        html += '</div></div>';

        /* Stories (hierarchy stores story cards directly under epic children) */
        if (showStories) {
          for (var si = 0; si < epicNode.children.length; si++) {
            var storyCard = epicNode.children[si];
            var sfm = storyCard.frontmatter;
            html += '<div class="rm-story-card"' + cardIdentityAttrs(storyCard) + '>';
            html += '<div class="rm-card-title">' + ESC(sfm.title || storyCard.filename) + '</div>';
            html += '</div>';
          }
        }
      }

      return html;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TimelineView — Gantt-style horizontal bars
     ═══════════════════════════════════════════════════════════════ */
  var TimelineView = {
    collapsedLanes: new Set(),

    render: function (container, periods, hierarchy, config, taxonomy) {
      var releases = config.releases || [];
      var swimLanes = config.swim_lanes && config.swim_lanes.length > 0
        ? config.swim_lanes
        : taxonomy.products;
      var currentIdx = TimeUtils.getCurrentPeriodIndex(periods);

      if (hierarchy.tree.length === 0) {
        container.innerHTML = '<div class="rm-timeline-empty"><i class="fa-solid fa-chart-gantt" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px"></i>No initiative cards found. Create some cards to see the timeline.</div>';
        return;
      }

      var html = '';

      /* Header row */
      html += '<div class="rm-timeline-header">';
      html += '<div class="rm-timeline-label-col">Product</div>';
      for (var hi = 0; hi < periods.length; hi++) {
        html += '<div class="rm-timeline-period-cell' + (hi === currentIdx ? ' rm-current-period' : '') + '">' + ESC(periods[hi].label) + '</div>';
      }
      html += '</div>';

      /* Body */
      html += '<div class="rm-timeline-body">';

      for (var li = 0; li < swimLanes.length; li++) {
        var lane = swimLanes[li];
        var collapsed = this.collapsedLanes.has(lane);
        var laneInits = hierarchy.tree.filter(function (n) { return n.card.frontmatter.product === lane; });

        html += '<div class="rm-swim-lane">';

        /* Lane header */
        html += '<div class="rm-swim-lane-header">';
        html += '<div class="rm-swim-lane-label" data-rm-lane-toggle="' + ESC(lane) + '">';
        html += '<span class="rm-chevron' + (collapsed ? ' rm-collapsed' : '') + '"><i class="fa-solid fa-chevron-down"></i></span>';
        html += '<span>' + ESC(lane) + '</span>';
        html += '<span style="color:var(--text-muted);font-size:11px">(' + laneInits.length + ')</span>';
        html += '</div>';

        /* Track cells (for grid lines) */
        html += '<div class="rm-swim-lane-track">';
        for (var ci = 0; ci < periods.length; ci++) {
          html += '<div class="rm-swim-lane-track-cell' + (ci === currentIdx ? ' rm-current-period' : '') + '"></div>';
        }
        html += '</div></div>';

        /* Bar rows */
        html += '<div class="rm-swim-lane-bars' + (collapsed ? ' rm-collapsed' : '') + '" data-rm-lane-body="' + ESC(lane) + '">';
        for (var ii = 0; ii < laneInits.length; ii++) {
          html += this._renderBarRow(laneInits[ii], periods, releases, currentIdx);
        }
        html += '</div></div>';
      }

      /* Unassigned product lane */
      var unassigned = hierarchy.tree.filter(function (n) {
        var prod = n.card.frontmatter.product;
        return !prod || swimLanes.indexOf(prod) === -1;
      });
      if (unassigned.length > 0) {
        html += '<div class="rm-swim-lane">';
        html += '<div class="rm-swim-lane-header">';
        html += '<div class="rm-swim-lane-label" data-rm-lane-toggle="__unassigned">';
        html += '<span class="rm-chevron"><i class="fa-solid fa-chevron-down"></i></span>';
        html += '<span style="font-style:italic">No Product</span>';
        html += '<span style="color:var(--text-muted);font-size:11px">(' + unassigned.length + ')</span>';
        html += '</div>';
        html += '<div class="rm-swim-lane-track">';
        for (var ui = 0; ui < periods.length; ui++) {
          html += '<div class="rm-swim-lane-track-cell' + (ui === currentIdx ? ' rm-current-period' : '') + '"></div>';
        }
        html += '</div></div>';
        html += '<div class="rm-swim-lane-bars" data-rm-lane-body="__unassigned">';
        for (var uj = 0; uj < unassigned.length; uj++) {
          html += this._renderBarRow(unassigned[uj], periods, releases, currentIdx);
        }
        html += '</div></div>';
      }

      html += '</div>';
      container.innerHTML = html;
    },

    _renderBarRow: function (initNode, periods, releases, currentIdx) {
      var card = initNode.card;
      var fm = card.frontmatter;
      var rel = TimeUtils.getReleaseForCard(card, releases);
      var idAttrs = cardIdentityAttrs(card);

      var html = '<div class="rm-bar-row"' + idAttrs + '>';
      html += '<div class="rm-bar-row-label" title="' + ESC(fm.title || card.filename) + '"' + idAttrs + '>';
      html += '<span class="rm-status-dot" style="background:' + CardData.getStatusColor(fm.status) + '"></span> ';
      html += ESC(fm.title || card.filename);
      html += '</div>';
      html += '<div class="rm-bar-row-track">';

      if (rel && rel.start_date && rel.end_date) {
        /* Calculate bar position */
        var timelineStart = new Date(periods[0].start).getTime();
        var timelineEnd = new Date(periods[periods.length - 1].end).getTime();
        var totalMs = timelineEnd - timelineStart;
        var barStart = new Date(rel.start_date).getTime();
        var barEnd = new Date(rel.end_date).getTime();
        var leftPct = Math.max(0, (barStart - timelineStart) / totalMs * 100);
        var widthPct = Math.min(100 - leftPct, (barEnd - barStart) / totalMs * 100);
        if (widthPct < 2) widthPct = 2;

        html += '<div class="rm-bar rm-initiative-bar" style="left:' + leftPct.toFixed(1) + '%;width:' + widthPct.toFixed(1) + '%"' + idAttrs + ' ';
        html += 'data-rm-tooltip-title="' + ESC(fm.title || card.filename) + '" ';
        html += 'data-rm-tooltip-meta="' + ESC((fm.release || '') + ' | ' + (rel.start_date || '') + ' to ' + (rel.end_date || '')) + '">';
        html += ESC(fm.title || card.filename);
        html += '</div>';
      }

      html += '</div></div>';
      return html;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     FilterPanel
     ═══════════════════════════════════════════════════════════════ */
  var FilterPanel = {
    open: false,
    filters: { product: [], client: [], module: [], status: [], release: [] },

    getActiveCount: function () {
      var count = 0;
      for (var k in this.filters) {
        if (this.filters[k].length > 0) count += this.filters[k].length;
      }
      return count;
    },

    clearAll: function () {
      this.filters = { product: [], client: [], module: [], status: [], release: [] };
    },

    cardMatchesFilters: function (card) {
      var fm = card.frontmatter;
      if (this.filters.product.length > 0 && this.filters.product.indexOf(fm.product) === -1) return false;
      if (this.filters.client.length > 0 && this.filters.client.indexOf(fm.client) === -1) return false;
      if (this.filters.module.length > 0 && this.filters.module.indexOf(fm.module) === -1) return false;
      if (this.filters.status.length > 0 && this.filters.status.indexOf(fm.status) === -1) return false;
      if (this.filters.release.length > 0 && this.filters.release.indexOf(fm.release || '') === -1) return false;
      return true;
    },

    filterHierarchy: function (hierarchy) {
      if (this.getActiveCount() === 0) return hierarchy;
      var self = this;
      var filteredTree = hierarchy.tree.filter(function (n) {
        return self.cardMatchesFilters(n.card);
      }).map(function (n) {
        return {
          card: n.card,
          children: n.children.filter(function (en) {
            return self.cardMatchesFilters(en.card);
          }).map(function (en) {
            return {
              card: en.card,
              children: en.children.filter(function (s) { return self.cardMatchesFilters(s); })
            };
          })
        };
      });
      return {
        tree: filteredTree,
        orphanEpics: hierarchy.orphanEpics,
        orphanStories: hierarchy.orphanStories,
        intakes: hierarchy.intakes,
        checkpoints: hierarchy.checkpoints,
        decisions: hierarchy.decisions,
        releaseNotes: hierarchy.releaseNotes
      };
    },

    render: function (container, taxonomy, config) {
      var releases = (config.releases || []).map(function (r) { return r.name; });
      var allStatuses = [];
      for (var k in CardData.STATUS_OPTIONS) {
        CardData.STATUS_OPTIONS[k].forEach(function (s) {
          if (allStatuses.indexOf(s) === -1) allStatuses.push(s);
        });
      }

      var html = '<div class="rm-filter-header">';
      html += '<span>Filters</span>';
      html += '<button class="btn-icon rm-filter-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>';
      html += '</div>';
      html += '<div class="rm-filter-body">';

      html += this._renderFilterGroup('product', 'Product', taxonomy.products);
      html += this._renderFilterGroup('client', 'Client', taxonomy.clients);
      html += this._renderFilterGroup('module', 'Module', taxonomy.modules);
      html += this._renderFilterGroup('status', 'Status', allStatuses);
      html += this._renderFilterGroup('release', 'Release', releases);

      html += '</div>';
      html += '<div class="rm-filter-footer">';
      html += '<button data-rm-filter-clear>Clear All Filters</button>';
      html += '</div>';

      container.innerHTML = html;
    },

    _renderFilterGroup: function (key, label, options) {
      var self = this;
      var html = '<div class="rm-filter-group">';
      html += '<label>' + ESC(label) + '</label>';
      html += '<select data-rm-filter-select="' + key + '">';
      html += '<option value="">Add ' + ESC(label) + '...</option>';
      options.forEach(function (o) {
        html += '<option value="' + ESC(o) + '">' + ESC(o) + '</option>';
      });
      html += '</select>';

      if (this.filters[key].length > 0) {
        html += '<div class="rm-filter-chips">';
        this.filters[key].forEach(function (v) {
          html += '<span class="rm-filter-chip" data-rm-filter-remove="' + key + '" data-rm-filter-value="' + ESC(v) + '">' +
            ESC(v) + ' <i class="fa-solid fa-xmark"></i></span>';
        });
        html += '</div>';
      }

      html += '</div>';
      return html;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     ConfigModal — Tabbed settings modal
     ═══════════════════════════════════════════════════════════════ */
  var ConfigModal = {
    activeTab: 'releases',
    tempConfig: null,

    open: function (config, allInitiatives, taxonomy) {
      this.tempConfig = JSON.parse(JSON.stringify(config));
      this.activeTab = 'releases';

      var overlay = $q('.rm-modal-overlay');
      if (!overlay) return;

      this._renderContent(allInitiatives, taxonomy);
      overlay.classList.add('rm-visible');
    },

    close: function () {
      var overlay = $q('.rm-modal-overlay');
      if (overlay) overlay.classList.remove('rm-visible');
      this.tempConfig = null;
    },

    save: function () {
      return this.tempConfig ? JSON.parse(JSON.stringify(this.tempConfig)) : null;
    },

    _renderContent: function (allInitiatives, taxonomy) {
      var bodyEl = $q('.rm-modal-body');
      if (!bodyEl) return;

      var html = '<div class="rm-tabs">';
      html += '<button class="rm-tab' + (this.activeTab === 'releases' ? ' rm-active' : '') + '" data-rm-config-tab="releases">Releases</button>';
      html += '<button class="rm-tab' + (this.activeTab === 'buckets' ? ' rm-active' : '') + '" data-rm-config-tab="buckets">Buckets</button>';
      html += '<button class="rm-tab' + (this.activeTab === 'swim_lanes' ? ' rm-active' : '') + '" data-rm-config-tab="swim_lanes">Swim Lanes</button>';
      html += '</div>';

      /* Releases Tab */
      html += '<div class="rm-tab-content' + (this.activeTab === 'releases' ? ' rm-active' : '') + '" data-rm-tab-body="releases">';
      html += '<div class="rm-config-list">';
      var releases = this.tempConfig.releases || [];
      for (var ri = 0; ri < releases.length; ri++) {
        var r = releases[ri];
        html += '<div class="rm-config-item" data-rm-release-idx="' + ri + '">';
        html += '<input type="text" data-rm-rel-name="' + ri + '" value="' + ESC(r.name || '') + '" placeholder="Name (e.g. Q1 2026)">';
        html += '<input type="date" data-rm-rel-start="' + ri + '" value="' + (r.start_date || '') + '">';
        html += '<input type="date" data-rm-rel-end="' + ri + '" value="' + (r.end_date || '') + '">';
        html += '<span class="rm-config-remove" data-rm-rel-remove="' + ri + '" title="Remove"><i class="fa-solid fa-trash"></i></span>';
        html += '</div>';
      }
      html += '</div>';
      html += '<button class="rm-config-add" data-rm-rel-add><i class="fa-solid fa-plus"></i> Add Release</button>';
      html += '</div>';

      /* Buckets Tab */
      html += '<div class="rm-tab-content' + (this.activeTab === 'buckets' ? ' rm-active' : '') + '" data-rm-tab-body="buckets">';
      html += '<div class="rm-config-list">';
      var buckets = this.tempConfig.buckets || [];
      for (var bi = 0; bi < buckets.length; bi++) {
        var b = buckets[bi];
        html += '<div class="rm-config-item" style="flex-wrap:wrap" data-rm-bucket-idx="' + bi + '">';
        html += '<input type="color" data-rm-bkt-color="' + bi + '" value="' + (b.color || '#3b82f6') + '">';
        html += '<input type="text" data-rm-bkt-name="' + bi + '" value="' + ESC(b.name || '') + '" placeholder="Bucket name" style="flex:1">';
        html += '<span class="rm-config-remove" data-rm-bkt-remove="' + bi + '" title="Remove"><i class="fa-solid fa-trash"></i></span>';

        /* Initiative assignment */
        html += '<div style="width:100%;margin-top:6px">';
        html += '<select data-rm-bkt-add-init="' + bi + '" style="width:100%;font-size:12px">';
        html += '<option value="">Add initiative...</option>';
        allInitiatives.forEach(function (init) {
          html += '<option value="' + ESC(init.filename) + '">' + ESC(init.frontmatter.title || init.filename) + '</option>';
        });
        html += '</select>';
        if (Array.isArray(b.initiatives) && b.initiatives.length > 0) {
          html += '<div class="rm-initiative-chips">';
          b.initiatives.forEach(function (initFn, idx) {
            var initCard = allInitiatives.find(function (c) { return c.filename === initFn; });
            var label = initCard ? (initCard.frontmatter.title || initFn) : initFn;
            html += '<span class="rm-initiative-chip">' + ESC(label) + ' <span class="rm-chip-remove" data-rm-bkt-rm-init="' + bi + '" data-rm-init-idx="' + idx + '">&times;</span></span>';
          });
          html += '</div>';
        }
        html += '</div></div>';
      }
      html += '</div>';
      html += '<button class="rm-config-add" data-rm-bkt-add><i class="fa-solid fa-plus"></i> Add Bucket</button>';
      html += '</div>';

      /* Swim Lanes Tab */
      html += '<div class="rm-tab-content' + (this.activeTab === 'swim_lanes' ? ' rm-active' : '') + '" data-rm-tab-body="swim_lanes">';
      html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Select products to use as swim lanes in the Timeline view.</p>';
      html += '<div class="rm-swim-lane-list">';
      var lanes = this.tempConfig.swim_lanes || [];
      var availProducts = taxonomy.products;
      availProducts.forEach(function (prod) {
        var checked = lanes.indexOf(prod) !== -1;
        html += '<div class="rm-swim-lane-item">';
        html += '<label><input type="checkbox" data-rm-lane-check="' + ESC(prod) + '"' + (checked ? ' checked' : '') + '> ' + ESC(prod) + '</label>';
        html += '</div>';
      });
      if (availProducts.length === 0) {
        html += '<div style="color:var(--text-muted);font-size:12px;padding:12px">No products found in card data. Products are discovered from card frontmatter.</div>';
      }
      html += '</div></div>';

      bodyEl.innerHTML = html;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     View prefs — allowlist / coerce (default_view)
     ═══════════════════════════════════════════════════════════════ */
  var ALLOWED_VIEWS = ['card', 'timeline', 'table'];
  var TABLE_IMPLEMENTED = false; // until table PR
  function coerceView(v, tableImplemented) {
    if (ALLOWED_VIEWS.indexOf(v) === -1) return 'card';
    if (v === 'table' && !tableImplemented) return 'card'; // UI only; disk may keep 'table'
    return v;
  }

  /* ═══════════════════════════════════════════════════════════════
     Module State
     ═══════════════════════════════════════════════════════════════ */
  var store = new CardData.CardStore();
  var cardsHandle = null;
  var refreshInterval = null;
  var refreshRunning = false;
  var rmConfig = null;
  var taxonomy = { products: [], modules: [], clients: [] };
  var activeView = 'card';
  var granularity = 'quarterly';
  var currentYear = new Date().getFullYear();
  var keydownHandler = null;
  var prefsSaveTimer = null; // debounced roadmap.md write for toolbar prefs

  /* ═══════════════════════════════════════════════════════════════
     Controller
     ═══════════════════════════════════════════════════════════════ */
  var ctrl = {

    async init(rootHandle) {
      this.destroy();
      var view = $view();
      if (!view) return;

      cardsHandle = await ForgeUtils.FS.getSubDir(rootHandle, 'cards');
      if (!cardsHandle) {
        this._renderNotActive(view);
        return;
      }

      /* Load roadmap config */
      rmConfig = await RoadmapConfigManager.load(cardsHandle);
      CardData.roadmapConfig = rmConfig;
      /* Coerce UI view; leave rmConfig.default_view as loaded so disk 'table' survives until table PR */
      activeView = coerceView(rmConfig.default_view, TABLE_IMPLEMENTED);
      granularity = rmConfig.time_granularity || 'quarterly';
      currentYear = rmConfig.current_year || new Date().getFullYear();

      this._renderLayout(view, rootHandle);
      await this._loadCards();
      this._renderView();
      this._startAutoRefresh();
      this._bindKeyboard();
    },

    destroy: function () {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      OptimisticGuard.clearAll();
      if (prefsSaveTimer) { clearTimeout(prefsSaveTimer); prefsSaveTimer = null; }
      store.clear();
      cardsHandle = null;
      rmConfig = null;
    },

    /**
     * Debounced save of toolbar prefs (default_view, time_granularity,
     * current_year, show_stories) to roadmap.md. Silent on success; save()
     * toasts on failure. Paused while Settings modal is open.
     */
    schedulePrefsSave: function () {
      if (!rmConfig || !cardsHandle) return;
      var overlay = $q('.rm-modal-overlay');
      if (overlay && overlay.classList.contains('rm-visible')) return;

      if (prefsSaveTimer) clearTimeout(prefsSaveTimer);
      prefsSaveTimer = setTimeout(async function () {
        prefsSaveTimer = null;
        var openOverlay = $q('.rm-modal-overlay');
        if (openOverlay && openOverlay.classList.contains('rm-visible')) return;
        if (!rmConfig || !cardsHandle) return;

        rmConfig.default_view = activeView;
        rmConfig.time_granularity = granularity;
        rmConfig.current_year = currentYear;
        /* show_stories already mutated on rmConfig by the stories toggle */

        await RoadmapConfigManager.save(cardsHandle, rmConfig);
      }, 400);
    },

    refresh: async function () {
      if (!cardsHandle) return;
      await this._doRefresh();
    },

    /* ─── Internal ─── */

    _renderNotActive: function (view) {
      view.innerHTML =
        '<div class="rm-not-active">' +
          '<div class="rm-state-icon"><i class="fa-solid fa-road"></i></div>' +
          '<h2>Roadmap</h2>' +
          '<p>No <code>cards/</code> directory found in this project. The Roadmap view requires Product Forge cards to visualize.</p>' +
        '</div>';
    },

    _renderLayout: function (view, rootHandle) {
      // Handle both FileSystemDirectoryHandle (browser) and path string (Tauri)
      var dirName = '';
      if (rootHandle) {
        dirName = typeof rootHandle === 'string'
          ? rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle
          : rootHandle.name;
      }

      view.innerHTML =
        '<div class="rm-layout">' +
          /* Toolbar */
          '<div class="plugin-toolbar">' +
            '<span class="toolbar-title"><i class="fa-solid fa-road"></i> Roadmap</span>' +
            '<div class="folder-path"><span><i class="fa-solid fa-folder-open"></i></span><span>' + ESC(dirName) + '/cards</span></div>' +

            '<div class="rm-divider"></div>' +

            /* View toggle */
            '<div class="view-toggle">' +
              '<button data-rm-view="card" class="' + (activeView === 'card' ? 'active' : '') + '" title="Card View"><i class="fa-solid fa-grip"></i> Card</button>' +
              '<button data-rm-view="timeline" class="' + (activeView === 'timeline' ? 'active' : '') + '" title="Timeline View"><i class="fa-solid fa-chart-gantt"></i> Timeline</button>' +
            '</div>' +

            /* Granularity toggle */
            '<div class="view-toggle">' +
              '<button data-rm-gran="quarterly" class="' + (granularity === 'quarterly' ? 'active' : '') + '">Quarterly</button>' +
              '<button data-rm-gran="monthly" class="' + (granularity === 'monthly' ? 'active' : '') + '">Monthly</button>' +
            '</div>' +

            '<div class="spacer"></div>' +

            /* Year nav */
            '<div class="rm-year-nav">' +
              '<button class="btn-icon" data-rm-year-prev title="Previous year"><i class="fa-solid fa-chevron-left"></i></button>' +
              '<span data-rm-year-label>' + currentYear + '</span>' +
              '<button class="btn-icon" data-rm-year-next title="Next year"><i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>' +

            '<div class="rm-divider"></div>' +

            /* Stories toggle */
            '<button class="btn-icon' + (rmConfig && rmConfig.show_stories ? ' rm-active' : '') + '" data-rm-stories-toggle title="Toggle stories"><i class="fa-solid fa-list-ul"></i></button>' +

            /* Filter */
            '<div class="rm-filter-badge">' +
              '<button class="btn-icon" data-rm-filter-toggle title="Filter"><i class="fa-solid fa-filter"></i></button>' +
            '</div>' +

            /* Settings */
            '<button class="btn-icon" data-rm-settings title="Settings"><i class="fa-solid fa-gear"></i></button>' +

            '<span class="refresh-indicator" data-rm-refresh-ind></span>' +
            '<button class="btn-icon" data-rm-refresh title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +

          /* Content area */
          '<div class="rm-content">' +
            '<div class="rm-card-view" data-rm-card-container></div>' +
            '<div class="rm-timeline-view" data-rm-timeline-container style="display:none"></div>' +
            '<div class="rm-filter-panel" data-rm-filter-panel></div>' +
          '</div>' +

        '</div>' +

        /* Config modal */
        '<div class="rm-modal-overlay">' +
          '<div class="rm-modal-content">' +
            '<div class="rm-modal-header">' +
              '<h3>Roadmap Settings</h3>' +
              '<button class="rm-modal-close" data-rm-modal-close>&times;</button>' +
            '</div>' +
            '<div class="rm-modal-body"></div>' +
            '<div class="rm-modal-footer">' +
              '<button data-rm-modal-close>Cancel</button>' +
              '<button class="primary" data-rm-modal-save>Save</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      this._bindToolbar();
    },

    _bindToolbar: function () {
      var self = this;

      /* View toggle */
      $qa('[data-rm-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeView = coerceView(btn.dataset.rmView, TABLE_IMPLEMENTED);
          $qa('[data-rm-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.rmView === activeView); });
          self._renderView();
          self.schedulePrefsSave();
        });
      });

      /* Granularity toggle */
      $qa('[data-rm-gran]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          granularity = btn.dataset.rmGran;
          $qa('[data-rm-gran]').forEach(function (b) { b.classList.toggle('active', b.dataset.rmGran === granularity); });
          self._renderView();
          self.schedulePrefsSave();
        });
      });

      /* Year nav */
      var prevBtn = $q('[data-rm-year-prev]');
      var nextBtn = $q('[data-rm-year-next]');
      if (prevBtn) prevBtn.addEventListener('click', function () {
        currentYear--;
        self._updateYearLabel();
        self._renderView();
        self.schedulePrefsSave();
      });
      if (nextBtn) nextBtn.addEventListener('click', function () {
        currentYear++;
        self._updateYearLabel();
        self._renderView();
        self.schedulePrefsSave();
      });

      /* Stories toggle */
      var storiesBtn = $q('[data-rm-stories-toggle]');
      if (storiesBtn) {
        storiesBtn.addEventListener('click', function () {
          if (rmConfig) rmConfig.show_stories = !rmConfig.show_stories;
          storiesBtn.classList.toggle('rm-active', rmConfig && rmConfig.show_stories);
          self._renderView();
          self.schedulePrefsSave();
        });
      }

      /* Filter toggle */
      var filterBtn = $q('[data-rm-filter-toggle]');
      if (filterBtn) {
        filterBtn.addEventListener('click', function () {
          FilterPanel.open = !FilterPanel.open;
          var panel = $q('[data-rm-filter-panel]');
          if (panel) panel.classList.toggle('rm-open', FilterPanel.open);
          if (FilterPanel.open) self._renderFilterPanel();
        });
      }

      /* Settings */
      var settingsBtn = $q('[data-rm-settings]');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', function () {
          var allInits = store.getByType('initiative');
          ConfigModal.open(rmConfig, allInits, taxonomy);
          self._bindConfigModal();
        });
      }

      /* Refresh */
      var refreshBtn = $q('[data-rm-refresh]');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self.refresh(); });

      /* Modal close */
      $qa('[data-rm-modal-close]').forEach(function (el) {
        el.addEventListener('click', function () { ConfigModal.close(); });
      });

      /* Modal save */
      var saveBtn = $q('[data-rm-modal-save]');
      if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
          self._readConfigFromModal();
          var newConfig = ConfigModal.save();
          if (newConfig) {
            rmConfig = newConfig;
            CardData.roadmapConfig = rmConfig;
            await RoadmapConfigManager.save(cardsHandle, rmConfig);
            ForgeUtils.Toast.show('Roadmap settings saved', 'success');
          }
          ConfigModal.close();
          self._renderView();
        });
      }
    },

    _bindConfigModal: function () {
      var self = this;
      var bodyEl = $q('.rm-modal-body');
      if (!bodyEl) return;

      /* Tab switching */
      bodyEl.querySelectorAll('[data-rm-config-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          ConfigModal.activeTab = tab.dataset.rmConfigTab;
          bodyEl.querySelectorAll('.rm-tab').forEach(function (t) { t.classList.toggle('rm-active', t.dataset.rmConfigTab === ConfigModal.activeTab); });
          bodyEl.querySelectorAll('.rm-tab-content').forEach(function (tc) { tc.classList.toggle('rm-active', tc.dataset.rmTabBody === ConfigModal.activeTab); });
        });
      });

      /* Release add */
      var relAdd = bodyEl.querySelector('[data-rm-rel-add]');
      if (relAdd) {
        relAdd.addEventListener('click', function () {
          self._readConfigFromModal();
          ConfigModal.tempConfig.releases.push({ name: '', start_date: '', end_date: '' });
          self._refreshConfigModal();
        });
      }

      /* Release remove */
      bodyEl.querySelectorAll('[data-rm-rel-remove]').forEach(function (el) {
        el.addEventListener('click', function () {
          self._readConfigFromModal();
          var idx = parseInt(el.dataset.rmRelRemove);
          ConfigModal.tempConfig.releases.splice(idx, 1);
          self._refreshConfigModal();
        });
      });

      /* Bucket add */
      var bktAdd = bodyEl.querySelector('[data-rm-bkt-add]');
      if (bktAdd) {
        bktAdd.addEventListener('click', function () {
          self._readConfigFromModal();
          ConfigModal.tempConfig.buckets.push({ name: '', color: '#3b82f6', initiatives: [] });
          ConfigModal.activeTab = 'buckets';
          self._refreshConfigModal();
        });
      }

      /* Bucket remove */
      bodyEl.querySelectorAll('[data-rm-bkt-remove]').forEach(function (el) {
        el.addEventListener('click', function () {
          self._readConfigFromModal();
          var idx = parseInt(el.dataset.rmBktRemove);
          ConfigModal.tempConfig.buckets.splice(idx, 1);
          self._refreshConfigModal();
        });
      });

      /* Bucket add initiative */
      bodyEl.querySelectorAll('[data-rm-bkt-add-init]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (!sel.value) return;
          self._readConfigFromModal();
          var idx = parseInt(sel.dataset.rmBktAddInit);
          if (!Array.isArray(ConfigModal.tempConfig.buckets[idx].initiatives)) {
            ConfigModal.tempConfig.buckets[idx].initiatives = [];
          }
          if (ConfigModal.tempConfig.buckets[idx].initiatives.indexOf(sel.value) === -1) {
            ConfigModal.tempConfig.buckets[idx].initiatives.push(sel.value);
          }
          self._refreshConfigModal();
        });
      });

      /* Bucket remove initiative chip */
      bodyEl.querySelectorAll('[data-rm-bkt-rm-init]').forEach(function (el) {
        el.addEventListener('click', function () {
          self._readConfigFromModal();
          var bktIdx = parseInt(el.dataset.rmBktRmInit);
          var initIdx = parseInt(el.dataset.rmInitIdx);
          ConfigModal.tempConfig.buckets[bktIdx].initiatives.splice(initIdx, 1);
          self._refreshConfigModal();
        });
      });

      /* Swim lane checkboxes */
      bodyEl.querySelectorAll('[data-rm-lane-check]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          self._readConfigFromModal();
        });
      });
    },

    _readConfigFromModal: function () {
      if (!ConfigModal.tempConfig) return;
      var bodyEl = $q('.rm-modal-body');
      if (!bodyEl) return;

      /* Read releases */
      ConfigModal.tempConfig.releases.forEach(function (r, i) {
        var nameEl = bodyEl.querySelector('[data-rm-rel-name="' + i + '"]');
        var startEl = bodyEl.querySelector('[data-rm-rel-start="' + i + '"]');
        var endEl = bodyEl.querySelector('[data-rm-rel-end="' + i + '"]');
        if (nameEl) r.name = nameEl.value.trim();
        if (startEl) r.start_date = startEl.value;
        if (endEl) r.end_date = endEl.value;
      });

      /* Read buckets */
      ConfigModal.tempConfig.buckets.forEach(function (b, i) {
        var nameEl = bodyEl.querySelector('[data-rm-bkt-name="' + i + '"]');
        var colorEl = bodyEl.querySelector('[data-rm-bkt-color="' + i + '"]');
        if (nameEl) b.name = nameEl.value.trim();
        if (colorEl) b.color = colorEl.value;
      });

      /* Read swim lanes */
      var lanes = [];
      bodyEl.querySelectorAll('[data-rm-lane-check]').forEach(function (cb) {
        if (cb.checked) lanes.push(cb.dataset.rmLaneCheck);
      });
      ConfigModal.tempConfig.swim_lanes = lanes;
    },

    _refreshConfigModal: function () {
      var allInits = store.getByType('initiative');
      ConfigModal._renderContent(allInits, taxonomy);
      this._bindConfigModal();
    },

    _renderView: function () {
      var periods = granularity === 'monthly'
        ? TimeUtils.getMonths(currentYear)
        : TimeUtils.getQuarters(currentYear);

      var hierarchy = CardData.buildHierarchy(store);
      hierarchy = FilterPanel.filterHierarchy(hierarchy);

      var cardContainer = $q('[data-rm-card-container]');
      var timelineContainer = $q('[data-rm-timeline-container]');

      /* Explicit switch: only 'timeline' opens timeline; card/table/unknown → card UI */
      if (activeView === 'timeline') {
        if (timelineContainer) { timelineContainer.style.display = ''; TimelineView.render(timelineContainer, periods, hierarchy, rmConfig || {}, taxonomy); }
        if (cardContainer) cardContainer.style.display = 'none';
        this._bindTimelineEvents();
      } else {
        /* card (and table until TABLE_IMPLEMENTED falls back to card UI) */
        if (cardContainer) { cardContainer.style.display = ''; CardView.render(cardContainer, periods, hierarchy, rmConfig || {}); }
        if (timelineContainer) timelineContainer.style.display = 'none';
        this._bindCardViewEvents();
      }

      this._updateRefreshIndicator();
      this._updateFilterBadge();
    },

    _bindCardViewEvents: function () {
      var self = this;
      $qa('[data-rm-bucket-toggle]').forEach(function (el) {
        el.addEventListener('click', function () {
          var idx = el.dataset.rmBucketToggle;
          var body = $q('[data-rm-bucket-body="' + idx + '"]');
          var chevron = el.querySelector('.rm-chevron');
          if (body) body.classList.toggle('rm-collapsed');
          if (chevron) chevron.classList.toggle('rm-collapsed');
        });
      });
    },

    _bindTimelineEvents: function () {
      var self = this;
      /* Swim lane collapse */
      $qa('[data-rm-lane-toggle]').forEach(function (el) {
        el.addEventListener('click', function () {
          var lane = el.dataset.rmLaneToggle;
          var body = $q('[data-rm-lane-body="' + lane + '"]');
          var chevron = el.querySelector('.rm-chevron');
          if (TimelineView.collapsedLanes.has(lane)) {
            TimelineView.collapsedLanes.delete(lane);
          } else {
            TimelineView.collapsedLanes.add(lane);
          }
          if (body) body.classList.toggle('rm-collapsed');
          if (chevron) chevron.classList.toggle('rm-collapsed');
        });
      });

      /* Bar tooltips */
      var tooltip = null;
      $qa('.rm-bar').forEach(function (bar) {
        bar.addEventListener('mouseenter', function (e) {
          if (tooltip) tooltip.remove();
          tooltip = document.createElement('div');
          tooltip.className = 'rm-tooltip';
          tooltip.innerHTML = '<div class="rm-tooltip-title">' + ESC(bar.dataset.rmTooltipTitle || '') + '</div>' +
            '<div class="rm-tooltip-meta">' + ESC(bar.dataset.rmTooltipMeta || '') + '</div>';
          document.body.appendChild(tooltip);
          var rect = bar.getBoundingClientRect();
          tooltip.style.left = rect.left + 'px';
          tooltip.style.top = (rect.bottom + 6) + 'px';
        });
        bar.addEventListener('mouseleave', function () {
          if (tooltip) { tooltip.remove(); tooltip = null; }
        });
      });
    },

    _renderFilterPanel: function () {
      var panel = $q('[data-rm-filter-panel]');
      if (!panel) return;
      FilterPanel.render(panel, taxonomy, rmConfig || {});
      this._bindFilterEvents();
    },

    _bindFilterEvents: function () {
      var self = this;

      /* Filter selects */
      $qa('[data-rm-filter-select]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (!sel.value) return;
          var key = sel.dataset.rmFilterSelect;
          if (FilterPanel.filters[key].indexOf(sel.value) === -1) {
            FilterPanel.filters[key].push(sel.value);
          }
          sel.value = '';
          self._renderFilterPanel();
          self._renderView();
        });
      });

      /* Remove filter chips */
      $qa('[data-rm-filter-remove]').forEach(function (el) {
        el.addEventListener('click', function () {
          var key = el.dataset.rmFilterRemove;
          var val = el.dataset.rmFilterValue;
          FilterPanel.filters[key] = FilterPanel.filters[key].filter(function (v) { return v !== val; });
          self._renderFilterPanel();
          self._renderView();
        });
      });

      /* Clear all */
      var clearBtn = $q('[data-rm-filter-clear]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          FilterPanel.clearAll();
          self._renderFilterPanel();
          self._renderView();
        });
      }

      /* Close button */
      var closeBtn = $q('.rm-filter-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          FilterPanel.open = false;
          var panel = $q('[data-rm-filter-panel]');
          if (panel) panel.classList.remove('rm-open');
        });
      }
    },

    _updateYearLabel: function () {
      var el = $q('[data-rm-year-label]');
      if (el) el.textContent = currentYear;
    },

    _updateRefreshIndicator: function () {
      var el = $q('[data-rm-refresh-ind]');
      if (!el) return;
      var count = store.cards.size;
      var now = new Date();
      var time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.textContent = count + ' cards \u00B7 ' + time;
    },

    _updateFilterBadge: function () {
      var count = FilterPanel.getActiveCount();
      var badge = $q('.rm-filter-badge');
      if (!badge) return;
      var existing = badge.querySelector('.rm-filter-count');
      if (existing) existing.remove();
      if (count > 0) {
        var span = document.createElement('span');
        span.className = 'rm-filter-count';
        span.textContent = count;
        badge.appendChild(span);
      }
    },

    // Uses the shared CardData.scanCardsDir() helper for consistency with
    // product-forge — both views scan the same cards/ directory directly.
    async _loadCards() {
      store.clear();
      var files = await CardData.scanCardsDir(cardsHandle);
      for (var entry of files) {
        var filename = entry[0];
        var fileData = entry[1];
        var card = CardData.CardParser.parse(filename, fileData.content, fileData.dirName);
        store.set(filename, card, fileData.lastModified, fileData.handle);
      }
      taxonomy = CardData.discoverTaxonomy(store.all());
    },

    _startAutoRefresh: function () {
      this._stopAutoRefresh();
      refreshInterval = setInterval(function () { ctrl._doRefresh(); }, 5000);
    },

    _stopAutoRefresh: function () {
      if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
    },

    async _doRefresh() {
      if (refreshRunning || !cardsHandle) return;
      refreshRunning = true;
      try {
        /* Reload config — if prefs save pending, keep local prefs keys (live toolbar
           state / show_stories), still apply releases/buckets/swim_lanes from disk */
        var newConfig = await RoadmapConfigManager.load(cardsHandle);
        if (prefsSaveTimer && rmConfig) {
          newConfig.default_view = activeView;
          newConfig.time_granularity = granularity;
          newConfig.current_year = currentYear;
          newConfig.show_stories = rmConfig.show_stories;
        }
        var configChanged = JSON.stringify(newConfig) !== JSON.stringify(rmConfig);
        if (configChanged) {
          rmConfig = newConfig;
          CardData.roadmapConfig = rmConfig;
        }

        var files = await CardData.scanCardsDir(cardsHandle);
        var changes = { added: [], modified: [], deleted: [] };
        var now = Date.now();
        var guardFn = typeof RH.guardDecision === 'function' ? RH.guardDecision : null;

        for (var entry of files) {
          var filename = entry[0];
          var fileData = entry[1];
          var pending = OptimisticGuard.get(filename);
          var decision = guardFn
            ? guardFn(pending, fileData.content, now, OPTIMISTIC_TTL_MS)
            : 'apply';

          if (decision === 'skip') {
            // Keep in-memory optimistic card; do not store.set from disk
            continue;
          }

          if (decision === 'apply-and-clear' || decision === 'force-apply-ttl') {
            OptimisticGuard.clear(filename);
            if (decision === 'force-apply-ttl') {
              console.warn(
                'OptimisticGuard TTL expired for "' + filename + '"; applying disk content'
              );
            }
          }

          var oldTs = store.timestamps.get(filename);
          if (oldTs === undefined) {
            changes.added.push(filename);
          } else if (fileData.lastModified !== oldTs) {
            changes.modified.push(filename);
          }
          var card = CardData.CardParser.parse(filename, fileData.content, fileData.dirName);
          store.set(filename, card, fileData.lastModified, fileData.handle);
        }

        for (var fn of store.cards.keys()) {
          if (!files.has(fn)) {
            changes.deleted.push(fn);
            store.delete(fn);
            OptimisticGuard.clear(fn);
          }
        }

        var hasChanges = changes.added.length + changes.modified.length + changes.deleted.length > 0;
        if (hasChanges || configChanged) {
          taxonomy = CardData.discoverTaxonomy(store.all());
          this._renderView();
        }
        this._updateRefreshIndicator();
      } catch (e) {
        console.warn('Roadmap refresh error:', e);
      } finally {
        refreshRunning = false;
      }
    },

    _bindKeyboard: function () {
      this._unbindKeyboard();
      keydownHandler = function (e) {
        if (e.key === 'Escape') {
          var overlay = $q('.rm-modal-overlay');
          if (overlay && overlay.classList.contains('rm-visible')) {
            ConfigModal.close();
            return;
          }
          if (FilterPanel.open) {
            FilterPanel.open = false;
            var panel = $q('[data-rm-filter-panel]');
            if (panel) panel.classList.remove('rm-open');
            return;
          }
        }
      };
      document.addEventListener('keydown', keydownHandler);
    },

    _unbindKeyboard: function () {
      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Expose & Register
     ═══════════════════════════════════════════════════════════════ */
  window.RoadmapView = ctrl;
  Shell.registerController('roadmap', window.RoadmapView);

})();
