-- M01 — Enlaces de comprobaciones y evaluación.
-- Programa de cobertura RIA, tarea F1.T14; enmiendas vinculantes E-01 y E-02.
--
-- QUÉ CAMBIA
-- ----------
-- * `ai_compliance_checks.assessment_id` → `ai_risk_assessments(id)`, anulable,
--   ON DELETE RESTRICT. Una comprobación sabe de qué autodiagnóstico sale: sin
--   eso, una evaluación en BORRADOR y una revisada son indistinguibles en la
--   tabla, y la más reciente tapa a la otra aunque no acredite nada.
-- * `ai_risk_assessments.questionnaire_id` → `aims_classification_questionnaires(id)`,
--   anulable, ON DELETE RESTRICT. Contra qué clasificación se midió. Todavía no
--   la escribe ninguna pantalla (la conecta F4); nace con su integridad puesta.
-- * `ai_compliance_checks.checked_by_id` (ya existía, FK a `persons`): la
--   autoría la pone el SERVIDOR.
--
-- LAS LEGACY QUEDAN NULL
-- ----------------------
-- Medido el 2026-09-19: 61 comprobaciones y 8 evaluaciones en los dos tenants,
-- ninguna con enlace. No se rellenan: no hay forma honesta de saber de qué
-- evaluación salió cada comprobación histórica, y una sesión tampoco puede
-- rellenarlas después (el trigger lo impide). Una comprobación sin evaluación es
-- legado y no acredita.
--
-- POR QUÉ NO `SET DEFAULT auth.uid()` (E-01)
-- -----------------------------------------
-- `checked_by_id` es FK a `persons`, y `auth.uid()` es un usuario de Auth, no una
-- persona (medido: ninguna de las 4 cuentas de `auth.users` es una fila de
-- `persons`). Con ese DEFAULT, todo INSERT que omitiera la columna —el del
-- wizard la omite— fallaría por la FK: ninguna evaluación se habría podido
-- guardar en ninguno de los dos tenants. La persona se resuelve del perfil de la
-- sesión, `user_profiles.person_id` del usuario en su tenant, y sin persona se
-- rechaza con PERFIL_SIN_PERSONA (42501).
--
-- Medido antes de escribir esto (SELECT, 2026-09-19): las 3 cuentas con perfil
-- tienen persona de su propio tenant —demo@ ARGA → Lucía Paredes Vega;
-- demo@ Garrigues → Isabel Redel; admin@ Garrigues → Alejandro Padín Vidal—. La
-- 4ª cuenta de Auth no tiene perfil y no puede entrar en la aplicación.
--
-- LO QUE MANDA EL CLIENTE NO CUENTA
-- ---------------------------------
-- El trigger PISA `checked_by_id` con la persona de la sesión: aceptar el que
-- llega sería dejar que cualquiera firme por otro. Y en UPDATE, para una sesión,
-- la autoría, el enlace y el sistema de una comprobación son inmutables (hay
-- grant de UPDATE y ningún camino de la aplicación lo usa).
--
-- SIN SESIÓN (service_role, migraciones, scripts de mantenimiento)
-- ----------------------------------------------------------------
-- No hay usuario del que resolver persona: se respeta lo que se escribe.
-- `scripts/consolidate-duplicate-persons.ts` reapunta `checked_by_id` al fusionar
-- personas duplicadas, y ese camino tiene que seguir funcionando. Esos roles ya
-- saltan la RLS: este trigger no es su frontera. La coherencia del enlace sí se
-- exige a todos.
--
-- EL ENLACE NO CRUZA SISTEMAS NI TENANTS
-- --------------------------------------
-- Una FK no pasa por la RLS: sin comprobarlo, una comprobación podría apuntar a
-- la evaluación de otro sistema —o de otro tenant—. El trigger exige que la
-- evaluación sea del MISMO sistema que la comprobación, y la RLS de la tabla ya
-- exige que ese sistema sea del tenant de la sesión. Igual para el cuestionario
-- de una evaluación, que además no cambia una vez congelada.
--
-- UNA EVALUACIÓN CONGELADA NO SE TOCA POR SUS COMPROBACIONES
-- ----------------------------------------------------------
-- Congelar fija la fila de la evaluación, pero sus comprobaciones viven en otra
-- tabla con grant de INSERT y UPDATE. Sin esto, una sesión anexaría por
-- PostgREST un CONFORME a una evaluación ya congelada, o corregiría el estado de
-- una suya, y el resultado vigente de lo «que no se toca» cambiaría sin que
-- cambiara la fila congelada: el enlace dejaría de acreditar que la comprobación
-- salió con esa evaluación. Por eso ni se enlaza una comprobación a una
-- congelada (alta o cambio de enlace, para todos), ni cambia una comprobación
-- de una congelada. La única excepción es reapuntar la autoría SIN sesión, que
-- es la consolidación de personas duplicadas. El wizard no lo nota: inserta las
-- comprobaciones al cerrar, y la congelación llega después, por RPC.
--
-- SECUENCIA (patrón E-05)
-- -----------------------
-- Producción y desarrollo comparten `governance_OS`. Esta migración es
-- compatible con el cliente desplegado hoy (no envía `assessment_id` y el
-- trigger le pone la autoría). El cliente nuevo SÍ necesita la columna: se
-- aplica esto ANTES de desplegar el cliente de F1.T14.
--
-- Sin cambio de dato: 0 filas tocadas en ARGA y en Garrigues. Sin grants nuevos.

