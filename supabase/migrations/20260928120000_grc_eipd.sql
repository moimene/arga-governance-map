-- 20260928120000_grc_eipd.sql (MOI-175, F5.T11)
--
-- EIPD (Evaluación de Impacto en Protección de Datos, art. 35 RGPD) como
-- objeto propio de GRC — DISTINTO de la EIDF del art. 27 RIA (DS-37, RH-5):
-- la EIDF cubre derechos más amplios (igualdad, no discriminación, tutela
-- judicial) que la EIPD no evalúa. Esta migración solo construye el esquema
-- y la RPC de registro; NO determina la necesidad de EIPD de ningún caso
-- real — esa determinación es del DPO (MOI-156).
--
-- DECISIÓN DE DISEÑO (criterio C5, validado por Harvey en H-01, spec
-- 2026-09-19 §4.5/§5.4): la necesidad de EIPD nunca nace "NO_REQUERIDA" por
-- el mero nivel de riesgo RIA. Su valor por defecto es SIEMPRE 'PENDIENTE' y
-- toda determinación —también PENDIENTE— exige un motivo explícito
-- (`necessity_rationale NOT NULL`). Quien quiera fijar REQUERIDA o
-- NO_REQUERIDA_MOTIVADA sin pasar un motivo recibe NECESIDAD_SIN_MOTIVO.
--
-- ESCRITURA GOBERNADA: la tabla no concede INSERT/UPDATE/DELETE a
-- `authenticated` — todo pasa por `fn_grc_registrar_eipd` (SECURITY DEFINER),
-- que además comprueba que `entity_id`/`ai_system_id` pertenecen al tenant de
-- la sesión. `anon` no tiene ningún grant. Consistente con el patrón ya usado
-- para RPC gobernadas (fn_secretaria_registrar_dictamen_ia, migración
-- hermana 20260928121000; fn_aims_registrar_sistema).
--
-- CERO CAMBIO ARGA/GARRIGUES: tabla nueva, ninguna fila se siembra aquí.

