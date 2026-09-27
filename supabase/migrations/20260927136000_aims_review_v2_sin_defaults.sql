-- Corrección urgente del orquestador (27-09-2026) sobre 20260927134000 (F2 carril A, MOI-170).
--
-- Defecto medido en producción tras aplicar F2: fn_aims_review_assessment v2
-- (p_assessment_id, p_decision DEFAULT NULL, p_motivation DEFAULT NULL) convive
-- con la v1 (p_assessment_id). Con los valores por defecto, una llamada con
-- solo p_assessment_id casa con las dos y PostgREST responde «Could not choose
-- the best candidate function»: la pantalla publicada (useAiAssessments.ts)
-- llama así, de modo que revisar una evaluación dejó de funcionar.
--
-- Arreglo mínimo y sin cambio de comportamiento para la pantalla actual: la v2
-- pierde los valores por defecto (hay que recrearla: Postgres no permite quitar
-- defaults con CREATE OR REPLACE). Así la llamada de un parámetro vuelve a
-- resolverse a la v1, y la v2 solo se usa cuando se pasan decisión y
-- motivación explícitas (que es lo que exige su propio cuerpo). El paso de la
-- pantalla a la v2 (con órgano acreditado) lo hace el carril de pantalla de F2.

drop function if exists public.fn_aims_review_assessment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.fn_aims_review_assessment(p_assessment_id uuid, p_decision text, p_motivation text)
 RETURNS TABLE(id uuid, reviewed_by_id uuid, reviewed_at timestamp with time zone, review_decision text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

revoke all on function public.fn_aims_review_assessment(uuid, text, text) from public, anon;
grant execute on function public.fn_aims_review_assessment(uuid, text, text) to authenticated, service_role;

do $verificacion$
declare
  v_con_defaults int;
  v_sobrecargas int;
begin
  select count(*) into v_sobrecargas from pg_proc where proname = 'fn_aims_review_assessment' and pronamespace = 'public'::regnamespace;
  select count(*) into v_con_defaults from pg_proc where proname = 'fn_aims_review_assessment' and pronamespace = 'public'::regnamespace and pronargdefaults > 0;
  if v_sobrecargas <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 sobrecargas de fn_aims_review_assessment, hay %', v_sobrecargas;
  end if;
  if v_con_defaults <> 0 then
    raise exception 'VERIFICACION: alguna sobrecarga sigue con valores por defecto (ambigüedad en PostgREST)';
  end if;
  if not has_function_privilege('authenticated', 'public.fn_aims_review_assessment(uuid, text, text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_aims_review_assessment(uuid)', 'EXECUTE') then
    raise exception 'VERIFICACION: authenticated perdió EXECUTE sobre alguna sobrecarga';
  end if;
  if has_function_privilege('anon', 'public.fn_aims_review_assessment(uuid, text, text)', 'EXECUTE') then
    raise exception 'VERIFICACION: anon puede ejecutar la v2';
  end if;
  raise notice 'VERIFICACION OK: dos sobrecargas sin defaults; la llamada de un parámetro resuelve a la v1';
end
$verificacion$;
