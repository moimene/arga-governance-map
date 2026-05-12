# Wave 1 Adversarial Review — D1 Schema Migrations

**Reviewer:** Adversarial Reviewer Agent (claude-flow)
**Fecha:** 2026-05-12
**Branch revisada:** `feature/personas-cargos-refactor`
**Commits revisados:** `331a23e`, `baf5155`, `034aba4`
**Spec base:** `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md` (`219c5af` + `674ff14`)
**Plan base:** `docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md` (`889e473`)

---

## Verdict

**NEEDS-CHANGES**

Las 3 migraciones SQL son sustancialmente correctas y respetan las decisiones legales L1-L23. Sin embargo, **los 3 tests TypeScript no compilan** (símbolo importado no existe), y **una de las migraciones perdería un atributo de seguridad** (`SET search_path`) que el trigger actual tiene en Cloud. Tampoco se puede aplicar 000063 a Cloud demo sin antes consolidar al menos un duplicado real ya presente (`B88888888`). Bloquear merge hasta que estos 3 puntos se corrijan; el resto son notas no bloqueantes para Wave 2.

---

## Critical findings (must fix before Wave 2)

### [H] Los 3 tests de schema NO compilan — importan símbolo inexistente

- **Files:**
  - `src/test/schema/persons-tax-id-unique.test.ts:2`
  - `src/test/schema/authority-evidence-trigger-rm.test.ts:2`
  - `src/test/schema/condiciones-persona-vicesecretario.test.ts:2`
- **Issue:** Los 3 archivos importan `{ supabaseTestClient } from '@/test/helpers/supabase-test-client'`, pero ese helper NO exporta `supabaseTestClient`. Los símbolos reales son:
  - `export const supabaseAdmin: SupabaseClient | null`
  - `export function hasAdminClient(): boolean`
- **Confirmación:** `bunx tsc --noEmit` falla con `TS2307: Cannot find module '@/test/helpers/supabase-test-client'` para los 3 archivos. El resto de tests canonicos (`canonical-bootstrap.test.ts`, `canonical-functions.test.ts`, `v2-plantillas-overrides.test.ts`) usan el patrón correcto: `import { supabaseAdmin, hasAdminClient } ...` + `describe.skipIf(!hasAdminClient())(...)`.
- **Risk:** Los tests fallan con TS error antes de ejecutar. `bun test` no los ejecuta. CI gate de tipos quebrado. No se detectaría si la migración funciona o no.
- **Fix:** Reescribir los 3 archivos siguiendo el patrón canónico:
  ```ts
  import { supabaseAdmin, hasAdminClient, DEMO_TENANT } from '@/test/helpers/supabase-test-client';
  describe.skipIf(!hasAdminClient())('persons.tax_id UNIQUE...', () => {
    const supabase = supabaseAdmin!;
    // ... use supabase like before
  });
  ```
  El plan literal estaba mal copiado — usar el patrón real de `canonical-bootstrap.test.ts` como template. Esto es una desviación del plan, no del builder; pero el builder debió detectar el mismatch al ver que su test no compila.

### [H] 000064 pierde `SET search_path` al hacer CREATE OR REPLACE

- **File:** `supabase/migrations/20260513_000064_authority_evidence_trigger_rm_fields.sql:8-11`
- **Issue:** El trigger actual en Cloud (`pg_proc.proconfig`) tiene `search_path=public, extensions`. La nueva definición:
  ```sql
  CREATE OR REPLACE FUNCTION fn_sync_authority_evidence()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  ```
  **NO incluye** `SET search_path TO 'public', 'extensions'`. PostgreSQL `CREATE OR REPLACE` reemplaza completamente la función, **incluyendo proconfig**. Tras aplicar 000064, el trigger queda sin search_path explícito.
