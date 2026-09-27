-- Ensayo revertido de supabase/migrations/20260927105600_aims_secretaria_derivaciones.sql
-- (MOI-56). NO ejecutar fuera de una revisión deliberada: aplica la migración,
-- prueba control positivo (crear + consultar dentro del mismo grupo),
-- idempotencia, y control negativo (otro grupo no ve ni puede crear), y
-- deshace todo al final. Ids reales de ARGA y Garrigues leídos por SELECT
-- antes de escribir esta sonda (2026-09-27), solo para tener una FK válida
-- que referenciar -- no se modifican.

begin;

-- 0) Aplica la migración (cuerpo idéntico al fichero real
--    20260927105600_aims_secretaria_derivaciones.sql -- inlineado en vez de
--    `\i`/`\ir` porque este ensayo puede ejecutarse con `psql -f` desde un
--    directorio de trabajo distinto al de este fichero).

create table if not exists public.aims_secretaria_derivations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  source_incident_id    uuid not null references public.ai_incidents(id) on delete restrict,
  source_event          text not null,
  target_meeting_id     uuid references public.meetings(id) on delete restrict,
  target_agreement_id   uuid references public.agreements(id) on delete restrict,
  status                text not null default 'LINKED'
                        check (status in ('LINKED', 'SUPERSEDED')),
  evidence_ref          text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  constraint aims_secretaria_derivations_one_target check (
    (target_meeting_id is not null and target_agreement_id is null)
    or (target_meeting_id is null and target_agreement_id is not null)
  )
);

create unique index if not exists ux_aims_secretaria_derivations_incident_meeting
  on public.aims_secretaria_derivations (source_incident_id, target_meeting_id)
  where target_meeting_id is not null;
create unique index if not exists ux_aims_secretaria_derivations_incident_agreement
  on public.aims_secretaria_derivations (source_incident_id, target_agreement_id)
  where target_agreement_id is not null;
create index if not exists ix_aims_secretaria_derivations_tenant_incident
  on public.aims_secretaria_derivations (tenant_id, source_incident_id);

alter table public.aims_secretaria_derivations enable row level security;

drop policy if exists aims_secretaria_derivations_tenant_select on public.aims_secretaria_derivations;
create policy aims_secretaria_derivations_tenant_select
  on public.aims_secretaria_derivations for select to authenticated
  using (tenant_id = public.fn_current_tenant_id());

drop policy if exists aims_secretaria_derivations_tenant_insert on public.aims_secretaria_derivations;
create policy aims_secretaria_derivations_tenant_insert
  on public.aims_secretaria_derivations for insert to authenticated
  with check (
    tenant_id = public.fn_current_tenant_id()
    and exists (
      select 1 from public.ai_incidents i
       where i.id = source_incident_id and i.tenant_id = public.fn_current_tenant_id()
    )
    and (
      (target_meeting_id is not null and exists (
        select 1 from public.meetings m
         where m.id = target_meeting_id and m.tenant_id = public.fn_current_tenant_id()
      ))
      or
      (target_agreement_id is not null and exists (
        select 1 from public.agreements a
         where a.id = target_agreement_id and a.tenant_id = public.fn_current_tenant_id()
      ))
    )
  );

revoke all on table public.aims_secretaria_derivations from public, anon;
grant select, insert on table public.aims_secretaria_derivations to authenticated;
revoke delete, update, truncate, references, trigger on table public.aims_secretaria_derivations from authenticated;

-- ---------------------------------------------------------------------------
-- 1) Control positivo: como sesión ARGA, se crea la derivación y se lee de
--    vuelta. fn_current_tenant_id() lee el claim raíz `tenant_id` antes que
--    user_profiles, así que no hace falta una fila real de usuario para fijar
--    la sesión en la prueba.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);

do $control_positivo$
declare
  v_id uuid;
  v_leida record;
begin
  insert into public.aims_secretaria_derivations (source_incident_id, tenant_id, source_event, target_meeting_id)
  values ('03fe408a-f70b-4829-9a0b-de5fbe709df8', '00000000-0000-0000-0000-000000000001', 'AIMS_INCIDENT_MATERIAL', 'c3305c16-57c1-4ece-884b-6b6644f2d20e')
  returning id into v_id;

  select * into v_leida from public.aims_secretaria_derivations where id = v_id;
  if v_leida.id is null then
    raise exception 'PROBE MOI-56: la fila recién creada no se puede leer dentro del mismo grupo';
  end if;
  if v_leida.status <> 'LINKED' then
    raise exception 'PROBE MOI-56: status por defecto esperado LINKED, encontrado %', v_leida.status;
  end if;
  raise notice 'PROBE OK: derivación % creada y leída dentro de ARGA', v_id;
