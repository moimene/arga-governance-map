# Sprint 1 Gestor de Plantillas — Follow-ups para Sprint 2

**Fecha:** 2026-05-12
**Sprint cerrado:** Commits `3076b45` → `473de0f`
**Origen:** Final adversarial code review post Sprint 1.
**Verdict:** APPROVED_WITH_FOLLOW_UP_TASK — Sprint 1 ships safely; estos issues no bloquean demo ni introducen deuda que compunda.
**Estado 2026-05-12:** F1–F7/F11/F12 quedan resueltos en el sprint técnico de cierre. F8 ya estaba cerrada como decisión de producto. Permanecen fuera de este documento: fixture Cloud `ADMIN_TENANT` para E2E happy path y corrección legal de las 2 plantillas P0 toleradas.

---

## Issues resueltos en Sprint 2 técnico (prioridad alta → baja)

### F1. `appendChangelog` sin filtro `tenant_id` en lookup
**Archivo:** [`src/lib/secretaria/template-admin/changelog.ts:63-68`](../../src/lib/secretaria/template-admin/changelog.ts)
**Severidad:** Important
**Problema:** La query de idempotencia filtra solo `plantilla_id` + substring `motivo`. Cross-tenant collision improbable (FNV-1a + plantilla_id scope), pero si RLS se afloja, return rows de cualquier tenant.
**Fix aplicado:** `.eq("tenant_id", entry.tenantId)` antes del lookup de idempotencia.

### F2. `appendChangelog` `.maybeSingle()` con substring `ilike`
**Archivo:** [`src/lib/secretaria/template-admin/changelog.ts:67-68`](../../src/lib/secretaria/template-admin/changelog.ts)
**Severidad:** Important
**Problema:** Si dos motivos contienen el mismo idemp key como substring (ej. otro comentario incluyendo `idemp:0a1b2c3d`), `.maybeSingle()` lanza por múltiples matches.
**Fix aplicado:** búsqueda por token con corchetes completo (`%[${idempotencyKey}]%`) y `.limit(1)`.

### F3. Rollback failure silenciado en `transitionTemplateState`
**Archivo:** [`src/lib/secretaria/template-admin/template-admin-service.ts:121-127`](../../src/lib/secretaria/template-admin/template-admin-service.ts)
**Severidad:** Important
**Problema:** Si `appendChangelog` throw y el revert UPDATE falla, función retorna `rolledBack: true` mintiendo. Plantilla queda en nuevo estado sin changelog.
**Fix aplicado:** revert UPDATE envuelto en `try/catch`; si falla, retorna `rolledBack: false` con `rollbackError`.

### F4. Schema inner `template` sin `.strict()`
**Archivo:** [`src/lib/secretaria/template-admin/template-import-schema.ts:268-302`](../../src/lib/secretaria/template-admin/template-import-schema.ts)
**Severidad:** Important
**Problema:** Solo el root tiene `.strict()`. Spec promete rechazo de `aprobada_por`, `fecha_aprobacion`, `estado`, `id`, `created_at`, `updated_at` etc. Poner cualquiera dentro de `template` pasa silenciosamente. `buildDraftRow` solo lee campos nombrados, así que no es exploitable hoy.
**Fix aplicado:** `.strict()` en el inner `template` object + regresión específica para metadata de fila dentro de `template`.

### F5. State matrix tests incompletos
**Archivo:** [`src/lib/secretaria/template-admin/__tests__/template-admin-service.test.ts`](../../src/lib/secretaria/template-admin/__tests__/template-admin-service.test.ts)
**Severidad:** Important
**Problema:** 8 cases de 36 posibles (6×6 transiciones). Falta: `DEPRECADA → ARCHIVADA`, `DEPRECADA → ACTIVA` (denied), `ACTIVA → ACTIVA` (denied), `ARCHIVADA → *` (todas denied). Sin integration test para rollback compensatorio.
**Fix aplicado:** matriz 6×6 completa + tests de rollback para `transitionTemplateState` y `createDraftFromImport`.

### F6. `JUNTA_GENERAL_O_CONSEJO` asimétrico entre Gate PRE y schema
**Archivos:** [`gate-pre.ts:27`](../../src/lib/secretaria/template-admin/gate-pre.ts) vs [`template-import-schema.ts:153`](../../src/lib/secretaria/template-admin/template-import-schema.ts)
**Severidad:** Important
**Problema:** Gate PRE acepta este organo via `EXTENDED_KNOWN_ORGANOS`, pero el schema del importer lo rechaza. Plantillas con este valor pasan Gate PRE pero no pueden re-importarse via wizard.
**Decisión 2026-05-12:** opción (a). Añadir `JUNTA_GENERAL_O_CONSEJO` al enum del schema con deprecation note. Mantener compatibilidad de import para la plantilla activa afectada (`ACTA_ACUERDO_ESCRITO` / acuerdo sin sesión) y normalizarla a dos variantes, una por órgano, cuando el Comité Legal firme la corrección.
**Fix aplicado:** `JUNTA_GENERAL_O_CONSEJO` aceptado como valor canónico deprecado en schema/Gate PRE + tests. La normalización futura queda como remediación legal, no bloqueo técnico.

