# Wave 2 Adversarial Review — D2 Consolidation Script

**Reviewer:** Adversarial Reviewer Agent (claude-flow)
**Fecha:** 2026-05-12
**Branch revisada:** `feature/personas-cargos-refactor`
**Commits revisados:**
- `03b9f6c` `feat(scripts): consolidate-duplicate-persons skeleton + 47-FK detector`
- `5cadc2f` `feat(scripts): consolidate-duplicate-persons applyConsolidation + soft archive`
- `a8d3fff` `feat(scripts): seed-demo-arga-canonico pre-check tax_id collision`

**Spec:** `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md`
**Plan:** `docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md` §D2
**Precedente Wave 1:** `docs/superpowers/reviews/2026-05-12-wave1-adversarial-d1-schema.md`

---

## Verdict

**NEEDS-CHANGES**

El builder hizo un trabajo sustancialmente correcto: corrigió las 3 críticas del review Wave 1 (lista FK expandida de 9 a 47, `meeting_attendees.person_id` correcto, `agreements.proponent_person_id` descartado, `entities.person_id` cubierto como bridge crítico, preflight con cargo/entities/holdings collisions, soft-archive idempotente, seed defensivo). Sin embargo hay **3 críticas H** que bloquean ejecución segura contra Cloud y **5 notas M/L** documentables.

Las críticas H caen en: (1) WORM-table updates van a fallar en silencio o ruidosamente al consolidar Cartera ARGA / ARGA Capital Inversiones; (2) falta preflight para colisiones en `representaciones` (`ux_representaciones_vigente`) y `authority_evidence` (`ux_authority_vigente`); (3) falta wrapping transaccional entre Fase 1 (migrate FKs) y Fase 3 (archive) — un fallo intermedio deja state inconsistente que solo el orphan check parcialmente atrapa.

---

## Critical findings (must fix)

### [H] WORM triggers van a bloquear UPDATEs en `no_session_*` y `capital_movements`

- **Files:** `scripts/consolidate-duplicate-persons.ts:210-221` (definición FK list para `no_session_notificaciones.person_id`, `no_session_respuestas.person_id`, `capital_movements.person_id`); `scripts/consolidate-duplicate-persons.ts:680-689` (loop applyConsolidation Phase 1 que las ejecuta como `migrate`).
- **Issue:** Tres tablas en la FK list tienen triggers WORM que **abortan cualquier UPDATE** con `RAISE EXCEPTION`:
  - `worm_no_session_notificaciones` → `worm_guard()` rechaza UPDATE/DELETE.
  - `worm_no_session_respuestas` → `worm_guard()` rechaza UPDATE/DELETE.
  - `trg_capital_movements_worm` → `fn_capital_movements_worm()` rechaza UPDATE/DELETE.
  - (Source: probe a `pg_trigger` el 2026-05-12).
- **Probe Cloud:** 16 rows en `no_session_notificaciones`, 23 en `no_session_respuestas`, 14 en `capital_movements`. **Cartera ARGA S.L.U. (B-99999902)** ya tiene 1 notificación + 1 respuesta. **ARGA Capital Inversiones SL (B12345679)** tiene 3 notificaciones + 3 respuestas. **9 personas E2E** tienen 1 `capital_movements` cada una.
- **Risk:** Cuando el script se ejecute contra cualquiera de estos personas como duplicada (escenario plausible en Tipo B Cartera ARGA pending → canonical, o futuros tests E2E que ensucian datos), el UPDATE de la primera FK WORM tirará excepción `WORM protection: UPDATE operations are not allowed on no_session_*`. **`applyConsolidation` lanza el error tal cual, sin rollback** — Phase 1 anterior ya migró otras FKs pero no archivó, dejando el duplicado parcialmente desconectado y sin archivar. El re-run pasa por el branch idempotente solo si ya está archivado, lo que NO ocurrió.
- **Fix:** Una de las tres:
  - **(a) Marcar las 3 FKs como `action: "skip"`** con justificación WORM. El soft-archive preserva la fila duplicada (no DELETE), así que las referencias históricas WORM siguen apuntando a una fila viva (solo con tax_id prefijado). El audit trail interno de las tablas WORM no se pierde. Esto es lo más coherente con el principio de WORM.
  - **(b) Bypass de WORM**: el script corre con service_role; cambiar `session_replication_role = replica` antes y revertir después. **Desaconsejado** — viola el contrato WORM y silencia el guard que protege auditoría.
  - **(c) Pre-flight detection**: si el duplicado tiene rows en tablas WORM, abortar con mensaje claro pidiendo decisión humana (consolidar manualmente con bypass o aceptar references históricas al archived).
  - **Recomendación adversarial:** opción (a) con docstring explicando que historia probatoria queda apuntando al row archivado.

