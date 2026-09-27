-- MOI-170 — F2.T3 (M03), programa RIA, carril A.
-- Especificación §2.2 (ai_systems, ai_incidents, ai_risk_assessments,
-- ai_compliance_checks, vistas); enmiendas E-01 (ALTA) y E-08 (MEDIA).
--
-- E-01 — DOMINIO PERSONA, NO USUARIO
-- ----------------------------------
-- `assessor_id` y el `created_by` NUEVO de `ai_risk_assessments` son FK a
-- `persons`, no a `auth.users`. Ninguna de las cuentas de Auth es una fila de
-- `persons` (medido en M01), así que un `DEFAULT auth.uid()` haría fallar por
-- la FK cualquier INSERT que omita la columna — el wizard la omite — y NINGUNA
-- evaluación se podría guardar en ningún tenant desde el primer día. La
-- persona se resuelve del perfil de la sesión
-- (`user_profiles.person_id` del usuario en su tenant) en un trigger BEFORE
-- INSERT, igual que M01 resolvió `checked_by_id`. Sin persona: PERFIL_SIN_PERSONA
-- (42501). Lo que mande el cliente en estas dos columnas se ignora.
--
-- E-08 — `inventory_kind` Y `prohibited_practice_status` SOLO POR RPC
-- --------------------------------------------------------------------
-- `inventory_kind` decide si un sistema cuenta en el cribado; la práctica
-- prohibida decide si sigue midiéndose. Sin guardia, cualquier cliente con
-- UPDATE sobre `ai_systems` saca un sistema real del recuento sin motivo ni
-- sello. El trigger existente `fn_ai_systems_clasificacion_solo_por_cuestionario`
-- (que ya hace justo esto para `regulatory_role`/`risk_level`) se AMPLÍA para
-- cubrir también `prohibited_practice_status`, con el mismo flag
-- `aims.clasificacion_rpc`. `inventory_kind` es un concepto distinto
-- (organizativo, no de riesgo) y se guarda con SU PROPIO flag,
-- `aims.inventario_rpc`. Ninguna RPC de este carril enciende ese flag —
-- `fn_aims_fijar_tipo_inventario` es F2.T16, fuera de este carril (capa de
-- BASE DE DATOS, no seeds) — así que la columna queda deliberadamente
-- bloqueada desde cualquier cliente hasta que esa RPC exista. Es el mismo
-- patrón que ya usaron `aims_system_versions` y `aims_technical_file_sections`
-- antes de tener toda su superficie de RPC: la guardia entra primero, la
-- puerta llega después. Se declara como deuda abierta, no como omisión.
--
-- LEGADO
-- ------
-- 61 comprobaciones y 8 evaluaciones existentes no se tocan. Las columnas
-- nuevas quedan NULL en ellas: no hay forma honesta de rellenarlas con dato
-- retroactivo.

-- ---------------------------------------------------------------------------
-- 1. `ai_systems`.
-- ---------------------------------------------------------------------------
alter table public.ai_systems
  add column if not exists inventory_kind text not null default 'SISTEMA_IA'
    check (inventory_kind in ('SISTEMA_IA', 'CONTRATO_MODELO', 'HOJA_DE_RUTA', 'CANDIDATO')),
  add column if not exists prohibited_practice_status text
    check (prohibited_practice_status is null or prohibited_practice_status in (
      'SIN_ANALIZAR', 'SIN_INDICIOS', 'EN_ANALISIS', 'CONFIRMADA_CESE', 'CESADA'
    )),
  add column if not exists ai_policy_id uuid references public.policies(id),
  add column if not exists provider_third_party_id text;

alter table public.ai_systems
  add constraint ai_systems_provider_third_party_fkey
    foreign key (tenant_id, provider_third_party_id)
    references public.grc_third_parties(tenant_id, id) on delete restrict;

comment on column public.ai_systems.inventory_kind is
  'F2.T3. SISTEMA_IA cuenta en el cribado; CONTRATO_MODELO/HOJA_DE_RUTA/CANDIDATO no. Solo por RPC (flag aims.inventario_rpc) — sin RPC en este carril, bloqueada desde el cliente (deuda declarada, F2.T16).';
comment on column public.ai_systems.prohibited_practice_status is
  'F2.T3/E-08. Solo cambia completando el cuestionario o por fn_aims_cribar_sistema (flag aims.clasificacion_rpc, mismo que regulatory_role/risk_level).';

