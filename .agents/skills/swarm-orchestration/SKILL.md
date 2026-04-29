---
name: swarm-orchestration
version: "1.0.0"
author: "TGMS"
tags: ["ruflo", "swarm", "coordination"]
description: >
  Ruflo multi-agent coordination for complex work spanning several files, modules, or verification tracks.
---

# Swarm Orchestration

## Purpose
Use Ruflo to route and coordinate multi-agent work while keeping Codex responsible for actual code edits and verification.

## When to Trigger
- A task touches three or more files.
- Several independent review tracks can run in parallel.
- A feature needs implementation, tests, and UX review.
- A schema or hook change affects multiple pages.

## When to Skip
- One or two line fixes.
- Quick read-only exploration.
- Work that would create overlapping write scopes for multiple agents.

## Commands
Route the task:

```bash
bun run agents:route -- "describe the task"
```

Inspect MCP tools:

```bash
bun run agents:mcp:tools
```

Check swarm state:

```bash
bun run agents:swarm:status
```

## Coordination Rules
- Prefer hierarchical coordination with at most 6-8 agents.
- Give each agent a bounded responsibility and disjoint write scope.
- Keep the main agent responsible for integration, final verification, and protecting user changes.
