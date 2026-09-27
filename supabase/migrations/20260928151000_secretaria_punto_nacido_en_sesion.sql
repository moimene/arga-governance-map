-- H-27 (MOI-15) — RPC gobernada para "Añadir punto nacido en sesión".
--
-- Defecto: el paso 4 de ReunionStepper (DebatesStep.handleSave) usaba
-- `useMaterializeAgendaItem`, que hace un INSERT directo en `agenda_items`
-- por PostgREST. Para una reunión nacida de una convocatoria EMITIDA, TODOS
-- los puntos de la convocatoria ya llegan materializados en la misma
-- transacción que crea la reunión (`fn_secretaria_create_or_reuse_meeting_from_convocation`
-- → `fn_secretaria_materialize_convocation_agenda`, 20260720122100/141000).
-- Por tanto el INSERT directo del cliente solo se ejecuta para puntos
-- GENUINAMENTE nacidos en sesión (origin MEETING_FLOOR, sin
-- source_convocatoria_id) — y el trigger `fn_secretaria_guard_emitted_agenda_dml`
-- lo rechaza con 42501 AGENDA_EMITIDA_RPC_REQUIRED porque exige que cualquier
-- escritura en `agenda_items` de una reunión vinculada a una convocatoria
-- inmutable pase por una RPC gobernada. No existía ninguna RPC para este caso
-- (la única RPC reconocida, `fn_secretaria_materialize_convocation_agenda`,
-- reconcilia el orden del día ENTERO contra el JSON de la convocatoria y ya
-- ni siquiera acepta `authenticated` desde 20260720141000). El resultado: el
-- paso "Añadir punto nacido en sesión" era inutilizable en cualquier reunión
-- convocada, y el cliente lo tapaba con un toast genérico
-- ("Error al preparar constancias").
--
-- Esta migración crea `fn_secretaria_add_session_agenda_item`: inserta UN
-- punto nuevo, sin tocar el orden del día emitido de la convocatoria
-- (nunca escribe source_convocatoria_id) y sin exigir convocatoria alguna
-- (una reunión sin convocatoria también puede recibir puntos nacidos en
-- sesión, y hoy ese caso pasaba sin trigger). Es SECURITY DEFINER; el
-- disparador `fn_secretaria_guard_emitted_agenda_dml` reconoce cualquier
-- llamador cuyo `current_user` coincida con el propietario de
-- `fn_secretaria_materialize_convocation_agenda` (ambas son `postgres` en
-- este proyecto: SECURITY DEFINER hereda el propietario efectivo durante
-- toda la llamada, incluidos los triggers que dispara). No hace falta
-- ampliar el disparador.
--
-- El "origen de sesión" del punto ya lo marca el propio modelo: un
-- agenda_items con source_convocatoria_id IS NULL nunca viene de una
-- convocatoria (constraint agenda_items_convocation_source_binding_complete);
-- es la misma convención que usa ya `AgendaPointOrigin = 'MEETING_FLOOR'`
-- en el cliente (src/lib/secretaria/meeting-agenda.ts). No se añade columna.
--
-- No se decide aquí ningún criterio jurídico sobre qué materias admiten un
-- punto fuera del orden del día convocado (arts. 223.1 y 238.3 LSC para
-- Junta): la RPC no distingue por tipo de órgano ni por materia, igual que
-- no lo distinguía el INSERT directo que sustituye. Eso queda declarado
-- como punto abierto para el Comité Legal.