- **Risk:** Vulnerabilidad de search-path hijack: si un actor con permiso INSERT en `condiciones_persona` (RLS lo permite) cambia su `search_path` antes del INSERT, podría redirigir funciones builtin de PG referenciadas implícitamente. Probabilidad baja en este contexto (función sencilla, sin SECURITY DEFINER), pero **estamos perdiendo una defensa ya endurecida** sin justificación. Lo correcto es preservar la configuración.
- **Fix:** Añadir `SET search_path TO 'public', 'extensions'` a la firma:
  ```sql
  CREATE OR REPLACE FUNCTION fn_sync_authority_evidence()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'extensions'
  AS $$
  ```

### [H] Migración 000063 fallará en Cloud demo por duplicado real `B88888888`

- **File:** `supabase/migrations/20260513_000063_persons_tax_id_unique.sql:8-14`
- **Issue:** Probe Cloud confirma 2 rows en `persons` con `tax_id = 'B88888888'`:
  - `e82cf750-214d-4a90-8acb-49344c390ce9` — "PRUEBA 1" (2026-05-10)
  - `38f1a494-2a99-44c7-a936-d2cada064bb7` — "SEGUROS TEST A, SL" (2026-05-12)
  - Ninguno tiene prefijo excluido (`PENDIENTE-`, `E2E-`, `FREE-FLOAT-`, `ARCHIVED-`).
- **Risk:** Si alguien aplica las 3 migraciones a Cloud demo en orden sin antes ejecutar D2 (consolidación), 000063 aborta con `23505 / ux_persons_tax_id_real`. Estado queda inconsistente (000063 NO se aplica, 000064/065 todavía no). El plan dice que D1.4 ("apply to Cloud") debe ir después de D2, pero el commit de la migración no codifica esa dependencia — alguien siguiendo solo los commits de Wave 1 podría aplicar las tres y se rompe.
- **Fix:** Una de las dos:
  - (a) Añadir comentario explícito al inicio de 000063: `-- PREREQUISITE: must run scripts/consolidate-duplicate-persons.ts FIRST. See plan D2.`
  - (b) Pre-flight check en SQL: `DO $$ BEGIN IF EXISTS (...) THEN RAISE EXCEPTION '...'; END IF; END $$;` antes del CREATE UNIQUE INDEX, listando el tax_id duplicado para que el operador sepa qué arreglar.
  - El plan también es flojo aquí: tarea D2.x debería referenciarse explícitamente como prerequisito en el comentario de la migración.

---

## Non-blocking notes (Wave 2 cleanup, no bloquean merge si las 3 críticas se corrigen)

### [M] Prefijos `NIF-DEMO-*` y otros no excluidos del UNIQUE 000063

- **Risk:** Hay 20 rows con `NIF-DEMO-*` (datos demo de personas canónicas del CdA ARGA) más fixtures sueltos como `1111111111-A` (PEDRO PRUEBA PRUEBA) y `B12345679` (ARGA Capital Inversiones SL). Actualmente son únicos, pero si futuros seeds/tests crean otra fila con la misma `NIF-DEMO-XX` (incluso accidentalmente al regenerar seeds), 000063 dará 23505. Riesgo de regresión.
- **Note:** Decidir explícitamente: ¿`NIF-DEMO-*` son datos canónicos protegidos por UNIQUE (entonces OK)? ¿O son placeholders que deben moverse a `PENDIENTE-` o excluirse?
- **Recomendación:** Documentar en spec o decidir antes de Wave 2 que `NIF-DEMO-*` son CANÓNICOS (no se duplican). Si el equipo confirma esto, no hay cambio en la migración.

### [M] Backfill ordering — VICESECRETARIO entry en 000064 es no-op antes de 000065

- **File:** `supabase/migrations/20260513_000064_authority_evidence_trigger_rm_fields.sql:107`
- **Issue:** El Backfill B incluye `'VICESECRETARIO'` en la IN-list. Pero hasta que 000065 amplíe el CHECK `chk_condiciones_persona_tipo_condicion`, no puede haber filas VICESECRETARIO en `condiciones_persona`. Por tanto Backfill B no insertará nada para VICESECRETARIO durante la aplicación de 000064. Esto está bien (idempotente), pero podría confundir a un operador que lea el log y vea "0 VICESECRETARIO insertados". No es bug.
- **Note:** Aceptable. El plan ya documentó orden 000063→000064→000065.

