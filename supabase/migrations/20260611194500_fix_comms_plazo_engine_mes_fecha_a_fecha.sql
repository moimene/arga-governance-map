-- ITEM-024 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Gemelo plpgsql del motor de plazos de comunicaciones con dos defectos
-- normativos (verificados contra BOE), replicados también en el motor TS
-- cliente y en la copia _shared de la Edge Function (corregidos en el mismo
-- commit):
--   (a) Cita errónea: el plazo de 15 días de la junta de SL está en el art.
--       176.1 LSC; el art. 173 LSC regula la FORMA de la convocatoria.
--   (b) Cómputo SA: el art. 176.1 LSC exige "un mes", que se computa de fecha
--       a fecha (art. 5.1 CC) — no 30 días. Junta el 31/07: límite legal
--       30/06 (Postgres `- interval '1 month'` aplica exactamente esa regla,
--       con ajuste al último día del mes destino).
-- Forward-only, idempotente. Misma firma y mismo resto del cuerpo.

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
      -- ITEM-024(a): el plazo (SA y SL) está en el art. 176.1 LSC.
      v_ref := 'Art. 176.1 LSC';
      v_fuente := 'LEY';
      IF COALESCE(v_entity.es_cotizada, false) THEN
        v_warnings := v_warnings || to_jsonb('Sociedad cotizada: verificar art. 516 LSC para 2ª convocatoria'::text);
      END IF;
      IF p_meeting_date IS NOT NULL THEN
        -- ITEM-024(b): SA = un mes de fecha a fecha (art. 5.1 CC);
        -- SL = 15 días naturales.
        IF v_is_sa THEN
          v_min_envio := p_meeting_date - interval '1 month';
        ELSE
          v_min_envio := p_meeting_date - (v_plazo || ' days')::interval;
        END IF;
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
