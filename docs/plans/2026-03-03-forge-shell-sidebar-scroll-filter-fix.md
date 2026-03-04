# Forge Shell: Sidebar Scroll + Filter Toggle Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two forge-shell bugs: sidebar lists that can't scroll when content overflows, and the SlackForge filter toggle button that intermittently fails after page navigation.

**Architecture:** CSS fix (`min-height: 0`) on grid-item sidebars to enable overflow scrolling, plus JS lifecycle fix (remove `initialized = false` from SlackForge's `destroy()`) to prevent duplicate event listeners.

**Tech Stack:** CSS, vanilla JavaScript (forge-shell Tauri desktop app)

---

## Bug Analysis

### Bug 1: Sidebar lists don't scroll

**Root cause:** CSS Grid items default to `min-height: auto`, which prevents them from shrinking below their content size. The sidebar is a grid item in a `1fr` row. When the list content exceeds the available space, the grid item expands to fit rather than constraining itself, so `overflow-y: auto` on the inner list never triggers.

**Fix:** Add `min-height: 0` to each sidebar grid item, overriding the default. This forces the sidebar to accept the grid row's allocated height, allowing internal flex children with `overflow-y: auto` to scroll.

**Affected sidebars (all use identical grid-item + flex-column + overflow pattern):**
- `.sf-sidebar` — `forge-shell/app/css/slack-forge.css:18`
- `.cf-sidebar` — `forge-shell/app/css/cognitive-forge.css:17`
- `.rf-sidebar` — `forge-shell/app/css/report-forge.css:28`
- `.raf-sidebar` — `forge-shell/app/css/rovo-agent-forge.css:31`

**Not affected:**
- `.pfl-sidebar` (product-forge) — uses `overflow-y: auto` directly on the sidebar element, not a flex child. Already scrolls correctly.
- tasks, memory, roadmap, productivity — no sidebar lists.

### Bug 2: SlackForge filter toggle intermittently fails

**Root cause:** `slack-forge.js` `destroy()` (line 802) sets `initialized = false`. When `init()` runs again after navigation, it re-calls `scaffold()` and `bindEvents()`, adding **duplicate** delegated `click`/`input` listeners to the same `#view-slack-forge` DOM element. The `toggle-filter` handler flips `filterPanelOpen` once per listener — with an even number of listeners, the toggles cancel out.

**Evidence:** `cognitive-forge.js` `destroy()` (line 493) does NOT reset `initialized`. Its toolbar events work consistently across navigation.

**Fix:** Remove `initialized = false` from SlackForge's `destroy()`. Data state clearing stays; scaffold/event binding persists.

---

### Task 1: Add `min-height: 0` to sidebar grid items

**Files:**
- Modify: `forge-shell/app/css/slack-forge.css:18-26`
- Modify: `forge-shell/app/css/cognitive-forge.css:17-25`
- Modify: `forge-shell/app/css/report-forge.css:28-36`
- Modify: `forge-shell/app/css/rovo-agent-forge.css:31-39`

**Step 1: Add `min-height: 0` to `.sf-sidebar`**

In `forge-shell/app/css/slack-forge.css`, add `min-height: 0;` to the `.sf-sidebar` rule:

```css
.sf-sidebar {
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
```

**Step 2: Add `min-height: 0` to `.cf-sidebar`**

In `forge-shell/app/css/cognitive-forge.css`, add `min-height: 0;` to the `.cf-sidebar` rule:

```css
.cf-sidebar {
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
```

**Step 3: Add `min-height: 0` to `.rf-sidebar`**

In `forge-shell/app/css/report-forge.css`, add `min-height: 0;` to the `.rf-sidebar` rule:

```css
.rf-sidebar {
  grid-column: 1;
  grid-row: 2;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}
```

**Step 4: Add `min-height: 0` to `.raf-sidebar`**

In `forge-shell/app/css/rovo-agent-forge.css`, add `min-height: 0;` to the `.raf-sidebar` rule:

```css
.raf-sidebar {
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
```

**Step 5: Commit**

```bash
git add forge-shell/app/css/slack-forge.css forge-shell/app/css/cognitive-forge.css forge-shell/app/css/report-forge.css forge-shell/app/css/rovo-agent-forge.css
git commit -m "fix(forge-shell): add min-height:0 to sidebar grid items for scroll overflow

Grid items default to min-height:auto, preventing overflow-y:auto from
triggering on inner list containers. Adding min-height:0 forces sidebars
to respect the grid row allocation, enabling scrollable file lists."
```

---

### Task 2: Fix SlackForge filter toggle duplicate listener bug

**Files:**
- Modify: `forge-shell/app/js/slack-forge.js:790-803`

**Step 1: Remove `initialized = false` from `destroy()`**

In `forge-shell/app/js/slack-forge.js`, change the `destroy()` method to clear only data state, not the initialization flag:

```javascript
    destroy() {
      harvests = [];
      transcripts = [];
      selectedHarvest = null;
      selectedTranscript = null;
      configData = null;
      filterType = 'all';
      filterStatus = 'all';
      activeView = 'harvests';
      filterPanelOpen = false;
      searchQuery = '';
      slackForgeActive = false;
    },
```

The line `initialized = false;` (previously line 802) is removed. This matches the pattern used by `cognitive-forge.js`, `report-forge.js`, and all other view controllers — scaffold and event bindings persist across navigation, only data state is cleared.

**Step 2: Commit**

```bash
git add forge-shell/app/js/slack-forge.js
git commit -m "fix(forge-shell): prevent duplicate event listeners on SlackForge filter toggle

destroy() was resetting initialized=false, causing scaffold() and
bindEvents() to re-run on each navigation back to SlackForge. This
added duplicate delegated click listeners, making the filter toggle
fire multiple times per click (canceling itself on even visits).

Matches the lifecycle pattern of cognitive-forge and other controllers
where destroy() only clears data state, not the initialization flag."
```

---

## Verification

After both tasks, manually test in `npm run tauri dev`:

1. **Scroll test:** Navigate to SlackForge with many harvests. Verify the left pane scrolls. Repeat for Cognitive Forge, Report Forge, and Rovo Agent Forge.
2. **Filter toggle test:** On SlackForge, click the filter (sliders) button — panel should open. Navigate to Roadmap, click its filter, navigate back to SlackForge, click filter again — should still work. Repeat several roundtrips.
3. **State reset test:** Open SlackForge filter panel, navigate away, navigate back. Filter panel should be closed (state reset in `init()`).
