-- Ensayo de 20260928100000_grc_formacion_registros.sql — SIN begin/rollback
-- propios: el ejecutor seguro (python3 /tmp/probe_rollback.py) los añade.
-- Se pasa junto con la migración en la misma invocación, así que estas
-- pruebas corren dentro de la MISMA transacción en la que la migración ya se
-- aplicó (sin residuo: todo se deshace al final por el ejecutor).

-- 1. Como AUTHENTICATED con sesión real (SECRETARIO de ARGA), un INSERT
--    directo sobre grc_training_records se rechaza: solo la RPC escribe.
do $probe_insert_directo$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_obl_arga uuid;
  v_ai_system uuid;
begin
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';
  select id into v_ai_system from public.ai_systems where tenant_id = v_arga limit 1;

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  begin
    insert into public.grc_training_records (tenant_id, obligation_id, ai_system_id, person_id, content_version)
    values (v_arga, v_obl_arga, v_ai_system, 'f8b64324-a19d-4050-98c2-8e34cff52087', 'insert-directo-probe');
    raise exception 'PROBE FALLO 1: un INSERT directo de authenticated sobre grc_training_records NO se rechazó';
  exception
    when insufficient_privilege then
      null; -- esperado: el GRANT revocado lo bloquea antes de llegar a RLS.
  end;

  reset role;
end;
$probe_insert_directo$;

-- 2. El guardia de `controls` (evidencia de formación) se dispara para un
--    INSERT hecho por AUTHENTICATED (camino real: la app inserta controles
--    directamente, sin RPC), no solo para el postgres del bloque de
--    verificación de la propia migración. Va ANTES del probe 3: tiene que
--    correr con la tabla de formación todavía a cero registros del tenant.
do $probe_controls_guard$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_obl_arga uuid;
  v_bloqueado boolean := false;
begin
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  begin
    insert into public.controls (id, tenant_id, code, name, status, obligation_id)
    values ('00000000-0000-0000-0000-0000c00e0176', v_arga, '__PROBE_MOI175_T6_AUTH__', 'Sonda authenticated', 'Efectivo', v_obl_arga);
  exception
    when others then
      if sqlerrm like 'FORMACION_SIN_EVIDENCIA:%' then
        v_bloqueado := true;
      else
        raise;
      end if;
  end;

  reset role;

  if not v_bloqueado then
    delete from public.controls where id = '00000000-0000-0000-0000-0000c00e0176';
    raise exception 'PROBE FALLO 2: authenticated pudo declarar Efectivo el control de OBL-RIA-ORG-04 sin evidencia';
  end if;
end;
$probe_controls_guard$;

-- 3. Camino positivo: la RPC SÍ funciona para authenticated con sesión real,
--    devuelve un id de fila propia del tenant de la sesión, y CON esa
--    evidencia el mismo control que el probe anterior rechazó ahora SÍ se
--    acepta — así el probe 2 no queda "verde por casualidad" (guardia
--    siempre cerrada) sino que se demuestra el camino en los dos sentidos.
do $probe_rpc_positivo$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_obl_arga uuid;
  v_ai_system uuid;
  v_id uuid;
  v_tenant_fila uuid;
begin
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';
  select id into v_ai_system from public.ai_systems where tenant_id = v_arga limit 1;

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  select public.fn_grc_registrar_formacion(v_obl_arga, v_ai_system, 'f8b64324-a19d-4050-98c2-8e34cff52087', 'probe-authenticated-rpc', current_date)
    into v_id;

  if v_id is null then
    raise exception 'PROBE FALLO 3: fn_grc_registrar_formacion no devolvió id para authenticated';
  end if;

  select tenant_id into v_tenant_fila from public.grc_training_records where id = v_id;
  if v_tenant_fila <> v_arga then
    raise exception 'PROBE FALLO 3b: la fila quedó en el tenant %, no en ARGA', v_tenant_fila;
  end if;

  -- Ahora SÍ hay evidencia: el mismo INSERT del probe 2 debe aceptarse.
  insert into public.controls (id, tenant_id, code, name, status, obligation_id)
  values ('00000000-0000-0000-0000-0000c00e0176', v_arga, '__PROBE_MOI175_T6_AUTH__', 'Sonda authenticated', 'Efectivo', v_obl_arga);

  reset role;

  delete from public.controls where id = '00000000-0000-0000-0000-0000c00e0176';
  delete from public.grc_training_records where id = v_id;
end;
$probe_rpc_positivo$;

-- 4. Negativo cross-tenant: authenticated de ARGA no puede registrar
--    formación contra una obligación de Garrigues (guardia de tenant).
do $probe_cross_tenant$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_obl_garr uuid;
  v_ai_system_arga uuid;
  v_bloqueado boolean := false;
begin
  select id into v_obl_garr from public.obligations where tenant_id = v_garr and code = 'OBL-RIA-ORG-04';
  select id into v_ai_system_arga from public.ai_systems where tenant_id = v_arga limit 1;

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  begin
    perform public.fn_grc_registrar_formacion(v_obl_garr, v_ai_system_arga, 'f8b64324-a19d-4050-98c2-8e34cff52087', 'probe-cross-tenant', current_date);
  exception
    when others then
      if sqlerrm like '%pertenece a otro tenant%' then
        v_bloqueado := true;
      else
        raise;
      end if;
  end;

  reset role;

  if not v_bloqueado then
    raise exception 'PROBE FALLO 4: fn_grc_registrar_formacion aceptó una obligación de otro tenant';
  end if;
end;
$probe_cross_tenant$;

select 'PROBE 20260928100000 OK' as resultado;
