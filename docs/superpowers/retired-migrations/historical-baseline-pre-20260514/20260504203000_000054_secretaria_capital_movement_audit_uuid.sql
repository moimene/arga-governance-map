-- ============================================================
-- Migration 000054: secretaria P0 capital movement audit UUID hotfix
-- Fixes fn_registrar_movimiento_capital audit_log.object_id type in Cloud.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_movement_id uuid;
  v_audit_id    uuid;
  v_prev_hash   text;
BEGIN
  SELECT hash_sha512 INTO v_prev_hash
    FROM audit_log
   ORDER BY created_at DESC
   LIMIT 1;

  INSERT INTO audit_log (
    tenant_id, object_type, object_id, action, delta,
    previous_hash, hash_sha512, created_at
  ) VALUES (
    p_tenant_id,
    'capital_movement',
    p_agreement_id,
    'INSERT',
    jsonb_build_object(
      'entity_id', p_entity_id,
      'agreement_id', p_agreement_id,
      'person_id', p_person_id,
      'share_class_id', p_share_class_id,
      'delta_shares', p_delta_shares,
      'delta_voting_weight', p_delta_voting_weight,
      'delta_denominator_weight', p_delta_denominator_weight,
      'movement_type', p_movement_type,
      'effective_date', p_effective_date,
      'notas', p_notas
    ),
    COALESCE(v_prev_hash, 'GENESIS'),
    encode(sha256(
      (COALESCE(v_prev_hash, 'GENESIS') ||
       p_tenant_id::text || p_entity_id::text ||
       COALESCE(p_agreement_id::text, 'NO_AGREEMENT') ||
       p_person_id::text || p_movement_type ||
       p_delta_shares::text || p_effective_date::text ||
       now()::text)::bytea
    ), 'hex'),
    now()
  ) RETURNING id INTO v_audit_id;

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