-- 1.a Amplía el trigger existente: cubre también prohibited_practice_status.
create or replace function public.fn_ai_systems_clasificacion_solo_por_cuestionario()
returns trigger
language plpgsql
as $fn$
declare
  v_rpc boolean := coalesce(current_setting('aims.clasificacion_rpc', true), '') = 'on';
  v_rol_jwt text := coalesce(auth.role(), '');
begin
  if tg_op = 'INSERT' then
    if v_rol_jwt = 'authenticated' and not v_rpc then
      raise exception 'ALTA_SOLO_POR_CUESTIONARIO: un sistema de IA se registra con su clasificación guiada (fn_aims_registrar_sistema)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.regulatory_role is distinct from old.regulatory_role
      or new.risk_level is distinct from old.risk_level
      or new.prohibited_practice_status is distinct from old.prohibited_practice_status)
     and not v_rpc then
    raise exception 'CLASIFICACION_SOLO_POR_CUESTIONARIO: el rol, el nivel de riesgo y la práctica prohibida se cambian por RPC, no directamente'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_ai_systems_clasificacion_solo_por_cuestionario on public.ai_systems;
create trigger trg_ai_systems_clasificacion_solo_por_cuestionario
  before insert or update of regulatory_role, risk_level, prohibited_practice_status on public.ai_systems
  for each row execute function public.fn_ai_systems_clasificacion_solo_por_cuestionario();

-- 1.b `inventory_kind`: guardia propia (E-08), deliberadamente sin RPC aquí.
create or replace function public.fn_ai_systems_inventory_kind_guard()
returns trigger
language plpgsql
as $fn$
declare
  v_rpc boolean := coalesce(current_setting('aims.inventario_rpc', true), '') = 'on';
  v_rol_jwt text := coalesce(auth.role(), '');
begin
  if tg_op = 'UPDATE' and new.inventory_kind is distinct from old.inventory_kind
     and v_rol_jwt = 'authenticated' and not v_rpc then
    raise exception 'INVENTARIO_SOLO_POR_RPC: el tipo de inventario de un sistema se cambia con motivo y sello (fn_aims_fijar_tipo_inventario, pendiente de F2.T16)'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_ai_systems_inventory_kind_guard on public.ai_systems;
create trigger trg_ai_systems_inventory_kind_guard
  before update of inventory_kind on public.ai_systems
  for each row execute function public.fn_ai_systems_inventory_kind_guard();

-- ---------------------------------------------------------------------------
-- 2. `ai_incidents`.
-- ---------------------------------------------------------------------------
alter table public.ai_incidents
  add column if not exists entity_id uuid references public.entities(id) on delete restrict,
  add column if not exists subject_id uuid references public.aims_ria_subjects(id),
  add column if not exists occurred_member_state char(2) check (occurred_member_state is null or occurred_member_state ~ '^[A-Z]{2}$'),
  add column if not exists ria_qualification text not null default 'PENDIENTE'
    check (ria_qualification in ('PENDIENTE', 'NO_ES_GRAVE', 'GRAVE')),
  add column if not exists ria_serious_letters text[] not null default '{}'::text[],
  add column if not exists ria_qualification_motivation text,
  add column if not exists qualified_by uuid,
  add column if not exists qualified_at timestamptz;

comment on column public.ai_incidents.ria_qualification is
  'F2.T3. Solo por RPC (flag aims.calificacion_incidente_rpc, fn_aims_calificar_incidente, F8 — fuera de este carril): hoy la tabla admitía UPDATE directo, y sin guardia un cliente podía marcar NO_ES_GRAVE y detener el reloj del art. 73.';

create or replace function public.fn_ai_incidents_calificacion_guard()
returns trigger
language plpgsql
as $fn$
declare
  v_rpc boolean := coalesce(current_setting('aims.calificacion_incidente_rpc', true), '') = 'on';
  v_rol_jwt text := coalesce(auth.role(), '');
