-- ============================================================
-- fn_derive_comunicacion_config: derives comms config from the canonical
-- materia_catalog (single source of truth from the rules-engine consolidation).
-- Replaces hardcoded per-materia seeds. Reusable for any future materia.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_derive_comunicacion_config(p_materia text)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  mc record;
  v_nivel text;
  v_dest jsonb;
  v_tipo text;
  v_resp text;
  v_canales jsonb;
BEGIN
  SELECT * INTO mc FROM materia_catalog WHERE materia = p_materia;
  IF NOT FOUND THEN
    RETURN NULL;  -- cannot derive without a catalog entry
  END IF;

  -- nivel_certificacion_minimo
  IF COALESCE(mc.requires_notary, false) OR COALESCE(mc.inscribable, false) THEN
    v_nivel := 'BUROFAX_ERDS';
  ELSIF mc.matter_class IN ('ESPECIAL','ESTATUTARIA') THEN
    v_nivel := 'EMAIL_CERTIFICADO';
  ELSIF mc.matter_class = 'ORDINARIA' THEN
    IF COALESCE(mc.requires_registry, false) OR COALESCE(mc.publication_required, false) THEN
      v_nivel := 'EMAIL_CERTIFICADO';
    ELSE
      v_nivel := 'EMAIL_NORMAL';  -- purely informative ordinary matters
    END IF;
  ELSE
    v_nivel := 'EMAIL_CERTIFICADO';  -- conservative default for unknown classes
  END IF;

  -- destinatarios_tipo
  v_dest := jsonb_build_array('MIEMBROS_ORGANO');
  IF COALESCE(mc.requires_registry, false) OR COALESCE(mc.inscribable, false) THEN
    v_dest := v_dest || to_jsonb('REGISTRO'::text);
  END IF;

  -- tipo_comunicacion_default + tipo_respuesta_esperada
  IF p_materia = 'ACUERDO_CONVOCATORIA_JUNTA' THEN
    v_tipo := 'CONVOCATORIA';
    v_resp := 'ACUSE';
  ELSIF v_nivel = 'EMAIL_NORMAL' THEN
    v_tipo := 'NOTIFICACION_ACUERDO';
    v_resp := 'INFORMATIVA';
  ELSE
    v_tipo := 'NOTIFICACION_ACUERDO';
    v_resp := 'ACUSE';
  END IF;

  -- canales_permitidos derived from nivel
  v_canales := CASE v_nivel
    WHEN 'BUROFAX_ERDS' THEN jsonb_build_array('BUROFAX_ERDS','EMAIL_CERTIFICADO')
    WHEN 'EMAIL_CERTIFICADO' THEN jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH')
    ELSE jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH')
  END;

  RETURN jsonb_build_object(
    'destinatarios_tipo', v_dest,
    'tipo_comunicacion_default', v_tipo,
    'tipo_respuesta_esperada', v_resp,
    'nivel_certificacion_minimo', v_nivel,
    'canales_permitidos', v_canales,
    'plazo_legal_dias', null,
    'condicional', false,
    'condicion_expresion', null,
    'referencia_legal', COALESCE(mc.referencia_legal, 'Sin referencia legal específica'),
    'derived_from', 'materia_catalog'
  );
END $$;

COMMENT ON FUNCTION fn_derive_comunicacion_config(text) IS
  'Derives comms config defaults from materia_catalog. Used to backfill comunicacion_config for templates whose materia exists in the catalog. Comité Legal may override specific materias afterward.';

-- Backfill the pending templates whose materia exists in the catalog.
-- Idempotent: only touches rows where comunicacion_config IS NULL.
UPDATE plantillas_protegidas pp
SET comunicacion_config = fn_derive_comunicacion_config(pp.materia)
WHERE pp.requiere_comunicacion = true
  AND pp.comunicacion_config IS NULL
  AND pp.materia IS NOT NULL
  AND EXISTS (SELECT 1 FROM materia_catalog mc WHERE mc.materia = pp.materia);
