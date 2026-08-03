-- CdA ARGA: censo y representación autoritativos.
--
-- Decisión de dato demo ratificada:
--   * ARGA Seguros S.A. es cotizada.
--   * El Consejo tiene exactamente 15 asientos, todos ocupados por PF:
--     9 INDEPENDIENTE + 5 EJECUTIVO + 1 DOMINICAL.
--   * PRESIDENTE/VICEPRESIDENTE/CONSEJERO_COORDINADOR son roles de asiento;
--     no crean un segundo asiento para la misma persona.
--   * SECRETARIO sin asiento asiste con voz, pero queda fuera de quórum y voto.
--   * ARGA Capital Inversiones SL deja de ser consejera sin borrar historia.
--
-- Aplicar solo tras superar las comprobaciones de target, esquema y contrato.

BEGIN;

-- Un mandato futuro no es CESADO ni puede fingir estar vigente hoy. El estado
-- PROGRAMADO permite reconstruir censos futuros sin contaminar la proyeccion
-- current. authority_evidence comparte el vocabulario porque los cargos con
-- facultad certificante se sincronizan desde condiciones_persona.
ALTER TABLE public.condiciones_persona
  DROP CONSTRAINT IF EXISTS chk_condiciones_persona_estado;
ALTER TABLE public.condiciones_persona
  ADD CONSTRAINT chk_condiciones_persona_estado
  CHECK (estado IN ('VIGENTE', 'PROGRAMADO', 'CESADO'));

ALTER TABLE public.authority_evidence
  DROP CONSTRAINT IF EXISTS authority_evidence_estado_check;
ALTER TABLE public.authority_evidence
  ADD CONSTRAINT authority_evidence_estado_check
  CHECK (estado IN ('VIGENTE', 'PROGRAMADO', 'CESADO'));

