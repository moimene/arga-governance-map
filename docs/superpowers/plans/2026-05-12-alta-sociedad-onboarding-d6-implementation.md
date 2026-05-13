# Alta de sociedad — Onboarding D6 implementation plan

> **For agentic workers:** use `superpowers:subagent-driven-development` or the closest available orchestration workflow when present. In this Codex session the exact `superpowers:writing-plans` skill was not installed, so this plan follows the existing `docs/superpowers/plans/*implementation.md` format.

**Fecha:** 2026-05-12
**Modulo:** Secretaria Societaria
**Branch de ejecucion:** `feature/alta-sociedad-onboarding-d6`
**Base:** `main` after PR #6 merge (`52341b6`) plus spec fix `0c6679b`
**Spec:** `docs/superpowers/specs/2026-05-12-alta-sociedad-onboarding-design.md`
**Carril paralelo:** `feature/personas-cargos-refactor`
**Demo objetivo:** Garrigues 19-23 mayo 2026

## Goal

Refactorizar `SociedadNuevaStepper` desde el alta minima actual de 4 pasos a un onboarding societario completo de 11 pasos. El resultado debe crear sociedades operativas para Secretaria: identidad legal, domicilio, CNAE, Registro Mercantil, capital, clases/series, cap table, organos, cargos iniciales, reglas societarias y referencias documentales.

La persistencia queda en el modelo D6 de la spec:

- Pasos 1-10: draft local con `useReducer`, sin escrituras a Supabase.
- Paso 11 TX1: RPC `fn_crear_sociedad_legal_y_capital`, atomica por excepcion, sin `BEGIN`/`COMMIT` transaccional explicito.
- Paso 11 TX2: adaptador client-side para `condiciones_persona` y `representaciones`.
- `onboarding_status`: default pesimista; solo se promueve a `OPERATIVA` tras TX2 completo y sin issues operativos.

## Non-negotiables

- Antes de tocar Supabase: `bun run db:check-target`.
- No `db push`, no regenerar tipos Supabase.
- La migracion `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` se escribe y se testea, pero Cloud la aplica el humano via MCP Supabase.
- No tocar estos archivos del carril Personas/Cargos: `usePersonasCanonical`, `useCargos`, `useAuthorityEvidence`, `useRepresentacionesCanonical`, `PersonaNuevaStepper`, `DesignarAdminStepper`.
- No escribir en `authority_evidence`; queda para trigger del carril Personas/Cargos.
- No escribir en `mandates`, `governance_module_events` ni `governance_module_links`.
- UX Garrigues: solo tokens `--g-*` y `--status-*`; no hex inline ni colores Tailwind nativos.
- Roles RPC correctos: `SECRETARIO` y `ADMIN_TENANT`, no codigos legacy.
- Web Crypto API si hiciera falta hashing; no `import crypto from "crypto"`.

## File Structure

### New files

```text
supabase/migrations/
  20260514_000067_fn_crear_sociedad_legal_y_capital.sql

src/lib/secretaria/sociedad-onboarding/
  types.ts
  defaults.ts
  validation.ts
  builders.ts
  adapters.ts
  catalog-loader.ts

src/lib/secretaria/sociedad-onboarding/__tests__/
  validation.test.ts
  builders.test.ts
  operability.test.ts
  adapters.test.ts

src/test/schema/
  fn-crear-sociedad-legal-y-capital.test.ts
  entities-legal-fields.test.ts

src/pages/secretaria/sociedad-nueva/
  StepIdentificacionLegal.tsx
  StepDomicilioCnaeRegistro.tsx
  StepPerfilGrupo.tsx
  StepCapital.tsx
  StepClasesSeries.tsx
  StepCapTable.tsx
  StepOrganos.tsx
  StepCargos.tsx
  StepReglas.tsx
  StepDocumentosSoporte.tsx
  StepRevisionCreacion.tsx
  shared/Field.tsx
  shared/NumberField.tsx
  shared/SelectField.tsx
  shared/CheckboxField.tsx
  shared/PersonaPicker.tsx
  shared/IssueList.tsx
```

### Modified files

