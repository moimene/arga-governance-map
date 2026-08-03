-- Apertura autoritativa de reuniones y protección de la cronología.
--
-- El cliente ya no puede cambiar meetings.status directamente a EN_CURSO. La
-- transición se serializa en una RPC que deriva tenant y órgano de la reunión,
-- exige un operador autenticado con rol vigente y bloquea la apertura antes de
-- scheduled_start. El trigger es defensa en profundidad frente a cualquier
-- writer que intente omitir la RPC o alterar fecha y estado en la misma query.

BEGIN;

-- Resuelve una única convocatoria vinculante desde las dos trazas del meeting
-- y desde agenda_items. Cualquier discrepancia o multiplicidad falla cerrada.
-- La función ve agenda bajo owner, pero solo expone vínculos del tenant activo.
CREATE OR REPLACE FUNCTION public.fn_secretaria_bound_convocation_id_for_meeting(
  p_meeting_id uuid,
  p_tenant_id uuid,
  p_quorum_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_scheduled_from_text text := NULLIF(
    p_quorum_data #>> '{scheduled_from,convocatoria_id}',
    ''
  );
  v_source_link_text text := NULLIF(
    p_quorum_data #>> '{source_links,convocatoria_id}',
    ''
  );
  v_trace_id uuid;
  v_agenda_id uuid;
  v_agenda_count integer := 0;
BEGIN
  IF p_meeting_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_SCOPE_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  IF session_user <> 'postgres'
     AND public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF auth.uid() IS NULL
       OR public.fn_assert_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_TENANT_DENIED'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (v_scheduled_from_text IS NOT NULL AND v_scheduled_from_text !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     OR (v_source_link_text IS NOT NULL AND v_source_link_text !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_TRACE_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF v_scheduled_from_text IS NOT NULL
     AND v_source_link_text IS NOT NULL
     AND v_scheduled_from_text IS DISTINCT FROM v_source_link_text THEN
    RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_TRACE_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  v_trace_id := COALESCE(v_scheduled_from_text, v_source_link_text)::uuid;

  SELECT
    count(DISTINCT item.source_convocatoria_id),
    min(item.source_convocatoria_id::text)::uuid
    INTO v_agenda_count, v_agenda_id
    FROM public.agenda_items item
    JOIN public.meetings meeting
      ON meeting.id = item.meeting_id
     AND meeting.tenant_id = item.tenant_id
   WHERE meeting.id = p_meeting_id
     AND meeting.tenant_id = p_tenant_id
     AND item.source_convocatoria_id IS NOT NULL;

  IF v_agenda_count > 1 THEN
    RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_MULTIPLE_AGENDA_SOURCES'
      USING ERRCODE = '22023';
  END IF;

  IF v_trace_id IS NOT NULL
     AND v_agenda_id IS NOT NULL
     AND v_trace_id IS DISTINCT FROM v_agenda_id THEN
    RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_AGENDA_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE(v_trace_id, v_agenda_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_bound_convocation_id_for_meeting(uuid, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_bound_convocation_id_for_meeting(uuid, uuid, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_meeting_open_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_authoritative_writer text := current_setting('app.secretaria_open_meeting_rpc', true);
  v_source_convocatoria_text text;
  v_source_convocatoria_id uuid;
  v_convocation_insert_accredited boolean := false;
  v_bound_convocatoria public.convocatorias%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'DRAFT' THEN
      RETURN NEW;
    END IF;

    -- Excepción estrecha para la RPC ya acreditada que materializa una reunión
    -- CONVOCADA desde una convocatoria EMITIDA e inmutable. No basta con que
    -- el cliente reproduzca el JSON: el trigger es SECURITY INVOKER y exige el
    -- owner de la RPC, además de comprobar el vínculo y horario autoritativos.
    IF NEW.status = 'CONVOCADA' AND current_user = 'postgres' THEN
      v_source_convocatoria_text := NULLIF(
        NEW.quorum_data #>> '{scheduled_from,convocatoria_id}',
        ''
      );
      IF v_source_convocatoria_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_source_convocatoria_id := v_source_convocatoria_text::uuid;

        SELECT EXISTS (
          SELECT 1
            FROM public.convocatorias convocatoria
           WHERE convocatoria.id = v_source_convocatoria_id
             AND convocatoria.tenant_id = NEW.tenant_id
             AND convocatoria.body_id = NEW.body_id
             AND convocatoria.estado = 'EMITIDA'
             AND convocatoria.immutable_at IS NOT NULL
             AND convocatoria.fecha_1 IS NOT NULL
             AND convocatoria.fecha_1 > now()
             AND NEW.scheduled_start IS NOT DISTINCT FROM convocatoria.fecha_1
             AND NEW.scheduled_end IS NOT DISTINCT FROM convocatoria.fecha_1 + interval '2 hours'
             AND NEW.slug = 'convocatoria-' || replace(convocatoria.id::text, '-', '')
             AND NEW.quorum_data #>> '{scheduled_from,source}' = 'convocatoria'
             AND NEW.quorum_data #>> '{scheduled_from,estado_convocatoria}' = 'EMITIDA'
             AND NEW.quorum_data #>> '{source_links,source}' = 'explicit'
             AND NEW.quorum_data #>> '{source_links,convocatoria_id}' = convocatoria.id::text
             AND NEW.quorum_data #> '{source_links,convocatoria_ids}' = jsonb_build_array(convocatoria.id)
        ) INTO v_convocation_insert_accredited;
      END IF;
    END IF;

    IF v_convocation_insert_accredited IS TRUE THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'MEETING_INITIAL_STATE_REQUIRED: una reunión nueva debe comenzar en DRAFT; use una RPC acreditada para materializar otro estado'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'CONVOCADA'
     AND OLD.status IS DISTINCT FROM 'CONVOCADA'
     AND current_user <> 'postgres' THEN
    RAISE EXCEPTION
      'MEETING_CONVOCATION_RPC_REQUIRED: CONVOCADA solo puede alcanzarse mediante la programación autoritativa'
      USING ERRCODE = '42501';
  END IF;

  v_source_convocatoria_id := public.fn_secretaria_bound_convocation_id_for_meeting(
    OLD.id,
    OLD.tenant_id,
    OLD.quorum_data
  );

  -- El vínculo no deja de ser autoritativo por degradar indebidamente el
  -- status. Mientras exista, tampoco puede usarse CONVOCADA -> DRAFT como paso
  -- intermedio para reescribir la fecha y abrir después la reunión.
  IF v_source_convocatoria_id IS NOT NULL THEN
    SELECT * INTO v_bound_convocatoria
      FROM public.convocatorias convocatoria
     WHERE convocatoria.id = v_source_convocatoria_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_SOURCE_NOT_FOUND'
        USING ERRCODE = '22023';
    END IF;

    -- No existe RPC de reprogramación: el alcance, fecha, duración, slug y
    -- trazas que nacieron de la convocatoria son inmutables. La verificación
    -- contra la fuente también bloquea datos que hubieran sido manipulados antes
    -- de esta migración.
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.body_id IS DISTINCT FROM OLD.body_id
       OR NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
       OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.quorum_data #> '{scheduled_from}' IS DISTINCT FROM OLD.quorum_data #> '{scheduled_from}'
       OR NEW.quorum_data #> '{source_links}' IS DISTINCT FROM OLD.quorum_data #> '{source_links}' THEN
      RAISE EXCEPTION
        'MEETING_CONVOCATION_BINDING_IMMUTABLE: no existe una RPC acreditada de reprogramación'
        USING ERRCODE = '42501';
    END IF;

    IF v_bound_convocatoria.tenant_id IS DISTINCT FROM NEW.tenant_id
       OR v_bound_convocatoria.body_id IS DISTINCT FROM NEW.body_id
       OR v_bound_convocatoria.estado IS DISTINCT FROM 'EMITIDA'
       OR v_bound_convocatoria.immutable_at IS NULL
       OR v_bound_convocatoria.fecha_1 IS NULL
       OR NEW.scheduled_start IS DISTINCT FROM v_bound_convocatoria.fecha_1
       OR NEW.scheduled_end IS DISTINCT FROM v_bound_convocatoria.fecha_1 + interval '2 hours'
       OR NEW.slug IS DISTINCT FROM 'convocatoria-' || replace(v_bound_convocatoria.id::text, '-', '')
       OR NEW.quorum_data #>> '{scheduled_from,source}' IS DISTINCT FROM 'convocatoria'
       OR NEW.quorum_data #>> '{scheduled_from,convocatoria_id}' IS DISTINCT FROM v_bound_convocatoria.id::text
       OR NEW.quorum_data #>> '{scheduled_from,estado_convocatoria}' IS DISTINCT FROM 'EMITIDA'
       OR NEW.quorum_data #>> '{source_links,source}' IS DISTINCT FROM 'explicit'
       OR NEW.quorum_data #>> '{source_links,convocatoria_id}' IS DISTINCT FROM v_bound_convocatoria.id::text
       OR NEW.quorum_data #> '{source_links,convocatoria_ids}' IS DISTINCT FROM jsonb_build_array(v_bound_convocatoria.id) THEN
      RAISE EXCEPTION 'MEETING_CONVOCATION_BINDING_INVALID'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Una vez abierta, las fechas previstas forman parte de la cronología ya
  -- usada para autorizar la apertura. No pueden reescribirse al cerrar la
  -- reunión ni mediante una actualización lateral del registro.
  IF OLD.status = 'EN_CURSO'
     AND (
       NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
       OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
     ) THEN
    RAISE EXCEPTION
      'MEETING_OPEN_SCHEDULE_IMMUTABLE: el horario previsto queda inmutable tras la apertura'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'EN_CURSO' THEN
    IF OLD.status NOT IN ('DRAFT', 'CONVOCADA') THEN
      RAISE EXCEPTION
        'MEETING_OPEN_INVALID_STATE: solo una reunión DRAFT o CONVOCADA puede pasar a EN_CURSO'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.scheduled_start IS NULL
       OR NEW.scheduled_end IS NULL
       OR NEW.scheduled_end < NEW.scheduled_start THEN
      RAISE EXCEPTION
        'MEETING_OPEN_INVALID_SCHEDULE: se requieren inicio y fin previstos coherentes'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.scheduled_start > now() THEN
      RAISE EXCEPTION
        'MEETING_OPEN_TOO_EARLY: la reunión no puede abrirse antes de scheduled_start'
        USING ERRCODE = '22023';
    END IF;

    IF current_user <> 'postgres'
       OR v_authoritative_writer IS DISTINCT FROM 'fn_secretaria_open_meeting' THEN
      RAISE EXCEPTION
        'MEETING_OPEN_RPC_REQUIRED: EN_CURSO solo puede alcanzarse mediante la apertura autoritativa'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_meeting_open_transition()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_00_meeting_open_transition_guard ON public.meetings;
DROP TRIGGER IF EXISTS trg_00_meeting_open_insert_guard ON public.meetings;
CREATE TRIGGER trg_00_meeting_open_insert_guard
  BEFORE INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_meeting_open_transition();

CREATE TRIGGER trg_00_meeting_open_transition_guard
  BEFORE UPDATE OF status, scheduled_start, scheduled_end, tenant_id, body_id, slug, quorum_data
  ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_meeting_open_transition();

CREATE OR REPLACE FUNCTION public.fn_secretaria_open_meeting(
  p_meeting_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_meeting_probe record;
  v_meeting record;
  v_lock_tenant_id uuid;
  v_lock_body_id uuid;
  v_source_convocatoria_id uuid;
  v_locked_source_convocatoria_id uuid;
  v_source_convocatoria public.convocatorias%ROWTYPE;
  v_updated integer;
BEGIN
  IF p_meeting_id IS NULL THEN
    RAISE EXCEPTION 'MEETING_OPEN_ID_REQUIRED: meeting_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  -- Preflight sin lock: resuelve alcance suficiente para autenticación y para
  -- elegir el advisory. No se toma todavía el row lock de meetings.
  SELECT
    meeting.*,
    body.entity_id AS resolved_entity_id,
    entity.id AS verified_entity_id
    INTO v_meeting_probe
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
    JOIN public.entities entity
      ON entity.id = body.entity_id
     AND entity.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'MEETING_OPEN_NOT_FOUND: reunión inexistente o con ámbito de entidad/órgano incoherente'
      USING ERRCODE = 'P0002';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'MEETING_OPEN_AUTH_REQUIRED: usuario autenticado obligatorio'
        USING ERRCODE = '42501';
    END IF;
    IF public.fn_assert_current_tenant_id() IS DISTINCT FROM v_meeting_probe.tenant_id THEN
      RAISE EXCEPTION 'MEETING_OPEN_TENANT_MISMATCH: la reunión no pertenece al tenant activo'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting_probe.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_meeting_probe.resolved_entity_id IS NULL
     OR v_meeting_probe.verified_entity_id IS DISTINCT FROM v_meeting_probe.resolved_entity_id THEN
    RAISE EXCEPTION
      'MEETING_OPEN_SCOPE_INVALID: entidad y órgano deben ser coherentes con el tenant'
      USING ERRCODE = '22023';
  END IF;

  v_lock_tenant_id := v_meeting_probe.tenant_id;
  v_lock_body_id := v_meeting_probe.body_id;
  v_source_convocatoria_id := public.fn_secretaria_bound_convocation_id_for_meeting(
    v_meeting_probe.id,
    v_lock_tenant_id,
    v_meeting_probe.quorum_data
  );

  -- El advisory es el primer lock y se comparte con lifecycle. Mientras se
  -- mantiene, lifecycle no puede mutar la convocatoria. Después solo se toma
  -- row lock de meeting: el scheduler 1410 ya puede mantener convocatoria ->
  -- meeting y la apertura no forma el ciclo inverso.
  IF v_source_convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_lock_tenant_id::text
        || ':' || v_source_convocatoria_id::text,
      0
    ));
  END IF;

  -- Solo ahora se bloquea la reunión. Todo el alcance leído en preflight se
  -- revalida bajo lock antes de consultar estado o cronología.
  SELECT
    meeting.*,
    body.entity_id AS resolved_entity_id,
    entity.id AS verified_entity_id
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
    JOIN public.entities entity
      ON entity.id = body.entity_id
     AND entity.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id
     AND meeting.tenant_id = v_lock_tenant_id
   FOR UPDATE OF meeting;

  IF NOT FOUND
     OR v_meeting.body_id IS DISTINCT FROM v_lock_body_id
     OR v_meeting.resolved_entity_id IS NULL
     OR v_meeting.verified_entity_id IS DISTINCT FROM v_meeting.resolved_entity_id THEN
    RAISE EXCEPTION 'MEETING_OPEN_SCOPE_CHANGED_WHILE_LOCKING'
      USING ERRCODE = '40001';
  END IF;

  v_locked_source_convocatoria_id := public.fn_secretaria_bound_convocation_id_for_meeting(
    v_meeting.id,
    v_meeting.tenant_id,
    v_meeting.quorum_data
  );
  IF v_locked_source_convocatoria_id IS DISTINCT FROM v_source_convocatoria_id THEN
    RAISE EXCEPTION 'MEETING_OPEN_CONVOCATION_CHANGED_WHILE_LOCKING'
      USING ERRCODE = '40001';
  END IF;

  IF v_source_convocatoria_id IS NOT NULL THEN
    SELECT * INTO v_source_convocatoria
      FROM public.convocatorias convocatoria
     WHERE convocatoria.id = v_source_convocatoria_id
       AND convocatoria.tenant_id = v_lock_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MEETING_OPEN_CONVOCATION_NOT_FOUND'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF auth.uid() IS NULL
       OR public.fn_assert_current_tenant_id() IS DISTINCT FROM v_meeting.tenant_id THEN
      RAISE EXCEPTION 'MEETING_OPEN_TENANT_CHANGED_WHILE_LOCKING'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_source_convocatoria_id IS NOT NULL THEN

    IF v_source_convocatoria.tenant_id IS DISTINCT FROM v_meeting.tenant_id
       OR v_source_convocatoria.body_id IS DISTINCT FROM v_meeting.body_id
       OR v_source_convocatoria.estado IS DISTINCT FROM 'EMITIDA'
       OR v_source_convocatoria.immutable_at IS NULL
       OR v_source_convocatoria.fecha_1 IS NULL
       OR v_meeting.scheduled_start IS DISTINCT FROM v_source_convocatoria.fecha_1
       OR v_meeting.scheduled_end IS DISTINCT FROM v_source_convocatoria.fecha_1 + interval '2 hours'
       OR v_meeting.slug IS DISTINCT FROM 'convocatoria-' || replace(v_source_convocatoria.id::text, '-', '')
       OR v_meeting.quorum_data #>> '{scheduled_from,source}' IS DISTINCT FROM 'convocatoria'
       OR v_meeting.quorum_data #>> '{scheduled_from,convocatoria_id}' IS DISTINCT FROM v_source_convocatoria.id::text
       OR v_meeting.quorum_data #>> '{scheduled_from,estado_convocatoria}' IS DISTINCT FROM 'EMITIDA'
       OR v_meeting.quorum_data #>> '{source_links,source}' IS DISTINCT FROM 'explicit'
       OR v_meeting.quorum_data #>> '{source_links,convocatoria_id}' IS DISTINCT FROM v_source_convocatoria.id::text
       OR v_meeting.quorum_data #> '{source_links,convocatoria_ids}' IS DISTINCT FROM jsonb_build_array(v_source_convocatoria.id) THEN
      RAISE EXCEPTION
        'MEETING_OPEN_CONVOCATION_BINDING_INVALID: convocatoria EMITIDA, fechas, duración y traza deben coincidir'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_meeting.status = 'EN_CURSO' THEN
    IF v_meeting.scheduled_start IS NULL
       OR v_meeting.scheduled_end IS NULL
       OR v_meeting.scheduled_end < v_meeting.scheduled_start
       OR v_meeting.scheduled_start > now() THEN
      RAISE EXCEPTION
        'MEETING_OPEN_CHRONOLOGY_INVALID: una reunión EN_CURSO requiere horario coherente y no puede conservar un inicio futuro'
        USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'meeting_id', v_meeting.id,
      'status', v_meeting.status,
      'scheduled_start', v_meeting.scheduled_start,
      'reused', true
    );
  END IF;

  IF v_meeting.status NOT IN ('DRAFT', 'CONVOCADA') THEN
    RAISE EXCEPTION
      'MEETING_OPEN_INVALID_STATE: el estado % no permite declarar la apertura',
      v_meeting.status
      USING ERRCODE = '22023';
  END IF;

  IF v_meeting.scheduled_start IS NULL
     OR v_meeting.scheduled_end IS NULL
     OR v_meeting.scheduled_end < v_meeting.scheduled_start THEN
    RAISE EXCEPTION
      'MEETING_OPEN_INVALID_SCHEDULE: se requieren inicio y fin previstos coherentes'
      USING ERRCODE = '22023';
  END IF;

  IF v_meeting.scheduled_start > now() THEN
    RAISE EXCEPTION
      'MEETING_OPEN_TOO_EARLY: la reunión no puede abrirse antes de scheduled_start'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.set_config(
    'app.secretaria_open_meeting_rpc',
    'fn_secretaria_open_meeting',
    true
  );

  UPDATE public.meetings
     SET status = 'EN_CURSO'
   WHERE id = p_meeting_id
     AND tenant_id = v_meeting.tenant_id
     AND body_id = v_meeting.body_id
     AND status IN ('DRAFT', 'CONVOCADA')
     AND scheduled_start <= now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM pg_catalog.set_config('app.secretaria_open_meeting_rpc', '', true);

  IF v_updated <> 1 THEN
    RAISE EXCEPTION
      'MEETING_OPEN_CONCURRENT_CHANGE: la reunión cambió durante la apertura'
      USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'meeting_id', v_meeting.id,
    'status', 'EN_CURSO',
    'scheduled_start', v_meeting.scheduled_start,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_open_meeting(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_open_meeting(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_open_meeting(uuid) IS
  'Abre de forma idempotente una reunión llegada su hora, bajo lock, tenant y rol SECRETARIO/ADMIN_TENANT; bloquea cualquier apertura anticipada o transición cliente directa.';

COMMIT;
