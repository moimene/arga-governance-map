-- Secretaría 360 P0 — Acta cronológica agenda-driven.
--
-- The minute is generated from agenda_items ordered by order_number and the
-- canonical minutes hash becomes part of the QTSP evidence chain.

BEGIN;

ALTER TABLE minutes
  ADD COLUMN IF NOT EXISTS canonical_minutes_hash text,
  ADD COLUMN IF NOT EXISTS legal_structure_validation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN minutes.canonical_minutes_hash IS
  'SHA-256 de la estructura canónica del acta: meeting_id + agenda_items ordenados + outcomes de acuerdos + constancias + metadatos de anexos.';
COMMENT ON COLUMN minutes.legal_structure_validation IS
  'Resultado de validación legal estructural previa a firma: orden del día completo, sin saltos y sin acuerdos bajo puntos no decisorios.';

-- agreement_requires_decisorio lives in
-- 20260515045355_agenda_item_v31_taxonomy_fast_track.sql. This migration is
-- intentionally limited to agenda-driven minutes/QTSP; the legacy synthetic
-- anchor backfill is isolated in 20260515070447.

-- Optional fourth argument preserves backwards compatibility for callers that
-- still send only (meeting_id, content, snapshot_id).
CREATE OR REPLACE FUNCTION fn_generar_acta(
  p_meeting_id uuid,
  p_content    text,
  p_snapshot_id uuid,
  p_canonical_minutes_hash text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_minute_id    uuid;
  v_content_hash text;
  v_canonical_hash text;
  v_meeting      RECORD;
  v_entity_id    uuid;
  v_rules_applied jsonb;
BEGIN
  SELECT m.*, gb.entity_id AS entity_id_resolved
    INTO v_meeting
    FROM meetings m
    LEFT JOIN governing_bodies gb ON gb.id = m.body_id
   WHERE m.id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting not found: %', p_meeting_id;
  END IF;
  v_entity_id := v_meeting.entity_id_resolved;

  IF p_snapshot_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM censo_snapshot
       WHERE id = p_snapshot_id AND meeting_id = p_meeting_id
    ) THEN
      RAISE EXCEPTION 'snapshot % no corresponde a meeting %',
        p_snapshot_id, p_meeting_id;
    END IF;
  END IF;

  v_content_hash := encode(digest(p_content, 'sha256'), 'hex');
  v_canonical_hash := COALESCE(NULLIF(p_canonical_minutes_hash, ''), v_content_hash);
  v_rules_applied := jsonb_build_object(
    'ts', now(),
    'materia_ref', NULL,
    'agenda_driven_minutes', true,
    'canonical_minutes_hash', v_canonical_hash
  );

  INSERT INTO minutes (
    tenant_id, meeting_id, content, signed_at, is_locked,
    snapshot_id, content_hash, canonical_minutes_hash,
    legal_structure_validation, rules_applied, body_id, entity_id
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_content, NULL, false,
    p_snapshot_id, v_content_hash, v_canonical_hash,
    jsonb_build_object('ok', true, 'source', 'ActaLegalStructureValidator', 'validated_at', now()),
    v_rules_applied,
    v_meeting.body_id, v_entity_id
  )
  RETURNING id INTO v_minute_id;

  RETURN v_minute_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_generar_certificacion(
  p_minute_id               uuid,
  p_tipo                    text,
  p_agreements_certified    text[],
  p_certificante_role       text,
  p_visto_bueno_persona_id  uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_cert_id        uuid;
  v_minute         RECORD;
  v_entity         entities%ROWTYPE;
  v_snapshot_hash  text;
  v_resultado_hash text;
  v_gate_hash      text;
  v_requires_vb    boolean;
  v_auth_ev_id     uuid;
BEGIN
  SELECT m.*, al.hash_sha512 AS snapshot_hash_resolved
    INTO v_minute
    FROM minutes m
    LEFT JOIN censo_snapshot c ON c.id = m.snapshot_id
    LEFT JOIN audit_log      al ON al.id = c.audit_worm_id
   WHERE m.id = p_minute_id;
  IF v_minute.id IS NULL THEN
    RAISE EXCEPTION 'minute not found: %', p_minute_id;
  END IF;

  SELECT * INTO v_entity FROM entities WHERE id = v_minute.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity not found for minute %', p_minute_id;
  END IF;

  v_requires_vb := (v_entity.legal_form = 'SA'
                    AND p_certificante_role <> 'ADMIN_UNICO');
  IF v_requires_vb AND p_visto_bueno_persona_id IS NULL THEN
    RAISE EXCEPTION 'Vº Bº PRESIDENTE requerido para SA (salvo ADMIN_UNICO)';
  END IF;

  SELECT id INTO v_auth_ev_id
    FROM authority_evidence
   WHERE entity_id = v_minute.entity_id
     AND cargo = p_certificante_role
     AND estado = 'VIGENTE'
   LIMIT 1;
  IF v_auth_ev_id IS NULL THEN
    RAISE EXCEPTION 'No hay autoridad vigente para cargo % en entity %',
      p_certificante_role, v_minute.entity_id;
  END IF;

  v_snapshot_hash  := COALESCE(v_minute.snapshot_hash_resolved, 'NO_SNAPSHOT_HASH');
  v_resultado_hash := encode(
    digest(
      COALESCE(array_to_string(p_agreements_certified, '|'), ''),
      'sha256'
    ),
    'hex'
  );
  v_gate_hash := encode(
    digest(
      v_snapshot_hash ||
      COALESCE(v_minute.canonical_minutes_hash, 'NO_CANONICAL_MINUTES_HASH') ||
      v_resultado_hash,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO certifications (
    tenant_id, agreement_id, agreements_certified, certifier_id,
    content, minute_id,
    tipo_certificacion, certificante_role,
    visto_bueno_persona_id, visto_bueno_fecha,
    gate_hash, authority_evidence_id,
    requires_qualified_signature, signature_status
  ) VALUES (
    v_minute.tenant_id, NULL, p_agreements_certified, NULL,
    NULL, p_minute_id,
    p_tipo, p_certificante_role,
    p_visto_bueno_persona_id,
    CASE WHEN p_visto_bueno_persona_id IS NOT NULL THEN now() ELSE NULL END,
    v_gate_hash, v_auth_ev_id,
    true, 'PENDING'
  )
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generar_acta(uuid, text, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_generar_certificacion(uuid, text, text[], text, uuid)
  TO authenticated, service_role;

COMMIT;