```text
src/pages/secretaria/SociedadNuevaStepper.tsx
src/hooks/useSociedades.ts
src/pages/secretaria/SociedadDetalle.tsx
src/lib/doc-gen/variable-resolver.ts
```

`variable-resolver.ts` solo se toca si la verificacion D0 demuestra divergencia con los nombres de columnas de la spec.

## D0 — Pre-flight and Coordination

### D0.1 — Confirm branch, worktree, and PR state

**Files:** none.

- [ ] Verify current repo state:
  `git status --short --branch && git log --oneline -5`
- [ ] Confirm PR #6 is merged:
  `gh pr view 6 --json state,mergedAt,mergeCommit,baseRefName,headRefName`
- [ ] Confirm implementation branch:
  `git rev-parse --abbrev-ref HEAD` must be `feature/alta-sociedad-onboarding-d6`.
- [ ] Confirm branch is based on the latest remote implementation branch and includes `0c6679b`:
  `git log --oneline origin/main..HEAD`.
- [ ] Do not use the primary worktree while it is occupied by `feature/personas-cargos-refactor`; keep this worktree as the active implementation lane unless the user explicitly moves the branch.

**Exit:** clean worktree, branch ready, no untracked implementation files.

### D0.2 — Baseline verification before Supabase work

**Files:** none.

- [ ] Run `bun run db:check-target` before any DB probe.
- [ ] Inventory latest migration number:
  `rg --files supabase/migrations | sort | tail -40`.
- [ ] Confirm `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` does not collide. If it collides after merging Personas/Cargos, rename to the next free timestamped number and update tests.
- [ ] Inspect existing hardened RPC helpers in `20260504_000051` and `20260504193000_000052`:
  `fn_secretaria_assert_tenant_access`, `fn_secretaria_assert_role_allowed`, `fn_secretaria_is_service_role`.
- [ ] Inspect current generated DB type snapshots for table columns, but do not regenerate them.

**Exit:** D1 has exact helper names and no migration-number collision.

### D0.3 — Schema inventory probes

**Files:** none.

- [ ] After `db:check-target`, verify in Cloud that `entity_settings_catalog` exists and list active keys:
  `SELECT key, value_type, estado_catalog FROM entity_settings_catalog WHERE estado_catalog='ACTIVA' ORDER BY key;`
- [ ] Verify `fn_sync_authority_evidence` exists and whether it already syncs `SECRETARIO`/`PRESIDENTE` from `condiciones_persona`.
- [ ] Verify `representaciones` CHECK constraints for scopes. The onboarding plan may persist only `ADMIN_PJ_REPRESENTANTE`.
- [ ] Verify `condiciones_persona` has `fuente_designacion`, `representative_person_id`, `fecha_inicio`, and the current CHECK values.
- [ ] Verify whether Personas/Cargos migrations `000063`, `000064`, `000065` are already on Cloud before D6 work. If not, keep VICESECRETARIO optional/off in UI.

**Exit:** write a short note in the PR body or commit message with observed schema facts.

### D0.4 — Local baseline commands

**Files:** none.

- [ ] Run `bun run typecheck`.
- [ ] Run focused tests already related to Secretaria schema:
  `bun run test -- src/test/schema/rpcs-acta-cert.test.ts src/test/schema/secretaria-p0-transactional-rpcs.test.ts`.
- [ ] If baseline fails due unrelated carril changes, stop and document. Do not patch unrelated failures.

**Exit:** known baseline before implementation.

## D1 — Migration 000067 and Schema Tests

### D1.1 — Add legal fields to `entities`

**Files:**
- Create `supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql`
- Create `src/test/schema/entities-legal-fields.test.ts`

- [ ] Add nullable legal columns with `ALTER TABLE entities ADD COLUMN IF NOT EXISTS`.
- [ ] Implement `onboarding_status` in the safe order:
  add without default, backfill legacy rows to `OPERATIVA`, then set default `INCOMPLETA_CARGOS`.
