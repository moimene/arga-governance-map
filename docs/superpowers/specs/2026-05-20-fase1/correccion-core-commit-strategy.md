# Correccion core - estrategia de commits y PR

Fecha: 2026-05-21  
Rama: `feature/rulepacks-core-fix-sprint1`

## Principios

- Un cambio, un commit verificable.
- Separar cambios de payload de artefactos derivados.
- Cada commit debe apuntar a una fila de `patch_plan_probable_error_rule_pack.csv` o `payloads_incompletos_checklist.csv`.
- El rebuild read-only y `fase1_manifest.json` van en commits `chore(specs)`, no mezclados con ajustes de payload.

## Lote 1 - Correcciones a la baja

Commit tipo:

```text
fix(rulepack): EXCLUSION_SOCIO/JG corrige quorum SA reforzado

Motivo: payload a la baja vs LSC base.
Cambio: QUORUM/SA_1A 0.25 -> 0.5; QUORUM/SA_2A 0 -> 0.25.
Fuente: arts. 194/199.b/201.2 LSC.
Trazabilidad: patch_plan_probable_error_rule_pack.csv filas EXCLUSION_SOCIO SA quorum.
Verificacion: rulepacks:fase1:validate; rulepacks:fase1:lint-gates.
```

### Publicacion Cloud con conexion directa 5432

Cuando haya ventana de escritura, evitar el pooler transaccional y usar la conexion writer directa:

```bash
export SUPABASE_ACCESS_TOKEN="..."
export SUPABASE_DB_PASSWORD="..."
export PSQL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.hzqwefkwsxopwrmtksbg.supabase.co:5432/postgres?sslmode=require"

bun run db:check-target
supabase db push --db-url "$PSQL" --dry-run
supabase db push --db-url "$PSQL"
```

Si el CLI sigue bloqueado, usar el paquete offline:

```bash
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/01_preflight.sql
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/02_patch.sql
psql "$PSQL" -v ON_ERROR_STOP=1 -f docs/superpowers/specs/2026-05-20-fase1/offline-release-lote1/03_postflight.sql
```

Guardarrailes obligatorios del paquete:

- preflight por `rule_pack_version_id`, `pack_id`, `version` y `payload_hash` persistido en BD;
- `SELECT ... FOR UPDATE` sobre las 10 versiones objetivo;
- transaccion unica con `lock_timeout` y `statement_timeout`;
- audit WORM en `audit_log` con payload anterior/nuevo y hashes;
- rollback condicionado a audit WORM y match exacto de `current_hash`.

Tras 3-5 items:

```text
chore(specs): rebuild read-only tras lote EXCLUSION_SOCIO/AUMENTO

Actualiza artefactos Fase 1 y fase1_manifest.json.
Incluye delta_tracker.md con conteos antes/despues.
```

## Lote 2 - Payloads incompletos

Agrupar por naturaleza:

- `fix(schema): completa convocatoria JG con antelacion SA/SL`.
- `fix(schema): completa documentacion obligatoria`.
- `fix(schema): aplica NA explicito en campos no aplicables`.
- `fix(schema): mapea mayoria de organo no-Junta`.

Cada commit debe indicar si el valor es minimo legal o `NA` permitido por politica.

El paquete preparado para Lote 2 es:

```text
supabase/migrations/20260521102000_secretaria_rulepacks_lote2_schema_fix.sql
docs/superpowers/specs/2026-05-20-fase1/offline-release-lote2/
```

Este lote debe ejecutarse despues de Lote 1. El preflight exige que las 6 filas solapadas con Lote 1 esten en el hash post-Lote-1 previsto; si no, aborta. El alcance cubre las 22 versiones que seguiran incompletas tras Lote 1 y las versiones adicionales que solo tienen errores `schema_contract_errors`, hasta dejar el modo `lint-gates:strict` en verde.

## Delta tracker

Flujo local por bloque:

```bash
node scripts/extract-fase1-rulepacks.mjs --read-only --out /tmp/arga-fase1-current
bun run rulepacks:fase1:delta
```

El tracker compara:

- `PROBABLE_ERROR_RULE_PACK`
- `payloads_incompletos`
- `schema_contract_errors`
- `divergencias_total`
- `duplicados`
- cambios de `payload_hash` por materia/organo

Salida:

- `docs/superpowers/specs/2026-05-20-fase1/delta_tracker.md`

## Gate final del sprint

```bash
bun run rulepacks:fase1:validate
bun run rulepacks:fase1:lint-gates
git diff --check
```

DoD:

- `PROBABLE_ERROR_RULE_PACK = 0`
- `payloads_incompletos` no aumenta en Lote 1
- `schema_contract_errors` no aumenta en Lote 1
- manifest reproducible con hashes actualizados

`bun run rulepacks:fase1:lint-gates:strict` es el gate final de correccion core completa, no de Lote 1 aislado, porque tambien falla por `payloads_incompletos` y errores de contrato que pertenecen a Lote 2.
