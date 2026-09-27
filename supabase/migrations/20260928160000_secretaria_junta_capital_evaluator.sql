-- MOI-143 — evaluador de quórum y mayoría por capital para el acta de una
-- Junta, y retirada de la excepción de bloqueo del constructor del
-- manifiesto SOLO ahora que ese evaluador existe y se invoca.
--
-- CONTEXTO. `fn_secretaria_build_minute_legal_manifest` cerraba en bloque
-- TODA Junta ("… economic Junta quorum requires the dedicated capital
-- evaluator before legal finalization", 20260720120000). Esta migración
-- construye ese evaluador dedicado y quita el cierre — únicamente para
-- Junta con censo ECONOMICO; las sesiones UNIVERSAL siguen cerradas sin
-- tocar (esa comprobación es anterior e independiente y no se toca aquí).
--
-- DECISIONES TÉCNICAS (dejadas en comentario, tal como pide el issue):
--
-- 1. La "base de cómputo declarada" es un CRITERIO LEGAL por expediente
--    (docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md §4), no
--    un número que el cliente pueda simplemente escribir en
--    `meetings.quorum_data`. Por eso el evaluador NO se fía de
--    `quorum_data.base_votos`: lo RECALCULA desde el propio censo_snapshot
--    ECONOMICO congelado (nunca desde capital_holdings en vivo, para no
--    poder derivar un valor distinto al que se ve el día de la Junta) y
--    EXIGE que coincida con lo declarado. Solo dos códigos de
--    `base_computo` están dados de alta, cada uno con su fórmula server-
--    side sobre `share_classes.class_code`:
--      - VOTOS_CLASE_A_NO_AUTOCARTERA          (Garrigues, 16.900 votos)
--      - TODAS_LAS_CLASES_CON_VOTO_SIN_AUTOCARTERA (D-29, grupo nuevo/
--        cualquier Junta de una sola clase "una acción, un voto")
--    Un `base_computo` fuera de esta lista falla cerrado: extenderla es
--    una decisión del Comité Legal, no un valor libre.
--
-- 2. El censo_snapshot ECONOMICO no guardaba ni la clase ni el voto crudo
--    por titularidad — solo `voting_weight` normalizado a 100 sobre TODAS
--    las clases ("base íntegra"). Sin eso no se puede recomponer ni la
--    base de clase A ni el 0,8875 % del acta. Se añaden dos claves
--    ADITIVAS al payload (`share_class_code`, `raw_votes`): no se toca
--    `voting_weight` ni `denominator_weight`, así que ningún consumidor
--    existente cambia. Los censo_snapshot YA congelados (WORM, inmutables)
--    se quedan sin estas claves: si esa Junta se cierra de verdad, hará
--    falta un snapshot posterior a esta migración.
--
-- 3. Mayoría: art. 201.1 LSC — mayoría ORDINARIA (favor > contra del
--    capital presente o representado), no la fórmula de mayoría absoluta
--    de concurrentes de un colegiado (art. 248.1, la que usa el evaluador
--    de CDA). Las mayorías REFORZADAS por materia (arts. 194/201.2) NO se
--    modelan: es un punto legal reservado y se deja abierto.
--
-- 4. Quórum: el evaluador exige solo el suelo "algún voto elegible
--    concurrió" (concurrent_weight > 0). El porcentaje mínimo de
--    constitución de primera/segunda convocatoria (art. 193 LSC) depende
--    de qué llamada es y de los Estatutos: también reservado al Comité
--    Legal, y por eso el gate GENÉRICO de "mayoría de asientos" que ya
--    tenía el manifiesto (pensado para un colegiado de asiento único) se
--    desactiva para Junta en vez de aplicarse mal.
--
-- 5. Representación: la Junta usa `representaciones.scope = 'JUNTA_PROXY'`
--    (ya dado de alta desde 20260421112722/20260514181001), no
--    'CONSEJO_DELEGACION'. El manifiesto pasa a elegir el scope según el
--    tipo de órgano en el único punto donde lo comprobaba en duro.
--
-- 6. Sin firma, envío, entrega ni interacción real con EAD Trust: esta
--    migración no toca custodia/certificación (MOI-144 sigue abierta).
CREATE OR REPLACE FUNCTION public.fn_crear_censo_snapshot(p_meeting_id uuid, p_session_kind text, p_entity_id uuid, p_body_id uuid, p_snapshot_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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
            THEN 100.0 * (COALESCE(ch.numero_titulos, 0) * COALESCE(sc.votes_per_title, 1))
                 / NULLIF(SUM(CASE WHEN ch.voting_rights AND NOT ch.is_treasury
                                   THEN COALESCE(ch.numero_titulos, 0) * COALESCE(sc.votes_per_title, 1)
                                   ELSE 0 END) OVER (), 0)
          ELSE 0
        END AS voting_weight,
        CASE
          WHEN NOT ch.is_treasury THEN COALESCE(ch.porcentaje_capital, 0)
          ELSE 0
        END AS denominator_weight,
        -- MOI-143: voto crudo (títulos × votos/título), sin normalizar y ya
        -- a cero para no-voto/autocartera igual que voting_weight arriba.
        -- Es lo que el evaluador de capital necesita para recomponer la
        -- base de cómputo DECLARADA por expediente (posiblemente por
        -- clase), que el % normalizado a 100 sobre TODAS las clases no
        -- puede reconstruir.
        CASE
          WHEN ch.voting_rights AND NOT ch.is_treasury
            THEN COALESCE(ch.numero_titulos, 0) * COALESCE(sc.votes_per_title, 1)
          ELSE 0
        END AS raw_votes,
        sc.class_code AS share_class_code
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
            'raw_votes', raw_votes,
            'share_class_code', share_class_code,
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
$function$
;

-- MOI-143: evaluador de quórum y mayoría por capital, dedicado a Junta con
-- censo ECONOMICO. Espejo autoritativo (servidor) de
-- src/lib/secretaria/meeting-census.ts::evaluarQuorumYMayoriaJuntaPorCapital.
-- No confía en `quorum_data`, en `status` ni en ningún peso enviado por el
-- cliente: el censo ECONOMICO WORM fija los asientos y sus votos crudos por
-- la base declarada; `meeting_attendees` fija la concurrencia y
-- representación (`representaciones.scope='JUNTA_PROXY'`); `meeting_votes`
-- fija el sentido individual del voto.
CREATE OR REPLACE FUNCTION public.fn_secretaria_server_junta_resolution_evaluation(
  p_meeting_id uuid,
  p_snapshot_id uuid,
  p_resolution_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_meeting record;
  v_snapshot record;
  v_resolution record;
  v_base_computo text;
  v_base_votos_declared numeric;
  v_base_votos_recomputed numeric;
  v_seat jsonb;
  v_seat_person_text text;
  v_seat_match_count integer;
  v_seat_weight numeric;
  v_total_seats integer := 0;
  v_attendee record;
  v_representative record;
  v_attendance_type text;
  v_vote record;
  v_vote_value text;
  v_vote_count integer;
  v_vote_scope_count integer;
  v_is_census_seat boolean;
  v_concurrent_seats integer := 0;
  v_concurrent_weight numeric := 0;
  v_eligible_concurrent_seats integer := 0;
  v_eligible_weight numeric := 0;
  v_conflict_seats integer := 0;
  v_conflict_weight numeric := 0;
  v_favor numeric := 0;
  v_contra numeric := 0;
  v_abstencion numeric := 0;
  v_non_voting_attendees integer := 0;
  v_quorum_reached boolean := false;
  v_majority_reached boolean := false;
  v_status_expected text;
  v_status_consistent boolean;
  v_audit_hash_sha512 text;
BEGIN
  IF p_meeting_id IS NULL OR p_snapshot_id IS NULL OR p_resolution_id IS NULL THEN
    RAISE EXCEPTION
      'SERVER_JUNTA_VOTE_IDENTIFIERS_REQUIRED: meeting_id, snapshot_id y resolution_id son obligatorios';
  END IF;

  SELECT
    meeting.id,
    meeting.tenant_id,
    meeting.body_id,
    meeting.secretary_id,
    meeting.scheduled_start,
    meeting.quorum_data,
    body.entity_id,
    upper(COALESCE(body.body_type, '')) AS body_type
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_MEETING_NOT_FOUND_OR_UNSCOPED: %', p_meeting_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_assert_current_tenant_id() IS DISTINCT FROM v_meeting.tenant_id THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_meeting.body_type IN (
      'JUNTA', 'JGA', 'JUNTA_GENERAL', 'JUNTA_GENERAL_ACCIONISTAS',
      'JUNTA_GENERAL_SOCIOS'
    )
    OR v_meeting.body_type LIKE 'JUNTA%'
  ) THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_UNSUPPORTED_BODY: body_type=%', v_meeting.body_type;
  END IF;

  IF v_meeting.scheduled_start IS NULL THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_MEETING_EFFECTIVE_DATE_REQUIRED';
  END IF;

  -- La base de cómputo es un criterio LEGAL declarado por expediente
  -- (docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md §4), no un
  -- valor libre: solo se reconocen los códigos con fórmula server-side.
  -- Extenderla a una tercera fórmula es decisión del Comité Legal.
  v_base_computo := NULLIF(btrim(COALESCE(v_meeting.quorum_data ->> 'base_computo', '')), '');
  IF v_base_computo IS NULL
     OR v_base_computo NOT IN (
       'VOTOS_CLASE_A_NO_AUTOCARTERA',
       'TODAS_LAS_CLASES_CON_VOTO_SIN_AUTOCARTERA'
     ) THEN
    RAISE EXCEPTION
      'SERVER_JUNTA_VOTE_BASE_COMPUTO_UNKNOWN: %', COALESCE(v_base_computo, '<null>');
  END IF;

  v_base_votos_declared := NULLIF(v_meeting.quorum_data ->> 'base_votos', '')::numeric;
  IF v_base_votos_declared IS NULL OR v_base_votos_declared <= 0 THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_BASE_VOTOS_REQUIRED';
  END IF;

  SELECT
    snapshot.id,
    snapshot.tenant_id,
    snapshot.meeting_id,
    snapshot.entity_id,
    snapshot.body_id,
    snapshot.session_kind,
    snapshot.snapshot_type,
    snapshot.payload,
    snapshot.total_partes,
    snapshot.capital_total_base,
    snapshot.audit_worm_id,
    snapshot.created_at
    INTO v_snapshot
    FROM public.censo_snapshot snapshot
   WHERE snapshot.id = p_snapshot_id
     AND snapshot.tenant_id = v_meeting.tenant_id
     AND snapshot.meeting_id = p_meeting_id
     AND snapshot.entity_id = v_meeting.entity_id
     AND snapshot.body_id = v_meeting.body_id
     AND snapshot.session_kind = 'MEETING'
     AND snapshot.snapshot_type = 'ECONOMICO';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SERVER_JUNTA_VOTE_UNKNOWN_OR_MISMATCHED_ECONOMIC_SNAPSHOT: %', p_snapshot_id;
  END IF;

  SELECT audit.hash_sha512
    INTO v_audit_hash_sha512
    FROM public.audit_log audit
   WHERE audit.id = v_snapshot.audit_worm_id
     AND audit.tenant_id = v_meeting.tenant_id;

  IF v_snapshot.audit_worm_id IS NULL
     OR v_audit_hash_sha512 IS NULL
     OR v_audit_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR jsonb_typeof(v_snapshot.payload) <> 'array'
     OR jsonb_array_length(v_snapshot.payload) = 0 THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_NOT_WORM_OR_EMPTY';
  END IF;

  -- Valida cada fila del censo económico congelado ANTES de castear nada.
  -- `raw_votes`/`share_class_code` son las dos claves que esta misma
  -- migración añade a `fn_crear_censo_snapshot`: un snapshot ya congelado
  -- ANTES de esta migración no las tiene y se rechaza aquí, no se infiere.
  FOR v_seat IN
    SELECT payload_row.value
      FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value)
  LOOP
    IF jsonb_typeof(v_seat) <> 'object' THEN
      RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_ROW_INVALID';
    END IF;

    v_seat_person_text := COALESCE(
      NULLIF(v_seat ->> 'seat_person_id', ''),
      NULLIF(v_seat ->> 'person_id', '')
    );
    IF v_seat_person_text IS NULL
       OR v_seat_person_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_PERSON_INVALID';
    END IF;
    IF lower(COALESCE(v_seat ->> 'voting_rights', '')) NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_VOTING_RIGHTS_INVALID';
    END IF;
    IF COALESCE(v_seat ->> 'raw_votes', '') !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION
        'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_MISSING_RAW_VOTES: censo congelado antes del evaluador de capital (MOI-143)';
    END IF;
  END LOOP;

  -- Recalcula, EXCLUSIVAMENTE desde el payload congelado (nunca desde
  -- capital_holdings en vivo), el total que la base declarada computa. Un
  -- valor declarado que no cuadre con el propio censo se rechaza: el
  -- criterio legal fija QUÉ cuenta, no CUÁNTO suma.
  SELECT
    count(*)::integer,
    COALESCE(sum(
      CASE
        WHEN v_base_computo = 'VOTOS_CLASE_A_NO_AUTOCARTERA'
             AND COALESCE(payload_row.value ->> 'share_class_code', '') <> 'A'
          THEN 0
        ELSE (payload_row.value ->> 'raw_votes')::numeric
      END
    ), 0)
    INTO v_total_seats, v_base_votos_recomputed
    FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value);

  IF v_total_seats <> v_snapshot.total_partes
     OR v_total_seats <> jsonb_array_length(v_snapshot.payload) THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_CARDINALITY_INVALID';
  END IF;

  IF v_base_votos_recomputed <= 0
     OR v_base_votos_recomputed IS DISTINCT FROM v_base_votos_declared THEN
    RAISE EXCEPTION
      'SERVER_JUNTA_VOTE_BASE_VOTOS_MISMATCH: declarado=% recalculado_desde_censo=%',
      v_base_votos_declared, v_base_votos_recomputed;
  END IF;

  SELECT resolution.*
    INTO v_resolution
    FROM public.meeting_resolutions resolution
   WHERE resolution.id = p_resolution_id
     AND resolution.tenant_id = v_meeting.tenant_id
     AND resolution.meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SERVER_JUNTA_VOTE_RESOLUTION_NOT_FOUND_OR_UNSCOPED: %', p_resolution_id;
  END IF;

  IF COALESCE(btrim(v_resolution.resolution_text), '') = '' THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_RESOLUTION_TEXT_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.meeting_attendees attendee
     WHERE attendee.tenant_id = v_meeting.tenant_id
       AND attendee.meeting_id = p_meeting_id
       AND attendee.person_id IS NULL
  ) THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_ATTENDEE_PERSON_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.meeting_attendees attendee
     WHERE attendee.tenant_id = v_meeting.tenant_id
       AND attendee.meeting_id = p_meeting_id
     GROUP BY attendee.person_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_DUPLICATE_ATTENDEE_PERSON';
  END IF;

  -- Un voto de la resolución solo puede referenciar a un asistente de esta
  -- misma reunión y tenant. Esto detecta también attendee_id NULL o huérfano.
  IF EXISTS (
    SELECT 1
      FROM public.meeting_votes vote
      LEFT JOIN public.meeting_attendees attendee
        ON attendee.id = vote.attendee_id
     WHERE vote.resolution_id = p_resolution_id
       AND (
         vote.tenant_id IS DISTINCT FROM v_meeting.tenant_id
         OR attendee.id IS NULL
         OR attendee.tenant_id IS DISTINCT FROM v_meeting.tenant_id
         OR attendee.meeting_id IS DISTINCT FROM p_meeting_id
       )
  ) THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_VOTE_REFERENCES_OUTSIDE_MEETING';
  END IF;

  FOR v_attendee IN
    SELECT attendee.*
      FROM public.meeting_attendees attendee
     WHERE attendee.tenant_id = v_meeting.tenant_id
       AND attendee.meeting_id = p_meeting_id
     ORDER BY attendee.person_id, attendee.id
  LOOP
    v_attendance_type := public.fn_secretaria_canonical_attendance_type(
      v_attendee.attendance_type
    );

    IF v_attendance_type IS NULL THEN
      RAISE EXCEPTION
        'SERVER_JUNTA_VOTE_ATTENDANCE_TYPE_INVALID: attendee=% type=%',
        v_attendee.id,
        v_attendee.attendance_type;
    END IF;

    -- Suma agregada (no una fila cualquiera): una persona puede sostener
    -- varias titularidades económicas a la vez ("una persona puede mantener
    -- varias clases/posiciones económicas", fn_crear_censo_snapshot). El
    -- peso elegible es la suma de sus votos crudos que cuentan bajo la base
    -- declarada; puede ser CERO (asiento existe, base lo excluye) sin dejar
    -- de ser un asiento del censo.
    SELECT
      count(*)::integer,
      COALESCE(sum(
        CASE
          WHEN v_base_computo = 'VOTOS_CLASE_A_NO_AUTOCARTERA'
               AND COALESCE(payload_row.value ->> 'share_class_code', '') <> 'A'
            THEN 0
          ELSE (payload_row.value ->> 'raw_votes')::numeric
        END
      ), 0)
      INTO v_seat_match_count, v_seat_weight
      FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value)
     WHERE COALESCE(
       NULLIF(payload_row.value ->> 'seat_person_id', ''),
       NULLIF(payload_row.value ->> 'person_id', '')
     )::uuid = v_attendee.person_id;
    v_is_census_seat := v_seat_match_count > 0;

    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE vote.tenant_id = v_meeting.tenant_id)::integer
      INTO v_vote_count, v_vote_scope_count
      FROM public.meeting_votes vote
     WHERE vote.resolution_id = p_resolution_id
       AND vote.attendee_id = v_attendee.id;

    IF NOT v_is_census_seat THEN
      -- La única excepción al censo económico es la Secretaría atribuida que
      -- no sea socia: presencia personal, voz sin voto y sin delegación.
      IF v_attendee.person_id IS DISTINCT FROM v_meeting.secretary_id
         OR COALESCE(v_attendee.voting_rights, 0) <> 0
         OR v_attendance_type <> 'PRESENCIAL'
         OR v_attendee.represented_by_id IS NOT NULL THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_ATTENDEE_OUTSIDE_CENSUS: person=%', v_attendee.person_id;
      END IF;
      IF v_vote_count <> 0 THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_NON_CENSUS_ATTENDEE_CANNOT_VOTE: attendee=%', v_attendee.id;
      END IF;
      v_non_voting_attendees := v_non_voting_attendees + 1;
      CONTINUE;
    END IF;

    IF v_attendance_type = 'AUSENTE' THEN
      IF v_attendee.represented_by_id IS NOT NULL THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_ABSENT_ATTENDEE_HAS_REPRESENTATIVE: attendee=%', v_attendee.id;
      END IF;
      IF v_vote_count <> 0 THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_ABSENT_ATTENDEE_VOTED: attendee=%', v_attendee.id;
      END IF;
      CONTINUE;
    END IF;

    IF v_attendance_type = 'REPRESENTADO' THEN
      IF v_attendee.represented_by_id IS NULL
         OR v_attendee.represented_by_id = v_attendee.person_id THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_REPRESENTATIVE_REQUIRED_AND_DISTINCT: attendee=%', v_attendee.id;
      END IF;

      IF NOT EXISTS (
        SELECT 1
          FROM public.representaciones representation
         WHERE representation.tenant_id = v_meeting.tenant_id
           AND representation.entity_id = v_meeting.entity_id
           AND representation.meeting_id = p_meeting_id
           AND representation.scope = 'JUNTA_PROXY'
           AND representation.represented_person_id = v_attendee.person_id
           AND representation.representative_person_id = v_attendee.represented_by_id
           AND representation.porcentaje_delegado = 100
           AND representation.effective_from <= v_meeting.scheduled_start::date
           AND (
             representation.effective_to IS NULL
             OR representation.effective_to >= v_meeting.scheduled_start::date
           )
      ) THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_REPRESENTATION_NOT_AUTHORITATIVE_OR_EFFECTIVE: attendee=%',
          v_attendee.id;
      END IF;

      SELECT representative_attendee.*
        INTO v_representative
        FROM public.meeting_attendees representative_attendee
       WHERE representative_attendee.tenant_id = v_meeting.tenant_id
         AND representative_attendee.meeting_id = p_meeting_id
         AND representative_attendee.person_id = v_attendee.represented_by_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_REPRESENTATIVE_NOT_PRESENT_ELIGIBLE_SEAT: attendee=%',
          v_attendee.id;
      END IF;

      IF public.fn_secretaria_canonical_attendance_type(
           v_representative.attendance_type
         ) <> 'PRESENCIAL'
         OR v_representative.represented_by_id IS NOT NULL THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_REPRESENTATIVE_NOT_PRESENT_ELIGIBLE_SEAT: attendee=%',
          v_attendee.id;
      END IF;
    ELSIF v_attendee.represented_by_id IS NOT NULL THEN
      RAISE EXCEPTION
        'SERVER_JUNTA_VOTE_DIRECT_ATTENDEE_HAS_REPRESENTATIVE: attendee=%', v_attendee.id;
    END IF;

    -- Para todo asiento concurrente (presente o representado) debe existir
    -- un único voto, incluso si su peso bajo esta base es cero: la base
    -- declarada excluye del CÓMPUTO, no de la obligación de constar.
    IF v_vote_count <> 1 OR v_vote_scope_count <> 1 THEN
      RAISE EXCEPTION
        'SERVER_JUNTA_VOTE_EXACTLY_ONE_VOTE_REQUIRED: attendee=% count=%',
        v_attendee.id,
        v_vote_count;
    END IF;

    SELECT vote.*
      INTO v_vote
      FROM public.meeting_votes vote
     WHERE vote.resolution_id = p_resolution_id
       AND vote.attendee_id = v_attendee.id
       AND vote.tenant_id = v_meeting.tenant_id;

    v_vote_value := CASE upper(btrim(COALESCE(v_vote.vote_value, '')))
      WHEN 'FAVOR' THEN 'FAVOR'
      WHEN 'FOR' THEN 'FAVOR'
      WHEN 'CONTRA' THEN 'CONTRA'
      WHEN 'AGAINST' THEN 'CONTRA'
      WHEN 'ABSTENCION' THEN 'ABSTENCION'
      WHEN 'ABSTAIN' THEN 'ABSTENCION'
      ELSE null
    END;

    IF v_vote_value IS NULL THEN
      RAISE EXCEPTION
        'SERVER_JUNTA_VOTE_VALUE_INVALID: vote=% value=%', v_vote.id, v_vote.vote_value;
    END IF;

    v_concurrent_seats := v_concurrent_seats + 1;
    v_concurrent_weight := v_concurrent_weight + v_seat_weight;

    IF v_vote.conflict_flag IS TRUE THEN
      IF COALESCE(btrim(v_vote.reason), '') = '' THEN
        RAISE EXCEPTION
          'SERVER_JUNTA_VOTE_CONFLICT_REASON_REQUIRED: vote=%', v_vote.id;
      END IF;
      v_conflict_seats := v_conflict_seats + 1;
      v_conflict_weight := v_conflict_weight + v_seat_weight;
    ELSE
      v_eligible_concurrent_seats := v_eligible_concurrent_seats + 1;
      v_eligible_weight := v_eligible_weight + v_seat_weight;
      CASE v_vote_value
        WHEN 'FAVOR' THEN v_favor := v_favor + v_seat_weight;
        WHEN 'CONTRA' THEN v_contra := v_contra + v_seat_weight;
        WHEN 'ABSTENCION' THEN v_abstencion := v_abstencion + v_seat_weight;
      END CASE;
    END IF;
  END LOOP;

  IF v_favor + v_contra + v_abstencion IS DISTINCT FROM v_eligible_weight THEN
    RAISE EXCEPTION 'SERVER_JUNTA_VOTE_INTERNAL_WEIGHT_RECONCILIATION_FAILED';
  END IF;

  -- Quórum: solo el suelo "algún voto elegible bajo la base declarada
  -- concurrió". El porcentaje mínimo de constitución de primera/segunda
  -- convocatoria (art. 193 LSC) depende de la convocatoria concreta y de
  -- los Estatutos: reservado al Comité Legal, no se fabrica aquí.
  v_quorum_reached := v_concurrent_weight > 0;

  -- Mayoría ORDINARIA, art. 201.1 LSC: más votos a favor que en contra del
  -- capital presente o representado (no la mayoría absoluta de concurrentes
  -- de un colegiado, que es la fórmula del evaluador de CDA). Las mayorías
  -- REFORZADAS por materia (arts. 194/201.2) no se modelan: reservado al
  -- Comité Legal.
  v_majority_reached := v_quorum_reached AND v_favor > v_contra;

  v_status_expected := CASE
    WHEN v_quorum_reached AND v_majority_reached THEN 'ADOPTED'
    ELSE 'REJECTED'
  END;
  v_status_consistent := upper(COALESCE(v_resolution.status, '')) = v_status_expected;

  RETURN jsonb_build_object(
    'schema_version', 'secretaria.server-junta-resolution-evaluation.v1',
    'source', 'SERVER_AUTHORITATIVE',
    'meeting_id', p_meeting_id,
    'snapshot_id', p_snapshot_id,
    'resolution_id', p_resolution_id,
    'agenda_item_index', v_resolution.agenda_item_index,
    'resolution_text', v_resolution.resolution_text,
    'body', jsonb_build_object(
      'body_id', v_meeting.body_id,
      'body_type', v_meeting.body_type,
      'entity_id', v_meeting.entity_id
    ),
    'base_computo', jsonb_build_object(
      'codigo', v_base_computo,
      'base_votos', v_base_votos_declared,
      'reference', 'docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md §4'
    ),
    'census', jsonb_build_object(
      'snapshot_type', 'ECONOMICO',
      'audit_worm_id', v_snapshot.audit_worm_id,
      'audit_hash_sha512', v_audit_hash_sha512,
      'total_seats', v_total_seats,
      'total_weight', v_base_votos_declared,
      'snapshot_created_at', v_snapshot.created_at
    ),
    'attendance', jsonb_build_object(
      'concurrent_seats', v_concurrent_seats,
      'concurrent_weight', v_concurrent_weight,
      'eligible_concurrent_seats', v_eligible_concurrent_seats,
      'eligible_voting_weight', v_eligible_weight,
      'conflict_excluded_seats', v_conflict_seats,
      'conflict_excluded_weight', v_conflict_weight,
      'non_voting_attendees', v_non_voting_attendees
    ),
    'quorum', jsonb_build_object(
      'reference', 'suelo mínimo (no modela art. 193 LSC por convocatoria)',
      'formula', 'concurrent_weight > 0',
      'reached', v_quorum_reached
    ),
    'votes', jsonb_build_object(
      'favor', v_favor,
      'contra', v_contra,
      'abstencion', v_abstencion,
      'effective_favor', v_favor,
      'effective_contra', v_contra,
      'exactly_one_vote_per_eligible_concurrent_seat', true
    ),
    'majority', jsonb_build_object(
      'reference', 'art. 201.1 LSC',
      'formula', 'favor > contra',
      'reached', v_majority_reached
    ),
    'status_persisted', v_resolution.status,
    'status_expected', v_status_expected,
    'status_consistent', v_status_consistent
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_server_junta_resolution_evaluation(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_server_junta_resolution_evaluation(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_server_junta_resolution_evaluation(uuid, uuid, uuid) IS
  'MOI-143: evaluación fail-closed de una resolución de Junta por capital: censo ECONOMICO WORM, base de cómputo declarada recalculada desde el propio censo, concurrencia persistida, representación JUNTA_PROXY vigente y un voto por asiento elegible. Mayoría ordinaria art. 201.1 LSC; quórum es el suelo mínimo (no modela art. 193 por convocatoria).';

-- Despacho por tipo de censo: mantiene los DOS puntos del manifiesto que
-- llaman al evaluador sin duplicar el CASE en cada uno.
CREATE OR REPLACE FUNCTION public.fn_secretaria_server_resolution_evaluation_dispatch(
  p_meeting_id uuid,
  p_snapshot_id uuid,
  p_resolution_id uuid,
  p_is_junta boolean
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $function$
  SELECT CASE
    WHEN p_is_junta THEN
      public.fn_secretaria_server_junta_resolution_evaluation(p_meeting_id, p_snapshot_id, p_resolution_id)
    ELSE
      public.fn_secretaria_server_resolution_evaluation(p_meeting_id, p_snapshot_id, p_resolution_id)
  END
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_server_resolution_evaluation_dispatch(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_server_resolution_evaluation_dispatch(uuid, uuid, uuid, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_server_resolution_evaluation_dispatch(uuid, uuid, uuid, boolean) IS
  'MOI-143: enruta al evaluador POLITICO (CDA) o al de Junta por capital según el tipo de censo de la reunión. Ambos SECURITY DEFINER propios; este despachador es SECURITY INVOKER, no eleva privilegios.';

-- Cuerpo completo tomado del pg_get_functiondef en repo tras H-28
-- (20260928150000_secretaria_acta_identificador_fiscal.sql), con las cinco
-- ediciones de arriba: (1) declara v_representation_scope; (2) retira el
-- bloqueo en bloque de Junta y en su lugar exige el tipo de censo correcto
-- por tipo de órgano; (3) el scope de representación se elige por variable
-- en vez del literal CONSEJO_DELEGACION; (4) el gate de mayoría de asientos
-- (colegiado de asiento único) se desactiva para Junta; (5) los dos puntos
-- que invocaban al evaluador POLITICO pasan por el despachador con
-- v_is_junta. Ningún otro contenido jurídico de la función se toca.

CREATE OR REPLACE FUNCTION public.fn_secretaria_build_minute_legal_manifest(p_meeting_id uuid, p_snapshot_id uuid, p_content_hash_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  v_representation_scope text;
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
    -- H-28: el alta societaria guarda el NIF de la persona jurídica en
    -- persons.tax_id (via entities.person_id) y no siempre rellena
    -- entities.registration_number (grupo nuevo …0003: las 3 sociedades lo
    -- tienen NULL). registration_number manda cuando existe -ARGA Seguros,
    -- S.A. sigue imprimiendo 'A-00001001' sin cambio-; solo cuando está
    -- vacío se cae al NIF que ya identifica a la sociedad en el resto del
    -- modelo canónico (condiciones_persona, capital_holdings, etc.).
    COALESCE(
      NULLIF(btrim(e.registration_number), ''),
      entity_owner.tax_id
    ) AS resolved_entity_tax_id,
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
  LEFT JOIN public.persons entity_owner
    ON entity_owner.id = e.person_id
   AND entity_owner.tenant_id = e.tenant_id
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

  -- MOI-143: Junta con censo ECONOMICO ya no se cierra en bloque; su
  -- evaluador dedicado (fn_secretaria_server_junta_resolution_evaluation,
  -- misma migración) se invoca más abajo vía
  -- fn_secretaria_server_resolution_evaluation_dispatch. Lo que sigue
  -- cerrado explícitamente es el TIPO de censo: una Junta exige ECONOMICO
  -- (nunca POLITICO) y viceversa.
  v_representation_scope := CASE WHEN v_is_junta THEN 'JUNTA_PROXY' ELSE 'CONSEJO_DELEGACION' END;
  IF v_is_junta THEN
    IF v_snapshot.snapshot_type <> 'ECONOMICO' THEN
      RAISE EXCEPTION 'authoritative minute: Junta requires an ECONOMICO census snapshot';
    END IF;
  ELSE
    IF v_snapshot.snapshot_type <> 'POLITICO' THEN
      RAISE EXCEPTION 'authoritative minute: collegial body requires a POLITICO census snapshot';
    END IF;
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
              AND r.scope = v_representation_scope
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
  -- MOI-143: esta mayoría de ASIENTOS (más de la mitad de las personas del
  -- censo) es la fórmula de un colegiado de asiento único (art. 247.2 LSC);
  -- no aplica a una Junta, que computa por CAPITAL. El quórum autoritativo
  -- de Junta lo exige, por resolución, el evaluador dedicado más abajo.
  IF NOT v_is_junta AND v_quorum_reached IS NOT TRUE THEN
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
    CROSS JOIN LATERAL public.fn_secretaria_server_resolution_evaluation_dispatch(
      p_meeting_id,
      p_snapshot_id,
      mr.id,
      v_is_junta
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
        'server_evaluation', public.fn_secretaria_server_resolution_evaluation_dispatch(
          p_meeting_id,
          p_snapshot_id,
          mr.id,
          v_is_junta
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

DO $verificacion_moi143$
DECLARE
  v_src text;
  v_src_snapshot text;
  v_arga_juntas_total integer;
  v_arga_juntas_con_base_declarada integer;
  v_garrigues_minutes integer;
  v_garrigues_certs integer;
BEGIN
  -- Vía para que las RPC con guarda de tenant no corten esta verificación,
  -- equivalente a un service_role real, sin cambiar el rol de Postgres
  -- (fn_secretaria_is_service_role lee esta GUC, no el rol físico).
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- 1) Estructural: el manifiesto ya no cierra Junta en bloque, enruta por
  --    el despachador y resuelve el scope de representación por variable;
  --    el censo económico ya persiste voto crudo por titularidad.
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc
   WHERE proname = 'fn_secretaria_build_minute_legal_manifest' AND pronargs = 3;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: fn_secretaria_build_minute_legal_manifest no existe';
  END IF;
  IF v_src ~ 'economic Junta quorum requires the dedicated capital evaluator' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: el manifiesto sigue cerrando Junta en bloque';
  END IF;
  IF v_src !~ 'fn_secretaria_server_resolution_evaluation_dispatch' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: el manifiesto no enruta al despachador de evaluadores';
  END IF;
  IF v_src !~ 'v_representation_scope' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: el manifiesto no resuelve el scope de representación por variable';
  END IF;

  SELECT pg_get_functiondef(oid) INTO v_src_snapshot
    FROM pg_proc
   WHERE proname = 'fn_crear_censo_snapshot' AND pronargs = 5;
  IF v_src_snapshot IS NULL OR v_src_snapshot !~ 'raw_votes' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: fn_crear_censo_snapshot no persiste raw_votes en el censo ECONOMICO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'fn_secretaria_server_junta_resolution_evaluation' AND pronargs = 3
  ) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-143: el evaluador de capital de Junta no existe';
  END IF;

  -- 2) Control negativo del propio instrumento: identificadores inexistentes
  --    se rechazan, directo y a través del despachador, y el despachador
  --    enruta al evaluador correcto según p_is_junta (compara el PREFIJO del
  --    código de error de cada evaluador).
  BEGIN
    PERFORM public.fn_secretaria_server_junta_resolution_evaluation(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    );
    RAISE EXCEPTION 'VERIFICACION MOI-143: el evaluador de Junta no rechazó identificadores inexistentes';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ '^SERVER_JUNTA_VOTE_MEETING_NOT_FOUND_OR_UNSCOPED' THEN
      RAISE EXCEPTION 'VERIFICACION MOI-143: excepción inesperada del evaluador de Junta: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM public.fn_secretaria_server_resolution_evaluation_dispatch(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), true
    );
    RAISE EXCEPTION 'VERIFICACION MOI-143: el despachador (junta=true) no rechazó identificadores inexistentes';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ '^SERVER_JUNTA_VOTE_MEETING_NOT_FOUND_OR_UNSCOPED' THEN
      RAISE EXCEPTION 'VERIFICACION MOI-143: el despachador (junta=true) no enrutó al evaluador de Junta: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM public.fn_secretaria_server_resolution_evaluation_dispatch(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), false
    );
    RAISE EXCEPTION 'VERIFICACION MOI-143: el despachador (junta=false) no rechazó identificadores inexistentes';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ '^SERVER_VOTE_MEETING_NOT_FOUND_OR_UNSCOPED' THEN
      RAISE EXCEPTION 'VERIFICACION MOI-143: el despachador (junta=false) no enrutó al evaluador colegiado: %', SQLERRM;
    END IF;
  END;

  -- 3) Control positivo con dato REAL: el censo económico de la Junta de
  --    Garrigues del 06/05/2026 (2a4cdc49…) está congelado DESDE ANTES de
  --    esta migración y no lleva raw_votes/share_class_code — el evaluador
  --    debe rechazarlo explícitamente, nunca adivinar votos crudos.
  BEGIN
    PERFORM public.fn_secretaria_server_junta_resolution_evaluation(
      'e0beed92-60f0-49e7-81c3-0ae5a54c9d56'::uuid,
      '2a4cdc49-eb3f-4150-9976-28314558aa4a'::uuid,
      '04373648-c3c8-4655-a667-49f8e2240506'::uuid
    );
    RAISE EXCEPTION
      'VERIFICACION MOI-143: el evaluador aceptó el censo económico legacy de Garrigues sin raw_votes';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ '^SERVER_JUNTA_VOTE_ECONOMIC_SNAPSHOT_MISSING_RAW_VOTES' THEN
      RAISE EXCEPTION
        'VERIFICACION MOI-143: excepción inesperada sobre el censo legacy de Garrigues: %', SQLERRM;
    END IF;
  END;

  -- 4) Medición declarada por el issue ("cuántas Juntas de ARGA quedarían
  --    habilitadas está sin medir"): se DECLARA por RAISE NOTICE, no se
  --    exige un número — es una foto de hoy, no un requisito de la puerta.
  SELECT count(*) INTO v_arga_juntas_total
    FROM public.meetings m
    JOIN public.governing_bodies gb ON gb.id = m.body_id AND gb.tenant_id = m.tenant_id
   WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001'
     AND upper(COALESCE(gb.body_type, m.meeting_type, '')) LIKE '%JUNTA%';
  SELECT count(*) INTO v_arga_juntas_con_base_declarada
    FROM public.meetings m
    JOIN public.governing_bodies gb ON gb.id = m.body_id AND gb.tenant_id = m.tenant_id
   WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001'
     AND upper(COALESCE(gb.body_type, m.meeting_type, '')) LIKE '%JUNTA%'
     AND COALESCE(m.quorum_data ->> 'base_computo', '') <> '';

  -- 5) Cero-cambio ARGA VISIBLE: esta migración por sí sola no genera
  --    ningún acta ni certificación (solo abre la puerta técnica).
  SELECT count(*) INTO v_garrigues_minutes
    FROM public.minutes WHERE tenant_id = '00000000-0000-0000-0000-000000000002';
  SELECT count(*) INTO v_garrigues_certs
    FROM public.certifications WHERE tenant_id = '00000000-0000-0000-0000-000000000002';
  IF v_garrigues_minutes <> 0 OR v_garrigues_certs <> 0 THEN
    RAISE EXCEPTION
      'VERIFICACION MOI-143: esta migración no debe generar actas ni certificaciones por sí sola (Garrigues minutes=% certs=%)',
      v_garrigues_minutes, v_garrigues_certs;
  END IF;

  RAISE NOTICE
    'VERIFICACION MOI-143 OK: evaluador de capital instalado y enrutado; censo ECONOMICO congelado ANTES de esta migración rechazado por falta de raw_votes (control positivo real); ARGA tiene % reunión(es) de Junta, % de ellas con base_computo ya declarada (foto de hoy, no requisito); Garrigues sigue en 0 actas / 0 certificaciones tras esta migración.',
    v_arga_juntas_total, v_arga_juntas_con_base_declarada;
END;
$verificacion_moi143$;