- [ ] Add `support_docs_metadata jsonb NOT NULL DEFAULT '{}'::jsonb`.
- [ ] Add a CHECK for `onboarding_status IN ('OPERATIVA','INCOMPLETA_CARGOS','INCOMPLETA_DATOS','BORRADOR')`.
- [ ] Keep all other new fields nullable to avoid breaking legacy rows.
- [ ] Write a static schema test that reads the migration file and asserts add-without-default -> backfill -> set-default order.
- [ ] Write a Cloud/PostgREST probe test that skips cleanly until the human applies the migration, then checks the columns by selecting them from `entities`.

**Exit:** migration contains legal-field extension and tests describe the contract.

### D1.2 — Define RPC authorization contract

**Files:**
- Modify `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`
- Modify `src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts`

- [ ] Create `fn_crear_sociedad_legal_y_capital(p_tenant_id uuid, p_payload jsonb) RETURNS jsonb`.
- [ ] Use `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
- [ ] At the top of the function call:
  `PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);`
- [ ] Then call:
  `PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);`
- [ ] Add `GRANT EXECUTE ON FUNCTION fn_crear_sociedad_legal_y_capital(uuid, jsonb) TO authenticated;`.
- [ ] Static test must reject legacy codes `SECRETARIA_CORPORATIVA` and `ADMIN_SISTEMA`.

**Exit:** SECURITY DEFINER authorization is explicit and role-scoped.

### D1.3 — Implement RPC payload validation and TX1 inserts

**Files:**
- Modify `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`
- Modify `src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts`

- [ ] Validate required payload roots: `sociedad_pj`, `entity`, `capital_profile`, `share_classes`, `socios`, `capital_holdings`, `governing_bodies`.
- [ ] Reject `capital_desembolsado > capital_escriturado` with informative `RAISE EXCEPTION`.
- [ ] Reject duplicate NIF/CIF inside `socios` using normalized tax ids.
- [ ] Use lookup-first for every reusable `persons` insert:
  `SELECT id ... WHERE tenant_id = p_tenant_id AND tax_id = v_tax LIMIT 1`; insert only if not found.
- [ ] Insert in this order: PJ `persons`, `entities`, `entity_capital_profile`, `share_classes`, socios `persons`, `capital_holdings`, `governing_bodies`, `entity_settings`, `rule_param_overrides`.
- [ ] For autocartera, set `holder_person_id` to the society PJ `person_id`, `is_treasury=true`, and `voting_rights=false`.
- [ ] Filter `entity_settings` against `entity_settings_catalog`; return skipped keys in `settings_skipped`.
- [ ] Return JSON `{ entity_id, person_id, body_ids, share_class_ids, holding_ids, settings_skipped }`.

**Exit:** TX1 is atomic by exception and returns all IDs needed by TX2.

### D1.4 — Schema tests and handoff for human Cloud apply

**Files:**
- Modify `src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts`
- Modify `src/test/schema/entities-legal-fields.test.ts`

- [ ] Add static tests that the migration has no standalone transaction control statements inside the function body. PL/pgSQL `BEGIN ... END` blocks are allowed; SQL transaction `COMMIT`/`ROLLBACK` is not.
- [ ] Add RPC existence probe using Supabase RPC with dummy payload, accepting business errors but not "function does not exist".
- [ ] Add tests for tenant mismatch and forbidden role only if existing test helpers can authenticate as those roles; otherwise assert the migration invokes the helpers and document manual Cloud verification.
- [ ] Run:
  `bun run test -- src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts src/test/schema/entities-legal-fields.test.ts`.
- [ ] Commit D1 before any human applies Cloud SQL.
- [ ] Ask the human to apply migration via MCP Supabase after `bun run db:check-target` passes.

**Exit:** migration is committed, not automatically applied by Codex.

## D2 — Pure Domain Layer

### D2.1 — Types and draft model

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/types.ts`

- [ ] Define `TipoSocial`, `FormaAdministracion`, `TipoOrganoAdmin`, `OnboardingStatus`, `FuenteDesignacion`, and local `TipoCondicionOnboarding`.
- [ ] Define `SociedadOnboardingDraft` with 11 step slices: identification, registry/address, profile, capital, shareClasses, capTable, bodies, cargos, rules, supportDocs.
- [ ] Define `ValidationIssue` and `ValidationResult` exactly as in the spec.
- [ ] Define RPC payload types for `buildRpcPayload` and adapter context.
- [ ] Keep types local; do not edit generated Supabase types.

