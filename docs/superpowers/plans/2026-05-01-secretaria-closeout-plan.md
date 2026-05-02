# 2026-05-01 — Secretaria Societaria closeout plan

## Purpose

Cerrar Secretaria como prototipo operativo completo, revisable por Legal, sin
mover schema ni retirar trazabilidad juridica mientras Cloud no cierre los gaps
de aprobacion formal.

## Guardrails

- No `db push`.
- No migraciones sin autorizacion explicita.
- No regeneracion de tipos Supabase sin autorizacion.
- No RLS/RPC/storage/policies salvo paquete aprobado.
- Antes de cualquier accion Supabase: `bun run db:check-target`.
- Cloud Supabase es fuente de verdad.
- Si falta schema, preparar propuesta no destructiva y parar.
- Documentos y bundles actuales son evidencia demo/operativa, no evidencia final productiva.

## Phase Plan

### Phase 0 — no-schema closure contracts

Actions:

- Canonicalizar P0 garantia/prestamo sobre `AUTORIZACION_GARANTIA`.
- Mantener `GARANTIA_PRESTAMO` como alias legacy aceptado con warning.
- Preparar enrutamiento de `ACTA_DECISION_CONJUNTA` para `CO_APROBACION`.
- Preparar enrutamiento de `ACTA_ORGANO_ADMIN` para `SOLIDARIO`.
- Cubrir con tests puros; no leer ni escribir Cloud.

Exit criteria:

- Tests focalizados de P0 thaw y matriz de plantillas verdes.
- Documentacion actualizada con la decision de nomenclatura y los huecos Cloud.

### Phase 1 — rule packs

Actions:

- Ejecutar probe read-only tras `db:check-target`.
- Inventariar divergencias V1/V2 en convocatorias y reuniones.
- Inventariar duplicados `ACTIVE` y payload/catalog mismatch.
- Mantener fallbacks si falta cualquiera de los 5 criterios de retirada.

Exit criteria:

- Lista de packs P0/P1/P2 con estado `READY`, `READY_WITH_WARNINGS` o `BLOCKED`.
- Propuesta no destructiva para limpiar duplicados `ACTIVE`, si siguen presentes.

### Phase 2 — templates

Actions:

- Completar matriz plantilla -> proceso -> variables -> fuente -> test.
- Separar Cloud `ACTIVA` de aprobacion legal formal.
- Identificar plantillas sin `aprobada_por`/`fecha_aprobacion`.
- Confirmar huecos Cloud de `ACTA_DECISION_CONJUNTA` y `ACTA_ORGANO_ADMIN`.

Exit criteria:

- Legal puede revisar por ruta y por materia sin confundir fixture con Cloud.
- Ningun fixture local se presenta como fuente de verdad.

### Phase 3 — meeting and voting

Actions:

- Revisar snapshot por punto: asistentes, capital/derechos, voto, conflictos,
  pactos, denominador y quorum.
- Verificar que la doble evaluacion V1/V2 queda registrada sin bloquear el
  prototipo.
- No aplanar pactos, estatutos, LSC ni warnings de cotizada.

Exit criteria:

- Cada punto tiene explicacion de validez societaria, pacto contractual y
  denominador computable.

### Phase 4 — Agreement 360

Actions:

- Revalidar `agreements.id` como identificador canonico.
- Cubrir origen desde convocatoria, reunion, campana, sin sesion y unipersonal.
- Revisar enlaces desde `meeting_resolutions.agreement_id` y documentos.

Exit criteria:

- No hay identificadores owner paralelos para el mismo acto societario.

### Phase 5 — UX legal route

Actions:

- Revisar modo Sociedad y modo Grupo.
- Revisar campanas de grupo.
- Revisar gestor documental y tramitador.
- Mantener tokens Garrigues `--g-*` y `--status-*`.

Exit criteria:

- Legal puede recorrer la ruta completa sin ver conceptos tecnicos como
  evidencia final productiva, WORM productivo o proveedor QTSP alternativo.

### Phase 6 — verification

Actions:

- `bun run db:check-target`
- Tests focalizados.
- `bunx tsc --noEmit --pretty false`
- `bun run build`
- E2E golden path en puerto aislado.

Exit criteria:

- Fallos clasificados como producto, datos, schema o harness.

## Phase 0 cut implemented

Files:

- `src/lib/secretaria/fallback-retirement-plan.ts`
- `src/lib/secretaria/__tests__/p0-controlled-thaw.test.ts`
- `src/lib/secretaria/template-process-matrix.ts`
- `src/lib/secretaria/__tests__/template-process-matrix.test.ts`

Decisions:

- `AUTORIZACION_GARANTIA` is the canonical P0 pack/matter for intragroup
  guarantees in the prototype.
- `GARANTIA_PRESTAMO` remains a legacy accepted alias. If Cloud only returns
  that ID, readiness is `READY_WITH_WARNINGS`.
- `ACTA_DECISION_CONJUNTA` routes to `acuerdo_sin_sesion` with adoption mode
  `CO_APROBACION`.
- `ACTA_ORGANO_ADMIN` routes to `acuerdo_sin_sesion` with adoption mode
  `SOLIDARIO`.

Data contract:

