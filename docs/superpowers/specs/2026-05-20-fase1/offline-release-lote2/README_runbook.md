# Runbook Lote 2 - schema/NA rule packs

## Alcance

Paquete offline para aplicar `20260521102000_secretaria_rulepacks_lote2_schema_fix.sql` en `governance_OS` despues de cerrar Lote 1. Cierra `payloads_incompletos` y `schema_contract_errors` sin tocar equivalencias a la baja.

## Orden

1. Confirmar writer 5432:
   - `SHOW transaction_read_only;` debe ser `off`.
   - `SELECT pg_is_in_recovery();` debe ser `false`.
2. Ejecutar `01_preflight.sql`.
   - Debe encontrar 33 targets activos.
   - Las 6 filas solapadas con Lote 1 deben estar en `lote1_ready=true`.
3. Ejecutar `02_patch.sql` con `psql "$PSQL" -v ON_ERROR_STOP=1 -f 02_patch.sql`.
4. Ejecutar `03_postflight.sql`.
5. Reconstruir artefactos read-only a `/tmp/arga-fase1-current`.
6. Ejecutar `validate`, `lint-gates:strict` y `delta`.

## Rollback

Usar `04_rollback.sql` solo si falla postflight o delta. El rollback exige que cada fila conserve el `current_hash` auditado por Lote 2; si otro proceso modifico una fila, aborta.

## Criterios de exito

- `payloads_incompletos=0`.
- `schema_contract_errors=0`.
- `PROBABLE_ERROR_RULE_PACK=0`.
- `duplicados=0`.
- `patch_plan_equivalencias_a_la_baja.csv` sigue en 0.
- `lint-gates:strict` verde.
