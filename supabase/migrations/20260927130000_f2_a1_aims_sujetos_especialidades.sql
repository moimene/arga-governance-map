-- MOI-170 — F2.T2 (M02), programa RIA, carril A (capa de base de datos).
-- Especificación: docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md
-- §2.1 (RS-TABLA), §2.2 (aims_ria_subjects, aims_specialty_bodies), §7.
-- Ledger: docs/superpowers/plans/2026-09-19-ledger-cobertura-ria.md.
--
-- QUÉ CREA
-- --------
-- `aims_ria_subjects`: quién (una entidad elegible) es sujeto (proveedor,
-- responsable del despliegue…) de qué sistema de IA, con qué base legal y en
-- qué estado. `aims_specialty_bodies`: qué órgano lleva cada especialidad
-- (Jurídico, Técnico, Riesgos, Ciberseguridad, Datos) por tenant.
--
-- SOLO POR RPC
-- ------------
-- Las dos tablas no llevan política de escritura ni GRANT de INSERT/UPDATE
-- para `authenticated`: solo SELECT. Las RPC de F2.T4 (`fn_aims_proponer_sujeto`,
-- `fn_aims_confirmar_sujeto`, carril A3) y F2.T10 (`fn_aims_declarar_especialidad`,
-- carril A6) son SECURITY DEFINER y escriben con los privilegios de su dueño,
-- así que el GRANT de la tabla no las condiciona. Sin ellas, hoy, nadie
-- autenticado puede escribir aquí — es la postura correcta hasta que esas RPC
-- existan (A3 y A6, más adelante en este mismo lote).
--
-- DEUDA DECLARADA: `model_id` / `aims_model_registry`
-- ----------------------------------------------------
-- La especificación describe `system_id → ai_systems` y `model_id →
-- aims_model_registry` con un CHECK de «exactamente uno». `aims_model_registry`
-- es una de las 8 tablas muertas sujetas a la decisión D-U7 (revivirlas o no),
-- que NO es parte de este carril. Añadir aquí una FK a una tabla que no existe
-- rompería la migración. Por eso `aims_ria_subjects` nace con `system_id NOT
-- NULL` únicamente: un sujeto es siempre de un sistema. Cuando D-U7 se
-- resuelva y `aims_model_registry` exista, una migración aparte añade
-- `model_id`, relaja el NOT NULL de `system_id` y repone el CHECK de
-- «exactamente uno» — no se toca aquí.
--
-- RS-TABLA aplicada
-- -----------------
-- 1. `tenant_id uuid NOT NULL` sin DEFAULT en las dos tablas.
-- 2. RLS activada, SELECT por tenant, sin política de escritura.
-- 3. REVOKE ALL FROM public, anon, authenticated (el esquema concede por
--    defecto INSERT/SELECT/UPDATE/DELETE a `anon` y `authenticated` — medido
--    en `pg_default_acl` antes de escribir esto — así que sin este REVOKE
--    explícito las dos tablas nacerían abiertas). Luego GRANT SELECT, solo a
--    `authenticated`. TRUNCATE, REFERENCES y TRIGGER quedan fuera de ambos.
-- 4. `fn_aims_fk_misma_tenant()` en las FK hacia `entities` y `governing_bodies`.
-- 5. (No aplica aquí: no hay flags de RPC que apagar en esta migración.)
-- 6. Bloque DO de verificación que aborta, con control positivo.
-- 7. Espejo en este fichero; aplicación por MCP `execute_sql`; registro manual
--    en `schema_migrations`.
-- 8. Sin DELETE ni TRUNCATE de dato sembrado (no hay dato: tablas nuevas).
-- 9. ON DELETE RESTRICT hacia `ai_systems` y `entities`.

-- ---------------------------------------------------------------------------
-- 0. Función transversal: una FK cuyo referenciado no sea del mismo tenant se
--    rechaza. Genérica por TG_ARGV (pares columna, tabla referenciada); ambas
--    tienen `tenant_id`. Se salta cuando la columna es NULL (FK opcional).
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_fk_misma_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  i int;
  v_col text;
  v_tabla text;
  v_ref_id uuid;
  v_ref_tenant uuid;
begin
  for i in 0 .. (array_length(tg_argv, 1) / 2 - 1) loop
    v_col := tg_argv[i * 2];
    v_tabla := tg_argv[i * 2 + 1];
    v_ref_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_ref_id is not null then
      execute format('select tenant_id from public.%I where id = $1', v_tabla)
        into v_ref_tenant using v_ref_id;
      if v_ref_tenant is not null and v_ref_tenant is distinct from new.tenant_id then
        raise exception 'REFERENCIA_DE_OTRO_TENANT: % (%.%) no es del tenant de esta fila', v_ref_id, v_tabla, v_col
          using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end;
