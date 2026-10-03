-- MOI-150 — D-28 bis (por delegación de Moisés): completar F2.T4 con el
-- modelo de F2.T9 (`aims_ria_subjects.governing_body_id` primero), en vez de
-- fabricar una política de IA para el grupo nuevo.
--
-- Hallazgo verificado (ola anterior, `scripts/aims/seed-organo-ia-grupo-nuevo.ts`):
-- ni `fn_aims_proponer_sujeto` ni `fn_aims_confirmar_sujeto`
-- (`20260927133000_f2_a3_aims_rpc_sujetos.sql`) aceptan un parámetro de
-- órgano, y su INSERT/UPDATE nunca escriben `governing_body_id` — la columna
-- existe desde F2.T2 (A1) y la lee `resolveGoverningBodyIdFromSubjects`
-- (`src/lib/aims/governing-body.ts`, F2.T9), pero ningún camino de escritura
-- la alimenta. Medido: 0 de 18 filas en ARGA/Garrigues la llevan puesta.
--
-- QUÉ CAMBIA
-- ----------
-- Se añade `p_governing_body_id uuid default null` a las dos RPC. Al
-- proponer un sujeto CON órgano, además de `AIMS_CLASIFICAR` (ya exigida)
-- se exige `AIMS_GOBIERNO` — declarar el órgano de gobierno de un sujeto es
-- una decisión de gobierno de AIMS, no del día a día de clasificación,
-- mismo criterio que ya rige `fn_aims_confirmar_sujeto` (F2.T4). Al
-- confirmar (que YA exige `AIMS_GOBIERNO` desde F2.T4) no hace falta
-- capacidad adicional; solo valida el órgano si se pasa.
--
-- En ambas, si `p_governing_body_id` no es null se valida que exista Y sea
-- del mismo tenant (`fn_current_tenant_id()`) — de forma explícita, con un
-- error de dominio (`ORGANO_DE_OTRO_TENANT`), en profundidad sobre el
-- trigger `trg_aims_ria_subjects_fk_tenant` (`fn_aims_fk_misma_tenant`, A1)
-- que ya rechazaría la referencia cruzada a nivel de fila, y sobre la FK real
-- `aims_ria_subjects.governing_body_id → governing_bodies(id)` que ya
-- rechazaría un id inexistente. No se fabrica ningún órgano nuevo aquí: si
-- el id no existe o es de otro tenant, se rechaza.
--
-- FIRMA: se cambia (se añade un parámetro), así que la anterior se ELIMINA
-- explícitamente antes de crear la nueva — dos funciones con el mismo nombre
-- y listas de parámetros distintas son sobrecargas ambiguas para PostgREST
-- cuando la llamada usa argumentos con nombre (RPC vía supabase-js). Los
-- llamadores existentes (`scripts/aims/seed-sujetos-ria.ts`,
-- `scripts/aims/seed-organo-ia-grupo-nuevo.ts`) invocan por nombre sin este
-- parámetro: con el nuevo default `null` siguen funcionando sin cambio.
--
-- ARGA / GARRIGUES — SIN CAMBIO VISIBLE. Esta migración no siembra ningún
-- sujeto ni toca ninguna fila existente; solo añade una capacidad de
-- escritura que nadie ha usado todavía (0 filas con `governing_body_id`
-- hoy). El alta real del sujeto del Grupo Nuevo (D-28) y la reasignación de
-- las 18 filas existentes a un caso concreto quedan fuera de este carril
-- (issue MOI-150, paso "Agente: implementarlo" sobre la propuesta ya
-- aprobada) — la aplica el orquestador aparte, con su propio ensayo de
-- siembra si procede.

drop function if exists public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid);
drop function if exists public.fn_aims_confirmar_sujeto(uuid, text, text);

