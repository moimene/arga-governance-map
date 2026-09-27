-- Ensayo acumulado del carril A (MOI-170, F2), sobre las 6 migraciones ya
-- cargadas por el ejecutor seguro. Corre COMO `authenticated` de verdad
-- (`set local role authenticated`) con sesiones reales de los tres tenants,
-- vía `set_config('request.jwt.claims', …, true)`. Todo dentro del
-- BEGIN … ROLLBACK del ejecutor: nada de esto queda en Cloud.
--
-- Complementa —no repite— las verificaciones que ya lleva cada migración: aquí
-- se prueba el CAMINO COMPLETO (RLS real + capacidad + RPC) con cuentas reales
-- de los tres tenants activos, algo que los bloques DO de las migraciones (que
-- corren como postgres, simulando solo con claims) no ejercitan.

-- ARGA: demo@ (SECRETARIO).
-- Garrigues: demo@ (SECRETARIO) y admin@ (ADMIN_TENANT).
-- Grupo nuevo: secretario y admin.
do $probe$
declare
  v_arga_demo uuid := '85e24c66-02c7-4175-b260-1330930ad49f';
  v_garr_demo uuid := '7ad12313-2a13-4c5c-b530-423c35ef049b';
  v_garr_admin uuid := '657c8700-c90f-4d22-b2db-5419d2d8e292';
  v_nuevo_secretario uuid := '6452252f-3214-4c9a-857b-b439626d215e';
  v_arga_sys uuid;
  v_garr_sys uuid;
  v_nuevo_sys uuid;
  v_arga_entidad uuid;
  v_garr_entidad uuid := '00000000-0000-0000-0002-000000000004';
  v_nuevo_entidad uuid := '45c8df67-64c9-42a3-abff-8047dd23748b';
  v_err text;
  v_id uuid;
  v_n int;
