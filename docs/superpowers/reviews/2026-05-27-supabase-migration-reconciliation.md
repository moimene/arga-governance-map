# Supabase migration reconciliation - governance_OS

Fecha: 2026-05-27  
Repo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Proyecto Supabase: `governance_OS` (`hzqwefkwsxopwrmtksbg`)

## Resultado ejecutivo actualizado

Actualización tras ejecutar la limpieza recomendada:

- Backup local de ficheros creado en `/tmp/arga-migration-reconciliation-20260527/supabase-migrations-pre-cleanup.tgz`.
- Patch de respaldo del estado previo a la limpieza creado en `/tmp/arga-migration-reconciliation-20260527/pre-cleanup.diff`.
- Se revirtieron los cambios masivos que `migration fetch` introdujo en 146 migraciones tracked.
- Se eliminaron los 9 duplicados locales `comms` creados por el fetch.
- Se retiraron de `supabase/migrations` las tres locales supersedidas:
  - `20260519080000_registry_filings_filing_type.sql`
  - `20260519080500_materia_catalog_formulacion_cuentas.sql`
  - `20260519081000_seed_mandatory_books_on_entity_insert.sql`
- Se conservan las tres remotas recuperadas:
  - `20260519084442_registry_filings_filing_type.sql`
  - `20260519084617_materia_catalog_formulacion_cuentas.sql`
  - `20260519084945_seed_mandatory_books_on_entity_insert_v2.sql`
- `supabase migration list --linked` ya no muestra duplicados ni las tres locales supersedidas como pendientes.
- `supabase db push --linked --dry-run` funciona y lista solo las 7 migraciones posteriores esperadas.
- Tests schema relevantes: 34/34 pass.
- Intento de dump remoto: bloqueado porque Docker no está corriendo. `supabase db dump` falló con `Cannot connect to the Docker daemon`.

Recomendación actual: **listo para aplicar desde el punto de vista de drift; no requiere repair controlado**. Antes de un `supabase db push` real, tomar backup Cloud/snapshot o arrancar Docker y generar dump remoto.

## Resultado ejecutivo inicial

Recomendación: **bloqueado por drift**. No hay bloqueo de credenciales: la CLI pudo listar, conectar y ejecutar `migration fetch`. El bloqueo actual es de consistencia local/remota.

No se aplicaron migraciones ni se ejecutó `migration repair`.

Puntos clave:

- `bun run db:check-target` confirmó `governance_OS (hzqwefkwsxopwrmtksbg)`.
- `supabase --version`: `2.98.2`; la CLI avisó que existe `2.101.0`.
- `supabase migration fetch --linked` recuperó las tres migraciones remotas faltantes:
  - `20260519084442_registry_filings_filing_type.sql`
  - `20260519084617_materia_catalog_formulacion_cuentas.sql`
  - `20260519084945_seed_mandatory_books_on_entity_insert_v2.sql`
- El fetch también tocó 146 migraciones tracked existentes y creó 9 ficheros duplicados `comms` con el mismo timestamp que migraciones ya presentes. No conviene commitear ese resultado sin limpieza controlada.
- `supabase db push --linked --dry-run` falló antes de planificar SQL porque hay migraciones locales anteriores a la última remota. No se ejecutaron tests de schema porque el dry-run no llegó a funcionar.

## Comandos ejecutados

```bash
bun run db:check-target
supabase --version
supabase migration list --linked
supabase migration fetch --linked
supabase migration list --linked
supabase db push --linked --dry-run
```

Comandos adicionales tras aprobación de la limpieza:

```bash
tar -czf /tmp/arga-migration-reconciliation-20260527/supabase-migrations-pre-cleanup.tgz supabase/migrations
git diff --binary -- supabase/migrations docs/superpowers/reviews/2026-05-27-supabase-migration-reconciliation.md > /tmp/arga-migration-reconciliation-20260527/pre-cleanup.diff
git restore --source=HEAD -- supabase/migrations
rm -f supabase/migrations/20260517140831_20260518000001_comms_aggregate_root.sql ...
rm -f supabase/migrations/20260519080000_registry_filings_filing_type.sql supabase/migrations/20260519080500_materia_catalog_formulacion_cuentas.sql supabase/migrations/20260519081000_seed_mandatory_books_on_entity_insert.sql
supabase migration list --linked
supabase db push --linked --dry-run
bunx vitest run src/test/schema/secretaria-p0-meeting-resolutions-rpc.test.ts src/test/schema/libros-societarios-migration.test.ts src/test/schema/secretaria-consejo-admin-templates-migration.test.ts src/test/schema/f4-platform.test.ts
```

