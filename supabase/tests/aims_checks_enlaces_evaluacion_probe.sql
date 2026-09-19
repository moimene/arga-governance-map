-- Probe transaccional post-despliegue (G-VIVO-REV) para
-- 20260919100000_aims_checks_enlaces_evaluacion.sql — M01, F1.T14.
--
-- Precondiciones:
--   * la migración 20260919100000 aplicada;
--   * ejecutar con un rol de mantenimiento que pueda SET ROLE a authenticated
--     (el MCP execute_sql corre como postgres);
--   * ejecutar el fichero COMPLETO. BEGIN + ROLLBACK son parte del contrato: el
--     camino positivo escribe una evaluación y comprobaciones reales que, con
--     DELETE revocado y FK RESTRICT, no se podrían limpiar de otra forma.
--
-- Cada paso corre como `authenticated`, con los claims de una cuenta demo real,
-- bajo la RLS de verdad: es lo que haría PostgREST con esa sesión. Cualquier
-- aserción fallida lanza y aborta; si llega al final, el último SELECT devuelve
-- el resumen y el ROLLBACK lo deshace todo.

BEGIN;

DO $probe$
declare
  v_arga_user uuid;   v_arga_persona uuid;
  v_garr_user uuid;   v_garr_persona uuid;
  v_admin_persona uuid;
  v_garr_sys uuid;    v_arga_sys uuid;    v_arga_eval uuid;
  v_nueva uuid;       v_check uuid;
  v_quien uuid;       v_enlace uuid;
  v_err text;         v_code text;
  v_filas int;