-- ---------------------------------------------------------------------------
-- Clasificador único de elegibilidad. Se reutiliza en la remediación y en el
-- gate de delegaciones para evitar que cada escritor interprete el censo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_is_eligible_board_member_at(
  p_body_id uuid,
  p_person_id uuid,
  p_effective_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.condiciones_persona cp
      JOIN public.persons p
        ON p.id = cp.person_id
       AND p.tenant_id = cp.tenant_id
      JOIN public.governing_bodies gb
        ON gb.id = cp.body_id
       AND gb.tenant_id = cp.tenant_id
       AND gb.entity_id = cp.entity_id
      JOIN public.entities e
        ON e.id = gb.entity_id
       AND e.tenant_id = gb.tenant_id
     WHERE cp.body_id = p_body_id
       AND cp.person_id = p_person_id
       AND cp.fecha_inicio <= p_effective_date
       AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= p_effective_date)
       AND (
         cp.estado = 'VIGENTE'
         OR (
           cp.estado = 'PROGRAMADO'
           AND p_effective_date > CURRENT_DATE
         )
         OR (
           cp.estado = 'CESADO'
           AND cp.fecha_fin IS NOT NULL
           AND p_effective_date < CURRENT_DATE
         )
       )
       -- Las fechas mandan dentro de cada estado, pero CESADO nunca se usa
       -- para representar futuro y PROGRAMADO nunca entra en el censo actual.
       AND cp.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
       AND (
         NOT (
           COALESCE(e.es_cotizada, false)
           AND (
             upper(COALESCE(gb.body_type, '')) IN ('CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION')
             OR upper(COALESCE(gb.body_type, '')) LIKE '%CONSEJO%'
           )
         )
         OR p.person_type = 'PF'
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_is_eligible_board_member(
  p_body_id uuid,
  p_person_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT public.fn_secretaria_is_eligible_board_member_at(
    p_body_id,
    p_person_id,
    CURRENT_DATE
  );
$function$;

COMMENT ON FUNCTION public.fn_secretaria_is_eligible_board_member_at(uuid, uuid, date) IS
  'True si la persona ocupa un asiento del Consejo en la fecha efectiva indicada; reconstruye historia/futuro por intervalo y excluye SECRETARIO y PJ de cotizadas.';

COMMENT ON FUNCTION public.fn_secretaria_is_eligible_board_member(uuid, uuid) IS
  'True si la persona ocupa hoy al menos un asiento realmente vigente del Consejo; SECRETARIO no es asiento y, en cotizadas, solo PF es elegible.';

-- ---------------------------------------------------------------------------
-- Remediación de dato demo ARGA. Todo cese conserva la fila histórica.
-- ---------------------------------------------------------------------------

UPDATE public.entities
   SET es_cotizada = true
 WHERE id = '6d7ed736-f263-4531-a59d-c6ca0cd41602';

-- Los datos Cloud arrastraban varios mandatos PF marcados VIGENTE cuyo unico
-- intervalo superaba cuatro anos (incluida Maria Santos Gil). Se conserva cada
-- fila como tramo historico hasta 2024-05-31 y se crea una reeleccion demo
-- sucesiva comun 2024-06-01 -> 2028-05-31. El anclaje comun representa una
-- unica renovacion del CdA, cubre CURRENT_DATE y la reunion objetivo de agosto
-- de 2026, y evita inventar una fecha distinta para cada persona. Los tramos
-- sinteticos NO heredan ACTA_NOMBRAMIENTO ni referencias RM de la fila fuente:
-- se identifican como BOOTSTRAP + DEMO_SIMULATION_NO_LEGAL_EFFECT y dejan los
-- campos registrales a NULL. La fuente legacy se conserva solo en su fila
-- historica original, sin atribuirla a una reeleccion no acreditada.
DO $block$
DECLARE
  v_previous public.condiciones_persona%ROWTYPE;
  v_renewal_id uuid;
  v_first_period_end date;
  v_segment_start date;
  v_segment_end date;
  v_segment_id uuid;
  v_next_id uuid;
  v_previous_segment_id uuid;
  v_renewal_start constant date := DATE '2024-06-01';
  v_renewal_end constant date := DATE '2028-05-31';
  v_case_request_date constant date := DATE '2026-07-20';
  v_target_meeting_date constant date := v_case_request_date + 20;
  v_remediated integer := 0;
BEGIN
  IF v_renewal_start > CURRENT_DATE
     OR v_renewal_end < CURRENT_DATE
     OR v_target_meeting_date NOT BETWEEN v_renewal_start AND v_renewal_end THEN
    RAISE EXCEPTION
      'ARGA_CDA_RENEWAL_WINDOW_INVALID: la reeleccion demo debe cubrir hoy y la reunion objetivo';
  END IF;

  FOR v_previous IN
    SELECT cp.*
      FROM public.condiciones_persona cp
      JOIN public.persons p
        ON p.id = cp.person_id
       AND p.tenant_id = cp.tenant_id
     WHERE cp.tenant_id = '00000000-0000-0000-0000-000000000001'
       AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
       AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
       AND cp.estado = 'VIGENTE'
       AND p.person_type = 'PF'
       AND cp.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND (
         cp.fecha_fin IS NULL
         OR cp.fecha_fin >= (cp.fecha_inicio + INTERVAL '4 years')::date
       )
     ORDER BY cp.person_id, cp.fecha_inicio, cp.id
  LOOP
    IF v_previous.fecha_inicio >= v_renewal_start THEN
      RAISE EXCEPTION
        'ARGA_CDA_RENEWAL_SOURCE_INVALID: mandato % empieza % y no admite tramo historico anterior a %',
        v_previous.id,
        v_previous.fecha_inicio,
        v_renewal_start;
    END IF;

    -- UUID reproducible por fila fuente; no depende del orden ni de gen_random_uuid().
    v_renewal_id := md5(
      'arga-cda-demo-reelection-current-2024-06-01:' || v_previous.id::text
    )::uuid;

    -- El tramo fuente tampoco puede superar cuatro anos. Si el origen es muy
    -- antiguo, se materializan segmentos historicos sucesivos hasta el anclaje
    -- comun, sin huecos ni solapes y conservando el id de la fila original.
    v_first_period_end := LEAST(
      v_renewal_start - 1,
      (
        v_previous.fecha_inicio
        + INTERVAL '4 years'
        - INTERVAL '1 day'
      )::date
    );
    v_segment_start := v_first_period_end + 1;
    v_next_id := CASE
      WHEN v_segment_start < v_renewal_start THEN md5(
        'arga-cda-demo-reelection-history:'
        || v_previous.id::text
        || ':'
        || v_segment_start::text
      )::uuid
      ELSE v_renewal_id
    END;

    UPDATE public.condiciones_persona
       SET estado = 'CESADO',
           fecha_fin = v_first_period_end,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'temporal_correction_source', 'arga_cda_census_authoritative',
             'temporal_correction_reason', 'DEMO_REELECTION_EFFECTIVE_2024-06-01',
             'original_fecha_fin', COALESCE(
               metadata ->> 'original_fecha_fin',
               v_previous.fecha_fin::text
             ),
             'renewed_by_condition_id', v_next_id,
             'historical_record_preserved', true
           )
     WHERE id = v_previous.id;

    v_previous_segment_id := v_previous.id;

    WHILE v_segment_start < v_renewal_start LOOP
      v_segment_end := LEAST(
        v_renewal_start - 1,
        (
          v_segment_start
          + INTERVAL '4 years'
          - INTERVAL '1 day'
        )::date
      );
      v_segment_id := md5(
        'arga-cda-demo-reelection-history:'
        || v_previous.id::text
        || ':'
        || v_segment_start::text
      )::uuid;
      v_next_id := CASE
        WHEN v_segment_end + 1 < v_renewal_start THEN md5(
          'arga-cda-demo-reelection-history:'
          || v_previous.id::text
          || ':'
          || (v_segment_end + 1)::text
        )::uuid
        ELSE v_renewal_id
      END;

      INSERT INTO public.condiciones_persona(
        id,
        tenant_id,
        person_id,
        entity_id,
        body_id,
        tipo_condicion,
        estado,
        fecha_inicio,
        fecha_fin,
        representative_person_id,
        metadata,
        fuente_designacion,
        inscripcion_rm_referencia,
        inscripcion_rm_fecha
      ) VALUES (
        v_segment_id,
        v_previous.tenant_id,
        v_previous.person_id,
        v_previous.entity_id,
        v_previous.body_id,
        v_previous.tipo_condicion,
        'CESADO',
        v_segment_start,
        v_segment_end,
        NULL,
        (
          COALESCE(v_previous.metadata, '{}'::jsonb)
          - 'renewed_by_condition_id'
          - 'renewal_of_condition_id'
        ) || jsonb_build_object(
          'source', 'arga_cda_census_authoritative',
          'source_kind', 'DEMO_REELECTION',
          'source_phase', 'HISTORICAL',
          'source_reference', 'ARGA_CDA_REELECCION_2024-06-01',
          'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
          'provenance_status', 'SYNTHETIC_DEMO_NOT_SOURCE_EVIDENCE',
          'designation_evidence_status', 'NO_ACTA_NO_RM_EVIDENCE',
          'renewal_of_condition_id', v_previous_segment_id,
          'renewal_origin_condition_id', v_previous.id,
          'renewed_by_condition_id', v_next_id,
          'maximum_term_years', 4,
          'historical_source_preserved', true
        ),
        'BOOTSTRAP',
        NULL,
        NULL
      )
      ON CONFLICT (id) DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
          FROM public.condiciones_persona segment
         WHERE segment.id = v_segment_id
           AND segment.person_id = v_previous.person_id
           AND segment.estado = 'CESADO'
           AND segment.fecha_inicio = v_segment_start
           AND segment.fecha_fin = v_segment_end
           AND segment.metadata ->> 'source_kind' = 'DEMO_REELECTION'
           AND segment.metadata ->> 'source_phase' = 'HISTORICAL'
           AND segment.metadata ->> 'legal_effect' = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
           AND segment.metadata ->> 'designation_evidence_status' = 'NO_ACTA_NO_RM_EVIDENCE'
           AND segment.metadata ->> 'renewal_origin_condition_id' = v_previous.id::text
           AND segment.fuente_designacion = 'BOOTSTRAP'
           AND segment.inscripcion_rm_referencia IS NULL
           AND segment.inscripcion_rm_fecha IS NULL
      ) THEN
        RAISE EXCEPTION
          'ARGA_CDA_RENEWAL_HISTORY_CONFLICT: el segmento historico % no coincide con su fuente',
          v_segment_id;
      END IF;

      v_previous_segment_id := v_segment_id;
      v_segment_start := v_segment_end + 1;
    END LOOP;

    INSERT INTO public.condiciones_persona(
      id,
      tenant_id,
      person_id,
      entity_id,
      body_id,
      tipo_condicion,
      estado,
      fecha_inicio,
      fecha_fin,
      representative_person_id,
      metadata,
      fuente_designacion,
      inscripcion_rm_referencia,
      inscripcion_rm_fecha
    ) VALUES (
      v_renewal_id,
      v_previous.tenant_id,
      v_previous.person_id,
      v_previous.entity_id,
      v_previous.body_id,
      v_previous.tipo_condicion,
      'VIGENTE',
      v_renewal_start,
      v_renewal_end,
      NULL,
      (
        COALESCE(v_previous.metadata, '{}'::jsonb)
        - 'renewed_by_condition_id'
        - 'renewal_of_condition_id'
      )
        || jsonb_build_object(
          'source', 'arga_cda_census_authoritative',
          'source_kind', 'DEMO_REELECTION',
          'source_phase', 'CURRENT',
          'source_reference', 'ARGA_CDA_REELECCION_2024-06-01',
          'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
          'provenance_status', 'SYNTHETIC_DEMO_NOT_SOURCE_EVIDENCE',
          'designation_evidence_status', 'NO_ACTA_NO_RM_EVIDENCE',
          'renewal_of_condition_id', v_previous_segment_id,
          'renewal_origin_condition_id', v_previous.id,
          'renewal_term_years', 4,
          'historical_source_preserved', true
        ),
      'BOOTSTRAP',
      -- No se fabrica ni se propaga designacion/inscripcion: esta reeleccion
      -- existe unicamente para la simulacion temporal del prototipo.
      NULL,
      NULL
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1
        FROM public.condiciones_persona renewal
       WHERE renewal.id = v_renewal_id
         AND renewal.person_id = v_previous.person_id
         AND renewal.entity_id = v_previous.entity_id
         AND renewal.body_id = v_previous.body_id
         AND renewal.estado = 'VIGENTE'
         AND renewal.fecha_inicio = v_renewal_start
         AND renewal.fecha_fin = v_renewal_end
         AND renewal.metadata ->> 'source_kind' = 'DEMO_REELECTION'
         AND renewal.metadata ->> 'source_phase' = 'CURRENT'
         AND renewal.metadata ->> 'legal_effect' = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
         AND renewal.metadata ->> 'designation_evidence_status' = 'NO_ACTA_NO_RM_EVIDENCE'
         AND renewal.metadata ->> 'renewal_of_condition_id' = v_previous_segment_id::text
         AND renewal.metadata ->> 'renewal_origin_condition_id' = v_previous.id::text
         AND renewal.fuente_designacion = 'BOOTSTRAP'
         AND renewal.inscripcion_rm_referencia IS NULL
         AND renewal.inscripcion_rm_fecha IS NULL
    ) THEN
      RAISE EXCEPTION
        'ARGA_CDA_RENEWAL_CONFLICT: la reeleccion determinista de % no coincide con su fuente',
        v_previous.id;
    END IF;

    v_remediated := v_remediated + 1;
  END LOOP;

  IF EXISTS (
    SELECT 1
      FROM public.condiciones_persona cp
      JOIN public.persons p
        ON p.id = cp.person_id
       AND p.tenant_id = cp.tenant_id
     WHERE cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
       AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
       AND cp.estado = 'VIGENTE'
       AND p.person_type = 'PF'
       AND cp.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND (
         cp.fecha_fin IS NULL
         OR cp.fecha_fin >= (cp.fecha_inicio + INTERVAL '4 years')::date
       )
  ) THEN
    RAISE EXCEPTION 'ARGA_CDA_RENEWAL_INCOMPLETE: quedan mandatos PF superiores a cuatro anos';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.condiciones_persona cp
      JOIN public.persons p
        ON p.id = cp.person_id
       AND p.tenant_id = cp.tenant_id
     WHERE cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
       AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
       AND p.person_type = 'PF'
       AND cp.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND (
         cp.estado = 'VIGENTE'
         OR cp.metadata ->> 'temporal_correction_source' = 'arga_cda_census_authoritative'
         OR cp.metadata ->> 'source_kind' = 'DEMO_REELECTION'
       )
       AND (
         cp.fecha_fin IS NULL
         OR cp.fecha_fin < cp.fecha_inicio
         OR cp.fecha_fin >= (cp.fecha_inicio + INTERVAL '4 years')::date
       )
  ) THEN
    RAISE EXCEPTION
      'ARGA_CDA_RENEWAL_TERM_INVALID: algun tramo vigente o historificado supera cuatro anos';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.condiciones_persona left_period
      JOIN public.condiciones_persona right_period
        ON right_period.tenant_id = left_period.tenant_id
       AND right_period.body_id = left_period.body_id
       AND right_period.person_id = left_period.person_id
       AND right_period.id > left_period.id
      JOIN public.persons p
        ON p.id = left_period.person_id
       AND p.tenant_id = left_period.tenant_id
     WHERE left_period.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
       AND left_period.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
       AND p.person_type = 'PF'
       AND left_period.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND right_period.tipo_condicion IN (
         'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
       AND (
         left_period.metadata ->> 'source_kind' = 'DEMO_REELECTION'
         OR right_period.metadata ->> 'source_kind' = 'DEMO_REELECTION'
       )
       AND daterange(left_period.fecha_inicio, left_period.fecha_fin, '[]')
           && daterange(right_period.fecha_inicio, right_period.fecha_fin, '[]')
  ) THEN
    RAISE EXCEPTION
      'ARGA_CDA_RENEWAL_OVERLAP: la cadena historica de reelecciones contiene periodos solapados';
  END IF;
END;
$block$;

UPDATE public.condiciones_persona
   SET estado = 'CESADO',
       fecha_fin = GREATEST(
         fecha_inicio,
         LEAST(COALESCE(fecha_fin, CURRENT_DATE), CURRENT_DATE)
       ),
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
         'archived_by', 'arga_cda_census_authoritative',
         'archive_reason', 'PJ_NOT_ELIGIBLE_FOR_LISTED_BOARD_SEAT',
         'archived_at', CURRENT_DATE
       )
 WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
   AND body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
   AND person_id = '00000000-0000-0000-0000-000000000110'
   AND estado = 'VIGENTE'
   AND fecha_inicio <= CURRENT_DATE
   AND tipo_condicion IN (
     'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
   );

-- Si una persona arrastrase dos roles de asiento, se conserva el rol de mayor
-- precedencia y se cesan los demás. SECRETARIO no participa en esta deduplicación
-- porque puede coexistir con un asiento sin convertirse en asiento adicional.
WITH ranked_seats AS (
  SELECT
    cp.id,
    row_number() OVER (
      PARTITION BY cp.person_id
      ORDER BY
        CASE cp.tipo_condicion
          WHEN 'PRESIDENTE' THEN 1
          WHEN 'VICEPRESIDENTE' THEN 2
          WHEN 'CONSEJERO_COORDINADOR' THEN 3
          ELSE 4
        END,
        cp.fecha_inicio,
        cp.id
    ) AS seat_rank
  FROM public.condiciones_persona cp
  JOIN public.persons p
    ON p.id = cp.person_id
   AND p.tenant_id = cp.tenant_id
  WHERE cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
    AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
    AND cp.estado = 'VIGENTE'
    AND cp.fecha_inicio <= CURRENT_DATE
    AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
    AND p.person_type = 'PF'
    AND cp.tipo_condicion IN (
      'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
    )
)
UPDATE public.condiciones_persona cp
   SET estado = 'CESADO',
       fecha_fin = GREATEST(
         cp.fecha_inicio,
         LEAST(COALESCE(cp.fecha_fin, CURRENT_DATE), CURRENT_DATE)
       ),
       metadata = COALESCE(cp.metadata, '{}'::jsonb) || jsonb_build_object(
         'archived_by', 'arga_cda_census_authoritative',
         'archive_reason', 'DUPLICATE_ACTIVE_BOARD_SEAT_ROLE',
         'archived_at', CURRENT_DATE
       )
  FROM ranked_seats rs
 WHERE cp.id = rs.id
   AND rs.seat_rank > 1;

