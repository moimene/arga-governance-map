---
title: Inventario completo de comunicaciones — 51 tipos
date: 2026-05-17
status: Material de soporte de la spec principal
audience: Comité Legal Garrigues · Secretaría · Implementadores
spec_principal: 2026-05-17-comunicaciones-portal-miembro-design.md
---

# Inventario completo de comunicaciones del módulo

Este documento es el material de análisis que sustenta el `tipo_comunicacion` enum (16 valores) y el mapping `comunicacion_config` de la spec principal. **No es la spec arquitectónica** — solo el catálogo de flujos.

Organizado por fase del ciclo de vida del acto societario (pre-sesión → sesión → post-sesión → gestión continua), con distinción entre comunicaciones templadas y libres.

---

## A. Comunicaciones PRE-SESIÓN

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| A1 | Convocatoria Junta General (SA, variante cotizada y 2ª convocatoria) | Templada | Todos los socios/accionistas | `CONVOCATORIA_JUNTA` | Confirmación asistencia / delegación | Arts. 166-177 LSC |
| A2 | Notificación individual de convocatoria JG (SL art. 173) | Templada | Cada socio individualmente | `CONVOCATORIA_SL_NOTIFICACION` | Acuse + confirmación | Art. 173 LSC |
| A3 | Convocatoria Consejo de Administración | Templada | Cada consejero | `CONVOCATORIA_CDA` | Confirmación asistencia | Art. 246 LSC |
| A4 | Convocatoria Comisión Delegada (Auditoría, Nombramientos, Riesgos, Ejecutiva) | Templada | Miembros comisión | `CONVOCATORIA_COMISION_DELEGADA` | Confirmación asistencia | Art. 249 LSC + Reglamento Consejo |
| A5 | Puesta a disposición documentación pre-Junta | Templada / Libre | Socios/accionistas | `INFORME_DOCUMENTAL_PRE` | Solicitud info adicional | Arts. 196-197 LSC |
| A6 | Puesta a disposición documentación pre-Consejo | Templada / Libre | Consejeros | `INFORME_PRECEPTIVO` | Solicitud aclaraciones | Art. 245.3 LSC |
| A7 | Puesta a disposición documentación pre-Comisión | Libre | Miembros comisión | — | Solicitud aclaraciones | Reglamento Consejo |
| A8 | Solicitud declaración conflicto interés (pre-sesión) | Libre | Consejeros con potencial conflicto | — | Declaración firmada SÍ/NO | Art. 229 LSC |
| A9 | Solicitud declaración idoneidad y honorabilidad (pre-nombramiento) | Libre | Candidato a consejero | — | Declaración firmada | Arts. 213-214 LSC + Solvencia II |
| A10 | Circular acuerdo sin sesión | Templada | Consejeros o socios | `ACTA_ACUERDO_ESCRITO` | Voto SÍ/NO/ABSTENCIÓN | Art. 100 RRM |
| A11 | Recordatorio de sesión próxima | Libre | Miembros del órgano convocado | — | Ninguna (informativa) | — |
| A12 | Solicitud delegación voto / representación | Libre | Socio que ha comunicado inasistencia | — | Formulario delegación firmado | Art. 184 LSC |

---

## B. Comunicaciones DURANTE / POST-SESIÓN inmediato

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| B1 | Notificación acuerdos adoptados en Junta | Templada / Libre | Socios (especialmente ausentes) | Derivada de `JUNTA_GENERAL` | Ninguna | — |
| B2 | Notificación acuerdos adoptados en Consejo | Templada / Libre | Consejeros ausentes | Derivada de `CONSEJO_ADMIN` | Ninguna | — |
| B3 | Notificación acuerdos Comisión Delegada | Templada / Libre | Miembros comisión + Consejo | Derivada de `COMISION_DELEGADA` | Ninguna | — |
| B4 | Remisión acta para aprobación (cuando no se aprueba al final) | Libre | Presidente + 2 socios interventores (JG) o Consejo entero | — | Aprobación / observaciones (15 días) | Art. 202 LSC |
| B5 | Certificación de acuerdos | Templada | Destinatario según acto | `CERTIFICACION` / `CERTIFICACION_ACUERDOS` | Acuse | Arts. 108-109 RRM |

---

