-- fn_create_communication_atomic: atomic creation of communication + attachments + recipients
-- Caller must be SECRETARIO or ADMIN_TENANT. tg_communications_validate_plazo enforces
-- plazo legal synchronously BEFORE INSERT.

CREATE OR REPLACE FUNCTION fn_create_communication_atomic(
  p_comm jsonb,
  p_attachments jsonb,
  p_recipients jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comm_id uuid;
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role_ok boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM rbac_user_roles rur
    JOIN rbac_roles r ON r.id = rur.role_id
    WHERE rur.user_id = v_user_id
      AND r.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
      AND COALESCE(rur.is_active, true) = true
  ) INTO v_role_ok;
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Insufficient role: SECRETARIO or ADMIN_TENANT required';
  END IF;

  v_tenant_id := COALESCE(
    (p_comm->>'tenant_id')::uuid,
    fn_current_tenant_id()
  );
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

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

  IF p_attachments IS NOT NULL AND jsonb_typeof(p_attachments) = 'array' AND jsonb_array_length(p_attachments) > 0 THEN
    INSERT INTO communication_attachments (
      communication_id, tipo, label, evidence_bundle_id, storage_uri,
      hash_sha512, size_bytes, mime_type, orden, modo_entrega, signed_url_expiry_hours
    )
    SELECT
      v_comm_id, a->>'tipo', a->>'label',
      NULLIF(a->>'evidence_bundle_id','')::uuid,
      a->>'storage_uri', a->>'hash_sha512',
      NULLIF(a->>'size_bytes','')::bigint,
      a->>'mime_type',
      COALESCE((a->>'orden')::int, 0),
      COALESCE(a->>'modo_entrega', 'ADJUNTO'),
      COALESCE((a->>'signed_url_expiry_hours')::int, 168)
    FROM jsonb_array_elements(p_attachments) AS a;
  END IF;

  IF p_recipients IS NOT NULL AND jsonb_typeof(p_recipients) = 'array' AND jsonb_array_length(p_recipients) > 0 THEN
    INSERT INTO communication_recipients (
      communication_id, person_id, cargo_en_organo,
      canal_original, canal_primario, canal_fallback,
      destino_primario, destino_fallback
    )
    SELECT
      v_comm_id, (r->>'person_id')::uuid, r->>'cargo_en_organo',
      r->>'canal_primario', r->>'canal_primario',
      NULLIF(r->>'canal_fallback','')::text,
      r->>'destino_primario',
      NULLIF(r->>'destino_fallback','')::text
    FROM jsonb_array_elements(p_recipients) AS r;
  ELSE
    RAISE EXCEPTION 'At least one recipient is required';
  END IF;

  RETURN v_comm_id;
END $$;

REVOKE EXECUTE ON FUNCTION fn_create_communication_atomic(jsonb, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION fn_create_communication_atomic(jsonb, jsonb, jsonb) TO authenticated, service_role;
