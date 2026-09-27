-- Ensayo de fn_secretaria_add_session_agenda_item (H-27, MOI-15).
--
-- Corre COMO `authenticated` de verdad (`set local role authenticated`) con
-- sesiones reales del grupo nuevo (…0003) y de Garrigues (…0002), vía
-- `set_config('request.jwt.claims', …, true)`. Todo dentro del
-- BEGIN … ROLLBACK del ejecutor seguro: nada de esto queda en Cloud.
--
-- Reunión real usada: 81a4de74-2bc4-4f99-8a98-12bfc038a630 (tenant …0003,
-- EN_CURSO, con un punto ya materializado de convocatoria en order_number 1).
-- Reunión CONVOCADA (no abierta) del mismo tenant:
-- a0319621-5509-48cb-a657-cc416782808b.

do $probe$
declare
  v_nuevo_secretario uuid := '6452252f-3214-4c9a-857b-b439626d215e';
  v_garr_admin uuid := '657c8700-c90f-4d22-b2db-5419d2d8e292';
  v_meeting_open uuid := '81a4de74-2bc4-4f99-8a98-12bfc038a630';
  v_meeting_convocada uuid := 'a0319621-5509-48cb-a657-cc416782808b';
  v_tenant_nuevo uuid := '00000000-0000-0000-0000-000000000003';
  v_err text;
  v_id uuid;
  v_id2 uuid;
  v_n int;
  v_next_order int;
begin
  -- Sanidad del propio ensayo: la reunión de prueba existe, es del tenant
  -- esperado, está EN_CURSO y ya tiene un punto de convocatoria en 1.
  perform 1 from public.meetings
   where id = v_meeting_open and tenant_id = v_tenant_nuevo and status = 'EN_CURSO';
  if not found then
    raise exception 'PROBE: la reunión de ensayo % no está EN_CURSO en el tenant %', v_meeting_open, v_tenant_nuevo;
  end if;
  perform 1 from public.agenda_items
   where meeting_id = v_meeting_open and order_number = 1 and source_convocatoria_id is not null;
  if not found then
    raise exception 'PROBE: la reunión de ensayo % no tiene un punto 1 de convocatoria (precondición del ensayo)', v_meeting_open;
  end if;
  select coalesce(max(order_number), 0) + 1 into v_next_order
    from public.agenda_items where meeting_id = v_meeting_open;

  -- ─────────────────────────────────────────────────────────────────────
  -- 1. Positivo: usuario real del grupo nuevo (SECRETARIO), reunión abierta
  --    de su propio tenant, nacida de convocatoria emitida → fila creada.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_id := public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, v_next_order, 'Ensayo H-27: punto nacido en sesión', 'DELIBERATIVO', null
    );
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' or v_id is null then
    raise exception 'PROBE: el secretario del grupo nuevo no pudo añadir un punto nacido en sesión (%)', v_err;
  end if;

  perform 1 from public.agenda_items
   where id = v_id and meeting_id = v_meeting_open and tenant_id = v_tenant_nuevo
     and source_convocatoria_id is null and order_number = v_next_order;
  if not found then
    raise exception 'PROBE: la fila creada (%) no tiene la forma esperada (tenant/meeting/source_convocatoria_id NULL)', v_id;
  end if;

  -- Idempotencia: repetir la misma llamada (mismo meeting_id/order_number)
  -- devuelve el MISMO id, no crea una segunda fila.
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_id2 := public.fn_secretaria_add_session_agenda_item(
    v_meeting_open, v_next_order, 'Ensayo H-27: punto nacido en sesión (reintento)', 'DELIBERATIVO', null
  );
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_id2 is distinct from v_id then
    raise exception 'PROBE: la llamada idempotente devolvió un id distinto (% vs %)', v_id2, v_id;
  end if;
  select count(*) into v_n from public.agenda_items where meeting_id = v_meeting_open and order_number = v_next_order;
  if v_n <> 1 then
    raise exception 'PROBE: la llamada idempotente duplicó la fila (% filas en order_number %)', v_n, v_next_order;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 2. Control negativo: el INSERT directo por PostgREST sigue rechazado
  --    (el defecto H-27 era exactamente esto; la RPC no lo desactiva).
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    insert into public.agenda_items (tenant_id, meeting_id, order_number, title, kind)
    values (v_tenant_nuevo, v_meeting_open, v_next_order + 1, 'Ensayo H-27: INSERT directo (debe rechazarse)', 'DELIBERATIVO');
    v_err := 'INSERTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err = 'INSERTADA' then
    raise exception 'PROBE: el INSERT directo en agenda_items se aceptó (el guard AGENDA_EMITIDA_RPC_REQUIRED no está activo)';
  end if;
  if v_err !~* 'AGENDA_EMITIDA_RPC_REQUIRED' then
    raise exception 'PROBE: el INSERT directo se rechazó por un motivo distinto al esperado (%)', v_err;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. Cross-tenant: admin@ de Garrigues no puede añadir un punto en una
  --    reunión del grupo nuevo.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, v_next_order + 2, 'Ensayo H-27: cross-tenant (debe rechazarse)', 'DELIBERATIVO', null
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SESSION_AGENDA_ITEM_TENANT_MISMATCH%' then
    raise exception 'PROBE: admin@garrigues pudo añadir un punto en una reunión del grupo nuevo (%)', v_err;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 4. Reunión no abierta (CONVOCADA, no EN_CURSO): rechazada.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_convocada, 1, 'Ensayo H-27: reunión no abierta (debe rechazarse)', 'DELIBERATIVO', null
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SESSION_AGENDA_ITEM_MEETING_NOT_OPEN%' then
    raise exception 'PROBE: se añadió un punto en una reunión no abierta (%)', v_err;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 5. El orden del día EMITIDO de la convocatoria no se toca: pedir el
  --    número 1 (ya ocupado por un punto de convocatoria) se rechaza.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_add_session_agenda_item(
      v_meeting_open, 1, 'Ensayo H-27: pisar punto de convocatoria (debe rechazarse)', 'DELIBERATIVO', null
    );
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION%' then
    raise exception 'PROBE: se pudo pisar el punto 1 de convocatoria (%)', v_err;
  end if;

  raise exception 'PROBE_REVERTIDO';
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if sqlerrm <> 'PROBE_REVERTIDO' then
    raise exception 'PROBE FALLIDO: %', sqlerrm;
  end if;
  raise notice 'PROBE OK: alta real del grupo nuevo en reunión abierta nacida de convocatoria (con idempotencia), INSERT directo sigue rechazado, cross-tenant rechazado, reunión no abierta rechazada, punto de convocatoria no pisable';
end;
$probe$;
