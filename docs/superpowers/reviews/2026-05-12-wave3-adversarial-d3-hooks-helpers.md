# Wave 3 Adversarial Review — D3 Hooks + Helpers UI

**Reviewer:** Adversarial Reviewer Agent (claude-flow)
**Fecha:** 2026-05-12
**Branch revisada:** `feature/personas-cargos-refactor`
**Commits revisados (oldest→newest):**

- `2bd70b0` `feat(hooks): añade VICESECRETARIO a TipoCondicion + labels (L17)`
- `ca7bc0f` `feat(hooks): useRepresentanteAdminPJ + useUpsertRepresentanteAdminPJ`
- `7637157` `feat(secretaria): cargo-validation helpers UI con decisiones LSC`
- `356d4ca` `feat(hooks): useAsignarCargo + useCesarCargo (P1)`
- `af48005` `feat(secretaria): persona-filters.isProductionPerson`
- `ccf7c02` `feat(hooks): excludeTestData flag en usePersonasCanonical (default true)`

**Spec:** `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md`
**Plan:** `docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md` §D3
**Precedentes:**
- `docs/superpowers/reviews/2026-05-12-wave1-adversarial-d1-schema.md`
- `docs/superpowers/reviews/2026-05-12-wave2-adversarial-d2-consolidation.md`

---

## Verdict

**NEEDS-CHANGES**

Wave 3 produce código sustancialmente correcto en los 4 pilares de scope (helpers
de validación, mutaciones de cargo/representante, filtros producción, flag
`excludeTestData`). Builder A detectó el bug del plan (`CARGOS_CERTIFICANTES`
con `CONSEJERO_COORDINADOR`) y lo corrigió por iniciativa propia — buen trabajo
adversarial preventivo, alineado con W1#6. Tests pasan (16/16, 0 fail, 52
asserts), typecheck pasa (`tsc -b`).

Sin embargo, **una crítica H bloquea merge** y dos críticas M deben documentarse
o cerrarse antes de Wave 4:

1. **[H] `useAuthorityEvidence.CargoCertificante` SIGUE INCLUYENDO
   `CONSEJERO_COORDINADOR`** — drift BD↔frontend reintroducido. El trigger
   `fn_sync_authority_evidence` (post W1 fix `63a8639`) ya NO crea rows de AE
   para CONSEJERO_COORDINADOR, pero el tipo TS lo sigue aceptando como literal
   de cargo certificante válido. Builder B vio el archivo (commit 2bd70b0 lo
   menciona explícitamente) y decidió no tocarlo. **Era exactamente el alineamiento
   que el scope adversarial pedía.** Acción concreta abajo.

2. **[M] `DesignarAdminStepper.tsx` tiene `CARGOS_CERTIFICANTES` local con
   CONSEJERO_COORDINADOR y SIN VICESECRETARIO** — segunda fuente de verdad
   inconsistente con W1 fix y con cargo-validation.ts. No es scope D3 (el
   componente lo refactora D5), pero crear `cargo-validation.ts` como SSOT
   sin migrar este consumer congela el drift.

3. **[M] `useAsignarCargo` NO enforza `requiresRepresentative` para PJ admin**
   — diseño deliberado por L3 ("warning, no bloqueo"), pero el hook tampoco
   acepta una flag opcional para que la UI le pase el `person_type`. La
   responsabilidad queda 100% en el componente. Acceptable si se documenta;
   adversarialmente queda señalado.

Si se cierra la H#1 (5 líneas + tests opcionales), recomiendo **APPROVE**.

---

## Critical findings

### [H] `CargoCertificante` en `useAuthorityEvidence.ts` sigue incluyendo `CONSEJERO_COORDINADOR` — drift BD↔frontend

