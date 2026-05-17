-- communications: agregado raíz del módulo de comunicaciones
CREATE TABLE communications (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL REFERENCES tenants(id),
  entity_id                   uuid NOT NULL REFERENCES entities(id),
  body_id                     uuid REFERENCES governing_bodies(id),
  organo_tipo                 text NOT NULL CHECK (organo_tipo IN (
                                'JUNTA_GENERAL','CONSEJO_ADMIN','COMISION_DELEGADA',
                                'SOCIO_UNICO','ADMIN_UNICO','ADMIN_CONJUNTA','ADMIN_SOLIDARIOS')),
  agreement_id                uuid REFERENCES agreements(id),
  meeting_id                  uuid REFERENCES meetings(id),
  template_id                 uuid REFERENCES plantillas_protegidas(id),
  normative_snapshot_id       uuid,
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
  cuerpo_render               text NOT NULL,
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

COMMENT ON TABLE communications IS 'Agregado raíz de comunicaciones a miembros de órganos sociales. Una fila por comunicación lógica enviada.';
COMMENT ON COLUMN communications.normative_snapshot_id IS 'Nullable; en P1 el snapshot vive en metadata.normative_profile JSON. P3 materializa a normative_snapshots table.';
COMMENT ON COLUMN communications.cuerpo_render IS 'HTML/texto final renderizado. NO incluir en SELECT de listado por tamaño.';
COMMENT ON COLUMN communications.tiene_rebotes IS 'Flag warning derivado del trigger tg_communications_recompute_estado. No bloquea flujo.';
