-- Frente A (expand) — ciclo registral v2 y documento base multisoporte.
--
-- Esta fase es aditiva: conserva el flujo legacy (workflow_version = 1), no
-- reinterpreta filas historicas y no retira permisos DML existentes. El cierre
-- de escritura directa se aplica en la migracion de lockdown posterior.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.registry_filings
  ADD COLUMN IF NOT EXISTS workflow_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id),
  ADD COLUMN IF NOT EXISTS source_domain text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS base_document_kind text,
  ADD COLUMN IF NOT EXISTS base_document_artifact_id uuid
    REFERENCES public.secretaria_document_artifacts(id),
  ADD COLUMN IF NOT EXISTS procedure_profile_code text,
  ADD COLUMN IF NOT EXISTS procedure_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rule_pack_version_id uuid
    REFERENCES public.rule_pack_versions(id),
  ADD COLUMN IF NOT EXISTS qualification_outcome text,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_reference text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS state_version bigint NOT NULL DEFAULT 0;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_workflow_version_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_workflow_version_check
      CHECK (workflow_version IN (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_base_document_kind_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_base_document_kind_check
      CHECK (
        base_document_kind IS NULL
        OR base_document_kind IN ('ESCRITURA', 'INSTANCIA', 'CERTIFICACION')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_qualification_outcome_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_qualification_outcome_check
      CHECK (
        qualification_outcome IS NULL
        OR qualification_outcome IN (
          'POSITIVA',
          'SUSPENSION_SUBSANABLE',
          'DENEGACION'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_v2_status_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_v2_status_check
      CHECK (
        workflow_version = 1
        OR status IN (
          'PREPARADA',
          'ELEVADA',
          'PRESENTADA',
          'SUBSANACION',
          'DENEGADA',
          'INSCRITA',
          'PUBLICADA'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_v2_source_domain_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_v2_source_domain_check
      CHECK (
        workflow_version = 1
        OR source_domain IN (
          'AGREEMENT',
          'CERTIFICATION',
          'MANDATORY_BOOK',
          'GROUP_CAMPAIGN_POST_TASK'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_v2_projection_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_v2_projection_check
      CHECK (
        workflow_version = 1
        OR (
          entity_id IS NOT NULL
          AND source_domain IS NOT NULL
          AND source_id IS NOT NULL
          AND base_document_kind IS NOT NULL
          AND base_document_artifact_id IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registry_filings'::regclass
      AND conname = 'registry_filings_escritura_metadata_check'
  ) THEN
    ALTER TABLE public.registry_filings
      ADD CONSTRAINT registry_filings_escritura_metadata_check
      CHECK (
        workflow_version = 1
        OR base_document_kind <> 'ESCRITURA'
        OR (
          deed_date IS NOT NULL
          AND NULLIF(btrim(notary_name), '') IS NOT NULL
          AND NULLIF(btrim(protocol_number), '') IS NOT NULL
        )
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_registry_filings_v2_source
  ON public.registry_filings (tenant_id, source_domain, source_id)
  WHERE workflow_version = 2;

CREATE INDEX IF NOT EXISTS idx_registry_filings_v2_entity_status
  ON public.registry_filings (tenant_id, entity_id, status, updated_at DESC)
  WHERE workflow_version = 2;

CREATE TABLE IF NOT EXISTS public.registry_filing_events (
  id                    uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  filing_id             uuid NOT NULL
    REFERENCES public.registry_filings(id) ON DELETE RESTRICT,
  operation_id          uuid NOT NULL,
  event_type            text NOT NULL CHECK (event_type IN (
    'EXPEDIENTE_PREPARADO',
    'DOCUMENTO_BASE_VINCULADO',
    'PRESENTACION_ASENTADA',
    'CALIFICACION_REGISTRADA',
    'SUBSANACION_PREPARADA',
    'SUBSANACION_PRESENTADA',
    'INSCRIPCION_ACREDITADA',
    'PUBLICACION_ACREDITADA'
  )),
  from_status           text,
  to_status             text NOT NULL,
  sequence_no           bigint NOT NULL CHECK (sequence_no > 0),
  effective_at          timestamptz NOT NULL,
  evidence_artifact_id  uuid
    REFERENCES public.secretaria_document_artifacts(id),
  request_fingerprint   text NOT NULL,
  actor_user_id         uuid,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filing_id, operation_id),
  CONSTRAINT registry_filing_events_sequence_unique
    UNIQUE (filing_id, sequence_no),
  CONSTRAINT registry_filing_events_tenant_operation_unique
    UNIQUE (tenant_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_registry_filing_events_timeline
  ON public.registry_filing_events (tenant_id, filing_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_registry_filing_events_evidence
  ON public.registry_filing_events (tenant_id, evidence_artifact_id)
  WHERE evidence_artifact_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_registry_events_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'registry_filing_events is append-only';
END;
$function$;

DROP TRIGGER IF EXISTS trg_registry_events_append_only
  ON public.registry_filing_events;
CREATE TRIGGER trg_registry_events_append_only
  BEFORE UPDATE OR DELETE ON public.registry_filing_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_registry_events_append_only_guard();

REVOKE EXECUTE ON FUNCTION public.fn_registry_events_append_only_guard()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_registry_filing_events_audit_worm
  ON public.registry_filing_events;
CREATE TRIGGER trg_registry_filing_events_audit_worm
  AFTER INSERT ON public.registry_filing_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_worm();

ALTER TABLE public.registry_filing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_filing_events_tenant_read
  ON public.registry_filing_events;
CREATE POLICY registry_filing_events_tenant_read
  ON public.registry_filing_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

GRANT SELECT ON TABLE public.registry_filing_events TO authenticated;
GRANT ALL ON TABLE public.registry_filing_events TO service_role;

-- Centraliza tenant y rol. Los seis writers invocan este guard antes de
-- bloquear o mutar la proyeccion registral.
CREATE OR REPLACE FUNCTION public.fn_registry_assert_writer(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'tenant_id is required';
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_role_allowed(
    p_tenant_id,
    ARRAY['SECRETARIO', 'ADMIN_TENANT']
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_assert_artifact(
  p_tenant_id uuid,
  p_entity_id uuid,
  p_artifact_id uuid,
  p_allow_demo boolean DEFAULT false,
  p_require_verified boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_artifact public.secretaria_document_artifacts%ROWTYPE;
BEGIN
  IF p_artifact_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'evidence artifact is required';
  END IF;

  SELECT artifact.*
  INTO v_artifact
  FROM public.secretaria_document_artifacts AS artifact
  WHERE artifact.id = p_artifact_id
    AND artifact.tenant_id = p_tenant_id
    AND artifact.entity_id = p_entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'evidence artifact does not belong to tenant and entity';
  END IF;

  IF NULLIF(btrim(v_artifact.document_url), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'evidence artifact must have a persisted document URL';
  END IF;

  IF NULLIF(
    COALESCE(v_artifact.hash_sha512, v_artifact.content_hash, v_artifact.source_hash),
    ''
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'evidence artifact must have a content hash';
  END IF;

  IF v_artifact.status NOT IN ('APPROVED', 'SIGNED', 'ARCHIVED', 'ATTACHED') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'evidence artifact must be in a finalized status';
  END IF;

  IF v_artifact.evidence_status = 'EVIDENCE_FAILED'
    OR (NOT p_allow_demo AND v_artifact.evidence_status = 'DEMO_OPERATIVA') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'registry evidence status is not admissible for this transition';
  END IF;

  IF p_require_verified
    AND v_artifact.evidence_status <> 'EVIDENCE_VERIFIED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'final registry evidence must be verified';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_request_fingerprint(p_request jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT encode(digest(COALESCE(p_request, '{}'::jsonb)::text, 'sha256'), 'hex');
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_existing_operation(
  p_tenant_id uuid,
  p_operation_id uuid,
  p_expected_event_type text,
  p_expected_filing_id uuid,
  p_expected_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_result jsonb;
  v_event public.registry_filing_events%ROWTYPE;
BEGIN
  -- Serializa reintentos concurrentes de la misma operacion. El lock vive
  -- hasta el final de la transaccion exterior del writer.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_operation_id::text, 0)
  );

  SELECT event.*
  INTO v_event
  FROM public.registry_filing_events AS event
  WHERE event.tenant_id = p_tenant_id
    AND event.operation_id = p_operation_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_event.event_type <> p_expected_event_type
    OR (
      p_expected_filing_id IS NOT NULL
      AND v_event.filing_id <> p_expected_filing_id
    )
    OR v_event.request_fingerprint <> p_expected_request_fingerprint THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'operation_id is already bound to a different registry request';
  END IF;

  v_result := jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', true,
    'filing_id', v_event.filing_id,
    'event_id', v_event.id,
    'status', v_event.to_status,
    'state_version', v_event.sequence_no
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_emit_event(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_sequence_no bigint,
  p_effective_at timestamptz,
  p_evidence_artifact_id uuid,
  p_request_fingerprint text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.registry_filing_events (
    tenant_id,
    filing_id,
    operation_id,
    event_type,
    from_status,
    to_status,
    sequence_no,
    effective_at,
    evidence_artifact_id,
    request_fingerprint,
    actor_user_id,
    payload
  )
  VALUES (
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_sequence_no,
    p_effective_at,
    p_evidence_artifact_id,
    p_request_fingerprint,
    auth.uid(),
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

-- D1-B / D2-B: prepara un expediente v2 y vincula su documento base. Una
-- operacion repetida devuelve el primer resultado y no crea otra proyeccion.
CREATE OR REPLACE FUNCTION public.fn_registry_prepare_filing(
  p_tenant_id uuid,
  p_operation_id uuid,
  p_entity_id uuid,
  p_source_domain text,
  p_source_id uuid,
  p_base_document_kind text,
  p_base_document_artifact_id uuid,
  p_filing_via text,
  p_agreement_id uuid DEFAULT NULL,
  p_rule_pack_version_id uuid DEFAULT NULL,
  p_procedure_profile_code text DEFAULT NULL,
  p_procedure_snapshot jsonb DEFAULT '{}'::jsonb,
  p_deed_date date DEFAULT NULL,
  p_notary_name text DEFAULT NULL,
  p_protocol_number text DEFAULT NULL,
  p_filing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_filing_id uuid;
  v_event_id uuid;
  v_from_status text := 'PREPARACION';
  v_existing_workflow_version smallint;
  v_source_domain text;
  v_agreement_id uuid := p_agreement_id;
  v_request_fingerprint text;
  v_status text;
  v_state_version bigint;
  v_affected integer;
  v_book_manifest_exists boolean;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;

  IF p_base_document_kind IS NULL
    OR p_base_document_kind NOT IN ('ESCRITURA', 'INSTANCIA', 'CERTIFICACION') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'unsupported base document kind';
  END IF;

  IF NULLIF(btrim(p_source_domain), '') IS NULL
    OR p_source_id IS NULL
    OR NULLIF(btrim(p_filing_via), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'source domain, source id and filing channel are required';
  END IF;

  v_source_domain := upper(btrim(p_source_domain));
  IF v_source_domain NOT IN (
    'AGREEMENT',
    'CERTIFICATION',
    'MANDATORY_BOOK',
    'GROUP_CAMPAIGN_POST_TASK'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'unsupported registry source domain';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'entity_id', p_entity_id,
      'source_domain', v_source_domain,
      'source_id', p_source_id,
      'base_document_kind', p_base_document_kind,
      'base_document_artifact_id', p_base_document_artifact_id,
      'filing_via', btrim(p_filing_via),
      'agreement_id', p_agreement_id,
      'rule_pack_version_id', p_rule_pack_version_id,
      'procedure_profile_code', NULLIF(btrim(p_procedure_profile_code), ''),
      'procedure_snapshot', COALESCE(p_procedure_snapshot, '{}'::jsonb),
      'deed_date', p_deed_date,
      'notary_name', NULLIF(btrim(p_notary_name), ''),
      'protocol_number', NULLIF(btrim(p_protocol_number), '')
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'EXPEDIENTE_PREPARADO',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.entities AS entity
    WHERE entity.id = p_entity_id
      AND entity.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'entity does not belong to tenant';
  END IF;

  IF p_agreement_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.agreements AS agreement
      WHERE agreement.id = p_agreement_id
        AND agreement.tenant_id = p_tenant_id
        AND agreement.entity_id = p_entity_id
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'agreement does not belong to tenant and entity';
  END IF;

  IF v_source_domain = 'AGREEMENT' THEN
    IF p_agreement_id IS NOT NULL AND p_agreement_id <> p_source_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'agreement source id must equal agreement id';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.agreements AS agreement
      WHERE agreement.id = p_source_id
        AND agreement.tenant_id = p_tenant_id
        AND agreement.entity_id = p_entity_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'agreement source does not belong to tenant and entity';
    END IF;
    v_agreement_id := p_source_id;
  ELSIF v_source_domain = 'CERTIFICATION' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.certifications AS certification
      JOIN public.evidence_bundles AS bundle
        ON bundle.id = certification.evidence_id
       AND bundle.tenant_id = p_tenant_id
      LEFT JOIN public.agreements AS source_agreement
        ON source_agreement.id = certification.agreement_id
      LEFT JOIN public.minutes AS source_minute
        ON source_minute.id = certification.minute_id
      WHERE certification.id = p_source_id
        AND certification.tenant_id = p_tenant_id
        AND certification.signature_status = 'SIGNED'
        AND certification.evidence_id IS NOT NULL
        AND (certification.agreement_id IS NOT NULL OR certification.minute_id IS NOT NULL)
        AND (
          certification.agreement_id IS NULL
          OR (
            source_agreement.tenant_id = p_tenant_id
            AND source_agreement.entity_id = p_entity_id
          )
        )
        AND (
          certification.minute_id IS NULL
          OR (
            source_minute.tenant_id = p_tenant_id
            AND source_minute.entity_id = p_entity_id
          )
        )
        AND (
          p_agreement_id IS NULL
          OR certification.agreement_id = p_agreement_id
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'certification source is not signed and evidenced for tenant and entity';
    END IF;
  ELSIF v_source_domain = 'MANDATORY_BOOK' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.mandatory_books AS book
      WHERE book.id = p_source_id
        AND book.tenant_id = p_tenant_id
        AND book.entity_id = p_entity_id
        AND book.status = 'CERRADO'
        AND book.closed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'mandatory book source is not closed for tenant and entity';
    END IF;

    -- La tabla de manifiestos se crea en la migracion posterior de libros.
    -- SQL dinamico evita acoplar el CREATE FUNCTION al orden de resolucion de
    -- esa relacion, sin relajar el gate en tiempo de ejecucion.
    EXECUTE
      'SELECT EXISTS (
         SELECT 1
         FROM public.societary_book_closures AS closure
         WHERE closure.book_id = $1
           AND closure.tenant_id = $2
       )'
      INTO v_book_manifest_exists
      USING p_source_id, p_tenant_id;

    IF NOT COALESCE(v_book_manifest_exists, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'mandatory book source lacks a persisted closure manifest';
    END IF;
  ELSIF v_source_domain = 'GROUP_CAMPAIGN_POST_TASK' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.group_campaign_post_tasks AS post_task
      WHERE post_task.id = p_source_id
        AND post_task.tenant_id = p_tenant_id
        AND post_task.entity_id = p_entity_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'group campaign post task source does not belong to tenant and entity';
    END IF;
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    p_entity_id,
    p_base_document_artifact_id,
    true,
    false
  );

  IF p_base_document_kind = 'ESCRITURA'
    AND (
      p_deed_date IS NULL
      OR NULLIF(btrim(p_notary_name), '') IS NULL
      OR NULLIF(btrim(p_protocol_number), '') IS NULL
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'deed date, notary and protocol are required for a deed';
  END IF;

  v_status := CASE
    WHEN p_base_document_kind = 'ESCRITURA' THEN 'ELEVADA'
    ELSE 'PREPARADA'
  END;
  v_filing_id := COALESCE(p_filing_id, extensions.gen_random_uuid());

  IF p_filing_id IS NULL THEN
    INSERT INTO public.registry_filings (
      id,
      tenant_id,
      agreement_id,
      entity_id,
      source_domain,
      source_id,
      base_document_kind,
      base_document_artifact_id,
      filing_via,
      status,
      workflow_version,
      procedure_profile_code,
      procedure_snapshot,
      rule_pack_version_id,
      deed_date,
      notary_name,
      protocol_number,
      elevated_at,
      state_version,
      created_at,
      updated_at
    )
    VALUES (
      v_filing_id,
      p_tenant_id,
      v_agreement_id,
      p_entity_id,
      v_source_domain,
      p_source_id,
      p_base_document_kind,
      p_base_document_artifact_id,
      btrim(p_filing_via),
      v_status,
      2,
      NULLIF(btrim(p_procedure_profile_code), ''),
      COALESCE(p_procedure_snapshot, '{}'::jsonb),
      p_rule_pack_version_id,
      p_deed_date,
      NULLIF(btrim(p_notary_name), ''),
      NULLIF(btrim(p_protocol_number), ''),
      CASE WHEN p_base_document_kind = 'ESCRITURA' THEN now() ELSE NULL END,
      1,
      now(),
      now()
    );
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    SELECT filing.status, filing.workflow_version
    INTO v_from_status, v_existing_workflow_version
    FROM public.registry_filings AS filing
    WHERE filing.id = p_filing_id
      AND filing.tenant_id = p_tenant_id
      AND filing.entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND
      OR v_existing_workflow_version <> 2
      OR v_from_status <> 'PREPARADA' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'only a PREPARADA v2 filing can be prepared again';
    END IF;

    UPDATE registry_filings AS filing
    SET agreement_id = v_agreement_id,
        entity_id = p_entity_id,
        source_domain = v_source_domain,
        source_id = p_source_id,
        base_document_kind = p_base_document_kind,
        base_document_artifact_id = p_base_document_artifact_id,
        filing_via = btrim(p_filing_via),
        status = v_status,
        workflow_version = 2,
        procedure_profile_code = NULLIF(btrim(p_procedure_profile_code), ''),
        procedure_snapshot = COALESCE(p_procedure_snapshot, '{}'::jsonb),
        rule_pack_version_id = p_rule_pack_version_id,
        deed_date = p_deed_date,
        notary_name = NULLIF(btrim(p_notary_name), ''),
        protocol_number = NULLIF(btrim(p_protocol_number), ''),
        elevated_at = CASE
          WHEN p_base_document_kind = 'ESCRITURA' THEN now()
          ELSE NULL
        END,
        state_version = filing.state_version + 1,
        updated_at = now()
    WHERE filing.id = p_filing_id
      AND filing.tenant_id = p_tenant_id
      AND filing.entity_id = p_entity_id
      AND filing.workflow_version = 2
      AND filing.status = 'PREPARADA';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  END IF;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'registry prepare expected exactly one affected filing';
  END IF;

  SELECT filing.state_version
  INTO v_state_version
  FROM public.registry_filings AS filing
  WHERE filing.id = v_filing_id
    AND filing.tenant_id = p_tenant_id;

  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    v_filing_id,
    p_operation_id,
    'EXPEDIENTE_PREPARADO',
    v_from_status,
    v_status,
    v_state_version,
    now(),
    p_base_document_artifact_id,
    v_request_fingerprint,
    jsonb_build_object(
      'source_domain', v_source_domain,
      'source_id', p_source_id,
      'base_document_kind', p_base_document_kind,
      'workflow_version', 2
    )
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', v_filing_id,
    'event_id', v_event_id,
    'status', v_status,
    'state_version', v_state_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_record_presentation(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_filing_number text,
  p_presentation_date date,
  p_filing_via text,
  p_evidence_artifact_id uuid,
  p_effective_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_filing_number), '') IS NULL
    OR p_presentation_date IS NULL
    OR NULLIF(btrim(p_filing_via), '') IS NULL
    OR p_effective_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation, filing number, date and channel are required';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'filing_number', btrim(p_filing_number),
      'presentation_date', p_presentation_date,
      'filing_via', btrim(p_filing_via),
      'evidence_artifact_id', p_evidence_artifact_id,
      'effective_at_epoch', extract(epoch FROM p_effective_at)
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'PRESENTACION_ASENTADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    false
  );

  IF (v_before.base_document_kind = 'ESCRITURA' AND v_before.status <> 'ELEVADA')
    OR (
      v_before.base_document_kind IN ('INSTANCIA', 'CERTIFICACION')
      AND v_before.status <> 'PREPARADA'
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'filing base document is not ready for presentation';
  END IF;

  UPDATE registry_filings AS filing
  SET filing_number = btrim(p_filing_number),
      presentation_date = p_presentation_date,
      filing_via = btrim(p_filing_via),
      status = 'PRESENTADA',
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'presentation expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'PRESENTACION_ASENTADA',
    v_before.status,
    'PRESENTADA',
    v_state_version,
    p_effective_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object(
      'filing_number', btrim(p_filing_number),
      'presentation_date', p_presentation_date,
      'filing_via', btrim(p_filing_via)
    )
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', 'PRESENTADA',
    'state_version', v_state_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_record_qualification(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_outcome text,
  p_effective_at timestamptz,
  p_evidence_artifact_id uuid,
  p_defect_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_to_status text;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR p_effective_at IS NULL
    OR p_outcome IS NULL
    OR p_outcome NOT IN ('POSITIVA', 'SUSPENSION_SUBSANABLE', 'DENEGACION') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'operation, effective date and a supported outcome are required';
  END IF;

  IF p_outcome IN ('SUSPENSION_SUBSANABLE', 'DENEGACION')
    AND NULLIF(btrim(p_defect_description), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'qualification grounds are required for a negative outcome';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'outcome', p_outcome,
      'effective_at_epoch', extract(epoch FROM p_effective_at),
      'evidence_artifact_id', p_evidence_artifact_id,
      'defect_description', NULLIF(btrim(p_defect_description), '')
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'CALIFICACION_REGISTRADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    false
  );

  IF v_before.status <> 'PRESENTADA' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'only a presented filing can be qualified';
  END IF;

  v_to_status := CASE p_outcome
    WHEN 'SUSPENSION_SUBSANABLE' THEN 'SUBSANACION'
    WHEN 'DENEGACION' THEN 'DENEGADA'
    ELSE 'PRESENTADA'
  END;

  UPDATE registry_filings AS filing
  SET qualification_outcome = p_outcome,
      qualified_at = p_effective_at,
      defect_details = CASE
        WHEN p_outcome = 'POSITIVA' THEN '{}'::jsonb
        ELSE jsonb_build_object('description', btrim(p_defect_description))
      END,
      status = v_to_status,
      resolution_document_url = (
        SELECT artifact.document_url
        FROM public.secretaria_document_artifacts AS artifact
        WHERE artifact.id = p_evidence_artifact_id
          AND artifact.tenant_id = p_tenant_id
          AND artifact.entity_id = v_before.entity_id
      ),
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'qualification expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'CALIFICACION_REGISTRADA',
    v_before.status,
    v_to_status,
    v_state_version,
    p_effective_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_strip_nulls(jsonb_build_object(
      'outcome', p_outcome,
      'description', NULLIF(btrim(p_defect_description), '')
    ))
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', v_to_status,
    'state_version', v_state_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_submit_remedy(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_remedy_description text,
  p_evidence_artifact_id uuid,
  p_effective_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_remedy_description), '') IS NULL
    OR p_effective_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation and remedy description are required';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'remedy_description', btrim(p_remedy_description),
      'evidence_artifact_id', p_evidence_artifact_id,
      'effective_at_epoch', extract(epoch FROM p_effective_at)
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'SUBSANACION_PRESENTADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    false
  );

  IF v_before.status <> 'SUBSANACION'
    OR v_before.qualification_outcome <> 'SUSPENSION_SUBSANABLE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'filing does not have a remediable suspension';
  END IF;

  UPDATE registry_filings AS filing
  SET status = 'PRESENTADA',
      defect_details = COALESCE(filing.defect_details, '{}'::jsonb) || jsonb_build_object(
        'latest_remedy', btrim(p_remedy_description),
        'latest_remedy_at', p_effective_at
      ),
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'remedy expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'SUBSANACION_PRESENTADA',
    v_before.status,
    'PRESENTADA',
    v_state_version,
    p_effective_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object('description', btrim(p_remedy_description))
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', 'PRESENTADA',
    'state_version', v_state_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_record_inscription(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_inscription_number text,
  p_registered_at timestamptz,
  p_evidence_artifact_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_inscription_number), '') IS NULL
    OR p_registered_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation, inscription number and date are required';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'inscription_number', btrim(p_inscription_number),
      'registered_at_epoch', extract(epoch FROM p_registered_at),
      'evidence_artifact_id', p_evidence_artifact_id
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'INSCRIPCION_ACREDITADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    true
  );

  IF v_before.status <> 'PRESENTADA'
    OR v_before.qualification_outcome <> 'POSITIVA' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'a positive qualification is required before inscription';
  END IF;

  UPDATE registry_filings AS filing
  SET inscription_number = btrim(p_inscription_number),
      registered_at = p_registered_at,
      status = 'INSCRITA',
      resolution_document_url = (
        SELECT artifact.document_url
        FROM public.secretaria_document_artifacts AS artifact
        WHERE artifact.id = p_evidence_artifact_id
          AND artifact.tenant_id = p_tenant_id
          AND artifact.entity_id = v_before.entity_id
      ),
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'inscription expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'INSCRIPCION_ACREDITADA',
    v_before.status,
    'INSCRITA',
    v_state_version,
    p_registered_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object('inscription_number', btrim(p_inscription_number))
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', 'INSCRITA',
    'state_version', v_state_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registry_record_publication(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_publication_reference text,
  p_published_at timestamptz,
  p_evidence_artifact_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_publication_reference), '') IS NULL
    OR p_published_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation, publication reference and date are required';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'publication_reference', btrim(p_publication_reference),
      'published_at_epoch', extract(epoch FROM p_published_at),
      'evidence_artifact_id', p_evidence_artifact_id
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'PUBLICACION_ACREDITADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    true
  );

  IF v_before.status <> 'INSCRITA' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'only an inscribed filing can record publication';
  END IF;

  UPDATE registry_filings AS filing
  SET publication_reference = btrim(p_publication_reference),
      published_at = p_published_at,
      status = 'PUBLICADA',
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'publication expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'PUBLICACION_ACREDITADA',
    v_before.status,
    'PUBLICADA',
    v_state_version,
    p_published_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object('publication_reference', btrim(p_publication_reference))
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', 'PUBLICADA',
    'state_version', v_state_version
  );
END;
$function$;

-- En expand, authenticated puede cortar el cliente a las RPC y verificarlo
-- antes de que lockdown retire el DML legacy. Las helpers siguen internas.
REVOKE ALL ON FUNCTION public.fn_registry_assert_writer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_assert_artifact(
  uuid, uuid, uuid, boolean, boolean
)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_request_fingerprint(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_existing_operation(
  uuid, uuid, text, uuid, text
)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_emit_event(
  uuid, uuid, uuid, text, text, text, bigint, timestamptz, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_prepare_filing(
  uuid, uuid, uuid, text, uuid, text, uuid, text, uuid, uuid, text, jsonb,
  date, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_presentation(
  uuid, uuid, uuid, text, date, text, uuid, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_qualification(
  uuid, uuid, uuid, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_submit_remedy(
  uuid, uuid, uuid, text, uuid, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_inscription(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_publication(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_registry_assert_writer(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_assert_artifact(
  uuid, uuid, uuid, boolean, boolean
)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_request_fingerprint(jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_existing_operation(
  uuid, uuid, text, uuid, text
)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_emit_event(
  uuid, uuid, uuid, text, text, text, bigint, timestamptz, uuid, text, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_prepare_filing(
  uuid, uuid, uuid, text, uuid, text, uuid, text, uuid, uuid, text, jsonb,
  date, text, text, uuid
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_presentation(
  uuid, uuid, uuid, text, date, text, uuid, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_qualification(
  uuid, uuid, uuid, text, timestamptz, uuid, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_submit_remedy(
  uuid, uuid, uuid, text, uuid, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_inscription(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_publication(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO authenticated, service_role;

COMMENT ON TABLE public.registry_filing_events IS
  'Ledger append-only de hechos registrales v2; operation_id hace cada writer idempotente.';
COMMENT ON COLUMN public.registry_filings.workflow_version IS
  '1 preserva el flujo legacy; 2 exige documento base, evidencia y transiciones por RPC.';

COMMIT;
