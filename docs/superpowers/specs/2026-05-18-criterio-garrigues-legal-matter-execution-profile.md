# Criterio Garrigues-Legal — MatterExecutionProfile

**Fecha:** 2026-05-18
**Estado:** criterio legal recibido para parametrización técnica.
**Alcance:** criterios P1-P14, prerequisitos, overrides, `risk_flag`, severidad dinámica y versiones duplicadas de rule packs.

Este documento traslada al contrato computable de Secretaría 360 el criterio legal recibido basado en LSC vigente, RRM y RDL 5/2023.

## 1. Respuestas P1-P14

| Pregunta | Criterio propuesto | Impacto computable |
|---|---|---|
| P1. Plazo base SA | SA/SAU 30 días; SL/SLU 15 días; estatutos solo pueden ampliar. | `convocatoria.plazo_minimo_dias`; rule packs por debajo del mínimo se corrigen al mínimo legal y generan gap `INFO` no overridable. |
| P2. Segunda convocatoria SL | Permitida solo con previsión estatutaria. Si no existe override, `false` por defecto con gap `INFO`. | `segunda_convocatoria = true` en SL/SLU solo si `rule_param_overrides.segunda_convocatoria_sl = true`. |
| P3. Proyecto común fusión/escisión | `WARNING` al abrir expediente; `BLOCKING` desde convocatoria. | `MatterPrerequisite.blocking_from_step = CONVOCATORIA`. |
| P4. Delegación facultades y consejero inscrito | `WARNING`, no `BLOCKING`. | Riesgo `CALIFICACION_REGISTRAL`; la inscripción del consejero es declarativa. |
| P5. Cooptación en SL | `BLOCKING` salvo previsión estatutaria; con estatutos baja a `WARNING`. | Sin estatutos: `IMPUGNABILIDAD`; con estatutos: `CALIFICACION_REGISTRAL`. |
| P6. Cese por Consejo | Requiere subtipo obligatorio. | `RENUNCIA`, `CESE_AUTOMATICO` o `PROPUESTA_CESE_A_JUNTA`; `AD_NUTUM` compete a Junta. |
| P7. Operaciones vinculadas no cotizadas | Abstención siempre. | `votacion.abstenciones_obligatorias` aplica a todas las sociedades de capital. |
| P8. Activos esenciales | Verificar umbral 25% y relevancia funcional. | `votacion.veto_checks` para financiación, contratación relevante y garantías. |
| P9. Comunicación regulatoria | Gap informativo en entidades supervisadas; detalle v0.2.0. | `post_acuerdo.comunicacion_regulador` y gap `INFO` cuando el contexto declare entidad supervisada. |
| P10. Doble confirmación UX | Solo para `IMPUGNABILIDAD`, `CALIFICACION_REGISTRAL` y `NULIDAD`. | `TRAZABILIDAD_PARCIAL` queda como warning inline. |
| P11. Autocartera | Materia propia. | Nueva materia futura `ADQUISICION_PROPIA`. |
| P12. Separación/exclusión socio | Dos perfiles independientes. | `SEPARACION_SOCIO` y `EXCLUSION_SOCIO`, diferidos a v0.2.0. |
| P13. Deuda convertible | Subtipo de emisión de obligaciones. | `subtipo_materia = SIMPLE | CONVERTIBLE | CANJEABLES`. |
| P14. Pactos parasociales | Warning contractual, no gate global. | No invalidan el acuerdo societario; se conservan en snapshot. |

## 2. Prerequisitos

| Cadena | Severidad | Criterio |
|---|---:|---|
| `APROBACION_CUENTAS <- FORMULACION_CUENTAS` | `BLOCKING` | Art. 253 LSC. |
| `DISTRIBUCION_DIVIDENDOS <- APROBACION_CUENTAS` | `BLOCKING` | Art. 273 LSC. |
| `DISTRIBUCION_DIVIDENDOS <- FORMULACION_CUENTAS` | eliminar | Redundante por transitividad. |
| `FUSION/ESCISION <- PROYECTO_COMUN` | dinámico | `WARNING` inicial; `BLOCKING` desde convocatoria. |
| `DELEGACION_FACULTADES <- NOMBRAMIENTO_CONSEJERO inscrito` | `WARNING` | Riesgo registral, no validez sustantiva. |
| `CERTIFICACION_ACUERDOS <- ACTA_APROBADA` | `BLOCKING` no overridable | RRM arts. 108-109. |
| `REDUCCION_CAPITAL <- oposicion acreedores resuelta` | `WARNING` | Afecta ejecución/inscripción, no adopción. |

## 3. Overrides estatutarios

| Tipo de norma | Puede hacer el override | No puede hacer |
|---|---|---|
| Imperativa de mínimos | Endurecer. | Relajar el mínimo legal. |
| Dispositiva con opt-in | Activar una facultad estatutaria. | No hay conflicto legal si consta estatutariamente. |
| Atribución competencial discutida | Dar cobertura y reducir riesgo. | Eliminar totalmente el riesgo. |
| Dispositiva con opt-out | Sustituir la regla supletoria cuando la ley lo permite. | Derogar límites imperativos. |

