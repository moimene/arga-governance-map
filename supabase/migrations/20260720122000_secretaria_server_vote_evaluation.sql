-- Evaluación autoritativa de quórum y votación para órganos colegiados.
--
-- El resultado no confía en quorum_data, adoption_snapshot, status ni en los
-- pesos enviados por el cliente. El censo POLITICO WORM fija los asientos y
-- sus pesos; meeting_attendees fija únicamente la concurrencia; y
-- meeting_votes fija el sentido individual del voto.

BEGIN;

-- La unicidad se comprueba antes de crear los índices para que una instalación
-- con deuda legacy aborte de forma explícita, en lugar de elegir una fila de
-- manera no determinista.
DO $legacy_attendee_duplicates$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.meeting_attendees attendee
     WHERE attendee.person_id IS NOT NULL
     GROUP BY attendee.tenant_id, attendee.meeting_id, attendee.person_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'SERVER_VOTE_LEGACY_DUPLICATE_ATTENDEES: existen personas repetidas en una reunión';
  END IF;
END;
$legacy_attendee_duplicates$;

DO $legacy_resolution_duplicates$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.meeting_resolutions resolution
     GROUP BY resolution.tenant_id, resolution.meeting_id, resolution.agenda_item_index
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'SERVER_VOTE_LEGACY_DUPLICATE_RESOLUTIONS: existe más de una resolución para el mismo punto';
  END IF;