## Tabla Local/Remote actual tras limpieza

| Local | Remote | Estado actual | Acción recomendada |
|---|---:|---|---|
| `20260519084442_registry_filings_filing_type.sql` | `20260519084442` | Recuperada por fetch y alineada | Conservar |
| `20260519084617_materia_catalog_formulacion_cuentas.sql` | `20260519084617` | Recuperada por fetch y alineada | Conservar |
| `20260519084945_seed_mandatory_books_on_entity_insert_v2.sql` | `20260519084945` | Recuperada por fetch y alineada | Conservar |
| `20260521101500_secretaria_rulepacks_lote1_core_fix.sql` | - | Pendiente real posterior al head remoto | Primera migración a aplicar |
| `20260521102000_secretaria_rulepacks_lote2_schema_fix.sql` | - | Pendiente real posterior al head remoto | Aplicar después de Lote 1 |
| `20260521130000_reconcile_drifts.sql` | - | Pendiente real posterior al head remoto | Revisar junto con RPC `fn_save_meeting_resolutions` |
| `20260521130500_g7_evidence_bundle_review_events.sql` | - | Pendiente real posterior al head remoto | Revisar seguridad de vista/RLS antes de aplicar |
| `20260521140000_grc_legacy_sync_triggers.sql` | - | Pendiente real posterior al head remoto | Revisar efectos de backfill/sync |
| `20260521150000_aims_assessments_rls.sql` | - | Pendiente real posterior al head remoto | Aplicar con prueba de acceso por tenant |
| `20260526195638_libros_societarios_registros_v2.sql` | - | Pendiente real posterior al head remoto | Aplicar al final por amplitud y reemplazo de seed de libros |

## Tabla Local/Remote tras fetch, antes de limpieza

El listado completo contiene muchas filas reconciliadas. Esta tabla recoge las filas no limpias o relevantes tras el fetch.

| Local | Remote | Estado actual | Acción recomendada |
|---|---:|---|---|
| `20260517140831_comms_aggregate_root.sql` | - | Duplicado local creado por coexistencia con fichero fetch del mismo timestamp | Eliminar uno de los dos nombres tras decidir convención |
| `20260517140846_comms_attachments.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517140857_comms_recipients.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517140916_comms_delivery_events_worm.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517140927_portal_memberships_and_schema.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517140931_comms_alters_plantillas_agreements.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517141038_comms_triggers.sql` | - | Duplicado local `comms`; el fetched tiene diferencias de comentarios/mensajes y `;;` final | Revisar diff antes de elegir |
| `20260517141305_comms_seed_comunicacion_config.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260517141522_comms_rls_policies_secretaria.sql` | - | Duplicado local `comms` | Eliminar uno de los dos nombres tras decidir convención |
| `20260519080000_registry_filings_filing_type.sql` | - | Local pendiente, pero equivalente funcional a remote `20260519084442` | Retirar local o repair controlado; preferible retirar si se conserva remote fetched |
| `20260519080500_materia_catalog_formulacion_cuentas.sql` | - | Local pendiente, pero equivalente funcional a remote `20260519084617` | Retirar local o repair controlado; preferible retirar si se conserva remote fetched |
| `20260519081000_seed_mandatory_books_on_entity_insert.sql` | - | Local pendiente, pero equivalente funcional a remote `20260519084945` | Retirar local o repair controlado; preferible retirar si se conserva remote fetched |
| `20260519084442_registry_filings_filing_type.sql` | `20260519084442` | Recuperada por fetch | Conservar como fuente de verdad local para esa versión remota |
| `20260519084617_materia_catalog_formulacion_cuentas.sql` | `20260519084617` | Recuperada por fetch | Conservar como fuente de verdad local para esa versión remota |
| `20260519084945_seed_mandatory_books_on_entity_insert_v2.sql` | `20260519084945` | Recuperada por fetch | Conservar como fuente de verdad local para esa versión remota |
| `20260521101500_secretaria_rulepacks_lote1_core_fix.sql` | - | Pendiente real posterior al head remoto | Aplicar solo después de limpiar drift previo |
| `20260521102000_secretaria_rulepacks_lote2_schema_fix.sql` | - | Pendiente real posterior al head remoto | Aplicar después de Lote 1 |
| `20260521130000_reconcile_drifts.sql` | - | Pendiente real posterior al head remoto | Revisar junto con RPC `fn_save_meeting_resolutions` |
| `20260521130500_g7_evidence_bundle_review_events.sql` | - | Pendiente real posterior al head remoto | Revisar seguridad de vista/RLS antes de aplicar |
| `20260521140000_grc_legacy_sync_triggers.sql` | - | Pendiente real posterior al head remoto | Revisar efectos de backfill/sync |
| `20260521150000_aims_assessments_rls.sql` | - | Pendiente real posterior al head remoto | Aplicar con prueba de acceso por tenant |
| `20260526195638_libros_societarios_registros_v2.sql` | - | Pendiente real posterior al head remoto | Aplicar al final por amplitud y reemplazo de seed de libros |

