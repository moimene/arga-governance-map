-- MOI-15 · recorrido 4.1 del grupo nuevo — H-52 y H-53.
--
-- H-52. La materia (y la propuesta) de un punto nacido en sesión no se
-- guardaban: `fn_secretaria_add_session_agenda_item` (20260928151000) no
-- tenía parámetro de materia, y en una reunión ligada a una convocatoria
-- emitida el cliente no puede hacer UPDATE directo sobre `agenda_items`
-- (AGENDA_EMITIDA_RPC_REQUIRED). Medido 2026-09-27 en la reunión
-- `81a4de74…` (grupo nuevo): el punto 2 quedó con matter_code y
-- proposal_text NULL, y el manifiesto del acta exige ambos para un punto
-- DECISORIO («every point needs a catalogued matter and every decision
-- needs its exact proposal»).
--   → La RPC acepta p_matter_code (validada contra materia_catalog, con
--     etiqueta) y p_proposal_text (solo DECISORIO). Si el punto nacido en
--     sesión ya existe, la misma llamada completa o corrige materia y
--     propuesta mientras la reunión siga EN_CURSO y el punto no se haya
--     votado todavía. Los puntos de la convocatoria siguen intocables.
--
-- H-53. El manifiesto del acta comparaba la agenda celebrada ENTERA con el
-- JSON inmutable de la convocatoria (FULL JOIN por order_number). Un punto
-- nacido en sesión —que H-27/H-32 ya permite añadir— hacía fallar siempre
-- «held agenda differs from the immutable convocation»: las dos piezas eran
-- incompatibles.
--   → En un órgano colegiado de administración (no Junta) la comparación
--     exacta se limita a los puntos con source_convocatoria_id; los nacidos
--     en sesión quedan fuera de esa comparación y el manifiesto declara la
--     procedencia de cada punto ('origin': CONVOCATORIA | MEETING_FLOOR).
--     Todas las demás exigencias siguen en pie para todos los puntos
--     (agenda contigua desde 1, materia catalogada, propuesta exacta,
--     una resolución por punto decisorio, evaluación de servidor).
--   → En Junta NO se relaja: qué puntos admite fuera del orden del día
--     (art. 223.1 LSC: separación de administradores, acción social de
--     responsabilidad) es criterio del Comité Legal. Sigue fail-closed.
--
-- El cuerpo del manifiesto es el vigente en Cloud (cabecera 20260928160000;
-- md5(prosrc) 6d3db8404de31c00526a3bab74644b4d comprobado el 2026-10-02)
-- con exactamente dos cambios, ambos marcados «H-53».

