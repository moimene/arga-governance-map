-- H-52 (MOI-15) — la materia y la propuesta de un punto nacido en sesión no
-- se persistían en `agenda_items`.
--
-- Defecto medido en vivo (reunión 81a4de74…, punto 2 `dc938c06…`, grupo
-- nuevo, ola 5): la materia elegida en pantalla (`APROBACION_PRESUPUESTO`) y
-- el texto resolutivo propuesto vivían solo en el estado React del paso
-- "Agenda y debate". `fn_secretaria_add_session_agenda_item` (20260928151000,
-- H-27/H-32) tenía la firma `(meeting_id, order_number, title, kind,
-- decision_subtype)` —sin materia ni propuesta— y en una reunión nacida de
-- una convocatoria EMITIDA el cliente no puede hacer ningún UPDATE directo
-- (`fn_secretaria_guard_emitted_agenda_dml`, 42501). Resultado medido por
-- SELECT: `matter_code IS NULL` y `proposal_text IS NULL`, con lo que el
-- manifiesto del acta rechaza la reunión entera ('authoritative minute: every
-- point needs a catalogued matter and every decision needs its exact
-- proposal'), aunque se corrija H-53.
--
-- QUÉ CAMBIA
-- ----------
-- 1. La RPC acepta `p_matter_code` y `p_proposal_text` y los persiste.
-- 2. Un punto DECISORIO exige materia con fila en `materia_catalog` y
--    propuesta no vacía: es exactamente lo que el acta ya exige, y el mismo
--    criterio fail-closed que el cliente aplica desde H-50. Un punto no
--    decisorio solo persiste la materia si está catalogada (la heurística
--    `OTROS_LIBRE` del cliente no se escribe) y nunca lleva propuesta,
--    espejo de `agenda_items_decision_subtype_only_for_decisorio`.
-- 3. Camino idempotente (mismo meeting_id + order_number ya materializado):
--    si la fila es un punto nacido en sesión (`source_convocatoria_id IS
--    NULL`), la RPC SINCRONIZA título, naturaleza, subtipo, materia y
--    propuesta. Es la única vía por la que el secretario puede completar o
--    corregir ese punto en una reunión convocada —el guard de agenda
--    emitida sigue rechazando el UPDATE directo— y lo que permite reparar
--    por pantalla el punto `dc938c06…` ya existente. Un número ocupado por
--    un punto de la convocatoria se sigue rechazando: el orden del día
--    emitido no se toca nunca.
-- 4. La firma cambia (dos parámetros nuevos con DEFAULT), así que la
--    anterior se ELIMINA explícitamente antes de crear la nueva: dos
--    sobrecargas con el mismo nombre son ambiguas para PostgREST cuando la
--    llamada usa argumentos con nombre (supabase-js). El único llamador
--    (`useMaterializeAgendaItem`) pasa los parámetros nuevos; una llamada
--    antigua sin ellos sigue resolviendo por los DEFAULT.
--
-- Propietario, SECURITY DEFINER, tenant/rol, estado EN_CURSO, grants y el
-- punto abierto para el Comité Legal (arts. 223.1 y 238.3 LSC: qué materias
-- admiten un punto fuera del orden del día convocado) se mantienen tal cual
-- declaraba 20260928151000. Aquí no se decide ningún criterio jurídico nuevo.

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
  v_matter_code text;
  v_matter_catalogued boolean := false;
  v_proposal_text text;
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

  -- H-52: materia y propuesta. La materia solo se persiste si tiene fila en
  -- materia_catalog con etiqueta (misma condición que el manifiesto del acta).
  v_matter_code := NULLIF(btrim(p_matter_code), '');
  v_proposal_text := NULLIF(btrim(p_proposal_text), '');
  IF v_matter_code IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.materia_catalog mc
       WHERE mc.materia = v_matter_code
         AND COALESCE(btrim(mc.materia_label_es), '') <> ''
    ) INTO v_matter_catalogued;
  END IF;

  IF v_kind = 'DECISORIO' THEN
    IF v_matter_code IS NULL OR NOT v_matter_catalogued THEN
      RAISE EXCEPTION
        'SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED: un punto decisorio necesita una materia con fila en materia_catalog (recibida: %)',
        COALESCE(v_matter_code, '<vacía>')
        USING ERRCODE = '22023';
    END IF;
    IF v_proposal_text IS NULL THEN
      RAISE EXCEPTION
        'SESSION_AGENDA_ITEM_PROPOSAL_REQUIRED: un punto decisorio necesita el texto resolutivo propuesto'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT v_matter_catalogued THEN
      v_matter_code := NULL;
    END IF;
    v_proposal_text := NULL;
  END IF;

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
    -- H-52: el punto nacido en sesión ya existe (doble clic, reintento, o
    -- una corrida anterior a esta migración que lo dejó sin materia ni
    -- propuesta). Se sincronizan sus campos editables: es la única vía de
    -- escritura que el guard de agenda emitida reconoce. La materia nunca se
    -- borra con un valor no catalogado.
    UPDATE public.agenda_items
       SET title = v_title,
           kind = v_kind,
           decision_subtype = v_decision_subtype,
           matter_code = COALESCE(v_matter_code, matter_code),
           proposal_text = v_proposal_text
     WHERE id = v_existing.id
       AND tenant_id = v_meeting.tenant_id
       AND source_convocatoria_id IS NULL;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.agenda_items (
    tenant_id, meeting_id, order_number, title, kind, decision_subtype, matter_code, proposal_text
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_order_number, v_title, v_kind, v_decision_subtype,
    v_matter_code, v_proposal_text
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
  'H-27/H-52 (MOI-15): materializa on-demand un punto nacido en sesión (origin MEETING_FLOOR, sin convocatoria) en agenda_items para una reunión EN_CURSO, con materia catalogada y propuesta (obligatorias si es DECISORIO). Idempotente: si el punto nacido en sesión ya existe en ese order_number, sincroniza sus campos editables; nunca escribe source_convocatoria_id ni toca el orden del día emitido de la convocatoria. SECURITY DEFINER reconocido por fn_secretaria_guard_emitted_agenda_dml por compartir propietario con fn_secretaria_materialize_convocation_agenda. No decide criterio jurídico sobre qué materias admiten un punto fuera del orden del día convocado (arts. 223.1 y 238.3 LSC): reservado al Comité Legal.';

DO $verificacion$
DECLARE
  v_owner_new name;
  v_owner_ref name;
  v_secdef boolean;
BEGIN
  IF to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item(7 args) no existe tras crearla';
  END IF;
  IF to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICACION: la sobrecarga antigua de 5 argumentos sigue existiendo (ambigua para PostgREST)';
  END IF;

  SELECT pg_get_userbyid(proowner), prosecdef
    INTO v_owner_new, v_secdef
    FROM pg_proc
   WHERE oid = to_regprocedure('public.fn_secretaria_add_session_agenda_item(uuid,integer,text,text,text,text,text)');
  SELECT pg_get_userbyid(proowner)
    INTO v_owner_ref
    FROM pg_proc
   WHERE oid = to_regprocedure('public.fn_secretaria_materialize_convocation_agenda(uuid,uuid)');

  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_add_session_agenda_item no es SECURITY DEFINER';
  END IF;
  IF v_owner_new IS NULL OR v_owner_new IS DISTINCT FROM v_owner_ref THEN
    RAISE EXCEPTION
      'VERIFICACION: el propietario de la RPC (%) no coincide con el de fn_secretaria_materialize_convocation_agenda (%) — el trigger fn_secretaria_guard_emitted_agenda_dml no la reconocerá',
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

  RAISE NOTICE 'VERIFICACION OK: fn_secretaria_add_session_agenda_item(7 args) (owner=%, security definer=%), sobrecarga antigua eliminada', v_owner_new, v_secdef;
END
$verificacion$;

-- Control positivo del propio instrumento, en una subtransacción que se
-- deshace a propósito (patrón 20260928151000 / MOI-137 D-20): no queda
-- residuo en ARGA (tenant_id por defecto de agenda_items).
DO $control_positivo$
DECLARE
  v_any_meeting_id uuid;
  v_open_meeting_id uuid;
  v_materia_catalogada text;
  v_caught_matter boolean := false;
  v_caught_uncatalogued boolean := false;
  v_caught_proposal boolean := false;
  v_new_id uuid;
  v_again_id uuid;
  v_probe_order integer;
  v_row public.agenda_items%ROWTYPE;
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

  SELECT mc.materia INTO v_materia_catalogada
  FROM public.materia_catalog mc
  WHERE COALESCE(btrim(mc.materia_label_es), '') <> ''
  ORDER BY mc.materia
  LIMIT 1;

  IF v_any_meeting_id IS NULL OR v_materia_catalogada IS NULL THEN
    RAISE NOTICE 'CONTROL POSITIVO: sin reunión de ARGA o sin catálogo de materias, se omite (no bloquea la migración)';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);

    -- Negativos (corren antes de tocar meetings: la validación es previa).
    BEGIN
      PERFORM public.fn_secretaria_add_session_agenda_item(
        v_any_meeting_id, 999999, 'Control positivo H-52 (usar y tirar)', 'DECISORIO', NULL, NULL, 'Texto resolutivo propuesto de control, suficientemente largo.'
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE 'SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED%' THEN
        v_caught_matter := true;
      ELSE
        RAISE EXCEPTION 'CONTROL POSITIVO: error inesperado con DECISORIO sin materia: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;
    BEGIN
      PERFORM public.fn_secretaria_add_session_agenda_item(
        v_any_meeting_id, 999999, 'Control positivo H-52 (usar y tirar)', 'DECISORIO', NULL, 'MATERIA_INEXISTENTE_H52', 'Texto resolutivo propuesto de control, suficientemente largo.'
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE 'SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED%' THEN
        v_caught_uncatalogued := true;
      ELSE
        RAISE EXCEPTION 'CONTROL POSITIVO: error inesperado con materia no catalogada: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;
    BEGIN
      PERFORM public.fn_secretaria_add_session_agenda_item(
        v_any_meeting_id, 999999, 'Control positivo H-52 (usar y tirar)', 'DECISORIO', NULL, v_materia_catalogada, '   '
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE 'SESSION_AGENDA_ITEM_PROPOSAL_REQUIRED%' THEN
        v_caught_proposal := true;
      ELSE
        RAISE EXCEPTION 'CONTROL POSITIVO: error inesperado con propuesta vacía: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;
    IF NOT (v_caught_matter AND v_caught_uncatalogued AND v_caught_proposal) THEN
      RAISE EXCEPTION 'CONTROL POSITIVO: la RPC aceptó un DECISORIO sin materia catalogada o sin propuesta (%/%/%)',
        v_caught_matter, v_caught_uncatalogued, v_caught_proposal;
    END IF;

    -- Camino feliz + idempotencia con sincronización, solo si hay una
    -- reunión EN_CURSO a mano. Todo dentro de la subtransacción deshecha.
    IF v_open_meeting_id IS NOT NULL THEN
      SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_probe_order
      FROM public.agenda_items
      WHERE meeting_id = v_open_meeting_id;

      v_new_id := public.fn_secretaria_add_session_agenda_item(
        v_open_meeting_id, v_probe_order, 'Control positivo H-52 (camino feliz)', 'DECISORIO', NULL,
        v_materia_catalogada, 'Propuesta inicial de control positivo H-52, usar y tirar.'
      );
      SELECT * INTO v_row FROM public.agenda_items WHERE id = v_new_id;
      IF v_row.matter_code IS DISTINCT FROM v_materia_catalogada
         OR v_row.proposal_text IS DISTINCT FROM 'Propuesta inicial de control positivo H-52, usar y tirar.' THEN
        RAISE EXCEPTION 'CONTROL POSITIVO: la inserción no persistió materia/propuesta (%/%)', v_row.matter_code, v_row.proposal_text;
      END IF;

      v_again_id := public.fn_secretaria_add_session_agenda_item(
        v_open_meeting_id, v_probe_order, 'Control positivo H-52 (camino feliz, corregido)', 'DECISORIO', NULL,
        v_materia_catalogada, 'Propuesta corregida de control positivo H-52, usar y tirar.'
      );
      IF v_again_id IS DISTINCT FROM v_new_id THEN
        RAISE EXCEPTION 'CONTROL POSITIVO: la segunda llamada no fue idempotente (% vs %)', v_again_id, v_new_id;
      END IF;
      SELECT * INTO v_row FROM public.agenda_items WHERE id = v_new_id;
      IF v_row.title IS DISTINCT FROM 'Control positivo H-52 (camino feliz, corregido)'
         OR v_row.proposal_text IS DISTINCT FROM 'Propuesta corregida de control positivo H-52, usar y tirar.' THEN
        RAISE EXCEPTION 'CONTROL POSITIVO: la segunda llamada no sincronizó título/propuesta';
      END IF;
    ELSE
      RAISE NOTICE 'CONTROL POSITIVO: sin reunión de ARGA EN_CURSO, se omite el camino feliz (los negativos ya corrieron)';
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0927', MESSAGE = 'deshacer control positivo H-52';
  EXCEPTION
    WHEN SQLSTATE 'P0927' THEN
      NULL; -- subtransacción deshecha: no queda residuo en ARGA
  END;

  RAISE NOTICE 'CONTROL POSITIVO OK: fn_secretaria_add_session_agenda_item exige materia catalogada y propuesta en DECISORIO, persiste ambas y sincroniza en el camino idempotente';
END
$control_positivo$;
