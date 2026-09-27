-- Ensayo revertido de 20260928111000_grc_aristas_ia.sql (MOI-175, F5.T10).
-- Ejecutar con: python3 /tmp/probe_rollback.py
--   supabase/migrations/20260928111000_grc_aristas_ia.sql
--   supabase/migrations/proposed/20260928111000_grc_aristas_ia.probe.sql
--
-- El DO $verify$ de la propia migración ya comprueba forma/grants/capacidad y
-- un INSERT directo como el rol de la migración (no como `authenticated`).
-- Este ensayo prueba lo que sólo se puede probar con una sesión real:
--   * G-VIVO-NEG (permanente en el ledger, no en `bun test`: la RPC exige
--     tenant/rol reales que no están disponibles en el runner): SECRETARIO
--     sin capacidad, tenant ajeno, objeto de otro tenant, INSERT directo.
--   * G-VIVO-REV (archivado, se deshace): ADMIN_TENANT sí puede vincular.
--
-- IDs reales leídos por SELECT antes de escribir esta sonda (2026-09-27):
--   CTR-GARR-33          = 27a487c9-4444-4257-868c-01602078e379 (Garrigues)
--   OBL-GARR-CYBER-02    = ac5102cd-dc0d-48ac-8e9a-3cba254ed589 (Garrigues)
--   Harvey (ai_systems)  = 2f877e8c-875d-4b11-9b39-aed0826cacb5 (Garrigues)
--   Incidente IA         = 447d97c2-a118-460f-91f5-509edc4499c7 (Garrigues)
--   CTR-004              = faf7131b-4e90-4c55-b0c1-01daef6da9e3 (ARGA)
--   ARGA Score (sistema) = 1148370a-42bb-4a42-9a97-529ce58e800d (ARGA)

-- 0) Un INSERT directo (sin pasar por la RPC) como `authenticated` se
--    rechaza: no hay política de escritura, sólo el GRANT SELECT.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '7ad12313-2a13-4c5c-b530-423c35ef049b', 'role', 'authenticated')::text,
  true
);
DO $t10_insert_directo$
BEGIN
  INSERT INTO public.grc_ai_links (tenant_id, grc_kind, grc_id, ai_system_id, relation)
  VALUES ('00000000-0000-0000-0000-000000000002', 'CONTROL', '27a487c9-4444-4257-868c-01602078e379', '2f877e8c-875d-4b11-9b39-aed0826cacb5', 'MITIGA');
  RAISE EXCEPTION 'PROBE MOI-175 F5.T10: el INSERT directo (sin RPC) debería haberse rechazado y no lo fue';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PROBE OK: INSERT directo rechazado (sin política de escritura, sólo SELECT)';
END;
$t10_insert_directo$;

-- 1) G-VIVO-NEG: SECRETARIO (demo@garrigues-demo.dev) no tiene la capacidad
--    GRC_AI_LINK.
DO $t10_secretario_sin_capacidad$
DECLARE
  v_id uuid;
BEGIN
  SELECT public.fn_grc_vincular_ia(
    '00000000-0000-0000-0000-000000000002', 'CONTROL', '27a487c9-4444-4257-868c-01602078e379',
    'MITIGA', '2f877e8c-875d-4b11-9b39-aed0826cacb5'
  ) INTO v_id;
  RAISE EXCEPTION 'PROBE MOI-175 F5.T10: SECRETARIO pudo vincular sin capacidad GRC_AI_LINK (id=%)', v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%capability%denied%' OR SQLERRM LIKE '%GRC_AI_LINK%' THEN
      RAISE NOTICE 'PROBE OK: SECRETARIO rechazado por falta de capacidad GRC_AI_LINK (%)', SQLERRM;
    ELSE
      RAISE;
    END IF;
END;
$t10_secretario_sin_capacidad$;

-- 2) G-VIVO-REV: ADMIN_TENANT (admin@garrigues-demo.dev) sí puede vincular
--    CTR-GARR-33 a Harvey, y el enlace se lee de vuelta -- se deshace acto
--    seguido, sin residuo.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '657c8700-c90f-4d22-b2db-5419d2d8e292', 'role', 'authenticated')::text,
  true
);
DO $t10_admin_positivo$
DECLARE
  v_id uuid;
  v_leida record;
BEGIN
  BEGIN
    SELECT public.fn_grc_vincular_ia(
      '00000000-0000-0000-0000-000000000002', 'CONTROL', '27a487c9-4444-4257-868c-01602078e379',
      'MITIGA', '2f877e8c-875d-4b11-9b39-aed0826cacb5', NULL, NULL, NULL, 'Sonda F5.T10: CTR-GARR-33 mitiga Harvey'
    ) INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T10: fn_grc_vincular_ia no devolvió id';
    END IF;
    SELECT * INTO v_leida FROM public.grc_ai_links WHERE id = v_id;
    IF v_leida.ai_target IS DISTINCT FROM '2f877e8c-875d-4b11-9b39-aed0826cacb5'::uuid THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T10: ai_target del enlace no coincide con Harvey';
    END IF;
    RAISE NOTICE 'PROBE OK: ADMIN_TENANT vinculó CTR-GARR-33 a Harvey (id=%)', v_id;
    -- Sin mover la FK de CTR-GARR-33: obligation_id debe seguir intacto.
    IF (SELECT obligation_id FROM public.controls WHERE id = '27a487c9-4444-4257-868c-01602078e379')
       IS DISTINCT FROM '77e45ac1-11a4-40d5-8a67-2b840d875a40'::uuid THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T10: obligation_id de CTR-GARR-33 se movió (no debía)';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0912', MESSAGE = 'deshacer sonda F5.T10 (positivo ADMIN_TENANT)';
  EXCEPTION
    WHEN SQLSTATE 'P0912' THEN NULL;
  END;