-- ── H-52 ────────────────────────────────────────────────────────────────
-- Se sustituye la firma de 5 argumentos: dejar las dos convivir haría
-- ambigua para PostgREST una llamada con argumentos con nombre.
DROP FUNCTION IF EXISTS public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.fn_secretaria_add_session_agenda_item(
  p_meeting_id uuid,
  p_order_number integer,
  p_title text,
  p_kind text DEFAULT 'DELIBERATIVO',
  p_decision_subtype text DEFAULT NULL,
  p_matter_code text DEFAULT NULL,
  p_proposal_text text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_title text;
  v_kind text;
  v_decision_subtype text;
  v_matter text;
  v_proposal text;
  v_existing public.agenda_items%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF p_meeting_id IS NULL THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_MEETING_ID_REQUIRED: meeting_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;
  IF p_order_number IS NULL OR p_order_number <= 0 THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_ORDER_INVALID: order_number debe ser un entero positivo'
      USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_TITLE_REQUIRED: el punto necesita un título'
      USING ERRCODE = '22023';
  END IF;
  v_title := left(v_title, 240);

  v_kind := upper(COALESCE(p_kind, 'DELIBERATIVO'));
  IF v_kind NOT IN (
    'DECISORIO', 'INFORMATIVO', 'TOMA_DE_RAZON', 'DELIBERATIVO',
    'ACEPTACION_INFORME', 'RUEGOS_PREGUNTAS'
  ) THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_KIND_INVALID: kind % no reconocido', v_kind
      USING ERRCODE = '22023';
  END IF;
  v_decision_subtype := CASE WHEN v_kind = 'DECISORIO' THEN NULLIF(btrim(p_decision_subtype), '') ELSE NULL END;

  -- H-52: la materia, si llega, tiene que existir en el catálogo con
  -- etiqueta (mismo criterio que el manifiesto del acta).
  v_matter := NULLIF(btrim(COALESCE(p_matter_code, '')), '');
  IF v_matter IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.materia_catalog mc
    WHERE mc.materia = v_matter
      AND COALESCE(btrim(mc.materia_label_es), '') <> ''
  ) THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED: la materia % no tiene fila en materia_catalog', v_matter
      USING ERRCODE = '22023';
  END IF;
  v_proposal := NULLIF(btrim(COALESCE(p_proposal_text, '')), '');

  SELECT * INTO v_meeting
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_AGENDA_ITEM_MEETING_NOT_FOUND: reunión no encontrada'
      USING ERRCODE = '22023';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
      RAISE EXCEPTION 'SESSION_AGENDA_ITEM_TENANT_MISMATCH: tenant no autorizado'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_meeting.status <> 'EN_CURSO' THEN
    RAISE EXCEPTION
      'SESSION_AGENDA_ITEM_MEETING_NOT_OPEN: la reunión debe estar en curso para añadir un punto nacido en sesión (estado actual: %)',
      v_meeting.status
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.agenda_items
  WHERE meeting_id = p_meeting_id
    AND tenant_id = v_meeting.tenant_id
    AND order_number = p_order_number
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.source_convocatoria_id IS NOT NULL THEN
      RAISE EXCEPTION
        'SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION: el número % pertenece al orden del día emitido de la convocatoria',
        p_order_number
        USING ERRCODE = '42501';
    END IF;

    -- Idempotencia + H-52: el mismo punto nacido en sesión puede recibir
    -- (o corregir) su materia y su propuesta en llamadas posteriores. La
    -- propuesta solo vale para DECISORIO, con el tipo YA persistido.
    IF upper(COALESCE(v_existing.kind, '')) <> 'DECISORIO' THEN
      v_proposal := NULL;
    END IF;
    IF (v_matter IS NOT NULL AND v_matter IS DISTINCT FROM v_existing.matter_code)
       OR (v_proposal IS NOT NULL AND v_proposal IS DISTINCT FROM v_existing.proposal_text) THEN
      -- Un punto ya votado no se reescribe: el acta compara su propuesta
      -- con la resolución y el acuerdo que ya existen.
      IF EXISTS (
        SELECT 1 FROM public.meeting_resolutions mr
        WHERE mr.meeting_id = p_meeting_id
          AND mr.tenant_id = v_meeting.tenant_id
          AND mr.agenda_item_index = v_existing.order_number
      ) THEN
        RAISE EXCEPTION
          'SESSION_AGENDA_ITEM_ALREADY_VOTED: el punto % ya tiene votación registrada; su materia y su propuesta no se cambian',
          p_order_number
          USING ERRCODE = '42501';
      END IF;
      UPDATE public.agenda_items
         SET matter_code = COALESCE(v_matter, matter_code),
             proposal_text = COALESCE(v_proposal, proposal_text)
       WHERE id = v_existing.id;
    END IF;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.agenda_items (
    tenant_id, meeting_id, order_number, title, kind, decision_subtype,
    matter_code, proposal_text
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_order_number, v_title, v_kind, v_decision_subtype,
    v_matter, CASE WHEN v_kind = 'DECISORIO' THEN v_proposal ELSE NULL END
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text, text, text) IS
  'H-27/H-52 (MOI-15): materializa un punto nacido en sesión (sin source_convocatoria_id) en una reunión EN_CURSO, con su materia catalogada y, si es DECISORIO, su propuesta. Llamada repetida sobre el mismo punto: completa o corrige materia/propuesta mientras no esté votado. Nunca toca los puntos de la convocatoria. No decide qué materias admite un punto fuera del orden del día (arts. 223.1 y 238.3 LSC): reservado al Comité Legal.';

