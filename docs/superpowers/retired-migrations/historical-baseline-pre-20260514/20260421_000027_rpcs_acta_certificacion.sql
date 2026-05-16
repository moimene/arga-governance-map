-- supabase/migrations/20260421_000027_rpcs_acta_certificacion.sql
-- F8.1 — RPCs fn_generar_acta + fn_generar_certificacion con gate hash.
--
-- Diferencias respecto al plan original (ajustadas al schema real):
--   - `meetings` NO tiene entity_id: se resuelve JOIN governing_bodies.
--   - `authority_evidence` usa `cargo` + `estado='VIGENTE'` (no
--     `role` + `valido_hasta IS NULL`).
--   - `censo_snapshot` NO tiene `hash_snapshot`: derivamos el snapshot_hash
--     desde `audit_log.hash_sha512` vía FK `audit_worm_id`. Si el snapshot
--     no está enlazado al WORM (caso raro), caemos a 'NO_SNAPSHOT_HASH'.
--   - `entities.legal_form` existe (confirmado) + tipo_social redundante.
--   - pgcrypto se habilita PRIMERO (requisito de digest()).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- fn_generar_acta(p_meeting_id, p_content, p_snapshot_id) RETURNS uuid
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generar_acta(
  p_meeting_id uuid,
  p_content    text,
  p_snapshot_id uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_minute_id    uuid;
  v_content_hash text;
  v_meeting      RECORD;
  v_entity_id    uuid;
  v_rules_applied jsonb;
BEGIN
  -- Meeting debe existir. Join con governing_bodies resuelve entity_id,
  -- que `meetings` no almacena directamente.
  SELECT m.*, gb.entity_id AS entity_id_resolved
    INTO v_meeting
    FROM meetings m
    LEFT JOIN governing_bodies gb ON gb.id = m.body_id
   WHERE m.id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting not found: %', p_meeting_id;
  END IF;
  v_entity_id := v_meeting.entity_id_resolved;

  -- Si hay snapshot, debe pertenecer al mismo meeting.
  IF p_snapshot_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM censo_snapshot
       WHERE id = p_snapshot_id AND meeting_id = p_meeting_id
    ) THEN
      RAISE EXCEPTION 'snapshot % no corresponde a meeting %',
        p_snapshot_id, p_meeting_id;
    END IF;
  END IF;

  -- Content hash (SHA-256 hex, requiere pgcrypto).
  v_content_hash := encode(digest(p_content, 'sha256'), 'hex');

  -- rules_applied — stub mínimo; el motor LSC server-side llenará esto
  -- en fases futuras (por ahora solo dejamos la marca temporal).
  v_rules_applied := jsonb_build_object('ts', now(), 'materia_ref', NULL);

  INSERT INTO minutes (
    tenant_id, meeting_id, content, signed_at, is_locked,
    snapshot_id, content_hash, rules_applied, body_id, entity_id
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_content, NULL, false,
    p_snapshot_id, v_content_hash, v_rules_applied,
    v_meeting.body_id, v_entity_id
  )
  RETURNING id INTO v_minute_id;

  RETURN v_minute_id;
END;
$$;

-- ============================================================
-- fn_generar_certificacion(...) RETURNS uuid
--
-- Crea certification con gate_hash = SHA-256(snapshot_hash || resultado_hash).
-- - snapshot_hash = audit_log.hash_sha512 del censo_snapshot asociado al
--   minute (vía audit_worm_id). Si no hay enlace WORM → 'NO_SNAPSHOT_HASH'.
-- - resultado_hash = SHA-256(join pipe-delimited de agreements_certified).
-- Vº Bº PRESIDENTE obligatorio para SA salvo ADMIN_UNICO.
-- Autoridad vigente verificada contra authority_evidence (cargo + estado).
-- ============================================================
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
  -- Cargar minute + snapshot_hash vía audit_log.hash_sha512 (censo_snapshot
  -- no tiene columna hash_snapshot; el chain hash vive en audit_log).
  SELECT m.*, al.hash_sha512 AS snapshot_hash_resolved
    INTO v_minute
    FROM minutes m
    LEFT JOIN censo_snapshot c ON c.id = m.snapshot_id
    LEFT JOIN audit_log      al ON al.id = c.audit_worm_id
   WHERE m.id = p_minute_id;
  IF v_minute.id IS NULL THEN
    RAISE EXCEPTION 'minute not found: %', p_minute_id;
  END IF;

  -- Entity para resolver legal_form (SA requiere Vº Bº).
  SELECT * INTO v_entity FROM entities WHERE id = v_minute.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity not found for minute %', p_minute_id;
  END IF;

  -- Vº Bº obligatorio si SA y certificante no es ADMIN_UNICO.
  v_requires_vb := (v_entity.legal_form = 'SA'
                    AND p_certificante_role <> 'ADMIN_UNICO');
  IF v_requires_vb AND p_visto_bueno_persona_id IS NULL THEN
    RAISE EXCEPTION 'Vº Bº PRESIDENTE requerido para SA (salvo ADMIN_UNICO)';
  END IF;

  -- Autoridad vigente del certificante. En authority_evidence el nombre de
  -- columna es `cargo` (no `role`) y la vigencia es `estado='VIGENTE'`.
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

  -- Hashes. Si snapshot no está enlazado al WORM (snapshot_id NULL o
  -- censo_snapshot.audit_worm_id NULL), usamos marcador estable.
  v_snapshot_hash  := COALESCE(v_minute.snapshot_hash_resolved, 'NO_SNAPSHOT_HASH');
  v_resultado_hash := encode(
    digest(
      COALESCE(array_to_string(p_agreements_certified, '|'), ''),
      'sha256'
    ),
    'hex'
  );
  v_gate_hash := encode(
    digest(v_snapshot_hash || v_resultado_hash, 'sha256'),
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

-- ============================================================
-- GRANTS — ambas RPCs son callables por authenticated + service_role
-- ============================================================
GRANT EXECUTE ON FUNCTION fn_generar_acta(uuid, text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_generar_certificacion(uuid, text, text[], text, uuid)
  TO authenticated, service_role;