## Migraciones remotas recuperadas

| Migración | Objetos SQL | Coincidencia con local cercano | Riesgo |
|---|---|---|---|
| `20260519084442_registry_filings_filing_type.sql` | `ALTER TABLE public.registry_filings ADD COLUMN IF NOT EXISTS filing_type`; comentario de columna; `UPDATE` de filas `ELEVATED/SUBMITTED/INSCRIBED` | Equivalente funcional a `20260519080000_registry_filings_filing_type.sql`, pero sin `BEGIN/COMMIT` ni comentarios largos y con `;;` final | Bajo si se conserva solo una versión; alto si también se aplica `20260519080000` por duplicidad histórica |
| `20260519084617_materia_catalog_formulacion_cuentas.sql` | `INSERT ... ON CONFLICT` para `FORMULACION_CUENTAS` en `materia_catalog` | Equivalente funcional a `20260519080500_materia_catalog_formulacion_cuentas.sql` | Bajo si se conserva solo una versión; redundante si se aplican ambas |
| `20260519084945_seed_mandatory_books_on_entity_insert_v2.sql` | `CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_books`; trigger `trg_entities_seed_mandatory_books`; backfill para entidades existentes | Equivalente funcional a `20260519081000_seed_mandatory_books_on_entity_insert.sql`, pero con nombre `v2` y sin wrapper transaccional local | Medio: reemplaza función/trigger; queda además supersedida funcionalmente por `20260526195638` si esta se aplica más tarde |

## Migraciones locales pendientes

