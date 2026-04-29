# 2026-04-29 — Demo-Operable M5 Persistence Decision

## Status

Decision record for the post-sprint gate after Demo-Operable Sprints 1-4.

This is a non-destructive closure. It does not apply schema changes, migrations, RLS changes, RPC changes, storage changes, generated type changes or Supabase Cloud writes.

## Decision

For commercial v1, Demo-Operable remains **fixtures-only and local/runtime deterministic**.

Cloud-backed `demo_mode` is deferred until a separate schema approval cycle validates Cloud/local migration parity, generated types, RLS, storage posture, evidence finality and QTSP server-side boundaries.

## Rationale

The demo is already commercially operable:

- Five canonical ARGA scenarios are deterministic.
- Presenter mode supports guided delivery with reset and scenario navigation.
- Evidence is explicitly sandbox/non-productiva.
- QTSP productive calls are blocked from the demo surface.
- E2E covers the main commercial path.

Persisting demo state now would add risk without improving the commercial objective. The highest-risk areas are evidence finality, legal hold, storage, audit posture, RLS, and generated type parity. Those must stay outside the commercial demo until approved.

## Scope Locked For Commercial V1

| Area | Decision | Reason |
|---|---|---|
| Scenario execution | Local deterministic runner | Stable demo, no Cloud writes, no dependency on partial parity. |
| Scenario data | Versioned ARGA fixtures | Reproducible and safe for sales/legal review. |
| Presenter mode | UI local state and route query `?presenter=1` | No persistence required for operator workflow. |
| Evidence | Sandbox stub, not final evidence | Avoid false legal finality before storage/hash/audit chain is complete. |
| QTSP | EAD Trust sandbox contract only; no productive browser call | `client_credentials` must remain server-side. |
| Secretaría handoff | Route handoff only outside presenter mode | Secretaría remains canonical owner. |
| GRC/AIMS | Future demo v2 integration by contract | Avoid creating a shell-owned supermodule. |

## Explicit No-Go Items

These remain blocked until separate approval:

- Add `demo_mode` columns to `tenants`, `convocatorias`, `meetings`, `agreements` or any other table.
- Add `sandbox` / `simulation_meta` columns to `evidence_bundles`.
- Apply or unblock `000049_grc_evidence_legal_hold`.
- Regenerate Supabase generated types.
- Add or modify RLS, RPC, storage buckets or Edge Functions for this demo.
- Write scenario executions to Supabase Cloud.
- Write `governance_module_links` or `governance_module_events` from Demo-Operable flows.
- Call EAD Trust productive APIs from the browser.
- Present sandbox bundles as final evidence.

## Future Architecture When Persistence Is Approved

### Target Shape

```text
ARGA Console
  -> POST /api/v1/demo/run-scenario
      -> server-side demo orchestrator
          -> Secretaría owner APIs/RPCs for legal objects
          -> Trust server proxy for EAD Trust sandbox/productive modes
          -> Evidence spine only after approved bundle/audit/storage contract
```

The shell continues to orchestrate and present. It must not become the owner of meetings, agreements, legal rules, signatures or evidence.

### API Decision

Preferred future form for `POST /api/v1/demo/run-scenario`: server-side backend or Edge Function with explicit ownership delegation.

Not approved for commercial v1:

- frontend direct Supabase writes;
- frontend direct EAD Trust `client_credentials`;
- local UI-only records that imitate canonical owner rows.

## Persistence Readiness Gates

| Gate | Requirement | Exit Criteria |
|---|---|---|
| G1 Target | Supabase target confirmed | `bun run db:check-target` passes against `governance_OS / hzqwefkwsxopwrmtksbg`. |
| G2 Contract | Data ownership matrix approved | Each field has owner, table, stable ID, consumers, mutation policy and evidence posture. |
| G3 Schema | Non-destructive migration RFC approved | Cloud/local migration diff reviewed; no destructive changes. |
| G4 Types | Generated types aligned | Types regenerated only after approved migration is applied. |
| G5 RLS | Policies reviewed | Demo rows cannot leak into production operations or cross-tenant views. |
| G6 Evidence | Evidence finality defined | Storage URI, hash chain, bundle manifest, audit log and retention/legal hold are coherent. |
| G7 QTSP | Server-side trust boundary approved | Productive EAD Trust calls run only through a server proxy with secrets outside frontend bundles. |
| G8 E2E | Commercial path remains deterministic | Current 5-scenario Playwright smoke stays green after persistence. |
| G9 Rollback | Disable path exists | Demo persistence can be disabled without data loss or production impact. |

## Data Ownership Matrix For Future Persistence

