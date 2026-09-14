-- Reconciliación de seis políticas RLS que existían en Cloud sin espejo en el
-- repo.
--
-- MEDIDO el 2026-09-14 (pg_policies): sobre `ai_risk_assessments` y
-- `ai_compliance_checks` coexistían la política FOR ALL de `20260521150000`
-- (`aims_assessments_tenant_isolation` / `aims_compliance_checks_tenant_isolation`,
-- USING + WITH CHECK por join a `ai_systems`) con tres políticas por comando
-- en cada tabla (`…_tenant_select`, `…_tenant_insert`, `…_tenant_update`) con
-- EXACTAMENTE el mismo predicado. Ninguna migración del repo las crea: son
-- drift schema↔repo. Al ser permisivas y redundantes (se OR-ean con la FOR
-- ALL) no cambian el comportamiento; se retiran para que Cloud vuelva a ser lo
-- que el repo dice. No se toca el predicado de aislamiento.

drop policy if exists ai_risk_assessments_tenant_select on public.ai_risk_assessments;
drop policy if exists ai_risk_assessments_tenant_insert on public.ai_risk_assessments;
drop policy if exists ai_risk_assessments_tenant_update on public.ai_risk_assessments;
drop policy if exists ai_compliance_checks_tenant_select on public.ai_compliance_checks;
drop policy if exists ai_compliance_checks_tenant_insert on public.ai_compliance_checks;
drop policy if exists ai_compliance_checks_tenant_update on public.ai_compliance_checks;

do $verificacion$
declare
  v_row record;
  v_control int;
begin
  for v_row in
    select t.tabla, t.politica,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tabla) as n,
           (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = t.tabla and p.policyname = t.politica
               and p.cmd = 'ALL' and p.permissive = 'PERMISSIVE'
               and p.qual is not null and p.with_check is not null
               and p.qual ilike '%fn_current_tenant_id()%' and p.with_check ilike '%fn_current_tenant_id()%'
               and 'authenticated' = any(p.roles)) as ok
      from (values ('ai_risk_assessments', 'aims_assessments_tenant_isolation'),
                   ('ai_compliance_checks', 'aims_compliance_checks_tenant_isolation')) as t(tabla, politica)
  loop
    if v_row.n <> 1 then
      raise exception 'VERIFICACION: % debe quedar con exactamente 1 política y tiene %', v_row.tabla, v_row.n;
    end if;
    if v_row.ok <> 1 then
      raise exception 'VERIFICACION: la política % de % no es FOR ALL permisiva con USING y WITH CHECK por tenant', v_row.politica, v_row.tabla;
    end if;
  end loop;

  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in ('ai_risk_assessments', 'ai_compliance_checks')
                and not c.relrowsecurity) then
    raise exception 'VERIFICACION: RLS deshabilitada en alguna de las dos tablas';
  end if;

  -- Control positivo: el instrumento ve políticas donde las hay.
  select count(*) into v_control from pg_policies
   where schemaname = 'public' and tablename = 'ai_systems' and policyname = 'tenant_isolation';
  if v_control <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve la política tenant_isolation de ai_systems';
  end if;

  raise notice 'VERIFICACION OK: una política FOR ALL por tabla, RLS activa, drift retirado';
end;
$verificacion$;
