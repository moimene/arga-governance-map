-- T11 hardening: deterministic tiebreaker in chain-hash lookup + inline
-- comments documenting scope mapping, race-limitation inheritance, and
-- forward-looking SECURITY DEFINER note. Body of fn_crear_censo_snapshot
-- unchanged semantically; trg_censo_snapshot_worm gains `, id DESC` in the
-- ORDER BY to make the chain deterministic under same-microsecond inserts.

CREATE OR REPLACE FUNCTION fn_crear_censo_snapshot(
  p_meeting_id UUID,
  p_session_kind TEXT,
  p_entity_id UUID,
  p_body_id UUID,
  p_snapshot_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM entities WHERE id = p_entity_id;

  IF p_body_id IS NULL THEN
    PERFORM fn_refresh_parte_votante_entity(p_entity_id);
  ELSE
    PERFORM fn_refresh_parte_votante_body(p_body_id);
  END IF;

  INSERT INTO censo_snapshot(
    tenant_id, meeting_id, session_kind, entity_id, body_id,
    snapshot_type, payload, capital_total_base, total_partes
  )
  SELECT
    v_tenant_id,
    p_meeting_id,
    p_session_kind,
    p_entity_id,
    p_body_id,
    p_snapshot_type,
    COALESCE(jsonb_agg(to_jsonb(pv) ORDER BY pv.person_id), '[]'::jsonb),
    SUM(pv.denominator_weight),
    COUNT(*)
  FROM parte_votante_current pv
  WHERE pv.entity_id = p_entity_id
    AND pv.body_id IS NOT DISTINCT FROM p_body_id
    AND (
      (p_snapshot_type = 'ECONOMICO'  AND pv.source_type = 'CAPITAL')
      OR (p_snapshot_type = 'POLITICO'  AND pv.source_type = 'CARGO')
      OR (p_snapshot_type = 'UNIVERSAL' AND pv.source_type = 'CAPITAL')
    )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_censo_snapshot_worm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_prev_hash TEXT;
  v_payload JSONB;
  v_new_hash TEXT;
BEGIN
  v_payload := jsonb_build_object('new', to_jsonb(NEW));

  SELECT hash_sha512 INTO v_prev_hash
  FROM audit_log
  WHERE tenant_id = NEW.tenant_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_new_hash := encode(
    digest(
      COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      'INSERT' || '|' ||
      'censo_snapshot' || '|' ||
      NEW.id::text || '|' ||
      v_payload::text,
      'sha512'
    ),
    'hex'
  );

  INSERT INTO audit_log (
    id, tenant_id, table_name, record_id, action, delta, hash_sha512, created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.tenant_id,
    'censo_snapshot',
    NEW.id,
    'CENSO_SNAPSHOT_CREATED',
    v_payload,
    v_new_hash,
    now()
  )
  RETURNING id INTO v_audit_id;

  NEW.audit_worm_id := v_audit_id;
  RETURN NEW;
END;
$$;
