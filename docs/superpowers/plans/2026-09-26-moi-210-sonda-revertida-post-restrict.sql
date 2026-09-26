-- MOI-210 — Sonda revertida posterior a 20260926121000 (FK CASCADE → RESTRICT).
-- Reescrita por el orquestador el 26-09-2026: la versión del implementador
-- registraba sistemas por fn_aims_registrar_sistema con respuestas que el
-- servidor rechaza con CLASIFICACION_INCOHERENTE, así que nunca llegaba a
-- probar la restricción. Esta versión prueba el comportamiento directamente:
-- un sistema con una versión (aims_system_versions) ya no se puede borrar.
-- Se ejecuta como postgres y TODO se deshace al final (rollback).
begin;

do $sonda$
declare
  v_system uuid := gen_random_uuid();
  v_bloqueado boolean := false;
begin
  insert into public.ai_systems (id, tenant_id, name, status)
  values (v_system, '00000000-0000-0000-0000-000000000003', 'PROBE-MOI-210-RESTRICT', 'PLANIFICADO');

  insert into public.aims_system_versions (tenant_id, system_id, version_label)
  values ('00000000-0000-0000-0000-000000000003', v_system, 'v-probe');

  begin
    delete from public.ai_systems where id = v_system;
  exception when foreign_key_violation then
    v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'MOI-210: se pudo borrar un sistema con versión (la FK no es RESTRICT)';
  end if;
  raise notice 'MOI-210 OK: el borrado de un sistema con versión se rechaza (RESTRICT)';

  -- Control positivo del instrumento: sin dependientes, el borrado sí pasa.
  delete from public.aims_system_versions where system_id = v_system;
  delete from public.ai_systems where id = v_system;
  if exists (select 1 from public.ai_systems where id = v_system) then
    raise exception 'MOI-210: control positivo fallido, el sistema sin dependientes no se borró';
  end if;
  raise notice 'MOI-210 OK: sin dependientes el borrado pasa (control positivo)';
end
$sonda$;

rollback;
