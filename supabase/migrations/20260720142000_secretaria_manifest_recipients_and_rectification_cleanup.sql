-- Secretaría — destinatarios canónicos en el manifiesto y limpieza gobernada
-- de una convocatoria rectificada/cancelada.
--
-- El manifiesto sigue siendo una simulación DEMO sin efecto jurídico. EAD
-- Trust se limita a interposición, mensajería básica, custodia y e-archiving;
-- este contrato no afirma firma electrónica ni entrega real.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Snapshot completo de destinatarios antes del guard WORM
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_manifest_enrich_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET timezone = 'Europe/Madrid'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_effective_date date;
  v_body_type text;
  v_excluded_json jsonb;
  v_excluded_ids uuid[] := ARRAY[]::uuid[];
  v_source_count integer;
  v_distinct_count integer;
  v_selected_count integer;
  v_trace_total integer;
  v_trace_selected integer;
  v_recipients jsonb;
  v_recipient_channel text;
  v_ead_requested boolean;
  v_email_requested boolean;
  v_agenda_item jsonb;
  v_accounts_year_count integer;
  v_accounts_year integer;
  v_accounts_deadline date;
  v_accounts_proposal_normalized text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.data_class <> 'DEMO'
     OR NEW.legal_effect <> 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
     OR NEW.manifest_json ->> 'schema_version'
          <> 'secretaria.convocation-manifest.v2' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENTS_REQUIRE_DEMO_V2'
      USING ERRCODE = '23514';
  END IF;

  SELECT convocatoria.*
    INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id
     AND convocatoria.body_id IS NOT NULL;
  IF NOT FOUND OR v_convocatoria.fecha_1 IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENTS_SOURCE_MISSING'
      USING ERRCODE = '23514';
  END IF;

  SELECT pg_catalog.upper(COALESCE(body.body_type, ''))
    INTO v_body_type
    FROM public.governing_bodies body
   WHERE body.id = v_convocatoria.body_id
     AND body.tenant_id = NEW.tenant_id;
  -- El emisor canónico vigente (migración 138) admite exclusivamente CDA.
  -- Fallar con un contrato explícito evita aplicar por accidente el censo
  -- político a una Junta, cuyo censo económico exige otro pipeline.
  IF NOT FOUND OR v_body_type <> 'CDA' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENTS_CDA_ONLY'
      USING ERRCODE = '23514';
  END IF;

  v_effective_date :=
    (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date;

  -- El gate cliente orienta, pero el registro WORM decide. Una formulación
  -- posterior al 31 de marzo solo puede registrarse como regularización
  -- extemporánea expresa y sin pretensión de convalidar el incumplimiento.
  FOR v_agenda_item IN
    SELECT item.value
      FROM pg_catalog.jsonb_array_elements(v_convocatoria.agenda_items) item(value)
  LOOP
    IF v_agenda_item ->> 'materia' = 'FORMULACION_CUENTAS' THEN
      SELECT
        count(DISTINCT matched.parts[1])::integer,
        min((matched.parts[1])::integer)
        INTO v_accounts_year_count, v_accounts_year
        FROM pg_catalog.regexp_matches(
          concat_ws(
            ' ',
            v_agenda_item ->> 'titulo',
            v_agenda_item ->> 'propuesta_acuerdo'
          ),
          '(20[0-9]{2})',
          'g'
        ) AS matched(parts);
      IF v_accounts_year_count = 0 THEN
        RAISE EXCEPTION 'CONVOCATION_ACCOUNTS_FINANCIAL_YEAR_REQUIRED'
          USING ERRCODE = '23514';
      END IF;
      IF v_accounts_year_count <> 1 THEN
        RAISE EXCEPTION 'CONVOCATION_ACCOUNTS_FINANCIAL_YEAR_AMBIGUOUS'
          USING ERRCODE = '23514';
      END IF;
      IF v_accounts_year >= EXTRACT(year FROM v_effective_date)::integer THEN
        RAISE EXCEPTION 'CONVOCATION_ACCOUNTS_FINANCIAL_YEAR_NOT_CLOSED'
          USING ERRCODE = '23514';
      END IF;
      v_accounts_deadline := pg_catalog.make_date(v_accounts_year + 1, 3, 31);
      v_accounts_proposal_normalized := pg_catalog.translate(
        pg_catalog.lower(COALESCE(v_agenda_item ->> 'propuesta_acuerdo', '')),
        'áéíóúüñ',
        'aeiouun'
      );
      IF v_effective_date > v_accounts_deadline
         AND (
           v_accounts_proposal_normalized NOT LIKE '%extemporan%'
           OR v_accounts_proposal_normalized NOT LIKE '%regulariza%'
           OR v_accounts_proposal_normalized NOT LIKE '%sin convalidar%'
         ) THEN
        RAISE EXCEPTION
          'CONVOCATION_ACCOUNTS_LATE_REGULARIZATION_REQUIRED: deadline=%',
          v_accounts_deadline
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  v_excluded_json := CASE
    WHEN pg_catalog.jsonb_typeof(
      v_convocatoria.reminders_trace #> '{recipients,excluded_person_ids}'
    ) = 'array'
      THEN v_convocatoria.reminders_trace #> '{recipients,excluded_person_ids}'
    ELSE '[]'::jsonb
  END;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_excluded_json) excluded(value)
     WHERE pg_catalog.jsonb_typeof(excluded.value) <> 'string'
        OR (excluded.value #>> '{}')
             !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_EXCLUDED_RECIPIENT_INVALID'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
           pg_catalog.array_agg(
             (excluded.value #>> '{}')::uuid
             ORDER BY excluded.value #>> '{}'
           ),
           ARRAY[]::uuid[]
         )
    INTO v_excluded_ids
    FROM pg_catalog.jsonb_array_elements(v_excluded_json) excluded(value);

  IF pg_catalog.cardinality(v_excluded_ids)
       <> (
         SELECT count(DISTINCT excluded_id)
           FROM pg_catalog.unnest(v_excluded_ids) AS excluded(excluded_id)
       ) THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_EXCLUDED_RECIPIENT_DUPLICATE'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.unnest(v_excluded_ids) AS excluded(excluded_id)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.condiciones_persona membership
        WHERE membership.tenant_id = NEW.tenant_id
          AND membership.body_id = v_convocatoria.body_id
         AND membership.person_id = excluded_id
          AND membership.fecha_inicio <= v_effective_date
          AND (membership.fecha_fin IS NULL OR membership.fecha_fin >= v_effective_date)
          AND (
            membership.estado = 'VIGENTE'
            OR (
              membership.estado = 'PROGRAMADO'
              AND v_effective_date > CURRENT_DATE
            )
            OR (
              membership.estado = 'CESADO'
              AND membership.fecha_fin IS NOT NULL
              AND v_effective_date < CURRENT_DATE
            )
          )
          AND membership.tipo_condicion IN (
            'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
          )
          AND COALESCE(membership.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
          AND public.fn_secretaria_is_eligible_board_member_at(
            v_convocatoria.body_id,
            membership.person_id,
            v_effective_date
          )
     )
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_EXCLUDED_RECIPIENT_NOT_IN_CENSUS'
      USING ERRCODE = '23514';
  END IF;

  v_ead_requested := EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(
            NEW.manifest_json #> '{publication,requested_channels}'
          ) = 'array'
            THEN NEW.manifest_json #> '{publication,requested_channels}'
          ELSE '[]'::jsonb
        END
      ) requested(channel)
     WHERE pg_catalog.regexp_replace(
       pg_catalog.upper(pg_catalog.btrim(requested.channel)),
       '^SANDBOX_',
       ''
     ) = 'EAD_INTERPOSITION'
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(
            NEW.manifest_json #> '{publication,sandbox_channels}'
          ) = 'array'
            THEN NEW.manifest_json #> '{publication,sandbox_channels}'
          ELSE '[]'::jsonb
        END
      ) sandbox(channel)
     WHERE pg_catalog.regexp_replace(
       pg_catalog.upper(pg_catalog.btrim(sandbox.channel)),
       '^SANDBOX_',
       ''
     ) = 'EAD_INTERPOSITION'
  );

  v_email_requested := EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(
            NEW.manifest_json #> '{publication,requested_channels}'
          ) = 'array'
            THEN NEW.manifest_json #> '{publication,requested_channels}'
          ELSE '[]'::jsonb
        END
      ) requested(channel)
     WHERE pg_catalog.regexp_replace(
       pg_catalog.upper(pg_catalog.btrim(requested.channel)),
       '^SANDBOX_',
       ''
     ) = 'EMAIL_SIMPLE'
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(
        CASE
          WHEN pg_catalog.jsonb_typeof(
            NEW.manifest_json #> '{publication,sandbox_channels}'
          ) = 'array'
            THEN NEW.manifest_json #> '{publication,sandbox_channels}'
          ELSE '[]'::jsonb
        END
      ) sandbox(channel)
     WHERE pg_catalog.regexp_replace(
       pg_catalog.upper(pg_catalog.btrim(sandbox.channel)),
       '^SANDBOX_',
       ''
     ) = 'EMAIL_SIMPLE'
  );

  IF NOT v_ead_requested AND NOT v_email_requested THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_DIRECT_RECIPIENT_CHANNEL_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  v_recipient_channel := CASE
    WHEN v_ead_requested THEN 'EAD_INTERPOSITION'
    ELSE 'EMAIL_SIMPLE'
  END;

  WITH source_rows AS (
    SELECT
      membership.person_id,
      person.full_name AS name,
      membership.tipo_condicion AS office,
      person.email,
      membership.id AS condition_id
    FROM public.condiciones_persona membership
    JOIN public.persons person
      ON person.id = membership.person_id
     AND person.tenant_id = membership.tenant_id
    WHERE membership.tenant_id = NEW.tenant_id
      AND membership.body_id = v_convocatoria.body_id
      AND membership.fecha_inicio <= v_effective_date
      AND (membership.fecha_fin IS NULL OR membership.fecha_fin >= v_effective_date)
      AND (
        membership.estado = 'VIGENTE'
        OR (
          membership.estado = 'PROGRAMADO'
          AND v_effective_date > CURRENT_DATE
        )
        OR (
          membership.estado = 'CESADO'
          AND membership.fecha_fin IS NOT NULL
          AND v_effective_date < CURRENT_DATE
        )
      )
      AND membership.tipo_condicion IN (
        'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
      )
      AND COALESCE(membership.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
      AND public.fn_secretaria_is_eligible_board_member_at(
        v_convocatoria.body_id,
        membership.person_id,
        v_effective_date
      )
  )
  SELECT
    count(*)::integer,
    count(DISTINCT source.person_id)::integer,
    count(*) FILTER (
      WHERE NOT (source.person_id = ANY(v_excluded_ids))
    )::integer,
    COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'person_id', source.person_id,
          'condition_id', source.condition_id,
          'name', source.name,
          'office', source.office,
          'email', source.email,
          'channel', v_recipient_channel
        )
        ORDER BY
          CASE source.office
            WHEN 'PRESIDENTE' THEN 1
            WHEN 'VICEPRESIDENTE' THEN 2
            WHEN 'CONSEJERO_COORDINADOR' THEN 3
            WHEN 'SECRETARIO' THEN 4
            WHEN 'VICESECRETARIO' THEN 5
            ELSE 10
          END,
          source.name,
          source.person_id
      ) FILTER (WHERE NOT (source.person_id = ANY(v_excluded_ids))),
      '[]'::jsonb
    )
    INTO
      v_source_count,
      v_distinct_count,
      v_selected_count,
      v_recipients
    FROM source_rows source;

  IF v_source_count = 0 OR v_selected_count = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENT_CARDINALITY_ZERO'
      USING ERRCODE = '23514';
  END IF;
  IF v_source_count <> v_distinct_count THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENT_DUPLICATE_PERSON'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.condiciones_persona membership
      JOIN public.persons person
        ON person.id = membership.person_id
       AND person.tenant_id = membership.tenant_id
     WHERE membership.tenant_id = NEW.tenant_id
       AND membership.body_id = v_convocatoria.body_id
       AND membership.fecha_inicio <= v_effective_date
       AND (membership.fecha_fin IS NULL OR membership.fecha_fin >= v_effective_date)
       AND (
         membership.estado = 'VIGENTE'
         OR (
           membership.estado = 'PROGRAMADO'
           AND v_effective_date > CURRENT_DATE
         )
         OR (
           membership.estado = 'CESADO'
           AND membership.fecha_fin IS NOT NULL
           AND v_effective_date < CURRENT_DATE
         )
       )
       AND membership.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND COALESCE(membership.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
       AND public.fn_secretaria_is_eligible_board_member_at(
         v_convocatoria.body_id,
         membership.person_id,
         v_effective_date
       )
       AND (
         membership.person_id IS NULL
         OR pg_catalog.length(pg_catalog.btrim(COALESCE(person.full_name, ''))) = 0
         OR pg_catalog.length(pg_catalog.btrim(COALESCE(membership.tipo_condicion, ''))) = 0
         OR pg_catalog.length(pg_catalog.btrim(COALESCE(person.email, ''))) = 0
       )
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENT_REQUIRED_FIELD_MISSING'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_convocatoria.reminders_trace #>> '{recipients,total_active}', '')
       !~ '^[0-9]+$'
     OR COALESCE(v_convocatoria.reminders_trace #>> '{recipients,selected_count}', '')
       !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENT_TRACE_COUNTS_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  v_trace_total :=
    (v_convocatoria.reminders_trace #>> '{recipients,total_active}')::integer;
  v_trace_selected :=
    (v_convocatoria.reminders_trace #>> '{recipients,selected_count}')::integer;
  IF v_trace_total <> v_source_count
     OR v_trace_selected <> v_selected_count
     OR pg_catalog.jsonb_array_length(v_recipients) <> v_selected_count THEN
    RAISE EXCEPTION 'CONVOCATION_MANIFEST_RECIPIENT_CENSUS_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  NEW.manifest_json := pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        NEW.manifest_json,
        '{renderer_contract_version}',
        pg_catalog.to_jsonb('2026-07-20.3'::text),
        true
      ),
      '{recipient_selection}',
      pg_catalog.jsonb_build_object(
        'schema_version', 'secretaria.convocation-recipient-selection.v1',
        'source', 'condiciones_persona',
        'body_id', v_convocatoria.body_id,
        'effective_date', v_effective_date,
        'total_active', v_source_count,
        'selected_count', v_selected_count,
        'excluded_count', pg_catalog.cardinality(v_excluded_ids),
        'excluded_person_ids', pg_catalog.to_jsonb(v_excluded_ids),
        'seat_roles', pg_catalog.jsonb_build_array(
          'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
        ),
        'seat_semantics', 'PRIMARY_ONLY',
        'temporal_semantics', 'EFFECTIVE_AT_MEETING_DATE'
      ),
      true
    ),
    '{recipients}',
    v_recipients,
    true
  );
  NEW.manifest_hash_sha512 := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(NEW.manifest_json::text, 'UTF8'),
      'sha512'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_manifest_enrich_recipients()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_convocation_manifest_enrich_recipients
  ON public.convocation_manifests;
CREATE TRIGGER trg_00_convocation_manifest_enrich_recipients
  BEFORE INSERT ON public.convocation_manifests
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_manifest_enrich_recipients();

COMMENT ON FUNCTION secretaria_private.fn_convocation_manifest_enrich_recipients() IS
  'Antes del WORM, deriva a fecha_1 el censo VIGENTE completo menos exclusiones trazadas, fija renderer_contract_version y recalcula SHA-512.';

-- ---------------------------------------------------------------------------
-- 2. Toda comunicación DEMO se canoniza como sandbox sin externalidad
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_governed_cancel boolean := false;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_is_demo_sandbox boolean := false;
  v_manifest_ead_requested boolean := false;
  v_canonical_ead_service jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_governed_cancel :=
      OLD.estado IN ('BORRADOR', 'PROGRAMADA')
      AND NEW.estado = 'CANCELADA';
  END IF;

  IF NEW.tipo_comunicacion = 'CONVOCATORIA' THEN
    SELECT manifest.* INTO v_manifest
      FROM public.convocation_manifests manifest
     WHERE manifest.tenant_id = NEW.tenant_id
       AND manifest.convocatoria_id = NEW.convocatoria_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_MANIFEST_REQUIRED'
        USING ERRCODE = '23514';
    END IF;
    v_is_demo_sandbox := COALESCE(
      v_manifest.data_class = 'DEMO'
      AND v_manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
      AND v_manifest.manifest_json #>> '{publication,delivery_mode}' = 'SANDBOX_ONLY'
      AND v_manifest.manifest_json #> '{publication,real_delivery_allowed}'
            = 'false'::jsonb,
      false
    );
    IF NOT v_is_demo_sandbox THEN
      RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_REQUIRES_CANONICAL_DEMO_SANDBOX'
        USING ERRCODE = '23514';
    END IF;
    v_manifest_ead_requested := EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(v_manifest.manifest_json -> 'recipients') = 'array'
              THEN v_manifest.manifest_json -> 'recipients'
            ELSE '[]'::jsonb
          END
        ) recipient
       WHERE recipient ->> 'channel' = 'EAD_INTERPOSITION'
    );
    v_canonical_ead_service := jsonb_build_object(
      'mode', 'EAD_INTERPOSITION',
      'policy_scope', jsonb_build_array(
        'BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING'
      ),
      'environment', 'SANDBOX',
      'delivery_allowed', false,
      'provider_interaction', false,
      'provider_contract_evidence', NULL,
      'signature_claim', false,
      'erds_claim', false
    );
    IF v_manifest_ead_requested THEN
      IF NEW.metadata #> '{ead_service}'
           IS DISTINCT FROM v_canonical_ead_service THEN
        RAISE EXCEPTION 'CONVOCATION_EAD_SERVICE_CANONICAL_METADATA_REQUIRED'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.metadata ? 'ead_service'
       AND NEW.metadata -> 'ead_service' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'CONVOCATION_NON_EAD_CANNOT_ASSERT_EAD_SERVICE'
        USING ERRCODE = '23514';
    END IF;

    -- Los flags ausentes se derivan del manifiesto, no se exigen como claims
    -- del cliente. Cualquier contradicción explícita sí aborta antes de que el
    -- trigger imponga el objeto canónico sin externalidad.
    IF (NEW.metadata ? 'sandbox_only'
          AND NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb)
       OR (NEW.metadata ? 'delivery_disabled'
          AND NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb)
       OR (NEW.metadata ? 'delivery_allowed'
          AND NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'dispatch_allowed'
          AND NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'dispatcher_triggered'
          AND NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'provider_interaction'
          AND NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'ead_delivery_mode'
          AND NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb) THEN
      RAISE EXCEPTION 'CONVOCATION_DEMO_SANDBOX_METADATA_CONTRADICTION'
        USING ERRCODE = '23514';
    END IF;
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'sandbox_only', true,
      'delivery_disabled', true,
      'delivery_allowed', false,
      'dispatch_allowed', false,
      'dispatcher_triggered', false,
      'provider_interaction', false,
      'ead_delivery_mode', NULL
    );
    IF v_manifest_ead_requested THEN
      NEW.metadata := NEW.metadata || jsonb_build_object(
        'ead_service', v_canonical_ead_service
      );
    ELSE
      NEW.metadata := NEW.metadata - 'ead_service';
    END IF;
    NEW.nivel_certificacion_minimo := 'EMAIL_NORMAL';

    IF (NEW.estado <> 'BORRADOR' AND NOT v_governed_cancel)
       OR NEW.fecha_programada IS NOT NULL
       OR NEW.fecha_envio_efectiva IS NOT NULL
       OR NEW.fecha_limite_respuesta IS NOT NULL
       OR NEW.tiene_rebotes IS TRUE
       OR upper(btrim(COALESCE(NEW.nivel_certificacion_minimo, '')))
            IS DISTINCT FROM 'EMAIL_NORMAL'
       OR NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb
       OR NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
       OR NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
       OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(NEW.metadata) IS TRUE
       OR (
         NEW.metadata #>> '{ead_service,mode}' = 'EAD_INTERPOSITION'
         AND (
           NEW.metadata #> '{ead_service,delivery_allowed}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,provider_interaction}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,signature_claim}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,erds_claim}' IS DISTINCT FROM 'false'::jsonb
         )
       ) THEN
      RAISE EXCEPTION
        'DEMO convocation communication is immutable as BORRADOR/no-dispatch except governed lifecycle cancellation'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  TO service_role;

