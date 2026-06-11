-- ITEM-003 (follow-up) + ITEM-023 [P1] — fail-closed tenant assert (2026-06-11)
-- ============================================================================
-- Las dos migraciones anteriores de hoy (20260611180327 fn_aprobar_acta y
-- 20260611181010 fn_create_communication_atomic) usaban el patrón v1
-- `v_caller_tenant IS NOT NULL AND v_caller_tenant <> ...`, que FALLA ABIERTO
-- cuando fn_current_tenant_id() devuelve NULL — exactamente el bug que la saga
-- del evidence bundle ya corrigió en tres versiones (ver
-- 20260606175406_harden_evidence_bundle_tenant_three_valued_fix.sql y el test
-- src/test/schema/evidence-bundle-rpc-hardening.test.ts).
--
-- Esta migración alinea ambas RPC con el contrato fail-closed v3:
--   * Solo un service_role explícito (fn_secretaria_is_service_role() IS TRUE)
--     omite la aserción de tenant.
--   * Cualquier otro contexto DEBE tener tenant resuelto
--     (fn_assert_current_tenant_id lanza si NULL) y coincidir con el tenant
--     objetivo (42501 si no).
-- Forward-only, idempotente. Mismas firmas.

-- ----------------------------------------------------------------------------
-- 1) fn_aprobar_acta — v2 fail-closed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_aprobar_acta(
  p_minute_id uuid,
  p_president_persona_id uuid DEFAULT NULL,
  p_secretary_persona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_signed_at timestamptz;
BEGIN
  SELECT * INTO v_minute FROM public.minutes WHERE id = p_minute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  -- FAIL-CLOSED: solo service_role explícito omite la aserción de tenant.
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'acta tenant mismatch: el caller del tenant % no puede aprobar actas del tenant %',
        public.fn_current_tenant_id(), v_minute.tenant_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Idempotente: un acta ya aprobada/firmada no se re-firma ni cambia de fecha.
  IF v_minute.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'minute_id', v_minute.id,
      'signed_at', v_minute.signed_at,
      'already_signed', true
    );
  END IF;

  IF COALESCE(v_minute.content, '') = '' THEN
    RAISE EXCEPTION 'el acta % no tiene contenido: genera el documento del acta antes de aprobarla (art. 202 LSC)', p_minute_id;
  END IF;

  v_signed_at := now();

  UPDATE public.minutes
  SET signed_at = v_signed_at,
      is_locked = true,
      signed_by_president_id = COALESCE(p_president_persona_id, signed_by_president_id),
      signed_by_secretary_id = COALESCE(p_secretary_persona_id, signed_by_secretary_id)
  WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'signed_at', v_signed_at,
    'already_signed', false
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2) fn_create_communication_atomic — v2 fail-closed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_communication_atomic(p_comm jsonb, p_attachments jsonb, p_recipients jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comm_id uuid;
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role_ok boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Tenant efectivo + aserción FAIL-CLOSED (ITEM-023).
  v_tenant_id := COALESCE(
    (p_comm->>'tenant_id')::uuid,
    fn_current_tenant_id()
  );
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_tenant_id THEN
      RAISE EXCEPTION 'communication tenant mismatch: el caller del tenant % no puede crear comunicaciones para el tenant %',
        public.fn_current_tenant_id(), v_tenant_id
        USING ERRCODE = '42501';
    END IF;

    -- Authorization: caller must have SECRETARIO or ADMIN_TENANT role EN el tenant efectivo
    SELECT EXISTS (
      SELECT 1 FROM rbac_user_roles rur
      JOIN rbac_roles r ON r.id = rur.role_id
      WHERE rur.user_id = v_user_id
        AND rur.tenant_id = v_tenant_id
        AND r.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
        AND COALESCE(rur.is_active, true) = true
    ) INTO v_role_ok;
    IF NOT v_role_ok THEN
      RAISE EXCEPTION 'Insufficient role: SECRETARIO or ADMIN_TENANT required';
    END IF;
  END IF;

  -- INSERT communications (BEFORE INSERT trigger will validate plazo synchronously)
  INSERT INTO communications (
    tenant_id, entity_id, body_id, organo_tipo, agreement_id, meeting_id,
    template_id, tipo_comunicacion, tipo_respuesta_esperada,
    nivel_certificacion_minimo, asunto, cuerpo_render, cuerpo_hash_sha512,
    estado, fecha_programada, comunicacion_libre, metadata, created_by
  ) VALUES (
    v_tenant_id,
    (p_comm->>'entity_id')::uuid,
    NULLIF(p_comm->>'body_id','')::uuid,
    p_comm->>'organo_tipo',
    NULLIF(p_comm->>'agreement_id','')::uuid,
    NULLIF(p_comm->>'meeting_id','')::uuid,
    NULLIF(p_comm->>'template_id','')::uuid,
    p_comm->>'tipo_comunicacion',
    p_comm->>'tipo_respuesta_esperada',
    p_comm->>'nivel_certificacion_minimo',
    p_comm->>'asunto',
    p_comm->>'cuerpo_render',
    p_comm->>'cuerpo_hash_sha512',
    COALESCE(p_comm->>'estado', 'BORRADOR'),
    NULLIF(p_comm->>'fecha_programada','')::timestamptz,
    COALESCE((p_comm->>'comunicacion_libre')::boolean, false),
    COALESCE(p_comm->'metadata', '{}'::jsonb),
    v_user_id
  )
  RETURNING id INTO v_comm_id;

  -- INSERT attachments (if any) — JSON array of objects
  IF p_attachments IS NOT NULL AND jsonb_typeof(p_attachments) = 'array' AND jsonb_array_length(p_attachments) > 0 THEN
    INSERT INTO communication_attachments (
      communication_id, tipo, label, evidence_bundle_id, storage_uri,
      hash_sha512, size_bytes, mime_type, orden, modo_entrega, signed_url_expiry_hours
    )
    SELECT
      v_comm_id,
      a->>'tipo',
      a->>'label',
      NULLIF(a->>'evidence_bundle_id','')::uuid,
      a->>'storage_uri',
      a->>'hash_sha512',
      NULLIF(a->>'size_bytes','')::bigint,
      a->>'mime_type',
      COALESCE((a->>'orden')::int, 0),
      COALESCE(a->>'modo_entrega', 'ADJUNTO'),
      COALESCE((a->>'signed_url_expiry_hours')::int, 168)
    FROM jsonb_array_elements(p_attachments) AS a;
  END IF;

  -- INSERT recipients — JSON array
  IF p_recipients IS NOT NULL AND jsonb_typeof(p_recipients) = 'array' AND jsonb_array_length(p_recipients) > 0 THEN
    INSERT INTO communication_recipients (
      communication_id, person_id, cargo_en_organo,
      canal_original, canal_primario, canal_fallback,
      destino_primario, destino_fallback
    )
    SELECT
      v_comm_id,
      (r->>'person_id')::uuid,
      r->>'cargo_en_organo',
      r->>'canal_primario',  -- captured as canal_original via tg_recipient_check_nivel_t
      r->>'canal_primario',
      NULLIF(r->>'canal_fallback','')::text,
      r->>'destino_primario',
      NULLIF(r->>'destino_fallback','')::text
    FROM jsonb_array_elements(p_recipients) AS r;
  ELSE
    RAISE EXCEPTION 'At least one recipient is required';
  END IF;

  RETURN v_comm_id;
END $function$;
