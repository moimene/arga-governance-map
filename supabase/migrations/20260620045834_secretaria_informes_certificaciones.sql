-- W12 — Informes preceptivos + certificaciones autonomas (2026-06-20)
-- ============================================================================
-- Base comun de artefactos documentales, requisitos documentales por acuerdo,
-- anexos reutilizables y certificaciones autonomas. Forward-only e idempotente.
--
-- Invariantes:
--   * la exigibilidad documental vive en rule packs/perfiles, no en UI;
--   * una instancia documental puede satisfacer varios requisitos;
--   * la certificacion autonoma usa source_hash propio, no gate_hash de acta;
--   * las escrituras sensibles van por RPC con tenant/capability fail-closed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Artefactos documentales compartidos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_document_artifacts (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  artifact_kind              text NOT NULL CHECK (artifact_kind IN (
    'INFORME_PRECEPTIVO',
    'INFORME_DOCUMENTAL_PRE',
    'INFORME_GESTION',
    'CERTIFICACION_AUTONOMA',
    'CERTIFICACION_ACUERDO',
    'ANEXO_EXTERNO',
    'DOCUMENTO_REGISTRAL',
    'SUBSANACION_REGISTRAL',
    'OTRO_SOPORTE'
  )),
  title                      text NOT NULL,
  status                     text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT',
    'SOURCE_LOCKED',
    'PENDING',
    'GENERATED',
    'IN_REVIEW',
    'APPROVED',
    'SIGNED',
    'ARCHIVED',
    'ATTACHED',
    'SUPERSEDED',
    'WAIVED_WITH_OVERRIDE',
    'REVOKED',
    'FAILED'
  )),
  version                    integer NOT NULL DEFAULT 1 CHECK (version > 0),
  template_id                uuid REFERENCES public.plantillas_protegidas(id),
  template_version           text,
  document_url               text,
  mime_type                  text,
  content_hash               text,
  hash_sha512                text,
  evidence_bundle_id         uuid REFERENCES public.evidence_bundles(id),
  evidence_status            text NOT NULL DEFAULT 'DEMO_OPERATIVA' CHECK (evidence_status IN (
    'DEMO_OPERATIVA',
    'EVIDENCE_OPEN',
    'EVIDENCE_SEALED',
    'EVIDENCE_VERIFIED',
    'EVIDENCE_FAILED'
  )),
  source_domain              text,
  source_id                  uuid,
  source_hash                text,
  source_payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_pack_version_id       uuid REFERENCES public.rule_pack_versions(id),
  normative_snapshot_hash    text,
  generated_by               uuid REFERENCES public.user_profiles(user_id),
  generated_at               timestamptz,
  reviewed_by                uuid REFERENCES public.user_profiles(user_id),
  reviewed_at                timestamptz,
  supersedes_artifact_id     uuid REFERENCES public.secretaria_document_artifacts(id),
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secretaria_artifacts_tenant_kind
  ON public.secretaria_document_artifacts (tenant_id, artifact_kind, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_secretaria_artifacts_source
  ON public.secretaria_document_artifacts (tenant_id, source_domain, source_id)
  WHERE source_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secretaria_artifacts_hash
  ON public.secretaria_document_artifacts (tenant_id, source_hash)
  WHERE source_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Requisitos documentales por acuerdo + relacion M:N con artefactos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agreement_document_requirements (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  agreement_id               uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  matter_code                text NOT NULL,
  requirement_code           text NOT NULL,
  document_kind              text NOT NULL CHECK (document_kind IN (
    'INFORME_PRECEPTIVO',
    'INFORME_DOCUMENTAL_PRE',
    'INFORME_GESTION',
    'PROYECTO',
    'BALANCE',
    'CERTIFICACION_SOPORTE',
    'ANEXO_EXTERNO',
    'DOCUMENTO_REGISTRAL',
    'OTRO_SOPORTE'
  )),
  title                      text NOT NULL,
  required_level             text NOT NULL CHECK (required_level IN (
    'OBLIGATORIO',
    'OBLIGATORIO_SI_APLICA',
    'RECOMENDADO',
    'INFORMATIVO'
  )),
  blocking_policy            text NOT NULL CHECK (blocking_policy IN (
    'BLOCKING',
    'OVERRIDE_REQUIRED',
    'WARNING',
    'NO_BLOCK'
  )),
  fase                       text NOT NULL CHECK (fase IN (
    'PRE_CONVOCATORIA',
    'CONVOCATORIA',
    'PRE_REUNION',
    'REUNION',
    'POST_ACUERDO',
    'CERTIFICACION',
    'REGISTRO',
    'BOARD_PACK'
  )),
  legal_basis                text,
  condition                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  annex_targets              text[] NOT NULL DEFAULT '{}',
  evidence_policy            jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_binding_key       text,
  source_layer               text,
  source_ref                 text,
  rule_pack_version_id       uuid REFERENCES public.rule_pack_versions(id),
  normative_snapshot_hash    text,
  status                     text NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'SATISFIED',
    'WAIVED_WITH_OVERRIDE',
    'NOT_APPLICABLE',
    'BLOCKED',
    'SUPERSEDED'
  )),
  explain                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  override_reason            text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agreement_id, requirement_code, matter_code, fase)
);

CREATE INDEX IF NOT EXISTS idx_agreement_doc_req_agreement
  ON public.agreement_document_requirements (tenant_id, agreement_id, status);

CREATE INDEX IF NOT EXISTS idx_agreement_doc_req_kind
  ON public.agreement_document_requirements (tenant_id, document_kind, required_level, blocking_policy);

CREATE TABLE IF NOT EXISTS public.agreement_document_links (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  requirement_id             uuid NOT NULL REFERENCES public.agreement_document_requirements(id) ON DELETE CASCADE,
  artifact_id                uuid NOT NULL REFERENCES public.secretaria_document_artifacts(id) ON DELETE RESTRICT,
  link_role                  text NOT NULL DEFAULT 'SATISFIES_REQUIREMENT',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, requirement_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_agreement_doc_links_artifact
  ON public.agreement_document_links (tenant_id, artifact_id);

CREATE TABLE IF NOT EXISTS public.document_annex_links (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        uuid NOT NULL,
  artifact_id                      uuid NOT NULL REFERENCES public.secretaria_document_artifacts(id) ON DELETE RESTRICT,
  linked_domain                    text NOT NULL CHECK (linked_domain IN (
    'agreement',
    'convocatoria',
    'meeting',
    'minute',
    'certification',
    'standalone_certification',
    'board_pack',
    'registry_filing',
    'communication'
  )),
  linked_id                        uuid NOT NULL,
  annex_role                       text NOT NULL DEFAULT 'SOPORTE',
  annex_order                      integer NOT NULL DEFAULT 1 CHECK (annex_order > 0),
  is_mandatory_annex               boolean NOT NULL DEFAULT false,
  included_in_export               boolean NOT NULL DEFAULT false,
  included_in_certification_bundle boolean NOT NULL DEFAULT false,
  frozen_at                        timestamptz,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, artifact_id, linked_domain, linked_id, annex_role)
);

CREATE INDEX IF NOT EXISTS idx_document_annex_links_target
  ON public.document_annex_links (tenant_id, linked_domain, linked_id, annex_order);

-- ---------------------------------------------------------------------------
-- 3) Certificaciones autonomas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.standalone_certification_kinds (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  kind_code                  text NOT NULL,
  label                      text NOT NULL,
  source_domain              text NOT NULL,
  legal_effect               text NOT NULL DEFAULT 'INTERNO' CHECK (legal_effect IN (
    'INTERNO',
    'SOCIO',
    'AUDITOR',
    'TERCERO',
    'REGISTRAL',
    'SUPERVISOR',
    'PROBATORIO'
  )),
  requires_visto_bueno       boolean NOT NULL DEFAULT false,
  requires_rm_reference      boolean NOT NULL DEFAULT false,
  requires_qes               boolean NOT NULL DEFAULT false,
  template_binding_key       text,
  authority_policy           jsonb NOT NULL DEFAULT '{}'::jsonb,
  disclaimer_policy          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active                  boolean NOT NULL DEFAULT true,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind_code)
);

CREATE INDEX IF NOT EXISTS idx_standalone_cert_kinds_tenant_active
  ON public.standalone_certification_kinds (tenant_id, is_active, kind_code);

