# Secretaria 360 - Plan de reconciliacion de migraciones recientes Cloud/local

Fecha: 2026-05-15  
Rama de trabajo: `codex/secretaria360-migration-reconciliation-plan`  
HEAD base al iniciar el bloque: `c1d2f60`  
Alcance: tramo reciente afectado por Secretaria 360. No busca paridad 1:1 de todo el historico.

## Restricciones del bloque

- No ejecutar `supabase db push`.
- No ejecutar `supabase migration repair`.
- No aplicar SQL en Cloud.
- No aplicar migraciones locales.
- No renombrar archivos en este bloque.
- No tocar codigo funcional.
- No commitear cambios fuera de `docs/superpowers/plans/`.
- No mostrar ni commitear secretos locales.

## Lecturas realizadas

- `mcp__supabase__.list_migrations` contra Cloud.
- SQL read-only sobre `supabase_migrations.schema_migrations`.
- SQL read-only de presencia de objetos publicos relevantes.
- Lectura local de archivos SQL en `supabase/migrations`.
- `git diff --stat HEAD` y `git diff --name-status HEAD` para comprobar que el diff de higiene ya no esta mezclado.

No se ha ejecutado DDL, DML de escritura, `repair`, `db push` ni migracion alguna.

## Resumen ejecutivo

El remoto contiene aplicadas las migraciones recientes de agenda/minutas, mantenimiento normativo P1 y gobernanza normativa P2. Localmente, esas seis migraciones estan presentes pero sin commit. Hay dos desalineaciones de timestamp/nombre que deben resolverse antes de cualquier `db push`:

1. `no_session_source_of_truth_close`: Cloud esta en `20260514174503`; local tiene contenido equivalente bajo `20260514_000068`.
2. `persona_alta_integral`: Cloud esta en `20260515032449`; local tiene contenido probable/equivalente bajo `20260515022621`.

Ademas, hay una migracion local adyacente no incluida en el foco inicial, `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`, que no aparece aplicada en Cloud y cuyos objetos no existen en Cloud. Debe tratarse como pendiente funcional, no como reconciliacion automatica.

## Tabla local vs remote