END;
$legacy_resolution_duplicates$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_attendees_tenant_meeting_person
  ON public.meeting_attendees(tenant_id, meeting_id, person_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_resolutions_tenant_meeting_agenda_item
  ON public.meeting_resolutions(tenant_id, meeting_id, agenda_item_index);

CREATE OR REPLACE FUNCTION public.fn_secretaria_server_resolution_evaluation(
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
  v_attendee record;
  v_vote record;
  v_representative record;
  v_seat jsonb;
  v_seat_person_text text;
  v_seat_weight numeric;
  v_total_seats integer := 0;
  v_total_weight numeric := 0;
  v_concurrent_seats integer := 0;
  v_concurrent_weight numeric := 0;
  v_eligible_concurrent_seats integer := 0;
  v_eligible_weight numeric := 0;
  v_non_voting_attendees integer := 0;
  v_conflict_seats integer := 0;
  v_conflict_weight numeric := 0;
  v_favor numeric := 0;
  v_contra numeric := 0;
  v_abstencion numeric := 0;
  v_effective_favor numeric := 0;
  v_effective_contra numeric := 0;
  v_vote_count integer;
  v_vote_scope_count integer;
  v_duplicate_count integer;
  v_is_census_seat boolean;
  v_attendance_type text;
  v_vote_value text;
  v_quorum_reached boolean := false;
  v_majority_reached boolean := false;
  v_tie_before_casting_vote boolean := false;
  v_casting_vote_enabled boolean := false;
  v_casting_vote_used boolean := false;
  v_casting_vote_direction text := null;
  v_president_vote text := null;
  v_president_weight numeric := 0;
  v_president_can_cast boolean := false;
  v_status_expected text;
  v_status_consistent boolean;
  v_audit_hash_sha512 text;
BEGIN
  IF p_meeting_id IS NULL OR p_snapshot_id IS NULL OR p_resolution_id IS NULL THEN
    RAISE EXCEPTION
      'SERVER_VOTE_IDENTIFIERS_REQUIRED: meeting_id, snapshot_id y resolution_id son obligatorios';
  END IF;

  SELECT
    meeting.id,
    meeting.tenant_id,
    meeting.body_id,
    meeting.president_id,
    meeting.secretary_id,
    meeting.scheduled_start,
    meeting.status AS meeting_status,
    body.entity_id,
    upper(COALESCE(body.body_type, '')) AS body_type,
    COALESCE(body.config, '{}'::jsonb) AS body_config
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVER_VOTE_MEETING_NOT_FOUND_OR_UNSCOPED: %', p_meeting_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_assert_current_tenant_id() IS DISTINCT FROM v_meeting.tenant_id THEN
    RAISE EXCEPTION 'SERVER_VOTE_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_meeting.body_type NOT IN (
    'CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION', 'COMISION', 'COMITE'
  ) THEN
    RAISE EXCEPTION
      'SERVER_VOTE_UNSUPPORTED_COLLEGIAL_BODY: body_type=%', v_meeting.body_type;
  END IF;

  IF v_meeting.president_id IS NULL THEN
    RAISE EXCEPTION 'SERVER_VOTE_MEETING_PRESIDENT_REQUIRED';
  END IF;

  IF v_meeting.scheduled_start IS NULL THEN
    RAISE EXCEPTION 'SERVER_VOTE_MEETING_EFFECTIVE_DATE_REQUIRED';
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
     AND snapshot.snapshot_type = 'POLITICO';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SERVER_VOTE_UNKNOWN_OR_MISMATCHED_POLITICAL_SNAPSHOT: %', p_snapshot_id;
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
    RAISE EXCEPTION 'SERVER_VOTE_POLITICAL_SNAPSHOT_NOT_WORM_OR_EMPTY';
  END IF;

  -- Valida el payload antes de castear sus valores. En un censo POLITICO cada
  -- persona representa un único asiento y cada asiento tiene exactamente un
  -- voto; un WORM mal formado se rechaza, nunca se normaliza silenciosamente.
  FOR v_seat IN
    SELECT payload_row.value
      FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value)
  LOOP
    IF jsonb_typeof(v_seat) <> 'object' THEN
      RAISE EXCEPTION 'SERVER_VOTE_POLITICAL_SNAPSHOT_ROW_INVALID';
    END IF;

    v_seat_person_text := COALESCE(
      NULLIF(v_seat ->> 'seat_person_id', ''),
      NULLIF(v_seat ->> 'person_id', '')
    );

    IF v_seat_person_text IS NULL
       OR v_seat_person_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'SERVER_VOTE_POLITICAL_SNAPSHOT_PERSON_INVALID';
    END IF;

    IF lower(COALESCE(v_seat ->> 'voting_rights', 'false')) <> 'true'
       OR COALESCE(v_seat ->> 'voting_weight', '') !~ '^[0-9]+([.][0-9]+)?$'
       OR COALESCE(v_seat ->> 'denominator_weight', '') !~ '^[0-9]+([.][0-9]+)?$'
       OR (v_seat ->> 'voting_weight')::numeric <> 1
       OR (v_seat ->> 'denominator_weight')::numeric <> 1 THEN
      RAISE EXCEPTION
        'SERVER_VOTE_POLITICAL_SNAPSHOT_WEIGHT_INVALID: cada asiento debe pesar exactamente uno';
    END IF;
  END LOOP;

  SELECT
    count(*)::integer,
    count(DISTINCT COALESCE(
      NULLIF(payload_row.value ->> 'seat_person_id', ''),
      NULLIF(payload_row.value ->> 'person_id', '')
    ))::integer,
    COALESCE(sum((payload_row.value ->> 'voting_weight')::numeric), 0)
    INTO v_total_seats, v_duplicate_count, v_total_weight
    FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value);

  IF v_total_seats <> v_duplicate_count
     OR v_snapshot.total_partes <> v_total_seats
     OR v_snapshot.capital_total_base IS DISTINCT FROM v_total_weight THEN
    RAISE EXCEPTION
      'SERVER_VOTE_POLITICAL_SNAPSHOT_DENOMINATOR_INVALID: filas, personas y denominador no coinciden';
  END IF;

  SELECT resolution.*
    INTO v_resolution
    FROM public.meeting_resolutions resolution
   WHERE resolution.id = p_resolution_id
     AND resolution.tenant_id = v_meeting.tenant_id
     AND resolution.meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SERVER_VOTE_RESOLUTION_NOT_FOUND_OR_UNSCOPED: %', p_resolution_id;
  END IF;

  IF COALESCE(btrim(v_resolution.resolution_text), '') = '' THEN
    RAISE EXCEPTION 'SERVER_VOTE_RESOLUTION_TEXT_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.meeting_attendees attendee
     WHERE attendee.tenant_id = v_meeting.tenant_id
       AND attendee.meeting_id = p_meeting_id
       AND attendee.person_id IS NULL
  ) THEN
    RAISE EXCEPTION 'SERVER_VOTE_ATTENDEE_PERSON_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.meeting_attendees attendee
     WHERE attendee.tenant_id = v_meeting.tenant_id
       AND attendee.meeting_id = p_meeting_id
     GROUP BY attendee.person_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SERVER_VOTE_DUPLICATE_ATTENDEE_PERSON';
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
    RAISE EXCEPTION 'SERVER_VOTE_VOTE_REFERENCES_OUTSIDE_MEETING';
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
        'SERVER_VOTE_ATTENDANCE_TYPE_INVALID: attendee=% type=%',
        v_attendee.id,
        v_attendee.attendance_type;
    END IF;

    v_seat := null;
    v_seat_weight := null;
    SELECT
      payload_row.value,
      (payload_row.value ->> 'voting_weight')::numeric
      INTO v_seat, v_seat_weight
      FROM jsonb_array_elements(v_snapshot.payload) AS payload_row(value)
     WHERE COALESCE(
       NULLIF(payload_row.value ->> 'seat_person_id', ''),
       NULLIF(payload_row.value ->> 'person_id', '')
     )::uuid = v_attendee.person_id;
    v_is_census_seat := FOUND;

    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE vote.tenant_id = v_meeting.tenant_id
      )::integer
      INTO v_vote_count, v_vote_scope_count
      FROM public.meeting_votes vote
     WHERE vote.resolution_id = p_resolution_id
       AND vote.attendee_id = v_attendee.id;

    IF NOT v_is_census_seat THEN
      -- La única excepción al censo político es la Secretaría atribuida que
      -- no sea consejera: presencia personal, voz sin voto y sin delegación.
      IF v_attendee.person_id IS DISTINCT FROM v_meeting.secretary_id
         OR COALESCE(v_attendee.voting_rights, 0) <> 0
         OR v_attendance_type <> 'PRESENCIAL'
         OR v_attendee.represented_by_id IS NOT NULL THEN
        RAISE EXCEPTION
          'SERVER_VOTE_ATTENDEE_OUTSIDE_CENSUS: person=%', v_attendee.person_id;
      END IF;
      IF v_vote_count <> 0 THEN
        RAISE EXCEPTION
          'SERVER_VOTE_NON_CENSUS_ATTENDEE_CANNOT_VOTE: attendee=%', v_attendee.id;
      END IF;
      v_non_voting_attendees := v_non_voting_attendees + 1;
      CONTINUE;
    END IF;

    IF v_attendance_type = 'AUSENTE' THEN
      IF v_attendee.represented_by_id IS NOT NULL THEN
        RAISE EXCEPTION
          'SERVER_VOTE_ABSENT_ATTENDEE_HAS_REPRESENTATIVE: attendee=%', v_attendee.id;
      END IF;
      IF v_vote_count <> 0 THEN
        RAISE EXCEPTION
          'SERVER_VOTE_ABSENT_ATTENDEE_VOTED: attendee=%', v_attendee.id;
      END IF;
      CONTINUE;
    END IF;

    IF v_attendance_type = 'REPRESENTADO' THEN
      IF v_attendee.represented_by_id IS NULL
         OR v_attendee.represented_by_id = v_attendee.person_id THEN
        RAISE EXCEPTION
          'SERVER_VOTE_REPRESENTATIVE_REQUIRED_AND_DISTINCT: attendee=%', v_attendee.id;
      END IF;

      IF NOT EXISTS (
        SELECT 1
          FROM public.representaciones representation
         WHERE representation.tenant_id = v_meeting.tenant_id
           AND representation.entity_id = v_meeting.entity_id
           AND representation.meeting_id = p_meeting_id
           AND representation.scope = 'CONSEJO_DELEGACION'
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
          'SERVER_VOTE_REPRESENTATION_NOT_AUTHORITATIVE_OR_EFFECTIVE: attendee=%',
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
          'SERVER_VOTE_REPRESENTATIVE_NOT_PRESENT_ELIGIBLE_SEAT: attendee=%',
          v_attendee.id;
      END IF;

      IF public.fn_secretaria_canonical_attendance_type(
           v_representative.attendance_type
         ) <> 'PRESENCIAL'
         OR v_representative.represented_by_id IS NOT NULL
         OR NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(v_snapshot.payload) AS representative_seat(value)
            WHERE COALESCE(
              NULLIF(representative_seat.value ->> 'seat_person_id', ''),
              NULLIF(representative_seat.value ->> 'person_id', '')
            )::uuid = v_attendee.represented_by_id
         ) THEN
        RAISE EXCEPTION
          'SERVER_VOTE_REPRESENTATIVE_NOT_PRESENT_ELIGIBLE_SEAT: attendee=%',
          v_attendee.id;
      END IF;
    ELSIF v_attendee.represented_by_id IS NOT NULL THEN
      RAISE EXCEPTION
        'SERVER_VOTE_DIRECT_ATTENDEE_HAS_REPRESENTATIVE: attendee=%', v_attendee.id;
    END IF;

    -- Para todo asiento concurrente (presente o representado) debe existir un
    -- único voto. El tenant del voto se comprueba además del conteo físico.
    IF v_vote_count <> 1 OR v_vote_scope_count <> 1 THEN
      RAISE EXCEPTION
        'SERVER_VOTE_EXACTLY_ONE_VOTE_REQUIRED: attendee=% count=%',
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
        'SERVER_VOTE_VALUE_INVALID: vote=% value=%', v_vote.id, v_vote.vote_value;
    END IF;

    v_concurrent_seats := v_concurrent_seats + 1;
    v_concurrent_weight := v_concurrent_weight + v_seat_weight;

    IF v_vote.conflict_flag IS TRUE THEN
      IF COALESCE(btrim(v_vote.reason), '') = '' THEN
        RAISE EXCEPTION
          'SERVER_VOTE_CONFLICT_REASON_REQUIRED: vote=%', v_vote.id;
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

    IF v_attendee.person_id = v_meeting.president_id THEN
      v_president_vote := v_vote_value;
      v_president_weight := v_seat_weight;
      v_president_can_cast :=
        v_vote.conflict_flag IS NOT TRUE
        AND v_attendance_type = 'PRESENCIAL';
    END IF;
  END LOOP;

  IF v_favor + v_contra + v_abstencion IS DISTINCT FROM v_eligible_weight THEN
    RAISE EXCEPTION 'SERVER_VOTE_INTERNAL_WEIGHT_RECONCILIATION_FAILED';
  END IF;

  -- Art. 247.2 LSC: el consejo queda constituido cuando concurre la mayoría
  -- de sus vocales. Los conflictos no eliminan asistencia para este cómputo.
  v_quorum_reached := v_concurrent_weight > (v_total_weight / 2);

  -- Art. 248.1 LSC: mayoría absoluta de concurrentes elegibles. Conforme a la
  -- decisión de producto, un conflicto documentado se excluye de numerador y
  -- denominador de la votación, pero no del quórum de constitución.
  v_majority_reached :=
    v_quorum_reached
    AND v_eligible_weight > 0
    AND v_favor > (v_eligible_weight / 2);

  v_tie_before_casting_vote := v_favor = v_contra AND v_favor > 0;
  v_casting_vote_enabled :=
    COALESCE((v_meeting.body_config ->> 'voto_calidad_presidente')::boolean, false) IS TRUE;
  v_effective_favor := v_favor;
  v_effective_contra := v_contra;

  -- El voto de calidad solo opera ante empate, si la configuración exacta del
  -- órgano lo habilita y si el presidente concurre personalmente, es elegible
  -- y votó en uno de los dos sentidos que pueden romperlo.
  IF v_quorum_reached
     AND v_majority_reached IS NOT TRUE
     AND v_tie_before_casting_vote
     AND v_casting_vote_enabled
     AND v_president_can_cast
     AND v_president_vote IN ('FAVOR', 'CONTRA') THEN
    v_casting_vote_used := true;
    v_casting_vote_direction := v_president_vote;
    IF v_president_vote = 'FAVOR' THEN
      v_effective_favor := v_effective_favor + v_president_weight;
    ELSE
      v_effective_contra := v_effective_contra + v_president_weight;
    END IF;
    v_majority_reached := v_effective_favor > (v_eligible_weight / 2);
  END IF;

  v_status_expected := CASE
    WHEN v_quorum_reached AND v_majority_reached THEN 'ADOPTED'
    ELSE 'REJECTED'
  END;
  v_status_consistent := upper(COALESCE(v_resolution.status, '')) = v_status_expected;

  RETURN jsonb_build_object(
    'schema_version', 'secretaria.server-resolution-evaluation.v1',
    'source', 'SERVER_AUTHORITATIVE',
    'meeting_id', p_meeting_id,
    'snapshot_id', p_snapshot_id,
    'resolution_id', p_resolution_id,
    'agenda_item_index', v_resolution.agenda_item_index,
    'resolution_text', v_resolution.resolution_text,
    'body', jsonb_build_object(
      'body_id', v_meeting.body_id,
      'body_type', v_meeting.body_type,
      'entity_id', v_meeting.entity_id,
      'president_id', v_meeting.president_id
    ),
    'census', jsonb_build_object(
      'snapshot_type', 'POLITICO',
      'audit_worm_id', v_snapshot.audit_worm_id,
      'audit_hash_sha512', v_audit_hash_sha512,
      'total_seats', v_total_seats,
      'total_weight', v_total_weight,
      'snapshot_created_at', v_snapshot.created_at
    ),
    'attendance', jsonb_build_object(
      'concurrent_seats', v_concurrent_seats,
      'absent_seats', v_total_seats - v_concurrent_seats,
      'concurrent_weight', v_concurrent_weight,
      'eligible_concurrent_seats', v_eligible_concurrent_seats,
      'eligible_voting_weight', v_eligible_weight,
      'conflict_excluded_seats', v_conflict_seats,
      'conflict_excluded_weight', v_conflict_weight,
      'non_voting_attendees', v_non_voting_attendees
    ),
    'quorum', jsonb_build_object(
      'reference', 'art. 247.2 LSC',
      'formula', 'concurrent_weight > total_census_weight / 2',
      'minimum_seats', floor(v_total_weight / 2) + 1,
      'reached', v_quorum_reached
    ),
    'votes', jsonb_build_object(
      'favor', v_favor,
      'contra', v_contra,
      'abstencion', v_abstencion,
      'effective_favor', v_effective_favor,
      'effective_contra', v_effective_contra,
      'exactly_one_vote_per_eligible_concurrent_seat', true
    ),
    'majority', jsonb_build_object(
      'reference', 'art. 248.1 LSC',
      'formula', 'effective_favor > eligible_concurrent_weight / 2',
      'tie_before_casting_vote', v_tie_before_casting_vote,
      'reached', v_majority_reached
    ),
    'casting_vote', jsonb_build_object(
      'enabled_by_body_config', v_casting_vote_enabled,
      'president_id', v_meeting.president_id,
      'president_vote', v_president_vote,
      'president_eligible_and_personally_present', v_president_can_cast,
      'used', v_casting_vote_used,
      'direction', v_casting_vote_direction
    ),
    'status_persisted', v_resolution.status,
    'status_expected', v_status_expected,
    'status_consistent', v_status_consistent
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_server_resolution_evaluation(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_server_resolution_evaluation(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_server_resolution_evaluation(uuid, uuid, uuid) IS
  'Evaluación fail-closed de una resolución colegiada: censo POLITICO WORM, concurrencia persistida, representación vigente y un voto por asiento elegible. Devuelve status_expected ADOPTED/REJECTED sin confiar en cálculos del cliente.';

COMMIT;
