-- 20260928100000_grc_formacion_registros.sql
--
-- F5.T6 (MOI-175, carril D1) — registro de formación del art. 4 RIA.
--
-- POR QUÉ
-- -------
-- El art. 4 (alfabetización en materia de IA, obligación de MEDIOS —validado
-- por Harvey, C14) se dio de alta como `OBL-RIA-ORG-04` en los dos tenants el
-- 2026-09-20 (`20260920140000`) DELIBERADAMENTE sin control: `controls.status`
-- solo admite Efectivo/Parcial/Inefectivo y ninguno de los dos tenants tenía
-- entonces una sola medida adoptada que acreditar. Crear un control ese día
-- habría afirmado una efectividad que nadie había medido.
--
-- D-05 (MOI-174, decidida por delegación 2026-09-26): esperar a este registro
-- en vez de añadir un cuarto valor "Sin probar" al CHECK. Esta migración es
-- ese registro: `grc_training_records` guarda, por persona y por sistema, qué
-- medida de formación se adoptó y con qué versión de contenido — el control
-- se evalúa por MEDIDAS ADOPTADAS, nunca por un nivel de conocimiento medido
-- (Harvey C14: no hay forma de acreditar "nivel" sin inventar un examen).
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * Crea la tabla y la RPC de alta (`fn_grc_registrar_formacion`).
--   * NO crea ningún control ni ninguna fila de formación: el contenido de
--     qué cuenta como medida adoptada para el art. 4 lo decide el CATIT (ARGA)
--     y el Comité de Gobernanza de la IA (Garrigues) — eso es F5.T5 y trabajo
--     de comité, no de esta migración. Las dos tablas nacen con 0 filas.
--   * El criterio de "sin registros, sin efectividad" vive en TypeScript
--     (`src/lib/grc/formacion-control.ts`) y aquí se refuerza con un trigger
--     de guardia sobre `controls`: un control de OBL-RIA-ORG-04 no puede
--     declararse Efectivo/Parcial sin al menos un registro de formación real
--     que lo respalde. No es redundante con el TS: el TS protege la pantalla,
--     el trigger protege un INSERT/UPDATE hecho por cualquier otro camino.

-- ---------------------------------------------------------------------------
-- 1. Tabla.
-- ---------------------------------------------------------------------------
create table if not exists public.grc_training_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  obligation_id uuid not null references public.obligations(id),
  ai_system_id uuid not null references public.ai_systems(id),
  person_id uuid not null references public.persons(id),
  content_version text not null,
  completed_at date not null default current_date,
  recorded_by_id uuid references public.persons(id),
  created_at timestamptz not null default now()
);

comment on table public.grc_training_records is
  'F5.T6 (MOI-175). Medida de formación adoptada por una persona sobre un '
  'sistema de IA, con la versión de contenido impartida. El control del art. 4 '
  '(OBL-RIA-ORG-04) se evalúa por la EXISTENCIA de estas filas, nunca por un '
  'nivel o porcentaje: no hay columna de nota ni de nivel, a propósito.';
comment on column public.grc_training_records.recorded_by_id is
  'Persona (persons.id) que registró la medida, resuelta por el servidor desde '
  'user_profiles.person_id de la sesión en fn_grc_registrar_formacion. NULL si '
  'la fila se sembró fuera de esa RPC (no ocurre en esta migración: nace vacía).';

create index if not exists idx_grc_training_records_tenant on public.grc_training_records (tenant_id);
create index if not exists idx_grc_training_records_obligation on public.grc_training_records (obligation_id);

alter table public.grc_training_records enable row level security;

-- Solo SELECT por tenant. Sin política de escritura: RLS deniega INSERT/UPDATE/
-- DELETE a authenticated/anon aunque tuvieran grant (no lo tienen, ver abajo).
-- Los altas van solo por fn_grc_registrar_formacion (SECURITY DEFINER).
create policy grc_training_records_select_tenant on public.grc_training_records
  for select
  using (tenant_id = public.fn_current_tenant_id());

-- El esquema `public` concede INSERT/UPDATE/DELETE/SELECT a anon y
-- authenticated por defecto (ALTER DEFAULT PRIVILEGES de `postgres`,
-- verificado en Cloud el 2026-09-27) para toda tabla nueva. TRUNCATE/TRIGGER/
-- REFERENCES ya quedan fuera desde MOI-205 (20260924180000). Revocar el resto
-- explícitamente: un grant es aditivo y no basta con no pedirlo.
revoke insert, update, delete on public.grc_training_records from anon, authenticated;
revoke all on public.grc_training_records from anon;

-- ---------------------------------------------------------------------------
-- 2. Guardia de tenant: obligation_id y ai_system_id del mismo tenant que la fila.
-- ---------------------------------------------------------------------------
create or replace function public.fn_grc_training_record_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_obligation_tenant uuid;
  v_system_tenant uuid;
