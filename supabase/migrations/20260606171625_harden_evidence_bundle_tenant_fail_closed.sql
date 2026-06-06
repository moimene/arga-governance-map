-- Hardening v2 — FAIL-CLOSED (revisión adversarial Codex, follow-up del [critical])
-- ============================================================================
-- La v1 (20260606165443) solo lanzaba cuando fn_current_tenant_id() devolvía un tenant
-- NO nulo distinto de p_tenant_id. Pero fn_current_tenant_id() devuelve NULL no solo para
-- service_role, sino TAMBIÉN para un caller `authenticated` cuyo tenant no resuelve (sin
-- claim JWT ni fila en user_profiles). Como la RPC es SECURITY DEFINER (salta RLS) y está
-- concedida a `authenticated`, ese caso NULL FALLABA ABIERTO: un autenticado sin tenant
-- resuelto podía forjar evidencia SEALED para cualquier p_tenant_id.
--
-- Corrección: FAIL-CLOSED. El carve-out de "pasar un p_tenant_id arbitrario" se restringe
-- EXCLUSIVAMENTE a service_role (detectado por el rol firmado del JWT vía
-- fn_secretaria_is_service_role(), no por NULL). Cualquier otro caller (authenticated o sin
-- rol) DEBE tener un tenant resuelto que COINCIDA con p_tenant_id; fn_assert_current_tenant_id()
-- lanza (insufficient_privilege) si el tenant no resuelve, de modo que un contexto sin tenant
-- NO puede crear evidencia. Resto del cuerpo idéntico (firma, status, provenance, insert).

CREATE OR REPLACE FUNCTION public.fn_create_governance_evidence_bundle(
  p_tenant_id uuid,
  p_source_module text,
  p_source_object_type text,
  p_source_object_id text,
  p_reference_code text,
  p_manifest jsonb,
  p_document_url text DEFAULT NULL::text,
  p_legal_hold boolean DEFAULT false,
  p_status text DEFAULT 'SEALED'::text,
  p_signed_by text DEFAULT 'EAD Trust Digital Trust API'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_bundle_id uuid;
  v_manifest jsonb;
  v_manifest_hash text;
  v_hash_sha512 text;
BEGIN
  IF p_status NOT IN ('OPEN', 'SEALED', 'VERIFIED') THEN
    RAISE EXCEPTION 'Unsupported evidence bundle status: %', p_status;
  END IF;

  -- Integridad de provenance.
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF COALESCE(p_source_object_id, '') = '' THEN
    RAISE EXCEPTION 'p_source_object_id is required for evidence provenance';
  END IF;

  -- Hardening v2 FAIL-CLOSED: solo service_role pasa un p_tenant_id arbitrario.
  -- Para cualquier otro caller, el tenant DEBE resolver (si no, fn_assert_current_tenant_id
  -- lanza) y COINCIDIR con p_tenant_id.
  IF NOT public.fn_secretaria_is_service_role() THEN
    IF public.fn_assert_current_tenant_id() <> p_tenant_id THEN
      RAISE EXCEPTION 'evidence bundle tenant mismatch: caller tenant % no puede crear evidencia para %',
        public.fn_current_tenant_id(), p_tenant_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_manifest := jsonb_build_object(
    'sourceModule', p_source_module,
    'sourceObjectType', p_source_object_type,
    'sourceObjectId', p_source_object_id,
    'referenceCode', p_reference_code,
    'payload', COALESCE(p_manifest, '{}'::jsonb),
    'createdAt', now(),
    'qtsp', jsonb_build_object('provider', 'EAD Trust')
  );

  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  v_hash_sha512 := encode(digest(v_manifest::text, 'sha512'), 'hex');

  INSERT INTO evidence_bundles (
    tenant_id,
    agreement_id,
    source_module,
    source_object_type,
    source_object_id,
    reference_code,
    manifest,
    manifest_hash,
    hash_sha512,
    status,
    document_url,
    signed_by,
    signature_date,
    chain_of_custody,
    legal_hold
  ) VALUES (
    p_tenant_id,
    NULL,
    p_source_module,
    p_source_object_type,
    p_source_object_id,
    p_reference_code,
    v_manifest,
    v_manifest_hash,
    v_hash_sha512,
    p_status,
    p_document_url,
    p_signed_by,
    CASE WHEN p_status IN ('SEALED', 'VERIFIED') THEN now() ELSE NULL END,
    jsonb_build_array(jsonb_build_object(
      'event', 'GOVERNANCE_EVIDENCE_BUNDLE_CREATED',
      'ts', now(),
      'actor', p_signed_by,
      'sourceModule', p_source_module,
      'manifestHash', v_manifest_hash
    )),
    p_legal_hold
  )
  RETURNING id INTO v_bundle_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', v_hash_sha512,
    'status', p_status
  );
END;
$function$;
