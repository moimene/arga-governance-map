# Secretaria 360 - Preflight read-only para ejecucion controlada del ledger

Fecha: 2026-05-15  
Rama: `codex/secretaria360-migration-ledger-controlled-execution`  
Base: `origin/main` en `3e87ed7` (`PR #12` mergeado)  
Modo: read-only. No se han ejecutado renombres, `repair`, `db push` ni SQL de escritura.

## Comandos ejecutados

```bash
supabase --version
supabase migration list --help
supabase migration list
supabase migration list --local
find supabase/migrations -maxdepth 1 -type f \( -name '20260514*' -o -name '20260515*' \) -print | sort
wc -c <migraciones-foco>
md5 -q <migraciones-foco>
git diff --name-status origin/main...HEAD
git diff --check
```

Lecturas SQL read-only:

- Cloud via MCP sobre `supabase_migrations.schema_migrations`.
- Cloud via MCP sobre presencia de objetos publicos.
- Local Postgres `127.0.0.1:54322` sobre `supabase_migrations.schema_migrations`.

## Estado de herramientas

- Supabase CLI: `2.75.0`.
- La CLI soporta:
  - `supabase migration list --linked` por defecto.
  - `supabase migration list --local`.
  - `supabase migration repair [version] --status applied|reverted`.
- Hay aviso de version nueva `2.98.2`; no se ha actualizado la CLI.

## Hallazgos del ledger

### Cloud

Cloud tiene aplicadas las versiones canonicas recientes:

| Version | Nombre | Estado |
|---|---|---|
| `20260514174503` | `no_session_source_of_truth_close` | Aplicada |
| `20260515032449` | `persona_alta_integral` | Aplicada |
| `20260515045355` | `agenda_item_v31_taxonomy_fast_track` | Aplicada |
| `20260515070446` | `agenda_driven_minutes_contract` | Aplicada |
| `20260515070447` | `agenda_item_legacy_synthetic_anchors` | Aplicada |
| `20260515132026` | `agenda_item_constancias_multi_tenant_rls` | Aplicada |
| `20260515153057` | `secretaria_normative_maintenance_cloud` | Aplicada |
| `20260515160345` | `secretaria_p2_normative_governance` | Aplicada |

Cloud tambien confirma presencia de objetos esperados para agenda/minutas, persona alta y normativa P1/P2. Los objetos de `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` no existen en Cloud:

- `fn_crear_sociedad_legal_y_capital(uuid,jsonb)`: `false`
- `entities.constitution_date`: `false`
- `entities.onboarding_status`: `false`

### Arbol local de migraciones

Ficheros recientes detectados:

```text
supabase/migrations/20260514181001_secretaria_production_sprint_closeout.sql
supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql
supabase/migrations/20260515022621_persona_alta_integral.sql
supabase/migrations/20260515045355_agenda_item_v31_taxonomy_fast_track.sql
supabase/migrations/20260515070446_agenda_driven_minutes_contract.sql
supabase/migrations/20260515070447_agenda_item_legacy_synthetic_anchors.sql
supabase/migrations/20260515132026_agenda_item_constancias_multi_tenant_rls.sql
supabase/migrations/20260515153057_secretaria_normative_maintenance_cloud.sql
supabase/migrations/20260515160345_secretaria_p2_normative_governance.sql
```

La salida de `supabase migration list` cruza ficheros locales y ledger remoto. En el tramo reciente relevante muestra:

- `20260514174503` solo remoto.
- `20260514` local dos veces, por los ficheros `20260514_000067...` y `20260514_000068...`.
- `20260515022621` solo local.
- `20260515032449` solo remoto.
- `20260515045355`, `20260515070446`, `20260515070447`, `20260515132026`, `20260515153057`, `20260515160345` local y remoto alineados por version.

### Ledger de la base local real

Consulta directa a `postgresql://postgres:postgres@127.0.0.1:54322/postgres`:

- `supabase_migrations.schema_migrations` existe.
- Tiene 128 filas.
- No contiene las versiones foco antiguas `20260514`, `20260515022621`, ni las canonicas recientes `20260514174503`, `20260515032449`.

Conclusion: en esta maquina no hay evidencia de que haga falta `supabase migration repair --local` ahora. El mismatch visible viene del arbol de ficheros contra Cloud, no de un ledger local ya aplicado en esas versiones.

## Comparacion de cuerpos

