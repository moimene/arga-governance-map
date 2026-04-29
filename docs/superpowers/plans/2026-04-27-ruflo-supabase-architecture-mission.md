# Ruflo Mission: Supabase Architecture Integration

Date: 2026-04-27
Project: TGMS / ARGA Governance Map
Supabase target: `governance_OS` (`hzqwefkwsxopwrmtksbg`)
Mission owner: Codex orchestration

## Why This Mission Exists

This repo is intentionally one integrated governance ecosystem, not four unrelated demos. The target product is a corporate governance ERP where TGMS core, Secretaría Societaria, GRC Compass and AIMS share one tenant, one corporate graph, one evidence backbone and one audit trail.

Architectural decision: separate product, share platform. Secretaría, GRC Compass and AIMS are bounded product contexts that can be sold, deployed and explained independently. TGMS Shell and the ARGA Corporate Console compose them for large clients, but they must not collapse into one supermodule.

Shared platform must remain thin and stable: tenant/scope, identity, base RBAC, Garrigues UX tokens, `governance_module_links`, `governance_module_events`, `evidence_bundles`, `audit_log`, legal hold and retention. Module-owned business logic stays inside its module.

The current Supabase context is functional but drifting:

- Cloud contains AIMS/GRC migrations that are not represented in local `supabase/migrations`.
- Local Secretaría migrations add fields and templates used by UI but not present in Cloud.
- AIMS has two model generations (`ai_*` legacy UI tables and `aims_*` product backbone).
- Evidence/QTSP, storage and audit-chain assumptions are not yet consistent enough to be the integration spine.

This mission establishes a coordination contract so each workstream can continue feature delivery without corrupting the shared architecture.

## Non-Negotiable Architecture Principles

1. `AGENTS.md` remains the canonical project guide.
2. Never use MAPFRE directly in code, seeds, demo data or commit messages; use ARGA.
3. Supabase writes must target `governance_OS` only after `bun run db:check-target` passes.
4. Every schema dependency used by UI must exist in:
   - Supabase Cloud,
   - local `supabase/migrations`,
   - generated Supabase types,
   - at least one smoke or schema probe when feasible.
5. New functionality may continue, but each module must stay inside its bounded ownership and publish integration contracts through shared tables/events, not hidden ad hoc joins.
6. AIMS, GRC and Secretaría are separate products with shared platform contracts; no module may silently absorb another module's source-of-truth model.
7. Demo shortcuts are allowed only when named as demo-only and isolated from future production gates.

## Critical Integration Guardrails

Until Cloud/local migration parity and generated types are closed, every functional change must declare its schema posture.

Immediate rules:

1. Do not apply destructive migrations.
2. Do not create new columns or tables before checking Supabase Cloud, local migrations, generated types and UI consumers.
3. Before touching Supabase, run `bun run db:check-target` and confirm the target is `governance_OS` (`hzqwefkwsxopwrmtksbg`).
4. Every UI change that depends on schema must name the migration or schema contract it requires.
5. Do not duplicate models. If a change touches GRC or AIMS, state explicitly whether it works against the legacy tables or the new backbone.
6. Secretaría must preserve legal traceability, rule snapshots and explainability of the rules engine.
7. Cross-module integration must go through shared contracts: `governance_module_links`, `governance_module_events`, `evidence_bundles` and `audit_log`.

Known drift to close:

| Area | Drift / ambiguity | Required posture |
|---|---|---|
| Secretaría convocatorias | UI expects `convocatorias.rule_trace`, `convocatorias.reminders_trace`, `convocatorias.accepted_warnings`; Cloud parity must be verified. | No new UI dependency without naming the migration and confirming Cloud/local/types. |
| Secretaría rules | `rule_pack_versions` lifecycle exists in local work but must be reconciled with Cloud and generated types. | Treat rule lifecycle as Track C parity work before broad UI expansion. |
| Secretaría templates | PRE templates (`INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE`) must exist in Cloud and be discoverable by UI. | Use coverage matrix and schema/data probes before relying on them in flows. |
| AIMS | Legacy `ai_*` tables and new `aims_*` backbone coexist. | Each change must choose legacy compatibility or backbone adoption; no silent mixed model. |
| GRC | `grc_*` backbone exists in Cloud, while UI still consumes some legacy operational tables. | Track D must map UI consumers and choose canonical table families by workflow. |
| Evidence | `evidence_bundles`, storage and audit chain are not yet reliable as a single evidence backbone. | Do not claim evidence finality unless bundle, storage object, hash and audit linkage are verifiable. |

