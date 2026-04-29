---
name: arga-finish-review
version: "1.0.0"
author: "TGMS"
tags: ["arga", "review", "ruflo", "secretaria"]
description: >
  Final review and project completion workflow for arga-governance-map. Use when coordinating multiple review agents across UX, legal/domain rules, Supabase schema, tests, and demo golden paths.
---

# ARGA Finish Review

## Purpose
Coordinate final review work for the TGMS/ARGA demo without losing the project constraints in `AGENTS.md`.

## When to Trigger
- Preparing a final demo pass or release-quality review.
- Splitting work across UX, legal motor, data/schema, and test/build verification.
- Checking that recent sprint work is complete, navigable, and demo-safe.

## When to Skip
- Single-file fixes with obvious verification.
- Pure documentation edits that do not affect demo behavior.
- Tasks where the user explicitly asks for local single-agent work only.

## Workflow
1. Read `AGENTS.md` and current `git status` before assigning work.
2. Route the task through Ruflo:

```bash
bun run agents:route -- "final review of ARGA Secretaria golden path"
```

3. Use a hierarchical swarm shape with clear boundaries:
- UX/Garrigues reviewer: token usage, accessibility, responsive behavior.
- Legal/domain reviewer: ARGA data consistency, LSC rule paths, pactos, QTSP naming.
- Supabase/schema reviewer: migrations, RPC names, hook column assumptions.
- Verification reviewer: `bun run test`, `bun run lint`, `bun run build`, and smoke paths.

4. Integrate findings locally, keeping edits scoped and preserving user changes.
5. Store durable lessons in Ruflo memory only after the fix is verified.

## Guardrails
- Never introduce `MAPFRE` into demo code, data, seeds, or commit text.
- Use Bun for project package management.
- Do not run `ruflo init --force` in this repo.
- Components under `/secretaria`, `/grc`, and `/ai-governance` must use Garrigues tokens, not raw Tailwind colors or hex values.