alter table public.ai_compliance_checks
  add column if not exists assessment_id uuid
    constraint ai_compliance_checks_assessment_id_fkey
    references public.ai_risk_assessments(id) on delete restrict;

alter table public.ai_risk_assessments
  add column if not exists questionnaire_id uuid
    constraint ai_risk_assessments_questionnaire_id_fkey
    references public.aims_classification_questionnaires(id) on delete restrict;

comment on column public.ai_compliance_checks.assessment_id is
  'Autodiagnóstico del que sale la comprobación. NULL en las filas anteriores a 2026-09-19: legado, no acredita.';
comment on column public.ai_compliance_checks.checked_by_id is
  'Persona (persons.id) que registró la comprobación. La resuelve el servidor desde user_profiles.person_id de la sesión; lo que envíe el cliente se ignora.';
comment on column public.ai_risk_assessments.questionnaire_id is
  'Cuestionario de clasificación contra el que se midió la evaluación. Del mismo sistema; inmutable una vez congelada.';

-- ---------------------------------------------------------------------------
-- 1. Autoría y enlace de cada comprobación.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_comprobacion_autoria_y_enlace()
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
       and (new.checked_by_id is distinct from old.checked_by_id
            or new.assessment_id is distinct from old.assessment_id
            or new.system_id is distinct from old.system_id) then
      raise exception 'COMPROBACION_INMUTABLE: la autoría, la evaluación y el sistema de la comprobación % no se cambian', old.id
        using errcode = '42501';
    end if;
    -- Por fila entera (jsonb) y no por columnas enumeradas: una columna futura
    -- queda cubierta sin tocar esto. Solo la autoría puede cambiar, y sin
    -- sesión (la de arriba ya la cierra para una sesión).
    if exists (select 1 from public.ai_risk_assessments a
                where a.id = old.assessment_id and a.frozen_at is not null)
       and (to_jsonb(new) - 'checked_by_id') is distinct from (to_jsonb(old) - 'checked_by_id') then
      raise exception 'EVALUACION_CONGELADA: la comprobación % es de una evaluación congelada; no cambia', old.id
        using errcode = '42501';
    end if;
  elsif auth.uid() is not null then
    select up.person_id into v_persona
      from public.user_profiles up
     where up.user_id = auth.uid()
       and up.tenant_id = public.fn_current_tenant_id();
    if v_persona is null then
      raise exception 'PERFIL_SIN_PERSONA: la cuenta de la sesión no está enlazada a una persona de su entorno; la comprobación no tendría autor'
        using errcode = '42501';
    end if;
    new.checked_by_id := v_persona;
  end if;

  if new.assessment_id is not null and not exists (
    select 1
      from public.ai_risk_assessments a
     where a.id = new.assessment_id and a.system_id = new.system_id
  ) then
    raise exception 'EVALUACION_DE_OTRO_SISTEMA: la evaluación % no es del sistema de la comprobación', new.assessment_id
      using errcode = '42501';
  end if;

  -- En INSERT, OLD es NULL (PostgreSQL ≥ 11): cuenta como enlace nuevo.
  if new.assessment_id is not null
     and (tg_op = 'INSERT' or new.assessment_id is distinct from old.assessment_id)
     and exists (select 1 from public.ai_risk_assessments a
                  where a.id = new.assessment_id and a.frozen_at is not null) then
    raise exception 'EVALUACION_CONGELADA: la evaluación % está congelada; no admite comprobaciones nuevas', new.assessment_id
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke all on function public.fn_aims_comprobacion_autoria_y_enlace() from public, anon;