## Bounded Product Contexts

Decision accepted on 2026-04-27: separate product, share platform.

| Context | Source of truth | Must not own |
|---|---|---|
| AIMS 360 | AI systems, model/version inventory, AI Act, ISO 42001, technical files, post-market monitoring and AI controls. | GRC risk/control ledger or Secretaría legal artifacts. |
| GRC Compass | Obligations, risks, controls, evidence ledger usage, findings, remediation, reporting, legal hold and retention workflows. | AI system inventory/technical files or Secretaría formal corporate record. |
| Secretaría Societaria | Convocatorias, meetings, actas, certifications, books, agreements, legal rule snapshots and formal corporate evidence. | GRC operational workflows or AIMS model/system governance. |
| TGMS Shell / ARGA Console | Corporate orchestration, navigation, global scope, global work queue, search, executive dashboards and cross-module journeys. | Module-owned transactional state or business logic. |

Shared contracts are intentionally narrow: tenant/entity/person identity, base RBAC, UX tokens, `governance_module_links`, `governance_module_events`, `evidence_bundles`, `audit_log`, legal hold and retention. If a journey needs cross-module behavior, it must pass through these contracts or through the owning module's mutation path.

## Mandatory Batch Closure

Every agent batch must finish by updating project/module documentation and local or Ruflo memory. The final response must include this closure block.

```text
Documentation and memory:
- Project docs updated:
- Memory key:
- Stable lesson recorded:
- No secrets stored: yes/no

Data contract:
- Tables used:
- Source of truth: Cloud | local pending | legacy | generated types only | none
- Migration required:
- Types affected:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Tests:
- Build/lint/e2e:
```

Rules:

- If memory cannot be written directly, include the exact memory text that Codex/Ruflo should store.
- Do not store secrets, credentials, tokens, personal data or transient scratch notes in memory.
- The memory entry should be short, stable and reusable.
- Documentation updates must point future agents to the relevant module state, schema contract or verification result.

## Canonical Contexts

### 0. ARGA Corporate Console / ERP Shell

Purpose: the general ARGA Seguros command console that makes TGMS feel like one corporate governance ERP instead of separate modules.

Owns:

- Global shell, navigation, module launcher and executive command center.
- Global scope/entity context, search, notifications, inbox/work queue and cross-module dashboards.
- Cross-module read models that compose TGMS core, Secretaría, GRC and AIMS without changing ownership.
- User journeys where one input or generated fact must be usable across the whole environment.

Contract:

- The console is an orchestrator and experience layer, not a competing source of truth.
- Every datum shown or created from the console must have a declared owner table/module.
- The console must reference canonical IDs from TGMS core and module owners; it must not duplicate records by display name or local UI-only copies.
- Writes from the console must be delegated to the owning module's mutation path or shared contract.
- Global dashboards may denormalize only into documented read models/snapshots with source IDs, timestamps, hashes or evidence references.
- Cross-module transitions must use `governance_module_links`, `governance_module_events`, `evidence_bundles` and `audit_log` when persistence or evidence is required.

Single data principle:

| Data / fact | Canonical owner | Console posture |
|---|---|---|
| Tenant, entity, body, person identity | TGMS core | Select and reference by ID; never recreate locally. |
| Legal expediente, meeting, acta, certification, rule snapshot | Secretaría | Link, launch or summarize; do not reimplement legal engine. |
| Risk, control, incident, workflow, audit finding | GRC | Link, aggregate or escalate; do not duplicate GRC operational state. |
| AI system, model/version, technical file, AI evidence, AI incident | AIMS | Link, aggregate or escalate; do not fork AIMS inventory. |
| Evidence, legal hold, custody, audit chain | Shared evidence/audit backbone | Treat as verifiable only when storage, hash, bundle and audit linkage are present. |

