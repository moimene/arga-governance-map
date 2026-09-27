-- MOI-170 — F2.T4, programa RIA, carril A.
-- Especificación §2.2 (fn_aims_proponer_sujeto, fn_aims_confirmar_sujeto).
--
-- Las dos únicas puertas de escritura de `aims_ria_subjects` en este carril.
-- `fn_aims_proponer_sujeto` exige AIMS_CLASIFICAR (quien clasifica un sistema
-- propone su sujeto); `fn_aims_confirmar_sujeto` exige AIMS_GOBIERNO —
-- confirmar un sujeto PENDIENTE_LEGAL o pasar uno a VIGENTE es una decisión
-- del gobierno de AIMS, no del día a día de clasificación (F2.T4: "Confirmar
-- PENDIENTE_LEGAL exige capacidad y motivo").
--
-- Las dos asiertan tenant y capacidad, y comprueban que vuelve fila (patrón
-- general de las RPC de AIMS, §2.2 "Funciones SQL").

create or replace function public.fn_aims_proponer_sujeto(
  p_system_id uuid,
  p_entity_id uuid,
  p_role text,
  p_derivation text,
  p_role_basis text[] default '{}'::text[],
  p_rationale text default null,
  p_questionnaire_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  perform public.fn_aims_assert_capacidad('AIMS_CLASIFICAR');

  if not exists (select 1 from public.ai_systems s where s.id = p_system_id and s.tenant_id = v_tenant) then
    raise exception 'SISTEMA_DE_OTRO_TENANT: % no es un sistema de este tenant', p_system_id using errcode = '42501';
  end if;

  insert into public.aims_ria_subjects (
    tenant_id, system_id, entity_id, role, role_basis, derivation,
    questionnaire_id, rationale, status
  ) values (
    v_tenant, p_system_id, p_entity_id, p_role, coalesce(p_role_basis, '{}'::text[]), p_derivation,
    p_questionnaire_id, p_rationale,
    case when p_role in ('IMPORTADOR', 'DISTRIBUIDOR', 'REPRESENTANTE_AUTORIZADO') then 'PENDIENTE_LEGAL' else 'PROPUESTO' end
  )
  returning id into v_id;

  if v_id is null then
    raise exception 'NO_PROPUESTO: el sujeto no se creó' using errcode = '42501';
  end if;

  return v_id;
end;
$fn$;

revoke all on function public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid) from public, anon;
grant execute on function public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid) to authenticated;

create or replace function public.fn_aims_confirmar_sujeto(
  p_subject_id uuid,
  p_nuevo_status text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_row public.aims_ria_subjects%rowtype;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  perform public.fn_aims_assert_capacidad('AIMS_GOBIERNO');

  if p_nuevo_status not in ('PROPUESTO', 'PENDIENTE_LEGAL', 'VIGENTE', 'CERRADO') then
    raise exception 'ESTADO_INVALIDO: %', p_nuevo_status using errcode = '42501';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 10 then
    raise exception 'MOTIVO_OBLIGATORIO: la confirmación de un sujeto necesita un motivo' using errcode = '42501';
  end if;

  select * into v_row from public.aims_ria_subjects
   where id = p_subject_id and tenant_id = v_tenant
   for update;

  if not found then
    raise exception 'NO_ENCONTRADO: el sujeto no existe en este tenant' using errcode = '42501';
  end if;

  if v_row.status = 'CERRADO' then
    raise exception 'SUJETO_CERRADO: un sujeto cerrado no cambia de estado' using errcode = '42501';
  end if;

  if p_nuevo_status = 'VIGENTE' and v_row.owner_person_id is null then
    raise exception 'RESPONSABLE_OBLIGATORIO: un sujeto VIGENTE necesita responsable interno' using errcode = '42501';
  end if;

  update public.aims_ria_subjects
     set status = p_nuevo_status,
         provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
           'confirmacion', jsonb_build_object('motivo', p_motivo, 'por', auth.uid(), 'en', now())
         ),
         updated_at = now()
   where id = p_subject_id;

  return p_subject_id;
