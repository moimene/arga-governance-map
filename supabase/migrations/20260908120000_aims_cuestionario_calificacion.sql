-- Cuestionario guiado de calificación regulatoria (spec v1.1 del equipo legal,
-- 2026-09-08), validado en
-- docs/superpowers/reviews/2026-09-08-validacion-spec-cuestionario-vs-refactor-aims.md.
--
-- QUÉ CIERRA
-- ----------
-- Hasta hoy la clasificación de un sistema de IA vivía en dos columnas
-- editables desde cualquier pantalla (`ai_systems.regulatory_role`,
-- `ai_systems.risk_level`) y en un jsonb sin versión ni huella
-- (`regulatory_profile`). Un cuestionario respondido era una casilla que se
-- podía sobrescribir sin dejar rastro.
--
-- Desde esta migración:
--   * cada cuestionario es una FILA versionada por sistema; sólo una COMPLETED a
--     la vez (índice parcial); la anterior pasa a SUPERSEDED por la RPC, nunca a
--     mano;
--   * una COMPLETED es INMUTABLE (trigger) y no se borra (sin política ni grant
--     de DELETE; TRUNCATE revocado, que no pasa por RLS);
--   * la huella SHA-512 se calcula EN SERVIDOR sobre la serialización canónica
--     de la fila, como `fn_aims_freeze_assessment`; acredita integridad y autoría,
--     NO fecha cierta (`now()` no es un sello cualificado);
--   * `ai_systems.regulatory_role` y `risk_level` sólo cambian a través de la
--     RPC (trigger con flag de transacción); la ficha deja de editarlos;
--   * el alta de un sistema por un usuario autenticado sólo pasa por
--     `fn_aims_registrar_sistema`, que inserta sistema y cuestionario en la
--     misma transacción (CA-1 de la spec, mitigación D1). service_role y
--     `postgres` (seeds) quedan fuera de ese gate de INSERT; el de UPDATE aplica
--     a todos.
--
-- LO QUE NO DECIDE (validación S-1…S-14): el vocabulario persistido no cambia
-- (`Inaceptable`, `RESPONSABLE_DESPLIEGUE`); `completed_by` es `auth.uid()` sin
-- FK a `auth.users`, como `frozen_by_id`; no hay tabla de configuración de
-- preguntas (viven en `src/lib/aims/cuestionario-calificacion.ts`, versionadas,
-- y cada fila guarda `questionnaire_version`).
--
-- Cero cambio ARGA: ninguna fila existente se toca; las columnas de `ai_systems`
-- no cambian de forma. Cero cambio Garrigues: Harvey no se clasifica aquí.

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------
create table if not exists public.aims_classification_questionnaires (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null,
  -- El borrado de un sistema (que el producto no ofrece) arrastra su historial:
  -- sin cascade, un sistema con cuestionario sería imborrable —no hay DELETE
  -- sobre esta tabla— y las sondas dejarían residuo.
  system_id                  uuid not null references public.ai_systems(id) on delete cascade,
  version                    integer not null default 1,
  status                     text not null default 'DRAFT'
                             check (status in ('DRAFT', 'COMPLETED', 'SUPERSEDED')),
  questionnaire_version      text not null,
  phase1_responses           jsonb not null default '{}'::jsonb,
  phase2_responses           jsonb not null default '{}'::jsonb,
  phase2_art63_justification text,
  computed_role              text
                             check (computed_role is null or computed_role in (
                               'PROVEEDOR', 'RESPONSABLE_DESPLIEGUE', 'IMPORTADOR', 'DISTRIBUIDOR',
                               'PROVEEDOR_GPAI', 'PROVEEDOR_POSTERIOR')),
  computed_risk_level        text
                             check (computed_risk_level is null or computed_risk_level in (
                               'Inaceptable', 'Alto', 'Limitado', 'Mínimo')),
  gpai_dependency            boolean not null default false,
  applicable_frameworks      jsonb not null default '[]'::jsonb,
  catalog_profile            text
                             check (catalog_profile is null or catalog_profile in (
                               'PROFILE_A', 'PROFILE_B', 'PROFILE_C')),
  completed_by               uuid,
  completed_at               timestamptz,
  content_hash               text,
  created_by                 uuid default auth.uid(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (system_id, version)
);

comment on table public.aims_classification_questionnaires is
  'Cuestionario guiado de calificación regulatoria (Reglamento (UE) 2024/1689, arts. 3, 5, 6, 25, 50 y anexo III). Versionado por sistema; una sola fila COMPLETED por sistema; COMPLETED y SUPERSEDED inmutables; huella SHA-512 de servidor.';
comment on column public.aims_classification_questionnaires.content_hash is
  'SHA-512 hex (128) calculado en servidor sobre la serialización canónica de la fila al completarla. Acredita integridad y autoría; no acredita fecha cierta.';

create unique index if not exists ux_aims_classification_completed_per_system
  on public.aims_classification_questionnaires (system_id) where status = 'COMPLETED';
create unique index if not exists ux_aims_classification_draft_per_system
  on public.aims_classification_questionnaires (system_id) where status = 'DRAFT';
create index if not exists ix_aims_classification_tenant_system
  on public.aims_classification_questionnaires (tenant_id, system_id);

-- ---------------------------------------------------------------------------
-- 2. RLS y privilegios. Sin política de DELETE: un cuestionario no se borra
--    desde la aplicación. Un grant es aditivo y TRUNCATE no pasa por RLS, así que
--    se revoca explícitamente lo que no se concede.
-- ---------------------------------------------------------------------------
alter table public.aims_classification_questionnaires enable row level security;

drop policy if exists aims_classification_questionnaires_tenant_select on public.aims_classification_questionnaires;
create policy aims_classification_questionnaires_tenant_select
  on public.aims_classification_questionnaires for select to authenticated
  using (tenant_id = public.fn_current_tenant_id());

drop policy if exists aims_classification_questionnaires_tenant_insert on public.aims_classification_questionnaires;
create policy aims_classification_questionnaires_tenant_insert
  on public.aims_classification_questionnaires for insert to authenticated
  with check (
    tenant_id = public.fn_current_tenant_id()
    and exists (
      select 1 from public.ai_systems s
       where s.id = system_id and s.tenant_id = public.fn_current_tenant_id()
    )
  );

drop policy if exists aims_classification_questionnaires_tenant_update on public.aims_classification_questionnaires;
create policy aims_classification_questionnaires_tenant_update
  on public.aims_classification_questionnaires for update to authenticated
  using (tenant_id = public.fn_current_tenant_id())
  with check (tenant_id = public.fn_current_tenant_id());

revoke all on table public.aims_classification_questionnaires from public, anon;
grant select, insert, update on table public.aims_classification_questionnaires to authenticated;
revoke delete, truncate, references, trigger on table public.aims_classification_questionnaires from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Versión por sistema al insertar. El cliente nunca la fija: un DRAFT
--    nuevo tras una COMPLETED v1 colisionaría con unique (system_id, version).
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_cuestionario_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  select coalesce(max(q.version), 0) + 1
    into new.version
    from public.aims_classification_questionnaires q
   where q.system_id = new.system_id;
  -- Sólo se nace en borrador; completar es cosa de la RPC.
  if new.status <> 'DRAFT' and current_setting('aims.clasificacion_rpc', true) is distinct from 'on' then
    raise exception 'COMPLETAR_SOLO_POR_RPC: un cuestionario nace en DRAFT y lo completa fn_aims_completar_cuestionario'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_aims_cuestionario_version on public.aims_classification_questionnaires;
create trigger trg_aims_cuestionario_version
  before insert on public.aims_classification_questionnaires
  for each row execute function public.fn_aims_cuestionario_version();

-- ---------------------------------------------------------------------------
-- 4. Inmutabilidad. COMPLETED sólo puede pasar a SUPERSEDED, y sólo lo hace la
--    RPC (flag de transacción) sin tocar nada más; SUPERSEDED no cambia;
--    DRAFT se edita libremente salvo los campos que sella la RPC.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_cuestionario_inmutable()
returns trigger
language plpgsql
as $fn$
declare
  -- `current_setting(…, true)` devuelve NULL cuando el flag no existe, y NULL = 'on'
  -- es NULL, no false: sin el coalesce el `if not v_rpc` no bloqueaba nunca.
  v_rpc boolean := coalesce(current_setting('aims.clasificacion_rpc', true), '') = 'on';
  v_antes jsonb;
  v_despues jsonb;
begin
  if new.tenant_id is distinct from old.tenant_id or new.system_id is distinct from old.system_id then
    raise exception 'CUESTIONARIO_NO_SE_MUEVE: tenant y sistema no cambian' using errcode = '42501';
  end if;

  if old.status = 'SUPERSEDED' then
    raise exception 'CUESTIONARIO_SUPERSEDIDO_INMUTABLE' using errcode = '42501';
  end if;

  if old.status = 'COMPLETED' then
    v_antes := to_jsonb(old) - 'status' - 'updated_at';
    v_despues := to_jsonb(new) - 'status' - 'updated_at';
    if not v_rpc or new.status <> 'SUPERSEDED' or v_antes <> v_despues then
      raise exception 'CUESTIONARIO_COMPLETADO_INMUTABLE: modificar la clasificación exige completar un cuestionario nuevo'
        using errcode = '42501';
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- old.status = 'DRAFT'
  if not v_rpc then
    if new.status <> 'DRAFT' then
      raise exception 'COMPLETAR_SOLO_POR_RPC: la huella se calcula en servidor' using errcode = '42501';
    end if;
    if new.completed_by is not null or new.completed_at is not null or new.content_hash is not null
       or new.version is distinct from old.version then
      raise exception 'CAMPOS_SELLADOS_POR_RPC: completed_by, completed_at, content_hash y version no se escriben desde el cliente'
        using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_aims_cuestionario_inmutable on public.aims_classification_questionnaires;
create trigger trg_aims_cuestionario_inmutable
  before update on public.aims_classification_questionnaires
  for each row execute function public.fn_aims_cuestionario_inmutable();

-- ---------------------------------------------------------------------------
-- 5. `ai_systems`: rol y nivel sólo por cuestionario; alta autenticada sólo
--    por la RPC. Se comprueba el rol del JWT y no `current_user` porque las
--    RPC SECURITY DEFINER corren como el dueño y las sondas del CLI como
--    `postgres`: lo que distingue al usuario final es su claim.
-- ---------------------------------------------------------------------------
create or replace function public.fn_ai_systems_clasificacion_solo_por_cuestionario()
returns trigger
language plpgsql
as $fn$
declare
  -- `current_setting(…, true)` devuelve NULL cuando el flag no existe, y NULL = 'on'
  -- es NULL, no false: sin el coalesce el `if not v_rpc` no bloqueaba nunca.
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
      or new.risk_level is distinct from old.risk_level)
     and not v_rpc then
    raise exception 'CLASIFICACION_SOLO_POR_CUESTIONARIO: el rol y el nivel de riesgo se cambian completando un cuestionario nuevo'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_ai_systems_clasificacion_solo_por_cuestionario on public.ai_systems;