### 1. TGMS Core / Lovable Demo

Purpose: common governance shell and enterprise graph.

Owns:

- `tenants`, `entities`, `persons`, `governing_bodies`
- `policies`, `obligations`, `controls`, `evidences`
- `audit_log`, `notifications`, `attestations`, `delegations`, `findings`, `action_plans`
- cross-module bridges: `governance_module_links`, `governance_module_events`, `evidence_bundles`

Contract:

- Core entities and bodies are the shared identity layer.
- Modules reference core records by ID and tenant, never by display names.
- Demo ARGA Seguros entity ID must be either restored to the documented UUID or `AGENTS.md` must be updated to the Cloud UUID.

### 2. Secretaría Societaria

Purpose: legal governance execution engine.

Owns:

- `agreements`, `convocatorias`, `meetings`, `minutes`, `certifications`
- rule packs, rule versions, overrides and evaluation snapshots
- protected templates and document generation flows
- group campaigns and society-specific expedientes
- authority/capability evidence, pactos parasociales, voting/census structures

Contract:

- Secretaría is the primary producer of board-ready legal artifacts.
- It must emit evidence and module events when an expediente affects GRC, AIMS or core governance reporting.
- Rule evaluation snapshots must be durable enough to reconstruct why a decision was accepted.

### 3. GRC Compass

Purpose: risk, control, audit, DORA/cyber/compliance operation.

Owns:

- `grc_*` backbone tables
- legacy operational tables: `risks`, `incidents`, `vulnerabilities`, `exceptions`, `bcm_*`, `regulatory_notifications`, `country_packs`

Contract:

- GRC raises Secretaría agenda proposals through `governance_module_events` / `governance_module_links`.
- GRC consumes AIMS evidence when AI systems create control, risk or regulatory obligations.
- GRC evidence references should converge on the shared `evidence_bundles` ledger.

### 4. AIMS / AI Governance

Purpose: AI Act / ISO 42001 governance, technical files, monitoring and evidence.

Owns:

- Product backbone: `aims_*`
- Legacy UI tables until migrated: `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents`

Contract:

- AIMS must either migrate UI reads to `aims_*` or explicitly maintain compatibility with `ai_*`.
- Technical-file closure must create shared evidence bundles and GRC-ready evidence links.
- AIMS incidents must be able to feed GRC workflows and, when material, Secretaría agenda proposals.

## Immediate Mission Tracks

### Track A — Supabase Parity and Schema Registry

Owner profile: architecture / Supabase

Deliverables:

- Reconcile Cloud migrations with local files.
- Identify migrations present in Cloud but missing locally.
- Identify local migrations not applied to Cloud.
- Create a schema registry document that maps every table to context, owner, status and UI consumers.
- Regenerate Supabase types after parity is restored.

Do not:

- Apply destructive migrations.
- Rename tables or columns without a compatibility layer.

### Track B — Core Integration Backbone

Owner profile: platform / integration

Deliverables:

- Define canonical usage for `governance_module_links`, `governance_module_events`, `evidence_bundles`, `audit_log`.
- Verify the ARGA entity identity mismatch and decide restore-vs-document.
- Define minimum cross-module event payloads.
- Create smoke probes for core integration tables.

### Track C — Secretaría Continuity

Owner profile: Secretaría product / legal rules

Deliverables:

- Close `convocatorias.rule_trace`, `reminders_trace`, `accepted_warnings` Cloud/local parity.
- Close rule lifecycle parity for `rule_pack_versions`.
- Ensure PRE process templates exist in Cloud and are discoverable by UI.
- Keep group campaigns as the main group-level orchestration model.

### Track D — GRC Backbone Adoption

Owner profile: GRC product / controls

Deliverables:

- Map current UI pages to either legacy tables or `grc_*` backbone tables.
- Decide which `grc_*` tables become canonical for risks, controls, workflows and evidence links.
- Create bridge from GRC material events to Secretaría agenda proposals.

### Track E — AIMS Backbone Adoption

Owner profile: AIMS product / AI governance

Deliverables:

