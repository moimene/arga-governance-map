-- ============================================================
-- 20260829130000 — fn_aims_close_technical_file sin atribución a un QTSP
-- Carril C2 · AI Governance (G7/AIMS), tarea A3.
-- ============================================================
--
-- HECHO VERIFICADO (2026-08-29): el módulo AIMS **no llama nunca** a EAD Trust.
-- Cero imports de cliente QTSP, cero `fetch`, cero `functions.invoke` en
-- `src/pages/ai-governance`, `src/components/ai-governance`, `src/lib/aims` y
-- `src/hooks/useAims*`; y esta función es PL/pgSQL puro, sin llamada saliente.
--
-- Sin embargo estampaba `'provider':'EAD Trust'` de forma incondicional en el
-- manifiesto, tenía `p_signed_by DEFAULT 'EAD Trust Digital Trust API'` y, si no
-- se le pasaban tokens, **los fabricaba ella misma** (`'QSEAL-AIMS-' || …`).
-- El mecanismo es real —el SHA-512 del manifiesto se calcula de verdad y el
-- registro se escribe—, pero la atribución era falsa.
--
-- Esta migración elimina la ATRIBUCIÓN, no el mecanismo:
--   * el manifiesto describe la custodia realmente practicada (registro interno,
--     algoritmo de hash) y ya no nombra a ningún prestador;
--   * `p_signed_by` deja de tener default; NULL significa "sin firmante atribuido";
--   * los tokens dejan de fabricarse: si no se aportan, quedan NULL.
--
-- PREVENCIÓN, NO RECTIFICACIÓN: medido antes de aplicar, `aims_evidence_packs`
-- tiene 0 filas, `aims_system_versions` 0 en estado SEALED, `audit_log` 0 eventos
-- `AIMS_TECHNICAL_FILE_SEALED` y `evidence_bundles` 0 filas con `source_module='AIMS'`.
-- La función nunca se ha ejecutado, así que no hay registro inmutable que
-- rectificar y no se vulnera la regla de inmutabilidad del proyecto.
--
-- `status='SEALED'` en `evidence_bundles` se conserva: es el vocabulario interno
-- del CHECK (OPEN/SEALED/VERIFIED) para "bundle cerrado", no una afirmación de
-- sello cualificado. La superficie que sí afirmaba eso al usuario era la UI, y se
-- corrige en la misma tarea.

