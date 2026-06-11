-- ITEM-042 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Certificar acuerdos desde acta (fn_generar_certificacion minute-based, la
-- vía del golden path) NO transicionaba los agreements a CERTIFIED, mientras
-- la variante sin sesión sí lo hace. Consecuencia: acuerdos con certificación
-- SIGNED quedaban en ADOPTED para siempre — el timeline del expediente mentía
-- y la Mesa de control seguía ofreciendo "Emitir certificación".
--
-- Fix forward-only:
--   1. fn_emitir_certificacion (paso final del pipeline QTSP) transiciona a
--      CERTIFIED los agreements referenciados en agreements_certified que
--      estén en ADOPTED (mismo guard que la variante sin sesión), scoped al
--      tenant de la certificación. Solo IDs con forma de UUID (las actas
--      legacy llevan referencias no-UUID en el array).
--   2. Backfill de los acuerdos ya certificados (cert SIGNED) atascados en
--      ADOPTED.

CREATE OR REPLACE FUNCTION public.fn_emitir_certificacion(p_certification_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
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

  -- ITEM-042: emitida la certificación, los acuerdos certificados pasan a
  -- CERTIFIED (paridad con fn_generar_certificacion_acuerdo_sin_sesion).
  IF v_cert.agreements_certified IS NOT NULL AND array_length(v_cert.agreements_certified, 1) > 0 THEN
    UPDATE agreements a
       SET status = 'CERTIFIED'
     WHERE a.tenant_id = v_cert.tenant_id
       AND a.status = 'ADOPTED'
       AND a.id::text IN (
         SELECT ref FROM unnest(v_cert.agreements_certified) AS ref
         WHERE ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       );
  END IF;

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
$function$;

-- Backfill: acuerdos ADOPTED con certificación SIGNED ya existente.
UPDATE agreements a
   SET status = 'CERTIFIED'
 WHERE a.status = 'ADOPTED'
   AND EXISTS (
     SELECT 1
       FROM certifications c
      WHERE c.tenant_id = a.tenant_id
        AND c.signature_status = 'SIGNED'
        AND a.id::text = ANY(c.agreements_certified)
   );
