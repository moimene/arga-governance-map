CREATE TABLE communication_attachments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id         uuid NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  tipo                     text NOT NULL CHECK (tipo IN (
                             'DOCUMENTO_GENERADO','INFORME_PRECEPTIVO','EXPEDIENTE_REF',
                             'TEXTO_INTEGRO','ORDEN_DIA','OTRO')),
  label                    text NOT NULL,
  evidence_bundle_id       uuid REFERENCES evidence_bundles(id),
  storage_uri              text NOT NULL,
  hash_sha512              text NOT NULL,
  size_bytes               bigint,
  mime_type                text,
  orden                    integer NOT NULL DEFAULT 0,
  modo_entrega             text NOT NULL DEFAULT 'ADJUNTO' CHECK (modo_entrega IN ('ADJUNTO','LINK_FIRMADO')),
  signed_url_expiry_hours  integer DEFAULT 168,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_attachments_comm ON communication_attachments(communication_id, orden);

COMMENT ON COLUMN communication_attachments.modo_entrega IS
  'ADJUNTO = adjuntar binario al email. LINK_FIRMADO = generar signed URL y embeber link en cuerpo HTML. Board pack y >5MB usan LINK_FIRMADO.';
