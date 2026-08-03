-- Secretaría — política EAD Trust por interposición, sin atribuir firma al QTSP.
--
-- EAD Trust se usa como tercero interpuesto para custodia, constancia/consentimiento,
-- mensajería y e-archiving. Ningún gate creado aquí afirma QES, firma avanzada o
-- firma simple. `signature_claim = false` es una condición de integridad, no una
-- etiqueta de interfaz.
--
-- Cuentas anuales conservan una regla distinta (art. 253.2 LSC): todos los
-- administradores deben firmar o debe constar una causa de falta. La interposición
-- EAD solo custodia la evidencia externa revisada de ese hecho; no convierte la
-- custodia en firma ni atribuye la firma a EAD.
--
-- Forward-only. Las tablas/columnas de firma anteriores se conservan para lectura
-- histórica, pero los writers que podían elevar INTERPOSITION/ADVANCED a firma
-- autoritativa quedan revocados. No se hace backfill probatorio.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Los claims JWT y `user_profiles.role_code` pueden quedar obsoletos después
-- de revocar o expirar una asignación. Las acciones EAD con efecto externo se
-- autorizan contra la asignación RBAC vigente en base de datos.
CREATE OR REPLACE FUNCTION public.fn_secretaria_has_active_role(
  p_tenant_id uuid,
  p_allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.fn_secretaria_is_service_role()
    OR EXISTS (
      SELECT 1
        FROM public.rbac_user_roles user_role
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = auth.uid()
         AND user_role.tenant_id = p_tenant_id
         AND user_role.is_active IS TRUE
         AND (user_role.expires_at IS NULL OR user_role.expires_at > now())
         AND role.role_code = ANY(p_allowed_roles)
    )
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_has_active_role(uuid, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_has_active_role(uuid, text[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_assert_role_allowed(
  p_tenant_id uuid,
  p_allowed_roles text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  IF public.fn_secretaria_is_service_role() THEN
    RETURN;
  END IF;
  IF NOT public.fn_secretaria_has_active_role(p_tenant_id, p_allowed_roles) THEN
    RAISE EXCEPTION 'an active, unexpired role is required for this Secretaria action'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

-- Edge serializa objetos JSON con reglas distintas de `jsonb::text`. El hash
-- probatorio se calcula siempre en PostgreSQL sobre la representación que los
-- gates vuelven a verificar, evitando aceptar un manifiesto cuyo digest no sea
-- reproducible por la base de datos.
CREATE OR REPLACE FUNCTION public.fn_secretaria_jsonb_hash_sha256(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT encode(digest(p_value::text, 'sha256'), 'hex')
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_jsonb_hash_sha256(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_jsonb_hash_sha256(jsonb)
  TO service_role;

-- Ningún payload nuevo puede ocultar un nivel/claim de firma en objetos o
-- arrays anidados. `signature_claim=false` sí es obligatorio y permitido.
CREATE OR REPLACE FUNCTION public.fn_secretaria_jsonb_has_forbidden_signature_claim(
  p_value jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  WITH RECURSIVE walk(value) AS (
    SELECT p_value
    UNION ALL
    SELECT child.value
      FROM walk parent
      CROSS JOIN LATERAL (
        SELECT object_child.value
          FROM jsonb_each(
            CASE WHEN jsonb_typeof(parent.value) = 'object'
              THEN parent.value ELSE '{}'::jsonb END
          ) object_child
        UNION ALL
        SELECT array_child.value
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(parent.value) = 'array'
              THEN parent.value ELSE '[]'::jsonb END
          ) array_child
      ) child
  )
  SELECT EXISTS (
    SELECT 1
      FROM walk node
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(node.value) = 'object'
          THEN node.value ELSE '{}'::jsonb END
      ) field
     WHERE lower(field.key) IN (
       'provider_signature_type', 'signature_type', 'signature_level',
       'qes', 'qualified_signature', 'advanced_signature', 'simple_signature'
     )
        OR (
          lower(field.key) = 'signature_claim'
          AND field.value IS DISTINCT FROM 'false'::jsonb
        )
  )
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_jsonb_has_forbidden_signature_claim(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_jsonb_has_forbidden_signature_claim(jsonb)
  TO service_role;

-- La tabla histórica tenía una policy demo con tenant UUID fijo y DML directo.
-- Las solicitudes quedan de solo lectura para authenticated; cualquier writer
-- futuro deberá pasar por un RPC source-bound. El propietario ve su solicitud y
-- Secretaría puede verla únicamente con tenant y capability vigentes.
ALTER TABLE public.qtsp_signature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qtsp_sr_tenant ON public.qtsp_signature_requests;
DROP POLICY IF EXISTS qtsp_signature_requests_scoped_read
  ON public.qtsp_signature_requests;
CREATE POLICY qtsp_signature_requests_scoped_read
  ON public.qtsp_signature_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.fn_secretaria_current_tenant_id()
    AND (
      created_by = auth.uid()::text
      OR public.fn_secretaria_has_active_role(
        qtsp_signature_requests.tenant_id, ARRAY['ADMIN_TENANT']::text[]
      )
      OR EXISTS (
        SELECT 1
          FROM public.capability_matrix capability
         WHERE public.fn_secretaria_has_active_role(
                 qtsp_signature_requests.tenant_id, ARRAY[capability.role]::text[]
               )
           AND capability.action = 'CERTIFICATION'
           AND capability.enabled IS TRUE
      )
    )
  );

REVOKE ALL ON TABLE public.qtsp_signature_requests
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.qtsp_signature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.qtsp_signature_requests
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_interposition_request_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_forbidden boolean;
BEGIN
  WITH RECURSIVE walk(value) AS (
    SELECT COALESCE(NEW.signatories, '[]'::jsonb)
    UNION ALL
    SELECT child.value
    FROM walk parent
    CROSS JOIN LATERAL (
      SELECT value FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(parent.value) = 'array'
          THEN parent.value ELSE '[]'::jsonb END
      )
      UNION ALL
      SELECT value FROM jsonb_each(
        CASE WHEN jsonb_typeof(parent.value) = 'object'
          THEN parent.value ELSE '{}'::jsonb END
      )
    ) child
  ), fields AS (
    SELECT lower(entry.key) AS key, entry.value
    FROM walk node
    CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(node.value) = 'object'
        THEN node.value ELSE '{}'::jsonb END
    ) entry
  )
  SELECT EXISTS (
    SELECT 1 FROM fields
    WHERE key IN (
      'signature_type', 'signature_level', 'qes', 'qualified_signature',
      'advanced_signature', 'simple_signature'
    )
       OR (key = 'provider_signature_type'
         AND upper(trim(both '"' from value::text)) <> 'INTERPOSITION')
       OR (key = 'signature_claim' AND value IS DISTINCT FROM 'false'::jsonb)
  ) INTO v_forbidden;
  IF v_forbidden THEN
    RAISE EXCEPTION 'QTSP request may only express INTERPOSITION and signature_claim=false'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_secretaria_interposition_request_guard
  ON public.qtsp_signature_requests;
CREATE TRIGGER trg_00_secretaria_interposition_request_guard
  BEFORE INSERT OR UPDATE ON public.qtsp_signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_interposition_request_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_verification_interposition_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.provider_signature_type IS DISTINCT FROM OLD.provider_signature_type)
     AND upper(COALESCE(NEW.provider_signature_type, '')) <> 'INTERPOSITION' THEN
    RAISE EXCEPTION 'new provider verification may only use INTERPOSITION'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_verification_interposition_only
  ON public.secretaria_qtsp_verifications;
CREATE TRIGGER trg_secretaria_verification_interposition_only
  BEFORE INSERT OR UPDATE ON public.secretaria_qtsp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_verification_interposition_only_guard();

-- Un único request canónico abierto por versión de fuente. Se limita a filas
-- source-bound para no reinterpretar solicitudes históricas genéricas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_qtsp_request_canonical_open_head
  ON public.qtsp_signature_requests(
    tenant_id, source_domain, source_id, artifact_kind, content_hash_sha256
  )
  WHERE source_domain IS NOT NULL
    AND sr_status IN ('DRAFT', 'ACTIVE', 'COMPLETED');

-- Ningún byte sale hacia EAD Trust sin una reserva local previa y trazable. La
-- reserva no afirma que EAD haya ejecutado el servicio: únicamente acredita que
-- un usuario autenticado, dentro de su tenant y con rol permitido, fijó la
-- fuente canónica y el hash exacto del payload antes de la llamada externa.
CREATE TABLE IF NOT EXISTS public.secretaria_ead_provider_action_reservations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  source_domain         text NOT NULL CHECK (source_domain IN (
    'MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS', 'ANNUAL_ACCOUNTS_COMPONENT'
  )),
  source_id             uuid NOT NULL,
  action_kind           text NOT NULL CHECK (action_kind IN (
    'SOURCE_CUSTODY', 'EXTERNAL_SIGNATURE_CUSTODY',
    'ANNUAL_ACCOUNTS_EXECUTION_EARCHIVE', 'ANNUAL_ACCOUNTS_COMPONENT_EARCHIVE'
  )),
  subject_key           text NOT NULL DEFAULT '',
  source_hash_sha256    text NOT NULL CHECK (source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  payload_hash_sha256   text NOT NULL CHECK (payload_hash_sha256 ~ '^[0-9a-f]{64}$'),
  reservation_context   jsonb NOT NULL DEFAULT '{}'::jsonb,
  reserved_by           uuid NOT NULL,
  reserved_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (length(subject_key) <= 512),
  CHECK (jsonb_typeof(reservation_context) = 'object'),
  UNIQUE (
    tenant_id, source_domain, source_id, action_kind, subject_key,
    source_hash_sha256, payload_hash_sha256
  )
);

ALTER TABLE public.secretaria_ead_provider_action_reservations
  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS secretaria_ead_provider_reservation_scoped_read
  ON public.secretaria_ead_provider_action_reservations;
CREATE POLICY secretaria_ead_provider_reservation_scoped_read
  ON public.secretaria_ead_provider_action_reservations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.fn_secretaria_current_tenant_id()
    AND (
      reserved_by = auth.uid()
      OR public.fn_secretaria_has_active_role(
        secretaria_ead_provider_action_reservations.tenant_id,
        ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
      )
    )
  );

REVOKE ALL ON TABLE public.secretaria_ead_provider_action_reservations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_ead_provider_action_reservations
  TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_secretaria_ead_provider_reservation_append_only
  ON public.secretaria_ead_provider_action_reservations;
CREATE TRIGGER trg_secretaria_ead_provider_reservation_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_ead_provider_action_reservations
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_append_only_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_reserve_ead_provider_action(
  p_source_domain text,
  p_source_id uuid,
  p_action_kind text,
  p_subject_key text,
  p_source_hash_sha256 text,
  p_payload_hash_sha256 text,
  p_reservation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_source_domain text := upper(btrim(COALESCE(p_source_domain, '')));
  v_action_kind text := upper(btrim(COALESCE(p_action_kind, '')));
  v_subject_key text := btrim(COALESCE(p_subject_key, ''));
  v_source_hash text := lower(btrim(COALESCE(p_source_hash_sha256, '')));
  v_payload_hash text := lower(btrim(COALESCE(p_payload_hash_sha256, '')));
  v_context jsonb := COALESCE(p_reservation_context, '{}'::jsonb);
  v_tenant_id uuid;
  v_expected_hash text;
  v_source_status text;
  v_meeting_id uuid;
  v_meeting_status text;
  v_meeting_start timestamptz;
  v_matter_code text;
  v_agenda_kind text;
  v_reservation_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authenticated caller required' USING ERRCODE = '42501';
  END IF;
  IF p_source_id IS NULL
     OR v_source_domain NOT IN (
       'MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS', 'ANNUAL_ACCOUNTS_COMPONENT'
     )
     OR v_action_kind NOT IN (
       'SOURCE_CUSTODY', 'EXTERNAL_SIGNATURE_CUSTODY',
       'ANNUAL_ACCOUNTS_EXECUTION_EARCHIVE', 'ANNUAL_ACCOUNTS_COMPONENT_EARCHIVE'
     )
     OR length(v_subject_key) > 512
     OR v_source_hash !~ '^[0-9a-f]{64}$'
     OR v_payload_hash !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(v_context) <> 'object'
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(v_context) THEN
    RAISE EXCEPTION 'invalid EAD provider action reservation' USING ERRCODE = '22023';
  END IF;

  -- El navegador no puede demostrar equivalencia semántica entre sus bytes
  -- DOCX/PDF y el render canónico que la base sí verifica como texto. Hasta
  -- disponer de un renderer/registro binario autoritativo server-side, no se
  -- reserva ninguna custodia final de actas o certificaciones.
  IF v_source_domain IN ('MINUTE', 'CERTIFICATION')
     OR v_action_kind = 'SOURCE_CUSTODY' THEN
    RAISE EXCEPTION 'AUTHORITATIVE_BINARY_REQUIRED: browser-generated bytes cannot become a final legal artifact'
      USING ERRCODE = '55000';
  END IF;

  IF v_source_domain = 'MINUTE' THEN
    IF v_action_kind <> 'SOURCE_CUSTODY' THEN
      RAISE EXCEPTION 'minute only supports source custody reservation';
    END IF;
    SELECT minute.tenant_id, lower(minute.content_hash), minute.legal_gate_status
      INTO v_tenant_id, v_expected_hash, v_source_status
      FROM public.minutes minute
     WHERE minute.id = p_source_id
       AND minute.legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL');
  ELSIF v_source_domain = 'CERTIFICATION' THEN
    IF v_action_kind <> 'SOURCE_CUSTODY' THEN
      RAISE EXCEPTION 'certification only supports source custody reservation';
    END IF;
    SELECT certification.tenant_id,
           lower(COALESCE(
             certification.content_hash_sha256,
             encode(digest(convert_to(COALESCE(certification.content, ''), 'UTF8'), 'sha256'), 'hex')
           )),
           certification.legal_gate_status
      INTO v_tenant_id, v_expected_hash, v_source_status
      FROM public.certifications certification
     WHERE certification.id = p_source_id
       AND certification.legal_gate_status IN ('DRAFT', 'ARTIFACT_FINAL');
  ELSIF v_source_domain = 'ANNUAL_ACCOUNTS' THEN
    IF v_action_kind NOT IN (
      'EXTERNAL_SIGNATURE_CUSTODY', 'ANNUAL_ACCOUNTS_EXECUTION_EARCHIVE'
    ) THEN
      RAISE EXCEPTION 'annual accounts action is not reservable';
    END IF;
    SELECT annual_set.tenant_id, lower(annual_set.manifest_hash_sha256),
           annual_set.approval_status || ':' || annual_set.immutability_status
      INTO v_tenant_id, v_expected_hash, v_source_status
      FROM public.secretaria_annual_accounts_sets annual_set
     WHERE annual_set.id = p_source_id
       AND annual_set.approval_status = 'APPROVED'
       AND annual_set.immutability_status = 'IMMUTABLE'
       AND NOT EXISTS (
         SELECT 1
           FROM public.secretaria_annual_accounts_sets successor
          WHERE successor.tenant_id = annual_set.tenant_id
            AND successor.supersedes_set_id = annual_set.id
       );
  ELSE
    IF v_action_kind <> 'ANNUAL_ACCOUNTS_COMPONENT_EARCHIVE' THEN
      RAISE EXCEPTION 'annual accounts component action is not reservable';
    END IF;
    SELECT agenda.tenant_id, meeting.id, meeting.status, meeting.scheduled_start,
           upper(COALESCE(agenda.matter_code, '')), upper(COALESCE(agenda.kind, ''))
      INTO v_tenant_id, v_meeting_id, v_meeting_status, v_meeting_start,
           v_matter_code, v_agenda_kind
      FROM public.agenda_items agenda
      JOIN public.meetings meeting ON meeting.id = agenda.meeting_id
     WHERE agenda.id = p_source_id
       AND agenda.tenant_id = meeting.tenant_id;
    v_expected_hash := v_source_hash;
    v_source_status := v_meeting_status;
    IF v_meeting_id::text IS DISTINCT FROM (v_context ->> 'meeting_id')
       OR v_meeting_status NOT IN ('DRAFT', 'CONVOCADA')
       OR v_meeting_start IS NULL OR v_meeting_start <= now()
       OR v_matter_code <> 'FORMULACION_CUENTAS'
       OR v_agenda_kind <> 'DECISORIO'
       OR COALESCE(v_context ->> 'component_kind', '') NOT IN (
         'BALANCE_SHEET', 'PROFIT_AND_LOSS_STATEMENT', 'NOTES',
         'CHANGES_IN_EQUITY_STATEMENT', 'CASH_FLOW_STATEMENT', 'MANAGEMENT_REPORT'
       )
       OR COALESCE(v_context ->> 'fiscal_year', '') !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'annual accounts component source reservation is stale or incomplete';
    END IF;
  END IF;

  IF v_tenant_id IS NULL
     OR v_tenant_id IS DISTINCT FROM public.fn_secretaria_current_tenant_id()
     OR v_expected_hash IS DISTINCT FROM v_source_hash THEN
    RAISE EXCEPTION 'EAD reservation source not found, stale, or outside tenant'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.fn_secretaria_assert_role_allowed(
    v_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']
  );

  -- Serializa reintentos sobre la misma intención local. El efecto externo usa
  -- además una idempotency key derivada de esta misma tupla.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', v_tenant_id, v_source_domain, p_source_id, v_action_kind,
      v_subject_key, v_source_hash, v_payload_hash),
    0
  ));

  SELECT reservation.id INTO v_reservation_id
    FROM public.secretaria_ead_provider_action_reservations reservation
   WHERE reservation.tenant_id = v_tenant_id
     AND reservation.source_domain = v_source_domain
     AND reservation.source_id = p_source_id
     AND reservation.action_kind = v_action_kind
     AND reservation.subject_key = v_subject_key
     AND reservation.source_hash_sha256 = v_source_hash
     AND reservation.payload_hash_sha256 = v_payload_hash;
  IF FOUND THEN RETURN v_reservation_id; END IF;

  INSERT INTO public.secretaria_ead_provider_action_reservations (
    tenant_id, source_domain, source_id, action_kind, subject_key,
    source_hash_sha256, payload_hash_sha256, reservation_context, reserved_by
  ) VALUES (
    v_tenant_id, v_source_domain, p_source_id, v_action_kind, v_subject_key,
    v_source_hash, v_payload_hash, v_context, auth.uid()
  ) RETURNING id INTO v_reservation_id;
  RETURN v_reservation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_reserve_ead_provider_action(
  text, uuid, text, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_reserve_ead_provider_action(
  text, uuid, text, text, text, text, jsonb
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ledger WORM canónico de interposición EAD
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_ead_interposition_evidence (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  source_domain          text NOT NULL CHECK (source_domain IN (
    'MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS'
  )),
  source_id              uuid NOT NULL,
  legal_artifact_id      uuid REFERENCES public.secretaria_legal_artifacts(id) ON DELETE RESTRICT,
  subject_person_id      uuid REFERENCES public.persons(id) ON DELETE RESTRICT,
  subject_role           text CHECK (subject_role IS NULL OR subject_role IN (
    'PRESIDENTE', 'SECRETARIO', 'CERTIFICANTE', 'VISTO_BUENO', 'ADMINISTRADOR'
  )),
  evidence_purpose       text NOT NULL CHECK (evidence_purpose IN (
    'CUSTODY', 'CONSENT', 'CONSTANCIA', 'EXTERNAL_SIGNATURE_CUSTODY', 'EARCHIVE'
  )),
  provider               text NOT NULL DEFAULT 'EAD_TRUST' CHECK (provider = 'EAD_TRUST'),
  provider_service       text NOT NULL CHECK (provider_service = 'EVIDENCE_MANAGER'),
  provider_mode          text NOT NULL DEFAULT 'INTERPOSITION' CHECK (provider_mode = 'INTERPOSITION'),
  provider_reference     text NOT NULL CHECK (length(btrim(provider_reference)) > 0),
  provider_status        text NOT NULL CHECK (provider_status IN (
    'SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED', 'VERIFIED'
  )),
  signature_request_id   uuid REFERENCES public.qtsp_signature_requests(id) ON DELETE RESTRICT,
  provider_request_id    text NOT NULL CHECK (length(btrim(provider_request_id)) > 0),
  provider_event_id      text NOT NULL CHECK (provider_event_id ~ '^[0-9a-f]{64}$'),
  evidence_bundle_id     uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  source_hash_sha256     text NOT NULL CHECK (source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  provider_hash_sha256   text NOT NULL CHECK (provider_hash_sha256 ~ '^[0-9a-f]{64}$'),
  signature_claim        boolean NOT NULL DEFAULT false CHECK (signature_claim IS FALSE),
  provider_payload       jsonb NOT NULL,
  occurred_at            timestamptz NOT NULL,
  verified_at            timestamptz NOT NULL,
  verified_by            uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (source_domain IN ('MINUTE', 'CERTIFICATION') AND legal_artifact_id IS NOT NULL)
    OR
    (source_domain = 'ANNUAL_ACCOUNTS' AND legal_artifact_id IS NULL)
  ),
  CHECK (
    (source_domain IN ('MINUTE', 'CERTIFICATION') AND signature_request_id IS NOT NULL)
    OR
    (source_domain = 'ANNUAL_ACCOUNTS' AND signature_request_id IS NULL)
  ),
  CHECK (
    (evidence_purpose IN ('CONSENT', 'CONSTANCIA', 'EXTERNAL_SIGNATURE_CUSTODY')
      AND subject_person_id IS NOT NULL AND subject_role IS NOT NULL)
    OR
    (evidence_purpose IN ('CUSTODY', 'EARCHIVE')
      AND subject_person_id IS NULL AND subject_role IS NULL)
  ),
  UNIQUE (tenant_id, provider, provider_reference, evidence_purpose, subject_person_id)
);

CREATE INDEX IF NOT EXISTS ix_secretaria_ead_interposition_source
  ON public.secretaria_ead_interposition_evidence(
    tenant_id, source_domain, source_id, evidence_purpose, verified_at DESC
  );
CREATE INDEX IF NOT EXISTS ix_secretaria_ead_interposition_artifact
  ON public.secretaria_ead_interposition_evidence(
    tenant_id, legal_artifact_id, subject_role
  ) WHERE legal_artifact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_secretaria_ead_interposition_bundle
  ON public.secretaria_ead_interposition_evidence(tenant_id, evidence_bundle_id);
CREATE INDEX IF NOT EXISTS ix_secretaria_ead_interposition_subject
  ON public.secretaria_ead_interposition_evidence(tenant_id, subject_person_id, evidence_purpose)
  WHERE subject_person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_ead_interposition_null_subject
  ON public.secretaria_ead_interposition_evidence(
    tenant_id, provider, provider_reference, evidence_purpose
  ) WHERE subject_person_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_ead_interposition_request_event_subject
  ON public.secretaria_ead_interposition_evidence(
    tenant_id, signature_request_id, provider_event_id, evidence_purpose,
    COALESCE(subject_person_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE signature_request_id IS NOT NULL;

ALTER TABLE public.secretaria_ead_interposition_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS secretaria_ead_interposition_read
  ON public.secretaria_ead_interposition_evidence;
CREATE POLICY secretaria_ead_interposition_read
  ON public.secretaria_ead_interposition_evidence FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

REVOKE ALL ON TABLE public.secretaria_ead_interposition_evidence
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_ead_interposition_evidence
  TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_secretaria_ead_interposition_append_only
  ON public.secretaria_ead_interposition_evidence;
CREATE TRIGGER trg_secretaria_ead_interposition_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_ead_interposition_evidence
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_append_only_guard();

DROP TRIGGER IF EXISTS trg_secretaria_ead_interposition_insert_guard
  ON public.secretaria_ead_interposition_evidence;
CREATE TRIGGER trg_secretaria_ead_interposition_insert_guard
  BEFORE INSERT ON public.secretaria_ead_interposition_evidence
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_insert_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_ead_interposition_evidence(
  p_source_domain text,
  p_source_id uuid,
  p_legal_artifact_id uuid,
  p_subject_person_id uuid,
  p_subject_role text,
  p_evidence_purpose text,
  p_evidence_bundle_id uuid,
  p_provider_reference text,
  p_provider_status text,
  p_occurred_at timestamptz,
  p_provider_payload jsonb,
  p_signature_request_id uuid DEFAULT NULL,
  p_provider_request_id text DEFAULT NULL,
  p_provider_event_id text DEFAULT NULL,
  p_verified_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_source_hash text;
  v_artifact public.secretaria_legal_artifacts%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_provider_hash text;
  v_existing public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_request public.qtsp_signature_requests%ROWTYPE;
  v_provider_reservation public.secretaria_ead_provider_action_reservations%ROWTYPE;
  v_evidence_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'EAD interposition evidence registration requires service_role'
      USING ERRCODE = '42501';
  END IF;

  p_source_domain := upper(COALESCE(btrim(p_source_domain), ''));
  p_subject_role := NULLIF(upper(COALESCE(btrim(p_subject_role), '')), '');
  p_evidence_purpose := upper(COALESCE(btrim(p_evidence_purpose), ''));
  p_provider_status := upper(COALESCE(btrim(p_provider_status), ''));
  p_provider_reference := btrim(COALESCE(p_provider_reference, ''));
  p_provider_request_id := btrim(COALESCE(p_provider_request_id, ''));
  p_provider_event_id := lower(btrim(COALESCE(p_provider_event_id, '')));

  IF p_source_domain NOT IN ('MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS')
     OR p_evidence_purpose NOT IN (
       'CUSTODY', 'CONSENT', 'CONSTANCIA', 'EXTERNAL_SIGNATURE_CUSTODY', 'EARCHIVE'
     )
     OR p_provider_status NOT IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED', 'VERIFIED')
     OR p_provider_reference = ''
     OR p_provider_request_id = ''
     OR p_provider_event_id !~ '^[0-9a-f]{64}$'
     OR p_verified_by IS NULL
     OR p_occurred_at IS NULL
     OR p_occurred_at > now() THEN
    RAISE EXCEPTION 'invalid EAD interposition coordinates, status or chronology';
  END IF;

  IF p_provider_payload IS NULL
     OR jsonb_typeof(p_provider_payload) <> 'object'
     OR NOT (p_provider_payload ? 'signature_claim')
     OR COALESCE((p_provider_payload ->> 'signature_claim')::boolean, true) IS NOT FALSE
     OR lower(COALESCE(p_provider_payload ->> 'sandbox', 'false')) = 'true'
     OR upper(COALESCE(p_provider_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_provider_payload ->> 'service', '')) <> 'EVIDENCE_MANAGER'
     OR upper(COALESCE(p_provider_payload ->> 'provider_mode', '')) <> 'INTERPOSITION'
     OR upper(COALESCE(p_provider_payload ->> 'provider_status', '')) <> p_provider_status
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(p_provider_payload) THEN
    RAISE EXCEPTION 'EAD interposition evidence must be non-sandbox, signature_claim=false and free of signature-level assertions';
  END IF;

  IF p_source_domain = 'MINUTE' THEN
    SELECT tenant_id, lower(content_hash)
      INTO v_tenant_id, v_source_hash
      FROM public.minutes
     WHERE id = p_source_id
       AND legal_gate_status IN ('MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED');
  ELSIF p_source_domain = 'CERTIFICATION' THEN
    SELECT tenant_id, lower(content_hash_sha256)
      INTO v_tenant_id, v_source_hash
      FROM public.certifications
     WHERE id = p_source_id
       AND content_hash_sha256 IS NOT NULL
       AND legal_gate_status IN ('DRAFT', 'ARTIFACT_FINAL', 'INTERPOSITION_VERIFIED', 'EMITTED');
  ELSE
    SELECT tenant_id, lower(manifest_hash_sha256)
      INTO v_tenant_id, v_source_hash
      FROM public.secretaria_annual_accounts_sets set_row
     WHERE id = p_source_id
       AND NOT EXISTS (
         SELECT 1 FROM public.secretaria_annual_accounts_sets successor
         WHERE successor.tenant_id = set_row.tenant_id
           AND successor.supersedes_set_id = set_row.id
       );
  END IF;
  IF v_tenant_id IS NULL OR v_source_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'EAD interposition source is missing, superseded or lacks a canonical hash';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.user_profiles profile
     WHERE profile.user_id = p_verified_by
       AND profile.tenant_id = v_tenant_id
  ) OR NOT EXISTS (
    SELECT 1
      FROM public.rbac_user_roles user_role
      JOIN public.rbac_roles role ON role.id = user_role.role_id
     WHERE user_role.user_id = p_verified_by
       AND user_role.tenant_id = v_tenant_id
       AND user_role.is_active IS TRUE
       AND (user_role.expires_at IS NULL OR user_role.expires_at > now())
       AND (
         role.role_code = 'ADMIN_TENANT'
         OR EXISTS (
           SELECT 1 FROM public.capability_matrix capability
           WHERE capability.role = role.role_code
             AND capability.action = 'CERTIFICATION'
             AND capability.enabled IS TRUE
         )
       )
  ) THEN
    RAISE EXCEPTION 'EAD evidence verifier is not a current tenant user with capability'
      USING ERRCODE = '42501';
  END IF;

  IF p_source_domain IN ('MINUTE', 'CERTIFICATION') THEN
    SELECT * INTO v_request
      FROM public.qtsp_signature_requests
     WHERE id = p_signature_request_id
       AND tenant_id = v_tenant_id
       AND source_domain = p_source_domain
       AND source_id = p_source_id
       AND content_hash_sha256 = v_source_hash
       AND sr_id = p_provider_request_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EAD evidence is not bound to the persisted canonical request';
    END IF;
  ELSIF p_signature_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'annual accounts external evidence does not use a QTSP signature request';
  END IF;

  IF p_source_domain IN ('MINUTE', 'CERTIFICATION') THEN
    SELECT * INTO v_artifact
      FROM public.secretaria_legal_artifacts
     WHERE id = p_legal_artifact_id
       AND tenant_id = v_tenant_id
       AND source_domain = p_source_domain
       AND source_id = p_source_id
       AND content_hash_sha256 = v_source_hash
       AND artifact_status = 'FINAL_IMMUTABLE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EAD interposition evidence is not bound to the immutable source artifact';
    END IF;
  ELSIF p_legal_artifact_id IS NOT NULL THEN
    RAISE EXCEPTION 'annual accounts signer evidence binds to the immutable set, not a minute/certification artifact';
  END IF;

  IF p_evidence_purpose = 'CONSENT'
     AND (p_source_domain <> 'MINUTE' OR p_subject_role <> 'PRESIDENTE') THEN
    RAISE EXCEPTION 'CONSENT is reserved for the attributed meeting president';
  ELSIF p_evidence_purpose = 'CONSTANCIA'
     AND NOT (
       (p_source_domain = 'MINUTE' AND p_subject_role = 'SECRETARIO')
       OR
       (p_source_domain = 'CERTIFICATION' AND p_subject_role IN ('CERTIFICANTE', 'VISTO_BUENO'))
     ) THEN
    RAISE EXCEPTION 'CONSTANCIA role/source combination is invalid';
  ELSIF p_evidence_purpose = 'EXTERNAL_SIGNATURE_CUSTODY'
     AND (p_source_domain <> 'ANNUAL_ACCOUNTS' OR p_subject_role <> 'ADMINISTRADOR') THEN
    RAISE EXCEPTION 'external signature custody is reserved for annual-accounts administrators';
  END IF;

  IF p_evidence_purpose IN ('CONSENT', 'CONSTANCIA') THEN
    IF p_provider_status NOT IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED')
       OR p_provider_payload #>> '{subject,provider_participant_status}'
            IS DISTINCT FROM p_provider_status
       OR NULLIF(
            p_provider_payload #>> '{subject,provider_participant_status_at}', ''
          )::timestamptz IS DISTINCT FROM p_occurred_at
       OR COALESCE(btrim(
            p_provider_payload #>> '{subject,provider_signatory_id}'
          ), '') = ''
       OR COALESCE(btrim(
            p_provider_payload #>> '{subject,provider_participant_id}'
          ), '') = '' THEN
      RAISE EXCEPTION 'individual consent/constancia requires terminal participant status, timestamp and identity';
    END IF;
  ELSIF p_provider_status NOT IN ('COMPLETED', 'VERIFIED') THEN
    RAISE EXCEPTION 'custody/e-archive evidence requires a terminal service status';
  END IF;

  SELECT * INTO v_bundle
    FROM public.evidence_bundles
   WHERE id = p_evidence_bundle_id
     AND tenant_id = v_tenant_id;
  v_provider_hash := lower(COALESCE(
    NULLIF(btrim(v_bundle.manifest #>> '{verification,provider_hash_sha256}'), ''),
    NULLIF(btrim(v_bundle.manifest #>> '{verification,ead_provider_hash_sha256}'), ''),
    NULLIF(btrim(v_bundle.manifest #>> '{binary,hash_sha256}'), '')
  ));
  IF NOT FOUND
     OR v_bundle.status <> 'VERIFIED'
     OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
     OR v_bundle.manifest IS NULL
     OR v_bundle.manifest_hash !~ '^[0-9a-f]{64}$'
     OR encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') <> v_bundle.manifest_hash
     OR upper(COALESCE(v_bundle.manifest #>> '{verification,provider}', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(v_bundle.manifest #>> '{verification,service}', '')) <> 'EVIDENCE_MANAGER'
     OR upper(COALESCE(v_bundle.manifest #>> '{verification,provider_status}', ''))
          NOT IN ('COMPLETED', 'VERIFIED')
     OR lower(COALESCE(v_bundle.manifest #>> '{verification,sandbox}', 'false')) = 'true'
     OR COALESCE((v_bundle.manifest #>> '{verification,signature_claim}')::boolean, true) IS NOT FALSE
     OR upper(COALESCE(v_bundle.manifest #>> '{source,domain}', '')) <> p_source_domain
     OR v_bundle.manifest #>> '{source,id}' IS DISTINCT FROM p_source_id::text
     OR lower(COALESCE(v_bundle.manifest #>> '{source,content_hash_sha256}', '')) <> v_source_hash
     OR v_provider_hash !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_provider_payload ->> 'provider_hash_sha256', '')) <> v_provider_hash THEN
    RAISE EXCEPTION 'VERIFIED EAD Evidence Manager custody with signature_claim=false is required';
  END IF;

  IF p_evidence_purpose = 'EXTERNAL_SIGNATURE_CUSTODY' THEN
    IF COALESCE(p_provider_payload ->> 'provider_action_reservation_id', '')
         !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR v_bundle.manifest #>> '{verification,provider_action_reservation_id}'
            IS DISTINCT FROM p_provider_payload ->> 'provider_action_reservation_id' THEN
      RAISE EXCEPTION 'external signature custody lacks a bundle-bound provider reservation';
    END IF;
    SELECT reservation.* INTO v_provider_reservation
      FROM public.secretaria_ead_provider_action_reservations reservation
     WHERE reservation.id = (p_provider_payload ->> 'provider_action_reservation_id')::uuid
       AND reservation.tenant_id = v_tenant_id
       AND reservation.source_domain = 'ANNUAL_ACCOUNTS'
       AND reservation.source_id = p_source_id
       AND reservation.action_kind = 'EXTERNAL_SIGNATURE_CUSTODY'
       AND reservation.subject_key = concat_ws(':',
         p_provider_payload #>> '{external_signature_review,expected_signer_id}',
         p_provider_payload #>> '{external_signature_review,review_event_id}'
       )
       AND reservation.source_hash_sha256 = v_source_hash
       AND reservation.payload_hash_sha256
            = lower(v_bundle.manifest #>> '{binary,hash_sha256}')
       AND reservation.reserved_by = p_verified_by
       AND reservation.reservation_context ->> 'expected_signer_id'
            = p_provider_payload #>> '{external_signature_review,expected_signer_id}'
       AND reservation.reservation_context ->> 'review_event_id'
            = p_provider_payload #>> '{external_signature_review,review_event_id}'
       AND reservation.reservation_context ->> 'signed_at'
            = p_provider_payload #>> '{external_signature_review,signed_at}'
       AND reservation.reservation_context ->> 'signature_fact_source'
            = p_provider_payload #>> '{external_signature_review,fact_source}'
       AND reservation.reserved_at <= p_occurred_at;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'external signature custody lacks the exact pre-provider reservation';
    END IF;
  END IF;

  -- Serializa NULL-subject y reintentos concurrentes antes del lookup/insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':' || p_provider_reference || ':'
      || p_evidence_purpose || ':' || COALESCE(p_subject_person_id::text, '<NULL>'),
    0
  ));

  SELECT * INTO v_existing
    FROM public.secretaria_ead_interposition_evidence
   WHERE tenant_id = v_tenant_id
     AND provider = 'EAD_TRUST'
     AND provider_reference = p_provider_reference
     AND evidence_purpose = p_evidence_purpose
     AND subject_person_id IS NOT DISTINCT FROM p_subject_person_id;
  IF FOUND THEN
    IF v_existing.source_domain IS DISTINCT FROM p_source_domain
       OR v_existing.source_id IS DISTINCT FROM p_source_id
       OR v_existing.legal_artifact_id IS DISTINCT FROM p_legal_artifact_id
       OR v_existing.subject_role IS DISTINCT FROM p_subject_role
       OR v_existing.evidence_bundle_id IS DISTINCT FROM p_evidence_bundle_id
       OR v_existing.source_hash_sha256 IS DISTINCT FROM v_source_hash
       OR v_existing.provider_hash_sha256 IS DISTINCT FROM v_provider_hash
       OR v_existing.provider_status IS DISTINCT FROM p_provider_status
       OR v_existing.signature_request_id IS DISTINCT FROM p_signature_request_id
       OR v_existing.provider_request_id IS DISTINCT FROM p_provider_request_id
       OR v_existing.provider_event_id IS DISTINCT FROM p_provider_event_id
       OR v_existing.occurred_at IS DISTINCT FROM p_occurred_at
       OR v_existing.verified_by IS DISTINCT FROM p_verified_by
       OR v_existing.provider_payload IS DISTINCT FROM p_provider_payload THEN
      RAISE EXCEPTION 'EAD provider reference is already bound to different interposition evidence';
    END IF;
    RETURN v_existing.id;
  END IF;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  INSERT INTO public.secretaria_ead_interposition_evidence (
    tenant_id, source_domain, source_id, legal_artifact_id,
    subject_person_id, subject_role, evidence_purpose,
    provider, provider_service, provider_mode, provider_reference,
    provider_status, signature_request_id, provider_request_id,
    provider_event_id, evidence_bundle_id, source_hash_sha256,
    provider_hash_sha256, signature_claim, provider_payload,
    occurred_at, verified_at, verified_by
  ) VALUES (
    v_tenant_id, p_source_domain, p_source_id, p_legal_artifact_id,
    p_subject_person_id, p_subject_role, p_evidence_purpose,
    'EAD_TRUST', 'EVIDENCE_MANAGER', 'INTERPOSITION', p_provider_reference,
    p_provider_status, p_signature_request_id, p_provider_request_id,
    p_provider_event_id, p_evidence_bundle_id, v_source_hash,
    v_provider_hash, false, p_provider_payload,
    p_occurred_at, now(), p_verified_by
  ) RETURNING id INTO v_evidence_id;

  RETURN v_evidence_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_ead_interposition_evidence(
  text, uuid, uuid, uuid, text, text, uuid, text, text, timestamptz, jsonb,
  uuid, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_ead_interposition_evidence(
  text, uuid, uuid, uuid, text, text, uuid, text, text, timestamptz, jsonb,
  uuid, text, text, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Artefacto final: bloqueado hasta disponer de renderer binario autoritativo
-- ---------------------------------------------------------------------------

ALTER TABLE public.secretaria_legal_artifacts
  ADD COLUMN IF NOT EXISTS evidence_mode text NOT NULL DEFAULT 'LEGACY_SIGNATURE_WORKFLOW';
ALTER TABLE public.secretaria_legal_artifacts
  ALTER COLUMN evidence_mode SET DEFAULT 'INTERPOSITION_CUSTODY';
ALTER TABLE public.secretaria_legal_artifacts
  DROP CONSTRAINT IF EXISTS secretaria_legal_artifacts_evidence_mode_check;
ALTER TABLE public.secretaria_legal_artifacts
  ADD CONSTRAINT secretaria_legal_artifacts_evidence_mode_check
  CHECK (evidence_mode IN ('LEGACY_SIGNATURE_WORKFLOW', 'INTERPOSITION_CUSTODY'));
ALTER TABLE public.secretaria_legal_artifacts
  ALTER COLUMN signature_packaging DROP NOT NULL;
ALTER TABLE public.secretaria_legal_artifacts
  DROP CONSTRAINT IF EXISTS secretaria_legal_artifacts_signature_packaging_check;
ALTER TABLE public.secretaria_legal_artifacts
  ADD CONSTRAINT secretaria_legal_artifacts_signature_packaging_check
  CHECK (
    (evidence_mode = 'LEGACY_SIGNATURE_WORKFLOW'
      AND signature_packaging IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION'))
    OR
    (evidence_mode = 'INTERPOSITION_CUSTODY' AND signature_packaging IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_final_interposition_artifact_head
  ON public.secretaria_legal_artifacts(
    tenant_id, source_domain, source_id, artifact_kind
  )
  WHERE artifact_status = 'FINAL_IMMUTABLE'
    AND evidence_mode = 'INTERPOSITION_CUSTODY';

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_custodied_legal_artifact(
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
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'custodied legal artifact registration requires service_role'
      USING ERRCODE = '42501';
  END IF;
  -- Defensa final incluso frente a bundles o reservas preexistentes: el
  -- prototipo todavía no cuenta con un renderer binario autoritativo en
  -- servidor. Esta RPC no puede elevar bytes del navegador a artefacto final.
  RAISE EXCEPTION 'AUTHORITATIVE_BINARY_REQUIRED: server-generated and semantically verified binary is required'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_custodied_legal_artifact(
  text, uuid, text, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;

-- Cerrar las rutas que podían elevar un resultado de firma del proveedor. Se
-- conservan para lectura histórica, pero ningún rol puede ejecutarlas.
REVOKE ALL ON FUNCTION public.fn_secretaria_reconcile_verified_ead_bundle(
  text, uuid, uuid, text, text, text, text, text, text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_secretaria_register_final_legal_artifact(
  text, uuid, text, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_secretaria_register_verified_qtsp_signature(
  uuid, uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Acta: consentimiento/constancia EAD, sin claim de firma del proveedor
-- ---------------------------------------------------------------------------

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS president_consent_evidence_id uuid
    REFERENCES public.secretaria_ead_interposition_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS secretary_constancia_evidence_id uuid
    REFERENCES public.secretaria_ead_interposition_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approval_evidence_mode text,
  ADD COLUMN IF NOT EXISTS approval_signature_claim boolean,
  ADD COLUMN IF NOT EXISTS approval_evidenced_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_canonical_status text;

ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_approval_evidence_mode_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_approval_evidence_mode_check
  CHECK (approval_evidence_mode IS NULL OR approval_evidence_mode = 'INTERPOSITION');
ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_approval_signature_claim_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_approval_signature_claim_check
  CHECK (approval_signature_claim IS NULL OR approval_signature_claim IS FALSE);
ALTER TABLE public.minutes DROP CONSTRAINT IF EXISTS minutes_approval_canonical_status_check;
ALTER TABLE public.minutes ADD CONSTRAINT minutes_approval_canonical_status_check
  CHECK (approval_canonical_status IS NULL OR approval_canonical_status = 'APPROVED_EVIDENCED');
CREATE INDEX IF NOT EXISTS ix_minutes_president_consent_evidence
  ON public.minutes(tenant_id, president_consent_evidence_id)
  WHERE president_consent_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_minutes_secretary_constancia_evidence
  ON public.minutes(tenant_id, secretary_constancia_evidence_id)
  WHERE secretary_constancia_evidence_id IS NOT NULL;

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
  v_president public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_secretary public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_current_manifest jsonb;
  v_current_manifest_hash text;
  v_evidenced_at timestamptz;
BEGIN
  SELECT * INTO v_minute FROM public.minutes WHERE id = p_minute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'authoritative approval: minute not found'; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'authoritative approval tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_minute.tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_minute.approval_evidence_mode = 'INTERPOSITION' THEN
    IF v_minute.final_legal_artifact_id = p_final_legal_artifact_id
       AND v_minute.president_consent_evidence_id = p_president_consent_verification_id
       AND v_minute.secretary_constancia_evidence_id = p_secretary_consent_verification_id
       AND v_minute.approval_signature_claim IS FALSE THEN
      RETURN jsonb_build_object(
        'minute_id', v_minute.id,
        'approval_evidenced_at', v_minute.approval_evidenced_at,
        'evidence_mode', 'INTERPOSITION',
        'signature_claim', false,
        'already_evidenced', true
      );
    END IF;
    RAISE EXCEPTION 'authoritative approval already uses different evidence';
  END IF;

  IF v_minute.legal_gate_status <> 'ARTIFACT_FINAL'
     OR v_minute.final_legal_artifact_id IS DISTINCT FROM p_final_legal_artifact_id
     OR v_minute.book_section_id IS NULL
     OR v_minute.book_destination_status <> 'RESOLVED' THEN
    RAISE EXCEPTION 'authoritative approval requires final immutable content and resolved book destination';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
   WHERE id = v_minute.meeting_id AND tenant_id = v_minute.tenant_id;
  IF NOT FOUND OR v_meeting.status <> 'CELEBRADA' OR v_meeting.scheduled_end IS NULL THEN
    RAISE EXCEPTION 'authoritative approval requires a celebrated meeting';
  END IF;
  IF p_approval_method NOT IN ('AL_FINAL_SESION', 'DENTRO_15_DIAS') THEN
    RAISE EXCEPTION 'notarial minutes require their own instrument gate';
  END IF;

  SELECT * INTO v_artifact FROM public.secretaria_legal_artifacts
   WHERE id = p_final_legal_artifact_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id
     AND artifact_kind = 'MINUTE_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE'
     AND evidence_mode = 'INTERPOSITION_CUSTODY'
     AND signature_packaging IS NULL;
  IF NOT FOUND OR v_artifact.content_hash_sha256 IS DISTINCT FROM v_minute.content_hash THEN
    RAISE EXCEPTION 'minute final artifact is not verified interposition custody';
  END IF;

  v_current_manifest := public.fn_secretaria_build_minute_legal_manifest(
    v_minute.meeting_id, v_minute.snapshot_id, v_minute.content_hash
  );
  v_current_manifest_hash := encode(digest(v_current_manifest::text, 'sha256'), 'hex');
  IF v_current_manifest_hash IS DISTINCT FROM v_minute.authoritative_manifest_hash
     OR v_current_manifest IS DISTINCT FROM v_minute.authoritative_manifest THEN
    RAISE EXCEPTION 'meeting facts drifted after minute manifest';
  END IF;

  SELECT * INTO v_president FROM public.secretaria_ead_interposition_evidence
   WHERE id = p_president_consent_verification_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id
     AND legal_artifact_id = v_artifact.id
     AND evidence_purpose = 'CONSENT'
     AND subject_role = 'PRESIDENTE'
     AND provider_mode = 'INTERPOSITION'
     AND provider_status IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED')
     AND signature_claim IS FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified president consent is missing'; END IF;

  SELECT * INTO v_secretary FROM public.secretaria_ead_interposition_evidence
   WHERE id = p_secretary_consent_verification_id
     AND tenant_id = v_minute.tenant_id
     AND source_domain = 'MINUTE'
     AND source_id = v_minute.id
     AND legal_artifact_id = v_artifact.id
     AND evidence_purpose = 'CONSTANCIA'
     AND subject_role = 'SECRETARIO'
     AND provider_mode = 'INTERPOSITION'
     AND provider_status IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED')
     AND signature_claim IS FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified secretary constancia is missing'; END IF;

  IF v_president.subject_person_id IS DISTINCT FROM v_meeting.president_id
     OR v_secretary.subject_person_id IS DISTINCT FROM v_meeting.secretary_id
     OR v_president.subject_person_id = v_secretary.subject_person_id
     OR v_president.provider_reference = v_secretary.provider_reference
     OR v_president.signature_request_id IS NULL
     OR v_president.signature_request_id IS DISTINCT FROM v_secretary.signature_request_id
     OR v_president.provider_request_id IS DISTINCT FROM v_secretary.provider_request_id
     OR v_president.provider_event_id IS DISTINCT FROM v_secretary.provider_event_id
     OR v_president.evidence_bundle_id IS DISTINCT FROM v_secretary.evidence_bundle_id
     OR v_president.evidence_bundle_id IS DISTINCT FROM v_artifact.evidence_bundle_id THEN
    RAISE EXCEPTION 'president consent and secretary constancia need correct, distinct attribution';
  END IF;
  IF abs(extract(epoch FROM (v_president.occurred_at - v_secretary.occurred_at))) > 300 THEN
    RAISE EXCEPTION 'president consent and secretary constancia must belong to the same approval event';
  END IF;
  v_evidenced_at := GREATEST(v_president.occurred_at, v_secretary.occurred_at);
  IF v_evidenced_at < v_meeting.scheduled_end
     OR p_approval_effective_at IS NULL
     OR abs(extract(epoch FROM (p_approval_effective_at - v_evidenced_at))) > 300
     OR (p_approval_method = 'AL_FINAL_SESION'
       AND v_evidenced_at > v_meeting.scheduled_end + interval '2 hours')
     OR (p_approval_method = 'DENTRO_15_DIAS'
       AND v_evidenced_at > v_meeting.scheduled_end + interval '15 days') THEN
    RAISE EXCEPTION 'approval evidence chronology is inconsistent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_minute.tenant_id
      AND ae.entity_id = v_minute.entity_id
      AND ae.body_id = v_minute.body_id
      AND ae.person_id = v_president.subject_person_id
      AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
      AND ae.estado = 'VIGENTE'
      AND ae.fecha_inicio <= v_president.occurred_at::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_president.occurred_at::date)
  ) OR NOT EXISTS (
    SELECT 1 FROM public.authority_evidence ae
    WHERE ae.tenant_id = v_minute.tenant_id
      AND ae.entity_id = v_minute.entity_id
      AND ae.body_id = v_minute.body_id
      AND ae.person_id = v_secretary.subject_person_id
      AND ae.cargo IN ('SECRETARIO', 'VICESECRETARIO')
      AND ae.estado = 'VIGENTE'
      AND ae.fecha_inicio <= v_secretary.occurred_at::date
      AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_secretary.occurred_at::date)
  ) THEN
    RAISE EXCEPTION 'approval evidence lacks current president/secretary authority';
  END IF;

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.minutes
     SET -- Legacy projections keep the book/certification pipeline compatible;
         -- they record attribution/time of approval, never a provider signature type.
         signed_at = v_evidenced_at,
         signed_by_president_id = v_president.subject_person_id,
         signed_by_secretary_id = v_secretary.subject_person_id,
         is_locked = true,
         approval_method = p_approval_method,
         approval_effective_at = v_evidenced_at,
         president_consent_verification_id = NULL,
         secretary_consent_verification_id = NULL,
         president_consent_evidence_id = v_president.id,
         secretary_constancia_evidence_id = v_secretary.id,
         approval_evidence_mode = 'INTERPOSITION',
         approval_signature_claim = false,
         approval_evidenced_at = v_evidenced_at,
         approval_canonical_status = 'APPROVED_EVIDENCED',
         legal_gate_status = 'APPROVED_SIGNED'
   WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'approval_evidenced_at', v_evidenced_at,
    'final_legal_artifact_id', v_artifact.id,
    'president_consent_evidence_id', v_president.id,
    'secretary_constancia_evidence_id', v_secretary.id,
    'evidence_mode', 'INTERPOSITION',
    'signature_claim', false,
    'canonical_gate_status', 'APPROVED_EVIDENCED',
    'already_evidenced', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_aprobar_acta_autoritativa(
  uuid, uuid, text, timestamptz, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aprobar_acta_autoritativa(
  uuid, uuid, text, timestamptz, uuid, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Certificación: constancias EAD separadas, sin firma electrónica atribuida
-- ---------------------------------------------------------------------------

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS certifier_constancia_evidence_id uuid
    REFERENCES public.secretaria_ead_interposition_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS visto_bueno_constancia_evidence_id uuid
    REFERENCES public.secretaria_ead_interposition_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS interposition_evidence_mode text,
  ADD COLUMN IF NOT EXISTS interposition_signature_claim boolean,
  ADD COLUMN IF NOT EXISTS constancia_evidenced_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_binding_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS interposition_canonical_status text;

ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_interposition_evidence_mode_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_interposition_evidence_mode_check
  CHECK (interposition_evidence_mode IS NULL OR interposition_evidence_mode = 'INTERPOSITION');
ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_interposition_signature_claim_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_interposition_signature_claim_check
  CHECK (interposition_signature_claim IS NULL OR interposition_signature_claim IS FALSE);
ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_evidence_binding_hash_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_evidence_binding_hash_check
  CHECK (evidence_binding_hash_sha256 IS NULL OR evidence_binding_hash_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_interposition_canonical_status_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_interposition_canonical_status_check
  CHECK (interposition_canonical_status IS NULL OR interposition_canonical_status = 'CONSTANCIA_VERIFIED');
CREATE INDEX IF NOT EXISTS ix_certifications_certifier_constancia_evidence
  ON public.certifications(tenant_id, certifier_constancia_evidence_id)
  WHERE certifier_constancia_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_certifications_visto_bueno_constancia_evidence
  ON public.certifications(tenant_id, visto_bueno_constancia_evidence_id)
  WHERE visto_bueno_constancia_evidence_id IS NOT NULL;

-- Los campos de tipo de firma se conservan solo para filas históricas. Los
-- writers nuevos los dejan NULL y usan interposition_evidence_mode.
ALTER TABLE public.certifications
  ALTER COLUMN required_ead_signature_type DROP DEFAULT;
ALTER TABLE public.certifications
  ALTER COLUMN required_ead_signature_type DROP NOT NULL;
ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_required_ead_signature_type_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_required_ead_signature_type_check
  CHECK (required_ead_signature_type IS NULL OR required_ead_signature_type = 'INTERPOSITION')
  NOT VALID;
ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_legal_gate_status_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_legal_gate_status_check
  CHECK (legal_gate_status IN (
    'DRAFT', 'ARTIFACT_FINAL', 'SIGNATURE_VERIFIED', 'INTERPOSITION_VERIFIED',
    'EMITTED', 'LEGACY_REVIEW', 'DEMO_SIMULATION'
  ));

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
  v_certifier public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_visto_bueno public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_authority public.authority_evidence%ROWTYPE;
  v_content_hash text;
  v_binding_hash text;
  v_evidenced_at timestamptz;
BEGIN
  SELECT * INTO v_cert FROM public.certifications
   WHERE id = p_certification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'authoritative certification: certification not found'; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_cert.tenant_id THEN
      RAISE EXCEPTION 'authoritative certification tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');
  END IF;

  IF v_cert.interposition_evidence_mode = 'INTERPOSITION' THEN
    IF v_cert.final_legal_artifact_id = p_final_legal_artifact_id
       AND v_cert.certifier_constancia_evidence_id = p_certifier_qtsp_verification_id
       AND v_cert.visto_bueno_constancia_evidence_id
             IS NOT DISTINCT FROM p_visto_bueno_qtsp_verification_id
       AND v_cert.interposition_signature_claim IS FALSE THEN
      RETURN jsonb_build_object(
        'certification_id', v_cert.id,
        'canonical_gate_status', 'CONSTANCIA_VERIFIED',
        'evidence_mode', 'INTERPOSITION',
        'signature_claim', false,
        'already_evidenced', true
      );
    END IF;
    RAISE EXCEPTION 'certification already uses different interposition evidence';
  END IF;

  IF v_cert.signature_status <> 'PENDING'
     OR v_cert.legal_gate_status <> 'ARTIFACT_FINAL'
     OR v_cert.final_legal_artifact_id IS DISTINCT FROM p_final_legal_artifact_id
     OR COALESCE(btrim(v_cert.content), '') = '' THEN
    RAISE EXCEPTION 'certification requires a final immutable content artifact';
  END IF;

  SELECT * INTO v_minute FROM public.minutes
   WHERE id = v_cert.minute_id
     AND tenant_id = v_cert.tenant_id
     AND legal_gate_status = 'APPROVED_SIGNED'
     AND approval_evidence_mode = 'INTERPOSITION'
     AND approval_signature_claim IS FALSE
     AND is_locked IS TRUE
     AND book_destination_status = 'POSTED'
     AND book_entry_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification source minute lacks verified approval evidence or book posting';
  END IF;

  SELECT * INTO v_artifact FROM public.secretaria_legal_artifacts
   WHERE id = p_final_legal_artifact_id
     AND tenant_id = v_cert.tenant_id
     AND source_domain = 'CERTIFICATION'
     AND source_id = v_cert.id
     AND artifact_kind = 'CERTIFICATION_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE'
     AND evidence_mode = 'INTERPOSITION_CUSTODY'
     AND signature_packaging IS NULL;
  v_content_hash := encode(digest(v_cert.content, 'sha256'), 'hex');
  IF NOT FOUND
     OR v_artifact.content_hash_sha256 <> v_content_hash
     OR v_cert.content_hash_sha256 <> v_content_hash
     OR v_artifact.evidence_bundle_id IS DISTINCT FROM v_cert.evidence_id THEN
    RAISE EXCEPTION 'certification artifact/content/custody binding is invalid';
  END IF;

  SELECT * INTO v_authority FROM public.authority_evidence
   WHERE id = v_cert.authority_evidence_id
     AND tenant_id = v_cert.tenant_id
     AND estado = 'VIGENTE'
     AND COALESCE(btrim(inscripcion_rm_referencia), '') <> ''
     AND inscripcion_rm_fecha IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'certifier authority evidence is missing'; END IF;

  SELECT * INTO v_certifier FROM public.secretaria_ead_interposition_evidence
   WHERE id = p_certifier_qtsp_verification_id
     AND tenant_id = v_cert.tenant_id
     AND source_domain = 'CERTIFICATION'
     AND source_id = v_cert.id
     AND legal_artifact_id = v_artifact.id
     AND subject_person_id = v_authority.person_id
     AND subject_role = 'CERTIFICANTE'
     AND evidence_purpose = 'CONSTANCIA'
     AND provider_mode = 'INTERPOSITION'
     AND provider_status IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED')
     AND signature_claim IS FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified certifier constancia is missing'; END IF;

  IF v_authority.fecha_inicio > v_certifier.occurred_at::date
     OR (v_authority.fecha_fin IS NOT NULL
       AND v_authority.fecha_fin < v_certifier.occurred_at::date)
     OR v_authority.inscripcion_rm_fecha > v_certifier.occurred_at::date THEN
    RAISE EXCEPTION 'certifier authority was not effective at the evidenced event';
  END IF;

  IF v_cert.certificante_role IN ('SECRETARIO', 'VICESECRETARIO') THEN
    SELECT * INTO v_visto_bueno FROM public.secretaria_ead_interposition_evidence
     WHERE id = p_visto_bueno_qtsp_verification_id
       AND tenant_id = v_cert.tenant_id
       AND source_domain = 'CERTIFICATION'
       AND source_id = v_cert.id
       AND legal_artifact_id = v_artifact.id
       AND subject_person_id = v_cert.visto_bueno_persona_id
       AND subject_role = 'VISTO_BUENO'
       AND evidence_purpose = 'CONSTANCIA'
       AND provider_mode = 'INTERPOSITION'
       AND provider_status IN ('SIGNED', 'COMPLETED', 'ACCEPTED', 'CONFIRMED')
       AND signature_claim IS FALSE;
    IF NOT FOUND THEN RAISE EXCEPTION 'verified visto bueno constancia is missing'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.authority_evidence ae
      WHERE ae.tenant_id = v_cert.tenant_id
        AND ae.entity_id = v_minute.entity_id
        AND ae.body_id = v_minute.body_id
        AND ae.person_id = v_cert.visto_bueno_persona_id
        AND ae.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
        AND ae.estado = 'VIGENTE'
        AND ae.fecha_inicio <= v_visto_bueno.occurred_at::date
        AND (ae.fecha_fin IS NULL OR ae.fecha_fin >= v_visto_bueno.occurred_at::date)
        AND COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''
        AND ae.inscripcion_rm_fecha IS NOT NULL
        AND ae.inscripcion_rm_fecha <= v_visto_bueno.occurred_at::date
    ) THEN
      RAISE EXCEPTION 'visto bueno authority was not effective at the evidenced event';
    END IF;
    IF v_certifier.subject_person_id = v_visto_bueno.subject_person_id
       OR v_certifier.provider_reference = v_visto_bueno.provider_reference
       OR v_certifier.signature_request_id IS NULL
       OR v_certifier.signature_request_id IS DISTINCT FROM v_visto_bueno.signature_request_id
       OR v_certifier.provider_request_id IS DISTINCT FROM v_visto_bueno.provider_request_id
       OR v_certifier.provider_event_id IS DISTINCT FROM v_visto_bueno.provider_event_id
       OR v_certifier.evidence_bundle_id IS DISTINCT FROM v_visto_bueno.evidence_bundle_id THEN
      RAISE EXCEPTION 'certifier and visto bueno require distinct persons and evidence';
    END IF;
  ELSIF p_visto_bueno_qtsp_verification_id IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected visto bueno constancia';
  END IF;

  v_evidenced_at := GREATEST(
    v_certifier.occurred_at,
    COALESCE(v_visto_bueno.occurred_at, v_certifier.occurred_at)
  );
  IF v_certifier.signature_request_id IS NULL
     OR v_certifier.evidence_bundle_id IS DISTINCT FROM v_artifact.evidence_bundle_id
     OR (v_visto_bueno.id IS NOT NULL
       AND v_visto_bueno.evidence_bundle_id IS DISTINCT FROM v_artifact.evidence_bundle_id) THEN
    RAISE EXCEPTION 'certification constancias must share the final artifact request, event and bundle';
  END IF;
  IF v_evidenced_at < v_minute.approval_evidenced_at OR v_evidenced_at > now() THEN
    RAISE EXCEPTION 'certification constancia chronology is invalid';
  END IF;
  v_binding_hash := encode(digest(
    v_cert.gate_hash || v_content_hash || v_artifact.binary_hash_sha512
    || v_certifier.id::text || COALESCE(v_visto_bueno.id::text, ''),
    'sha256'
  ), 'hex');

  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.certifications
     SET hash_certificacion = v_binding_hash,
         evidence_binding_hash_sha256 = v_binding_hash,
         signature_status = 'EVIDENCED',
         certifier_qtsp_verification_id = NULL,
         visto_bueno_qtsp_verification_id = NULL,
         certifier_constancia_evidence_id = v_certifier.id,
         visto_bueno_constancia_evidence_id = v_visto_bueno.id,
         visto_bueno_fecha = CASE WHEN v_visto_bueno.id IS NULL THEN NULL ELSE v_evidenced_at END,
         verified_ead_signature_type = NULL,
         interposition_evidence_mode = 'INTERPOSITION',
         interposition_signature_claim = false,
         constancia_evidenced_at = v_evidenced_at,
         interposition_canonical_status = 'CONSTANCIA_VERIFIED',
         legal_gate_status = 'INTERPOSITION_VERIFIED'
   WHERE id = p_certification_id;

  RETURN jsonb_build_object(
    'certification_id', p_certification_id,
    'canonical_gate_status', 'CONSTANCIA_VERIFIED',
    'evidence_mode', 'INTERPOSITION',
    'signature_claim', false,
    'certifier_constancia_evidence_id', v_certifier.id,
    'visto_bueno_constancia_evidence_id', v_visto_bueno.id,
    'evidence_binding_hash_sha256', v_binding_hash,
    'already_evidenced', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_firmar_certificacion_autoritativa(
  uuid, uuid, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_firmar_certificacion_autoritativa(
  uuid, uuid, uuid, uuid
) TO authenticated, service_role;

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
  v_constancia public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_agreement_ids uuid[];
  v_agreement_manifest jsonb;
  v_agreement_manifest_hash text;
  v_bundle_uri text;
  v_updated integer;
BEGIN
  SELECT * INTO v_cert FROM public.certifications
   WHERE id = p_certification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'certification emission: certification not found'; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_cert.tenant_id THEN
      RAISE EXCEPTION 'certification emission tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_capability(v_cert.tenant_id, 'CERTIFICATION');
  END IF;
  IF v_cert.legal_gate_status = 'EMITTED' AND v_cert.emitted_at IS NOT NULL THEN
    SELECT manifest_hash INTO v_agreement_manifest_hash FROM public.evidence_bundles
     WHERE id = v_cert.evidence_id AND tenant_id = v_cert.tenant_id;
    IF v_agreement_manifest_hash IS NULL THEN
      RAISE EXCEPTION 'emitted certification lost its evidence bundle';
    END IF;
    RETURN 'evidence_bundle:' || v_cert.evidence_id::text || '@' || v_agreement_manifest_hash;
  END IF;
  IF v_cert.signature_status <> 'EVIDENCED'
     OR v_cert.legal_gate_status <> 'INTERPOSITION_VERIFIED'
     OR v_cert.interposition_evidence_mode <> 'INTERPOSITION'
     OR v_cert.interposition_signature_claim IS NOT FALSE
     OR v_cert.certifier_constancia_evidence_id IS NULL
     OR v_cert.final_legal_artifact_id IS NULL
     OR v_cert.evidence_binding_hash_sha256 IS NULL THEN
    RAISE EXCEPTION 'certification emission requires verified interposition constancias with signature_claim=false';
  END IF;

  SELECT * INTO v_minute FROM public.minutes
   WHERE id = v_cert.minute_id
     AND tenant_id = v_cert.tenant_id
     AND legal_gate_status = 'APPROVED_SIGNED'
     AND approval_evidence_mode = 'INTERPOSITION'
     AND approval_signature_claim IS FALSE
     AND is_locked IS TRUE
     AND book_destination_status = 'POSTED'
     AND book_entry_id IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'source minute lacks verified approval evidence/book posting'; END IF;

  SELECT * INTO v_artifact FROM public.secretaria_legal_artifacts
   WHERE id = v_cert.final_legal_artifact_id
     AND tenant_id = v_cert.tenant_id
     AND source_domain = 'CERTIFICATION'
     AND source_id = v_cert.id
     AND artifact_kind = 'CERTIFICATION_FINAL'
     AND artifact_status = 'FINAL_IMMUTABLE'
     AND evidence_mode = 'INTERPOSITION_CUSTODY'
     AND signature_packaging IS NULL;
  IF NOT FOUND OR v_artifact.content_hash_sha256 <> encode(digest(v_cert.content, 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'certification emission final artifact mismatch';
  END IF;
  SELECT * INTO v_constancia FROM public.secretaria_ead_interposition_evidence
   WHERE id = v_cert.certifier_constancia_evidence_id
     AND tenant_id = v_cert.tenant_id
     AND legal_artifact_id = v_artifact.id
     AND evidence_purpose = 'CONSTANCIA'
     AND subject_role = 'CERTIFICANTE'
     AND signature_claim IS FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'certifier constancia evidence is missing'; END IF;
  SELECT * INTO v_bundle FROM public.evidence_bundles
   WHERE id = v_artifact.evidence_bundle_id AND tenant_id = v_cert.tenant_id;
  IF NOT FOUND
     OR v_bundle.status <> 'VERIFIED'
     OR v_bundle.manifest_hash !~ '^[0-9a-f]{64}$'
     OR encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') <> v_bundle.manifest_hash
     OR v_bundle.manifest #>> '{binary,artifact_role}' <> 'CUSTODIED_BINARY'
     OR v_bundle.manifest #>> '{verification,provider}' <> 'EAD_TRUST'
     OR v_bundle.manifest #>> '{verification,service}' <> 'EVIDENCE_MANAGER'
     OR COALESCE((v_bundle.manifest #>> '{verification,signature_claim}')::boolean, true) IS NOT FALSE
     OR lower(COALESCE(v_bundle.manifest #>> '{verification,sandbox}', 'false')) = 'true'
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(v_bundle.manifest) THEN
    RAISE EXCEPTION 'certification emission requires verified EAD e-archive without signature claim';
  END IF;

  SELECT array_agg(ref::uuid ORDER BY ref::uuid) INTO v_agreement_ids
    FROM unnest(v_cert.agreements_certified) ref;
  v_agreement_manifest := public.fn_secretaria_certified_agreements_manifest(
    v_cert.minute_id, v_agreement_ids
  );
  v_agreement_manifest_hash := encode(digest(v_agreement_manifest::text, 'sha256'), 'hex');
  IF v_agreement_manifest_hash IS DISTINCT FROM v_cert.agreements_manifest_hash THEN
    RAISE EXCEPTION 'certification agreement manifest drifted';
  END IF;

  v_bundle_uri := 'evidence_bundle:' || v_bundle.id::text || '@' || v_bundle.manifest_hash;
  PERFORM set_config('app.secretaria_authoritative_rpc', '1', true);
  UPDATE public.agreements a SET status = 'CERTIFIED'
   WHERE a.id = ANY(v_agreement_ids)
     AND a.tenant_id = v_cert.tenant_id
     AND a.parent_meeting_id = v_minute.meeting_id
     AND a.status = 'ADOPTED';
  SELECT count(*) INTO v_updated FROM public.agreements a
   WHERE a.id = ANY(v_agreement_ids)
     AND a.tenant_id = v_cert.tenant_id
     AND a.parent_meeting_id = v_minute.meeting_id
     AND a.status IN ('CERTIFIED', 'INSTRUMENTED', 'FILED', 'REGISTERED', 'PUBLISHED');
  IF v_updated <> cardinality(v_agreement_ids) THEN
    RAISE EXCEPTION 'certified agreements lost their adoption lineage';
  END IF;
  UPDATE public.certifications
     SET legal_gate_status = 'EMITTED', emitted_at = now()
   WHERE id = p_certification_id;

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_cert.tenant_id,
    'CERT_EMITIDA_INTERPOSICION',
    'certifications',
    v_cert.id,
    jsonb_build_object(
      'evidence_mode', 'INTERPOSITION',
      'signature_claim', false,
      'artifact_id', v_artifact.id,
      'evidence_bundle_id', v_bundle.id,
      'certifier_constancia_evidence_id', v_constancia.id,
      'agreement_ids', v_agreement_ids,
      'uri', v_bundle_uri,
      'emitted_at', now()
    )
  );
  RETURN v_bundle_uri;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_emitir_certificacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_emitir_certificacion(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Cuentas: firma de todos (o causa) + custodia EAD, sin equipararlas
-- ---------------------------------------------------------------------------

ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  ADD COLUMN IF NOT EXISTS external_signature_evidence_id uuid
    REFERENCES public.secretaria_ead_interposition_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS signature_fact_source text,
  ADD COLUMN IF NOT EXISTS provider_signature_claim boolean NOT NULL DEFAULT false;

ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  DROP CONSTRAINT IF EXISTS annual_accounts_outcome_signature_claim_check;
ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  ADD CONSTRAINT annual_accounts_outcome_signature_claim_check
  CHECK (provider_signature_claim IS FALSE);
ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  DROP CONSTRAINT IF EXISTS annual_accounts_outcome_fact_source_check;
ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  ADD CONSTRAINT annual_accounts_outcome_fact_source_check
  CHECK (signature_fact_source IS NULL OR signature_fact_source IN (
    'REVIEWED_SIGNED_DOCUMENT', 'REVIEWED_WET_INK_SCAN', 'REVIEWED_EXTERNAL_SIGNATURE_REPORT'
  ));

-- Reemplaza únicamente los CHECK que contienen outcome_type. No altera claves,
-- unicidad ni la cadena de supersession WORM.
DO $do$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.secretaria_annual_accounts_signer_outcomes'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%outcome_type%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.secretaria_annual_accounts_signer_outcomes DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END;
$do$;

ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  ADD CONSTRAINT annual_accounts_outcome_type_v2_check
  CHECK (outcome_type IN (
    'SIGNED_EAD', -- legacy only; never accepted by the new execution gate
    'EXTERNAL_SIGNATURE_EVIDENCE',
    'MISSING_SIGNATURE_CAUSE'
  ));
ALTER TABLE public.secretaria_annual_accounts_signer_outcomes
  ADD CONSTRAINT annual_accounts_outcome_shape_v2_check
  CHECK (
    (
      outcome_type = 'SIGNED_EAD'
      AND signature_request_id IS NOT NULL
      AND provider_signature_type IS NOT NULL
      AND provider_reference IS NOT NULL
      AND provider_evidence_bundle_id IS NOT NULL
      AND signed_output_hash_sha256 IS NOT NULL
      AND signed_output_hash_sha512 IS NOT NULL
      AND signed_at IS NOT NULL
      AND external_signature_evidence_id IS NULL
      AND signature_fact_source IS NULL
      AND missing_signature_cause_code IS NULL
      AND missing_signature_cause_text IS NULL
    ) OR (
      outcome_type = 'EXTERNAL_SIGNATURE_EVIDENCE'
      AND signature_request_id IS NULL
      AND provider_signature_type IS NULL
      AND provider_reference IS NULL
      AND provider_evidence_bundle_id IS NULL
      AND signed_output_hash_sha256 IS NULL
      AND signed_output_hash_sha512 IS NULL
      AND signed_at IS NOT NULL
      AND external_signature_evidence_id IS NOT NULL
      AND signature_fact_source IS NOT NULL
      AND missing_signature_cause_code IS NULL
      AND missing_signature_cause_text IS NULL
      AND provider_signature_claim IS FALSE
    ) OR (
      outcome_type = 'MISSING_SIGNATURE_CAUSE'
      AND signature_request_id IS NULL
      AND provider_signature_type IS NULL
      AND provider_reference IS NULL
      AND provider_evidence_bundle_id IS NULL
      AND signed_output_hash_sha256 IS NULL
      AND signed_output_hash_sha512 IS NULL
      AND signed_at IS NULL
      AND external_signature_evidence_id IS NULL
      AND signature_fact_source IS NULL
      AND missing_signature_cause_code IS NOT NULL
      AND length(btrim(missing_signature_cause_text)) >= 10
      AND provider_signature_claim IS FALSE
    )
  );
CREATE INDEX IF NOT EXISTS ix_annual_accounts_external_signature_evidence
  ON public.secretaria_annual_accounts_signer_outcomes(
    tenant_id, external_signature_evidence_id
  ) WHERE external_signature_evidence_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_annual_accounts_outcome_initial_head
  ON public.secretaria_annual_accounts_signer_outcomes(tenant_id, expected_signer_id)
  WHERE supersedes_outcome_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_annual_accounts_outcome_single_successor
  ON public.secretaria_annual_accounts_signer_outcomes(tenant_id, supersedes_outcome_id)
  WHERE supersedes_outcome_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_signature_review_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  annual_accounts_set_id uuid NOT NULL REFERENCES public.secretaria_annual_accounts_sets(id) ON DELETE RESTRICT,
  expected_signer_id    uuid NOT NULL REFERENCES public.secretaria_annual_accounts_expected_signers(id) ON DELETE RESTRICT,
  document_hash_sha256  text NOT NULL CHECK (document_hash_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at             timestamptz NOT NULL,
  signature_fact_source text NOT NULL CHECK (signature_fact_source IN (
    'REVIEWED_SIGNED_DOCUMENT', 'REVIEWED_WET_INK_SCAN', 'REVIEWED_EXTERNAL_SIGNATURE_REPORT'
  )),
  review_note           text NOT NULL CHECK (length(btrim(review_note)) >= 20),
  review_status         text NOT NULL CHECK (review_status = 'VERIFIED'),
  reviewer_user_id      uuid NOT NULL,
  reviewer_person_id    uuid NOT NULL REFERENCES public.persons(id) ON DELETE RESTRICT,
  reviewed_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (
    tenant_id, expected_signer_id, document_hash_sha256, signed_at,
    signature_fact_source
  )
);

ALTER TABLE public.secretaria_annual_accounts_signature_review_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS annual_accounts_signature_review_read
  ON public.secretaria_annual_accounts_signature_review_events;
CREATE POLICY annual_accounts_signature_review_read
  ON public.secretaria_annual_accounts_signature_review_events FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );
REVOKE ALL ON TABLE public.secretaria_annual_accounts_signature_review_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_annual_accounts_signature_review_events
  TO authenticated, service_role;
DROP TRIGGER IF EXISTS trg_annual_accounts_signature_review_append_only
  ON public.secretaria_annual_accounts_signature_review_events;
CREATE TRIGGER trg_annual_accounts_signature_review_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_annual_accounts_signature_review_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_annual_accounts_append_only_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_review_annual_accounts_external_signature(
  p_expected_signer_id uuid,
  p_document_hash_sha256 text,
  p_signed_at timestamptz,
  p_signature_fact_source text,
  p_review_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_expected record;
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_meeting public.meetings%ROWTYPE;
  v_reviewer record;
  v_event public.secretaria_annual_accounts_signature_review_events%ROWTYPE;
  v_reviewed_at timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'external signature review requires an authenticated tenant user'
      USING ERRCODE = '42501';
  END IF;
  p_document_hash_sha256 := lower(COALESCE(btrim(p_document_hash_sha256), ''));
  p_signature_fact_source := upper(COALESCE(btrim(p_signature_fact_source), ''));
  IF p_document_hash_sha256 !~ '^[0-9a-f]{64}$'
     OR p_signed_at IS NULL OR p_signed_at > v_reviewed_at
     OR p_signature_fact_source NOT IN (
       'REVIEWED_SIGNED_DOCUMENT', 'REVIEWED_WET_INK_SCAN',
       'REVIEWED_EXTERNAL_SIGNATURE_REPORT'
     )
     OR length(btrim(COALESCE(p_review_note, ''))) < 20 THEN
    RAISE EXCEPTION 'external signature review requires exact hash, time, source and substantive note';
  END IF;

  SELECT expected.*, roster.annual_accounts_set_id, roster.resolution_id,
         roster.agreement_id, roster.frozen_at
    INTO v_expected
    FROM public.secretaria_annual_accounts_expected_signers expected
    JOIN public.secretaria_annual_accounts_signer_rosters roster
      ON roster.id = expected.signer_roster_id
     AND roster.tenant_id = expected.tenant_id
   WHERE expected.id = p_expected_signer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'annual accounts expected signer not found'; END IF;

  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.id = v_expected.annual_accounts_set_id
     AND set_row.tenant_id = v_expected.tenant_id
     AND set_row.approval_status = 'APPROVED'
     AND set_row.immutability_status = 'IMMUTABLE'
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     );
  SELECT * INTO v_meeting FROM public.meetings
   WHERE id = v_set.meeting_id AND tenant_id = v_set.tenant_id;
  IF v_set.id IS NULL OR v_meeting.id IS NULL
     OR v_meeting.status <> 'CELEBRADA'
     OR v_meeting.scheduled_end IS NULL
     OR v_meeting.scheduled_end > v_reviewed_at
     OR p_signed_at < v_meeting.scheduled_end
     OR v_expected.frozen_at < v_meeting.scheduled_end
     OR NOT EXISTS (
       SELECT 1
       FROM public.meeting_resolutions resolution
       JOIN public.agreements agreement
         ON agreement.id = resolution.agreement_id
        AND agreement.tenant_id = resolution.tenant_id
       WHERE resolution.id = v_expected.resolution_id
         AND resolution.agreement_id = v_expected.agreement_id
         AND resolution.meeting_id = v_set.meeting_id
         AND resolution.tenant_id = v_set.tenant_id
         AND resolution.kind_resolution = 'DECISION'
         AND resolution.status = 'ADOPTED'
     ) THEN
    RAISE EXCEPTION 'external signature review requires a current formulated accounts set after the celebrated meeting';
  END IF;

  SELECT profile.user_id, profile.person_id INTO v_reviewer
    FROM public.user_profiles profile
   WHERE profile.user_id = auth.uid()
     AND profile.tenant_id = v_set.tenant_id
     AND profile.person_id IS NOT NULL;
  IF NOT FOUND OR v_reviewer.person_id = v_expected.person_id
     OR public.fn_assert_current_tenant_id() <> v_set.tenant_id
     OR NOT EXISTS (
       SELECT 1
       FROM public.rbac_user_roles user_role
       JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = auth.uid()
         AND user_role.tenant_id = v_set.tenant_id
         AND user_role.is_active IS TRUE
         AND (user_role.expires_at IS NULL OR user_role.expires_at > v_reviewed_at)
         AND (
           role.role_code = 'ADMIN_TENANT'
           OR EXISTS (
             SELECT 1 FROM public.capability_matrix capability
             WHERE capability.role = role.role_code
               AND capability.action = 'CERTIFICATION'
               AND capability.enabled IS TRUE
           )
         )
     ) THEN
    RAISE EXCEPTION 'reviewer must be a distinct current tenant person with certification capability'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event
    FROM public.secretaria_annual_accounts_signature_review_events event
   WHERE event.tenant_id = v_set.tenant_id
     AND event.expected_signer_id = p_expected_signer_id
     AND event.document_hash_sha256 = p_document_hash_sha256
     AND event.signed_at = p_signed_at
     AND event.signature_fact_source = p_signature_fact_source;
  IF FOUND THEN
    IF v_event.reviewer_user_id = auth.uid()
       AND v_event.review_note = btrim(p_review_note) THEN
      RETURN jsonb_build_object(
        'review_event_id', v_event.id,
        'review_status', v_event.review_status,
        'reviewed_at', v_event.reviewed_at,
        'reused', true
      );
    END IF;
    RAISE EXCEPTION 'external signature fact already has a different immutable review';
  END IF;

  INSERT INTO public.secretaria_annual_accounts_signature_review_events (
    tenant_id, annual_accounts_set_id, expected_signer_id,
    document_hash_sha256, signed_at, signature_fact_source, review_note,
    review_status, reviewer_user_id, reviewer_person_id, reviewed_at
  ) VALUES (
    v_set.tenant_id, v_set.id, p_expected_signer_id,
    p_document_hash_sha256, p_signed_at, p_signature_fact_source,
    btrim(p_review_note), 'VERIFIED', auth.uid(), v_reviewer.person_id, v_reviewed_at
  ) RETURNING * INTO v_event;
  RETURN jsonb_build_object(
    'review_event_id', v_event.id,
    'review_status', v_event.review_status,
    'reviewed_at', v_event.reviewed_at,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_review_annual_accounts_external_signature(
  uuid, text, timestamptz, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_review_annual_accounts_external_signature(
  uuid, text, timestamptz, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_secretaria_record_annual_accounts_external_signature(
  p_expected_signer_id uuid,
  p_interposition_evidence_id uuid,
  p_signed_at timestamptz,
  p_signature_fact_source text,
  p_review_event_id uuid,
  p_finalizer_user_id uuid,
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
  v_meeting public.meetings%ROWTYPE;
  v_evidence public.secretaria_ead_interposition_evidence%ROWTYPE;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_review public.secretaria_annual_accounts_signature_review_events%ROWTYPE;
  v_head public.secretaria_annual_accounts_signer_outcomes%ROWTYPE;
  v_outcome_id uuid := gen_random_uuid();
  v_manifest jsonb;
  v_manifest_hash text;
  v_recorded_at timestamptz := clock_timestamp();
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'external signature evidence registration requires service_role'
      USING ERRCODE = '42501';
  END IF;
  p_signature_fact_source := upper(COALESCE(btrim(p_signature_fact_source), ''));
  IF p_signature_fact_source NOT IN (
    'REVIEWED_SIGNED_DOCUMENT', 'REVIEWED_WET_INK_SCAN', 'REVIEWED_EXTERNAL_SIGNATURE_REPORT'
  ) OR p_signed_at IS NULL OR p_signed_at > now() THEN
    RAISE EXCEPTION 'annual accounts external signature fact or time is invalid';
  END IF;

  SELECT expected.*, roster.annual_accounts_set_id, roster.roster_hash_sha256,
         roster.resolution_id, roster.agreement_id, roster.frozen_at
    INTO v_expected
    FROM public.secretaria_annual_accounts_expected_signers expected
    JOIN public.secretaria_annual_accounts_signer_rosters roster
      ON roster.id = expected.signer_roster_id
     AND roster.tenant_id = expected.tenant_id
   WHERE expected.id = p_expected_signer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'annual accounts expected signer not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_expected.tenant_id::text || ':ANNUAL_ACCOUNTS_OUTCOME:'
      || p_expected_signer_id::text,
    0
  ));
  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets
   WHERE id = v_expected.annual_accounts_set_id
     AND tenant_id = v_expected.tenant_id
     AND approval_status = 'APPROVED'
     AND immutability_status = 'IMMUTABLE'
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = v_expected.tenant_id
         AND successor.supersedes_set_id = v_expected.annual_accounts_set_id
     );
  SELECT * INTO v_meeting FROM public.meetings
   WHERE id = v_set.meeting_id AND tenant_id = v_set.tenant_id;
  IF v_set.id IS NULL OR v_meeting.id IS NULL
     OR v_meeting.status <> 'CELEBRADA'
     OR v_meeting.scheduled_end IS NULL
     OR p_signed_at < v_meeting.scheduled_end
     OR v_expected.frozen_at < v_meeting.scheduled_end
     OR NOT EXISTS (
       SELECT 1
       FROM public.meeting_resolutions resolution
       JOIN public.agreements agreement
         ON agreement.id = resolution.agreement_id
        AND agreement.tenant_id = resolution.tenant_id
       WHERE resolution.id = v_expected.resolution_id
         AND resolution.agreement_id = v_expected.agreement_id
         AND resolution.meeting_id = v_set.meeting_id
         AND resolution.tenant_id = v_set.tenant_id
         AND resolution.kind_resolution = 'DECISION'
         AND resolution.status = 'ADOPTED'
     ) THEN
    RAISE EXCEPTION 'external signature evidence requires formulated accounts after the meeting';
  END IF;

  SELECT * INTO v_evidence FROM public.secretaria_ead_interposition_evidence
   WHERE id = p_interposition_evidence_id
     AND tenant_id = v_set.tenant_id
     AND source_domain = 'ANNUAL_ACCOUNTS'
     AND source_id = v_set.id
     AND legal_artifact_id IS NULL
     AND subject_person_id = v_expected.person_id
     AND subject_role = 'ADMINISTRADOR'
     AND evidence_purpose = 'EXTERNAL_SIGNATURE_CUSTODY'
     AND provider_mode = 'INTERPOSITION'
     AND provider_status IN ('COMPLETED', 'VERIFIED')
     AND source_hash_sha256 = v_set.manifest_hash_sha256
     AND signature_claim IS FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reviewed external signature evidence is not in verified EAD custody';
  END IF;
  SELECT * INTO v_bundle FROM public.evidence_bundles
   WHERE id = v_evidence.evidence_bundle_id
     AND tenant_id = v_set.tenant_id
     AND status = 'VERIFIED';
  IF NOT FOUND
     OR lower(COALESCE(v_bundle.manifest #>> '{binary,hash_sha256}', ''))
          !~ '^[0-9a-f]{64}$'
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(v_bundle.manifest) THEN
    RAISE EXCEPTION 'external signature document custody bundle is invalid';
  END IF;
  SELECT * INTO v_review
    FROM public.secretaria_annual_accounts_signature_review_events
   WHERE id = p_review_event_id
     AND tenant_id = v_set.tenant_id
     AND annual_accounts_set_id = v_set.id
     AND expected_signer_id = p_expected_signer_id
     AND document_hash_sha256 = lower(v_bundle.manifest #>> '{binary,hash_sha256}')
     AND signed_at = p_signed_at
     AND signature_fact_source = p_signature_fact_source
     AND review_status = 'VERIFIED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'external signature custody lacks the exact immutable review event'
      USING ERRCODE = '42501';
  END IF;
  IF p_finalizer_user_id IS NULL
     OR p_finalizer_user_id = v_review.reviewer_user_id
     OR v_evidence.verified_by IS DISTINCT FROM p_finalizer_user_id
     OR v_review.reviewed_at > v_evidence.occurred_at
     OR v_evidence.occurred_at > v_evidence.verified_at
     OR v_evidence.provider_payload #>> '{external_signature_review,review_event_id}'
          IS DISTINCT FROM v_review.id::text
     OR v_evidence.provider_payload #>> '{external_signature_review,reviewed_by}'
          IS DISTINCT FROM v_review.reviewer_user_id::text
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_profiles profile
       JOIN public.rbac_user_roles user_role
         ON user_role.user_id = profile.user_id
        AND user_role.tenant_id = profile.tenant_id
        AND user_role.is_active IS TRUE
        AND (user_role.expires_at IS NULL OR user_role.expires_at > now())
       JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE profile.user_id = p_finalizer_user_id
         AND profile.tenant_id = v_set.tenant_id
         AND (
           role.role_code = 'ADMIN_TENANT'
           OR EXISTS (
             SELECT 1 FROM public.capability_matrix capability
             WHERE capability.role = role.role_code
               AND capability.action = 'CERTIFICATION'
               AND capability.enabled IS TRUE
           )
         )
     ) THEN
    RAISE EXCEPTION 'external signature custody requires an exact immutable review and a distinct capable finalizer'
      USING ERRCODE = '42501';
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
  IF FOUND
     AND p_supersedes_outcome_id IS NULL
     AND v_head.outcome_type = 'EXTERNAL_SIGNATURE_EVIDENCE'
     AND v_head.external_signature_evidence_id = v_evidence.id
     AND v_head.signed_at = p_signed_at
     AND v_head.signature_fact_source = p_signature_fact_source
     AND v_head.provider_signature_claim IS FALSE THEN
    RETURN jsonb_build_object(
      'outcome_id', v_head.id,
      'outcome_type', 'EXTERNAL_SIGNATURE_EVIDENCE',
      'external_signature_evidence_id', v_evidence.id,
      'provider_mode', 'INTERPOSITION',
      'provider_signature_claim', false,
      'outcome_manifest_hash_sha256', v_head.outcome_manifest_hash_sha256,
      'reused', true
    );
  ELSIF FOUND AND p_supersedes_outcome_id IS DISTINCT FROM v_head.id THEN
    RAISE EXCEPTION 'explicitly supersede current signer outcome %', v_head.id;
  ELSIF NOT FOUND AND p_supersedes_outcome_id IS NOT NULL THEN
    RAISE EXCEPTION 'superseded signer outcome is not current';
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.annual-accounts-external-signature.v1',
    'outcome_id', v_outcome_id,
    'expected_signer_id', p_expected_signer_id,
    'person_id', v_expected.person_id,
    'annual_accounts_set_id', v_set.id,
    'outcome_type', 'EXTERNAL_SIGNATURE_EVIDENCE',
    'signature_fact_source', p_signature_fact_source,
    'signature_fact_at', p_signed_at,
    'external_signature_evidence_id', v_evidence.id,
    'evidence_bundle_id', v_evidence.evidence_bundle_id,
    'provider', 'EAD_TRUST',
    'provider_mode', 'INTERPOSITION',
    'provider_signature_claim', false,
    'external_signature_review_id', v_review.id,
    'external_signature_review', jsonb_build_object(
      'status', v_review.review_status,
      'reviewed_at', v_review.reviewed_at,
      'reviewed_by', v_review.reviewer_user_id,
      'reviewer_person_id', v_review.reviewer_person_id,
      'review_note', v_review.review_note
    ),
    'finalized_by', p_finalizer_user_id,
    'recorded_at', v_recorded_at,
    'recorded_by', auth.uid(),
    'supersedes_outcome_id', p_supersedes_outcome_id
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  INSERT INTO public.secretaria_annual_accounts_signer_outcomes (
    id, tenant_id, expected_signer_id, outcome_type, supersedes_outcome_id,
    signature_request_id, provider_signature_type, provider_reference,
    provider_evidence_bundle_id, signed_output_hash_sha256,
    signed_output_hash_sha512, signed_at,
    external_signature_evidence_id, signature_fact_source,
    provider_signature_claim, missing_signature_cause_code,
    missing_signature_cause_text, outcome_manifest,
    outcome_manifest_hash_sha256, recorded_at, recorded_by
  ) VALUES (
    v_outcome_id, v_expected.tenant_id, p_expected_signer_id,
    'EXTERNAL_SIGNATURE_EVIDENCE', p_supersedes_outcome_id,
    NULL, NULL, NULL, NULL, NULL, NULL, p_signed_at,
    v_evidence.id, p_signature_fact_source, false, NULL, NULL,
    v_manifest, v_manifest_hash, v_recorded_at, auth.uid()
  );

  RETURN jsonb_build_object(
    'outcome_id', v_outcome_id,
    'outcome_type', 'EXTERNAL_SIGNATURE_EVIDENCE',
    'external_signature_evidence_id', v_evidence.id,
    'provider_mode', 'INTERPOSITION',
    'provider_signature_claim', false,
    'outcome_manifest_hash_sha256', v_manifest_hash,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_record_annual_accounts_external_signature(
  uuid, uuid, timestamptz, text, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_record_annual_accounts_external_signature(
  uuid, uuid, timestamptz, text, uuid, uuid, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_record_annual_accounts_missing_signature_cause(
  p_expected_signer_id uuid,
  p_cause_code text,
  p_cause_text text,
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
  v_meeting public.meetings%ROWTYPE;
  v_head public.secretaria_annual_accounts_signer_outcomes%ROWTYPE;
  v_outcome_id uuid := gen_random_uuid();
  v_recorded_at timestamptz := clock_timestamp();
  v_manifest jsonb;
  v_manifest_hash text;
BEGIN
  p_cause_code := upper(COALESCE(btrim(p_cause_code), ''));
  IF p_cause_code NOT IN (
    'DEATH', 'ILLNESS_OR_INCAPACITY', 'DISAGREEMENT', 'UNREACHABLE', 'OTHER_JUSTIFIED'
  ) OR length(btrim(COALESCE(p_cause_text, ''))) < 10 THEN
    RAISE EXCEPTION 'a coded, individual and substantive missing-signature cause is required';
  END IF;
  SELECT expected.*, roster.annual_accounts_set_id, roster.resolution_id,
         roster.agreement_id, roster.frozen_at
    INTO v_expected
    FROM public.secretaria_annual_accounts_expected_signers expected
    JOIN public.secretaria_annual_accounts_signer_rosters roster
      ON roster.id = expected.signer_roster_id
     AND roster.tenant_id = expected.tenant_id
   WHERE expected.id = p_expected_signer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'annual accounts expected signer not found'; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_expected.tenant_id THEN
      RAISE EXCEPTION 'annual accounts cause tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_expected.tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  SELECT * INTO v_set FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.id = v_expected.annual_accounts_set_id
     AND set_row.tenant_id = v_expected.tenant_id
     AND set_row.approval_status = 'APPROVED'
     AND set_row.immutability_status = 'IMMUTABLE'
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     );
  SELECT * INTO v_meeting FROM public.meetings
   WHERE id = v_set.meeting_id AND tenant_id = v_set.tenant_id;
  IF v_set.id IS NULL OR v_meeting.id IS NULL
     OR v_meeting.status <> 'CELEBRADA'
     OR v_meeting.scheduled_end IS NULL
     OR v_meeting.scheduled_end > now()
     OR v_expected.frozen_at < v_meeting.scheduled_end
     OR NOT EXISTS (
       SELECT 1
       FROM public.meeting_resolutions resolution
       JOIN public.agreements agreement
         ON agreement.id = resolution.agreement_id
        AND agreement.tenant_id = resolution.tenant_id
       WHERE resolution.id = v_expected.resolution_id
         AND resolution.agreement_id = v_expected.agreement_id
         AND resolution.meeting_id = v_set.meeting_id
         AND resolution.tenant_id = v_set.tenant_id
         AND resolution.kind_resolution = 'DECISION'
         AND resolution.status = 'ADOPTED'
     ) THEN
    RAISE EXCEPTION 'missing-signature cause is only available after formulation by the celebrated meeting';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_expected.tenant_id::text || ':ANNUAL_ACCOUNTS_OUTCOME:'
      || p_expected_signer_id::text,
    0
  ));
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
    RAISE EXCEPTION 'explicitly supersede current signer outcome %', v_head.id;
  ELSIF NOT FOUND AND p_supersedes_outcome_id IS NOT NULL THEN
    RAISE EXCEPTION 'superseded signer outcome is not current';
  END IF;
  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.annual-accounts-missing-signature-cause.v2',
    'outcome_id', v_outcome_id,
    'expected_signer_id', p_expected_signer_id,
    'person_id', v_expected.person_id,
    'annual_accounts_set_id', v_expected.annual_accounts_set_id,
    'outcome_type', 'MISSING_SIGNATURE_CAUSE',
    'cause_code', p_cause_code,
    'cause_text', btrim(p_cause_text),
    'provider_signature_claim', false,
    'declared_at', v_recorded_at,
    'declared_by', auth.uid(),
    'supersedes_outcome_id', p_supersedes_outcome_id
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  INSERT INTO public.secretaria_annual_accounts_signer_outcomes (
    id, tenant_id, expected_signer_id, outcome_type, supersedes_outcome_id,
    signature_request_id, provider_signature_type, provider_reference,
    provider_evidence_bundle_id, signed_output_hash_sha256,
    signed_output_hash_sha512, signed_at, external_signature_evidence_id,
    signature_fact_source, provider_signature_claim,
    missing_signature_cause_code, missing_signature_cause_text,
    outcome_manifest, outcome_manifest_hash_sha256, recorded_at, recorded_by
  ) VALUES (
    v_outcome_id, v_expected.tenant_id, p_expected_signer_id,
    'MISSING_SIGNATURE_CAUSE', p_supersedes_outcome_id,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false,
    p_cause_code, btrim(p_cause_text), v_manifest, v_manifest_hash,
    v_recorded_at, auth.uid()
  );
  RETURN jsonb_build_object(
    'outcome_id', v_outcome_id,
    'outcome_type', 'MISSING_SIGNATURE_CAUSE',
    'provider_signature_claim', false,
    'outcome_manifest_hash_sha256', v_manifest_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_record_annual_accounts_missing_signature_cause(
  uuid, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_record_annual_accounts_missing_signature_cause(
  uuid, text, text, uuid
) TO authenticated, service_role;

-- El nombre legacy se conserva como adaptador fail-closed: solo admite causa;
-- jamás vuelve a registrar SIGNED_EAD desde un resultado INTERPOSITION.
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
BEGIN
  IF upper(COALESCE(btrim(p_outcome_type), '')) <> 'MISSING_SIGNATURE_CAUSE'
     OR p_signature_request_id IS NOT NULL
     OR p_provider_evidence_bundle_id IS NOT NULL THEN
    RAISE EXCEPTION 'INTERPOSITION is custody, not signature; use reviewed external signature evidence or a cause'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.fn_secretaria_record_annual_accounts_missing_signature_cause(
    p_expected_signer_id,
    p_missing_signature_cause_code,
    p_missing_signature_cause_text,
    p_supersedes_outcome_id
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
  v_external_signature_count integer;
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
    SELECT expected.id AS expected_signer_id,
           expected.person_id,
           expected.person_name_snapshot,
           expected.seat_role_snapshot,
           head.id AS outcome_id,
           head.outcome_type,
           head.external_signature_evidence_id,
           head.provider_signature_claim,
           head.outcome_manifest,
           head.outcome_manifest_hash_sha256
      FROM public.secretaria_annual_accounts_expected_signers expected
      LEFT JOIN heads head ON head.expected_signer_id = expected.id
     WHERE expected.tenant_id = v_set.tenant_id
       AND expected.signer_roster_id = v_roster.id
  )
  SELECT count(*),
         count(*) FILTER (
           WHERE resolved.outcome_type IN (
             'EXTERNAL_SIGNATURE_EVIDENCE', 'MISSING_SIGNATURE_CAUSE'
           )
             AND resolved.provider_signature_claim IS FALSE
             AND encode(digest(resolved.outcome_manifest::text, 'sha256'), 'hex')
                   = resolved.outcome_manifest_hash_sha256
         ),
         count(*) FILTER (WHERE resolved.outcome_type = 'EXTERNAL_SIGNATURE_EVIDENCE'),
         count(*) FILTER (WHERE resolved.outcome_type = 'MISSING_SIGNATURE_CAUSE'),
         COALESCE(jsonb_agg(jsonb_build_object(
           'expected_signer_id', resolved.expected_signer_id,
           'person_id', resolved.person_id,
           'person_name', resolved.person_name_snapshot,
           'seat_role', resolved.seat_role_snapshot,
           'outcome_id', resolved.outcome_id,
           'outcome_type', resolved.outcome_type,
           'external_signature_evidence_id', resolved.external_signature_evidence_id,
           'provider_signature_claim', false,
           'outcome_manifest_hash_sha256', resolved.outcome_manifest_hash_sha256,
           'outcome_manifest', resolved.outcome_manifest
         ) ORDER BY resolved.expected_signer_id), '[]'::jsonb)
    INTO v_expected_count, v_resolved_count, v_external_signature_count,
         v_cause_count, v_outcomes
    FROM resolved;

  IF v_expected_count = 0 OR v_resolved_count <> v_expected_count THEN
    RAISE EXCEPTION 'annual accounts execution: every administrator needs reviewed external signature evidence or an individual cause (%/% resolved)',
      v_resolved_count, v_expected_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_outcomes) item
    LEFT JOIN public.secretaria_ead_interposition_evidence evidence
      ON evidence.id = NULLIF(item ->> 'external_signature_evidence_id', '')::uuid
    WHERE item ->> 'outcome_type' = 'EXTERNAL_SIGNATURE_EVIDENCE'
      AND (
        evidence.id IS NULL
        OR evidence.tenant_id <> v_set.tenant_id
        OR evidence.source_domain <> 'ANNUAL_ACCOUNTS'
        OR evidence.source_id <> v_set.id
        OR evidence.evidence_purpose <> 'EXTERNAL_SIGNATURE_CUSTODY'
        OR evidence.provider_mode <> 'INTERPOSITION'
        OR evidence.signature_claim IS NOT FALSE
      )
  ) THEN
    RAISE EXCEPTION 'annual accounts execution: external signature custody evidence is invalid';
  END IF;

  v_outcomes_hash := encode(digest(v_outcomes::text, 'sha256'), 'hex');
  SELECT COALESCE(jsonb_agg(item ORDER BY item ->> 'expected_signer_id'), '[]'::jsonb)
    INTO v_causes FROM jsonb_array_elements(v_outcomes) item
   WHERE item ->> 'outcome_type' = 'MISSING_SIGNATURE_CAUSE';
  v_causes_hash := encode(digest(v_causes::text, 'sha256'), 'hex');
  RETURN jsonb_build_object(
    'status', 'EXTERNAL_SIGNATURE_ROSTER_COMPLETE',
    'annual_accounts_set_id', v_set.id,
    'set_manifest_hash_sha256', v_set.manifest_hash_sha256,
    'roster_id', v_roster.id,
    'roster_hash_sha256', v_roster.roster_hash_sha256,
    'expected_signer_count', v_expected_count,
    'external_signature_evidence_count', v_external_signature_count,
    'missing_signature_cause_count', v_cause_count,
    'provider_mode', 'INTERPOSITION',
    'provider_signature_claim', false,
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

-- Sustituye el bridge de ejecución histórico. Mantiene la firma SQL para no
-- romper el Edge desplegable, pero el manifiesto solo acredita e-archiving por
-- INTERPOSITION tras resolver el roster conforme al art. 253.2 LSC.
CREATE OR REPLACE FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  p_annual_accounts_set_id uuid,
  p_evidence_bundle_id uuid,
  p_storage_path text,
  p_storage_object_id text,
  p_storage_version text,
  p_binary_hash_sha256 text,
  p_binary_hash_sha512 text,
  p_archived_at timestamptz,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_execution_state jsonb;
  v_manifest jsonb;
  v_manifest_hash text;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_provider_reservation public.secretaria_ead_provider_action_reservations%ROWTYPE;
  v_existing_artifact public.secretaria_annual_accounts_execution_artifacts%ROWTYPE;
  v_registered jsonb;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'annual accounts final e-archive requires service_role'
      USING ERRCODE = '42501';
  END IF;

  p_binary_hash_sha256 := lower(COALESCE(btrim(p_binary_hash_sha256), ''));
  p_binary_hash_sha512 := lower(COALESCE(btrim(p_binary_hash_sha512), ''));
  SELECT set_row.* INTO v_set
    FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.id = p_annual_accounts_set_id
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     )
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts final e-archive requires the current set';
  END IF;

  v_execution_state := public.fn_secretaria_validate_annual_accounts_execution(v_set.id);
  IF v_execution_state ->> 'status' <> 'EXTERNAL_SIGNATURE_ROSTER_COMPLETE' THEN
    RAISE EXCEPTION 'annual accounts final e-archive requires complete reviewed external signature roster';
  END IF;

  IF p_binary_hash_sha256 !~ '^[0-9a-f]{64}$'
     OR p_binary_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR COALESCE(btrim(p_storage_path), '') = ''
     OR p_storage_path LIKE 'http%'
     OR p_storage_path LIKE '%..%'
     OR COALESCE(btrim(p_storage_object_id), '') = ''
     OR COALESCE(btrim(p_storage_version), '') = ''
     OR p_archived_at IS NULL
     OR p_archived_at > now()
     OR p_provider_payload IS NULL
     OR jsonb_typeof(p_provider_payload) <> 'object'
     OR upper(COALESCE(p_provider_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_provider_payload ->> 'service', '')) <> 'EVIDENCE_MANAGER'
     OR upper(COALESCE(p_provider_payload ->> 'provider_mode', '')) <> 'INTERPOSITION'
     OR upper(COALESCE(p_provider_payload ->> 'provider_status', '')) <> 'COMPLETED'
     OR lower(COALESCE(p_provider_payload ->> 'provider_hash_sha256', '')) <> p_binary_hash_sha256
     OR COALESCE(btrim(p_provider_payload ->> 'case_file_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'evidence_group_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'evidence_id'), '') = ''
     OR COALESCE(p_provider_payload ->> 'provider_action_reservation_id', '')
          !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR NOT (p_provider_payload ? 'signature_claim')
     OR COALESCE((p_provider_payload ->> 'signature_claim')::boolean, true) IS NOT FALSE
     OR p_provider_payload ? 'provider_signature_type'
     OR p_provider_payload ? 'signature_packaging'
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(p_provider_payload)
     OR COALESCE((p_provider_payload ->> 'sandbox')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'annual accounts final e-archive lacks verified INTERPOSITION custody with signature_claim=false';
  END IF;

  SELECT reservation.* INTO v_provider_reservation
    FROM public.secretaria_ead_provider_action_reservations reservation
   WHERE reservation.id = (p_provider_payload ->> 'provider_action_reservation_id')::uuid
     AND reservation.tenant_id = v_set.tenant_id
     AND reservation.source_domain = 'ANNUAL_ACCOUNTS'
     AND reservation.source_id = v_set.id
     AND reservation.action_kind = 'ANNUAL_ACCOUNTS_EXECUTION_EARCHIVE'
     AND reservation.subject_key = (v_execution_state ->> 'roster_id')
     AND reservation.source_hash_sha256 = v_set.manifest_hash_sha256
     AND reservation.payload_hash_sha256 = p_binary_hash_sha256
     AND reservation.reservation_context ->> 'roster_id' = (v_execution_state ->> 'roster_id')
     AND reservation.reservation_context ->> 'roster_hash_sha256'
          = (v_execution_state ->> 'roster_hash_sha256')
     AND reservation.reserved_at <= p_archived_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts final e-archive lacks exact pre-provider reservation';
  END IF;

  SELECT * INTO v_existing_artifact
    FROM public.secretaria_annual_accounts_execution_artifacts
   WHERE tenant_id = v_set.tenant_id
     AND annual_accounts_set_id = v_set.id;
  IF FOUND THEN
    IF v_existing_artifact.evidence_bundle_id IS DISTINCT FROM p_evidence_bundle_id
       OR v_existing_artifact.storage_path IS DISTINCT FROM p_storage_path
       OR v_existing_artifact.binary_hash_sha256 IS DISTINCT FROM p_binary_hash_sha256
       OR v_existing_artifact.binary_hash_sha512 IS DISTINCT FROM p_binary_hash_sha512 THEN
      RAISE EXCEPTION 'annual accounts set already has a different FINAL_ARCHIVED artifact';
    END IF;
    RETURN jsonb_build_object(
      'execution_artifact_id', v_existing_artifact.id,
      'evidence_bundle_id', v_existing_artifact.evidence_bundle_id,
      'execution_status', 'FINAL_ARCHIVED',
      'execution_manifest_hash_sha256', v_existing_artifact.execution_manifest_hash_sha256,
      'execution_state', v_execution_state,
      'reused', true
    );
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'ead-trust-annual-accounts-execution.interposition.v1',
    'source', jsonb_build_object(
      'domain', 'ANNUAL_ACCOUNTS',
      'id', v_set.id,
      'content_hash_sha256', v_set.manifest_hash_sha256
    ),
    'binary', jsonb_build_object(
      'artifact_role', 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT',
      'storage_path', p_storage_path,
      'storage_object_id', p_storage_object_id,
      'storage_version', p_storage_version,
      'archived_at', p_archived_at,
      'hash_sha256', p_binary_hash_sha256,
      'hash_sha512', p_binary_hash_sha512,
      'legal_render_binding', jsonb_build_object(
        'annual_accounts_set_manifest_hash_sha256', v_set.manifest_hash_sha256,
        'signer_roster_hash_sha256', v_execution_state ->> 'roster_hash_sha256',
        'signer_outcomes_manifest_hash_sha256', v_execution_state ->> 'outcomes_manifest_hash_sha256',
        'missing_signature_causes_manifest_hash_sha256',
          v_execution_state ->> 'missing_signature_causes_manifest_hash_sha256'
      )
    ),
    'verification', jsonb_build_object(
      'trust_boundary', 'SERVICE_EARCHIVE',
      'provider', 'EAD_TRUST',
      'service', 'EVIDENCE_MANAGER',
      'provider_mode', 'INTERPOSITION',
      'provider_status', 'COMPLETED',
      'case_file_id', p_provider_payload ->> 'case_file_id',
      'evidence_group_id', p_provider_payload ->> 'evidence_group_id',
      'evidence_id', p_provider_payload ->> 'evidence_id',
      'provider_action_reservation_id', v_provider_reservation.id,
      'provider_hash_sha256', p_provider_payload ->> 'provider_hash_sha256',
      'verified_at', p_provider_payload ->> 'verified_at',
      'signature_claim', false,
      'sandbox', false
    )
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  SELECT * INTO v_bundle
    FROM public.evidence_bundles
   WHERE id = p_evidence_bundle_id
     AND tenant_id = v_set.tenant_id;
  IF FOUND THEN
    IF v_bundle.status <> 'VERIFIED'
       OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
       OR encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') <> v_bundle.manifest_hash
       OR v_bundle.source_object_type IS DISTINCT FROM 'ANNUAL_ACCOUNTS_SET'
       OR v_bundle.source_object_id IS DISTINCT FROM v_set.id::text
       OR v_bundle.storage_path IS DISTINCT FROM p_storage_path
       OR v_bundle.hash_sha512 IS DISTINCT FROM p_binary_hash_sha512
       OR v_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM p_binary_hash_sha256
       OR v_bundle.manifest #>> '{binary,artifact_role}' IS DISTINCT FROM 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT'
       OR v_bundle.manifest #>> '{verification,provider_mode}' IS DISTINCT FROM 'INTERPOSITION'
       OR COALESCE((v_bundle.manifest #>> '{verification,signature_claim}')::boolean, true) IS NOT FALSE
       OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(v_bundle.manifest)
       OR v_bundle.manifest #>> '{binary,legal_render_binding,signer_outcomes_manifest_hash_sha256}'
            IS DISTINCT FROM v_execution_state ->> 'outcomes_manifest_hash_sha256' THEN
      RAISE EXCEPTION 'annual accounts final evidence id is bound to different INTERPOSITION custody';
    END IF;
  ELSE
    INSERT INTO public.evidence_bundles (
      id, tenant_id, agreement_id, source_module, source_object_type,
      source_object_id, reference_code, manifest, manifest_hash, hash_sha512,
      storage_path, document_url, signed_by, signature_date,
      chain_of_custody, legal_hold, status
    ) VALUES (
      p_evidence_bundle_id, v_set.tenant_id, NULL, 'secretaria',
      'ANNUAL_ACCOUNTS_SET', v_set.id::text,
      'EAD-ANNUAL-EXEC-' || (p_provider_payload ->> 'evidence_id'),
      v_manifest, v_manifest_hash, p_binary_hash_sha512, p_storage_path,
      'evidence-bundle://' || p_storage_path, NULL, NULL,
      jsonb_build_array(jsonb_build_object(
        'event', 'EAD_ANNUAL_ACCOUNTS_EXECUTION_EARCHIVED',
        'ts', p_archived_at,
        'annual_accounts_set_id', v_set.id,
        'binary_hash_sha256', p_binary_hash_sha256,
        'binary_hash_sha512', p_binary_hash_sha512,
        'roster_hash_sha256', v_execution_state ->> 'roster_hash_sha256',
        'outcomes_hash_sha256', v_execution_state ->> 'outcomes_manifest_hash_sha256',
        'provider_mode', 'INTERPOSITION',
        'signature_claim', false
      )),
      true, 'VERIFIED'
    );
  END IF;

  v_registered := public.fn_secretaria_register_annual_accounts_execution_artifact(
    v_set.id,
    p_evidence_bundle_id,
    p_storage_path,
    p_binary_hash_sha256,
    p_binary_hash_sha512
  );
  RETURN v_registered || jsonb_build_object(
    'evidence_bundle_id', p_evidence_bundle_id,
    'execution_state', v_execution_state,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  uuid, uuid, text, text, text, text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  uuid, uuid, text, text, text, text, text, timestamptz, jsonb
) TO service_role;
-- El artefacto final solo se alcanza a través del bridge anterior, que valida
-- provider_mode, signature_claim y roster revisado. El helper interno conserva
-- SECURITY DEFINER para la llamada del owner, pero deja de ser API directa.
REVOKE ALL ON FUNCTION public.fn_secretaria_register_annual_accounts_execution_artifact(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

-- La reconciliación legacy convertía resultados INTERPOSITION/ADVANCED en
-- SIGNED_EAD. Queda cerrada; el bridge debe custodiar el documento firmado
-- externamente y registrar el resultado mediante el RPC anterior.
REVOKE ALL ON FUNCTION public.fn_secretaria_reconcile_annual_accounts_ead_bundle(
  uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- El RPC histórico de asiento aún consulta `signed_at`/`is_locked`. Este guard
-- hace que esas proyecciones nunca basten: un asiento nuevo solo puede nacer de
-- la aprobación canónica INTERPOSITION con consentimiento y constancia WORM.
CREATE OR REPLACE FUNCTION public.fn_secretaria_interposition_book_entry_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
BEGIN
  IF NEW.source_domain = 'MINUTE' THEN
    SELECT * INTO v_minute
      FROM public.minutes
     WHERE id = NEW.source_id
       AND tenant_id = NEW.tenant_id;
    IF NOT FOUND
       OR v_minute.legal_gate_status <> 'APPROVED_SIGNED'
       OR v_minute.approval_canonical_status <> 'APPROVED_EVIDENCED'
       OR v_minute.approval_evidence_mode <> 'INTERPOSITION'
       OR v_minute.approval_signature_claim IS NOT FALSE
       OR v_minute.president_consent_evidence_id IS NULL
       OR v_minute.secretary_constancia_evidence_id IS NULL THEN
      RAISE EXCEPTION 'minute book entry requires canonical INTERPOSITION approval evidence'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_interposition_book_entry_guard
  ON public.societary_book_entries;
CREATE TRIGGER trg_secretaria_interposition_book_entry_guard
  BEFORE INSERT ON public.societary_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_interposition_book_entry_guard();
REVOKE ALL ON FUNCTION public.fn_secretaria_interposition_book_entry_guard()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Inmutabilidad adicional, mensajería y documentación del contrato
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_interposition_domain_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_writer boolean :=
    COALESCE(current_setting('app.secretaria_authoritative_rpc', true), '') = '1';
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF TG_TABLE_NAME = 'minutes' THEN
    IF NOT v_writer AND (
      NEW.president_consent_evidence_id IS DISTINCT FROM OLD.president_consent_evidence_id
      OR NEW.secretary_constancia_evidence_id IS DISTINCT FROM OLD.secretary_constancia_evidence_id
      OR NEW.approval_evidence_mode IS DISTINCT FROM OLD.approval_evidence_mode
      OR NEW.approval_signature_claim IS DISTINCT FROM OLD.approval_signature_claim
      OR NEW.approval_evidenced_at IS DISTINCT FROM OLD.approval_evidenced_at
      OR NEW.approval_canonical_status IS DISTINCT FROM OLD.approval_canonical_status
    ) THEN
      RAISE EXCEPTION 'minute interposition facts require governed authoritative RPC'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.approval_evidence_mode = 'INTERPOSITION' AND (
      NEW.president_consent_evidence_id IS DISTINCT FROM OLD.president_consent_evidence_id
      OR NEW.secretary_constancia_evidence_id IS DISTINCT FROM OLD.secretary_constancia_evidence_id
      OR NEW.approval_evidence_mode IS DISTINCT FROM OLD.approval_evidence_mode
      OR NEW.approval_signature_claim IS DISTINCT FROM OLD.approval_signature_claim
      OR NEW.approval_evidenced_at IS DISTINCT FROM OLD.approval_evidenced_at
      OR NEW.approval_canonical_status IS DISTINCT FROM OLD.approval_canonical_status
    ) THEN
      RAISE EXCEPTION 'evidenced minute approval is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'certifications' THEN
    IF NOT v_writer AND (
      NEW.certifier_constancia_evidence_id IS DISTINCT FROM OLD.certifier_constancia_evidence_id
      OR NEW.visto_bueno_constancia_evidence_id IS DISTINCT FROM OLD.visto_bueno_constancia_evidence_id
      OR NEW.interposition_evidence_mode IS DISTINCT FROM OLD.interposition_evidence_mode
      OR NEW.interposition_signature_claim IS DISTINCT FROM OLD.interposition_signature_claim
      OR NEW.constancia_evidenced_at IS DISTINCT FROM OLD.constancia_evidenced_at
      OR NEW.evidence_binding_hash_sha256 IS DISTINCT FROM OLD.evidence_binding_hash_sha256
      OR NEW.interposition_canonical_status IS DISTINCT FROM OLD.interposition_canonical_status
    ) THEN
      RAISE EXCEPTION 'certification interposition facts require governed authoritative RPC'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.interposition_evidence_mode = 'INTERPOSITION' AND (
      NEW.certifier_constancia_evidence_id IS DISTINCT FROM OLD.certifier_constancia_evidence_id
      OR NEW.visto_bueno_constancia_evidence_id IS DISTINCT FROM OLD.visto_bueno_constancia_evidence_id
      OR NEW.interposition_evidence_mode IS DISTINCT FROM OLD.interposition_evidence_mode
      OR NEW.interposition_signature_claim IS DISTINCT FROM OLD.interposition_signature_claim
      OR NEW.constancia_evidenced_at IS DISTINCT FROM OLD.constancia_evidenced_at
      OR NEW.evidence_binding_hash_sha256 IS DISTINCT FROM OLD.evidence_binding_hash_sha256
      OR NEW.interposition_canonical_status IS DISTINCT FROM OLD.interposition_canonical_status
    ) THEN
      RAISE EXCEPTION 'evidenced certification constancias are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_minutes_interposition_domain_guard ON public.minutes;
CREATE TRIGGER trg_minutes_interposition_domain_guard
  BEFORE UPDATE OR DELETE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_interposition_domain_guard();
DROP TRIGGER IF EXISTS trg_certifications_interposition_domain_guard ON public.certifications;
CREATE TRIGGER trg_certifications_interposition_domain_guard
  BEFORE UPDATE OR DELETE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_interposition_domain_guard();

DROP TRIGGER IF EXISTS trg_audit_worm_secretaria_ead_interposition
  ON public.secretaria_ead_interposition_evidence;
CREATE TRIGGER trg_audit_worm_secretaria_ead_interposition
  AFTER INSERT ON public.secretaria_ead_interposition_evidence
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

REVOKE EXECUTE ON FUNCTION public.fn_secretaria_interposition_domain_guard()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.secretaria_ead_interposition_evidence IS
  'Ledger WORM de custodia, consentimiento, constancia y e-archiving EAD Trust por INTERPOSITION. signature_claim siempre false.';
COMMENT ON TABLE public.secretaria_ead_provider_action_reservations IS
  'Intenciones locales WORM fijadas antes de cualquier efecto EAD, vinculadas a usuario, tenant, fuente y hashes exactos; no acreditan por sí solas ejecución externa.';
COMMENT ON TABLE public.secretaria_qtsp_verifications IS
  'LEGACY_REVIEW: verificaciones de un flujo histórico de firma. Los gates Secretaría nuevos no insertan ni consumen esta tabla.';
COMMENT ON COLUMN public.minutes.signed_at IS
  'Campo legacy de compatibilidad: en el flujo INTERPOSITION proyecta el momento de aprobación evidenciado; no afirma firma electrónica ni nivel eIDAS.';
COMMENT ON COLUMN public.certifications.signature_status IS
  'Campo legacy de compatibilidad. EVIDENCED significa constancias EAD por interposición con signature_claim=false; no significa firma electrónica.';
COMMENT ON COLUMN public.certifications.required_ead_signature_type IS
  'Campo legacy ignorado por los gates INTERPOSITION. No debe interpretarse como requisito de QES, avanzada o simple.';
COMMENT ON COLUMN public.minutes.legal_gate_status IS
  'APPROVED_SIGNED es una proyección legacy. Solo hay aprobación nueva si approval_canonical_status=APPROVED_EVIDENCED, approval_evidence_mode=INTERPOSITION y approval_signature_claim=false.';
COMMENT ON COLUMN public.certifications.legal_gate_status IS
  'INTERPOSITION_VERIFIED es el estado canónico nuevo. SIGNATURE_VERIFIED queda reservado a revisión histórica y no habilita emisión.';
COMMENT ON FUNCTION public.fn_aprobar_acta_autoritativa(uuid, uuid, text, timestamptz, uuid, uuid) IS
  'Signatura SQL legacy conservada: los dos últimos UUID son ahora consentimiento de Presidencia y constancia de Secretaría en el ledger EAD INTERPOSITION; nunca claims de firma.';
COMMENT ON FUNCTION public.fn_firmar_certificacion_autoritativa(uuid, uuid, uuid, uuid) IS
  'Nombre RPC legacy conservado: registra constancias EAD INTERPOSITION de certificante/visto bueno, signature_claim=false; no firma el documento.';
COMMENT ON FUNCTION public.fn_secretaria_validate_annual_accounts_execution(uuid) IS
  'Art. 253.2 LSC: exige evidencia externa revisada de firma de cada administrador o causa individual. La custodia EAD INTERPOSITION nunca equivale a firma.';
COMMENT ON FUNCTION public.fn_recipient_mark_ead_notice_result(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, text
) IS
  'Mensajería básica EAD Notice Manager: REQUESTED/DELIVERED se registran en ledger WORM y e-archiving se valida por separado; no existe claim de firma.';

COMMIT;
