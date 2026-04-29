---
name: security-audit
version: "1.0.0"
author: "TGMS"
tags: ["security", "supabase", "qtsp", "ruflo"]
description: >
  Security-focused review workflow for auth, RLS, RPCs, evidence handling, QTSP flows, and dependency changes.
---

# Security Audit

## Purpose
Run focused security review when work touches authorization, Supabase policies, RPCs, document evidence, or dependencies.

## When to Trigger
- Migrations change RLS, SECURITY DEFINER RPCs, or audit/evidence tables.
- Hooks read or mutate tenant-scoped data.
- Code touches QTSP signing, ERDS, storage archival, or generated documents.
- Dependencies or MCP/orchestration tooling change.

## When to Skip
- Styling-only changes.
- Read-only documentation changes.
- Demo copy changes with no data flow, auth, storage, or dependency impact.

## Checklist
- Tenant scoping is explicit and consistent.
- SECURITY DEFINER functions validate tenant/entity scope.
- Evidence hashes and WORM assumptions remain intact.
- No secrets are logged, committed, or stored in Ruflo memory.
- Demo-only shortcuts are named as such and isolated.

## Commands
Route a security review:

```bash
bun run agents:route -- "security review of Supabase RPC and QTSP pipeline"
```

Run project verification after fixes:

```bash
bun run test
bun run lint
bun run build
```