create or replace function public.fn_aims_proponer_sujeto(
  p_system_id uuid,
  p_entity_id uuid,
  p_role text,
  p_derivation text,
  p_role_basis text[] default '{}'::text[],
  p_rationale text default null,
  p_questionnaire_id uuid default null,
  p_governing_body_id uuid default null
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

  if p_governing_body_id is not null then
    -- Declarar el órgano de gobierno de un sujeto es del gobierno de AIMS
    -- (mismo criterio que confirmar), no del día a día de clasificación.
    perform public.fn_aims_assert_capacidad('AIMS_GOBIERNO');

    if not exists (
      select 1 from public.governing_bodies gb
       where gb.id = p_governing_body_id and gb.tenant_id = v_tenant
    ) then
      raise exception 'ORGANO_DE_OTRO_TENANT: % no es un órgano de este tenant, o no existe', p_governing_body_id
        using errcode = '42501';
    end if;
  end if;

  insert into public.aims_ria_subjects (
    tenant_id, system_id, entity_id, role, role_basis, derivation,
    questionnaire_id, rationale, status, governing_body_id
  ) values (
    v_tenant, p_system_id, p_entity_id, p_role, coalesce(p_role_basis, '{}'::text[]), p_derivation,
    p_questionnaire_id, p_rationale,
    case when p_role in ('IMPORTADOR', 'DISTRIBUIDOR', 'REPRESENTANTE_AUTORIZADO') then 'PENDIENTE_LEGAL' else 'PROPUESTO' end,
    p_governing_body_id
  )
  returning id into v_id;

  if v_id is null then
    raise exception 'NO_PROPUESTO: el sujeto no se creó' using errcode = '42501';
  end if;

  return v_id;
end;
$fn$;

revoke all on function public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid, uuid) from public, anon;
grant execute on function public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid, uuid) to authenticated;

create or replace function public.fn_aims_confirmar_sujeto(
  p_subject_id uuid,
  p_nuevo_status text,
  p_motivo text,
  p_governing_body_id uuid default null
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

  if p_governing_body_id is not null and not exists (
    select 1 from public.governing_bodies gb
     where gb.id = p_governing_body_id and gb.tenant_id = v_tenant
  ) then
    raise exception 'ORGANO_DE_OTRO_TENANT: % no es un órgano de este tenant, o no existe', p_governing_body_id
      using errcode = '42501';
  end if;

  update public.aims_ria_subjects
     set status = p_nuevo_status,
         governing_body_id = coalesce(p_governing_body_id, governing_body_id),
         provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
           'confirmacion', jsonb_build_object('motivo', p_motivo, 'por', auth.uid(), 'en', now())
         ),
         updated_at = now()
   where id = p_subject_id;

  return p_subject_id;
end;
$fn$;

