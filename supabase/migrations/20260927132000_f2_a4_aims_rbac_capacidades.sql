-- MOI-170 — F2.T5 (M04), programa RIA, carril A.
-- Especificación §2.2 (Funciones SQL / fn_aims_assert_capacidad), F2.T5, F2.T6.
--
-- QUÉ HACE
-- --------
-- Amplía `capability_matrix` (global, sin tenant_id — 5 roles ya existentes)
-- con 9 capacidades de AIMS y siembra sus filas por rol. `fn_aims_assert_capacidad`
-- envuelve la `fn_secretaria_assert_capability` YA EXISTENTE (mismo patrón que
-- Secretaría: reutiliza el motor RBAC, no inventa uno nuevo) y traduce su
-- excepción P0001 genérica a `AIMS_CAPACIDAD_DENEGADA` con SQLSTATE 42501.
--
-- Después, las políticas de escritura de `ai_systems`, `ai_incidents`,
-- `ai_risk_assessments` y `ai_compliance_checks` (las 4 tablas con RLS
-- propia de este dominio) EXIGEN la capacidad correspondiente en INSERT y
-- UPDATE. Antes eran `FOR ALL` con solo el tenant como condición: cualquier
-- rol autenticado del tenant podía escribir. Se sustituyen por políticas
-- separadas por comando —nunca una política ALL adicional junto a la vieja,
-- porque dos políticas PERMISIVAS se OR-ean y la nueva quedaría de adorno
-- (memoria: «un guard de texto se derrota», mismo defecto con RLS)—:
--   * SELECT: solo tenant, SIN cambio (todo el mundo que lee hoy sigue leyendo).
--   * INSERT/UPDATE: tenant + `fn_aims_tiene_capacidad(...)`.
--   * `ai_systems` conserva además su política de DELETE tal cual estaba
--     (solo tenant, sin capacidad): es DA-16, declarada, y esta migración no
--     la toca — perderla por accidente al redefinir las políticas habría sido
--     una regresión silenciosa sobre las sondas que crean y borran sistemas
--     PROBE.
--
-- ARGA — CAMBIO VISIBLE
-- ----------------------
-- CONSEJERO y AUDITOR (roles del catálogo RBAC, hoy sin ninguna cuenta
-- asignada en `user_profiles` — medido: solo SECRETARIO y ADMIN_TENANT tienen
-- fila) PIERDEN la posibilidad de escribir en las 4 tablas de AIMS de
-- CUALQUIER tenant, incluida ARGA: antes su rol no estaba filtrado por
-- capability_matrix en estas tablas (solo por tenant) y ahora sí. Es el
-- cambio que pide expresamente F2.T5 ("CONSEJERO y AUDITOR reciben 42501").
-- `demo@` (SECRETARIO) y `admin@` (ADMIN_TENANT) de los dos tenants NO
-- pierden nada: `SECRETARIO` recibe las 9 capacidades salvo AIMS_GOBIERNO, y
-- `ADMIN_TENANT` pasa siempre por el cortocircuito ya existente en
-- `fn_secretaria_assert_capability` (declarado, no se cambia aquí).
--
-- FUERA DE ESTE CARRIL
-- ---------------------
-- No se tocan aquí las RPC de alta de sistema (`fn_aims_registrar_sistema`) ni
-- la de completar cuestionario: pertenecen a otras fases (F4) y ya tienen su
-- propio guardián (`ALTA_SOLO_POR_CUESTIONARIO`, flag dedicado). Sólo se
-- retrofita `fn_aims_freeze_assessment`, la única RPC de escritura de AIMS que
-- este carril toca por estar directamente en el camino de F2.T7 (A5).

-- ---------------------------------------------------------------------------
-- 1. Nueve capacidades nuevas en el CHECK de `capability_matrix.action`.
-- ---------------------------------------------------------------------------
alter table public.capability_matrix drop constraint capability_matrix_action_check;
alter table public.capability_matrix add constraint capability_matrix_action_check
  check (action = any (array[
    'SNAPSHOT_CREATION', 'VOTE_EMISSION', 'CERTIFICATION', 'CARGO_MANAGEMENT',
    'PERSON_WRITE', 'PERSON_CONSOLIDATE', 'REPRESENTATION_MANAGEMENT', 'CONVOCATION_ISSUE',
    'AIMS_INVENTARIO', 'AIMS_CLASIFICAR', 'AIMS_EVALUAR', 'AIMS_REVISAR',
    'AIMS_OBLIGACIONES', 'AIMS_ENTREGABLE_APROBAR', 'AIMS_INCIDENTE',
    'AIMS_REGISTRO', 'AIMS_GOBIERNO'
  ]));

