-- Ensayo de 20260928101000_grc_action_plans_origen.sql — SIN begin/rollback
-- propios: el ejecutor seguro los añade. Pasar junto con la migración.

-- 1. Camino que ya existía (finding_id): sigue funcionando igual para
--    authenticated, sin ningún cambio de comportamiento.
do $probe_finding_sigue_igual$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_finding uuid := 'cb65848e-0258-49b9-8e0d-36099b7ffc1d'; -- HALL-008, ARGA
  v_id uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  insert into public.action_plans (tenant_id, finding_id, title, status)
  values (v_arga, v_finding, 'Sonda MOI-175 (origen hallazgo, camino existente)', 'Pendiente')
  returning id into v_id;

  delete from public.action_plans where id = v_id;
  reset role;

  if v_id is null then
    raise exception 'PROBE FALLO 1: el camino existente (solo finding_id) dejó de funcionar para authenticated';
  end if;
end;
$probe_finding_sigue_igual$;

-- 2. Camino nuevo: authenticated de ARGA da de alta un plan SOLO con
--    obligation_id (sin finding_id) y se acepta.
do $probe_obligation_origen$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_obl_arga uuid;
  v_id uuid;
begin
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  insert into public.action_plans (tenant_id, obligation_id, title, status)
  values (v_arga, v_obl_arga, 'Sonda MOI-175 (origen obligación, authenticated)', 'Pendiente')
  returning id into v_id;

  delete from public.action_plans where id = v_id;
  reset role;

  if v_id is null then
    raise exception 'PROBE FALLO 2: authenticated no pudo dar de alta un plan con solo obligation_id';
  end if;
end;
$probe_obligation_origen$;

-- 3. Negativo: authenticated no puede dar de alta un plan sin ningún origen.
do $probe_sin_origen$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_rechazado boolean := false;
begin
  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  begin
    insert into public.action_plans (tenant_id, title, status)
    values (v_arga, 'Sonda MOI-175 (sin origen, authenticated)', 'Pendiente');
  exception
    when check_violation then
      v_rechazado := true;
  end;

  reset role;

  if not v_rechazado then
    raise exception 'PROBE FALLO 3: authenticated pudo dar de alta un plan sin ningún origen';
  end if;
end;
$probe_sin_origen$;

-- 4. Negativo cross-tenant: authenticated de ARGA no puede colgar un plan de
--    una obligación de Garrigues, aunque el tenant_id de la FILA sea el suyo
--    (RLS solo mira tenant_id de la fila, no el de la FK — el guardia es
--    quien lo impide).
do $probe_cross_tenant$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_obl_garr uuid;
  v_bloqueado boolean := false;
begin
  select id into v_obl_garr from public.obligations where tenant_id = v_garr and code = 'OBL-RIA-ORG-04';

  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);
  set local role authenticated;

  begin
    insert into public.action_plans (tenant_id, obligation_id, title, status)
    values (v_arga, v_obl_garr, 'Sonda MOI-175 (cross-tenant, authenticated)', 'Pendiente');
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
    raise exception 'PROBE FALLO 4: authenticated pudo enlazar un plan de ARGA a una obligación de Garrigues';
  end if;
end;
$probe_cross_tenant$;

select 'PROBE 20260928101000 OK' as resultado;
