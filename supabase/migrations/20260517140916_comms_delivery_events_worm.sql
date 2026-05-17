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

CREATE OR REPLACE FUNCTION tg_delivery_events_worm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'communication_delivery_events es inmutable (WORM). evento=%, id=%', OLD.evento, OLD.id;
END $$;

CREATE TRIGGER tg_delivery_events_no_update
  BEFORE UPDATE ON communication_delivery_events
  FOR EACH ROW EXECUTE FUNCTION tg_delivery_events_worm();

CREATE TRIGGER tg_delivery_events_no_delete
  BEFORE DELETE ON communication_delivery_events
  FOR EACH ROW EXECUTE FUNCTION tg_delivery_events_worm();

COMMENT ON TABLE communication_delivery_events IS 'Audit trail WORM por evento de delivery. hash_chain serializado vía SELECT FOR UPDATE.';