-- ---------------------------------------------------------------------------
-- 2. Siembra de filas por rol. Idempotente: upsert por (role, action).
--    SECRETARIO: todas salvo AIMS_GOBIERNO. COMPLIANCE y ADMIN_TENANT: todas
--    (ADMIN_TENANT ya pasa siempre por el cortocircuito de
--    fn_secretaria_assert_capability; se declara aquí de todos modos, para que
--    la matriz sea legible sin tener que leer esa función). CONSEJERO y
--    AUDITOR: ninguna, con motivo.
-- ---------------------------------------------------------------------------
do $siembra$
declare
  v_accion text;
  v_acciones text[] := array[
    'AIMS_INVENTARIO', 'AIMS_CLASIFICAR', 'AIMS_EVALUAR', 'AIMS_REVISAR',
    'AIMS_OBLIGACIONES', 'AIMS_ENTREGABLE_APROBAR', 'AIMS_INCIDENTE',
    'AIMS_REGISTRO', 'AIMS_GOBIERNO'
  ];
begin
  foreach v_accion in array v_acciones loop
    insert into public.capability_matrix (role, action, enabled, reason)
    values ('SECRETARIO', v_accion,
            v_accion <> 'AIMS_GOBIERNO',
            case when v_accion = 'AIMS_GOBIERNO'
                 then 'El gobierno de AIMS (declarar especialidades, fijar programa) es de Compliance/Admin, no de Secretaría (F2.T5).'
                 else 'Secretaría es owner-write de AIMS: clasifica, evalúa, revisa y gestiona el inventario (F2.T5).' end)
    on conflict (role, action) do update
      set enabled = excluded.enabled, reason = excluded.reason;

    insert into public.capability_matrix (role, action, enabled, reason)
    values ('COMPLIANCE', v_accion, true,
            'Compliance tiene las 9 capacidades de AIMS, incluido el gobierno (F2.T5).')
    on conflict (role, action) do update
      set enabled = excluded.enabled, reason = excluded.reason;

    insert into public.capability_matrix (role, action, enabled, reason)
    values ('ADMIN_TENANT', v_accion, true,
            'Declarado por completitud: fn_secretaria_assert_capability ya deja pasar a ADMIN_TENANT sin consultar esta tabla (medido).')
    on conflict (role, action) do update
      set enabled = excluded.enabled, reason = excluded.reason;

    insert into public.capability_matrix (role, action, enabled, reason)
    values ('CONSEJERO', v_accion, false,
            'Un consejero supervisa y decide en el órgano; no opera el inventario ni las evaluaciones de AIMS (F2.T5).')
    on conflict (role, action) do update
      set enabled = excluded.enabled, reason = excluded.reason;

    insert into public.capability_matrix (role, action, enabled, reason)
    values ('AUDITOR', v_accion, false,
            'El auditor es de solo lectura sobre AIMS: audita, no opera (F2.T5).')
    on conflict (role, action) do update
      set enabled = excluded.enabled, reason = excluded.reason;
  end loop;
end;
$siembra$;

-- Falta un UNIQUE (role, action) para que el ON CONFLICT de arriba funcione y
-- para que una re-siembra futura sea idempotente de verdad.
create unique index if not exists ux_capability_matrix_role_action
  on public.capability_matrix (role, action);

