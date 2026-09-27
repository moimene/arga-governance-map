-- 20260928101000_grc_action_plans_origen.sql
--
-- F5.T7 (MOI-175, carril D1) — acciones con origen, no solo con hallazgo.
--
-- POR QUÉ
-- -------
-- D-04 (MOI-162, decidida por delegación 2026-09-26, opción a): un plan de
-- acción puede nacer de una OBLIGACIÓN (p. ej. OBL-RIA-ORG-04/05 sin medidas
-- adoptadas) o de un SISTEMA de IA, sin que haga falta fabricar un hallazgo
-- que no existe solo para que `action_plans.finding_id` (hoy NOT NULL) tenga
-- algo a lo que agarrarse. La opción descartada (b, hallazgo automático por
-- toda brecha) habría inventado hechos que no constan.
--
-- El CONTENIDO de un plan nacido de una obligación o de un sistema lo valida
-- el Comité de Gobernanza de la IA (Garrigues) y el CATIT (ARGA) al ejecutar
-- el resto de F5 — esta migración solo abre el CAMINO, no crea ningún plan.
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * `finding_id` pasa a anulable.
--   * `obligation_id` y `ai_system_id`, nuevas, anulables, con FK.
--   * CHECK: al menos uno de los tres no es NULL — un plan sin origen alguno
--     sigue sin poder existir.
--   * `tenant_id` pasa a NOT NULL (medido: 0 filas con tenant_id NULL hoy).
--   * Guardia de tenant sobre los tres orígenes, mismo patrón que
--     `fn_risks_ai_system_tenant_guard` (20260926116400).
--   * NO crea ningún plan de acción nuevo. Los 8 de ARGA y los del grupo
--     nuevo no cambian: siguen con `finding_id` y sin `obligation_id`/
--     `ai_system_id` (verificado abajo, antes y después, contra el recuento
--     real de cada tenant, no contra una cifra fija en este comentario).
--   * NO toca `fn_grc_crear_acciones_desde_aims` ni el origen BRECHA_AIMS
--     (DS-32): eso es F5.T8, que depende de F4 y queda fuera de esta tarea.
--   * `TRUNCATE`/`TRIGGER`/`REFERENCES` de `anon`/`authenticated` sobre
--     `action_plans` ya están revocados desde MOI-205 (20260924180000, sobre
--     TODAS las tablas de public): no hay nada que revocar de nuevo aquí.

-- ---------------------------------------------------------------------------
-- 1. Esquema.
-- ---------------------------------------------------------------------------
alter table public.action_plans alter column finding_id drop not null;

alter table public.action_plans
  add column if not exists obligation_id uuid references public.obligations(id),
  add column if not exists ai_system_id uuid references public.ai_systems(id);

comment on column public.action_plans.finding_id is
  'Hallazgo del que nace el plan. Anulable desde F5.T7 (MOI-175): un plan '
  'puede nacer de obligation_id o ai_system_id en su lugar. CHECK '
  'action_plans_origen_check exige al menos uno de los tres.';
comment on column public.action_plans.obligation_id is
  'F5.T7 (MOI-175, D-04). Obligación (obligations.id) de la que nace el plan '
  'cuando no hay hallazgo — p. ej. OBL-RIA-ORG-04 sin medidas de formación '
  'adoptadas. Contenido validado por el Comité de IA / CATIT, no por esta '
  'migración.';
comment on column public.action_plans.ai_system_id is
  'F5.T7 (MOI-175, D-04). Sistema de IA (ai_systems.id) del que nace el plan '
  'cuando no hay hallazgo ni obligación concreta.';

-- PostgreSQL no soporta ADD CONSTRAINT IF NOT EXISTS: guardar con el mismo
-- patrón que ya usa la verificación de abajo para comprobar pg_constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.action_plans'::regclass and conname = 'action_plans_origen_check'
  ) then
    alter table public.action_plans
      add constraint action_plans_origen_check
      check (finding_id is not null or obligation_id is not null or ai_system_id is not null);
  end if;
end;
$$;

-- 0 filas con tenant_id NULL medido en Cloud el 2026-09-27 (sin DEFAULT desde
-- 20260906072910): a NOT NULL sin riesgo de bloquear el ALTER.
alter table public.action_plans alter column tenant_id set not null;