$fn$;

revoke all on function public.fn_aims_fk_misma_tenant() from public, anon;

-- ---------------------------------------------------------------------------
-- 1. Espejo SQL de `src/lib/aims/sujeto-juridico.ts`: ¿esta entidad puede ser
--    sujeto de una obligación del RIA? Falla cerrado (forma no clasificada =
--    no elegible), igual que la hoja TS.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_entidad_puede_ser_sujeto(p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_rol text;
  v_forma text;
  v_estado text;
  v_clase text;
begin
  select upper(coalesce(e.group_role, '')),
         -- normalizaForma: sin puntos, espacios colapsados, mayúsculas.
         upper(trim(regexp_replace(regexp_replace(coalesce(e.legal_form, ''), '\.', '', 'g'), '\s+', ' ', 'g'))),
         upper(coalesce(e.entity_status, ''))
    into v_rol, v_forma, v_estado
    from public.entities e
   where e.id = p_entity_id;

  if not found then
    return false;
  end if;

  if v_estado in ('LIQUIDATED', 'INACTIVE') then
    return false;
  end if;

  if v_rol = 'INTEGRACION' then
    return false;
  end if;
  if v_rol in ('SUCURSAL', 'OFICINA', 'OFICINA_REPRESENTACION', 'DIVISION') then
    return false;
  end if;

  v_clase := case v_forma
    when 'SLP' then 'SOCIEDAD' when 'SL' then 'SOCIEDAD' when 'SLU' then 'SOCIEDAD'
    when 'SA' then 'SOCIEDAD' when 'SICAV' then 'SOCIEDAD' when 'LDA' then 'SOCIEDAD'
    when 'SOCIEDADE LIMITADA UNIPESSOAL' then 'SOCIEDAD'
    when 'SOCIEDADE POR QUOTAS UNIPESSOAL' then 'SOCIEDAD'
    when 'SPA' then 'SOCIEDAD' when 'AG' then 'SOCIEDAD' when 'AŞ' then 'SOCIEDAD'
    when 'PT' then 'SOCIEDAD' when 'INC' then 'SOCIEDAD' when 'LTD' then 'SOCIEDAD'
    when 'CORPORATION' then 'SOCIEDAD' when 'SA DE CV' then 'SOCIEDAD'
    when 'SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE' then 'SOCIEDAD'
    when 'SAS' then 'SOCIEDAD' when 'SCRL' then 'SOCIEDAD' when 'SARLAU' then 'SOCIEDAD'
    when 'LIMITADA' then 'SOCIEDAD'
    when 'FUNDACION' then 'FUNDACION' when 'FUNDACIÓN' then 'FUNDACION'
    when 'SUCURSAL' then 'ESTABLECIMIENTO' when 'OFICINA' then 'ESTABLECIMIENTO'
    when 'REP_OFFICE' then 'ESTABLECIMIENTO' when 'DIVISION' then 'ESTABLECIMIENTO'
    when 'INSTITUCION' then 'SIN_PERSONALIDAD_ACREDITADA'
    when 'SC' then 'PERSONALIDAD_NO_ACREDITADA'
    when 'LLP' then 'PERSONALIDAD_NO_ACREDITADA'
    when 'SPK' then 'PERSONALIDAD_NO_ACREDITADA'
    else 'SIN_CLASIFICAR'
  end;

  return v_clase in ('SOCIEDAD', 'FUNDACION');
end;
$fn$;

revoke all on function public.fn_aims_entidad_puede_ser_sujeto(uuid) from public, anon;
grant execute on function public.fn_aims_entidad_puede_ser_sujeto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. `aims_ria_subjects`.
-- ---------------------------------------------------------------------------
create table public.aims_ria_subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  system_id uuid not null references public.ai_systems(id) on delete restrict,
  entity_id uuid not null references public.entities(id) on delete restrict,
  role text not null check (role in (
    'PROVEEDOR', 'RESPONSABLE_DESPLIEGUE', 'IMPORTADOR', 'DISTRIBUIDOR',
    'PROVEEDOR_POSTERIOR', 'PROVEEDOR_GPAI', 'REPRESENTANTE_AUTORIZADO'
  )),
  role_basis text[] not null default '{}'::text[] check (role_basis <@ array[
    '3.3', '3.3+3.11', '3.4', '25.1.a', '25.1.b', '25.1.c',
    '3.5', '3.6', '3.7', '3.68', '3.63', 'ACUERDO_INTRAGRUPO'
  ]::text[]),
  status text not null default 'PROPUESTO' check (status in (
    'PROPUESTO', 'PENDIENTE_LEGAL', 'VIGENTE', 'CERRADO'
  )),
  derivation text not null check (derivation in ('CUESTIONARIO', 'SIEMBRA_HIPOTESIS', 'LEGAL')),
  questionnaire_id uuid references public.aims_classification_questionnaires(id) on delete restrict,
  scope_result text check (scope_result in ('EN_AMBITO', 'FUERA_DE_AMBITO', 'PENDIENTE')),
  scope_basis text[] not null default '{}'::text[] check (scope_basis <@ array[
    '2.1.a', '2.1.b', '2.1.c', '2.1.d', '2.1.e', '2.1.f',
    '2.3', '2.4', '2.6', '2.8', '2.10', '2.12', '2.13'
  ]::text[]),
  establishment text check (establishment in ('UE', 'TERCER_PAIS')),
  output_used_in_eu boolean,
  rationale text,
  owner_person_id uuid references public.persons(id),
  governing_body_id uuid references public.governing_bodies(id),
  review_cadence_months integer check (review_cadence_months is null or review_cadence_months > 0),
  cadence_decision_ref text,
  next_review_due date,
  suspended_at timestamptz,
  suspension_reason text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aims_ria_subjects_cuestionario_ck
    check (derivation <> 'CUESTIONARIO' or questionnaire_id is not null),
  constraint aims_ria_subjects_vigente_owner_ck
    check (status <> 'VIGENTE' or owner_person_id is not null)
);

