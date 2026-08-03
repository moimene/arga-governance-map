-- Secretaría — gate autoritativo del punto FORMULACION_CUENTAS.
--
-- La formulación no puede apoyarse en nombres de fichero ni en una lista libre
-- de adjuntos. El Consejo recibe una versión concreta e inmutable del conjunto
-- de cuentas, cuyos componentes están ligados a objetos de Evidence Manager
-- por identificador, versión de storage y hashes SHA-256/SHA-512.
--
-- El set fijado antes de la reunión acredita únicamente la versión sometida al
-- Consejo (APPROVED para BOARD_SUBMISSION_VERSION). La formulación jurídica se
-- produce, en su caso, al adoptar el acuerdo. Después se congela el censo de
-- administradores y se registra, para cada uno, firma EAD por interposición (o
-- avanzada si se eligió) o la causa individual de falta de firma, conforme al
-- art. 253.2 LSC. La versión de ejecución no puede entrar en FINAL_ARCHIVED
-- hasta que ese censo esté completamente resuelto.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extiende la frontera de solicitudes EAD autoritativas creada por 12:00 sin
-- alterar aquella migración. La vinculación ANNUAL_ACCOUNTS se valida más abajo
-- contra el roster WORM de administradores, no contra un cargo certificante.
ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_source_domain_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_source_domain_check
  CHECK (source_domain IS NULL OR source_domain IN ('MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS'));

ALTER TABLE public.qtsp_signature_requests
  DROP CONSTRAINT IF EXISTS qtsp_signature_requests_artifact_kind_check;
ALTER TABLE public.qtsp_signature_requests
  ADD CONSTRAINT qtsp_signature_requests_artifact_kind_check
  CHECK (artifact_kind IS NULL OR artifact_kind IN (
    'MINUTE_FINAL', 'CERTIFICATION_FINAL', 'ANNUAL_ACCOUNTS_EXECUTION'
  ));

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
        WHEN 'ANNUAL_ACCOUNTS' THEN 'ANNUAL_ACCOUNTS_EXECUTION'
      END
    )
  );

-- ---------------------------------------------------------------------------
-- 1. Set de cuentas y componentes: versionados, append-only y sin filename
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_sets (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  entity_id                     uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  body_id                       uuid NOT NULL REFERENCES public.governing_bodies(id) ON DELETE RESTRICT,
  meeting_id                    uuid NOT NULL REFERENCES public.meetings(id) ON DELETE RESTRICT,
  agenda_item_id                uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE RESTRICT,
  fiscal_year                   integer NOT NULL CHECK (fiscal_year BETWEEN 1900 AND 9999),
  is_consolidated               boolean NOT NULL DEFAULT false,
  cash_flow_statement_applicable boolean NOT NULL,
  management_report_applicable  boolean NOT NULL,
  version_number                integer NOT NULL CHECK (version_number > 0),
  supersedes_set_id             uuid REFERENCES public.secretaria_annual_accounts_sets(id) ON DELETE RESTRICT,
  approval_scope                text NOT NULL CHECK (approval_scope = 'BOARD_SUBMISSION_VERSION'),
  approval_status               text NOT NULL CHECK (approval_status = 'APPROVED'),
  immutability_status           text NOT NULL CHECK (immutability_status = 'IMMUTABLE'),
  manifest                      jsonb NOT NULL,
  manifest_hash_sha256          text NOT NULL CHECK (manifest_hash_sha256 ~ '^[0-9a-f]{64}$'),
  approved_at                   timestamptz NOT NULL,
  approved_by                   uuid,
  immutable_at                  timestamptz NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, meeting_id, agenda_item_id, version_number),
  UNIQUE (tenant_id, supersedes_set_id)
);

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_components (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  annual_accounts_set_id uuid NOT NULL REFERENCES public.secretaria_annual_accounts_sets(id) ON DELETE RESTRICT,
  component_kind         text NOT NULL CHECK (component_kind IN (
    'BALANCE_SHEET',
    'PROFIT_AND_LOSS_STATEMENT',
    'NOTES',
    'CHANGES_IN_EQUITY_STATEMENT',
    'CASH_FLOW_STATEMENT',
    'MANAGEMENT_REPORT'
  )),
  required_for_set       boolean NOT NULL,
  content_hash_sha256    text NOT NULL CHECK (content_hash_sha256 ~ '^[0-9a-f]{64}$'),
  content_hash_sha512    text NOT NULL CHECK (content_hash_sha512 ~ '^[0-9a-f]{128}$'),
  evidence_bundle_id     uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  storage_path           text NOT NULL CHECK (length(btrim(storage_path)) > 0),
  storage_object_id      text NOT NULL CHECK (length(btrim(storage_object_id)) > 0),
  storage_version        text NOT NULL CHECK (length(btrim(storage_version)) > 0),
  evidence_manifest_hash text NOT NULL CHECK (evidence_manifest_hash ~ '^[0-9a-f]{64}$'),
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annual_accounts_set_id, component_kind),
  UNIQUE (annual_accounts_set_id, evidence_bundle_id)
);

CREATE INDEX IF NOT EXISTS ix_annual_accounts_sets_point
  ON public.secretaria_annual_accounts_sets(tenant_id, meeting_id, agenda_item_id, version_number DESC);
CREATE INDEX IF NOT EXISTS ix_annual_accounts_components_set
  ON public.secretaria_annual_accounts_components(tenant_id, annual_accounts_set_id, component_kind);

COMMENT ON TABLE public.secretaria_annual_accounts_sets IS
  'Versiones inmutables del conjunto de cuentas sometido al Consejo. APPROVED significa aprobado para someter, no que las cuentas ya hayan sido formuladas.';
COMMENT ON TABLE public.secretaria_annual_accounts_components IS
  'Componentes estructurados del set (arts. 253-254 LSC), ligados a Evidence Manager por hashes y versión de objeto; el filename nunca identifica un componente.';

ALTER TABLE public.secretaria_annual_accounts_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_annual_accounts_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annual_accounts_sets_tenant_read ON public.secretaria_annual_accounts_sets;
CREATE POLICY annual_accounts_sets_tenant_read
  ON public.secretaria_annual_accounts_sets FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

DROP POLICY IF EXISTS annual_accounts_components_tenant_read ON public.secretaria_annual_accounts_components;
CREATE POLICY annual_accounts_components_tenant_read
  ON public.secretaria_annual_accounts_components FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

CREATE OR REPLACE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only; create a superseding version instead', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_annual_accounts_sets_append_only
  ON public.secretaria_annual_accounts_sets;
CREATE TRIGGER trg_annual_accounts_sets_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_sets
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();

DROP TRIGGER IF EXISTS trg_annual_accounts_components_append_only
  ON public.secretaria_annual_accounts_components;
CREATE TRIGGER trg_annual_accounts_components_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_components
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();

REVOKE ALL ON TABLE public.secretaria_annual_accounts_sets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_annual_accounts_components FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_sets TO authenticated, service_role;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_components TO authenticated, service_role;