- Decide compatibility strategy: migrate UI to `aims_*` or add policies/bridges for `ai_*`.
- Fix visibility gap where demo user sees 0 `ai_risk_assessments` / `ai_compliance_checks`.
- Verify `fn_aims_close_technical_file` authorization and evidence side effects.
- Define AIMS-to-GRC and AIMS-to-Secretaría escalation events.

### Track F — Security, RLS and Evidence Gate

Owner profile: security / QA

Deliverables:

- Triage Supabase security advisors.
- Remove or constrain `anon` execution from privileged `SECURITY DEFINER` RPCs.
- Fix `fn_verify_audit_chain`.
- Create `matter-documents` bucket or change archival contract.
- Confirm which RLS policies are demo-only and which are production candidates.

### Track G — ARGA Console / ERP Integration Shell

Owner profile: console / ERP integration / product architecture

Deliverables:

- Define the general ARGA Seguros console as the first-viewport operating layer for the ecosystem.
- Build or document the global information architecture: executive dashboard, global search, inbox/work queue, entity selector, module launcher and cross-module drilldowns.
- Create a data ownership matrix for every global input/generated datum: owner module, table, ID, consumers, allowed mutations and evidence posture.
- Map console journeys where one input flows through several modules, for example:
  - A GRC incident escalates to Secretaría as an agenda proposal.
  - An AIMS technical-file finding becomes a GRC control/workflow and later a board pack item.
  - A Secretaría agreement generates evidence consumed by GRC/AIMS reporting.
- Define read-only composition patterns while Supabase parity is open.
- Propose mutation handoff patterns that delegate to owning modules instead of writing ad hoc shell state.
- Ensure global KPIs and dashboards state whether they are derived from Cloud schema, local pending migrations, legacy tables or mocked/demo data.

Do not:

- Create a new parallel data model for module-owned records.
- Add shell-level tables before checking Cloud/local/types/UI parity and owner-module contracts.
- Reimplement Secretaría legal logic, GRC workflow logic or AIMS technical-file logic in the console.
- Treat aggregated dashboard data as evidence unless it is linked to `evidence_bundles` and audit trail.

## Coordination Rules

- Max 7 active Ruflo lanes at once.
- Each lane owns a disjoint responsibility and must not revert unrelated user changes.
- Schema changes require a migration file plus Cloud parity note.
- UI changes that depend on schema must name the migration they require.
- Shared contracts belong in docs before broad implementation.
- Codex orchestrator remains responsible for final integration, verification and conflict resolution.

## Agent Documentation And Memory Protocol

Every agent working on Secretaría, GRC, AIMS or TGMS core must keep project documentation and local/Ruflo memory current as part of the definition of done.

Required documentation update:

1. Update the module's own project document before closing the task:
   - Secretaría: Secretaría state/refactor plan and any relevant legal/control matrix.
   - GRC: GRC plan, PRD addendum or module state document.
   - AIMS: AIMS/GRC plan, PRD addendum or module state document.
   - Core/TGMS: root architecture mission or core integration doc.
   - ARGA Console / ERP Shell: console architecture doc, root architecture mission or core integration doc.
2. Link back to this plan rector when the work touches Supabase, schema, generated types, evidence, audit, RLS or cross-module contracts.
3. Record whether the change depends on Cloud schema, local pending migrations, legacy tables or generated types.
4. If the change creates or consumes a shared contract, document the contract name and payload shape.

Required memory update:

1. Store only stable, verified, non-secret information.
2. Use a namespaced key that includes module and date, for example:
   - `secretaria_template_routing_2026_04_27`
   - `grc_backbone_contract_2026_04_27`
   - `aims_legacy_bridge_2026_04_27`
3. Include:
   - what changed,
   - files/docs touched,
   - schema posture,
   - verification performed,
   - remaining blockers.
4. Do not store credentials, tokens, personal data, private client secrets or speculative conclusions.

Mandatory closing note:

```md
Documentation and memory:
- Project docs updated:
- Memory key:
- Stable lesson recorded:
- No secrets stored: yes/no

Data contract:
- Tables used:
- Source of truth: Cloud | local pending | legacy | generated types only | none
- Migration required:
- Types affected:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Tests:
- Build/lint/e2e:
```

