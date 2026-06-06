# Dossier Legal Fase 1 - Rule packs y formal gates

Fecha: 2026-05-20  
Target confirmado: governance_OS (hzqwefkwsxopwrmtksbg)  
Modo: extraccion read-only, sin escrituras en BD

## Resumen ejecutivo

Se han extraido 44 versiones activas de rule packs, sobre 43 materias y 4 tipos de organo. La normalizacion detecta 23 payloads incompletos (47 campos accionables), 74 divergencias preliminares gate x tipo social, 20 PROBABLE_ERROR_RULE_PACK y 0 equivalencias NO_EQUIVALENTE_A_LA_BAJA. No se detectan duplicados activos materia+organo.

## Decisiones P1-P10

| Item | Regla general propuesta | Excepciones por materia | Articulo o referencia | Observaciones |
|---|---|---|---|---|
| Plazo de convocatoria del CdA | [Completar] | [Completar] | [Completar] | Homologar presencial/telematico; canales minimos |
| Segunda convocatoria en SL | [Completar] | [Completar] | [Completar] | Si estatutos permiten segunda convocatoria; plazos |
| Severidad de prerequisitos | [Completar] | [Completar] | [Completar] | Clasificar como BLOCKING, WARNING o INFO |
| Cooptacion, solo SA | Confirmar solo SA | Trato de intento en SL | art. 244 LSC | Rechazar y redirigir a JG si aplica |
| Operaciones vinculadas no cotizadas | [Completar] | [Completar] | [Completar] | Abstenciones y computo de mayorias |
| Comunicacion regulatoria | [Completar] | [Completar] | [Completar] | CNMV, BORME u otros si aplica |
| Mayoria SL, art. 199 LSC | [Completar] | Materias reforzadas | arts. 198 y 199 LSC | Diferenciar un tercio frente a mas de la mitad |
| Duracion auditor, 3-9 anos | Confirmar rango | Excepciones | art. 264 LSC | Tratamiento de propuestas fuera de rango |
| Derecho de informacion | [Completar] | Materias estatutarias | art. 287 LSC | Medios y antelacion |
| BORME y publicaciones | [Completar] | [Completar] | [Completar] | Cuando es requisito habilitante para inscripcion |

## Artefactos de trabajo

- [rulepacks_vigentes_extraccion.jsonl](./rulepacks_vigentes_extraccion.jsonl)
- [rulepacks_vigentes_normalizado.csv](./rulepacks_vigentes_normalizado.csv)
- [lsc_base_gate_tipo_social.csv](./lsc_base_gate_tipo_social.csv)
- [divergencias_gate_tipo_social.csv](./divergencias_gate_tipo_social.csv)
- [patch_plan_probable_error_rule_pack.csv](./patch_plan_probable_error_rule_pack.csv)
- [patch_plan_equivalencias_a_la_baja.csv](./patch_plan_equivalencias_a_la_baja.csv)
- [payloads_incompletos_checklist.csv](./payloads_incompletos_checklist.csv)
- [equivalence_review.csv](./equivalence_review.csv)
- [duplicados_materia_organo.csv](./duplicados_materia_organo.csv)
- [rulepacks_monitor.csv](./rulepacks_monitor.csv)
- [fase1_manifest.json](./fase1_manifest.json)

## Notas tecnicas

- El patch plan principal lista correcciones a la baja frente a LSC base; no aplica cambios en BD.
- El patch plan 2 queda reservado a NO_EQUIVALENTE_A_LA_BAJA detectados por el clasificador.
- La checklist de incompletos separa valor base, NA explicito y mapping de organo no-Junta.
- No se ha ejecutado ningun INSERT, UPDATE, DELETE ni DDL.