### [H] Preflight no detecta colisiones en `representaciones` ni `authority_evidence`

- **Files:** `scripts/consolidate-duplicate-persons.ts:514-627` (función `preflightCheck`).
- **Issue:** El preflight cubre 3 UNIQUE constraints relevantes:
  - `ux_condicion_vigente` en `condiciones_persona(person_id, entity_id, COALESCE(body_id, ...), tipo_condicion)` ✓
  - `entities.person_id` (denormalised bridge) ✓
  - `ux_capital_holdings_vigente` en `capital_holdings(entity_id, holder_person_id, COALESCE(share_class_id, ...))` ✓
  - **NO** cubre `ux_representaciones_vigente` en `representaciones(entity_id, represented_person_id, scope, COALESCE(meeting_id, ...))`.
  - **NO** cubre `ux_authority_vigente` en `authority_evidence(tenant_id, entity_id, COALESCE(body_id, ...), person_id, cargo)`.
- **Risk:** Si tanto el canónico como el duplicado tienen una `representaciones` activa (`effective_to IS NULL`) para la misma `(entity_id, scope, meeting_id)` — o si ambos tienen `authority_evidence` VIGENTE para el mismo `(entity_id, body_id, cargo)` — el `migrateFk` falla con `23505` en mitad de Phase 1. Mismo problema que el caso WORM: state parcial sin rollback.
- **Probe Cloud:** Cartera ARGA S.L.U. tiene 2 holdings + 1 condicion + ya hay registros en `representaciones` (no consultado). Riesgo no nulo.
- **Fix:** Añadir dos checks adicionales al `preflightCheck`:
  ```ts
  // Check 5: representaciones collision
  const { data: dupReps } = await supabase.from("representaciones")
    .select("id, entity_id, scope, meeting_id")
    .eq("tenant_id", TENANT_ID)
    .or(`represented_person_id.eq.${pair.duplicate.id},representative_person_id.eq.${pair.duplicate.id}`)
    .is("effective_to", null);
  for (const dr of dupReps ?? []) {
    let q = supabase.from("representaciones").select("id")
      .eq("entity_id", dr.entity_id).eq("scope", dr.scope)
      .eq("represented_person_id", pair.canonical.id)  // o representative_person_id si toca
      .is("effective_to", null);
    if (dr.meeting_id) q = q.eq("meeting_id", dr.meeting_id); else q = q.is("meeting_id", null);
    const { data: clash } = await q.maybeSingle();
    if (clash) conflicts.push(`representaciones collision: ...`);
  }

  // Check 6: authority_evidence collision
  const { data: dupAE } = await supabase.from("authority_evidence")
    .select("id, entity_id, body_id, cargo")
    .eq("tenant_id", TENANT_ID).eq("person_id", pair.duplicate.id)
    .eq("estado", "VIGENTE");
  // ... análogo
  ```

### [H] Apply pipeline sin transacción — Phase 1 fallido deja state mixto

