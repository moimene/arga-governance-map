-- Ensayo revertido de 20260928110000_grc_terceros_ia.sql (MOI-175, F5.T9).
-- Ejecutar con: python3 /tmp/probe_rollback.py
--   supabase/migrations/20260928110000_grc_terceros_ia.sql
--   supabase/migrations/proposed/20260928110000_grc_terceros_ia.probe.sql
-- Todo bajo BEGIN ... ROLLBACK del ejecutor. El ejecutor rechaza cualquier
-- ROLLBACK/SAVEPOINT de nivel superior, así que cada caso (positivo o
-- negativo) va en su propio DO con BEGIN...EXCEPTION...END: el positivo se
-- deshace lanzando y capturando un SQLSTATE propio; el negativo captura el
-- error real que debía producirse.
--
-- No hay RPC en F5.T9 (la especificación no la pide): el alta va por
-- PostgREST/cliente directo contra grc_third_parties, protegida solo por la
-- RLS de tenant ya existente en la tabla. Este ensayo prueba esa RLS con las
-- columnas nuevas, con sesiones reales (ARGA SECRETARIO, Garrigues SECRETARIO).

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '85e24c66-02c7-4175-b260-1330930ad49f', 'role', 'authenticated')::text,
  true
);

-- 1) Control positivo: la sesión ARGA da de alta un tercero IA en su propio
--    tenant y las 5 columnas nuevas se leen de vuelta tal cual.
DO $t9_alta_arga$
DECLARE
  v_leida record;
BEGIN
  BEGIN
    INSERT INTO public.grc_third_parties (
      tenant_id, id, provider, service, criticality, cloud_exposure,
      regulatory_basis, owner, legal_entity_name, country, is_ai_supplier, ai_roles
    ) VALUES (
      '00000000-0000-0000-0000-000000000001', '__PROBE_T9_ARGA__', 'Palantir', 'FraudGuard',
      'Pendiente', 'Servicio API en la nube', 'Reglamento (UE) 2024/1689 (RIA)', 'Pendiente de asignación',
      'Palantir', 'US', true, '{}'::text[]
    );
    SELECT * INTO v_leida FROM public.grc_third_parties WHERE id = '__PROBE_T9_ARGA__';
    IF v_leida.id IS NULL OR v_leida.country IS DISTINCT FROM 'US' OR v_leida.is_ai_supplier IS NOT true THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T9: el alta en el propio tenant (ARGA) no se leyó de vuelta correctamente';
    END IF;
    RAISE NOTICE 'PROBE OK: tercero IA sembrado y leído en ARGA (id=%)', v_leida.id;
    RAISE EXCEPTION USING ERRCODE = 'P0920', MESSAGE = 'deshacer sonda F5.T9 (alta ARGA)';
  EXCEPTION
    WHEN SQLSTATE 'P0920' THEN NULL; -- deshecho a propósito, sin residuo
  END;
END;
$t9_alta_arga$;

-- 2) Control negativo: la misma sesión ARGA no puede dar de alta un tercero
--    con tenant_id de Garrigues -- la RLS existente (WITH CHECK tenant_id =
--    fn_current_tenant_id()) también gobierna las columnas nuevas.
DO $t9_negativo_cross$
BEGIN
  INSERT INTO public.grc_third_parties (
    tenant_id, id, provider, service, criticality, cloud_exposure,
    regulatory_basis, owner
  ) VALUES (
    '00000000-0000-0000-0000-000000000002', '__PROBE_T9_CROSS__', 'Probe', 'Probe', 'Pendiente',
    'Probe', 'Probe', 'Probe'
  );
  RAISE EXCEPTION 'PROBE MOI-175 F5.T9: el INSERT cruzado (sesión ARGA, tenant Garrigues) debería haberse rechazado y no lo fue';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PROBE OK: INSERT cruzado rechazado por RLS (insufficient_privilege / 42501)';
END;
$t9_negativo_cross$;