CREATE TABLE IF NOT EXISTS public.standalone_certifications (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  entity_id                  uuid NOT NULL REFERENCES public.entities(id),
  body_id                    uuid REFERENCES public.governing_bodies(id),
  kind_id                    uuid REFERENCES public.standalone_certification_kinds(id),
  kind_code                  text NOT NULL,
  source_domain              text NOT NULL,
  source_id                  uuid,
  source_payload             jsonb NOT NULL,
  source_hash                text NOT NULL,
  source_summary             jsonb NOT NULL DEFAULT '{}'::jsonb,
  cutoff_at                  timestamptz NOT NULL DEFAULT now(),
  issued_to                  text,
  legal_effect               text NOT NULL DEFAULT 'INTERNO',
  capa3_payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
  certificante_role          text NOT NULL DEFAULT 'SECRETARIO',
  authority_evidence_id      uuid REFERENCES public.authority_evidence(id),
  visto_bueno_persona_id     uuid REFERENCES public.persons(id),
  visto_bueno_fecha          timestamptz,
  requires_visto_bueno       boolean NOT NULL DEFAULT false,
  requires_qes               boolean NOT NULL DEFAULT false,
  signature_status           text NOT NULL DEFAULT 'PENDING',
  artifact_id                uuid REFERENCES public.secretaria_document_artifacts(id),
  evidence_bundle_id         uuid REFERENCES public.evidence_bundles(id),
  status                     text NOT NULL DEFAULT 'SOURCE_LOCKED' CHECK (status IN (
    'DRAFT',
    'SOURCE_LOCKED',
    'GENERATED',
    'SIGNED',
    'EMITTED',
    'SUPERSEDED',
    'REVOKED',
    'FAILED'
  )),
  superseded_by_id           uuid REFERENCES public.standalone_certifications(id),
  revoked_reason             text,
  emitted_at                 timestamptz,
  created_by                 uuid REFERENCES public.user_profiles(user_id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standalone_cert_tenant_entity
  ON public.standalone_certifications (tenant_id, entity_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_standalone_cert_kind
  ON public.standalone_certifications (tenant_id, kind_code, status);

CREATE INDEX IF NOT EXISTS idx_standalone_cert_source
  ON public.standalone_certifications (tenant_id, source_domain, source_id)
  WHERE source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Helper RLS de escritura documental
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_can_write_document_artifacts(
  p_tenant_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.fn_secretaria_is_service_role()
     AND p_tenant_id <> public.fn_secretaria_current_tenant_id() THEN
    RETURN false;
  END IF;

  IF public.fn_secretaria_is_service_role() THEN
    RETURN true;
  END IF;

  v_role := public.fn_secretaria_current_role_code();
  IF v_role = 'ADMIN_TENANT' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.capability_matrix cm
     WHERE cm.role = v_role
       AND cm.action = 'CERTIFICATION'
       AND cm.enabled IS TRUE
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5) RLS, grants y updated_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.secretaria_document_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_annex_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_certification_kinds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_document_artifacts_tenant_read ON public.secretaria_document_artifacts;
DROP POLICY IF EXISTS secretaria_document_artifacts_tenant_write ON public.secretaria_document_artifacts;
CREATE POLICY secretaria_document_artifacts_tenant_read
  ON public.secretaria_document_artifacts FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY secretaria_document_artifacts_tenant_write
  ON public.secretaria_document_artifacts FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

DROP POLICY IF EXISTS agreement_document_requirements_tenant_read ON public.agreement_document_requirements;
DROP POLICY IF EXISTS agreement_document_requirements_tenant_write ON public.agreement_document_requirements;
CREATE POLICY agreement_document_requirements_tenant_read
  ON public.agreement_document_requirements FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY agreement_document_requirements_tenant_write
  ON public.agreement_document_requirements FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

DROP POLICY IF EXISTS agreement_document_links_tenant_read ON public.agreement_document_links;
DROP POLICY IF EXISTS agreement_document_links_tenant_write ON public.agreement_document_links;
CREATE POLICY agreement_document_links_tenant_read
  ON public.agreement_document_links FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY agreement_document_links_tenant_write
  ON public.agreement_document_links FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

DROP POLICY IF EXISTS document_annex_links_tenant_read ON public.document_annex_links;
DROP POLICY IF EXISTS document_annex_links_tenant_write ON public.document_annex_links;
CREATE POLICY document_annex_links_tenant_read
  ON public.document_annex_links FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY document_annex_links_tenant_write
  ON public.document_annex_links FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

DROP POLICY IF EXISTS standalone_certification_kinds_tenant_read ON public.standalone_certification_kinds;
DROP POLICY IF EXISTS standalone_certification_kinds_tenant_write ON public.standalone_certification_kinds;
CREATE POLICY standalone_certification_kinds_tenant_read
  ON public.standalone_certification_kinds FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY standalone_certification_kinds_tenant_write
  ON public.standalone_certification_kinds FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

DROP POLICY IF EXISTS standalone_certifications_tenant_read ON public.standalone_certifications;
DROP POLICY IF EXISTS standalone_certifications_tenant_write ON public.standalone_certifications;
CREATE POLICY standalone_certifications_tenant_read
  ON public.standalone_certifications FOR SELECT
  TO authenticated
  USING (public.fn_secretaria_is_service_role() OR tenant_id = public.fn_secretaria_current_tenant_id());
CREATE POLICY standalone_certifications_tenant_write
  ON public.standalone_certifications FOR ALL
  TO authenticated
  USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))
  WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id));

GRANT SELECT, INSERT, UPDATE ON TABLE public.secretaria_document_artifacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agreement_document_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agreement_document_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.document_annex_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.standalone_certification_kinds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.standalone_certifications TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secretaria_document_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agreement_document_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agreement_document_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_annex_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.standalone_certification_kinds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.standalone_certifications TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_secretaria_document_artifacts ON public.secretaria_document_artifacts;
CREATE TRIGGER set_updated_at_secretaria_document_artifacts
  BEFORE UPDATE ON public.secretaria_document_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_agreement_document_requirements ON public.agreement_document_requirements;
CREATE TRIGGER set_updated_at_agreement_document_requirements
  BEFORE UPDATE ON public.agreement_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_standalone_certification_kinds ON public.standalone_certification_kinds;
CREATE TRIGGER set_updated_at_standalone_certification_kinds
  BEFORE UPDATE ON public.standalone_certification_kinds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_standalone_certifications ON public.standalone_certifications;
CREATE TRIGGER set_updated_at_standalone_certifications
  BEFORE UPDATE ON public.standalone_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 5) Catalogo MVP ARGA
-- ---------------------------------------------------------------------------

INSERT INTO public.standalone_certification_kinds (
  tenant_id, kind_code, label, source_domain, legal_effect,
  requires_visto_bueno, requires_rm_reference, requires_qes,
  template_binding_key, authority_policy, disclaimer_policy
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_LIBRO_SOCIOS_TITULARIDAD',
    'Certificado de titularidad en libro de socios/acciones',
    'capital_holdings',
    'TERCERO',
    true,
    true,
    false,
    'CERTIFICACION_AUTONOMA:LIBRO_SOCIOS_TITULARIDAD',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"libro_socios"}'::jsonb,
    '{"demo_notice":true,"qtsp_notice":"Solo evidencia cualificada cuando EAD Trust productivo entregue QES/QSeal/TSQ."}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_LIBRO_SOCIOS_TRANSMISION',
    'Certificado de asiento de transmisión',
    'capital_movements',
    'TERCERO',
    true,
    true,
    false,
    'CERTIFICACION_AUTONOMA:LIBRO_SOCIOS_TRANSMISION',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_movements"}'::jsonb,
    '{"demo_notice":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_LIBRO_ACTAS_EXTRACTO',
    'Certificado o extracto de libro de actas',
    'minutes',
    'AUDITOR',
    false,
    false,
    false,
    'CERTIFICACION_AUTONOMA:LIBRO_ACTAS_EXTRACTO',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO"],"source":"minutes"}'::jsonb,
    '{"scope_notice":"Extracto para auditoria/revision, no certificacion registral de acuerdos salvo configuracion expresa."}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_VIGENCIA_CARGO',
    'Certificado de vigencia de cargo',
    'condiciones_persona',
    'TERCERO',
    true,
    true,
    false,
    'CERTIFICACION_AUTONOMA:VIGENCIA_CARGO',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"condiciones_persona"}'::jsonb,
    '{"demo_notice":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_LIBROS_LEGALIZACION',
    'Certificado de estado de legalización de libros',
    'mandatory_books',
    'AUDITOR',
    false,
    false,
    false,
    'CERTIFICACION_AUTONOMA:LIBROS_LEGALIZACION',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"mandatory_books"}'::jsonb,
    '{"demo_notice":true,"legalization_notice":"Refleja el estado registrado en TGMS."}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_ACUERDO_360',
    'Certificación de acuerdo 360',
    'agreements',
    'REGISTRAL',
    true,
    true,
    false,
    'CERTIFICACION_AUTONOMA:ACUERDO_360',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"agreements","scope":"agreement_360"}'::jsonb,
    '{"demo_notice":true,"source_notice":"Certificación emitida desde expediente Acuerdo 360 y fuente canónica del acuerdo."}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_ACUERDO_SIN_SESION',
    'Certificación de acuerdo adoptado por escrito y sin sesión',
    'agreements',
    'REGISTRAL',
    true,
    true,
    false,
    'CERTIFICACION_AUTONOMA:ACUERDO_SIN_SESION',
    '{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"agreements","prefer_existing_rpc":"fn_generar_certificacion_acuerdo_sin_sesion"}'::jsonb,
    '{"demo_notice":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'CERT_DECISION_SOCIO_UNICO',
    'Certificación o constancia de decisión de socio único',
    'unipersonal_decisions',
    'REGISTRAL',
    false,
    false,
    false,
    'CERTIFICACION_AUTONOMA:DECISION_SOCIO_UNICO',
    '{"certificante_roles":["ADMIN_UNICO","SECRETARIO","VICESECRETARIO"],"source":"unipersonal_decisions"}'::jsonb,
    '{"demo_notice":true,"authority_notice":"Debe reflejar firma/representacion del socio unico cuando proceda."}'::jsonb
  )
