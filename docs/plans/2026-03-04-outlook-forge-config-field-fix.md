# Outlook-Forge Config Field Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix `renderConfigBar()` in outlook-forge.js to read `configData.channels` instead of `configData.sources`, so the config bar displays the correct source count after initialization.

**Architecture:** One-line change in the view controller. The backend already writes `channels`; the frontend just needs to read the correct key.

**Tech Stack:** JavaScript (forge-shell view controller)

**Design doc:** `docs/plans/2026-03-04-outlook-forge-config-field-fix-design.md`

---

### Task 1: Fix configData.sources → configData.channels

**Files:**
- Modify: `forge-shell/app/js/outlook-forge.js:709`

**Step 1: Apply the fix**

Change line 709 from:
```javascript
    const sources      = configData.sources;
```
to:
```javascript
    const sources      = configData.channels;
```

Only the property access changes. The variable name `sources` stays the same — it's used throughout the rest of `renderConfigBar()` and is semantically correct for outlook-forge's UI context.

**Step 2: Verify no other references to configData.sources exist**

Run: `grep -n 'configData\.sources' forge-shell/app/js/outlook-forge.js`
Expected: No matches

**Step 3: Run full forge-lib test suite for regression check**

Run: `cd forge-lib && python3 -m pytest -v`
Expected: All 355 tests pass (no JS tests exist for forge-shell, but Python tests confirm no backend regression)

**Step 4: Commit**

```bash
git add forge-shell/app/js/outlook-forge.js
git commit -m "fix(outlook-forge): read configData.channels instead of configData.sources

renderConfigBar() was reading configData.sources but harvest_ops writes
config with key 'channels' via --set-channels. This caused the config bar
to always display '0 sources monitored' after initialization."
```

**Step 5: Push**

```bash
git push origin memory
```
