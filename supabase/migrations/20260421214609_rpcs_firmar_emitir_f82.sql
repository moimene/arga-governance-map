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

  v_bundle_uri := CASE
    WHEN v_cert.bundle_id IS NOT NULL THEN
      'evidence_bundle:' || v_cert.bundle_id::text
      || '@' || COALESCE(v_cert.bundle_manifest_hash, 'no_hash')
    ELSE
      'evidence_bundle not yet linked'
  END;

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

GRANT EXECUTE ON FUNCTION fn_firmar_certificacion(uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_emitir_certificacion(uuid)
  TO authenticated, service_role;
