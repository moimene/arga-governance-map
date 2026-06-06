-- BUG FIX (caught by data-layer smoke test): meetings has `scheduled_start`,
-- not `meeting_date`. The previous tg_communications_validate_plazo crashed for
-- any communication with a meeting_id (i.e. exactly the convocatoria case the
-- plazo validation is meant to protect) with: column "meeting_date" does not exist.

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
    SELECT scheduled_start INTO v_meeting_date FROM meetings WHERE id = NEW.meeting_id;
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
