# slack-forge Design Document

**Date:** 2026-02-17 (updated 2026-02-19)
**Status:** Approved
**Plugin:** slack-forge
**Version:** v1.1.0

## Overview

slack-forge is a Slack intelligence pipeline with a split execution model:

1. `/slack-forge:scan` (primary agent)
- Uses Slack MCP to retrieve channel/DM/JIRA data.
- Writes local transcript snapshots under `slack-forge/transcripts/`.
- Does not create harvest records.

2. `/slack-forge:capture` (local-only)
- Reads local transcript snapshots.
- Extracts tasks, knowledge, and JIRA activity via subagents.
- Creates harvest records through forge-lib.

All extracted items remain review-first: pending -> approved/rejected -> promoted.

## Commands

| Command | Purpose |
|---------|---------|
| `/slack-forge:init` | Initialize slack-forge and channel config |
| `/slack-forge:scan` | MCP scan and transcript generation |
| `/slack-forge:capture` | Harvest local transcripts into records |
| `/slack-forge:review` | Review pending harvests |
| `/slack-forge:promote` | Promote approved harvests downstream |

## Architecture

### Stage 1: Scan

- Load config from `slack-forge/config.json`.
- Pull messages with MCP for configured scope.
- Write transcript files:
  - `{date}-{timeframe}-public-channels.md`
  - `{date}-{timeframe}-dms.md`
  - `{date}-{timeframe}-jira-bot.md`
- Support modes:
  - scan only
  - scan then ask for capture
  - scan and auto-capture

### Stage 2: Capture

- Read transcript files from `slack-forge/transcripts/`.
- Run task/knowledge/jira digest extraction subagents.
- Persist harvests via `forge harvest create`.

## Data Model

### Config

`slack-forge/config.json` stores channels + jira channel.

### Transcripts

Markdown snapshots are source input for capture.

### Harvests

Stored in `slack-forge/` using `harvest` schema and workflow statuses.

## MCP Boundary

- Primary agent may call MCP tools during scan.
- Subagents in capture are local-file-only.

## forge-lib Integration

- Harvest CRUD and config APIs unchanged.
- Capture uses existing `forge harvest create/query/update` operations.