| Migración | Objetos SQL | Riesgo |
|---|---|---|
| `20260519080000_registry_filings_filing_type.sql` | Mismo cambio funcional que remote `20260519084442` | **Alto por drift**: no aplicar como migración nueva; retirar o resolver por repair controlado |
| `20260519080500_materia_catalog_formulacion_cuentas.sql` | Mismo upsert funcional que remote `20260519084617` | **Medio por duplicidad**: idempotente, pero no debe quedar como pendiente |
| `20260519081000_seed_mandatory_books_on_entity_insert.sql` | Misma función/trigger base que remote `20260519084945` | **Alto por reemplazo redundante**: no aplicar como pendiente |
| `20260521101500_secretaria_rulepacks_lote1_core_fix.sql` | Temp tables/functions; valida hashes esperados; actualiza 10 `rule_pack_versions`; inserta `audit_log` | Medio-alto: depende de hashes exactos y de que no haya drift manual posterior; debe ir antes de Lote 2 |
| `20260521102000_secretaria_rulepacks_lote2_schema_fix.sql` | Temp helpers; sanea schema/NA de 33 `rule_pack_versions`; inserta `audit_log` | Medio-alto: depende de Lote 1 para filas solapadas; fallará si hashes ya cambiaron |
| `20260521130000_reconcile_drifts.sql` | `public.worm_guard`; trigger WORM en `evidence_bundles`; reemplaza `fn_save_meeting_resolutions`; grant execute | Medio-alto: reemplaza una RPC crítica y recrea lógica de resoluciones/votos cuando se invoca |
| `20260521130500_g7_evidence_bundle_review_events.sql` | Nueva tabla WORM `evidence_bundle_review_events`; RLS; vista `evidence_bundle_review_state_current`; grants | Medio-alto de seguridad: la vista no declara `security_invoker = true`; revisar antes de exponerla |
| `20260521140000_grc_legacy_sync_triggers.sql` | `ALTER TABLE incidents ADD payload`; tres funciones `SECURITY DEFINER`; triggers de sync; backfill a `grc_*` | Medio: backfill actualiza filas backbone y funciones viven en schema `public` |
| `20260521150000_aims_assessments_rls.sql` | RLS en `ai_risk_assessments` y `ai_compliance_checks`; políticas por `ai_systems.tenant_id = fn_current_tenant_id()` | Medio: puede cerrar acceso si `fn_current_tenant_id()` no devuelve tenant en contexto app |
| `20260526195638_libros_societarios_registros_v2.sql` | Amplía `mandatory_books`; nuevas funciones de upsert/seed; triggers en `entities` y `governing_bodies`; backfill global | Alto por amplitud: reemplaza `fn_seed_mandatory_books` y resemilla todas las entidades |

## Riesgos globales detectados

1. **Fetch no quirúrgico:** `migration fetch` no solo añadió las tres remotas faltantes; también modificó 146 migraciones tracked y creó duplicados para versiones `2026051714xxxx`.
2. **Duplicados por timestamp:** tras el fetch, `supabase migration list --linked` muestra nueve versiones `2026051714xxxx` dos veces: una reconciliada con remote y otra como local-only.
3. **Tres migraciones locales supersedidas:** `20260519080000`, `20260519080500` y `20260519081000` son funcionalmente equivalentes a las tres remotas recuperadas. Dejarlas pendientes bloquea `db push --dry-run`.
4. **Dry-run bloqueado:** la CLI exige `--include-all` porque hay migraciones locales anteriores al último head remoto. No usar `--include-all` hasta limpiar o aceptar explícitamente el plan.
5. **Riesgo de vista sin `security_invoker`:** `evidence_bundle_review_state_current` debe revisarse antes de aplicar por la regla Supabase de vistas y RLS.

## Propuesta de orden

Orden recomendado para la siguiente fase, sin aplicar schema todavía:

1. Limpiar el resultado local del fetch: restaurar los cambios masivos en migraciones tracked y conservar solo las tres remotas recuperadas.
2. Eliminar o retirar de `supabase/migrations` las locales supersedidas `20260519080000`, `20260519080500`, `20260519081000`.
3. Eliminar los nueve duplicados `2026051714xxxx_2026051800000x_*` o, alternativamente, adoptar esos nombres y retirar los tracked originales. No mezclar ambos.
4. Reejecutar `supabase migration list --linked`.
5. Reejecutar `supabase db push --linked --dry-run`.
6. Si el dry-run ya lista solo migraciones posteriores al head remoto, revisar/aplicar en este orden:
   1. `20260521101500_secretaria_rulepacks_lote1_core_fix.sql`
   2. `20260521102000_secretaria_rulepacks_lote2_schema_fix.sql`
   3. `20260521130000_reconcile_drifts.sql`
   4. `20260521130500_g7_evidence_bundle_review_events.sql` tras corregir/revisar la vista
   5. `20260521140000_grc_legacy_sync_triggers.sql`
   6. `20260521150000_aims_assessments_rls.sql`
   7. `20260526195638_libros_societarios_registros_v2.sql`

## Comandos exactos para la siguiente fase

No ejecutar sin confirmación explícita.

```bash
bun run db:check-target
git status --short supabase/migrations
supabase migration list --linked
```