CREATE OR REPLACE FUNCTION public.fn_aims_close_technical_file(
  p_version_id uuid,
  p_qseal_token text DEFAULT NULL::text,
  p_tsq_token text DEFAULT NULL::text,
  p_signed_by text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_version aims_system_versions%ROWTYPE;
  v_system ai_systems%ROWTYPE;
  v_pending_count integer;
  v_manifest jsonb;
  v_manifest_hash text;
  v_hash_sha512 text;
  v_bundle_id uuid;
  v_pack_id uuid;
  v_audit_id uuid;
BEGIN
  SELECT * INTO v_version FROM aims_system_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS version not found: %', p_version_id;
  END IF;

  SELECT * INTO v_system FROM ai_systems WHERE id = v_version.system_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS system not found for version: %', p_version_id;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM aims_technical_file_sections
  WHERE tenant_id = v_version.tenant_id
    AND version_id = v_version.id
    AND status IN ('PENDING', 'Pendiente', 'No conforme');

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'technical file has % pending/non-conforming sections', v_pending_count;
  END IF;

  v_manifest := jsonb_build_object(
    'source', 'AIMS',
    'system', jsonb_build_object(
      'id', v_system.id,
      'referenceCode', v_system.aims_reference_code,
      'name', v_system.name,
      'riskLevel', v_system.risk_level,
      'status', v_system.status
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'label', v_version.version_label,
      'releaseStage', v_version.release_stage,
      'modelSnapshot', v_version.model_snapshot,
      'datasetSnapshot', v_version.dataset_snapshot,
      'controlSnapshot', v_version.control_snapshot
    ),
    'technicalFileSections', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'code', section_code,
          'title', title,
          'status', status,
          'evidenceRefs', evidence_refs,
          'reviewedAt', reviewed_at
        ) ORDER BY section_code
      ), '[]'::jsonb)
      FROM aims_technical_file_sections
      WHERE tenant_id = v_version.tenant_id AND version_id = v_version.id
    ),
    'requirementChecks', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'requirement', rc.requirement_code,
          'framework', rc.framework,
          'status', chk.status,
          'result', chk.result,
          'checkedAt', chk.checked_at,
          'evidenceRefs', chk.evidence_refs
        ) ORDER BY rc.framework, rc.requirement_code
      ), '[]'::jsonb)
      FROM aims_requirement_checks chk
      JOIN aims_requirement_catalog rc ON rc.id = chk.requirement_id
      WHERE chk.tenant_id = v_version.tenant_id AND chk.version_id = v_version.id
    ),
    'closedAt', now(),
    -- Custodia realmente practicada. Sin prestador: no se ha llamado a ninguno.
    'custody', jsonb_build_object(
      'kind', 'INTERNAL_REGISTRY',
      'hashAlgorithm', 'SHA-512',
      'externalProvider', NULL,
      'qualifiedPreservation', false,
      'qsealToken', p_qseal_token,
      'tsqToken', p_tsq_token,
      'signedBy', p_signed_by
    )
  );

  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  v_hash_sha512 := encode(digest(v_manifest::text, 'sha512'), 'hex');

  INSERT INTO evidence_bundles (
    tenant_id, agreement_id, source_module, source_object_type, source_object_id,
    reference_code, manifest, manifest_hash, hash_sha512, qseal_token, tsq_token,
    status, document_url, signed_by, signature_date, chain_of_custody, legal_hold
  ) VALUES (
    v_version.tenant_id, NULL, 'AIMS', 'aims_system_versions', v_version.id::text,
    COALESCE(v_system.aims_reference_code, v_system.id::text) || '-' || v_version.version_label,
    v_manifest, v_manifest_hash, v_hash_sha512,
    p_qseal_token,   -- sin fabricación: NULL si no se aporta
    p_tsq_token,
    'SEALED',
    'aims://technical-file/' || v_system.id::text || '/' || v_version.id::text,
    p_signed_by,
    CASE WHEN p_signed_by IS NULL THEN NULL ELSE now() END,
    jsonb_build_array(jsonb_build_object(
      'event', 'AIMS_TECHNICAL_FILE_CLOSED',
      'ts', now(),
      'actor', COALESCE(p_signed_by, 'sin firmante atribuido'),
      'manifestHash', v_manifest_hash
    )),
    false
  ) RETURNING id INTO v_bundle_id;

  INSERT INTO aims_evidence_packs (
    tenant_id, system_id, version_id, evidence_bundle_id, pack_type, title, status,
    manifest, manifest_hash, qseal_token, tsq_token, sealed_at, legal_hold, retention_until
  ) VALUES (
    v_version.tenant_id, v_version.system_id, v_version.id, v_bundle_id,
    'TECHNICAL_FILE',
    'Expediente tecnico AIMS ' || COALESCE(v_system.aims_reference_code, v_system.id::text) || ' ' || v_version.version_label,
    'SEALED', v_manifest, v_manifest_hash,
    p_qseal_token, p_tsq_token,
    now(), false, (now() + interval '10 years')::date
  ) RETURNING id INTO v_pack_id;

  UPDATE aims_system_versions
     SET technical_file_status = 'SEALED', updated_at = now()
   WHERE id = v_version.id;

  INSERT INTO audit_log (
    tenant_id, action, object_type, object_id, delta, legal_hold, retention_until
  ) VALUES (
    v_version.tenant_id, 'AIMS_TECHNICAL_FILE_SEALED', 'aims_system_versions', v_version.id,
    jsonb_build_object(
      'evidence_bundle_id', v_bundle_id,
      'aims_evidence_pack_id', v_pack_id,
      'manifest_hash', v_manifest_hash,
      'hash_sha512', v_hash_sha512,
      'source', 'AIMS'
    ),
    false, (now() + interval '10 years')::date
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'aims_evidence_pack_id', v_pack_id,
    'audit_log_id', v_audit_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', v_hash_sha512,
    'document_url', 'aims://technical-file/' || v_system.id::text || '/' || v_version.id::text,
    'status', 'SEALED'
  );
END;
$function$;