-- Normaliza las categorías preservando preferentemente las cuatro personas ya
-- etiquetadas EJECUTIVO además del Presidente. Para el asiento DOMINICAL se usa
-- primero el representante PF histórico de la PJ cesada si ya ocupa asiento; si
-- no, se elige determinísticamente un miembro no Presidente.
DO $block$
DECLARE
  v_president_id uuid;
  v_dominical_id uuid;
  v_executive_ids uuid[];
  v_total_pf integer;
  v_distinct_pf integer;
  v_independientes integer;
  v_ejecutivos integer;
  v_dominicales integer;
  v_active_pj integer;
  v_secretary_count integer;
  v_secretary_voters integer;
  v_invalid_vigente_periods integer;
  v_invalid_seat_terms integer;
  v_is_listed boolean;
BEGIN
  SELECT COALESCE(e.es_cotizada, false)
    INTO v_is_listed
    FROM public.entities e
   WHERE e.id = '6d7ed736-f263-4531-a59d-c6ca0cd41602';

  IF v_is_listed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: ARGA Seguros debe ser cotizada';
  END IF;

  SELECT cp.person_id
    INTO v_president_id
    FROM public.condiciones_persona cp
    JOIN public.persons p ON p.id = cp.person_id
   WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.estado = 'VIGENTE'
     AND cp.fecha_inicio <= CURRENT_DATE
     AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
     AND cp.tipo_condicion = 'PRESIDENTE'
     AND p.person_type = 'PF';

  IF v_president_id IS NULL THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: falta Presidente PF vigente';
  END IF;

  SELECT cp.representative_person_id
    INTO v_dominical_id
    FROM public.condiciones_persona cp
   WHERE cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.person_id = '00000000-0000-0000-0000-000000000110'
   ORDER BY cp.created_at DESC, cp.id DESC
   LIMIT 1;

  IF v_dominical_id IS NULL
     OR v_dominical_id = v_president_id
     OR NOT public.fn_secretaria_is_eligible_board_member(
       'fe05ddd9-ce3e-47b0-8948-5b975c79ab59',
       v_dominical_id
     ) THEN
    SELECT cp.person_id
      INTO v_dominical_id
      FROM public.condiciones_persona cp
      JOIN public.persons p ON p.id = cp.person_id
     WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
       AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
       AND cp.estado = 'VIGENTE'
       AND cp.fecha_inicio <= CURRENT_DATE
       AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
       AND p.person_type = 'PF'
       AND cp.person_id <> v_president_id
       AND cp.tipo_condicion IN (
         'CONSEJERO','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
       )
     ORDER BY
       (COALESCE(cp.metadata, '{}'::jsonb) ->> 'categoria' = 'DOMINICAL') DESC,
       (COALESCE(cp.metadata, '{}'::jsonb) ->> 'categoria' = 'INDEPENDIENTE') DESC,
       cp.person_id
     LIMIT 1;
  END IF;

  IF v_dominical_id IS NULL THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: no hay candidato PF para asiento DOMINICAL';
  END IF;

  SELECT array_agg(candidate.person_id ORDER BY candidate.preferred_exec DESC, candidate.person_id)
    INTO v_executive_ids
    FROM (
      SELECT
        cp.person_id,
        bool_or(COALESCE(cp.metadata, '{}'::jsonb) ->> 'categoria' = 'EJECUTIVO') AS preferred_exec
      FROM public.condiciones_persona cp
      JOIN public.persons p ON p.id = cp.person_id
      WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
        AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
        AND cp.estado = 'VIGENTE'
        AND cp.fecha_inicio <= CURRENT_DATE
        AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
        AND p.person_type = 'PF'
        AND cp.person_id NOT IN (v_president_id, v_dominical_id)
        AND cp.tipo_condicion IN (
          'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
        )
      GROUP BY cp.person_id
      ORDER BY preferred_exec DESC, cp.person_id
      LIMIT 4
    ) candidate;

  IF COALESCE(cardinality(v_executive_ids), 0) <> 4 THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: no se pudieron determinar los 4 ejecutivos además del Presidente';
  END IF;

  UPDATE public.condiciones_persona cp
     SET metadata = COALESCE(cp.metadata, '{}'::jsonb) || jsonb_build_object(
       'categoria', CASE
         WHEN cp.person_id = v_dominical_id THEN 'DOMINICAL'
         WHEN cp.person_id = v_president_id OR cp.person_id = ANY (v_executive_ids) THEN 'EJECUTIVO'
         ELSE 'INDEPENDIENTE'
       END,
       'cargo_consejo', CASE cp.tipo_condicion
         WHEN 'PRESIDENTE' THEN 'PRESIDENTE'
         WHEN 'VICEPRESIDENTE' THEN 'VICEPRESIDENTE'
         WHEN 'CONSEJERO_COORDINADOR' THEN 'CONSEJERO_COORDINADOR'
         ELSE 'VOCAL'
       END,
       'source', 'arga_cda_census_demo_configuration',
       'category_assignment_kind', 'DEMO_CONFIGURATION',
       'category_legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT',
       'category_evidence_status', 'NO_ACTA_NO_RM_EVIDENCE'
     )
    FROM public.persons p
   WHERE cp.person_id = p.id
     AND cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.estado = 'VIGENTE'
     AND cp.fecha_inicio <= CURRENT_DATE
     AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
     AND p.person_type = 'PF'
     AND cp.tipo_condicion IN (
       'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
     );

  SELECT
    count(*),
    count(DISTINCT cp.person_id),
    count(DISTINCT cp.person_id) FILTER (WHERE cp.metadata ->> 'categoria' = 'INDEPENDIENTE'),
    count(DISTINCT cp.person_id) FILTER (WHERE cp.metadata ->> 'categoria' = 'EJECUTIVO'),
    count(DISTINCT cp.person_id) FILTER (WHERE cp.metadata ->> 'categoria' = 'DOMINICAL')
  INTO
    v_total_pf,
    v_distinct_pf,
    v_independientes,
    v_ejecutivos,
    v_dominicales
  FROM public.condiciones_persona cp
  JOIN public.persons p ON p.id = cp.person_id
  WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
    AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
    AND cp.estado = 'VIGENTE'
    AND cp.fecha_inicio <= CURRENT_DATE
    AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
    AND p.person_type = 'PF'
    AND cp.tipo_condicion IN (
      'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
    );

  SELECT count(*)
    INTO v_active_pj
    FROM public.condiciones_persona cp
    JOIN public.persons p ON p.id = cp.person_id
   WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.estado = 'VIGENTE'
     AND cp.fecha_inicio <= CURRENT_DATE
     AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
     AND p.person_type = 'PJ'
     AND cp.tipo_condicion IN (
       'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
     );

  SELECT
    count(DISTINCT secretary.person_id),
    count(DISTINCT secretary.person_id) FILTER (
      WHERE public.fn_secretaria_is_eligible_board_member(
        secretary.body_id,
        secretary.person_id
      )
    )
    INTO v_secretary_count, v_secretary_voters
    FROM public.condiciones_persona secretary
   WHERE secretary.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND secretary.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND secretary.estado = 'VIGENTE'
     AND secretary.fecha_inicio <= CURRENT_DATE
     AND (secretary.fecha_fin IS NULL OR secretary.fecha_fin >= CURRENT_DATE)
     AND secretary.tipo_condicion = 'SECRETARIO';

  SELECT count(*)
    INTO v_invalid_vigente_periods
    FROM public.condiciones_persona cp
   WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.estado = 'VIGENTE'
     AND (
       cp.fecha_inicio > CURRENT_DATE
       OR (cp.fecha_fin IS NOT NULL AND cp.fecha_fin < CURRENT_DATE)
     );

  SELECT count(*)
    INTO v_invalid_seat_terms
    FROM public.condiciones_persona cp
   WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND cp.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND cp.estado = 'VIGENTE'
     AND cp.tipo_condicion IN (
       'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
     )
     AND (
       cp.fecha_fin IS NULL
       OR cp.fecha_fin < cp.fecha_inicio
       OR cp.fecha_fin >= (cp.fecha_inicio + INTERVAL '4 years')::date
     );

  IF v_total_pf <> 15 OR v_distinct_pf <> 15 THEN
    RAISE EXCEPTION
      'ARGA_CDA_INVARIANT: se esperaban 15 asientos PF únicos; filas=%, personas=%',
      v_total_pf,
      v_distinct_pf;
  END IF;
  IF v_independientes <> 9 OR v_ejecutivos <> 5 OR v_dominicales <> 1 THEN
    RAISE EXCEPTION
      'ARGA_CDA_INVARIANT: reparto esperado 9/5/1; obtenido IND=% EJE=% DOM=%',
      v_independientes,
      v_ejecutivos,
      v_dominicales;
  END IF;
  IF v_active_pj <> 0 THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: quedan PJ con asiento vigente en Consejo cotizada';
  END IF;
  IF v_secretary_count <> 1 THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: se esperaba exactamente una Secretaria vigente';
  END IF;
  IF v_secretary_voters <> 0 THEN
    RAISE EXCEPTION 'ARGA_CDA_INVARIANT: la secretaria no consejera no puede computar en quórum/voto';
  END IF;
  IF v_invalid_vigente_periods <> 0 THEN
    RAISE EXCEPTION
      'ARGA_CDA_INVARIANT: quedan % condiciones VIGENTE fuera de su intervalo temporal',
      v_invalid_vigente_periods;
  END IF;
  IF v_invalid_seat_terms <> 0 THEN
    RAISE EXCEPTION
      'ARGA_CDA_INVARIANT: quedan % mandatos de consejero sin fecha_fin valida o superiores a cuatro anos',
      v_invalid_seat_terms;
  END IF;