**Exit:** domain imports compile without touching UI.

### D2.2 — Defaults and derived values

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/defaults.ts`
- Modify tests in `__tests__/operability.test.ts`

- [ ] Implement `createEmptySociedadDraft(today?: string)`.
- [ ] Implement `applyTipoSocialDefaults`: SAU/SLU lock `es_unipersonal=true`; SA/SL allow false.
- [ ] Implement `deriveLegalForm`, `deriveTituloTipo`, `deriveNominalValue`, and `deriveJuntaName`.
- [ ] Implement conservative defaults: jurisdiction `ES`, currency `EUR`, duration `INDEFINIDA`, fiscal close `31-12`, source `ESCRITURA`.
- [ ] Unit-test SA/SL vs SAU/SLU derivations.

**Exit:** stepper can initialize a complete local draft.

### D2.3 — Validators

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/validation.ts`
- Create `src/lib/secretaria/sociedad-onboarding/__tests__/validation.test.ts`
- Create `src/lib/secretaria/sociedad-onboarding/__tests__/operability.test.ts`

- [ ] Implement validators S-001..S-006.
- [ ] Implement validators C-001..C-004 and CL-001..CL-002.
- [ ] Implement validators CT-001..CT-005 and P-001.
- [ ] Implement validators O-001..O-002, CA-001..CA-002, AU-001, PJ-001.
- [ ] Implement validators R-001..R-002.
- [ ] Return `BLOCK`, `BLOCK_OPERATIONAL`, and `WARN` severities with stable field paths.
- [ ] Implement `validateStep(draft, step)` and `validateSociedadOperability(draft)`.
- [ ] Unit tests must cover: SAU with two socios blocks; cap table > class titles blocks; PJ admin without representative blocks; PJ accionista without junta proxy warns only; stronger majority below simple blocks; incomplete address is operational issue.

**Exit:** validation is pure and fully testable without React/Supabase.

### D2.4 — Builders

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/builders.ts`
- Create `src/lib/secretaria/sociedad-onboarding/__tests__/builders.test.ts`

- [ ] Move and expand slug/body builders out of `SociedadNuevaStepper`.
- [ ] Implement `buildInitialBodies(draft, ids)` returning Junta/Socio Unico, admin body, Consejo body as needed, and optional comisiones.
- [ ] Implement `buildInitialCapitalStructure(draft)` for `entity_capital_profile` and `share_classes`.
- [ ] Implement `buildInitialCapTable(draft, tx1Ids)` mapping class code to IDs and autocartera to society PJ.
- [ ] Implement `buildEntitySettings(draft, catalogKeys)` and `buildRuleParamOverrides(draft)`.
- [ ] Implement `buildRpcPayload(draft, catalogKeys)` with initial `onboarding_status` never set to `OPERATIVA`.
- [ ] Tests assert no forced `ORD` class unless the user configured class code `ORD`.

**Exit:** D5 can call one builder to create TX1 payload.

### D2.5 — Catalog loader

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/catalog-loader.ts`

- [ ] Export `loadEntitySettingsCatalogKeys()` as an async helper over `supabase.from('entity_settings_catalog')`.
- [ ] Return `Set<string>` of active keys.
- [ ] Surface errors to caller; do not silently insert unknown settings.
- [ ] Unit-test with mocked Supabase or extract a pure `filterSettingsByCatalog` helper and test that.

**Exit:** unknown settings are skipped predictably.

## D3 — Stepper Orchestrator and Steps 1-5

### D3.1 — Shared Garrigues form components

**Files:**
- Create files under `src/pages/secretaria/sociedad-nueva/shared/`

- [ ] Create `Field`, `NumberField`, `SelectField`, `CheckboxField`, and `IssueList` with `forwardRef`.
- [ ] Ensure visible labels, `aria-invalid`, `aria-describedby`, `aria-busy` where applicable.
- [ ] Use only `text-[var(--g-*)]`, `bg-[var(--g-*)]`, `border-[var(--g-*)]`, and `text-[var(--status-*)]` patterns.
- [ ] No in-app explanatory text about how the app works; labels must be operational.

