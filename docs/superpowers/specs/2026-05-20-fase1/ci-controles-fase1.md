# Controles CI Fase 1 - Rule packs

Fecha: 2026-05-21

## Objetivo

Convertir la extraccion Fase 1 en un contrato reproducible: mismo entorno, mismos artefactos, mismos conteos y hashes. El job no ejecuta escrituras en Supabase; solo reconstruye los CSV/JSON/MD mediante PostgREST autenticado y compara contra `fase1_manifest.json`.

## Scripts

```bash
bun run rulepacks:fase1:check-env
bun run rulepacks:fase1:extract
bun run rulepacks:fase1:validate
bun run rulepacks:fase1:lint-gates
bun run rulepacks:fase1:lint-gates:strict
bun run rulepacks:fase1:delta
```

Equivalente con Node directo:

```bash
node scripts/extract-fase1-rulepacks.mjs --check-env-only
node scripts/extract-fase1-rulepacks.mjs --read-only --out tmp/fase1-current
node scripts/validate-fase1-manifest.mjs \
  --manifest docs/superpowers/specs/2026-05-20-fase1/fase1_manifest.json \
  --actual-dir tmp/fase1-current
node scripts/lint-fase1-gates.mjs --dir tmp/fase1-current
node scripts/fase1-delta-tracker.mjs \
  --before docs/superpowers/specs/2026-05-20-fase1 \
  --after tmp/fase1-current \
  --out docs/superpowers/specs/2026-05-20-fase1/delta_tracker.md
```

## Modo estricto para correccion core

El baseline actual conserva `PROBABLE_ERROR_RULE_PACK` y payloads incompletos porque son backlog del siguiente sprint. Por eso el linter normal reporta sin fallar por esos dos contadores. Para convertirlos en gate duro durante la correccion core:

```bash
node scripts/lint-fase1-gates.mjs \
  --dir docs/superpowers/specs/2026-05-20-fase1 \
  --fail-on-probable-errors \
  --fail-on-incomplete
```

En modo estricto tambien fallan los errores de contrato schema/NA: campos obligatorios ausentes o `null`, y arrays vacios donde el mapa semantico no permite NA. El baseline actual falla el modo estricto hasta completar correccion core y saneamiento de payloads.

## Artefactos nuevos

- `patch_plan_probable_error_rule_pack.csv`: backlog filtrado de divergencias a la baja, con accion recomendada por gate.
- `patch_plan_equivalencias_a_la_baja.csv`: backlog secundario de NO_EQUIVALENTE_A_LA_BAJA detectado por el clasificador de equivalencias.
- `payloads_incompletos_checklist.csv`: checklist campo a campo para sanear los payloads incompletos con valor base, NA explicito o mapping.
- `equivalence_review.csv`: salida completa del clasificador EQUIVALENTE / SUB_EQUIVALENTE / NO_EQUIVALENTE / pendiente.
- `delta_tracker.md`: changelog comparativo baseline/current con correcciones resueltas, nuevos hallazgos, incompletos resueltos y hashes modificados.
- `rulepacks_monitor.csv`: snapshot por materia+organo con versiones activas y hashes; si aparece mas de una version activa, el validador falla por `guardrails.fail_on_active_duplicates=true`.

## Workflow

El workflow `.github/workflows/validate-fase1-rulepacks.yml` se ejecuta en PRs que toquen scripts o artefactos de Fase 1 y tambien bajo `workflow_dispatch`. Recalcula en `tmp/fase1-current`, valida hashes/conteos contra el manifest, ejecuta el linter de gates y publica `rulepacks_monitor.csv` como artefacto del run.

## Dry-run de publicacion Cloud

El dry-run de migracion solo debe ejecutarse con credenciales writer y URL directa al puerto `5432`; no usar pooler `6543` en transaction mode.

```bash
export SUPABASE_ACCESS_TOKEN="..."
export SUPABASE_DB_PASSWORD="..."
export PSQL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.hzqwefkwsxopwrmtksbg.supabase.co:5432/postgres?sslmode=require"

bun run db:check-target
supabase db push --db-url "$PSQL" --dry-run
```

Si faltan credenciales, el job debe quedar marcado como bloqueado por entorno, no como fallo funcional del patch. El intento bloqueado debe conservar los logs de:

- `db:check-target`;
- `supabase migration list --linked`;
- error exacto del dry-run;
- extraccion read-only a `/tmp/arga-fase1-current`;
- `validate-fase1-manifest`;
- `lint-fase1-gates`;
- `delta_tracker.md`.

Para Lote 1, el gate post-push es `rulepacks:fase1:lint-gates` con `PROBABLE_ERROR_RULE_PACK=0`. El modo estricto completo se reserva para despues de Lote 2, salvo que se ejecute una variante que falle solo por probables y no por incompletos.

## Gate Lote 2

Despues de aplicar Lote 1 y Lote 2, la rama debe activar el linter completo:

```bash
node scripts/lint-fase1-gates.mjs \
  --dir /tmp/arga-fase1-current \
  --fail-on-probable-errors \
  --fail-on-incomplete
```

Ese modo falla si queda cualquier `PROBABLE_ERROR_RULE_PACK`, `payloads_incompletos` o `schema_contract_errors`. El paquete offline de Lote 2 (`offline-release-lote2`) esta disenado para que el contador de incompletos y contrato schema/NA baje a cero sin introducir duplicados ni equivalencias a la baja.