- **Files:** `scripts/consolidate-duplicate-persons.ts:664-724` (`applyConsolidation`).
- **Issue:** El pipeline corre 3 fases secuenciales:
  1. Phase 1: bucle sobre 47 FK refs → UPDATEs individuales vía supabase-js.
  2. Phase 2: `verifyNoRemainingRefs` lee counts.
  3. Phase 3: UPDATE `persons` archivar (rename tax_id + full_name).
- Cada UPDATE en Phase 1 es una transacción autónoma vía PostgREST. Si la UPDATE #15 falla (RLS, WORM, UNIQUE, deadlock), las UPDATEs #1–#14 ya commiteadas dejan el duplicado **parcialmente migrado** pero **sin archivar**. El orphan check de Phase 2 nunca se ejecuta, no hay rollback.
- **Risk:** Re-run del script con `--auto-detect` detecta el duplicado de nuevo (tax_id sin prefijo `ARCHIVED-`), corre preflight (puede pasar o fallar diferente porque algunas FKs ya están migradas), y vuelve a intentar Phase 1 — pero ahora algunas UPDATEs serán no-ops (cero rows). La idempotencia del script depende de que el primer fallo del operador sea recuperable, lo que NO está claramente documentado ni testado.
- **Fix:** Una de las dos:
  - **(a) RPC transaccional**: crear `fn_consolidate_person_duplicate(p_canonical uuid, p_duplicate uuid)` SECURITY DEFINER que envuelva el pipeline en `BEGIN`/`COMMIT`. Es la opción robusta pero requiere migración SQL — fuera del scope D2.
  - **(b) Documentar idempotencia parcial explícitamente**: añadir comentario al inicio de `applyConsolidation` indicando que el re-run cubre fallos parciales, y que cualquier UPDATE que falle deja state recuperable (porque el archive solo ocurre tras Phase 2 OK). Demostrar con test que un fallo simulado en Phase 1 (e.g. mock UPDATE #15 throw) → re-run completa correctamente.
  - **Recomendación adversarial:** opción (b) con test. Opción (a) deferida a Plan A'.

---

## Non-blocking notes

### [M] TypeScript errors en bunx tsc — no bloquean ejecución vía bun pero deberían arreglarse

- **Files:** `scripts/consolidate-duplicate-persons.ts:456`, `:737`
- **Issue:**
  - Línea 456: `for (const [taxId, group] of groupsByTaxId)` — TS dice `Type 'Map<string, PersonRow[]>' can only be iterated through when using '--downlevelIteration' flag or with a '--target' of 'es2015' or higher`. El proyecto raíz tsconfig no incluye `scripts/`, así que `bun run typecheck` no falla. Pero un dev que ejecute `bunx tsc --noEmit scripts/...` ve el error.
  - Línea 737: `.select("*", { count: "exact", head: false })` — TS dice `Expected 0-1 arguments, but got 2`. La signature de supabase-js que infiere TS desde el contexto `update().select(...)` no acepta el segundo argumento options. Funciona en runtime pero la API correcta es `.select("*", { count: "exact" })` (omitir `head: false` que es default) o usar el patrón antiguo `.update(...).select(...).count("exact")` si existe.
- **Risk:** Script no compila en strict TS pero corre OK con bun. CI futuro que añada scripts al typecheck barrera puede caer. Robustez floja.
- **Fix:** `for (const entry of Array.from(groupsByTaxId.entries()))` para la línea 456; quitar `head: false` para la línea 737.

### [M] D2.4 seed pre-check es defensivo pero NO usa UPSERT como pidió el plan

- **Files:** `scripts/seed-demo-arga-canonico.ts` (todo `updatePjTaxId` + `upsertMercadoLibre`).
- **Issue:** El plan D2.4 paso 2 dice "Use `ON CONFLICT DO UPDATE` for the upserts so the seed is idempotent". El builder NO añadió `ON CONFLICT`. En su lugar, mantuvo el patrón pre-existente `SELECT-then-UPDATE-or-INSERT` con un pre-check defensivo nuevo (excelente para detectar colisiones, pero no es UPSERT).
- **Risk:** Bajo — el patrón existente ya era idempotente para el caso happy. El plan pedía UPSERT como mejora de robustez, no como bug fix. Pero el commit message dice "alinea el seed canonical con UNIQUE(tenant_id, tax_id)" sin mencionar que el plan pedía UPSERT y se optó por pre-check defensivo en su lugar. Decisión correcta IMO (UPSERT con índice partial es complicado), pero desviación del plan no documentada.
- **Fix:** Añadir nota al commit o al docstring del seed: "Wave 2 D2.4: chose pre-check over UPSERT because ux_persons_tax_id_real is a partial index that Supabase's onConflict cannot reference."

### [M] Detector Type B no respeta convención canonical/duplicate post-consolidación

- **Files:** `scripts/consolidate-duplicate-persons.ts:482-498`.
- **Issue:** Type B crea pares `(canonical=canon, duplicate=pend)` donde `canon` tiene tax_id real y `pend` tiene `PENDIENTE-`. Asume que el `PENDIENTE-` SIEMPRE debe consolidarse hacia el real. Pero hay casos donde `PENDIENTE-` tiene DATA real (capital_holdings, condiciones) y el "canonical" es un placeholder vacío. El detector no inspecciona qué fila tiene más references — solo orden por prefijo.
- **Risk:** Bajo en el demo actual (Cartera ARGA pending no tiene cargos ni holdings — probe confirmó `condic_hits=0` y `holdings_hits=0`). Pero si en futuro un test E2E crea data sobre un `PENDIENTE-` que luego un seeder de prod hidrata como canonical, el orden lógico podría invertirse.
- **Fix:** Documentar en docstring que Type B asume `PENDIENTE-` siempre vacío de data o overridable con `--pair=<canon>:<dup>` (ya soportado). No es bloqueante.

### [L] `verifyNoRemainingRefs` silencia errores de tabla

- **Files:** `scripts/consolidate-duplicate-persons.ts:760-773`
- **Issue:** Si una tabla falla con RLS o no existe (e.g. cambió el schema entre el probe y la ejecución), `verifyNoRemainingRefs` solo loguea `console.warn` y sigue. El final puede no contar todas las orphans.
- **Risk:** Bajo. El log warn alerta al operador.
- **Fix:** Considerar acumular errores y mostrarlos en summary al final del orphan check.

### [L] `EXPECTED_FK_COUNT = 47` comentario dice 47 — el probe Cloud devuelve 47

- **Files:** `scripts/consolidate-duplicate-persons.ts:392`
- **Note:** Mi probe `pg_constraint WHERE confrelid = 'persons'::regclass` devuelve **47** rows en Cloud demo el 2026-05-12. El script declara `EXPECTED_FK_COUNT = 47` y tiene exactamente 47 entradas en `PERSONS_FK_REFERENCES`. **Coverage 100%**. (Mi cuenta inicial de "46" fue error mío contando duplicados de `meeting_attendees` o similar; verificado al hacer diff del set ordenado).

---

## FK coverage matrix

| Categoría | Migrated | Skip (justificado) | Missing | Total |
|---|---|---|---|---|
| Identity/canonical bridges | 7 | 0 | 0 | 7 |
| Authority/certification | 3 | 0 | 0 | 3 |
| Capital | 1 | 0 | 0 | 1 |
| Meetings/minutes | 6 | 0 | 0 | 6 |
| Acuerdos/decisiones | 4 | 0 | 0 | 4 |
| Voting projection | 1 | 0 | 0 | 1 |
| GRC/Riesgos/Auditoría | 14 | 0 | 0 | 14 |
| AI/AIMS | 9 | 0 | 0 | 9 |
| Secretaría/RBAC | 2 | 0 | 0 | 2 |
| **TOTAL** | **47** | **0** | **0** | **47** |

Lista verificada vía `diff` ordenado contra probe `pg_constraint` Cloud project hzqwefkwsxopwrmtksbg.

**Tablas auditoría WORM excluidas correctamente** del set (no aparecen en pg_constraint con confrelid=persons): `audit_log` usa `record_id`/`table_name` JSON, no FK enforced. `censo_snapshot` usa `audit_worm_id` que apunta a `audit_log`, no a `persons`. **Coverage absoluto OK**.

**3 FK marcadas migrate son WORM-blocked en runtime** (no_session_notificaciones, no_session_respuestas, capital_movements). Builder no detectó esto. Crítica H#1.

---

## Confirmation matrix

| Item | Status | Nota |
|---|---|---|
| 47 FK coverage completa contra probe Cloud | ✓ | diff vacío entre script y pg_constraint |
| `entities.person_id` incluido | ✓ | Marcado `critical: true`, rationale claro |
| `meeting_attendees.person_id` (no `attendee_person_id`) | ✓ | Plan estaba mal, builder corrigió + comentó |
| `agreements.proponent_person_id` ausente (no existe) | ✓ | Builder verificó schema y descartó |
| Self-ref `persons.representative_person_id` | ✓ | Cubierto con rationale "self-reference" |
| Audit tables `audit_log`/`audit_worm_trail` justificadamente excluidas | ✓ | No tienen FK enforced a persons.id |
| Preflight con UNIQUE `ux_condicion_vigente` | ✓ | Check 1 |
| Preflight con `entities.person_id` ambigüedad | ✓ | Check 2 — bloqueará caso B88888888 |
| Preflight con UNIQUE `ux_capital_holdings_vigente` | ✓ | Check 3 |
| Preflight con UNIQUE `ux_representaciones_vigente` | ✗ | **MISSING — crítica H#2** |
| Preflight con UNIQUE `ux_authority_vigente` | ✗ | **MISSING — crítica H#2** |
| Preflight con UNIQUE `no_session_respuestas (expediente_id, person_id)` | ✗ | Bajo riesgo demo, pero faltante |
| Pipeline en transacción atómica | ✗ | **MISSING — crítica H#3** |
| Soft-archive ANTES o DESPUÉS de migrate FKs | ✓ | DESPUÉS — orden correcto (Phase 3) |
| Soft-archive prefija `[ARCHIVED]` al full_name | ✓ | Línea 711 |
| Soft-archive prefija `ARCHIVED-<ts>-` al tax_id | ✓ | Línea 710 |
| Idempotente al re-correr (ARCHIVED- skip early) | ✓ | Línea 673 |
| Seed UPSERT (`ON CONFLICT DO UPDATE`) | ✗ | Optó por pre-check defensivo — nota M#2 |
| IDs canónicos seed alineados con post-consolidación | ✓ | Seed usaba ya los IDs canónicos pre-Wave2 |
| WORM tables `no_session_*` y `capital_movements` consideradas | ✗ | **MISSING — crítica H#1** |
| Errores loud (throw) no silenciosos | ✓ | `migrateFk` throws con context |
| Row counts logueados por tabla | ✓ | Línea 688 |
| Mensaje claro cuando faltan env vars | ✓ | Líneas 782-785 |
| Respeta L14 (cese conserva histórico vs DELETE) | ✓ | Soft-archive nunca DELETE |
| FK histórica CESADA migra references también | ✓ | `migrateFk` no filtra por estado |
| `meeting_attendees.represented_by_id` cubierto | ✓ | Añadido por builder (no estaba en plan) |
| TypeScript compila sin errores con strict | ✗ | 2 errores bunx tsc, ignorados por bun — nota M#1 |

---

## Recomendación operativa

**Builder debe abordar las 3 críticas H antes de ejecutar el script contra Cloud:**

1. **H#1 (WORM):** Marcar `no_session_notificaciones.person_id`, `no_session_respuestas.person_id`, `capital_movements.person_id` como `action: "skip"` con docstring justificando WORM. El soft-archive preserva la fila (NO DELETE), así que las references históricas siguen apuntando a un row vivo (solo con prefijo `[ARCHIVED]`). Audit trail intacto.

2. **H#2 (preflight gaps):** Añadir Check 5 (representaciones) + Check 6 (authority_evidence) en `preflightCheck`. Tomar la query helper existente para condiciones como template; mismo patrón `dupRows → for-loop → maybeSingle()`.

3. **H#3 (transaccionalidad):** O bien (a) RPC `fn_consolidate_person_duplicate` SECURITY DEFINER con BEGIN/COMMIT (incluiría una nueva migración 000066, fuera de Wave 2 scope), O (b) documentar idempotencia parcial y añadir test que demuestre recuperabilidad ante fallo mid-Phase-1. Recomendación: (b).

**Notas M/L son aceptables para merge si Builder las documenta como deuda explícita.**

**Verificación post-fix:**

```bash
# 1. Typecheck
bunx tsc --noEmit scripts/consolidate-duplicate-persons.ts
# Esperado: 0 errores

# 2. Smoke dry-run contra Cloud (con env var)
SUPABASE_SERVICE_ROLE_KEY="..." \
  bun run scripts/consolidate-duplicate-persons.ts --dry-run
# Esperado: detecta pares PRUEBA1/SEGUROSTEST B88888888 + Cartera ARGA pending,
#           preflight FAIL en el primero (entities ambiguity), pasa en el segundo.

# 3. NO ejecutar --apply contra Cloud hasta que las 3 H se corrijan.
```

**Verdicto resumido para builder + coordinador:**
- FK coverage 100% ✓
- Bugs del plan corregidos ✓
- Preflight: 3 de 5 checks que tocan ✗
- Idempotencia parcial sin test ✗
- Trampa WORM no detectada en advance ✗
- Seed defensivo + actionable ✓ pero NO UPSERT como pidió plan

**Estimación esfuerzo correcciones:** 1.5-2h (60min H#1 + H#2 + tests preflight, 30min H#3 documentación o test mock, 15min M#1 typecheck cleanup).

---

## Probes ejecutados durante este review

- `pg_constraint` para FKs a `persons.id`: 47 rows (matches script).
- `pg_trigger` para WORM/lock triggers: 12 triggers, 3 de los cuales bloquean UPDATE en tablas que el script intenta migrar.
- UNIQUE indexes en `condiciones_persona`, `capital_holdings`, `representaciones`, `authority_evidence`: 4 partial unique indexes confirmados.
- Refs de duplicados conocidos: B88888888 hits solo en `entities` (2). Cartera ARGA / ARGA Capital Inversiones tienen hits WORM (notificaciones/respuestas).
- E2E test rows (E2E-B-*, E2E-S-*): 9 rows con `capital_movements` ref c/u (WORM-blocked).
- `audit_log`/`censo_snapshot`: no tienen FK enforced a `persons` — justificadamente skip.

## Patrón legal aplicado

- **L14 (cese vs DELETE):** ✓ soft-archive preserva fila + cargos históricos.
- **L19 (UNIQUE tax_id):** ✓ migración 000063 ya impone, script libera el slot.
- **L21/L22 (RM declarativa vs constitutiva):** ✓ no impacta consolidación; certificación post-archive sigue funcionando porque AE permanece VIGENTE para canonical.
- **L23 (RM referencia obligatoria):** ✓ trigger 000064 sigue propagando al row canonical post-migrate.

## Patrón de revisión adversarial confirmado

- **Wave 1 fixes verificados:** comentario prerequisito en 000063 ✓ + `ARCHIVED-%` excluido ✓ + `search_path` en 000064 ✓ + `CONSEJERO_COORDINADOR` removido ✓ + tests TS canonical ✓.
- **Wave 1 → Wave 2 handshake:** crítica #5 del Wave 1 review explicitamente requería al builder Wave 2 expandir FK list a 47 + corregir `meeting_attendees.person_id` + cubrir `entities.person_id`. **Builder cumplió las 3.**

