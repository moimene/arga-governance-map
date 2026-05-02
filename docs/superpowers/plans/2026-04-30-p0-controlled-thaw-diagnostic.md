# 2026-04-30 — P0 controlled thaw diagnostic

## Purpose

This note closes the first controlled-thaw diagnostic after the Supabase
sanitization freeze moved from global freeze to packet-based thaw.

The goal was to determine whether Secretaria, AIMS-GRC smoke coverage, and the
current demo paths require any immediate Supabase migration, data-only backfill,
RLS/RPC/storage change, or generated-type update.

## Baseline

- Supabase target: `governance_OS` (`hzqwefkwsxopwrmtksbg`)
- Workstream: Secretaria plus shared AIMS-GRC smoke readiness
- Scope: diagnostic and verification only
- Schema touch: no
- Types touch: no
- Storage/RPC/RLS touch: no
- Freeze dependency: controlled thaw by packet remains active

## Result

Current posture remains `no_schema`.

No immediate migration packet is required for the verified demo flows. The
current paths can continue with UI, UX, tests, hooks, documentation, and browser
smoke work against confirmed Cloud objects.

## Findings

1. `bun run db:check-target` confirmed the Cloud target is the expected
   `governance_OS` project.
2. Focused Secretaria and sanitization smokes are green when run in isolated
   Playwright commands.
3. The combined parallel Playwright run exposed a harness race around shared
   `.auth/session.json`, producing login/session failures that disappeared when
   the specs were rerun separately.
4. The harness race is classified as test orchestration, not Supabase schema,
   data, RLS, RPC, or storage drift.
5. No data-only backfill is needed at this point.
6. No `approved_gap` migration is justified by the current evidence.
7. `000049_grc_evidence_legal_hold` remains in HOLD.

## QA / Contract Addendum

Minimum P0 coverage for the current GRC/AIMS tranche is now:

1. Route smoke coverage for the core AIMS and GRC screens remains in
   `e2e/16-sanitization-smoke.spec.ts`.
2. Platform posture coverage remains pure/unit-level in
   `src/lib/arga-console/__tests__/platform-readiness.test.ts`, so it does not
   depend on Cloud availability or schema drift.
3. GRC and AIMS must stay `read_only`, `legacy`, and `migrationRequired=false`
   until the owner approves a separate write/read-model packet.
4. Every readiness lane must reference a known local data contract from
   `src/lib/arga-console/contracts.ts`.
5. GRC and AIMS must explicitly reference `cross-module-contracts`, while the
   integration lane remains `sourcePosture=none` and no-schema.
6. Evidence/legal hold stays out of this tranche: `000049` remains HOLD and
   `finalEvidence=false`.

This closes the minimum contract guard without asserting fragile dashboard
labels, counts, or row-specific demo data.

## AIMS-GRC P0 Readiness Addendum

The coordinated AIMS-GRC tranche remains `no_schema` and adds only local
readiness contracts plus dashboard UX:

1. GRC dashboard now exposes only frontend-connected P0 surfaces with source
   posture: GDPR/canal interno via GDPR views, DORA/ICT, Cyber,
   ERM/Auditoría, Trabajo/Alertas/Excepciones, and Packs país.
2. TPRM and penal/anticorrupción are not shown as active readiness domains
   because they do not have a dedicated connected GRC frontend screen yet; they
   are visible only as `No conectado ahora` backlog.
3. AI Governance now exposes AIMS P0 readiness over existing `ai_*` data:
   inventory, AI Act assessments, incidents, derived controls, operational
   evidence, and migration `ai_* -> aims_*`.
4. The AIMS contract is `legacy-ai`; it does not add queries to `aims_*` or
   create parallel controls.
5. Both modules remain standalone-friendly while sharing the platform posture
   panel and cross-module contract language.
6. No final-evidence claim is introduced.

## Verification

- `bun run db:check-target`: pass
- `bunx tsc --noEmit --pretty false`: pass
- `bun run lint`: pass, warnings only
- `bun run build`: pass, known Browserslist/chunk-size warnings only
- Targeted unit tests:
  - Secretaria tests
  - doc-gen tests
  - demo-operable tests
  - rule-engine constitution/voting/snapshot/completeness/resolution tests
  - Platform readiness contract test
  - Result: focused unit suites green at time of execution
- AIMS-GRC P0 unit contracts:
  - `src/lib/grc/__tests__/dashboard-readiness.test.ts`: pass
  - `src/lib/aims/__tests__/readiness.test.ts`: pass
  - `src/lib/arga-console/__tests__/platform-readiness.test.ts`: pass
  - Combined result: 11/11 pass
- E2E isolated:
  - `e2e/14-secretaria-documentos.spec.ts`: pass
  - `e2e/16-sanitization-smoke.spec.ts`: pass
  - `e2e/17-secretaria-template-context.spec.ts`: pass
  - `e2e/15-demo-operable.spec.ts`: pass
  - `e2e/10-grc.spec.ts` + `e2e/16-sanitization-smoke.spec.ts` together on
    `PLAYWRIGHT_PORT=5189`: pass, 11/11
- E2E combined run:
  - Mixed result due shared auth-state race.
  - Classification: Playwright harness/concurrency, not product or Supabase
    contract failure.

## Data Contract

- Tables used: existing app and smoke-test surfaces only; no direct SQL changes
  were applied by this diagnostic.
- Source of truth: Cloud
- Migration required: no
- Types affected: no
- RLS/RPC/storage affected: no
- Cross-module contracts: none written in this diagnostic
- Local contract registry: `consoleDataContracts` is the source for the
  readiness-lane contract IDs; no database contract table is introduced
