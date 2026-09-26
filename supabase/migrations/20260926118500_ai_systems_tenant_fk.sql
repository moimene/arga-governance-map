-- MOI-185 · Decisión D-06 (por delegación, opción a del issue): exigir solo
-- que el grupo (tenant) de un sistema de IA exista. Sin CHECK sobre `status`
-- —eso es la opción (b), que cambiaría dato de ARGA y no se decide aquí—.
--
-- MEDIDO en solo lectura el 2026-09-26 contra `ai_systems`: 14 filas
-- (ARGA 8, Garrigues 6), 0 con `tenant_id` NULL, 0 sin `tenants.id`
-- correspondiente. `pg_constraint` confirma que hoy no existe ninguna FK de
-- `ai_systems.tenant_id` hacia `tenants`; las únicas restricciones de la
-- tabla son `ai_systems_pkey`, `ai_systems_owner_id_fkey`,
-- `ai_systems_regulatory_role_check` y la UNIQUE `ai_systems_tenant_id_key`
-- (tenant_id, id). Añadir la FK es aditiva y no toca ninguna fila (DA-13 del
-- ledger, `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md:68`).
--
-- Idempotente: sólo añade la constraint si no existe ya con ese nombre.

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

do $verificacion$
declare
  v_fk_def text;
  v_total int;
  v_owner_fk int;
begin
  -- La FK existe y apunta exactamente a tenants(id) sobre tenant_id.
  select pg_get_constraintdef(oid) into v_fk_def
    from pg_constraint
   where conrelid = 'public.ai_systems'::regclass
     and conname = 'ai_systems_tenant_id_fkey';

  if v_fk_def is null then
    raise exception 'VERIFICACION: no existe ai_systems_tenant_id_fkey tras la migración';
  end if;

  if v_fk_def <> 'FOREIGN KEY (tenant_id) REFERENCES tenants(id)' then
    raise exception 'VERIFICACION: ai_systems_tenant_id_fkey definida como "%", no como se esperaba', v_fk_def;
  end if;

  -- Control positivo: el dato de ARGA/Garrigues no se ha perdido ni cambiado
  -- de tamaño por esta migración (aditiva, sin CHECK, sin normalización).
  select count(*) into v_total from public.ai_systems;
  if v_total <> 14 then
    raise exception 'VERIFICACION: ai_systems tenía 14 filas antes de esta migración, ahora tiene %', v_total;
  end if;

  -- Control positivo del propio instrumento: una constraint que ya existía
  -- antes de esta migración sigue viéndose — si el instrumento de lectura
  -- estuviera roto, este check fallaría también.
  select count(*) into v_owner_fk from pg_constraint
   where conrelid = 'public.ai_systems'::regclass
     and conname = 'ai_systems_owner_id_fkey';
  if v_owner_fk <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve ai_systems_owner_id_fkey, que ya existía y debe seguir estando';
  end if;

  raise notice 'VERIFICACION OK: ai_systems_tenant_id_fkey → tenants(id), 14 filas intactas';
end;
$verificacion$;