revoke all on function public.fn_aims_confirmar_sujeto(uuid, text, text, uuid) from public, anon;
grant execute on function public.fn_aims_confirmar_sujeto(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación: aborta la migración si algo no quedó como se dice. Cada
-- sonda de comportamiento va en su propio bloque BEGIN…EXCEPTION que se
-- deshace con `raise exception 'SONDA_REVERTIDA'` al final del camino
-- positivo, para no dejar residuo en `aims_ria_subjects` ni en `audit_log`.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_err text;
  v_id uuid;
  v_sys_arga uuid;
  v_entidad_elegible uuid;
  v_organo_arga uuid := '4d9e6026-c5ef-411b-949b-78d720f4da37'; -- Comité Ejecutivo, tenant ARGA (…0001)
  v_organo_garrigues uuid := '039c0586-1a87-455b-81ca-de7bacc72835'; -- Comité de Práctica Profesional, tenant Garrigues (…0002)
  v_baseline_count int;
begin
  -- Línea de base: `aims_ria_subjects` YA tiene dato real sembrado (F2.T16,
  -- carril C) cuando esta migración corre — a diferencia de A3 (F2.T4
  -- original), que se aplicó sobre la tabla recién creada y vacía. La
  -- comprobación de "sin residuo" de más abajo compara contra ESTA línea de
  -- base, nunca contra cero.
  select count(*) into v_baseline_count from public.aims_ria_subjects;
  select id into v_sys_arga from public.ai_systems
   where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;
  select id into v_entidad_elegible from public.entities
   where tenant_id = '00000000-0000-0000-0000-000000000001' and legal_form in ('SLU', 'SA', 'SL')
   order by id limit 1;
  if v_sys_arga is null or v_entidad_elegible is null then
    raise exception 'VERIFICACION: falta dato real de sondas';
  end if;
  if not exists (select 1 from public.governing_bodies where id = v_organo_arga and tenant_id = '00000000-0000-0000-0000-000000000001') then
    raise exception 'VERIFICACION: el órgano de ARGA de la sonda no existe o cambió de tenant';
  end if;
  if not exists (select 1 from public.governing_bodies where id = v_organo_garrigues and tenant_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'VERIFICACION: el órgano de Garrigues de la sonda no existe o cambió de tenant';
  end if;

  -- Negativo 1: SECRETARIO (tiene AIMS_CLASIFICAR, no AIMS_GOBIERNO) propone
  -- SIN órgano — sigue funcionando exactamente igual que antes de esta
  -- migración (compatibilidad hacia atrás del parámetro nuevo).
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
    raise exception 'VERIFICACION: SECRETARIO sin órgano dejó de poder proponer un sujeto legítimo (%)', v_err;
  end if;

  -- Negativo 2: el MISMO SECRETARIO, ahora CON `p_governing_body_id`, se
  -- rechaza por falta de AIMS_GOBIERNO — declarar el órgano exige capacidad
  -- de gobierno aunque proponer sin órgano no la exija.
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, v_organo_arga);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'AIMS_CAPACIDAD_DENEGADA%' then
    raise exception 'VERIFICACION: SECRETARIO propuso un sujeto CON órgano sin AIMS_GOBIERNO (%)', v_err;
  end if;

  -- Positivo: COMPLIANCE (tiene AIMS_GOBIERNO) propone CON el órgano de su
  -- propio tenant — el sujeto queda con `governing_body_id` puesto. Revertido.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'COMPLIANCE',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  v_id := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, v_organo_arga);
    if (select governing_body_id from public.aims_ria_subjects where id = v_id) is distinct from v_organo_arga then
      raise exception 'SONDA_ORGANO_NO_QUEDO_PUESTO';
    end if;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: COMPLIANCE con AIMS_GOBIERNO no pudo declarar el órgano al proponer (%)', v_err;
  end if;

  -- Negativo 3: COMPLIANCE (sí tiene AIMS_GOBIERNO) propone con el órgano de
  -- OTRO tenant (Garrigues) — se rechaza por ORGANO_DE_OTRO_TENANT, la
  -- capacidad no basta si el órgano no es del tenant de la sesión.
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, v_organo_garrigues);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'ORGANO_DE_OTRO_TENANT%' then
    raise exception 'VERIFICACION: un órgano de otro tenant no se rechazó al proponer (%)', v_err;
  end if;

  -- Negativo 4: un órgano que no existe en absoluto, mismo rechazo de dominio
  -- (no un error de FK crudo).
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, gen_random_uuid());
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'ORGANO_DE_OTRO_TENANT%' then
    raise exception 'VERIFICACION: un órgano inexistente no se rechazó al proponer (%)', v_err;
  end if;

  -- Confirmar: SECRETARIO no puede ni siquiera llegar (sigue exigiendo
  -- AIMS_GOBIERNO desde F2.T4, sin cambio). Con COMPLIANCE: primero se
  -- propone un sujeto SIN órgano y se confirma pasando `p_governing_body_id`
  -- del propio tenant — debe quedar puesto. Después, un intento de
  -- confirmar OTRO sujeto con el órgano de Garrigues se rechaza.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'COMPLIANCE',
    'tenant_id', '00000000-0000-0000-0000-000000000001')::text, true);
  v_err := null;
  v_id := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sys_arga, v_entidad_elegible, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');

    -- Confirmar con órgano de otro tenant: rechazado.
    begin
      perform public.fn_aims_confirmar_sujeto(v_id, 'PROPUESTO', 'motivo de verificación de MOI-150', v_organo_garrigues);
      raise exception 'SONDA_CONFIRMAR_OTRO_TENANT_ACEPTADA';
    exception when others then
      if sqlerrm not like 'ORGANO_DE_OTRO_TENANT%' then
        raise exception 'VERIFICACION: confirmar con órgano de otro tenant no se rechazó (%)', sqlerrm;
      end if;
    end;

    -- Confirmar con el órgano del propio tenant: el dato queda puesto.
    perform public.fn_aims_confirmar_sujeto(v_id, 'PROPUESTO', 'motivo de verificación de MOI-150', v_organo_arga);
    if (select governing_body_id from public.aims_ria_subjects where id = v_id) is distinct from v_organo_arga then
      raise exception 'SONDA_CONFIRMAR_ORGANO_NO_QUEDO_PUESTO';
    end if;

    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: la cadena de sondas de confirmar con órgano no cerró limpia (%)', v_err;
  end if;

  perform set_config('request.jwt.claims', '', true);

  if (select count(*) from public.aims_ria_subjects) <> v_baseline_count then
    raise exception 'VERIFICACION: la migración deja residuo en aims_ria_subjects (línea de base %, ahora %)',
      v_baseline_count, (select count(*) from public.aims_ria_subjects);
  end if;

  raise notice 'VERIFICACION OK: p_governing_body_id exige AIMS_GOBIERNO en proponer, valida tenant y existencia en proponer y confirmar, sin residuo';
end;
$verificacion$;
