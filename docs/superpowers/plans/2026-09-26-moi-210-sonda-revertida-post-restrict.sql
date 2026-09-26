-- MOI-210 — sonda revertida (G-VIVO-REV) del camino positivo que
-- `aims-cuestionario-live.test.ts` y `garrigues-ia-owner-write.test.ts`
-- verificaban antes creando un sistema real y borrandolo por CASCADE.
--
-- Con las 4 FK de `20260926121000_aims_ai_systems_fk_restrict.sql` en
-- RESTRICT, ese borrado ya no es posible: una sonda que cree un sistema con
-- cuestionario COMPLETED no puede limpiarse borrando el sistema (DS-31,
-- docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md).
-- El camino positivo pasa aqui, a una sonda que se deshace sola con ROLLBACK.
--
-- La ejecuta el orquestador (MCP execute_sql o psql), NUNCA el agente de la
-- tarea (regla de la sesion MOI-210: solo SELECT/pg_get_functiondef fuera de
-- este fichero). Su salida se archiva en el ledger
-- (docs/superpowers/plans/2026-09-26-ledger-cierre-masivo-linear.md), igual
-- que la sonda de 27 pasos de `2026-09-08-ledger-refactor-aims.md` §H-1.
--
-- Se ejecuta DESPUES de aplicar 20260926121000 (o dentro de la misma
-- transaccion revertida que la aplica, como en el .probe.sql hermano).
--
-- Cubre exactamente los pasos que las dos sondas vivas dejan de poder probar
-- con datos reales tras el cambio:
--   Bloque 1 — alta por fn_aims_registrar_sistema (antes:
--     garrigues-ia-owner-write.test.ts "el owner-write... funciona por la
--     RPC" + "Garrigues ve su fila" + "ARGA no ve la fila de Garrigues" +
--     "ARGA no puede mutar ni borrar la fila del otro tenant").
--   Bloque 2 — la RPC ignora un tenant forjado por el cliente (antes:
--     "la RPC no acepta un tenant del cliente").
--   Bloque 3 — ciclo completo del cuestionario: alta, inmutabilidad,
--     bloqueo de edicion directa de rol/nivel, reclasificacion v2 con
--     art. 6.3, practica prohibida, sin DELETE, aislamiento en las dos
--     direcciones (antes: los seis tests centrales de
--     aims-cuestionario-live.test.ts que creaban sistemaGarr/sistemaArga).

begin;

-- Sesion simulada de Garrigues.
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000ep210","tenant_id":"00000000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Bloque 1 — alta por RPC + aislamiento con fila real (garrigues-ia-owner-write)
-- ---------------------------------------------------------------------------
do $$
declare
  v_fila record;
  v_system uuid;