begin
  select tenant_id into v_obligation_tenant from public.obligations where id = new.obligation_id;
  if v_obligation_tenant is null then
    raise exception 'grc_training_records.obligation_id: obligación % no encontrada', new.obligation_id
      using errcode = '23503';
  end if;
  if v_obligation_tenant <> new.tenant_id then
    raise exception 'grc_training_records.obligation_id: obligación % pertenece a otro tenant', new.obligation_id
      using errcode = '42501';
  end if;

  select tenant_id into v_system_tenant from public.ai_systems where id = new.ai_system_id;
  if v_system_tenant is null then
    raise exception 'grc_training_records.ai_system_id: sistema % no encontrado', new.ai_system_id
      using errcode = '23503';
  end if;
  if v_system_tenant <> new.tenant_id then
    raise exception 'grc_training_records.ai_system_id: sistema % pertenece a otro tenant', new.ai_system_id
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke execute on function public.fn_grc_training_record_tenant_guard() from anon, authenticated;

drop trigger if exists trg_grc_training_record_tenant_guard on public.grc_training_records;
create trigger trg_grc_training_record_tenant_guard
  before insert or update of tenant_id, obligation_id, ai_system_id on public.grc_training_records
  for each row execute function public.fn_grc_training_record_tenant_guard();