CREATE OR REPLACE FUNCTION public.fn_secretaria_add_session_agenda_item(
  p_meeting_id uuid,
  p_order_number integer,
  p_title text,
  p_kind text DEFAULT 'DELIBERATIVO',
  p_decision_subtype text DEFAULT NULL
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
  -- Espejo de agenda_items_decision_subtype_only_for_decisorio: solo
  -- DECISORIO admite decision_subtype.
  v_decision_subtype := CASE WHEN v_kind = 'DECISORIO' THEN NULLIF(btrim(p_decision_subtype), '') ELSE NULL END;

  -- Row lock: dos materializaciones concurrentes del mismo punto se
  -- serializan aquí, no en una carrera de INSERTs por PostgREST.
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
    -- El orden del día emitido de la convocatoria no se toca nunca: si ese
    -- número ya pertenece a un punto de convocatoria, se rechaza en vez de
    -- reescribirlo o de dejar que el UNIQUE lo tumbe con un 23505 opaco.
    IF v_existing.source_convocatoria_id IS NOT NULL THEN
      RAISE EXCEPTION
        'SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION: el número % pertenece al orden del día emitido de la convocatoria',
        p_order_number
        USING ERRCODE = '42501';
    END IF;
    -- Idempotencia: mismo (meeting_id, order_number) ya materializado por
    -- un intento anterior (doble clic, reintento de red) → devolver su id
    -- en vez de fallar por UNIQUE, mismo contrato que el cliente esperaba
    -- del INSERT directo (ver useMaterializeAgendaItem, comentario Codex
    -- P2 round 15).
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.agenda_items (
    tenant_id, meeting_id, order_number, title, kind, decision_subtype
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_order_number, v_title, v_kind, v_decision_subtype
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text) IS
  'H-27 (MOI-15): materializa on-demand un punto nacido en sesión (origin MEETING_FLOOR, sin convocatoria) en agenda_items para una reunión EN_CURSO. Nunca escribe source_convocatoria_id; el orden del día emitido de la convocatoria permanece intocado. SECURITY DEFINER reconocido por fn_secretaria_guard_emitted_agenda_dml por compartir propietario con fn_secretaria_materialize_convocation_agenda. No decide criterio jurídico sobre qué materias admiten un punto fuera del orden del día convocado (arts. 223.1 y 238.3 LSC): reservado al Comité Legal.';

DO $verificacion$
DECLARE
  v_owner_new name;
  v_owner_ref name;
  v_secdef boolean;
BEGIN
  IF to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item no existe tras crearla';
  END IF;

  SELECT pg_get_userbyid(proowner), prosecdef
    INTO v_owner_new, v_secdef
    FROM pg_proc
   WHERE oid = to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text)');
  SELECT pg_get_userbyid(proowner)
    INTO v_owner_ref
    FROM pg_proc
   WHERE oid = to_regprocedure('public.fn_secretaria_materialize_convocation_agenda(uuid,uuid)');

  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item no es SECURITY DEFINER';
  END IF;
  IF v_owner_new IS NULL OR v_owner_new IS DISTINCT FROM v_owner_ref THEN
    RAISE EXCEPTION
      'VERIFICACION: el propietario de la RPC nueva (%) no coincide con el de fn_secretaria_materialize_convocation_agenda (%) — el trigger fn_secretaria_guard_emitted_agenda_dml no la reconocerá',
      v_owner_new, v_owner_ref;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE routine_schema = 'public'
       AND routine_name = 'fn_secretaria_add_session_agenda_item'
       AND grantee IN ('PUBLIC', 'anon')
  ) THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item sigue concedida a PUBLIC/anon';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE routine_schema = 'public'
       AND routine_name = 'fn_secretaria_add_session_agenda_item'
       AND grantee = 'authenticated'
  ) THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item no concedida a authenticated';
  END IF;

  RAISE NOTICE 'VERIFICACION OK: fn_secretaria_add_session_agenda_item (owner=%, security definer=%)', v_owner_new, v_secdef;
END
$verificacion$;

-- Control positivo del propio instrumento: la función debe rechazar los
-- casos que dice rechazar. Corre en una subtransacción que se deshace a
-- propósito (patrón MOI-137 D-20, 20260926113700) para no dejar residuo en
-- ARGA (tenant_id por defecto de agenda_items).
DO $control_positivo$
DECLARE
  v_any_meeting_id uuid;
  v_open_meeting_id uuid;
  v_caught_kind boolean := false;
  v_new_id uuid;
  v_probe_order integer;
BEGIN
  SELECT id INTO v_any_meeting_id
  FROM public.meetings
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_open_meeting_id
  FROM public.meetings
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'EN_CURSO'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_any_meeting_id IS NULL THEN
    RAISE NOTICE 'CONTROL POSITIVO: sin reunión de ARGA disponible, se omite (no bloquea la migración)';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);

    -- Camino negativo (no depende de que la reunión esté EN_CURSO: la
    -- validación de kind corre antes de tocar meetings).
    BEGIN
      PERFORM public.fn_secretaria_add_session_agenda_item(
        v_any_meeting_id, 999999, 'Control positivo H-27 (usar y tirar)', 'DECISORIO_INVALIDO', NULL
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE 'SESSION_AGENDA_ITEM_KIND_INVALID%' THEN
        v_caught_kind := true;
      ELSE
        RAISE EXCEPTION 'CONTROL POSITIVO: error inesperado validando kind: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;

    IF NOT v_caught_kind THEN
      RAISE EXCEPTION 'CONTROL POSITIVO: la RPC aceptó un kind inválido';
    END IF;

    -- Camino feliz: solo si hay una reunión EN_CURSO a mano. Inserta de
    -- verdad (dentro de la subtransacción que se deshace después) para
    -- comprobar que el instrumento también funciona, no solo que rechaza.
    IF v_open_meeting_id IS NOT NULL THEN
      SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_probe_order
      FROM public.agenda_items
      WHERE meeting_id = v_open_meeting_id;

      v_new_id := public.fn_secretaria_add_session_agenda_item(
        v_open_meeting_id, v_probe_order, 'Control positivo H-27 (usar y tirar, camino feliz)', 'DELIBERATIVO', NULL
      );
      IF v_new_id IS NULL THEN
        RAISE EXCEPTION 'CONTROL POSITIVO: el camino feliz no devolvió id';
      END IF;
    ELSE
      RAISE NOTICE 'CONTROL POSITIVO: sin reunión de ARGA EN_CURSO, se omite el camino feliz (el negativo ya corrió)';
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0927', MESSAGE = 'deshacer control positivo H-27';
  EXCEPTION
    WHEN SQLSTATE 'P0927' THEN
      NULL; -- subtransacción deshecha: no queda residuo en ARGA
  END;

  RAISE NOTICE 'CONTROL POSITIVO OK: fn_secretaria_add_session_agenda_item rechaza kind inválido y crea el punto en el camino feliz cuando hay reunión abierta';
END
$control_positivo$;
