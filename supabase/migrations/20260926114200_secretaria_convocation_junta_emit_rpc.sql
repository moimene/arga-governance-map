-- MOI-142: permitir emitir la convocatoria de una Junta, no solo la de un
-- Consejo. `fn_emit_convocatoria` (migración 20260720138000) sigue existiendo
-- tal cual, con su restricción `CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA`
-- intacta: esta migración NO la toca, para no arriesgar el camino CDA que ya
-- pasa demo/UAT. En su lugar se añade una función HERMANA,
-- `fn_emit_convocatoria_junta`, que emite convocatorias de un órgano JUNTA.
--
-- La Junta no tiene presidente propio: conforme al art. 166 LSC la convoca el
-- órgano de administración de la sociedad. Por eso el trigger autoritativo
-- compartido (`fn_convocatoria_authority_representation_guard`) gana una rama
-- nueva para body_type = 'JUNTA' que busca el órgano de administración
-- (`governing_bodies.body_type = 'CDA'`, convención ya usada en este esquema
-- para Consejo, Administrador Único y Administradores solidarios) de la misma
-- entidad y acepta como convocante a su PRESIDENTE o su ADMIN_UNICO — no solo
-- al Presidente, ampliando el alcance que el issue pide. ADMIN_SOLIDARIO y
-- ADMIN_MANCOMUNADO quedan fuera a propósito (fallan cerrado con un código
-- explícito): requieren reglas de actuación conjunta/solidaria que esta
-- migración no implementa.
--
-- ponytail: el texto revisado de una Junta se valida con un contrato más
-- laxo que el de fn_emit_convocatoria (que además defiende contra una
-- contaminación histórica concreta, "Isabel Moreno Castro", ajena a este
-- flujo). Aquí basta con: sin variables sin resolver, nombre de la entidad,
-- fecha y lugar de la sesión, título de cada punto del orden del día y la
-- leyenda DEMO de cierre de la propia plantilla CONVOCATORIA_JUNTA. Si en el
-- futuro se necesita el mismo nivel de paranoia textual que en CDA (orden de
-- secciones, líneas exactas de agenda), añadirlo aquí siguiendo ese patrón.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ampliar las rutas de autoridad permitidas para incluir la Junta
-- ---------------------------------------------------------------------------

ALTER TABLE public.convocatorias
  DROP CONSTRAINT IF EXISTS convocatorias_authority_route_check;
ALTER TABLE public.convocatorias
  ADD CONSTRAINT convocatorias_authority_route_check
  CHECK (
    convocation_authority_route IS NULL
    OR convocation_authority_route IN (
      'PRESIDENTE_ART_246_1',
      'PRESIDENTE_ART_166_JUNTA',
      'ADMIN_UNICO_ART_166_JUNTA'
    )
  );

ALTER TABLE public.convocation_acts
  DROP CONSTRAINT IF EXISTS convocation_acts_authority_route_check;
