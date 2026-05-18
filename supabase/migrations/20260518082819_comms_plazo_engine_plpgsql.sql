-- ============================================================
-- fn_calcular_plazo_comunicacion: synchronous PL/pgSQL mirror of TS engine
-- Replaces async pg_net+poll approach that could not block transactions.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_calcular_plazo_comunicacion(
  p_tipo_comunicacion text,
  p_organo_tipo text,
  p_entity_id uuid,
  p_meeting_date timestamptz,
  p_template_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity record;
  v_cfg jsonb;
  v_plazo int;
  v_unidad text := 'NATURAL';
  v_ref text;
  v_fuente text;
  v_min_envio timestamptz;
  v_warnings jsonb := '[]'::jsonb;
  v_is_sa boolean;
BEGIN
  SELECT tipo_social, es_cotizada, jurisdiction INTO v_entity
  FROM entities WHERE id = p_entity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'min_envio_date', null, 'plazo_dias', 0, 'unidad', 'NATURAL',
      'referencia_legal', 'Entity not found',
      'fuente_resolucion', 'LEY',
      'warnings', jsonb_build_array('Entity ' || p_entity_id::text || ' not found')
    );
  END IF;

  IF COALESCE(v_entity.jurisdiction, 'ES') <> 'ES' THEN
    RETURN jsonb_build_object(
      'min_envio_date', null, 'plazo_dias', 0, 'unidad', 'NATURAL',
      'referencia_legal', 'Multi-jurisdicción no soportada en P1-P4',
      'fuente_resolucion', 'LEY',
      'warnings', jsonb_build_array('Jurisdicción ' || COALESCE(v_entity.jurisdiction, 'NULL') || ' fuera de scope')
    );
  END IF;

  IF p_tipo_comunicacion = 'CONVOCATORIA' THEN
    IF p_organo_tipo = 'JUNTA_GENERAL' THEN
      v_is_sa := COALESCE(v_entity.tipo_social, 'SA') IN ('SA', 'SAU');
      v_plazo := CASE WHEN v_is_sa THEN 30 ELSE 15 END;
      v_ref := CASE WHEN v_is_sa THEN 'Art. 176.1 LSC' ELSE 'Art. 173 LSC' END;
      v_fuente := 'LEY';
      IF COALESCE(v_entity.es_cotizada, false) THEN
        v_warnings := v_warnings || to_jsonb('Sociedad cotizada: verificar art. 516 LSC para 2ª convocatoria'::text);
      END IF;
      IF p_meeting_date IS NOT NULL THEN
        v_min_envio := p_meeting_date - (v_plazo || ' days')::interval;
      END IF;
    ELSIF p_organo_tipo = 'CONSEJO_ADMIN' THEN
      v_plazo := 0; v_ref := 'Art. 246 LSC (plazo según estatutos)'; v_fuente := 'ESTATUTOS';
      v_warnings := v_warnings || to_jsonb('Verificar plazo en estatutos del Consejo'::text);
    ELSIF p_organo_tipo = 'COMISION_DELEGADA' THEN
      v_plazo := 0; v_ref := 'Art. 249 LSC + Reglamento del Consejo'; v_fuente := 'REGLAMENTO';
      v_warnings := v_warnings || to_jsonb('Verificar plazo en Reglamento del Consejo'::text);
    ELSE
      v_plazo := 0; v_ref := 'No aplica plazo de convocatoria a órgano no colegiado'; v_fuente := 'LEY';
    END IF;
  ELSE
    IF p_template_id IS NOT NULL THEN
      SELECT comunicacion_config INTO v_cfg FROM plantillas_protegidas WHERE id = p_template_id;
    END IF;
    v_plazo := COALESCE((v_cfg->>'plazo_legal_dias')::int, 0);
    v_ref := COALESCE(v_cfg->>'referencia_legal', 'Sin plazo legal específico');
    v_fuente := CASE WHEN v_cfg IS NOT NULL THEN 'COMUNICACION_CONFIG' ELSE 'LEY' END;
    v_min_envio := NULL;
  END IF;

  RETURN jsonb_build_object(
    'min_envio_date', v_min_envio,
    'plazo_dias', v_plazo,
    'unidad', v_unidad,
    'referencia_legal', v_ref,
    'fuente_resolucion', v_fuente,
    'warnings', v_warnings
  );
END $$;

REVOKE EXECUTE ON FUNCTION fn_calcular_plazo_comunicacion(text, text, uuid, timestamptz, uuid) FROM public;
GRANT EXECUTE ON FUNCTION fn_calcular_plazo_comunicacion(text, text, uuid, timestamptz, uuid) TO authenticated, service_role;

-- Replace async pg_net trigger with synchronous PL/pgSQL version
CREATE OR REPLACE FUNCTION tg_communications_validate_plazo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_date timestamptz;
  v_result jsonb;
  v_min_envio timestamptz;
BEGIN
  IF NEW.estado NOT IN ('PROGRAMADA','ENVIANDO','ENVIADA') OR NEW.fecha_programada IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo_comunicacion <> 'CONVOCATORIA' AND NEW.meeting_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.meeting_id IS NOT NULL THEN
    SELECT meeting_date INTO v_meeting_date FROM meetings WHERE id = NEW.meeting_id;
  END IF;
  v_result := fn_calcular_plazo_comunicacion(
    NEW.tipo_comunicacion, NEW.organo_tipo, NEW.entity_id, v_meeting_date, NEW.template_id
  );
  v_min_envio := (v_result->>'min_envio_date')::timestamptz;
  IF v_min_envio IS NOT NULL AND NEW.fecha_programada > v_min_envio THEN
    RAISE EXCEPTION 'Plazo legal incumplido: envío debe ser a más tardar % (%, % días %)',
      v_min_envio,
      v_result->>'referencia_legal',
      v_result->>'plazo_dias',
      v_result->>'unidad';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_communications_validate_plazo_t ON communications;
CREATE TRIGGER tg_communications_validate_plazo_t
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW EXECUTE FUNCTION tg_communications_validate_plazo();

COMMENT ON FUNCTION fn_calcular_plazo_comunicacion(text, text, uuid, timestamptz, uuid) IS
  'Synchronous PL/pgSQL mirror of src/lib/rules-engine/comms-plazo-engine.ts. Used by tg_communications_validate_plazo trigger (BEFORE INSERT/UPDATE).';
