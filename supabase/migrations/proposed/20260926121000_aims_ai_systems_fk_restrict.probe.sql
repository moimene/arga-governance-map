-- MOI-210 — ensayo revertido de 20260926121000_aims_ai_systems_fk_restrict.sql.
-- Lo ejecuta el orquestador (MCP execute_sql o psql), nunca el agente de la
-- tarea. Aplica la migracion, comprueba el resultado y termina en ROLLBACK:
-- nada queda commiteado.

begin;

do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_classification_questionnaires'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_classification_questionnaires drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_system_versions'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_system_versions drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_technical_file_sections'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_technical_file_sections drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_monitoring_indicators'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_monitoring_indicators drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;
end $$;

do $$
declare
  v_restrict_count integer;
  v_control_cascade_count integer;
begin
  select count(*) into v_restrict_count
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.ai_systems'::regclass
      and conrelid = any (array[
        'public.aims_classification_questionnaires'::regclass,
        'public.aims_system_versions'::regclass,
        'public.aims_technical_file_sections'::regclass,
        'public.aims_monitoring_indicators'::regclass
      ])
      and confdeltype = 'r';

  if v_restrict_count <> 4 then
    raise exception 'MOI-210 ensayo: se esperaban 4 FK en RESTRICT; se encontraron %', v_restrict_count;
  end if;

  select count(*) into v_control_cascade_count
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.ai_systems'::regclass
      and conrelid = 'public.aims_evidence_packs'::regclass
      and confdeltype = 'c';

  if v_control_cascade_count <> 1 then
    raise exception 'MOI-210 ensayo: control positivo fallido — aims_evidence_packs deberia seguir en CASCADE';
  end if;
end $$;

-- Control de comportamiento: con la FK ya en RESTRICT dentro de esta misma
-- transaccion, un sistema con un cuestionario COMPLETED deja de poder
-- borrarse. Se comprueba con datos temporales que el propio ROLLBACK deshace
-- (no requiere tenant real ni RLS: se ejecuta como el rol de conexion, sin
-- SET LOCAL ROLE, solo para probar la restriccion de integridad referencial).
do $$
declare
  v_tenant uuid := '00000000-0000-0000-0000-00000000fe10';
  v_system uuid;
begin
  insert into public.ai_systems (id, tenant_id, name, status)
  values (gen_random_uuid(), v_tenant, 'PROBE-MOI-210-RESTRICT', 'ACTIVO')
  returning id into v_system;

  insert into public.aims_classification_questionnaires (tenant_id, system_id, questionnaire_version, status)
  values (v_tenant, v_system, '1.1', 'DRAFT');

  begin
    delete from public.ai_systems where id = v_system;
    raise exception 'MOI-210 ensayo: el DELETE del sistema con cuestionario NO fue bloqueado por RESTRICT';
  exception when foreign_key_violation then
    null; -- esperado: RESTRICT lo bloquea.
  end;
end $$;

select
  conname,
  conrelid::regclass as tabla,
  confdeltype
from pg_constraint
where contype = 'f'
  and confrelid = 'public.ai_systems'::regclass
  and conrelid::regclass::text in (
    'aims_classification_questionnaires',
    'aims_system_versions',
    'aims_technical_file_sections',
    'aims_monitoring_indicators',
    'aims_evidence_packs'
  )
order by 1;

rollback;