-- ---------------------------------------------------------------------------
-- 3. Alta por RPC. Resuelve tenant y autor de servidor; el cliente no los envía.
-- ---------------------------------------------------------------------------
create or replace function public.fn_grc_registrar_formacion(
  p_obligation_id uuid,
  p_ai_system_id uuid,
  p_person_id uuid,
  p_content_version text,
  p_completed_at date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid;
  v_recorded_by uuid;
  v_id uuid;
begin
  v_tenant := public.fn_current_tenant_id();
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  if p_content_version is null or btrim(p_content_version) = '' then
    raise exception 'CONTENIDO_SIN_VERSION: content_version es obligatorio' using errcode = '22023';
  end if;

  if auth.uid() is not null then
    select up.person_id into v_recorded_by
      from public.user_profiles up
     where up.user_id = auth.uid() and up.tenant_id = v_tenant;
    if v_recorded_by is null then
      raise exception 'PERFIL_SIN_PERSONA: la cuenta de la sesión no está enlazada a una persona de su entorno'
        using errcode = '42501';
    end if;
  end if;

  insert into public.grc_training_records
    (tenant_id, obligation_id, ai_system_id, person_id, content_version, completed_at, recorded_by_id)
  values
    (v_tenant, p_obligation_id, p_ai_system_id, p_person_id, p_content_version, coalesce(p_completed_at, current_date), v_recorded_by)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke execute on function public.fn_grc_registrar_formacion(uuid, uuid, uuid, text, date) from anon;
grant execute on function public.fn_grc_registrar_formacion(uuid, uuid, uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guardia sobre `controls`: un control de OBL-RIA-ORG-04 no se declara
--    Efectivo/Parcial sin al menos un registro de formación real que lo
--    respalde. Por código, no por columna de marca: OBL-RIA-ORG-04 es la
--    única obligación de organización que este programa evalúa por medidas
--    de formación hasta hoy; generalizar a una columna en `obligations`
--    (p. ej. `requiere_evidencia_formacion`) es trabajo futuro si aparece una
--    segunda (ver F5.T5, OBL-RIA-ORG-05, que NO se evalúa así).
-- ---------------------------------------------------------------------------
create or replace function public.fn_controls_formacion_evidencia_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code text;
  v_evidencia int;
begin
  if new.status not in ('Efectivo', 'Parcial') or new.obligation_id is null then
    return new;
  end if;

  select code into v_code from public.obligations where id = new.obligation_id;
  if v_code is distinct from 'OBL-RIA-ORG-04' then
    return new;
  end if;

  select count(*) into v_evidencia
    from public.grc_training_records
   where obligation_id = new.obligation_id;

  if v_evidencia = 0 then
    raise exception 'FORMACION_SIN_EVIDENCIA: el control % de OBL-RIA-ORG-04 no puede declararse % sin ningún registro de formación', new.code, new.status
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke execute on function public.fn_controls_formacion_evidencia_guard() from anon, authenticated;

drop trigger if exists trg_controls_formacion_evidencia_guard on public.controls;
create trigger trg_controls_formacion_evidencia_guard
  before insert or update of status, obligation_id on public.controls
  for each row execute function public.fn_controls_formacion_evidencia_guard();

-- ---------------------------------------------------------------------------
-- 5. Verificación que ABORTA, con control positivo y negativo del propio
--    instrumento en subtransacciones que se deshacen (sin residuo en tabla ni
--    en audit_log).
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_tabla_existe boolean;
  v_filas int;
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_obl_arga uuid;
  v_obl_garr uuid;
  v_ai_system uuid;
  v_control_id uuid := '00000000-0000-0000-0000-0000c00e0175';
  v_record_id uuid;
  v_rechazo_disparado boolean := false;
  v_insert_no_bloqueado boolean := false;
begin
  -- 5.1 La tabla existe, vacía (nadie fabricó dato).
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'grc_training_records'
  ) into v_tabla_existe;
  if not v_tabla_existe then
    raise exception 'V1: grc_training_records no existe';
  end if;

  select count(*) into v_filas from public.grc_training_records;
  if v_filas <> 0 then
    raise exception 'V2: grc_training_records tiene % filas y debía nacer vacía', v_filas;
  end if;

  -- 5.2 Ningún privilegio de escritura residual para anon/authenticated.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'grc_training_records'
       and grantee in ('anon', 'authenticated')
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES')
  ) then
    raise exception 'V3: grc_training_records concede privilegios de escritura a anon/authenticated';
  end if;

  -- 5.3 Control positivo del guardia de `controls`: un control de
  -- OBL-RIA-ORG-04 marcado Efectivo SIN registro de formación debe rechazarse.
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';
  select id into v_obl_garr from public.obligations where tenant_id = v_garr and code = 'OBL-RIA-ORG-04';
  if v_obl_arga is null or v_obl_garr is null then
    raise exception 'V4: OBL-RIA-ORG-04 no existe en alguno de los dos tenants (arga=%, garrigues=%)', v_obl_arga, v_obl_garr;
  end if;

  begin
    insert into public.controls (id, tenant_id, code, name, status, obligation_id)
    values (v_control_id, v_arga, '__PROBE_MOI175_T6__', 'Sonda temporal MOI-175', 'Efectivo', v_obl_arga);
    v_insert_no_bloqueado := true;
  exception
    when others then
      if sqlerrm like 'FORMACION_SIN_EVIDENCIA:%' then
        v_rechazo_disparado := true;
      else
        raise;
      end if;
  end;

  if v_insert_no_bloqueado then
    delete from public.controls where id = v_control_id;
    raise exception 'V5: el guardia FORMACION_SIN_EVIDENCIA no bloqueó un control sin registros';
  end if;
  if not v_rechazo_disparado then
    raise exception 'V6: el guardia FORMACION_SIN_EVIDENCIA no se disparó como se esperaba';
  end if;

  -- 5.4 Control positivo simétrico: con un registro de formación real, SÍ se
  -- acepta. Alta por RPC (camino real de la aplicación), todo dentro de una
  -- subtransacción que se deshace.
  select id into v_ai_system from public.ai_systems where tenant_id = v_arga limit 1;
  if v_ai_system is null then
    raise exception 'V7: ARGA no tiene ningún sistema de IA para la sonda';
  end if;

  -- fn_grc_registrar_formacion resuelve tenant y autor vía auth.uid()/auth.jwt();
  -- ejecutar el DO block como postgres no los rellena. Se simula la sesión del
  -- SECRETARIO real de ARGA (85e24c66-...) para que fn_current_tenant_id()
  -- caiga por el Path C (user_profiles) igual que en producción.
  perform set_config('request.jwt.claims', '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f"}', true);

  begin
    select public.fn_grc_registrar_formacion(
      v_obl_arga, v_ai_system,
      (select p.id from public.persons p
         join public.condiciones_persona cp on cp.person_id = p.id
        where cp.body_id = '08a4156b-a814-4dc6-b953-fafac1b5b840' and cp.estado = 'VIGENTE'
        limit 1),
      'v1-sonda-migracion', current_date
    ) into v_record_id;

    insert into public.controls (id, tenant_id, code, name, status, obligation_id)
    values (v_control_id, v_arga, '__PROBE_MOI175_T6__', 'Sonda temporal MOI-175', 'Efectivo', v_obl_arga);

    raise exception using errcode = 'P0175', message = 'deshacer sonda MOI-175 T6';
  exception
    when sqlstate 'P0175' then
      null; -- subtransacción deshecha: ni control, ni registro de formación, ni auditoría.
  end;

  if exists (select 1 from public.controls where id = v_control_id) then
    raise exception 'V8: quedó residuo del control de sonda';
  end if;
  if exists (select 1 from public.grc_training_records where content_version = 'v1-sonda-migracion') then
    raise exception 'V9: quedó residuo del registro de formación de sonda';
  end if;

  raise notice 'F5.T6 OK: grc_training_records creada vacía, guardia de evidencia probado en los dos sentidos, sin residuo';
end;
$verificacion$;
