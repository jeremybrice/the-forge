/* ═══════════════════════════════════════════════════════════════
   CardData — Shared card data layer used by Product Forge and Roadmap
   ═══════════════════════════════════════════════════════════════ */

window.CardData = (function () {
  'use strict';

  /* ─── Field Orders (for YAML serialization) ─── */
  const FIELD_ORDER = {
    initiative: ['title','type','status','release','product','module','client','team','confidence','estimate_hours','jira_card','source_intake','children','description','source_conversation','created','updated'],
    epic: ['title','type','status','release','product','module','client','team','parent','children','description','source_intake','source_conversation','created','updated'],
    story: ['title','type','status','product','module','client','team','parent','story_points','jira_card','source_conversation','created','updated'],
    intake: ['title','type','status','product','module','client','generated_initiatives','generated_epics','source_conversation','created','updated'],
    checkpoint: ['title','type','checkpoint_date','product','module','client','domain','status','source_conversation','created','updated'],
    decision: ['title','type','decision_date','product','module','client','decision_type','status','stakeholders','source_conversation','created','updated'],
    'release-note': ['title','type','release_date','product','status','version','related_stories','source_conversation','created','updated']
  };

  const STATUS_OPTIONS = {
    initiative: ['Draft','Submitted','Approved','Superseded'],
    epic: ['Planning','In Progress','Complete','Cancelled'],
    story: ['Draft','Ready','In Progress','Done'],
    intake: ['Draft','Complete','Handed Off'],
    checkpoint: ['Current','Superseded','Archived'],
    decision: ['Active','Revised','Reversed'],
    'release-note': ['Draft','Published','Internal Only']
  };

  const CONFIDENCE_OPTIONS = ['High','Medium','Low'];
  const DOMAIN_OPTIONS = ['Integration','Operations','Configuration','Reporting','Mobile','Feature Scope','Architecture','Requirements','Technical Spec','Stakeholder Context'];
  const DECISION_TYPE_OPTIONS = ['Architecture','Scope','Priority','Technical','Stakeholder Commitment'];

  const EXPECTED_DIRS = ['initiatives','epics','stories','intakes','checkpoints','decisions','release-notes'];
  const DIR_TYPE_MAP = {
    'initiatives': 'initiative', 'epics': 'epic', 'stories': 'story',
    'intakes': 'intake', 'checkpoints': 'checkpoint',
    'decisions': 'decision', 'release-notes': 'release-note'
  };

  /* ─── Color helpers ─── */
  function getStatusColor(status) {
    if (!status) return 'var(--text-muted)';
    const map = {
      'draft': 'var(--status-draft)', 'submitted': 'var(--status-blue)',
      'approved': 'var(--status-green)', 'planning': 'var(--status-blue)',
      'in progress': 'var(--status-blue)', 'ready': 'var(--status-teal)',
      'complete': 'var(--status-green)', 'done': 'var(--status-green)',
      'current': 'var(--status-green)', 'active': 'var(--status-green)',
      'cancelled': 'var(--status-gray)', 'superseded': 'var(--status-gray)',
      'archived': 'var(--status-gray)', 'reversed': 'var(--status-gray)',
      'revised': 'var(--status-gray)', 'published': 'var(--status-green)',
      'internal only': 'var(--status-yellow)', 'handed off': 'var(--status-green)',
    };
    return map[status.toLowerCase()] || 'var(--text-muted)';
  }

  function getTypeColor(type) {
    const map = {
      'initiative': 'var(--type-initiative)', 'epic': 'var(--type-epic)',
      'story': 'var(--type-story)', 'intake': 'var(--type-intake)',
      'checkpoint': 'var(--type-checkpoint)', 'decision': 'var(--type-decision)',
      'release-note': 'var(--type-release-note)'
    };
    return map[type] || 'var(--text-muted)';
  }

  /* ═══════════════════════════════════════════════════════════════
     CardStore
     ═══════════════════════════════════════════════════════════════ */
  class CardStore {
    constructor() {
      this.cards = new Map();
      this.timestamps = new Map();
      this.fileHandles = new Map();
    }
    clear() { this.cards.clear(); this.timestamps.clear(); this.fileHandles.clear(); }
    set(filename, card, timestamp, handle) {
      this.cards.set(filename, card);
      this.timestamps.set(filename, timestamp);
      if (handle) this.fileHandles.set(filename, handle);
    }
    get(filename) { return this.cards.get(filename) || null; }
    delete(filename) { this.cards.delete(filename); this.timestamps.delete(filename); this.fileHandles.delete(filename); }
    getByType(type) { return [...this.cards.values()].filter(c => c.frontmatter.type === type); }
    getChildren(parentFilename) { return [...this.cards.values()].filter(c => c.frontmatter.parent === parentFilename); }
    all() { return [...this.cards.values()]; }
  }

  /* ═══════════════════════════════════════════════════════════════
     CardParser
     ═══════════════════════════════════════════════════════════════ */
  const CardParser = {
    parse(filename, content, dirName) {
      const card = { filename, dirName, raw: content, error: null, frontmatter: {}, body: '' };
      const parsed = ForgeUtils.parseFrontmatter(content);
      if (!parsed) {
        card.error = 'No valid frontmatter found';
        card.body = content;
        return card;
      }
      card.frontmatter = parsed.frontmatter;
      card.body = parsed.body;
      if (!card.frontmatter.type) {
        card.frontmatter.type = DIR_TYPE_MAP[dirName] || 'unknown';
      }
      return card;
    },

    serialize(frontmatter, body) {
      const type = frontmatter.type || 'unknown';
      const order = FIELD_ORDER[type] || null;
      const yaml = ForgeUtils.YAML.stringify(frontmatter, order);
      return '---\n' + yaml + '\n---\n\n' + body + '\n';
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Hierarchy Builder
     ═══════════════════════════════════════════════════════════════ */
  function buildHierarchy(store) {
    const initiatives = store.getByType('initiative');
    const epics = store.getByType('epic');
    const stories = store.getByType('story');
    const placedEpics = new Set();
    const placedStories = new Set();

    const tree = initiatives.map(init => {
      const childEpics = epics.filter(e =>
        e.frontmatter.parent === init.filename ||
        (Array.isArray(init.frontmatter.children) && init.frontmatter.children.includes(e.filename))
      );
      childEpics.forEach(e => placedEpics.add(e.filename));

      const epicNodes = childEpics.map(epic => {
        const childStories = stories.filter(s =>
          s.frontmatter.parent === epic.filename ||
          (Array.isArray(epic.frontmatter.children) && epic.frontmatter.children.includes(s.filename))
        );
        childStories.forEach(s => placedStories.add(s.filename));
        return { card: epic, children: childStories };
      });
      return { card: init, children: epicNodes };
    });

    const rawOrphanEpics = epics.filter(e => !placedEpics.has(e.filename));
    const orphanEpicNodes = rawOrphanEpics.map(epic => {
      const childStories = stories.filter(s =>
        s.frontmatter.parent === epic.filename ||
        (Array.isArray(epic.frontmatter.children) && epic.frontmatter.children.includes(s.filename))
      );
      childStories.forEach(s => placedStories.add(s.filename));
      return { card: epic, children: childStories };
    });
    const orphanStories = stories.filter(s => !placedStories.has(s.filename));

    return {
      tree,
      orphanEpics: orphanEpicNodes,
      orphanStories,
      intakes: store.getByType('intake'),
      checkpoints: store.getByType('checkpoint'),
      decisions: store.getByType('decision'),
      releaseNotes: store.getByType('release-note')
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     File Scanner — scans cards/ subdirs
     Uses ForgeFS abstraction for dual-mode (browser/Tauri) support
     ═══════════════════════════════════════════════════════════════ */
  async function scanCardsDir(cardsHandle) {
    const files = new Map();
    if (!cardsHandle) return files;

    try {
      // List directories in cards/ folder
      const entries = await ForgeFS.readDir(cardsHandle, '');

      for (const entry of entries) {
        if (entry.kind !== 'directory') continue;
        if (!EXPECTED_DIRS.includes(entry.name)) continue;

        try {
          // List .md files in this subdirectory
          const subEntries = await ForgeFS.readDir(cardsHandle, entry.name);

          for (const fileEntry of subEntries) {
            if (fileEntry.kind !== 'file' || !fileEntry.name.endsWith('.md')) continue;

            const filename = fileEntry.name.replace(/\.md$/, '');
            try {
              // Read file content using ForgeFS
              const content = await ForgeFS.readFile(cardsHandle, `${entry.name}/${fileEntry.name}`);
              const meta = await ForgeFS.getFileMeta(cardsHandle, `${entry.name}/${fileEntry.name}`);

              files.set(filename, {
                handle: typeof cardsHandle === 'string'
                  ? `${cardsHandle}/${entry.name}/${fileEntry.name}`
                  : fileEntry,
                dirName: entry.name,
                fileName: fileEntry.name,
                lastModified: meta.modified,
                content: content
              });
            } catch (e) {
              console.warn('Failed to read ' + fileEntry.name + ':', e);
            }
          }
        } catch (e) {
          console.warn('Failed to scan ' + entry.name + ':', e);
        }
      }
    } catch (e) {
      console.error('Failed to scan cards directory:', e);
    }

    return files;
  }

  /* ═══════════════════════════════════════════════════════════════
     Taxonomy Discovery
     ═══════════════════════════════════════════════════════════════ */
  function discoverTaxonomy(cards) {
    const products = new Set();
    const modules = new Set();
    const clients = new Set();
    cards.forEach(c => {
      if (c.frontmatter) {
        if (c.frontmatter.product) products.add(c.frontmatter.product);
        if (c.frontmatter.module) modules.add(c.frontmatter.module);
        if (c.frontmatter.client) clients.add(c.frontmatter.client);
      }
    });
    return { products: [...products].sort(), modules: [...modules].sort(), clients: [...clients].sort() };
  }

  /* ═══════════════════════════════════════════════════════════════
     Shared roadmap config reference
     ═══════════════════════════════════════════════════════════════ */
  let roadmapConfig = null;

  /* ═══════════════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════════════ */
  return {
    FIELD_ORDER,
    STATUS_OPTIONS,
    CONFIDENCE_OPTIONS,
    DOMAIN_OPTIONS,
    DECISION_TYPE_OPTIONS,
    EXPECTED_DIRS,
    DIR_TYPE_MAP,
    CardStore,
    CardParser,
    getStatusColor,
    getTypeColor,
    buildHierarchy,
    scanCardsDir,
    discoverTaxonomy,
    get roadmapConfig() { return roadmapConfig; },
    set roadmapConfig(v) { roadmapConfig = v; }
  };
})();
