# Runbook Lote 1 core fix - Secretaria 360

Fecha paquete: 2026-05-21  
Target: `governance_OS` (`hzqwefkwsxopwrmtksbg`)  
Migracion fuente: `20260521101500_secretaria_rulepacks_lote1_core_fix`

## Alcance

Corrige los 20 `PROBABLE_ERROR_RULE_PACK` de Fase 1, agrupados en 10 versiones activas de `public.rule_pack_versions`. No aborda Lote 2 (`payloads_incompletos` / `schema_contract_errors`) salvo la mejora colateral de `CESE_CONSEJERO` al completar su documentacion obligatoria.

## Prerrequisitos

- Operar contra `governance_OS`, no contra `supabase_nda`.
- Usar conexion writer directa a Postgres 5432:
  `postgresql://postgres:<SUPABASE_DB_PASSWORD>@db.hzqwefkwsxopwrmtksbg.supabase.co:5432/postgres?sslmode=require`
- Tener `SUPABASE_DB_PASSWORD` valido. Si se usa CLI tambien se necesita `SUPABASE_ACCESS_TOKEN`.
- Ejecutar desde una ventana controlada. Duracion esperada: menos de 5 minutos.
- Generar snapshot read-only previo:

```bash
node scripts/extract-fase1-rulepacks.mjs --read-only --out /tmp/arga-fase1-before
node scripts/validate-fase1-manifest.mjs \
  --manifest docs/superpowers/specs/2026-05-20-fase1/fase1_manifest.json \
  --actual-dir /tmp/arga-fase1-before
node scripts/lint-fase1-gates.mjs --dir /tmp/arga-fase1-before
```

## Ejecucion

```bash
export PSQL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.hzqwefkwsxopwrmtksbg.supabase.co:5432/postgres?sslmode=require"

psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/01_preflight.sql
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/02_patch.sql
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/03_postflight.sql
```

`02_patch.sql` ejecuta una unica transaccion con:

- `lock_timeout = 5s`
- `statement_timeout = 90s`
- preflight drift-aware por `rule_pack_version_id`, `pack_id`, `version` y `payload_hash` persistido en BD
- `SELECT ... FOR UPDATE` sobre las 10 filas objetivo
- `UPDATE` idempotente solo si el hash previo coincide
- insercion WORM en `public.audit_log` con `before_payload`, `after_payload`, `previous_hash`, `current_hash`

## Reconstruccion post-cambio

```bash
node scripts/extract-fase1-rulepacks.mjs --read-only --out /tmp/arga-fase1-current
node scripts/validate-fase1-manifest.mjs \
  --manifest docs/superpowers/specs/2026-05-20-fase1/fase1_manifest.json \
  --actual-dir /tmp/arga-fase1-current
node scripts/lint-fase1-gates.mjs --dir /tmp/arga-fase1-current
node scripts/fase1-delta-tracker.mjs \
  --before docs/superpowers/specs/2026-05-20-fase1 \
  --after /tmp/arga-fase1-current \
  --out docs/superpowers/specs/2026-05-20-fase1/delta_tracker.md
```

Despues de validar, actualizar `fase1_manifest.json` y hashes SHA-256 de artefactos en un commit separado `chore(specs)`.

## Criterios de exito

- `PROBABLE_ERROR_RULE_PACK`: `20 -> 0`
- `duplicados`: `0`
- `patch_plan_equivalencias_a_la_baja.csv`: `0`
- `payloads_incompletos` no aumenta. Esperado: `23 -> 22`.
- `schema_contract_errors` no aumenta. Esperado: `146 -> 145`.
- `delta_tracker.md` muestra 10 cambios de hash y los 20 gates resueltos.

Para Lote 1, el gate duro es `rulepacks:fase1:lint-gates` mas verificacion de `PROBABLE_ERROR_RULE_PACK=0`. El comando `rulepacks:fase1:lint-gates:strict` completo seguira fallando hasta Lote 2 si mantiene `--fail-on-incomplete`.

## Rollback

Activar rollback solo si postflight o delta tracker muestran drift, duplicados, nuevos errores a la baja o incremento de errores de contrato.

```bash
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/04_rollback.sql
node scripts/extract-fase1-rulepacks.mjs --read-only --out /tmp/arga-fase1-rollback
node scripts/lint-fase1-gates.mjs --dir /tmp/arga-fase1-rollback
```

`04_rollback.sql` solo revierte si encuentra 10 entradas WORM del patch y si el hash actual coincide con `current_hash` auditado. Inserta una nueva entrada WORM `SECRETARIA_RULEPACK_LOTE1_CORE_FIX_ROLLBACK`.

## Ruta CLI alternativa

Si el CLI tiene credenciales correctas:

```bash
export SUPABASE_ACCESS_TOKEN="..."
export SUPABASE_DB_PASSWORD="..."
supabase db push --db-url "$PSQL" --dry-run
supabase db push --db-url "$PSQL"
```

Evitar endpoints de pooler `6543` en transaction mode para esta ventana.