create index if not exists idx_action_plans_obligation_id
  on public.action_plans (obligation_id) where obligation_id is not null;
create index if not exists idx_action_plans_ai_system_id
  on public.action_plans (ai_system_id) where ai_system_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Guardia de tenant sobre los tres orígenes.
-- ---------------------------------------------------------------------------
create or replace function public.fn_action_plans_origen_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid;
begin
  if new.finding_id is not null then
    select tenant_id into v_tenant from public.findings where id = new.finding_id;
    if v_tenant is null then
      raise exception 'action_plans.finding_id: hallazgo % no encontrado', new.finding_id using errcode = '23503';
    end if;
    if v_tenant <> new.tenant_id then
      raise exception 'action_plans.finding_id: hallazgo % pertenece a otro tenant', new.finding_id using errcode = '42501';
    end if;
  end if;

  if new.obligation_id is not null then
    select tenant_id into v_tenant from public.obligations where id = new.obligation_id;
    if v_tenant is null then
      raise exception 'action_plans.obligation_id: obligación % no encontrada', new.obligation_id using errcode = '23503';
    end if;
    if v_tenant <> new.tenant_id then
      raise exception 'action_plans.obligation_id: obligación % pertenece a otro tenant', new.obligation_id using errcode = '42501';
    end if;
  end if;

  if new.ai_system_id is not null then
    select tenant_id into v_tenant from public.ai_systems where id = new.ai_system_id;
    if v_tenant is null then
      raise exception 'action_plans.ai_system_id: sistema % no encontrado', new.ai_system_id using errcode = '23503';
    end if;
    if v_tenant <> new.tenant_id then
      raise exception 'action_plans.ai_system_id: sistema % pertenece a otro tenant', new.ai_system_id using errcode = '42501';
    end if;
  end if;

  return new;
end;
$fn$;

revoke execute on function public.fn_action_plans_origen_tenant_guard() from anon, authenticated;

drop trigger if exists trg_action_plans_origen_tenant_guard on public.action_plans;
create trigger trg_action_plans_origen_tenant_guard
  before insert or update of tenant_id, finding_id, obligation_id, ai_system_id on public.action_plans
  for each row execute function public.fn_action_plans_origen_tenant_guard();

-- ---------------------------------------------------------------------------
-- 3. Verificación que ABORTA, con controles positivo y negativo en
--    subtransacciones que se deshacen.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_nuevo uuid := '00000000-0000-0000-0000-000000000003';
  v_arga_antes int;
  v_arga_despues int;
  v_nuevo_antes int;
  v_nuevo_despues int;
  v_finding_not_null boolean;
  v_check_existe boolean;
  v_tenant_not_null boolean;
  v_obl_arga uuid;
  v_ai_system uuid;
  v_id_check uuid;
  v_rechazo_check boolean := false;
  v_insert_no_bloqueado boolean := false;
  v_probe_id uuid := '00000000-0000-0000-0000-0000a00e0175';
  v_rechazo_tenant boolean := false;