Controles no overridables iniciales:
- Plazo de convocatoria formal inferior al art. 176 LSC.
- Duración de auditor fuera de 3-9 años.
- Mandato de consejero SA superior a 6 años.
- Certificación sin acta aprobada.

## 4. Risk Flags

Prioridad: `NULIDAD` > `IMPUGNABILIDAD` > `CALIFICACION_REGISTRAL` > `TRAZABILIDAD_PARCIAL`.

| Flag | Criterio |
|---|---|
| `NULIDAD` | Acto inexistente, objeto ilícito o contrario al orden público. |
| `IMPUGNABILIDAD` | Defecto que habilita impugnación ex art. 204 LSC. |
| `CALIFICACION_REGISTRAL` | Defecto que puede suspender/denegar inscripción. |
| `TRAZABILIDAD_PARCIAL` | Falta evidencia digital, pero el acto puede ser válido fuera del sistema. |

Si concurren varios flags, el principal es el de mayor gravedad y los demás quedan como `risk_flags_adicionales`.

## 5. Casos De Prueba Legales

Los diez escenarios mínimos quedan como baseline automatizable:

| # | Materia | Órgano | Tipo | Modo | Subtipo | Resultado esperado |
|---:|---|---|---|---|---|---|
| 1 | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | `PASSED_LIMPIO`. |
| 2 | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | Falta formulación: `BLOCKING_GAP`, `TRAZABILIDAD_PARCIAL`. |
| 3 | `CESE_CONSEJERO` | `JUNTA_GENERAL` | SA | `UNIVERSAL` | `AD_NUTUM` | `VIA_ALTERNATIVA`, sin risk flag. |
| 4 | `CESE_CONSEJERO` | `CONSEJO_ADMIN` | SA | `MEETING` | `RENUNCIA` | `PASSED_LIMPIO`. |
| 5 | `NOMBRAMIENTO_CONSEJERO` | `CONSEJO_ADMIN` | SL | `MEETING` | `COOPTACION` | `BLOCKING_GAP`, `IMPUGNABILIDAD`. |
| 6 | `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | Duración 2 años: no overridable, `CALIFICACION_REGISTRAL`. |
| 7 | `MODIFICACION_ESTATUTOS` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | `PASSED_LIMPIO`. |
| 8 | `FUSION_ESCISION` | `JUNTA_GENERAL` | SA | `MEETING` | `FUSION_ABSORCION` | `PASSED_LIMPIO`. |
| 9 | `FUSION_ESCISION` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | Subtipo y proyecto común pendientes: `BLOCKING_GAP`. |
| 10 | `DISTRIBUCION_DIVIDENDOS` | `JUNTA_GENERAL` | SA | `MEETING` | N/A | `PASSED_LIMPIO`. |

## 6. Rule Packs Duplicados

El criterio legal recibido queda así:

| Materia | Mantener | Archivar | Nota |
|---|---|---|---|
| `AUMENTO_CAPITAL` | 1.0.0 completa | `v1.0.0` corta | Mantener versión con convocatoria. |
| `REDUCCION_CAPITAL` | 1.0.0 completa | `v1.0.0` corta | Mantener versión con convocatoria. |
| `APROBACION_CUENTAS` | `v1.0.0` con SA=30 | 1.0.0 con SA=15 | SA=15 contradice art. 176 LSC; antes de archivar, migrar campos de documentación útiles desde la versión completa. |
| `DELEGACION_FACULTADES` | 1.1.0 | 1.0.0 | Añade verificación art. 249 bis. |
| `NOMBRAMIENTO_AUDITOR` | 1.1.0 | 1.0.0 | Añade independencia/propuesta. |
| `OPERACION_VINCULADA` | 1.0.0 | 1.1.0 | Mantener fórmula `presentes_mitad_no_vinculados`. |
| `AUTORIZACION_GARANTIA` | split | no archivar por ahora | Mantener ambas semánticas y separar por `organo_tipo` / `es_activo_esencial`. |
| `RATIFICACION_ACTOS` | 1.1.0 | 1.0.0 | Decisión preliminar: inspección detallada antes de ejecutar archivo. |

## 7. Implementación Adoptada

El contrato v1 incorpora:
- `workflow_steps_version` y steps formales versionados.
- `blocking_from_step` en prerequisitos.
- `overridable: false` para mínimos imperativos mecánicos.
- `resolveRiskFlag()` con prioridad de flags.
- Corrección defensiva del plazo legal mínimo frente a rule packs o overrides inferiores.
- Gap `INFO` para segunda convocatoria SL sin override estatutario.
- Campo `post_acuerdo.comunicacion_regulador` para entidades supervisadas.

Quedan diferidos a v0.2.0: autocartera, exclusión/separación de socio, deuda convertible detallada, comunicación regulatoria sectorial por materia y perfiles de disolución/liquidación.