END;
$block$;

-- Archiva delegaciones activas del Consejo ARGA que involucren a la PJ cesada
-- o a una persona que no figure en el censo elegible. No se borran evidencias.
UPDATE public.representaciones r
   SET effective_to = GREATEST(r.effective_from, CURRENT_DATE),
       evidence = COALESCE(r.evidence, '{}'::jsonb) || jsonb_build_object(
         'archived_by', 'arga_cda_census_authoritative',
         'archive_reason', 'BOARD_REPRESENTATION_PARTY_NOT_ELIGIBLE',
         'archived_at', CURRENT_DATE
       )
  FROM public.meetings m
  JOIN public.governing_bodies gb ON gb.id = m.body_id
 WHERE r.meeting_id = m.id
   AND r.scope = 'CONSEJO_DELEGACION'
   AND r.effective_to IS NULL
   AND gb.id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
   AND (
     r.represented_person_id = '00000000-0000-0000-0000-000000000110'
     OR r.representative_person_id = '00000000-0000-0000-0000-000000000110'
     OR NOT public.fn_secretaria_is_eligible_board_member(gb.id, r.represented_person_id)
     OR NOT public.fn_secretaria_is_eligible_board_member(gb.id, r.representative_person_id)
   );

-- ---------------------------------------------------------------------------
-- Gates de escritura: no PJ, no dos roles-asiento activos, y delegación solo
-- entre dos integrantes elegibles del mismo Consejo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_listed_board_condition_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_es_cotizada boolean;
  v_body_type text;
  v_person_type text;
  v_seat_roles text[] := ARRAY[
    'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
  ];
BEGIN
  IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < NEW.fecha_inicio THEN
    RAISE EXCEPTION
      'CONDITION_PERIOD_INVALID: fecha_fin % no puede ser anterior a fecha_inicio %',
      NEW.fecha_fin,
      NEW.fecha_inicio;
  END IF;

  IF NEW.estado = 'VIGENTE'
     AND (
       NEW.fecha_inicio > CURRENT_DATE
       OR (NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < CURRENT_DATE)
     ) THEN
    RAISE EXCEPTION
      'CONDITION_VIGENTE_OUTSIDE_PERIOD: VIGENTE exige que CURRENT_DATE este dentro de fecha_inicio/fecha_fin';
  END IF;

  IF NEW.estado = 'PROGRAMADO'
     AND NEW.fecha_inicio <= CURRENT_DATE THEN
    RAISE EXCEPTION
      'CONDITION_PROGRAMMED_PERIOD_INVALID: PROGRAMADO exige fecha_inicio posterior a CURRENT_DATE';
  END IF;

  IF NEW.estado = 'CESADO'
     AND (
       NEW.fecha_inicio > CURRENT_DATE
       OR NEW.fecha_fin IS NULL
       OR NEW.fecha_fin > CURRENT_DATE
     ) THEN
    RAISE EXCEPTION
      'CONDITION_CEASED_PERIOD_INVALID: CESADO exige un intervalo cerrado que no alcance el futuro';
  END IF;

  IF NOT (NEW.tipo_condicion = ANY (v_seat_roles)) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(e.es_cotizada, false), upper(COALESCE(gb.body_type, '')), p.person_type
    INTO v_es_cotizada, v_body_type, v_person_type
    FROM public.governing_bodies gb
    JOIN public.entities e
      ON e.id = gb.entity_id
     AND e.tenant_id = gb.tenant_id
    JOIN public.persons p
      ON p.id = NEW.person_id
     AND p.tenant_id = NEW.tenant_id
   WHERE gb.id = NEW.body_id
     AND gb.entity_id = NEW.entity_id
     AND gb.tenant_id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOARD_CENSUS_SCOPE_INVALID: persona, entidad y órgano deben compartir tenant y ámbito';
  END IF;

  IF NOT v_es_cotizada
     OR NOT (
       v_body_type IN ('CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION')
       OR v_body_type LIKE '%CONSEJO%'
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW.fecha_fin IS NULL
     OR NEW.fecha_fin >= (NEW.fecha_inicio + INTERVAL '4 years')::date THEN
    RAISE EXCEPTION
      'LISTED_BOARD_TERM_TOO_LONG: un mandato de consejero de cotizada exige fecha_fin y no puede superar cuatro anos';
  END IF;

  IF NEW.estado IN ('VIGENTE', 'PROGRAMADO') AND v_person_type <> 'PF' THEN
    RAISE EXCEPTION 'LISTED_BOARD_PJ_FORBIDDEN: una PJ no puede ocupar un asiento del Consejo de una cotizada';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.body_id::text || ':' || NEW.person_id::text, 0)
  );

  IF COALESCE(NEW.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
     AND EXISTS (
    SELECT 1
      FROM public.condiciones_persona cp
     WHERE cp.body_id = NEW.body_id
       AND cp.person_id = NEW.person_id
       AND cp.tipo_condicion = ANY (v_seat_roles)
       AND COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
       AND cp.id IS DISTINCT FROM NEW.id
       AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= cp.fecha_inicio)
       AND daterange(cp.fecha_inicio, cp.fecha_fin, '[]')
           && daterange(NEW.fecha_inicio, NEW.fecha_fin, '[]')
  ) THEN
    RAISE EXCEPTION
      'LISTED_BOARD_SEAT_PERIOD_OVERLAP: una persona no puede tener dos roles-asiento con periodos solapados; se permiten mandatos sucesivos';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_listed_board_condition_guard
  ON public.condiciones_persona;
CREATE TRIGGER trg_secretaria_listed_board_condition_guard
  BEFORE INSERT OR UPDATE ON public.condiciones_persona
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_listed_board_condition_guard();

CREATE OR REPLACE FUNCTION public.fn_secretaria_board_representation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_body_id uuid;
  v_entity_id uuid;
  v_tenant_id uuid;
  v_body_type text;
  v_effective_date date;
BEGIN
  IF NEW.scope <> 'CONSEJO_DELEGACION' THEN
    RETURN NEW;
  END IF;

  SELECT
    gb.id,
    gb.entity_id,
    gb.tenant_id,
    upper(COALESCE(gb.body_type, '')),
    m.scheduled_start::date
    INTO v_body_id, v_entity_id, v_tenant_id, v_body_type, v_effective_date
    FROM public.meetings m
    JOIN public.governing_bodies gb
      ON gb.id = m.body_id
     AND gb.tenant_id = m.tenant_id
   WHERE m.id = NEW.meeting_id;

  IF NOT FOUND
     OR NOT (
       v_body_type IN ('CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION')
       OR v_body_type LIKE '%CONSEJO%'
     ) THEN
    RAISE EXCEPTION 'BOARD_REPRESENTATION_SCOPE_INVALID: CONSEJO_DELEGACION exige reunión de Consejo';
  END IF;

  IF NEW.entity_id <> v_entity_id OR NEW.tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'BOARD_REPRESENTATION_SCOPE_INVALID: delegación, reunión y Consejo deben compartir tenant y entidad';
  END IF;

  IF NEW.represented_person_id = NEW.representative_person_id THEN
    RAISE EXCEPTION 'BOARD_REPRESENTATION_SELF_FORBIDDEN: representado y representante deben ser personas distintas';
  END IF;

  IF v_effective_date IS NULL THEN
    RAISE EXCEPTION
      'BOARD_REPRESENTATION_MEETING_DATE_REQUIRED: la reunion debe tener scheduled_start para validar la delegacion';
  END IF;

  IF NEW.effective_to IS NOT NULL AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION
      'BOARD_REPRESENTATION_PERIOD_INVALID: effective_to no puede ser anterior a effective_from';
  END IF;

  -- Una revocacion/cierre anterior a la reunion queda fuera de su censo y es
  -- licita. Si el intervalo alcanza la reunion, ambas partes deben ocupar
  -- asiento precisamente en scheduled_start, no en la fecha de carga.
  IF NEW.effective_from > v_effective_date
     OR (NEW.effective_to IS NOT NULL AND NEW.effective_to < v_effective_date) THEN
    RETURN NEW;
  END IF;

  IF NOT public.fn_secretaria_is_eligible_board_member_at(
    v_body_id,
    NEW.represented_person_id,
    v_effective_date
  ) THEN
    RAISE EXCEPTION 'BOARD_REPRESENTED_NOT_ELIGIBLE: el representado no ocupa asiento en la fecha de la reunion';
  END IF;

  IF NOT public.fn_secretaria_is_eligible_board_member_at(
    v_body_id,
    NEW.representative_person_id,
    v_effective_date
  ) THEN
    RAISE EXCEPTION 'BOARD_REPRESENTATIVE_NOT_ELIGIBLE: el representante no ocupa asiento en la fecha de la reunion';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_board_representation_guard
  ON public.representaciones;
CREATE TRIGGER trg_secretaria_board_representation_guard
  BEFORE INSERT OR UPDATE ON public.representaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_board_representation_guard();

