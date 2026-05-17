---
title: Módulo de Comunicaciones a Miembros de Órganos Sociales y Portal del Miembro
date: 2026-05-17
status: Diseño cerrado, pendiente aprobación pre-implementación
audience: Ingeniería · Producto · Comité Legal Garrigues · Operaciones
module: TGMS Secretaría Societaria — Acuerdo 360
related:
  - docs/superpowers/specs/2026-05-17-comunicaciones-inventario-completo.md
  - src/lib/rules-engine/
  - src/lib/secretaria/normative-framework.ts
  - src/lib/secretaria/template-admin/
---

# Módulo de Comunicaciones a Miembros y Portal del Miembro

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto y alcance](#2-contexto-y-alcance)
3. [Arquitectura](#3-arquitectura)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Pipeline de envío](#5-pipeline-de-envío)
6. [Motor de plazos](#6-motor-de-plazos)
7. [Portal del Miembro](#7-portal-del-miembro)
8. [Integración con flujos existentes](#8-integración-con-flujos-existentes)
9. [Phasing](#9-phasing)
10. [Riesgos](#10-riesgos)
11. [Preguntas operativas abiertas](#11-preguntas-operativas-abiertas)
12. [Anexos](#12-anexos)

## Reading guide

- **Decisores**: §1, §2, §9 (phasing), §10 (riesgos), §11 (preguntas operativas).
- **Implementadores**: §3 a §8 (arquitectura completa) y §12.3 (interfaces TypeScript).
- **Comité Legal Garrigues**: §11 y §12.1 (mapping plantillas × `comunicacion_config`).

---

## 1. Resumen ejecutivo

### 1.1 Qué se construye

Un sistema transaccional de comunicaciones bidireccional entre la Secretaría del órgano y los miembros de cada órgano social, con trazabilidad completa (envío, entrega, lectura, respuesta) anclado al motor LSC existente y al QTSP EAD Trust de Garrigues, más un portal autenticado para que el miembro consulte comunicaciones, confirme asistencia, delegue, declare conflictos de interés y ejerza sus derechos de información.

### 1.2 Quién lo usa

- **Secretario del órgano**: programa, envía, monitoriza acuses, gestiona reintentos y comunicaciones libres.
- **Presidente del órgano**: autoriza envío de convocatorias y firma documentos donde corresponde.
- **Miembro del órgano** (consejero, socio, administrador): recibe, consulta, confirma asistencia, delega voto, solicita información y firma declaraciones desde el portal.
- **Asesor externo y observador auditor** (P4): acceso de lectura limitado.
- **Motor del sistema**: genera plazos, dispara recordatorios, evalúa validez.

### 1.3 Decisiones congeladas

| # | Decisión | Resolución |
|---|---|---|
| Q1 | Identidad del miembro multi-tenant | `auth.users` global + `portal_memberships(person_id, tenant_id, entity_id?, rol_portal)` |
| Q2 | Modelo de canales | 3 niveles: `EMAIL_NORMAL` (Resend) / `EMAIL_CERTIFICADO` (Resend + sello QTSP del cuerpo) / `BUROFAX_ERDS` (EAD Trust) |
| Q3 | Tracking P1 | ERDS-only: envío + entrega. Apertura, clic y respuesta se activan en P2 |
| Q4 | `no_session_notificaciones` legacy | Reemplazada por VIEW retrocompatible sobre `communications WHERE tipo_comunicacion='CIRCULAR_SIN_SESION'` |
| Q5 | Hosting del portal | Misma app React, rutas `/portal/*`, `MemberLayout` separado, mismo Supabase project, schema `portal` aislado para RPCs |
| Q6 | Mail service | Resend (EU) para correo; EAD Trust para burofax ERDS |
| Q7 | MFA del portal | TOTP únicamente; recovery codes nativos de Supabase; reset vía `mfa.admin.deleteFactor` |
| §1 | Plazo engine | Extensión de `src/lib/rules-engine/`, no módulo paralelo |
| §1 | Activación selectiva del flag `requiere_comunicacion` | Default `true` para 38/40 plantillas; `false` para `DECISION_SOCIO_UNICO`; condicional para `DECISION_ADMIN_UNICO` |
| §6 | Phasing | P1 backbone universal + 15 plantillas sin respuesta inbound (6 sem + buffer 1 sem); P2 portal v1 con beta cerrada (8 sem); P3 voto a distancia + push + segunda convocatoria (5 sem); P4 firma QES + alertas mandato + admin grupo (4 sem) |

---

## 2. Contexto y alcance

### 2.1 Estado actual del repo

Lo que ya existe y este módulo reutiliza:

- **Marco normativo**: `src/lib/secretaria/normative-framework.ts` + hooks `useEntityNormativeProfile`, `useAgreementNormativeSnapshot`.
- **Motor LSC**: `src/lib/rules-engine/` con `convocatoria-engine`, `votacion-engine`, `orquestador`, etc.
- **Plantillas**: 40 operativas, tabla `plantillas_protegidas`, versionado por `bloques_sectoriales.version` con UNIQUE en `clave_bloque`.
- **EAD Trust QTSP**: `src/lib/qtsp/ead-trust-client`, `qtsp_signature_requests` table, hook `useERDSNotification`.
- **Auth interno**: Supabase email/password sin MFA, roles RBAC en `rbac_user_roles` (SECRETARIO, COMPLIANCE, ADMIN_TENANT, AUDITOR, CONSEJERO).
- **Personas y composición**: `persons` + `persons_profile` (1:1, campos `email`, `phone`, `secondary_email`); composición de órganos en `condiciones_persona` (SSOT canónica, no `governing_body_members`).
- **Audit WORM**: patrones existentes en `audit_log` + `bloque_insertions` con hash chain SHA-512.
- **Evidence**: tabla `evidence_bundles` con `manifest`, `manifest_hash`, `hash_sha512`, `reference_code`. URI sintetizada `evidence_bundle:<id>@<manifest_hash>` (no columna `storage_uri` directa).
- **Notificaciones internas Secretaría**: tabla `notifications` para alertas dashboard; no se reutiliza para comms a miembros.
- **Notificaciones ERDS legacy**: tabla `no_session_notificaciones` con campos ERDS (`erds_evidence_id`, etc.), se subsume por VIEW.

### 2.2 Out-of-scope explícito

Este módulo NO construye:

1. **Multi-jurisdicción (BR/MX/PT)**. Asume jurisdicción ES. Motor de plazos retorna error si `entities.jurisdiction ≠ 'ES'`.
2. **App nativa o PWA**. Portal es web público responsive. Decisión PRD §11.
3. **SSO corporativo (SAML/OIDC)**. Posible Sprint Auth Hardening posterior.
4. **MFA en consola interna Secretaría**. Solo en `/portal/*`. Forzar MFA a Secretaría es proyecto separado.
5. **Internacionalización del portal**. Castellano único en P1-P4.
6. **Encriptación end-to-end del contenido**. TLS + cifrado en reposo Supabase cubren el requisito legal.
7. **Integración con M365 / Google Workspace**. Invitaciones `.ics` se generan; el miembro las añade manualmente.
8. **Chatbot de comunicación con miembros**. Descartado por riesgo legal.
9. **Pagos o facturación**. No se cobran cuotas desde el portal.
10. **Analytics cross-comunicaciones agregado** (tasa respuesta del consejero X en 12 meses). P5+.

### 2.3 Dependencias externas y prerrequisitos

| Dep | Quién resuelve | Cuándo | Estado |
|---|---|---|---|
| FIRMA_LEGAL_BATCH: 4 plantillas de convocatoria firmadas por Comité Legal | Garrigues Legal | Antes de cierre P1 sem 1 | Pendiente (OQ1) |
| Resend account + dominio verificado SPF/DKIM/DMARC + API key en `vault.secrets` | DevOps | P1 sem 1 | Pendiente |
| `net.http_post` habilitado en Postgres + `app.functions_url` configurado | DevOps | Ya operativo | OK |
| EAD Trust contract revisado para volumen P3+ | Garrigues Ops | Antes de P3 | Pendiente (OQ5) |
| `persons.email` actualizado para los ~25-30 miembros activos de ARGA | Secretaría Garrigues | Antes de P2 inicio | Tarea operativa, widget P1 sem 5 da visibilidad |

---

## 3. Arquitectura

### 3.1 Diagrama una página

```
┌─────────────────────────────────────────────────────────────────────┐
│  SECRETARÍA (consola interna, /secretaria/*)                        │
│  ConvocatoriasStepper · TramitadorStepper · ExpedienteAcuerdo       │
│  ReunionStepper · BoardPack · CommunicationsComposer                │
│         │                                                           │
│         │ INSERT communications + recipients + attachments          │
│         │ UPDATE estado=PROGRAMADA + fecha_programada               │
│         │ (envío inmediato: fetch /functions/v1/comms-dispatcher)   │
│         ▼                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────┐
│  pg_cron tick / minute                                              │
│   → net.http_post('/functions/v1/comms-dispatcher')                 │
└─────────┬───────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────┐
│  Edge Function: comms-dispatcher                                    │
│  · Reclama recipients PENDIENTE FOR UPDATE SKIP LOCKED              │
│  · Llama adapter(canal_primario) por recipient                      │
│  · INSERT delivery_events + UPDATE recipient                        │
│  · Trigger AFTER UPDATE recomputa communications.estado             │
└────┬──────────────────┬──────────────────┬──────────────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌──────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Resend   │  │ Resend + sello  │  │ EAD Trust       │
│ Adapter  │  │ QTSP del cuerpo │  │ ERDS Adapter    │
│ EMAIL_   │  │ EMAIL_          │  │ BUROFAX_        │
│ NORMAL   │  │ CERTIFICADO     │  │ ERDS            │
└────┬─────┘  └────────┬────────┘  └─────────┬───────┘
     │ webhook         │ webhook             │ webhook
     ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Edge Functions: webhook-resend  /  webhook-ead-trust               │
│  · Verify HMAC / firma                                              │
│  · INSERT delivery_events (DELIVERED, BOUNCED, OPENED, COMPLAINED)  │
│  · Promover canal_fallback si BOUNCED                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PORTAL DEL MIEMBRO (/portal/*, mismo bundle, schema `portal`)      │
│  · Auth: auth.users global + portal_memberships(person_id, ...)     │
│  · MFA: TOTP obligatorio (AAL2 guard)                               │
│  · Inbox: portal.fn_mi_inbox() SECURITY DEFINER                     │
│  · Acciones: portal.fn_responder_comunicacion / fn_marcar_lectura   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes

**Backend (nuevo en este módulo):**

- Schema `public`: 5 tablas nuevas (`communications`, `communication_recipients`, `communication_delivery_events`, `communication_attachments`, `portal_memberships`) + 1 ALTER (`plantillas_protegidas`) + 1 VIEW (`no_session_notificaciones`).
- Schema `portal`: tabla `portal.access_log` + RPCs SECURITY DEFINER (`fn_mi_inbox`, `fn_mi_comunicacion_detalle`, `fn_responder_comunicacion`, `fn_marcar_lectura`, `fn_mis_entidades`).
- Triggers: WORM en `communication_delivery_events`; validación de plazo pre-INSERT en `communications`; estado agregado AFTER UPDATE en `communication_recipients`; sync `auth.users.raw_app_meta_data.scope`.
- 5 Edge Functions: `comms-dispatcher`, `webhook-resend`, `webhook-ead-trust`, `validate-comm-plazo`, `invite-portal-member`.
- pg_cron job `comms-dispatch-tick` cada minuto.

**Frontend (nuevo):**

- Library `src/lib/comms/` con `MailAdapter` interface, 3 adapters, dispatcher logic, retry policy, types.
- Library `src/lib/rules-engine/comms-plazo-engine.ts` (extensión).
- Hooks: `useCommunication`, `useCommunicationsList`, `useCommsPlazoCheck`, `useCommunicationActions`, `usePortalMembership`, `usePortalInbox`, `usePortalComunicacion`, `useRespuestaComunicacion`, `usePortalEntities`.
- Páginas Secretaría: `/secretaria/comunicaciones`, `/secretaria/comunicaciones/nueva`, `/secretaria/comunicaciones/:id`.
- Directorio nuevo `src/portal/` con `MemberLayout`, `AAL2Guard`, `OnboardingGuard`, 9 páginas portal y 5 componentes formulario.

**Componentes existentes modificados:**

- `ConvocatoriasStepper.tsx`: añadir Paso 9 "Envío a miembros" y CTA "Saltar envío" en Paso 8.
- `TramitadorStepper.tsx`, `ExpedienteAcuerdo.tsx`, `ReunionStepper.tsx` (CierreStep), `BoardPack.tsx`: añadir CTAs que crean comunicaciones.

### 3.3 Flujo clave: programar convocatoria → enviar → entregar → responder

```
1. Secretario completa ConvocatoriaStepper hasta Paso 8 (genera documento).
2. Paso 9 nuevo:
   a. Recipients auto-poblados desde condiciones_persona para body_id.
   b. Secretario ajusta canal_primario + canal_fallback por persona.
   c. Datepicker fecha_programada validado por useCommsPlazoCheck en vivo.
   d. Submit → INSERT communications (estado=PROGRAMADA) + recipients + attachments.
3. Si fecha_programada <= now() + 60s, fetch directo al dispatcher.
4. pg_cron tick (catch-all): dispatcher reclama recipients PENDIENTE.
5. Por cada recipient: adapter.send() → SENT event + UPDATE estado_entrega='ENVIADO'.
6. Webhook proveedor → DELIVERED event + UPDATE fecha_entrega + estado='ENTREGADO'.
7. Trigger recomputa communications.estado agregado.
8. P2+: miembro abre el portal, ve la comm en inbox, RSVP → fn_responder_comunicacion
   → REPLIED event + UPDATE estado_entrega='RESPONDIDO'.
9. Trigger recomputa communications.estado a 'RESPONDIDA_TOTAL'.
```

---

## 4. Modelo de datos

### 4.1 Tablas nuevas

#### `communications` — agregado raíz

```sql
CREATE TABLE communications (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL REFERENCES tenants(id),
  entity_id                   uuid NOT NULL REFERENCES entities(id),
  body_id                     uuid REFERENCES governing_bodies(id),     -- NULL para socio/admin único
  organo_tipo                 text NOT NULL CHECK (organo_tipo IN (
                                'JUNTA_GENERAL','CONSEJO_ADMIN','COMISION_DELEGADA',
                                'SOCIO_UNICO','ADMIN_UNICO','ADMIN_CONJUNTA','ADMIN_SOLIDARIOS')),
  agreement_id                uuid REFERENCES agreements(id),
  meeting_id                  uuid REFERENCES meetings(id),
  template_id                 uuid REFERENCES plantillas_protegidas(id), -- NULL si COMUNICACION_LIBRE
  normative_snapshot_id       uuid,                                       -- nullable; P1 usa metadata.normative_profile JSON
  tipo_comunicacion           text NOT NULL CHECK (tipo_comunicacion IN (
                                'CONVOCATORIA','NOTIFICACION_INDIVIDUAL','PUESTA_DISPOSICION',
                                'SOLICITUD_DECLARACION','CIRCULAR_SIN_SESION','RECORDATORIO',
                                'NOTIFICACION_ACUERDO','REMISION_ACTA','CERTIFICACION',
                                'NOTIFICACION_CARGO','ALERTA_VENCIMIENTO','CONSIGNACION',
                                'COMUNICACION_INTER_ORGANO','SOLICITUD_INFORMACION',
                                'RESPUESTA_INFORMACION','COMUNICACION_LIBRE')),
  tipo_respuesta_esperada     text NOT NULL CHECK (tipo_respuesta_esperada IN (
                                'ACUSE','ACEPTACION','VOTO','DECLARACION','DELEGACION','INFORMATIVA')),
  nivel_certificacion_minimo  text NOT NULL CHECK (nivel_certificacion_minimo IN (
                                'EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS')),
  asunto                      text NOT NULL,
  cuerpo_render               text NOT NULL,                              -- ⚠ NO incluir en SELECT de listado
  cuerpo_hash_sha512          text NOT NULL,
  estado                      text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN (
                                'BORRADOR','PROGRAMADA','ENVIANDO','ENVIADA',
                                'ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
                                'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL',
                                'EXPIRADA','CANCELADA','ERROR')),
  tiene_rebotes               boolean NOT NULL DEFAULT false,
  fecha_programada            timestamptz,
  fecha_envio_efectiva        timestamptz,
  plazo_legal_dias            integer,
  fecha_limite_respuesta      timestamptz,
  comunicacion_libre          boolean NOT NULL DEFAULT false,
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by                  uuid NOT NULL REFERENCES auth.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_communications_tenant_entity ON communications(tenant_id, entity_id);
CREATE INDEX ix_communications_agreement     ON communications(agreement_id) WHERE agreement_id IS NOT NULL;
CREATE INDEX ix_communications_meeting       ON communications(meeting_id)   WHERE meeting_id IS NOT NULL;
CREATE INDEX ix_communications_estado        ON communications(estado);
CREATE INDEX ix_communications_organo_tipo   ON communications(organo_tipo);
```

`metadata` estandariza tres sub-claves:

- `template_snapshot`: shape estricto en [§12.3](#123-interfaces-typescript-clave).
- `normative_profile`: copia frozen del perfil normativo de la entidad al emitir. Mismo shape que `agreements.compliance_snapshot.normative_profile`.
- `convocatoria_extras`, etc.: campos específicos por tipo de comunicación.

#### `communication_attachments` — adjuntos N:1

```sql
CREATE TABLE communication_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id    uuid NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  tipo                text NOT NULL CHECK (tipo IN (
                        'DOCUMENTO_GENERADO','INFORME_PRECEPTIVO','EXPEDIENTE_REF',
                        'TEXTO_INTEGRO','ORDEN_DIA','OTRO')),
  label               text NOT NULL,
  evidence_bundle_id  uuid REFERENCES evidence_bundles(id),     -- FK al bundle si aplica
  storage_uri         text NOT NULL,                            -- ruta real del fichero en Storage
  hash_sha512         text NOT NULL,
  size_bytes          bigint,
  mime_type           text,
  orden               integer NOT NULL DEFAULT 0,
  modo_entrega        text NOT NULL DEFAULT 'ADJUNTO' CHECK (modo_entrega IN ('ADJUNTO','LINK_FIRMADO')),
  signed_url_expiry_hours integer DEFAULT 168,                  -- 7 días default para LINK_FIRMADO
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_attachments_comm ON communication_attachments(communication_id, orden);
```

Por defecto `modo_entrega='ADJUNTO'`. Board pack y attachments >5MB se setean a `LINK_FIRMADO` por el composer, y el adapter inserta una URL firmada en el cuerpo HTML en lugar de adjuntar el binario.

#### `communication_recipients` — una fila por persona destinataria

```sql
CREATE TABLE communication_recipients (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id         uuid NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  person_id                uuid NOT NULL REFERENCES persons(id),
  cargo_en_organo          text,                                       -- snapshot al emitir
  canal_original           text NOT NULL CHECK (canal_original IN (
                             'EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH')),
  canal_primario           text NOT NULL CHECK (canal_primario IN (
                             'EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH')),
  canal_fallback           text CHECK (canal_fallback IS NULL OR canal_fallback IN (
                             'EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH')),
  canal_usado              text CHECK (canal_usado IS NULL OR canal_usado IN (
                             'EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH')),
  destino_primario         text NOT NULL,
  destino_fallback         text,
  estado_entrega           text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_entrega IN (
                             'PENDIENTE','ENVIANDO','ENVIADO','ENTREGADO',
                             'LEIDO','RESPONDIDO','REBOTADO','ERROR')),
  fecha_envio              timestamptz,
  fecha_entrega            timestamptz,
  fecha_lectura            timestamptz,
  fecha_respuesta          timestamptz,
  acuse_evidence_id        uuid REFERENCES evidence_bundles(id),
  acuse_evidence_hash      text,
  respuesta_tipo           text,
  respuesta_payload        jsonb,
  respuesta_firma_qes_id   uuid REFERENCES qtsp_signature_requests(id),
  delegacion_a_person_id   uuid REFERENCES persons(id),
  intento_reenvio_n        integer NOT NULL DEFAULT 0,
  ultimo_error             text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_id, person_id),
  CHECK (canal_fallback IS NULL OR canal_fallback <> canal_primario)
);

CREATE INDEX ix_recipients_person      ON communication_recipients(person_id);
CREATE INDEX ix_recipients_estado      ON communication_recipients(estado_entrega);
CREATE INDEX ix_recipients_delegacion  ON communication_recipients(delegacion_a_person_id)
  WHERE delegacion_a_person_id IS NOT NULL;
```

`canal_original` es inmutable. `canal_primario` se muta cuando se promueve `canal_fallback`. `canal_usado` se popula cuando el adapter confirma entrega. Dashboard muestra badge "fallback" si `canal_original <> canal_usado`.

Trigger `tg_recipient_check_nivel`: en cada INSERT/UPDATE, verifica que `canal_primario` cumple `communications.nivel_certificacion_minimo` (por ejemplo, si la comm exige `EMAIL_CERTIFICADO`, no se permite `canal_primario='EMAIL_NORMAL'`).

#### `communication_delivery_events` — audit trail WORM

```sql
CREATE TABLE communication_delivery_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id             uuid NOT NULL REFERENCES communication_recipients(id) ON DELETE RESTRICT,
  evento                   text NOT NULL CHECK (evento IN (
                             'SENT','DELIVERED','OPENED','CLICKED','BOUNCED',
                             'COMPLAINED','REPLIED','EXPIRED','ERROR')),
  ocurrido_en              timestamptz NOT NULL DEFAULT now(),
  proveedor                text NOT NULL CHECK (proveedor IN ('RESEND','EAD_TRUST','INTERNAL')),
  proveedor_evento_id      text,
  payload                  jsonb,
  hash_prev                text,
  hash_self                text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_delivery_events_recipient ON communication_delivery_events(recipient_id, ocurrido_en);
CREATE INDEX ix_delivery_events_proveedor_evt ON communication_delivery_events(proveedor, proveedor_evento_id);
```

Triggers `BEFORE UPDATE/DELETE`: `RAISE EXCEPTION 'communication_delivery_events es inmutable (WORM)'`.

Hash chain: cada INSERT lee el último evento del mismo recipient con `SELECT … FOR UPDATE` (serialización), computa `hash_self = SHA512(hash_prev || evento || ocurrido_en || payload)`.

#### `portal_memberships` — bridge persons ↔ auth.users

```sql
CREATE TABLE portal_memberships (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id                uuid NOT NULL REFERENCES persons(id),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  entity_id                uuid REFERENCES entities(id),  -- NULL = todas las entidades del tenant donde figure
  rol_portal               text NOT NULL CHECK (rol_portal IN (
                             'MIEMBRO_ORGANO','ASESOR_EXTERNO','OBSERVADOR_AUDITOR')),
  estado                   text NOT NULL DEFAULT 'INVITADO' CHECK (estado IN (
                             'INVITADO','ACTIVO','SUSPENDIDO','BAJA')),
  invited_at               timestamptz NOT NULL DEFAULT now(),
  activated_at             timestamptz,
  last_access_at           timestamptz,
  mfa_enrolled             boolean NOT NULL DEFAULT false,
  mfa_enrolled_at          timestamptz,
  preferences              jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, person_id, tenant_id)
);

COMMENT ON COLUMN portal_memberships.entity_id IS
  'entity_id NULL = acceso a todas las entidades del tenant donde la persona figure en condiciones_persona vigente. entity_id NOT NULL = acceso restringido a esa entidad específica. En ambos casos, tenant_id es obligatorio y acota el perímetro.';
```

Permisos por órgano se derivan en runtime de `condiciones_persona` (SSOT canónica) — no se duplican aquí.

### 4.2 ALTERs en tablas existentes

```sql
ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS requiere_comunicacion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comunicacion_config jsonb DEFAULT NULL;

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS comunicacion_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN agreements.comunicacion_manual IS
  'TRUE si el secretario eligió saltar el envío vía comms module (gestiona canales fuera del sistema). El dashboard no alerta sobre falta de envío programado para estos acuerdos.';
```

Shape canónico de `comunicacion_config` (validado por trigger `tg_validate_comunicacion_config`):

```json
{
  "destinatarios_tipo":         ["MIEMBROS_ORGANO" | "PERSONA_AFECTADA" | "TERCERO_EXTERNO" | "AUDITOR" | "REGISTRO"],
  "tipo_comunicacion_default":  "CONVOCATORIA",
  "tipo_respuesta_esperada":    "ACUSE",
  "nivel_certificacion_minimo": "EMAIL_CERTIFICADO",
  "canales_permitidos":         ["EMAIL_CERTIFICADO", "BUROFAX_ERDS", "PORTAL_PUSH"],
  "plazo_legal_dias":           15,
  "condicional":                false,
  "condicion_expresion":        null,
  "referencia_legal":           "Art. 173 LSC"
}
```

Seed inicial (post-migración):

- `UPDATE plantillas_protegidas SET requiere_comunicacion = false WHERE materia = 'DECISION_SOCIO_UNICO';`
- Resto: `requiere_comunicacion = true` por default + `comunicacion_config` populado según [§12.1](#121-mapping-40-plantillas--comunicacion_config).
- `DECISION_ADMIN_UNICO`: `condicional = true`, `condicion_expresion = "DECISION.comunicacion_interna_detalle IS NOT NULL"`. Evaluación hardcodeada en el composer P1; evaluador genérico de expresiones queda P3.

### 4.3 VIEW de retrocompatibilidad

```sql
CREATE OR REPLACE VIEW no_session_notificaciones AS
SELECT
  cr.id,
  c.id                   AS communication_id,
  c.agreement_id,
  cr.person_id,
  cr.destino_primario    AS recipient_email,
  cr.estado_entrega      AS estado,
  cr.acuse_evidence_id   AS erds_evidence_id,
  cr.acuse_evidence_hash AS erds_evidence_hash,
  cr.fecha_entrega       AS erds_delivered_at,
  cr.canal_usado         AS canal,
  cr.created_at
FROM communication_recipients cr
JOIN communications c ON c.id = cr.communication_id
WHERE c.tipo_comunicacion = 'CIRCULAR_SIN_SESION';
```

`INSTEAD OF INSERT/UPDATE/DELETE` triggers preservan la firma legacy para `useERDSNotification`. Migración incluye backfill de filas existentes de `no_session_notificaciones` a `communications` + `communication_recipients` + `evidence_bundles` referenciados.

### 4.4 Schema `portal` aislado

```sql
CREATE SCHEMA IF NOT EXISTS portal;

GRANT USAGE ON SCHEMA portal TO authenticated;
-- Grants concretos por RPC, no SELECT directo.

CREATE TABLE portal.access_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id),
  person_id                uuid NOT NULL REFERENCES persons(id),
  rpc_name                 text NOT NULL,
  params_hash              text,                                    -- hash de parámetros (no PII)
  result_rows              integer,
  ip_hash                  text,                                    -- hash de IP (privacidad GDPR)
  user_agent_class         text,                                    -- 'mobile','desktop','tablet'
  duration_ms              integer,
  ocurrido_en              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_portal_access_log_user_time ON portal.access_log(user_id, ocurrido_en DESC);
```

Cada RPC SECURITY DEFINER del schema `portal` inserta una fila en `portal.access_log` al final de su ejecución. Esto da audit trail row-level para detectar anomalías (p.ej. un usuario consultando 500 comms en 1 minuto).

### 4.5 Triggers

| Trigger | Tabla | Cuándo | Función |
|---|---|---|---|
| `tg_communications_validate_plazo` | `communications` | BEFORE INSERT/UPDATE | Invoca Edge Function `validate-comm-plazo` vía `net.http_post`. Bloquea si `fecha_programada < min_legal_date`. |
| `tg_communications_recompute_estado` | `communication_recipients` | AFTER UPDATE OF `estado_entrega` | Recomputa `communications.estado` agregado según lógica de [§4.6](#46-máquina-de-estados-y-lógica-agregada). |
| `tg_recipient_check_nivel` | `communication_recipients` | BEFORE INSERT/UPDATE | Valida que `canal_primario` ≥ `communications.nivel_certificacion_minimo`. |
| `tg_delivery_events_worm` | `communication_delivery_events` | BEFORE UPDATE/DELETE | `RAISE EXCEPTION 'inmutable'`. |
| `tg_validate_comunicacion_config` | `plantillas_protegidas` | BEFORE INSERT/UPDATE OF `comunicacion_config` | Valida shape JSON contra schema. |
| `tg_sync_scope_app_meta` | `portal_memberships` y `rbac_user_roles` | AFTER INSERT/UPDATE/DELETE | Recomputa `auth.users.raw_app_meta_data.scope` (`staff`/`member`/`both`/`none`). |

### 4.6 Máquina de estados y lógica agregada

```
   BORRADOR
      │ (programar)
      ▼
   PROGRAMADA ──(cancelar)──▶ CANCELADA
      │ (al menos 1 recipient ENVIANDO)
      ▼
   ENVIANDO
      │ (todos los recipients SENT o ERROR)
      ▼
   ENVIADA ──(todos REBOTADO)──▶ ERROR
      │
      ▼
   ENTREGADA_PARCIAL ──(todos ∈ {ENTREGADO,LEIDO,RESPONDIDO,REBOTADO})──▶ ENTREGADA_TOTAL
      │ (P2+: tipo_respuesta_esperada ≠ INFORMATIVA)
      ▼
   RESPONDIDA_PARCIAL ──(todos respondidos o expirados)──▶ RESPONDIDA_TOTAL
      │ (fecha_limite_respuesta < now() sin todos respondidos)
      ▼
   EXPIRADA
```

Lógica del trigger `tg_communications_recompute_estado`:

```
1. Contar recipients por estado_entrega.
2. Si TODOS = PENDIENTE → no cambiar (aún no enviada).
3. Si ALGUNO = ENVIANDO → communications.estado = 'ENVIANDO'.
4. Si TODOS ∈ {ENVIADO, ENTREGADO, LEIDO, RESPONDIDO, REBOTADO, ERROR}:
   a. Si TODOS = REBOTADO o ERROR → 'ERROR'.
   b. Si MEZCLA con al menos un ENTREGADO/LEIDO/RESPONDIDO → 'ENTREGADA_PARCIAL'.
   c. Si TODOS = ENTREGADO/LEIDO/RESPONDIDO → 'ENTREGADA_TOTAL'.
5. P2+: si tipo_respuesta_esperada ≠ 'INFORMATIVA':
   a. Si TODOS = RESPONDIDO → 'RESPONDIDA_TOTAL'.
   b. Si ALGUNO = RESPONDIDO → 'RESPONDIDA_PARCIAL'.
   c. Si fecha_limite_respuesta < now() y no todos respondidos → 'EXPIRADA'.
6. Si ALGUNO = REBOTADO → comm.tiene_rebotes = true (no bloquea, solo flag warning).
```

### 4.7 Consultas críticas

| Consulta | Cláusula clave | Índice |
|---|---|---|
| Dashboard Secretaría: comms últimas 24h sin `cuerpo_render` | `SELECT id, asunto, estado, organo_tipo, tiene_rebotes FROM communications WHERE tenant_id=$1 AND created_at>now()-'24h'::interval` | `ix_communications_tenant_entity` |
| Inbox portal | `portal.fn_mi_inbox()` RPC SECURITY DEFINER, JOIN recipients × communications filtrado por `person_id IN (mis_persons)` | `ix_recipients_person` |
| Delegaciones para una sesión | `WHERE c.meeting_id=$1 AND cr.delegacion_a_person_id IS NOT NULL` | `ix_recipients_delegacion` |
| Acuses pendientes >24h | `WHERE estado_entrega='ENVIADO' AND fecha_envio < now()-'24h'::interval` | `ix_recipients_estado` |
| Webhook lookup por `proveedor_evento_id` | `WHERE proveedor=$1 AND proveedor_evento_id=$2` | `ix_delivery_events_proveedor_evt` |

### 4.8 Deudas anotadas (no bloqueantes P1)

- `cuerpo_render` grande: si excede ~50 KB típico, mover a `communication_bodies` 1:1 en P3.
- `normative_snapshots` tabla materializada: P3 cuando el motor normativo congele perfiles a tabla. Backfill desde `metadata.normative_profile` JSON.
- `condicion_expresion` evaluator genérico: P3. Las 2 condicionales (DECISION_ADMIN_UNICO + DECISION_SOCIO_UNICO override) van hardcodeadas en el composer P1.
- `communication_delivery_attempts` table: P3 upgrade del fallback escalar a tabla de intentos.

---

## 5. Pipeline de envío

### 5.1 Interface `MailAdapter`

```typescript
// src/lib/comms/adapters/MailAdapter.ts
export interface MailAdapter {
  readonly canalSoportado: 'EMAIL_NORMAL' | 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS';
  send(input: MailSendInput): Promise<MailSendResult>;
}

export interface MailSendInput {
  recipientId: string;
  idempotencyKey: string;                  // hash(recipientId || cuerpo_hash_sha512 || intento_n)
  destino: string;
  asunto: string;
  cuerpoHtml: string;
  cuerpoSha512: string;
  adjuntos: Array<{
    label: string;
    storageUri: string;
    hashSha512: string;
    mimeType: string;
    modoEntrega: 'ADJUNTO' | 'LINK_FIRMADO';
    signedUrlExpiryHours: number;
  }>;
  remitente: { nombre: string; email: string };
  metadata: Record<string, string>;
  tags: Array<{ name: string; value: string }>;   // ej: [{name:'recipient_id', value:cr.id}]
}

export interface MailSendResult {
  ok: boolean;
  proveedor: 'RESEND' | 'EAD_TRUST';
  proveedorEventoId: string;
  evidenceBundleId?: string;
  evidenceHashSha512?: string;
  enviadoEn: string;
  rawProveedorResponse?: unknown;
}

export class MailAdapterError extends Error {
  constructor(
    message: string,
    public readonly canal: string,
    public readonly retriable: boolean,
    public readonly cause?: unknown,
  ) { super(message); }
}
```

### 5.2 Adaptadores concretos

#### `ResendAdapter` — `EMAIL_NORMAL`

- `POST https://api.resend.com/emails` con `to`, `subject`, `html`, `attachments`, `tags`, header `Idempotency-Key`.
- No genera `evidence_bundle` (email normal sin valor probatorio).
- Retorna `proveedorEventoId = resp.id` (Resend message id).
- Mapping de errores: 4xx → `retriable=false`; 5xx/timeout → `retriable=true`.

#### `ResendCertifiedAdapter` — `EMAIL_CERTIFICADO`

Composición de `ResendAdapter` + `QTSPTimestampService` (inyectables para test):

1. Construye `body_to_seal = SHA512(asunto || '\n' || cuerpoHtml || '\n' || concat(adjuntos.hash))`.
2. `eadTrust.getTimestamp(body_to_seal)` → TSQ token RFC 3161 + timestamp evidence.
3. Adjunta TSQ token como attachment `timestamp.tsr` + pie HTML con QR de verificación.
4. INSERT `evidence_bundles` con `source_object_type='COMMUNICATION_TIMESTAMP'`, hash del cuerpo, TSQ.
5. Delega envío al `ResendAdapter` con cuerpo enriquecido.
6. Retorna `evidenceBundleId` + `evidenceHashSha512` además del `proveedorEventoId`.

Si sello QTSP falla pero Resend tendría éxito: `MailAdapterError(retriable=true)` — el secretario no recibe un email a medio certificar.

#### `EADTrustERDSAdapter` — `BUROFAX_ERDS`

Reutiliza `useERDSNotification` refactorizada a librería pura sin React:

1. `eadTrust.generateEvidence({ evidenceId, hash, capturedAt, custodyType: 'EXTERNAL', title, fileName, createdBy, fileSize, metadata })`.
2. EAD Trust se encarga del envío al destinatario por su canal certificado registrado.
3. Retorna `evidence.id` como `proveedorEventoId`.
4. Genera y referencia `evidence_bundles` automático.

Errores: HTTP 401/403 → `retriable=false`; 429/5xx/timeout → `retriable=true`.

### 5.3 Dispatcher

Pseudocódigo del Edge Function `comms-dispatcher`:

```typescript
async function dispatch() {
  // 1. Reclamar recipients atómicamente (granularidad fina para evitar convoy)
  const batch = await db.query(`
    UPDATE communication_recipients
    SET estado_entrega = 'ENVIANDO', updated_at = now()
    WHERE id IN (
      SELECT cr.id FROM communication_recipients cr
      JOIN communications c ON c.id = cr.communication_id
      WHERE cr.estado_entrega = 'PENDIENTE'
        AND c.estado IN ('PROGRAMADA','ENVIANDO')
        AND c.fecha_programada <= now()
      ORDER BY c.fecha_programada ASC
      LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  // 2. Procesar en paralelo con concurrency limitada
  await Promise.all(chunk(batch, 5).map(processRecipientBatch));
}

async function processRecipient(r: Recipient) {
  // PORTAL_PUSH no tiene adapter en P1; skip con warning
  if (r.canal_primario === 'PORTAL_PUSH') {
    console.warn(`Skipping PORTAL_PUSH recipient ${r.id} (no adapter en P1)`);
    return;
  }

  const adapter = getAdapter(r.canal_primario);
  const adjuntos = await loadAttachments(r.communication_id);
  const comm = await loadCommunication(r.communication_id);

  try {
    const res = await adapter.send({
      recipientId: r.id,
      idempotencyKey: hash(r.id, comm.cuerpo_hash_sha512, r.intento_reenvio_n),
      destino: r.destino_primario,
      asunto: comm.asunto,
      cuerpoHtml: comm.cuerpo_render,
      cuerpoSha512: comm.cuerpo_hash_sha512,
      adjuntos: adjuntos.map(toAdapterAttachment),
      remitente: getRemitente(comm.tenant_id),
      metadata: { 'X-Communication-Id': comm.id, 'X-Tenant-Id': comm.tenant_id },
      tags: [
        { name: 'recipient_id', value: r.id },
        { name: 'communication_id', value: comm.id },
      ],
    });

    await db.tx(async (tx) => {
      await tx.query(`UPDATE communication_recipients SET estado_entrega='ENVIADO', canal_usado=$1, fecha_envio=now(), updated_at=now() WHERE id=$2`, [r.canal_primario, r.id]);
      await insertDeliveryEvent(tx, {
        recipient_id: r.id,
        evento: 'SENT',
        proveedor: res.proveedor,
        proveedor_evento_id: res.proveedorEventoId,
        payload: { evidenceBundleId: res.evidenceBundleId },
      });
    });
  } catch (err) {
    await handleAdapterError(r, err);
  }
}
```

### 5.4 pg_cron

```sql
SELECT cron.schedule(
  'comms-dispatch-tick',
  '* * * * *',
  $$ SELECT net.http_post(
       url := current_setting('app.functions_url') || '/comms-dispatcher',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
         'Content-Type', 'application/json'
       )
     ); $$
);
```

Envío inmediato: el composer hace `fetch('/functions/v1/comms-dispatcher', { method: 'POST' })` post-INSERT cuando `fecha_programada <= now() + 60s`. El dispatcher es idempotente vía `SKIP LOCKED`.

### 5.5 Webhooks

#### `webhook-resend`

- Verifica HMAC con `RESEND_WEBHOOK_SECRET` (configurable, rotable en `vault.secrets`).
- Extrae `recipient_id` de los `tags` del evento Resend (no de headers custom, que Resend no propaga).
- Lookup vía `proveedor_evento_id`: `SELECT recipient_id FROM communication_delivery_events WHERE proveedor='RESEND' AND proveedor_evento_id=$1 AND evento='SENT' LIMIT 1`.
- Mapping:
  - `email.delivered` → INSERT `DELIVERED` + UPDATE `fecha_entrega`, `estado_entrega='ENTREGADO'`.
  - `email.bounced` → INSERT `BOUNCED` + promover `canal_fallback` si existe, o `estado_entrega='REBOTADO'` + `comm.tiene_rebotes=true`.
  - `email.complained` → INSERT `COMPLAINED` (no cambia estado_entrega).
  - `email.opened` → INSERT `OPENED` (P2+: UPDATE `fecha_lectura`).
  - `email.clicked` → INSERT `CLICKED` (P2+).

Inserción de `delivery_events` usa hash chain con `SELECT FOR UPDATE` sobre el último evento del recipient para serializar.

#### `webhook-ead-trust`

- Verifica firma EAD Trust del callback.
- Mismo flujo de mapping para `evidence.delivered` → `DELIVERED`.

### 5.6 Política de reintentos y fallback

| Situación | Acción |
|---|---|
| `MailAdapterError(retriable=true)` y `intento_n < 3` | `estado_entrega` vuelve a `PENDIENTE`, dispatcher próximo tick reintenta. |
| `retriable=true` y `intento_n >= 3` y `canal_fallback` existe | Promueve `canal_fallback` → `canal_primario` (NO toca `canal_original`), `destino_fallback` → `destino_primario`, `intento_n = 0`. |
| `MailAdapterError(retriable=false)` | Si existe fallback, promueve. Si no, `estado_entrega='ERROR'` + alerta interna en `notifications`. |
| Webhook `BOUNCED` | Mismo flujo que `retriable=false` con fallback. Si no hay fallback, `estado_entrega='REBOTADO'` + `comm.tiene_rebotes=true`. |
| Webhook `COMPLAINED` | Registrado en `delivery_events` para dashboard de reputación. No cambia `estado_entrega`. |
| Toda la comunicación en `ERROR` post-fallbacks | `communications.estado='ERROR'` vía trigger + alerta crítica al secretario. |

Backpressure: dispatcher procesa hasta 50 recipients por tick con `Promise.all` concurrency=5. Resend free tier 10 req/s; con esta concurrencia, ~5 req/s en el peor caso.

Idempotencia: `Idempotency-Key` en Resend; `evidenceId` único en EAD Trust.

### 5.7 Observabilidad y monitoring

**Alertas críticas (PagerDuty-level):**

- `communications.estado = 'ERROR'` con `tiene_rebotes = true` para >50% de recipients de una sola comm → convocatoria no entregada.
- `communication_recipients.estado_entrega = 'PENDIENTE'` por >2h después de `fecha_programada` → dispatcher parado.
- Edge Function `comms-dispatcher` con error rate >10% en ventana 5 min → adapter o cola caídos.
- Edge Function `validate-comm-plazo` con latencia p95 >500ms → degrada UX del datepicker.

**Métricas de negocio (dashboard Secretaría):**

- Tiempo medio entre `PROGRAMADA` y `ENTREGADA_TOTAL` (p50, p95).
- Tasa de rebote por canal (`EMAIL_NORMAL` vs `EMAIL_CERTIFICADO` vs `BUROFAX_ERDS`).
- Tasa de respuesta por `tipo_comunicacion` (P2+).
- Comms enviadas en plazo legal vs fuera de plazo (objetivo: 100% en plazo).

**Structured logging:**

- Dispatcher: `{ communication_id, recipient_id, canal, adapter, result, duration_ms, intento_n }`.
- Webhooks: `{ proveedor, evento, recipient_id_lookup_ms, hash_chain_lock_ms }`.
- `delivery_events` y `portal.access_log` como audit trails persistentes.

### 5.8 Archivos a crear

```
src/lib/comms/
├── adapters/
│   ├── MailAdapter.ts
│   ├── ResendAdapter.ts
│   ├── ResendCertifiedAdapter.ts
│   ├── EADTrustERDSAdapter.ts
│   ├── QTSPTimestampService.ts
│   ├── adapter-registry.ts
│   └── __tests__/*.test.ts
├── dispatcher.ts
├── retry-policy.ts
└── types.ts

supabase/functions/
├── comms-dispatcher/
├── webhook-resend/
├── webhook-ead-trust/
├── validate-comm-plazo/
└── invite-portal-member/
```

---

## 6. Motor de plazos

### 6.1 Extensión de `src/lib/rules-engine/`

Se añade `src/lib/rules-engine/comms-plazo-engine.ts` que reutiliza `convocatoria-engine` para convocatorias y aplica fallback genérico para tipos sin plazo legal específico:

```typescript
export interface PlazoComunicacionInput {
  tipo_comunicacion:         TipoComunicacion;
  organo_tipo:               OrganoTipo;
  entity_id:                 string;
  fecha_evento_referenciado: Date | null;
  normative_profile:         NormativeProfile;
  template_id:               string | null;
}

export interface PlazoComunicacionResult {
  min_envio_date:        Date | null;
  plazo_dias:            number;
  unidad:                'NATURAL' | 'HABIL';
  fecha_limite_default:  Date | null;
  referencia_legal:      string;
  fuente_resolucion:     'LEY' | 'ESTATUTOS' | 'REGLAMENTO' | 'COMUNICACION_CONFIG';
  warnings:              string[];

  // TODO P3: segunda convocatoria art. 177 LSC
  // es_segunda_convocatoria: boolean;
  // plazo_segunda_convocatoria_dias: number | null;
  // min_envio_segunda: Date | null;
}

export function calcularPlazoComunicacion(
  input: PlazoComunicacionInput,
): PlazoComunicacionResult {
  // P1: convocatorias con plazo legal explícito
  if (input.tipo_comunicacion === 'CONVOCATORIA') {
    return calcularPlazoConvocatoria(input);  // delegación a convocatoria-engine
  }
  // P3: D3 aumento capital, D4 reducción, D7 fusión... → añadir branches aquí

  // P1 fallback: lee comunicacion_config del template si existe
  const configPlazo = input.template_id ? loadComunicacionConfig(input.template_id) : null;
  return {
    min_envio_date: null,
    plazo_dias: configPlazo?.plazo_legal_dias ?? 0,
    unidad: 'NATURAL',
    fecha_limite_default: configPlazo?.plazo_legal_dias && input.fecha_evento_referenciado
      ? addDays(input.fecha_evento_referenciado, configPlazo.plazo_legal_dias)
      : null,
    referencia_legal: configPlazo?.referencia_legal ?? 'Sin plazo legal específico',
    fuente_resolucion: configPlazo ? 'COMUNICACION_CONFIG' : 'LEY',
    warnings: [],
  };
}
```

### 6.2 Hook React + Edge Function de validación

#### `useCommsPlazoCheck` (cliente)

```typescript
export function useCommsPlazoCheck(
  draft: CommunicationDraft,
): { isValid: boolean; minDate: Date | null; reason: string; warnings: string[] } {
  const { data: profile } = useEntityNormativeProfile(draft.entity_id);
  return useMemo(() => {
    if (!profile) return { isValid: false, minDate: null, reason: 'Loading...', warnings: [] };
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: draft.tipo_comunicacion,
      organo_tipo: draft.organo_tipo,
      entity_id: draft.entity_id,
      fecha_evento_referenciado: draft.meeting_date ?? draft.agreement_date ?? null,
      normative_profile: profile,
      template_id: draft.template_id,
    });
    // ... validación contra draft.fecha_programada
  }, [
    draft.tipo_comunicacion,
    draft.organo_tipo,
    draft.entity_id,
    draft.meeting_date,
    draft.agreement_date,
    draft.fecha_programada,
    draft.template_id,
    profile,
  ]);
}
```

#### `validate-comm-plazo` (Edge Function, llamada por trigger BEFORE INSERT/UPDATE)

```typescript
// supabase/functions/validate-comm-plazo/index.ts
serve(async (req) => {
  const input = await req.json();
  const profile = await loadNormativeProfile(input.entity_id);
  const result = calcularPlazoComunicacion({ ...input, normative_profile: profile });
  return new Response(JSON.stringify({
    isValid: !result.min_envio_date || new Date(input.fecha_programada) >= result.min_envio_date,
    minDate: result.min_envio_date,
    reason: result.referencia_legal,
    warnings: result.warnings,
  }), { headers: { 'Content-Type': 'application/json' } });
});
```

Trigger invoca esta función vía `net.http_post` y bloquea el INSERT si `isValid=false`. Una sola implementación TypeScript = cero divergencia.

### 6.3 Cobertura por tipo de comunicación

| Categoría | Tipos cubiertos | P1 | P3 |
|---|---|---|---|
| Convocatorias | A1-A4 (4 tipos) | ✅ Plazo legal (LSC 176/246/173/249) | — |
| Post-sesión / cargo | B1-B5, C1-C9 (14 tipos) | ⚠️ Fallback genérico, sin restricción de envío | — |
| Materias sustantivas D | D1-D14 (14 tipos) | ⚠️ Fallback genérico | ✅ D3/D4/D7 con plazo legal (LSC 295/319, RDL 5/2023) |
| Especiales E + Continua F | E1-E4, F1-F8 (11 tipos) | ⚠️ Fallback genérico | ✅ Cobertura completa según `comunicacion_config` |

---

## 7. Portal del Miembro

### 7.1 Auth con scope claim

Un único `auth.users` con claim `scope` derivado de membership:

```sql
-- Hook ejecutado por Supabase Auth Hooks en cada token issuance
CREATE OR REPLACE FUNCTION fn_auth_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  -- Lee directamente de auth.users.raw_app_meta_data.scope (cached)
  -- Sync vía tg_sync_scope_app_meta en cambios de membership/roles
  RETURN event || jsonb_build_object(
    'claims',
    (event->'claims') || jsonb_build_object(
      'scope', COALESCE(event->'user'->'raw_app_meta_data'->>'scope', 'none')
    )
  );
END $$;
```

Trigger `tg_sync_scope_app_meta` (AFTER INSERT/UPDATE/DELETE en `portal_memberships` y `rbac_user_roles`) recomputa el scope y escribe en `auth.users.raw_app_meta_data.scope`. El hook solo lee del JSON cacheado.

Valores posibles: `staff` / `member` / `both` / `none`.

### 7.2 Schema `portal` aislado

Ver §4.4 para schema setup y `portal.access_log`.

RPCs en schema `portal` (SECURITY DEFINER, ejecutadas como `service_role`, pero validan `auth.uid()` internamente):

| RPC | Parámetros | Comportamiento |
|---|---|---|
| `portal.fn_mi_inbox(filters jsonb)` | filters opcional (estado, fecha, entity_id) | Returns comms del miembro logueado ordenadas DESC. INSERT en `portal.access_log`. |
| `portal.fn_mi_comunicacion_detalle(communication_id uuid)` | id | Returns comm + attachments con signed URLs + meeting info si aplica. Valida ownership. |
| `portal.fn_responder_comunicacion(recipient_id, respuesta_tipo, payload, delegacion_a_person_id?)` | recipient_id, tipo, payload, delegación opcional | Con `FOR UPDATE` + check ownership + check plazo + check no respondido previo + INSERT REPLIED event. |
| `portal.fn_marcar_lectura(recipient_id uuid)` | recipient_id | Idempotente; UPDATE `fecha_lectura` si NULL. |
| `portal.fn_mis_entidades()` | — | Returns entities accesibles derivadas de `condiciones_persona` del miembro. No abre RLS de tablas auxiliares. |

### 7.3 Onboarding flow

```
Secretario en /secretaria/personas/:id → botón "Invitar al portal"
  ↓
INSERT portal_memberships(estado='INVITADO')
  ↓
Edge Function invite-portal-member:
  1. supabase.auth.admin.inviteUserByEmail(person.email, {
       data: { person_id, full_name },
       redirectTo: 'https://app/portal/onboarding'
     })
  2. INSERT communications (tipo='COMUNICACION_INTER_ORGANO') con el email de invitación
     vía adapter EMAIL_NORMAL (auditoría queda en delivery_events)
```

Wizard (`/portal/onboarding`, protegido por `OnboardingGuard` que verifica `membership.estado='INVITADO'`):

1. **Bienvenida**: nombre + tenant + entidades futuras accesibles.
2. **Crear contraseña**: 12+ chars, validación NIST.
3. **Configurar MFA TOTP**: `supabase.auth.mfa.enroll({ factorType: 'totp' })` → QR + recovery codes nativos Supabase mostrados al miembro UNA vez. Challenge + verify → AAL2.
4. **Confirmar identidad**: muestra "Va a tener acceso a comunicaciones de [N entidades]" derivado de `condiciones_persona` vigentes. Submit → UPDATE `portal_memberships SET estado='ACTIVO', activated_at=now(), mfa_enrolled=true`.

Recovery flow (miembro pierde dispositivo TOTP y recovery codes): secretario en `/secretaria/personas/:id/portal-reset` invoca `supabase.auth.admin.mfa.deleteFactor` + nueva invitación. Verificación out-of-band con secondary_email/phone de `persons_profile`.

### 7.4 Layout y rutas

```
src/portal/
├── MemberLayout.tsx
├── guards/
│   ├── AAL2Guard.tsx
│   └── OnboardingGuard.tsx
├── components/
│   ├── MemberSidebar.tsx
│   ├── MemberHeader.tsx
│   ├── EntitySelector.tsx          (visible si N>1)
│   ├── InboxCard.tsx
│   ├── ComunicacionDetalleCard.tsx
│   ├── RSVPForm.tsx
│   ├── DelegacionForm.tsx
│   └── DeclaracionConflictoForm.tsx
├── pages/
│   ├── Login.tsx                   /portal/login
│   ├── MFAChallenge.tsx            /portal/mfa-challenge
│   ├── Onboarding.tsx              /portal/onboarding
│   ├── NoAccess.tsx                /portal/no-access
│   ├── Inbox.tsx                   /portal/inbox
│   ├── ComunicacionDetalle.tsx     /portal/comunicaciones/:id
│   ├── Sesiones.tsx                /portal/sesiones
│   ├── Historico.tsx               /portal/historico
│   └── Perfil.tsx                  /portal/perfil
└── hooks/
    ├── usePortalMembership.ts
    ├── usePortalInbox.ts
    ├── usePortalComunicacion.ts
    ├── usePortalEntities.ts
    └── useRespuestaComunicacion.ts
```

`App.tsx`:

```tsx
<Route path="/portal/login"          element={<Login />} />
<Route path="/portal/mfa-challenge"  element={<MFAChallenge />} />
<Route path="/portal/no-access"      element={<NoAccess />} />
<Route path="/portal/onboarding"
       element={<OnboardingGuard><Onboarding /></OnboardingGuard>} />
<Route element={<AAL2Guard><MemberLayout /></AAL2Guard>}>
  <Route path="/portal"                       element={<Inbox />} />
  <Route path="/portal/inbox"                 element={<Inbox />} />
  <Route path="/portal/comunicaciones/:id"    element={<ComunicacionDetalle />} />
  <Route path="/portal/sesiones"              element={<Sesiones />} />
  <Route path="/portal/historico"             element={<Historico />} />
  <Route path="/portal/perfil"                element={<Perfil />} />
</Route>
```

`MemberLayout`: sidebar verde Garrigues simplificado (Bandeja · Sesiones · Histórico · Perfil), header con badge "PORTAL DEL MIEMBRO", selector de entidad si N>1, disclaimer permanente en footer: "No constituye evidencia final productiva."

### 7.5 RLS y CI gate

Tablas con RLS dual (Secretaría + portal):

```sql
-- communication_recipients
CREATE POLICY portal_recipients_select ON communication_recipients
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'scope') IN ('member','both')
    AND person_id IN (
      SELECT person_id FROM portal_memberships
      WHERE user_id = auth.uid() AND estado = 'ACTIVO'
    )
  );

-- UPDATE/DELETE en recipients NO permitido para scope='member';
-- mutaciones vía RPCs SECURITY DEFINER en schema portal.

-- communications: misma lógica, restringido a comms que tienen recipients del miembro
CREATE POLICY portal_communications_select ON communications
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'scope') IN ('member','both')
    AND id IN (
      SELECT communication_id FROM communication_recipients
      WHERE person_id IN (SELECT person_id FROM portal_memberships
                          WHERE user_id = auth.uid() AND estado = 'ACTIVO')
    )
  );
```

**CI test suite RLS** (gate obligatorio P2):

Fixtures: 3 tenants × 5 personas × comms cruzadas. Casos concretos en [§12.5](#125-fixtures-rls-test-suite-p2-ci-gate).

### 7.6 P2 v1 funcionalidades

| Funcionalidad | Implementación |
|---|---|
| Login + MFA challenge | Supabase Auth nativo |
| Onboarding 4 pasos | Token-based, `OnboardingGuard` con check estado=INVITADO |
| Inbox cronológico con tabs | `Nuevas` / `Pendiente acción` / `Archivadas`. Realtime subscription a `communication_recipients` filtrado por `person_id` |
| Detalle comunicación | Renderiza `cuerpo_render` + attachments con signed_url + meeting info. `fn_marcar_lectura` on mount |
| RSVP (ASISTIRÉ/NO/DELEGARÉ) | `RSVPForm`, llama `portal.fn_responder_comunicacion` |
| Delegación voto | `DelegacionForm` selector entre miembros del mismo órgano |
| Declaración conflicto | `DeclaracionConflictoForm` SI/NO + descripción si SI |
| Marcar leído | `fn_marcar_lectura` on mount (válido legal "se le mostró"). 5s timer refinamiento P3 |
| Histórico | `/portal/historico` tabla con filtros |
| Perfil | Cargo + mandato vigencia + entidades + MFA reset request |

---

## 8. Integración con flujos existentes

### 8.1 `ConvocatoriasStepper.tsx`

**Cambios P1:**

- Paso 8 (Revisión y emisión): añadir CTA secundario **"Saltar envío — gestionaré canales fuera del sistema"** → marca `agreements.comunicacion_manual=true` (nueva columna).
- **Paso 9 nuevo: "Envío a miembros"** con:
  - Lista de recipients auto-poblada desde `condiciones_persona` para `body_id`.
  - Por persona: nombre + cargo + email + selectores `canal_primario` y `canal_fallback`.
  - Selector `nivel_certificacion_minimo` (default según `organo_tipo`).
  - Datepicker `fecha_programada` con `useCommsPlazoCheck` validando en vivo.
  - Adjuntos auto-poblados con documento del Paso 7.
  - Preview del cuerpo.
  - Botón "Programar envío" → INSERT communications + recipients + attachments + (si inmediato) fetch al dispatcher.

**Spike de 2 días en P1 sem 1:** evaluar state management del stepper actual. Si requiere refactoring previo, buffer P1 = 7 semanas.

### 8.2 Otros entry points P1

| Componente | Cambio | Comunicación que crea |
|---|---|---|
| `TramitadorStepper.tsx` | Botón "Notificar al nombrado" cuando acuerdo `NOMBRAMIENTO_CONSEJERO` pasa a `ADOPTED` | `NOTIFICACION_CARGO`, `tipo_respuesta_esperada=ACEPTACION` (P1 solo envía; captura aceptación P2) |
| `ExpedienteAcuerdo.tsx` | Botón "Notificar acuerdo a ausentes" cuando `agreement.status=ADOPTED` | `NOTIFICACION_ACUERDO`, `tipo_respuesta_esperada=INFORMATIVA`, recipients=ausentes calculados |
| `ReunionStepper.tsx` (CierreStep) | Botón "Remitir certificación" tras `fn_emitir_certificacion` | `CERTIFICACION`, recipients ad hoc (auditor, RM, consejero nombrado) |
| `BoardPack.tsx` | Botón "Distribuir pack a consejeros" | `PUESTA_DISPOSICION`, recipients=CdA, attachments `modo_entrega='LINK_FIRMADO'` (>40MB) |

Priorización semana 4 P1: P0 = `ConvocatoriasStepper`; P1 = `BoardPack`; P2 (bonus) = los 3 restantes.

### 8.3 `CommunicationsComposer` (P1)

Página nueva `/secretaria/comunicaciones/nueva`, 6 steps:

1. **Origen**: plantilla activa (selector con `requiere_comunicacion=true`) o comunicación libre.
2. **Contexto**: entidad + órgano + agreement opcional + meeting opcional.
3. **Destinatarios**: auto-sugerencia según órgano + tipo; override manual.
4. **Mensaje**: Capa1+Capa2 (no editable) + Capa3 (editable) si plantilla; rich-text plano si libre con warning.
5. **Canal y plazo**: mismo UI que Paso 9 de `ConvocatoriasStepper`.
6. **Confirmación**: resumen + "Programar envío".

Free-form: `comunicacion_libre=true`, `template_id=NULL`, `metadata.audit_libre = { redactor_user_id, fecha, motivo }`.

### 8.4 Dashboard `/secretaria/comunicaciones`

Tabs (top): `Borradores` · `Programadas` · `Enviando` · `Enviadas` · `Errores` · `Todas`.

Columnas: estado · órgano · asunto · destinatarios (N) · canal · fecha envío · `tiene_rebotes` · acciones.

Filtros lateral: entidad · órgano · tipo comunicación · periodo · `tiene_rebotes` · `comunicacion_libre`.

Acciones por fila:

- Ver detalle modal: tabla recipients con badges `canal_original ≠ canal_usado`, links evidence_bundles, timeline `delivery_events`.
- Cancelar (solo `PROGRAMADA`).
- Reintentar recipient en `ERROR`.
- Descargar acta de auditoría (export JSON delivery_events del recipient).

Métricas top:

- Convocatorias en plazo / fuera de plazo.
- Tasa de entrega últimos 30 días.
- Tasa de rebotes últimos 30 días.
- **Widget "Miembros sin email verificado para próxima sesión"** (P1 sem 5) — lista personas en órganos con `condiciones_persona` vigente que no tienen `persons.email` ni `persons_profile.secondary_email`.

---

## 9. Phasing

### 9.1 Prerrequisitos

- FIRMA_LEGAL_BATCH: al menos las 4 plantillas de convocatoria (`CONVOCATORIA_JUNTA`, `CONVOCATORIA_SL_NOTIFICACION`, `CONVOCATORIA_CDA`, `CONVOCATORIA_COMISION_DELEGADA`) firmadas por Comité Legal. Si se atasca, P1 arranca sobre plantillas firmadas (~23 de 40); las pending tienen `requiere_comunicacion=false` temporal.
- Resend account + dominio SPF/DKIM/DMARC + API key.
- `net.http_post` + `app.functions_url` configurados.

### 9.2 P1 — Comms backbone + Secretaría sin respuesta inbound (6 semanas + buffer 1)

| Sem | Bloque |
|---|---|
| 1 | Schema + extensiones: 6 tablas + ALTER + VIEW + schema `portal` vacío + triggers WORM/validación/sync_scope. Seed `comunicacion_config` para 40 plantillas según [§12.1](#121-mapping-40-plantillas--comunicacion_config). **Spike 2d** sobre `ConvocatoriasStepper` state. |
| 2 | Library `src/lib/comms/`: 3 adapters + dispatcher + retry-policy + types. `src/lib/rules-engine/comms-plazo-engine.ts` + tests unitarios. |
| 3 | 5 Edge Functions desplegadas. pg_cron job aplicado. Backfill `no_session_notificaciones` → `communications`. Hooks comms. |
| 4 | ConvocatoriaStepper Paso 9 + CTA "Saltar envío" (P0). BoardPack "Distribuir pack" (P1). Tramitador/ExpedienteAcuerdo/ReunionStepper (P2 bonus). |
| 5 | CommunicationsComposer 6 steps. Dashboard `/secretaria/comunicaciones` con tabs + filtros + detalle + widget "miembros sin email". |
| 6 | Tests integration + smoke E2E Playwright + RLS Secretaría test suite + QA + anotación deudas P3. |
| **7** | **Buffer** si spike sem 1 reveló refactoring del stepper. |

**Out-of-scope P1:**

- Portal `/portal/*`.
- Estados `LEIDO`, `RESPONDIDO`, `EXPIRADA` (triggers existen pero inactivos).
- Comms con `tipo_respuesta_esperada ∈ {ACEPTACION, VOTO, DECLARACION, DELEGACION}` programables (UI compositor las bloquea con "Disponible en P2").
- Voto a distancia, firma QES portal, push, recordatorios automáticos.

**Métricas de éxito P1:**

- 100% convocatorias programadas con `delivery_events.SENT`.
- 100% recipients con `DELIVERED` o `BOUNCED` en 5 min.
- 0 envíos fuera de plazo legal (trigger bloquea pre-INSERT).
- 0 fugas cross-tenant en test suite RLS Secretaría.

### 9.3 Go/no-go gate entre P1 y P2

**Obligatorios (bloquean P2):**

- 4 plantillas FIRMA_LEGAL_BATCH de convocatoria firmadas.
- P1 delivery rate >95% recipients con `DELIVERED` o `BOUNCED` (no `PENDIENTE` indefinido).
- RLS test suite Secretaría 100% green en CI.
- Cero comunicaciones enviadas fuera de plazo legal en entorno demo.

**Recomendados (no bloquean, generan warning):**

- 40 plantillas con `comunicacion_config` seeded y validado.
- Dashboard Secretaría con load time p50 <2s.
- Backfill `no_session_notificaciones` completado sin pérdida.

### 9.4 P2 — Portal del Miembro v1 (8 semanas)

| Sem | Bloque |
|---|---|
| 1 | Schema portal: tabla `portal.access_log` + 5 RPCs SECURITY DEFINER. Auth infrastructure: `fn_auth_token_hook` activado, trigger sync_scope, RLS policies con scope claim. |
| 2 | Onboarding flow: Edge Function `invite-portal-member`, wizard 4 pasos, `OnboardingGuard`, integración Supabase MFA TOTP nativo. |
| 2 | Layout + routing: `MemberLayout`, `MemberSidebar`, `MemberHeader`, `AAL2Guard`, error pages. |
| 3 | Login + MFA challenge pages. Recovery flow operativo. |
| 3 | Inbox con tabs + filtros + realtime subscription a `communication_recipients`. |
| 4 | Detalle comunicación + attachments (signed URL descarga) + meeting info. `fn_marcar_lectura` on mount. |
| 4 | `RSVPForm` con ASISTIRÉ/NO/DELEGARÉ. |
| 5 | `DelegacionForm` selector representante + payload `{ delegacion_a_person_id, alcance, materias_excluidas }`. |
| 5 | `DeclaracionConflictoForm` SI/NO + descripción. |
| 6 | Perfil + Histórico + Sesiones (calendario simplificado). Audit log + RLS test suite P2 CI gate ([§12.5](#125-fixtures-rls-test-suite-p2-ci-gate)). |
| **7** | **Beta cerrada** con 3-5 miembros reales del CdA de ARGA. Onboarding + recepción de convocatoria de prueba + RSVP. Recogida de bugs UX. |
| **8** | Fix bugs beta + activación estados `LEIDO`/`RESPONDIDO`/`EXPIRADA` + tipos respuesta `ACEPTACION`/`DELEGACION`/`DECLARACION` programables. Tests E2E finales. |

**Out-of-scope P2:**

- Voto a distancia (P3).
- Firma QES desde portal (P4).
- Notificaciones push web (P3).
- Comunicaciones libres con respuesta capturable (P3).
- Acceso de asesores externos y auditores (P4).

**Métricas de éxito P2:**

- Onboarding completion rate >70%.
- Latencia inbox p50 <1s desde login.
- 0 fugas cross-tenant en CI gate.
- Tasa RSVP previa a sesión >50% (objetivo 90% en P4).
- Tasa incidentes auth (lockouts) <5% miembros activos.

### 9.5 P3 — Comunicaciones avanzadas + voto a distancia (5 semanas)

| Sem | Bloque |
|---|---|
| 1 | Voto a distancia: tabla `votos_distancia` + RPC `fn_emitir_voto_distancia` con firma QES EAD Trust. Integración con `votacion-engine` para cómputo automático. Validación por `entities.tipo_voto_distancia_permitido`. |
| 2 | Push notifications: `InternalPushAdapter` (Web Push VAPID) + suscripción en Perfil. Realtime banner como fallback. |
| 2 | Comunicaciones libres con respuesta: extensión composer + portal form genérico. |
| 3 | Recordatorios automáticos: cron 24h/1h antes de meeting si sin RSVP. Columna `communications.recordatorio_padre_id`. |
| 3 | Segunda convocatoria: extensión `PlazoComunicacionResult` con campos segunda. UI ya soporta `hay_segunda_convocatoria`. |
| 4 | Read tracking refinado: 5s timer en `ComunicacionDetalle`. Tracking pixel + click tracking Resend activados. |
| 4 | `communication_delivery_attempts` table: migración del fallback escalar a tabla de intentos. |
| 5 | Plazo engine completo: D3 aumento capital, D4 reducción, D7 fusión, etc. con tests. |
| 5 | Comisiones delegadas portal experience: vista adaptada por `organo_tipo`. |

### 9.6 P4 — Firma + alertas + admin grupo (4 semanas)

| Sem | Bloque |
|---|---|
| 1 | Firma QES desde portal: integración EAD Trust QES en `RSVPForm` cuando `tipo_respuesta_esperada=ACEPTACION` requiere firma. Reutiliza `useQTSPSign`. |
| 2 | Histórico completo: sesiones asistidas/delegadas + votos + declaraciones + firmas. Export PDF auditable. |
| 2 | Alertas vencimiento mandato: cron diario con comm tipo `ALERTA_VENCIMIENTO` (60/30/15 días). |
| 3 | Bloques cotizada: banner en `MemberLayout` + warnings DL-2. |
| 3 | Panel admin grupo: `/secretaria/grupo/dashboard` para `ADMIN_TENANT` multi-entidad. |
| 4 | Asesores externos + auditores: onboarding con `rol_portal IN ('ASESOR_EXTERNO','OBSERVADOR_AUDITOR')`. Solo lectura. |
| 4 | Tests E2E completos + pentest externo (Garrigues internal security) + hardening final. |

### 9.7 Calendario consolidado

```
        Q3 2026          Q4 2026          Q1 2027          Q2 2027
W1  W2  W3  W4  W5  W6  W7 │ W1  W2  W3  W4  W5  W6  W7  W8 │ W1  W2  W3  W4  W5 │ W1  W2  W3  W4
──────────────────────────│────────────────────────────────│───────────────────│──────────────
P1 P1 P1 P1 P1 P1 [buf]    │                                │                   │
                           │ P2 P2 P2 P2 P2 P2 P2 P2        │                   │
                           │                  └─beta cerr─┘ │                   │
                           │                                │ P3 P3 P3 P3 P3    │
                           │                                │                   │ P4 P4 P4 P4
                           │                                │                   │
6+1 semanas P1              8 semanas P2                     5 semanas P3        4 semanas P4
            └──── go/no-go gate ────┘
```

Total: 24 semanas (incluido buffer).

---

## 10. Riesgos

### 10.1 Registro consolidado

| ID | Riesgo | Fase | Prob | Impacto | Mitigación |
|---|---|---|---|---|---|
| R1 | FIRMA_LEGAL_BATCH no cierra a tiempo | P1 inicio | Media | Alto | P1 arranca con plantillas firmadas. Gate exige las 4 convocatorias cerradas para P2. |
| R2 | `ConvocatoriaStepper` requiere refactoring de state | P1 sem 1 | Media | Medio | Spike 2 días sem 1. Buffer 7ª semana. |
| R3 | Resend deliverability (SPF/DKIM/DMARC) | P1 sem 3 | Baja | Alto | DevOps task sem 1. Tests con 5 destinatarios reales antes sem 4. |
| R4 | Latencia trigger `validate-comm-plazo` (HTTP en trigger) | P1 | Baja | Medio | Operaciones humanas, baja frecuencia. Si latencia >300ms, fallback a mirror SQL + test paridad CI. |
| R5 | EAD Trust rate limits / outage | P1+ | Baja | Alto | Retry exponencial; fallback a `EMAIL_CERTIFICADO` si caído >5min. Alerta interna. |
| R6 | Adopción MFA por miembros senior | P2 | Alta | Medio | Onboarding guiado, support telefónico, recovery flow. Métrica P2: completion >70%. |
| R7 | Drift `persons.email` desactualizado | P2 onboarding | Alta | Medio | Widget P1 sem 5 "miembros sin email verificado". Tarea operativa Secretaría pre-P2. |
| R8 | RLS leak cross-tenant en perímetro portal | P2+ | Baja | Crítico | Schema `portal` separado + RPCs SECURITY DEFINER + audit log + CI test suite + pentest P4. |
| R9 | Activación ciega estados `LEIDO`/`RESPONDIDO`/`EXPIRADA` | P2 sem 7 | Media | Alto | Beta cerrada 3-5 miembros reales antes de activación. Restructura sem 7-8. |
| R10 | Voto a distancia: estatutos no lo permiten para entidad concreta | P3 | Media | Bajo | Validación por `entities.tipo_voto_distancia_permitido`. Comité Legal por entidad. |
| R11 | Hash chain race en `delivery_events` bajo carga | P1+ | Baja | Bajo | `SELECT FOR UPDATE` sobre último evento del recipient antes de INSERT. |
| R12 | Convoy effect en dispatcher | P1+ | Baja | Medio | Dispatcher a nivel recipient con `LIMIT 50 FOR UPDATE SKIP LOCKED`. |
| R13 | Resend webhook signature spoofing | P1 webhooks | Baja | Crítico | HMAC verify con `RESEND_WEBHOOK_SECRET` rotable en `vault.secrets`. |
| R14 | Drift `raw_app_meta_data.scope` vs realidad | P2 | Baja | Alto | Trigger AFTER INSERT/UPDATE/DELETE en `portal_memberships` + `rbac_user_roles` recomputa scope. Test consistencia cada release. |
| R15 | Board pack >40MB email | P1 BoardPack | Media | Medio | `modo_entrega='LINK_FIRMADO'` por defecto en `EXPEDIENTE_REF`. Signed URL 7 días. |
| R16 | EAD Trust contract no cubre volumen P3+ | P3 | Media | Medio | Renegociación con Garrigues antes P3 (OQ5). |

---

## 11. Preguntas operativas abiertas

Estas decisiones operativas / legales NO bloquean la spec arquitectónica pero deben resolverse paralelamente:

| # | Pregunta | Quién resuelve | Cuándo |
|---|---|---|---|
| OQ1 | Estado real FIRMA_LEGAL_BATCH a 2026-05-17: ¿4 convocatorias firmadas? | Comité Legal Garrigues | Antes cierre P1 sem 1 |
| OQ2 | Contenido exacto de `comunicacion_config` por plantilla | Comité Legal + Secretaría | Durante P1 sem 1 (seeding) |
| OQ3 | Dominio portal: `app.tgms.es/portal/*` (subpath) o `portal.tgms.es` (subdomain) | DevOps + Marketing | Antes cierre P1 (CSP, cookies) |
| OQ4 | Email remitente: `secretaria@arga-seguros.com` (tenant-specific) o `secretaria@tgms.es` (platform) | Cliente ARGA + Garrigues | P1 sem 2 (config Resend) |
| OQ5 | Contrato EAD Trust: volumen mensual incluido en ERDS | Garrigues Operations | Antes inicio P1 |
| OQ6 | Plantilla email de invitación portal (cuerpo + branding) | Marketing Garrigues | P2 sem 1 |
| OQ7 | Política retención: ¿cuántos años se guardan `communications` + `delivery_events`? LSC art. 30 dice 6 años para docs contables; comms societarias sin plazo explícito | Comité Legal Garrigues | P3 (cuando se diseñe purge job) |
| OQ8 | Texto exacto del disclaimer "No constituye evidencia final productiva" footer portal | Comité Legal Garrigues | P2 sem 1 |
| OQ9 | DPO del portal a efectos GDPR (formulario de contacto) | Garrigues + ARGA | P2 antes go-live |
| OQ10 | Aceptación expresa T&C + Política Privacidad en onboarding Step 1: links a documentos existentes o redacción nueva | Comité Legal Garrigues | P2 sem 2 |

---

## 12. Anexos

### 12.1 Mapping 40 plantillas × `comunicacion_config`

Schema de seeding directamente convertible a SQL (resumen JSON). El inventario completo de 51 comunicaciones con detalle de destinatarios, fundamento legal y respuestas esperadas vive en el archivo hermano `2026-05-17-comunicaciones-inventario-completo.md`.

> **Nota**: los UUIDs concretos se resuelven en P1 sem 1 contra el estado real de `plantillas_protegidas` en `governance_OS`. La tabla siguiente lista la lógica de seeding por `materia`.

| # | Materia | `requiere_comunicacion` | `comunicacion_config` resumido |
|---|---|:-:|---|
| 1 | `CONVOCATORIA_JUNTA` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`CONVOCATORIA`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, plazo=30, ref="Art. 176.1 LSC" |
| 2 | `NOTIFICACION_CONVOCATORIA_SL` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_INDIVIDUAL`, resp=`ACUSE`, nivel=`BUROFAX_ERDS`, plazo=15, ref="Art. 173 LSC" |
| 3 | `JUNTA_GENERAL` (acta) | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, plazo=null, ref="Art. 202 LSC" |
| 4 | `CONSEJO_ADMIN` (acta) | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, plazo=null |
| 5 | `ACTAS_ORGANOS_DELEGADOS` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`COMUNICACION_INTER_ORGANO`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL` |
| 6 | `CO_APROBACION` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`SOLICITUD_DECLARACION`, resp=`VOTO`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Art. 233.2.b LSC" |
| 7 | `ADMIN_SOLIDARIO` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`COMUNICACION_INTER_ORGANO`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 227 LSC" |
| 8 | `ACUERDO_SIN_SESION` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`CIRCULAR_SIN_SESION`, resp=`VOTO`, nivel=`BUROFAX_ERDS`, plazo=15, ref="Art. 100 RRM" |
| 9 | `DECISION_SOCIO_UNICO` | ❌ | — (socio único es el decisor, sin destinatario) |
| 10 | `DECISION_ADMIN_UNICO` | ⚠️ | condicional=true, expresión="DECISION.comunicacion_interna_detalle IS NOT NULL", tipo=`CONSIGNACION`, ref="Art. 233.1 LSC" |
| 11 | `CERTIFICACION_ACUERDOS` | ✅ | dest=`TERCERO_EXTERNO`, tipo=`CERTIFICACION`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Arts. 108-109 RRM" |
| 12 | `EXPEDIENTE_PRE` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`PUESTA_DISPOSICION`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, ref="Arts. 196-197 LSC / 245.3 LSC" |
| 13 | `CONVOCATORIA_PRE` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`PUESTA_DISPOSICION`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, ref="Art. 245.3 LSC" |
| 14 | (informe gestión) | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, ref="Arts. 253, 262 LSC" |
| 15 | `APROBACION_CUENTAS` | ✅ | dest=`MIEMBROS_ORGANO`+`AUDITOR`+`REGISTRO`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Arts. 272-273 LSC" |
| 16 | `FORMULACION_CUENTAS` | ✅ | dest=`MIEMBROS_ORGANO`+`AUDITOR`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 253 LSC" |
| 17 | `DELEGACION_FACULTADES` | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Art. 249 LSC" |
| 18 | `OPERACION_VINCULADA` | ✅ | dest=`PERSONA_AFECTADA`, tipo=`SOLICITUD_DECLARACION`, resp=`DECLARACION`, nivel=`EMAIL_CERTIFICADO`, ref="Arts. 229-230 LSC" |
| 19 | `ACTIVOS_ESENCIALES` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`PUESTA_DISPOSICION`+`NOTIFICACION_ACUERDO`, resp=`VOTO`+`INFORMATIVA`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 160.f LSC" |
| 20 | `AUTORIZACION_GARANTIA` | ✅ | dest=`MIEMBROS_ORGANO`+`PERSONA_AFECTADA`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`+`DECLARACION`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 162 LSC" |
| 21 | `APROBACION_PLAN_NEGOCIO` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`EMAIL_NORMAL` |
| 22 | `AUMENTO_CAPITAL` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`DECLARACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15 (SL) / 30 (SA), ref="Arts. 295-310 LSC" |
| 23 | `CESE_CONSEJERO` (Consejo) | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 223.1 LSC" |
| 24 | `CESE_CONSEJERO` (Junta) | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACUSE`, nivel=`BUROFAX_ERDS`, ref="Art. 223 LSC" |
| 25 | `COMITES_INTERNOS` | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Arts. 529 terdecies+ LSC" |
| 26 | `DISTRIBUCION_CARGOS` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 245.2 LSC" |
| 27 | `DISTRIBUCION_DIVIDENDOS` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`INFORMATIVA`, nivel=`EMAIL_NORMAL`, ref="Arts. 273, 348 LSC" |
| 28 | `FUSION_ESCISION` | ✅ | dest=`MIEMBROS_ORGANO`+`TERCERO_EXTERNO` (acreedores), tipo=`NOTIFICACION_ACUERDO`, resp=`DECLARACION`, nivel=`BUROFAX_ERDS`, plazo=30, ref="RDL 5/2023" |
| 29 | `MODIFICACION_ESTATUTOS` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`PUESTA_DISPOSICION`+`NOTIFICACION_ACUERDO`, resp=`INFORMATIVA`, nivel=`EMAIL_CERTIFICADO`, ref="Arts. 285-290 LSC" |
| 30 | `NOMBRAMIENTO_AUDITOR` | ✅ | dest=`TERCERO_EXTERNO`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Arts. 263-271 LSC" |
| 31 | `NOMBRAMIENTO_CONSEJERO` (Consejo, cooptación) | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Art. 244 LSC" |
| 32 | `NOMBRAMIENTO_CONSEJERO` (Junta) | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_CARGO`, resp=`ACEPTACION`, nivel=`EMAIL_CERTIFICADO`, plazo=15, ref="Arts. 214, 217-219 LSC" |
| 33 | `POLITICA_REMUNERACION` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`VOTO` (cotizadas), nivel=`EMAIL_CERTIFICADO`, ref="Arts. 217-219, 529 novodecies LSC" |
| 34 | `POLITICAS_CORPORATIVAS` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`EMAIL_NORMAL`, ref="Art. 529 ter LSC" |
| 35 | `RATIFICACION_ACTOS` | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, ref="Arts. 234-235 LSC" |
| 36 | `REDUCCION_CAPITAL` | ✅ | dest=`MIEMBROS_ORGANO`+`TERCERO_EXTERNO`, tipo=`NOTIFICACION_ACUERDO`, resp=`DECLARACION` (acreedores), nivel=`BUROFAX_ERDS`, plazo=30, ref="Arts. 317-337 LSC" |
| 37 | `SEGUROS_RESPONSABILIDAD` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`+`DECLARACION`, nivel=`EMAIL_CERTIFICADO`, ref="Art. 14 LOSSEAR" |
| 38 | `CONVOCATORIA_CDA` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`CONVOCATORIA`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, plazo=variable (estatutos), ref="Art. 246 LSC" |
| 39 | `CONVOCATORIA_COMISION_DELEGADA` | ✅ | dest=`MIEMBROS_ORGANO`, tipo=`CONVOCATORIA`, resp=`ACUSE`, nivel=`EMAIL_CERTIFICADO`, plazo=variable (Reglamento), ref="Art. 249 LSC + Reglamento Consejo" |
| 40 | `ACCION_SOCIAL_RESPONSABILIDAD` | ✅ | dest=`PERSONA_AFECTADA`, tipo=`NOTIFICACION_ACUERDO`, resp=`ACUSE`, nivel=`BUROFAX_ERDS`, ref="Art. 238.3 LSC" |

**Resultado:** 38 con `requiere_comunicacion=true`, 1 condicional, 1 con `false`.

### 12.2 Enums (`tipo_comunicacion`, `tipo_respuesta_esperada`)

**`tipo_comunicacion` (16 valores):**

| Valor | Descripción | Mapeo inventario |
|---|---|---|
| `CONVOCATORIA` | Convocatoria formal de sesión | A1-A4 |
| `NOTIFICACION_INDIVIDUAL` | Notificación individual a socio (SL art. 173) | A2 (subtipo) |
| `PUESTA_DISPOSICION` | Puesta a disposición de documentación | A5-A7 |
| `SOLICITUD_DECLARACION` | Solicitud de declaración (conflicto, idoneidad) | A8-A9 |
| `CIRCULAR_SIN_SESION` | Circular para aprobación escrita | A10 (subsume `no_session_notificaciones`) |
| `RECORDATORIO` | Recordatorio de sesión próxima | A11 |
| `NOTIFICACION_ACUERDO` | Notificación de acuerdo adoptado | B1-B3, D1-D14 |
| `REMISION_ACTA` | Remisión de acta para aprobación | B4 |
| `CERTIFICACION` | Remisión de certificación | B5 |
| `NOTIFICACION_CARGO` | Notificación de nombramiento/cese/distribución | C1-C8 |
| `ALERTA_VENCIMIENTO` | Alerta vencimiento mandato/plazo | C9, F1 |
| `CONSIGNACION` | Consignación decisión unipersonal | E1-E2 |
| `COMUNICACION_INTER_ORGANO` | Comunicación entre órganos | E3-E4, F4 |
| `SOLICITUD_INFORMACION` | Solicitud de información (miembro a Secretaría) | F5 |
| `RESPUESTA_INFORMACION` | Respuesta a solicitud de información | F6 |
| `COMUNICACION_LIBRE` | Catch-all ad hoc del secretario | F8 |

**`tipo_respuesta_esperada` (6 valores):**

| Valor | Descripción | Acción portal P2+ |
|---|---|---|
| `ACUSE` | Acuse de recibo | Marcado automático al abrir |
| `ACEPTACION` | Aceptación formal de cargo o decisión | `RSVPForm` simple SÍ/NO + firma QES P4 |
| `VOTO` | Voto SÍ/NO/ABSTENCIÓN | `VotacionForm` (P3) |
| `DECLARACION` | Declaración (conflicto, idoneidad) | `DeclaracionConflictoForm` |
| `DELEGACION` | Designación de representante | `DelegacionForm` |
| `INFORMATIVA` | No requiere respuesta | Solo `fn_marcar_lectura` |

### 12.3 Interfaces TypeScript clave

```typescript
// Snapshot inmutable del estado de la plantilla al momento de emisión
export interface TemplateSnapshot {
  plantilla_protegida_id: string;        // UUID
  plantilla_materia: string;              // "CONVOCATORIA_JUNTA"
  plantilla_tipo: string;                 // "CONVOCATORIA"
  bloques: Array<{
    clave_bloque: string;                 // "capa1_inmutable"
    version: string;                      // "1.2.1"
    hash_sha512: string;                  // integridad del bloque
  }>;
  renderizado_con: {
    capa2_variables_resueltas: Record<string, string>;
    capa3_valores_usuario: Record<string, unknown>;
  };
}

// Resultado del motor de plazos
export interface PlazoComunicacionResult {
  min_envio_date:        Date | null;
  plazo_dias:            number;
  unidad:                'NATURAL' | 'HABIL';
  fecha_limite_default:  Date | null;
  referencia_legal:      string;
  fuente_resolucion:     'LEY' | 'ESTATUTOS' | 'REGLAMENTO' | 'COMUNICACION_CONFIG';
  warnings:              string[];
  // P3: es_segunda_convocatoria, plazo_segunda_convocatoria_dias, min_envio_segunda
}

// Input para adaptadores
export interface MailSendInput { /* ver §5.1 */ }
export interface MailSendResult { /* ver §5.1 */ }

// Shape de comunicacion_config (JSONB en plantillas_protegidas)
export interface ComunicacionConfig {
  destinatarios_tipo:         Array<'MIEMBROS_ORGANO' | 'PERSONA_AFECTADA' | 'TERCERO_EXTERNO' | 'AUDITOR' | 'REGISTRO'>;
  tipo_comunicacion_default:  TipoComunicacion;
  tipo_respuesta_esperada:    TipoRespuestaEsperada;
  nivel_certificacion_minimo: 'EMAIL_NORMAL' | 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS';
  canales_permitidos:         Array<'EMAIL_NORMAL' | 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS' | 'PORTAL_PUSH'>;
  plazo_legal_dias:           number | null;
  condicional:                boolean;
  condicion_expresion:        string | null;
  referencia_legal:           string;
}
```

### 12.4 Glosario

| Término | Definición |
|---|---|
| ERDS | Electronic Registered Delivery Service (eIDAS). Servicio cualificado de entrega electrónica certificada. EAD Trust es el QTSP que lo provee a Garrigues. |
| QES | Qualified Electronic Signature (eIDAS). Firma cualificada con valor legal equivalente a manuscrita. EAD Trust la emite. |
| QTSP | Qualified Trust Service Provider (eIDAS). Proveedor cualificado de servicios de confianza. EAD Trust es el QTSP de Garrigues. |
| TSQ / TSR | Time-Stamp Query / Response (RFC 3161). Token de sello de tiempo cualificado. |
| AAL2 | Authentication Assurance Level 2 (NIST 800-63B). Doble factor obligatorio. |
| SSOT | Single Source Of Truth. Aquí: `condiciones_persona` para composición de órganos. |
| WORM | Write-Once Read-Many. Modelo de audit trail inmutable usado en `delivery_events`. |
| Capa 1/2/3 | Arquitectura de plantillas TGMS: texto inmutable / variables auto-resueltas / campos editables. |

### 12.5 Fixtures RLS test suite (P2 CI gate)

Setup: 3 tenants, 5 personas con membership cruzada, 10 comms cross-tenant. El test corre cada caso con un cliente Supabase autenticado como cada persona y verifica número de filas retornadas por queries normales.

| # | Fixture | Verifica |
|---|---|---|
| 1 | Persona A: `portal_memberships(estado='ACTIVO')` en tenant 1 + `BAJA` en tenant 2 | Como A: queries sobre `communication_recipients` retornan 0 filas con `communication_id` de comms del tenant 2 |
| 2 | Persona B: ACTIVO en tenant 1 entity X + ACTIVO en tenant 1 entity Y | Como B: ve comms con `body_id` perteneciente a `entities` X e Y |
| 3 | Persona C: scope `staff` (secretario tenant 1) + scope `member` (consejero entity Z de tenant 1) | Como C con header `X-Scope: staff` ve todas las del tenant 1 vía RLS Secretaría; con `X-Scope: member` solo las suyas como recipient |
| 4 | Persona D: `portal_memberships(estado='INVITADO')` (no activado) | Como D: queries portal retornan 0 filas (RLS exige `estado='ACTIVO'`) |
| 5 | Persona E: `portal_memberships(estado='SUSPENDIDO')` | Como E: queries portal retornan 0 filas |
| 6 | Communication X: `tipo='COMUNICACION_LIBRE'` del tenant 1 | Como persona F del tenant 2: query no devuelve X |
| 7 | Communication Y: recipients = [persona A, persona B] | A ve Y; B ve Y; C (staff mismo tenant) ve Y desde consola; D (otro tenant, inactivo) no ve Y |

Cada fixture es un test independiente con assertion `expect(result.length).toBe(N)`. El test runner es Vitest + cliente Supabase autenticado por usuario de fixture (creado con `auth.admin.createUser` en `beforeAll`).