| Migracion | Cloud chars/hash | Local chars/hash | Lectura |
|---|---:|---:|---|
| `no_session_source_of_truth_close` | `20765`, `8df6000f97cb7269205a376d7f8ba027` | `20766`, `b3d81092cfc992eeb81ad334dc51fea3` | Muy probable equivalencia con diferencia menor de formato/final de linea; requiere diff completo antes de `git mv`. |
| `persona_alta_integral` | `10603`, `f5f77748f1a08f2727182d7af4658ab5` | `10958`, `442ee365adb59626e8fea78a98d594dc` | No es byte-equivalente. No hacer `git mv` ciego; requiere reconstruir o comparar cuerpo remoto completo. |
| `agenda_item_v31_taxonomy_fast_track` | `12135`, `f76b6b33624d75b072a67785bf59b678` | `16978`, `76567533f34286f1262d2531aacfbc89` | Version alineada pero cuerpo remoto puede diferir; queda para PR agenda/minutas, no ledger repair. |
| `agenda_driven_minutes_contract` | marcador manual de `88` chars | `5886`, `a3c463c2a40243152ce28af3d7bb70ad` | No comparable por hash remoto; validar por objetos/tests. |
| `agenda_item_legacy_synthetic_anchors` | marcador manual de `94` chars | `3288`, `b66625df455cf8cb2dd3bf02dcc49996` | No comparable por hash remoto; validar por objetos/tests. |
| `agenda_item_constancias_multi_tenant_rls` | `869`, `0e9d221b3b0ab589354cf1967306593d` | `1182`, `a5551b3820c3063cda11eafdc796133b` | Version alineada; queda para PR agenda/minutas. |
| `secretaria_normative_maintenance_cloud` | marcador manual de `96` chars | `22715`, `acc4bdd3a37d98395839b843490c1348` | No comparable por hash remoto; queda para PR normativa. |
| `secretaria_p2_normative_governance` | marcador manual de `92` chars | `43913`, `028a0263bfb0d0712087b246202d6c2e` | No comparable por hash remoto; queda para PR normativa. |

## Go/no-go

### GO limitado

- Preparar PR de ejecucion Git-only para canonizar nombres, pero solo despues de extraer y comparar los cuerpos remotos completos.
- No proponer repair Cloud.
- No proponer `db push`.

### NO-GO actual

- No ejecutar `git mv` todavia: falta diff completo de `20260514174503` y `20260515032449`.
- No ejecutar `supabase migration repair`: la base local actual no contiene las versiones foco antiguas.
- No tocar `20260514_000067...` ni `20260514181001...`: son pendientes funcionales/local-only y deben decidirse fuera del ledger repair.
- No avanzar agenda/minutas, normativa, doc-gen ni persona alta integral.

## Comandos exactos propuestos para la siguiente autorizacion

### 1. Extraer SQL remoto a `/tmp` sin mostrar secretos

Requiere `SUPABASE_DB_URL` configurado en entorno seguro o una forma autorizada de exportar el resultado MCP a archivo temporal.

```bash
mkdir -p /tmp/arga-ledger

psql "$SUPABASE_DB_URL" -Atc "select array_to_string(statements, E'\\n') from supabase_migrations.schema_migrations where version = '20260514174503'" \
  > /tmp/arga-ledger/20260514174503_no_session_source_of_truth_close.remote.sql

psql "$SUPABASE_DB_URL" -Atc "select array_to_string(statements, E'\\n') from supabase_migrations.schema_migrations where version = '20260515032449'" \
  > /tmp/arga-ledger/20260515032449_persona_alta_integral.remote.sql
```

### 2. Comparar con ficheros locales

```bash
diff -u /tmp/arga-ledger/20260514174503_no_session_source_of_truth_close.remote.sql \
  supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql

diff -u /tmp/arga-ledger/20260515032449_persona_alta_integral.remote.sql \
  supabase/migrations/20260515022621_persona_alta_integral.sql
```

### 3. Si `no_session` es equivalente, renombrar local

```bash
git mv supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql \
  supabase/migrations/20260514174503_no_session_source_of_truth_close.sql
```

### 4. Si `persona_alta_integral` no es equivalente, reconstruir el fichero canonico desde Cloud

```bash
cp /tmp/arga-ledger/20260515032449_persona_alta_integral.remote.sql \
  supabase/migrations/20260515032449_persona_alta_integral.sql

git rm supabase/migrations/20260515022621_persona_alta_integral.sql
```

Si el diff demuestra equivalencia material y se decide conservar el cuerpo local:

```bash
git mv supabase/migrations/20260515022621_persona_alta_integral.sql \
  supabase/migrations/20260515032449_persona_alta_integral.sql
```

### 5. Validar sin push ni repair

```bash
git diff --name-status origin/main...HEAD
git diff --check
supabase migration list
```

El resultado esperado tras los renombres/reconstruccion es:

- `20260514174503` local/remoto alineado.
- `20260515032449` local/remoto alineado.
- `20260514_000067...` y `20260514181001...` siguen local-only hasta decision funcional.
- No hay `repair` ejecutado.

## Estado final de este preflight

- Rama creada: `codex/secretaria360-migration-ledger-controlled-execution`.
- No hay cambios en `origin/main...HEAD` antes de este informe.
- No se ha modificado ninguna migracion.
- No se ha escrito en Cloud.
- No se ha ejecutado `repair`.
- El diff funcional grande sigue sin commit y fuera del carril.