-- Toda alta de una comunicación de convocatoria comparte el mismo lock que
-- su transición de ciclo de vida. Así ninguna transacción puede insertar un
-- BORRADOR residual después de que la convocatoria haya sido rectificada o
-- cancelada, aunque llegue por una RPC legacy o por INSERT directo.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_communication_convocation_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria_tenant uuid;
  v_convocatoria_estado text;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN NEW;
  END IF;
  IF NEW.convocatoria_id IS NULL OR NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_BINDING_REQUIRED'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'COMMUNICATION:CONVOCATORIA:'
      || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
    0
  ));

  SELECT convocatoria.tenant_id, convocatoria.estado
    INTO v_convocatoria_tenant, v_convocatoria_estado
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id;
  IF NOT FOUND
     OR v_convocatoria_tenant IS DISTINCT FROM NEW.tenant_id
     OR v_convocatoria_estado <> 'EMITIDA' THEN
    RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_REQUIRES_EMITTED_SOURCE'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_communication_convocation_state()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_communication_convocation_state_guard
  ON public.communications;
CREATE TRIGGER trg_00_communication_convocation_state_guard
  BEFORE INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_communication_convocation_state();

-- El snapshot hereda TimeZone para sus casts a date y CURRENT_DATE. Se
-- resuelve por jurisdicción únicamente durante esta llamada y se restaura
-- incluso ante error; nunca se altera globalmente la función multi-país.
CREATE OR REPLACE FUNCTION public.fn_communication_prepare_census(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_body_type text;
  v_jurisdiction text;
  v_snapshot_timezone text;
  v_previous_timezone text;
  v_snapshot_type text;
  v_snapshot_id uuid;
  v_snapshot_hash text;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication not found';
  END IF;
  IF v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN NULL;
  END IF;
  IF v_communication.estado <> 'BORRADOR'
     OR v_communication.meeting_id IS NULL
     OR v_communication.body_id IS NULL THEN
    RAISE EXCEPTION 'convocatoria census can only be fixed in BORRADOR with linked meeting';
  END IF;
  IF v_communication.censo_snapshot_id IS NOT NULL THEN
    RETURN v_communication.censo_snapshot_id;
  END IF;

  SELECT
    upper(COALESCE(body.body_type, '')),
    upper(COALESCE(entity.jurisdiction, ''))
    INTO v_body_type, v_jurisdiction
    FROM public.governing_bodies body
    JOIN public.entities entity
      ON entity.id = body.entity_id
     AND entity.tenant_id = body.tenant_id
   WHERE body.id = v_communication.body_id
     AND body.tenant_id = v_communication.tenant_id
     AND body.entity_id = v_communication.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication body scope mismatch';
  END IF;
  v_snapshot_type := CASE
    WHEN v_body_type IN (
      'JUNTA','JGA','JUNTA_GENERAL','JUNTA_GENERAL_ACCIONISTAS',
      'JUNTA_GENERAL_SOCIOS'
    ) OR v_body_type LIKE 'JUNTA%'
      THEN 'ECONOMICO'
    WHEN v_body_type IN (
      'CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION','COMISION','COMITE'
    ) OR v_body_type LIKE '%CONSEJO%'
      THEN 'POLITICO'
    ELSE NULL
  END;
  IF v_snapshot_type IS NULL THEN
    RAISE EXCEPTION 'communication body has no authoritative census source';
  END IF;
  v_snapshot_timezone := CASE v_jurisdiction
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'PT' THEN 'Europe/Lisbon'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'MX' THEN 'America/Mexico_City'
    ELSE 'UTC'
  END;
  v_previous_timezone := current_setting('TimeZone');
  BEGIN
    PERFORM set_config('TimeZone', v_snapshot_timezone, true);
    v_snapshot_id := public.fn_crear_censo_snapshot(
      v_communication.meeting_id,
      'MEETING',
      v_communication.entity_id,
      v_communication.body_id,
      v_snapshot_type
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('TimeZone', v_previous_timezone, true);
    RAISE;
  END;
  PERFORM set_config('TimeZone', v_previous_timezone, true);

  SELECT lower(audit.hash_sha512)
    INTO v_snapshot_hash
    FROM public.censo_snapshot snapshot
    JOIN public.audit_log audit ON audit.id = snapshot.audit_worm_id
   WHERE snapshot.id = v_snapshot_id
     AND snapshot.tenant_id = v_communication.tenant_id;
  IF v_snapshot_hash !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'communication census WORM hash is missing';
  END IF;

  UPDATE public.communications
     SET censo_snapshot_id = v_snapshot_id,
         censo_snapshot_hash_sha512 = v_snapshot_hash,
         package_revision = package_revision + 1,
         updated_at = now()
   WHERE id = p_communication_id
     AND tenant_id = v_communication.tenant_id;
  RETURN v_snapshot_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_communication_prepare_census(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- El snapshot WORM conserva el censo político completo; la comunicación de
-- una convocatoria, en cambio, debe coincidir exactamente con la selección
-- WORM del manifiesto (incluidas sus exclusiones), nunca con una reconsulta de
-- cliente. Las exclusiones se validan como la diferencia exacta entre ambos.
CREATE OR REPLACE FUNCTION public.fn_communication_census_binding_valid(
  p_communication_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_snapshot public.censo_snapshot%ROWTYPE;
  v_snapshot_hash text;
  v_manifest_json jsonb;
  v_manifest_recipients jsonb;
  v_selection jsonb;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND OR v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN v_communication.id IS NOT NULL;
  END IF;

  SELECT snapshot.* INTO v_snapshot
    FROM public.censo_snapshot snapshot
   WHERE snapshot.id = v_communication.censo_snapshot_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  SELECT lower(audit.hash_sha512) INTO v_snapshot_hash
    FROM public.audit_log audit
   WHERE audit.id = v_snapshot.audit_worm_id;

  SELECT manifest.manifest_json INTO v_manifest_json
    FROM public.convocation_manifests manifest
   WHERE manifest.tenant_id = v_communication.tenant_id
     AND manifest.convocatoria_id = v_communication.convocatoria_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  v_manifest_recipients := v_manifest_json -> 'recipients';
  v_selection := v_manifest_json -> 'recipient_selection';

  IF v_snapshot.tenant_id IS DISTINCT FROM v_communication.tenant_id
     OR v_snapshot.entity_id IS DISTINCT FROM v_communication.entity_id
     OR v_snapshot.body_id IS DISTINCT FROM v_communication.body_id
     OR v_snapshot.meeting_id IS DISTINCT FROM v_communication.meeting_id
     OR v_snapshot.session_kind <> 'MEETING'
     OR v_snapshot_hash IS DISTINCT FROM v_communication.censo_snapshot_hash_sha512
     OR jsonb_typeof(v_snapshot.payload) <> 'array'
     OR jsonb_typeof(v_manifest_recipients) <> 'array'
     OR jsonb_typeof(v_selection) <> 'object'
     OR v_selection ->> 'schema_version'
          <> 'secretaria.convocation-recipient-selection.v1'
     OR v_selection ->> 'source' <> 'condiciones_persona'
     OR COALESCE(v_selection ->> 'effective_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR jsonb_typeof(v_selection -> 'excluded_person_ids') <> 'array' THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_snapshot.payload) member
     WHERE COALESCE(member ->> 'person_id', '')
             !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR member ->> 'effective_date' IS DISTINCT FROM v_selection ->> 'effective_date'
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_manifest_recipients) recipient
     WHERE COALESCE(recipient ->> 'person_id', '')
             !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(recipient ->> 'condition_id', '')
             !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RETURN false;
  END IF;

  IF (v_selection ->> 'total_active')::integer IS DISTINCT FROM (
       SELECT count(DISTINCT (member ->> 'person_id')::uuid)::integer
         FROM jsonb_array_elements(v_snapshot.payload) member
     )
     OR (v_selection ->> 'selected_count')::integer
          IS DISTINCT FROM jsonb_array_length(v_manifest_recipients)
     OR (v_selection ->> 'excluded_count')::integer
          IS DISTINCT FROM jsonb_array_length(v_selection -> 'excluded_person_ids') THEN
    RETURN false;
  END IF;

  -- Comunicación = selección del manifiesto, en ambos sentidos.
  IF EXISTS (
    SELECT (recipient ->> 'person_id')::uuid
      FROM jsonb_array_elements(v_manifest_recipients) recipient
    EXCEPT
    SELECT recipient.person_id
      FROM public.communication_recipients recipient
     WHERE recipient.communication_id = v_communication.id
  ) OR EXISTS (
    SELECT recipient.person_id
      FROM public.communication_recipients recipient
     WHERE recipient.communication_id = v_communication.id
    EXCEPT
    SELECT (manifest_recipient ->> 'person_id')::uuid
      FROM jsonb_array_elements(v_manifest_recipients) manifest_recipient
  ) THEN
    RETURN false;
  END IF;

  -- Selección contenida en el censo completo.
  IF EXISTS (
    SELECT (recipient ->> 'person_id')::uuid
      FROM jsonb_array_elements(v_manifest_recipients) recipient
    EXCEPT
    SELECT DISTINCT (member ->> 'person_id')::uuid
      FROM jsonb_array_elements(v_snapshot.payload) member
  ) THEN
    RETURN false;
  END IF;

  -- La misma persona no basta: condición y cargo deben ser exactamente los
  -- congelados por el censo WORM y por el manifiesto.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_manifest_recipients) manifest_recipient
      LEFT JOIN jsonb_array_elements(v_snapshot.payload) member
        ON member ->> 'person_id' = manifest_recipient ->> 'person_id'
       AND member ->> 'source_id' = manifest_recipient ->> 'condition_id'
       AND member ->> 'seat_role' = manifest_recipient ->> 'office'
     WHERE member ->> 'person_id' IS NULL
  ) OR EXISTS (
    SELECT 1
      FROM public.communication_recipients recipient
      JOIN jsonb_array_elements(v_manifest_recipients) manifest_recipient
        ON (manifest_recipient ->> 'person_id')::uuid = recipient.person_id
     WHERE recipient.communication_id = v_communication.id
       AND recipient.cargo_en_organo IS DISTINCT FROM manifest_recipient ->> 'office'
  ) THEN
    RETURN false;
  END IF;

  -- El canal EAD vive como intención semántica en metadata; las columnas
  -- legacy permanecen EMAIL_NORMAL para no afirmar entrega certificada.
  IF jsonb_typeof(v_communication.metadata #> '{channel_semantics,recipients}') <> 'array'
     OR jsonb_array_length(
          v_communication.metadata #> '{channel_semantics,recipients}'
        ) <> jsonb_array_length(v_manifest_recipients)
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(
           v_communication.metadata #> '{channel_semantics,recipients}'
         ) intent
        GROUP BY intent ->> 'person_id'
       HAVING count(*) <> 1
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(v_manifest_recipients) manifest_recipient
        WHERE NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(
              v_communication.metadata #> '{channel_semantics,recipients}'
            ) intent
           WHERE intent ->> 'person_id' = manifest_recipient ->> 'person_id'
             AND intent ->> 'canal_primario' = manifest_recipient ->> 'channel'
             AND NULLIF(intent ->> 'canal_fallback', '') IS NULL
        )
     ) OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(
           v_communication.metadata #> '{channel_semantics,recipients}'
         ) intent
         WHERE NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(v_manifest_recipients) manifest_recipient
           WHERE manifest_recipient ->> 'person_id' = intent ->> 'person_id'
             AND manifest_recipient ->> 'channel' = intent ->> 'canal_primario'
             AND NULLIF(intent ->> 'canal_fallback', '') IS NULL
         )
     ) THEN
    RETURN false;
  END IF;

  -- Excluidos = censo completo menos selección, exactamente.
  IF EXISTS (
    (
      SELECT DISTINCT (member ->> 'person_id')::uuid
        FROM jsonb_array_elements(v_snapshot.payload) member
      EXCEPT
      SELECT (recipient ->> 'person_id')::uuid
        FROM jsonb_array_elements(v_manifest_recipients) recipient
    )
    EXCEPT
    SELECT (excluded.value #>> '{}')::uuid
      FROM jsonb_array_elements(v_selection -> 'excluded_person_ids') excluded(value)
  ) OR EXISTS (
    SELECT (excluded.value #>> '{}')::uuid
      FROM jsonb_array_elements(v_selection -> 'excluded_person_ids') excluded(value)
    EXCEPT
    (
      SELECT DISTINCT (member ->> 'person_id')::uuid
        FROM jsonb_array_elements(v_snapshot.payload) member
      EXCEPT
      SELECT (recipient ->> 'person_id')::uuid
        FROM jsonb_array_elements(v_manifest_recipients) recipient
    )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communication_recipients recipient
      JOIN jsonb_array_elements(v_manifest_recipients) manifest_recipient
        ON (manifest_recipient ->> 'person_id')::uuid = recipient.person_id
      LEFT JOIN public.persons person
        ON person.id = recipient.person_id
       AND person.tenant_id = v_communication.tenant_id
     WHERE recipient.communication_id = v_communication.id
       AND (
         person.id IS NULL
         OR length(btrim(COALESCE(manifest_recipient ->> 'email', ''))) = 0
         OR lower(btrim(recipient.destino_primario))
              IS DISTINCT FROM lower(btrim(manifest_recipient ->> 'email'))
         OR lower(btrim(person.email))
              IS DISTINCT FROM lower(btrim(manifest_recipient ->> 'email'))
         OR upper(btrim(COALESCE(recipient.canal_original, '')))
              IS DISTINCT FROM 'EMAIL_NORMAL'
         OR upper(btrim(COALESCE(recipient.canal_primario, '')))
              IS DISTINCT FROM 'EMAIL_NORMAL'
         OR recipient.canal_fallback IS NOT NULL
         OR recipient.destino_fallback IS NOT NULL
         OR recipient.delivery_alternative IS NOT NULL
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_communication_census_binding_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_validate_finalized_convocation_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.tipo_comunicacion = 'CONVOCATORIA'
     AND NEW.package_hash_sha512 IS NOT NULL
     AND NEW.package_hash_sha512 IS DISTINCT FROM OLD.package_hash_sha512
     AND public.fn_communication_census_binding_valid(NEW.id) IS NOT TRUE THEN
    RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_MANIFEST_RECIPIENT_BINDING_INVALID'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_validate_finalized_convocation_package()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_90_validate_finalized_convocation_package
  ON public.communications;
CREATE TRIGGER trg_90_validate_finalized_convocation_package
  BEFORE UPDATE OF package_hash_sha512 ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_validate_finalized_convocation_package();

-- El claim del dispatcher bloquea primero el destinatario. Este guard toma el
-- advisory lock de la convocatoria antes de permitir PENDIENTE -> ENVIANDO y
-- revalida el root; así una rectificación concurrente gana de forma atómica y
-- el claim se revierte, sin invertir el orden de row locks ni crear deadlocks.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_convocation_dispatch_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_convocatoria_estado text;
BEGIN
  IF NEW.estado_entrega <> 'ENVIANDO'
     OR OLD.estado_entrega = 'ENVIANDO' THEN
    RETURN NEW;
  END IF;
  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = NEW.communication_id;
  IF NOT FOUND OR v_communication.convocatoria_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'COMMUNICATION:CONVOCATORIA:'
      || v_communication.tenant_id::text || ':'
      || v_communication.convocatoria_id::text,
    0
  ));
  SELECT convocatoria.estado INTO v_convocatoria_estado
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = v_communication.convocatoria_id
     AND convocatoria.tenant_id = v_communication.tenant_id
   FOR SHARE;
  IF NOT FOUND OR v_convocatoria_estado <> 'EMITIDA' THEN
    RAISE EXCEPTION 'CONVOCATION_DISPATCH_CLAIM_SOURCE_NOT_ACTIVE'
      USING ERRCODE = '40001';
  END IF;
  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = NEW.communication_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_communication.estado NOT IN ('PROGRAMADA', 'ENVIANDO')
     OR v_communication.metadata -> 'sandbox_only' = 'true'::jsonb THEN
    RAISE EXCEPTION 'CONVOCATION_DISPATCH_CLAIM_SOURCE_NOT_ACTIVE'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_convocation_dispatch_claim()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_guard_convocation_dispatch_claim
  ON public.communication_recipients;
CREATE TRIGGER trg_00_guard_convocation_dispatch_claim
  BEFORE UPDATE OF estado_entrega ON public.communication_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_convocation_dispatch_claim();

-- ---------------------------------------------------------------------------
-- 3. La FSM de comunicaciones conserva su verdad histórica: solo un BORRADOR
--    o una PROGRAMADA pueden cancelarse. La transición gobernada no crea un
--    bypass para estados en dispatch, entregados, respondidos o terminales.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_communication_dispatch_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'communications must be inserted as BORRADOR'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (
      (OLD.estado = 'BORRADOR' AND NEW.estado IN ('PROGRAMADA','CANCELADA'))
      OR (OLD.estado = 'PROGRAMADA' AND NEW.estado IN (
        'ENVIANDO','ERROR','CANCELADA','RECONCILIATION_REQUIRED'
      ))
      OR (OLD.estado = 'ENVIANDO' AND NEW.estado IN (
        'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
        'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','EXPIRADA','ERROR',
        'RECONCILIATION_REQUIRED'
      ))
      OR (OLD.estado = 'ENVIADA' AND NEW.estado IN (
        'ENTREGADA_PARCIAL','ENTREGADA_TOTAL','RESPONDIDA_PARCIAL',
        'RESPONDIDA_TOTAL','EXPIRADA','ERROR','RECONCILIATION_REQUIRED'
      ))
      OR (OLD.estado = 'ENTREGADA_PARCIAL'
          AND NEW.estado IN (
            'PROGRAMADA','ENTREGADA_TOTAL','RESPONDIDA_PARCIAL',
            'RESPONDIDA_TOTAL','EXPIRADA','ERROR','RECONCILIATION_REQUIRED'
          ))
      OR (OLD.estado = 'ENTREGADA_TOTAL'
          AND NEW.estado IN ('RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','EXPIRADA'))
      OR (OLD.estado = 'RESPONDIDA_PARCIAL'
          AND NEW.estado IN ('RESPONDIDA_TOTAL','EXPIRADA','ERROR'))
      OR (OLD.estado = 'ERROR'
          AND NEW.estado IN (
            'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
            'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','RECONCILIATION_REQUIRED'
          ))
      OR (OLD.estado = 'RECONCILIATION_REQUIRED'
          AND NEW.estado IN (
            'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
            'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','ERROR'
          ))
    ) THEN
    RAISE EXCEPTION 'invalid communication state transition % -> %', OLD.estado, NEW.estado
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado <> 'BORRADOR' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
    OR NEW.body_id IS DISTINCT FROM OLD.body_id
    OR NEW.organo_tipo IS DISTINCT FROM OLD.organo_tipo
    OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
    OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
    OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.tipo_comunicacion IS DISTINCT FROM OLD.tipo_comunicacion
    OR NEW.tipo_respuesta_esperada IS DISTINCT FROM OLD.tipo_respuesta_esperada
    OR NEW.nivel_certificacion_minimo IS DISTINCT FROM OLD.nivel_certificacion_minimo
    OR NEW.asunto IS DISTINCT FROM OLD.asunto
    OR NEW.cuerpo_render IS DISTINCT FROM OLD.cuerpo_render
    OR NEW.cuerpo_hash_sha512 IS DISTINCT FROM OLD.cuerpo_hash_sha512
    OR NEW.fecha_programada IS DISTINCT FROM OLD.fecha_programada
    OR NEW.plazo_legal_dias IS DISTINCT FROM OLD.plazo_legal_dias
    OR NEW.fecha_limite_respuesta IS DISTINCT FROM OLD.fecha_limite_respuesta
    OR NEW.comunicacion_libre IS DISTINCT FROM OLD.comunicacion_libre
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.censo_snapshot_id IS DISTINCT FROM OLD.censo_snapshot_id
    OR NEW.censo_snapshot_hash_sha512 IS DISTINCT FROM OLD.censo_snapshot_hash_sha512
    OR NEW.package_revision IS DISTINCT FROM OLD.package_revision
    OR NEW.package_hash_sha512 IS DISTINCT FROM OLD.package_hash_sha512
  ) THEN
    RAISE EXCEPTION 'communication package is immutable after BORRADOR'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado = 'PROGRAMADA' AND OLD.estado IS DISTINCT FROM 'PROGRAMADA' THEN
    IF NEW.fecha_programada IS NULL THEN
      RAISE EXCEPTION 'scheduled communication requires fecha_programada';
    END IF;
    PERFORM public.fn_communication_assert_authoritative_binding(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_communication_dispatch_gate()
  FROM PUBLIC, anon, authenticated, service_role;

-- Programar comparte el orden global de locks de lifecycle/cancel/claim:
-- lectura de alcance sin lock -> advisory de convocatoria -> root FOR UPDATE.
-- La implementación heredada bloqueaba primero el root y podía entrar en
-- deadlock con una rectificación concurrente.
CREATE OR REPLACE FUNCTION public.fn_program_communication(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_lock_tenant_id uuid;
  v_lock_convocatoria_id uuid;
BEGIN
  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = p_communication_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication not found';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(
    v_communication.tenant_id
  );
  v_lock_tenant_id := v_communication.tenant_id;
  v_lock_convocatoria_id := v_communication.convocatoria_id;

  IF v_lock_convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_lock_tenant_id::text
      || ':' || v_lock_convocatoria_id::text,
      0
    ));
  END IF;

  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = p_communication_id
     AND communication.tenant_id = v_lock_tenant_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_communication.convocatoria_id IS DISTINCT FROM v_lock_convocatoria_id THEN
    RAISE EXCEPTION 'communication scope changed while acquiring lock'
      USING ERRCODE = '40001';
  END IF;
  IF v_communication.estado <> 'BORRADOR' THEN
    RAISE EXCEPTION 'only BORRADOR can be programmed';
  END IF;
  IF v_communication.fecha_programada IS NULL THEN
    RAISE EXCEPTION 'fecha_programada required';
  END IF;
  IF v_communication.metadata -> 'sandbox_only' = 'true'::jsonb THEN
    RAISE EXCEPTION 'sandbox communication cannot be programmed'
      USING ERRCODE = '23514';
  END IF;
  IF v_lock_convocatoria_id IS NOT NULL THEN
    PERFORM public.fn_communication_prepare_census(v_communication.id);
  END IF;
  UPDATE public.communications
     SET package_hash_sha512 = public.fn_communication_compute_package_hash(id),
         updated_at = now()
   WHERE id = p_communication_id
     AND tenant_id = v_lock_tenant_id;
  PERFORM public.fn_communication_assert_authoritative_binding(
    p_communication_id
  );
  UPDATE public.communications
     SET estado = 'PROGRAMADA', updated_at = now()
   WHERE id = p_communication_id
     AND tenant_id = v_lock_tenant_id;
  RETURN p_communication_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_program_communication(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_program_communication(uuid)
  TO authenticated, service_role;

-- Un reintento es una nueva externalidad. Resuelve primero el alcance, toma
-- el advisory de la convocatoria y solo después bloquea root y destinatario;
-- una fuente cancelada/rectificada o un sandbox DEMO nunca se reactiva.
CREATE OR REPLACE FUNCTION public.fn_retry_communication_recipient(
  p_recipient_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_communication public.communications%ROWTYPE;
  v_tenant_id uuid;
  v_communication_id uuid;
  v_convocatoria_id uuid;
  v_convocatoria_estado text;
BEGIN
  SELECT communication.tenant_id, communication.id, communication.convocatoria_id
    INTO v_tenant_id, v_communication_id, v_convocatoria_id
    FROM public.communication_recipients recipient
    JOIN public.communications communication
      ON communication.id = recipient.communication_id
   WHERE recipient.id = p_recipient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipient not found';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_tenant_id);

  IF v_convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_tenant_id::text
      || ':' || v_convocatoria_id::text,
      0
    ));
    SELECT convocatoria.estado INTO v_convocatoria_estado
      FROM public.convocatorias convocatoria
     WHERE convocatoria.id = v_convocatoria_id
       AND convocatoria.tenant_id = v_tenant_id
     FOR SHARE;
    IF NOT FOUND OR v_convocatoria_estado <> 'EMITIDA' THEN
      RAISE EXCEPTION 'CONVOCATION_RETRY_SOURCE_NOT_ACTIVE'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  SELECT communication.* INTO v_communication
    FROM public.communications communication
   WHERE communication.id = v_communication_id
     AND communication.tenant_id = v_tenant_id
     AND communication.convocatoria_id IS NOT DISTINCT FROM v_convocatoria_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_communication.metadata -> 'sandbox_only' = 'true'::jsonb THEN
    RAISE EXCEPTION 'communication cannot be retried from inactive or sandbox source'
      USING ERRCODE = '40001';
  END IF;

  SELECT recipient.* INTO v_recipient
    FROM public.communication_recipients recipient
   WHERE recipient.id = p_recipient_id
     AND recipient.communication_id = v_communication_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_recipient.estado_entrega NOT IN ('ERROR','REBOTADO') THEN
    RAISE EXCEPTION 'only a definitive ERROR or REBOTADO recipient may be retried';
  END IF;
  IF v_recipient.estado_entrega = 'REBOTADO'
     AND (
       v_recipient.canal_fallback IS NULL
       OR v_recipient.canal_usado IS NOT DISTINCT FROM v_recipient.canal_fallback
     ) THEN
    RAISE EXCEPTION
      'a bounced terminal channel requires a new governed communication; no unused fallback remains';
  END IF;
  UPDATE public.communication_recipients
     SET estado_entrega = 'PENDIENTE',
         canal_usado = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN v_recipient.canal_fallback
           ELSE v_recipient.canal_usado
         END,
         intento_reenvio_n = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN 0
           ELSE v_recipient.intento_reenvio_n
         END,
         provider_idempotency_key = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN NULL
           ELSE v_recipient.provider_idempotency_key
         END,
         ultimo_error = NULL,
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_recipient_id
     AND communication_id = v_communication_id;
  RETURN p_recipient_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_retry_communication_recipient(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_retry_communication_recipient(uuid)
  TO authenticated, service_role;

-- Mantiene el mismo orden global de locks que lifecycle/claim:
-- advisory de convocatoria -> root de comunicación -> comprobación de leases.
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
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'communication not found'; END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_communication.tenant_id);
  IF v_communication.convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_communication.tenant_id::text
      || ':' || v_communication.convocatoria_id::text,
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
  IF EXISTS (
    SELECT 1 FROM public.communication_recipients recipient
     WHERE recipient.communication_id = p_communication_id
       AND recipient.estado_entrega = 'ENVIANDO'
  ) THEN
    RAISE EXCEPTION 'active dispatch lease prevents cancellation';
  END IF;
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

