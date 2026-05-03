# Plantilla legacy FUSION_ESCISION — revisión legal 2026-05-02

**UUID Cloud:** e3697ad9-e0c2-4baf-9144-c80a11808c07
**tipo:** MODELO_ACUERDO
**materia:** FUSION_ESCISION
**jurisdiccion:** ES
**organo_tipo actual:** **FALTA**
**adoption_mode actual:** **FALTA**
**version actual:** 1
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** **FALTA**

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Aprobar el proyecto común de {{tipo_operacion_estructural}} de {{denominacion_social}} con {{nombre_sociedad_contraparte}}, conforme al proyecto redactado en fecha {{fecha_proyecto}} y depositado en el Registro Mercantil de {{registro_mercantil}}, de conformidad con lo previsto en los artículos {{articulos_aplicables}} de la Ley de Sociedades de Capital.

SEGUNDO.- Aprobar el balance de {{tipo_operacion_estructural}} de {{denominacion_social}} cerrado a {{fecha_balance_fusion}}, que queda incorporado como Anexo I al acta de la presente sesión.

TERCERO.- Aprobar la relación de canje propuesta de {{relacion_canje}}, conforme al informe del experto independiente {{nombre_experto}} designado por el Registrador Mercantil con fecha {{fecha_nombramiento_experto}}.

CUARTO.- Facultar al Consejero Delegado y al Secretario del Consejo para elevar a escritura pública el presente acuerdo, tramitar las oportunas inscripciones registrales en el Registro Mercantil, realizar cuantos actos y gestiones sean precisos para la completa ejecución de la operación aprobada y, en su caso, subsanar cualquier defecto o calificación registral.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |
| registro_mercantil | entities.registry_location |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| tipo_operacion_estructural | requerido=true | Tipo de operación (fusión/escisión/transformación/disolución) (text) |
| nombre_sociedad_contraparte | requerido=true | Nombre de la sociedad contraparte (text) |
| fecha_proyecto | requerido=true | Fecha del proyecto de operación (date) |
| articulos_aplicables | requerido=false | Artículos LSC aplicables (text) |
| fecha_balance_fusion | requerido=true | Fecha del balance de fusión/escisión (date) |
| relacion_canje | requerido=true | Relación de canje (text) |
| nombre_experto | requerido=false | Nombre del experto independiente (text) |
| fecha_nombramiento_experto | requerido=false | Fecha de nombramiento del experto (date) |

## Lo que el equipo legal tiene que cerrar

- [ ] Validar texto Capa 1 (correcto, vigente, sin nombres reales de cliente).
- [ ] Validar fuentes Capa 2 (todas mapean al resolver actual: entities/agreement/meetings/governing_bodies/persons/capital_holdings/LEY/rule_pack/QTSP/SISTEMA).
- [ ] Validar Capa 3 (obligatoriedades coherentes; sin campos huérfanos respecto a Capa 1).
- [ ] Si organo_tipo actual está FALTA: completar con uno de JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS.
- [ ] Si adoption_mode actual está FALTA: completar con uno de MEETING | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN | CO_APROBACION | SOLIDARIO.
- [ ] Si referencia_legal actual está FALTA: completar con artículos LSC/RRM aplicables.
- [ ] Bumpear version: `0.1.0` → `1.0.0`, `"1"` → `1.0.0`, `1.0.0` → `1.1.0` según corresponda.
- [ ] Firmar: poblar aprobada_por con nombre + colegio + número, fecha_aprobacion con YYYY-MM-DD.

## Riesgos jurídicos detectados

- **organo_tipo NULL**: completar con `JUNTA_GENERAL`. Las modificaciones estructurales (fusión, escisión, transformación, cesión global de activo y pasivo, traslado internacional del domicilio) son competencia exclusiva de la Junta (RDL 5/2023 y antes, Ley 3/2009).
- **adoption_mode NULL**: completar con `MEETING`.
- **referencia_legal NULL**: bloque crítico. Sugerencia: "RDL 5/2023, de 28 de junio, Libro Primero, Título II (Modificaciones estructurales): arts. 1-90 (régimen general); arts. 11-25 (proyecto común); arts. 28-30 (informe del experto independiente); arts. 35-40 (acuerdo de la Junta); arts. 47-50 (publicidad e inscripción). Arts. 318-329 LSC (transformación). Arts. 368-378 LSC (disolución)".
- **DESACTUALIZACIÓN LEGAL CRÍTICA**: el texto Capa 1 cita genéricamente "artículos {{articulos_aplicables}} de la Ley de Sociedades de Capital". Sin embargo, las modificaciones estructurales se rigen ahora por el **RDL 5/2023** (que derogó la Ley 3/2009, BOE 29/06/2023) y NO por la LSC. La plantilla genera ambigüedad jurídica: el secretario podría rellenar "artículos 22-30 LSC" en vez del articulado correcto del RDL 5/2023. Recomendación urgente: modificar la cláusula PRIMERO para citar "el Real Decreto-ley 5/2023, de 28 de junio, sobre modificaciones estructurales" como base normativa principal.
- **Riesgo plantilla genérica para 4 operaciones distintas:** `tipo_operacion_estructural` cubre fusión, escisión, transformación y disolución, cada una con quórum, mayoría, derechos de información y plazos diferentes. Plantilla excesivamente amplia. Riesgo: el motor de reglas no diferencia y el secretario no enforza requisitos específicos. Considerar desdoblamiento en 4 plantillas separadas o, al menos, en 2: (a) fusión/escisión y (b) transformación/disolución.
- **version: `"1"`**: bumpear a `1.0.0` al firmar.
- **Cláusula TERCERO** asume informe de experto independiente. En **fusiones simplificadas** (art. 53 RDL 5/2023, fusión entre matriz y filial 100%) o cuando la junta acuerda unanimidad sobre la dispensa, el experto NO es necesario. Plantilla rígida fuerza su inclusión. Convertir cláusula TERCERO en condicional Handlebars `{{#if requiere_experto}}...{{/if}}`.
- Sin variables huérfanas: las 8 placeholder `{{...}}` están todas declaradas (2 en Capa 2, 8 en Capa 3, con `tipo_operacion_estructural` y `denominacion_social` repetidas).
- Fuentes Capa 2 dentro del resolver canónico (`entities.name`, `entities.registry_location`).
- **Fuente `entities.registry_location`**: confirmar que el campo existe en la tabla `entities` del modelo canónico. No aparece literalmente en el listado del CLAUDE.md, pero el patrón `entities.*` es legítimo. Validar.
