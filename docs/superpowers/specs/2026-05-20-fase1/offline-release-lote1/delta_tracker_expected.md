# Delta tracker esperado - Lote 1 core fix

Baseline: `docs/superpowers/specs/2026-05-20-fase1`  
Current esperado: `/tmp/arga-fase1-current` despues de aplicar `02_patch.sql`

## Resumen esperado

| metrica | antes | despues esperado | delta esperado |
| --- | --- | --- | --- |
| PROBABLE_ERROR_RULE_PACK | 20 | 0 | -20 |
| payloads_incompletos | 23 | 22 | -1 |
| schema_contract_errors | 146 | 145 | -1 |
| divergencias_total | 74 | 54 | -20 |
| duplicados | 0 | 0 | 0 |
| patch_plan_equivalencias_a_la_baja | 0 | 0 | 0 |

## Hashes

Se esperan 10 cambios de `payload_hash` normalizado, uno por cada version activa objetivo:

- `AUMENTO_CAPITAL`
- `CESE_CONSEJERO`
- `ESCISION`
- `EXCLUSION_SOCIO`
- `FUSION`
- `MOD_ESTATUTOS`
- `MODIFICACION_ESTATUTOS`
- `NOMBRAMIENTO_AUDITOR`
- `REDUCCION_CAPITAL`
- `SUPRESION_PREFERENTE`

## Criterio de aceptacion

El delta real debe explicar que los 20 gates a la baja quedan resueltos por elevacion o documentacion canonica, sin nuevos `PROBABLE_ERROR_RULE_PACK`, sin duplicados y sin nuevas equivalencias a la baja. El modo `lint-gates:strict` completo seguira fallando hasta Lote 2 si conserva `--fail-on-incomplete`.