**Exit:** shared inputs pass visual/token review by grep.

### D3.2 — Refactor `SociedadNuevaStepper` shell

**Files:**
- Modify `src/pages/secretaria/SociedadNuevaStepper.tsx`

- [ ] Replace `useState<Draft>` with `useReducer` over `SociedadOnboardingDraft`.
- [ ] Replace inline 4-step components with imports from `src/pages/secretaria/sociedad-nueva/`.
- [ ] Implement 11-step metadata with compact responsive stepper.
- [ ] Enforce `next` via `validateStep`; show issues inline with `IssueList`.
- [ ] Keep route unchanged: `/secretaria/sociedades/nueva`.
- [ ] Keep `tenantLoading` guard for final creation.

**Exit:** app still compiles after the shell imports the concrete step files created in D3-D4.

### D3.3 — Step 1: Identificacion legal

**Files:**
- Create `StepIdentificacionLegal.tsx`

- [ ] Capture legal name, common name, tax id, tipo social, jurisdiction, constitution date, registration date.
- [ ] On type social change, call reducer action that applies SAU/SLU unipersonal lock.
- [ ] Show S-001..S-004 issues.
- [ ] Do not write Supabase.

**Exit:** step 1 state updates only local draft.

### D3.4 — Step 2: Domicilio, CNAE y Registro

**Files:**
- Create `StepDomicilioCnaeRegistro.tsx`

- [ ] Capture address fields, CNAE primary/secondary, Registro Mercantil split fields, LEI, corporate purpose, duration, fiscal year close, website, corporate email.
- [ ] Maintain denormalized `address` in builder, not manually duplicated in every input action.
- [ ] Show S-005/S-006 as operational blockers.
- [ ] Validate fiscal close format in D4/D2 validator.

**Exit:** draft has all legal fields required by migration.

### D3.5 — Step 3: Perfil societario y grupo

**Files:**
- Create `StepPerfilGrupo.tsx`

- [ ] Capture forma admin, cotizada, regulated sector, group role, parent entity, ownership percentage.
- [ ] Use existing `useSociedades()` read-only for parent selector.
- [ ] Lock unipersonal when tipo social is SAU/SLU; for SA/SL let cap table issue CT-005 handle mismatch.
- [ ] Preserve DL-2 policy: cotizada allowed with warning, not blocked.

**Exit:** profile state is complete and read-only data comes from existing hooks.

### D3.6 — Steps 4-5: Capital and classes/series

**Files:**
- Create `StepCapital.tsx`
- Create `StepClasesSeries.tsx`

- [ ] Step 4 captures currency, capital subscribed, capital paid, total titles, nominal value, title type.
- [ ] Nominal value auto-calculates but stays editable.
- [ ] Step 5 manages 1..N classes with class code, name, votes/title, economic rights coeff, voting rights, veto rights, restrictions metadata, and number of titles for validation.
- [ ] No forced class creation; draft must reflect user choices.
- [ ] Show C-001..C-004 and CL-001..CL-002 issues.

**Exit:** capital and classes can build TX1 payload without hidden defaults.

## D4 — Steps 6-11 and Shared Pickers

### D4.1 — PersonaPicker

**Files:**
- Create `src/pages/secretaria/sociedad-nueva/shared/PersonaPicker.tsx`

- [ ] Consume `usePersonasCanonical` read-only; do not modify it.
- [ ] Support selecting existing PF/PJ by name/tax id.
- [ ] Support local "new person" entries in the draft without persisting.
- [ ] Surface duplicate tax id as selection/reuse, not new write.
- [ ] For PJ admin, require nested representative PF draft.

**Exit:** user can prepare persons locally for socios/cargos; no DB writes before step 11.

### D4.2 — Step 6: Cap table inicial

**Files:**
- Create `StepCapTable.tsx`

