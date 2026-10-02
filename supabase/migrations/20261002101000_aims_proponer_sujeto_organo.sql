-- MOI-150 (D-28 bis) — que un grupo declare su órgano de gobierno de la IA
-- por DATO, sin tocar el programa.
--
-- El panel «Órgano rector» del Dashboard de AIMS se resuelve por dato
-- (`useAiGovernanceBody` → `resolveAiGovernanceBodyId`): primero
-- `aims_ria_subjects.governing_body_id`, después `policies.owner_body_id`.
-- Pero la ÚNICA puerta de escritura de `aims_ria_subjects`
-- (`fn_aims_proponer_sujeto`, 20260927133000) no aceptaba el órgano: la
-- columna existía y no había forma de rellenarla (medido 2026-10-02: 0 de
-- 18 filas en ARGA y Garrigues la llevan). El grupo nuevo no tiene política
-- de IA, así que no tenía ninguna vía.
--
-- D-28 bis (ledger 2026-09-26): completar la RPC con `p_governing_body_id`
-- en vez de fabricar una política de IA como vehículo.
--
-- Qué cambia:
--   · `fn_aims_proponer_sujeto` acepta `p_governing_body_id uuid DEFAULT NULL`.
--     Si llega, tiene que ser un órgano del MISMO tenant (además del
--     trigger `fn_aims_fk_misma_tenant`, que ya lo exige, se comprueba antes
--     para dar un error legible). Sin él, el comportamiento es el de antes.
--   · Se retira la firma de 7 argumentos: con las dos vivas, una llamada
--     PostgREST con argumentos por nombre sería ambigua.
-- Qué NO cambia: ARGA y Garrigues no ganan ni pierden filas; el panel de
-- ARGA sigue sin pintarse (ninguno de sus sujetos lleva órgano) y el de
-- Garrigues sigue resolviéndose por su política PI-30.
--
-- Cuerpo vigente en Cloud verificado el 2026-10-02 (md5(prosrc)
-- feca48d962017acae413dfca6a5cee43, idéntico al del repo).

drop function if exists public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid);

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

  -- MOI-150: el órgano que gobierna la IA de este sujeto, si se declara,
  -- tiene que existir en el grupo de la sesión. No se inventa ninguno.
  if p_governing_body_id is not null and not exists (
    select 1 from public.governing_bodies b
    where b.id = p_governing_body_id and b.tenant_id = v_tenant
  ) then
    raise exception 'ORGANO_DE_OTRO_TENANT: % no es un órgano de este tenant', p_governing_body_id using errcode = '42501';
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

comment on function public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid, uuid) is
  'F2.T4 + MOI-150: propone un sujeto RIA de un sistema del tenant. p_governing_body_id (opcional) declara el órgano que gobierna su IA; debe ser un órgano del mismo tenant. Es la vía por dato que lee el panel «Órgano rector» de AIMS.';

do $verificacion$
begin
  if to_regprocedure('public.fn_aims_proponer_sujeto(uuid,uuid,text,text,text[],text,uuid)') is not null then
    raise exception 'VERIFICACION MOI-150: sigue existiendo la firma de 7 argumentos';
  end if;
  if to_regprocedure('public.fn_aims_proponer_sujeto(uuid,uuid,text,text,text[],text,uuid,uuid)') is null then
    raise exception 'VERIFICACION MOI-150: no existe la firma de 8 argumentos';
  end if;
  if has_function_privilege('anon', 'public.fn_aims_proponer_sujeto(uuid,uuid,text,text,text[],text,uuid,uuid)', 'EXECUTE') then
    raise exception 'VERIFICACION MOI-150: anon puede ejecutar la RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.fn_aims_proponer_sujeto(uuid,uuid,text,text,text[],text,uuid,uuid)', 'EXECUTE') then
    raise exception 'VERIFICACION MOI-150: authenticated no puede ejecutar la RPC';
  end if;
  if position('governing_body_id' in (select prosrc from pg_proc where oid = 'public.fn_aims_proponer_sujeto(uuid,uuid,text,text,text[],text,uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'VERIFICACION MOI-150: la RPC no escribe governing_body_id';
  end if;
  raise notice 'VERIFICACION OK: fn_aims_proponer_sujeto acepta y escribe el órgano';
end
$verificacion$;