begin
  -- Sujetos, resueltos como postgres ANTES de cambiar de rol.
  select u.id, up.person_id into v_arga_user, v_arga_persona
    from auth.users u join public.user_profiles up on up.user_id = u.id
   where u.email = 'demo@arga-seguros.com';
  select u.id, up.person_id into v_garr_user, v_garr_persona
    from auth.users u join public.user_profiles up on up.user_id = u.id
   where u.email = 'demo@garrigues-demo.dev';
  select up.person_id into v_admin_persona
    from auth.users u join public.user_profiles up on up.user_id = u.id
   where u.email = 'admin@garrigues-demo.dev';
  if v_arga_persona is null or v_garr_persona is null or v_admin_persona is null then
    raise exception 'PROBE: falta una cuenta demo enlazada a persona (ARGA %, Garrigues %, admin %)', v_arga_persona, v_garr_persona, v_admin_persona;
  end if;

  select s.id into v_garr_sys from public.ai_systems s
   where s.tenant_id = '00000000-0000-0000-0000-000000000002' order by s.created_at limit 1;
  select a.id, a.system_id into v_arga_eval, v_arga_sys
    from public.ai_risk_assessments a join public.ai_systems s on s.id = a.system_id
   where s.tenant_id = '00000000-0000-0000-0000-000000000001' order by a.created_at limit 1;
  if v_garr_sys is null or v_arga_eval is null then
    raise exception 'PROBE: sin sistema de Garrigues o sin evaluación de ARGA: las sondas no tendrían sujeto';
  end if;

  -- P1 — camino del wizard (Garrigues): la evaluación se cierra y sus
  --      comprobaciones llevan el enlace; la autoría la pone el servidor aunque
  --      el cliente mande la de otra persona del mismo tenant.
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ai_risk_assessments (system_id, framework, status, assessment_date, findings)
  values (v_garr_sys, 'EU_AI_ACT', 'CON_GAPS', current_date, '[]'::jsonb)
  returning id into v_nueva;
  insert into public.ai_compliance_checks (system_id, assessment_id, requirement_code, requirement_title, status, checked_at, checked_by_id)
  values (v_garr_sys, v_nueva, 'PROBE_M01', 'Sonda M01', 'PENDIENTE', current_date, v_admin_persona)
  returning id, checked_by_id, assessment_id into v_check, v_quien, v_enlace;
  if v_quien is distinct from v_garr_persona then
    raise exception 'PROBE P1: la autoría es % y debía ser la persona de la sesión %', v_quien, v_garr_persona;
  end if;
  if v_enlace is distinct from v_nueva then
    raise exception 'PROBE P1: la comprobación no quedó enlazada a su evaluación';
  end if;

  -- P2 — enlace cross-tenant: una evaluación de ARGA en una comprobación de Garrigues.
  begin
    insert into public.ai_compliance_checks (system_id, assessment_id, requirement_code, status)
    values (v_garr_sys, v_arga_eval, 'PROBE_M01', 'PENDIENTE');
    v_err := 'ACEPTADA'; v_code := null;
  exception when others then
    v_err := sqlerrm; v_code := sqlstate;
  end;
  if v_err not like 'EVALUACION_DE_OTRO_SISTEMA%' or v_code <> '42501' then
    raise exception 'PROBE P2: el enlace a una evaluación de otro tenant no se rechaza (% / %)', v_code, v_err;
  end if;

  -- P3 — escribir en un sistema de ARGA desde Garrigues, aunque el enlace sea coherente: la RLS lo corta.
  begin
    insert into public.ai_compliance_checks (system_id, assessment_id, requirement_code, status)
    values (v_arga_sys, v_arga_eval, 'PROBE_M01', 'PENDIENTE');
    v_err := 'ACEPTADA'; v_code := null;
  exception when others then
    v_err := sqlerrm; v_code := sqlstate;
  end;
  if v_code is distinct from '42501' then
    raise exception 'PROBE P3: Garrigues escribió en un sistema de ARGA (% / %)', v_code, v_err;
  end if;

  -- P4 — una sesión no reescribe la autoría ni el enlace de una comprobación suya.
  begin
    update public.ai_compliance_checks set checked_by_id = v_admin_persona where id = v_check;
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'COMPROBACION_INMUTABLE%' then
    raise exception 'PROBE P4a: la autoría se reescribe (%)', v_err;
  end if;
  begin
    update public.ai_compliance_checks set assessment_id = null where id = v_check;
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'COMPROBACION_INMUTABLE%' then
    raise exception 'PROBE P4b: el enlace se reescribe (%)', v_err;
  end if;
  -- Control positivo: un UPDATE de otra columna de la misma fila sí entra.
  update public.ai_compliance_checks set description = 'sonda' where id = v_check;
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'PROBE P4c: el trigger bloquea también lo que no debe (% filas)', v_filas;
  end if;

  -- P5 — cuestionario de otro sistema en una evaluación.
  begin
    insert into public.ai_risk_assessments (system_id, framework, status, questionnaire_id)
    values (v_garr_sys, 'EU_AI_ACT', 'BORRADOR', gen_random_uuid());
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'CUESTIONARIO_DE_OTRO_SISTEMA%' then
    raise exception 'PROBE P5: un cuestionario ajeno no se rechaza (%)', v_err;
  end if;
  reset role;

  -- P6 — sesión sin persona (usuario sin perfil): rechazada.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.ai_compliance_checks (system_id, requirement_code, status)
    values (v_garr_sys, 'PROBE_M01', 'PENDIENTE');
    v_err := 'ACEPTADA'; v_code := null;
  exception when others then
    v_err := sqlerrm; v_code := sqlstate;
  end;
  reset role;
  if v_err not like 'PERFIL_SIN_PERSONA%' or v_code <> '42501' then
    raise exception 'PROBE P6: una sesión sin persona escribe (% / %)', v_code, v_err;
  end if;

  -- P7 — ARGA: la autoría es la persona de su demo@ (control del otro tenant).
  perform set_config('request.jwt.claims', json_build_object('sub', v_arga_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ai_compliance_checks (system_id, assessment_id, requirement_code, status)
  values (v_arga_sys, v_arga_eval, 'PROBE_M01', 'PENDIENTE')
  returning checked_by_id into v_quien;
  reset role;
  if v_quien is distinct from v_arga_persona then
    raise exception 'PROBE P7: autoría ARGA % y debía ser %', v_quien, v_arga_persona;
  end if;

  -- P8 — las legacy siguen sin enlace (no hubo backfill).
  select count(*) into v_filas from public.ai_compliance_checks
   where created_at < '2026-09-19' and assessment_id is not null;
  if v_filas <> 0 then
    raise exception 'PROBE P8: % comprobaciones legacy aparecen enlazadas', v_filas;
  end if;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'M01 PROBE OK';
end;
$probe$;

SELECT 'M01 PROBE OK: P1-P8 (autoría de servidor, enlace coherente, cross-tenant, inmutabilidad, sin persona, legacy intactas)' AS resultado;

ROLLBACK;