ON CONFLICT (tenant_id, kind_code) DO UPDATE SET
  label = EXCLUDED.label,
  source_domain = EXCLUDED.source_domain,
  legal_effect = EXCLUDED.legal_effect,
  requires_visto_bueno = EXCLUDED.requires_visto_bueno,
  requires_rm_reference = EXCLUDED.requires_rm_reference,
  requires_qes = EXCLUDED.requires_qes,
  template_binding_key = EXCLUDED.template_binding_key,
  authority_policy = EXCLUDED.authority_policy,
  disclaimer_policy = EXCLUDED.disclaimer_policy,
  is_active = true,
  updated_at = now();

INSERT INTO public.standalone_certification_kinds (
  tenant_id, kind_code, label, source_domain, legal_effect,
  requires_visto_bueno, requires_rm_reference, requires_qes,
  template_binding_key, authority_policy, disclaimer_policy
) VALUES
  ('00000000-0000-0000-0000-000000000001','CERT_LIBRO_ACCIONES_NOMINATIVAS','Certificado de inscripción en libro de acciones nominativas','capital_holdings','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:LIBRO_ACCIONES_NOMINATIVAS','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_holdings","generic_table":true}'::jsonb,'{"demo_notice":true,"cotizada_notice":"En sociedades cotizadas debe conciliarse con anotaciones en cuenta/Iberclear cuando aplique."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_LIBRO_ACTAS_INDICE','Certificado de índice de actas','minutes','AUDITOR',false,false,false,'CERTIFICACION_AUTONOMA:LIBRO_ACTAS_INDICE','{"certificante_roles":["SECRETARIO","VICESECRETARIO"],"source":"minutes","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_LIBRO_CONTRATOS_SOCIO_UNICO','Certificado de libro de contratos del socio único','unipersonal_decisions','REGISTRAL',false,false,false,'CERTIFICACION_AUTONOMA:LIBRO_CONTRATOS_SOCIO_UNICO','{"certificante_roles":["ADMIN_UNICO","SECRETARIO","VICESECRETARIO"],"source":"unipersonal_decisions","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_CAPITAL_SOCIAL_VIGENTE','Certificado de capital social vigente','entity_capital_profile','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:CAPITAL_SOCIAL_VIGENTE','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"entity_capital_profile","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_CAP_TABLE_FECHA','Certificado de cap table a fecha determinada','capital_holdings','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:CAP_TABLE_FECHA','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_holdings","generic_table":true}'::jsonb,'{"demo_notice":true,"free_float_notice":"En demo puede existir free float agregado."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_DERECHOS_VOTO','Certificado de derechos de voto y denominador de cómputo','parte_votante_current','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:DERECHOS_VOTO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"parte_votante_current","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_MOVIMIENTOS_CAPITAL','Certificado de historial de movimientos de capital','capital_movements','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:MOVIMIENTOS_CAPITAL','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_movements","generic_table":true}'::jsonb,'{"demo_notice":true,"worm_notice":"Fuente WORM append-only."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_PRENDA_O_GRAVAMEN','Certificado de prenda o gravamen registrado','capital_movements','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:PRENDA_GRAVAMEN','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_movements","generic_table":true,"movement_types":["PIGNORACION","LIBERACION_PRENDA"]}'::jsonb,'{"demo_notice":true,"scope_notice":"Solo certifica cargas registradas en TGMS."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_AUTOCARTERA','Certificado de autocartera y exclusión de voto','capital_holdings','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:AUTOCARTERA','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"capital_holdings","generic_table":true,"filter":{"is_treasury":true}}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_COMPOSICION_ORGANO','Certificado de composición vigente de órgano','condiciones_persona','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:COMPOSICION_ORGANO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"condiciones_persona","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_AUTORIDAD_CERTIFICANTE','Certificado de autoridad certificante y Vº Bº','authority_evidence','TERCERO',false,false,false,'CERTIFICACION_AUTONOMA:AUTORIDAD_CERTIFICANTE','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"authority_evidence","generic_table":true}'::jsonb,'{"demo_notice":true,"exclusion_notice":"Consejero coordinador no es certificante."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_INSCRIPCION_RM_CARGO','Certificado de referencia registral de cargo','authority_evidence','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:INSCRIPCION_RM_CARGO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"authority_evidence","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_REPRESENTANTE_PJ_ADMIN','Certificado de representante persona física de PJ administradora','representaciones','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:REPRESENTANTE_PJ_ADMIN','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"representaciones","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_FACULTADES_ORGANICAS','Certificado de facultades orgánicas o delegadas','delegations','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:FACULTADES_ORGANICAS','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"delegations","generic_table":true}'::jsonb,'{"demo_notice":true,"scope_notice":"Debe revisarse contra límites e indelegables."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_DECISION_ADMIN_UNICO','Certificación o constancia de decisión de administrador único','unipersonal_decisions','REGISTRAL',false,false,false,'CERTIFICACION_AUTONOMA:DECISION_ADMIN_UNICO','{"certificante_roles":["ADMIN_UNICO","SECRETARIO","VICESECRETARIO"],"source":"unipersonal_decisions","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_CO_APROBACION','Certificación de co-aprobación de administradores mancomunados','agreements','REGISTRAL',true,true,false,'CERTIFICACION_AUTONOMA:CO_APROBACION','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"agreements","generic_table":true,"adoption_mode":"CO_APROBACION"}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_ADMIN_SOLIDARIO','Certificación de actuación de administrador solidario','agreements','REGISTRAL',false,false,false,'CERTIFICACION_AUTONOMA:ADMIN_SOLIDARIO','{"certificante_roles":["ADMIN_SOLIDARIO","SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"agreements","generic_table":true,"adoption_mode":"SOLIDARIO"}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_ENVIO_CONVOCATORIA','Certificado de emisión y envío de convocatoria','communications','PROBATORIO',true,true,false,'CERTIFICACION_AUTONOMA:ENVIO_CONVOCATORIA','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"communications","generic_table":true}'::jsonb,'{"demo_notice":true,"erds_notice":"ERDS cualificado solo cuando EAD Trust productivo lo confirme."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_NOTIFICACION_SL_SOCIO','Certificado individual de notificación a socio de SL','communications','PROBATORIO',true,true,false,'CERTIFICACION_AUTONOMA:NOTIFICACION_SL_SOCIO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"communications","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_ERDS_ENTREGA','Certificado de entrega electrónica certificada ERDS','communications','PROBATORIO',true,true,true,'CERTIFICACION_AUTONOMA:ERDS_ENTREGA','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"communications","generic_table":true,"qtsp":"EAD_TRUST"}'::jsonb,'{"demo_notice":true,"qtsp_notice":"Sandbox/demo hasta EAD Trust productivo."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_DOCUMENTACION_DISPONIBLE','Certificado de documentación disponible antes de reunión','secretaria_document_artifacts','PROBATORIO',true,true,false,'CERTIFICACION_AUTONOMA:DOCUMENTACION_DISPONIBLE','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"secretaria_document_artifacts","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_REGISTRO_CONFLICTOS','Certificado de conflictos de interés y abstenciones','conflicts_of_interest','AUDITOR',false,false,false,'CERTIFICACION_AUTONOMA:REGISTRO_CONFLICTOS','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"conflicts_of_interest","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_REGISTRO_DELEGACIONES','Certificado del registro de delegaciones','delegations','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:REGISTRO_DELEGACIONES','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"delegations","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_REGISTRO_PODERES','Certificado del registro de poderes y representaciones','representaciones','TERCERO',true,true,false,'CERTIFICACION_AUTONOMA:REGISTRO_PODERES','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"representaciones","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_PACTOS_PARASOCIALES','Certificado de existencia y alertas de pactos parasociales','pactos_parasociales','INTERNO',false,false,false,'CERTIFICACION_AUTONOMA:PACTOS_PARASOCIALES','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"pactos_parasociales","generic_table":true}'::jsonb,'{"demo_notice":true,"contractual_notice":"Canal contractual separado, no invalidez societaria automática."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_COMUNICACIONES_REGULATORIAS','Certificado de comunicaciones regulatorias','communications','SUPERVISOR',true,true,true,'CERTIFICACION_AUTONOMA:COMUNICACIONES_REGULATORIAS','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"communications","generic_table":true,"qtsp":"EAD_TRUST"}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_FIT_AND_PROPER','Certificado de registro fit & proper','condiciones_persona','SUPERVISOR',true,true,false,'CERTIFICACION_AUTONOMA:FIT_AND_PROPER','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"condiciones_persona","generic_table":true,"sector":"insurance"}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_SOLVENCIA_II_SUPERVISION','Certificado de evidencias Solvencia II / Pilar 3','evidences','SUPERVISOR',false,false,false,'CERTIFICACION_AUTONOMA:SOLVENCIA_II_SUPERVISION','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"evidences","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_INTEGRIDAD_DOCUMENTO','Certificado de integridad de documento generado','secretaria_document_artifacts','PROBATORIO',false,false,false,'CERTIFICACION_AUTONOMA:INTEGRIDAD_DOCUMENTO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"secretaria_document_artifacts","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_EVIDENCE_BUNDLE','Certificado de bundle de evidencia','evidence_bundles','PROBATORIO',false,false,false,'CERTIFICACION_AUTONOMA:EVIDENCE_BUNDLE','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"evidence_bundles","generic_table":true}'::jsonb,'{"demo_notice":true,"evidence_notice":"OPEN/SEALED/VERIFIED según estado; no presumir evidencia cualificada productiva."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_EXPEDIENTE_DOCUMENTAL','Certificado del expediente documental completo','agreements','PROBATORIO',true,true,false,'CERTIFICACION_AUTONOMA:EXPEDIENTE_DOCUMENTAL','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"agreements","generic_table":true}'::jsonb,'{"demo_notice":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_DOCUMENTOS_AUDITORIA','Certificado de documentación para auditoría/compliance','secretaria_document_artifacts','AUDITOR',false,false,false,'CERTIFICACION_AUTONOMA:DOCUMENTOS_AUDITORIA','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"secretaria_document_artifacts","generic_table":true}'::jsonb,'{"demo_notice":true,"read_only_notice":"Auditor y Compliance consultan; no emiten."}'::jsonb),
  ('00000000-0000-0000-0000-000000000001','CERT_BOARD_PACK_CONTENIDO','Certificado de composición del board pack','secretaria_document_artifacts','INTERNO',false,false,false,'CERTIFICACION_AUTONOMA:BOARD_PACK_CONTENIDO','{"certificante_roles":["SECRETARIO","VICESECRETARIO","ADMIN_UNICO"],"source":"secretaria_document_artifacts","generic_table":true}'::jsonb,'{"demo_notice":true,"cotizada_notice":"Mantener advertencias LMV/CNMV cuando aplique."}'::jsonb)