- [ ] Manage socios PF/PJ, share class, title count, derived capital %, voting rights, treasury flag.
- [ ] For treasury rows, display that holder will be the society PJ.
- [ ] PJ accionista representative is a warning-only data point; do not persist `JUNTA_PROXY` in onboarding.
- [ ] Show CT-001..CT-005 and P-001.

**Exit:** cap table computes 100% and class limits deterministically.

### D4.3 — Step 7: Organos sociales

**Files:**
- Create `StepOrganos.tsx`

- [ ] Auto-create Junta General or Socio Unico from unipersonal status.
- [ ] Configure admin body from selected forma admin.
- [ ] For Consejo, capture min/max consejeros and optional comisiones.
- [ ] Show O-001/O-002.

**Exit:** builder can create all required `governing_bodies` and return body keys for TX2.

### D4.4 — Step 8: Cargos iniciales

**Files:**
- Create `StepCargos.tsx`

- [ ] For Consejo, capture presidente, secretario, optional vicepresidente, optional coordinador independiente, and consejeros.
- [ ] Hide or mark vicesecretario unavailable until Personas/Cargos `000065` is in main/Cloud.
- [ ] For non-collegiate admin, capture ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, or ADMIN_PJ rows with source and start date.
- [ ] For `ADMIN_PJ`, require permanent PF representative.
- [ ] Show CA-001, CA-002, AU-001, PJ-001.

**Exit:** draft has all inputs needed by `persistInitialCargos` and `persistInitialRepresentaciones`.

### D4.5 — Steps 9-10: Rules and support docs

**Files:**
- Create `StepReglas.tsx`
- Create `StepDocumentosSoporte.tsx`

- [ ] Capture quorum overrides, reinforced majorities, notice rules, casting vote, transfer restrictions, and fiscal close.
- [ ] Validate majority coherence with R-001/R-002.
- [ ] Capture support doc metadata only: `{ uri, sha512, nombre, tipo }`.
- [ ] Do not upload files or create `evidence_bundles` in this sprint.

**Exit:** rules feed `entity_settings`/`rule_param_overrides`; docs feed `entities.support_docs_metadata`.

### D4.6 — Step 11: Revision and creation UI

**Files:**
- Create `StepRevisionCreacion.tsx`
- Modify `SociedadNuevaStepper.tsx`

- [ ] Re-run `validateSociedadOperability(draft)` on render and before submit.
- [ ] Show projected status: `OPERATIVA`, `INCOMPLETA_CARGOS`, or `INCOMPLETA_DATOS`.
- [ ] Disable create if any `BLOCK` issue exists.
- [ ] Allow create with `BLOCK_OPERATIONAL`, but project `INCOMPLETA_DATOS`.
- [ ] Keep final save function in orchestrator, not in child step.

**Exit:** UI can drive TX1/TX2 in D5-D6.

## D5 — TX1 Wiring and Detail Views

### D5.1 — Call RPC from Step 11

**Files:**
- Modify `SociedadNuevaStepper.tsx`
- Modify `StepRevisionCreacion.tsx`

- [ ] Load catalog keys with `loadEntitySettingsCatalogKeys()`.
- [ ] Build payload with `buildRpcPayload(draft, catalogKeys)`.
- [ ] Call `supabase.rpc('fn_crear_sociedad_legal_y_capital', { p_tenant_id: tenantId, p_payload })`.
- [ ] On TX1 error, show toast and do not run TX2.
- [ ] On TX1 success, keep returned `entity_id`, `person_id`, `body_ids`, `share_class_ids`, `settings_skipped`.
- [ ] Invalidate `sociedades`, `entities`, `governing_bodies`, `entity_capital_profile`, `share_classes`, and `capital_holdings` after success.

**Exit:** TX1 is wired, but TX2 can still be temporarily no-op until D6.

### D5.2 — Extend `useSociedades`

**Files:**
- Modify `src/hooks/useSociedades.ts`

- [ ] Extend `SociedadRow` and `SociedadDetailRow` with new nullable legal fields.
- [ ] Keep list query `select("*")`; cast at boundary per project pattern.
- [ ] Add `onboarding_status` to row type.
- [ ] Do not add generated Supabase type imports.

**Exit:** detail/list pages can access legal fields without type errors.