begin
  if tg_op = 'UPDATE'
     and (new.ria_qualification is distinct from old.ria_qualification
          or new.ria_serious_letters is distinct from old.ria_serious_letters
          or new.ria_qualification_motivation is distinct from old.ria_qualification_motivation
          or new.qualified_by is distinct from old.qualified_by
          or new.qualified_at is distinct from old.qualified_at)
     and v_rol_jwt = 'authenticated' and not v_rpc then
    raise exception 'CALIFICACION_SOLO_POR_RPC: la calificación del art. 73 se cambia por RPC (fn_aims_calificar_incidente, pendiente de F8)'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_ai_incidents_calificacion_guard on public.ai_incidents;
create trigger trg_ai_incidents_calificacion_guard
  before update on public.ai_incidents
  for each row execute function public.fn_ai_incidents_calificacion_guard();

-- ---------------------------------------------------------------------------
-- 3. `ai_risk_assessments` (E-01).
-- ---------------------------------------------------------------------------
alter table public.ai_risk_assessments
  add column if not exists subject_id uuid references public.aims_ria_subjects(id),
  add column if not exists catalog_version text,
  add column if not exists created_by uuid references public.persons(id),
  add column if not exists review_decision text
    check (review_decision is null or review_decision in ('ACEPTA', 'REQUIERE_MEDIDAS', 'RECHAZA')),
  add column if not exists review_motivation text;

comment on column public.ai_risk_assessments.created_by is
  'Persona (persons.id) que redactó la evaluación. La resuelve el servidor desde user_profiles.person_id de la sesión (E-01); nunca DEFAULT auth.uid() — es un usuario, no una persona.';
comment on column public.ai_risk_assessments.review_decision is
  'Solo por RPC (flag aims.revision_rpc, fn_aims_review_assessment v2 — F2.T7, carril A5 de este mismo lote).';

-- 3.a Autoría: assessor_id (ya existía) y created_by, resueltos e inmutables.
create or replace function public.fn_aims_evaluacion_autoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_persona uuid;
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null
       and (new.assessor_id is distinct from old.assessor_id
            or new.created_by is distinct from old.created_by) then
      raise exception 'EVALUACION_AUTORIA_INMUTABLE: la autoría de la evaluación % no se cambia', old.id
        using errcode = '42501';
    end if;
    return new;
  end if;

  if auth.uid() is not null then
    select up.person_id into v_persona
      from public.user_profiles up
     where up.user_id = auth.uid()
       and up.tenant_id = public.fn_current_tenant_id();
    if v_persona is null then
      raise exception 'PERFIL_SIN_PERSONA: la cuenta de la sesión no está enlazada a una persona de su entorno; la evaluación no tendría autor'
        using errcode = '42501';
    end if;
    new.assessor_id := v_persona;
    new.created_by := v_persona;
  end if;
  return new;
end;
$fn$;

revoke all on function public.fn_aims_evaluacion_autoria() from public, anon;

drop trigger if exists trg_aims_evaluacion_autoria on public.ai_risk_assessments;
create trigger trg_aims_evaluacion_autoria
  before insert or update on public.ai_risk_assessments
  for each row execute function public.fn_aims_evaluacion_autoria();

-- 3.b review_decision / review_motivation: guardia DS-32.
create or replace function public.fn_aims_evaluacion_revision_guard()
returns trigger
language plpgsql
as $fn$
declare
  v_rpc boolean := coalesce(current_setting('aims.revision_rpc', true), '') = 'on';
  v_rol_jwt text := coalesce(auth.role(), '');
begin
  if v_rol_jwt = 'authenticated' and not v_rpc then
    if tg_op = 'INSERT' and (new.review_decision is not null or new.review_motivation is not null) then
      raise exception 'REVISION_SOLO_POR_RPC: la decisión de revisión se escribe con fn_aims_review_assessment'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and (new.review_decision is distinct from old.review_decision
            or new.review_motivation is distinct from old.review_motivation) then
      raise exception 'REVISION_SOLO_POR_RPC: la decisión de revisión se escribe con fn_aims_review_assessment'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_aims_evaluacion_revision_guard on public.ai_risk_assessments;
create trigger trg_aims_evaluacion_revision_guard
  before insert or update on public.ai_risk_assessments
  for each row execute function public.fn_aims_evaluacion_revision_guard();

-- ---------------------------------------------------------------------------
-- 4. `ai_compliance_checks`.
-- ---------------------------------------------------------------------------
alter table public.ai_compliance_checks
  add column if not exists subject_id uuid references public.aims_ria_subjects(id);

