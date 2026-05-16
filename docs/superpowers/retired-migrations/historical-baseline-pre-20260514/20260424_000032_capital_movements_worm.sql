-- ============================================================
-- Migration 000032: capital_movements WORM ledger
-- Append-only ledger of capital movements triggered by inscribed agreements.
-- ============================================================

CREATE TABLE IF NOT EXISTS capital_movements (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  entity_id             uuid NOT NULL REFERENCES entities(id),
  agreement_id          uuid REFERENCES agreements(id),
  person_id             uuid NOT NULL REFERENCES persons(id),
  share_class_id        uuid REFERENCES share_classes(id),
  delta_shares          numeric(20, 6) NOT NULL,
  delta_voting_weight   numeric(20, 6) NOT NULL DEFAULT 0,
  delta_denominator_weight numeric(20, 6) NOT NULL DEFAULT 0,
  movement_type         text NOT NULL CHECK (movement_type IN (
                          'EMISION', 'AMORTIZACION', 'TRANSMISION', 'PIGNORACION',
                          'LIBERACION_PRENDA', 'SPLIT', 'CONTRASPLIT'
                        )),
  effective_date        date NOT NULL,
  notas                 text,
  audit_worm_id         uuid REFERENCES audit_log(id),
  created_at            timestamptz DEFAULT now() NOT NULL
);

-- WORM: prevent mutation after insert
CREATE OR REPLACE FUNCTION fn_capital_movements_worm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'capital_movements is immutable — use a corrective entry instead';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'capital_movements is immutable — rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_capital_movements_worm
  BEFORE UPDATE OR DELETE ON capital_movements
  FOR EACH ROW EXECUTE FUNCTION fn_capital_movements_worm();

-- Indices
CREATE INDEX IF NOT EXISTS idx_capital_movements_tenant    ON capital_movements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_capital_movements_entity    ON capital_movements (entity_id);
CREATE INDEX IF NOT EXISTS idx_capital_movements_agreement ON capital_movements (agreement_id);
CREATE INDEX IF NOT EXISTS idx_capital_movements_person    ON capital_movements (person_id);
CREATE INDEX IF NOT EXISTS idx_capital_movements_date      ON capital_movements (effective_date DESC);

-- RLS
ALTER TABLE capital_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_capital_movements" ON capital_movements
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- Function to register a capital movement (creates audit_worm entry automatically)
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_capital(
  p_tenant_id             uuid,
  p_entity_id             uuid,
  p_agreement_id          uuid,
  p_person_id             uuid,
  p_share_class_id        uuid,
  p_delta_shares          numeric,
  p_delta_voting_weight   numeric,
  p_delta_denominator_weight numeric,
  p_movement_type         text,
  p_effective_date        date,
  p_notas                 text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_movement_id uuid;
  v_audit_id    uuid;
  v_prev_hash   text;
BEGIN
  -- Get previous hash for chain
  SELECT hash_sha512 INTO v_prev_hash
    FROM audit_log
   ORDER BY created_at DESC
   LIMIT 1;

  -- Insert audit worm entry
  INSERT INTO audit_log (
    tenant_id, object_type, object_id, action, delta,
    previous_hash, hash_sha512, created_at
  ) VALUES (
    p_tenant_id,
    'capital_movement',
    p_agreement_id::text,
    'INSERT',
    jsonb_build_object(
      'person_id', p_person_id,
      'delta_shares', p_delta_shares,
      'movement_type', p_movement_type,
      'effective_date', p_effective_date
    ),
    COALESCE(v_prev_hash, 'GENESIS'),
    encode(sha256(
      (COALESCE(v_prev_hash, 'GENESIS') ||
       p_movement_type || p_delta_shares::text ||
       now()::text)::bytea
    ), 'hex'),
    now()
  ) RETURNING id INTO v_audit_id;

  -- Insert movement
  INSERT INTO capital_movements (
    tenant_id, entity_id, agreement_id, person_id, share_class_id,
    delta_shares, delta_voting_weight, delta_denominator_weight,
    movement_type, effective_date, notas, audit_worm_id
  ) VALUES (
    p_tenant_id, p_entity_id, p_agreement_id, p_person_id, p_share_class_id,
    p_delta_shares, p_delta_voting_weight, p_delta_denominator_weight,
    p_movement_type, p_effective_date, p_notas, v_audit_id
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;