### D5.3 — Show legal fields in `SociedadDetalle`

**Files:**
- Modify `src/pages/secretaria/SociedadDetalle.tsx`

- [ ] Add profile fields for RM split data, LEI, CNAE, domicilio, purpose, fiscal close, website, email, group role, and onboarding status.
- [ ] Use status chip tokens only.
- [ ] Add banner for `INCOMPLETA_CARGOS` and `INCOMPLETA_DATOS` with links to existing remediation routes.
- [ ] Do not create new routes.

**Exit:** acceptance criterion 12 is visible in UI.

### D5.4 — TX1 tests

**Files:**
- Modify `builders.test.ts`
- Modify `fn-crear-sociedad-legal-y-capital.test.ts`

- [ ] Add builder tests for payload field names matching migration.
- [ ] Add test that `buildRpcPayload` never emits `OPERATIVA`.
- [ ] Add RPC existence probe that passes after human applies migration.
- [ ] If Cloud migration is not applied yet, mark Cloud test with existing skip pattern and keep static tests active.

**Exit:** TX1 contract covered without requiring unsafe DB mutation in normal test run.

## D6 — TX2 Adapters and Derived Onboarding Status

### D6.1 — Implement `adapters.ts`

**Files:**
- Create `src/lib/secretaria/sociedad-onboarding/adapters.ts`
- Create `src/lib/secretaria/sociedad-onboarding/__tests__/adapters.test.ts`

- [ ] Implement `resolvePersonByTaxIdOrCreate` lookup-first over `persons`.
- [ ] Implement `persistInitialCargos(ctx, cargos)`.
- [ ] Map body keys: `null` for `ADMIN_*`/`SOCIO`, Consejo body for `CONSEJERO`/`PRESIDENTE`/`SECRETARIO`/`VICEPRESIDENTE`/`CONSEJERO_COORDINADOR`.
- [ ] Insert `condiciones_persona` with `tipo_condicion`, `fecha_inicio`, `fuente_designacion`, `representative_person_id` only for `ADMIN_PJ`, and no explicit `estado` unless schema requires it.
- [ ] Implement `persistInitialRepresentaciones(ctx, reps)` with `scope='ADMIN_PJ_REPRESENTANTE'`, `effective_from`, `effective_to=null`, and JSONB `evidence`.
- [ ] Accumulate partial failures and return them; only catastrophic throws escape.
- [ ] Mock Supabase in tests to cover reuse existing person, insert new person, partial cargo failure, and ADMIN_PJ representative persistence.

**Exit:** TX2 writes are isolated behind one future-replaceable adapter.

### D6.2 — Orchestrate TX2 after TX1

**Files:**
- Modify `SociedadNuevaStepper.tsx`

- [ ] Build `AdapterContext` from TX1 returned IDs.
- [ ] Call `persistInitialCargos` then `persistInitialRepresentaciones`.
- [ ] Wrap all TX2 in try/catch so TX1-created society is not treated as lost.
- [ ] On catastrophic TX2 failure, toast warning and navigate to `/secretaria/sociedades/${entityId}`.
- [ ] On partial failure, keep `INCOMPLETA_CARGOS` and show count.
- [ ] Only if no failed cargos/reps and no `blockingOperational`, update `entities.onboarding_status='OPERATIVA'`.
- [ ] If promotion update fails, warn but do not retry automatically.

**Exit:** acceptance criteria 5, 6, and 7 are implemented.

### D6.3 — Authority evidence verification lane

**Files:** none unless tests reveal a local expectation mismatch.

- [ ] After Personas/Cargos trigger migration is present, manually create one test society through the UI and verify PRESIDENTE/SECRETARIO produce `authority_evidence`.
- [ ] If trigger is absent, keep society `INCOMPLETA_CARGOS` messaging honest and document dependency; do not write `authority_evidence` manually.
- [ ] Add a lightweight schema/readiness test only if it can avoid brittle Cloud fixture assumptions.

**Exit:** certification readiness is verified or explicitly blocked by carril dependency.

## D7 — QA, Review, and PR

### D7.1 — Static and unit verification

**Files:** none unless fixing bugs.

