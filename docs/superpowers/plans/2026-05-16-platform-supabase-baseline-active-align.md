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

El ledger queda alineado en todas las versiones historicas y recientes.

La particularidad heredada `20260504` fue resuelta posteriormente en el carril `codex/platform-normalize-20260504-ledger`:

```text
20260504000051 | 20260504000051 | 2026-05-04 00:00:51
```

Acciones ejecutadas:

```bash
git mv supabase/migrations/20260504_000051_secretaria_p0_transactional_rpcs.sql \
  supabase/migrations/20260504000051_000051_secretaria_p0_transactional_rpcs.sql

supabase migration repair 20260504 --status reverted --linked
supabase migration repair 20260504000051 --status applied --linked
```

No se modifico schema funcional. La intervencion fue solo de representacion local y ledger de migraciones.

## Acciones no ejecutadas

- No `supabase db push`.
- No `supabase db pull`.
- No `supabase migration repair` en el PR original de baseline activo. La normalizacion posterior de `20260504` ejecuto repair controlado solo sobre esas dos versiones.
- No SQL de escritura.
- No aplicacion de migraciones.
- No cambios funcionales.

## Estado recomendado

- `supabase db push` deja de estar bloqueado por drift historico conocido.
- Mantener aun la practica de `--dry-run` antes de cualquier push real.
- Los cambios funcionales con migraciones nuevas deben seguir entrando por PR pequeno y aplicacion controlada.