create trigger trg_ai_systems_clasificacion_solo_por_cuestionario
  before insert or update of regulatory_role, risk_level on public.ai_systems
  for each row execute function public.fn_ai_systems_clasificacion_solo_por_cuestionario();

-- ---------------------------------------------------------------------------
-- 6. RPC: completar un cuestionario. Asierta el tenant por la fila, valida lo
--    que la spec exige (CA-4 art. 6.3; PROHIBIDO bloquea), supersede la
--    anterior, sella con SHA-512 de servidor y sincroniza `ai_systems`.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_completar_cuestionario(p_id uuid)
returns table (id uuid, version integer, content_hash text, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_uid uuid := auth.uid();
  v_row public.aims_classification_questionnaires%rowtype;
  v_completed_at timestamptz := now();
  v_canonico text;
  v_hash text;
  v_en_anexo_iii boolean;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  select q.* into v_row
    from public.aims_classification_questionnaires q
   where q.id = p_id and q.tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'NO_ENCONTRADO: el cuestionario no existe en este tenant' using errcode = '42501';
  end if;
  if v_row.status <> 'DRAFT' then
    raise exception 'NO_ES_BORRADOR: el cuestionario ya está %', v_row.status using errcode = '42501';
  end if;

  if v_row.computed_risk_level = 'Inaceptable' then
    raise exception 'PRACTICA_PROHIBIDA_BLOQUEA: un sistema que incurre en una práctica prohibida del art. 5 no puede registrarse'
      using errcode = '23514';
  end if;
  if v_row.computed_role is null or v_row.computed_risk_level is null or v_row.catalog_profile is null then
    raise exception 'CUESTIONARIO_INCOMPLETO: faltan rol, nivel o perfil derivados' using errcode = '23514';
  end if;

  -- CA-4: apartarse del anexo III exige documentar la evaluación (art. 6.3).
  v_en_anexo_iii := coalesce((v_row.phase2_responses->>'Q2_2')::boolean, false);
  if v_en_anexo_iii
     and v_row.computed_risk_level not in ('Alto', 'Inaceptable')
     and length(trim(coalesce(v_row.phase2_art63_justification, ''))) < 40 then
    raise exception 'ART63_MOTIVACION_OBLIGATORIA: un sistema del anexo III clasificado por debajo de alto riesgo exige motivación documentada (art. 6.3)'
      using errcode = '23514';
  end if;

  perform set_config('aims.clasificacion_rpc', 'on', true);

  update public.aims_classification_questionnaires q
     set status = 'SUPERSEDED'
   where q.system_id = v_row.system_id and q.status = 'COMPLETED';

  -- Canónico: claves ordenadas por jsonb; incluye sistema, versión, autor y
  -- momento para que la huella no sea transplantable.
  v_canonico := (
    jsonb_build_object(
      'cuestionario_id', v_row.id,
      'system_id', v_row.system_id,
      'version', v_row.version,
      'questionnaire_version', v_row.questionnaire_version,
      'phase1_responses', v_row.phase1_responses,
      'phase2_responses', v_row.phase2_responses,
      'phase2_art63_justification', coalesce(v_row.phase2_art63_justification, ''),
      'computed_role', v_row.computed_role,
      'computed_risk_level', v_row.computed_risk_level,
      'gpai_dependency', v_row.gpai_dependency,
      'applicable_frameworks', v_row.applicable_frameworks,
      'catalog_profile', v_row.catalog_profile,
      'completed_by', v_uid,
      'completed_at', v_completed_at
    )
  )::text;
  v_hash := encode(sha512(convert_to(v_canonico, 'UTF8')), 'hex');

  update public.aims_classification_questionnaires q
     set status = 'COMPLETED',
         completed_by = v_uid,
         completed_at = v_completed_at,
         content_hash = v_hash
   where q.id = v_row.id;

  update public.ai_systems s
     set regulatory_role = v_row.computed_role,
         risk_level = v_row.computed_risk_level,
         regulatory_profile = jsonb_build_object(
           'cuestionario_id', v_row.id,
           'version', v_row.version,
           'questionnaire_version', v_row.questionnaire_version,
           'rol', v_row.computed_role,
           'nivel', v_row.computed_risk_level,
           'perfil', v_row.catalog_profile,
           'gpai', v_row.gpai_dependency,
           'marcos', v_row.applicable_frameworks,
           'exige_art63', v_en_anexo_iii and v_row.computed_risk_level not in ('Alto', 'Inaceptable'),
           'completado_en', v_completed_at,
           'completado_por', v_uid,
           'content_hash', v_hash
         )
   where s.id = v_row.system_id and s.tenant_id = v_tenant;

  -- El flag es local a la transacción, pero se apaga aquí de todos modos: en
  -- una transacción larga (sondas, scripts) no debe seguir abriendo puertas
  -- después de que la RPC haya terminado.
  perform set_config('aims.clasificacion_rpc', 'off', true);

  return query
    select q.id, q.version, q.content_hash, q.completed_at
      from public.aims_classification_questionnaires q
     where q.id = v_row.id;
end;
$fn$;

revoke all on function public.fn_aims_completar_cuestionario(uuid) from public, anon;
grant execute on function public.fn_aims_completar_cuestionario(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: registrar un sistema CON su clasificación, en una transacción. El
--    tenant sale de la sesión, nunca del cliente.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_registrar_sistema(p_sistema jsonb, p_cuestionario jsonb)
returns table (system_id uuid, cuestionario_id uuid, content_hash text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_system_id uuid;
  v_q_id uuid;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_sistema->>'name', ''))) < 3 then
    raise exception 'NOMBRE_OBLIGATORIO: el sistema necesita un nombre' using errcode = '23514';
  end if;

  perform set_config('aims.clasificacion_rpc', 'on', true);

  insert into public.ai_systems (
    tenant_id, name, system_type, vendor, deployment_date, status, use_case, description,
    owner_id, aims_reference_code, regulatory_role, risk_level
  ) values (
    v_tenant,
    trim(p_sistema->>'name'),
    nullif(trim(coalesce(p_sistema->>'system_type', '')), ''),
    nullif(trim(coalesce(p_sistema->>'vendor', '')), ''),
    nullif(trim(coalesce(p_sistema->>'deployment_date', '')), '')::date,
    coalesce(nullif(trim(coalesce(p_sistema->>'status', '')), ''), 'ACTIVO'),
    nullif(trim(coalesce(p_sistema->>'use_case', '')), ''),
    nullif(trim(coalesce(p_sistema->>'description', '')), ''),
    nullif(trim(coalesce(p_sistema->>'owner_id', '')), '')::uuid,
    nullif(trim(coalesce(p_sistema->>'aims_reference_code', '')), ''),
    p_cuestionario->>'computed_role',
    p_cuestionario->>'computed_risk_level'
  ) returning id into v_system_id;

  insert into public.aims_classification_questionnaires (
    tenant_id, system_id, status, questionnaire_version,
    phase1_responses, phase2_responses, phase2_art63_justification,
    computed_role, computed_risk_level, gpai_dependency, applicable_frameworks, catalog_profile,
    created_by
  ) values (
    v_tenant, v_system_id, 'DRAFT', coalesce(p_cuestionario->>'questionnaire_version', '1.1'),
    coalesce(p_cuestionario->'phase1_responses', '{}'::jsonb),
    coalesce(p_cuestionario->'phase2_responses', '{}'::jsonb),
    nullif(trim(coalesce(p_cuestionario->>'phase2_art63_justification', '')), ''),
    p_cuestionario->>'computed_role',
    p_cuestionario->>'computed_risk_level',
    coalesce((p_cuestionario->>'gpai_dependency')::boolean, false),
    coalesce(p_cuestionario->'applicable_frameworks', '[]'::jsonb),
    p_cuestionario->>'catalog_profile',
    auth.uid()
  ) returning id into v_q_id;

  -- Un solo camino de sellado: el mismo que la reclasificación desde la ficha.
  perform public.fn_aims_completar_cuestionario(v_q_id);
  perform set_config('aims.clasificacion_rpc', 'off', true);

  return query
    select v_system_id, q.id, q.content_hash
      from public.aims_classification_questionnaires q
     where q.id = v_q_id;