### [M] Test 000064 — Test 2 (VICESECRETARIO) puede ocultar fallos silenciosamente

- **File:** `src/test/schema/authority-evidence-trigger-rm.test.ts:60-65`
- **Issue:** `if (error?.code === '23514') return` — si 000065 no se aplicó, el test retorna sin assertion y aparece PASS. Pero si CUALQUIER otro error 23514 aparece (e.g. body_id coherencia), también pasa silenciosamente.
- **Fix:** Marcar explícitamente como skip si 000065 no aplicado, o agrupar tests en describe-blocks separados con `skipIf` distinto.

### [M] Test 000064 leaks rows after second `it`

- **File:** `src/test/schema/authority-evidence-trigger-rm.test.ts:56-69`
- **Issue:** El `condicionId` solo guarda la primera inserción. La segunda inserción (VICESECRETARIO) no se asigna a ninguna variable, ni se incluye en cleanup. Fila persistirá en Cloud entre runs.
- **Fix:** Acumular IDs en un array y limpiar todos en `afterAll`. Patrón ya usado en el test 000065 (`created: string[]`).

### [M] Test 000063 first test deletes by tax_id (no uses id)

- **File:** `src/test/schema/persons-tax-id-unique.test.ts:30`
- **Issue:** `await supabase.from('persons').delete().eq('tax_id', taxId)` — está bien que borre por tax_id porque solo una fila se insertó con éxito; pero si por alguna razón la primera inserción tuvo `select().single()` problem y devolvió error pese a insertar, podríamos quedar con orphan. Inserción no usa `.select()` así que `data` es null — no hay manera de borrar por id concreto.
- **Note:** Aceptable, pero el patrón en el segundo test (PENDIENTE-) sí captura `r1.id`/`r2.id`. Inconsistencia menor.

### [L] Trigger no limpia AE cuando cambia `tipo_condicion` en UPDATE

- **File:** `supabase/migrations/20260513_000064_authority_evidence_trigger_rm_fields.sql:39-51`
- **Issue:** Si `OLD.tipo_condicion='PRESIDENTE'` y `NEW.tipo_condicion='VICEPRESIDENTE'` (cambio de cargo via UPDATE), el branch UPDATE solo evalúa `NEW.tipo_condicion = ANY (v_cargos_certificantes)`. No detecta que el cargo cambió. El AE row de PRESIDENTE queda VIGENTE; no se crea AE row de VICEPRESIDENTE; los datos divergen.
- **Note:** Latente en el trigger ORIGINAL también, NO es regresión introducida por 000064. Documentado en spec L14 que cese y nombramiento son actos separados (no se hace via UPDATE de tipo). Fix para Plan A' si aparece en la práctica.

### [L] Test 000063 — TEST-DUP prefix is unique constraint subject (intencional)

- **File:** `src/test/schema/persons-tax-id-unique.test.ts:8`
- **Note:** El test usa `TEST-DUP-${Date.now()}`. Este prefijo NO está en la exclusión del UNIQUE — es exactamente el comportamiento que el test ejercita. Correcto.

### [L] 000065 — Sin Backfill verificación post-CHECK

- **File:** `supabase/migrations/20260513_000065_condiciones_persona_vicesecretario.sql`
- **Note:** No incluye `DO $$ BEGIN ... END $$;` con conteo de filas que violarían el nuevo `chk_condicion_body_coherente`. Si por alguna razón hubiera VICESECRETARIO con body_id NULL (imposible hoy, CHECK lo rechaza), el ADD constraint fallaría. Cloud confirma 0 VICESECRETARIO rows. OK por estado actual, pero un guard nunca está de más.

