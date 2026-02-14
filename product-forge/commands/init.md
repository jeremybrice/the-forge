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

```bash
# Create cards directory if it doesn't exist
mkdir -p cards

# Create all 7 subdirectories
mkdir -p cards/initiatives
mkdir -p cards/epics
mkdir -p cards/stories
mkdir -p cards/intakes
mkdir -p cards/checkpoints
mkdir -p cards/decisions
mkdir -p cards/release-notes

# Create index.json files in each directory
cd cards/initiatives && echo '{"entries":[]}' > index.json
cd ../epics && echo '{"entries":[]}' > index.json
cd ../stories && echo '{"entries":[]}' > index.json
cd ../intakes && echo '{"entries":[]}' > index.json
cd ../checkpoints && echo '{"entries":[]}' > index.json
cd ../decisions && echo '{"entries":[]}' > index.json
cd ../release-notes && echo '{"entries":[]}' > index.json
```

Then report:

```
✓ Initialized cards directory with 7 subdirectories:
  cards/initiatives/
  cards/epics/
  cards/stories/
  cards/intakes/
  cards/checkpoints/
  cards/decisions/
  cards/release-notes/

Ready for card creation. Use Product Forge commands like /initiative, /epic, /story to create cards.

If you haven't configured your product taxonomy yet, run /memory:setup-org to set up your products, clients, and teams.
```

## Key Rules

- **Directories only:** This command creates directory structure and empty index.json files. It does not create sample cards.
- **Idempotent:** Running `/init` multiple times has no side effects. It only creates directories that don't already exist.
- **No prompts:** This command does not require user confirmation. It runs immediately.
- **Index files:** Each directory gets an empty index.json with `{"entries":[]}` structure for fast querying.

## Error Handling

- If the working directory is not writable, report the error and suggest checking permissions.
- If the working directory appears to be inside a plugin folder rather than a project root, warn the user and suggest running from the project root instead.
