-- Autoridad convocante y representación del socio único: gate autoritativo.
--
-- El cliente únicamente selecciona target_entity_id y representation_delegation_id;
-- representative_person_id permite mostrar la persona, pero el servidor la
-- vuelve a derivar y exige coincidencia exacta con el título seleccionado.
-- La base de datos deriva la autoridad convocante, la ruta del art. 183 LSC y
-- sus evidencias. Por ahora la convocatoria de un Consejo solo admite la ruta
-- ordinaria del presidente (art. 246.1 LSC). La única ruta de representación
-- implementada es el poder general en documento público del art. 183.1 LSC.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Autoridad convocante estructurada
-- ---------------------------------------------------------------------------

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS convocante_person_id uuid,
  ADD COLUMN IF NOT EXISTS convocante_authority_evidence_id uuid,
  ADD COLUMN IF NOT EXISTS convocation_authority_route text;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'convocatorias_convocante_person_fk'
      AND conrelid = 'public.convocatorias'::regclass
  ) THEN
    ALTER TABLE public.convocatorias
      ADD CONSTRAINT convocatorias_convocante_person_fk
      FOREIGN KEY (convocante_person_id)
      REFERENCES public.persons(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'convocatorias_convocante_authority_evidence_fk'
      AND conrelid = 'public.convocatorias'::regclass
  ) THEN
    ALTER TABLE public.convocatorias
      ADD CONSTRAINT convocatorias_convocante_authority_evidence_fk
      FOREIGN KEY (convocante_authority_evidence_id)
      REFERENCES public.authority_evidence(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'convocatorias_authority_route_check'
      AND conrelid = 'public.convocatorias'::regclass
  ) THEN
    ALTER TABLE public.convocatorias
      ADD CONSTRAINT convocatorias_authority_route_check
      CHECK (
        convocation_authority_route IS NULL
        OR convocation_authority_route = 'PRESIDENTE_ART_246_1'
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_convocatorias_convocante_authority_evidence
  ON public.convocatorias (convocante_authority_evidence_id)
  WHERE convocante_authority_evidence_id IS NOT NULL;

COMMENT ON COLUMN public.convocatorias.convocante_person_id IS
  'Titular del cargo competente derivado server-side. Acredita el cargo, no el acto concreto de convocatoria.';
COMMENT ON COLUMN public.convocatorias.convocante_authority_evidence_id IS
  'Evidencia exacta del cargo, vigente en fecha_emision y coincidente en tenant, entidad y órgano; no sustituye el acto de convocatoria.';
COMMENT ON COLUMN public.convocatorias.convocation_authority_route IS
  'Ruta autoritativa derivada. Actualmente solo PRESIDENTE_ART_246_1 para Consejo.';

-- ---------------------------------------------------------------------------
-- 2. Evidencia estructurada de representación voluntaria (art. 183.1 LSC)
-- ---------------------------------------------------------------------------

ALTER TABLE public.delegations
  ADD COLUMN IF NOT EXISTS representation_authority_route text,
  ADD COLUMN IF NOT EXISTS representation_evidence_status text,
  ADD COLUMN IF NOT EXISTS representation_source_reference text,
  ADD COLUMN IF NOT EXISTS representation_source_uri text,
  ADD COLUMN IF NOT EXISTS representation_source_hash_sha512 text,
  ADD COLUMN IF NOT EXISTS representation_legal_effect text;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'delegations_representation_authority_route_check'
      AND conrelid = 'public.delegations'::regclass
  ) THEN
    ALTER TABLE public.delegations
      ADD CONSTRAINT delegations_representation_authority_route_check
      CHECK (
        representation_authority_route IS NULL
        OR representation_authority_route = 'GENERAL_PUBLIC_POWER_ART_183_1'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'delegations_representation_evidence_status_check'
      AND conrelid = 'public.delegations'::regclass
  ) THEN
    ALTER TABLE public.delegations
      ADD CONSTRAINT delegations_representation_evidence_status_check
      CHECK (
        representation_evidence_status IS NULL
        OR representation_evidence_status IN (
          'DEMO_SIMULATION_NO_LEGAL_EFFECT',
          'VERIFIED_SOURCE'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'delegations_representation_legal_effect_check'
      AND conrelid = 'public.delegations'::regclass
  ) THEN
    ALTER TABLE public.delegations
      ADD CONSTRAINT delegations_representation_legal_effect_check
      CHECK (
        representation_legal_effect IS NULL
        OR representation_legal_effect IN (
          'DEMO_SIMULATION_NO_LEGAL_EFFECT',
          'SOURCE_VERIFIED_LEGAL_EFFECT'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'delegations_representation_hash_sha512_check'
      AND conrelid = 'public.delegations'::regclass
  ) THEN
    ALTER TABLE public.delegations
      ADD CONSTRAINT delegations_representation_hash_sha512_check
      CHECK (
        representation_source_hash_sha512 IS NULL
        OR representation_source_hash_sha512 ~ '^[0-9A-Fa-f]{128}$'
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_delegations_representation_authority
  ON public.delegations (
    tenant_id,
    entity_id,
    delegate_id,
    representation_authority_route,
    start_date,
    end_date
  )
  WHERE status = 'Vigente'
    AND representation_authority_route IS NOT NULL;

COMMENT ON COLUMN public.delegations.representation_authority_route IS
  'Ruta jurídica estructurada. El gate solo implementa GENERAL_PUBLIC_POWER_ART_183_1.';
COMMENT ON COLUMN public.delegations.representation_evidence_status IS
  'DEMO_SIMULATION_NO_LEGAL_EFFECT o VERIFIED_SOURCE; nunca se infiere de texto libre.';
COMMENT ON COLUMN public.delegations.representation_source_reference IS
  'Referencia interna o externa de la fuente. Una etiqueta demo no equivale a referencia notarial.';
COMMENT ON COLUMN public.delegations.representation_source_uri IS
  'URI de la fuente verificada; obligatoria fuera del supuesto estrictamente DEMO.';
COMMENT ON COLUMN public.delegations.representation_source_hash_sha512 IS
  'SHA-512 hexadecimal de la fuente verificada; obligatorio fuera del supuesto estrictamente DEMO.';
COMMENT ON COLUMN public.delegations.representation_legal_effect IS
  'Distingue una simulación demo sin efecto jurídico de una fuente productiva verificada.';

-- DEL-002 tiene otro significado funcional y no puede reclasificarse como un
-- poder general. Si una ejecución previa de esta migración en desarrollo llegó
-- a etiquetarlo, se revierte únicamente esa marca demo exacta.
UPDATE public.delegations
SET
  representation_authority_route = NULL,
  representation_evidence_status = NULL,
  representation_source_reference = NULL,
  representation_source_uri = NULL,
  representation_source_hash_sha512 = NULL,
  representation_legal_effect = NULL
WHERE id = 'e1cdf019-0833-4f46-a9e9-df209c6d6ca0'::uuid
  AND code = 'DEL-002'
  AND representation_source_reference =
    'DEMO-SEED:DEL-002:e1cdf019-0833-4f46-a9e9-df209c6d6ca0'
  AND representation_legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT';

-- Título dedicado para recorrer el supuesto del art. 183.1. No representa una
-- escritura ni un poder real: todos sus campos declaran de forma redundante
-- que es una simulación DEMO sin efecto jurídico.
DO $demo_delegation$
DECLARE
  v_source_person_id uuid;
  v_delegate_person_id uuid;
BEGIN
  SELECT source_entity.person_id
    INTO v_source_person_id
    FROM public.entities source_entity
   WHERE source_entity.id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
     AND source_entity.data_class = 'DEMO'
     AND source_entity.person_id IS NOT NULL;

  SELECT delegate_person.id
    INTO v_delegate_person_id
    FROM public.persons delegate_person
   WHERE delegate_person.full_name = 'Dña. Carmen Delgado Ortiz'
     AND delegate_person.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
     AND delegate_person.person_type = 'PF'
     AND delegate_person.data_class = 'DEMO';

  IF v_source_person_id IS NOT NULL AND v_delegate_person_id IS NOT NULL THEN
    INSERT INTO public.delegations (
      id,
      tenant_id,
      code,
      slug,
      delegation_type,
      entity_id,
      grantor_id,
      delegate_id,
      scope,
      limits,
      start_date,
      end_date,
      status,
      representation_authority_route,
      representation_evidence_status,
      representation_source_reference,
      representation_source_uri,
      representation_source_hash_sha512,
      representation_legal_effect
    ) VALUES (
      '3b8da713-8353-4fa9-91c8-917cf0bcb9b3'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'DEMO-REP-183-CARMEN-001',
      'demo-representacion-socio-unico-carmen-art-183-1',
      'PODER_GENERAL_REPRESENTACION_SOCIO_UNICO_DEMO',
      '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid,
      v_source_person_id,
      v_delegate_person_id,
      'ART_183_1_ALL_ASSETS_NATIONAL_TERRITORY_DEMO',
      'DEMO_SIMULATION_NO_LEGAL_EFFECT',
      DATE '2025-01-01',
      NULL,
      'Vigente',
      'GENERAL_PUBLIC_POWER_ART_183_1',
      'DEMO_SIMULATION_NO_LEGAL_EFFECT',
      'DEMO-SEED:REPRESENTATION:CARMEN:ART-183-1:NO-LEGAL-EFFECT',
      NULL,
      NULL,
      'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    )
    ON CONFLICT (id) DO UPDATE
    SET
      tenant_id = EXCLUDED.tenant_id,
      code = EXCLUDED.code,
      slug = EXCLUDED.slug,
      delegation_type = EXCLUDED.delegation_type,
      entity_id = EXCLUDED.entity_id,
      grantor_id = EXCLUDED.grantor_id,
      delegate_id = EXCLUDED.delegate_id,
      scope = EXCLUDED.scope,
      limits = EXCLUDED.limits,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      status = EXCLUDED.status,
      representation_authority_route = EXCLUDED.representation_authority_route,
      representation_evidence_status = EXCLUDED.representation_evidence_status,
      representation_source_reference = EXCLUDED.representation_source_reference,
      representation_source_uri = EXCLUDED.representation_source_uri,
      representation_source_hash_sha512 = EXCLUDED.representation_source_hash_sha512,
      representation_legal_effect = EXCLUDED.representation_legal_effect;
  END IF;
END
$demo_delegation$;

-- ARGA Digital consta participada al 100 % con voto por ARGA Seguros desde
-- 2025-01-01. Se reconcilia el flag derivado y se conserva en metadata la base
-- factual DEMO, sin elevarla a título o documento jurídico externo.
WITH holding_evidence AS (
  SELECT
    target_entity.id AS target_entity_id,
    source_entity.id AS source_entity_id,
    source_entity.person_id AS source_person_id,
    pg_catalog.sum(holding.porcentaje_capital)
      FILTER (
        WHERE holding.holder_person_id = source_entity.person_id
          AND NOT holding.is_treasury
      ) AS source_ownership_percentage,
    pg_catalog.sum(holding.porcentaje_capital)
      FILTER (
        WHERE holding.holder_person_id = source_entity.person_id
          AND NOT holding.is_treasury
          AND holding.voting_rights
      ) AS source_voting_percentage,
    pg_catalog.sum(holding.porcentaje_capital) AS total_ownership_percentage,
    pg_catalog.jsonb_agg(holding.id ORDER BY holding.id) AS holding_ids
  FROM public.entities target_entity
  JOIN public.entities source_entity
    ON source_entity.id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND source_entity.tenant_id = target_entity.tenant_id
  JOIN public.capital_holdings holding
    ON holding.tenant_id = target_entity.tenant_id
   AND holding.entity_id = target_entity.id
   AND holding.effective_from <= DATE '2026-07-20'
   AND (holding.effective_to IS NULL OR holding.effective_to >= DATE '2026-07-20')
  WHERE target_entity.id = 'f653c44c-15ce-4428-b3d3-f4ed17efe93b'::uuid
    AND target_entity.data_class = 'DEMO'
    AND source_entity.data_class = 'DEMO'
  GROUP BY
    target_entity.id,
    source_entity.id,
    source_entity.person_id
  HAVING pg_catalog.count(*) FILTER (WHERE holding.porcentaje_capital IS NULL) = 0
     AND pg_catalog.sum(holding.porcentaje_capital) = 100
     AND pg_catalog.sum(holding.porcentaje_capital)
       FILTER (
         WHERE holding.holder_person_id = source_entity.person_id
           AND NOT holding.is_treasury
       ) = 100
     AND pg_catalog.sum(holding.porcentaje_capital)
       FILTER (
         WHERE holding.holder_person_id = source_entity.person_id
           AND NOT holding.is_treasury
           AND holding.voting_rights
       ) = 100
)
UPDATE public.entities target_entity
SET
  es_unipersonal = true,
  support_docs_metadata = COALESCE(target_entity.support_docs_metadata, '{}'::jsonb)
    || pg_catalog.jsonb_build_object(
      'secretaria_unipersonal_reconciliation_20260720',
      pg_catalog.jsonb_build_object(
        'source_kind', 'CAPITAL_HOLDINGS',
        'effective_date', '2026-07-20',
        'holder_entity_id', evidence.source_entity_id,
        'holder_person_id', evidence.source_person_id,
        'holding_ids', evidence.holding_ids,
        'ownership_percentage', evidence.source_ownership_percentage,
        'voting_percentage', evidence.source_voting_percentage,
        'total_percentage', evidence.total_ownership_percentage,
        'data_class', 'DEMO',
        'legal_effect', 'DEMO_DATA_RECONCILIATION_NO_SOURCE_SUBSTITUTION'
      )
    )
FROM holding_evidence evidence
WHERE target_entity.id = evidence.target_entity_id;

-- ---------------------------------------------------------------------------
-- 3. Trigger autoritativo
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS secretaria_private;
REVOKE ALL ON SCHEMA secretaria_private FROM PUBLIC;

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocatoria_authority_representation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_body public.governing_bodies%ROWTYPE;
  v_source_entity public.entities%ROWTYPE;
  v_source_person public.persons%ROWTYPE;
  v_authority_count bigint;
  v_authority_id uuid;
  v_authority_person_id uuid;
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

DROP TRIGGER IF EXISTS trg_convocatoria_authority_representation_guard
  ON public.convocatorias;
CREATE TRIGGER trg_convocatoria_authority_representation_guard
  BEFORE INSERT OR UPDATE OF
    tenant_id,
    body_id,
    estado,
    fecha_emision,
    fecha_1,
    agenda_items,
    convocante_person_id,
    convocante_authority_evidence_id,
    convocation_authority_route
  ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocatoria_authority_representation_guard();

COMMIT;