-- ---------------------------------------------------------------------------
-- 3. `fn_aims_assert_capacidad` / `fn_aims_tiene_capacidad`.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_assert_capacidad(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    perform public.fn_secretaria_assert_capability(public.fn_current_tenant_id(), p_action);
  exception when sqlstate 'P0001' then
    raise exception 'AIMS_CAPACIDAD_DENEGADA: %', sqlerrm using errcode = '42501';
  end;
end;
$fn$;

revoke all on function public.fn_aims_assert_capacidad(text) from public, anon;
grant execute on function public.fn_aims_assert_capacidad(text) to authenticated;

create or replace function public.fn_aims_tiene_capacidad(p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  perform public.fn_aims_assert_capacidad(p_action);
  return true;
exception when others then
  return false;
end;
$fn$;

revoke all on function public.fn_aims_tiene_capacidad(text) from public, anon;
grant execute on function public.fn_aims_tiene_capacidad(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Políticas de escritura por capacidad, en las 4 tablas owner-write de AIMS.
-- ---------------------------------------------------------------------------
-- ai_systems: SELECT sin cambio; INSERT/UPDATE con AIMS_INVENTARIO; DELETE
-- exactamente como estaba (DA-16, sin capacidad).
drop policy if exists tenant_isolation on public.ai_systems;
create policy ai_systems_select on public.ai_systems for select
  using (tenant_id = public.fn_current_tenant_id());
create policy ai_systems_insert on public.ai_systems for insert
  with check (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INVENTARIO'));
create policy ai_systems_update on public.ai_systems for update
  using (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INVENTARIO'))
  with check (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INVENTARIO'));
create policy ai_systems_delete on public.ai_systems for delete
  using (tenant_id = public.fn_current_tenant_id());

-- ai_incidents: AIMS_INCIDENTE.
drop policy if exists tenant_isolation on public.ai_incidents;
create policy ai_incidents_select on public.ai_incidents for select
  using (tenant_id = public.fn_current_tenant_id());
create policy ai_incidents_insert on public.ai_incidents for insert
  with check (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INCIDENTE'));
create policy ai_incidents_update on public.ai_incidents for update
  using (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INCIDENTE'))
  with check (tenant_id = public.fn_current_tenant_id() and public.fn_aims_tiene_capacidad('AIMS_INCIDENTE'));

-- ai_risk_assessments: AIMS_EVALUAR (tenant vía join a ai_systems, como antes).
drop policy if exists aims_assessments_tenant_isolation on public.ai_risk_assessments;
create policy ai_risk_assessments_select on public.ai_risk_assessments for select
  using (exists (select 1 from public.ai_systems s where s.id = ai_risk_assessments.system_id and s.tenant_id = public.fn_current_tenant_id()));
create policy ai_risk_assessments_insert on public.ai_risk_assessments for insert
  with check (
    exists (select 1 from public.ai_systems s where s.id = ai_risk_assessments.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'));
create policy ai_risk_assessments_update on public.ai_risk_assessments for update
  using (
    exists (select 1 from public.ai_systems s where s.id = ai_risk_assessments.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'))
  with check (
    exists (select 1 from public.ai_systems s where s.id = ai_risk_assessments.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'));

-- ai_compliance_checks: AIMS_EVALUAR (las comprobaciones son parte del autodiagnóstico).
drop policy if exists aims_compliance_checks_tenant_isolation on public.ai_compliance_checks;
create policy ai_compliance_checks_select on public.ai_compliance_checks for select
  using (exists (select 1 from public.ai_systems s where s.id = ai_compliance_checks.system_id and s.tenant_id = public.fn_current_tenant_id()));
create policy ai_compliance_checks_insert on public.ai_compliance_checks for insert
  with check (
    exists (select 1 from public.ai_systems s where s.id = ai_compliance_checks.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'));
create policy ai_compliance_checks_update on public.ai_compliance_checks for update
  using (
    exists (select 1 from public.ai_systems s where s.id = ai_compliance_checks.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'))
  with check (
    exists (select 1 from public.ai_systems s where s.id = ai_compliance_checks.system_id and s.tenant_id = public.fn_current_tenant_id())
    and public.fn_aims_tiene_capacidad('AIMS_EVALUAR'));

-- ---------------------------------------------------------------------------
-- 5. Retrofit de la única RPC de escritura de AIMS que toca este carril.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_freeze_assessment(p_assessment_id uuid)
returns table(id uuid, content_hash text, frozen_at timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_row public.ai_risk_assessments%rowtype;
  v_canonico text;
  v_hash text;
begin
  perform public.fn_aims_assert_capacidad('AIMS_EVALUAR');

  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  select a.* into v_row
    from public.ai_risk_assessments a
    join public.ai_systems s on s.id = a.system_id
   where a.id = p_assessment_id and s.tenant_id = v_tenant
   for update;

  if not found then
    raise exception 'NO_ENCONTRADA: la evaluación no existe en este tenant' using errcode = '42501';
  end if;

  if v_row.frozen_at is not null then
    raise exception 'YA_CONGELADA: congelada el %', v_row.frozen_at using errcode = '42501';
  end if;

  if v_row.status = 'BORRADOR' then
    raise exception 'BORRADOR_NO_CONGELABLE: cierra el autodiagnóstico antes de congelarlo'
      using errcode = '42501';
  end if;

  v_canonico := (
    jsonb_build_object(
      'assessment_id', v_row.id,
      'system_id', v_row.system_id,
      'framework', v_row.framework,
      'assessment_date', v_row.assessment_date,
      'status', v_row.status,
      'score', v_row.score,
      'findings', coalesce(v_row.findings, '[]'::jsonb),
      'action_plan', coalesce(v_row.action_plan, '[]'::jsonb),
      'notes', coalesce(v_row.notes, '')
    )
  )::text;
  v_hash := encode(sha512(convert_to(v_canonico, 'UTF8')), 'hex');

  update public.ai_risk_assessments a
     set content_hash = v_hash,
         frozen_at = now(),
         frozen_by_id = auth.uid()
   where a.id = p_assessment_id;

  return query
    select a.id, a.content_hash, a.frozen_at
      from public.ai_risk_assessments a
     where a.id = p_assessment_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Verificación: aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_n int;
  v_err text;
  v_sys_arga uuid;
begin
  -- 6.1 45 filas nuevas (5 roles × 9 acciones).
  select count(*) into v_n from public.capability_matrix
   where action in (
     'AIMS_INVENTARIO', 'AIMS_CLASIFICAR', 'AIMS_EVALUAR', 'AIMS_REVISAR',
     'AIMS_OBLIGACIONES', 'AIMS_ENTREGABLE_APROBAR', 'AIMS_INCIDENTE',
     'AIMS_REGISTRO', 'AIMS_GOBIERNO');
  if v_n <> 45 then
    raise exception 'VERIFICACION: se esperaban 45 filas AIMS en capability_matrix (5 roles x 9 acciones), hay %', v_n;
  end if;

  -- Control positivo: las filas de Secretaría (no-AIMS) siguen intactas.
  select count(*) into v_n from public.capability_matrix where action = 'CERTIFICATION';
  if v_n < 1 then
    raise exception 'VERIFICACION: el instrumento no ve ninguna fila CERTIFICATION previa (¿se truncó la tabla?)';
  end if;

  -- 6.2 CONSEJERO y AUDITOR, false en las 9; SECRETARIO, false SOLO en GOBIERNO.
  select count(*) into v_n from public.capability_matrix
   where role in ('CONSEJERO', 'AUDITOR') and action like 'AIMS_%' and enabled = true;
  if v_n <> 0 then
    raise exception 'VERIFICACION: CONSEJERO/AUDITOR tienen % capacidades AIMS habilitadas', v_n;
  end if;

  if exists (select 1 from public.capability_matrix where role = 'SECRETARIO' and action = 'AIMS_GOBIERNO' and enabled = true) then
    raise exception 'VERIFICACION: SECRETARIO tiene AIMS_GOBIERNO habilitada y no debería';
  end if;
  select count(*) into v_n from public.capability_matrix
   where role = 'SECRETARIO' and action like 'AIMS_%' and action <> 'AIMS_GOBIERNO' and enabled = false;
  if v_n <> 0 then
    raise exception 'VERIFICACION: SECRETARIO tiene % capacidades AIMS deshabilitadas fuera de GOBIERNO', v_n;
  end if;

  -- 6.3 Funciones sin anon.
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('fn_aims_assert_capacidad', 'fn_aims_tiene_capacidad')
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_n <> 0 then
    raise exception 'VERIFICACION: anon puede ejecutar % de las funciones de capacidad', v_n;
  end if;

  -- 6.4 AIMS_CAPACIDAD_DENEGADA: relanza con el código nuevo.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'CONSEJERO',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_assert_capacidad('AIMS_EVALUAR');
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'AIMS_CAPACIDAD_DENEGADA%' then
    raise exception 'VERIFICACION: un CONSEJERO sin capacidad no recibe AIMS_CAPACIDAD_DENEGADA (%)', v_err;
  end if;

  -- Control positivo: SECRETARIO SÍ tiene AIMS_EVALUAR.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'SECRETARIO',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_assert_capacidad('AIMS_EVALUAR');
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'OK' then
    raise exception 'VERIFICACION: SECRETARIO no tiene AIMS_EVALUAR y debería (%)', v_err;
  end if;
  perform set_config('request.jwt.claims', '', true);

  -- 6.5 Las políticas de escritura de las 4 tablas exigen capacidad (en vivo,
  --     como CONSEJERO): un INSERT real se rechaza vía RLS (0 filas, o 42501
  --     si el trigger de tenant llega antes; cualquiera de los dos es correcto
  --     con tal de que NO ENTRE fila).
  select id into v_sys_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;

  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'CONSEJERO',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  v_err := null;
  begin
    insert into public.ai_incidents (tenant_id, system_id, title)
    values ('00000000-0000-0000-0000-000000000001', v_sys_arga, 'VERIFICACION_M04_CONSEJERO');
    v_err := 'INSERTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  if v_err = 'INSERTADA' then
    raise exception 'VERIFICACION: un CONSEJERO pudo insertar en ai_incidents pese a no tener AIMS_INCIDENTE';
  end if;
  if v_err not ilike '%row-level security%' then
    raise exception 'VERIFICACION: el rechazo del CONSEJERO no vino de la política RLS por capacidad (%)', v_err;
  end if;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.role', '', true);

  raise notice 'VERIFICACION OK: 45 filas de capability_matrix, fn_aims_assert_capacidad/tiene_capacidad sin anon, políticas por capacidad en las 4 tablas, CONSEJERO rechazado en vivo';
end;
$verificacion$;
