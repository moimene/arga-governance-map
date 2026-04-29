---
name: memory-management
version: "1.0.0"
author: "TGMS"
tags: ["ruflo", "memory", "patterns"]
description: >
  Ruflo memory workflow for storing and retrieving durable project patterns after verified work.
---

# Memory Management

## Purpose
Use Ruflo memory for reusable project lessons, not for temporary scratch notes.

## When to Trigger
- A verified fix reveals a repeatable pattern.
- A schema gotcha or demo invariant should be remembered for future agents.
- A final review produces stable project knowledge.

## When to Skip
- The information is speculative or unverified.
- The note contains secrets, credentials, tokens, or personal data.
- The lesson is temporary scratch context for the current task only.

## Commands
Check memory state:

```bash
bun run agents:memory:stats
```

Search memory:

```bash
bun ruflo memory search -q "secretaria acta certification gate hash"
```

Store a verified pattern:

```bash
bun ruflo memory store -k "pattern-name" -v "short verified lesson" --namespace patterns
```

## Guardrails
- Store only verified, non-secret information.
- Do not store credentials, tokens, Supabase secrets, or personal data.
- Prefer concise entries that point to files, migrations, or tests.