begin
  select id into v_arga_sys from public.ai_systems where tenant_id = '00000000-0000-0000-0000-000000000001' order by created_at limit 1;
  select id into v_garr_sys from public.ai_systems where tenant_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1;
  select id into v_nuevo_sys from public.ai_systems where tenant_id = '00000000-0000-0000-0000-000000000003' order by created_at limit 1;
  select id into v_arga_entidad from public.entities where tenant_id = '00000000-0000-0000-0000-000000000001' and legal_form in ('SLU', 'SA', 'SL') order by id limit 1;
  if v_arga_sys is null or v_garr_sys is null or v_nuevo_sys is null or v_arga_entidad is null then
    raise exception 'PROBE: falta dato real de los tres tenants (arga=%, garr=%, nuevo=%, entidad_arga=%)', v_arga_sys, v_garr_sys, v_nuevo_sys, v_arga_entidad;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 1. Grant: como authenticated real, un INSERT directo en aims_ria_subjects
  --    se rechaza por falta de privilegio (no hay política de escritura NI
  --    grant: "solo por RPC"). Debe fallar por PERMISO, no por lógica.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_arga_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    insert into public.aims_ria_subjects (tenant_id, system_id, entity_id, role, derivation)
    values ('00000000-0000-0000-0000-000000000001', v_arga_sys, v_arga_entidad, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    v_err := 'INSERTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err = 'INSERTADA' then
    raise exception 'PROBE: authenticated pudo insertar directamente en aims_ria_subjects (debe ser solo por RPC)';
  end if;
  if v_err !~* 'permission denied|not.*allowed|new row.*row-level security' then
    raise exception 'PROBE: el rechazo del INSERT directo no vino de permisos/RLS (%)', v_err;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 2. Camino completo real: ARGA demo@ (SECRETARIO) propone un sujeto de un
  --    sistema y una entidad de SU tenant, con RLS real (set local role) y la
  --    capacidad AIMS_CLASIFICAR resuelta por fn_secretaria_current_role_code
  --    desde user_profiles (no un role_code simulado).
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_arga_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_id := public.fn_aims_proponer_sujeto(v_arga_sys, v_arga_entidad, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' or v_id is null then
    raise exception 'PROBE: demo@arga (SECRETARIO real) no pudo proponer un sujeto de su propio tenant (%)', v_err;
  end if;

  -- El sujeto recién creado (real, vía RPC) es visible desde ARGA y NO desde
  -- Garrigues ni desde el grupo nuevo, con RLS real de por medio.
  perform set_config('request.jwt.claims', json_build_object('sub', v_arga_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.aims_ria_subjects where id = v_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_n <> 1 then
    raise exception 'PROBE: demo@arga no ve el sujeto que acaba de crear (RLS real)';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.aims_ria_subjects where id = v_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_n <> 0 then
    raise exception 'PROBE: demo@garrigues ve un sujeto de ARGA (RLS real rota)';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_nuevo_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.aims_ria_subjects where id = v_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_n <> 0 then
    raise exception 'PROBE: el secretario del grupo nuevo ve un sujeto de ARGA (RLS real rota)';
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. Cross-tenant: Garrigues NO puede proponer sujeto sobre un sistema de
  --    ARGA (real, con RLS activa: la propia consulta de pertenencia dentro
  --    de la RPC ya no ve el sistema de otro tenant).
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_aims_proponer_sujeto(v_arga_sys, v_arga_entidad, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    v_err := 'ACEPTADA';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err not like 'SISTEMA_DE_OTRO_TENANT%' then
    raise exception 'PROBE: demo@garrigues propuso un sujeto sobre un sistema de ARGA (%)', v_err;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 4. Camino completo real de evaluación + revisión en Garrigues: demo@
  --    redacta (assessor_id/created_by = SU persona, resuelto por el
  --    servidor), admin@ revisa (persona distinta, miembro vigente del mismo
  --    órgano que demo@). Con RLS real de las 4 tablas owner-write de AIMS.
  -- ─────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_garr_demo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  declare
    v_subject uuid;
    v_eval uuid;
    v_assessor uuid;
  begin
    v_subject := public.fn_aims_proponer_sujeto(v_garr_sys, v_garr_entidad, 'RESPONSABLE_DESPLIEGUE', 'SIEMBRA_HIPOTESIS');
    -- status distinto de BORRADOR: fn_aims_freeze_assessment rechaza congelar
    -- un borrador (BORRADOR_NO_CONGELABLE), y aquí sí queremos congelarla.
    insert into public.ai_risk_assessments (system_id, framework, status, subject_id)
    values (v_garr_sys, 'EU_AI_ACT', 'COMPLETADO', v_subject)
    returning id, assessor_id into v_eval, v_assessor;
    if v_assessor is distinct from (select person_id from public.user_profiles where user_id = v_garr_demo) then
      raise exception 'PROBE: assessor_id no es la persona real de demo@garrigues';
    end if;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- El órgano del sujeto lo asigna el gobierno de AIMS (fn_aims_declarar_especialidad
    -- no aplica aquí; fn_aims_proponer_sujeto no toma órgano). Se fija en directo,
    -- como postgres, apuntando al Comité de Gobernanza de la IA real de Garrigues
    -- —del que demo@ y admin@ ya son miembros vigentes, medido antes de escribir A5—
    -- para poder probar la pertenencia real más abajo.
    update public.aims_ria_subjects
       set governing_body_id = '432e420b-4db1-44f1-81da-e3575b1d3dec'
     where id = v_subject;

    -- Congelar como demo@ (tiene AIMS_EVALUAR).
    perform set_config('request.jwt.claims', json_build_object('sub', v_garr_demo, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.fn_aims_freeze_assessment(v_eval);
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Revisar como demo@ (mismo redactor): rechazado.
    perform set_config('request.jwt.claims', json_build_object('sub', v_garr_demo, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_err := null;
    begin
      perform public.fn_aims_review_assessment(v_eval, 'ACEPTA', 'no debería entrar');
      v_err := 'ACEPTADA';
    exception when others then
      v_err := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    if v_err not like 'MISMO_REDACTOR%' and v_err not like 'MISMO_EVALUADOR%' then
      raise exception 'PROBE: demo@garrigues revisó su propia evaluación (%)', v_err;
    end if;

    -- Revisar como admin@ (persona distinta, miembro vigente): entra.
    perform set_config('request.jwt.claims', json_build_object('sub', v_garr_admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_err := null;
    begin
      perform public.fn_aims_review_assessment(v_eval, 'ACEPTA', 'revisado en el ensayo del carril A');
      v_err := 'OK';
    exception when others then
      v_err := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    if v_err <> 'OK' then
      raise exception 'PROBE: admin@garrigues (revisor legítimo) no pudo revisar (%)', v_err;
    end if;
  end;

  -- ─────────────────────────────────────────────────────────────────────
  -- 5. Tenant-isolation ampliada: las tablas nuevas no cruzan entre los tres
  --    tenants activos (aserción directamente sobre el dato creado arriba).
  -- ─────────────────────────────────────────────────────────────────────
  if exists (
    select 1 from public.aims_ria_subjects
     where tenant_id = '00000000-0000-0000-0000-000000000001'
       and entity_id in (select id from public.entities where tenant_id <> '00000000-0000-0000-0000-000000000001')
  ) then
    raise exception 'PROBE: hay un sujeto de ARGA con entidad de otro tenant (fk_misma_tenant no protegió)';
  end if;

  raise exception 'PROBE_REVERTIDO';
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if sqlerrm <> 'PROBE_REVERTIDO' then
    raise exception 'PROBE FALLIDO: %', sqlerrm;
  end if;
  raise notice 'PROBE OK: grant solo-RPC real, camino completo demo@arga/demo@garrigues/admin@garrigues con RLS real, aislamiento cross-tenant en los 3 tenants activos, cuatro ojos real con personas reales';
end;
$probe$;