---

## Confirmation matrix

| Item | Status |
|---|---|
| 000063 UNIQUE (sintaxis + idempotencia) | ✓ |
| 000063 índice `ux_persons_tax_id_real` no colisiona con existentes | ✓ |
| 000063 BEGIN/COMMIT wrapper | ✓ |
| 000063 aplicable a Cloud SIN consolidación previa | ✗ (duplicado B88888888) |
| 000064 trigger sintaxis ON CONFLICT WHERE | ✓ (PG soporta, índice partial existe) |
| 000064 trigger preserva SET search_path | ✗ (PIERDE el setting actual) |
| 000064 backfill A predicado completo | ✓ |
| 000064 backfill B ON CONFLICT DO NOTHING | ✓ |
| 000064 UPDATE branch propaga RM en VIGENTE | ✓ (L23) |
| 000064 INSERT branch propaga RM | ✓ (L23) |
| 000064 VICESECRETARIO en v_cargos_certificantes | ✓ (L17) |
| 000065 nombres de constraints match exactos | ✓ |
| 000065 ADD constraint no rompe filas existentes | ✓ (0 VICESECRETARIO rows) |
| 000065 orden de apply OK con 000064 | ✓ (mismo batch MCP) |
| Tests TS compilan | ✗ (3/3 fallan TS2307) |
| Tests cleanup completos en afterAll | ✗ (leak en 000064 test 2) |
| Tests usan canonical helpers correctos | ✗ (todos usan `supabaseTestClient` que no existe) |
| Idempotencia de los 3 archivos | ✓ |
| L17 (VICESECRETARIO) cobertura | ✓ |
| L18 (COMISIONADO ausente) | ✓ |
| L19 (UNIQUE tenant_id+tax_id) | ✓ |
| L23 (RM ref propagada) | ✓ |

---

## Recomendación operativa

1. **Builder debe corregir las 3 críticas (H)** antes de proceder a Wave 2 / D2:
   - Reescribir los 3 tests con el patrón `supabaseAdmin + hasAdminClient + DEMO_TENANT`.
   - Añadir `SET search_path TO 'public', 'extensions'` a `CREATE OR REPLACE FUNCTION` en 000064.
   - Decidir entre comentario-prerequisito o pre-flight check en 000063.

2. **Después de corregir, re-verificar con:**
   ```bash
   bunx tsc --noEmit src/test/schema/persons-tax-id-unique.test.ts \
                     src/test/schema/authority-evidence-trigger-rm.test.ts \
                     src/test/schema/condiciones-persona-vicesecretario.test.ts
   ```
   Debe pasar sin errores.

3. **Notas M/L** son aceptables para merge a Wave 2 si Builder las documenta como deuda explícita o las pospone a Plan A'.

4. **NO aplicar las migraciones a Cloud** hasta que Wave 2 D2 (consolidación duplicados) ejecute con éxito y deje 0 duplicados reales.

---

## Addendum tras input legal — verificación de los 4 puntos Garrigues + gap D2.2

**Fecha:** 2026-05-12 (post-veredicto inicial)
**Fuente legal:** Ruflo memory `personas-cargos / wave1-legal-verdict` (Equipo Legal Garrigues)
**Verdict legal:** APPROVE con 4 addenda de verificación para el adversarial reviewer.

El veredicto base **se mantiene en NEEDS-CHANGES**, ahora con **5 críticas H** (en lugar de 3) por descubrimiento legal adicional + 1 nueva crítica H para Wave 2 D2.

### A. `v_cargos_certificantes` en migración 000064 — **[H] BUG LEGAL**

**Esperado por legal Garrigues:**
- INCLUIR: `PRESIDENTE, VICEPRESIDENTE, SECRETARIO, VICESECRETARIO, ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO`
- EXCLUIR: `CONSEJERO`, `CONSEJERO_COORDINADOR`, presidentes de comisión

