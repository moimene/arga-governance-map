-- Ensayo de fn_secretaria_add_session_agenda_item con materia y propuesta
-- (H-52, MOI-15). Corre DESPUÉS de aplicar 20260928171000 y COMO
-- `authenticated` de verdad (`set local role authenticated`) con sesiones
-- reales del grupo nuevo (…0003) y de Garrigues (…0002), vía
-- `set_config('request.jwt.claims', …, true)`. Todo dentro del BEGIN … ROLLBACK
-- del ejecutor (`scripts/db/ensayo-rollback.sh`): nada de esto queda en Cloud.
--
-- Reunión real usada: 81a4de74-2bc4-4f99-8a98-12bfc038a630 (tenant …0003,
-- EN_CURSO, punto 1 de convocatoria `07af9c01…` y punto 2 nacido en sesión
-- `dc938c06…` que la ola 5 dejó SIN materia ni propuesta: el caso H-52).

do $probe$
declare
  v_nuevo_secretario uuid := '6452252f-3214-4c9a-857b-b439626d215e';
  v_garr_admin uuid := '657c8700-c90f-4d22-b2db-5419d2d8e292';
  v_meeting_open uuid := '81a4de74-2bc4-4f99-8a98-12bfc038a630';
  v_punto_sesion uuid := 'dc938c06-1334-4936-a84b-02297336f7fb';
  v_tenant_nuevo uuid := '00000000-0000-0000-0000-000000000003';
  v_titulo text := 'Aprobación del presupuesto anual 2027 de Corporación Nueva, S.A.';
  v_propuesta text := 'Se acuerda aprobar el presupuesto anual del ejercicio 2027 de Corporación Nueva, S.A. presentado por la Presidencia al Consejo, con dotación de partidas de gestión ordinaria y facultad de ejecución conforme al art. 249 LSC.';
  v_err text;
  v_id uuid;
  v_row public.agenda_items%rowtype;
  v_next_order int;
  v_count_before int;
  v_count_after int;