comment on table public.aims_ria_subjects is
  'F2.T2 (M02). Quién es sujeto (proveedor, responsable del despliegue…) de qué sistema de IA, y en qué estado. Solo por RPC (fn_aims_proponer_sujeto / fn_aims_confirmar_sujeto, F2.T4).';
comment on column public.aims_ria_subjects.derivation is
  'CUESTIONARIO exige questionnaire_id. SIEMBRA_HIPOTESIS: dato demo a validar por Legal (F2.T16, fuera de este carril). Se cierra y sustituye, nunca se reescribe (DS-34).';

create unique index ux_aims_ria_subjects_vigente
  on public.aims_ria_subjects (tenant_id, system_id, entity_id, role)
  where status <> 'CERRADO';

create index ix_aims_ria_subjects_entity on public.aims_ria_subjects (entity_id);
create index ix_aims_ria_subjects_governing_body on public.aims_ria_subjects (governing_body_id);

alter table public.aims_ria_subjects enable row level security;

create policy aims_ria_subjects_select
  on public.aims_ria_subjects for select
  using (tenant_id = public.fn_current_tenant_id());

revoke all on table public.aims_ria_subjects from public, anon, authenticated;
grant select on table public.aims_ria_subjects to authenticated;

create trigger trg_aims_ria_subjects_fk_tenant
  before insert or update on public.aims_ria_subjects
  for each row execute function public.fn_aims_fk_misma_tenant('entity_id', 'entities', 'governing_body_id', 'governing_bodies');

create or replace function public.fn_aims_ria_subjects_elegibilidad_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.fn_aims_entidad_puede_ser_sujeto(new.entity_id) then
    raise exception 'ENTIDAD_NO_ELEGIBLE: % no puede ser sujeto de una obligación del RIA (no es persona jurídica propia, o su forma no está clasificada)', new.entity_id
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

revoke all on function public.fn_aims_ria_subjects_elegibilidad_guard() from public, anon;

create trigger trg_aims_ria_subjects_elegibilidad
  before insert or update of entity_id on public.aims_ria_subjects
  for each row execute function public.fn_aims_ria_subjects_elegibilidad_guard();

create trigger trg_aims_ria_subjects_audit_worm
  after insert or update or delete on public.aims_ria_subjects
  for each row execute function public.fn_audit_worm();

-- ---------------------------------------------------------------------------
-- 3. `aims_specialty_bodies`.
-- ---------------------------------------------------------------------------
create table public.aims_specialty_bodies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  especialidad text not null check (especialidad in (
    'JURIDICO', 'TECNICO', 'RIESGOS', 'CIBERSEGURIDAD', 'DATOS'
  )),
  governing_body_id uuid not null references public.governing_bodies(id),
  declared_by uuid,
  declared_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint aims_specialty_bodies_unica unique (tenant_id, especialidad)
);