- [ ] Run `bun run typecheck`.
- [ ] Run focused unit/schema tests:
  `bun run test -- src/lib/secretaria/sociedad-onboarding src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts src/test/schema/entities-legal-fields.test.ts`.
- [ ] Run full test suite if focused tests pass:
  `bun run test`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] No new lint warnings beyond known baseline unless documented and justified.

**Exit:** local verification green or blocker documented.

### D7.2 — E2E and manual browser verification

**Files:**
- Create `e2e/21-secretaria-alta-sociedad-onboarding.spec.ts` if stable fixtures allow it.

- [ ] Add Playwright test for the happy path: cap table 100%, Consejo, presidente+secretario, projected `OPERATIVA`.
- [ ] Add Playwright test for SAU/SLU with two socios blocking at step 6.
- [ ] Add Playwright test for TX2 failure only if adapter can be mocked without contaminating Cloud.
- [ ] Start dev server with bun/Vite.
- [ ] Use Browser/in-app browser to verify desktop and mobile layouts for `/secretaria/sociedades/nueva`.
- [ ] Check no text overflow in step chips, buttons, issue banners, and tables.

**Exit:** browser smoke confirms UI is navigable and non-overlapping.

### D7.3 — Adversarial review checklist

**Files:** fixes only.

- [ ] Schema review: no transaction control inside PL/pgSQL function, role guard uses `SECRETARIO`/`ADMIN_TENANT`, default pesimista order correct.
- [ ] Data review: lookup-first for persons in TX1 and TX2, no `ON CONFLICT DO NOTHING RETURNING id`.
- [ ] Personas/Cargos boundary review: blocked hooks untouched.
- [ ] UX review: `rg "text-white|bg-amber|bg-green|#[0-9a-fA-F]{3,6}|var\\(--g-brand\\)|var\\(--g-status" src/pages/secretaria/sociedad-nueva src/pages/secretaria/SociedadNuevaStepper.tsx` returns no violations.
- [ ] Failure-path review: TX1 failure stops, TX2 failure navigates to created society, promotion failure leaves conservative status.
- [ ] Acceptance criteria 1-19 from the spec explicitly checked in PR body.

**Exit:** no known P0/P1 issues before PR.

### D7.4 — Commit and PR sequence

**Files:** all changed files.

- [ ] Commit by phase, not one giant commit:
  D1 schema, D2 domain, D3-D4 UI, D5 TX1, D6 TX2, D7 QA fixes.
- [ ] Push branch:
  `git push -u origin feature/alta-sociedad-onboarding-d6`.
- [ ] Open PR against `main` with sections: Summary, Supabase migration handoff, Tests run, Manual QA, Personas/Cargos dependency, Acceptance checklist.
- [ ] Do not mark ready for merge until Cloud migration has been applied by the human and schema probes pass.

**Exit:** PR is reviewable, with migration apply instructions separated from code.

## Estimated Timeline

| Phase | Scope | Estimate |
|---|---|---:|
| D0 | Pre-flight and coordination | 0.25d |
| D1 | Migration + schema tests | 0.5d |
| D2 | Pure domain + tests | 1.0d |
| D3 | Shell + steps 1-5 | 0.75d |
| D4 | Steps 6-11 + shared pickers | 0.75d |
| D5 | TX1 wiring + detail views | 0.5d |
| D6 | TX2 adapters + status derivation | 0.5d |
| D7 | QA + adversarial review + PR | 0.5d |
| **Total** | | **4.75d** |

## Definition of Done

- 11-step onboarding implemented and navigable.
- Steps 1-10 have zero Supabase writes.
- TX1 creates legal/capital structure via RPC.
- TX2 persists cargos and ADMIN_PJ representations via adapter.
- Conservative `onboarding_status` behavior works in success, incomplete data, partial TX2, and catastrophic TX2 cases.
- Legal fields are visible in `SociedadDetalle`.
- No duplicate persons by NIF/CIF due lookup-first pattern.
- No writes to blocked tables or blocked Personas/Cargos files.
- Typecheck, focused tests, full tests, lint, build, and browser smoke completed or blockers documented.