- Tables used: none in this cut.
- Source of truth: Cloud for future probes; local tests use pure fixtures.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none.
- Parity risk: medium until Cloud template rows and Legal approval metadata exist.

## Phase 1-3 cut implemented

Date: 2026-05-01.

Ruflo routing:

- `bun run agents:route -- "close Secretaria rule packs templates meeting voting package without schema writes"`
  routed the work to the Optimizer lane, low-confidence advisory only.
- `bun run agents:swarm:status` returned no active swarm. The cut stayed in the
  main workspace to avoid conflicts with a dirty worktree.

Read-only Cloud probe:

- Guard executed first: `bun run db:check-target` -> project `governance_OS`
  (`hzqwefkwsxopwrmtksbg`).
- Script: `scripts/probe-secretaria-closeout.ts`.
- Mode: authenticated read-only using the existing local session; no token is
  printed or stored.
- Write operations performed: false.

Probe findings:

- `rule_pack_versions`: 42 versions, all active rows observed with
  `payload_hash`.
- Duplicate `ACTIVE` hashed packs still present:
  `APROBACION_CUENTAS`, `AUMENTO_CAPITAL`, `REDUCCION_CAPITAL`,
  `DELEGACION_FACULTADES`, `OPERACION_VINCULADA`,
  `NOMBRAMIENTO_AUDITOR`, `AUTORIZACION_GARANTIA`, `RATIFICACION_ACTOS`.
- Catalog/payload mismatches observed:
  `SOCIEDAD_UNIPERSONAL` (`SOCIO_UNICO` vs payload `JUNTA_GENERAL`),
  `AUTORIZACION_GARANTIA` (`JUNTA_GENERAL` vs payload `CONSEJO`) and
  `NOMBRAMIENTO_CONSEJERO` (`NOMBRAMIENTO` vs payload
  `NOMBRAMIENTO_CONSEJERO`).
- P0 readiness:
  `DIVIDENDO_A_CUENTA` is `READY`; `DELEGACION_FACULTADES`,
  `OPERACION_VINCULADA` and `AUTORIZACION_GARANTIA` are
  `READY_WITH_WARNINGS` because duplicates or catalog/payload mismatches remain.
- `plantillas_protegidas`: 37 active templates observed; 25 active templates do
  not have formal approval metadata (`aprobada_por` + `fecha_aprobacion`).
- Missing Cloud-approved critical templates remain:
  `ACTA_DECISION_CONJUNTA` + `CO_APROBACION` and `ACTA_ORGANO_ADMIN` +
  `SOLIDARIO` both returned zero active approved rows.
- Dual evaluation: one stored comparison was found and it is divergent in a
  meeting point (`MEETING_ADOPTION`): operational V1 is OK while strict Cloud V2
  requires review.
- Meeting/voting: one adopted meeting resolution linked to an `agreement_id`
  has no `rule_evaluation_results` row yet; `meeting_attendees` also needs real
  attendee/capital data for productive voting scenarios.
- After rerunning the golden path E2E, the read-only probe still reports
  `ruleEvaluationRows = 0`. This is expected with the new guard: no WORM row is
  emitted while the point lacks complete `V2_CLOUD` trace data.

Code changes:

- Added `src/lib/rules-engine/rule-evaluation-persistence.ts` to build
  append-only `rule_evaluation_results` rows with `rule_pack_version_id`,
  `payload_hash`, `ruleset_snapshot_id` and deterministic `evaluation_hash`.
- Wired `ReunionStepper` to attach `rule_trace` per point:
  `V2_CLOUD` when Cloud resolution is complete, otherwise
  `PROTOTYPE_FALLBACK` with explicit missing-pack warning.
- Wired `useSaveMeetingResolutions` to insert `rule_evaluation_results` only
  when `agreement_id` and V2 Cloud trace are complete. Fallback snapshots are not
  persisted as WORM evidence.
- Added local, non-persisted legal fixtures for `ACTA_DECISION_CONJUNTA` and
  `ACTA_ORGANO_ADMIN`, and connected them to legal coverage as
  `fixture_pending_load`.

Non-destructive cleanup proposal:

1. For each duplicate active rule pack, choose the highest semver row with
   `payload_hash`, `approved_by` and `approved_at`.
2. Mark older active rows inactive/deprecated with `effective_to` instead of
   deleting them.
3. For catalog/payload conflicts, keep payload versioned as juridical runtime
   source until Legal approves catalog normalization.
4. For `AUTORIZACION_GARANTIA`, keep it canonical and record
   `GARANTIA_PRESTAMO` only as legacy alias.
5. Do not retire V1/fallback wrappers until all five retirement criteria in the
   fallback plan are satisfied.

Data contract:

- Tables used: read-only probe over `rule_pack_versions`,
  `plantillas_protegidas`, `convocatorias`, `meetings`,
  `rule_evaluation_results`, `meeting_resolutions`, `meeting_attendees`; future
  runtime writes may append to existing `rule_evaluation_results` only from
  already-supported meeting resolution save flow.
- Source of truth: Cloud; local fixtures are draft bridge only.
- Migration required: no for this cut.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: `agreements.id` remains canonical owner for WORM rule
  evaluation rows.
- Parity risk: medium-high until duplicate active packs, template approvals and
  real attendee/capital data are closed in Cloud.
