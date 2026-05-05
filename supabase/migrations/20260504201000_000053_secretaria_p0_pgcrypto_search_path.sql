-- ============================================================
-- Migration 000053: Secretaria P0 pgcrypto search path hotfix
--
-- Hotfix over 000052: pgcrypto is exposed from the extensions schema in Supabase Cloud.
-- Covers:
--   1. Capability checks for authenticated RPC callers.
--   2. Actor/person binding for no-session votes.
--   3. Tenant validation for selected templates and transmission recipients.
--   4. Certification authority scoped to the authenticated person unless
--      invoked by service_role/admin support.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Tenant authorization helper for SECURITY DEFINER RPCs.
-- Service role may run backend jobs; authenticated users must match their
-- user_profiles.tenant_id or an explicit tenant_id JWT claim.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_secretaria_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    (
      SELECT up.tenant_id
        FROM user_profiles up
       WHERE up.user_id = auth.uid()
       LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_tenant_access(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_claim_role text;
  v_current_tenant_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_claim_role := current_setting('request.jwt.claim.role', true);
  IF v_claim_role = 'service_role' THEN
    RETURN;
  END IF;

  SELECT fn_secretaria_current_tenant_id() INTO v_current_tenant_id;
  IF v_current_tenant_id IS NULL OR v_current_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'tenant access denied for %', p_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_current_tenant_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_tenant_access(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT current_setting('request.jwt.claim.role', true) = 'service_role'
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_current_role_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'role_code', ''),
    NULLIF(auth.jwt() ->> 'app_role', ''),
    (
      SELECT up.role_code
        FROM user_profiles up
       WHERE up.user_id = auth.uid()
       LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_current_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'person_id', '')::uuid,
    (
      SELECT up.person_id
        FROM user_profiles up
       WHERE up.user_id = auth.uid()
       LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_capability(
  p_tenant_id uuid,
  p_action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  IF fn_secretaria_is_service_role() THEN
    RETURN;
  END IF;

  v_role := fn_secretaria_current_role_code();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'role required for action %', p_action;
  END IF;
  IF v_role = 'ADMIN_TENANT' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM capability_matrix cm
     WHERE cm.role = v_role
       AND cm.action = p_action
       AND cm.enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'capability % denied for role %', p_action, v_role;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_role_allowed(
  p_tenant_id uuid,
  p_allowed_roles text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  IF fn_secretaria_is_service_role() THEN
    RETURN;
  END IF;

  v_role := fn_secretaria_current_role_code();
  IF v_role IS NULL OR NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'role % is not allowed for this Secretaria action', COALESCE(v_role, '<missing>');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_actor_person(
  p_tenant_id uuid,
  p_person_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_person_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  IF fn_secretaria_is_service_role() THEN
    RETURN;
  END IF;

  v_current_person_id := fn_secretaria_current_person_id();
  IF v_current_person_id IS NULL OR v_current_person_id <> p_person_id THEN
    RAISE EXCEPTION 'person access denied for %', p_person_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_person_tenant(
  p_tenant_id uuid,
  p_person_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'person_id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM persons p
     WHERE p.id = p_person_id
       AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'person % does not belong to tenant %', p_person_id, p_tenant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_template_tenant(
  p_tenant_id uuid,
  p_template_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_template_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM plantillas_protegidas p
     WHERE p.id = p_template_id
       AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'template % does not belong to tenant %', p_template_id, p_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_is_service_role()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_current_role_code()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_current_person_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_capability(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_role_allowed(uuid, text[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_actor_person(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_person_tenant(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_template_tenant(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Schema bridge: legacy UI table no_session_resolutions becomes the
-- transaction source for the legal WORM tables no_session_expedientes /
-- no_session_respuestas.
-- ---------------------------------------------------------------------

ALTER TABLE no_session_expedientes
  ALTER COLUMN agreement_id DROP NOT NULL;

ALTER TABLE no_session_expedientes
  ADD COLUMN IF NOT EXISTS no_session_resolution_id uuid REFERENCES no_session_resolutions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS selected_template_id uuid REFERENCES plantillas_protegidas(id) ON DELETE SET NULL;

ALTER TABLE no_session_resolutions
  ADD COLUMN IF NOT EXISTS selected_template_id uuid REFERENCES plantillas_protegidas(id) ON DELETE SET NULL;

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS no_session_resolution_id uuid REFERENCES no_session_resolutions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_no_session_expedientes_resolution
  ON no_session_expedientes(tenant_id, no_session_resolution_id)
  WHERE no_session_resolution_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agreements_no_session_resolution
  ON agreements(tenant_id, no_session_resolution_id)
  WHERE no_session_resolution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_no_session_respuestas_expediente
  ON no_session_respuestas(expediente_id);

CREATE INDEX IF NOT EXISTS idx_no_session_resolutions_tenant_status_deadline
  ON no_session_resolutions(tenant_id, status, voting_deadline);

-- ---------------------------------------------------------------------
-- fn_cerrar_votaciones_vencidas
-- P0 hardening: p_tenant_id is mandatory. A SECURITY DEFINER function must
-- never support a NULL tenant sweep from the application surface.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS fn_cerrar_votaciones_vencidas(uuid);

CREATE OR REPLACE FUNCTION fn_cerrar_votaciones_vencidas(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_closed_count integer;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  WITH expired AS (
    SELECT id
      FROM no_session_resolutions
     WHERE tenant_id = p_tenant_id
       AND status = 'VOTING_OPEN'
       AND voting_deadline IS NOT NULL
       AND voting_deadline < now()
     FOR UPDATE
  ),
  updated_resolutions AS (
    UPDATE no_session_resolutions nsr
       SET status = 'RECHAZADO',
           closed_at = COALESCE(closed_at, now())
      FROM expired
     WHERE nsr.id = expired.id
     RETURNING nsr.id
  ),
  updated_expedientes AS (
    UPDATE no_session_expedientes nse
       SET estado = 'CERRADO_FAIL',
           fecha_cierre = COALESCE(fecha_cierre, now()),
           motivo_cierre = COALESCE(motivo_cierre, 'voting_deadline_expired')
      FROM updated_resolutions ur
     WHERE nse.tenant_id = p_tenant_id
       AND nse.no_session_resolution_id = ur.id
     RETURNING nse.id
  )
  SELECT COUNT(*) INTO v_closed_count FROM updated_resolutions;

  RETURN COALESCE(v_closed_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_cerrar_votaciones_vencidas(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_no_session_cast_response
-- Records a single legal response in WORM storage. Replays from the same
-- person are idempotent: the original row is returned and no counters are
-- incremented twice.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_no_session_cast_response(
  p_tenant_id uuid,
  p_resolution_id uuid,
  p_person_id uuid,
  p_sentido text,
  p_texto_respuesta text DEFAULT NULL,
  p_firma_qes_ref text DEFAULT NULL,
  p_notificacion_certificada_ref text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_resolution no_session_resolutions%ROWTYPE;
  v_body record;
  v_expediente_id uuid;
  v_response_id uuid;
  v_existing_response_id uuid;
  v_sentido text;
  v_capital_participacion numeric;
  v_porcentaje_capital numeric;
  v_es_consejero boolean;
  v_votes_for integer;
  v_votes_against integer;
  v_abstentions integer;
  v_total_required integer;
  v_next_status text;
  v_tipo_proceso text;
  v_condicion_adopcion text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'VOTE_EMISSION');
  PERFORM fn_secretaria_assert_actor_person(p_tenant_id, p_person_id);
  IF p_resolution_id IS NULL THEN
    RAISE EXCEPTION 'p_resolution_id is required';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'p_person_id is required';
  END IF;

  v_sentido := upper(trim(p_sentido));
  IF v_sentido NOT IN ('CONSENTIMIENTO', 'OBJECION', 'OBJECION_PROCEDIMIENTO', 'SILENCIO') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido;
  END IF;

  SELECT *
    INTO v_resolution
    FROM no_session_resolutions
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_session_resolution not found: %', p_resolution_id;
  END IF;

  IF v_resolution.status NOT IN ('VOTING_OPEN', 'ABIERTO', 'NOTIFICADO') THEN
    SELECT r.id INTO v_existing_response_id
      FROM no_session_expedientes e
      JOIN no_session_respuestas r ON r.expediente_id = e.id
     WHERE e.tenant_id = p_tenant_id
       AND e.no_session_resolution_id = p_resolution_id
       AND r.person_id = p_person_id
     LIMIT 1;

    IF v_existing_response_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', v_resolution.status,
        'resolution_id', p_resolution_id,
        'response_id', v_existing_response_id,
        'idempotent', true,
        'message', 'response_already_recorded'
      );
    END IF;

    RAISE EXCEPTION 'votacion no activa: %', v_resolution.status;
  END IF;

  IF v_resolution.voting_deadline IS NOT NULL AND v_resolution.voting_deadline < now() THEN
    UPDATE no_session_resolutions
       SET status = 'RECHAZADO',
           closed_at = COALESCE(closed_at, now())
     WHERE id = p_resolution_id
       AND tenant_id = p_tenant_id;

    UPDATE no_session_expedientes
       SET estado = 'CERRADO_FAIL',
           fecha_cierre = COALESCE(fecha_cierre, now()),
           motivo_cierre = COALESCE(motivo_cierre, 'voting_deadline_expired')
     WHERE tenant_id = p_tenant_id
       AND no_session_resolution_id = p_resolution_id;

    RAISE EXCEPTION 'voting window expired for no_session_resolution %', p_resolution_id;
  END IF;

  SELECT gb.id, gb.entity_id, gb.body_type, gb.name
    INTO v_body
    FROM governing_bodies gb
   WHERE gb.id = v_resolution.body_id
     AND gb.tenant_id = p_tenant_id;
  IF v_body.id IS NULL OR v_body.entity_id IS NULL THEN
    RAISE EXCEPTION 'governing body/entity not found for no_session_resolution %', p_resolution_id;
  END IF;

  v_tipo_proceso := CASE
    WHEN upper(coalesce(v_body.body_type, '')) LIKE '%CONSEJO%'
      OR upper(coalesce(v_body.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN')
      THEN 'CIRCULACION_CONSEJO'
    ELSE 'UNANIMIDAD_ESCRITA_SL'
  END;

  v_condicion_adopcion := CASE
    WHEN v_resolution.requires_unanimity IS TRUE AND v_tipo_proceso = 'CIRCULACION_CONSEJO'
      THEN 'UNANIMIDAD_CONSEJEROS'
    WHEN v_resolution.requires_unanimity IS TRUE
      THEN 'UNANIMIDAD_CAPITAL'
    ELSE 'MAYORIA_CONSEJEROS_ESCRITA'
  END;

  INSERT INTO no_session_expedientes (
    tenant_id, agreement_id, no_session_resolution_id, selected_template_id,
    entity_id, body_id, tipo_proceso, propuesta_texto, propuesta_fecha,
    ventana_inicio, ventana_fin, estado, condicion_adopcion, snapshot_hash
  ) VALUES (
    p_tenant_id, NULL, p_resolution_id, v_resolution.selected_template_id,
    v_body.entity_id, v_body.id, v_tipo_proceso, v_resolution.proposal_text, current_date,
    COALESCE(v_resolution.opened_at, now()), v_resolution.voting_deadline,
    'ABIERTO', v_condicion_adopcion,
    encode(digest(
      coalesce(v_resolution.title, '') || '|' ||
      coalesce(v_resolution.proposal_text, '') || '|' ||
      p_resolution_id::text,
      'sha256'
    ), 'hex')
  )
  ON CONFLICT (tenant_id, no_session_resolution_id)
  WHERE no_session_resolution_id IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_expediente_id;

  SELECT
    COALESCE(SUM(numero_titulos), 0),
    COALESCE(SUM(porcentaje_capital), 0)
    INTO v_capital_participacion, v_porcentaje_capital
    FROM capital_holdings
   WHERE tenant_id = p_tenant_id
     AND entity_id = v_body.entity_id
     AND holder_person_id = p_person_id
     AND effective_to IS NULL;

  SELECT EXISTS (
    SELECT 1
      FROM condiciones_persona
     WHERE tenant_id = p_tenant_id
       AND person_id = p_person_id
       AND entity_id = v_body.entity_id
       AND estado = 'VIGENTE'
       AND (
         body_id = v_body.id
         OR tipo_condicion IN ('CONSEJERO', 'PRESIDENTE', 'SECRETARIO', 'VICEPRESIDENTE', 'CONSEJERO_COORDINADOR')
       )
  ) INTO v_es_consejero;

  INSERT INTO no_session_respuestas (
    tenant_id, expediente_id, person_id,
    capital_participacion, porcentaje_capital, es_consejero,
    sentido, texto_respuesta, fecha_respuesta,
    firma_qes_ref, firma_qes_timestamp, ocsp_status,
    notificacion_certificada_ref
  ) VALUES (
    p_tenant_id, v_expediente_id, p_person_id,
    v_capital_participacion, v_porcentaje_capital, v_es_consejero,
    v_sentido, p_texto_respuesta, now(),
    p_firma_qes_ref,
    CASE WHEN p_firma_qes_ref IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN p_firma_qes_ref IS NOT NULL THEN 'GOOD' ELSE NULL END,
    p_notificacion_certificada_ref
  )
  ON CONFLICT (expediente_id, person_id) DO NOTHING
  RETURNING id INTO v_response_id;

  IF v_response_id IS NULL THEN
    SELECT id INTO v_response_id
      FROM no_session_respuestas
     WHERE expediente_id = v_expediente_id
       AND person_id = p_person_id;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE sentido = 'CONSENTIMIENTO')::integer,
    COUNT(*) FILTER (WHERE sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO'))::integer,
    COUNT(*) FILTER (WHERE sentido = 'SILENCIO')::integer
    INTO v_votes_for, v_votes_against, v_abstentions
    FROM no_session_respuestas
   WHERE expediente_id = v_expediente_id;

  v_total_required := COALESCE(NULLIF(v_resolution.total_members, 0), 0);
  IF v_total_required = 0 THEN
    SELECT COUNT(*)::integer INTO v_total_required
      FROM condiciones_persona
     WHERE tenant_id = p_tenant_id
       AND entity_id = v_body.entity_id
       AND estado = 'VIGENTE'
       AND (
         body_id = v_body.id
         OR (v_tipo_proceso <> 'CIRCULACION_CONSEJO' AND tipo_condicion = 'SOCIO')
       );
  END IF;
  IF v_total_required = 0 THEN
    v_total_required := v_votes_for + v_votes_against + v_abstentions;
  END IF;

  v_next_status := v_resolution.status;
  IF v_resolution.requires_unanimity IS TRUE AND v_votes_against > 0 THEN
    v_next_status := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE AND v_total_required > 0 AND v_votes_for >= v_total_required THEN
    v_next_status := 'APROBADO';
  ELSIF v_resolution.requires_unanimity IS NOT TRUE
        AND v_total_required > 0
        AND (v_votes_for + v_votes_against + v_abstentions) >= v_total_required THEN
    v_next_status := CASE WHEN v_votes_for > v_votes_against THEN 'APROBADO' ELSE 'RECHAZADO' END;
  ELSE
    v_next_status := 'VOTING_OPEN';
  END IF;

  UPDATE no_session_resolutions
     SET votes_for = v_votes_for,
         votes_against = v_votes_against,
         abstentions = v_abstentions,
         total_members = COALESCE(NULLIF(total_members, 0), v_total_required),
         status = v_next_status,
         closed_at = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO') THEN COALESCE(closed_at, now())
           ELSE closed_at
         END
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id;

  UPDATE no_session_expedientes
     SET estado = CASE
           WHEN v_next_status = 'APROBADO' THEN 'CERRADO_OK'
           WHEN v_next_status = 'RECHAZADO' THEN 'CERRADO_FAIL'
           ELSE 'ABIERTO'
         END,
         fecha_cierre = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO') THEN COALESCE(fecha_cierre, now())
           ELSE fecha_cierre
         END,
         motivo_cierre = CASE
           WHEN v_next_status = 'APROBADO' THEN 'condition_met'
           WHEN v_next_status = 'RECHAZADO' THEN 'condition_failed'
           ELSE motivo_cierre
         END
   WHERE id = v_expediente_id;

  RETURN jsonb_build_object(
    'resolution_id', p_resolution_id,
    'expediente_id', v_expediente_id,
    'response_id', v_response_id,
    'idempotent', false,
    'status', v_next_status,
    'votes_for', v_votes_for,
    'votes_against', v_votes_against,
    'abstentions', v_abstentions,
    'total_members', v_total_required
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_no_session_cast_response(uuid, uuid, uuid, text, text, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_no_session_close_and_materialize_agreement
-- Closes a no-session resolution and creates exactly one agreement for it.
-- Repeated calls return the same agreement.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_no_session_close_and_materialize_agreement(
  p_tenant_id uuid,
  p_resolution_id uuid,
  p_resultado text DEFAULT NULL,
  p_selected_template_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_resolution no_session_resolutions%ROWTYPE;
  v_body record;
  v_expediente no_session_expedientes%ROWTYPE;
  v_existing_agreement_id uuid;
  v_agreement_id uuid;
  v_resultado text;
  v_votes_for integer;
  v_votes_against integer;
  v_abstentions integer;
  v_total_required integer;
  v_decision_text text;
  v_template_id uuid;
  v_tipo_proceso text;
  v_condicion_adopcion text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);
  PERFORM fn_secretaria_assert_template_tenant(p_tenant_id, p_selected_template_id);
  IF p_resolution_id IS NULL THEN
    RAISE EXCEPTION 'p_resolution_id is required';
  END IF;

  SELECT *
    INTO v_resolution
    FROM no_session_resolutions
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_session_resolution not found: %', p_resolution_id;
  END IF;

  SELECT id INTO v_existing_agreement_id
    FROM agreements
   WHERE tenant_id = p_tenant_id
     AND no_session_resolution_id = p_resolution_id
   LIMIT 1;
  IF v_existing_agreement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'REUSED',
      'agreement_id', v_existing_agreement_id,
      'resolution_id', p_resolution_id,
      'idempotent', true
    );
  END IF;

  SELECT gb.id, gb.entity_id, gb.body_type, gb.name
    INTO v_body
    FROM governing_bodies gb
   WHERE gb.id = v_resolution.body_id
     AND gb.tenant_id = p_tenant_id;
  IF v_body.id IS NULL OR v_body.entity_id IS NULL THEN
    RAISE EXCEPTION 'governing body/entity not found for no_session_resolution %', p_resolution_id;
  END IF;

  v_tipo_proceso := CASE
    WHEN upper(coalesce(v_body.body_type, '')) LIKE '%CONSEJO%'
      OR upper(coalesce(v_body.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN')
      THEN 'CIRCULACION_CONSEJO'
    ELSE 'UNANIMIDAD_ESCRITA_SL'
  END;

  v_condicion_adopcion := CASE
    WHEN v_resolution.requires_unanimity IS TRUE AND v_tipo_proceso = 'CIRCULACION_CONSEJO'
      THEN 'UNANIMIDAD_CONSEJEROS'
    WHEN v_resolution.requires_unanimity IS TRUE
      THEN 'UNANIMIDAD_CAPITAL'
    ELSE 'MAYORIA_CONSEJEROS_ESCRITA'
  END;

  SELECT * INTO v_expediente
    FROM no_session_expedientes
   WHERE tenant_id = p_tenant_id
     AND no_session_resolution_id = p_resolution_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO no_session_expedientes (
      tenant_id, agreement_id, no_session_resolution_id, selected_template_id,
      entity_id, body_id, tipo_proceso, propuesta_texto, propuesta_fecha,
      ventana_inicio, ventana_fin, estado, condicion_adopcion, snapshot_hash
    ) VALUES (
      p_tenant_id, NULL, p_resolution_id,
      COALESCE(p_selected_template_id, v_resolution.selected_template_id),
      v_body.entity_id, v_body.id,
      v_tipo_proceso,
      v_resolution.proposal_text, current_date,
      COALESCE(v_resolution.opened_at, now()), v_resolution.voting_deadline,
      'ABIERTO',
      v_condicion_adopcion,
      encode(digest(
        coalesce(v_resolution.title, '') || '|' ||
        coalesce(v_resolution.proposal_text, '') || '|' ||
        p_resolution_id::text,
        'sha256'
      ), 'hex')
    )
    RETURNING * INTO v_expediente;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE sentido = 'CONSENTIMIENTO')::integer,
    COUNT(*) FILTER (WHERE sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO'))::integer,
    COUNT(*) FILTER (WHERE sentido = 'SILENCIO')::integer
    INTO v_votes_for, v_votes_against, v_abstentions
    FROM no_session_respuestas
   WHERE expediente_id = v_expediente.id;

  v_total_required := COALESCE(NULLIF(v_resolution.total_members, 0), v_votes_for + v_votes_against + v_abstentions);
  v_resultado := upper(trim(COALESCE(p_resultado, v_resolution.status)));

  IF v_resultado NOT IN ('APROBADO', 'RECHAZADO') THEN
    IF v_resolution.requires_unanimity IS TRUE AND v_votes_against > 0 THEN
      v_resultado := 'RECHAZADO';
    ELSIF v_resolution.requires_unanimity IS TRUE AND v_total_required > 0 AND v_votes_for >= v_total_required THEN
      v_resultado := 'APROBADO';
    ELSIF v_resolution.requires_unanimity IS NOT TRUE
          AND v_total_required > 0
          AND (v_votes_for + v_votes_against + v_abstentions) >= v_total_required THEN
      v_resultado := CASE WHEN v_votes_for > v_votes_against THEN 'APROBADO' ELSE 'RECHAZADO' END;
    ELSE
      RAISE EXCEPTION 'no_session_resolution % is not closed or decided', p_resolution_id;
    END IF;
  END IF;

  UPDATE no_session_resolutions
     SET status = v_resultado,
         closed_at = COALESCE(closed_at, now()),
         selected_template_id = COALESCE(p_selected_template_id, selected_template_id)
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id;

  UPDATE no_session_expedientes
     SET estado = CASE WHEN v_resultado = 'APROBADO' THEN 'CERRADO_OK' ELSE 'CERRADO_FAIL' END,
         fecha_cierre = COALESCE(fecha_cierre, now()),
         motivo_cierre = CASE WHEN v_resultado = 'APROBADO' THEN 'materialized' ELSE 'rejected' END,
         selected_template_id = COALESCE(p_selected_template_id, selected_template_id)
   WHERE id = v_expediente.id;

  IF v_resultado = 'RECHAZADO' THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'agreement_id', NULL,
      'resolution_id', p_resolution_id,
      'idempotent', false
    );
  END IF;

  v_decision_text := COALESCE(NULLIF(trim(v_resolution.proposal_text), ''), v_resolution.title, 'Acuerdo sin sesion');
  v_template_id := COALESCE(p_selected_template_id, v_resolution.selected_template_id, v_expediente.selected_template_id);
  PERFORM fn_secretaria_assert_template_tenant(p_tenant_id, v_template_id);

  INSERT INTO agreements (
    tenant_id, entity_id, body_id,
    agreement_kind, matter_class, adoption_mode, status,
    no_session_resolution_id, proposal_text, decision_text,
    decision_date, effective_date, execution_mode, compliance_snapshot
  ) VALUES (
    p_tenant_id, v_body.entity_id, v_body.id,
    COALESCE(NULLIF(v_resolution.agreement_kind, ''), 'ACUERDO_SIN_SESION'),
    COALESCE(NULLIF(v_resolution.matter_class, ''), COALESCE(NULLIF(v_resolution.agreement_kind, ''), 'ACUERDO_SIN_SESION')),
    'NO_SESSION', 'ADOPTED',
    p_resolution_id, v_decision_text, v_decision_text,
    current_date, current_date,
    jsonb_build_object(
      'mode', 'NO_SESSION',
      'source', 'no_session_resolutions',
      'source_id', p_resolution_id,
      'no_session_resolution_id', p_resolution_id,
      'selected_template_id', v_template_id,
      'agreement_360', jsonb_build_object(
        'version', 'agreement-360.v1',
        'origin', 'NO_SESSION',
        'source', 'no_session_resolutions',
        'no_session_resolution_id', p_resolution_id,
        'selected_template_id', v_template_id,
        'materialized_at', now(),
        'materialized', true
      )
    ),
    jsonb_build_object(
      'schema_version', 'no-session-idempotency.v1',
      'resolution_id', p_resolution_id,
      'expediente_id', v_expediente.id,
      'votes_for', v_votes_for,
      'votes_against', v_votes_against,
      'abstentions', v_abstentions,
      'total_members', v_total_required,
      'resultado', v_resultado
    )
  )
  RETURNING id INTO v_agreement_id;

  UPDATE no_session_expedientes
     SET agreement_id = v_agreement_id,
         estado = 'PROCLAMADO'
   WHERE id = v_expediente.id;

  RETURN jsonb_build_object(
    'status', 'CREATED',
    'agreement_id', v_agreement_id,
    'resolution_id', p_resolution_id,
    'expediente_id', v_expediente.id,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_no_session_close_and_materialize_agreement(uuid, uuid, text, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_generar_certificacion_acuerdo_sin_sesion
-- Certification source is agreements.id, not minutes.id. This preserves
-- the RRM gate for meeting minutes while allowing written/no-session
-- agreements to certify once adopted and materialized.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_generar_certificacion_acuerdo_sin_sesion(
  p_agreement_id uuid,
  p_tipo text DEFAULT 'NO_SESSION',
  p_certificante_role text DEFAULT 'SECRETARIO',
  p_visto_bueno_persona_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cert_id uuid;
  v_agreement agreements%ROWTYPE;
  v_entity entities%ROWTYPE;
  v_requires_vb boolean;
  v_auth_ev_id uuid;
  v_gate_hash text;
BEGIN
  IF p_agreement_id IS NULL THEN
    RAISE EXCEPTION 'p_agreement_id is required';
  END IF;

  SELECT *
    INTO v_agreement
    FROM agreements
   WHERE id = p_agreement_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement not found: %', p_agreement_id;
  END IF;
  PERFORM fn_secretaria_assert_tenant_access(v_agreement.tenant_id);
  PERFORM fn_secretaria_assert_capability(v_agreement.tenant_id, 'CERTIFICATION');

  IF v_agreement.adoption_mode <> 'NO_SESSION' THEN
    RAISE EXCEPTION 'agreement % is not a NO_SESSION agreement', p_agreement_id;
  END IF;
  IF v_agreement.status NOT IN ('ADOPTED', 'APROBADO', 'CERTIFIED', 'PROMOTED') THEN
    RAISE EXCEPTION 'agreement % not adopted, status=%', p_agreement_id, v_agreement.status;
  END IF;
  IF COALESCE(NULLIF(trim(v_agreement.decision_text), ''), NULLIF(trim(v_agreement.proposal_text), '')) IS NULL THEN
    RAISE EXCEPTION 'agreement % has no certifiable decision text', p_agreement_id;
  END IF;

  IF v_agreement.no_session_resolution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM no_session_resolutions nsr
     WHERE nsr.id = v_agreement.no_session_resolution_id
       AND nsr.tenant_id = v_agreement.tenant_id
       AND nsr.status = 'APROBADO'
  ) THEN
    RAISE EXCEPTION 'no-session resolution for agreement % is not approved', p_agreement_id;
  END IF;

  SELECT * INTO v_entity FROM entities WHERE id = v_agreement.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity not found for agreement %', p_agreement_id;
  END IF;

  v_requires_vb := (v_entity.legal_form = 'SA' AND p_certificante_role <> 'ADMIN_UNICO');
  IF v_requires_vb AND p_visto_bueno_persona_id IS NULL THEN
    RAISE EXCEPTION 'Visto bueno del presidente requerido para SA';
  END IF;

  SELECT id INTO v_auth_ev_id
    FROM authority_evidence
   WHERE entity_id = v_agreement.entity_id
     AND cargo = p_certificante_role
     AND estado = 'VIGENTE'
     AND (
       fn_secretaria_is_service_role()
       OR fn_secretaria_current_role_code() = 'ADMIN_TENANT'
       OR person_id = fn_secretaria_current_person_id()
     )
   LIMIT 1;
  IF v_auth_ev_id IS NULL THEN
    RAISE EXCEPTION 'No hay autoridad vigente para cargo % en entity %',
      p_certificante_role, v_agreement.entity_id;
  END IF;

  v_gate_hash := encode(
    digest(
      coalesce(v_agreement.gate_hash, 'NO_GATE_HASH') ||
      p_agreement_id::text ||
      coalesce(v_agreement.no_session_resolution_id::text, 'NO_SESSION_SOURCE'),
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
    v_agreement.tenant_id, p_agreement_id, ARRAY[p_agreement_id::text], NULL,
    COALESCE(v_agreement.decision_text, v_agreement.proposal_text), NULL,
    p_tipo, p_certificante_role,
    p_visto_bueno_persona_id,
    CASE WHEN p_visto_bueno_persona_id IS NOT NULL THEN now() ELSE NULL END,
    v_gate_hash, v_auth_ev_id,
    true, 'PENDING'
  )
  RETURNING id INTO v_cert_id;

  UPDATE agreements
     SET status = CASE WHEN status = 'ADOPTED' THEN 'CERTIFIED' ELSE status END,
         updated_at = now()
   WHERE id = p_agreement_id;

  RETURN v_cert_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generar_certificacion_acuerdo_sin_sesion(uuid, text, text, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_registrar_transmision_capital
-- Atomic update of capital_holdings plus append-only movement entries.
-- No Registro Mercantil submission is implied; this only prepares the
-- demo-operational register/cap table state.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_registrar_transmision_capital(
  p_tenant_id uuid,
  p_source_holding_id uuid,
  p_destination_person_id uuid,
  p_titles_to_transfer numeric,
  p_effective_date date,
  p_agreement_id uuid DEFAULT NULL,
  p_support_doc_ref text DEFAULT NULL,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source capital_holdings%ROWTYPE;
  v_destination capital_holdings%ROWTYPE;
  v_votes_per_title numeric := 1;
  v_transfer_pct numeric;
  v_remnant_titles numeric;
  v_remnant_pct numeric;
  v_destination_titles numeric;
  v_destination_pct numeric;
  v_remnant_holding_id uuid;
  v_destination_holding_id uuid;
  v_movement_out_id uuid;
  v_movement_in_id uuid;
  v_voting_weight numeric;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);
  IF p_source_holding_id IS NULL THEN
    RAISE EXCEPTION 'p_source_holding_id is required';
  END IF;
  IF p_destination_person_id IS NULL THEN
    RAISE EXCEPTION 'p_destination_person_id is required';
  END IF;
  PERFORM fn_secretaria_assert_person_tenant(p_tenant_id, p_destination_person_id);
  IF p_titles_to_transfer IS NULL OR p_titles_to_transfer <= 0 THEN
    RAISE EXCEPTION 'p_titles_to_transfer must be positive';
  END IF;
  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'p_effective_date is required';
  END IF;

  SELECT *
    INTO v_source
    FROM capital_holdings
   WHERE id = p_source_holding_id
     AND tenant_id = p_tenant_id
     AND effective_to IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'current source holding not found: %', p_source_holding_id;
  END IF;

  IF v_source.is_treasury IS TRUE THEN
    RAISE EXCEPTION 'source holding is treasury stock and cannot be transmitted';
  END IF;
  IF v_source.holder_person_id = p_destination_person_id THEN
    RAISE EXCEPTION 'destination holder must differ from source holder';
  END IF;
  IF p_titles_to_transfer > v_source.numero_titulos THEN
    RAISE EXCEPTION 'titles to transfer exceed source holding';
  END IF;

  IF p_agreement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM agreements
     WHERE id = p_agreement_id
       AND tenant_id = p_tenant_id
       AND entity_id = v_source.entity_id
  ) THEN
    RAISE EXCEPTION 'agreement % not found for entity %', p_agreement_id, v_source.entity_id;
  END IF;

  SELECT *
    INTO v_destination
    FROM capital_holdings
   WHERE tenant_id = p_tenant_id
     AND entity_id = v_source.entity_id
     AND holder_person_id = p_destination_person_id
     AND COALESCE(share_class_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = COALESCE(v_source.share_class_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND effective_to IS NULL
   FOR UPDATE;

  SELECT COALESCE(sc.votes_per_title, 1)
    INTO v_votes_per_title
    FROM share_classes sc
   WHERE sc.id = v_source.share_class_id;
  v_votes_per_title := COALESCE(v_votes_per_title, 1);

  v_transfer_pct := CASE
    WHEN v_source.numero_titulos > 0
      THEN round((COALESCE(v_source.porcentaje_capital, 0) * p_titles_to_transfer) / v_source.numero_titulos, 6)
    ELSE 0
  END;
  v_remnant_titles := round(v_source.numero_titulos - p_titles_to_transfer, 6);
  v_remnant_pct := round(COALESCE(v_source.porcentaje_capital, 0) - v_transfer_pct, 6);
  v_destination_titles := round(COALESCE(v_destination.numero_titulos, 0) + p_titles_to_transfer, 6);
  v_destination_pct := round(COALESCE(v_destination.porcentaje_capital, 0) + v_transfer_pct, 6);
  v_voting_weight := CASE WHEN v_source.voting_rights IS TRUE THEN p_titles_to_transfer * v_votes_per_title ELSE 0 END;

  UPDATE capital_holdings
     SET effective_to = p_effective_date
   WHERE id = v_source.id;

  IF v_destination.id IS NOT NULL THEN
    UPDATE capital_holdings
       SET effective_to = p_effective_date
     WHERE id = v_destination.id;
  END IF;

  IF v_remnant_titles > 0 THEN
    INSERT INTO capital_holdings (
      tenant_id, entity_id, holder_person_id, share_class_id,
      numero_titulos, porcentaje_capital, voting_rights, is_treasury,
      effective_from, effective_to, metadata
    ) VALUES (
      p_tenant_id, v_source.entity_id, v_source.holder_person_id, v_source.share_class_id,
      v_remnant_titles, v_remnant_pct, v_source.voting_rights, false,
      p_effective_date, NULL,
      COALESCE(v_source.metadata, '{}'::jsonb) ||
      jsonb_build_object('source_holding_id', v_source.id, 'transmission_role', 'remnant')
    )
    RETURNING id INTO v_remnant_holding_id;
  END IF;

  INSERT INTO capital_holdings (
    tenant_id, entity_id, holder_person_id, share_class_id,
    numero_titulos, porcentaje_capital, voting_rights, is_treasury,
    effective_from, effective_to, metadata
  ) VALUES (
    p_tenant_id, v_source.entity_id, p_destination_person_id, v_source.share_class_id,
    v_destination_titles, v_destination_pct, v_source.voting_rights, false,
    p_effective_date, NULL,
    COALESCE(v_destination.metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'source_holding_id', v_source.id,
      'previous_destination_holding_id', v_destination.id,
      'transmission_role', 'destination',
      'support_doc_ref', p_support_doc_ref
    )
  )
  RETURNING id INTO v_destination_holding_id;

  v_movement_out_id := fn_registrar_movimiento_capital(
    p_tenant_id,
    v_source.entity_id,
    p_agreement_id,
    v_source.holder_person_id,
    v_source.share_class_id,
    -p_titles_to_transfer,
    -v_voting_weight,
    -v_voting_weight,
    'TRANSMISION',
    p_effective_date,
    COALESCE(p_notas, 'Transmision de participaciones/acciones - salida') ||
      COALESCE(' soporte=' || p_support_doc_ref, '')
  );

  v_movement_in_id := fn_registrar_movimiento_capital(
    p_tenant_id,
    v_source.entity_id,
    p_agreement_id,
    p_destination_person_id,
    v_source.share_class_id,
    p_titles_to_transfer,
    v_voting_weight,
    v_voting_weight,
    'TRANSMISION',
    p_effective_date,
    COALESCE(p_notas, 'Transmision de participaciones/acciones - entrada') ||
      COALESCE(' soporte=' || p_support_doc_ref, '')
  );

  RETURN jsonb_build_object(
    'status', 'OK',
    'source_holding_closed_id', v_source.id,
    'remnant_holding_id', v_remnant_holding_id,
    'destination_holding_id', v_destination_holding_id,
    'movement_out_id', v_movement_out_id,
    'movement_in_id', v_movement_in_id,
    'transferred_titles', p_titles_to_transfer,
    'transferred_percentage', v_transfer_pct,
    'effective_date', p_effective_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_registrar_transmision_capital(uuid, uuid, uuid, numeric, date, uuid, text, text)
  TO authenticated, service_role;
