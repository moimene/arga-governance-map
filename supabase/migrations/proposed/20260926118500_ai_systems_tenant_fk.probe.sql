-- Ensayo revertido de supabase/migrations/20260926118500_ai_systems_tenant_fk.sql (MOI-185).
-- NO ejecutar fuera de una revisión deliberada: aplica la migración, prueba
-- el rechazo de un grupo inexistente y deshace todo al final.

begin;

-- 1) Aplica la migración (idéntica a la del fichero real).
do $migracion$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ai_systems'::regclass
       and conname = 'ai_systems_tenant_id_fkey'
  ) then
    alter table public.ai_systems
      add constraint ai_systems_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id);
  end if;
end;
$migracion$;

-- 2) Comprobación positiva: la FK quedó como se espera.
do $verificacion$
declare
  v_fk_def text;
begin
  select pg_get_constraintdef(oid) into v_fk_def
    from pg_constraint
   where conrelid = 'public.ai_systems'::regclass
     and conname = 'ai_systems_tenant_id_fkey';

  if v_fk_def is distinct from 'FOREIGN KEY (tenant_id) REFERENCES tenants(id)' then
    raise exception 'PROBE: FK no quedó como se esperaba: %', v_fk_def;
  end if;

  raise notice 'PROBE OK: ai_systems_tenant_id_fkey presente y correcta';
end;
$verificacion$;

-- 3) Sonda negativa: un grupo inexistente se rechaza. Se usa un savepoint
--    para poder seguir en la misma transacción tras el fallo esperado.
savepoint sp_grupo_inexistente;

do $sonda_negativa$
begin
  insert into public.ai_systems (tenant_id, name)
  values ('00000000-0000-0000-0000-00000000dead', 'PROBE-MOI-185-grupo-inexistente');

  -- Si llega aquí, el INSERT no fue rechazado: la sonda falla.
  raise exception 'PROBE: el INSERT con tenant_id inexistente debería haber fallado y no falló';
exception
  when foreign_key_violation then
    raise notice 'PROBE OK: INSERT con tenant_id inexistente rechazado por FK (foreign_key_violation)';
end;
$sonda_negativa$;

rollback to savepoint sp_grupo_inexistente;

-- 4) Control positivo del dato: ARGA sigue con sus 8 sistemas (esta migración
--    no toca status ni borra filas; sólo añade la FK).
do $control_dato$
declare
  v_total int;
  v_arga int;
begin
  select count(*) into v_total from public.ai_systems;
  if v_total <> 14 then
    raise exception 'PROBE: se esperaban 14 filas en ai_systems, hay %', v_total;
  end if;

  select count(*) into v_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001';
  if v_arga <> 8 then
    raise exception 'PROBE: ARGA tenía 8 sistemas, ahora tiene %', v_arga;
  end if;

  raise notice 'PROBE OK: 14 filas totales, ARGA conserva sus 8 sistemas';
end;
$control_dato$;

-- 5) Deshace todo: la migración, el INSERT rechazado (ya deshecho por el
--    savepoint) y cualquier otro efecto de este ensayo.
rollback;
