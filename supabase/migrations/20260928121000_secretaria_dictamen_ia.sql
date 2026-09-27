-- 20260928121000_secretaria_dictamen_ia.sql (MOI-175, F5.T13 — SOLO el
-- MECANISMO de registro; ningún dictamen real se siembra aquí)
--
-- QUÉ HACE
-- --------
-- 1) `fn_secretaria_registrar_dictamen_ia`: registra en el ancla probatoria
--    de Secretaría (`secretaria_document_artifacts`) el dictamen del Comité
--    de Gobernanza de la IA MÁS la decisión de quien decide (Senior
--    Partner/Presidencia), como un único hecho ya cerrado — no un workflow
--    de borrador a aprobación: nace en estado APPROVED. Valida que el órgano
--    es del tenant de la sesión, que el autor es miembro VIGENTE de ese
--    órgano (`condiciones_persona`) y que el decisor tiene un cargo VIGENTE.
--    `source_domain = 'ai_system'` (convenio en minúsculas ya usado por la
--    tabla), `source_id = system_id`.
-- 2) Endurecimiento GC-139: la tabla medía con política FOR ALL (admite
--    UPDATE y DELETE) y todos los grants para `anon`/`authenticated`,
--    TRUNCATE incluido. Se añade: inmutabilidad (BEFORE UPDATE) y
--    BEFORE DELETE para `source_domain = 'ai_system'` desde APPROVED,
--    SIGNED, ARCHIVED o SUPERSEDED; `REVOKE ALL FROM anon`;
--    `REVOKE TRUNCATE, TRIGGER, REFERENCES FROM authenticated`. Los demás
--    dominios (`agreement`, `certification`, `condiciones_persona`,
--    `mandatory_books`, `registry_filing`) NO cambian de comportamiento:
--    `useSecretariaDocumentArtifacts.ts:539` y
--    `standalone-certifications/document.ts:247` siguen actualizando estado
--    exactamente igual.
--
-- QUÉ NO HACE (a propósito)
-- -------------------------
-- No registra ningún dictamen real: el Comité de Gobernanza de la IA de
-- Garrigues resuelve MOI-178/MOI-182 primero. El Comité no aparece como
-- adoptante (no crea agreements ni pisa el motor de adopción societaria).
-- Cero cambio ARGA/Garrigues: ninguna fila nueva en secretaria_document_artifacts
-- desde esta migración, solo el mecanismo y el endurecimiento.

-- ---------------------------------------------------------------------------
-- 1) Endurecimiento GC-139 — inmutabilidad y BEFORE DELETE para el dominio
--    'ai_system' desde APPROVED/SIGNED/ARCHIVED/SUPERSEDED. Bloquea a
--    CUALQUIER rol, incluido el propietario de la tabla: es la garantía de
--    que "no se puede editar ni borrar después de aprobados" que pide la
--    aceptación de F5.T13, no una defensa parcial.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_secretaria_document_artifact_ai_immutability_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF OLD.source_domain = 'ai_system'
     AND OLD.status IN ('APPROVED', 'SIGNED', 'ARCHIVED', 'SUPERSEDED') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'DICTAMEN_IA_NO_BORRABLE: el artefacto % (dictamen de IA) está en % y no se puede borrar', OLD.id, OLD.status
        USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'DICTAMEN_IA_INMUTABLE: el artefacto % (dictamen de IA) está en % y no se puede modificar', OLD.id, OLD.status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_secretaria_document_artifact_ai_immutability_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_secretaria_document_artifact_ai_immutable_update ON public.secretaria_document_artifacts;
CREATE TRIGGER trg_secretaria_document_artifact_ai_immutable_update
  BEFORE UPDATE ON public.secretaria_document_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_document_artifact_ai_immutability_guard();

DROP TRIGGER IF EXISTS trg_secretaria_document_artifact_ai_immutable_delete ON public.secretaria_document_artifacts;
CREATE TRIGGER trg_secretaria_document_artifact_ai_immutable_delete
  BEFORE DELETE ON public.secretaria_document_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_document_artifact_ai_immutability_guard();

-- Un GRANT es aditivo y TRUNCATE no pasa por RLS (gotcha medido varias veces
-- en este programa). `anon` medía con SELECT/INSERT/UPDATE/DELETE heredados
-- de los privilegios por defecto del esquema; se revocan explícitamente.
REVOKE ALL ON public.secretaria_document_artifacts FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.secretaria_document_artifacts FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_secretaria_document_artifacts_source_domain_id
  ON public.secretaria_document_artifacts (tenant_id, source_domain, source_id);

