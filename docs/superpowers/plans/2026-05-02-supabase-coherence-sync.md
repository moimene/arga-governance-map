# 2026-05-02 - Supabase coherence sync

## Decision

Supabase is not synchronized by applying migrations in this tranche.

Current posture: `no_schema_commit_plus_approved_packet_required`.

The Lovable UX branch can stay synchronized through GitHub without shipping
local schema artifacts. Any Supabase change needs an explicit migration packet,
Cloud read probes, approval, and post-apply verification.

## Guardrails

- `bun run db:check-target` must pass before any Supabase work.
- No `supabase db push`.
- No migrations applied from this tranche.
- No Supabase type regeneration.
- No RLS/RPC/storage/policy changes without approved packet.
- `000049_grc_evidence_legal_hold` remains HOLD.
- No writes to `governance_module_events` or `governance_module_links`.

## Baseline

- Target: `governance_OS` (`hzqwefkwsxopwrmtksbg`), confirmed by `bun run db:check-target`.
- Branch synced for Lovable: `codex/ux-lovable-sync`.
- UX commit: `7fffdcb feat: sync UX prototype for Lovable review`.
- The UX commit intentionally excludes:
  - `supabase/migrations/**`
  - `supabase/.temp/**`
  - `supabase/functions/_types/database.ts`
  - `docs/legal-team/**`
  - Supabase probe/cleanup scripts.

## Migration Ledger Posture

`supabase migration list` shows historical ledger drift:

- Local migrations use short prefixes like `20260419`, `20260420`, `20260424`,
  `20260426`, `20260427`.
- Remote migrations are registered with timestamp versions like
  `20260417121410`, `20260426151000`, `20260427000100`, `20260427000101`.
- Therefore the CLI does not show clean one-to-one local/remote parity.

Operational reading:

- Do not fix this with `db push`.
- Do not assume every local file is pending.
- Do not assume every remote version has a local source file.
- Treat this as `materialized_drift` until a dedicated migration-ledger
  normalization packet maps filenames, remote versions, and Cloud objects.

## Local Supabase Artifacts In HOLD

### Generated Types

Path: `supabase/functions/_types/database.ts`

Status: local modified, not committed to Lovable branch.

Reason: includes generated schema deltas, including `aims_*` objects and other
Cloud/type surfaces. Types must not be committed as a silent backbone adoption.

Required decision:

- Approve which schema packet has been applied.
- Regenerate types only after approved migration apply and verification.
- Review `ai_*` vs `aims_*` posture before using generated AIMS types in UI.

### Local Migration 000042 - Group Campaigns

Path: `supabase/migrations/20260426_000042_group_campaigns.sql`

Objects requested:

- Tables: `group_campaigns`, `group_campaign_expedientes`,
  `group_campaign_steps`, `group_campaign_post_tasks`.
- Indexes: `idx_group_campaigns_tenant_status`,
  `idx_group_campaign_expedientes_campaign`,
  `idx_group_campaign_expedientes_entity`,
  `idx_group_campaign_steps_expediente`,
  `idx_group_campaign_steps_live_record`,
  `idx_group_campaign_post_tasks_due`.
- RLS: enabled on all four group campaign tables.
- Policies: tenant isolation policies for all four tables.
- Grants: `SELECT`, `INSERT`, `UPDATE` to `authenticated`.

Posture: `approved_gap` only if group campaign writes are required by a real
workflow and Cloud probes show the tables are absent.

### Local Migration 000043 - Rule Lifecycle Governance

Path: `supabase/migrations/20260426_000043_rule_lifecycle_governance.sql`

Objects requested:

- Extension: `pgcrypto`.
- `rule_pack_versions` columns: `status`, `effective_from`, `effective_to`,
  `approved_at`, `approved_by`, `payload_hash`, `supersedes_version_id`.
- `rule_pack_versions` indexes for status, effective window, payload hash, and
  supersession.
