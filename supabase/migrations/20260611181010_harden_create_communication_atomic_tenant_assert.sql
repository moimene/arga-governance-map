-- ITEM-023 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- `fn_create_communication_atomic` (20260518083234) es SECURITY DEFINER y
-- resolvía el tenant como COALESCE(p_comm->>'tenant_id', fn_current_tenant_id())
-- SIN asertar que el tenant suministrado coincida con el del caller: un usuario
-- autenticado con rol SECRETARIO/ADMIN_TENANT en su propio tenant podía FORJAR
-- comunicaciones (y adjuntos/destinatarios) en cualquier otro tenant pasando un
-- tenant_id ajeno en el payload. Además el check de rol consultaba
-- rbac_user_roles sin scoping de tenant.
--
-- Mismo vector y mismo patrón de cierre que 20260606165443 (evidence bundle):
--   1. Aserción de tenant: si el caller tiene tenant resuelto en el JWT
--      (fn_current_tenant_id), el tenant efectivo debe ser el suyo (42501 si no).
--      Contextos privilegiados sin tenant en el JWT (service_role / jobs)
--      conservan el comportamiento previo.
--   2. Check de rol scoped al tenant efectivo (rur.tenant_id = v_tenant_id).
-- Forward-only, idempotente (CREATE OR REPLACE). Misma firma.

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
  v_caller_tenant uuid;
  v_role_ok boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Tenant efectivo + aserción de aislamiento (hardening ITEM-023).
  v_tenant_id := COALESCE(
    (p_comm->>'tenant_id')::uuid,
    fn_current_tenant_id()
  );
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

  v_caller_tenant := fn_current_tenant_id();
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'communication tenant mismatch: el caller del tenant % no puede crear comunicaciones para el tenant %',
      v_caller_tenant, v_tenant_id
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