drop trigger if exists trg_aims_comprobacion_autoria_y_enlace on public.ai_compliance_checks;
create trigger trg_aims_comprobacion_autoria_y_enlace
  before insert or update on public.ai_compliance_checks
  for each row execute function public.fn_aims_comprobacion_autoria_y_enlace();

-- ---------------------------------------------------------------------------
-- 2. Cuestionario de la evaluación: del mismo sistema, e inmutable congelada.
--    El guard de congelación existente enumera columnas y no conoce esta; se
--    añade aquí en vez de reescribir aquel.
-- ---------------------------------------------------------------------------
create or replace function public.fn_aims_evaluacion_enlace_cuestionario()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.frozen_at is not null and new.questionnaire_id is distinct from old.questionnaire_id then
      raise exception 'EVALUACION_CONGELADA: la evaluación % está congelada desde %; su cuestionario no cambia', old.id, old.frozen_at
        using errcode = '42501';
    end if;
  end if;

  if new.questionnaire_id is not null and not exists (
    select 1
      from public.aims_classification_questionnaires q
     where q.id = new.questionnaire_id and q.system_id = new.system_id
  ) then
    raise exception 'CUESTIONARIO_DE_OTRO_SISTEMA: el cuestionario % no es del sistema evaluado', new.questionnaire_id
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke all on function public.fn_aims_evaluacion_enlace_cuestionario() from public, anon;

drop trigger if exists trg_aims_evaluacion_enlace_cuestionario on public.ai_risk_assessments;
create trigger trg_aims_evaluacion_enlace_cuestionario
  before insert or update on public.ai_risk_assessments
  for each row execute function public.fn_aims_evaluacion_enlace_cuestionario();

-- ---------------------------------------------------------------------------
-- 3. Verificación: aborta la migración entera si algo no quedó como se dice.
--    Las sondas de comportamiento escriben dentro de subtransacciones que se
--    revierten siempre (SONDA_REVERTIDA / SONDA_ACEPTADA): no dejan fila.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_n int;
  v_err text;
  v_err2 text;
  v_err3 text;
  v_eval uuid;
  v_eval_otra uuid;
  v_sys_otro uuid;
  v_sys uuid;
  v_tenant uuid;
  v_user uuid;
  v_persona uuid;
  v_otra uuid;
  v_check uuid;
  v_quien uuid;
  v_enlazada uuid;
  v_sys_q uuid;
  v_tenant_q uuid;
  v_q uuid;
  v_a uuid;
  v_c uuid;
  v_err4 text;
  v_err5 text;
  v_err6 text;
  v_n_corr int;
  v_n_mant int;