begin
  -- 3.1 finding_id anulable.
  select (is_nullable = 'NO') into v_finding_not_null
    from information_schema.columns
   where table_schema = 'public' and table_name = 'action_plans' and column_name = 'finding_id';
  if v_finding_not_null then
    raise exception 'V1: action_plans.finding_id sigue NOT NULL';
  end if;

  -- 3.2 CHECK de origen existe.
  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.action_plans'::regclass and conname = 'action_plans_origen_check'
  ) into v_check_existe;
  if not v_check_existe then
    raise exception 'V2: falta action_plans_origen_check';
  end if;

  -- 3.3 tenant_id NOT NULL.
  select (is_nullable = 'NO') into v_tenant_not_null
    from information_schema.columns
   where table_schema = 'public' and table_name = 'action_plans' and column_name = 'tenant_id';
  if not v_tenant_not_null then
    raise exception 'V3: action_plans.tenant_id sigue NULLABLE';
  end if;

  -- 3.4 ARGA y el grupo nuevo no cambian de recuento (esta migración no
  --     fabrica ningún plan).
  select count(*) into v_arga_antes from public.action_plans where tenant_id = v_arga;
  select count(*) into v_nuevo_antes from public.action_plans where tenant_id = v_nuevo;
  if v_arga_antes <> 8 then
    raise exception 'V4: ARGA tenía 8 planes medidos el 2026-09-27 y ahora tiene %; declarar el cambio antes de continuar', v_arga_antes;
  end if;

  -- 3.5 Control positivo: un plan SOLO con obligation_id (sin hallazgo) se
  --     acepta. Subtransacción deshecha: ni fila ni auditoría sobreviven.
  select id into v_obl_arga from public.obligations where tenant_id = v_arga and code = 'OBL-RIA-ORG-04';
  if v_obl_arga is null then
    raise exception 'V5: ARGA no tiene OBL-RIA-ORG-04 para la sonda';
  end if;

  begin
    insert into public.action_plans (id, tenant_id, obligation_id, title, status)
    values (v_probe_id, v_arga, v_obl_arga, 'Sonda temporal MOI-175 (sin hallazgo)', 'Pendiente');
    raise exception using errcode = 'P0175', message = 'deshacer sonda MOI-175 T7 (origen obligación)';
  exception
    when sqlstate 'P0175' then
      null;
  end;
  if exists (select 1 from public.action_plans where id = v_probe_id) then
    raise exception 'V6: quedó residuo del plan de sonda (origen obligación)';
  end if;

  -- 3.6 Control negativo: un plan SIN ningún origen se rechaza por el CHECK.
  begin
    insert into public.action_plans (id, tenant_id, title, status)
    values (v_probe_id, v_arga, 'Sonda temporal MOI-175 (sin origen)', 'Pendiente');
    v_insert_no_bloqueado := true;
  exception
    when check_violation then
      v_rechazo_check := true;
  end;
  if v_insert_no_bloqueado then
    delete from public.action_plans where id = v_probe_id;
    raise exception 'V7: un plan sin finding_id/obligation_id/ai_system_id NO fue rechazado por el CHECK';
  end if;
  if not v_rechazo_check then
    raise exception 'V8: el CHECK de origen no se disparó como se esperaba';
  end if;

  -- 3.7 Control negativo de tenant: un plan de ARGA con obligation_id de
  --     Garrigues debe rechazarse por el guardia.
  select id into v_id_check from public.obligations where tenant_id = v_garr and code = 'OBL-RIA-ORG-04';
  if v_id_check is null then
    raise exception 'V9: Garrigues no tiene OBL-RIA-ORG-04 para la sonda cross-tenant';
  end if;

  begin
    insert into public.action_plans (id, tenant_id, obligation_id, title, status)
    values (v_probe_id, v_arga, v_id_check, 'Sonda temporal MOI-175 (cross-tenant)', 'Pendiente');
  exception
    when others then
      if sqlerrm like 'action_plans.obligation_id:%pertenece a otro tenant%' then
        v_rechazo_tenant := true;
      else
        raise;
      end if;
  end;
  if exists (select 1 from public.action_plans where id = v_probe_id) then
    delete from public.action_plans where id = v_probe_id;
    raise exception 'V10: un plan de ARGA con obligation_id de Garrigues NO fue rechazado';
  end if;
  if not v_rechazo_tenant then
    raise exception 'V11: el guardia de tenant de action_plans no se disparó como se esperaba';
  end if;

  -- 3.8 ARGA y el grupo nuevo siguen exactamente igual tras todas las sondas.
  select count(*) into v_arga_despues from public.action_plans where tenant_id = v_arga;
  select count(*) into v_nuevo_despues from public.action_plans where tenant_id = v_nuevo;
  if v_arga_despues <> v_arga_antes then
    raise exception 'V12: ARGA cambió de % a % planes de acción', v_arga_antes, v_arga_despues;
  end if;
  if v_nuevo_despues <> v_nuevo_antes then
    raise exception 'V13: el grupo nuevo cambió de % a % planes de acción', v_nuevo_antes, v_nuevo_despues;
  end if;

  raise notice 'F5.T7 OK: finding_id anulable, CHECK de origen y guardia de tenant probados; ARGA (%) y grupo nuevo (%) sin cambio', v_arga_despues, v_nuevo_despues;
end;
$verificacion$;
