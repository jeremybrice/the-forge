---
description: Initialize the local cards directory structure for Product Forge.
---

# /init Command

Initialize the local `cards/` directory structure at the project root. This is a prerequisite for all Product Forge commands. The command is idempotent and safe to run multiple times.

## Execution

When invoked, this command:

1. **Creates the cards directory structure** by creating all 7 required subdirectories under `cards/`:
   - cards/initiatives/
   - cards/epics/
   - cards/stories/
   - cards/intakes/
   - cards/checkpoints/
   - cards/decisions/
   - cards/release-notes/

2. **Creates index.json files** in each subdirectory using forge-lib (for fast querying)

3. **Reports results** to the user:
   - If directories were created: Lists all created directories
   - If all directories already exist: Confirms initialization is complete
   - If some directories already existed: Lists newly created vs. existing

## Implementation

Initialize using forge-lib CLI:

```bash
forge card init --directory .
```

Parse the JSON response:

```json
{
  "success": true,
  "data": {
    "directories_created": [
      "cards/initiatives",
      "cards/epics",
      "cards/stories",
      "cards/intakes",
      "cards/checkpoints",
      "cards/decisions",
      "cards/release-notes"
    ],
    "index_files_created": 7
  }
}
```

### Error Handling

If forge-lib returns an error:
```json
{
  "success": false,
  "data": null,
  "error": "Permission denied: cannot create directory cards/"
}
```

Report the error to the user:
```
Error initializing cards directory: {error message from JSON response}

Check that the working directory is writable and you're running from the project root.
```

## Key Rules

- **Directories only:** This command creates directory structure and empty index.json files. It does not create sample cards.
- **Idempotent:** Running `/init` multiple times has no side effects. It only creates directories that don't already exist.
- **No prompts:** This command does not require user confirmation. It runs immediately.
- **Index files:** forge-lib creates properly structured index.json files in each directory for fast querying.

## Error Handling

- If the working directory is not writable, report the error and suggest checking permissions.
- If the working directory appears to be inside a plugin folder rather than a project root, warn the user and suggest running from the project root instead.

## Success Message

After successful initialization, display:

```
Cards directory initialized. Ready for card creation.

Use /product-forge:create to generate cards (auto-detects type) or specify with --type.
```
