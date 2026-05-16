# Platform Supabase baseline active align

Fecha: 2026-05-16

## Objetivo

Alinear el directorio activo `supabase/migrations` con el ledger remoto exportado y revisado en los PRs documentales de baseline historico, sin ejecutar escrituras Cloud.

## Punto de partida

- PR #29 mergeado: export read-only del ledger remoto.
- PR #30 mergeado: analisis `plantillas-overrides-baseline`.
- PR #31 mergeado: analisis `agenda-kind-baseline`.
- PR #32 mergeado: analisis `personas-cargos-baseline`.
- PR #33 mergeado: analisis `pre-may09-baseline`.
- Tramo reciente Secretaria 360 ya alineado: `20260514174503` a `20260515183150`.

## Accion Git-only

- Se copiaron al directorio activo los SQL exportados del ledger remoto bajo `docs/superpowers/ledger-baseline/remote`.
- Se retiraron del directorio activo los ficheros legacy pre-`20260514` que no representan el ledger remoto.
- Los ficheros legacy retirados quedan preservados en:
  `docs/superpowers/retired-migrations/historical-baseline-pre-20260514/`

## Conteo

- Migraciones activas tras alineacion: 125.
- Migraciones legacy retiradas y preservadas: 66.

## Verificacion ejecutada

- `supabase migration list` read-only.
- `bunx supabase@2.98.2 migration list` read-only para descartar que el resultado fuera solo de la CLI instalada.
- `git diff --check`.
- Scan local de secretos sobre `supabase/migrations` y `docs/superpowers/retired-migrations`.
- Ruflo:
  - `bun run agents:mcp:tools`
  - `bun run agents:route -- "...baseline active migration alignment..."`

## Resultado ledger

El ledger queda alineado en todas las versiones historicas y recientes salvo una particularidad heredada:

```text
                 | 20260504       | 20260504
20260504         |                | 20260504
```

La version remota `20260504` existe en `supabase_migrations.schema_migrations` como version de 8 digitos y nombre `000051_secretaria_p0_transactional_rpcs`.

El fichero local valido que la representa es:

```text
supabase/migrations/20260504_000051_secretaria_p0_transactional_rpcs.sql
```

La CLI ordena los ficheros locales por nombre. Por ese orden, `20260504_...` queda despues de `20260504193000...`, mientras que el remoto `20260504` queda antes de `20260504193000`. La comparacion secuencial de la CLI muestra por tanto un remote-only y un local-only con la misma version.

Se probo `20260504.sql`, pero la CLI lo ignora:

```text
Skipping migration 20260504.sql... (file name must match pattern "<timestamp>_name.sql")
```

Conclusion: este caso no puede cerrarse solo con un rename Git-only sin romper el patron aceptado por Supabase CLI. Resolverlo por completo requeriria una decision explicita de ledger, por ejemplo normalizar la version remota a un timestamp de 14 digitos mediante una operacion Cloud controlada. Esa accion queda fuera de este PR.

## Acciones no ejecutadas

- No `supabase db push`.
- No `supabase db pull`.
- No `supabase migration repair`.
- No SQL de escritura.
- No aplicacion de migraciones.
- No cambios funcionales.

## Estado recomendado

- Mantener `supabase db push` bloqueado para cambios generales mientras exista la anomalia `20260504`.
- Permitir trabajo funcional con PRs normales si no requiere operaciones de migracion general.
- Si se quiere desbloquear por completo `db push`, abrir carril separado y explicitamente autorizado para decidir si se normaliza `20260504` en Cloud.
