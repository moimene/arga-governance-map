-- supabase/migrations/20260421_000028_rpcs_firmar_emitir.sql
-- F8.2 — RPCs fn_firmar_certificacion + fn_emitir_certificacion.
--
-- Pipeline QTSP (post-F8.1):
--   fn_generar_acta   → crea minute con content_hash + snapshot_id.
--   fn_generar_cert   → crea certification con gate_hash (SHA-256).
--   fn_firmar_cert    → aplica QES + timestamp; calcula hash_certificacion.
--   fn_emitir_cert    → valida firma + registra audit_log + devuelve URI.
--
-- Diferencias respecto al plan original (ajustadas al schema real):
--   - certifications.tsq_token es bytea. Aceptamos p_tsq_token text
--     (base64 de la TSQ de EAD Trust) y lo almacenamos decodificado.
--     Para el hash usamos la forma text (determinista entre cliente y BD).
--   - audit_log usa object_type/object_id/delta (no entity/entity_id/payload).
--   - evidence_bundles no tiene storage_uri: devolvemos una URI
--     compuesta a partir del bundle_id + manifest_hash. Si no hay bundle
--     enlazado, retornamos un marcador 'evidence_bundle not yet linked'.
--   - pgcrypto ya habilitado por F8.1.

-- ============================================================
-- fn_firmar_certificacion(p_certification_id, p_qtsp_token, p_tsq_token)
-- Actualiza la certification con hash_certificacion + signature_status=SIGNED.
-- p_qtsp_token se acepta para compatibilidad con el cliente EAD Trust
-- (es el QSeal/QES token), aunque no se persiste aquí — las RPCs
-- posteriores o el pipeline de evidence bundles lo archivarán.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_firmar_certificacion(
  p_certification_id uuid,
  p_qtsp_token       text,
  p_tsq_token        text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_cert    RECORD;
  v_content text;
  v_hash    text;
BEGIN
  SELECT * INTO v_cert FROM certifications WHERE id = p_certification_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cert not found: %', p_certification_id;
  END IF;
  IF v_cert.gate_hash IS NULL THEN
    RAISE EXCEPTION 'cert % sin gate_hash — llamar fn_generar_certificacion antes de firmar',
      p_certification_id;
  END IF;
  IF p_tsq_token IS NULL OR length(p_tsq_token) = 0 THEN
    RAISE EXCEPTION 'p_tsq_token requerido (base64)';
  END IF;

  v_content := COALESCE(v_cert.content, '');

  -- Hash determinista: SHA-256(gate_hash || content || p_tsq_token base64).
  -- Todo en text para que el cliente (React) pueda reproducirlo con Web
  -- Crypto API y validar integridad lado-cliente.
  v_hash := encode(
    digest(v_cert.gate_hash || v_content || p_tsq_token, 'sha256'),
    'hex'
  );

  UPDATE certifications
     SET tsq_token          = decode(p_tsq_token, 'base64'),
         hash_certificacion = v_hash,
         signature_status   = 'SIGNED'
   WHERE id = p_certification_id;
END;
$$;

-- ============================================================
-- fn_emitir_certificacion(p_certification_id)
-- Valida que la certification esté SIGNED y registra una entrada en
-- audit_log con acción 'CERT_EMITIDA'. Devuelve un URI canónico al
-- evidence bundle si existe; caso contrario un marcador textual.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_emitir_certificacion(
  p_certification_id uuid
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_cert       RECORD;
  v_bundle_uri text;
BEGIN
  SELECT c.*,
         eb.id            AS bundle_id,
         eb.manifest_hash AS bundle_manifest_hash
    INTO v_cert
    FROM certifications c
    LEFT JOIN evidence_bundles eb ON eb.id = c.evidence_id
   WHERE c.id = p_certification_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cert not found: %', p_certification_id;
  END IF;
  IF v_cert.signature_status <> 'SIGNED' THEN
    RAISE EXCEPTION 'cert no firmada — signature_status=% (se esperaba SIGNED)',
      v_cert.signature_status;
  END IF;

  -- URI canónica. evidence_bundles no tiene columna storage_uri (solo
  -- manifest_hash + status); componemos una URI lógica que el front
  -- puede resolver contra el Storage real.
  v_bundle_uri := CASE
    WHEN v_cert.bundle_id IS NOT NULL THEN
      'evidence_bundle:' || v_cert.bundle_id::text
      || '@' || COALESCE(v_cert.bundle_manifest_hash, 'no_hash')
    ELSE
      'evidence_bundle not yet linked'
  END;

  -- Registrar en audit_log. El schema real usa object_type/object_id/delta.
  INSERT INTO audit_log (
    tenant_id, action, object_type, object_id, delta
  ) VALUES (
    v_cert.tenant_id,
    'CERT_EMITIDA',
    'certifications',
    p_certification_id,
    jsonb_build_object(
      'hash_certificacion', v_cert.hash_certificacion,
      'uri',                v_bundle_uri,
      'signature_status',   v_cert.signature_status,
      'ts',                 now()
    )
  );

  RETURN v_bundle_uri;
END;
$$;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION fn_firmar_certificacion(uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_emitir_certificacion(uuid)
  TO authenticated, service_role;