-- ---------------------------------------------------------------------------
-- 5. Vistas de lectura (security_invoker: respetan la RLS del que consulta).
-- ---------------------------------------------------------------------------
create or replace view public.v_aims_sistemas_por_entidad
with (security_invoker = on) as
select
  sub.entity_id,
  sub.id as subject_id,
  sub.system_id,
  ai.tenant_id,
  ai.name as system_name,
  sub.role,
  sub.status,
  sub.governing_body_id,
  sub.owner_person_id
from public.aims_ria_subjects sub
join public.ai_systems ai on ai.id = sub.system_id;

create or replace view public.v_aims_sistemas_por_organo
with (security_invoker = on) as
select
  sub.governing_body_id,
  sub.id as subject_id,
  sub.system_id,
  ai.tenant_id,
  ai.name as system_name,
  sub.entity_id,
  sub.role,
  sub.status
from public.aims_ria_subjects sub
join public.ai_systems ai on ai.id = sub.system_id
where sub.governing_body_id is not null;

revoke all on public.v_aims_sistemas_por_entidad from public, anon;
revoke all on public.v_aims_sistemas_por_organo from public, anon;
grant select on public.v_aims_sistemas_por_entidad to authenticated;
grant select on public.v_aims_sistemas_por_organo to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Verificación: aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_n int;
  v_err text;
  v_sys_arga uuid;
  v_user_arga uuid := '85e24c66-02c7-4175-b260-1330930ad49f';
  v_persona_arga uuid := 'f8b64324-a19d-4050-98c2-8e34cff52087';
  v_assessor uuid;
  v_autor uuid;
  v_eval uuid;
  v_otra_persona uuid;