begin
  -- 3.1 Estructura: las dos FK nuevas, con RESTRICT (E-02).
  select count(*) into v_n from pg_constraint
   where contype = 'f' and confdeltype = 'r'
     and ((conrelid = 'public.ai_compliance_checks'::regclass
           and conname = 'ai_compliance_checks_assessment_id_fkey'
           and confrelid = 'public.ai_risk_assessments'::regclass)
       or (conrelid = 'public.ai_risk_assessments'::regclass
           and conname = 'ai_risk_assessments_questionnaire_id_fkey'
           and confrelid = 'public.aims_classification_questionnaires'::regclass));
  if v_n <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 FK nuevas con ON DELETE RESTRICT, hay %', v_n;
  end if;

  -- Control positivo del instrumento: ve la FK previa de la autoría a persons.
  select count(*) into v_n from pg_constraint
   where conrelid = 'public.ai_compliance_checks'::regclass
     and conname = 'ai_compliance_checks_checked_by_id_fkey'
     and confrelid = 'public.persons'::regclass;
  if v_n <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve checked_by_id → persons';
  end if;

  -- 3.2 Ni un DEFAULT en las columnas de persona (E-01).
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public'
     and ((table_name = 'ai_compliance_checks' and column_name = 'checked_by_id')
       or (table_name = 'ai_risk_assessments' and column_name = 'assessor_id'))
     and column_default is not null;
  if v_n <> 0 then
    raise exception 'VERIFICACION: % columnas FK a persons tienen DEFAULT', v_n;
  end if;

  -- Control positivo: el instrumento ve un DEFAULT que sí existe.
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_compliance_checks'
     and column_name = 'status' and column_default is not null;
  if v_n <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve el DEFAULT de ai_compliance_checks.status';
  end if;

  -- 3.3 Triggers y funciones, sin anon.
  select count(*) into v_n from pg_trigger
   where not tgisinternal
     and ((tgrelid = 'public.ai_compliance_checks'::regclass and tgname = 'trg_aims_comprobacion_autoria_y_enlace')
       or (tgrelid = 'public.ai_risk_assessments'::regclass and tgname = 'trg_aims_evaluacion_enlace_cuestionario'));
  if v_n <> 2 then
    raise exception 'VERIFICACION: triggers esperados 2, encontrados %', v_n;
  end if;

  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('fn_aims_comprobacion_autoria_y_enlace', 'fn_aims_evaluacion_enlace_cuestionario')
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_n <> 0 then
    raise exception 'VERIFICACION: anon puede ejecutar % de las funciones nuevas', v_n;
  end if;

  -- 3.4 Privilegios de las tablas intactos: ni DELETE ni TRUNCATE, e INSERT sigue.
  select count(*) into v_n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and table_name in ('ai_compliance_checks', 'ai_risk_assessments')
     and privilege_type in ('DELETE', 'TRUNCATE');
  if v_n <> 0 then
    raise exception 'VERIFICACION: % privilegios de DELETE/TRUNCATE sobre las dos tablas', v_n;
  end if;

  select count(*) into v_n from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name in ('ai_compliance_checks', 'ai_risk_assessments')
     and privilege_type = 'INSERT';
  if v_n <> 2 then
    raise exception 'VERIFICACION: authenticated debe conservar INSERT en las dos tablas; el instrumento ve %', v_n;
  end if;

  -- 3.5 Sujeto de las sondas: una evaluación real SIN CONGELAR (a una congelada
  --     no se le anexan comprobaciones, 3.13), su sistema, y una cuenta de su
  --     tenant enlazada a persona. Sin sujeto, las sondas no probarían nada.
  select a.id, a.system_id, s.tenant_id into v_eval, v_sys, v_tenant
    from public.ai_risk_assessments a
    join public.ai_systems s on s.id = a.system_id
   where a.frozen_at is null
     and exists (select 1 from public.user_profiles up
                  where up.tenant_id = s.tenant_id and up.person_id is not null)
   order by a.created_at
   limit 1;
  if v_eval is null then
    raise exception 'VERIFICACION: ninguna evaluación sin congelar tiene una cuenta enlazada en su tenant; las sondas no tendrían sujeto';
  end if;

  select up.user_id, up.person_id into v_user, v_persona
    from public.user_profiles up
   where up.tenant_id = v_tenant and up.person_id is not null
   order by up.created_at
   limit 1;

  select p.id into v_otra from public.persons p
   where p.tenant_id = v_tenant and p.id <> v_persona
   order by p.id
   limit 1;
  if v_otra is null then
    raise exception 'VERIFICACION: no hay otra persona en el tenant con la que intentar suplantar la autoría';
  end if;

  -- Una cuya autoría NO sea ya `v_otra`: si coincidiera, el UPDATE no cambiaría
  -- nada y la sonda de inmutabilidad pasaría sin probar.
  select c.id into v_check from public.ai_compliance_checks c
   where c.checked_by_id is distinct from v_otra
   order by c.created_at
   limit 1;
  if v_check is null then
    raise exception 'VERIFICACION: no hay comprobaciones sobre las que probar la inmutabilidad';
  end if;

  -- 3.6 Sin persona: una sesión cuyo usuario no tiene perfil se rechaza.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    insert into public.ai_compliance_checks (system_id, requirement_code, status)
    values (v_sys, 'VERIFICACION_M01', 'PENDIENTE');
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'PERFIL_SIN_PERSONA%' then
    raise exception 'VERIFICACION: sin persona no se rechaza (%)', v_err;
  end if;

  -- 3.7 Positivo: la autoría es la persona de la sesión aunque se mande otra, y
  --     el enlace a una evaluación del mismo sistema entra.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  begin
    insert into public.ai_compliance_checks (system_id, requirement_code, status, checked_by_id, assessment_id)
    values (v_sys, 'VERIFICACION_M01', 'PENDIENTE', v_otra, v_eval)
    returning checked_by_id, assessment_id into v_quien, v_enlazada;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: la comprobación legítima se rechazó (%)', v_err;
  end if;
  if v_quien is distinct from v_persona or v_enlazada is distinct from v_eval then
    raise exception 'VERIFICACION: autoría % (esperada la persona de la sesión, %), enlace %', v_quien, v_persona, v_enlazada;
  end if;

  -- 3.8 Enlace a una evaluación REAL de otro sistema. Un uuid inexistente no
  --     bastaría: también lo rechazaría un trigger que olvidara comparar el
  --     sistema.
  select a.id into v_eval_otra from public.ai_risk_assessments a
   where a.system_id <> v_sys
   order by a.created_at
   limit 1;
  if v_eval_otra is null then
    raise exception 'VERIFICACION: no hay evaluación de otro sistema con la que probar el enlace cruzado';
  end if;
  begin
    insert into public.ai_compliance_checks (system_id, requirement_code, status, assessment_id)
    values (v_sys, 'VERIFICACION_M01', 'PENDIENTE', v_eval_otra);
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'EVALUACION_DE_OTRO_SISTEMA%' then
    raise exception 'VERIFICACION: un enlace ajeno no se rechaza (%)', v_err;
  end if;

  -- 3.9 Una sesión no reescribe la autoría de una comprobación existente.
  begin
    update public.ai_compliance_checks set checked_by_id = v_otra where id = v_check;
    raise exception 'SONDA_ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'COMPROBACION_INMUTABLE%' then
    raise exception 'VERIFICACION: una sesión reescribe la autoría (%)', v_err;
  end if;

  -- 3.10 Control positivo del camino de mantenimiento: sin sesión, el mismo
  --      UPDATE entra (consolidación de personas duplicadas).
  perform set_config('request.jwt.claims', '', true);
  v_n := 0;
  begin
    update public.ai_compliance_checks set checked_by_id = v_otra where id = v_check;
    get diagnostics v_n = row_count;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' or v_n <> 1 then
    raise exception 'VERIFICACION: el camino de mantenimiento quedó bloqueado (% / % filas)', v_err, v_n;
  end if;

  -- 3.11 y 3.12 sobre un cuestionario de prueba, creado y revertido aquí.
  --  3.11 El cuestionario de un sistema en la evaluación de OTRO: rechazado.
  --  3.12 Positivo: del mismo sistema, la evaluación entra enlazada; y
  --       congelada, su cuestionario ya no cambia.
  --  3.13 Sin congelar, una comprobación enlazada entra y se corrige (positivo,
  --       con sesión); congelada, ni entra otra ni se corrige esa.
  --  3.14 Congelada, reapuntar la autoría sin sesión sigue entrando
  --       (consolidación de personas duplicadas); pero ni sin sesión se
  --       enlaza a ella una comprobación que no lo estaba.
  select s.id, s.tenant_id into v_sys_q, v_tenant_q
    from public.ai_systems s
   where not exists (select 1 from public.aims_classification_questionnaires q
                      where q.system_id = s.id and q.status = 'DRAFT')
   order by s.created_at
   limit 1;
  select s.id into v_sys_otro from public.ai_systems s
   where s.id <> v_sys_q
   order by s.created_at
   limit 1;
  if v_sys_q is null or v_sys_otro is null then
    raise exception 'VERIFICACION: no hay dos sistemas con los que probar el enlace al cuestionario';
  end if;
  v_enlazada := null;
  v_err2 := null;
  v_err3 := null;
  v_c := null;
  v_n_corr := 0;
  v_n_mant := 0;
  begin
    insert into public.aims_classification_questionnaires (tenant_id, system_id, questionnaire_version)
    values (v_tenant_q, v_sys_q, 'VERIFICACION_M01')
    returning id into v_q;
    begin
      insert into public.ai_risk_assessments (system_id, framework, status, questionnaire_id)
      values (v_sys_otro, 'EU_AI_ACT', 'BORRADOR', v_q);
      v_err3 := 'ACEPTADA';
    exception when others then
      v_err3 := sqlerrm;
    end;
    insert into public.ai_risk_assessments (system_id, framework, status, questionnaire_id)
    values (v_sys_q, 'EU_AI_ACT', 'BORRADOR', v_q)
    returning id, questionnaire_id into v_a, v_enlazada;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    insert into public.ai_compliance_checks (system_id, requirement_code, status, assessment_id)
    values (v_sys_q, 'VERIFICACION_M01', 'PENDIENTE', v_a)
    returning id into v_c;
    update public.ai_compliance_checks set status = 'NO_CONFORME' where id = v_c;
    get diagnostics v_n_corr = row_count;
    perform set_config('request.jwt.claims', '', true);
    update public.ai_risk_assessments set frozen_at = now() where id = v_a;
    begin
      update public.ai_risk_assessments set questionnaire_id = null where id = v_a;
      v_err2 := 'ACEPTADA';
    exception when others then
      v_err2 := sqlerrm;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    begin
      insert into public.ai_compliance_checks (system_id, requirement_code, status, assessment_id)
      values (v_sys_q, 'VERIFICACION_M01', 'CONFORME', v_a);
      v_err4 := 'ACEPTADA';
    exception when others then
      v_err4 := sqlerrm;
    end;
    begin
      update public.ai_compliance_checks set status = 'CONFORME' where id = v_c;
      v_err5 := 'ACEPTADA';
    exception when others then
      v_err5 := sqlerrm;
    end;
    perform set_config('request.jwt.claims', '', true);
    update public.ai_compliance_checks set checked_by_id = v_otra where id = v_c;
    get diagnostics v_n_mant = row_count;
    insert into public.ai_compliance_checks (system_id, requirement_code, status)
    values (v_sys_q, 'VERIFICACION_M01', 'CONFORME')
    returning id into v_c;
    begin
      update public.ai_compliance_checks set assessment_id = v_a where id = v_c;
      v_err6 := 'ACEPTADA';
    exception when others then
      v_err6 := sqlerrm;
    end;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: una escritura legítima de las sondas del cuestionario y la congelada se rechazó (%)', v_err;
  end if;
  if v_err3 not like 'CUESTIONARIO_DE_OTRO_SISTEMA%' then
    raise exception 'VERIFICACION: el cuestionario de otro sistema no se rechaza (%)', v_err3;
  end if;
  if v_enlazada is distinct from v_q then
    raise exception 'VERIFICACION: la evaluación no quedó enlazada a su cuestionario';
  end if;
  if v_err2 not like 'EVALUACION_CONGELADA%' then
    raise exception 'VERIFICACION: el cuestionario de una evaluación congelada cambia (%)', v_err2;
  end if;
  if v_c is null or v_n_corr <> 1 then
    raise exception 'VERIFICACION: la comprobación de una evaluación sin congelar no entra o no se corrige (% / % filas)', v_c, v_n_corr;
  end if;
  if coalesce(v_err4, '') not like 'EVALUACION_CONGELADA%' then
    raise exception 'VERIFICACION: se anexa una comprobación a una evaluación congelada (%)', v_err4;
  end if;
  if coalesce(v_err5, '') not like 'EVALUACION_CONGELADA%' then
    raise exception 'VERIFICACION: se corrige una comprobación de una evaluación congelada (%)', v_err5;
  end if;
  if v_n_mant <> 1 then
    raise exception 'VERIFICACION: la congelación bloquea el mantenimiento de la autoría (% filas)', v_n_mant;
  end if;
  if coalesce(v_err6, '') not like 'EVALUACION_CONGELADA%' then
    raise exception 'VERIFICACION: sin sesión se enlaza una comprobación a una evaluación congelada (%)', v_err6;
  end if;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'VERIFICACION OK: 2 FK RESTRICT, 0 DEFAULT en columnas de persona, 2 triggers sin anon, grants intactos, 14 sondas de comportamiento revertidas';
end;
$verificacion$;