begin
  select * into v_fila from public.fn_aims_registrar_sistema(
    jsonb_build_object('name', 'PROBE-MOI-210-OWNER-WRITE', 'status', 'ACTIVO'),
    jsonb_build_object(
      'questionnaire_version', '1.1',
      'phase1_responses', jsonb_build_object('Q1_1', false, 'Q1_2', false, 'Q1_3', false, 'Q1_4', true),
      'phase2_responses', jsonb_build_object('Q2_1', false, 'Q2_2', false, 'Q2_4', true, 'Q2_5', true),
      'computed_role', 'RESPONSABLE_DESPLIEGUE',
      'computed_risk_level', 'Limitado',
      'gpai_dependency', false,
      'applicable_frameworks', '[]'::jsonb,
      'catalog_profile', 'PROFILE_C'
    )
  );
  v_system := v_fila.system_id;
  raise notice 'Bloque 1: alta OK, system_id=%, content_hash=%', v_system, v_fila.content_hash;

  if not exists (select 1 from public.ai_systems where id = v_system and tenant_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'Bloque 1: el sistema no nacio en el tenant de Garrigues';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000ep210a","tenant_id":"00000000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;

-- ARGA no ve ni muta la fila de Garrigues.
do $$
declare
  v_system uuid;
  v_count integer;
begin
  select id into v_system from public.ai_systems where name = 'PROBE-MOI-210-OWNER-WRITE';
  -- Bajo la sesion de ARGA, RLS ya deberia dejar esto en 0 filas (no error).
  select count(*) into v_count from public.ai_systems where name = 'PROBE-MOI-210-OWNER-WRITE';
  if v_count <> 0 then
    raise exception 'Bloque 1: la sesion de ARGA ve la fila de Garrigues (%)', v_count;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000ep210","tenant_id":"00000000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Bloque 2 — la RPC ignora un tenant forjado por el cliente
-- ---------------------------------------------------------------------------
do $$
declare
  v_fila record;
begin
  select * into v_fila from public.fn_aims_registrar_sistema(
    jsonb_build_object('name', 'PROBE-MOI-210-FORJADO', 'status', 'ACTIVO', 'tenant_id', '00000000-0000-0000-0000-000000000001'),
    jsonb_build_object(
      'questionnaire_version', '1.1',
      'phase1_responses', jsonb_build_object('Q1_1', false, 'Q1_2', false, 'Q1_3', false, 'Q1_4', true),
      'phase2_responses', jsonb_build_object('Q2_1', false, 'Q2_2', false, 'Q2_4', true, 'Q2_5', true),
      'computed_role', 'RESPONSABLE_DESPLIEGUE',
      'computed_risk_level', 'Limitado',
      'gpai_dependency', false,
      'applicable_frameworks', '[]'::jsonb,
      'catalog_profile', 'PROFILE_C'
    )
  );
  if not exists (select 1 from public.ai_systems where id = v_fila.system_id and tenant_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'Bloque 2: el tenant forjado en p_sistema coló y el sistema no nacio en Garrigues';
  end if;
  raise notice 'Bloque 2: tenant forjado ignorado, sistema nacio en Garrigues como se esperaba';
end $$;

-- ---------------------------------------------------------------------------
-- Bloque 3 — ciclo del cuestionario: inmutabilidad, bloqueo de edicion
-- directa, reclasificacion v2 con art. 6.3, practica prohibida, sin DELETE
-- (aims-cuestionario-live.test.ts, los seis tests centrales)
-- ---------------------------------------------------------------------------
do $$
declare
  v_fila record;
  v_system uuid;
  v_cuestionario uuid;
  v_draft_id uuid;
  v_err text;
begin
  select * into v_fila from public.fn_aims_registrar_sistema(
    jsonb_build_object('name', 'PROBE-MOI-210-CUESTIONARIO', 'status', 'EN_EVALUACION'),
    jsonb_build_object(
      'questionnaire_version', '1.1',
      'phase1_responses', jsonb_build_object('Q1_1', false, 'Q1_2', false, 'Q1_3', false, 'Q1_4', true),
      'phase2_responses', jsonb_build_object('Q2_1', false, 'Q2_2', false, 'Q2_4', true, 'Q2_5', true),
      'computed_role', 'RESPONSABLE_DESPLIEGUE',
      'computed_risk_level', 'Limitado',
      'gpai_dependency', false,
      'applicable_frameworks', '[]'::jsonb,
      'catalog_profile', 'PROFILE_C'
    )
  );
  v_system := v_fila.system_id;
  v_cuestionario := v_fila.cuestionario_id;
  if v_fila.content_hash !~ '^[0-9a-f]{128}$' then
    raise exception 'Bloque 3: content_hash no tiene forma SHA-512 (%)', v_fila.content_hash;
  end if;

  -- inmutable para su propio dueño
  begin
    update public.aims_classification_questionnaires set phase2_art63_justification = 'manipulado' where id = v_cuestionario;
    raise exception 'Bloque 3: la COMPLETED se dejo editar';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err !~ 'CUESTIONARIO_COMPLETADO_INMUTABLE' then raise exception 'Bloque 3: error inesperado en UPDATE de la COMPLETED: %', v_err; end if;
  end;

  -- rol/nivel solo por cuestionario
  begin
    update public.ai_systems set risk_level = 'Alto' where id = v_system;
    raise exception 'Bloque 3: risk_level se dejo editar a mano';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err !~ 'CLASIFICACION_SOLO_POR_CUESTIONARIO' then raise exception 'Bloque 3: error inesperado en UPDATE de risk_level: %', v_err; end if;
  end;

  -- reclasificar v2 con excepcion del art. 6.3 y motivacion
  insert into public.aims_classification_questionnaires (tenant_id, system_id, questionnaire_version)
  values ('00000000-0000-0000-0000-000000000002', v_system, '1.1')
  returning id into v_draft_id;

  update public.aims_classification_questionnaires
    set phase1_responses = jsonb_build_object('Q1_1', false, 'Q1_2', false, 'Q1_3', false, 'Q1_4', true),
        phase2_responses = jsonb_build_object('Q2_1', false, 'Q2_2', true, 'Q2_3', true, 'Q2_4', true, 'Q2_5', true),
        phase2_art63_justification = 'Uso interno de bajo importe, sin decisiones automatizadas sobre personas ni efectos juridicos.',
        computed_role = 'RESPONSABLE_DESPLIEGUE', computed_risk_level = 'Alto', gpai_dependency = false,
        applicable_frameworks = '[]'::jsonb, catalog_profile = 'PROFILE_B'
    where id = v_draft_id;

  perform public.fn_aims_completar_cuestionario(v_draft_id);

  if (select status from public.aims_classification_questionnaires where id = v_cuestionario) <> 'SUPERSEDED' then
    raise exception 'Bloque 3: v1 no quedo SUPERSEDED tras completar v2';
  end if;

  -- practica prohibida no se registra (transaccion propia de la RPC se revierte sola)
  begin
    perform public.fn_aims_registrar_sistema(
      jsonb_build_object('name', 'PROBE-MOI-210-PROHIBIDA'),
      jsonb_build_object('questionnaire_version', '1.1',
        'phase1_responses', jsonb_build_object('Q1_1', false, 'Q1_2', false, 'Q1_3', false, 'Q1_4', true),
        'phase2_responses', jsonb_build_object('Q2_1', true),
        'computed_role', 'RESPONSABLE_DESPLIEGUE', 'computed_risk_level', 'Inaceptable',
        'gpai_dependency', false, 'applicable_frameworks', '[]'::jsonb, 'catalog_profile', null)
    );
    raise exception 'Bloque 3: una practica prohibida se registro';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err !~ 'PRACTICA_PROHIBIDA_BLOQUEA' then raise exception 'Bloque 3: error inesperado en el alta prohibida: %', v_err; end if;
  end;
  if exists (select 1 from public.ai_systems where name = 'PROBE-MOI-210-PROHIBIDA') then
    raise exception 'Bloque 3: quedo residuo de la practica prohibida';
  end if;

  -- sin DELETE de cuestionarios desde la aplicacion
  begin
    delete from public.aims_classification_questionnaires where id = v_cuestionario;
    raise exception 'Bloque 3: el DELETE de un cuestionario no fue rechazado';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  raise notice 'Bloque 3: OK — system=%, v1=% (SUPERSEDED), v2=% (COMPLETED)', v_system, v_cuestionario, v_draft_id;
end $$;

-- Verificacion final: nada de esto persiste.
select 'antes de rollback, ver que estas filas existen solo dentro de la transaccion' as nota;
select count(*) from public.ai_systems where name like 'PROBE-MOI-210-%';

rollback;

-- Tras ejecutar: pegar en el ledger (2026-09-26-ledger-cierre-masivo-linear.md,
-- seccion 5) los `notice` y el resultado del SELECT final, y confirmar por
-- separado (fuera de esta transaccion, de solo lectura) que
-- `select count(*) from ai_systems where name like 'PROBE%'` sigue en 0.
