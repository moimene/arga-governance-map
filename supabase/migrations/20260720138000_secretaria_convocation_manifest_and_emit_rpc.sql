-- Convocatoria DEMO: emisión RPC, manifiesto canónico WORM y render server-side.
--
-- Esta migración no atribuye una firma electrónica ni decide si el documento
-- requiere firma conforme a Derecho. La evidencia del cargo, el acto demo,
-- la interposición/mensajería y el e-archiving son hechos distintos. En este
-- circuito el servicio de firma de EAD Trust queda fuera de alcance y cualquier
-- canal es exclusivamente sandbox, sin entrega real.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Contrato mínimo de emisión y capability explícita
-- ---------------------------------------------------------------------------

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS rule_trace jsonb,
  ADD COLUMN IF NOT EXISTS reminders_trace jsonb,
  ADD COLUMN IF NOT EXISTS accepted_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.capability_matrix
  DROP CONSTRAINT IF EXISTS capability_matrix_action_check;
ALTER TABLE public.capability_matrix
  ADD CONSTRAINT capability_matrix_action_check CHECK (action IN (
    'SNAPSHOT_CREATION',
    'VOTE_EMISSION',
    'CERTIFICATION',
    'CARGO_MANAGEMENT',
    'PERSON_WRITE',
    'PERSON_CONSOLIDATE',
    'REPRESENTATION_MANAGEMENT',
    'CONVOCATION_ISSUE'
  ));

INSERT INTO public.capability_matrix (role, action, enabled, reason) VALUES
  (
    'SECRETARIO',
    'CONVOCATION_ISSUE',
    true,
    'Puede registrar una convocatoria DEMO por la RPC gobernada; el cargo del Presidente no equivale al acto de convocatoria.'
  ),
  (
    'ADMIN_TENANT',
    'CONVOCATION_ISSUE',
    true,
    'Soporte del tenant demo mediante la misma RPC gobernada y sin entrega real.'
  ),
  ('CONSEJERO', 'CONVOCATION_ISSUE', false, 'No emite convocatorias desde la aplicación.'),
  ('COMPLIANCE', 'CONVOCATION_ISSUE', false, 'Función de supervisión, no de emisión.'),
  ('AUDITOR', 'CONVOCATION_ISSUE', false, 'Acceso de auditoría sin facultad de emisión.')
ON CONFLICT (role, action) DO UPDATE
SET enabled = EXCLUDED.enabled,
    reason = EXCLUDED.reason;