-- Evidence Manager must expose this structured binary envelope. Legacy
-- manifests without it cannot support an authoritative annual-accounts set.
CREATE OR REPLACE FUNCTION public.fn_secretaria_annual_accounts_evidence_binary(
  p_manifest jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    p_manifest -> 'binary',
    p_manifest #> '{payload,binary}',
    '{}'::jsonb
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_fix_annual_accounts_set(
  p_meeting_id uuid,
  p_agenda_item_id uuid,
  p_fiscal_year integer,
  p_is_consolidated boolean,
  p_cash_flow_statement_applicable boolean,
  p_management_report_applicable boolean,
  p_components jsonb,
  p_supersedes_set_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_meeting record;
  v_agenda record;
  v_head public.secretaria_annual_accounts_sets%ROWTYPE;
  v_set_id uuid := gen_random_uuid();
  v_version integer := 1;
  v_component jsonb;
  v_component_kind text;
  v_required boolean;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_binary jsonb;
  v_components_manifest jsonb := '[]'::jsonb;
  v_manifest jsonb;
  v_manifest_hash text;
  v_component_count integer;
  v_distinct_component_count integer;
  v_fixed_at timestamptz := clock_timestamp();
  v_actor_id uuid := auth.uid();
BEGIN
  IF p_fiscal_year NOT BETWEEN 1900 AND 9999 THEN
    RAISE EXCEPTION 'annual accounts: fiscal year is invalid';
  END IF;
  IF p_cash_flow_statement_applicable IS NULL
     OR p_management_report_applicable IS NULL THEN
    RAISE EXCEPTION 'annual accounts: applicability decisions must be explicit';
  END IF;
  IF jsonb_typeof(p_components) <> 'array' OR jsonb_array_length(p_components) = 0 THEN
    RAISE EXCEPTION 'annual accounts: structured components array is required';
  END IF;

  SELECT
    meeting.*,
    body.entity_id AS resolved_entity_id
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id
   FOR UPDATE OF meeting;
  IF NOT FOUND OR v_meeting.resolved_entity_id IS NULL THEN
    RAISE EXCEPTION 'annual accounts: meeting or entity not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
      RAISE EXCEPTION 'annual accounts tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_meeting.status NOT IN ('DRAFT', 'CONVOCADA')
     OR v_meeting.scheduled_start IS NULL
     OR v_meeting.scheduled_start <= now() THEN
    RAISE EXCEPTION 'annual accounts: the board-submission version must be fixed before the meeting starts';
  END IF;

  SELECT * INTO v_agenda
    FROM public.agenda_items agenda
   WHERE agenda.id = p_agenda_item_id
     AND agenda.meeting_id = p_meeting_id
     AND agenda.tenant_id = v_meeting.tenant_id
   FOR UPDATE;
  IF NOT FOUND
     OR upper(COALESCE(v_agenda.matter_code, '')) <> 'FORMULACION_CUENTAS'
     OR v_agenda.kind <> 'DECISORIO'
     OR COALESCE(v_agenda.requires_attachments, false) IS NOT TRUE
     OR COALESCE(btrim(v_agenda.proposal_text), '') = '' THEN
    RAISE EXCEPTION 'annual accounts: agenda item is not an exact decision point for FORMULACION_CUENTAS';
  END IF;

  SELECT set_row.* INTO v_head
    FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.tenant_id = v_meeting.tenant_id
     AND set_row.meeting_id = p_meeting_id
     AND set_row.agenda_item_id = p_agenda_item_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     )
   FOR UPDATE;

  IF FOUND THEN
    IF p_supersedes_set_id IS DISTINCT FROM v_head.id THEN
      RAISE EXCEPTION 'annual accounts: an immutable head already exists; explicitly supersede set %', v_head.id;
    END IF;
    v_version := v_head.version_number + 1;
  ELSIF p_supersedes_set_id IS NOT NULL THEN
    RAISE EXCEPTION 'annual accounts: superseded set is not the current head';
  END IF;

  SELECT count(*), count(DISTINCT upper(value ->> 'component_kind'))
    INTO v_component_count, v_distinct_component_count
    FROM jsonb_array_elements(p_components);
  IF v_component_count <> v_distinct_component_count THEN
    RAISE EXCEPTION 'annual accounts: duplicate component kind';
  END IF;

  IF NOT (p_components @> '[{"component_kind":"BALANCE_SHEET"}]'::jsonb)
     OR NOT (p_components @> '[{"component_kind":"PROFIT_AND_LOSS_STATEMENT"}]'::jsonb)
     OR NOT (p_components @> '[{"component_kind":"NOTES"}]'::jsonb)
     OR NOT (p_components @> '[{"component_kind":"CHANGES_IN_EQUITY_STATEMENT"}]'::jsonb)
     OR (p_cash_flow_statement_applicable AND NOT (p_components @> '[{"component_kind":"CASH_FLOW_STATEMENT"}]'::jsonb))
     OR (p_management_report_applicable AND NOT (p_components @> '[{"component_kind":"MANAGEMENT_REPORT"}]'::jsonb)) THEN
    RAISE EXCEPTION 'annual accounts: one or more mandatory structured components are missing';
  END IF;

  FOR v_component IN
    SELECT value
    FROM jsonb_array_elements(p_components)
    ORDER BY value ->> 'component_kind'
  LOOP
    v_component_kind := upper(COALESCE(v_component ->> 'component_kind', ''));
    IF v_component_kind NOT IN (
      'BALANCE_SHEET', 'PROFIT_AND_LOSS_STATEMENT', 'NOTES',
      'CHANGES_IN_EQUITY_STATEMENT', 'CASH_FLOW_STATEMENT', 'MANAGEMENT_REPORT'
    ) THEN
      RAISE EXCEPTION 'annual accounts: unsupported component kind %', v_component_kind;
    END IF;

    SELECT * INTO v_bundle
      FROM public.evidence_bundles bundle
     WHERE bundle.id = NULLIF(v_component ->> 'evidence_bundle_id', '')::uuid
       AND bundle.tenant_id = v_meeting.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'annual accounts: evidence bundle missing or outside tenant for %', v_component_kind;
    END IF;
    v_binary := public.fn_secretaria_annual_accounts_evidence_binary(v_bundle.manifest);

    IF v_bundle.status NOT IN ('SEALED', 'VERIFIED')
       OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
       OR COALESCE(v_bundle.manifest_hash, '') !~ '^[0-9a-f]{64}$'
       OR COALESCE(btrim(v_bundle.storage_path), '') = ''
       OR upper(COALESCE(v_binary ->> 'artifact_role', '')) <> 'ANNUAL_ACCOUNTS_COMPONENT'
       OR upper(COALESCE(v_binary ->> 'component_kind', '')) <> v_component_kind
       OR lower(COALESCE(v_binary ->> 'hash_sha256', '')) <> lower(COALESCE(v_component ->> 'content_hash_sha256', ''))
       OR lower(COALESCE(v_binary ->> 'hash_sha512', '')) <> lower(COALESCE(v_component ->> 'content_hash_sha512', ''))
       OR v_bundle.storage_path IS DISTINCT FROM v_component ->> 'storage_path'
       OR v_binary ->> 'storage_path' IS DISTINCT FROM v_bundle.storage_path
       OR COALESCE(btrim(v_binary ->> 'storage_object_id'), '') = ''
       OR COALESCE(btrim(v_binary ->> 'storage_version'), '') = ''
       OR v_binary ->> 'storage_object_id' IS DISTINCT FROM v_component ->> 'storage_object_id'
       OR v_binary ->> 'storage_version' IS DISTINCT FROM v_component ->> 'storage_version' THEN
      RAISE EXCEPTION 'annual accounts: evidence/hash/storage binding is not authoritative for %', v_component_kind;
    END IF;

    v_required := v_component_kind IN (
      'BALANCE_SHEET', 'PROFIT_AND_LOSS_STATEMENT', 'NOTES', 'CHANGES_IN_EQUITY_STATEMENT'
    ) OR (v_component_kind = 'CASH_FLOW_STATEMENT' AND p_cash_flow_statement_applicable)
      OR (v_component_kind = 'MANAGEMENT_REPORT' AND p_management_report_applicable);

    v_components_manifest := v_components_manifest || jsonb_build_array(jsonb_build_object(
      'component_kind', v_component_kind,
      'required', v_required,
      'content_hash_sha256', lower(v_component ->> 'content_hash_sha256'),
      'content_hash_sha512', lower(v_component ->> 'content_hash_sha512'),
      'evidence_bundle_id', v_bundle.id,
      'evidence_manifest_hash', v_bundle.manifest_hash,
      'storage_path', v_bundle.storage_path,
      'storage_object_id', v_binary ->> 'storage_object_id',
      'storage_version', v_binary ->> 'storage_version'
    ));
  END LOOP;

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.annual-accounts-set.v1',
    'set_id', v_set_id,
    'tenant_id', v_meeting.tenant_id,
    'entity_id', v_meeting.resolved_entity_id,
    'body_id', v_meeting.body_id,
    'meeting_id', p_meeting_id,
    'agenda_item_id', p_agenda_item_id,
    'matter_code', 'FORMULACION_CUENTAS',
    'fiscal_year', p_fiscal_year,
    'is_consolidated', COALESCE(p_is_consolidated, false),
    'applicability', jsonb_build_object(
      'cash_flow_statement', p_cash_flow_statement_applicable,
      'management_report', p_management_report_applicable
    ),
    'version_number', v_version,
    'supersedes_set_id', p_supersedes_set_id,
    'approval_scope', 'BOARD_SUBMISSION_VERSION',
    'approval_status', 'APPROVED',
    'immutability_status', 'IMMUTABLE',
    'approved_at', v_fixed_at,
    'approved_by', v_actor_id,
    'approval_channel', CASE
      WHEN public.fn_secretaria_is_service_role() IS TRUE THEN 'TRUSTED_SERVICE'
      ELSE 'AUTHENTICATED_GOVERNED_RPC'
    END,
    'components', v_components_manifest
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  INSERT INTO public.secretaria_annual_accounts_sets (
    id, tenant_id, entity_id, body_id, meeting_id, agenda_item_id,
    fiscal_year, is_consolidated, cash_flow_statement_applicable,
    management_report_applicable, version_number, supersedes_set_id,
    approval_scope, approval_status, immutability_status,
    manifest, manifest_hash_sha256, approved_at, approved_by, immutable_at
  ) VALUES (
    v_set_id, v_meeting.tenant_id, v_meeting.resolved_entity_id, v_meeting.body_id,
    p_meeting_id, p_agenda_item_id, p_fiscal_year, COALESCE(p_is_consolidated, false),
    p_cash_flow_statement_applicable, p_management_report_applicable,
    v_version, p_supersedes_set_id, 'BOARD_SUBMISSION_VERSION', 'APPROVED', 'IMMUTABLE',
    v_manifest, v_manifest_hash, v_fixed_at, v_actor_id, v_fixed_at
  );

  FOR v_component IN SELECT value FROM jsonb_array_elements(v_components_manifest)
  LOOP
    INSERT INTO public.secretaria_annual_accounts_components (
      tenant_id, annual_accounts_set_id, component_kind, required_for_set,
      content_hash_sha256, content_hash_sha512, evidence_bundle_id,
      storage_path, storage_object_id, storage_version, evidence_manifest_hash
    ) VALUES (
      v_meeting.tenant_id,
      v_set_id,
      v_component ->> 'component_kind',
      (v_component ->> 'required')::boolean,
      v_component ->> 'content_hash_sha256',
      v_component ->> 'content_hash_sha512',
      (v_component ->> 'evidence_bundle_id')::uuid,
      v_component ->> 'storage_path',
      v_component ->> 'storage_object_id',
      v_component ->> 'storage_version',
      v_component ->> 'evidence_manifest_hash'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'set_id', v_set_id,
    'version_number', v_version,
    'approval_status', 'APPROVED',
    'immutability_status', 'IMMUTABLE',
    'manifest_hash_sha256', v_manifest_hash,
    'component_count', jsonb_array_length(v_components_manifest)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_fix_annual_accounts_set(
  uuid, uuid, integer, boolean, boolean, boolean, jsonb, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_fix_annual_accounts_set(
  uuid, uuid, integer, boolean, boolean, boolean, jsonb, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Validator consumido por el gate de acta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_validate_annual_accounts_point(
  p_meeting_id uuid,
  p_agenda_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_meeting record;
  v_agenda record;
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_components jsonb;
  v_required_count integer;
  v_valid_required_count integer;
BEGIN
  SELECT meeting.*, body.entity_id AS resolved_entity_id
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts gate: meeting not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
    RAISE EXCEPTION 'annual accounts gate tenant mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_agenda
    FROM public.agenda_items agenda
   WHERE agenda.id = p_agenda_item_id
     AND agenda.meeting_id = p_meeting_id
     AND agenda.tenant_id = v_meeting.tenant_id;
  IF NOT FOUND OR upper(COALESCE(v_agenda.matter_code, '')) <> 'FORMULACION_CUENTAS' THEN
    RAISE EXCEPTION 'annual accounts gate: agenda item is not FORMULACION_CUENTAS';
  END IF;

  SELECT set_row.* INTO v_set
    FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.tenant_id = v_meeting.tenant_id
     AND set_row.meeting_id = p_meeting_id
     AND set_row.agenda_item_id = p_agenda_item_id
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     );
  IF NOT FOUND
     OR v_set.entity_id <> v_meeting.resolved_entity_id
     OR v_set.body_id <> v_meeting.body_id
     OR v_set.approval_scope <> 'BOARD_SUBMISSION_VERSION'
     OR v_set.approval_status <> 'APPROVED'
     OR v_set.immutability_status <> 'IMMUTABLE'
     OR v_set.approved_at IS NULL
     OR v_set.immutable_at IS NULL
     OR (v_set.manifest ->> 'approved_at')::timestamptz IS DISTINCT FROM v_set.approved_at
     OR v_set.manifest ->> 'approved_by' IS DISTINCT FROM v_set.approved_by::text
     OR encode(digest(v_set.manifest::text, 'sha256'), 'hex') <> v_set.manifest_hash_sha256 THEN
    RAISE EXCEPTION 'annual accounts gate: current set is absent or not APPROVED/IMMUTABLE';
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'component_kind', component.component_kind,
      'required', component.required_for_set,
      'content_hash_sha256', component.content_hash_sha256,
      'content_hash_sha512', component.content_hash_sha512,
      'evidence_bundle_id', component.evidence_bundle_id,
      'evidence_manifest_hash', component.evidence_manifest_hash,
      'storage_path', component.storage_path,
      'storage_object_id', component.storage_object_id,
      'storage_version', component.storage_version
    ) ORDER BY component.component_kind), '[]'::jsonb),
    count(*) FILTER (WHERE component.required_for_set),
    count(*) FILTER (
      WHERE component.required_for_set
        AND bundle.id IS NOT NULL
        AND bundle.tenant_id = component.tenant_id
        AND bundle.status IN ('SEALED', 'VERIFIED')
        AND COALESCE(bundle.legal_hold, false) IS TRUE
        AND bundle.manifest_hash = component.evidence_manifest_hash
        AND bundle.storage_path = component.storage_path
        AND public.fn_secretaria_annual_accounts_evidence_binary(bundle.manifest) ->> 'hash_sha256'
              = component.content_hash_sha256
        AND public.fn_secretaria_annual_accounts_evidence_binary(bundle.manifest) ->> 'hash_sha512'
              = component.content_hash_sha512
        AND public.fn_secretaria_annual_accounts_evidence_binary(bundle.manifest) ->> 'storage_object_id'
              = component.storage_object_id
        AND public.fn_secretaria_annual_accounts_evidence_binary(bundle.manifest) ->> 'storage_version'
              = component.storage_version
    )
    INTO v_components, v_required_count, v_valid_required_count
    FROM public.secretaria_annual_accounts_components component
    LEFT JOIN public.evidence_bundles bundle ON bundle.id = component.evidence_bundle_id
   WHERE component.annual_accounts_set_id = v_set.id
     AND component.tenant_id = v_set.tenant_id;

  IF v_required_count < 4
     OR v_valid_required_count <> v_required_count
     OR NOT (v_components @> '[{"component_kind":"BALANCE_SHEET","required":true}]'::jsonb)
     OR NOT (v_components @> '[{"component_kind":"PROFIT_AND_LOSS_STATEMENT","required":true}]'::jsonb)
     OR NOT (v_components @> '[{"component_kind":"NOTES","required":true}]'::jsonb)
     OR NOT (v_components @> '[{"component_kind":"CHANGES_IN_EQUITY_STATEMENT","required":true}]'::jsonb)
     OR (v_set.cash_flow_statement_applicable AND NOT (v_components @> '[{"component_kind":"CASH_FLOW_STATEMENT","required":true}]'::jsonb))
     OR (v_set.management_report_applicable AND NOT (v_components @> '[{"component_kind":"MANAGEMENT_REPORT","required":true}]'::jsonb))
     OR v_set.manifest -> 'components' IS DISTINCT FROM v_components THEN
    RAISE EXCEPTION 'annual accounts gate: mandatory component, hash, evidence or custody binding is invalid';
  END IF;

  RETURN jsonb_build_object(
    'status', 'VALID',
    'set_id', v_set.id,
    'agenda_item_id', p_agenda_item_id,
    'fiscal_year', v_set.fiscal_year,
    'is_consolidated', v_set.is_consolidated,
    'version_number', v_set.version_number,
    'manifest_hash_sha256', v_set.manifest_hash_sha256,
    'component_count', jsonb_array_length(v_components),
    'approval_status', v_set.approval_status,
    'immutability_status', v_set.immutability_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_validate_annual_accounts_point(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_validate_annual_accounts_point(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_annual_accounts_minute_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_point record;
BEGIN
  IF NEW.legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED') THEN
    FOR v_point IN
      SELECT agenda.id
      FROM public.agenda_items agenda
      WHERE agenda.meeting_id = NEW.meeting_id
        AND agenda.tenant_id = NEW.tenant_id
        AND upper(COALESCE(agenda.matter_code, '')) = 'FORMULACION_CUENTAS'
    LOOP
      PERFORM public.fn_secretaria_validate_annual_accounts_point(NEW.meeting_id, v_point.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_minutes_annual_accounts_gate ON public.minutes;
CREATE TRIGGER trg_minutes_annual_accounts_gate
  BEFORE INSERT OR UPDATE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_minute_gate();

-- ---------------------------------------------------------------------------
-- 3. Firma posterior de todos los administradores o causa individual
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_signer_rosters (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  annual_accounts_set_id uuid NOT NULL REFERENCES public.secretaria_annual_accounts_sets(id) ON DELETE RESTRICT,
  resolution_id          uuid NOT NULL REFERENCES public.meeting_resolutions(id) ON DELETE RESTRICT,
  agreement_id           uuid NOT NULL REFERENCES public.agreements(id) ON DELETE RESTRICT,
  snapshot_id            uuid NOT NULL REFERENCES public.censo_snapshot(id) ON DELETE RESTRICT,
  roster_manifest        jsonb NOT NULL,
  roster_hash_sha256     text NOT NULL CHECK (roster_hash_sha256 ~ '^[0-9a-f]{64}$'),
  frozen_at              timestamptz NOT NULL DEFAULT now(),
  frozen_by              uuid,
  UNIQUE (tenant_id, annual_accounts_set_id)
);

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_expected_signers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  signer_roster_id       uuid NOT NULL REFERENCES public.secretaria_annual_accounts_signer_rosters(id) ON DELETE RESTRICT,
  person_id              uuid NOT NULL REFERENCES public.persons(id) ON DELETE RESTRICT,
  person_name_snapshot   text NOT NULL,
  seat_role_snapshot     text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signer_roster_id, person_id)
);

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_signer_outcomes (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  expected_signer_id            uuid NOT NULL REFERENCES public.secretaria_annual_accounts_expected_signers(id) ON DELETE RESTRICT,
  outcome_type                  text NOT NULL CHECK (outcome_type IN ('SIGNED_EAD', 'MISSING_SIGNATURE_CAUSE')),
  supersedes_outcome_id         uuid REFERENCES public.secretaria_annual_accounts_signer_outcomes(id) ON DELETE RESTRICT,
  signature_request_id          uuid REFERENCES public.qtsp_signature_requests(id) ON DELETE RESTRICT,
  provider_signature_type       text CHECK (provider_signature_type IS NULL OR provider_signature_type IN ('INTERPOSITION', 'ADVANCED')),
  provider_reference            text,
  provider_evidence_bundle_id   uuid REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  signed_output_hash_sha256     text CHECK (signed_output_hash_sha256 IS NULL OR signed_output_hash_sha256 ~ '^[0-9a-f]{64}$'),
  signed_output_hash_sha512     text CHECK (signed_output_hash_sha512 IS NULL OR signed_output_hash_sha512 ~ '^[0-9a-f]{128}$'),
  signed_at                     timestamptz,
  missing_signature_cause_code  text CHECK (
    missing_signature_cause_code IS NULL OR missing_signature_cause_code IN (
      'DEATH', 'ILLNESS_OR_INCAPACITY', 'DISAGREEMENT', 'UNREACHABLE', 'OTHER_JUSTIFIED'
    )
  ),
  missing_signature_cause_text  text,
  outcome_manifest              jsonb NOT NULL,
  outcome_manifest_hash_sha256  text NOT NULL CHECK (outcome_manifest_hash_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at                   timestamptz NOT NULL DEFAULT now(),
  recorded_by                   uuid,
  UNIQUE (tenant_id, supersedes_outcome_id),
  UNIQUE (tenant_id, provider_reference),
  CHECK (
    (outcome_type = 'SIGNED_EAD'
      AND signature_request_id IS NOT NULL
      AND provider_signature_type IS NOT NULL
      AND provider_reference IS NOT NULL
      AND provider_evidence_bundle_id IS NOT NULL
      AND signed_output_hash_sha256 IS NOT NULL
      AND signed_output_hash_sha512 IS NOT NULL
      AND signed_at IS NOT NULL
      AND missing_signature_cause_code IS NULL
      AND missing_signature_cause_text IS NULL)
    OR
    (outcome_type = 'MISSING_SIGNATURE_CAUSE'
      AND signature_request_id IS NULL
      AND provider_signature_type IS NULL
      AND provider_reference IS NULL
      AND provider_evidence_bundle_id IS NULL
      AND signed_output_hash_sha256 IS NULL
      AND signed_output_hash_sha512 IS NULL
      AND signed_at IS NULL
      AND missing_signature_cause_code IS NOT NULL
      AND length(btrim(missing_signature_cause_text)) >= 10)
  )
);

CREATE INDEX IF NOT EXISTS ix_annual_accounts_expected_signers
  ON public.secretaria_annual_accounts_expected_signers(tenant_id, signer_roster_id, person_id);
CREATE INDEX IF NOT EXISTS ix_annual_accounts_signer_outcomes
  ON public.secretaria_annual_accounts_signer_outcomes(tenant_id, expected_signer_id, recorded_at DESC);

ALTER TABLE public.secretaria_annual_accounts_signer_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_annual_accounts_expected_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_annual_accounts_signer_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annual_accounts_signer_rosters_read ON public.secretaria_annual_accounts_signer_rosters;
CREATE POLICY annual_accounts_signer_rosters_read ON public.secretaria_annual_accounts_signer_rosters FOR SELECT
  USING (public.fn_secretaria_is_service_role() IS TRUE OR tenant_id = public.fn_secretaria_current_tenant_id());
DROP POLICY IF EXISTS annual_accounts_expected_signers_read ON public.secretaria_annual_accounts_expected_signers;
CREATE POLICY annual_accounts_expected_signers_read ON public.secretaria_annual_accounts_expected_signers FOR SELECT
  USING (public.fn_secretaria_is_service_role() IS TRUE OR tenant_id = public.fn_secretaria_current_tenant_id());
DROP POLICY IF EXISTS annual_accounts_signer_outcomes_read ON public.secretaria_annual_accounts_signer_outcomes;
CREATE POLICY annual_accounts_signer_outcomes_read ON public.secretaria_annual_accounts_signer_outcomes FOR SELECT
  USING (public.fn_secretaria_is_service_role() IS TRUE OR tenant_id = public.fn_secretaria_current_tenant_id());

DROP TRIGGER IF EXISTS trg_annual_accounts_signer_rosters_append_only
  ON public.secretaria_annual_accounts_signer_rosters;
CREATE TRIGGER trg_annual_accounts_signer_rosters_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_signer_rosters
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();
DROP TRIGGER IF EXISTS trg_annual_accounts_expected_signers_append_only
  ON public.secretaria_annual_accounts_expected_signers;
CREATE TRIGGER trg_annual_accounts_expected_signers_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_expected_signers
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();
DROP TRIGGER IF EXISTS trg_annual_accounts_signer_outcomes_append_only
  ON public.secretaria_annual_accounts_signer_outcomes;
CREATE TRIGGER trg_annual_accounts_signer_outcomes_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_signer_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();

REVOKE ALL ON TABLE public.secretaria_annual_accounts_signer_rosters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_annual_accounts_expected_signers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_annual_accounts_signer_outcomes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_signer_rosters TO authenticated, service_role;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_expected_signers TO authenticated, service_role;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_signer_outcomes TO authenticated, service_role;

-- 12:00 protege toda solicitud source-bound. Se conserva íntegramente ese
-- contrato y se añade la rama ANNUAL_ACCOUNTS: el cargo no se prueba con
-- authority_evidence de certificante, sino con el roster derivado del mismo
-- censo WORM que usa el acta.
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
       OR NEW.content_hash_sha256 !~ '^[0-9a-f]{64}$'
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
                 IS DISTINCT FROM lower(NEW.content_hash_sha256)
            OR COALESCE(btrim(signer ->> 'person_id'), '') = ''
       )
    THEN
      RAISE EXCEPTION 'authoritative EAD request lacks exact source/hash/signatory binding';
    END IF;

    IF NEW.source_domain = 'ANNUAL_ACCOUNTS' THEN
      IF NEW.artifact_kind <> 'ANNUAL_ACCOUNTS_EXECUTION'
         OR NOT EXISTS (
           SELECT 1
           FROM public.secretaria_annual_accounts_sets set_row
           JOIN public.secretaria_annual_accounts_signer_rosters roster
             ON roster.annual_accounts_set_id = set_row.id
            AND roster.tenant_id = set_row.tenant_id
           WHERE set_row.id = NEW.source_id
             AND set_row.tenant_id = NEW.tenant_id
             AND NOT EXISTS (
               SELECT 1 FROM public.secretaria_annual_accounts_sets successor
               WHERE successor.tenant_id = set_row.tenant_id
                 AND successor.supersedes_set_id = set_row.id
             )
         )
         OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(NEW.signatories) signer
           WHERE upper(COALESCE(signer ->> 'signer_role', '')) <> 'ADMINISTRADOR'
              OR upper(COALESCE(signer ->> 'provider_signature_type', '')) NOT IN ('INTERPOSITION', 'ADVANCED')
              OR NOT EXISTS (
                SELECT 1
                FROM public.secretaria_annual_accounts_signer_rosters roster
                JOIN public.secretaria_annual_accounts_expected_signers expected
                  ON expected.signer_roster_id = roster.id
                 AND expected.tenant_id = roster.tenant_id
                WHERE roster.tenant_id = NEW.tenant_id
                  AND roster.annual_accounts_set_id = NEW.source_id
                  AND expected.person_id::text = signer ->> 'person_id'
              )
         ) THEN
        RAISE EXCEPTION 'annual accounts EAD request signer is not in the frozen administrator roster';
      END IF;
    ELSIF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.signatories) signer
      WHERE upper(COALESCE(signer ->> 'signer_role', '')) NOT IN (
        'PRESIDENTE', 'SECRETARIO', 'CERTIFICANTE', 'VISTO_BUENO'
      )
         OR COALESCE(btrim(signer ->> 'authority_evidence_id'), '') = ''
    ) THEN
      RAISE EXCEPTION 'authoritative EAD request lacks exact source/hash/signatory binding';
    END IF;

    IF NEW.completed_at IS NOT NULL AND NEW.completed_at < NEW.requested_at THEN
      RAISE EXCEPTION 'authoritative EAD request completion precedes its request';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_freeze_annual_accounts_signer_roster(
  p_annual_accounts_set_id uuid,
  p_snapshot_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_meeting public.meetings%ROWTYPE;
  v_snapshot public.censo_snapshot%ROWTYPE;
  v_resolution_id uuid;
  v_agreement_id uuid;
  v_roster_id uuid := gen_random_uuid();
  v_existing public.secretaria_annual_accounts_signer_rosters%ROWTYPE;
  v_signers jsonb;
  v_roster_manifest jsonb;
  v_roster_hash text;
  v_signer jsonb;
  v_frozen_at timestamptz := clock_timestamp();
  v_frozen_by uuid := auth.uid();
BEGIN
  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets
   WHERE id = p_annual_accounts_set_id;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.secretaria_annual_accounts_sets successor
    WHERE successor.tenant_id = v_set.tenant_id
      AND successor.supersedes_set_id = v_set.id
  ) THEN
    RAISE EXCEPTION 'annual accounts signatures: set is absent or superseded';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_set.tenant_id THEN
      RAISE EXCEPTION 'annual accounts signatures tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(v_set.tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]);
  END IF;

  SELECT * INTO v_meeting FROM public.meetings
   WHERE id = v_set.meeting_id AND tenant_id = v_set.tenant_id;
  IF NOT FOUND OR v_meeting.status <> 'CELEBRADA'
     OR v_meeting.scheduled_end IS NULL OR v_meeting.scheduled_end > now() THEN
    RAISE EXCEPTION 'annual accounts signatures: roster can only be frozen after the meeting';
  END IF;

  SELECT resolution.id, resolution.agreement_id
    INTO v_resolution_id, v_agreement_id
    FROM public.meeting_resolutions resolution
    JOIN public.agenda_items agenda
      ON agenda.meeting_id = resolution.meeting_id
     AND agenda.order_number = resolution.agenda_item_index
     AND agenda.id = v_set.agenda_item_id
   WHERE resolution.meeting_id = v_set.meeting_id
     AND resolution.tenant_id = v_set.tenant_id
     AND resolution.kind_resolution = 'DECISION'
     AND resolution.status = 'ADOPTED'
     AND resolution.agreement_id IS NOT NULL;
  IF v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'annual accounts signatures: formulation resolution is not ADOPTED';
  END IF;

  SELECT * INTO v_snapshot FROM public.censo_snapshot
   WHERE id = p_snapshot_id
     AND tenant_id = v_set.tenant_id
     AND meeting_id = v_set.meeting_id
     AND entity_id = v_set.entity_id
     AND body_id = v_set.body_id
     AND snapshot_type = 'POLITICO';
  IF NOT FOUND OR v_snapshot.audit_worm_id IS NULL OR jsonb_typeof(v_snapshot.payload) <> 'array' THEN
    RAISE EXCEPTION 'annual accounts signatures: authoritative political census snapshot is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.minutes minute
    WHERE minute.tenant_id = v_set.tenant_id
      AND minute.meeting_id = v_set.meeting_id
      AND minute.snapshot_id = p_snapshot_id
      AND minute.legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED')
  ) THEN
    RAISE EXCEPTION 'annual accounts signatures: signer roster must use the same census snapshot as the authoritative minute';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'person_id', person.id,
    'person_name', person.full_name,
    'seat_role', COALESCE(NULLIF(census.item ->> 'seat_role', ''), 'CONSEJERO')
  ) ORDER BY person.id), '[]'::jsonb)
    INTO v_signers
    FROM jsonb_array_elements(v_snapshot.payload) census(item)
    JOIN public.persons person
      ON person.id = (census.item ->> 'person_id')::uuid
     AND person.tenant_id = v_set.tenant_id
   WHERE lower(COALESCE(census.item ->> 'voting_rights', 'true')) = 'true';

  IF jsonb_array_length(v_signers) = 0
     OR jsonb_array_length(v_signers) <> (
       SELECT count(DISTINCT item ->> 'person_id')
       FROM jsonb_array_elements(v_snapshot.payload) item
       WHERE lower(COALESCE(item ->> 'voting_rights', 'true')) = 'true'
     ) THEN
    RAISE EXCEPTION 'annual accounts signatures: census signer identity is incomplete or duplicated';
  END IF;

  SELECT * INTO v_existing
    FROM public.secretaria_annual_accounts_signer_rosters
   WHERE annual_accounts_set_id = v_set.id
     AND tenant_id = v_set.tenant_id;
  IF FOUND THEN
    IF v_existing.snapshot_id = p_snapshot_id THEN
      RETURN jsonb_build_object(
        'roster_id', v_existing.id,
        'roster_hash_sha256', v_existing.roster_hash_sha256,
        'expected_signer_count', jsonb_array_length(v_existing.roster_manifest -> 'signers'),
        'reused', true
      );
    END IF;
    RAISE EXCEPTION 'annual accounts signatures: a roster is already frozen from another snapshot';
  END IF;

  v_roster_manifest := jsonb_build_object(
    'schema_version', 'secretaria.annual-accounts-signer-roster.v1',
    'roster_id', v_roster_id,
    'annual_accounts_set_id', v_set.id,
    'set_manifest_hash_sha256', v_set.manifest_hash_sha256,
    'resolution_id', v_resolution_id,
    'agreement_id', v_agreement_id,
    'snapshot_id', p_snapshot_id,
    'snapshot_audit_worm_id', v_snapshot.audit_worm_id,
    'frozen_at', v_frozen_at,
    'frozen_by', v_frozen_by,
    'signers', v_signers
  );
  v_roster_hash := encode(digest(v_roster_manifest::text, 'sha256'), 'hex');

  INSERT INTO public.secretaria_annual_accounts_signer_rosters (
    id, tenant_id, annual_accounts_set_id, resolution_id, agreement_id, snapshot_id,
    roster_manifest, roster_hash_sha256, frozen_at, frozen_by
  ) VALUES (
    v_roster_id, v_set.tenant_id, v_set.id, v_resolution_id, v_agreement_id, p_snapshot_id,
    v_roster_manifest, v_roster_hash, v_frozen_at, v_frozen_by
  );

  FOR v_signer IN SELECT value FROM jsonb_array_elements(v_signers)
  LOOP
    INSERT INTO public.secretaria_annual_accounts_expected_signers (
      tenant_id, signer_roster_id, person_id, person_name_snapshot, seat_role_snapshot
    ) VALUES (
      v_set.tenant_id,
      v_roster_id,
      (v_signer ->> 'person_id')::uuid,
      v_signer ->> 'person_name',
      v_signer ->> 'seat_role'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'roster_id', v_roster_id,
    'roster_hash_sha256', v_roster_hash,
    'expected_signer_count', jsonb_array_length(v_signers),
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_freeze_annual_accounts_signer_roster(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_freeze_annual_accounts_signer_roster(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_record_annual_accounts_signer_outcome(
  p_expected_signer_id uuid,
  p_outcome_type text,
  p_signature_request_id uuid DEFAULT NULL,
  p_provider_evidence_bundle_id uuid DEFAULT NULL,
  p_missing_signature_cause_code text DEFAULT NULL,
  p_missing_signature_cause_text text DEFAULT NULL,
  p_supersedes_outcome_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_expected record;
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_request public.qtsp_signature_requests%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_binary jsonb;
  v_provider_signature_type text;
  v_provider_reference text;
  v_provider_signer_outcome jsonb;
  v_provider_signer_outcome_count integer;
  v_provider_signer_outcome_hash text;
  v_provider_signer_status_at timestamptz;
  v_head public.secretaria_annual_accounts_signer_outcomes%ROWTYPE;
  v_outcome_id uuid := gen_random_uuid();
  v_manifest jsonb;
  v_manifest_hash text;
  v_recorded_at timestamptz := clock_timestamp();
  v_recorded_by uuid := auth.uid();
BEGIN
  SELECT expected.*, roster.annual_accounts_set_id, roster.roster_hash_sha256
    INTO v_expected
    FROM public.secretaria_annual_accounts_expected_signers expected
    JOIN public.secretaria_annual_accounts_signer_rosters roster
      ON roster.id = expected.signer_roster_id
     AND roster.tenant_id = expected.tenant_id
   WHERE expected.id = p_expected_signer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts signatures: expected signer not found';
  END IF;
  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets
   WHERE id = v_expected.annual_accounts_set_id AND tenant_id = v_expected.tenant_id;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_expected.tenant_id THEN
      RAISE EXCEPTION 'annual accounts signatures tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(v_expected.tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]);
  END IF;

  SELECT outcome.* INTO v_head
    FROM public.secretaria_annual_accounts_signer_outcomes outcome
   WHERE outcome.tenant_id = v_expected.tenant_id
     AND outcome.expected_signer_id = p_expected_signer_id
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_signer_outcomes successor
       WHERE successor.tenant_id = outcome.tenant_id
         AND successor.supersedes_outcome_id = outcome.id
     );
  IF FOUND AND p_supersedes_outcome_id IS DISTINCT FROM v_head.id THEN
    RAISE EXCEPTION 'annual accounts signatures: explicitly supersede current outcome %', v_head.id;
  ELSIF NOT FOUND AND p_supersedes_outcome_id IS NOT NULL THEN
    RAISE EXCEPTION 'annual accounts signatures: superseded outcome is not current';
  END IF;

  IF p_outcome_type = 'SIGNED_EAD' THEN
    IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
      RAISE EXCEPTION 'annual accounts signatures: only trusted EAD reconciliation may record a provider signature'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_request FROM public.qtsp_signature_requests
     WHERE id = p_signature_request_id AND tenant_id = v_expected.tenant_id;
    SELECT * INTO v_bundle FROM public.evidence_bundles
     WHERE id = p_provider_evidence_bundle_id AND tenant_id = v_expected.tenant_id;
    v_binary := public.fn_secretaria_annual_accounts_evidence_binary(v_bundle.manifest);
    SELECT
      upper(signatory ->> 'provider_signature_type'),
      signatory ->> 'provider_signatory_id'
      INTO v_provider_signature_type, v_provider_reference
      FROM jsonb_array_elements(COALESCE(v_request.signatories, '[]'::jsonb)) signatory
     WHERE signatory ->> 'person_id' = v_expected.person_id::text
       AND upper(COALESCE(signatory ->> 'source_domain', '')) = 'ANNUAL_ACCOUNTS'
       AND signatory ->> 'source_id' = v_set.id::text
       AND upper(COALESCE(signatory ->> 'artifact_kind', '')) = 'ANNUAL_ACCOUNTS_EXECUTION'
     LIMIT 1;

    -- Un request COMPLETED y un bundle global no acreditan por sí solos el
    -- resultado de esta persona. El bridge de EAD debe haber conservado dentro
    -- del bundle exactamente un outcome del recurso remoto de firmantes,
    -- identificado por persona + signatoryId y hash-bindeado individualmente.
    SELECT provider_outcome, (count(*) OVER ())::integer
      INTO v_provider_signer_outcome, v_provider_signer_outcome_count
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(v_bundle.manifest #> '{verification,provider_signer_outcomes}') = 'array'
            THEN v_bundle.manifest #> '{verification,provider_signer_outcomes}'
          ELSE '[]'::jsonb
        END
      ) provider_outcome
     WHERE provider_outcome ->> 'person_id' = v_expected.person_id::text
       AND provider_outcome ->> 'provider_signatory_id' = v_provider_reference
     LIMIT 1;
    v_provider_signer_outcome_hash := lower(COALESCE(
      v_provider_signer_outcome ->> 'provider_outcome_hash_sha256',
      ''
    ));

    IF v_request.id IS NULL
       OR v_request.sr_status <> 'COMPLETED'
       OR v_request.completed_at IS NULL
       OR v_request.source_domain <> 'ANNUAL_ACCOUNTS'
       OR v_request.source_id <> v_set.id
       OR v_request.artifact_kind <> 'ANNUAL_ACCOUNTS_EXECUTION'
       OR lower(COALESCE(v_request.content_hash_sha256, '')) <> v_set.manifest_hash_sha256
       OR upper(COALESCE(v_request.evidence_status, '')) LIKE '%SANDBOX%'
       OR v_request.evidence_id IS DISTINCT FROM v_bundle.id
       OR v_bundle.id IS NULL
       OR v_bundle.status <> 'VERIFIED'
       OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
       OR COALESCE(v_bundle.manifest_hash, '') !~ '^[0-9a-f]{64}$'
       OR encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') <> v_bundle.manifest_hash
       OR upper(COALESCE(v_bundle.source_object_type, '')) <> 'ANNUAL_ACCOUNTS_SIGNATURE'
       OR v_bundle.source_object_id IS DISTINCT FROM v_request.id::text
       OR v_provider_signature_type NOT IN ('INTERPOSITION', 'ADVANCED')
       OR COALESCE(btrim(v_provider_reference), '') = ''
       OR upper(COALESCE(v_binary ->> 'artifact_role', '')) <> 'SIGNED_OUTPUT'
       OR COALESCE(v_binary ->> 'hash_sha256', '') !~ '^[0-9a-f]{64}$'
       OR COALESCE(v_binary ->> 'hash_sha512', '') !~ '^[0-9a-f]{128}$'
       OR upper(COALESCE(v_bundle.manifest #>> '{verification,trust_boundary}', '')) <> 'SERVICE_SIGNATURE_RECONCILIATION'
       OR upper(COALESCE(v_bundle.manifest #>> '{verification,provider}', '')) <> 'EAD_TRUST'
       OR v_bundle.manifest #>> '{verification,signature_request_id}' IS DISTINCT FROM v_request.id::text
       OR v_bundle.manifest #>> '{verification,provider_signature_type}' IS DISTINCT FROM v_provider_signature_type
       OR v_bundle.manifest #>> '{source,id}' IS DISTINCT FROM v_set.id::text
       OR v_bundle.manifest #>> '{source,signer_roster_hash_sha256}' IS DISTINCT FROM v_expected.roster_hash_sha256
       OR COALESCE(v_provider_signer_outcome_count, 0) <> 1
       OR upper(COALESCE(v_provider_signer_outcome ->> 'provider_status', ''))
            NOT IN ('SIGNED', 'CERTIFIED', 'COMPLETED')
       OR v_provider_signer_outcome ->> 'provider_status_source'
            IS DISTINCT FROM 'EAD_DOCUMENT_SIGNATORY_RESOURCE'
       OR COALESCE(btrim(v_provider_signer_outcome ->> 'provider_status_at'), '') = ''
       OR v_provider_signer_outcome_hash !~ '^[0-9a-f]{64}$'
       OR encode(
            digest((v_provider_signer_outcome - 'provider_outcome_hash_sha256')::text, 'sha256'),
            'hex'
          ) <> v_provider_signer_outcome_hash THEN
      RAISE EXCEPTION 'annual accounts signatures: completed non-sandbox EAD evidence is invalid';
    END IF;

    BEGIN
      v_provider_signer_status_at := (v_provider_signer_outcome ->> 'provider_status_at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'annual accounts signatures: individual EAD outcome timestamp is invalid';
    END;
    IF v_provider_signer_status_at < v_request.requested_at
       OR v_provider_signer_status_at > v_request.completed_at
       OR v_provider_signer_status_at > now() THEN
      RAISE EXCEPTION 'annual accounts signatures: individual EAD outcome chronology is invalid';
    END IF;

    v_manifest := jsonb_build_object(
      'schema_version', 'secretaria.annual-accounts-signer-outcome.v1',
      'outcome_id', v_outcome_id,
      'expected_signer_id', p_expected_signer_id,
      'person_id', v_expected.person_id,
      'outcome_type', 'SIGNED_EAD',
      'signature_request_id', v_request.id,
      'provider', 'EAD_TRUST',
      'provider_signature_type', v_provider_signature_type,
      'provider_reference', v_provider_reference,
      'provider_signer_outcome', v_provider_signer_outcome,
      'provider_signer_outcome_hash_sha256', v_provider_signer_outcome_hash,
      'provider_evidence_bundle_id', v_bundle.id,
      'signed_output_hash_sha256', v_binary ->> 'hash_sha256',
      'signed_output_hash_sha512', v_binary ->> 'hash_sha512',
      'signed_at', v_provider_signer_status_at,
      'recorded_at', v_recorded_at,
      'recorded_by', v_recorded_by,
      'supersedes_outcome_id', p_supersedes_outcome_id
    );
  ELSIF p_outcome_type = 'MISSING_SIGNATURE_CAUSE' THEN
    IF p_missing_signature_cause_code NOT IN (
      'DEATH', 'ILLNESS_OR_INCAPACITY', 'DISAGREEMENT', 'UNREACHABLE', 'OTHER_JUSTIFIED'
    ) OR length(btrim(COALESCE(p_missing_signature_cause_text, ''))) < 10 THEN
      RAISE EXCEPTION 'annual accounts signatures: a coded, individual and substantive cause is required';
    END IF;
    IF p_signature_request_id IS NOT NULL OR p_provider_evidence_bundle_id IS NOT NULL THEN
      RAISE EXCEPTION 'annual accounts signatures: cause outcome cannot carry provider evidence';
    END IF;
    v_manifest := jsonb_build_object(
      'schema_version', 'secretaria.annual-accounts-signer-outcome.v1',
      'outcome_id', v_outcome_id,
      'expected_signer_id', p_expected_signer_id,
      'person_id', v_expected.person_id,
      'outcome_type', 'MISSING_SIGNATURE_CAUSE',
      'cause_code', p_missing_signature_cause_code,
      'cause_text', btrim(p_missing_signature_cause_text),
      'declared_at', v_recorded_at,
      'declared_by', v_recorded_by,
      'supersedes_outcome_id', p_supersedes_outcome_id
    );
  ELSE
    RAISE EXCEPTION 'annual accounts signatures: unsupported outcome type %', p_outcome_type;
  END IF;

  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  INSERT INTO public.secretaria_annual_accounts_signer_outcomes (
    id, tenant_id, expected_signer_id, outcome_type, supersedes_outcome_id,
    signature_request_id, provider_signature_type, provider_reference,
    provider_evidence_bundle_id, signed_output_hash_sha256, signed_output_hash_sha512,
    signed_at, missing_signature_cause_code, missing_signature_cause_text,
    outcome_manifest, outcome_manifest_hash_sha256, recorded_at, recorded_by
  ) VALUES (
    v_outcome_id, v_expected.tenant_id, p_expected_signer_id, p_outcome_type,
    p_supersedes_outcome_id,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_request.id ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_provider_signature_type ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_provider_reference ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_bundle.id ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_binary ->> 'hash_sha256' ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_binary ->> 'hash_sha512' ELSE NULL END,
    CASE WHEN p_outcome_type = 'SIGNED_EAD' THEN v_provider_signer_status_at ELSE NULL END,
    CASE WHEN p_outcome_type = 'MISSING_SIGNATURE_CAUSE' THEN p_missing_signature_cause_code ELSE NULL END,
    CASE WHEN p_outcome_type = 'MISSING_SIGNATURE_CAUSE' THEN btrim(p_missing_signature_cause_text) ELSE NULL END,
    v_manifest, v_manifest_hash, v_recorded_at, v_recorded_by
  );

  RETURN jsonb_build_object(
    'outcome_id', v_outcome_id,
    'outcome_type', p_outcome_type,
    'outcome_manifest_hash_sha256', v_manifest_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_record_annual_accounts_signer_outcome(
  uuid, text, uuid, uuid, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_record_annual_accounts_signer_outcome(
  uuid, text, uuid, uuid, text, text, uuid
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_validate_annual_accounts_execution(
  p_annual_accounts_set_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_roster public.secretaria_annual_accounts_signer_rosters%ROWTYPE;
  v_expected_count integer;
  v_resolved_count integer;
  v_signed_count integer;
  v_cause_count integer;
  v_outcomes jsonb;
  v_outcomes_hash text;
  v_causes jsonb;
  v_causes_hash text;
BEGIN
  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets
   WHERE id = p_annual_accounts_set_id;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.secretaria_annual_accounts_sets successor
    WHERE successor.tenant_id = v_set.tenant_id AND successor.supersedes_set_id = v_set.id
  ) THEN
    RAISE EXCEPTION 'annual accounts execution: set is absent or superseded';
  END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_assert_current_tenant_id() <> v_set.tenant_id THEN
    RAISE EXCEPTION 'annual accounts execution tenant mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_roster FROM public.secretaria_annual_accounts_signer_rosters
   WHERE tenant_id = v_set.tenant_id AND annual_accounts_set_id = v_set.id;
  IF NOT FOUND
     OR encode(digest(v_roster.roster_manifest::text, 'sha256'), 'hex') <> v_roster.roster_hash_sha256
     OR (v_roster.roster_manifest ->> 'frozen_at')::timestamptz IS DISTINCT FROM v_roster.frozen_at
     OR v_roster.roster_manifest ->> 'frozen_by' IS DISTINCT FROM v_roster.frozen_by::text THEN
    RAISE EXCEPTION 'annual accounts execution: immutable signer roster is missing or invalid';
  END IF;

  WITH heads AS (
    SELECT outcome.*
    FROM public.secretaria_annual_accounts_signer_outcomes outcome
    WHERE outcome.tenant_id = v_set.tenant_id
      AND NOT EXISTS (
        SELECT 1 FROM public.secretaria_annual_accounts_signer_outcomes successor
        WHERE successor.tenant_id = outcome.tenant_id
          AND successor.supersedes_outcome_id = outcome.id
      )
  ), resolved AS (
    SELECT
      expected.id AS expected_signer_id,
      expected.person_id,
      expected.person_name_snapshot,
      expected.seat_role_snapshot,
      head.id AS outcome_id,
      head.outcome_type,
      head.outcome_manifest,
      head.outcome_manifest_hash_sha256
    FROM public.secretaria_annual_accounts_expected_signers expected
    LEFT JOIN heads head ON head.expected_signer_id = expected.id
    WHERE expected.tenant_id = v_set.tenant_id
      AND expected.signer_roster_id = v_roster.id
  )
  SELECT
    count(*),
    count(*) FILTER (
      WHERE resolved.outcome_type IN ('SIGNED_EAD', 'MISSING_SIGNATURE_CAUSE')
        AND encode(digest(resolved.outcome_manifest::text, 'sha256'), 'hex')
              = resolved.outcome_manifest_hash_sha256
    ),
    count(*) FILTER (WHERE resolved.outcome_type = 'SIGNED_EAD'),
    count(*) FILTER (WHERE resolved.outcome_type = 'MISSING_SIGNATURE_CAUSE'),
    COALESCE(jsonb_agg(jsonb_build_object(
      'expected_signer_id', resolved.expected_signer_id,
      'person_id', resolved.person_id,
      'person_name', resolved.person_name_snapshot,
      'seat_role', resolved.seat_role_snapshot,
      'outcome_id', resolved.outcome_id,
      'outcome_type', resolved.outcome_type,
      'outcome_manifest_hash_sha256', resolved.outcome_manifest_hash_sha256,
      'outcome_manifest', resolved.outcome_manifest
    ) ORDER BY resolved.expected_signer_id), '[]'::jsonb)
    INTO v_expected_count, v_resolved_count, v_signed_count, v_cause_count, v_outcomes
    FROM resolved;

  IF v_expected_count = 0 OR v_resolved_count <> v_expected_count THEN
    RAISE EXCEPTION 'annual accounts execution: every administrator needs an EAD signature or an individual persisted cause (%/% resolved)',
      v_resolved_count, v_expected_count;
  END IF;

  v_outcomes_hash := encode(digest(v_outcomes::text, 'sha256'), 'hex');
  SELECT COALESCE(jsonb_agg(item ORDER BY item ->> 'expected_signer_id'), '[]'::jsonb)
    INTO v_causes
    FROM jsonb_array_elements(v_outcomes) item
   WHERE item ->> 'outcome_type' = 'MISSING_SIGNATURE_CAUSE';
  v_causes_hash := encode(digest(v_causes::text, 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'status', 'SIGNATURE_ROSTER_COMPLETE',
    'annual_accounts_set_id', v_set.id,
    'set_manifest_hash_sha256', v_set.manifest_hash_sha256,
    'roster_id', v_roster.id,
    'roster_hash_sha256', v_roster.roster_hash_sha256,
    'expected_signer_count', v_expected_count,
    'signed_count', v_signed_count,
    'missing_signature_cause_count', v_cause_count,
    'outcomes', v_outcomes,
    'outcomes_manifest_hash_sha256', v_outcomes_hash,
    'missing_signature_causes', v_causes,
    'missing_signature_causes_manifest_hash_sha256', v_causes_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_validate_annual_accounts_execution(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_validate_annual_accounts_execution(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Artefacto de ejecución: solo existe como FINAL_ARCHIVED si el roster cerró
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_execution_artifacts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  annual_accounts_set_id uuid NOT NULL REFERENCES public.secretaria_annual_accounts_sets(id) ON DELETE RESTRICT,
  evidence_bundle_id     uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  storage_path           text NOT NULL CHECK (length(btrim(storage_path)) > 0),
  binary_hash_sha256     text NOT NULL CHECK (binary_hash_sha256 ~ '^[0-9a-f]{64}$'),
  binary_hash_sha512     text NOT NULL CHECK (binary_hash_sha512 ~ '^[0-9a-f]{128}$'),
  execution_status       text NOT NULL CHECK (execution_status = 'FINAL_ARCHIVED'),
  execution_manifest     jsonb NOT NULL,
  execution_manifest_hash_sha256 text NOT NULL CHECK (execution_manifest_hash_sha256 ~ '^[0-9a-f]{64}$'),
  archived_at            timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, annual_accounts_set_id),
  UNIQUE (tenant_id, evidence_bundle_id)
);

ALTER TABLE public.secretaria_annual_accounts_execution_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS annual_accounts_execution_artifacts_read ON public.secretaria_annual_accounts_execution_artifacts;
CREATE POLICY annual_accounts_execution_artifacts_read
  ON public.secretaria_annual_accounts_execution_artifacts FOR SELECT
  USING (public.fn_secretaria_is_service_role() IS TRUE OR tenant_id = public.fn_secretaria_current_tenant_id());
DROP TRIGGER IF EXISTS trg_annual_accounts_execution_artifacts_append_only
  ON public.secretaria_annual_accounts_execution_artifacts;
CREATE TRIGGER trg_annual_accounts_execution_artifacts_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_execution_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();
REVOKE ALL ON TABLE public.secretaria_annual_accounts_execution_artifacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_execution_artifacts TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_annual_accounts_execution_artifact(
  p_annual_accounts_set_id uuid,
  p_evidence_bundle_id uuid,
  p_storage_path text,
  p_binary_hash_sha256 text,
  p_binary_hash_sha512 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_binary jsonb;
  v_signature_state jsonb;
  v_artifact_id uuid := gen_random_uuid();
  v_manifest jsonb;
  v_manifest_hash text;
  v_archived_at timestamptz := clock_timestamp();
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'annual accounts execution: trusted e-archive service required'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets
   WHERE id = p_annual_accounts_set_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts execution: set not found';
  END IF;
  v_signature_state := public.fn_secretaria_validate_annual_accounts_execution(v_set.id);

  SELECT * INTO v_bundle FROM public.evidence_bundles
   WHERE id = p_evidence_bundle_id AND tenant_id = v_set.tenant_id;
  v_binary := public.fn_secretaria_annual_accounts_evidence_binary(v_bundle.manifest);
  IF v_bundle.id IS NULL
     OR v_bundle.status <> 'VERIFIED'
     OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
     OR COALESCE(v_bundle.manifest_hash, '') !~ '^[0-9a-f]{64}$'
     OR v_bundle.storage_path IS DISTINCT FROM p_storage_path
     OR upper(COALESCE(v_binary ->> 'artifact_role', '')) <> 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT'
     OR lower(COALESCE(v_binary ->> 'hash_sha256', '')) <> lower(COALESCE(p_binary_hash_sha256, ''))
     OR lower(COALESCE(v_binary ->> 'hash_sha512', '')) <> lower(COALESCE(p_binary_hash_sha512, ''))
     OR v_binary ->> 'storage_path' IS DISTINCT FROM p_storage_path
     OR COALESCE(btrim(v_binary ->> 'storage_object_id'), '') = ''
     OR COALESCE(btrim(v_binary ->> 'storage_version'), '') = ''
     OR upper(COALESCE(v_bundle.source_object_type, '')) <> 'ANNUAL_ACCOUNTS_SET'
     OR v_bundle.source_object_id IS DISTINCT FROM v_set.id::text
     OR v_binary #>> '{legal_render_binding,annual_accounts_set_manifest_hash_sha256}'
          IS DISTINCT FROM v_set.manifest_hash_sha256
     OR v_binary #>> '{legal_render_binding,signer_roster_hash_sha256}'
          IS DISTINCT FROM (v_signature_state ->> 'roster_hash_sha256')
     OR v_binary #>> '{legal_render_binding,signer_outcomes_manifest_hash_sha256}'
          IS DISTINCT FROM (v_signature_state ->> 'outcomes_manifest_hash_sha256')
     OR v_binary #>> '{legal_render_binding,missing_signature_causes_manifest_hash_sha256}'
          IS DISTINCT FROM (v_signature_state ->> 'missing_signature_causes_manifest_hash_sha256') THEN
    RAISE EXCEPTION 'annual accounts execution: final output is not hash-bound to verified e-archive custody';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.annual-accounts-execution.v1',
    'artifact_id', v_artifact_id,
    'annual_accounts_set_id', v_set.id,
    'set_manifest_hash_sha256', v_set.manifest_hash_sha256,
    'signature_state', v_signature_state,
    'binary', jsonb_build_object(
      'artifact_role', 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT',
      'evidence_bundle_id', v_bundle.id,
      'evidence_manifest_hash', v_bundle.manifest_hash,
      'storage_path', p_storage_path,
      'storage_object_id', v_binary ->> 'storage_object_id',
      'storage_version', v_binary ->> 'storage_version',
      'hash_sha256', lower(p_binary_hash_sha256),
      'hash_sha512', lower(p_binary_hash_sha512)
    ),
    'execution_status', 'FINAL_ARCHIVED',
    'archived_at', v_archived_at
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  INSERT INTO public.secretaria_annual_accounts_execution_artifacts (
    id, tenant_id, annual_accounts_set_id, evidence_bundle_id, storage_path,
    binary_hash_sha256, binary_hash_sha512, execution_status,
    execution_manifest, execution_manifest_hash_sha256, archived_at
  ) VALUES (
    v_artifact_id, v_set.tenant_id, v_set.id, v_bundle.id, p_storage_path,
    lower(p_binary_hash_sha256), lower(p_binary_hash_sha512), 'FINAL_ARCHIVED',
    v_manifest, v_manifest_hash, v_archived_at
  );

  RETURN jsonb_build_object(
    'execution_artifact_id', v_artifact_id,
    'execution_status', 'FINAL_ARCHIVED',
    'execution_manifest_hash_sha256', v_manifest_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_annual_accounts_execution_artifact(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_annual_accounts_execution_artifact(
  uuid, uuid, text, text, text
) TO service_role;

COMMIT;