-- ---------------------------------------------------------------------------
-- Proyección política: una fila por asiento/persona. SECRETARIO no entra.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_refresh_parte_votante_body(p_body_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_es_cotizada boolean;
  v_is_board boolean;
BEGIN
  SELECT
    COALESCE(e.es_cotizada, false),
    (
      upper(COALESCE(gb.body_type, '')) IN ('CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION')
      OR upper(COALESCE(gb.body_type, '')) LIKE '%CONSEJO%'
    )
    INTO v_es_cotizada, v_is_board
    FROM public.governing_bodies gb
    JOIN public.entities e
      ON e.id = gb.entity_id
     AND e.tenant_id = gb.tenant_id
   WHERE gb.id = p_body_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOARD_CENSUS_BODY_NOT_FOUND: órgano %', p_body_id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('parte_votante_body:' || p_body_id::text, 0)
  );

  DELETE FROM public.parte_votante_current
   WHERE body_id = p_body_id;

  INSERT INTO public.parte_votante_current(
    tenant_id,
    entity_id,
    body_id,
    person_id,
    source_type,
    source_id,
    voting_rights,
    voting_weight,
    denominator_weight
  )
  SELECT
    seat.tenant_id,
    seat.entity_id,
    seat.body_id,
    seat.person_id,
    'CARGO',
    seat.id,
    true,
    1.0,
    1.0
  FROM (
    SELECT DISTINCT ON (cp.person_id)
      cp.id,
      cp.tenant_id,
      cp.entity_id,
      cp.body_id,
      cp.person_id
    FROM public.condiciones_persona cp
    JOIN public.persons p
      ON p.id = cp.person_id
     AND p.tenant_id = cp.tenant_id
    WHERE cp.body_id = p_body_id
      AND cp.estado = 'VIGENTE'
      AND cp.fecha_inicio <= CURRENT_DATE
      AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURRENT_DATE)
      AND COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
      AND cp.tipo_condicion IN (
        'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
      )
      AND (NOT (v_es_cotizada AND v_is_board) OR p.person_type = 'PF')
    ORDER BY
      cp.person_id,
      CASE cp.tipo_condicion
        WHEN 'PRESIDENTE' THEN 1
        WHEN 'VICEPRESIDENTE' THEN 2
        WHEN 'CONSEJERO_COORDINADOR' THEN 3
        ELSE 4
      END,
      cp.fecha_inicio,
      cp.id
  ) seat;
END;
$function$;

-- La proyección es regenerable: elimina posibles duplicados legacy antes de
-- convertir la regla de una fila por persona/cuerpo en invariante física.
WITH duplicate_projection AS (
  SELECT
    pvc.id,
    row_number() OVER (
      PARTITION BY pvc.tenant_id, pvc.body_id, pvc.person_id
      ORDER BY pvc.generated_at DESC, pvc.id DESC
    ) AS projection_rank
  FROM public.parte_votante_current pvc
  WHERE pvc.body_id IS NOT NULL
    AND pvc.source_type = 'CARGO'
)
DELETE FROM public.parte_votante_current pvc
USING duplicate_projection duplicate
WHERE pvc.id = duplicate.id
  AND duplicate.projection_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_parte_votante_current_body_person_cargo
  ON public.parte_votante_current(tenant_id, body_id, person_id)
  WHERE body_id IS NOT NULL AND source_type = 'CARGO';