end;
$fn$;

revoke all on function public.fn_aims_confirmar_sujeto(uuid, text, text) from public, anon;
grant execute on function public.fn_aims_confirmar_sujeto(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación: aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_err text;
  v_id uuid;
  v_sys_arga uuid;
  v_entidad_elegible uuid;
begin
  select id into v_sys_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;
  select id into v_entidad_elegible from public.entities
   where tenant_id = '00000000-0000-0000-0000-000000000001' and legal_form in ('SLU', 'SA', 'SL')
   order by id limit 1;
  if v_sys_arga is null or v_entidad_elegible is null then
    raise exception 'VERIFICACION: falta dato real de sondas';
  end if;

  -- Negativo: sin capacidad AIMS_CLASIFICAR, se rechaza.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'AUDITOR',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'AIMS_CAPACIDAD_DENEGADA%' then
    raise exception 'VERIFICACION: un AUDITOR propone sujeto sin capacidad (%)', v_err;
  end if;

  -- Positivo: SECRETARIO propone (tiene AIMS_CLASIFICAR), revertido.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'SECRETARIO',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' or v_id is null then
    raise exception 'VERIFICACION: SECRETARIO no puede proponer un sujeto legítimo (%)', v_err;
  end if;

  -- Negativo: confirmar sin capacidad AIMS_GOBIERNO (SECRETARIO no la tiene).
  -- Se reinserta la fila de la sonda anterior (revertida) dentro de esta misma
  -- sonda, para tener un sujeto real que confirmar.
  v_err := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    begin
      perform public.fn_aims_confirmar_sujeto(v_id, 'VIGENTE', 'motivo de verificación de F2.T4');
      raise exception 'SONDA_ACEPTADA';
    exception when others then
      v_err := sqlerrm;
    end;
    if v_err not like 'AIMS_CAPACIDAD_DENEGADA%' then
      raise exception 'VERIFICACION: SECRETARIO confirma un sujeto sin AIMS_GOBIERNO (%)', v_err;
    end if;

    -- Positivo, con COMPLIANCE (tiene AIMS_GOBIERNO): sin motivo, rechazado;
    -- con motivo, entra. Todo revertido al final del bloque exterior.
    perform set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'COMPLIANCE',
      'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
    v_err := null;
    begin
      perform public.fn_aims_confirmar_sujeto(v_id, 'VIGENTE', '');
      v_err := 'ACEPTADA';
    exception when others then
      v_err := sqlerrm;
    end;
    if v_err not like 'MOTIVO_OBLIGATORIO%' then
      raise exception 'VERIFICACION: confirmar sin motivo no se rechaza (%)', v_err;
    end if;

    -- Sin responsable interno, VIGENTE se rechaza aunque haya motivo (CHECK
    -- de la propia tabla, comprobado también aquí en el camino de la RPC).
    v_err := null;
    begin
      perform public.fn_aims_confirmar_sujeto(v_id, 'VIGENTE', 'motivo de verificación suficientemente largo');
      v_err := 'ACEPTADA';
    exception when others then
      v_err := sqlerrm;
    end;
    if v_err not like 'RESPONSABLE_OBLIGATORIO%' then
      raise exception 'VERIFICACION: VIGENTE sin responsable interno no se rechaza vía RPC (%)', v_err;
    end if;

    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: la cadena de sondas de confirmar_sujeto no cerró limpia (%)', v_err;
  end if;

  perform set_config('request.jwt.claims', '', true);

  if (select count(*) from public.aims_ria_subjects) <> 0 then
    raise exception 'VERIFICACION: la migración deja residuo en aims_ria_subjects';
  end if;

  raise notice 'VERIFICACION OK: fn_aims_proponer_sujeto exige AIMS_CLASIFICAR, fn_aims_confirmar_sujeto exige AIMS_GOBIERNO + motivo + responsable, sin residuo';
end;
$verificacion$;
