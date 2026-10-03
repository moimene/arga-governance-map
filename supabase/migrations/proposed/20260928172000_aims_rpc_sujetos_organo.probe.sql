-- MOI-150 — ensayo revertido (NO ejecutar fuera del orquestador autorizado).
--
-- Corre DENTRO del BEGIN…ROLLBACK del ejecutor seguro, DESPUÉS de aplicar
-- 20260928172000_aims_rpc_sujetos_organo.sql (el ejecutor concatena ambos
-- ficheros). Nada de lo que sigue persiste. A diferencia del bloque DO de
-- verificación de la propia migración (que corre como `postgres` simulando
-- rol con `set_config`), este ensayo corre COMO `authenticated` de verdad
-- (`set local role authenticated`) con subs de usuarios REALES con perfil,
-- para que RLS y `fn_current_tenant_id()` (que resuelve por `auth.uid()` vía
-- `user_profiles`) se ejerzan de verdad, no se simulen.
--
-- Escenario del issue (D-28 bis): el Grupo Nuevo (…0003) declara su órgano
-- de gobierno de la IA — el Consejo de Administración de Corporación Nueva,
-- S.A. — sobre el sujeto real del recorrido MOI-55, sin fabricar una
-- política de IA.
do $probe_moi150$
declare
  v_nuevo_admin uuid := '67b0299d-55b2-4126-be88-3505998fe377'; -- admin@grupo-nuevo-demo.dev (ADMIN_TENANT, …0003)
  v_nuevo_secretario uuid := '6452252f-3214-4c9a-857b-b439626d215e'; -- demo@grupo-nuevo-demo.dev (SECRETARIO, …0003)
  v_garr_admin uuid := '657c8700-c90f-4d22-b2db-5419d2d8e292'; -- admin@garrigues-demo.dev (ADMIN_TENANT, …0002)

  v_sistema_moi55 uuid := '75635765-47fd-4020-bdb7-61859be67c31'; -- sistema real del recorrido MOI-55, tenant …0003
  v_entidad_corp_nueva uuid := '45c8df67-64c9-42a3-abff-8047dd23748b'; -- Corporación Nueva, S.A., tenant …0003
  v_organo_cda_corp_nueva uuid := 'db8073bb-5089-4bbf-a9a9-456d457f59b7'; -- CdA de Corporación Nueva, S.A., tenant …0003
  v_organo_arga uuid := '4d9e6026-c5ef-411b-949b-78d720f4da37'; -- Comité Ejecutivo, tenant ARGA (…0001) — de OTRO tenant
  v_organo_garrigues uuid := '039c0586-1a87-455b-81ca-de7bacc72835'; -- Comité de Práctica Profesional, tenant Garrigues (…0002) — de OTRO tenant
  v_garr_sistema uuid := '2f877e8c-875d-4b11-9b39-aed0826cacb5'; -- Harvey, tenant Garrigues (…0002)
  v_garr_entidad uuid := '00000000-0000-0000-0002-000000000001'; -- J&A Garrigues, S.L.P.

  v_err text;
  v_id uuid;
  v_governing_body_id uuid;
  v_n int;