ON CONFLICT (tenant_id, kind_code) DO UPDATE SET
  label = EXCLUDED.label,
  source_domain = EXCLUDED.source_domain,
  legal_effect = EXCLUDED.legal_effect,
  requires_visto_bueno = EXCLUDED.requires_visto_bueno,
  requires_rm_reference = EXCLUDED.requires_rm_reference,
  requires_qes = EXCLUDED.requires_qes,
  template_binding_key = EXCLUDED.template_binding_key,
  authority_policy = EXCLUDED.authority_policy,
  disclaimer_policy = EXCLUDED.disclaimer_policy,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) Helpers y RPCs de certificacion autonoma
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_canonical_jsonb_hash(p_payload jsonb)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT encode(digest(COALESCE(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex')
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_document_annex_manifest(
  p_tenant_id uuid,
  p_linked_domain text,
  p_linked_id uuid,
  p_certification_bundle_only boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_items jsonb;
  v_count integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id requerido';
  END IF;
  IF p_linked_domain IS NULL OR btrim(p_linked_domain) = '' THEN
    RAISE EXCEPTION 'p_linked_domain requerido';
  END IF;
  IF p_linked_id IS NULL THEN
    RAISE EXCEPTION 'p_linked_id requerido';
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'artifact_id', artifact.id,
          'artifact_kind', artifact.artifact_kind,
          'title', artifact.title,
          'linked_domain', link.linked_domain,
          'linked_id', link.linked_id,
          'annex_role', link.annex_role,
          'annex_order', link.annex_order,
          'is_mandatory_annex', link.is_mandatory_annex,
          'included_in_export', link.included_in_export,
          'included_in_certification_bundle', link.included_in_certification_bundle,
          'evidence_status', artifact.evidence_status,
          'artifact_status', artifact.status,
          'source_hash', artifact.source_hash,
          'content_hash', artifact.content_hash,
          'hash_sha512', artifact.hash_sha512
        )
        ORDER BY link.annex_order, link.linked_domain, link.annex_role, artifact.id
      ) FILTER (WHERE link.id IS NOT NULL),
      '[]'::jsonb
    ),
    count(link.id)
  INTO v_items, v_count
  FROM public.document_annex_links link
  JOIN public.secretaria_document_artifacts artifact
    ON artifact.id = link.artifact_id
   AND artifact.tenant_id = link.tenant_id
 WHERE link.tenant_id = p_tenant_id
   AND link.linked_domain = p_linked_domain
   AND link.linked_id = p_linked_id
   AND (
     p_certification_bundle_only IS NOT TRUE
     OR link.included_in_certification_bundle IS TRUE
   );

  RETURN jsonb_build_object(
    'linked_domain', p_linked_domain,
    'linked_id', p_linked_id,
    'certification_bundle_only', COALESCE(p_certification_bundle_only, false),
    'count', v_count,
    'items', v_items
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_document_annex_manifest_hash(
  p_tenant_id uuid,
  p_linked_domain text,
  p_linked_id uuid,
  p_certification_bundle_only boolean DEFAULT false
) RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT public.fn_secretaria_canonical_jsonb_hash(
    public.fn_secretaria_document_annex_manifest(
      p_tenant_id,
      p_linked_domain,
      p_linked_id,
      COALESCE(p_certification_bundle_only, false)
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.fn_prepare_standalone_certification_source(
  p_kind text,
  p_source_input jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_entity_id uuid;
  v_body_id uuid;
  v_kind public.standalone_certification_kinds%ROWTYPE;
  v_source_id uuid;
  v_cutoff timestamptz;
  v_payload jsonb;
  v_summary jsonb;
  v_source_domain text;
  v_where text;
  v_order text;
  v_table_has_id boolean;
  v_first jsonb;
BEGIN
  IF p_kind IS NULL OR btrim(p_kind) = '' THEN
    RAISE EXCEPTION 'p_kind requerido';
  END IF;

  v_tenant_id := COALESCE(NULLIF(p_source_input ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  SELECT *
    INTO v_kind
    FROM public.standalone_certification_kinds
   WHERE tenant_id = v_tenant_id
     AND kind_code = p_kind
     AND is_active IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification kind % no activo para tenant %', p_kind, v_tenant_id;
  END IF;

  v_entity_id := NULLIF(p_source_input ->> 'entity_id', '')::uuid;
  v_body_id := NULLIF(p_source_input ->> 'body_id', '')::uuid;
  v_cutoff := COALESCE(NULLIF(p_source_input ->> 'cutoff_at', '')::timestamptz, now());
  v_source_domain := v_kind.source_domain;

  IF p_kind = 'CERT_LIBRO_SOCIOS_TITULARIDAD' THEN
    IF v_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id requerido'; END IF;
    v_source_id := NULLIF(p_source_input ->> 'person_id', '')::uuid;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.holder_person_id::text, q.share_class_id::text)
      INTO v_payload
      FROM (
        SELECT ch.*
          FROM public.capital_holdings ch
         WHERE ch.tenant_id = v_tenant_id
           AND ch.entity_id = v_entity_id
           AND (v_source_id IS NULL OR ch.holder_person_id = v_source_id)
           AND ch.effective_from <= v_cutoff::date
           AND (ch.effective_to IS NULL OR ch.effective_to > v_cutoff::date)
      ) q;
    v_summary := jsonb_build_object(
      'rows', COALESCE(jsonb_array_length(v_payload), 0),
      'person_id', v_source_id,
      'cutoff_at', v_cutoff
    );

  ELSIF p_kind = 'CERT_LIBRO_SOCIOS_TRANSMISION' THEN
    IF v_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id requerido'; END IF;
    v_source_id := NULLIF(p_source_input ->> 'movement_id', '')::uuid;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.effective_date, q.id)
      INTO v_payload
      FROM (
        SELECT cm.*
          FROM public.capital_movements cm
         WHERE cm.tenant_id = v_tenant_id
           AND cm.entity_id = v_entity_id
           AND cm.movement_type = 'TRANSMISION'
           AND (v_source_id IS NULL OR cm.id = v_source_id)
           AND (NULLIF(p_source_input ->> 'agreement_id', '') IS NULL OR cm.agreement_id = NULLIF(p_source_input ->> 'agreement_id', '')::uuid)
      ) q;
    v_summary := jsonb_build_object('rows', COALESCE(jsonb_array_length(v_payload), 0), 'movement_id', v_source_id);

  ELSIF p_kind = 'CERT_LIBRO_ACTAS_EXTRACTO' THEN
    IF v_entity_id IS NULL AND v_body_id IS NULL THEN RAISE EXCEPTION 'entity_id o body_id requerido'; END IF;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at, q.id)
      INTO v_payload
      FROM (
        SELECT m.id, m.tenant_id, m.meeting_id, m.body_id, m.entity_id, m.content_hash,
               m.canonical_minutes_hash, m.signed_at, m.registered_at, m.is_locked, m.created_at
          FROM public.minutes m
          LEFT JOIN public.governing_bodies gb ON gb.id = m.body_id
         WHERE m.tenant_id = v_tenant_id
           AND (v_entity_id IS NULL OR COALESCE(m.entity_id, gb.entity_id) = v_entity_id)
           AND (v_body_id IS NULL OR m.body_id = v_body_id)
      ) q;
    v_summary := jsonb_build_object('rows', COALESCE(jsonb_array_length(v_payload), 0), 'body_id', v_body_id);

  ELSIF p_kind = 'CERT_VIGENCIA_CARGO' THEN
    IF v_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id requerido'; END IF;
    v_source_id := NULLIF(p_source_input ->> 'condition_id', '')::uuid;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.fecha_inicio DESC, q.id)
      INTO v_payload
      FROM (
        SELECT cp.*
          FROM public.condiciones_persona cp
         WHERE cp.tenant_id = v_tenant_id
           AND cp.entity_id = v_entity_id
           AND cp.estado = 'VIGENTE'
           AND (v_source_id IS NULL OR cp.id = v_source_id)
           AND (NULLIF(p_source_input ->> 'person_id', '') IS NULL OR cp.person_id = NULLIF(p_source_input ->> 'person_id', '')::uuid)
           AND (v_body_id IS NULL OR cp.body_id = v_body_id)
           AND (NULLIF(p_source_input ->> 'cargo', '') IS NULL OR cp.tipo_condicion = NULLIF(p_source_input ->> 'cargo', ''))
      ) q;
    v_summary := jsonb_build_object('rows', COALESCE(jsonb_array_length(v_payload), 0), 'condition_id', v_source_id);

  ELSIF p_kind = 'CERT_LIBROS_LEGALIZACION' THEN
    IF v_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id requerido'; END IF;
    v_source_id := NULLIF(p_source_input ->> 'book_id', '')::uuid;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.book_kind, q.period, q.volume_number)
      INTO v_payload
      FROM (
        SELECT mb.*
          FROM public.mandatory_books mb
         WHERE mb.tenant_id = v_tenant_id
           AND mb.entity_id = v_entity_id
           AND (v_source_id IS NULL OR mb.id = v_source_id)
      ) q;
    v_summary := jsonb_build_object('rows', COALESCE(jsonb_array_length(v_payload), 0), 'book_id', v_source_id);

  ELSIF p_kind = 'CERT_ACUERDO_360' THEN
    v_source_id := NULLIF(p_source_input ->> 'agreement_id', '')::uuid;
    IF v_source_id IS NULL THEN RAISE EXCEPTION 'agreement_id requerido'; END IF;
    SELECT a.entity_id, a.body_id, to_jsonb(a)
      INTO v_entity_id, v_body_id, v_payload
      FROM public.agreements a
     WHERE a.tenant_id = v_tenant_id
       AND a.id = v_source_id;
    IF v_payload IS NULL THEN RAISE EXCEPTION 'acuerdo no encontrado: %', v_source_id; END IF;
    v_summary := jsonb_build_object(
      'agreement_id', v_source_id,
      'status', v_payload ->> 'status',
      'adoption_mode', v_payload ->> 'adoption_mode',
      'agreement_kind', v_payload ->> 'agreement_kind'
    );

  ELSIF p_kind = 'CERT_ACUERDO_SIN_SESION' THEN
    v_source_id := NULLIF(p_source_input ->> 'agreement_id', '')::uuid;
    IF v_source_id IS NULL THEN RAISE EXCEPTION 'agreement_id requerido'; END IF;
    SELECT a.entity_id, a.body_id, to_jsonb(a)
      INTO v_entity_id, v_body_id, v_payload
      FROM public.agreements a
     WHERE a.tenant_id = v_tenant_id
       AND a.id = v_source_id
       AND a.adoption_mode = 'NO_SESSION';
    IF v_payload IS NULL THEN RAISE EXCEPTION 'acuerdo sin sesion no encontrado: %', v_source_id; END IF;
    v_summary := jsonb_build_object('agreement_id', v_source_id, 'status', v_payload ->> 'status');

  ELSIF p_kind = 'CERT_DECISION_SOCIO_UNICO' THEN
    v_source_id := NULLIF(p_source_input ->> 'decision_id', '')::uuid;
    IF v_entity_id IS NULL AND v_source_id IS NULL THEN RAISE EXCEPTION 'entity_id o decision_id requerido'; END IF;
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.decision_date DESC NULLS LAST, q.created_at DESC)
      INTO v_payload
      FROM (
        SELECT ud.*
          FROM public.unipersonal_decisions ud
         WHERE ud.tenant_id = v_tenant_id
           AND (v_entity_id IS NULL OR ud.entity_id = v_entity_id)
           AND (v_source_id IS NULL OR ud.id = v_source_id)
      ) q;
    IF v_entity_id IS NULL THEN
      SELECT ud.entity_id INTO v_entity_id
        FROM public.unipersonal_decisions ud
       WHERE ud.id = v_source_id AND ud.tenant_id = v_tenant_id;
    END IF;
    v_summary := jsonb_build_object('rows', COALESCE(jsonb_array_length(v_payload), 0), 'decision_id', v_source_id);

  ELSE
    IF v_source_domain IS NULL OR v_source_domain !~ '^[a-z_][a-z0-9_]*$' THEN
      RAISE EXCEPTION 'kind % sin fuente tabular segura: %', p_kind, v_source_domain;
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = v_source_domain
    ) THEN
      RAISE EXCEPTION 'kind % apunta a fuente no existente: %', p_kind, v_source_domain;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'id'
    ) INTO v_table_has_id;

    v_source_id := COALESCE(
      NULLIF(p_source_input ->> 'source_id', '')::uuid,
      NULLIF(p_source_input ->> 'record_id', '')::uuid,
      NULLIF(p_source_input ->> 'book_id', '')::uuid,
      NULLIF(p_source_input ->> 'movement_id', '')::uuid,
      NULLIF(p_source_input ->> 'condition_id', '')::uuid,
      NULLIF(p_source_input ->> 'decision_id', '')::uuid,
      NULLIF(p_source_input ->> 'communication_id', '')::uuid,
      NULLIF(p_source_input ->> 'evidence_bundle_id', '')::uuid,
      NULLIF(p_source_input ->> 'pacto_id', '')::uuid,
      NULLIF(p_source_input ->> 'delegation_id', '')::uuid,
      NULLIF(p_source_input ->> 'conflict_id', '')::uuid
    );

    v_where := 'true';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'tenant_id') THEN
      v_where := v_where || format(' AND tenant_id = %L', v_tenant_id);
    END IF;
    IF v_table_has_id AND v_source_id IS NOT NULL THEN
      v_where := v_where || format(' AND id = %L', v_source_id);
    END IF;
    IF v_entity_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'entity_id') THEN
      v_where := v_where || format(' AND entity_id = %L', v_entity_id);
    END IF;
    IF v_body_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'body_id') THEN
      v_where := v_where || format(' AND body_id = %L', v_body_id);
    END IF;
    IF NULLIF(p_source_input ->> 'person_id', '') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name IN ('person_id','holder_person_id')) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'person_id') THEN
        v_where := v_where || format(' AND person_id = %L', NULLIF(p_source_input ->> 'person_id', '')::uuid);
      ELSE
        v_where := v_where || format(' AND holder_person_id = %L', NULLIF(p_source_input ->> 'person_id', '')::uuid);
      END IF;
    END IF;
    IF NULLIF(p_source_input ->> 'agreement_id', '') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'agreement_id') THEN
      v_where := v_where || format(' AND agreement_id = %L', NULLIF(p_source_input ->> 'agreement_id', '')::uuid);
    END IF;
    IF NULLIF(p_source_input ->> 'status', '') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'status') THEN
      v_where := v_where || format(' AND status = %L', NULLIF(p_source_input ->> 'status', ''));
    END IF;
    IF NULLIF(p_source_input ->> 'cargo', '') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name IN ('cargo','tipo_condicion')) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'cargo') THEN
        v_where := v_where || format(' AND cargo = %L', NULLIF(p_source_input ->> 'cargo', ''));
      ELSE
        v_where := v_where || format(' AND tipo_condicion = %L', NULLIF(p_source_input ->> 'cargo', ''));
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'created_at') THEN
      v_order := 'q.created_at DESC NULLS LAST';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'effective_date') THEN
      v_order := 'q.effective_date DESC NULLS LAST';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_source_domain AND column_name = 'effective_from') THEN
      v_order := 'q.effective_from DESC NULLS LAST';
    ELSE
      v_order := '1';
    END IF;
    IF v_table_has_id THEN
      v_order := v_order || ', q.id';
    END IF;

    EXECUTE format(
      'SELECT jsonb_agg(to_jsonb(q) ORDER BY %s) FROM (SELECT * FROM public.%I WHERE %s LIMIT 200) q',
      v_order,
      v_source_domain,
      v_where
    )
    INTO v_payload;

    v_first := CASE
      WHEN jsonb_typeof(v_payload) = 'array' AND jsonb_array_length(v_payload) > 0 THEN v_payload -> 0
      ELSE NULL
    END;
    IF v_entity_id IS NULL AND v_first ? 'entity_id' THEN
      v_entity_id := NULLIF(v_first ->> 'entity_id', '')::uuid;
    END IF;
    IF v_body_id IS NULL AND v_first ? 'body_id' THEN
      v_body_id := NULLIF(v_first ->> 'body_id', '')::uuid;
    END IF;
    IF v_source_id IS NULL AND v_table_has_id AND jsonb_array_length(COALESCE(v_payload, '[]'::jsonb)) = 1 THEN
      v_source_id := NULLIF(v_first ->> 'id', '')::uuid;
    END IF;

    v_summary := jsonb_build_object(
      'rows', COALESCE(jsonb_array_length(v_payload), 0),
      'source_table', v_source_domain,
      'source_id', v_source_id,
      'generic_table_resolver', true
    );
  END IF;

  IF v_payload IS NULL OR v_payload = '[]'::jsonb THEN
    RAISE EXCEPTION 'fuente canonica vacia para %', p_kind;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'body_id', v_body_id,
    'kind_code', v_kind.kind_code,
    'kind_label', v_kind.label,
    'source_domain', v_source_domain,
    'source_id', v_source_id,
    'source_payload', v_payload,
    'source_hash', public.fn_secretaria_canonical_jsonb_hash(v_payload),
    'source_summary', v_summary,
    'cutoff_at', v_cutoff,
    'legal_effect', v_kind.legal_effect,
    'requires_visto_bueno', v_kind.requires_visto_bueno,
    'requires_rm_reference', v_kind.requires_rm_reference,
    'requires_qes', v_kind.requires_qes,
    'template_binding_key', v_kind.template_binding_key,
    'disclaimer_policy', v_kind.disclaimer_policy
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_create_standalone_certification(
  p_kind text,
  p_source_input jsonb DEFAULT '{}'::jsonb,
  p_cutoff_at timestamptz DEFAULT NULL,
  p_issued_to text DEFAULT NULL,
  p_capa3 jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_source jsonb;
  v_tenant_id uuid;
  v_entity_id uuid;
  v_body_id uuid;
  v_kind public.standalone_certification_kinds%ROWTYPE;
  v_artifact_id uuid;
  v_cert_id uuid;
  v_certificante_role text;
  v_auth_id uuid;
  v_vb_person_id uuid;
  v_vb_auth_id uuid;
BEGIN
  v_source := public.fn_prepare_standalone_certification_source(
    p_kind,
    p_source_input || jsonb_build_object('cutoff_at', COALESCE(p_cutoff_at, NULLIF(p_source_input ->> 'cutoff_at', '')::timestamptz, now()))
  );
  v_tenant_id := (v_source ->> 'tenant_id')::uuid;
  v_entity_id := (v_source ->> 'entity_id')::uuid;
  v_body_id := NULLIF(v_source ->> 'body_id', '')::uuid;

  PERFORM public.fn_secretaria_assert_capability(v_tenant_id, 'CERTIFICATION');

  SELECT *
    INTO v_kind
    FROM public.standalone_certification_kinds
   WHERE tenant_id = v_tenant_id
     AND kind_code = p_kind
     AND is_active IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kind % no activo', p_kind;
  END IF;

  v_certificante_role := COALESCE(NULLIF(p_source_input ->> 'certificante_role', ''), 'SECRETARIO');
  v_vb_person_id := NULLIF(p_source_input ->> 'visto_bueno_persona_id', '')::uuid;

  SELECT ae.id
    INTO v_auth_id
    FROM public.authority_evidence ae
   WHERE ae.tenant_id = v_tenant_id
     AND ae.entity_id = v_entity_id
     AND ae.cargo = v_certificante_role
     AND ae.estado = 'VIGENTE'
     AND (v_body_id IS NULL OR ae.body_id = v_body_id OR ae.body_id IS NULL)
     AND (
       public.fn_secretaria_is_service_role()
       OR public.fn_secretaria_current_role_code() = 'ADMIN_TENANT'
       OR ae.person_id = public.fn_secretaria_current_person_id()
     )
   ORDER BY (ae.body_id = v_body_id) DESC NULLS LAST, ae.fecha_inicio DESC
   LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No hay autoridad vigente para cargo % en entity %', v_certificante_role, v_entity_id;
  END IF;

  IF v_kind.requires_rm_reference AND NOT EXISTS (
    SELECT 1 FROM public.authority_evidence ae
     WHERE ae.id = v_auth_id
       AND ae.inscripcion_rm_referencia IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El certificante % requiere referencia RM para %', v_certificante_role, p_kind;
  END IF;

  IF v_kind.requires_visto_bueno THEN
    IF v_vb_person_id IS NULL THEN
      RAISE EXCEPTION 'Visto bueno requerido para %', p_kind;
    END IF;
    SELECT ae.id
      INTO v_vb_auth_id
      FROM public.authority_evidence ae
     WHERE ae.tenant_id = v_tenant_id
       AND ae.entity_id = v_entity_id
       AND ae.person_id = v_vb_person_id
       AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
       AND ae.estado = 'VIGENTE'
       AND (v_body_id IS NULL OR ae.body_id = v_body_id OR ae.body_id IS NULL)
     ORDER BY (ae.body_id = v_body_id) DESC NULLS LAST, ae.fecha_inicio DESC
     LIMIT 1;
    IF v_vb_auth_id IS NULL THEN
      RAISE EXCEPTION 'Visto bueno sin PRESIDENTE/VICEPRESIDENTE vigente para %', p_kind;
    END IF;
    IF v_kind.requires_rm_reference AND NOT EXISTS (
      SELECT 1 FROM public.authority_evidence ae
       WHERE ae.id = v_vb_auth_id
         AND ae.inscripcion_rm_referencia IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'El Vº Bº requiere referencia RM para %', p_kind;
    END IF;
  END IF;

  INSERT INTO public.secretaria_document_artifacts (
    tenant_id, artifact_kind, title, status,
    source_domain, source_id, source_hash, content_hash, source_payload,
    evidence_status, metadata, generated_by, generated_at
  ) VALUES (
    v_tenant_id,
    'CERTIFICACION_AUTONOMA',
    COALESCE(v_kind.label, p_kind),
    'SOURCE_LOCKED',
    v_source ->> 'source_domain',
    NULLIF(v_source ->> 'source_id', '')::uuid,
    v_source ->> 'source_hash',
    v_source ->> 'source_hash',
    v_source -> 'source_payload',
    'DEMO_OPERATIVA',
    jsonb_build_object(
      'kind_code', p_kind,
      'source_summary', v_source -> 'source_summary',
      'template_binding_key', v_kind.template_binding_key,
      'disclaimer_policy', v_kind.disclaimer_policy
    ),
    auth.uid(),
    now()
  )
  RETURNING id INTO v_artifact_id;

  INSERT INTO public.standalone_certifications (
    tenant_id, entity_id, body_id, kind_id, kind_code,
    source_domain, source_id, source_payload, source_hash, source_summary,
    cutoff_at, issued_to, legal_effect, capa3_payload,
    certificante_role, authority_evidence_id,
    visto_bueno_persona_id, visto_bueno_fecha,
    requires_visto_bueno, requires_qes,
    artifact_id, status, signature_status, created_by
  ) VALUES (
    v_tenant_id, v_entity_id, v_body_id, v_kind.id, p_kind,
    v_source ->> 'source_domain',
    NULLIF(v_source ->> 'source_id', '')::uuid,
    v_source -> 'source_payload',
    v_source ->> 'source_hash',
    v_source -> 'source_summary',
    COALESCE(p_cutoff_at, (v_source ->> 'cutoff_at')::timestamptz, now()),
    p_issued_to,
    v_kind.legal_effect,
    COALESCE(p_capa3, '{}'::jsonb),
    v_certificante_role,
    v_auth_id,
    v_vb_person_id,
    CASE WHEN v_vb_person_id IS NOT NULL THEN now() ELSE NULL END,
    v_kind.requires_visto_bueno,
    v_kind.requires_qes,
    v_artifact_id,
    'SOURCE_LOCKED',
    'PENDING',
    auth.uid()
  )
  RETURNING id INTO v_cert_id;

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_tenant_id,
    'STANDALONE_CERT_SOURCE_LOCKED',
    'standalone_certifications',
    v_cert_id,
    jsonb_build_object('kind_code', p_kind, 'source_hash', v_source ->> 'source_hash', 'artifact_id', v_artifact_id)
  );

  RETURN v_cert_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_emit_standalone_certification(
  p_certification_id uuid,
  p_artifact_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cert public.standalone_certifications%ROWTYPE;
  v_artifact_id uuid;
  v_annex_manifest jsonb;
  v_annex_manifest_hash text;
  v_uri text;
BEGIN
  SELECT *
    INTO v_cert
    FROM public.standalone_certifications
   WHERE id = p_certification_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'standalone certification not found: %', p_certification_id;
  END IF;

  PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');

  IF v_cert.status IN ('SUPERSEDED', 'REVOKED') THEN
    RAISE EXCEPTION 'certificacion % no emitible en estado %', p_certification_id, v_cert.status;
  END IF;

  v_artifact_id := COALESCE(p_artifact_id, v_cert.artifact_id);
  IF v_artifact_id IS NULL THEN
    RAISE EXCEPTION 'artifact_id requerido para emitir certificacion autonoma';
  END IF;

  UPDATE public.secretaria_document_artifacts
     SET status = CASE WHEN status IN ('SOURCE_LOCKED','DRAFT','GENERATED') THEN 'ARCHIVED' ELSE status END,
         generated_at = COALESCE(generated_at, now()),
         evidence_status = COALESCE(evidence_status, 'DEMO_OPERATIVA')
   WHERE id = v_artifact_id
     AND tenant_id = v_cert.tenant_id;

  INSERT INTO public.document_annex_links (
    tenant_id,
    artifact_id,
    linked_domain,
    linked_id,
    annex_role,
    annex_order,
    is_mandatory_annex,
    included_in_export,
    included_in_certification_bundle,
    frozen_at
  ) VALUES (
    v_cert.tenant_id,
    v_artifact_id,
    'standalone_certification',
    p_certification_id,
    'CERTIFICACION_AUTONOMA',
    1,
    true,
    true,
    true,
    now()
  )
  ON CONFLICT (tenant_id, artifact_id, linked_domain, linked_id, annex_role) DO UPDATE SET
    included_in_export = true,
    included_in_certification_bundle = true,
    frozen_at = COALESCE(public.document_annex_links.frozen_at, EXCLUDED.frozen_at);

  IF v_cert.source_domain = 'agreements' AND v_cert.source_id IS NOT NULL THEN
    INSERT INTO public.document_annex_links (
      tenant_id,
      artifact_id,
      linked_domain,
      linked_id,
      annex_role,
      annex_order,
      is_mandatory_annex,
      included_in_export,
      included_in_certification_bundle,
      frozen_at
    )
    SELECT
      link.tenant_id,
      link.artifact_id,
      'standalone_certification',
      p_certification_id,
      link.annex_role,
      link.annex_order + 1,
      link.is_mandatory_annex,
      true,
      true,
      COALESCE(link.frozen_at, now())
    FROM public.document_annex_links link
    WHERE link.tenant_id = v_cert.tenant_id
      AND link.linked_domain = 'agreement'
      AND link.linked_id = v_cert.source_id
      AND link.included_in_certification_bundle IS TRUE
      AND link.artifact_id <> v_artifact_id
    ON CONFLICT (tenant_id, artifact_id, linked_domain, linked_id, annex_role) DO UPDATE SET
      included_in_export = true,
      included_in_certification_bundle = true,
      frozen_at = COALESCE(public.document_annex_links.frozen_at, EXCLUDED.frozen_at);
  END IF;

  v_annex_manifest := public.fn_secretaria_document_annex_manifest(
    v_cert.tenant_id,
    'standalone_certification',
    p_certification_id,
    true
  );
  v_annex_manifest_hash := public.fn_secretaria_canonical_jsonb_hash(v_annex_manifest);

  UPDATE public.secretaria_document_artifacts
     SET content_hash = COALESCE(content_hash, v_cert.source_hash),
         hash_sha512 = COALESCE(
           hash_sha512,
           encode(digest(v_cert.source_hash || ':' || v_annex_manifest_hash, 'sha512'), 'hex')
         ),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'standalone_certification_id', p_certification_id,
           'annex_manifest', v_annex_manifest,
           'annex_manifest_hash', v_annex_manifest_hash,
           'annex_manifest_count', (v_annex_manifest ->> 'count')::integer
         )
   WHERE id = v_artifact_id
     AND tenant_id = v_cert.tenant_id;

  UPDATE public.standalone_certifications
     SET artifact_id = v_artifact_id,
         status = 'EMITTED',
         signature_status = CASE WHEN requires_qes THEN 'DEMO_QES_PENDING' ELSE 'DEMO_ARCHIVED' END,
         emitted_at = now()
   WHERE id = p_certification_id;

  v_uri := 'standalone_certification:' || p_certification_id::text
    || '@source=' || v_cert.source_hash
    || ';annex=' || v_annex_manifest_hash;

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_cert.tenant_id,
    'STANDALONE_CERT_EMITIDA',
    'standalone_certifications',
    p_certification_id,
    jsonb_build_object(
      'uri', v_uri,
      'source_hash', v_cert.source_hash,
      'artifact_id', v_artifact_id,
      'annex_manifest_hash', v_annex_manifest_hash,
      'annex_manifest_count', (v_annex_manifest ->> 'count')::integer,
      'qtsp', 'EAD_TRUST_DEMO'
    )
  );

  RETURN v_uri;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_supersede_standalone_certification(
  p_certification_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cert public.standalone_certifications%ROWTYPE;
BEGIN
  SELECT *
    INTO v_cert
    FROM public.standalone_certifications
   WHERE id = p_certification_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'standalone certification not found: %', p_certification_id;
  END IF;
  PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');

  UPDATE public.standalone_certifications
     SET status = 'SUPERSEDED',
         revoked_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Sustituida por nueva version')
   WHERE id = p_certification_id;

  UPDATE public.secretaria_document_artifacts
     SET status = 'SUPERSEDED'
   WHERE id = v_cert.artifact_id
     AND tenant_id = v_cert.tenant_id;

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_cert.tenant_id,
    'STANDALONE_CERT_SUPERSEDED',
    'standalone_certifications',
    p_certification_id,
    jsonb_build_object('reason', p_reason, 'source_hash', v_cert.source_hash)
  );

  RETURN p_certification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_refresh_agreement_document_requirements(
  p_agreement_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_agreement RECORD;
  v_total integer;
BEGIN
  SELECT
    a.id,
    a.tenant_id,
    a.entity_id,
    a.body_id,
    a.agreement_kind,
    a.matter_class,
    a.adoption_mode,
    a.inscribable,
    e.legal_form,
    e.jurisdiction,
    gb.body_type
  INTO v_agreement
  FROM public.agreements a
  LEFT JOIN public.entities e ON e.id = a.entity_id
  LEFT JOIN public.governing_bodies gb ON gb.id = a.body_id
  WHERE a.id = p_agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement not found: %', p_agreement_id;
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(v_agreement.tenant_id);

  WITH requirement_rows AS (
    SELECT
      v_agreement.tenant_id AS tenant_id,
      v_agreement.id AS agreement_id,
      v_agreement.agreement_kind AS matter_code,
      'CERT_ACUERDO_360'::text AS requirement_code,
      'CERTIFICACION_SOPORTE'::text AS document_kind,
      'Certificación del acuerdo'::text AS title,
      'OBLIGATORIO'::text AS required_level,
      'BLOCKING'::text AS blocking_policy,
      'CERTIFICACION'::text AS fase,
      'RRM arts. 108-109; trazabilidad TGMS/QTSP'::text AS legal_basis,
      jsonb_build_object('always', true) AS condition,
      ARRAY['CERTIFICACION','REGISTRO','EXPEDIENTE']::text[] AS annex_targets,
      jsonb_build_object('source_hash_required', true, 'qtsp', 'EAD_TRUST') AS evidence_policy,
      'CERTIFICACION_ACUERDO'::text AS template_binding_key,
      'MOTOR_LSC'::text AS source_layer,
      'fn_refresh_agreement_document_requirements@2026-06-20'::text AS source_ref,
      jsonb_build_object('reason', 'Todo acuerdo materializado debe poder certificarse con fuente y evidencia enlazada.') AS explain

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_PRECEPTIVO_MATERIA',
      'INFORME_PRECEPTIVO',
      'Informe preceptivo de la materia',
      'OBLIGATORIO_SI_APLICA',
      'OVERRIDE_REQUIRED',
      'CONVOCATORIA',
      'LSC y normativa especial aplicable por materia',
      jsonb_build_object(
        'matter_class', v_agreement.matter_class,
        'agreement_kind', v_agreement.agreement_kind,
        'applies', true
      ),
      ARRAY['CONVOCATORIA','ACTA','CERTIFICACION','REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('source_hash_required', true, 'legal_review_required', true),
      'INFORME_PRECEPTIVO:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Materia estructural/estatutaria o capital requiere informe o justificación documental previa.')
    WHERE v_agreement.matter_class IN ('ESTRUCTURAL', 'ESTATUTARIA')
       OR v_agreement.agreement_kind IN (
         'AUMENTO_CAPITAL',
         'AMPLIACION_CAPITAL',
         'REDUCCION_CAPITAL',
         'MODIFICACION_ESTATUTOS',
         'MOD_ESTATUTOS',
         'FUSION',
         'ESCISION',
         'DISOLUCION',
         'OPERACION_ESTRUCTURAL',
         'EMISION_OBLIGACIONES'
       )

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_GESTION_CUENTAS',
      'INFORME_GESTION',
      'Informe de gestión vinculado a cuentas',
      'OBLIGATORIO_SI_APLICA',
      'WARNING',
      'PRE_REUNION',
      'LSC cuentas anuales e informe de gestión cuando proceda',
      jsonb_build_object('agreement_kind', v_agreement.agreement_kind, 'applies', true),
      ARRAY['REUNION','ACTA','BOARD_PACK','EXPEDIENTE']::text[],
      jsonb_build_object('board_pack_required', true),
      'INFORME_GESTION:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'La materia de cuentas debe dejar trazabilidad del informe de gestión o de su no exigibilidad.')
    WHERE v_agreement.agreement_kind IN (
      'APROBACION_CUENTAS',
      'FORMULACION_CUENTAS',
      'CUENTAS_ANUALES',
      'INFORME_GESTION',
      'EINF'
    )

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_DOCUMENTAL_PRE_REGISTRO',
      'INFORME_DOCUMENTAL_PRE',
      'Informe documental PRE para registro',
      'RECOMENDADO',
      'WARNING',
      'REGISTRO',
      'Control interno de completitud registral',
      jsonb_build_object('inscribable', v_agreement.inscribable, 'applies', true),
      ARRAY['REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('registry_preflight', true),
      'INFORME_DOCUMENTAL_PRE:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Acuerdo inscribible: se recomienda checklist documental PRE antes de tramitación registral.')
    WHERE v_agreement.inscribable IS TRUE

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'DOCUMENTO_REGISTRAL_FINAL',
      'DOCUMENTO_REGISTRAL',
      'Documento registral final',
      'OBLIGATORIO_SI_APLICA',
      'BLOCKING',
      'REGISTRO',
      'RRM y práctica registral aplicable',
      jsonb_build_object('inscribable', v_agreement.inscribable, 'applies', true),
      ARRAY['REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('registry_receipt_required', true),
      'DOCUMENTO_REGISTRAL:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Acuerdo inscribible: el expediente debe conservar presentación/inscripción o subsanación.')
    WHERE v_agreement.inscribable IS TRUE
  )
  INSERT INTO public.agreement_document_requirements (
    tenant_id,
    agreement_id,
    matter_code,
    requirement_code,
    document_kind,
    title,
    required_level,
    blocking_policy,
    fase,
    legal_basis,
    condition,
    annex_targets,
    evidence_policy,
    template_binding_key,
    source_layer,
    source_ref,
    explain
  )
  SELECT
    tenant_id,
    agreement_id,
    matter_code,
    requirement_code,
    document_kind,
    title,
    required_level,
    blocking_policy,
    fase,
    legal_basis,
    condition,
    annex_targets,
    evidence_policy,
    template_binding_key,
    source_layer,
    source_ref,
    explain
  FROM requirement_rows
  ON CONFLICT (tenant_id, agreement_id, requirement_code, matter_code, fase) DO UPDATE SET
    document_kind = EXCLUDED.document_kind,
    title = EXCLUDED.title,
    required_level = EXCLUDED.required_level,
    blocking_policy = EXCLUDED.blocking_policy,
    legal_basis = EXCLUDED.legal_basis,
    condition = EXCLUDED.condition,
    annex_targets = EXCLUDED.annex_targets,
    evidence_policy = EXCLUDED.evidence_policy,
    template_binding_key = EXCLUDED.template_binding_key,
    source_layer = EXCLUDED.source_layer,
    source_ref = EXCLUDED.source_ref,
    explain = EXCLUDED.explain,
    updated_at = now();

  UPDATE public.agreement_document_requirements req
     SET status = 'SATISFIED',
         updated_at = now()
   WHERE req.tenant_id = v_agreement.tenant_id
     AND req.agreement_id = v_agreement.id
     AND EXISTS (
       SELECT 1
         FROM public.agreement_document_links link
         JOIN public.secretaria_document_artifacts artifact
           ON artifact.id = link.artifact_id
          AND artifact.tenant_id = link.tenant_id
        WHERE link.tenant_id = req.tenant_id
          AND link.requirement_id = req.id
          AND artifact.status IN ('SOURCE_LOCKED', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'SIGNED', 'ARCHIVED', 'ATTACHED')
     );

  SELECT count(*)
    INTO v_total
    FROM public.agreement_document_requirements req
   WHERE req.tenant_id = v_agreement.tenant_id
     AND req.agreement_id = v_agreement.id
     AND req.status <> 'SUPERSEDED';

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_agreement.tenant_id,
    'AGREEMENT_DOCUMENT_REQUIREMENTS_REFRESHED',
    'agreements',
    v_agreement.id,
    jsonb_build_object('agreement_kind', v_agreement.agreement_kind, 'requirements', v_total)
  );

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_canonical_jsonb_hash(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_can_write_document_artifacts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_document_annex_manifest(uuid, text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_document_annex_manifest_hash(uuid, text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_prepare_standalone_certification_source(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_create_standalone_certification(text, jsonb, timestamptz, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_emit_standalone_certification(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_supersede_standalone_certification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_refresh_agreement_document_requirements(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_canonical_jsonb_hash(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_can_write_document_artifacts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_document_annex_manifest(uuid, text, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_document_annex_manifest_hash(uuid, text, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_prepare_standalone_certification_source(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_standalone_certification(text, jsonb, timestamptz, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_emit_standalone_certification(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_supersede_standalone_certification(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_refresh_agreement_document_requirements(uuid) TO authenticated, service_role;