**Encontrado en `supabase/migrations/20260513_000064_authority_evidence_trigger_rm_fields.sql:13-17`:**
```sql
v_cargos_certificantes text[] := ARRAY[
  'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
  'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
  'CONSEJERO_COORDINADOR'   -- ← BUG LEGAL: debe REMOVERSE
];
```

**Diagnóstico:**
- Contiene `CONSEJERO_COORDINADOR`, que el equipo legal Garrigues confirma NO certifica societariamente (RRM art. 109 reserva certificación a Secretario con VºBº de Presidente; el Consejero Coordinador es un rol de gobierno corporativo en cotizadas pero no firma actas/certificaciones).
- El trigger ORIGINAL en Cloud (pre-000064) **ya incluía** `CONSEJERO_COORDINADOR` — confirmado vía probe `pg_get_functiondef(fn_sync_authority_evidence)`. Es un bug legacy preservado, no introducido por el builder. Pero el plan D1.2 y la nueva migración 000064 lo PROPAGAN.
- La migración era una oportunidad de limpieza legal post-validación. El builder copió literal del plan sin desafiar el array.
- Backfill B (líneas 105-109 de 000064) **TAMBIÉN incluye `CONSEJERO_COORDINADOR`** en su IN-list. Si alguno existe vigente en `condiciones_persona` (Cloud probe: 0 hoy, pero podría haber en el futuro), el backfill crearía `authority_evidence` para él incorrectamente.

**Risk:** Si `CONSEJERO_COORDINADOR` permanece, futuras `condiciones_persona` con ese tipo generan filas en `authority_evidence`. La UI "Autoridad certificante" podría exponer al Consejero Coordinador como certificante autorizado → contrato legal incorrecto frente a auditor Garrigues + LSC art. 529 septies habilita al CC para coordinar pero NO para certificar.

**Fix:**
1. Remover `'CONSEJERO_COORDINADOR'` del `v_cargos_certificantes` (línea 16 — quedaría sin la última entry; el array previo termina con `'VICESECRETARIO',`).
2. Remover `'CONSEJERO_COORDINADOR'` del IN-list del Backfill B (línea 108).
3. Considerar añadir un script de limpieza para borrar las filas `authority_evidence` con `cargo='CONSEJERO_COORDINADOR'` existentes en Cloud (probe: hay 0 hoy según la enumeración de cargos).

### B. `chk_condicion_body_coherente` en migración 000065 — **PASS**

**Esperado por legal Garrigues:**
- body_id IS NULL → `{SOCIO, ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, ADMIN_PJ}` (la PJ admin NO pertenece a órgano)
- body_id IS NOT NULL → `{CONSEJERO, PRESIDENTE, SECRETARIO, VICEPRESIDENTE, VICESECRETARIO, CONSEJERO_COORDINADOR}`

**Encontrado en `supabase/migrations/20260513_000065_condiciones_persona_vicesecretario.sql:22-29`:**
```sql
ADD CONSTRAINT chk_condicion_body_coherente CHECK (
  (tipo_condicion IN ('SOCIO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ')
    AND body_id IS NULL)
  OR
  (tipo_condicion IN ('CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO','CONSEJERO_COORDINADOR')
    AND body_id IS NOT NULL)
);
```

**Diagnóstico:** Match exacto con el requerimiento legal. `ADMIN_PJ` correctamente en grupo NULL (línea 24); `VICESECRETARIO` correctamente en grupo NOT NULL (línea 27). **PASS — sin cambios necesarios.**

### C. Exclusión `FREE-FLOAT-` en migración 000063 — **PASS (necesaria, no defensiva)**

**Probe Cloud read-only ejecutado:**
```sql
SELECT COUNT(*), tax_ids, names FROM persons
WHERE tenant_id = '00000000-...0001' AND tax_id LIKE 'FREE-FLOAT-%';
```

**Resultado:** 1 fila — `tax_id='FREE-FLOAT-ARGA'`, `full_name='Mercado libre (free float agregado)'`.