begin
  -- Fijación previa: el sujeto declarado en este ensayo no debe existir ya
  -- (idempotencia del script de siembra real: si alguna corrida anterior lo
  -- dejó puesto, esta prueba tendría que verlo y no re-proponerlo — aquí lo
  -- exigimos ausente porque el ensayo se revierte siempre).
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.aims_ria_subjects
   where tenant_id = '00000000-0000-0000-0000-000000000003'
     and system_id = v_sistema_moi55 and entity_id = v_entidad_corp_nueva and role = 'RESPONSABLE_DESPLIEGUE';
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_n <> 0 then
    raise exception 'PROBE: el sujeto del ensayo ya existe en Cloud (%), no es un ensayo revertido limpio', v_n;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- Negativo 1 — órgano de OTRO tenant rechazado, incluso con AIMS_GOBIERNO.
  -- admin@grupo-nuevo-demo.dev (ADMIN_TENANT, tiene AIMS_GOBIERNO) propone
  -- CON el órgano de ARGA: se rechaza por ORGANO_DE_OTRO_TENANT, no entra.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sistema_moi55, v_entidad_corp_nueva, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, v_organo_arga);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err !~* 'ORGANO_DE_OTRO_TENANT' then
    raise exception 'PROBE: admin@grupo-nuevo-demo.dev pudo declarar el órgano de OTRO tenant (%)', v_err;
  end if;

  select count(*) into v_n from public.aims_ria_subjects where tenant_id = '00000000-0000-0000-0000-000000000003';
  if v_n <> 0 then
    raise exception 'PROBE: el negativo 1 dejó residuo (% filas) en aims_ria_subjects del Grupo Nuevo', v_n;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- Negativo 2 — SECRETARIO sin AIMS_GOBIERNO rechazado. demo@grupo-nuevo
  -- (SECRETARIO, tiene AIMS_CLASIFICAR pero no AIMS_GOBIERNO) propone el
  -- MISMO sujeto CON el órgano correcto del propio tenant: se rechaza.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_sistema_moi55, v_entidad_corp_nueva, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], null, null, v_organo_cda_corp_nueva);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err !~* 'AIMS_CAPACIDAD_DENEGADA' then
    raise exception 'PROBE: demo@grupo-nuevo (SECRETARIO) pudo declarar el órgano sin AIMS_GOBIERNO (%)', v_err;
  end if;

  select count(*) into v_n from public.aims_ria_subjects where tenant_id = '00000000-0000-0000-0000-000000000003';
  if v_n <> 0 then
    raise exception 'PROBE: el negativo 2 dejó residuo (% filas) en aims_ria_subjects del Grupo Nuevo', v_n;
  end if;

  -- El mismo SECRETARIO SIN órgano sigue pudiendo proponer (compatibilidad
  -- hacia atrás real, con RLS real — no solo simulada por claims en la
  -- migración): control positivo de que no se rompió el camino existente.
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  v_id := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sistema_moi55, v_entidad_corp_nueva, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' or v_id is null then
    raise exception 'PROBE: demo@grupo-nuevo (SECRETARIO) dejó de poder proponer un sujeto SIN órgano (%)', v_err;
  end if;

  -- Deshacer este sujeto de control (rol postgres, fuera de RLS) para dejar
  -- el escenario limpio antes del positivo real de más abajo.
  delete from public.aims_ria_subjects where id = v_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- Positivo — admin@grupo-nuevo-demo.dev (ADMIN_TENANT) propone el sujeto
  -- CON el CdA de Corporación Nueva, S.A.: `governing_body_id` queda puesto,
  -- y es exactamente el dato que `resolveAiGovernanceBodyId`
  -- (`src/lib/aims/governing-body.ts`, vía `useAiGovernanceBody`) resolvería
  -- para pintar el panel del Dashboard del Grupo Nuevo.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  v_id := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_sistema_moi55, v_entidad_corp_nueva, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS',
      '{}'::text[], 'Ensayo MOI-150: CdA de Corporación Nueva, S.A. como órgano de gobierno de la IA (D-28 bis).', null, v_organo_cda_corp_nueva);
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' or v_id is null then
    raise exception 'PROBE: admin@grupo-nuevo-demo.dev no pudo proponer el sujeto CON su propio órgano (%)', v_err;
  end if;

  select governing_body_id into v_governing_body_id from public.aims_ria_subjects where id = v_id;
  if v_governing_body_id is distinct from v_organo_cda_corp_nueva then
    raise exception 'PROBE: governing_body_id no quedó puesto tras proponer (esperado %, real %)', v_organo_cda_corp_nueva, v_governing_body_id;
  end if;

  -- Espejo exacto de `resolveGoverningBodyIdFromSubjects`
  -- (`src/lib/aims/governing-body.ts`): primer sujeto del tenant con
  -- `governing_body_id` no nulo, ordenado por `created_at`. Debe resolver a
  -- este mismo órgano — es lo que `useAiGovernanceBody` consulta.
  select governing_body_id into v_governing_body_id
    from public.aims_ria_subjects
   where tenant_id = '00000000-0000-0000-0000-000000000003' and governing_body_id is not null
   order by created_at asc limit 1;
  if v_governing_body_id is distinct from v_organo_cda_corp_nueva then
    raise exception 'PROBE: resolveGoverningBodyIdFromSubjects no resolvería el órgano declarado (esperado %, real %)', v_organo_cda_corp_nueva, v_governing_body_id;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- Negativo 3 (confirmar) — el mismo admin@grupo-nuevo-demo.dev, que SÍ
  -- tiene AIMS_GOBIERNO, no puede REASIGNAR el sujeto a un órgano de otro
  -- tenant (Garrigues) al confirmar: la validación de tenant también corre
  -- en `fn_aims_confirmar_sujeto`.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_aims_confirmar_sujeto(v_id, 'PROPUESTO', 'ensayo MOI-150: confirmar con órgano de otro tenant', v_organo_garrigues);
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err !~* 'ORGANO_DE_OTRO_TENANT' then
    raise exception 'PROBE: fn_aims_confirmar_sujeto aceptó reasignar a un órgano de otro tenant (%)', v_err;
  end if;

  if (select governing_body_id from public.aims_ria_subjects where id = v_id) is distinct from v_organo_cda_corp_nueva then
    raise exception 'PROBE: el negativo 3 alteró governing_body_id pese a rechazarse';
  end if;

  -- Deshacer el sujeto de control creado en el positivo (rol postgres, fuera
  -- de RLS): el ensayo entero se revierte con ROLLBACK igualmente, pero se
  -- deja explícito y comprobado que no queda nada en pie a mitad del bloque.
  delete from public.aims_ria_subjects where id = v_id;

  select count(*) into v_n from public.aims_ria_subjects where tenant_id = '00000000-0000-0000-0000-000000000003';
  if v_n <> 0 then
    raise exception 'PROBE: queda residuo (% filas) en aims_ria_subjects del Grupo Nuevo tras el ensayo', v_n;
  end if;

  -- Control: Garrigues (admin@, que ya usaba AIMS_GOBIERNO desde F2.T4 para
  -- confirmar) no se ve afectado por el cambio de firma — sigue pudiendo
  -- proponer SIN pasar órgano, exactamente como antes. Rol `PROVEEDOR_GPAI`
  -- elegido porque no está ya sembrado para Harvey (evita chocar con el
  -- índice único de sujeto vigente sobre el dato real ya sembrado). Garrigues
  -- YA tiene dato real sembrado (F2.T16): la comprobación de "sin residuo"
  -- compara contra la línea de base capturada aquí, nunca contra cero.
  select count(*) into v_n from public.aims_ria_subjects where tenant_id = '00000000-0000-0000-0000-000000000002';
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  v_id := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_garr_sistema, v_garr_entidad, 'PROVEEDOR_GPAI', 'SIEMBRA_HIPOTESIS');
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' or v_id is null then
    raise exception 'PROBE: Garrigues admin@ dejó de poder proponer un sujeto SIN órgano tras el cambio de firma (%)', v_err;
  end if;
  delete from public.aims_ria_subjects where id = v_id;

  if (select count(*) from public.aims_ria_subjects where tenant_id = '00000000-0000-0000-0000-000000000002') <> v_n then
    raise exception 'PROBE: queda residuo en aims_ria_subjects de Garrigues tras el control (línea de base %)', v_n;
  end if;

  raise notice 'PROBE MOI-150 OK: órgano de otro tenant rechazado (proponer y confirmar), SECRETARIO sin AIMS_GOBIERNO rechazado, admin@grupo-nuevo-demo.dev declara el CdA de Corporación Nueva, S.A. y queda resoluble por resolveGoverningBodyIdFromSubjects, Garrigues sin cambio, sin residuo';
end;
$probe_moi150$;