ALTER TABLE public.convocation_acts
  ADD CONSTRAINT convocation_acts_authority_route_check
  CHECK (
    authority_route IN (
      'PRESIDENTE_ART_246_1',
      'PRESIDENTE_ART_166_JUNTA',
      'ADMIN_UNICO_ART_166_JUNTA'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Trigger autoritativo: nueva rama para body_type = 'JUNTA'
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE reemplaza toda la función. El cuerpo es el vigente en
-- producción (verificado con pg_get_functiondef el 2026-09-26) más la rama
-- JUNTA insertada entre el bloque CDA y el ELSE; el resto es byte-a-byte el
-- mismo, incluida la parte de representación de socio único (que sigue
-- exigiendo body_type = 'CDA' y por tanto no se activa para una Junta).

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_authority_representation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_body public.governing_bodies%ROWTYPE;
  v_admin_body public.governing_bodies%ROWTYPE;
  v_source_entity public.entities%ROWTYPE;
  v_source_person public.persons%ROWTYPE;
  v_authority_count bigint;
  v_authority_id uuid;
  v_authority_person_id uuid;
  v_authority_cargo text;
  v_agenda jsonb;
  v_normalized_agenda jsonb := '[]'::jsonb;
  v_item jsonb;
  v_target_text text;
  v_representative_text text;
  v_requested_delegation_text text;
  v_target_id uuid;
  v_representative_id uuid;
  v_target_entity public.entities%ROWTYPE;
  v_representative public.persons%ROWTYPE;
  v_proposal text;
  v_representative_name_core text;
  v_meeting_date date;
  v_target_total numeric;
  v_source_total numeric;
  v_source_voting_total numeric;
  v_null_percentage_count bigint;
  v_delegation_count bigint;
  v_delegation_id uuid;
  v_delegation public.delegations%ROWTYPE;
BEGIN
  -- Cancelar o rectificar conserva íntegra la fuente emitida. La transición de
  -- estado la gobierna una RPC separada (migración 138); este trigger solo evita
  -- que esa transición reescriba fecha o autoridad histórica.
  IF NEW.estado IS DISTINCT FROM 'EMITIDA' THEN
    IF TG_OP = 'UPDATE'
      AND OLD.estado = 'EMITIDA'
      AND NEW.estado IN ('CANCELADA', 'RECTIFICADA') THEN
      IF NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
        OR NEW.convocante_person_id IS DISTINCT FROM OLD.convocante_person_id
        OR NEW.convocante_authority_evidence_id IS DISTINCT FROM OLD.convocante_authority_evidence_id
        OR NEW.convocation_authority_route IS DISTINCT FROM OLD.convocation_authority_route THEN
        RAISE EXCEPTION 'CONVOCATION_LIFECYCLE_MUST_PRESERVE_ISSUED_AUTHORITY'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    -- Los borradores pueden carecer de órgano. La competencia, representación
    -- y fecha de emisión se resuelven únicamente al pasar a EMITIDA.
    IF NEW.convocante_person_id IS NOT NULL
      OR NEW.convocante_authority_evidence_id IS NOT NULL
      OR NEW.convocation_authority_route IS NOT NULL THEN
      RAISE EXCEPTION 'CONVOCATION_AUTHORITY_CLAIMS_FORBIDDEN_BEFORE_ISSUE'
        USING ERRCODE = 'P0001';
    END IF;
    NEW.fecha_emision := NULL;
    RETURN NEW;
  END IF;

  IF NEW.body_id IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_BODY_REQUIRED_TO_ISSUE'
      USING ERRCODE = 'P0001';
  END IF;

  -- La emisión toma una fotografía coherente de las fuentes autoritativas. El
  -- bloqueo SHARE permite emisiones concurrentes, pero espera a cualquier alta,
  -- modificación o baja de cargos, poderes, capital o condiciones societarias.
  -- Así el trigger no valida una versión y el manifiesto congela otra.
  LOCK TABLE
    public.authority_evidence,
    public.capital_holdings,
    public.condiciones_persona,
    public.delegations
  IN SHARE MODE;

  -- fecha_emision nunca es un claim del navegador. Se fija en el servidor con
  -- la zona jurídica del tenant demo español.
  NEW.fecha_emision := (pg_catalog.clock_timestamp() AT TIME ZONE 'Europe/Madrid')::date;

  SELECT body.*
  INTO v_body
  FROM public.governing_bodies body
  WHERE body.id = NEW.body_id
    AND body.tenant_id = NEW.tenant_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_BODY_NOT_FOUND_OR_TENANT_MISMATCH'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT entity.*
  INTO v_source_entity
  FROM public.entities entity
  WHERE entity.id = v_body.entity_id
    AND entity.tenant_id = NEW.tenant_id
  FOR SHARE;

  IF NOT FOUND OR v_source_entity.person_id IS NULL THEN
    RAISE EXCEPTION 'CONVOCATION_SOURCE_ENTITY_OR_PERSON_BRIDGE_MISSING'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT person.*
  INTO v_source_person
  FROM public.persons person
  WHERE person.id = v_source_entity.person_id
    AND person.tenant_id = NEW.tenant_id
    AND person.person_type = 'PJ'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_SOURCE_ENTITY_PERSON_MUST_BE_SAME_TENANT_PJ'
      USING ERRCODE = 'P0001';
  END IF;

  -- Esta versión solo permite el circuito DEMO homogéneo. Cualquier dato TEST,
  -- PRE_RELEASE, PRODUCTION o mixto falla cerrado hasta existir evidencia
  -- productiva custodiada y un contrato jurídico aprobado.
  IF v_source_entity.data_class IS DISTINCT FROM 'DEMO'
    OR v_source_person.data_class IS DISTINCT FROM 'DEMO' THEN
    RAISE EXCEPTION 'CONVOCATION_NON_DEMO_OR_MIXED_DATA_FAIL_CLOSED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_source_entity.entity_status IS DISTINCT FROM 'Active'
    OR pg_catalog.upper(COALESCE(v_source_entity.jurisdiction, '')) <> 'ES' THEN
    RAISE EXCEPTION 'CONVOCATION_SOURCE_MUST_BE_ACTIVE_ES_ENTITY'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_body.body_type = 'CDA' THEN
    IF NEW.convocation_authority_route IS NOT NULL
      AND NEW.convocation_authority_route <> 'PRESIDENTE_ART_246_1' THEN
      RAISE EXCEPTION 'CONVOCATION_AUTHORITY_ROUTE_NOT_SUPPORTED'
        USING ERRCODE = 'P0001';
    END IF;

    -- La unicidad parcial de PRESIDENTE VIGENTE evita altas fantasma; el lock
    -- de tabla y este row lock preservan además fecha, estado y persona durante
    -- toda la transacción de emisión.
    PERFORM 1
    FROM public.authority_evidence evidence
    WHERE evidence.tenant_id = NEW.tenant_id
      AND evidence.entity_id = v_source_entity.id
      AND evidence.body_id = v_body.id
      AND evidence.cargo = 'PRESIDENTE'
      AND evidence.estado = 'VIGENTE'
      AND evidence.fecha_inicio <= NEW.fecha_emision
      AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= NEW.fecha_emision)
    FOR SHARE;

    SELECT
      pg_catalog.count(*),
      (pg_catalog.array_agg(evidence.id ORDER BY evidence.id))[1],
      (pg_catalog.array_agg(evidence.person_id ORDER BY evidence.id))[1]
    INTO
      v_authority_count,
      v_authority_id,
      v_authority_person_id
    FROM public.authority_evidence evidence
    WHERE evidence.tenant_id = NEW.tenant_id
      AND evidence.entity_id = v_source_entity.id
      AND evidence.body_id = v_body.id
      AND evidence.cargo = 'PRESIDENTE'
      AND evidence.estado = 'VIGENTE'
      AND evidence.fecha_inicio <= NEW.fecha_emision
      AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= NEW.fecha_emision);

    IF v_authority_count <> 1 THEN
      RAISE EXCEPTION
        'CONVOCATION_PRESIDENT_AUTHORITY_NOT_EXACT: expected 1, found %',
        v_authority_count
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.persons president
    WHERE president.id = v_authority_person_id
      AND president.tenant_id = NEW.tenant_id
      AND president.person_type = 'PF'
      AND president.data_class = 'DEMO'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONVOCATION_PRESIDENT_MUST_BE_SAME_TENANT_PF'
        USING ERRCODE = 'P0001';
    END IF;

    -- Los IDs aportados por cliente no son claims: se sustituyen siempre por
    -- la evidencia exacta obtenida de la fuente autoritativa.
    NEW.convocante_person_id := v_authority_person_id;
    NEW.convocante_authority_evidence_id := v_authority_id;
    NEW.convocation_authority_route := 'PRESIDENTE_ART_246_1';
  ELSIF v_body.body_type = 'JUNTA' THEN
    -- La Junta no tiene presidente propio: la convoca el órgano de
    -- administración de la sociedad (art. 166 LSC). En este esquema ese
    -- órgano es siempre el governing_bodies.body_type = 'CDA' de la misma
    -- entidad (convención ya usada para Consejo, Administrador Único y
    -- Administradores solidarios).
    IF NEW.convocation_authority_route IS NOT NULL
      AND NEW.convocation_authority_route NOT IN (
        'PRESIDENTE_ART_166_JUNTA', 'ADMIN_UNICO_ART_166_JUNTA'
      ) THEN
      RAISE EXCEPTION 'CONVOCATION_AUTHORITY_ROUTE_NOT_SUPPORTED'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT pg_catalog.count(*)
    INTO v_authority_count
    FROM public.governing_bodies admin_body
    WHERE admin_body.tenant_id = NEW.tenant_id
      AND admin_body.entity_id = v_source_entity.id
      AND admin_body.body_type = 'CDA';

    IF v_authority_count <> 1 THEN
      RAISE EXCEPTION
        'CONVOCATION_JUNTA_ADMINISTRATIVE_BODY_NOT_EXACT: expected 1, found %',
        v_authority_count
        USING ERRCODE = 'P0001';
    END IF;

    SELECT admin_body.*
    INTO v_admin_body
    FROM public.governing_bodies admin_body
    WHERE admin_body.tenant_id = NEW.tenant_id
      AND admin_body.entity_id = v_source_entity.id
      AND admin_body.body_type = 'CDA'
    FOR SHARE;

    -- No solo PRESIDENTE: también ADMIN_UNICO. ADMIN_SOLIDARIO y
    -- ADMIN_MANCOMUNADO quedan fuera a propósito (actuación conjunta o
    -- solidaria no implementada aquí) y fallan cerrado más abajo.
    PERFORM 1
    FROM public.authority_evidence evidence
    WHERE evidence.tenant_id = NEW.tenant_id
      AND evidence.entity_id = v_source_entity.id
      AND evidence.body_id = v_admin_body.id
      AND evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')
      AND evidence.estado = 'VIGENTE'
      AND evidence.fecha_inicio <= NEW.fecha_emision
      AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= NEW.fecha_emision)
    FOR SHARE;

    SELECT
      pg_catalog.count(*),
      (pg_catalog.array_agg(evidence.id ORDER BY evidence.cargo, evidence.id))[1],
      (pg_catalog.array_agg(evidence.person_id ORDER BY evidence.cargo, evidence.id))[1],
      (pg_catalog.array_agg(evidence.cargo ORDER BY evidence.cargo, evidence.id))[1]
    INTO
      v_authority_count,
      v_authority_id,
      v_authority_person_id,
      v_authority_cargo
    FROM public.authority_evidence evidence
    WHERE evidence.tenant_id = NEW.tenant_id
      AND evidence.entity_id = v_source_entity.id
      AND evidence.body_id = v_admin_body.id
      AND evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')
      AND evidence.estado = 'VIGENTE'
      AND evidence.fecha_inicio <= NEW.fecha_emision
      AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= NEW.fecha_emision);

    IF v_authority_count <> 1 THEN
      RAISE EXCEPTION
        'CONVOCATION_JUNTA_ADMINISTRATOR_AUTHORITY_NOT_EXACT_OR_NOT_YET_SUPPORTED: expected 1 PRESIDENTE/ADMIN_UNICO, found %',
        v_authority_count
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.persons administrator
    WHERE administrator.id = v_authority_person_id
      AND administrator.tenant_id = NEW.tenant_id
      AND administrator.person_type = 'PF'
      AND administrator.data_class = 'DEMO'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONVOCATION_JUNTA_ADMINISTRATOR_MUST_BE_SAME_TENANT_PF'
        USING ERRCODE = 'P0001';
    END IF;

    NEW.convocante_person_id := v_authority_person_id;
    NEW.convocante_authority_evidence_id := v_authority_id;
    NEW.convocation_authority_route := CASE v_authority_cargo
      WHEN 'PRESIDENTE' THEN 'PRESIDENTE_ART_166_JUNTA'
      ELSE 'ADMIN_UNICO_ART_166_JUNTA'
    END;
  ELSE
    IF NEW.convocante_person_id IS NOT NULL
      OR NEW.convocante_authority_evidence_id IS NOT NULL
      OR NEW.convocation_authority_route IS NOT NULL THEN
      RAISE EXCEPTION 'CONVOCATION_AUTHORITY_ROUTE_ONLY_IMPLEMENTED_FOR_CDA'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.agenda_items IS NULL THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.jsonb_typeof(NEW.agenda_items) <> 'array' THEN
    RAISE EXCEPTION 'CONVOCATION_AGENDA_MUST_BE_JSON_ARRAY'
      USING ERRCODE = 'P0001';
  END IF;

  v_agenda := NEW.agenda_items;
  FOR v_item IN
    SELECT agenda_element.value
    FROM pg_catalog.jsonb_array_elements(v_agenda)
      WITH ORDINALITY AS agenda_element(value, ordinality)
    ORDER BY agenda_element.ordinality
  LOOP
    -- El código histórico cubría supuestos heterogéneos y no llevaba el gate
    -- de socio único. Ningún alias que intente expresar representante+filial
    -- puede degradar silenciosamente al circuito legacy.
    IF pg_catalog.btrim(COALESCE(v_item ->> 'materia', '')) <>
         'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
      AND (
        pg_catalog.upper(pg_catalog.btrim(COALESCE(v_item ->> 'materia', ''))) =
          'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
        OR (
          pg_catalog.upper(COALESCE(v_item ->> 'materia', '')) LIKE '%REPRESENT%'
          AND (
            pg_catalog.upper(COALESCE(v_item ->> 'materia', '')) LIKE '%FILIAL%'
            OR pg_catalog.upper(COALESCE(v_item ->> 'materia', '')) LIKE '%PARTICIPADA%'
            OR pg_catalog.upper(COALESCE(v_item ->> 'materia', '')) LIKE '%SOCIO_UNICO%'
          )
        )
      ) THEN
      RAISE EXCEPTION 'REPRESENTATION_LEGACY_MATTER_FORBIDDEN: %',
        COALESCE(v_item ->> 'materia', '<missing>')
        USING ERRCODE = '23514';
    END IF;

    IF v_item ->> 'materia' IS DISTINCT FROM
         'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
      AND (
        NULLIF(pg_catalog.btrim(v_item ->> 'target_entity_id'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'target_entity_name'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representative_person_id'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representative_name'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representation_delegation_id'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representation_authority_route'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representation_evidence_status'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'representation_source_reference'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'source_shareholder_entity_id'), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_item ->> 'source_shareholder_person_id'), '') IS NOT NULL
      ) THEN
      RAISE EXCEPTION 'REPRESENTATION_CLAIMS_FORBIDDEN_OUTSIDE_CANONICAL_MATTER'
        USING ERRCODE = '23514';
    END IF;

    IF v_item ->> 'materia' = 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL' THEN
      IF pg_catalog.jsonb_typeof(v_item) <> 'object' THEN
        RAISE EXCEPTION 'REPRESENTATION_AGENDA_ITEM_MUST_BE_OBJECT'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_body.body_type <> 'CDA' THEN
        RAISE EXCEPTION 'REPRESENTATION_AGENDA_REQUIRES_CDA'
          USING ERRCODE = 'P0001';
      END IF;

      IF pg_catalog.upper(COALESCE(v_item ->> 'kind', '')) <> 'DECISORIO' THEN
        RAISE EXCEPTION 'REPRESENTATION_AGENDA_REQUIRES_DECISORIO'
          USING ERRCODE = 'P0001';
      END IF;

      v_target_text := v_item ->> 'target_entity_id';
      v_representative_text := v_item ->> 'representative_person_id';
      v_requested_delegation_text := v_item ->> 'representation_delegation_id';

      IF v_target_text IS NULL
        OR v_target_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_ENTITY_ID_REQUIRED_VALID_UUID'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_representative_text IS NULL
        OR v_representative_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'REPRESENTATION_PERSON_ID_REQUIRED_VALID_UUID'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_requested_delegation_text IS NULL
        OR v_requested_delegation_text !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'REPRESENTATION_DELEGATION_ID_REQUIRED_VALID_UUID'
          USING ERRCODE = 'P0001';
      END IF;

      v_target_id := v_target_text::uuid;
      v_representative_id := v_representative_text::uuid;

      SELECT target.*
      INTO v_target_entity
      FROM public.entities target
      WHERE target.id = v_target_id
        AND target.tenant_id = NEW.tenant_id
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_NOT_FOUND_OR_TENANT_MISMATCH'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_target_entity.id = v_source_entity.id THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_MUST_DIFFER_FROM_SOURCE'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_target_entity.entity_status IS DISTINCT FROM 'Active'
        OR pg_catalog.upper(COALESCE(v_target_entity.jurisdiction, '')) <> 'ES' THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_MUST_BE_ACTIVE_ES_ENTITY'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_target_entity.data_class IS DISTINCT FROM 'DEMO' THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_NON_DEMO_OR_MIXED_FAIL_CLOSED'
          USING ERRCODE = 'P0001';
      END IF;

      IF pg_catalog.regexp_replace(
        pg_catalog.upper(COALESCE(v_target_entity.tipo_social, v_target_entity.legal_form, '')),
        '[^A-Z]',
        '',
        'g'
      ) NOT IN ('SL', 'SLU') THEN
        RAISE EXCEPTION 'REPRESENTATION_TARGET_MUST_BE_SL_OR_SLU'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT representative.*
      INTO v_representative
      FROM public.persons representative
      WHERE representative.id = v_representative_id
        AND representative.tenant_id = NEW.tenant_id
        AND representative.person_type = 'PF'
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'REPRESENTATION_PERSON_NOT_FOUND_SAME_TENANT_PF'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_representative.data_class IS DISTINCT FROM 'DEMO' THEN
        RAISE EXCEPTION 'REPRESENTATION_PERSON_NON_DEMO_OR_MIXED_FAIL_CLOSED'
          USING ERRCODE = 'P0001';
      END IF;

      v_proposal := NULLIF(pg_catalog.btrim(v_item ->> 'propuesta_acuerdo'), '');
      IF v_proposal IS NULL THEN
        RAISE EXCEPTION 'REPRESENTATION_PROPOSAL_REQUIRED'
          USING ERRCODE = 'P0001';
      END IF;

      IF pg_catalog.strpos(
        pg_catalog.lower(v_proposal),
        pg_catalog.lower(v_target_entity.legal_name)
      ) = 0 THEN
        RAISE EXCEPTION 'REPRESENTATION_PROPOSAL_TARGET_NAME_MISMATCH'
          USING ERRCODE = 'P0001';
      END IF;

      -- El tratamiento puede omitirse, pero el nombre autoritativo restante
      -- debe figurar literalmente (sin distinguir mayúsculas/minúsculas).
      v_representative_name_core := pg_catalog.btrim(
        pg_catalog.regexp_replace(
          v_representative.full_name,
          '^(Dña\.|Dª\.|D\.|Doña|Don)\s*',
          '',
          'i'
        )
      );
      IF pg_catalog.strpos(
        pg_catalog.lower(v_proposal),
        pg_catalog.lower(v_representative_name_core)
      ) = 0 THEN
        RAISE EXCEPTION 'REPRESENTATION_PROPOSAL_REPRESENTATIVE_NAME_MISMATCH'
          USING ERRCODE = 'P0001';
      END IF;

      IF NEW.fecha_1 IS NULL THEN
        RAISE EXCEPTION 'REPRESENTATION_MEETING_DATE_REQUIRED'
          USING ERRCODE = 'P0001';
      END IF;
      v_meeting_date := (NEW.fecha_1 AT TIME ZONE 'Europe/Madrid')::date;

      PERFORM 1
      FROM public.capital_holdings holding
      WHERE holding.tenant_id = NEW.tenant_id
        AND holding.entity_id = v_target_entity.id
        AND holding.effective_from <= v_meeting_date
        AND (holding.effective_to IS NULL OR holding.effective_to >= v_meeting_date)
      FOR SHARE;

      SELECT
        COALESCE(pg_catalog.sum(holding.porcentaje_capital), 0),
        COALESCE(
          pg_catalog.sum(holding.porcentaje_capital)
            FILTER (
              WHERE holding.holder_person_id = v_source_entity.person_id
                AND NOT holding.is_treasury
            ),
          0
        ),
        COALESCE(
          pg_catalog.sum(holding.porcentaje_capital)
            FILTER (
              WHERE holding.holder_person_id = v_source_entity.person_id
                AND NOT holding.is_treasury
                AND holding.voting_rights
            ),
          0
        ),
        pg_catalog.count(*) FILTER (WHERE holding.porcentaje_capital IS NULL)
      INTO
        v_target_total,
        v_source_total,
        v_source_voting_total,
        v_null_percentage_count
      FROM public.capital_holdings holding
      WHERE holding.tenant_id = NEW.tenant_id
        AND holding.entity_id = v_target_entity.id
        AND holding.effective_from <= v_meeting_date
        AND (holding.effective_to IS NULL OR holding.effective_to >= v_meeting_date);

      IF v_null_percentage_count <> 0
        OR v_target_total <> 100
        OR v_source_total <> 100
        OR v_source_voting_total <> 100 THEN
        RAISE EXCEPTION
          'REPRESENTATION_SOLE_SHAREHOLDER_100_VOTING_NOT_PROVEN: target %, source %, voting %, null rows %',
          v_target_total,
          v_source_total,
          v_source_voting_total,
          v_null_percentage_count
          USING ERRCODE = 'P0001';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.condiciones_persona administrator
        WHERE administrator.tenant_id = NEW.tenant_id
          AND administrator.entity_id = v_target_entity.id
          AND administrator.person_id = v_source_entity.person_id
          AND administrator.tipo_condicion IN (
            'ADMIN_UNICO',
            'ADMIN_SOLIDARIO',
            'ADMIN_MANCOMUNADO',
            'ADMIN_PJ',
            'CONSEJERO',
            'PRESIDENTE',
            'VICEPRESIDENTE',
            'CONSEJERO_COORDINADOR'
          )
          AND administrator.fecha_inicio <= v_meeting_date
          AND (
            administrator.fecha_fin IS NULL
            OR administrator.fecha_fin >= v_meeting_date
          )
      ) THEN
        RAISE EXCEPTION 'REPRESENTATION_SOURCE_IS_TARGET_CORPORATE_ADMIN_ART_212_BIS'
          USING ERRCODE = 'P0001';
      END IF;

      PERFORM 1
      FROM public.delegations delegation
      WHERE delegation.tenant_id = NEW.tenant_id
        AND delegation.id = v_requested_delegation_text::uuid
      FOR SHARE;

      SELECT
        pg_catalog.count(*),
        (pg_catalog.array_agg(delegation.id ORDER BY delegation.id))[1]
      INTO v_delegation_count, v_delegation_id
      FROM public.delegations delegation
      WHERE delegation.tenant_id = NEW.tenant_id
        AND delegation.id = v_requested_delegation_text::uuid
        AND delegation.entity_id = v_source_entity.id
        AND delegation.grantor_id = v_source_entity.person_id
        AND delegation.delegate_id = v_representative.id
        AND delegation.delegation_type = 'PODER_GENERAL_REPRESENTACION_SOCIO_UNICO_DEMO'
        AND delegation.scope = 'ART_183_1_ALL_ASSETS_NATIONAL_TERRITORY_DEMO'
        AND delegation.limits = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
        AND delegation.status = 'Vigente'
        AND delegation.start_date IS NOT NULL
        AND delegation.start_date <= v_meeting_date
        AND (delegation.end_date IS NULL OR delegation.end_date >= v_meeting_date)
        AND delegation.representation_authority_route = 'GENERAL_PUBLIC_POWER_ART_183_1'
        AND COALESCE(delegation.representation_source_reference, '') <> ''
        AND delegation.representation_evidence_status = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
        AND delegation.representation_legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
        AND delegation.representation_source_uri IS NULL
        AND delegation.representation_source_hash_sha512 IS NULL;

      IF v_delegation_count <> 1 THEN
        RAISE EXCEPTION
          'REPRESENTATION_GENERAL_PUBLIC_POWER_NOT_EXACT_OR_VERIFIED: expected 1, found %',
          v_delegation_count
          USING ERRCODE = 'P0001';
      END IF;

      SELECT delegation.*
      INTO STRICT v_delegation
      FROM public.delegations delegation
      WHERE delegation.id = v_delegation_id
      FOR SHARE;

      -- Elimina todos los claims derivados que pudiera haber aportado el
      -- cliente y escribe el resultado autoritativo del gate.
      v_item := v_item
        - 'representation_authority_route'
        - 'representation_delegation_id'
        - 'representation_evidence_status'
        - 'representation_source_reference'
        - 'representation_source_uri'
        - 'representation_source_hash_sha512'
        - 'representation_legal_effect'
        - 'source_shareholder_entity_id'
        - 'source_shareholder_person_id'
        - 'target_entity_name'
        - 'representative_name'
        - 'capital_ownership_percentage'
        - 'capital_voting_percentage'
        - 'capital_evidence_status'
        - 'authority_gate_version';

      v_item := v_item || pg_catalog.jsonb_build_object(
        'representation_authority_route', 'GENERAL_PUBLIC_POWER_ART_183_1',
        'representation_delegation_id', v_delegation.id,
        'representation_evidence_status', v_delegation.representation_evidence_status,
        'representation_source_reference', v_delegation.representation_source_reference,
        'representation_source_uri', v_delegation.representation_source_uri,
        'representation_source_hash_sha512', v_delegation.representation_source_hash_sha512,
        'representation_legal_effect', v_delegation.representation_legal_effect,
        'source_shareholder_entity_id', v_source_entity.id,
        'source_shareholder_person_id', v_source_entity.person_id,
        'target_entity_name', v_target_entity.legal_name,
        'representative_name', v_representative.full_name,
        'capital_ownership_percentage', v_source_total,
        'capital_voting_percentage', v_source_voting_total,
        'capital_evidence_status', 'DEMO_CAPITAL_DATA_NO_LEGAL_EFFECT',
        'data_class', 'DEMO',
        'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
        'authority_gate_version', 'secretaria.convocation-authority.v2-demo-only'
      );
    END IF;

    v_normalized_agenda := v_normalized_agenda || pg_catalog.jsonb_build_array(v_item);
  END LOOP;

  NEW.agenda_items := v_normalized_agenda;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_authority_representation_guard()
  FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. RPC hermana: fn_emit_convocatoria_junta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_emit_convocatoria_junta(
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
  v_admin_body public.governing_bodies%ROWTYPE;
  v_entity public.entities%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_authority public.authority_evidence%ROWTYPE;
  v_officer public.persons%ROWTYPE;
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
  v_reviewed_compact text;
  v_place text;
  v_agenda_hash_sha256 text;
  v_expected_date_text text;
  v_required_compact text;
  v_semantic_item jsonb;
  v_authority_route text;
  v_recheck_count bigint;
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
    OR v_body.body_type <> 'JUNTA'
    OR v_entity.entity_status IS DISTINCT FROM 'Active'
    OR upper(COALESCE(v_entity.jurisdiction, '')) <> 'ES'
    OR v_entity.data_class IS DISTINCT FROM 'DEMO' THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_JUNTA'
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

  -- La materia de representación de socio único es exclusiva del Consejo
  -- (art. 15 LSC); en una convocatoria de Junta no tiene sentido y el
  -- trigger autoritativo la rechazaría igualmente (REPRESENTATION_AGENDA_REQUIRES_CDA).
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_agenda) item(value)
     WHERE upper(COALESCE(item.value ->> 'materia', '')) LIKE '%REPRESENT%'
        OR item.value ->> 'materia' = 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
  ) THEN
    RAISE EXCEPTION 'REPRESENTATION_LEGACY_MATTER_FORBIDDEN'
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
  IF length(v_reviewed_text) < 200 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_STRUCTURE_TOO_SHORT'
      USING ERRCODE = '23514';
  END IF;
  IF strpos(v_reviewed_text, '{{') > 0 OR strpos(v_reviewed_text, '}}') > 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_UNRESOLVED_TEMPLATE_VARIABLES'
      USING ERRCODE = '23514';
  END IF;
  IF strpos(
    v_reviewed_text,
    'Documento demo/operativo. No constituye evidencia final productiva.'
  ) = 0 THEN
    RAISE EXCEPTION 'CONVOCATION_TEXT_CANONICAL_DEMO_SAFEGUARDS_MISSING'
      USING ERRCODE = '23514';
  END IF;

  v_reviewed_text_hash_sha256 := encode(
    extensions.digest(convert_to(v_reviewed_text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_reviewed_text_hash := encode(
    extensions.digest(convert_to(v_reviewed_text, 'UTF8'), 'sha512'),
    'hex'
  );
  v_reviewed_compact := regexp_replace(
    translate(lower(v_reviewed_text), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    '',
    'g'
  );

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

  FOR v_semantic_item IN
    SELECT agenda.value
      FROM jsonb_array_elements(v_agenda) agenda(value)
  LOOP
    v_required_compact := regexp_replace(
      translate(lower(COALESCE(v_semantic_item ->> 'titulo', '')), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+',
      '',
      'g'
    );
    IF v_required_compact = '' OR strpos(v_reviewed_compact, v_required_compact) = 0 THEN
      RAISE EXCEPTION 'CONVOCATION_TEXT_AGENDA_TITLE_MISMATCH: %',
        COALESCE(v_semantic_item ->> 'titulo', '<missing>')
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

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

  -- El trigger autoritativo ya derivó convocante_person_id/authority_evidence_id
  -- /route contra el órgano de administración de la entidad. Aquí se revalida
  -- justo antes de congelar el manifiesto, igual que hace fn_emit_convocatoria
  -- para el Consejo.
  SELECT admin_body.* INTO v_admin_body
    FROM public.governing_bodies admin_body
   WHERE admin_body.tenant_id = v_tenant_id
     AND admin_body.entity_id = v_entity.id
     AND admin_body.body_type = 'CDA';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_ADMINISTRATIVE_BODY_NOT_FOUND'
      USING ERRCODE = '23514';
  END IF;

  SELECT evidence.* INTO v_authority
    FROM public.authority_evidence evidence
   WHERE evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_admin_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')
     AND evidence.estado = 'VIGENTE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_OFFICE_EVIDENCE_DRIFT'
      USING ERRCODE = '23514';
  END IF;

  SELECT person.* INTO v_officer
    FROM public.persons person
   WHERE person.id = v_authority.person_id
     AND person.tenant_id = v_tenant_id
     AND person.person_type = 'PF'
     AND person.data_class = 'DEMO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_OFFICE_HOLDER_DEMO_DRIFT'
      USING ERRCODE = '23514';
  END IF;

  v_authority_route := CASE v_authority.cargo
    WHEN 'PRESIDENTE' THEN 'PRESIDENTE_ART_166_JUNTA'
    ELSE 'ADMIN_UNICO_ART_166_JUNTA'
  END;
  IF v_convocatoria.convocation_authority_route IS DISTINCT FROM v_authority_route THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_AUTHORITY_ROUTE_DRIFT'
      USING ERRCODE = '23514';
  END IF;

  SELECT template.* INTO v_template
    FROM public.plantillas_protegidas template
   WHERE template.tenant_id = v_tenant_id
     AND template.tipo = 'CONVOCATORIA'
     AND template.organo_tipo = 'JUNTA_GENERAL'
     AND template.estado = 'ACTIVA'
     AND template.capa1_inmutable IS NOT NULL
     AND (template.tipo_social IS NULL OR upper(template.tipo_social) = upper(COALESCE(v_entity.tipo_social, '')))
     AND template.content_hash_sha256 = encode(
       extensions.digest(convert_to(template.capa1_inmutable, 'UTF8'), 'sha256'),
       'hex'
     )
   ORDER BY template.version DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_APPROVED_CONVOCATION_TEMPLATE_JUNTA_REQUIRED'
      USING ERRCODE = '23514';
  END IF;

  -- Segunda lectura inmediatamente anterior al registro WORM, igual criterio
  -- que en fn_emit_convocatoria: la autoridad debe seguir resolviendo a la
  -- misma fuente bloqueada por el trigger.
  SELECT pg_catalog.count(*)
    INTO v_recheck_count
    FROM public.authority_evidence evidence
   WHERE evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_admin_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')
     AND evidence.estado = 'VIGENTE'
     AND evidence.fecha_inicio <= v_convocatoria.fecha_emision
     AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= v_convocatoria.fecha_emision);
  IF v_recheck_count <> 1 THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_AUTHORITY_REVALIDATION_FAILED'
      USING ERRCODE = '23514';
  END IF;

  SELECT evidence.* INTO STRICT v_authority
    FROM public.authority_evidence evidence
   WHERE evidence.id = v_convocatoria.convocante_authority_evidence_id
     AND evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity.id
     AND evidence.body_id = v_admin_body.id
     AND evidence.person_id = v_convocatoria.convocante_person_id
     AND evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')
     AND evidence.estado = 'VIGENTE'
     AND evidence.fecha_inicio <= v_convocatoria.fecha_emision
     AND (evidence.fecha_fin IS NULL OR evidence.fecha_fin >= v_convocatoria.fecha_emision)
   FOR SHARE;

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
    v_officer.id,
    v_authority.id,
    'DEMO_CONVOCATION_RECORD',
    v_authority_route,
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

  v_manifest := jsonb_build_object(
    'schema_version', 'secretaria.convocation-manifest.v2',
    'convocatoria_id', v_convocatoria.id,
    'tenant_id', v_tenant_id,
    'data_class', 'DEMO',
    'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
    'record_status', 'DEMO_OPERATIONAL_DRAFT_RECORDED',
    'database_state', v_convocatoria.estado,
    'not_a_legal_convocation', true,
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
      'office', v_authority.cargo,
      'administrative_body_id', v_admin_body.id,
      'office_evidence_id', v_authority.id,
      'person_id', v_officer.id,
      'person_name', v_officer.full_name,
      'office_evidence_status', v_authority.estado,
      'office_evidence_source', v_authority.fuente_designacion,
      'act_id', v_act_row.id,
      'act_hash_sha512', v_act_row.act_hash_sha512,
      'act_type', v_act_row.act_type,
      'act_recorded_by', v_act_row.recorded_by,
      'act_recorded_at', v_act_row.recorded_at,
      'actor_role_reference_only', true,
      -- Nombre de clave fijado por el guard WORM compartido
      -- (fn_convocation_manifest_worm_guard exige literalmente esta ruta
      -- {authority,president_action_not_asserted}); aplica igual cuando el
      -- convocante es Administrador Único, no solo Presidente.
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

REVOKE ALL ON FUNCTION public.fn_emit_convocatoria_junta(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_emit_convocatoria_junta(jsonb)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Self-checks de instalación y privilegios
-- ---------------------------------------------------------------------------

DO $verify$
DECLARE
  v_def text;
BEGIN
  IF has_function_privilege('anon', 'public.fn_emit_convocatoria_junta(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.fn_emit_convocatoria_junta(jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.fn_emit_convocatoria_junta(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_RPC_PRIVILEGE_CONTRACT_FAILED';
  END IF;

  -- fn_emit_convocatoria (Consejo) debe seguir intacta: la migración no la
  -- toca, pero un self-check aquí detecta si otra migración concurrente la
  -- alteró por error mientras se desarrollaba esta.
  SELECT pg_get_functiondef('public.fn_emit_convocatoria(jsonb)'::regprocedure) INTO v_def;
  IF v_def IS NULL
     OR v_def NOT LIKE '%CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA%' THEN
    RAISE EXCEPTION 'CONVOCATION_CDA_RPC_MUST_REMAIN_UNCHANGED';
  END IF;

  SELECT pg_get_functiondef(
    'secretaria_private.fn_convocatoria_authority_representation_guard()'::regprocedure
  ) INTO v_def;
  IF v_def IS NULL
     OR v_def NOT LIKE '%CONVOCATION_JUNTA_ADMINISTRATIVE_BODY_NOT_EXACT%'
     OR v_def NOT LIKE '%PRESIDENTE_ART_166_JUNTA%' THEN
    RAISE EXCEPTION 'CONVOCATION_JUNTA_AUTHORITY_TRIGGER_INSTALL_FAILED';
  END IF;

  -- Control positivo: la ruta CDA sigue viva en la MISMA función (no se ha
  -- perdido código al reemplazarla).
  IF v_def NOT LIKE '%CONVOCATION_PRESIDENT_AUTHORITY_NOT_EXACT%' THEN
    RAISE EXCEPTION 'CONVOCATION_CDA_AUTHORITY_BRANCH_LOST_ON_REPLACE';
  END IF;
END
$verify$;

COMMIT;