end;
$control_positivo$;

-- ---------------------------------------------------------------------------
-- 2) Idempotencia: reintentar el MISMO par (incidente, reunión) no duplica --
--    el índice único parcial rechaza con 23505. Savepoint para seguir tras el
--    fallo esperado.
-- ---------------------------------------------------------------------------
savepoint sp_idempotencia;
do $idempotencia$
begin
  insert into public.aims_secretaria_derivations (source_incident_id, tenant_id, source_event, target_meeting_id)
  values ('03fe408a-f70b-4829-9a0b-de5fbe709df8', '00000000-0000-0000-0000-000000000001', 'AIMS_INCIDENT_MATERIAL', 'c3305c16-57c1-4ece-884b-6b6644f2d20e');
  raise exception 'PROBE MOI-56: el segundo INSERT del mismo par debería haber sido rechazado por el índice único y no lo fue';
exception
  when unique_violation then
    raise notice 'PROBE OK: segundo INSERT del mismo par rechazado por índice único (23505) -- idempotencia confirmada';
end;
$idempotencia$;
rollback to savepoint sp_idempotencia;

-- ---------------------------------------------------------------------------
-- 3) Control negativo (lectura): como sesión Garrigues, la fila de ARGA
--    creada en el paso 1 NO aparece -- ni error, ni dato ajeno.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);

do $control_negativo_lectura$
declare
  v_visible int;
begin
  select count(*) into v_visible
    from public.aims_secretaria_derivations
   where source_incident_id = '03fe408a-f70b-4829-9a0b-de5fbe709df8';
  if v_visible <> 0 then
    raise exception 'PROBE MOI-56: la sesión Garrigues ve % fila(s) de la derivación de ARGA', v_visible;
  end if;
  raise notice 'PROBE OK: la sesión Garrigues no ve la derivación de ARGA (RLS por SELECT confirmada)';
end;
$control_negativo_lectura$;

-- ---------------------------------------------------------------------------
-- 4) Control negativo (escritura): como sesión Garrigues, intentar enlazar el
--    incidente de ARGA con una reunión de Garrigues es rechazado -- el WITH
--    CHECK exige que el ORIGEN pertenezca también al tenant de la sesión, no
--    solo el destino.
-- ---------------------------------------------------------------------------
savepoint sp_negativo_escritura;
do $control_negativo_escritura$
begin
  insert into public.aims_secretaria_derivations (source_incident_id, tenant_id, source_event, target_meeting_id)
  values ('03fe408a-f70b-4829-9a0b-de5fbe709df8', '00000000-0000-0000-0000-000000000002', 'AIMS_INCIDENT_MATERIAL', 'e0beed92-60f0-49e7-81c3-0ae5a54c9d56');
  raise exception 'PROBE MOI-56: el INSERT cruzado (origen de ARGA, sesión Garrigues) debería haber sido rechazado y no lo fue';
exception
  when insufficient_privilege then
    raise notice 'PROBE OK: INSERT cruzado rechazado por RLS (insufficient_privilege / 42501)';
end;
$control_negativo_escritura$;
rollback to savepoint sp_negativo_escritura;

-- ---------------------------------------------------------------------------
-- 5) Consecuencia del CHECK "un solo destino": ambos target a la vez, o
--    ninguno, se rechaza incluso con tenant y origen correctos.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
savepoint sp_check_destino;
do $control_check_destino$
begin
  insert into public.aims_secretaria_derivations (source_incident_id, tenant_id, source_event)
  values ('03fe408a-f70b-4829-9a0b-de5fbe709df8', '00000000-0000-0000-0000-000000000001', 'AIMS_INCIDENT_MATERIAL');
  raise exception 'PROBE MOI-56: un INSERT sin ningún destino debería haber sido rechazado por el CHECK y no lo fue';
exception
  when check_violation or insufficient_privilege then
    -- La política RLS de INSERT exige un destino del propio grupo y se evalúa
    -- antes que el CHECK: cualquiera de los dos rechazos vale (orquestador, 27-09).
    raise notice 'PROBE OK: INSERT sin destino rechazado (% )', sqlerrm;
end;
$control_check_destino$;
rollback to savepoint sp_check_destino;

-- Vuelve a rol de propietario para poder consultar catálogo sin RLS al cerrar.
reset role;

-- SELECT final de comprobación (además del bloque de verificación ya incluido
-- en la propia migración, que aborta la transacción entera si algo no cuadra
-- antes de llegar aquí).
select
  (select count(*) from public.aims_secretaria_derivations) as filas_totales_antes_de_deshacer,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'aims_secretaria_derivations') as politicas;

rollback;
