# Addendum de cierre Garrigues — FUSION_ESCISION

**Fecha de recepción:** 2026-05-04  
**Documento recibido:** `/Users/moisesmenendez/Downloads/Cierre_Legal_De_Plantillas_Críticas_TGMS.docx`  
**Alcance real del documento:** cierre legal específico de `MODELO_ACUERDO / FUSION_ESCISION` (`e3697ad9-e0c2-4baf-9144-c80a11808c07`).  
**Estado de evidencia:** demo / operativa; no constituye evidencia final productiva.

> **Nota posterior 2026-05-04:** este addendum queda complementado por el entregable completo `ENTREGABLE_COMPLETO_CIERRE_LEGAL_17_PLANTILLAS_LEGACY_PATH_A.docx`, documentado en `2026-05-04-cierre-garrigues-path-a-17-plantillas.md`.

## Lectura ejecutiva

El informe del equipo Garrigues confirma el diagnóstico de Fase 4: la plantilla `FUSION_ESCISION` debía dejar de apoyarse en referencias genéricas a la LSC para modificaciones estructurales y pasar a citar de forma expresa el Real Decreto-ley 5/2023.

El contenido de este primer DOCX no cerraba `RATIFICACION_ACTOS` ni `SEGUROS_RESPONSABILIDAD`. Esa limitación queda superada por el entregable completo Path A recibido posteriormente, que cubre las 17 plantillas legacy.

## Decisiones incorporadas

| Área | Decisión Garrigues incorporada |
|---|---|
| `organo_tipo` | `JUNTA_GENERAL` |
| `adoption_mode` | `MEETING` |
| `version` | `1.0.0` |
| `referencia_legal` | RDL 5/2023, Libro Primero, Título II, con desglose de régimen general, proyecto común, experto independiente, acuerdo de junta, publicidad e inscripción; LSC para transformación y disolución cuando proceda |
| Capa 1 | Referencia expresa a RDL 5/2023 y cláusula de experto independiente convertida en bloque condicional |
| Capa 3 | `articulos_aplicables` y `requiere_experto` como obligatorios; `nombre_experto` y `fecha_nombramiento_experto` como opcionales |

## Adaptación técnica aplicada

Se ha actualizado `scripts/close-legacy-templates-phase4.ts` para que la reejecución trazable del cierre:

- mantenga la Capa 1 alineada con el informe Garrigues;
- preserve el bloque `{{#if requiere_experto}}` para fusión simplificada o dispensa legal;
- incorpore `articulos_aplicables` como campo Capa 3 obligatorio;
- conserve la frontera demo: el documento queda en preparación registral demo y no implica envío real al Registro Mercantil.

## Límites pendientes

| Límite | Estado |
|---|---|
| Desdoblar fusión/escisión frente a transformación/disolución | Diferido a versión posterior si Legal lo requiere |
| Firma nominal profesional | Pendiente solo para paso a producción |
| Informes equivalentes de `RATIFICACION_ACTOS` y `SEGUROS_RESPONSABILIDAD` | Recibidos posteriormente en el entregable completo Path A |