-- ---------------------------------------------------------------------------
-- Snapshot: conserva payload array-compatible, añade los totales verificables
-- a cada fila y aborta si la proyección no es única por persona.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_crear_censo_snapshot(
  p_meeting_id uuid,
  p_session_kind text,
  p_entity_id uuid,
  p_body_id uuid,
  p_snapshot_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_id uuid;
  v_audit_worm_id uuid;
  v_tenant_id uuid;
  v_source_tenant_id uuid;
  v_source_entity_id uuid;
  v_source_body_id uuid;
  v_effective_date date;
  v_body_type text;
  v_census_source_type text;
  v_is_shareholders_body boolean := false;
  v_is_political_body boolean := false;
  v_projection_count integer;
  v_distinct_person_count integer;
  v_total_partes integer;
  v_denominator_total numeric;
  v_payload jsonb;
BEGIN
  SELECT e.tenant_id
    INTO v_tenant_id
    FROM public.entities e
   WHERE e.id = p_entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CENSUS_ENTITY_NOT_FOUND: entidad %', p_entity_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_tenant_id THEN
      RAISE EXCEPTION 'CENSUS_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  CASE p_session_kind
    WHEN 'MEETING' THEN
      SELECT m.tenant_id, gb.entity_id, m.body_id, m.scheduled_start::date
        INTO v_source_tenant_id, v_source_entity_id, v_source_body_id, v_effective_date
        FROM public.meetings m
        JOIN public.governing_bodies gb
          ON gb.id = m.body_id
         AND gb.tenant_id = m.tenant_id
       WHERE m.id = p_meeting_id;
    WHEN 'NO_SESSION' THEN
      SELECT
        ns.tenant_id,
        gb.entity_id,
        ns.body_id,
        COALESCE(ns.closed_at, ns.opened_at, ns.created_at)::date
        INTO v_source_tenant_id, v_source_entity_id, v_source_body_id, v_effective_date
        FROM public.no_session_resolutions ns
        JOIN public.governing_bodies gb
          ON gb.id = ns.body_id
         AND gb.tenant_id = ns.tenant_id
       WHERE ns.id = p_meeting_id;
    WHEN 'UNIPERSONAL' THEN
      SELECT
        ud.tenant_id,
        ud.entity_id,
        NULL::uuid,
        COALESCE(ud.decision_date, ud.created_at::date)
        INTO v_source_tenant_id, v_source_entity_id, v_source_body_id, v_effective_date
        FROM public.unipersonal_decisions ud
       WHERE ud.id = p_meeting_id;
    ELSE
      RAISE EXCEPTION 'CENSUS_SESSION_KIND_INVALID: %', p_session_kind;
  END CASE;

  IF v_source_tenant_id IS NULL THEN
    RAISE EXCEPTION
      'CENSUS_SOURCE_NOT_FOUND: session_kind=% source_id=%',
      p_session_kind,
      p_meeting_id;
  END IF;

  IF v_effective_date IS NULL THEN
    RAISE EXCEPTION
      'CENSUS_EFFECTIVE_DATE_REQUIRED: session_kind=% source_id=%',
      p_session_kind,
      p_meeting_id;
  END IF;

  IF v_source_tenant_id IS DISTINCT FROM v_tenant_id
     OR v_source_entity_id IS DISTINCT FROM p_entity_id
     OR v_source_body_id IS DISTINCT FROM p_body_id THEN
    RAISE EXCEPTION
      'CENSUS_SOURCE_SCOPE_MISMATCH: session_kind, tenant, entidad y órgano deben coincidir';
  END IF;

  IF p_body_id IS NOT NULL THEN
    SELECT upper(COALESCE(gb.body_type, ''))
      INTO v_body_type
      FROM public.governing_bodies gb
     WHERE gb.id = p_body_id
       AND gb.entity_id = p_entity_id
       AND gb.tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CENSUS_SCOPE_INVALID: órgano, entidad y tenant no coinciden';
    END IF;

    v_is_shareholders_body := (
      v_body_type IN (
        'JUNTA', 'JGA', 'JUNTA_GENERAL', 'JUNTA_GENERAL_ACCIONISTAS',
        'JUNTA_GENERAL_SOCIOS'
      )
      OR v_body_type LIKE 'JUNTA%'
    );
    v_is_political_body := (
      v_body_type IN (
        'CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION',
        'COMISION', 'COMITE'
      )
      OR v_body_type LIKE '%CONSEJO%'
    );

    IF p_snapshot_type = 'UNIVERSAL' AND NOT v_is_shareholders_body THEN
      RAISE EXCEPTION
        'CENSUS_UNIVERSAL_JGA_ONLY: UNIVERSAL no puede usar capital_holdings para órgano %',
        v_body_type;
    END IF;

    IF v_is_political_body THEN
      v_census_source_type := 'POLITICO';
      IF p_snapshot_type IS DISTINCT FROM 'POLITICO' THEN
        RAISE EXCEPTION
          'CENSUS_BODY_SNAPSHOT_TYPE_MISMATCH: órgano % exige POLITICO, recibido %',
          v_body_type,
          p_snapshot_type;
      END IF;
    ELSIF v_is_shareholders_body THEN
      v_census_source_type := 'ECONOMICO';
      IF p_snapshot_type IS NULL
         OR p_snapshot_type NOT IN ('ECONOMICO', 'UNIVERSAL') THEN
        RAISE EXCEPTION
          'CENSUS_BODY_SNAPSHOT_TYPE_MISMATCH: JGA exige ECONOMICO o modalidad UNIVERSAL, recibido %',
          p_snapshot_type;
      END IF;
    ELSE
      RAISE EXCEPTION
        'CENSUS_BODY_TYPE_UNSUPPORTED: body_type=% no tiene fuente de censo autoritativa',
        v_body_type;
    END IF;
  ELSE
    -- Las decisiones unipersonales se reconstruyen desde titularidad; no son
    -- una Junta universal y por ello no pueden usar dicha modalidad.
    v_census_source_type := 'ECONOMICO';
    IF p_snapshot_type = 'UNIVERSAL' THEN
      RAISE EXCEPTION 'CENSUS_UNIVERSAL_JGA_ONLY: UNIVERSAL solo es modalidad de una JGA';
    ELSIF p_snapshot_type IS DISTINCT FROM 'ECONOMICO' THEN
      RAISE EXCEPTION
        'CENSUS_BODY_SNAPSHOT_TYPE_MISMATCH: acto sin órgano exige ECONOMICO, recibido %',
        p_snapshot_type;
    END IF;
  END IF;

  -- El snapshot NO refresca parte_votante_current: esa tabla representa hoy y
  -- no debe quedar contaminada por una reunion futura. El payload WORM se
  -- calcula directamente de las fuentes autoritativas a v_effective_date.
  IF v_census_source_type = 'POLITICO' THEN
    IF p_body_id IS NULL THEN
      RAISE EXCEPTION 'CENSUS_POLITICAL_BODY_REQUIRED';
    END IF;

    -- Nunca se oculta una doble fuente efectiva mediante DISTINCT ON. Cada
    -- persona debe tener exactamente una condición que cuente asiento. Un rol
    -- accesorio solo se exceptúa si lleva el marcador contractual explícito
    -- metadata.seat_semantics=ACCESSORY y coexiste con una única fuente PRIMARY.
    IF EXISTS (
      SELECT cp.person_id
        FROM public.condiciones_persona cp
        JOIN public.persons p
          ON p.id = cp.person_id
         AND p.tenant_id = cp.tenant_id
        JOIN public.governing_bodies gb
          ON gb.id = cp.body_id
         AND gb.entity_id = cp.entity_id
         AND gb.tenant_id = cp.tenant_id
        JOIN public.entities e
          ON e.id = gb.entity_id
         AND e.tenant_id = gb.tenant_id
       WHERE cp.body_id = p_body_id
         AND cp.fecha_inicio <= v_effective_date
         AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= v_effective_date)
         AND (
           cp.estado = 'VIGENTE'
           OR (
             cp.estado = 'PROGRAMADO'
             AND v_effective_date > CURRENT_DATE
           )
           OR (
             cp.estado = 'CESADO'
             AND cp.fecha_fin IS NOT NULL
             AND v_effective_date < CURRENT_DATE
           )
         )
         AND cp.tipo_condicion IN (
           'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
         )
         AND (
           NOT (
             COALESCE(e.es_cotizada, false)
             AND (
               upper(COALESCE(gb.body_type, '')) IN (
                 'CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION'
               )
               OR upper(COALESCE(gb.body_type, '')) LIKE '%CONSEJO%'
             )
           )
           OR p.person_type = 'PF'
         )
       GROUP BY cp.person_id
      HAVING count(*) FILTER (
        WHERE COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
      ) <> 1
    ) THEN
      RAISE EXCEPTION
        'CENSUS_EFFECTIVE_SEAT_SOURCE_CARDINALITY: cada persona exige una única fuente PRIMARY en órgano=% fecha=%',
        p_body_id,
        v_effective_date;
    END IF;

    WITH effective_seats AS MATERIALIZED (
      SELECT
        cp.id AS source_id,
        cp.tenant_id,
        cp.entity_id,
        cp.body_id,
        cp.person_id,
        cp.tipo_condicion AS seat_role,
        cp.metadata AS source_metadata
      FROM public.condiciones_persona cp
      JOIN public.persons p
        ON p.id = cp.person_id
       AND p.tenant_id = cp.tenant_id
      JOIN public.governing_bodies gb
        ON gb.id = cp.body_id
       AND gb.entity_id = cp.entity_id
       AND gb.tenant_id = cp.tenant_id
      JOIN public.entities e
        ON e.id = gb.entity_id
       AND e.tenant_id = gb.tenant_id
      WHERE cp.body_id = p_body_id
        AND cp.fecha_inicio <= v_effective_date
        AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= v_effective_date)
        AND (
          cp.estado = 'VIGENTE'
          OR (
            cp.estado = 'PROGRAMADO'
            AND v_effective_date > CURRENT_DATE
          )
          OR (
            cp.estado = 'CESADO'
            AND cp.fecha_fin IS NOT NULL
            AND v_effective_date < CURRENT_DATE
          )
        )
        AND cp.tipo_condicion IN (
          'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
        )
        AND COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'
        AND (
          NOT (
            COALESCE(e.es_cotizada, false)
            AND (
              upper(COALESCE(gb.body_type, '')) IN (
                'CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION'
              )
              OR upper(COALESCE(gb.body_type, '')) LIKE '%CONSEJO%'
            )
          )
          OR p.person_type = 'PF'
        )
    ), enriched AS (
      SELECT
        seat.*,
        (count(*) OVER ())::integer AS snapshot_total_partes,
        (count(*) OVER ())::numeric AS snapshot_denominator_total
      FROM effective_seats seat
    )
    SELECT
      count(*)::integer,
      count(DISTINCT person_id)::integer,
      COALESCE(max(snapshot_denominator_total), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'tenant_id', tenant_id,
            'entity_id', entity_id,
            'body_id', body_id,
            'person_id', person_id,
            'seat_person_id', person_id,
            'source_type', 'CARGO',
            'source_id', source_id,
            'seat_role', seat_role,
            'source_metadata', source_metadata,
            'voting_rights', true,
            'voting_weight', 1.0,
            'denominator_weight', 1.0,
            'effective_date', v_effective_date,
            'snapshot_total_partes', snapshot_total_partes,
            'snapshot_denominator_total', snapshot_denominator_total
          )
          ORDER BY person_id, source_id
        ),
        '[]'::jsonb
      )
      INTO
        v_projection_count,
        v_distinct_person_count,
        v_denominator_total,
        v_payload
      FROM enriched;

    IF v_projection_count <> v_distinct_person_count THEN
      RAISE EXCEPTION
        'CENSUS_DUPLICATE_SEAT: proyeccion=% personas_distintas=% fecha_efectiva=%',
        v_projection_count,
        v_distinct_person_count,
        v_effective_date;
    END IF;

    v_total_partes := v_distinct_person_count;
  ELSIF v_census_source_type = 'ECONOMICO' THEN
    WITH effective_holdings AS MATERIALIZED (
      SELECT
        ch.id AS source_id,
        ch.tenant_id,
        ch.entity_id,
        NULL::uuid AS body_id,
        COALESCE(rep.representative_person_id, ch.holder_person_id) AS person_id,
        ch.voting_rights,
        CASE
          WHEN ch.voting_rights AND NOT ch.is_treasury
            THEN COALESCE(ch.porcentaje_capital, 0) * COALESCE(sc.votes_per_title, 1)
          ELSE 0
        END AS voting_weight,
        CASE
          WHEN NOT ch.is_treasury THEN COALESCE(ch.porcentaje_capital, 0)
          ELSE 0
        END AS denominator_weight
      FROM public.capital_holdings ch
      LEFT JOIN public.share_classes sc ON sc.id = ch.share_class_id
      LEFT JOIN LATERAL (
        SELECT r.representative_person_id
          FROM public.representaciones r
         WHERE r.represented_person_id = ch.holder_person_id
           AND r.entity_id = ch.entity_id
           AND r.scope = 'ADMIN_PJ_REPRESENTANTE'
           AND r.effective_from <= v_effective_date
           AND (r.effective_to IS NULL OR r.effective_to >= v_effective_date)
         ORDER BY r.effective_from DESC, r.id DESC
         LIMIT 1
      ) rep ON true
      WHERE ch.entity_id = p_entity_id
        AND ch.effective_from <= v_effective_date
        AND (ch.effective_to IS NULL OR ch.effective_to >= v_effective_date)
    ), enriched AS (
      SELECT
        holding.*,
        (count(*) OVER ())::integer AS snapshot_total_partes,
        COALESCE(sum(holding.denominator_weight) OVER (), 0)::numeric
          AS snapshot_denominator_total
      FROM effective_holdings holding
    )
    SELECT
      count(*)::integer,
      count(DISTINCT person_id)::integer,
      COALESCE(max(snapshot_denominator_total), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'tenant_id', tenant_id,
            'entity_id', entity_id,
            'body_id', body_id,
            'person_id', person_id,
            'source_type', 'CAPITAL',
            'source_id', source_id,
            'voting_rights', voting_rights,
            'voting_weight', voting_weight,
            'denominator_weight', denominator_weight,
            'effective_date', v_effective_date,
            'snapshot_total_partes', snapshot_total_partes,
            'snapshot_denominator_total', snapshot_denominator_total
          )
          ORDER BY person_id, source_id
        ),
        '[]'::jsonb
      )
      INTO
        v_projection_count,
        v_distinct_person_count,
        v_denominator_total,
        v_payload
      FROM enriched;

    -- Una persona puede mantener varias clases/posiciones economicas.
    v_total_partes := v_projection_count;
  ELSE
    RAISE EXCEPTION 'CENSUS_SNAPSHOT_TYPE_INVALID: %', v_census_source_type;
  END IF;

  -- Capacidad transaccional consumida por el trigger autoritativo. Al ser la
  -- RPC SECURITY DEFINER (owner=postgres), un cliente authenticated no puede
  -- reproducir el doble requisito current_user+GUC con DML directo.
  PERFORM pg_catalog.set_config(
    'secretaria.authoritative_writer',
    'fn_crear_censo_snapshot',
    true
  );

  INSERT INTO public.censo_snapshot(
    tenant_id,
    meeting_id,
    session_kind,
    entity_id,
    body_id,
    snapshot_type,
    payload,
    capital_total_base,
    total_partes
  ) VALUES (
    v_tenant_id,
    p_meeting_id,
    p_session_kind,
    p_entity_id,
    p_body_id,
    p_snapshot_type,
    v_payload,
    v_denominator_total,
    v_total_partes
  )
  RETURNING id, audit_worm_id INTO v_id, v_audit_worm_id;

  IF v_audit_worm_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.audit_log al
     WHERE al.id = v_audit_worm_id
       AND al.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'CENSUS_AUDIT_WORM_REQUIRED: el snapshot no obtuvo audit_worm_id válido';
  END IF;

  RETURN v_id;
END;
$function$;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
     WHERE trigger_row.tgrelid = 'public.censo_snapshot'::regclass
       AND trigger_row.tgname = 'trg_censo_snapshot_worm'
       AND trigger_row.tgenabled <> 'D'
       AND trigger_row.tgisinternal IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'CENSUS_AUDIT_WORM_TRIGGER_REQUIRED: trg_censo_snapshot_worm no está activo';
  END IF;
END;
$block$;