Limpieza local recomendada si se decide mantener los nombres originales de las migraciones `comms` y conservar solo las tres remotas nuevas:

```bash
git restore --source=HEAD -- supabase/migrations

rm supabase/migrations/20260517140831_20260518000001_comms_aggregate_root.sql
rm supabase/migrations/20260517140846_20260518000002_comms_attachments.sql
rm supabase/migrations/20260517140857_20260518000003_comms_recipients.sql
rm supabase/migrations/20260517140916_20260518000004_comms_delivery_events_worm.sql
rm supabase/migrations/20260517140927_20260518000005_portal_memberships_and_schema.sql
rm supabase/migrations/20260517140931_20260518000006_comms_alters_plantillas_agreements.sql
rm supabase/migrations/20260517141038_20260518000008_comms_triggers.sql
rm supabase/migrations/20260517141305_20260518000009_comms_seed_comunicacion_config.sql
rm supabase/migrations/20260517141522_20260518000010_comms_rls_policies_secretaria.sql

git rm supabase/migrations/20260519080000_registry_filings_filing_type.sql
git rm supabase/migrations/20260519080500_materia_catalog_formulacion_cuentas.sql
git rm supabase/migrations/20260519081000_seed_mandatory_books_on_entity_insert.sql

git add supabase/migrations/20260519084442_registry_filings_filing_type.sql
git add supabase/migrations/20260519084617_materia_catalog_formulacion_cuentas.sql
git add supabase/migrations/20260519084945_seed_mandatory_books_on_entity_insert_v2.sql
```

Verificación posterior a la limpieza:

```bash
bun run db:check-target
supabase migration list --linked
supabase db push --linked --dry-run
```

Si ese dry-run funciona, ejecutar tests de schema relevantes:

```bash
bunx vitest run \
  src/test/schema/secretaria-p0-meeting-resolutions-rpc.test.ts \
  src/test/schema/libros-societarios-migration.test.ts \
  src/test/schema/secretaria-consejo-admin-templates-migration.test.ts \
  src/test/schema/f4-platform.test.ts
```

Alternativa menos recomendable: si se decide preservar los timestamps locales `20260519080000/80500/81000` en el historial remoto aunque no se hayan ejecutado como tales, preparar un `supabase migration repair --status applied ...` controlado. Requiere aprobación explícita y justificación, porque duplicaría historial lógico ya cubierto por `20260519084442/84617/84945`.

## Comprobaciones no destructivas

Primera ejecución de `supabase db push --linked --dry-run` terminó con código 1:

```text
DRY RUN: migrations will *not* be pushed to the database.
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
...
20260519080000_registry_filings_filing_type.sql
20260519080500_materia_catalog_formulacion_cuentas.sql
20260519081000_seed_mandatory_books_on_entity_insert.sql
```

Tras la limpieza, `supabase db push --linked --dry-run` terminó con código 0 y listó:

```text
Would push these migrations:
 • 20260521101500_secretaria_rulepacks_lote1_core_fix.sql
 • 20260521102000_secretaria_rulepacks_lote2_schema_fix.sql
 • 20260521130000_reconcile_drifts.sql
 • 20260521130500_g7_evidence_bundle_review_events.sql
 • 20260521140000_grc_legacy_sync_triggers.sql
 • 20260521150000_aims_assessments_rls.sql
 • 20260526195638_libros_societarios_registros_v2.sql
```

Tests schema ejecutados:

```text
Test Files  4 passed (4)
Tests       34 passed (34)
```

Dump remoto:

```text
supabase db dump --linked --file /tmp/arga-migration-reconciliation-20260527/remote-schema-pre-apply.sql
failed to inspect docker image: Cannot connect to the Docker daemon
```

La copia de seguridad local de ficheros sí quedó generada. Para backup de base de datos antes de aplicar, usar snapshot/backup de Supabase o repetir el dump con Docker activo.

## Referencias Supabase consultadas

- Supabase CLI reference - `migration list` / `migration fetch`: https://supabase.com/docs/reference/cli/getting-started
- Supabase changelog CLI: https://supabase.com/changelog?tags=cli
