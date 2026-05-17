CREATE TABLE communication_recipients (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id         uuid NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  person_id                uuid NOT NULL REFERENCES persons(id),
  cargo_en_organo          text,
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

COMMENT ON COLUMN communication_recipients.canal_original IS 'Inmutable. Captura el canal_primario al INSERT. Si canal_original <> canal_usado, dashboard muestra badge "fallback".';