REVOKE ALL ON FUNCTION public.fn_refresh_parte_votante_entity(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_refresh_parte_votante_body(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_refresh_parte_votante_entity(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_refresh_parte_votante_body(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_crear_censo_snapshot(uuid, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_censo_snapshot(uuid, text, uuid, uuid, text)
  TO authenticated, service_role;

-- Regenera la proyección canónica y verifica el denominador sin crear un
-- snapshot WORM artificial durante la migración.
SELECT public.fn_refresh_parte_votante_body(
  'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
);

DO $block$
DECLARE
  v_rows integer;
  v_persons integer;
  v_denominator numeric;
BEGIN
  SELECT count(*), count(DISTINCT person_id), COALESCE(sum(denominator_weight), 0)
    INTO v_rows, v_persons, v_denominator
    FROM public.parte_votante_current
   WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
     AND entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     AND source_type = 'CARGO';

  IF v_rows <> 15 OR v_persons <> 15 OR v_denominator <> 15 THEN
    RAISE EXCEPTION
      'ARGA_CDA_CENSUS_INVALID: filas=% personas=% denominador=%',
      v_rows,
      v_persons,
      v_denominator;
  END IF;
END;
$block$;

-- ---------------------------------------------------------------------------
-- Incorporación posterior de inscripción RM: evento append-only + proyección.
--
-- condiciones_persona y authority_evidence conservan la referencia operativa,
-- pero solo se rellenan si estaba vacía y nunca se sustituyen por otra prueba.
-- El hecho autoritativo es este evento inmutable, enlazado a audit_log WORM.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cargo_rm_registration_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  condicion_id uuid NOT NULL
    REFERENCES public.condiciones_persona(id) ON DELETE RESTRICT,
  authority_evidence_id uuid
    REFERENCES public.authority_evidence(id) ON DELETE RESTRICT,
  inscripcion_rm_referencia text NOT NULL
    CHECK (btrim(inscripcion_rm_referencia) <> ''),
  inscripcion_rm_fecha date NOT NULL
    CHECK (inscripcion_rm_fecha <= CURRENT_DATE),
  idempotency_key text,
  audit_worm_id uuid NOT NULL
    REFERENCES public.audit_log(id) ON DELETE RESTRICT,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cargo_rm_event_fact
  ON public.cargo_rm_registration_events(
    tenant_id,
    condicion_id,
    inscripcion_rm_referencia,
    inscripcion_rm_fecha
  );
CREATE UNIQUE INDEX IF NOT EXISTS ux_cargo_rm_event_idempotency
  ON public.cargo_rm_registration_events(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.cargo_rm_registration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_rm_registration_events_tenant_read
  ON public.cargo_rm_registration_events;
CREATE POLICY cargo_rm_registration_events_tenant_read
  ON public.cargo_rm_registration_events
  FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

CREATE OR REPLACE FUNCTION public.fn_cargo_rm_registration_event_worm_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION
    'CARGO_RM_EVENT_WORM: los eventos de inscripción RM no admiten %',
    TG_OP
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_cargo_rm_registration_event_worm
  ON public.cargo_rm_registration_events;
CREATE TRIGGER trg_cargo_rm_registration_event_worm
  BEFORE UPDATE OR DELETE ON public.cargo_rm_registration_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cargo_rm_registration_event_worm_guard();

CREATE OR REPLACE FUNCTION public.fn_registrar_inscripcion_rm_cargo(
  p_tenant_id uuid,
  p_condicion_id uuid,
  p_inscripcion_rm_referencia text,
  p_inscripcion_rm_fecha date,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_condicion public.condiciones_persona%ROWTYPE;
  v_authority public.authority_evidence%ROWTYPE;
  v_reference text := NULLIF(btrim(COALESCE(p_inscripcion_rm_referencia, '')), '');
  v_idempotency_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_event_id uuid;
  v_audit_worm_id uuid;
  v_audit_hash text;
  v_requires_authority boolean;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_capability(p_tenant_id, 'CARGO_MANAGEMENT');

  IF p_condicion_id IS NULL THEN
    RAISE EXCEPTION 'RM_CONDITION_REQUIRED';
  END IF;
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'RM_REFERENCE_REQUIRED: la referencia registral no puede estar vacía';
  END IF;
  IF p_inscripcion_rm_fecha IS NULL OR p_inscripcion_rm_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'RM_DATE_INVALID: la fecha de inscripción es obligatoria y no puede ser futura';
  END IF;

  SELECT cp.*
    INTO v_condicion
    FROM public.condiciones_persona cp
   WHERE cp.id = p_condicion_id
     AND cp.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'RM_CONDITION_NOT_FOUND: condición % no pertenece al tenant %',
      p_condicion_id,
      p_tenant_id;
  END IF;

  PERFORM public.fn_secretaria_assert_caller_authority_rm(
    p_tenant_id,
    v_condicion.entity_id,
    v_condicion.body_id
  );

  IF v_idempotency_key IS NOT NULL THEN
    SELECT event.id
      INTO v_event_id
      FROM public.cargo_rm_registration_events event
     WHERE event.tenant_id = p_tenant_id
       AND event.idempotency_key = v_idempotency_key;
    IF v_event_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
          FROM public.cargo_rm_registration_events event
         WHERE event.id = v_event_id
           AND event.condicion_id = p_condicion_id
           AND event.inscripcion_rm_referencia = v_reference
           AND event.inscripcion_rm_fecha = p_inscripcion_rm_fecha
      ) THEN
        RAISE EXCEPTION
          'RM_IDEMPOTENCY_CONFLICT: la clave ya identifica otra inscripción';
      END IF;
      RETURN v_event_id;
    END IF;
  END IF;

  SELECT event.id
    INTO v_event_id
    FROM public.cargo_rm_registration_events event
   WHERE event.tenant_id = p_tenant_id
     AND event.condicion_id = p_condicion_id
     AND event.inscripcion_rm_referencia = v_reference
     AND event.inscripcion_rm_fecha = p_inscripcion_rm_fecha;
  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  IF v_condicion.inscripcion_rm_referencia IS NOT NULL
     AND btrim(v_condicion.inscripcion_rm_referencia) <> v_reference THEN
    RAISE EXCEPTION
      'RM_EVIDENCE_IMMUTABLE_CONFLICT: el cargo ya tiene otra referencia RM';
  END IF;
  IF v_condicion.inscripcion_rm_fecha IS NOT NULL
     AND v_condicion.inscripcion_rm_fecha <> p_inscripcion_rm_fecha THEN
    RAISE EXCEPTION
      'RM_EVIDENCE_IMMUTABLE_CONFLICT: el cargo ya tiene otra fecha RM';
  END IF;

  v_requires_authority := v_condicion.tipo_condicion = ANY (ARRAY[
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO'
  ]::text[]);

  SELECT ae.*
    INTO v_authority
    FROM public.authority_evidence ae
   WHERE ae.tenant_id = p_tenant_id
     AND ae.entity_id = v_condicion.entity_id
     AND ae.person_id = v_condicion.person_id
     AND COALESCE(ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(v_condicion.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND ae.cargo = v_condicion.tipo_condicion
     AND ae.fecha_inicio = v_condicion.fecha_inicio
     AND ae.estado = v_condicion.estado
   ORDER BY ae.created_at DESC, ae.id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_requires_authority AND v_authority.id IS NULL THEN
    RAISE EXCEPTION
      'RM_AUTHORITY_EVIDENCE_REQUIRED: el cargo certificante no tiene evidencia de autoridad sincronizada';
  END IF;
  IF v_authority.id IS NOT NULL
     AND v_authority.inscripcion_rm_referencia IS NOT NULL
     AND btrim(v_authority.inscripcion_rm_referencia) <> v_reference THEN
    RAISE EXCEPTION
      'RM_EVIDENCE_IMMUTABLE_CONFLICT: authority_evidence ya tiene otra referencia RM';
  END IF;
  IF v_authority.id IS NOT NULL
     AND v_authority.inscripcion_rm_fecha IS NOT NULL
     AND v_authority.inscripcion_rm_fecha <> p_inscripcion_rm_fecha THEN
    RAISE EXCEPTION
      'RM_EVIDENCE_IMMUTABLE_CONFLICT: authority_evidence ya tiene otra fecha RM';
  END IF;

  v_event_id := gen_random_uuid();

  -- La capacidad solo se activa después de autenticar tenant, capability,
  -- autoridad y de comprobar la inmutabilidad de cualquier prueba previa.
  PERFORM pg_catalog.set_config(
    'secretaria.authoritative_writer',
    'fn_registrar_inscripcion_rm_cargo',
    true
  );

  UPDATE public.condiciones_persona
     SET inscripcion_rm_referencia = COALESCE(inscripcion_rm_referencia, v_reference),
         inscripcion_rm_fecha = COALESCE(inscripcion_rm_fecha, p_inscripcion_rm_fecha),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'rm_registration_event_id', v_event_id,
           'rm_registration_recorded_at', now()
         )
   WHERE id = p_condicion_id
     AND tenant_id = p_tenant_id;

  IF v_authority.id IS NOT NULL THEN
    UPDATE public.authority_evidence
       SET inscripcion_rm_referencia = COALESCE(inscripcion_rm_referencia, v_reference),
           inscripcion_rm_fecha = COALESCE(inscripcion_rm_fecha, p_inscripcion_rm_fecha),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'rm_registration_event_id', v_event_id,
             'rm_registration_recorded_at', now()
           ),
           updated_at = now()
     WHERE id = v_authority.id;
  END IF;

  INSERT INTO public.audit_log(
    tenant_id,
    actor_id,
    action,
    object_type,
    object_id,
    table_name,
    record_id,
    delta
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    'CARGO_RM_REGISTRATION_APPENDED',
    'cargo_rm_registration_event',
    v_event_id,
    'cargo_rm_registration_events',
    v_event_id,
    jsonb_build_object(
      'condicion_id', p_condicion_id,
      'authority_evidence_id', v_authority.id,
      'inscripcion_rm_referencia', v_reference,
      'inscripcion_rm_fecha', p_inscripcion_rm_fecha
    )
  )
  RETURNING id, hash_sha512 INTO v_audit_worm_id, v_audit_hash;

  IF v_audit_worm_id IS NULL OR v_audit_hash IS NULL THEN
    RAISE EXCEPTION 'RM_AUDIT_WORM_REQUIRED: no se generó evidencia WORM';
  END IF;

  INSERT INTO public.cargo_rm_registration_events(
    id,
    tenant_id,
    condicion_id,
    authority_evidence_id,
    inscripcion_rm_referencia,
    inscripcion_rm_fecha,
    idempotency_key,
    audit_worm_id,
    recorded_by,
    metadata
  ) VALUES (
    v_event_id,
    p_tenant_id,
    p_condicion_id,
    v_authority.id,
    v_reference,
    p_inscripcion_rm_fecha,
    v_idempotency_key,
    v_audit_worm_id,
    auth.uid(),
    jsonb_build_object('source_rpc', 'fn_registrar_inscripcion_rm_cargo')
  );

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON TABLE public.cargo_rm_registration_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.cargo_rm_registration_events
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_cargo_rm_registration_event_worm_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registrar_inscripcion_rm_cargo(uuid, uuid, text, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_inscripcion_rm_cargo(uuid, uuid, text, date, text)
  TO authenticated, service_role;

COMMENT ON TABLE public.cargo_rm_registration_events IS
  'Ledger append-only de incorporaciones posteriores de inscripción registral a cargos; cada evento referencia audit_log WORM.';
COMMENT ON FUNCTION public.fn_registrar_inscripcion_rm_cargo(uuid, uuid, text, date, text) IS
  'Añade de forma idempotente una prueba RM no futura, rellena una sola vez sus proyecciones de cargo/autoridad y rechaza cualquier sustitución de evidencia distinta.';

-- ---------------------------------------------------------------------------
-- P0: cierre de escritores autoritativos.
--
-- RLS no basta mientras existan policies FOR ALL. Los RPC SECURITY DEFINER
-- gobernados reciben una capacidad GUC local; un trigger exige simultaneamente
-- current_user=postgres (owner confirmado de esos RPC) y el scope exacto. Un
-- authenticated puede escribir el nombre del GUC, pero no convertirse en el
-- owner del SECURITY DEFINER, por lo que no puede fabricar cargo, autoridad,
-- representacion ni payload WORM mediante DML directo.
-- ---------------------------------------------------------------------------

DO $block$
DECLARE
  writer record;
  function_definition text;
  begin_marker constant text := E'\nBEGIN\n';
  begin_position integer;
  authorization_marker constant text :=
    'PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, NULL, NULL);';
  authorization_position integer;
  injection text;
  expected_call text;
  patched_count integer := 0;
BEGIN
  FOR writer IN
    SELECT p.oid, p.proname
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'fn_designar_cargo',
         'fn_cesar_cargo',
         'fn_consolidate_person',
         'fn_upsert_representante_admin_pj',
         'fn_upsert_representacion_puntual',
         'fn_close_representacion_puntual'
       )
       AND p.prosecdef IS TRUE
       AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
     ORDER BY p.proname, p.oid
  LOOP
    function_definition := pg_catalog.pg_get_functiondef(writer.oid);
    expected_call := format(
      'pg_catalog.set_config(%L, %L, true)',
      'secretaria.authoritative_writer',
      writer.proname
    );

    IF position(expected_call IN function_definition) = 0 THEN
      IF writer.proname = 'fn_consolidate_person' THEN
        -- La consolidación recorre FK dinámicamente. Su scope se activa solo
        -- después de tenant, capability PERSON_CONSOLIDATE y autoridad RM.
        IF position(
          'fn_secretaria_assert_tenant_access(p_tenant_id)'
          IN function_definition
        ) = 0 OR position('PERSON_CONSOLIDATE' IN function_definition) = 0 THEN
          RAISE EXCEPTION
            'AUTHORITATIVE_WRITER_PATCH_FAILED: % no conserva tenant/capability guard',
            writer.proname;
        END IF;
        authorization_position := position(authorization_marker IN function_definition);
        IF authorization_position = 0 THEN
          RAISE EXCEPTION
            'AUTHORITATIVE_WRITER_PATCH_FAILED: falta cierre de autorización en %',
            writer.proname;
        END IF;
        injection := format(
          E'\n  PERFORM pg_catalog.set_config(%L, %L, true);',
          'secretaria.authoritative_writer',
          writer.proname
        );
        function_definition := overlay(
          function_definition
          PLACING injection
          FROM authorization_position + length(authorization_marker)
          FOR 0
        );
      ELSE
        begin_position := position(begin_marker IN function_definition);
        IF begin_position = 0 THEN
          RAISE EXCEPTION
            'AUTHORITATIVE_WRITER_PATCH_FAILED: no se encontro BEGIN en %',
            writer.proname;
        END IF;

        injection := format(
          E'\nBEGIN\n  PERFORM pg_catalog.set_config(%L, %L, true);\n',
          'secretaria.authoritative_writer',
          writer.proname
        );
        function_definition := overlay(
          function_definition
          PLACING injection
          FROM begin_position
          FOR length(begin_marker)
        );
      END IF;
      EXECUTE function_definition;
    END IF;

    SELECT pg_catalog.pg_get_functiondef(p.oid)
      INTO function_definition
      FROM pg_catalog.pg_proc p
     WHERE p.oid = writer.oid;
    IF position(expected_call IN function_definition) = 0 THEN
      RAISE EXCEPTION
        'AUTHORITATIVE_WRITER_PATCH_UNVERIFIED: % no contiene su capacidad exacta',
        writer.proname;
    END IF;

    patched_count := patched_count + 1;
  END LOOP;

  IF patched_count <> 6 THEN
    RAISE EXCEPTION
      'AUTHORITATIVE_WRITER_RPC_SET_INCOMPLETE: esperados=6 encontrados=%',
      patched_count;
  END IF;
END;
$block$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_authoritative_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  writer_scope text := current_setting('secretaria.authoritative_writer', true);
  scope_allowed boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'AUTHORITATIVE_DELETE_FORBIDDEN: % es historica/WORM y no admite DELETE',
      TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  scope_allowed := CASE TG_TABLE_NAME
    WHEN 'censo_snapshot' THEN
      TG_OP = 'INSERT' AND writer_scope = 'fn_crear_censo_snapshot'
    WHEN 'condiciones_persona' THEN
      writer_scope IN (
        'fn_designar_cargo',
        'fn_cesar_cargo',
        'fn_consolidate_person',
        'fn_registrar_inscripcion_rm_cargo'
      )
    WHEN 'representaciones' THEN
      writer_scope IN (
        'fn_designar_cargo',
        'fn_consolidate_person',
        'fn_upsert_representante_admin_pj',
        'fn_upsert_representacion_puntual',
        'fn_close_representacion_puntual'
      )
    WHEN 'authority_evidence' THEN
      -- Solo el trigger fn_sync_authority_evidence, ejecutado dentro del mismo
      -- RPC de cargo, alcanza esta tabla con dicho scope local.
      writer_scope IN (
        'fn_designar_cargo',
        'fn_cesar_cargo',
        'fn_consolidate_person',
        'fn_registrar_inscripcion_rm_cargo'
      )
    ELSE false
  END;

  IF current_user <> 'postgres' OR scope_allowed IS NOT TRUE THEN
    RAISE EXCEPTION
      'AUTHORITATIVE_WRITE_RPC_REQUIRED: tabla=% operacion=% writer=% role=%',
      TG_TABLE_NAME,
      TG_OP,
      COALESCE(writer_scope, '<none>'),
      current_user
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_authoritative_writer_guard
  ON public.censo_snapshot;
CREATE TRIGGER trg_00_authoritative_writer_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.censo_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_authoritative_write_guard();

DROP TRIGGER IF EXISTS trg_00_authoritative_writer_guard
  ON public.condiciones_persona;
CREATE TRIGGER trg_00_authoritative_writer_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.condiciones_persona
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_authoritative_write_guard();

DROP TRIGGER IF EXISTS trg_00_authoritative_writer_guard
  ON public.representaciones;
CREATE TRIGGER trg_00_authoritative_writer_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.representaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_authoritative_write_guard();

DROP TRIGGER IF EXISTS trg_00_authoritative_writer_guard
  ON public.authority_evidence;
CREATE TRIGGER trg_00_authoritative_writer_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.authority_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_authoritative_write_guard();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.censo_snapshot
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.condiciones_persona
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.representaciones
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.authority_evidence
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.censo_snapshot
  TO authenticated, service_role;
GRANT SELECT ON TABLE public.condiciones_persona
  TO authenticated, service_role;
GRANT SELECT ON TABLE public.representaciones
  TO authenticated, service_role;
GRANT SELECT ON TABLE public.authority_evidence
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_secretaria_authoritative_write_guard()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_refresh_parte_votante_body(uuid) IS
  'Regenera la proyeccion politica realmente vigente hoy: estado VIGENTE mas intervalo actual, una fila por asiento/persona, sin Secretaria no consejera.';

COMMENT ON FUNCTION public.fn_crear_censo_snapshot(uuid, text, uuid, uuid, text) IS
  'Crea snapshot WORM a la fecha efectiva: órganos colegiados usan censo político y JGA/acto unipersonal titularidad económica; UNIVERSAL solo es modalidad JGA.';

COMMENT ON TRIGGER trg_secretaria_listed_board_condition_guard
  ON public.condiciones_persona IS
  'Exige VIGENTE actual, PROGRAMADO futuro y CESADO histórico; en Consejos de cotizadas impide PJ, mandatos superiores a cuatro anos y asientos PRIMARY solapados.';

COMMENT ON TRIGGER trg_secretaria_board_representation_guard
  ON public.representaciones IS
  'Impide delegaciones activas de Consejo si cualquiera de las partes no ocupa un asiento elegible.';

COMMIT;