### F7. `useImportPlantillaPackage` invalida queries en `{ok:false}`
**Archivo:** [`src/hooks/secretaria/useImportPlantillaPackage.ts:138-141`](../../src/hooks/secretaria/useImportPlantillaPackage.ts)
**Severidad:** Minor
**Problema:** `onSuccess` se dispara cuando `mutationFn` resuelve, incluso si `result.ok === false`. Wizard refetchea plantillas+changelog innecesariamente en `PARSE_FAILED` / `GATE_PRE_BLOCKING`.
**Fix aplicado:** `onSuccess` invalida cachés solo si `data.ok === true`.

### F8. Coexistencia `/secretaria/plantillas` con `/secretaria/gestor-plantillas`
**Archivo:** [`src/App.tsx:210, :215`](../../src/App.tsx)
**Severidad:** Product decision closed
**Problema:** El spec §4 mantiene dos experiencias intencionalmente (`/plantillas` = catálogo Secretario, `/gestor-plantillas` = consola admin). El reviewer cuestiona si esto es deseable.
**Decisión 2026-05-12:** mantener la dualidad como decisión definitiva. Las audiencias son distintas: Secretario funcional en `/secretaria/plantillas`, Legal Ops/admin en `/secretaria/gestor-plantillas`. Fusionarlas añadiría RBAC condicional y ruido operativo sin beneficio claro.
**Acción:** no redirigir `/secretaria/plantillas`. Mantener documentación de producto y navegación diferenciadas.

### F11. Separar preflight y commit del importador
**Archivos:** [`src/hooks/secretaria/useImportPlantillaPackage.ts`](../../src/hooks/secretaria/useImportPlantillaPackage.ts), [`src/components/secretaria/gestor/TemplateImportWizard.tsx`](../../src/components/secretaria/gestor/TemplateImportWizard.tsx)
**Severidad:** Important
**Problema:** Sprint 1 corrigió el bug de escritura prematura con `WARNINGS_NEED_ACK`, pero el hook sigue combinando parse, Gate PRE y creación del borrador en una sola mutación.
**Fix aplicado:** `useTemplatePreflight` read-only para step 3; `useImportPlantillaPackage` queda como commit explícito de step 5 y re-ejecuta preflight defensivo antes de escribir.

### F12. Idempotencia cross-run del import batch
**Archivo:** [`scripts/import-templates-batch.ts`](../../scripts/import-templates-batch.ts)
**Severidad:** Important
**Problema:** La idempotencia actual solo cubre changelog dentro de una misma ejecución. Re-ejecutar `--commit` puede insertar nuevas plantillas funcionalmente duplicadas porque cada run genera UUIDs nuevos.
**Fix aplicado:** detección funcional cross-run y dentro del mismo batch; plan marca `SKIP_DUPLICATE_FUNCTIONAL` antes de cualquier INSERT.

---

## Nits cosméticos (no requieren acción inmediata)

- `TemplateImportWizard.tsx:75` `setStep(3)` corría incluso con `parseError` — resuelto en Sprint 2 técnico.
- `gate-pre-semantic.ts:36-39` casts a tipo más estricto que el actual `Capa3FieldSchema` (que tiene `descripcion` optional). Type drift.
- `import-preflight.ts` conserva casts `as string` por `strictNullChecks: false`. Aceptable según política del proyecto.
- `CLAUDE.md:717` Commit 8 listado como `HEAD` en vez de `473de0f`. Refresca cuando se haga el siguiente cambio que toque la sección.
- `template-admin-service.ts:113-114` `STATE_CHANGE` siempre loguea `fromVersion === toVersion`; cosmético.
- `template-importer.ts:78` docstring sobre `tenantId` ligeramente engañoso re: batch import (TENANT_ID hardcoded en script).

---

## Strengths confirmados por el review (no revertir)

- Module structure clean: `template-admin/` self-contained library.
- Rollback compensatorio implementado correctamente en happy path (`transitionTemplateState`, `createDraftFromImport`).
- Idempotency key determinista y time-zone independent.
- Discriminated unions exhaustivos en `TransitionResult` y `ImportResult`.
- Garrigues token discipline 100% en todo `src/components/secretaria/gestor/` y `src/lib/secretaria/template-admin/`.
- Service-role boundary clean: `scripts/import-templates-batch.ts` aislado del bundle de browser.
- Backwards-compat preservada en `useUpdateEstadoPlantilla`.
- 0 regresiones nuevas: 1210 pass / 141 skip / 23 fail = baseline match pre-sprint.
- typecheck/lint/build green.

---

## Tracking

F1–F7/F11/F12 quedan cerrados. Para sprints posteriores solo arrastrar: fixture Cloud `ADMIN_TENANT` si se quiere activar el E2E happy path del wizard, normalización legal de `JUNTA_GENERAL_O_CONSEJO` a dos variantes por órgano, y las 2 plantillas P0 toleradas pendientes de Comité Legal.
