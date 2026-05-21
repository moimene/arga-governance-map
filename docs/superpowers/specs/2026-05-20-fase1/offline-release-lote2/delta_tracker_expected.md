# Delta esperado Lote 2 - schema/NA

Este paquete se aplica despues de Lote 1.

## Contadores esperados

| metrica | antes post-Lote-1 | despues Lote 2 | delta |
|---|---:|---:|---:|
| PROBABLE_ERROR_RULE_PACK | 0 | 0 | 0 |
| payloads_incompletos | 22 | 0 | -22 |
| schema_contract_errors | 145 | 0 | -145 |
| duplicados | 0 | 0 | 0 |
| patch_plan_equivalencias_a_la_baja | 0 | 0 | 0 |

## Alcance

El SQL sanea 33 versiones activas: las 22 versiones que seguiran incompletas tras Lote 1 y las versiones adicionales que solo tenian errores de contrato schema/NA.

Los cambios esperados son estructurales: `NA` explicito en campos no aplicables a organos no-Junta, estructura canonica de convocatoria en Junta General, documentos obligatorios `NA` donde el checklist lo permite, y normalizacion canonica de `postAcuerdo` en `SOCIEDAD_UNIPERSONAL`.