END;
$t10_admin_positivo$;

-- 3) Idempotencia de la RPC: el mismo (tenant, kind, id, relation, target) se
--    actualiza (UPSERT), no duplica. Se prueba con dos llamadas seguidas
--    dentro del mismo bloque, deshecho al final.
DO $t10_idempotente$
DECLARE
  v_id1 uuid;
  v_id2 uuid;
  v_total int;
BEGIN
  BEGIN
    SELECT public.fn_grc_vincular_ia(
      '00000000-0000-0000-0000-000000000002', 'OBLIGATION', 'ac5102cd-dc0d-48ac-8e9a-3cba254ed589',
      'NOTIFICA_SEGUN', NULL, '447d97c2-a118-460f-91f5-509edc4499c7', NULL, NULL, 'Sonda F5.T10: primera llamada'
    ) INTO v_id1;
    SELECT public.fn_grc_vincular_ia(
      '00000000-0000-0000-0000-000000000002', 'OBLIGATION', 'ac5102cd-dc0d-48ac-8e9a-3cba254ed589',
      'NOTIFICA_SEGUN', NULL, '447d97c2-a118-460f-91f5-509edc4499c7', NULL, NULL, 'Sonda F5.T10: segunda llamada'
    ) INTO v_id2;
    IF v_id1 <> v_id2 THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T10: la segunda llamada creó una fila nueva (id1=%, id2=%) en vez de actualizar', v_id1, v_id2;
    END IF;
    SELECT count(*) INTO v_total FROM public.grc_ai_links
     WHERE grc_kind = 'OBLIGATION' AND grc_id = 'ac5102cd-dc0d-48ac-8e9a-3cba254ed589' AND ai_incident_id = '447d97c2-a118-460f-91f5-509edc4499c7';
    IF v_total <> 1 THEN
      RAISE EXCEPTION 'PROBE MOI-175 F5.T10: se esperaba 1 fila para OBL-GARR-CYBER-02 x incidente, hay %', v_total;
    END IF;
    RAISE NOTICE 'PROBE OK: OBL-GARR-CYBER-02 enlazada al incidente, idempotente (id=%)', v_id1;
    RAISE EXCEPTION USING ERRCODE = 'P0913', MESSAGE = 'deshacer sonda F5.T10 (idempotencia)';
  EXCEPTION
    WHEN SQLSTATE 'P0913' THEN NULL;
  END;
END;
$t10_idempotente$;

-- 4) G-VIVO-NEG: el mismo ADMIN_TENANT de Garrigues no puede pedir un enlace
--    con p_tenant_id de ARGA (acceso a otro tenant, fuera de su sesión).
DO $t10_tenant_ajeno$
DECLARE
  v_id uuid;
BEGIN
  SELECT public.fn_grc_vincular_ia(
    '00000000-0000-0000-0000-000000000001', 'CONTROL', 'faf7131b-4e90-4c55-b0c1-01daef6da9e3',
    'MITIGA', '1148370a-42bb-4a42-9a97-529ce58e800d'
  ) INTO v_id;
  RAISE EXCEPTION 'PROBE MOI-175 F5.T10: se aceptó un p_tenant_id ajeno a la sesión (id=%)', v_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PROBE OK: p_tenant_id ajeno a la sesión rechazado (%)', SQLERRM;
END;
$t10_tenant_ajeno$;

-- 5) G-VIVO-NEG: dentro del propio tenant Garrigues, un grc_id que en
--    realidad es de ARGA se rechaza (el objeto no pertenece al tenant, no
--    sólo la sesión).
DO $t10_objeto_ajeno$
DECLARE
  v_id uuid;
BEGIN
  SELECT public.fn_grc_vincular_ia(
    '00000000-0000-0000-0000-000000000002', 'CONTROL', 'faf7131b-4e90-4c55-b0c1-01daef6da9e3',
    'MITIGA', '2f877e8c-875d-4b11-9b39-aed0826cacb5'
  ) INTO v_id;
  RAISE EXCEPTION 'PROBE MOI-175 F5.T10: se aceptó un grc_id de otro tenant (id=%)', v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%GRC_AI_LINK_GRC_ID_NO_PERTENECE_AL_TENANT%' THEN
      RAISE NOTICE 'PROBE OK: grc_id de otro tenant rechazado (%)', SQLERRM;
    ELSE
      RAISE;
    END IF;
END;
$t10_objeto_ajeno$;

-- Sin residuo: todos los DO positivos se deshicieron con su propio SQLSTATE.
DO $t10_sin_residuo$
BEGIN
  IF EXISTS (SELECT 1 FROM public.grc_ai_links WHERE rationale LIKE 'Sonda F5.T10%') THEN
    RAISE EXCEPTION 'PROBE MOI-175 F5.T10: quedó residuo de la sonda en grc_ai_links';
  END IF;
END;
$t10_sin_residuo$;