| Data | Canonical owner | Future source of truth | Mutated by shell? | Evidence posture |
|---|---|---|---:|---|
| Tenant demo flag | TGMS Core | `tenants.demo_mode` if approved | No | Configuration only |
| Scenario run | Demo orchestrator + owner modules | Future `demo_scenario_runs` only if approved, or audit event | No direct shell write | Operational trace, not legal evidence |
| Convocatoria | Secretaría | `convocatorias` | No | Formal only if owner flow creates it |
| Meeting/session | Secretaría | `meetings` | No | Formal only if owner flow creates it |
| Agreement result | Secretaría / Motor LSC | `agreements` plus owner rule trace | No | Depends on snapshot/gate/audit |
| Certification | Secretaría + Trust | `certifications` | No | Final only after QES/TSQ/evidence chain |
| Evidence bundle | Evidence spine | `evidence_bundles`, storage, `audit_log` | No | Final only after approved bundle/hash/storage/audit |
| Cross-module link | Shared platform | `governance_module_links` | Only via approved contract | Reference, not duplicate |
| Cross-module event | Shared platform | `governance_module_events` | Only via approved contract | Event trace |

## Cross-Module Position

GRC Compass and AIMS 360 remain outside the commercial v1 mutation path. Demo-Operable can explain how a Secretaría certification would become consumable evidence for GRC/AIMS, or how GRC/AIMS events would be linked in a future demo v2, but it must not create those links or events until the shared contracts are approved and verified.

The safe rule is:

```text
Commercial v1: explain cross-module journey, do not persist it.
Persisted v2: persist only through governance_module_links/events after contract + parity + RLS gates.
```

## Evidence Finality Position

Sandbox evidence is useful for commercial explanation, but it is not final evidence.

Final evidence requires, at minimum:

- canonical owner record;
- stable source ID;
- evidence bundle manifest;
- storage reference or approved equivalent;
- hash posture;
- audit log reference;
- retention/legal hold posture;
- QTSP metadata when applicable.

Until all of those are approved together, Demo-Operable must keep copy and data contracts aligned with `finalEvidence=false`.

## Implementation Backlog

### Phase M5-A — Closed Now

- Keep commercial demo fixtures-only.
- Keep presenter mode local and deterministic.
- Keep QTSP productive calls blocked from demo.
- Keep evidence copy as sandbox/non-productiva.
- Document persistence decision and approval gates.

### Phase M5-B — Design Only

- Draft migration RFC for `demo_mode` and evidence sandbox metadata.
- Draft server-side `run-scenario` orchestrator contract.
- Draft QTSP server proxy contract for EAD Trust sandbox/productive separation.
- Draft RLS isolation pattern for demo rows.
- Draft evidence finality matrix: sandbox stub vs verifiable bundle vs final evidence.

### Phase M5-C — Requires Explicit Approval

- Apply non-destructive migration.
- Regenerate generated types.
- Implement server-side scenario persistence.
- Implement approved evidence sandbox persistence.
- Wire GRC/AIMS cross-module demo v2 through `governance_module_links` and `governance_module_events`.

## Local Closure Adjustments

The M5 review also closed two local demo coherence risks without touching schema:

- `CONFLICTO_EXCLUSION_OK` now binds to the ARGA Seguros S.A. board fixture, so "consejero conflictuado" is coherent with a collegial body.
- Blocked scenarios now expose sandbox evidence as `SANDBOX_STUB` with `integrity=NOT_APPLICABLE` / `authority=NOT_APPLICABLE`, avoiding the impression that skipped certification/evidence is valid final evidence.

One compatibility item remains intentionally documented, not changed: the demo API field `why_adopted` is kept for the current contract even when the scenario is blocked. Before any Cloud-backed consumer uses this contract, it should be neutralized to `why` or split into `why_adopted` / `why_blocked`.

## Verification Baseline To Preserve

Current known-good baseline from Sprint 4:

- `bun run db:check-target`
- `bunx tsc --noEmit --pretty false`
- `bunx vitest run src/lib/demo-operable/__tests__/scenario-runner.test.ts --reporter=verbose`
- `bun run build`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list`

Any future persistence work must preserve or deliberately replace this baseline with stronger coverage.

## Verification Executed 2026-04-29

- `bun run db:check-target` — OK.
- `bunx tsc --noEmit --pretty false` — OK.
- `bunx vitest run src/lib/demo-operable/__tests__/scenario-runner.test.ts --reporter=verbose` — 10/10 OK.
- `bun run build` — OK, with existing Browserslist/chunk-size warnings.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list` — 7/7 OK.
- Grep focalizado: no real client name, no QTSP client secrets, no `db push` or type generation commands in touched demo/code docs. The only `000049` occurrence is the intentional HOLD/no-go statement.

## Final Position

Demo-Operable is complete for commercial v1.

The remaining work is not more demo UI. It is a controlled transition from deterministic demo to persisted prototype. That transition is blocked by design until schema, evidence, RLS, QTSP and generated type gates are explicitly approved.