## C. Comunicaciones de NOMBRAMIENTOS, CESES y CARGOS

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| C1 | Notificación nombramiento consejero (por Junta) | Templada | Consejero nombrado | `NOMBRAMIENTO_CONSEJERO` (Junta) | Aceptación + declaración idoneidad | Arts. 214, 217-219 LSC |
| C2 | Notificación nombramiento por cooptación (por Consejo) | Templada | Consejero cooptado | `NOMBRAMIENTO_CONSEJERO` (Consejo) | Aceptación formal | Art. 244 LSC |
| C3 | Notificación cese consejero (Junta, separación ad nutum) | Templada | Consejero cesado | `CESE_CONSEJERO` (Junta) | Acuse | Art. 223 LSC |
| C4 | Notificación aceptación renuncia (por Consejo) | Templada | Consejero renunciante | `CESE_CONSEJERO` (Consejo) | Acuse | Art. 223.1 LSC |
| C5 | Notificación distribución cargos del Consejo | Templada | Todos los consejeros | `DISTRIBUCION_CARGOS` | Aceptación cargos atribuidos | Art. 245.2 LSC |
| C6 | Notificación constitución/renovación comité interno | Templada | Miembros designados comité | `COMITES_INTERNOS` | Aceptación cargo comité | Arts. 529 terdecies+ LSC |
| C7 | Notificación nombramiento auditor | Templada | Auditor designado | `NOMBRAMIENTO_AUDITOR` | Aceptación | Arts. 263-271 LSC |
| C8 | Notificación delegación facultades / consejero delegado | Templada | Consejero delegado / Comisión Ejecutiva | `DELEGACION_FACULTADES` | Aceptación + declaración límites | Art. 249 LSC |
| C9 | Alerta vencimiento mandato | Libre (sistema) | Consejero + Secretario | — | Informativa | — |

---

## D. Comunicaciones de MATERIAS SUSTANTIVAS

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| D1 | Notificación aprobación cuentas | Templada | Socios + auditor + RM (vía certificación) | `APROBACION_CUENTAS` | Acuse (socios); depósito (RM) | Arts. 272-273 LSC |
| D2 | Notificación distribución dividendos | Templada | Socios/accionistas | `DISTRIBUCION_DIVIDENDOS` | Ninguna | Arts. 273, 348 LSC |
| D3 | Notificación aumento capital | Templada | Socios (DSP) | `AUMENTO_CAPITAL` | Ejercicio / renuncia DSP | Arts. 295-310 LSC |
| D4 | Notificación reducción capital | Templada | Socios + acreedores (oposición) | `REDUCCION_CAPITAL` | Oposición acreedores | Arts. 317-337 LSC |
| D5 | Notificación modificación estatutos | Templada | Socios (texto íntegro) | `MODIFICACION_ESTATUTOS` | Ninguna | Arts. 285-290 LSC |
| D6 | Notificación operación vinculada | Templada | Consejeros + afectado (abstención) | `OPERACION_VINCULADA` | Declaración conflicto / abstención | Arts. 229-230 LSC |
| D7 | Notificación fusión / escisión / transformación | Templada | Socios + acreedores | `FUSION_ESCISION` | Oposición acreedores; voto JG | RDL 5/2023 |
| D8 | Notificación aprobación plan de negocio | Templada | Consejeros + Consejero Delegado | `APROBACION_PLAN_NEGOCIO` | Acuse | — |
| D9 | Notificación política remuneración consejeros | Templada | Consejeros + socios (cotizadas) | `POLITICA_REMUNERACION` | Voto JG (cotizadas) | Arts. 217-219, 529 novodecies LSC |
| D10 | Notificación aprobación políticas corporativas | Templada | Consejeros + áreas afectadas | `POLITICAS_CORPORATIVAS` | Acuse | Art. 529 ter LSC + 249 bis LSC |
| D11 | Notificación ratificación actos | Templada | Persona que realizó el acto | `RATIFICACION_ACTOS` | Acuse | Arts. 234-235 LSC |
| D12 | Notificación seguro responsabilidad consejeros | Templada | Consejeros (beneficiarios) | `SEGUROS_RESPONSABILIDAD` | Acuse + declaración si intra-grupo | Art. 14 LOSSEAR |
| D13 | Notificación activos esenciales | Templada | Socios (art. 160.f) | `ACTIVOS_ESENCIALES` | Voto JG | Art. 160.f LSC |
| D14 | Notificación autorización garantía | Templada | Consejeros + socios si procede | `AUTORIZACION_GARANTIA` | Acuse + abstención si vinculada | Art. 162 LSC |

---

## E. Comunicaciones ÓRGANOS ESPECIALES (unipersonal, solidario, conjunto)

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| E1 | Consignación decisión socio único | Templada | Socio único (confirmación) + RM si inscripción | `ACTA_CONSIGNACION` / `DECISION_SOCIO_UNICO` | Firma | Art. 15 LSC |
| E2 | Consignación decisión administrador único | Templada | Administrador único | `ACTA_CONSIGNACION` / `DECISION_ADMIN_UNICO` | Firma | Art. 233.1 LSC |
| E3 | Comunicación administradores solidarios de actuación | Templada / Libre | Resto administradores solidarios | `ACTA_ORGANO_ADMIN` / `ADMIN_SOLIDARIO` | Acuse; oposición | Art. 227 LSC |
| E4 | Solicitud co-aprobación (admin conjunta) | Templada | Coaprobadores requeridos | `ACTA_DECISION_CONJUNTA` / `CO_APROBACION` | Aprobación / rechazo | Art. 233.2.b LSC |

