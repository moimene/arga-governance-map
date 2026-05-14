# Secretaria Societaria - matriz de integraciones externas

**Fecha:** 2026-05-14
**Contexto:** piloto productivo solido con stubs/demo controlados.
**Decision:** no activar integraciones productivas sin credenciales, contrato, endpoint validado y autorizacion explicita.

## Matriz real-vs-demo

| Integracion | Estado actual | Que existe en codigo | Bloqueo productivo | Gate requerido |
|---|---|---|---|---|
| EAD Trust QTSP - QES | Preparado como cliente tecnico, pero bloqueado en navegador | `src/lib/qtsp/ead-trust-client.ts`, `src/hooks/useQTSPSign.ts`, motores QES/OCSP demo | `client_credentials` no puede correr en browser; faltan proxy servidor, credenciales y contrato de entorno | Edge Function/server proxy con secretos, idempotencia, auditoria y pruebas sandbox EAD Trust |
| EAD Trust QTSP - ERDS | Preparado como evidencia/notificacion demo | `src/hooks/useERDSNotification.ts`, `no_session_notificaciones` con campos ERDS | falta API/contrato ERDS real y proxy seguro | flujo server-side, estados de entrega reales, reintentos, evidencia verificable |
| Registro Mercantil | Operativo como estado RM y reglas registrales demo | `authority_evidence`, `registry_filings`, chips RM, reglas/documentos registrales | no hay conexion RM real ni presentacion telematica | contrato de integracion, certificado/mandato, sandbox o proveedor autorizado, reconciliacion de estados |
| CNMV/IBEX/cotizada | Operativo como reglas/advertencias y datos demo | `entity_settings`, rule packs LSC/LMV/MAR, bloques CNMV, configuracion cotizada | no hay feed oficial CNMV/IBEX ni reconciliacion automatica | proveedor/fuente oficial, job de ingestion, validacion legal y fallback manual |
| Microsoft Sentinel | Stub de telemetria y SLO local | `src/lib/telemetry.ts`, `src/components/SLODashboard.tsx` | no hay Edge Function OTel ni Data Collection Endpoint configurado | DCE/DCR Sentinel, secreto ingestion, schema OTel, redaccion de PII y runbook incidentes |

## Hallazgos por integracion

### EAD Trust QTSP

El cliente `src/lib/qtsp/ead-trust-client.ts` deja `clientSecret` vacio y lanza `QTSP_SERVER_PROXY_REQUIRED` si se intenta usar `client_credentials` desde browser. Esto es correcto para seguridad: el secreto no debe estar en `VITE_*` ni en cliente.

Requisitos minimos antes de productivo:

- Edge Function o backend server-side para OAuth client_credentials.
- Secretos fuera de bundle: `EAD_TRUST_OKTA_TOKEN_URL`, `EAD_TRUST_CLIENT_ID`, `EAD_TRUST_CLIENT_SECRET`, `EAD_TRUST_SCOPE`, `EAD_TRUST_EVIDENCE_API_BASE_URL`, `EAD_TRUST_SIGNATURE_API_BASE_URL`.
- Idempotency key por documento/acuerdo/notificacion.
- Timeouts, retry con backoff y error taxonomy.
- Persistencia de `srId`, `documentId`, `signatoryIds`, hashes, estado y timestamps.
- Auditoria WORM de peticiones y respuestas relevantes, sin guardar secretos.
- Test sandbox con contrato EAD Trust y fixture documental.

Decision: queda como **stub/demo seguro**, no como integracion productiva.

### Registro Mercantil

El sistema modela estado RM y reglas registrales, pero no presenta documentos ni consulta el RM real. Esto es aceptable para piloto mientras se etiquete como preparacion registral.

Requisitos minimos antes de productivo:

- Definir si la integracion sera directa, mediante tercero autorizado o proceso asistido.
- Validar poderes/certificados necesarios.
- Estados canonicos: `PREPARADO`, `PRESENTADO`, `CALIFICACION_PENDIENTE`, `INSCRITO`, `DEFECTO`, `RETIRADO`.
- Evidencia del envio, acuse, asiento y resolucion.
- Reconciliacion de estado y bloqueo de promocion a "inscrito" sin fuente externa o validacion humana.

Decision: mantener chips `Inscrito/Pendiente RM` como evidencia interna hasta cerrar integracion.

### CNMV / IBEX

El modulo aplica reglas de cotizadas y advertencias LMV/MAR, pero no consume feed oficial. La configuracion de cotizada es dato demo/manual.

Requisitos minimos antes de productivo:

- Fuente oficial o proveedor autorizado.
- Job de ingestion con versionado de fuente y fecha efectiva.
- Validacion legal de reglas dependientes de cotizacion, hechos relevantes y calendarios.
- Fallback manual auditable para cambios urgentes.

Decision: no bloquear piloto; documentar que cotizada/IBEX es estado configurado manualmente.

### Microsoft Sentinel

`src/lib/telemetry.ts` mantiene eventos en memoria y deja comentado el envio a Edge Function/Sentinel. `SLODashboard` muestra estado derivado de eventos locales, no observabilidad productiva.

Requisitos minimos antes de productivo:

- Edge Function `telemetry/events` con autenticacion y rate limits.
- DCE/DCR de Sentinel o Log Analytics workspace aprobado.
- Mapeo OTel/JSON, redaccion de PII y correlacion por tenant.
- Alertas minimas: errores RPC, fallos QTSP/RM, drift de jobs, fallos WORM.
- Runbook de incidente y retencion.

Decision: mantener stub local; no declararlo SIEM productivo.

## Politica de activacion productiva

Una integracion externa solo puede pasar de demo a productiva si cumple:

1. Credenciales y contrato validados.
2. Secretos almacenados server-side, nunca en `VITE_*`.
3. Test sandbox o certificacion de proveedor.
4. Auditoria WORM/retencion definida.
5. Feature flag por tenant.
6. Runbook de error y rollback.
7. Aprobacion explicita de owner tecnico y legal.

## Estado de cierre

**Riesgo cerrado:** el sistema ya no debe comunicarse como si estas integraciones fueran productivas.
**Riesgo residual aceptado:** el piloto mantiene stubs/demo hasta tener dependencias externas reales.