| Tema | Local | Remote | Estado observado | Clasificacion | Riesgo | Accion propuesta |
|---|---|---|---|---|---|---|
| Alta sociedad D6 legal/capital | `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` | Sin version remota observada | Objetos `entities.constitution_date`, `entities.onboarding_status` y `fn_crear_sociedad_legal_y_capital(uuid,jsonb)` no existen en Cloud | Local pendiente adyacente | Alto: `db push` intentaria aplicarla antes de tramos posteriores; afecta schema core de sociedades | Dejar fuera de reconciliacion. Llevar a PR funcional de alta sociedad o retirar solo con plan aprobado. No repair Cloud. |
| NO_SESSION source of truth | `20260514_000068_no_session_source_of_truth_close.sql` | `20260514174503_no_session_source_of_truth_close` | Prefijo remoto coincide con el encabezado local. Existe `fn_no_session_cast_response(uuid,uuid,uuid,text,text,text,text)` en Cloud | Equivalente con timestamp distinto | Alto: Cloud ya tiene version distinta; local tiene version no canonica para el remoto | En PR de reconciliacion aprobado: renombrar local a `20260514174503_no_session_source_of_truth_close.sql` o recuperar fichero bajo ese timestamp. No ejecutar repair salvo que una base local/previsualizacion ya tenga registrada la version vieja. |
| Closeout productivo Secretaria | `20260514181001_secretaria_production_sprint_closeout.sql` | Sin version remota observada | Migracion local de hardening/RPCs. No hay counterpart remoto en lista reciente | Local pendiente | Alto: seguridad/RPC grants; podria solaparse con `no_session_source_of_truth_close` pero no es equivalente | Dejar pendiente para PR funcional especifico. Antes de aplicar: revisar grants/RPCs actuales y decidir si se mantiene, se divide o se descarta por supersesion. |
| Persona alta integral | `20260515022621_persona_alta_integral.sql` | `20260515032449_persona_alta_integral` | Cloud tiene `persona_profiles` y `fn_create_persona_completa(uuid,jsonb,text)`. El prefijo remoto empieza en DDL equivalente; el fichero local declara que no se aplica a Cloud desde ese archivo | Equivalente probable con timestamp distinto / parcial pendiente de comparacion final | Alto: mismo nombre funcional, timestamp diferente, riesgo de doble aplicacion | Recuperar fichero local bajo `20260515032449_persona_alta_integral.sql` tras comparar el cuerpo remoto/local. Retirar o renombrar `20260515022621...` solo en PR aprobado. No repair Cloud porque `20260515032449` ya esta aplicada. |
| Agenda item v3.1 taxonomy | `20260515045355_agenda_item_v31_taxonomy_fast_track.sql` (untracked) | `20260515045355_agenda_item_v31_taxonomy_fast_track` | Version/nombre coinciden. `agenda_items` y `agenda_item_constancias` existen en Cloud | Remote aplicado con fichero local no commiteado | Medio: si no se commitea, el repo no representa Cloud | Incluir el fichero en PR agenda/minutas. No aplicar Cloud. No repair. |
| Acta agenda-driven | `20260515070446_agenda_driven_minutes_contract.sql` (untracked) | `20260515070446_agenda_driven_minutes_contract` | Version/nombre coinciden. `minutes.canonical_minutes_hash` existe. Registro remoto contiene marcador de aplicacion manual | Remote aplicado con fichero local no commiteado | Medio/alto: origen manual requiere conservar SQL local para trazabilidad | Incluir el fichero en PR agenda/minutas. Validar con tests/schema smoke, no por hash del registro remoto. |
| Legacy synthetic anchors | `20260515070447_agenda_item_legacy_synthetic_anchors.sql` (untracked) | `20260515070447_agenda_item_legacy_synthetic_anchors` | Version/nombre coinciden. Registro remoto contiene marcador de aplicacion manual | Remote aplicado con fichero local no commiteado | Medio/alto: backfill legacy, sensible a idempotencia | Incluir el fichero en PR agenda/minutas junto al test de idempotencia. No aplicar Cloud. |
| RLS constancias agenda | `20260515132026_agenda_item_constancias_multi_tenant_rls.sql` (untracked) | `20260515132026_agenda_item_constancias_multi_tenant_rls` | Version/nombre coinciden. Tabla existe. El registro remoto conserva el cuerpo SQL | Remote aplicado con fichero local no commiteado | Medio: policy RLS critica, pero version coincide | Incluir el fichero en PR agenda/minutas. Verificar RLS con smoke read-only/rollback en entorno local antes de futuros cambios. |
| P1 mantenimiento normativo Cloud | `20260515153057_secretaria_normative_maintenance_cloud.sql` (untracked) | `20260515153057_secretaria_normative_maintenance_cloud` | Version/nombre coinciden. `secretaria_normative_framework_status` y `secretaria_normative_event_log` existen. Registro remoto contiene marcador de aplicacion manual | Remote aplicado con fichero local no commiteado | Medio/alto: audit/event/backfill, sensible a RLS | Incluir el fichero en PR mantenimiento normativo. No aplicar Cloud. Añadir pruebas schema/RLS en PR. |
| P2 gobernanza normativa | `20260515160345_secretaria_p2_normative_governance.sql` (untracked) | `20260515160345_secretaria_p2_normative_governance` | Version/nombre coinciden. Existen `secretaria_organ_rules`, `secretaria_statute_versions`, `secretaria_normative_overrides`, `materia_template_binding`, `secretaria_effective_rule_matrix`. Registro remoto contiene marcador manual | Remote aplicado con fichero local no commiteado | Medio/alto: muchas tablas/RPCs y permisos | Incluir el fichero en PR mantenimiento normativo/P2. No aplicar Cloud. Validar RLS y RPCs antes de rollout. |

## Clasificacion consolidada

### Equivalente con timestamp distinto

- `20260514_000068_no_session_source_of_truth_close.sql` local frente a `20260514174503_no_session_source_of_truth_close` remoto.
- `20260515022621_persona_alta_integral.sql` local frente a `20260515032449_persona_alta_integral` remoto, pendiente de comparacion final de cuerpo.

### Local pendiente

- `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`.
- `20260514181001_secretaria_production_sprint_closeout.sql`.

### Remote aplicado sin fichero local equivalente commiteado

- `20260515045355_agenda_item_v31_taxonomy_fast_track.sql`.
- `20260515070446_agenda_driven_minutes_contract.sql`.
- `20260515070447_agenda_item_legacy_synthetic_anchors.sql`.
- `20260515132026_agenda_item_constancias_multi_tenant_rls.sql`.
- `20260515153057_secretaria_normative_maintenance_cloud.sql`.
- `20260515160345_secretaria_p2_normative_governance.sql`.

### Parcial/desconocido

