BEGIN;

-- La apertura de un expediente sin sesión es una operación jurídica, no un
-- INSERT reintentable a ciegas. La clave permanece nullable para filas legacy,
-- pero toda alta gobernada nueva la exige y la unicidad se acota al tenant.
ALTER TABLE public.no_session_resolutions
  ADD COLUMN IF NOT EXISTS open_idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_no_session_resolutions_tenant_open_idempotency
  ON public.no_session_resolutions(tenant_id, open_idempotency_key)
  WHERE open_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION secretaria_private.fn_has_ead_interposition_marker(
  p_metadata jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT
    COALESCE(upper(btrim(p_metadata #>> '{ead_service,mode}')) = 'EAD_INTERPOSITION', false)
    OR COALESCE(
      upper(btrim(p_metadata #>> '{channel_semantics,requested_minimum}')) = 'EAD_INTERPOSITION',
      false
    )
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(p_metadata #> '{channel_semantics,recipients}') = 'array'
              THEN p_metadata #> '{channel_semantics,recipients}'
            ELSE '[]'::jsonb
          END
        ) recipient
       WHERE upper(btrim(COALESCE(
               recipient ->> 'canal_primario',
               recipient ->> 'requested_channel',
               recipient ->> 'channel',
               ''
             ))) = 'EAD_INTERPOSITION'
          OR upper(btrim(COALESCE(recipient ->> 'canal_fallback', '')))
               = 'EAD_INTERPOSITION'
    )
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_has_ead_interposition_marker(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION secretaria_private.fn_has_ead_interposition_marker(jsonb)
  TO service_role;

-- Una fila recién capturada tampoco puede llegar con hechos externos ya
-- consumados dentro de metadata. Los flags negativos y NOT_REQUESTED son
-- declaraciones de ausencia, no claims; cualquier valor positivo exige una
-- RPC posterior que verifique la respuesta real del proveedor.
CREATE OR REPLACE FUNCTION secretaria_private.fn_has_unverified_externality_claim(
  p_metadata jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
  WITH RECURSIVE walk(value) AS (
    SELECT COALESCE(p_metadata, '{}'::jsonb)
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
     WHERE (
       lower(field.key) IN (
         'erds', 'erds_claim', 'burofax_erds', 'qualified_delivery',
         'provider_interaction', 'delivery_proven', 'delivery_claim',
         'delivered', 'provider_archive_proven', 'archive_proven'
       )
       AND field.value NOT IN ('false'::jsonb, 'null'::jsonb, '""'::jsonb)
     )
     OR (
       lower(field.key) IN (
         'provider_request_id', 'provider_delivery_id', 'delivery_ref',
         'provider_requested_at', 'provider_delivered_at', 'delivered_at',
         'delivery_timestamp', 'provider_archive_id', 'provider_archive_ref',
         'provider_event_id', 'provider_message_id',
         'provider_callback_event_id', 'provider_contract_evidence',
         'earchive_evidence_id', 'earchive_archived_at',
         'signature_fact_at', 'signature_fact_source'
       )
       AND field.value NOT IN ('null'::jsonb, '""'::jsonb)
     )
     OR (
       lower(field.key) IN ('provider_status', 'earchive_status')
       AND upper(btrim(COALESCE(field.value #>> '{}', '')))
             NOT IN ('', 'NOT_REQUESTED', 'UNCONFIGURED')
     )
  )
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_has_unverified_externality_claim(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION secretaria_private.fn_has_unverified_externality_claim(jsonb)
  TO service_role;

-- Las nuevas capturas EAD son borradores de interposición, no ERDS ni una
-- interacción probada con el proveedor. Este gate complementa el específico
-- de convocatorias sin reescribir su lógica de manifiesto/rectificación.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_nonconvocation_ead_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_ead_draft boolean := false;
  v_was_ead_draft boolean := false;
  v_governed_cancel boolean := false;
  v_rpc_write boolean := false;
BEGIN
  IF TG_OP = 'INSERT'
     AND (
       public.fn_secretaria_jsonb_has_forbidden_signature_claim(
         COALESCE(NEW.metadata, '{}'::jsonb)
       ) IS TRUE
       OR secretaria_private.fn_has_unverified_externality_claim(
         COALESCE(NEW.metadata, '{}'::jsonb)
       ) IS TRUE
     ) THEN
    RAISE EXCEPTION 'NEW_COMMUNICATION_CANNOT_ASSERT_UNVERIFIED_EXTERNALITY'
      USING ERRCODE = '42501';
  END IF;

  -- Los canales certificados legacy quedan como vocabulario histórico de
  -- solo lectura. Una
  -- nueva comunicacion no puede eludir la politica omitiendo el marcador EAD
  -- de metadata y pidiendo directamente el nivel legacy.
  IF TG_OP = 'INSERT'
     AND upper(btrim(COALESCE(NEW.nivel_certificacion_minimo, '')))
           IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS') THEN
    RAISE EXCEPTION 'UNVERIFIED_CERTIFIED_LEVEL_IS_READ_ONLY_FOR_NEW_CAPTURES'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'UPDATE'
     AND upper(btrim(COALESCE(NEW.nivel_certificacion_minimo, '')))
           IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND NEW.nivel_certificacion_minimo
           IS DISTINCT FROM OLD.nivel_certificacion_minimo THEN
    RAISE EXCEPTION 'UNVERIFIED_CERTIFIED_LEVEL_CANNOT_BE_INTRODUCED'
      USING ERRCODE = '42501';
  END IF;

  -- Detecta la intención EAD antes de confiar en que el cliente haya enviado
  -- la clasificación sandbox correcta. Así una RPC legacy no puede evitar el
  -- gate omitiendo `sandbox_only` o elevando provider_interaction.
  v_is_ead_draft :=
    NEW.tipo_comunicacion <> 'CONVOCATORIA'
    AND secretaria_private.fn_has_ead_interposition_marker(NEW.metadata);
  IF TG_OP = 'UPDATE' THEN
    v_was_ead_draft :=
      OLD.tipo_comunicacion <> 'CONVOCATORIA'
      AND secretaria_private.fn_has_ead_interposition_marker(OLD.metadata);
  END IF;

  IF NOT v_is_ead_draft AND NOT v_was_ead_draft THEN
    RETURN NEW;
  END IF;
  IF v_was_ead_draft AND NOT v_is_ead_draft THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_CLASSIFICATION_IS_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;

  v_rpc_write := COALESCE(
    current_setting('app.secretaria_ead_draft_rpc', true) = 'on',
    false
  );
  v_governed_cancel := COALESCE(
    TG_OP = 'UPDATE'
    AND current_setting('app.secretaria_communication_lifecycle_rpc', true) = 'on'
    AND OLD.estado = 'BORRADOR'
    AND NEW.estado = 'CANCELADA',
    false
  );

  IF TG_OP = 'INSERT' AND NOT v_rpc_write THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_REQUIRES_GOVERNED_RPC'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND v_governed_cancel THEN
    IF (to_jsonb(NEW) - 'estado' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'estado' - 'updated_at') THEN
      RAISE EXCEPTION 'EAD_INTERPOSITION_CANCEL_MAY_ONLY_CHANGE_STATE'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT v_rpc_write THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_IS_IMMUTABLE_EXCEPT_GOVERNED_CANCEL'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado <> 'BORRADOR'
     OR NEW.nivel_certificacion_minimo <> 'EMAIL_NORMAL'
     OR NEW.fecha_programada IS NOT NULL
     OR NEW.fecha_envio_efectiva IS NOT NULL
     OR NEW.fecha_limite_respuesta IS NOT NULL
     OR NEW.tiene_rebotes IS TRUE
     OR NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb
     OR NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
     OR NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
     OR NEW.metadata #> '{ead_service,policy_scope}'
          IS DISTINCT FROM '["BASIC_MESSAGING", "CUSTODY", "EARCHIVING"]'::jsonb
     OR NEW.metadata #>> '{ead_service,environment}' <> 'SANDBOX'
     OR NEW.metadata #> '{ead_service,delivery_allowed}' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata #> '{ead_service,provider_interaction}' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata #> '{ead_service,provider_contract_evidence}' IS DISTINCT FROM 'null'::jsonb
     OR NEW.metadata #> '{ead_service,signature_claim}' IS DISTINCT FROM 'false'::jsonb
     OR NEW.metadata #> '{ead_service,erds_claim}' IS DISTINCT FROM 'false'::jsonb
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(NEW.metadata) IS TRUE THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_CONTRADICTS_NO_EXTERNALITY_POLICY'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_guard_nonconvocation_ead_draft
  ON public.communications;
CREATE TRIGGER trg_secretaria_guard_nonconvocation_ead_draft
  BEFORE INSERT OR UPDATE ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_nonconvocation_ead_draft();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_nonconvocation_ead_draft()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_nonconvocation_ead_draft()
  TO service_role;

-- El dispatcher tampoco puede convertir un destinatario de borrador EAD en
-- una entrega ficticia. Los códigos físicos permanecen EMAIL_NORMAL porque
-- EAD_INTERPOSITION vive en metadata como intención, no como transporte.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_ead_draft_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
BEGIN
  IF upper(btrim(COALESCE(NEW.canal_original, '')))
       IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(NEW.canal_primario, '')))
       IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(NEW.canal_fallback, '')))
       IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(NEW.canal_usado, '')))
       IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS') THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'UNVERIFIED_CERTIFIED_CHANNEL_IS_READ_ONLY_FOR_NEW_CAPTURES'
        USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'UNVERIFIED_CERTIFIED_RECIPIENT_IS_QUARANTINED_READ_ONLY'
      USING ERRCODE = '42501';
  END IF;

  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = NEW.communication_id;
  IF NOT FOUND
     OR v_communication.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb
     OR v_communication.metadata #>> '{ead_service,mode}' IS DISTINCT FROM 'EAD_INTERPOSITION' THEN
    RETURN NEW;
  END IF;

  IF NEW.canal_original <> 'EMAIL_NORMAL'
     OR NEW.canal_primario <> 'EMAIL_NORMAL'
     OR NEW.canal_fallback IS NOT NULL
     OR NEW.canal_usado IS NOT NULL
     OR NEW.estado_entrega <> 'PENDIENTE'
     OR NEW.fecha_envio IS NOT NULL
     OR NEW.fecha_entrega IS NOT NULL
     OR NEW.fecha_lectura IS NOT NULL
     OR NEW.fecha_respuesta IS NOT NULL
     OR NEW.acuse_evidence_id IS NOT NULL
     OR NEW.acuse_evidence_hash IS NOT NULL
     OR NEW.respuesta_firma_qes_id IS NOT NULL
     OR NEW.intento_reenvio_n <> 0
     OR NEW.ultimo_error IS NOT NULL THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_RECIPIENT_CANNOT_ASSERT_DISPATCH_OR_DELIVERY'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_draft_recipient
  ON public.communication_recipients;
CREATE TRIGGER trg_secretaria_guard_ead_draft_recipient
  BEFORE INSERT OR UPDATE ON public.communication_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_draft_recipient();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_ead_draft_recipient()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_ead_draft_recipient()
  TO service_role;

-- La fuente de una comunicación EAD no puede seguir siendo una fila abierta
-- desde el cliente. El alta gobernada deriva tenant, apertura y censo político
-- y crea el snapshot WORM en la misma transacción. El flujo genérico queda
-- limitado a órganos colegiados políticos; Junta/capital y administradores
-- tienen flujos específicos con denominadores distintos.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_no_session_resolution_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'VOTING_OPEN'
       AND COALESCE(
         current_setting('app.secretaria_no_session_open_rpc', true) = 'on',
         false
       ) IS NOT TRUE THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_REQUIRES_GOVERNED_RPC'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'DRAFT' OR NEW.status <> 'DRAFT' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.body_id IS DISTINCT FROM OLD.body_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.proposal_text IS DISTINCT FROM OLD.proposal_text
       OR NEW.matter_class IS DISTINCT FROM OLD.matter_class
       OR NEW.agreement_kind IS DISTINCT FROM OLD.agreement_kind
       OR NEW.requires_unanimity IS DISTINCT FROM OLD.requires_unanimity
       OR NEW.total_members IS DISTINCT FROM OLD.total_members
       OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
       OR NEW.voting_deadline IS DISTINCT FROM OLD.voting_deadline
       OR NEW.open_idempotency_key IS DISTINCT FROM OLD.open_idempotency_key THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_SOURCE_IS_IMMUTABLE'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_guard_no_session_resolution_source
  ON public.no_session_resolutions;
CREATE TRIGGER trg_secretaria_guard_no_session_resolution_source
  BEFORE INSERT OR UPDATE ON public.no_session_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_no_session_resolution_source();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_no_session_resolution_source()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_no_session_resolution_source()
  TO service_role;

-- Elimina cualquier overload local anterior a esta revisión. En Cloud la RPC
-- todavía no existe, pero este DROP mantiene la migración segura al reensayarla
-- sobre snapshots donde se aplicó una iteración previa de 148000.
DROP FUNCTION IF EXISTS public.fn_create_no_session_resolution(
  uuid, text, text, text, text, boolean, timestamptz
);

CREATE OR REPLACE FUNCTION public.fn_create_no_session_resolution(
  p_body_id uuid,
  p_title text,
  p_proposal_text text,
  p_matter_class text,
  p_agreement_kind text,
  p_requires_unanimity boolean,
  p_voting_deadline timestamptz,
  p_open_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_body public.governing_bodies%ROWTYPE;
  v_entity public.entities%ROWTYPE;
  v_body_type text;
  v_member_count integer;
  v_resolution_id uuid;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_audit_snapshot_payload jsonb;
  v_snapshot_hash text;
  v_snapshot_total_partes integer;
  v_audit_snapshot_total_partes integer;
  v_existing_resolution public.no_session_resolutions%ROWTYPE;
  v_legal_timezone text;
  v_previous_timezone text;
  v_canonical_title text := btrim(COALESCE(p_title, ''));
  v_canonical_proposal text := COALESCE(p_proposal_text, '');
  v_canonical_matter_class text := upper(btrim(COALESCE(p_matter_class, '')));
  v_canonical_agreement_kind text := btrim(COALESCE(p_agreement_kind, ''));
  v_canonical_requires_unanimity boolean := COALESCE(p_requires_unanimity, false);
BEGIN
  IF v_user_id IS NULL OR public.fn_secretaria_is_service_role() IS TRUE THEN
    RAISE EXCEPTION 'NO_SESSION_OPEN_REQUIRES_AUTHENTICATED_HUMAN'
      USING ERRCODE = '42501';
  END IF;
  SELECT body.* INTO v_body
    FROM public.governing_bodies body
   WHERE body.id = p_body_id;
  IF NOT FOUND
     OR public.fn_assert_current_tenant_id() IS DISTINCT FROM v_body.tenant_id THEN
    RAISE EXCEPTION 'NO_SESSION_OPEN_BODY_SCOPE_INVALID'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.fn_secretaria_assert_role_allowed(
    v_body.tenant_id,
    ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
  );
  SELECT entity.* INTO v_entity
    FROM public.entities entity
   WHERE entity.id = v_body.entity_id
     AND entity.tenant_id = v_body.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_SESSION_OPEN_ENTITY_SCOPE_INVALID'
      USING ERRCODE = '23514';
  END IF;

  v_body_type := upper(btrim(COALESCE(v_body.body_type, '')));
  IF NOT (
    v_body_type IN (
      'CDA', 'CONSEJO', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION',
      'COMISION', 'COMITE'
    )
    OR v_body_type LIKE '%CONSEJO%'
  ) THEN
    RAISE EXCEPTION 'NO_SESSION_OPEN_REQUIRES_POLITICAL_COLLEGIATE_BODY'
      USING ERRCODE = '23514';
  END IF;
  IF p_open_idempotency_key IS NULL
     OR NULLIF(v_canonical_title, '') IS NULL
     OR NULLIF(btrim(v_canonical_proposal), '') IS NULL
     OR NULLIF(v_canonical_agreement_kind, '') IS NULL
     OR v_canonical_matter_class
          NOT IN ('ORDINARIA', 'ESTATUTARIA', 'ESTRUCTURAL')
     OR p_voting_deadline IS NULL
     OR p_voting_deadline <= now() THEN
    RAISE EXCEPTION 'NO_SESSION_OPEN_INPUT_INVALID'
      USING ERRCODE = '23514';
  END IF;

  -- El advisory serializa reintentos concurrentes antes de volver a consultar
  -- el censo. Si ya existe la clave, solo se reutiliza el mismo acto exacto y
  -- con un snapshot WORM todavía íntegro; una reutilización divergente falla.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'NO_SESSION_OPEN:' || v_body.tenant_id::text || ':'
      || p_open_idempotency_key::text,
    0
  ));

  SELECT resolution.* INTO v_existing_resolution
    FROM public.no_session_resolutions resolution
   WHERE resolution.tenant_id = v_body.tenant_id
     AND resolution.open_idempotency_key = p_open_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing_resolution.body_id IS DISTINCT FROM v_body.id
       OR v_existing_resolution.title IS DISTINCT FROM v_canonical_title
       OR v_existing_resolution.proposal_text IS DISTINCT FROM v_canonical_proposal
       OR v_existing_resolution.matter_class IS DISTINCT FROM v_canonical_matter_class
       OR v_existing_resolution.agreement_kind IS DISTINCT FROM v_canonical_agreement_kind
       OR v_existing_resolution.requires_unanimity IS DISTINCT FROM v_canonical_requires_unanimity
       OR v_existing_resolution.voting_deadline IS DISTINCT FROM p_voting_deadline THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = '23505';
    END IF;

    SELECT
      snapshot.payload,
      audit.delta #> '{new,payload}',
      snapshot.total_partes,
      CASE
        WHEN audit.delta #>> '{new,total_partes}' ~ '^[0-9]+$'
          THEN (audit.delta #>> '{new,total_partes}')::integer
        ELSE NULL
      END,
      lower(audit.hash_sha512)
      INTO
        v_snapshot_payload,
        v_audit_snapshot_payload,
        v_snapshot_total_partes,
        v_audit_snapshot_total_partes,
        v_snapshot_hash
      FROM public.censo_snapshot snapshot
      JOIN public.audit_log audit
        ON audit.id = snapshot.audit_worm_id
       AND audit.tenant_id = snapshot.tenant_id
       AND audit.table_name = 'censo_snapshot'
       AND audit.record_id = snapshot.id
       AND audit.action = 'CENSO_SNAPSHOT_CREATED'
     WHERE snapshot.tenant_id = v_body.tenant_id
       AND snapshot.meeting_id = v_existing_resolution.id
       AND snapshot.session_kind = 'NO_SESSION'
       AND snapshot.entity_id = v_body.entity_id
       AND snapshot.body_id = v_body.id
       AND snapshot.snapshot_type = 'POLITICO'
     ORDER BY snapshot.created_at, snapshot.id
     LIMIT 1;
    IF NOT FOUND
       OR jsonb_typeof(v_snapshot_payload) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_audit_snapshot_payload) IS DISTINCT FROM 'array'
       OR v_audit_snapshot_payload IS DISTINCT FROM v_snapshot_payload
       OR v_snapshot_hash !~ '^[0-9a-f]{128}$'
       OR v_snapshot_total_partes IS DISTINCT FROM v_existing_resolution.total_members
       OR v_audit_snapshot_total_partes
            IS DISTINCT FROM v_existing_resolution.total_members
       OR jsonb_array_length(v_snapshot_payload)
            IS DISTINCT FROM v_existing_resolution.total_members THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_IDEMPOTENT_REUSE_REQUIRES_VALID_WORM_CENSUS'
        USING ERRCODE = '23514';
    END IF;
    RETURN v_existing_resolution.id;
  END IF;

  v_legal_timezone := CASE upper(COALESCE(v_entity.jurisdiction, ''))
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'PT' THEN 'Europe/Lisbon'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'MX' THEN 'America/Mexico_City'
    ELSE 'UTC'
  END;
  v_previous_timezone := current_setting('TimeZone');
  BEGIN
    PERFORM set_config('TimeZone', v_legal_timezone, true);

    SELECT count(DISTINCT condition.person_id)::integer
      INTO v_member_count
      FROM public.condiciones_persona condition
      JOIN public.persons person
        ON person.id = condition.person_id
       AND person.tenant_id = condition.tenant_id
     WHERE condition.tenant_id = v_body.tenant_id
       AND condition.entity_id = v_body.entity_id
       AND condition.body_id = v_body.id
       AND condition.estado = 'VIGENTE'
       AND condition.fecha_inicio <= current_date
       AND (condition.fecha_fin IS NULL OR condition.fecha_fin >= current_date)
       AND condition.tipo_condicion IN (
         'CONSEJERO', 'PRESIDENTE', 'VICEPRESIDENTE',
         'CONSEJERO_COORDINADOR'
       )
       AND COALESCE(condition.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
       AND (
         COALESCE(v_entity.es_cotizada, false) IS NOT TRUE
         OR person.person_type = 'PF'
       );
    IF COALESCE(v_member_count, 0) = 0 THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_AUTHORITATIVE_CENSUS_EMPTY'
        USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('app.secretaria_no_session_open_rpc', 'on', true);
    INSERT INTO public.no_session_resolutions (
      tenant_id, body_id, title, status, proposal_text, voting_deadline,
      votes_for, votes_against, abstentions, requires_unanimity,
      opened_at, closed_at, matter_class, agreement_kind, total_members,
      open_idempotency_key
    ) VALUES (
      v_body.tenant_id, v_body.id, v_canonical_title, 'VOTING_OPEN',
      v_canonical_proposal, p_voting_deadline,
      0, 0, 0, v_canonical_requires_unanimity,
      now(), NULL, v_canonical_matter_class, v_canonical_agreement_kind,
      v_member_count, p_open_idempotency_key
    )
    RETURNING id INTO v_resolution_id;

    v_snapshot_id := public.fn_crear_censo_snapshot(
      v_resolution_id,
      'NO_SESSION',
      v_body.entity_id,
      v_body.id,
      'POLITICO'
    );
    IF v_snapshot_id IS NULL THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_CENSUS_SNAPSHOT_REQUIRED';
    END IF;

    SELECT
      snapshot.payload,
      audit.delta #> '{new,payload}',
      snapshot.total_partes,
      CASE
        WHEN audit.delta #>> '{new,total_partes}' ~ '^[0-9]+$'
          THEN (audit.delta #>> '{new,total_partes}')::integer
        ELSE NULL
      END,
      lower(audit.hash_sha512)
      INTO
        v_snapshot_payload,
        v_audit_snapshot_payload,
        v_snapshot_total_partes,
        v_audit_snapshot_total_partes,
        v_snapshot_hash
      FROM public.censo_snapshot snapshot
      JOIN public.audit_log audit
        ON audit.id = snapshot.audit_worm_id
       AND audit.tenant_id = snapshot.tenant_id
       AND audit.table_name = 'censo_snapshot'
       AND audit.record_id = snapshot.id
       AND audit.action = 'CENSO_SNAPSHOT_CREATED'
     WHERE snapshot.id = v_snapshot_id
       AND snapshot.tenant_id = v_body.tenant_id
       AND snapshot.meeting_id = v_resolution_id
       AND snapshot.session_kind = 'NO_SESSION'
       AND snapshot.entity_id = v_body.entity_id
       AND snapshot.body_id = v_body.id
       AND snapshot.snapshot_type = 'POLITICO';
    IF NOT FOUND
       OR jsonb_typeof(v_snapshot_payload) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_audit_snapshot_payload) IS DISTINCT FROM 'array'
       OR v_audit_snapshot_payload IS DISTINCT FROM v_snapshot_payload
       OR v_snapshot_hash !~ '^[0-9a-f]{128}$'
       OR v_snapshot_total_partes IS DISTINCT FROM v_member_count
       OR v_audit_snapshot_total_partes IS DISTINCT FROM v_member_count
       OR jsonb_array_length(v_snapshot_payload) IS DISTINCT FROM v_member_count THEN
      RAISE EXCEPTION 'NO_SESSION_OPEN_CENSUS_COUNT_WORM_MISMATCH'
        USING ERRCODE = '40001';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('TimeZone', v_previous_timezone, true);
    RAISE;
  END;
  PERFORM set_config('TimeZone', v_previous_timezone, true);
  RETURN v_resolution_id;
END;
$function$;

-- La tabla llegaba de Cloud con RLS tenant-scoped, pero conservaba GRANT ALL a
-- anon/authenticated y una policy INSERT legacy. Aunque PostgREST no expone
-- TRUNCATE, ese privilegio omite RLS y no debe formar parte del contrato de una
-- cabecera WORM/source-bound. Se reconstruye el perímetro de forma fail-closed:
-- una sola lectura authenticated del tenant activo; toda mutación pasa por RPC.
ALTER TABLE public.no_session_resolutions ENABLE ROW LEVEL SECURITY;

DO $block$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policy.polname
      FROM pg_catalog.pg_policy policy
     WHERE policy.polrelid = 'public.no_session_resolutions'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.no_session_resolutions',
      v_policy.polname
    );
  END LOOP;
END;
$block$;

CREATE POLICY no_session_resolutions_authenticated_select
  ON public.no_session_resolutions
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND tenant_id = public.fn_current_tenant_id()
  );

REVOKE ALL ON TABLE public.no_session_resolutions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.no_session_resolutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.no_session_resolutions
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_create_no_session_resolution(
  uuid, text, text, text, text, boolean, timestamptz, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_no_session_resolution(
  uuid, text, text, text, text, boolean, timestamptz, uuid
) TO authenticated;

-- Las respuestas son el libro WORM de votos. Históricamente la tabla no quedó
-- incluida en el cierre RLS de no_session_resolutions y podía conservar GRANTs
-- o policies de escritura de una instalación anterior. Se reemplaza todo el
-- perímetro: el cliente solo puede leer su tenant; INSERT/UPDATE/DELETE pasan
-- exclusivamente por fn_no_session_cast_response (SECURITY DEFINER).
ALTER TABLE public.no_session_respuestas ENABLE ROW LEVEL SECURITY;

DO $block$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policy.polname
      FROM pg_catalog.pg_policy policy
     WHERE policy.polrelid = 'public.no_session_respuestas'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.no_session_respuestas',
      v_policy.polname
    );
  END LOOP;
END;
$block$;

CREATE POLICY no_session_respuestas_authenticated_select
  ON public.no_session_respuestas
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND tenant_id = public.fn_current_tenant_id()
  );

REVOKE ALL ON TABLE public.no_session_respuestas
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.no_session_respuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.no_session_respuestas
  TO service_role;

DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
     WHERE policy.polrelid = 'public.no_session_respuestas'::regclass
       AND policy.polcmd <> 'r'
  )
     OR NOT has_table_privilege(
       'authenticated', 'public.no_session_respuestas', 'SELECT'
     )
     OR has_table_privilege(
       'authenticated', 'public.no_session_respuestas', 'INSERT'
     )
     OR has_table_privilege(
       'authenticated', 'public.no_session_respuestas', 'UPDATE'
     )
     OR has_table_privilege(
       'authenticated', 'public.no_session_respuestas', 'DELETE'
     )
     OR has_table_privilege('anon', 'public.no_session_respuestas', 'SELECT')
     OR has_table_privilege('anon', 'public.no_session_respuestas', 'INSERT')
     OR has_table_privilege('anon', 'public.no_session_respuestas', 'UPDATE')
     OR has_table_privilege('anon', 'public.no_session_respuestas', 'DELETE') THEN
    RAISE EXCEPTION 'NO_SESSION_RESPONSES_RPC_ONLY_PERIMETER_INVALID';
  END IF;
END;
$assert$;

-- Las columnas de firma/notificacion certificada pertenecen al modelo legacy.
-- Se conservan para lectura historica, pero ninguna captura nueva puede crear
-- esos hechos ni reescribirlos. La barrera de tabla cubre tambien cualquier
-- writer distinto de la RPC gobernada.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_no_session_response_legacy_refs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.firma_qes_ref IS NOT NULL
       OR NEW.firma_qes_timestamp IS NOT NULL
       OR NEW.ocsp_status IS NOT NULL
       OR NEW.notificacion_certificada_ref IS NOT NULL THEN
      RAISE EXCEPTION 'NO_SESSION_LEGACY_QES_ERDS_FIELDS_ARE_READ_ONLY'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.firma_qes_ref IS DISTINCT FROM OLD.firma_qes_ref
     OR NEW.firma_qes_timestamp IS DISTINCT FROM OLD.firma_qes_timestamp
     OR NEW.ocsp_status IS DISTINCT FROM OLD.ocsp_status
     OR NEW.notificacion_certificada_ref
          IS DISTINCT FROM OLD.notificacion_certificada_ref THEN
    RAISE EXCEPTION 'NO_SESSION_LEGACY_QES_ERDS_FIELDS_ARE_READ_ONLY'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_no_session_response_legacy_refs
  ON public.no_session_respuestas;
CREATE TRIGGER trg_secretaria_no_session_response_legacy_refs
  BEFORE INSERT OR UPDATE ON public.no_session_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_no_session_response_legacy_refs();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_no_session_response_legacy_refs()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_no_session_response_legacy_refs()
  TO service_role;

-- El voto deja de consultar el censo mutable vigente. La unica fuente de
-- elegibilidad y denominador es el snapshot POLITICO creado al abrir el
-- expediente y enlazado a su entrada WORM. Se comprueban tanto el espejo del
-- snapshot en audit_log como el hash criptografico de esa entrada antes de
-- aceptar o recontar una respuesta.
CREATE OR REPLACE FUNCTION public.fn_no_session_cast_response(
  p_tenant_id uuid,
  p_resolution_id uuid,
  p_person_id uuid,
  p_sentido text,
  p_texto_respuesta text DEFAULT NULL,
  p_firma_qes_ref text DEFAULT NULL,
  p_notificacion_certificada_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_resolution public.no_session_resolutions%ROWTYPE;
  v_body record;
  v_snapshot public.censo_snapshot%ROWTYPE;
  v_audit public.audit_log%ROWTYPE;
  v_snapshot_count integer;
  v_payload_count integer;
  v_distinct_person_count integer;
  v_member_match_count integer;
  v_snapshot_denominator numeric;
  v_prev_audit_hash text;
  v_expected_audit_hash text;
  v_expediente_id uuid;
  v_response_id uuid;
  v_existing_response_id uuid;
  v_sentido text;
  v_votes_for integer;
  v_votes_against integer;
  v_abstentions integer;
  v_total_required integer;
  v_next_status text;
  v_tipo_proceso text;
  v_condicion_adopcion text;
  v_current_person_id uuid;
  v_is_proxy boolean := false;
  v_objeciones_procedimiento integer := 0;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_capability(p_tenant_id, 'VOTE_EMISSION');
  IF p_resolution_id IS NULL THEN
    RAISE EXCEPTION 'p_resolution_id is required';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'p_person_id is required';
  END IF;
  IF p_firma_qes_ref IS NOT NULL
     OR p_notificacion_certificada_ref IS NOT NULL THEN
    RAISE EXCEPTION 'NO_SESSION_QES_ERDS_REFERENCES_RETIRED_FOR_NEW_CAPTURES'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.fn_secretaria_assert_person_tenant(p_tenant_id, p_person_id);
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    v_current_person_id := public.fn_secretaria_current_person_id();
    IF v_current_person_id IS NULL OR v_current_person_id <> p_person_id THEN
      PERFORM public.fn_secretaria_assert_role_allowed(
        p_tenant_id,
        ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
      );
      v_is_proxy := true;
    END IF;
  END IF;

  v_sentido := upper(btrim(COALESCE(p_sentido, '')));
  IF v_sentido NOT IN (
    'CONSENTIMIENTO', 'OBJECION', 'OBJECION_PROCEDIMIENTO', 'SILENCIO'
  ) THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido;
  END IF;

  -- Conserva el orden de bloqueo existente: primero la raiz resolution. Todos
  -- los votos del expediente quedan serializados por esa misma fila.
  SELECT resolution.* INTO v_resolution
    FROM public.no_session_resolutions resolution
   WHERE resolution.id = p_resolution_id
     AND resolution.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_session_resolution not found: %', p_resolution_id;
  END IF;

  SELECT body.id, body.entity_id, body.body_type, body.name
    INTO v_body
    FROM public.governing_bodies body
   WHERE body.id = v_resolution.body_id
     AND body.tenant_id = p_tenant_id;
  IF v_body.id IS NULL OR v_body.entity_id IS NULL THEN
    RAISE EXCEPTION 'governing body/entity not found for no_session_resolution %',
      p_resolution_id;
  END IF;

  SELECT count(*)::integer INTO v_snapshot_count
    FROM public.censo_snapshot snapshot
   WHERE snapshot.tenant_id = p_tenant_id
     AND snapshot.meeting_id = p_resolution_id
     AND snapshot.session_kind = 'NO_SESSION'
     AND snapshot.entity_id = v_body.entity_id
     AND snapshot.body_id = v_body.id
     AND snapshot.snapshot_type = 'POLITICO';
  IF v_snapshot_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'NO_SESSION_VOTE_REQUIRES_ONE_EXACT_WORM_CENSUS'
      USING ERRCODE = '23514';
  END IF;

  SELECT snapshot.* INTO v_snapshot
    FROM public.censo_snapshot snapshot
   WHERE snapshot.tenant_id = p_tenant_id
     AND snapshot.meeting_id = p_resolution_id
     AND snapshot.session_kind = 'NO_SESSION'
     AND snapshot.entity_id = v_body.entity_id
     AND snapshot.body_id = v_body.id
     AND snapshot.snapshot_type = 'POLITICO';

  SELECT audit.* INTO v_audit
    FROM public.audit_log audit
   WHERE audit.id = v_snapshot.audit_worm_id
     AND audit.tenant_id = v_snapshot.tenant_id
     AND audit.table_name = 'censo_snapshot'
     AND audit.record_id = v_snapshot.id
     AND audit.action = 'CENSO_SNAPSHOT_CREATED';
  IF NOT FOUND
     OR v_audit.seq IS NULL
     OR lower(COALESCE(v_audit.hash_sha512, '')) !~ '^[0-9a-f]{128}$'
     OR jsonb_typeof(v_snapshot.payload) IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_audit.delta #> '{new}') IS DISTINCT FROM 'object'
     OR v_audit.delta #> '{new,payload}' IS DISTINCT FROM v_snapshot.payload
     OR v_audit.delta #>> '{new,id}' IS DISTINCT FROM v_snapshot.id::text
     OR v_audit.delta #>> '{new,tenant_id}'
          IS DISTINCT FROM v_snapshot.tenant_id::text
     OR v_audit.delta #>> '{new,meeting_id}'
          IS DISTINCT FROM v_snapshot.meeting_id::text
     OR v_audit.delta #>> '{new,session_kind}'
          IS DISTINCT FROM v_snapshot.session_kind
     OR v_audit.delta #>> '{new,entity_id}'
          IS DISTINCT FROM v_snapshot.entity_id::text
     OR v_audit.delta #>> '{new,body_id}'
          IS DISTINCT FROM v_snapshot.body_id::text
     OR v_audit.delta #>> '{new,snapshot_type}'
          IS DISTINCT FROM v_snapshot.snapshot_type
     OR v_audit.delta #>> '{new,total_partes}'
          IS DISTINCT FROM v_snapshot.total_partes::text THEN
    RAISE EXCEPTION 'NO_SESSION_VOTE_WORM_CENSUS_AUDIT_INVALID'
      USING ERRCODE = '23514';
  END IF;

  -- `trg_censo_snapshot_worm` propone un hash al crear la entrada, pero el
  -- trigger WORM canonico de audit_log lo recalcula finalmente con `action` y
  -- el predecesor por `seq`. La validacion reproduce esa ultima autoridad.
  SELECT previous.hash_sha512 INTO v_prev_audit_hash
    FROM public.audit_log previous
   WHERE previous.tenant_id = v_audit.tenant_id
     AND previous.seq < v_audit.seq
     AND previous.hash_sha512 IS NOT NULL
   ORDER BY previous.seq DESC
   LIMIT 1;
  v_expected_audit_hash := encode(
    extensions.digest(
      COALESCE(v_prev_audit_hash, 'GENESIS') || '|' ||
      COALESCE(v_audit.action, '') || '|' ||
      COALESCE(v_audit.table_name, '') || '|' ||
      COALESCE(v_audit.record_id::text, '') || '|' ||
      COALESCE(v_audit.delta::text, '{}'),
      'sha512'
    ),
    'hex'
  );
  IF lower(v_audit.hash_sha512) IS DISTINCT FROM v_expected_audit_hash THEN
    RAISE EXCEPTION 'NO_SESSION_VOTE_WORM_CENSUS_HASH_INVALID'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_snapshot.payload) member
     WHERE jsonb_typeof(member) IS DISTINCT FROM 'object'
        OR member ->> 'tenant_id' IS DISTINCT FROM p_tenant_id::text
        OR member ->> 'entity_id' IS DISTINCT FROM v_body.entity_id::text
        OR member ->> 'body_id' IS DISTINCT FROM v_body.id::text
        OR member ->> 'person_id' !~*
             '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR member ->> 'seat_person_id' IS DISTINCT FROM member ->> 'person_id'
        OR upper(COALESCE(member ->> 'source_type', '')) <> 'CARGO'
        OR NULLIF(member ->> 'source_id', '') IS NULL
        OR member -> 'voting_rights' IS DISTINCT FROM 'true'::jsonb
        OR CASE
             WHEN COALESCE(member ->> 'voting_weight', '')
                    ~ '^[0-9]+([.][0-9]+)?$'
               THEN (member ->> 'voting_weight')::numeric = 1
             ELSE false
           END IS NOT TRUE
        OR CASE
             WHEN COALESCE(member ->> 'denominator_weight', '')
                    ~ '^[0-9]+([.][0-9]+)?$'
               THEN (member ->> 'denominator_weight')::numeric = 1
             ELSE false
           END IS NOT TRUE
        OR member ->> 'snapshot_total_partes'
             IS DISTINCT FROM v_snapshot.total_partes::text
  ) THEN
    RAISE EXCEPTION 'NO_SESSION_VOTE_WORM_CENSUS_PAYLOAD_INVALID'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    count(*)::integer,
    count(DISTINCT member ->> 'person_id')::integer,
    COALESCE(sum((member ->> 'denominator_weight')::numeric), 0),
    count(*) FILTER (
      WHERE member ->> 'person_id' = p_person_id::text
        AND member -> 'voting_rights' = 'true'::jsonb
    )::integer
    INTO
      v_payload_count,
      v_distinct_person_count,
      v_snapshot_denominator,
      v_member_match_count
    FROM jsonb_array_elements(v_snapshot.payload) member;

  IF v_payload_count <= 0
     OR v_payload_count IS DISTINCT FROM v_distinct_person_count
     OR v_payload_count IS DISTINCT FROM v_snapshot.total_partes
     OR v_snapshot_denominator IS DISTINCT FROM v_snapshot.total_partes::numeric
     OR v_snapshot.capital_total_base
          IS DISTINCT FROM v_snapshot_denominator
     OR v_resolution.total_members IS DISTINCT FROM v_snapshot.total_partes THEN
    RAISE EXCEPTION 'NO_SESSION_VOTE_WORM_CENSUS_DENOMINATOR_INVALID'
      USING ERRCODE = '23514';
  END IF;
  IF v_member_match_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'NO_SESSION_VOTER_NOT_IN_WORM_CENSUS'
      USING ERRCODE = '42501';
  END IF;
  v_total_required := v_snapshot.total_partes;

  IF v_resolution.status NOT IN ('VOTING_OPEN', 'ABIERTO', 'NOTIFICADO') THEN
    SELECT response.id INTO v_existing_response_id
      FROM public.no_session_expedientes expediente
      JOIN public.no_session_respuestas response
        ON response.expediente_id = expediente.id
     WHERE expediente.tenant_id = p_tenant_id
       AND expediente.no_session_resolution_id = p_resolution_id
       AND response.person_id = p_person_id
     LIMIT 1;
    IF v_existing_response_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', v_resolution.status,
        'resolution_id', p_resolution_id,
        'response_id', v_existing_response_id,
        'idempotent', true,
        'recorded_by_proxy', v_is_proxy,
        'message', 'response_already_recorded'
      );
    END IF;
    RAISE EXCEPTION 'votacion no activa: %', v_resolution.status;
  END IF;

  IF v_resolution.voting_deadline IS NOT NULL
     AND v_resolution.voting_deadline < now() THEN
    RAISE EXCEPTION 'voting window expired for no_session_resolution %',
      p_resolution_id;
  END IF;

  v_tipo_proceso := CASE
    WHEN upper(COALESCE(v_body.body_type, '')) LIKE '%CONSEJO%'
      OR upper(COALESCE(v_body.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN')
      THEN 'CIRCULACION_CONSEJO'
    ELSE 'UNANIMIDAD_ESCRITA_SL'
  END;
  v_condicion_adopcion := CASE
    WHEN v_resolution.requires_unanimity IS TRUE
         AND v_tipo_proceso = 'CIRCULACION_CONSEJO'
      THEN 'UNANIMIDAD_CONSEJEROS'
    WHEN v_resolution.requires_unanimity IS TRUE
      THEN 'UNANIMIDAD_CAPITAL'
    ELSE 'MAYORIA_CONSEJEROS_ESCRITA'
  END;

  INSERT INTO public.no_session_expedientes AS existing (
    tenant_id, agreement_id, no_session_resolution_id, selected_template_id,
    entity_id, body_id, tipo_proceso, propuesta_texto, propuesta_fecha,
    ventana_inicio, ventana_fin, estado, condicion_adopcion, snapshot_hash
  ) VALUES (
    p_tenant_id, NULL, p_resolution_id, v_resolution.selected_template_id,
    v_body.entity_id, v_body.id, v_tipo_proceso, v_resolution.proposal_text,
    current_date, COALESCE(v_resolution.opened_at, now()),
    v_resolution.voting_deadline, 'ABIERTO', v_condicion_adopcion,
    lower(v_audit.hash_sha512)
  )
  ON CONFLICT (tenant_id, no_session_resolution_id)
  WHERE no_session_resolution_id IS NOT NULL
  DO UPDATE SET updated_at = now()
    WHERE existing.snapshot_hash IS NOT DISTINCT FROM EXCLUDED.snapshot_hash
  RETURNING id INTO v_expediente_id;
  IF v_expediente_id IS NULL THEN
    RAISE EXCEPTION 'NO_SESSION_EXPEDIENTE_WORM_CENSUS_BINDING_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.no_session_respuestas (
    tenant_id, expediente_id, person_id,
    capital_participacion, porcentaje_capital, es_consejero,
    sentido, texto_respuesta, fecha_respuesta,
    firma_qes_ref, firma_qes_timestamp, ocsp_status,
    notificacion_certificada_ref
  ) VALUES (
    p_tenant_id, v_expediente_id, p_person_id,
    0, 0, true,
    v_sentido,
    COALESCE(
      p_texto_respuesta,
      CASE WHEN v_is_proxy
        THEN 'Respuesta documentada por Secretaria para el expediente sin sesion.'
        ELSE NULL
      END
    ),
    now(), NULL, NULL, NULL, NULL
  )
  ON CONFLICT (expediente_id, person_id) DO NOTHING
  RETURNING id INTO v_response_id;

  IF v_response_id IS NULL THEN
    SELECT response.id INTO v_response_id
      FROM public.no_session_respuestas response
     WHERE response.expediente_id = v_expediente_id
       AND response.person_id = p_person_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.no_session_respuestas response
     WHERE response.expediente_id = v_expediente_id
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(v_snapshot.payload) member
          WHERE member ->> 'person_id' = response.person_id::text
            AND member -> 'voting_rights' = 'true'::jsonb
       )
  ) THEN
    RAISE EXCEPTION 'NO_SESSION_RESPONSE_OUTSIDE_WORM_CENSUS'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    count(*) FILTER (WHERE response.sentido = 'CONSENTIMIENTO')::integer,
    count(*) FILTER (
      WHERE response.sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO')
    )::integer,
    count(*) FILTER (WHERE response.sentido = 'SILENCIO')::integer,
    count(*) FILTER (
      WHERE response.sentido = 'OBJECION_PROCEDIMIENTO'
    )::integer
    INTO
      v_votes_for,
      v_votes_against,
      v_abstentions,
      v_objeciones_procedimiento
    FROM public.no_session_respuestas response
   WHERE response.expediente_id = v_expediente_id
     AND EXISTS (
       SELECT 1
         FROM jsonb_array_elements(v_snapshot.payload) member
        WHERE member ->> 'person_id' = response.person_id::text
          AND member -> 'voting_rights' = 'true'::jsonb
     );

  v_next_status := v_resolution.status;
  IF v_tipo_proceso = 'CIRCULACION_CONSEJO'
     AND v_objeciones_procedimiento > 0 THEN
    v_next_status := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE
        AND v_votes_against > 0 THEN
    v_next_status := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE
        AND v_votes_for >= v_total_required THEN
    v_next_status := 'APROBADO';
  ELSIF v_resolution.requires_unanimity IS NOT TRUE
        AND (v_votes_for + v_votes_against + v_abstentions)
              >= v_total_required THEN
    IF v_tipo_proceso = 'CIRCULACION_CONSEJO'
       AND upper(COALESCE(v_resolution.agreement_kind, '')) IN (
         'DELEGACION_FACULTADES', 'DELEGACION_PERMANENTE',
         'NOMBRAMIENTO_CONSEJERO_DELEGADO'
       ) THEN
      v_next_status := CASE
        WHEN v_votes_for * 3 >= v_total_required * 2
          THEN 'APROBADO'
        ELSE 'RECHAZADO'
      END;
    ELSE
      v_next_status := CASE
        WHEN v_votes_for > v_votes_against THEN 'APROBADO'
        ELSE 'RECHAZADO'
      END;
    END IF;
  ELSE
    v_next_status := 'VOTING_OPEN';
  END IF;

  UPDATE public.no_session_resolutions
     SET votes_for = v_votes_for,
         votes_against = v_votes_against,
         abstentions = v_abstentions,
         total_members = v_total_required,
         status = v_next_status,
         closed_at = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO')
             THEN COALESCE(closed_at, now())
           ELSE closed_at
         END
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id;

  UPDATE public.no_session_expedientes
     SET estado = CASE
           WHEN v_next_status = 'APROBADO' THEN 'CERRADO_OK'
           WHEN v_next_status = 'RECHAZADO' THEN 'CERRADO_FAIL'
           ELSE 'ABIERTO'
         END,
         fecha_cierre = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO')
             THEN COALESCE(fecha_cierre, now())
           ELSE fecha_cierre
         END,
         motivo_cierre = CASE
           WHEN v_next_status = 'APROBADO' THEN 'condition_met'
           WHEN v_next_status = 'RECHAZADO'
                AND v_tipo_proceso = 'CIRCULACION_CONSEJO'
                AND v_objeciones_procedimiento > 0
             THEN 'procedure_objected'
           WHEN v_next_status = 'RECHAZADO' THEN 'condition_failed'
           ELSE motivo_cierre
         END
   WHERE id = v_expediente_id;

  RETURN jsonb_build_object(
    'resolution_id', p_resolution_id,
    'expediente_id', v_expediente_id,
    'response_id', v_response_id,
    'idempotent', false,
    'status', v_next_status,
    'votes_for', v_votes_for,
    'votes_against', v_votes_against,
    'abstentions', v_abstentions,
    'total_members', v_total_required,
    'recorded_by_proxy', v_is_proxy
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_no_session_cast_response(
  uuid, uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_no_session_cast_response(
  uuid, uuid, uuid, text, text, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_create_ead_interposition_draft(
  p_comm jsonb,
  p_recipients jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := NULLIF(p_comm ->> 'tenant_id', '')::uuid;
  v_entity_id uuid := NULLIF(p_comm ->> 'entity_id', '')::uuid;
  v_body_id uuid := NULLIF(p_comm ->> 'body_id', '')::uuid;
  v_agreement_id uuid := NULLIF(p_comm ->> 'agreement_id', '')::uuid;
  v_source_domain text := upper(btrim(COALESCE(p_comm ->> 'source_domain', '')));
  v_source_id uuid := NULLIF(btrim(COALESCE(p_comm ->> 'source_id', '')), '')::uuid;
  v_body_hash text := lower(btrim(COALESCE(p_comm ->> 'cuerpo_hash_sha512', '')));
  v_expected_subject text;
  v_expected_body text;
  v_computed_hash text;
  v_resolution public.no_session_resolutions%ROWTYPE;
  v_body public.governing_bodies%ROWTYPE;
  v_organo_tipo text;
  v_effective_date date;
  v_snapshot_type text;
  v_snapshot_id uuid;
  v_snapshot_hash text;
  v_snapshot_payload jsonb;
  v_jurisdiction text;
  v_snapshot_timezone text;
  v_previous_timezone text;
  v_authoritative_recipients jsonb := '[]'::jsonb;
  v_authoritative_count integer := 0;
  v_metadata jsonb;
  v_communication_id uuid;
  v_existing_communication public.communications%ROWTYPE;
  v_recipient_count integer;
  v_distinct_recipient_count integer;
BEGIN
  IF v_user_id IS NULL OR public.fn_secretaria_is_service_role() IS TRUE THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_REQUIRES_AUTHENTICATED_HUMAN'
      USING ERRCODE = '42501';
  END IF;
  IF v_tenant_id IS NULL OR public.fn_assert_current_tenant_id() <> v_tenant_id THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_TENANT_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_tenant_id);

  IF v_entity_id IS NULL OR v_body_id IS NULL OR v_source_id IS NULL
     OR v_source_domain <> 'NO_SESSION_RESOLUTION'
     OR btrim(COALESCE(p_comm ->> 'asunto', '')) = ''
     OR btrim(COALESCE(p_comm ->> 'cuerpo_render', '')) = '' THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_INPUT_INVALID'
      USING ERRCODE = '23514';
  END IF;

  SELECT resolution.* INTO v_resolution
    FROM public.no_session_resolutions resolution
   WHERE resolution.id = v_source_id
     AND resolution.tenant_id = v_tenant_id
     AND resolution.body_id = v_body_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_SOURCE_NOT_FOUND_OR_SCOPE_INVALID'
      USING ERRCODE = '23514';
  END IF;
  IF v_resolution.status IS DISTINCT FROM 'VOTING_OPEN'
     OR v_resolution.opened_at IS NULL
     OR v_resolution.closed_at IS NOT NULL
     OR v_resolution.voting_deadline IS NULL
     OR v_resolution.voting_deadline <= now() THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_REQUIRES_OPEN_VOTING_WINDOW'
      USING ERRCODE = '23514';
  END IF;

  SELECT body.* INTO v_body
    FROM public.governing_bodies body
   WHERE body.id = v_body_id
     AND body.entity_id = v_entity_id
     AND body.tenant_id = v_tenant_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.entities entity
     WHERE entity.id = v_entity_id
       AND entity.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_ENTITY_BODY_SCOPE_INVALID'
      USING ERRCODE = '23514';
  END IF;

  v_organo_tipo := CASE
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'CDA', 'CONSEJO', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION'
    ) OR upper(btrim(COALESCE(v_body.body_type, ''))) LIKE '%CONSEJO%'
      THEN 'CONSEJO_ADMIN'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'JGA', 'JUNTA', 'JUNTA_GENERAL'
    ) OR upper(btrim(COALESCE(v_body.body_type, ''))) LIKE '%JUNTA%'
      THEN 'JUNTA_GENERAL'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'COMISION', 'COMISION_DELEGADA', 'COMITE'
    ) OR upper(btrim(COALESCE(v_body.body_type, ''))) LIKE '%COMISION%'
      OR upper(btrim(COALESCE(v_body.body_type, ''))) LIKE '%COMITE%'
      THEN 'COMISION_DELEGADA'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'SOCIO_UNICO', 'DECISION_UNIPERSONAL'
    ) THEN 'SOCIO_UNICO'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'ADMIN_UNICO', 'ADMINISTRADOR_UNICO'
    ) THEN 'ADMIN_UNICO'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'ADMIN_CONJUNTA', 'ADMINISTRADORES_MANCOMUNADOS'
    ) THEN 'ADMIN_CONJUNTA'
    WHEN upper(btrim(COALESCE(v_body.body_type, ''))) IN (
      'ADMIN_SOLIDARIOS', 'ADMINISTRADORES_SOLIDARIOS'
    ) THEN 'ADMIN_SOLIDARIOS'
    ELSE NULL
  END;
  IF v_organo_tipo IS NULL THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_BODY_TYPE_UNSUPPORTED: %', v_body.body_type
      USING ERRCODE = '23514';
  END IF;

  IF v_agreement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.agreements agreement
     WHERE agreement.id = v_agreement_id
       AND agreement.tenant_id = v_tenant_id
       AND agreement.entity_id = v_entity_id
       AND agreement.body_id = v_body_id
       AND agreement.no_session_resolution_id = v_source_id
  ) THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_AGREEMENT_SCOPE_INVALID'
      USING ERRCODE = '23514';
  END IF;

  -- La comunicación no puede usar una resolución real como cobertura para
  -- circular un texto distinto. Asunto, cuerpo y hash quedan derivados de la
  -- propuesta WORM que abrió la votación.
  v_expected_subject := 'Comunicación societaria: ' || v_resolution.title;
  v_expected_body := COALESCE(
    NULLIF(v_resolution.proposal_text, ''),
    'Se remite la propuesta de acuerdo para su votación.'
  );
  IF p_comm ->> 'asunto' IS DISTINCT FROM v_expected_subject
     OR p_comm ->> 'cuerpo_render' IS DISTINCT FROM v_expected_body THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_SOURCE_CONTENT_MISMATCH'
      USING ERRCODE = '23514';
  END IF;
  v_computed_hash := encode(
    extensions.digest(convert_to(v_expected_body, 'UTF8'), 'sha512'),
    'hex'
  );
  IF v_body_hash !~ '^[0-9a-f]{128}$'
     OR v_body_hash IS DISTINCT FROM v_computed_hash THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_BODY_HASH_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(COALESCE(p_recipients, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_recipients, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_REQUIRES_RECIPIENTS'
      USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT lower(btrim(recipient ->> 'person_id')))
    INTO v_recipient_count, v_distinct_recipient_count
    FROM jsonb_array_elements(p_recipients) recipient;
  IF v_recipient_count <> v_distinct_recipient_count THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_DUPLICATE_RECIPIENT'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_recipients) recipient
     WHERE NULLIF(btrim(recipient ->> 'person_id'), '') IS NULL
        OR (recipient ->> 'person_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR NULLIF(btrim(recipient ->> 'destino_primario'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_RECIPIENT_INPUT_INVALID'
      USING ERRCODE = '23514';
  END IF;

  -- El navegador no decide ni el censo ni el cargo. La fecha efectiva es la
  -- apertura de la votación, nunca current_date. Consejo, comisiones y Junta
  -- se vinculan al snapshot WORM canónico; la Junta deriva sus destinatarios
  -- de capital_holdings, no de una condición SOCIO duplicada.
  SELECT upper(COALESCE(entity.jurisdiction, ''))
    INTO v_jurisdiction
    FROM public.entities entity
   WHERE entity.id = v_entity_id
     AND entity.tenant_id = v_tenant_id;
  v_snapshot_timezone := CASE v_jurisdiction
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'PT' THEN 'Europe/Lisbon'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'MX' THEN 'America/Mexico_City'
    ELSE 'UTC'
  END;
  v_previous_timezone := current_setting('TimeZone');
  PERFORM set_config('TimeZone', v_snapshot_timezone, true);
  v_effective_date := v_resolution.opened_at::date;
  PERFORM set_config('TimeZone', v_previous_timezone, true);

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'EAD_INTERPOSITION_DRAFT:' || v_tenant_id::text || ':'
      || v_source_domain || ':' || v_source_id::text,
    0
  ));

  IF v_organo_tipo IN ('CONSEJO_ADMIN', 'COMISION_DELEGADA', 'JUNTA_GENERAL') THEN
    v_snapshot_type := CASE
      WHEN v_organo_tipo = 'JUNTA_GENERAL' THEN 'ECONOMICO'
      ELSE 'POLITICO'
    END;

    SELECT snapshot.id, snapshot.payload, lower(audit.hash_sha512)
      INTO v_snapshot_id, v_snapshot_payload, v_snapshot_hash
      FROM public.censo_snapshot snapshot
      JOIN public.audit_log audit ON audit.id = snapshot.audit_worm_id
     WHERE snapshot.tenant_id = v_tenant_id
       AND snapshot.meeting_id = v_source_id
       AND snapshot.session_kind = 'NO_SESSION'
       AND snapshot.entity_id = v_entity_id
       AND snapshot.body_id = v_body_id
       AND snapshot.snapshot_type = v_snapshot_type
       AND jsonb_typeof(snapshot.payload) = 'array'
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(snapshot.payload) member
          WHERE member ->> 'effective_date' IS DISTINCT FROM v_effective_date::text
       )
     ORDER BY snapshot.created_at, snapshot.id
     LIMIT 1;

    IF v_snapshot_id IS NULL THEN
      BEGIN
        PERFORM set_config('TimeZone', v_snapshot_timezone, true);
        v_snapshot_id := public.fn_crear_censo_snapshot(
          v_source_id,
          'NO_SESSION',
          v_entity_id,
          v_body_id,
          v_snapshot_type
        );
      EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('TimeZone', v_previous_timezone, true);
        RAISE;
      END;
      PERFORM set_config('TimeZone', v_previous_timezone, true);

      SELECT snapshot.payload, lower(audit.hash_sha512)
        INTO v_snapshot_payload, v_snapshot_hash
        FROM public.censo_snapshot snapshot
        JOIN public.audit_log audit ON audit.id = snapshot.audit_worm_id
       WHERE snapshot.id = v_snapshot_id
         AND snapshot.tenant_id = v_tenant_id;
    END IF;

    IF v_snapshot_hash !~ '^[0-9a-f]{128}$'
       OR jsonb_typeof(v_snapshot_payload) <> 'array' THEN
      RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_CENSUS_WORM_INVALID'
        USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'person_id', eligible.person_id,
             'email', eligible.email,
             'cargo_en_organo', eligible.cargo_en_organo
           ) ORDER BY eligible.person_id), '[]'::jsonb)
      INTO v_authoritative_recipients
      FROM (
        SELECT DISTINCT ON (member ->> 'person_id')
          member ->> 'person_id' AS person_id,
          btrim(COALESCE(person.email, '')) AS email,
          COALESCE(NULLIF(member ->> 'seat_role', ''), 'SOCIO') AS cargo_en_organo
        FROM jsonb_array_elements(v_snapshot_payload) member
        JOIN public.persons person
          ON person.id = (member ->> 'person_id')::uuid
         AND person.tenant_id = v_tenant_id
        WHERE member ->> 'person_id'
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (
            v_snapshot_type = 'POLITICO'
            OR (
              COALESCE((member ->> 'voting_rights')::boolean, false) IS TRUE
              AND COALESCE((member ->> 'voting_weight')::numeric, 0) > 0
            )
          )
        ORDER BY member ->> 'person_id', member ->> 'source_id'
      ) eligible;
  ELSIF v_organo_tipo = 'SOCIO_UNICO' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'person_id', eligible.person_id,
             'email', eligible.email,
             'cargo_en_organo', 'SOCIO'
           ) ORDER BY eligible.person_id), '[]'::jsonb)
      INTO v_authoritative_recipients
      FROM (
        SELECT DISTINCT ON (COALESCE(representation.representative_person_id, holding.holder_person_id))
          COALESCE(representation.representative_person_id, holding.holder_person_id)::text AS person_id,
          btrim(COALESCE(person.email, '')) AS email
        FROM public.capital_holdings holding
        LEFT JOIN public.share_classes share_class ON share_class.id = holding.share_class_id
        LEFT JOIN LATERAL (
          SELECT representation_row.representative_person_id
            FROM public.representaciones representation_row
           WHERE representation_row.represented_person_id = holding.holder_person_id
             AND representation_row.entity_id = holding.entity_id
             AND representation_row.scope = 'ADMIN_PJ_REPRESENTANTE'
             AND representation_row.effective_from <= v_effective_date
             AND (
               representation_row.effective_to IS NULL
               OR representation_row.effective_to >= v_effective_date
             )
           ORDER BY representation_row.effective_from DESC, representation_row.id DESC
           LIMIT 1
        ) representation ON true
        JOIN public.persons person
          ON person.id = COALESCE(
            representation.representative_person_id,
            holding.holder_person_id
          )
         AND person.tenant_id = holding.tenant_id
        WHERE holding.tenant_id = v_tenant_id
          AND holding.entity_id = v_entity_id
          AND holding.effective_from <= v_effective_date
          AND (holding.effective_to IS NULL OR holding.effective_to >= v_effective_date)
          AND holding.voting_rights IS TRUE
          AND holding.is_treasury IS NOT TRUE
          AND COALESCE(share_class.voting_rights, true) IS TRUE
          AND COALESCE(holding.porcentaje_capital, 0) > 0
        ORDER BY
          COALESCE(representation.representative_person_id, holding.holder_person_id),
          holding.id
      ) eligible;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'person_id', eligible.person_id,
             'email', eligible.email,
             'cargo_en_organo', eligible.tipo_condicion
           ) ORDER BY eligible.person_id), '[]'::jsonb)
      INTO v_authoritative_recipients
      FROM (
        SELECT DISTINCT ON (condition.person_id)
          condition.person_id::text AS person_id,
          btrim(COALESCE(person.email, '')) AS email,
          condition.tipo_condicion
        FROM public.condiciones_persona condition
        JOIN public.persons person
          ON person.id = condition.person_id
         AND person.tenant_id = condition.tenant_id
        WHERE condition.tenant_id = v_tenant_id
          AND condition.entity_id = v_entity_id
          AND condition.fecha_inicio <= v_effective_date
          AND (condition.fecha_fin IS NULL OR condition.fecha_fin >= v_effective_date)
          AND (
            condition.estado = 'VIGENTE'
            OR (condition.estado = 'PROGRAMADO' AND v_effective_date > current_date)
            OR (
              condition.estado = 'CESADO'
              AND condition.fecha_fin IS NOT NULL
              AND v_effective_date < current_date
            )
          )
          AND (
            (v_organo_tipo = 'ADMIN_UNICO' AND condition.tipo_condicion = 'ADMIN_UNICO')
            OR (
              v_organo_tipo = 'ADMIN_CONJUNTA'
              AND condition.tipo_condicion = 'ADMIN_MANCOMUNADO'
            )
            OR (
              v_organo_tipo = 'ADMIN_SOLIDARIOS'
              AND condition.tipo_condicion = 'ADMIN_SOLIDARIO'
            )
          )
        ORDER BY condition.person_id, condition.fecha_inicio DESC, condition.id
      ) eligible;
  END IF;

  v_authoritative_count := jsonb_array_length(v_authoritative_recipients);
  IF v_authoritative_count = 0 THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_AUTHORITATIVE_CENSUS_EMPTY'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_authoritative_recipients) recipient
     WHERE NULLIF(btrim(recipient ->> 'email'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_AUTHORITATIVE_CENSUS_EMAIL_MISSING'
      USING ERRCODE = '23514';
  END IF;
  IF COALESCE(v_resolution.total_members, 0) > 0
     AND v_resolution.total_members <> v_authoritative_count THEN
    RAISE EXCEPTION
      'EAD_INTERPOSITION_DRAFT_CENSUS_TOTAL_MISMATCH: resolution=%, authoritative=%',
      v_resolution.total_members,
      v_authoritative_count
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    (
      SELECT recipient ->> 'person_id', lower(btrim(recipient ->> 'email'))
        FROM jsonb_array_elements(v_authoritative_recipients) recipient
      EXCEPT
      SELECT recipient ->> 'person_id', lower(btrim(recipient ->> 'destino_primario'))
        FROM jsonb_array_elements(p_recipients) recipient
    )
    UNION ALL
    (
      SELECT recipient ->> 'person_id', lower(btrim(recipient ->> 'destino_primario'))
        FROM jsonb_array_elements(p_recipients) recipient
      EXCEPT
      SELECT recipient ->> 'person_id', lower(btrim(recipient ->> 'email'))
        FROM jsonb_array_elements(v_authoritative_recipients) recipient
    )
  ) THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_RECIPIENT_CENSUS_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  SELECT communication.* INTO v_existing_communication
    FROM public.communications communication
   WHERE communication.tenant_id = v_tenant_id
     AND communication.metadata #>> '{source,domain}' = v_source_domain
     AND communication.metadata #>> '{source,id}' = v_source_id::text
     AND communication.metadata #>> '{ead_service,mode}' = 'EAD_INTERPOSITION'
   ORDER BY communication.created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    v_communication_id := v_existing_communication.id;
    IF v_existing_communication.estado = 'CANCELADA' THEN
      RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_SOURCE_ALREADY_CANCELLED'
        USING ERRCODE = '23505';
    ELSIF v_existing_communication.estado IS DISTINCT FROM 'BORRADOR'
       OR v_existing_communication.cuerpo_hash_sha512 IS DISTINCT FROM v_body_hash
       OR v_existing_communication.entity_id IS DISTINCT FROM v_entity_id
       OR v_existing_communication.body_id IS DISTINCT FROM v_body_id
       OR v_existing_communication.agreement_id IS DISTINCT FROM v_agreement_id
       OR v_existing_communication.censo_snapshot_id IS DISTINCT FROM v_snapshot_id
       OR v_existing_communication.censo_snapshot_hash_sha512 IS DISTINCT FROM v_snapshot_hash
       OR v_existing_communication.organo_tipo IS DISTINCT FROM v_organo_tipo
       OR v_existing_communication.tipo_comunicacion IS DISTINCT FROM 'CIRCULAR_SIN_SESION'
       OR v_existing_communication.tipo_respuesta_esperada IS DISTINCT FROM 'VOTO'
       OR v_existing_communication.asunto IS DISTINCT FROM v_expected_subject
       OR v_existing_communication.cuerpo_render IS DISTINCT FROM v_expected_body
       OR EXISTS (
         (
           SELECT recipient.person_id::text,
                  lower(btrim(recipient.destino_primario))
             FROM public.communication_recipients recipient
            WHERE recipient.communication_id = v_communication_id
           EXCEPT
           SELECT canonical_recipient ->> 'person_id',
                  lower(btrim(canonical_recipient ->> 'email'))
             FROM jsonb_array_elements(v_authoritative_recipients) canonical_recipient
         )
         UNION ALL
         (
           SELECT canonical_recipient ->> 'person_id',
                  lower(btrim(canonical_recipient ->> 'email'))
             FROM jsonb_array_elements(v_authoritative_recipients) canonical_recipient
           EXCEPT
           SELECT recipient.person_id::text,
                  lower(btrim(recipient.destino_primario))
             FROM public.communication_recipients recipient
            WHERE recipient.communication_id = v_communication_id
         )
       ) THEN
      RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_IDEMPOTENCY_CONFLICT'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_communication_id;
  END IF;

  v_metadata := jsonb_build_object(
    'source', jsonb_build_object('domain', v_source_domain, 'id', v_source_id::text),
    'authoritative_census_count', v_authoritative_count,
    'authoritative_census_effective_date', v_effective_date,
    'authoritative_census_snapshot_id', v_snapshot_id,
    'authoritative_census_snapshot_hash_sha512', v_snapshot_hash,
    'sandbox_only', true,
    'delivery_disabled', true,
    'delivery_allowed', false,
    'dispatch_allowed', false,
    'dispatcher_triggered', false,
    'provider_interaction', false,
    'ead_delivery_mode', NULL,
    'provider_status', 'NOT_REQUESTED',
    'earchive_status', 'NOT_REQUESTED',
    'channel_semantics', jsonb_build_object(
      'requested_minimum', 'EAD_INTERPOSITION',
      'physical_transport', 'EMAIL_NORMAL',
      'recipients', (
        SELECT jsonb_agg(jsonb_build_object(
          'person_id', recipient ->> 'person_id',
          'requested_channel', 'EAD_INTERPOSITION',
          'physical_transport', 'EMAIL_NORMAL'
        ) ORDER BY recipient ->> 'person_id')
        FROM jsonb_array_elements(v_authoritative_recipients) recipient
      )
    ),
    'ead_service', jsonb_build_object(
      'mode', 'EAD_INTERPOSITION',
      'policy_scope', jsonb_build_array('BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING'),
      'environment', 'SANDBOX',
      'delivery_allowed', false,
      'provider_interaction', false,
      'provider_contract_evidence', NULL,
      'signature_claim', false,
      'erds_claim', false
    ),
    'created_via', 'authenticated_user'
  );

  PERFORM set_config('app.secretaria_ead_draft_rpc', 'on', true);
  INSERT INTO public.communications (
    tenant_id, entity_id, body_id, organo_tipo, agreement_id, meeting_id,
    convocatoria_id, template_id, tipo_comunicacion, tipo_respuesta_esperada,
    nivel_certificacion_minimo, asunto, cuerpo_render, cuerpo_hash_sha512,
    estado, fecha_programada, comunicacion_libre, metadata, created_by,
    package_revision, censo_snapshot_id, censo_snapshot_hash_sha512
  ) VALUES (
    v_tenant_id, v_entity_id, v_body_id, v_organo_tipo,
    v_agreement_id, NULL, NULL, NULL, 'CIRCULAR_SIN_SESION', 'VOTO',
    'EMAIL_NORMAL', v_expected_subject, v_expected_body,
    v_body_hash, 'BORRADOR', NULL, false, v_metadata, v_user_id, 1,
    v_snapshot_id, v_snapshot_hash
  ) RETURNING id INTO v_communication_id;

  INSERT INTO public.communication_recipients (
    communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, canal_fallback,
    destino_primario, destino_fallback, delivery_alternative
  )
  SELECT
    v_communication_id,
    (recipient ->> 'person_id')::uuid,
    NULLIF(recipient ->> 'cargo_en_organo', ''),
    'EMAIL_NORMAL', 'EMAIL_NORMAL', NULL,
    btrim(recipient ->> 'email'), NULL, NULL
  FROM jsonb_array_elements(v_authoritative_recipients) recipient;

  UPDATE public.communications
     SET package_hash_sha512 = public.fn_communication_compute_package_hash(id),
         updated_at = now()
   WHERE id = v_communication_id;

  RETURN v_communication_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_ead_interposition_draft(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_ead_interposition_draft(jsonb, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.fn_create_ead_interposition_draft(jsonb, jsonb) IS
  'Registra de forma idempotente un borrador EAD_INTERPOSITION sin firma, ERDS, programación, entrega ni interacción con proveedor.';

-- Cuarentena de cualquier pendiente legacy: ni ERDS ni una intención EAD
-- sandbox pueden adquirir lease del dispatcher. No se reescribe la historia;
-- simplemente se excluye de la cola operativa.
CREATE OR REPLACE FUNCTION public.fn_claim_recipients_for_dispatch(
  p_limit integer DEFAULT 50,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF public.communication_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer := greatest(1, least(COALESCE(p_limit, 50), 200));
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for dispatch claim' USING ERRCODE = '42501';
  END IF;

  -- Un lease vencido tiene resultado externo desconocido. Nunca se reencola.
  -- Los registros ERDS legacy/EAD se dejan intactos y en cuarentena.
  UPDATE public.communication_recipients recipient
     SET estado_entrega = 'RECONCILIATION_REQUIRED',
         ultimo_error = 'dispatch lease expired with unknown provider outcome',
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
    FROM public.communications communication
   WHERE communication.id = recipient.communication_id
     AND recipient.estado_entrega = 'ENVIANDO'
     AND recipient.dispatch_lease_expires_at <= now()
     AND (p_tenant_id IS NULL OR communication.tenant_id = p_tenant_id)
     AND upper(btrim(COALESCE(communication.nivel_certificacion_minimo, '')))
           NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND upper(btrim(COALESCE(recipient.canal_original, '')))
           NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND upper(btrim(COALESCE(recipient.canal_primario, '')))
           NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND upper(btrim(COALESCE(recipient.canal_fallback, '')))
           NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND upper(btrim(COALESCE(recipient.canal_usado, '')))
           NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     AND secretaria_private.fn_has_ead_interposition_marker(communication.metadata) IS NOT TRUE;

  RETURN QUERY
  WITH locked_communications AS MATERIALIZED (
    SELECT candidate_communication.id
      FROM public.communications candidate_communication
     WHERE candidate_communication.estado IN ('PROGRAMADA','ENVIANDO')
       AND candidate_communication.fecha_programada <= now()
       AND candidate_communication.package_hash_sha512 ~ '^[0-9a-f]{128}$'
       AND (p_tenant_id IS NULL OR candidate_communication.tenant_id = p_tenant_id)
       AND upper(btrim(COALESCE(candidate_communication.nivel_certificacion_minimo, '')))
             NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
       AND secretaria_private.fn_has_ead_interposition_marker(
             candidate_communication.metadata
           ) IS NOT TRUE
       AND public.fn_communication_authoritative_binding_valid(
             candidate_communication.id
           ) IS TRUE
       AND EXISTS (
         SELECT 1
           FROM public.communication_recipients pending_recipient
          WHERE pending_recipient.communication_id = candidate_communication.id
            AND pending_recipient.estado_entrega = 'PENDIENTE'
            AND pending_recipient.intento_reenvio_n < 3
            AND upper(btrim(COALESCE(pending_recipient.canal_original, '')))
                  NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
            AND upper(btrim(COALESCE(pending_recipient.canal_primario, '')))
                  NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
            AND upper(btrim(COALESCE(pending_recipient.canal_fallback, '')))
                  NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
            AND upper(btrim(COALESCE(pending_recipient.canal_usado, '')))
                  NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
       )
     ORDER BY candidate_communication.fecha_programada, candidate_communication.id
     LIMIT v_limit
     FOR UPDATE OF candidate_communication SKIP LOCKED
  ), locked_candidates AS MATERIALIZED (
    SELECT candidate.id
      FROM public.communication_recipients candidate
      JOIN locked_communications locked_communication
        ON locked_communication.id = candidate.communication_id
     WHERE candidate.estado_entrega = 'PENDIENTE'
       AND candidate.intento_reenvio_n < 3
       AND upper(btrim(COALESCE(candidate.canal_original, '')))
             NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
       AND upper(btrim(COALESCE(candidate.canal_primario, '')))
             NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
       AND upper(btrim(COALESCE(candidate.canal_fallback, '')))
             NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
       AND upper(btrim(COALESCE(candidate.canal_usado, '')))
             NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     ORDER BY candidate.communication_id, candidate.id
     LIMIT v_limit
     FOR UPDATE OF candidate SKIP LOCKED
  )
  UPDATE public.communication_recipients recipient
     SET estado_entrega = 'ENVIANDO',
         dispatch_attempt_id = gen_random_uuid(),
         dispatch_lease_expires_at = now() + interval '5 minutes',
         provider_idempotency_key = COALESCE(
           recipient.provider_idempotency_key,
           encode(extensions.digest(
             convert_to(
               'COMMUNICATION:' || recipient.communication_id::text
               || ':RECIPIENT:' || recipient.id::text
               || ':PACKAGE:' || communication.package_hash_sha512
               || ':CHANNEL:' || COALESCE(recipient.canal_usado, recipient.canal_primario)
               || ':DESTINATION:' || CASE
                    WHEN COALESCE(recipient.canal_usado, recipient.canal_primario)
                         = recipient.canal_fallback
                      THEN COALESCE(recipient.destino_fallback, recipient.destino_primario)
                    ELSE recipient.destino_primario
                  END,
               'UTF8'
             ),
             'sha256'
           ), 'hex')
         ),
         intento_reenvio_n = recipient.intento_reenvio_n + 1,
         updated_at = now()
    FROM public.communications communication
   WHERE communication.id = recipient.communication_id
     AND recipient.id IN (SELECT locked_candidate.id FROM locked_candidates locked_candidate)
  RETURNING recipient.*;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid)
  TO service_role;

-- Un worker que obtuvo un lease justo antes de esta migración también debe
-- detenerse antes de tocar al proveedor. Esta segunda barrera cubre leases
-- ENVIANDO ya existentes y el canal EMAIL_CERTIFICADO histórico.
CREATE OR REPLACE FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_expected_tenant_id uuid,
  p_body_hash_sha512 text,
  p_package_revision bigint,
  p_package_hash_sha512 text,
  p_verified_attachments jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_communication public.communications%ROWTYPE;
  v_attachment_count integer;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for dispatch revalidation'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_recipient.estado_entrega <> 'ENVIANDO'
     OR v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id
     OR v_recipient.dispatch_lease_expires_at <= now() THEN
    RETURN false;
  END IF;
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = v_recipient.communication_id
   FOR SHARE;
  IF NOT FOUND
     OR v_communication.estado NOT IN ('PROGRAMADA','ENVIANDO')
     OR upper(btrim(COALESCE(v_communication.nivel_certificacion_minimo, '')))
          IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(v_recipient.canal_original, '')))
          IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(v_recipient.canal_primario, '')))
          IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(v_recipient.canal_fallback, '')))
          IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR upper(btrim(COALESCE(v_recipient.canal_usado, '')))
          IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')
     OR secretaria_private.fn_has_ead_interposition_marker(
          v_communication.metadata
        ) IS TRUE
     OR (p_expected_tenant_id IS NOT NULL
         AND v_communication.tenant_id IS DISTINCT FROM p_expected_tenant_id)
     OR v_communication.cuerpo_hash_sha512 IS DISTINCT FROM lower(p_body_hash_sha512)
     OR v_communication.package_revision IS DISTINCT FROM p_package_revision
     OR v_communication.package_hash_sha512 IS DISTINCT FROM lower(p_package_hash_sha512)
     OR public.fn_communication_authoritative_binding_valid(v_communication.id) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(COALESCE(p_verified_attachments, '[]'::jsonb)) <> 'array' THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments attachment
   WHERE attachment.communication_id = v_communication.id;
  IF v_attachment_count <> jsonb_array_length(COALESCE(p_verified_attachments, '[]'::jsonb)) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communication_attachments attachment
     WHERE attachment.communication_id = v_communication.id
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(p_verified_attachments) verified
          WHERE verified ->> 'communication_attachment_id' = attachment.id::text
            AND verified ->> 'source_attachment_id' = attachment.source_attachment_id::text
            AND lower(verified ->> 'hash_sha256') = attachment.hash_sha256
            AND lower(verified ->> 'hash_sha512') = attachment.hash_sha512
            AND verified ->> 'storage_uri' = attachment.storage_uri
       )
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  uuid, uuid, uuid, text, bigint, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  uuid, uuid, uuid, text, bigint, text, jsonb
) TO service_role;