---

## F. Comunicaciones de GESTIÓN CONTINUA y COMPLIANCE

| # | Comunicación | Tipo | Destinatarios | Plantilla origen | Respuesta | Fundamento legal |
|---|---|---|---|---|---|---|
| F1 | Alerta plazo legal próximo | Libre (sistema) | Secretario + presidente | — | Acción requerida | Varios LSC |
| F2 | Recordatorio formulación cuentas | Libre | Órgano administración | `FORMULACION_CUENTAS` | Acción formulación | Art. 253 LSC |
| F3 | Informe gestión societaria | Templada | Consejeros + presidente | `GESTION_SOCIEDAD` | Informativa | Arts. 253, 262, 273 LSC |
| F4 | Comunicación interna entre órganos (p.ej. C. Auditoría al Consejo) | Libre | Órgano receptor | — | Acuse + acción | Art. 529 quaterdecies LSC |
| F5 | Solicitud información por miembro (derecho info consejero) | Libre (iniciada por miembro) | Secretario / Presidente | — | Respuesta con info | Art. 245.3 LSC |
| F6 | Respuesta a solicitud información | Libre | Miembro solicitante | — | Acuse | Art. 245.3 / 196-197 LSC |
| F7 | Notificación acción social responsabilidad | Templada | Administradores demandados | `ACCION_SOCIAL_RESPONSABILIDAD` | Acuse + efecto destitución | Art. 238.3 LSC |
| F8 | Comunicación ad hoc del secretario (catch-all) | Libre | Cualquier miembro | — | Variable | — |

---

## Resumen cuantitativo

| Categoría | Templadas | Libres | Mixtas | Total |
|---|---|---|---|---|
| A. Pre-sesión | 5 | 5 | 2 | 12 |
| B. Post-sesión | 2 | 2 | 1 | 5 |
| C. Nombramientos/ceses/cargos | 8 | 1 | 0 | 9 |
| D. Materias sustantivas | 14 | 0 | 0 | 14 |
| E. Órganos especiales | 3 | 0 | 1 | 4 |
| F. Gestión continua | 2 | 4 | 1 | 7 |
| **TOTAL** | **34** | **12** | **5** | **51** |

---

## Mapeo a `tipo_comunicacion` enum de la spec principal

| `tipo_comunicacion` | Comunicaciones del inventario |
|---|---|
| `CONVOCATORIA` | A1, A3, A4 |
| `NOTIFICACION_INDIVIDUAL` | A2 |
| `PUESTA_DISPOSICION` | A5, A6, A7 |
| `SOLICITUD_DECLARACION` | A8, A9 |
| `CIRCULAR_SIN_SESION` | A10 |
| `RECORDATORIO` | A11 |
| `NOTIFICACION_ACUERDO` | B1, B2, B3, D1-D14 |
| `REMISION_ACTA` | B4 |
| `CERTIFICACION` | B5 |
| `NOTIFICACION_CARGO` | C1-C8 |
| `ALERTA_VENCIMIENTO` | C9, F1 |
| `CONSIGNACION` | E1, E2 |
| `COMUNICACION_INTER_ORGANO` | E3, E4, F4 |
| `SOLICITUD_INFORMACION` | F5 |
| `RESPUESTA_INFORMACION` | F6 |
| `COMUNICACION_LIBRE` | A12, F8 (catch-all) |

---

## Notas

- **A12** se considera un sub-flujo de `COMUNICACION_LIBRE` porque no hay plantilla específica para "solicitud de delegación" en el catálogo actual de 40. Si se templatiza, pasa a `SOLICITUD_DECLARACION` con `tipo_respuesta_esperada='DELEGACION'`.
- **F1 y C9** son ambas `ALERTA_VENCIMIENTO` aunque sus disparadores difieren: F1 es plazo legal (cron de motor de plazos), C9 es vencimiento de mandato (cron de `condiciones_persona`).
- **F2 (recordatorio formulación cuentas)** es realmente una `RECORDATORIO` con destinatario interno al órgano, no a un miembro individual. Se trata como `RECORDATORIO` con `destinatarios_tipo=MIEMBROS_ORGANO`.
- Las plantillas marcadas como "Templada / Libre" o "Libre" en este inventario se mapean al flag `comunicacion_libre=true` en `communications` cuando se generan sin plantilla activa.