If an agent cannot update memory directly, it must include the exact memory entry it wants Codex/Ruflo to store.

## Current Known Gates

Before claiming this mission healthy:

- `bun run db:check-target` passes.
- Supabase Cloud/local migration parity is documented.
- Supabase generated types include current Cloud tables and current UI-required columns.
- `bunx tsc --noEmit` passes.
- `bun run test src/test/schema` has meaningful non-skipped coverage for new contract probes.
- `bun run build` passes.
- Supabase advisors are triaged into demo-acceptable, fix-now or production-backlog.

## Sanitization Closure — 2026-04-27

Status: closed for the Supabase sanitization lane.

Operational sanitization now continues under:

- `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md`
- `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`

Applied Cloud migrations:

- `20260427000100` / `supabase_sanitization_gate`
- `20260427000101` / `supabase_sanitization_advisors`

Cloud verification:

- Supabase MCP `list_migrations` shows both sanitization migrations in `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `rule_pack_versions` has lifecycle/hash parity columns: `status`, `effective_from`, `payload_hash`, `supersedes_version_id`.
- Storage bucket `matter-documents` exists.
- `materia_catalog` has RLS enabled.
- `fn_verify_audit_chain` is no longer `SECURITY DEFINER`.
- Security advisor remaining: `auth_leaked_password_protection` only, an Auth dashboard setting outside SQL migration scope.

Local verification:

- `bun run db:check-target`: passed.
- `bunx tsc --noEmit`: passed.
- `bun run lint`: passed with existing warnings only.
- `bun run test`: 404 passed, 59 skipped.
- `bun run build`: passed.

Data contract:

- Tables used: `rule_pack_versions`, `rule_evaluation_results`, `convocatorias`, `plantillas_protegidas`, legacy `ai_*`, `materia_catalog`, `mandates_legacy_backup`, `storage.buckets`, `storage.objects`, function catalog.
- Source of truth: Cloud.
- Migration required: no additional sanitization migration pending in this lane.
- Types affected: `supabase/functions/_types/database.ts` regenerated from Cloud and includes current `aims_*`, `grc_*`, `governance_module_*`, rule trace and lifecycle fields.
- Cross-module contracts: Secretaria rule lifecycle/trace, AI legacy RLS compatibility, storage document bucket, hardened RPC grants.
- Parity risk: reduced for the sanitization lane; performance advisors remain backlog and `000049_grc_evidence_legal_hold` stays frozen.

Documentation and memory:

- Project docs updated: this closure note plus the active freeze register below.
- Memory key: `aims_grc_evidence_legal_hold_freeze_ack_2026_04_27`.
- Stable lesson recorded: AIMS/GRC must not move migrations, schema, generated types, RLS/RPC/storage while sanitization freeze is active.
- No secrets stored: yes.

## Active Freeze Register

### AIMS/GRC Evidence And Legal Hold

Acknowledged on 2026-04-27 by the AIMS/GRC workstream.

Status:

- `000049_grc_evidence_legal_hold` is in absolute HOLD for schema until Codex lifts the Supabase sanitization freeze.
- No migrations, columns, tables, generated types, RLS policies, RPC changes or storage changes may be applied by that workstream.
- UI/docs/tests may continue only if they introduce no new schema dependency and close with an explicit data contract.
- Evidence/Legal Hold remains a high-parity-risk area and must not be presented as the unique probatory backbone until `000049`, Cloud/local/types, storage and audit chain are hardened together.

Referenced AIMS/GRC docs:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360/docs/schema-registry/2026-04-27-grc-evidence-legal-hold-freeze.md`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360/docs/schema-registry/2026-04-27-grc-p0-p1-gate-review.md`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360/docs/memory/2026-04-26-aims360-grc-core-progress.md`

## Ruflo Activation Prompt

Use this text when routing the mission:

> Mission: coordinate the Supabase architecture integration for TGMS as one corporate governance ERP across five contexts: ARGA Console / ERP Shell, TGMS core/Lovable demo, Secretaría Societaria, GRC Compass and AIMS. Preserve module autonomy while enforcing shared tenant/entity identity, migration parity, generated types, evidence/audit contracts, RLS discipline and cross-module event contracts. Do not implement destructive changes. First produce bounded findings and recommended patches per track A-G. Codex remains integration owner.