-- Corrige las condiciones tri-valuadas de la migracion legacy: sin el GUC,
-- el UPDATE ordinario debe pasar siempre por el gate y nunca caer entre ambos
-- triggers. La cancelacion gobernada de convocatoria conserva su RPC propia.
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication_insert
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication_update
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_governed_cancel
  ON public.communications;

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_insert
  BEFORE INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication();

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_update
  BEFORE UPDATE ON public.communications
  FOR EACH ROW
  WHEN (NOT COALESCE(
    OLD.estado IN ('BORRADOR', 'PROGRAMADA')
    AND NEW.estado = 'CANCELADA'
    AND current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on',
    false
  ))
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication();

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_governed_cancel
  BEFORE UPDATE ON public.communications
  FOR EACH ROW
  WHEN (COALESCE(
    OLD.estado IN ('BORRADOR', 'PROGRAMADA')
    AND NEW.estado = 'CANCELADA'
    AND current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on',
    false
  ))
  EXECUTE FUNCTION secretaria_private.fn_guard_governed_communication_cancel();

-- La cancelación operativa queda disponible, pero debe atravesar la RPC para
-- que el trigger pueda distinguirla de una edición directa del borrador.
CREATE OR REPLACE FUNCTION public.fn_cancel_communication(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_source_domain text;
  v_source_id text;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'communication not found'; END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_communication.tenant_id);
  IF v_communication.convocatoria_id IS NOT NULL THEN
    RAISE EXCEPTION
      'CONVOCATION_COMMUNICATION_REQUIRES_CONVOCATORIA_LIFECYCLE_RPC'
      USING ERRCODE = '42501',
            HINT = 'Use fn_transition_convocatoria_lifecycle for cancellation.';
  END IF;

  -- Las reejecuciones del alta EAD y su cancelación comparten exactamente la
  -- misma exclusión por fuente. Así el alta no puede devolver un id que esta
  -- transacción convierta simultáneamente en CANCELADA.
  IF secretaria_private.fn_has_ead_interposition_marker(v_communication.metadata) IS TRUE THEN
    v_source_domain := v_communication.metadata #>> '{source,domain}';
    v_source_id := v_communication.metadata #>> '{source,id}';
    IF NULLIF(v_source_domain, '') IS NULL OR NULLIF(v_source_id, '') IS NULL THEN
      RAISE EXCEPTION 'EAD_INTERPOSITION_DRAFT_SOURCE_METADATA_INVALID'
        USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'EAD_INTERPOSITION_DRAFT:' || v_communication.tenant_id::text || ':'
        || v_source_domain || ':' || v_source_id,
      0
    ));
  END IF;

  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id
     AND tenant_id = v_communication.tenant_id
   FOR UPDATE;
  IF NOT FOUND OR v_communication.estado NOT IN ('BORRADOR','PROGRAMADA') THEN
    RAISE EXCEPTION 'communication cannot be cancelled after provider dispatch starts';
  END IF;

  -- El claim bloquea primero esta raíz. No bloqueamos cada recipient aquí:
  -- evita el ciclo root→recipient frente a writers legacy recipient→root. Si
  -- el claim llegó antes, al obtener la raíz ya veremos ENVIANDO; si llegó
  -- después, su SKIP LOCKED no podrá reservar el agregado cancelado.
  IF EXISTS (
    SELECT 1 FROM public.communication_recipients recipient
     WHERE recipient.communication_id = p_communication_id
       AND recipient.estado_entrega = 'ENVIANDO'
  ) THEN
    RAISE EXCEPTION 'active dispatch lease prevents cancellation';
  END IF;
  PERFORM set_config('app.secretaria_communication_lifecycle_rpc', 'on', true);
  UPDATE public.communications
     SET estado = 'CANCELADA', updated_at = now()
   WHERE id = p_communication_id
     AND tenant_id = v_communication.tenant_id;
  RETURN p_communication_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_cancel_communication(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_communication(uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