- `rule_evaluation_results` columns: `ruleset_snapshot_id`,
  `rule_pack_version_id`, `payload_hash`, `overrides_hash`,
  `evaluation_hash`, `severity`, `warnings`, `blocking_issues`.
- `rule_evaluation_results` indexes for snapshot, version, and stage/created.
- Data insert into `rule_change_audit`.

Posture: `approved_gap` only if Cloud probes prove lifecycle columns are absent
and the rule engine needs durable lifecycle state for production use.

### Local Migration 000044 - Convocatoria Rule Trace

Path: `supabase/migrations/20260426_000044_convocatoria_rule_trace.sql`

Objects requested:

- `convocatorias.rule_trace`
- `convocatorias.reminders_trace`
- `convocatorias.accepted_warnings`

Posture: `approved_gap` only if convocatoria emission must persist rule/reminder
trace in Cloud. Current UX can continue without applying this from the Lovable
branch.

### Local Migration 000045 - Documental Process Templates

Path: `supabase/migrations/20260426_000045_documental_process_templates.sql`

Objects requested:

- Constraint change on `plantillas_protegidas.tipo`.
- Data inserts for process-level templates such as `INFORME_PRECEPTIVO`,
  `INFORME_DOCUMENTAL_PRE`, and `INFORME_GESTION`.

Posture: mixed `approved_gap` plus `data_only_backfill`. Needs a packet because
it changes a constraint and inserts legal/documentary content.

### Local Migration 000100 - Supabase Sanitization Gate

Path: `supabase/migrations/20260427_000100_supabase_sanitization_gate.sql`

Objects requested:

- Consolidates parts of 000043, 000044 and 000045.
- AI RLS policies for `ai_risk_assessments` and `ai_compliance_checks`.
- Storage bucket: `matter-documents`.
- Storage object policies for authenticated select/insert/update.
- Functions: `fn_verify_audit_chain`, `fn_cerrar_votaciones_vencidas`.
- Function grants/revokes.
- Security invoker hardening for `sii_evidences_view`.

Posture: high-risk combined packet. Must be split before approval. It mixes
Secretaria, AIMS, storage, functions, grants and advisors.

### Local Migration 000101 - Supabase Sanitization Advisors

Path: `supabase/migrations/20260427_000101_supabase_sanitization_advisors.sql`

Objects requested:

- RLS/policies/grants for `materia_catalog`.
- RLS/policy/revokes for `mandates_legacy_backup`.
- `fn_cargo_vigente` security invoker and search path changes.
- Service-role policies for `jurisdiction_rule_sets`, `pack_rules`,
  `user_profiles`, `rbac_roles`, `sod_toxic_pairs`.
- Authenticated own-update policy for `profiles`.

Posture: `ops_backlog` unless a concrete advisor or runtime failure is blocking
the prototype. Do not include with functional UX packets.

## Coherence Action Plan

1. Keep Lovable UX branch schema-clean.
2. Keep local Supabase artifacts in HOLD until packet approval.
3. Create a read-only Cloud object probe matrix before any schema decision:
   - group campaign tables
   - rule lifecycle columns
   - convocatoria trace columns
   - plantilla process template constraint/content
   - AI RLS policies
   - `matter-documents` bucket and storage policies
   - advisor policies/functions
4. Split 000100 into separate packets before any approval:
   - Secretaria rule lifecycle/trace
   - Secretaria document templates
   - AIMS AI RLS
   - Storage/document bucket
   - Function grants/search path
   - advisor backlog
5. Regenerate Supabase types only after an approved packet is applied and
   verified.
6. Re-run:
   - `bun run db:check-target`
   - packet probes
   - `bunx tsc --noEmit --pretty false`
   - targeted tests
   - focused e2e.

## Current Answer

Supabase can be made coherent now at the governance and Git boundary:

- GitHub/Lovable sees only no-schema UX/product work.
- Local schema artifacts are explicitly classified and held.
- Exact table/RPC/RLS/storage needs are documented above.

Supabase cannot be made fully synchronized by applying or pushing schema in this
turn without violating the active constraints.
