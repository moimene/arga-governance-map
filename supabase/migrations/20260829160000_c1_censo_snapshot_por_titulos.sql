-- C1 — `fn_crear_censo_snapshot` pondera la rama ECONOMICO por TÍTULOS.
--
-- LA MITAD QUE FALTABA. La migración 20260829150000 corrigió
-- `fn_refresh_parte_votante_entity`, pero esta RPC **no lee esa proyección**:
-- lleva su propia copia EN LÍNEA de la fórmula vieja
-- (`porcentaje_capital × votes_per_title`). Una fórmula duplicada en dos sitios
-- y corregida en uno.
--
-- BARRIDO DE `pg_proc` — resultado, no tarea pendiente. Cuatro funciones tocan
-- `votes_per_title`; tres calculan peso de voto:
--   fn_refresh_parte_votante_entity   numero_titulos × votes_per_title   corregida (20260829150000)
--   fn_crear_censo_snapshot           porcentaje_capital × votes_per_title  ← ESTA
--   fn_registrar_transmision_capital  p_titles_to_transfer × votes_per_title  YA ERA CORRECTA
--   fn_crear_sociedad_legal_y_capital no proyecta peso                     sin riesgo
-- Es decir: **el criterio por títulos ya estaba en el esquema**, en la RPC de
-- transmisión, y eran las DOS proyecciones derivadas las que discrepaban de él.
-- Esta migración no elige un criterio nuevo: termina de alinear el esquema con
-- el que ya tenía.
--
-- POR QUÉ URGÍA. `censo_snapshot` es INMUTABLE y
-- `fn_secretaria_build_minute_legal_manifest` suma este `voting_weight` para el
-- quórum del acta autoritativa. Con las dos clases del art. 7 de los Estatutos
-- de J&A Garrigues, S.L.P. (A: 16.000 € y 25 votos; B: 1 € y 1 voto), la fórmula
-- vieja daba un socio de clase A pesando **800.000** veces uno de clase B cuando
-- el artículo dice **50**. Crear el censo de su Junta antes de esto habría
-- congelado ese peso para siempre.
--
-- QUÉ CAMBIA: exactamente una expresión, la de `voting_weight` de la rama
-- ECONOMICO. Pasa a ser la cuota de VOTOS normalizada a 100 sobre los votos
-- computables de la entidad a la fecha efectiva.
--
-- QUÉ NO CAMBIA:
--   - `denominator_weight`: sigue siendo `porcentaje_capital`, y `capital_total_base`
--     lo agrega. El nombre del campo dice capital y guarda capital.
--   - La rama POLITICO: sus asientos pesan 1.0 y así debe seguir —
--     `fn_secretaria_evaluate_meeting_vote` los rechaza si pesan otra cosa.
--   - Los `censo_snapshot` ya emitidos: son inmutables por trigger.
--
-- Medido con probe en transacción y ROLLBACK antes de aplicar.
-- Registro del criterio: docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md

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
$function$
;