-- ── H-53 ────────────────────────────────────────────────────────────────
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
          'proposal_text', ai.proposal_text,
          -- H-53: procedencia declarada de cada punto en el acta.
          'origin', CASE
            WHEN ai.source_convocatoria_id IS NULL THEN 'MEETING_FLOOR'
            ELSE 'CONVOCATORIA'
          END
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
        -- H-53 (MOI-15): en un órgano colegiado de administración solo los
        -- puntos que vienen de la convocatoria tienen que ser su espejo
        -- exacto. Un punto nacido en sesión (source_convocatoria_id NULL,
        -- única vía: fn_secretaria_add_session_agenda_item) no está en el
        -- JSON convocado y no invalida el acta; queda declarado con su
        -- procedencia en el manifiesto. En Junta la comparación sigue
        -- siendo total (fail-closed): qué puntos admite fuera del orden del
        -- día (art. 223.1 LSC) es criterio reservado al Comité Legal.
        AND (v_is_junta OR ai.source_convocatoria_id IS NOT NULL)
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
    -- MOI-143 (revisor, P2): para Junta el bloque de cabeza-de-colegiado
    -- (personas/2+1) nunca fue el quórum autoritativo -eso vive por
    -- resolución en resolutions[].server_evaluation.quorum, por CAPITAL- y
    -- publicarlo igualmente aquí deja dos criterios de quórum bajo la misma
    -- acta, potencialmente contradictorios (uno por cabeza, otro por
    -- capital). Se sustituye por un puntero explícito; no se agrega un
    -- resumen numérico propio para no inventar un TERCER criterio.
    'quorum', CASE WHEN v_is_junta THEN jsonb_build_object(
      'is_universal', v_is_universal,
      'source', 'SEE_RESOLUTIONS_SERVER_EVALUATION',
      'note', 'Junta computa por CAPITAL: el quórum autoritativo vive por resolución en resolutions[].server_evaluation.quorum (evaluador dedicado MOI-143). Este bloque de nivel superior es la fórmula de un colegiado de asiento único (personas/2+1, art. 247.2 LSC) y no aplica a Junta.'
    ) ELSE jsonb_build_object(
      'is_universal', v_is_universal,
      'source', 'SERVER_CENSUS_AND_ATTENDANCE',
      'reached', v_quorum_reached,
      'eligible_count', v_census_person_count,
      'present_or_represented_count', v_server_present_count,
      'required_count', v_required_present_count,
      'present_or_represented_weight', v_server_present_weight,
      'total_weight', v_server_total_weight
    ) END,
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

-- ── Verificación (aborta la migración entera si algo no quedó) ─────────
DO $verificacion$
DECLARE
  v_owner_new name;
  v_owner_ref name;
  v_secdef boolean;
  v_src text;
BEGIN
  IF to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICACION H-52: sigue existiendo la firma antigua de 5 argumentos';
  END IF;
  IF to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION H-52: la firma nueva no existe';
  END IF;
  SELECT pg_get_userbyid(proowner), prosecdef INTO v_owner_new, v_secdef
    FROM pg_proc WHERE oid = to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text,text,text)');
  SELECT pg_get_userbyid(proowner) INTO v_owner_ref
    FROM pg_proc WHERE oid = to_regprocedure('public.fn_secretaria_materialize_convocation_agenda(uuid,uuid)');
  IF v_secdef IS NOT TRUE OR v_owner_new IS DISTINCT FROM v_owner_ref THEN
    RAISE EXCEPTION 'VERIFICACION H-52: la RPC no es SECURITY DEFINER o su propietario (%) no coincide con el reconocido por el guard (%)', v_owner_new, v_owner_ref;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE routine_schema = 'public' AND routine_name = 'fn_secretaria_add_session_agenda_item'
       AND grantee IN ('PUBLIC', 'anon')
  ) THEN
    RAISE EXCEPTION 'VERIFICACION H-52: la RPC sigue concedida a PUBLIC/anon';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFICACION H-52: authenticated no puede ejecutar la RPC';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc
   WHERE oid = 'public.fn_secretaria_build_minute_legal_manifest(uuid,uuid,text)'::regprocedure;
  IF position('AND (v_is_junta OR ai.source_convocatoria_id IS NOT NULL)' IN v_src) = 0
     OR position('''origin'', CASE' IN v_src) = 0
     OR position('held agenda differs from the immutable convocation' IN v_src) = 0 THEN
    RAISE EXCEPTION 'VERIFICACION H-53: el manifiesto no contiene los dos cambios o perdió el control de convocatoria';
  END IF;
  IF has_function_privilege('anon', 'public.fn_secretaria_build_minute_legal_manifest(uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFICACION H-53: anon puede ejecutar el manifiesto';
  END IF;

  RAISE NOTICE 'VERIFICACION OK: H-52 (RPC de 7 argumentos) y H-53 (manifiesto con procedencia)';
END
$verificacion$;