-- ---------------------------------------------------------------------------
-- 4. El evento WORM incorpora los resultados de limpieza en su propio hash
-- ---------------------------------------------------------------------------

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
  v_communications_cancelled integer;
  v_communications_preserved integer;
  v_meetings_cancelled integer;
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

  IF COALESCE(NEW.event_payload ->> 'communications_cancelled', '') !~ '^[0-9]+$'
     OR COALESCE(NEW.event_payload ->> 'communications_preserved', '') !~ '^[0-9]+$'
     OR COALESCE(NEW.event_payload ->> 'meetings_cancelled', '') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_CLEANUP_COUNTS_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  v_communications_cancelled :=
    (NEW.event_payload ->> 'communications_cancelled')::integer;
  v_communications_preserved :=
    (NEW.event_payload ->> 'communications_preserved')::integer;
  v_meetings_cancelled :=
    (NEW.event_payload ->> 'meetings_cancelled')::integer;

  IF v_manifest.id IS NULL
    OR v_act.id IS NULL
    OR v_manifest.act_id IS DISTINCT FROM v_act.id
    OR v_manifest.act_hash_sha512 IS DISTINCT FROM v_act.act_hash_sha512
    OR NEW.from_state <> 'EMITIDA'
    OR NEW.to_state NOT IN ('CANCELADA', 'RECTIFICADA')
    OR pg_catalog.length(pg_catalog.btrim(COALESCE(NEW.reason, ''))) < 10
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
    'schema_version', 'secretaria.convocation-lifecycle-event.v3',
    'convocatoria_id', NEW.convocatoria_id,
    'tenant_id', NEW.tenant_id,
    'manifest_id', NEW.manifest_id,
    'manifest_hash_sha512', v_manifest.manifest_hash_sha512,
    'act_id', NEW.act_id,
    'act_hash_sha512', v_act.act_hash_sha512,
    'from_state', NEW.from_state,
    'to_state', NEW.to_state,
    'reason', NEW.reason,
    'communications_cancelled', v_communications_cancelled,
    'communications_preserved', v_communications_preserved,
    'meetings_cancelled', v_meetings_cancelled,
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
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_lifecycle_event_worm_guard()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION secretaria_private.fn_meeting_linked_to_convocation(
  p_meeting_id uuid,
  p_tenant_id uuid,
  p_convocatoria_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.meetings meeting
     WHERE meeting.id = p_meeting_id
       AND meeting.tenant_id = p_tenant_id
       AND (
         EXISTS (
           SELECT 1
             FROM public.agenda_items item
            WHERE item.meeting_id = meeting.id
              AND item.tenant_id = meeting.tenant_id
              AND item.source_convocatoria_id = p_convocatoria_id
         )
         OR meeting.quorum_data #>> '{agenda_binding,convocatoria_id}' = p_convocatoria_id::text
         OR meeting.quorum_data #>> '{source_links,convocatoria_id}' = p_convocatoria_id::text
         OR meeting.quorum_data #>> '{scheduled_from,convocatoria_id}' = p_convocatoria_id::text
         OR EXISTS (
           SELECT 1
             FROM pg_catalog.jsonb_array_elements_text(
               CASE
                 WHEN pg_catalog.jsonb_typeof(
                   meeting.quorum_data #> '{source_links,convocatoria_ids}'
                 ) = 'array'
                   THEN meeting.quorum_data #> '{source_links,convocatoria_ids}'
                 ELSE '[]'::jsonb
               END
             ) linked(value)
            WHERE linked.value = p_convocatoria_id::text
         )
       )
  )
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_meeting_linked_to_convocation(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. EMITIDA -> RECTIFICADA/CANCELADA limpia agregados vinculados
-- ---------------------------------------------------------------------------

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
  v_lock_tenant_id uuid;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_act public.convocation_acts%ROWTYPE;
  v_event public.convocation_lifecycle_events%ROWTYPE;
  v_role_ok boolean;
  v_meeting public.meetings%ROWTYPE;
  v_communications_cancelled integer := 0;
  v_communications_preserved integer := 0;
  v_meetings_cancelled integer := 0;
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

  v_lock_tenant_id := public.fn_assert_current_tenant_id();
  SELECT convocatoria.tenant_id
    INTO v_lock_tenant_id
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = v_lock_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONLY_EMITTED_CONVOCATION_CAN_TRANSITION'
      USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'COMMUNICATION:CONVOCATORIA:'
      || v_lock_tenant_id::text || ':' || p_convocatoria_id::text,
    0
  ));

  SELECT convocatoria.* INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = v_lock_tenant_id
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

  IF EXISTS (
    SELECT 1
      FROM public.agenda_items item
      JOIN public.meetings meeting ON meeting.id = item.meeting_id
     WHERE item.source_convocatoria_id = v_convocatoria.id
       AND (
         meeting.tenant_id IS DISTINCT FROM v_convocatoria.tenant_id
         OR item.tenant_id IS DISTINCT FROM v_convocatoria.tenant_id
       )
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MEETING_TENANT_MISMATCH'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.convocatoria_id = v_convocatoria.id
       AND communication.tenant_id IS DISTINCT FROM v_convocatoria.tenant_id
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_COMMUNICATION_TENANT_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  -- Serializa el estado de cada comunicación frente al dispatcher. Una fila
  -- ENVIANDO es incierta y bloquea la rectificación; las entregas históricas
  -- se preservan sin reescribir su verdad agregada.
  PERFORM 1
    FROM public.communications communication
   WHERE communication.tenant_id = v_convocatoria.tenant_id
     AND communication.convocatoria_id = v_convocatoria.id
   FOR UPDATE;
  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = v_convocatoria.tenant_id
       AND communication.convocatoria_id = v_convocatoria.id
       AND communication.estado = 'ENVIANDO'
  ) OR EXISTS (
    SELECT 1
      FROM public.communications communication
      JOIN public.communication_recipients recipient
        ON recipient.communication_id = communication.id
     WHERE communication.tenant_id = v_convocatoria.tenant_id
       AND communication.convocatoria_id = v_convocatoria.id
       AND recipient.estado_entrega = 'ENVIANDO'
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_COMMUNICATION_IN_FLIGHT'
      USING ERRCODE = '40001';
  END IF;

  -- Cualquier meeting que contenga un punto de esta convocatoria debe estar
  -- vinculado exclusivamente a ella. Un punto NULL u otra convocatoria vuelve
  -- ambiguo el alcance de la cancelación y aborta toda la transacción.
  FOR v_meeting IN
    SELECT meeting.*
      FROM public.meetings meeting
     WHERE meeting.tenant_id = v_convocatoria.tenant_id
       AND secretaria_private.fn_meeting_linked_to_convocation(
         meeting.id,
         meeting.tenant_id,
         v_convocatoria.id
       )
     FOR UPDATE
  LOOP
    -- El root meeting ya está bloqueado; congelamos también sus hijos antes
    -- de comprobar la exclusividad para que un cambio concurrente de
    -- source_convocatoria_id no sobreviva a la cancelación.
    PERFORM 1
      FROM public.agenda_items item
     WHERE item.meeting_id = v_meeting.id
     FOR UPDATE;

    IF EXISTS (
      SELECT 1
        FROM public.agenda_items item
       WHERE item.meeting_id = v_meeting.id
         AND (
           item.tenant_id IS DISTINCT FROM v_meeting.tenant_id
           OR item.source_convocatoria_id IS DISTINCT FROM v_convocatoria.id
         )
    ) OR (
      NULLIF(v_meeting.quorum_data #>> '{agenda_binding,convocatoria_id}', '') IS NOT NULL
      AND v_meeting.quorum_data #>> '{agenda_binding,convocatoria_id}'
            IS DISTINCT FROM v_convocatoria.id::text
    ) OR (
      NULLIF(v_meeting.quorum_data #>> '{source_links,convocatoria_id}', '') IS NOT NULL
      AND v_meeting.quorum_data #>> '{source_links,convocatoria_id}'
            IS DISTINCT FROM v_convocatoria.id::text
    ) OR (
      NULLIF(v_meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '') IS NOT NULL
      AND v_meeting.quorum_data #>> '{scheduled_from,convocatoria_id}'
            IS DISTINCT FROM v_convocatoria.id::text
    ) OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(
              v_meeting.quorum_data #> '{source_links,convocatoria_ids}'
            ) = 'array'
              THEN v_meeting.quorum_data #> '{source_links,convocatoria_ids}'
            ELSE '[]'::jsonb
          END
        ) linked(value)
       WHERE linked.value IS DISTINCT FROM v_convocatoria.id::text
    ) THEN
      RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MEETING_BINDING_NOT_EXCLUSIVE'
        USING ERRCODE = '23514';
    END IF;
    IF v_meeting.status IN ('EN_CURSO', 'CELEBRADA') THEN
      RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MEETING_ALREADY_IN_PROGRESS'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.minutes minute
       WHERE minute.tenant_id = v_convocatoria.tenant_id
         AND minute.meeting_id = v_meeting.id
    ) OR EXISTS (
      SELECT 1
        FROM public.meeting_resolutions resolution
       WHERE resolution.tenant_id = v_convocatoria.tenant_id
         AND resolution.meeting_id = v_meeting.id
    ) OR EXISTS (
      SELECT 1
      FROM public.agreements agreement
       WHERE agreement.tenant_id = v_convocatoria.tenant_id
         AND agreement.parent_meeting_id = v_meeting.id
    ) THEN
      RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MEETING_HAS_LEGAL_ACTS'
        USING ERRCODE = '23514';
    END IF;
    IF v_meeting.status IS NULL
       OR v_meeting.status NOT IN ('DRAFT', 'CONVOCADA', 'CANCELADA') THEN
      RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MEETING_STATE_UNSUPPORTED'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  PERFORM set_config('app.secretaria_convocation_lifecycle_rpc', 'on', true);

  UPDATE public.communications communication
     SET estado = 'CANCELADA',
         updated_at = clock_timestamp()
   WHERE communication.tenant_id = v_convocatoria.tenant_id
     AND communication.convocatoria_id = v_convocatoria.id
     AND communication.estado IN ('BORRADOR', 'PROGRAMADA');
  GET DIAGNOSTICS v_communications_cancelled = ROW_COUNT;

  SELECT count(*)::integer
    INTO v_communications_preserved
    FROM public.communications communication
   WHERE communication.tenant_id = v_convocatoria.tenant_id
     AND communication.convocatoria_id = v_convocatoria.id
     AND communication.estado NOT IN ('BORRADOR', 'PROGRAMADA', 'CANCELADA');

  UPDATE public.meetings meeting
     SET status = 'CANCELADA'
   WHERE meeting.tenant_id = v_convocatoria.tenant_id
     AND meeting.status IN ('DRAFT', 'CONVOCADA')
     AND secretaria_private.fn_meeting_linked_to_convocation(
       meeting.id,
       meeting.tenant_id,
       v_convocatoria.id
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.agenda_items other_item
        WHERE other_item.meeting_id = meeting.id
          AND (
            other_item.tenant_id IS DISTINCT FROM meeting.tenant_id
            OR other_item.source_convocatoria_id IS DISTINCT FROM v_convocatoria.id
          )
     );
  GET DIAGNOSTICS v_meetings_cancelled = ROW_COUNT;

  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = v_convocatoria.tenant_id
       AND communication.convocatoria_id = v_convocatoria.id
       AND communication.estado IN ('BORRADOR', 'PROGRAMADA', 'ENVIANDO')
  ) THEN
    RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_ACTIVE_COMMUNICATION_REMAINS'
      USING ERRCODE = '40001';
  END IF;

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
    jsonb_build_object(
      'communications_cancelled', v_communications_cancelled,
      'communications_preserved', v_communications_preserved,
      'meetings_cancelled', v_meetings_cancelled
    ),
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
    'act', to_jsonb(v_act),
    'cleanup', jsonb_build_object(
      'communications_cancelled', v_communications_cancelled,
      'communications_preserved', v_communications_preserved,
      'meetings_cancelled', v_meetings_cancelled
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_transition_convocatoria_lifecycle(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_transition_convocatoria_lifecycle(uuid, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
