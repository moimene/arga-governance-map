-- Secretaría — gates autoritativos de artefacto legal (acta y certificación).
--
-- Objetivo: ninguna afirmación del cliente (hash, "ok", token demo o estado UI)
-- puede producir los estados jurídicos APPROVED_SIGNED, SIGNED, EMITTED o
-- CERTIFIED. Los hechos jurídicos se derivan de datos persistidos, artefactos
-- WORM y verificaciones QTSP registradas por un contexto de servicio confiable.
--
-- Forward-only. No aplica backfill probatorio: las filas históricas firmadas se
-- clasifican LEGACY_REVIEW; las cronologías imposibles, DEMO_SIMULATION. Ambas
-- requieren remediación expresa y nunca heredan fuerza jurídica.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Attendance is a legal source fact, not a free-form UI label.  The current
-- authoritative model deliberately admits only personal attendance,
-- attendance by an evidenced representative, or absence.  Remote attendance
-- (REMOTO/TELEMATICO) needs additional evidence of identity, continuous
-- connection and the applicable statutory basis; those facts do not exist in
-- the present schema, so they fail closed instead of being silently treated as
-- personal attendance. PRESENTE is retained solely as the legacy spelling of
-- PRESENCIAL created by the original table default.
CREATE OR REPLACE FUNCTION public.fn_secretaria_canonical_attendance_type(
  p_attendance_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT CASE upper(btrim(COALESCE(p_attendance_type, '')))
    WHEN 'PRESENTE' THEN 'PRESENCIAL'
    WHEN 'PRESENCIAL' THEN 'PRESENCIAL'
    WHEN 'REPRESENTADO' THEN 'REPRESENTADO'
    WHEN 'AUSENTE' THEN 'AUSENTE'
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_canonical_attendance_type(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_canonical_attendance_type(text)
  TO authenticated, service_role;

-- The meeting agenda must carry the same legal matter and exact proposal that
-- were frozen in the emitted convocation. These are source facts, not labels
-- reconstructed later by the browser.
ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS matter_code text,
  ADD COLUMN IF NOT EXISTS proposal_text text;

-- An authoritative EAD request is bound to the exact domain source and to the
-- canonical text hash before any provider result is accepted. Legacy/general
-- requests may keep the whole tuple NULL, but partially-bound rows are invalid.
ALTER TABLE public.qtsp_signature_requests
  ADD COLUMN IF NOT EXISTS source_domain text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS artifact_kind text,
  ADD COLUMN IF NOT EXISTS content_hash_sha256 text;

ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_source_domain_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_source_domain_check
  CHECK (source_domain IS NULL OR source_domain IN ('MINUTE', 'CERTIFICATION'));
ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_artifact_kind_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_artifact_kind_check
  CHECK (artifact_kind IS NULL OR artifact_kind IN ('MINUTE_FINAL', 'CERTIFICATION_FINAL'));
ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_content_hash_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_content_hash_check
  CHECK (content_hash_sha256 IS NULL OR content_hash_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_source_binding_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_source_binding_check
  CHECK (
    (source_domain IS NULL AND source_id IS NULL AND artifact_kind IS NULL AND content_hash_sha256 IS NULL)
    OR
    (
      source_domain IS NOT NULL
      AND source_id IS NOT NULL
      AND content_hash_sha256 IS NOT NULL
      AND artifact_kind = CASE source_domain
        WHEN 'MINUTE' THEN 'MINUTE_FINAL'
        WHEN 'CERTIFICATION' THEN 'CERTIFICATION_FINAL'
      END
    )
  );

-- ---------------------------------------------------------------------------
-- 1. Manifiestos de artefacto final y verificaciones QTSP append-only
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_legal_artifacts (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  source_domain              text NOT NULL CHECK (source_domain IN ('MINUTE', 'CERTIFICATION')),
  source_id                  uuid NOT NULL,
  artifact_kind              text NOT NULL CHECK (artifact_kind IN ('MINUTE_FINAL', 'CERTIFICATION_FINAL')),
  content_hash_sha256        text NOT NULL CHECK (content_hash_sha256 ~ '^[0-9a-f]{64}$'),
  binary_hash_sha256         text NOT NULL CHECK (binary_hash_sha256 ~ '^[0-9a-f]{64}$'),
  binary_hash_sha512         text NOT NULL CHECK (binary_hash_sha512 ~ '^[0-9a-f]{128}$'),
  signature_packaging        text NOT NULL
    CHECK (signature_packaging IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION')),
  evidence_bundle_id         uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  evidence_manifest_hash     text NOT NULL CHECK (evidence_manifest_hash ~ '^[0-9a-f]{64}$'),
  server_manifest            jsonb NOT NULL,
  server_manifest_hash       text NOT NULL CHECK (server_manifest_hash ~ '^[0-9a-f]{64}$'),
  artifact_status            text NOT NULL DEFAULT 'FINAL_IMMUTABLE'
    CHECK (artifact_status IN ('FINAL_IMMUTABLE', 'REVOKED')),
  immutable_at               timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_domain, source_id, artifact_kind, content_hash_sha256, binary_hash_sha512),
  UNIQUE (tenant_id, evidence_bundle_id)
);

CREATE INDEX IF NOT EXISTS ix_secretaria_legal_artifacts_source
  ON public.secretaria_legal_artifacts(tenant_id, source_domain, source_id, immutable_at DESC);

CREATE TABLE IF NOT EXISTS public.secretaria_qtsp_verifications (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  legal_artifact_id            uuid NOT NULL REFERENCES public.secretaria_legal_artifacts(id) ON DELETE RESTRICT,
  signature_request_id         uuid NOT NULL REFERENCES public.qtsp_signature_requests(id) ON DELETE RESTRICT,
  signer_person_id             uuid NOT NULL REFERENCES public.persons(id) ON DELETE RESTRICT,
  signer_role                  text NOT NULL CHECK (signer_role IN ('PRESIDENTE', 'SECRETARIO', 'CERTIFICANTE', 'VISTO_BUENO')),
  provider                     text NOT NULL CHECK (provider = 'EAD_TRUST'),
  provider_signature_type      text NOT NULL CHECK (provider_signature_type IN ('INTERPOSITION', 'ADVANCED')),
  signature_packaging          text NOT NULL
    CHECK (signature_packaging IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION')),
  provider_reference           text NOT NULL CHECK (length(btrim(provider_reference)) > 0),
  provider_evidence_bundle_id  uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  certificate_fingerprint_sha256 text
    CHECK (certificate_fingerprint_sha256 IS NULL OR certificate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  request_input_hash_sha256      text NOT NULL
    CHECK (request_input_hash_sha256 ~ '^[0-9a-f]{64}$'),
  signed_output_hash_sha256      text NOT NULL
    CHECK (signed_output_hash_sha256 ~ '^[0-9a-f]{64}$'),
  signed_output_hash_sha512      text NOT NULL
    CHECK (signed_output_hash_sha512 ~ '^[0-9a-f]{128}$'),
  verification_status          text NOT NULL CHECK (verification_status = 'VERIFIED'),
  verification_payload         jsonb NOT NULL,
  verified_at                  timestamptz NOT NULL,
  verified_by                  uuid,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_artifact_id, signer_role, signer_person_id),
  UNIQUE (tenant_id, provider, provider_reference)
);

CREATE INDEX IF NOT EXISTS ix_secretaria_qtsp_verifications_artifact
  ON public.secretaria_qtsp_verifications(tenant_id, legal_artifact_id, signer_role);

CREATE OR REPLACE FUNCTION public.fn_secretaria_qtsp_request_source_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.source_domain IS NOT NULL THEN
      RAISE EXCEPTION 'source-bound EAD requests are retained legal evidence'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.source_domain IS DISTINCT FROM OLD.source_domain
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
    OR NEW.content_hash_sha256 IS DISTINCT FROM OLD.content_hash_sha256
    OR NEW.document_hash IS DISTINCT FROM OLD.document_hash
    OR NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.signatories IS DISTINCT FROM OLD.signatories
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
  ) THEN
    RAISE EXCEPTION 'EAD request source, input hash and signatory census are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.source_domain IS NOT NULL THEN
    IF NEW.document_hash !~ '^[0-9a-f]{64}$'
       OR NEW.requested_at IS NULL
       OR jsonb_typeof(NEW.signatories) <> 'array'
       OR jsonb_array_length(NEW.signatories) = 0
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(NEW.signatories) signer
         WHERE signer ->> 'source_domain' IS DISTINCT FROM NEW.source_domain
            OR signer ->> 'source_id' IS DISTINCT FROM NEW.source_id::text
            OR signer ->> 'artifact_kind' IS DISTINCT FROM NEW.artifact_kind
            OR lower(COALESCE(signer ->> 'content_hash_sha256', ''))
                 IS DISTINCT FROM NEW.content_hash_sha256
            OR COALESCE(btrim(signer ->> 'person_id'), '') = ''
            OR upper(COALESCE(signer ->> 'signer_role', '')) NOT IN (
              'PRESIDENTE', 'SECRETARIO', 'CERTIFICANTE', 'VISTO_BUENO'
            )
            OR COALESCE(btrim(signer ->> 'authority_evidence_id'), '') = ''
       )
    THEN
      RAISE EXCEPTION 'authoritative EAD request lacks exact source/hash/signatory binding';
    END IF;
    IF NEW.completed_at IS NOT NULL AND NEW.completed_at < NEW.requested_at THEN
      RAISE EXCEPTION 'authoritative EAD request completion precedes its request';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_qtsp_signature_requests_source_guard
  ON public.qtsp_signature_requests;
CREATE TRIGGER trg_qtsp_signature_requests_source_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.qtsp_signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_qtsp_request_source_guard();

COMMENT ON COLUMN public.qtsp_signature_requests.document_hash IS
  'SHA-256 del binario de entrada enviado a EAD antes de firmar; nunca es el hash del output firmado.';
COMMENT ON COLUMN public.secretaria_legal_artifacts.binary_hash_sha256 IS
  'SHA-256 del binario legal final recuperado y e-archivado. Puede coincidir con la entrada cuando EAD acredita una firma detached o una atestación del proveedor.';
COMMENT ON COLUMN public.secretaria_legal_artifacts.binary_hash_sha512 IS
  'SHA-512 del binario legal final recuperado y e-archivado.';
COMMENT ON COLUMN public.secretaria_legal_artifacts.signature_packaging IS
  'ENVELOPED cuando la firma altera el binario; DETACHED o PROVIDER_ATTESTATION cuando la prueba EAD queda separada y el binario puede conservar su hash.';
COMMENT ON COLUMN public.secretaria_qtsp_verifications.request_input_hash_sha256 IS
  'SHA-256 de entrada copiado de qtsp_signature_requests.document_hash.';
COMMENT ON COLUMN public.secretaria_qtsp_verifications.signed_output_hash_sha256 IS
  'SHA-256 del binario legal final; la diferencia frente a la entrada depende del empaquetado real.';
COMMENT ON COLUMN public.secretaria_qtsp_verifications.signed_output_hash_sha512 IS
  'SHA-512 del output firmado, igual al artefacto legal final y al bundle de firma.';
COMMENT ON COLUMN public.secretaria_qtsp_verifications.signature_packaging IS
  'Empaquetado realmente acreditado por EAD. INTERPOSITION no implica por sí sola que el binario cambie.';

ALTER TABLE public.secretaria_legal_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_qtsp_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_legal_artifacts_read ON public.secretaria_legal_artifacts;
CREATE POLICY secretaria_legal_artifacts_read
  ON public.secretaria_legal_artifacts FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

DROP POLICY IF EXISTS secretaria_qtsp_verifications_read ON public.secretaria_qtsp_verifications;
CREATE POLICY secretaria_qtsp_verifications_read
  ON public.secretaria_qtsp_verifications FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

REVOKE ALL ON TABLE public.secretaria_legal_artifacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_qtsp_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_legal_artifacts TO authenticated, service_role;
GRANT SELECT ON TABLE public.secretaria_qtsp_verifications TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_authoritative_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'authoritative legal evidence is append-only'
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_legal_artifacts_append_only
  ON public.secretaria_legal_artifacts;
CREATE TRIGGER trg_secretaria_legal_artifacts_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_legal_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_append_only_guard();

DROP TRIGGER IF EXISTS trg_secretaria_qtsp_verifications_append_only
  ON public.secretaria_qtsp_verifications;
CREATE TRIGGER trg_secretaria_qtsp_verifications_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_qtsp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_append_only_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_authoritative_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is an append-only legal domain record; governed cancellation must preserve the row',
      TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('app.secretaria_authoritative_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'authoritative legal evidence: insert only through governed RPC'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_legal_artifacts_insert_guard
  ON public.secretaria_legal_artifacts;
CREATE TRIGGER trg_secretaria_legal_artifacts_insert_guard
  BEFORE INSERT ON public.secretaria_legal_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_insert_guard();

DROP TRIGGER IF EXISTS trg_secretaria_qtsp_verifications_insert_guard
  ON public.secretaria_qtsp_verifications;
CREATE TRIGGER trg_secretaria_qtsp_verifications_insert_guard
  BEFORE INSERT ON public.secretaria_qtsp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_insert_guard();

-- ---------------------------------------------------------------------------
-- 2. Estado autoritativo en actas y certificaciones
-- ---------------------------------------------------------------------------

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS authoritative_manifest jsonb,
  ADD COLUMN IF NOT EXISTS authoritative_manifest_hash text,
  ADD COLUMN IF NOT EXISTS final_legal_artifact_id uuid
    REFERENCES public.secretaria_legal_artifacts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approval_method text,
  ADD COLUMN IF NOT EXISTS approval_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS president_consent_verification_id uuid
    REFERENCES public.secretaria_qtsp_verifications(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS secretary_consent_verification_id uuid
    REFERENCES public.secretaria_qtsp_verifications(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS legal_gate_status text NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_authoritative_manifest_hash_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_authoritative_manifest_hash_check
  CHECK (authoritative_manifest_hash IS NULL OR authoritative_manifest_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_approval_method_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_approval_method_check
  CHECK (approval_method IS NULL OR approval_method IN ('AL_FINAL_SESION', 'DENTRO_15_DIAS', 'POR_ACTA_NOTARIAL'));
ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_legal_gate_status_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_legal_gate_status_check
  CHECK (legal_gate_status IN (
    'DRAFT', 'MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED',
    'LEGACY_REVIEW', 'DEMO_SIMULATION'
  ));

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS final_legal_artifact_id uuid
    REFERENCES public.secretaria_legal_artifacts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS authoritative_manifest jsonb,
  ADD COLUMN IF NOT EXISTS authoritative_manifest_hash text,
  ADD COLUMN IF NOT EXISTS certifier_qtsp_verification_id uuid
    REFERENCES public.secretaria_qtsp_verifications(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS visto_bueno_qtsp_verification_id uuid
    REFERENCES public.secretaria_qtsp_verifications(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS content_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS agreements_manifest_hash text,
  ADD COLUMN IF NOT EXISTS required_ead_signature_type text NOT NULL DEFAULT 'INTERPOSITION',
  ADD COLUMN IF NOT EXISTS verified_ead_signature_type text,
  ADD COLUMN IF NOT EXISTS emitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_gate_status text NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_content_hash_sha256_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_content_hash_sha256_check
  CHECK (content_hash_sha256 IS NULL OR content_hash_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_authoritative_manifest_hash_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_authoritative_manifest_hash_check
  CHECK (authoritative_manifest_hash IS NULL OR authoritative_manifest_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_agreements_manifest_hash_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_agreements_manifest_hash_check
  CHECK (agreements_manifest_hash IS NULL OR agreements_manifest_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_required_ead_signature_type_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_required_ead_signature_type_check
  CHECK (required_ead_signature_type IN ('INTERPOSITION', 'ADVANCED'));
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_verified_ead_signature_type_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_verified_ead_signature_type_check
  CHECK (verified_ead_signature_type IS NULL OR verified_ead_signature_type IN ('INTERPOSITION', 'ADVANCED'));
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_legal_gate_status_check;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_legal_gate_status_check
  CHECK (legal_gate_status IN (
    'DRAFT', 'ARTIFACT_FINAL', 'SIGNATURE_VERIFIED', 'EMITTED',
    'LEGACY_REVIEW', 'DEMO_SIMULATION'
  ));

COMMENT ON COLUMN public.certifications.requires_qualified_signature IS
  'Legacy deprecated flag. New authoritative certifications set false; required_ead_signature_type is the operative EAD gate.';
COMMENT ON COLUMN public.certifications.required_ead_signature_type IS
  'Minimum accepted EAD assurance: INTERPOSITION (default) or ADVANCED; the real provider type is persisted.';

-- No se altera ni borra ningún campo histórico. Solo se clasifica su fuerza
-- probatoria: una firma anterior al inicio/fin de la sesión, o sobre una sesión
-- todavía futura, es simulación demo y nunca puede heredarse como hecho legal.
UPDATE public.minutes minute
   SET legal_gate_status = CASE
     WHEN meeting.scheduled_start > now()
       OR minute.signed_at < meeting.scheduled_start
       OR (
         meeting.scheduled_end IS NOT NULL
         AND minute.signed_at < meeting.scheduled_end
       )
       THEN 'DEMO_SIMULATION'
     ELSE 'LEGACY_REVIEW'
   END
  FROM public.meetings meeting
 WHERE meeting.id = minute.meeting_id
   AND meeting.tenant_id = minute.tenant_id
   AND minute.signed_at IS NOT NULL
   AND minute.legal_gate_status = 'DRAFT';

UPDATE public.certifications certification
   SET legal_gate_status = CASE
     WHEN minute.legal_gate_status = 'DEMO_SIMULATION' THEN 'DEMO_SIMULATION'
     ELSE 'LEGACY_REVIEW'
   END
  FROM public.minutes minute
 WHERE minute.id = certification.minute_id
   AND minute.tenant_id = certification.tenant_id
   AND certification.signature_status = 'SIGNED'
   AND certification.legal_gate_status = 'DRAFT';

CREATE UNIQUE INDEX IF NOT EXISTS ux_minutes_final_legal_artifact
  ON public.minutes(final_legal_artifact_id)
  WHERE final_legal_artifact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_certifications_final_legal_artifact
  ON public.certifications(final_legal_artifact_id)
  WHERE final_legal_artifact_id IS NOT NULL;

-- Solo las RPC de este lote pueden promover estados o enlazar evidencia final.
CREATE OR REPLACE FUNCTION public.fn_secretaria_authoritative_domain_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authoritative_writer boolean :=
    COALESCE(current_setting('app.secretaria_authoritative_rpc', true), '') = '1';
  v_book_writer boolean :=
    COALESCE(current_setting('app.secretaria_book_entries_rpc', true), '') = '1';
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is a retained legal-domain record; governed correction must preserve the row',
      TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION '% identity and tenant scope are immutable', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_authoritative_writer THEN
    IF TG_TABLE_NAME = 'minutes' AND (
      NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
      OR NEW.signed_by_secretary_id IS DISTINCT FROM OLD.signed_by_secretary_id
      OR NEW.signed_by_president_id IS DISTINCT FROM OLD.signed_by_president_id
      OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
      OR NEW.snapshot_id IS DISTINCT FROM OLD.snapshot_id
      OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.canonical_minutes_hash IS DISTINCT FROM OLD.canonical_minutes_hash
      OR NEW.rules_applied IS DISTINCT FROM OLD.rules_applied
      OR NEW.body_id IS DISTINCT FROM OLD.body_id
      OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
      OR NEW.legal_structure_validation IS DISTINCT FROM OLD.legal_structure_validation
      OR NEW.final_legal_artifact_id IS DISTINCT FROM OLD.final_legal_artifact_id
      OR NEW.authoritative_manifest IS DISTINCT FROM OLD.authoritative_manifest
      OR NEW.authoritative_manifest_hash IS DISTINCT FROM OLD.authoritative_manifest_hash
      OR NEW.approval_method IS DISTINCT FROM OLD.approval_method
      OR NEW.approval_effective_at IS DISTINCT FROM OLD.approval_effective_at
      OR NEW.president_consent_verification_id IS DISTINCT FROM OLD.president_consent_verification_id
      OR NEW.secretary_consent_verification_id IS DISTINCT FROM OLD.secretary_consent_verification_id
      OR NEW.legal_gate_status IS DISTINCT FROM OLD.legal_gate_status
    ) THEN
      RAISE EXCEPTION 'minutes legal facts: governed authoritative RPC required'
        USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'certifications' AND (
      NEW.minute_id IS DISTINCT FROM OLD.minute_id
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.agreements_certified IS DISTINCT FROM OLD.agreements_certified
      OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
      OR NEW.certifier_id IS DISTINCT FROM OLD.certifier_id
      OR NEW.tipo_certificacion IS DISTINCT FROM OLD.tipo_certificacion
      OR NEW.certificante_role IS DISTINCT FROM OLD.certificante_role
      OR NEW.visto_bueno_persona_id IS DISTINCT FROM OLD.visto_bueno_persona_id
      OR NEW.visto_bueno_fecha IS DISTINCT FROM OLD.visto_bueno_fecha
      OR NEW.evidence_id IS DISTINCT FROM OLD.evidence_id
      OR NEW.hash_sha512 IS DISTINCT FROM OLD.hash_sha512
      OR NEW.gate_hash IS DISTINCT FROM OLD.gate_hash
      OR NEW.hash_certificacion IS DISTINCT FROM OLD.hash_certificacion
      OR NEW.authority_evidence_id IS DISTINCT FROM OLD.authority_evidence_id
      OR NEW.final_legal_artifact_id IS DISTINCT FROM OLD.final_legal_artifact_id
      OR NEW.authoritative_manifest IS DISTINCT FROM OLD.authoritative_manifest
      OR NEW.authoritative_manifest_hash IS DISTINCT FROM OLD.authoritative_manifest_hash
      OR NEW.certifier_qtsp_verification_id IS DISTINCT FROM OLD.certifier_qtsp_verification_id
      OR NEW.visto_bueno_qtsp_verification_id IS DISTINCT FROM OLD.visto_bueno_qtsp_verification_id
      OR NEW.content_hash_sha256 IS DISTINCT FROM OLD.content_hash_sha256
      OR NEW.agreements_manifest_hash IS DISTINCT FROM OLD.agreements_manifest_hash
      OR NEW.required_ead_signature_type IS DISTINCT FROM OLD.required_ead_signature_type
      OR NEW.verified_ead_signature_type IS DISTINCT FROM OLD.verified_ead_signature_type
      OR NEW.emitted_at IS DISTINCT FROM OLD.emitted_at
      OR NEW.legal_gate_status IS DISTINCT FROM OLD.legal_gate_status
      OR NEW.signature_status IS DISTINCT FROM OLD.signature_status
    ) THEN
      RAISE EXCEPTION 'certifications legal facts: governed authoritative RPC required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'minutes' THEN
    IF NOT v_book_writer AND (
      NEW.registered_at IS DISTINCT FROM OLD.registered_at
      OR NEW.book_section_id IS DISTINCT FROM OLD.book_section_id
      OR NEW.book_entry_id IS DISTINCT FROM OLD.book_entry_id
      OR NEW.book_destination_status IS DISTINCT FROM OLD.book_destination_status
      OR NEW.book_destination_resolved_at IS DISTINCT FROM OLD.book_destination_resolved_at
    ) THEN
      RAISE EXCEPTION 'minute book routing/posting fields: governed book RPC required'
        USING ERRCODE = '42501';
    END IF;

    -- Once the candidate is reconciled with the signed EAD output, its source
    -- facts can never be swapped, even by another SECURITY DEFINER routine.
    IF OLD.legal_gate_status IN ('ARTIFACT_FINAL', 'APPROVED_SIGNED') AND (
      NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.snapshot_id IS DISTINCT FROM OLD.snapshot_id
      OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.canonical_minutes_hash IS DISTINCT FROM OLD.canonical_minutes_hash
      OR NEW.rules_applied IS DISTINCT FROM OLD.rules_applied
      OR NEW.body_id IS DISTINCT FROM OLD.body_id
      OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
      OR NEW.legal_structure_validation IS DISTINCT FROM OLD.legal_structure_validation
      OR NEW.final_legal_artifact_id IS DISTINCT FROM OLD.final_legal_artifact_id
      OR NEW.authoritative_manifest IS DISTINCT FROM OLD.authoritative_manifest
      OR NEW.authoritative_manifest_hash IS DISTINCT FROM OLD.authoritative_manifest_hash
    ) THEN
      RAISE EXCEPTION 'minute core facts are bound to an immutable final artifact';
    END IF;

    IF OLD.legal_gate_status = 'APPROVED_SIGNED' AND (
      NEW.signed_at IS DISTINCT FROM OLD.signed_at
      OR NEW.signed_by_secretary_id IS DISTINCT FROM OLD.signed_by_secretary_id
      OR NEW.signed_by_president_id IS DISTINCT FROM OLD.signed_by_president_id
      OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
      OR NEW.approval_method IS DISTINCT FROM OLD.approval_method
      OR NEW.approval_effective_at IS DISTINCT FROM OLD.approval_effective_at
      OR NEW.president_consent_verification_id IS DISTINCT FROM OLD.president_consent_verification_id
      OR NEW.secretary_consent_verification_id IS DISTINCT FROM OLD.secretary_consent_verification_id
      OR NEW.legal_gate_status IS DISTINCT FROM OLD.legal_gate_status
    ) THEN
      RAISE EXCEPTION 'approved minute signature and approval facts are immutable';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'certifications' THEN
    IF OLD.legal_gate_status IN ('ARTIFACT_FINAL', 'SIGNATURE_VERIFIED', 'EMITTED') AND (
      NEW.minute_id IS DISTINCT FROM OLD.minute_id
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.agreements_certified IS DISTINCT FROM OLD.agreements_certified
      OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
      OR NEW.certifier_id IS DISTINCT FROM OLD.certifier_id
      OR NEW.tipo_certificacion IS DISTINCT FROM OLD.tipo_certificacion
      OR NEW.certificante_role IS DISTINCT FROM OLD.certificante_role
      OR NEW.visto_bueno_persona_id IS DISTINCT FROM OLD.visto_bueno_persona_id
      OR NEW.gate_hash IS DISTINCT FROM OLD.gate_hash
      OR NEW.authority_evidence_id IS DISTINCT FROM OLD.authority_evidence_id
      OR NEW.final_legal_artifact_id IS DISTINCT FROM OLD.final_legal_artifact_id
      OR NEW.authoritative_manifest IS DISTINCT FROM OLD.authoritative_manifest
      OR NEW.authoritative_manifest_hash IS DISTINCT FROM OLD.authoritative_manifest_hash
      OR NEW.content_hash_sha256 IS DISTINCT FROM OLD.content_hash_sha256
      OR NEW.agreements_manifest_hash IS DISTINCT FROM OLD.agreements_manifest_hash
      OR NEW.required_ead_signature_type IS DISTINCT FROM OLD.required_ead_signature_type
    ) THEN
      RAISE EXCEPTION 'certification core facts are bound to an immutable final artifact';
    END IF;

    IF OLD.legal_gate_status = 'EMITTED'
       AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'emitted certification is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_minutes_authoritative_domain_guard ON public.minutes;
CREATE TRIGGER trg_minutes_authoritative_domain_guard
  BEFORE UPDATE OR DELETE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_domain_guard();

DROP TRIGGER IF EXISTS trg_certifications_authoritative_domain_guard ON public.certifications;
CREATE TRIGGER trg_certifications_authoritative_domain_guard
  BEFORE UPDATE OR DELETE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_domain_guard();

-- The domain rows themselves are also RPC-only. Otherwise an authenticated
-- tenant member could INSERT an already signed/emitted state and bypass every
-- transition guard (UPDATE triggers do not run on INSERT).
DROP TRIGGER IF EXISTS trg_minutes_authoritative_insert_guard ON public.minutes;
CREATE TRIGGER trg_minutes_authoritative_insert_guard
  BEFORE INSERT ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_insert_guard();

DROP TRIGGER IF EXISTS trg_certifications_authoritative_insert_guard ON public.certifications;
CREATE TRIGGER trg_certifications_authoritative_insert_guard
  BEFORE INSERT ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_insert_guard();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.minutes, public.certifications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.minutes, public.certifications
  TO authenticated, service_role;

-- Once a minute manifest exists, the meeting facts from which it was rendered
-- are frozen as a unit. Without this guard an attendee, vote or literal could
-- be changed after approval while the already-issued document remained valid.
CREATE OR REPLACE FUNCTION public.fn_secretaria_freeze_minute_source_facts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'meetings' THEN
    v_meeting_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSIF TG_TABLE_NAME = 'meeting_votes' THEN
    SELECT resolution.meeting_id INTO v_meeting_id
    FROM public.meeting_resolutions resolution
    WHERE resolution.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.resolution_id ELSE NEW.resolution_id END;
  ELSIF TG_TABLE_NAME = 'agreements' THEN
    v_meeting_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.parent_meeting_id ELSE NEW.parent_meeting_id END;
  ELSE
    v_meeting_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.meeting_id ELSE NEW.meeting_id END;
  END IF;

  IF v_meeting_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.minutes minute
    WHERE minute.meeting_id = v_meeting_id
      AND minute.legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED')
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Agreement workflow status may advance after adoption, but its source,
  -- agenda binding and literal text may never drift after the minute exists.
  IF TG_TABLE_NAME = 'agreements' AND TG_OP = 'UPDATE' AND (
    NEW.parent_meeting_id IS NOT DISTINCT FROM OLD.parent_meeting_id
    AND NEW.agenda_item_id IS NOT DISTINCT FROM OLD.agenda_item_id
    AND NEW.proposal_text IS NOT DISTINCT FROM OLD.proposal_text
    AND NEW.decision_text IS NOT DISTINCT FROM OLD.decision_text
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '% facts are frozen by the authoritative minute manifest', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_freeze_minute_source_meeting ON public.meetings;
CREATE TRIGGER trg_freeze_minute_source_meeting
  BEFORE UPDATE OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_agenda ON public.agenda_items;
CREATE TRIGGER trg_freeze_minute_source_agenda
  BEFORE INSERT OR UPDATE OR DELETE ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_attendees ON public.meeting_attendees;
CREATE TRIGGER trg_freeze_minute_source_attendees
  BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_votes ON public.meeting_votes;
CREATE TRIGGER trg_freeze_minute_source_votes
  BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_resolutions ON public.meeting_resolutions;
CREATE TRIGGER trg_freeze_minute_source_resolutions
  BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_constancias ON public.agenda_item_constancias;
CREATE TRIGGER trg_freeze_minute_source_constancias
  BEFORE INSERT OR UPDATE OR DELETE ON public.agenda_item_constancias
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

DROP TRIGGER IF EXISTS trg_freeze_minute_source_agreements ON public.agreements;
CREATE TRIGGER trg_freeze_minute_source_agreements
  BEFORE INSERT OR UPDATE OR DELETE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_freeze_minute_source_facts();

-- ---------------------------------------------------------------------------
-- 3. Manifiesto de acta recompuesto exclusivamente por el servidor
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_build_minute_legal_manifest(
  p_meeting_id uuid,
  p_snapshot_id uuid,
  p_content_hash_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_meeting record;
  v_snapshot record;
  v_convocatoria record;
  v_convocatoria_ref text;
  v_convocatoria_id uuid;
  v_is_universal boolean;
  v_is_junta boolean;
  v_is_board boolean;
  v_quorum_reached boolean;
  v_universal_capital numeric;
  v_census_person_count integer;
  v_required_present_count integer;
  v_server_present_count integer;
  v_server_present_weight numeric;
  v_server_total_weight numeric;
  v_agenda_count integer;
  v_agenda_distinct integer;
  v_agenda_min integer;
  v_agenda_max integer;
  v_decision_count integer;
  v_resolution_count integer;
  v_attendee_count integer;
  v_present_count integer;
  v_agenda jsonb;
  v_resolutions jsonb;
  v_constancias jsonb;
  v_attendees jsonb;
  v_annual_accounts jsonb;
  v_convocatoria_manifest jsonb;
BEGIN
  IF p_meeting_id IS NULL OR p_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'authoritative minute manifest requires meeting and census snapshot';
  END IF;
  IF p_content_hash_sha256 IS NULL
     OR p_content_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'authoritative minute manifest requires server SHA-256 content hash';
  END IF;

  SELECT
    m.*,
    gb.entity_id AS resolved_entity_id,
    gb.name AS resolved_body_name,
    gb.body_type AS resolved_body_type,
    e.legal_name AS resolved_entity_name,
    e.registration_number AS resolved_entity_tax_id,
    e.legal_form AS resolved_legal_form,
    e.es_cotizada AS resolved_listed,
    president.full_name AS resolved_president_name,
    president.tax_id AS resolved_president_tax_id,
    secretary.full_name AS resolved_secretary_name,
    secretary.tax_id AS resolved_secretary_tax_id
  INTO v_meeting
  FROM public.meetings m
  JOIN public.governing_bodies gb
    ON gb.id = m.body_id
   AND gb.tenant_id = m.tenant_id
  JOIN public.entities e
    ON e.id = gb.entity_id
   AND e.tenant_id = m.tenant_id
  LEFT JOIN public.persons president
    ON president.id = m.president_id
   AND president.tenant_id = m.tenant_id
  LEFT JOIN public.persons secretary
    ON secretary.id = m.secretary_id
   AND secretary.tenant_id = m.tenant_id
  WHERE m.id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative minute: meeting % not found or scope mismatch', p_meeting_id;
  END IF;

  IF v_meeting.status <> 'CELEBRADA' THEN
    RAISE EXCEPTION 'authoritative minute: meeting % must be closed as CELEBRADA before minute generation, status=%',
      p_meeting_id, v_meeting.status;
  END IF;
  IF v_meeting.president_id IS NULL OR v_meeting.secretary_id IS NULL THEN
    RAISE EXCEPTION 'authoritative minute: meeting requires attributed president and secretary';
  END IF;
  IF v_meeting.scheduled_start IS NULL
     OR v_meeting.scheduled_end IS NULL
     OR v_meeting.scheduled_end < v_meeting.scheduled_start
     OR COALESCE(btrim(v_meeting.location), '') = '' THEN
    RAISE EXCEPTION 'authoritative minute: meeting requires coherent start/end timestamps and location';
  END IF;
  IF v_meeting.scheduled_start > now()
     OR v_meeting.scheduled_end > now() THEN
    RAISE EXCEPTION 'authoritative minute: a future or still-open meeting cannot produce legal minutes';
  END IF;

  IF COALESCE(btrim(v_meeting.resolved_entity_name), '') = ''
     OR COALESCE(btrim(v_meeting.resolved_entity_tax_id), '') = ''
     OR COALESCE(btrim(v_meeting.resolved_body_name), '') = ''
     OR COALESCE(btrim(v_meeting.resolved_president_name), '') = ''
     OR COALESCE(btrim(v_meeting.resolved_secretary_name), '') = '' THEN
    RAISE EXCEPTION 'authoritative minute: entity, tax id, body and meeting officers require identified legal names';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_meeting.tenant_id
      AND ae.entity_id = v_meeting.resolved_entity_id
      AND ae.body_id = v_meeting.body_id
      AND ae.person_id = v_meeting.president_id
      AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
      AND ae.fecha_inicio <= v_meeting.scheduled_start::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_meeting.scheduled_start::date)
      AND COALESCE(btrim(ae.fuente_designacion), '') <> ''
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_meeting.tenant_id
      AND ae.entity_id = v_meeting.resolved_entity_id
      AND ae.body_id = v_meeting.body_id
      AND ae.person_id = v_meeting.secretary_id
      AND ae.cargo IN ('SECRETARIO', 'VICESECRETARIO')
      AND ae.fecha_inicio <= v_meeting.scheduled_start::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_meeting.scheduled_start::date)
      AND COALESCE(btrim(ae.fuente_designacion), '') <> ''
  ) THEN
    RAISE EXCEPTION 'authoritative minute: attributed chair and secretary lack authority at the meeting date';
  END IF;

  SELECT
    cs.*,
    al.hash_sha512 AS audit_hash_sha512
  INTO v_snapshot
  FROM public.censo_snapshot cs
  JOIN public.audit_log al
    ON al.id = cs.audit_worm_id
   AND al.tenant_id = cs.tenant_id
  WHERE cs.id = p_snapshot_id
    AND cs.meeting_id = p_meeting_id
    AND cs.tenant_id = v_meeting.tenant_id
    AND cs.entity_id = v_meeting.resolved_entity_id
    AND cs.body_id IS NOT DISTINCT FROM v_meeting.body_id
    AND cs.session_kind = 'MEETING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative minute: census snapshot does not match meeting/tenant/entity/body';
  END IF;
  IF v_snapshot.audit_worm_id IS NULL
     OR v_snapshot.audit_hash_sha512 IS NULL
     OR v_snapshot.audit_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR v_snapshot.total_partes <= 0
     OR jsonb_typeof(v_snapshot.payload) <> 'array'
     OR jsonb_array_length(v_snapshot.payload) = 0 THEN
    RAISE EXCEPTION 'authoritative minute: census snapshot is empty or lacks WORM evidence';
  END IF;

  v_is_universal :=
    COALESCE((v_meeting.quorum_data ->> 'is_universal')::boolean, false)
    OR COALESCE((v_meeting.quorum_data ->> 'junta_universal')::boolean, false)
    OR COALESCE((v_meeting.quorum_data ->> 'organo_universal')::boolean, false)
    OR v_snapshot.snapshot_type = 'UNIVERSAL';
  v_is_junta := upper(COALESCE(v_meeting.resolved_body_type, v_meeting.meeting_type, ''))
    LIKE '%JUNTA%';
  v_is_board := NOT v_is_junta AND (
    upper(COALESCE(v_meeting.resolved_body_type, v_meeting.meeting_type, '')) LIKE '%CONSEJO%'
    OR upper(COALESCE(v_meeting.resolved_body_type, v_meeting.meeting_type, '')) IN ('CDA', 'CONSEJO_ADMIN')
  );

  -- The present prototype can issue authoritative minutes for a political
  -- collegial census (CdA). Economic/Junta and universal sessions remain
  -- explicitly closed until their individual capital/acceptance evidence is
  -- persisted; client booleans are never a substitute for that evidence.
  IF v_is_universal THEN
    RAISE EXCEPTION
      'authoritative minute: universal sessions require individual WORM agenda acceptances; a quorum_data boolean is not evidence';
  END IF;
  IF v_is_junta THEN
    RAISE EXCEPTION
      'authoritative minute: economic Junta quorum requires the dedicated capital evaluator before legal finalization';
  END IF;
  IF v_snapshot.snapshot_type <> 'POLITICO' THEN
    RAISE EXCEPTION 'authoritative minute: collegial body requires a POLITICO census snapshot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_snapshot.payload) item
    WHERE COALESCE(item ->> 'person_id', '')
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR lower(COALESCE(item ->> 'voting_rights', 'true')) NOT IN ('true', 'false')
  ) THEN
    RAISE EXCEPTION 'authoritative minute: political census contains an invalid person/voting row';
  END IF;

  WITH census_people AS (
    SELECT
      (item ->> 'person_id')::uuid AS person_id,
      sum(
        CASE WHEN lower(COALESCE(item ->> 'voting_rights', 'true')) = 'true'
          THEN COALESCE(NULLIF(item ->> 'voting_weight', '')::numeric, 1)
          ELSE 0
        END
      ) AS voting_weight
    FROM jsonb_array_elements(v_snapshot.payload) item
    GROUP BY (item ->> 'person_id')::uuid
  )
  SELECT count(*), COALESCE(sum(voting_weight), 0)
    INTO v_census_person_count, v_server_total_weight
    FROM census_people;

  IF v_census_person_count <> v_snapshot.total_partes
     OR v_census_person_count <> jsonb_array_length(v_snapshot.payload)
     OR v_server_total_weight <= 0 THEN
    RAISE EXCEPTION 'authoritative minute: political census denominator/uniqueness mismatch';
  END IF;

  SELECT count(*), count(DISTINCT ma.person_id)
    INTO v_attendee_count, v_present_count
    FROM public.meeting_attendees ma
   WHERE ma.meeting_id = p_meeting_id
     AND ma.tenant_id = v_meeting.tenant_id;
  IF v_attendee_count = 0
     OR v_attendee_count <> v_present_count
     OR EXISTS (
       SELECT 1 FROM public.meeting_attendees ma
        WHERE ma.meeting_id = p_meeting_id
          AND ma.tenant_id = v_meeting.tenant_id
          AND (
            ma.person_id IS NULL
            OR public.fn_secretaria_canonical_attendance_type(ma.attendance_type) IS NULL
          )
     ) THEN
    RAISE EXCEPTION 'authoritative minute: attendees require one valid row per identified person';
  END IF;

  -- Every political seat must be represented exactly once in attendance.
  IF EXISTS (
    WITH census_people AS (
      SELECT DISTINCT (item ->> 'person_id')::uuid AS person_id
      FROM jsonb_array_elements(v_snapshot.payload) item
    )
    SELECT 1
    FROM census_people cp
    LEFT JOIN public.meeting_attendees ma
      ON ma.meeting_id = p_meeting_id
     AND ma.tenant_id = v_meeting.tenant_id
     AND ma.person_id = cp.person_id
    WHERE ma.id IS NULL
  ) THEN
    RAISE EXCEPTION 'authoritative minute: attendance does not cover every political census seat';
  END IF;

  -- An out-of-census attendee can only be the non-voting secretary.
  IF EXISTS (
    SELECT 1
    FROM public.meeting_attendees ma
    WHERE ma.meeting_id = p_meeting_id
      AND ma.tenant_id = v_meeting.tenant_id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_snapshot.payload) item
        WHERE (item ->> 'person_id')::uuid = ma.person_id
      )
      AND (
        ma.person_id IS DISTINCT FROM v_meeting.secretary_id
        OR COALESCE(ma.voting_rights, 0) <> 0
        OR public.fn_secretaria_canonical_attendance_type(ma.attendance_type) <> 'PRESENCIAL'
      )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: outsider attendee is not the attributed non-voting secretary';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meeting_attendees ma
    WHERE ma.meeting_id = p_meeting_id
      AND ma.tenant_id = v_meeting.tenant_id
      AND (
        (public.fn_secretaria_canonical_attendance_type(ma.attendance_type) = 'PRESENCIAL' AND (
          ma.represented_by_id IS NOT NULL OR COALESCE(ma.via_representante, false)
        ))
        OR (public.fn_secretaria_canonical_attendance_type(ma.attendance_type) = 'AUSENTE' AND ma.represented_by_id IS NOT NULL)
        OR (public.fn_secretaria_canonical_attendance_type(ma.attendance_type) = 'REPRESENTADO' AND (
          ma.represented_by_id IS NULL
          OR ma.represented_by_id = ma.person_id
          OR COALESCE(ma.via_representante, false) IS NOT TRUE
          OR NOT EXISTS (
            SELECT 1
            FROM public.representaciones r
            WHERE r.tenant_id = v_meeting.tenant_id
              AND r.entity_id = v_meeting.resolved_entity_id
              AND r.meeting_id = p_meeting_id
              AND r.scope = 'CONSEJO_DELEGACION'
              AND r.represented_person_id = ma.person_id
              AND r.representative_person_id = ma.represented_by_id
              AND r.porcentaje_delegado = 100
              AND r.effective_from <= v_meeting.scheduled_start::date
              AND (r.effective_to IS NULL OR r.effective_to >= v_meeting.scheduled_start::date)
          )
          OR NOT EXISTS (
            SELECT 1
            FROM public.meeting_attendees representative
            WHERE representative.meeting_id = p_meeting_id
              AND representative.tenant_id = v_meeting.tenant_id
              AND representative.person_id = ma.represented_by_id
              AND public.fn_secretaria_canonical_attendance_type(representative.attendance_type) = 'PRESENCIAL'
          )
          OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_snapshot.payload) item
            WHERE (item ->> 'person_id')::uuid = ma.represented_by_id
          )
        ))
      )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: attendance/representation binding is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_attendees ma
     WHERE ma.meeting_id = p_meeting_id
       AND ma.tenant_id = v_meeting.tenant_id
       AND ma.person_id = v_meeting.president_id
       AND public.fn_secretaria_canonical_attendance_type(ma.attendance_type) = 'PRESENCIAL'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.meeting_attendees ma
     WHERE ma.meeting_id = p_meeting_id
       AND ma.tenant_id = v_meeting.tenant_id
       AND ma.person_id = v_meeting.secretary_id
       AND public.fn_secretaria_canonical_attendance_type(ma.attendance_type) = 'PRESENCIAL'
  ) THEN
    RAISE EXCEPTION 'authoritative minute: attributed president and secretary must be personally present';
  END IF;

  WITH census_people AS (
    SELECT
      (item ->> 'person_id')::uuid AS person_id,
      sum(
        CASE WHEN lower(COALESCE(item ->> 'voting_rights', 'true')) = 'true'
          THEN COALESCE(NULLIF(item ->> 'voting_weight', '')::numeric, 1)
          ELSE 0
        END
      ) AS voting_weight
    FROM jsonb_array_elements(v_snapshot.payload) item
    GROUP BY (item ->> 'person_id')::uuid
  )
  SELECT
    count(*) FILTER (
      WHERE public.fn_secretaria_canonical_attendance_type(ma.attendance_type) <> 'AUSENTE'
        AND cp.person_id IS NOT NULL
        AND cp.voting_weight > 0
    ),
    COALESCE(sum(cp.voting_weight) FILTER (
      WHERE public.fn_secretaria_canonical_attendance_type(ma.attendance_type) <> 'AUSENTE'
        AND cp.person_id IS NOT NULL
        AND cp.voting_weight > 0
    ), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ma.id,
          'person_id', ma.person_id,
          'person_name', p.full_name,
          'attendance_type', public.fn_secretaria_canonical_attendance_type(ma.attendance_type),
          'represented_by_id', ma.represented_by_id,
          'represented_by_name', representative.full_name,
          'server_voting_weight', COALESCE(cp.voting_weight, 0),
          'voting_eligible', cp.person_id IS NOT NULL AND cp.voting_weight > 0
        ) ORDER BY p.full_name, ma.person_id
      ),
      '[]'::jsonb
    )
    INTO v_server_present_count, v_server_present_weight, v_attendees
    FROM public.meeting_attendees ma
    JOIN public.persons p
      ON p.id = ma.person_id
     AND p.tenant_id = ma.tenant_id
    LEFT JOIN public.persons representative
      ON representative.id = ma.represented_by_id
     AND representative.tenant_id = ma.tenant_id
    LEFT JOIN census_people cp ON cp.person_id = ma.person_id
   WHERE ma.meeting_id = p_meeting_id
     AND ma.tenant_id = v_meeting.tenant_id;

  v_required_present_count := floor(v_census_person_count::numeric / 2)::integer + 1;
  v_quorum_reached := v_server_present_count >= v_required_present_count;
  IF v_quorum_reached IS NOT TRUE THEN
    RAISE EXCEPTION
      'authoritative minute: server quorum not reached (% of %, required %)',
      v_server_present_count, v_census_person_count, v_required_present_count;
  END IF;

  IF NOT v_is_universal THEN

    v_convocatoria_ref := COALESCE(
      NULLIF(v_meeting.quorum_data #>> '{source_links,convocatoria_id}', ''),
      NULLIF(v_meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '')
    );
    IF v_convocatoria_ref IS NULL
       OR v_convocatoria_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'authoritative minute: non-universal meeting requires explicit convocatoria UUID';
    END IF;
    v_convocatoria_id := v_convocatoria_ref::uuid;

    SELECT * INTO v_convocatoria
    FROM public.convocatorias c
    WHERE c.id = v_convocatoria_id
      AND c.tenant_id = v_meeting.tenant_id
      AND c.body_id = v_meeting.body_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'authoritative minute: convocatoria is outside meeting scope';
    END IF;
    IF v_convocatoria.estado <> 'EMITIDA'
       OR v_convocatoria.immutable_at IS NULL
       OR v_convocatoria.fecha_1 IS NULL
       OR v_convocatoria.fecha_1::date <> v_meeting.scheduled_start::date
       OR COALESCE(btrim(v_convocatoria.convocatoria_text), '') = ''
       OR jsonb_typeof(v_convocatoria.agenda_items) <> 'array'
       OR jsonb_array_length(v_convocatoria.agenda_items) = 0 THEN
      RAISE EXCEPTION 'authoritative minute: convocatoria must be emitted, immutable and complete';
    END IF;
    v_convocatoria_manifest := jsonb_build_object(
      'mode', 'CONVOCADA',
      'convocatoria_id', v_convocatoria.id,
      'immutable_at', v_convocatoria.immutable_at,
      'scheduled_at', v_convocatoria.fecha_1,
      'modality', v_convocatoria.modalidad,
      'notice_hash_sha256', encode(digest(v_convocatoria.convocatoria_text, 'sha256'), 'hex'),
      'publication_evidence_url', v_convocatoria.publication_evidence_url,
      'publication_channels', v_convocatoria.publication_channels,
      'statutory_basis', v_convocatoria.statutory_basis
    );
  END IF;

  SELECT
    count(*),
    count(DISTINCT ai.order_number),
    min(ai.order_number),
    max(ai.order_number),
    count(*) FILTER (WHERE ai.kind = 'DECISORIO'),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ai.id,
          'order_number', ai.order_number,
          'title', ai.title,
          'matter_code', ai.matter_code,
          'matter_label_es', mc.materia_label_es,
          'kind', ai.kind,
          'requires_vote', ai.requires_vote,
          'decision_subtype', ai.decision_subtype,
          'requires_attachments', ai.requires_attachments,
          'proposal_text', ai.proposal_text
        ) ORDER BY ai.order_number
      ),
      '[]'::jsonb
    )
  INTO v_agenda_count, v_agenda_distinct, v_agenda_min, v_agenda_max,
       v_decision_count, v_agenda
  FROM public.agenda_items ai
  LEFT JOIN public.materia_catalog mc
    ON mc.materia = ai.matter_code
  WHERE ai.meeting_id = p_meeting_id;

  IF v_agenda_count = 0
     OR v_agenda_distinct <> v_agenda_count
     OR v_agenda_min <> 1
     OR v_agenda_max <> v_agenda_count THEN
    RAISE EXCEPTION 'authoritative minute: agenda must be non-empty, unique and contiguous from 1';
  END IF;

  IF v_convocatoria_id IS NOT NULL AND EXISTS (
    WITH called AS (
      SELECT
        ordinality::integer AS order_number,
        btrim(item ->> 'titulo') AS title,
        NULLIF(btrim(item ->> 'materia'), '') AS matter_code,
        upper(COALESCE(NULLIF(btrim(item ->> 'kind'), ''), 'DELIBERATIVO')) AS kind,
        NULLIF(btrim(item ->> 'decision_subtype'), '') AS decision_subtype,
        NULLIF(btrim(item ->> 'propuesta_acuerdo'), '') AS proposal_text,
        CASE
          WHEN upper(COALESCE(item ->> 'materia', '')) = 'FORMULACION_CUENTAS'
            THEN true
          ELSE COALESCE((item ->> 'requires_attachments')::boolean, false)
        END AS requires_attachments
      FROM jsonb_array_elements(v_convocatoria.agenda_items)
        WITH ORDINALITY AS agenda(item, ordinality)
    ), held AS (
      SELECT
        ai.order_number,
        btrim(ai.title) AS title,
        NULLIF(btrim(ai.matter_code), '') AS matter_code,
        upper(COALESCE(NULLIF(btrim(ai.kind), ''), 'DELIBERATIVO')) AS kind,
        NULLIF(btrim(ai.decision_subtype), '') AS decision_subtype,
        NULLIF(btrim(ai.proposal_text), '') AS proposal_text,
        COALESCE(ai.requires_attachments, false) AS requires_attachments
      FROM public.agenda_items ai
      WHERE ai.meeting_id = p_meeting_id
        AND ai.tenant_id = v_meeting.tenant_id
    )
    SELECT 1
    FROM called
    FULL JOIN held USING (order_number)
    WHERE called.order_number IS NULL
       OR held.order_number IS NULL
       OR called.title IS DISTINCT FROM held.title
       OR called.matter_code IS DISTINCT FROM held.matter_code
       OR called.kind IS DISTINCT FROM held.kind
       OR called.decision_subtype IS DISTINCT FROM held.decision_subtype
       OR called.proposal_text IS DISTINCT FROM held.proposal_text
       OR called.requires_attachments IS DISTINCT FROM held.requires_attachments
  ) THEN
    RAISE EXCEPTION 'authoritative minute: held agenda differs from the immutable convocation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_items ai
    LEFT JOIN public.materia_catalog mc
      ON mc.materia = ai.matter_code
    WHERE ai.meeting_id = p_meeting_id
      AND ai.tenant_id = v_meeting.tenant_id
      AND (
        COALESCE(btrim(ai.matter_code), '') = ''
        OR COALESCE(btrim(mc.materia_label_es), '') = ''
        OR (ai.kind = 'DECISORIO' AND COALESCE(btrim(ai.proposal_text), '') = '')
      )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: every point needs a catalogued matter and every decision needs its exact proposal';
  END IF;

  -- A formulation resolution must identify the exact immutable accounts set
  -- that was submitted to the Board. The later annual-accounts migration
  -- supplies this validator before any runtime call can generate a minute.
  SELECT COALESCE(
    jsonb_agg(
      public.fn_secretaria_validate_annual_accounts_point(p_meeting_id, ai.id)
      ORDER BY ai.order_number
    ),
    '[]'::jsonb
  ) INTO v_annual_accounts
  FROM public.agenda_items ai
  WHERE ai.meeting_id = p_meeting_id
    AND ai.tenant_id = v_meeting.tenant_id
    AND upper(COALESCE(ai.matter_code, '')) = 'FORMULACION_CUENTAS';

  SELECT count(*) INTO v_resolution_count
  FROM public.meeting_resolutions mr
  WHERE mr.meeting_id = p_meeting_id
    AND mr.tenant_id = v_meeting.tenant_id
    AND mr.kind_resolution = 'DECISION';

  IF v_resolution_count <> v_decision_count THEN
    RAISE EXCEPTION 'authoritative minute: every decision agenda item requires exactly one resolution';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_items ai
    WHERE ai.meeting_id = p_meeting_id
      AND ai.tenant_id = v_meeting.tenant_id
      AND ai.kind = 'DECISORIO'
      AND (
        SELECT count(*)
        FROM public.meeting_resolutions mr
        WHERE mr.meeting_id = p_meeting_id
          AND mr.tenant_id = v_meeting.tenant_id
          AND mr.agenda_item_index = ai.order_number
          AND mr.kind_resolution = 'DECISION'
      ) <> 1
  ) OR EXISTS (
    SELECT 1
    FROM public.meeting_resolutions mr
    LEFT JOIN public.agenda_items ai
      ON ai.meeting_id = mr.meeting_id
     AND ai.tenant_id = mr.tenant_id
     AND ai.order_number = mr.agenda_item_index
    WHERE mr.meeting_id = p_meeting_id
      AND mr.tenant_id = v_meeting.tenant_id
      AND (ai.id IS NULL OR ai.kind <> 'DECISORIO' OR mr.kind_resolution <> 'DECISION')
  ) THEN
    RAISE EXCEPTION 'authoritative minute: resolution cardinality must be exactly one per decision point';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meeting_resolutions mr
    JOIN public.agenda_items ai
      ON ai.meeting_id = mr.meeting_id
     AND ai.order_number = mr.agenda_item_index
    LEFT JOIN public.agreements a
      ON a.id = mr.agreement_id
    WHERE mr.meeting_id = p_meeting_id
      AND mr.tenant_id = v_meeting.tenant_id
      AND (
        ai.kind <> 'DECISORIO'
        OR mr.kind_resolution <> 'DECISION'
        OR mr.status NOT IN ('ADOPTED', 'REJECTED')
        OR COALESCE(btrim(mr.resolution_text), '') = ''
        OR (
          mr.status = 'ADOPTED'
          AND (
            mr.agreement_id IS NULL
            OR a.id IS NULL
            OR a.tenant_id <> v_meeting.tenant_id
            OR a.parent_meeting_id <> p_meeting_id
            OR a.agenda_item_id <> ai.id
            OR a.status NOT IN ('ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED', 'REGISTERED', 'PUBLISHED')
            OR COALESCE(NULLIF(btrim(a.decision_text), ''), NULLIF(btrim(a.proposal_text), '')) IS NULL
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: resolution/agreement linkage or adoption state is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_items ai
    LEFT JOIN public.agenda_item_constancias ac
      ON ac.agenda_item_id = ai.id
     AND ac.meeting_id = ai.meeting_id
     AND ac.tenant_id = v_meeting.tenant_id
    WHERE ai.meeting_id = p_meeting_id
      AND ai.kind <> 'DECISORIO'
      AND (ac.id IS NULL OR COALESCE(btrim(ac.summary), '') = '')
  ) THEN
    RAISE EXCEPTION 'authoritative minute: every non-decision point requires a persisted constancia';
  END IF;

  -- Browser-produced point_snapshots are explanatory only. The legal result is
  -- recomputed from WORM census, persisted attendance and individual votes.
  IF EXISTS (
    SELECT 1
    FROM public.meeting_resolutions mr
    CROSS JOIN LATERAL public.fn_secretaria_server_resolution_evaluation(
      p_meeting_id,
      p_snapshot_id,
      mr.id
    ) evaluation
    WHERE mr.meeting_id = p_meeting_id
      AND mr.tenant_id = v_meeting.tenant_id
      AND mr.kind_resolution = 'DECISION'
      AND (
        evaluation ->> 'source' <> 'SERVER_AUTHORITATIVE'
        OR lower(COALESCE(evaluation #>> '{quorum,reached}', 'false')) <> 'true'
        OR lower(COALESCE(evaluation #>> '{votes,exactly_one_vote_per_eligible_concurrent_seat}', 'false')) <> 'true'
        OR lower(COALESCE(evaluation ->> 'status_consistent', 'false')) <> 'true'
        OR evaluation ->> 'status_expected' <> mr.status
        OR (
          mr.status = 'ADOPTED'
          AND lower(COALESCE(evaluation #>> '{majority,reached}', 'false')) <> 'true'
        )
        OR (
          mr.status = 'REJECTED'
          AND lower(COALESCE(evaluation #>> '{majority,reached}', 'false')) <> 'false'
        )
      )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: a resolution differs from the server census/vote evaluation';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'resolution_id', mr.id,
        'agenda_item_index', mr.agenda_item_index,
        'resolution_text', mr.resolution_text,
        'status', mr.status,
        'agreement_id', mr.agreement_id,
        'adoption_status', mr.status,
        'agreement_text', COALESCE(NULLIF(a.decision_text, ''), a.proposal_text),
        'server_evaluation', public.fn_secretaria_server_resolution_evaluation(
          p_meeting_id,
          p_snapshot_id,
          mr.id
        ),
        'votes', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'attendee_id', mv.attendee_id,
              'vote_value', mv.vote_value,
              'conflict_flag', mv.conflict_flag,
              'reason', mv.reason
            ) ORDER BY mv.attendee_id
          )
          FROM public.meeting_votes mv
          WHERE mv.resolution_id = mr.id
        ), '[]'::jsonb)
      ) ORDER BY mr.agenda_item_index
    ),
    '[]'::jsonb
  ) INTO v_resolutions
  FROM public.meeting_resolutions mr
  LEFT JOIN public.agreements a ON a.id = mr.agreement_id
  WHERE mr.meeting_id = p_meeting_id
    AND mr.tenant_id = v_meeting.tenant_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'agenda_item_id', ac.agenda_item_id,
        'kind', ac.kind,
        'summary', ac.summary,
        'participants', ac.participants,
        'follow_ups', ac.follow_ups,
        'attachments', ac.attachments
      ) ORDER BY ai.order_number
    ),
    '[]'::jsonb
  ) INTO v_constancias
  FROM public.agenda_item_constancias ac
  JOIN public.agenda_items ai ON ai.id = ac.agenda_item_id
  WHERE ac.meeting_id = p_meeting_id
    AND ac.tenant_id = v_meeting.tenant_id;

  RETURN jsonb_build_object(
    'schema_version', 'authoritative-minute-manifest.v1',
    'tenant_id', v_meeting.tenant_id,
    'meeting_id', v_meeting.id,
    'entity_id', v_meeting.resolved_entity_id,
    'entity', jsonb_build_object(
      'id', v_meeting.resolved_entity_id,
      'legal_name', v_meeting.resolved_entity_name,
      'tax_id', v_meeting.resolved_entity_tax_id,
      'legal_form', v_meeting.resolved_legal_form,
      'listed', COALESCE(v_meeting.resolved_listed, false)
    ),
    'body_id', v_meeting.body_id,
    'body', jsonb_build_object(
      'id', v_meeting.body_id,
      'name', v_meeting.resolved_body_name,
      'type', v_meeting.resolved_body_type
    ),
    'meeting_status', v_meeting.status,
    'meeting_type', v_meeting.meeting_type,
    'scheduled_start', v_meeting.scheduled_start,
    'scheduled_end', v_meeting.scheduled_end,
    'location', v_meeting.location,
    'president_id', v_meeting.president_id,
    'secretary_id', v_meeting.secretary_id,
    'chair', jsonb_build_object(
      'president', jsonb_build_object(
        'person_id', v_meeting.president_id,
        'name', v_meeting.resolved_president_name,
        'tax_id', v_meeting.resolved_president_tax_id
      ),
      'secretary', jsonb_build_object(
        'person_id', v_meeting.secretary_id,
        'name', v_meeting.resolved_secretary_name,
        'tax_id', v_meeting.resolved_secretary_tax_id
      )
    ),
    'convocation', v_convocatoria_manifest,
    'quorum', jsonb_build_object(
      'is_universal', v_is_universal,
      'source', 'SERVER_CENSUS_AND_ATTENDANCE',
      'reached', v_quorum_reached,
      'eligible_count', v_census_person_count,
      'present_or_represented_count', v_server_present_count,
      'required_count', v_required_present_count,
      'present_or_represented_weight', v_server_present_weight,
      'total_weight', v_server_total_weight
    ),
    'census', jsonb_build_object(
      'snapshot_id', v_snapshot.id,
      'snapshot_type', v_snapshot.snapshot_type,
      'total_partes', v_snapshot.total_partes,
      'capital_total_base', v_snapshot.capital_total_base,
      'payload', v_snapshot.payload,
      'audit_worm_id', v_snapshot.audit_worm_id,
      'audit_hash_sha512', v_snapshot.audit_hash_sha512
    ),
    'attendees', v_attendees,
    'agenda', v_agenda,
    'annual_accounts', v_annual_accounts,
    'resolutions', v_resolutions,
    'constancias', v_constancias,
    'content_hash_sha256', p_content_hash_sha256
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_render_authoritative_minute(
  p_manifest jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
  v_attendee jsonb;
  v_point jsonb;
  v_resolution jsonb;
  v_constancia jsonb;
  v_annual_account jsonb;
  v_index integer;
BEGIN
  IF p_manifest IS NULL
     OR p_manifest ->> 'schema_version' <> 'authoritative-minute-manifest.v1'
     OR COALESCE(btrim(p_manifest #>> '{entity,legal_name}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{entity,tax_id}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{body,name}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{chair,president,name}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{chair,secretary,name}'), '') = ''
     OR jsonb_typeof(p_manifest -> 'attendees') <> 'array'
     OR jsonb_typeof(p_manifest -> 'agenda') <> 'array'
     OR jsonb_array_length(p_manifest -> 'agenda') = 0 THEN
    RAISE EXCEPTION 'authoritative minute renderer requires a complete server manifest';
  END IF;

  v_text := format(
    'ACTA DE LA REUNIÓN DEL %s DE %s\n\n'
    || '1. IDENTIFICACIÓN DE LA SOCIEDAD Y DE LA SESIÓN\n'
    || 'Sociedad: %s, %s, NIF %s.\n'
    || 'Órgano: %s.\n'
    || 'Fecha y hora: desde %s hasta %s.\n'
    || 'Lugar o medio de celebración: %s.\n'
    || 'Convocatoria: %s.\n\n'
    || '2. MESA, CENSO Y CONSTITUCIÓN\n'
    || 'Preside: %s. Actúa como secretario: %s.\n'
    || 'Censo con derecho de voto: %s miembros. Presentes o representados: %s; mínimo exigible: %s. '
    || 'El quórum se ha recalculado en servidor sobre el censo inmutable y se declara alcanzado.\n\n'
    || '3. ASISTENCIA\n',
    p_manifest #>> '{body,name}',
    p_manifest #>> '{entity,legal_name}',
    p_manifest #>> '{entity,legal_name}',
    p_manifest #>> '{entity,legal_form}',
    p_manifest #>> '{entity,tax_id}',
    p_manifest #>> '{body,name}',
    to_char(
      (p_manifest ->> 'scheduled_start')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    to_char(
      (p_manifest ->> 'scheduled_end')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    p_manifest ->> 'location',
    CASE p_manifest #>> '{convocation,mode}'
      WHEN 'CONVOCADA' THEN format(
        'emitida de forma inmutable para la sesión, mediante %s',
        CASE upper(COALESCE(p_manifest #>> '{convocation,modality}', ''))
          WHEN 'PRESENCIAL' THEN 'modalidad presencial'
          WHEN 'TELEMATICA' THEN 'modalidad telemática'
          WHEN 'TELEMÁTICA' THEN 'modalidad telemática'
          WHEN 'HIBRIDA' THEN 'modalidad híbrida'
          WHEN 'HÍBRIDA' THEN 'modalidad híbrida'
          ELSE 'canal acreditado'
        END
      )
      ELSE 'régimen universal con evidencias individuales'
    END,
    p_manifest #>> '{chair,president,name}',
    p_manifest #>> '{chair,secretary,name}',
    p_manifest #>> '{quorum,eligible_count}',
    p_manifest #>> '{quorum,present_or_represented_count}',
    p_manifest #>> '{quorum,required_count}'
  );

  FOR v_attendee IN
    SELECT value FROM jsonb_array_elements(p_manifest -> 'attendees')
  LOOP
    v_text := v_text || format(
      '- %s: %s%s%s.\n',
      COALESCE(v_attendee ->> 'person_name', 'Persona no identificada'),
      CASE v_attendee ->> 'attendance_type'
        WHEN 'PRESENCIAL' THEN 'asistencia personal'
        WHEN 'REPRESENTADO' THEN 'asistencia por representación'
        ELSE 'ausente'
      END,
      CASE WHEN COALESCE(v_attendee ->> 'represented_by_name', '') <> ''
        THEN ' mediante ' || (v_attendee ->> 'represented_by_name')
        ELSE ''
      END,
      CASE WHEN lower(COALESCE(v_attendee ->> 'voting_eligible', 'false')) = 'true'
        THEN '; peso de voto ' || COALESCE(v_attendee ->> 'server_voting_weight', '0')
        ELSE '; sin derecho de voto'
      END
    );
  END LOOP;

  v_text := v_text || E'\n4. ORDEN DEL DÍA, DELIBERACIONES Y ACUERDOS\n';
  FOR v_point IN
    SELECT value
    FROM jsonb_array_elements(p_manifest -> 'agenda')
    ORDER BY (value ->> 'order_number')::integer
  LOOP
    v_index := (v_point ->> 'order_number')::integer;
    v_text := v_text || format(
      E'\n%s. %s\nMateria: %s. Naturaleza: %s.\n',
      v_index,
      v_point ->> 'title',
      v_point ->> 'matter_label_es',
      CASE v_point ->> 'kind'
        WHEN 'DECISORIO' THEN 'asunto sujeto a acuerdo'
        ELSE 'asunto informativo o deliberativo'
      END
    );

    IF v_point ->> 'kind' = 'DECISORIO' THEN
      IF upper(COALESCE(v_point ->> 'matter_code', '')) = 'FORMULACION_CUENTAS' THEN
        SELECT value INTO v_annual_account
        FROM jsonb_array_elements(COALESCE(p_manifest -> 'annual_accounts', '[]'::jsonb))
        WHERE value ->> 'agenda_item_id' = v_point ->> 'id'
        LIMIT 1;
        IF v_annual_account IS NULL THEN
          RAISE EXCEPTION 'authoritative minute renderer: annual accounts point % lacks its immutable set', v_index;
        END IF;
        v_text := v_text || format(
          'Conjunto de cuentas sometido: ejercicio %s%s, versión %s, %s componentes, identificado de forma inmutable en el expediente electrónico.\n',
          v_annual_account ->> 'fiscal_year',
          CASE WHEN lower(COALESCE(v_annual_account ->> 'is_consolidated', 'false')) = 'true'
            THEN ' (consolidado)'
            ELSE ''
          END,
          v_annual_account ->> 'version_number',
          v_annual_account ->> 'component_count'
        );
      END IF;
      SELECT value INTO v_resolution
      FROM jsonb_array_elements(p_manifest -> 'resolutions')
      WHERE (value ->> 'agenda_item_index')::integer = v_index
      LIMIT 1;
      IF v_resolution IS NULL THEN
        RAISE EXCEPTION 'authoritative minute renderer: decision point % lacks resolution', v_index;
      END IF;
      v_text := v_text || format(
        'Propuesta sometida: %s\nAcuerdo o resultado literal: %s\nResultado: %s. '
        || 'Votos a favor: %s; en contra: %s; abstenciones: %s; excluidos por conflicto: %s. '
        || 'Mayoría aplicada: %s; %s.\n',
        v_point ->> 'proposal_text',
        v_resolution ->> 'resolution_text',
        CASE v_resolution ->> 'status'
          WHEN 'ADOPTED' THEN 'acuerdo aprobado'
          WHEN 'REJECTED' THEN 'propuesta rechazada'
          ELSE 'resultado no admisible'
        END,
        COALESCE(v_resolution #>> '{server_evaluation,votes,favor}', '0'),
        COALESCE(v_resolution #>> '{server_evaluation,votes,contra}', '0'),
        COALESCE(v_resolution #>> '{server_evaluation,votes,abstencion}', '0'),
        COALESCE(v_resolution #>> '{server_evaluation,attendance,conflict_excluded_seats}', '0'),
        COALESCE(v_resolution #>> '{server_evaluation,majority,reference}', 'art. 248.1 LSC'),
        CASE lower(COALESCE(v_resolution #>> '{server_evaluation,majority,reached}', 'false'))
          WHEN 'true' THEN 'mayoría alcanzada'
          ELSE 'mayoría no alcanzada'
        END
      );
    ELSE
      SELECT value INTO v_constancia
      FROM jsonb_array_elements(p_manifest -> 'constancias')
      WHERE value ->> 'agenda_item_id' = v_point ->> 'id'
      LIMIT 1;
      IF v_constancia IS NULL OR COALESCE(btrim(v_constancia ->> 'summary'), '') = '' THEN
        RAISE EXCEPTION 'authoritative minute renderer: non-decision point % lacks deliberation/constancia', v_index;
      END IF;
      v_text := v_text || format('Síntesis de la deliberación o informe: %s\n', v_constancia ->> 'summary');
    END IF;
  END LOOP;

  v_text := v_text || format(
    E'\n5. CIERRE Y FIRMAS\nSin más asuntos que tratar, la sesión concluyó a las %s. '
    || 'El acta se someterá al método de aprobación legalmente aplicable y a intervención electrónica acreditada por EAD Trust de %s, como presidente, y %s, como secretario. El tipo y empaquetado realmente prestados constarán en la evidencia del proveedor y en el archivo electrónico.\n',
    to_char(
      (p_manifest ->> 'scheduled_end')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    p_manifest #>> '{chair,president,name}',
    p_manifest #>> '{chair,secretary,name}'
  );

  RETURN v_text;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_render_authoritative_minute(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_render_authoritative_minute(jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_secretaria_build_minute_legal_manifest(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_build_minute_legal_manifest(uuid, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Generación de acta: el hash/ok del cliente queda expresamente ignorado
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_generar_acta(
  p_meeting_id uuid,
  p_content text,
  p_snapshot_id uuid,
  -- Preserve the deployed overload's default while ignoring the client claim.
  -- PostgreSQL rejects CREATE OR REPLACE when an existing default is removed.
  p_canonical_minutes_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_meeting record;
  v_existing public.minutes%ROWTYPE;
  v_minute_id uuid;
  v_content_hash text;
  v_client_content_hash text;
  v_canonical_content text;
  v_manifest jsonb;
  v_manifest_hash text;
BEGIN
  SELECT m.*, gb.entity_id AS resolved_entity_id
    INTO v_meeting
    FROM public.meetings m
    JOIN public.governing_bodies gb
      ON gb.id = m.body_id
     AND gb.tenant_id = m.tenant_id
   WHERE m.id = p_meeting_id
   FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative minute: meeting % not found', p_meeting_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
      RAISE EXCEPTION 'authoritative minute tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF COALESCE(btrim(p_content), '') <> '' THEN
    v_client_content_hash := encode(digest(p_content, 'sha256'), 'hex');
  END IF;
  v_manifest := public.fn_secretaria_build_minute_legal_manifest(
    p_meeting_id,
    p_snapshot_id,
    repeat('0', 64)
  );
  v_canonical_content := public.fn_secretaria_render_authoritative_minute(v_manifest);
  v_content_hash := encode(digest(v_canonical_content, 'sha256'), 'hex');
  v_manifest := jsonb_set(
    v_manifest,
    '{content_hash_sha256}',
    to_jsonb(v_content_hash),
    true
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  SELECT * INTO v_existing
    FROM public.minutes
   WHERE meeting_id = p_meeting_id
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.content_hash = v_content_hash
       AND v_existing.snapshot_id = p_snapshot_id
       AND v_existing.authoritative_manifest_hash = v_manifest_hash THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'authoritative minute: meeting already has a different minute';
  END IF;

  -- p_canonical_minutes_hash is deliberately not trusted. It is retained only
  -- as an audit claim inside rules_applied; canonical_minutes_hash is server-only.
  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  INSERT INTO public.minutes (
    tenant_id,
    meeting_id,
    content,
    signed_at,
    is_locked,
    snapshot_id,
    content_hash,
    canonical_minutes_hash,
    authoritative_manifest,
    authoritative_manifest_hash,
    legal_structure_validation,
    rules_applied,
    body_id,
    entity_id,
    legal_gate_status
  ) VALUES (
    v_meeting.tenant_id,
    p_meeting_id,
    v_canonical_content,
    NULL,
    false,
    p_snapshot_id,
    v_content_hash,
    v_manifest_hash,
    v_manifest,
    v_manifest_hash,
    jsonb_build_object(
      'ok', true,
      'authority', 'SERVER_RECOMPUTED',
      'validator', 'fn_secretaria_render_authoritative_minute',
      'content_source', 'SERVER_MANIFEST_RENDER',
      'manifest_hash', v_manifest_hash,
      'validated_at', now()
    ),
    jsonb_build_object(
      'agenda_driven_minutes', true,
      'authoritative_manifest_hash', v_manifest_hash,
      'client_content_hash_ignored', v_client_content_hash,
      'client_canonical_hash_ignored', p_canonical_minutes_hash,
      'validated_by', 'DATABASE'
    ),
    v_meeting.body_id,
    v_meeting.resolved_entity_id,
    'MANIFEST_READY'
  )
  RETURNING id INTO v_minute_id;

  RETURN v_minute_id;
END;
$function$;

-- Cloud conserva un overload histórico de tres argumentos. Se redefine como
-- adaptador estrecho del mismo motor autoritativo para que ningún caller antiguo
-- pueda seguir ejecutando el cuerpo legacy ni confiar en un hash del cliente.
CREATE OR REPLACE FUNCTION public.fn_generar_acta(
  p_meeting_id uuid,
  p_content text,
  p_snapshot_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN public.fn_generar_acta(
    p_meeting_id,
    p_content,
    p_snapshot_id,
    NULL::text
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_generar_acta(uuid, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generar_acta(uuid, text, uuid, text)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_generar_acta(uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generar_acta(uuid, text, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_actualizar_borrador_acta(
  p_minute_id uuid,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_content_hash text;
  v_client_content_hash text;
  v_canonical_content text;
  v_manifest jsonb;
  v_manifest_hash text;
BEGIN
  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = p_minute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'acta tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_minute.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_minute.is_locked
     OR v_minute.signed_at IS NOT NULL
     OR v_minute.final_legal_artifact_id IS NOT NULL
     OR v_minute.legal_gate_status NOT IN ('DRAFT', 'MANIFEST_READY') THEN
    RAISE EXCEPTION 'acta % no editable: firmada, bloqueada o vinculada a artefacto final', p_minute_id
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_content), '') <> '' THEN
    v_client_content_hash := encode(digest(p_content, 'sha256'), 'hex');
  END IF;

  v_manifest := public.fn_secretaria_build_minute_legal_manifest(
    v_minute.meeting_id,
    v_minute.snapshot_id,
    repeat('0', 64)
  );
  v_canonical_content := public.fn_secretaria_render_authoritative_minute(v_manifest);
  v_content_hash := encode(digest(v_canonical_content, 'sha256'), 'hex');
  v_manifest := jsonb_set(
    v_manifest,
    '{content_hash_sha256}',
    to_jsonb(v_content_hash),
    true
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.minutes
     SET content = v_canonical_content,
         content_hash = v_content_hash,
         canonical_minutes_hash = v_manifest_hash,
         authoritative_manifest = v_manifest,
         authoritative_manifest_hash = v_manifest_hash,
         legal_structure_validation = jsonb_build_object(
           'ok', true,
           'authority', 'SERVER_RECOMPUTED',
           'validator', 'fn_secretaria_render_authoritative_minute',
           'content_source', 'SERVER_MANIFEST_RENDER',
           'manifest_hash', v_manifest_hash,
           'validated_at', now()
         ),
         rules_applied = COALESCE(rules_applied, '{}'::jsonb) || jsonb_build_object(
           'authoritative_manifest_hash', v_manifest_hash,
           'client_content_hash_ignored', v_client_content_hash,
           'validated_by', 'DATABASE'
         ),
         legal_gate_status = 'MANIFEST_READY'
   WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'content_hash', v_content_hash,
    'authoritative_manifest_hash', v_manifest_hash,
    'updated', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_actualizar_borrador_acta(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_actualizar_borrador_acta(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Registro gobernado del artefacto final y de verificaciones EAD Trust
-- ---------------------------------------------------------------------------

-- evidence_bundles es WORM: un bundle OPEN no puede ascender por UPDATE. El
-- reconciliador de confianza crea, por tanto, una fila VERIFIED nueva y
-- append-only después de recuperar el binario almacenado y contrastarlo con la
-- respuesta EAD. Ningún caller autenticado puede fabricar este estado.
CREATE OR REPLACE FUNCTION public.fn_secretaria_evidence_bundle_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND COALESCE(current_setting('app.secretaria_evidence_bundle_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'evidence bundle insert requires a governed custody RPC'
      USING ERRCODE = '42501';
  END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND NEW.status <> 'OPEN' THEN
    RAISE EXCEPTION 'authenticated custody may only create OPEN unsigned evidence'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_evidence_bundles_authoritative_insert
  ON public.evidence_bundles;
CREATE TRIGGER trg_evidence_bundles_authoritative_insert
  BEFORE INSERT ON public.evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_evidence_bundle_insert_guard();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.evidence_bundles
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.evidence_bundles TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.evidence_bundles TO service_role;

CREATE OR REPLACE FUNCTION public.fn_create_governance_evidence_bundle(
  p_tenant_id uuid,
  p_source_module text,
  p_source_object_type text,
  p_source_object_id text,
  p_reference_code text,
  p_manifest jsonb,
  p_document_url text DEFAULT NULL,
  p_legal_hold boolean DEFAULT false,
  p_status text DEFAULT 'OPEN',
  p_signed_by text DEFAULT NULL
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
  v_service boolean := public.fn_secretaria_is_service_role() IS TRUE;
BEGIN
  IF p_tenant_id IS NULL OR COALESCE(btrim(p_source_object_id), '') = '' THEN
    RAISE EXCEPTION 'tenant and source object are required for custody';
  END IF;
  IF NOT v_service THEN
    IF public.fn_assert_current_tenant_id() <> p_tenant_id THEN
      RAISE EXCEPTION 'evidence bundle tenant mismatch' USING ERRCODE = '42501';
    END IF;
    IF p_status <> 'OPEN' THEN
      RAISE EXCEPTION 'browser/application custody cannot assert SEALED or VERIFIED evidence';
    END IF;
    p_signed_by := NULL;
  ELSIF p_status NOT IN ('OPEN', 'SEALED', 'VERIFIED') THEN
    RAISE EXCEPTION 'unsupported evidence bundle status';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'governance-custody.v2',
    'source', jsonb_build_object(
      'module', p_source_module,
      'object_type', p_source_object_type,
      'object_id', p_source_object_id,
      'reference_code', p_reference_code
    ),
    'payload', COALESCE(p_manifest, '{}'::jsonb),
    'custody', jsonb_build_object(
      'trust_boundary', CASE WHEN v_service THEN 'SERVICE_GOVERNANCE_CUSTODY' ELSE 'APPLICATION_UNSIGNED_INPUT' END,
      'artifact_role', CASE WHEN v_service THEN 'SERVICE_RECORD' ELSE 'UNSIGNED_INPUT' END,
      'created_at', clock_timestamp(),
      'sandbox', NOT v_service
    )
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  v_hash_sha512 := encode(digest(v_manifest::text, 'sha512'), 'hex');

  PERFORM set_config('app.secretaria_evidence_bundle_rpc', '1', true);
  INSERT INTO public.evidence_bundles (
    tenant_id, agreement_id, source_module, source_object_type,
    source_object_id, reference_code, manifest, manifest_hash, hash_sha512,
    status, document_url, signed_by, signature_date, chain_of_custody, legal_hold
  ) VALUES (
    p_tenant_id, NULL, p_source_module, p_source_object_type,
    p_source_object_id, p_reference_code, v_manifest, v_manifest_hash, v_hash_sha512,
    p_status, p_document_url, p_signed_by,
    CASE WHEN v_service AND p_status IN ('SEALED', 'VERIFIED') THEN now() ELSE NULL END,
    jsonb_build_array(jsonb_build_object(
      'event', CASE WHEN v_service THEN 'SERVICE_CUSTODY_CREATED' ELSE 'UNSIGNED_INPUT_RECORDED' END,
      'ts', now(),
      'manifest_hash', v_manifest_hash
    )),
    p_legal_hold
  ) RETURNING id INTO v_bundle_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', v_hash_sha512,
    'status', p_status,
    'artifact_role', CASE WHEN v_service THEN 'SERVICE_RECORD' ELSE 'UNSIGNED_INPUT' END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_governance_evidence_bundle(
  uuid, text, text, text, text, jsonb, text, boolean, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_governance_evidence_bundle(
  uuid, text, text, text, text, jsonb, text, boolean, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_unsigned_input_custody(
  p_tenant_id uuid,
  p_agreement_id uuid,
  p_storage_path text,
  p_document_url text,
  p_binary_hash_sha512 text,
  p_manifest jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_manifest jsonb;
  v_manifest_hash text;
  v_bundle_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_assert_current_tenant_id() <> p_tenant_id THEN
    RAISE EXCEPTION 'unsigned custody tenant mismatch' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = p_agreement_id AND a.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'unsigned custody agreement is outside tenant scope';
  END IF;
  IF COALESCE(btrim(p_storage_path), '') = ''
     OR p_storage_path LIKE 'http%'
     OR p_storage_path LIKE '%..%'
     OR p_binary_hash_sha512 !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'unsigned custody requires private path and SHA-512';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria-unsigned-input-custody.v1',
    'source', jsonb_build_object(
      'domain', 'AGREEMENT',
      'id', p_agreement_id
    ),
    'binary', jsonb_build_object(
      'artifact_role', 'UNSIGNED_INPUT',
      'storage_path', p_storage_path,
      'hash_sha512', p_binary_hash_sha512
    ),
    'metadata', COALESCE(p_manifest, '{}'::jsonb),
    'custody', jsonb_build_object(
      'trust_boundary', 'APPLICATION_UNSIGNED_INPUT',
      'sandbox', true,
      'created_at', clock_timestamp()
    )
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  PERFORM set_config('app.secretaria_evidence_bundle_rpc', '1', true);
  INSERT INTO public.evidence_bundles (
    tenant_id, agreement_id, source_module, source_object_type,
    source_object_id, reference_code, manifest, manifest_hash, hash_sha512,
    storage_path, document_url, signed_by, signature_date, chain_of_custody,
    legal_hold, status
  ) VALUES (
    p_tenant_id, p_agreement_id, 'secretaria', 'AGREEMENT',
    p_agreement_id::text, 'UNSIGNED-' || left(p_binary_hash_sha512, 12),
    v_manifest, v_manifest_hash, p_binary_hash_sha512,
    p_storage_path, p_document_url, NULL, NULL,
    jsonb_build_array(jsonb_build_object(
      'event', 'UNSIGNED_INPUT_RECORDED',
      'ts', now(),
      'artifact_role', 'UNSIGNED_INPUT'
    )),
    false, 'OPEN'
  ) RETURNING id INTO v_bundle_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', p_binary_hash_sha512,
    'status', 'OPEN',
    'artifact_role', 'UNSIGNED_INPUT'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_unsigned_input_custody(
  uuid, uuid, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_unsigned_input_custody(
  uuid, uuid, text, text, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_reconcile_verified_ead_bundle(
  p_source_domain text,
  p_source_id uuid,
  p_signature_request_id uuid,
  p_storage_path text,
  p_content_hash_sha256 text,
  p_signed_output_hash_sha256 text,
  p_signed_output_hash_sha512 text,
  p_provider_signature_type text,
  p_completion_certificate_ref text,
  p_completion_package_ref text,
  p_signed_at timestamptz,
  p_certificate_fingerprint_sha256 text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_expected_content_hash text;
  v_expected_process_kind text;
  v_expected_artifact_kind text;
  v_source_not_before timestamptz;
  v_signature_packaging text;
  v_provider_completed_at timestamptz;
  v_request public.qtsp_signature_requests%ROWTYPE;
  v_existing_bundle public.evidence_bundles%ROWTYPE;
  v_manifest jsonb;
  v_manifest_hash text;
  v_bundle_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'EAD evidence reconciliation requires service_role'
      USING ERRCODE = '42501';
  END IF;

  p_source_domain := upper(COALESCE(btrim(p_source_domain), ''));
  p_provider_signature_type := upper(COALESCE(btrim(p_provider_signature_type), ''));

  IF p_source_domain = 'MINUTE' THEN
    SELECT minute.tenant_id, minute.content_hash, meeting.scheduled_end
      INTO v_tenant_id, v_expected_content_hash, v_source_not_before
      FROM public.minutes minute
      JOIN public.meetings meeting
        ON meeting.id = minute.meeting_id
       AND meeting.tenant_id = minute.tenant_id
     WHERE minute.id = p_source_id
       AND minute.legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL');
    v_expected_process_kind := 'ACTA';
    v_expected_artifact_kind := 'MINUTE_FINAL';
  ELSIF p_source_domain = 'CERTIFICATION' THEN
    SELECT certification.tenant_id,
           encode(digest(certification.content, 'sha256'), 'hex'),
           COALESCE(
             NULLIF(certification.authoritative_manifest #>> '{issue,prepared_at}', '')::timestamptz,
             certification.created_at
           )
      INTO v_tenant_id, v_expected_content_hash, v_source_not_before
      FROM public.certifications certification
     WHERE certification.id = p_source_id
       AND certification.legal_gate_status IN ('DRAFT', 'ARTIFACT_FINAL')
       AND certification.signature_status = 'PENDING'
       AND COALESCE(btrim(certification.content), '') <> '';
    v_expected_process_kind := 'CERTIFICACION';
    v_expected_artifact_kind := 'CERTIFICATION_FINAL';
  ELSE
    RAISE EXCEPTION 'unsupported EAD reconciliation source domain';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'EAD reconciliation source is missing or not finalizable';
  END IF;

  IF p_content_hash_sha256 IS DISTINCT FROM v_expected_content_hash
     OR p_content_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'EAD reconciliation content hash mismatch';
  END IF;
  IF p_signed_output_hash_sha256 !~ '^[0-9a-f]{64}$'
     OR p_signed_output_hash_sha512 !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'EAD reconciliation requires signed output SHA-256 and SHA-512';
  END IF;
  IF COALESCE(btrim(p_storage_path), '') = ''
     OR p_storage_path LIKE 'http%'
     OR p_storage_path LIKE '%..%' THEN
    RAISE EXCEPTION 'EAD reconciliation requires a canonical private storage path';
  END IF;
  IF p_provider_signature_type NOT IN ('INTERPOSITION', 'ADVANCED') THEN
    RAISE EXCEPTION 'EAD reconciliation requires the real INTERPOSITION or ADVANCED signature type';
  END IF;
  v_signature_packaging := upper(COALESCE(
    NULLIF(btrim(p_provider_payload ->> 'signature_packaging'), ''),
    NULLIF(btrim(p_provider_payload #>> '{input_output_binding,signature_packaging}'), '')
  ));
  IF v_signature_packaging NOT IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION') THEN
    RAISE EXCEPTION 'EAD reconciliation requires the actual signature packaging';
  END IF;
  IF p_certificate_fingerprint_sha256 IS NOT NULL
     AND p_certificate_fingerprint_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'certificate fingerprint must be SHA-256 when supplied';
  END IF;
  IF COALESCE(btrim(p_completion_certificate_ref), '') = ''
     OR COALESCE(btrim(p_completion_package_ref), '') = ''
     OR p_signed_at IS NULL
     OR p_signed_at > now() THEN
    RAISE EXCEPTION 'EAD reconciliation requires completion certificate, completion package and provider signing time';
  END IF;
  BEGIN
    v_provider_completed_at := NULLIF(
      btrim(p_provider_payload ->> 'provider_completed_at'),
      ''
    )::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'EAD reconciliation provider completion time is invalid';
  END;
  IF v_provider_completed_at IS NULL
     OR v_provider_completed_at < p_signed_at
     OR v_provider_completed_at > now()
     OR v_source_not_before IS NULL
     OR p_signed_at < v_source_not_before THEN
    RAISE EXCEPTION 'EAD reconciliation chronology is impossible for the legal source';
  END IF;
  IF p_provider_payload IS NULL
     OR jsonb_typeof(p_provider_payload) <> 'object'
     OR lower(COALESCE(p_provider_payload ->> 'sandbox', 'false')) = 'true'
     OR upper(COALESCE(p_provider_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_provider_payload ->> 'provider_document_status', '')) NOT IN ('SIGNED', 'CERTIFIED')
     OR COALESCE(btrim(p_provider_payload ->> 'storage_object_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'storage_version'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'storage_retrieved_at'), '') = ''
     OR lower(COALESCE(p_provider_payload ->> 'storage_binary_hash_sha256', '')) <> p_signed_output_hash_sha256
     OR lower(COALESCE(p_provider_payload ->> 'storage_binary_hash_sha512', '')) <> p_signed_output_hash_sha512
     OR COALESCE(p_provider_payload #>> '{input_output_binding,status}', '') <> 'SERVICE_HASH_VERIFIED'
     OR lower(COALESCE(p_provider_payload #>> '{input_output_binding,signed_output_hash_sha256}', '')) <> p_signed_output_hash_sha256
     OR lower(COALESCE(p_provider_payload #>> '{input_output_binding,signed_output_hash_sha512}', '')) <> p_signed_output_hash_sha512
     OR upper(COALESCE(p_provider_payload #>> '{input_output_binding,signature_packaging}', '')) <> v_signature_packaging
     OR p_provider_payload #>> '{input_output_binding,completion_certificate_ref}' IS DISTINCT FROM p_completion_certificate_ref
     OR p_provider_payload #>> '{input_output_binding,completion_package_ref}' IS DISTINCT FROM p_completion_package_ref
     OR COALESCE(btrim(p_provider_payload #>> '{input_output_binding,signed_document_ref}'), '') = '' THEN
    RAISE EXCEPTION 'trusted reconciliation must attest storage output and the validated EAD input-to-output binding';
  END IF;

  SELECT * INTO v_request
    FROM public.qtsp_signature_requests
   WHERE id = p_signature_request_id
     AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_request.sr_status <> 'COMPLETED'
     OR COALESCE(btrim(v_request.sr_id), '') = ''
     OR COALESCE(btrim(v_request.document_id), '') = ''
     OR v_request.source_domain IS DISTINCT FROM p_source_domain
     OR v_request.source_id IS DISTINCT FROM p_source_id
     OR v_request.artifact_kind IS DISTINCT FROM v_expected_artifact_kind
     OR lower(COALESCE(v_request.content_hash_sha256, '')) IS DISTINCT FROM p_content_hash_sha256
     OR v_request.requested_at IS NULL
     OR v_request.requested_at > p_signed_at
     OR (
       v_request.completed_at IS NOT NULL
       AND v_request.completed_at IS DISTINCT FROM v_provider_completed_at
     )
     OR lower(COALESCE(v_request.document_hash, ''))
          <> lower(COALESCE(p_provider_payload #>> '{input_output_binding,request_input_hash_sha256}', ''))
     OR (
       v_signature_packaging = 'ENVELOPED'
       AND lower(COALESCE(v_request.document_hash, '')) = p_signed_output_hash_sha256
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(COALESCE(v_request.signatories, '[]'::jsonb)) signer
       WHERE signer ->> 'source_domain' IS DISTINCT FROM p_source_domain
          OR signer ->> 'source_id' IS DISTINCT FROM p_source_id::text
          OR signer ->> 'artifact_kind' IS DISTINCT FROM v_expected_artifact_kind
          OR lower(COALESCE(signer ->> 'content_hash_sha256', '')) IS DISTINCT FROM p_content_hash_sha256
     )
     OR upper(COALESCE(v_request.evidence_status, '')) LIKE '%SANDBOX%' THEN
    RAISE EXCEPTION 'EAD request, source, chronology and output must be separately bound by a completed non-sandbox provider report';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'ead-trust-reconciliation.v1',
    'source', jsonb_build_object(
      'domain', p_source_domain,
      'id', p_source_id,
      'process_kind', v_expected_process_kind,
      'content_hash_sha256', p_content_hash_sha256
    ),
    'request_input', jsonb_build_object(
      'hash_sha256', lower(v_request.document_hash),
      'provider_request_id', v_request.sr_id,
      'provider_document_id', v_request.document_id
    ),
    'binary', jsonb_build_object(
      'artifact_role', 'SIGNED_OUTPUT',
      'signature_packaging', v_signature_packaging,
      'storage_path', p_storage_path,
      'storage_object_id', p_provider_payload ->> 'storage_object_id',
      'storage_version', p_provider_payload ->> 'storage_version',
      'retrieved_at', p_provider_payload ->> 'storage_retrieved_at',
      'hash_sha256', p_signed_output_hash_sha256,
      'hash_sha512', p_signed_output_hash_sha512
    ),
    'verification', jsonb_build_object(
      'trust_boundary', 'SERVICE_SIGNATURE_RECONCILIATION',
      'provider', 'EAD_TRUST',
      'signature_request_id', v_request.id,
      'provider_request_id', v_request.sr_id,
      'provider_document_id', v_request.document_id,
      'provider_signature_type', p_provider_signature_type,
      'signature_packaging', v_signature_packaging,
      'completion_certificate_ref', p_completion_certificate_ref,
      'completion_package_ref', p_completion_package_ref,
      'input_output_binding', p_provider_payload -> 'input_output_binding',
      'certificate_fingerprint_sha256', p_certificate_fingerprint_sha256,
      'signed_at', p_signed_at,
      'provider_completed_at', v_provider_completed_at,
      'sandbox', false
    ),
    'metadata', jsonb_build_object(
      'recordId', p_source_id,
      'processKind', v_expected_process_kind,
      'contentHash', p_content_hash_sha256,
      'sandbox', false
    )
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  IF v_request.evidence_id IS NOT NULL THEN
    SELECT * INTO v_existing_bundle
    FROM public.evidence_bundles
    WHERE id = v_request.evidence_id
      AND tenant_id = v_tenant_id;
    IF NOT FOUND
       OR v_existing_bundle.status <> 'VERIFIED'
       OR v_existing_bundle.hash_sha512 IS DISTINCT FROM p_signed_output_hash_sha512
       OR v_existing_bundle.storage_path IS DISTINCT FROM p_storage_path
       OR v_existing_bundle.manifest_hash IS DISTINCT FROM v_manifest_hash
       OR v_existing_bundle.manifest IS DISTINCT FROM v_manifest THEN
      RAISE EXCEPTION 'different or invalid EAD reconciliation evidence is already bound to the request';
    END IF;
    RETURN v_existing_bundle.id;
  END IF;

  INSERT INTO public.evidence_bundles (
    tenant_id,
    agreement_id,
    source_module,
    source_object_type,
    source_object_id,
    reference_code,
    manifest,
    manifest_hash,
    hash_sha512,
    storage_path,
    document_url,
    signed_by,
    signature_date,
    chain_of_custody,
    legal_hold,
    status
  ) VALUES (
    v_tenant_id,
    v_request.agreement_id,
    'secretaria',
    p_source_domain,
    p_source_id::text,
    'EAD-SR-' || v_request.sr_id,
    v_manifest,
    v_manifest_hash,
    p_signed_output_hash_sha512,
    p_storage_path,
    'evidence-bundle://' || p_storage_path,
    'EAD Trust Digital Trust API',
    p_signed_at,
    jsonb_build_array(jsonb_build_object(
      'event', 'EAD_SIGNATURE_RECONCILED',
      'ts', now(),
      'signature_request_id', v_request.id,
      'request_input_hash_sha256', lower(v_request.document_hash),
      'signed_output_hash_sha256', p_signed_output_hash_sha256,
      'signed_output_hash_sha512', p_signed_output_hash_sha512,
      'completion_certificate_ref', p_completion_certificate_ref,
      'completion_package_ref', p_completion_package_ref,
      'signature_packaging', v_signature_packaging
    )),
    true,
    'VERIFIED'
  ) RETURNING id INTO v_bundle_id;

  UPDATE public.qtsp_signature_requests
     SET evidence_id = v_bundle_id,
         completed_at = v_provider_completed_at,
         evidence_status = CASE
           WHEN p_provider_signature_type = 'ADVANCED' THEN 'EAD_ADVANCED_EVIDENCE_VERIFIED'
           ELSE 'EAD_INTERPOSITION_EVIDENCE_VERIFIED'
         END
   WHERE id = v_request.id;

  RETURN v_bundle_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_reconcile_verified_ead_bundle(
  text, uuid, uuid, text, text, text, text, text, text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_reconcile_verified_ead_bundle(
  text, uuid, uuid, text, text, text, text, text, text, text, timestamptz, text, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_final_legal_artifact(
  p_source_domain text,
  p_source_id uuid,
  p_artifact_kind text,
  p_evidence_bundle_id uuid,
  p_content_hash_sha256 text,
  p_binary_hash_sha256 text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_expected_hash text;
  v_expected_process_kind text;
  v_existing_artifact_id uuid;
  v_source_legal_gate_status text;
  v_source_signature_status text;
  v_source_signed_at timestamptz;
  v_source_is_locked boolean;
  v_source_content text;
  v_source_authoritative_manifest jsonb;
  v_source_authoritative_manifest_hash text;
  v_existing_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_bundle record;
  v_signature_packaging text;
  v_request_input_hash text;
  v_manifest jsonb;
  v_manifest_hash text;
  v_artifact_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'final legal artifact registration requires service_role reconciliation'
      USING ERRCODE = '42501';
  END IF;

  p_source_domain := upper(COALESCE(btrim(p_source_domain), ''));
  p_artifact_kind := upper(COALESCE(btrim(p_artifact_kind), ''));
  IF (p_source_domain, p_artifact_kind) NOT IN (
    ('MINUTE', 'MINUTE_FINAL'),
    ('CERTIFICATION', 'CERTIFICATION_FINAL')
  ) THEN
    RAISE EXCEPTION 'unsupported legal artifact source/kind';
  END IF;

  IF p_source_domain = 'MINUTE' THEN
    SELECT tenant_id, content_hash, final_legal_artifact_id, legal_gate_status, signed_at, is_locked,
           content, authoritative_manifest, authoritative_manifest_hash
      INTO v_tenant_id, v_expected_hash, v_existing_artifact_id,
           v_source_legal_gate_status, v_source_signed_at, v_source_is_locked,
           v_source_content, v_source_authoritative_manifest, v_source_authoritative_manifest_hash
      FROM public.minutes
     WHERE id = p_source_id
     FOR UPDATE;
    v_expected_process_kind := 'ACTA';
  ELSE
    SELECT tenant_id, encode(digest(content, 'sha256'), 'hex'), final_legal_artifact_id,
           legal_gate_status, signature_status, content,
           authoritative_manifest, authoritative_manifest_hash
      INTO v_tenant_id, v_expected_hash, v_existing_artifact_id,
           v_source_legal_gate_status, v_source_signature_status, v_source_content,
           v_source_authoritative_manifest, v_source_authoritative_manifest_hash
      FROM public.certifications
     WHERE id = p_source_id
       AND COALESCE(btrim(content), '') <> ''
     FOR UPDATE;
    v_expected_process_kind := 'CERTIFICACION';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'legal artifact source is missing or not in a finalizable state';
  END IF;

  IF p_content_hash_sha256 IS DISTINCT FROM v_expected_hash THEN
    RAISE EXCEPTION 'legal artifact content hash does not match canonical domain content';
  END IF;
  IF v_source_authoritative_manifest IS NULL
     OR v_source_authoritative_manifest_hash IS NULL
     OR v_source_authoritative_manifest_hash !~ '^[0-9a-f]{64}$'
     OR encode(digest(v_source_authoritative_manifest::text, 'sha256'), 'hex')
          IS DISTINCT FROM v_source_authoritative_manifest_hash
     OR encode(digest(v_source_content, 'sha256'), 'hex') IS DISTINCT FROM v_expected_hash
     OR (
       p_source_domain = 'MINUTE'
       AND public.fn_secretaria_render_authoritative_minute(v_source_authoritative_manifest)
            IS DISTINCT FROM v_source_content
     )
     OR (
       p_source_domain = 'CERTIFICATION'
       AND public.fn_secretaria_render_authoritative_certification(v_source_authoritative_manifest)
            IS DISTINCT FROM v_source_content
     ) THEN
    RAISE EXCEPTION 'legal artifact source content is not the deterministic server render of its authoritative manifest';
  END IF;
  IF v_existing_artifact_id IS NULL AND (
    (p_source_domain = 'MINUTE' AND (
      v_source_signed_at IS NOT NULL
      OR v_source_is_locked IS TRUE
      OR v_source_legal_gate_status <> 'MANIFEST_READY'
    ))
    OR
    (p_source_domain = 'CERTIFICATION' AND (
      v_source_signature_status <> 'PENDING'
      OR v_source_legal_gate_status <> 'DRAFT'
    ))
  ) THEN
    RAISE EXCEPTION 'legal artifact source is not in a finalizable state';
  END IF;

  SELECT * INTO v_bundle
    FROM public.evidence_bundles eb
   WHERE eb.id = p_evidence_bundle_id
     AND eb.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'legal artifact evidence bundle not found in tenant';
  END IF;
  v_signature_packaging := upper(COALESCE(
    NULLIF(btrim(v_bundle.manifest #>> '{verification,signature_packaging}'), ''),
    NULLIF(btrim(v_bundle.manifest #>> '{signature_origin,signature_packaging}'), '')
  ));
  v_request_input_hash := lower(COALESCE(
    NULLIF(btrim(v_bundle.manifest #>> '{signature_origin,request_input_hash_sha256}'), ''),
    NULLIF(btrim(v_bundle.manifest #>> '{verification,request_input_hash_sha256}'), '')
  ));
  IF v_bundle.status <> 'VERIFIED'
     OR v_bundle.hash_sha512 IS NULL
     OR v_bundle.hash_sha512 !~ '^[0-9a-f]{128}$'
     OR v_bundle.manifest IS NULL
     OR v_bundle.manifest_hash IS NULL
     OR v_bundle.manifest_hash !~ '^[0-9a-f]{64}$'
     OR encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') IS DISTINCT FROM v_bundle.manifest_hash
     OR COALESCE(btrim(v_bundle.storage_path), '') = ''
     OR v_bundle.manifest #>> '{verification,trust_boundary}' <> 'SERVICE_EARCHIVE'
     OR v_bundle.manifest #>> '{verification,provider}' <> 'EAD_TRUST'
     OR v_bundle.manifest #>> '{verification,service}' <> 'EVIDENCE_MANAGER'
     OR v_signature_packaging NOT IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION')
     OR v_request_input_hash !~ '^[0-9a-f]{64}$'
     OR (
       v_signature_packaging = 'ENVELOPED'
       AND v_request_input_hash = p_binary_hash_sha256
     )
     OR lower(COALESCE(v_bundle.manifest #>> '{verification,sandbox}', 'false')) = 'true'
     OR v_bundle.manifest #>> '{source,domain}' IS DISTINCT FROM p_source_domain
     OR v_bundle.manifest #>> '{source,id}' IS DISTINCT FROM p_source_id::text
     OR v_bundle.manifest #>> '{source,process_kind}' IS DISTINCT FROM v_expected_process_kind
     OR v_bundle.manifest #>> '{source,content_hash_sha256}' IS DISTINCT FROM p_content_hash_sha256
     OR v_bundle.manifest #>> '{binary,artifact_role}' <> 'SIGNED_OUTPUT'
     OR v_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM p_binary_hash_sha256
     OR v_bundle.manifest #>> '{binary,hash_sha512}' IS DISTINCT FROM v_bundle.hash_sha512
     OR v_bundle.manifest #>> '{binary,storage_path}' IS DISTINCT FROM v_bundle.storage_path THEN
    RAISE EXCEPTION 'legal artifact requires a VERIFIED EAD Evidence Manager e-archive bound to source and final binary';
  END IF;
  IF p_binary_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'legal artifact binary SHA-256 is invalid';
  END IF;

  IF v_existing_artifact_id IS NOT NULL THEN
    SELECT * INTO v_existing_artifact
      FROM public.secretaria_legal_artifacts
     WHERE id = v_existing_artifact_id
       AND tenant_id = v_tenant_id;
    IF FOUND
       AND v_existing_artifact.source_domain = p_source_domain
       AND v_existing_artifact.source_id = p_source_id
       AND v_existing_artifact.artifact_kind = p_artifact_kind
       AND v_existing_artifact.content_hash_sha256 = p_content_hash_sha256
       AND v_existing_artifact.binary_hash_sha256 = p_binary_hash_sha256
       AND v_existing_artifact.binary_hash_sha512 = v_bundle.hash_sha512
       AND v_existing_artifact.signature_packaging = v_signature_packaging
       AND v_existing_artifact.evidence_bundle_id = p_evidence_bundle_id
       AND v_existing_artifact.artifact_status = 'FINAL_IMMUTABLE' THEN
      RETURN v_existing_artifact.id;
    END IF;
    RAISE EXCEPTION 'different final legal artifact is already bound to source';
  END IF;

  IF p_source_domain = 'CERTIFICATION' AND EXISTS (
    SELECT 1
    FROM public.certifications c
    CROSS JOIN LATERAL unnest(c.agreements_certified) ref
    JOIN public.agreements a ON a.id::text = ref
    JOIN public.minutes source_minute
      ON source_minute.id = c.minute_id
     AND source_minute.tenant_id = c.tenant_id
    JOIN public.meeting_resolutions mr
      ON mr.agreement_id = a.id
     AND mr.tenant_id = a.tenant_id
     AND mr.meeting_id = source_minute.meeting_id
    WHERE c.id = p_source_id
      AND (
        position(COALESCE(NULLIF(btrim(a.decision_text), ''), btrim(a.proposal_text)) IN c.content) = 0
        OR position(btrim(mr.resolution_text) IN c.content) = 0
      )
  ) THEN
    RAISE EXCEPTION 'certification final content omits the exact adopted resolution/agreement text';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'authoritative-legal-artifact.v1',
    'tenant_id', v_tenant_id,
    'source_domain', p_source_domain,
    'source_id', p_source_id,
    'artifact_kind', p_artifact_kind,
    'content_hash_sha256', p_content_hash_sha256,
    'binary_hash_sha256', p_binary_hash_sha256,
    'binary_hash_sha512', v_bundle.hash_sha512,
    'signature_packaging', v_signature_packaging,
    'evidence_bundle_id', v_bundle.id,
    'evidence_manifest_hash', v_bundle.manifest_hash,
    'storage_path', v_bundle.storage_path,
    'source_authoritative_manifest_hash', v_source_authoritative_manifest_hash
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  INSERT INTO public.secretaria_legal_artifacts (
    tenant_id,
    source_domain,
    source_id,
    artifact_kind,
    content_hash_sha256,
    binary_hash_sha256,
    binary_hash_sha512,
    signature_packaging,
    evidence_bundle_id,
    evidence_manifest_hash,
    server_manifest,
    server_manifest_hash,
    artifact_status,
    immutable_at,
    created_by
  ) VALUES (
    v_tenant_id,
    p_source_domain,
    p_source_id,
    p_artifact_kind,
    p_content_hash_sha256,
    p_binary_hash_sha256,
    v_bundle.hash_sha512,
    v_signature_packaging,
    v_bundle.id,
    v_bundle.manifest_hash,
    v_manifest,
    v_manifest_hash,
    'FINAL_IMMUTABLE',
    now(),
    auth.uid()
  )
  RETURNING id INTO v_artifact_id;

  IF p_source_domain = 'MINUTE' THEN
    UPDATE public.minutes
       SET final_legal_artifact_id = v_artifact_id,
           legal_gate_status = 'ARTIFACT_FINAL'
     WHERE id = p_source_id;
  ELSE
    UPDATE public.certifications
       SET final_legal_artifact_id = v_artifact_id,
           evidence_id = p_evidence_bundle_id,
           content_hash_sha256 = p_content_hash_sha256,
           legal_gate_status = 'ARTIFACT_FINAL'
     WHERE id = p_source_id;
  END IF;

  RETURN v_artifact_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_final_legal_artifact(text, uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_final_legal_artifact(text, uuid, text, uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_verified_qtsp_signature(
  p_legal_artifact_id uuid,
  p_signature_request_id uuid,
  p_signer_person_id uuid,
  p_signer_role text,
  p_certificate_fingerprint_sha256 text,
  p_verification_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_request public.qtsp_signature_requests%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_verification_id uuid;
  v_provider_reference text;
  v_signature_packaging text;
BEGIN
  -- La verificación criptográfica/proveedor se registra únicamente desde el
  -- reconciliador confiable. Un usuario autenticado no puede autocertificarla.
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'verified QTSP evidence requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF upper(COALESCE(p_signer_role, '')) NOT IN (
    'PRESIDENTE', 'SECRETARIO', 'CERTIFICANTE', 'VISTO_BUENO'
  ) THEN
    RAISE EXCEPTION 'unsupported authoritative signer role';
  END IF;
  IF p_certificate_fingerprint_sha256 IS NOT NULL
     AND p_certificate_fingerprint_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'certificate fingerprint must be SHA-256 when supplied';
  END IF;
  IF p_verification_payload IS NULL
     OR jsonb_typeof(p_verification_payload) <> 'object'
     OR lower(COALESCE(p_verification_payload ->> 'sandbox', 'false')) = 'true'
     OR upper(COALESCE(p_verification_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_verification_payload ->> 'provider_signature_type', '')) NOT IN ('INTERPOSITION', 'ADVANCED')
     OR upper(COALESCE(p_verification_payload ->> 'provider_document_status', '')) NOT IN ('SIGNED', 'CERTIFIED')
     OR COALESCE(btrim(p_verification_payload ->> 'provider_signatory_id'), '') = ''
     OR upper(COALESCE(p_verification_payload ->> 'provider_signatory_status', '')) <> 'COMPLETED'
     OR p_verification_payload ->> 'signer_person_id' IS DISTINCT FROM p_signer_person_id::text
     OR COALESCE(btrim(p_verification_payload ->> 'completion_certificate_ref'), '') = ''
     OR COALESCE(btrim(p_verification_payload ->> 'completion_package_ref'), '') = ''
     OR COALESCE(p_verification_payload #>> '{input_output_binding,status}', '') <> 'SERVICE_HASH_VERIFIED'
     OR COALESCE(btrim(p_verification_payload #>> '{input_output_binding,signed_document_ref}'), '') = '' THEN
    RAISE EXCEPTION 'QTSP verification payload must be real EAD Trust evidence, never sandbox';
  END IF;
  v_signature_packaging := upper(COALESCE(
    NULLIF(btrim(p_verification_payload ->> 'signature_packaging'), ''),
    NULLIF(btrim(p_verification_payload #>> '{input_output_binding,signature_packaging}'), '')
  ));
  IF v_signature_packaging NOT IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION') THEN
    RAISE EXCEPTION 'QTSP verification payload requires the actual signature packaging';
  END IF;

  SELECT * INTO v_artifact
    FROM public.secretaria_legal_artifacts
   WHERE id = p_legal_artifact_id
     AND artifact_status = 'FINAL_IMMUTABLE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'final legal artifact not found';
  END IF;

  SELECT * INTO v_request
    FROM public.qtsp_signature_requests
   WHERE id = p_signature_request_id
     AND tenant_id = v_artifact.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QTSP signature request not found in artifact tenant';
  END IF;
  IF v_request.sr_status <> 'COMPLETED'
     OR v_request.completed_at IS NULL
     OR COALESCE(btrim(v_request.sr_id), '') = ''
     OR COALESCE(btrim(v_request.document_id), '') = ''
     OR v_request.source_domain IS DISTINCT FROM v_artifact.source_domain
     OR v_request.source_id IS DISTINCT FROM v_artifact.source_id
     OR v_request.artifact_kind IS DISTINCT FROM v_artifact.artifact_kind
     OR lower(COALESCE(v_request.content_hash_sha256, ''))
          IS DISTINCT FROM v_artifact.content_hash_sha256
     OR v_request.evidence_id IS NULL
     OR upper(COALESCE(v_request.evidence_status, '')) NOT IN (
       'EAD_INTERPOSITION_EVIDENCE_VERIFIED',
       'EAD_ADVANCED_EVIDENCE_VERIFIED'
     )
     OR upper(COALESCE(v_request.evidence_status, '')) LIKE '%SANDBOX%'
     OR lower(COALESCE(v_request.document_hash, ''))
          <> lower(COALESCE(p_verification_payload #>> '{input_output_binding,request_input_hash_sha256}', ''))
     OR lower(COALESCE(p_verification_payload #>> '{input_output_binding,signed_output_hash_sha256}', ''))
          <> v_artifact.binary_hash_sha256
     OR lower(COALESCE(p_verification_payload #>> '{input_output_binding,signed_output_hash_sha512}', ''))
          <> v_artifact.binary_hash_sha512
     OR v_artifact.signature_packaging IS DISTINCT FROM v_signature_packaging
     OR (
       v_signature_packaging = 'ENVELOPED'
       AND lower(v_request.document_hash) = v_artifact.binary_hash_sha256
     )
     OR v_request.requested_at IS NULL
     OR v_request.completed_at IS NULL
     OR v_request.requested_at > v_request.completed_at
     OR v_request.completed_at IS DISTINCT FROM
          NULLIF(p_verification_payload ->> 'provider_completed_at', '')::timestamptz
     OR (
       SELECT count(*)
       FROM jsonb_array_elements(COALESCE(v_request.signatories, '[]'::jsonb)) signer
       WHERE signer ->> 'provider_signatory_id' = p_verification_payload ->> 'provider_signatory_id'
         AND signer ->> 'person_id' = p_signer_person_id::text
         AND upper(COALESCE(signer ->> 'signer_role', '')) = upper(p_signer_role)
         AND signer ->> 'authority_evidence_id' = p_verification_payload ->> 'authority_evidence_id'
         AND upper(COALESCE(signer ->> 'provider_signature_type', ''))
               = upper(p_verification_payload ->> 'provider_signature_type')
         AND signer ->> 'source_domain' = v_artifact.source_domain
         AND signer ->> 'source_id' = v_artifact.source_id::text
         AND signer ->> 'artifact_kind' = v_artifact.artifact_kind
         AND lower(COALESCE(signer ->> 'content_hash_sha256', '')) = v_artifact.content_hash_sha256
     ) <> 1 THEN
    RAISE EXCEPTION 'QTSP request, signer, packaging and output are not explicitly bound by completed EAD evidence';
  END IF;

  SELECT * INTO v_bundle
    FROM public.evidence_bundles
   WHERE id = v_request.evidence_id
     AND tenant_id = v_artifact.tenant_id;
  IF NOT FOUND
     OR v_bundle.status <> 'VERIFIED'
     OR v_bundle.hash_sha512 IS DISTINCT FROM v_artifact.binary_hash_sha512
     OR v_bundle.manifest #>> '{binary,artifact_role}' <> 'SIGNED_OUTPUT'
     OR v_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM v_artifact.binary_hash_sha256
     OR v_bundle.manifest #>> '{binary,signature_packaging}' IS DISTINCT FROM v_signature_packaging
     OR v_bundle.manifest #>> '{request_input,hash_sha256}' IS DISTINCT FROM lower(v_request.document_hash)
     OR v_bundle.manifest #>> '{verification,trust_boundary}' <> 'SERVICE_SIGNATURE_RECONCILIATION'
     OR v_bundle.manifest #>> '{verification,provider}' <> 'EAD_TRUST'
     OR v_bundle.manifest #>> '{verification,provider_signature_type}'
          IS DISTINCT FROM upper(p_verification_payload ->> 'provider_signature_type')
     OR v_bundle.manifest #>> '{verification,signature_packaging}'
          IS DISTINCT FROM v_signature_packaging
     OR v_bundle.manifest #>> '{verification,completion_certificate_ref}'
          IS DISTINCT FROM p_verification_payload ->> 'completion_certificate_ref'
     OR v_bundle.manifest #>> '{verification,completion_package_ref}'
          IS DISTINCT FROM p_verification_payload ->> 'completion_package_ref'
     OR v_bundle.manifest #>> '{verification,input_output_binding,status}' <> 'SERVICE_HASH_VERIFIED'
     OR v_bundle.manifest #>> '{verification,input_output_binding,request_input_hash_sha256}'
          IS DISTINCT FROM lower(v_request.document_hash)
     OR v_bundle.manifest #>> '{verification,input_output_binding,signed_output_hash_sha256}'
          IS DISTINCT FROM v_artifact.binary_hash_sha256
     OR v_bundle.manifest #>> '{verification,input_output_binding,signed_output_hash_sha512}'
          IS DISTINCT FROM v_artifact.binary_hash_sha512
     OR v_bundle.manifest #>> '{verification,input_output_binding,signature_packaging}'
          IS DISTINCT FROM v_signature_packaging
     OR NULLIF(v_bundle.manifest #>> '{verification,provider_completed_at}', '')::timestamptz
          IS DISTINCT FROM v_request.completed_at
     OR v_bundle.manifest_hash IS NULL
     OR COALESCE(btrim(v_bundle.storage_path), '') = ''
     OR lower(COALESCE(v_bundle.manifest #>> '{metadata,sandbox}', 'false')) = 'true' THEN
    RAISE EXCEPTION 'QTSP provider bundle is not VERIFIED or does not match final binary';
  END IF;

  v_provider_reference := v_request.sr_id || ':'
    || (p_verification_payload ->> 'provider_signatory_id');
  SELECT id INTO v_verification_id
    FROM public.secretaria_qtsp_verifications
   WHERE legal_artifact_id = v_artifact.id
     AND signer_role = upper(p_signer_role)
     AND signer_person_id = p_signer_person_id;
  IF FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.secretaria_qtsp_verifications verification
      WHERE verification.id = v_verification_id
        AND verification.signature_request_id = v_request.id
        AND verification.provider_reference = v_provider_reference
        AND verification.provider_evidence_bundle_id = v_bundle.id
        AND verification.request_input_hash_sha256 = lower(v_request.document_hash)
        AND verification.signed_output_hash_sha256 = v_artifact.binary_hash_sha256
        AND verification.signed_output_hash_sha512 = v_artifact.binary_hash_sha512
        AND verification.signature_packaging = v_signature_packaging
    ) THEN
      RETURN v_verification_id;
    END IF;
    RAISE EXCEPTION 'different EAD signatory evidence is already bound to signer role';
  END IF;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  INSERT INTO public.secretaria_qtsp_verifications (
    tenant_id,
    legal_artifact_id,
    signature_request_id,
    signer_person_id,
    signer_role,
    provider,
    provider_signature_type,
    signature_packaging,
    provider_reference,
    provider_evidence_bundle_id,
    certificate_fingerprint_sha256,
    request_input_hash_sha256,
    signed_output_hash_sha256,
    signed_output_hash_sha512,
    verification_status,
    verification_payload,
    verified_at,
    verified_by
  ) VALUES (
    v_artifact.tenant_id,
    v_artifact.id,
    v_request.id,
    p_signer_person_id,
    upper(p_signer_role),
    'EAD_TRUST',
    upper(p_verification_payload ->> 'provider_signature_type'),
    v_signature_packaging,
    v_provider_reference,
    v_bundle.id,
    p_certificate_fingerprint_sha256,
    lower(v_request.document_hash),
    v_artifact.binary_hash_sha256,
    v_artifact.binary_hash_sha512,
    'VERIFIED',
    p_verification_payload,
    v_request.completed_at,
    auth.uid()
  )
  RETURNING id INTO v_verification_id;

  RETURN v_verification_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_verified_qtsp_signature(uuid, uuid, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_verified_qtsp_signature(uuid, uuid, uuid, text, text, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Aprobación/firma de acta sobre artefacto final y dos consentimientos EAD
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_aprobar_acta_autoritativa(
  p_minute_id uuid,
  p_final_legal_artifact_id uuid,
  p_approval_method text,
  p_approval_effective_at timestamptz,
  p_president_consent_verification_id uuid,
  p_secretary_consent_verification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_meeting public.meetings%ROWTYPE;
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_president_verification public.secretaria_qtsp_verifications%ROWTYPE;
  v_secretary_verification public.secretaria_qtsp_verifications%ROWTYPE;
  v_current_manifest jsonb;
  v_current_manifest_hash text;
  v_signed_at timestamptz := now();
BEGIN
  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = p_minute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative approval: minute % not found', p_minute_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'authoritative approval tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_minute.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
    PERFORM public.fn_secretaria_assert_capability(v_minute.tenant_id, 'CERTIFICATION');
  END IF;

  IF v_minute.legal_gate_status = 'APPROVED_SIGNED' THEN
    IF v_minute.final_legal_artifact_id = p_final_legal_artifact_id
       AND v_minute.president_consent_verification_id = p_president_consent_verification_id
       AND v_minute.secretary_consent_verification_id = p_secretary_consent_verification_id THEN
      RETURN jsonb_build_object(
        'minute_id', v_minute.id,
        'signed_at', v_minute.signed_at,
        'already_signed', true,
        'legal_gate_status', v_minute.legal_gate_status
      );
    END IF;
    RAISE EXCEPTION 'authoritative approval: minute already signed with different evidence';
  END IF;

  IF v_minute.signed_at IS NOT NULL
     OR v_minute.is_locked
     OR v_minute.legal_gate_status <> 'ARTIFACT_FINAL'
     OR v_minute.final_legal_artifact_id IS DISTINCT FROM p_final_legal_artifact_id THEN
    RAISE EXCEPTION 'authoritative approval: minute is not bound to the supplied final artifact';
  END IF;
  IF v_minute.book_section_id IS NULL
     OR v_minute.book_destination_status <> 'RESOLVED' THEN
    RAISE EXCEPTION 'authoritative approval: minute requires a resolved book destination';
  END IF;

  SELECT * INTO v_meeting
    FROM public.meetings
   WHERE id = v_minute.meeting_id
     AND tenant_id = v_minute.tenant_id;
  IF NOT FOUND OR v_meeting.status <> 'CELEBRADA' THEN
    RAISE EXCEPTION 'authoritative approval: meeting must be CELEBRADA';
  END IF;

  IF p_approval_method NOT IN ('AL_FINAL_SESION', 'DENTRO_15_DIAS') THEN
    RAISE EXCEPTION
      'authoritative approval: POR_ACTA_NOTARIAL requires a separate notarial instrument/protocol gate';
  END IF;

  SELECT * INTO v_artifact
    FROM public.secretaria_legal_artifacts
   WHERE id = p_final_legal_artifact_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id
     AND artifact_kind = 'MINUTE_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE';
  IF NOT FOUND
     OR v_artifact.content_hash_sha256 IS DISTINCT FROM v_minute.content_hash THEN
    RAISE EXCEPTION 'authoritative approval: final artifact does not match minute content';
  END IF;

  v_current_manifest := public.fn_secretaria_build_minute_legal_manifest(
    v_minute.meeting_id,
    v_minute.snapshot_id,
    v_minute.content_hash
  );
  v_current_manifest_hash := encode(digest(v_current_manifest::text, 'sha256'), 'hex');
  IF v_current_manifest_hash IS DISTINCT FROM v_minute.authoritative_manifest_hash
     OR v_current_manifest IS DISTINCT FROM v_minute.authoritative_manifest
     OR v_minute.canonical_minutes_hash IS DISTINCT FROM v_current_manifest_hash THEN
    RAISE EXCEPTION 'authoritative approval: meeting facts drifted after minute manifest';
  END IF;

  SELECT * INTO v_president_verification
    FROM public.secretaria_qtsp_verifications
   WHERE id = p_president_consent_verification_id
     AND tenant_id = v_minute.tenant_id
     AND legal_artifact_id = v_artifact.id
     AND signer_role = 'PRESIDENTE'
     AND verification_status = 'VERIFIED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative approval: verified president consent missing';
  END IF;

  SELECT * INTO v_secretary_verification
    FROM public.secretaria_qtsp_verifications
   WHERE id = p_secretary_consent_verification_id
     AND tenant_id = v_minute.tenant_id
     AND legal_artifact_id = v_artifact.id
     AND signer_role = 'SECRETARIO'
     AND verification_status = 'VERIFIED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative approval: verified secretary consent missing';
  END IF;

  IF v_president_verification.signer_person_id IS DISTINCT FROM v_meeting.president_id
     OR v_secretary_verification.signer_person_id IS DISTINCT FROM v_meeting.secretary_id THEN
    RAISE EXCEPTION 'authoritative approval: EAD signers must be the chair and secretary attributed in the frozen meeting manifest';
  END IF;

  IF v_president_verification.id = v_secretary_verification.id
     OR v_president_verification.signer_person_id = v_secretary_verification.signer_person_id
     OR v_president_verification.provider_reference = v_secretary_verification.provider_reference THEN
    RAISE EXCEPTION 'authoritative approval: president and secretary require distinct persons and individual EAD signatory evidence';
  END IF;

  IF abs(extract(epoch FROM (
       v_president_verification.verified_at - v_secretary_verification.verified_at
     ))) > 300 THEN
    RAISE EXCEPTION 'authoritative approval: both signatory verifications must belong to the same EAD signing event';
  END IF;

  v_signed_at := GREATEST(
    v_president_verification.verified_at,
    v_secretary_verification.verified_at
  );
  IF v_signed_at IS NULL
     OR v_signed_at > now()
     OR v_signed_at < v_meeting.scheduled_end
     OR p_approval_effective_at IS NULL
     OR abs(extract(epoch FROM (p_approval_effective_at - v_signed_at))) > 300 THEN
    RAISE EXCEPTION 'authoritative approval: effective time must match the provider signing event after session close';
  END IF;
  IF p_approval_method = 'AL_FINAL_SESION'
     AND v_signed_at > v_meeting.scheduled_end + interval '2 hours' THEN
    RAISE EXCEPTION 'authoritative approval: AL_FINAL_SESION requires the provider signing event at session close';
  END IF;
  IF p_approval_method = 'DENTRO_15_DIAS'
     AND v_signed_at > v_meeting.scheduled_end + interval '15 days' THEN
    RAISE EXCEPTION 'authoritative approval: DENTRO_15_DIAS exceeds the statutory maximum';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_minute.tenant_id
      AND ae.entity_id = v_minute.entity_id
      AND ae.body_id = v_minute.body_id
      AND ae.person_id = v_president_verification.signer_person_id
      AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
      AND ae.estado = 'VIGENTE'
      AND ae.fecha_inicio <= v_signed_at::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_signed_at::date)
  ) THEN
    RAISE EXCEPTION 'authoritative approval: president signer lacks current body authority';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_minute.tenant_id
      AND ae.entity_id = v_minute.entity_id
      AND ae.body_id = v_minute.body_id
      AND ae.person_id = v_secretary_verification.signer_person_id
      AND ae.cargo IN ('SECRETARIO', 'VICESECRETARIO')
      AND ae.estado = 'VIGENTE'
      AND ae.fecha_inicio <= v_signed_at::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_signed_at::date)
  ) THEN
    RAISE EXCEPTION 'authoritative approval: secretary signer lacks current body authority';
  END IF;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.minutes
     SET signed_at = v_signed_at,
         is_locked = true,
         signed_by_president_id = v_president_verification.signer_person_id,
         signed_by_secretary_id = v_secretary_verification.signer_person_id,
         approval_method = p_approval_method,
         approval_effective_at = v_signed_at,
         president_consent_verification_id = v_president_verification.id,
         secretary_consent_verification_id = v_secretary_verification.id,
         legal_gate_status = 'APPROVED_SIGNED'
   WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'signed_at', v_signed_at,
    'approval_effective_at', v_signed_at,
    'final_legal_artifact_id', v_artifact.id,
    'president_consent_verification_id', v_president_verification.id,
    'secretary_consent_verification_id', v_secretary_verification.id,
    'already_signed', false,
    'legal_gate_status', 'APPROVED_SIGNED'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_aprobar_acta_autoritativa(uuid, uuid, text, timestamptz, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aprobar_acta_autoritativa(uuid, uuid, text, timestamptz, uuid, uuid)
  TO authenticated, service_role;

-- La firma legacy no puede degradar los nuevos gates a ids declarados por UI.
CREATE OR REPLACE FUNCTION public.fn_aprobar_acta(
  p_minute_id uuid,
  p_president_persona_id uuid DEFAULT NULL,
  p_secretary_persona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RAISE EXCEPTION
    'authoritative legal gate: use fn_aprobar_acta_autoritativa with final artifact and two independent verified consents'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Certificación: cobertura server-side y firma exclusivamente sobre artefacto
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_certified_agreements_manifest(
  p_minute_id uuid,
  p_agreement_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_input_count integer;
  v_unique_count integer;
  v_valid_count integer;
  v_manifest jsonb;
BEGIN
  IF p_agreement_ids IS NULL OR cardinality(p_agreement_ids) = 0 THEN
    RAISE EXCEPTION 'certification requires at least one agreement UUID';
  END IF;
  SELECT count(*), count(DISTINCT value)
    INTO v_input_count, v_unique_count
    FROM unnest(p_agreement_ids) value;
  IF v_input_count <> v_unique_count OR array_position(p_agreement_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'certification agreement UUIDs must be non-null and unique';
  END IF;

  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = p_minute_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification minute not found';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM public.agreements a
  JOIN public.meeting_resolutions mr
    ON mr.agreement_id = a.id
   AND mr.tenant_id = a.tenant_id
   AND mr.meeting_id = v_minute.meeting_id
   AND mr.status = 'ADOPTED'
   AND mr.kind_resolution = 'DECISION'
  JOIN public.agenda_items ai
    ON ai.id = a.agenda_item_id
   AND ai.meeting_id = v_minute.meeting_id
   AND ai.order_number = mr.agenda_item_index
   AND ai.kind = 'DECISORIO'
  WHERE a.id = ANY(p_agreement_ids)
    AND a.tenant_id = v_minute.tenant_id
    AND a.parent_meeting_id = v_minute.meeting_id
    AND a.status IN ('ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED', 'REGISTERED', 'PUBLISHED')
    AND COALESCE(NULLIF(btrim(a.decision_text), ''), NULLIF(btrim(a.proposal_text), '')) IS NOT NULL;

  IF v_valid_count <> v_input_count THEN
    RAISE EXCEPTION 'certification UUID set contains agreements not adopted in the approved minute';
  END IF;

  SELECT jsonb_build_object(
    'schema_version', 'certified-agreements-manifest.v1',
    'minute_id', v_minute.id,
    'meeting_id', v_minute.meeting_id,
    'agreements', jsonb_agg(
      jsonb_build_object(
        'agreement_id', a.id,
        'agenda_item_id', a.agenda_item_id,
        'agenda_item_index', mr.agenda_item_index,
        'resolution_id', mr.id,
        'resolution_text', mr.resolution_text,
        'agreement_text', COALESCE(NULLIF(a.decision_text, ''), a.proposal_text),
        'adoption_status', mr.status,
        'resolution_status', mr.status,
        'annual_accounts', CASE
          WHEN upper(COALESCE(ai.matter_code, '')) = 'FORMULACION_CUENTAS'
            THEN public.fn_secretaria_validate_annual_accounts_point(
              v_minute.meeting_id,
              ai.id
            )
          ELSE 'null'::jsonb
        END
      ) ORDER BY a.id
    )
  ) INTO v_manifest
  FROM public.agreements a
  JOIN public.meeting_resolutions mr
    ON mr.agreement_id = a.id
   AND mr.tenant_id = a.tenant_id
   AND mr.meeting_id = v_minute.meeting_id
  JOIN public.agenda_items ai
    ON ai.id = a.agenda_item_id
   AND ai.meeting_id = v_minute.meeting_id
   AND ai.order_number = mr.agenda_item_index
  WHERE a.id = ANY(p_agreement_ids)
    AND a.tenant_id = v_minute.tenant_id;

  RETURN v_manifest;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_certified_agreements_manifest(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_certified_agreements_manifest(uuid, uuid[])
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_build_certification_manifest(
  p_minute_id uuid,
  p_agreement_ids uuid[],
  p_authority_evidence_id uuid,
  p_visto_bueno_persona_id uuid,
  p_tipo text,
  p_prepared_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_meeting record;
  v_entry record;
  v_auth record;
  v_seen_by record;
  v_agreements jsonb;
BEGIN
  SELECT * INTO v_minute
  FROM public.minutes
  WHERE id = p_minute_id
    AND legal_gate_status = 'APPROVED_SIGNED'
    AND signed_at IS NOT NULL
    AND is_locked IS TRUE
    AND final_legal_artifact_id IS NOT NULL
    AND book_entry_id IS NOT NULL
    AND book_destination_status = 'POSTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification manifest requires an approved, signed and posted minute';
  END IF;

  IF p_prepared_at IS NULL
     OR p_prepared_at > now()
     OR p_prepared_at < v_minute.signed_at THEN
    RAISE EXCEPTION 'certification manifest requires a preparation time after minute approval';
  END IF;

  SELECT
    m.id AS meeting_id,
    m.scheduled_start,
    m.scheduled_end,
    m.location,
    e.id AS entity_id,
    e.legal_name AS entity_name,
    e.registration_number AS entity_tax_id,
    e.legal_form,
    COALESCE(e.city, e.registry_location, m.location) AS issue_place,
    gb.id AS body_id,
    gb.name AS body_name,
    gb.body_type
  INTO v_meeting
  FROM public.meetings m
  JOIN public.governing_bodies gb
    ON gb.id = m.body_id AND gb.tenant_id = m.tenant_id
  JOIN public.entities e
    ON e.id = gb.entity_id AND e.tenant_id = m.tenant_id
  WHERE m.id = v_minute.meeting_id
    AND m.tenant_id = v_minute.tenant_id;
  IF NOT FOUND
     OR COALESCE(btrim(v_meeting.entity_name), '') = ''
     OR COALESCE(btrim(v_meeting.entity_tax_id), '') = ''
     OR COALESCE(btrim(v_meeting.body_name), '') = ''
     OR COALESCE(btrim(v_meeting.issue_place), '') = '' THEN
    RAISE EXCEPTION 'certification manifest lacks identified entity, tax id, body or issue place';
  END IF;

  SELECT
    be.id AS entry_id,
    be.ordinal_number,
    be.recorded_at,
    be.source_hash,
    mb.id AS book_id,
    mb.book_kind,
    mb.volume_number,
    mb.period,
    bs.id AS section_id,
    bs.section_code,
    bs.section_label AS section_title
  INTO v_entry
  FROM public.societary_book_entries be
  JOIN public.mandatory_books mb
    ON mb.id = be.book_id AND mb.tenant_id = be.tenant_id
  LEFT JOIN public.societary_book_sections bs
    ON bs.id = be.section_id AND bs.tenant_id = be.tenant_id
  WHERE be.id = v_minute.book_entry_id
    AND be.tenant_id = v_minute.tenant_id
    AND be.source_domain = 'MINUTE'
    AND be.source_id = v_minute.id
    AND be.source_hash = v_minute.authoritative_manifest_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification manifest cannot resolve the immutable minute book entry';
  END IF;

  SELECT
    ae.*,
    p.full_name AS person_name,
    p.tax_id AS person_tax_id
  INTO v_auth
  FROM public.authority_evidence ae
  JOIN public.persons p
    ON p.id = ae.person_id AND p.tenant_id = ae.tenant_id
  WHERE ae.id = p_authority_evidence_id
    AND ae.tenant_id = v_minute.tenant_id
    AND ae.entity_id = v_meeting.entity_id
    AND ae.body_id = v_meeting.body_id
    AND ae.estado = 'VIGENTE'
    AND ae.fecha_inicio <= p_prepared_at::date
    AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= p_prepared_at::date)
    AND COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''
    AND ae.inscripcion_rm_fecha IS NOT NULL
    AND ae.inscripcion_rm_fecha <= p_prepared_at::date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification manifest lacks current registered certifier authority';
  END IF;

  IF p_visto_bueno_persona_id IS NOT NULL THEN
    SELECT
      ae.*,
      p.full_name AS person_name,
      p.tax_id AS person_tax_id
    INTO v_seen_by
    FROM public.authority_evidence ae
    JOIN public.persons p
      ON p.id = ae.person_id AND p.tenant_id = ae.tenant_id
    WHERE ae.tenant_id = v_minute.tenant_id
      AND ae.entity_id = v_meeting.entity_id
      AND ae.body_id = v_meeting.body_id
      AND ae.person_id = p_visto_bueno_persona_id
      AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
      AND ae.estado = 'VIGENTE'
      AND ae.fecha_inicio <= p_prepared_at::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= p_prepared_at::date)
      AND COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''
      AND ae.inscripcion_rm_fecha IS NOT NULL
      AND ae.inscripcion_rm_fecha <= p_prepared_at::date
    ORDER BY ae.fecha_inicio DESC, ae.id DESC
    LIMIT 1;
    IF v_seen_by.id IS NULL THEN
      RAISE EXCEPTION 'certification manifest lacks current registered approval authority';
    END IF;
  END IF;

  v_agreements := public.fn_secretaria_certified_agreements_manifest(
    p_minute_id,
    p_agreement_ids
  );

  RETURN jsonb_build_object(
    'schema_version', 'authoritative-certification-manifest.v1',
    'tenant_id', v_minute.tenant_id,
    'certification_type', p_tipo,
    'entity', jsonb_build_object(
      'id', v_meeting.entity_id,
      'legal_name', v_meeting.entity_name,
      'tax_id', v_meeting.entity_tax_id,
      'legal_form', v_meeting.legal_form
    ),
    'body', jsonb_build_object(
      'id', v_meeting.body_id,
      'name', v_meeting.body_name,
      'type', v_meeting.body_type
    ),
    'meeting', jsonb_build_object(
      'id', v_meeting.meeting_id,
      'scheduled_start', v_meeting.scheduled_start,
      'scheduled_end', v_meeting.scheduled_end,
      'location', v_meeting.location
    ),
    'minute', jsonb_build_object(
      'id', v_minute.id,
      'approval_method', v_minute.approval_method,
      'approval_effective_at', v_minute.approval_effective_at,
      'authoritative_manifest_hash', v_minute.authoritative_manifest_hash,
      'final_legal_artifact_id', v_minute.final_legal_artifact_id
    ),
    'book_entry', jsonb_build_object(
      'book_kind', v_entry.book_kind,
      'volume_number', v_entry.volume_number,
      'period', v_entry.period,
      'section_code', v_entry.section_code,
      'section_title', v_entry.section_title,
      'ordinal_number', v_entry.ordinal_number,
      'recorded_at', v_entry.recorded_at,
      'source_hash', v_entry.source_hash
    ),
    'certifier', jsonb_build_object(
      'person_id', v_auth.person_id,
      'name', v_auth.person_name,
      'tax_id', v_auth.person_tax_id,
      'role', v_auth.cargo,
      'authority_evidence_id', v_auth.id,
      'registry_reference', v_auth.inscripcion_rm_referencia,
      'registry_date', v_auth.inscripcion_rm_fecha
    ),
    'seen_by', CASE WHEN v_seen_by.id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object(
      'person_id', v_seen_by.person_id,
      'name', v_seen_by.person_name,
      'tax_id', v_seen_by.person_tax_id,
      'role', v_seen_by.cargo,
      'authority_evidence_id', v_seen_by.id,
      'registry_reference', v_seen_by.inscripcion_rm_referencia,
      'registry_date', v_seen_by.inscripcion_rm_fecha
    ) END,
    'agreements', v_agreements -> 'agreements',
    'issue', jsonb_build_object(
      'place', v_meeting.issue_place,
      'prepared_at', p_prepared_at
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_render_authoritative_certification(
  p_manifest jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
  v_agreement jsonb;
  v_index integer := 0;
BEGIN
  IF p_manifest IS NULL
     OR p_manifest ->> 'schema_version' <> 'authoritative-certification-manifest.v1'
     OR COALESCE(btrim(p_manifest #>> '{entity,legal_name}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{entity,tax_id}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{certifier,name}'), '') = ''
     OR COALESCE(btrim(p_manifest #>> '{certifier,role}'), '') = ''
     OR jsonb_typeof(p_manifest -> 'agreements') <> 'array'
     OR jsonb_array_length(p_manifest -> 'agreements') = 0 THEN
    RAISE EXCEPTION 'authoritative certification renderer requires a complete server manifest';
  END IF;

  v_text := format(
    'CERTIFICACIÓN POR EXTRACTO DE ACUERDOS\n\n'
    || '%s, en su condición de %s de %s, %s, NIF %s, '
    || 'con facultad certificante vigente e inscrita en el Registro Mercantil bajo la referencia %s,\n\n'
    || 'CERTIFICA\n\n'
    || '1. Que el %s celebró reunión desde %s hasta %s, en %s.\n'
    || '2. Que el acta fue aprobada mediante %s el %s, firmada electrónicamente y asentada en el libro %s, '
    || 'volumen %s, período %s, sección %s, asiento ordinal %s.\n\n'
    || '3. ACUERDOS CERTIFICADOS\n',
    p_manifest #>> '{certifier,name}',
    CASE p_manifest #>> '{certifier,role}'
      WHEN 'SECRETARIO' THEN 'secretario'
      WHEN 'VICESECRETARIO' THEN 'vicesecretario'
      WHEN 'ADMINISTRADOR_UNICO' THEN 'administrador único'
      WHEN 'ADMINISTRADOR_SOLIDARIO' THEN 'administrador solidario'
      ELSE lower(replace(p_manifest #>> '{certifier,role}', '_', ' '))
    END,
    p_manifest #>> '{entity,legal_name}',
    p_manifest #>> '{entity,legal_form}',
    p_manifest #>> '{entity,tax_id}',
    p_manifest #>> '{certifier,registry_reference}',
    p_manifest #>> '{body,name}',
    to_char(
      (p_manifest #>> '{meeting,scheduled_start}')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    to_char(
      (p_manifest #>> '{meeting,scheduled_end}')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    p_manifest #>> '{meeting,location}',
    CASE p_manifest #>> '{minute,approval_method}'
      WHEN 'AL_FINAL_SESION' THEN 'aprobación al finalizar la sesión'
      WHEN 'DENTRO_15_DIAS' THEN 'aprobación dentro de los quince días siguientes'
      ELSE 'el procedimiento legal acreditado'
    END,
    to_char(
      (p_manifest #>> '{minute,approval_effective_at}')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    CASE p_manifest #>> '{book_entry,book_kind}'
      WHEN 'ACTAS' THEN 'de actas'
      WHEN 'LIBRO_ACTAS' THEN 'de actas'
      ELSE lower(replace(p_manifest #>> '{book_entry,book_kind}', '_', ' '))
    END,
    p_manifest #>> '{book_entry,volume_number}',
    p_manifest #>> '{book_entry,period}',
    COALESCE(p_manifest #>> '{book_entry,section_title}', p_manifest #>> '{book_entry,section_code}'),
    p_manifest #>> '{book_entry,ordinal_number}'
  );

  FOR v_agreement IN
    SELECT value
    FROM jsonb_array_elements(p_manifest -> 'agreements')
    ORDER BY (value ->> 'agenda_item_index')::integer
  LOOP
    v_index := v_index + 1;
    v_text := v_text || format(
      E'\n%s. Punto %s.\nAcuerdo literal: %s\nResolución literal: %s\n',
      v_index,
      v_agreement ->> 'agenda_item_index',
      v_agreement ->> 'agreement_text',
      v_agreement ->> 'resolution_text'
    );
    IF jsonb_typeof(v_agreement -> 'annual_accounts') = 'object' THEN
      v_text := v_text || format(
        'Cuentas formuladas: ejercicio %s%s, versión %s, %s componentes, identificados de forma inmutable en el expediente electrónico.\n',
        v_agreement #>> '{annual_accounts,fiscal_year}',
        CASE WHEN lower(COALESCE(v_agreement #>> '{annual_accounts,is_consolidated}', 'false')) = 'true'
          THEN ' (consolidado)'
          ELSE ''
        END,
        v_agreement #>> '{annual_accounts,version_number}',
        v_agreement #>> '{annual_accounts,component_count}'
      );
    END IF;
  END LOOP;

  v_text := v_text || format(
    E'\n4. EXPEDICIÓN Y VISTO BUENO\nSe expide en %s el %s por %s, %s.\n',
    p_manifest #>> '{issue,place}',
    to_char(
      (p_manifest #>> '{issue,prepared_at}')::timestamptz AT TIME ZONE 'Europe/Madrid',
      'DD/MM/YYYY HH24:MI'
    ),
    p_manifest #>> '{certifier,name}',
    lower(replace(p_manifest #>> '{certifier,role}', '_', ' '))
  );
  IF jsonb_typeof(p_manifest -> 'seen_by') = 'object' THEN
    v_text := v_text || format(
      'Visto bueno de %s, %s, con autoridad registral %s.\n',
      p_manifest #>> '{seen_by,name}',
      lower(replace(p_manifest #>> '{seen_by,role}', '_', ' ')),
      p_manifest #>> '{seen_by,registry_reference}'
    );
  END IF;
  v_text := v_text || format(
    E'Cargo vigente y en ejercicio: %s.\n\nFirma de la Secretaría o del certificante\nIntervención electrónica EAD Trust vinculada al expediente final.\n',
    lower(replace(p_manifest #>> '{certifier,role}', '_', ' '))
  );
  IF jsonb_typeof(p_manifest -> 'seen_by') = 'object' THEN
    v_text := v_text ||
      E'\nVisto bueno de la Presidencia\nIntervención electrónica EAD Trust vinculada al expediente final.\n';
  END IF;
  v_text := v_text ||
    E'\nLa intervención por interposición resulta suficiente; la modalidad avanzada es opcional. El tipo y el empaquetado realmente prestados, junto con la evidencia de archivo electrónico, constarán exclusivamente en el expediente del proveedor.';

  RETURN v_text;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_build_certification_manifest(uuid, uuid[], uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_render_authoritative_certification(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_build_certification_manifest(uuid, uuid[], uuid, uuid, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_render_authoritative_certification(jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_generar_certificacion(
  p_minute_id uuid,
  p_tipo text,
  p_agreements_certified text[],
  p_certificante_role text,
  p_visto_bueno_persona_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_book_entry public.societary_book_entries%ROWTYPE;
  v_cert_id uuid;
  v_agreement_ids uuid[];
  v_agreement_manifest jsonb;
  v_agreement_manifest_hash text;
  v_certification_manifest jsonb;
  v_certification_manifest_hash text;
  v_certification_content text;
  v_certification_content_hash text;
  v_prepared_at timestamptz := clock_timestamp();
  v_gate_hash text;
  v_auth record;
  v_vb_auth record;
BEGIN
  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = p_minute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification: minute not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'authoritative certification tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_minute.tenant_id, 'CERTIFICATION');
  END IF;

  IF v_minute.signed_at IS NULL
     OR v_minute.is_locked IS NOT TRUE
     OR v_minute.legal_gate_status <> 'APPROVED_SIGNED'
     OR v_minute.final_legal_artifact_id IS NULL
     OR v_minute.book_entry_id IS NULL
     OR v_minute.book_destination_status <> 'POSTED' THEN
    RAISE EXCEPTION 'authoritative certification requires approved, independently signed and posted minute';
  END IF;

  SELECT * INTO v_artifact
    FROM public.secretaria_legal_artifacts
   WHERE id = v_minute.final_legal_artifact_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id
     AND artifact_kind = 'MINUTE_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE';
  IF NOT FOUND
     OR v_artifact.content_hash_sha256 IS DISTINCT FROM v_minute.content_hash THEN
    RAISE EXCEPTION 'authoritative certification: approved minute artifact mismatch';
  END IF;

  SELECT * INTO v_book_entry
    FROM public.societary_book_entries
   WHERE id = v_minute.book_entry_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id;
  IF NOT FOUND
     OR v_book_entry.source_hash IS DISTINCT FROM v_minute.authoritative_manifest_hash THEN
    RAISE EXCEPTION 'authoritative certification: minute book entry/hash mismatch';
  END IF;

  IF p_agreements_certified IS NULL OR cardinality(p_agreements_certified) = 0
     OR EXISTS (
       SELECT 1 FROM unnest(p_agreements_certified) ref
       WHERE ref IS NULL
          OR ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ) THEN
    RAISE EXCEPTION 'authoritative certification requires non-empty agreement UUIDs only';
  END IF;
  SELECT array_agg(DISTINCT ref::uuid ORDER BY ref::uuid)
    INTO v_agreement_ids
    FROM unnest(p_agreements_certified) ref;
  IF cardinality(v_agreement_ids) <> cardinality(p_agreements_certified) THEN
    RAISE EXCEPTION 'authoritative certification agreement UUIDs must be unique';
  END IF;

  v_agreement_manifest := public.fn_secretaria_certified_agreements_manifest(
    p_minute_id,
    v_agreement_ids
  );
  v_agreement_manifest_hash := encode(digest(v_agreement_manifest::text, 'sha256'), 'hex');

  SELECT ae.* INTO v_auth
    FROM public.authority_evidence ae
   WHERE ae.tenant_id = v_minute.tenant_id
     AND ae.entity_id = v_minute.entity_id
     AND ae.body_id = v_minute.body_id
     AND ae.cargo = p_certificante_role
     AND ae.estado = 'VIGENTE'
     AND ae.fecha_inicio <= current_date
     AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= current_date)
     AND COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''
     AND ae.inscripcion_rm_fecha IS NOT NULL
     AND ae.inscripcion_rm_fecha <= current_date
     AND (
       public.fn_secretaria_is_service_role() IS TRUE
       OR public.fn_secretaria_current_role_code() = 'ADMIN_TENANT'
       OR ae.person_id = public.fn_secretaria_current_person_id()
     )
   ORDER BY ae.fecha_inicio DESC
   LIMIT 1;
  IF v_auth.id IS NULL THEN
    RAISE EXCEPTION 'authoritative certification: caller lacks current certifier authority';
  END IF;

  IF p_certificante_role IN ('SECRETARIO', 'VICESECRETARIO') THEN
    IF p_visto_bueno_persona_id IS NULL THEN
      RAISE EXCEPTION 'authoritative certification: president/vice-president approval required';
    END IF;
    SELECT ae.* INTO v_vb_auth
      FROM public.authority_evidence ae
     WHERE ae.tenant_id = v_minute.tenant_id
       AND ae.entity_id = v_minute.entity_id
       AND ae.body_id = v_minute.body_id
       AND ae.person_id = p_visto_bueno_persona_id
       AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
       AND ae.estado = 'VIGENTE'
       AND ae.fecha_inicio <= current_date
       AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= current_date)
       AND COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''
       AND ae.inscripcion_rm_fecha IS NOT NULL
       AND ae.inscripcion_rm_fecha <= current_date
     ORDER BY ae.fecha_inicio DESC
     LIMIT 1;
    IF v_vb_auth.id IS NULL THEN
      RAISE EXCEPTION 'authoritative certification: current president/vice-president approval authority missing';
    END IF;
  ELSIF p_visto_bueno_persona_id IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative certification: unexpected approval person for non-secretary certifier';
  END IF;

  v_certification_manifest := public.fn_secretaria_build_certification_manifest(
    p_minute_id,
    v_agreement_ids,
    v_auth.id,
    p_visto_bueno_persona_id,
    p_tipo,
    v_prepared_at
  );
  v_certification_content := public.fn_secretaria_render_authoritative_certification(
    v_certification_manifest
  );
  v_certification_content_hash := encode(
    digest(v_certification_content, 'sha256'),
    'hex'
  );
  v_certification_manifest := jsonb_set(
    v_certification_manifest,
    '{content_hash_sha256}',
    to_jsonb(v_certification_content_hash),
    true
  );
  v_certification_manifest_hash := encode(
    digest(v_certification_manifest::text, 'sha256'),
    'hex'
  );

  v_gate_hash := encode(
    digest(
      v_minute.authoritative_manifest_hash
      || v_artifact.server_manifest_hash
      || v_book_entry.source_hash
      || v_agreement_manifest_hash
      || v_certification_manifest_hash,
      'sha256'
    ),
    'hex'
  );

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  INSERT INTO public.certifications (
    tenant_id,
    agreement_id,
    agreements_certified,
    certifier_id,
    content,
    content_hash_sha256,
    authoritative_manifest,
    authoritative_manifest_hash,
    minute_id,
    tipo_certificacion,
    certificante_role,
    visto_bueno_persona_id,
    visto_bueno_fecha,
    gate_hash,
    authority_evidence_id,
    requires_qualified_signature,
    signature_status,
    agreements_manifest_hash,
    required_ead_signature_type,
    legal_gate_status
  ) VALUES (
    v_minute.tenant_id,
    CASE WHEN cardinality(v_agreement_ids) = 1 THEN v_agreement_ids[1] ELSE NULL END,
    ARRAY(SELECT value::text FROM unnest(v_agreement_ids) value ORDER BY value),
    v_auth.person_id,
    v_certification_content,
    v_certification_content_hash,
    v_certification_manifest,
    v_certification_manifest_hash,
    p_minute_id,
    p_tipo,
    p_certificante_role,
    p_visto_bueno_persona_id,
    NULL,
    v_gate_hash,
    v_auth.id,
    false,
    'PENDING',
    v_agreement_manifest_hash,
    'INTERPOSITION',
    'DRAFT'
  )
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_generar_certificacion(uuid, text, text[], text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generar_certificacion(uuid, text, text[], text, uuid)
  TO authenticated, service_role;

-- Compatibility editor: the browser may request a refresh, but it can never
-- replace the legal body. The RPC re-renders from frozen server facts and only
-- records the client text hash as a non-authoritative audit claim.
CREATE OR REPLACE FUNCTION public.fn_actualizar_borrador_certificacion(
  p_certification_id uuid,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cert public.certifications%ROWTYPE;
  v_agreement_ids uuid[];
  v_manifest jsonb;
  v_content text;
  v_content_hash text;
  v_manifest_hash text;
  v_prepared_at timestamptz;
  v_client_hash text;
BEGIN
  SELECT * INTO v_cert
  FROM public.certifications
  WHERE id = p_certification_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification draft not found';
  END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_cert.tenant_id THEN
      RAISE EXCEPTION 'certification draft tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');
  END IF;
  IF v_cert.legal_gate_status <> 'DRAFT'
     OR v_cert.signature_status <> 'PENDING'
     OR v_cert.final_legal_artifact_id IS NOT NULL
     OR v_cert.evidence_id IS NOT NULL THEN
    RAISE EXCEPTION 'certification draft is no longer editable';
  END IF;

  SELECT array_agg(ref::uuid ORDER BY ref::uuid)
    INTO v_agreement_ids
    FROM unnest(v_cert.agreements_certified) ref;
  v_prepared_at := COALESCE(
    NULLIF(v_cert.authoritative_manifest #>> '{issue,prepared_at}', '')::timestamptz,
    v_cert.created_at
  );
  v_manifest := public.fn_secretaria_build_certification_manifest(
    v_cert.minute_id,
    v_agreement_ids,
    v_cert.authority_evidence_id,
    v_cert.visto_bueno_persona_id,
    v_cert.tipo_certificacion,
    v_prepared_at
  );
  v_content := public.fn_secretaria_render_authoritative_certification(v_manifest);
  v_content_hash := encode(digest(v_content, 'sha256'), 'hex');
  v_manifest := jsonb_set(
    v_manifest,
    '{content_hash_sha256}',
    to_jsonb(v_content_hash),
    true
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  IF COALESCE(btrim(p_content), '') <> '' THEN
    v_client_hash := encode(digest(p_content, 'sha256'), 'hex');
  END IF;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.certifications
     SET content = v_content,
         content_hash_sha256 = v_content_hash,
         authoritative_manifest = v_manifest,
         authoritative_manifest_hash = v_manifest_hash,
         jurisdictional_requirements = COALESCE(jurisdictional_requirements, '{}'::jsonb)
           || jsonb_build_object(
             'content_source', 'SERVER_MANIFEST_RENDER',
             'client_content_hash_ignored', v_client_hash
           )
   WHERE id = v_cert.id;

  RETURN jsonb_build_object(
    'certification_id', v_cert.id,
    'content_hash_sha256', v_content_hash,
    'authoritative_manifest_hash', v_manifest_hash,
    'content_source', 'SERVER_MANIFEST_RENDER'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_actualizar_borrador_certificacion(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_actualizar_borrador_certificacion(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_firmar_certificacion_autoritativa(
  p_certification_id uuid,
  p_final_legal_artifact_id uuid,
  p_certifier_qtsp_verification_id uuid,
  p_visto_bueno_qtsp_verification_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cert public.certifications%ROWTYPE;
  v_minute public.minutes%ROWTYPE;
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_certifier_verification public.secretaria_qtsp_verifications%ROWTYPE;
  v_vb_verification public.secretaria_qtsp_verifications%ROWTYPE;
  v_auth public.authority_evidence%ROWTYPE;
  v_agreement_ids uuid[];
  v_agreement_manifest jsonb;
  v_agreement_manifest_hash text;
  v_content_hash text;
  v_signature_hash text;
  v_verified_ead_signature_type text;
BEGIN
  SELECT * INTO v_cert
    FROM public.certifications
   WHERE id = p_certification_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification signature: certification not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_cert.tenant_id THEN
      RAISE EXCEPTION 'authoritative certification signature tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');
  END IF;

  IF v_cert.legal_gate_status = 'SIGNATURE_VERIFIED' THEN
    IF v_cert.final_legal_artifact_id = p_final_legal_artifact_id
       AND v_cert.certifier_qtsp_verification_id = p_certifier_qtsp_verification_id
       AND v_cert.visto_bueno_qtsp_verification_id IS NOT DISTINCT FROM p_visto_bueno_qtsp_verification_id THEN
      RETURN jsonb_build_object(
        'certification_id', v_cert.id,
        'signature_status', v_cert.signature_status,
        'already_signed', true
      );
    END IF;
    RAISE EXCEPTION 'authoritative certification signature: different evidence already bound';
  END IF;

  IF v_cert.signature_status <> 'PENDING'
     OR v_cert.legal_gate_status <> 'ARTIFACT_FINAL'
     OR v_cert.final_legal_artifact_id IS DISTINCT FROM p_final_legal_artifact_id
     OR COALESCE(btrim(v_cert.content), '') = '' THEN
    RAISE EXCEPTION 'authoritative certification signature requires final immutable content artifact';
  END IF;

  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = v_cert.minute_id
     AND tenant_id = v_cert.tenant_id
     AND legal_gate_status = 'APPROVED_SIGNED'
     AND book_destination_status = 'POSTED'
     AND book_entry_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification signature: source minute is not approved/signed/posted';
  END IF;

  SELECT * INTO v_artifact
    FROM public.secretaria_legal_artifacts
   WHERE id = p_final_legal_artifact_id
     AND tenant_id = v_cert.tenant_id
     AND source_domain = 'CERTIFICATION'
     AND source_id = v_cert.id
     AND artifact_kind = 'CERTIFICATION_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE';
  v_content_hash := encode(digest(v_cert.content, 'sha256'), 'hex');
  IF NOT FOUND
     OR v_artifact.content_hash_sha256 IS DISTINCT FROM v_content_hash
     OR v_cert.content_hash_sha256 IS DISTINCT FROM v_content_hash
     OR v_artifact.evidence_bundle_id IS DISTINCT FROM v_cert.evidence_id THEN
    RAISE EXCEPTION 'authoritative certification signature: artifact/content/evidence hash mismatch';
  END IF;

  SELECT array_agg(ref::uuid ORDER BY ref::uuid) INTO v_agreement_ids
    FROM unnest(v_cert.agreements_certified) ref;
  v_agreement_manifest := public.fn_secretaria_certified_agreements_manifest(
    v_cert.minute_id,
    v_agreement_ids
  );
  v_agreement_manifest_hash := encode(digest(v_agreement_manifest::text, 'sha256'), 'hex');
  IF v_agreement_manifest_hash IS DISTINCT FROM v_cert.agreements_manifest_hash THEN
    RAISE EXCEPTION 'authoritative certification signature: certified agreement facts drifted';
  END IF;

  SELECT * INTO v_auth
    FROM public.authority_evidence
   WHERE id = v_cert.authority_evidence_id
     AND tenant_id = v_cert.tenant_id
     AND estado = 'VIGENTE'
     AND fecha_inicio <= current_date
     AND (fecha_fin IS NULL OR fecha_fin >= current_date)
     AND COALESCE(btrim(inscripcion_rm_referencia), '') <> ''
     AND inscripcion_rm_fecha IS NOT NULL
     AND inscripcion_rm_fecha <= current_date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification signature: certifier authority is no longer current';
  END IF;

  SELECT * INTO v_certifier_verification
    FROM public.secretaria_qtsp_verifications
   WHERE id = p_certifier_qtsp_verification_id
     AND tenant_id = v_cert.tenant_id
     AND legal_artifact_id = v_artifact.id
     AND signer_role = 'CERTIFICANTE'
     AND signer_person_id = v_auth.person_id
     AND verification_status = 'VERIFIED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification signature: verified certifier EAD evidence missing';
  END IF;
  IF v_cert.required_ead_signature_type = 'ADVANCED'
     AND v_certifier_verification.provider_signature_type <> 'ADVANCED' THEN
    RAISE EXCEPTION 'authoritative certification signature requires ADVANCED EAD evidence';
  END IF;

  IF v_cert.certificante_role IN ('SECRETARIO', 'VICESECRETARIO') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.authority_evidence approval_authority
      WHERE approval_authority.tenant_id = v_cert.tenant_id
        AND approval_authority.entity_id = v_minute.entity_id
        AND approval_authority.body_id = v_minute.body_id
        AND approval_authority.person_id = v_cert.visto_bueno_persona_id
        AND approval_authority.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
        AND approval_authority.estado = 'VIGENTE'
        AND approval_authority.fecha_inicio <= current_date
        AND (approval_authority.fecha_fin IS NULL OR approval_authority.fecha_fin >= current_date)
        AND COALESCE(btrim(approval_authority.inscripcion_rm_referencia), '') <> ''
        AND approval_authority.inscripcion_rm_fecha IS NOT NULL
        AND approval_authority.inscripcion_rm_fecha <= current_date
    ) THEN
      RAISE EXCEPTION 'authoritative certification approval authority is no longer current or lacks registry evidence';
    END IF;
    SELECT * INTO v_vb_verification
      FROM public.secretaria_qtsp_verifications
     WHERE id = p_visto_bueno_qtsp_verification_id
       AND tenant_id = v_cert.tenant_id
       AND legal_artifact_id = v_artifact.id
       AND signer_role = 'VISTO_BUENO'
       AND signer_person_id = v_cert.visto_bueno_persona_id
       AND verification_status = 'VERIFIED';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'authoritative certification signature: verified president approval EAD evidence missing';
    END IF;
    IF v_certifier_verification.signer_person_id = v_vb_verification.signer_person_id
       OR v_certifier_verification.provider_reference = v_vb_verification.provider_reference THEN
      RAISE EXCEPTION 'authoritative certification signature: certifier and approval require distinct persons and individual EAD signatory evidence';
    END IF;
    IF v_cert.required_ead_signature_type = 'ADVANCED'
       AND v_vb_verification.provider_signature_type <> 'ADVANCED' THEN
      RAISE EXCEPTION 'authoritative certification approval requires ADVANCED EAD evidence';
    END IF;
  ELSIF p_visto_bueno_qtsp_verification_id IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative certification signature: unexpected approval verification';
  END IF;

  v_verified_ead_signature_type := CASE
    WHEN v_certifier_verification.provider_signature_type = 'ADVANCED'
     AND (v_vb_verification.id IS NULL OR v_vb_verification.provider_signature_type = 'ADVANCED')
      THEN 'ADVANCED'
    ELSE 'INTERPOSITION'
  END;

  v_signature_hash := encode(
    digest(
      v_cert.gate_hash
      || v_content_hash
      || v_artifact.binary_hash_sha512
      || v_certifier_verification.id::text
      || COALESCE(v_vb_verification.id::text, ''),
      'sha256'
    ),
    'hex'
  );

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.certifications
     SET hash_certificacion = v_signature_hash,
         signature_status = 'SIGNED',
         final_legal_artifact_id = v_artifact.id,
         certifier_qtsp_verification_id = v_certifier_verification.id,
         visto_bueno_qtsp_verification_id = v_vb_verification.id,
         visto_bueno_fecha = CASE
           WHEN v_vb_verification.id IS NOT NULL THEN v_vb_verification.verified_at
           ELSE NULL
         END,
         verified_ead_signature_type = v_verified_ead_signature_type,
         legal_gate_status = 'SIGNATURE_VERIFIED'
   WHERE id = p_certification_id;

  RETURN jsonb_build_object(
    'certification_id', p_certification_id,
    'signature_status', 'SIGNED',
    'legal_gate_status', 'SIGNATURE_VERIFIED',
    'verified_ead_signature_type', v_verified_ead_signature_type,
    'hash_certificacion', v_signature_hash,
    'already_signed', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_firmar_certificacion_autoritativa(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_firmar_certificacion_autoritativa(uuid, uuid, uuid, uuid)
  TO authenticated, service_role;

-- Tokens opacos/base64 ya no pueden producir SIGNED. Se mantiene la firma para
-- que callers legacy reciban un fallo explícito, no una mutación jurídica falsa.
CREATE OR REPLACE FUNCTION public.fn_firmar_certificacion(
  p_certification_id uuid,
  p_qtsp_token text,
  p_tsq_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RAISE EXCEPTION
    'authoritative legal gate: opaque/demo tokens are not proof; use fn_firmar_certificacion_autoritativa with verified EAD Trust evidence'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_firmar_certificacion(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_firmar_certificacion(uuid, text, text)
  TO authenticated, service_role;

-- La variante sin sesión legacy cambiaba ADOPTED→CERTIFIED durante la mera
-- generación. Queda bloqueada hasta disponer de su propio contrato autoritativo.
CREATE OR REPLACE FUNCTION public.fn_generar_certificacion_acuerdo_sin_sesion(
  p_agreement_id uuid,
  p_tipo text DEFAULT 'NO_SESSION',
  p_certificante_role text DEFAULT 'SECRETARIO',
  p_visto_bueno_persona_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RAISE EXCEPTION
    'authoritative legal gate: certification currently requires an approved, signed and posted minute; no-session certification remains non-legal simulation'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_generar_certificacion_acuerdo_sin_sesion(uuid, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generar_certificacion_acuerdo_sin_sesion(uuid, text, text, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Emisión: evidence bundle verificado primero; transición CERTIFIED después
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_emitir_certificacion(
  p_certification_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cert public.certifications%ROWTYPE;
  v_minute public.minutes%ROWTYPE;
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_verification public.secretaria_qtsp_verifications%ROWTYPE;
  v_agreement_ids uuid[];
  v_agreement_manifest jsonb;
  v_agreement_manifest_hash text;
  v_bundle_uri text;
  v_existing_manifest_hash text;
  v_updated integer;
BEGIN
  SELECT * INTO v_cert
    FROM public.certifications
   WHERE id = p_certification_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification emission: certification not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_cert.tenant_id THEN
      RAISE EXCEPTION 'authoritative certification emission tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');
  END IF;

  IF v_cert.legal_gate_status = 'EMITTED' AND v_cert.emitted_at IS NOT NULL THEN
    SELECT manifest_hash INTO v_existing_manifest_hash
      FROM public.evidence_bundles
     WHERE id = v_cert.evidence_id
       AND tenant_id = v_cert.tenant_id;
    IF v_existing_manifest_hash IS NULL THEN
      RAISE EXCEPTION 'authoritative certification emission: emitted row lost evidence manifest';
    END IF;
    RETURN 'evidence_bundle:' || v_cert.evidence_id::text || '@' || v_existing_manifest_hash;
  END IF;

  IF v_cert.signature_status <> 'SIGNED'
     OR v_cert.legal_gate_status <> 'SIGNATURE_VERIFIED'
     OR v_cert.final_legal_artifact_id IS NULL
     OR v_cert.certifier_qtsp_verification_id IS NULL
     OR v_cert.evidence_id IS NULL
     OR v_cert.hash_certificacion IS NULL
     OR v_cert.verified_ead_signature_type IS NULL
     OR (
       v_cert.required_ead_signature_type = 'ADVANCED'
       AND v_cert.verified_ead_signature_type <> 'ADVANCED'
     ) THEN
    RAISE EXCEPTION 'authoritative certification emission requires verified EAD signature evidence and final bundle';
  END IF;

  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = v_cert.minute_id
     AND tenant_id = v_cert.tenant_id
     AND legal_gate_status = 'APPROVED_SIGNED'
     AND signed_at IS NOT NULL
     AND is_locked IS TRUE
     AND book_destination_status = 'POSTED'
     AND book_entry_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification emission: source minute is not approved/signed/posted';
  END IF;

  SELECT * INTO v_artifact
    FROM public.secretaria_legal_artifacts
   WHERE id = v_cert.final_legal_artifact_id
     AND tenant_id = v_cert.tenant_id
     AND source_domain = 'CERTIFICATION'
     AND source_id = v_cert.id
     AND artifact_kind = 'CERTIFICATION_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE';
  IF NOT FOUND
     OR v_artifact.evidence_bundle_id IS DISTINCT FROM v_cert.evidence_id
     OR v_artifact.content_hash_sha256 IS DISTINCT FROM v_cert.content_hash_sha256
     OR v_artifact.content_hash_sha256 IS DISTINCT FROM encode(digest(v_cert.content, 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'authoritative certification emission: final artifact mismatch';
  END IF;

  SELECT * INTO v_verification
    FROM public.secretaria_qtsp_verifications
   WHERE id = v_cert.certifier_qtsp_verification_id
     AND tenant_id = v_cert.tenant_id
     AND legal_artifact_id = v_artifact.id
     AND signer_role = 'CERTIFICANTE'
     AND verification_status = 'VERIFIED'
     AND (
       v_cert.required_ead_signature_type = 'INTERPOSITION'
       OR provider_signature_type = 'ADVANCED'
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authoritative certification emission: verified certifier evidence missing';
  END IF;

  SELECT * INTO v_bundle
    FROM public.evidence_bundles
   WHERE id = v_cert.evidence_id
     AND tenant_id = v_cert.tenant_id;
  IF NOT FOUND
     OR v_bundle.status <> 'VERIFIED'
     OR v_bundle.hash_sha512 IS DISTINCT FROM v_artifact.binary_hash_sha512
     OR v_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM v_artifact.binary_hash_sha256
     OR v_bundle.manifest #>> '{verification,trust_boundary}' <> 'SERVICE_EARCHIVE'
     OR v_bundle.manifest #>> '{verification,provider}' <> 'EAD_TRUST'
     OR v_bundle.manifest #>> '{verification,service}' <> 'EVIDENCE_MANAGER'
     OR v_bundle.manifest_hash IS NULL
     OR v_bundle.manifest_hash !~ '^[0-9a-f]{64}$'
     OR v_bundle.manifest IS NULL
     OR COALESCE(btrim(v_bundle.storage_path), '') = ''
     OR lower(COALESCE(v_bundle.manifest #>> '{metadata,sandbox}', 'false')) = 'true' THEN
    RAISE EXCEPTION 'authoritative certification emission: VERIFIED non-sandbox evidence bundle required';
  END IF;

  SELECT array_agg(ref::uuid ORDER BY ref::uuid) INTO v_agreement_ids
    FROM unnest(v_cert.agreements_certified) ref;
  v_agreement_manifest := public.fn_secretaria_certified_agreements_manifest(
    v_cert.minute_id,
    v_agreement_ids
  );
  v_agreement_manifest_hash := encode(digest(v_agreement_manifest::text, 'sha256'), 'hex');
  IF v_agreement_manifest_hash IS DISTINCT FROM v_cert.agreements_manifest_hash THEN
    RAISE EXCEPTION 'authoritative certification emission: agreement manifest drifted';
  END IF;

  v_bundle_uri := 'evidence_bundle:' || v_bundle.id::text || '@' || v_bundle.manifest_hash;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.agreements a
     SET status = 'CERTIFIED'
   WHERE a.id = ANY(v_agreement_ids)
     AND a.tenant_id = v_cert.tenant_id
     AND a.parent_meeting_id = v_minute.meeting_id
     AND a.status = 'ADOPTED';

  SELECT count(*) INTO v_updated
  FROM public.agreements a
  WHERE a.id = ANY(v_agreement_ids)
    AND a.tenant_id = v_cert.tenant_id
    AND a.parent_meeting_id = v_minute.meeting_id
    AND a.status IN ('CERTIFIED', 'INSTRUMENTED', 'FILED', 'REGISTERED', 'PUBLISHED');
  IF v_updated <> cardinality(v_agreement_ids) THEN
    RAISE EXCEPTION 'authoritative certification emission: certified agreements lost their adoption lineage';
  END IF;

  UPDATE public.certifications
     SET legal_gate_status = 'EMITTED',
         emitted_at = now()
   WHERE id = p_certification_id;

  INSERT INTO public.audit_log (
    tenant_id,
    action,
    object_type,
    object_id,
    delta
  ) VALUES (
    v_cert.tenant_id,
    'CERT_EMITIDA_AUTORITATIVA',
    'certifications',
    v_cert.id,
    jsonb_build_object(
      'hash_certificacion', v_cert.hash_certificacion,
      'artifact_id', v_artifact.id,
      'artifact_binary_hash_sha512', v_artifact.binary_hash_sha512,
      'qtsp_verification_id', v_verification.id,
      'evidence_bundle_id', v_bundle.id,
      'evidence_manifest_hash', v_bundle.manifest_hash,
      'agreement_ids', v_agreement_ids,
      'uri', v_bundle_uri,
      'emitted_at', now()
    )
  );

  RETURN v_bundle_uri;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_emitir_certificacion(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_emitir_certificacion(uuid)
  TO authenticated, service_role;

-- El writer WORM central registra cada nuevo manifiesto/verificación; sus filas
-- no pueden reescribirse ni borrarse.
DROP TRIGGER IF EXISTS trg_audit_worm_secretaria_legal_artifacts
  ON public.secretaria_legal_artifacts;
CREATE TRIGGER trg_audit_worm_secretaria_legal_artifacts
  AFTER INSERT ON public.secretaria_legal_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

DROP TRIGGER IF EXISTS trg_audit_worm_secretaria_qtsp_verifications
  ON public.secretaria_qtsp_verifications;
CREATE TRIGGER trg_audit_worm_secretaria_qtsp_verifications
  AFTER INSERT ON public.secretaria_qtsp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

REVOKE EXECUTE ON FUNCTION public.fn_secretaria_authoritative_append_only_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_authoritative_insert_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_authoritative_domain_guard()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.secretaria_legal_artifacts IS
  'Manifiestos WORM de los binarios finales de acta/certificación. Nunca contiene simulaciones.';
COMMENT ON TABLE public.secretaria_qtsp_verifications IS
  'Verificaciones EAD Trust append-only con tipo real INTERPOSITION o ADVANCED, registradas exclusivamente por service_role.';
COMMENT ON FUNCTION public.fn_generar_acta(uuid, text, uuid, text) IS
  'Genera acta solo después de recomponer censo, convocatoria, quorum, agenda, acuerdos y estado; ignora el hash cliente.';
COMMENT ON FUNCTION public.fn_aprobar_acta_autoritativa(uuid, uuid, text, timestamptz, uuid, uuid) IS
  'Aprueba/bloquea un acta sobre artefacto final y evidencias individuales EAD de Presidencia y Secretaría; admite un mismo SR multifirmante.';
COMMENT ON FUNCTION public.fn_firmar_certificacion_autoritativa(uuid, uuid, uuid, uuid) IS
  'Marca SIGNED solo si el binario final y las verificaciones EAD Trust están vinculados y verificados.';
COMMENT ON FUNCTION public.fn_emitir_certificacion(uuid) IS
  'Emite y transiciona acuerdos a CERTIFIED solo después de evidencia EAD verificada y evidence bundle VERIFIED.';

COMMIT;