-- ---------------------------------------------------------------------------
-- 2. Registro DEMO concreto del acto operativo (WORM, sin afirmar actuación)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.convocation_acts (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  convocatoria_id                 uuid NOT NULL UNIQUE
    REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  actor_person_id                 uuid NOT NULL REFERENCES public.persons(id) ON DELETE RESTRICT,
  actor_authority_evidence_id     uuid NOT NULL REFERENCES public.authority_evidence(id) ON DELETE RESTRICT,
  act_type                        text NOT NULL
    CHECK (act_type = 'DEMO_CONVOCATION_RECORD'),
  authority_route                 text NOT NULL
    CHECK (authority_route = 'PRESIDENTE_ART_246_1'),
  approved_text_hash_sha256       text NOT NULL
    CHECK (approved_text_hash_sha256 ~ '^[0-9a-f]{64}$'),
  agenda_hash_sha256              text NOT NULL
    CHECK (agenda_hash_sha256 ~ '^[0-9a-f]{64}$'),
  act_payload                     jsonb NOT NULL,
  act_hash_sha512                 text NOT NULL UNIQUE
    CHECK (act_hash_sha512 ~ '^[0-9a-f]{128}$'),
  data_class                      text NOT NULL
    CHECK (data_class = 'DEMO'),
  legal_effect                    text NOT NULL
    CHECK (legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'),
  recorded_by                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recorded_at                     timestamptz NOT NULL,
  immutable_at                    timestamptz NOT NULL
);

COMMENT ON TABLE public.convocation_acts IS
  'Registro WORM lógico dentro de la frontera de confianza de la aplicación. actor_person_id referencia el cargo derivado, pero no afirma que la persona actuó, firmó o prestó consentimiento. Un owner/superuser capaz de alterar schema, triggers o privilegios queda fuera de esta garantía.';
COMMENT ON COLUMN public.convocation_acts.actor_person_id IS
  'Titular del cargo usado como referencia de competencia; no es prueba de actuación personal.';
COMMENT ON COLUMN public.convocation_acts.recorded_by IS
  'Usuario autenticado que registró la simulación DEMO.';

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_act_worm_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_recorded_at timestamptz;
  v_expected_text_hash text;
  v_expected_agenda_hash text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'CONVOCATION_ACT_WORM_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(pg_catalog.current_setting('app.secretaria_emit_convocatoria_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CONVOCATION_ACT_REQUIRES_EMISSION_RPC'
      USING ERRCODE = '42501';
  END IF;

  SELECT convocatoria.*
    INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id
     AND convocatoria.estado = 'EMITIDA'
     AND convocatoria.immutable_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_ACT_REQUIRES_EMITTED_SOURCE'
      USING ERRCODE = '23514';
  END IF;

  v_expected_text_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(COALESCE(v_convocatoria.convocatoria_text, ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  v_expected_agenda_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(COALESCE(v_convocatoria.agenda_items, '[]'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  IF NEW.actor_person_id IS DISTINCT FROM v_convocatoria.convocante_person_id
    OR NEW.actor_authority_evidence_id IS DISTINCT FROM
       v_convocatoria.convocante_authority_evidence_id
    OR NEW.authority_route IS DISTINCT FROM v_convocatoria.convocation_authority_route
    OR NEW.approved_text_hash_sha256 IS DISTINCT FROM v_expected_text_hash
    OR NEW.agenda_hash_sha256 IS DISTINCT FROM v_expected_agenda_hash
    OR NEW.act_type <> 'DEMO_CONVOCATION_RECORD'
    OR NEW.data_class <> 'DEMO'
    OR NEW.legal_effect <> 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    OR NEW.recorded_by IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_ACT_SOURCE_OR_IDENTITY_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_recorded_at := pg_catalog.clock_timestamp();
  NEW.recorded_at := v_recorded_at;
  NEW.immutable_at := v_recorded_at;
  NEW.act_payload := pg_catalog.jsonb_build_object(
    'schema_version', 'secretaria.convocation-act.v1',
    'convocatoria_id', NEW.convocatoria_id,
    'tenant_id', NEW.tenant_id,
    'act_type', NEW.act_type,
    'authority_route', NEW.authority_route,
    'actor_person_id', NEW.actor_person_id,
    'actor_authority_evidence_id', NEW.actor_authority_evidence_id,
    'actor_role_reference_only', true,
    'president_action_not_asserted', true,
    'recorded_by', NEW.recorded_by,
    'recorded_at', v_recorded_at,
    'approved_text_hash_sha256', NEW.approved_text_hash_sha256,
    'agenda_hash_sha256', NEW.agenda_hash_sha256,
    'data_class', 'DEMO',
    'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    'signature_status', 'NOT_ASSERTED',
    'productive_evidence_status', 'NOT_PROVIDED'
  );
  NEW.act_hash_sha512 := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(NEW.act_payload::text, 'UTF8'),
      'sha512'
    ),
    'hex'
  );
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_act_worm_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_convocation_act_worm ON public.convocation_acts;
CREATE TRIGGER trg_convocation_act_worm
  BEFORE INSERT OR UPDATE OR DELETE ON public.convocation_acts
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_act_worm_guard();

ALTER TABLE public.convocation_acts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS convocation_acts_tenant_read ON public.convocation_acts;
CREATE POLICY convocation_acts_tenant_read
  ON public.convocation_acts
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

REVOKE ALL ON TABLE public.convocation_acts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.convocation_acts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Manifiesto canónico, consultable por Edge y estrictamente WORM
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.convocation_manifests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  convocatoria_id       uuid NOT NULL UNIQUE
    REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  act_id                uuid NOT NULL UNIQUE
    REFERENCES public.convocation_acts(id) ON DELETE RESTRICT,
  act_hash_sha512       text NOT NULL
    CHECK (act_hash_sha512 ~ '^[0-9a-f]{128}$'),
  manifest_json         jsonb NOT NULL,
  manifest_hash_sha512  text NOT NULL
    CHECK (manifest_hash_sha512 ~ '^[0-9a-f]{128}$'),
  data_class            text NOT NULL
    CHECK (data_class = 'DEMO'),
  legal_effect          text NOT NULL
    CHECK (legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
  immutable_at          timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_convocation_manifests_tenant_convocatoria
  ON public.convocation_manifests (tenant_id, convocatoria_id);

COMMENT ON TABLE public.convocation_manifests IS
  'Manifiesto WORM lógico de simulación DEMO. Edge consulta por convocatoria_id manifest_json, manifest_hash_sha512, data_class y legal_effect. La garantía cubre roles funcionales; no pretende resistir a un owner/superuser que pueda alterar schema o deshabilitar triggers.';
COMMENT ON COLUMN public.convocation_manifests.manifest_hash_sha512 IS
  'SHA-512 server-side de manifest_json::text en UTF-8; no es una firma electrónica.';

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_manifest_worm_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_expected_hash text;
  v_act public.convocation_acts%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_WORM_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(pg_catalog.current_setting('app.secretaria_emit_convocatoria_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_REQUIRES_EMISSION_RPC'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.jsonb_typeof(NEW.manifest_json) <> 'object' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_MUST_BE_OBJECT'
      USING ERRCODE = '23514';
  END IF;

  v_expected_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(NEW.manifest_json::text, 'UTF8'),
      'sha512'
    ),
    'hex'
  );

  SELECT act.*
    INTO v_act
    FROM public.convocation_acts act
   WHERE act.id = NEW.act_id
     AND act.tenant_id = NEW.tenant_id
     AND act.convocatoria_id = NEW.convocatoria_id
     AND act.act_hash_sha512 = NEW.act_hash_sha512
     AND act.data_class = 'DEMO'
     AND act.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT';

  IF NOT FOUND
    OR NEW.manifest_hash_sha512 IS DISTINCT FROM v_expected_hash
    OR NEW.manifest_json ->> 'schema_version' <> 'secretaria.convocation-manifest.v2'
    OR NULLIF(NEW.manifest_json ->> 'convocatoria_id', '')::uuid IS DISTINCT FROM NEW.convocatoria_id
    OR NULLIF(NEW.manifest_json ->> 'tenant_id', '')::uuid IS DISTINCT FROM NEW.tenant_id
    OR NEW.manifest_json ->> 'data_class' IS DISTINCT FROM NEW.data_class
    OR NEW.manifest_json ->> 'legal_effect' IS DISTINCT FROM NEW.legal_effect
    OR NULLIF(NEW.manifest_json #>> '{authority,act_id}', '')::uuid IS DISTINCT FROM NEW.act_id
    OR NEW.manifest_json #>> '{authority,act_hash_sha512}' IS DISTINCT FROM NEW.act_hash_sha512
    OR NEW.manifest_json ->> 'record_status' <> 'DEMO_OPERATIONAL_DRAFT_RECORDED'
    OR NEW.manifest_json -> 'not_a_legal_convocation' IS DISTINCT FROM 'true'::jsonb
    OR NEW.manifest_json #> '{authority,president_action_not_asserted}' IS DISTINCT FROM 'true'::jsonb
    OR NULLIF(NEW.manifest_json ->> 'reviewed_demo_draft_text', '') IS NULL
    OR NEW.manifest_json ->> 'reviewed_demo_draft_text_hash_sha256'
      IS DISTINCT FROM pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(NEW.manifest_json ->> 'reviewed_demo_draft_text', 'UTF8'),
          'sha256'
        ),
        'hex'
      )
    OR NEW.data_class <> 'DEMO'
    OR NEW.legal_effect <> 'DEMO_SIMULATION_NO_LEGAL_EFFECT' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_IDENTITY_OR_HASH_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  NEW.created_at := pg_catalog.clock_timestamp();
  NEW.immutable_at := NEW.created_at;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_manifest_worm_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_convocation_manifest_worm
  ON public.convocation_manifests;
CREATE TRIGGER trg_convocation_manifest_worm
  BEFORE INSERT OR UPDATE OR DELETE ON public.convocation_manifests
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_manifest_worm_guard();

ALTER TABLE public.convocation_manifests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS convocation_manifests_tenant_read
  ON public.convocation_manifests;
DROP POLICY IF EXISTS convocation_manifests_service_all
  ON public.convocation_manifests;

CREATE POLICY convocation_manifests_tenant_read
  ON public.convocation_manifests
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

REVOKE ALL ON TABLE public.convocation_manifests
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.convocation_manifests TO authenticated, service_role;

-- Edge obtiene la serialización exacta de PostgreSQL. Reparsear JSONB en JS
-- puede normalizar la escala de los números y producir bytes distintos.
CREATE OR REPLACE FUNCTION public.fn_get_convocation_manifest_canonical_source(
  p_convocatoria_id uuid
)
RETURNS TABLE(
  manifest_canonical_json text,
  manifest_hash_sha512 text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_manifest public.convocation_manifests%ROWTYPE;
  v_expected_hash text;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for canonical manifest bytes'
      USING ERRCODE = '42501';
  END IF;

  SELECT manifest.*
    INTO v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.convocatoria_id = p_convocatoria_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convocation manifest not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_expected_hash := encode(
    extensions.digest(convert_to(v_manifest.manifest_json::text, 'UTF8'), 'sha512'),
    'hex'
  );
  IF v_manifest.manifest_hash_sha512 IS DISTINCT FROM v_expected_hash THEN
    RAISE EXCEPTION 'convocation manifest hash drift detected'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT v_manifest.manifest_json::text, v_manifest.manifest_hash_sha512;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_get_convocation_manifest_canonical_source(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_convocation_manifest_canonical_source(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Hash canónico completo de agenda, incluida representación y evidencia
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(
  p_item jsonb,
  p_order_number integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'order_number', p_order_number,
    'title', btrim(p_item ->> 'titulo'),
    'matter_code', NULLIF(btrim(p_item ->> 'materia'), ''),
    'type', NULLIF(btrim(p_item ->> 'tipo'), ''),
    'kind', upper(COALESCE(NULLIF(btrim(p_item ->> 'kind'), ''), 'DELIBERATIVO')),
    'decision_subtype', NULLIF(btrim(p_item ->> 'decision_subtype'), ''),
    'proposal_text', NULLIF(btrim(p_item ->> 'propuesta_acuerdo'), ''),
    'requires_attachments', CASE
      WHEN upper(COALESCE(p_item ->> 'materia', '')) = 'FORMULACION_CUENTAS'
        THEN true
      ELSE COALESCE(NULLIF(p_item ->> 'requires_attachments', '')::boolean, false)
    END,
    'target_entity_id', NULLIF(btrim(p_item ->> 'target_entity_id'), ''),
    'target_entity_name', NULLIF(btrim(p_item ->> 'target_entity_name'), ''),
    'representative_person_id', NULLIF(btrim(p_item ->> 'representative_person_id'), ''),
    'representative_name', NULLIF(btrim(p_item ->> 'representative_name'), ''),
    'representation_delegation_id', NULLIF(btrim(p_item ->> 'representation_delegation_id'), ''),
    'representation_authority_route', NULLIF(btrim(p_item ->> 'representation_authority_route'), ''),
    'representation_evidence_status', NULLIF(btrim(p_item ->> 'representation_evidence_status'), ''),
    'representation_source_reference', NULLIF(btrim(p_item ->> 'representation_source_reference'), ''),
    'representation_source_uri', NULLIF(btrim(p_item ->> 'representation_source_uri'), ''),
    'representation_source_hash_sha512', NULLIF(lower(btrim(p_item ->> 'representation_source_hash_sha512')), ''),
    'representation_legal_effect', NULLIF(btrim(p_item ->> 'representation_legal_effect'), ''),
    'source_shareholder_entity_id', NULLIF(btrim(p_item ->> 'source_shareholder_entity_id'), ''),
    'source_shareholder_person_id', NULLIF(btrim(p_item ->> 'source_shareholder_person_id'), ''),
    'capital_ownership_percentage', NULLIF(btrim(p_item ->> 'capital_ownership_percentage'), ''),
    'capital_voting_percentage', NULLIF(btrim(p_item ->> 'capital_voting_percentage'), ''),
    'capital_evidence_status', NULLIF(btrim(p_item ->> 'capital_evidence_status'), ''),
    'data_class', NULLIF(btrim(p_item ->> 'data_class'), ''),
    'legal_effect', NULLIF(btrim(p_item ->> 'legal_effect'), ''),
    'authority_gate_version', NULLIF(btrim(p_item ->> 'authority_gate_version'), '')
  );
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(jsonb, integer)
  TO service_role;

-- Recalcula los hashes derivados de filas ya materializadas; no cambia título,
-- propuesta ni clasificación de la sesión.
UPDATE public.agenda_items agenda_item
SET source_item_hash_sha256 = encode(
  extensions.digest(
    public.fn_secretaria_convocation_agenda_item_canonical(
      convocatoria.agenda_items -> (agenda_item.source_convocatoria_item_index - 1),
      agenda_item.source_convocatoria_item_index
    )::text,
    'sha256'
  ),
  'hex'
)
FROM public.convocatorias convocatoria
WHERE agenda_item.source_convocatoria_id = convocatoria.id
  AND agenda_item.tenant_id = convocatoria.tenant_id
  AND agenda_item.source_convocatoria_item_index IS NOT NULL
  AND jsonb_typeof(convocatoria.agenda_items) = 'array'
  AND agenda_item.source_convocatoria_item_index BETWEEN 1
    AND jsonb_array_length(convocatoria.agenda_items);

-- ---------------------------------------------------------------------------
-- 4. Emisión solo por RPC y manifiesto obligatorio en la misma transacción
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_emission_rpc_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.estado = 'EMITIDA'
    AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'EMITIDA')
    AND COALESCE(pg_catalog.current_setting('app.secretaria_emit_convocatoria_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CONVOCATION_EMISSION_REQUIRES_GOVERNED_RPC'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_emission_rpc_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_convocatoria_emission_rpc_guard
  ON public.convocatorias;
CREATE TRIGGER trg_00_convocatoria_emission_rpc_guard
  BEFORE INSERT OR UPDATE OF estado ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocatoria_emission_rpc_guard();

CREATE TABLE IF NOT EXISTS public.convocation_lifecycle_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  convocatoria_id       uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  manifest_id           uuid NOT NULL REFERENCES public.convocation_manifests(id) ON DELETE RESTRICT,
  act_id                uuid NOT NULL REFERENCES public.convocation_acts(id) ON DELETE RESTRICT,
  from_state            text NOT NULL CHECK (from_state = 'EMITIDA'),
  to_state              text NOT NULL CHECK (to_state IN ('CANCELADA', 'RECTIFICADA')),
  reason                text NOT NULL CHECK (length(btrim(reason)) >= 10),
  event_payload         jsonb NOT NULL,
  event_hash_sha512     text NOT NULL UNIQUE
    CHECK (event_hash_sha512 ~ '^[0-9a-f]{128}$'),
  data_class            text NOT NULL CHECK (data_class = 'DEMO'),
  legal_effect          text NOT NULL
    CHECK (legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'),
  recorded_by           uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recorded_at           timestamptz NOT NULL,
  immutable_at          timestamptz NOT NULL,
  UNIQUE (convocatoria_id, to_state)
);

COMMENT ON TABLE public.convocation_lifecycle_events IS
  'Historial WORM lógico de transiciones DEMO. Los roles funcionales no tienen DML directo; un owner/superuser con capacidad de alterar schema queda expresamente fuera de la frontera de confianza.';

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_lifecycle_event_worm_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_manifest public.convocation_manifests%ROWTYPE;
  v_act public.convocation_acts%ROWTYPE;
  v_recorded_at timestamptz;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_EVENT_WORM_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(pg_catalog.current_setting('app.secretaria_convocation_lifecycle_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_EVENT_REQUIRES_RPC'
      USING ERRCODE = '42501';
  END IF;

  SELECT manifest.* INTO v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.id = NEW.manifest_id
     AND manifest.tenant_id = NEW.tenant_id
     AND manifest.convocatoria_id = NEW.convocatoria_id;
  SELECT act.* INTO v_act
    FROM public.convocation_acts act
   WHERE act.id = NEW.act_id
     AND act.tenant_id = NEW.tenant_id
     AND act.convocatoria_id = NEW.convocatoria_id;
  IF v_manifest.id IS NULL
    OR v_act.id IS NULL
    OR v_manifest.act_id IS DISTINCT FROM v_act.id
    OR v_manifest.act_hash_sha512 IS DISTINCT FROM v_act.act_hash_sha512
    OR NEW.from_state <> 'EMITIDA'
    OR NEW.to_state NOT IN ('CANCELADA', 'RECTIFICADA')
    OR length(pg_catalog.btrim(COALESCE(NEW.reason, ''))) < 10
    OR NEW.recorded_by IS NULL
    OR NEW.data_class <> 'DEMO'
    OR NEW.legal_effect <> 'DEMO_SIMULATION_NO_LEGAL_EFFECT' THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_EVENT_SOURCE_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_recorded_at := pg_catalog.clock_timestamp();
  NEW.reason := pg_catalog.btrim(NEW.reason);
  NEW.recorded_at := v_recorded_at;
  NEW.immutable_at := v_recorded_at;
  NEW.event_payload := pg_catalog.jsonb_build_object(
    'schema_version', 'secretaria.convocation-lifecycle-event.v1',
    'convocatoria_id', NEW.convocatoria_id,
    'tenant_id', NEW.tenant_id,
    'manifest_id', NEW.manifest_id,
    'manifest_hash_sha512', v_manifest.manifest_hash_sha512,
    'act_id', NEW.act_id,
    'act_hash_sha512', v_act.act_hash_sha512,
    'from_state', NEW.from_state,
    'to_state', NEW.to_state,
    'reason', NEW.reason,
    'recorded_by', NEW.recorded_by,
    'recorded_at', v_recorded_at,
    'data_class', 'DEMO',
    'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
  );
  NEW.event_hash_sha512 := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(NEW.event_payload::text, 'UTF8'),
      'sha512'
    ),
    'hex'
  );
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_lifecycle_event_worm_guard()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_convocation_lifecycle_event_worm
  ON public.convocation_lifecycle_events;
CREATE TRIGGER trg_convocation_lifecycle_event_worm
  BEFORE INSERT OR UPDATE OR DELETE ON public.convocation_lifecycle_events
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_lifecycle_event_worm_guard();

ALTER TABLE public.convocation_lifecycle_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS convocation_lifecycle_events_tenant_read
  ON public.convocation_lifecycle_events;
CREATE POLICY convocation_lifecycle_events_tenant_read
  ON public.convocation_lifecycle_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
REVOKE ALL ON TABLE public.convocation_lifecycle_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.convocation_lifecycle_events TO authenticated, service_role;

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_lifecycle_rpc_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.estado = 'EMITIDA'
    AND NEW.estado IN ('CANCELADA', 'RECTIFICADA')
    AND COALESCE(pg_catalog.current_setting('app.secretaria_convocation_lifecycle_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_TRANSITION_REQUIRES_GOVERNED_RPC'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_lifecycle_rpc_guard()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_01_convocatoria_lifecycle_rpc_guard
  ON public.convocatorias;
CREATE TRIGGER trg_01_convocatoria_lifecycle_rpc_guard
  BEFORE UPDATE OF estado ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocatoria_lifecycle_rpc_guard();

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_lifecycle_event_required_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.estado = 'EMITIDA'
    AND NEW.estado IN ('CANCELADA', 'RECTIFICADA')
    AND NOT EXISTS (
      SELECT 1
        FROM public.convocation_lifecycle_events event
       WHERE event.tenant_id = NEW.tenant_id
         AND event.convocatoria_id = NEW.id
         AND event.from_state = OLD.estado
         AND event.to_state = NEW.estado
         AND event.data_class = 'DEMO'
         AND event.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    ) THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_TRANSITION_REQUIRES_WORM_EVENT'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_lifecycle_event_required_guard()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_convocatoria_lifecycle_event_required
  ON public.convocatorias;
CREATE CONSTRAINT TRIGGER trg_convocatoria_lifecycle_event_required
  AFTER UPDATE OF estado ON public.convocatorias
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocatoria_lifecycle_event_required_guard();

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_manifest_required_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.estado = 'EMITIDA' AND NOT EXISTS (
    SELECT 1
      FROM public.convocation_manifests manifest
      JOIN public.convocation_acts act
        ON act.id = manifest.act_id
       AND act.tenant_id = manifest.tenant_id
       AND act.convocatoria_id = manifest.convocatoria_id
       AND act.act_hash_sha512 = manifest.act_hash_sha512
     WHERE manifest.tenant_id = NEW.tenant_id
       AND manifest.convocatoria_id = NEW.id
       AND manifest.data_class = 'DEMO'
       AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
       AND act.data_class = 'DEMO'
       AND act.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
       AND manifest.manifest_hash_sha512 = pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(manifest.manifest_json::text, 'UTF8'),
           'sha512'
         ),
         'hex'
       )
  ) THEN
    RAISE EXCEPTION 'EMITTED_CONVOCATION_REQUIRES_CANONICAL_MANIFEST'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_manifest_required_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_convocatoria_manifest_required
  ON public.convocatorias;
CREATE CONSTRAINT TRIGGER trg_convocatoria_manifest_required
  AFTER INSERT OR UPDATE ON public.convocatorias
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocatoria_manifest_required_guard();

CREATE OR REPLACE FUNCTION public.fn_emit_convocatoria(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_service boolean := public.fn_secretaria_is_service_role() IS TRUE;
  v_tenant_id uuid;
  v_role_ok boolean;
  v_body public.governing_bodies%ROWTYPE;
  v_entity public.entities%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_authority public.authority_evidence%ROWTYPE;
  v_president public.persons%ROWTYPE;
  v_template public.plantillas_protegidas%ROWTYPE;
  v_act_row public.convocation_acts%ROWTYPE;
  v_manifest_row public.convocation_manifests%ROWTYPE;
  v_body_id uuid;
  v_fecha_1 timestamptz;
  v_fecha_2 timestamptz;
  v_agenda jsonb;
  v_canonical_agenda jsonb;
  v_requested_channels text[];
  v_sandbox_channels text[];
  v_manifest jsonb;
  v_manifest_hash text;
  v_reviewed_text text;
  v_reviewed_text_hash_sha256 text;
  v_reviewed_text_hash text;
  v_reviewed_normalized text;
  v_reviewed_compact text;
  v_required_compact text;
  v_agenda_context_normalized text := '';
  v_semantic_item jsonb;
  v_place text;
  v_structure_cursor integer := 0;
  v_structure_position integer;
  v_agenda_hash_sha256 text;
  v_expected_prefix text;
  v_expected_suffix text;
  v_expected_date_text text;
  v_expected_line text;
  v_agenda_line text;
  v_agenda_ordinal integer;
  v_line_count bigint;
  v_recheck_count bigint;
  v_recheck_target public.entities%ROWTYPE;
  v_recheck_representative public.persons%ROWTYPE;
  v_recheck_delegation public.delegations%ROWTYPE;
  v_recheck_target_total numeric;
  v_recheck_source_total numeric;
  v_recheck_voting_total numeric;
  v_recheck_null_count bigint;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'CONVOCATION_PAYLOAD_MUST_BE_OBJECT'
      USING ERRCODE = '22023';
  END IF;

  -- Una simulación concreta siempre deja identificado al usuario que la
  -- registró. service_role puede renderizar/archivar después, pero no inventar
  -- un acto de convocatoria ni omitir al registrador humano.
  IF v_user_id IS NULL OR v_service THEN
    RAISE EXCEPTION 'AUTHENTICATED_USER_REQUIRED_TO_RECORD_DEMO_CONVOCATION_ACT'
      USING ERRCODE = '42501';
  END IF;

  IF p_payload ?| ARRAY[
    'tenant_id',
    'estado',
    'fecha_emision',
    'immutable_at',
    'convocante_person_id',
    'convocante_authority_evidence_id',
    'convocation_authority_route',
    'manifest_json',
    'manifest_hash_sha512',
    'data_class',
    'legal_effect'
  ] THEN
    RAISE EXCEPTION 'CONVOCATION_SERVER_FIELDS_ARE_NOT_CLIENT_CLAIMS'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_payload ->> 'body_id', '') !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'CONVOCATION_BODY_ID_REQUIRED_VALID_UUID'
      USING ERRCODE = '22023';
  END IF;
  v_body_id := (p_payload ->> 'body_id')::uuid;

  SELECT body.* INTO v_body
    FROM public.governing_bodies body
   WHERE body.id = v_body_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_BODY_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  v_tenant_id := v_body.tenant_id;

  IF public.fn_assert_current_tenant_id() IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'CONVOCATION_TENANT_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.rbac_user_roles user_role
      JOIN public.rbac_roles role ON role.id = user_role.role_id
      JOIN public.capability_matrix capability
        ON capability.role = role.role_code
       AND capability.action = 'CONVOCATION_ISSUE'
       AND capability.enabled IS TRUE
     WHERE user_role.user_id = v_user_id
       AND user_role.tenant_id = v_tenant_id
       AND user_role.is_active IS TRUE
       AND (user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp())
       AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
  ) INTO v_role_ok;
  IF v_role_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ACTIVE_CONVOCATION_ISSUE_CAPABILITY_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  SELECT entity.* INTO v_entity
    FROM public.entities entity
   WHERE entity.id = v_body.entity_id
     AND entity.tenant_id = v_tenant_id;
  IF NOT FOUND
    OR v_body.body_type <> 'CDA'
    OR v_entity.entity_status IS DISTINCT FROM 'Active'
    OR upper(COALESCE(v_entity.jurisdiction, '')) <> 'ES'
    OR v_entity.data_class IS DISTINCT FROM 'DEMO' THEN
    RAISE EXCEPTION 'CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_fecha_1 := NULLIF(p_payload ->> 'fecha_1', '')::timestamptz;
    v_fecha_2 := NULLIF(p_payload ->> 'fecha_2', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'CONVOCATION_MEETING_DATE_INVALID'
      USING ERRCODE = '22007';
  END;
  IF v_fecha_1 IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_FIRST_CALL_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  v_place := NULLIF(btrim(p_payload ->> 'lugar'), '');
  IF v_place IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_PLACE_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  v_agenda := COALESCE(p_payload -> 'agenda_items', '[]'::jsonb);
  IF jsonb_typeof(v_agenda) <> 'array' OR jsonb_array_length(v_agenda) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_NON_EMPTY_AGENDA_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_agenda) item(value)
     WHERE btrim(COALESCE(item.value ->> 'materia', '')) <>
             'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
       AND (
         upper(btrim(COALESCE(item.value ->> 'materia', ''))) =
           'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
         OR (
           upper(COALESCE(item.value ->> 'materia', '')) LIKE '%REPRESENT%'
           AND (
             upper(COALESCE(item.value ->> 'materia', '')) LIKE '%FILIAL%'
             OR upper(COALESCE(item.value ->> 'materia', '')) LIKE '%PARTICIPADA%'
             OR upper(COALESCE(item.value ->> 'materia', '')) LIKE '%SOCIO_UNICO%'
           )
         )
       )
  ) THEN
    RAISE EXCEPTION 'REPRESENTATION_LEGACY_MATTER_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  -- IDs y claims de representación solo tienen significado en la materia
  -- canónica. Así no se congelan en WORM referencias inventadas o cross-tenant
  -- dentro de un punto informativo u otra materia.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_agenda) item(value)
     WHERE item.value ->> 'materia' IS DISTINCT FROM
             'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
       AND (
         NULLIF(btrim(item.value ->> 'target_entity_id'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representative_person_id'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_delegation_id'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representative_name'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'target_entity_name'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_authority_route'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_evidence_status'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_source_reference'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_source_uri'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_source_hash_sha512'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'representation_legal_effect'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'source_shareholder_entity_id'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'source_shareholder_person_id'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'capital_ownership_percentage'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'capital_voting_percentage'), '') IS NOT NULL
         OR NULLIF(btrim(item.value ->> 'capital_evidence_status'), '') IS NOT NULL
       )
  ) THEN
    RAISE EXCEPTION 'REPRESENTATION_CLAIMS_FORBIDDEN_OUTSIDE_CANONICAL_MATTER'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload -> 'publication_channels', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_payload -> 'publication_channels', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_SANDBOX_CHANNEL_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    array_agg(channel.normalized ORDER BY channel.ordinality),
    array_agg('SANDBOX_' || channel.normalized ORDER BY channel.ordinality)
  INTO v_requested_channels, v_sandbox_channels
  FROM (
    SELECT
      channel_value.ordinality,
      regexp_replace(upper(btrim(channel_value.value)), '^SANDBOX_', '') AS normalized
    FROM jsonb_array_elements_text(p_payload -> 'publication_channels')
      WITH ORDINALITY AS channel_value(value, ordinality)
  ) channel
  WHERE channel.normalized ~ '^[A-Z0-9_:-]+$';

  IF cardinality(v_requested_channels) IS DISTINCT FROM
    jsonb_array_length(p_payload -> 'publication_channels') THEN
    RAISE EXCEPTION 'CONVOCATION_CHANNEL_CODE_INVALID'
      USING ERRCODE = '22023';
  END IF;

  v_reviewed_text := p_payload ->> 'convocatoria_text';
  IF v_reviewed_text IS NULL OR btrim(v_reviewed_text) = '' THEN
    RAISE EXCEPTION 'CONVOCATION_REVIEWED_TEXT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;
  v_reviewed_text_hash_sha256 := encode(
    extensions.digest(convert_to(v_reviewed_text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_reviewed_text_hash := encode(
    extensions.digest(convert_to(v_reviewed_text, 'UTF8'), 'sha512'),
    'hex'
  );

  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', 'on', true);

  INSERT INTO public.convocatorias (
    tenant_id,
    body_id,
    tipo_convocatoria,
    estado,
    fecha_1,
    fecha_2,
    modalidad,
    lugar,
    junta_universal,
    is_second_call,
    urgente,
    publication_channels,
    agenda_items,
    statutory_basis,
    convocatoria_text,
    rule_trace,
    reminders_trace,
    accepted_warnings
  ) VALUES (
    v_tenant_id,
    v_body_id,
    COALESCE(NULLIF(btrim(p_payload ->> 'tipo_convocatoria'), ''), 'ORDINARIA'),
    'EMITIDA',
    v_fecha_1,
    v_fecha_2,
    COALESCE(NULLIF(btrim(p_payload ->> 'modalidad'), ''), 'PRESENCIAL'),
    v_place,
    COALESCE((p_payload ->> 'junta_universal')::boolean, false),
    COALESCE((p_payload ->> 'is_second_call')::boolean, false),
    COALESCE((p_payload ->> 'urgente')::boolean, false),
    v_sandbox_channels,
    v_agenda,
    NULLIF(btrim(p_payload ->> 'statutory_basis'), ''),
    v_reviewed_text,
    CASE
      WHEN jsonb_typeof(p_payload -> 'rule_trace') = 'object' THEN p_payload -> 'rule_trace'
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_payload -> 'reminders_trace') = 'object' THEN p_payload -> 'reminders_trace'
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_payload -> 'accepted_warnings') = 'array' THEN p_payload -> 'accepted_warnings'
      ELSE '[]'::jsonb
    END
  )
  RETURNING * INTO v_convocatoria;

  SELECT evidence.* INTO v_authority
    FROM public.authority_evidence evidence
   WHERE evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.cargo = 'PRESIDENTE'
     AND evidence.estado = 'VIGENTE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_OFFICE_EVIDENCE_DRIFT'
      USING ERRCODE = '23514';
  END IF;

  SELECT person.* INTO v_president
    FROM public.persons person
   WHERE person.id = v_authority.person_id
     AND person.tenant_id = v_tenant_id
     AND person.person_type = 'PF'
     AND person.data_class = 'DEMO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_OFFICE_HOLDER_DEMO_DRIFT'
      USING ERRCODE = '23514';
  END IF;

  SELECT template.* INTO v_template
    FROM public.plantillas_protegidas template
   WHERE template.tenant_id = v_tenant_id
     AND template.tipo = 'CONVOCATORIA'
     AND template.materia = 'CONVOCATORIA_CDA'
     AND template.version = '1.1.0'
     AND template.estado = 'ACTIVA'
     AND template.capa1_inmutable IS NOT NULL
     AND template.content_hash_sha256 = encode(
       extensions.digest(convert_to(template.capa1_inmutable, 'UTF8'), 'sha256'),
       'hex'
     )
   ORDER BY template.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_APPROVED_CONVOCATION_TEMPLATE_1_1_REQUIRED'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      public.fn_secretaria_convocation_agenda_item_canonical(
        agenda.value,
        agenda.ordinality::integer
      )
      ORDER BY agenda.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_canonical_agenda
  FROM jsonb_array_elements(v_convocatoria.agenda_items)
    WITH ORDINALITY AS agenda(value, ordinality);

  -- El hash prueba identidad de bytes, no coherencia. Antes de congelar el
  -- manifiesto, el texto aprobado debe contener los hechos esenciales que el
  -- servidor ha derivado y validado. Las propuestas completas siguen siendo
  -- datos canónicos de agenda y el renderer las imprime por separado.
  v_reviewed_normalized := regexp_replace(
    translate(lower(v_reviewed_text), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    ' ',
    'g'
  );
  v_reviewed_compact := regexp_replace(v_reviewed_normalized, '[^a-z0-9]+', '', 'g');

  IF length(v_reviewed_text) < 1100 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_STRUCTURE_TOO_SHORT'
      USING ERRCODE = '23514';
  END IF;

  IF strpos(v_reviewed_text, '{{') > 0 OR strpos(v_reviewed_text, '}}') > 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_UNRESOLVED_TEMPLATE_VARIABLES'
      USING ERRCODE = '23514';
  END IF;

  -- Contrato estructural de la plantilla aprobada v1.1: el inicio y cierre son
  -- canónicos y explícitamente DEMO. La referencia presidencial acredita cargo,
  -- pero el propio texto niega que el Presidente ordenara, consintiera, emitiera
  -- o firmara. Un conjunto de tokens sueltos no satisface este prefijo exacto.
  v_expected_prefix := concat(
    'DEMO / NO OFICIAL · No constituye evidencia final productiva', E'\n\n',
    'SIMULACIÓN DEMO / SIN EFECTO JURÍDICO', E'\n\n',
    'BORRADOR OPERATIVO DE CONVOCATORIA DE SESIÓN DEL CONSEJO DE ADMINISTRACIÓN DE ',
    v_entity.legal_name, E'\n\n',
    'A efectos exclusivos de simulación DEMO, se registra un borrador operativo referido al cargo vigente de Presidente, ocupado según el censo autoritativo por ',
    v_president.full_name,
    '. Esta referencia acredita únicamente la titularidad del cargo y no afirma que dicha persona haya ordenado, consentido, emitido o firmado esta convocatoria.'
  );

  IF left(v_reviewed_text, length(v_expected_prefix)) IS DISTINCT FROM v_expected_prefix THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_DEMO_PREFIX_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_expected_suffix := concat(
    'Documento demo/operativo sin efecto jurídico. No constituye una convocatoria emitida ni evidencia final productiva. ',
    'La eventual interposición, mensajería o custodia electrónica por EAD Trust se registra separadamente en el expediente y no constituye ni sustituye la actuación, el consentimiento o la firma jurídica del convocante.'
  );
  IF right(btrim(v_reviewed_text), length(v_expected_suffix)) IS DISTINCT FROM v_expected_suffix THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_DEMO_SUFFIX_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  -- Además del prefijo exacto, los bloques completos que niegan remisión y
  -- puesta a disposición reales deben conservarse en el cuerpo aprobado.
  IF strpos(
    v_reviewed_text,
    'El borrador prevé que una eventual convocatoria jurídica se remita individualmente a cada consejero por '
  ) = 0 OR strpos(
    v_reviewed_text,
    'Esta simulación no produce remisión ni comunicación real.'
  ) = 0 OR strpos(
    v_reviewed_text,
    'Esta simulación no produce puesta a disposición real ni acredita que los consejeros hayan recibido documentación.'
  ) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_DEMO_SAFEGUARDS_MISSING'
      USING ERRCODE = '23514';
  END IF;

  v_structure_position := strpos(
    v_reviewed_compact,
    'simulaciondemosinefectojuridico'
  );
  IF v_structure_position = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_DEMO_HEADING_MISSING'
      USING ERRCODE = '23514';
  END IF;
  v_structure_cursor := v_structure_position;

  v_structure_position := strpos(
    substring(v_reviewed_compact FROM v_structure_cursor + 1),
    'ordendeldia'
  );
  IF v_structure_position = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_AGENDA_HEADING_MISSING'
      USING ERRCODE = '23514';
  END IF;
  v_structure_cursor := v_structure_cursor + v_structure_position;

  v_required_compact := regexp_replace(
    translate(lower(v_entity.legal_name), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    '',
    'g'
  );
  IF v_required_compact = '' OR strpos(v_reviewed_compact, v_required_compact) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_ENTITY_NAME_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_required_compact := regexp_replace(
    translate(lower(v_body.name), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    '',
    'g'
  );
  IF v_required_compact = '' OR strpos(v_reviewed_compact, v_required_compact) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_BODY_NAME_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_expected_date_text := concat(
    extract(day FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer,
    ' de ',
    (ARRAY[
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ])[extract(month FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer],
    ' de ',
    extract(year FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer
  );
  IF strpos(lower(v_reviewed_text), v_expected_date_text) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_MEETING_DATE_MISMATCH'
      USING ERRCODE = '23514';
  END IF;
  IF strpos(v_reviewed_compact, to_char(v_fecha_1 AT TIME ZONE 'Europe/Madrid', 'HH24MI')) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_MEETING_TIME_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_required_compact := regexp_replace(
    translate(lower(v_place), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    '',
    'g'
  );
  IF v_required_compact = '' OR strpos(v_reviewed_compact, v_required_compact) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_PLACE_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  FOR v_semantic_item, v_agenda_ordinal IN
    SELECT agenda.value, agenda.ordinality::integer
      FROM jsonb_array_elements(v_convocatoria.agenda_items)
        WITH ORDINALITY AS agenda(value, ordinality)
     ORDER BY agenda.ordinality
  LOOP
    v_expected_line := concat(
      v_agenda_ordinal::text,
      '. ',
      btrim(COALESCE(v_semantic_item ->> 'titulo', ''))
    );
    SELECT pg_catalog.count(*), pg_catalog.min(pg_catalog.btrim(line.value))
      INTO v_line_count, v_agenda_line
      FROM pg_catalog.regexp_split_to_table(
        pg_catalog.replace(v_reviewed_text, E'\r\n', E'\n'),
        E'\n'
      ) AS line(value)
     WHERE pg_catalog.left(
       pg_catalog.btrim(line.value),
       pg_catalog.length(v_expected_line)
     ) = v_expected_line;
    IF v_expected_line = concat(v_agenda_ordinal::text, '. ')
      OR v_line_count <> 1 THEN
      RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_AGENDA_LINE_MISMATCH: %',
        v_expected_line
        USING ERRCODE = '23514';
    END IF;

    v_required_compact := regexp_replace(
      translate(lower(COALESCE(v_semantic_item ->> 'titulo', '')), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+',
      '',
      'g'
    );
    v_structure_position := strpos(
      substring(v_reviewed_compact FROM v_structure_cursor + 1),
      v_required_compact
    );
    IF v_required_compact = '' OR v_structure_position = 0 THEN
      RAISE EXCEPTION 'CONVOCATION_TEXT_AGENDA_TITLE_MISMATCH: %',
        COALESCE(v_semantic_item ->> 'titulo', '<missing>')
        USING ERRCODE = '23514';
    END IF;
    v_structure_cursor := v_structure_cursor + v_structure_position;

    v_agenda_context_normalized := v_agenda_context_normalized || ' ' || translate(
      lower(
        concat_ws(
          ' ',
          v_semantic_item ->> 'titulo',
          v_semantic_item ->> 'propuesta_acuerdo',
          v_semantic_item ->> 'representative_name'
        )
      ),
      'áéíóúüñ',
      'aeiouun'
    );

    IF v_semantic_item ->> 'materia' = 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL' THEN
      v_required_compact := regexp_replace(
        translate(lower(COALESCE(v_semantic_item ->> 'target_entity_name', '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]+',
        '',
        'g'
      );
      IF v_required_compact = '' OR strpos(v_agenda_line, COALESCE(v_semantic_item ->> 'target_entity_name', '')) = 0 THEN
        RAISE EXCEPTION 'CONVOCATION_TEXT_REPRESENTATION_TARGET_MISMATCH'
          USING ERRCODE = '23514';
      END IF;

      v_required_compact := regexp_replace(
        translate(
          lower(
            regexp_replace(
              COALESCE(v_semantic_item ->> 'representative_name', ''),
              '^(Dña\.|Dª\.|D\.|Doña|Don)\s*',
              '',
              'i'
            )
          ),
          'áéíóúüñ',
          'aeiouun'
        ),
        '[^a-z0-9]+',
        '',
        'g'
      );
      IF v_required_compact = '' OR strpos(
        lower(v_agenda_line),
        lower(regexp_replace(
          COALESCE(v_semantic_item ->> 'representative_name', ''),
          '^(Dña\.|Dª\.|D\.|Doña|Don)\s*',
          '',
          'i'
        ))
      ) = 0 THEN
        RAISE EXCEPTION 'CONVOCATION_TEXT_REPRESENTATION_PERSON_MISMATCH'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  FOREACH v_required_compact IN ARRAY ARRAY[
    'plazoyformadelaconvocatoria',
    'documentaciondesoporte',
    'registrotecnicorealizadoporlasecretariasocietariaenelentornodemo',
    regexp_replace(
      translate(lower(v_president.full_name), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+', '', 'g'
    ),
    'documentodemooperativosinefectojuridico',
    'noconstituyeunaconvocatoriaemitida',
    'eadtrust'
  ] LOOP
    v_structure_position := strpos(
      substring(v_reviewed_compact FROM v_structure_cursor + 1),
      v_required_compact
    );
    IF v_required_compact = '' OR v_structure_position = 0 THEN
      RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_SECTION_ORDER_MISMATCH: %',
        v_required_compact
        USING ERRCODE = '23514';
    END IF;
    v_structure_cursor := v_structure_cursor + v_structure_position;
  END LOOP;

  -- Bloquea la contaminación legacy que designaba a Isabel en lugar de la
  -- persona derivada. Isabel solo puede aparecer si otra propuesta canónica
  -- del mismo orden del día la nombra expresamente.
  IF strpos(v_reviewed_normalized, 'isabel moreno castro') > 0
     AND strpos(v_agenda_context_normalized, 'isabel moreno castro') = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_LEGACY_ISABEL_CONTRADICTION'
      USING ERRCODE = '23514';
  END IF;

  -- Segunda lectura inmediatamente anterior al registro WORM. El trigger 137
  -- mantiene SHARE locks de transacción sobre cargos, poderes, capital y
  -- condiciones; esta lectura comprueba que los IDs y valores normalizados que
  -- se van a congelar siguen resolviendo exactamente a las fuentes bloqueadas.
  SELECT pg_catalog.count(*)
    INTO v_recheck_count
    FROM public.authority_evidence evidence
   WHERE evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.cargo = 'PRESIDENTE'
     AND evidence.estado = 'VIGENTE'
     AND evidence.fecha_inicio <= v_convocatoria.fecha_emision
     AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= v_convocatoria.fecha_emision);
  IF v_recheck_count <> 1 THEN
    RAISE EXCEPTION 'CONVOCATION_AUTHORITY_REVALIDATION_FAILED'
      USING ERRCODE = '23514';
  END IF;

  SELECT evidence.* INTO STRICT v_authority
    FROM public.authority_evidence evidence
   WHERE evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.cargo = 'PRESIDENTE'
     AND evidence.estado = 'VIGENTE'
     AND evidence.fecha_inicio <= v_convocatoria.fecha_emision
     AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= v_convocatoria.fecha_emision)
   FOR SHARE;

  FOR v_semantic_item IN
    SELECT agenda.value
      FROM jsonb_array_elements(v_convocatoria.agenda_items)
        WITH ORDINALITY AS agenda(value, ordinality)
     WHERE agenda.value ->> 'materia' =
       'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
     ORDER BY agenda.ordinality
  LOOP
    SELECT target.* INTO STRICT v_recheck_target
      FROM public.entities target
     WHERE target.id = (v_semantic_item ->> 'target_entity_id')::uuid
       AND target.tenant_id = v_tenant_id
       AND target.id <> v_entity.id
       AND target.entity_status = 'Active'
       AND upper(COALESCE(target.jurisdiction, '')) = 'ES'
       AND target.data_class = 'DEMO'
       AND regexp_replace(
         upper(COALESCE(target.tipo_social, target.legal_form, '')),
         '[^A-Z]',
         '',
         'g'
       ) IN ('SL', 'SLU')
     FOR SHARE;

    SELECT representative.* INTO STRICT v_recheck_representative
      FROM public.persons representative
     WHERE representative.id = (v_semantic_item ->> 'representative_person_id')::uuid
       AND representative.tenant_id = v_tenant_id
       AND representative.person_type = 'PF'
       AND representative.data_class = 'DEMO'
     FOR SHARE;

    SELECT delegation.* INTO STRICT v_recheck_delegation
      FROM public.delegations delegation
     WHERE delegation.id = (v_semantic_item ->> 'representation_delegation_id')::uuid
       AND delegation.tenant_id = v_tenant_id
       AND delegation.entity_id = v_entity.id
       AND delegation.grantor_id = v_entity.person_id
       AND delegation.delegate_id = v_recheck_representative.id
       AND delegation.delegation_type = 'PODER_GENERAL_REPRESENTACION_SOCIO_UNICO_DEMO'
       AND delegation.scope = 'ART_183_1_ALL_ASSETS_NATIONAL_TERRITORY_DEMO'
       AND delegation.limits = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
       AND delegation.status = 'Vigente'
       AND delegation.start_date IS NOT NULL
       AND delegation.start_date <= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
       AND (
         delegation.end_date IS NULL
         OR delegation.end_date >= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
       )
       AND delegation.representation_authority_route = 'GENERAL_PUBLIC_POWER_ART_183_1'
       AND COALESCE(delegation.representation_source_reference, '') <> ''
       AND delegation.representation_evidence_status = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
       AND delegation.representation_legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
       AND delegation.representation_source_uri IS NULL
       AND delegation.representation_source_hash_sha512 IS NULL
     FOR SHARE;

    SELECT
      COALESCE(sum(holding.porcentaje_capital), 0),
      COALESCE(sum(holding.porcentaje_capital) FILTER (
        WHERE holding.holder_person_id = v_entity.person_id
          AND NOT holding.is_treasury
      ), 0),
      COALESCE(sum(holding.porcentaje_capital) FILTER (
        WHERE holding.holder_person_id = v_entity.person_id
          AND NOT holding.is_treasury
          AND holding.voting_rights
      ), 0),
      count(*) FILTER (WHERE holding.porcentaje_capital IS NULL)
    INTO
      v_recheck_target_total,
      v_recheck_source_total,
      v_recheck_voting_total,
      v_recheck_null_count
    FROM public.capital_holdings holding
    WHERE holding.tenant_id = v_tenant_id
      AND holding.entity_id = v_recheck_target.id
      AND holding.effective_from <= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
      AND (
        holding.effective_to IS NULL
        OR holding.effective_to >= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
      );

    IF v_recheck_null_count <> 0
      OR v_recheck_target_total <> 100
      OR v_recheck_source_total <> 100
      OR v_recheck_voting_total <> 100
      OR v_semantic_item ->> 'target_entity_name' IS DISTINCT FROM v_recheck_target.legal_name
      OR v_semantic_item ->> 'representative_name' IS DISTINCT FROM v_recheck_representative.full_name
      OR NULLIF(v_semantic_item ->> 'source_shareholder_entity_id', '')::uuid IS DISTINCT FROM v_entity.id
      OR NULLIF(v_semantic_item ->> 'source_shareholder_person_id', '')::uuid IS DISTINCT FROM v_entity.person_id
      OR NULLIF(v_semantic_item ->> 'capital_ownership_percentage', '')::numeric IS DISTINCT FROM v_recheck_source_total
      OR NULLIF(v_semantic_item ->> 'capital_voting_percentage', '')::numeric IS DISTINCT FROM v_recheck_voting_total
      OR v_semantic_item ->> 'representation_authority_route' IS DISTINCT FROM
        v_recheck_delegation.representation_authority_route
      OR v_semantic_item ->> 'representation_evidence_status' IS DISTINCT FROM
        v_recheck_delegation.representation_evidence_status
      OR v_semantic_item ->> 'representation_source_reference' IS DISTINCT FROM
        v_recheck_delegation.representation_source_reference
      OR v_semantic_item ->> 'representation_legal_effect' IS DISTINCT FROM
        v_recheck_delegation.representation_legal_effect THEN
      RAISE EXCEPTION 'CONVOCATION_REPRESENTATION_SOURCE_REVALIDATION_FAILED'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.condiciones_persona administrator
       WHERE administrator.tenant_id = v_tenant_id
         AND administrator.entity_id = v_recheck_target.id
         AND administrator.person_id = v_entity.person_id
         AND administrator.tipo_condicion IN (
           'ADMIN_UNICO', 'ADMIN_SOLIDARIO', 'ADMIN_MANCOMUNADO', 'ADMIN_PJ',
           'CONSEJERO', 'PRESIDENTE', 'VICEPRESIDENTE', 'CONSEJERO_COORDINADOR'
         )
         AND administrator.fecha_inicio <=
           (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
         AND (
           administrator.fecha_fin IS NULL
           OR administrator.fecha_fin >=
             (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
         )
    ) THEN
      RAISE EXCEPTION 'CONVOCATION_REPRESENTATION_ART_212_BIS_REVALIDATION_FAILED'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  v_agenda_hash_sha256 := encode(
    extensions.digest(
      convert_to(COALESCE(v_convocatoria.agenda_items, '[]'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.convocation_acts (
    tenant_id,
    convocatoria_id,
    actor_person_id,
    actor_authority_evidence_id,
    act_type,
    authority_route,
    approved_text_hash_sha256,
    agenda_hash_sha256,
    act_payload,
    act_hash_sha512,
    data_class,
    legal_effect,
    recorded_by,
    recorded_at,
    immutable_at
  ) VALUES (
    v_tenant_id,
    v_convocatoria.id,
    v_president.id,
    v_authority.id,
    'DEMO_CONVOCATION_RECORD',
    'PRESIDENTE_ART_246_1',
    v_reviewed_text_hash_sha256,
    v_agenda_hash_sha256,
    '{}'::jsonb,
    repeat('0', 128),
    'DEMO',
    'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    v_user_id,
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING * INTO v_act_row;

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.convocation-manifest.v2',
    'convocatoria_id', v_convocatoria.id,
    'tenant_id', v_tenant_id,
    'data_class', 'DEMO',
    'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    'record_status', 'DEMO_OPERATIONAL_DRAFT_RECORDED',
    'database_state', v_convocatoria.estado,
    'not_a_legal_convocation', true,
    'president_action_not_asserted', true,
    'recorded_at', v_act_row.recorded_at,
    'recorded_on', v_convocatoria.fecha_emision,
    'recorded_by_user_id', v_user_id,
    'approved_template', jsonb_build_object(
      'id', v_template.id,
      'type', v_template.tipo,
      'matter', v_template.materia,
      'version', v_template.version,
      'content_hash_sha256', v_template.content_hash_sha256
    ),
    'reviewed_demo_draft_text', v_reviewed_text,
    'reviewed_demo_draft_text_hash_sha256', v_reviewed_text_hash_sha256,
    'entity', jsonb_build_object(
      'id', v_entity.id,
      'person_id', v_entity.person_id,
      'legal_name', v_entity.legal_name,
      'jurisdiction', v_entity.jurisdiction,
      'entity_status', v_entity.entity_status,
      'data_class', v_entity.data_class
    ),
    'body', jsonb_build_object(
      'id', v_body.id,
      'name', v_body.name,
      'body_type', v_body.body_type
    ),
    'authority', jsonb_build_object(
      'route', v_convocatoria.convocation_authority_route,
      'office', 'PRESIDENTE',
      'office_evidence_id', v_authority.id,
      'person_id', v_president.id,
      'person_name', v_president.full_name,
      'office_evidence_status', v_authority.estado,
      'office_evidence_source', v_authority.fuente_designacion,
      'act_id', v_act_row.id,
      'act_hash_sha512', v_act_row.act_hash_sha512,
      'act_type', v_act_row.act_type,
      'act_recorded_by', v_act_row.recorded_by,
      'act_recorded_at', v_act_row.recorded_at,
      'actor_role_reference_only', true,
      'president_action_not_asserted', true,
      'act_basis', 'DEMO_WORM_RECORD_NO_LEGAL_EFFECT',
      'act_legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
      'office_evidence_is_not_convocation_act', true,
      'ead_signature_service_required', false,
      'legal_signature_status', 'NOT_ASSERTED',
      'external_signature_requirements', 'OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT'
    ),
    'meeting', jsonb_build_object(
      'first_call_at', v_convocatoria.fecha_1,
      'second_call_at', v_convocatoria.fecha_2,
      'modality', v_convocatoria.modalidad,
      'place', v_convocatoria.lugar
    ),
    'publication', jsonb_build_object(
      'requested_channels', to_jsonb(v_requested_channels),
      'sandbox_channels', to_jsonb(v_sandbox_channels),
      'delivery_mode', 'SANDBOX_ONLY',
      'real_delivery_allowed', false,
      'ead_interposition_separate', true,
      'ead_signature_service_required', false,
      'legal_signature_status', 'NOT_ASSERTED',
      'external_signature_requirements', 'OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT'
    ),
    'document_source', jsonb_build_object(
      'reviewed_text', v_reviewed_text,
      'reviewed_text_hash_sha256', v_reviewed_text_hash_sha256,
      'reviewed_text_hash_sha512', v_reviewed_text_hash,
      'render_policy', 'SERVER_ONLY_FROM_IMMUTABLE_MANIFEST'
    ),
    'agenda', v_canonical_agenda
  );

  v_manifest_hash := encode(
    extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha512'),
    'hex'
  );

  INSERT INTO public.convocation_manifests (
    tenant_id,
    convocatoria_id,
    act_id,
    act_hash_sha512,
    manifest_json,
    manifest_hash_sha512,
    data_class,
    legal_effect,
    created_by
  ) VALUES (
    v_tenant_id,
    v_convocatoria.id,
    v_act_row.id,
    v_act_row.act_hash_sha512,
    v_manifest,
    v_manifest_hash,
    'DEMO',
    'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    v_user_id
  )
  RETURNING * INTO v_manifest_row;

  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', 'off', true);

  RETURN jsonb_build_object(
    'convocatoria', to_jsonb(v_convocatoria),
    'act', to_jsonb(v_act_row),
    'manifest', to_jsonb(v_manifest_row)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.fn_emit_convocatoria(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_emit_convocatoria(jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_transition_convocatoria_lifecycle(
  p_convocatoria_id uuid,
  p_target_state text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_state text := upper(btrim(COALESCE(p_target_state, '')));
  v_convocatoria public.convocatorias%ROWTYPE;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_act public.convocation_acts%ROWTYPE;
  v_event public.convocation_lifecycle_events%ROWTYPE;
  v_role_ok boolean;
BEGIN
  IF v_user_id IS NULL OR public.fn_secretaria_is_service_role() IS TRUE THEN
    RAISE EXCEPTION 'AUTHENTICATED_USER_REQUIRED_FOR_CONVOCATION_LIFECYCLE'
      USING ERRCODE = '42501';
  END IF;
  IF v_target_state NOT IN ('CANCELADA', 'RECTIFICADA')
    OR length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_TARGET_AND_REASON_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT convocatoria.* INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
   FOR UPDATE;
  IF NOT FOUND OR v_convocatoria.estado <> 'EMITIDA'
    OR v_convocatoria.immutable_at IS NULL THEN
    RAISE EXCEPTION 'ONLY_EMITTED_CONVOCATION_CAN_TRANSITION'
      USING ERRCODE = '23514';
  END IF;
  IF public.fn_assert_current_tenant_id() IS DISTINCT FROM v_convocatoria.tenant_id THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_TENANT_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.rbac_user_roles user_role
      JOIN public.rbac_roles role ON role.id = user_role.role_id
      JOIN public.capability_matrix capability
        ON capability.role = role.role_code
       AND capability.action = 'CONVOCATION_ISSUE'
       AND capability.enabled IS TRUE
     WHERE user_role.user_id = v_user_id
       AND user_role.tenant_id = v_convocatoria.tenant_id
       AND user_role.is_active IS TRUE
       AND (user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp())
       AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
  ) INTO v_role_ok;
  IF v_role_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ACTIVE_CONVOCATION_ISSUE_CAPABILITY_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  SELECT manifest.* INTO STRICT v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.tenant_id = v_convocatoria.tenant_id
     AND manifest.convocatoria_id = v_convocatoria.id;
  SELECT act.* INTO STRICT v_act
    FROM public.convocation_acts act
   WHERE act.id = v_manifest.act_id
     AND act.tenant_id = v_convocatoria.tenant_id
     AND act.convocatoria_id = v_convocatoria.id
     AND act.act_hash_sha512 = v_manifest.act_hash_sha512;

  PERFORM set_config('app.secretaria_convocation_lifecycle_rpc', 'on', true);
  INSERT INTO public.convocation_lifecycle_events (
    tenant_id,
    convocatoria_id,
    manifest_id,
    act_id,
    from_state,
    to_state,
    reason,
    event_payload,
    event_hash_sha512,
    data_class,
    legal_effect,
    recorded_by,
    recorded_at,
    immutable_at
  ) VALUES (
    v_convocatoria.tenant_id,
    v_convocatoria.id,
    v_manifest.id,
    v_act.id,
    'EMITIDA',
    v_target_state,
    btrim(p_reason),
    '{}'::jsonb,
    repeat('0', 128),
    'DEMO',
    'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    v_user_id,
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING * INTO v_event;

  UPDATE public.convocatorias convocatoria
     SET estado = v_target_state
   WHERE convocatoria.id = v_convocatoria.id
     AND convocatoria.tenant_id = v_convocatoria.tenant_id
     AND convocatoria.estado = 'EMITIDA'
  RETURNING convocatoria.* INTO v_convocatoria;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_CONCURRENT_STATE_CHANGE'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('app.secretaria_convocation_lifecycle_rpc', 'off', true);

  RETURN jsonb_build_object(
    'convocatoria', to_jsonb(v_convocatoria),
    'event', to_jsonb(v_event),
    'manifest', to_jsonb(v_manifest),
    'act', to_jsonb(v_act)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.fn_transition_convocatoria_lifecycle(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_transition_convocatoria_lifecycle(uuid, text, text)
  TO authenticated;

-- Preflight orientativo común para la UI. El ID seleccionado es el de la
-- delegación, no el de la persona; el gate de emisión vuelve a verificar todo.
CREATE OR REPLACE FUNCTION public.fn_shareholder_representation_candidates(
  p_shareholder_entity_id uuid,
  p_as_of_date date
)
RETURNS TABLE(
  delegation_id uuid,
  representative_person_id uuid,
  representative_name text,
  authority_route text,
  evidence_status text,
  legal_effect text,
  source_reference text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT entity.tenant_id INTO v_tenant_id
    FROM public.entities entity
   WHERE entity.id = p_shareholder_entity_id
     AND entity.data_class = 'DEMO'
     AND entity.entity_status = 'Active'
     AND upper(COALESCE(entity.jurisdiction, '')) = 'ES';
  IF NOT FOUND OR p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'DEMO_SHAREHOLDER_AND_DATE_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE
    AND public.fn_assert_current_tenant_id() IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'REPRESENTATION_PREFLIGHT_TENANT_DENIED'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    delegation.id,
    representative.id,
    representative.full_name,
    delegation.representation_authority_route,
    delegation.representation_evidence_status,
    delegation.representation_legal_effect,
    delegation.representation_source_reference
  FROM public.delegations delegation
  JOIN public.entities shareholder
    ON shareholder.id = delegation.entity_id
   AND shareholder.tenant_id = delegation.tenant_id
   AND shareholder.data_class = 'DEMO'
   AND shareholder.entity_status = 'Active'
   AND upper(COALESCE(shareholder.jurisdiction, '')) = 'ES'
  JOIN public.persons grantor
    ON grantor.id = delegation.grantor_id
   AND grantor.id = shareholder.person_id
   AND grantor.tenant_id = delegation.tenant_id
   AND grantor.person_type = 'PJ'
   AND grantor.data_class = 'DEMO'
  JOIN public.persons representative
    ON representative.id = delegation.delegate_id
   AND representative.tenant_id = delegation.tenant_id
   AND representative.person_type = 'PF'
   AND representative.data_class = 'DEMO'
  WHERE delegation.tenant_id = v_tenant_id
    AND delegation.entity_id = p_shareholder_entity_id
    AND delegation.delegation_type = 'PODER_GENERAL_REPRESENTACION_SOCIO_UNICO_DEMO'
    AND delegation.scope = 'ART_183_1_ALL_ASSETS_NATIONAL_TERRITORY_DEMO'
    AND delegation.limits = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    AND delegation.status = 'Vigente'
    AND delegation.start_date <= p_as_of_date
    AND (delegation.end_date IS NULL OR delegation.end_date >= p_as_of_date)
    AND delegation.representation_authority_route = 'GENERAL_PUBLIC_POWER_ART_183_1'
    AND delegation.representation_evidence_status = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    AND delegation.representation_legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    AND delegation.representation_source_uri IS NULL
    AND delegation.representation_source_hash_sha512 IS NULL
  ORDER BY representative.full_name, delegation.id;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_shareholder_representation_candidates(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_shareholder_representation_candidates(uuid, date)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. DEMO nunca abandona sandbox hacia una entrega real
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION secretaria_private.fn_demo_convocation_no_delivery_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_manifest public.convocation_manifests%ROWTYPE;
BEGIN
  IF NEW.convocatoria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT manifest.* INTO v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.convocatoria_id = NEW.convocatoria_id
     AND manifest.tenant_id = NEW.tenant_id;

  IF FOUND AND v_manifest.data_class = 'DEMO' THEN
    IF NEW.estado NOT IN ('BORRADOR', 'CANCELADA') THEN
      RAISE EXCEPTION 'DEMO_CONVOCATION_SANDBOX_NO_REAL_DISPATCH'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
        'sandbox', true,
        'dispatch_forbidden', true,
        'data_class', 'DEMO',
        'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
      );
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_demo_convocation_no_delivery_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_demo_convocation_no_delivery
  ON public.communications;
CREATE TRIGGER trg_00_demo_convocation_no_delivery
  BEFORE INSERT OR UPDATE OF estado, convocatoria_id ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_demo_convocation_no_delivery_guard();

-- ---------------------------------------------------------------------------
-- 6. Artefacto final renderizado en servidor y ligado al manifest exacto
-- ---------------------------------------------------------------------------

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS convocation_manifest_hash_sha512 text;

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_convocation_manifest_hash_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_convocation_manifest_hash_check CHECK (
    convocation_manifest_hash_sha512 IS NULL
    OR convocation_manifest_hash_sha512 ~ '^[0-9a-f]{128}$'
  );

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_final_candidate_commitment_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_final_candidate_commitment_check CHECK (
    convocatoria_id IS NULL
    OR artifact_kind <> 'CONVOCATORIA_FINAL'
    OR (
      (artifact_candidate_id IS NOT NULL AND convocation_manifest_hash_sha512 IS NULL)
      OR
      (artifact_candidate_id IS NULL AND convocation_manifest_hash_sha512 IS NOT NULL)
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.fn_convocatoria_final_artifact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_verified_writer boolean :=
    current_setting('app.secretaria_verified_artifact_rpc', true) = 'on';
  v_server_writer boolean :=
    current_setting('app.secretaria_server_rendered_artifact_rpc', true) = 'on'
    AND public.fn_secretaria_is_service_role() IS TRUE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.convocatoria_id IS NOT NULL THEN
      RAISE EXCEPTION 'verified convocatoria artifacts cannot be deleted directly'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.convocatoria_id IS NOT NULL THEN
    IF NOT (v_verified_writer OR v_server_writer) THEN
      RAISE EXCEPTION 'convocatoria artifacts can only be updated by verified registration'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
       OR NEW.agenda_item_index IS DISTINCT FROM OLD.agenda_item_index
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_hash IS DISTINCT FROM OLD.file_hash
       OR NEW.file_hash_sha512 IS DISTINCT FROM OLD.file_hash_sha512
       OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
       OR NEW.artifact_candidate_id IS DISTINCT FROM OLD.artifact_candidate_id
       OR NEW.convocation_manifest_hash_sha512 IS DISTINCT FROM OLD.convocation_manifest_hash_sha512 THEN
      RAISE EXCEPTION 'verified convocatoria artifact identity and hashes are immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.convocatoria_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (v_verified_writer OR v_server_writer) THEN
    RAISE EXCEPTION 'convocatoria artifacts require server-side binary verification'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
      0
    )
  );

  SELECT * INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact convocatoria/tenant mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.file_url NOT LIKE
     'evidence-bundle://convocatorias/' || NEW.convocatoria_id::text || '/%' THEN
    RAISE EXCEPTION 'artifact storage URI is outside its convocatoria prefix'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.artifact_verified_at IS NULL
     OR NEW.artifact_verified_by_service IS NOT TRUE
     OR COALESCE(NEW.artifact_verified_size_bytes, 0) <= 0 THEN
    RAISE EXCEPTION 'server-side binary verification metadata is required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.artifact_kind = 'CONVOCATORIA_FINAL' THEN
    IF v_convocatoria.estado <> 'EMITIDA'
       OR v_convocatoria.immutable_at IS NULL
       OR NEW.agenda_item_index IS NOT NULL
       OR NEW.file_name !~* '\.docx$'
       OR NEW.artifact_verified_mime_type <>
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN
      RAISE EXCEPTION 'final artifact requires emitted immutable convocatoria and verified DOCX'
        USING ERRCODE = '23514';
    END IF;

    IF v_server_writer THEN
      SELECT manifest.* INTO v_manifest
        FROM public.convocation_manifests manifest
       WHERE manifest.convocatoria_id = NEW.convocatoria_id
         AND manifest.tenant_id = NEW.tenant_id
         AND manifest.manifest_hash_sha512 = NEW.convocation_manifest_hash_sha512
         AND manifest.data_class = 'DEMO'
         AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT';
      IF NOT FOUND OR NEW.artifact_candidate_id IS NOT NULL THEN
        RAISE EXCEPTION 'server-rendered final artifact requires exact DEMO manifest and no browser candidate'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.artifact_candidate_id IS NULL
      OR NEW.convocation_manifest_hash_sha512 IS NOT NULL THEN
      RAISE EXCEPTION 'legacy verified final artifact requires its exact candidate'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_convocatoria_final_artifact_guard()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_convocatoria_final_artifact_guard()
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_register_server_rendered_convocation_attachment(
  p_tenant_id uuid,
  p_convocatoria_id uuid,
  p_manifest_hash_sha512 text,
  p_file_name text,
  p_storage_uri text,
  p_hash_sha256 text,
  p_hash_sha512 text,
  p_size_bytes bigint,
  p_mime_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_manifest public.convocation_manifests%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_existing public.attachments%ROWTYPE;
  v_existing_count bigint;
  v_attachment_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for server-rendered convocatoria registration'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_convocatoria_id IS NULL
     OR lower(COALESCE(p_manifest_hash_sha512, '')) !~ '^[0-9a-f]{128}$'
     OR lower(COALESCE(p_hash_sha256, '')) !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_hash_sha512, '')) !~ '^[0-9a-f]{128}$'
     OR COALESCE(p_size_bytes, 0) <= 0
     OR p_mime_type <>
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     OR COALESCE(p_file_name, '') !~* '\.docx$'
     OR p_storage_uri NOT LIKE
        'evidence-bundle://convocatorias/' || p_convocatoria_id::text || '/%' THEN
    RAISE EXCEPTION 'server-rendered convocatoria artifact contract invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT manifest.* INTO v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.tenant_id = p_tenant_id
     AND manifest.convocatoria_id = p_convocatoria_id
     AND manifest.manifest_hash_sha512 = lower(p_manifest_hash_sha512)
     AND manifest.data_class = 'DEMO'
     AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT';
  IF NOT FOUND OR v_manifest.manifest_hash_sha512 IS DISTINCT FROM encode(
    extensions.digest(convert_to(v_manifest.manifest_json::text, 'UTF8'), 'sha512'),
    'hex'
  ) THEN
    RAISE EXCEPTION 'server-rendered artifact manifest mismatch or drift'
      USING ERRCODE = '23514';
  END IF;

  SELECT convocatoria.* INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = p_tenant_id
     AND convocatoria.estado = 'EMITIDA'
     AND convocatoria.immutable_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'server-rendered artifact requires emitted immutable convocatoria'
      USING ERRCODE = '23514';
  END IF;
  IF v_manifest.manifest_json ->> 'reviewed_demo_draft_text'
       IS DISTINCT FROM v_convocatoria.convocatoria_text
     OR v_manifest.manifest_json ->> 'reviewed_demo_draft_text_hash_sha256'
       IS DISTINCT FROM encode(
         extensions.digest(
           pg_catalog.convert_to(v_convocatoria.convocatoria_text, 'UTF8'),
           'sha256'
         ),
         'hex'
       ) THEN
    RAISE EXCEPTION 'server-rendered artifact manifest is not bound to the recorded DEMO draft text'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'CONVOCATORIA:SERVER_RENDER:' || p_tenant_id::text || ':' || p_convocatoria_id::text,
      0
    )
  );
  -- Compartir el mismo lock que la ruta legacy impide que ambas rutas creen
  -- simultáneamente dos documentos finales para una convocatoria.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || p_tenant_id::text || ':' || p_convocatoria_id::text,
      0
    )
  );

  SELECT count(*) INTO v_existing_count
    FROM public.attachments attachment
   WHERE attachment.tenant_id = p_tenant_id
     AND attachment.convocatoria_id = p_convocatoria_id
     AND attachment.artifact_kind = 'CONVOCATORIA_FINAL';
  IF v_existing_count > 1 THEN
    RAISE EXCEPTION 'convocatoria has multiple final artifacts; manual consistency repair required'
      USING ERRCODE = '23514';
  END IF;

  SELECT attachment.* INTO v_existing
    FROM public.attachments attachment
   WHERE attachment.tenant_id = p_tenant_id
     AND attachment.convocatoria_id = p_convocatoria_id
     AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.file_name = p_file_name
       AND v_existing.file_url = p_storage_uri
       AND v_existing.file_hash = lower(p_hash_sha256)
       AND v_existing.file_hash_sha512 = lower(p_hash_sha512)
       AND v_existing.artifact_verified_size_bytes = p_size_bytes
       AND v_existing.artifact_verified_mime_type = p_mime_type
       AND v_existing.convocation_manifest_hash_sha512 = lower(p_manifest_hash_sha512)
       AND v_existing.artifact_candidate_id IS NULL THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'convocatoria already has a different immutable final artifact'
      USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('app.secretaria_server_rendered_artifact_rpc', 'on', true);
  INSERT INTO public.attachments (
    tenant_id,
    convocatoria_id,
    agenda_item_index,
    file_name,
    file_url,
    file_hash,
    file_hash_sha512,
    artifact_kind,
    artifact_registered_at,
    artifact_registered_by,
    artifact_verified_at,
    artifact_verified_by_service,
    artifact_verified_size_bytes,
    artifact_verified_mime_type,
    artifact_candidate_id,
    convocation_manifest_hash_sha512
  ) VALUES (
    p_tenant_id,
    p_convocatoria_id,
    NULL,
    p_file_name,
    p_storage_uri,
    lower(p_hash_sha256),
    lower(p_hash_sha512),
    'CONVOCATORIA_FINAL',
    clock_timestamp(),
    NULL,
    clock_timestamp(),
    true,
    p_size_bytes,
    p_mime_type,
    NULL,
    lower(p_manifest_hash_sha512)
  )
  RETURNING id INTO v_attachment_id;
  PERFORM set_config('app.secretaria_server_rendered_artifact_rpc', 'off', true);

  RETURN v_attachment_id;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_register_server_rendered_convocation_attachment(
  uuid, uuid, text, text, text, text, text, bigint, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_register_server_rendered_convocation_attachment(
  uuid, uuid, text, text, text, text, text, bigint, text
) TO service_role;

-- El precommit browser deja de ser una ruta autorizada para el documento final.
REVOKE ALL ON FUNCTION public.fn_precommit_convocation_final_candidate(
  uuid, uuid, text, text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Self-checks de instalación y privilegios
-- ---------------------------------------------------------------------------

DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.fn_emit_convocatoria(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.fn_emit_convocatoria(jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.fn_emit_convocatoria(jsonb)', 'EXECUTE')
     OR has_function_privilege(
       'anon',
       'public.fn_transition_convocatoria_lifecycle(uuid,text,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'public.fn_transition_convocatoria_lifecycle(uuid,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'service_role',
       'public.fn_transition_convocatoria_lifecycle(uuid,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.fn_register_server_rendered_convocation_attachment(uuid,uuid,text,text,text,text,text,bigint,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'service_role',
       'public.fn_register_server_rendered_convocation_attachment(uuid,uuid,text,text,text,text,text,bigint,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.fn_precommit_convocation_final_candidate(uuid,uuid,text,text,text,text,text,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'CONVOCATION_RPC_PRIVILEGE_CONTRACT_FAILED';
  END IF;

  IF has_table_privilege('authenticated', 'public.convocation_manifests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.convocation_manifests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.convocation_manifests', 'DELETE')
     OR has_table_privilege('service_role', 'public.convocation_manifests', 'INSERT')
     OR has_table_privilege('service_role', 'public.convocation_manifests', 'UPDATE')
     OR has_table_privilege('service_role', 'public.convocation_manifests', 'DELETE')
     OR has_table_privilege('authenticated', 'public.convocation_acts', 'INSERT')
     OR has_table_privilege('authenticated', 'public.convocation_acts', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.convocation_acts', 'DELETE')
     OR has_table_privilege('service_role', 'public.convocation_acts', 'INSERT')
     OR has_table_privilege('service_role', 'public.convocation_acts', 'UPDATE')
     OR has_table_privilege('service_role', 'public.convocation_acts', 'DELETE')
     OR has_table_privilege('authenticated', 'public.convocation_lifecycle_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.convocation_lifecycle_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.convocation_lifecycle_events', 'DELETE')
     OR has_table_privilege('service_role', 'public.convocation_lifecycle_events', 'INSERT')
     OR has_table_privilege('service_role', 'public.convocation_lifecycle_events', 'UPDATE')
     OR has_table_privilege('service_role', 'public.convocation_lifecycle_events', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.convocation_manifests', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.convocation_acts', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.convocation_lifecycle_events', 'SELECT') THEN
    RAISE EXCEPTION 'CONVOCATION_WORM_TABLE_PRIVILEGE_CONTRACT_FAILED';
  END IF;
END
$verify$;

COMMIT;
