-- Cierra dos brechas del intake registral de certificaciones multipunto:
-- 1) la certificación puede cubrir el agreement_id directo, un UUID incluido
--    en agreements_certified o una referencia meeting:<id>:point:<n>;
-- 2) cuando la certificación es el documento base, el artefacto debe ser
--    exactamente el que materializa su bundle de evidencia.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_registry_certification_covers_agreement(
  p_certification_id uuid,
  p_tenant_id uuid,
  p_agreement_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT p_agreement_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.certifications AS certification
    WHERE certification.id = p_certification_id
      AND certification.tenant_id = p_tenant_id
      AND (
        certification.agreement_id = p_agreement_id
        OR p_agreement_id::text = ANY(
          COALESCE(certification.agreements_certified, ARRAY[]::text[])
        )
        OR EXISTS (
          SELECT 1
          FROM public.meeting_resolutions AS resolution
          WHERE resolution.tenant_id = p_tenant_id
            AND resolution.agreement_id = p_agreement_id
            AND format(
              'meeting:%s:point:%s',
              resolution.meeting_id,
              resolution.agenda_item_index
            ) = ANY(COALESCE(certification.agreements_certified, ARRAY[]::text[]))
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_certification_artifact_matches(
  p_certification_id uuid,
  p_tenant_id uuid,
  p_entity_id uuid,
  p_artifact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.certifications AS certification
    JOIN public.secretaria_document_artifacts AS artifact
      ON artifact.id = p_artifact_id
     AND artifact.tenant_id = certification.tenant_id
     AND artifact.entity_id = p_entity_id
     AND lower(artifact.source_domain) = 'certification'
     AND artifact.source_id = certification.id
     AND artifact.evidence_bundle_id = certification.evidence_id
    WHERE certification.id = p_certification_id
      AND certification.tenant_id = p_tenant_id
      AND certification.signature_status = 'SIGNED'
      AND certification.evidence_id IS NOT NULL
  );
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_secretaria_certification_artifact_bundle_content
  ON public.secretaria_document_artifacts (
    tenant_id,
    source_id,
    evidence_bundle_id,
    content_hash
  )
  WHERE lower(source_domain) = 'certification'
    AND evidence_bundle_id IS NOT NULL
    AND content_hash IS NOT NULL;

DO $migration$
DECLARE
  v_signature regprocedure :=
    'public.fn_registry_prepare_filing(uuid,uuid,uuid,text,uuid,text,uuid,text,uuid,uuid,text,jsonb,date,text,text,uuid)'::regprocedure;
  v_definition text;
  v_rewritten text;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_definition;

  v_rewritten := regexp_replace(
    v_definition,
    'AND \(\s*p_agreement_id IS NULL\s*OR certification\.agreement_id = p_agreement_id\s*\)',
    'AND public.fn_registry_certification_covers_agreement(certification.id, p_tenant_id, p_agreement_id)'
  );
  IF v_rewritten = v_definition THEN
    RAISE EXCEPTION 'fn_registry_prepare_filing certification coverage guard was not found';
  END IF;

  v_definition := v_rewritten;
  v_rewritten := regexp_replace(
    v_definition,
    'PERFORM public\.fn_registry_assert_artifact\(\s*p_tenant_id,\s*p_entity_id,\s*p_base_document_artifact_id,\s*true,\s*false\s*\);',
    E'PERFORM public.fn_registry_assert_artifact(\n    p_tenant_id,\n    p_entity_id,\n    p_base_document_artifact_id,\n    true,\n    false\n  );\n\n  IF v_source_domain = ''CERTIFICATION''\n    AND p_base_document_kind = ''CERTIFICACION''\n    AND NOT public.fn_registry_certification_artifact_matches(\n      p_source_id,\n      p_tenant_id,\n      p_entity_id,\n      p_base_document_artifact_id\n    ) THEN\n    RAISE EXCEPTION USING\n      ERRCODE = ''23514'',\n      MESSAGE = ''certification base artifact does not match its evidence bundle'';\n  END IF;'
  );
  IF v_rewritten = v_definition THEN
    RAISE EXCEPTION 'fn_registry_prepare_filing artifact guard was not found';
  END IF;

  EXECUTE v_rewritten;
END
$migration$;

REVOKE ALL ON FUNCTION public.fn_registry_certification_covers_agreement(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_certification_artifact_matches(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_registry_certification_covers_agreement(uuid, uuid, uuid)
  IS 'Valida cobertura singular, UUID multipunto o referencia meeting-point de una certificacion.';
COMMENT ON FUNCTION public.fn_registry_certification_artifact_matches(uuid, uuid, uuid, uuid)
  IS 'Valida que el artefacto base materializa el bundle de la certificacion firmada.';

COMMIT;