end;
$fn$;

revoke all on function public.fn_aims_registrar_sistema(jsonb, jsonb) from public, anon;
grant execute on function public.fn_aims_registrar_sistema(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Verificación que ABORTA la migración entera si algo no quedó cerrado, con
--    control positivo del propio instrumento.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_cols int;
  v_idx int;
  v_rls boolean;
  v_pol int;
  v_pol_delete int;
  v_grants_anon int;
  v_grants_auth_malos int;
  v_grants_auth_buenos int;
  v_trg int;
  v_fn int;
  v_instrumento int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema = 'public' and table_name = 'aims_classification_questionnaires';
  if v_cols <> 20 then
    raise exception 'VERIFICACION: columnas esperadas 20, encontradas %', v_cols;
  end if;

  select count(*) into v_idx from pg_indexes
   where schemaname = 'public' and tablename = 'aims_classification_questionnaires'
     and indexname in ('ux_aims_classification_completed_per_system',
                       'ux_aims_classification_draft_per_system',
                       'ix_aims_classification_tenant_system');
  if v_idx <> 3 then
    raise exception 'VERIFICACION: índices esperados 3, encontrados %', v_idx;
  end if;

  select c.relrowsecurity into v_rls from pg_class c
   where c.oid = 'public.aims_classification_questionnaires'::regclass;
  if not coalesce(v_rls, false) then
    raise exception 'VERIFICACION: RLS no habilitada';
  end if;

  select count(*), count(*) filter (where polcmd = 'd') into v_pol, v_pol_delete
    from pg_policy where polrelid = 'public.aims_classification_questionnaires'::regclass;
  if v_pol <> 3 or v_pol_delete <> 0 then
    raise exception 'VERIFICACION: políticas esperadas 3 sin DELETE; encontradas % (DELETE: %)', v_pol, v_pol_delete;
  end if;

  select count(*) into v_grants_anon from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_classification_questionnaires' and grantee = 'anon';
  if v_grants_anon <> 0 then
    raise exception 'VERIFICACION: anon conserva % privilegios', v_grants_anon;
  end if;

  select count(*) into v_grants_auth_malos from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_classification_questionnaires'
     and grantee = 'authenticated' and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if v_grants_auth_malos <> 0 then
    raise exception 'VERIFICACION: authenticated conserva % privilegios que no se conceden', v_grants_auth_malos;
  end if;

  select count(*) into v_grants_auth_buenos from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_classification_questionnaires'
     and grantee = 'authenticated' and privilege_type in ('SELECT', 'INSERT', 'UPDATE');
  if v_grants_auth_buenos <> 3 then
    raise exception 'VERIFICACION: authenticated debería tener SELECT, INSERT y UPDATE; tiene %', v_grants_auth_buenos;
  end if;

  select count(*) into v_trg from pg_trigger
   where not tgisinternal and tgname in (
     'trg_aims_cuestionario_version', 'trg_aims_cuestionario_inmutable',
     'trg_ai_systems_clasificacion_solo_por_cuestionario');
  if v_trg <> 3 then
    raise exception 'VERIFICACION: triggers esperados 3, encontrados %', v_trg;
  end if;

  select count(*) into v_fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and p.proname in ('fn_aims_completar_cuestionario', 'fn_aims_registrar_sistema');
  if v_fn <> 2 then
    raise exception 'VERIFICACION: RPC security definer esperadas 2, encontradas %', v_fn;
  end if;

  -- Control positivo: el instrumento tiene que saber decir que NO.
  select count(*) into v_instrumento from pg_constraint
   where conrelid = 'public.aims_classification_questionnaires'::regclass
     and conname = 'constraint_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: tabla (20 col), 3 índices, RLS, 3 políticas sin DELETE, anon fuera, 3 triggers, 2 RPC';
end;
$verificacion$;
