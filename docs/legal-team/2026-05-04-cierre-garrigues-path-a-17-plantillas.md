# Addendum de cierre Garrigues — Path A completo 17 plantillas legacy

**Fecha de recepción:** 2026-05-04  
**Documento recibido:** `/Users/moisesmenendez/Downloads/ENTREGABLE_COMPLETO_CIERRE_LEGAL_17_PLANTILLAS_LEGACY_PATH_A.docx`  
**Alcance real del documento:** cierre legal completo de las 17 plantillas legacy Path A.  
**Estado de evidencia:** demo / operativa. No constituye evidencia final productiva.

## Lectura ejecutiva

El entregable completo sustituye el entendimiento anterior basado en el primer DOCX de `FUSION_ESCISION`: Path A queda documentado por Garrigues para las 17 plantillas legacy. Las 3 críticas (`FUSION_ESCISION`, `RATIFICACION_ACTOS`, `SEGUROS_RESPONSABILIDAD`) quedan cubiertas por el documento completo.

El cierre sigue siendo demo-operativo. La firma nominal profesional y el expediente productivo quedan fuera de este alcance si el módulo pasa a producción.

## Inventario confirmado

| Bloque | Plantillas | Decisión |
|---|---|---|
| Críticas | `FUSION_ESCISION`, `RATIFICACION_ACTOS`, `SEGUROS_RESPONSABILIDAD` | Cerrar con Capa 1 corregida y Capa 3 crítica añadida |
| Metadatos null | `COMITES_INTERNOS`, `DISTRIBUCION_CARGOS`, `POLITICA_REMUNERACION`, `POLITICAS_CORPORATIVAS` | Completar `organo_tipo`, `adoption_mode`, `referencia_legal` |
| Materia substantiva | `AUMENTO_CAPITAL`, `MODIFICACION_ESTATUTOS`, `NOMBRAMIENTO_AUDITOR`, `REDUCCION_CAPITAL` | Firmar primera release y documentar riesgos diferidos |
| Cierre rutinario | `APROBACION_PLAN_NEGOCIO`, `CESE_CONSEJERO` x2, `DISTRIBUCION_DIVIDENDOS`, `NOMBRAMIENTO_CONSEJERO` x2 | Normalizar metadatos y firmar |

## Matices incorporados al script trazable

Se ha actualizado `scripts/close-legacy-templates-phase4.ts` para reflejar el entregable completo:

- `SEGUROS_RESPONSABILIDAD`: referencia legal ampliada con CC arts. 1156-1175, Ley 50/1980, LSC, art. 529 ter.h LSC y art. 14 LOSSEAR; `modalidad_cobertura` pasa a obligatorio y se documenta `limite_side_a`.
- `SEGUROS_RESPONSABILIDAD`: bloque condicional intra-grupo reforzado con abstención, soporte de mercado, mayoría aplicable y obligaciones de comunicación cuando procedan.
- `COMITES_INTERNOS`: `articulos_lsc_comite` pasa a obligatorio para evitar placeholder literal.
- `POLITICA_REMUNERACION`: referencia legal ampliada a arts. 217-219 LSC, arts. 529 sexdecies-novodecies, Código de Buen Gobierno CNMV y Solvencia II Pilar 3.
- `POLITICAS_CORPORATIVAS`: referencia legal alineada con art. 529 ter LSC, art. 249 bis LSC y arts. 217-220 LSC.
- `NOMBRAMIENTO_AUDITOR`: referencia a Ley 22/2015 de Auditoría de Cuentas.

## Límites diferidos aceptados por el entregable

| Límite | Estado |
|---|---|
| Desdoblar `FUSION_ESCISION` por subtipo de modificación estructural | Diferido |
| Tipado numérico productivo de importes en seguros/capital/dividendos | Diferido; cubierto por validador Capa 3 donde aplica |
| Especialización de `POLITICAS_CORPORATIVAS` por tipo de política | Diferido |
| Unificación de duplicidades Capa 2/Capa 3 en cese/nombramiento | Diferido |
| Firma nominal profesional productiva | Fuera de alcance demo-operativo |

## Resultado operativo esperado

Tras re-aplicar el cierre:

- 17 plantillas legacy Path A cerradas en Cloud.
- 37 plantillas `ACTIVA` con firma demo-operativa.
- 0 versiones activas no semver.
- 0 `MODELO_ACUERDO` activo con metadatos jurídicos nulos.
- Sin migraciones ni cambios de schema.