**Diagnóstico:** Existe exactamente 1 placeholder legítimo para el agregado del free float de ARGA Seguros (30.31% según estructura corporativa del CdA en `CLAUDE.md`). Si se diera de baja `FREE-FLOAT-` del WHERE de exclusión, **no causaría un problema HOY** (solo hay 1 fila, no es duplicado), pero **rompería el invariante futuro** si en algún momento se necesitan agregados free float por jurisdicción (BR, MX, PT) — habría que crear `FREE-FLOAT-BRASIL`, `FREE-FLOAT-MEXICO`, etc., todos con su propio tax_id placeholder. Mantener la exclusión es **correcto y conservador**. PASS.

### D. Orden de aplicación a Cloud — **[H] CRÍTICA (ya flageada en veredicto base, reconfirmada por legal)**

**Re-confirmación:** 000063 fallará si se aplica a Cloud demo antes de la consolidación D2. Confirmado vía probe:
- `tax_id='B88888888'` × 2 ("PRUEBA 1" + "SEGUROS TEST A, SL").

**Riesgo legal adicional:** El plan menciona en `docs/superpowers/specs/` que "Cartera ARGA ×3" y "ARGA Seguros ×2" están en Cloud. Mi probe enumeró las `OTHER` y `REAL_CIF_SA_SL` pero no encontré `Cartera ARGA` literal ×3 con tax_id real — los placeholders están bajo `PENDIENTE-*`. Re-validar pre-consolidación a través de `consolidate-duplicate-persons.ts --dry-run` para enumerar los pares exactos. Si quedan duplicados reales no detectados (legacy seeds), 000063 explota.

**Fix (reconfirmado):**
1. Comentario explícito en el header de 000063: `-- PREREQUISITE: scripts/consolidate-duplicate-persons.ts --apply must run FIRST. See plan D2.`
2. Idealmente, pre-flight check SQL incluido al inicio de la migración.

### E. Gap técnico — D2.2 lista incompleta de tablas + bug de nombre de columna — **[H] CRÍTICA WAVE 2**

**Cloud probe enumeró 47 columnas FK referenciando `persons.id`.** Plan D2.2 (`docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md:980-989`) lista solo 9.

**Tablas/columnas con FK a `persons.id` que el plan D2.2 OMITE y que pueden orphanar datos al archivar la persona duplicada:**

| Tabla | Columna | Severidad | Razón |
|---|---|---|---|
| `entities` | `person_id` | **CRÍTICA** | Entity-as-PJ link. Si la persona duplicada es el PJ canónico para una sociedad, archivarla rompe el bridge identidad↔entidad. **Probe confirma 2 rows para B88888888** |
| `meetings` | `president_id` | ALTA | Histórico de quién presidió reuniones |
| `meetings` | `secretary_id` | ALTA | Histórico de secretarios de reuniones |
| `minutes` | `signed_by_president_id` | ALTA | Quién firmó el acta |
| `minutes` | `signed_by_secretary_id` | ALTA | Quién firmó el acta |
| `meeting_attendees` | `represented_by_id` | MEDIA | Representación en reunión específica |
| `certifications` | `certifier_id` | ALTA | Histórico de certificadores |
| `unipersonal_decisions` | `decided_by_id` | ALTA | Decisiones unipersonales del demo |
| `attestations` | `person_id` | MEDIA | Declaraciones del módulo TGMS |
| `capital_movements` | `person_id` | ALTA | WORM table — movimientos de capital |
| `conflicts_of_interest` | `person_id` | MEDIA | COI declarado |
| `delegations` | `delegate_id`, `grantor_id` | MEDIA | Delegaciones de voto |
| `no_session_notificaciones` | `person_id` | ALTA | Notificaciones (CASCADE — al archivar tax_id, no se borra pero se desreferencia conceptualmente) |
| `no_session_respuestas` | `person_id` | ALTA | Respuestas en acuerdos sin sesión |
| `no_session_expedientes` | `propuesta_firmada_por` | MEDIA | ON DELETE SET NULL — sobrevive pero pierde firma |
| `secretaria_role_assignments` | `person_id` | MEDIA | Asignaciones de rol RBAC |
| `user_profiles` | `person_id` | ALTA | Link auth.users ↔ persons |
| `role_book` | `person_id` | MEDIA | Histórico cargos legacy |