CREATE TABLE IF NOT EXISTS public.grc_dpias (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid NOT NULL,
  code                         text NOT NULL,
  entity_id                    uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  controller_role              text NOT NULL
                                CHECK (controller_role IN ('RESPONSABLE', 'CORRESPONSABLE', 'ENCARGADO')),
  ai_system_id                 uuid REFERENCES public.ai_systems(id) ON DELETE SET NULL,
  processing_description       text NOT NULL,
  necessity_criteria           jsonb NOT NULL DEFAULT '{}'::jsonb,
  necessity_result             text NOT NULL DEFAULT 'PENDIENTE'
                                CHECK (necessity_result IN ('REQUERIDA', 'NO_REQUERIDA_MOTIVADA', 'PENDIENTE')),
  -- NOT NULL a propósito: "la necesidad exige motivo" es una invariante de
  -- columna, no solo de la RPC (defensa en profundidad).
  necessity_rationale          text NOT NULL,
  dpo_person_id                uuid REFERENCES public.persons(id),
  dpo_consulted_at             timestamptz,
  dpo_opinion                  text,
  prior_consultation_required  boolean NOT NULL DEFAULT false,
  prior_consultation_at        timestamptz,
  result                       text,
  residual_high                boolean,
  instructions_record_id       uuid,
  rat_ref                      text,
  status                       text NOT NULL DEFAULT 'BORRADOR'
                                CHECK (status IN ('BORRADOR', 'EN_CURSO', 'APROBADA')),
  approved_by_body_id          uuid REFERENCES public.governing_bodies(id),
  approved_at                  timestamptz,
  next_review_date             date,
  content_hash                 text,
  created_by                   uuid,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grc_dpias_tenant_code_key UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.grc_dpias IS
  'MOI-175 F5.T11 — EIPD (art. 35 RGPD). Objeto distinto de la EIDF del art. 27 RIA (DS-37). Escritura solo por fn_grc_registrar_eipd.';
COMMENT ON COLUMN public.grc_dpias.necessity_result IS
  'REQUERIDA | NO_REQUERIDA_MOTIVADA | PENDIENTE. Por defecto PENDIENTE (C5): nunca se infiere "no requerida" del nivel de riesgo RIA.';
COMMENT ON COLUMN public.grc_dpias.necessity_rationale IS
  'Motivo de la determinación de necesidad. NOT NULL: toda fila, incluida PENDIENTE, lleva su motivo.';

CREATE INDEX IF NOT EXISTS idx_grc_dpias_tenant_entity ON public.grc_dpias (tenant_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_grc_dpias_ai_system ON public.grc_dpias (ai_system_id) WHERE ai_system_id IS NOT NULL;

ALTER TABLE public.grc_dpias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grc_dpias_tenant_read ON public.grc_dpias;
CREATE POLICY grc_dpias_tenant_read
  ON public.grc_dpias FOR SELECT
  TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

-- Sin política de escritura: el único camino es la RPC (SECURITY DEFINER,
-- corre como el propietario de la función y no necesita policy). Un GRANT es
-- aditivo (gotcha medido repetidamente en este programa): se revoca
-- explícitamente lo que las privilegios por defecto del esquema conceden.
REVOKE ALL ON public.grc_dpias FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.grc_dpias FROM authenticated;
GRANT SELECT ON public.grc_dpias TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC de registro/actualización, idempotente por (tenant_id, code).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_grc_registrar_eipd(
  p_code                        text,
  p_entity_id                   uuid,
  p_controller_role             text,
  p_processing_description      text,
  p_ai_system_id                uuid DEFAULT NULL,
  p_necessity_result            text DEFAULT 'PENDIENTE',
  p_necessity_rationale         text DEFAULT NULL,
  p_necessity_criteria          jsonb DEFAULT '{}'::jsonb,
  p_dpo_person_id               uuid DEFAULT NULL,
  p_dpo_opinion                 text DEFAULT NULL,
  p_prior_consultation_required boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tenant uuid := public.fn_current_tenant_id();
  v_rationale text;
  v_id uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: sin tenant de sesión' USING ERRCODE = '42501';
  END IF;

  IF p_controller_role NOT IN ('RESPONSABLE', 'CORRESPONSABLE', 'ENCARGADO') THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: controller_role % inválido', p_controller_role USING ERRCODE = '22023';
  END IF;

  IF p_necessity_result NOT IN ('REQUERIDA', 'NO_REQUERIDA_MOTIVADA', 'PENDIENTE') THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: necessity_result % inválido', p_necessity_result USING ERRCODE = '22023';
  END IF;

  -- La necesidad SIEMPRE exige motivo (C5). PENDIENTE sin motivo explícito
  -- recibe uno por defecto que dice la verdad: nadie la ha determinado.
  v_rationale := NULLIF(btrim(p_necessity_rationale), '');
  IF v_rationale IS NULL THEN
    IF p_necessity_result = 'PENDIENTE' THEN
      v_rationale := 'Pendiente de determinación por el DPO (art. 35 RGPD). Ningún nivel de riesgo del RIA determina por sí solo la necesidad de EIPD.';
    ELSE
      RAISE EXCEPTION 'NECESIDAD_SIN_MOTIVO: fijar necessity_result=% exige un motivo explícito', p_necessity_result
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.entities e WHERE e.id = p_entity_id AND e.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: entidad % ajena al tenant de sesión', p_entity_id USING ERRCODE = '42501';
  END IF;

  IF p_ai_system_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ai_systems s WHERE s.id = p_ai_system_id AND s.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: sistema % ajeno al tenant de sesión', p_ai_system_id USING ERRCODE = '42501';
  END IF;

  IF p_dpo_person_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.persons pe WHERE pe.id = p_dpo_person_id AND pe.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_grc_registrar_eipd: persona DPO % ajena al tenant de sesión', p_dpo_person_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.grc_dpias (
    tenant_id, code, entity_id, controller_role, ai_system_id, processing_description,
    necessity_criteria, necessity_result, necessity_rationale,
    dpo_person_id, dpo_opinion, dpo_consulted_at, prior_consultation_required, created_by
  ) VALUES (
    v_tenant, p_code, p_entity_id, p_controller_role, p_ai_system_id, p_processing_description,
    COALESCE(p_necessity_criteria, '{}'::jsonb), p_necessity_result, v_rationale,
    p_dpo_person_id, p_dpo_opinion, CASE WHEN p_dpo_opinion IS NOT NULL THEN now() END,
    COALESCE(p_prior_consultation_required, false), auth.uid()
  )
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    entity_id = EXCLUDED.entity_id,
    controller_role = EXCLUDED.controller_role,
    ai_system_id = EXCLUDED.ai_system_id,
    processing_description = EXCLUDED.processing_description,
    necessity_criteria = EXCLUDED.necessity_criteria,
    necessity_result = EXCLUDED.necessity_result,
    necessity_rationale = EXCLUDED.necessity_rationale,
    dpo_person_id = EXCLUDED.dpo_person_id,
    dpo_opinion = EXCLUDED.dpo_opinion,
    dpo_consulted_at = CASE WHEN EXCLUDED.dpo_opinion IS NOT NULL THEN now() ELSE public.grc_dpias.dpo_consulted_at END,
    prior_consultation_required = EXCLUDED.prior_consultation_required,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_grc_registrar_eipd(text, uuid, text, text, uuid, text, text, jsonb, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_grc_registrar_eipd(text, uuid, text, text, uuid, text, text, jsonb, uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificación que ABORTA la migración si algo no queda como se espera.
-- Solo comprobaciones estructurales y de privilegios: la ruta que depende de
-- sesión real (auth.uid()/fn_current_tenant_id()) se ensaya con login real en
-- supabase/migrations/proposed/20260928120000_grc_eipd.probe.sql, no aquí
-- (un DO ejecutado por `postgres` no tiene JWT de sesión).
-- ---------------------------------------------------------------------------
DO $verificacion$
DECLARE
  v_rationale_not_null boolean;
  v_default_pendiente boolean;
  v_residuales_anon int;
  v_residuales_auth int;
  v_probe_id uuid := '00000000-0000-0000-0000-0000d00e0175';
  v_arga_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_arga_entity uuid := '6d7ed736-f263-4531-a59d-c6ca0cd41602';
  v_after uuid;
BEGIN
  SELECT (is_nullable = 'NO') INTO v_rationale_not_null
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'grc_dpias' AND column_name = 'necessity_rationale';
  IF NOT COALESCE(v_rationale_not_null, false) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: necessity_rationale debe ser NOT NULL';
  END IF;

  SELECT (column_default ILIKE '%PENDIENTE%') INTO v_default_pendiente
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'grc_dpias' AND column_name = 'necessity_result';
  IF NOT COALESCE(v_default_pendiente, false) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: necessity_result debe tener DEFAULT PENDIENTE';
  END IF;

  SELECT count(*) INTO v_residuales_anon
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'grc_dpias' AND grantee = 'anon';
  IF v_residuales_anon <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: anon conserva % privilegios sobre grc_dpias', v_residuales_anon;
  END IF;

  SELECT count(*) INTO v_residuales_auth
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'grc_dpias' AND grantee = 'authenticated'
     AND privilege_type <> 'SELECT';
  IF v_residuales_auth <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: authenticated conserva % privilegios de escritura directa sobre grc_dpias', v_residuales_auth;
  END IF;

  IF to_regprocedure('public.fn_grc_registrar_eipd(text, uuid, text, text, uuid, text, text, jsonb, uuid, text, boolean)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: falta fn_grc_registrar_eipd';
  END IF;

  -- Control positivo del propio instrumento: un INSERT directo (como
  -- postgres, sin pasar por la RPC) sin motivo debe rechazarse por el NOT
  -- NULL de la columna — la invariante vive en el esquema, no solo en la
  -- RPC. Se hace en una subtransacción que se deshace: no debe quedar
  -- residuo ni en la tabla ni en audit_log.
  BEGIN
    INSERT INTO public.grc_dpias (id, tenant_id, code, entity_id, controller_role, processing_description, necessity_result)
    VALUES (v_probe_id, v_arga_tenant, '__PROBE_MOI175_T11__', v_arga_entity, 'RESPONSABLE', 'sonda', 'REQUERIDA');
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: un INSERT sin necessity_rationale NO fue rechazado';
  EXCEPTION
    WHEN not_null_violation THEN
      NULL; -- esperado
  END;

  -- Control positivo simétrico: un INSERT directo CON motivo sí es aceptado
  -- por el esquema (la RPC añade las comprobaciones de tenant por encima).
  -- Subtransacción que se deshace a propósito (patrón P0175).
  BEGIN
    INSERT INTO public.grc_dpias (id, tenant_id, code, entity_id, controller_role, processing_description, necessity_result, necessity_rationale)
    VALUES (v_probe_id, v_arga_tenant, '__PROBE_MOI175_T11__', v_arga_entity, 'RESPONSABLE', 'sonda', 'PENDIENTE', 'sonda de verificación')
    RETURNING id INTO v_after;
    RAISE EXCEPTION USING ERRCODE = 'P0175', MESSAGE = 'deshacer sonda MOI-175 T11';
  EXCEPTION
    WHEN SQLSTATE 'P0175' THEN
      NULL; -- subtransacción deshecha: ni fila ni auditoría
  END;

  IF EXISTS (SELECT 1 FROM public.grc_dpias WHERE id = v_probe_id) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T11: quedó residuo de la sonda en grc_dpias';
  END IF;

  RAISE NOTICE 'MOI-175 F5.T11 OK: grc_dpias + fn_grc_registrar_eipd, sin residuo de sonda';
END;
$verificacion$;
