# Decisión Comité Legal Garrigues — Path B 16 mejoras versionadas

**Fecha de recepción:** 2026-05-04  
**Alcance:** Path B, 16 mejoras versionadas de plantillas protegidas.  
**Estado de evidencia:** demo / operativa. No constituye evidencia final productiva.  
**Documento base revisado:** `docs/legal-team/2026-05-02-bloque-B-revision-castellano.md`  
**Anexo técnico autorizado:** `docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`

## 1. Decisión global

**Decisión: APROBAR**

Tras revisar el paquete de 16 plantillas mejoradas, se autoriza la aplicación íntegra del Path B: 3 plantillas con texto Capa 1 nuevo y 13 plantillas con bump formal sin cambio sustantivo. Las 3 plantillas con texto nuevo incorporan bloque cotizada condicional, trazabilidad `agreements.id`, referencias QTSP a EAD Trust y disclaimer demo/operativo. Las 13 con bump formal constituyen ratificación de control del Comité sobre el estado actual y generan audit trail documentado.

No se detectan referencias normativas derogadas críticas, nombres reales de cliente ni declaraciones de envío registral real.

## 2. Decisión sobre las 3 plantillas con cambio sustantivo

| Plantilla | Decisión | Observaciones jurídicas | Riesgo residual |
|---|---|---|---|
| `CONVOCATORIA / CONVOCATORIA_JUNTA` | APROBAR | Incorpora bloque condicional cotizada, derecho de información, trazabilidad `agreements.id`, firma QTSP y disclaimer demo/operativo. | Bajo. No declara envío real al Registro Mercantil ni evidencia final productiva. |
| `CONVOCATORIA_SL_NOTIFICACION / NOTIFICACION_CONVOCATORIA_SL` | APROBAR | Adecuada para notificación individual en SL, con prueba de envío demo/operativa, referencia de evento y acuse opcional. | Bajo. El canal queda parametrizado y no hardcodeado. |
| `ACTA_SESION / JUNTA_GENERAL` | APROBAR | Incluye bloque cotizada, recuento por canal, conflictos y pactos por punto, `agreements.id` individual, QTSP y nota de no sustitución de acta notarial cuando proceda. | Bajo. Cubre incidencias telemáticas mediante Capa 3 condicional. |

## 3. Decisión sobre las 13 plantillas con bump formal

**Decisión: AUTORIZAR_BUMP_FORMAL_TODAS**

El bump de versión sin cambio sustantivo de Capa 1 se considera un acto legítimo de ratificación de control. La nueva fila conserva el contenido vigente, queda firmada para demo-operativa y nace en `BORRADOR`; la promoción a `ACTIVA` queda separada.

| # | Plantilla | Autorizar bump | Versión |
|---|---|---:|---|
| 04 | `ACTA_SESION / CONSEJO_ADMIN` | Sí | 1.1.0 → 1.2.0 |
| 05 | `CERTIFICACION / CERTIFICACION_ACUERDOS` | Sí | 1.2.0 → 1.3.0 |
| 06 | `INFORME_DOCUMENTAL_PRE / EXPEDIENTE_PRE` | Sí | 1.0.1 → 1.1.0 |
| 07 | `INFORME_PRECEPTIVO / CONVOCATORIA_PRE` | Sí | 1.0.1 → 1.1.0 |
| 08 | `ACTA_ACUERDO_ESCRITO / ACUERDO_SIN_SESION` | Sí | 1.2.0 → 1.3.0 |
| 09 | `ACTA_CONSIGNACION / DECISION_SOCIO_UNICO` | Sí | 1.1.0 → 1.2.0 |
| 10 | `ACTA_CONSIGNACION / DECISION_ADMIN_UNICO` | Sí | 1.1.0 → 1.2.0 |
| 11 | `ACTA_DECISION_CONJUNTA / CO_APROBACION` | Sí | 1.0.0 → 1.1.0 |
| 12 | `ACTA_ORGANO_ADMIN / ADMIN_SOLIDARIO` | Sí | 1.0.0 → 1.1.0 |
| 13 | `MODELO_ACUERDO / APROBACION_CUENTAS` | Sí | 1.0.0 → 1.1.0 |
| 14 | `MODELO_ACUERDO / FORMULACION_CUENTAS` | Sí | 1.0.0 → 1.1.0 |
| 15 | `MODELO_ACUERDO / DELEGACION_FACULTADES` | Sí | 1.0.0 → 1.1.0 |
| 16 | `MODELO_ACUERDO / OPERACION_VINCULADA` | Sí | 1.0.0 → 1.1.0 |

## 4. Condiciones de aplicación técnica

Ingeniería puede aplicar el paquete técnico Path B sin cambios, bajo estas condiciones:

1. Las nuevas filas deben nacer en estado `BORRADOR`.
2. La promoción a `ACTIVA` requiere paso separado con visto bueno operativo.
3. La versión anterior debe quedar intacta durante esta aplicación inicial para rollback.
4. La aplicación debe ejecutarse solo después de `bun run db:check-target`.
5. No se deben aplicar migraciones ni cambios de schema.

## 5. Confirmaciones expresas

| Verificación | Resultado |
|---|---|
| ARGA se mantiene como pseudónimo demo | Sí |
| EAD Trust es el único QTSP citado | Sí |
| No hay envío real al Registro Mercantil | Sí |
| `PROMOTED` significa preparado para registro/demo, no presentado | Sí |
| No se declara evidencia final productiva | Sí |
| No se detectan referencias normativas derogadas críticas | Sí |

## 6. Firma / cierre

| Campo | Valor |
|---|---|
| Revisor legal | Comité Legal Garrigues — Secretaría Societaria |
| Fecha | 2026-05-04 |
| Alcance de la aprobación | Demo-operativo |
| Comentarios finales | Paquete Path B autorizado íntegramente. Las 3 plantillas con texto nuevo cumplen los estándares de práctica societaria española para uso demo-operativo avanzado. Las 13 con bump formal constituyen ratificación de control legítima. |

## 7. Límites

Este cierre no equivale a firma nominal profesional productiva. Si el módulo pasa a producción, el Comité Legal puede requerir sustitución por firma nominal y expediente de aprobación productivo separado.

## 8. Ejecución técnica

**Fecha de aplicación:** 2026-05-04  
**Script:** `scripts/apply-path-b-templates.ts --apply`  
**Resultado:** 16 nuevas filas `BORRADOR` insertadas en `plantillas_protegidas`.

La aplicación no archivó ni promovió versiones activas. Ese paso queda separado para evitar dejar sin versión `ACTIVA` cualquiera de las 16 plantillas durante el periodo de revisión operativa.