**Bug adicional confirmado por probe:**
- Plan D2.2 línea 985: `{ table: "meeting_attendees", column: "attendee_person_id" }`. **El nombre real de la columna en Cloud es `person_id`**, no `attendee_person_id`. El script así escrito intentaría `update({attendee_person_id: ...})` que erroriza por columna inexistente, dejando `meeting_attendees` sin migrar y rompiendo el flujo del script en el primer pair.

**Tablas mencionadas por legal pero NO existentes en Cloud:**
- `agreements.proponent_person_id` — **NO existe** (probe confirma que `agreements` solo tiene `unipersonal_decision_id` con string "person"). Falsa pista del legal verdict.
- `decisiones_unipersonales` — **NO existe**, el nombre real es `unipersonal_decisions` (en inglés). Pero esa tabla SÍ tiene FK `decided_by_id` que falta en D2.2.
- `no_session_resolutions.*` — verificar (no apareció en el listado de 47 FK; las tablas reales son `no_session_respuestas` y `no_session_expedientes`).

**Fix para Wave 2 builder:**
1. Reescribir la lista `tables` en `applyConsolidation` con las 47 FK enumeradas en Cloud (filtrar las que NO representan "identity holder" — e.g. `incidents.assigned_to` es rol operativo, no identidad — pero documentar la decisión por columna).
2. **Corregir el nombre `attendee_person_id` → `person_id`** en `meeting_attendees`.
3. Añadir `entities.person_id` con tratamiento especial: si una persona duplicada es el PJ-link de una entity, **el script debe abortar con error explícito** (no se debe archivar una persona que es la identidad canónica de una sociedad sin antes mover el `entities.person_id` al canónico).
4. Para tablas con `ON DELETE CASCADE` (`no_session_notificaciones`, `no_session_respuestas`): decidir si se mueven al canónico (preferible para audit trail) o se aceptan como histórico de la persona archivada.
5. Pre-flight check expandido para enumerar TODOS los tipos de referencia, no solo `condiciones_persona`.

### Resumen del addendum

| Punto | Veredicto | Acción |
|---|---|---|
| A. `v_cargos_certificantes` sin CONSEJERO_COORDINADOR | **FAIL — bug legal H** | Remover de array + Backfill B en 000064 |
| B. `chk_condicion_body_coherente` particionado | PASS | Sin acción |
| C. FREE-FLOAT- exclusión necesaria | PASS | Mantener exclusión (1 fila legítima existe) |
| D. Orden 000063 vs D2 | **FAIL — H (ya flageado)** | Comentario prerequisito + pre-flight |
| E. D2.2 lista de tablas incompleta + bug nombre columna | **FAIL — H para Wave 2 builder** | Reescribir lista con 47 FK + corregir `attendee_person_id` |

**Veredicto consolidado actualizado: NEEDS-CHANGES.** Total críticas H ahora son **5** (3 originales + Punto A nuevo + Punto E para Wave 2):

1. Tests TS no compilan (`supabaseTestClient` no existe)
2. Trigger pierde `SET search_path`
3. 000063 fallará en Cloud sin D2 previa (duplicate B88888888)
4. `v_cargos_certificantes` incluye CONSEJERO_COORDINADOR (bug legal)
5. D2.2 lista solo 9 de 47 FK + bug en nombre `attendee_person_id` (Wave 2 builder)

---

🤖 Generated by Adversarial Reviewer Agent (claude-flow)
🔄 Addendum tras input legal Garrigues — 2026-05-12
