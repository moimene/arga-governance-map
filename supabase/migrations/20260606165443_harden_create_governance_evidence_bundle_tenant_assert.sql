-- Hardening de seguridad (revisión adversarial Codex, [critical] 2026-06-06)
-- ============================================================================
-- La RPC SECURITY DEFINER `fn_create_governance_evidence_bundle` (introducida en
-- 000045_grc_core_backbone) aceptaba `p_tenant_id` del cliente y, al ser SECURITY
-- DEFINER, salta RLS: un usuario autenticado podía FORJAR evidencia SEALED para otro
-- tenant cambiando el payload de la RPC. Esta migración la reemplaza añadiendo:
--   1. Aserción de tenant: un caller con tenant resuelto en el JWT (fn_current_tenant_id)
--      solo puede crear evidencia para SU tenant. Contextos privilegiados sin tenant en
--      el JWT (service_role / jobs / seeds) conservan el comportamiento previo (NULL pasa),
--      por lo que no se rompen pipelines server-side.
--   2. Integridad de provenance: `p_tenant_id` y `p_source_object_id` obligatorios.
-- Forward-only, idempotente (CREATE OR REPLACE). No cambia la firma ni el resto del cuerpo.
--
-- Deuda documentada (fuera de esta migración, requiere decisión de producto):
--   - Verificación de ownership polimórfico del objeto origen (source_module/type/id)
--     contra su tabla real: no se implementa aquí por el riesgo de romper flujos legítimos
--     con el mapeo polimórfico; la aserción de tenant cierra el vector cross-tenant crítico.
--   - "Rechazar estado final (SEALED/VERIFIED) sin verificación QTSP server-side": el
--     prototipo no tiene verificación QTSP en servidor (EAD Trust es stub cliente); el gate
--     sandbox vive en el cliente (evidence-sandbox-gate.ts). Pendiente de QTSP server-side.

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
  v_caller_tenant uuid;
BEGIN
  IF p_status NOT IN ('OPEN', 'SEALED', 'VERIFIED') THEN
    RAISE EXCEPTION 'Unsupported evidence bundle status: %', p_status;
  END IF;

  -- Hardening Codex [critical]: integridad + aislamiento de tenant.
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF COALESCE(p_source_object_id, '') = '' THEN
    RAISE EXCEPTION 'p_source_object_id is required for evidence provenance';
  END IF;

  v_caller_tenant := public.fn_current_tenant_id();
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
    RAISE EXCEPTION 'evidence bundle tenant mismatch: caller tenant % no puede crear evidencia para %',
      v_caller_tenant, p_tenant_id
      USING ERRCODE = '42501';
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