comment on table public.aims_specialty_bodies is
  'F2.T2 (M02). Qué órgano lleva cada especialidad (Jurídico, Técnico, Riesgos, Ciberseguridad, Datos) por tenant. Solo por RPC fn_aims_declarar_especialidad (F2.T10, AIMS_GOBIERNO). ARGA vacía hasta D-U6.';

alter table public.aims_specialty_bodies enable row level security;

create policy aims_specialty_bodies_select
  on public.aims_specialty_bodies for select
  using (tenant_id = public.fn_current_tenant_id());

revoke all on table public.aims_specialty_bodies from public, anon, authenticated;
grant select on table public.aims_specialty_bodies to authenticated;

create trigger trg_aims_specialty_bodies_fk_tenant
  before insert or update on public.aims_specialty_bodies
  for each row execute function public.fn_aims_fk_misma_tenant('governing_body_id', 'governing_bodies');

-- ---------------------------------------------------------------------------
-- 4. Verificación: aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_n int;
  v_err text;
  v_sys_arga uuid;
  v_sys_garr uuid;
  v_entidad_elegible uuid;
  v_entidad_oficina uuid;
  v_creado uuid;
begin
  -- 4.1 Estructura: tablas, tenant_id NOT NULL sin DEFAULT.
  select count(*) into v_n from information_schema.tables
   where table_schema = 'public' and table_name in ('aims_ria_subjects', 'aims_specialty_bodies');
  if v_n <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 tablas nuevas, hay %', v_n;
  end if;

  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and column_name = 'tenant_id'
     and table_name in ('aims_ria_subjects', 'aims_specialty_bodies')
     and is_nullable = 'NO' and column_default is null;
  if v_n <> 2 then
    raise exception 'VERIFICACION: tenant_id debe ser NOT NULL sin DEFAULT en las 2 tablas, el instrumento ve %', v_n;
  end if;

  -- 4.2 FK con ON DELETE RESTRICT (E-02 / RS-TABLA 9).
  select count(*) into v_n from pg_constraint
   where contype = 'f' and confdeltype = 'r'
     and ((conrelid = 'public.aims_ria_subjects'::regclass and confrelid = 'public.ai_systems'::regclass)
       or (conrelid = 'public.aims_ria_subjects'::regclass and confrelid = 'public.entities'::regclass));
  if v_n <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 FK RESTRICT (ai_systems, entities) desde aims_ria_subjects, hay %', v_n;
  end if;

  -- Control positivo: el instrumento ve una FK que NO es RESTRICT (persons, sin ON DELETE = NO ACTION).
  select count(*) into v_n from pg_constraint
   where contype = 'f' and confdeltype <> 'r'
     and conrelid = 'public.aims_ria_subjects'::regclass and confrelid = 'public.persons'::regclass;
  if v_n <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve la FK NO-RESTRICT de control (owner_person_id → persons)';
  end if;

  -- 4.3 Grants: SELECT solo para authenticated, nada para anon, nada más para authenticated.
  select count(*) into v_n from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('aims_ria_subjects', 'aims_specialty_bodies')
     and grantee = 'anon';
  if v_n <> 0 then
    raise exception 'VERIFICACION: anon tiene % privilegios sobre las tablas nuevas', v_n;
  end if;

  select count(*) into v_n from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('aims_ria_subjects', 'aims_specialty_bodies')
     and grantee = 'authenticated' and privilege_type = 'SELECT';
  if v_n <> 2 then
    raise exception 'VERIFICACION: authenticated debe tener SELECT en las 2 tablas, el instrumento ve %', v_n;
  end if;

  select count(*) into v_n from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('aims_ria_subjects', 'aims_specialty_bodies')
     and grantee = 'authenticated' and privilege_type <> 'SELECT';
  if v_n <> 0 then
    raise exception 'VERIFICACION: authenticated conserva % privilegios de escritura sobre las tablas nuevas (deben ser solo por RPC)', v_n;
  end if;

  -- 4.4 Sujeto de las sondas de comportamiento, con dato REAL.
  select id into v_sys_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;
  select id into v_sys_garr from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1;
  select id into v_entidad_elegible from public.entities
   where tenant_id = '00000000-0000-0000-0000-000000000001' and legal_form in ('SLU', 'SA', 'SL')
   order by id limit 1;
  select id into v_entidad_oficina from public.entities
   where tenant_id = '00000000-0000-0000-0000-000000000002'
     and group_role in ('SUCURSAL', 'OFICINA', 'OFICINA_REPRESENTACION', 'DIVISION')
   order by id limit 1;
  if v_sys_arga is null or v_sys_garr is null or v_entidad_elegible is null or v_entidad_oficina is null then
    raise exception 'VERIFICACION: falta dato real de sondas (sistema ARGA %, sistema Garrigues %, entidad elegible %, entidad oficina %)',
      v_sys_arga, v_sys_garr, v_entidad_elegible, v_entidad_oficina;
  end if;

  -- 4.5 Control positivo del instrumento: la hoja SQL clasifica bien lo que ya se sabe.
  if not public.fn_aims_entidad_puede_ser_sujeto(v_entidad_elegible) then
    raise exception 'VERIFICACION: el instrumento declara NO elegible una entidad SLU/SA/SL real (%), la hoja está mal', v_entidad_elegible;
  end if;
  if public.fn_aims_entidad_puede_ser_sujeto(v_entidad_oficina) then
    raise exception 'VERIFICACION: el instrumento declara elegible una oficina real (%), la hoja está mal', v_entidad_oficina;
  end if;

  -- 4.6 Positivo: alta legítima (SIEMBRA_HIPOTESIS no exige cuestionario), revertida.
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000001', v_sys_arga, v_entidad_elegible,
            'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS', 'PROPUESTO')
    returning id into v_creado;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' or v_creado is null then
    raise exception 'VERIFICACION: el alta legítima de un sujeto se rechazó (%)', v_err;
  end if;

  -- 4.7 Negativo: una OFICINA no puede ser sujeto (control de aceptación de F2.T2).
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000002', v_sys_garr, v_entidad_oficina,
            'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS', 'PROPUESTO');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'ENTIDAD_NO_ELEGIBLE%' then
    raise exception 'VERIFICACION: un sujeto sobre una oficina no se rechaza (%)', v_err;
  end if;

  -- 4.8 Negativo: sistema de un tenant con entidad de OTRO tenant.
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000001', v_sys_arga, v_entidad_oficina,
            'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS', 'PROPUESTO');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  -- Puede caer primero por REFERENCIA_DE_OTRO_TENANT (fk_misma_tenant) o por
  -- ENTIDAD_NO_ELEGIBLE (también es cierto: es una oficina). Cualquiera de los
  -- dos motivos legítimos vale; lo que no vale es que entre.
  if v_err not like 'REFERENCIA_DE_OTRO_TENANT%' and v_err not like 'ENTIDAD_NO_ELEGIBLE%' then
    raise exception 'VERIFICACION: un sujeto cruzando tenants no se rechaza (%)', v_err;
  end if;

  -- 4.9 Negativo, cruce de tenant con entidad SÍ elegible (aísla fk_misma_tenant
  --     de la elegibilidad: aquí solo puede fallar por el tenant).
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000002', v_sys_garr, v_entidad_elegible,
            'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS', 'PROPUESTO');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'REFERENCIA_DE_OTRO_TENANT%' then
    raise exception 'VERIFICACION: fk_misma_tenant no aísla el cruce de tenant de la elegibilidad (%)', v_err;
  end if;

  -- 4.10 Negativo: CUESTIONARIO sin questionnaire_id.
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000001', v_sys_arga, v_entidad_elegible,
            'PROVEEDOR', 'CUESTIONARIO', 'PROPUESTO');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like '%aims_ria_subjects_cuestionario_ck%' then
    raise exception 'VERIFICACION: CUESTIONARIO sin questionnaire_id no se rechaza (%)', v_err;
  end if;

  -- 4.11 Negativo: VIGENTE sin responsable interno.
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000001', v_sys_arga, v_entidad_elegible,
            'PROVEEDOR', 'SIEMBRA_HIPOTESIS', 'VIGENTE');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like '%aims_ria_subjects_vigente_owner_ck%' then
    raise exception 'VERIFICACION: VIGENTE sin owner_person_id no se rechaza (%)', v_err;
  end if;

  -- Sin residuo: todo lo de arriba fue SONDA_REVERTIDA salvo lo explícitamente
  -- rechazado (que tampoco deja fila). Confirmar 0 filas al cierre.
  select count(*) into v_n from public.aims_ria_subjects;
  if v_n <> 0 then
    raise exception 'VERIFICACION: la migración deja % filas de residuo en aims_ria_subjects', v_n;
  end if;

  raise notice 'VERIFICACION OK: 2 tablas RS-TABLA, FK RESTRICT, grants solo-SELECT, elegibilidad y tenant aislados, 0 residuo';
end;
$verificacion$;