-- ---------------------------------------------------------------------------
-- 2) RPC de registro del dictamen + decisión, con las tres validaciones que
--    pide la aceptación de F5.T13.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_secretaria_registrar_dictamen_ia(
  p_system_id         uuid,
  p_entity_id         uuid,
  p_body_id           uuid,
  p_asunto            text,
  p_contenido         text,
  p_decisor_person_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tenant uuid := public.fn_current_tenant_id();
  v_autor_person uuid;
  v_id uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: sin tenant de sesión' USING ERRCODE = '42501';
  END IF;

  IF p_asunto NOT IN (
    'CLASIFICACION', 'ACEPTACION_RESIDUAL', 'USO_EXTRAORDINARIO_PI30', 'VALIDACION_CATALOGO',
    'CADENCIA_REVISION', 'CESE_ART5', 'ORGANO_IA', 'CAMBIO_SIGNIFICATIVO_111_2',
    'SECRETO_PROFESIONAL', 'ACUERDO_INTRAGRUPO'
  ) THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: asunto % no reconocido', p_asunto USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_secretaria_can_write_document_artifacts(v_tenant) THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: sin capacidad para registrar dictámenes' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ai_systems s WHERE s.id = p_system_id AND s.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: sistema % ajeno al tenant de sesión', p_system_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.entities e WHERE e.id = p_entity_id AND e.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: entidad % ajena al tenant de sesión', p_entity_id USING ERRCODE = '42501';
  END IF;

  -- El órgano es del tenant.
  IF NOT EXISTS (SELECT 1 FROM public.governing_bodies gb WHERE gb.id = p_body_id AND gb.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'fn_secretaria_registrar_dictamen_ia: órgano % ajeno al tenant de sesión', p_body_id USING ERRCODE = '42501';
  END IF;

  SELECT up.person_id INTO v_autor_person
    FROM public.user_profiles up
   WHERE up.user_id = auth.uid() AND up.tenant_id = v_tenant;
  IF v_autor_person IS NULL THEN
    RAISE EXCEPTION 'PERFIL_SIN_PERSONA: la sesión no tiene persona asociada en user_profiles' USING ERRCODE = '42501';
  END IF;

  -- El autor es miembro vigente del órgano que dictamina.
  IF NOT EXISTS (
    SELECT 1 FROM public.condiciones_persona cp
     WHERE cp.body_id = p_body_id AND cp.person_id = v_autor_person
       AND cp.tenant_id = v_tenant AND cp.estado = 'VIGENTE'
  ) THEN
    RAISE EXCEPTION 'AUTOR_NO_MIEMBRO_ORGANO: la persona de sesión no es miembro vigente del órgano %', p_body_id
      USING ERRCODE = '42501';
  END IF;

  -- El decisor tiene un cargo vigente en condiciones_persona.
  IF NOT EXISTS (
    SELECT 1 FROM public.condiciones_persona cp
     WHERE cp.person_id = p_decisor_person_id AND cp.tenant_id = v_tenant AND cp.estado = 'VIGENTE'
  ) THEN
    RAISE EXCEPTION 'DECISOR_SIN_CARGO_VIGENTE: la persona % no tiene ningún cargo vigente', p_decisor_person_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.secretaria_document_artifacts (
    tenant_id, artifact_kind, title, status,
    source_domain, source_id, source_payload,
    metadata, generated_by, generated_at
  ) VALUES (
    v_tenant, 'INFORME_PRECEPTIVO', 'Dictamen del Comité de IA — ' || p_asunto, 'APPROVED',
    'ai_system', p_system_id,
    jsonb_build_object(
      'entity_id', p_entity_id,
      'body_id', p_body_id,
      'asunto', p_asunto,
      'autor_person_id', v_autor_person,
      'decisor_person_id', p_decisor_person_id
    ),
    jsonb_build_object('contenido', p_contenido),
    auth.uid(), now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_secretaria_registrar_dictamen_ia(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_registrar_dictamen_ia(uuid, uuid, uuid, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificación que ABORTA. El bloqueo de inmutabilidad NO depende de sesión
-- (se aplica a cualquier rol, `postgres` incluido), así que se prueba aquí
-- mismo con datos reales, en subtransacciones que se deshacen (patrón
-- P0176/P0177): nunca queda residuo en la tabla ni en su cadena de auditoría.
-- ---------------------------------------------------------------------------
DO $verificacion$
DECLARE
  v_residuales_anon int;
  v_residuales_auth int;
  v_probe_id uuid := '00000000-0000-0000-0000-0000d00e0176';
  v_arga_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_arga_system uuid := '90000000-0000-0000-0000-000000000001';
  v_bloqueado boolean := false;
  v_otro_dominio_id uuid;
  v_otro_dominio_tenant uuid;
  v_otro_dominio_metadata jsonb;
BEGIN
  IF to_regprocedure('public.fn_secretaria_registrar_dictamen_ia(uuid, uuid, uuid, text, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: falta fn_secretaria_registrar_dictamen_ia';
  END IF;

  SELECT count(*) INTO v_residuales_anon
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'secretaria_document_artifacts' AND grantee = 'anon';
  IF v_residuales_anon <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: anon conserva % privilegios sobre secretaria_document_artifacts', v_residuales_anon;
  END IF;

  SELECT count(*) INTO v_residuales_auth
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'secretaria_document_artifacts' AND grantee = 'authenticated'
     AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  IF v_residuales_auth <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: authenticated conserva % privilegios de TRUNCATE/TRIGGER/REFERENCES', v_residuales_auth;
  END IF;

  -- Control positivo del guardia: un artefacto ai_system en APPROVED no
  -- admite UPDATE. Fila de sonda insertada y borrada dentro de la misma
  -- subtransacción deshecha (el propio INSERT también es de sonda, así que
  -- no hace falta un DELETE aparte antes del rollback).
  BEGIN
    INSERT INTO public.secretaria_document_artifacts (id, tenant_id, artifact_kind, title, status, source_domain, source_id)
    VALUES (v_probe_id, v_arga_tenant, 'INFORME_PRECEPTIVO', '__PROBE_MOI175_T13__', 'APPROVED', 'ai_system', v_arga_system);

    BEGIN
      UPDATE public.secretaria_document_artifacts SET title = 'intento de edición' WHERE id = v_probe_id;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'DICTAMEN_IA_INMUTABLE%' THEN
        v_bloqueado := true;
      ELSE
        RAISE;
      END IF;
    END;

    RAISE EXCEPTION USING ERRCODE = 'P0176', MESSAGE = 'deshacer sonda MOI-175 T13 (UPDATE)';
  EXCEPTION
    WHEN SQLSTATE 'P0176' THEN
      NULL; -- subtransacción deshecha: ni fila ni auditoría
  END;

  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: el UPDATE de un dictamen ai_system APPROVED NO fue rechazado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.secretaria_document_artifacts WHERE id = v_probe_id) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: quedó residuo de la sonda en secretaria_document_artifacts';
  END IF;

  -- Control positivo simétrico: el DELETE de ese mismo estado también se
  -- rechaza (segunda sonda, propia).
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.secretaria_document_artifacts (id, tenant_id, artifact_kind, title, status, source_domain, source_id)
    VALUES (v_probe_id, v_arga_tenant, 'INFORME_PRECEPTIVO', '__PROBE_MOI175_T13_DEL__', 'APPROVED', 'ai_system', v_arga_system);

    BEGIN
      DELETE FROM public.secretaria_document_artifacts WHERE id = v_probe_id;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'DICTAMEN_IA_NO_BORRABLE%' THEN
        v_bloqueado := true;
      ELSE
        RAISE;
      END IF;
    END;

    RAISE EXCEPTION USING ERRCODE = 'P0177', MESSAGE = 'deshacer sonda MOI-175 T13 (DELETE)';
  EXCEPTION
    WHEN SQLSTATE 'P0177' THEN
      NULL;
  END;

  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: el DELETE de un dictamen ai_system APPROVED NO fue rechazado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.secretaria_document_artifacts WHERE id = v_probe_id) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-175 T13: quedó residuo de la segunda sonda en secretaria_document_artifacts';
  END IF;

  -- Control negativo del propio guardia: un artefacto de OTRO dominio real
  -- (no 'ai_system') sigue aceptando UPDATE de estado exactamente igual que
  -- antes — el endurecimiento no debe tocar los flujos existentes de
  -- Secretaría. No se inventa una fila: se usa una ya existente y se
  -- restaura su valor exacto dentro de la misma subtransacción deshecha.
  SELECT id, tenant_id, metadata INTO v_otro_dominio_id, v_otro_dominio_tenant, v_otro_dominio_metadata
    FROM public.secretaria_document_artifacts
   WHERE source_domain IS DISTINCT FROM 'ai_system'
   LIMIT 1;

  IF v_otro_dominio_id IS NOT NULL THEN
    BEGIN
      UPDATE public.secretaria_document_artifacts
         SET metadata = COALESCE(v_otro_dominio_metadata, '{}'::jsonb)
       WHERE id = v_otro_dominio_id;
      RAISE EXCEPTION USING ERRCODE = 'P0178', MESSAGE = 'deshacer sonda MOI-175 T13 (otro dominio)';
    EXCEPTION
      WHEN SQLSTATE 'P0178' THEN
        NULL; -- esperado: no debía lanzar ningún otro error antes de llegar aquí
    END;
  END IF;

  RAISE NOTICE 'MOI-175 F5.T13 OK: mecanismo de dictamen + GC-139, sin residuo de sonda';
END;
$verificacion$;