-- 3) Control positivo con la sesión Garrigues (demo@, SECRETARIO): alta de
--    Harvey con la razón social que fija la especificación (Counsel AI
--    Corporation), sin ai_roles (solo OpenAI/Anthropic llevan
--    PROVEEDOR_MODELO_GPAI según la especificación) y sin eu_representative
--    (declarado "por declarar" en el texto, NULL = no inventado).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '7ad12313-2a13-4c5c-b530-423c35ef049b', 'role', 'authenticated')::text,
  true
);
DO $t9_alta_garrigues$
DECLARE
  v_leida record;
BEGIN
  BEGIN
    INSERT INTO public.grc_third_parties (
      tenant_id, id, provider, service, criticality, cloud_exposure,
      regulatory_basis, owner, legal_entity_name, country, is_ai_supplier
    ) VALUES (
      '00000000-0000-0000-0000-000000000002', '__PROBE_T9_GARR_HARVEY__', 'Harvey',
      'Plataforma de IA generativa legal', 'Pendiente', 'Servicio API en la nube',
      'Reglamento (UE) 2024/1689 (RIA)', 'Pendiente de asignación', 'Counsel AI Corporation', 'US', true
    );
    SELECT * INTO v_leida FROM public.grc_third_parties WHERE id = '__PROBE_T9_GARR_HARVEY__';
    IF v_leida.legal_entity_name IS DISTINCT FROM 'Counsel AI Corporation' THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T9: legal_entity_name de Harvey no se guardó como Counsel AI Corporation';
    END IF;
    IF v_leida.eu_representative IS NOT NULL THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T9: eu_representative de Harvey debía quedar NULL (por declarar), no inventado';
    END IF;
    IF v_leida.ai_roles <> '{}'::text[] THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T9: ai_roles de Harvey debía quedar vacío (rol no fijado por la especificación)';
    END IF;
    RAISE NOTICE 'PROBE OK: Harvey sembrado con su razón social en Garrigues, sin datos inventados';
    RAISE EXCEPTION USING ERRCODE = 'P0921', MESSAGE = 'deshacer sonda F5.T9 (Harvey)';
  EXCEPTION
    WHEN SQLSTATE 'P0921' THEN NULL;
  END;
END;
$t9_alta_garrigues$;

-- 4) Control positivo del rol declarado: OpenAI sí lleva
--    PROVEEDOR_MODELO_GPAI, tal como fija la especificación.
DO $t9_gpai$
DECLARE
  v_leida record;
BEGIN
  BEGIN
    INSERT INTO public.grc_third_parties (
      tenant_id, id, provider, service, criticality, cloud_exposure,
      regulatory_basis, owner, is_ai_supplier, ai_roles
    ) VALUES (
      '00000000-0000-0000-0000-000000000002', '__PROBE_T9_GARR_OPENAI__', 'OpenAI',
      'Modelo GPAI (GA_IA)', 'Pendiente', 'Servicio API en la nube',
      'Reglamento (UE) 2024/1689 (RIA)', 'Pendiente de asignación', true, ARRAY['PROVEEDOR_MODELO_GPAI']
    );
    SELECT * INTO v_leida FROM public.grc_third_parties WHERE id = '__PROBE_T9_GARR_OPENAI__';
    IF v_leida.ai_roles <> ARRAY['PROVEEDOR_MODELO_GPAI'] THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T9: ai_roles de OpenAI debía ser {PROVEEDOR_MODELO_GPAI}';
    END IF;
    RAISE NOTICE 'PROBE OK: OpenAI sembrado con ai_roles = PROVEEDOR_MODELO_GPAI';
    RAISE EXCEPTION USING ERRCODE = 'P0922', MESSAGE = 'deshacer sonda F5.T9 (OpenAI)';
  EXCEPTION
    WHEN SQLSTATE 'P0922' THEN NULL;
  END;
END;
$t9_gpai$;

-- Ningún tercero de sonda sobrevive: cada DO deshizo su propio INSERT antes
-- de terminar (el ROLLBACK final del ejecutor lo confirma de todos modos).
DO $t9_sin_residuo$
BEGIN
  IF EXISTS (SELECT 1 FROM public.grc_third_parties WHERE id LIKE '__PROBE_T9_%') THEN
    RAISE EXCEPTION 'PROBE MOI-175 F5.T9: quedó residuo de la sonda en grc_third_parties';
  END IF;
END;
$t9_sin_residuo$;