- **File:** `src/hooks/useAuthorityEvidence.ts:5-13` y `:149-158`.
- **Issue:**
  ```ts
  export type CargoCertificante =
    | "ADMIN_UNICO" | "ADMIN_SOLIDARIO" | "ADMIN_MANCOMUNADO"
    | "PRESIDENTE" | "VICEPRESIDENTE" | "SECRETARIO" | "VICESECRETARIO"
    | "CONSEJERO_COORDINADOR";   // ← debe eliminarse (L15)

  export const CARGO_CERT_LABELS: Record<CargoCertificante, string> = {
    // ...
    CONSEJERO_COORDINADOR: "Consejero coordinador",  // ← idem
  };
  ```
- **Contexto:** W1 commit `63a8639` removió `CONSEJERO_COORDINADOR` del array
  `v_cargos_certificantes` del trigger `fn_sync_authority_evidence` (migración
  000064) basado en decisión legal L15-L16 (RRM art. 109: el Consejero
  Coordinador NO certifica societariamente; LSC 529 septies sí lo habilita
  para coordinar). El cargo-validation.ts de Builder A LO EXCLUYE correctamente
  (líneas 98-106 + docstring en L142).
- **Pero:** Builder B en commit `2bd70b0` modificó `useCargos.ts` y revisó
  `useAuthorityEvidence.ts` ("useAuthorityEvidence ya incluía
  CargoCertificante.VICESECRETARIO" — el commit message lo dice). Vio el tipo
  y decidió no tocarlo. **No corrigió la coherencia BD↔UI.**
- **Risk:**
  - `useAuthorityEvidenceFor({ cargos: ["CONSEJERO_COORDINADOR"] })` es una
    llamada type-valid pero que SIEMPRE devuelve null/[] post-W1 (el trigger
    no crea AEs para ese cargo). Latent dead code path.
  - `useAgreementCompliance.ts:759` ejecuta
    `.in("cargo", [..., "CONSEJERO_COORDINADOR"])` que es siempre vacío;
    cualquier UI que muestre el `CARGO_CERT_LABELS.CONSEJERO_COORDINADOR`
    miente al usuario (expone un cargo que el sistema ya nunca certificará).
  - Frontend↔BD divergence reintroduce exactamente el bug que W1 cerró. Pasa
    QA si nadie filtra por ese cargo; explota si lo enseñamos a Garrigues como
    opción del selector.
- **Fix (5 líneas + alineación):**
  1. Eliminar `| "CONSEJERO_COORDINADOR"` de `CargoCertificante` (línea 13).
  2. Eliminar `CONSEJERO_COORDINADOR: "Consejero coordinador",` de
     `CARGO_CERT_LABELS` (línea 157).
  3. Eliminar `"CONSEJERO_COORDINADOR"` del array literal en
     `useAgreementCompliance.ts:759` (`.in("cargo", [...])`).
  4. Considerar marcar la línea con comentario `// L15: NO incluir
     CONSEJERO_COORDINADOR — coincide con v_cargos_certificantes del trigger
     (commit 63a8639)`.
  5. Test sugerido: añadir un caso en `cargo-validation.test.ts` o en un nuevo
     `useAuthorityEvidence.test.ts` que valide
     `expect<CargoCertificante>('CONSEJERO_COORDINADOR' as string).` con
     `// @ts-expect-error` para enforcear el tipo en CI.

### [M] `DesignarAdminStepper.tsx` mantiene `CARGOS_CERTIFICANTES` local desincronizado

- **File:** `src/pages/secretaria/DesignarAdminStepper.tsx:53-62`.
- **Issue:** El stepper define su propio array:
  ```ts
  const CARGOS_CERTIFICANTES: TipoCondicion[] = [
    "ADMIN_UNICO", "ADMIN_SOLIDARIO", "ADMIN_MANCOMUNADO",
    "PRESIDENTE", "VICEPRESIDENTE", "SECRETARIO",
    "CONSEJERO_COORDINADOR",  // ← out-of-date L15
  ];
  // VICESECRETARIO falta — out-of-date L17
  ```
  - Contiene `CONSEJERO_COORDINADOR` (W1 fix #6 lo eliminó del trigger).
  - **Omite `VICESECRETARIO`** (W1 fix #6 lo añadió al trigger; D3.3 lo añadió
    al `TipoCondicion` enum y al `CARGO_LABELS`).
  - Comentario `// G1.4: debe ir en sync con fn_sync_authority_evidence
    (migration 20260421_000024).` apunta a una migración pre-W1 y ya está
    desactualizado.
- **Risk:** El stepper enseña al usuario opciones de cargo certificante que el
  trigger ignorará. Demo Garrigues podría exponer "Consejero coordinador" como
  certificante y NO "Vicesecretario" — contradicción directa con el spec L15
  y L17.
- **Fix:** Importar `__CARGOS.CARGOS_CERTIFICANTES` de
  `@/lib/secretaria/cargo-validation` y eliminar la lista local. Tarea D5.x
  cubre el refactor del stepper — flagear ahí o sacar a un fix dedicado pre-D5.
- **No-bloqueante** porque es scope D5; pero un nuevo Wave 4/5 que toque el
  stepper SIN limpiar esto re-introduce el bug en otra capa.

### [M] `useAsignarCargo` no enforza `requiresRepresentative` ni recibe `person_type`

- **File:** `src/hooks/useCondicionesPersonaMutations.ts:36-95`.
- **Issue:** `AsignarCargoInput` no incluye `person_type`. El hook NO llama a
  `requiresRepresentative`. Si el caller pasa
  `tipo_condicion: 'ADMIN_UNICO'` para una persona PJ sin
  `representative_person_id`, el INSERT pasa, el trigger crea AE VIGENTE, y la
  persona aparece como Administrador único sin representante legal.
- **Risk:** Es la decisión legal L3 ("aceptable con warning en demo"). PERO:
  - La guarda visual debe vivir en el componente que llama al hook
    (`DesignarAdminStepper.tsx` o `RepresentanteAdminPJStepper.tsx` en D5).
  - El hook no puede ayudar al componente porque ni siquiera recibe
    `person_type` en su input.
  - Si en D5 el componente olvida la guarda, el dato malo llega a BD sin
    fricción.
- **Fix opcional (defensa profunda):** Añadir optional
  `actor_person_type?: 'PF'|'PJ'` a `AsignarCargoInput` y, si llega `'PJ'` y
  `requiresRepresentative({ person_type: 'PJ' }, tipo)` retorna true y
  `!input.representative_person_id`, lanzar warning (toast en lugar de
  bloqueo, según L3) o exigir un explicit `acceptMissingRepresentative: true`
  flag. **No bloqueante** pero documentar la asunción.

---

## Non-blocking notes

### [M] Builder A introduce nuevo tipo `TipoCondicionCargo` en vez de importar `TipoCondicion`

- **File:** `src/lib/secretaria/cargo-validation.ts:57-68`.
- **Plan dice (línea 1288):** `import type { TipoCondicion } from "@/hooks/useCargos";`.
- **Builder A hizo:** Declarar `TipoCondicionCargo` local con los mismos
  valores + docstring (líneas 50-55) que explica la duplicación intencional.
- **Risk:**
  - **Pro:** Evita acoplamiento `src/lib/*` ↔ `src/hooks/*`. `cargo-validation`
    queda como módulo puro sin dependencias React Query.
  - **Con:** Two-source-of-truth — añadir un cargo nuevo a BD requiere
    actualizar 3 lugares (`useCargos.TipoCondicion`,
    `cargo-validation.TipoCondicionCargo`,
    `useAuthorityEvidence.CargoCertificante` si aplica). Builder B en
    `useCondicionesPersonaMutations.ts:47` ya tuvo que castear
    `input.tipo_condicion as TipoCondicionCargo` — sintomático.
- **Aceptable** porque el comentario explícitamente nombra la dependencia
  ("ambos deben mantenerse sincronizados [...] mismo commit"). Adversarialmente
  preferiría un único `TipoCondicion` exportado desde `cargo-validation.ts` y
  re-exportado desde `useCargos.ts`, pero es refactor de arquitectura — fuera
  de scope.

### [M] `usePersonasEnriquecidas` filtra `persons` después del `Promise.all` (no antes)

- **File:** `src/hooks/usePersonasCanonical.ts:166-174`.
- **Issue:** Las queries paralelas `cargosQ` y `holdingsQ` no se filtran por
  `excludeTestData` — descargan los cargos/holdings de TODAS las personas del
  tenant incluyendo `[E2E REAL]`, `PENDIENTE-*`, `[ARCHIVED]`. Solo después
  del fetch se filtran las personas. El `Map<personId, cargos>` queda lleno
  de entries que nadie consultará.
- **Risk bajo:** Performance — sobrecarga de red. En demo ARGA con ~50
  personas el impacto es despreciable. Cuando se llene la BD productiva podría
  ser >1MB de datos descartados.
- **Fix opcional:** Si el filtro produce un set pequeño (≤30 IDs), añadir
  `.in("person_id", personsFiltered.map(p=>p.id))` a `cargosQ` y `holdingsQ`
  ANTES del Promise.all — pero esto rompe paralelismo (necesita esperar el
  primer fetch). Trade-off; aceptable como está.

### [L] `useCesarCargo` sobreescribe `metadata` en vez de hacer merge

- **File:** `src/hooks/useCondicionesPersonaMutations.ts:121-132`.
- **Issue:**
  ```ts
  if (input.razon) {
    update.metadata = {
      cese_razon: input.razon,
      cesado_at: new Date().toISOString(),
    };
  }
  ```
  Si el row tiene `metadata: {foo: 'bar'}` previo, el UPDATE lo reemplaza por
  `{cese_razon, cesado_at}` perdiendo `foo`. PostgREST no hace deep merge en
  JSONB UPDATE.
- **Risk:** Bajo hoy (los rows demo no tienen metadata significativo previo),
  pero histórico de un row CESADO que en el futuro acumule metadata se
  truncaría en cualquier re-cese (improbable, pero L14 dice que el cese
  conserva histórico). Sería más limpio usar
  `update.metadata = { ...row.metadata, cese_razon, cesado_at }` previo
  SELECT, o un `update` que aplique JSONB `||` operator vía RPC. Fuera de
  scope D3.

### [L] Tests no cubren caso `representative_person_id` ni invalidaciones

- **Issue:** No hay tests unitarios para `useCondicionesPersonaMutations.ts`
  ni para `useRepresentantesAdminPJ.ts` — ni mocks, ni MSW, ni schema probes.
- **Risk:** Los tests cubren los **helpers** (Builder A) pero no las
  **mutations** (Builder B). Si Builder B introdujo un bug de invalidación
  (e.g. typo en `composicionOrgano`), pasa typecheck silencioso.
- **Plan no exigía** estos tests explícitamente, pero el bloque `### Tests
  nuevos` del spec menciona unit + schema; las mutaciones son un agujero.
- **Recomendación:** Suite de tests de integración en D6 / E2E
  `e2e/20-personas-cargos-flow.spec.ts` cubrirá el happy path. No bloquea
  merge pero sí señala riesgo.

### [L] `RepresentanteAdminPJ` interface no incluye `scope` ni `tenant_id`

- **File:** `src/hooks/useRepresentantesAdminPJ.ts:5-13`.
- **Issue:** El select es parcial:
  `"id, represented_person_id, representative_person_id, entity_id,
  effective_from, effective_to, evidence"`. No incluye `scope` ni `tenant_id`
  ni `meeting_id` (que para `ADMIN_PJ_REPRESENTANTE` siempre es null pero el
  schema lo permite). El tipo interno es consistente con el select, pero
  cualquier consumer que quiera saber el `scope` o el `meeting_id` tiene que
  re-query.
- **Risk:** Bajo. Solo molesto si el consumer tiene que distinguir
  ADMIN_PJ_REPRESENTANTE de otros scopes en una misma vista (improbable —
  este hook ya filtra por scope).

### [L] `useUpsertRepresentanteAdminPJ` Phase 1 cierra TODAS las VIGENTES, no solo la del par

- **File:** `src/hooks/useRepresentantesAdminPJ.ts:75-83`.
- **Issue:** La UPDATE pre-INSERT usa filtros:
  ```ts
  .eq("represented_person_id", input.represented_person_id)
  .eq("entity_id", input.entity_id)
  .eq("scope", "ADMIN_PJ_REPRESENTANTE")
  .is("effective_to", null);
  ```
  Esto es CORRECTO para el caso típico (solo hay 0 o 1 vigente por
  `(represented, entity, scope)` gracias al UNIQUE `ux_representaciones_vigente`
  COALESCE(meeting_id)). Pero si por alguna razón aparece más de una vigente
  (data corruption), las cierra todas. No es bug — es el comportamiento
  defensivo correcto.
- **Nota:** Adversarialmente OK.

### [L] `evidence` JSONB sólo incluye rm_ref/rm_fecha — no source_doc

- **File:** `src/hooks/useRepresentantesAdminPJ.ts:85-88`.
- **Issue:** El plan/spec no pidió `source_doc`, pero AE en el modelo
  canónico suele guardar la referencia al documento que evidencia la
  designación. `representaciones.evidence` queda con solo
  `{rm_ref, rm_fecha}` — suficiente para certificación, pero pobre frente a
  auditor que pregunte "¿dónde está el documento?". Plan A' lo cubrirá.

### [L] Test `cargo-validation.test.ts` añade un test no presente en el plan

- **File:** `src/test/secretaria/cargo-validation.test.ts:48-52`.
- **Test añadido:**
  ```ts
  it("requiresRepresentative: person_type null does NOT require representante (defensive)", ...)
  ```
  Builder A previó el caso `person_type: null` (lo permite la BD: `PersonType
  | null` en el tipo). El test cubre el caso y la implementación
  `if (person.person_type !== "PJ") return false;` lo maneja explícitamente.
  Buena defensa.

---

## Confirmation matrix

| Item | Status | Nota |
|---|---|---|
| **Builder A — cargo-validation.ts** | | |
| `requiresBodyId(tipo)` true para CONSEJERO/PRESIDENTE/SECRETARIO/VICEPRESIDENTE/VICESECRETARIO/CONSEJERO_COORDINADOR | ✓ | L:1204-1211 plan ✓; lib L121-123 + test L10-17 |
| `requiresBodyId(tipo)` false para SOCIO/ADMIN_*/ADMIN_PJ | ✓ | lib L70-76 + test L19-25 |
| `requiresRepresentative({PJ}, ADMIN_UNICO)` = true | ✓ | lib L130-136 + test L27-34 |
| `requiresRepresentative({PJ}, SOCIO)` = false (L1) | ✓ | test L36-39 |
| `requiresRepresentative({PF}, anything)` = false | ✓ | test L41-46 |
| `isAuthorityRole` array NO incluye CONSEJERO_COORDINADOR | ✓ | lib L98-106 (CARGOS_CERTIFICANTES) + test L64-72 |
| `isAuthorityRole` array NO incluye CONSEJERO/SOCIO/ADMIN_PJ | ✓ | test L65-67 |
| Test caso `expect(isAuthorityRole('CONSEJERO_COORDINADOR')).toBe(false)` | ✓ | test L71 |
| **Builder A — persona-filters.ts** | | |
| `isProductionPerson` rechaza `[E2E REAL]`, `[ARCHIVED]`, `PRUEBA 1`, `PEDRO PRUEBA PRUEBA` | ✓ | lib L37-41 + test L33-78 |
| `isProductionPerson` rechaza tax_id `E2E-`, `PENDIENTE-`, `ARCHIVED-` | ✓ | lib L43-46 + test L43-87 |
| Tests cubren los 6 casos del plan | ✓ | 6 `it()` exactos |
| **Builder B — useCargos.ts** | | |
| `TipoCondicion` incluye `'VICESECRETARIO'` | ✓ | L15 |
| `CARGO_LABELS.VICESECRETARIO` = `'Vicesecretario'` | ✓ | L220 |
| `CARGOS_ORGANO_COLEGIADO` incluye VICESECRETARIO | ✓ | L82 |
| `CARGOS_ORGANO_COLEGIADO` NO incluye ADMIN_PJ | ✓ | L77-84 (solo los 6 colegiados) |
| Tests existentes (composicion) no rompen | ✓ | typecheck pasa, tests pasan |
| **Builder B — useAuthorityEvidence.ts** | | |
| `CargoCertificante` incluye VICESECRETARIO | ✓ | L12 |
| `CARGO_CERT_LABELS.VICESECRETARIO` defined | ✓ | L156 |
| CONSEJERO_COORDINADOR NO en CargoCertificante | **✗** | **L13: SIGUE PRESENTE (Critical H#1)** |
| CARGO_CERT_LABELS.CONSEJERO_COORDINADOR ausente | **✗** | **L157: SIGUE PRESENTE (Critical H#1)** |
| **Builder B — useCondicionesPersonaMutations.ts** | | |
| `useAsignarCargo` input tiene 9 campos del plan | ✓ | L10-20 (9 campos: person_id, entity_id, body_id, tipo_condicion, fecha_inicio, representative_person_id?, fuente_designacion, inscripcion_rm_referencia?, inscripcion_rm_fecha?) |
| `requiresBodyId` invocado ANTES del INSERT | ✓ | L47-57 |
| Error claro si body_id falta para cargo colegiado | ✓ | L49-51 |
| Error claro si body_id sobra para cargo no colegiado | ✓ | L53-56 |
| `onSuccess` invalida `["cargos", tenantId]` | ✓ | L86 |
| `onSuccess` invalida `["authority_evidence", tenantId]` | ✓ | L87 |
| `onSuccess` invalida `["personas_canonical", tenantId]` | ✓ | L88 |
| Invalidación composicionOrgano si body_id presente | ✓ | L89-93 |
| Query keys coinciden con useCargos.ts (prefix match TanStack v5) | ✓ | `["cargos", tenantId, ...]` matcheado por prefix |
| `useCesarCargo` UPDATE estado='CESADO' + fecha_fin (no DELETE, L14) | ✓ | L121-138 |
| Razón persistida en metadata | ✓ | L125-132 |
| **Builder B — useRepresentantesAdminPJ.ts** | | |
| `useRepresentanteAdminPJ` lee scope=ADMIN_PJ_REPRESENTANTE + effective_to NULL | ✓ | L37-38 |
| `useUpsertRepresentanteAdminPJ` cierra previa ANTES de insertar | ✓ | L75-83 → L90-103 (orden correcto) |
| Dual-write a `persons.representative_person_id` documentado | ✓ | L105-113 + comentario L59 |
| evidence JSONB incluye rm_ref + rm_fecha si vienen | ✓ | L85-88 |
| **Builder B — usePersonasCanonical.ts** | | |
| `usePersonasCanonical` acepta `excludeTestData` | ✓ | L64 |
| `usePersonasEnriquecidas` acepta `excludeTestData` | ✓ | L111 |
| Default true | ✓ | L67, L114 (`?? true`) |
| Aplica isProductionPerson post-query | ✓ | L88, L174 |
| `excludeTestData` en queryKey (separación cache filtered/unfiltered) | ✓ | L75, L124 |
| **Cross-builder coherence** | | |
| `requiresBodyId` (A) y `CARGOS_ORGANO_COLEGIADO` (B) coinciden | ✓ | Ambos: CONSEJERO, PRESIDENTE, VICEPRESIDENTE, SECRETARIO, VICESECRETARIO, CONSEJERO_COORDINADOR |
| `isAuthorityRole` (A) y `v_cargos_certificantes` trigger (W1) coinciden | ✓ | Ambos 7 cargos: ADMIN_UNICO/SOL/MANC + PRES/VICEPRES/SEC/VICESEC |
| `useAsignarCargo` (B) importa `requiresBodyId` de A | ✓ | L5-8 |
| `usePersonasCanonical` (B) importa `isProductionPerson` de A | ✓ | L4 |
| **TipoCondicion duplication** | ⚠ | A declara `TipoCondicionCargo` propio; B castea via `as TipoCondicionCargo`. Documentado pero subóptimo (M nota) |
| **Legal coherence L1-L23** | | |
| L1 (PJ socio no req rep) | ✓ | A test L36-39 |
| L2 (PJ admin sí req rep) | ✓ | A test L27-34; B no enforza pero acepta L3 deferral |
| L3 (PJ admin sin rep aceptable con warning) | ⚠ | B no enforza; UI debe hacer warning (M#3) |
| L14 (cese sin DELETE) | ✓ | B `useCesarCargo` UPDATE + razón |
| L15-L16 (CONSEJERO_COORDINADOR NO certifica) | ⚠ | A correcto; **B `useAuthorityEvidence.ts` SIGUE incluyéndolo (H#1)** |
| L17 (VICESECRETARIO certifica en suplencia) | ✓ | B `useCargos` + `useAuthorityEvidence` lo incluyen |
| L18 (COMISIONADO descartado) | ✓ | Nunca aparece en ninguna lista |
| L19 (tax_id unique BD-enforce) | ✓ | UNIQUE 000063 lo enforza; isProductionPerson filtra placeholders en UI |
| L22 (RM ref necesaria para certificar) | ✓ | `isAuthorityRoleInscribable` cubierto en helpers; el bloqueo duro lo aplica EmitirCertificacionButton (D5) |
| **TDD compliance** | | |
| `cargo-validation.test.ts` commiteado en el mismo commit que `.ts` | ✓ | commit 7637157 incluye ambos |
| `persona-filters.test.ts` commiteado con `persona-filters.ts` | ✓ | commit af48005 incluye ambos |
| Tests en `src/test/secretaria/`, no duplicados en `src/test/hooks/` | ✓ | Solo `cargo-validation.test.ts` y `persona-filters.test.ts` |
| `bun test src/test/secretaria/` pass | ✓ | 16 pass / 0 fail / 52 expects, 10ms |
| **Final state** | | |
| `bun run typecheck` pass | ✓ | `tsc -b` sin errores |
| `bun test src/test/secretaria/` 16/16 pass | ✓ | run completo OK |
| 6 commits Wave 3 commiteados (D3.1-D3.6) | ✓ | 2bd70b0, ca7bc0f, 7637157, 356d4ca, af48005, ccf7c02 |

**Resumen matriz:** 38 ✓ / 2 ✗ (críticos H) / 3 ⚠ (notas M).

---

## Recomendación operativa

**Builder B debe corregir la crítica H#1 antes de proceder a Wave 4 / D4:**

1. Editar `src/hooks/useAuthorityEvidence.ts`:
   - Línea 13: eliminar `| "CONSEJERO_COORDINADOR"` del tipo `CargoCertificante`.
   - Línea 157: eliminar la entry `CONSEJERO_COORDINADOR: "Consejero
     coordinador",` de `CARGO_CERT_LABELS`.
2. Editar `src/hooks/useAgreementCompliance.ts:759`:
   - Eliminar `"CONSEJERO_COORDINADOR"` del array de `.in("cargo", [...])`.
3. Re-typecheck para detectar callers que dependan del literal eliminado.
4. Commit con mensaje:
   ```
   fix(hooks): remove CONSEJERO_COORDINADOR from CargoCertificante (L15-L16)

   Alinea el tipo TS con v_cargos_certificantes del trigger (W1 fix #6,
   commit 63a8639). CONSEJERO_COORDINADOR es líder independiente del CdA
   (LSC 529 septies) pero NO certifica societariamente (RRM art. 109 reserva
   la certificación al Secretario con VºBº del Presidente).
   ```

**Notas M/L son aceptables para merge si:**

- Builder documenta H#3 (`useAsignarCargo` no enforza representante) como
  asunción explícita en el docstring (1 línea).
- M#2 (`DesignarAdminStepper` con `CARGOS_CERTIFICANTES` local) queda flagged
  en el plan de D5 con un TODO concreto.

**Verificación post-fix:**

```bash
cd /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map

# 1. Typecheck
bun run typecheck
# Esperado: 0 errores

# 2. Tests Wave 3
bun test src/test/secretaria/
# Esperado: 16/16 pass

# 3. Grep verifica que CONSEJERO_COORDINADOR ya no aparece en CargoCertificante
grep -n "CONSEJERO_COORDINADOR" src/hooks/useAuthorityEvidence.ts
# Esperado: 0 matches

grep -n "CONSEJERO_COORDINADOR" src/hooks/useAgreementCompliance.ts
# Esperado: 0 matches
```

---

## Patrón legal aplicado

- **L1 (PJ socio no requiere rep):** ✓ Cubierto en helpers + tests + spec.
- **L2 (PJ admin sí requiere rep):** ✓ Cubierto en helpers; UI debe enforce
  (D5). Hook no enforza (M#3 nota).
- **L3 (warning vs bloqueo):** ⚠ Helper devuelve true, UI debe decidir.
- **L14 (cese sin DELETE):** ✓ `useCesarCargo` UPDATE + razón en metadata.
- **L15-L16 (CC no certifica):** Builder A correcto; **Builder B incompleto
  (H#1).**
- **L17 (VICESECRETARIO):** ✓ Presente en 3 archivos.
- **L18 (COMISIONADO descartado):** ✓ Nunca aparece.
- **L19 (tax_id unique):** ✓ Filtro UI + UNIQUE BD.
- **L22 (RM ref obligatoria):** ✓ Helper `isAuthorityRoleInscribable` cubierto;
  bloqueo duro pendiente en EmitirCertificacionButton (D5).

---

## Patrón de revisión adversarial confirmado

- **Wave 1 fixes verificados:** W1#6 (`63a8639`) removió CONSEJERO_COORDINADOR
  del trigger. Builder A propagó correctamente al frontend
  (`cargo-validation.ts`). **Builder B no propagó al `CargoCertificante`** de
  `useAuthorityEvidence.ts` — H#1.
- **Wave 1 → Wave 3 handshake:** la crítica W1#6 explícitamente requería
  alineación frontend ↔ trigger. Builder B parcialmente cumplió: añadió
  VICESECRETARIO (correcto), pero no removió CONSEJERO_COORDINADOR
  (incompleto). Mismo file, mismo commit, sería 5 líneas más.
- **Plan vs ejecución:** Builder A detectó el bug del plan D3.1
  (`CARGOS_CERTIFICANTES` con CONSEJERO_COORDINADOR) y lo corrigió por
  iniciativa propia — comportamiento adversarial preventivo deseable.

---

## Probes y verificaciones ejecutadas durante este review

- `git log feature/personas-cargos-refactor --oneline -10`: 6 commits Wave 3
  confirmados (2bd70b0 → ccf7c02).
- `bun run typecheck`: `tsc -b` pasa sin errores.
- `bun test src/test/secretaria/`: 16 pass / 0 fail / 52 expects / 10ms.
- `bunx vitest run src/test/secretaria/ src/test/schema/canonical-model.test.ts
  src/test/schema/condiciones-persona-vicesecretario.test.ts`: 16 pass + 37
  skip (schema tests skipped sin admin client — esperado).
- `grep -rn CONSEJERO_COORDINADOR src/`: 17 ocurrencias en 6 archivos.
  Análisis detallado en H#1 y M#2.
- Probe a migration 000064 + `git show 63a8639`: confirma alineación BD
  esperada.
- Análisis cruzado de query keys TanStack v5 entre `useCargos`,
  `useAuthorityEvidence`, `usePersonasCanonical`, `useCondicionesPersonaMutations`
  y `useRepresentantesAdminPJ`: prefix match correcto.

---

🤖 Generated by Adversarial Reviewer Agent (claude-flow)
