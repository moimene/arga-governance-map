-- MOI-170 — F2.T10, programa RIA, carril A.
-- Especificación §2.2 (aims_specialty_bodies, fn_aims_declarar_especialidad), §7.
--
-- Única puerta de escritura de `aims_specialty_bodies` (carril A1). Exige
-- AIMS_GOBIERNO: declarar qué órgano lleva una especialidad es gobierno de
-- AIMS, no clasificación del día a día (F2.T5 ya sembró esa capacidad para
-- SECRETARIO=false, COMPLIANCE/ADMIN_TENANT=true).
--
-- La siembra real de las 5 especialidades de Garrigues (F2.T10, aceptación:
-- "Garrigues queda con 5 especialidades, con slugs verificados contra Cloud")
-- es un script de dato (`scripts/aims/seed-especialidades.ts`), no una
-- migración de esquema: queda fuera de este carril (capa de BASE DE DATOS).
-- Esta migración deja la puerta lista; quien la cruce lo hace fuera de aquí.
-- ARGA sigue vacía hasta D-U6 (falla cerrado, sin fila).

create or replace function public.fn_aims_declarar_especialidad(
  p_especialidad text,
  p_governing_body_id uuid
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

  perform public.fn_aims_assert_capacidad('AIMS_GOBIERNO');

  if p_especialidad not in ('JURIDICO', 'TECNICO', 'RIESGOS', 'CIBERSEGURIDAD', 'DATOS') then
    raise exception 'ESPECIALIDAD_INVALIDA: %', p_especialidad using errcode = '42501';
  end if;

  if not exists (select 1 from public.governing_bodies gb where gb.id = p_governing_body_id and gb.tenant_id = v_tenant) then
    raise exception 'ORGANO_DE_OTRO_TENANT: % no es un órgano de este tenant', p_governing_body_id using errcode = '42501';
  end if;

  insert into public.aims_specialty_bodies (tenant_id, especialidad, governing_body_id, declared_by)
  values (v_tenant, p_especialidad, p_governing_body_id, auth.uid())
  on conflict (tenant_id, especialidad) do update
    set governing_body_id = excluded.governing_body_id,
        declared_by = excluded.declared_by,
        declared_at = now()
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.fn_aims_declarar_especialidad(text, uuid) from public, anon;
grant execute on function public.fn_aims_declarar_especialidad(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación: aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_err text;
  v_id uuid;
  v_body uuid := '432e420b-4db1-44f1-81da-e3575b1d3dec'; -- Comité de Gobernanza de la IA (Garrigues)
begin
  if not exists (select 1 from public.governing_bodies where id = v_body and tenant_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'VERIFICACION: el órgano de prueba ya no existe o cambió de tenant';
  end if;

  -- Negativo: SECRETARIO no tiene AIMS_GOBIERNO.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'SECRETARIO',
    'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_declarar_especialidad('JURIDICO', v_body);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'AIMS_CAPACIDAD_DENEGADA%' then
    raise exception 'VERIFICACION: SECRETARIO declara especialidad sin AIMS_GOBIERNO (%)', v_err;
  end if;

  -- Negativo: especialidad fuera de catálogo, incluso con capacidad.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated', 'role_code', 'COMPLIANCE',
    'tenant_id', '00000000-0000-0000-0000-000000000002')::text, true);
  v_err := null;
  begin
    perform public.fn_aims_declarar_especialidad('NO_EXISTE', v_body);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err not like 'ESPECIALIDAD_INVALIDA%' then
    raise exception 'VERIFICACION: una especialidad fuera de catálogo no se rechaza (%)', v_err;
  end if;

  -- Positivo: COMPLIANCE (tiene AIMS_GOBIERNO) declara, revertido; y
  -- re-declarar la MISMA especialidad hace upsert (idempotente por diseño de
  -- la siembra futura), no duplica.
  v_err := null;
  begin
    v_id := public.fn_aims_declarar_especialidad('JURIDICO', v_body);
    if v_id is null then
      raise exception 'VERIFICACION: la declaración legítima no devolvió id';
    end if;
    perform public.fn_aims_declarar_especialidad('JURIDICO', v_body);
    if (select count(*) from public.aims_specialty_bodies where tenant_id = '00000000-0000-0000-0000-000000000002' and especialidad = 'JURIDICO') <> 1 then
      raise exception 'VERIFICACION: declarar dos veces la misma especialidad duplica la fila';
    end if;
    raise exception 'SONDA_REVERTIDA';
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err <> 'SONDA_REVERTIDA' then
    raise exception 'VERIFICACION: %', v_err;
  end if;

  perform set_config('request.jwt.claims', '', true);

  if (select count(*) from public.aims_specialty_bodies) <> 0 then
    raise exception 'VERIFICACION: la migración deja residuo en aims_specialty_bodies';
  end if;

  raise notice 'VERIFICACION OK: fn_aims_declarar_especialidad exige AIMS_GOBIERNO, valida catálogo, upsert idempotente, sin residuo';
end;
$verificacion$;
