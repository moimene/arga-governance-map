# Secretaría 360 D6 Ledger Registration Plan

Fecha: 2026-05-15

## Alcance

Carril: `codex/secretaria360-d6-ledger-registration-plan`

Objetivo único: decidir cómo registrar/reconciliar `20260515183150` en `supabase_migrations` después de la aplicación SQL puntual de D6.

Este documento no ejecuta `repair`, no escribe SQL y no toca migraciones locales.

## Estado funcional Cloud

La aplicación SQL puntual de:

```text
supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql
```

ya terminó con `COMMIT`.

Verificación read-only posterior:

```text
entities: 27/27 columnas D6 presentes
chk_entities_onboarding_status: presente
fn_crear_sociedad_legal_y_capital(uuid,jsonb): presente
authenticated EXECUTE: true
onboarding_status: 34 filas OPERATIVA
```

Hash del fichero versionado en `origin/main`:

```text
84fad0d2f7ca91be56a35ac435e91992bb80eeae2f932ba92fdc54888dc911e9
```

## Estado ledger

Consulta read-only:

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20260515183150'
   or name = 'secretaria_d6_crear_sociedad_legal_y_capital';
```

Resultado:

```text
0 filas
```

`supabase migration list` muestra:

```text
20260515183150 |                | 2026-05-15 18:31:50
```

Por tanto:

- Los objetos D6 existen en Cloud.
- La versión `20260515183150` no está registrada como aplicada.
- El fichero Git existe en `origin/main`.

## Sintaxis CLI verificada

`supabase migration repair --help`:

```text
Usage:
  supabase migration repair [version] ... [flags]

Flags:
      --linked                          Repairs the migration history of the linked project. (default true)
      --local                           Repairs the migration history of the local database.
      --status [ applied | reverted ]   Version status to update.
```

No se ejecutó `repair`.

## Opción recomendada

Registrar `20260515183150` como aplicada mediante Supabase CLI repair, porque:

- El SQL ya está materializado en Cloud.
- El fichero existe en `origin/main`.
- `migration list` muestra una única fila local-only para esa versión.
- El objetivo no es aplicar SQL, sino alinear el ledger con una aplicación manual ya completada.

Comando exacto propuesto, no ejecutar sin autorización:

```bash
supabase migration repair 20260515183150 --status applied --linked
```

Después del comando, verificar:

```bash
supabase migration list | tail -n 30
```

Esperado:

```text
20260515183150 | 20260515183150 | 2026-05-15 18:31:50
```

Y read-only:

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20260515183150';
```

Esperado:

```text
20260515183150 | secretaria_d6_crear_sociedad_legal_y_capital
```

## No usar

No usar:

```bash
supabase db push
supabase db pull
supabase migration repair 20260514181001 --status applied --linked
supabase migration repair 20260514 --status applied --linked
supabase migration repair 20260515022621 --status applied --linked
```

Esas versiones pertenecen a otros carriles o siguen desalineadas.

## Riesgos

| Riesgo | Nivel | Mitigación |
|---|---:|---|
| Marcar aplicada una migración cuyo SQL no está realmente en Cloud | Bajo | Smoke ya confirma columnas, constraint y RPC. |
| `repair` registra `version` pero no `name` esperado | Medio | Verificar `schema_migrations` inmediatamente; documentar resultado exacto. |
| Confundir esto con permiso para `db push` general | Alto | Mantener `db push` bloqueado; todavía hay `20260514181001`, `20260514` y `20260515022621` fuera de alcance. |
| Tocar ledger de otras migraciones | Alto | Ejecutar solo el comando exacto para `20260515183150`. |

## Rollback / no-op

Si el repair se ejecuta por error o se decide revertir solo el marcador de ledger, el comando inverso sería:

```bash
supabase migration repair 20260515183150 --status reverted --linked
```

No ejecutarlo sin autorización explícita. Revertir el marcador no deshace los objetos D6 ya aplicados; solo cambia el ledger.

## Criterio de aceptación

El carril queda cerrado si:

1. Solo se ejecuta `supabase migration repair 20260515183150 --status applied --linked`.
2. `supabase migration list` muestra `20260515183150 | 20260515183150`.
3. `supabase_migrations.schema_migrations` contiene `20260515183150`.
4. No se ejecuta SQL funcional adicional.
5. No se toca `20260514181001`, `20260514`, `persona_alta_integral` ni bloques funcionales.