begin
  -- Sanidad del propio ensayo.
  perform 1 from public.meetings
   where id = v_meeting_open and tenant_id = v_tenant_nuevo and status = 'EN_CURSO';
  if not found then
    raise exception 'PROBE H-52: la reunión % no está EN_CURSO en el tenant %', v_meeting_open, v_tenant_nuevo;
  end if;
  select * into v_row from public.agenda_items where id = v_punto_sesion;
  if not found or v_row.meeting_id <> v_meeting_open or v_row.order_number <> 2 or v_row.source_convocatoria_id is not null then
    raise exception 'PROBE H-52: el punto nacido en sesión % no es el esperado (order 2, sin convocatoria)', v_punto_sesion;
  end if;
  if v_row.matter_code is not null or v_row.proposal_text is not null then
    raise notice 'PROBE H-52: el punto % ya traía materia/propuesta (%/%); el ensayo sigue, pero el caso ya no reproduce el hueco de la ola 5',
      v_punto_sesion, v_row.matter_code, left(v_row.proposal_text, 30);
  end if;
  select count(*) into v_count_before from public.agenda_items where meeting_id = v_meeting_open;

  -- 1. Positivo (sincronización): SECRETARIO del grupo nuevo completa el
  --    punto 2 ya existente con materia catalogada y propuesta. Debe devolver
  --    el MISMO id y dejar ambos campos persistidos.
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_id := public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, 2, v_titulo, 'DECISORIO', null, 'APROBACION_PRESUPUESTO', v_propuesta
    );
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' then
    raise exception 'PROBE H-52: el secretario no pudo completar el punto nacido en sesión (%)', v_err;
  end if;
  if v_id is distinct from v_punto_sesion then
    raise exception 'PROBE H-52: la sincronización devolvió otro id (% en vez de %)', v_id, v_punto_sesion;
  end if;
  select * into v_row from public.agenda_items where id = v_punto_sesion;
  if v_row.matter_code is distinct from 'APROBACION_PRESUPUESTO' or v_row.proposal_text is distinct from v_propuesta or v_row.kind <> 'DECISORIO' then
    raise exception 'PROBE H-52: materia/propuesta no persistidas (%/%)', v_row.matter_code, left(v_row.proposal_text, 30);
  end if;
  select count(*) into v_count_after from public.agenda_items where meeting_id = v_meeting_open;
  if v_count_after <> v_count_before then
    raise exception 'PROBE H-52: la sincronización creó filas (% -> %)', v_count_before, v_count_after;
  end if;

  -- 2. Negativo: el número 1 pertenece al orden del día emitido → rechazo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, 1, 'Intento de pisar el punto convocado', 'DECISORIO', null, 'APROBACION_PRESUPUESTO', v_propuesta
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION%' then
    raise exception 'PROBE H-52: el punto de convocatoria no quedó protegido (%)', v_err;
  end if;

  -- 3. Negativo: DECISORIO nuevo sin materia catalogada → rechazo, sin fila.
  select coalesce(max(order_number), 0) + 1 into v_next_order from public.agenda_items where meeting_id = v_meeting_open;
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, v_next_order, 'Decisorio sin materia (ensayo)', 'DECISORIO', null, 'APROBACION_PLAN_NEGOCIO', v_propuesta
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED%' then
    raise exception 'PROBE H-52: un DECISORIO con materia sin catálogo (H-50) no se rechazó (%)', v_err;
  end if;
  if exists (select 1 from public.agenda_items where meeting_id = v_meeting_open and order_number = v_next_order) then
    raise exception 'PROBE H-52: el rechazo dejó fila';
  end if;

  -- 4. Positivo: un punto DELIBERATIVO con la heurística OTROS_LIBRE se crea
  --    con matter_code NULL (no se escribe una materia sin catálogo) y sin
  --    propuesta. En subtransacción deshecha (sentinela P0927): la agenda de
  --    una reunión convocada no admite DELETE, y este punto de prueba no debe
  --    quedar para el recorrido del acta que sigue en el mismo ensayo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_id := public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, v_next_order, 'Ruegos y preguntas (ensayo H-52)', 'DELIBERATIVO', null, 'OTROS_LIBRE', 'texto que no debe persistir'
    );
    select * into v_row from public.agenda_items where id = v_id;
    if v_row.matter_code is not null or v_row.proposal_text is not null or v_row.source_convocatoria_id is not null then
      raise exception 'PROBE H-52: el deliberativo persistió materia sin catálogo o propuesta (%/%)', v_row.matter_code, v_row.proposal_text;
    end if;
    raise exception using errcode = 'P0927', message = 'deshacer punto deliberativo de prueba';
  exception
    when sqlstate 'P0927' then v_err := 'OK';
    when others then v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' then
    raise exception 'PROBE H-52: el punto deliberativo no se creó como se esperaba (%)', v_err;
  end if;
  if exists (select 1 from public.agenda_items where meeting_id = v_meeting_open and order_number = v_next_order) then
    raise exception 'PROBE H-52: el punto deliberativo de prueba no se deshizo';
  end if;

  -- 5. Negativo: admin de Garrigues sobre la reunión del grupo nuevo → 42501.
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, 2, v_titulo, 'DECISORIO', null, 'APROBACION_PRESUPUESTO', v_propuesta
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like '42501%' then
    raise exception 'PROBE H-52: Garrigues pudo escribir en la reunión del grupo nuevo (%)', v_err;
  end if;

  -- 6. Negativo: anon no tiene EXECUTE.
  set local role anon;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, 2, v_titulo, 'DECISORIO', null, 'APROBACION_PRESUPUESTO', v_propuesta
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_err not like '42501%' then
    raise exception 'PROBE H-52: anon pudo ejecutar la RPC (%)', v_err;
  end if;

  raise notice 'PROBE H-52 OK: el punto % queda con materia APROBACION_PRESUPUESTO y propuesta por la vía idempotente (mismo id, sin filas nuevas); convocatoria protegida; DECISORIO sin catálogo rechazado sin fila; deliberativo sin materia catalogada persiste NULL; Garrigues y anon rechazados con 42501',
    v_punto_sesion;
end
$probe$;
