-- Completa el hash binario de artefactos ya vinculados a un evidence bundle.
-- El content_hash identifica el texto compuesto; hash_sha512 identifica el
-- binario archivado. Ambos deben viajar con el documento base registral.

UPDATE public.secretaria_document_artifacts AS artifact
SET
  hash_sha512 = bundle.hash_sha512,
  updated_at = now()
FROM public.evidence_bundles AS bundle
WHERE artifact.evidence_bundle_id = bundle.id
  AND artifact.tenant_id = bundle.tenant_id
  AND bundle.hash_sha512 IS NOT NULL
  AND (
    artifact.hash_sha512 IS NULL
    OR artifact.hash_sha512 IS DISTINCT FROM bundle.hash_sha512
  );

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.secretaria_document_artifacts AS artifact
    JOIN public.evidence_bundles AS bundle
      ON bundle.id = artifact.evidence_bundle_id
     AND bundle.tenant_id = artifact.tenant_id
    WHERE artifact.artifact_kind IN ('DOCUMENTO_REGISTRAL', 'CERTIFICACION_ACUERDO')
      AND bundle.hash_sha512 IS NOT NULL
      AND artifact.hash_sha512 IS DISTINCT FROM bundle.hash_sha512
  ) THEN
    RAISE EXCEPTION 'document artifact hash_sha512 does not match its evidence bundle';
  END IF;
END
$migration$;
