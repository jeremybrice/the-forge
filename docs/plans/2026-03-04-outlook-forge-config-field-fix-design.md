# Outlook-Forge Config Field Fix — Design

**Date:** 2026-03-04
**Status:** Approved

## Problem

`outlook-forge.js` `renderConfigBar()` reads `configData.sources` (line 709) but the backend `harvest_ops.set_config()` writes config with key `channels`. The `init.md` command uses `forge harvest config --set-channels`, so `config.json` always contains a `channels` key. Result: `configData.sources` is always `undefined`, and the config bar displays "0 sources monitored" even when properly initialized.

## Root Cause

When `outlook-forge.js` was created, the view controller used `sources` as the semantic field name for Outlook data sources. However, the backend reuses `harvest_ops.set_config()` from slack-forge, which stores the array under the `channels` key.

## Fix

Change `configData.sources` to `configData.channels` in `outlook-forge.js` line 709. One-line change. The rest of the function (`.filter(s => s.monitor)` counting) works correctly because `init.md` stores source objects with a `monitor` boolean in the `channels` array.

## Files Changed

| File | Change |
|------|--------|
| `forge-shell/app/js/outlook-forge.js` | `configData.sources` → `configData.channels` on line 709 |

## Verification

Visual: after `init`, the config bar should display the correct source count instead of "0 sources monitored".