begin
  -- 6.1 Estructura: columnas nuevas presentes.
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public'
     and ((table_name = 'ai_systems' and column_name in ('inventory_kind', 'prohibited_practice_status', 'ai_policy_id', 'provider_third_party_id'))
       or (table_name = 'ai_incidents' and column_name in ('entity_id', 'subject_id', 'occurred_member_state', 'ria_qualification', 'ria_serious_letters', 'ria_qualification_motivation', 'qualified_by', 'qualified_at'))
       or (table_name = 'ai_risk_assessments' and column_name in ('subject_id', 'catalog_version', 'created_by', 'review_decision', 'review_motivation'))
       or (table_name = 'ai_compliance_checks' and column_name = 'subject_id'));
  if v_n <> 18 then
    raise exception 'VERIFICACION: se esperaban 18 columnas nuevas, el instrumento ve %', v_n;
  end if;

  -- Control positivo: el DEFAULT de inventory_kind no reescribe otras columnas
  -- (comprobado mirando el catálogo: prohibited_practice_status sigue sin DEFAULT).
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_systems'
     and column_name = 'prohibited_practice_status' and column_default is not null;
  if v_n <> 0 then
    raise exception 'VERIFICACION: prohibited_practice_status tiene DEFAULT y no debería';
  end if;

  -- 6.2 FK RESTRICT: ai_incidents.entity_id → entities (E-02 / RS-TABLA 9).
  select count(*) into v_n from pg_constraint
   where contype = 'f' and confdeltype = 'r'
     and conrelid = 'public.ai_incidents'::regclass and confrelid = 'public.entities'::regclass;
  if v_n <> 1 then
    raise exception 'VERIFICACION: ai_incidents.entity_id → entities debe ser RESTRICT, el instrumento ve %', v_n;
  end if;

  -- 6.3 Ni un DEFAULT auth.uid() en columnas FK a persons (E-01).
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_risk_assessments'
     and column_name in ('assessor_id', 'created_by') and column_default is not null;
  if v_n <> 0 then
    raise exception 'VERIFICACION: % columnas FK a persons tienen DEFAULT (E-01)', v_n;
  end if;

  -- 6.4 Dato real de sondas.
  select id into v_sys_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;
  select p.id into v_otra_persona from public.persons p
   where p.tenant_id = '00000000-0000-0000-0000-000000000001' and p.id <> v_persona_arga
   limit 1;
  if v_sys_arga is null or v_otra_persona is null then
    raise exception 'VERIFICACION: falta dato real de sondas';
  end if;

  -- 6.5 Sin persona: PERFIL_SIN_PERSONA.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_err := null;
  begin
    insert into public.ai_risk_assessments (system_id, framework, status)
    values (v_sys_arga, 'EU_AI_ACT', 'BORRADOR');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'PERFIL_SIN_PERSONA%' then
    raise exception 'VERIFICACION: una sesión sin persona no se rechaza al crear una evaluación (%)', v_err;
  end if;

  -- 6.6 Positivo: la autoría es SIEMPRE la persona de la sesión, aunque se
  --     mande otra explícitamente ("manda el servidor" — E-01).
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_arga, 'role', 'authenticated')::text, true);
  begin
    insert into public.ai_risk_assessments (system_id, framework, status, assessor_id, created_by)
    values (v_sys_arga, 'EU_AI_ACT', 'BORRADOR', v_otra_persona, v_otra_persona)
    returning id, assessor_id, created_by into v_eval, v_assessor, v_autor;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: la evaluación legítima se rechazó (%)', v_err;
  end if;
  if v_assessor is distinct from v_persona_arga or v_autor is distinct from v_persona_arga then
    raise exception 'VERIFICACION: assessor_id/created_by no son la persona de la sesión (% / %, esperado %)', v_assessor, v_autor, v_persona_arga;
  end if;

  -- 6.7 review_decision: bloqueado sin el flag de la RPC (F2.T7 lo enciende).
  perform set_config('aims.revision_rpc', '', true);
  v_err := null;
  begin
    insert into public.ai_risk_assessments (system_id, framework, status, review_decision)
    values (v_sys_arga, 'EU_AI_ACT', 'BORRADOR', 'ACEPTA');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'REVISION_SOLO_POR_RPC%' then
    raise exception 'VERIFICACION: review_decision se escribe sin RPC (%)', v_err;
  end if;

  -- Control positivo: con el flag encendido (lo que hará fn_aims_review_assessment
  -- v2), la misma escritura entra.
  perform set_config('aims.revision_rpc', 'on', true);
  v_err := null;
  begin
    insert into public.ai_risk_assessments (system_id, framework, status, review_decision, review_motivation)
    values (v_sys_arga, 'EU_AI_ACT', 'BORRADOR', 'ACEPTA', 'control positivo de verificación');
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: el flag de la RPC no desbloquea review_decision (%)', v_err;
  end if;
  perform set_config('aims.revision_rpc', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- 6.8 inventory_kind: bloqueado sin RPC (E-08); ai_policy_id SÍ se puede
  --     tocar sin flag (no está guardado, es solo lectura de referencia).
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_err := null;
  begin
    update public.ai_systems set inventory_kind = 'HOJA_DE_RUTA' where id = v_sys_arga;
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'INVENTARIO_SOLO_POR_RPC%' then
    raise exception 'VERIFICACION: inventory_kind se cambia sin RPC (%)', v_err;
  end if;

  -- 6.9 prohibited_practice_status: bloqueado sin el flag de clasificación.
  perform set_config('aims.clasificacion_rpc', '', true);
  v_err := null;
  begin
    update public.ai_systems set prohibited_practice_status = 'EN_ANALISIS' where id = v_sys_arga;
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'CLASIFICACION_SOLO_POR_CUESTIONARIO%' then
    raise exception 'VERIFICACION: prohibited_practice_status se cambia sin RPC (%)', v_err;
  end if;
  perform set_config('request.jwt.claims', '', true);

  -- 6.10 ai_incidents: la calificación no se muta directamente.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_err := null;
  begin
    update public.ai_incidents set ria_qualification = 'NO_ES_GRAVE'
     where system_id = v_sys_arga;
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  -- Vacuo si no hay incidentes de ese sistema (0 filas, sin error): se declara.
  if v_err is null then
    raise notice 'VERIFICACION: sin incidentes reales sobre los que probar la guardia de calificación (0 filas, no es fallo)';
  elsif v_err not like 'CALIFICACION_SOLO_POR_RPC%' then
    raise exception 'VERIFICACION: la calificación del incidente se cambia sin RPC (%)', v_err;
  end if;
  perform set_config('request.jwt.claims', '', true);

  raise notice 'VERIFICACION OK: columnas nuevas, FK RESTRICT, autoría por persona de sesión (E-01), guardias DS-32 de review_decision/inventory_kind/prohibited_practice_status/calificación de incidente';
end;
$verificacion$;
