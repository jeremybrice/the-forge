# Slack-Forge: Fix Transcript Naming to Prevent Overwrites

## Problem

When `/slack-forge:scan` is run twice on the same day with the same timeframe, the second run silently overwrites the first run's transcript files. There is no collision detection or sequencing logic.

The current naming convention is `{scan-date}-{timeframe}-{type}.md`, which is purely deterministic based on date and timeframe. If you scan `24h` twice on `2026-02-20`, both writes target the identical path:

```
slack-forge/transcripts/2026-02-20-24h-public-channels.md
```

Line 185 of `scan.md` claims "Re-running scan is safe and creates a new time-window snapshot," but this is false. It overwrites the previous snapshot.

**Example existing transcripts showing the pattern:**
```
slack-forge/transcripts/2026-02-18-72h-public-channels.md
slack-forge/transcripts/2026-02-19-24h-public-channels.md
slack-forge/transcripts/2026-02-20-12h-public-channels.md
```

Transcript writing is entirely LLM-driven prose instructions in `scan.md`. There is no `forge transcript write` CLI command, no forge-lib file that constructs this filename, and no collision-detection logic anywhere. The fix is purely in the command markdown files.

---

## Files to Modify

| File (repo-relative) | Purpose |
|---|---|
| `slack-forge/commands/scan.md` | Primary change: filename pattern, frontmatter contract, collision avoidance instructions |
| `slack-forge/commands/capture.md` | Downstream consumer: update "most recent scan" resolution to handle numbered transcripts |

No `forge-lib` Python changes are needed. The only Python code with sequential `-NNN` naming is `harvest_ops.py` (harvest records), which serves as the reference pattern.

---

## Naming Pattern to Adopt

Adopt a three-digit `-NNN` suffix, mirroring `harvest_ops.py:_generate_harvest_filename()`.

**Reference algorithm from `forge-lib/core/harvest_ops.py` (lines 108-127):**

```python
type_segment = HARVEST_TYPE_FILENAME_MAP[harvest_type]
today_str = date.today().strftime("%Y-%m-%d")

escaped_segment = re.escape(type_segment)
pattern = re.compile(
    r'^\d{4}-\d{2}-\d{2}-' + escaped_segment + r'-(\d{3})\.md$'
)

max_num = 0
if directory.exists():
    for filename in directory.iterdir():
        match = pattern.match(filename.name)
        if match:
            num = int(match.group(1))
            max_num = max(max_num, num)

next_num = max_num + 1
return f"{today_str}-{type_segment}-{next_num:03d}.md"
```

The scan agent should use an analogous approach: scan `slack-forge/transcripts/` for files matching `{scan-date}-{timeframe}-{type}-*.md`, find the highest three-digit number, and increment.

**Resulting filename examples:**
```
2026-02-20-24h-public-channels-001.md   (first run)
2026-02-20-24h-public-channels-002.md   (second run same day)
2026-02-20-24h-dms-001.md
2026-02-20-24h-jira-bot-001.md
```

---

## Changes to `slack-forge/commands/scan.md`

### Change 1: Section 5 filename pattern (around lines 92-95)

**Before:**
```
Expected transcript outputs (as available):
- `slack-forge/transcripts/{scan-date}-{timeframe}-public-channels.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-dms.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-jira-bot.md`
```

**After:**
```
Expected transcript outputs (as available):
- `slack-forge/transcripts/{scan-date}-{timeframe}-public-channels-{NNN}.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-dms-{NNN}.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-jira-bot-{NNN}.md`

Where `{NNN}` is a zero-padded three-digit sequence number (001, 002, ...).

**Collision avoidance:** Before writing, list existing files in `slack-forge/transcripts/` matching `{scan-date}-{timeframe}-{type}-*.md`. Parse the three-digit suffix from each match, find the maximum, and use max + 1. If no matches exist, start at 001.
```

### Change 2: YAML frontmatter contract (Section 5)

**Before:**
```yaml
---
scan_date: 2026-02-17
timeframe: 72h
generated: 2026-02-17T14:30:00Z
---
```

**After:**
```yaml
---
scan_date: 2026-02-17
timeframe: 72h
scan_run: 1
generated: 2026-02-17T14:30:00Z
---
```

The `scan_run` field is an integer matching the NNN in the filename (e.g., `scan_run: 1` for `-001`, `scan_run: 2` for `-002`). This allows downstream consumers to identify which run a transcript belongs to without parsing the filename.

### Change 3: JIRA output path (around line 148)

Update the JIRA transcript output path to also include the `-{NNN}` suffix, consistent with the other transcript types.

### Change 4: Notes section (line 185)

**Before:**
```
- Re-running scan is safe and creates a new time-window snapshot.
```

**After:**
```
- Re-running scan is safe; each run creates a new numbered snapshot (e.g., -001, -002) rather than overwriting.
```

---

## Changes to `slack-forge/commands/capture.md`

### Change 1: Section 2 "most recent scan" resolution (around line 39)

**Before:**
```
Resolve "most recent scan" by selecting transcript files with the most recent date prefix
in their filename (`slack-forge/transcripts/YYYY-MM-DD-*`). If multiple dates are present,
use the latest date only.
```

**After:**
```
Resolve "most recent scan" by selecting transcript files with the most recent date prefix
and highest scan run number in their filename
(`slack-forge/transcripts/YYYY-MM-DD-{timeframe}-{type}-NNN.md`). If multiple dates are
present, use the latest date. If multiple run numbers exist for the same date and timeframe,
select only the highest NNN.
```

---

## Testing Instructions

After applying changes, validate the following:

1. **First scan creates -001 files.** Run a scan and confirm all transcript filenames end with `-001.md`.
2. **Second scan creates -002 files.** Run the same scan (same timeframe, same day) and confirm `-002.md` files are created alongside the `-001.md` files with no overwriting.
3. **Capture picks the latest run.** Run `/slack-forge:capture` and verify "most recent scan" selects the highest-numbered run (e.g., `-002` transcripts, not `-001`).
4. **Frontmatter includes scan_run.** Open a generated transcript and confirm the YAML frontmatter contains `scan_run:` with the correct integer value.
5. **Backward compatibility.** Confirm any pre-existing unsuffixed transcript files are not affected or deleted.
