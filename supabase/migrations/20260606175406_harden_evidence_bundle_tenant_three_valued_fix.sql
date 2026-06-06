-- Hardening v3 — corrige lógica de 3 valores (revisión adversarial Codex, follow-up [critical])
-- ============================================================================
-- La v2 (20260606171625) usaba `IF NOT public.fn_secretaria_is_service_role() THEN <assert>`.
-- Pero `fn_secretaria_is_service_role()` devuelve NULL (no FALSE) cuando no hay claim de rol
-- en el contexto (p.ej. conexión directa sin JWT). `NOT NULL` = NULL → el `IF` se evalúa
-- como falso → el bloque de aserción de tenant SE SALTA → fail-open en el path NULL.
-- Verificado en vivo: un caller sin rol resuelto creaba la fila.
--
-- Corrección: usar `IS NOT TRUE`, que trata NULL y FALSE por igual (fail-closed). Solo un
-- TRUE explícito (service_role detectado por el rol firmado del JWT) puede pasar un
-- p_tenant_id arbitrario; cualquier otro contexto (authenticated, anon o sin rol) DEBE tener
-- un tenant resuelto que coincida con p_tenant_id (fn_assert_current_tenant_id lanza si NULL).
-- Resto del cuerpo idéntico.

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

  -- Hardening v3 FAIL-CLOSED con lógica de 3 valores segura: solo service_role (TRUE
  -- explícito) pasa un p_tenant_id arbitrario. NULL/FALSE (authenticated, anon o sin rol)
  -- entran a la aserción de tenant, que lanza si el tenant no resuelve o no coincide.
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
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