- `persona_alta_integral`: Cloud contiene los objetos principales y version remota aplicada, pero debe compararse el SQL completo remoto con el fichero local antes de renombrar o retirar la version local vieja.
- Migraciones registradas con marcador manual (`20260515070446`, `20260515070447`, `20260515153057`, `20260515160345`): no debe usarse el hash de `supabase_migrations.statements` como prueba de equivalencia de contenido. La prueba debe ser por presencia de objetos, tests schema y revision del SQL local.

## Orden recomendado

1. Mantener bloque higiene cerrado y no mezclarlo con este carril.
2. Crear PR solo con este plan de reconciliacion.
3. Crear PR de reconciliacion de nombres/timestamps, sin aplicar Cloud:
   - `20260514_000068` -> `20260514174503`.
   - `20260515022621` -> `20260515032449`, solo tras comparar cuerpo remoto/local.
   - Tratar `20260514_000067` y `20260514181001` como pendientes funcionales, no como equivalentes.
4. PR agenda/minutas:
   - Incluir las cuatro migraciones `20260515045355`, `20260515070446`, `20260515070447`, `20260515132026`.
   - Incluir tests de agenda, acta y RLS relacionados.
5. PR motor plantillas/doc-gen/copilot:
   - Sin migraciones Cloud salvo Edge Function o contrato separado.
6. PR mantenimiento normativo:
   - Incluir `20260515153057` y `20260515160345`.
   - Incluir tests schema/RLS/backfill/eventos.
7. PR persona alta integral:
   - Solo si queda delta funcional real tras reconciliar `20260515032449`.
   - Decidir expresamente si `20260514_000067` se aplica, se divide o se retira.

## Comandos exactos a ejecutar despues, no ejecutados ahora

### Comprobacion inicial

```bash
git status --short --branch
supabase migration list
```

### Comparar cuerpo remoto/local antes de renombrar persona

```sql
select version, name, array_to_string(statements, E'\n') as sql_body
from supabase_migrations.schema_migrations
where version in ('20260514174503', '20260515032449');
```

Guardar la salida en un archivo temporal fuera del repo o ignorado y comparar contra:

```bash
diff -u /tmp/remote-20260514174503.sql supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql
diff -u /tmp/remote-20260515032449.sql supabase/migrations/20260515022621_persona_alta_integral.sql
```

### PR de reconciliacion de nombres, solo tras aprobacion

```bash
git mv supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql \
  supabase/migrations/20260514174503_no_session_source_of_truth_close.sql

git mv supabase/migrations/20260515022621_persona_alta_integral.sql \
  supabase/migrations/20260515032449_persona_alta_integral.sql
```

Si una base local/previsualizacion ya tiene registrada la version antigua, preparar repair local/controlado:

```bash
# NO ejecutar en Cloud sin aprobacion explicita.
supabase migration repair --status reverted 20260514
supabase migration repair --status reverted 20260515022621
```

Nota: `20260514` solo aplica si el CLI registro efectivamente esa version truncada por el nombre `20260514_000068...`. Verificar primero con `supabase migration list`.

### Recuperar migraciones Cloud ya aplicadas como ficheros locales commiteados

```bash
git add supabase/migrations/20260515045355_agenda_item_v31_taxonomy_fast_track.sql
git add supabase/migrations/20260515070446_agenda_driven_minutes_contract.sql
git add supabase/migrations/20260515070447_agenda_item_legacy_synthetic_anchors.sql
git add supabase/migrations/20260515132026_agenda_item_constancias_multi_tenant_rls.sql
git add supabase/migrations/20260515153057_secretaria_normative_maintenance_cloud.sql
git add supabase/migrations/20260515160345_secretaria_p2_normative_governance.sql
```

Estos `git add` deben hacerse en sus PRs funcionales respectivos, no en el PR de este plan.

### Validaciones antes de cualquier futuro `db push`

```bash
git diff --check
bunx vitest run src/test/schema/agenda-item-v31-migrations.test.ts
bunx vitest run src/test/schema/secretaria-normative-maintenance-cloud.test.ts
bunx vitest run src/test/schema/secretaria-p2-normative-governance.test.ts
supabase migration list
```

Solo despues de resolver las desalineaciones del tramo reciente y con aprobacion expresa podria considerarse un `db push`.

## Estado final esperado de este bloque

- Unico cambio commiteable del bloque: este documento.
- Ningun SQL aplicado.
- Ningun fichero SQL renombrado.
- Ningun cambio funcional tocado.
- Diff funcional pendiente queda fuera del PR de este bloque.
- Las migraciones Cloud/local quedan inventariadas y con accion propuesta por riesgo.
