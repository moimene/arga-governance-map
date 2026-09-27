-- MOI-170 — F2.T7, programa RIA, carril A.
-- Especificación §2.2, §7 ("RBAC y cuatro ojos", DS-11); enmienda E-01.
--
-- `fn_aims_review_assessment` (v1) comparaba `auth.uid()` (usuario) contra
-- `frozen_by_id` (usuario): comparación en un solo dominio, pero el dominio
-- equivocado para lo que pide F2.T7 — comparar también con `assessor_id` y
-- `created_by`, que son PERSONA (E-01). La v2 resuelve TODO en persona antes
-- de comparar:
--   * revisor  → persona de la SESIÓN (user_profiles.person_id de auth.uid());
--     sin persona, PERFIL_SIN_PERSONA (no «no hay revisor», que escondería el
--     motivo real).
--   * assessor_id / created_by → ya son persona (E-01, carril A2).
--   * frozen_by_id → sigue siendo un id de USUARIO (lo escribe
--     `fn_aims_freeze_assessment`, que no se toca aquí: cambiar su dominio es
--     F9.T2, fuera de este carril). Para comparar, se traduce a persona en el
--     momento de la comparación (`user_profiles.person_id` del usuario que
--     congeló, en el mismo tenant). No se reescribe la columna: solo se
--     traduce para el chequeo.
--
-- Añade, además de "revisor ≠ redactor ≠ evaluador": que el revisor sea
-- miembro VIGENTE del órgano del sujeto (`fn_aims_es_miembro_organo`) y que la
-- decisión sea explícita (`review_decision` obligatorio). Sin sujeto o sin
-- órgano en el sujeto: SIN_ORGANO_ACREDITADO (así queda ARGA hasta D-U2, tal
-- como dice §7).