## Activation Record

Recorded by Codex on 2026-04-27.

Health checks:

- `bun run agents:doctor`: passed with warnings for stale PID file, high disk usage and optional `agentic-flow` missing.
- `bun run agents:mcp:tools`: Ruflo MCP tools available.
- `bun run db:check-target`: passed before mission creation in the preceding Supabase audit.

Swarm state:

- `ruflo swarm init --v3-mode` initialized `swarm-1777257395672-53s616`.
- `ruflo swarm start ... -s analysis` initialized `swarm-mogl7sc9`.
- `.swarm/state.json` is the durable local state file for `swarm-mogl7sc9`.
- `ruflo swarm status` did not show active tasks after MCP initialization, so this document is the source of truth for mission intent until Ruflo state visibility is repaired.

Created task IDs:

- Root mission: `task-1777257437403-u80k7j`
- Track A, Supabase parity: `task-1777257437405-r1f880`
- Track B, core integration backbone: `task-1777257437420-hhe8i2`
- Track C, Secretaría continuity: `task-1777257437459-cif81d`
- Track D, GRC backbone adoption: `task-1777257445918-unov4r`
- Track E, AIMS backbone adoption: `task-1777257445930-xj3sj8`
- Track F, security/evidence gate: `task-1777257446035-j8yc9k`
- Verification lane: `task-1777257446028-6mc3j7`

Spawned/assigned agents:

- Architect: `agent-1777257452266-sjxu2k`
- Reviewer: `agent-1777257452266-cjq25j`
- Tester: `agent-1777257452337-vcwrds`

Routing overrides:

- Tracks A-E: architect lane.
- Track F: reviewer lane.
- Track G: console / ERP integrator lane.
- Verification: tester lane.

## MCP Hive-Mind Activation Record

Ruflo MCP status on activation:

- Running: true
- Transport: `stdio`
- Queen/orchestrator: `codex-orchestrator`

Hive-mind:

- Hive ID: `hive-1777257574527-awlby4`
- Topology: `hierarchical`
- Consensus: `byzantine`
- Status: active / healthy per `mcp__ruflo__.hive_mind_status`

MCP agents:

- `tgms-architecture-lead` — architect, specialist, owns tracks A-E and root mission architecture.
- `tgms-security-evidence-reviewer` — reviewer, specialist, owns track F.
- `tgms-verification-gate` — tester, specialist, owns verification lane.
- `tgms-console-erp-integrator` — architect, specialist, owns Track G and the ARGA console / ERP shell integration architecture.

MCP task IDs:

- Root mission: `task-1777257594640-und2pq`
- Track A, Supabase parity: `task-1777257594645-jedhgg`
- Track B, core integration backbone: `task-1777257594649-8tclkd`
- Track C, Secretaría continuity: `task-1777257594654-hvi4dt`
- Track D, GRC backbone adoption: `task-1777257602769-csfdu9`
- Track E, AIMS backbone adoption: `task-1777257602776-9e0uz9`
- Track F, security/evidence gate: `task-1777257602782-ilgmhr`
- Verification lane: `task-1777257602787-npvrmo`
- Track G, ARGA console / ERP integration shell: `task-1777258921354-olkk0n`

Durable Ruflo memory:

- Namespace: `arga-governance-map`
- Key: `tgms_supabase_architecture_mission_2026_04_27`
- Tags: `tgms`, `supabase`, `architecture`, `ruflo`, `mission`
- Key: `bounded_contexts_separate_product_shared_platform_2026_04_27`
- Stable lesson: AIMS 360, GRC Compass and Secretaría are separate bounded product contexts that share a thin platform; TGMS Shell / ARGA Console composes them but must not duplicate module-owned source-of-truth models.
- Key: `aims_grc_evidence_legal_hold_freeze_ack_2026_04_27`
- Stable lesson: AIMS/GRC acknowledged the Supabase sanitization freeze; `000049_grc_evidence_legal_hold` is absolute HOLD for schema until Codex lifts the freeze.
