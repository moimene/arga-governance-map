# Supabase - gobernanza de drift de migraciones

**Fecha:** 2026-05-14
**Proyecto Supabase:** `governance_OS` / `hzqwefkwsxopwrmtksbg`
**Decision:** `supabase db push` queda bloqueado hasta reconciliacion formal.

## Diagnostico

Preflight ejecutado:

```bash
bun run db:check-target
```

Resultado: target correcto `governance_OS / hzqwefkwsxopwrmtksbg`.

Inventario ejecutado:

```bash
supabase migration list --linked
supabase --version
```

Resultado operativo:

- CLI local: `2.75.0`; el CLI informa disponibilidad de `2.98.2`.
- Migraciones remotas en `supabase_migrations.schema_migrations`: 116.
- Primera remota: `20260417121410`.
- Ultima remota: `20260514174503`.
- Ficheros SQL locales en `supabase/migrations`: 68.
- Versiones locales que el CLI ve por prefijo antes del primer `_`: 18.
- Prefijos locales colisionados:
  - `20260419`: 11 ficheros.
  - `20260420`: 6 ficheros.
  - `20260421`: 10 ficheros.
  - `20260423`: 2 ficheros.
  - `20260424`: 10 ficheros.
  - `20260511`: 5 ficheros.
  - `20260512`: 6 ficheros.
  - `20260513`: 7 ficheros.
  - `20260514`: 2 ficheros.

El problema no es solo que falten filas historicas. Muchos ficheros locales usan patron `YYYYMMDD_0000xx_nombre.sql`. Para Supabase CLI, la version es el bloque numerico antes del primer `_`; por tanto multiples migraciones distintas colapsan en la misma version logica. Esto hace inseguro cualquier `db push`, incluso con `--dry-run` como fuente unica de verdad.

## Referencias oficiales revisadas

- Supabase CLI reference: `supabase migration list`, `db push`, `migration repair`, `db pull`, `migration squash`.
  - https://supabase.com/docs/reference/cli/start
- Supabase database migrations guide: workflow de equipo, diagnostico de sync errors, uso de `db pull` y `migration repair`.
  - https://supabase.com/docs/guides/deployment/database-migrations
- Supabase changelog 2026-04-16: `pg-delta` declarative schema management esta en alpha publica, no se adopta para este cierre.
  - https://supabase.com/changelog/44938-public-alpha-declarative-schema-management-with-pg-delta

## Politica inmediata

Hasta cerrar reconciliacion:

1. **No usar `supabase db push` contra Cloud.**
2. **No usar `supabase migration repair` contra Cloud** salvo en una tarea dedicada, con backup y plan de rollback documental.
3. **No renombrar masivamente migraciones historicas** en este ciclo; cambia la relacion Git/Cloud y debe tratarse como operacion de plataforma.
4. Cambios Cloud no destructivos permitidos solo mediante:
   - fichero SQL local revisado,
   - `bun run db:check-target`,
   - aplicacion controlada por MCP/apply SQL,
   - log de aplicacion en `docs/superpowers/plans/`.
5. Nuevas migraciones locales deben usar timestamp completo Supabase:

```text
YYYYMMDDHHMMSS_descripcion.sql
```

No usar `YYYYMMDD_0000xx_descripcion.sql` para nuevas migraciones.

## Estrategias posibles

### Opcion A - Reconciliar historico

Objetivo: alinear `supabase/migrations` con `supabase_migrations.schema_migrations`.

Pasos:

1. Backup logico de schema y de `supabase_migrations.schema_migrations`.
2. Crear branch Supabase o entorno no productivo.
3. Ejecutar `supabase migration list --linked` y exportar tabla completa.
4. Mapear cada cambio remoto a commit/fichero local.
5. Renombrar o reconstruir ficheros locales con timestamp completo cuando el SQL exista localmente.
6. Para cambios remotos sin fichero local, usar `supabase db pull` o dump de schema y crear migracion de baseline.
7. Validar en branch: reset local, diff schema y smoke.
8. Solo entonces considerar `migration repair`.

Ventaja: recupera workflow estandar Supabase.
Riesgo: alto esfuerzo y riesgo de marcar como aplicada una migracion que no corresponde exactamente al estado real.

### Opcion B - Baseline nuevo gobernado

Objetivo: congelar historico legacy y arrancar una nueva linea limpia desde un snapshot del estado Cloud.

Pasos:

1. Crear snapshot/baseline con `supabase db pull` sobre schema acordado.
2. Mover migraciones legacy a carpeta de archivo documental o mantenerlas como historicas no operativas.
3. Crear un README de baseline que declare la fecha, version remota y checksum.
4. Reparar historial solo despues de validar que el baseline representa Cloud.
5. A partir de ahi, nuevas migraciones timestamp completo.

Ventaja: menor coste que reconciliar 116 entradas una a una.
Riesgo: pierde granularidad historica operativa; requiere aceptacion explicita.

### Opcion C - Gobernar MCP/apply SQL sin `db push`

Objetivo: aceptar que el repo actual no es apto para `db push` y operar Cloud mediante cambios revisados.

Pasos:

1. Mantener `db push` prohibido.
2. Cada cambio DDL lleva SQL local, `db:check-target`, apply controlado y log.
3. Revisiones periodicas de drift.
4. Planificar Opcion A o B antes de pasar de piloto a producto.

Ventaja: segura para este piloto y no destructiva.
Riesgo: no cierra la deuda de plataforma; solo la gobierna.

## Decision recomendada

Para el estado actual de Secretaria, adoptar **Opcion C inmediata** y abrir una tarea separada de plataforma para elegir entre **Opcion A** y **Opcion B**. La razon es que el cierre de riesgos de Secretaria no necesita mutar Cloud y el drift historico es mas peligroso que la deuda que pretende cerrar.

## Runbook de migraciones hasta nueva decision

1. Crear SQL local con timestamp completo si hay cambio nuevo.
2. Ejecutar:

```bash
bun run db:check-target
supabase migration list --linked
```

3. Verificar manualmente que el target es `governance_OS / hzqwefkwsxopwrmtksbg`.
4. Si es DDL Cloud, aplicar mediante MCP `_apply_migration` o mecanismo aprobado equivalente.
5. Registrar en doc:
   - nombre de migracion,
   - SQL aplicado,
   - fecha/hora,
   - salida de `db:check-target`,
   - pruebas ejecutadas,
   - razon para no usar `db push`.

## Estado de cierre

**Riesgo critico mitigado:** queda bloqueado `db push`, que era la accion peligrosa.
**Deuda residual aceptada:** reconciliacion historica completa queda fuera de este ciclo y pasa a tarea de plataforma.
