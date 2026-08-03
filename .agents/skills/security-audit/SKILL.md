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
- Code touches EAD Trust interposition/messaging/e-archiving, legacy signing/ERDS compatibility paths, storage archival, or generated documents.
- Dependencies or MCP/orchestration tooling change.

## When to Skip
- Styling-only changes.
- Read-only documentation changes.
- Demo copy changes with no data flow, auth, storage, or dependency impact.

## Checklist
- Tenant scoping is explicit and consistent.
- SECURITY DEFINER functions validate tenant/entity scope.
- Evidence hashes and WORM assumptions remain intact.
- Final convocatoria uploads have prior immutable intents, exact expected-set matching, and server-side rendering from the WORM manifest.
- The intent-binding schema remains aligned with migration `20260720149000_secretaria_supporting_attachment_intent_binding.sql`.
- Emitted or rectified captures cannot be mutated; corrections create a new capture.
- EAD Trust claims are limited to interposition, basic messaging, and custody/e-archiving. Legacy signature/ERDS paths fail closed and cannot imply signature, sending, or delivery.
- No secrets are logged, committed, or stored in Ruflo memory.
- Demo-only shortcuts are named as such and isolated.

## Commands
Route a security review:

```bash
bun run agents:route -- "security review of Supabase RPC and EAD Trust evidence pipeline"
```

Run project verification after fixes:

```bash
bun run test
bun run lint
bun run build
```