create or replace function public.fn_aims_es_miembro_organo(p_body_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_persona uuid;
  v_tenant uuid := public.fn_current_tenant_id();
begin
  if p_body_id is null or v_tenant is null then
    return false;
  end if;

  select up.person_id into v_persona
    from public.user_profiles up
   where up.user_id = auth.uid() and up.tenant_id = v_tenant;

  if v_persona is null then
    return false;
  end if;

  return exists (
    select 1 from public.condiciones_persona cp
     where cp.tenant_id = v_tenant
       and cp.person_id = v_persona
       and cp.body_id = p_body_id
       and cp.estado = 'VIGENTE'
  );
end;
$fn$;

revoke all on function public.fn_aims_es_miembro_organo(uuid) from public, anon;
grant execute on function public.fn_aims_es_miembro_organo(uuid) to authenticated;

create or replace function public.fn_aims_review_assessment(
  p_assessment_id uuid,
  p_decision text default null,
  p_motivation text default null
)
returns table(id uuid, reviewed_by_id uuid, reviewed_at timestamptz, review_decision text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_row public.ai_risk_assessments%rowtype;
  v_revisor_persona uuid;
  v_evaluador_persona uuid;
  v_body_id uuid;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  perform public.fn_aims_assert_capacidad('AIMS_REVISAR');

  if p_decision is null or p_decision not in ('ACEPTA', 'REQUIERE_MEDIDAS', 'RECHAZA') then
    raise exception 'DECISION_INVALIDA: la revisión exige una decisión explícita (ACEPTA, REQUIERE_MEDIDAS o RECHAZA)'
      using errcode = '42501';
  end if;

  select a.* into v_row
    from public.ai_risk_assessments a
    join public.ai_systems s on s.id = a.system_id
   where a.id = p_assessment_id and s.tenant_id = v_tenant
   for update;

  if not found then
    raise exception 'NO_ENCONTRADA: la evaluación no existe en este tenant' using errcode = '42501';
  end if;

  if v_row.frozen_at is null then
    raise exception 'NO_CONGELADA: se revisa lo que ya no puede cambiar' using errcode = '42501';
  end if;

  if v_row.reviewed_at is not null then
    raise exception 'YA_REVISADA: revisada el %', v_row.reviewed_at using errcode = '42501';
  end if;

  -- Revisor: persona de la SESIÓN, no el usuario.
  select up.person_id into v_revisor_persona
    from public.user_profiles up
   where up.user_id = auth.uid() and up.tenant_id = v_tenant;
  if v_revisor_persona is null then
    raise exception 'PERFIL_SIN_PERSONA: la cuenta de la sesión no está enlazada a una persona de su entorno; no puede firmar la revisión'
      using errcode = '42501';
  end if;

  -- Redactor: assessor_id / created_by ya son persona (E-01).
  if v_revisor_persona is not distinct from v_row.assessor_id
     or v_revisor_persona is not distinct from v_row.created_by then
    raise exception 'MISMO_REDACTOR: la revisión la firma una persona distinta de quien redactó la evaluación'
      using errcode = '42501';
  end if;

  -- Evaluador (quien congeló): frozen_by_id es USUARIO; se traduce a persona
  -- solo para comparar, sin tocar la columna (E-01).
  select up.person_id into v_evaluador_persona
    from public.user_profiles up
   where up.user_id = v_row.frozen_by_id and up.tenant_id = v_tenant;
  if v_evaluador_persona is not null and v_revisor_persona is not distinct from v_evaluador_persona then
    raise exception 'MISMO_EVALUADOR: la revisión la firma una persona distinta de quien congeló'
      using errcode = '42501';
  end if;

  -- Órgano acreditado: el sujeto de la evaluación tiene que traer uno. Sin
  -- sujeto, o sin órgano en el sujeto (ARGA hasta D-U2), no se puede acreditar
  -- la pertenencia del revisor.
  if v_row.subject_id is null then
    raise exception 'SIN_ORGANO_ACREDITADO: la evaluación no tiene sujeto del que derivar el órgano de revisión'
      using errcode = '42501';
  end if;

  select sub.governing_body_id into v_body_id from public.aims_ria_subjects sub where sub.id = v_row.subject_id;
  if v_body_id is null then
    raise exception 'SIN_ORGANO_ACREDITADO: el sujeto de la evaluación no tiene órgano acreditado'
      using errcode = '42501';
  end if;

  if not public.fn_aims_es_miembro_organo(v_body_id) then
    raise exception 'REVISOR_NO_MIEMBRO_ORGANO: quien revisa no es miembro vigente del órgano del sujeto'
      using errcode = '42501';
  end if;

  perform set_config('aims.revision_rpc', 'on', true);
  update public.ai_risk_assessments a
     set reviewed_by_id = auth.uid(),
         reviewed_at = now(),
         review_decision = p_decision,
         review_motivation = p_motivation
   where a.id = p_assessment_id;
  perform set_config('aims.revision_rpc', '', true);

  return query
    select a.id, a.reviewed_by_id, a.reviewed_at, a.review_decision
      from public.ai_risk_assessments a
     where a.id = p_assessment_id;
end;
$fn$;

revoke all on function public.fn_aims_review_assessment(uuid, text, text) from public, anon;
grant execute on function public.fn_aims_review_assessment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación: aborta la migración si algo no quedó como se dice. Todo sobre
-- Garrigues, con las dos cuentas reales (demo@ redacta y congela, admin@
-- revisa) que ya son miembros vigentes del Comité de Gobernanza de la IA
-- (432e420b-4db1-44f1-81da-e3575b1d3dec, medido).
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_err text;
  v_sys_garr uuid := '2f877e8c-875d-4b11-9b39-aed0826cacb5';
  v_entidad uuid := '00000000-0000-0000-0002-000000000004';
  v_body uuid := '432e420b-4db1-44f1-81da-e3575b1d3dec';
  v_demo_user uuid := '7ad12313-2a13-4c5c-b530-423c35ef049b';
  v_demo_persona uuid := '60fc2337-d6cc-4ea5-8e6c-a23d8e5b09cc';
  v_admin_user uuid := '657c8700-c90f-4d22-b2db-5419d2d8e292';
  v_subject uuid;
  v_eval uuid;
  v_decision text;
begin
  if not exists (select 1 from public.condiciones_persona
                  where person_id = v_demo_persona and body_id = v_body and estado = 'VIGENTE') then
    raise exception 'VERIFICACION: demo@garrigues ya no es miembro vigente del Comité de Gobernanza de la IA (dato base movido)';
  end if;

  -- Sujeto de prueba, con órgano (postgres, sin RLS).
  insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status, governing_body_id)
  values ('00000000-0000-0000-0000-000000000002', v_sys_garr, v_entidad,
          'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS', 'PROPUESTO', v_body)
  returning id into v_subject;

  -- demo@ redacta y congela (fuera de la RPC de congelación, en directo, para
  -- no acoplar esta sonda al estado que exige fn_aims_freeze_assessment).
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_demo_user, 'role', 'authenticated', 'role_code', 'SECRETARIO',
    'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
  insert into public.ai_risk_assessments (system_id, framework, status, subject_id)
  values (v_sys_garr, 'EU_AI_ACT', 'BORRADOR', v_subject)
  returning id into v_eval;
  perform set_config('request.jwt.claims', '', true);

  update public.ai_risk_assessments set frozen_at = now(), frozen_by_id = v_demo_user where id = v_eval;

  -- Negativo: demo@ (redactó y congeló) no puede revisar su propia evaluación.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_demo_user, 'role', 'authenticated', 'role_code', 'SECRETARIO',
    'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_review_assessment(v_eval, 'ACEPTA', 'motivo de verificación');
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'MISMO_REDACTOR%' and v_err not like 'MISMO_EVALUADOR%' then
    raise exception 'VERIFICACION: el mismo redactor/evaluador puede revisar su evaluación (%)', v_err;
  end if;

  -- Negativo: decisión no explícita.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user, 'role', 'authenticated', 'role_code', 'ADMIN_TENANT',
    'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_review_assessment(v_eval, null, null);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'DECISION_INVALIDA%' then
    raise exception 'VERIFICACION: una revisión sin decisión explícita no se rechaza (%)', v_err;
  end if;

  -- Positivo: admin@ (distinta persona, miembro vigente del mismo órgano) revisa.
  v_decision := null;
  begin
    select review_decision into v_decision from public.fn_aims_review_assessment(v_eval, 'ACEPTA', 'revisado en verificación de F2.T7');
  exception when others then
    raise exception 'VERIFICACION: admin@ (revisor legítimo, distinto del redactor) no puede revisar (%)', sqlerrm;
  end;
  if v_decision is distinct from 'ACEPTA' then
    raise exception 'VERIFICACION: la revisión legítima no dejó review_decision = ACEPTA (%)', v_decision;
  end if;
  perform set_config('request.jwt.claims', '', true);

  -- Sin órgano acreditado: un sujeto sin governing_body_id, revisor por lo
  -- demás legítimo, se rechaza con SIN_ORGANO_ACREDITADO (postura de ARGA
  -- hasta D-U2).
  declare
    v_subject_sin_organo uuid;
    v_eval2 uuid;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation, status)
    values ('00000000-0000-0000-0000-000000000002', v_sys_garr, v_entidad,
            'PROVEEDOR', 'SIEMBRA_HIPOTESIS', 'PROPUESTO')
    returning id into v_subject_sin_organo;

    perform set_config('request.jwt.claims', json_build_object(
      'sub', v_demo_user, 'role', 'authenticated', 'role_code', 'SECRETARIO',
      'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
    insert into public.ai_risk_assessments (system_id, framework, status, subject_id)
    values (v_sys_garr, 'EU_AI_ACT', 'BORRADOR', v_subject_sin_organo)
    returning id into v_eval2;
    perform set_config('request.jwt.claims', '', true);
    update public.ai_risk_assessments set frozen_at = now(), frozen_by_id = v_demo_user where id = v_eval2;

    perform set_config('request.jwt.claims', json_build_object(
      'sub', v_admin_user, 'role', 'authenticated', 'role_code', 'ADMIN_TENANT',
      'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
    v_err := null;
    begin
      perform public.fn_aims_review_assessment(v_eval2, 'ACEPTA', 'sin órgano');
      v_err := 'ACEPTADA';
    exception when others then
      v_err := sqlerrm;
    end;
    if v_err not like 'SIN_ORGANO_ACREDITADO%' then
      raise exception 'VERIFICACION: un sujeto sin órgano no rechaza la revisión con SIN_ORGANO_ACREDITADO (%)', v_err;
    end if;
    perform set_config('request.jwt.claims', '', true);
  end;

  -- Revertir todo: nada de esto queda en Cloud.
  raise exception 'SONDA_REVERTIDA_FINAL';
exception when others then
  perform set_config('request.jwt.claims', '', true);
  if sqlerrm <> 'SONDA_REVERTIDA_FINAL' then
    raise exception 'VERIFICACION: %', sqlerrm;
  end if;
  raise notice 'VERIFICACION OK: cuatro ojos v2 en dominio persona (revisor≠redactor≠evaluador), decisión explícita, SIN_ORGANO_ACREDITADO sin sujeto/órgano, positivo con admin@ y demo@ reales, sin residuo';
end;
$verificacion$;