- AIMS-GRC P0 readiness:
  - GRC local contract: `src/lib/grc/dashboard-readiness.ts`
  - GRC connected routes tracked: 21 frontend routes/surfaces
  - GRC backlog not connected: TPRM, penal/anticorrupción
  - AIMS local contract: `src/lib/aims/readiness.ts`
  - Tables newly introduced: none
  - Mutations introduced: none
  - Evidence posture: operational/demo only, not final productive evidence
- Parity risk: low for current verified flows; medium for future writes to
  `governance_module_events` / `governance_module_links` until covered by a
  separate probes-first packet

## Next Safe Packet

Recommended next work under `no_schema`:

1. Continue Secretaria UX completion and golden-path browser checks.
2. Keep generated documents labelled as operational/demo evidence unless the
   full final-evidence contract is explicitly approved.
3. If cross-module writes are needed, prepare a probes-only packet for
   `governance_module_events` and `governance_module_links` before any
   migration proposal.
4. If a real demo data gap appears, prepare a `data_only_backfill` packet with
   idempotent SQL and owner approval.

## Secretaria P0 Rule-Pack Readiness Addendum

The first P0 rule-pack thaw check is now executable in code without touching
schema or writing to Cloud:

- Pure contract: `src/lib/secretaria/p0-controlled-thaw.ts`
- Unit coverage:
  `src/lib/secretaria/__tests__/p0-controlled-thaw.test.ts`
- Rule resolver hardening:
  `src/lib/rules-engine/rule-resolution.ts` now treats the versioned payload as
  authoritative for `materia`, `clase` and `organoTipo` when it conflicts with
  the `rule_packs` catalog row, and records a warning.

Cloud read-only probe on 2026-04-30 found:

1. `DELEGACION_FACULTADES`, `DIVIDENDO_A_CUENTA`,
   `OPERACION_VINCULADA` and `AUTORIZACION_GARANTIA` exist as `ACTIVE` with
   `payload_hash`.
2. The P0 target is now canonicalized as `AUTORIZACION_GARANTIA`.
   `GARANTIA_PRESTAMO` remains an accepted legacy alias; if Cloud only provides
   the legacy ID, the code treats readiness as ready with warning, not as a
   silent equivalence.
3. Some packs have multiple `ACTIVE` versions. The resolver selects the latest
   semver and emits a warning. This is acceptable for prototype continuity but
   must be cleaned before removing fallbacks.
4. `AUTORIZACION_GARANTIA` has a catalog/payload scope discrepancy in Cloud:
   the catalog reports `JUNTA_GENERAL` while the v1.1.0 payload models
   `CONSEJO`. The versioned payload now wins locally because it is the legal
   snapshot actually evaluated.

This cut does not retire any fallback by itself. It only makes the P0 package
measurable and prevents a stale catalog row from misrouting the guarantee pack.

Additional data contract:

- Tables read by probe/code path: `rule_pack_versions`, `rule_packs`.
- Tables written: none.
- Source of truth: Cloud.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none.
- Parity risk: medium until duplicate active versions are cleaned and Cloud
  template/legal-approval gaps are closed.

## Secretaria Closeout Phase 0 Addendum

The 2026-05-01 no-schema closure cut is documented in
`docs/superpowers/plans/2026-05-01-secretaria-closeout-plan.md`.

- `AUTORIZACION_GARANTIA` is the canonical P0 rule-pack target.
- `GARANTIA_PRESTAMO` is a legacy alias accepted with warning.
- `ACTA_DECISION_CONJUNTA` is routed to `acuerdo_sin_sesion` for
  `CO_APROBACION`.
- `ACTA_ORGANO_ADMIN` is routed to `acuerdo_sin_sesion` for `SOLIDARIO`.
- No schema, generated types, RLS/RPC/storage or Supabase writes are introduced.

## Secretaria Double-Evaluation Addendum

The first double-evaluation cut is active without schema changes:

- Pure contract: `src/lib/secretaria/dual-evaluation.ts`.
- Convocatorias:
  - V1 legacy notice-period check remains the effective operational reminder.
  - V2 Cloud rule pack supplies required days, channels, documents and explain.
  - `rule_trace.dual_evaluation` and
    `reminders_trace.notice_period.dual_evaluation` store the comparison in the
    existing `convocatorias` traces.
- Reuniones:
  - Operational result keeps the current prototype path, including technical
    fallback when Cloud lacks a compatible rule pack.
  - V2 strict result is calculated with Cloud rule packs only.
  - Each `meetings.quorum_data.point_snapshots[*].dual_evaluation` records
    convergence/divergence without changing proclamation behavior.

This is a measurement lane. Divergence is a warning and review signal, not a
blocking gate. Fallback retirement still requires the five criteria in the data
contract.

Additional data contract:

- Tables read: `rule_packs`, `rule_pack_versions`,
  `rule_param_overrides`, meeting/convocatoria owner records already used by
  the steppers.
- Tables written: existing JSON surfaces only:
  `convocatorias.rule_trace`, `convocatorias.reminders_trace`,
  `meetings.quorum_data`.
- Source of truth: Cloud for V2; V1 remains operational fallback until removed.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none.
- Parity risk: medium; divergence data is operational telemetry, not final
  evidence and not a legal approval record.

## Documentation and Memory

- Project docs updated: this diagnostic note, linked from the control lane and
  sanitization master plan.
- Memory keys:
  - `patterns/secretaria-controlled-thaw-p0-no-schema`
  - `patterns/2026-04-30-aims-grc-p0-readiness-no-schema`
- Stable lesson recorded: current smokes do not require schema movement; run
  shared-auth Playwright suites sequentially or with isolated storage state.
- No secrets stored: yes
